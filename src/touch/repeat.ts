import {
  TOUCH_COARSE_AFTER_MS,
  TOUCH_MAX_STEPS_PER_TICK,
  TOUCH_REPEAT_DELAY_MS,
  TOUCH_REPEAT_INTERVAL_MS,
} from "../config";

export class HoldRepeat {
  private readonly pressedAt: number;
  private nextSlot: number;

  constructor(pressedAt: number) {
    this.pressedAt = pressedAt;
    this.nextSlot = 0;
  }

  due(now: number): Array<{ coarse: boolean }> {
    const elapsed = now - this.pressedAt - TOUCH_REPEAT_DELAY_MS;
    const ready = Math.floor(elapsed / TOUCH_REPEAT_INTERVAL_MS) + 1;
    const consumed = Math.max(this.nextSlot, Math.min(ready, Number.MAX_SAFE_INTEGER));
    const kept = Math.min(consumed - this.nextSlot, TOUCH_MAX_STEPS_PER_TICK);
    const steps: Array<{ coarse: boolean }> = [];
    for (let index = consumed - kept; index < consumed; index++) {
      const slot = this.pressedAt + TOUCH_REPEAT_DELAY_MS + index * TOUCH_REPEAT_INTERVAL_MS;
      steps.push({ coarse: slot - this.pressedAt >= TOUCH_COARSE_AFTER_MS });
    }
    this.nextSlot = consumed;
    return steps;
  }
}
