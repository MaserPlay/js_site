// Observatory (part of every garden; ?sky=off leaves it out): one island above everything else in the garden,
// its highest point, and the garden's balloon station. A small tethered balloon carries visitors up from a
// pad beside the central island; from the terrace a tour balloon takes them once round the whole garden and
// back. One of the drifting balloons (sky-life.mjs) starts from the station's launch mast and comes back to
// it. From the terrace a zipline runs down to its own landing rock beyond the island ring (never into a
// pavilion); the camera then returns to the overview. It is not part of the project ring, so sorting and
// filtering never move it.
import { islandFrame } from './path.mjs';
import { SIGN, cablePoint, createTransitSign, drawInlay, paintText } from './sky-transit.mjs';
import { createBalloon, createFlameMaterial, DEFAULT_BALLOON_BASKET } from './sky-life.mjs';
import { createPocketPortal } from './pocket-portal.mjs';
import { paintContext } from './paint-canvas.mjs';

// ?sky=off builds the garden without the observatory.
export const SKY_ENABLED = typeof location === 'undefined' || !/[?&]sky=off(&|$)/.test(location.search);
export const SKY = {
  // Rock top and distance from the garden centre for the 7-project garden (route radius `reference`); both
  // scale with the garden, so the overview frames the station the same way at every size. The tallest garden
  // objects (island trees, the central crown) end near 13 m: the deck stands about 11 m above them, low enough
  // that the docked envelopes (17 m above the deck) stay inside the desktop overview frame, above the far
  // pavilion's roof.
  height: 23.5,
  distance: 20,
  reference: 22.4,
  // At least this far above the tallest island's ground (its trees end about 6 m up).
  above: 16,
  radius: 6.4,
  depth: 9,
  // A raised stone deck covers the whole rock top (and the boulders on it) and the railing runs round its edge,
  // so a visitor at the railing looks down past the rim instead of across the island's own ground.
  deck: { radius: 7.3, rise: 0.9 },
  rail: 7.2,
  // The shuttle pad stands on its own small rock beside the central island: the central tree fills that island.
  liftAt: 13,
  // The pad stands off to one side (radians round the garden centre), so the shuttle never blocks the view from
  // the terrace and its envelope rises clear of the deck edge (about 11 m from the island centre).
  liftTurn: 0.66,
  liftIsland: 3.4,
  liftRadius: 1.6,
  // The banner hangs on the garden side of the rock, this far below the deck and out from its centre (clear of
  // the rock, which hides it otherwise; the envelopes above it reach the top of the desktop overview), this wide.
  label: { drop: 3.2, out: 8, width: 12, maxYaw: Math.PI / 15 }
};
// The zipline leaves the deck through a gate in the railing and ends on its own rock out beyond the island ring.
export const SKY_ZIP = {
  tower: 3.1,
  // The rider hangs 1.25 m under the cable, so at the landing post the eye is at standing height.
  post: 3,
  hang: 1.25,
  body: 1.8,
  sag: 0.05,
  // Drop per metre of run (about 23°): a long, steady glide.
  slope: 0.42,
  // Landing rock distance beyond the mean island ring, and from every island centre (long tips reach ~18 m).
  out: [14, 18, 22, 26],
  apart: 22,
  // A larger garden gets a longer, flatter run; the landing post never ends below the highest island + 6 m.
  run: [36, 96],
  ideal: 48,
  floor: 6,
  bearings: 120,
  rock: 3.2,
  // The gate keeps this far (radians round the deck) from the lift landing.
  liftGap: 0.55,
  // Rider's feet above: trees and pavilions near an island centre, island ground out to its tips, the central
  // tree, bridges and spokes inside the ring, and the lift column top.
  clear: { core: 14, trees: 10, tip: 20, ground: 3, centre: 15, crown: 15, bridges: 4, column: 2.5 }
};
// Wayfinding (metres above the pad rock or the deck). Hanging plaques stay above a walking eye (TERRACE.eye):
// the tour and zipline walks pass under them.
export const SIGNPOST = {
  lantern: 0xffcf7a,
  lift: { y: 1.75, width: 1.9, height: 0.56, post: 2.25 },
  // The tour dock: an arch between the mooring mast and a matching post, the plaque hanging from its beam.
  tour: { width: 1.3, height: 0.4, y: 2.5, beam: 2.95 },
  // The zipline tower: an arm towards the deck centre with a short crossbar, the plaque hanging under it.
  zip: { width: 1.2, height: 0.4, y: 2.5, arm: 2.95, reach: 0.75 },
  // Signs and banner dim a little at night (lantern-lit rather than glowing).
  night: 0.22
};
// The shuttle pad's fingerpost: beside the pad (never in the ride's way), facing the garden centre, its tip
// towards the pad and its post at the other end.
export function liftSignpost(THREE, base, liftDir) {
  const out = { x: liftDir.z, z: -liftDir.x },
    { width } = SIGNPOST.lift,
    at = {
      x: base.x + out.x * (STATION.pad + 1.1),
      y: SIGNPOST.lift.y,
      z: base.z + out.z * (STATION.pad + 1.1)
    },
    probe = new THREE.Object3D();
  probe.position.set(at.x, at.y, at.z);
  probe.lookAt(0, at.y, 0);
  probe.updateMatrix();
  // The plank's own right (+x), as seen from its front; the pad lies along -out.
  const side = new THREE.Vector3().setFromMatrixColumn(probe.matrix, 0),
    toPad = side.x * out.x + side.z * out.z <= 0 ? 1 : -1;
  return {
    at,
    post: { x: at.x - side.x * toPad * (width / 2 + 0.1), z: at.z - side.z * toPad * (width / 2 + 0.1) },
    tip: toPad > 0 ? 'right' : 'left'
  };
}
// Two cords from a beam at height `top` down to a plaque's upper corners (half-spread tx, tz along the plaque).
function cords(line, at, tx, tz, top, bottom) {
  for (const k of [-1, 1])
    line(
      [
        { x: at.x + tx * k, y: top, z: at.z + tz * k },
        { x: at.x + tx * k, y: bottom, z: at.z + tz * k }
      ],
      'rail',
      0.012
    );
}
// Sign texts when the language file has none.
const SIGN_TEXT = {
  skyLift: 'Balloon lift',
  skyIsland: 'Observatory',
  skyTour: 'Balloon flight',
  zipline: 'Zipline'
};
const say = (labels, key) => labels?.[key] || SIGN_TEXT[key];
// The banner fades out from this far beyond the deck edge over this span (m), in this long (s).
const BANNER_FADE = { near: 3, span: 6, seconds: 0.35 };
// The banner canvas (pixels) and its colours: a deep green cloth with a brass trim under a wooden rod.
export const BANNER = {
  canvas: [1024, 420],
  cloth: ['#2f6650', '#1f4637'],
  trim: '#d9b45f',
  rod: '#6b4529'
};
// Draws the observatory banner: rod with brass knobs, cords, a swallow-tailed cloth, a telescope inlay and the name.
export function drawBannerCanvas(c, w, h, text) {
  c.clearRect(0, 0, w, h);
  const top = h * 0.17,
    left = w * 0.07,
    right = w * 0.93,
    bottom = h * 0.95,
    notch = h * 0.8;
  // Cords from the rod to the cloth corners.
  c.strokeStyle = BANNER.rod;
  c.lineWidth = h * 0.012;
  c.beginPath();
  c.moveTo(w * 0.3, h * 0.07);
  c.lineTo(left + w * 0.02, top);
  c.moveTo(w * 0.7, h * 0.07);
  c.lineTo(right - w * 0.02, top);
  c.stroke();
  // Cloth with a swallow tail, a darker hem and a brass trim inside the edge.
  const cloth = () => {
    c.beginPath();
    c.moveTo(left, top);
    c.lineTo(right, top);
    c.lineTo(right, bottom);
    c.lineTo(w / 2, notch);
    c.lineTo(left, bottom);
    c.closePath();
  };
  const fill = c.createLinearGradient(0, top, 0, bottom);
  fill.addColorStop(0, BANNER.cloth[0]);
  fill.addColorStop(1, BANNER.cloth[1]);
  c.fillStyle = fill;
  cloth();
  c.fill();
  c.save();
  cloth();
  c.clip();
  // Soft folds.
  for (let i = 1; i < 8; i++) {
    c.fillStyle = i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)';
    c.fillRect(left + ((right - left) * i) / 8 - w * 0.03, top, w * 0.06, bottom - top);
  }
  c.restore();
  const t = h * 0.035;
  c.strokeStyle = BANNER.trim;
  c.lineWidth = h * 0.012;
  c.beginPath();
  c.moveTo(left + t, top + t);
  c.lineTo(right - t, top + t);
  c.lineTo(right - t, bottom - t * 1.6);
  c.lineTo(w / 2, notch - t * 1.2);
  c.lineTo(left + t, bottom - t * 1.6);
  c.closePath();
  c.stroke();
  // The rod across the top, with brass knobs.
  c.fillStyle = BANNER.rod;
  c.fillRect(w * 0.03, top - h * 0.045, w * 0.94, h * 0.06);
  for (const x of [w * 0.03, w * 0.97]) {
    c.fillStyle = SIGN.brass.dark;
    c.beginPath();
    c.arc(x, top - h * 0.015, h * 0.045, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = SIGN.brass.light;
    c.beginPath();
    c.arc(x - h * 0.01, top - h * 0.025, h * 0.02, 0, Math.PI * 2);
    c.fill();
  }
  const mid = (top + notch) / 2 + h * 0.02,
    r = h * 0.2,
    iconX = left + w * 0.04 + r;
  drawInlay(c, 'telescope', iconX, mid, r, '#f6e7c4', BANNER.cloth[1]);
  const from = iconX + r + w * 0.03,
    room = right - w * 0.05 - from;
  paintText(c, text, from + room / 2, mid, room, h * 0.3, { shadow: 'rgba(8,24,18,0.8)' });
}
// Terrace camera: the visitor walks round just inside the railing, looking out and down; the wheel or a pinch
// narrows the lens like a telescope.
export const TERRACE = {
  eye: 1.75,
  inset: 0.45,
  reach: 30,
  // Radians below the horizon.
  // Starts low enough to show the ring and the horizon; never tips so far that the railing fills the view.
  tilt: { min: -0.1, max: 1.05, start: 0.62 },
  // Field-of-view factor: 1 is the overview lens.
  zoom: { min: 0.3, max: 1 },
  // Radians round the rim per screen width dragged, and of tilt per screen height.
  lap: 4,
  pitch: 1.8,
  // Wheel and +/- keys: the overview orbit's zoom step becomes a lens factor of exp(step × wheel).
  wheel: 2.6,
  ease: 9,
  settle: 1e-4
};
const TAU = Math.PI * 2;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const turnOf = a => Math.atan2(Math.sin(a), Math.cos(a));

// The island sits on the side of the garden away from the default overview camera, so in that view it floats
// above and behind the central tree.
export function skyDirection(cameraBase) {
  const l = Math.hypot(cameraBase.x, cameraBase.z) || 1;
  return { x: -cameraBase.x / l, z: -cameraBase.z / l };
}

// Terrace camera state: where it stands round the rim (angle), how far it looks down (tilt) and the lens (zoom),
// each easing towards its goal.
export function terraceState(view) {
  const start = { angle: view.gardenAngle, tilt: TERRACE.tilt.start, zoom: 1 };
  return { ...start, goal: { ...start }, moving: false };
}
export function terraceInput(state, { turn = 0, tilt = 0, zoom = 1, zoomTo = null } = {}) {
  const goal = state.goal;
  // Finer steps while the telescope is zoomed in.
  if (Number.isFinite(turn)) goal.angle += turn * goal.zoom;
  if (Number.isFinite(tilt))
    goal.tilt = clamp(goal.tilt + tilt * goal.zoom, TERRACE.tilt.min, TERRACE.tilt.max);
  const lens = zoomTo ?? goal.zoom * zoom;
  if (Number.isFinite(lens)) goal.zoom = clamp(lens, TERRACE.zoom.min, TERRACE.zoom.max);
  return state;
}
// Eases towards the goal; dt = Infinity (reduced motion) jumps there. Returns whether it is still moving.
export function terraceStep(state, dt) {
  const k = dt === Infinity ? 1 : 1 - Math.exp(-TERRACE.ease * Math.max(0, dt || 0));
  let moving = false;
  for (const key of ['angle', 'tilt', 'zoom']) {
    const gap = state.goal[key] - state[key];
    if (k >= 1 || Math.abs(gap) <= TERRACE.settle) state[key] = state.goal[key];
    else {
      state[key] += gap * k;
      moving = true;
    }
  }
  state.moving = moving;
  return moving;
}
// Writes the camera position and look target (THREE.Vector3 or anything with set()).
export function terracePose(view, state, position, look) {
  const s = Math.sin(state.angle),
    c = Math.cos(state.angle),
    level = Math.cos(state.tilt) * TERRACE.reach;
  position.set(view.island.x + s * view.ring, view.eye, view.island.z + c * view.ring);
  look.set(position.x + s * level, view.eye - Math.sin(state.tilt) * TERRACE.reach, position.z + c * level);
  return position;
}
// Points round the rim from one angle to another the short way, so a walk never crosses the telescope.
export function terraceWalk(view, from, to) {
  const turn = turnOf(to - from),
    steps = Math.ceil(Math.abs(turn) / 0.45);
  return Array.from({ length: steps }, (_, j) => {
    const a = from + (turn * (j + 1)) / steps;
    return {
      x: view.island.x + Math.sin(a) * view.ring,
      y: view.eye,
      z: view.island.z + Math.cos(a) * view.ring
    };
  });
}

// How far the rider's feet stay above everything the cable passes (metres; negative means a collision).
export function zipRoom(start, end, { frames, lift, inner }) {
  const c = SKY_ZIP.clear,
    top = frames.reduce((m, f) => Math.max(m, f.y), 0);
  let room = Infinity;
  // The first and last metres stand over the deck and the landing rock.
  for (let j = 2; j <= 36; j++) {
    const p = cablePoint(start, end, j / 40, SKY_ZIP.sag),
      feet = p.y - SKY_ZIP.hang - SKY_ZIP.body;
    for (const f of frames) {
      const h = Math.hypot(p.x - f.x, p.z - f.z);
      if (h < c.core) room = Math.min(room, feet - f.y - c.trees);
      else if (h < c.tip) room = Math.min(room, feet - f.y - c.ground);
    }
    const r = Math.hypot(p.x, p.z);
    if (r < c.centre) room = Math.min(room, feet - c.crown);
    if (r < inner) room = Math.min(room, feet - top - c.bridges);
    if (Math.hypot(p.x - lift.x, p.z - lift.z) < lift.radius + c.column)
      room = Math.min(room, feet - lift.top);
  }
  return room;
}
// One landing candidate: null when it sits too near an island, too near the lift landing or at a bad distance.
function zipCandidate(land, { island, deck, frames, lift, inner, floor, liftAt, avoid }) {
  if (frames.some(f => Math.hypot(land.x - f.x, land.z - f.z) < SKY_ZIP.apart)) return null;
  const gate = Math.atan2(land.x - island.x, land.z - island.z);
  if (Math.abs(turnOf(gate - liftAt)) < SKY_ZIP.liftGap) return null;
  // Never through a docked balloon.
  if (avoid.some(a => Math.abs(turnOf(gate - a)) < STATION.zipGap)) return null;
  const start = {
      x: island.x + Math.sin(gate) * SKY.rail,
      y: deck + SKY_ZIP.tower,
      z: island.z + Math.cos(gate) * SKY.rail
    },
    run = Math.hypot(land.x - start.x, land.z - start.z);
  if (run < SKY_ZIP.run[0] || run > SKY_ZIP.run[1]) return null;
  const end = { x: land.x, y: Math.max(floor, start.y - run * SKY_ZIP.slope), z: land.z },
    room = zipRoom(start, end, { frames, lift, inner });
  return { start, end, gate, run, room, score: Math.min(room, 8) - Math.abs(run - SKY_ZIP.ideal) * 0.08 };
}
// Picks the landing rock: round the garden beyond the islands, the cable with the most room and a run near the
// ideal length. Null when no cable clears the garden.
export function planSkyZip({ island, deck, frames, lift, route, avoid = [] }) {
  const ring = frames.length
      ? frames.reduce((s, f) => s + Math.hypot(f.x, f.z), 0) / frames.length
      : route.radius + 10,
    context = {
      island,
      deck,
      frames,
      lift,
      inner: route.anchors.reduce((m, a) => Math.max(m, Math.hypot(a.x, a.z)), route.radius) + 3,
      floor: frames.reduce((m, f) => Math.max(m, f.y), 0) + SKY_ZIP.floor,
      liftAt: Math.atan2(lift.x - island.x, lift.z - island.z),
      avoid
    };
  let best = null;
  for (let k = 0; k < SKY_ZIP.bearings; k++) {
    const bearing = (k / SKY_ZIP.bearings) * TAU;
    for (const out of SKY_ZIP.out) {
      const c = zipCandidate(
        { x: Math.sin(bearing) * (ring + out), z: Math.cos(bearing) * (ring + out) },
        context
      );
      if (c && c.room > 0 && (!best || c.score > best.score)) best = c;
    }
  }
  return best;
}

// The station's own balloons, docks and the scenic tour (sky-island.mjs builds them; garden.mjs drives the rides).
export const STATION = {
  // Docks round the deck, radians from the side facing away from the garden: the launch mast that the drifting
  // balloon (sky-life.mjs) leaves from and returns to, then the tour balloon and a spare one on the two flanks.
  launch: 0,
  flank: 1.45,
  gangway: 1.4,
  // Short enough to stand clear under the docked envelopes.
  mast: 3.2,
  gate: 0.13,
  // The zipline gate keeps this far (radians round the deck) from every dock.
  zipGap: 0.7,
  // sky-life.mjs's cycling balloon: solid basket half-width × its scale.
  launchHalf: DEFAULT_BALLOON_BASKET.half * 1.15,
  // A low-walled passenger basket, so a standing visitor sees out over the rim.
  tour: { palette: 1, scale: 1.15, basket: { half: 0.88, depth: 0.82, drop: 1.1 } },
  // The spare waits at the dock where visitors pass close by: the open woven basket, as the shuttle's.
  spare: { palette: 4, scale: 1, basket: { ...DEFAULT_BALLOON_BASKET } },
  shuttle: { palette: 3, scale: 0.72, basket: { ...DEFAULT_BALLOON_BASKET } },
  // The empty shuttle sinks back to its pad after a ride (seconds).
  shuttleDown: 16,
  pad: 1.7,
  // Shuttle view: eye above the basket rim, how far it leans out over it, radians below the horizon.
  eye: 0.4 + (1.4 - DEFAULT_BALLOON_BASKET.depth) * 0.72,
  lean: 0,
  pitch: 0.2
};
// The balloon station's own island out beyond the ring (metres): rock, stone deck, railing, docks round it, the
// arrival circle on its garden side, and where it may stand (round the ring, clear of every island, the observatory
// and the shuttle column, never far above the islands).
export const STATION_ISLAND = {
  radius: 7.5,
  depth: 6,
  deck: 6.2,
  rise: 0.4,
  rail: 6.1,
  // Radians round the deck between the launch mast (outermost) and the tour and spare docks.
  flank: 1.45,
  arrival: 3.2,
  out: [16, 20, 24],
  // Island tips reach about 18 m from their centres; the station rock adds its own radius.
  apart: 27,
  fromObservatory: 26,
  fromLift: 20,
  liftGap: 0.55,
  ideal: 46,
  // The deck sits this much lower per metre from the observatory, never below the islands + floor.
  slope: 0.3,
  floor: 3,
  bearings: 120
};
// The shuttle pier: how far below the deck its knee braces meet the rock, its railing posts' spacing, and how far
// at most it reaches out past the deck edge (owner, round 4: the long pier stuck out; the pad moves in instead).
const PIER = { brace: 3.2, posts: 1.4, reach: 2 };
// The shuttle pad, slid toward the observatory along the line between them until the pier past the deck edge
// (gap - deck radius - basket half) is no longer than PIER.reach, but never so close that the rising envelope
// would brush the deck edge. The ride's path follows from the pad.
function pierBase(base, centre, { half, radius }) {
  const gx = centre.x - base.x,
    gz = centre.z - base.z,
    gap = Math.hypot(gx, gz),
    excess = gap - Math.max(SKY.deck.radius + half + 0.05 + PIER.reach, SKY.deck.radius + radius + 0.4);
  if (excess <= 0) return base;
  return { x: base.x + (gx / gap) * excess, y: base.y, z: base.z + (gz / gap) * excess };
}
// The banner's mounting: a post on the deck edge, an arm out over the banner at this height above the deck, and
// a swivel crossbar with two hangers down to the banner's top rod (at ± this share of its width).
// arm: height of the arm over the deck (m; under it when negative). hangers: half the spread of the two hangers as
// a share of the banner width (at its top corners); rod: their thickness (m). Round 5: the arm ran 1.35 m over the
// deck right under the arriving terrace camera and filled its view like a column, and thin hangers near the
// middle vanished at a distance, so the banner read as floating. Now the arm runs under the deck rim, hidden from
// the terrace, and short stout hangers hold the banner's top rod at its corners.
const BANNER_MOUNT = { arm: -0.35, hangers: 0.44, rod: 0.1 };
// Rune circles of the magic gate between the terrace and the station.
export const MAGIC_GATE = {
  radius: 1.1,
  inset: 1.9,
  glow: 0x8fdcff,
  floor: 0x6a4fd6,
  stand: 1.32,
  approach: 2.4
};
// A clear site for the station island: round the garden beyond the ring, the best run from the observatory. Null
// only when no bearing clears the islands.
export function planStationSite({ island, deck, frames, lift, route }) {
  const k = STATION_ISLAND,
    ring = frames.length
      ? frames.reduce((s, f) => s + Math.hypot(f.x, f.z), 0) / frames.length
      : route.radius + 10,
    floor = frames.reduce((m, f) => Math.max(m, f.y), 0) + k.floor,
    liftAt = Math.atan2(lift.x - island.x, lift.z - island.z);
  let best = null;
  for (let b = 0; b < k.bearings; b++) {
    const bearing = (b / k.bearings) * TAU;
    for (const out of k.out) {
      const site = stationCandidate(Math.sin(bearing) * (ring + out), Math.cos(bearing) * (ring + out), {
        island,
        frames,
        lift,
        liftAt
      });
      if (site && (!best || site.score > best.score))
        best = { ...site, ground: Math.max(floor, deck - site.run * k.slope) };
    }
  }
  return best;
}
// One candidate site for the station: null when it crowds an island, the observatory, the shuttle column or
// the pier's side; otherwise how good a run it is from the observatory.
function stationCandidate(x, z, { island, frames, lift, liftAt }) {
  const k = STATION_ISLAND,
    nearest = frames.reduce((m, f) => Math.min(m, Math.hypot(x - f.x, z - f.z)), Infinity),
    run = Math.hypot(x - island.x, z - island.z),
    gate = Math.atan2(x - island.x, z - island.z);
  if (nearest < k.apart || run < k.fromObservatory) return null;
  if (Math.hypot(x - lift.x, z - lift.z) < k.fromLift + lift.radius) return null;
  if (Math.abs(turnOf(gate - liftAt)) < k.liftGap) return null;
  return { x, z, run, gate, score: -Math.abs(run - k.ideal) * 0.1 + Math.min(nearest - k.apart, 10) * 0.2 };
}
// Scenic tour: off the tour dock, once round the whole garden beyond the island ring, back onto the dock.
export const TOUR = {
  // Cruising speed (m/s) and how gently the balloon speeds up, slows down and turns back (m/s²).
  speed: 2,
  accel: 0.3,
  // A larger garden flies a little faster, so the loop takes about this long (s), up to this speed (m/s).
  cruise: 115,
  fastest: 5.5,
  ring: 9,
  // The loop stays this far from the station centre: clear of the docked balloons and the launch mast's climb.
  clear: 20,
  rise: 5,
  swell: 2,
  climb: 4,
  // Radians round the loop between control points, and the arc left open where the spur meets it.
  step: 0.35,
  open: 0.25,
  // First person in the basket: eye above the rim. Looking out, the eye stands back from the front wall (rim,
  // corner ropes and the sky above in view); looking down it leans out until it is this far behind the rim.
  // Looking up, the eye stands back towards the far wall so the burner overhead comes into view.
  eye: 0.62,
  back: -0.55,
  front: 0.5,
  // Default look below the horizon; at lift-off the visitor looks up at the burner flame and into the envelope.
  pitch: 0.45,
  lookUp: 1.4,
  lookUpSeconds: 14,
  // Drags (radians per screen width / height) and the pitch limits (negative looks up).
  look: { yaw: 2.6, pitch: 1.8, up: -1.05, down: 1.15 },
  fov: 1.5,
  phoneFov: 1.2,
  // Burner: roars while the balloon climbs off the dock, then a burst every `every` s for `burst` s.
  burner: { climb: 9, every: 11, burst: 2.6 },
  // Within this many metres of the dock the basket turns to its gangway.
  dockReach: 12
};
const smooth = x => {
  const k = clamp(x, 0, 1);
  return k * k * (3 - 2 * k);
};
// Tour state: where along the path (u, 0..1), speed along it (m/s), which end it heads for and since when.
export function tourState(home = 0.95) {
  return { phase: 'docked', u: 0, v: 0, end: 1, home, time: 0, yaw: 0, pitch: 0 };
}
// Advances the balloon by dt seconds; true once it has docked. Speed eases up, cruises and eases down to rest at
// the end it heads for, so turning back first slows, stops and then flies the other way.
export function tourStep(state, dt, length, speed = TOUR.speed) {
  if (state.phase === 'docked') return true;
  const d = Number.isFinite(dt) ? clamp(dt, 0, 0.1) : 0;
  if (!d || !(length > 0)) return false;
  const remaining = Math.abs(state.end - state.u) * length,
    want = Math.sign(state.end - state.u) * Math.min(speed, Math.sqrt(2 * TOUR.accel * remaining)),
    a = TOUR.accel * d * 2;
  state.v += clamp(want - state.v, -a, a);
  state.u = clamp(state.u + (state.v * d) / length, 0, 1);
  state.time += d;
  // Past the loop the balloon is on its way home anyway.
  if (state.phase === 'out' && state.u >= state.home) state.phase = 'return';
  if (Math.abs(state.end - state.u) * length < 0.08 && Math.abs(state.v) < 0.25) {
    state.u = state.end;
    state.v = 0;
    state.phase = 'docked';
    return true;
  }
  return false;
}
// Stop pressed: the balloon turns back the shorter way along its path to the dock.
export function tourTurnBack(state) {
  if (state.phase !== 'out') return false;
  state.phase = 'return';
  state.end = state.u < 0.5 ? 0 : 1;
  return true;
}
// Control points of the tour (basket floor positions): up off the dock, out to the loop, round the garden the
// long way and back in. sign picks the direction round the garden.
export function planSkyTour({ centre, dock, out, ring, frames, sign = 1 }) {
  const radius = Math.max(ring + TOUR.ring, Math.hypot(centre.x, centre.z) + TOUR.clear),
    tallest = frames.reduce((m, f) => Math.max(m, f.y), 0),
    floor = Math.max(dock.y + TOUR.rise, tallest + 14),
    a0 = Math.atan2(dock.x + out.x * 8, dock.z + out.z * 8),
    span = TAU - TOUR.open * 2,
    steps = Math.ceil(span / TOUR.step),
    points = [{ ...dock }, { x: dock.x + out.x, y: dock.y + TOUR.climb, z: dock.z + out.z }];
  for (let j = 0; j <= steps; j++) {
    const k = j / steps,
      a = a0 + sign * (TOUR.open + span * k);
    points.push({
      x: Math.sin(a) * radius,
      y: floor + TOUR.swell * Math.sin(k * TAU * 2),
      z: Math.cos(a) * radius
    });
  }
  points.push({ x: dock.x + out.x, y: dock.y + TOUR.climb, z: dock.z + out.z }, { ...dock });
  return { points, radius, floor };
}

// Flame profile (radius, height) and three shells of it: the tongue, a smaller bright core and a dim halo round both.
// Each shell scales the profile and runs through colour stops [t, r, g, b] (linear RGB; t = 0 at the nozzle, 1 at
// the tip): blue at the root, yellow, then orange fading to red; the core pale blue to white; the halo faint.
const FLAME = {
  profile: [
    [0.065, 0],
    [0.09, 0.16],
    [0.12, 0.38],
    [0.085, 0.66],
    [0.035, 0.9],
    [0, 1.05]
  ],
  shells: [
    {
      radius: 1,
      height: 1,
      stops: [
        [0, 0.1, 0.28, 1],
        [0.14, 0.4, 0.5, 0.95],
        [0.3, 1, 0.78, 0.28],
        [0.65, 1, 0.48, 0.1],
        [1, 0.55, 0.08, 0.02]
      ]
    },
    {
      radius: 0.45,
      height: 0.7,
      stops: [
        [0, 0.3, 0.5, 1],
        [0.35, 0.85, 0.9, 1],
        [0.7, 1, 0.85, 0.5],
        [1, 0.9, 0.55, 0.15]
      ]
    },
    {
      radius: 1.5,
      height: 0.8,
      stops: [
        [0, 0.02, 0.06, 0.25],
        [0.3, 0.2, 0.13, 0.04],
        [1, 0.1, 0.03, 0.01]
      ]
    }
  ]
};
function flameGeometry(THREE) {
  const position = [],
    color = [],
    index = [];
  for (const { radius, height, stops } of FLAME.shells) {
    const lathe = new THREE.LatheGeometry(
        FLAME.profile.map(([x, y]) => new THREE.Vector2(x * radius, y * height * 0.66)),
        12
      ),
      p = lathe.attributes.position,
      top = FLAME.profile[FLAME.profile.length - 1][1] * height * 0.66,
      offset = position.length / 3;
    for (let i = 0; i < p.count; i++) {
      const t = clamp(p.getY(i) / top, 0, 1),
        j = Math.max(
          1,
          stops.findIndex(([at]) => at >= t)
        ),
        [t0, ...from] = stops[j - 1],
        [t1, ...to] = stops[j],
        k = clamp((t - t0) / (t1 - t0), 0, 1);
      position.push(p.getX(i), p.getY(i), p.getZ(i));
      for (let c = 0; c < 3; c++) color.push(from[c] + (to[c] - from[c]) * k);
    }
    for (const i of lathe.index.array) index.push(i + offset);
    lathe.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
  g.setIndex(index);
  g.computeBoundingSphere();
  return g;
}

// The flame geometry's height (its tallest shell), for the flame shader.
const FLAME_HEIGHT = 0.7;
// Soft round glow: a sprite with a radial falloff drawn by hand (no canvas), additive, unfogged.
function flameGlow(THREE) {
  const size = 32,
    data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const r = clamp(Math.hypot(x - size / 2 + 0.5, y - size / 2 + 0.5) / (size / 2), 0, 1),
        i = (y * size + x) * 4;
      data.set([255, 170, 90, Math.round(255 * Math.pow(1 - r, 2.2))], i);
    }
  const map = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  map.needsUpdate = true;
  return new THREE.Sprite(
    new THREE.SpriteMaterial({
      map,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      fog: false
    })
  );
}

export function createSkyIsland(
  THREE,
  { island, mesh, line, batch, palette, resources, route, pickable, labels, camera }
) {
  const dir = skyDirection(camera),
    size = route.radius / SKY.reference,
    // Never below the island trees, also when the islands stand taller (?preview=tall).
    tallest = Array.from({ length: route.count }, (_, i) => islandFrame(route, i).y).reduce(
      (m, y) => Math.max(m, y),
      0
    ),
    centre = {
      x: dir.x * SKY.distance * size,
      y: Math.max(SKY.height * size, tallest + SKY.above),
      z: dir.z * SKY.distance * size
    },
    land = island(centre.x, centre.z, SKY.radius, SKY.depth, centre.y, 1, 3, Math.atan2(dir.x, dir.z)),
    deck = centre.y + 0.15 + SKY.deck.rise,
    rim = (a, r, y) => ({ x: centre.x + Math.sin(a) * r, y, z: centre.z + Math.cos(a) * r }),
    gardenAngle = Math.atan2(-centre.x, -centre.z),
    away = gardenAngle + Math.PI;
  const balloon = spec => {
    const b = createBalloon(THREE, spec, (geometry, material) => mesh(geometry, material));
    resources.add(b.material);
    b.mesh.userData.dynamic = true;
    return b;
  };
  // Observatory: a round stone deck over the rock top with a lamp-lit railing and a telescope on a tripod.
  const floor = mesh(
    new THREE.CylinderGeometry(SKY.deck.radius, SKY.deck.radius - 0.35, SKY.deck.rise, 48),
    palette.path
  );
  floor.position.set(centre.x, deck - SKY.deck.rise / 2, centre.z);
  const scope = new THREE.Group();
  scope.position.set(centre.x, deck, centre.z);
  scope.rotation.y = Math.atan2(-dir.x, -dir.z);
  for (const a of [0, 2.1, 4.2]) {
    const leg = mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.5, 6), palette.metal, scope);
    leg.position.set(Math.sin(a) * 0.35, 0.7, Math.cos(a) * 0.35);
    leg.rotation.set(Math.cos(a) * 0.25, 0, -Math.sin(a) * 0.25);
  }
  const tube = mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.6, 16), palette.metal, scope);
  tube.position.set(0, 1.55, 0.2);
  tube.rotation.x = 1.05;
  // Balloon shuttle: a small tethered balloon waits on its pad beside the central island; a ride winches it up
  // beside the deck, where a stone pier leads onto the terrace.
  const shuttle = balloon(STATION.shuttle),
    c = Math.cos(SKY.liftTurn),
    s = Math.sin(SKY.liftTurn),
    liftDir = { x: dir.x * c - dir.z * s, z: dir.x * s + dir.z * c },
    base = pierBase({ x: liftDir.x * SKY.liftAt, y: 0.5, z: liftDir.z * SKY.liftAt }, centre, shuttle),
    liftRock = island(base.x, base.z, SKY.liftIsland, 4.5, 0, 1, 5, 0),
    top = { x: base.x, y: deck + 0.02, z: base.z },
    liftAt = Math.atan2(base.x - centre.x, base.z - centre.z),
    toCentre = Math.atan2(centre.x - base.x, centre.z - base.z);
  {
    const gx = centre.x - base.x,
      gz = centre.z - base.z,
      gap = Math.hypot(gx, gz),
      from = shuttle.half + 0.05,
      to = gap - SKY.deck.radius + 0.5,
      mid = (from + to) / 2;
    const heading = Math.atan2(gx, gz),
      ux = gx / gap,
      uz = gz / gap,
      along = (d, side, y) => ({ x: base.x + ux * d + uz * side, y, z: base.z + uz * d - ux * side });
    batch('box', 'stone', along(mid, 0, deck - 0.22), { x: 2.4, y: 0.4, z: to - from }, { y: heading });
    // The pier is cantilevered off the deck: two timber knee braces from its outer end down into the rock face,
    // and a railing along both sides.
    const rock = gap - SKY.radius + 0.6;
    for (const side of [-1, 1]) {
      const top = along(from + 0.5, side * 0.95, deck - 0.45),
        foot = along(rock, side * 0.95, deck - PIER.brace),
        dx = top.x - foot.x,
        dy = top.y - foot.y,
        dz = top.z - foot.z,
        length = Math.hypot(dx, dy, dz),
        strut = mesh(new THREE.BoxGeometry(0.18, 0.18, length), palette.bark ?? palette.rail);
      strut.position.set((top.x + foot.x) / 2, (top.y + foot.y) / 2, (top.z + foot.z) / 2);
      strut.lookAt(top.x, top.y, top.z);
      const rail = [along(from, side * 1.12, deck + 0.95), along(to - 0.4, side * 1.12, deck + 0.95)];
      line(rail, 'rail', 0.05);
      for (let d = from; d <= to - 0.3; d += PIER.posts)
        batch('box', 'rail', along(d, side * 1.12, deck + 0.47), { x: 0.1, y: 0.95, z: 0.1 }, { y: heading });
    }
  }
  const pad = mesh(new THREE.CylinderGeometry(STATION.pad, STATION.pad + 0.25, 0.4, 24), palette.stone);
  pad.position.set(base.x, base.y - 0.2, base.z);
  // Winch on the pad's garden side; the tether runs from it to the basket floor.
  batch(
    'box',
    'rail',
    {
      x: base.x - liftDir.x * (STATION.pad - 0.3),
      y: base.y + 0.3,
      z: base.z - liftDir.z * (STATION.pad - 0.3)
    },
    { x: 0.7, y: 0.6, z: 0.5 },
    { y: toCentre }
  );
  const tether = mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 5), palette.rail);
  tether.userData.dynamic = true;
  const shuttleState = { at: 0, driven: false, last: 0 },
    up = new THREE.Vector3(0, 1, 0),
    rope = new THREE.Vector3();
  // The shuttle climbs a little to one side (away from the garden centre) so its envelope passes the pier, then
  // slides in over it at the top; the tether runs from the winch to the basket floor.
  const aside = (() => {
    const gx = centre.x - base.x,
      gz = centre.z - base.z,
      l = Math.hypot(gx, gz) || 1,
      x = gz / l,
      z = -gx / l,
      s = x * base.x + z * base.z >= 0 ? 1 : -1;
    return { x: x * s * (shuttle.radius + 1.6), z: z * s * (shuttle.radius + 1.6) };
  })();
  function poseShuttle(at) {
    shuttleState.at = clamp(at, 0, 1);
    const k = shuttleState.at,
      y = base.y + (top.y - base.y) * smooth(k / 0.72),
      o = smooth(k / 0.25) * (1 - smooth((k - 0.75) / 0.25)),
      x = base.x + aside.x * o,
      z = base.z + aside.z * o;
    shuttle.setFloor(x, y, z, toCentre);
    rope.set(x - base.x, y - base.y, z - base.z);
    const length = rope.length();
    tether.visible = length > 0.3;
    tether.position.set((x + base.x) / 2, (y + base.y) / 2, (z + base.z) / 2);
    if (length > 1e-6) tether.quaternion.setFromUnitVectors(up, rope.divideScalar(length));
    tether.scale.y = Math.max(0.01, length);
    return y;
  }
  poseShuttle(0);
  // Wooden wayfinding signs (sky-transit.mjs); every face is a tap target for `kind`.
  const signMaterials = [];
  const sign = (text, at, face, kind, options) => {
    const plank = createTransitSign(THREE, { mesh, resources }, text, options);
    plank.position.set(at.x, at.y, at.z);
    plank.lookAt(face.x, at.y, face.z);
    for (const object of plank.userData.faces) pickable.push({ object, kind });
    signMaterials.push(...plank.userData.materials);
    return plank;
  };
  const lantern = (p, size = 1) => {
    batch(
      'box',
      'rail',
      { x: p.x, y: p.y + 0.15 * size, z: p.z },
      { x: 0.26 * size, y: 0.06, z: 0.26 * size }
    );
    const glow = mesh(new THREE.BoxGeometry(0.17 * size, 0.22 * size, 0.17 * size), lanternGlow);
    glow.position.set(p.x, p.y, p.z);
  };
  const lanternGlow = new THREE.MeshBasicMaterial({ color: SIGNPOST.lantern, toneMapped: false });
  resources.add(lanternGlow);
  // Beside the pad, not in front of it, so the ride never passes through it: a fingerpost on a wooden post with a
  // lantern on top, its tip pointing at the shuttle.
  {
    const { at, post, tip } = liftSignpost(THREE, base, liftDir);
    batch('box', 'bark', { ...post, y: SIGNPOST.lift.post / 2 }, { x: 0.16, y: SIGNPOST.lift.post, z: 0.16 });
    batch('box', 'stone', { ...post, y: 0.12 }, { x: 0.5, y: 0.24, z: 0.5 });
    lantern({ ...post, y: SIGNPOST.lift.post + 0.14 });
    const { width, height } = SIGNPOST.lift;
    sign(say(labels, 'skyLift'), at, { x: 0, z: 0 }, 'skylift', { width, height, icon: 'lift', tip });
  }
  // The shuttle balloon, its signpost and the banner start the ride; the rock itself does not (a tap on the island
  // is not a request to board a balloon).
  pickable.push({ object: shuttle.mesh, kind: 'skylift' });
  // A cloth banner hung from a wooden rod under the deck. Its small upright turn stays clear of the rock. Drawn
  // with the depth test on and outside the rock, so balloons, the deck and the basket hide it like any object.
  let label = null,
    bannerMount = null;
  {
    const canvas = document.createElement('canvas');
    canvas.width = BANNER.canvas[0];
    canvas.height = BANNER.canvas[1];
    drawBannerCanvas(paintContext(canvas), canvas.width, canvas.height, say(labels, 'skyIsland'));
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = SIGN.anisotropy;
    resources.add(texture);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide,
      // A flat banner shows one face at a time: three's back-then-front pair of draws for a transparent double
      // side re-chose its program twice every frame (round 22, the frame profile).
      forceSinglePass: true,
      toneMapped: false,
      transparent: true,
      alphaTest: 0.02
    });
    resources.add(material);
    const geometry = new THREE.PlaneGeometry(1, 1);
    resources.add(geometry);
    label = new THREE.Mesh(geometry, material);
    label.scale.set(SKY.label.width, (SKY.label.width * canvas.height) / canvas.width, 1);
    label.position.set(
      centre.x - dir.x * SKY.label.out,
      deck - SKY.label.drop,
      centre.z - dir.z * SKY.label.out
    );
    label.rotation.y = Math.atan2(-dir.x, -dir.z);
    label.userData.dynamic = true;
    // Hidden means untouchable too: three.js raycasts invisible objects, and the hidden banner hangs right under
    // the terrace view.
    label.raycast = function (raycaster, hits) {
      if (this.visible) THREE.Mesh.prototype.raycast.call(this, raycaster, hits);
    };
    land.top?.parent?.add(label);
    pickable.push({ object: label, kind: 'skylift' });
    // Real mounting: a strut under the deck edge and an arm out over the banner (fixed), and a swivel crossbar with
    // two hangers down to the banner's top rod that turns with the banner (update() keeps it aligned).
    const out = { x: -dir.x, z: -dir.z },
      armY = deck + BANNER_MOUNT.arm,
      postAt = SKY.deck.radius - 0.35,
      at = d => ({ x: centre.x + out.x * d, z: centre.z + out.z * d }),
      w = label.scale.x,
      top = label.position.y + label.scale.y / 2,
      { rod } = BANNER_MOUNT;
    batch(
      'box',
      'bark',
      { ...at(postAt), y: deck + BANNER_MOUNT.arm / 2 },
      { x: 0.16, y: Math.abs(BANNER_MOUNT.arm), z: 0.16 }
    );
    batch(
      'box',
      'bark',
      { ...at((postAt + SKY.label.out) / 2), y: armY },
      { x: 0.14, y: 0.14, z: SKY.label.out - postAt + 0.2 },
      { y: Math.atan2(out.x, out.z) }
    );
    batch('box', 'rail', { ...at(SKY.label.out), y: armY - 0.12 }, { x: 0.12, y: 0.12, z: 0.12 });
    bannerMount = new THREE.Group();
    bannerMount.position.set(label.position.x, armY - 0.2, label.position.z);
    const hang = top - bannerMount.position.y,
      part = (x, y, sx, sy, sz) => {
        const m = mesh(new THREE.BoxGeometry(sx, sy, sz), palette.rail, bannerMount);
        m.position.set(x, y, 0);
        m.userData.dynamic = true;
        m.userData.noOcclude = true;
      };
    part(0, 0, w * BANNER_MOUNT.hangers * 2 + 0.2, rod * 1.4, rod * 1.4);
    for (const k of [-1, 1]) part(k * w * BANNER_MOUNT.hangers, hang / 2, rod, Math.abs(hang), rod);
    // The banner's own top rod, the hangers' anchor, across its whole width.
    part(0, hang, w + 0.12, rod * 1.2, rod * 1.2);
    bannerMount.rotation.y = label.rotation.y;
    bannerMount.userData.dynamic = true;
    land.top?.parent?.add(bannerMount);
  }
  const labelFade = { value: 1, target: 1 };
  let signShade = 1;
  const runeGlow = new THREE.MeshBasicMaterial({
    color: MAGIC_GATE.glow,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });
  const runeFloor = new THREE.MeshBasicMaterial({
    color: MAGIC_GATE.floor,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    toneMapped: false
  });
  resources.add(runeGlow);
  resources.add(runeFloor);
  // Balloon station: every docked balloon (the tour balloon, the spare and the drifting balloon's launch mast)
  // waits on the station island out beyond the island ring; the observatory keeps only its terrace. From the
  // terrace a magic gate (a rune circle on the deck) takes visitors across to the station in one step, where they
  // board the tour balloon. The station stands where a clear site exists (planStationSite); without one the docks
  // stay round the observatory deck, as before.
  const frames = Array.from({ length: route.count }, (_, i) => islandFrame(route, i)),
    site = planStationSite({
      island: centre,
      deck,
      frames,
      // The shuttle climbs beside its pad (aside, above): the whole column it sweeps.
      lift: {
        x: base.x + aside.x / 2,
        z: base.z + aside.z / 2,
        radius: shuttle.radius + Math.hypot(aside.x, aside.z) / 2,
        top: deck + shuttle.height
      },
      route
    });
  const side = turnOf(liftAt - away) >= 0 ? 1 : -1;
  // The station island itself (its rock, deck and arrival circle), or null without a site.
  const buildStation = () => {
    if (!site) return null;
    const S = { x: site.x, y: site.ground, z: site.z },
      outward = Math.atan2(S.x, S.z),
      // Faces the observatory side of the garden: the arrival circle and the walk to the tour dock.
      toGarden = outward + Math.PI,
      top = S.y + STATION_ISLAND.rise,
      srim = (a, r, y) => ({ x: S.x + Math.sin(a) * r, y, z: S.z + Math.cos(a) * r });
    const land = island(S.x, S.z, STATION_ISLAND.radius, STATION_ISLAND.depth, S.y - 0.2, 1, 5, outward);
    const floor = mesh(
      new THREE.CylinderGeometry(STATION_ISLAND.deck, STATION_ISLAND.deck - 0.3, STATION_ISLAND.rise, 40),
      palette.path
    );
    floor.position.set(S.x, top - STATION_ISLAND.rise / 2, S.z);
    return {
      centre: S,
      top,
      land,
      srim,
      outward,
      arrival: srim(toGarden, STATION_ISLAND.arrival, top + TERRACE.eye),
      ring: srim(toGarden, STATION_ISLAND.arrival, top + 0.03),
      // The magic gate on the observatory terrace, on the side facing the station.
      gateAt: Math.atan2(S.x - centre.x, S.z - centre.z)
    };
  };
  // The three docks round the station deck, or round the observatory deck when there is no station.
  const buildDocks = st => {
    const [at, flank, ground] = st
        ? [st.outward, STATION_ISLAND.flank, { centre: st.centre, deck: st.top, rail: STATION_ISLAND.rail }]
        : [away, STATION.flank, { centre, deck, rail: SKY.rail }],
      radius = st ? STATION_ISLAND.deck : SKY.deck.radius,
      rimAt = st ? st.srim : rim,
      list = {
        launch: { at: at + STATION.launch, half: STATION.launchHalf },
        tour: { at: at - side * flank, half: STATION.tour.basket.half * STATION.tour.scale },
        spare: { at: at + side * flank, half: DEFAULT_BALLOON_BASKET.half * STATION.spare.scale }
      };
    for (const d of Object.values(list)) {
      d.distance = radius + STATION.gangway + d.half;
      d.floor = { ...rimAt(d.at, d.distance, ground.deck + 0.02) };
      d.out = { x: Math.sin(d.at), z: Math.cos(d.at) };
      Object.assign(d, ground, { radius });
    }
    return list;
  };
  const station = buildStation(),
    docks = buildDocks(station);
  const dockRim = (d, a, r, y) => ({ x: d.centre.x + Math.sin(a) * r, y, z: d.centre.z + Math.cos(a) * r });
  const gateAt = station?.gateAt;
  // Teleport arrival on the station deck, then to the gangway's deck end, then into the basket.
  const tourWay = (st, d) =>
    st && {
      out: d.out,
      at: d.at,
      ground: st.top,
      way: st.arrival,
      entry: dockRim(d, d.at, STATION_ISLAND.deck - 0.35, st.top + TERRACE.eye),
      floor: d.floor
    };
  const remoteTour = tourWay(station, docks.tour);
  // Observatory railing: open only at the shuttle pier (and at docks when the station has no site of its own).
  const deckGaps = st => (st ? [] : Object.values(docks).map(d => ({ at: d.at, half: STATION.gate })));
  const gaps = [{ at: liftAt, half: 0.2 }, ...deckGaps(station)];
  gaps.forEach(g => (g.at = ((g.at % TAU) + TAU) % TAU));
  gaps.sort((a, b) => a.at - b.at);
  // The station rail is a hair thinner than the observatory rail (0.055 vs 0.06), so the two stay apart in audits.
  const railRing = (radius, list, rimAt, rail, lampRadius, lampY, y) =>
    list.forEach((g, i) => {
      const next = list[(i + 1) % list.length],
        a0 = g.at + g.half,
        a1 = next.at - next.half + (i + 1 === list.length ? TAU : 0),
        n = Math.max(2, Math.ceil((a1 - a0) / 0.07)),
        posts = Math.max(1, Math.round((a1 - a0) / (Math.PI / 6)));
      line(
        Array.from({ length: n + 1 }, (_, j) => rimAt(a0 + ((a1 - a0) * j) / n, rail, y + 0.95)),
        'rail',
        radius
      );
      for (let j = 0; j <= posts; j++) {
        const a = a0 + ((a1 - a0) * j) / posts;
        batch('box', 'rail', rimAt(a, rail, y + 0.47), { x: 0.12, y: 0.95, z: 0.12 }, { y: a });
        if (j < posts && lampRadius)
          batch(
            'box',
            'lampBlue',
            rimAt(a + (a1 - a0) / posts / 2, lampRadius, lampY),
            { x: 0.34, y: 0.16, z: 0.3 },
            { y: a + (a1 - a0) / posts / 2 }
          );
      }
    });
  railRing(0.06, gaps, rim, SKY.rail, SKY.deck.radius - 0.1, deck - 0.32, deck);
  // The station's own railing, open at its three docks.
  const stationRail = st => {
    if (!st) return;
    const sgaps = Object.values(docks).map(d => ({
      at: ((d.at % TAU) + TAU) % TAU,
      half: STATION.gate * 1.4
    }));
    sgaps.sort((a, b) => a.at - b.at);
    railRing(0.055, sgaps, st.srim, STATION_ISLAND.rail, STATION_ISLAND.deck - 0.1, st.top - 0.22, st.top);
  };
  stationRail(station);
  // Each dock: a plank gangway out to the basket and a mooring mast beside it.
  for (const d of Object.values(docks)) {
    const length = STATION.gangway + 0.4,
      mid = d.radius - 0.2 + length / 2,
      mast = dockRim(d, d.at + 0.75 / d.rail, d.rail, d.deck + STATION.mast / 2);
    batch('box', 'path', dockRim(d, d.at, mid, d.deck - 0.08), { x: 1.1, y: 0.12, z: length }, { y: d.at });
    batch('box', 'rail', mast, { x: 0.16, y: STATION.mast, z: 0.16 }, { y: d.at });
    batch('box', 'lampBlue', { ...mast, y: d.deck + STATION.mast + 0.1 }, { x: 0.3, y: 0.2, z: 0.3 });
  }
  const tourBalloon = balloon(STATION.tour),
    spare = balloon(STATION.spare),
    tourDock = docks.tour;
  tourBalloon.setFloor(tourDock.floor.x, tourDock.floor.y, tourDock.floor.z, tourDock.at);
  spare.setFloor(docks.spare.floor.x, docks.spare.floor.y, docks.spare.floor.z, docks.spare.at);
  // The spare is moored: a rope from its mast top to the load ring.
  {
    const d = docks.spare,
      from = dockRim(d, d.at + 0.75 / d.rail, d.rail, d.deck + STATION.mast),
      to = dockRim(d, d.at + 0.4 / d.distance, d.distance - 0.6, d.floor.y + spare.ring);
    line(
      [from, { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 - 0.4, z: (from.z + to.z) / 2 }, to],
      'rail',
      0.03
    );
  }
  // The tour dock's arch: a beam from its mooring mast to a matching post, the plaque hanging from it.
  {
    const d = tourDock,
      { width, height, y, beam } = SIGNPOST.tour,
      a1 = d.at - 0.75 / d.rail,
      chord = d.rail * Math.cos(0.75 / d.rail),
      span = 1.5 + 0.2,
      face = d.centre;
    batch(
      'box',
      'rail',
      dockRim(d, a1, d.rail, d.deck + STATION.mast / 2),
      { x: 0.16, y: STATION.mast, z: 0.16 },
      {
        y: a1
      }
    );
    batch('box', 'bark', dockRim(d, d.at, chord, d.deck + beam), { x: span, y: 0.14, z: 0.14 }, { y: d.at });
    lantern(dockRim(d, a1, d.rail, d.deck + STATION.mast + 0.1));
    const plaque = dockRim(d, d.at, chord, d.deck + y),
      tx = Math.cos(d.at) * (width / 2 - 0.12),
      tz = -Math.sin(d.at) * (width / 2 - 0.12);
    cords(line, plaque, tx, tz, d.deck + beam - 0.06, d.deck + y + height / 2 - 0.02);
    sign(say(labels, 'skyTour'), plaque, face, 'skytour', { width, height, icon: 'tour', seed: 3 });
  }
  pickable.push({ object: tourBalloon.mesh, kind: 'skytour' });
  if (!station) pickable.push({ object: spare.mesh, kind: 'skytour' });
  // Magic gates: a rune circle on the observatory terrace facing the station and its twin on the station deck. A
  // visitor stepping into either crosses to the other in one step (garden.mjs: a short light-tunnel jump).
  let gateOpen = false;
  // Poses each gate ring at its open level; an open one swirls at full frame rate (returns whether any is open).
  const swirlGates = (gates, now) => {
    let open = false;
    for (const g of Object.values(gates)) {
      g.portal.set(g.open, now / 1000);
      open ||= g.open > 0.001;
    }
    return open;
  };
  const buildGates = () => {
    if (!station) return null;
    const circle = (p, y) => {
      const ring = mesh(new THREE.TorusGeometry(MAGIC_GATE.radius, 0.05, 8, 48), runeGlow);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(p.x, y, p.z);
      const inner = mesh(new THREE.TorusGeometry(MAGIC_GATE.radius * 0.62, 0.03, 6, 36), runeGlow);
      inner.rotation.x = Math.PI / 2;
      inner.position.set(p.x, y, p.z);
      const disc = mesh(new THREE.CircleGeometry(MAGIC_GATE.radius * 0.98, 40), runeFloor);
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(p.x, y - 0.01, p.z);
      for (const m of [ring, inner, disc]) m.userData.noOcclude = true;
      return [ring, inner, disc];
    };
    // Over each circle the gate itself rises only when a visitor crosses: a living energy ring the magic jump
    // opens and closes (closed at rest, so nothing stands in the view). `normal` is the way through it.
    const standing = (p, y, toward) => {
      const portal = createPocketPortal(THREE, { radius: MAGIC_GATE.radius, style: 'rune', make: mesh }),
        normal = new THREE.Vector3(toward.x - p.x, 0, toward.z - p.z).normalize(),
        at = new THREE.Vector3(p.x, y + MAGIC_GATE.stand, p.z);
      portal.mesh.position.copy(at);
      portal.mesh.lookAt(at.clone().add(normal));
      portal.mesh.userData.dynamic = true;
      resources.add(portal.mesh.material);
      portal.set(0, 0);
      return { portal, centre: at, normal, open: 0 };
    };
    const terracePoint = rim(gateAt, SKY.rail - MAGIC_GATE.inset, deck + 0.03),
      parts = [...circle(terracePoint, deck + 0.03), ...circle(station.ring, station.top + 0.03)],
      outward = rim(gateAt, SKY.rail + 4, deck),
      gates = {
        terrace: standing(terracePoint, deck, outward),
        station: standing(station.ring, station.top, station.centre)
      };
    pickable.push(...parts.map(object => ({ object, kind: 'skytour' })));
    // A plank beside the terrace circle, facing the deck. It stands a metre inside the rim walk and on the side of
    // the circle away from the garden view the terrace opens on: by the rail it stood right in front of the
    // arriving camera and in the way round the rim (owner, round 5: the balloon sign covered the panorama).
    const away = Math.abs(turnOf(gateAt + 0.4 - gardenAngle)) >= Math.abs(turnOf(gateAt - 0.4 - gardenAngle)),
      signAt = gateAt + (away ? 0.4 : -0.4),
      post = rim(signAt, SKY.rail - 1.4, deck + SIGNPOST.lift.post / 2);
    batch('box', 'bark', post, { x: 0.14, y: SIGNPOST.lift.post, z: 0.14 });
    lantern({ ...post, y: deck + SIGNPOST.lift.post + 0.14 });
    sign(
      say(labels, 'skyTour'),
      { ...rim(signAt, SKY.rail - 1.4, deck + SIGNPOST.lift.y) },
      centre,
      'skytour',
      { width: SIGNPOST.lift.width, height: SIGNPOST.lift.height, icon: 'tour' }
    );
    return {
      at: gateAt,
      terrace: { ...terracePoint, y: deck + TERRACE.eye },
      station: station.arrival,
      parts,
      gates,
      // Where the terrace walk stops: a few steps in front of the standing ring, looking through it.
      approach: { ...rim(gateAt, SKY.rail - MAGIC_GATE.inset - MAGIC_GATE.approach, deck + TERRACE.eye) },
      // The magic jump drives a gate open (1) and shut (0).
      drive(which, level) {
        const g = gates[which];
        if (g) g.open = level;
      }
    };
  };
  const magicGate = buildGates();
  const zipline = null;
  // The terrace camera walks a circle just inside the railing; it arrives facing the garden.
  const view = {
    island: { x: centre.x, z: centre.z },
    deck,
    eye: deck + TERRACE.eye,
    ring: SKY.rail - TERRACE.inset,
    rail: SKY.rail,
    gardenAngle,
    position: new THREE.Vector3(),
    center: new THREE.Vector3()
  };
  terracePose(view, terraceState(view), view.position, view.center);
  // Where a ride starts: beside the shuttle basket on the far side from the central tree, at eye height.
  const stage = {
    x: base.x + liftDir.x * (STATION.pad + 1.6),
    y: 2.6,
    z: base.z + liftDir.z * (STATION.pad + 1.6)
  };
  // ---------- tour ----------
  const ringMean = frames.length
      ? frames.reduce((m, f) => m + Math.hypot(f.x, f.z), 0) / frames.length
      : route.radius + 10,
    makeRoute = sign => {
      const plan = planSkyTour({
          centre,
          dock: tourDock.floor,
          out: tourDock.out,
          ring: ringMean,
          frames,
          sign
        }),
        curve = new THREE.CatmullRomCurve3(
          plan.points.map(p => new THREE.Vector3(p.x, p.y, p.z)),
          false,
          'centripetal'
        ),
        length = curve.getLength(),
        speed = clamp(length / TOUR.cruise, TOUR.speed, TOUR.fastest),
        spur = new THREE.Vector3(...['x', 'y', 'z'].map(k => plan.points.at(-3)[k])),
        at = new THREE.Vector3();
      let home = 1,
        distance = Infinity;
      for (let j = 600; j >= 300; j--) {
        const gap = curve.getPointAt(j / 600, at).distanceTo(spur);
        if (gap < distance) {
          distance = gap;
          home = j / 600;
        }
      }
      return { curve, length, speed, home, plan };
    },
    routes = [makeRoute(-side), makeRoute(side)];
  let activeRoute = routes[0];
  const tour = {
    // The terrace walk ends at the magic gate (station) or at the tour dock on the deck (no station).
    gate: remoteTour ? gateAt : tourDock.at,
    board: remoteTour ? remoteTour.entry : rim(tourDock.at, SKY.rail + 0.3, deck + TERRACE.eye),
    remote: !!remoteTour,
    stage: remoteTour ? remoteTour.way : null,
    way: remoteTour ? remoteTour.way : null,
    dock: tourDock.floor,
    state: tourState(activeRoute.home)
  };
  function selectTourRoute(index) {
    activeRoute = routes[index === 1 ? 1 : 0];
    const { plan, length, speed, home } = activeRoute;
    Object.assign(tour, {
      radius: plan.radius,
      floor: plan.floor,
      length,
      speed,
      duration: length / speed + speed / TOUR.accel,
      points: plan.points
    });
    tour.state.home = home;
  }
  selectTourRoute(0);
  // Burner flame over the visitor's head, on the tour balloon's burner: a blue root, a yellow-orange tongue fading
  // to red and a pale core, in one additive draw (sky-life.mjs's flame material sways it and runs a colour band up
  // it); front faces keep the round jet from doubling its brightness. A soft glow sprite beside it swells in a burst.
  const flame = new THREE.Mesh(flameGeometry(THREE), createFlameMaterial(THREE, FLAME_HEIGHT));
  resources.add(flame.geometry);
  resources.add(flame.material);
  // The fixed base sits inside the nozzle lip; flicker stretches only upward.
  flame.position.y = tourBalloon.burner;
  flame.visible = false;
  // Moves with the balloon: never baked into the static merge.
  flame.userData.dynamic = true;
  tourBalloon.mesh.add(flame);
  const glow = flameGlow(THREE);
  resources.add(glow.material.map);
  resources.add(glow.material);
  glow.position.y = tourBalloon.burner + 0.3;
  glow.visible = false;
  glow.userData.dynamic = true;
  // A halo only: clicks, focus and ground rays pass through it (a Sprite also needs a camera to be hit).
  glow.raycast = () => {};
  tourBalloon.mesh.add(glow);
  const P = new THREE.Vector3(),
    LB = new THREE.Vector3(),
    LF = new THREE.Vector3();
  let burn = 0;
  // Camera and balloon for the tour state: the visitor stands in the basket; the basket faces the garden
  // (its gangway side as it nears the dock), the visitor's own drag turns and tilts the view on top.
  function tourPose(position, look) {
    const st = tour.state;
    activeRoute.curve.getPointAt(st.u, P);
    const garden = Math.atan2(-P.x, -P.z),
      near = smooth((P.distanceTo(tourDock.floor) - 2) / TOUR.dockReach),
      yaw = tourDock.at + turnOf(garden - tourDock.at) * near,
      view = yaw + st.yaw,
      pitch = clamp(
        TOUR.pitch - TOUR.lookUp * (1 - smooth(st.time / TOUR.lookUpSeconds)) + st.pitch,
        TOUR.look.up,
        TOUR.look.down
      ),
      lean = TOUR.back + (tourBalloon.half - TOUR.front - TOUR.back) * smooth((pitch - 0.05) / 0.4),
      hx = Math.sin(view),
      hz = Math.cos(view);
    tourBalloon.setFloor(P.x, P.y, P.z, yaw);
    position.set(P.x + hx * lean, P.y + tourBalloon.rim + TOUR.eye, P.z + hz * lean);
    look.set(
      position.x + hx * Math.cos(pitch) * 40,
      position.y - Math.sin(pitch) * 40,
      position.z + hz * Math.cos(pitch) * 40
    );
    // Burner: roaring on the climb, then short bursts; the envelope glows warm from inside while it burns.
    const b = TOUR.burner,
      q = st.time % b.every,
      burst = st.phase === 'docked' ? 0 : smooth(q / 0.25) * smooth((b.burst - q) / 0.4);
    burn = st.phase === 'docked' ? 0 : Math.max(burst, 1 - smooth((st.time - b.climb) / 1.5));
    const flicker = 0.88 + 0.12 * Math.sin(st.time * 31) * Math.sin(st.time * 17.3);
    flame.visible = glow.visible = st.phase !== 'docked';
    flame.scale.set(1, (0.35 + 1.25 * burn) * flicker, 1);
    flame.material.userData.clock[0] = st.time;
    // A burst whitens and brightens the flame, and its glow swells and fades with it.
    flame.material.color.setScalar(0.85 + 0.25 * burn * flicker);
    glow.scale.setScalar(0.9 + 1.1 * burn);
    glow.material.opacity = (0.1 + 0.3 * burn) * flicker;
    return TOUR.fov;
  }
  // One frame of the tour: advance by dt seconds (scaled for audits) and pose; true once docked.
  function tourFrame(dt, position, look) {
    const docked = tourStep(tour.state, dt, activeRoute.length, tour.speed);
    tourPose(position, look);
    return docked;
  }
  // Shuttle ride at fraction t: in its basket going up, looking out to the horizon, turning to the deck at the top.
  function shuttlePose(t, position, look) {
    const k = clamp(Number.isFinite(t) ? t : 0, 0, 1);
    // Held at the pier until the visitor has stepped off (releaseShuttle).
    shuttleState.driven = true;
    const y = poseShuttle(k),
      ox = -Math.sin(toCentre),
      oz = -Math.cos(toCentre),
      turn = smooth((k - 0.7) / 0.3),
      at = shuttle.mesh.position;
    position.set(at.x + ox * STATION.lean, y + shuttle.rim + STATION.eye, at.z + oz * STATION.lean);
    LB.set(position.x + ox * 60, position.y - 60 * Math.tan(STATION.pitch), position.z + oz * 60);
    LF.set(centre.x, deck + 1, centre.z);
    look.copy(LB).lerp(LF, turn);
    return position;
  }
  const balloons = [shuttle, tourBalloon, spare];
  return {
    land,
    liftRock,
    lift: { base, top, stage, at: liftAt, pier: rim(liftAt, SKY.rail - 0.3, deck + TERRACE.eye) },
    shuttle: { balloon: shuttle, state: shuttleState },
    docks,
    // sky-life.mjs: the drifting balloon that starts from and returns to the launch mast.
    launch: { ...docks.launch.floor, out: docks.launch.out, yaw: docks.launch.at },
    tour,
    tourBalloon,
    zipline,
    station,
    magicGate,
    view,
    label,
    tourPose,
    tourFrame,
    // Portrait phones keep a narrower lens: the wide one would fill them with basket.
    tourLens: (aspect = 1.6) => (aspect < 1 ? TOUR.phoneFov : TOUR.fov),
    shuttlePose,
    // Untie from the mast: the visitor is aboard and the balloon starts to climb.
    startTour(route = 0) {
      selectTourRoute(route);
      Object.assign(tour.state, tourState(tour.state.home), { phase: 'out' });
    },
    turnBack() {
      return tourTurnBack(tour.state);
    },
    // A drag inside the basket (fractions of the screen): grab-the-world, like the terrace.
    tourLook(dx, dy) {
      const st = tour.state;
      if (Number.isFinite(dx)) st.yaw = turnOf(st.yaw + dx * TOUR.look.yaw);
      if (Number.isFinite(dy)) st.pitch = clamp(st.pitch - dy * TOUR.look.pitch, -2, 2);
    },
    // Straight back on its mast (skip).
    dockTour() {
      Object.assign(tour.state, tourState(tour.state.home), { u: tour.state.end === 0 ? 0 : 1 });
      flame.visible = glow.visible = false;
      burn = 0;
      tourBalloon.setFloor(tourDock.floor.x, tourDock.floor.y, tourDock.floor.z, tourDock.at);
    },
    releaseShuttle(instant = false) {
      shuttleState.driven = false;
      if (instant) poseShuttle(0);
    },
    // The empty shuttle sinking back, or the banner still fading.
    get moving() {
      return (
        (!shuttleState.driven && shuttleState.at > 0) ||
        Math.abs(labelFade.value - labelFade.target) > 1e-3 ||
        gateOpen
      );
    },
    update(now, eye, night = 0) {
      const dt = shuttleState.last ? clamp((now - shuttleState.last) / 1000, 0, 0.25) : 0;
      shuttleState.last = now;
      gateOpen = magicGate ? swirlGates(magicGate.gates, now) : false;
      // The empty shuttle sinks back to its pad.
      if (!shuttleState.driven && shuttleState.at > 0)
        poseShuttle(shuttleState.at - dt / STATION.shuttleDown);
      const glow = clamp(+night || 0, 0, 1) * 0.38;
      for (const b of balloons) b.material.emissiveIntensity = glow;
      // A softer glow than the flame itself, so the flame stands out against the lit envelope.
      tourBalloon.material.emissiveIntensity = glow + 0.3 * burn;
      // The banner is for finding the station from below: it fades out on the terrace (it hangs right under the
      // view down) and stays hidden on every balloon ride, where it would hang in front of the basket.
      if (eye) {
        // A sprite tilts and can sweep its wide edge into the island. Keep the cloth vertical and
        // limit its garden-facing yaw: out - halfWidth * sin(maxYaw) stays beyond the rock radius.
        const home = Math.atan2(-dir.x, -dir.z),
          facing = Math.atan2(eye.x - label.position.x, eye.z - label.position.z);
        label.rotation.y = home + clamp(turnOf(facing - home), -SKY.label.maxYaw, SKY.label.maxYaw);
        if (bannerMount) bannerMount.rotation.y = label.rotation.y;
        const riding = tour.state.phase !== 'docked' || shuttleState.driven,
          away = Math.hypot(eye.x - centre.x, eye.z - centre.z);
        const fromBelow =
          eye.y < deck - 2 ? 1 : smooth((away - SKY.deck.radius - BANNER_FADE.near) / BANNER_FADE.span);
        labelFade.target = riding ? 0 : fromBelow;
        const step = dt > 0 ? dt / BANNER_FADE.seconds : 1;
        labelFade.value += clamp(labelFade.target - labelFade.value, -step, step);
        label.material.opacity = labelFade.value;
        label.visible = labelFade.value > 0.02;
        if (bannerMount) bannerMount.visible = label.visible;
      }
      // Lantern-lit at night rather than glowing: dim the painted wood and the banner a little.
      const shade = 1 - SIGNPOST.night * clamp(+night || 0, 0, 1);
      if (Math.abs(shade - signShade) > 1e-3) {
        signShade = shade;
        for (const m of signMaterials) m.color.setScalar(shade);
        label.material.color.setScalar(shade);
      }
    }
  };
}
