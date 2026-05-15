// Settings — keyboard-driven, persists to localStorage on exit.

import * as config from "../config";
import { drawText } from "../render";
import { SETTINGS } from "../settings_store";
import type { Settings } from "../config";
import { Scene, type InputEvent } from "./base";

type AdjustFn = (current: unknown, direction: number) => unknown;

function cycle<T>(values: T[]): AdjustFn {
  return (current, dir) => {
    const idx = Math.max(0, values.indexOf(current as T));
    const n = values.length;
    return values[((idx + dir) % n + n) % n];
  };
}

function slider(low: number, high: number, step: number): AdjustFn {
  return (current, dir) => {
    const v = Math.max(low, Math.min(high, (current as number) + dir * step));
    return Math.round(v * 100) / 100;
  };
}

interface Item {
  label: string;
  key: keyof Settings;
  adjust: AdjustFn;
}

const ITEMS: Item[] = [
  { label: "Master volume", key: "volume_master", adjust: slider(0, 1, 0.1) },
  { label: "SFX volume", key: "volume_sfx", adjust: slider(0, 1, 0.1) },
  { label: "Music volume", key: "volume_music", adjust: slider(0, 1, 0.1) },
  { label: "Lives", key: "lives", adjust: cycle([1, 3, 5, 0]) },
  { label: "Difficulty", key: "difficulty", adjust: cycle(["gentle", "normal", "hard"]) },
  // "full" preview is a strong aid — leaderboard fairness. The setting type
  // still allows it (preserved for any user who has it stored), but it can
  // no longer be selected from this menu. Training still has its own T key.
  { label: "Trajectory preview", key: "trajectory_preview", adjust: cycle(["off", "first_second"]) },
  { label: "Battle rounds", key: "hotseat_rounds", adjust: cycle([4, 6, 8, 10, 12]) },
];

function fmt(key: keyof Settings, val: Settings[keyof Settings]): string {
  if (key === "lives") return Number(val) === 0 ? "infinite" : String(val);
  if (key === "volume_master" || key === "volume_sfx" || key === "volume_music") {
    return `${Math.round((val as number) * 100)}%`;
  }
  return String(val);
}

export class SettingsScene extends Scene {
  private cursor = 0;

  override handleEvent(e: InputEvent): void {
    if (e.key === "ArrowUp") this.cursor = (this.cursor - 1 + ITEMS.length) % ITEMS.length;
    else if (e.key === "ArrowDown") this.cursor = (this.cursor + 1) % ITEMS.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const dir = e.key === "ArrowLeft" ? -1 : +1;
      const it = ITEMS[this.cursor];
      const cur = SETTINGS.get(it.key);
      const next = it.adjust(cur, dir) as Settings[keyof Settings];
      // typed setter via runtime cast (we trust the cycle/slider returns the right type)
      SETTINGS.set(it.key, next as never);
    } else if (e.key === "Enter" || e.key === "Escape" || e.key === "Backspace") {
      SETTINGS.save();
      void this.toMenu();
    }
  }

  private async toMenu(): Promise<void> {
    const { MenuScene } = await import("./menu");
    this.nextScene = new MenuScene();
  }

  override render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = `rgb(${config.BG_COLOR[0]}, ${config.BG_COLOR[1]}, ${config.BG_COLOR[2]})`;
    ctx.fillRect(0, 0, config.LOGICAL_W, config.LOGICAL_H);

    drawText(ctx, "SETTINGS", config.LOGICAL_W / 2, 30, {
      size: 28, bold: true, color: config.YELLOW, align: "center",
    });

    const startY = 90;
    const col1X = 100;
    const col2X = 380;
    for (let i = 0; i < ITEMS.length; i++) {
      const item = ITEMS[i];
      const isCursor = i === this.cursor;
      const color = isCursor ? config.YELLOW : config.PALE_CYAN;
      const y = startY + i * 24;
      if (isCursor) {
        drawText(ctx, ">", col1X - 16, y, { size: 16, bold: true, color: config.YELLOW });
      }
      drawText(ctx, item.label, col1X, y, { size: 16, color });
      const val = SETTINGS.get(item.key);
      const valStr = fmt(item.key, val);
      if (isCursor) {
        drawText(ctx, "<", col2X - 14, y, { size: 16, bold: true, color: config.YELLOW });
      }
      drawText(ctx, valStr, col2X, y, { size: 16, color });
      if (isCursor) {
        // measure width to place the > to the right
        ctx.font = `16px ui-monospace, monospace`;
        const w = ctx.measureText(valStr).width;
        drawText(ctx, ">", col2X + w + 4, y, { size: 16, bold: true, color: config.YELLOW });
      }
    }

    drawText(
      ctx,
      "[↑↓] item   [←→] adjust   [ENTER/ESC] back",
      config.LOGICAL_W / 2,
      config.LOGICAL_H - 24,
      { size: 11, color: config.SILVER, align: "center" },
    );
  }
}
