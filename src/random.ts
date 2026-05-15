// Deterministic seeded PRNG (mulberry32). Same seed → same sequence —
// important for procedural maps so we can reproduce them.

export class Random {
  private state: number;

  constructor(seed?: number) {
    if (seed === undefined) {
      seed = Math.floor(Math.random() * 0xffffffff);
    }
    this.state = seed >>> 0;
  }

  // Float in [0, 1).
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Integer in [low, high] inclusive.
  randInt(low: number, high: number): number {
    return Math.floor(this.next() * (high - low + 1)) + low;
  }

  // Float in [low, high).
  uniform(low: number, high: number): number {
    return low + this.next() * (high - low);
  }

  // Pick from a non-empty array.
  choice<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  // Random 30-bit integer seed for child generators.
  randomSeed(): number {
    return Math.floor(this.next() * 0x40000000);
  }
}
