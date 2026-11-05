// The Cosmonautics Day rocket: a small white rocket with a red nose, a blue band, a porthole and four red fins,
// and its flame. Built once, in a unit length along +y (nose up, centred on the origin), as two merged meshes
// (one draw for the hull, one additive draw for the flame); celebrations.mjs scales it to the view, flies it
// along its path and leaves the trail in the shared spark pool.

export const ROCKET_MODEL = {
  // Lathe profile [radius, y] from the nozzle to the nose.
  profile: [
    [0.06, -0.5],
    [0.095, -0.43],
    [0.115, -0.4],
    [0.13, -0.2],
    [0.13, 0.12],
    [0.12, 0.24],
    [0.095, 0.34],
    [0.055, 0.43],
    [0.0, 0.5]
  ],
  segments: 18,
  white: [0.93, 0.94, 0.96],
  red: [0.86, 0.1, 0.08],
  blue: [0.12, 0.25, 0.62],
  grey: [0.34, 0.35, 0.38],
  flame: { outer: [1, 0.45, 0.08], inner: [1, 0.92, 0.6], length: 0.42, radius: 0.085 }
};

// Non-indexed copies of several geometries in one, each painted one colour (or by a function of y).
function merge(THREE, parts) {
  const positions = [],
    normals = [],
    colours = [];
  for (const { geometry, colour } of parts) {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    flat.computeVertexNormals();
    const p = flat.attributes.position,
      n = flat.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      positions.push(p.getX(i), p.getY(i), p.getZ(i));
      normals.push(n.getX(i), n.getY(i), n.getZ(i));
      colours.push(...(typeof colour === 'function' ? colour(p.getY(i)) : colour));
    }
    if (flat !== geometry) flat.dispose();
    geometry.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  return out;
}

export function createRocketModel(THREE) {
  const M = ROCKET_MODEL,
    hull = new THREE.LatheGeometry(
      M.profile.map(([r, y]) => new THREE.Vector2(r, y)),
      M.segments
    ),
    paint = y => {
      if (y > 0.235) return M.red;
      if (y > 0.02 && y < 0.07) return M.blue;
      if (y < -0.39) return M.grey;
      return M.white;
    },
    fins = [];
  // A swept fin in the x-y plane, thin in z, turned to four sides.
  const fin = new THREE.Shape();
  fin.moveTo(0.11, -0.12);
  fin.lineTo(0.27, -0.42);
  fin.lineTo(0.27, -0.5);
  fin.lineTo(0.11, -0.38);
  fin.closePath();
  for (let k = 0; k < 4; k++) {
    const geometry = new THREE.ExtrudeGeometry(fin, { depth: 0.02, bevelEnabled: false });
    geometry.translate(0, 0, -0.01);
    geometry.rotateY((k * Math.PI) / 2 + Math.PI / 4);
    fins.push({ geometry, colour: M.red });
  }
  const porthole = new THREE.CircleGeometry(0.04, 12);
  porthole.translate(0, 0.14, 0.131);
  const hullGeometry = merge(THREE, [
    { geometry: hull, colour: paint },
    ...fins,
    { geometry: porthole, colour: M.blue }
  ]);
  const hullMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  const body = new THREE.Mesh(hullGeometry, hullMaterial);
  // The flame: an outer orange cone and an inner pale one, pointing down from the nozzle, added to the glow.
  const F = M.flame,
    outer = new THREE.ConeGeometry(F.radius, F.length, 12, 1, true),
    inner = new THREE.ConeGeometry(F.radius * 0.55, F.length * 0.6, 10, 1, true);
  outer.rotateX(Math.PI);
  inner.rotateX(Math.PI);
  outer.translate(0, -0.5 - F.length / 2, 0);
  inner.translate(0, -0.5 - (F.length * 0.6) / 2, 0);
  const flameMaterial = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    fog: false
  });
  const flame = new THREE.Mesh(
    merge(THREE, [
      { geometry: outer, colour: F.outer },
      { geometry: inner, colour: F.inner }
    ]),
    flameMaterial
  );
  // Scaled from the nozzle (y -0.5), so it flickers without leaving the rocket.
  const nozzle = new THREE.Group();
  nozzle.position.y = -0.5;
  flame.position.y = 0.5;
  nozzle.add(flame);
  const group = new THREE.Group();
  group.name = 'cosmonautics-rocket';
  group.add(body, nozzle);
  group.visible = false;
  group.frustumCulled = false;
  group.userData.dynamic = true;
  // After the cloud sea (cloud-sea.mjs, 4), like the fireworks.
  body.renderOrder = 5;
  flame.renderOrder = 6;
  return {
    group,
    body,
    flame: nozzle,
    dispose() {
      group.removeFromParent();
      body.geometry.dispose();
      flame.geometry.dispose();
      hullMaterial.dispose();
      flameMaterial.dispose();
    }
  };
}
