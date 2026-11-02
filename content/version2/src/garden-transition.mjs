// Filter and sort transitions between two settled island layouts.
// Islands that keep their cyclic order glide round the ring with one shared
// rotation, so neighbouring gaps interpolate between two valid layouts and
// never close. Islands that would cross another, or travel past MAX_GLIDE,
// sink into the clouds and rise at their new place instead. Bridges are
// retracted while anything moves, so no deck can pass the central tree.
export const MAX_GLIDE = 2.2;
export const SINK_DEPTH = 34;
// Milliseconds at normal speed. Phase A runs in the current world, phase B in the rebuilt one.
// Bridge spans dissolve into motes before an island starts to sink, so no deck stretches after it.
// Gliders levitate while the bridges go, float across, and settle before the spans re-weave as light.
export const TIMELINE = {
  a: { retract: [0, 240], sink: [240, 620], light: [0, 300], lift: [100, 620], end: 620 },
  b: {
    glide: [0, 900],
    rise: [450, 950],
    settle: [640, 940],
    thread: [760, 1080],
    extend: [940, 1300],
    light: [940, 1300],
    overlay: [0, 520],
    end: 1300
  }
};
const smooth = t => t * t * (3 - 2 * t);
export const phaseProgress = (now, [from, to], scale = 1) =>
  to * scale <= from * scale
    ? 1
    : smooth(Math.min(1, Math.max(0, (now - from * scale) / ((to - from) * scale))));
const bell = (t, a, b) => (t <= a || t >= b ? 0 : Math.sin((Math.PI * (t - a)) / (b - a)));
// Levitation height (m) of a gliding island on the relayout clock: zero when still, so phase A's last
// frame and phase B's first frame agree, and every island is back on its deck height before bridges return.
export const LIFT = 1.1;
export function levitation(phase, t, scale) {
  if (!scale) return 0;
  return phase === 'a'
    ? LIFT * phaseProgress(t, TIMELINE.a.lift, scale)
    : LIFT * (1 - phaseProgress(t, TIMELINE.b.settle, scale));
}
// Portal trip over normalised time: the swirl charges, a light tunnel closes in from the edges and is
// opaque at the camera's jump (t=.55) under a flash, then opens on the destination.
export function portalTripShape(t) {
  const surge = Math.min(1, t / 0.45) * (1 - smooth(Math.min(1, Math.max(0, (t - 0.55) / 0.15))));
  const tunnel =
    t < 0.55
      ? smooth(Math.min(1, Math.max(0, (t - 0.28) / 0.27)))
      : 1 - smooth(Math.min(1, Math.max(0, (t - 0.6) / 0.28)));
  return { surge, tunnel, flash: 0.8 * bell(t, 0.515, 0.625) };
}
// Magic gate jump over normalised time: a portal opens in front of the visitor (open), they step into it
// (enter), a light tunnel closes in and a flash covers the cut at `MAGIC_JUMP_CUT`. The tunnel clears quickly on
// the far side, where the visitor stands behind the far ring (exit) for a moment, then walks out through it
// (settle) while it fades. Everything the visitor should not see change (the docked balloon, the overview
// layout) changes under the flash.
export const MAGIC_JUMP_CUT = 0.6;
export function magicJumpShape(t) {
  const clamp01 = x => Math.min(1, Math.max(0, x)),
    cut = MAGIC_JUMP_CUT;
  return {
    open: smooth(clamp01(t / 0.4)),
    enter: smooth(clamp01((t - 0.4) / (cut - 0.4))),
    tunnel: t < cut ? smooth(clamp01((t - 0.44) / 0.14)) : 1 - smooth(clamp01((t - cut - 0.02) / 0.16)),
    flash: 0.92 * bell(t, cut - 0.08, cut + 0.08),
    exit: t < cut ? 0 : 1 - smooth(clamp01((t - cut - 0.2) / 0.2)),
    settle: smooth(clamp01((t - cut - 0.08) / (1 - cut - 0.08)))
  };
}
// Ripple wipe of the rebuild overlay: from the focus outward until the farthest corner is clear.
export function wipeRadius(progress, { width, height, x, y, feather = 48 }) {
  const far = Math.max(
    Math.hypot(x, y),
    Math.hypot(width - x, y),
    Math.hypot(x, height - y),
    Math.hypot(width - x, height - y)
  );
  return -feather + smooth(Math.min(1, Math.max(0, progress))) * (far + 2 * feather);
}
// Where a span's dissolve edge stands for a reveal level, as span parameters on both sides of mid-span
// (see spanReveal: the middle goes first). Null when the span is entirely shown or hidden.
export function spanEdges(span, reveal) {
  if (!span || !(span.to > span.from) || reveal <= 0 || reveal >= 1) return null;
  const w = span.to - span.from,
    h = reveal / 2;
  return [span.from + w * h, span.to - w * h];
}
export function timeScale({ reduced = false } = {}) {
  return reduced ? 0 : 1;
}

const polar = frame => ({
  theta: Math.atan2(frame.x, frame.z),
  dist: Math.hypot(frame.x, frame.z),
  y: frame.y,
  angle: frame.angle
});
const wrapAngle = a => {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
};

// Longest subsequence of shared islands whose cyclic order is unchanged.
export function keptOrder(fromIds, toIds) {
  const common = toIds.filter(id => fromIds.includes(id));
  if (common.length <= 1) return common;
  let best = [];
  for (let s = 0; s < common.length; s++) {
    const seq = [...common.slice(s), ...common.slice(0, s)].map(id => fromIds.indexOf(id)),
      tails = [],
      prev = [];
    seq.forEach((v, i) => {
      let lo = 0,
        hi = tails.length;
      while (lo < hi) {
        const m = (lo + hi) >> 1;
        if (seq[tails[m]] < v) lo = m + 1;
        else hi = m;
      }
      prev[i] = lo ? tails[lo - 1] : -1;
      tails[lo] = i;
    });
    const out = [];
    for (let i = tails.at(-1); i >= 0; i = prev[i]) out.push(fromIds[seq[i]]);
    if (out.length > best.length) best = out.reverse();
  }
  return best;
}

// Shared rotation for the gliders: angles are lifted in cyclic order so every
// neighbouring gap is positive at both ends; the lift with the smallest largest
// move wins. Gliders beyond MAX_GLIDE are dropped one at a time and re-planned.
export function planTransition(fromIds, toIds, fromFrames, toFrames, { maxGlide = MAX_GLIDE } = {}) {
  const from = new Map(fromIds.map(id => [id, polar(fromFrames.get(id))])),
    to = new Map(toIds.map(id => [id, polar(toFrames.get(id))]));
  let glide = keptOrder(fromIds, toIds),
    delta = new Map();
  for (;;) {
    if (!glide.length) {
      delta = new Map();
      break;
    }
    const order = [...glide].sort((a, b) => from.get(a).theta - from.get(b).theta);
    let best = null;
    for (let s = 0; s < order.length; s++) {
      const seq = [...order.slice(s), ...order.slice(0, s)],
        moves = new Map();
      const first = seq[0],
        d0 = wrapAngle(to.get(first).theta - from.get(first).theta);
      moves.set(first, d0);
      let previousStart = from.get(first).theta,
        previousTarget = previousStart + d0;
      for (const id of seq.slice(1)) {
        let start = from.get(id).theta;
        while (start <= previousStart) start += 2 * Math.PI;
        let target = to.get(id).theta;
        while (target <= previousTarget) target += 2 * Math.PI;
        while (target - 2 * Math.PI > previousTarget) target -= 2 * Math.PI;
        moves.set(id, target - start);
        previousStart = start;
        previousTarget = target;
      }
      const worst = Math.max(...[...moves.values()].map(Math.abs));
      if (!best || worst < best.worst) best = { worst, moves };
    }
    if (best.worst <= maxGlide) {
      delta = best.moves;
      break;
    }
    const far = [...best.moves.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0][0];
    glide = glide.filter(id => id !== far);
  }
  const gliding = new Set(delta.keys());
  return {
    glide: [...gliding],
    sink: fromIds.filter(id => !gliding.has(id)),
    rise: toIds.filter(id => !gliding.has(id)),
    turn: id => delta.get(id) ?? null,
    // Island frame part-way along its glide (t is already eased).
    frameAt(id, t) {
      const a = from.get(id),
        b = to.get(id),
        theta = a.theta + delta.get(id) * t,
        dist = a.dist + (b.dist - a.dist) * t;
      return {
        x: Math.sin(theta) * dist,
        y: a.y + (b.y - a.y) * t,
        z: Math.cos(theta) * dist,
        angle: a.angle + wrapAngle(b.angle - a.angle) * t
      };
    }
  };
}

// Rigid island frame: translation to the island centre, then its yaw.
export function frameMatrix(THREE, frame, target = new THREE.Matrix4()) {
  return target.makeRotationY(frame.angle).setPosition(frame.x, frame.y, frame.z);
}
// Owner matrix that shows content built at `built` as if it stood at `shown`.
let inverse = null;
export function displacement(THREE, shown, built, target = new THREE.Matrix4()) {
  inverse ??= new THREE.Matrix4();
  return frameMatrix(THREE, shown, target).multiply(frameMatrix(THREE, built, inverse).invert());
}
// Sink (or, reversed, rise): shrink about the island centre and drop below the clouds.
export function sinkMatrix(THREE, frame, t, target = new THREE.Matrix4()) {
  const s = 1 - 0.35 * t;
  return target.set(
    s,
    0,
    0,
    frame.x * (1 - s),
    0,
    s,
    0,
    frame.y * (1 - s) - SINK_DEPTH * t,
    0,
    0,
    s,
    frame.z * (1 - s),
    0,
    0,
    0,
    1
  );
}
