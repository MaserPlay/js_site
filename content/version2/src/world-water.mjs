// The garden's ponds and falls: lakeBasin cuts a pool into an island top (turf, snow and bank rings, the shore
// and its rim stones), and waterfall pours a fall from an island's edge into its pool (the falling sheet, its
// mouth on the lip, the flank boulders). world.mjs creates both while it builds a garden (buildWorldSteps) and
// hands over the scene parts they build into.
import * as THREE from './vendor/three.module.js';
import { cutSnowOutlet, cutSnowBasin } from './winter-geometry.mjs';
import { pondRadius, pondSeed, rimStones, pondLens } from './pond-shape.mjs';
import { reshapePondPoint, isSamplePond } from './pond-preview.mjs';
import { LIP } from './terrain-forms.mjs';
import { LIP_BEND_Y, alignWaterMouth } from './water-mouth.mjs';
import { lakeAttributes } from './water-effects.mjs';

// The two boulders beside a waterfall's outlet: how far beyond the channel edge and back from the lip, and size.
const POND_FLANK = {
  aside: 0.75,
  back: 0.45,
  // the two differ (a taller stone on one bank, a lower one on the other); which side gets which varies per pond
  sizes: [
    { x: 0.5, y: 0.31, z: 0.4 },
    { x: 0.36, y: 0.24, z: 0.31 }
  ]
};
// How far the rim stones may reach from the basin centre, in basin ellipse units: the footprint pond-site.mjs keeps clear
// (POND.stoneEllipse plus POND.stone, over the basin radii).
const POND_REACH = 1.285;
// Segments of the pond's shore: the turf hole, the snow hole and the bank rings (32 showed as a faceted outline up close).
const POND_SEGMENTS = 64;

export function createWaterBuilders(world) {
  const {
    resources,
    pondPreview,
    palette,
    contour,
    islandSurfaces,
    waterSurfaces,
    waterZones,
    mesh,
    batch,
    terrainUV,
    withTurfDepth,
    markPondStone,
    onIsland
  } = world;
  function lakeBasin(target, center, flow, across, rx, rz, lip, width, seed) {
    if (!target) return;
    const cutOutlet = geometry =>
      cutSnowOutlet(
        THREE,
        geometry,
        target.frost.matrixWorld,
        center,
        flow,
        across,
        rz * 0.55,
        lip.clone().sub(center).dot(flow) + 1.4,
        width * 0.4 + 0.08
      );
    if (!(target.radius > 11 || (target.x === 0 && target.z === 0))) {
      // Small scenic islands keep their existing nonwinter terrain; snow alone
      // is cut by the basin/outlet union, even when the basin touches the coast.
      target.frost.updateWorldMatrix(true, false);
      const basin = cutSnowBasin(
          THREE,
          target.frost.geometry,
          target.frost.matrixWorld,
          center,
          flow,
          across,
          rx + 0.06,
          rz + 0.05
        ),
        cut = cutOutlet(basin);
      basin.dispose();
      target.frost.geometry.dispose();
      target.frost.geometry = cut;
      resources.add(cut);
      return;
    }
    // The shore is the basin ellipse bent by this pond's own outline (pond-shape.mjs), the curve the water shader cuts too.
    const shore = (theta, r = 1, y = 0.23) => {
      const outline = r * pondRadius(theta, seed);
      return reshapePondPoint(
        center
          .clone()
          .addScaledVector(across, Math.sin(theta) * rx * outline)
          .addScaledVector(flow, Math.cos(theta) * rz * outline)
          .setY(target.y + y),
        center,
        flow,
        across,
        rz,
        isSamplePond(target, pondPreview)
      );
    };
    for (const [object, height, topY] of [
      [target.top, 0.2 - LIP.bottom, target.y + 0.2],
      [target.frost, 0.1, target.y + 0.28]
    ]) {
      object.updateWorldMatrix(true, false);
      const inverse = object.matrixWorld.clone().invert(),
        shape = new THREE.Shape();
      for (let k = 0; k < 26; k++) {
        const a = (k / 26) * Math.PI * 2,
          r = target.radius * 0.99 * contour(a, target.profile),
          x = Math.sin(a) * r,
          z = Math.cos(a) * r;
        k ? shape.lineTo(x, z) : shape.moveTo(x, z);
      }
      shape.closePath();
      const hole = new THREE.Path();
      for (let k = 0; k < POND_SEGMENTS; k++) {
        const q = shore(
          (-k / POND_SEGMENTS) * Math.PI * 2,
          object === target.frost && isSamplePond(target, pondPreview) ? 1.12 : 0.97
        ).applyMatrix4(inverse);
        k ? hole.lineTo(q.x, q.z) : hole.moveTo(q.x, q.z);
      }
      hole.closePath();
      shape.holes.push(hole);
      let g = new THREE.ExtrudeGeometry(shape, {
        depth: height,
        bevelEnabled: false,
        steps: 1,
        curveSegments: 1
      });
      g.rotateX(Math.PI / 2);
      g.translate(0, topY - object.position.y, 0);
      if (object === target.frost) {
        const cut = cutOutlet(g);
        g.dispose();
        g = cut;
      }
      if (object === target.top) withTurfDepth(terrainUV(g), topY - object.position.y, height);
      resources.add(g);
      object.geometry.dispose();
      object.geometry = g;
    }
    const positions = [],
      bank = [],
      bowl = [],
      rings = [
        [1.12, 0.205],
        [1.0, 0.255],
        [0.91, -0.07],
        [0.6, -0.57],
        [0, -0.76]
      ],
      n = POND_SEGMENTS;
    rings.forEach(([r, y], j) => {
      for (let k = 0; k < n; k++) {
        const q = shore((k / n) * Math.PI * 2, r, y + (j < 2 ? 0.025 * Math.sin(k * 2.1) : 0));
        positions.push(q.x, q.y, q.z);
      }
      if (j)
        for (let k = 0; k < n; k++) {
          if (j <= 2 && Math.cos(((k + 0.5) / n) * Math.PI * 2) > 0.88) continue;
          const a = (j - 1) * n + k,
            b = (j - 1) * n + ((k + 1) % n),
            c = j * n + k,
            d = j * n + ((k + 1) % n);
          (j <= 2 ? bank : bowl).push(a, b, c, b, d, c);
        }
    });
    // The two outer rings are lawn that dips to the water (the turf's own material, so it blends in and takes the
    // season); only the bowl below the water is stone.
    for (const [indices, material, scale] of [
      [bank, palette.ground, 0.075],
      [bowl, palette.stone, 0.125]
    ]) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      g.setAttribute(
        'uv',
        new THREE.Float32BufferAttribute(
          positions.flatMap((v, i) => (i % 3 === 0 ? [v * scale, positions[i + 2] * scale] : [])),
          2
        )
      );
      g.setIndex(indices);
      g.computeVertexNormals();
      mesh(g, material);
    }
  }
  function waterfall(x, z, base, angle, width, height, sourceLength = 2.4) {
    const flow = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle)),
      across = new THREE.Vector3(Math.cos(angle), 0, -Math.sin(angle));
    const basinCenter = -sourceLength * 1.08,
      basinLength = Math.min(sourceLength * 0.66, width * 0.66),
      basin = new THREE.Vector3(x, base + 0.235, z).addScaledVector(flow, basinCenter);
    const target = islandSurfaces.at(-1),
      // each pond has its own outline; a stone curb rings it on the large islands (lakeBasin)
      seed = pondSeed(waterSurfaces.length),
      ringed = !!target && (target.radius > 11 || (target.x === 0 && target.z === 0));
    waterZones.push({
      center: basin.clone(),
      flow: flow.clone(),
      across: across.clone(),
      rx: width * (isSamplePond(target, pondPreview) ? 0.83 : 0.72),
      rz: basinLength * (isSamplePond(target, pondPreview) ? 1.6 : 1.16),
      lip: new THREE.Vector3(x, base, z),
      width: width * 0.65,
      base,
      island: target
    });
    lakeBasin(
      target,
      basin,
      flow,
      across,
      width * 0.65,
      basinLength,
      new THREE.Vector3(x, base, z),
      width,
      seed
    );
    const sections = [
      [basinCenter - basinLength, 0.235, 0],
      [basinCenter - basinLength * 0.8, 0.235, 0.78],
      [basinCenter - basinLength * 0.35, 0.235, 1.24],
      [basinCenter + basinLength * 0.25, 0.233, 1.27],
      [basinCenter + basinLength * 0.75, 0.23, 0.86],
      [basinCenter + basinLength, 0.227, 0.48],
      [-0.3, 0.223, 0.58],
      // The bend row stays above the island top edge (water-mouth.mjs LIP_BEND_Y).
      [0.18, LIP_BEND_Y, 0.58],
      [0.42, -0.5, 0.57],
      [0.66, -height * 0.18, 0.55],
      [0.9, -height * 0.48, 0.53],
      [1.06, -height * 0.76, 0.51],
      [1.12, -height, 0.48]
    ];
    // Rim stones: dropped rocks of different sizes lying along the pond's outline, some sunk deep, some at the water's edge.
    rimStones(seed).forEach((stone, j) => {
      const sin = Math.sin(stone.theta),
        cos = Math.cos(stone.theta),
        rx = width * 0.65,
        metres = Math.hypot(rx * sin, basinLength * cos),
        shore = pondRadius(stone.theta, seed),
        // the centre lies `out` metres beyond the shore, but the stone's far side stays inside the footprint
        out = Math.min(stone.out, (POND_REACH - shore) * metres - Math.max(stone.scale[0], stone.scale[2])),
        r = shore + out / metres,
        p = basin
          .clone()
          .addScaledVector(across, sin * rx * r)
          .addScaledVector(flow, cos * basinLength * r);
      p.y = base + 0.2 + stone.scale[1] * (1 - 2 * stone.sink);
      if (isSamplePond(target, pondPreview) && j >= 2 && j <= 4) {
        reshapePondPoint(p, basin, flow, across, basinLength, true);
        const away = p.clone().sub(basin).setY(0).normalize();
        p.addScaledVector(away, 0.35);
      }
      const [sx, sy, sz] = stone.scale;
      batch(
        'boulder',
        'boulder',
        p,
        { x: sx, y: sy, z: sz },
        { x: stone.pitch, y: stone.yaw + angle, z: stone.roll }
      );
      markPondStone();
    });
    const distances = [0];
    for (let j = 1; j < sections.length; j++)
      distances.push(
        distances[j - 1] +
          Math.hypot(sections[j][0] - sections[j - 1][0], sections[j][1] - sections[j - 1][1])
      );
    const total = distances.at(-1),
      positions = [],
      uv = [],
      depths = [],
      indices = [],
      columns = 5;
    // Rows 0..5 are the pond's lens: its polygon encloses the pond's outline with the corners well outside it
    // (pond-shape.mjs pondLens), and the water shader cuts the smooth shore. Columns blend between the two sides.
    const lens = pondLens(seed, ringed),
      lensPoint = (j, k) => {
        if (j === 0) return lens.apex;
        const a = lens.left[j - 1],
          b = lens.right[j - 1],
          f = k / columns;
        return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
      };
    sections.forEach(([d, y, widthFactor], j) => {
      for (let k = 0; k <= columns; k++) {
        let along = d,
          aside = (k / columns - 0.5) * width * widthFactor;
        if (j < 6) {
          const [u, v] = lensPoint(j, k);
          along = basinCenter + v * basinLength;
          aside = u * width * 0.65;
        }
        const p = new THREE.Vector3(x, base + y, z)
          .addScaledVector(flow, along)
          .addScaledVector(across, aside);
        reshapePondPoint(p, basin, flow, across, basinLength, isSamplePond(target, pondPreview));
        positions.push(p.x, p.y, p.z);
        uv.push(k / columns, (distances[j] / total) * 2.6667);
        depths.push(j < 5 ? Math.sin((j / 5) * Math.PI) * Math.sin((k / columns) * Math.PI) : 0);
      }
      if (j < sections.length - 1)
        for (let k = 0; k < columns; k++) {
          const n = j * (columns + 1) + k;
          indices.push(n, n + columns + 1, n + 1, n + 1, n + columns + 1, n + columns + 2);
        }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('basinDepth', new THREE.Float32BufferAttribute(depths, 1));
    g.setIndex(indices);
    g.computeVertexNormals();
    mesh(g, palette.water);
    target.cliff.updateWorldMatrix(true, false);
    const lip = new THREE.Vector3(x, base, z),
      coast = Array.from({ length: 26 }, (_, k) => {
        const a = (k / 26) * Math.PI * 2,
          r = target.radius * 0.99 * contour(a, target.profile);
        return new THREE.Vector3(Math.sin(a) * r, 0, Math.cos(a) * r).applyMatrix4(target.cliff.matrixWorld);
      });
    const mouth = alignWaterMouth(THREE, g, target.cliff, coast, lip, flow, across, columns, base, height),
      bottom = new THREE.Vector3()
        .fromBufferAttribute(g.attributes.position, 12 * (columns + 1) + 2)
        .add(new THREE.Vector3().fromBufferAttribute(g.attributes.position, 12 * (columns + 1) + 3))
        .multiplyScalar(0.5);
    g.setAttribute(
      'lakeData',
      lakeAttributes(
        THREE,
        g,
        basin,
        flow,
        across,
        width * 0.65,
        basinLength,
        seed + (ringed ? 2 : 0) + (isSamplePond(target, pondPreview) ? 4 : 0)
      )
    );
    waterSurfaces.push({
      geometry: g,
      cliff: target.cliff,
      flow: flow.clone(),
      columns,
      lip,
      bottom,
      across: across.clone(),
      width,
      base,
      height,
      mouth
    });
    // Two boulders frame the outlet on the bank, clear of the pond and of the channel, never over the edge.
    [-1, 1].forEach((side, n) => {
      const size = POND_FLANK.sizes[(n + Math.floor(seed * 2)) % 2],
        p = new THREE.Vector3(x, base + 0.2 + size.y * 0.6, z)
          .addScaledVector(across, side * (width * 0.29 + POND_FLANK.aside))
          .addScaledVector(flow, -POND_FLANK.back);
      // The lip stands a little outside the turf and the coast curves in beside it: step back until the stone's
      // front stays on the island.
      for (let k = 0; k < 12 && !onIsland(target, p.x + flow.x * 0.55, p.z + flow.z * 0.55, 0.95); k++)
        p.addScaledVector(flow, -0.1);
      batch('boulder', 'boulder', p, size, { x: 0.06 * side, y: angle + seed * 6 + n * 2.1, z: 0.05 });
      markPondStone();
    });
    // No floating rectangular foam plane over the outlet.
  }
  return { lakeBasin, waterfall };
}
