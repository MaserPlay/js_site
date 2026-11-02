// The stone staircases on the climbing bridges, shared by the builder (world.mjs) and the visitors
// (character.mjs), so people stand on the treads that are drawn instead of on the smooth ramp under them.

// Height of one step, and the climb (m) from which a span gets stairs instead of a ramp.
export const STAIR_RISE = 0.24;
export const STAIR_MIN_CLIMB = 3.5;
// A tread's top stands this far above the route centre line at the step's upper end. The deck is at +0.1:
// 6 cm clear, so the two never fight for the same pixels from far away (2 cm shimmered from the observatory).
export const TREAD_TOP = 0.16;

// The flight on span i, or null: `edges` are the step boundaries in the span's 0..1, at equal height steps of
// the climb; `tops` the level top of each tread (each tread as high as its upper end).
export function stairFlight(route, i, rise = STAIR_RISE) {
  const climb = route.point(i + 1).y - route.point(i).y;
  if (Math.abs(climb) < STAIR_MIN_CLIMB || route.isLift?.(i)) return null;
  const steps = Math.max(2, Math.round(Math.abs(climb) / rise)),
    [from, to] = route.climbSpan(i),
    y0 = route.point(i + from).y,
    y1 = route.point(i + to).y,
    edges = [from];
  for (let k = 1; k < steps; k++) {
    const goal = y0 + ((y1 - y0) * k) / steps;
    let lo = from,
      hi = to;
    for (let n = 0; n < 30; n++) {
      const mid = (lo + hi) / 2;
      if ((route.point(i + mid).y - goal) * (y1 - y0) < 0) lo = mid;
      else hi = mid;
    }
    edges.push((lo + hi) / 2);
  }
  edges.push(to);
  const tops = [];
  for (let k = 0; k < steps; k++)
    tops.push(Math.max(route.point(i + edges[k]).y, route.point(i + edges[k + 1]).y) + TREAD_TOP);
  return { segment: i, climb, steps, edges, tops };
}

// Every span's flight (null where the span has none).
export function stairFlights(route, rise = STAIR_RISE) {
  return Array.from({ length: route.segments || 0 }, (_, i) => stairFlight(route, i, rise));
}

// The tread top under route progress p, or null off the stairs. Allocation-free.
export function treadAt(flights, p) {
  const i = Math.floor(p),
    flight = flights[i];
  if (!flight) return null;
  const u = p - i,
    edges = flight.edges;
  if (u < edges[0] || u > edges[edges.length - 1]) return null;
  let k = 0;
  while (k < flight.steps - 1 && u >= edges[k + 1]) k++;
  return flight.tops[k];
}
