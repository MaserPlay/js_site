// Platform sites: where a project island's description and comments platforms stand, so that every part of
// the stand and the plinth under it lies on the island's turf (world.mjs terrace loop and rim boulders).
// Island-frame metres in the pavilion group's frame: x across, z outward; the island's centre lies
// PLATFORM.ahead in front of the group origin (island frame 10.2 m, group 3.85 m beyond the route anchor).
export const PLATFORM = {
  nominal: { description: [-4.6, 9.6], comments: [4.5, 16.0] },
  top: 2.6,
  base: 2.85,
  height: 0.25,
  ahead: 6.35,
  // The lawn slab's top ring (world.mjs island(): topGeometry(.., 0.99)).
  turf: 0.99,
  // Stand parts keep this far inside the turf edge; the plinth edge keeps `trim`.
  margin: 0.3,
  trim: 0.2,
  step: 0.05,
  maxSlide: 2.5
};
// Parts of a stand relative to the platform centre: [dx, dz, radius] (board ends, legs, lamp feet, arm lights).
export const STAND_PARTS = [
  [-1.73, 0, 0.05],
  [1.73, 0, 0.05],
  [-1.48, 0.09, 0.14],
  [1.48, 0.09, 0.14],
  [-2.18, -0.45, 0.3],
  [2.18, -0.45, 0.3],
  [-1.35, -0.34, 0.2],
  [1.35, -0.34, 0.2]
];
// The 26-gon top ring of the island's lawn slab, in the pavilion group's frame.
export function turfOutline(contour, { radius, stretch, profile }, sides = 26) {
  return Array.from({ length: sides }, (_, k) => {
    const a = (k / sides) * Math.PI * 2,
      r = radius * contour(a, profile) * PLATFORM.turf;
    return [Math.sin(a) * r * stretch, (Math.cos(a) * r) / stretch + PLATFORM.ahead];
  });
}
// Signed distance of (x, z) from the outline: positive inside the turf.
export function turfInset(outline, x, z) {
  let inside = false,
    nearest = Infinity;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const [xi, zi] = outline[i],
      [xj, zj] = outline[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
    const vx = xi - xj,
      vz = zi - zj,
      t = Math.max(0, Math.min(1, ((x - xj) * vx + (z - zj) * vz) / (vx * vx + vz * vz)));
    nearest = Math.min(nearest, Math.hypot(x - xj - t * vx, z - zj - t * vz));
  }
  return inside ? nearest : -nearest;
}
// The platform's centre: the nominal spot, slid toward the island's long axis until every stand part keeps
// PLATFORM.margin from the turf edge. A stand that already fits stays exactly where it was.
export function platformSite(outline, zone) {
  const [nx, nz] = PLATFORM.nominal[zone],
    toward = nx > 0 ? -1 : 1,
    fits = x =>
      STAND_PARTS.every(([dx, dz, r]) => turfInset(outline, x + dx, nz + dz) - r >= PLATFORM.margin);
  let slide = 0;
  while (!fits(nx + toward * slide) && slide < PLATFORM.maxSlide) slide += PLATFORM.step;
  return [nx + toward * slide, nz];
}
// How far from the centre a plinth vertex at bearing atan2(x, z) may reach: its own radius, or less where the
// turf edge (less PLATFORM.trim) is nearer.
export function platformReach(outline, [cx, cz], angle, limit) {
  const sx = Math.sin(angle),
    sz = Math.cos(angle),
    inside = d => turfInset(outline, cx + sx * d, cz + sz * d) >= PLATFORM.trim;
  for (let d = PLATFORM.step; d < limit + PLATFORM.step; d += PLATFORM.step) {
    if (inside(Math.min(d, limit))) continue;
    let lo = Math.max(0, d - PLATFORM.step),
      hi = Math.min(d, limit);
    for (let k = 0; k < 12; k++) {
      const mid = (lo + hi) / 2;
      if (inside(mid)) lo = mid;
      else hi = mid;
    }
    return lo;
  }
  return limit;
}
// Pulls every plinth vertex that would pass the turf edge back to it; a plinth that fits is not touched.
export function trimPlinth(geometry, outline, site) {
  const p = geometry.attributes.position;
  for (let k = 0; k < p.count; k++) {
    const x = p.getX(k),
      z = p.getZ(k),
      r = Math.hypot(x, z);
    if (r < 1e-6) continue;
    const reach = platformReach(outline, site, Math.atan2(x, z), r);
    if (reach < r) {
      p.setX(k, (x * reach) / r);
      p.setZ(k, (z * reach) / r);
    }
  }
  return geometry;
}
