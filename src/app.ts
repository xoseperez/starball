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
import { BackConfirm, BackGuard } from "./touch/back";
import {
  EMPTY_LAYOUT,
  type Emit,
  type TouchContext,
  type TouchLayout,
} from "./touch/controls";
import { isPortrait } from "./touch/device";
import { dispatch } from "./touch/dispatch";
import { applyHistoryOps, currentGuardIndex, onHistoryPop } from "./touch/dom-history";
import { installTouchInput } from "./touch/dom-input";
import { drawControls, drawRotatePrompt } from "./touch/draw";
import { renderTransform, type RenderTransform } from "./touch/geometry";
import { TOUCH } from "./touch/mode";
import { PointerTracker } from "./touch/pointers";

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
  private transform: RenderTransform = renderTransform(config.LOGICAL_W, config.LOGICAL_H, 1);
  private readonly tracker = new PointerTracker();
  private readonly backConfirm = new BackConfirm();
  private readonly backGuard = new BackGuard();
  private layout: TouchLayout = EMPTY_LAYOUT;

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
    this.installTouch();
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
    this.transform = renderTransform(window.innerWidth, window.innerHeight, dpr);
    this.canvas.width = this.transform.canvasW;
    this.canvas.height = this.transform.canvasH;
  }

  // -------------------------------------------------------------------------
  // Main loop
  // -------------------------------------------------------------------------

  private tick = (now: number): void => {
    if (!this.running) return;
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (dt > 0.1) dt = 0.1;

    if (TOUCH.active && !this.blocked()) {
      for (const e of this.tracker.tick(now, this.layout)) this.emit(e);
    }

    this.scene.update(dt);

    if (this.scene.nextScene !== null) {
      this.scene = this.scene.nextScene;
      this.backConfirm.reset();
      this.tracker.cancelAll();
      applyHistoryOps(this.backGuard.onSceneChange(this.scene.isRoot));
    }

    this.refreshLayout(now);
    this.render();
    requestAnimationFrame(this.tick);
  };

  private render(): void {
    this.ctx.save();
    this.ctx.scale(this.transform.scaleX, this.transform.scaleY);
    this.scene.render(this.ctx);
    if (TOUCH.active) drawControls(this.ctx, this.layout, this.tracker.pressedIds());
    if (this.blocked()) drawRotatePrompt(this.ctx);
    this.ctx.restore();
  }

  // -------------------------------------------------------------------------
  // Touch state
  // -------------------------------------------------------------------------

  private refreshLayout(now: number): void {
    this.layout = TOUCH.active ? this.scene.touchLayout(this.context(now)) : EMPTY_LAYOUT;
    this.scene.touchFrame = this.layout;
  }

  private context(now: number): TouchContext {
    return {
      backPending: this.backConfirm.pending(now),
      device: TOUCH.device,
    };
  }

  private blocked(): boolean {
    return TOUCH.device && isPortrait(window.innerWidth, window.innerHeight);
  }

  private requestBack(): void {
    if (this.backConfirm.request(performance.now(), this.scene.backNeedsConfirm()) === "act") {
      this.scene.handleEvent({ key: "Escape", shift: false });
    }
  }

  private emit(e: Emit): void {
    dispatch(this.scene, e, { back: () => this.requestBack() });
  }

  // -------------------------------------------------------------------------
  // Input
  // -------------------------------------------------------------------------

  private installInput(): void {
    window.addEventListener("keydown", (e) => {
      BANK.ensure();
      BANK.resume();

      const wasActive = TOUCH.active;
      TOUCH.onKey();
      if (wasActive) this.tracker.cancelAll();
      if (this.blocked()) {
        e.preventDefault();
        return;
      }

      if (TOUCH.device) {
        applyHistoryOps(this.backGuard.onActivation());
        // Android turns an unhandled Escape into the system Back, which closes the page.
        if (e.key === "Escape") {
          e.preventDefault();
          if (this.backGuard.onEscapeKey(performance.now()).back) this.requestBack();
          return;
        }
      }

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

  private installTouch(): void {
    const input = installTouchInput(this.canvas, {
      down: (id, x, y) => {
        const now = performance.now();
        const wasActive = TOUCH.active;
        TOUCH.onPointer();
        applyHistoryOps(this.backGuard.onActivation());
        if (this.blocked()) return;
        if (!wasActive) this.refreshLayout(now);
        for (const e of this.tracker.down(id, x, y, now, this.layout)) this.emit(e);
      },
      move: (id, x, y) => this.tracker.move(id, x, y, this.layout),
      up: (id, x, y) => {
        if (this.blocked()) {
          this.tracker.cancel(id);
          return;
        }
        for (const e of this.tracker.up(id, x, y, this.layout)) this.emit(e);
      },
      cancel: (id) => this.tracker.cancel(id),
      cancelAll: () => this.tracker.cancelAll(),
      deviceChanged: (isTouch) => {
        TOUCH.setDevice(isTouch);
        applyHistoryOps(this.backGuard.setEnabled(isTouch));
        this.tracker.cancelAll();
      },
    });

    TOUCH.setDevice(input.isTouch());
    applyHistoryOps(this.backGuard.setEnabled(TOUCH.device));
    applyHistoryOps(this.backGuard.onLoad(currentGuardIndex()));
    onHistoryPop((isGuardEntry) => {
      const r = this.backGuard.onPopState(performance.now(), isGuardEntry);
      applyHistoryOps(r.ops);
      if (r.back) this.requestBack();
    });
  }
}
