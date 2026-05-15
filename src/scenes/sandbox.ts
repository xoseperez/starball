// Sandbox: free play, no scoring, trajectory preview always available.

import { BANK } from "../audio";
import * as config from "../config";
import { type Asteroid, type GameMap } from "../entities";
import { HANDMAPS } from "../handmaps";
import { AimState } from "../input";
import { generate } from "../mapgen";
import { RoundEnd, makeShot, step, substepsForFrame } from "../physics";
import { Random } from "../random";
import { drawGravityField, drawHUD, drawMap, drawText, Trail } from "../render";
import { previewTrajectory } from "../trajectory";
import { Scene, type InputEvent } from "./base";

enum Phase {
  AIM = "aim",
  IN_FLIGHT = "in_flight",
}

const LINGER_S = 1.0;

export class SandboxScene extends Scene {
  private rng = new Random();
  private map: GameMap;
  private aim = new AimState(30, 55);
  private phase = Phase.AIM;
  private asteroid: Asteroid | null = null;
  private trail = new Trail(80);
  private previewOn = true;
  private fieldOn = false;
  private pulsePhase = 0;
  private handmapIdx = -1;
  private lingerTimer = 0;
  private lastResult: RoundEnd | null = null;
  private bounceCooldown = 0;

  constructor() {
    super();
    this.map = generate(3, this.rng.randomSeed());
  }

  override handleEvent(e: InputEvent): void {
    if (e.key === "Escape" || e.key === "Backspace") {
      void this.toMenu();
      return;
    }
    const mult = e.shift ? 5 : 1;
    const ang = mult;
    const pwr = mult;
    if (this.phase === Phase.AIM) {
      if (e.key === "ArrowLeft") this.aim.adjustAngle(+ang);
      else if (e.key === "ArrowRight") this.aim.adjustAngle(-ang);
      else if (e.key === "ArrowUp" || e.key === "+" || e.key === "=") this.aim.adjustPower(+pwr);
      else if (e.key === "ArrowDown" || e.key === "-") this.aim.adjustPower(-pwr);
      else if (e.key === " ") this.fire();
      else if (e.key.toLowerCase() === "n") {
        this.map = generate(this.rng.randInt(1, 8), this.rng.randomSeed());
        this.handmapIdx = -1;
      } else if (e.key.toLowerCase() === "l") {
        this.handmapIdx = (this.handmapIdx + 1) % HANDMAPS.length;
        const src = HANDMAPS[this.handmapIdx];
        this.map = {
          ...src,
          launcher: { ...src.launcher },
          goal: { ...src.goal },
          stars: src.stars.map((s) => ({ ...s })),
        };
      } else if (e.key.toLowerCase() === "t") {
        this.previewOn = !this.previewOn;
      } else if (e.key.toLowerCase() === "g") {
        this.fieldOn = !this.fieldOn;
      }
    } else if (this.phase === Phase.IN_FLIGHT) {
      if (e.key === " " || e.key.toLowerCase() === "a") this.reset();
    }
  }

  private async toMenu(): Promise<void> {
    const { MenuScene } = await import("./menu");
    this.nextScene = new MenuScene();
  }

  private fire(): void {
    BANK.play("fire");
    this.map.launcher.angleDeg = this.aim.angleDeg;
    this.map.launcher.powerPct = this.aim.powerPct;
    this.asteroid = makeShot(this.map.launcher.x, this.map.launcher.y, this.aim.angleDeg, this.aim.powerPct);
    this.trail.clear();
    this.phase = Phase.IN_FLIGHT;
    this.lingerTimer = 0;
    this.lastResult = null;
    this.bounceCooldown = 0;
  }

  private reset(): void {
    this.asteroid = null;
    this.trail.clear();
    this.phase = Phase.AIM;
    this.lingerTimer = 0;
    this.lastResult = null;
  }

  override update(dt: number): void {
    this.pulsePhase = (this.pulsePhase + dt * 0.8) % 1;
    if (this.phase === Phase.IN_FLIGHT && this.asteroid) {
      this.tickFlight();
      if (!this.asteroid.alive) {
        this.lingerTimer += dt;
        if (this.lingerTimer >= LINGER_S) this.reset();
      }
    }
  }

  private tickFlight(): void {
    const a = this.asteroid!;
    if (!a.alive) return;
    const nSub = substepsForFrame(a, this.map.stars);
    const dtSub = 1 / config.TARGET_FPS / nSub;
    this.bounceCooldown = Math.max(0, this.bounceCooldown - 1 / config.TARGET_FPS);
    for (let i = 0; i < nSub; i++) {
      if (!a.alive) break;
      const r = step(a, this.map.stars, this.map.goal, dtSub);
      this.trail.push(a.x, a.y);
      if (r.bounced && this.bounceCooldown <= 0) {
        BANK.play("bounce");
        this.bounceCooldown = 0.08;
      }
      if (r.end === RoundEnd.SCORED) {
        BANK.play("score");
        a.alive = false;
        this.lastResult = RoundEnd.SCORED;
        break;
      }
      if (r.end === RoundEnd.CRASHED) {
        BANK.play("crash");
        a.alive = false;
        this.lastResult = RoundEnd.CRASHED;
        break;
      }
    }
    if (a.alive && a.flightTime >= config.HARD_TIMEOUT_S) {
      a.alive = false;
      this.lastResult = RoundEnd.HARD_TIMEOUT;
    }
  }

  override render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = `rgb(${config.BG_COLOR[0]}, ${config.BG_COLOR[1]}, ${config.BG_COLOR[2]})`;
    ctx.fillRect(0, 0, config.LOGICAL_W, config.LOGICAL_H);

    if (this.phase === Phase.AIM) {
      this.map.launcher.angleDeg = this.aim.angleDeg;
      this.map.launcher.powerPct = this.aim.powerPct;
    }

    drawHUD(ctx, {
      title: `TRAINING  L${this.map.level}`,
      angleDeg: this.aim.angleDeg,
      powerPct: this.aim.powerPct,
      score: 0,
      lives: null,
      level: null,
      extra: this.previewOn ? "preview ON" : "preview OFF",
    });

    if (this.fieldOn) {
      drawGravityField(ctx, this.map.stars);
    }

    if (this.previewOn && this.phase === Phase.AIM) {
      const pts = previewTrajectory(this.map, this.aim.angleDeg, this.aim.powerPct, 2.0, 80);
      ctx.fillStyle = `rgb(${config.SILVER[0]}, ${config.SILVER[1]}, ${config.SILVER[2]})`;
      for (const p of pts) {
        const ix = Math.floor(p.x);
        const iy = Math.floor(p.y);
        if (ix >= 0 && ix < config.LOGICAL_W && iy >= 0 && iy < config.LOGICAL_H) {
          ctx.fillRect(ix, iy, 1, 1);
        }
      }
    }

    drawMap(ctx, this.map, {
      asteroid: this.asteroid,
      trail: this.trail,
      pulsePhase: this.pulsePhase,
    });

    // Linger banner
    if (this.phase === Phase.IN_FLIGHT && this.asteroid && !this.asteroid.alive && this.lastResult !== null) {
      const map: Partial<Record<RoundEnd, [string, config.Color]>> = {
        [RoundEnd.SCORED]: ["GOAL!", config.YELLOW],
        [RoundEnd.CRASHED]: ["CRASHED", config.RED],
        [RoundEnd.HARD_TIMEOUT]: ["TIMEOUT", config.SILVER],
      };
      const entry = map[this.lastResult] ?? ["END", config.SILVER as config.Color];
      const [text, color] = entry;
      drawText(ctx, text, config.LOGICAL_W / 2, config.HUD_H + 60, {
        size: 28, bold: true, color, align: "center", shadow: true,
      });
    }

    const hint = this.phase === Phase.IN_FLIGHT
      ? "SPACE/A reset   ESC menu"
      : "SPACE fire   N new   L handmap   T preview   G field   ESC menu";
    drawText(ctx, hint, 4, config.LOGICAL_H - 14, { size: 11, color: config.SILVER });
  }
}
