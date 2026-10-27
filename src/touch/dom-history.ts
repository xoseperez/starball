import type { HistoryOp } from "./back";

interface HistoryState {
  starballGuard?: unknown;
  index?: unknown;
}

export function currentGuardIndex(): number {
  const s = history.state as HistoryState | null;
  return s && s.starballGuard === true && typeof s.index === "number" ? s.index : 0;
}

export function applyHistoryOps(ops: HistoryOp[]): void {
  for (const op of ops) {
    if (op.op === "push") {
      const base = currentGuardIndex();
      for (let i = 1; i <= op.n; i += 1) {
        history.pushState({ starballGuard: true, index: base + i }, "");
      }
    } else {
      history.go(op.delta);
    }
  }
}

export function onHistoryPop(handler: (isGuardEntry: boolean) => void): void {
  window.addEventListener("popstate", (e) => {
    handler(Boolean(e.state && (e.state as HistoryState).starballGuard === true));
  });
}
