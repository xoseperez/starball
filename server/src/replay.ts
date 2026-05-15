// Server-side replay validation. Re-runs each shot's physics from the recorded
// seed + inputs and accumulates the score. The submission is accepted only if
// the computed total matches the claimed score (within REPLAY_SCORE_TOLERANCE).
//
// This file imports the SHARED logic modules from ../src/ — the same code the
// frontend ships. Determinism: pure JS floats + mulberry32 PRNG + Velocity
// Verlet with fixed substep dt. Client and server both run V8.

import * as physicsConfig from "../../src/config";
import { type GameMap, type Star, starCaptureRadius } from "../../src/entities";
import { generate as generateMap } from "../../src/mapgen";
import { RoundEnd, makeShot, step, substepsForFrame } from "../../src/physics";
import { ScoreAccumulator } from "../../src/scoring";

import { REPLAY_MAX_SHOTS, REPLAY_MAX_SIM_SECONDS, REPLAY_SCORE_TOLERANCE } from "./config.js";

export interface ShotTranscript {
  level: number;
  mapSeed: number;
  angleDeg: number;
  powerPct: number;
}

export interface ReplayInput {
  shots: ShotTranscript[];
  claimedScore: number;
  startingLives: number; // 0 means unlimited (matches the client setting)
}

export interface ReplayResult {
  ok: boolean;
  reason?: string;
  computedScore: number;
  scoredShots: number;
  level: number;
}

// Mirror of the client's PlayScene.tickFlight, decoupled from the render loop.
// Returns the breakdown if scored, null otherwise. Mutates the asteroid state
// but doesn't matter since we discard it after each shot.
function simulateShot(
  m: GameMap,
  angleDeg: number,
  powerPct: number,
): { scored: boolean; total: number; simSeconds: number } {
  const a = makeShot(m.launcher.x, m.launcher.y, angleDeg, powerPct);
  const acc = new ScoreAccumulator();
  let stopTimer = 0;
  let minDistGoal = Math.hypot(m.goal.x - a.x, m.goal.y - a.y);
  let lastProgressT = 0;
  const posHistory: Array<[number, number, number]> = [];
  const frameDt = 1 / physicsConfig.TARGET_FPS;

  while (a.alive && a.flightTime < physicsConfig.HARD_TIMEOUT_S) {
    const nSub = substepsForFrame(a, m.stars);
    const dtSub = frameDt / nSub;
    let ended = false;
    for (let i = 0; i < nSub; i++) {
      if (!a.alive) break;
      const r = step(a, m.stars, m.goal, dtSub);
      acc.update(a, m.stars, dtSub, a.bouncedThisStep);
      if (r.end === RoundEnd.SCORED) {
        const br = acc.finalScore(m.stars, a.flightTime);
        return { scored: true, total: br.total, simSeconds: a.flightTime };
      }
      if (r.end === RoundEnd.CRASHED) {
        ended = true;
        break;
      }
    }
    if (ended || !a.alive) break;

    // Stop detection (low speed + low accel for STOP_DURATION_S)
    const speed = Math.hypot(a.vx, a.vy);
    const accel = Math.hypot(a.ax, a.ay);
    if (speed < physicsConfig.STOP_VEL && accel < physicsConfig.STOP_ACC) {
      stopTimer += frameDt;
      if (stopTimer >= physicsConfig.STOP_DURATION_S) break;
    } else {
      stopTimer = 0;
    }

    // Stuck-in-orbit detection (bbox over a sliding window)
    posHistory.push([a.flightTime, a.x, a.y]);
    const cutoff = a.flightTime - physicsConfig.STUCK_WINDOW_S;
    while (posHistory.length > 0 && posHistory[0][0] < cutoff) posHistory.shift();
    if (a.flightTime > physicsConfig.STUCK_WINDOW_S && posHistory.length >= 30) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const [, x, y] of posHistory) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
      if (maxX - minX + (maxY - minY) < physicsConfig.STUCK_BBOX_THRESHOLD) break;
    }

    // No-progress timeout
    const dGoal = Math.hypot(m.goal.x - a.x, m.goal.y - a.y);
    if (dGoal < minDistGoal - 4) {
      minDistGoal = dGoal;
      lastProgressT = a.flightTime;
    } else if (a.flightTime - lastProgressT > physicsConfig.NO_PROGRESS_TIMEOUT_S) {
      break;
    }
  }
  return { scored: false, total: 0, simSeconds: a.flightTime };
}

export function validateReplay(input: ReplayInput): ReplayResult {
  if (input.shots.length === 0) {
    return { ok: false, reason: "empty transcript", computedScore: 0, scoredShots: 0, level: 1 };
  }
  if (input.shots.length > REPLAY_MAX_SHOTS) {
    return { ok: false, reason: "transcript too long", computedScore: 0, scoredShots: 0, level: 1 };
  }

  let level = 1;
  let computedScore = 0;
  let scoredShots = 0;
  // Server tracks lives the same way the client does. startingLives==0 means
  // "unlimited" in the settings layer; internally that's -1.
  let lives = input.startingLives > 0 ? input.startingLives : -1;
  let simTimeTotal = 0;

  for (let i = 0; i < input.shots.length; i++) {
    const shot = input.shots[i];

    if (shot.level !== level) {
      return {
        ok: false,
        reason: `shot ${i}: level mismatch (claimed ${shot.level}, server ${level})`,
        computedScore, scoredShots, level,
      };
    }
    if (
      typeof shot.mapSeed !== "number" ||
      !Number.isFinite(shot.mapSeed) ||
      !Number.isFinite(shot.angleDeg) ||
      !Number.isFinite(shot.powerPct) ||
      shot.powerPct < physicsConfig.MIN_POWER_PCT ||
      shot.powerPct > physicsConfig.MAX_POWER_PCT
    ) {
      return {
        ok: false,
        reason: `shot ${i}: invalid inputs`,
        computedScore, scoredShots, level,
      };
    }

    const m = generateMap(level, shot.mapSeed);
    const outcome = simulateShot(m, shot.angleDeg, shot.powerPct);
    simTimeTotal += outcome.simSeconds;
    if (simTimeTotal > REPLAY_MAX_SIM_SECONDS) {
      return {
        ok: false,
        reason: "replay simulated time exceeded budget",
        computedScore, scoredShots, level,
      };
    }

    if (outcome.scored) {
      computedScore += outcome.total;
      scoredShots += 1;
      if (lives > 0) lives += 1; // Play awards +1 life on goal
      level += 1;
    } else if (lives > 0) {
      lives -= 1;
      if (lives === 0) {
        // Game must end here — any additional shots in the transcript are
        // bogus.
        if (i !== input.shots.length - 1) {
          return {
            ok: false,
            reason: "shots submitted after game over",
            computedScore, scoredShots, level,
          };
        }
      }
    }
  }

  const diff = Math.abs(computedScore - input.claimedScore);
  if (diff > REPLAY_SCORE_TOLERANCE) {
    return {
      ok: false,
      reason: `score mismatch (claimed ${input.claimedScore}, computed ${computedScore})`,
      computedScore, scoredShots, level,
    };
  }
  return { ok: true, computedScore, scoredShots, level };
}

// Re-export the type for star utilities that callers might want.
export { starCaptureRadius };
export type { Star };
