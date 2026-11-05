// Conservative complete geometry bounds, not root-to-root spacing.
export function envelopeIntersections(bounds, exclusions, margin = 0.12) {
  return bounds.some(b =>
    exclusions.some(
      e =>
        b.max.y >= e.min.y &&
        b.min.y <= e.max.y &&
        b.max.x + margin >= e.min.x &&
        b.min.x - margin <= e.max.x &&
        b.max.z + margin >= e.min.z &&
        b.min.z - margin <= e.max.z
    )
  );
}
// Boxes filed on a grid over x and z (CELL m), so a plant is tested only against the boxes near it (round 21: every
// plant against every box took 31 ms of one rearrangement step). A box goes under every cell its footprint widened by
// the margin touches, so near() returns every box an overlap test with that margin could find: same answers.
const CELL = 4;
export function boxIndex(exclusions, margin = 0.12) {
  const cells = new Map(),
    span = (lo, hi) => [Math.floor(lo / CELL), Math.floor(hi / CELL)],
    key = (i, j) => (i + 32768) * 65536 + j + 32768;
  for (const e of exclusions) {
    const [i0, i1] = span(e.min.x - margin, e.max.x + margin),
      [j0, j1] = span(e.min.z - margin, e.max.z + margin);
    for (let i = i0; i <= i1; i++)
      for (let j = j0; j <= j1; j++) {
        const k = key(i, j);
        if (!cells.has(k)) cells.set(k, []);
        cells.get(k).push(e);
      }
  }
  return bounds => {
    const near = new Set();
    for (const b of bounds) {
      const [i0, i1] = span(b.min.x, b.max.x),
        [j0, j1] = span(b.min.z, b.max.z);
      for (let i = i0; i <= i1; i++)
        for (let j = j0; j <= j1; j++) for (const e of cells.get(key(i, j)) || []) near.add(e);
    }
    return [...near];
  };
}
// A candidate copy of p moved round its original spot; a shrunken candidate is judged by its own scaled footprint.
function candidate(p, original, angle, distance, ratio) {
  return {
    ...p,
    x: original.x + Math.sin(angle) * distance,
    z: original.z + Math.cos(angle) * distance,
    scale: original.scale * ratio,
    radius: p.radius === undefined ? undefined : p.radius * ratio
  };
}
export function separatePlants(plants, exclusions, boundsFor, acceptable) {
  const shifted = [],
    unresolved = [],
    near = boxIndex(exclusions),
    blocked = bounds => envelopeIntersections(bounds, near(bounds));
  for (const p of plants) {
    if (!blocked(boundsFor(p))) continue;
    const original = { x: p.x, z: p.z, scale: p.scale };
    let found = false;
    for (const ratio of [1, 0.85, 0.7]) {
      for (const distance of [0.4, 0.8, 1.2, 1.7, 2.2, 2.8, 3.5, 4.2]) {
        for (let j = 0; j < 24; j++) {
          const c = candidate(p, original, (j / 24) * Math.PI * 2 + (p.random?.[10] || 0), distance, ratio);
          // The cheap envelope test first: acceptable() may raycast the lawn (round 4: it slowed every rebuild).
          if (!blocked(boundsFor(c)) && acceptable(c)) {
            Object.assign(p, c);
            shifted.push({ from: original, to: { x: p.x, z: p.z, scale: p.scale } });
            found = true;
            break;
          }
        }
        if (found) break;
      }
      if (found) break;
    }
    if (!found) unresolved.push({ x: p.x, z: p.z });
  }
  return {
    exclusions: exclusions.map(e => ({ min: e.min.toArray(), max: e.max.toArray() })),
    shifted,
    unresolved,
    overlaps: plants.filter(p => blocked(boundsFor(p))).length
  };
}
