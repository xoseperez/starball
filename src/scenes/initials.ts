import { submitRemoteScore } from "../api";
import * as config from "../config";
import type { DifficultyCurve } from "../config";
import { addHighscore, type HighscoreMode, type ShotTranscript } from "../persistence";
import { drawText } from "../render";
import { Scene, type InputEvent } from "./base";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-";

export interface InitialsOpts {
  mode: HighscoreMode;
  score: number;
  seed?: number;
  shots?: ShotTranscript[];
  startingLives?: number;
  difficulty?: DifficultyCurve;
}

export class InitialsScene extends Scene {
  private mode: HighscoreMode;
  private score: number;
  private seed: number | undefined;
  private shots: ShotTranscript[] | undefined;
  private startingLives: number | undefined;
  private difficulty: DifficultyCurve | undefined;
  private letters: [number, number, number] = [0, 0, 0];
  private cursor = 0;
  // Two-step submit: after entering the third letter, ENTER moves into a
  // "confirm" state. A second ENTER commits; BACKSPACE returns to editing.
  // Prevents accidental submits when the player presses ENTER thinking it
  // advances the cursor.
  private awaitingConfirm = false;
  private doneEntry = false;
  private rank = 0;
  private remoteAttempted = false;
  private remoteOk = false;
  private postEntryTimer = 0;

  constructor(opts: InitialsOpts) {
    super();
    this.mode = opts.mode;
    this.score = opts.score;
    this.seed = opts.seed;
    this.shots = opts.shots;
    this.startingLives = opts.startingLives;
    this.difficulty = opts.difficulty;
  }

  override handleEvent(e: InputEvent): void {
    if (this.doneEntry) return;
    if (e.key === "Escape") {
      void this.toMenu();
      return;
    }
    if (this.awaitingConfirm) {
      if (e.key === "Enter") {
        this.commit();
      } else if (e.key === "Backspace" || e.key === "ArrowLeft") {
        this.awaitingConfirm = false;
      }
      return;
    }
    if (e.key === "ArrowUp") {
      this.letters[this.cursor] = (this.letters[this.cursor] - 1 + CHARS.length) % CHARS.length;
    } else if (e.key === "ArrowDown") {
      this.letters[this.cursor] = (this.letters[this.cursor] + 1) % CHARS.length;
    } else if (e.key === "ArrowLeft") {
      this.cursor = Math.max(0, this.cursor - 1);
    } else if (e.key === "ArrowRight") {
      this.cursor = Math.min(2, this.cursor + 1);
    } else if (e.key === "Enter") {
      if (this.cursor < 2) {
        this.cursor += 1;
      } else {
        this.awaitingConfirm = true;
      }
    }
  }

  private commit(): void {
    const name = this.letters.map((i) => CHARS[i]).join("");
    // Always update the local cache so the table works offline.
    this.rank = addHighscore({
      mode: this.mode,
      name,
      score: this.score,
      seed: this.seed ?? null,
      difficulty: this.difficulty,
    });
    this.doneEntry = true;
    // Fire-and-forget remote submission. If it succeeds, prefer its rank (the
    // server's table is the authoritative one).
    void this.submitRemote(name);
  }

  private async submitRemote(name: string): Promise<void> {
    const res = await submitRemoteScore({
      mode: this.mode,
      name,
      score: this.score,
      seed: this.seed ?? null,
      startingLives: this.startingLives,
      shots: this.shots,
      difficulty: this.difficulty,
    });
    this.remoteAttempted = true;
    if (res !== null) {
      this.remoteOk = true;
      this.rank = res.rank;
    }
  }

  private async toMenu(): Promise<void> {
    const { MenuScene } = await import("./menu");
    this.nextScene = new MenuScene();
  }

  override update(dt: number): void {
    if (this.doneEntry) {
      this.postEntryTimer += dt;
      // Hold on the entry screen briefly so the player can see their rank.
      // Wait a little longer if the remote round-trip hasn't settled.
      const minHold = this.remoteAttempted ? 1.5 : 0.6;
      const maxHold = 3.0;
      if (this.postEntryTimer > maxHold || (this.postEntryTimer > minHold && this.remoteAttempted)) {
        void this.toHighscores();
      }
    }
  }

  private async toHighscores(): Promise<void> {
    const { HighscoresScene } = await import("./highscores");
    this.nextScene = new HighscoresScene(this.mode, this.difficulty);
  }

  override render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = `rgb(${config.BG_COLOR[0]}, ${config.BG_COLOR[1]}, ${config.BG_COLOR[2]})`;
    ctx.fillRect(0, 0, config.LOGICAL_W, config.LOGICAL_H);

    drawText(ctx, "NEW HIGH SCORE!", config.LOGICAL_W / 2, 30, {
      size: 28, bold: true, color: config.YELLOW, align: "center",
    });
    drawText(ctx, `SCORE  ${this.score}`, config.LOGICAL_W / 2, 70, {
      size: 16, color: config.PALE_CYAN, align: "center",
    });

    // Initials, each ~64-pt
    const glyphSize = 64;
    const gap = 20;
    ctx.font = `bold ${glyphSize}px ui-monospace, monospace`;
    const widths = this.letters.map((i) => ctx.measureText(CHARS[i]).width);
    const totalW = widths.reduce((s, w) => s + w, 0) + gap * 2;
    let x = (config.LOGICAL_W - totalW) / 2;
    const y = 130;
    const editing = !this.doneEntry && !this.awaitingConfirm;
    for (let i = 0; i < 3; i++) {
      const ch = CHARS[this.letters[i]];
      // Editing: cursor letter yellow, others white.
      // Awaiting confirm: all letters yellow (the whole name is the focus now).
      // Done: all letters white.
      let color: config.Color = config.WHITE;
      if (editing && i === this.cursor) color = config.YELLOW;
      else if (this.awaitingConfirm) color = config.YELLOW;
      drawText(ctx, ch, x, y, { size: glyphSize, bold: true, color });
      if (editing && i === this.cursor) {
        ctx.strokeStyle = `rgb(${config.YELLOW[0]}, ${config.YELLOW[1]}, ${config.YELLOW[2]})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y + glyphSize + 2);
        ctx.lineTo(x + widths[i], y + glyphSize + 2);
        ctx.stroke();
      }
      x += widths[i] + gap;
    }

    if (editing) {
      drawText(
        ctx,
        "[↑↓] letter   [←→] position   [ENTER] next",
        config.LOGICAL_W / 2,
        config.LOGICAL_H - 30,
        { size: 16, color: config.SILVER, align: "center" },
      );
    } else if (this.awaitingConfirm) {
      drawText(ctx, "submit this name?", config.LOGICAL_W / 2, config.LOGICAL_H - 56, {
        size: 14, color: config.PALE_CYAN, align: "center",
      });
      drawText(
        ctx,
        "[ENTER] confirm   [BACKSPACE] edit",
        config.LOGICAL_W / 2,
        config.LOGICAL_H - 30,
        { size: 16, color: config.SILVER, align: "center" },
      );
    } else {
      const name = this.letters.map((i) => CHARS[i]).join("");
      const rankText = this.rank > 0 ? `${name}  ranked #${this.rank}` : `${name}  (no rank)`;
      drawText(ctx, rankText, config.LOGICAL_W / 2, config.LOGICAL_H - 60, {
        size: 16, color: config.YELLOW, align: "center",
      });
      const status = !this.remoteAttempted
        ? "submitting…"
        : this.remoteOk
          ? "shared online"
          : "local only";
      const statusColor = !this.remoteAttempted
        ? config.SILVER
        : this.remoteOk
          ? config.PALE_CYAN
          : config.SILVER;
      drawText(ctx, status, config.LOGICAL_W / 2, config.LOGICAL_H - 36, {
        size: 11, color: statusColor, align: "center",
      });
    }
  }
}
