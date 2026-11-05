// More narrow, irregular cliff columns at the existing near-island triangle budget.
// Keep the two random arrays consumed by the old cliff, so scenery placement is stable.
export function createRockGeometry(THREE, radius, depth, offset, profile, contour, random) {
  const near = radius > 11 || radius === 7.8,
    type = profile % 4;
  // Include every corner of the actual 26-sided ground slab. Subdivide selected
  // straight edges on nearby islands; sampling a separate circle left sky gaps.
  const rim = [];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2,
      b = ((i + 1) / 26) * Math.PI * 2,
      ratio = near ? 0.99 : 1;
    const start = new THREE.Vector3(
      Math.sin(a) * radius * contour(a, profile) * ratio,
      -0.2,
      Math.cos(a) * radius * contour(a, profile) * ratio
    );
    rim.push(start);
    if (near && Math.floor(((i + 1) * 14) / 26) > Math.floor((i * 14) / 26)) {
      const end = new THREE.Vector3(
        Math.sin(b) * radius * contour(b, profile) * ratio,
        -0.2,
        Math.cos(b) * radius * contour(b, profile) * ratio
      );
      rim.push(start.clone().lerp(end, 0.5));
    }
  }
  const n = rim.length;
  const noise = Array.from({ length: 80 }, random),
    faceNoise = Array.from({ length: 64 }, random);
  const points = Array.from({ length: 4 }, (_, j) =>
    Array.from({ length: n }, (_, i) => {
      if (j === 0) return rim[i].clone();
      const a = Math.atan2(rim[i].x, rim[i].z),
        q = noise[(i * 7 + profile * 3) % 80],
        v = noise[(i * 11 + 19) % 80];
      const groove = i % 2 ? 0.88 : 1.01,
        edge = contour(a, profile);
      let r, y;
      if (j === 1) {
        r = radius * edge * groove * (0.96 + q * 0.06);
        y = -depth * (0.13 + v * 0.075 + 0.025 * Math.sin(a * 3 + profile));
      } else if (j === 2) {
        r = radius * edge * groove * ((type === 2 ? 0.82 : 0.75) + q * 0.055);
        y = -depth * (0.49 + v * 0.18 + 0.04 * Math.sin(a * 2));
      } else {
        r = radius * edge * (0.13 + q * 0.17) * (i % 2 ? 0.83 : 1);
        y = -depth * (0.86 + v * 0.22 + (i % 2 ? -0.065 : 0.05));
      }
      return new THREE.Vector3(Math.sin(a) * r + offset * j * 0.82, y, Math.cos(a) * r);
    })
  );
  const positions = [],
    colors = [];
  const emit = (a, b, c, tone) => {
    for (const p of [a, b, c]) {
      positions.push(p.x, p.y, p.z);
      const top = Math.max(0, 1 + p.y / (depth * 0.22));
      colors.push(tone * (0.9 + top * 0.07), tone * (0.9 + top * 0.045), tone * (0.98 - top * 0.045));
    }
  };
  for (let j = 0; j < 3; j++)
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n,
        a = points[j][i],
        b = points[j + 1][i],
        c = points[j][k],
        d = points[j + 1][k];
      // Color stays along the column, avoiding black horizontal stripes around every island.
      const tone =
        0.73 + 0.14 * Math.sin((i / n) * Math.PI * 2 + 0.7) + faceNoise[(i * 3 + profile) % 64] * 0.11;
      if ((i + profile) % 2) {
        emit(a, b, d, tone);
        emit(a, d, c, tone * 0.99);
      } else {
        emit(a, b, c, tone);
        emit(c, b, d, tone * 0.99);
      }
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('terrainPoint', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.userData.rim = rim;
  g.computeVertexNormals();
  return g;
}

// The grass slab spans LIP.bottom..0.2 (island-local metres). inset: how far the soil face sits under the
// slab edge; soil: soil band depth; tuck/swell: how far the rock recedes under the lip and comes back lower.
export const LIP = { bottom: 0, inset: 0.17, soil: 0.3, tuck: 0.3, swell: 0.22 };
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Realistic basalt cliff on the same silhouette and random draws as createRockGeometry:
// a dense, smooth-shaded skin with column facets, crevices and a closed tip below.
export function createBasaltGeometry(THREE, radius, depth, offset, profile, contour, random) {
  const near = radius > 11 || radius === 7.8,
    type = profile % 4,
    rim = [];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2,
      b = ((i + 1) / 26) * Math.PI * 2,
      ratio = near ? 0.99 : 1;
    const start = new THREE.Vector3(
      Math.sin(a) * radius * contour(a, profile) * ratio,
      -0.2,
      Math.cos(a) * radius * contour(a, profile) * ratio
    );
    rim.push(start);
    if (near && Math.floor(((i + 1) * 14) / 26) > Math.floor((i * 14) / 26)) {
      const end = new THREE.Vector3(
        Math.sin(b) * radius * contour(b, profile) * ratio,
        -0.2,
        Math.cos(b) * radius * contour(b, profile) * ratio
      );
      rim.push(start.clone().lerp(end, 0.5));
    }
  }
  const n = rim.length,
    noise = Array.from({ length: 80 }, random),
    faceNoise = Array.from({ length: 64 }, random);
  const control = Array.from({ length: 4 }, (_, j) =>
    Array.from({ length: n }, (_, i) => {
      if (j === 0) return rim[i].clone();
      const a = Math.atan2(rim[i].x, rim[i].z),
        q = noise[(i * 7 + profile * 3) % 80],
        v = noise[(i * 11 + 19) % 80],
        groove = i % 2 ? 0.88 : 1.01,
        edge = contour(a, profile);
      let r, y;
      if (j === 1) {
        r = radius * edge * groove * (0.96 + q * 0.06);
        y = -depth * (0.13 + v * 0.075 + 0.025 * Math.sin(a * 3 + profile));
      } else if (j === 2) {
        r = radius * edge * groove * ((type === 2 ? 0.82 : 0.75) + q * 0.055);
        y = -depth * (0.49 + v * 0.18 + 0.04 * Math.sin(a * 2));
      } else {
        r = radius * edge * (0.13 + q * 0.17) * (i % 2 ? 0.83 : 1);
        y = -depth * (0.86 + v * 0.22 + (i % 2 ? -0.065 : 0.05));
      }
      return new THREE.Vector3(Math.sin(a) * r + offset * j * 0.82, y, Math.cos(a) * r);
    })
  );
  const tip = new THREE.Vector3(offset * 3.1, -depth * 1.05, 0);
  const catmull = (p0, p1, p2, p3, t) => {
    const t2 = t * t,
      t3 = t2 * t;
    return new THREE.Vector3()
      .addScaledVector(p0, -0.5 * t3 + t2 - 0.5 * t)
      .addScaledVector(p1, 1.5 * t3 - 2.5 * t2 + 1)
      .addScaledVector(p2, -1.5 * t3 + 2 * t2 + 0.5 * t)
      .addScaledVector(p3, 0.5 * t3 - 0.5 * t2);
  };
  const S = near ? 3 : 2,
    columns = n * S,
    bands = [4, 5, 4, 3];
  const hash = (x, y) => {
    const s = Math.sin(x * 127.1 + y * 311.7 + profile * 74.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const positions = [],
    colors = [],
    indices = [];
  // Turf lip (owner M18: a light seam showed between the grass slab and the rock, which bulged out under
  // it and caught the sky). The slab underside is the 26-gon at LIP.bottom; the cliff now starts inside the
  // slab, shows a soil band under the overhang and tucks the rock in below it, so nothing faces up there.
  const edgeRatio = near ? 0.99 : 1,
    tuckScale = Math.min(1, Math.max(0.5, radius / 9)),
    lipEdge = a => {
      const step = (Math.PI * 2) / 26,
        k = Math.floor((((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / step),
        corner = q => {
          const r = radius * contour(q, profile) * edgeRatio;
          return [Math.sin(q) * r, Math.cos(q) * r];
        },
        [x0, z0] = corner(k * step),
        [x1, z1] = corner((k + 1) * step),
        dx = x1 - x0,
        dz = z1 - z0,
        ex = Math.sin(a),
        ez = Math.cos(a);
      return (x0 * dz - z0 * dx) / (ex * dz - ez * dx);
    },
    toEdge = (p, a, inset) => {
      const r = lipEdge(a) - inset;
      return p.set(Math.sin(a) * r, p.y, Math.cos(a) * r);
    };
  let rows = 0;
  const foot = [];
  // Soil rows: hidden inside the slab, just under its overhang, and the foot of the soil band.
  for (const [y, inset] of [
    [LIP.bottom + 0.1, LIP.inset + 0.2],
    [LIP.bottom - 0.02, LIP.inset]
  ]) {
    for (let c = 0; c < columns; c++) {
      const u = c / S,
        i = Math.floor(u),
        f = u - i,
        rim0 = catmull(rim[(i - 1 + n) % n], rim[i % n], rim[(i + 1) % n], rim[(i + 2) % n], f),
        a = Math.atan2(rim0.x, rim0.z),
        p = toEdge(new THREE.Vector3(0, y, 0), a, inset + 0.04 * hash(c, 5));
      positions.push(p.x, p.y, p.z);
      colors.push(0.5, 0.45, 0.4);
    }
    rows++;
  }
  // Rows run from the rim down to the ring above the tip; the tip closes the underside.
  for (let band = 0; band < 4; band++)
    for (let r = 0; r < bands[band]; r++) {
      const t = r / bands[band];
      for (let c = 0; c < columns; c++) {
        const u = c / S,
          i = Math.floor(u),
          f = u - i,
          at = j =>
            catmull(
              control[j][(i - 1 + n) % n],
              control[j][i % n],
              control[j][(i + 1) % n],
              control[j][(i + 2) % n],
              f
            );
        const column = j => (j < 0 ? at(0).setY(at(0).y + 0.4) : j > 3 ? tip.clone() : at(j));
        const p = catmull(column(band - 1), column(band), column(band + 1), column(band + 2), t);
        const lipA = Math.atan2(p.x, p.z);
        if (band === 0 && r === 0) {
          toEdge(
            p.setY(LIP.bottom - LIP.soil - 0.07 * hash(c, 6)),
            lipA,
            LIP.inset + 0.05 + 0.04 * hash(c, 7)
          );
          foot[c] = p.clone();
        } else {
          // Below the soil the rock stays under the lip, then may swell back out lower down.
          // Rows right under the soil foot stay below and inside it: no ledge facing the sky.
          if (band === 0) p.y = Math.min(p.y, foot[c].y - 0.15 * r);
          const d = LIP.bottom - p.y,
            under = d < 1.4 ? Math.hypot(foot[c].x, foot[c].z) - 0.03 : Infinity,
            limit =
              Math.min(under, lipEdge(lipA)) -
              LIP.inset -
              0.06 -
              tuckScale * (LIP.tuck * smooth(0.3, 1.1, d) - LIP.swell * smooth(1.4, 3.4, d)),
            reach = Math.hypot(p.x, p.z);
          if (reach > limit) {
            p.x *= limit / reach;
            p.z *= limit / reach;
          }
        }
        const fromTop = Math.max(0, -0.2 - p.y),
          w = Math.min(1, fromTop / 1.2),
          a = Math.atan2(p.x, p.z);
        // Basalt columns: stepped radial facets, vertical crevices and a few horizontal ledges.
        const facet = Math.floor((a / (Math.PI * 2)) * columns * 0.5 + 40),
          col = hash(facet, 0),
          crevice = Math.pow(Math.abs(Math.sin(a * columns * 0.25 + col * 6)), 18);
        const ledge = Math.pow(Math.max(0, Math.sin(p.y * 1.7 + col * 3)), 24);
        const inward =
          w * (0.05 * col + 0.07 * crevice + 0.04 * ledge + 0.03 * hash(facet, Math.floor(p.y * 1.4)));
        const lean = Math.hypot(p.x, p.z);
        if (lean > 1e-4) {
          p.x -= (p.x / lean) * inward * radius * 0.22;
          p.z -= (p.z / lean) * inward * radius * 0.22;
        }
        positions.push(p.x, p.y, p.z);
        const tone =
            (0.73 +
              0.14 * Math.sin((c / columns) * Math.PI * 2 + 0.7) +
              faceNoise[(i * 3 + profile) % 64] * 0.11) *
            (1 - 0.32 * crevice - 0.12 * ledge) *
            (0.92 + 0.16 * col),
          top = Math.max(0, 1 + p.y / (depth * 0.22));
        colors.push(tone * (0.9 + top * 0.07), tone * (0.9 + top * 0.045), tone * (0.98 - top * 0.045));
      }
      rows++;
    }
  for (let r = 0; r < rows - 1; r++)
    for (let c = 0; c < columns; c++) {
      const a = r * columns + c,
        b = r * columns + ((c + 1) % columns),
        d = (r + 1) * columns + c,
        e = (r + 1) * columns + ((c + 1) % columns);
      indices.push(a, d, b, b, d, e);
    }
  const tipIndex = positions.length / 3;
  positions.push(tip.x, tip.y, tip.z);
  colors.push(0.6, 0.6, 0.64);
  for (let c = 0; c < columns; c++)
    indices.push((rows - 1) * columns + c, tipIndex, (rows - 1) * columns + ((c + 1) % columns));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('terrainPoint', new THREE.Float32BufferAttribute(positions.slice(), 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.userData.rim = rim;
  // The skin is a grid of rows (rim to the ring above the tip) by columns around, in that vertex order: the vines
  // read it to lie along the rock (vine-drape.mjs).
  g.userData.grid = { columns, rows };
  g.computeVertexNormals();
  return g;
}

// A weathered boulder: a smooth, indexed icosphere with lumpy displacement, a flattened base that sits
// on the ground and a slightly squared top. terrainPoint drives the basalt relief and moss shader.
export function createBoulderGeometry(THREE, { detail = 1, seed = 3 } = {}) {
  const source = new THREE.IcosahedronGeometry(1, detail),
    p = source.attributes.position,
    index = new Map(),
    positions = [],
    indices = [];
  for (let i = 0; i < p.count; i++) {
    const key = [p.getX(i), p.getY(i), p.getZ(i)].map(v => Math.round(v * 1e4)).join(',');
    let k = index.get(key);
    if (k === undefined) {
      k = positions.length / 3;
      index.set(key, k);
      positions.push(p.getX(i), p.getY(i), p.getZ(i));
    }
    indices.push(k);
  }
  source.dispose();
  const lump = (x, y, z) =>
    0.11 * Math.sin(x * 2.3 + seed) * Math.cos(z * 1.9 - seed * 0.7) +
    0.07 * Math.sin(y * 3.1 + x * 1.3 + seed * 1.9) +
    0.045 * Math.cos(z * 4.7 + y * 2.1 - seed);
  const colors = [];
  for (let i = 0; i < positions.length; i += 3) {
    let x = positions[i],
      y = positions[i + 1],
      z = positions[i + 2];
    const r = 1 + lump(x, y, z);
    x *= r;
    y *= r;
    z *= r;
    if (y < -0.32) y = -0.32 + (y + 0.32) * 0.22;
    if (y > 0.7) y = 0.7 + (y - 0.7) * 0.6;
    positions[i] = x;
    positions[i + 1] = y;
    positions[i + 2] = z;
    const tone = 0.74 + (0.2 * (y + 0.32)) / 1.02 + 0.06 * Math.sin(x * 5.1 + z * 3.7 + seed);
    colors.push(tone * 0.96, tone * 0.95, tone);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute(
    'terrainPoint',
    new THREE.Float32BufferAttribute(
      positions.map(v => v * 2.2),
      3
    )
  );
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}
