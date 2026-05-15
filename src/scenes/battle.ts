// Battle — two-player hot-seat. Alternating shots; starting player flips
// each round so both players start exactly total_rounds/2 times.

import { BANK } from "../audio";
import * as config from "../config";
import type { Color } from "../config";
import { type Asteroid, type GameMap } from "../entities";
import { AimState } from "../input";
import { generate } from "../mapgen";
import { RoundEnd, makeShot, step, substepsForFrame } from "../physics";
import { Random } from "../random";
import { drawMap, drawText, Trail } from "../render";
import { ScoreAccumulator } from "../scoring";
import { SETTINGS } from "../settings_store";
import { Scene, type InputEvent } from "./base";

enum Phase {
  AIM = "aim",
  IN_FLIGHT = "in_flight",
  POST_SHOT = "post_shot",
  ROUND_END = "round_end",
  MATCH_END = "match_end",
}

const POST_SHOT_S = 1.5;
const ROUND_END_S = 2.0;
const SHOTS_PER_PLAYER_PER_ROUND = 3;

function playerColor(p: number): Color {
  return p === 1 ? config.P1_COLOR : config.P2_COLOR;
}

function playerName(p: number): string {
  return p === 1 ? SETTINGS.get("player1_name") : SETTINGS.get("player2_name");
}

export class BattleScene extends Scene {
  private rng: Random;
  private totalRounds: number;
  private round = 1;
  private firstPlayerThisRound = 1;
  private currentPlayer = 1;
  private scores: [number, number] = [0, 0];
  private map: GameMap;
  private aim: AimState;
  private phase = Phase.AIM;
  private asteroid: Asteroid | null = null;
  private trail = new Trail(64);
  private scoreAcc: ScoreAccumulator | null = null;
  private lastResult: RoundEnd | null = null;
  private lastBreakdown: { total: number } | null = null;
  private timer = 0;
  private pulsePhase = 0;
  // Count of shots each player has fired in the current round.
  private shotsThisRound: Record<number, number> = { 1: 0, 2: 0 };
  private bounceCooldown = 0;

  constructor(seed?: number) {
    super();
    this.rng = new Random(seed);
    const rounds = SETTINGS.get("hotseat_rounds");
    // Force even count so both players start the same number of rounds.
    this.totalRounds = rounds % 2 === 0 ? rounds : rounds + 1;
    this.map = generate(3, this.rng.randomSeed());
    this.aim = new AimState(30, 55);
  }

  private get currentColor(): Color {
    return playerColor(this.currentPlayer);
  }

  private get currentName(): string {
    return playerName(this.currentPlayer);
  }

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
    } else if (this.phase === Phase.IN_FLIGHT && e.key.toLowerCase() === "a") {
      this.endShot(RoundEnd.ABORTED);
    } else if (this.phase === Phase.MATCH_END && (e.key === "Enter" || e.key === " ")) {
      void this.toMenu();
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
    this.scoreAcc = new ScoreAccumulator();
    this.phase = Phase.IN_FLIGHT;
    this.bounceCooldown = 0;
  }

  private endShot(result: RoundEnd): void {
    this.lastResult = result;
    if (result === RoundEnd.SCORED && this.scoreAcc) {
      BANK.play("score");
      const ft = this.asteroid?.flightTime ?? 0;
      const br = this.scoreAcc.finalScore(this.map.stars, ft);
      this.lastBreakdown = br;
      this.scores[this.currentPlayer - 1] += br.total;
      // Scoring consumes all of this player's remaining shots for the round.
      // _advance() will then keep the turn with the opponent until they
      // finish (by scoring or running out of shots themselves).
      this.shotsThisRound[this.currentPlayer] = SHOTS_PER_PLAYER_PER_ROUND;
    } else {
      if (result === RoundEnd.CRASHED) {
        BANK.stop("assist");
        BANK.play("crash");
      }
      this.lastBreakdown = null;
      this.shotsThisRound[this.currentPlayer] += 1;
    }
    this.phase = Phase.POST_SHOT;
    this.timer = POST_SHOT_S;
  }

  private advance(): void {
    // Round ends when both players have used all their shots on this map.
    if (
      this.shotsThisRound[1] >= SHOTS_PER_PLAYER_PER_ROUND &&
      this.shotsThisRound[2] >= SHOTS_PER_PLAYER_PER_ROUND
    ) {
      this.phase = Phase.ROUND_END;
      this.timer = ROUND_END_S;
      return;
    }
    // Hand the turn to the other player — if they still have shots left.
    // Otherwise the current player keeps going (only happens at the very end
    // of a round if shot counts somehow desynced; under normal play both
    // players have the same number of remaining shots at this point).
    const other = this.currentPlayer === 1 ? 2 : 1;
    if (this.shotsThisRound[other] < SHOTS_PER_PLAYER_PER_ROUND) {
      this.currentPlayer = other;
    }
    this.aim.reset();
    this.asteroid = null;
    this.trail.clear();
    this.scoreAcc = null;
    this.phase = Phase.AIM;
  }

  private nextRound(): void {
    if (this.round >= this.totalRounds) {
      this.phase = Phase.MATCH_END;
      return;
    }
    this.round += 1;
    this.shotsThisRound = { 1: 0, 2: 0 };
    this.firstPlayerThisRound = this.firstPlayerThisRound === 1 ? 2 : 1;
    this.currentPlayer = this.firstPlayerThisRound;
    this.map = generate(3 + this.round, this.rng.randomSeed());
    this.aim.reset();
    this.asteroid = null;
    this.trail.clear();
    this.scoreAcc = null;
    this.phase = Phase.AIM;
  }

  override update(dt: number): void {
    this.pulsePhase = (this.pulsePhase + dt * 0.8) % 1;
    if (this.phase === Phase.IN_FLIGHT && this.asteroid) {
      this.tickFlight();
    } else if (this.phase === Phase.POST_SHOT) {
      this.timer -= dt;
      if (this.timer <= 0) this.advance();
    } else if (this.phase === Phase.ROUND_END) {
      this.timer -= dt;
      if (this.timer <= 0) this.nextRound();
    }
  }

  private tickFlight(): void {
    const a = this.asteroid!;
    const nSub = substepsForFrame(a, this.map.stars);
    const dtSub = 1 / config.TARGET_FPS / nSub;
    this.bounceCooldown = Math.max(0, this.bounceCooldown - 1 / config.TARGET_FPS);
    for (let i = 0; i < nSub; i++) {
      if (!a.alive) break;
      const r = step(a, this.map.stars, this.map.goal, dtSub);
      this.scoreAcc!.update(a, this.map.stars, dtSub, a.bouncedThisStep);
      this.trail.push(a.x, a.y);
      if (r.bounced && this.bounceCooldown <= 0) {
        BANK.play("bounce");
        this.bounceCooldown = 0.08;
      }
      if (r.end === RoundEnd.SCORED) return this.endShot(RoundEnd.SCORED);
      if (r.end === RoundEnd.CRASHED) return this.endShot(RoundEnd.CRASHED);
    }
    if (a.flightTime >= config.HARD_TIMEOUT_S) this.endShot(RoundEnd.HARD_TIMEOUT);
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

    this.drawHUD(ctx);
    drawMap(ctx, this.map, {
      asteroid: this.asteroid,
      trail: this.trail,
      pulsePhase: this.pulsePhase,
      launcherColor: this.currentColor,
    });

    if (this.phase === Phase.AIM) this.drawTurnBanner(ctx);
    else if (this.phase === Phase.POST_SHOT) this.drawResult(ctx);
    else if (this.phase === Phase.ROUND_END) this.drawRoundSummary(ctx);
    else if (this.phase === Phase.MATCH_END) this.drawMatchEnd(ctx);
  }

  private drawHUD(ctx: CanvasRenderingContext2D): void {
    // Background bar
    ctx.fillStyle = `rgb(${config.HUD_BG[0]}, ${config.HUD_BG[1]}, ${config.HUD_BG[2]})`;
    ctx.fillRect(0, 0, config.LOGICAL_W, config.HUD_H);
    ctx.strokeStyle = `rgb(${config.DARK_GRAY[0]}, ${config.DARK_GRAY[1]}, ${config.DARK_GRAY[2]})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, config.HUD_H - 0.5);
    ctx.lineTo(config.LOGICAL_W, config.HUD_H - 0.5);
    ctx.stroke();

    drawText(ctx, "BATTLE", 6, 4, { size: 14, bold: true, color: config.WHITE });
    drawText(ctx, `ROUND ${this.round}/${this.totalRounds}`, 6, 22, {
      size: 12, color: config.PALE_CYAN,
    });

    // Two player boxes — name + score on top, shots-remaining dots below.
    const boxW = 130;
    const gap = 8;
    const rightEdge = config.LOGICAL_W - 6;
    let x = rightEdge - boxW * 2 - gap;
    for (const p of [1, 2]) {
      const color = p === this.currentPlayer ? playerColor(p) : config.SILVER;
      const arrow = p === this.currentPlayer ? "▶" : " ";
      const name = playerName(p).substring(0, 8);
      drawText(ctx, `${arrow} ${name}`, x, 4, { size: 14, bold: true, color });
      // Right-justified score with shots-remaining indicator on the left
      const remaining = SHOTS_PER_PLAYER_PER_ROUND - this.shotsThisRound[p];
      const dots: string[] = [];
      for (let s = 0; s < SHOTS_PER_PLAYER_PER_ROUND; s++) {
        dots.push(s < remaining ? "●" : "○");
      }
      drawText(ctx, dots.join(""), x, 22, { size: 12, color });
      drawText(ctx, `${this.scores[p - 1]}`, x + boxW - 14, 22, {
        size: 14, bold: true, color, align: "right",
      });
      x += boxW + gap;
    }

    const aim = `ANG ${Math.round(this.aim.angleDeg).toString().padStart(3)}°  PWR ${this.aim.powerPct.toString().padStart(3)}%`;
    drawText(ctx, aim, 90, 22, { size: 12, color: this.currentColor });
  }

  private drawTurnBanner(ctx: CanvasRenderingContext2D): void {
    const text = `${this.currentName.toUpperCase()}  —  YOUR TURN`;
    const size = 22;
    ctx.font = `bold ${size}px ui-monospace, "SF Mono", Menlo, monospace`;
    const w = ctx.measureText(text).width + 16;
    const h = size + 10;
    const x = (config.LOGICAL_W - w) / 2;
    const y = config.HUD_H + 4;
    const col = this.currentColor;
    ctx.fillStyle = `rgba(${col[0]}, ${col[1]}, ${col[2]}, 0.16)`;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = `rgba(${col[0]}, ${col[1]}, ${col[2]}, 0.86)`;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

    drawText(ctx, text, config.LOGICAL_W / 2, y + h / 2, {
      size, bold: true, color: this.currentColor, align: "center", baseline: "middle", shadow: true,
    });
  }

  private drawResult(ctx: CanvasRenderingContext2D): void {
    const map: Partial<Record<RoundEnd, [string, Color]>> = {
      [RoundEnd.SCORED]: ["GOAL!", config.YELLOW],
      [RoundEnd.CRASHED]: ["CRASHED", config.RED],
      [RoundEnd.HARD_TIMEOUT]: ["TIMEOUT", config.SILVER],
      [RoundEnd.ABORTED]: ["ABORT", config.SILVER],
    };
    const entry = map[this.lastResult!] ?? ["?", config.SILVER];
    const [text, color] = entry;
    drawText(ctx, text, config.LOGICAL_W / 2, config.HUD_H + 50, {
      size: 24, bold: true, color, align: "center", shadow: true,
    });
    if (this.lastBreakdown) {
      drawText(ctx, `+${this.lastBreakdown.total}  (${this.currentName})`, config.LOGICAL_W / 2, config.HUD_H + 86, {
        size: 14, color: this.currentColor, align: "center",
      });
    }
  }

  private drawRoundSummary(ctx: CanvasRenderingContext2D): void {
    drawText(ctx, `Round ${this.round} complete`, config.LOGICAL_W / 2, config.HUD_H + 60, {
      size: 20, bold: true, color: config.YELLOW, align: "center", shadow: true,
    });
    const x = config.LOGICAL_W / 2;
    const y = config.HUD_H + 100;
    drawText(ctx, `${SETTINGS.get("player1_name")} ${this.scores[0]}`, x - 60, y, {
      size: 14, color: config.P1_COLOR, align: "right",
    });
    drawText(ctx, "vs", x, y, { size: 14, color: config.SILVER, align: "center" });
    drawText(ctx, `${SETTINGS.get("player2_name")} ${this.scores[1]}`, x + 60, y, {
      size: 14, color: config.P2_COLOR, align: "left",
    });
    if (this.round < this.totalRounds) {
      const nextFirst = this.firstPlayerThisRound === 1 ? 2 : 1;
      drawText(ctx, `Next round: ${playerName(nextFirst)} shoots first`, x, y + 24, {
        size: 12, color: config.PALE_CYAN, align: "center",
      });
    }
  }

  private drawMatchEnd(ctx: CanvasRenderingContext2D): void {
    let winnerText: string;
    let color: Color;
    if (this.scores[0] > this.scores[1]) {
      winnerText = `${SETTINGS.get("player1_name")} WINS`;
      color = config.P1_COLOR;
    } else if (this.scores[1] > this.scores[0]) {
      winnerText = `${SETTINGS.get("player2_name")} WINS`;
      color = config.P2_COLOR;
    } else {
      winnerText = "DRAW";
      color = config.YELLOW;
    }
    drawText(ctx, winnerText, config.LOGICAL_W / 2, config.HUD_H + 60, {
      size: 28, bold: true, color, align: "center", shadow: true,
    });
    const x = config.LOGICAL_W / 2;
    const y = config.HUD_H + 110;
    drawText(ctx, `${SETTINGS.get("player1_name")} ${this.scores[0]}`, x - 60, y, {
      size: 16, color: config.P1_COLOR, align: "right",
    });
    drawText(ctx, "vs", x, y, { size: 16, color: config.SILVER, align: "center" });
    drawText(ctx, `${SETTINGS.get("player2_name")} ${this.scores[1]}`, x + 60, y, {
      size: 16, color: config.P2_COLOR, align: "left",
    });
    drawText(ctx, "[SPACE/ENTER] back to menu", config.LOGICAL_W / 2, config.LOGICAL_H - 24, {
      size: 12, color: config.SILVER, align: "center",
    });
  }
}
