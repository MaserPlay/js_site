import { parkMillerStream } from './seeded-random.mjs';
// Winter firs: a tapered trunk with a root flare, whorls of drooping photo-needle boughs on
// bark twigs, snow painted on the bough tops, and a spiral string of twinkling bulbs with a star.
// Built once in metres (instanced by the world); no textures of its own, randomness is seeded.

// The Mundo needle atlas holds one frond (stem at the bottom centre, tip up).
const ATLAS = 1024,
  FROND = { x0: 30, x1: 640, top: 10, bx: 318, by: 1004 };
// Linear-space snow, a touch brighter than the ground snow: bough tops catch the sky.
const SNOW_RGB = 'vec3(.8,.83,.9)';
// firSnow at or above this marks a card that holds snow on both faces (the amount is the rest).
const TWO_SIDED = 2;
// Crown shape, shares of the height / radius: whorls from `from` over `span`, the top whorl's boughs `tip` of
// the radius long (one continuous cone); a collar of upswept sprays and a short narrow leader finish the top.
export const CROWN = {
  from: 0.19,
  span: 0.73,
  tip: 0.08,
  collar: { at: 0.925, count: 5, length: 0.07, rise: 1.05 },
  leader: { from: 0.9, width: 0.5, snow: 0.8 }
};

export const SMALL_FIR = {
  height: 5.6,
  radius: 1.35,
  trunk: 0.13,
  whorls: 10,
  boughs: 7,
  seed: 7,
  lights: {
    count: 30,
    turns: 4.2,
    bulb: 0.085,
    cord: 0.011,
    from: 0.17,
    to: 0.86,
    star: 0.26,
    seed: 3,
    sides: [10, 5]
  }
};
// The grand New Year fir on the central island (decorated by xmas-tree.mjs). Its low boughs facing the
// portal are cut back to a vertical plane `prune.reach` metres out (the gate ring stands ~5.1 m away and
// 4.35 m tall); world.mjs passes the gate's bearing as prune.angle.
export const CENTRAL_FIR = {
  height: 19,
  radius: 4.5,
  trunk: 0.42,
  whorls: 18,
  boughs: 13,
  seed: 19,
  prune: { reach: 4.0, below: 6.9 },
  lights: {
    count: 132,
    turns: 6.2,
    bulb: 0.11,
    cord: 0.022,
    from: 0.16,
    to: 0.89,
    star: 0,
    seed: 5,
    sides: [8, 4]
  }
};
// Warm white dominates; the coloured bulbs read as a festive string, not a rainbow.
const BULB_COLOURS = [
  [1.25, 0.86, 0.46],
  [1.25, 0.86, 0.46],
  [1.3, 0.32, 0.26],
  [0.45, 1.15, 0.5],
  [0.45, 0.7, 1.35],
  [1.3, 1.02, 0.32]
];

class Attributes {
  constructor(names) {
    this.data = Object.fromEntries(names.map(([n]) => [n, []]));
    this.names = names;
    this.indices = [];
  }
  get count() {
    return this.data.position.length / 3;
  }
  vertex(values) {
    for (const [n] of this.names) this.data[n].push(...values[n]);
    return this.count - 1;
  }
  geometry(THREE) {
    const g = new THREE.BufferGeometry();
    for (const [n, size] of this.names)
      g.setAttribute(n, new THREE.Float32BufferAttribute(this.data[n], size));
    g.setIndex(this.indices);
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
}

/**
 * Fir in metres, root at y = 0. Returns needles (foliage attributes plus firSnow), trunk and
 * twigs (bark uv), the bough tips and the between-spray tips (ornament anchors) and the whorl heights.
 */
export function createFirModel(...args) {
  const steps = firModelSteps(...args);
  for (;;) {
    const step = steps.next();
    if (step.done) return step.value;
  }
}
// The same fir with a pause after each whorl: the garden is rebuilt in short steps (world.mjs, buildWorldSteps),
// and the central New Year fir alone took ~70 ms.
export function* firModelSteps(THREE, { height: H, radius: R, trunk: R0, whorls, boughs, seed, prune }) {
  const random = parkMillerStream(seed),
    up = new THREE.Vector3(0, 1, 0),
    needles = new Attributes([
      ['position', 3],
      ['normal', 3],
      ['uv', 2],
      ['color', 3],
      ['foliageSway', 1],
      ['firSnow', 1]
    ]),
    trunk = new Attributes([
      ['position', 3],
      ['normal', 3],
      ['uv', 2]
    ]),
    twigs = new Attributes([
      ['position', 3],
      ['normal', 3],
      ['uv', 2]
    ]),
    tips = [],
    sprays = [],
    tiers = [];
  // Taper to a thin leader, with a buttressed flare over the first ~6% of the height.
  const trunkRadius = (y, angle = 0) => {
    const u = THREE.MathUtils.clamp(y / (H * 0.97), 0, 1),
      flare = Math.exp(-Math.max(y, 0) / (0.055 * H)) * (1 + 0.3 * Math.cos(5 * angle + 0.7));
    return R0 * (0.1 + 0.9 * (1 - u) ** 1.15 + 0.85 * flare);
  };
  {
    const sides = 9,
      rings = [-0.25, 0, 0.012, 0.03, 0.07, 0.16, 0.34, 0.56, 0.78, 0.95].map((v, i) => (i ? v * H : v));
    for (let r = 0; r < rings.length; r++) {
      const y = rings[r],
        dy = 0.01 * H;
      let around = 0;
      for (let k = 0; k <= sides; k++) {
        const a = (k / sides) * Math.PI * 2,
          radius = trunkRadius(y, a),
          slope = (trunkRadius(y + dy, a) - trunkRadius(y - dy, a)) / (2 * dy);
        if (k) around += (2 * Math.PI * radius) / sides;
        const n = new THREE.Vector3(Math.sin(a), -slope, Math.cos(a)).normalize();
        trunk.vertex({
          position: [Math.sin(a) * radius, y, Math.cos(a) * radius],
          normal: n.toArray(),
          uv: [around / 0.9, y / 0.9]
        });
      }
      if (r)
        for (let k = 0; k < sides; k++) {
          const a = (r - 1) * (sides + 1) + k,
            b = a + 1,
            c = a + sides + 1,
            d = c + 1;
          trunk.indices.push(a, b, c, b, d, c);
        }
    }
  }
  const frondLength = FROND.by - FROND.top,
    columns = [FROND.x0, FROND.bx, FROND.x1],
    rows = [0, 0.34, 0.68, 1];
  // A bough: an arched frond card (ridge up, edges lower) that rises from the trunk and droops.
  const bough = (y, angle, length, rise, droop, width, snow, shade, sway) => {
    const dir = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle)),
      side = new THREE.Vector3().crossVectors(up, dir),
      root = dir
        .clone()
        .multiplyScalar(trunkRadius(y) * 0.4)
        .setY(y),
      roll = (random() - 0.5) * 0.18,
      first = needles.count,
      at = t =>
        root
          .clone()
          .addScaledVector(dir, t * length)
          .addScaledVector(up, length * (rise * t - droop * t * t));
    for (const t of rows) {
      const centre = at(t),
        pitch = rise - 2 * droop * t;
      for (const x of columns) {
        const across = ((x - FROND.bx) / frondLength) * width,
          p = centre
            .clone()
            .addScaledVector(side, across * length)
            .addScaledVector(up, length * (-0.42 * Math.abs(across) + roll * across));
        // Out of the canopy and up, leaning to the edge's side: light wraps over the arch.
        const n = up
          .clone()
          .multiplyScalar(0.95)
          .addScaledVector(dir, 0.45 - 0.5 * pitch)
          .addScaledVector(side, Math.sign(across) * 0.38)
          .normalize();
        const o = shade * (0.55 + 0.45 * t) * (0.92 + 0.12 * random());
        needles.vertex({
          position: p.toArray(),
          normal: n.toArray(),
          uv: [x / ATLAS, 1 - (FROND.by - frondLength * t) / ATLAS],
          color: [o, o * 1.03, o * 0.93],
          foliageSway: [sway * (0.15 + 0.85 * t)],
          firSnow: [snow * (t === 0 ? 0.25 : t === 1 ? 0.65 : 1) * (x === FROND.bx ? 1 : 0.6)]
        });
      }
    }
    // Wound so the front face looks up: snow sits on the front face only.
    for (let r = 0; r < rows.length - 1; r++)
      for (let c = 0; c < columns.length - 1; c++) {
        const a = first + r * columns.length + c,
          b = a + 1,
          d = a + columns.length,
          e = d + 1;
        needles.indices.push(a, d, b, b, d, e);
      }
    return { at, dir, side, end: at(1) };
  };
  // A thin bark twig under the frond's rachis, from inside the trunk to three quarters out.
  const twig = (path, dir, side, length, radius) => {
    const sides = 3,
      steps = [0, 0.38, 0.78],
      first = twigs.count;
    for (const t of steps) {
      const centre = path(t).addScaledVector(up, -radius * 0.6),
        r = radius * (1 - 0.72 * t);
      for (let k = 0; k <= sides; k++) {
        const a = (k / sides) * Math.PI * 2,
          n = up.clone().multiplyScalar(Math.cos(a)).addScaledVector(side, Math.sin(a));
        twigs.vertex({
          position: centre.clone().addScaledVector(n, r).toArray(),
          normal: n.toArray(),
          uv: [(k / sides) * 0.2, (t * length) / 0.9]
        });
      }
    }
    for (let s = 0; s < steps.length - 1; s++)
      for (let k = 0; k < sides; k++) {
        const a = first + s * (sides + 1) + k,
          b = a + 1,
          c = a + sides + 1,
          d = c + 1;
        twigs.indices.push(a, c, b, b, c, d);
      }
    return dir;
  };
  for (let k = 0; k < whorls; k++) {
    const u = k / (whorls - 1),
      y = H * (CROWN.from + CROWN.span * u) + (random() - 0.5) * 0.02 * H,
      length = R * (CROWN.tip + (1.1 - CROWN.tip) * (1 - u) ** 0.92),
      rise = -0.05 + 0.48 * u,
      droop = 0.3 - 0.17 * u,
      shade = 0.84 + 0.16 * u,
      offset = k * 2.4,
      spacing = (CROWN.span * H) / (whorls - 1);
    tiers.push(y);
    for (let j = 0; j < boughs; j++) {
      const angle = offset + (j / boughs) * Math.PI * 2 + (random() - 0.5) * 0.35;
      let reach = length * (0.88 + 0.22 * random());
      if (prune?.angle !== undefined && y < prune.below) {
        // Shorter low boughs on the gate side keep the portal ring clear: the tip and the frond's side edge
        // (about a third of the reach across) stay behind a plane prune.reach out towards the gate.
        const facing = Math.cos(angle - prune.angle),
          lean = facing + 0.33 * Math.abs(Math.sin(angle - prune.angle));
        if (facing > -0.2 && lean > 0.05)
          reach = Math.min(
            reach,
            Math.max((prune.reach - trunkRadius(y) * 0.4 * Math.max(facing, 0)) / lean, 0.35 * length)
          );
      }
      const main = bough(y, angle, reach, rise, droop, 1, 1, shade, 1);
      tips.push({ position: main.end.toArray(), whorl: k, bough: j });
      if (u < 0.65) twig(main.at, main.dir, main.side, reach, Math.max(0.014, 0.03 * reach));
      // A shorter spray between boughs and a little higher: layered, no radial spokes.
      const spray = bough(
        y + 0.022 * H,
        angle + Math.PI / boughs,
        reach * 0.68,
        rise + 0.1,
        droop * 0.85,
        0.85,
        0.85,
        shade * 0.94,
        0.8
      );
      sprays.push({ position: spray.end.toArray(), whorl: k, bough: j });
      // An inner upturned spray halfway to the next whorl hides the bare trunk between tiers.
      bough(
        y + 0.5 * spacing,
        angle + 0.5 * (Math.PI / boughs),
        reach * 0.55,
        0.75,
        0.15,
        0.8,
        0.5,
        shade * 0.8,
        0.5
      );
    }
    yield;
  }
  // A collar of short upswept sprays round the leader continues the cone above the top whorl.
  for (let j = 0; j < CROWN.collar.count; j++)
    bough(
      H * CROWN.collar.at,
      j * ((Math.PI * 2) / CROWN.collar.count) + 0.4,
      R * CROWN.collar.length,
      CROWN.collar.rise,
      0.2,
      0.85,
      1,
      1,
      0.6
    );
  // Leader: two crossed narrow upright fronds over the collar, short so the crown tapers into it instead of
  // a second little tree standing on top. Snow on both faces (firSnow above 1, see addNeedleSnow): seen from
  // above, half of a vertical card is its back face.
  for (const turn of [0, Math.PI / 2]) {
    const first = needles.count,
      base = H * CROWN.leader.from,
      length = H * (1 - CROWN.leader.from),
      dir = new THREE.Vector3(Math.sin(turn), 0, Math.cos(turn)),
      face = new THREE.Vector3().crossVectors(dir, up);
    for (const t of [0, 0.5, 1])
      for (const x of [FROND.x0, FROND.x1]) {
        const across = ((x - FROND.bx) / frondLength) * CROWN.leader.width * length;
        needles.vertex({
          position: dir
            .clone()
            .multiplyScalar(across)
            .setY(base + t * length)
            .toArray(),
          normal: face.clone().multiplyScalar(0.6).addScaledVector(up, 0.8).normalize().toArray(),
          uv: [x / ATLAS, 1 - (FROND.by - frondLength * t) / ATLAS],
          color: [1, 1.03, 0.93],
          foliageSway: [0.3 * t],
          firSnow: [TWO_SIDED + CROWN.leader.snow]
        });
      }
    for (let r = 0; r < 2; r++) {
      const a = first + r * 2;
      needles.indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  return {
    needles: needles.geometry(THREE),
    trunk: trunk.geometry(THREE),
    twigs: twigs.geometry(THREE),
    tips,
    sprays,
    tiers,
    height: H,
    radius: R,
    trunkRadius
  };
}

function starGeometry(THREE, outer) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5,
      r = i % 2 ? outer * 0.42 : outer;
    i ? shape.lineTo(Math.sin(a) * r, Math.cos(a) * r) : shape.moveTo(Math.sin(a) * r, Math.cos(a) * r);
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: outer * 0.18, bevelEnabled: false });
  g.translate(0, 0, -outer * 0.09);
  return g;
}

/**
 * A spiral light string resting on the needles: bulbs are placed where a ray from outside first
 * meets the foliage, the cord runs just behind them. Bulbs carry colour and a twinkle phase.
 */
export function createFirLights(THREE, model, spec) {
  const steps = firLightSteps(THREE, model, spec);
  for (;;) {
    const step = steps.next();
    if (step.done) return step.value;
  }
}
// The same in steps for the garden's sliced build: the rays against the central fir's needles took ~40 ms in one
// piece (round 21), so it pauses after every LIGHT_RAYS of them.
const LIGHT_RAYS = 12;
export function* firLightSteps(
  THREE,
  model,
  { count, turns, bulb, cord, from, to, star, seed, sides = [8, 5] }
) {
  const random = parkMillerStream(seed),
    probe = new THREE.Mesh(model.needles, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })),
    ray = new THREE.Raycaster(),
    H = model.height,
    points = [],
    sphere = new THREE.SphereGeometry(1, ...sides),
    positions = [],
    normals = [],
    colors = [],
    phases = [],
    indices = [];
  probe.updateMatrixWorld(true);
  for (let i = 0; i < count; i++) {
    const s = i / (count - 1),
      y = H * (to - (to - from) * s),
      angle = turns * Math.PI * 2 * s + 0.4,
      outward = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle)),
      // Expected crown radius at this height; the bulb never sinks deep into a gap.
      envelope = model.radius * Math.min(1, ((1 - y / H) / (1 - from)) * 1.05),
      origin = outward
        .clone()
        .multiplyScalar(model.radius * 1.6)
        .setY(y);
    ray.set(origin, outward.clone().negate());
    ray.far = model.radius * 1.6;
    const hit = ray.intersectObject(probe, false)[0],
      radial = Math.max(hit ? Math.hypot(hit.point.x, hit.point.z) : envelope * 0.85, envelope * 0.55);
    points.push(outward.multiplyScalar(radial + bulb * 0.5).setY(y));
    if (i % LIGHT_RAYS === LIGHT_RAYS - 1) yield;
  }
  const colourAt = i => BULB_COLOURS[(i * 5 + Math.floor(random() * 2)) % BULB_COLOURS.length];
  points.forEach((p, i) => {
    const first = positions.length / 3,
      colour = colourAt(i),
      phase = random();
    for (let k = 0; k < sphere.attributes.position.count; k++) {
      const n = new THREE.Vector3().fromBufferAttribute(sphere.attributes.normal, k);
      positions.push(p.x + n.x * bulb, p.y + n.y * bulb * 1.15, p.z + n.z * bulb);
      normals.push(n.x, n.y, n.z);
      colors.push(...colour);
      phases.push(phase);
    }
    for (const index of sphere.index.array) indices.push(first + index);
  });
  sphere.dispose();
  probe.material.dispose();
  const bulbs = new THREE.BufferGeometry();
  bulbs.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  bulbs.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  bulbs.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  bulbs.setAttribute('twinkle', new THREE.Float32BufferAttribute(phases, 1));
  bulbs.setIndex(indices);
  bulbs.computeBoundingBox();
  bulbs.computeBoundingSphere();
  // The cord sags a little between bulbs and passes just behind each one.
  const path = [];
  points.forEach((p, i) => {
    const behind = p.clone().setY(0).normalize();
    path.push(p.clone().addScaledVector(behind, -bulb * 0.55));
    if (i < points.length - 1) {
      const mid = p.clone().lerp(points[i + 1], 0.5);
      mid.y -= bulb * 0.9;
      path.push(mid.addScaledVector(mid.clone().setY(0).normalize(), -bulb * 0.4));
    }
  });
  const cordGeometry = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(path),
    Math.ceil(path.length * 1.5),
    cord,
    3
  );
  let starMesh = null;
  if (star) {
    const a = starGeometry(THREE, star),
      b = a.clone().rotateY(Math.PI / 2);
    a.translate(0, H + star * 0.75, 0);
    b.translate(0, H + star * 0.75, 0);
    const position = [],
      normal = [];
    for (const g of [a, b]) {
      const n = g.index ? g.toNonIndexed() : g;
      position.push(...n.attributes.position.array);
      normal.push(...n.attributes.normal.array);
      if (n !== g) n.dispose();
      g.dispose();
    }
    starMesh = new THREE.BufferGeometry();
    starMesh.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
    starMesh.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
    starMesh.computeBoundingBox();
    starMesh.computeBoundingSphere();
  }
  return { bulbs, cord: cordGeometry, star: starMesh, points, bulbRadius: bulb };
}

/** Unlit bulbs: a hot core, softer rim and a slow per-bulb twinkle driven by the shared clock. */
export function createTwinkleMaterial(THREE, time) {
  const material = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    uniforms = { twinkleTime: time, twinkleGain: { value: 1 } };
  material.name = 'fir bulbs';
  material.userData.twinkle = uniforms;
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute float twinkle;\nuniform float twinkleTime;\nvarying float vTwinkle;\nvarying float vFacing;'
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
          {
            vec3 bulbNormal=normal;
          #ifdef USE_INSTANCING
            bulbNormal=mat3(instanceMatrix)*bulbNormal;
          #endif
            vec3 bulbView=normalize(normalMatrix*bulbNormal);
            vFacing=abs(dot(bulbView,normalize(-mvPosition.xyz+vec3(0.,0.,1e-4))));
            vec4 bulbWorld=vec4(transformed,1.);
          #ifdef USE_INSTANCING
            bulbWorld=instanceMatrix*bulbWorld;
          #endif
            bulbWorld=modelMatrix*bulbWorld;
            // Slow waves of brightness roll up the tree; each bulb adds a faint flicker and a rare glint.
            float bulbWave=.5+.5*sin(twinkleTime*.85-bulbWorld.y*.42+twinkle*2.2);
            vTwinkle=.62+.38*bulbWave+.1*sin(twinkleTime*(1.2+twinkle*1.6)+twinkle*40.)+.28*
                smoothstep(.95,1.,sin(twinkleTime*.6+twinkle*23.));
          }`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float twinkleGain;\nvarying float vTwinkle;\nvarying float vFacing;'
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
      diffuseColor.rgb*=vTwinkle*twinkleGain*(.6+.55*vFacing);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.3,1.2,1.),.4*smoothstep(.75,1.,vFacing));`
      );
  };
  material.customProgramCacheKey = () => 'garden-fir-twinkle-v2';
  return material;
}

/** Snow on fir bough tops: the firSnow attribute (0 on every other needle card) gates it. */
export function addNeedleSnow(material, snow) {
  const previous = material.onBeforeCompile.bind(material),
    key = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer);
    shader.uniforms.gardenSnow = snow;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float firSnow;\nvarying float vFirSnow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFirSnow=firSnow;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float gardenSnow;\nvarying float vFirSnow;')
      .replace(
        '#include <alphamap_fragment>',
        `#ifdef USE_MAP
      {float snowGrain=.5+.5*sin(vMapUv.x*173.+2.*sin(vMapUv.y*97.))*sin(vMapUv.y*211.+vMapUv.x*31.);
      float snowBoth=step(${(TWO_SIDED - 0.5).toFixed(1)},vFirSnow),snowAmount=vFirSnow-${TWO_SIDED.toFixed(1)}*snowBoth;
      float snowCover=gardenSnow*smoothstep(.42,.95,.75*snowAmount+.35*snowGrain)*(gl_FrontFacing?.88:mix(.12,.8,snowBoth));
      diffuseColor.rgb=mix(diffuseColor.rgb,${SNOW_RGB},clamp(snowCover,0.,.93));
      // Snow clumps bridge the gaps between needles.
      diffuseColor.a=mix(diffuseColor.a,1.,.45*snowCover*step(.08,diffuseColor.a));}
      #endif
      #include <alphamap_fragment>`
      );
  };
  material.customProgramCacheKey = () => key + '-needle-snow-v2';
  return material;
}

/** Snow on the upper side of limbs, twigs and root flares (world-space normal, bark grain). */
export function addBarkSnow(material, snow) {
  const previous = material.onBeforeCompile.bind(material),
    key = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer);
    shader.uniforms.gardenSnow = snow;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float gardenSnow;')
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
      {vec3 snowUp=inverseTransformDirection(normal,viewMatrix);
      float snowGrain=.5;
      #ifdef USE_MAP
        snowGrain=.5+.5*sin(vMapUv.x*23.+3.*sin(vMapUv.y*11.));
      #endif
      float snowCover=gardenSnow*smoothstep(.4,.78,snowUp.y+.16*(snowGrain-.5));
      diffuseColor.rgb=mix(diffuseColor.rgb,${SNOW_RGB},snowCover*.95);}`
      );
  };
  material.customProgramCacheKey = () => key + '-bark-snow-v1';
  return material;
}

/** firSnow for other needle cards from their normals: upward cards hold up to `amount`. */
export function snowFromNormals(THREE, geometry, amount) {
  const n = geometry.attributes.normal,
    snow = new Float32Array(n.count);
  for (let i = 0; i < n.count; i++) snow[i] = THREE.MathUtils.clamp((n.getY(i) - 0.35) * 1.6, 0, 1) * amount;
  geometry.setAttribute('firSnow', new THREE.BufferAttribute(snow, 1));
  return geometry;
}
