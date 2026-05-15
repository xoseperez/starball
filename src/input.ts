// Launcher aim/power state — pure state, no DOM. Lives in its own module so
// it can be unit-tested in isolation.

import { MAX_POWER_PCT, MIN_POWER_PCT } from "./config";

export class AimState {
  angleDeg = 30;
  powerPct = 50;

  constructor(angleDeg = 30, powerPct = 50) {
    this.angleDeg = angleDeg;
    this.powerPct = powerPct;
  }

  adjustAngle(deltaDeg: number): void {
    let a = (this.angleDeg + deltaDeg) % 360;
    // Normalise to (-180, 180]
    if (a > 180) a -= 360;
    if (a <= -180) a += 360;
    this.angleDeg = a;
  }

  adjustPower(deltaPct: number): void {
    this.powerPct = Math.max(
      MIN_POWER_PCT,
      Math.min(MAX_POWER_PCT, this.powerPct + deltaPct),
    );
  }

  reset(): void {
    this.angleDeg = 30;
    this.powerPct = 50;
  }
}
