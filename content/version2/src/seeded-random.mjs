// Small deterministic random streams (0 <= value < 1), so every build draws the same scenery.

// Park–Miller minimal standard generator from a raw state (1 … 2^31 - 2).
export function parkMiller(state) {
  let s = state;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}
// Park–Miller from any number: the seed is folded into the valid state range first.
export const parkMillerStream = seed => parkMiller((Math.floor(Math.abs(seed)) % 2147483646) + 1);

// 32-bit linear congruential generator (Numerical Recipes constants).
export function lcg32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// mulberry32: a fast 32-bit generator with good spread for small seeds.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
