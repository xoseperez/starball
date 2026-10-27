import { isTouchDevice } from "./device";
import { screenToLogical } from "./geometry";

export interface PointerHandlers {
  down(id: number, x: number, y: number): void;
  move(id: number, x: number, y: number): void;
  up(id: number, x: number, y: number): void;
  cancel(id: number): void;
  cancelAll(): void;
  deviceChanged(isTouch: boolean): void;
}

export function installTouchInput(canvas: HTMLCanvasElement, h: PointerHandlers): { isTouch(): boolean } {
  const coarse = matchMedia("(pointer: coarse)");
  const noHover = matchMedia("(hover: none)");
  let touch = isTouchDevice({ pointerCoarse: coarse.matches, hoverNone: noHover.matches });

  const onMediaChange = () => {
    const next = isTouchDevice({ pointerCoarse: coarse.matches, hoverNone: noHover.matches });
    if (next === touch) return;
    touch = next;
    h.deviceChanged(touch);
  };

  const logical = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return screenToLogical(e.clientX - r.left, e.clientY - r.top, r.width, r.height);
  };

  coarse.addEventListener("change", onMediaChange);
  noHover.addEventListener("change", onMediaChange);

  canvas.addEventListener("pointerdown", (e) => {
    if (!touch) return;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {}
    e.preventDefault();
    const p = logical(e);
    h.down(e.pointerId, p.x, p.y);
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!touch) return;
    const p = logical(e);
    h.move(e.pointerId, p.x, p.y);
  });

  canvas.addEventListener("pointerup", (e) => {
    if (!touch) return;
    const p = logical(e);
    h.up(e.pointerId, p.x, p.y);
  });

  canvas.addEventListener("pointercancel", (e) => {
    if (!touch) return;
    h.cancel(e.pointerId);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") h.cancelAll();
  });

  window.addEventListener("blur", () => h.cancelAll());

  window.addEventListener("contextmenu", (e) => {
    if (touch) e.preventDefault();
  });

  document.addEventListener("gesturestart", (e: Event) => {
    if (touch) e.preventDefault();
  });

  return { isTouch: () => touch };
}
