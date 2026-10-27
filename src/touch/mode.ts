export class TouchMode {
  #device = false;
  #active = false;

  get device(): boolean {
    return this.#device;
  }

  get active(): boolean {
    return this.#active;
  }

  setDevice(isTouch: boolean): void {
    this.#device = isTouch;
    this.#active = isTouch;
  }

  onKey(): void {
    this.#active = false;
  }

  onPointer(): void {
    if (this.#device) this.#active = true;
  }
}

export const TOUCH = new TouchMode();
