import { parkMillerStream } from './seeded-random.mjs';
// The New Year dressing of the central winter fir (winter-firs.mjs builds the tree): extra light strings
// and draped swags, hanging ornaments (baubles, drops, stars, snowflakes, candy canes, bells, cones), a
// satin ribbon and tinsel swags, a snow skirt with a pile of gifts, a faceted star topper and its rays.
// Everything is merged once into a few geometries (tree metres, root at y = 0): one draw per material.
// Shader code avoids pow/log/sqrt, so nothing can turn into NaN.

const TAU = Math.PI * 2;

export const XMAS = {
  // Tree root on the central island (world metres; the lawn is at y = 0.2, the snow on it near 0.28).
  at: { x: -0.8, z: -2.15 },
  snowTop: 0.08,
  // Below this height nothing on the gate side reaches past a vertical plane this far out (the boughs there
  // are pruned to ~4 m; the portal ring stands 5.1 m from the trunk).
  gateClear: { reach: 4.2, below: 7 },
  seed: 41,
  // A second, warm-gold string that chases (phases follow the string), wound half a turn from the first.
  strings: [{ count: 84, turns: 5.2, from: 0.13, to: 0.85, phase: 3.5, bulb: 0.13, colours: 'gold' }],
  // Bulb swags draped between bough tips of one whorl, each swag spanning `span` boughs.
  swags: [
    { whorl: 2, span: 2, step: 0.5, sag: 0.17, bulb: 0.1, colours: 'red' },
    { whorl: 7, span: 2, step: 0.5, sag: 0.17, bulb: 0.1, colours: 'ice' },
    { whorl: 12, span: 2, step: 0.48, sag: 0.16, bulb: 0.095, colours: 'multi' }
  ],
  // Tinsel swags (two crossed twisted strips that glitter) on the whorls between the bulb swags.
  tinsel: [
    { whorl: 4, span: 2, sag: 0.2, width: 0.13, colour: 'silver' },
    { whorl: 9, span: 2, sag: 0.2, width: 0.12, colour: 'gold' },
    { whorl: 14, span: 2, sag: 0.18, width: 0.1, colour: 'silver' }
  ],
  ribbon: { turns: 3.1, from: 0.13, to: 0.83, phase: 1.6, width: 0.2, segments: 128, lift: 0.02 },
  // Ornaments hang from the main bough tips (whorl >= from, below the top `top` whorls) and from every
  // second between-spray tip; `empty` of the anchors stay bare.
  ornaments: { from: 1, top: 2, empty: 0.16, sprays: 3 },
  // Gifts on the snow skirt; inside the gate sector (spread radians either side) they stay within reach.
  gifts: { count: 15, stacked: 5, inner: 1.15, outer: 2.85, gate: { reach: 2.2, spread: 0.8 } },
  skirt: { radii: [0.7, 1.2, 1.75, 2.3, 2.75], heights: [0.3, 0.25, 0.16, 0.07, -0.04], segments: 24 },
  // lift: the lower points rest on the leader tip (the crown ends at the tree height).
  star: { outer: 1.05, depth: 0.34, lift: 0.82, rays: 7.5, style: 'gold' },
  glow: { size: 15, day: 0, night: 0.5, lift: 0.1 }
};

// Linear emissive bulb colours (above 1: they bloom). The pavilion and bridge garlands reuse them.
export const BULBS = {
  gold: [
    [1.4, 0.95, 0.42],
    [1.35, 0.8, 0.3]
  ],
  red: [
    [1.5, 0.2, 0.14],
    [1.35, 0.32, 0.2]
  ],
  ice: [
    [0.55, 0.85, 1.5],
    [0.85, 1, 1.45]
  ],
  multi: [
    [1.45, 0.22, 0.18],
    [0.4, 1.25, 0.45],
    [0.45, 0.7, 1.5],
    [1.4, 1.05, 0.3],
    [1.3, 0.35, 1.2]
  ]
};
// Glass, satin and metal ornament colours (sRGB hex); each kind draws from its own set.
const BAUBLES = [
  0xc0142b, 0x9a0f22, 0xd9a520, 0xe8c97a, 0xc9ced6, 0x1f4fbf, 0x8fc3ea, 0x127a45, 0x7a3fb8, 0xc2185b,
  0xf2f2f2, 0xb8642e
];
const WRAPS = [0xb3122a, 0x13653c, 0x1d4aa8, 0xd8a72a, 0xf0ece4, 0x6a3aa8, 0x0f7f80, 0xc23b6b];
const BANDS = [0xe8c45a, 0xf4f1ea, 0xb5121f, 0xc9ced6];
const STAR_COLOURS = {
  gold: { base: [1.25, 0.72, 0.16], core: [1.9, 1.55, 0.85] },
  // A Kremlin-style ruby star: deep red faces, hot rose core.
  red: { base: [1.3, 0.08, 0.06], core: [1.9, 0.75, 0.55] }
};
// Finish per vertex: gloss (fake sky reflection), glitter, snow dust on top faces, self-glow.
const FINISH = {
  glass: [1, 0.15, 0.55, 0],
  glitter: [0.45, 1, 0.55, 0],
  metal: [0.9, 0.35, 0.4, 0],
  matte: [0.1, 0, 0.9, 0],
  satin: [0.55, 0.1, 0.5, 0],
  tinsel: [0.9, 1, 0.2, 0.08],
  paper: [0.3, 0.05, 0.85, 0],
  snow: [0, 0.35, 1, 0]
};

// Ornament kinds by cumulative share of the anchors (the rest of the roll range).
const ORNAMENT_MIX = [
  ['ball', 0.5],
  ['drop', 0.58],
  ['star', 0.66],
  ['flake', 0.74],
  ['cane', 0.82],
  ['bell', 0.91],
  ['cone', 1.01]
];

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/**
 * Outer surface of the needles: the largest radius of the needle cards per angle bin and height row (from
 * samples over every card triangle), plus a smoothed outer skin that bridges the gaps between boughs.
 */
export function crownSurface(model, { bins = 64, step = 0.25 } = {}) {
  const p = model.needles.attributes.position,
    index = model.needles.index.array,
    rows = Math.ceil(model.height / step) + 2,
    cells = new Float32Array(bins * rows),
    weights = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
      [1 / 3, 1 / 3, 1 / 3],
      [0.5, 0.5, 0],
      [0, 0.5, 0.5],
      [0.5, 0, 0.5]
    ];
  const binOf = a => (((Math.round((a / TAU) * bins) % bins) + bins) % bins) | 0,
    rowOf = y => clamp(Math.round(y / step), 0, rows - 1);
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t],
      b = index[t + 1],
      c = index[t + 2];
    for (const [u, v, w] of weights) {
      const x = u * p.getX(a) + v * p.getX(b) + w * p.getX(c),
        y = u * p.getY(a) + v * p.getY(b) + w * p.getY(c),
        z = u * p.getZ(a) + v * p.getZ(b) + w * p.getZ(c),
        cell = rowOf(y) * bins + binOf(Math.atan2(x, z)),
        r = Math.hypot(x, z);
      if (r > cells[cell]) cells[cell] = r;
    }
  }
  const skin = new Float32Array(cells.length);
  for (let row = 0; row < rows; row++)
    for (let bin = 0; bin < bins; bin++) {
      let m = 0;
      for (let dr = -1; dr <= 1; dr++)
        for (let db = -2; db <= 2; db++) {
          const r2 = row + dr;
          if (r2 < 0 || r2 >= rows) continue;
          m = Math.max(m, cells[r2 * bins + ((bin + db + bins) % bins)]);
        }
      skin[row * bins + bin] = m;
    }
  const look = table => (angle, y) => table[rowOf(y) * bins + binOf(angle)];
  const surface = look(cells),
    outer = look(skin);
  return {
    // Real foliage radius here; an empty cell (a gap) falls back to most of the skin.
    at: (angle, y) => Math.max(surface(angle, y), outer(angle, y) * 0.78),
    outer
  };
}

// Mesh accumulator: position, normal, colour and finish; sources are transformed by a Matrix4.
class Mesher {
  constructor(THREE, extra = 'finish') {
    this.THREE = THREE;
    this.extra = extra;
    this.position = [];
    this.normal = [];
    this.color = [];
    this.data = [];
    this.index = [];
  }
  get count() {
    return this.position.length / 3;
  }
  add(source, matrix, colour, data) {
    const { THREE } = this,
      p = source.attributes.position,
      n = source.attributes.normal,
      first = this.count,
      normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix),
      v = new THREE.Vector3(),
      w = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(matrix);
      w.fromBufferAttribute(n, i).applyMatrix3(normalMatrix).normalize();
      const c = typeof colour === 'function' ? colour(i, p) : colour;
      this.position.push(v.x, v.y, v.z);
      this.normal.push(w.x, w.y, w.z);
      this.color.push(c[0], c[1], c[2]);
      this.data.push(...(typeof data === 'function' ? data(i) : data));
    }
    if (source.index) for (const k of source.index.array) this.index.push(first + k);
    else for (let i = 0; i < p.count; i++) this.index.push(first + i);
  }
  vertex(position, normal, colour, data) {
    this.position.push(position.x, position.y, position.z);
    this.normal.push(normal.x, normal.y, normal.z);
    this.color.push(colour[0], colour[1], colour[2]);
    this.data.push(...data);
    return this.count - 1;
  }
  geometry(size) {
    const { THREE } = this,
      g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.position, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.normal, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.color, 3));
    g.setAttribute(this.extra, new THREE.Float32BufferAttribute(this.data, size));
    g.setIndex(this.index);
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
}

/** Concatenates geometries that share their attribute layout (indexed). */
export function joinGeometries(THREE, list) {
  const names = Object.keys(list[0].attributes),
    out = new THREE.BufferGeometry(),
    index = [];
  let offset = 0;
  for (const name of names) {
    const size = list[0].attributes[name].itemSize,
      values = [];
    for (const g of list) values.push(...g.attributes[name].array);
    out.setAttribute(name, new THREE.Float32BufferAttribute(values, size));
  }
  for (const g of list) {
    for (const k of g.index.array) index.push(offset + k);
    offset += g.attributes.position.count;
  }
  out.setIndex(index);
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

// Round bulbs (slightly tall) with colour and twinkle phase, like the fir's own string.
function bulbString(THREE, mesher, points, { bulb, sides, colours, phase }) {
  const sphere = new THREE.SphereGeometry(1, ...sides),
    m = new THREE.Matrix4();
  points.forEach((p, i) => {
    m.makeScale(bulb, bulb * 1.15, bulb).setPosition(p);
    mesher.add(sphere, m, colours(i), [phase(i)]);
  });
  sphere.dispose();
}

// A cord that passes just behind each bulb and sags a little between them.
function cordThrough(THREE, points, bulb, radius, ends = []) {
  const path = [];
  const inward = (p, k) => p.clone().addScaledVector(p.clone().setY(0).normalize(), -k);
  if (ends[0]) path.push(ends[0].clone());
  points.forEach((p, i) => {
    path.push(inward(p, bulb * 0.55));
    if (i < points.length - 1) {
      const mid = p.clone().lerp(points[i + 1], 0.5);
      mid.y -= bulb * 0.9;
      path.push(inward(mid, bulb * 0.4));
    }
  });
  if (ends[1]) path.push(ends[1].clone());
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path), path.length, radius, 3);
}

// Swag curves between bough tips of one whorl: angle, radius and height along each hanging arc.
function swagArcs(model, whorl, span, sag) {
  const tier = model.tips
      .filter(t => t.whorl === whorl)
      .map(t => {
        const [x, y, z] = t.position;
        return { a: Math.atan2(x, z), r: Math.hypot(x, z), y };
      })
      .sort((p, q) => p.a - q.a),
    count = Math.max(2, Math.round(tier.length / span)),
    arcs = [];
  for (let j = 0; j < count; j++) {
    const A = tier[Math.round((j * tier.length) / count) % tier.length],
      B = tier[Math.round(((j + 1) * tier.length) / count) % tier.length];
    let turn = B.a - A.a;
    if (turn <= 0) turn += TAU;
    const length = turn * (A.r + B.r) * 0.5;
    arcs.push({
      length,
      at: s => ({
        a: A.a + turn * s,
        r: A.r + (B.r - A.r) * s + 0.12 * Math.sin(Math.PI * s),
        y: A.y + (B.y - A.y) * s - sag * length * Math.sin(Math.PI * s)
      }),
      ends: [A, B]
    });
  }
  return arcs;
}

const polar = (THREE, a, r, y) => new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r);

// Unit shapes for the hanging ornaments (each hangs from its top at y = 0, pointing down).
function ornamentShapes(THREE) {
  const lathe = (profile, segments) => {
    const g = new THREE.LatheGeometry(
      profile.map(([r, y]) => new THREE.Vector2(r, y)),
      segments
    );
    g.computeVertexNormals();
    return g;
  };
  // Puffy five-point star: a rim of ten points and a raised centre on each face (flat facets glint).
  const puffy = (outer, inner, depth) => {
    const positions = [];
    const rim = Array.from({ length: 10 }, (_, i) => {
      const a = (i * Math.PI) / 5,
        r = i % 2 ? inner : outer;
      return [Math.sin(a) * r, Math.cos(a) * r, 0];
    });
    for (const side of [1, -1])
      for (let i = 0; i < 10; i++) {
        const a = rim[i],
          b = rim[(i + 1) % 10];
        positions.push(0, 0, side * depth, ...(side > 0 ? [...b, ...a] : [...a, ...b]));
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.computeVertexNormals();
    return g;
  };
  // Snowflake: six flat arms with two side twigs each, both faces (thin, so no edges are needed).
  const flake = () => {
    const positions = [],
      bar = (x0, y0, x1, y1, w) => {
        const dx = x1 - x0,
          dy = y1 - y0,
          l = Math.hypot(dx, dy) || 1,
          nx = (-dy / l) * w,
          ny = (dx / l) * w,
          q = [
            [x0 + nx, y0 + ny],
            [x1 + nx, y1 + ny],
            [x1 - nx, y1 - ny],
            [x0 - nx, y0 - ny]
          ];
        for (const z of [0.012, -0.012]) {
          const order = z > 0 ? [0, 3, 1, 1, 3, 2] : [0, 1, 3, 1, 2, 3];
          for (const k of order) positions.push(q[k][0], q[k][1], z);
        }
      };
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3,
        dx = Math.sin(a),
        dy = Math.cos(a);
      bar(0, 0, dx, dy, 0.06);
      for (const turn of [0.55, -0.55]) {
        const bx = dx * 0.55,
          by = dy * 0.55,
          tx = Math.sin(a + turn) * 0.32,
          ty = Math.cos(a + turn) * 0.32;
        bar(bx, by, bx + tx, by + ty, 0.04);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.computeVertexNormals();
    return g;
  };
  // Candy cane: a shaft with a hook at the top (hung by the hook, so the shaft points down).
  const caneCurve = new THREE.CatmullRomCurve3(
    [
      [0.32, -0.12],
      [0.3, 0.06],
      [0.16, 0.16],
      [0, 0.06],
      [-0.02, -0.3],
      [-0.02, -1]
    ].map(([x, y]) => new THREE.Vector3(x, y, 0))
  );
  return {
    ball: new THREE.SphereGeometry(1, 8, 5),
    cap: new THREE.CylinderGeometry(0.27, 0.31, 0.24, 6, 1, true),
    thread: new THREE.CylinderGeometry(1, 1, 1, 3, 1, true).translate(0, -0.5, 0),
    drop: lathe(
      [
        [0, -1.55],
        [0.3, -1.05],
        [0.72, -0.35],
        [0.85, 0.15],
        [0.6, 0.62],
        [0.22, 0.86],
        [0, 0.9]
      ],
      8
    ),
    star: puffy(1, 0.45, 0.22),
    flake: flake(),
    cane: new THREE.TubeGeometry(caneCurve, 11, 0.055, 4, false),
    bell: lathe(
      [
        [0.64, -1],
        [0.56, -0.92],
        [0.42, -0.62],
        [0.33, -0.25],
        [0.2, 0],
        [0, 0.04]
      ],
      8
    ),
    cone: lathe(
      [
        [0, -1],
        [0.3, -0.78],
        [0.24, -0.6],
        [0.42, -0.42],
        [0.32, -0.22],
        [0.44, -0.04],
        [0.3, 0.12],
        [0, 0.18]
      ],
      6
    ),
    box: new THREE.BoxGeometry(1, 1, 1),
    loop: new THREE.TorusGeometry(0.5, 0.17, 3, 6, Math.PI * 1.55)
  };
}

/** The faceted star topper with baked shading in its vertex colours (an unlit, blooming material). */
export function createTopStar(THREE, { outer, depth, style = 'gold' }) {
  const rim = Array.from({ length: 10 }, (_, i) => {
      const a = (i * Math.PI) / 5,
        r = i % 2 ? outer * 0.42 : outer;
      return new THREE.Vector3(Math.sin(a) * r, Math.cos(a) * r, 0);
    }),
    { base, core } = STAR_COLOURS[style] || STAR_COLOURS.gold,
    light = new THREE.Vector3(0.35, 0.75, 0.55).normalize(),
    positions = [],
    colours = [],
    normals = [];
  for (const side of [1, -1]) {
    const tip = new THREE.Vector3(0, 0, side * depth);
    for (let i = 0; i < 10; i++) {
      const a = rim[i],
        b = rim[(i + 1) % 10],
        tri = side > 0 ? [tip, b, a] : [tip, a, b],
        n = new THREE.Vector3()
          .subVectors(tri[1], tri[0])
          .cross(new THREE.Vector3().subVectors(tri[2], tri[0]))
          .normalize(),
        shade = 0.55 + 0.7 * Math.max(0, n.dot(light)) + 0.25 * (i % 2);
      tri.forEach((p, k) => {
        positions.push(p.x, p.y, p.z);
        normals.push(n.x, n.y, n.z);
        const c = k === 0 ? core : base;
        colours.push(c[0] * shade, c[1] * shade, c[2] * shade);
      });
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

/** Snow mound height under the tree at distance r from the trunk (tree metres above the root). */
export function skirtHeight(r) {
  const { radii, heights } = XMAS.skirt;
  if (r <= radii[0]) return heights[0];
  for (let i = 1; i < radii.length; i++)
    if (r <= radii[i]) {
      const t = (r - radii[i - 1]) / (radii[i] - radii[i - 1]);
      return heights[i - 1] + (heights[i] - heights[i - 1]) * t;
    }
  return heights.at(-1);
}

/**
 * Dresses a fir model: returns bulbs (the fir's own string first, `economyIndex` indices long, then the
 * extra strings and swags), cord, ornaments (with gifts, ribbon, tinsel and the snow skirt; attribute
 * `finish`), the star topper and its height, and audit lists (hangers, gifts, swag bulbs).
 * gate: bearing (radians, atan2(x, z) from the trunk) of the portal, kept clear of gifts.
 */
export function createXmasDecor(...args) {
  const steps = xmasDecorSteps(...args);
  for (;;) {
    const step = steps.next();
    if (step.done) return step.value;
  }
}
// The same dressing with pauses between the strings, swags, hangers, tinsel and gifts: the garden is rebuilt in
// short steps (world.mjs, buildWorldSteps), and this alone took ~70 ms.
export function* xmasDecorSteps(THREE, model, lights, { gate, spec = XMAS } = {}) {
  const random = parkMillerStream(spec.seed),
    H = model.height,
    crown = crownSurface(model),
    colour = hex => new THREE.Color(hex).toArray(),
    m = new THREE.Matrix4(),
    q = new THREE.Quaternion(),
    e = new THREE.Euler(),
    up = new THREE.Vector3(0, 1, 0),
    bulbs = new Mesher(THREE, 'twinkle'),
    cords = [lights.cord],
    deco = new Mesher(THREE),
    shapes = ornamentShapes(THREE),
    hangers = [],
    swagBulbs = [];
  const place = (position, rotationY, scale, tilt = 0) =>
    m.compose(position, q.setFromEuler(e.set(tilt, rotationY, 0)), scale);
  const S = (x, y = x, z = x) => new THREE.Vector3(x, y, z);
  const cap = (a, y, r) => {
    const facing = gate === undefined || y >= spec.gateClear.below ? 0 : Math.cos(a - gate);
    return facing > 0.05 ? Math.min(r, spec.gateClear.reach / facing) : r;
  };

  // ---------- extra light strings and bulb swags ----------
  for (const string of spec.strings) {
    const points = [],
      set = BULBS[string.colours];
    for (let i = 0; i < string.count; i++) {
      const s = i / (string.count - 1),
        y = H * (string.to - (string.to - string.from) * s),
        a = string.turns * TAU * s + string.phase,
        r = cap(a, y, Math.max(crown.at(a, y), crown.outer(a, y) * 0.85));
      points.push(polar(THREE, a, r + string.bulb * 0.5, y));
    }
    bulbString(THREE, bulbs, points, {
      bulb: string.bulb,
      sides: [5, 4],
      colours: i => set[i % set.length],
      phase: i => (i / string.count) * 6
    });
    cords.push(cordThrough(THREE, points, string.bulb, 0.02));
  }
  yield;
  for (const swag of spec.swags) {
    const set = BULBS[swag.colours];
    for (const arc of swagArcs(model, swag.whorl, swag.span, swag.sag)) {
      const n = Math.max(3, Math.round(arc.length / swag.step)),
        points = [];
      for (let k = 1; k < n; k++) {
        const s = k / n,
          { a, r, y } = arc.at(s),
          rest = cap(a, y, Math.max(r, crown.at(a, y) + swag.bulb * 0.7));
        points.push(polar(THREE, a, rest, y - swag.bulb * 1.1));
      }
      const first = swagBulbs.length;
      swagBulbs.push(...points);
      bulbString(THREE, bulbs, points, {
        bulb: swag.bulb,
        sides: [5, 4],
        colours: i => set[(first + i) % set.length],
        phase: i => (first + i) * 0.37
      });
      const ends = arc.ends.map(t => polar(THREE, t.a, t.r, t.y));
      cords.push(cordThrough(THREE, points, swag.bulb, 0.016, ends));
    }
  }
  yield;
  const extraBulbs = bulbs.geometry(1),
    allBulbs = joinGeometries(THREE, [lights.bulbs, extraBulbs]),
    cord = joinGeometries(
      THREE,
      cords.map(g => {
        const n = new THREE.BufferGeometry();
        for (const name of ['position', 'normal', 'uv']) n.setAttribute(name, g.attributes[name]);
        n.setIndex(g.index);
        return n;
      })
    );
  extraBulbs.dispose();
  cords.slice(1).forEach(g => g.dispose());

  yield;
  // ---------- hanging ornaments ----------
  const anchors = [
    ...model.tips.filter(
      t => t.whorl >= spec.ornaments.from && t.whorl < model.tiers.length - spec.ornaments.top
    ),
    ...model.sprays.filter(
      t =>
        t.whorl < model.tiers.length - spec.ornaments.top - 1 &&
        (t.bough + t.whorl) % spec.ornaments.sprays === 0
    )
  ];
  const gold = colour(0xd9a520),
    silver = colour(0xc9ced6);
  for (const anchor of anchors) {
    if (random() < spec.ornaments.empty) continue;
    const [x, y, z] = anchor.position,
      u = clamp(y / H, 0, 1),
      size = (1.25 - 0.75 * u) * (0.82 + 0.36 * random()),
      roll = random(),
      facing = Math.atan2(x, z),
      top = new THREE.Vector3(x, y, z),
      thread = 0.05 + 0.1 * random(),
      hook = top.clone().setY(y - thread);
    const kind = ORNAMENT_MIX.find(([, share]) => roll < share)[0];
    place(top, 0, S(0.008, thread, 0.008));
    deco.add(shapes.thread, m, gold, FINISH.metal);
    const tone = BAUBLES[Math.floor(random() * BAUBLES.length)],
      sparkle = random() < 0.32;
    if (kind === 'ball' || kind === 'drop') {
      const r = 0.19 * size * (kind === 'drop' ? 0.85 : 1),
        cap = 0.24 * r * 1.2;
      place(hook.clone().setY(hook.y - cap * 0.5), 0, S(r, r * 1.2, r));
      deco.add(shapes.cap, m, gold, FINISH.metal);
      const body = hook.clone().setY(hook.y - cap - (kind === 'drop' ? 0.9 : 1) * r);
      place(body, random() * TAU, S(r));
      deco.add(shapes[kind], m, colour(tone), sparkle ? FINISH.glitter : FINISH.glass);
      hangers.push({ kind, anchor: top, hook, bottom: body.y - r * (kind === 'drop' ? 1.55 : 1), size: r });
    } else if (kind === 'star' || kind === 'flake') {
      const r = (kind === 'star' ? 0.2 : 0.24) * size;
      place(hook.clone().setY(hook.y - r), facing, S(r));
      // Stars in gold or silver metal; the rest glitter in white or pale blue (one draw either way).
      let tone;
      if (kind === 'star') tone = random() < 0.6 ? gold : silver;
      else tone = colour(random() < 0.5 ? 0xf6f8ff : 0xbfe0ff);
      deco.add(shapes[kind], m, tone, kind === 'star' ? FINISH.metal : FINISH.glitter);
      hangers.push({ kind, anchor: top, hook, bottom: hook.y - 2 * r, size: r });
    } else if (kind === 'cane') {
      const l = 0.38 * size,
        red = colour(0xc8102e),
        white = colour(0xf6f2ee);
      place(hook.clone().setY(hook.y - 0.16 * l), facing + Math.PI / 2, S(l));
      // Rings alternate red and white along the shaft (5 vertices per ring).
      deco.add(shapes.cane, m, i => (Math.floor(i / 5) % 2 ? red : white), FINISH.glass);
      hangers.push({ kind, anchor: top, hook, bottom: hook.y - l, size: l });
    } else if (kind === 'bell') {
      const l = 0.21 * size;
      place(hook, random() * TAU, S(l));
      deco.add(shapes.bell, m, random() < 0.7 ? gold : silver, FINISH.metal);
      hangers.push({ kind, anchor: top, hook, bottom: hook.y - l * 1.1, size: l });
    } else {
      const l = 0.2 * size;
      place(hook.clone().setY(hook.y - 0.18 * l), random() * TAU, S(l * 0.9, l, l * 0.9));
      deco.add(shapes.cone, m, colour(0x6b4126), FINISH.snow);
      hangers.push({ kind, anchor: top, hook, bottom: hook.y - 1.18 * l, size: l });
    }
  }

  // ---------- satin ribbon spiral (both faces; red with gold edges) ----------
  {
    const { turns, from, to, phase, width, segments, lift } = spec.ribbon,
      red = colour(0xc0101f),
      edge = colour(0xe0b23c),
      front = [],
      back = [];
    const at = s => {
      const y = H * (to - (to - from) * s),
        a = turns * TAU * s + phase,
        r = cap(a, y, crown.outer(a, y) * 0.96 + lift + 0.04 * Math.sin(s * segments * 0.9));
      return polar(THREE, a, r, y);
    };
    for (let i = 0; i <= segments; i++) {
      const s = i / segments,
        p = at(s),
        tangent = at(Math.min(1, s + 0.002))
          .sub(at(Math.max(0, s - 0.002)))
          .normalize(),
        outward = p.clone().setY(0).normalize(),
        normal = outward.clone().addScaledVector(up, 0.25).normalize(),
        across = new THREE.Vector3().crossVectors(normal, tangent).normalize(),
        flip = normal.clone().negate();
      // Thin gold edges on a red satin body.
      const row = [-0.5, -0.36, 0.36, 0.5].map(k => p.clone().addScaledVector(across, k * width)),
        tone = k => (k === 0 || k === 3 ? edge : red);
      front.push(row.map((v, k) => deco.vertex(v, normal, tone(k), FINISH.satin)));
      back.push(row.map((v, k) => deco.vertex(v, flip, tone(k), FINISH.satin)));
    }
    for (let i = 0; i < segments; i++)
      for (let k = 0; k < 3; k++) {
        const [a, b, c, d] = [front[i][k], front[i][k + 1], front[i + 1][k], front[i + 1][k + 1]];
        deco.index.push(a, c, b, b, c, d);
        const [a2, b2, c2, d2] = [back[i][k], back[i][k + 1], back[i + 1][k], back[i + 1][k + 1]];
        deco.index.push(a2, b2, c2, b2, d2, c2);
      }
  }

  yield;
  // ---------- tinsel swags: two crossed twisted strips per swag ----------
  for (const tinsel of spec.tinsel) {
    const tone = colour(tinsel.colour === 'gold' ? 0xe2b84a : 0xd8dde6);
    for (const arc of swagArcs(model, tinsel.whorl, tinsel.span, tinsel.sag)) {
      const n = Math.max(8, Math.round(arc.length / 0.26)),
        path = [];
      for (let k = 0; k <= n; k++) {
        const { a, r, y } = arc.at(k / n),
          rest = cap(a, y, Math.max(r + 0.05, crown.at(a, y) + 0.06));
        path.push(polar(THREE, a, rest, y));
      }
      for (const cross of [0, Math.PI / 2]) {
        const rows = path.map((p, k) => {
          const tangent = path[Math.min(n, k + 1)]
              .clone()
              .sub(path[Math.max(0, k - 1)])
              .normalize(),
            outward = p.clone().setY(0).normalize(),
            side = new THREE.Vector3().crossVectors(tangent, outward).normalize(),
            out = new THREE.Vector3().crossVectors(side, tangent).normalize(),
            twist = cross + (k / n) * TAU * 3,
            across = side.clone().multiplyScalar(Math.cos(twist)).addScaledVector(out, Math.sin(twist)),
            normal = new THREE.Vector3().crossVectors(across, tangent).normalize();
          return [-1, 1].map(sign => {
            const v = p.clone().addScaledVector(across, sign * tinsel.width * 0.5);
            return [
              deco.vertex(v, normal, tone, FINISH.tinsel),
              deco.vertex(v, normal.clone().negate(), tone, FINISH.tinsel)
            ];
          });
        });
        for (let k = 0; k < n; k++) {
          const [[a, a2], [b, b2]] = rows[k],
            [[c, c2], [d, d2]] = rows[k + 1];
          deco.index.push(a, b, c, b, d, c, a2, c2, b2, b2, c2, d2);
        }
      }
    }
  }

  // ---------- snow skirt and gifts ----------
  {
    const { radii, heights, segments } = spec.skirt,
      white = colour(0xeef2f8),
      rings = radii.map((r, k) =>
        Array.from({ length: segments }, (_, j) => {
          const a = (j / segments) * TAU,
            wobble = k ? 1 + 0.07 * Math.sin(a * 5 + k) + 0.04 * Math.sin(a * 11) : 1,
            p = polar(THREE, a, r * wobble, spec.snowTop + heights[k]),
            slope = k ? (heights[k - 1] - heights[k]) / (radii[k] - radii[k - 1]) : 0.1,
            normal = p.clone().setY(0).normalize().multiplyScalar(slope).add(up).normalize();
          return deco.vertex(p, normal, white, FINISH.snow);
        })
      );
    for (let k = 0; k < rings.length - 1; k++)
      for (let j = 0; j < segments; j++) {
        const a = rings[k][j],
          b = rings[k][(j + 1) % segments],
          c = rings[k + 1][j],
          d = rings[k + 1][(j + 1) % segments];
        deco.index.push(a, c, b, b, c, d);
      }
  }
  yield;
  const gifts = [];
  {
    const { count, stacked, inner, outer, gate: keep } = spec.gifts;
    for (let tries = 0; gifts.length < count && tries < 400; tries++) {
      const a = random() * TAU,
        reachLimit = gate !== undefined && Math.cos(a - gate) > Math.cos(keep.spread) ? keep.reach : outer,
        w = 0.36 + 0.42 * random(),
        d = 0.36 + 0.42 * random(),
        h = 0.28 + 0.45 * random(),
        half = 0.5 * Math.hypot(w, d),
        r = inner + half * 0.6 + random() * Math.max(0, reachLimit - half - inner - half * 0.6);
      if (r + half > reachLimit + 0.05) continue;
      const x = Math.sin(a) * r,
        z = Math.cos(a) * r;
      if (gifts.some(g => Math.hypot(g.x - x, g.z - z) < g.half + half + 0.04)) continue;
      gifts.push({ x, z, w, d, h, half, turn: random() * TAU, y: spec.snowTop + skirtHeight(r) - 0.03 });
    }
    // A few smaller gifts stand on top of the larger ones.
    gifts
      .slice()
      .sort((p, q) => q.w * q.d - p.w * p.d)
      .slice(0, stacked)
      .forEach(g => {
        const s = 0.55 + 0.15 * random();
        gifts.push({
          x: g.x,
          z: g.z,
          w: g.w * s,
          d: g.d * s,
          h: g.h * 0.7,
          half: g.half * s,
          turn: g.turn + 0.5 + random(),
          y: g.y + g.h,
          on: g
        });
      });
    for (const g of gifts) {
      const wrap = colour(WRAPS[Math.floor(random() * WRAPS.length)]),
        band = colour(BANDS[Math.floor(random() * BANDS.length)]),
        centre = new THREE.Vector3(g.x, g.y + g.h / 2, g.z),
        finish = random() < 0.3 ? FINISH.glitter : FINISH.paper;
      place(centre, g.turn, S(g.w, g.h, g.d));
      deco.add(shapes.box, m, wrap, finish);
      place(centre, g.turn, S(g.w * 1.015, g.h * 1.015, 0.12));
      deco.add(shapes.box, m, band, FINISH.satin);
      place(centre, g.turn, S(0.12, g.h * 1.015, g.d * 1.015));
      deco.add(shapes.box, m, band, FINISH.satin);
      // Bow: two upright loops along the ribbon, open at the bottom and leaning apart on the lid.
      const loop = 0.3 * Math.min(g.w, g.d) + 0.05;
      for (const side of [1, -1]) {
        const lid = new THREE.Vector3(
          g.x + Math.cos(g.turn) * side * loop * 0.42,
          g.y + g.h + loop * 0.38,
          g.z - Math.sin(g.turn) * side * loop * 0.42
        );
        // The torus arc's gap (centred at -0.225 turn) turns to the bottom, then leans outwards.
        m.compose(lid, q.setFromEuler(e.set(0, g.turn, -0.275 * Math.PI - side * 0.5)), S(loop));
        deco.add(shapes.loop, m, band, FINISH.satin);
      }
    }
  }
  yield;
  const ornaments = deco.geometry(4);

  // ---------- star topper ----------
  const star = createTopStar(THREE, spec.star),
    starHeight = H + spec.star.lift * spec.star.outer;
  star.translate(0, starHeight, 0);
  star.computeBoundingSphere();
  Object.values(shapes).forEach(g => g.dispose());
  return {
    bulbs: allBulbs,
    economyIndex: lights.bulbs.index.count,
    cord,
    ornaments,
    star,
    starHeight,
    hangers,
    gifts,
    swagBulbs
  };
}

/** Rays and a soft core for the star's billboard (drawn once into a canvas). */
export function paintStarRays(ctx, size) {
  const c = size / 2;
  ctx.clearRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'lighter';
  const core = ctx.createRadialGradient(c, c, 0, c, c, c);
  core.addColorStop(0, 'rgba(255,244,214,0.95)');
  core.addColorStop(0.09, 'rgba(255,214,130,0.5)');
  core.addColorStop(0.32, 'rgba(255,182,90,0.12)');
  core.addColorStop(1, 'rgba(255,160,70,0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 16; i++) {
    const long = i % 2 === 0,
      length = c * (long ? 0.96 : 0.52) * (0.86 + 0.14 * (((i * 7) % 5) / 4)),
      half = c * (long ? 0.03 : 0.018),
      ray = ctx.createLinearGradient(0, 0, length, 0);
    ray.addColorStop(0, 'rgba(255,238,196,0.7)');
    ray.addColorStop(0.5, 'rgba(255,214,140,0.22)');
    ray.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate((i / 16) * TAU);
    ctx.fillStyle = ray;
    ctx.beginPath();
    ctx.moveTo(0, -half);
    ctx.lineTo(length, 0);
    ctx.lineTo(0, half);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

/**
 * Materials: lit ornaments (fake sky reflection on glossy shells, view-dependent glitter, snow dust on top
 * faces, a warm night sheen), the unlit star, its billboard rays turning slowly and a warm glow on the snow.
 * time is the garden's effect clock (it stops for reduced motion and economy), snow the winter uniform.
 */
export function createXmasMaterials(THREE, { time, snow, raysMap, glowMap }) {
  const night = { value: 0 },
    rayGain = { value: 0.5 };
  const decor = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0 });
  decor.name = 'xmas decor';
  decor.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, { xmasTime: time, xmasNight: night, gardenSnow: snow });
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute vec4 finish;\nvarying vec4 vFinish;\nvarying vec3 vDecorLocal;\nvarying vec3 vDecorWorld;'
      )
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvFinish=finish;vDecorLocal=position;vDecorWorld=(modelMatrix*vec4(transformed,1.)).xyz;'
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
          uniform float xmasTime;
          uniform float xmasNight;
          uniform float gardenSnow;
          varying vec4 vFinish;
          varying vec3 vDecorLocal;
          varying vec3 vDecorWorld;
          float decorHash(vec3 p){
            return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);
          }`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.18,vFinish.x);'
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
      vec3 decorN=inverseTransformDirection(normal,viewMatrix);
      float decorDust=gardenSnow*vFinish.z*smoothstep(.5,.88,decorN.y+.3*(decorHash(floor(vDecorLocal*38.))-.5));
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.8,.83,.9),decorDust);`
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
          {
            vec3 decorV=normalize(cameraPosition-vDecorWorld+vec3(0.,1e-4,0.));
            vec3 decorR=reflect(-decorV,decorN);
            float rim=1.-clamp(dot(decorN,decorV),0.,1.),rim2=rim*rim,fres=.06+.94*rim2*rim2*rim;
            // How lit this point is, independent of its own colour: scales the fake reflection.
            float lit=dot(reflectedLight.directDiffuse+reflectedLight.indirectDiffuse,
                vec3(.3,.59,.11))/max(dot(diffuseColor.rgb,vec3(.3,.59,.11)),.05);
            lit=clamp(lit,0.,2.5);
            float gloss=vFinish.x*(1.-decorDust);
            vec3 skyTone=mix(vec3(.16,.15,.19),vec3(.95,.97,1.),smoothstep(-.2,.55,decorR.y));
            float spot=smoothstep(.9,.985,dot(decorR,normalize(vec3(.35,.85,.4))));
            reflectedLight.indirectSpecular+=gloss*lit*
                (skyTone*mix(vec3(1.),diffuseColor.rgb*1.8+.1,.6)*(.16+.7*fres)+spot*1.1);
            // Glitter: tiny facets in random directions catch the light as the view (or the clock) moves.
            vec3 cell=floor(vDecorLocal*95.);
            float seed=decorHash(cell);
            vec3 facet=normalize(vec3(decorHash(cell+1.7),decorHash(cell+4.3),decorHash(cell+8.1))-.5+decorN*
                .7+vec3(0.,1e-3,0.));
            float glint=smoothstep(.93,.995,
                dot(reflect(-decorV,facet),normalize(vec3(.3,.9,.3))))*step(.4,seed);
            glint*=.55+.45*sin(xmasTime*(1.5+2.5*seed)+seed*60.);
            totalEmissiveRadiance+=vFinish.y*(1.-decorDust)*glint*(1.2+1.8*xmasNight)*
                (diffuseColor.rgb*.5+.6)*max(lit,.35+xmasNight);
            // At night the shells mirror the warm bulbs around them; some pieces glow a little themselves.
            totalEmissiveRadiance+=diffuseColor.rgb*
                (gloss*xmasNight*(.08+.3*fres)*vec3(1.25,.95,.65)+vFinish.w*(.3+.9*xmasNight));
          }`
      );
  };
  decor.customProgramCacheKey = () => 'garden-xmas-decor-v1';
  const star = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  star.name = 'xmas star';
  const rays = new THREE.MeshBasicMaterial({
    map: raysMap,
    color: 0xffe2b0,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  rays.name = 'xmas star rays';
  // A camera-facing quad; the rays turn slowly and a second, larger copy turns the other way.
  rays.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, { xmasTime: time, xmasRayGain: rayGain });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float xmasTime;\nvarying vec2 vRayTurned;')
      .replace(
        '#include <project_vertex>',
        `float rayTurn=xmasTime*.05;
      mat2 raySpin=mat2(cos(rayTurn),sin(rayTurn),-sin(rayTurn),cos(rayTurn));
      vec4 mvPosition=modelViewMatrix*vec4(0.,0.,0.,1.);
      mvPosition.xy+=raySpin*transformed.xy*(1.+.035*sin(xmasTime*1.1));
      gl_Position=projectionMatrix*mvPosition;
      vRayTurned=(raySpin*raySpin*(uv-.5))*1.35+.5;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float xmasRayGain;\nvarying vec2 vRayTurned;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
      {vec4 second=texture2D(map,vRayTurned);
      diffuseColor.rgb=max(diffuseColor.rgb,second.rgb*diffuse*.7);diffuseColor.a=max(diffuseColor.a,second.a*.7);}
      diffuseColor.a*=xmasRayGain;`
      );
  };
  rays.customProgramCacheKey = () => 'garden-xmas-rays-v1';
  const glow = new THREE.MeshBasicMaterial({
    map: glowMap,
    color: 0xffb466,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  glow.name = 'xmas snow glow';
  return {
    decor,
    star,
    rays,
    glow,
    night,
    // night: 0 by day, 1 at full night (world lighting); the glow and rays follow it.
    setNight(level) {
      const n = clamp(level, 0, 1);
      night.value = n;
      glow.opacity = XMAS.glow.day + (XMAS.glow.night - XMAS.glow.day) * n;
      glow.visible = glow.opacity > 0.005;
      rayGain.value = 0.42 + 0.58 * n;
    }
  };
}
