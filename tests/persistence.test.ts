import { beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "../src/config";
import {
  HIGHSCORES_KEY,
  SETTINGS_KEY,
  SETTINGS_VERSION,
  addHighscore,
  loadHighscores,
  loadSettings,
  qualifiesForHighscore,
  resetStoreForTests,
  saveSettings,
  setStore,
} from "../src/persistence";

// Simple in-memory KVStore so we don't need jsdom
class TestStore {
  data = new Map<string, string>();
  getItem(k: string): string | null {
    return this.data.has(k) ? this.data.get(k)! : null;
  }
  setItem(k: string, v: string): void {
    this.data.set(k, v);
  }
  removeItem(k: string): void {
    this.data.delete(k);
  }
}

let store: TestStore;

beforeEach(() => {
  store = new TestStore();
  setStore(store);
});

describe("settings", () => {
  it("returns defaults with no file", () => {
    const s = loadSettings();
    for (const k of Object.keys(DEFAULT_SETTINGS) as Array<keyof typeof DEFAULT_SETTINGS>) {
      expect(s[k]).toEqual(DEFAULT_SETTINGS[k]);
    }
  });

  it("round-trips settings", () => {
    const s = loadSettings();
    s.volume_master = 0.42;
    s.player1_name = "ABC";
    saveSettings(s);
    const s2 = loadSettings();
    expect(s2.volume_master).toBe(0.42);
    expect(s2.player1_name).toBe("ABC");
  });

  it("saves under the expected key", () => {
    saveSettings({ ...DEFAULT_SETTINGS, volume_master: 0.5 });
    expect(store.data.has(SETTINGS_KEY)).toBe(true);
  });

  it("falls back to defaults on corrupted JSON", () => {
    store.data.set(SETTINGS_KEY, "{ garbage");
    const s = loadSettings();
    expect(s.lives).toBe(DEFAULT_SETTINGS.lives);
  });

  it("falls back to defaults on wrong version", () => {
    store.data.set(
      SETTINGS_KEY,
      JSON.stringify({ version: 999, volume_master: 0.1 }),
    );
    const s = loadSettings();
    expect(s.volume_master).toBe(DEFAULT_SETTINGS.volume_master);
  });

  it("merges partial files with defaults", () => {
    store.data.set(
      SETTINGS_KEY,
      JSON.stringify({ version: SETTINGS_VERSION, volume_master: 0.3 }),
    );
    const s = loadSettings();
    expect(s.volume_master).toBe(0.3);
    expect(s.lives).toBe(DEFAULT_SETTINGS.lives);
    expect(s.difficulty).toBe(DEFAULT_SETTINGS.difficulty);
  });
});

describe("highscores", () => {
  it("empty by default", () => {
    const h = loadHighscores();
    expect(h.endless).toEqual([]);
    expect(h.hotseat).toEqual([]);
  });

  it("keeps top 10", () => {
    for (let i = 0; i < 15; i++) {
      addHighscore({ mode: "endless", name: "P", score: 100 + i });
    }
    const h = loadHighscores();
    expect(h.endless.length).toBe(10);
    const scores = h.endless.map((e) => e.score);
    const sortedDesc = [...scores].sort((a, b) => b - a);
    expect(scores).toEqual(sortedDesc);
    expect(Math.min(...scores)).toBe(105);
  });

  it("returns the new rank", () => {
    const r1 = addHighscore({ mode: "endless", name: "AAA", score: 500 });
    const r2 = addHighscore({ mode: "endless", name: "BBB", score: 1000 });
    expect(r1).toBe(1);
    expect(r2).toBe(1);
  });

  it("clips names to 3 uppercase chars", () => {
    addHighscore({ mode: "endless", name: "VeryLongName", score: 999 });
    const h = loadHighscores();
    expect(h.endless[0].name).toBe("VER");
  });

  it("qualifies when table not full", () => {
    expect(qualifiesForHighscore("endless", 1)).toBe(true);
    expect(qualifiesForHighscore("endless", 0)).toBe(false);
  });

  it("qualifies only above the current min once full", () => {
    for (let i = 0; i < 10; i++) {
      addHighscore({ mode: "endless", name: `P${i}`, score: 100 + i * 10 });
    }
    expect(qualifiesForHighscore("endless", 105)).toBe(true);
    expect(qualifiesForHighscore("endless", 50)).toBe(false);
  });

  it("recovers from corrupted file", () => {
    store.data.set(HIGHSCORES_KEY, "not json at all");
    const h = loadHighscores();
    expect(h.endless).toEqual([]);
    expect(h.hotseat).toEqual([]);
  });
});

describe("setStore + resetStoreForTests", () => {
  it("can be reset to an empty in-memory store", () => {
    resetStoreForTests();
    const h = loadHighscores();
    expect(h.endless).toEqual([]);
  });
});
