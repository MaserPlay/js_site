// Island vines that follow the cliff. The shared curtain hangs straight down from the lip while the basalt
// tapers in under it, so strands used to stand out from the rock by a metre or more. Each curtain now carries,
// per strand, how far that strand sits out of (or into) its straight hang at a fixed ladder of drops; the vine
// shader adds it to every vertex of the strand. The ladder is spaced by square root: close under the lip where
// the rock tucks in fast, wide lower down where it runs smoothly.
export const DRAPE = {
  strands: 5,
  knots: 13,
  // Drop (m) of the last knot.
  reach: 7.5,
  // Strand centre off the rock face, measured square to the face.
  clearance: 0.04,
  // Half-width (m) over which the outermost rock face is followed, so a strand never dips into a crevice.
  lateral: 0.1,
  // Turf slab thickness: the top of each strand stays where it crosses the lip.
  lip: 0.2,
  // Beyond this run per metre of drop the face is an underside, not a wall: the curtain stops there.
  steep: 1.25,
  // Even on a steep face the shortest curtain (m).
  minLength: 1.2,
  // Largest change of the offset per metre of drop between knots.
  slope: 1.5
};

// Drop (m) of knot i.
export const drapeDepth = i => DRAPE.reach * (i / (DRAPE.knots - 1)) ** 2;

// The offset (m, along the curtain's outward axis) of a strand at a drop; the vertex shader does the same.
export function drapeOffset(data, base, strand, drop) {
  const u = Math.sqrt(Math.min(Math.max(drop, 0) / DRAPE.reach, 1)) * (DRAPE.knots - 1),
    k = Math.min(Math.floor(u), DRAPE.knots - 2),
    at = base + strand * DRAPE.knots + k;
  return data[at] + (data[at + 1] - data[at]) * (u - k);
}

const TAU = Math.PI * 2;

// The cliff skin cut at island-local height y: where each column of the grid crosses it, by polar angle.
function crossSection(position, columns, rows, y) {
  const ring = [];
  for (let c = 0; c < columns; c++) {
    let hit = null;
    for (let r = 0; r < rows - 1; r++) {
      const i = r * columns + c,
        j = i + columns,
        y0 = position.getY(i),
        y1 = position.getY(j);
      if (y0 >= y && y > y1) {
        const t = (y0 - y) / (y0 - y1),
          x = position.getX(i) + (position.getX(j) - position.getX(i)) * t,
          z = position.getZ(i) + (position.getZ(j) - position.getZ(i)) * t;
        hit = { a: (Math.atan2(x, z) + TAU) % TAU, x, z };
        break;
      }
    }
    if (!hit) return null;
    ring.push(hit);
  }
  return ring.sort((p, q) => p.a - q.a);
}

// Distance from the island axis to the skin along polar angle a (the chord of the ring, as rendered).
function ringRadius(ring, angle) {
  const a = ((angle % TAU) + TAU) % TAU,
    last = ring.length - 1;
  let lo = last,
    hi = 0;
  if (a >= ring[0].a && a < ring[last].a) {
    lo = 0;
    hi = last;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (ring[mid].a <= a) lo = mid;
      else hi = mid;
    }
  }
  const p = ring[lo],
    q = ring[hi],
    dx = q.x - p.x,
    dz = q.z - p.z,
    den = Math.sin(a) * dz - Math.cos(a) * dx;
  return Math.abs(den) < 1e-9 ? Math.hypot(p.x, p.z) : (p.x * dz - p.z * dx) / den;
}

/**
 * The cliff of one island (a basalt geometry carrying userData.grid) sampled at every knot's height. Heights are
 * island-local: the vine origin sits on the turf slab, 0.2 m above the island's own origin.
 */
export function createCliffSurface(geometry) {
  const grid = geometry.userData.grid,
    position = geometry.attributes.position;
  if (!grid) return { rings: [] };
  const rows = Math.round((position.count - 1) / grid.columns);
  return {
    rings: Array.from({ length: DRAPE.knots }, (_, k) =>
      crossSection(position, grid.columns, rows, 0.2 - drapeDepth(k))
    )
  };
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Per strand and knot, how far (m, along the curtain's outward axis) the strand must move from its straight hang to
 * lie DRAPE.clearance off the cliff, and the curtain length that still lies on a wall (shorter where the cliff
 * recedes into an underside).
 *   surface: createCliffSurface(); frame: the island {x, z, rotation, stretch}; origin: the curtain's world {x, z};
 *   yaw/width/length: its instance (width is signed: mirrored curtains are negative); paths: the vine geometry's
 *   userData.strandPaths (the straight hang of each strand).
 */
export function planDrape({ surface, frame, origin, yaw, width, length, paths }) {
  const { strands: S, knots: K } = DRAPE,
    w = Math.abs(width),
    outX = Math.sin(yaw),
    outZ = Math.cos(yaw),
    sideX = Math.cos(yaw),
    sideZ = -Math.sin(yaw),
    cr = Math.cos(frame.rotation),
    sr = Math.sin(frame.rotation);
  // A world (x, z) in the cliff geometry's own frame (the island is rotated, then stretched).
  const local = (x, z) => {
    const dx = x - frame.x,
      dz = z - frame.z;
    return [(cr * dx - sr * dz) / frame.stretch, (sr * dx + cr * dz) * frame.stretch];
  };
  // Signed distance of a world point outside the cliff at knot k, and its rate along the outward axis.
  const outside = (k, x, z) => {
    const [gx, gz] = local(x, z),
      [ox, oz] = local(x + outX, z + outZ),
      r = Math.hypot(gx, gz);
    return {
      gap: r - ringRadius(surface.rings[k], Math.atan2(gx, gz)),
      rate: ((ox - gx) * gx + (oz - gz) * gz) / Math.max(r, 1e-6)
    };
  };
  // The straight hang of a strand at geometry height y: [x, z]. Below its tip the tip's own place, so the knots just
  // under a strand still carry where the rock has got to.
  const hang = (s, height) => {
    const path = paths[s],
      y = Math.max(height, path.y[path.y.length - 1]);
    let i = 1;
    while (i < path.y.length - 1 && path.y[i] > y) i++;
    const f = clamp((path.y[i - 1] - y) / (path.y[i - 1] - path.y[i] || 1), 0, 1);
    return [path.x[i - 1] + (path.x[i] - path.x[i - 1]) * f, path.z[i - 1] + (path.z[i] - path.z[i - 1]) * f];
  };
  // The face's lean at knot k and bearing `angle` widens the clearance a strand needs (square to the face, not level).
  const faceClearance = (k, angle) => {
    const ring = surface.rings[k],
      above = surface.rings[Math.max(k - 1, 0)] || ring,
      below = surface.rings[Math.min(k + 1, K - 1)] || ring,
      run = Math.abs(ringRadius(above, angle) - ringRadius(below, angle)),
      drop = drapeDepth(Math.min(k + 1, K - 1)) - drapeDepth(Math.max(k - 1, 0));
    return DRAPE.clearance * Math.hypot(1, clamp(run / drop, 0, 3));
  };
  // Outermost face over the strand's width: the strand lies on the ridge, not in a crevice between.
  const outermost = (k, px, pz, clearance) => {
    let t = -Infinity;
    for (const across of [-DRAPE.lateral, 0, DRAPE.lateral]) {
      let u = 0;
      for (let it = 0; it < 4; it++) {
        const { gap, rate } = outside(k, px + sideX * across + outX * u, pz + sideZ * across + outZ * u);
        u -= (gap - clearance) / Math.max(rate, 0.25);
      }
      t = Math.max(t, clamp(u, -6, 6));
    }
    return t;
  };
  // Strand s at knot k of a curtain stretched by `stretch` (previous: its offset at the knot above): the offset and
  // the strand's resulting place along the outward axis.
  const knot = (s, k, stretch, previous) => {
    const d = drapeDepth(k),
      b = hang(s, -d / (w * stretch));
    let t = previous;
    if (b && surface.rings[k] && d >= DRAPE.lip) {
      const px = origin.x + sideX * b[0] * width + outX * b[1] * w,
        pz = origin.z + sideZ * b[0] * width + outZ * b[1] * w,
        [gx, gz] = local(px, pz);
      t = outermost(k, px, pz, faceClearance(k, Math.atan2(gx, gz)));
    } else if (d < DRAPE.lip) t = 0;
    // Between knots the offset never changes faster than the face can lean.
    if (k > 1) {
      const run = DRAPE.slope * (d - drapeDepth(k - 1)) + (k < 4 ? 0.1 : 0);
      t = clamp(t, previous - run, previous + run);
    }
    return { t, z: (b ? b[1] * w : 0) + t };
  };
  // The curtain ends where the lead strand's wall turns into an underside.
  const wallCut = (lead, span) => {
    for (let k = 5; k < K && drapeDepth(k) <= w * span; k++)
      if (Math.abs(lead[k] - lead[k - 1]) > DRAPE.steep * (drapeDepth(k) - drapeDepth(k - 1)))
        return drapeDepth(k - 1);
    return Infinity;
  };
  function fit(span) {
    const stretch = span / 4,
      offsets = new Float32Array(S * K),
      lead = [];
    for (let s = 0; s < S; s++)
      for (let k = 0; k < K; k++) {
        const { t, z } = knot(s, k, stretch, k ? offsets[s * K + k - 1] : 0);
        offsets[s * K + k] = t;
        if (s === 0) lead.push(z);
      }
    return { offsets, cut: wallCut(lead, span) };
  }
  let result = fit(length),
    span = length;
  if (result.cut < w * length) {
    span = Math.min(length, Math.max(DRAPE.minLength, result.cut / w));
    result = fit(span);
  }
  return { offsets: result.offsets, length: span };
}

// One row of offsets per instance (undefined: no drape, all zero) as a float texture the vine shader reads by
// instance index.
export function createDrapeTexture(THREE, rows) {
  const width = DRAPE.strands * DRAPE.knots,
    data = new Float32Array(Math.max(rows.length, 1) * width);
  rows.forEach((row, i) => row && data.set(row, i * width));
  const texture = new THREE.DataTexture(
    data,
    width,
    Math.max(rows.length, 1),
    THREE.RedFormat,
    THREE.FloatType
  );
  texture.minFilter = texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return { texture, data, width, rows: rows.length };
}
