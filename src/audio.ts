// Synthesized chiptune SFX via the Web Audio API. No audio assets ship.
//
// The AudioContext can only be created after a user gesture in modern browsers,
// so we lazy-init on the first play() call and again on the first key press.

import { loadSettings } from "./persistence";

type SfxName =
  | "fire"
  | "bounce"
  | "crash"
  | "score"
  | "assist"
  | "menu_move"
  | "menu_select";

const SAMPLE_RATE = 22050;
const DEFAULT_AMP = 0.35;

class AudioBank {
  private ctx: AudioContext | null = null;
  private buffers: Map<SfxName, AudioBuffer> = new Map();
  // Active sources per name, so we can interrupt one sound when another
  // takes priority (e.g. cut a trailing "assist" chirp when the asteroid
  // crashes a moment later).
  private active: Map<SfxName, AudioBufferSourceNode[]> = new Map();

  /** Idempotent. Safe to call repeatedly; first call after a user gesture wins. */
  ensure(): void {
    if (this.ctx) return;
    try {
      const ACtor = (globalThis as { AudioContext?: typeof AudioContext })
        .AudioContext;
      if (!ACtor) return;
      this.ctx = new ACtor({ sampleRate: SAMPLE_RATE });
      this.buildBuffers();
    } catch {
      this.ctx = null;
    }
  }

  /** Resume the context if suspended (autoplay policy). */
  resume(): void {
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {
        /* no-op */
      });
    }
  }

  play(name: SfxName, volume = 1.0): void {
    this.ensure();
    this.resume();
    if (!this.ctx) return;
    const buf = this.buffers.get(name);
    if (!buf) return;

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const gain = this.ctx.createGain();
    const settings = loadSettings();
    const total = Math.max(
      0,
      Math.min(1, settings.volume_master * settings.volume_sfx * volume),
    );
    gain.gain.value = total;
    src.connect(gain).connect(this.ctx.destination);
    src.start();

    const bucket = this.active.get(name) ?? [];
    bucket.push(src);
    this.active.set(name, bucket);
    src.onended = () => {
      const arr = this.active.get(name);
      if (!arr) return;
      const idx = arr.indexOf(src);
      if (idx >= 0) arr.splice(idx, 1);
    };
  }

  /** Stop any currently-playing instances of `name`. */
  stop(name: SfxName): void {
    const arr = this.active.get(name);
    if (!arr) return;
    for (const src of arr) {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
    }
    arr.length = 0;
  }

  // -------------------------------------------------------------------------
  // Synthesis
  // -------------------------------------------------------------------------

  private buildBuffers(): void {
    if (!this.ctx) return;
    this.buffers.set("fire", this.sweep(440, 880, 0.08, 0.3));
    this.buffers.set("bounce", this.square(220, 0.06, 0.25));
    this.buffers.set("crash", this.crash());
    this.buffers.set("score", this.jingle());
    this.buffers.set("assist", this.square(1320, 0.05, 0.2));
    this.buffers.set("menu_move", this.square(660, 0.04, 0.15));
    this.buffers.set("menu_select", this.square(880, 0.08, 0.25));
  }

  /** Square wave with a simple attack/decay envelope. */
  private square(
    freq: number,
    duration: number,
    amp = DEFAULT_AMP,
    attack = 0.005,
    decay = 0.05,
  ): AudioBuffer {
    const ctx = this.ctx!;
    const n = Math.floor(SAMPLE_RATE * duration);
    const buf = ctx.createBuffer(1, n, SAMPLE_RATE);
    const data = buf.getChannelData(0);
    const halfPeriod = SAMPLE_RATE / (2 * Math.max(1, freq));
    const attackN = Math.floor(SAMPLE_RATE * attack);
    const decayN = Math.floor(SAMPLE_RATE * decay);
    const sustainN = Math.max(0, n - attackN - decayN);
    for (let i = 0; i < n; i++) {
      const sign = Math.floor(i / halfPeriod) % 2 === 0 ? 1 : -1;
      let env: number;
      if (i < attackN) env = i / Math.max(1, attackN);
      else if (i < attackN + sustainN) env = 1;
      else {
        const tail = i - attackN - sustainN;
        env = Math.max(0, 1 - tail / Math.max(1, decayN));
      }
      data[i] = sign * amp * env;
    }
    return buf;
  }

  /** Frequency sweep (square-shaped) for the fire SFX. */
  private sweep(f0: number, f1: number, duration: number, amp = DEFAULT_AMP): AudioBuffer {
    const ctx = this.ctx!;
    const n = Math.floor(SAMPLE_RATE * duration);
    const buf = ctx.createBuffer(1, n, SAMPLE_RATE);
    const data = buf.getChannelData(0);
    let phase = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const freq = f0 + (f1 - f0) * t;
      phase += (2 * Math.PI * freq) / SAMPLE_RATE;
      const sign = Math.sin(phase) >= 0 ? 1 : -1;
      const env = 1 - t;
      data[i] = sign * amp * env;
    }
    return buf;
  }

  /** Percussive crash: white-noise transient layered with a descending
   * low-frequency square sweep. Loud and unambiguously low-end so it cuts
   * through any trailing high-frequency assist chirp. */
  private crash(): AudioBuffer {
    const ctx = this.ctx!;
    const duration = 0.45;
    const n = Math.floor(SAMPLE_RATE * duration);
    const buf = ctx.createBuffer(1, n, SAMPLE_RATE);
    const data = buf.getChannelData(0);
    let state = 0xace1;
    let phase = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      const noise = (((state >>> 16) & 0xffff) - 32768) / 32768;
      const f = 180 - 140 * t; // 180 Hz → 40 Hz descending
      phase += (2 * Math.PI * f) / SAMPLE_RATE;
      const tone = Math.sin(phase) >= 0 ? 1 : -1;
      const env = Math.exp(-t * 4); // sharp exponential decay
      data[i] = (noise * 0.55 + tone * 0.45) * env * 0.6;
    }
    return buf;
  }

  /** Three rising tones for the score jingle. */
  private jingle(): AudioBuffer {
    const ctx = this.ctx!;
    const tones = [523, 659, 880]; // C5 E5 A5
    const perTone = Math.floor(SAMPLE_RATE * 0.1);
    const n = tones.length * perTone;
    const buf = ctx.createBuffer(1, n, SAMPLE_RATE);
    const data = buf.getChannelData(0);
    let idx = 0;
    for (const freq of tones) {
      const halfPeriod = SAMPLE_RATE / (2 * freq);
      for (let i = 0; i < perTone; i++) {
        const sign = Math.floor(i / halfPeriod) % 2 === 0 ? 1 : -1;
        const env = 1 - (i / perTone) * 0.8;
        data[idx++] = sign * 0.35 * env;
      }
    }
    return buf;
  }
}

export const BANK = new AudioBank();
