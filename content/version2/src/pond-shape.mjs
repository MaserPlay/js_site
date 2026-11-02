// The look of a pond: its outline, the polygon of water that covers it, and how its stones lie.
//
// Every pond used to be the same ellipse: a six-row lens of water with straight edges (eleven corners) lying on the grass on
// the scenery islands, and a 32-gon stone curb on the project islands, with seven equal flat stones and two equal boulders on
// it. Now each pond has its own outline: the basin ellipse (unit radius, as in world.mjs lakeBasin) bent by three low
// harmonics whose phases come from the pond's seed. It is never larger than the ellipse (so the footprint pond-site.mjs
// keeps clear stays valid), and it is smooth: the water shader cuts the surface along the same curve, and the curb of the
// project islands and the snow hole are built on it.
export const POND_SHAPE = {
  // radius of the outline in basin ellipse units: base - sum(amplitude * cos(k * angle + phase)); angle from the outlet
  base: 0.91,
  // [k, amplitude, seed scale, seed offset]: phase = 2 pi * fract(seed * scale + offset), the same in the shader
  harmonics: [
    [2, 0.045, 1, 0.13],
    [3, 0.028, 2.7, 0.51],
    [5, 0.016, 4.3, 0.77]
  ],
  // lens vertices per side (rows 1..5 of the water mesh), the last one this far from the outlet axis (radians): about the old row 5, no wider than the channel
  lensEnd: 0.35,
  // how far the lens reaches past the outline: tight under a curb, a soft wet bank where the water lies on the lawn
  reach: { ringed: 0.012, open: 0.16 }
};
const TAU = Math.PI * 2;
const fract = v => v - Math.floor(v);

// A pond's seed (0..1) from its index among the falls; no random numbers are drawn, so the scenery is unchanged.
export const pondSeed = index => Math.fround(fract(index * 0.6180339887 + 0.137));

const phaseCache = new Map();
export function pondPhases(seed) {
  let phases = phaseCache.get(seed);
  if (!phases) {
    const s = Math.fround(seed);
    phases = POND_SHAPE.harmonics.map(
      ([, , scale, offset]) => TAU * fract(Math.fround(Math.fround(s * scale) + offset))
    );
    phaseCache.set(seed, phases);
  }
  return phases;
}

// Outline radius (basin ellipse units, 1 = the ellipse) at `theta` radians from the outlet direction towards +across.
export function pondRadius(theta, seed) {
  const phases = pondPhases(seed);
  let r = POND_SHAPE.base;
  POND_SHAPE.harmonics.forEach(([k, a], i) => {
    r -= a * Math.cos(k * theta + phases[i]);
  });
  return r;
}

// The same outline as a GLSL function of the basin coordinates (x across, y along the flow), without atan.
export const POND_EDGE_GLSL = (() => {
  const [[, a2], [, a3], [, a5]] = POND_SHAPE.harmonics,
    f = v => v.toFixed(4),
    scales = POND_SHAPE.harmonics.map(h => f(h[2])).join(','),
    offsets = POND_SHAPE.harmonics.map(h => f(h[3])).join(',');
  return `float pondEdge(vec2 p,float seed){
      vec2 z=normalize(p+vec2(1e-5,0.));
      z=vec2(z.y,z.x);
      vec2 z2=vec2(z.x*z.x-z.y*z.y,2.*z.x*z.y),z3=vec2(z2.x*z.x-z2.y*z.y,z2.x*z.y+z2.y*z.x),
          z5=vec2(z3.x*z2.x-z3.y*z2.y,z3.x*z2.y+z3.y*z2.x);
      vec3 ph=${f(TAU)}*fract(seed*vec3(${scales})+vec3(${offsets}));
      return ${f(POND_SHAPE.base)}-${f(a2)}*(z2.x*cos(ph.x)-z2.y*sin(ph.x))-${f(a3)}*
          (z3.x*cos(ph.y)-z3.y*sin(ph.y))-${f(a5)}*(z5.x*cos(ph.z)-z5.y*sin(ph.z));
    }`;
})();

// A chain vertex is { a: angle from the outlet (signed: + right, - left), rho: radius in basin ellipse units }.
const vertexPoint = v => [v.rho * Math.sin(v.a), v.rho * Math.cos(v.a)];
// Distance from the centre to the segment v-w along the direction `a`.
function segmentRadius(v, w, a) {
  const [x0, y0] = vertexPoint(v),
    [x1, y1] = vertexPoint(w),
    det = Math.sin(a) * (y1 - y0) - Math.cos(a) * (x1 - x0);
  return Math.abs(det) < 1e-9 ? Infinity : Math.abs(((x1 - x0) * y0 - (y1 - y0) * x0) / det);
}
// Pushes the chain's vertices out, 1.2 % at a time, until every segment lies beyond the outline (times 1 + reach).
function growChain(chain, seed, reach) {
  for (let pass = 0; pass < 80; pass++) {
    let grown = false;
    for (let j = 0; j + 1 < chain.length; j++)
      for (let n = 0; n <= 12; n++) {
        const a = chain[j].a + ((chain[j + 1].a - chain[j].a) * n) / 12;
        if (segmentRadius(chain[j], chain[j + 1], a) < pondRadius(a, seed) * (1 + reach)) {
          chain[j].rho *= 1.012;
          chain[j + 1].rho *= 1.012;
          grown = true;
        }
      }
    if (!grown) return;
  }
}

// The water lens: the polygon of rows 0..5 of the fall mesh, in basin ellipse units (x across, y along the flow). The apex
// is row 0; rows 1..5 have a left (x < 0) and a right vertex each, at equal angle steps round the upstream half of the pond.
// Every vertex is pushed out until the polygon encloses the pond's outline (plus `reach`), so the shader's smooth cut, not a
// polygon edge, makes the shore. Returns { apex, left: [5], right: [5] }.
export function pondLens(seed, ringed = true) {
  const reach = ringed ? POND_SHAPE.reach.ringed : POND_SHAPE.reach.open,
    step = (Math.PI - POND_SHAPE.lensEnd) / 5,
    // polygon vertices, apex first; side +1 is the right (+across) chain, -1 the left
    chain = side =>
      Array.from({ length: 6 }, (_, j) => {
        const a = side * (Math.PI - j * step);
        return { a, rho: ((pondRadius(a, seed) * (1 + reach)) / Math.cos(step / 2)) * 0.97 };
      }),
    [right, left] = [chain(1), chain(-1)];
  growChain(right, seed, reach);
  growChain(left, seed, reach);
  // the apex is shared: both chains agree on its distance
  return {
    apex: [0, -Math.max(right[0].rho, left[0].rho)],
    left: left.slice(1).map(vertexPoint),
    right: right.slice(1).map(vertexPoint)
  };
}

// Rim stones of one pond. Each is { theta, out, scale: [x, y, z], yaw, pitch, roll, sink }: `theta` from the outlet direction
// (seven stones round the upstream half and the flanks), `out` the stone's centre beyond the pond outline in metres, and `sink`
// how deep it lies in the ground as a share of its height. The sizes run from large to small in a fixed order that the seed
// turns round the pond, so every pond has a big rock next to a small one and no string of equal beads. Deterministic.
export function rimStones(seed) {
  const h = (n, k) => fract(Math.sin((seed + 0.37) * 91.7 * (n + 1) + k * 12.9898) * 43758.5453),
    classes = [0.36, 0.17, 0.26, 0.15, 0.31, 0.2, 0.24],
    turn = Math.floor(h(0, 1) * classes.length);
  return classes.map((_, n) => {
    const size = classes[(n + turn) % classes.length] * (0.95 + 0.1 * h(n, 3)),
      flat = 0.62 + 0.25 * h(n, 4);
    return {
      theta: (0.35 + (n / 6) * 1.3 + (h(n, 5) - 0.5) * 0.08) * Math.PI,
      out: 0.1 + 0.2 * h(n, 6) + size * 0.35,
      scale: [size * (0.95 + 0.15 * h(n, 7)), size * flat, size * (1 + 0.3 * h(n, 8))],
      yaw: h(n, 9) * TAU,
      pitch: (h(n, 10) - 0.5) * 0.3,
      roll: (h(n, 11) - 0.5) * 0.3,
      sink: 0.2 + 0.25 * h(n, 12)
    };
  });
}
