// Shared solid boughs and folded petals. No textures, randomness or frame work.
export function createFirGeometry(THREE) {
  const vertices = [],
    caps = [];
  const emit = (a, b, c) => {
    for (const p of [a, b, c]) vertices.push(...p.toArray());
  };
  for (let j = 0; j < 8; j++) {
    const angle = (j * Math.PI) / 4,
      reach = j % 2 ? 0.85 : 1;
    const p = (radial, y, side = 0) =>
      new THREE.Vector3(
        Math.sin(angle) * radial + Math.cos(angle) * side,
        y,
        Math.cos(angle) * radial - Math.sin(angle) * side
      );
    // Two overlapping needle clusters break each bough into a layered silhouette.
    // Both roots lie within the preceding cluster/leader rather than floating above it.
    for (const [r0, y0, rm, ym, rt, yt, width] of [
      [0.08, 0.04, 0.4, -0.17, 0.73, -0.18, 0.24],
      [0.35, -0.14, 0.71, -0.28, 1, -0.3 + 0.025 * Math.sin(j * 2), 0.2]
    ]) {
      const root = p(r0 * reach, y0),
        left = p(rm * reach, ym, -width),
        tip = p(rt * reach, yt),
        right = p(rm * reach, ym, width),
        ridge = p(rm * reach, ym + 0.12),
        under = p(rm * reach, ym - 0.12);
      const outline = [root, left, tip, right];
      for (let k = 0; k < 4; k++) {
        const a = outline[k],
          b = outline[(k + 1) % 4];
        emit(ridge, a, b);
        emit(under, b, a);
        // Four snow faces per cluster: contact at every edge, raised only at the ridge.
        for (const p of [
          ridge.clone().add(new THREE.Vector3(0, 0.018, 0)),
          a.clone().lerp(ridge, 0.08),
          b.clone().lerp(ridge, 0.08)
        ])
          caps.push(...p.toArray());
      }
    }
    // A narrow leader joins all bough roots and the tier above; no broad cone skirt.
    emit(
      new THREE.Vector3(0, 0.5, 0),
      p(0.17, -0.4),
      new THREE.Vector3(Math.sin(angle + Math.PI / 4) * 0.17, -0.4, Math.cos(angle + Math.PI / 4) * 0.17)
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  const snow = new THREE.BufferGeometry();
  snow.setAttribute('position', new THREE.Float32BufferAttribute(caps, 3));
  snow.computeVertexNormals();
  snow.computeBoundingBox();
  return { geometry, snow };
}

export function createFlowerGeometry(THREE) {
  const vertices = [],
    indices = [];
  for (let j = 0; j < 5; j++) {
    const angle = (j / 5) * Math.PI * 2,
      first = vertices.length / 3,
      length = 0.96 + 0.04 * Math.sin(j * 2.3);
    // Raised edges, folded midrib and a curled tip make a cupped side silhouette.
    for (const [x, y, z] of [
      [0, 0.015, 0.025],
      [-0.065, 0.1, 0.075],
      [-0.095, 0.24, 0.16],
      [0, 0.31, 0.125],
      [0.095, 0.24, 0.16],
      [0.065, 0.1, 0.075],
      [0, 0.19, 0.125]
    ])
      vertices.push(
        Math.cos(angle) * x - Math.sin(angle) * y * length,
        Math.sin(angle) * x + Math.cos(angle) * y * length,
        z
      );
    for (let k = 0; k < 6; k++) indices.push(first + 6, first + k, first + ((k + 1) % 6));
  }
  const centre = vertices.length / 3;
  vertices.push(0, 0, 0.095);
  for (let j = 0; j < 5; j++) {
    const a = (j / 5) * Math.PI * 2;
    vertices.push(Math.sin(a) * 0.065, Math.cos(a) * 0.065, 0.038);
  }
  for (let j = 0; j < 5; j++) indices.push(centre, centre + 1 + ((j + 1) % 5), centre + 1 + j);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}
