import { parkMillerStream } from './seeded-random.mjs';
import { woodTube, joinWood } from './tree-structure.mjs';

// Radial shoots occupy different heights, with rolled leaves and open sky gaps.
// The five/six shoots retain shared buffers and explicit leaf-to-wood contacts.
// No alpha maps, new texture samples, per-frame work or scenery random calls.
export function createTreeSpray(THREE, lowDetail = false, dense = false) {
  const positions = [],
    colors = [],
    indices = [],
    wood = [],
    woodNormals = [],
    attachments = [];
  const sprayScale = dense ? 0.9 : 0.82;
  const emitWood = g => {
    const p = g.attributes.position,
      n = g.attributes.normal,
      index = g.index;
    for (let i = 0; i < index.count; i++) {
      const k = index.getX(i);
      wood.push(p.getX(k), p.getY(k), p.getZ(k));
      woodNormals.push(n.getX(k), n.getY(k), n.getZ(k));
    }
    g.dispose();
  };
  const branches = [];
  for (let arm = 0; arm < (dense ? 6 : 5); arm++) {
    const angle = arm * 2.399 + 0.16 * Math.sin(arm * 2),
      out = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle)),
      side = new THREE.Vector3(out.z, 0, -out.x);
    const root = new THREE.Vector3(),
      bend = out
        .clone()
        .multiplyScalar(0.31)
        .setY(0.26 * Math.sin(arm * 2.1 + 0.4)),
      tip = out
        .clone()
        .multiplyScalar(0.63)
        .setY(0.62 * Math.sin(arm * 2.1 + 0.4));
    branches.push([root.clone(), bend.clone(), tip.clone()]);
    for (const [a, b, r1, r2] of [
      [root, bend, 0.025, 0.017],
      [bend, tip, 0.017, 0.007]
    ]) {
      const delta = b.clone().sub(a),
        g = new THREE.CylinderGeometry(r2, r1, delta.length(), 3, 1, true);
      g.applyMatrix4(
        new THREE.Matrix4().compose(
          a.clone().add(b).multiplyScalar(0.5),
          new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()),
          new THREE.Vector3(1, 1, 1)
        )
      );
      emitWood(g);
    }
    for (let node = 0; node < (dense ? 3 : 2); node++)
      for (const sign of [-1, 1]) {
        const t = dense ? 0.3 + node * 0.32 : 0.36 + node * 0.5,
          base = t < 0.5 ? root.clone().lerp(bend, t * 2) : bend.clone().lerp(tip, (t - 0.5) * 2);
        const direction = out
          .clone()
          .multiplyScalar(0.48)
          .addScaledVector(side, sign * 0.82)
          .setY(0.5 * Math.sin(arm * 1.9 + node * 2 + sign * 0.7))
          .normalize();
        const right = new THREE.Vector3(direction.z, 0, -direction.x)
            .normalize()
            .applyAxisAngle(direction, 0.72 * Math.sin(arm * 2.2 + node + sign * 0.4)),
          normal = direction.clone().cross(right).normalize();
        const length = (dense ? 0.65 : 0.72) + (dense ? 0.07 : 0.06) * Math.sin(arm * 2.1 + node * 1.4),
          width = (dense ? 0.27 : 0.32) + (dense ? 0.035 : 0.025) * Math.cos(arm + node),
          first = positions.length / 3;
        const shape = lowDetail
          ? [
              [0, 0, 0],
              [0.43, -1, 0],
              [0.46, 0, 0.09],
              [0.43, 1, 0],
              [1, 0, 0.03]
            ]
          : [
              [0, 0, 0],
              [0.22, -0.73, 0.005],
              [0.58, -1, 0.014],
              [0.51, 0, 0.11],
              [0.58, 1, 0.014],
              [0.22, 0.73, 0.005],
              [1, 0, 0.03]
            ];
        const shade = 0.86 + 0.09 * Math.sin(arm * 2.7 + node);
        for (const [along, across, rise] of shape) {
          const p = base
            .clone()
            .addScaledVector(direction, along * length)
            .addScaledVector(right, across * width)
            .addScaledVector(normal, rise);
          p.multiplyScalar(sprayScale);
          positions.push(p.x, p.y, p.z);
          const value = shade * (along === 0 ? 0.7 : across ? 1 : 1.05);
          colors.push(value * 0.94, value, value * 0.92);
        }
        const faces = lowDetail
          ? [0, 1, 2, 0, 2, 3, 1, 4, 2, 2, 4, 3]
          : [0, 1, 3, 1, 2, 3, 2, 6, 3, 3, 6, 4, 3, 4, 5, 0, 3, 5];
        indices.push(...faces.map(i => first + i));
        attachments.push({
          root: base.clone().multiplyScalar(sprayScale),
          branch: arm,
          vertex: first,
          ridge: lowDetail ? 2 : 3,
          left: lowDetail ? 1 : 2,
          right: lowDetail ? 3 : 4
        });
      }
  }
  const leaves = new THREE.BufferGeometry();
  leaves.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  leaves.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  leaves.setIndex(indices);
  leaves.computeVertexNormals();
  leaves.computeBoundingBox();
  const twigs = new THREE.BufferGeometry();
  twigs.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      wood.map(v => v * sprayScale),
      3
    )
  );
  twigs.setAttribute('normal', new THREE.Float32BufferAttribute(woodNormals, 3));
  twigs.computeBoundingBox();
  return {
    leaves,
    twigs,
    attachments,
    branches: branches.map(a => a.map(p => p.multiplyScalar(sprayScale)))
  };
}

// Bare winter crown: a few shoots curve up and out from the branch tip and fork twice, so the
// twigs fill the crown's own extent instead of straight spokes radiating from one point.
// Long enough to fill the leaf cluster's extent (radius ~0.6) and thick enough to read at lawn distance.
export const BARE_CROWN = { shoots: 4, length: 0.8, root: 0.03, tip: 0.006, spread: 0.7 };

export function createBareCrown(THREE) {
  const parts = [],
    up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < BARE_CROWN.shoots; i++) {
    const azimuth = (i * Math.PI * 2) / BARE_CROWN.shoots + 0.35 * Math.sin(i * 2.3 + 0.4),
      elevation = 0.5 + 0.22 * Math.sin(i * 1.9 + 0.5),
      length = BARE_CROWN.length * (1 + 0.14 * Math.sin(i * 2.7 + 1)),
      out = new THREE.Vector3(Math.sin(azimuth), 0, Math.cos(azimuth)),
      heading = e => out.clone().multiplyScalar(Math.cos(e)).setY(Math.sin(e)),
      mid = heading(elevation).multiplyScalar(length * 0.5),
      tip = mid.clone().addScaledVector(heading(elevation + 0.38), length * 0.5),
      shoot = new THREE.CatmullRomCurve3([new THREE.Vector3(), mid, tip]),
      radius = u => BARE_CROWN.root * Math.pow(1 - u, 0.9) + BARE_CROWN.tip * u;
    parts.push(woodTube(THREE, shoot, { stations: [0, 0.5, 1], sides: 3, radius }));
    // Forks start on the shoot's axis, thinner than the shoot there, so no end shows.
    for (const [u, sign, share] of [
      [0.4, 1, 0.5],
      [0.68, -1, 0.36]
    ]) {
      const root = shoot.getPointAt(u),
        grain = shoot.getTangentAt(u),
        side = new THREE.Vector3().crossVectors(grain, up).normalize(),
        direction = grain
          .clone()
          .multiplyScalar(Math.cos(BARE_CROWN.spread))
          .addScaledVector(side, sign * (i % 2 ? -1 : 1) * Math.sin(BARE_CROWN.spread))
          .addScaledVector(up, 0.2)
          .normalize(),
        fork = new THREE.LineCurve3(root, root.clone().addScaledVector(direction, length * share)),
        start = radius(u) * 0.7;
      parts.push(
        woodTube(THREE, fork, {
          stations: [0, 1],
          sides: 3,
          radius: v => start * (1 - v) + BARE_CROWN.tip * v
        })
      );
    }
  }
  return joinWood(THREE, parts);
}

// Painted 1024² atlas for the trees the photo maps cannot show: lobed oak-leaf sprays (central oak),
// Scots pine needle brushes and Italian cypress scale-leaf fronds. Same sprite format as SPRITES.
// Colour comes mostly from instance tints (the foliage material recolours toward luminance).
export const TREE_ATLAS = {
  oak: [
    { box: [0, 0, 640, 336], base: [6, 168], axis: 'x+' },
    { box: [0, 344, 640, 680], base: [6, 512], axis: 'x+' },
    { box: [0, 688, 640, 1024], base: [6, 856], axis: 'x+' }
  ],
  pine: [
    { box: [656, 8, 1016, 336], base: [836, 336], axis: 'y-' },
    { box: [656, 344, 1016, 672], base: [836, 672], axis: 'y-' }
  ],
  cypress: [{ box: [656, 680, 1016, 1020], base: [836, 1020], axis: 'y-' }]
};
export const ATLAS_SIZE = 1024;

// Oak leaf outline [along, half-width] in leaf lengths: short petiole, obovate blade, five rounded
// lobes a side with deep sinuses.
export function oakLeafOutline(points = 44) {
  const side = [];
  for (let i = 0; i <= points; i++) {
    const t = i / points,
      blade = Math.max(0, (t - 0.08) / 0.92),
      envelope = 0.4 * Math.sin(Math.PI * Math.min(1, blade * 1.02)) ** 0.85 * (0.7 + 0.55 * blade),
      lobe = 0.42 + 0.58 * Math.abs(Math.sin(Math.PI * (blade * 4.6 + 0.2))) ** 0.6;
    side.push([t, t < 0.08 ? 0.025 : Math.max(0.025, envelope * lobe)]);
  }
  return side;
}

function paintOakLeaf(context, x, y, angle, length, random) {
  const outline = oakLeafOutline(),
    tone = 0.7 + 0.25 * random();
  context.save();
  context.translate(x, y);
  context.rotate(angle);
  context.beginPath();
  context.moveTo(0, 0);
  for (const [t, w] of outline) context.lineTo(t * length, -w * length);
  for (let i = outline.length - 1; i >= 0; i--)
    context.lineTo(outline[i][0] * length, outline[i][1] * length);
  context.closePath();
  // Lit upper half, shaded lower half: the leaf reads folded along its midrib.
  const shade = context.createLinearGradient(0, -0.3 * length, 0, 0.3 * length);
  shade.addColorStop(0, `rgb(${120 * tone},${168 * tone},${84 * tone})`);
  shade.addColorStop(0.5, `rgb(${96 * tone},${140 * tone},${66 * tone})`);
  shade.addColorStop(1, `rgb(${70 * tone},${108 * tone},${52 * tone})`);
  context.fillStyle = shade;
  context.fill();
  context.lineWidth = 1.5;
  context.strokeStyle = 'rgba(40,62,30,0.8)';
  context.stroke();
  // Midrib and lobe veins.
  context.strokeStyle = 'rgba(190,210,140,0.55)';
  context.lineWidth = 1.6;
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(0.95 * length, 0);
  for (let k = 0; k < 5; k++) {
    const t = 0.2 + k * 0.155;
    for (const s of [-1, 1]) {
      context.moveTo(t * length, 0);
      context.lineTo((t + 0.09) * length, s * 0.2 * length);
    }
  }
  context.stroke();
  context.restore();
}

// A twig with alternate leaves and a terminal rosette, growing to the right from the sprite base.
function paintOakSpray(context, sprite, random) {
  const [x0, , x1] = sprite.box,
    [bx, by] = sprite.base,
    span = x1 - x0 - 170,
    bend = (random() - 0.5) * 50,
    at = t => [bx + t * span, by + bend * Math.sin(Math.PI * t)];
  context.strokeStyle = '#4a4a2c';
  context.lineCap = 'round';
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(bx, by);
  for (let t = 0.05; t <= 1.001; t += 0.05) context.lineTo(...at(t));
  context.stroke();
  for (let k = 0; k < 6; k++) {
    const [x, y] = at(0.18 + k * 0.13),
      s = k % 2 ? 1 : -1;
    paintOakLeaf(context, x, y, s * (0.75 + 0.35 * random()), 105 + 45 * random(), random);
  }
  const [tx, ty] = at(1);
  for (let k = 0; k < 4; k++)
    paintOakLeaf(context, tx, ty, -0.9 + k * 0.6 + 0.2 * random(), 125 + 25 * random(), random);
}

// A Scots pine shoot: paired needles crowd the shoot and fan forward into a brush; side shoots fork.
function paintPineBrush(context, sprite, random) {
  const [, y0] = sprite.box,
    [bx, by] = sprite.base,
    height = by - y0;
  const shoot = (sx, sy, angle, length, needles) => {
    const ex = sx + Math.sin(angle) * length,
      ey = sy - Math.cos(angle) * length;
    context.strokeStyle = '#6b5236';
    context.lineWidth = 5;
    context.beginPath();
    context.moveTo(sx, sy);
    context.lineTo(ex, ey);
    context.stroke();
    for (let i = 0; i < needles; i++) {
      const t = 0.25 + 0.75 * (i / needles) ** 0.8,
        px = sx + (ex - sx) * t,
        py = sy + (ey - sy) * t,
        side = i % 2 ? 1 : -1,
        a = angle + (0.35 + 0.5 * random()) * side * (1.15 - 0.5 * t),
        n = height * (0.2 + 0.1 * random()),
        g = 0.75 + 0.4 * random();
      context.strokeStyle = `rgb(${38 * g},${74 * g},${56 * g})`;
      context.lineWidth = 2.4;
      context.beginPath();
      context.moveTo(px, py);
      context.quadraticCurveTo(
        px + Math.sin(a) * n * 0.6,
        py - Math.cos(a) * n * 0.6,
        px + Math.sin(a + 0.15 * side) * n,
        py - Math.cos(a + 0.15 * side) * n
      );
      context.stroke();
    }
    // Terminal bud tuft.
    for (let i = 0; i < 16; i++) {
      const a = angle + (i / 15 - 0.5) * 1.6,
        n = height * (0.16 + 0.08 * random());
      context.strokeStyle = `rgb(${46 + 20 * random()},${86 + 20 * random()},62)`;
      context.lineWidth = 2.2;
      context.beginPath();
      context.moveTo(ex, ey);
      context.lineTo(ex + Math.sin(a) * n, ey - Math.cos(a) * n);
      context.stroke();
    }
    return [ex, ey];
  };
  context.lineCap = 'round';
  const [mx, my] = shoot(bx, by, 0, height * 0.46, 70);
  shoot(bx + (mx - bx) * 0.3, by + (my - by) * 0.3, -0.75, height * 0.32, 40);
  shoot(bx + (mx - bx) * 0.45, by + (my - by) * 0.45, 0.7 + 0.1 * random(), height * 0.3, 40);
}

// Italian cypress frond: a flattened spray branching three times into dense scale-leaf strands.
function paintCypressFrond(context, sprite, random) {
  const [, y0] = sprite.box,
    [bx, by] = sprite.base,
    height = by - y0;
  const branch = (x, y, angle, length, depth) => {
    const ex = x + Math.sin(angle) * length,
      ey = y - Math.cos(angle) * length,
      steps = Math.max(3, Math.round(length / 6));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps,
        g = 0.8 + 0.45 * random();
      // Overlapping scale-leaf beads, wider at the base of each strand: a dense, ragged-edged frond.
      context.fillStyle = `rgb(${56 * g},${96 * g},${52 * g})`;
      context.beginPath();
      context.arc(x + (ex - x) * t, y + (ey - y) * t, (2.6 * depth + 5) * (1.1 - 0.45 * t), 0, Math.PI * 2);
      context.fill();
    }
    if (depth <= 0) return;
    const forks = depth === 3 ? 9 : 5;
    for (let k = 0; k < forks; k++) {
      const t = 0.25 + (0.7 * k) / forks,
        side = k % 2 ? 1 : -1;
      branch(
        x + (ex - x) * t,
        y + (ey - y) * t,
        angle + side * (0.45 + 0.3 * random()),
        length * (0.42 - 0.18 * t) * (0.85 + 0.3 * random()),
        depth - 1
      );
    }
  };
  branch(bx, by, 0, height * 0.92, 3);
}

/** Paints TREE_ATLAS onto a 1024² 2D context with a transparent background. */
export function paintTreeAtlas(context) {
  const random = parkMillerStream(97);
  context.clearRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);
  for (const sprite of TREE_ATLAS.oak) paintOakSpray(context, sprite, random);
  for (const sprite of TREE_ATLAS.pine) paintPineBrush(context, sprite, random);
  for (const sprite of TREE_ATLAS.cypress) paintCypressFrond(context, sprite, random);
}

// Italian cypress column at unit size: radius at height share t (widest low, a pointed flame top).
export const CYPRESS = { height: 3.2, radius: 0.36, cards: 190, cardLength: 0.4 };
export const cypressRadius = t =>
  CYPRESS.radius * Math.max(0, Math.sin(Math.PI * (0.12 + 0.88 * t))) ** 0.55 * (1.15 - 0.55 * t);

/**
 * Upswept frond cards hugging the cypress profile, faces turned outward, so the column reads dense
 * from every side. Same attributes as createCardCluster (position, normal, uv, color, foliageSway).
 */
export function createCypressColumn(THREE, { seed = 31, cards = CYPRESS.cards } = {}) {
  const random = parkMillerStream(seed),
    sprite = TREE_ATLAS.cypress[0],
    [x0, y0, x1] = sprite.box,
    [bx, by] = sprite.base,
    length = by - y0,
    positions = [],
    normals = [],
    uvs = [],
    colors = [],
    sway = [],
    indices = [];
  const up = new THREE.Vector3(0, 1, 0),
    out = new THREE.Vector3(),
    direction = new THREE.Vector3(),
    side = new THREE.Vector3(),
    base = new THREE.Vector3(),
    point = new THREE.Vector3(),
    normal = new THREE.Vector3();
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < cards; i++) {
    const t = Math.min(0.97, ((i + 0.5) / cards) ** 1.12),
      theta = i * golden + random() * 0.6,
      // Every other card sits deep inside, so the column has no see-through core.
      depth = i % 2 ? 0.55 + 0.35 * random() : 0.1 + 0.35 * random(),
      r = cypressRadius(t);
    out.set(Math.cos(theta), 0, Math.sin(theta));
    base.copy(out).multiplyScalar(r * depth);
    base.y = t * CYPRESS.height;
    // Upswept, leaning out just enough to reach the profile surface.
    direction
      .copy(out)
      .multiplyScalar(0.35 + 0.25 * random())
      .addScaledVector(up, 1)
      .normalize();
    side.crossVectors(direction, out).normalize();
    side.applyAxisAngle(direction, (random() - 0.5) * 0.9);
    const cardLength = CYPRESS.cardLength * (0.75 + 0.4 * random()) * (1.1 - 0.55 * t),
      first = positions.length / 3;
    for (const step of [0, 1])
      for (const x of [x0, x1]) {
        const y = by - length * step,
          along = (by - y) / length,
          across = (x - bx) / length;
        point
          .copy(base)
          .addScaledVector(direction, along * cardLength)
          .addScaledVector(side, -across * cardLength);
        positions.push(point.x, point.y, point.z);
        const radial = Math.max(0.05, cypressRadius(Math.min(1, point.y / CYPRESS.height)));
        normal.set(point.x / radial, 0.45, point.z / radial).normalize();
        normals.push(normal.x, normal.y, normal.z);
        uvs.push(x / ATLAS_SIZE, 1 - y / ATLAS_SIZE);
        const light = (0.5 + 0.5 * Math.min(1, Math.hypot(point.x, point.z) / radial)) * (0.82 + 0.18 * t),
          tone = 0.92 + 0.16 * random();
        colors.push(light * tone, light, light * tone * 0.95);
        sway.push((0.15 + 0.85 * t) * (0.4 + 0.6 * along));
      }
    indices.push(first, first + 2, first + 1, first + 1, first + 2, first + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('foliageSway', new THREE.Float32BufferAttribute(sway, 1));
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.cards = cards;
  return geometry;
}

/**
 * The cypress's own bole at unit size (bottom radius 1, height 1): it narrows to a slim leader, so one stretched
 * instance climbs from the root flare up through the frond column. The bark photo repeats along its wall.
 */
export const CYPRESS_BOLE = { top: 0.2, sides: 8, repeat: 8 };
export function createCypressBole(THREE) {
  const geometry = new THREE.CylinderGeometry(CYPRESS_BOLE.top, 1, 1, CYPRESS_BOLE.sides, 1),
    uv = geometry.attributes.uv;
  for (let i = 0; i < 2 * (CYPRESS_BOLE.sides + 1); i++) uv.setY(i, uv.getY(i) * CYPRESS_BOLE.repeat);
  return geometry;
}
