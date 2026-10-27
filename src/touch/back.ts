import { BACK_CONFIRM_MS, BACK_GUARD_DEPTH, BACK_KEY_DEDUPE_MS } from "../config";

export type ConfirmScene = "play" | "battle" | "initials" | "other";

export function backConfirmRule(s: { scene: ConfirmScene; phase?: string; saved?: boolean }): boolean {
  switch (s.scene) {
    case "play":
      return s.phase !== "game_over";
    case "battle":
      return s.phase !== "match_end";
    case "initials":
      return !s.saved;
    default:
      return false;
  }
}

export class BackConfirm {
  private until = -Infinity;

  request(now: number, needsConfirm: boolean): "act" | "prompt" {
    if (!needsConfirm) {
      this.until = -Infinity;
      return "act";
    }
    if (now < this.until) {
      this.until = -Infinity;
      return "act";
    }
    this.until = now + BACK_CONFIRM_MS;
    return "prompt";
  }

  pending(now: number): boolean {
    return now < this.until;
  }

  reset(): void {
    this.until = -Infinity;
  }
}

export type HistoryOp = { op: "push"; n: number } | { op: "go"; delta: number };

export interface BackResult {
  back: boolean;
  ops: HistoryOp[];
}

export class BackGuard {
  private enabled = false;
  private atRoot = true;
  private depth = 0;
  private ignorePops = 0;
  private lastEscAt = -Infinity;
  private readonly targetDepth: number;

  constructor(targetDepth?: number) {
    this.targetDepth = targetDepth ?? BACK_GUARD_DEPTH;
  }

  setEnabled(on: boolean): HistoryOp[] {
    if (on === this.enabled) return [];
    this.enabled = on;
    return on ? [] : this.unwind();
  }

  onLoad(guardIndex: number): HistoryOp[] {
    if (guardIndex > 0) {
      this.ignorePops += 1;
      return [{ op: "go", delta: -guardIndex }];
    }
    return [];
  }

  onActivation(): HistoryOp[] {
    if (!this.enabled || this.atRoot || this.depth >= this.targetDepth) return [];
    const n = this.targetDepth - this.depth;
    this.depth = this.targetDepth;
    return [{ op: "push", n }];
  }

  onSceneChange(isRoot: boolean): HistoryOp[] {
    this.atRoot = isRoot;
    if (!this.enabled) return [];
    if (isRoot) return this.unwind();
    return this.onActivation();
  }

  onEscapeKey(now: number): BackResult {
    if (!this.enabled) return { back: false, ops: [] };
    this.lastEscAt = now;
    return { back: !this.atRoot, ops: [] };
  }

  onPopState(now: number, isGuardEntry: boolean): BackResult {
    if (this.ignorePops > 0) {
      this.ignorePops -= 1;
      return { back: false, ops: [] };
    }
    if (!this.enabled) return { back: false, ops: [] };
    if (this.atRoot) {
      if (isGuardEntry) {
        this.ignorePops += 1;
        return { back: false, ops: [{ op: "go", delta: -1 }] };
      }
      return { back: false, ops: [] };
    }
    if (this.depth > 0) this.depth -= 1;
    const ops = this.onActivation();
    if (now - this.lastEscAt <= BACK_KEY_DEDUPE_MS) return { back: false, ops };
    return { back: true, ops };
  }

  private unwind(): HistoryOp[] {
    if (this.depth === 0) return [];
    const d = this.depth;
    this.depth = 0;
    this.ignorePops += 1;
    return [{ op: "go", delta: -d }];
  }
}
