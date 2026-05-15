// Top-level application: canvas setup, main loop, scene stack, input.
//
// Render pipeline:
//   1. The scene draws to a fixed 640×360 logical canvas.
//   2. The visible <canvas> is sized to an integer multiple of (640×360) that
//      fits the viewport — backing buffer matches the displayed pixel grid
//      exactly, so the browser never has to fractional-scale, and pixels stay
//      crisp at any window size. Letterbox via flex centering in CSS.

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
  private logicalCanvas: HTMLCanvasElement;
  private logicalCtx: CanvasRenderingContext2D;

  constructor(private canvas: HTMLCanvasElement) {
    const c2d = canvas.getContext("2d");
    if (!c2d) throw new Error("2d context unavailable");
    this.ctx = c2d;
    this.ctx.imageSmoothingEnabled = false;

    this.logicalCanvas = document.createElement("canvas");
    this.logicalCanvas.width = config.LOGICAL_W;
    this.logicalCanvas.height = config.LOGICAL_H;
    const lctx = this.logicalCanvas.getContext("2d");
    if (!lctx) throw new Error("logical 2d context unavailable");
    this.logicalCtx = lctx;
    this.logicalCtx.imageSmoothingEnabled = false;

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
  // Resize — pick the largest integer scale that fits, set CSS + backing size
  // -------------------------------------------------------------------------

  private resize(): void {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;

    // Largest integer N such that (LOGICAL_W*N, LOGICAL_H*N) fits the viewport
    // when expressed in device pixels.
    const dvw = vw * dpr;
    const dvh = vh * dpr;
    let scale = Math.min(
      Math.floor(dvw / config.LOGICAL_W),
      Math.floor(dvh / config.LOGICAL_H),
    );
    if (scale < 1) scale = 1;

    const bbw = config.LOGICAL_W * scale;
    const bbh = config.LOGICAL_H * scale;
    this.canvas.width = bbw;
    this.canvas.height = bbh;
    // CSS size: keep the same aspect, in CSS pixels (= backing / dpr).
    this.canvas.style.width = `${bbw / dpr}px`;
    this.canvas.style.height = `${bbh / dpr}px`;

    // canvas re-creates state on width/height change; restore.
    this.ctx.imageSmoothingEnabled = false;
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
    this.scene.render(this.logicalCtx);
    // Integer-scale blit of the logical surface into the visible canvas.
    this.ctx.fillStyle = "#000";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(
      this.logicalCanvas,
      0,
      0,
      this.canvas.width,
      this.canvas.height,
    );
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
