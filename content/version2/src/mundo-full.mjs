// Yughues Mundo CC0 derivative. Uses only the original Mundo geometry/maps.
import * as THREE from './vendor/three.module.js';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';

// Source whorls are disconnected leaf-card components. Copy complete whorls,
// never partial triangles or the trunk; retain UVs, normals and their stem roots.
export function buildMundoFullGeometries(source) {
  const p = source.attributes.position,
    uv = source.attributes.uv,
    index = source.index.array,
    parents = Array.from({ length: p.count }, (_, i) => i),
    weld = new Map();
  const root = i => {
      while (parents[i] !== i) i = parents[i] = parents[parents[i]];
      return i;
    },
    join = (a, b) => (parents[root(a)] = root(b));
  for (let i = 0; i < p.count; i++) {
    const key = [p.getX(i), p.getY(i), p.getZ(i)].map(v => v.toFixed(5)).join(',');
    weld.has(key) ? join(i, weld.get(key)) : weld.set(key, i);
  }
  for (let i = 0; i < index.length; i += 3) {
    join(index[i], index[i + 1]);
    join(index[i], index[i + 2]);
  }
  const groups = new Map();
  for (let i = 0; i < index.length; i += 3) {
    const key = root(index[i]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(...index.slice(i, i + 3));
  }
  const whorls = [...groups.values()]
    .filter(ids => {
      const ys = ids.map(i => p.getY(i));
      return (
        Math.min(...ys) > 0.3 &&
        Math.max(...ys) < 0.94 &&
        Math.max(...ys) - Math.min(...ys) > 0.12 &&
        uv.getX(ids[0]) < 0.65
      );
    })
    .sort((a, b) => Math.min(...a.map(i => p.getY(i))) - Math.min(...b.map(i => p.getY(i))));
  const shape = g => {
    const pos = g.attributes.position,
      n = g.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i),
        t = Math.max(0, Math.min(1, (y - 0.25) / 0.55)),
        gain = 1 + 0.24 * Math.sin((t * Math.PI) / 2),
        d = y > 0.25 && y < 0.8 ? (0.24 * Math.cos((t * Math.PI) / 2) * Math.PI) / 1.1 : 0,
        x = pos.getX(i),
        z = pos.getZ(i);
      pos.setXYZ(i, x * gain, y, z * gain);
      const v = new THREE.Vector3(
        n.getX(i) / gain,
        n.getY(i) - (d * (x * n.getX(i) + z * n.getZ(i))) / gain,
        n.getZ(i) / gain
      ).normalize();
      n.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  };
  const subset = ids => {
    const vertices = [...new Set(ids)],
      mapping = new Map(vertices.map((v, i) => [v, i])),
      g = new THREE.BufferGeometry();
    for (const [name, a] of Object.entries(source.attributes)) {
      const values = new Float32Array(vertices.length * a.itemSize);
      vertices.forEach((v, i) => {
        for (let k = 0; k < a.itemSize; k++) values[i * a.itemSize + k] = a.array[v * a.itemSize + k];
      });
      g.setAttribute(name, new THREE.BufferAttribute(values, a.itemSize));
    }
    g.setIndex(ids.map(i => mapping.get(i)));
    return g;
  };
  // Only the two apical cards use the upright needle sprig. Their source tops
  // differ by .255 m at central-tree scale; the atlas spine is also off-centre.
  // Register both opaque leaders on one axis and taper their upper widths. The
  // lower whorls, UVs, source asset, trunk and ornament hooks are unchanged.
  const base = shape(source.clone()),
    bp = base.attributes.position;
  const apexCards = [...groups.values()].filter(
    ids =>
      ids.length === 6 &&
      Math.min(...ids.map(i => p.getY(i))) > 0.85 &&
      Math.max(...ids.map(i => p.getY(i))) > 0.95 &&
      uv.getX(ids[0]) < 0.65
  );
  for (const ids of apexCards) {
    const vertices = [...new Set(ids)],
      left = vertices.reduce((a, b) => (uv.getX(a) < uv.getX(b) ? a : b)),
      right = vertices.reduce((a, b) => (uv.getX(a) > uv.getX(b) ? a : b));
    const u0 = uv.getX(left),
      u1 = uv.getX(right),
      spine = (314.5 / 1024 - u0) / (u1 - u0),
      axis = new THREE.Vector3()
        .fromBufferAttribute(bp, left)
        .lerp(new THREE.Vector3().fromBufferAttribute(bp, right), spine);
    const low = Math.min(...vertices.map(i => p.getY(i))),
      high = Math.max(...vertices.map(i => p.getY(i)));
    for (const i of vertices) {
      const t = (p.getY(i) - low) / (high - low),
        width = 0.8 - 0.4 * t;
      bp.setXYZ(
        i,
        (bp.getX(i) - axis.x) * width,
        0.865336716 + (1 - 0.865336716) * t,
        (bp.getZ(i) - axis.z) * width
      );
    }
  }
  base.computeBoundingBox();
  base.computeBoundingSphere();
  const extras = whorls.map((ids, j) => {
    const g = subset(ids);
    g.rotateY(Math.PI / 4 + (j % 2) * 0.13);
    g.scale(0.94, 0.96, 0.94);
    g.translate(0, 0.018, 0);
    return shape(g);
  });
  const near = mergeGeometries([base, ...extras]),
    middle = mergeGeometries([base, ...extras.filter((_, i) => i % 2 === 0)]);
  extras.forEach(g => g.dispose());
  for (const g of [near, middle]) {
    g.computeBoundingBox();
    g.computeBoundingSphere();
  }
  return [near, middle, base];
}

// Seven opaque pixels on the source atlas's woody branch spine. Interpolate UVs
// into the deformed triangle surface: every hook remains on the actual branch.
export function mundoBranchAnchors(geometry) {
  const p = geometry.attributes.position,
    uv = geometry.attributes.uv,
    ix = geometry.index.array,
    candidates = [];
  for (let t = 0; t < ix.length; t += 3) {
    const ids = [ix[t], ix[t + 1], ix[t + 2]],
      a = new THREE.Vector2().fromBufferAttribute(uv, ids[0]),
      b = new THREE.Vector2().fromBufferAttribute(uv, ids[1]),
      c = new THREE.Vector2().fromBufferAttribute(uv, ids[2]);
    if (Math.max(a.x, b.x, c.x) > 0.65) continue;
    const den = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
    if (Math.abs(den) < 1e-9) continue;
    for (const v of [0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75]) {
      const u = 0.31005859375,
        w1 = ((b.y - c.y) * (u - c.x) + (c.x - b.x) * (v - c.y)) / den,
        w2 = ((c.y - a.y) * (u - c.x) + (a.x - c.x) * (v - c.y)) / den,
        w3 = 1 - w1 - w2;
      if (Math.min(w1, w2, w3) < 0) continue;
      const point = new THREE.Vector3();
      [w1, w2, w3].forEach((w, j) =>
        point.addScaledVector(new THREE.Vector3().fromBufferAttribute(p, ids[j]), w)
      );
      candidates.push({ point: point.toArray(), triangle: t / 3, barycentric: [w1, w2, w3], uv: [u, v] });
    }
  }
  return [0.2, 0.32, 0.44, 0.56, 0.68, 0.8]
    .map((h, tier) => {
      const row = [];
      for (let sector = 0; sector < 8; sector++) {
        const angle = (sector * Math.PI) / 4 + tier * 0.23;
        let best,
          score = -Infinity;
        for (const c of candidates) {
          const [x, y, z] = c.point,
            r = Math.hypot(x, z),
            delta = Math.abs(
              Math.atan2(Math.sin(Math.atan2(x, z) - angle), Math.cos(Math.atan2(x, z) - angle))
            );
          if (Math.abs(y - h) > 0.055 || delta > 0.48 || r < 0.03) continue;
          const s = r - 1.8 * Math.abs(y - h);
          if (s > score) {
            score = s;
            best = { ...c, tier, sector };
          }
        }
        if (best) row.push(best);
      }
      return row;
    })
    .filter(r => r.length > 2);
}
function holidayDecoration(geometry, resources) {
  const group = new THREE.Group();
  group.name = 'Branch-supported holiday ornaments';
  const anchors = mundoBranchAnchors(geometry),
    wires = [],
    balls = [[], [], []],
    bulbs = [];
  const matrix = (p, s) => new THREE.Matrix4().compose(p, new THREE.Quaternion(), s);
  const tube = (points, r, steps = 6) => {
    const curve = new THREE.CatmullRomCurve3(points);
    wires.push(new THREE.TubeGeometry(curve, steps, r, 3, false));
  };
  for (const row of anchors) {
    for (let j = 0; j < row.length; j++) {
      const anchor = new THREE.Vector3(...row[j].point),
        next = new THREE.Vector3(...row[(j + 1) % row.length].point),
        mid = anchor.clone().lerp(next, 0.5);
      mid.y -= 0.018;
      tube([anchor, mid, next], 0.0015, 6);
      for (let k = 0; k < 3; k++) {
        const t = k / 3,
          p = anchor.clone().lerp(next, t);
        p.y -= Math.sin(t * Math.PI) * 0.018;
        bulbs.push(matrix(p, new THREE.Vector3(0.0038, 0.0048, 0.0038)));
      }
      const type = (row[j].sector + row[j].tier) % 3,
        drop = 0.013 + (j % 3) * 0.003,
        r = 0.0115 + (j % 3) * 0.002;
      const bottom = anchor.clone();
      bottom.y -= drop;
      tube([anchor, anchor.clone().lerp(bottom, 0.5), bottom], 0.0008, 2);
      const center = bottom.clone();
      center.y -= r * (type === 1 ? 1.55 : 1);
      balls[type].push({
        matrix: matrix(center, new THREE.Vector3(r, r * (type === 1 ? 1.55 : 1), r)),
        color: ['#d32928', '#eabb65', '#3da0a9', '#d7796a'][(j + row[j].tier) % 4]
      });
    }
  }
  const wireMat = new THREE.MeshStandardMaterial({ color: 0x5b4b27, roughness: 0.6, metalness: 0.45 }),
    toyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.27, metalness: 0.32 }),
    gold = new THREE.MeshStandardMaterial({
      color: 0xffd37a,
      emissive: 0xf7a638,
      emissiveIntensity: 0.48,
      roughness: 0.3,
      metalness: 0.6
    }),
    bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd998, toneMapped: false });
  const add = (g, m) => {
    const o = new THREE.Mesh(g, m);
    o.userData.dynamic = true;
    group.add(o);
    resources.add(g);
    resources.add(m);
    return o;
  };
  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 + Math.PI / 2,
      r = i % 2 ? 0.022 : 0.05,
      x = Math.cos(a) * r,
      y = Math.sin(a) * r;
    i ? starShape.lineTo(x, y) : starShape.moveTo(x, y);
  }
  starShape.closePath();
  const starGeometry = new THREE.ExtrudeGeometry(starShape, {
    depth: 0.009,
    bevelEnabled: true,
    bevelSize: 0.002,
    bevelThickness: 0.002,
    bevelSegments: 1,
    steps: 1
  });
  const star = add(starGeometry, gold);
  star.rotation.y = 0.25;
  const p = geometry.attributes.position;
  let top = 0;
  for (let i = 1; i < p.count; i++)
    if (geometry.attributes.uv.getX(i) > 0.65 && p.getY(i) > p.getY(top)) top = i;
  const tip = new THREE.Vector3().fromBufferAttribute(p, top);
  // Seat the topper on the actual straightened leader, with a short straight stem.
  star.position.copy(tip).add(new THREE.Vector3(0, 0.04, -0.0045));
  tube(
    [tip.clone().add(new THREE.Vector3(0, -0.012, 0)), tip, tip.clone().add(new THREE.Vector3(0, 0.03, 0))],
    0.0018,
    3
  );
  add(mergeGeometries(wires), wireMat);
  wires.forEach(g => g.dispose());
  const toyGeometry = [
    new THREE.SphereGeometry(1, 10, 6),
    new THREE.SphereGeometry(1, 8, 5),
    new THREE.OctahedronGeometry(1)
  ];
  for (let kind = 0; kind < 3; kind++) {
    const items = balls[kind],
      o = new THREE.InstancedMesh(toyGeometry[kind], toyMat, items.length);
    items.forEach((v, i) => {
      o.setMatrixAt(i, v.matrix);
      o.setColorAt(i, new THREE.Color(v.color));
    });
    o.computeBoundingSphere();
    o.userData.dynamic = true;
    group.add(o);
    resources.add(o);
    resources.add(toyGeometry[kind]);
  }
  resources.add(toyMat);
  const glowGeometry = new THREE.IcosahedronGeometry(1, 0),
    lights = new THREE.InstancedMesh(glowGeometry, bulbMat, bulbs.length);
  bulbs.forEach((m, i) => lights.setMatrixAt(i, m));
  lights.computeBoundingSphere();
  lights.userData.dynamic = true;
  group.add(lights);
  resources.add(lights);
  resources.add(glowGeometry);
  resources.add(bulbMat);
  return {
    group,
    anchors,
    ornaments: balls.reduce((n, a) => n + a.length, 0),
    bulbs: bulbs.length,
    topSupport: top
  };
}

export function createMundoFullPine(asset, resources) {
  const levels = buildMundoFullGeometries(asset.geometry);
  [asset.geometry, asset.material, ...asset.textures, ...levels].forEach(r => resources.add(r));
  const object = new THREE.Group();
  object.name = 'Mundo fuller CC0 pine';
  object.position.set(-0.8, 0.2, -2.15);
  object.scale.set(8, 11.05, 8);
  object.rotation.y = 0.24;
  object.userData.dynamic = true;
  const tree = new THREE.Mesh(levels[0], asset.material);
  tree.userData.dynamic = true;
  object.add(tree);
  const decoration = holidayDecoration(levels[2], resources);
  object.add(decoration.group);
  let economy = false,
    lod = 0;
  const rootGroup = new THREE.Group();
  rootGroup.name = 'Mundo CC0 selected firs';
  rootGroup.add(object);
  rootGroup.userData.dynamic = true;
  const small = [],
    collisionObjects = [tree];
  let smallBatches = null,
    smallLod = 0;
  const addSmall = (x, z, scale, base) => {
    if (small.length >= 6 || scale < 1) return false;
    const p = new THREE.Object3D();
    p.position.set(x, base + 0.2, z);
    p.scale.set(2.1 * scale, 2.9 * scale, 2.1 * scale);
    p.rotation.y = 0.4 + small.length * 1.7;
    p.updateMatrix();
    small.push(p);
    const collider = new THREE.Mesh(levels[2], asset.material);
    collider.matrix.copy(p.matrix);
    collider.matrixAutoUpdate = false;
    collider.visible = false;
    collider.userData.dynamic = true;
    rootGroup.add(collider);
    collisionObjects.push(collider);
    if (small.length === 6) {
      smallBatches = [0, 2].map(l => {
        const copies = small.map(o => levels[l].clone().applyMatrix4(o.matrix)),
          g = mergeGeometries(copies);
        copies.forEach(c => c.dispose());
        resources.add(g);
        const mesh = new THREE.Mesh(g, asset.material);
        mesh.userData.dynamic = true;
        mesh.visible = l === 0;
        rootGroup.add(mesh);
        return mesh;
      });
    }
    return true;
  };
  rootGroup.updateMatrixWorld(true);
  return {
    object: rootGroup,
    collisionObjects,
    addSmall,
    plantExclusionBounds: () => small.map(o => levels[0].boundingBox.clone().applyMatrix4(o.matrix)),
    setEconomy: value => (economy = value),
    update: camera => {
      const d = camera.position.distanceTo(new THREE.Vector3(-0.8, 5.7, -2.15)),
        m = economy ? 0.82 : 1;
      let next = lod;
      if (lod === 0 && d > 36 * m * 1.12) next = 1;
      else if (lod === 1 && d < 36 * m * 0.88) next = 0;
      if (lod === 1 && d > 76 * m * 1.12) next = 2;
      else if (lod === 2 && d < 76 * m * 0.88) next = 1;
      if (next !== lod) {
        lod = next;
        tree.geometry = levels[lod];
      }
      if (smallBatches) {
        const distance = Math.min(
          ...small.map(o => camera.position.distanceTo(o.position.clone().add(new THREE.Vector3(0, 1.4, 0))))
        );
        let nextSmall = smallLod;
        if (!smallLod && distance > 19 * m * 1.12) nextSmall = 1;
        else if (smallLod && distance < 19 * m * 0.88) nextSmall = 0;
        if (nextSmall !== smallLod) {
          smallLod = nextSmall;
          smallBatches.forEach((o, i) => (o.visible = i === smallLod));
        }
      }
    },
    setSeason: season => {
      asset.material.map = season === 'winter' ? asset.winter : asset.diffuse;
      asset.material.color.setRGB(...(season === 'winter' ? [1.12, 1.12, 1.12] : [2.7, 3.0, 2.3]));
      decoration.group.visible = season === 'winter';
    },
    audit: () => ({
      variant: 'mundo-full',
      author: 'Yughues',
      license: 'CC0',
      source: 'Mundo only; original geometry/three 1024px maps unchanged',
      lod,
      triangles: tree.geometry.index.count / 3,
      lodTriangles: levels.map(g => g.index.count / 3),
      draws: 1 + (smallBatches ? 1 : 0) + (decoration.group.visible ? 6 : 0),
      smallTrees: small.map(o => ({ position: o.position.toArray(), height: o.scale.y, lod: smallLod })),
      smallTriangles: (small.length * levels[smallLod ? 2 : 0].index.count) / 3,
      smallBatchPolicy: 'Six existing front firs, one draw, nearest selects shared volumetric LOD',
      textureCount: 3,
      maxTextureSize: 1024,
      textureRgbaWithMipsBytes: (3 * 1024 * 1024 * 4 * 4) / 3,
      geometryCpuBytes:
        (smallBatches || []).reduce(
          (n, o) =>
            n +
            o.geometry.index.array.byteLength +
            Object.values(o.geometry.attributes).reduce((s, a) => s + a.array.byteLength, 0),
          0
        ) +
        levels.reduce(
          (n, g) =>
            n +
            g.index.array.byteLength +
            Object.values(g.attributes).reduce((s, a) => s + a.array.byteLength, 0),
          0
        ),
      root: object.position.toArray(),
      height: 11.05,
      spreadScale: 8,
      alphaTest: 0.38,
      alphaToCoverage: true,
      depthWrite: true,
      transparent: false,
      winter: decoration.group.visible,
      decoration: {
        visible: decoration.group.visible,
        ornaments: decoration.ornaments,
        bulbs: decoration.bulbs,
        star: true,
        branchSupports: decoration.anchors.flat().length,
        support: 'Barycentric points on opaque Mundo branch-spine pixels; sagging cords'
      },
      snow: 'Original Mundo half-snow map; identical alpha, no extra planes'
    })
  };
}
