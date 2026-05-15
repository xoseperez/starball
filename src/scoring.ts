// Path-complexity scoring with guards (wall-frame exclusion, per-star cap,
// time decay, grazing bonus). Pure logic — easy to unit-test.

import * as config from "./config";
import { type Asteroid, type Star, starCaptureRadius } from "./entities";

export interface ScoreBreakdown {
  base: number;
  curvature: number;
  grazing: number;
  timeMultiplier: number;
  total: number;
}

export interface AssistEvent {
  starIndex: number;
  flightTime: number;
}

export class ScoreAccumulator {
  starCurv = new Map<number, number>();
  starMinD = new Map<number, number>();
  starTimeNear = new Map<number, number>();
  prevAngle: number | null = null;
  lastAssistStar: number | null = null;
  assistEvents: AssistEvent[] = [];

  update(
    a: Asteroid,
    stars: readonly Star[],
    dt: number,
    bouncedThisStep: boolean,
  ): void {
    // Per-star min-distance + time-near tracking
    let nearestIdx = -1;
    let nearestD = Infinity;
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const dx = s.x - a.x;
      const dy = s.y - a.y;
      const d = Math.hypot(dx, dy);
      const prevMin = this.starMinD.get(i) ?? Infinity;
      if (d < prevMin) this.starMinD.set(i, d);

      const refR = starCaptureRadius(s);
      if (d < config.GRAZE_RADIUS_MULT * refR) {
        const prev = this.starTimeNear.get(i) ?? 0;
        const next = prev + dt;
        this.starTimeNear.set(i, next);
        // Emit assist event when we first enter the zone for this star.
        if (next === dt && i !== this.lastAssistStar) {
          this.assistEvents.push({ starIndex: i, flightTime: a.flightTime });
          this.lastAssistStar = i;
        }
      }
      if (d < nearestD) {
        nearestD = d;
        nearestIdx = i;
      }
    }

    // Curvature accumulation (skip if bounced this step or first frame)
    const curAngle = Math.atan2(a.vy, a.vx);
    if (!bouncedThisStep && this.prevAngle !== null && nearestIdx >= 0) {
      const delta = wrapToPi(curAngle - this.prevAngle);
      const tNear = this.starTimeNear.get(nearestIdx) ?? 0;
      const decay = Math.max(0, 1 - tNear / config.TIME_DECAY_TAU);
      const contrib = Math.abs(delta) * decay;
      const prev = this.starCurv.get(nearestIdx) ?? 0;
      const cap = config.C_STAR_MAX / config.K_CURV;
      this.starCurv.set(nearestIdx, Math.min(cap, prev + contrib));
    }
    this.prevAngle = curAngle;
  }

  runningCurvature(): number {
    let sum = 0;
    for (const v of this.starCurv.values()) sum += v;
    return sum;
  }

  runningCurvatureScore(): number {
    return Math.min(
      config.K_CURV * this.runningCurvature(),
      config.CURVATURE_GLOBAL_CAP,
    );
  }

  finalScore(stars: readonly Star[], flightTime = 0): ScoreBreakdown {
    const curvaturePts = this.runningCurvatureScore();

    let grazingPts = 0;
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const dMin = this.starMinD.get(i) ?? Infinity;
      const p = config.STAR_TYPES[s.starType];
      const refR = starCaptureRadius(s);
      const grazeMaxD = config.GRAZE_RADIUS_MULT * refR;
      if (dMin >= grazeMaxD) continue;
      const m = p.mass > 0 ? p.mass : 200.0; // notional mass for black hole
      const factor = Math.max(0, 1 - dMin / grazeMaxD);
      grazingPts += config.K_GRAZE * factor * m;
    }

    const over = Math.max(0, flightTime - config.FLIGHT_TIME_GRACE_S);
    const timeMultiplier = Math.max(
      config.FLIGHT_TIME_PENALTY_FLOOR,
      1 - over / config.FLIGHT_TIME_PENALTY_WINDOW_S,
    );

    const base = config.SCORE_BASE;
    const curvature = Math.round(curvaturePts);
    const grazing = Math.round(grazingPts);
    const total = Math.round((base + curvaturePts + grazingPts) * timeMultiplier);
    return { base, curvature, grazing, timeMultiplier, total };
  }
}

export function wrapToPi(a: number): number {
  let x = a;
  while (x > Math.PI) x -= 2 * Math.PI;
  while (x < -Math.PI) x += 2 * Math.PI;
  return x;
}
