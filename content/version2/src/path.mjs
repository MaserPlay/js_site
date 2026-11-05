// Shared bridge geometry and camera route. A closed connection, not a regular circle.
export const START_ANGLE = 0.34;
// Share of a span at each end that stays level with its island (see sample()): spans between islands of
// about the same height hold both ends; a climb holds long at the higher island and briefly at the lower.
export const ROUTE_HOLD = { level: 0.2, high: 0.45, low: 0.05 };
// Preview only (?preview=tall): islands several times higher, to judge the look before choosing it. The walk
// spans too steep to walk become water lifts (LIFT): level to the middle of the span, a vertical ride up a
// glowing water column, then level again.
export const HEIGHT_PREVIEW =
  typeof location !== 'undefined' && /[?&]preview=tall(&|$)/.test(location.search) ? 3.5 : 1;
// Four or more projects keep the established ring. Fewer use the first slots of a
// wider three-slot ring: one island has only the spoke, two share one open arc, and
// no bridge deck comes within 4 m of the central island rim.
// The level holds at the two ends of a span from island height a to island height b.
export const LIFT = { rise: 6, hold: 0.47 };
export const isLiftSpan = (a, b) => HEIGHT_PREVIEW > 1 && Math.abs(b - a) >= LIFT.rise;
export function spanHolds(a, b) {
  if (isLiftSpan(a, b)) return [LIFT.hold, LIFT.hold];
  if (Math.abs(b - a) < 0.5) return [ROUTE_HOLD.level, ROUTE_HOLD.level];
  return b > a ? [ROUTE_HOLD.low, ROUTE_HOLD.high] : [ROUTE_HOLD.high, ROUTE_HOLD.low];
}
export function ringRadius(count) {
  return count <= 3 ? 23 : Math.max(20, count * 3.2);
}
export function topology(count) {
  const k = Math.max(0, Math.floor(count)),
    n = Math.max(3, k),
    radius = ringRadius(k),
    closed = k >= 3,
    segments = closed ? k : Math.max(0, k - 1);
  const variations = [1.0, 1.14, 1.21, 1.1, 1.24, 1.09, 0.96],
    heights = [0, 2.6, 5.4, 2.8, 7.2, 2.0, -1.6],
    jitter = [0, 0.05, -0.06, 0.02, -0.04, 0.07, -0.02];
  const slots = Array.from({ length: n }, (_, i) => {
    const a = START_ANGLE + (i * 2 * Math.PI) / n + jitter[i % 7],
      r = radius * variations[i % 7];
    return { x: Math.sin(a) * r, y: 0.26 + heights[i % 7] * HEIGHT_PREVIEW, z: Math.cos(a) * r };
  });
  const anchors = slots.slice(0, k);
  const sample = p => {
    const base = Math.floor(p),
      t = wrapped(p, 1),
      a = slots[wrapped(base, n)],
      b = slots[wrapped(base + 1, n)],
      prev = slots[wrapped(base - 1, n)],
      next = slots[wrapped(base + 2, n)];
    const blend = key => {
      const m1 = (b[key] - prev[key]) * 0.37,
        m2 = (next[key] - a[key]) * 0.37;
      return (
        (2 * t ** 3 - 3 * t * t + 1) * a[key] +
        (t ** 3 - 2 * t * t + t) * m1 +
        (-2 * t ** 3 + 3 * t * t) * b[key] +
        (t ** 3 - t * t) * m2
      );
    };
    // The walk keeps the station's height while it crosses the island and climbs or descends only between the
    // islands. Starting the climb at the station sent the deck under the island ground (up to 1 m) beside
    // every hall of a higher or lower island, which read as the island overlapping the path.
    // Toward a higher island the deck reaches its level early (that island's ground reaches far into the
    // span); from a lower island it starts rising at once, above the ground rather than under it.
    const [h0, h1] = spanHolds(a.y, b.y);
    const climb = smooth(Math.min(1, Math.max(0, (t - h0) / (1 - h0 - h1))));
    return {
      x: blend('x'),
      y: a.y + (b.y - a.y) * climb + 0.62 * Math.sin(Math.PI * t) ** 2,
      z: blend('z')
    };
  };
  const tangent = p => {
    const a = sample(p - 0.001),
      b = sample(p + 0.001),
      length = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    return { x: (b.x - a.x) / length, z: (b.z - a.z) / length };
  };
  const normal = p => {
    const t = tangent(p);
    return { x: -t.z, z: t.x };
  };
  const point = (p, offset = 0, eye = 0) => {
    const q = sample(p),
      v = normal(p);
    return { x: q.x + v.x * offset, y: q.y + eye, z: q.z + v.z * offset };
  };
  const angle = p => {
    const v = normal(p);
    return Math.atan2(v.x, v.z);
  };
  const radial = (p, distance, height = 0.26) => {
    const q = sample(p),
      v = normal(p);
    return { x: q.x + v.x * (distance - radius), y: q.y - 0.26 + height, z: q.z + v.z * (distance - radius) };
  };
  const metersPerStation = (p, offset = 0) => {
    const a = point(p - 0.002, offset),
      b = point(p + 0.002, offset);
    return Math.max(1, Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / 0.004);
  };
  const distance = (from, to) => {
    const steps = Math.max(4, Math.ceil(Math.abs(to - from) * 32));
    let length = 0,
      a = sample(from);
    for (let j = 1; j <= steps; j++) {
      const b = sample(from + ((to - from) * j) / steps);
      length += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
      a = b;
    }
    return length;
  };
  const length = distance(0, segments);
  const advance = (p, meters, offset = 0) => {
    const guess = meters / metersPerStation(p, offset);
    return p + meters / metersPerStation(p + guess * 0.5, offset);
  };
  const spoke = (t, eye = 0) => {
    const a = slots[0];
    return { x: a.x * t, y: 0.26 + (a.y - 0.26) * smooth(t) + eye, z: a.z * t };
  };
  // The part of span i where the deck actually climbs or descends, as [from, to] in that span's 0..1.
  const climbSpan = i => {
    const [h0, h1] = spanHolds(slots[wrapped(i, n)].y, slots[wrapped(i + 1, n)].y);
    return [h0, 1 - h1];
  };
  return {
    count: k,
    segments,
    climbSpan,
    isLift: i => isLiftSpan(slots[wrapped(i, n)].y, slots[wrapped(i + 1, n)].y),
    closed,
    radius,
    angle,
    deck: p => sample(p).y,
    point,
    radial,
    tangent,
    normal,
    anchors,
    metersPerStation,
    advance,
    distance,
    length,
    spoke
  };
}
// Route progress for a station: the shortest way round a closed ring, or the
// station itself on an open arc, where there is no bridge past either end.
export function routeTarget(route, index, current, direction = 0) {
  if (!route.count) return 0;
  return route.closed
    ? nearestProgress(index, current, route.count, direction)
    : wrapped(Math.round(index), route.count);
}
// Island frame of a slot: centre 10.2 m beyond the route anchor, turned to the route normal.
// The world builds islands from the same frame; transitions plan against it before rebuilding.
export function islandFrame(route, slot) {
  const c = route.radial(slot, route.radius + 10.2, 0);
  return { x: c.x, y: c.y, z: c.z, angle: route.angle(slot) };
}
export function layoutFrames(ids) {
  const route = topology(ids.length);
  return new Map(ids.map((id, slot) => [id, { id, slot, ...islandFrame(route, slot) }]));
}
export function wrapped(value, count) {
  return ((value % count) + count) % count;
}
export function nearestProgress(index, current, count, direction = 0) {
  let result = index + Math.round((current - index) / count) * count;
  if (direction > 0 && result < current - 0.03) result += count;
  if (direction < 0 && result > current + 0.03) result -= count;
  return result;
}
export function smooth(t) {
  return t * t * (3 - 2 * t);
}

// Only the departure and terminal station affect the lateral camera offset. reach(offset, station) is the
// stretch of route (in stations) over which that offset is taken on or left; a glass hall uses a short one.
export function transitOffset(progress, start, startOffset, target, inspectionOffset, reach = () => 0.24) {
  const departed = smooth(Math.min(1, Math.abs(progress - start) / reach(startOffset, start)));
  const arrival =
    Math.abs(target - Math.round(target)) < 0.001
      ? 1 - smooth(Math.min(1, Math.abs(target - progress) / reach(inspectionOffset, target)))
      : 0;
  const departure = startOffset * (1 - departed);
  return departure + (inspectionOffset - departure) * arrival;
}
