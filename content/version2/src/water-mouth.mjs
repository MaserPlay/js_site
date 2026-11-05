// Row 7 of the fall mesh is the bend over the lip; rows 8–12 fall.
export const LIP_ROW = 7;
// Height of the island's top edge above the fall base (world.mjs island top: 0.4 m slab centred on the base).
export const TERRAIN_EDGE_Y = 0.2;
// The bend row's height above the base. At 0.18 the sheet crossed the coast 7 mm under the terrain's top edge,
// and that edge showed through the water as a thin dark stripe where the fall begins; now it clears it.
export const LIP_BEND_Y = 0.212;
// The falling rows (8..12) spread sideways as they drop, so the curtain fans out like the wide sheets of the reference
// instead of hanging as a straight ribbon. alignWaterMouth measures the cliff clearance at the spread positions.
export const CURTAIN_FAN = [1, 1.15, 1.4, 1.7, 2];
export const curtainFan = row => (row >= 8 ? CURTAIN_FAN[Math.min(row - 8, CURTAIN_FAN.length - 1)] : 1);
// Each row's width (across the flow) before anything moves.
function rowSpans(THREE, position, across, columns, rows) {
  const spans = [];
  for (let j = 6; j < rows; j++) {
    const left = new THREE.Vector3().fromBufferAttribute(position, j * (columns + 1)),
      right = new THREE.Vector3().fromBufferAttribute(position, j * (columns + 1) + columns);
    spans[j] = Math.abs(right.sub(left).dot(across));
  }
  return spans;
}
// Align the existing continuous water mesh to the real polygonal coast.
// A shallow outward bow gives the existing curtain depth; the lake and coast joins stay fixed.
export function coastDistance(THREE, polygon, lip, flow, across, side) {
  let result = -Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i].clone().sub(lip),
      b = polygon[(i + 1) % polygon.length].clone().sub(lip),
      sa = a.dot(across),
      sb = b.dot(across);
    if (Math.abs(sb - sa) < 1e-8 || side < Math.min(sa, sb) - 1e-8 || side > Math.max(sa, sb) + 1e-8)
      continue;
    const t = (side - sa) / (sb - sa),
      point = a.lerp(b, t);
    result = Math.max(result, point.dot(flow));
  }
  return result;
}

// The cliff's triangles the curtain's rays can reach. The rays run level along -flow (across it), so each keeps its
// side and its height; a triangle whose side and height ranges miss those of every ray is left out (round 21: the
// rays against the whole island cliff took ~55 ms of each garden build). The kept triangles keep their order and
// their local coordinates, so the nearest hit is the one found on the whole cliff.
function curtainProbe(THREE, cliff, lip, across, sides, heights) {
  const source = cliff.geometry,
    from = source.attributes.position,
    index = source.index,
    start = Math.max(0, source.drawRange.start),
    end = Math.min(index ? index.count : from.count, source.drawRange.start + source.drawRange.count),
    margin = 1e-3,
    kept = [],
    world = new THREE.Vector3();
  for (let t = start; t + 2 < end; t += 3) {
    let s0 = Infinity,
      s1 = -Infinity,
      y0 = Infinity,
      y1 = -Infinity;
    for (let c = 0; c < 3; c++) {
      world.fromBufferAttribute(from, index ? index.getX(t + c) : t + c).applyMatrix4(cliff.matrixWorld);
      const side = (world.x - lip.x) * across.x + (world.z - lip.z) * across.z;
      s0 = Math.min(s0, side);
      s1 = Math.max(s1, side);
      y0 = Math.min(y0, world.y);
      y1 = Math.max(y1, world.y);
    }
    if (
      s1 < sides[0] - margin ||
      s0 > sides[1] + margin ||
      y1 < heights[0] - margin ||
      y0 > heights[1] + margin
    )
      continue;
    for (let c = 0; c < 3; c++) {
      const v = index ? index.getX(t + c) : t + c;
      kept.push(from.getX(v), from.getY(v), from.getZ(v));
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(kept, 3));
  return geometry;
}
export function alignWaterMouth(THREE, geometry, cliff, polygon, lip, flow, across, columns, base, height) {
  const started = performance.now();
  cliff.updateWorldMatrix(true, false);
  const position = geometry.attributes.position,
    rows = position.count / (columns + 1),
    sides = [Infinity, -Infinity],
    heights = [Infinity, -Infinity];
  // Where the rays will run (the same sides and heights as below, from the curtain before it moves).
  for (let j = 8; j < rows; j++)
    for (let k = 0; k <= columns; k++) {
      const point = new THREE.Vector3().fromBufferAttribute(position, j * (columns + 1) + k),
        side = point.clone().sub(lip).dot(across) * curtainFan(j);
      sides[0] = Math.min(sides[0], side);
      sides[1] = Math.max(sides[1], side);
      heights[0] = Math.min(heights[0], point.y);
      heights[1] = Math.max(heights[1], point.y);
    }
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
    reach = curtainProbe(THREE, cliff, lip, across, sides, heights),
    probe = new THREE.Mesh(reach, material);
  probe.matrixAutoUpdate = false;
  probe.matrixWorld.copy(cliff.matrixWorld);
  const ray = new THREE.Raycaster(),
    offsets = [-0.1, 0.045, 0.16, 0.34, 0.49, 0.66, 0.78],
    records = [],
    spans = rowSpans(THREE, position, across, columns, rows);
  for (let j = 6; j < rows; j++)
    for (let k = 0; k <= columns; k++) {
      const fan = curtainFan(j),
        index = j * (columns + 1) + k,
        point = new THREE.Vector3().fromBufferAttribute(position, index),
        side = point.clone().sub(lip).dot(across) * fan,
        coast = coastDistance(THREE, polygon, lip, flow, across, side);
      if (!Number.isFinite(coast)) throw new Error('Water mouth misses the island coast');
      let distance = coast + offsets[j - 6];
      if (j >= 8) {
        const origin = lip.clone().addScaledVector(across, side).addScaledVector(flow, 80);
        origin.y = point.y;
        ray.set(origin, flow.clone().negate());
        const hit = ray.intersectObject(probe, false)[0];
        if (hit) distance = Math.max(distance, 80 - hit.distance + 0.11);
      }
      // Bow only the falling rows, outward from the already-cleared cliff.
      // The centre carries a rounded body at oblique angles, with tapered side edges.
      if (j >= 8) {
        const u = k / columns,
          drop = Math.max(0, base - point.y);
        distance += curtainDepth(u, drop, spans[j] * fan);
      }
      const corrected = lip.clone().addScaledVector(across, side).addScaledVector(flow, distance);
      corrected.y = point.y;
      position.setXYZ(index, corrected.x, corrected.y, corrected.z);
      if (j === 6 || j === 7) {
        const stored = new THREE.Vector3().fromBufferAttribute(position, index).sub(lip),
          actualSide = stored.dot(across),
          actualCoast = coastDistance(THREE, polygon, lip, flow, across, actualSide),
          actualDistance = stored.dot(flow);
        records.push({
          row: j,
          column: k,
          coast: actualCoast,
          distance: actualDistance,
          offset: actualDistance - actualCoast
        });
      }
    }
  material.dispose();
  reach.dispose();
  position.needsUpdate = true;
  const data = [],
    uv = geometry.attributes.uv;
  // Arc length is now measured on each actual corrected strip, including its lip. flowData.x counts it from the
  // lip row (negative over the pool), so the shader can start the free fall exactly where the sheet tips over.
  for (let k = 0; k <= columns; k++) {
    let distance = 0,
      previous = null;
    const distances = [];
    for (let j = 0; j < rows; j++) {
      const point = new THREE.Vector3().fromBufferAttribute(position, j * (columns + 1) + k);
      if (previous) distance += point.distanceTo(previous);
      distances.push(distance);
      previous = point;
    }
    for (let j = 0; j < rows; j++) {
      const index = j * (columns + 1) + k,
        drop = Math.max(0, base - position.getY(index));
      data[index] = [
        distances[j] - distances[LIP_ROW],
        THREE.MathUtils.smoothstep(drop, 0.12, 0.85),
        drop / height
      ];
      uv.setY(index, (distances[j] / distance) * 2.6667);
    }
  }
  geometry.setAttribute('flowData', new THREE.Float32BufferAttribute(data.flat(), 3));
  uv.needsUpdate = true;
  geometry.computeVertexNormals();
  return {
    cpuMs: performance.now() - started,
    samples: records.length,
    maxApproachError: Math.max(...records.filter(r => r.row === 6).map(r => Math.abs(r.offset + 0.1))),
    maxBendError: Math.max(...records.filter(r => r.row === 7).map(r => Math.abs(r.offset - 0.045)))
  };
}

// A bounded cross-section: no extra mesh, particles or movement of the outlet banks.
export function curtainDepth(u, drop, span) {
  const t = Math.max(0, Math.min(1, (drop - 0.12) / 0.78)),
    bend = t * t * (3 - 2 * t);
  return Math.sin(Math.PI * u) * Math.min(0.48, span * 0.28) * bend;
}
