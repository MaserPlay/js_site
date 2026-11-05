// LOLIPOP / CC BY 4.0. Local opt-in selection; see assets/lolipop-fir/README.md.
import * as THREE from './vendor/three.module.js';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';
import { gardenFile } from './garden-paths.mjs';

export function parseFirGeometry(manifest, buffer) {
  const types = { Float32Array, Uint16Array, Uint32Array },
    trees = {};
  for (const [id, tree] of Object.entries(manifest.trees))
    trees[id] = tree.levels.map(parts =>
      parts.map(part => {
        const g = new THREE.BufferGeometry();
        for (const key of ['position', 'normal', 'uv', 'index']) {
          const a = part[key],
            attr = new THREE.BufferAttribute(
              new types[a.type](buffer, a.offset, a.count * a.itemSize),
              a.itemSize
            );
          key === 'index' ? g.setIndex(attr) : g.setAttribute(key, attr);
        }
        g.computeBoundingBox();
        g.computeBoundingSphere();
        return g;
      })
    );
  return trees;
}
export async function loadLolipopFirs() {
  const started = performance.now(),
    root = gardenFile('assets/lolipop-fir/'),
    textures = [],
    owned = [];
  try {
    const response = await fetch(root + 'firs.json');
    if (!response.ok) throw Error('Fir manifest HTTP ' + response.status);
    const manifest = await response.json(),
      data = await fetch(root + manifest.buffer);
    if (!data.ok) throw Error('Fir geometry HTTP ' + data.status);
    const buffer = await data.arrayBuffer(),
      trees = parseFirGeometry(manifest, buffer);
    Object.values(trees)
      .flat(2)
      .forEach(g => owned.push(g));
    const results = await Promise.allSettled(
      ['bark.jpg', 'bark-normal.jpg', 'needles.png', 'needles-normal.jpg'].map(async name => {
        const t = await new THREE.TextureLoader().loadAsync(root + name);
        textures.push(t);
        return t;
      })
    );
    const failure = results.find(r => r.status === 'rejected');
    if (failure) throw failure.reason;
    const [bark, barkNormal, needles, needleNormal] = results.map(r => r.value);
    bark.colorSpace = needles.colorSpace = THREE.SRGBColorSpace;
    for (const t of textures) {
      t.flipY = false;
      t.anisotropy = 4;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
    }
    const materials = [
      new THREE.MeshStandardMaterial({
        map: bark,
        normalMap: barkNormal,
        normalScale: new THREE.Vector2(0.55, 0.55),
        roughness: 0.94
      }),
      new THREE.MeshStandardMaterial({
        map: needles,
        normalMap: needleNormal,
        normalScale: new THREE.Vector2(0.5, 0.5),
        color: 0xffffff,
        roughness: 0.94,
        side: THREE.DoubleSide,
        alphaTest: 0.38,
        alphaToCoverage: true,
        transparent: false,
        depthWrite: true
      })
    ];
    materials[1].color.setRGB(1.32, 1.4, 1.25);
    const snow = { value: 0 };
    materials[1].onBeforeCompile = shader => {
      shader.uniforms.firSnow = snow;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vFirUp;')
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvFirUp = max(0.0, (mat3(modelMatrix) * normal).y / max(length(mat3(modelMatrix) * normal), 0.0001));'
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float firSnow; varying float vFirUp;')
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
        float firGrain = sin(vMapUv.x * 167.0 + sin(vMapUv.y * 89.0)) * sin(vMapUv.y * 193.0);
        float firCover = firSnow * smoothstep(0.18, 0.72, vFirUp) * (0.68 + 0.25 * firGrain);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.83, 0.88), clamp(firCover, 0.0, 0.94));`
        );
    };
    materials[1].customProgramCacheKey = () => 'lolipop-surface-snow-v1';
    owned.push(...materials, ...textures);
    return {
      variant: 'lolipop',
      trees,
      materials,
      textures,
      snow,
      resources: owned,
      geometryBytes: buffer.byteLength,
      loadMs: performance.now() - started
    };
  } catch (error) {
    owned.forEach(r => r.dispose());
    textures.filter(t => !owned.includes(t)).forEach(t => t.dispose());
    throw error;
  }
}

// Select supports ON the artist's woody branch mesh, never on an idealized cone.
export function firBranchAnchors(geometry) {
  const p = geometry.attributes.position,
    rows = [];
  for (const [tier, h] of [0.16, 0.29, 0.42, 0.55, 0.68, 0.81].entries()) {
    const row = [];
    for (let sector = 0; sector < 8; sector++) {
      const angle = (sector * Math.PI) / 4 + tier * 0.29;
      let best = null,
        score = -Infinity;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i),
          y = p.getY(i),
          z = p.getZ(i),
          radius = Math.hypot(x, z),
          delta = Math.abs(
            Math.atan2(Math.sin(Math.atan2(x, z) - angle), Math.cos(Math.atan2(x, z) - angle))
          );
        if (Math.abs(y - h) > 0.067 || delta > 0.46 || radius < 0.025) continue;
        const value = radius - 3 * Math.abs(y - h) * 0.12;
        if (value > score) {
          score = value;
          best = { point: [x, y, z], vertex: i, tier, sector };
        }
      }
      if (best) row.push(best);
    }
    if (row.length > 2) rows.push(row);
  }
  return rows;
}
function holidayDecoration(geometry, resources) {
  const group = new THREE.Group();
  group.name = 'Branch-supported holiday ornaments';
  const anchors = firBranchAnchors(geometry),
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
  for (let i = 1; i < p.count; i++) if (p.getY(i) > p.getY(top)) top = i;
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

export function createLolipopFirs(asset, resources) {
  asset.resources.forEach(r => resources.add(r));
  const object = new THREE.Group();
  object.name = 'LOLIPOP fir selection';
  object.userData.dynamic = true;
  const central = new THREE.Group();
  central.position.set(-0.8, 0.2, -2.15);
  central.scale.set(11.05, 11.05, 11.05);
  central.rotation.y = 0.24;
  object.add(central);
  const trees = [],
    small = [];
  let economy = false,
    smallLod = 0,
    smallBatches = null;
  function addTree(parent, id) {
    const levels = asset.trees[id].map(parts =>
      parts.map((g, i) => {
        const o = new THREE.Mesh(g, asset.materials[i]);
        o.userData.dynamic = true;
        parent.add(o);
        return o;
      })
    );
    const entry = { parent, id, levels, lod: 0 };
    levels.forEach((parts, l) => parts.forEach(o => (o.visible = l === 0)));
    trees.push(entry);
    return entry;
  }
  const main = addTree(central, '3'),
    decoration = holidayDecoration(asset.trees[3][0][0], resources);
  central.add(decoration.group);
  const collisionObjects = [...main.levels[0]];
  function addSmall(x, z, scale, base) {
    if (small.length >= 6 || scale < 1) return false;
    const id = String(7 + (small.length % 3)),
      parent = new THREE.Group();
    parent.position.set(x, base + 0.2, z);
    parent.scale.set(2.02 * scale, 2.9 * scale, 2.02 * scale);
    parent.rotation.y = 0.4 + small.length * 1.7;
    object.add(parent);
    const entry = addTree(parent, id);
    small.push(entry);
    collisionObjects.push(...entry.levels[0]);
    if (small.length === 6) {
      // Six bounded trees fit one shared two-material batch per LOD. The nearest
      // tree chooses the group LOD: at most 1,546 extra triangles, ten fewer draws
      // than six independent trees. Preserve individual meshes for collision audit.
      smallBatches = [0, 1, 2].map(lod =>
        [0, 1].map(part => {
          const copies = small.map(t => {
            t.parent.updateMatrix();
            return asset.trees[t.id][lod][part].clone().applyMatrix4(t.parent.matrix);
          });
          const g = mergeGeometries(copies);
          copies.forEach(c => c.dispose());
          const o = new THREE.Mesh(g, asset.materials[part]);
          o.userData.dynamic = true;
          o.visible = lod === 0;
          object.add(o);
          resources.add(g);
          return o;
        })
      );
      small.forEach(t => t.levels.flat().forEach(o => (o.visible = false)));
    }
    return true;
  }
  function update(camera) {
    const center = new THREE.Vector3();
    for (const t of smallBatches ? [main] : trees) {
      t.parent.getWorldPosition(center);
      center.y += t === main ? 5.5 : 1.3;
      const distance = camera.position.distanceTo(center),
        near = t === main ? 32 : 15,
        far = t === main ? 80 : 35,
        mult = economy ? 0.82 : 1;
      let lod = t.lod;
      // Hysteresis avoids flicker at a boundary; even economy retains the close LOD.
      if (lod === 0 && distance > near * mult * 1.12) lod = 1;
      else if (lod === 1 && distance < near * mult * 0.88) lod = 0;
      if (lod === 1 && distance > far * mult * 1.12) lod = 2;
      else if (lod === 2 && distance < far * mult * 0.88) lod = 1;
      if (lod !== t.lod) {
        t.lod = lod;
        t.levels.forEach((parts, l) => parts.forEach(o => (o.visible = l === lod)));
      }
    }
    if (smallBatches) {
      const distance = Math.min(
          ...small.map(t => {
            t.parent.getWorldPosition(center);
            center.y += 1.3;
            return camera.position.distanceTo(center);
          })
        ),
        mult = economy ? 0.82 : 1;
      let lod = smallLod;
      if (lod === 0 && distance > 15 * mult * 1.12) lod = 1;
      else if (lod === 1 && distance < 15 * mult * 0.88) lod = 0;
      if (lod === 1 && distance > 35 * mult * 1.12) lod = 2;
      else if (lod === 2 && distance < 35 * mult * 0.88) lod = 1;
      if (lod !== smallLod) {
        smallLod = lod;
        small.forEach(t => (t.lod = lod));
        smallBatches.forEach((parts, l) => parts.forEach(o => (o.visible = l === lod)));
      }
    }
  }
  object.updateMatrixWorld(true);
  return {
    object,
    collisionObjects,
    addSmall,
    update,
    setEconomy: value => (economy = value),
    setSeason: season => {
      asset.snow.value = season === 'winter' ? 1 : 0;
      decoration.group.visible = season === 'winter';
    },
    audit: () => ({
      variant: 'lolipop',
      author: 'LOLIPOP (@lolipop_1707)',
      license: 'CC BY 4.0',
      source: 'f58e8b6d733e4b0586e5b7db847b89e7',
      centralTree: 3,
      smallTrees: small.map(t => ({
        id: t.id,
        lod: t.lod,
        position: t.parent.position.toArray(),
        height: t.parent.scale.y
      })),
      lods: trees.map(t => t.lod),
      treeTriangles: trees.reduce(
        (n, t) => n + asset.trees[t.id][t.lod].reduce((a, g) => a + g.index.count / 3, 0),
        0
      ),
      draws: (smallBatches ? 4 : trees.length * 2) + (decoration.group.visible ? 6 : 0),
      smallBatchPolicy: 'nearest small tree selects shared LOD; 2 draws for six trees',
      geometryBytes: asset.geometryBytes,
      textureRgbaWithMipsBytes: ((2 * 1024 * 1024 + 2 * 256 * 512) * 4 * 4) / 3,
      textureCount: 4,
      maxTextureSize: 1024,
      alphaTest: 0.38,
      depthWrite: true,
      transparent: false,
      alphaToCoverage: true,
      loadMs: asset.loadMs,
      winter: asset.snow.value === 1,
      decoration: {
        visible: decoration.group.visible,
        ornaments: decoration.ornaments,
        bulbs: decoration.bulbs,
        star: true,
        branchSupports: decoration.anchors.flat().length,
        support: 'vertices of source LOD0 bark; cords sag between supports'
      },
      snow: 'paint on upward needle surfaces, identical alpha; no overlay geometry'
    })
  };
}
