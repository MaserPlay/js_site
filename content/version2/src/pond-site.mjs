// Where a project island puts its pond and fall.
//
// The pond is a basin about 3.8 m across with an outlet channel, seven rim stones and two flank boulders, 4.9 m deep behind
// the lip of its fall. The old fixed site (east coast, z 7.5, flowing east) left only 2.9-4.3 m between the rear path's edge
// (x 5.6) and the lip, so on six of the seven islands the path ran over the water, buried 3-5 rim stones under the paving and
// clipped the pond (up to 45 % of its surface). pickPondSite() keeps the old site where its whole footprint is clear (the
// stone-gallery island) and otherwise takes the roomiest site that clears every paved or built shape, the walking route, the
// fixed trees and the island's own edge.
// Local frame as in world.mjs: x along the route tangent, z outward from the ring, the island's centre at z = centreZ.

// waterfall() geometry, in metres: the basin centre lies `back` behind the lip; the stone ring is 1.12 x the basin radii
// (1.885 across, 1.782 along the flow); the seven rim stones stand on a (2.03, 1.925) ellipse (t = 0.35 pi .. 1.65 pi, the
// upstream side) and reach `stone` further; the flank boulders stand `aside` beside the lip and reach `reach`.
export const POND = {
  back: 2.916,
  ring: [2.11, 2.0],
  stoneEllipse: [2.03, 1.925],
  stone: 0.4,
  flank: { aside: 1.59, back: 0.45, reach: 0.7 },
  outlet: [2.3, 3.5],
  channel: 0.8,
  // a fixed tree keeps `treeKeep` from the stones' outer reach; a tree that may move keeps `moveKeep`, else goes `moveBehind`
  // behind the basin centre (the landward bank)
  treeKeep: 0.6,
  moveKeep: 1.0,
  moveBehind: 3.8
};
// Preference after the old site: the rear-west shoulder (where all six pavilion islands have room), then the rest.
export const POND_SECTORS = [
  [322, 340],
  [296, 321],
  [20, 46],
  [255, 295],
  [0, 360]
];

const inside = (x, z, polygon) => {
  let c = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i],
      [xj, zj] = polygon[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
};
const edgeDistance = (x, z, polygon) => {
  let min = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const [ax, az] = polygon[i],
      [bx, bz] = polygon[(i + 1) % polygon.length],
      dx = bx - ax,
      dz = bz - az,
      t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    min = Math.min(min, Math.hypot(x - ax - t * dx, z - az - t * dz));
  }
  return min;
};
// Signed distance to a polygon: negative inside.
export const polygonDistance = (x, z, polygon) =>
  (inside(x, z, polygon) ? -1 : 1) * edgeDistance(x, z, polygon);

// The pond's parts as local points, for a lip and an outward unit flow.
export function pondParts(lip, flow, g = POND) {
  const across = { x: -flow.z, z: flow.x },
    centre = { x: lip.x - flow.x * g.back, z: lip.z - flow.z * g.back },
    at = (u, v) => [centre.x + flow.x * u + across.x * v, centre.z + flow.z * u + across.z * v],
    reach = [g.stoneEllipse[0] + g.stone, g.stoneEllipse[1] + g.stone],
    ring = [],
    stones = [],
    channel = [],
    envelope = [];
  for (let k = 0; k < 24; k++) {
    const t = (k / 24) * Math.PI * 2;
    ring.push(at(Math.cos(t) * g.ring[1], Math.sin(t) * g.ring[0]));
  }
  for (let j = 0; j < 7; j++) {
    const t = Math.PI * 0.35 + (j / 6) * Math.PI * 1.3;
    stones.push(at(Math.cos(t) * g.stoneEllipse[1], Math.sin(t) * g.stoneEllipse[0]));
  }
  const flanks = [-1, 1].map(side => [
    lip.x - flow.x * g.flank.back + across.x * side * g.flank.aside,
    lip.z - flow.z * g.flank.back + across.z * side * g.flank.aside
  ]);
  for (let u = g.outlet[0]; u <= g.outlet[1] + 1e-9; u += 0.4)
    for (const v of [-g.channel, 0, g.channel]) channel.push(at(u, v));
  // everything a tree must not stand in: the basin out to the stones' outer reach, and the outlet
  for (let u = -reach[1]; u <= reach[1] + 1e-9; u += 0.3)
    for (let v = -reach[0]; v <= reach[0] + 1e-9; v += 0.3)
      if ((u / reach[1]) ** 2 + (v / reach[0]) ** 2 <= 1) envelope.push(at(u, v));
  envelope.push(...channel);
  return { ring, stones, flanks, channel, envelope, centre };
}

// contour/radius/stretch/style: the island's outline (as in world.mjs); legacy: { lip, flow } the old site; blockers:
// [{ polygon: [[x, z]...], clearance }] paved or built shapes; route: [[x, z]...] walking-route samples (kept routeClearance
// from the basin and stones); trunks: [[x, z]...] fixed trees; mover: [x, z] a tree that stays unless the pond needs its place.
export function pickPondSite({
  contour,
  radius,
  stretch,
  style,
  centreZ = 6.35,
  legacy,
  blockers,
  route = [],
  routeClearance = 3,
  trunks = [],
  mover = null
}) {
  const outline = Array.from({ length: 26 }, (_, k) => {
    const a = (k / 26) * Math.PI * 2,
      r = radius * 0.99 * contour(a, style);
    return [Math.sin(a) * r * stretch, centreZ + (Math.cos(a) * r) / stretch];
  });
  // Smallest slack over every constraint (>= 0 means the whole footprint clears).
  const slack = (lip, flow, trees) => {
    const { ring, stones, flanks, channel, envelope } = pondParts(lip, flow);
    let min = Infinity;
    for (const [x, z] of ring) min = Math.min(min, -polygonDistance(x, z, outline) - 0.1);
    for (const [x, z] of stones) min = Math.min(min, -polygonDistance(x, z, outline) - POND.stone);
    for (const { polygon, clearance } of blockers) {
      for (const [x, z] of [...ring, ...channel])
        min = Math.min(min, polygonDistance(x, z, polygon) - clearance);
      for (const [x, z] of stones)
        min = Math.min(min, polygonDistance(x, z, polygon) - clearance - POND.stone);
      for (const [x, z] of flanks)
        min = Math.min(min, polygonDistance(x, z, polygon) - clearance - POND.flank.reach);
    }
    for (const [x, z] of envelope)
      for (const [tx, tz, keep] of trees) min = Math.min(min, Math.hypot(x - tx, z - tz) - keep);
    for (const [x, z] of [...ring, ...stones])
      for (const [rx, rz] of route) min = Math.min(min, Math.hypot(x - rx, z - rz) - routeClearance);
    return min;
  };
  const fixed = trunks.map(([x, z]) => [x, z, POND.treeKeep]);
  // The roomiest site of one sector for a set of trees (null-safe: returns the best even when it does not clear).
  const bestIn = (from, to, trees) => {
    let best = null;
    for (let deg = from; deg <= to; deg++) {
      // the lip stands 4 % beyond the turf edge, as waterfall() has always been placed; flow along the outline's outward normal
      const a = (deg / 180) * Math.PI,
        r = radius * contour(a, style),
        ex = Math.sin(a) * r * stretch,
        ez = centreZ + (Math.cos(a) * r) / stretch;
      let nx = ex / (stretch * stretch),
        nz = (ez - centreZ) * stretch * stretch;
      const n = Math.hypot(nx, nz);
      nx /= n;
      nz /= n;
      const lip = { x: Math.sin(a) * r * 1.04 * stretch, z: centreZ + (Math.cos(a) * r * 1.04) / stretch },
        flow = { x: nx, z: nz },
        candidate = {
          name: 'sector',
          deg,
          x: lip.x,
          z: lip.z,
          angle: Math.atan2(nx, nz),
          flow,
          slack: slack(lip, flow, trees)
        };
      if (!best || candidate.slack > best.slack) best = candidate;
    }
    return best;
  };
  const withMover = site => ({ ...site, mover });
  const moved = site => {
    const c = { x: site.x - site.flow.x * POND.back, z: site.z - site.flow.z * POND.back };
    return {
      ...site,
      mover: [c.x - site.flow.x * POND.moveBehind, c.z - site.flow.z * POND.moveBehind],
      moved: true
    };
  };
  const old = {
    name: 'legacy',
    x: legacy.lip.x,
    z: legacy.lip.z,
    angle: Math.atan2(legacy.flow.x, legacy.flow.z),
    flow: legacy.flow
  };
  const keeper = mover ? [...fixed, [mover[0], mover[1], POND.moveKeep]] : fixed;
  const kept = { ...old, slack: slack(legacy.lip, legacy.flow, keeper) };
  if (kept.slack >= 0) return withMover(kept);
  // Per sector, in order of preference: prefer moving the pond a little over moving the tree; only if no site of the sector
  // clears the tree does the tree take the landward bank.
  let fallback = null;
  for (const [from, to] of POND_SECTORS) {
    const keep = bestIn(from, to, keeper);
    if (keep.slack >= 0) return withMover(keep);
    if (mover) {
      const free = bestIn(from, to, fixed);
      if (free.slack >= 0) return moved(free);
    }
    if (!fallback || keep.slack > fallback.slack) fallback = keep;
  }
  return withMover(fallback);
}
