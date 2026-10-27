// Scene base type. Subclasses override the lifecycle methods. Setting
// `nextScene` to another Scene asks App to transition on the next tick.

import { EMPTY_LAYOUT, type TouchContext, type TouchLayout } from "../touch/controls";

export interface InputEvent {
  key: string; // e.g. 'ArrowLeft', 'Space', 'Escape', 'a'
  shift: boolean;
}

export abstract class Scene {
  nextScene: Scene | null = null;
  readonly isRoot: boolean = false;
  touchFrame: TouchLayout = EMPTY_LAYOUT;

  handleEvent(_event: InputEvent): void {}
  update(_dt: number): void {}
  abstract render(ctx: CanvasRenderingContext2D): void;

  touchLayout(_t: TouchContext): TouchLayout {
    return EMPTY_LAYOUT;
  }

  focus(_index: number): void {}

  backNeedsConfirm(): boolean {
    return false;
  }
}
