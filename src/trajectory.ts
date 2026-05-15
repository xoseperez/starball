// Predict the asteroid's path before firing. Used for the trajectory-preview
// assist option.

import { type GameMap } from "./entities";
import { makeShot, step } from "./physics";

export interface PreviewPoint {
  x: number;
  y: number;
}

export function previewTrajectory(
  m: GameMap,
  angleDeg: number,
  powerPct: number,
  seconds = 1.0,
  stepCount = 60,
): PreviewPoint[] {
  const a = makeShot(m.launcher.x, m.launcher.y, angleDeg, powerPct);
  const pts: PreviewPoint[] = [{ x: a.x, y: a.y }];
  const dt = seconds / stepCount;
  for (let i = 0; i < stepCount; i++) {
    if (!a.alive) break;
    step(a, m.stars, m.goal, dt);
    pts.push({ x: a.x, y: a.y });
    if (!a.alive) break;
  }
  return pts;
}
