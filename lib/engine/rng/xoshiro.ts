// xoshiro128** seeded through cyrb128 (engine.md 1.3). Streams are derived from a string key,
// never shared, so adding a consumer cannot shift an existing stream.

export function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;
  private spare: number | null = null;
  /** The seed words, kept so a fork can be derived without hashing the whole key again. */
  private readonly seed: readonly [number, number, number, number];

  constructor(
    readonly key: string,
    words?: readonly [number, number, number, number],
  ) {
    const w = words ?? cyrb128(key);
    this.seed = w;
    this.a = w[0];
    this.b = w[1];
    this.c = w[2];
    this.d = w[3];
    // warm up so near-identical keys decorrelate
    for (let i = 0; i < 4; i++) this.nextU32();
  }

  private nextU32(): number {
    const { b } = this;
    const t = b << 9;
    let r = Math.imul(b, 5);
    r = Math.imul((r << 7) | (r >>> 25), 9);
    this.c ^= this.a;
    this.d ^= this.b;
    this.b ^= this.c;
    this.a ^= this.d;
    this.c ^= t;
    this.d = (this.d << 11) | (this.d >>> 21);
    return r >>> 0;
  }

  /** Uniform in [0, 1). */
  next(): number {
    return this.nextU32() / 4294967296;
  }

  /** Uniform in (0, 1), never exactly 0, for log transforms. */
  nextOpen(): number {
    return (this.nextU32() + 0.5) / 4294967296;
  }

  /** Standard normal (Box-Muller, pairs cached). */
  normal(): number {
    if (this.spare !== null) {
      const s = this.spare;
      this.spare = null;
      return s;
    }
    const u = this.nextOpen();
    const v = this.next();
    const mag = Math.sqrt(-2 * Math.log(u));
    this.spare = mag * Math.sin(2 * Math.PI * v);
    return mag * Math.cos(2 * Math.PI * v);
  }

  /**
   * A child stream. It depends only on this stream's seed and the name, never on how many numbers
   * were drawn, and it hashes just the short name instead of the whole path.
   */
  fork(name: string | number): Rng {
    const h = cyrb128(String(name));
    const w: [number, number, number, number] = [
      Math.imul(this.seed[0] ^ h[0], 2654435761) >>> 0,
      Math.imul(this.seed[1] ^ h[1], 2246822519) >>> 0,
      Math.imul(this.seed[2] ^ h[2], 3266489917) >>> 0,
      Math.imul(this.seed[3] ^ h[3], 668265263) >>> 0,
    ];
    if ((w[0] | w[1] | w[2] | w[3]) === 0) w[0] = 1;
    return new Rng(`${this.key}/${name}`, w);
  }
}
