// The sky dome (day, sunset, dawn and night with stars and aurora), sun, moon, cloud banks and the mountain ring.
import { SKY_VERTEX, SKY_FRAGMENT, CLOUD_VERTEX, CLOUD_FRAGMENT } from './shaders/sky.mjs';
import { createMountainsA } from './mountains-a.mjs';
import { createMountainsB } from './mountains-b.mjs';
import { sunRayLevel, drawSunRays, sunDayRayLevel, drawSoftSunRays } from './sun-rays.mjs';
import { paintContext } from './paint-canvas.mjs';

// Diffuse atmosphere stays below the lowest bloom threshold; only the compact sun emits.
export const SKY_DIFFUSE_LEVEL = 0.76;
// Bounded halo accent, strongest only when the camera points close to the sun.
export function sunViewGlint(dot) {
  const t = Math.max(0, Math.min(1, (dot - 0.96) / 0.035));
  return t * t * (3 - 2 * t);
}
// Aurora waits for a dark horizon; stars have their own unchanged night strength.
// Read the already blended linear sky colour, so city/device Auto and preset fades stay continuous.
export function auroraTwilight(horizon) {
  const brightness = 0.2126 * horizon.r + 0.7152 * horizon.g + 0.0722 * horizon.b;
  const t = Math.max(0, Math.min(1, (brightness - 0.055) / (0.2 - 0.055)));
  return 1 - t * t * (3 - 2 * t);
}

// Sparse ridge-height wisps; deliberately leave the sunset pass open.
export const MOUNTAIN_WISPS = [
  [0.25, 8],
  [1.2, 19],
  [2.25, 12],
  [4.6, 24],
  [5.45, 15],
  [6.0, 28]
];

// Variant B (layered ranges) is the default; ?mountains=a shows the heightfield ring and ?mountains=old the
// earlier strip ridges. Without a page (tests) the strip ridges are built.
const MOUNTAIN_VARIANT = (() => {
  if (typeof location === 'undefined') return null;
  const asked = /[?&]mountains=(a|b|old)(&|$)/.exec(location.search)?.[1];
  return asked === 'old' ? null : (asked ?? 'b');
})();
// Deterministic value noise and its ridged sum (0 in valleys … about 0.9 on sharp crests) for the strip ridges.
const hash2 = (x, z) => {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const valueNoise = (x, z) => {
  const xi = Math.floor(x),
    zi = Math.floor(z),
    xf = x - xi,
    zf = z - zi,
    u = xf * xf * (3 - 2 * xf),
    v = zf * zf * (3 - 2 * zf),
    a = hash2(xi, zi),
    b = hash2(xi + 1, zi),
    c = hash2(xi, zi + 1),
    d = hash2(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
// Soft fractal noise (0 … 1) for colour patches: ridged noise draws thin bright lines, which on a tall slope
// read as streaks.
function softNoise(x, z) {
  return (
    (valueNoise(x, z) * 4 +
      valueNoise(x * 2.1 + 5.3, z * 2.1 + 1.7) * 2 +
      valueNoise(x * 4.3 + 9.1, z * 4.3)) /
    7
  );
}
function ridgedNoise(x, z) {
  let sum = 0,
    amp = 0.5,
    f = 1;
  for (let o = 0; o < 4; o++) {
    const n = 1 - Math.abs(valueNoise(x * f, z * f) * 2 - 1);
    sum += n * n * amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return sum;
}
// Eight ridge sectors around the horizon: [sector, start angle, angular width, radius (m), height (m)].
const RIDGE_SPECS = Array.from({ length: 8 }, (_, i) => [
  i,
  -Math.PI + (i * Math.PI) / 4 - 0.31,
  [0.67, 0.59, 0.72, 0.55, 0.69, 0.62, 0.71, 0.57][i],
  [340, 390, 420, 360, 410, 345, 430, 370][i],
  [103, 118, 107, 101, 125, 98, 120, 106][i]
]);
// Three depths of smooth, craggy ridges. Lower slopes dissolve into the haze and fog colour,
// so distant ranges read as layered silhouettes instead of flat facets.
const RIDGE_LAYERS = [
  {
    layer: 'distant',
    add: 172,
    lo: -204,
    hi: -112,
    base: -202,
    crest: -152,
    crestScale: 0.78,
    back: -178,
    backScale: 0.5,
    backBase: -228,
    heightScale: 1.16,
    haze: 0.6
  },
  {
    layer: 'far',
    add: 86,
    lo: -182,
    hi: -92,
    base: -184,
    crest: -136,
    crestScale: 0.83,
    back: -164,
    backScale: 0.54,
    backBase: -212,
    heightScale: 1.08,
    haze: 0.42
  },
  {
    layer: 'near',
    add: 0,
    lo: -142,
    hi: -76,
    base: -168,
    crest: -108,
    crestScale: 0.9,
    back: -148,
    backScale: 0.68,
    backBase: -184,
    heightScale: 1,
    haze: 0.22
  }
];
// Mountain surface: grid density (most rows on the front slope, the face seen from the garden), colours
// (linear) and relief. Bands are measured down from each ridge's own summit, so every range shows forest
// low down, bare rock higher and snow on its main peaks, whatever its absolute height.
const MOUNTAIN = {
  columns: 96,
  rows: 20,
  front: 0.5,
  forest: [0.03, 0.13, 0.035],
  meadow: [0.09, 0.21, 0.04],
  rock: [0.16, 0.155, 0.165],
  // Metres below the summit where forest gives way to rock (crests lower it, gullies raise it).
  treeBelow: 32,
  // Ridged noise: feature size (m) and height as a share of the ridge height.
  grain: 34,
  relief: 0.2,
  reach: 110,
  lift: 45
};
// Snow caps make the ranges read as mountains: the cap covers the top (1 - line) of SNOW.depth metres below
// each summit, with a broken edge; winter brings the line down by SNOW.winter.
const SNOW = {
  depth: 26,
  line: 0.5,
  winter: 0.35,
  colour: [0.93, 0.95, 1.0]
};
// The earlier strip ridges (?mountains=old, and the tests): three depths of eight sectors, each a mesh surface
// with forest, rock and a shader snow cap. Returns one material per depth and every ridge's summit.
function buildStripRidges(THREE, { own, add, sunSide, snowShift }) {
  const materials = [],
    peaks = [];
  RIDGE_LAYERS.forEach((raw, layerIndex) => {
    // Raised so forest and rock slopes show above the cloud banks on the horizon, not only snowy tips.
    const spec = { ...raw };
    for (const key of ['lo', 'hi', 'base', 'crest', 'back', 'backBase']) spec[key] = raw[key] + MOUNTAIN.lift;
    const { lo, hi } = spec,
      material = own(
        new THREE.MeshStandardMaterial({
          color: 0x9e9cb9,
          roughness: 1,
          vertexColors: true,
          side: THREE.DoubleSide,
          transparent: true,
          depthWrite: false
        })
      );
    materials[layerIndex] = material;
    material.customProgramCacheKey = () => `ridge-surface-v6-${lo}-${hi}`;
    material.onBeforeCompile = shader => {
      shader.uniforms.ridgeSnowShift = snowShift;
      shader.vertexShader =
        `attribute float ridgeEdge;
          attribute vec2 ridgeSnow;
          varying float ridgeWorldY;
          varying float ridgeEdgeFade;
          varying vec2 ridgeSnowSpan;
          varying vec2 ridgeWorldXZ;
` +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
            vec4 ridgeWorld=modelMatrix*vec4(position,1.);
            ridgeWorldY=ridgeWorld.y;
            ridgeWorldXZ=ridgeWorld.xz;
            ridgeEdgeFade=ridgeEdge;
            ridgeSnowSpan=ridgeSnow;`
        );
      shader.fragmentShader =
        `varying float ridgeWorldY;
          varying float ridgeEdgeFade;
          varying vec2 ridgeSnowSpan;
          varying vec2 ridgeWorldXZ;
          uniform float ridgeSnowShift;
` +
        shader.fragmentShader
          .replace(
            '#include <color_fragment>',
            `#include <color_fragment>
              float ridgeRise=max(1.,ridgeSnowSpan.y-ridgeSnowSpan.x);
              float ridgeLine=ridgeSnowSpan.x+ridgeRise*(${SNOW.line}-ridgeSnowShift);
              float ridgeBreak=(sin(ridgeWorldXZ.x*.09)*sin(ridgeWorldXZ.y*.11)+.5*
                  sin(ridgeWorldXZ.x*.31+ridgeWorldXZ.y*.27))*ridgeRise*.09;
              float ridgeCap=smoothstep(ridgeLine-ridgeRise*.04,ridgeLine+ridgeRise*.1,
                  ridgeWorldY+ridgeBreak);
              diffuseColor.rgb=mix(diffuseColor.rgb,vec3(${SNOW.colour.join(',')}),ridgeCap);`
          )
          .replace(
            '#include <alphatest_fragment>',
            // Solid mountains: only the foot fades out into the haze (it used to fade almost to the crest).
            `diffuseColor.a*=smoothstep(${lo}.,${lo + 26}.,ridgeWorldY)*ridgeEdgeFade;
              #include <alphatest_fragment>`
          )
          .replace(
            '#include <fog_fragment>',
            // Aerial perspective by depth layer instead of the scene fog (which greyed the ranges out): a fixed
            // share of the fog colour, rising to most of it at the foot, where the slopes sink into the clouds.
            // Snow keeps more of its own colour.
            `vec3 ridgePreFog=gl_FragColor.rgb;
              #include <fog_fragment>
              #ifdef USE_FOG
                float ridgeHaze=${spec.haze.toFixed(2)}+${(1 - spec.haze).toFixed(2)}*.85*
                    (1.-smoothstep(${lo + 20}.,${lo + 80}.,ridgeWorldY));
                gl_FragColor.rgb=mix(ridgePreFog,fogColor,ridgeHaze*(1.-.35*ridgeCap));
              #endif`
          );
    };
    const positions = [],
      colors = [],
      // Per vertex: 1 in the forest band, 0 above the tree line.
      woods = [],
      edges = [],
      snow = [],
      indices = [];
    for (const [sector, baseAngle, baseWidth, baseRadius, baseHeight] of RIDGE_SPECS) {
      const angle = baseAngle + (spec.add ? 0.08 * Math.min(2, spec.add / 86) : 0),
        width = baseWidth + (spec.add ? 0.08 : 0),
        radius = baseRadius + spec.add,
        height = baseHeight * spec.heightScale;
      let peak = -Infinity;
      // A real mountain surface, not a strip: MOUNTAIN.rows samples across the range (front slope, crest, back
      // slope) with spurs and gullies, coloured forest low down, rock higher up and on steep faces; the snow
      // cap is added in the shader.
      const first = positions.length / 3,
        rows = MOUNTAIN.rows,
        columns = MOUNTAIN.columns,
        phase = sector * 1.7 + layerIndex * 2.3,
        heights = [],
        relief = [];
      for (let i = 0; i <= columns; i++) {
        const t = i / columns,
          envelope = Math.sin(Math.PI * t) ** 0.45;
        const peakA = Math.exp(-Math.pow((t - (0.27 + (sector % 3) * 0.04)) / 0.13, 2)),
          peakB = Math.exp(-Math.pow((t - (0.67 + (sector % 2) * 0.04)) / 0.16, 2)),
          crag = Math.exp(-Math.pow((t - (0.47 + (sector % 2) * 0.08)) / 0.055, 2));
        const detail =
          0.045 * Math.sin(i * 0.4 + phase) +
          0.022 * Math.sin(i * 1.05 + phase * 1.3) +
          0.01 * Math.sin(i * 2.6 + phase * 0.7);
        const ridge = height * (0.38 + 0.56 * peakA + 0.36 * peakB + 0.18 * crag + detail) * envelope;
        const crest = spec.crest + ridge * spec.crestScale,
          back = spec.back + ridge * spec.backScale,
          base = spec.base - 8 * Math.sin(i * 0.31);
        for (let k = 0; k <= rows; k++) {
          const u = k / rows,
            f = MOUNTAIN.front,
            a = angle + t * width,
            // The crest stays 23 m behind the ridge radius; the front slope's foot reaches MOUNTAIN.reach metres
            // toward the garden, so the face is a slope rather than a near-vertical wall (on a wall every small
            // difference between columns turned into a light or dark vertical stripe).
            r =
              radius +
              23 +
              (u < f ? -(1 - u / f) * MOUNTAIN.reach : ((u - f) / (1 - f)) * 46) +
              Math.sin(i * 0.39 + u * 9) * 4,
            x = Math.sin(a) * r,
            z = Math.cos(a) * r;
          // Front slope up to the crest at u = front, then the back slope down.
          let y =
            u < f
              ? base + (crest - base) * Math.sin(((u / f) * Math.PI) / 2) ** 1.4
              : u < 0.8
                ? crest + (back - crest) * ((u - f) / (0.8 - f)) ** 1.3
                : back + (spec.backBase - back) * ((u - 0.8) / 0.2);
          // Ridged noise cuts spurs, gullies and crags into the slopes: strongest mid-slope, lighter on the
          // crest line (the silhouette keeps its peaks), none at the foot.
          // Sampled along the ridge and up the slope (the face seen from the garden); sampling by depth drew
          // full-height stripes.
          const rough = ridgedNoise((a * radius) / MOUNTAIN.grain + phase, y / MOUNTAIN.grain),
            slope = Math.sin(Math.PI * Math.min(1, u / (f * 1.25)));
          y += ridge * MOUNTAIN.relief * (rough - 0.45) * slope;
          positions.push(x, y, z);
          heights.push(y);
          relief.push(softNoise((a * radius) / 70 + phase, y / 45));
          edges.push(Math.sin(Math.PI * t) ** 0.6);
          if (u <= f + 0.05) peak = Math.max(peak, y);
        }
      }
      // Farthest rows first: the surface is transparent without depth writes, so painter's order keeps the
      // back slope from painting over the front slope (it showed as light vertical streaks).
      for (let k = rows - 1; k >= 0; k--)
        for (let i = 0; i < columns; i++) {
          const a = first + i * (rows + 1) + k,
            b = a + 1,
            c = a + rows + 1,
            d = c + 1;
          indices.push(a, b, c, c, b, d);
        }
      // Provisional colours: forest up to a broken tree line below this ridge's summit, rock above it, in soft
      // light and dark patches. Steep faces turn to rock once normals exist (below); snow is added in the shader.
      const treeLine = peak - MOUNTAIN.treeBelow;
      for (let v = 0; v < heights.length; v++) {
        const y = heights[v],
          patch = relief[v],
          n = 0.5 + 0.5 * Math.sin(v * 12.9898) * Math.sin(v * 4.1414),
          shade = 0.82 + 0.3 * patch,
          forest = MOUNTAIN.forest.map((c, j) => c + (MOUNTAIN.meadow[j] - c) * 0.4 * n),
          rock = MOUNTAIN.rock.map(c => c * (0.9 + 0.2 * n)),
          w = Math.min(1, Math.max(0, (y - treeLine + (patch - 0.5) * 22) / 7));
        colors.push(...forest.map((c, j) => (c + (rock[j] - c) * w) * shade));
        woods.push(1 - w);
      }
      // Every vertex of this ridge knows where its snow band starts and its summit, for its own snow line.
      for (let v = first; v < positions.length / 3; v++) snow.push(peak - SNOW.depth, peak);
      peaks.push({ sector, layer: spec.layer, peak, radius });
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('ridgeEdge', new THREE.Float32BufferAttribute(edges, 1));
    geometry.setAttribute('ridgeSnow', new THREE.Float32BufferAttribute(snow, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    // Steep faces above the tree line show bare rock (in the forest band that turned every spur into a grey
    // vertical stripe); slopes toward the sun are a little lighter, so crests catch the warm horizon.
    const n = geometry.attributes.normal,
      col = geometry.attributes.color;
    for (let v = 0; v < n.count; v++) {
      const steep = Math.min(1, Math.max(0, (0.45 - n.getY(v)) / 0.3)) * 0.7 * (1 - 0.9 * woods[v]),
        lit =
          0.85 + 0.25 * Math.max(0, n.getX(v) * sunSide.x + n.getY(v) * sunSide.y + n.getZ(v) * sunSide.z);
      const r = (col.getX(v) + (MOUNTAIN.rock[0] - col.getX(v)) * steep) * lit,
        g = (col.getY(v) + (MOUNTAIN.rock[1] - col.getY(v)) * steep) * lit,
        b = (col.getZ(v) + (MOUNTAIN.rock[2] - col.getZ(v)) * steep) * lit;
      col.setXYZ(v, r, g, b);
    }
    const ridge = add(geometry, material);
    ridge.userData.dynamic = true;
    ridge.renderOrder = -5 + layerIndex;
  });
  return { materials, peaks };
}
// Dome-cloud weather: a few looks [cumulus amount 0..1, cumulus size (deck scale, larger = smaller clouds),
// cirrus amount 0..1, milky veil 0..1]. The sky holds each for WEATHER_HOLD seconds of the cloud clock, then
// eases into the next over WEATHER_BLEND seconds, in an order shuffled by the visit's seed.
export const WEATHER = [
  { name: 'scattered', look: [0.65, 1, 0.3, 0] },
  { name: 'fair', look: [0.36, 1.2, 0.25, 0] },
  { name: 'cirrus', look: [0.22, 1.2, 0.95, 0.7] },
  { name: 'broken', look: [0.92, 0.85, 0.5, 0.15] },
  { name: 'clear', look: [0.14, 1.3, 0.12, 0] }
];
export const WEATHER_HOLD = 150;
export const WEATHER_BLEND = 70;
// ?clouds=fixed (benchmarks, comparisons): seed 0 and the first look, never changing; ?clouds=<number> picks
// the seed. Without a page (tests) the sky is fixed too.
export function cloudOptions(search) {
  if (typeof search !== 'string') return { fixed: true, seed: 0 };
  const asked = /[?&]clouds=([a-z0-9]+)(&|$)/.exec(search)?.[1];
  if (asked === 'fixed') return { fixed: true, seed: 0 };
  if (asked && /^\d+$/.test(asked)) return { fixed: false, seed: Number(asked) % 997 };
  return { fixed: false, seed: Math.floor(Math.random() * 997) };
}
// Weather look at cloud-clock time t (s) for a seed, written into out ({x, y, z, w}); no allocation.
export function weatherAt(t, seed, out, fixed = false) {
  const n = WEATHER.length,
    cycle = WEATHER_HOLD + WEATHER_BLEND,
    // The seed picks the first look and a step through the list (coprime with its prime length), so every
    // visit walks all looks in its own order, starting part-way into a hold.
    first = fixed ? 0 : seed % n,
    step = 1 + (Math.floor(seed / n) % (n - 1)),
    time = fixed ? 0 : Math.max(0, t || 0) + (seed % 7) * 17,
    k = Math.floor(time / cycle),
    into = time - k * cycle,
    a = WEATHER[(first + k * step) % n].look,
    b = WEATHER[(first + (k + 1) * step) % n].look,
    x = Math.min(1, Math.max(0, (into - WEATHER_HOLD) / WEATHER_BLEND)),
    m = x * x * (3 - 2 * x);
  out.x = a[0] + (b[0] - a[0]) * m;
  out.y = a[1] + (b[1] - a[1]) * m;
  out.z = a[2] + (b[2] - a[2]) * m;
  out.w = a[3] + (b[3] - a[3]) * m;
  return out;
}
export function createBackdrop(THREE, scene, resources, random, mountainMaterial) {
  const own = value => {
    resources.add(value);
    return value;
  };
  // Backdrop pieces are marked (userData.backdrop): Ultra's pool reflections mirror only them (ultra-effects.mjs).
  const add = (geometry, material) => {
    const mesh = new THREE.Mesh(own(geometry), material);
    mesh.userData.backdrop = true;
    scene.add(mesh);
    return mesh;
  };
  const skyMaterial = own(
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      toneMapped: false,
      uniforms: {
        diffuseLimit: { value: SKY_DIFFUSE_LEVEL },
        top: { value: new THREE.Color('#5045a0') },
        horizon: { value: new THREE.Color('#f48476') },
        low: { value: new THREE.Color('#987bbe') },
        // Linear colours, as the shader had them before the sunset variants (world.mjs SKY_TONES).
        redNear: { value: new THREE.Color(0.95, 0.17, 0.06) },
        redFar: { value: new THREE.Color(0.42, 0.09, 0.3) },
        blushTint: { value: new THREE.Color(0.88, 0.38, 0.7) },
        sunColor: { value: new THREE.Color('#ffd092') },
        sunStrength: { value: 1 },
        sunDir: { value: new THREE.Vector3(-167, 9, -277).normalize() },
        // The disc, its halo and rays sit on a 540 m sphere round the garden's centre (horizonFade), while this dome
        // follows the camera: where the disc is actually seen from the camera, and its size against the view from
        // the centre. Set before every draw of the dome (sky.onBeforeRender).
        sunView: { value: new THREE.Vector3(-167, 9, -277).normalize() },
        sunScale: { value: 1 },
        glow: { value: new THREE.Color('#ff8a5c') },
        // Night sky: stars, and aurora curtains (0 off … 1 full) with a green lower edge and a season-tinted
        // upper fringe, drifting with the cloud clock. auroraFull 0 drops the second curtain (economy).
        aurora: { value: 0 },
        auroraLow: { value: new THREE.Color(0.08, 0.92, 0.8) },
        auroraHigh: { value: new THREE.Color(0.62, 0.38, 1) },
        // Colours that drift along the curtains: violet/magenta in the body, a blue or pink touch at the top.
        auroraMid: { value: new THREE.Color(0.55, 0.22, 0.95) },
        auroraTip: { value: new THREE.Color(0.35, 0.45, 1) },
        auroraCoolSpread: { value: 0 },
        auroraFull: { value: 1 },
        // Ultra graphics: brighter, fuller curtains (setUltra).
        auroraGain: { value: 1 },
        stars: { value: 0 },
        skyTime: { value: 0 },
        // Dawn (0 … 1, the morning preset): a cooler peach and rose-gold horizon instead of the sunset's deep
        // orange, a pink anti-twilight arch opposite the sun, low mist and the last stars.
        dawn: { value: 0 },
        // 0 in economy: the dome clouds drop their finest octave.
        skyDetail: { value: 1 },
        // Dome-cloud weather (cumulus amount, cumulus size, cirrus amount, milky veil) and the visit's seed
        // (an offset into the noise): set by weatherAt and setCloudSeed.
        weather: { value: new THREE.Vector4(...WEATHER[0].look) },
        cloudSeed: { value: new THREE.Vector2() }
      },
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT
    })
  );
  const sky = add(new THREE.SphereGeometry(540, 20, 10), skyMaterial);
  sky.renderOrder = -20;
  const mountainTint = new THREE.Color(0x8274af);
  const sunSide = new THREE.Vector3(-0.4, 0.8, -0.5).normalize();
  const snowShift = { value: 0 };
  // The strip ridges are built only when no mountain variant replaces them.
  const strips = MOUNTAIN_VARIANT
    ? { materials: [], peaks: [] }
    : buildStripRidges(THREE, { own, add, sunSide, snowShift });
  const mountainMaterials = strips.materials,
    ridgePeaks = strips.peaks;
  const mountainVariant = MOUNTAIN_VARIANT
    ? { a: createMountainsA, b: createMountainsB }[MOUNTAIN_VARIANT](THREE, { scene, own, add, sunSide })
    : null;
  const cloudMaterial = own(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      uniforms: {
        diffuseLimit: { value: SKY_DIFFUSE_LEVEL },
        tint: { value: new THREE.Color(0xbca3cc) },
        warm: { value: new THREE.Color(0xffc29d) },
        sunStrength: { value: 1 },
        sunDirection: { value: new THREE.Vector3(-0.38, 0.76, -0.53).normalize() },
        drift: { value: 0 }
      },
      vertexShader: CLOUD_VERTEX,
      fragmentShader: CLOUD_FRAGMENT
    })
  );
  const cloudGeometry = own(new THREE.SphereGeometry(1, 12, 6));
  const clouds = new THREE.InstancedMesh(cloudGeometry, cloudMaterial, 128 + MOUNTAIN_WISPS.length),
    dummy = new THREE.Object3D();
  clouds.renderOrder = -2;
  // Same 128 instances: horizon banks, middle-distance clouds and four high groups (each a compact cumulus of four
  // round puffs drawn in close: owner, round 5, the flat discs).
  const cloudGroups = Array.from({ length: 32 }, (_, i) => {
    const high = i >= 28,
      bank = i < 20,
      a = bank
        ? (i / 20) * Math.PI * 2
        : high
          ? ((i - 28) * Math.PI) / 2 - 0.4
          : ((i - 20) / 8) * Math.PI * 2 + 0.25,
      r = bank ? 270 + (i % 3) * 26 : high ? 250 : 38 + (i % 3) * 22;
    return {
      x: Math.sin(a) * r,
      z: Math.cos(a) * r,
      y: bank ? -93 - (i % 3) * 8 : high ? 16 + (i % 3) * 8 : -46 - (i % 3) * 7,
      high,
      bank
    };
  });
  for (let i = 0; i < 128; i++) {
    const group = cloudGroups[i % 32],
      lobe = Math.floor(i / 32),
      a = lobe * 1.6,
      r = group.bank ? 21 : 14,
      spread = group.high ? 0.5 : 1;
    dummy.position.set(
      group.x + Math.sin(a) * r * spread,
      group.y + (group.high ? [0, 2, -1, 1][lobe] : [1, 8, -4, 3][lobe]),
      group.z + Math.cos(a) * r * spread
    );
    dummy.scale.set(
      group.bank ? 34 + random() * 16 : group.high ? 8 + random() * 4 : 22 + random() * 9,
      group.high ? 4.6 + random() * 1.3 : group.bank ? 22 + random() * 5 : 16 + random() * 5,
      group.bank ? 25 + random() * 11 : group.high ? 7 + random() * 3 : 17 + random() * 7
    );
    dummy.rotation.set(0, random() * Math.PI, 0);
    dummy.updateMatrix();
    clouds.setMatrixAt(i, dummy.matrix);
  }
  MOUNTAIN_WISPS.forEach(([angle, height], i) => {
    const radius = 236 + (i % 3) * 7;
    dummy.position.set(Math.sin(angle) * radius, height, Math.cos(angle) * radius);
    dummy.scale.set(11 + (i % 2) * 3, 2.2 + (i % 3) * 0.35, 6 + (i % 2));
    dummy.rotation.set(0, angle + 0.5, 0);
    dummy.updateMatrix();
    clouds.setMatrixAt(128 + i, dummy.matrix);
  });
  clouds.computeBoundingSphere();
  clouds.userData.backdrop = true;
  scene.add(clouds);
  resources.add(clouds);
  // Feather the existing disc rather than adding a solid halo or another draw call.
  const coreCanvas = document.createElement('canvas');
  coreCanvas.width = coreCanvas.height = 128;
  const coreContext = paintContext(coreCanvas);
  const coreGradient = coreContext.createRadialGradient(64, 64, 0, 64, 64, 64);
  coreGradient.addColorStop(0, 'rgba(255,255,255,1)');
  coreGradient.addColorStop(0.72, 'rgba(255,255,255,1)');
  coreGradient.addColorStop(0.9, 'rgba(255,250,230,.82)');
  coreGradient.addColorStop(1, 'rgba(255,244,210,0)');
  coreContext.fillStyle = coreGradient;
  coreContext.fillRect(0, 0, 128, 128);
  const coreTexture = own(new THREE.CanvasTexture(coreCanvas));
  coreTexture.colorSpace = THREE.SRGBColorSpace;
  const diskMaterial = own(
    new THREE.MeshBasicMaterial({
      color: 0xfff2cc,
      map: coreTexture,
      depthWrite: false,
      toneMapped: false,
      fog: false,
      transparent: true,
      opacity: 1
    })
  );
  // Render the existing sun/glow on the dome radius without changing logical light
  // positions. The mask follows the camera ray to that same sphere, not a world-y cut.
  function horizonFade(material) {
    material.onBeforeCompile = shader => {
      shader.vertexShader = 'varying vec3 celestialWorld;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        'vec4 celestial= modelMatrix*vec4(transformed,1.0);\n' +
          'vec3 center=modelMatrix[3].xyz;vec3 farCenter=normalize(center)*540.0;\n' +
          'float angularScale=length(farCenter-cameraPosition)/max(length(center-cameraPosition),1.0);\n' +
          'celestial.xyz=farCenter+(celestial.xyz-center)*angularScale;\n' +
          'celestialWorld=celestial.xyz;\nvec4 mvPosition=viewMatrix*celestial;\ngl_Position=projectionMatrix*mvPosition;\n' +
          // Just inside the far plane: 1 in the usual depth, 0 in reversed depth (garden.mjs).
          '#ifdef USE_REVERSED_DEPTH_BUFFER\ngl_Position.z=max(gl_Position.z,gl_Position.w*0.0001);\n' +
          '#else\ngl_Position.z=min(gl_Position.z,gl_Position.w*0.9999);\n#endif'
      );
      shader.fragmentShader = 'varying vec3 celestialWorld;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <alphamap_fragment>',
        '#include <alphamap_fragment>\n' +
          'vec3 ray=normalize(celestialWorld-cameraPosition);\n' +
          'float along=dot(cameraPosition,ray);\n' +
          'float exitT=-along+sqrt(max(0.0,along*along+540.0*540.0-dot(cameraPosition,cameraPosition)));\n' +
          'float skyHeight=(cameraPosition+ray*exitT).y/540.0;\n' +
          'diffuseColor.a*=smoothstep(-0.0015,0.0015,skyHeight);\n' +
          // Owner, 2026-10-31: the rays and the disc of the sun showed through the far range. The vertex clamp keeps
          // them at the depth of the 540 m dome, in front of the far range (560 m, up to 665 m where it slides in,
          // mountains-b.mjs VERTEX); at the far plane every range covers them. Set per fragment: a vertex depth set
          // at the far plane would also skip the near-plane clip of a quad reaching behind the camera. The sky dome
          // and the clouds write no depth.
          '#ifdef USE_REVERSED_DEPTH_BUFFER\ngl_FragDepth=0.000001;\n#else\ngl_FragDepth=0.999999;\n#endif'
      );
    };
    material.customProgramCacheKey = () => 'garden-sky-horizon-v1';
  }
  horizonFade(diskMaterial);
  const sun = add(new THREE.CircleGeometry(13.5, 64), diskMaterial);
  sun.position.set(-167, 9, -277);
  sun.lookAt(0, 9, 0);
  sun.renderOrder = 2;
  sun.userData.dynamic = true;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const c = paintContext(canvas),
    gradient = c.createRadialGradient(64, 64, 4, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,225,157,.38)');
  gradient.addColorStop(0.4, 'rgba(255,179,99,.09)');
  gradient.addColorStop(1, 'rgba(255,142,105,0)');
  c.fillStyle = gradient;
  c.fillRect(0, 0, 128, 128);
  const glowTexture = own(new THREE.CanvasTexture(canvas));
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  const haloMaterial = own(
    new THREE.MeshBasicMaterial({
      map: glowTexture,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      toneMapped: false,
      fog: false
    })
  );
  horizonFade(haloMaterial);
  const halo = add(new THREE.PlaneGeometry(62, 62), haloMaterial);
  sun.frustumCulled = halo.frustumCulled = false;
  halo.position.copy(sun.position).add(new THREE.Vector3(0, 0, -0.1));
  halo.quaternion.copy(sun.quaternion);
  halo.renderOrder = 1;
  halo.userData.dynamic = true;
  const haloView = new THREE.Vector3(),
    haloEye = new THREE.Vector3(),
    haloTarget = new THREE.Vector3();
  halo.onBeforeRender = (_renderer, _scene, camera) => {
    camera.getWorldPosition(haloEye);
    camera.getWorldDirection(haloView);
    haloTarget.copy(sun.position).normalize().multiplyScalar(540).sub(haloEye).normalize();
    haloMaterial.opacity = diskMaterial.opacity * (0.6 + 0.1 * sunViewGlint(haloView.dot(haloTarget)));
  };
  const skyEye = new THREE.Vector3(),
    skySun = new THREE.Vector3();
  sky.onBeforeRender = (_renderer, _scene, camera) => {
    camera.getWorldPosition(skyEye);
    const u = skyMaterial.uniforms;
    skySun.copy(sun.position).normalize().multiplyScalar(540);
    u.sunView.value.copy(skySun).sub(skyEye).normalize();
    // The disc keeps the angular size it would have at its logical distance (horizonFade's angularScale).
    u.sunScale.value = Math.max(0.2, sun.position.length() / Math.max(1, sun.position.distanceTo(skyEye)));
  };
  // Sun rays and glare (sun-rays.mjs): one quad on the dome, drawn before the cloud meshes so clouds pass in front of
  // it and behind the ridges (the depth test), shown for a low sun and strongest when the camera looks toward it.
  const rayCanvas = document.createElement('canvas');
  rayCanvas.width = rayCanvas.height = 512;
  drawSunRays(paintContext(rayCanvas), 512);
  const rayTexture = own(new THREE.CanvasTexture(rayCanvas));
  rayTexture.colorSpace = THREE.SRGBColorSpace;
  const rayMaterial = own(
    new THREE.MeshBasicMaterial({
      map: rayTexture,
      color: 0xffc98a,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      fog: false
    })
  );
  horizonFade(rayMaterial);
  const RAY_OPACITY = 0.7;
  const rays = add(new THREE.PlaneGeometry(300, 300), rayMaterial);
  rays.frustumCulled = false;
  rays.renderOrder = -3;
  rays.visible = false;
  rays.userData.dynamic = true;
  // Light only: clicks, focus and ground rays pass through it.
  rays.raycast = () => {};
  let rayLevel = 0,
    rayPulse = 1;
  const rayRoll = new THREE.Quaternion(),
    rayAxis = new THREE.Vector3(0, 0, 1),
    rayTint = new THREE.Color(0xffa860);
  rays.onBeforeRender = (_renderer, _scene, camera) => {
    camera.getWorldPosition(haloEye);
    camera.getWorldDirection(haloView);
    haloTarget.copy(sun.position).normalize().multiplyScalar(540).sub(haloEye).normalize();
    rayMaterial.opacity =
      rayLevel *
      rayPulse *
      RAY_OPACITY *
      (0.75 + 0.25 * sunViewGlint(haloView.dot(haloTarget))) *
      sunShowing(_renderer, haloEye);
  };
  // Soft rays for a day sun (sun-rays.mjs drawSoftSunRays): a second quad on the dome, the same way, fading in as the
  // sun climbs out of the low-sun fan. Owner, 2026-10-31: visible on the day sky, never washing it out.
  const dayRayCanvas = document.createElement('canvas');
  dayRayCanvas.width = dayRayCanvas.height = 512;
  drawSoftSunRays(paintContext(dayRayCanvas), 512);
  const dayRayTexture = own(new THREE.CanvasTexture(dayRayCanvas));
  dayRayTexture.colorSpace = THREE.SRGBColorSpace;
  const dayRayMaterial = own(
    new THREE.MeshBasicMaterial({
      map: dayRayTexture,
      color: 0xfff1d6,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      fog: false
    })
  );
  horizonFade(dayRayMaterial);
  const DAY_RAY_OPACITY = 0.45;
  const dayRays = add(new THREE.PlaneGeometry(260, 260), dayRayMaterial);
  dayRays.frustumCulled = false;
  dayRays.renderOrder = -3;
  dayRays.visible = false;
  dayRays.userData.dynamic = true;
  dayRays.raycast = () => {};
  let dayRayLevel = 0;
  const dayRayWhite = new THREE.Color(0xffffff);
  dayRays.onBeforeRender = (renderer, _scene, camera) => {
    camera.getWorldPosition(haloEye);
    camera.getWorldDirection(haloView);
    haloTarget.copy(sun.position).normalize().multiplyScalar(540).sub(haloEye).normalize();
    dayRayMaterial.opacity =
      dayRayLevel *
      DAY_RAY_OPACITY *
      (0.55 + 0.45 * sunViewGlint(haloView.dot(haloTarget))) *
      sunShowing(renderer, haloEye);
  };
  // How much of the sun's disc shows over the mountains from the eye (0..1, eased over about 0.15 s), once per frame:
  // a sun behind a ridge shows no rays. Owner, 2026-10-31: the rays showed through the mountains. The disc itself is
  // hidden by the depth test; the rays reach past it and need the skyline (mountains-b.mjs skyline).
  const SUN_DISC = 0.04;
  let sunShow = 1,
    sunShowFrame = -1,
    sunShowAt = 0;
  const sunAim = new THREE.Vector3();
  function sunShowing(renderer, eye) {
    const frame = renderer.info.render.frame;
    if (frame === sunShowFrame) return sunShow;
    sunShowFrame = frame;
    const now = performance.now(),
      dt = sunShowAt ? Math.min(0.25, (now - sunShowAt) / 1000) : 1;
    sunShowAt = now;
    sunAim.copy(sun.position).normalize().multiplyScalar(540).sub(eye);
    const skyline = mountainVariant?.skyline?.(eye, sunAim) ?? -Math.PI / 2,
      elevation = Math.atan2(sunAim.y, Math.hypot(sunAim.x, sunAim.z)),
      t = Math.max(0, Math.min(1, (elevation - skyline + SUN_DISC) / (2 * SUN_DISC))),
      target = t * t * (3 - 2 * t);
    sunShow += (target - sunShow) * Math.min(1, dt / 0.15);
    return sunShow;
  }
  const moonCanvas = document.createElement('canvas');
  moonCanvas.width = moonCanvas.height = 128;
  const mc = paintContext(moonCanvas),
    moonBase = mc.createRadialGradient(43, 42, 8, 69, 66, 76);
  moonBase.addColorStop(0, '#cfdbeb');
  moonBase.addColorStop(0.55, '#a3b5d5');
  moonBase.addColorStop(1, '#414c76');
  mc.fillStyle = moonBase;
  mc.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 27; i++) {
    const x = 15 + (Math.sin(i * 13.7) * 0.5 + 0.5) * 100,
      y = 14 + (Math.sin(i * 9.3 + 1) * 0.5 + 0.5) * 99,
      r = 3 + (i % 6) * 1.8;
    if (Math.hypot(x - 64, y - 64) > 57 - r) continue;
    const crater = mc.createRadialGradient(x - r * 0.25, y - r * 0.3, 0, x, y, r);
    crater.addColorStop(0, '#53638670');
    crater.addColorStop(0.63, '#64769760');
    crater.addColorStop(0.8, '#d3dcdf65');
    crater.addColorStop(1, '#8c9dbd00');
    mc.fillStyle = crater;
    mc.beginPath();
    mc.arc(x, y, r, 0, Math.PI * 2);
    mc.fill();
  }
  const moonTexture = own(new THREE.CanvasTexture(moonCanvas));
  moonTexture.colorSpace = THREE.SRGBColorSpace;
  const moonMaterial = own(
    new THREE.MeshBasicMaterial({
      map: moonTexture,
      color: 0xc3cff2,
      toneMapped: false,
      fog: false,
      transparent: true,
      opacity: 0
    })
  );
  // The phase of the date (moon-phase.mjs): the terminator is an ellipse across the disc, softened a little; the
  // dark side keeps a faint earthshine. The disc faces the garden, so its +x is the viewer's right (waxing side).
  const moonPhaseUniform = { value: 0.5 };
  moonMaterial.onBeforeCompile = shader => {
    shader.uniforms.moonPhase = moonPhaseUniform;
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform float moonPhase;\nvoid main() {')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        {
          vec2 q = vMapUv * 2. - 1.;
          float w = sqrt(max(0., 1. - q.y * q.y)), s = cos(moonPhase * 6.2831853),
            edge = moonPhase < .5 ? q.x - s * w : -s * w - q.x;
          float lit = smoothstep(-.05, .05, edge);
          diffuseColor.rgb *= mix(.3, 1., lit);
          diffuseColor.a *= mix(.16, 1., lit);
        }`
      );
  };
  moonMaterial.customProgramCacheKey = () => 'garden-moon-phase';
  const setMoonPhase = phase => {
    moonPhaseUniform.value = phase;
  };
  const moon = add(new THREE.CircleGeometry(9, 48), moonMaterial);
  moon.position.set(-135, 74, -265);
  moon.lookAt(0, 16, 0);
  moon.userData.dynamic = true;
  moon.renderOrder = 2;
  // Aurora on every night, strongest in winter. The lower edge is always a green or teal of real aurora
  // (linear RGB); the season tints the upper fringe: lilac in winter, rose in spring, azure in summer,
  // crimson (the real red of high aurora) in autumn. mid drifts through the curtain bodies (violet or
  // magenta), tip touches the fringe now and then (blue or pink), so the colours slowly travel and shift.
  const AURORA = {
    winter: { level: 1, low: [0.08, 0.92, 0.8], high: [0.62, 0.38, 1] },
    spring: { level: 0.8, low: [0.26, 1, 0.45], high: [1, 0.36, 0.62] },
    summer: { level: 0.75, low: [0.12, 1, 0.52], high: [0.16, 0.42, 1] },
    autumn: { level: 0.8, low: [0.25, 1, 0.42], high: [0.9, 0.12, 0.5] }
  };
  const AURORA_DRIFT = {
    winter: { mid: [0.62, 0.12, 0.94], tip: [0.3, 0.5, 1] },
    spring: { mid: [0.75, 0.25, 0.9], tip: [0.4, 0.55, 1] },
    summer: { mid: [0.62, 0.13, 0.98], tip: [0.12, 0.48, 0.9] },
    autumn: { mid: [0.85, 0.18, 0.75], tip: [0.45, 0.35, 1] }
  };
  let auroraWinter = 0,
    auroraNight = 0;
  function applyNightSky() {
    skyMaterial.uniforms.aurora.value = auroraWinter * auroraNight;
    skyMaterial.uniforms.aurora.value *= auroraTwilight(skyMaterial.uniforms.horizon.value);
    skyMaterial.uniforms.stars.value = auroraNight;
  }
  function setSeason(name) {
    const look = AURORA[name] || AURORA.summer;
    auroraWinter = look.level;
    skyMaterial.uniforms.auroraLow.value.setRGB(...look.low);
    skyMaterial.uniforms.auroraHigh.value.setRGB(...look.high);
    const drift = AURORA_DRIFT[name] || AURORA_DRIFT.summer;
    skyMaterial.uniforms.auroraMid.value.setRGB(...drift.mid);
    skyMaterial.uniforms.auroraTip.value.setRGB(...drift.tip);
    skyMaterial.uniforms.auroraCoolSpread.value = name === 'summer' ? 0.85 : name === 'winter' ? 0.7 : 0;
    applyNightSky();
    mountainVariant?.setSeason(name);
  }
  const lightSunColor = new THREE.Color();
  const coreWhite = new THREE.Color(0xffffff);
  function setLight({
    sunColor,
    sunStrength,
    cloudColor,
    mountainColor,
    sunHeight = 20,
    sunPosition = null,
    moonPosition = null,
    moonStrength = 1 - sunStrength
  }) {
    sun.position.set(...(sunPosition || [-167, sunHeight, -277]));
    skyMaterial.uniforms.sunDir.value.copy(sun.position).normalize();
    cloudMaterial.uniforms.sunDirection.value.copy(skyMaterial.uniforms.sunDir.value);
    sun.lookAt(0, 16, 0);
    halo.position.copy(sun.position).add(new THREE.Vector3(0, 0, -0.1));
    halo.quaternion.copy(sun.quaternion);
    moon.position.set(...(moonPosition || [-135, 20, -265]));
    moon.lookAt(0, 16, 0);
    moonMaterial.opacity = moonStrength;
    moon.visible = moonStrength > 0.005;
    sun.visible = halo.visible = sunStrength > 0.005;
    rayLevel = sunRayLevel(sun.position.y / sun.position.length(), sunStrength);
    rays.visible = rayLevel > 0.005;
    rays.position.copy(sun.position);
    rays.position.z -= 0.2;
    rays.quaternion.copy(sun.quaternion);
    rayMaterial.color.copy(sunColor).lerp(rayTint, 0.55);
    dayRayLevel = sunDayRayLevel(sun.position.y / sun.position.length(), sunStrength);
    dayRays.visible = dayRayLevel > 0.005;
    dayRays.position.copy(sun.position);
    dayRays.position.z -= 0.25;
    dayRays.quaternion.copy(sun.quaternion);
    dayRayMaterial.color.copy(sunColor).lerp(dayRayWhite, 0.6);
    lightSunColor.copy(sunColor);
    diskMaterial.color.copy(sunColor).lerp(coreWhite, 0.45);
    diskMaterial.opacity = sunStrength;
    haloMaterial.opacity = sunStrength * 0.6;
    cloudMaterial.uniforms.sunStrength.value = sunStrength;
    auroraNight = Math.max(0, Math.min(1, 1 - sunStrength));
    applyNightSky();
    cloudMaterial.uniforms.tint.value.copy(cloudColor);
    cloudMaterial.uniforms.warm.value.copy(sunColor);
    updateMist();
    mountainTint.copy(mountainColor);
    mountainMaterials.forEach((m, i) => {
      // Vertex colours carry forest, rock and snow; the time of day only tints them (distant ranges more).
      if (m !== mountainMaterial)
        m.color
          .set(0xffffff)
          .lerp(mountainColor, 0.3 - i * 0.07)
          .lerp(cloudColor, 0.08 - i * 0.03);
    });
    mountainVariant?.setLight({
      sunColor,
      sunStrength,
      cloudColor,
      mountainColor,
      sunPosition: sun.position
    });
  }
  function getLight() {
    return {
      sunColor: lightSunColor.clone(),
      sunStrength: diskMaterial.opacity,
      cloudColor: cloudMaterial.uniforms.tint.value.clone(),
      mountainColor: mountainTint.clone(),
      sunHeight: sun.position.y,
      sunPosition: sun.position.toArray(),
      moonPosition: moon.position.toArray(),
      moonStrength: moonMaterial.opacity
    };
  }
  let driftTime = 0,
    previousTime = null,
    // Seconds added to the cloud clock (setCloudClock: debug and comparisons).
    cloudOffset = 0;
  const cloud = cloudOptions(typeof location === 'undefined' ? undefined : location.search);
  function setCloudSeed(seed) {
    cloud.seed = Math.abs(Math.floor(Number(seed) || 0)) % 997;
    // Far apart in the noise plane, within its float precision.
    skyMaterial.uniforms.cloudSeed.value.set((cloud.seed % 31) * 37.3, Math.floor(cloud.seed / 31) * 41.9);
    weatherAt(cloudOffset + driftTime, cloud.seed, skyMaterial.uniforms.weather.value, cloud.fixed);
  }
  setCloudSeed(cloud.seed);
  // Shows the sky as it is at this cloud-clock time (seconds; with ?clouds=fixed only the motion changes).
  function setCloudClock(seconds) {
    cloudOffset = Math.max(0, Number(seconds) || 0) - driftTime;
    skyMaterial.uniforms.skyTime.value = cloudOffset + driftTime;
    weatherAt(cloudOffset + driftTime, cloud.seed, skyMaterial.uniforms.weather.value, cloud.fixed);
  }
  function update(now, enabled) {
    if (enabled && previousTime !== null) driftTime += Math.min(0.1, (now - previousTime) / 1000);
    previousTime = now;
    // The rays breathe a little and sway by a fraction of a degree (still when motion is off).
    rayPulse = enabled ? 0.92 + 0.08 * Math.sin(now / 2600) : 1;
    if (rays.visible)
      rays.quaternion
        .copy(sun.quaternion)
        .multiply(rayRoll.setFromAxisAngle(rayAxis, enabled ? 0.025 * Math.sin(now / 9000) : 0));
    if (dayRays.visible)
      dayRays.quaternion
        .copy(sun.quaternion)
        .multiply(rayRoll.setFromAxisAngle(rayAxis, enabled ? 0.02 * Math.sin(now / 11000 + 1.3) : 0));
    cloudMaterial.uniforms.drift.value = driftTime;
    skyMaterial.uniforms.skyTime.value = cloudOffset + driftTime;
    weatherAt(cloudOffset + driftTime, cloud.seed, skyMaterial.uniforms.weather.value, cloud.fixed);
    mountainVariant?.update(now);
  }
  // lighterRanges: the medium and low graphics' lighter mountains (mountains-b.mjs setDetail).
  // Ultra graphics: the aurora brighter and fuller (owner, 2026-10-31, «сияние»).
  function setUltra(enabled) {
    skyMaterial.uniforms.auroraGain.value = enabled ? 1.8 : 1;
  }
  function setEconomy(enabled, lighterRanges = enabled) {
    mountainVariant?.setDetail?.(lighterRanges);
    clouds.count = enabled ? 72 : 128 + MOUNTAIN_WISPS.length;
    skyMaterial.uniforms.auroraFull.value = enabled ? 0 : 1;
    skyMaterial.uniforms.skyDetail.value = enabled ? 0 : 1;
  }
  // 1 for the morning preset: the dawn sky features and morning mist in the mountain valleys. Kept out of
  // setLight, which the light fade replays with a fixed set of keys.
  function setDawn(level) {
    const dawn = Math.max(0, Math.min(1, level || 0));
    skyMaterial.uniforms.dawn.value = dawn;
    updateMist();
  }
  // 1 in winter: the snow line comes down the slopes.
  function updateMist() {
    const strength = cloudMaterial.uniforms.sunStrength.value;
    const low = 1 - Math.min(1, Math.abs(sun.position.y) / 120);
    const dawn = skyMaterial.uniforms.dawn.value;
    mountainVariant?.setMist?.(
      strength * low * 0.85 * (1 - 0.45 * dawn),
      cloudMaterial.uniforms.tint.value,
      dawn,
      cloudMaterial.uniforms.warm.value
    );
  }
  function setSnow(level) {
    snowShift.value = SNOW.winter * Math.max(0, Math.min(1, level));
    mountainVariant?.setSnow(level);
  }
  const audit = () => ({
    layers: RIDGE_LAYERS.length,
    sectors: RIDGE_SPECS.length,
    ridgePeaks,
    cloudInstances: clouds.count,
    bankCenters: cloudGroups.filter(g => g.bank).map(g => g.y),
    nearCenters: cloudGroups.filter(g => !g.bank && !g.high).map(g => g.y)
  });
  return {
    sky,
    skyMaterial,
    sun,
    rays,
    moon,
    clouds,
    setLight,
    getLight,
    // The sun's colour as last set (live, not a copy; the Ultra sun shafts read it every frame).
    sunColor: lightSunColor,
    update,
    setEconomy,
    setUltra,
    setSnow,
    setSeason,
    setDawn,
    setMoonPhase,
    mountainMaterials,
    cloudMaterial,
    setCloudSeed,
    setCloudClock,
    cloudState: () => ({
      seed: cloud.seed,
      fixed: cloud.fixed,
      clock: cloudOffset + driftTime,
      weather: skyMaterial.uniforms.weather.value.toArray()
    }),
    audit
  };
}
