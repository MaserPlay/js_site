// Structural surfaces share the exact edge samples of the walkable granite.
// The floor stays unchanged; every added surface is underneath it or outside its lane.
// Use the same centered tangent at both ends of a duplicated closed ring.
export function bridgeTangent(THREE, points, i) {
  const n = points.length;
  const loop = n > 2 && points[0].distanceTo(points[n - 1]) < 0.001;
  const before = points[loop && i === 0 ? n - 2 : Math.max(0, i - 1)];
  const after = points[loop && i === n - 1 ? 1 : Math.min(n - 1, i + 1)];
  const tangent = new THREE.Vector3().subVectors(after, before);
  tangent.y = 0;
  return tangent.normalize();
}
export function sweepBridgeProfile(THREE, points, profile, { closed = false, cap = true } = {}) {
  const positions = [],
    uv = [],
    indices = [];
  const row = (i, [offset, height]) => {
    const p = points[i],
      tangent = bridgeTangent(THREE, points, i);
    return [p.x + tangent.z * offset, p.y + height, p.z - tangent.x * offset];
  };
  const push = (p, u, v) => {
    positions.push(...p);
    uv.push(u, v);
    return positions.length / 3 - 1;
  };
  const sides = closed ? profile.length : profile.length - 1;
  for (let j = 0; j < sides; j++) {
    const k = (j + 1) % profile.length,
      base = positions.length / 3;
    let distance = 0;
    for (let i = 0; i < points.length; i++) {
      if (i) distance += points[i].distanceTo(points[i - 1]);
      push(row(i, profile[j]), distance, 0);
      push(
        row(i, profile[k]),
        distance,
        Math.hypot(profile[j][0] - profile[k][0], profile[j][1] - profile[k][1])
      );
      if (i < points.length - 1) {
        const n = base + i * 2;
        indices.push(n, n + 1, n + 2, n + 2, n + 1, n + 3);
      }
    }
  }
  if (cap && points[0].distanceTo(points.at(-1)) > 0.001) {
    for (const i of [0, points.length - 1]) {
      const base = positions.length / 3;
      for (const p of profile) push(row(i, p), p[0], p[1]);
      for (let j = 1; j < profile.length - 1; j++)
        i === 0 ? indices.push(base, base + j + 1, base + j) : indices.push(base, base + j, base + j + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
// A deep stone deck (owner: the thin deck looked unreliable): straight sides, then a chamfer to the soffit.
export const BRIDGE_DECK_DEPTH = 1.1;
export function createBridgeShell(THREE, points, width, depth = BRIDGE_DECK_DEPTH) {
  const w = width / 2;
  return sweepBridgeProfile(THREE, points, [
    [-w, 0],
    [-w, -depth + 0.25],
    [-w + 0.2, -depth],
    [w - 0.2, -depth],
    [w, -depth + 0.25],
    [w, 0]
  ]);
}
export function createBridgeCurb(THREE, points) {
  return sweepBridgeProfile(
    THREE,
    points,
    [
      [-0.11, 0],
      [-0.11, -0.14],
      [0.11, -0.14],
      [0.11, 0],
      [0.08, 0.04],
      [-0.08, 0.04]
    ],
    { closed: true }
  );
}
// Move inside the actual land boundary until the whole bearing has solid ground.
// This returns no anchor when the island cannot support it; no hanging cliff ties.
export function findBridgeLanding(route, station, direction, supports, width = 5) {
  for (let step = 44; step >= 0; step--) {
    const p = station + direction * step * 0.005;
    if (
      [-0.45, 0, 0.45].every(along =>
        [-1, -0.5, 0, 0.5, 1].every(side => {
          const q = route.point(p + along / route.metersPerStation(p), (side * width) / 2);
          return supports(q);
        })
      )
    )
      return p;
  }
  return null;
}

// Refine broad world AABBs for horizontal boxes: a rotated footing's empty
// AABB corners must not be reported as objects in the lane. Keep the original
// broad result for other geometry or tilted boxes; those need full 3D checks.
export function laneBoxDistance(THREE, p, shape) {
  const m = shape.inverse.elements;
  if (!shape.label.startsWith('box:') || [m[1], m[4], m[6], m[9]].some(v => Math.abs(v) > 0.00001)) return 0;
  const q = new THREE.Vector3(p.x, p.y, p.z).applyMatrix4(shape.inverse),
    b = shape.box;
  return Math.hypot(Math.max(b.min.x - q.x, 0, q.x - b.max.x), Math.max(b.min.z - q.z, 0, q.z - b.max.z));
}

// Project island footprint (top contour, stretched along the route, turned to its slot) or the central island.
export function islandContains(island, x, z, margin = 0) {
  if (island.central) return Math.hypot(x - island.x, z - island.z) <= island.radius * 0.97 - margin;
  const X = x - island.x,
    Z = z - island.z,
    lx = Math.cos(island.angle) * X - Math.sin(island.angle) * Z,
    lz = Math.sin(island.angle) * X + Math.cos(island.angle) * Z,
    ux = lx / island.stretch,
    uz = lz * island.stretch;
  const r = Math.hypot(ux, uz);
  return r <= island.radius * island.contour(Math.atan2(ux, uz), island.profile) * 0.97 - margin;
}

// Rail span for one side of ring segment i, as absolute route progress.
// The classic fractions keep the pavilion-deck junction (outer side) and the spoke T junction (inner side,
// slot 0) open; wherever the walkable edge would then run above void the rail is extended toward the slot,
// overlapping the island by `overlap` metres, but never into the junction openings.
export function railSpan(
  route,
  islands,
  i,
  side,
  {
    edge = 2.2,
    deckBefore = 3.275,
    deckAfter = 5.6,
    spokeHalf = 2.1,
    clear = 0.35,
    overlap = 0.6,
    samples = 240
  } = {}
) {
  const mps = route.metersPerStation(i + 0.5, side * edge),
    onLand = p => {
      const q = route.point(p, side * edge, 0);
      return islands.some(s => islandContains(s, q.x, q.z, 0.3));
    };
  const lastSlot = route.closed ? route.count : route.segments,
    startOpen =
      side > 0 ? (deckAfter + clear) / mps : i === 0 && route.count ? (spokeHalf + clear) / mps : 0.02,
    endOpen =
      side > 0
        ? (deckBefore + clear) / mps
        : (i + 1) % Math.max(1, route.count) === 0 && route.closed && route.count
          ? (spokeHalf + clear) / mps
          : 0.02;
  let from = i + (side > 0 ? 0.32 : 0.24),
    to = i + 0.76;
  // Walk from the classic start back toward the slot while the edge is still over void.
  let f = from;
  for (let k = 0; k < samples && f - i > startOpen; k++) {
    const next = f - (from - i) / samples;
    if (onLand(next)) break;
    f = next;
  }
  if (f < from) from = Math.max(i + startOpen, f - overlap / mps);
  let t = to;
  for (let k = 0; k < samples && i + 1 - t > endOpen; k++) {
    const next = t + (i + 1 - to) / samples;
    if (onLand(next)) break;
    t = next;
  }
  if (t > to) to = Math.min(i + 1 - endOpen, t + overlap / mps);
  void lastSlot;
  return { from, to };
}

// Stretches where a walkable bridge edge has neither island ground nor a rail beneath it (metres).
export function unrailedEdges(route, islands, spans, { edge = 2.2, step = 0.0025 } = {}) {
  const runs = [];
  for (const side of [-1, 1]) {
    let run = null;
    for (let p = 0; p <= route.segments + 1e-9; p += step) {
      const q = route.point(p, side * edge, 0),
        i = Math.min(route.segments - 1, Math.floor(p)),
        span = spans[i]?.[side > 0 ? 1 : 0],
        railed = span && p >= span.from - 1e-6 && p <= span.to + 1e-6;
      const bad = !railed && !islands.some(s => islandContains(s, q.x, q.z, 0));
      if (bad && !run) run = { side, from: p };
      if (!bad && run) {
        run.to = p;
        run.metres = (run.to - run.from) * route.metersPerStation(run.from, side * edge);
        runs.push(run);
        run = null;
      }
    }
    if (run) {
      run.to = route.segments;
      run.metres = (run.to - run.from) * route.metersPerStation(run.from, side * edge);
      runs.push(run);
    }
  }
  return runs;
}
// A solid stone arch under a span: full deck width, from just under the deck down to an intrados that is deep
// at both ends (springing from the island cliffs) and shallow at the crown. depth(t) is that depth below the
// deck surface at fraction t of the span. Faces: both sides, the underside and the two end caps.
export function createBridgeArch(THREE, points, width, depth) {
  const w = width / 2 - 0.12,
    n = points.length,
    positions = [],
    indices = [];
  const at = (i, offset, down) => {
    const p = points[i],
      before = points[Math.max(0, i - 1)],
      after = points[Math.min(n - 1, i + 1)];
    const t = new THREE.Vector3().subVectors(after, before);
    t.y = 0;
    t.normalize();
    return [p.x + t.z * offset, p.y - down, p.z - t.x * offset];
  };
  // Four corners per sample: left top, left bottom, right bottom, right top.
  for (let i = 0; i < n; i++) {
    const d = depth(i / (n - 1));
    positions.push(...at(i, -w, 0.45), ...at(i, -w, d), ...at(i, w, d), ...at(i, w, 0.45));
  }
  for (let i = 0; i < n - 1; i++) {
    const a = i * 4,
      b = a + 4;
    for (const [p, q] of [
      [0, 1],
      [1, 2],
      [2, 3]
    ])
      indices.push(a + p, a + q, b + p, a + q, b + q, b + p);
  }
  for (const [i, flip] of [
    [0, true],
    [n - 1, false]
  ]) {
    const a = i * 4;
    flip ? indices.push(a, a + 2, a + 1, a, a + 3, a + 2) : indices.push(a, a + 1, a + 2, a, a + 2, a + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  // World-scaled UVs, so the stone texture matches the shell and curbs (and the static merge finds a uv).
  const uv = [];
  for (let i = 0; i < positions.length; i += 3)
    uv.push((positions[i] + positions[i + 2]) / 2, positions[i + 1] / 2);
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  // Crisp stone faces: no normals shared between the sides and the underside.
  const flat = geometry.toNonIndexed();
  geometry.dispose();
  flat.computeVertexNormals();
  return flat;
}
