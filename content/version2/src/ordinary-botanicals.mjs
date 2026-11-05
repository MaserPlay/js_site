// Original opaque botanical geometry. The central comparison trees do not use it.
// A leaf is a folded solid polygon, never an alpha card. All shoots share buffers.
export function createOrdinarySpray(THREE, lowDetail = false, shrub = false) {
  const positions = [],
    colors = [],
    indices = [],
    wood = [],
    normals = [],
    attachments = [],
    branches = [];
  const appendWood = (a, b, r0, r1) => {
    const d = b.clone().sub(a),
      g = new THREE.CylinderGeometry(r1, r0, d.length(), 3, 1, true);
    g.applyMatrix4(
      new THREE.Matrix4().compose(
        a.clone().add(b).multiplyScalar(0.5),
        new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()),
        new THREE.Vector3(1, 1, 1)
      )
    );
    for (const k of g.index.array) {
      wood.push(g.attributes.position.getX(k), g.attributes.position.getY(k), g.attributes.position.getZ(k));
      normals.push(g.attributes.normal.getX(k), g.attributes.normal.getY(k), g.attributes.normal.getZ(k));
    }
    g.dispose();
  };
  for (let arm = 0; arm < (shrub ? 5 : 7); arm++) {
    const angle = arm * 2.39996 + 0.17 * Math.sin(arm * 3.1),
      out = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle)),
      side = new THREE.Vector3(out.z, 0, -out.x);
    const reach = (shrub ? 0.52 : 0.64) + 0.14 * Math.sin(arm * 2.3),
      rise = (shrub ? 0.31 : 0.52) * Math.sin(arm * 1.7 + 0.2),
      root = new THREE.Vector3(),
      bend = out
        .clone()
        .multiplyScalar(reach * 0.48)
        .setY(rise * 0.28 + 0.12),
      tip = out.clone().multiplyScalar(reach).setY(rise);
    branches.push([root, bend, tip]);
    appendWood(root, bend, 0.017, 0.01);
    appendWood(bend, tip, 0.01, 0.0035);
    for (let node = 0; node < (shrub ? 3 : 4); node++)
      for (const sign of [-1, 1]) {
        const t = 0.18 + node * (shrub ? 0.29 : 0.23) + 0.035 * Math.sin(arm + node * 2 + sign),
          base = t < 0.48 ? root.clone().lerp(bend, t / 0.48) : bend.clone().lerp(tip, (t - 0.48) / 0.52);
        const direction = out
          .clone()
          .multiplyScalar(0.49)
          .addScaledVector(side, sign * 0.68)
          .setY(0.35 * Math.sin(arm * 2.1 + node * 1.7 + sign))
          .normalize();
        const right = new THREE.Vector3(direction.z, 0, -direction.x)
            .normalize()
            .applyAxisAngle(direction, 0.8 * Math.sin(arm + node * 2.2)),
          normal = direction.clone().cross(right).normalize();
        const length = (shrub ? 0.3 : 0.31) + 0.075 * Math.sin(arm * 1.3 + node * 2 + sign),
          width = length * (shrub ? 0.33 : 0.28),
          first = positions.length / 3;
        const shape = lowDetail
          ? [
              [0, 0, 0],
              [0.49, -1, 0.05],
              [1, 0, -0.12],
              [0.49, 1, 0.08]
            ]
          : [
              [0, 0, 0],
              [0.25, -0.75, 0.06],
              [0.61, -1, 0.07],
              [0.48, 0, 0.18],
              [0.63, 0.87, 0.1],
              [0.24, 0.7, 0.08],
              [1, 0, -0.12]
            ];
        const shade = 0.7 + 0.2 * (0.5 + 0.5 * Math.sin(arm * 2.3 + node * 0.9 + sign));
        for (const [along, across, rise] of shape) {
          const p = base
            .clone()
            .addScaledVector(direction, along * length)
            .addScaledVector(right, across * width)
            .addScaledVector(normal, rise * length);
          positions.push(p.x, p.y, p.z);
          const c = shade * (along === 0 ? 0.84 : across ? 0.97 : 1.03);
          colors.push(c * 0.91, c, c * 0.77);
        }
        const faces = lowDetail ? [0, 1, 2, 0, 2, 3] : [0, 1, 3, 1, 2, 3, 2, 6, 3, 3, 6, 4, 3, 4, 5, 0, 3, 5];
        indices.push(...faces.map(i => first + i));
        attachments.push({ root: base.clone(), branch: arm, vertex: first });
      }
  }
  const leaves = new THREE.BufferGeometry();
  leaves.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  leaves.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  leaves.setIndex(indices);
  leaves.computeVertexNormals();
  leaves.computeBoundingBox();
  const twigs = new THREE.BufferGeometry();
  twigs.setAttribute('position', new THREE.Float32BufferAttribute(wood, 3));
  twigs.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  twigs.computeBoundingBox();
  return { leaves, twigs, attachments, branches };
}

// Seven softly cupped, unequal petals. A shared smooth rim replaces the double rosette.
export function createGardenFlower(THREE) {
  const positions = [],
    colors = [],
    indices = [];
  for (let j = 0; j < 7; j++) {
    const a = (j / 7) * Math.PI * 2 + 0.045 * Math.sin(j * 2.1),
      first = positions.length / 3,
      length = 0.28 + 0.026 * Math.sin(j * 2.4),
      width = 0.47 + 0.04 * Math.cos(j * 1.7);
    const outline = [
      [0, 0],
      [0.13, -0.48],
      [0.34, -0.85],
      [0.6, -1],
      [0.84, -0.78],
      [0.97, -0.34],
      [1, 0],
      [0.96, 0.4],
      [0.82, 0.8],
      [0.57, 0.96],
      [0.31, 0.77],
      [0.11, 0.39]
    ];
    for (const [along, across] of [...outline, [0.52, 0]]) {
      const x = across * width * length,
        y = 0.021 + along * length,
        z = 0.015 + 0.09 * along * along + 0.035 * across * across + 0.013 * Math.sin(j + along * 3);
      positions.push(Math.cos(a) * x - Math.sin(a) * y, Math.sin(a) * x + Math.cos(a) * y, z);
      const c = 0.84 + 0.16 * along;
      colors.push(c, c * (0.97 - 0.025 * Math.cos(j)), c * (0.89 + 0.035 * Math.sin(j)));
    }
    for (let k = 0; k < 12; k++) indices.push(first + 12, first + k, first + ((k + 1) % 12));
  }
  const first = positions.length / 3;
  positions.push(0, 0, 0.115);
  colors.push(0.7, 0.47, 0.08);
  for (let j = 0; j < 10; j++) {
    const a = (j / 10) * Math.PI * 2;
    positions.push(Math.sin(a) * 0.052, Math.cos(a) * 0.052, 0.054);
    colors.push(0.92, 0.66, 0.16);
  }
  for (let j = 0; j < 10; j++) indices.push(first, first + 1 + j, first + 1 + ((j + 1) % 10));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  g.computeBoundingBox();
  return g;
}

// Only ordinary deciduous groups are registered here. Central trees are never included.
export function setDeciduousSeason(objects, season) {
  for (const object of objects) object.visible = season !== 'winter';
}

// Compact near/far instances from immutable season matrices; never compact a prior result.
export function createFoliagePartition(THREE) {
  const lodMatrix = new THREE.Matrix4(),
    lodPosition = new THREE.Vector3();
  return (records, position, economy) => {
    for (const lod of records) {
      let close = 0,
        distant = 0;
      for (let i = 0; i < lod.matrices.length; i++) {
        lodMatrix.copy(lod.matrices[i]);
        lodPosition.setFromMatrixPosition(lodMatrix);
        const target =
            lod.snowy || (!economy && lodPosition.distanceToSquared(position) < 22 * 22) ? lod.near : lod.far,
          index = target === lod.near ? close++ : distant++;
        target.setMatrixAt(index, lodMatrix);
        if (lod.colors[i]) target.setColorAt(index, lod.colors[i]);
        // Island owners travel with their compacted instance for filter transitions.
        const owners = lod.owners && target.geometry.attributes.gardenOwner;
        if (owners) owners.array[index] = lod.owners[i];
      }
      for (const [object, count] of [
        [lod.near, close],
        [lod.far, distant]
      ]) {
        object.count = count;
        object.instanceMatrix.needsUpdate = true;
        if (object.instanceColor) object.instanceColor.needsUpdate = true;
        if (lod.owners && object.geometry.attributes.gardenOwner)
          object.geometry.attributes.gardenOwner.needsUpdate = true;
        object.computeBoundingSphere();
      }
    }
  };
}
