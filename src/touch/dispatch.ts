import type { Emit } from "./controls";

export interface InputTarget {
  handleEvent(e: { key: string; shift: boolean }): void;
  focus(index: number): void;
}

export interface DispatchHooks {
  back(): void;
}

export function dispatch(target: InputTarget, emit: Emit, hooks: DispatchHooks): void {
  for (const command of emit.commands) {
    switch (command.kind) {
      case "key":
        target.handleEvent({ key: command.key, shift: emit.coarse });
        break;
      case "focus":
        target.focus(command.index);
        break;
      case "back":
        hooks.back();
        break;
    }
  }
}
