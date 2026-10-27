import { describe, expect, it } from "vitest";

import { dispatch } from "../../src/touch/dispatch";
import type { DispatchHooks, InputTarget } from "../../src/touch/dispatch";

const makeHarness = () => {
  const log: string[] = [];
  const events: Array<{ key: string; shift: boolean }> = [];
  const target: InputTarget = {
    handleEvent(e) {
      events.push({ key: e.key, shift: e.shift });
      log.push(`key:${e.key}:${e.shift}`);
    },
    focus(index) {
      log.push(`focus:${index}`);
    },
  };
  const hooks: DispatchHooks = {
    back() {
      log.push("back");
    },
  };
  return { log, events, target, hooks };
};

describe("dispatch", () => {
  it("sends a key command as exactly the event the keyboard would send", () => {
    const { log, events, target, hooks } = makeHarness();
    dispatch(target, { commands: [{ kind: "key", key: "ArrowLeft" }], coarse: false }, hooks);
    expect(events).toEqual([{ key: "ArrowLeft", shift: false }]);
    expect(log).toEqual(["key:ArrowLeft:false"]);
  });

  it("marks a key command with shift when the emit is coarse", () => {
    const { log, events, target, hooks } = makeHarness();
    dispatch(target, { commands: [{ kind: "key", key: "ArrowLeft" }], coarse: true }, hooks);
    expect(events).toEqual([{ key: "ArrowLeft", shift: true }]);
    expect(log).toEqual(["key:ArrowLeft:true"]);
  });

  it("runs commands in order", () => {
    const { log, events, target, hooks } = makeHarness();
    dispatch(
      target,
      { commands: [{ kind: "focus", index: 2 }, { kind: "key", key: "Enter" }], coarse: false },
      hooks,
    );
    expect(log).toEqual(["focus:2", "key:Enter:false"]);
    expect(events).toEqual([{ key: "Enter", shift: false }]);
  });

  it("routes back to the hooks only", () => {
    const { log, events, target, hooks } = makeHarness();
    dispatch(target, { commands: [{ kind: "back" }], coarse: false }, hooks);
    expect(log).toEqual(["back"]);
    expect(events).toEqual([]);
  });

  it("does nothing for an empty command list", () => {
    const { log, events, target, hooks } = makeHarness();
    dispatch(target, { commands: [], coarse: true }, hooks);
    expect(log).toEqual([]);
    expect(events).toEqual([]);
  });
});
