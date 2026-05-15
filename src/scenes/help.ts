// Help — multi-page reference accessible from the main menu. Page 0 is the
// star-type guide (live sprites + gravity blurbs). Page 1 explains the
// scoring formula. The scoring page reads coefficients directly from
// `src/config.ts`, so it stays accurate when those constants are tuned;
// only changes to the SHAPE of the scoring (new terms, new mechanics)
// require updating the rendered text below.

import * as config from "../config";
import type { StarType } from "../config";
import { drawText } from "../render";
import { getStarSprite } from "../sprites";
import { Scene, type InputEvent } from "./base";

interface Row {
  type: StarType;
  label: string;
  blurb: string;
}

const ROWS: readonly Row[] = [
  {
    type: "brown_dwarf",
    label: "BROWN DWARF",
    blurb: "small mass, weak pull. Mild deflection — easy to ignore.",
  },
  {
    type: "standard",
    label: "STANDARD STAR",
    blurb: "the workhorse slingshot. 1/r² Newtonian — strong only up close.",
  },
  {
    type: "blue_giant",
    label: "BLUE GIANT",
    blurb: "Newtonian pull + radiation pressure inside 2R. Pushes back when you graze.",
  },
  {
    type: "red_giant",
    label: "RED GIANT",
    blurb: "large radius, low density. Big target, gentle deflection for its size.",
  },
  {
    type: "black_hole",
    label: "BLACK HOLE",
    blurb: "non-Newtonian, capped 1/r pull. Reaches across the field. Inside the ring = dead.",
  },
];

const PAGE_COUNT = 2;

export class HelpScene extends Scene {
  private page = 0;

  override handleEvent(e: InputEvent): void {
    if (e.key === "Enter" || e.key === "Escape" || e.key === "Backspace" || e.key === " ") {
      void this.toMenu();
      return;
    }
    if (e.key === "ArrowLeft") {
      this.page = (this.page - 1 + PAGE_COUNT) % PAGE_COUNT;
    } else if (e.key === "ArrowRight") {
      this.page = (this.page + 1) % PAGE_COUNT;
    }
  }

  private async toMenu(): Promise<void> {
    const { MenuScene } = await import("./menu");
    this.nextScene = new MenuScene();
  }

  override render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = `rgb(${config.BG_COLOR[0]}, ${config.BG_COLOR[1]}, ${config.BG_COLOR[2]})`;
    ctx.fillRect(0, 0, config.LOGICAL_W, config.LOGICAL_H);

    if (this.page === 0) this.renderStarsPage(ctx);
    else this.renderScoringPage(ctx);

    this.renderPageIndicator(ctx);
    this.renderFooter(ctx);
  }

  private renderStarsPage(ctx: CanvasRenderingContext2D): void {
    drawText(ctx, "STAR TYPES", config.LOGICAL_W / 2, 24, {
      size: 22, bold: true, color: config.YELLOW, align: "center",
    });
    drawText(ctx, "how each star pulls on the asteroid", config.LOGICAL_W / 2, 44, {
      size: 11, color: config.PALE_CYAN, align: "center",
    });

    const startY = 64;
    const rowH = 50;
    const iconX = 60;
    const labelX = 100;
    const blurbX = 100;

    for (let i = 0; i < ROWS.length; i++) {
      const r = ROWS[i];
      const cy = startY + i * rowH + 16;
      const sprite = getStarSprite(r.type);
      ctx.drawImage(sprite, Math.floor(iconX - sprite.width / 2), Math.floor(cy - sprite.height / 2));

      drawText(ctx, r.label, labelX, cy - 6, {
        size: 13, bold: true, color: config.YELLOW,
      });
      drawText(ctx, r.blurb, blurbX, cy + 10, {
        size: 11, color: config.PALE_CYAN,
      });
    }
  }

  private renderScoringPage(ctx: CanvasRenderingContext2D): void {
    drawText(ctx, "SCORING", config.LOGICAL_W / 2, 24, {
      size: 22, bold: true, color: config.YELLOW, align: "center",
    });
    drawText(ctx, "how each goal is scored", config.LOGICAL_W / 2, 44, {
      size: 11, color: config.PALE_CYAN, align: "center",
    });

    drawText(
      ctx,
      "total = round( (base + curvature + grazing) × time )",
      config.LOGICAL_W / 2, 70,
      { size: 12, color: config.WHITE, align: "center" },
    );

    const labelX = 40;
    const valueX = 140;
    const lineY = 100;
    const dy = 38;

    const lines: Array<[string, string[]]> = [
      ["BASE", [
        `${config.SCORE_BASE} pts for any successful goal.`,
      ]],
      ["CURVATURE", [
        `K_CURV ${config.K_CURV} × accumulated turning. Wall bounces excluded.`,
        `Per-star cap ${config.C_STAR_MAX} pts; global cap ${config.CURVATURE_GLOBAL_CAP} pts.`,
        `Decays to 0 after ${config.TIME_DECAY_TAU.toFixed(1)} s near the same star.`,
      ]],
      ["GRAZING", [
        `K_GRAZE ${config.K_GRAZE} × (1 − d_min / ${config.GRAZE_RADIUS_MULT.toFixed(0)}R) × star mass,`,
        `summed over each star you fly close to.`,
      ]],
      ["TIME", [
        `×1.0 inside the first ${config.FLIGHT_TIME_GRACE_S.toFixed(0)} s, then decays linearly`,
        `to ×${config.FLIGHT_TIME_PENALTY_FLOOR.toFixed(1)} over the next ${config.FLIGHT_TIME_PENALTY_WINDOW_S.toFixed(0)} s.`,
      ]],
    ];

    for (let i = 0; i < lines.length; i++) {
      const [label, body] = lines[i];
      const y = lineY + i * dy;
      drawText(ctx, label, labelX, y, {
        size: 13, bold: true, color: config.YELLOW,
      });
      for (let j = 0; j < body.length; j++) {
        drawText(ctx, body[j], valueX, y + j * 12, {
          size: 11, color: config.PALE_CYAN,
        });
      }
    }

    drawText(
      ctx,
      "Crashed, stopped, no-progress, timeout, or aborted = 0 pts.",
      config.LOGICAL_W / 2, lineY + lines.length * dy + 6,
      { size: 11, color: config.SILVER, align: "center" },
    );
  }

  private renderPageIndicator(ctx: CanvasRenderingContext2D): void {
    const y = config.LOGICAL_H - 30;
    const cx = config.LOGICAL_W / 2;
    const gap = 14;
    for (let i = 0; i < PAGE_COUNT; i++) {
      const x = cx + (i - (PAGE_COUNT - 1) / 2) * gap;
      const color = i === this.page ? config.YELLOW : config.DARK_GRAY;
      ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderFooter(ctx: CanvasRenderingContext2D): void {
    drawText(
      ctx,
      "←/→ page    [ENTER/ESC] back    try the field map with G in Training",
      config.LOGICAL_W / 2,
      config.LOGICAL_H - 14,
      { size: 11, color: config.SILVER, align: "center" },
    );
  }
}
