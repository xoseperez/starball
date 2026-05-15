import { fetchRemoteScores } from "../api";
import * as config from "../config";
import type { DifficultyCurve } from "../config";
import {
  loadHighscores,
  topEntries,
  type HighscoreEntry,
  type HighscoreMode,
} from "../persistence";
import { SETTINGS } from "../settings_store";
import { drawText } from "../render";
import { Scene, type InputEvent } from "./base";

const DIFFICULTIES: readonly DifficultyCurve[] = ["gentle", "normal", "hard"];

export class HighscoresScene extends Scene {
  private mode: HighscoreMode;
  private difficulty: DifficultyCurve;
  private scores: HighscoreEntry[];
  private source: "local" | "remote" | "loading" = "loading";

  constructor(mode: HighscoreMode = "endless", difficulty?: DifficultyCurve) {
    super();
    this.mode = mode;
    // For endless, default to the player's current difficulty so the table
    // they land on is the one they were just playing in. Battle ignores it.
    this.difficulty = difficulty ?? (SETTINGS.get("difficulty") as DifficultyCurve);
    this.scores = topEntries(loadHighscores(), mode, this.difficulty);
    void this.refreshRemote();
  }

  private async refreshRemote(): Promise<void> {
    this.source = "loading";
    const remote = await fetchRemoteScores(this.mode, this.difficulty);
    if (remote !== null) {
      this.scores = remote;
      this.source = "remote";
    } else {
      this.source = "local";
    }
  }

  override handleEvent(e: InputEvent): void {
    if (e.key === "Enter" || e.key === "Backspace" || e.key === "Escape") {
      void this.toMenu();
      return;
    }
    if (this.mode === "endless" && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      const idx = DIFFICULTIES.indexOf(this.difficulty);
      const dir = e.key === "ArrowLeft" ? -1 : +1;
      const next = (idx + dir + DIFFICULTIES.length) % DIFFICULTIES.length;
      this.difficulty = DIFFICULTIES[next];
      this.scores = topEntries(loadHighscores(), this.mode, this.difficulty);
      void this.refreshRemote();
    }
  }

  private async toMenu(): Promise<void> {
    const { MenuScene } = await import("./menu");
    this.nextScene = new MenuScene();
  }

  override render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = `rgb(${config.BG_COLOR[0]}, ${config.BG_COLOR[1]}, ${config.BG_COLOR[2]})`;
    ctx.fillRect(0, 0, config.LOGICAL_W, config.LOGICAL_H);

    const modeLabel = this.mode === "endless" ? "PLAY" : "BATTLE";
    drawText(ctx, `HIGH SCORES — ${modeLabel}`, config.LOGICAL_W / 2, 30, {
      size: 28, bold: true, color: config.YELLOW, align: "center",
    });

    if (this.mode === "endless") {
      drawText(
        ctx,
        `< ${this.difficulty.toUpperCase()} >`,
        config.LOGICAL_W / 2,
        62,
        { size: 16, bold: true, color: config.PALE_CYAN, align: "center" },
      );
    }

    const tableY = this.mode === "endless" ? 96 : 110;
    if (this.scores.length === 0) {
      drawText(ctx, "no scores yet", config.LOGICAL_W / 2, tableY + 24, {
        size: 16, color: config.PALE_CYAN, align: "center",
      });
    } else {
      for (let i = 0; i < Math.min(10, this.scores.length); i++) {
        const s = this.scores[i];
        const line = `${(i + 1).toString().padStart(2)}. ${s.name.padEnd(3)}  ${s.score.toString().padStart(7)}`;
        drawText(ctx, line, config.LOGICAL_W / 2, tableY + i * 20, {
          size: 16, color: config.PALE_CYAN, align: "center",
        });
      }
    }

    const sourceLabel =
      this.source === "remote" ? "online" : this.source === "local" ? "offline (local cache)" : "loading…";
    drawText(ctx, sourceLabel, config.LOGICAL_W / 2, config.LOGICAL_H - 42, {
      size: 11, color: config.SILVER, align: "center",
    });
    const hint = this.mode === "endless"
      ? "[←→] difficulty   [ENTER/ESC] back"
      : "[ENTER/ESC] back";
    drawText(ctx, hint, config.LOGICAL_W / 2, config.LOGICAL_H - 24, {
      size: 11, color: config.SILVER, align: "center",
    });
  }
}
