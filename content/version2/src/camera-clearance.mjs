// Fast, allocation-free clearance for the overview camera. world.pointClearance() scans every obstacle box
// and rail segment (thousands, ~70 us a call) and the orbit asks it many times a frame near trees and rails,
// so the solid things are bucketed once into a flat grid of cells; a query reads one cell. Distances are
// exact up to `reach` metres and reported as `reach` beyond it, which is all the camera needs.
export const CLEARANCE = { cell: 6, reach: 4 };

const boxDistance = (b, x, y, z) => {
  const dx = Math.max(b.min.x - x, 0, x - b.max.x),
    dy = Math.max(b.min.y - y, 0, y - b.max.y),
    dz = Math.max(b.min.z - z, 0, z - b.max.z);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};
const segmentDistance = (s, x, y, z) => {
  const ax = s.a.x,
    ay = s.a.y,
    az = s.a.z,
    vx = s.b.x - ax,
    vy = s.b.y - ay,
    vz = s.b.z - az,
    length = vx * vx + vy * vy + vz * vz,
    t = length > 0 ? Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy + (z - az) * vz) / length)) : 0,
    dx = ax + vx * t - x,
    dy = ay + vy * t - y,
    dz = az + vz * t - z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - s.radius;
};

// field: { boxes: Box3[], rails: { a, b, radius }[] } (world.obstacleField).
export function createClearanceGrid(field, { cell = CLEARANCE.cell, reach = CLEARANCE.reach } = {}) {
  const cells = new Map(),
    key = (i, k) => i * 73856093 + k * 19349663;
  const insert = (item, minX, minZ, maxX, maxZ) => {
    for (let i = Math.floor((minX - reach) / cell); i <= Math.floor((maxX + reach) / cell); i++)
      for (let k = Math.floor((minZ - reach) / cell); k <= Math.floor((maxZ + reach) / cell); k++) {
        const id = key(i, k);
        let list = cells.get(id);
        if (!list) {
          list = { boxes: [], rails: [] };
          cells.set(id, list);
        }
        list[item.rail ? 'rails' : 'boxes'].push(item.value);
      }
  };
  for (const box of field?.boxes || [])
    if (box && !box.isEmpty?.()) insert({ value: box }, box.min.x, box.min.z, box.max.x, box.max.z);
  for (const s of field?.rails || [])
    insert(
      { value: s, rail: true },
      Math.min(s.a.x, s.b.x) - s.radius,
      Math.min(s.a.z, s.b.z) - s.radius,
      Math.max(s.a.x, s.b.x) + s.radius,
      Math.max(s.a.z, s.b.z) + s.radius
    );
  return {
    reach,
    cells: cells.size,
    // Metres from p to the nearest solid thing, capped at `reach`.
    clearance(p) {
      const list = cells.get(key(Math.floor(p.x / cell), Math.floor(p.z / cell)));
      let best = reach;
      if (!list) return best;
      for (let i = 0; i < list.boxes.length; i++) {
        const d = boxDistance(list.boxes[i], p.x, p.y, p.z);
        if (d < best) best = d;
      }
      for (let i = 0; i < list.rails.length; i++) {
        const d = segmentDistance(list.rails[i], p.x, p.y, p.z);
        if (d < best) best = d;
      }
      return Math.max(0, best);
    }
  };
}
