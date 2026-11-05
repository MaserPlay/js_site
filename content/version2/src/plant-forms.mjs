// Deterministic, footprint-bounded planting. No scenery RNG calls are added.
export function plantForm(p) {
  const { x, z, scale: s, base, random: r } = p,
    phase = r[10] * Math.PI * 2;
  const species =
    p.species || (p.red ? 'flowers' : r[11] < 0.18 ? 'cypress' : r[11] < 0.55 ? 'shrub' : 'broadleaf');
  const parts = [],
    part = (kind, material, dx, y, dz, sx, sy, sz, rotation = {}, winter = false) =>
      parts.push({
        kind,
        material,
        position: { x: x + dx * s, y: base + y * s, z: z + dz * s },
        scale: { x: sx * s, y: sy * s, z: sz * s },
        rotation,
        winter
      });
  if (species === 'cypress') {
    part('stem', 'bark', 0, 0.44, 0, 0.05, 0.78, 0.05);
    for (let j = 0; j < 3; j++) {
      const y = [0.63, 1.18, 1.87][j],
        radius = [0.46, 0.34, 0.21][j],
        height = [1.1, 0.94, 1.1][j],
        rotation = { y: phase + j * 0.41 };
      part('fir', 'pine', 0, y, 0, radius, height, radius, rotation);
      part('firSnow', 'snow', 0, y, 0, radius, height, radius, rotation, true);
    }
  } else {
    const rim = species === 'rim',
      bloom = p.red || species === 'flowers',
      low = species === 'shrub' || rim;
    // The common root reaches the soil before the three stems fork.
    part('stem', 'bark', 0, 0.09, 0, 0.023, 0.18, 0.023);
    // Three interlocking sprays form an uneven shrub, with visible connected wood.
    for (let i = 0; i < 3; i++) {
      const angle = phase + i * 2.399,
        dx = Math.sin(angle) * 0.2,
        dz = Math.cos(angle) * 0.2,
        y = (low ? 0.37 : 0.49) + [0, 0.13, -0.07][i];
      const sx = 0.7 + r[i] * 0.1,
        sy = low ? 0.64 : 0.82,
        rotation = { y: angle, z: 0.14 * Math.sin(angle), x: 0.11 * Math.cos(angle) };
      part('stem', 'bark', dx / 2, (y + 0.18) / 2, dz / 2, 0.018, Math.hypot(y - 0.18, dx, dz), 0.018, {
        y: angle,
        x: Math.atan2(0.2, y - 0.18),
        order: 'YXZ'
      });
      part('shrubCrown', 'shrub', dx, y, dz, sx, sy, 0.71, rotation);
      parts.at(-1).tint = i === 1 ? '#dce5bb' : i === 2 ? '#95b094' : '#c3d0ad';
      part('shrubTwig', 'bark', dx, y, dz, sx, sy, 0.71, rotation);
      part('shrubSnow', 'snow', dx, y, dz, sx, sy, 0.71, rotation, true);
    }
    // A few basal leaves anchor each woody group; their scale matches the crown.
    for (let i = 0; i < 3; i++) {
      const a = phase + i * 2.2;
      part('leaf', 'shrub', Math.sin(a) * 0.13, 0.18, Math.cos(a) * 0.13, 0.3, 0.34 + r[i] * 0.12, 0.32, {
        y: a,
        x: -0.14,
        order: 'YXZ'
      });
    }
    if (bloom) {
      for (let i = 0; i < 5; i++) {
        const a = phase + i * 2.399,
          dx = Math.sin(a) * (0.18 + i * 0.055),
          dz = Math.cos(a) * (0.18 + i * 0.055),
          y = 0.84 + [0.25, -0.08, 0.06, 0.34, 0.14][i] + (low ? -0.08 : 0.06),
          size = 0.52 + r[i] * 0.2;
        part('stem', 'bark', dx, y / 2, dz, 0.012, y, 0.012, {}, 'summer');
        part(
          'flower',
          'redLeaf',
          dx,
          y,
          dz,
          size,
          size,
          size,
          { x: -1.2 + 0.23 * Math.sin(a), y: a, z: 0.2 * Math.cos(a) },
          'summer'
        );
      }
    }
  }
  return { species, parts };
}
export function formMatrix(THREE, part) {
  const p = part.position,
    r = part.rotation,
    s = part.scale;
  return new THREE.Matrix4().compose(
    new THREE.Vector3(p.x, p.y, p.z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(r.x || 0, r.y || 0, r.z || 0, r.order || 'XYZ')),
    new THREE.Vector3(s.x, s.y, s.z)
  );
}

export function createBroadLeafGeometry(THREE) {
  const geometry = new THREE.BufferGeometry(),
    vertices = [],
    indices = [];
  const nodes = [
    [0, 0, 0.025],
    [0.22, 0.13, 0.25],
    [0.49, 0.28, 0.39],
    [0.72, 0.49, 0.37],
    [0.9, 0.72, 0.22],
    [0.98, 0.87, 0]
  ];
  for (const [y, z, w] of nodes)
    for (const side of [-1, 0, 1]) vertices.push(side * w, y - (side ? 0.07 : 0), z);
  for (let j = 0; j < nodes.length - 1; j++)
    for (let side = 0; side < 2; side++) {
      const k = j * 3 + side;
      indices.push(k, k + 3, k + 1, k + 1, k + 3, k + 4);
    }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createCanopyGeometry(THREE) {
  const geometry = new THREE.SphereGeometry(1, 6, 4),
    p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i),
      a = Math.atan2(x, z),
      r = 1 + 0.1 * Math.sin(a * 3 + y * 2) + 0.07 * Math.cos(a * 5 - y);
    p.setXYZ(i, x * r + (y + 0.3) * 0.13, y * (y < 0 ? 0.73 : 1.06), z * r);
  }
  geometry.computeVertexNormals();
  return geometry;
}
