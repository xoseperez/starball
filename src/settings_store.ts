// In-memory settings cache. Loaded from persistence at app boot, mutated
// freely while the game runs, saved back on transitions out of the settings
// screen and at exit.

import { DEFAULT_SETTINGS, type Settings } from "./config";
import { loadSettings, saveSettings } from "./persistence";

export class SettingsStore {
  private data: Settings;

  constructor() {
    this.data = { ...DEFAULT_SETTINGS };
  }

  load(): void {
    this.data = loadSettings();
  }

  save(): void {
    saveSettings(this.data);
  }

  get<K extends keyof Settings>(key: K): Settings[K] {
    return this.data[key];
  }

  set<K extends keyof Settings>(key: K, value: Settings[K]): void {
    this.data[key] = value;
  }

  asObject(): Settings {
    return { ...this.data };
  }
}

export const SETTINGS = new SettingsStore();
