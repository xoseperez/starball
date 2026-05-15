import * as config from "../config";
import { BANK } from "../audio";
import { drawText } from "../render";
import { Scene, type InputEvent } from "./base";

interface MenuItem {
  label: string;
  action: () => void;
}

export class MenuScene extends Scene {
  private items: MenuItem[];
  private cursor = 0;

  constructor() {
    super();
    this.items = [
      { label: "PLAY", action: () => this.openPlay() },
      { label: "BATTLE", action: () => this.openBattle() },
      { label: "TRAINING", action: () => this.openSandbox() },
      { label: "HIGH SCORES", action: () => this.openHighscores() },
      { label: "HELP", action: () => this.openHelp() },
      { label: "SETTINGS", action: () => this.openSettings() },
    ];
  }

  override handleEvent(e: InputEvent): void {
    if (e.key === "ArrowUp") {
      this.cursor = (this.cursor - 1 + this.items.length) % this.items.length;
      BANK.play("menu_move");
    } else if (e.key === "ArrowDown") {
      this.cursor = (this.cursor + 1) % this.items.length;
      BANK.play("menu_move");
    } else if (e.key === "Enter" || e.key === " ") {
      BANK.play("menu_select");
      this.items[this.cursor].action();
    }
  }

  override render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = `rgb(${config.BG_COLOR[0]}, ${config.BG_COLOR[1]}, ${config.BG_COLOR[2]})`;
    ctx.fillRect(0, 0, config.LOGICAL_W, config.LOGICAL_H);

    // Title
    drawText(ctx, "STARBALL", config.LOGICAL_W / 2, 50, {
      size: 48,
      bold: true,
      color: config.YELLOW,
      align: "center",
      shadow: true,
    });

    drawText(ctx, "a gravity puzzle by Xose Pérez", config.LOGICAL_W / 2, 100, {
      size: 12,
      color: config.PALE_CYAN,
      align: "center",
    });

    // Items — centered between the subtitle (~y=112) and the footer hint (y=336).
    const startY = 144;
    for (let i = 0; i < this.items.length; i++) {
      const isCursor = i === this.cursor;
      const color = isCursor ? config.YELLOW : config.PALE_CYAN;
      const label = this.items[i].label;
      const x = config.LOGICAL_W / 2;
      const y = startY + i * 28;
      if (isCursor) {
        drawText(ctx, ">", x - 80, y, { size: 20, bold: true, color: config.YELLOW });
      }
      drawText(ctx, label, x, y, {
        size: 20,
        bold: true,
        color,
        align: "center",
      });
    }

    drawText(
      ctx,
      "[↑↓] navigate   [ENTER] select",
      config.LOGICAL_W / 2,
      config.LOGICAL_H - 24,
      { size: 11, color: config.SILVER, align: "center" },
    );
  }

  private async openPlay(): Promise<void> {
    const { PlayScene } = await import("./play");
    this.nextScene = new PlayScene();
  }
  private async openBattle(): Promise<void> {
    const { BattleScene } = await import("./battle");
    this.nextScene = new BattleScene();
  }
  private async openSandbox(): Promise<void> {
    const { SandboxScene } = await import("./sandbox");
    this.nextScene = new SandboxScene();
  }
  private async openHighscores(): Promise<void> {
    const { HighscoresScene } = await import("./highscores");
    this.nextScene = new HighscoresScene();
  }
  private async openHelp(): Promise<void> {
    const { HelpScene } = await import("./help");
    this.nextScene = new HelpScene();
  }
  private async openSettings(): Promise<void> {
    const { SettingsScene } = await import("./settings");
    this.nextScene = new SettingsScene();
  }
}
