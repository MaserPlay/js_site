// Overview orbit: the camera circles a pivot over the garden - a full turn, from almost straight down to a
// little past level just above the cloud sea - eases toward where the input put it and coasts after a flick.
// Zoom dollies toward the point under the cursor or pinch, so a visitor on a bridge can be brought close;
// zooming back out walks the pivot home. Islands are a soft height field the eye glides over (it never dips
// into the lawn or under a rock), and the eye slides round anything else solid (M18: the arm used to snap in
// and out in whole steps, the "jumps" near trees and pavilions). A double-click makes the thing under it the
// pivot so it can be looked at from every side.
import { SEA } from './cloud-sea.mjs';

export const ORBIT = {
  // Radians per dragged pixel.
  turn: 0.0055,
  tilt: 0.0042,
  // Polar angle of the arm: almost straight down ... about 5 degrees past level, so the eye can look up.
  phi: [0.1, 1.66],
  // garden.mjs zoom units (wheel deltaY x 0.00045, keys +-0.08) to log distance.
  zoomRate: 2.8,
  // Closest approach to the pivot in metres (close enough to look a tree over), and the farthest as a
  // multiple of the default distance.
  near: 3.5,
  far: 1.4,
  // Below this zoom the pivot may wander the whole garden; from here to the default it is drawn home.
  free: 0.55,
  // Easing toward the goal and the decay of a flick's spin (1/s), and the fastest spin (rad/s).
  follow: 12,
  friction: 3.2,
  maxSpin: 5,
  // Lowest eye height (above the wavy cloud tops), eye height over a lawn, clearance from solid things.
  floor: SEA.top + 2.6,
  ground: 1.6,
  // Footprint radii (1 = nominal island radius) where the lawn floor starts to fall away and has gone: the
  // rims wobble about 20% past the nominal radius.
  rim: [1.25, 1.85],
  margin: 0.9,
  // Polar range over which the desktop's upward lift fades in (it would tip a top-down view sideways).
  lift: [0.6, 1.0],
  // A flick only coasts when the finger was still moving this recently (ms).
  coast: 90,
  // The arm's clearance search: coarse samples along it, then bisection steps to the exact boundary, and how
  // far past the zoom it may reach to get out of something the pivot sits inside (a tree being inspected).
  armSamples: 14,
  armRefine: 6,
  armReach: 2.5,
  // The sliding eye: its shortest step near something (under the margin, so it never tunnels through a
  // thin rail), the most steps a frame and the push-out passes per step.
  slideStep: 0.35,
  slideSteps: 48,
  slidePush: 3,
  // How fast (1/s) the eye makes up ground it lost waiting at a surface: the lag closes over a few frames
  // instead of in one when the way opens (free space has no lag, the eye is exactly where the orbit wants).
  catchUp: 5,
  // Focus on a thing: the distance kept from its middle, and the polar band the view settles into (a tree is
  // looked at from the side, not from straight above).
  inspect: { near: 4.5, far: 10, phi: [0.8, 1.42], glide: 1.1 },
  // Vertical room of the pivot at full pan room (metres above / below the garden level): the station is high.
  rise: [-4, 30]
};
// Settings → Управление: «инвертированное» is the original grab-the-world drag and stays the default;
// «обычное» turns the camera the way the pointer moves.
export const CAMERA_DIRECTIONS = ['normal', 'inverted'];
export const resolveCameraDirection = value => (value === 'normal' ? 'normal' : 'inverted');
export const dragSign = direction => (direction === 'normal' ? -1 : 1);

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const zero = () => ({ yaw: 0, pitch: 0, zoom: 1, pan: { x: 0, y: 0, z: 0 } });

export function createOrbit() {
  return {
    ...zero(),
    goal: zero(),
    spin: { yaw: 0, pitch: 0, at: 0 },
    // Pitch offsets allowed for the current home pose; zoom range likewise.
    range: { pitch: [-1, 1], zoom: [0.1, ORBIT.far] },
    holding: false,
    active: false,
    // A focus on a thing in progress (orbitFocus).
    glide: null,
    // Where the sliding eye is (orbitPose); not ready until a pose has placed it.
    rig: { eye: { x: 0, y: 0, z: 0 }, goal: { x: 0, y: 0, z: 0 }, ready: false, moving: false }
  };
}
// Back to the default pose, eased (or at once).
export function resetOrbit(o, instant = false) {
  Object.assign(o.goal, zero());
  o.goal.pan = { x: 0, y: 0, z: 0 };
  o.spin.yaw = o.spin.pitch = 0;
  o.glide = null;
  if (instant) {
    settle(o);
    if (o.rig) o.rig.ready = false;
  }
}
function settle(o) {
  o.yaw = o.goal.yaw;
  o.pitch = o.goal.pitch;
  o.zoom = o.goal.zoom;
  o.pan.x = o.goal.pan.x;
  o.pan.y = o.goal.pan.y;
  o.pan.z = o.goal.pan.z;
}
// Limits that depend on the home pose (its polar angle and distance).
export function orbitRange(o, home) {
  o.range.pitch[0] = ORBIT.phi[0] - home.phi;
  o.range.pitch[1] = ORBIT.phi[1] - home.phi;
  o.range.zoom[0] = Math.min(1, ORBIT.near / Math.max(1e-6, home.dist));
  o.range.zoom[1] = ORBIT.far;
  o.goal.pitch = clamp(o.goal.pitch, ...o.range.pitch);
  o.goal.zoom = clamp(o.goal.zoom, ...o.range.zoom);
}
// A drag by (dx, dy) pixels at time `at` (ms): the world turns under the pointer.
export function orbitTurn(o, dx, dy, at = 0) {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
  if (dy) o.glide = null;
  const yaw = -dx * ORBIT.turn,
    pitch = dy * ORBIT.tilt;
  o.goal.yaw += yaw;
  o.goal.pitch = clamp(o.goal.pitch + pitch, ...o.range.pitch);
  // Spin estimate for the flick: the latest move's rate, smoothed over a few events.
  const gap = clamp(at - o.spin.at, 8, 60) / 1000;
  if (at && o.spin.at && at - o.spin.at < 120) {
    o.spin.yaw = o.spin.yaw * 0.4 + (yaw / gap) * 0.6;
    o.spin.pitch = o.spin.pitch * 0.4 + (pitch / gap) * 0.6;
  } else {
    o.spin.yaw = yaw / gap;
    o.spin.pitch = pitch / gap;
  }
  o.spin.at = at;
}
// Grabbing the scene stops a coasting spin; letting go after a quick move starts one.
export function orbitHold(o, holding, at = 0) {
  o.holding = holding;
  if (holding || !at || at - o.spin.at > ORBIT.coast) o.spin.yaw = o.spin.pitch = 0;
  else {
    const speed = Math.hypot(o.spin.yaw, o.spin.pitch);
    if (speed > ORBIT.maxSpin) {
      o.spin.yaw *= ORBIT.maxSpin / speed;
      o.spin.pitch *= ORBIT.maxSpin / speed;
    }
  }
}
// How far the pivot may stray from home at a zoom: the whole garden when close, nothing at the default.
export const panRoom = (zoom, extent) => extent * clamp((1 - zoom) / (1 - ORBIT.free), 0, 1);
// Zoom by `factor` (< 1 closer) toward `focus` (a world point or null for the pivot itself).
export function orbitZoom(o, factor, focus, home) {
  if (!(factor > 0) || !Number.isFinite(factor)) return;
  o.glide = null;
  const g = o.goal,
    zoom = clamp(g.zoom * factor, ...o.range.zoom),
    f = zoom / g.zoom;
  if (focus && f < 1) {
    // Scale the pivot about the focus: the point under the cursor stays under it.
    for (const k of ['x', 'y', 'z']) {
      const pivot = home.aim[k] + g.pan[k];
      g.pan[k] = focus[k] + (pivot - focus[k]) * f - home.aim[k];
    }
  }
  g.zoom = zoom;
  clampPan(g, home);
}
// The pivot stays within the room the zoom allows; its height shrinks home with the same share, so zooming
// out walks it back evenly instead of dropping it at the last step.
function clampPan(g, home) {
  const extent = Math.max(1e-6, home.extent),
    room = panRoom(g.zoom, extent),
    h = Math.hypot(g.pan.x, g.pan.z);
  if (h > room) {
    g.pan.x *= room / h;
    g.pan.z *= room / h;
  }
  const share = room / extent;
  g.pan.y = clamp(g.pan.y, ORBIT.rise[0] * share, ORBIT.rise[1] * share);
}
// Make a world point the pivot, seen from `distance` metres: the view eases there along its own arm, keeps
// its direction round the garden and settles into a side-on band.
export function orbitFocus(o, point, distance, home) {
  if (!point || ![point.x, point.y, point.z, distance].every(Number.isFinite)) return false;
  const g = o.goal;
  const to = {
    zoom: clamp(distance / Math.max(1e-6, home.dist), ...o.range.zoom),
    pan: { x: 0, y: 0, z: 0 }
  };
  to.pan.x = point.x - home.aim.x;
  to.pan.y = point.y - home.aim.y;
  to.pan.z = point.z - home.aim.z;
  clampPan(to, home);
  const band = ORBIT.inspect.phi;
  to.pitch = clamp(clamp(home.phi + g.pitch, band[0], band[1]) - home.phi, ...o.range.pitch);
  o.spin.yaw = o.spin.pitch = 0;
  // A glide from rest to rest (smootherstep), not the follow easing's lurch at its start.
  o.glide = { t: 0, from: { zoom: g.zoom, pitch: g.pitch, pan: { ...g.pan } }, to };
  return to;
}
// The focus glide moves the goal itself; any turn or zoom by the visitor takes over from where it is.
function stepGlide(o, dt, instant) {
  const glide = o.glide,
    g = o.goal;
  glide.t = instant ? 1 : Math.min(1, glide.t + dt / ORBIT.inspect.glide);
  const x = glide.t,
    e = x * x * x * (x * (x * 6 - 15) + 10),
    { from, to } = glide;
  g.zoom = from.zoom * (to.zoom / from.zoom) ** e;
  g.pitch = from.pitch + (to.pitch - from.pitch) * e;
  for (const k of ['x', 'y', 'z']) g.pan[k] = from.pan[k] + (to.pan[k] - from.pan[k]) * e;
  if (x >= 1) o.glide = null;
}
// One frame: coast, then ease toward the goal. Returns whether anything still moves.
export function orbitStep(o, dt, instant = false) {
  const g = o.goal;
  if (!Number.isFinite(dt) || dt < 0) dt = 0;
  if (o.glide) stepGlide(o, dt, instant);
  if (instant) o.spin.yaw = o.spin.pitch = 0;
  else if (!o.holding && (o.spin.yaw || o.spin.pitch)) {
    g.yaw += o.spin.yaw * dt;
    const pitch = clamp(g.pitch + o.spin.pitch * dt, ...o.range.pitch);
    if (pitch !== g.pitch + o.spin.pitch * dt) o.spin.pitch = 0;
    g.pitch = pitch;
    const decay = Math.exp(-dt * ORBIT.friction);
    o.spin.yaw *= decay;
    o.spin.pitch *= decay;
    if (Math.hypot(o.spin.yaw, o.spin.pitch) < 0.02) o.spin.yaw = o.spin.pitch = 0;
  }
  const k = instant ? 1 : 1 - Math.exp(-dt * ORBIT.follow);
  o.yaw += (g.yaw - o.yaw) * k;
  o.pitch += (g.pitch - o.pitch) * k;
  // Zoom eases in log space, so a dolly feels even at every distance.
  o.zoom *= (g.zoom / o.zoom) ** k;
  for (const key of ['x', 'y', 'z']) o.pan[key] += (g.pan[key] - o.pan[key]) * k;
  const gap =
    Math.abs(g.yaw - o.yaw) +
    Math.abs(g.pitch - o.pitch) +
    Math.abs(Math.log(g.zoom / o.zoom)) +
    Math.abs(g.pan.x - o.pan.x) +
    Math.abs(g.pan.y - o.pan.y) +
    Math.abs(g.pan.z - o.pan.z);
  if (gap < 1e-4) settle(o);
  o.active = gap >= 1e-4 || !!(o.spin.yaw || o.spin.pitch || o.glide);
  return o.active;
}
// Island footprint distance in radii (1 at the rim), in the island's stretched, rotated frame.
function footprint(land, x, z) {
  const dx = x - land.x,
    dz = z - land.z,
    c = Math.cos(land.rotation || 0),
    s = Math.sin(land.rotation || 0),
    lx = c * dx - s * dz,
    lz = s * dx + c * dz,
    stretch = land.stretch || 1;
  return Math.hypot(lx / stretch, lz * stretch) / land.radius;
}
// Lowest eye height at (x, z): the cloud floor, rising smoothly over each island to its lawn plus eye height.
export function floorHeight(x, z, lands) {
  let h = ORBIT.floor;
  for (const land of lands) {
    const w = 1 - smooth(ORBIT.rim[0], ORBIT.rim[1], footprint(land, x, z));
    if (w > 0) h = Math.max(h, ORBIT.floor + (land.y + ORBIT.ground - ORBIT.floor) * w);
  }
  return h;
}
// Where a view ray meets the garden: the nearest island lawn, else the garden's level plane in front.
export function rayFocus(origin, direction, lands, level, reach) {
  let best = null,
    nearest = Infinity;
  const hit = (y, land) => {
    if (direction.y > -1e-4 || origin.y <= y) return;
    const t = (y - origin.y) / direction.y;
    if (!(t > 0) || t >= nearest || t > reach) return;
    const x = origin.x + direction.x * t,
      z = origin.z + direction.z * t;
    if (land && footprint(land, x, z) > 1.05) return;
    nearest = t;
    best = { x, y, z };
  };
  for (const land of lands) hit(land.y, land);
  if (!best) hit(level, null);
  return best;
}
// Where along a view ray the first solid thing is, and the middle of its solid run (capped), for a focus.
// `clearance(point)` is metres to the nearest solid thing; the march stops at `reach`.
export function traceSurface(origin, direction, clearance, reach, hit = { x: 0, y: 0, z: 0 }) {
  const at = t => {
    hit.x = origin.x + direction.x * t;
    hit.y = origin.y + direction.y * t;
    hit.z = origin.z + direction.z * t;
    return clearance(hit);
  };
  let t = 0.5,
    entry = -1;
  for (let i = 0; i < 160 && t < reach; i++) {
    const c = at(t);
    if (c < 0.05) {
      entry = t;
      break;
    }
    t += Math.max(c * 0.9, 0.05);
  }
  if (entry < 0) return null;
  // Through the thing in quarter metres; the middle of the run is near its heart (a crown, a hall).
  let exit = entry;
  while (exit - entry < 8 && at(exit + 0.25) < 0.05) exit += 0.25;
  const middle = entry + Math.min(3, (exit - entry) / 2);
  at(middle);
  return { x: hit.x, y: hit.y, z: hit.z, entry, depth: exit - entry };
}
// The arm length (metres) whose eye, riding the floor, is clear: the longest clear one up to `dist`, found
// to a fine boundary so it slides along an obstacle instead of stepping. When the pivot itself is inside
// something (an inspected tree), the shortest clear one beyond `dist` instead. armPoint is scratch.
function armReach(px, py, pz, ux, uy, uz, dist, lands, clear, armPoint) {
  const ok = d => {
    armPoint.x = px + ux * d;
    armPoint.y = py + uy * d;
    armPoint.z = pz + uz * d;
    armPoint.y = Math.max(armPoint.y, floorHeight(armPoint.x, armPoint.z, lands));
    return clear(armPoint) >= ORBIT.margin;
  };
  if (ok(dist)) return dist;
  const refine = (inside, outside) => {
    for (let i = 0; i < ORBIT.armRefine; i++) {
      const mid = (inside + outside) / 2;
      if (ok(mid)) inside = mid;
      else outside = mid;
    }
    return inside;
  };
  const scan = step => {
    for (let k = 1; k <= ORBIT.armSamples; k++) {
      const d = dist + k * step;
      if (d > 0 && ok(d)) return refine(d, d - step);
    }
    return -1;
  };
  armPoint.x = px;
  armPoint.y = py;
  armPoint.z = pz;
  const buried = clear(armPoint) < ORBIT.margin,
    inward = -dist / ORBIT.armSamples,
    outward = (dist * (ORBIT.armReach - 1)) / ORBIT.armSamples;
  let d = scan(buried ? outward : inward);
  if (d < 0) d = scan(buried ? inward : outward);
  return d < 0 ? dist : d;
}
// The eye as a small body that slides round solid things (M18). Each frame it moves toward where the orbit
// wants it in steps no longer than the free space around it allows, and any step that brushes something is
// pushed back out along the clearance gradient, so it glides along a crown or a hall wall and round its
// corners instead of the arm snapping in and out. Where the wanted spot is inside something it waits at the
// surface. Returns how far it moved.
const nudge = { x: 0, y: 0, z: 0 };
function resolve(eye, clear, lands) {
  for (let i = 0; i < ORBIT.slidePush; i++) {
    const c = clear(eye);
    if (c >= ORBIT.margin) break;
    const h = 0.05,
      at = (dx, dy, dz) => {
        nudge.x = eye.x + dx;
        nudge.y = eye.y + dy;
        nudge.z = eye.z + dz;
        return clear(nudge);
      };
    let gx = at(h, 0, 0) - at(-h, 0, 0),
      gy = at(0, h, 0) - at(0, -h, 0),
      gz = at(0, 0, h) - at(0, 0, -h);
    const g = Math.hypot(gx, gy, gz);
    // Deep inside (no gradient): straight up is always a way out.
    if (g < 1e-9) [gx, gy, gz] = [0, 1, 0];
    else [gx, gy, gz] = [gx / g, gy / g, gz / g];
    const push = Math.min(ORBIT.slideStep, ORBIT.margin - c + 1e-3);
    eye.x += gx * push;
    eye.y += gy * push;
    eye.z += gz * push;
  }
  eye.y = Math.max(eye.y, floorHeight(eye.x, eye.z, lands));
}
function slide(eye, tx, ty, tz, clear, lands) {
  const sx = eye.x,
    sy = eye.y,
    sz = eye.z;
  let left = Math.hypot(tx - eye.x, ty - eye.y, tz - eye.z);
  for (let i = 0; i < ORBIT.slideSteps && left > 1e-6; i++) {
    // Free space ahead allows a long step; near something, steps short enough never to tunnel through it.
    const room = clear(eye) - ORBIT.margin * 0.5,
      step = Math.min(left, Math.max(ORBIT.slideStep, room)) / left;
    eye.x += (tx - eye.x) * step;
    eye.y += (ty - eye.y) * step;
    eye.z += (tz - eye.z) * step;
    resolve(eye, clear, lands);
    const now = Math.hypot(tx - eye.x, ty - eye.y, tz - eye.z);
    // Pressed against something with the goal behind it: wait there.
    if (now > left - 1e-4) break;
    left = now;
  }
  return Math.hypot(eye.x - sx, eye.y - sy, eye.z - sz);
}
// The camera for an orbit state. home: { aim, theta, phi, dist, lift }. `clearance(point)` (metres) or
// `blocked(point)` reports solid things; `lands` are the island footprints. With `dt` (s) and a clearance
// the eye slides from where it was (s.rig) to the wanted spot; without dt it lands there at once, the arm
// shortened toward the pivot until clear (a flight's end pose, a resize); with dt 0 it holds.
// Writes position and look (objects with x, y, z) and returns position.
export function orbitPose(
  home,
  s,
  position,
  look,
  { lands = [], blocked = null, clearance = null, dt } = {}
) {
  const phi = clamp(home.phi + s.pitch, ORBIT.phi[0], ORBIT.phi[1]),
    theta = home.theta + s.yaw,
    dist = home.dist * s.zoom,
    px = home.aim.x + s.pan.x,
    py = home.aim.y + s.pan.y,
    pz = home.aim.z + s.pan.z,
    ux = Math.sin(phi) * Math.sin(theta),
    uy = Math.cos(phi),
    uz = Math.sin(phi) * Math.cos(theta);
  const clear = clearance || (blocked ? p => (blocked(p) ? 0 : Infinity) : null),
    rig =
      s.rig ||
      (s.rig = { eye: { x: 0, y: 0, z: 0 }, goal: { x: 0, y: 0, z: 0 }, ready: false, moving: false }),
    eye = rig.eye,
    // The wanted eye, before the floor raises it.
    wy = py + uy * dist;
  const goal = rig.goal,
    tx = px + ux * dist,
    tz = pz + uz * dist,
    ty = Math.max(wy, floorHeight(tx, tz, lands));
  if (clearance && Number.isFinite(dt) && rig.ready) {
    if (dt > 0) {
      // The wanted spot's own motion carries over in full; ground lost earlier is made up gradually.
      const keep = Math.exp(-dt * ORBIT.catchUp),
        gx = tx - (goal.x - eye.x) * keep,
        gy = ty - (goal.y - eye.y) * keep,
        gz = tz - (goal.z - eye.z) * keep;
      const moved = slide(eye, gx, gy, gz, clear, lands);
      rig.moving = moved > 1e-4 || (Math.hypot(tx - eye.x, ty - eye.y, tz - eye.z) > 0.05 && moved > 1e-5);
    } else rig.moving = false;
  } else {
    const d = clear && dist > 0 ? armReach(px, py, pz, ux, uy, uz, dist, lands, clear, position) : dist;
    eye.x = px + ux * d;
    eye.y = py + uy * d;
    eye.z = pz + uz * d;
    eye.y = Math.max(eye.y, floorHeight(eye.x, eye.z, lands));
    rig.ready = !!clearance;
    rig.moving = false;
  }
  goal.x = tx;
  goal.y = ty;
  goal.z = tz;
  position.x = eye.x;
  position.y = eye.y;
  position.z = eye.z;
  // However the eye was moved off its arm (raised over the floor, slid round a crown or a rail, drawn in),
  // the view keeps the orbit's own direction: the camera only shifts, it never swings. Over the cloud tops it
  // looks up past level.
  look.x = px + eye.x - tx;
  look.y = py + eye.y - wy;
  look.z = pz + eye.z - tz;
  // Desktop frames are wide and short: the view lifts a little so the balloon station fits above the far
  // pavilion. It fades out toward a top-down view.
  const amount = (home.lift || 0) * smooth(ORBIT.lift[0], ORBIT.lift[1], phi);
  if (amount) {
    const level = Math.hypot(look.x - position.x, look.z - position.z),
      pitch = Math.atan2(position.y - look.y, level) - amount;
    look.y = position.y - Math.tan(pitch) * level;
  }
  return position;
}
