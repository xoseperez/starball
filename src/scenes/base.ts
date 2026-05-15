// Scene base type. Subclasses override the lifecycle methods. Setting
// `nextScene` to another Scene asks App to transition on the next tick.

export interface InputEvent {
  key: string; // e.g. 'ArrowLeft', 'Space', 'Escape', 'a'
  shift: boolean;
}

export abstract class Scene {
  nextScene: Scene | null = null;

  handleEvent(_event: InputEvent): void {}
  update(_dt: number): void {}
  abstract render(ctx: CanvasRenderingContext2D): void;
}
