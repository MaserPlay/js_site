// Mountain ring, variant B (the default; ?mountains=a and ?mountains=old are the fallbacks): a rocky massif in
// four concentric ranges. Each range is a real 3D surface with a designed crest line (a few dominant, sharp
// summits and many broken lesser peaks with cols between), arêtes running down from the summits, cirques under
// the crest, couloirs and buttresses, and cliff bands stepped into the slope along tilted strata. All four share
// one geometry and one material (one draw call). The per-pixel shader works the rock: fractured blocks with
// cracks, strata, ledges, wet streaks and talus below the cliffs; snow on summits, ledges, couloirs and gentle
// ground, blown off the steep faces; only a little muted scrub at the very foot. Every detail is filtered by the
// pixel's footprint (fwidth), so it stays crisp without shimmering; aerial perspective is thin on the near ranges.
import {
  createGradientNoise,
  ridgedMultifractal,
  ringNoise as ringSample,
  smoothstep as smooth,
  wrapAngle
} from './terrain-noise.mjs';

// Ranges, near to far. crest: mean crest radius (m) and how far it wanders; front/back: slope widths (m);
// columns around the ring and rows on each slope; base/top: crest height range (world y); jag: lesser-peak
// relief (m) and their spacing along the crest (m); spacing: couloir spacing (m); terrace: how strongly the
// strata step the slope into cliff bands (only where the rows resolve a bed); rough: how much of each finer
// crest octave survives (the share of the octave before it: higher = a more serrated skyline); crag: share of
// the ridged crags (SHAPE_B.crag) cut into the faces. Summits: [angle (atan2(x, z)),
// share of the base..top span, half-width (m)].
export const LAYERS_B = [
  {
    crest: 252,
    wander: 12,
    front: 56,
    back: 34,
    columns: 1280,
    frontRows: 28,
    backRows: 6,
    base: -2,
    top: 44,
    jag: 12,
    peakSpacing: 34,
    spacing: 15,
    terrace: 0.5,
    rough: 0.6,
    crag: 1,
    seed: 1,
    summits: [
      [0.32, 0.75, 55],
      [0.98, 0.95, 70],
      [1.62, 0.7, 55],
      [2.22, 0.8, 60],
      [2.84, 0.95, 70],
      [4.55, 0.85, 60],
      [5.25, 0.95, 70],
      [5.95, 0.75, 55]
    ]
  },
  {
    crest: 335,
    wander: 16,
    front: 68,
    back: 40,
    columns: 1040,
    frontRows: 24,
    backRows: 6,
    base: 6,
    top: 64,
    jag: 15,
    peakSpacing: 42,
    spacing: 19,
    terrace: 0.45,
    rough: 0.56,
    crag: 0.8,
    seed: 2,
    summits: [
      [0.62, 1, 85],
      [1.12, 0.7, 65],
      [1.92, 0.85, 80],
      [2.46, 0.9, 80],
      [3.06, 0.75, 65],
      [4.3, 0.85, 80],
      [5.0, 0.95, 85],
      [5.78, 0.8, 70]
    ]
  },
  {
    crest: 445,
    wander: 20,
    front: 82,
    back: 44,
    columns: 800,
    frontRows: 17,
    backRows: 5,
    base: 16,
    top: 88,
    jag: 17,
    peakSpacing: 55,
    spacing: 24,
    terrace: 0.3,
    rough: 0.5,
    crag: 0.8,
    seed: 3,
    summits: [
      [0.14, 0.9, 110],
      [0.8, 0.75, 90],
      [1.34, 0.95, 110],
      [2.1, 0.85, 100],
      [2.74, 1, 115],
      [4.1, 0.9, 110],
      [4.82, 0.85, 100],
      [5.56, 1, 115]
    ]
  },
  {
    crest: 560,
    wander: 18,
    front: 92,
    back: 30,
    columns: 640,
    frontRows: 14,
    backRows: 4,
    base: 32,
    top: 116,
    jag: 18,
    peakSpacing: 70,
    spacing: 30,
    terrace: 0.12,
    rough: 0.48,
    crag: 0.5,
    seed: 4,
    summits: [
      [0.44, 1, 150],
      [1.02, 0.78, 120],
      [1.66, 0.7, 120],
      [2.36, 0.95, 150],
      [2.98, 0.85, 130],
      [4.42, 1, 150],
      [5.18, 0.85, 130],
      [5.9, 0.95, 140]
    ]
  }
];

// Cross-section and carving. floor: base of every slope (inside the cloud sea); curves: front and back slope
// profiles (above 1 = concave: a steep face under the crest over a talus apron); rowBias packs rows near the
// crest; gully: share of a flank's relief the couloirs cut away; stretch: how fast they wander and fork
// downslope; rugged: share of relief given to ridged buttresses; cirque: share cut into bowls just under the
// crest between the arêtes; areteWidth: half-width (m) of the arête under each summit, widening by areteSpread
// toward the foot; summitCusp: share of a summit's envelope in its sharp cusp (the rest a rounded skirt); crag:
// ridged ribs and crags cut into the faces (wavelength and height in m of the broad one, octaves; the finest
// fades where the grid has fewer than about three rows or columns across it).
export const SHAPE_B = {
  floor: -16,
  seaTop: -4,
  frontCurve: 1.6,
  backCurve: 1.15,
  rowBias: 1.35,
  gully: 0.7,
  stretch: 0.6,
  rugged: 0.08,
  ruggedWavelength: 46,
  cirque: 0.16,
  areteWidth: 9,
  areteSpread: 2,
  summitCusp: 0.68,
  crag: { wavelength: 13, height: 6, octaves: 2 }
};

// Shader band limits: an octave of wavelength L fades out as one pixel's ground footprint grows from
// octave[0] * L to octave[1] * L (well before Nyquist at 0.5 L, so nothing shimmers or speckles); the 1.6 m grain
// by grain[0..1] of its wavelength.
export const BAND_B = { octave: [0.16, 0.36], grain: [0.16, 0.4] };
// Relief shading. bump/crease: strength of the soft and the creased noise normals; fold: sharpness of a crease
// (+ 1.5 fwidth, so it never flips within a pixel); terminator: light = clamp(ndl * a - b), a crisp edge between
// lit and shaded faces; hollowAo/hollowSun: sky and sun taken from gullies and hollows; crackAo: sky taken from
// the cracks between blocks.
export const RELIEF_SHADE_B = {
  bump: 11,
  crease: 13,
  fold: 0.035,
  terminator: [1.2, 0.02],
  hollowAo: [0.36, 0.26],
  hollowSun: 0.4,
  crackAo: 0.35
};
// Aerial perspective is thinned to `near` of the scene fog up to fade[0] metres, full from fade[1] on: the near
// and middle ranges stand out crisp, the far ones still recede.
// Owner, 2026-10-27: the ranges read blurry from the garden; the near and middle ones now keep more of their
// own relief (thinner haze, reaching full only further out).
export const HAZE_B = { near: 0.18, fade: [450, 720] };
// Fractured rock: two jittered 3D lattices of chips, small and tiny (cell: metres across, flat: chip height as a
// share of it, along the bedding; tilt: how far each chip's face turns from the slope, giving planar facets with
// crisp edges). Each lattice fades out as one pixel's footprint grows from fade[0] to fade[1] of the chip height.
// warp: how far (cells per unit of noise) the joints wander; crack: border width (share of a cell), darkened by crackDark and spread (dimmer, not lost) by the footprint.
// Owner, 2026-10-27 (round 3): the rock still read as paint: soft lumps, a crackle of thin cracks, smooth tints.
// The big polygon lattice is gone (BEDS_B and JOINTS_B carry the structure), the small chips crack less, and a
// tiny lattice gives the faces a rough, chipped grain up close.
export const BLOCKS_B = {
  small: { cell: 2.6, flat: 0.55, tilt: 0.36 },
  chip: { cell: 1.0, flat: 0.85, tilt: 0.5 },
  // Owner, round 5: up close the chips laid a mosaic like crazy paving over every face; they fade sooner now and
  // vary less in tone.
  fade: [0.06, 0.15],
  warp: 1.4,
  crack: 0.035,
  crackDark: 0.3
};
// Bedding: beds of jittered thickness (thick: mean metres, jitter: share of it their boundaries wander), tilted
// by STRATA_B.dip and bent by `bend` metres with the 24 m noise. A bed is a ledge from its foot (tilted up by
// ledgeUp) under a riser from `riser` of its height (tilted down by riserDown: the two balance, so the mean light
// stays the slope's own), whose top is the lip of the bed above; the lip (protruding `lip` m, more on hard
// beds) shades the riser under it by the sun's angle to the face. patch: the noise range over which beds come
// and go.
// Owner, round 4: the beds read as regular horizontal stripes and the snow on them as angular blocks. They now
// undulate (bend, plus the mid and detail noise), many beds fade out along the strike, they stand out less, and snow
// thins over a ragged band instead of stopping at a block edge.
export const BEDS_B = {
  thick: 5.5,
  jitter: 0.9,
  bend: 7,
  riser: 0.6,
  ledgeUp: 0.45,
  riserDown: 0.68,
  lip: 0.2,
  patch: [-0.12, 0.22],
  reach: 14,
  faces: [0.18, 0.42]
};
// Joints: two sets of vertical joint planes, turned a little from bed to bed, spaced span[0]..span[1] metres
// (per bed), cut every bed into blocks; width: joint width (m); tilt: how far a block's face nods (along the
// face, up the face).
// Owner, round 5: the joints drew a regular net of dark lines across every face (V shapes where the two sets met on a
// curved slope), and each cell of it carried its own tilt and tint, so shade and snow fell in square tiles. Now the
// second set meets the first at skew[0]..skew[1] radians with its own spacing (ratio), both wander a little (warp:
// cells per unit of the 24 and 9.6 m noise, small, so the lines stay straight like cracks), a line runs `run` cells
// and then breaks off (gap: share of runs missing), and a block's tilt and tint vary smoothly (solid noise over
// about a cell, no cell edge). fade: pixel footprint (share of the spacing) over which the joints go, earlier than
// before, so the far ranges show no cell tiles.
export const JOINTS_B = {
  span: [2.6, 7],
  width: 0.12,
  turn: 0.55,
  tilt: [0.3, 0.5],
  dark: 0.32,
  skew: [1.0, 1.7],
  ratio: 1.3,
  warp: [0.35, 0.2],
  run: 2,
  gap: 0.55,
  fade: [0.05, 0.14]
};
// Dark wet streaks down the faces: width and length (m) of the streak noise and how much darker they are.
export const STREAKS_B = { width: 1.2, length: 26, dark: 0.26 };
// The alpine look of the ranges behind the near one (owner, 2026-10-31, after three photos: a sharp peak with snow in
// the couloirs between dark rock ribs, layered rock with snow on its ledges, a range of snow fields at sunrise; the
// ranges seen from the garden read as soft brown clay). On the ranges behind the near one: darker, greyer rock with
// sharp ribs down the fall line, a lower snow line and a darker snow. On every range: snow on the less steep parts
// of the upper faces (more of them higher up) and in the deeper hollows, a softer terminator so the faces model in
// the front light of the garden view (SHAPE_B, RELIEF_SHADE_B), deeper couloirs and more crags (LAYERS_B).
// ranges: [from, to) (0 near .. 3 far). rib: the rib pattern, solid noise stretched down the fall line (no cells,
// no lattice edge along a world axis): turn (rad) about the vertical, lattice tilt (two angles, rad), warp (m) by
// the 24 and 9.6 m noise, octaves [width (m), length as a share of the width, rib height as a share of the width,
// weight], relief share under snow, groove darkening, sky taken from the gullies between the ribs.
// snow: drop (m) of its line below the summit snow line (with lineDrop on the far ranges' own line), the hollows'
// edge (hollow 0..1 with its softness and frays by the 9.6, 3.8 and 1.6 m noise) and weight, face [slope limit at
// the line, at span m above it, span, softness], the stretched noise that breaks it into runs ([across, along] m,
// level), tone (albedo share: lit snow stays under the highlight roll-off, so it keeps its shading and the warm
// light of a low sun), bump, glow (alpenglow share; the summit snow's 0.35 lifts lit snow past the roll-off to flat
// white at sunset). byRange: snow level of each range, near to far (owner, 2026-10-31: the near range mostly bare
// rock with a few patches on top, the middle ones snowy summits, ledges and couloir runs between clear rock ribs,
// the far one snowier, a high alpine massif); each level step lowers the line by rangeLine (m) and lets snow onto
// faces rangeFace steeper, and scales the hollows' snow. blush: the light rose of the snow a low sun lights (tint,
// amount, from..to y: it fades in above the valleys): a tint, not more light, so the snow stays cream and keeps its
// shading. Bright snow goes through the highlight roll-off and the tone mapping, which keep only part of a tint: the
// tint is set stronger than it reads (measured on the garden view at sunset).
// rock: dark (albedo factor), grey (share of its own grey); light: deep (sky fill taken from bare rock), cool (blue
// share in its shade), alpen [amount, from, to y] (alpenglow on high bare rock).
export const ALPINE_B = {
  on: true,
  ranges: [1, 4],
  rib: {
    turn: 0.7,
    lattice: [0.62, 0.41],
    warp: [9, 4],
    octaves: [
      [10, 4, 0.5, 1],
      [4, 3.5, 0.4, 0.8]
    ],
    snow: 0.8,
    groove: 0.3,
    ao: 0.35
  },
  snow: {
    drop: 22,
    lineDrop: 12,
    hollow: [0.45, 0.06, 0.35, 0.35, 0.45],
    weight: 0.6,
    face: [0.44, 0.6, 50, 0.025],
    runs: [10, 45],
    level: [0.2, 0.4],
    tone: 0.7,
    bump: 3.5,
    glow: 0,
    byRange: [-1, 0, 0.25, 1],
    rangeLine: 12,
    rangeFace: 0.05,
    blush: { tint: [1, 0.72, 0.82], amount: 1, from: 0, to: 40 }
  },
  rock: { dark: 0.72, grey: 0.25 },
  light: { deep: 0.3, cool: 0.3, alpen: [0.5, 40, 110] }
};
// The earlier look (?mountains-look=classic, for comparison and rollback).
export const CLASSIC_B = {
  shape: { gully: 0.45, stretch: 1.25, rugged: 0.16 },
  shade: { bump: 8.5, terminator: [1.9, 0.13] },
  crag: [1, 0.8, 0.4, 0]
};
export const MOUNTAIN_LOOK_B =
  typeof location !== 'undefined' && /[?&]mountains-look=classic(&|$)/.test(location.search)
    ? 'classic'
    : 'alpine';
if (MOUNTAIN_LOOK_B === 'classic') {
  ALPINE_B.on = false;
  Object.assign(SHAPE_B, CLASSIC_B.shape);
  Object.assign(RELIEF_SHADE_B, CLASSIC_B.shade);
  CLASSIC_B.crag.forEach((crag, i) => (LAYERS_B[i].crag = crag));
}
// Snow: the steepness (1 - normal.y of the fractured rock) up to which snow holds, more in winter (frost), on
// ledges and in couloirs, less on wind-scoured spurs; shade: the blue of snow in shade (sky-lit) against its
// bright sun side.
export const SNOW_B = {
  hold: 0.34,
  winter: 0.1,
  ledge: 0.07,
  couloir: 0.15,
  wind: 0.12,
  shade: [0.78, 0.88, 1.14]
};
// Crest band limit: grid samples per lesser-peak cycle below which that octave fades out (from..to).
export const CREST_SAMPLES = [2.2, 3.6];

// Passes toward the low sun and moon (backdrop.mjs: sunset sun and night moon near 3.66; the clock-driven sun
// and moon rise near 2.3): [angle, half-width (rad), depth 0..1]. Every range dips, so the light reaches the sea.
export const GAPS_B = [
  [3.66, 0.3, 1],
  [2.3, 0.1, 0.35]
];

// Seasons: snow line and scrub line (world y) and colours (linear RGB) of the foot scrub and alpine grass.
export const SEASONS_B = {
  spring: { snow: 40, tree: 12, scrub: [0.03, 0.05, 0.026], meadow: [0.075, 0.1, 0.042] },
  summer: { snow: 54, tree: 14, scrub: [0.024, 0.04, 0.024], meadow: [0.08, 0.088, 0.046] },
  autumn: { snow: 46, tree: 12, scrub: [0.06, 0.042, 0.02], meadow: [0.1, 0.076, 0.042] },
  winter: { snow: 24, tree: 10, scrub: [0.032, 0.04, 0.032], meadow: [0.1, 0.1, 0.095] }
};
// Winter (setSnow 1): snow down to the sea, the ledges and cols filled.
export const WINTER_B = { snow: 4, frost: 1 };

// Light strengths. minSunY/minMoonY: lowest light elevation used for shading (a set sun still grazes the
// summits); neutral: share of a high sun's tint removed so midday rock reads grey; shadeLine: world height below
// which a low sun leaves the slopes in the shadow of the ranges, by sun elevation lowSun[0]..lowSun[1]; glow:
// forward-scattered sun in the haze toward it.
export const LIGHT_B = {
  sun: 1.45,
  sky: 0.62,
  bounce: 0.2,
  moon: 0.34,
  nightSky: 0.2,
  minSunY: 0.1,
  minMoonY: 0.35,
  neutral: 0.35,
  shadeLine: 26,
  lowSun: [0.12, 0.4],
  glow: 0.45,
  // Share of the sky fill taken away for a low sun: long cool shadows against the warm lit faces.
  lowFill: 0.45,
  lowBoost: 0.8,
  // A low sun's shade turns toward this cool blue (linear), by this share: warm light against cool shade.
  coolShade: [0.32, 0.42, 0.75],
  coolShare: 0.35
};
// Morning mist (setMist 1): a second, paler mist fills the valleys up to about `rise` metres above the cloud
// sea, thicker in the couloirs, at most `amount` opaque.
export const MIST_B = { rise: 22, amount: 0.45 };
// Ground cover from the terrain itself, measured on the built grid. convexScale: plan (across the slope, near
// and wide offsets in columns) and profile (down the slope) curvature, in metres per metre, to the -1 (hollow,
// gully) .. 1 (spur, crest) convexity the shader reads; cliff: smoothed slope (1 - normal.y) from which a face
// counts as a cliff that sheds scree; screeReach: how far (m) below a cliff its fan runs, widening by
// screeSpread metres per metre.
export const RELIEF_B = {
  planNear: 3,
  planWide: 8,
  convexScale: [0.55, 0.85, 0.9],
  cliff: [0.44, 0.58],
  screeReach: 30,
  screeSpread: 0.35
};
// Cover rules, shared word for word by the shader and the tests (GLSL that also evaluates as JS). Inputs: y
// (world), steep (smoothed slope 0..1), convex (-1 hollow .. 1 spur/crest), gully (couloir 0..1), scree (cliff
// above, 0..1), patchy (slow 0..1), treeLine (the scrub line), edge (small-scale noise, about -0.4..0.4: only
// frays borders), hard (0..1, hardness of the bed: hard beds stand out as cliff bands along the strata). Rock is
// the ground: it takes everything but gentle benches and hollows (alpine grass, up to about 26 m above the scrub
// line), the scree fans below cliffs, and a little patchy scrub at the very foot (never a closed canopy).
export const COVER_B = [
  ['ridge', 'max(convex, 0.0)'],
  ['hollow', 'max(-convex, 0.0)'],
  ['tree', 'treeLine + (patchy - 0.5) * 4.0 + hollow * 5.0 - ridge * 5.0 + edge * 6.0'],
  // Steepness as the cover sees it: spurs read steeper, hollows gentler, the borders frayed.
  ['face', 'steep + ridge * 0.16 - hollow * 0.1 + edge * 0.08'],
  // Cliffs: the steepest faces, sooner on hard beds.
  ['cliff', 'bStep(0.44 - hard * 0.08, 0.025, face)'],
  // Scrub: in patches, on gentle ground at the foot only, and at most 0.75 cover.
  [
    'density',
    '0.75 * (1.0 - smoothstep(tree - 8.0, tree + 2.0, y)) * smoothstep(0.35, 0.65, patchy + edge * 1.2) * (1.0 - smoothstep(0.24, 0.4, face)) * (1.0 - cliff) * (1.0 - smoothstep(0.2, 0.5, scree))'
  ],
  [
    'grass',
    '(1.0 - smoothstep(tree + 6.0, tree + 26.0, y - hollow * 10.0 + ridge * 8.0 + edge * 8.0)) * (1.0 - smoothstep(0.2, 0.34, face))'
  ],
  ['rockCover', 'max(cliff, 1.0 - grass)'],
  ['screeCover', 'smoothstep(0.15, 0.5, scree) * smoothstep(0.08, 0.2, steep) * (1.0 - cliff)']
];
// Strata: bed thickness (m) and dip (world y per metre of x, z) of the hardness beds and of the cliff bands
// stepped into the geometry; riser: share of a bed taken by its cliff (the rest a gentler ledge); warp: how far
// (m) the beds bend over warpLength; patchLength: scale (m) over which the stepping comes and goes.
// Owner, round 5: the stepped beds ran as level contour lines. wobble: a second, finer bend ([wavelength, height] in
// m) of the same beds, so a step meanders over a few rows instead of following one height.
export const STRATA_B = {
  bed: 13,
  dip: [0.21, -0.14],
  riser: 0.4,
  warp: 9,
  warpLength: 55,
  patchLength: 70,
  wobble: [19, 3.2]
};
// Far plane guard: beyond `knee` metres from the camera vertices slide toward it along their own view ray (same
// pixel, nearer depth) and never pass knee + span, inside the camera's far plane (680).
export const FAR_B = { knee: 560, span: 105 };

// Gradient noise (about -1..1), this ring's own table and hash; deterministic.
export const noise2 = createGradientNoise({
  phase: 0.61,
  mix: [0x2c9277b5, 0x1b873593, 0x85ebca6b],
  shift: 13
});
// Ridged noise (0..1): sharp creases, each octave weighted by the one before so detail gathers on the ridges.
const ridged = (x, z, octaves) => ridgedMultifractal(noise2, x, z, octaves, 2.03, 0.5);
const ringNoise = (angle, cycles, seed) => ringSample(noise2, angle, cycles, seed);

function gapFactor(angle) {
  let gap = 1;
  for (const [a, half, depth] of GAPS_B)
    gap *= 1 - depth * (1 - smooth(0.45, 1, Math.abs(wrapAngle(angle - a)) / half));
  return gap;
}

// Crest height (world y) of one range at one angle: a broad undulation with cols, the designed summits (a sharp
// cusp on a skirt: a horn, not a dome), broken lesser peaks from ridged noise along the crest, and the passes.
export function crestHeight(layer, angle) {
  const span = layer.top - layer.base,
    cusp = SHAPE_B.summitCusp;
  let envelope = 0.08 + 0.4 * smooth(-0.6, 0.7, ringNoise(angle, 7, layer.seed));
  for (const [a, share, width] of layer.summits) {
    const t = (wrapAngle(angle - a) * layer.crest) / width;
    envelope = Math.max(
      envelope,
      share * (cusp * Math.exp(-Math.abs(t) * 2.1) + (1 - cusp) * Math.exp(-t * t * 0.3))
    );
  }
  const cycles = (layer.crest * Math.PI * 2) / layer.peakSpacing,
    columns = layer.columns || Infinity;
  let jag = 0,
    norm = 0,
    amp = 1;
  for (let o = 0; o < 4; o++) {
    const n = 1 - Math.abs(ringNoise(angle, cycles * 2 ** o, layer.seed * 5 + o)),
      // An octave the grid samples fewer than about three times per cycle only adds aliased spikes (a crunchy,
      // faceted crest): it eases to its mean (about 0.3) instead.
      keep = smooth(CREST_SAMPLES[0], CREST_SAMPLES[1], columns / (cycles * 2 ** o));
    jag += amp * (0.3 + (n * n * n - 0.3) * keep);
    norm += amp;
    amp *= layer.rough;
  }
  jag /= norm;
  const h = layer.base + span * envelope + layer.jag * (jag - 0.35) * (0.6 + envelope);
  // The wide sunset pass used to flatten every ring to exactly the same floor over 15 degrees.
  // Low, smooth distant mist banks break that ruler-straight silhouette while staying below the sun.
  return SHAPE_B.floor + (h - SHAPE_B.floor) * gapFactor(angle) + passBank(angle);
}

// The same bounded profile anchors the curtain and the ridges throughout the sunset pass.
export function passBank(angle) {
  const [pass, half, depth] = GAPS_B[0];
  const weight = depth * (1 - smooth(0.45, 1, Math.abs(wrapAngle(angle - pass)) / half));
  return weight * (9 + 2.5 * Math.sin(31 * angle + 0.4) + 1.5 * Math.sin(71 * angle - 1));
}

// 0 on a spur crest, up to about 1 down a couloir: |noise| on a circle (closes around the ring) whose radius
// grows downslope, so couloirs run roughly parallel, fork and wander instead of running dead straight.
function couloirs(angle, reach, seed) {
  const x = Math.cos(angle) * reach + seed,
    z = Math.sin(angle) * reach - seed,
    v = Math.abs(noise2(x, z)) + 0.45 * Math.abs(noise2(x * 2.2 + 9.2, z * 2.2 - 4.4));
  return Math.min(1, v * 1.15);
}

// An arête runs down from every designed summit: the couloir field drops to a spur crest along it.
function arete(layer, angle, a) {
  const width = SHAPE_B.areteWidth * (1 + SHAPE_B.areteSpread * a);
  let g = 1;
  for (const [s] of layer.summits) g = Math.min(g, (Math.abs(wrapAngle(angle - s)) * layer.crest) / width);
  return g;
}

// Cliff bands: the height stepped along the tilted strata, each bed a gentler ledge over a steep riser
// (continuous: the riser climbs to the next ledge), blended in by `amount`. The beds warp and the stepping
// comes and goes along the range, so the bands never read as regular contour lines.
// Height (m) the beds are raised by at (x, z): the dip, bent by the 55 m warp and the finer wobble.
export function bedOffset(x, z) {
  const st = STRATA_B;
  return (
    x * st.dip[0] +
    z * st.dip[1] +
    noise2(x / st.warpLength + 3.3, z / st.warpLength) * st.warp +
    noise2(x / st.wobble[0] + 8.1, z / st.wobble[0] - 2.7) * st.wobble[1]
  );
}
export function cliffBands(h, x, z, amount) {
  if (amount <= 0) return h;
  const st = STRATA_B,
    off = bedOffset(x, z),
    t = (h + off) / st.bed,
    bed = Math.floor(t),
    stepped = (bed + smooth(1 - st.riser, 1, t - bed)) * st.bed - off;
  return h + (stepped - h) * amount;
}

// Height and terrain terms of one range at (angle, s): s runs -1 (front foot, toward the garden) .. 0 (crest)
// .. 1 (back foot). Returns [y, cavity (-1 couloir .. 1 spur)].
export function rangeSurface(layer, angle, s, crestY, x, z, step = Infinity) {
  const sh = SHAPE_B,
    a = Math.abs(s),
    relief = crestY - sh.floor,
    profile = (1 - a) ** (s < 0 ? sh.frontCurve : sh.backCurve),
    flank = smooth(0.05, 0.3, a) * (1 - smooth(0.78, 1, a)),
    // Cirques: bowls just under the crest, between the arêtes, with a steep headwall.
    bowl = smooth(0.04, 0.16, a) * (1 - smooth(0.3, 0.6, a)),
    // A slow bend so couloirs curve around buttresses.
    bend = (noise2(x / 90 + layer.seed * 3.1, z / 90) * 14) / layer.crest,
    g = Math.min(
      couloirs(angle + bend, layer.crest / layer.spacing + a * sh.stretch, layer.seed * 31.7),
      arete(layer, angle + bend * 0.5, a)
    ),
    knolls = ridged(x / sh.ruggedWavelength + layer.seed, z / sh.ruggedWavelength, 3) - 0.45;
  const smoothY =
    sh.floor +
    relief *
      profile *
      (1 - sh.gully * flank * g - sh.cirque * bowl * g + sh.rugged * knolls * smooth(0.04, 0.2, a));
  const terrace =
    layer.terrace *
    smooth(0.06, 0.2, a) *
    (1 - smooth(0.7, 0.95, a)) *
    (0.35 +
      0.65 * smooth(-0.35, 0.35, noise2(x / STRATA_B.patchLength + 7.1, z / STRATA_B.patchLength - 2.9)));
  // Lift the foot and closure together, retaining relief between the foot and the crest.
  const localFloor = sh.floor + 0.35 * passBank(angle);
  const stepped = cliffBands(smoothY, x, z, terrace) + crags(layer, a, x, z, step);
  return [Math.max(localFloor, stepped + (localFloor - sh.floor) * (1 - profile)), flank * (1 - 2 * g)];
}

// Ridged ribs and crags (sharp-crested, running down the fall line) cut into the face and the shoulders under
// the crest; the finest octave fades with the grid spacing `step` (m), so a rib the grid cannot draw never aliases.
function crags(layer, a, x, z, step) {
  const c = SHAPE_B.crag,
    amount = layer.crag * smooth(0, 0.1, a) * (1 - smooth(0.8, 1, a));
  if (amount <= 0) return 0;
  const fine = smooth(CREST_SAMPLES[0], CREST_SAMPLES[1], c.wavelength / 2.03 / step),
    n = ridgedMultifractal(
      noise2,
      x / c.wavelength + layer.seed * 5.1,
      z / c.wavelength + 2.3,
      c.octaves,
      2.03,
      0.5,
      fine
    );
  // The ridged sum averages about 0.57; a faded finest octave takes about 0.19 of that with it.
  return amount * c.height * (n + (1 - fine) * 0.19 - 0.57);
}

// Builds one range's arrays (positions, normals, terrain = convexity, cavity, patch, steepness; scree) and
// returns its crest heights.
function buildLayer(layer, index, positions, normals, terrain, scree, indices, vertexOffset, indexOffset) {
  const { columns, frontRows, backRows } = layer,
    rows = frontRows + backRows,
    crests = new Float32Array(columns),
    sh = SHAPE_B;
  for (let i = 0; i < columns; i++) {
    const angle = (i / columns) * Math.PI * 2,
      sin = Math.sin(angle),
      cos = Math.cos(angle),
      crestY = crestHeight(layer, angle),
      crestR = layer.crest + layer.wander * ringNoise(angle, 5, layer.seed + 11);
    let top = -Infinity;
    for (let k = 0; k <= rows; k++) {
      // Rows packed toward the crest on both slopes, so the ridge line stays sharp.
      const u = k < frontRows ? -(1 - k / frontRows) : (k - frontRows) / backRows,
        s = Math.sign(u) * Math.abs(u) ** sh.rowBias,
        r = crestR + s * (s < 0 ? layer.front : layer.back),
        x = sin * r,
        z = cos * r,
        rowStep =
          (s < 0 ? layer.front / frontRows : layer.back / backRows) *
          sh.rowBias *
          Math.abs(s) ** ((sh.rowBias - 1) / sh.rowBias),
        [y, cavity] = rangeSurface(
          layer,
          angle,
          s,
          crestY,
          x,
          z,
          Math.max(rowStep, (Math.PI * 2 * crestR) / columns)
        ),
        v = vertexOffset + k * columns + i;
      positions[v * 3] = x;
      positions[v * 3 + 1] = y;
      positions[v * 3 + 2] = z;
      terrain[v * 4 + 1] = cavity;
      // Slow patchiness (about 0..1) for scrub, grass and snow lines.
      terrain[v * 4 + 2] = Math.min(1, Math.max(0, 0.5 + 0.55 * noise2(x / 75 + index * 7.7, z / 75)));
      top = Math.max(top, y);
    }
    crests[i] = top;
  }
  layerNormals(positions, normals, vertexOffset, columns, rows, frontRows);
  layerRelief(positions, normals, terrain, scree, vertexOffset, columns, rows, frontRows);
  layerIndex(indices, vertexOffset, indexOffset, columns, rows);
  return crests;
}

// Height of vertex v above the straight line between vertices a and b, per metre of horizontal distance:
// positive on a spur or crest, negative in a gully or hollow.
function bulge(positions, v, a, b) {
  const ax = positions[a * 3],
    az = positions[a * 3 + 2],
    bx = positions[b * 3],
    bz = positions[b * 3 + 2],
    span = Math.hypot(bx - ax, bz - az) || 1,
    t = Math.min(1, Math.max(0, Math.hypot(positions[v * 3] - ax, positions[v * 3 + 2] - az) / span)),
    chord = positions[a * 3 + 1] + t * (positions[b * 3 + 1] - positions[a * 3 + 1]);
  return ((positions[v * 3 + 1] - chord) * 2) / span;
}

// Terrain measures the cover follows, from the built surface: smoothed steepness (terrain.w), convexity
// (terrain.x: plan curvature at two widths plus profile curvature) and scree (cliffs upslope, spreading in fans).
function layerRelief(positions, normals, terrain, scree, vertexOffset, columns, rows, frontRows) {
  const grid = {
    positions,
    terrain,
    columns,
    rows,
    frontRows,
    at: (k, i) => vertexOffset + k * columns + ((i + columns) % columns),
    cliffs: new Float64Array((rows + 1) * columns)
  };
  layerSteepness(grid, normals);
  layerConvexity(grid);
  // Each vertex's cliff share, once: every vertex below it within the scree reach reads it again (round 21: the
  // fans took ~100 ms of the page's load). Kept as doubles, so the fans are the same to the bit.
  const cliffs = grid.cliffs;
  for (let k = 0; k <= rows; k++)
    for (let i = 0; i < columns; i++)
      cliffs[k * columns + i] = smooth(RELIEF_B.cliff[0], RELIEF_B.cliff[1], terrain[grid.at(k, i) * 4 + 3]);
  for (let k = 0; k <= rows; k++)
    for (let i = 0; i < columns; i++) scree[grid.at(k, i)] = screeFan(grid, k, i);
}

// Steepness over a few metres (3 x 3 vertices, centre doubled): single grid facets do not decide the cover.
function layerSteepness({ terrain, columns, rows, at }, normals) {
  for (let k = 0; k <= rows; k++)
    for (let i = 0; i < columns; i++) {
      let sum = 2 * (1 - normals[at(k, i) * 3 + 1]);
      for (let kk = Math.max(0, k - 1); kk <= Math.min(rows, k + 1); kk++)
        for (let d = -1; d <= 1; d++) sum += 1 - normals[at(kk, i + d) * 3 + 1];
      terrain[at(k, i) * 4 + 3] = sum / (2 + 3 * (Math.min(rows, k + 1) - Math.max(0, k - 1) + 1));
    }
}

function layerConvexity({ positions, terrain, columns, rows, at }) {
  const R = RELIEF_B,
    bend = new Float32Array(columns);
  for (let k = 0; k <= rows; k++) {
    const k0 = Math.max(0, k - 1),
      k1 = Math.min(rows, k + 1);
    for (let i = 0; i < columns; i++) {
      const v = at(k, i),
        plan =
          R.convexScale[0] * bulge(positions, v, at(k, i - R.planNear), at(k, i + R.planNear)) +
          R.convexScale[1] * bulge(positions, v, at(k, i - R.planWide), at(k, i + R.planWide)),
        profile = k0 < k && k1 > k ? R.convexScale[2] * bulge(positions, v, at(k0, i), at(k1, i)) : 0;
      bend[i] = Math.max(-1, Math.min(1, (plan + profile) * 1.6));
    }
    // A light blur along the ring: cover lines follow spurs and gullies, not single grid columns.
    for (let i = 0; i < columns; i++)
      terrain[at(k, i) * 4] = (bend[(i + columns - 1) % columns] + 2 * bend[i] + bend[(i + 1) % columns]) / 4;
  }
}

// Scree at one vertex: the strongest cliff up its fall line (rows toward the crest) within screeReach, fading
// with the run and spreading sideways by screeSpread metres per metre, so each cliff sheds a fan.
function screeFan({ positions, cliffs, columns, frontRows, at }, k, i) {
  const R = RELIEF_B,
    dir = k < frontRows ? 1 : -1,
    v = at(k, i),
    perColumn = (Math.PI * 2) / columns;
  let fan = 0;
  for (let j = k + dir; dir > 0 ? j <= frontRows : j >= frontRows; j += dir) {
    const u = at(j, i),
      run = Math.hypot(positions[u * 3] - positions[v * 3], positions[u * 3 + 2] - positions[v * 3 + 2]);
    if (run > R.screeReach) break;
    const width = perColumn * Math.hypot(positions[u * 3], positions[u * 3 + 2]),
      spread = Math.min(6, Math.round((run * R.screeSpread) / width)),
      fade = 1 - run / R.screeReach;
    const row = j * columns;
    for (let d = -spread; d <= spread; d++) {
      const cliff = cliffs[row + ((i + d + columns) % columns)];
      fan = Math.max(fan, cliff * fade * (1 - Math.abs(d) / (spread + 1)));
    }
  }
  return fan;
}

// Rows used for a normal's across-range difference. They never straddle the crest: a crest normal leaning over
// the unseen back slope would draw a dark outline along every silhouette, so the crest takes its front slope's.
function slopeRows(k, frontRows, rows) {
  if (k < frontRows) return [Math.max(0, k - 1), k + 1];
  if (k === frontRows) return [k - 1, k];
  return [Math.max(frontRows, k - 1), Math.min(rows, k + 1)];
}

// Normals from central differences: across the range (toward the back) x along the ring points up.
function layerNormals(positions, normals, vertexOffset, columns, rows, frontRows) {
  for (let k = 0; k <= rows; k++) {
    const [k0, k1] = slopeRows(k, frontRows, rows);
    for (let i = 0; i < columns; i++) {
      const v = vertexOffset + k * columns + i,
        l = vertexOffset + k * columns + ((i + columns - 1) % columns),
        r = vertexOffset + k * columns + ((i + 1) % columns),
        b = vertexOffset + k0 * columns + i,
        f = vertexOffset + k1 * columns + i,
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
      if (ny < 0) {
        nx = -nx;
        ny = -ny;
        nz = -nz;
      }
      normals[v * 3] = nx / length;
      normals[v * 3 + 1] = ny / length;
      normals[v * 3 + 2] = nz / length;
    }
  }
}

// step: columns per quad (2 for the lite ring, rangeIndexLiteB).
function layerIndex(indices, vertexOffset, indexOffset, columns, rows, step = 1) {
  let n = indexOffset;
  for (let k = 0; k < rows; k++)
    for (let i = 0; i < columns; i += step) {
      const a = vertexOffset + k * columns + i,
        b = vertexOffset + k * columns + ((i + step) % columns),
        c = a + columns,
        d = b + columns;
      // Counter-clockwise seen from above: the upper side is the front face.
      indices[n++] = a;
      indices[n++] = c;
      indices[n++] = b;
      indices[n++] = b;
      indices[n++] = c;
      indices[n++] = d;
    }
}

// The medium and low graphics' ring (owner's Realme 11 Pro+, 2026-10-31: the ranges cost a sixth of the frame there):
// every other column of the same grid, on the same vertices and normals, so half the triangles; the crest keeps its
// height at every column it still draws. Every range has an even number of columns.
export function rangeIndexLiteB() {
  let quads = 0;
  for (const l of LAYERS_B) quads += (l.columns / 2) * (l.frontRows + l.backRows);
  const index = new Uint32Array(quads * 6);
  let vertexOffset = 0,
    indexOffset = 0;
  for (const l of LAYERS_B) {
    const rows = l.frontRows + l.backRows;
    layerIndex(index, vertexOffset, indexOffset, l.columns, rows, 2);
    vertexOffset += l.columns * (rows + 1);
    indexOffset += (l.columns / 2) * rows * 6;
  }
  return index;
}

// Summits along each crest: higher than everything within about 40 m along it and well above the sea.
export function findPeaks(crests, layer, minimum = SHAPE_B.seaTop + 12) {
  const columns = crests.length,
    reach = Math.max(2, Math.round(40 / ((layer.crest * Math.PI * 2) / columns))),
    peaks = [];
  for (let i = 0; i < columns; i++) {
    const y = crests[i];
    if (y < minimum) continue;
    let top = true;
    for (let j = -reach; j <= reach && top; j++) {
      const c = crests[(i + j + columns) % columns];
      // Ties go to the leftmost column, so a flat top counts once.
      if (j && (c > y || (c === y && j < 0))) top = false;
    }
    if (top) peaks.push(Math.round(y * 10) / 10);
  }
  return peaks;
}

export function buildRangesB() {
  const started = typeof performance === 'undefined' ? Date.now() : performance.now();
  let vertices = 0,
    quads = 0;
  for (const l of LAYERS_B) {
    vertices += l.columns * (l.frontRows + l.backRows + 1);
    quads += l.columns * (l.frontRows + l.backRows);
  }
  const positions = new Float32Array(vertices * 3),
    normals = new Float32Array(vertices * 3),
    terrain = new Float32Array(vertices * 4),
    scree = new Float32Array(vertices),
    index = new Uint32Array(quads * 6),
    peaks = [];
  let vertexOffset = 0,
    indexOffset = 0;
  LAYERS_B.forEach((layer, i) => {
    const crests = buildLayer(layer, i, positions, normals, terrain, scree, index, vertexOffset, indexOffset);
    peaks.push(...findPeaks(crests, layer));
    vertexOffset += layer.columns * (layer.frontRows + layer.backRows + 1);
    indexOffset += layer.columns * (layer.frontRows + layer.backRows) * 6;
  });
  const ended = typeof performance === 'undefined' ? Date.now() : performance.now();
  return {
    positions,
    normals,
    terrain,
    scree,
    index,
    peaks: peaks.sort((a, b) => b - a),
    triangles: index.length / 3,
    ms: ended - started
  };
}

// A lower-only continuation of the open range boundaries. The original relief is untouched;
// the added wall dissolves before its bottom, so the sky cannot show through a hard floor edge.
export const SKIRT_B = { bottom: -100, fadeOut: -100, fadeStart: -24 };
export function buildRangeSkirtsB(ranges) {
  const columns = LAYERS_B.reduce((sum, layer) => sum + layer.columns, 0);
  const positions = new Float32Array(columns * 4 * 3),
    normals = new Float32Array(columns * 4 * 3),
    terrain = new Float32Array(columns * 4 * 4),
    scree = new Float32Array(columns * 4),
    index = new Uint32Array(columns * 12);
  let original = 0,
    vertex = 0,
    nextIndex = 0;
  for (const layer of LAYERS_B) {
    const rows = layer.frontRows + layer.backRows;
    for (const row of [0, rows]) {
      for (let i = 0; i < layer.columns; i++) {
        const from = original + row * layer.columns + i;
        for (let bottom = 0; bottom < 2; bottom++) {
          const to = vertex + bottom * layer.columns + i;
          positions.set(ranges.positions.subarray(from * 3, from * 3 + 3), to * 3);
          normals.set(ranges.normals.subarray(from * 3, from * 3 + 3), to * 3);
          terrain.set(ranges.terrain.subarray(from * 4, from * 4 + 4), to * 4);
          scree[to] = ranges.scree[from];
          if (bottom) positions[to * 3 + 1] = SKIRT_B.bottom;
        }
        const a = vertex + i,
          b = vertex + ((i + 1) % layer.columns),
          c = a + layer.columns,
          d = b + layer.columns;
        index.set([a, c, b, b, c, d], nextIndex);
        nextIndex += 6;
      }
      vertex += layer.columns * 2;
    }
    original += layer.columns * (rows + 1);
  }
  return { positions, normals, terrain, scree, index, triangles: index.length / 3 };
}

// Below HIDDEN_ROCK_B[0] of the rock reaching the screen through the haze, the valley mist and the floor fog the rock
// is not worked out at all; by [1] it is back in full, so no line shows where it starts. On the overview nearly all
// of the ranges' feet lie under it (Realme 11 Pro+, 2026-11-01), and they held most of the cost of the whole ring.
export const HIDDEN_ROCK_B = [0.03, 0.06];
// The most the three octaves of noise can add up to (0.5 + 0.25 + 0.125, each of amplitude 0.5).
const NOISE_REACH = 0.4375;
const VALLEY_MIST = '1.0 - smoothstep(seaTop - 8.0, seaTop + 9.0 + detail * 18.0 + patchy * 8.0, y)';

const VERTEX = /* glsl */ `
attribute vec4 terrain;
attribute float scree;
uniform float farKnee;
uniform float farSpan;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec4 vTerrain;
varying float vScree;
varying float vAlpine;
varying float vRange;
// The lower closure (buildRangeSkirtsB) shares this shader without the spans: no alpine vertex there.
#ifndef ALPINE_FROM
#define ALPINE_FROM 0
#define ALPINE_TO 0
#endif
#ifndef RANGE_1
#define RANGE_1 1000000000
#define RANGE_2 1000000000
#define RANGE_3 1000000000
#endif
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  // The ranges with the alpine look (ALPINE_B.ranges): buildRangesB lays the ranges out near to far.
  vAlpine = gl_VertexID >= ALPINE_FROM && gl_VertexID < ALPINE_TO ? 1.0 : 0.0;
  // Which range (0 near .. 3 far): the same for every vertex of a triangle, so it reaches the pixel exact.
  vRange = float(gl_VertexID >= RANGE_1) + float(gl_VertexID >= RANGE_2) + float(gl_VertexID >= RANGE_3);
  vWorld = world.xyz;
  vNormal = normal;
  vTerrain = terrain;
  vScree = scree;
  vec3 ray = world.xyz - cameraPosition;
  float d = length(ray);
  // The far side of the ring slides along its view ray to stay inside the far plane (same pixel, nearer depth).
  float squeeze = d > farKnee ? (farKnee + farSpan * (1.0 - exp((farKnee - d) / farSpan))) / d : 1.0;
  gl_Position = projectionMatrix * (viewMatrix * vec4(cameraPosition + ray * squeeze, 1.0));
}`;

const glslVec = c => `vec3(${c.map(v => v.toFixed(3)).join(', ')})`;
const f2 = v => v.toFixed(3);
const BK = BLOCKS_B,
  BED = BEDS_B,
  JT = JOINTS_B;
// One block lattice: its fade by footprint, crack and facet tilt (GLSL; `name` is big or small).
function blockLattice(name, offset, turn) {
  const b = BK[name],
    c = Math.cos(turn),
    s = Math.sin(turn);
  return `float keep_${name} = 1.0 - smoothstep(${f2(BK.fade[0])}, ${f2(BK.fade[1])},
        pixel / ${f2(b.cell * b.flat)});
    vec3 id_${name} = vec3(0.5);
    float crack_${name} = 0.0, in_${name} = 0.0;
    if (keep_${name} > 0.0) {
      // The lattice turned about the vertical (no edges along the world axes), flattened along the bedding and
      // warped by the 24 to 3.8 m noise, so the joints wander instead of laying a regular masonry grid.
      vec3 w = vWorld + vec3(${offset});
      vec3 q = vec3(w.x * ${f2(c)} - w.z * ${f2(s)}, w.y, w.x * ${f2(s)} + w.z *
          ${f2(c)}) / vec3(${f2(b.cell)}, ${f2(b.cell * b.flat)}, ${f2(b.cell)});
      q += vec3(detail + fine, mid * 0.6, mid - detail) * ${f2(BK.warp)};
      float e = bBlocks(q, id_${name});
      float ew = fwidth(e) * 1.5;
      // The facet turns only inside the block, easing to the slope over the border, so it never flips in a pixel.
      in_${name} = keep_${name} * smoothstep(0.0, ${f2(BK.crack)} + ew, e);
      // A dark crack, widened by the footprint but dimmed as much: thin cracks stay, they never alias.
      crack_${name} = keep_${name} * (1.0 - smoothstep(${f2(BK.crack * 0.35)}, ${f2(BK.crack)} + ew, e)) *
          ${f2(BK.crack)} / (${f2(BK.crack)} + ew);
    }`;
}

const AL = ALPINE_B,
  RIB = AL.rib;
// The rib noise's lattice, tilted in the stretched space (column-major mat3).
function ribLattice() {
  const [a, b] = RIB.lattice,
    ca = Math.cos(a),
    sa = Math.sin(a),
    cb = Math.cos(b),
    sb = Math.sin(b);
  return `mat3(${[cb, sb, 0, -sb * ca, cb * ca, sa, sb * sa, -cb * sa, ca].map(f2).join(', ')})`;
}
const ribC = f2(Math.cos(RIB.turn)),
  ribS = f2(Math.sin(RIB.turn));
// One octave of ribs: a sharp rib along each zero line of the stretched noise, rounded gullies between (a little
// darker), the height |c| times the rib height. It fades out as the footprint nears its width, so it never aliases.
function ribOctave([width, stretch, relief, weight], o) {
  const W = f2(width),
    L = f2(width * stretch),
    scale = `vec3(${f2(1 / width)}, ${(1 / (width * stretch)).toFixed(4)}, ${f2(1 / width)})`;
  return `{
      float rk = 1.0 - smoothstep(0.16, 0.36, pixel / ${W});
      if (rk > 0.0) {
        vec4 rv = bNoise(lat * vec3(rxz.x / ${W}, vWorld.y / ${L}, rxz.y / ${W}) +
            vec3(${f2(3.1 + o * 7.3)}, ${f2(1.7 + o * 4.9)}, ${f2(8.2 - o * 5.1)}));
        float rc = 2.0 * rv.x - 1.0;
        // A soft sign (never sharper than two pixels): a rib's flanks never flip within one.
        float rcw = fwidth(rc) * 1.5 + 0.04;
        vec3 rg = 2.0 * clamp(rc / rcw, -1.0, 1.0) * (rv.yzw * lat) * ${scale};
        ribGrad -= rk * ${f2(relief * width)} *
            vec3(rg.x * ${ribC} + rg.z * ${ribS}, rg.y, rg.z * ${ribC} - rg.x * ${ribS});
        ribGully += rk * ${f2(weight)} * smoothstep(0.2, 0.75, abs(rc));
      }
    }`;
}
const FRAGMENT = /* glsl */ `
  uniform vec3 lightDir;
  uniform vec3 lightColor;
  uniform vec3 skyColor;
  uniform vec3 bounceColor;
  uniform vec3 glowColor;
  uniform vec3 glowDir;
  uniform vec3 scrubColor;
  uniform vec3 meadowColor;
  uniform vec3 rockColor;
  uniform vec3 rockWarm;
  uniform vec3 snowColor;
  uniform float treeLine;
  uniform float snowLine;
  uniform float frost;
  uniform float alpenglow;
  uniform float seaTop;
  uniform float shadeLine;
  uniform float mist;
  uniform vec3 mistTint;
  uniform vec3 mistSunTint;
  uniform float mistDawn;
  uniform vec3 fogColor;
  uniform float fogDensity;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying vec4 vTerrain;
  varying float vScree;
  varying float vAlpine;
  varying float vRange;
  // Hash without Sine, David Hoskins (third-party-notices.txt).
  float bHash(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
  }
  // Hash without Sine, David Hoskins (third-party-notices.txt).
  vec3 bHash3(vec3 p) {
    p = fract(p * vec3(0.1031, 0.103, 0.0973));
    p += dot(p, p.yxz + 33.33);
    return fract((p.xxy + p.yxx) * p.zyx);
  }
  // After Inigo Quilez, value noise with analytic derivatives (third-party-notices.txt).
  // 3D value noise (x, 0..1) with its gradient (yzw). Solid noise: steep faces get no vertical streaks.
  vec4 bNoise(vec3 x) {
    vec3 i = floor(x), f = fract(x), u = f * f * (3.0 - 2.0 * f), du = 6.0 * f * (1.0 - f);
    float a = bHash(i), b = bHash(i + vec3(1.0, 0.0, 0.0)), c = bHash(i + vec3(0.0, 1.0, 0.0));
    float d = bHash(i + vec3(1.0, 1.0, 0.0)), e = bHash(i + vec3(0.0, 0.0, 1.0)),
        g = bHash(i + vec3(1.0, 0.0, 1.0));
    float h = bHash(i + vec3(0.0, 1.0, 1.0)), k = bHash(i + vec3(1.0, 1.0, 1.0));
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
  // Antialiased threshold: 0..1 across edge, at least halfWidth wide and never sharper than about two pixels
  // of x, so material borders stay soft at any distance instead of stepping pixel by pixel.
  float bStep(float edge, float halfWidth, float x) {
    float w = halfWidth + fwidth(x);
    return smoothstep(edge - w, edge + w, x);
  }
  // Fractured rock: a jittered lattice of block seeds (one per cell, near its middle, so the eight cells around q
  // hold the nearest seeds). Returns the distance (lattice units) to the border with the next block; id: the
  // nearest block's hashes (facet tilt and tone).
  float bBlocks(vec3 q, out vec3 id) {
    vec3 base = floor(q - 0.5);
    float d1 = 8.0, d2 = 8.0;
    id = vec3(0.5);
    for (int i = 0; i < 2; i++)
    for (int j = 0; j < 2; j++)
    for (int k = 0; k < 2; k++) {
      vec3 c = base + vec3(float(i), float(j), float(k));
      float d = length(q - c - 0.27 - 0.46 * bHash3(c));
      if (d < d1) {
        d2 = d1;
        d1 = d;
        id = bHash3(c + vec3(17.3, 5.9, 11.1));
      } else d2 = min(d2, d);
    }
    return 0.5 * (d2 - d1);
  }
  // The bed around stratigraphic height z (beds of thickness B, each boundary wandering by jitter * B): bed index (x),
  // the fraction up the bed (y) and its thickness (z).
  vec3 bBed(float z, float B, float jitter) {
    float k = floor(z / B);
    float b0 = (k + jitter * (bHash(vec3(k, 3.3, 1.7)) - 0.5)) * B;
    float b1 = (k + 1.0 + jitter * (bHash(vec3(k + 1.0, 3.3, 1.7)) - 0.5)) * B;
    if (z < b0) {
      k -= 1.0;
      b1 = b0;
      b0 = (k + jitter * (bHash(vec3(k, 3.3, 1.7)) - 0.5)) * B;
    } else if (z >= b1) {
      k += 1.0;
      b0 = b1;
      b1 = (k + 1.0 + jitter * (bHash(vec3(k + 1.0, 3.3, 1.7)) - 0.5)) * B;
    }
    return vec3(k, (z - b0) / (b1 - b0), b1 - b0);
  }
  void main() {
    vec3 n = normalize(vNormal);
    vec3 toEye = cameraPosition - vWorld;
    float dist = length(toEye);
    vec3 eye = toEye / max(dist, 1e-3);
    float convex = vTerrain.x, cavity = vTerrain.y, patchy = vTerrain.z, steep = vTerrain.w;
    // Ground covered by one pixel (m): each detail fades out before it can shimmer.
    float pixel = max(length(dFdx(vWorld)), length(dFdy(vWorld))) + 1e-4;
    float y = vWorld.y, gully = max(-cavity, 0.0);
    // The aerial haze: the scene fog, thinner up high (summits stand clear of the hazy bases).
    float haze = 1.0 - exp(-fogDensity * fogDensity * dist * dist * 0.9);
    haze *= 1.0 - 0.4 * smoothstep(20.0, 110.0, y);
    haze *= mix(${HAZE_B.near}, 1.0, smoothstep(${HAZE_B.fade[0].toFixed(1)}, ${HAZE_B.fade[1].toFixed(1)}, dist));
    // The floor fog, higher where the pass opens. All overlapping lower walls share the same per-ray fog at their
    // common join, so a wall behind another can no longer paint a different colour along the perfectly level floor.
    // A view-ray cone keeps the higher blend local to the pass and identical on overlapping walls.
    vec2 passView = normalize(-eye.xz + vec2(0.00001, 0.0));
    vec2 passAxis = vec2(sin(${GAPS_B[0][0].toFixed(2)}), cos(${GAPS_B[0][0].toFixed(2)}));
    float passFog = smoothstep(cos(0.67), cos(0.47), dot(passView, passAxis));
    float oldFloor = 1.0 - smoothstep(${SHAPE_B.floor.toFixed(1)}, 0.0, y);
    float raisedFloor = 1.0 - smoothstep(${(SHAPE_B.floor + 5).toFixed(1)}, 5.0, y);
    float floorBlend = mix(oldFloor, raisedFloor, passFog);
    // The most of the rock that can reach the screen, at the valley mist's thinnest (all the noise below against it).
    float shownMost = (1.0 - haze) * (1.0 - floorBlend) *
        (1.0 - 0.94 * (1.0 - smoothstep(seaTop - 8.0, seaTop + ${f2(9 - 18 * NOISE_REACH)} + patchy * 8.0, y)));
  #ifdef LOWER_CLOSURE
    // The lower closure (SKIRT_B) lies under the floor, where the floor fog at the end covers it whole (floorBlend
    // 1 below the floor, at least 0.8 where the pass lifts it, after the valley mist's 0.94): it skips the rock.
    // Owner, 2026-10-31: the garden ran slow on phones; this wall, see-through and two-sided over the whole width
    // of the cloud sea, shaded the full rock for every layer it stacks, about a third of the ranges' cost.
    float detail = 0.0;
    float valleyMist = ${VALLEY_MIST};
    vec3 color = rockColor * 0.3;
  #else
    // Three octaves of solid detail (24, 9.6, 3.8 m) for material breakup and the bump.
    vec3 p = vWorld / 24.0;
    float freq = 1.0 / 24.0, amp = 0.5, detail = 0.0, mid = 0.0, broad = 0.0, fine = 0.0;
    vec3 grad = vec3(0.0), crease = vec3(0.0);
    // Where that is next to nothing the mist's wisps go too, and with them the noise.
    float wisps = smoothstep(${f2(HIDDEN_ROCK_B[0])}, ${f2(HIDDEN_ROCK_B[1])}, shownMost);
    for (int o = 0; o < 3 && wisps > 0.0; o++) {
      float keep = 1.0 - smoothstep(${BAND_B.octave[0]}, ${BAND_B.octave[1]}, pixel * freq);
      if (keep <= 0.0) break;
      vec4 v = bNoise(p);
      detail += amp * keep * (v.x - 0.5);
      grad += amp * keep * v.yzw * freq;
      // Creased (|noise|) gradient flips across each fold. A soft flip (not sign()), never sharper than two
      // pixels, so a fold never turns the normal over within one (salt-and-pepper speckle).
      float fold = clamp((v.x - 0.5) / (${RELIEF_SHADE_B.fold} + fwidth(v.x) * 1.5), -1.0, 1.0);
      crease += amp * keep * fold * v.yzw * freq;
      if (o == 0) broad = keep * (v.x - 0.5);
      if (o == 1) mid = keep * (v.x - 0.5);
      if (o == 2) fine = keep * (v.x - 0.5);
      p = p * 2.5 + vec3(13.7, 5.1, 9.3);
      freq *= 2.5;
      amp *= 0.5;
    }
    detail *= wisps;
    // Valley mist off the cloud sea, in wisps.
    float valleyMist = ${VALLEY_MIST};
    // The rock only where it reaches the screen (HIDDEN_ROCK_B): under the valley mist and the floor fog, and in the
    // haze of the far ranges, a plainly lit face stands in for it.
    float shown = (1.0 - haze) * (1.0 - valleyMist * 0.94) * (1.0 - floorBlend);
    vec3 plain = rockColor * (skyColor + lightColor * max(dot(n, lightDir), 0.0));
    vec3 color = plain;
    if (shown > ${f2(HIDDEN_ROCK_B[0])}) {
    // The fourth octave (1.6 m): snow crust and rock grain.
    float grainKeep = 1.0 - smoothstep(${BAND_B.grain[0]}, ${BAND_B.grain[1]}, pixel / 1.6);
    float grain = 0.0;
    vec3 grainGrad = vec3(0.0);
    if (grainKeep > 0.0) {
      vec4 gv = bNoise(vWorld / 1.6 + vec3(3.1, 7.7, 1.3));
      grain = grainKeep * (gv.x - 0.5);
      grainGrad = grainKeep * gv.yzw / 1.6;
    }
    // The fifth octave (0.65 m), up close only: rough grain on the block faces, so a facet never reads as a smooth
    // plate of clay; it fades with the footprint like the grain, so it never shimmers.
    float microKeep = 1.0 - smoothstep(${BAND_B.grain[0]}, ${BAND_B.grain[1]}, pixel / 0.65);
    float micro = 0.0;
    vec3 microGrad = vec3(0.0);
    if (microKeep > 0.0) {
      vec4 mv = bNoise(vWorld / 0.65 + vec3(9.4, 2.2, 6.6));
      micro = microKeep * (mv.x - 0.5);
      microGrad = microKeep * mv.yzw / 0.65;
    }
    float slope = 1.0 - n.y;
    // Ground cover from the terrain (see COVER_B); the 9.6 and 3.8 m octaves only fray the borders.
    float edge = mid + fine * 1.4;
    // Hardness of the tilted beds (each its own, blended over a seam): hard beds hold cliff bands along the strata.
    float hardBand = (y +
        dot(vWorld.xz, vec2(${STRATA_B.dip[0]}, ${STRATA_B.dip[1]}))) / ${STRATA_B.bed.toFixed(1)};
    float hard = mix(bHash(vec3(floor(hardBand), 4.3, 0.7)), bHash(vec3(floor(hardBand) + 1.0, 4.3, 0.7)),
        smoothstep(0.8, 1.0, fract(hardBand)));
    float spur = max(cavity, 0.0);
    float scree = vScree;
    ${COVER_B.map(([name, expr]) => `  float ${name} = ${expr};`).join('\n')}
    float rock = rockCover * (1.0 - density);
    float rubble = screeCover * (1.0 - density);
    // Frame of the face: horizontal along it, and up it.
    vec3 along = normalize(vec3(n.z, 0.0, -n.x) + vec3(1e-5, 0.0, 0.0));
    vec3 upface = cross(n, along);
    // Alpine ribs (ALPINE_B.rib) on the ranges behind the near one.
    vec3 ribGrad = vec3(0.0);
    float ribGully = 0.0;
    ${
      AL.on
        ? `  if (vAlpine > 0.5) {
    mat3 lat = ${ribLattice()};
    vec2 rxz = vec2(vWorld.x * ${ribC} - vWorld.z * ${ribS}, vWorld.x * ${ribS} + vWorld.z * ${ribC});
    rxz += vec2(broad * ${f2(RIB.warp[0])} + mid * ${f2(RIB.warp[1])}, mid * ${f2(RIB.warp[0])} - broad * ${f2(RIB.warp[1])});
${RIB.octaves.map(ribOctave).join('\n')}
  }`
        : ''
    }
  // Chipped grain (BLOCKS_B): small and tiny facets, each with a crack around it, near the camera only.
${blockLattice('small', '31.7, 11.3, -7.9', -0.95)}
${blockLattice('chip', '-12.3, 4.4, 23.1', 1.7)}
  // Bedding (BEDS_B): beds of jittered thickness, tilted by the dip and bent over the range. A bed is a ledge
  // (its foot, tilted up) under a riser (tilted down) whose top is the lip of the bed above; the lip shades the
  // riser under it by the sun's angle to the face. Layering shows on steep faces, where the noise allows.
  float zs = y + dot(vWorld.xz, vec2(${STRATA_B.dip[0]}, ${STRATA_B.dip[1]})) + ${f2(BED.bend)} * broad + 3.6 * mid + 2.2 * detail;
  vec3 bed = bBed(zs, ${f2(BED.thick)}, ${f2(BED.jitter)});
  float bedW = min(fwidth(zs) / bed.z, 0.2);
  float faces = smoothstep(${f2(BED.faces[0])}, ${f2(BED.faces[1])}, slope);
  float hardness = bHash(vec3(bed.x, 4.3, 0.7));
  // A bed comes and goes along its strike (value noise of a per-bed hash), and only the hard beds stand out.
  float reachU = dot(vWorld.xz, vec2(0.8, -0.6)) / ${f2(BED.reach)};
  float presence = mix(bHash(vec3(bed.x, floor(reachU), 5.5)), bHash(vec3(bed.x, floor(reachU) + 1.0, 5.5)), smoothstep(0.0, 1.0, fract(reachU)));
  float standOut = (0.3 + 0.7 * smoothstep(0.25, 0.7, hardness)) * mix(0.0, 1.0, smoothstep(0.35, 0.7, presence));
  float layered = (1.0 - smoothstep(0.05, 0.16, pixel / bed.z)) * faces * smoothstep(${f2(BED.patch[0])}, ${f2(BED.patch[1])}, mid + detail);
  float bedTone = bHash(vec3(bed.x, 1.7, 3.1));
  float bedToneUp = bHash(vec3(bed.x + 1.0, 1.7, 3.1));
  float riser = smoothstep(${f2(BED.riser - 0.02)} - bedW, ${f2(BED.riser + 0.02)} + bedW, bed.y) * (1.0 - smoothstep(0.965 - bedW, 1.0, bed.y));
  float ledge = layered * (1.0 - riser);
  vec3 strata = vec3(0.0, 1.0, 0.0) * layered * ((1.0 - riser) * ${f2(BED.ledgeUp)} - riser * ${f2(BED.riserDown)}) * standOut * 0.95;
  // The lip's shadow on the riser under it: as long as the lip protrudes times the tangent of the sun's
  // elevation across the face (a high sun across the face shades most of the riser, a low one almost none).
  vec3 faceOut = normalize(vec3(n.x, 0.0, n.z) + vec3(1e-5, 0.0, 0.0));
  float faceSun = dot(lightDir, faceOut);
  float shadowLen = ${f2(BED.lip)} * (0.5 + hardness) * min(lightDir.y / max(faceSun, 0.12), 2.2);
  float lipShade = layered * standOut * riser * step(0.02, faceSun) * (1.0 - smoothstep(shadowLen, shadowLen + 0.1 + pixel, (1.0 - bed.y) * bed.z)) * smoothstep(0.3, 1.0, shadowLen / pixel);
  // Joints (JOINTS_B): two sets of vertical joint planes, turned a little from bed to bed, cut every bed into
  // blocks. A block's face nods (mostly up or down): a stepped, quarried look instead of soft lumps.
  // Two sets that meet at an angle (not a square net); their lines run a couple of cells and break off, so no line
  // crosses a face; a block's tilt and tint come from solid noise (no cell edge, no square tile).
  float jTurn = ${f2(JT.turn)} + (bedTone - 0.5) * 0.8;
  float jTurn2 = jTurn + ${f2(JT.skew[0])} + ${f2(JT.skew[1] - JT.skew[0])} * bHash(vec3(bed.x, 6.2, 1.1));
  float jSpan = mix(${f2(JT.span[0])}, ${f2(JT.span[1])}, bHash(vec3(bed.x, 8.1, 2.9)));
  vec2 jScale = vec2(jSpan, jSpan * ${f2(JT.ratio)});
  vec2 jc = vec2(dot(vWorld.xz, vec2(cos(jTurn), sin(jTurn))), dot(vWorld.xz, vec2(cos(jTurn2), sin(jTurn2)))) / jScale
    + vec2(hardness, bedTone) * 17.0 + vec2(detail * ${f2(JT.warp[0])} + mid * ${f2(JT.warp[1])}, mid * ${f2(JT.warp[0])} - detail * ${f2(JT.warp[1])});
  vec2 jf = fract(jc);
  vec2 jd = min(jf, 1.0 - jf);
  vec2 jLine = floor(jc + 0.5);
  vec2 jRun = floor(vec2(jc.y, jc.x) / ${f2(JT.run)} + vec2(bHash(vec3(jLine.x, bed.x, 2.2)), bHash(vec3(jLine.y, bed.x, 7.7))));
  vec2 jHere = vec2(bHash(vec3(jLine.x, jRun.x, bed.x + 9.1)), bHash(vec3(jLine.y, jRun.y, bed.x + 4.4)));
  vec2 jdm = (jd + step(jHere, vec2(${f2(JT.gap)}))) * jScale;
  float jE = min(jdm.x, jdm.y);
  float jEw = fwidth(min(jd.x * jScale.x, jd.y * jScale.y)) * 1.5;
  float jKeep = 1.0 - smoothstep(${f2(JT.fade[0])}, ${f2(JT.fade[1])}, pixel / jSpan);
  float joint = jKeep * (1.0 - smoothstep(${f2(JT.width * 0.35)}, ${f2(JT.width)} + jEw, jE)) * ${f2(JT.width)} / (${f2(JT.width)} + jEw);
  float inBlock = jKeep * smoothstep(0.0, ${f2(JT.width)} + jEw, jE);
  vec4 jn = bNoise(vec3(jc * 0.8, bed.x * 3.7 + 1.3));
  vec3 jid = vec3(0.5 + jn.y * 0.25, 0.5 + jn.z * 0.25, jn.x);
  vec3 jTilt = (along * (jid.x - 0.5) * ${f2(2 * JT.tilt[0])} + upface * (jid.y - 0.5) * ${f2(2 * JT.tilt[1])}) * inBlock;
  vec3 tilt = jTilt + ((id_small - 0.5) * ${f2(2 * BK.small.tilt)} * in_small + (id_chip - 0.5) * ${f2(2 * BK.chip.tilt)} * in_chip);
  tilt -= dot(tilt, n) * n;
  float cracks = max(joint, max(crack_small * 0.5, crack_chip * 0.3));
  // Snow (SNOW_B): above a wind-broken line that reaches down the couloirs, wherever the fractured rock is
  // gentle enough to hold it: block tops, ledges, cols, couloirs; blown off steep faces and scoured spurs.
  float line = snowLine - vAlpine * ${f2(AL.snow.lineDrop)} + broad * 18.0 + mid * 6.0 + (patchy - 0.5) * 10.0 - gully * 16.0 + spur * 3.0;
  float above = bStep(line, 0.8, y + grain * 6.0 + fine * 8.0);
  // Half the block tilt: snow drifts over the blocks, so it follows them without drawing each one.
  // Owner, round 5: snow lay in square tiles (each joint block's own tilt decided it) and in thin lines at every
  // bed's edge. It drifts over the blocks: the slope it sees is the face's own plus the soft, continuous noise
  // gradient, with neither the block tilts nor the bed steps, and its line is frayed by the 9.6 m noise.
  vec3 drift = grad * 4.0;
  float rockSlope = 1.0 - normalize(n - (drift - dot(drift, n) * n)).y;
  float hold = ${SNOW_B.hold} + ${SNOW_B.winter} * frost + ledge * smoothstep(-0.05, 0.1, mid) * ${SNOW_B.ledge} + gully * ${SNOW_B.couloir} - spur * ${SNOW_B.wind} + broad * 0.3 + mid * 0.2 + grain * 0.12;
  // A soft, wind-ragged edge: snow thins over a band instead of stopping at a block edge.
  float snow = above * (1.0 - bStep(hold + (grain - 0.5) * 0.06, 0.09, rockSlope));
${
  AL.on
    ? `// Alpine snow (ALPINE_B.snow): from drop metres under the line, on the less steep parts of the upper faces
      // (more of them higher up) and in the deeper hollows, broken down the fall line into ragged runs. More of it the
      // farther the range (ALPINE_B.snow.byRange).
      {
        float aLevel = vRange < 0.5 ? ${f2(AL.snow.byRange[0])} : vRange < 1.5 ? ${f2(AL.snow.byRange[1])} :
            vRange < 2.5 ? ${f2(AL.snow.byRange[2])} : ${f2(AL.snow.byRange[3])};
        float aLine = snowLine - ${f2(AL.snow.drop)} - aLevel * ${f2(AL.snow.rangeLine)} + broad * 16.0 +
            mid * 8.0 + (patchy - 0.5) * 12.0;
        float aFace = 1.0 - bStep(${f2(AL.snow.face[0])} + aLevel * ${f2(AL.snow.rangeFace)} +
            clamp((y - aLine) / ${f2(AL.snow.face[2])}, 0.0, 1.0) * ${f2(AL.snow.face[1] - AL.snow.face[0])} +
            mid * 0.12 + fine * 0.1 + grain * 0.08, ${f2(AL.snow.face[3])}, rockSlope);
        float aHollow = bStep(${f2(AL.snow.hollow[0])}, ${f2(AL.snow.hollow[1])}, hollow + mid *
            ${f2(AL.snow.hollow[2])} + fine * ${f2(AL.snow.hollow[3])} + grain * ${f2(AL.snow.hollow[4])}) *
            ${f2(AL.snow.weight)} * clamp(1.0 + 0.6 * aLevel, 0.3, 1.6);
        float aSnow = max(aFace, aHollow) * bStep(aLine, 3.0, y + fine * 10.0 + grain * 4.0) *
            (1.0 - bStep(0.9, 0.06, slope));
        // The runs' noise only where snow can lie (most of the ranges cannot): no derivative inside the branch.
        if (aSnow > 0.0) {
          float aRuns = bNoise(vec3(vWorld.x * ${ribC} - vWorld.z * ${ribS}, vWorld.y *
              ${f2(AL.snow.runs[0] / AL.snow.runs[1])}, vWorld.x * ${ribS} + vWorld.z *
              ${ribC}) / ${f2(AL.snow.runs[0])} + vec3(2.3, 7.1, 4.4)).x + 0.5 * fine;
          snow = max(snow, aSnow * smoothstep(${f2(AL.snow.level[0])}, ${f2(AL.snow.level[1])}, aRuns));
        }
      }`
    : ''
}
  // Scrub keeps a little dark ground through the snow (muted, not black: the snow lies between and on it).
  snow *= 1.0 - 0.45 * density;
  // Rock colour: grey and warm brown by bed and by block, ledges paler, risers darker, darker wet streaks down
  // the faces, dark joints and cracks.
  float toneB = mix(bedTone, bedToneUp, smoothstep(0.935 - bedW, 1.0, bed.y));
  // A bed's tone shows only where the bed is present along its strike: bands come and go, they do not run on.
  float bandShow = layered * (0.4 + 0.6 * smoothstep(0.3, 0.7, presence));
  float tone = mix(0.5, toneB, bandShow);
  vec3 stone = mix(rockColor, rockWarm, clamp(0.35 + (toneB - 0.5) * 0.9 * bandShow + mid * 1.4 + detail * 0.8 + (jid.y - 0.5) * 0.3 * jKeep, 0.0, 1.0));
  stone *= 0.78 + 0.38 * tone + 0.35 * grain + 0.3 * micro + 0.16 * (jid.z - 0.5) * jKeep + 0.12 * ((id_small.z - 0.5) * keep_small + (id_chip.z - 0.5) * keep_chip);
  stone *= 1.0 + layered * standOut * ((1.0 - riser) * 0.08 - riser * 0.04);
  stone *= clamp(1.0 + cavity * 0.25, 0.7, 1.25);
  // Darker, greyer rock (ALPINE_B.rock): snow and rock read apart even in the flat front light.
  stone = mix(stone, mix(stone, vec3(dot(stone, vec3(0.3333))), ${f2(AL.rock.grey)}) * ${f2(AL.rock.dark)}, vAlpine);
  // Dark wet streaks down the faces (STREAKS_B), filtered by the footprint.
  float streakKeep = 1.0 - smoothstep(${BAND_B.octave[0]}, ${BAND_B.octave[1]}, pixel / ${STREAKS_B.width.toFixed(1)});
  if (streakKeep > 0.0) {
    float s = bNoise(vWorld / vec3(${STREAKS_B.width.toFixed(1)}, ${STREAKS_B.length.toFixed(1)}, ${STREAKS_B.width.toFixed(1)}) + vec3(5.3, 1.1, 8.7)).x;
    stone *= 1.0 - ${STREAKS_B.dark} * streakKeep * faces * smoothstep(0.55, 0.8, s + gully * 0.2);
  }
  stone *= 1.0 - ${JT.dark} * joint - ${BK.crackDark} * max(crack_small * 0.5, crack_chip * 0.3);
  stone *= 1.0 - ${f2(RIB.groove)} * ribGully;
  // Talus: pale blocks and gravel below the cliffs.
  vec3 talus = rockColor * (1.35 + 0.35 * grain + 0.2 * mid + 0.4 * (id_small.z - 0.5) * keep_small + 0.5 * (id_chip.z - 0.5) * keep_chip);
  vec3 meadow = meadowColor * (0.9 + 0.4 * mid + 0.25 * grain);
  // Not down in the valley mist, where white ground under its ragged top read as floating snow flakes.
  meadow = mix(meadow, snowColor * (0.86 + 0.12 * grain), frost * smoothstep(seaTop + 4.0, seaTop + 16.0, y));
  // Scrub: muted dark green in soft patches, frosted grey-green in winter.
  vec3 scrub = mix(scrubColor * (0.75 + 0.6 * fine + 0.3 * grain), snowColor * 0.5, frost * 0.3);
  vec3 albedo = mix(meadow, scrub, density);
  albedo = mix(albedo, stone, rock);
  albedo = mix(albedo, talus, rubble);
  albedo = mix(albedo, snowColor * (0.93 + 0.12 * grain) * mix(1.0, ${f2(AL.snow.tone)}, vAlpine), snow);
  // Bump: soft under snow, creased and faceted on rock (planar block faces), a little on talus; the beds'
  // ledges and risers tilt the light on bare rock.
  float bare = rock * (1.0 - snow);
  vec3 bg = grad * mix(${(RELIEF_SHADE_B.bump * 0.7).toFixed(1)}, ${f2(AL.on ? AL.snow.bump : 2)}, snow) + crease * ${(RELIEF_SHADE_B.crease * 0.7).toFixed(1)} * bare + grainGrad * (0.12 + 0.4 * bare + 0.25 * snow) + microGrad * (0.22 * bare + 0.3 * snow) + ribGrad * (bare + ${f2(RIB.snow)} * snow);
  vec3 nb = n - (bg - dot(bg, n) * n) + tilt * max(bare * (1.0 - rubble * 0.5), snow * 0.35) + strata * (bare + snow * 0.5);
  nb = normalize(nb + vec3(0.0, 1e-5, 0.0));
  // Owner, round 5: facets turned past the vertical by the tilts and the bump fell to near black in a shaded gully
  // (polygonal black blotches). The relief turns the normal by at most about 40 degrees from the surface's own.
  float turned = 1.0 - dot(nb, n);
  nb = normalize(mix(n, nb, min(1.0, ${f2(1 - Math.cos((40 * Math.PI) / 180))} / max(turned, 1e-4))));
  // Light: sun (or moon) with a low-sun shadow line and a crisp terminator, sky dome brighter above and toward
  // the sun, cloud-sea bounce from below; gullies, hollows and cracks see less sky.
  // Owner, round 5: near the terminator the block and chip tilts and the creased bump flipped facets in and out of
  // the sun, so shaded gullies broke into black polygons. The sun follows the relief where the face itself is well
  // lit and fades to the face's own smooth normal toward its shadow line.
  float ndlFace = dot(n, lightDir);
  float ndl = mix(ndlFace, dot(nb, lightDir), smoothstep(0.05, 0.4, ndlFace));
  float lit = smoothstep(shadeLine - 12.0, shadeLine + 12.0, y + cavity * 6.0 + detail * 10.0);
  // A facet turned away by the relief keeps at least 40% of its face's sun (rough rock scatters it): the relief
  // shades, it never cuts black polygons into a sunlit face.
  float faceSunlit = clamp(ndlFace * ${RELIEF_SHADE_B.terminator[0]} - ${RELIEF_SHADE_B.terminator[1]}, 0.0, 1.0);
  float direct = max(clamp(ndl * ${RELIEF_SHADE_B.terminator[0]} - ${RELIEF_SHADE_B.terminator[1]}, 0.0, 1.0), 0.4 * faceSunlit) * lit;
  float hollowAo = gully * ${RELIEF_SHADE_B.hollowAo[0]} + hollow * ${RELIEF_SHADE_B.hollowAo[1]};
  direct *= 1.0 - ${RELIEF_SHADE_B.hollowSun} * hollowAo;
  direct *= 1.0 - 0.45 * lipShade * bare;
  float occ = clamp(0.86 - hollowAo + spur * 0.1 + detail * 0.35 - cracks * ${RELIEF_SHADE_B.crackAo} * (1.0 - snow) - 0.12 * lipShade * bare, 0.52, 1.05);
  occ = max(occ - ${f2(RIB.ao)} * ribGully * bare, 0.45);
  vec3 sunSide = normalize(vec3(lightDir.x, 0.0, lightDir.z) + vec3(1e-5, 0.0, 0.0));
  float dome = 0.6 + 0.4 * nb.y + 0.22 * dot(nb, sunSide);
  // Snow in shade takes the blue of the sky; on the sun side it is bright.
  vec3 ambient = skyColor * max(dome, 0.3) * occ * mix(vec3(1.0), ${glslVec(SNOW_B.shade)}, snow) ${AL.on ? `* (1.0 - ${f2(AL.light.deep)} * bare) * mix(vec3(1.0), vec3(0.78, 0.96, 1.42), ${f2(AL.light.cool)} * bare)` : ''} + bounceColor * (0.5 - 0.5 * nb.y);
  color = albedo * (lightColor * direct * (1.0 + 0.1 * snow) + ambient);
  // Backlit crests: a thin rim where the surface turns away from the eye toward the sun.
  float rim = 1.0 - clamp(dot(nb, eye), 0.0, 1.0);
  rim *= rim * rim;
  color += glowColor * rim * max(dot(-eye, glowDir), 0.0) * (0.25 + 0.3 * snow) * 0.35;
  // Alpenglow: sun-facing snow at sunset glows beyond plain diffuse light.
  color += snow * alpenglow * lightColor * max(ndl, 0.0) * lit * mix(0.35, ${f2(AL.snow.glow)}, vAlpine);
${
  AL.on
    ? `// Rose on the sunlit summit snow at a low sun (ALPINE_B.snow.blush): a tint, so the snow stays cream.
      color *= mix(vec3(1.0), ${glslVec(AL.snow.blush.tint)}, snow * smoothstep(0.0, 0.3, alpenglow) *
          smoothstep(0.0, 0.35, ndl) * lit *
          smoothstep(${f2(AL.snow.blush.from)}, ${f2(AL.snow.blush.to)}, y) * ${f2(AL.snow.blush.amount)});
`
    : ''
}${
  AL.on
    ? `  // Alpenglow on high bare rock too (ALPINE_B.light.alpen).
  color += bare * alpenglow * lightColor * albedo * max(ndl, 0.0) * lit * smoothstep(${f2(AL.light.alpen[1])}, ${f2(AL.light.alpen[2])}, y) * ${f2(AL.light.alpen[0])};`
    : ''
}
  color = mix(plain, color, smoothstep(${f2(HIDDEN_ROCK_B[0])}, ${f2(HIDDEN_ROCK_B[1])}, shown));
  }
#endif
  // Highlights roll off toward 1 instead of clipping: sunlit snow keeps its grain and stops glowing like gloss.
  float shine = dot(color, vec3(0.2126, 0.7152, 0.0722));
  if (shine > 0.75) color *= (0.75 + 0.25 * (1.0 - exp(-4.0 * (shine - 0.75)))) / shine;
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  // Aerial perspective: the haze, lit toward the sun by forward scattering.
  float toward = max(dot(-eye, glowDir), 0.0);
  vec3 hazeColor = fogColor + glowColor * toward * toward * toward * 0.5;
  gl_FragColor.rgb = mix(gl_FragColor.rgb, hazeColor, haze);
  // The valley mist: the feet dissolve instead of ending at a line.
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor * 1.12 + vec3(0.045, 0.035, 0.05), valleyMist * 0.94);
  // Morning: a paler mist fills the valleys higher up, thicker in the couloirs, ragged at its top.
  if (mist > 0.001) {
    float morning = 1.0 - smoothstep(seaTop + 2.0, seaTop + ${MIST_B.rise.toFixed(1)} + detail * 16.0 + patchy * 10.0, y);
    morning *= 0.55 + 0.45 * gully;
    // Ragged low shelves follow existing valley detail; the ridge faces stay cool.
    float shelves = 0.55 + 0.45 * sin((y - seaTop) * 0.16 + patchy * 4.0 + detail * 2.0);
    float sunlit = 0.25 + 0.75 * toward * toward;
    vec3 rose = mix(mistTint, vec3(1.0, 0.32, 0.40), 0.25 + 0.25 * mist);
    vec3 valleyColor = mix(fogColor, rose, sunlit * 0.75);
    // Dawn-only forward scattering preserves the rose base outside the sun sector.
    float mistForward = mistDawn * toward * toward * toward * toward;
    vec3 warmMist = mix(rose, mistSunTint, 0.65);
    warmMist *= min(1.0, 0.76 / max(dot(warmMist, vec3(0.2126, 0.7152, 0.0722)), 0.0001));
    valleyColor = mix(valleyColor, warmMist, 0.6 * mistForward);
    morning *= 1.0 + 0.65 * mistForward;
    valleyColor = linearToOutputTexel(vec4(valleyColor, 1.0)).rgb;
    gl_FragColor.rgb = mix(gl_FragColor.rgb, valleyColor, morning * shelves * mist * ${MIST_B.amount.toFixed(2)});
  }
  // The floor fog. The sky and upper slopes are unchanged; toward is constant along each viewing ray.
  vec3 floorFog = mix(fogColor * 1.12 + vec3(0.045, 0.035, 0.05), mistTint,
                      0.18 * mist * (0.25 + 0.75 * toward * toward));
  // floor-dawn:start
  // Only uniform inputs and the common view ray: overlapping walls share this colour.
  float floorForward = mistDawn * toward * toward * toward * toward;
  vec3 floorSun = mix(mistTint, mistSunTint, 0.65);
  floorSun *= min(1.0, 0.76 / max(dot(floorSun, vec3(0.2126, 0.7152, 0.0722)), 0.0001));
  floorSun = linearToOutputTexel(vec4(floorSun, 1.0)).rgb;
  floorFog = mix(floorFog, floorSun, 0.55 * mist * floorForward);
  // floor-dawn:end
  gl_FragColor.rgb = mix(gl_FragColor.rgb, floorFog, floorBlend);
}`;

// The top of every column of every range (x, y, z): the skyline the ranges cut. Built once, from the grid.
export function rangeTops(ranges) {
  const columns = LAYERS_B.reduce((sum, layer) => sum + layer.columns, 0),
    tops = new Float32Array(columns * 3),
    p = ranges.positions;
  let offset = 0,
    t = 0;
  for (const layer of LAYERS_B) {
    const rows = layer.frontRows + layer.backRows;
    for (let i = 0; i < layer.columns; i++, t += 3) {
      let best = offset + i;
      for (let k = 1; k <= rows; k++) {
        const v = offset + k * layer.columns + i;
        if (p[v * 3 + 1] > p[best * 3 + 1]) best = v;
      }
      tops[t] = p[best * 3];
      tops[t + 1] = p[best * 3 + 1];
      tops[t + 2] = p[best * 3 + 2];
    }
    offset += layer.columns * (rows + 1);
  }
  return tops;
}
// The skyline's elevation (radians above the eye's level) toward `direction` from `eye`: the highest top within
// `spread` radians of its bearing. Owner, 2026-10-31: a sun behind a ridge still showed its rays (backdrop.mjs).
export function skylineElevation(tops, eye, direction, spread = 0.04) {
  const bearing = Math.atan2(direction.x, direction.z);
  let best = -Math.PI / 2;
  for (let i = 0; i < tops.length; i += 3) {
    const dx = tops[i] - eye.x,
      dz = tops[i + 2] - eye.z;
    if (Math.abs(wrapAngle(Math.atan2(dx, dz) - bearing)) > spread) continue;
    best = Math.max(best, Math.atan2(tops[i + 1] - eye.y, Math.hypot(dx, dz)));
  }
  return best;
}

// The ranges never depend on the projects: built once per page and reused by every garden rebuild (sorting and
// filters rebuild the garden; round 4: the rebuild froze the screen for seconds).
let rangesCache = null;
// The ring is drawn in sectors, each with its own bounding sphere, so the camera's frustum leaves out the arcs it
// cannot see. Owner, 2026-10-31: the garden ran slow on phones; the ring was one mesh of about 220k triangles, so
// every frame processed all of it although a phone's narrow view (about 23 degrees across) sees one arc.
// sectors: how many; margin (m): added to each bounding sphere, since the far side of the ring slides toward the
// camera in the vertex shader (VERTEX, FAR_B) and the sphere must still hold what is drawn.
export const SECTORS_B = { sectors: 16, margin: 40 };
// The index regrouped by sector (a triangle goes to the sector of its first vertex's angle about the centre),
// with each sector's [start, count] in the new index and its bounding sphere ([x, y, z, radius]).
export function sectorIndex(index, positions, sectors = SECTORS_B.sectors, margin = SECTORS_B.margin) {
  const triangles = index.length / 3,
    of = new Uint8Array(triangles),
    counts = new Array(sectors).fill(0);
  for (let t = 0; t < triangles; t++) {
    const v = index[t * 3] * 3,
      angle = Math.atan2(positions[v + 2], positions[v]) + Math.PI;
    of[t] = Math.min(sectors - 1, Math.floor((angle / (Math.PI * 2)) * sectors));
    counts[of[t]]++;
  }
  const starts = [];
  let at = 0;
  for (const count of counts) {
    starts.push(at);
    at += count * 3;
  }
  const out = new Uint32Array(index.length),
    fill = starts.slice(),
    lo = Array.from({ length: sectors }, () => [Infinity, Infinity, Infinity]),
    hi = Array.from({ length: sectors }, () => [-Infinity, -Infinity, -Infinity]);
  for (let t = 0; t < triangles; t++) {
    const s = of[t];
    for (let j = 0; j < 3; j++) {
      const v = index[t * 3 + j];
      out[fill[s]++] = v;
      for (let a = 0; a < 3; a++) {
        lo[s][a] = Math.min(lo[s][a], positions[v * 3 + a]);
        hi[s][a] = Math.max(hi[s][a], positions[v * 3 + a]);
      }
    }
  }
  const parts = counts.map((count, s) => {
    const center = [0, 1, 2].map(a => (lo[s][a] + hi[s][a]) / 2);
    let radius = 0;
    for (let i = starts[s]; i < starts[s] + count * 3; i++) {
      const v = out[i] * 3;
      radius = Math.max(
        radius,
        Math.hypot(positions[v] - center[0], positions[v + 1] - center[1], positions[v + 2] - center[2])
      );
    }
    return { start: starts[s], count: count * 3, sphere: [...center, radius + margin] };
  });
  return { index: out, parts: parts.filter(p => p.count > 0) };
}
// The ring's meshes, one per sector, all on the same vertex buffers (uploaded once) and the same material.
function sectorMeshes(THREE, own, attributes, sectored, material, name) {
  const index = new THREE.BufferAttribute(sectored.index, 1),
    group = new THREE.Group();
  group.name = name;
  for (const part of sectored.parts) {
    const geometry = own(new THREE.BufferGeometry());
    for (const [key, attribute] of Object.entries(attributes)) geometry.setAttribute(key, attribute);
    geometry.setIndex(index);
    geometry.setDrawRange(part.start, part.count);
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(...part.sphere.slice(0, 3)), part.sphere[3]);
    const mesh = new THREE.Mesh(geometry, material);
    // Kept out of the static merge (it would de-index the grid).
    mesh.userData.dynamic = true;
    mesh.name = name + '-sector';
    group.add(mesh);
  }
  return group;
}
// The first vertex of ranges 1..3 (the alpine snow's level by range).
export function rangeSpans() {
  const at = to =>
    LAYERS_B.slice(0, to).reduce((sum, l) => sum + l.columns * (l.frontRows + l.backRows + 1), 0);
  return { RANGE_1: at(1), RANGE_2: at(2), RANGE_3: at(3) };
}
// The vertex span of ALPINE_B.ranges (buildRangesB lays the ranges out near to far, each columns × rows + 1);
// empty for the classic look, so its rock, snow line and snow tone stay as they were.
export function alpineSpan() {
  if (!ALPINE_B.on) return { ALPINE_FROM: 0, ALPINE_TO: 0 };
  const at = to =>
    LAYERS_B.slice(0, to).reduce((sum, l) => sum + l.columns * (l.frontRows + l.backRows + 1), 0);
  return { ALPINE_FROM: at(ALPINE_B.ranges[0]), ALPINE_TO: at(ALPINE_B.ranges[1]) };
}
export function createMountainsB(THREE, { scene, own, sunSide }) {
  rangesCache ??= buildRangesB();
  const ranges = rangesCache;
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      lightDir: { value: new THREE.Vector3(0, 0.6, -0.8) },
      lightColor: { value: new THREE.Color(1, 1, 1) },
      skyColor: { value: new THREE.Color(0.3, 0.32, 0.4) },
      bounceColor: { value: new THREE.Color(0.1, 0.1, 0.12) },
      glowColor: { value: new THREE.Color(0, 0, 0) },
      glowDir: { value: new THREE.Vector3(0, 0, -1) },
      scrubColor: { value: new THREE.Color() },
      meadowColor: { value: new THREE.Color() },
      rockColor: { value: new THREE.Color(0.1, 0.1, 0.104) },
      rockWarm: { value: new THREE.Color(0.135, 0.114, 0.094) },
      snowColor: { value: new THREE.Color(0.82, 0.85, 0.9) },
      treeLine: { value: 14 },
      snowLine: { value: 54 },
      frost: { value: 0 },
      alpenglow: { value: 0 },
      seaTop: { value: SHAPE_B.seaTop },
      shadeLine: { value: -60 },
      mist: { value: 0 },
      mistTint: { value: new THREE.Color(0xd9b7cf) },
      mistSunTint: { value: new THREE.Color(0xfff2cc) },
      mistDawn: { value: 0 },
      farKnee: { value: FAR_B.knee },
      farSpan: { value: FAR_B.span }
    }
  ]);
  const material = own(
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      fog: true,
      defines: { ...alpineSpan(), ...rangeSpans() }
    })
  );
  const attributesOf = source => ({
    position: new THREE.BufferAttribute(source.positions, 3),
    normal: new THREE.BufferAttribute(source.normals, 3),
    terrain: new THREE.BufferAttribute(source.terrain, 4),
    scree: new THREE.BufferAttribute(source.scree, 1)
  });
  ranges.sectored ??= sectorIndex(ranges.index, ranges.positions);
  const mesh = sectorMeshes(THREE, own, attributesOf(ranges), ranges.sectored, material, 'mountains-b');
  scene.add(mesh);
  // The full and the lite ring (rangeIndexLiteB) on the same sector meshes; the lite one is built when first asked.
  const full = { index: mesh.children[0].geometry.index, parts: ranges.sectored.parts };
  let lite = null,
    liteShown = false;
  function setDetail(light) {
    if (light && !lite) {
      ranges.liteSectored ??= sectorIndex(rangeIndexLiteB(), ranges.positions);
      const parts = ranges.liteSectored.parts;
      // Each sector mesh keeps its place in the ring; a lite ring with other sectors stays unused.
      if (parts.length !== full.parts.length) return;
      lite = { index: new THREE.BufferAttribute(ranges.liteSectored.index, 1), parts };
    }
    liteShown = !!light && !!lite;
    const { index, parts } = liteShown ? lite : full;
    mesh.children.forEach((child, i) => {
      const geometry = child.geometry,
        [x, y, z, r] = parts[i].sphere;
      geometry.setIndex(index);
      geometry.setDrawRange(parts[i].start, parts[i].count);
      geometry.boundingSphere.center.set(x, y, z);
      geometry.boundingSphere.radius = r;
    });
  }
  // Only the lower closure is transparent; the mountain remains its original opaque draw.
  const skirt = buildRangeSkirtsB(ranges);
  skirt.sectored = sectorIndex(skirt.index, skirt.positions);
  const skirtMaterial = own(
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT.replace(
        /\n}$/,
        '\n  gl_FragColor.a *= smoothstep(' +
          SKIRT_B.fadeOut.toFixed(1) +
          ', ' +
          SKIRT_B.fadeStart.toFixed(1) +
          ', vWorld.y);\n}'
      ),
      fog: true,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      forceSinglePass: true,
      defines: { LOWER_CLOSURE: 1 }
    })
  );
  const skirtMesh = sectorMeshes(
    THREE,
    own,
    attributesOf(skirt),
    skirt.sectored,
    skirtMaterial,
    'mountains-b-lower-closure'
  );
  scene.add(skirtMesh);

  let season = SEASONS_B.summer,
    snowLevel = 0,
    tops = null;
  const u = uniforms;
  function applySeason() {
    u.scrubColor.value.setRGB(...season.scrub);
    u.meadowColor.value.setRGB(...season.meadow);
    u.treeLine.value = season.tree;
    u.snowLine.value = season.snow + (WINTER_B.snow - season.snow) * snowLevel;
    u.frost.value = WINTER_B.frost * snowLevel;
  }
  applySeason();
  const light = u.lightDir.value,
    neutral = new THREE.Color(),
    coolShade = new THREE.Color().setRGB(...LIGHT_B.coolShade);
  return {
    mesh,
    material,
    setLight({ sunColor, sunStrength = 1, cloudColor, mountainColor, sunPosition }) {
      const L = LIGHT_B,
        day = Math.max(0, Math.min(1, sunStrength)),
        night = 1 - day;
      if (sunPosition) light.set(sunPosition.x, sunPosition.y, sunPosition.z);
      else light.copy(sunSide);
      if (light.lengthSq() < 1e-6) light.set(0, 1, -1);
      light.normalize();
      u.glowDir.value.set(light.x, 0, light.z);
      if (u.glowDir.value.lengthSq() < 1e-6) u.glowDir.value.set(0, 0, -1);
      u.glowDir.value.normalize();
      const low = 1 - Math.max(0, Math.min(1, (light.y - L.lowSun[0]) / (L.lowSun[1] - L.lowSun[0])));
      u.shadeLine.value = -60 + (L.shadeLine + 60) * low * day;
      light.y = Math.max(light.y, L.minSunY + (L.minMoonY - L.minSunY) * night);
      light.normalize();
      const tint = u.lightColor.value.copy(sunColor),
        grey = (tint.r + tint.g + tint.b) / 3;
      tint.lerp(neutral.setRGB(grey, grey, grey), L.neutral * day * (1 - low));
      // A low sun is weaker through more air but its light is what models the ranges: keep it strong.
      tint.multiplyScalar((L.sun * day + L.moon * night) * (1 + L.lowBoost * low * day));
      const fog = scene.fog?.color;
      u.skyColor.value
        .copy(fog || mountainColor)
        // A low sun leaves the shade to the cooler sky away from it: blue shade against the warm lit faces.
        .lerp(mountainColor, 0.5 + 0.3 * low * day)
        .lerp(coolShade, L.coolShare * low * day)
        .multiplyScalar((L.sky * day + L.nightSky * night) * (1 - L.lowFill * low * day));
      u.bounceColor.value.copy(cloudColor).multiplyScalar(L.bounce * (0.3 + 0.7 * day));
      u.glowColor.value.copy(sunColor).multiplyScalar(L.glow * day * (0.4 + 0.6 * low));
      // Alpenglow only for a warm, low sun.
      u.alpenglow.value =
        day *
        Math.max(0, Math.min(1, (sunColor.r - sunColor.b) * 2.5)) *
        (1 - Math.min(1, Math.max(0, light.y - 0.2) * 3));
    },
    // 0 … 1: the morning mist in the valleys.
    setMist(level, tint, dawn = 0, sunTint) {
      u.mistDawn.value = Math.max(0, Math.min(1, dawn || 0));
      if (sunTint) u.mistSunTint.value.copy(sunTint);
      u.mist.value = Math.max(0, Math.min(1, level || 0));
      if (tint) u.mistTint.value.copy(tint);
    },
    setSnow(level) {
      snowLevel = Math.max(0, Math.min(1, level || 0));
      applySeason();
    },
    setSeason(name) {
      season = SEASONS_B[name] || SEASONS_B.summer;
      applySeason();
    },
    skyline(eye, direction) {
      tops ??= rangeTops(ranges);
      return skylineElevation(tops, eye, direction);
    },
    // Medium and low graphics: the lite ring (rangeIndexLiteB).
    setDetail,
    update() {},
    audit: () => ({
      variant: 'b',
      lite: liteShown,
      peaks: ranges.peaks.slice(0, 24),
      triangles: ranges.triangles + skirt.triangles,
      lowerClosureTriangles: skirt.triangles,
      // At most: the frustum leaves out the sectors out of view.
      drawCalls: mesh.children.length + skirtMesh.children.length,
      sectors: mesh.children.length,
      buildMs: Math.round(ranges.ms)
    })
  };
}
