// Deterministic noise shared by the mountain rings (mountains-a.mjs, mountains-b.mjs). Each ring keeps its own
// gradient table and hash constants, so the two variants stay different landscapes.

// Gradient noise (about -1…1) from an integer hash and a 256-entry gradient table. `phase` turns the table,
// `mix` holds the three hash multipliers and `shift` the last xor-shift.
export function createGradientNoise({ phase, mix: [mx, mz, mh], shift }) {
  const gradients = new Float32Array(512);
  for (let i = 0; i < 256; i++) {
    const a = (i / 256) * Math.PI * 2 + phase;
    gradients[i * 2] = Math.cos(a);
    gradients[i * 2 + 1] = Math.sin(a);
  }
  const corner = (x, z) => {
    let h = Math.imul(x, mx) ^ Math.imul(z, mz);
    h = Math.imul(h ^ (h >>> 15), mh);
    h ^= h >>> shift;
    return (h & 255) << 1;
  };
  return (x, z) => {
    const ix = Math.floor(x),
      iz = Math.floor(z),
      fx = x - ix,
      fz = z - iz,
      ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10),
      uz = fz * fz * fz * (fz * (fz * 6 - 15) + 10),
      a = corner(ix, iz),
      b = corner(ix + 1, iz),
      c = corner(ix, iz + 1),
      d = corner(ix + 1, iz + 1),
      ga = gradients[a] * fx + gradients[a + 1] * fz,
      gb = gradients[b] * (fx - 1) + gradients[b + 1] * fz,
      gc = gradients[c] * fx + gradients[c + 1] * (fz - 1),
      gd = gradients[d] * (fx - 1) + gradients[d + 1] * (fz - 1);
    return (ga + (gb - ga) * ux + (gc - ga) * uz + (ga - gb - gc + gd) * ux * uz) * 1.41;
  };
}

// Ridged multifractal (Musgrave) over `noise`: sharp crests, and each octave weighted by the one before, so
// detail gathers on ridges and valley floors stay smooth, as erosion leaves them. `fine` (0…1) fades the last
// octave where the grid is too coarse to carry it. About 0…1.
export function ridgedMultifractal(noise, x, z, octaves, lacunarity, gain, fine = 1) {
  let sum = 0,
    norm = 0,
    weight = 1,
    amp = 1,
    px = x,
    pz = z;
  for (let o = 0; o < octaves; o++) {
    let s = 1 - Math.abs(noise(px, pz));
    s *= s * weight;
    weight = Math.min(1, s * 2);
    sum += s * amp * (o === octaves - 1 ? fine : 1);
    norm += amp;
    // Rotate each octave so crests never line up with the noise lattice.
    const nx = (px * 0.8 - pz * 0.6) * lacunarity + 5.3;
    pz = (px * 0.6 + pz * 0.8) * lacunarity + 1.7;
    px = nx;
    amp *= gain;
  }
  return sum / norm;
}

export const smoothstep = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const wrapAngle = a => a - Math.PI * 2 * Math.round(a / (Math.PI * 2));
// Noise along a circle through the noise plane, so it closes on itself around the ring.
export function ringNoise(noise, angle, cycles, seed) {
  const r = cycles / (Math.PI * 2);
  return noise(Math.cos(angle) * r + seed * 13.7, Math.sin(angle) * r - seed * 7.3);
}
