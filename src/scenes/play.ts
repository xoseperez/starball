// Play (single-player, procedurally generated maps).

import { BANK } from "../audio";
import * as config from "../config";
import { type Asteroid, type GameMap } from "../entities";
import { AimState } from "../input";
import { generate } from "../mapgen";
import { RoundEnd, makeShot, step, substepsForFrame } from "../physics";
import { Random } from "../random";
import { qualifiesForHighscore, type ShotTranscript } from "../persistence";
import { drawHUD, drawMap, drawText, Trail } from "../render";
import { ScoreAccumulator, type ScoreBreakdown } from "../scoring";
import { SETTINGS } from "../settings_store";
import { previewTrajectory } from "../trajectory";
import { Scene, type InputEvent } from "./base";

enum Phase {
  AIM = "aim",
  IN_FLIGHT = "in_flight",
  POST_SHOT = "post_shot",
  GAME_OVER = "game_over",
}

const POST_SHOT_S = 1.5;

export class PlayScene extends Scene {
  private rng: Random;
  private seedForRun: number;
  private level = 1;
  private map: GameMap;
  private currentMapSeed: number;
  private transcript: ShotTranscript[] = [];
  private aim: AimState;
  private phase = Phase.AIM;
  private asteroid: Asteroid | null = null;
  private trail = new Trail(64);
  private score = 0;
  private lives: number;
  private startingLives: number;
  private lastResult: RoundEnd | null = null;
  private lastBreakdown: ScoreBreakdown | null = null;
  private postShotTimer = 0;
  private pulsePhase = 0;
  private scoreAcc: ScoreAccumulator | null = null;
  private stopTimer = 0;
  private minDistGoal = Infinity;
  private lastProgressT = 0;
  private posHistory: Array<[number, number, number]> = []; // (t, x, y)
  private popups: Array<{ text: string; x: number; y: number; life: number }> = [];
  private bounceCooldown = 0;

  constructor(seed?: number) {
    super();
    this.rng = new Random(seed);
    this.seedForRun = seed ?? this.rng.randomSeed();
    const livesCfg = SETTINGS.get("lives");
    this.startingLives = livesCfg;
    this.lives = livesCfg > 0 ? livesCfg : -1; // -1 = unlimited
    this.currentMapSeed = this.rng.randomSeed();
    this.map = generate(this.level, this.currentMapSeed);
    this.aim = new AimState(30, 55);
  }

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------

  override handleEvent(e: InputEvent): void {
    if (e.key === "Escape" || e.key === "Backspace") {
      void this.toMenu();
      return;
    }

    const mult = e.shift ? SETTINGS.get("shift_multiplier") : 1;
    const angStep = SETTINGS.get("angle_step_deg") * mult;
    const pwrStep = SETTINGS.get("power_step_pct") * mult;

    if (this.phase === Phase.AIM) {
      if (e.key === "ArrowLeft") this.aim.adjustAngle(+angStep);
      else if (e.key === "ArrowRight") this.aim.adjustAngle(-angStep);
      else if (e.key === "ArrowUp" || e.key === "+" || e.key === "=") this.aim.adjustPower(+pwrStep);
      else if (e.key === "ArrowDown" || e.key === "-") this.aim.adjustPower(-pwrStep);
      else if (e.key === " ") this.fire();
      else if (e.key.toLowerCase() === "r") this.aim.reset();
    } else if (this.phase === Phase.IN_FLIGHT) {
      if (e.key.toLowerCase() === "a") this.endShot(RoundEnd.ABORTED, false);
    } else if (this.phase === Phase.POST_SHOT) {
      // Scored overlay holds until acknowledged; non-scored ends auto-advance.
      if (this.lastResult === RoundEnd.SCORED && (e.key === "Enter" || e.key === " ")) {
        void this.advanceOrGameOver();
      }
    } else if (this.phase === Phase.GAME_OVER) {
      if (e.key === "Enter" || e.key === " ") void this.toMenu();
    }
  }

  private async toMenu(): Promise<void> {
    const { MenuScene } = await import("./menu");
    this.nextScene = new MenuScene();
  }

  // -------------------------------------------------------------------------
  // State transitions
  // -------------------------------------------------------------------------

  private fire(): void {
    BANK.play("fire");
    this.map.launcher.angleDeg = this.aim.angleDeg;
    this.map.launcher.powerPct = this.aim.powerPct;
    this.transcript.push({
      level: this.level,
      mapSeed: this.currentMapSeed,
      angleDeg: this.aim.angleDeg,
      powerPct: this.aim.powerPct,
    });
    this.asteroid = makeShot(
      this.map.launcher.x,
      this.map.launcher.y,
      this.aim.angleDeg,
      this.aim.powerPct,
    );
    this.trail.clear();
    this.scoreAcc = new ScoreAccumulator();
    this.phase = Phase.IN_FLIGHT;
    this.lastResult = null;
    this.lastBreakdown = null;
    this.stopTimer = 0;
    this.minDistGoal = Math.hypot(this.map.goal.x - this.asteroid.x, this.map.goal.y - this.asteroid.y);
    this.lastProgressT = 0;
    this.posHistory.length = 0;
    this.popups.length = 0;
    this.bounceCooldown = 0;
  }

  private endShot(result: RoundEnd, lifeLoss: boolean): void {
    this.lastResult = result;
    if (result === RoundEnd.SCORED && this.scoreAcc !== null) {
      BANK.play("score");
      const ft = this.asteroid?.flightTime ?? 0;
      this.lastBreakdown = this.scoreAcc.finalScore(this.map.stars, ft);
      this.score += this.lastBreakdown.total;
      // Reward a successful goal with +1 life, capped at LIVES_CAP. -1 = unlimited.
      if (this.lives > 0 && this.lives < config.LIVES_CAP) this.lives += 1;
    } else {
      if (result === RoundEnd.CRASHED) {
        // Cut any trailing bonus chirp so the crash isn't masked.
        BANK.stop("assist");
        BANK.play("crash");
      }
      if (lifeLoss && this.lives > 0) this.lives -= 1;
    }
    this.phase = Phase.POST_SHOT;
    this.postShotTimer = POST_SHOT_S;
  }

  private async advanceOrGameOver(): Promise<void> {
    if (this.lives === 0) {
      const difficulty = SETTINGS.get("difficulty");
      if (qualifiesForHighscore("endless", this.score, difficulty)) {
        const { InitialsScene } = await import("./initials");
        this.nextScene = new InitialsScene({
          mode: "endless",
          score: this.score,
          seed: this.seedForRun,
          shots: this.transcript,
          startingLives: this.startingLives,
          difficulty,
        });
      } else {
        this.phase = Phase.GAME_OVER;
      }
      return;
    }
    if (this.lastResult === RoundEnd.SCORED) {
      this.level += 1;
      this.currentMapSeed = this.rng.randomSeed();
      this.map = generate(this.level, this.currentMapSeed);
    }
    this.asteroid = null;
    this.trail.clear();
    this.scoreAcc = null;
    this.phase = Phase.AIM;
  }

  // -------------------------------------------------------------------------
  // Update
  // -------------------------------------------------------------------------

  override update(dt: number): void {
    this.pulsePhase = (this.pulsePhase + dt * 0.8) % 1;
    for (const p of this.popups) p.life -= dt;
    this.popups = this.popups.filter((p) => p.life > 0);

    if (this.phase === Phase.IN_FLIGHT && this.asteroid !== null) {
      this.tickFlight(dt);
    } else if (this.phase === Phase.POST_SHOT) {
      // SCORED waits for the player to press Space/Enter (handled in handleEvent).
      if (this.lastResult !== RoundEnd.SCORED) {
        this.postShotTimer -= dt;
        if (this.postShotTimer <= 0) {
          void this.advanceOrGameOver();
        }
      }
    }
  }

  private tickFlight(_dt: number): void {
    const a = this.asteroid!;
    const nSub = substepsForFrame(a, this.map.stars);
    const dtSub = 1 / config.TARGET_FPS / nSub;
    this.bounceCooldown = Math.max(0, this.bounceCooldown - 1 / config.TARGET_FPS);

    for (let i = 0; i < nSub; i++) {
      if (!a.alive) break;
      const result = step(a, this.map.stars, this.map.goal, dtSub);
      this.scoreAcc!.update(a, this.map.stars, dtSub, a.bouncedThisStep);
      this.trail.push(a.x, a.y);
      if (result.bounced && this.bounceCooldown <= 0) {
        BANK.play("bounce");
        this.bounceCooldown = 0.08;
      }
      // Drain assist events into popups — unless this substep also ended in
      // a crash. The graze-then-crash case shouldn't reward (or even sound)
      // like a bonus; the crash sound conveys what happened.
      if (result.end === RoundEnd.CRASHED) {
        this.scoreAcc!.assistEvents.length = 0;
      } else {
        while (this.scoreAcc!.assistEvents.length > 0) {
          const ev = this.scoreAcc!.assistEvents.shift()!;
          const s = this.map.stars[ev.starIndex];
          this.popups.push({ text: "+bonus", x: s.x, y: s.y - 14, life: 1.2 });
          BANK.play("assist");
        }
      }
      if (result.end === RoundEnd.SCORED) return this.endShot(RoundEnd.SCORED, false);
      if (result.end === RoundEnd.CRASHED) return this.endShot(RoundEnd.CRASHED, true);
    }
    if (!a.alive) return;

    const speed = Math.hypot(a.vx, a.vy);
    const accel = Math.hypot(a.ax, a.ay);
    if (speed < config.STOP_VEL && accel < config.STOP_ACC) {
      this.stopTimer += 1 / config.TARGET_FPS;
      if (this.stopTimer >= config.STOP_DURATION_S) return this.endShot(RoundEnd.STOPPED, true);
    } else {
      this.stopTimer = 0;
    }

    this.posHistory.push([a.flightTime, a.x, a.y]);
    const cutoff = a.flightTime - config.STUCK_WINDOW_S;
    while (this.posHistory.length > 0 && this.posHistory[0][0] < cutoff) this.posHistory.shift();
    if (a.flightTime > config.STUCK_WINDOW_S && this.posHistory.length >= 30) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const [, x, y] of this.posHistory) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
      const bbox = (maxX - minX) + (maxY - minY);
      if (bbox < config.STUCK_BBOX_THRESHOLD) return this.endShot(RoundEnd.NO_PROGRESS, true);
    }

    const dGoal = Math.hypot(this.map.goal.x - a.x, this.map.goal.y - a.y);
    if (dGoal < this.minDistGoal - 4) {
      this.minDistGoal = dGoal;
      this.lastProgressT = a.flightTime;
    } else if (a.flightTime - this.lastProgressT > config.NO_PROGRESS_TIMEOUT_S) {
      return this.endShot(RoundEnd.NO_PROGRESS, true);
    }
    if (a.flightTime >= config.HARD_TIMEOUT_S) return this.endShot(RoundEnd.HARD_TIMEOUT, true);
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  override render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = `rgb(${config.BG_COLOR[0]}, ${config.BG_COLOR[1]}, ${config.BG_COLOR[2]})`;
    ctx.fillRect(0, 0, config.LOGICAL_W, config.LOGICAL_H);

    if (this.phase === Phase.AIM) {
      this.map.launcher.angleDeg = this.aim.angleDeg;
      this.map.launcher.powerPct = this.aim.powerPct;
    }

    let extra = "";
    if (this.phase === Phase.IN_FLIGHT && this.scoreAcc && this.scoreAcc.runningCurvatureScore() > 1) {
      extra = `+${Math.floor(this.scoreAcc.runningCurvatureScore())}`;
    }
    drawHUD(ctx, {
      title: "PLAY",
      angleDeg: this.aim.angleDeg,
      powerPct: this.aim.powerPct,
      score: this.score,
      lives: this.lives,
      level: this.level,
      extra,
    });

    // Trajectory preview
    if (this.phase === Phase.AIM) {
      const mode = SETTINGS.get("trajectory_preview");
      if (mode !== "off") {
        const seconds = mode === "full" ? 2.0 : 1.0;
        const pts = previewTrajectory(this.map, this.aim.angleDeg, this.aim.powerPct, seconds, Math.floor(60 * seconds));
        ctx.fillStyle = `rgb(${config.SILVER[0]}, ${config.SILVER[1]}, ${config.SILVER[2]})`;
        for (const p of pts) {
          const ix = Math.floor(p.x);
          const iy = Math.floor(p.y);
          if (ix >= 0 && ix < config.LOGICAL_W && iy >= 0 && iy < config.LOGICAL_H) {
            ctx.fillRect(ix, iy, 1, 1);
          }
        }
      }
    }

    drawMap(ctx, this.map, {
      asteroid: this.asteroid,
      trail: this.trail,
      pulsePhase: this.pulsePhase,
    });

    // Floating assist popups
    for (const p of this.popups) {
      const offset = Math.floor((1.2 - p.life) * 8);
      drawText(ctx, p.text, Math.floor(p.x), Math.floor(p.y) - offset, {
        size: 10,
        color: config.YELLOW,
        align: "center",
      });
    }

    if (this.phase === Phase.POST_SHOT && this.lastResult !== null) this.drawResultOverlay(ctx);
    else if (this.phase === Phase.GAME_OVER) this.drawGameOver(ctx);
  }

  private drawResultOverlay(ctx: CanvasRenderingContext2D): void {
    const map: Partial<Record<RoundEnd, [string, config.Color]>> = {
      [RoundEnd.SCORED]: ["GOAL!", config.YELLOW],
      [RoundEnd.CRASHED]: ["CRASHED", config.RED],
      [RoundEnd.STOPPED]: ["STOPPED", config.SILVER],
      [RoundEnd.HARD_TIMEOUT]: ["TIMEOUT", config.SILVER],
      [RoundEnd.NO_PROGRESS]: ["NO PROGRESS", config.SILVER],
      [RoundEnd.ABORTED]: ["ABORT", config.SILVER],
      [RoundEnd.EXITED]: ["LOST", config.SILVER],
    };
    const entry = map[this.lastResult!] ?? ["?", config.SILVER as config.Color];
    const [text, color] = entry;
    drawText(ctx, text, config.LOGICAL_W / 2, config.HUD_H + 60, {
      size: 28, bold: true, color, align: "center", shadow: true,
    });
    if (this.lastResult === RoundEnd.SCORED && this.lastBreakdown) {
      const lines = [
        `BASE       ${this.lastBreakdown.base.toString().padStart(5)}`,
        `CURVATURE  ${this.lastBreakdown.curvature.toString().padStart(5)}`,
        `GRAZING    ${this.lastBreakdown.grazing.toString().padStart(5)}`,
      ];
      if (this.lastBreakdown.timeMultiplier < 1.0) {
        lines.push(
          `TIME       ×${this.lastBreakdown.timeMultiplier.toFixed(2)}`,
        );
      }
      lines.push(`TOTAL      ${this.lastBreakdown.total.toString().padStart(5)}`);
      for (let i = 0; i < lines.length; i++) {
        drawText(ctx, lines[i], config.LOGICAL_W / 2, config.HUD_H + 100 + i * 16, {
          size: 14, color: config.PALE_CYAN, align: "center", shadow: true,
        });
      }
      drawText(ctx, "[SPACE] continue", config.LOGICAL_W / 2, config.HUD_H + 100 + lines.length * 16 + 14, {
        size: 12, color: config.SILVER, align: "center",
      });
    }
  }

  private drawGameOver(ctx: CanvasRenderingContext2D): void {
    drawText(ctx, "GAME OVER", config.LOGICAL_W / 2, config.HUD_H + 70, {
      size: 32, bold: true, color: config.RED, align: "center", shadow: true,
    });
    drawText(ctx, `FINAL SCORE  ${this.score}`, config.LOGICAL_W / 2, config.HUD_H + 122, {
      size: 16, bold: true, color: config.YELLOW, align: "center",
    });
    drawText(ctx, `REACHED LEVEL  ${this.level}`, config.LOGICAL_W / 2, config.HUD_H + 144, {
      size: 16, color: config.PALE_CYAN, align: "center",
    });
    drawText(ctx, "[SPACE] back to menu    [ESC] quit", config.LOGICAL_W / 2, config.HUD_H + 200, {
      size: 14, color: config.SILVER, align: "center",
    });
  }
}
