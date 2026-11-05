// Holiday compositions: on every occasion a solid, themed piece floats over the central island, above the portal,
// with the day's greeting and date in big extruded letters, so the holiday reads from the default overview and
// from close by, by day and by night, on a desktop and on a phone (it turns to the camera and grows with the
// distance). 23 February: a red star in a gold one between laurel branches; 8 March: a volumetric "8" of tulips;
// 12 April: the Earth with the "108 минут" orbit and Vostok circling it; 9 May: a St George ribbon with
// carnations and warm lights; New Year: a clock striking midnight over the year in lights; Christmas: the star
// of Bethlehem; the birthdays: a cake with lit candles and the age as a solid number on a small stage. Every
// composition is built once per occasion as at most a few merged meshes: a lit solid one, an unlit glowing one
// (flames, bulbs, neon), the text (one canvas atlas) and the moving parts; a frame only turns, scales and
// animates them and allocates nothing.
import {
  FIGURE,
  PROJECT,
  figurePoints,
  glyphLines,
  greetingCopy,
  newYearNumber,
  personAge,
  siteAge,
  yearsPhrase
} from './celebrations.mjs';
import { paintContext } from './paint-canvas.mjs';

// Where it floats (world metres, the central island's frame): above the portal, in front of the fir. `scale` 1
// at `distance` m from the camera; farther (the overview on a phone) it grows up to `maxScale`, close by it
// shrinks to `minScale`. It turns to the camera at `turn` (1/s) and bobs `bob` m.
export const STAGE = {
  lift: 5.4,
  forward: 1.6,
  fallback: [1.2, 7.6, 3.6],
  distance: 66,
  minScale: 0.55,
  maxScale: 2.1,
  turn: 2.4,
  bob: 0.18,
  bobSpeed: 0.0009,
  // Lit parts glow a little by day and more at night, so their colours still read in the dark.
  glowDay: 0.22,
  glowNight: 0.6,
  // Birthday stages throw sparks and confetti now and then (fireworks.sparkle), seconds.
  sparkFirst: 2.5,
  sparkEvery: [9, 14],
  // Budgets every composition keeps (tested).
  maxTriangles: 90000,
  maxMeshes: 7
};
// The text atlas: one canvas, a row per line of text.
// The New Year clock strikes midnight 12 times (seconds into its 16 s loop): a stroke every `gap`, a flash
// of `flash` extra glow that dies down by `decay`/s; the strokes in `salute` throw a spark fountain at the
// matching spot (the stage's frame).
export const CHIME = {
  start: 10,
  gap: 0.5,
  strokes: 12,
  flash: 0.3,
  decay: 6,
  salute: [0, 6, 11],
  spots: [
    [-3.4, 12.2, 0.6],
    [3.4, 12.2, 0.6],
    [0, 13.4, 0.6]
  ]
};
export const TEXT = { width: 2048, row: 220, font: 156, layers: 6, depth: 0.09, shift: [0.03, -0.045] };
const FONT = '"Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif';

// Text looks: a vertical fill gradient, the outline and the extruded sides.
const LOOKS = {
  gold: { fill: ['#fffbe6', '#ffd66b', '#ff9f1c'], stroke: '#3b1c00', side: [0.32, 0.18, 0.04] },
  warm: { fill: ['#fff3d6', '#ffc46b', '#ff8a1f'], stroke: '#2a1404', side: [0.3, 0.14, 0.03] },
  white: { fill: ['#ffffff', '#fff3d2', '#ffd27a'], stroke: '#4a0d08', side: [0.36, 0.06, 0.04] },
  red: { fill: ['#ffd9d0', '#ff4a3d', '#c41a12'], stroke: '#2b0402', side: [0.32, 0.03, 0.02] },
  pink: { fill: ['#fff0f6', '#ff8fbf', '#ff3f86'], stroke: '#4a0a2a', side: [0.36, 0.06, 0.18] },
  // White over blue over red, in hard bands.
  tricolour: {
    fill: ['#ffffff', '#ffffff', '#2f6bff', '#2f6bff', '#ff3b30', '#ff3b30'],
    stops: [0, 0.36, 0.38, 0.62, 0.64, 1],
    stroke: '#0b1440',
    side: [0.08, 0.1, 0.3]
  },
  space: { fill: ['#ffffff', '#b8d6ff', '#5f8dff'], stroke: '#071436', side: [0.06, 0.1, 0.3] },
  ice: { fill: ['#ffffff', '#c6ecff', '#6fc4ff'], stroke: '#0a2340', side: [0.08, 0.2, 0.36] },
  green: { fill: ['#e6ffe9', '#6dff8f', '#14c94a'], stroke: '#02200a', side: [0.02, 0.2, 0.08] },
  spring: { fill: ['#fff4f0', '#ff6f61', '#e8281c'], stroke: '#3a0703', side: [0.34, 0.05, 0.03] },
  blue: { fill: ['#ffffff', '#9fd0ff', '#2f7bff'], stroke: '#06163f', side: [0.05, 0.12, 0.38] },
  neon: { fill: ['#ffe8ff', '#ff3fd8', '#28e6ff'], stroke: '#14002a', side: [0.22, 0.02, 0.36] },
  party: { fill: ['#fffbe6', '#ffd36b', '#ff5fa2'], stroke: '#3a0a24', side: [0.34, 0.08, 0.16] }
};

// Colours (linear) of the solid parts.
const C = {
  gold: [1, 0.68, 0.16],
  goldDeep: [0.8, 0.45, 0.06],
  red: [0.86, 0.05, 0.04],
  redDeep: [0.55, 0.02, 0.02],
  leaf: [0.1, 0.42, 0.12],
  leafLight: [0.3, 0.62, 0.18],
  stem: [0.16, 0.38, 0.1],
  wood: [0.32, 0.17, 0.08],
  white: [0.95, 0.95, 0.97],
  cream: [1, 0.93, 0.8],
  silver: [0.78, 0.8, 0.86],
  black: [0.035, 0.03, 0.03],
  orange: [1, 0.42, 0.02],
  navy: [0.03, 0.06, 0.2],
  blue: [0.08, 0.3, 1],
  sky: [0.35, 0.65, 1],
  ice: [0.75, 0.9, 1],
  ocean: [0.04, 0.22, 0.75],
  land: [0.14, 0.55, 0.2],
  dark: [0.05, 0.055, 0.08],
  screen: [0.01, 0.06, 0.03],
  violet: [0.14, 0.03, 0.26],
  pink: [1, 0.35, 0.6],
  rose: [1, 0.12, 0.3]
};
// Glowing colours (unlit; above 1 they feed the glow pass at night).
const G = {
  flame: [1.25, 0.72, 0.22],
  warm: [1.15, 0.7, 0.3],
  bulbWhite: [1.2, 1.05, 0.8],
  bulbGold: [1.2, 0.75, 0.18],
  bulbRed: [1.2, 0.16, 0.1],
  bulbGreen: [0.25, 1.15, 0.35],
  bulbBlue: [0.3, 0.55, 1.25],
  star: [1.3, 1.08, 0.62],
  ice: [0.62, 0.92, 1.25],
  cyan: [0.15, 1.05, 1.25],
  magenta: [1.25, 0.12, 1],
  violet: [0.65, 0.3, 1.25],
  lime: [0.75, 1.25, 0.1],
  orbit: [0.7, 0.95, 1.25],
  green: [0.2, 1.25, 0.4],
  blue: [0.25, 0.5, 1.3],
  sparkBlue: [0.8, 0.92, 1.3]
};
// Spark colours for the birthday stages (fireworks.sparkle).
export const STAGE_SPARKS = {
  birthday: [
    [1, 0.74, 0.3],
    [1, 0.35, 0.66],
    [0.3, 0.86, 1]
  ],
  dima: [
    [0.45, 0.7, 1],
    [0.92, 0.96, 1],
    [0.2, 0.4, 1]
  ],
  andrey: [
    [1, 0.15, 0.85],
    [0.1, 0.95, 1],
    [0.75, 1, 0.15]
  ],
  // The midnight salute of the New Year clock: gold, silver, red and green.
  newyear: [
    [1, 0.74, 0.3],
    [0.94, 0.95, 1],
    [1, 0.25, 0.2],
    [0.35, 1, 0.5]
  ]
};

// ---------- the words ----------
const key = occasion =>
  ({
    newyear: 'NewYear',
    oldnewyear: 'OldNewYear',
    march8: 'March8',
    may1: 'May1'
  })[occasion] || occasion.charAt(0).toUpperCase() + occasion.slice(1);
// A greeting longer than `room` characters breaks into two lines at the space nearest its middle (a break
// after a comma wins).
export function splitLines(text, room = 15) {
  const words = String(text || '').trim();
  if (words.length <= room || !words.includes(' ')) return words ? [words] : [];
  let best = -1,
    score = Infinity;
  for (let i = 0; i < words.length; i++) {
    if (words[i] !== ' ') continue;
    const s = Math.abs(i - words.length / 2) - (words[i - 1] === ',' ? 4 : 0);
    if (s < score) {
      score = s;
      best = i;
    }
  }
  return [words.slice(0, best), words.slice(best + 1)];
}
// What the composition says: the greeting (the card's title), the big date or age line and, on some days,
// an extra line (108 минут, Мир! Труд! Май!). `party`: the project birthdays (projectBirthdays).
export function stageCopy(occasion, labels = {}, date = new Date(), locale = 'ru', party = []) {
  if (!occasion) return { greeting: [], date: '', extra: '' };
  const copy = greetingCopy(occasion, labels, date, locale, party),
    k = key(occasion),
    own = labels['celebrate' + k + 'Date'];
  let line = own || [copy.mark, copy.unit].filter(Boolean).join(' ');
  if (occasion === 'newyear' || occasion === 'oldnewyear') line = own || String(newYearNumber(date));
  if (occasion === 'birthday') line = yearsPhrase(siteAge(date), locale, labels);
  if (occasion === 'dima' || occasion === 'andrey')
    line = yearsPhrase(personAge(occasion, date), locale, labels);
  if (occasion === PROJECT) line = copy.unit ? copy.mark + ' ' + copy.unit : copy.mark;
  return {
    // The stage says who is celebrated (celebrate*Stage: "Создатель maserplay.ru"); the greeting card already
    // says "Happy birthday" (owner, round 9: the same words twice). Other days keep the title.
    greeting: splitLines(labels['celebrate' + k + 'Stage'] || copy.title),
    date: String(line || '').trim(),
    extra: String(labels['celebrate' + k + 'Extra'] || '').trim()
  };
}

// ---------- geometry ----------
// Parts are collected as { geometry, colour } (colour: rgb or a function of the vertex) and merged into one
// non-indexed geometry per material.
function merge(THREE, parts) {
  let count = 0;
  const flats = parts.map(({ geometry, colour }) => {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    if (flat !== geometry) geometry.dispose();
    if (!flat.attributes.normal) flat.computeVertexNormals();
    count += flat.attributes.position.count;
    return { flat, colour };
  });
  const positions = new Float32Array(count * 3),
    normals = new Float32Array(count * 3),
    colours = new Float32Array(count * 3);
  let o = 0;
  for (const { flat, colour } of flats) {
    const p = flat.attributes.position,
      n = flat.attributes.normal;
    for (let i = 0; i < p.count; i++, o++) {
      positions.set([p.getX(i), p.getY(i), p.getZ(i)], o * 3);
      normals.set([n.getX(i), n.getY(i), n.getZ(i)], o * 3);
      colours.set(typeof colour === 'function' ? colour(p.getX(i), p.getY(i), p.getZ(i)) : colour, o * 3);
    }
    flat.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  out.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  out.computeBoundingSphere();
  return out;
}

// A builder for one composition: solid (lit) and glow (unlit) parts, text blocks and named features.
function kit(THREE) {
  const solid = [],
    glow = [],
    text = [],
    names = new Set(),
    matrix = new THREE.Matrix4(),
    quaternion = new THREE.Quaternion(),
    euler = new THREE.Euler(),
    position = new THREE.Vector3(),
    size = new THREE.Vector3();
  // geometry placed at p ([x,y,z]) turned by r ([x,y,z] radians) and scaled by s (number or [x,y,z]).
  // r may be 0 (no turn).
  function put(list, geometry, colour, p = [0, 0, 0], r = 0, s = 1) {
    euler.set(r?.[0] ?? 0, r?.[1] ?? 0, r?.[2] ?? 0);
    quaternion.setFromEuler(euler);
    position.set(p[0], p[1], p[2]);
    if (Array.isArray(s)) size.set(s[0], s[1], s[2]);
    else size.setScalar(s);
    geometry.applyMatrix4(matrix.compose(position, quaternion, size));
    list.push({ geometry, colour });
    return geometry;
  }
  return {
    THREE,
    solid,
    glow,
    text,
    names,
    feature: name => names.add(name),
    add: (...args) => put(solid, ...args),
    light: (...args) => put(glow, ...args),
    sphere: (w = 10, h = 7) => new THREE.SphereGeometry(1, w, h),
    // A cylinder between two points in the x-y plane (z fixed).
    rod(list, a, b, radius, colour, segments = 8) {
      const dx = b[0] - a[0],
        dy = b[1] - a[1],
        dz = (b[2] ?? 0) - (a[2] ?? 0),
        length = Math.hypot(dx, dy, dz) || 1e-3,
        geometry = new THREE.CylinderGeometry(radius, radius, length, segments, 1, true),
        direction = new THREE.Vector3(dx, dy, dz).normalize();
      geometry.applyQuaternion(
        new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction)
      );
      geometry.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, ((a[2] ?? 0) + (b[2] ?? 0)) / 2);
      list.push({ geometry, colour });
    },
    block(textLine, look, at, height, width = 0) {
      if (textLine) text.push({ text: textLine, look, at, height, width });
    }
  };
}

// Glyph strokes (celebrations.mjs GLYPHS) laid out like the sky words: [{ line, x }] in glyph units, centred.
function glyphStrokes(text) {
  const chars = [...String(text).toUpperCase()].filter(c => c === ' ' || glyphLines(c)),
    out = [];
  let left = 0;
  const lefts = chars.map(c => {
    const at = left;
    left += c === ' ' ? FIGURE.space : FIGURE.advance;
    return at;
  });
  const width = chars.length ? lefts.at(-1) + 1 : 0;
  chars.forEach((c, d) => {
    if (c !== ' ') for (const line of glyphLines(c)) out.push({ line, x: lefts[d] - width / 2 });
  });
  return { strokes: out, width };
}
// A solid number or word of round tubes along the glyph strokes, `height` m tall, centred at `at`.
function tubeText(k, list, text, at, height, radius, colour, segments = 10) {
  const unit = height / 1.6,
    { strokes, width } = glyphStrokes(text);
  for (const { line, x } of strokes) {
    for (let i = 0; i + 1 < line.length; i += 2) {
      const px = at[0] + (x + line[i]) * unit,
        py = at[1] + (line[i + 1] - 0.8) * unit;
      list.push({
        geometry: new k.THREE.SphereGeometry(radius, segments, Math.max(5, segments - 3)).translate(
          px,
          py,
          at[2]
        ),
        colour
      });
      if (i + 3 < line.length)
        k.rod(
          list,
          [px, py, at[2]],
          [at[0] + (x + line[i + 2]) * unit, at[1] + (line[i + 3] - 0.8) * unit, at[2]],
          radius,
          colour,
          segments
        );
    }
  }
  return width * unit;
}
// The year in lights: bulb radius, and the dark backing stroke behind them (radius, set-back), in glyph units.
// The backing is thick enough to outline every bulb, so the numerals read against a bright winter sky by day
// (at night it vanishes into the dark and the bulbs carry the shape).
export const YEAR_LIGHTS = { bulb: 0.09, backing: 0.21, back: 0.15 };
// Light bulbs along the glyph strokes, on a dark backing stroke.
function bulbText(k, text, at, height, colours) {
  const unit = height / 1.6,
    { points, count } = figurePoints(text, 0.13);
  tubeText(
    k,
    k.solid,
    text,
    [at[0], at[1], at[2] - unit * YEAR_LIGHTS.back],
    height,
    unit * YEAR_LIGHTS.backing,
    C.dark,
    6
  );
  for (let s = 0; s < count; s++)
    k.light(
      k.sphere(7, 5),
      colours[s % colours.length],
      [at[0] + points[s * 3] * unit, at[1] + points[s * 3 + 1] * unit, at[2]],
      0,
      unit * YEAR_LIGHTS.bulb
    );
}
function shapeOf(THREE, points) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  shape.closePath();
  return shape;
}
function starShape(THREE, rays, outer, inner, long = null) {
  const points = [];
  for (let i = 0; i < rays * 2; i++) {
    const a = (i * Math.PI) / rays,
      r = i % 2 ? inner : (long?.(i / 2) ?? outer);
    points.push([Math.sin(a) * r, Math.cos(a) * r]);
  }
  return shapeOf(THREE, points);
}
function extrude(THREE, shape, depth, bevel = 0.1, curve = 6) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: curve
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}
function heartShape(THREE, size) {
  const s = size / 2,
    shape = new THREE.Shape();
  shape.moveTo(0, -s * 0.95);
  shape.bezierCurveTo(-s * 0.35, -s * 0.55, -s * 1.05, -s * 0.15, -s * 1.02, s * 0.35);
  shape.bezierCurveTo(-s * 1, s * 0.85, -s * 0.45, s * 1.05, 0, s * 0.62);
  shape.bezierCurveTo(s * 0.45, s * 1.05, s * 1, s * 0.85, s * 1.02, s * 0.35);
  shape.bezierCurveTo(s * 1.05, -s * 0.15, s * 0.35, -s * 0.55, 0, -s * 0.95);
  return shape;
}
// A tulip head: three petals round the stem's axis, tilted `tilt` towards the camera.
function tulipHead(k, at, size, colour, tilt = 0.85, spin = 0) {
  for (let p = 0; p < 3; p++) {
    const a = spin + (p * Math.PI * 2) / 3,
      g = k.sphere(8, 6);
    g.scale(0.36, 0.62, 0.26);
    g.translate(0, 0.5, 0.17);
    g.rotateZ(0);
    g.rotateY(a);
    g.rotateX(tilt);
    g.scale(size, size, size);
    g.translate(at[0], at[1], at[2]);
    k.solid.push({ geometry: g, colour });
  }
}
// A leafy branch: a curved stem through `points` with leaves alternating along it.
function branch(k, points, leaves, leafSize, stemRadius, stemColour, leafColour, flower = null) {
  const { THREE } = k,
    curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  k.solid.push({ geometry: new THREE.TubeGeometry(curve, 20, stemRadius, 6, false), colour: stemColour });
  const at = new THREE.Vector3(),
    along = new THREE.Vector3();
  for (let i = 0; i < leaves; i++) {
    const u = 0.08 + (0.9 * i) / leaves,
      side = i % 2 ? 1 : -1;
    curve.getPointAt(u, at);
    curve.getTangentAt(u, along);
    const angle = Math.atan2(along.y, along.x) - Math.PI / 2 + side * 0.75,
      size = leafSize * (1 - 0.35 * u);
    if (flower && i % 2) {
      flower(at.toArray(), size, i);
      continue;
    }
    const g = k.sphere(8, 5);
    g.scale(size * 0.34, size, size * 0.12);
    g.translate(0, size * 0.85, 0);
    g.rotateZ(angle);
    g.translate(at.x, at.y, at.z);
    k.solid.push({ geometry: g, colour: typeof leafColour === 'function' ? leafColour(i) : leafColour });
  }
}
// A five-petal blossom facing the camera.
function blossom(k, at, size, petal, centre) {
  for (let p = 0; p < 5; p++) {
    const a = (p * Math.PI * 2) / 5,
      g = k.sphere(7, 5);
    g.scale(size * 0.32, size * 0.5, size * 0.12);
    g.translate(0, size * 0.42, 0);
    g.rotateZ(a);
    g.translate(at[0], at[1], at[2] + 0.12);
    k.solid.push({ geometry: g, colour: petal });
  }
  k.add(k.sphere(6, 5), centre, [at[0], at[1], at[2] + 0.2], 0, size * 0.18);
}
// A floating round stage: a disc with a lit rim and a ring of small lights.
function stage(k, radius, top, rim, lights) {
  const { THREE } = k;
  k.add(new THREE.CylinderGeometry(radius, radius * 0.86, 0.7, 40), top, [0, -0.35, 0]);
  k.add(new THREE.ConeGeometry(radius * 0.86, 1.6, 40, 1, true), top, [0, -1.5, 0], [Math.PI, 0, 0]);
  k.light(new THREE.TorusGeometry(radius, 0.1, 6, 48), rim, [0, 0.02, 0], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    k.light(
      k.sphere(6, 4),
      lights[i % lights.length],
      [Math.sin(a) * radius * 0.93, -0.55, Math.cos(a) * radius * 0.93],
      0,
      0.13
    );
  }
  k.feature('stage');
}
// A rounded rectangle w x h (corner radius r), centred, as a shape to extrude; and a frame of it `band` wide.
function roundedRect(THREE, w, h, r) {
  const shape = new THREE.Shape(),
    x = w / 2,
    y = h / 2;
  shape.moveTo(-x + r, -y);
  shape.lineTo(x - r, -y);
  shape.quadraticCurveTo(x, -y, x, -y + r);
  shape.lineTo(x, y - r);
  shape.quadraticCurveTo(x, y, x - r, y);
  shape.lineTo(-x + r, y);
  shape.quadraticCurveTo(-x, y, -x, y - r);
  shape.lineTo(-x, -y + r);
  shape.quadraticCurveTo(-x, -y, -x + r, -y);
  return shape;
}
function roundedFrame(THREE, w, h, r, band) {
  const frame = roundedRect(THREE, w, h, r),
    hole = roundedRect(THREE, w - band * 2, h - band * 2, Math.max(0.05, r - band));
  frame.holes.push(new THREE.Path(hole.getPoints(8).reverse()));
  return frame;
}
// Small four-pointed sparkles around a composition.
function sparkles(k, spots, colour, size = 0.5) {
  const { THREE } = k;
  for (const [x, y, z, s = 1] of spots) {
    const g = extrude(THREE, starShape(THREE, 4, size * s, size * s * 0.22), 0.05, 0);
    k.light(g, colour, [x, y, z]);
  }
}

// ---------- the compositions ----------
// Each writes into the kit; local frame: x right, y up, +z towards the camera, metres, base near y 0.
const GREETING_AT = 14.2,
  GREETING_SIZE = 2.35;
function greeting(k, copy, look, top = GREETING_AT, size = GREETING_SIZE, x = 0) {
  copy.greeting.forEach((line, i) => k.block(line, look, [x, top - i * size * 1.12, 0.6], size));
  k.feature('greeting');
}
export const COMPOSITIONS = {
  // 23 February: a red star set in a gold one between gold laurel branches, the date large under it.
  defender(k, copy) {
    const { THREE } = k;
    k.add(extrude(THREE, starShape(THREE, 5, 3.5, 1.42), 0.6, 0.16, 1), C.gold, [0, 6.6, 0]);
    k.add(extrude(THREE, starShape(THREE, 5, 2.55, 1.03), 0.7, 0.12, 1), C.red, [0, 6.6, 0.45]);
    k.light(k.sphere(8, 6), G.star, [0, 6.6, 0.95], 0, 0.28);
    k.feature('star');
    for (const side of [-1, 1])
      branch(
        k,
        [
          [side * 0.4, 1.9, 0.2],
          [side * 3.1, 3.2, 0.3],
          [side * 4.3, 6.1, 0.2],
          [side * 3.7, 9.3, 0]
        ],
        16,
        0.95,
        0.09,
        C.goldDeep,
        i => (i % 3 ? C.gold : C.goldDeep)
      );
    k.feature('laurel');
    k.block(copy.date, LOOKS.gold, [0, 0.3, 0.6], 3.5);
    greeting(k, copy, LOOKS.white, 15.1);
  },
  // 8 March: a big solid "8" of tulips on green foliage.
  march8(k, copy) {
    const { THREE } = k,
      height = 9.6,
      unit = height / 1.6,
      base = [0, 5.4, 0],
      colours = [C.rose, C.pink, [1, 0.78, 0.15], C.white, [1, 0.42, 0.3], [0.85, 0.2, 0.75]];
    let n = 0;
    for (const line of glyphLines('8')) {
      const pts = [];
      for (let i = 0; i + 1 < line.length; i += 2)
        pts.push(
          new THREE.Vector3(base[0] + (line[i] - 0.5) * unit, base[1] + (line[i + 1] - 0.8) * unit, 0)
        );
      const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
      k.add(new THREE.TubeGeometry(curve, 48, 0.5, 8, false), C.leaf);
      const length = curve.getLength(),
        count = Math.round(length / 0.62),
        at = new THREE.Vector3();
      for (let s = 0; s < count; s++) {
        curve.getPointAt(s / count, at);
        for (const [dz, dy] of [
          [0.45, 0.18],
          [0.1, -0.32]
        ]) {
          tulipHead(
            k,
            [at.x + (s % 2 ? 0.12 : -0.12), at.y + dy, at.z + dz],
            0.78,
            colours[n % colours.length],
            0.95,
            n
          );
          n++;
        }
        if (s % 3 === 0) {
          const g = k.sphere(7, 5);
          g.scale(0.16, 0.62, 0.06);
          g.rotateZ(s % 2 ? 0.9 : -0.9);
          g.translate(at.x, at.y, at.z + 0.55);
          k.solid.push({ geometry: g, colour: C.leafLight });
        }
      }
    }
    k.feature('tulips');
    k.feature('eight');
    greeting(k, copy, LOOKS.pink, 13.4, 2.5);
  },
  // 14 February: a big glossy heart with an arrow, small hearts around it, the date under it.
  valentine(k, copy) {
    const { THREE } = k;
    k.add(extrude(THREE, heartShape(THREE, 6.6), 1.5, 0.35, 12), C.rose, [0, 6.6, 0]);
    k.rod(k.solid, [-4.6, 4.4, 1.2], [4.6, 8.8, -0.6], 0.12, C.gold);
    k.add(new THREE.ConeGeometry(0.34, 0.9, 10), C.gold, [4.75, 8.87, -0.63], [0, 0, -Math.PI / 2 + 0.44]);
    for (const dx of [0, 0.35, 0.7])
      k.add(
        new THREE.BoxGeometry(0.62, 0.32, 0.05),
        C.white,
        [-4.4 + dx, 4.52 + dx * 0.48, 1.15],
        [0, 0, 0.44]
      );
    const small = [
      [-5.2, 9.2, 0.5, 1],
      [5.4, 5.2, 0.6, 0.8],
      [-4.8, 2.6, 0.8, 0.7],
      [4.2, 10.4, 0.2, 0.6]
    ];
    for (const [x, y, z, s] of small)
      k.add(extrude(THREE, heartShape(THREE, 1.5 * s), 0.4, 0.1, 8), C.pink, [x, y, z]);
    k.feature('heart');
    k.block(copy.date, LOOKS.pink, [0, 0.4, 0.8], 3.1);
    greeting(k, copy, LOOKS.pink, 15.4, 2.3);
  },
  // 12 April: the Earth, the 108-minute orbit with Vostok on it (it circles), stars and the date.
  cosmonautics(k, copy, moving) {
    const { THREE } = k,
      earth = new THREE.SphereGeometry(2.7, 32, 20);
    k.add(
      earth,
      (x, y, z) => {
        const nx = x / 2.7,
          ny = (y - 6.4) / 2.7,
          nz = z / 2.7,
          land =
            Math.sin(nx * 4.1 + ny * 2.3) + Math.sin(nz * 3.7 - ny * 3.1) + Math.sin((nx + nz) * 5.3) * 0.6;
        if (Math.abs(ny) > 0.86) return C.white;
        return land > 0.75 ? C.land : C.ocean;
      },
      [0, 6.4, 0]
    );
    k.light(new THREE.TorusGeometry(6.2, 0.13, 6, 96), G.orbit, [0, 6.4, 0], [1.2, 0, 0.32]);
    k.feature('orbit');
    // Vostok: the descent ball and the instrument cone, moved along the orbit each frame.
    const ship = moving;
    ship.add(new THREE.SphereGeometry(0.62, 16, 12), C.silver);
    ship.add(new THREE.CylinderGeometry(0.62, 0.38, 0.95, 14), C.silver, [0, 0, -0.85], [Math.PI / 2, 0, 0]);
    ship.add(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 5), C.dark, [0.35, 0.55, 0.1], [0, 0, -0.5]);
    ship.light(new THREE.SphereGeometry(0.14, 8, 6), G.flame, [0, 0, -1.4]);
    k.feature('vostok');
    sparkles(
      k,
      [
        [-6.2, 11.2, -0.5, 1],
        [6.6, 10.2, -0.5, 0.8],
        [-7.3, 4.2, -0.5, 0.7],
        [7.4, 3.2, -0.5, 1.1],
        [-3.6, 12.2, -0.5, 0.6],
        [3.2, 1.6, -0.5, 0.6]
      ],
      G.star,
      0.55
    );
    k.block(copy.extra, LOOKS.space, [6.9, 9.6, 0.8], 1.7);
    k.block(copy.date, LOOKS.space, [0, 0.2, 0.8], 3.2);
    greeting(k, copy, LOOKS.space, 15.5, 2.3);
  },
  // 1 May: the date between two blossoming branches, "Мир! Труд! Май!" under it.
  may1(k, copy) {
    for (const side of [-1, 1])
      branch(
        k,
        [
          [side * 7, 1.6, -0.3],
          [side * 6.6, 5.6, 0],
          [side * 4.4, 9.4, 0.1],
          [side * 1.4, 11.3, 0]
        ],
        22,
        0.9,
        0.13,
        C.wood,
        C.leafLight,
        (at, size, i) => blossom(k, at, 1.15, i % 4 === 1 ? C.pink : C.white, [1, 0.75, 0.1])
      );
    k.feature('blossom');
    k.block(copy.date, LOOKS.spring, [0, 4.6, 0.6], 4.6);
    k.block(copy.extra, LOOKS.spring, [0, 1.4, 0.6], 1.9);
    greeting(k, copy, LOOKS.spring, 15.2, 2.2);
  },
  // 9 May: restrained. The St George ribbon looped like a pin, three red carnations at its knot, the date in
  // warm gold and a few still warm lights; no party.
  victory(k, copy) {
    const { THREE } = k,
      curve = new THREE.CatmullRomCurve3(
        [
          [-3.3, 1.2, 0.25],
          [-1.6, 3.6, 0.25],
          [0, 5.4, 0.3],
          [1.9, 7.6, 0.2],
          [1.7, 10, 0],
          [0, 10.9, -0.1],
          [-1.7, 10, 0],
          [-1.9, 7.6, -0.2],
          [0, 5.4, -0.3],
          [1.6, 3.6, -0.25],
          [3.3, 1.2, -0.25]
        ].map(p => new THREE.Vector3(...p)),
        false,
        'centripetal'
      );
    // The ribbon: five lengthwise stripes, black and orange, each its own strip facing the camera.
    const width = 1.15,
      steps = 120,
      at = new THREE.Vector3(),
      along = new THREE.Vector3();
    for (let stripe = 0; stripe < 5; stripe++) {
      const positions = [];
      const edge = s => {
        curve.getPointAt(s / steps, at);
        curve.getTangentAt(s / steps, along);
        const nx = -along.y,
          ny = along.x,
          l = Math.hypot(nx, ny) || 1;
        return [
          [at.x + (nx / l) * width * (stripe / 5 - 0.5), at.y + (ny / l) * width * (stripe / 5 - 0.5), at.z],
          [
            at.x + (nx / l) * width * ((stripe + 1) / 5 - 0.5),
            at.y + (ny / l) * width * ((stripe + 1) / 5 - 0.5),
            at.z
          ]
        ];
      };
      for (let s = 0; s < steps; s++) {
        const [a0, a1] = edge(s),
          [b0, b1] = edge(s + 1);
        positions.push(...a0, ...b0, ...a1, ...a1, ...b0, ...b1);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      g.computeVertexNormals();
      k.solid.push({ geometry: g, colour: stripe % 2 ? C.orange : C.black });
    }
    // Swallow-tail cuts at the ends: small dark wedges would look torn; the ends stay straight.
    k.feature('ribbon');
    for (const [x, y, s] of [
      [-0.75, 4.6, 1],
      [0.75, 4.5, 1],
      [0, 3.9, 1.1]
    ]) {
      k.rod(k.solid, [x * 0.4, 0.9, 0.6], [x, y - 0.3, 0.7], 0.06, C.stem);
      for (let p = 0; p < 7; p++) {
        const a = (p / 7) * Math.PI * 2;
        k.add(
          k.sphere(7, 5),
          p % 2 ? C.red : C.redDeep,
          [x + Math.sin(a) * 0.32 * s, y + Math.cos(a) * 0.26 * s, 0.85],
          0,
          0.36 * s
        );
      }
      k.add(k.sphere(7, 5), C.red, [x, y, 1.05], 0, 0.3 * s);
    }
    k.feature('carnations');
    for (const [x, y] of [
      [-5.6, 2.2],
      [5.6, 2.2],
      [-6.2, 6.4],
      [6.2, 6.4]
    ]) {
      k.light(k.sphere(8, 6), G.warm, [x, y, 0], 0, 0.32);
      k.add(new THREE.CylinderGeometry(0.42, 0.5, 0.25, 10), C.goldDeep, [x, y - 0.42, 0]);
    }
    k.feature('warm-lights');
    k.block(copy.date, LOOKS.warm, [0, -1.4, 0.8], 3.1);
    greeting(k, copy, LOOKS.warm, 15, 2.3);
  },
  // 12 June: the flag gathers in the sky (celebrations.mjs FLAG); here the date and the greeting in the
  // colours of the flag.
  russia(k, copy) {
    // Left of the middle: on a wide view the flag hangs right of it.
    k.block(copy.date, LOOKS.tricolour, [-6.5, 5.4, 0.6], 3.8);
    greeting(k, copy, LOOKS.tricolour, 10.6, 2.1, -6.5);
    k.feature('wide-only');
  },
  // 4 November: three interlinked rings, white, blue and red, over the date.
  unity(k, copy) {
    const { THREE } = k;
    const rings = [
      [-2.2, 6.6, 0, C.white, [0.25, 0.35, 0]],
      [2.2, 6.6, 0, C.blue, [-0.25, -0.35, 0]],
      [0, 3.0, 0, C.red, [0.35, 0, Math.PI / 2]]
    ];
    for (const [x, y, z, colour, r] of rings)
      k.add(new THREE.TorusGeometry(2.9, 0.42, 14, 56), colour, [x, y, z], r);
    k.feature('rings');
    k.block(copy.date, LOOKS.tricolour, [0, -1.6, 0.8], 3.3);
    greeting(k, copy, LOOKS.tricolour, 14.6, 2.3);
  },
  // The programmer's day: a monitor with "</>" and 256 on its screen, floating bits around it.
  programmer(k, copy) {
    const { THREE } = k;
    k.add(new THREE.BoxGeometry(10.4, 6.6, 0.6), C.dark, [0, 6.6, 0]);
    k.add(new THREE.BoxGeometry(9.4, 5.6, 0.1), C.screen, [0, 6.6, 0.32]);
    k.add(new THREE.CylinderGeometry(0.5, 0.7, 2.6, 12), C.dark, [0, 2.2, -0.2]);
    k.add(new THREE.BoxGeometry(5.2, 0.3, 2.4), C.dark, [0, 0.9, -0.2]);
    k.feature('monitor');
    k.block('</>', LOOKS.green, [0, 7.6, 0.45], 3.3);
    k.block(copy.date, LOOKS.green, [0, 4.8, 0.45], 1.6);
    // No 3D greeting line above the monitor: the card already says it, and over the overview the line sat
    // half under the card (lead, M18).
    for (let i = 0; i < 12; i++) {
      const a = i * 2.39,
        r = 6.6 + (i % 3) * 0.6;
      k.light(
        new THREE.BoxGeometry(0.42, 0.42, 0.42),
        i % 2 ? G.green : G.cyan,
        [Math.cos(a) * r, 6.6 + Math.sin(a) * r * 0.62, -0.6],
        [a, a * 0.7, 0]
      );
    }
  },
  // New Year: a clock striking midnight (its hands move) over the year in lights.
  newyear(k, copy, moving) {
    const { THREE } = k,
      cy = 7.9;
    k.add(new THREE.CylinderGeometry(3.2, 3.2, 0.45, 48), C.cream, [0, cy, 0], [Math.PI / 2, 0, 0]);
    k.add(new THREE.TorusGeometry(3.3, 0.3, 10, 56), C.gold, [0, cy, 0.12]);
    for (let h = 0; h < 12; h++) {
      const a = (h / 12) * Math.PI * 2;
      k.add(
        new THREE.BoxGeometry(h % 3 ? 0.14 : 0.24, h % 3 ? 0.42 : 0.7, 0.08),
        C.goldDeep,
        [Math.sin(a) * 2.65, cy + Math.cos(a) * 2.65, 0.27],
        [0, 0, -a]
      );
    }
    k.add(new THREE.SphereGeometry(0.62, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), C.gold, [0, cy + 3.5, 0]);
    k.add(k.sphere(8, 6), C.red, [0, cy + 4.25, 0], 0, 0.28);
    k.feature('clock');
    // Twelve gold bulbs round the rim, one per hour: they all flash with each stroke of midnight.
    for (let h = 0; h < 12; h++) {
      const a = (h / 12) * Math.PI * 2;
      k.light(k.sphere(8, 6), G.bulbGold, [Math.sin(a) * 3.85, cy + Math.cos(a) * 3.85, 0.12], 0, 0.17);
    }
    k.feature('hour-bulbs');
    sparkles(
      k,
      [
        [-5.6, cy + 3.8, -0.3, 0.8],
        [5.8, cy + 4.4, -0.3, 0.6],
        [-6.2, cy - 2.2, -0.3, 0.6],
        [6.1, cy - 3, -0.3, 0.9]
      ],
      G.bulbGold,
      0.5
    );
    // The hands, in their own mesh (moving): the hour hand and the minute hand turn about the face's centre.
    moving.add(new THREE.BoxGeometry(0.26, 1.7, 0.08), C.dark, [0, 0.8, 0.36]);
    moving.add(new THREE.BoxGeometry(0.16, 2.45, 0.08), C.dark, [0, 1.15, 0.42], [0, 0, 0], 1, 'minute');
    moving.add(k.sphere(8, 6), C.gold, [0, 0, 0.45], 0, 0.22);
    bulbText(k, copy.date, [0, 2.4, 0.4], 3.2, [G.bulbGold, G.bulbWhite, G.bulbRed, G.bulbGreen, G.bulbBlue]);
    k.feature('year-lights');
    greeting(k, copy, LOOKS.gold, 15.6, 2.3);
  },
  // Christmas: the star of Bethlehem, its long ray pointing down, and small stars.
  christmas(k, copy) {
    // Keep the large star below the HDR bloom threshold; its warm colour still reads at night.
    const glow = [0.78, 0.65, 0.38],
      { THREE } = k,
      long = i => [4.8, 2.5, 3.3, 2.5, 8.8, 2.5, 3.3, 2.5][i];
    k.light(extrude(THREE, starShape(THREE, 8, 4.8, 0.85, long), 0.5, 0.12, 1), glow, [0, 9.8, 0]);
    k.add(
      extrude(
        THREE,
        starShape(THREE, 8, 5.3, 1.15, i => long(i) * 1.12),
        0.2,
        0,
        1
      ),
      C.goldDeep,
      [0, 9.8, -0.45]
    );
    k.light(k.sphere(12, 8), [0.95, 0.84, 0.6], [0, 9.8, 0.4], 0, 1.05);
    k.feature('bethlehem-star');
    sparkles(
      k,
      [
        [-5.4, 11.6, -0.3, 0.8],
        [5.6, 12.1, -0.3, 0.6],
        [-6.4, 6.4, -0.3, 0.6],
        [6.2, 6.8, -0.3, 0.9],
        [-3.8, 3.4, -0.3, 0.5],
        [4.2, 3.2, -0.3, 0.5]
      ],
      glow,
      0.5
    );
    k.block(copy.date, LOOKS.gold, [0, 0.4, 0.8], 2.6);
    greeting(k, copy, LOOKS.gold, 17.2, 2.4);
  },
  // The Old New Year: a big frosty snowflake and the year in ice.
  oldnewyear(k, copy) {
    const { THREE } = k,
      cy = 7.6;
    for (let a = 0; a < 6; a++) {
      const turn = (a * Math.PI) / 3,
        dx = Math.sin(turn),
        dy = Math.cos(turn);
      k.rod(k.glow, [0, cy, 0], [dx * 5.2, cy + dy * 5.2, 0], 0.26, G.ice, 6);
      for (const [r, l] of [
        [2.2, 1.5],
        [3.7, 1.1]
      ])
        for (const side of [-1, 1]) {
          const bx = dx * r,
            by = dy * r,
            t = turn + side * 0.75;
          k.rod(
            k.glow,
            [bx, cy + by, 0],
            [bx + Math.sin(t) * l, cy + by + Math.cos(t) * l, 0],
            0.13,
            G.ice,
            6
          );
        }
    }
    k.light(new THREE.CylinderGeometry(0.9, 0.9, 0.3, 6), G.ice, [0, cy, 0], [Math.PI / 2, 0, 0]);
    k.feature('snowflake');
    k.block(copy.date, LOOKS.ice, [0, 1.2, 0.8], 3.2);
    greeting(k, copy, LOOKS.ice, 17, 2.2);
  },
  // The site's birthday: maserplay.ru itself, a browser window with its address bar and the age as a solid gold
  // number inside, the projects' small windows floating round it in party colours (owner, round 9: no more cake).
  birthday(k, copy, moving, ctx) {
    const { THREE } = k;
    k.add(extrude(THREE, roundedRect(THREE, 10.6, 7.4, 0.7), 0.35, 0.06), C.dark, [0, 4.9, -0.6]);
    k.add(extrude(THREE, roundedFrame(THREE, 11.2, 8, 0.85, 0.34), 0.5, 0.08), C.pink, [0, 4.9, -0.55]);
    k.add(new THREE.BoxGeometry(10.2, 1.05, 0.2), [0.16, 0.1, 0.22], [0, 8.0, -0.05]);
    [G.bulbRed, G.bulbGold, G.bulbGreen].forEach((tone, i) =>
      k.light(k.sphere(8, 6), tone, [-4.55 + i * 0.62, 8.0, 0.1], 0, 0.19)
    );
    k.block('maserplay.ru', LOOKS.white, [0.9, 8.0, 0.15], 0.62);
    k.feature('browser');
    tubeText(k, k.solid, String(ctx.age), [0, 4.3, 0], 4.4, 0.38, C.gold, 12);
    k.feature('age-number');
    const tiles = [C.gold, C.pink, [0.3, 0.75, 1], C.white, [0.55, 0.3, 0.95], [0.25, 0.8, 0.45], C.orange];
    tiles.forEach((tone, i) => {
      const side = i % 2 ? 1 : -1,
        row = Math.floor(i / 2),
        at = [side * (7.1 + (row % 2) * 0.7), 1.6 + row * 2.5, -0.9 + (i % 3) * 0.3];
      k.add(extrude(THREE, roundedRect(THREE, 1.7, 1.15, 0.22), 0.16, 0.03), tone, at, [0, 0, side * 0.12]);
      k.add(new THREE.BoxGeometry(1.4, 0.18, 0.05), C.dark, [at[0], at[1] + 0.36, at[2] + 0.2]);
    });
    k.feature('project-windows');
    sparkles(
      k,
      [
        [-6.6, 9.4, -0.4, 0.8],
        [6.8, 10.2, -0.4, 0.7],
        [0, 10.6, -0.4, 0.6]
      ],
      G.star,
      0.5
    );
    greeting(k, copy, LOOKS.party, 13.4, 2.0);
  },
  // Dima, 9 January: his day, in blue. The maker of maserplay.ru: the site's "М" glowing in a chrome-blue ring,
  // his initial on a silver badge pinned to it, the age as a solid chrome-blue number and sparklers at the front
  // of a blue stage; the New Year stays in the background.
  dima(k, copy, moving, ctx) {
    const { THREE } = k;
    stage(k, 7, C.navy, G.blue, [G.sparkBlue, G.blue]);
    k.add(new THREE.CylinderGeometry(2.45, 2.45, 0.3, 48), C.navy, [-2.6, 4.5, 0.2], [Math.PI / 2, 0, 0]);
    k.add(new THREE.TorusGeometry(2.6, 0.28, 12, 64), C.blue, [-2.6, 4.5, 0.35]);
    tubeText(k, k.glow, 'М', [-2.6, 4.5, 0.5], 2.7, 0.2, G.sparkBlue, 10);
    k.feature('monogram');
    k.add(
      new THREE.CylinderGeometry(0.78, 0.78, 0.2, 32),
      C.silver,
      [-0.75, 6.35, 0.55],
      [Math.PI / 2, 0, 0]
    );
    tubeText(k, k.solid, copy.initial, [-0.75, 6.35, 0.7], 0.95, 0.09, C.navy, 8);
    k.feature('initial');
    tubeText(k, k.solid, String(ctx.age), [3.4, 3.8, -0.4], 5.8, 0.5, C.blue, 14);
    k.feature('age-number');
    for (const x of [-5.6, 5.6]) {
      k.rod(k.solid, [x, 0.1, 2.6], [x, 2.5, 2.6], 0.05, C.silver, 5);
      sparkles(k, [[x, 2.7, 2.6, 1]], G.sparkBlue, 0.5);
    }
    k.feature('sparklers');
    sparkles(
      k,
      [
        [-6.4, 7.4, -0.6, 0.9],
        [6.5, 9.2, -0.6, 0.7],
        [-5.6, 9.8, -0.6, 0.6],
        [0.4, 9.6, -0.6, 0.6]
      ],
      G.sparkBlue,
      0.55
    );
    greeting(k, copy, LOOKS.blue, 13.2, 2.2);
  },
  // Andrey, 25 January: neon. The garden's co-author: one of its floating islands in neon, a rock narrowing to a
  // point under a turf top ringed in lime, a tree with a cyan outline, a warm lantern and a thread of falling
  // water; his initial in lime neon over it, the age in glowing magenta tubes with a cyan shadow line.
  andrey(k, copy, moving, ctx) {
    const { THREE } = k,
      at = [-2.6, 4.0, 0.4];
    stage(k, 7, C.violet, G.magenta, [G.cyan, G.magenta, G.lime]);
    k.light(new THREE.TorusGeometry(6.2, 0.07, 6, 48), G.cyan, [0, 0.05, 0], [Math.PI / 2, 0, 0]);
    const rock = [
      [0.05, -2.9],
      [0.7, -2.2],
      [1.4, -1.3],
      [2.05, -0.55],
      [2.45, -0.12],
      [2.5, 0]
    ].map(([x, y]) => new THREE.Vector2(x, y));
    k.add(new THREE.LatheGeometry(rock, 32), C.violet, at);
    k.add(new THREE.CylinderGeometry(2.5, 2.5, 0.2, 40), [0.04, 0.2, 0.08], [at[0], at[1] + 0.1, at[2]]);
    k.light(
      new THREE.TorusGeometry(2.5, 0.06, 5, 48),
      G.lime,
      [at[0], at[1] + 0.2, at[2]],
      [Math.PI / 2, 0, 0]
    );
    k.add(new THREE.CylinderGeometry(0.12, 0.2, 1.7, 8), C.wood, [at[0] - 0.7, at[1] + 1.05, at[2] - 0.3]);
    k.add(
      k.sphere(12, 9),
      [0.05, 0.3, 0.12],
      [at[0] - 0.7, at[1] + 2.25, at[2] - 0.3],
      0,
      [1.15, 0.95, 1.15]
    );
    k.light(new THREE.TorusGeometry(1.2, 0.045, 4, 40), G.cyan, [at[0] - 0.7, at[1] + 2.25, at[2] + 0.2]);
    k.rod(
      k.solid,
      [at[0] + 1.2, at[1] + 0.2, at[2] + 0.9],
      [at[0] + 1.2, at[1] + 1.4, at[2] + 0.9],
      0.05,
      C.dark,
      5
    );
    k.light(k.sphere(8, 6), G.warm, [at[0] + 1.2, at[1] + 1.6, at[2] + 0.9], 0, 0.24);
    k.rod(
      k.glow,
      [at[0] + 2.35, at[1] + 0.05, at[2] + 0.6],
      [at[0] + 2.2, at[1] - 2.6, at[2] + 0.6],
      0.05,
      G.cyan,
      5
    );
    k.feature('island');
    tubeText(k, k.glow, copy.initial, [at[0], at[1] + 4.7, at[2]], 1.6, 0.12, G.lime, 8);
    k.feature('initial');
    tubeText(k, k.glow, String(ctx.age), [3.4, 3.6, -0.4], 5.8, 0.26, G.magenta, 10);
    tubeText(k, k.glow, String(ctx.age), [3.65, 3.35, -0.8], 5.8, 0.12, G.cyan, 6);
    k.feature('age-number');
    k.feature('neon');
    sparkles(
      k,
      [
        [-6.4, 7.4, -0.6, 0.9],
        [6.6, 9.4, -0.6, 0.7],
        [-5.6, 10.0, -0.6, 0.6],
        [0.2, 9.4, -0.6, 0.6]
      ],
      G.cyan,
      0.55
    );
    greeting(k, copy, LOOKS.neon, 13.2, 2.2);
  }
};
// Which composition an occasion shows (the project birthday celebrates at its pavilion: project-birthdays.mjs).
export const compositionFor = occasion => (occasion && COMPOSITIONS[occasion] ? occasion : null);
// Occasions whose stage throws sparks now and then.
export const SPARKLING = new Set(['birthday', 'dima', 'andrey']);
const INITIALS = { dima: 'Д', andrey: 'А' };

// ---------- the text atlas ----------
// Draws every block into one canvas (a row each) and returns their uv rows and widths in metres.
// Marching-squares edges of the existing alpha atlas, sampled once per composition.
// Interpolated edges preserve counters (holes) and connect front/back without repeated glyph planes.
function appendContourCell(points, values, threshold, segments) {
  const edges = [];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    if (values[i] >= threshold === values[j] >= threshold) continue;
    const t = (threshold - values[i]) / (values[j] - values[i]);
    edges.push([
      points[i][0] + t * (points[j][0] - points[i][0]),
      points[i][1] + t * (points[j][1] - points[i][1])
    ]);
  }
  if (edges.length === 2) segments.push(edges);
  else if (edges.length === 4) {
    const centreInside = values.reduce((a, b) => a + b, 0) / 4 >= threshold;
    if (centreInside === values[0] >= threshold) segments.push([edges[0], edges[1]], [edges[2], edges[3]]);
    else segments.push([edges[0], edges[3]], [edges[1], edges[2]]);
  }
}

export function alphaContour(image, bounds, step = 2) {
  const { data, width, height } = image,
    segments = [],
    threshold = 255 * 0.42;
  const alpha = (x, y) => (x < 0 || y < 0 || x >= width || y >= height ? 0 : data[(y * width + x) * 4 + 3]);
  for (let y = bounds.top; y < bounds.bottom; y += step)
    for (let x = bounds.left; x < bounds.right; x += step) {
      const right = Math.min(x + step, bounds.right),
        bottom = Math.min(y + step, bounds.bottom);
      const points = [
        [x, y],
        [right, y],
        [right, bottom],
        [x, bottom]
      ];
      appendContourCell(
        points,
        points.map(([px, py]) => alpha(px, py)),
        threshold,
        segments
      );
    }
  return segments;
}

export function drawAtlas(canvas, blocks) {
  const rows = Math.max(1, blocks.length),
    W = TEXT.width,
    H = TEXT.row;
  canvas.width = W;
  canvas.height = H * 2 ** Math.ceil(Math.log2(rows));
  const c = paintContext(canvas);
  c.clearRect(0, 0, canvas.width, canvas.height);
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.lineJoin = 'round';
  const atlasRows = blocks.map((block, row) => {
    let font = TEXT.font;
    c.font = `800 ${font}px ${FONT}`;
    let width = c.measureText(block.text).width;
    const room = W - font * 0.5;
    if (width > room) {
      font = Math.floor((font * room) / width);
      c.font = `800 ${font}px ${FONT}`;
      width = c.measureText(block.text).width;
    }
    const top = row * H,
      mid = top + H / 2,
      look = block.look,
      fill = c.createLinearGradient(0, mid - font * 0.45, 0, mid + font * 0.45);
    look.fill.forEach((colour, i) =>
      fill.addColorStop(look.stops?.[i] ?? i / (look.fill.length - 1), colour)
    );
    c.lineWidth = font * 0.16;
    c.strokeStyle = look.stroke;
    c.strokeText(block.text, W / 2, mid);
    c.fillStyle = fill;
    c.fillText(block.text, W / 2, mid);
    const used = Math.min(W, width + font * 0.3);
    return {
      u0: (W - used) / 2 / W,
      u1: (W + used) / 2 / W,
      v0: 1 - (top + H) / canvas.height,
      v1: 1 - top / canvas.height,
      // Metres: the block's height is the em size; its quad keeps the row's aspect.
      width: (block.height * used) / font,
      height: (block.height * H) / font
    };
  });
  const image = c.getImageData(0, 0, canvas.width, canvas.height);
  atlasRows.forEach((row, index) => {
    const top = index * H;
    row.contours = alphaContour(image, {
      left: Math.max(0, Math.floor(row.u0 * W) - 2),
      right: Math.min(W, Math.ceil(row.u1 * W) + 2),
      top,
      bottom: top + H
    }).map(segment =>
      segment.map(([x, y]) => [
        ((x / W - row.u0) / (row.u1 - row.u0) - 0.5) * row.width,
        (0.5 - (y - top) / H) * row.height
      ])
    );
  });
  return atlasRows;
}
// The text mesh: original atlas faces with connected, dark silhouette walls at the same total depth.
export function textGeometry(THREE, blocks, rows) {
  const positions = [],
    uvs = [],
    colours = [];
  blocks.forEach((block, b) => {
    const row = rows[b],
      w = row.width / 2,
      h = row.height / 2;
    for (const layer of [TEXT.layers - 1, 0]) {
      const dx = block.at[0] + TEXT.shift[0] * block.height * layer,
        dy = block.at[1] + TEXT.shift[1] * block.height * layer,
        z = block.at[2] - TEXT.depth * block.height * layer,
        shade = layer ? block.look.side : [1, 1, 1],
        corners = [
          [-w, -h, row.u0, row.v0],
          [w, -h, row.u1, row.v0],
          [w, h, row.u1, row.v1],
          [-w, -h, row.u0, row.v0],
          [w, h, row.u1, row.v1],
          [-w, h, row.u0, row.v1]
        ];
      for (const [x, y, u, v] of corners) {
        positions.push(dx + x, dy + y, z);
        uvs.push(u, v);
        colours.push(...shade);
      }
    }
  });
  const faceCount = positions.length / 3;
  blocks.forEach((block, rowIndex) => {
    const depth = TEXT.depth * block.height * (TEXT.layers - 1);
    const sx = TEXT.shift[0] * block.height * (TEXT.layers - 1),
      sy = TEXT.shift[1] * block.height * (TEXT.layers - 1);
    const vertex = ([x, y], back) => [
      block.at[0] + x + (back ? sx : 0),
      block.at[1] + y + (back ? sy : 0),
      block.at[2] - (back ? depth : 0)
    ];
    for (const [a, b] of rows[rowIndex].contours) {
      const frontA = vertex(a, false),
        frontB = vertex(b, false),
        backA = vertex(a, true),
        backB = vertex(b, true);
      for (const point of [frontA, frontB, backB, frontA, backB, backA]) {
        positions.push(...point);
        uvs.push(0, 0);
        colours.push(...block.look.side);
      }
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geometry.addGroup(0, faceCount, 0);
  geometry.addGroup(faceCount, positions.length / 3 - faceCount, 1);
  geometry.computeBoundingSphere();
  return geometry;
}

// Lit parts keep a share of their own colour as emission (uniform uGlow), so they read at night too.
function litMaterial(THREE) {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.42,
    metalness: 0.12,
    fog: false,
    side: THREE.DoubleSide
  });
  const glow = { value: STAGE.glowDay };
  material.onBeforeCompile = shader => {
    shader.uniforms.uGlow = glow;
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform float uGlow;\nvoid main() {')
      .replace(
        'vec3 totalEmissiveRadiance = emissive;',
        'vec3 totalEmissiveRadiance = emissive + vColor.rgb * uGlow;'
      );
  };
  material.customProgramCacheKey = () => 'celebration-stage-lit';
  material.userData.glow = glow;
  return material;
}

// Builds the composition of an occasion: { group, meshes, features, triangles, moving, ... } (no document: no
// text). ctx: { copy, age, initial }.
export function buildComposition(THREE, occasion, ctx, { document = globalThis.document } = {}) {
  const build = COMPOSITIONS[compositionFor(occasion)];
  if (!build) return null;
  const k = kit(THREE),
    moving = { solid: [], glow: [], minute: [] },
    movingKit = {
      add: (geometry, colour, p, r, s, part) => {
        const list = part === 'minute' ? moving.minute : moving.solid;
        k.add(geometry, colour, p, r, s);
        list.push(k.solid.pop());
      },
      light: (geometry, colour, p, r, s) => {
        k.light(geometry, colour, p, r, s);
        moving.glow.push(k.glow.pop());
      }
    };
  build(k, { ...ctx.copy, initial: ctx.initial }, movingKit, ctx);
  const group = new THREE.Group();
  group.name = 'celebration-composition';
  group.userData.dynamic = true;
  const lit = litMaterial(THREE),
    glowMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: false }),
    materials = [lit, glowMaterial],
    meshes = [];
  const mesh = (parts, material, name) => {
    if (!parts.length) return null;
    const m = new THREE.Mesh(merge(THREE, parts), material);
    m.name = name;
    m.frustumCulled = false;
    m.renderOrder = 2;
    group.add(m);
    meshes.push(m);
    return m;
  };
  mesh(k.solid, lit, 'composition-solid');
  mesh(k.glow, glowMaterial, 'composition-glow');
  // Moving parts: Vostok (it circles the orbit) or the clock's hands (they turn about the clock's centre).
  const mover = new THREE.Group(),
    minute = new THREE.Group();
  mover.name = 'composition-moving';
  group.add(mover);
  for (const [parts, material, parent] of [
    [moving.solid, lit, mover],
    [moving.glow, glowMaterial, mover],
    [moving.minute, lit, minute]
  ]) {
    const m = mesh(parts, material, 'composition-part');
    if (m) parent.add(m);
  }
  if (moving.minute.length) mover.add(minute);
  let texture = null;
  if (k.text.length && document?.createElement) {
    const canvas = document.createElement('canvas'),
      rows = drawAtlas(canvas, k.text);
    texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      vertexColors: true,
      alphaTest: 0.42,
      toneMapped: false,
      fog: false,
      side: THREE.DoubleSide
    });
    const sides = new THREE.MeshBasicMaterial({
      vertexColors: true,
      toneMapped: false,
      fog: false,
      side: THREE.DoubleSide
    });
    materials.push(material, sides);
    const text = new THREE.Mesh(textGeometry(THREE, k.text, rows), [material, sides]);
    text.name = 'composition-text';
    text.frustumCulled = false;
    text.renderOrder = 3;
    group.add(text);
    meshes.push(text);
  }
  const triangles = meshes.reduce((sum, m) => sum + m.geometry.attributes.position.count / 3, 0);
  return {
    group,
    meshes,
    mover,
    minute,
    lit,
    materials,
    features: [...k.names],
    // Russia Day: on a narrow view the flag hangs in the middle, so the composition stays out of its way.
    wideOnly: k.names.has('wide-only'),
    blocks: k.text.map(b => b.text),
    triangles,
    dispose() {
      group.removeFromParent();
      for (const m of meshes) m.geometry.dispose();
      for (const material of materials) material.dispose();
      texture?.dispose();
    }
  };
}

// A project's birthday at its pavilion (project-birthdays.mjs): a small party cake with a candle per year
// (at most 9) and the age as a solid gold number beside it, about `PROJECT_CAKE.height` m tall, in the pavilion's
// frame (front towards -z, so it is built turned round).
export const PROJECT_CAKE = { height: 3.2 };
// A project's own birthday emblem over its house (owner, round 9: every project had the same cake, gift and flat
// balloons). A medallion in the project's colour with its icon on the face and a gold rim, two ribbon tails, the
// age as a solid gold number beside it and three round balloons (the project's colour, gold, white) tied to the
// rim. icon: an image or canvas the page may draw (prepareIdentity checked it), or null for a plain medallion.
// Built facing +z and turned to the house front (-z) like the cake; `lit` takes the day/night glow.
export const EMBLEM = { radius: 1.35, number: 2.3, balloon: [0.55, 0.68, 0.55] };
export function buildProjectEmblem(
  THREE,
  { age = 1, accent = '#a895e5', icon = null, document = globalThis.document } = {}
) {
  const k = kit(THREE),
    years = Math.max(1, age | 0),
    tint = new THREE.Color(accent),
    colour = [tint.r, tint.g, tint.b],
    R = EMBLEM.radius;
  k.add(new THREE.CylinderGeometry(R, R, 0.24, 48), colour, [0, 0, 0], [Math.PI / 2, 0, 0]);
  k.add(new THREE.TorusGeometry(R, 0.11, 10, 64), C.gold, [0, 0, 0.02]);
  for (const side of [-1, 1]) {
    const tail = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.35, -R + 0.1, 0.05),
      new THREE.Vector3(side * 0.75, -R - 0.7, 0.15),
      new THREE.Vector3(side * 0.55, -R - 1.4, 0.05),
      new THREE.Vector3(side * 0.95, -R - 2.0, 0.1)
    ]);
    k.add(new THREE.TubeGeometry(tail, 20, 0.08, 6), side < 0 ? colour : C.gold);
  }
  tubeText(
    k,
    k.solid,
    String(years),
    [R + 0.35 + EMBLEM.number * 0.3, -0.25, 0],
    EMBLEM.number,
    0.2,
    C.gold,
    10
  );
  // The balloons ride at the medallion's upper left, tied to the rim (higher ones left the view close by).
  const tie = [-R * 0.72, R * 0.72, 0];
  [
    [[-R - 1.05, R + 0.35, -0.2], colour],
    [[-R - 0.1, R + 1.15, 0.15], C.gold],
    [[-R - 1.6, R + 1.35, -0.05], C.white]
  ].forEach(([at, tone]) => {
    const [bx, by, bz] = at,
      [sx, sy] = EMBLEM.balloon;
    k.add(k.sphere(18, 14), tone, at, 0, EMBLEM.balloon);
    k.add(new THREE.ConeGeometry(0.09, 0.16, 8), tone, [bx, by - sy - 0.05, bz], [Math.PI, 0, 0]);
    k.rod(k.solid, [bx, by - sy - 0.12, bz], tie, 0.013, C.silver, 4);
    // A soft highlight on each balloon.
    k.light(k.sphere(8, 6), [1.6, 1.55, 1.5], [bx - sx * 0.35, by + sy * 0.38, bz + sx * 0.72], 0, 0.1);
  });
  const group = new THREE.Group(),
    lit = litMaterial(THREE),
    glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: false }),
    meshes = [new THREE.Mesh(merge(THREE, k.solid), lit), new THREE.Mesh(merge(THREE, k.glow), glow)];
  // The face: the project's icon clipped to a circle on a light ground, unlit so it reads by day and by night.
  let faceTexture = null,
    faceMaterial = null;
  if (icon && document?.createElement) {
    const canvas = document.createElement('canvas'),
      size = 256,
      c = paintContext(canvas);
    canvas.width = canvas.height = size;
    // A ground in the project's colour, deeper towards the rim: light and dark icons both read on it, and it
    // stays below the glow threshold (a white ground bloomed into a blank disc at sunset).
    const ground = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2),
      deep = tint.clone().multiplyScalar(0.35),
      mid = tint.clone().multiplyScalar(0.7);
    ground.addColorStop(0, '#' + mid.getHexString(THREE.SRGBColorSpace));
    ground.addColorStop(1, '#' + deep.getHexString(THREE.SRGBColorSpace));
    c.fillStyle = ground;
    c.beginPath();
    c.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    c.fill();
    c.save();
    c.clip();
    c.drawImage(icon, size * 0.17, size * 0.17, size * 0.66, size * 0.66);
    c.restore();
    faceTexture = new THREE.CanvasTexture(canvas);
    faceTexture.colorSpace = THREE.SRGBColorSpace;
    faceMaterial = new THREE.MeshBasicMaterial({ map: faceTexture, toneMapped: false, fog: false });
    const face = new THREE.Mesh(new THREE.CircleGeometry(R * 0.8, 48), faceMaterial);
    face.position.z = 0.125;
    meshes.push(face);
  }
  group.name = 'project-emblem';
  group.rotation.y = Math.PI;
  group.add(...meshes);
  lit.userData.glow.value = 0.35;
  return {
    group,
    lit,
    triangles: meshes.reduce((sum, m) => sum + m.geometry.attributes.position.count / 3, 0),
    dispose() {
      group.removeFromParent();
      for (const m of meshes) m.geometry.dispose();
      lit.dispose();
      glow.dispose();
      faceMaterial?.dispose();
      faceTexture?.dispose();
    }
  };
}

// The stage over the central island: setOccasion builds the day's composition; update turns it to the camera,
// scales it with the distance and runs its small animations.
export function createCelebrationStage(
  THREE,
  {
    document = globalThis.document,
    labels = {},
    locale = 'ru',
    random = Math.random,
    onWake = null,
    setTimer = setTimeout,
    clearTimer = clearTimeout
  } = {}
) {
  let scene = null,
    current = null,
    occasion = null,
    fireworks = null,
    yaw = null,
    sparkAt = Infinity,
    sparks = 0,
    lastNow = null,
    shownAt = null,
    fadeTimer = null,
    fadeGeneration = 0,
    lastStroke = -1;
  const anchor = new THREE.Vector3(...STAGE.fallback),
    spot = new THREE.Vector3(),
    sparkSpots = [
      [-4.6, 0.6, 1.2],
      [4.6, 0.6, 1.2],
      [0, 0.4, 3.8]
    ];
  function place(world) {
    const portal = world?.portalGeometry;
    if (portal?.center && portal.normal)
      anchor.set(
        portal.center.x + portal.normal.x * STAGE.forward,
        portal.center.y + STAGE.lift,
        portal.center.z + portal.normal.z * STAGE.forward
      );
  }
  function build(date = new Date(), party = []) {
    current?.dispose();
    current = null;
    yaw = null;
    const key = compositionFor(occasion);
    if (!key || !scene) return;
    const copy = stageCopy(occasion, labels, date, locale, party),
      age =
        occasion === 'dima' || occasion === 'andrey'
          ? personAge(occasion, date)
          : occasion === 'birthday'
            ? siteAge(date)
            : 0,
      // The creators' initial: the first letter of their name in the sky words.
      name = labels['celebrate' + key.charAt(0).toUpperCase() + key.slice(1) + 'Sky'] || INITIALS[key] || '',
      initial = [...String(name)][0]?.toUpperCase() || '';
    current = buildComposition(THREE, occasion, { copy, age, initial }, { document });
    current.group.position.copy(anchor);
    scene.add(current.group);
    sparkAt = SPARKLING.has(occasion) && lastNow !== null ? lastNow + STAGE.sparkFirst * 1000 : Infinity;
  }
  // allocation-free:start (runs every frame)
  function update(now, camera, day = 1, motion = 1) {
    const dt = lastNow === null ? 0 : Math.min(0.1, Math.max(0, (now - lastNow) / 1000));
    if (lastNow === null && SPARKLING.has(occasion)) sparkAt = now + STAGE.sparkFirst * 1000;
    lastNow = now;
    if (!current || !camera) return;
    if (shownAt === null) {
      shownAt = now;
      if (onWake) {
        const generation = fadeGeneration;
        fadeTimer = setTimer(() => {
          if (generation !== fadeGeneration) return;
          fadeTimer = null;
          onWake();
        }, 59000);
      }
    }
    // Fade the composition independently of the fireworks.
    const opacity = Math.max(0, Math.min(1, (60000 - (now - shownAt)) / 1000));
    for (const material of current.materials) {
      if (opacity < 1 && !material.transparent) {
        material.transparent = true;
        material.depthWrite = false;
        material.needsUpdate = true;
      }
      material.opacity = opacity;
      if (material.map) material.alphaTest = 0.42 * opacity;
    }
    if (onWake && now - shownAt >= 59000 && opacity > 0) onWake();
    const group = current.group,
      dx = camera.position.x - anchor.x,
      dz = camera.position.z - anchor.z,
      distance = Math.hypot(dx, camera.position.y - anchor.y, dz),
      goal = Math.atan2(dx, dz);
    if (yaw === null || !motion) yaw = goal;
    else {
      let turn = goal - yaw;
      turn -= Math.round(turn / (Math.PI * 2)) * Math.PI * 2;
      yaw += turn * Math.min(1, dt * STAGE.turn);
    }
    group.rotation.y = yaw;
    group.visible = opacity > 0 && (!current.wideOnly || camera.aspect >= 1);
    const scale = Math.min(STAGE.maxScale, Math.max(STAGE.minScale, distance / STAGE.distance));
    group.scale.setScalar(scale);
    group.position.set(
      anchor.x,
      anchor.y + Math.sin(now * STAGE.bobSpeed) * STAGE.bob * motion * scale,
      anchor.z
    );
    current.lit.userData.glow.value = STAGE.glowNight + (STAGE.glowDay - STAGE.glowNight) * day;
    if (occasion === 'cosmonautics') {
      // Vostok circles the tilted orbit (the torus turned by [1.2, 0, 0.32]) once in 24 s.
      // Euler XYZ turns the ring about z first, then about x.
      const a = motion ? now * 0.00026 : 0.6,
        x = Math.cos(a) * 6.2,
        y = Math.sin(a) * 6.2,
        x1 = x * Math.cos(0.32) - y * Math.sin(0.32),
        y1 = x * Math.sin(0.32) + y * Math.cos(0.32);
      current.mover.position.set(x1, 6.4 + y1 * Math.cos(1.2), y1 * Math.sin(1.2));
      current.mover.rotation.set(0, a, 0.32);
    } else if (occasion === 'newyear') {
      // The hands sweep up to midnight over 10 s, hold 6 s while the clock strikes, and start again.
      const t = motion ? (now / 1000) % 16 : 10,
        left = Math.max(0, 1 - t / 10);
      current.mover.position.set(0, 7.9, 0);
      current.mover.rotation.z = left * 0.35;
      current.minute.rotation.z = left * 2.1;
      // Twelve strokes, one every half second from midnight: each flashes the lights and dies down, and
      // the first, the middle and the last throw the salute (a spark fountain over the clock).
      const since = t - CHIME.start,
        stroke = Math.floor(since / CHIME.gap);
      if (motion && since >= 0 && stroke < CHIME.strokes) {
        current.lit.userData.glow.value +=
          CHIME.flash * (stroke ? 0.7 : 1) * Math.exp(-(since - stroke * CHIME.gap) * CHIME.decay);
        const id = Math.floor(now / 16000) * CHIME.strokes + stroke;
        if (id !== lastStroke) {
          lastStroke = id;
          if (group.visible && fireworks?.sparkle && CHIME.salute.includes(stroke)) {
            const s = CHIME.spots[CHIME.salute.indexOf(stroke)];
            spot.set(s[0], s[1], s[2]);
            group.localToWorld(spot);
            fireworks.sparkle(spot.x, spot.y, spot.z, scale, STAGE_SPARKS.newyear);
            sparks++;
          }
        }
      }
    }
    // Sparks and confetti come from the composition: once it has faded (or is hidden on a narrow screen) the
    // place stays quiet (owner, round 9: confetti kept falling where the New Year clock had been).
    if (now >= sparkAt) {
      sparkAt = now + (STAGE.sparkEvery[0] + random() * (STAGE.sparkEvery[1] - STAGE.sparkEvery[0])) * 1000;
      if (motion && group.visible && fireworks?.sparkle) {
        const s = sparkSpots[sparks % sparkSpots.length];
        spot.set(s[0], s[1], s[2]);
        group.localToWorld(spot);
        fireworks.sparkle(spot.x, spot.y, spot.z, scale, STAGE_SPARKS[occasion] || STAGE_SPARKS.birthday);
        sparks++;
      }
    }
  }
  // allocation-free:end
  return {
    // Into each rebuilt world scene; the anchor follows its portal. `show`: the fireworks (for the sparks).
    attach(target, world, show = null) {
      scene = target;
      fireworks = show;
      place(world);
      if (current) {
        current.group.position.copy(anchor);
        if (current.group.parent !== scene) scene.add(current.group);
      }
    },
    setOccasion(key, party = [], date = new Date()) {
      fadeGeneration++;
      if (fadeTimer !== null) clearTimer(fadeTimer);
      fadeTimer = null;
      occasion = key || null;
      shownAt = null;
      build(date, party);
    },
    update,
    get anchor() {
      return anchor;
    },
    get composition() {
      return current;
    },
    audit: () => ({
      occasion,
      composition: compositionFor(occasion),
      features: current?.features ?? [],
      blocks: current?.blocks ?? [],
      triangles: current?.triangles ?? 0,
      meshes: current?.meshes.length ?? 0,
      anchor: anchor.toArray(),
      scale: current?.group.scale.x ?? 0,
      yaw,
      sparks
    }),
    dispose() {
      fadeGeneration++;
      if (fadeTimer !== null) clearTimer(fadeTimer);
      fadeTimer = null;
      current?.dispose();
      current = null;
    }
  };
}
