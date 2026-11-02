// Isolated model study; no imports, global state or production integration.
// Local axes match greenhouse.mjs: -Z entrance, floor Y=.486.
export const SAMPLE = Object.freeze({
  floor: 0.486,
  front: -1.6,
  back: 12.275,
  sideX: 3.1,
  rearX: 3.1,
  shoulderZ: 6.0,
  eave: 4.35,
  ridge: 5.8,
  doorHalf: 1.4,
  doorTop: 3.95,
  sign: { x: 0, y: 4.64, z: -1.7, width: 2.6, height: 0.5 },
  badge: { x: 0, y: 5.42, z: -1.78 },
  hero: { x: 0, y: 2.62, z: 11.875, width: 2.7, height: 1.574 },
  lamps: [
    { x: 0, y: 5.1, z: 0.4 },
    { x: 0, y: 5.1, z: 9.4 }
  ],
  // The original front and entry clearance are unchanged; the full-width body extends to exactly 2.5 original lengths.
  footprint: [
    [-3.1, -1.6],
    [3.1, -1.6],
    [3.1, 12.275],
    [-3.1, 12.275]
  ]
});

export function buildGallerySample(
  THREE,
  { signMaterial = null, accent = '#a895e5', lights = true, mergeStatic = true, content = {} } = {}
) {
  const g = new THREE.Group();
  g.name = 'gallery-single-stone-study';
  const resources = new Set(),
    blockers = [],
    plants = [];
  const material = options => {
    const m = new THREE.MeshStandardMaterial(options);
    resources.add(m);
    return m;
  };
  const stone = material({ color: 0x918c83, roughness: 0.94 });
  const stoneLight = material({ color: 0xa39b8f, roughness: 0.91 });
  const metal = material({ color: 0x41464b, roughness: 0.7, metalness: 0.2 });
  const floorMat = material({ color: 0x797c75, roughness: 0.96 });
  // The floor slab stands on the island path millimetres under its top: kept in front of it at any distance.
  Object.assign(floorMat, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
  const glass = material({
    color: 0xa9bec4,
    roughness: 0.28,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const accentMat = material({ color: accent, roughness: 0.5, emissive: accent, emissiveIntensity: 0.09 });
  const lampMat = material({ color: 0xffd6a0, emissive: 0xffbf78, emissiveIntensity: 1.2 });
  const leafMat = material({ color: 0x486248, roughness: 0.94 });
  const soil = material({ color: 0x3e3a31, roughness: 1 });
  const add = (name, geometry, mat, x = 0, y = 0, z = 0) => {
    resources.add(geometry);
    const m = new THREE.Mesh(geometry, mat);
    m.name = name;
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  const box = (name, w, h, d, x, y, z, mat = stone) =>
    add(name, new THREE.BoxGeometry(w, h, d), mat, x, y, z);
  const beam = (name, a, b, width, mat = metal) => {
    const av = new THREE.Vector3(...a),
      bv = new THREE.Vector3(...b),
      delta = bv.clone().sub(av);
    const m = box(
      name,
      width,
      delta.length(),
      width,
      ...av.clone().add(bv).multiplyScalar(0.5).toArray(),
      mat
    );
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    return m;
  };
  const wall = (name, a, b, bottom, top, mat = stone, thickness = 0.12) => {
    const dx = b[0] - a[0],
      dz = b[1] - a[1];
    const m = box(
      name,
      Math.hypot(dx, dz),
      top - bottom,
      thickness,
      (a[0] + b[0]) / 2,
      (bottom + top) / 2,
      (a[1] + b[1]) / 2,
      mat
    );
    m.rotation.y = -Math.atan2(dz, dx);
    if (mat !== glass) blockers.push(m);
    return m;
  };
  // Inset support is a closed shallow slab, never a floating floor plane.
  const shape = new THREE.Shape();
  SAMPLE.footprint.forEach(([x, z], i) => (i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)));
  shape.closePath();
  const slab = new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: false, steps: 1 });
  slab.rotateX(-Math.PI / 2);
  slab.translate(0, SAMPLE.floor - 0.14, 0);
  add('stone-supported-floor', slab, floorMat);
  const f = SAMPLE.floor,
    sill = 1.48,
    e = SAMPLE.eave;
  for (const side of [-1, 1]) {
    // Solid base + separated windows; no exterior timber lattice.
    wall('stone-side-base', [side * 3.04, -1.54], [side * 3.04, 12.215], f, sill);
    wall('side-window', [side * 3.04, -1.4], [side * 3.04, 12.08], sill, e - 0.22, glass, 0.025);
    wall('stone-side-head', [side * 3.04, -1.54], [side * 3.04, 12.215], e - 0.22, e, stoneLight);
    for (const z of [-1.4, 0.3, 1.98, 4.0, 6.0, 8.0, 10.0, 12.08])
      blockers.push(box('stone-window-pier', 0.12, e - sill, 0.26, side * 3.04, (e + sill) / 2, z));
    // Rear shoulders provide calm opaque exhibit walls instead of all-glass enclosure.
    // Continuous full-width walls; no tapered rear annex.
    wall('front-stone-cheek', [side * 1.47, -1.54], [side * 3.04, -1.54], f, e);
    beam('metal-door-jamb', [side * 1.4, f, -1.6], [side * 1.4, 3.95, -1.6], 0.09, accentMat);
  }
  wall('stone-rear-wall', [-3.04, 12.215], [3.04, 12.215], f, e);
  beam('metal-door-head', [-1.4, 3.95, -1.6], [1.4, 3.95, -1.6], 0.09, accentMat);
  wall('front-transom', [-1.4, -1.6], [1.4, -1.6], 4.0, e, glass, 0.025);
  // Roof retains ridge/eaves heights, glazing, accent ridge and warm pendants.
  const sections = [
    [-1.6, 3.1],
    [1.175, 3.1],
    [3.95, 3.1],
    [6.725, 3.1],
    [9.5, 3.1],
    [12.275, 3.1]
  ];
  for (const side of [-1, 1]) {
    const p = [];
    for (let i = 0; i < sections.length - 1; i++) {
      const [za, xa] = sections[i],
        [zb, xb] = sections[i + 1];
      const a = [0, 5.8, za],
        b = [side * xa, 4.35, za],
        c = [side * xb, 4.35, zb],
        d = [0, 5.8, zb];
      p.push(...a, ...b, ...c, ...a, ...c, ...d);
      beam('metal-eave', [side * xa, 4.35, za], [side * xb, 4.35, zb], 0.07);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    geo.computeVertexNormals();
    add('retained-glazed-roof', geo, glass).renderOrder = 3;
    for (const [z, x] of sections) beam('metal-rafter', [0, 5.8, z], [side * x, 4.35, z], 0.065);
  }
  beam('accent-roof-ridge', [0, 5.8, -1.67], [0, 5.8, 12.345], 0.085, accentMat);
  // Front/rear gable glazing closes the roof without an exterior wood frame.
  for (const [z, x] of [sections[0], sections.at(-1)]) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-x, e, z, x, e, z, 0, 5.8, z], 3));
    geo.computeVertexNormals();
    add('gable-glazing', geo, glass);
  }
  const sign = add(
    'preserved-project-name',
    new THREE.PlaneGeometry(2.6, 0.5),
    signMaterial || accentMat,
    0,
    4.64,
    -1.7
  );
  sign.rotation.y = Math.PI;
  sign.userData.materialSlot = 'existing-greenhouse-sign';
  for (const p of SAMPLE.lamps) {
    beam('pendant-cord', [p.x, 5.75, p.z], [p.x, 5.2, p.z], 0.015);
    add('pendant-shade', new THREE.CylinderGeometry(0.1, 0.23, 0.16, 10, 1, true), metal, p.x, 5.2, p.z);
    add('warm-pendant', new THREE.SphereGeometry(0.075, 8, 6), lampMat, p.x, 5.1, p.z);
    if (lights) {
      const light = new THREE.PointLight(0xffd2a0, 0.8, 7, 2);
      light.position.set(p.x, p.y, p.z);
      g.add(light);
    }
  }
  // Two plants only, outside the entry/hero sight line, with staggered leaf heights.
  for (const side of [-1, 1]) {
    const x = side * 1.63,
      z = 11.455;
    add('stone-plant-pot', new THREE.CylinderGeometry(0.26, 0.22, 0.46, 8), stoneLight, x, f + 0.23, z);
    add('plant-soil', new THREE.CircleGeometry(0.235, 8).rotateX(-Math.PI / 2), soil, x, f + 0.465, z);
    for (let i = 0; i < 5; i++) {
      const a = i * 2.399 + side,
        tip = [x + Math.cos(a) * 0.22, f + 0.92 + i * 0.12, z + Math.sin(a) * 0.18];
      beam('plant-stem', [x, f + 0.45, z], tip, 0.018, leafMat);
      const leaf = add('plant-leaf', new THREE.SphereGeometry(1, 6, 4), leafMat, ...tip);
      leaf.scale.set(0.12, 0.24, 0.055);
      leaf.rotation.set(0.3, a, side * 0.4);
    }
    plants.push({ x, z, radius: 0.4 });
  }
  // Content materials are borrowed: the existing runtime retains loading, translation,
  // video, notes updates and disposal. Each face remains independently pickable.
  const face = (name, w, h, x, y, z, yaw, mat) => {
    const m = add(name, new THREE.PlaneGeometry(w, h), mat || metal, x, y, z);
    m.rotation.y = yaw;
    m.userData.interactive = true;
    return m;
  };
  const h = SAMPLE.hero;
  for (const x of [-1, 1]) box('hero-wall-bracket', 0.12, 0.12, 0.26, x, h.y, h.z + 0.18, metal);
  box('hero-stone-frame', h.width + 0.12, h.height + 0.12, 0.08, 0, h.y, h.z + 0.06, stoneLight);
  const screen = face('project-screen', h.width, h.height, 0, h.y, h.z, Math.PI, content.screenMaterial);
  const open = face('open-project', 1.3, 0.3, 0, 1.48, h.z - 0.02, Math.PI, content.openMaterial);
  const boards = [
    {
      zone: 'description',
      own: false,
      board: face(
        'description-board',
        2.1,
        1.3125,
        -2.87,
        2.35,
        0.05,
        Math.PI / 2,
        content.descriptionMaterial
      )
    },
    {
      zone: 'comments',
      own: true,
      board: face('comments-board', 2.1, 1.3125, 2.87, 2.35, 0.05, -Math.PI / 2, content.commentsMaterial)
    }
  ];
  for (const { board } of boards)
    box('stone-board-frame', 0.07, 1.4325, 2.22, Math.sign(board.position.x) * 2.94, 2.35, 0.05, stoneLight);
  // Four atlas cells preserve the original faceIndex/2 -> gallery.images contract.
  const galleryParts = [];
  for (let k = 0; k < 4; k++) {
    const side = k < 2 ? -1 : 1,
      z = 1.65,
      y = k % 2 ? 3.1 : 2.1;
    const m = face(
      'gallery-cell-' + k,
      0.8,
      (0.8 * 272) / 384,
      side * 2.86,
      y,
      z,
      (-side * Math.PI) / 2,
      content.galleryMaterial
    );
    box('stone-exhibit-frame', 0.06, (0.8 * 272) / 384 + 0.1, 0.9, side * 2.92, y, z, stoneLight);
    const uv = m.geometry.attributes.uv;
    for (let n = 0; n < uv.count; n++)
      uv.setXY(n, ((k % 2) + uv.getX(n)) / 2, (1 - Math.floor(k / 2) + uv.getY(n)) / 2);
    galleryParts.push(m);
  }
  const mergeParts = (parts, name) => {
    const arrays = { position: [], normal: [], uv: [] };
    for (const m of parts) {
      m.updateMatrix();
      const geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      geo.applyMatrix4(m.matrix);
      for (const key of Object.keys(arrays)) arrays[key].push(...geo.attributes[key].array);
      geo.dispose();
    }
    const geo = new THREE.BufferGeometry();
    for (const [key, data] of Object.entries(arrays))
      geo.setAttribute(key, new THREE.Float32BufferAttribute(data, key === 'uv' ? 2 : 3));
    const result = add(name, geo, parts[0].material);
    for (const m of parts) g.remove(m);
    return result;
  };
  const gallery = {
    object: mergeParts(galleryParts, 'project-gallery-atlas'),
    images: content.galleryImages || [0, 1, 2, 3]
  };
  gallery.object.userData.interactive = true;
  // Only actual content cells are drawn; placeholders do not masquerade as live content.
  const count = Math.min(4, content.galleryImages?.length ?? 0);
  gallery.object.geometry.setDrawRange(0, count * 6);
  gallery.images = gallery.images.slice(0, count);
  screen.visible = !!content.screenMaterial;
  open.visible = !!content.openMaterial;
  boards[0].board.visible = !!content.descriptionMaterial;
  boards[1].board.visible = !!content.commentsMaterial;
  g.userData.badgeAnchor = { ...SAMPLE.badge };
  if (mergeStatic) {
    const batches = new Map();
    for (const m of [...g.children]) {
      if (
        !m.isMesh ||
        m === sign ||
        m.material.transparent ||
        m.userData.interactive ||
        m.name === 'stone-supported-floor'
      )
        continue;
      if (!batches.has(m.material)) batches.set(m.material, []);
      batches.get(m.material).push(m);
    }
    for (const parts of batches.values())
      if (parts.length > 1) mergeParts(parts, 'static-' + parts[0].material.uuid);
    // Retain collision proxies with the same parent transform but no render cost.
    const collision = new THREE.Group();
    collision.name = 'logical-blockers';
    collision.visible = false;
    g.add(collision);
    for (const m of blockers) if (!m.parent) collision.add(m);
  }
  g.userData.pickOccluders = g.children.filter(
    m => m.isMesh && m !== sign && !m.userData.interactive && !m.material.transparent
  );
  const inside = (x, z) => {
    if (z < SAMPLE.front || z > SAMPLE.back) return false;
    const limit = SAMPLE.sideX;
    return Math.abs(x) <= limit;
  };
  return {
    group: g,
    sign,
    screen,
    open,
    gallery,
    boards,
    inside,
    blockers,
    lamps: SAMPLE.lamps,
    plants,
    heroAnchor: SAMPLE.hero,
    loadPictures: content.loadPictures,
    pinNotes: content.pinNotes,
    dispose() {
      g.userData.pickOccluders.length = 0;
      for (const resource of resources) resource.dispose();
      g.removeFromParent();
    }
  };
}
