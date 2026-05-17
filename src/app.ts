// Top-level application: canvas setup, main loop, scene stack, input.
//
// Render pipeline:
//   1. The visible <canvas> is sized to the full window at native DPR.
//   2. The scene draws directly into the context — all game coordinates
//      (640×360 logical space) are stretched proportionally on both axes
//      to fill the screen, no letterboxing.

import { BANK } from "./audio";
import * as config from "./config";
import { SETTINGS } from "./settings_store";
import { MenuScene } from "./scenes/menu";
import { Scene, type InputEvent } from "./scenes/base";

const KEYS_THAT_BLOCK_DEFAULT = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  " ",
  "Backspace",
  "Tab",
  "Enter",
]);

export class App {
  private ctx: CanvasRenderingContext2D;
  private scene: Scene;
  private lastTime = 0;
  private running = false;

  constructor(private canvas: HTMLCanvasElement) {
    // Make the canvas fill the entire viewport — inline styles can't be
    // overridden by CSS since we set them after the DOM is ready.
    Object.assign(this.canvas.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      display: "block",
      background: "#000",
    } as Partial<CSSStyleDeclaration>);

    const c2d = canvas.getContext("2d");
    if (!c2d) throw new Error("2d context unavailable");
    this.ctx = c2d;
    this.ctx.imageSmoothingEnabled = true;

    SETTINGS.load();
    this.scene = new MenuScene();

    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.installInput();
  }

  run(): void {
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.tick);
  }

  // -------------------------------------------------------------------------
  // Resize — canvas fills the window at native DPR. Game coordinates (640×360
  // logical space) stretch proportionally on both axes to fill the screen.
  // -------------------------------------------------------------------------

  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(window.innerWidth * dpr);
    this.canvas.height = Math.round(window.innerHeight * dpr);
  }

  // -------------------------------------------------------------------------
  // Main loop
  // -------------------------------------------------------------------------

  private tick = (now: number): void => {
    if (!this.running) return;
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (dt > 0.1) dt = 0.1;

    this.scene.update(dt);

    if (this.scene.nextScene !== null) {
      this.scene = this.scene.nextScene;
    }

    this.render();
    requestAnimationFrame(this.tick);
  };

  private render(): void {
    // Scale so that the logical 640×360 coordinate space maps to the full
    // canvas backing buffer. Without this, drawing at x=640 would only fill
    // a sliver of a full-window DPR-sized canvas.
    const scaleX = this.canvas.width / config.LOGICAL_W;
    const scaleY = this.canvas.height / config.LOGICAL_H;
    this.ctx.save();
    this.ctx.scale(scaleX, scaleY);
    this.scene.render(this.ctx);
    this.ctx.restore();
  }

  // -------------------------------------------------------------------------
  // Input
  // -------------------------------------------------------------------------

  private installInput(): void {
    window.addEventListener("keydown", (e) => {
      BANK.ensure();
      BANK.resume();

      if (KEYS_THAT_BLOCK_DEFAULT.has(e.key)) {
        e.preventDefault();
      }
      const inputEvent: InputEvent = {
        key: e.key,
        shift: e.shiftKey,
      };
      this.scene.handleEvent(inputEvent);
    });

    const unlockAudio = (): void => {
      BANK.ensure();
      BANK.resume();
    };
    window.addEventListener("pointerdown", unlockAudio, { once: false });
    window.addEventListener("touchstart", unlockAudio, { once: false });
  }
}
