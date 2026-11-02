// Living sky around the garden: drifting hot-air balloons and bird flocks.
// Contract used by garden.mjs; the scene placement follows the current world's ring and scenery.
// THREE is injected (never imported) so node tests drive the same module with the npm package.
import { mulberry32 } from './seeded-random.mjs';
// Explicit review opt-in for all decorative balloons, including the station spare.
// Read once at module load; passenger geometry and normal visits retain original buffers.
export const resolveRimReview = search => new URLSearchParams(search).get('rimReview') === 'candidate';
const RIM_REVIEW = resolveRimReview(
  typeof globalThis.location?.search === 'string' ? globalThis.location.search : ''
);
// Drifting balloons' flame form (round 5: the far flames read as cut gems): 'lathe12' (twelve sides, the default since
// the owner asked for more detail: +48 triangles a flame, +0.05% of a frame, no change in the measured GPU time),
// 'lathe' (the old six sides) or 'cross' (three crossed quads with the tongue drawn per pixel, the fewest
// triangles). ?flame=lathe|cross for comparison.
export const resolveFlameForm = search => {
  const form = new URLSearchParams(search).get('flame');
  return form === 'lathe' || form === 'cross' ? form : 'lathe12';
};
const FLAME_FORM = resolveFlameForm(
  typeof globalThis.location?.search === 'string' ? globalThis.location.search : ''
);
// The 'cross' tongue: three vertical quads 60 degrees apart, each 2 * half wide and `height` high, carrying across
// (-1..1) for the per-pixel tongue (the lathe's outline: widest a third of the way up, pointed at the tip).
export const FLAME_CROSS = { half: 0.24, height: 1.3 };
function crossFlameGeometry(THREE) {
  const positions = [],
    across = [],
    index = [];
  for (let k = 0; k < 3; k++) {
    const q = new THREE.PlaneGeometry(FLAME_CROSS.half * 2, FLAME_CROSS.height, 1, 6);
    q.translate(0, FLAME_CROSS.height / 2, 0);
    q.rotateY((k * Math.PI) / 3);
    const base = positions.length / 3,
      uv = q.attributes.uv;
    positions.push(...q.attributes.position.array);
    for (let i = 0; i < uv.count; i++) across.push(uv.getX(i) * 2 - 1);
    for (const i of q.index.array) index.push(base + i);
    q.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('flameAcross', new THREE.Float32BufferAttribute(across, 1));
  // The basic material reads a normal; the crossed quads use none (the tongue is drawn per pixel).
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(positions.length), 3));
  g.setIndex(index);
  return g;
}
const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const fract = x => x - Math.floor(x);

// garden.mjs overviewPose(): the default desktop camera looks at the centre from azimuth atan2(2.15,2.65)
// (mobile atan2(2.5,3.8)). Balloons and flocks live on the far side and the flanks, never between that
// pose and the garden; the user can still orbit round to them.
export const OVERVIEW_AZIMUTH = Math.atan2(2.15, 2.65);
const FAR_SIDE = OVERVIEW_AZIMUTH + Math.PI;

// Keep-out model, in metres of horizontal distance from the garden centre. Ring slots vary up to 1.24×radius,
// project islands sit 10.2 m beyond the route with rims up to ~23 m; scenic islands are centred 82–169 m
// (+scenicPush) with rims up to ~16 m and tops ≤ 14 m plus trees; mountain ridges start ~340 m out.
export function skyClearance(radius = 23, scenicPush = 0) {
  return {
    ring: radius + 18,
    ringTop: 25,
    projectReach: radius * 1.24 + 33.5,
    projectTop: 28,
    scenicInner: 66 + scenicPush,
    scenicOuter: 185 + scenicPush,
    scenicTop: 26,
    farLimit: 300,
    birdInner: radius + 20,
    // Out to 140 m beyond the ring (round 16, owner: the routes all looked alike): every flock had flown the same
    // 45-115 m horseshoe. The birds keep above the scenic tops (birdLow + 6 m); the mountains start ~340 m out.
    birdOuter: radius + 140,
    birdLow: 20,
    birdHigh: 70
  };
}

// Balloon slots, by azimuth relative to the far side of the default overview. The first two are the economy pair.
// 'beyond' balloons float past the outer scenic rim, low enough to show in the overview's sky band;
// 'above' balloons cross the scenic ring well clear of every island top and dominate the journey views.
const BALLOONS = [
  {
    lane: 'beyond',
    az: -0.36,
    y: 18,
    scale: 1.35,
    palette: 0,
    banner: false,
    loop: [13, 6],
    period: 118,
    extra: 0
  },
  {
    lane: 'beyond',
    az: 0.44,
    y: 21,
    scale: 1.2,
    palette: 1,
    banner: true,
    loop: [12, 5],
    period: 132,
    extra: 4
  },
  {
    lane: 'above',
    az: 0,
    into: 0.45,
    y: 47,
    scale: 1.15,
    palette: 2,
    banner: false,
    loop: [11, 6],
    period: 104
  },
  {
    lane: 'beyond',
    az: -1.02,
    y: 27,
    scale: 1.3,
    palette: 3,
    banner: false,
    loop: [14, 6],
    period: 146,
    extra: 8
  },
  {
    lane: 'above',
    az: -1.74,
    into: 0.2,
    y: 54,
    scale: 1.1,
    palette: 4,
    banner: true,
    loop: [10, 5],
    period: 96
  },
  {
    lane: 'above',
    az: 1.92,
    into: 0.7,
    y: 44,
    scale: 1.25,
    palette: 5,
    banner: false,
    loop: [12, 6],
    period: 124
  }
];
// With a balloon station (the observatory preview) one 'above' balloon starts from its launch mast, climbs
// straight up well clear of the garden, drifts out to its slot, loops there and comes back to the mast.
// Seconds into the cycle: docked, climbing, out to the slot, free, back over the mast, settling onto it.
export const STATION_CYCLE = {
  balloon: 2,
  dock: 40,
  rise: 72,
  out: 110,
  free: 175,
  back: 213,
  period: 245,
  // The climb ends this far above the mast and this far further out, so it never crosses the tour.
  climb: 30,
  outward: 6,
  // Seconds into the cycle at sim time 0: a visitor sees the first launch soon after arriving.
  offset: 22,
  bob: 0.12
};
const ECONOMY_BALLOONS = 2,
  BOB = 1.8;
// Sunset-friendly envelopes: cream, coral, violet and teal gores with an accent band and a crown.
const PALETTES = [
  { gores: [0xff7c6a, 0xf6e6cf], accent: 0x9a62c4, crown: 0x9a62c4, skirt: 0x3a2a4c, offset: false },
  {
    gores: [0x2f9aa0, 0xf3e4c8, 0xef8a6a, 0xf3e4c8],
    accent: 0xf2bf62,
    crown: 0x2f9aa0,
    skirt: 0x2c3448,
    offset: false
  },
  { gores: [0x7a5bc6, 0xd2bdf2], accent: 0xff8f72, crown: 0xf6ead6, skirt: 0x34284a, offset: true },
  {
    gores: [0xf2705f, 0xff9a6e, 0xffc27a, 0xffe3a6, 0x5fb7a8, 0x3f8fa5, 0x7c63c8, 0xd472a8],
    accent: 0xf7ecd9,
    crown: 0xf7ecd9,
    skirt: 0x3a2c48,
    offset: false
  },
  { gores: [0xee8fb2, 0x5d3a7a], accent: 0xf5e8d4, crown: 0x5d3a7a, skirt: 0x2e2340, offset: true },
  { gores: [0x2b8e98, 0xf4ead8], accent: 0xff7f6b, crown: 0xff7f6b, skirt: 0x23323f, offset: false }
];
// Flocks: up to 15 birds each; winter keeps one small flock, night sends them to roost.
const FLOCK_SIZES = { spring: [12, 8, 10], summer: [13, 9, 11], autumn: [15, 12, 14], winter: [7, 0, 0] };
const MAX_FLOCK = 15,
  FLOCKS = 3,
  MAX_BIRDS = MAX_FLOCK * FLOCKS,
  FLOCK_ARC = 2.15;
// Each flock cruises at its own speed within its own altitude band (metres) and picks its chords within its own
// reach of the bird shell (0 its inner edge, 1 its outer): one keeps near the islands, one to the middle distance,
// one far out. Bands and reaches overlap, so the flocks still meet and cross now and then.
const FLOCK_STYLE = [
  { speed: 8.5, band: [27, 44], scale: 0.95, reach: [0, 0.3] },
  { speed: 9.5, band: [33, 54], scale: 1, reach: [0.35, 0.65] },
  { speed: 7.5, band: [41, 63], scale: 1.12, reach: [0.7, 1] }
];
// Leader routes. A flock flies one leg at a time and every leg is a different shape from the one before:
// SOAR circles on a thermal and climbs, CROSS flies a straight chord to a point on the far arc, SWAY flies
// such a chord weaving gently left and right. Flap and glide durations follow the shape (per mode).
// Leg shapes by index: SOAR 0, CROSS 1 (the plain chord, never named in code), SWAY 2.
const SOAR = 0,
  SWAY = 2;
const LEG_FLAP = new Float64Array([0.5, 1.5, 1]),
  LEG_GLIDE = new Float64Array([2.2, 0.55, 1]),
  LEG_SPEED = new Float64Array([0.85, 1.15, 1]);
// Leaders turn at most MAX_TURN rad/s, look LOOK_AHEAD s ahead and keep ZONE_PAD m inside the bird shell;
// FLOCK_EXTENT is the radius (m) of the sphere that bounds a flock round its leader.
const MAX_TURN = 0.65,
  LOOK_AHEAD = 3.0,
  ZONE_PAD = 8,
  FLOCK_EXTENT = 24;
// needsAnimation(): flocks and moving balloons in view want every frame. A drifting balloon covers about 0.2 m per
// 85 ms idle tick, which is still 2-3 px at 160 m on a 1920 px screen: past the old 160 m range it stepped at 12 fps
// and turned smooth once a camera turn brought it closer (owner, round 5). Any moving balloon in view now counts.
const BIRD_RANGE = 320,
  BALLOON_RANGE = 1000;

// Envelope profile (scale 1): conical lower half into a slightly flattened crown, 16 puffed gores.
const ENV = { R: 4.6, yc: 0.9, throatR: 1.1, throatY: -5.5, crown: 0.96, gores: 16, sub: 2, bulge: 0.035 };
const FLAME_Y = -6.6;
const lowerRow = s => ({
  r: ENV.throatR + (ENV.R - ENV.throatR) * (1 - Math.pow(1 - s, 1.8)),
  y: ENV.throatY + (ENV.yc - ENV.throatY) * s,
  dr: (ENV.R - ENV.throatR) * 1.8 * Math.pow(1 - s, 0.8),
  dy: ENV.yc - ENV.throatY
});
const upperRow = p => ({
  r: Math.max(0, ENV.R * Math.cos(p)),
  y: ENV.yc + ENV.R * ENV.crown * Math.sin(p),
  dr: -ENV.R * Math.sin(p),
  dy: ENV.R * ENV.crown * Math.cos(p)
});
const PROFILE = [
  [
    { r: 1, y: -6.15, dr: 0.1, dy: 0.65 },
    { r: 1.1, y: -5.5, dr: 0.1, dy: 0.65 }
  ].map(row => ({ ...row, band: 'skirt' })),
  [0, 0.12, 0.25, 0.4, 0.55, 0.7, 0.85, 1].map(s => ({ ...lowerRow(s), band: 'lower' })),
  [0, 0.17].map(p => ({ ...upperRow(p), band: 'accent' })),
  [0.17, 0.36, 0.56, 0.76, 0.96, 1.14].map(p => ({ ...upperRow(p), band: 'upper' })),
  [1.14, 1.32, 1.47, Math.PI / 2].map(p => ({ ...upperRow(p), band: 'crown' }))
];
const ENV_TOP = ENV.yc + ENV.R * ENV.crown;
// Basket rim, load ring and the bottom of the solid basket, in local units.
const BASKET_RIM_Y = -7.55,
  RING_Y = -6.15;
export const DEFAULT_BALLOON_BASKET = Object.freeze({ half: 0.88, depth: 0.82, drop: 1.1 });
// Burner nozzle profiles (radius, height): the open basket's can, collar and lip, and a plain cone for the far ones.
// The lip's recess ends in the seat at FLAME_Y where the flame root sits (sky-island.mjs).
const NOZZLE = [
    [0.07, -6.8],
    [0.12, -6.8],
    [0.13, -6.77],
    [0.13, -6.7],
    [0.115, -6.66],
    [0.12, -6.63],
    [0.135, FLAME_Y + 0.015],
    [0.105, FLAME_Y + 0.015],
    [0.105, FLAME_Y],
    [0.06, FLAME_Y],
    [0.065, -6.73]
  ],
  NOZZLE_FAR = [
    [0.065, -6.8],
    [0.14, FLAME_Y + 0.015],
    [0.105, FLAME_Y + 0.015]
  ];
const SOLID_FLOOR = BASKET_RIM_Y - DEFAULT_BALLOON_BASKET.drop - DEFAULT_BALLOON_BASKET.depth;
// Passenger basket: stake spacing and strand height of the weave, how far the strands bow (normal tilt), the
// padded rim roll (half-width, half-height, quilted pieces per side), and where along a side its ropes tie on
// (fraction of the half-width).
const WEAVE = { stake: 0.1, strand: 0.07, bow: 0.55, pad: { width: 0.075, height: 0.06, quilts: 7 } },
  BASKET_ROPE_SIDE = 0.55;

// Shader patches only use sin/cos/clamp/min/max: nothing that can turn into NaN for the bloom pass.
export const BALLOON_VERTEX =
  '#include <begin_vertex>\n\tvSkyGlow = clamp( skyGlow, 0.0, 1.0 ); vSkyWicker = skyWicker; vWickerPosition = position; vWickerNormal = normal;';
export const BALLOON_FRAGMENT = `#include <emissivemap_fragment>
    totalEmissiveRadiance *= mix( vec3( 0.55 ), clamp( vColor.rgb, 0.0, 1.0 ), 0.65 ) * vSkyGlow;
    if (vSkyWicker > 2.5) {
      // The open basket's floor (round 13, owner: one flat colour): boards across it with dark seams, a little grain
      // and a leather binding along the foot of the walls.
      float board = vWickerPosition.z * 7.5;
      float seam = smoothstep(0.42, 0.5, abs(fract(board) - 0.5));
      float grain = 0.5 + 0.5 * cos(vWickerPosition.x * 40.0 + floor(board) * 2.3);
      float binding = smoothstep(0.74, 0.77, max(abs(vWickerPosition.x), abs(vWickerPosition.z)));
      diffuseColor.rgb *= (0.88 + 0.08 * grain + 0.08 * fract(floor(board) * 0.618)) * (1.0 - 0.5 * seam);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.19, 0.085, 0.04), binding * 0.85);
    } else if (vSkyWicker > 0.5) {
      float u = abs(vWickerNormal.x) > 0.5 ? vWickerPosition.z : vWickerPosition.x;
      float row = floor((vWickerPosition.y + 8.68) * 14.0);
      float weft = 0.5 + 0.5 * cos((vWickerPosition.y + 8.68) * 87.9646);
      float crossing = 0.5 + 0.5 * cos(u * 62.8319 + mod(row, 2.0) * 3.14159);
      // Reduce fine contrast when the weave falls below the screen pixel footprint.
      float detail = 1.0 - smoothstep(0.25, 1.0, max(fwidth(u * 10.0), fwidth(vWickerPosition.y * 14.0)));
      // Round 5 (owner: the baskets looked soapy): deeper gaps between the strands and the stakes.
      diffuseColor.rgb *= mix(0.86, 0.62 + 0.28 * weft + 0.14 * crossing, detail);
      if (vSkyWicker > 1.5) {
        // Far walls (DEFAULT_BALLOON_BASKET, rim at y -8.65, depth 0.82): leather corner posts and a strap round the
        // middle, painted so the far baskets match the open one at no extra triangles (round 5).
        float post = smoothstep(0.80, 0.83, abs(u));
        float strap = 1.0 - smoothstep(0.022, 0.032, abs(vWickerPosition.y + 9.06));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.19, 0.085, 0.04), max(post, strap) * 0.85);
      }
    }`;
export const BIRD_VERTEX = `vec3 transformed = vec3( position );
if (birdPart > 0.5 && birdPart < 1.5) {
	float birdSide = position.x < 0.0 ? -1.0 : 1.0;
	float birdReach = abs( position.x );
	float birdSpan = max( birdReach - 0.08, 0.0 );
	float birdInner = min( birdSpan, 0.36 );
	float birdOuter = birdSpan - birdInner;
	float birdAmp = clamp( birdFlap.y, 0.0, 1.2 );
	float birdA1 = birdAmp * sin( birdFlap.x ) * 0.78 + 0.1;
	float birdA2 = birdA1 + birdAmp * sin( birdFlap.x - 0.9 ) * 0.55 - 0.05;
	transformed.x = birdSide * ( min( birdReach, 0.08 ) + birdInner * cos( birdA1 ) + birdOuter * cos( birdA2 ) );
	float localAngle = birdOuter > 0.0 ? birdA2 : birdA1;
  transformed.x -= birdSide * position.y * sin(localAngle);
  transformed.y = position.y * cos(localAngle) + birdInner * sin(birdA1) + birdOuter * sin(birdA2);
}`;

// Compact dark passerine proportions informed by Cornell's bird anatomy and size/shape guide.
// Both levels are closed solids; close detail uses a continuous breast/neck/head loft.
export function createBirdGeometry(THREE, detail = false) {
  const p = [],
    colors = [],
    part = [];
  const base = new THREE.Color(0x2a2034).toArray();
  function solid(vertices, faces, tag, tint = base) {
    const centre = [0, 1, 2].map(c => vertices.reduce((s, v) => s + v[c], 0) / vertices.length);
    for (const ids of faces) {
      const points = ids.map(i => vertices[i]),
        a = points[0],
        b = points[1],
        c = points[2];
      const u = b.map((v, i) => v - a[i]),
        v = c.map((n, i) => n - a[i]);
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      if (n.reduce((s, x, i) => s + x * (a[i] - centre[i]), 0) < 0) points.reverse();
      for (const point of points) {
        p.push(...point);
        part.push(tag);
        // A continuous muted back/belly gradient, independent of triangle orientation.
        const shade = 1.03 - 0.1 * Math.max(-1, Math.min(1, point[1] / 0.12));
        colors.push(...tint.map(x => x * shade));
      }
    }
  }
  function loft(rings, tag, tint = base) {
    const vertices = rings.flat(),
      n = rings[0].length,
      faces = [];
    for (let r = 0; r < rings.length - 1; r++)
      for (let j = 0; j < n; j++) {
        const a = r * n + j,
          b = r * n + ((j + 1) % n),
          c = b + n,
          d = a + n;
        faces.push([a, b, c], [a, c, d]);
      }
    for (let j = 1; j < n - 1; j++)
      faces.push(
        [0, j + 1, j],
        [(rings.length - 1) * n, (rings.length - 1) * n + j, (rings.length - 1) * n + j + 1]
      );
    solid(vertices, faces, tag, tint);
  }
  const profile = detail
    ? [
        [-0.29, 0, 0.045, 0.045],
        [-0.13, 0, 0.1, 0.1],
        [0.04, 0.015, 0.11, 0.115],
        [0.18, 0.075, 0.075, 0.07],
        [0.29, 0.1, 0.078, 0.08],
        [0.36, 0.09, 0.045, 0.045]
      ]
    : [
        [-0.29, 0, 0.045, 0.045],
        [0, 0.015, 0.11, 0.115],
        [0.31, 0.09, 0.07, 0.07]
      ];
  const segments = detail ? 6 : 4;
  loft(
    profile.map(([z, y, w, h]) =>
      Array.from({ length: segments }, (_, i) => {
        const a = ((i + 0.5) * TAU) / segments;
        return [w * Math.cos(a), y + h * Math.sin(a), z];
      })
    ),
    0
  );
  for (const side of [-1, 1]) {
    if (detail) {
      const stations = [
        [0.045, 0.12, -0.12, 0.035],
        [0.24, 0.18, -0.2, 0.047],
        [0.44, 0.14, -0.2, 0.035],
        [0.7, 0.03, -0.17, 0.018]
      ];
      const rings = stations.map(([x, front, back, h]) => [
        [side * x, 0, front],
        [side * x, h, (front + back) / 2],
        [side * x, 0, back],
        [side * x, -h, (front + back) / 2]
      ]);
      const vertices = rings.flat(),
        faces = [];
      for (let r = 0; r < 3; r++)
        for (let j = 0; j < 4; j++) {
          const a = r * 4 + j,
            b = r * 4 + ((j + 1) % 4);
          faces.push([a, b, b + 4], [a, b + 4, a + 4]);
        }
      faces.push([0, 2, 1], [0, 3, 2]);
      vertices.push([side * 0.92, 0, -0.1]);
      for (let j = 0; j < 4; j++) faces.push([12 + j, 12 + ((j + 1) % 4), 16]);
      solid(vertices, faces, 1);
    } else {
      solid(
        [
          [side * 0.045, 0, 0.12],
          [side * 0.045, 0.045, -0.02],
          [side * 0.045, 0, -0.16],
          [side * 0.045, -0.035, -0.02],
          [side * 0.92, 0, -0.1]
        ],
        [
          [0, 2, 1],
          [0, 3, 2],
          [0, 1, 4],
          [1, 2, 4],
          [2, 3, 4],
          [3, 0, 4]
        ],
        1
      );
    }
  }
  if (detail)
    loft(
      [
        [
          [-0.04, 0.012, -0.27],
          [0.04, 0.012, -0.27],
          [0.04, -0.012, -0.27],
          [-0.04, -0.012, -0.27]
        ],
        [
          [-0.105, 0.012, -0.52],
          [0.105, 0.012, -0.52],
          [0.105, -0.012, -0.52],
          [-0.105, -0.012, -0.52]
        ]
      ],
      2
    );
  else
    solid(
      [
        [0, 0.025, -0.3],
        [0, -0.02, -0.3],
        [-0.105, 0, -0.52],
        [0.105, 0, -0.52],
        [0, 0, -0.55],
        [0, 0, -0.25]
      ],
      [
        [0, 2, 4],
        [0, 4, 3],
        [0, 3, 5],
        [0, 5, 2],
        [1, 4, 2],
        [1, 3, 4],
        [1, 5, 3],
        [1, 2, 5]
      ],
      2
    );
  // Zoom detail only: keep the root embedded 0.015 behind the head cap.
  const beakRootZ = detail ? 0.345 : 0.3,
    beakHalfWidth = detail ? 0.032 : 0.025;
  solid(
    [
      [-beakHalfWidth, 0.075, beakRootZ],
      [beakHalfWidth, 0.075, beakRootZ],
      [0, 0.11, beakRootZ],
      [0, 0.08, 0.45]
    ],
    [
      [0, 1, 2],
      [0, 3, 1],
      [1, 3, 2],
      [2, 3, 0]
    ],
    3,
    new THREE.Color(0x322c35).toArray()
  );
  if (detail)
    for (const side of [-1, 1]) {
      const x = side * 0.071;
      solid(
        [
          [x, 0.108, 0.285],
          [x, 0.12, 0.3],
          [x, 0.108, 0.315],
          [x, 0.098, 0.3]
        ],
        side > 0
          ? [
              [0, 1, 2],
              [0, 2, 3]
            ]
          : [
              [2, 1, 0],
              [3, 2, 0]
            ],
        4,
        new THREE.Color(0x111018).toArray()
      );
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setAttribute('birdPart', new THREE.Float32BufferAttribute(part, 1));
  g.computeBoundingSphere();
  return g;
}

// Balloon geometry and shader patch, shared by the drifting balloons and the station (sky-island.mjs).
function balloonKit(THREE) {
  const color = hex => new THREE.Color(hex);
  // ---------- geometry ----------
  function builder() {
    return { p: [], n: [], c: [], g: [], wicker: [], i: [] };
  }
  function vertex(b, x, y, z, nx, ny, nz, col, glow, wicker = 0) {
    const k = b.p.length / 3,
      l = Math.hypot(nx, ny, nz) || 1;
    b.p.push(x, y, z);
    b.n.push(nx / l, ny / l, nz / l);
    b.c.push(col.r, col.g, col.b);
    b.g.push(glow);
    b.wicker.push(wicker);
    return k;
  }
  function finish(b) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(b.c, 3));
    g.setAttribute('skyGlow', new THREE.Float32BufferAttribute(b.g, 1));
    g.setAttribute('skyWicker', new THREE.Float32BufferAttribute(b.wicker, 1));
    g.setIndex(b.i);
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
  const FACES = [
    [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ],
    [
      [-1, 0, 0],
      [0, 0, 1],
      [0, 1, 0]
    ],
    [
      [0, 1, 0],
      [0, 0, 1],
      [1, 0, 0]
    ],
    [
      [0, -1, 0],
      [1, 0, 0],
      [0, 0, 1]
    ],
    [
      [0, 0, 1],
      [1, 0, 0],
      [0, 1, 0]
    ],
    [
      [0, 0, -1],
      [0, 1, 0],
      [1, 0, 0]
    ]
  ];
  function box(b, cx, cy, cz, sx, sy, sz, col, glow = 0, wicker = 0, openSides = false) {
    const h = [sx / 2, sy / 2, sz / 2],
      ext = a => Math.abs(a[0] * h[0] + a[1] * h[1] + a[2] * h[2]);
    for (const [n, u, v] of FACES) {
      if (openSides && n[1] === 0) continue;
      const hn = ext(n),
        hu = ext(u),
        hv = ext(v),
        k = b.p.length / 3;
      for (const [su, sv] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1]
      ])
        vertex(
          b,
          cx + n[0] * hn + u[0] * hu * su + v[0] * hv * sv,
          cy + n[1] * hn + u[1] * hu * su + v[1] * hv * sv,
          cz + n[2] * hn + u[2] * hu * su + v[2] * hv * sv,
          n[0],
          n[1],
          n[2],
          col,
          glow,
          wicker
        );
      b.i.push(k, k + 1, k + 2, k, k + 2, k + 3);
    }
  }
  function rod(b, ax, ay, az, bx, by, bz, w, col) {
    let dx = bx - ax,
      dy = by - ay,
      dz = bz - az;
    const l = Math.hypot(dx, dy, dz) || 1;
    dx /= l;
    dy /= l;
    dz /= l;
    const [rx, ry, rz] = Math.abs(dy) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let ux = dy * rz - dz * ry,
      uy = dz * rx - dx * rz,
      uz = dx * ry - dy * rx;
    const ul = Math.hypot(ux, uy, uz) || 1;
    ux /= ul;
    uy /= ul;
    uz /= ul;
    const vx = dy * uz - dz * uy,
      vy = dz * ux - dx * uz,
      vz = dx * uy - dy * ux,
      k = b.p.length / 3;
    for (let j = 0; j < 4; j++) {
      const a = Math.PI / 4 + (j * Math.PI) / 2,
        c = Math.cos(a) * w,
        s = Math.sin(a) * w,
        ox = ux * c + vx * s,
        oy = uy * c + vy * s,
        oz = uz * c + vz * s;
      vertex(b, ax + ox, ay + oy, az + oz, ox, oy, oz, col, 0);
      vertex(b, bx + ox, by + oy, bz + oz, ox, oy, oz, col, 0);
    }
    for (let j = 0; j < 4; j++) {
      const a0 = k + j * 2,
        b0 = a0 + 1,
        a1 = k + ((j + 1) % 4) * 2,
        b1 = a1 + 1;
      b.i.push(a0, a1, b1, a0, b1, b0);
    }
  }
  // Distant rim only: a closed extrusion of the exact four-rail union.
  function distantRim(b, h, y, col) {
    const a = 0.065 * Math.SQRT1_2;
    const outer = [
      [h + a, -h],
      [h + a, h],
      [h, h],
      [h, h + a],
      [-h, h + a],
      [-h, h],
      [-h - a, h],
      [-h - a, -h],
      [-h, -h],
      [-h, -h - a],
      [h, -h - a],
      [h, -h]
    ];
    const inner = [
      [-h + a, -h + a],
      [-h + a, h - a],
      [h - a, h - a],
      [h - a, -h + a]
    ];
    const points = [...outer, ...inner];
    const faces = THREE.ShapeUtils.triangulateShape(
      outer.map(p => new THREE.Vector2(...p)),
      [inner.map(p => new THREE.Vector2(...p))]
    );
    for (const sign of [-1, 1]) {
      const k = b.p.length / 3;
      for (const [x, z] of points) vertex(b, x, y + sign * a, z, 0, sign, 0, col, 0);
      for (const face of faces) {
        const [u, v, w] = face.map(i => points[i]);
        const cross = (v[0] - u[0]) * (w[1] - u[1]) - (v[1] - u[1]) * (w[0] - u[0]);
        const [i, j, l] = face;
        if (cross * sign > 0) b.i.push(k + i, k + l, k + j);
        else b.i.push(k + i, k + j, k + l);
      }
    }
    for (const contour of [outer, inner])
      for (let i = 0; i < contour.length; i++) {
        const [x, z] = contour[i],
          [X, Z] = contour[(i + 1) % contour.length],
          k = b.p.length / 3;
        const nx = Z - z,
          nz = x - X;
        for (const [px, py, pz] of [
          [x, y - a, z],
          [x, y + a, z],
          [X, y + a, Z],
          [X, y - a, Z]
        ])
          vertex(b, px, py, pz, nx, 0, nz, col, 0);
        b.i.push(k, k + 1, k + 2, k, k + 2, k + 3);
      }
  }
  function envelope(b, palette, detailed) {
    const G = ENV.gores,
      S = ENV.sub,
      gores = palette.gores.map(color),
      accent = color(palette.accent),
      crown = color(palette.crown),
      skirt = color(palette.skirt);
    for (const profile of PROFILE) {
      // Background envelopes retain every gore, colour boundary and extremum. Removing
      // four intermediate rings funds solid birds; maximum outline deviation is 0.068 m.
      const rows = detailed
        ? profile
        : profile.filter(
            (row, i) => !(row.band === 'lower' && [1, 3, 5].includes(i)) && !(row.band === 'crown' && i === 2)
          );
      const band = rows[0].band;
      for (let g = 0; g < G; g++) {
        const col =
            band === 'skirt'
              ? skirt
              : band === 'accent'
                ? accent
                : band === 'crown'
                  ? crown
                  : gores[(g + (band === 'upper' && palette.offset ? 1 : 0)) % gores.length],
          base = b.p.length / 3;
        for (let j = 0; j <= S; j++) {
          const u = j / S,
            theta = ((g + u) / G) * TAU,
            bulge = 1 + ENV.bulge * Math.sin(Math.PI * u),
            slope = (ENV.bulge * G * Math.cos(Math.PI * u)) / 2,
            sin = Math.sin(theta),
            cos = Math.cos(theta);
          for (const row of rows) {
            // Analytic normal of the puffed lathe: creased at seams, smooth across each gore.
            const nx = (bulge * sin - slope * cos) * row.dy,
              nz = (slope * sin + bulge * cos) * row.dy,
              ny = -row.dr * bulge * bulge;
            const glow =
              band === 'skirt'
                ? 1
                : clamp(1 - (0.7 * (row.y - ENV.throatY)) / (ENV_TOP - ENV.throatY), 0.25, 1);
            vertex(b, row.r * bulge * sin, row.y, row.r * bulge * cos, nx, ny, nz, col, glow);
          }
        }
        const n = rows.length;
        // Distant crown: retain all boundary vertices and the pole; omit only
        // the interior mid-row vertex of each gore (six faces become four).
        if (RIM_REVIEW && !detailed && band === 'crown' && n === 3 && S === 2) {
          for (const [a, c, d] of [
            [0, 3, 1],
            [3, 7, 1],
            [3, 6, 7],
            [1, 7, 8]
          ])
            b.i.push(base + a, base + c, base + d);
          continue;
        }
        for (let j = 0; j < S; j++)
          for (let k = 0; k < n - 1; k++) {
            const a = base + j * n + k,
              bb = base + (j + 1) * n + k;
            b.i.push(a, bb, bb + 1);
            // At the pole the second triangle has two identical vertices; skip it.
            if (rows[k + 1].r > 1e-8) b.i.push(a, bb + 1, a + 1);
          }
      }
    }
  }
  const WICKER = color(0xc49a64),
    WICKER_DARK = color(0xa77d50),
    LEATHER = color(0x4a3328),
    // The passenger basket's padded rim: lighter on top, where the visitor's hands rest.
    PADDING = color(0x8c5a38),
    ROPE = color(0x3d3442),
    HEMP = color(0xa88f6a),
    METAL = color(0x55525f),
    // Posts and straps of the open basket: a lighter leather than the harness, so they read in dim light.
    STRAP = color(0x7a5236),
    BRASS = color(0xa8803c),
    // Tank covers: dark navy padded fabric, as on real balloon cylinders (bare pale steel read as a blob).
    TANK = color(0x2c3b52),
    CREAM = color(0xf7ecd9);
  // Basket weave on one wall face centred at (cx, cy, cz) facing (nx, 0, nz), half-width w, height d: rows of
  // strands passing over and under the stakes. Each cell is lighter in the middle and its normals bow up and
  // down, so the strands read as round under any light. Build time only.
  const shade = new THREE.Color();
  function weave(b, cx, cy, cz, nx, nz, w, d, seed, coarse = 1) {
    // u × up = n keeps every face wound outwards.
    const ux = nz,
      uz = -nx,
      cols = Math.max(4, Math.round((w * 2) / (WEAVE.stake * coarse))),
      rows = Math.max(3, Math.round(d / (WEAVE.strand * coarse)));
    for (let r = 0; r < rows; r++) {
      const v0 = -d / 2 + (d * r) / rows,
        v1 = v0 + d / rows,
        vary = 0.92 + 0.16 * fract(Math.sin((r + 1) * 12.9898 + seed * 78.233) * 43758.5453);
      for (let c = 0; c < cols; c++) {
        const u0 = -w + (w * 2 * c) / cols,
          u1 = u0 + (w * 2) / cols,
          over = (c + r + seed) % 2 === 0,
          base = over ? WICKER : WICKER_DARK,
          k = b.p.length / 3;
        // Rows: top edge, middle, bottom edge; columns: left seam, middle, right seam (where the stake shows).
        for (const [v, light, bow] of [
          [v1, 0.86, WEAVE.bow],
          [(v0 + v1) / 2, over ? 1.06 : 0.98, 0],
          [v0, 0.82, -WEAVE.bow]
        ])
          for (const [u, seam] of [
            [u0, 0.9],
            [(u0 + u1) / 2, 1],
            [u1, 0.9]
          ]) {
            shade.copy(base).multiplyScalar(light * seam * vary);
            vertex(b, cx + ux * u, cy + v, cz + uz * u, nx, bow, nz, shade, 0);
          }
        for (const [p, q] of [
          [3, 0],
          [6, 3]
        ])
          for (let j = 0; j < 2; j++)
            b.i.push(k + p + j, k + p + j + 1, k + q + j + 1, k + p + j, k + q + j + 1, k + q + j);
      }
    }
  }
  // A padded leather roll along one rim side (centre line at (cx, cy, cz), facing (nx, 0, nz)), quilted by
  // pinches; it overlaps the next side at the corners.
  function padding(b, cx, cy, cz, nx, nz, w) {
    const ux = nz,
      uz = -nx,
      ring = 8,
      { width: rw, height: rh, quilts } = WEAVE.pad,
      steps = quilts * 2,
      start = b.p.length / 3;
    for (let i = 0; i <= steps; i++) {
      const s = -w + (w * 2 * i) / steps,
        pinch = i % 2 || i === 0 || i === steps ? 1 : 0.84;
      for (let j = 0; j < ring; j++) {
        const a = (j / ring) * TAU,
          c = Math.cos(a),
          sn = Math.sin(a);
        shade.copy(PADDING).multiplyScalar((0.55 + 0.5 * Math.max(0, sn)) * (pinch < 1 ? 0.8 : 1));
        vertex(
          b,
          cx + ux * s + nx * rw * c * pinch,
          cy + rh * sn * pinch,
          cz + uz * s + nz * rw * c * pinch,
          (nx * c) / rw,
          sn / rh,
          (nz * c) / rw,
          shade,
          0
        );
      }
    }
    for (let i = 0; i < steps; i++)
      for (let j = 0; j < ring; j++) {
        const a = start + i * ring + j,
          bb = a + ring,
          c = start + (i + 1) * ring + ((j + 1) % ring),
          d = start + i * ring + ((j + 1) % ring);
        b.i.push(a, bb, c, a, c, d);
      }
  }
  // What makes the open basket read as a real one: leather-wrapped corner posts from the floor to the rim, leather
  // straps round the walls, corner guards at the foot, an eyelet plate where each stay meets the rim, and two gas
  // tanks standing in the back corners with a hose up to the burner. Hot-air-basket proportions; build time only.
  function basketFittings(b, h, d, rimY) {
    const bottom = rimY - d,
      corners = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1]
      ];
    for (const [sx, sz] of corners) {
      rod(b, sx * h, bottom + 0.08, sz * h, sx * h, rimY, sz * h, 0.06, STRAP);
      box(b, sx * h, bottom + 0.08, sz * h, 0.17, 0.16, 0.17, STRAP);
      box(b, sx * (h - 0.04), rimY + 0.09, sz * (h - 0.04), 0.07, 0.04, 0.07, METAL);
    }
    for (const [nx, nz] of [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0]
    ])
      for (const f of [0.3, 0.7]) {
        const y = rimY - d * f,
          ox = nx * (h + 0.017),
          oz = nz * (h + 0.017);
        rod(
          b,
          ox + nz * (h - 0.1),
          y,
          oz - nx * (h - 0.1),
          ox - nz * (h - 0.1),
          y,
          oz + nx * (h - 0.1),
          0.022,
          STRAP
        );
      }
    // Gas tanks in padded covers, with a brass valve collar and neck and a hose to the burner can. The cover ends
    // in a hard line at the collar (two profile points 1 mm apart): with one shared vertex the colours blended over
    // the whole shoulder and the tanks read as soft blobs (round 13).
    const tank = [
      [0, 0],
      [0.13, 0],
      [0.16, 0.05],
      [0.16, 0.5],
      [0.125, 0.6],
      [0.124, 0.601],
      [0.11, 0.62],
      [0.045, 0.664],
      [0.044, 0.665],
      [0.04, 0.67],
      [0.04, 0.72],
      [0, 0.72]
    ];
    // Cover, then a steel dome, then the brass valve neck: each change a hard line between two close profile points.
    const tankColour = y => {
      if (y > 0.6645) return BRASS;
      return y > 0.6005 ? METAL : TANK;
    };
    for (const sx of [-1, 1]) {
      const x = sx * (h - 0.24),
        z = -(h - 0.24),
        // 5 mm above the floor's top face, so the floor keeps its one top surface.
        y0 = bottom + 0.085,
        lathe = new THREE.LatheGeometry(
          tank.map(([r, y]) => new THREE.Vector2(r, y)),
          14
        ),
        p = lathe.attributes.position,
        nm = lathe.attributes.normal,
        offset = b.p.length / 3;
      for (let i = 0; i < p.count; i++)
        vertex(
          b,
          x + p.getX(i),
          y0 + p.getY(i),
          z + p.getZ(i),
          nm.getX(i),
          nm.getY(i),
          nm.getZ(i),
          tankColour(p.getY(i)),
          0
        );
      for (const i of lathe.index.array) b.i.push(offset + i);
      lathe.dispose();
      rod(b, x, y0 + 0.72, z, sx * 0.4, -7.7, -0.1, 0.012, ROPE);
      rod(b, sx * 0.4, -7.7, -0.1, sx * 0.13, -6.8, 0, 0.012, ROPE);
    }
  }
  // basket: an open passenger basket { half, depth } (local units) that a camera can stand in; otherwise the
  // solid basket the far balloons carry.
  function rigging(b, palette, banner, basket) {
    const ring = 1,
      ringY = -6.15,
      rim = basket?.half ?? DEFAULT_BALLOON_BASKET.half,
      // All baskets share the tour basket's proportions unless a ride specifies its own.
      rimY = BASKET_RIM_Y - (basket?.drop ?? DEFAULT_BALLOON_BASKET.drop);
    // A real continuous load ring joins the suspension ropes and burner stays at the skirt.
    const start = b.p.length / 3,
      segments = 16;
    for (let k = 0; k < segments; k++) {
      const a = (k * TAU) / segments,
        x = Math.sin(a),
        z = Math.cos(a);
      vertex(b, x * 0.97, ringY, z * 0.97, 0, 1, 0, HEMP, 0);
      vertex(b, x * 1.03, ringY, z * 1.03, 0, 1, 0, HEMP, 0);
    }
    for (let k = 0; k < segments; k++) {
      const a = start + 2 * k,
        c = start + 2 * ((k + 1) % segments);
      b.i.push(a, c, c + 1, a, c + 1, a + 1);
    }
    for (let k = 0; k < 8; k++) {
      const a = Math.PI / 8 + (k * Math.PI) / 4,
        x = Math.sin(a),
        z = Math.cos(a),
        // A passenger basket ties its ropes along the sides, not at the corners: standing at the rim the
        // visitor sees the two near ones at the edges of the view.
        side = BASKET_ROPE_SIDE,
        front = Math.abs(z) > Math.abs(x);
      rod(
        b,
        x * ring,
        ringY,
        z * ring,
        Math.sign(x) * rim * (front ? side : 1),
        rimY + (basket ? 0.06 : 0),
        Math.sign(z) * rim * (front ? 1 : side),
        basket ? 0.014 : 0.022,
        HEMP
      );
    }
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1]
    ])
      rod(b, sx * rim, rimY, sz * rim, sx * 0.25, -6.75, sz * 0.25, basket ? 0.024 : 0.022, METAL);
    // The four supports meet the burner frame, which is hung from the skirt by short stays.
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1]
    ])
      rod(b, sx * 0.25, -6.75, sz * 0.25, sx * Math.SQRT1_2, ringY, sz * Math.SQRT1_2, 0.014, HEMP);
    {
      // One hollow burner cup on a cross-member: the jet exits its central bore.
      for (const s of [-1, 1]) {
        rod(b, s * 0.25, -6.75, -0.25, s * 0.25, -6.75, 0.25, 0.025, METAL);
        rod(b, -0.25, -6.75, s * 0.25, 0.25, -6.75, s * 0.25, 0.025, METAL);
      }
      rod(b, -0.25, -6.78, 0, 0.25, -6.78, 0, 0.035, METAL);
      // Burner can on the frame: a body, a brass collar flared into the nozzle lip, and the jet's seat in a recess
      // of the lip. The distant balloons keep a plain cone.
      const nozzle = basket ? NOZZLE : NOZZLE_FAR,
        cup = new THREE.LatheGeometry(
          nozzle.map(([r, y]) => new THREE.Vector2(r, y)),
          basket ? 12 : 4
        );
      const offset = b.p.length / 3,
        p = cup.attributes.position,
        n = cup.attributes.normal;
      for (let i = 0; i < p.count; i++) {
        const col = basket && p.getY(i) > -6.7 ? BRASS : METAL;
        vertex(b, p.getX(i), p.getY(i), p.getZ(i), n.getX(i), n.getY(i), n.getZ(i), col, 0.45);
      }
      for (const i of cup.index.array) b.i.push(offset + i);
      cup.dispose();
      // Opaque underside: an upward basket view must hit metal before the flame.
      const [capR, capY] = nozzle[0],
        cap = vertex(b, 0, capY, 0, 0, -1, 0, METAL, 0),
        capSides = basket ? 12 : 4;
      for (let i = 0; i < capSides; i++) {
        const a = (i * TAU) / capSides;
        vertex(b, capR * Math.sin(a), capY, capR * Math.cos(a), 0, -1, 0, METAL, 0);
      }
      for (let i = 0; i < capSides; i++) b.i.push(cap, cap + 1 + ((i + 1) % capSides), cap + 1 + i);
    }
    if (basket) {
      const h = basket.half,
        d = basket.depth,
        t = 0.07,
        y = rimY - d / 2;
      basketFittings(b, h, d, rimY);
      // Wall faces already cover the slab sides; duplicate faces flicker at landing.
      // 3: the floor's boards, painted by the shader (BALLOON_FRAGMENT).
      box(b, 0, rimY - d + 0.04, 0, h * 2, 0.08, h * 2, WICKER_DARK, 0, 3, true);
      // Each wall: a woven outer and inner face (the wall's top is under the padded rim).
      for (const [nx, nz] of [
        [0, 1],
        [1, 0],
        [0, -1],
        [-1, 0]
      ]) {
        // The outer faces are only seen from outside the basket, at a distance: a coarser weave.
        weave(b, nx * h, y, nz * h, nx, nz, h, d, 0, 1.35);
        weave(b, nx * (h - t), y, nz * (h - t), -nx, -nz, h - t, d, 1);
        padding(b, nx * (h - t / 2), rimY + 0.03, nz * (h - t / 2), nx, nz, h);
      }
      return;
    }
    // Distant LOD retains the open tour-basket proportions, using double-sided woven walls.
    const h = DEFAULT_BALLOON_BASKET.half,
      d = DEFAULT_BALLOON_BASKET.depth,
      bottom = rimY - d;
    box(b, 0, bottom + 0.04, 0, h * 2, 0.08, h * 2, WICKER_DARK, 0, 0, true);
    for (const [nx, nz] of [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0]
    ]) {
      const ux = nz,
        uz = -nx,
        k = b.p.length / 3;
      for (const [u, y] of [
        [-h, bottom],
        [h, bottom],
        [h, rimY],
        [-h, rimY]
      ])
        // 2: a far wall, whose posts and strap the shader paints (BALLOON_FRAGMENT).
        vertex(b, nx * h + ux * u, y, nz * h + uz * u, nx, 0, nz, WICKER, 0, 2);
      b.i.push(k, k + 1, k + 2, k, k + 2, k + 3);
      if (!RIM_REVIEW)
        rod(
          b,
          nx * h - nz * h,
          rimY,
          nz * h + nx * h,
          nx * h + nz * h,
          rimY,
          nz * h - nx * h,
          0.065,
          PADDING
        );
    }
    if (RIM_REVIEW) distantRim(b, h, rimY, PADDING);
    if (!banner) return;
    // A small swallow-tailed banner hanging under the basket.
    const top = SOLID_FLOOR - 0.62,
      cloth = [color(palette.crown), CREAM, color(palette.accent)],
      w = 1.25,
      wave = x => 0.07 * Math.sin(x * 2.4);
    rod(b, -0.5, SOLID_FLOOR, 0, -w, top, 0, 0.025, ROPE);
    rod(b, 0.5, SOLID_FLOOR, 0, w, top, 0, 0.025, ROPE);
    rod(b, -w - 0.08, top, 0, w + 0.08, top, 0, 0.04, LEATHER);
    const bands = [
      [top - 0.03, top - 0.42],
      [top - 0.42, top - 0.78],
      [top - 0.78, top - 1.12]
    ];
    bands.forEach(([y0, y1], j) => {
      const k = b.p.length / 3;
      for (const [x, y] of [
        [-w, y1],
        [w, y1],
        [w, y0],
        [-w, y0]
      ])
        vertex(b, x, y, wave(x), 0, 0, 1, cloth[j], 0);
      b.i.push(k, k + 1, k + 2, k, k + 2, k + 3);
    });
    const y0 = top - 1.12,
      k = b.p.length / 3;
    for (const [x, y] of [
      [-w, y0],
      [w, y0],
      [w, y0 - 0.5],
      [0, y0 - 0.22],
      [-w, y0 - 0.5]
    ])
      vertex(b, x, y, wave(x), 0, 0, 1, cloth[2], 0);
    b.i.push(k + 4, k + 3, k, k, k + 3, k + 1, k + 3, k + 2, k + 1);
  }
  function balloonGeometry(spec) {
    const b = builder();
    envelope(b, PALETTES[spec.palette], !!spec.basket);
    rigging(b, PALETTES[spec.palette], spec.banner && !spec.basket, spec.basket);
    return finish(b);
  }

  function patchBalloon(shader) {
    shader.vertexShader =
      'attribute float skyGlow;\nattribute float skyWicker;\nvarying float vSkyGlow;\nvarying float vSkyWicker;\nvarying vec3 vWickerPosition;\nvarying vec3 vWickerNormal;\n' +
      shader.vertexShader.replace('#include <begin_vertex>', BALLOON_VERTEX);
    shader.fragmentShader =
      'varying float vSkyGlow;\nvarying float vSkyWicker;\nvarying vec3 vWickerPosition;\nvarying vec3 vWickerNormal;\n' +
      shader.fragmentShader.replace('#include <emissivemap_fragment>', BALLOON_FRAGMENT);
  }
  return { balloonGeometry, patchBalloon };
}
function balloonMaterial(THREE, patch) {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.74,
    metalness: 0,
    side: THREE.DoubleSide,
    emissive: 0xffc48a,
    emissiveIntensity: 0
  });
  material.onBeforeCompile = patch;
  material.customProgramCacheKey = () => 'garden-sky-balloon-1';
  return material;
}
// Burner flame material, shared by the station's jet (sky-island.mjs) and the drifting balloons' instanced flames:
// additive, unfogged, above the bloom threshold at night. A vertex-shader patch sways the tongue and runs a band of
// cooler, then hotter light up it, so the flame changes shape and colour with no change to its transform (the
// root stays on the nozzle). `height` is the flame geometry's height; write the time in seconds to
// material.userData.clock[0] each frame (a typed array: storing a double in an object field would allocate).
export function createFlameMaterial(THREE, height, { cross = false } = {}) {
  const clock = new Float64Array(1),
    time = {
      get value() {
        return clock[0];
      }
    },
    h = height.toFixed(3),
    material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      // The crossed quads are seen from both sides.
      side: cross ? THREE.DoubleSide : THREE.FrontSide,
      depthWrite: false,
      toneMapped: false,
      fog: false
    });
  material.onBeforeCompile = shader => {
    shader.uniforms.flameTime = time;
    shader.vertexShader =
      'uniform float flameTime;\n' +
      shader.vertexShader
        .replace(
          '#include <color_vertex>',
          `#include <color_vertex>
            float flameUp = clamp( position.y / ${h}, 0.0, 1.0 );
            #ifdef USE_INSTANCING
            float flamePhase = instanceMatrix[ 3 ].x * 0.37 + instanceMatrix[ 3 ].z * 0.91;
            #else
            float flamePhase = 0.0;
            #endif
            float flameWave = 0.5 + 0.5 * sin( flameTime * 19.0 - flameUp * 9.0 + flamePhase );
            vColor.rgb *= ( 0.92 + 0.08 * sin( flameTime * 27.0 + flamePhase ) ) *
                mix( vec3( 1.0 ), vec3( 1.0, 0.8, 0.55 ), flameWave * flameUp );`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
    float flameLean = flameUp * flameUp * ${h} * 0.09;
    transformed.x += flameLean * sin( flameTime * 23.0 + flamePhase + flameUp * 5.0 );
    transformed.z += flameLean * cos( flameTime * 17.0 + flamePhase * 1.3 + flameUp * 4.0 );
    transformed.xz *= 1.0 + 0.12 * sin( flameTime * 31.0 + flamePhase * 3.0 + flameUp * 7.0 );
    transformed.y *= 1.0 - 0.06 * flameUp * ( 0.5 + 0.5 * sin( flameTime * 37.0 + flamePhase ) );`
        )
        .replace(
          '#include <project_vertex>',
          cross
            ? `#include <project_vertex>
    flameUv = vec2( flameAcross, flameUp );`
            : `#include <project_vertex>
    // Soft outline (round 5): brightest where the flame faces the eye, fading towards its silhouette, so its few
    // facets no longer read as a cut gem. The normal is unit and normalMatrix a rotation: its view z is the facing.
    float flameFacing = clamp( ( normalMatrix * normal ).z, 0.0, 1.0 );
    vColor.rgb *= 0.55 + 0.85 * flameFacing * flameFacing;`
        );
    if (cross) {
      shader.vertexShader = 'attribute float flameAcross;\nvarying vec2 flameUv;\n' + shader.vertexShader;
      // The tongue per pixel: the lathe's outline (widest a third of the way up, pointed at the tip), a hot core
      // fading to a soft edge; additive, so the three quads add up into a round body from every side.
      shader.fragmentShader =
        'varying vec2 flameUv;\n' +
        shader.fragmentShader.replace(
          '#include <color_fragment>',
          `#include <color_fragment>
    float flameR = 3.4 * flameUv.y * ( 1.0 - flameUv.y ) * ( 1.0 - 0.3 * flameUv.y ) + 0.02;
    float flameIn = clamp( 1.0 - abs( flameUv.x ) / flameR, 0.0, 1.0 );
    diffuseColor.rgb *= flameIn * flameIn * ( 0.75 + 0.6 * flameIn );`
        );
    }
  };
  material.customProgramCacheKey = () => 'garden-flame-' + h + (cross ? '-cross' : '');
  // Additive light does not care which side comes first: one pass, not three's back-then-front pair.
  material.forceSinglePass = cross;
  material.userData.clock = clock;
  return material;
}
// One balloon for the station: the same envelopes and shader as the drifting ones. Heights are in metres above
// the basket floor, which is where the mesh is posed from (setFloor).
export function createBalloon(
  THREE,
  { palette = 0, scale = 1, banner = false, basket = null } = {},
  makeMesh = (geometry, material) => new THREE.Mesh(geometry, material)
) {
  const kit = balloonKit(THREE),
    geometry = kit.balloonGeometry({ palette: palette % PALETTES.length, banner, basket }),
    material = balloonMaterial(THREE, kit.patchBalloon),
    mesh = makeMesh(geometry, material),
    floor = basket ? BASKET_RIM_Y - (basket.drop || 0) - basket.depth : SOLID_FLOOR;
  mesh.scale.setScalar(scale);
  return {
    mesh,
    geometry,
    material,
    scale,
    origin: -floor * scale,
    rim: (basket?.depth ?? DEFAULT_BALLOON_BASKET.depth) * scale,
    half: (basket?.half ?? DEFAULT_BALLOON_BASKET.half) * scale,
    ring: (RING_Y - floor) * scale,
    throat: (ENV.throatY - floor) * scale,
    radius: ENV.R * (1 + ENV.bulge) * scale,
    // Burner flame base, in the mesh's local units (a child mesh is scaled with it).
    burner: FLAME_Y,
    height: (ENV_TOP - floor) * scale,
    // Basket floor at (x, y, z), turned by yaw (radians about +y, the basket's +z face forward).
    setFloor(x, y, z, yaw) {
      mesh.position.set(x, y + this.origin, z);
      mesh.rotation.y = yaw;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

export function createSkyLife(THREE, { economy = false, startTime = 0 } = {}) {
  const group = new THREE.Group();
  group.name = 'garden-sky-life';
  const resources = [],
    own = resource => {
      resources.push(resource);
      return resource;
    };
  const { balloonGeometry, patchBalloon } = balloonKit(THREE);

  function patchBird(shader) {
    shader.vertexShader =
      'attribute vec2 birdFlap; attribute float birdPart;\n' +
      shader.vertexShader.replace('#include <begin_vertex>', BIRD_VERTEX);
  }

  // ---------- balloons ----------
  const balloons = BALLOONS.map((spec, index) => {
    const geometry = own(balloonGeometry(spec));
    const material = own(balloonMaterial(THREE, patchBalloon));
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'sky-balloon-' + index;
    mesh.matrixAutoUpdate = false;
    mesh.scale.setScalar(spec.scale);
    group.add(mesh);
    const p = geometry.attributes.position;
    let radial = 0;
    for (let i = 0; i < p.count; i++) radial = Math.max(radial, Math.hypot(p.getX(i), p.getZ(i)));
    return {
      spec,
      mesh,
      material,
      extent: { radial, bottom: geometry.boundingBox.min.y, top: geometry.boundingBox.max.y }
    };
  });
  const B = balloons.length;
  // Flames: one instanced draw for every burner; additive, unfogged and above the bloom threshold at night.
  const flameSides = FLAME_FORM === 'lathe12' ? 12 : 6;
  const flameGeometry = own(
    FLAME_FORM === 'cross'
      ? crossFlameGeometry(THREE)
      : new THREE.LatheGeometry(
          [
            [0, 0],
            [0.13, 0.14],
            [0.21, 0.4],
            [0.16, 0.75],
            [0.07, 1.05],
            [0, 1.3]
          ].map(([x, y]) => new THREE.Vector2(x, y)),
          flameSides
        )
  );
  if (FLAME_FORM !== 'cross') {
    // Lathe pole quads contain zero-area triangles; omit those before instancing.
    const p = flameGeometry.attributes.position,
      ids = flameGeometry.index.array,
      clean = [];
    const a = new THREE.Vector3(),
      b = new THREE.Vector3(),
      c = new THREE.Vector3();
    for (let i = 0; i < ids.length; i += 3) {
      a.fromBufferAttribute(p, ids[i]);
      b.fromBufferAttribute(p, ids[i + 1]);
      c.fromBufferAttribute(p, ids[i + 2]);
      if (b.sub(a).cross(c.sub(a)).lengthSq() > 1e-12) clean.push(ids[i], ids[i + 1], ids[i + 2]);
    }
    flameGeometry.setIndex(clean);
  }
  {
    const p = flameGeometry.attributes.position,
      c = new Float32Array(p.count * 3);
    // Blue at the root, pale yellow above it, then orange fading to red at the tip.
    for (let i = 0; i < p.count; i++) {
      const t = clamp(p.getY(i) / 1.3, 0, 1),
        fade = 1 - 0.75 * t,
        blue = 1 - clamp(t / 0.22, 0, 1);
      c[i * 3] = fade * (1 - 0.65 * blue);
      c[i * 3 + 1] = (0.95 - 0.5 * t - 0.3 * blue) * fade;
      c[i * 3 + 2] = (0.7 - 0.6 * t + 0.4 * blue) * fade;
    }
    flameGeometry.setAttribute('color', new THREE.BufferAttribute(c, 3));
  }
  const flameMaterial = own(createFlameMaterial(THREE, 1.3, { cross: FLAME_FORM === 'cross' }));
  const flames = own(new THREE.InstancedMesh(flameGeometry, flameMaterial, B));
  flames.name = 'sky-balloon-flames';
  flames.frustumCulled = false;
  flames.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  {
    const black = new THREE.Color(0, 0, 0);
    for (let i = 0; i < B; i++) flames.setColorAt(i, black);
  }
  flames.instanceColor.setUsage(THREE.DynamicDrawUsage);
  group.add(flames);

  // ---------- birds ----------
  const birdGeometry = own(createBirdGeometry(THREE));
  const flapArray = new Float32Array(MAX_BIRDS * 2),
    flapAttribute = new THREE.InstancedBufferAttribute(flapArray, 2);
  flapAttribute.setUsage(THREE.DynamicDrawUsage);
  birdGeometry.setAttribute('birdFlap', flapAttribute);
  const birdMaterial = own(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.FrontSide }));
  birdMaterial.onBeforeCompile = patchBird;
  birdMaterial.customProgramCacheKey = () => 'garden-sky-birds-4';
  const birds = own(new THREE.InstancedMesh(birdGeometry, birdMaterial, MAX_BIRDS));
  birds.name = 'sky-birds';
  birds.frustumCulled = false;
  birds.count = 0;
  birds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(birds);
  const closeGeometry = own(createBirdGeometry(THREE, true));
  const closeFlapArray = new Float32Array(8),
    closeFlapAttribute = new THREE.InstancedBufferAttribute(closeFlapArray, 2);
  closeFlapAttribute.setUsage(THREE.DynamicDrawUsage);
  closeGeometry.setAttribute('birdFlap', closeFlapAttribute);
  const closeBirds = own(new THREE.InstancedMesh(closeGeometry, birdMaterial, 4));
  closeBirds.name = 'sky-birds-close';
  closeBirds.frustumCulled = false;
  closeBirds.count = 0;
  closeBirds.visible = false;
  closeBirds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(closeBirds);
  const closeIds = new Int32Array(4).fill(-1),
    previousClose = new Int32Array(4).fill(-1);
  const closeDistance = new Float64Array(4),
    closeCamera = new Float64Array(32).fill(NaN);
  const closeFrustum = new THREE.Frustum(),
    closeProjection = new THREE.Matrix4(),
    closeSphere = new THREE.Sphere();
  function selectCloseBirds() {
    previousClose.set(closeIds);
    closeIds.fill(-1);
    closeDistance.fill(Infinity);
    if (!watchedCamera || economyOn) return;
    const cm = watchedCamera.matrixWorld.elements;
    const lens = 1 / (watchedCamera.projectionMatrix.elements[5] * Math.tan((24 * Math.PI) / 180));
    closeFrustum.setFromProjectionMatrix(
      closeProjection.multiplyMatrices(watchedCamera.projectionMatrix, watchedCamera.matrixWorldInverse)
    );
    for (let f = 0; f < FLOCKS; f++)
      for (let j = 0; j < fcount[f]; j++) {
        const id = f * MAX_FLOCK + j,
          i = id * 3;
        const dx = pos[i] - cm[12],
          dy = pos[i + 1] - cm[13],
          dz = pos[i + 2] - cm[14];
        closeSphere.center.set(pos[i], pos[i + 1], pos[i + 2]);
        closeSphere.radius = size[id] * birdGeometry.boundingSphere.radius;
        if (!closeFrustum.intersectsSphere(closeSphere)) continue;
        const depth = -(dx * cm[8] + dy * cm[9] + dz * cm[10]);
        if (depth <= 0) continue;
        const retained = previousClose.includes(id);
        // Projected span accounts for both instance size and camera zoom.
        const distance = ((depth * lens) / size[id]) ** 2;
        if (distance > (retained ? 30 * 30 : 24 * 24)) continue;
        const priority = distance * (retained ? 0.75 : 1);
        for (let slot = 0; slot < 4; slot++)
          if (priority < closeDistance[slot]) {
            for (let k = 3; k > slot; k--) {
              closeIds[k] = closeIds[k - 1];
              closeDistance[k] = closeDistance[k - 1];
            }
            closeIds[slot] = id;
            closeDistance[slot] = priority;
            break;
          }
      }
  }

  // ---------- runtime state ----------
  // Everything the frame loop touches is a typed array or a small integer, and no call in it passes or
  // returns a double, so once V8 has optimised it a frame allocates nothing.
  const BP = 16,
    bp = new Float64Array(B * BP),
    bpos = new Float64Array(B * 3);
  const C_TIME = 0,
    C_LAST = 1,
    C_QUERY = 2,
    C_NIGHT = 3,
    C_DT = 4,
    clock = new Float64Array(5);
  // Per-flock leader state, FS doubles each: pose and velocity (read by the birds), the steering state
  // (heading, speed, turn rate, last update time) and the current leg of the route.
  const FS = 28,
    LX = 0,
    LY = 1,
    LZ = 2,
    VX = 3,
    VY = 4,
    VZ = 5,
    FX = 6,
    FZ = 7,
    HD = 8,
    SP = 9,
    TR = 10,
    LT = 11,
    MODE = 12,
    LEG_T0 = 13,
    LEG_END = 14,
    SP_TGT = 15,
    TR_TGT = 16,
    SWAY_B = 17,
    SWAY_W = 18,
    SWAY_P = 19,
    TX = 20,
    TZ = 21,
    YT = 22,
    SEED = 23;
  const fd = new Float64Array(FLOCKS * FS),
    fcount = new Int32Array(FLOCKS),
    fplaced = new Int32Array(FLOCKS);
  // Per-flock random table read by index: the frame loop never calls a function that returns a double.
  const RT = 128,
    rtab = new Float64Array(FLOCKS * RT),
    ridx = new Int32Array(FLOCKS);
  const pos = new Float64Array(MAX_BIRDS * 3),
    vel = new Float64Array(MAX_BIRDS * 3),
    slot = new Float64Array(MAX_BIRDS * 4);
  const flap = new Float64Array(MAX_BIRDS * 4),
    heading = new Float64Array(MAX_BIRDS),
    roll = new Float64Array(MAX_BIRDS),
    size = new Float64Array(MAX_BIRDS),
    vigor = new Float64Array(MAX_BIRDS),
    gliding = new Uint8Array(MAX_BIRDS);
  const sc = new Float64Array(4),
    tgt = new Float64Array(3),
    mp = new Float64Array(9),
    planes = new Float64Array(24),
    sph = new Float64Array(4),
    lim = new Float64Array(4);
  const PLANE_ROW = [0, 0, 1, 1, 2, 2],
    PLANE_SIGN = [-1, 1, 1, -1, -1, 1];
  const viewProjection = new THREE.Matrix4();
  {
    const random = mulberry32(77);
    for (let b = 0; b < MAX_BIRDS; b++) {
      // Loose formation slot in the leader's frame: lateral, vertical, along the heading.
      const a = random() * TAU,
        r = Math.sqrt(random());
      slot[b * 4] = Math.cos(a) * r * 7;
      slot[b * 4 + 1] = (random() - 0.5) * 5;
      slot[b * 4 + 2] = Math.sin(a) * r * 8.5;
      slot[b * 4 + 3] = random() * TAU;
      flap[b * 4] = random() * TAU;
      flap[b * 4 + 1] = 1;
      flap[b * 4 + 2] = 2.6 + random() * 0.9;
      flap[b * 4 + 3] = random() * 3;
      // Some birds flap longer and deeper, others glide more; a fixed trait, independent of the sequence above.
      vigor[b] = 0.8 + 0.45 * fract(Math.sin(b * 91.7 + 3.1) * 437.5);
      size[b] = FLOCK_STYLE[Math.floor(b / MAX_FLOCK)].scale * (0.92 + random() * 0.16);
    }
    balloons.forEach(({ spec }, i) => {
      const o = i * BP,
        rand = mulberry32(9137 + i * 7919);
      bp[o + 7] = rand() * TAU;
      bp[o + 8] = rand() * TAU;
      bp[o + 9] = 13 + rand() * 9;
      bp[o + 10] = 2 + rand() * 1.4;
      bp[o + 11] = rand() * 20;
      bp[o + 12] = TAU / spec.period;
      bp[o + 13] = spec.loop[0];
      bp[o + 14] = spec.loop[1];
      bp[o + 15] = spec.scale;
    });
    FLOCK_STYLE.forEach((style, f) => {
      const o = f * FS;
      fd[o + SEED] = f * 1.7 + style.speed;
      fd[o + FZ] = 1;
    });
  }
  const layout = { radius: 23, scenicPush: 0 };
  let economyOn = !!economy,
    season = 'summer',
    animating = true,
    disposed = false,
    dirty = true,
    hasLast = false,
    watchedCamera = null,
    limits = skyClearance(23, 0),
    visibleBalloons = 0;
  // Station: [on, x, y (docked balloon origin), z, outward x, outward z, docked yaw]; bstill marks a docked balloon.
  const station = new Float64Array(7),
    bstill = new Uint8Array(B);
  clock[C_TIME] = Number.isFinite(startTime) ? startTime : 0;

  function place() {
    limits = skyClearance(layout.radius, layout.scenicPush);
    lim[0] = limits.birdInner;
    lim[1] = limits.birdOuter;
    lim[2] = limits.birdLow;
    lim[3] = limits.birdHigh;
    balloons.forEach((b, i) => {
      const { spec } = b,
        s = spec.scale,
        er = b.extent.radial * s + 0.5,
        ex = Math.hypot(spec.loop[0], spec.loop[1]);
      let d,
        y = spec.y;
      if (spec.lane === 'beyond') {
        d = Math.min(limits.scenicOuter + er + ex + 3 + spec.extra, limits.farLimit - er - ex);
        y = Math.max(y, BOB + 3 - b.extent.bottom * s);
      } else {
        const inner = Math.max(limits.projectReach, limits.scenicInner) + er + ex + 3,
          outer = Math.max(inner, limits.scenicOuter - er - ex);
        d = inner + (outer - inner) * spec.into;
        y = Math.max(y, Math.max(limits.scenicTop, limits.projectTop) + 1 + BOB - b.extent.bottom * s);
      }
      const a = FAR_SIDE + spec.az,
        o = i * BP;
      bp[o] = Math.sin(a) * d;
      bp[o + 1] = Math.cos(a) * d;
      bp[o + 2] = y;
      bp[o + 3] = Math.cos(a);
      bp[o + 4] = -Math.sin(a);
      bp[o + 5] = Math.sin(a);
      bp[o + 6] = Math.cos(a);
    });
  }
  // Uniform-scale YXZ (yaw, then pitch, then roll) transform from mp = [x,y,z,pitch,yaw,roll,sx,sy,sz].
  function composeInto(e, o) {
    const a = Math.cos(mp[3]),
      b = Math.sin(mp[3]),
      c = Math.cos(mp[4]),
      d = Math.sin(mp[4]),
      e1 = Math.cos(mp[5]),
      f = Math.sin(mp[5]),
      ce = c * e1,
      cf = c * f,
      de = d * e1,
      df = d * f,
      sx = mp[6],
      sy = mp[7],
      sz = mp[8];
    e[o] = (ce + df * b) * sx;
    e[o + 1] = a * f * sx;
    e[o + 2] = (cf * b - de) * sx;
    e[o + 3] = 0;
    e[o + 4] = (de * b - cf) * sy;
    e[o + 5] = a * e1 * sy;
    e[o + 6] = (df + ce * b) * sy;
    e[o + 7] = 0;
    e[o + 8] = a * d * sz;
    e[o + 9] = -b * sz;
    e[o + 10] = a * c * sz;
    e[o + 11] = 0;
    e[o + 12] = mp[0];
    e[o + 13] = mp[1];
    e[o + 14] = mp[2];
    e[o + 15] = 1;
  }
  function poseBalloons(live) {
    const t = clock[C_TIME],
      night = clock[C_NIGHT],
      fm = flames.instanceMatrix.array,
      fc = flames.instanceColor.array;
    visibleBalloons = economyOn ? ECONOMY_BALLOONS : B;
    for (let i = 0; i < B; i++) {
      const mesh = balloons[i].mesh,
        shown = i < visibleBalloons;
      mesh.visible = shown;
      if (!shown) continue;
      const o = i * BP,
        phase = bp[o + 7],
        s = bp[o + 15],
        ph = bp[o + 12] * t + phase,
        u = Math.sin(ph) * bp[o + 13],
        v = Math.cos(ph) * bp[o + 14];
      let x = bp[o] + bp[o + 3] * u + bp[o + 5] * v,
        y =
          bp[o + 2] + BOB * (0.7 * Math.sin(0.23 * t + phase * 1.7) + 0.3 * Math.sin(0.11 * t + phase * 0.6)),
        z = bp[o + 1] + bp[o + 4] * u + bp[o + 6] * v,
        yaw = (bp[o + 8] + 0.02 * t) % TAU,
        launch = 0;
      bstill[i] = 0;
      if (i === STATION_CYCLE.balloon && station[0] > 0) {
        const C = STATION_CYCLE;
        let q = (t + C.offset) % C.period;
        if (q < 0) q += C.period;
        const dx = station[1],
          dy = station[2] + C.bob * Math.sin(0.5 * t + phase),
          dz = station[3],
          hx = dx + station[4] * C.outward,
          hy = station[2] + C.climb,
          hz = dz + station[5] * C.outward;
        // k: how far from the free drift (0) towards the hover point over the mast (1); m: from there down (1).
        let k = 1,
          m = 1;
        if (q < C.dock) bstill[i] = 1;
        else if (q < C.rise) {
          const e = (q - C.dock) / (C.rise - C.dock);
          m = 1 - e * e * (3 - 2 * e);
          launch = 1;
        } else if (q < C.out) {
          const e = (q - C.rise) / (C.out - C.rise);
          k = 1 - e * e * (3 - 2 * e);
          m = 0;
        } else if (q < C.free) k = m = 0;
        else if (q < C.back) {
          const e = (q - C.free) / (C.back - C.free);
          k = e * e * (3 - 2 * e);
          m = 0;
        } else {
          const e = (q - C.back) / (C.period - C.back);
          m = e * e * (3 - 2 * e);
          launch = 0.5;
        }
        x += (hx + (dx - hx) * m - x) * k;
        y += (hy + (dy - hy) * m - y) * k;
        z += (hz + (dz - hz) * m - z) * k;
        // Docked, the basket faces its gangway; it turns slowly into the free spin as it leaves.
        const turn = Math.atan2(Math.sin(yaw - station[6]), Math.cos(yaw - station[6]));
        yaw = station[6] + turn * (1 - m * k);
      }
      bpos[i * 3] = x;
      bpos[i * 3 + 1] = y;
      bpos[i * 3 + 2] = z;
      mesh.position.x = x;
      mesh.position.y = y;
      mesh.position.z = z;
      // Slow spin and a faint sway, written straight into the local matrix.
      mp[0] = x;
      mp[1] = y;
      mp[2] = z;
      mp[3] = 0.012 * Math.sin(0.5 * t + phase);
      mp[4] = yaw;
      mp[5] = 0.015 * Math.sin(0.37 * t + phase * 2);
      mp[6] = s;
      mp[7] = s;
      mp[8] = s;
      const me = mesh.matrix.elements;
      composeInto(me, 0);
      mesh.matrixWorldNeedsUpdate = true;
      // Burner: a pilot light with bursts every 13–22 s; the flame sits on the burner inside the throat.
      let burn = 0,
        flicker = 1;
      if (live) {
        const period = bp[o + 9],
          length = bp[o + 10];
        let q = (t + bp[o + 11]) % period;
        if (q < 0) q += period;
        const rise = clamp(q / 0.3, 0, 1),
          fall = clamp((q - length + 0.4) / 0.4, 0, 1);
        burn = rise * rise * (3 - 2 * rise) * (1 - fall * fall * (3 - 2 * fall));
        // The burner roars while a balloon climbs off the station's mast.
        if (launch > burn) burn = launch * (0.75 + 0.25 * Math.sin(1.3 * t));
        flicker = 0.86 + 0.14 * Math.sin(29 * t + phase * 5) * Math.sin(17.3 * t + phase);
      }
      const h = (0.42 + 0.95 * burn) * flicker,
        w = 0.75 + 0.35 * burn,
        k = i * 16;
      fm[k] = me[0] * w;
      fm[k + 1] = me[1] * w;
      fm[k + 2] = me[2] * w;
      fm[k + 3] = 0;
      fm[k + 4] = me[4] * h;
      fm[k + 5] = me[5] * h;
      fm[k + 6] = me[6] * h;
      fm[k + 7] = 0;
      fm[k + 8] = me[8] * w;
      fm[k + 9] = me[9] * w;
      fm[k + 10] = me[10] * w;
      fm[k + 11] = 0;
      fm[k + 12] = me[12] + me[4] * FLAME_Y;
      fm[k + 13] = me[13] + me[5] * FLAME_Y;
      fm[k + 14] = me[14] + me[6] * FLAME_Y;
      fm[k + 15] = 1;
      const intensity = (1.05 + 1.5 * night) * (0.55 + 0.45 * burn) * flicker;
      fc[i * 3] = intensity;
      fc[i * 3 + 1] = 0.62 * intensity;
      fc[i * 3 + 2] = 0.27 * intensity;
      balloons[i].material.emissiveIntensity = night * (0.38 + 1.1 * burn * flicker);
    }
    flames.count = visibleBalloons;
    flameMaterial.userData.clock[0] = clock[C_TIME];
    flames.instanceMatrix.needsUpdate = true;
    flames.instanceColor.needsUpdate = true;
  }

  // Next number of flock f's random table. Only the rare leg changes use it: the frame loop reads rtab inline.
  function draw(f) {
    ridx[f] = (ridx[f] + 1) & (RT - 1);
    return rtab[f * RT + ridx[f]];
  }
  // Metres by which (x, z) lies inside the zone the leaders keep to (negative: outside it): the bird shell less
  // ZONE_PAD, and the far arc. Point in sc[1], sc[2] (no double crosses the call), result in sc[0].
  function zoneMargin() {
    const x = sc[1],
      z = sc[2],
      d = Math.sqrt(x * x + z * z);
    let a = Math.atan2(x, z) - FAR_SIDE;
    a -= TAU * Math.floor(a / TAU + 0.5);
    sc[0] = Math.min(d - lim[0] - ZONE_PAD, lim[1] - ZONE_PAD - d, (FLOCK_ARC - Math.abs(a)) * d);
  }
  // A thermal leg for flock f: a circle on whichever side leaves room for it, the random side first.
  function soarLeg(f) {
    const o = f * FS,
      x = fd[o + LX],
      z = fd[o + LZ],
      t = clock[C_QUERY];
    const rho = 12 + 16 * draw(f),
      side = draw(f) < 0.5 ? -1 : 1,
      c = Math.cos(fd[o + HD]) * rho,
      s = Math.sin(fd[o + HD]) * rho;
    sc[1] = x + side * c;
    sc[2] = z - side * s;
    zoneMargin();
    const room = sc[0];
    sc[1] = x - side * c;
    sc[2] = z + side * s;
    zoneMargin();
    fd[o + TR_TGT] = ((room >= rho || room >= sc[0] ? side : -side) * fd[o + SP_TGT]) / rho;
    fd[o + LEG_END] = t + 12 + 14 * draw(f);
  }
  // A chord leg for flock f: its target on the far arc.
  function chordTarget(f) {
    const o = f * FS,
      x = fd[o + LX],
      z = fd[o + LZ];
    // The first of six random points on the far arc that makes a real chord (45-120 m, not a hop and not the
    // whole arc) clear of the zone's inner edge; failing that the longest clear one, or the least bad.
    let far = -Infinity;
    const [r0, r1] = FLOCK_STYLE[f].reach;
    for (let k = 0; k < 6; k++) {
      const az = FAR_SIDE + (2 * draw(f) - 1) * (FLOCK_ARC - 0.35),
        // From 16 m inside the zone's inner edge: a chord passing within 12 m of it is turned down below, so a nearer
        // target would never be chosen and the near flock would drift out to the middle distance.
        d = lim[0] + ZONE_PAD + 16 + (r0 + draw(f) * (r1 - r0)) * (lim[1] - lim[0] - 2 * ZONE_PAD - 20),
        px = Math.sin(az) * d,
        pz = Math.cos(az) * d,
        sx = px - x,
        sz = pz - z,
        u = clamp(-(x * sx + z * sz) / (sx * sx + sz * sz + 1e-6), 0, 1),
        near = Math.hypot(x + sx * u, z + sz * u),
        len = Math.sqrt(sx * sx + sz * sz);
      let away = len;
      if (near < lim[0] + ZONE_PAD + 12) away = near - 1e5;
      else if (len > 45 && len < 120) away = 1e5 - k;
      // Never a target close to a balloon (any height).
      for (let b = 0; b < visibleBalloons; b++) {
        const r = 6.5 * bp[b * BP + 15] + 24,
          dx = bpos[b * 3] - px,
          dz = bpos[b * 3 + 2] - pz;
        if (dx * dx + dz * dz < r * r) away -= 1e6;
      }
      if (away > far) {
        far = away;
        fd[o + TX] = px;
        fd[o + TZ] = pz;
      }
    }
  }
  // Start the next leg of flock f's route at clock[C_QUERY]: a shape other than the last one (or `forced`), a
  // speed, a target height and either the circle of a thermal or a point on the far arc to fly to.
  function nextLeg(f, forced) {
    const o = f * FS,
      t = clock[C_QUERY],
      style = FLOCK_STYLE[f],
      y = fd[o + LY],
      lo = Math.max(style.band[0], lim[2] + 6),
      hi = Math.min(style.band[1], lim[3] - 6);
    let mode = forced;
    if (mode < 0) mode = (fd[o + MODE] + (draw(f) < 0.5 ? 1 : 2)) % 3;
    fd[o + MODE] = mode;
    fd[o + LEG_T0] = t;
    fd[o + SWAY_B] = 0;
    fd[o + SP_TGT] = style.speed * LEG_SPEED[mode] * (0.93 + 0.14 * draw(f));
    // Height: a thermal lifts the flock; other legs trade it away or climb elsewhere, by at least 4 m.
    let yt = lo + draw(f) * (hi - lo);
    if (mode === SOAR) yt = y < hi - 4 ? Math.min(hi, y + 4 + 9 * draw(f)) : lo + 0.5 * draw(f) * (hi - lo);
    else if (Math.abs(yt - y) < 4) yt = clamp(y + (y > 0.5 * (lo + hi) ? -1 : 1) * (4 + 4 * draw(f)), lo, hi);
    fd[o + YT] = yt;
    if (mode === SOAR) {
      soarLeg(f);
      return;
    }
    chordTarget(f);
    fd[o + LEG_END] = t + 40;
    if (mode === SWAY) {
      fd[o + SWAY_B] = 0.35 + 0.25 * draw(f);
      fd[o + SWAY_W] = TAU / (11 + 6 * draw(f));
      fd[o + SWAY_P] = TAU * draw(f);
    }
  }
  // Turn rate (into sc[0]) that brings leader o onto its chord target, weaving on a SWAY.
  function steerToTarget(o) {
    const x = fd[o + LX],
      z = fd[o + LZ],
      t = clock[C_QUERY],
      hd = fd[o + HD];
    const dx = fd[o + TX] - x,
      dz = fd[o + TZ] - z,
      dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 16) fd[o + LEG_END] = t;
    // The weave fades out on the way in so a leg ends on its target rather than beside it.
    const err =
      Math.atan2(dx, dz) +
      fd[o + SWAY_B] *
        Math.min(1, dist / 50) *
        Math.sin(fd[o + SWAY_W] * (t - fd[o + LEG_T0]) + fd[o + SWAY_P]) -
      hd;
    sc[0] = Math.max(
      -0.8 * MAX_TURN,
      Math.min(0.8 * MAX_TURN, 1.4 * (err - TAU * Math.floor(err / TAU + 0.5)))
    );
  }
  // Leader o: a balloon ahead overrides the turn rate in sc[0] and the target height.
  function dodgeBalloons(o) {
    const x = fd[o + LX],
      y = fd[o + LY],
      z = fd[o + LZ],
      sp = fd[o + SP],
      sin = Math.sin(fd[o + HD]),
      cos = Math.cos(fd[o + HD]);
    // A balloon near this height and close to a point 4.5 s ahead: turn away from the side it is on ...
    const bx = x + sin * sp * 4.5,
      bz = z + cos * sp * 4.5;
    for (let k = 0; k < visibleBalloons; k++) {
      const s = bp[k * BP + 15],
        r = 6.5 * s + 14,
        dx = bpos[k * 3] - bx,
        dz = bpos[k * 3 + 2] - bz;
      if (dx * dx + dz * dz < r * r && Math.abs(bpos[k * 3 + 1] - 1.5 * s - y) < 7 * s + 10) {
        sc[0] = (dx * cos - dz * sin > 0 ? -1 : 1) * MAX_TURN;
        // ... and go over or under it, whichever is nearer, within the sky the birds may use.
        fd[o + YT] = Math.max(lim[2] + 6, Math.min(lim[3] - 6, y + (bpos[k * 3 + 1] - 1.5 * s > y ? -8 : 8)));
        break;
      }
    }
  }
  // Fly flock f's leader on from its last update to clock[C_QUERY]: pick the turn rate for the current leg (or
  // steer back into the zone / round a balloon), then integrate heading, speed, height and position.
  // Math.min/max rather than clamp() below: with six clamp() calls the function outgrows V8's inlining budget and
  // every call then boxes its doubles on the heap.
  function updateLeader(f) {
    const o = f * FS,
      t = clock[C_QUERY],
      h = t - fd[o + LT];
    fd[o + LT] = t;
    // A jump of the sky clock (setTime) only restarts the integration from where the flock is.
    if (!(h > 0 && h <= 0.3)) return;
    if (t >= fd[o + LEG_END]) nextLeg(f, -1);
    const x = fd[o + LX],
      y = fd[o + LY],
      z = fd[o + LZ],
      sp = fd[o + SP],
      mode = fd[o + MODE],
      sin = Math.sin(fd[o + HD]),
      cos = Math.cos(fd[o + HD]),
      ax = x + sin * sp * LOOK_AHEAD,
      az = z + cos * sp * LOOK_AHEAD;
    let hd = fd[o + HD],
      cmd = fd[o + TR_TGT];
    sc[0] = cmd;
    if (mode !== SOAR) steerToTarget(o);
    dodgeBalloons(o);
    cmd = sc[0];
    // Nearing the edge of the zone the route gives way, ever more, to a turn back toward the middle of the shell.
    sc[1] = ax;
    sc[2] = az;
    zoneMargin();
    // Computed on every call, even at zero weight, so the code stays hot and allocation-free.
    const pull = Math.max(0, Math.min(1, (14 - sc[0]) / 12)),
      heart = 0.5 * (lim[0] + lim[1]);
    let a = Math.atan2(x, z) - FAR_SIDE;
    a = Math.max(0.6 - FLOCK_ARC, Math.min(FLOCK_ARC - 0.6, a - TAU * Math.floor(a / TAU + 0.5)));
    const back = Math.atan2(Math.sin(FAR_SIDE + a) * heart - x, Math.cos(FAR_SIDE + a) * heart - z) - hd;
    cmd +=
      (Math.max(-MAX_TURN, Math.min(MAX_TURN, 2 * (back - TAU * Math.floor(back / TAU + 0.5)))) - cmd) * pull;
    const tr = fd[o + TR] + (cmd - fd[o + TR]) * Math.min(1, h * 2.5),
      nsp = sp + (fd[o + SP_TGT] - sp) * Math.min(1, h * 0.6),
      mid = hd + 0.5 * tr * h,
      vyc =
        Math.max(-1.3, Math.min(mode === SOAR ? 0.9 : 1.1, 0.25 * (fd[o + YT] - y))) +
        0.25 * Math.sin(0.5 * t + fd[o + SEED]),
      vy = fd[o + VY] + (vyc - fd[o + VY]) * Math.min(1, h * 0.9),
      nx = x + Math.sin(mid) * nsp * h,
      nz = z + Math.cos(mid) * nsp * h,
      ny = Math.max(lim[2] + 4, Math.min(lim[3] - 4, y + vy * h));
    hd += tr * h;
    hd -= TAU * Math.floor(hd / TAU + 0.5);
    if (!Number.isFinite(nx + ny + nz + hd + tr + nsp)) return;
    fd[o + HD] = hd;
    fd[o + TR] = tr;
    fd[o + SP] = nsp;
    fd[o + LX] = nx;
    fd[o + LY] = ny;
    fd[o + LZ] = nz;
    fd[o + FX] = Math.sin(hd);
    fd[o + FZ] = Math.cos(hd);
    fd[o + VX] = fd[o + FX] * nsp;
    fd[o + VY] = vy;
    fd[o + VZ] = fd[o + FZ] * nsp;
  }
  // Wandering formation slot of bird b round its leader, in the leader's heading frame.
  function slotTarget(f, b) {
    const o = f * FS,
      t = clock[C_QUERY],
      j = b * 4,
      w = t * 0.35 + slot[j + 3],
      ox = slot[j] + 1.4 * Math.sin(w),
      oy = slot[j + 1] + 0.8 * Math.sin(w * 0.8 + 1),
      oz = slot[j + 2] + 1.4 * Math.cos(w * 0.9),
      fx = fd[o + FX],
      fz = fd[o + FZ];
    tgt[0] = fd[o + LX] + fz * ox + fx * oz;
    tgt[1] = fd[o + LY] + oy;
    tgt[2] = fd[o + LZ] - fx * ox + fz * oz;
  }
  function placeBird(f, b) {
    const o = f * FS,
      i = b * 3;
    slotTarget(f, b);
    pos[i] = tgt[0];
    pos[i + 1] = clamp(tgt[1], lim[2] + 0.5, lim[3] - 0.5);
    pos[i + 2] = tgt[2];
    vel[i] = fd[o + VX];
    vel[i + 1] = fd[o + VY];
    vel[i + 2] = fd[o + VZ];
    heading[b] = Math.atan2(vel[i], vel[i + 2]);
    roll[b] = 0;
  }
  function resetFlocks() {
    clock[C_QUERY] = clock[C_TIME];
    for (let f = 0; f < FLOCKS; f++) {
      const o = f * FS,
        random = mulberry32(911 + f * 37),
        { band, speed } = FLOCK_STYLE[f],
        az = FAR_SIDE + [-0.55, 0.95, -1.45][f],
        d = lim[0] + ZONE_PAD + 6 + (lim[1] - lim[0] - 2 * ZONE_PAD - 12) * random();
      fplaced[f] = 0;
      const table = mulberry32(4271 + f * 1543);
      for (let j = 0; j < RT; j++) rtab[f * RT + j] = table();
      ridx[f] = 0;
      // Start on the far arc heading along it, flying the first leg at once: one flock of each shape.
      fd[o + LX] = Math.sin(az) * d;
      fd[o + LY] = band[0] + (band[1] - band[0]) * (0.3 + 0.4 * random());
      fd[o + LZ] = Math.cos(az) * d;
      fd[o + HD] = az + (f === 1 ? -1 : 1) * 0.5 * Math.PI;
      fd[o + SP] = speed;
      fd[o + TR] = fd[o + VY] = 0;
      fd[o + LT] = clock[C_TIME];
      nextLeg(f, f);
      fd[o + FX] = Math.sin(fd[o + HD]);
      fd[o + FZ] = Math.cos(fd[o + HD]);
      fd[o + VX] = fd[o + FX] * speed;
      fd[o + VZ] = fd[o + FZ] * speed;
    }
    refreshCounts();
  }
  function refreshCounts() {
    const base = FLOCK_SIZES[season] || FLOCK_SIZES.summer,
      roost = economyOn ? 0 : clamp((0.75 - clock[C_NIGHT]) / 0.4, 0, 1);
    clock[C_QUERY] = clock[C_TIME];
    for (let f = 0; f < FLOCKS; f++) {
      const count = Math.round(base[f] * roost);
      fcount[f] = count;
      // Birds that rejoin start on their slot rather than where they were last seen.
      for (let k = fplaced[f]; k < count; k++) placeBird(f, f * MAX_FLOCK + k);
      fplaced[f] = count;
    }
  }
  function stepBirds() {
    const dt = clock[C_DT],
      steps = Math.min(6, Math.max(1, Math.ceil(dt * 20))),
      h = dt / steps,
      inner = lim[0],
      outer = lim[1],
      low = lim[2],
      high = lim[3];
    const cam = watchedCamera ? watchedCamera.matrixWorld.elements : null;
    for (let s = 1; s <= steps; s++) {
      clock[C_QUERY] = clock[C_TIME] - dt + h * s;
      for (let f = 0; f < FLOCKS; f++) {
        updateLeader(f);
        const o = f * FS,
          first = f * MAX_FLOCK,
          last = first + fcount[f],
          lvx = fd[o + VX],
          lvy = fd[o + VY],
          lvz = fd[o + VZ];
        for (let b = first; b < last; b++) {
          const i = b * 3;
          let px = pos[i],
            py = pos[i + 1],
            pz = pos[i + 2],
            vx = vel[i],
            vy = vel[i + 1],
            vz = vel[i + 2];
          slotTarget(f, b);
          // Boids-lite: spring to a wandering slot round the leader, match its velocity, keep apart.
          let ax = 1.1 * (tgt[0] - px) + 1.6 * (lvx - vx),
            ay = 1.1 * (tgt[1] - py) + 1.6 * (lvy - vy),
            az = 1.1 * (tgt[2] - pz) + 1.6 * (lvz - vz);
          for (let n = first; n < last; n++) {
            if (n === b) continue;
            const dx = px - pos[n * 3],
              dy = py - pos[n * 3 + 1],
              dz = pz - pos[n * 3 + 2],
              d2 = dx * dx + dy * dy + dz * dz;
            if (d2 < 6.25 && d2 > 1e-8) {
              const d = Math.sqrt(d2),
                g = ((2.5 - d) * 4) / d;
              ax += dx * g;
              ay += dy * g;
              az += dz * g;
            }
          }
          // Shy of the viewer and of the balloons.
          if (cam !== null) {
            const dx = px - cam[12],
              dy = py - cam[13],
              dz = pz - cam[14],
              d2 = dx * dx + dy * dy + dz * dz;
            if (d2 < 676 && d2 > 1e-6) {
              const d = Math.sqrt(d2),
                g = ((26 - d) * 1.6) / d;
              ax += dx * g;
              ay += dy * g;
              az += dz * g;
            }
          }
          for (let k = 0; k < visibleBalloons; k++) {
            // Round the middle of the envelope-and-basket (1.6 m per scale below the balloon's origin).
            const s = bp[k * BP + 15],
              r = 7.1 * s + 5.5,
              dx = px - bpos[k * 3],
              dy = py - bpos[k * 3 + 1] + 1.6 * s,
              dz = pz - bpos[k * 3 + 2],
              d2 = dx * dx + dy * dy + dz * dz;
            if (d2 < r * r && d2 > 1e-6) {
              const d = Math.sqrt(d2),
                g = ((r - d) * 5) / d;
              ax += dx * g;
              ay += dy * g;
              az += dz * g;
            }
          }
          const hd = Math.sqrt(px * px + pz * pz);
          if (hd > 1e-6) {
            if (hd < inner + 5) {
              const g = ((inner + 5 - hd) * 2) / hd;
              ax += px * g;
              az += pz * g;
            } else if (hd > outer - 5) {
              const g = ((outer - 5 - hd) * 2) / hd;
              ax += px * g;
              az += pz * g;
            }
          }
          if (py < low + 6) ay += (low + 6 - py) * 2;
          else if (py > high - 5) ay += (high - 5 - py) * 2;
          const a = Math.sqrt(ax * ax + ay * ay + az * az);
          if (a > 16) {
            const g = 16 / a;
            ax *= g;
            ay *= g;
            az *= g;
          }
          vx += ax * h;
          vy += ay * h;
          vz += az * h;
          const sp = Math.sqrt(vx * vx + vy * vy + vz * vz);
          if (sp > 15) {
            const g = 15 / sp;
            vx *= g;
            vy *= g;
            vz *= g;
          } else if (sp < 3.5) {
            if (sp > 1e-6) {
              const g = 3.5 / sp;
              vx *= g;
              vy *= g;
              vz *= g;
            } else {
              vx = fd[o + FX] * 3.5;
              vy = 0;
              vz = fd[o + FZ] * 3.5;
            }
          }
          if (vy > 3.5) vy = 3.5;
          else if (vy < -3.5) vy = -3.5;
          px += vx * h;
          py += vy * h;
          pz += vz * h;
          // Hard keep-out shell; the soft terms above normally keep birds well inside it.
          if (py < low + 0.5) py = low + 0.5;
          else if (py > high - 0.5) py = high - 0.5;
          const nd = Math.sqrt(px * px + pz * pz);
          if (nd > 1e-6 && (nd < inner + 0.5 || nd > outer - 0.5)) {
            const g = (nd < inner + 0.5 ? inner + 0.5 : outer - 0.5) / nd;
            px *= g;
            pz *= g;
          }
          if (
            Number.isFinite(px) &&
            Number.isFinite(py) &&
            Number.isFinite(pz) &&
            Number.isFinite(vx) &&
            Number.isFinite(vy) &&
            Number.isFinite(vz)
          ) {
            pos[i] = px;
            pos[i + 1] = py;
            pos[i + 2] = pz;
            vel[i] = vx;
            vel[i + 1] = vy;
            vel[i + 2] = vz;
          } else placeBird(f, b);
        }
      }
    }
  }
  function writeBirds(live) {
    selectCloseBirds();
    const dt = clock[C_DT],
      advance = live && dt > 0,
      m = birds.instanceMatrix.array;
    let k = 0,
      closeCount = 0;
    for (let f = 0; f < FLOCKS; f++) {
      const first = f * MAX_FLOCK,
        last = first + fcount[f],
        r = f * RT;
      for (let b = first; b < last; b++) {
        const i = b * 3,
          j = b * 4,
          vx = vel[i],
          vy = vel[i + 1],
          vz = vel[i + 2],
          hs = Math.sqrt(vx * vx + vz * vz),
          yaw = Math.atan2(vx, vz);
        let turn = yaw - heading[b];
        if (turn > Math.PI) turn -= TAU;
        else if (turn < -Math.PI) turn += TAU;
        heading[b] = yaw;
        if (advance) {
          roll[b] += (clamp((-turn / dt) * hs * 0.09, -0.65, 0.65) - roll[b]) * Math.min(1, dt * 5);
          // Flap in bursts, glide in between; a climbing bird always flaps. The flock's current leg sets the
          // rhythm (long glides on a thermal, short ones on a crossing) and each bird's own vigor tilts it.
          flap[j + 3] -= dt;
          if (flap[j + 3] <= 0) {
            gliding[b] = gliding[b] ? 0 : 1;
            ridx[f] = (ridx[f] + 1) & (RT - 1);
            const leg = fd[f * FS + MODE],
              draw = rtab[r + ridx[f]];
            flap[j + 3] = gliding[b]
              ? ((1.8 + draw * 3.2) * LEG_GLIDE[leg]) / vigor[b]
              : (1.4 + draw * 2.6) * LEG_FLAP[leg] * vigor[b];
          }
          if (vy > 1.5) gliding[b] = 0;
          flap[j + 1] += ((gliding[b] ? 0.06 : 0.55 + 0.4 * vigor[b]) - flap[j + 1]) * Math.min(1, dt * 3.2);
          flap[j] = (flap[j] + dt * flap[j + 2] * TAU * (0.3 + 0.7 * flap[j + 1])) % TAU;
        }
        mp[0] = pos[i];
        mp[1] = pos[i + 1];
        mp[2] = pos[i + 2];
        mp[3] = clamp(-Math.atan2(vy, Math.max(hs, 0.1)), -0.45, 0.45);
        mp[4] = yaw;
        // Wings rock a little in a glide and hold steadier while flapping.
        mp[5] = roll[b] + (gliding[b] ? 0.05 : 0.02) * Math.sin(clock[C_TIME] * 1.1 + slot[j + 3]);
        mp[6] = mp[7] = mp[8] = size[b];
        if (closeIds.includes(b)) {
          composeInto(closeBirds.instanceMatrix.array, closeCount * 16);
          closeFlapArray[closeCount * 2] = flap[j];
          closeFlapArray[closeCount * 2 + 1] = live ? flap[j + 1] : 0;
          closeCount++;
        } else {
          composeInto(m, k * 16);
          flapArray[k * 2] = flap[j];
          flapArray[k * 2 + 1] = live ? flap[j + 1] : 0;
          k++;
        }
      }
    }
    closeBirds.count = closeCount;
    closeBirds.visible = closeCount > 0;
    closeBirds.instanceMatrix.needsUpdate = true;
    closeFlapAttribute.needsUpdate = true;
    birds.count = k;
    birds.visible = k > 0;
    birds.instanceMatrix.needsUpdate = true;
    flapAttribute.needsUpdate = true;
  }
  function refresh(live) {
    poseBalloons(live);
    refreshCounts();
    if (clock[C_DT] > 0) stepBirds();
    writeBirds(live);
  }
  function stationPhase() {
    const C = STATION_CYCLE,
      q = (((clock[C_TIME] + C.offset) % C.period) + C.period) % C.period,
      name = ['docked', 'climbing', 'leaving', 'free', 'returning', 'landing'][
        [C.dock, C.rise, C.out, C.free, C.back, Infinity].findIndex(end => q < end)
      ];
    return {
      name,
      at: q,
      position: [...bpos.slice(C.balloon * 3, C.balloon * 3 + 3)]
    };
  }
  // Sphere sph = [x,y,z,r] against the six planes of the last camera, all in typed arrays.
  function sphereInView() {
    for (let p = 0; p < 24; p += 4)
      if (planes[p] * sph[0] + planes[p + 1] * sph[1] + planes[p + 2] * sph[2] + planes[p + 3] < -sph[3])
        return false;
    return true;
  }
  place();
  resetFlocks();
  clock[C_DT] = 0;
  refresh(false);

  return {
    group,
    // Re-parent into a rebuilt world; layout gives the ring radius and how far scenery was pushed out.
    // station: { x, y, z } basket floor at the launch mast, { out: {x, z} } away from the station, yaw facing it.
    attach(scene, { radius, scenicPush, station: dock = null } = {}) {
      if (disposed) return;
      const spec = balloons[STATION_CYCLE.balloon];
      station[0] = dock && [dock.x, dock.y, dock.z].every(Number.isFinite) ? 1 : 0;
      if (station[0]) {
        const l = Math.hypot(dock.out?.x || 0, dock.out?.z || 0) || 1;
        station[1] = dock.x;
        station[2] = dock.y - spec.extent.bottom * spec.spec.scale;
        station[3] = dock.z;
        station[4] = (dock.out?.x || 0) / l;
        station[5] = (dock.out?.z || 0) / l;
        station[6] = Number.isFinite(dock.yaw) ? dock.yaw : 0;
      }
      if (scene && group.parent !== scene) scene.add(group);
      const r = Number.isFinite(radius) ? clamp(radius, 8, 200) : 23,
        push = Number.isFinite(scenicPush) ? Math.max(0, scenicPush) : 0;
      if (r !== layout.radius || push !== layout.scenicPush) {
        layout.radius = r;
        layout.scenicPush = push;
        place();
        resetFlocks();
      }
      clock[C_DT] = 0;
      refresh(false);
      dirty = true;
    },
    // Wall-clock driven, capped at 250 ms per frame; nothing moves while animate is false or in economy.
    update(now, animate) {
      if (disposed) return;
      if (animating !== !!animate) {
        animating = !!animate;
        dirty = true;
      }
      const live = animating && !economyOn;
      let dt = 0;
      if (Number.isFinite(now)) {
        if (hasLast && now > clock[C_LAST]) dt = Math.min(0.25, (now - clock[C_LAST]) * 0.001);
        clock[C_LAST] = now;
        hasLast = true;
      }
      if (!live) dt = 0;
      clock[C_DT] = dt;
      if (dt > 0) clock[C_TIME] += dt;
      if (dt > 0 || dirty) {
        refresh(live);
        dirty = false;
      }
    },
    // True only while moving life is on screen: any flock, or a balloon near enough for its drift to read.
    needsAnimation(camera) {
      if (disposed || !camera) return false;
      watchedCamera = camera;
      const view = camera.matrixWorld.elements;
      for (let i = 0; i < 32; i++) {
        const value = i < 16 ? view[i] : camera.projectionMatrix.elements[i - 16];
        if (value !== closeCamera[i]) {
          closeCamera[i] = value;
          dirty = true;
        }
      }
      if (!animating || economyOn || !group.parent || !group.visible) return false;
      const m = viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).elements,
        cm = camera.matrixWorld.elements,
        cx = cm[12],
        cy = cm[13],
        cz = cm[14];
      for (let p = 0; p < 6; p++) {
        const r = PLANE_ROW[p],
          s = PLANE_SIGN[p],
          a = m[3] + s * m[r],
          b = m[7] + s * m[4 + r],
          c = m[11] + s * m[8 + r],
          d = m[15] + s * m[12 + r],
          l = Math.sqrt(a * a + b * b + c * c),
          q = l > 0 ? 1 / l : 0;
        planes[p * 4] = a * q;
        planes[p * 4 + 1] = b * q;
        planes[p * 4 + 2] = c * q;
        planes[p * 4 + 3] = d * q;
      }
      for (let f = 0; f < FLOCKS; f++) {
        if (!fcount[f]) continue;
        const o = f * FS;
        sph[0] = fd[o + LX];
        sph[1] = fd[o + LY];
        sph[2] = fd[o + LZ];
        sph[3] = FLOCK_EXTENT;
        const dx = sph[0] - cx,
          dy = sph[1] - cy,
          dz = sph[2] - cz;
        if (Math.sqrt(dx * dx + dy * dy + dz * dz) - sph[3] < BIRD_RANGE && sphereInView()) return true;
      }
      for (let i = 0; i < visibleBalloons; i++) {
        // A balloon resting on its mast only bobs a few centimetres.
        if (bstill[i]) continue;
        const s = bp[i * BP + 15];
        sph[0] = bpos[i * 3];
        sph[1] = bpos[i * 3 + 1] - 1.5 * s;
        sph[2] = bpos[i * 3 + 2];
        sph[3] = 8.5 * s;
        const dx = sph[0] - cx,
          dy = sph[1] - cy,
          dz = sph[2] - cz;
        if (Math.sqrt(dx * dx + dy * dy + dz * dz) - sph[3] < BALLOON_RANGE && sphereInView()) return true;
      }
      return false;
    },
    setEconomy(value) {
      if (disposed || economyOn === !!value) return;
      economyOn = !!value;
      dirty = true;
    },
    setSeason(name) {
      if (disposed || !FLOCK_SIZES[name] || season === name) return;
      season = name;
      dirty = true;
    },
    setLight({ night = 0 } = {}) {
      let n = +night;
      if (!(n > 0)) n = 0;
      else if (n > 1) n = 1;
      const old = clock[C_NIGHT];
      if (n - old < 1e-3 && old - n < 1e-3) return;
      clock[C_NIGHT] = n;
      dirty = true;
    },
    // Diagnostics for tests and audits (allocates; not for the frame loop).
    audit() {
      return {
        balloons: visibleBalloons,
        birds: birds.count + closeBirds.count,
        closeBirds: closeBirds.count,
        closeBirdIds: Array.from(closeIds).filter(i => i >= 0),
        flocks: [...fcount],
        legs: Array.from({ length: FLOCKS }, (_, f) => fd[f * FS + MODE]),
        leaders: Array.from({ length: FLOCKS }, (_, f) => [
          fd[f * FS + LX],
          fd[f * FS + LY],
          fd[f * FS + LZ],
          0
        ]),
        season,
        night: clock[C_NIGHT],
        economy: economyOn,
        simTime: clock[C_TIME],
        layout: { ...layout },
        station: station[0] ? stationPhase() : null,
        limits: { ...limits },
        triangles: balloons.map(b => b.mesh.geometry.index.count / 3)
      };
    },
    // Debug and captures: jump the sky clock (seconds).
    setTime(seconds) {
      if (disposed || !Number.isFinite(seconds)) return;
      clock[C_TIME] = seconds;
      dirty = true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      for (const resource of resources) resource.dispose();
      group.clear();
      watchedCamera = null;
    }
  };
}
