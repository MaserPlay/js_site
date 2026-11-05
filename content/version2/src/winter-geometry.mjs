export const WINTER_FOLIAGE_SCALE = 0.83;

function clipPolygon(vertices, distance, positive = true) {
  const output = [],
    sign = positive ? 1 : -1;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i],
      b = vertices[(i + 1) % vertices.length],
      da = distance(a.p) * sign,
      db = distance(b.p) * sign;
    if (da >= -1e-9) output.push(a);
    if (da >= 0 !== db >= 0) {
      const t = da / (da - db);
      output.push({ p: a.p.clone().lerp(b.p, t), uv: a.uv.clone().lerp(b.uv, t), boundary: true });
    }
  }
  return output;
}
function sourceTriangles(THREE, geometry) {
  const p = geometry.attributes.position,
    uv = geometry.attributes.uv,
    index = geometry.index,
    triangles = [];
  for (let i = 0; i < (index ? index.count : p.count); i += 3) {
    const vertices = [];
    for (let k = 0; k < 3; k++) {
      const n = index ? index.getX(i + k) : i + k;
      vertices.push({
        p: new THREE.Vector3().fromBufferAttribute(p, n),
        uv: uv ? new THREE.Vector2().fromBufferAttribute(uv, n) : new THREE.Vector2(),
        boundary: false
      });
    }
    triangles.push(vertices);
  }
  return triangles;
}
function resultGeometry(THREE, polygons, offset = 0, skirts = false) {
  const positions = [],
    uvs = [];
  const emit = (a, b, c) => {
    if (b.p.clone().sub(a.p).cross(c.p.clone().sub(a.p)).lengthSq() < 1e-16) return;
    for (const v of [a, b, c]) {
      positions.push(v.p.x, v.p.y, v.p.z);
      uvs.push(v.uv.x, v.uv.y);
    }
  };
  for (const polygon of polygons) {
    const top = polygon.map(v => ({ ...v, p: v.p.clone().add(new THREE.Vector3(0, offset, 0)) }));
    for (let i = 1; i < top.length - 1; i++) emit(top[0], top[i], top[i + 1]);
    if (skirts)
      for (let i = 0; i < polygon.length; i++) {
        const j = (i + 1) % polygon.length;
        if (polygon[i].boundary && polygon[j].boundary) {
          emit(top[i], polygon[i], top[j]);
          emit(polygon[i], polygon[j], top[j]);
        }
      }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}

// Snow follows the same canopy facets, with a shallow lip touching the source
// surface. It is not an independent flattened sphere above a smaller crown.
export function surfaceSnow(THREE, geometry, lowerY = 0.12, thickness = 0.025) {
  const distance = p =>
    p.y -
    lowerY -
    0.075 * Math.sin(Math.atan2(p.x, p.z) * 3 + 0.4) -
    0.035 * Math.cos(Math.atan2(p.x, p.z) * 5);
  const polygons = sourceTriangles(THREE, geometry)
    .map(triangle => clipPolygon(triangle, distance))
    .filter(p => p.length >= 3);
  return resultGeometry(THREE, polygons, thickness, true);
}

// Subtract a convex water corridor from an already holed snow sheet, including
// transformed/irregular islands. Partitioning triangles preserves UVs and does
// not add overlapping holes to Shape/Earcut.
function subtractPlanes(THREE, geometry, planes) {
  const polygons = [];
  for (const triangle of sourceTriangles(THREE, geometry)) {
    let remaining = triangle;
    for (const plane of planes) {
      if (remaining.length < 3) break;
      const outside = clipPolygon(remaining, plane, false);
      if (outside.length >= 3) polygons.push(outside);
      remaining = clipPolygon(remaining, plane, true);
    }
  }
  return resultGeometry(THREE, polygons);
}
export function cutSnowOutlet(THREE, geometry, matrixWorld, center, flow, across, start, end, halfWidth) {
  const local = p => p.clone().applyMatrix4(matrixWorld).sub(center),
    along = p => local(p).dot(flow),
    side = p => local(p).dot(across);
  return subtractPlanes(THREE, geometry, [
    p => along(p) - start,
    p => end - along(p),
    p => halfWidth - side(p),
    p => halfWidth + side(p)
  ]);
}
export function cutSnowBasin(THREE, geometry, matrixWorld, center, flow, across, rx, rz) {
  const local = p => p.clone().applyMatrix4(matrixWorld).sub(center);
  const planes = Array.from({ length: 32 }, (_, i) => {
    const angle = (i / 32) * Math.PI * 2;
    return p =>
      1 - (local(p).dot(across) / rx) * Math.sin(angle) - (local(p).dot(flow) / rz) * Math.cos(angle);
  });
  return subtractPlanes(THREE, geometry, planes);
}
