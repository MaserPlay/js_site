// Hanging vines under the island lips (owner M18: the old fern-frond cards read as stuck-on pictures).
// A painted atlas of leafy stem sprigs: thin stems with alternate leaves of varied size, drooping tips,
// tendrils, small flower clusters, roots and grass tufts. Cards follow each strand's curved path, so the
// painted stems join into one hanging stem; a thin ribbon carries the stem across the lip and any gaps.
// The atlas stores data, not colour: R shading, G per-leaf pick, B part type (leaf, stem, flower, snow).
// The shader colours it per season (spring flowers, deep summer green, mixed autumn, bare winter stems).
import { parkMillerStream } from './seeded-random.mjs';
import { DRAPE } from './vine-drape.mjs';
import { foliageDaylight } from './realistic-foliage.mjs';
import { paintContext } from './paint-canvas.mjs';

export const VINE_ATLAS = { size: 1024, sprite: [128, 512], columns: 8 };
// Sprite slots in the atlas.
export const VINE_SPRITES = {
  segments: [0, 1, 2, 3, 4, 5, 15],
  tips: [6, 7, 8],
  flowerSegments: [9, 10],
  flowerTips: [11],
  roots: 12,
  tuft: 13,
  stem: 14
};
// B channel part codes; the shader splits them at 0.17 / 0.5 / 0.83.
const PART = { leaf: 0, stem: 85, flower: 170, snow: 255 };

const code = (r, g, part) =>
  `rgb(${Math.round(Math.min(1, Math.max(0, r)) * 255)},${Math.round(Math.min(1, Math.max(0, g)) * 255)},${part})`;

function spriteOrigin(index) {
  const [w, h] = VINE_ATLAS.sprite;
  return [(index % VINE_ATLAS.columns) * w, Math.floor(index / VINE_ATLAS.columns) * h];
}

// One leaf blade along local +x from its petiole end; the gradient across it reads as a cupped blade.
function paintLeaf(context, x, y, angle, length, width, pick, random) {
  context.save();
  context.translate(x, y);
  context.rotate(angle);
  const droop = width * (random() - 0.3) * 0.8,
    gradient = context.createLinearGradient(0, -width, 0, width);
  gradient.addColorStop(0, code(0.5, pick, PART.leaf));
  gradient.addColorStop(0.42, code(0.97, pick, PART.leaf));
  gradient.addColorStop(0.5, code(0.72, pick, PART.leaf));
  gradient.addColorStop(0.6, code(0.86, pick, PART.leaf));
  gradient.addColorStop(1, code(0.45, pick, PART.leaf));
  context.fillStyle = gradient;
  context.beginPath();
  context.moveTo(0, 0);
  context.bezierCurveTo(length * 0.2, -width * 1.05, length * 0.72, -width * 0.8, length, droop);
  context.bezierCurveTo(length * 0.7, width * 0.85, length * 0.18, width * 1.05, 0, 0);
  context.fill();
  context.strokeStyle = code(0.42, pick, PART.leaf);
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(1, 0);
  context.quadraticCurveTo(length * 0.5, droop * 0.3, length * 0.88, droop * 0.85);
  context.stroke();
  context.restore();
}

function stroke(context, points, from, to, tone, pick, part = PART.stem) {
  for (let i = 1; i < points.length; i++) {
    context.strokeStyle = code(tone, pick, part);
    context.lineWidth = from + ((to - from) * i) / points.length;
    context.beginPath();
    context.moveTo(points[i - 1][0], points[i - 1][1]);
    context.lineTo(points[i][0], points[i][1]);
    context.stroke();
  }
}

// A stem segment (or a drooping tip) with alternate leaves; flowering sprigs carry small clusters.
function paintSprig(context, index, { tip = false, flowers = false, leaf = 1, seed = index + 1 }) {
  const random = parkMillerStream(seed * 7919 + 13),
    [ox, oy] = spriteOrigin(index),
    [w, h] = VINE_ATLAS.sprite,
    cx = ox + w / 2,
    end = tip ? 0.8 + 0.08 * random() : 1,
    phase = random() * 6.28,
    waves = 1 + random() * 1.5,
    curl = (random() < 0.5 ? -1 : 1) * (14 + 12 * random()),
    stemX = t =>
      cx +
      6 * Math.sin(Math.PI * Math.min(1, t)) * Math.sin(t * Math.PI * 2 * waves + phase) +
      (tip ? curl * Math.max(0, (t - end * 0.7) / (end * 0.3)) ** 2 : 0),
    stemY = t => oy + 4 + t * (h - 8),
    stem = [];
  for (let k = 0; k <= 40; k++) stem.push([stemX((k / 40) * end), stemY((k / 40) * end)]);
  const nodes = [];
  let side = random() < 0.5 ? -1 : 1;
  for (let t = 0.02 + random() * 0.05; t < end - 0.02; t += (25 + 12 * random()) / h) {
    nodes.push({ t, side });
    side = -side;
  }
  for (const node of nodes) {
    const x = stemX(node.t),
      y = stemY(node.t),
      shrink = tip ? 1 - 0.62 * (node.t / end) : 1,
      length = (40 + 22 * random()) * leaf * shrink,
      width = length * (0.3 + 0.12 * random()),
      // Hanging leaves point down and out, varied per node.
      angle = Math.PI / 2 - node.side * (0.55 + 0.6 * random()),
      reach = 4 + 4 * random(),
      bx = x + Math.cos(angle) * reach,
      by = y + Math.sin(angle) * reach;
    paintLeaf(context, bx, by, angle, length, width, random(), random);
    node.petiole = [x, y, bx, by];
    // A smaller second leaf now and then, as on a real shoot.
    if (random() < 0.5)
      paintLeaf(context, bx, by, angle + node.side * 0.5, length * 0.55, width * 0.55, random(), random);
  }
  stroke(context, stem, 2.6, tip ? 1.1 : 2.2, 0.82, 0.8);
  // A lighter side gives the stem a round look.
  context.save();
  context.translate(-1, 0);
  stroke(context, stem, 1.2, 0.6, 1, 0.55);
  context.restore();
  for (const node of nodes) {
    const [x, y, bx, by] = node.petiole;
    stroke(
      context,
      [
        [x, y],
        [bx, by]
      ],
      1.6,
      1.6,
      0.7,
      0.6
    );
    // Tendrils: a thin stalk ending in a small curl.
    if (!flowers && random() < 0.22) {
      const out = -node.side,
        points = [[x, y]];
      let a = Math.PI / 2 + out * 1.1,
        px = x,
        py = y,
        step = 3.2;
      for (let k = 0; k < 18; k++) {
        if (k > 6) a += out * 0.55;
        step *= k > 6 ? 0.9 : 1;
        px += Math.cos(a) * step;
        py += Math.sin(a) * step;
        points.push([px, py]);
      }
      stroke(context, points, 1.2, 0.8, 0.85, 0.75);
    }
    // Flower clusters (not rings): a short stalk with three to six small five-petal flowers.
    if (flowers && random() < 0.75) {
      const pick = random(),
        sx = x - node.side * (8 + 6 * random()),
        sy = y + 8 + 6 * random();
      stroke(
        context,
        [
          [x, y],
          [sx, sy]
        ],
        1.4,
        1,
        0.7,
        0.6
      );
      const count = 3 + Math.floor(random() * 4);
      for (let f = 0; f < count; f++) {
        const fx = sx + (random() - 0.5) * 26,
          fy = sy + (random() - 0.3) * 24,
          size = 6 + 3 * random(),
          turn = random() * 6.28;
        for (let p = 0; p < 5; p++) {
          const a = turn + (p / 5) * Math.PI * 2;
          context.fillStyle = code(0.78 + 0.22 * random(), pick, PART.flower);
          context.beginPath();
          context.ellipse(
            fx + Math.cos(a) * size * 0.6,
            fy + Math.sin(a) * size * 0.6,
            size * 0.62,
            size * 0.4,
            a,
            0,
            Math.PI * 2
          );
          context.fill();
        }
        context.fillStyle = code(0.1, pick, PART.flower);
        context.beginPath();
        context.arc(fx, fy, size * 0.3, 0, Math.PI * 2);
        context.fill();
      }
    }
  }
  // Winter only: a little snow caught on the leaf nodes.
  for (const node of nodes) {
    const [x, y] = node.petiole;
    context.fillStyle = code(1, 0, PART.snow);
    context.beginPath();
    context.ellipse(x + node.side * 1.5, y - 2, 4.2, 2.6, 0, 0, Math.PI * 2);
    context.fill();
  }
}

// Fine roots hanging out of the soil band under the turf.
function paintRoots(context, index) {
  const random = parkMillerStream(4211),
    [ox, oy] = spriteOrigin(index),
    [w, h] = VINE_ATLAS.sprite;
  for (let r = 0; r < 9; r++) {
    let x = ox + w / 2 + (random() - 0.5) * 80,
      y = oy + 2 + random() * 8,
      a = Math.PI / 2 + (random() - 0.5) * 0.4;
    const length = 150 + random() * (h - 170),
      points = [[x, y]],
      tone = 0.5 + 0.35 * random();
    for (let k = 0; k < 24; k++) {
      a += (random() - 0.5) * 0.35 + (Math.PI / 2 - a) * 0.08;
      x += (Math.cos(a) * length) / 24;
      y += (Math.sin(a) * length) / 24;
      points.push([Math.min(ox + w - 3, Math.max(ox + 3, x)), Math.min(oy + h - 3, y)]);
    }
    stroke(context, points, 2.8, 0.6, tone, 0.05);
  }
}

// Grass blades arching over the turf edge and hanging down.
function paintTuft(context, index) {
  const random = parkMillerStream(977),
    [ox, oy] = spriteOrigin(index),
    w = VINE_ATLAS.sprite[0];
  for (let b = 0; b < 34; b++) {
    const bx = ox + w / 2 + (random() - 0.5) * 70,
      by = oy + 3 + random() * 10,
      out = random() < 0.5 ? -1 : 1,
      spread = 10 + random() * 40,
      length = 50 + random() * 140,
      points = [];
    for (let k = 0; k <= 12; k++) {
      const t = k / 12;
      points.push([
        Math.min(ox + w - 3, Math.max(ox + 3, bx + out * spread * Math.sin(t * 1.6))),
        by + length * t * t * 0.9 + length * 0.1 * t
      ]);
    }
    stroke(context, points, 2.6, 0.7, 0.6 + 0.4 * random(), 0.05 + 0.2 * random(), PART.leaf);
  }
}

// Solid stem bark for the ribbons, shaded across its width.
function paintStemPatch(context, index) {
  const [ox, oy] = spriteOrigin(index),
    [w, h] = VINE_ATLAS.sprite,
    gradient = context.createLinearGradient(ox, 0, ox + w, 0);
  gradient.addColorStop(0, code(0.45, 0.55, PART.stem));
  gradient.addColorStop(0.4, code(0.95, 0.55, PART.stem));
  gradient.addColorStop(1, code(0.5, 0.55, PART.stem));
  context.fillStyle = gradient;
  context.fillRect(ox, oy, w, h);
}

export function paintVineAtlas(context) {
  context.clearRect(0, 0, VINE_ATLAS.size, VINE_ATLAS.size);
  context.lineCap = 'round';
  context.lineJoin = 'round';
  VINE_SPRITES.segments.forEach((index, k) =>
    paintSprig(context, index, { leaf: [1, 0.9, 1.1, 0.8, 1, 1.15, 0.7][k] })
  );
  VINE_SPRITES.tips.forEach(index => paintSprig(context, index, { tip: true }));
  VINE_SPRITES.flowerSegments.forEach(index => paintSprig(context, index, { flowers: true, leaf: 0.9 }));
  VINE_SPRITES.flowerTips.forEach(index => paintSprig(context, index, { tip: true, flowers: true }));
  paintRoots(context, VINE_SPRITES.roots);
  paintTuft(context, VINE_SPRITES.tuft);
  paintStemPatch(context, VINE_SPRITES.stem);
}

export function createVineAtlasTexture(THREE, createCanvas = () => document.createElement('canvas')) {
  const canvas = createCanvas();
  canvas.width = canvas.height = VINE_ATLAS.size;
  paintVineAtlas(paintContext(canvas));
  const texture = new THREE.CanvasTexture(canvas);
  // Data channels: no colour-space conversion.
  texture.colorSpace = THREE.NoColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// UV of a point inside a sprite: across 0..1 (left to right), along 0..1 (top to bottom), within band [v0, v1].
function spriteUV(index, across, along, band = [0, 1]) {
  const [ox, oy] = spriteOrigin(index),
    [w, h] = VINE_ATLAS.sprite,
    size = VINE_ATLAS.size,
    y = oy + 2 + (band[0] + (band[1] - band[0]) * along) * (h - 4);
  return [(ox + 2 + across * (w - 4)) / size, 1 - y / size];
}

/**
 * One curtain: strands [x, z, length, flowering] hang from the anchor (lip top, local origin) along -Y,
 * first arching out over the turf edge (+Z). Built 4 m long; instances stretch only the strand layout
 * (y scale / x scale), the shader keeps every card at its real size. Roots and a grass tuft sit at the lip.
 * follow: every vertex carries its strand index so the shader can lay the curtain along a cliff (vine-drape.mjs);
 * false marks the curtain as free hanging (-1), e.g. a weeping twig. userData.strandPaths keeps each strand's
 * straight hang (x, y, z from the top) for planning that drape. lip: false leaves out the soil roots and the grass tuft
 * (a twig has neither). lite: the medium graphics' curtain, about half the triangles: no stem ribbon (the cards
 * overlap along it) and no second card layer; it draws the same random numbers, so every strand hangs where the
 * full curtain's does and the same drape fits it.
 */
export function createHangingVine(
  THREE,
  {
    strands,
    seed = 5,
    cardLength = 0.85,
    cardWidth = 0.34,
    spacing = 0.72,
    ribbon = 0.016,
    lipDepth = 0.2,
    layered = 0.7,
    follow = true,
    lip = true,
    lite = false
  }
) {
  const random = parkMillerStream(seed),
    positions = [],
    normals = [],
    uvs = [],
    colors = [],
    nodes = [],
    sways = [],
    strandIds = [],
    paths = [],
    indices = [];
  const out = new THREE.Vector3(0, 0, 1),
    side = new THREE.Vector3(),
    point = new THREE.Vector3(),
    normal = new THREE.Vector3();
  const pick = list => list[Math.floor(random() * list.length)];
  let strandId = 0;
  // rows: [{point, side, sway}] from top to bottom, two columns each.
  function card(rows, sprite, node, shade, band) {
    const first = positions.length / 3;
    rows.forEach((row, r) => {
      for (const c of [0, 1]) {
        point.copy(row.point).addScaledVector(row.side, (c - 0.5) * row.width);
        positions.push(point.x, point.y, point.z);
        // Out of the cliff and a little up, rounded across the card: both faces light alike.
        normal
          .copy(out)
          .addScaledVector(row.side, (c - 0.5) * 0.5)
          .add({ x: 0, y: 0.45, z: 0 })
          .normalize();
        normals.push(normal.x, normal.y, normal.z);
        uvs.push(...spriteUV(sprite, c, r / (rows.length - 1), band));
        colors.push(shade, shade, shade);
        nodes.push(node.x, node.y, node.z);
        sways.push(row.sway);
        strandIds.push(follow ? strandId : -1);
      }
      if (r)
        indices.push(
          first + (r - 1) * 2,
          first + r * 2,
          first + (r - 1) * 2 + 1,
          first + (r - 1) * 2 + 1,
          first + r * 2,
          first + r * 2 + 1
        );
    });
  }
  const sideAt = (tangent, yaw) =>
    side.crossVectors(tangent, out).normalize().applyAxisAngle(tangent, yaw).clone();
  strands.forEach(([x, z, length, flowering], s) => {
    strandId = s;
    const wave = 0.05 + 0.07 * random(),
      phase = random() * 6.28,
      hook = random() < 0.5 ? -1 : 1,
      points = [
        new THREE.Vector3(x, 0.02, z - 0.06),
        new THREE.Vector3(x, -0.03, z + 0.1),
        new THREE.Vector3(x, -0.2, z + 0.2)
      ];
    for (let d = 0.6; d < length - 0.35; d += 0.55)
      points.push(new THREE.Vector3(x + wave * Math.sin(d * 1.7 + phase), -d, z + 0.2 + 0.035 * d));
    // A drooping tip that hooks a little out and aside.
    points.push(new THREE.Vector3(x + 0.1 * hook, -length, z + 0.3 + 0.035 * length));
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal'),
      total = curve.getLength(),
      at = s => curve.getPointAt(Math.min(1, Math.max(0, s / total))),
      tangentAt = s => curve.getTangentAt(Math.min(1, Math.max(0, s / total)));
    // The straight hang, from the top: what the cliff drape is measured from.
    const path = { x: [], y: [], z: [] };
    for (let k = 0; k <= 48; k++) {
      const p = curve.getPointAt(k / 48);
      path.x.push(+p.x.toFixed(4));
      path.y.push(+p.y.toFixed(4));
      path.z.push(+p.z.toFixed(4));
    }
    paths.push(path);
    // Stem ribbon over the whole strand, facing out, tapering to the tip (not in the lite curtain).
    const segments = Math.max(3, Math.ceil(total / 0.8)),
      first = positions.length / 3;
    for (let k = 0; !lite && k <= segments; k++) {
      const s = (k / segments) * total,
        p = at(s),
        across = sideAt(tangentAt(s), 0),
        // Tapering to a point: a blunt end read as a cut stem sticking out at close range (owner, round 5).
        width = ribbon * (1 - 0.92 * (k / segments));
      for (const c of [0, 1]) {
        point.copy(p).addScaledVector(across, (c - 0.5) * width);
        positions.push(point.x, point.y, point.z);
        normal.copy(out).add({ x: 0, y: 0.45, z: 0 }).normalize();
        normals.push(normal.x, normal.y, normal.z);
        uvs.push(...spriteUV(VINE_SPRITES.stem, 0.25 + 0.5 * c, (k * 0.13) % 1));
        colors.push(0.9, 0.9, 0.9);
        // Ribbon points are their own nodes: they follow the stretched strand.
        nodes.push(point.x, point.y, point.z);
        sways.push(0);
        strandIds.push(follow ? strandId : -1);
      }
      if (k) {
        const a = first + (k - 1) * 2;
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    // Leafy cards along the path: the painted stem runs down each card's centre line.
    let tipped = false;
    for (let start = 0.14, i = 0; start < total - 0.2; start += spacing * (0.9 + 0.2 * random()), i++) {
      const length = cardLength * (0.9 + 0.2 * random()),
        last = start + length >= total,
        top = last ? Math.max(0.14, total - length * 0.92) : start,
        flowerCard = flowering && random() < 0.55,
        sprite = last
          ? pick(flowerCard ? VINE_SPRITES.flowerTips : VINE_SPRITES.tips)
          : pick(flowerCard ? VINE_SPRITES.flowerSegments : VINE_SPRITES.segments),
        layers = top < total * layered && s < 3 ? 2 : 1;
      for (let layer = 0; layer < layers; layer++) {
        const yaw =
            layer === 0 ? (random() - 0.5) * 0.9 : (random() < 0.5 ? -1 : 1) * (0.9 + 0.35 * random()),
          node = at(top),
          rows = [0, 0.5, 1].map(f => {
            const s = top + f * length,
              p = s <= total ? at(s) : at(total).addScaledVector(tangentAt(total), s - total);
            return {
              point: p,
              side: sideAt(tangentAt(Math.min(s, total)), yaw),
              width: cardWidth * (last ? 1 - 0.25 * f : 1),
              sway: f
            };
          });
        // The lite curtain leaves out the second layer but still draws its sprite, so the stream stays in step.
        if (lite && layer) {
          pick(VINE_SPRITES.segments);
          continue;
        }
        card(rows, layer ? pick(VINE_SPRITES.segments) : sprite, node, layer ? 0.78 : 0.86 + 0.12 * random());
      }
      if (last) {
        tipped = true;
        break;
      }
    }
    // Every strand ends in a leafy tip. When the spacing ran out before the end, the bare stem ribbon stuck out
    // past the last leaves (owner, round 5: small stems poking out). The tip is picked by strand, not drawn from
    // the stream, so the rest of the vine stays as it was.
    if (!tipped) {
      const top = Math.max(0.14, total - cardLength * 0.92),
        rows = [0, 0.5, 1].map(f => {
          const s = top + f * cardLength,
            p = s <= total ? at(s) : at(total).addScaledVector(tangentAt(total), s - total);
          return {
            point: p,
            side: sideAt(tangentAt(Math.min(s, total)), 0),
            width: cardWidth * (1 - 0.25 * f),
            sway: f
          };
        });
      card(rows, VINE_SPRITES.tips[strandId % VINE_SPRITES.tips.length], at(top), 0.9);
    }
  });
  // Roots out of the soil band and a grass tuft over the turf edge: they follow the lead strand.
  strandId = 0;
  if (lip) {
    const rootX = (random() - 0.5) * 0.5,
      rootTop = new THREE.Vector3(rootX, -lipDepth + 0.02, 0.02),
      flat = new THREE.Vector3(1, 0, 0);
    card(
      [0, 0.5, 1].map(f => ({
        point: rootTop.clone().add({ x: 0.03 * f, y: -0.62 * f, z: 0.05 * f }),
        side: flat,
        width: 0.17,
        sway: f
      })),
      VINE_SPRITES.roots,
      rootTop,
      0.8
    );
    const tuftX = rootX + 0.25 * (random() < 0.5 ? -1 : 1),
      tuftTop = new THREE.Vector3(tuftX, 0.05, -0.04);
    card(
      [
        [0, 0.05, -0.04],
        [0, -0.06, 0.1],
        [0, -0.3, 0.16]
      ].map(([dx, y, z], f) => ({
        point: new THREE.Vector3(tuftX + dx, y, z),
        side: flat,
        width: 0.24,
        sway: f / 2
      })),
      VINE_SPRITES.tuft,
      tuftTop,
      0.95,
      [0, 0.42]
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('vineNode', new THREE.Float32BufferAttribute(nodes, 3));
  geometry.setAttribute('vineSway', new THREE.Float32BufferAttribute(sways, 1));
  geometry.setAttribute('vineStrand', new THREE.Float32BufferAttribute(strandIds, 1));
  geometry.userData.strandPaths = paths;
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

// The cliff drape of the island curtains: a float texture (vine-drape.mjs createDrapeTexture) with one row per instance.
export function setVineDrape(material, drape) {
  const uniforms = material.userData.vineUniforms;
  uniforms.vineDrape.value = drape ? drape.texture : null;
  uniforms.vineDrapeRows.value = drape ? drape.rows : 0;
}

// Season weights: spring, summer, autumn, winter.
export function setVineSeason(material, season) {
  const weights = { spring: [1, 0, 0, 0], summer: [0, 1, 0, 0], autumn: [0, 0, 1, 0], winter: [0, 0, 0, 1] };
  material.userData.vineUniforms.vineSeason.value.fromArray(weights[season] || weights.summer);
}

/**
 * Alpha-tested, double-sided vine material reading the data atlas. Cards keep their real size while the
 * strand stretches with the instance; the strand swings like a pendulum from its anchor, leaves flutter.
 */
export function createVineMaterial(THREE, { map, time, translucency = 0.3 }) {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map,
    vertexColors: true,
    side: THREE.DoubleSide,
    alphaTest: 0.4,
    roughness: 0.78,
    metalness: 0
  });
  material.alphaToCoverage = true;
  material.name = 'vine';
  const uniforms = {
    foliageTime: time || { value: 0 },
    vineSeason: { value: new THREE.Vector4(0, 1, 0, 0) },
    vineTranslucency: { value: translucency },
    foliageDaylight,
    // Cliff drape (vine-drape.mjs): one row of strand offsets per instance, read by instance index.
    vineDrape: { value: null },
    vineDrapeRows: { value: 0 }
  };
  material.userData.vineUniforms = uniforms;
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
          attribute vec3 vineNode;
          attribute float vineSway;
          attribute float vineStrand;
          uniform float foliageTime;
          uniform sampler2D vineDrape;
          uniform int vineDrapeRows;
          varying float vVineBloom;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
          {
            vec3 vineAnchor=vec3(0.);
            float vineStretch=1.,vineWidth=1.;
          #ifdef USE_INSTANCING
            vineAnchor=instanceMatrix[3].xyz;
            vineWidth=max(length(instanceMatrix[0].xyz),1e-3);
            vineStretch=clamp(length(instanceMatrix[1].xyz)/vineWidth,.25,4.);
          #endif
            // Only the strand layout stretches: each card hangs from its node at real length.
            transformed.y=vineNode.y+(transformed.y-vineNode.y)/vineStretch;
            float vineDrop=max(-transformed.y*vineStretch,0.),vinePhase=foliageTime*.85+
                dot(vineAnchor,vec3(.29,.17,.41)),vineFollow=0.;
            // A curtain on a cliff: lay each strand along the rock (offset per strand and drop, in metres).
          #ifdef USE_INSTANCING
            if(vineStrand>-.5&&gl_InstanceID<vineDrapeRows){
              float vineU=sqrt(min(vineDrop*vineWidth/${DRAPE.reach.toFixed(2)},1.))*
                  ${(DRAPE.knots - 1).toFixed(1)};
              int vineK=min(int(vineU),${DRAPE.knots - 2}),vineAt=int(vineStrand+.5)*${DRAPE.knots}+vineK;
              float vineA=texelFetch(vineDrape,ivec2(vineAt,gl_InstanceID),0).r,
                  vineB=texelFetch(vineDrape,ivec2(vineAt+1,gl_InstanceID),0).r;
              transformed.z+=mix(vineA,vineB,vineU-float(vineK))/vineWidth;
              vineFollow=1.;
            }
          #endif
            // On a wall the strand swings sideways but only ever out from the rock, never into it.
            transformed.xz+=vec2(sin(vinePhase),
                mix(.7*sin(vinePhase*.73+1.7),.1+.1*sin(vinePhase*.73+1.7),vineFollow))*.024*
                vineDrop*(1.+.1*vineDrop);
            transformed.z+=vineSway*.03*sin(foliageTime*2.3+dot(vineNode,vec3(7.1,3.3,5.7))+vinePhase);
            vVineBloom=fract(sin(dot(vineAnchor,vec3(12.9898,78.233,37.719)))*43758.5453);
          }`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
          uniform vec4 vineSeason;
          uniform float vineTranslucency;
          uniform float foliageDaylight;
          varying float vVineBloom;`
      )
      .replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
          vec4 vineTexel=texture2D(map,vMapUv);
          // Mipmaps average thin leaves into transparency; raise alpha with the mip level.
          vec2 vineTexels=vMapUv*${VINE_ATLAS.size}.;
          vineTexel.a*=1.+.3*
              max(0.,.5*
              log2(max(max(dot(dFdx(vineTexels),dFdx(vineTexels)),
              dot(dFdy(vineTexels),dFdy(vineTexels))),1e-6)));
          float vineTone=vineTexel.r,vinePick=vineTexel.g,vinePart=vineTexel.b,vineKeep=1.,
              vineShade=.45+.75*vineTone;
          vec3 vineColor;
          if(vinePart<.17){
            vec3 spring=mix(vec3(.16,.36,.04),vec3(.30,.47,.07),vinePick);
            vec3 summer=mix(vec3(.05,.16,.025),vec3(.11,.25,.045),vinePick);
            // Autumn: some leaves still green, most gold, orange or red.
            vec3 autumn=vinePick<.25?mix(vec3(.12,.17,.03),vec3(.26,.24,.03),vinePick*4.):
            vinePick<.55?mix(vec3(.55,.34,.03),vec3(.72,.44,.03),(vinePick-.25)/.3):
            vinePick<.82?mix(vec3(.62,.2,.02),vec3(.5,.07,.012),(vinePick-.55)/.27):vec3(.3,.025,.015);
            vineColor=spring*vineSeason.x+summer*vineSeason.y+autumn*vineSeason.z;
            vineKeep=1.-vineSeason.w;
          } else if(vinePart<.5){
            vineColor=mix(mix(vec3(.05,.026,.012),vec3(.07,.1,.03),vinePick),vec3(.1,.08,.065),vineSeason.w);
          } else if(vinePart<.83){
            vec3 petal=vinePick<.3?vec3(.85,.85,.8):vinePick<.55?vec3(.85,.45,.6):vinePick<.8?
                vec3(.5,.36,.85):vec3(.92,.78,.32);
            vineColor=vineTone<.3?vec3(.9,.62,.08):petal;
            vineShade=vineTone<.3?1.:.6+.4*vineTone;
            // Most curtains flower in spring, a few still in summer.
            vineKeep=step(.35,vVineBloom)*(vineSeason.x+vineSeason.y*step(.75,vVineBloom));
          } else{
            vineColor=vec3(.9,.93,1.);
            vineShade=1.;
            vineKeep=vineSeason.w;
          }
          diffuseColor.rgb*=vineColor*vineShade;
          diffuseColor.a*=vineTexel.a*vineKeep;
          #endif`
      )
      // Card normals already face out of the cliff: back faces must not flip them.
      .replace(
        '#include <normal_fragment_begin>',
        THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', '')
      )
      .replace(
        '#include <opaque_fragment>',
        'outgoingLight+=diffuseColor.rgb*vineTranslucency*foliageDaylight;\n#include <opaque_fragment>'
      );
  };
  material.customProgramCacheKey = () => 'garden-vine-plant-v2';
  return material;
}
