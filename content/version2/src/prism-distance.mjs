// Exact Euclidean distance to an axis-aligned extrusion of a 2D polygon.
// Polygon coordinates are [z,y], matching the rotated masonry arch geometry.
export function prismDistance(point, prism, scale = { x: 1, y: 1, z: 1 }) {
  const polygon = prism.polygon.map(([z, y]) => [z * scale.z, y * scale.y]);
  const x0 = Math.min(prism.minX * scale.x, prism.maxX * scale.x),
    x1 = Math.max(prism.minX * scale.x, prism.maxX * scale.x);
  const dx = Math.max(x0 - point.x, 0, point.x - x1);
  let inside = false,
    d2 = Infinity;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [az, ay] = polygon[j],
      [bz, by] = polygon[i];
    if (ay > point.y !== by > point.y && point.z < ((bz - az) * (point.y - ay)) / (by - ay) + az)
      inside = !inside;
    const vz = bz - az,
      vy = by - ay,
      len = vz * vz + vy * vy;
    const t = len ? Math.max(0, Math.min(1, ((point.z - az) * vz + (point.y - ay) * vy) / len)) : 0;
    d2 = Math.min(d2, (point.z - az - t * vz) ** 2 + (point.y - ay - t * vy) ** 2);
  }
  return Math.hypot(dx, inside ? 0 : Math.sqrt(d2));
}
