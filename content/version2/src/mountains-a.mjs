// Mountain ring, variant A (preview: ?mountains=a): a real terrain heightfield on a polar grid around the garden.
// Massif and range masks are carved by domain-warped ridged multifractal noise and shaped like eroded terrain
// (wide valley floors, sharp crests, gentle talus feet). Two meshes share one material: a finer near ring and a
// coarser far ring that meet on a valley floor inside the cloud sea. The shader lights every pixel from the sun
// or moon and paints forest, meadow, rock and snow by height, slope and noise; the feet sink into the sea.
import {
  createGradientNoise,
  ridgedMultifractal,
  ringNoise as ringSample,
  smoothstep as smooth,
  wrapAngle
} from './terrain-noise.mjs';

// Polar grids: radius span (m), columns around the ring, rows across it (rows grow with the radius, so cells
// stay about as deep as they are wide at every distance).
export const GRID_A = {
  near: { inner: 230, outer: 400, columns: 1024, rows: 46 },
  far: { inner: 400, outer: 650, columns: 768, rows: 28 }
};

// Relief. Elevation e (m above the floor) = mask × (valley + ridge × ridged noise); the curve then flattens low
// ground (valley floors and talus feet) and steepens the tops.
export const SHAPE_A = {
  floor: -30,
  seaTop: -4,
  reference: 100,
  curve: 1.2,
  valley: 0.2,
  ridge: 1.1,
  // Ridged value kept at least this high around each massif's centre, so every massif has its summit.
  summit: 0.8,
  summitCore: 0.015,
  ridgeWavelength: 120,
  octaves: 5,
  lacunarity: 2.05,
  gain: 0.5,
  warp: 34,
  warpWavelength: 190,
  // Half-width (m) of the valley where the near and far grids meet, and the rim taper at both edges.
  seam: 16,
  rim: 26
};

// Dominant summits: [angle (rad, atan2(x, z)), radius (m), mask elevation (m), half-width along the ring (m),
// half-depth across it (m)].
export const MASSIFS_A = [
  [0.72, 330, 82, 140, 90],
  [0.18, 285, 62, 100, 65],
  [1.18, 300, 68, 120, 75],
  [0.45, 540, 86, 220, 110],
  [1.55, 480, 80, 200, 100],
  [2.05, 270, 60, 95, 60],
  [2.32, 330, 54, 100, 60],
  [2.78, 310, 80, 140, 85],
  [3.05, 560, 88, 230, 110],
  [4.05, 280, 56, 90, 55],
  [4.35, 320, 82, 140, 90],
  [4.75, 520, 84, 220, 110],
  [5.25, 290, 74, 130, 80],
  [5.75, 470, 86, 210, 105],
  [6.05, 300, 66, 100, 65]
];

// Long ranges of lesser peaks: [centre radius (m), wander (m), mask elevation (m), half-depth (m), breaks per
// ring (more = shorter ranges), seed].
export const RANGES_A = [
  [300, 30, 68, 50, 6, 1],
  [520, 45, 78, 75, 4, 2]
];

// Passes toward the low sun and moon: [angle, half-width (rad), depth 0…1]. The sunset sun and the night moon
// sit near 3.66 (backdrop.mjs); the clock-driven sun and moon rise near 2.3 and set near 3.98.
export const GAPS_A = [
  [3.66, 0.22, 1],
  [2.3, 0.14, 0.45],
  [3.98, 0.12, 0.4]
];

// Seasons: snow line and tree line (world y), colours (linear RGB) and the autumn share of gold and red woods.
export const SEASONS_A = {
  spring: {
    snow: 38,
    tree: 28,
    forest: [0.026, 0.05, 0.024],
    wood: [0.06, 0.11, 0.03],
    meadow: [0.085, 0.14, 0.035],
    autumn: 0
  },
  summer: {
    snow: 45,
    tree: 34,
    forest: [0.018, 0.048, 0.018],
    wood: [0.045, 0.08, 0.026],
    meadow: [0.085, 0.11, 0.04],
    autumn: 0
  },
  autumn: {
    snow: 42,
    tree: 30,
    forest: [0.024, 0.04, 0.022],
    wood: [0.2, 0.1, 0.02],
    meadow: [0.12, 0.095, 0.045],
    autumn: 1
  },
  winter: {
    snow: 30,
    tree: 28,
    forest: [0.02, 0.036, 0.024],
    wood: [0.05, 0.05, 0.045],
    meadow: [0.1, 0.1, 0.08],
    autumn: 0
  }
};
// Winter (setSnow 1) brings snow down to the sea and frosts the canopy.
export const WINTER_A = { snow: -6, frost: 1 };

// Light: direct and ambient strengths, the lowest sun and moon elevation used for shading (a sun below the
// horizon still grazes the summits), and the night moonlight share.
export const LIGHT_A = {
  sun: 1.35,
  sky: 0.5,
  bounce: 0.22,
  minSunY: 0.1,
  minMoonY: 0.35,
  moon: 0.3,
  nightSky: 0.16,
  // Share of a high sun's tint taken out of the direct light, so midday rock reads grey instead of beige.
  neutral: 0.4,
  // Low sun: world height below which slopes lie in the shadow of the ranges (sun elevation sin 0.12 or less),
  // fading out by sin 0.4.
  shadeLine: 24,
  lowSun: [0.12, 0.4]
};
// Far plane guard: vertices beyond `knee` metres from the camera slide toward it along their own view ray (the
// same pixel, a nearer depth) and never pass knee + span, inside the camera's far plane (680).
export const FAR_A = { knee: 560, span: 105 };
// Aerial perspective on this ring: up to fade[0] metres it keeps only `near` of the scene fog, full from fade[1],
// so the nearer ranges show their relief crisply while the far ones still recede (owner, 2026-10-27: "blurry").
export const HAZE_A = { near: 0.5, fade: [380, 640] };

// Deterministic gradient noise (about -1…1), this ring's own table and hash.
export const gradientNoise = createGradientNoise({
  phase: 0.37,
  mix: [0x27d4eb2d, 0x165667b1, 0x2c1b3c6d],
  shift: 12
});
// Ridged multifractal over gradientNoise (see terrain-noise.mjs). About 0…1.
export function ridgedNoise(x, z, octaves, lacunarity, gain, fine = 1) {
  return ridgedMultifractal(gradientNoise, x, z, octaves, lacunarity, gain, fine);
}
const ringNoise = (angle, cycles, seed) => ringSample(gradientNoise, angle, cycles, seed);

// Per-column terms that depend only on the angle: range centres and breaks, and the pass depth.
function columnTerms(angle) {
  let gap = 1;
  for (const [a, half, depth] of GAPS_A)
    gap *= 1 - depth * (1 - smooth(0.5, 1, Math.abs(wrapAngle(angle - a)) / half));
  const ranges = RANGES_A.map(([centre, wander, elevation, , cycles, seed]) => [
    centre + wander * ringNoise(angle, 4, seed + 3),
    elevation * (0.3 + 0.7 * smooth(-0.35, 0.35, ringNoise(angle, cycles, seed)))
  ]);
  return { gap, ranges };
}

// Erosion gullies: share of a flank's elevation they cut away, spacing along a range (m), the noise circle that
// sets how many couloirs ring a massif, and how fast they wander and branch on the way down.
export const GULLY_A = { depth: 0.3, spacing: 22, ribs: 1.6, stretch: 1.1 };
// 0 on a spur crest, up to about 1 in a gully: two octaves of |noise| on a circle (closes on itself) whose radius
// grows downslope, so gullies stay parallel-ish, fork and wander instead of running dead straight.
function gullies(angle, reach, seed) {
  const x = Math.cos(angle) * reach + seed,
    z = Math.sin(angle) * reach - seed,
    v = Math.abs(gradientNoise(x, z)) + 0.45 * Math.abs(gradientNoise(x * 2.1 + 9.2, z * 2.1 - 4.4));
  return Math.min(1, v * 1.15);
}

// Terrain height (world y) at one grid point.
export function terrainHeight(angle, radius, column = columnTerms(angle), split = GRID_A.near.outer) {
  const s = SHAPE_A,
    x = Math.sin(angle) * radius,
    z = Math.cos(angle) * radius;
  // Domain warp bends crests and massif outlines so they wander and branch instead of running straight or round.
  const w = 1 / s.warpWavelength,
    wx =
      x + s.warp * (gradientNoise(x * w, z * w) * 0.7 + gradientNoise(x * w * 2.1 + 3.1, z * w * 2.1) * 0.3),
    wz =
      z +
      s.warp *
        (gradientNoise(x * w + 17.3, z * w - 9.1) * 0.7 +
          gradientNoise(x * w * 2.1, z * w * 2.1 + 5.7) * 0.3),
    warpedAngle = Math.atan2(wx, wz),
    warpedRadius = Math.hypot(wx, wz);
  let mask = 0,
    summit = 0;
  const g = GULLY_A;
  RANGES_A.forEach(([, , , depth], j) => {
    const [centre, elevation] = column.ranges[j],
      across = (warpedRadius - centre) / depth,
      m = elevation * Math.exp(-across * across);
    if (m * 1.4 < mask || m < 2) return;
    // Gullies run down both flanks: noise squeezed along the ring, stretched across it.
    const reach = centre / g.spacing + Math.abs(across) * g.stretch,
      flank = smooth(0.15, 0.6, Math.abs(across)) * (1 - smooth(1.4, 2, Math.abs(across)));
    mask = Math.max(mask, m * (1 - g.depth * flank * gullies(warpedAngle, reach, j * 31.7)));
  });
  for (let n = 0; n < MASSIFS_A.length; n++) {
    const [a, r, elevation, width, depth] = MASSIFS_A[n],
      t = (wrapAngle(warpedAngle - a) * r) / width,
      d = (warpedRadius - r) / depth,
      q = t * t + d * d;
    if (q < 1) {
      const m = elevation * (1 - q) ** 1.25;
      summit = Math.max(summit, Math.exp(-q / s.summitCore));
      if (m <= mask) continue;
      // Spurs and couloirs radiate from the summit and branch on the way down; the top and the foot stay whole.
      const rho = Math.sqrt(q),
        flank = smooth(0.1, 0.35, rho) * (1 - smooth(0.7, 1, rho));
      mask = Math.max(
        mask,
        m * (1 - g.depth * flank * gullies(Math.atan2(d, t), g.ribs + rho * g.stretch, n * 7.3))
      );
    }
  }
  // The finest octave fades on the far grid, where cells are too deep to carry it.
  const fine = 1 - smooth(330, 470, radius),
    raw = ridgedNoise(wx / s.ridgeWavelength, wz / s.ridgeWavelength, s.octaves, s.lacunarity, s.gain, fine),
    ridge = raw + (Math.max(raw, s.summit) - raw) * summit;
  let e = mask * column.gap * (s.valley + s.ridge * ridge);
  e *= smooth(0, s.seam, Math.abs(radius - split));
  e *=
    smooth(GRID_A.near.inner, GRID_A.near.inner + s.rim, radius) *
    (1 - smooth(GRID_A.far.outer - s.rim, GRID_A.far.outer, radius));
  return s.floor + s.reference * (Math.max(0, e) / s.reference) ** s.curve;
}

// Builds one ring's arrays: positions, normals, terrain (cavity m, ambient occlusion) and a Uint32 index. The
// columns wrap (the last joins the first), so the ring has no seam.
export function buildRing({ inner, outer, columns, rows }) {
  const count = columns * (rows + 1),
    heights = new Float32Array(count),
    radii = new Float32Array(rows + 1),
    sines = new Float32Array(columns),
    cosines = new Float32Array(columns);
  for (let k = 0; k <= rows; k++) radii[k] = inner * (outer / inner) ** (k / rows);
  for (let i = 0; i < columns; i++) {
    const angle = (i / columns) * Math.PI * 2,
      terms = columnTerms(angle);
    sines[i] = Math.sin(angle);
    cosines[i] = Math.cos(angle);
    for (let k = 0; k <= rows; k++) heights[k * columns + i] = terrainHeight(angle, radii[k], terms);
  }
  const positions = new Float32Array(count * 3),
    normals = new Float32Array(count * 3),
    terrain = new Float32Array(count * 2);
  for (let k = 0; k <= rows; k++)
    for (let i = 0; i < columns; i++) {
      const v = k * columns + i;
      positions[v * 3] = sines[i] * radii[k];
      positions[v * 3 + 1] = heights[v];
      positions[v * 3 + 2] = cosines[i] * radii[k];
    }
  // Normals from central differences on the grid: across the ring (radial) × along it (tangential) points up.
  for (let k = 0; k <= rows; k++) {
    const k0 = Math.max(0, k - 1),
      k1 = Math.min(rows, k + 1);
    for (let i = 0; i < columns; i++) {
      const v = k * columns + i,
        l = k * columns + ((i + columns - 1) % columns),
        r = k * columns + ((i + 1) % columns),
        b = k0 * columns + i,
        f = k1 * columns + i,
        tx = positions[r * 3] - positions[l * 3],
        ty = positions[r * 3 + 1] - positions[l * 3 + 1],
        tz = positions[r * 3 + 2] - positions[l * 3 + 2],
        rx = positions[f * 3] - positions[b * 3],
        ry = positions[f * 3 + 1] - positions[b * 3 + 1],
        rz = positions[f * 3 + 2] - positions[b * 3 + 2];
      let nx = ry * tz - rz * ty,
        ny = rz * tx - rx * tz,
        nz = rx * ty - ry * tx;
      const length = Math.hypot(nx, ny, nz) || 1;
      nx /= length;
      ny /= length;
      nz /= length;
      normals[v * 3] = nx;
      normals[v * 3 + 1] = ny;
      normals[v * 3 + 2] = nz;
    }
  }
  // Cavity: height minus its local mean over about 12 m (positive on crests and spurs, negative in gullies and
  // valleys), from two box blurs along and across the ring. Occlusion darkens the hollows.
  const blur = new Float32Array(count),
    pass = new Float32Array(count);
  for (let k = 0; k <= rows; k++) {
    const reach = Math.max(1, Math.round(12 / ((radii[k] * Math.PI * 2) / columns)));
    for (let i = 0; i < columns; i++) {
      let sum = 0;
      for (let j = -reach; j <= reach; j++) sum += heights[k * columns + ((i + j + columns) % columns)];
      pass[k * columns + i] = sum / (reach * 2 + 1);
    }
  }
  for (let k = 0; k <= rows; k++) {
    const depth = radii[Math.min(rows, k + 1)] - radii[Math.max(0, k - 1)],
      reach = Math.max(1, Math.round(24 / Math.max(1, depth)));
    for (let i = 0; i < columns; i++) {
      let sum = 0,
        n = 0;
      for (let j = Math.max(0, k - reach); j <= Math.min(rows, k + reach); j++, n++)
        sum += pass[j * columns + i];
      blur[k * columns + i] = sum / n;
    }
  }
  for (let v = 0; v < count; v++) {
    const cavity = heights[v] - blur[v];
    terrain[v * 2] = cavity;
    terrain[v * 2 + 1] = Math.min(1, Math.max(0.35, 0.82 + cavity * 0.045));
  }
  const index = new Uint32Array(columns * rows * 6);
  let n = 0;
  for (let k = 0; k < rows; k++)
    for (let i = 0; i < columns; i++) {
      const a = k * columns + i,
        b = k * columns + ((i + 1) % columns),
        c = a + columns,
        d = b + columns;
      // Counter-clockwise seen from above, so the upper side is the front face.
      index[n++] = a;
      index[n++] = c;
      index[n++] = b;
      index[n++] = b;
      index[n++] = c;
      index[n++] = d;
    }
  return { positions, normals, terrain, index, heights, radii, columns, rows };
}

// Summits: grid points higher than everything within about 40 m along and 3 rows across the ring, and well
// above the cloud sea. World heights, highest first.
export function findPeaks(ring, minimum = SHAPE_A.seaTop + 12) {
  const { heights, radii, columns, rows } = ring,
    peaks = [];
  for (let k = 1; k < rows; k++) {
    const reach = Math.max(2, Math.round(40 / ((radii[k] * Math.PI * 2) / columns)));
    for (let i = 0; i < columns; i++) {
      const y = heights[k * columns + i];
      if (y < minimum) continue;
      let top = true;
      for (let kk = Math.max(0, k - 3); top && kk <= Math.min(rows, k + 3); kk++)
        for (let j = -reach; j <= reach; j++)
          if (heights[kk * columns + ((i + j + columns) % columns)] > y) {
            top = false;
            break;
          }
      if (top) peaks.push(Math.round(y * 10) / 10);
    }
  }
  return peaks.sort((a, b) => b - a);
}

export function buildTerrainA() {
  const started = typeof performance === 'undefined' ? Date.now() : performance.now(),
    near = buildRing(GRID_A.near),
    far = buildRing(GRID_A.far),
    ended = typeof performance === 'undefined' ? Date.now() : performance.now();
  return {
    near,
    far,
    peaks: [...findPeaks(near), ...findPeaks(far)].sort((a, b) => b - a),
    triangles: (near.index.length + far.index.length) / 3,
    ms: ended - started
  };
}

const VERTEX = /* glsl */ `
attribute vec2 terrain;
uniform float farKnee;
uniform float farSpan;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vTerrain;
varying float vDistance;
#include <fog_pars_vertex>
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vNormal = normal;
  vTerrain = terrain;
  vec3 ray = world.xyz - cameraPosition;
  float d = length(ray);
  vDistance = d;
  // Fog and the cloud sea see the true position.
  vec4 mvPosition = viewMatrix * world;
  #include <fog_vertex>
  // The far side of the ring slides along its view ray to stay inside the far plane (same pixel, nearer depth).
  float squeeze = d > farKnee ? (farKnee + farSpan * (1.0 - exp((farKnee - d) / farSpan))) / d : 1.0;
  gl_Position = projectionMatrix * (viewMatrix * vec4(cameraPosition + ray * squeeze, 1.0));
}`;

const FRAGMENT = /* glsl */ `
  uniform vec3 lightDir;
  uniform vec3 lightColor;
  uniform vec3 skyColor;
  uniform vec3 bounceColor;
  uniform vec3 forestColor;
  uniform vec3 woodColor;
  uniform vec3 meadowColor;
  uniform vec3 rockColor;
  uniform vec3 snowColor;
  uniform float treeLine;
  uniform float snowLine;
  uniform float autumn;
  uniform float frost;
  uniform float alpenglow;
  uniform float seaTop;
  uniform float shadeLine;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying vec2 vTerrain;
  varying float vDistance;
  #include <fog_pars_fragment>
  // Hash without Sine, David Hoskins (third-party-notices.txt).
  float mHash(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
  }
  // After Inigo Quilez, value noise with analytic derivatives (third-party-notices.txt).
  // 3D value noise (x) with its gradient (yzw). Solid noise, so steep faces are not smeared into vertical streaks
  // the way a ground-plane (xz) pattern is.
  vec4 mNoise(vec3 x) {
    vec3 i = floor(x), f = fract(x), u = f * f * (3.0 - 2.0 * f), du = 6.0 * f * (1.0 - f);
    float a = mHash(i), b = mHash(i + vec3(1.0, 0.0, 0.0)), c = mHash(i + vec3(0.0, 1.0, 0.0));
    float d = mHash(i + vec3(1.0, 1.0, 0.0)), e = mHash(i + vec3(0.0, 0.0, 1.0)),
        g = mHash(i + vec3(1.0, 0.0, 1.0));
    float h = mHash(i + vec3(0.0, 1.0, 1.0)), k = mHash(i + vec3(1.0, 1.0, 1.0));
    float k1 = b - a, k2 = c - a, k3 = e - a, k4 = a - b - c + d, k5 = a - c - e + h, k6 = a - b - e + g;
    float k7 = -a + b + c - d + e - g - h + k;
    return vec4(
    a + k1 * u.x + k2 * u.y + k3 * u.z + k4 * u.x * u.y + k5 * u.y * u.z + k6 * u.z * u.x +
        k7 * u.x * u.y * u.z,
    du * vec3(
    k1 + k4 * u.y + k6 * u.z + k7 * u.y * u.z,
    k2 + k5 * u.z + k4 * u.x + k7 * u.z * u.x,
    k3 + k6 * u.x + k5 * u.y + k7 * u.x * u.y
    )
    );
  }
  void main() {
    vec3 n = normalize(vNormal);
    // Ground covered by one pixel (m): an octave fades out before it gets small enough to shimmer, so the far ring
    // runs fewer octaves.
    float pixel = max(length(dFdx(vWorld)), length(dFdy(vWorld))) + 1e-4;
    // Four octaves of detail (38, 17, 7.5, 3.4 m): breakup for every material edge and the bump that roughens the
    // light; the finest is also the forest canopy.
    vec3 p = vWorld / 38.0;
    float freq = 1.0 / 38.0, amp = 0.5, detail = 0.0, canopy = 0.5, mid = 0.5;
    vec3 grad = vec3(0.0);
    // Two more octaves (1.5, 0.68 m) only where a pixel can hold them: rock grain and the cracks up close, their
    // bump halved so the faces turn rough, not noisy.
    float crackNoise = 0.0, micro = 0.0, crackWidth = 1.0;
    for (int o = 0; o < 6; o++) {
      float keep = 1.0 - smoothstep(0.2, 0.45, pixel * freq);
      if (keep <= 0.0) break;
      vec4 v = mNoise(p);
      detail += amp * keep * (v.x - 0.5);
      grad += amp * keep * v.yzw * freq;
      if (o == 1) mid = 0.5 + keep * (v.x - 0.5);
      if (o == 3) canopy = 0.5 + keep * (v.x - 0.5);
      if (o >= 4) grad -= 0.5 * amp * keep * v.yzw * freq;
      if (o == 4) {
        crackNoise = keep * (v.x - 0.5);
        crackWidth = fwidth(v.x);
      }
      if (o == 5) micro = keep * (v.x - 0.5);
      p = p * 2.23 + vec3(13.7, 5.1, 9.3);
      freq *= 2.23;
      amp *= 0.5;
    }
    float y = vWorld.y, cavity = vTerrain.x, occlusion = vTerrain.y;
    // Slope for the materials from the bumped normal, so cover breaks along the same small ribs that catch the
    // light; fine (crisp) breakup from the canopy octave keeps material edges sharp instead of blurred.
    vec3 nb = normalize(n - (grad - dot(grad, n) * n) * 9.0 + vec3(0.0, 1e-5, 0.0));
    float slope = 1.0 - mix(n.y, nb.y, 0.6), fine = canopy - 0.5;
    // Forest below a broken tree line on slopes it can hold, reaching higher up sheltered gullies.
    float tree = treeLine + detail * 16.0 - cavity * 0.8;
    float forest = (1.0 - smoothstep(tree - 1.0, tree + 1.0, y + fine * 8.0)) *
        (1.0 - smoothstep(0.5, 0.56, slope + detail * 0.25 + fine * 0.12));
    // Bare rock on steep faces and crests, and on everything well above the tree line.
    float rock = max(smoothstep(0.38, 0.48, slope + detail * 0.3 + fine * 0.12 + cavity * 0.012),
        smoothstep(tree + 6.0, tree + 20.0, y + detail * 14.0));
    rock *= 1.0 - forest;
    // Snow above a wind-broken line on slopes it can cling to: lower in gullies, blown off crests and steep faces.
    float line = snowLine + detail * 18.0 + cavity * 0.9;
    float snow = smoothstep(line - 1.0, line + 1.0, y + fine * 6.0);
    snow *= 1.0 - smoothstep(0.5, 0.56, slope - detail * 0.35 + fine * 0.18 + cavity * 0.012);
    // Albedo. Canopy: lit crowns and dark gaps; deciduous patches low down (gold and red in autumn).
    vec3 woods = forestColor;
    float broadleaf = smoothstep(0.45, 0.62, mid) * (1.0 - smoothstep(tree - 14.0, tree - 4.0, y));
    vec3 fall = mix(woodColor, vec3(0.17, 0.035, 0.018), smoothstep(0.55, 0.7, canopy) * autumn);
    woods = mix(woods, fall, broadleaf);
    woods *= 0.4 + 1.2 * smoothstep(0.3, 0.7, canopy);
    woods = mix(woods, snowColor * (0.35 + 0.5 * canopy), frost *
        (0.3 + 0.35 * smoothstep(0.4, 0.7, canopy)));
    vec3 meadow = meadowColor * (0.8 + 0.4 * mid);
    // Rock: cool grey, lighter on crests and spurs, darker down the gullies; faint broken bedding only on the
    // steepest faces; pale scree fans on the gentler, hollow ground below them.
    float faces = smoothstep(0.45, 0.65, slope);
    float strata = sin(y * 0.8 + detail * 14.0 + mid * 5.0) * smoothstep(0.45, 0.6, mid + detail);
    vec3 stone = rockColor * (0.85 + 0.5 * fine + 0.35 * (mid - 0.5) + 0.07 * strata * faces);
    // Dark cracks and ledges in crisp patches; crests lighter, gullies darker.
    // Ledges in a few crisp patches, and thin dark fractures along the 1.5 m noise's zero lines (widened, and dimmed
    // as much, by the footprint, so they never alias) instead of blotches of dried mud.
    stone *= 1.0 - 0.18 * smoothstep(0.12, 0.2, fine) * faces;
    float fracture = (1.0 - smoothstep(0.01, 0.035 + crackWidth * 1.5, abs(crackNoise))) *
        0.035 / (0.035 + crackWidth * 1.5);
    stone *= (1.0 - 0.5 * fracture * faces) * (0.93 + 0.28 * micro);
    stone *= clamp(1.0 + cavity * 0.08, 0.55, 1.4);
    float scree = smoothstep(0.2, 0.32, slope) * (1.0 - smoothstep(0.38, 0.5, slope)) *
        (1.0 - smoothstep(-2.0, 0.5, cavity));
    stone = mix(stone, rockColor * vec3(1.35, 1.3, 1.25), scree * 0.6);
    vec3 albedo = mix(meadow, woods, forest);
    albedo = mix(albedo, stone, rock);
    albedo = mix(albedo, snowColor * (0.92 + 0.16 * canopy), snow);
    // Bump: the detail gradient tilts the normal (rock most, snow least).
    // Stronger relief on the rock (owner, 2026-10-27: the ranges looked blurry from the garden).
    float bump = mix(mix(10.0, 19.0, rock), 5.0, snow);
    // Surface gradient of the detail tilts the normal.
    vec3 b = normalize(n - (grad - dot(grad, n) * n) * bump + vec3(0.0, 1e-5, 0.0));
    // Light: sun or moon from lightDir, sky from above, cloud-sea bounce from below; canopies wrap the light. A low
    // sun leaves the valleys in the shadow of the ranges and lights only the upper slopes and crests.
    float facing = dot(b, lightDir);
    float lit = smoothstep(shadeLine - 10.0, shadeLine + 10.0, y + cavity * 2.0 + detail * 10.0);
    float direct = mix(max(facing, 0.0), clamp(facing * 0.6 + 0.4, 0.0, 1.0) * 0.8, forest * 0.5) * lit;
    // The bright sky opposite the sun fills the faces turned away from it, so backlit slopes keep their modelling.
    vec3 fillDir = normalize(vec3(-lightDir.x, 0.6, -lightDir.z));
    vec3 ambient = skyColor * (0.4 + 0.4 * b.y + 0.8 * max(dot(b, fillDir), 0.0)) +
        bounceColor * (0.5 - 0.5 * b.y);
    vec3 color = albedo * (lightColor * direct + ambient * occlusion);
    // Alpenglow: sun-facing snow at sunset glows a little beyond plain diffuse light.
    color += snow * alpenglow * lightColor * max(facing, 0.0) * lit * 0.3;
    gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #ifdef USE_FOG
    // Valley mist rising off the cloud sea, in wisps, so the feet dissolve instead of ending at a line.
    float mist = 1.0 - smoothstep(seaTop - 4.0, seaTop + 9.0 + detail * 10.0, y);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor * 1.12 + vec3(0.045, 0.035, 0.05), mist * 0.5);
  #endif
  #ifdef USE_FOG
    vec3 beforeFog = gl_FragColor.rgb;
  #endif
  #include <fog_fragment>
  #ifdef USE_FOG
    gl_FragColor.rgb = mix(beforeFog, gl_FragColor.rgb,
        mix(${HAZE_A.near.toFixed(2)}, 1.0,
        smoothstep(${HAZE_A.fade[0].toFixed(1)}, ${HAZE_A.fade[1].toFixed(1)}, vDistance)));
  #endif
  }`;

export function createMountainsA(THREE, { scene, own, add, sunSide }) {
  const terrainData = buildTerrainA();
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      lightDir: { value: new THREE.Vector3(0, 0.6, -0.8) },
      lightColor: { value: new THREE.Color(1, 1, 1) },
      skyColor: { value: new THREE.Color(0.3, 0.32, 0.4) },
      bounceColor: { value: new THREE.Color(0.1, 0.1, 0.12) },
      forestColor: { value: new THREE.Color() },
      woodColor: { value: new THREE.Color() },
      meadowColor: { value: new THREE.Color() },
      rockColor: { value: new THREE.Color(0.105, 0.105, 0.108) },
      snowColor: { value: new THREE.Color(0.8, 0.84, 0.9) },
      treeLine: { value: 20 },
      snowLine: { value: 42 },
      autumn: { value: 0 },
      frost: { value: 0 },
      alpenglow: { value: 0 },
      seaTop: { value: SHAPE_A.seaTop },
      shadeLine: { value: -60 },
      farKnee: { value: FAR_A.knee },
      farSpan: { value: FAR_A.span }
    }
  ]);
  const material = own(
    new THREE.ShaderMaterial({ uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT, fog: true })
  );
  const meshes = [terrainData.near, terrainData.far].map(ring => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(ring.positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(ring.normals, 3));
    geometry.setAttribute('terrain', new THREE.BufferAttribute(ring.terrain, 2));
    geometry.setIndex(new THREE.BufferAttribute(ring.index, 1));
    geometry.computeBoundingSphere();
    const mesh = add(geometry, material);
    // Kept out of the static merge (it would de-index the grid) and drawn after the sky.
    mesh.userData.dynamic = true;
    mesh.name = 'mountains-a';
    return mesh;
  });
  let season = SEASONS_A.summer,
    snowLevel = 0;
  const u = uniforms;
  function applySeason() {
    u.forestColor.value.setRGB(...season.forest);
    u.woodColor.value.setRGB(...season.wood);
    u.meadowColor.value.setRGB(...season.meadow);
    u.treeLine.value = season.tree;
    u.snowLine.value = season.snow + (WINTER_A.snow - season.snow) * snowLevel;
    u.frost.value = WINTER_A.frost * snowLevel;
    u.autumn.value = season.autumn;
  }
  applySeason();
  const light = u.lightDir.value,
    neutral = new THREE.Color();
  return {
    meshes,
    material,
    setLight({ sunColor, sunStrength = 1, cloudColor, mountainColor, sunPosition }) {
      const day = Math.max(0, Math.min(1, sunStrength)),
        night = 1 - day;
      if (sunPosition) light.set(sunPosition.x, sunPosition.y, sunPosition.z);
      else light.copy(sunSide);
      light.normalize();
      const low =
        1 - Math.max(0, Math.min(1, (light.y - LIGHT_A.lowSun[0]) / (LIGHT_A.lowSun[1] - LIGHT_A.lowSun[0])));
      u.shadeLine.value = -60 + (LIGHT_A.shadeLine + 60) * low * day;
      // A sun or moon below the horizon still grazes the summits from just above it.
      light.y = Math.max(light.y, LIGHT_A.minSunY + (LIGHT_A.minMoonY - LIGHT_A.minSunY) * night);
      light.normalize();
      const tint = u.lightColor.value.copy(sunColor),
        grey = (tint.r + tint.g + tint.b) / 3;
      tint.lerp(neutral.setRGB(grey, grey, grey), LIGHT_A.neutral * day * (1 - low));
      tint.multiplyScalar(LIGHT_A.sun * day + LIGHT_A.moon * night);
      const fog = scene.fog?.color;
      u.skyColor.value
        .copy(fog || mountainColor)
        .lerp(mountainColor, 0.45)
        .multiplyScalar(LIGHT_A.sky * day + LIGHT_A.nightSky * night);
      u.bounceColor.value.copy(cloudColor).multiplyScalar(LIGHT_A.bounce * (0.3 + 0.7 * day));
      // Alpenglow only for a warm, low sun.
      u.alpenglow.value =
        day *
        Math.max(0, Math.min(1, (sunColor.r - sunColor.b) * 2.5)) *
        (1 - Math.min(1, Math.max(0, light.y - 0.2) * 3));
    },
    setSnow(level) {
      snowLevel = Math.max(0, Math.min(1, level || 0));
      applySeason();
    },
    setSeason(name) {
      season = SEASONS_A[name] || SEASONS_A.summer;
      applySeason();
    },
    update() {},
    audit: () => ({
      variant: 'a',
      peaks: terrainData.peaks.slice(0, 24),
      triangles: terrainData.triangles,
      drawCalls: meshes.length,
      buildMs: Math.round(terrainData.ms)
    })
  };
}
