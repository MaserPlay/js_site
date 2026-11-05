import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HALL } from './pavilion-hall.mjs';
import { STAIR_RISE, stairFlights, treadAt } from './stairs.mjs';
import {
  SHOE_SOURCE,
  bindScalpToHair,
  fitArmsInSleeves,
  paintEyes,
  shapeShoes,
  slimTrousers,
  smoothShirt,
  tuckTrousers
} from './visitor-shape.mjs';
import { mulberry32 } from './seeded-random.mjs';
import { gardenFile } from './garden-paths.mjs';

// Local CC0 visitors on the bridge ring. One GLB, cloned per visitor, sharing the garden render loop.
// The crowd logic below is plain arithmetic on the route (no three.js) and is unit tested in
// scripts/test-garden-visitors.mjs; createVisitor only turns its state into skinned meshes.

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = t => t * t * (3 - 2 * t);
const approach = (value, target, step) =>
  value < target ? Math.min(target, value + step) : Math.max(target, value - step);
export function angleDelta(from, to) {
  let d = (to - from) % TAU;
  if (d > Math.PI) d -= TAU;
  else if (d < -Math.PI) d += TAU;
  return d;
}

export const PERSONAL_SPACE = 1.2;
// Metres of walk over which the body rises (or drops) from one stair tread to the next.
export const STEP_BLEND = 0.15;
// Nobody's step ever takes them closer than this (centre to centre, metres) to anyone else: a last guard under
// the steering rules, which an arrival crossing the deck could still walk through (owner: people overlapped).
export const CONTACT = 0.75;
// Pavilion frame (world.mjs): group at route.radial(i,radius+3.85,0) turned by route.angle(i);
// local +x is the route tangent, +z the outward normal. The hero screen faces the bridge.
export const PAVILION = {
  offset: 3.85,
  screen: { y: 2.75, z: HALL.screenZ, halfWidth: 2.59, halfHeight: 1.51 },
  frontPosts: { x: 2.95, z: -1.6, radius: 0.4 }
};
export const DECK = { halfWidth: 2.4, rail: 2.2, walk: 1.85, eye: 0.1 };
// Front row on the bridge, before the pavilion's front posts and inside the screen's width.
// [along the tangent from the station (m), lateral offset from the bridge centre (m)]
// The glass hall front is 2.25 m out from the bridge centre: people stand 0.7–0.8 m in front of it.
const FRONT_ROW = [
  [-1.55, 1.45],
  [0.15, 1.55],
  [1.6, 1.48]
];
// An open arc has bridge deck on one side of each end station only; a full end station gets a glance from the lane.
const END_ROW = [
  [0.35, 2.12],
  [1.85, 1.9]
];

// 4–6 people in full quality, 1–2 in economy, nobody without a bridge.
export function visitorCount(route, economy = false) {
  if (!route || !(route.segments > 0)) return 0;
  if (economy) return route.closed && route.count >= 3 ? 2 : 1;
  if (!route.closed) return 4;
  return route.count >= 7 ? 6 : 5;
}

// The test outfit's clothing is flat vertex colour (linear): shirt, its darker collar trim and the trousers.
export const OUTFIT_SOURCE = {
  shirt: [0.141, 0.27, 0.328],
  collar: [0.063, 0.153, 0.198],
  trousers: [0.034, 0.048, 0.098]
};
export function clothingClass(r, g, b) {
  const near = c => Math.abs(r - c[0]) + Math.abs(g - c[1]) + Math.abs(b - c[2]) < 0.03;
  return near(OUTFIT_SOURCE.shirt)
    ? 1
    : near(OUTFIT_SOURCE.collar)
      ? 2
      : near(OUTFIT_SOURCE.trousers)
        ? 3
        : 0;
}
// sRGB; the first visitor keeps the asset's own teal shirt and navy trousers.
export const OUTFITS = [
  null,
  { shirt: '#b4573f', trousers: '#c4ad86' },
  { shirt: '#e4dfd2', trousers: '#3b3f46' },
  { shirt: '#d3a03d', trousers: '#2e3b52' },
  { shirt: '#6e4a7e', trousers: '#2a2a2e' },
  { shirt: '#7c8e4f', trousers: '#86684f' }
];
// Visitors 3 and 5 are children: smaller, with a relatively larger head (CHILD_HEAD).
export const SCALES = [1, 0.965, 1.04, 0.62, 1.025, 0.68];
export const CHILD_HEAD = 1.22;
// A camera or a phone is also carried while walking; the children carry nothing.
export const KITS = ['camera', 'notebook', 'phone', 'none', 'phone', 'none'];

// Dense, allocation-free samples of the route centre line and normal.
export function routeTable(route, perSegment = 64) {
  const closed = !!route.closed,
    span = closed ? route.count : route.segments,
    n = Math.max(2, Math.ceil(span * perSegment)),
    S = n / span;
  const cx = new Float64Array(n + 1),
    cy = new Float64Array(n + 1),
    cz = new Float64Array(n + 1),
    nx = new Float64Array(n + 1),
    nz = new Float64Array(n + 1),
    cum = new Float64Array(n + 1);
  for (let k = 0; k <= n; k++) {
    const p = k / S,
      q = route.point(p, 0, 0),
      v = route.normal(p);
    cx[k] = q.x;
    cy[k] = q.y;
    cz[k] = q.z;
    nx[k] = v.x;
    nz[k] = v.z;
    if (k) cum[k] = cum[k - 1] + Math.hypot(cx[k] - cx[k - 1], cy[k] - cy[k - 1], cz[k] - cz[k - 1]);
  }
  const length = cum[n];
  let K = 0,
    F = 0;
  const wrap = p => (closed ? ((p % span) + span) % span : clamp(p, 0, span));
  const locate = p => {
    const u = wrap(p) * S;
    K = Math.min(n - 1, Math.floor(u));
    F = u - K;
  };
  const along = p => {
    locate(p);
    return cum[K] + (cum[K + 1] - cum[K]) * F;
  };
  return {
    closed,
    span,
    samples: n,
    perUnit: S,
    length,
    wrap,
    along,
    sample(p, offset, eye, out) {
      locate(p);
      const k = K,
        f = F,
        ax = nx[k] + (nx[k + 1] - nx[k]) * f,
        az = nz[k] + (nz[k + 1] - nz[k]) * f,
        l = Math.hypot(ax, az) || 1;
      out.x = cx[k] + (cx[k + 1] - cx[k]) * f + (ax / l) * offset;
      out.y = cy[k] + (cy[k + 1] - cy[k]) * f + eye;
      out.z = cz[k] + (cz[k + 1] - cz[k]) * f + (az / l) * offset;
      return out;
    },
    normal(p, out) {
      locate(p);
      const k = K,
        f = F,
        ax = nx[k] + (nx[k + 1] - nx[k]) * f,
        az = nz[k] + (nz[k + 1] - nz[k]) * f,
        l = Math.hypot(ax, az) || 1;
      out.x = ax / l;
      out.z = az / l;
      return out;
    },
    metresPerUnit(p, offset) {
      locate(p);
      const k = K,
        dx = cx[k + 1] - cx[k] + (nx[k + 1] - nx[k]) * offset,
        dy = cy[k + 1] - cy[k],
        dz = cz[k + 1] - cz[k] + (nz[k + 1] - nz[k]) * offset;
      return Math.max(1e-3, Math.hypot(dx, dy, dz) * S);
    },
    // Progress at `metres` along the centre line (clamped to the route): the inverse of along().
    progressAt(metres) {
      const m = closed ? ((metres % length) + length) % length : clamp(metres, 0, length);
      let lo = 0,
        hi = n;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] <= m) lo = mid;
        else hi = mid;
      }
      return (lo + (m - cum[lo]) / Math.max(1e-9, cum[lo + 1] - cum[lo])) / S;
    },
    // Signed metres from one progress to another; a ring takes the short way round.
    delta(from, to) {
      let d = along(to) - along(from);
      if (closed) {
        if (d > length / 2) d -= length;
        else if (d < -length / 2) d += length;
      }
      return d;
    },
    nearest(x, z, out) {
      let best = Infinity,
        bk = 0;
      for (let k = 0; k <= n; k++) {
        const dx = x - cx[k],
          dz = z - cz[k],
          d = dx * dx + dz * dz;
        if (d < best) {
          best = d;
          bk = k;
        }
      }
      out.p = wrap(bk / S);
      out.lateral = (x - cx[bk]) * nx[bk] + (z - cz[bk]) * nz[bk];
      out.deck = cy[bk];
      return out;
    }
  };
}

// The reader-facing screen of one pavilion, as a plane: centre, right (tangent) and normal toward the bridge.
export function screenFrame(route, station) {
  const c = route.radial(station, route.radius + PAVILION.offset + PAVILION.screen.z, PAVILION.screen.y),
    t = route.tangent(station),
    n = route.normal(station);
  return {
    station,
    x: c.x,
    y: c.y,
    z: c.z,
    rx: t.x,
    rz: t.z,
    nx: -n.x,
    nz: -n.z,
    halfWidth: PAVILION.screen.halfWidth,
    halfHeight: PAVILION.screen.halfHeight
  };
}
// Where people stand to look at station i's screen: on the bridge in front of the pavilion, facing the screen centre.
export function viewingSpots(route, station) {
  if (!route || !(route.segments > 0) || station < 0 || station >= route.count) return [];
  const layout = route.closed
    ? FRONT_ROW
    : station === 0
      ? END_ROW
      : station === route.segments
        ? END_ROW.map(([x, o]) => [-x, o])
        : FRONT_ROW;
  const screen = screenFrame(route, station);
  return layout.map(([x, offset], slot) => {
    const p = station + x / route.metersPerStation(station, offset),
      q = route.point(p, offset, DECK.eye);
    return {
      station,
      slot,
      x,
      offset,
      p: route.closed ? ((p % route.count) + route.count) % route.count : p,
      position: q,
      yaw: Math.atan2(screen.x - q.x, screen.z - q.z),
      back: offset < 1.4
    };
  });
}
// Is a point between the camera and the screen, inside the pyramid the camera sees the screen through?
export function occludesScreen(camera, screen, px, py, pz, margin = 0.3) {
  const Dc = (camera.x - screen.x) * screen.nx + (camera.z - screen.z) * screen.nz;
  if (Dc <= 0.5) return false;
  const Dp = (px - screen.x) * screen.nx + (pz - screen.z) * screen.nz;
  if (Dp <= 0 || Dp >= Dc - 0.05) return false;
  const k = Dc / (Dc - Dp),
    qx = camera.x + (px - camera.x) * k,
    qy = camera.y + (py - camera.y) * k,
    qz = camera.z + (pz - camera.z) * k;
  const u = (qx - screen.x) * screen.rx + (qz - screen.z) * screen.rz,
    v = qy - screen.y,
    m = margin * k;
  return Math.abs(u) < screen.halfWidth + m && Math.abs(v) < screen.halfHeight + m;
}
// Follow-distance rule: full speed from 2.5 m, standing still at personal space.
export function followFactor(gap, lateral = 0, personal = PERSONAL_SPACE) {
  if (lateral > 0.85 || gap <= 0) return 1;
  return clamp((gap - personal) / 1.3, 0, 1);
}
// What a kit is used for at a stop: reading the notebook, the phone, a photo of the screen.
export const KIT_GESTURE = { notebook: 'notes', phone: 'phone', camera: 'photo' };
// The camera goes up to the eyes for a brief shot: `rate` cycles a second while standing, raised for `share`
// of each cycle, offset by `delay` cycles so the first shot comes a moment after stopping.
export const CAMERA_SHOT = { rate: 0.21, share: 0.36, delay: 0.55 };
export function pickGesture(kit, r) {
  if (kit !== 'none') return r < 0.7 ? KIT_GESTURE[kit] : r < 0.85 ? 'tilt' : 'none';
  return r < 0.45 ? 'tilt' : 'none';
}

// The whole crowd: walking, stopping at pavilions, keeping space, stepping out of the reader's way.
export function createCrowd(
  route,
  { capacity = visitorCount(route), seed = 20261024, lookChance = 0.06, viewChance = 0.85 } = {}
) {
  const table = route.segments > 0 ? routeTable(route) : null,
    // The staircases' treads: people stand on them, not on the smooth climb line beneath (owner: they sank
    // through the steps).
    flights = table && route.climbSpan ? stairFlights(route) : [],
    closed = !!route.closed,
    stations = route.segments > 0 ? route.count : 0,
    span = table ? table.span : 0;
  const spots = Array.from({ length: stations }, (_, i) =>
    viewingSpots(route, i).map(s => ({ ...s, owner: -1 }))
  );
  const screens = Array.from({ length: stations }, (_, i) => screenFrame(route, i));
  const visitors = [],
    A = { x: 0, y: 0, z: 0 },
    B = { x: 0, y: 0, z: 0 },
    N = { x: 0, z: 0 },
    C = { x: 0, y: 0, z: 0 },
    near = { p: 0, lateral: 0, deck: 0 };
  const cam = { x: 0, y: 0, z: 0, valid: false, active: false, p: 0, side: 0 };
  let active = capacity,
    focus = -1,
    mode = 'overview',
    placed = false;
  for (let k = 0; k < capacity; k++) {
    // Every third person walks a closed loop the other way round; on an open route every other one.
    const rng = mulberry32(seed + k * 7919),
      against = closed ? k % 3 === 2 : k % 2 === 1,
      dir = against ? -1 : 1;
    visitors.push({
      id: k,
      rng,
      dir,
      laneA: -1.05 + (rng() - 0.5) * 0.3,
      laneB: 0.55 + (rng() - 0.5) * 0.2,
      cruise: 0.76 + rng() * 0.16,
      scale: SCALES[k % SCALES.length],
      kit: KITS[k % KITS.length],
      p: 0,
      lane: 0,
      speed: 0,
      yaw: 0,
      targetYaw: 0,
      phase: 'walk',
      stop: null,
      timer: 0,
      dwell: 0,
      leaving: false,
      leaveOffset: 0,
      leaveDist: 0,
      stationToken: -1,
      segmentToken: -1,
      x: 0,
      y: 0,
      z: 0,
      travelled: 0,
      active: true,
      alpha: 1,
      stops: 0,
      aim: 0,
      wait: '',
      waitFor: -1,
      limLo: -DECK.walk,
      limHi: DECK.walk
    });
  }
  const laneFor = v => (v.dir > 0 ? v.laneA : v.laneB);
  const wrapStation = s => (closed ? ((s % stations) + stations) % stations : clamp(s, 0, stations - 1));
  function release(v) {
    if (v.stop?.spot && v.stop.spot.owner === v.id) v.stop.spot.owner = -1;
    v.stop = null;
  }
  function viewStop(v, spot, gesture) {
    spot.owner = v.id;
    return {
      kind: 'view',
      station: spot.station,
      spot,
      p: spot.p,
      offset: spot.offset,
      yaw: spot.yaw,
      duration: 4 + 5 * Math.sqrt(v.rng()),
      gesture
    };
  }
  function lookStop(v, p, offset) {
    table.normal(p, N);
    const s = offset < 0 ? -1 : 1;
    return {
      kind: 'look',
      station: -1,
      spot: null,
      p: table.wrap(p),
      offset,
      yaw: Math.atan2(N.x * s, N.z * s),
      duration: 2.8 + v.rng() * 2.7,
      gesture: 'gaze'
    };
  }
  function freeSpots(st, allowBack) {
    let n = 0;
    for (const s of spots[st]) if (s.owner < 0 && (allowBack || !s.back)) n++;
    return n;
  }
  // Is a stop at (p, offset) personal space away from every other visitor's stop, taken or planned? Viewing
  // spots are reserved; look-outs and glances are checked here so two people never stand on one point.
  function clearStop(v, p, offset) {
    for (let ui = 0; ui < visitors.length; ui++) {
      const u = visitors[ui];
      if (u === v || !u.active || !u.stop) continue;
      if (Math.hypot(table.delta(p, u.stop.p), offset - u.stop.offset) < PERSONAL_SPACE) return false;
    }
    return true;
  }
  function pickSpot(v, st, allowBack, minAhead = 1.4) {
    const list = spots[st];
    let count = 0;
    for (const s of list)
      if (s.owner < 0 && (allowBack || !s.back) && table.delta(v.p, s.p) * v.dir >= minAhead) count++;
    if (!count) return null;
    // Usually the first free place in the walking direction, so arrivals from both sides do not cross.
    let pick = v.rng() < 0.7 ? -1 : Math.floor(v.rng() * count),
      best = null,
      bestAhead = Infinity;
    for (const s of list) {
      if (s.owner >= 0 || (!allowBack && s.back)) continue;
      const ahead = table.delta(v.p, s.p) * v.dir;
      if (ahead < minAhead) continue;
      if (pick >= 0) {
        if (!pick--) return s;
      } else if (ahead + (s.back ? 3 : 0) < bestAhead) {
        bestAhead = ahead + (s.back ? 3 : 0);
        best = s;
      }
    }
    return best;
  }
  // Decide the next stop ahead: a pavilion's viewing spot, sometimes a look over a mid-span railing, or nothing.
  function plan(v) {
    if (!stations) return null;
    const segRaw = v.dir > 0 ? Math.floor(v.p) : Math.ceil(v.p) - 1,
      seg = closed ? ((segRaw % stations) + stations) % stations : clamp(segRaw, 0, route.segments - 1),
      segToken = seg * 2 + (v.dir > 0 ? 1 : 0);
    if (v.segmentToken !== segToken) {
      v.segmentToken = segToken;
      const target = seg + 0.4 + v.rng() * 0.28,
        ahead = table.delta(v.p, target) * v.dir;
      if (ahead > 2.5 && v.rng() < lookChance) {
        const offset = laneFor(v) < 0 ? -1.72 : 1.72;
        if (clearStop(v, target, offset)) return lookStop(v, target, offset);
      }
    }
    let s = v.dir > 0 ? Math.floor(v.p + 1e-4) + 1 : Math.ceil(v.p - 1e-4) - 1;
    if (!closed) s = clamp(s, 0, route.segments);
    const st = wrapStation(s);
    if (v.stationToken === st) return null;
    v.stationToken = st;
    const end = !closed && (st === 0 || st === route.segments);
    if (st !== focus && (end || v.rng() < viewChance)) {
      const spot = pickSpot(v, st, end);
      if (spot) return viewStop(v, spot, pickGesture(v.kit, v.rng()));
    }
    // An open arc's end: a short glance from the lane, then back the other way.
    if (end) {
      // 3 m before the end, behind anyone already glancing there, never on the same point and never behind
      // the walker; with no such point it walks on and turns at the end. Metres come from the table: the
      // route's own derivative is near zero at an end station and put the glance at the far end (a walker
      // just past it then stood still for minutes).
      const lane = laneFor(v),
        from = table.along(st);
      let p = -1;
      for (let n = 0, back = 3; n <= visitors.length && p < 0; n++, back += PERSONAL_SPACE + 0.2) {
        const q = table.progressAt(from - v.dir * back);
        if (table.delta(v.p, q) * v.dir < 1.5) break;
        if (clearStop(v, q, lane)) p = q;
      }
      if (p < 0) return null;
      const screen = screens[st];
      table.sample(p, laneFor(v), DECK.eye, A);
      return {
        kind: 'glance',
        station: st,
        spot: null,
        p,
        offset: laneFor(v),
        yaw: Math.atan2(screen.x - A.x, screen.z - A.z),
        duration: 1.4 + v.rng() * 1.2,
        gesture: 'none'
      };
    }
    return null;
  }
  function arrive(v) {
    v.p = table.wrap(v.stop.p);
    v.lane = v.stop.offset;
    v.phase = 'dwell';
    v.speed = 0;
    v.timer = v.stop.duration;
    v.dwell = 0;
    v.leaving = false;
    v.stops++;
  }
  function startLeave(v) {
    const stop = v.stop;
    if (!closed && stop && stop.station >= 0 && (stop.station === 0 || stop.station === route.segments))
      v.dir = stop.station === 0 ? 1 : -1;
    v.leaveOffset = v.lane;
    v.leaveDist = 0;
    v.leaving = true;
    v.phase = 'walk';
    release(v);
  }
  // Queue only behind someone going the same way (or standing) in the line v is actually taking.
  // Oncoming people never wait for each other: both sidestep in avoid(), so two can never deadlock.
  function follow(v, lc, ds, sc) {
    let f = 1;
    for (let ui = 0; ui < visitors.length; ui++) {
      const u = visitors[ui];
      if (u === v || !u.active) continue;
      const g = table.delta(v.p, u.p) * v.dir;
      if (g <= 0 || g > 3.6 || g > ds + 0.2) continue;
      if (u.dir !== v.dir && u.phase !== 'dwell') continue;
      const dl = Math.abs(u.lane - v.lane);
      if (dl > 0.85) continue;
      // Where v's path will be when level with u: clear of u means v is stepping out of u's line
      // (go on once 0.3 m clear, creep until then); otherwise queue at personal space.
      const path = v.lane + (lc - v.lane) * clamp(g / Math.max(sc, 0.05), 0, 1);
      let factor;
      if (Math.abs(path - u.lane) > 0.85) factor = dl > 0.3 ? 1 : Math.max(0.25, followFactor(g, dl));
      else factor = followFactor(g, dl);
      f = Math.min(f, factor);
    }
    return f;
  }
  // Pass standing, slower or oncoming people with a 1.3 m lateral gap; ignore anyone beyond v's own stop.
  function avoid(v, lane, ds) {
    let result = lane;
    // v's own span when it is arriving at a stop, as others see it.
    const self =
        v.phase !== 'dwell' && v.stop && v.stop.kind !== 'look' && Math.abs(table.delta(v.p, v.stop.p)) < 3.6,
      selfLo = self ? Math.min(v.lane, v.stop.offset) : 0,
      selfHi = self ? Math.max(v.lane, v.stop.offset) : 0;
    for (let ui = 0; ui < visitors.length; ui++) {
      const u = visitors[ui];
      if (u === v || !u.active) continue;
      const g = table.delta(v.p, u.p) * v.dir;
      if (g < -0.5 || g > 4.2 || g > ds - 0.3) continue;
      // Someone about to arrive at a spot occupies the whole sideways span from where they are to where they will stand.
      const arriving =
        u.phase !== 'dwell' && u.stop && u.stop.kind !== 'look' && Math.abs(table.delta(u.p, u.stop.p)) < 3.6;
      const lo = arriving ? Math.min(u.lane, u.stop.offset) : u.lane,
        hi = arriving ? Math.max(u.lane, u.stop.offset) : u.lane;
      // Test both where v aims and where its path will be when level with u.
      const path = v.lane + (result - v.lane) * clamp(g / 1.3, 0, 1);
      if ((result <= lo - 1.25 || result >= hi + 1.25) && (path <= lo - 1.25 || path >= hi + 1.25)) continue;
      const oncoming = u.dir !== v.dir && u.phase !== 'dwell',
        blocking = u.phase === 'dwell' || arriving || u.speed < 0.25 || (u.speed < v.speed - 0.12 && g < 2.6);
      if (!oncoming && !blocking) continue;
      let candidate;
      // An arriving v: u sees v's whole span (below) and passes below it when that fits; then v keeps its line.
      // Keeping the lanes' convention as well, both stepped the same way and walked into each other.
      if (oncoming && !arriving && self) {
        const below = selfLo - 1.3 >= u.limLo,
          above = selfHi + 1.3 <= u.limHi,
          up =
            u.lane >= selfHi ||
            (u.lane > selfLo && Math.abs(u.lane - selfHi - 1.3) < Math.abs(u.lane - selfLo + 1.3));
        if (up ? !above && below : below) continue;
      }
      // Oncoming walkers keep to their own side (the lanes' convention), so both never step the same way.
      if (oncoming && !arriving) candidate = clamp(u.lane + (v.dir > 0 ? -1 : 1) * 1.3, v.limLo, v.limHi);
      else {
        const below = lo - 1.3,
          above = hi + 1.3,
          fitsBelow = below >= v.limLo,
          fitsAbove = above <= v.limHi;
        if (!fitsBelow && !fitsAbove) continue;
        // Stay on the side v is already on until past; cross in front only when there is no room.
        const prefer =
          v.lane >= hi
            ? above
            : v.lane <= lo
              ? below
              : Math.abs(result - below) <= Math.abs(result - above)
                ? below
                : above;
        // The preferred side if there is room on it, else the other one.
        const other = prefer === above ? below : above,
          room = prefer === above ? fitsAbove : fitsBelow;
        candidate = room ? prefer : other;
      }
      result = candidate;
    }
    return result;
  }
  // Linger a moment while a neighbour is still stepping away, someone walks by, or someone is arriving here.
  // Waits form a strict order (longest-waiting neighbour first) and only the arrival wait can time out,
  // so two people never set off into each other and nobody waits forever.
  function canLeave(v) {
    if (v.stop?.kind === 'view' && v.stop.station === focus) return true;
    const end = !closed && v.stop && (v.stop.station === 0 || v.stop.station === route.segments);
    // At either end of an open route the way on is back along it.
    let dir = v.dir;
    if (end) dir = v.stop.station === 0 ? 1 : -1;
    const target = dir > 0 ? v.laneA : v.laneB;
    const lo = Math.min(v.lane, target) - 0.7,
      hi = Math.max(v.lane, target) + 0.7,
      patient = v.timer > -4;
    for (let ui = 0; ui < visitors.length; ui++) {
      const u = visitors[ui];
      if (u === v || !u.active) continue;
      // Look both ways: nobody walking toward this spot through the band about to be crossed.
      if (u.phase === 'walk' && u.speed > 0.1) {
        const toward = table.delta(u.p, v.p) * u.dir;
        if (toward > -0.5 && toward < 5 && u.lane > lo && u.lane < hi) {
          v.wait = 'passer';
          v.waitFor = u.id;
          return false;
        }
      }
      if (
        patient &&
        u.phase === 'walk' &&
        u.stop &&
        u.stop.kind === 'view' &&
        u.stop.station === v.stop?.station &&
        Math.abs(table.delta(u.p, u.stop.p)) < 6
      ) {
        v.wait = 'arrival';
        v.waitFor = u.id;
        return false;
      }
      const along = Math.abs(table.delta(v.p, u.p));
      if (along > 3.6) continue;
      if (u.leaving && u.leaveDist < 2.2) {
        v.wait = 'leaver';
        v.waitFor = u.id;
        return false;
      }
      if (
        u.phase === 'dwell' &&
        u.timer <= 0 &&
        (u.timer < v.timer || (u.timer === v.timer && u.id < v.id))
      ) {
        v.wait = 'turn';
        v.waitFor = u.id;
        return false;
      }
      if (
        patient &&
        u.phase === 'walk' &&
        u.stop &&
        u.stop.kind !== 'look' &&
        Math.abs(table.delta(u.p, u.stop.p)) < 3.6 &&
        Math.abs(u.lane - v.lane) < 1.6
      ) {
        v.wait = 'arrival';
        v.waitFor = u.id;
        return false;
      }
    }
    v.wait = '';
    v.waitFor = -1;
    return true;
  }
  function mergeBlocked(v) {
    const lane = laneFor(v);
    for (let ui = 0; ui < visitors.length; ui++) {
      const u = visitors[ui];
      if (u === v || !u.active || u.phase === 'dwell' || u.speed < 0.2) continue;
      const g = table.delta(v.p, u.p) * v.dir;
      if (u.dir === v.dir && g > -3.2 && g < 0.8 && Math.abs(u.lane - lane) < 0.9) return true;
    }
    return false;
  }
  // Would v, standing at lateral offset L, be in front of the focused screen as the camera sees it?
  function blocksAt(v, p, L, screen) {
    table.sample(p, L, DECK.eye, B);
    return (
      occludesScreen(cam, screen, B.x, B.y + 1.15 * v.scale, B.z, 0.3) ||
      occludesScreen(cam, screen, B.x, B.y + 1.8 * v.scale, B.z, 0.26)
    );
  }
  // Step aside from a low journey camera beside the bridge: walkers keep 4.5 m from it on its side and
  // stay below the line of sight to the focused screen on the other, so nobody walks through the near
  // field or vanishes in front of the screen. Measured per visitor, so tight corners (3 islands) work too.
  // The band [limLo, limHi] also bounds sidesteps in avoid().
  function aside(v, lane) {
    v.limLo = -DECK.walk;
    v.limHi = DECK.walk;
    if (!cam.active) return lane;
    table.sample(v.p, 0, 0, A);
    table.normal(v.p, N);
    const dx = cam.x - A.x,
      dz = cam.z - A.z,
      lateral = dx * N.x + dz * N.z,
      along = Math.sqrt(Math.max(0, dx * dx + dz * dz - lateral * lateral));
    if (Math.abs(lateral) < 1.6 || Math.abs(lateral) > 9 || along > 10) return lane;
    // At least 1.6 m of deck stays walkable: a camera inside the hall left oncoming walkers a 0.3 m band.
    let lo = lateral < 0 ? Math.min(lateral + 4.5, DECK.walk - 1.6) : -DECK.walk,
      hi = lateral < 0 ? DECK.walk : Math.max(lateral - 4.5, 1.6 - DECK.walk);
    // The blocked stretch across the deck is an interval: walk out from the camera's side to its first
    // blocked offset, refine, and keep below it.
    // Checked here and 2.5 m ahead, so a walker drops below the sight line before reaching it.
    if (focus >= 0) {
      const screen = screens[focus],
        s = lateral < 0 ? 1 : -1;
      for (let ahead = 0; ahead < 2; ahead++) {
        const p = ahead ? v.p + (v.dir * 2.5) / table.metresPerUnit(v.p, 0) : v.p;
        for (let L = -s * DECK.walk; L * s <= DECK.walk + 1e-6; L += s * 0.2) {
          if (!blocksAt(v, p, L, screen)) continue;
          let a = L - s * 0.2,
            b = L;
          for (let i = 0; i < 6; i++) {
            const m = (a + b) / 2;
            if (blocksAt(v, p, m, screen)) b = m;
            else a = m;
          }
          if (s > 0) hi = Math.min(hi, a - 0.08);
          else lo = Math.max(lo, a + 0.08);
          break;
        }
      }
    }
    if (lo > hi) {
      if (lateral < 0) lo = hi;
      else hi = lo;
    }
    const w = 1 - smooth(clamp((along - 3.5) / 6, 0, 1));
    v.limLo = -DECK.walk + (lo + DECK.walk) * w;
    v.limHi = DECK.walk + (hi - DECK.walk) * w;
    return clamp(lane, v.limLo, v.limHi);
  }
  function move(v, h) {
    const LOOK = 1.3;
    let sc = LOOK,
      lc = aside(v, laneFor(v)),
      ds = Infinity;
    // Leaving: first step back from the screen toward the walking line, then turn along the bridge.
    if (v.leaving) sc = clamp(0.45 + v.leaveDist * 0.6, 0.45, LOOK);
    if (v.stop) {
      ds = table.delta(v.p, v.stop.p) * v.dir;
      if (ds < -0.3) {
        release(v);
        ds = Infinity;
      }
    }
    if (v.stop) {
      // A step slid past the stop by the contact guard is walked back (it stood there for good before).
      if (ds < LOOK) sc = ds;
      const reach = Math.max(2.6, 1.1 * Math.abs(lc - v.stop.offset)),
        k = smooth(clamp((ds - sc) / reach, 0, 1));
      lc = v.stop.offset + (lc - v.stop.offset) * k;
    }
    lc = avoid(v, lc, ds);
    v.aim = lc;
    const dl = lc - v.lane,
      D = Math.hypot(sc, dl),
      mpu = table.metresPerUnit(v.p, v.lane);
    if (D > 1e-3) {
      table.sample(v.p, v.lane, 0, A);
      table.sample(v.p + (v.dir * Math.max(sc, 0.05)) / mpu, lc, 0, B);
      v.targetYaw = Math.atan2(B.x - A.x, B.z - A.z);
    }
    let target = v.cruise * follow(v, lc, ds, sc);
    if (v.stop) target = Math.min(target, Math.sqrt(Math.hypot(ds, v.stop.offset - v.lane)) * 0.75 + 0.03);
    const turn = Math.abs(angleDelta(v.yaw, v.targetYaw));
    if (turn > 1) target = Math.min(target, 0.06);
    else if (turn > 0.5) target = Math.min(target, 0.35);
    if (v.leaving && v.leaveDist < 0.05 && mergeBlocked(v)) target = 0;
    v.speed = approach(v.speed, target, (target < v.speed ? 1.8 : 0.7) * h);
    const step = Math.min(v.speed * h, D);
    if (D > 1e-4 && step > 0) {
      let da = (step * sc) / D,
        dw = (step * dl) / D;
      // Contact guard: drop only the part of the step that closes in on someone within CONTACT, so people
      // slide past each other instead of stopping dead (a hard stop could deadlock two oncoming walkers).
      for (let ui = 0; ui < visitors.length; ui++) {
        const u = visitors[ui];
        if (u === v || !u.active) continue;
        const along = table.delta(v.p, u.p) * v.dir;
        if (Math.abs(along) > 3) continue;
        // Along-route metres at the pair's own lateral offset: the ring bends hard over the islands.
        const ga = (along / table.metresPerUnit(v.p, 0)) * table.metresPerUnit(v.p, (v.lane + u.lane) / 2),
          gw = u.lane - v.lane,
          r = Math.hypot(ga, gw);
        if (r > CONTACT + 0.3 || r < 1e-6) continue;
        const na = ga / r,
          nw = gw / r,
          over = da * na + dw * nw - Math.max(0, r - CONTACT);
        if (over <= 0) continue;
        da -= over * na;
        dw -= over * nw;
      }
      const moved = Math.hypot(da, dw);
      // No walking on the spot while held back.
      if (moved < step - 1e-9) v.speed = Math.min(v.speed, moved / h);
      v.p = table.wrap(v.p + (v.dir * da) / mpu);
      v.lane += dw;
      v.travelled += moved;
      if (v.leaving) {
        v.leaveDist += da;
        if (v.leaveDist >= 2.8) v.leaving = false;
      }
    }
    v.yaw = v.yaw + clamp(angleDelta(v.yaw, v.targetYaw), -2.6 * h, 2.6 * h);
    v.yaw = Math.atan2(Math.sin(v.yaw), Math.cos(v.yaw));
    if (v.stop && Math.hypot(table.delta(v.p, v.stop.p), v.stop.offset - v.lane) < 0.04) arrive(v);
    else if (!closed && !v.stop && ((v.dir > 0 && v.p >= span - 0.01) || (v.dir < 0 && v.p <= 0.01)))
      v.dir = -v.dir;
  }
  function tick(h) {
    for (let vi = 0; vi < visitors.length; vi++) {
      const v = visitors[vi];
      if (!v.active) continue;
      if (v.phase === 'dwell') {
        v.speed = 0;
        v.dwell += h;
        v.timer -= h;
        v.yaw += clamp(angleDelta(v.yaw, v.stop.yaw), -2.4 * h, 2.4 * h);
        v.yaw = Math.atan2(Math.sin(v.yaw), Math.cos(v.yaw));
        if (v.timer <= 0) {
          if (canLeave(v)) startLeave(v);
        }
        continue;
      }
      if (!v.stop && !v.leaving) v.stop = plan(v);
      move(v, h);
    }
  }
  function updatePosition(v) {
    table.sample(v.p, v.lane, DECK.eye, v);
    if (flights.length) v.y = stairBody(v.p, v.y);
  }
  // The walking surface at progress q: a tread's top on the stairs, else the deck.
  function surfaceAt(q) {
    const w = table.wrap(q),
      tread = treadAt(flights, w);
    if (tread !== null) return tread;
    table.sample(w, 0, DECK.eye, C);
    return C.y;
  }
  // Body height on and near the stairs: the tread underfoot, rising to the next tread over STEP_BLEND metres
  // around each riser (a step up, not a 24 cm jump). Off the stairs it keeps the given deck height.
  function stairBody(p, deck) {
    const w = STEP_BLEND / table.metresPerUnit(p, 0),
      here = treadAt(flights, table.wrap(p));
    if (
      here === null &&
      treadAt(flights, table.wrap(p - w)) === null &&
      treadAt(flights, table.wrap(p + w)) === null
    )
      return deck;
    const a = surfaceAt(p - w),
      b = surfaceAt(p + w);
    if (Math.abs(a - b) < 1e-4) return here ?? deck;
    // The riser between p - w and p + w, found where the surface changes from a to b.
    let lo = p - w,
      hi = p + w;
    for (let n = 0; n < 10; n++) {
      const mid = (lo + hi) / 2;
      if (Math.abs(surfaceAt(mid) - a) < 0.02) lo = mid;
      else hi = mid;
    }
    const t = clamp((p - ((lo + hi) / 2 - w)) / (2 * w), 0, 1);
    return a + (b - a) * smooth(t);
  }
  // The walking surface under a world point near visitor v (a sole), for footing on the stairs; off the
  // stairs it is the visitor's own deck height.
  function groundUnder(v, x, z) {
    if (!flights.length) return v.y;
    const mpu = table.metresPerUnit(v.p, 0);
    table.normal(v.p, N);
    // The route tangent is the normal turned back a quarter (path.mjs: normal = (-t.z, t.x)).
    const q = v.p + ((x - v.x) * N.z - (z - v.z) * N.x) / mpu,
      tread = treadAt(flights, table.wrap(q));
    if (tread !== null) return tread;
    if (treadAt(flights, table.wrap(v.p)) === null && Math.abs(v.y - surfaceAt(v.p)) < 1e-3) return v.y;
    return surfaceAt(q);
  }
  // True within reach of a staircase: the footing may then lift the body by up to a step.
  function nearStairs(v) {
    if (!flights.length) return false;
    const w = 1 / table.metresPerUnit(v.p, 0);
    return treadAt(flights, table.wrap(v.p - w)) !== null || treadAt(flights, table.wrap(v.p + w)) !== null;
  }
  function setDwell(v, stop, remaining, elapsed = 1.2) {
    v.stop = stop;
    v.p = table.wrap(stop.p);
    v.lane = stop.offset;
    v.yaw = v.targetYaw = stop.yaw;
    v.phase = 'dwell';
    v.speed = 0;
    v.timer = remaining;
    v.dwell = elapsed;
    v.leaving = false;
    v.stationToken = stop.station;
    updatePosition(v);
  }
  // Spread walkers round the route; a few start at pavilions so the first frame already reads as visitors.
  function place() {
    if (!table) return;
    placed = true;
    const dwellers = [0, 1, 3];
    let next = stations > 1 ? 1 : 0;
    visitors.forEach((v, k) => {
      release(v);
      v.phase = 'walk';
      v.leaving = false;
      v.speed = 0;
      v.p = table.wrap((span * (k + 0.35)) / Math.max(1, visitors.length));
      v.lane = laneFor(v);
      table.sample(v.p, v.lane, 0, A);
      table.sample(v.p + v.dir * 0.02, v.lane, 0, B);
      v.yaw = v.targetYaw = Math.atan2(B.x - A.x, B.z - A.z);
      updatePosition(v);
      if (!dwellers.includes(k)) return;
      for (let t = 0; t < stations; t++) {
        const st = (next + t) % stations;
        if (st === focus || !freeSpots(st, false)) continue;
        const choices = spots[st].filter(s => s.owner < 0 && !s.back),
          spot = choices[Math.floor(v.rng() * choices.length)];
        setDwell(v, viewStop(v, spot, pickGesture(v.kit, v.rng())), 2 + v.rng() * 5);
        next = (st + Math.max(1, Math.round(stations / 3))) % stations;
        break;
      }
    });
  }
  function step(dt) {
    if (!table) return;
    if (!placed) place();
    let remaining = Math.min(5, Math.max(0, dt));
    while (remaining > 1e-6) {
      const h = Math.min(0.05, remaining);
      remaining -= h;
      tick(h);
    }
    for (let vi = 0; vi < visitors.length; vi++) if (visitors[vi].active) updatePosition(visitors[vi]);
  }
  // Static scenes (reduced motion, economy): everybody stands at a stop, never mid-bridge, never at the focused station.
  function freeze() {
    if (!table) return false;
    if (!placed) place();
    let changed = false;
    for (let vi = 0; vi < visitors.length; vi++) {
      const v = visitors[vi];
      if (!v.active) continue;
      if (
        v.phase === 'dwell' &&
        v.stop &&
        v.stop.kind !== 'glance' &&
        !(v.stop.kind === 'view' && v.stop.station === focus)
      )
        continue;
      release(v);
      let stop = null;
      const order = closed
        ? null
        : [...Array(stations).keys()].sort((a, b) => Math.abs(a - v.p) - Math.abs(b - v.p));
      for (let t = 0; t < stations && !stop; t++) {
        const st = closed
          ? wrapStation((v.dir > 0 ? Math.floor(v.p) + 1 : Math.ceil(v.p) - 1) + t * v.dir)
          : order[t];
        if (st === focus) continue;
        for (const s of spots[st])
          if (s.owner < 0 && !s.back) {
            stop = viewStop(v, s, 'none');
            break;
          }
      }
      if (!stop) {
        // A railing mid-span; another free point of it when someone already stands there.
        const seg = closed ? wrapStation(Math.floor(v.p)) : clamp(Math.floor(v.p), 0, route.segments - 1),
          side = laneFor(v) < 0 ? -1.72 : 1.72;
        for (const f of [0.5, 0.38, 0.62]) {
          for (const offset of [side, -side])
            if (!stop && clearStop(v, seg + f, offset)) stop = lookStop(v, seg + f, offset);
        }
        stop ||= lookStop(v, seg + 0.5, side);
      }
      setDwell(v, stop, stop.duration, 1);
      changed = true;
    }
    return changed;
  }
  function clearStation(f) {
    for (const v of visitors) {
      if (v.stop?.kind !== 'view' || v.stop.station !== f) continue;
      if (v.phase === 'dwell') v.timer = Math.min(v.timer, 0.2);
      else release(v);
    }
  }
  function setView(nextMode, nextFocus, camera) {
    mode = nextMode || 'overview';
    const f = mode === 'journey' && nextFocus >= 0 && nextFocus < stations ? Math.floor(nextFocus) : -1;
    if (f !== focus) {
      focus = f;
      if (f >= 0) clearStation(f);
    }
    if (camera) {
      cam.x = camera.x;
      cam.y = camera.y;
      cam.z = camera.z;
      cam.valid = true;
    }
    if (mode === 'journey' && table && cam.valid) {
      table.nearest(cam.x, cam.z, near);
      const lateral = Math.abs(near.lateral);
      cam.active = cam.y - near.deck < 6 && lateral > 1.6 && lateral < 9;
      cam.p = near.p;
      cam.side = near.lateral < 0 ? 1 : -1;
    } else cam.active = false;
  }
  // 0 when the reader should not see this visitor: inside the camera's near field or in front of the focused screen.
  function visibility(v) {
    if (mode === 'overview' || !cam.valid) return 1;
    // Reading a project, a passer-by within 7.5 m would fill a corner of the frame; fade them out there.
    const s = v.scale,
      dx = v.x - cam.x,
      dy = v.y + 1.2 * s - cam.y,
      dz = v.z - cam.z;
    if (dx * dx + dy * dy + dz * dz < (mode === 'journey' ? 56 : 9)) return 0;
    if (mode === 'journey' && focus >= 0) {
      const screen = screens[focus];
      if (
        occludesScreen(cam, screen, v.x, v.y + 0.5 * s, v.z, 0.28) ||
        occludesScreen(cam, screen, v.x, v.y + 1.15 * s, v.z, 0.28) ||
        occludesScreen(cam, screen, v.x, v.y + 1.72 * s, v.z, 0.22)
      )
        return 0;
    }
    return 1;
  }
  function setCount(n) {
    active = clamp(Math.floor(n), 0, visitors.length);
    visitors.forEach((v, k) => {
      v.active = k < active;
    });
  }
  // Audit/capture helper: put the first visitors at one pavilion's spots for a while.
  function stage(station, n = 3, seconds = 40) {
    if (!table || station < 0 || station >= stations) return 0;
    if (!placed) place();
    let used = 0;
    const chosen = visitors.filter(v => v.active).slice(0, n);
    for (const v of chosen) release(v);
    for (const v of chosen) {
      const spot = spots[station].find(s => s.owner < 0 && !s.back);
      if (!spot) {
        // Released from a stop elsewhere and no place here: walk on (a dwell without a stop threw in tick()).
        if (v.phase === 'dwell') {
          v.phase = 'walk';
          v.leaving = false;
        }
        continue;
      }
      setDwell(v, viewStop(v, spot, KIT_GESTURE[v.kit] || 'tilt'), seconds, 1.2);
      used++;
    }
    return used;
  }
  return {
    table,
    spots,
    screens,
    visitors,
    cam,
    flights,
    groundUnder,
    nearStairs,
    step,
    freeze,
    place,
    plan,
    setView,
    setCount,
    visibility,
    stage,
    release,
    get focus() {
      return focus;
    },
    get mode() {
      return mode;
    },
    get active() {
      return active;
    },
    get placed() {
      return placed;
    }
  };
}

// ---------- three.js presentation ----------
const BONES = [
  'upperarm_l',
  'lowerarm_l',
  'hand_l',
  'upperarm_r',
  'lowerarm_r',
  'hand_r',
  'Head',
  'spine_02',
  'neck_01',
  'spine_03'
];
// Feet on the deck: every frame the body is moved so the lowest sole point stands `clearance` above it. The
// Walk clip sank a sole 2.3 cm into the deck and floated it 1.2 cm, and an Idle/Walk blend (starting, stopping,
// creeping in a queue) sank it 5 cm, which buried the thin soles. Bounded, so no pose can throw anyone up.
export const FOOTING = { clearance: 0.004, down: 0.03, up: 0.07 };
// The bottom ring of each sole in its foot bone's frame, [left, right]: the sole is rigid on the foot bone,
// so these few points give the lowest point of a posed shoe without skinning the mesh.
export function solePoints(mesh) {
  const pos = mesh.geometry.attributes.position,
    col = mesh.geometry.attributes.color,
    bones = mesh.skeleton.bones,
    c = SHOE_SOURCE.sole,
    isSole = i =>
      Math.abs(col.getX(i) - c[0]) + Math.abs(col.getY(i) - c[1]) + Math.abs(col.getZ(i) - c[2]) < 0.03;
  return ['_l', '_r'].map((suffix, k) => {
    const j = bones.findIndex(b => b.name === 'foot' + suffix),
      list = [];
    let low = Infinity;
    for (let i = 0; i < pos.count; i++)
      if (isSole(i) && pos.getX(i) > 0 === (k === 0)) {
        list.push(i);
        low = Math.min(low, pos.getY(i));
      }
    if (j < 0 || !list.length) return null;
    const toBone = new THREE.Matrix4().multiplyMatrices(mesh.skeleton.boneInverses[j], mesh.bindMatrix),
      p = new THREE.Vector3(),
      seen = new Set(),
      out = [];
    for (const i of list) {
      if (pos.getY(i) > low + 0.0095) continue;
      p.fromBufferAttribute(pos, i);
      const key = p
        .toArray()
        .map(v => v.toFixed(4))
        .join();
      if (seen.has(key)) continue;
      seen.add(key);
      p.applyMatrix4(toBone);
      out.push(p.x, p.y, p.z);
    }
    return { bone: bones[j].name, points: new Float32Array(out) };
  });
}
// Holding poses, after how people really hold things (owner: unnatural poses with the phone and other things).
// Points are offsets from the chest (spine_03) in the torso frame: +x out to that hand's side, +y up, +z
// forward. `elbow` and `wrist` aim the upper arm and the forearm; the palm then turns about the forearm toward
// the eyes ('eyes') or a torso-frame direction. `lift` puts the prop off the palm along its face normal,
// `reach` along the hand (phone) or up the face (notebook, camera). 'hand' marks a one-handed hold; `flat`
// lays both palms under an open book, `sides` puts them on the camera's sides.
// phone: upper arm by the side, elbow bent about 80 degrees, forearm up and in, the phone a forearm in front
//   of the chest below the eyes, screen to the face, thumb on it; the other arm left to the clip (it swings).
// notebook: open at mid-chest in both hands near its outer edges, elbows in, face tilted up to the eyes.
// camera: raised to the eyes in both hands for a shot (brief), elbows in; otherwise it hangs on its strap at
//   the chest (`strap`: its centre from spine_03, torso frame, with the body standing in Idle).
// Tuned on the visitor GLB with the HANDS finger poses (scripts/test-garden-visitors.mjs).
export const HOLD = {
  phone: {
    hand: 'r',
    elbow: [0.19, -0.07, 0.09],
    wrist: [0.1, 0.02, 0.27],
    palm: [-1, 0.2, 0],
    reach: 0.005,
    lift: 0.012,
    slide: 0.02,
    extend: 0.4,
    osc: 0.1
  },
  notebook: {
    elbow: [0.18, -0.08, 0.05],
    wrist: [0.12, 0.02, 0.24],
    palm: 'eyes',
    lift: -0.025,
    reach: 0.02,
    flat: true,
    osc: 0.06
  },
  camera: {
    elbow: [0.13, 0.06, 0.2],
    wrist: [0.1, 0.27, 0.28],
    palm: [-1, 0, 0],
    lift: 0,
    reach: 0.03,
    sides: true,
    strap: [0, -0.13, 0.115],
    osc: 0.04
  }
};
// While holding, the upper spine turns this far toward the free side, squaring the shoulders to the prop (the
// Idle clip stands with them turned 20 degrees right); the neck turns back so the gaze stays put. Not while
// walking: the walk keeps its own shoulder swing.
export const HOLD_TWIST = 0.24;
// The eyes from the Head bone (torso frame), measured on the GLB's painted eyes.
export const EYES = [0, 0.085, 0.095];
// Finger poses (owner: the book sat between two fists). The GLB's Idle and Walk hold every finger in a constant
// fist (+77 degrees on each joint), so those tracks are dropped at load and the fingers take these poses on the
// straight rest rig instead. Radians: `curl` bends the base, middle and tip joints about the rig's flexion axis
// (bone x), `roll` adds a little more per finger from index to pinky, `spread` fans them at the knuckles
// (FAN), thumb is [flex, swing about bone z (negative tucks it to the hand), middle, tip]; the rest rig holds
// the thumb straight out of the palm. relaxed: free hands, walking and standing, loosely curled. phone (owner:
// it lay on an open palm as if about to fall): fingers bent at the knuckles across its back, tips round the
// far edge, thumb on the screen. notebook: fingers together flat under the covers, thumbs round the outer
// edges onto the pages. camera: palms on its sides, fingers curled over the top, thumbs along the back.
export const HANDS = {
  relaxed: { curl: [0.22, 0.38, 0.22], roll: 0.07, spread: 0.06, thumb: [0.1, -0.5, 0.2, 0.15] },
  phone: {
    curl: [0.8, 0.25, 0.15],
    roll: 0.03,
    spread: 0,
    // The little finger cups the bottom corner.
    fingers: { pinky: [1.0, 0.4, 0.3] },
    thumb: [0.1, -0.3, 0.2, 0.1]
  },
  notebook: { curl: [0.05, 0.1, 0.05], roll: 0, spread: 0.04, thumb: [-0.4, -0.04, 1.5, 1.1] },
  camera: { curl: [0.3, 0.9, 0.5], roll: -0.06, spread: 0, thumb: [0.1, -0.6, 0.2, 0.1] }
};
const FINGERS = ['index', 'middle', 'ring', 'pinky'],
  FAN = [1, 0.25, -0.5, -1.2],
  FINGER_TRACK = /^(thumb|index|middle|ring|pinky)_0\d/;
// Drops the clips' finger keys (a constant fist), so the mixer never writes the fingers.
export function freeFingers(clips) {
  for (const clip of clips) clip.tracks = clip.tracks.filter(t => !FINGER_TRACK.test(t.name));
}
// Local quaternions of every finger joint for each HANDS pose: {pose: [[bone name, quaternion], ...]}, both
// hands, left first. `source` must still have its loaded (straight-fingered) rest rotations.
export function handPoses(source, hands = HANDS) {
  const X = new THREE.Vector3(1, 0, 0),
    Z = new THREE.Vector3(0, 0, 1),
    rot = (axis, angle) => new THREE.Quaternion().setFromAxisAngle(axis, angle),
    out = {};
  for (const [name, spec] of Object.entries(hands)) {
    const list = (out[name] = []),
      joint = (bone, swing, flex) =>
        list.push([
          bone,
          source.getObjectByName(bone).quaternion.clone().multiply(rot(Z, swing)).multiply(rot(X, flex))
        ]);
    for (const side of ['l', 'r']) {
      // The rig mirrors its side-to-side axis between the hands; flexion is +x on both.
      const s = side === 'l' ? 1 : -1;
      FINGERS.forEach((finger, k) => {
        const own = spec.fingers?.[finger];
        for (let j = 0; j < 3; j++)
          joint(
            `${finger}_0${j + 1}_${side}`,
            j ? 0 : s * spec.spread * FAN[k],
            own ? own[j] : spec.curl[j] + k * spec.roll
          );
      });
      const [flex, swing, middle, tip] = spec.thumb;
      joint('thumb_01_' + side, s * swing, flex);
      joint('thumb_02_' + side, 0, middle);
      joint('thumb_03_' + side, 0, tip);
    }
  }
  return out;
}
// A bone's rotation in the rig's frame: its local rotations multiplied up to (not including) the rig.
export function rigTurn(bone, rig, out) {
  out.identity();
  for (let b = bone; b && b !== rig; b = b.parent) out.premultiply(b.quaternion);
  return out;
}
// Additive arm and head poses on top of the Idle clip, solved once from the rest rig:
// each is a parent-frame rotation premultiplied onto the animated bone.
export function solvePoses(source, idleClip, hands = null) {
  const rig = source.getObjectByName('GardenVisitor') || source.children[0],
    saved = rig.scale.clone();
  rig.scale.set(1, 1, 1);
  const mixer = new THREE.AnimationMixer(source);
  mixer.clipAction(idleClip).play();
  mixer.setTime(0);
  // The mixer rewrites a bone only when its sampled value changes, so restore the sampled pose by hand.
  const rest = [];
  source.traverse(o => {
    if (o.isBone) rest.push([o, o.quaternion.clone()]);
  });
  const B = name => source.getObjectByName(name),
    P = o => o.getWorldPosition(new THREE.Vector3()),
    UP = new THREE.Vector3(0, 1, 0),
    reset = () => {
      for (const [bone, q] of rest) bone.quaternion.copy(q);
      source.updateMatrixWorld(true);
    };
  const local = (bone, R) => {
    const q = bone.parent.getWorldQuaternion(new THREE.Quaternion());
    return q.clone().invert().multiply(R).multiply(q);
  };
  const apply = (bone, O) => {
    bone.quaternion.premultiply(O);
    source.updateMatrixWorld(true);
  };
  const aim = (bone, child, target) =>
    local(
      bone,
      new THREE.Quaternion().setFromUnitVectors(P(child).sub(P(bone)).normalize(), target.clone().normalize())
    );
  const palm = side => {
    const h = P(B('hand_' + side)),
      along = P(B('middle_01_' + side))
        .sub(h)
        .normalize(),
      across = P(B('index_01_' + side))
        .sub(P(B('pinky_01_' + side)))
        .normalize();
    return new THREE.Vector3()
      .crossVectors(along, across)
      .normalize()
      .multiplyScalar(side === 'l' ? 1 : -1);
  };
  // Applies a premultiplied offset and records it (merged with an earlier one on the same bone).
  const record = (offsets, bone, O) => {
    apply(bone, O);
    const entry = offsets.find(e => e[0] === bone.name);
    if (entry) entry[1].premultiply(O);
    else offsets.push([bone.name, O]);
  };
  // Turn the forearm about its own axis, half at the elbow and half at the wrist, so the palm (or what
  // `facing` measures) faces `to`.
  const twist = (side, to, offsets, facing = palm) => {
    const fore = B('lowerarm_' + side),
      hand = B('hand_' + side);
    for (const [bone, share] of [
      [fore, 0.5],
      [hand, 1]
    ]) {
      const axis = P(hand).sub(P(fore)).normalize(),
        a = facing(side).projectOnPlane(axis).normalize(),
        b = to.clone().projectOnPlane(axis).normalize();
      const angle = Math.atan2(axis.dot(new THREE.Vector3().crossVectors(a, b)), a.dot(b)) * share;
      record(offsets, bone, local(bone, new THREE.Quaternion().setFromAxisAngle(axis, angle)));
    }
  };
  // The torso frame: across the shoulders (+x left), world up, forward.
  const torso = () => {
    const across = P(B('upperarm_l'))
      .sub(P(B('upperarm_r')))
      .setY(0)
      .normalize();
    return { across, fwd: new THREE.Vector3().crossVectors(across, UP) };
  };
  const T = (s, [x, y, z], f = torso()) =>
    f.across
      .clone()
      .multiplyScalar(s * x)
      .addScaledVector(UP, y)
      .addScaledVector(f.fwd, z);
  const eyes = () => P(B('Head')).add(T(1, EYES));
  // Square the shoulders (HOLD_TWIST): additive offsets on spine_02 and back on the neck; also the squared
  // chest's (spine_03) rotation in the rig's frame, which a walker holding something keeps (holdPose).
  const squareUp = () => {
    const list = [
      ['spine_02', HOLD_TWIST],
      ['neck_01', -HOLD_TWIST]
    ].map(([name, angle]) => {
      const O = local(B(name), new THREE.Quaternion().setFromAxisAngle(UP, angle));
      apply(B(name), O);
      return [name, O];
    });
    list[0].push(rigTurn(B('spine_03'), rig, new THREE.Quaternion()));
    return list;
  };
  const pose = (side, { elbow, wrist, palm: facing }, offsets) => {
    const s = side === 'l' ? 1 : -1,
      // The wrist goes to a point in front of the chest, mirrored across the torso, so both hands of a
      // two-handed hold sit level and alike.
      chest = P(B('spine_03')),
      goal = chest.clone().add(T(s, wrist)),
      bend = chest.clone().add(T(s, elbow));
    for (const [name, child, target] of [
      ['upperarm_' + side, 'lowerarm_' + side, () => bend.clone().sub(P(B('upperarm_' + side)))],
      ['lowerarm_' + side, 'hand_' + side, () => goal.clone().sub(P(B('lowerarm_' + side)))]
    ]) {
      const O = aim(B(name), B(child), target());
      apply(B(name), O);
      offsets.push([name, O]);
    }
    twist(side, facing === 'eyes' ? eyes().sub(P(B('hand_' + side))) : T(s, facing), offsets);
  };
  // The final local rotations of every posed bone: held props lock the arm (no walk swing through them). The
  // upper arms also keep their rotation in the rig's frame, so the holding arm stays steady while the walk
  // swings the shoulders (owner: the phone hand swung as if the phone would fall).
  const lock = offsets =>
    [...new Set(offsets.map(e => e[0]))].map(name => [
      name,
      B(name).quaternion.clone(),
      name.startsWith('upperarm_') ? rigTurn(B(name), rig, new THREE.Quaternion()) : null
    ]);
  const grip = side =>
    P(B('hand_' + side))
      .lerp(P(B('middle_01_' + side)), 0.7)
      .addScaledVector(palm(side), 0.035);
  const oscAbout = (bone, axis, angle) =>
    local(bone, new THREE.Quaternion().setFromAxisAngle(axis.clone().normalize(), angle));
  const sets = {};
  for (const [kit, spec] of Object.entries(HOLD)) {
    reset();
    const spine = squareUp(),
      offsets = [];
    if (spec.hand) {
      // One hand, as a phone is really held: the palm turned in, the fingers bent at the knuckles and lying
      // across its back with their tips at the far edge, the near edge against the palm, the little finger
      // under the bottom corner, the thumb over the screen; the screen (+y) faces the eyes, its length runs
      // from the little finger up past the index.
      const h = spec.hand,
        hand = B('hand_' + h);
      pose(h, spec, offsets);
      // The wrist bends back a little (`extend`), as it does round a phone, so the bent fingers can face the eyes.
      {
        const n = palm(h),
          d = P(B('middle_01_' + h))
            .sub(P(hand))
            .normalize(),
          axis = new THREE.Vector3().crossVectors(d, n.negate()).normalize();
        record(offsets, hand, local(hand, new THREE.Quaternion().setFromAxisAngle(axis, spec.extend || 0)));
      }
      if (hands) for (const [name, q] of hands[kit]) if (name.endsWith('_' + h)) B(name).quaternion.copy(q);
      source.updateMatrixWorld(true);
      // The plane the bent fingers lie in (the phone's back), its normal toward the eyes; the forearm turns
      // until that normal points at them.
      const along = () => P(B('middle_02_' + h)).sub(P(B('middle_01_' + h))),
        row = () => P(B('index_02_' + h)).sub(P(B('pinky_02_' + h))),
        back = () => {
          const n = new THREE.Vector3().crossVectors(along(), row()).normalize();
          return n.dot(eyes().sub(P(B('middle_02_' + h)))) < 0 ? n.negate() : n;
        };
      for (let pass = 0; pass < 2; pass++) twist(h, eyes().sub(P(B('middle_02_' + h))), offsets, back);
      const [w, t] = PROPS[kit],
        knuckle = P(B('middle_01_' + h)),
        face = back(),
        finger = along().projectOnPlane(face).normalize(),
        long = row().projectOnPlane(face).projectOnPlane(finger).normalize(),
        across = new THREE.Vector3().crossVectors(face, long),
        // `reach` along the fingers from the knuckles to the near edge, `lift` off the fingers' bones, `slide`
        // the centre up from the knuckle line.
        centre = knuckle
          .addScaledVector(finger, w / 2 + spec.reach)
          .addScaledVector(face, spec.lift + t / 2)
          .addScaledVector(long, spec.slide);
      sets[kit] = {
        offsets,
        spine,
        targets: lock(offsets),
        // A small wrist rock while scrolling.
        osc: ['hand_' + h, oscAbout(hand, long, spec.osc)],
        prop: {
          bone: 'hand_' + h,
          matrix: new THREE.Matrix4()
            .copy(hand.matrixWorld)
            .invert()
            .multiply(new THREE.Matrix4().makeBasis(across, face, long).setPosition(centre))
        }
      };
      continue;
    }
    // Two hands: the prop rests between both grips, its width running exactly grip to grip, its face to the eyes.
    pose('l', spec, offsets);
    pose('r', spec, offsets);
    const hand = B('hand_l'),
      xAxis = new THREE.Vector3(),
      up = new THREE.Vector3(),
      zAxis = new THREE.Vector3(),
      frame = () => {
        const l = grip('l'),
          r = grip('r');
        xAxis.copy(l).sub(r).normalize();
        up.copy(eyes().sub(l.add(r).multiplyScalar(0.5)))
          .projectOnPlane(xAxis)
          .normalize();
        zAxis.crossVectors(xAxis, up);
      };
    frame();
    // Each palm turns (the shortest way, so the wrist stays straight) to lie flat under its half of the open
    // book, or against its side of the camera. Repeated, as turning a palm moves its grip.
    for (let pass = 0; pass < 4; pass++) {
      for (const side of ['l', 'r']) {
        const s = side === 'l' ? 1 : -1,
          bone = B('hand_' + side),
          to = spec.flat
            ? up.clone().applyAxisAngle(zAxis, s * PROPS.notebook.fold)
            : xAxis.clone().multiplyScalar(-s);
        record(offsets, bone, local(bone, new THREE.Quaternion().setFromUnitVectors(palm(side), to)));
      }
      frame();
    }
    const centre = grip('l')
      .add(grip('r'))
      .multiplyScalar(0.5)
      .addScaledVector(up, spec.lift)
      .addScaledVector(zAxis, spec.reach || 0);
    sets[kit] = {
      offsets,
      spine,
      targets: lock(offsets),
      // A slight tilt of the left wrist, as if turning a page or framing the shot.
      osc: ['hand_l', oscAbout(hand, zAxis, spec.osc)],
      prop: {
        bone: 'hand_l',
        matrix: new THREE.Matrix4()
          .copy(hand.matrixWorld)
          .invert()
          .multiply(new THREE.Matrix4().makeBasis(xAxis, up, zAxis).setPosition(centre))
      }
    };
  }
  // The camera's strap: hanging at the chest in the plain Idle pose (it is carried there whenever it is not
  // raised), its back against the shirt, the lens tipped a little down; the strap runs up round the neck.
  {
    reset();
    const chest = B('spine_03'),
      f = torso(),
      at = P(chest).add(T(1, HOLD.camera.strap, f)),
      back = f.fwd.clone().negate().addScaledVector(UP, 0.18).normalize(),
      height = new THREE.Vector3().crossVectors(f.across, back),
      toChest = chest.matrixWorld.clone().invert(),
      [w, , l] = PROPS.camera,
      neck = P(B('neck_01')),
      side = (x, z, y = 0) =>
        neck.clone().addScaledVector(f.across, x).addScaledVector(f.fwd, z).addScaledVector(UP, y),
      path = [
        at
          .clone()
          .addScaledVector(f.across, w * 0.42)
          .addScaledVector(height, l / 2),
        side(0.075, 0.035, -0.03),
        side(0.06, -0.045),
        side(0, -0.07),
        side(-0.06, -0.045),
        side(-0.075, 0.035, -0.03),
        at
          .clone()
          .addScaledVector(f.across, -w * 0.42)
          .addScaledVector(height, l / 2)
      ];
    sets.camera.strap = {
      bone: 'spine_03',
      matrix: toChest.clone().multiply(new THREE.Matrix4().makeBasis(f.across, back, height).setPosition(at)),
      path: path.map(p => p.applyMatrix4(toChest))
    };
  }
  reset();
  const head = B('Head'),
    X = new THREE.Vector3(1, 0, 0),
    Z = new THREE.Vector3(0, 0, 1),
    R = (axis, angle) => new THREE.Quaternion().setFromAxisAngle(axis, angle);
  const poses = {
    sets,
    head: {
      up: local(head, R(X, -0.2)),
      down: local(head, R(X, 0.5)),
      tilt: local(head, R(Z, 0.18).multiply(R(X, -0.12)))
    }
  };
  reset();
  mixer.stopAllAction();
  mixer.uncacheRoot(source);
  rig.scale.copy(saved);
  source.updateMatrixWorld(true);
  return poses;
}
// The Idle clip stands in a wide split stance (ankles 0.55 m apart, the right foot 0.41 m back and turned out
// 41 degrees; owner: "нелепо они выглядят"). Once at load its thigh/calf/foot keys are re-solved (two-bone IK)
// so each ankle stands under its hip joint, `back` behind it, the sole level, toes out `toeOut` rad from the
// pelvis and the knee bent toward the toes; the feet stay planted while the pelvis sways. `lift` raises the
// Idle pelvis so the straightened legs are not left in a crouch. Walk and the upper body are untouched.
// `source` must still be in its loaded rest pose (its level feet are the reference).
export const STANCE = { back: 0.02, toeOut: 0.14, ankle: -0.003, lift: 0.03 };
export function plantIdleStance(source, idleClip, stance = STANCE) {
  // Once per clip: a second pass would add the lift again.
  if (idleClip.userData.planted) return true;
  const rig = source.getObjectByName('GardenVisitor') || source.children[0],
    saved = rig.scale.clone();
  rig.scale.set(1, 1, 1);
  source.updateMatrixWorld(true);
  const B = name => source.getObjectByName(name),
    P = o => o.getWorldPosition(new THREE.Vector3()),
    W = o => o.getWorldQuaternion(new THREE.Quaternion()),
    UP = new THREE.Vector3(0, 1, 0);
  const legs = ['l', 'r'].map(side => {
    const bones = ['thigh_', 'calf_', 'foot_'].map(name => B(name + side));
    return {
      s: side === 'l' ? 1 : -1,
      bones,
      tracks: bones.map(bone => bone && idleClip.tracks.find(t => t.name === bone.name + '.quaternion')),
      level: bones[2] && W(bones[2]),
      ankleY: bones[2] ? P(bones[2]).y + stance.ankle : 0,
      target: null
    };
  });
  if (legs.some(leg => leg.bones.some(b => !b) || leg.tracks.some(t => !t))) {
    rig.scale.copy(saved);
    source.updateMatrixWorld(true);
    return false;
  }
  const hips = idleClip.tracks.find(t => t.name === 'pelvis.position');
  if (hips && stance.lift) {
    // World up in the pelvis' parent frame (the rig root is Z-up), added to every key.
    const up = new THREE.Vector3(0, stance.lift, 0).applyQuaternion(W(B('pelvis').parent).invert());
    for (let i = 0; i < hips.values.length; i += 3) {
      hips.values[i] += up.x;
      hips.values[i + 1] += up.y;
      hips.values[i + 2] += up.z;
    }
  }
  // A world rotation R premultiplied onto a bone, expressed in its parent frame (as solvePoses does).
  const turn = (bone, R) => {
    const q = W(bone.parent);
    bone.quaternion.premultiply(q.clone().invert().multiply(R).multiply(q));
    source.updateMatrixWorld(true);
  };
  // Orientation of a thigh direction t with its knee's bend plane (t, c); `side` breaks a straight knee.
  const plane = (t, c, side) => {
    const n = new THREE.Vector3().crossVectors(t, c);
    if (n.lengthSq() < 1e-10) n.copy(side).addScaledVector(t, -side.dot(t));
    n.normalize();
    return new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(t, n, new THREE.Vector3().crossVectors(t, n))
    );
  };
  const mixer = new THREE.AnimationMixer(source);
  mixer.clipAction(idleClip).play();
  const times = legs[0].tracks[0].times;
  for (let k = 0; k < times.length; k++) {
    mixer.setTime(Math.min(times[k], idleClip.duration - 1e-4));
    // The mixer skips unchanged values, so the leg bones take this key straight from the tracks.
    for (const leg of legs)
      leg.bones.forEach((bone, i) => bone.quaternion.fromArray(leg.tracks[i].values, k * 4));
    source.updateMatrixWorld(true);
    const hipL = P(legs[0].bones[0]),
      hipR = P(legs[1].bones[0]),
      across = hipL.clone().sub(hipR).setY(0).normalize(),
      forward = new THREE.Vector3().crossVectors(across, UP),
      yaw = Math.atan2(forward.x, forward.z);
    for (const leg of legs) {
      const [thigh, calf, foot] = leg.bones,
        footYaw = yaw + leg.s * stance.toeOut;
      // Where the feet stand is fixed at the first key, so they stay planted while the pelvis sways.
      leg.target ||= hipL
        .clone()
        .add(hipR)
        .multiplyScalar(0.5)
        .addScaledVector(across, (leg.s * hipL.distanceTo(hipR)) / 2)
        .addScaledVector(forward, -stance.back)
        .setY(leg.ankleY);
      const H = P(thigh),
        K0 = P(calf),
        A0 = P(foot),
        a = H.distanceTo(K0),
        b = K0.distanceTo(A0),
        d = Math.min(H.distanceTo(leg.target), a + b - 1e-4),
        u = leg.target.clone().sub(H).normalize(),
        toes = new THREE.Vector3(Math.sin(footYaw), 0, Math.cos(footYaw)),
        w = toes.clone().addScaledVector(u, -toes.dot(u)).normalize(),
        cos = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1),
        K1 = H.clone()
          .addScaledVector(u, a * cos)
          .addScaledVector(w, a * Math.sqrt(Math.max(0, 1 - cos * cos))),
        A1 = H.clone().addScaledVector(u, d);
      // The thigh carries the knee's bend plane along (the knee stays a hinge), the calf bends to the ankle,
      // the foot turns back to a level sole with its toe-out.
      const t0 = K0.clone().sub(H).normalize(),
        t1 = K1.clone().sub(H).normalize();
      turn(
        thigh,
        plane(t1, A1.clone().sub(K1).normalize(), across).multiply(
          plane(t0, A0.clone().sub(K0).normalize(), across).invert()
        )
      );
      turn(
        calf,
        new THREE.Quaternion().setFromUnitVectors(
          P(foot).sub(P(calf)).normalize(),
          A1.clone().sub(P(calf)).normalize()
        )
      );
      turn(
        foot,
        new THREE.Quaternion().setFromAxisAngle(UP, footYaw).multiply(leg.level).multiply(W(foot).invert())
      );
      leg.bones.forEach((bone, i) => {
        const q = bone.quaternion,
          v = leg.tracks[i].values,
          j = k * 4;
        // Neighbouring keys in the same hemisphere, so the slerp between them takes the short way.
        if (k && q.x * v[j - 4] + q.y * v[j - 3] + q.z * v[j - 2] + q.w * v[j - 1] < 0)
          q.set(-q.x, -q.y, -q.z, -q.w);
        q.toArray(v, j);
      });
    }
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(source);
  rig.scale.copy(saved);
  source.updateMatrixWorld(true);
  idleClip.userData.planted = true;
  return true;
}
// Carries a point on the trouser hem (skinned to the calf) into the shoe's bind frame (skinned to the foot) as
// they stand at `time` in `clip`, per side { 1: left, -1: right }, for shapeShoes' collar.
export function hemToShoe(root, mesh, clip, time = clip.duration / 2) {
  const mixer = new THREE.AnimationMixer(root);
  mixer.clipAction(clip).play();
  mixer.setTime(time);
  root.updateMatrixWorld(true);
  const bones = mesh.skeleton.bones,
    skin = j =>
      new THREE.Matrix4()
        .copy(mesh.bindMatrixInverse)
        .multiply(bones[j].matrixWorld)
        .multiply(mesh.skeleton.boneInverses[j])
        .multiply(mesh.bindMatrix),
    out = {};
  for (const [side, s] of [
    [1, '_l'],
    [-1, '_r']
  ]) {
    const c = bones.findIndex(b => b.name === 'calf' + s),
      f = bones.findIndex(b => b.name === 'foot' + s);
    if (c >= 0 && f >= 0) out[side] = skin(f).invert().multiply(skin(c)).elements.slice();
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(root);
  return out;
}
// Props, +y toward the reader's eyes, sized [width, thickness, length] (the boxes the hands are fitted to). The
// notebook is open: two halves in a shallow V across both palms, each a cover under a block of pages.
export const PROPS = {
  notebook: { page: [0.15, 0.012, 0.21], fold: 0.12, cover: 0.003 },
  // Wide enough to sit between the palms of the camera grip (HOLD.camera.sides); the lens stands out in front.
  camera: [0.12, 0.06, 0.08],
  lens: { radius: 0.024, length: 0.032 },
  phone: [0.072, 0.01, 0.148],
  // Rounded phone corners and the screen's margin.
  corner: 0.011,
  bezel: 0.004,
  strap: 0.004
};
const PROP_COLOURS = {
  pages: '#efe9db',
  print: '#b9b1a2',
  cover: '#8c2f2b',
  phone: '#1c1e23',
  screen: '#5f8fbf',
  camera: '#2b2f36',
  lens: '#121417',
  glass: '#3e5d7d',
  strap: '#3a2c24'
};
// One colour over a whole (non-indexed) geometry, or per draw group.
function paint(geometry, ...colours) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry,
    count = g.attributes.position.count,
    colors = new Float32Array(count * 3),
    list = colours.map(c => new THREE.Color(c)),
    groups = g.groups.length ? g.groups : [{ start: 0, count, materialIndex: 0 }];
  for (const group of groups) {
    const c = list[Math.min(group.materialIndex, list.length - 1)];
    for (let i = group.start; i < group.start + group.count; i++) colors.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.deleteAttribute('uv');
  g.clearGroups();
  if (g !== geometry) geometry.dispose();
  return g;
}
const box = (w, h, d, colour) => paint(new THREE.BoxGeometry(w, h, d), colour);
function merged(parts) {
  const geometry = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  return geometry;
}
// A rounded rectangle w x l, t thick, centred, its faces along +-y.
function slab(w, t, l, r, colour) {
  const shape = new THREE.Shape(),
    x = w / 2 - r,
    z = l / 2 - r;
  shape.absarc(x, z, r, 0, Math.PI / 2);
  shape.absarc(-x, z, r, Math.PI / 2, Math.PI);
  shape.absarc(-x, -z, r, Math.PI, Math.PI * 1.5);
  shape.absarc(x, -z, r, Math.PI * 1.5, Math.PI * 2);
  return paint(
    new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 2 })
      .translate(0, 0, -t / 2)
      .rotateX(-Math.PI / 2),
    colour
  );
}
// Cheap but legible shapes (owner: props were plain blocks): a rounded phone with a lit screen, an open book with
// covers, pages and a few lines of print, a camera with a lens and a viewfinder hump.
function propGeometry(kind) {
  const C = PROP_COLOURS;
  if (kind === 'notebook') {
    const [w, t, l] = PROPS.notebook.page,
      c = PROPS.notebook.cover,
      halves = [-1, 1].map(side => {
        const parts = [
          box(w, c, l, C.cover).translate(0, c / 2 - t / 2, 0),
          box(w - 0.006, t - c, l - 0.008, C.pages).translate(-side * 0.003, c / 2, 0)
        ];
        for (let k = 0; k < 5; k++)
          parts.push(box(w * 0.66, 0.001, 0.005, C.print).translate(0, t / 2 + 0.0005, l * (0.3 - k * 0.13)));
        return merged(parts)
          .translate((side * w) / 2, 0, 0)
          .rotateZ(side * PROPS.notebook.fold);
      });
    return merged(halves);
  }
  if (kind === 'phone') {
    const [w, t, l] = PROPS.phone,
      b = PROPS.bezel;
    return merged([
      slab(w, t, l, PROPS.corner, C.phone),
      box(w - 2 * b, 0.001, l - 4 * b, C.screen).translate(0, t / 2 + 0.0005, 0)
    ]);
  }
  const [w, t, l] = PROPS.camera,
    { radius, length } = PROPS.lens;
  return merged([
    box(w, t, l, C.camera),
    // The lens on the front (-y), a little off-centre as on a compact camera; its front glass a lighter cap.
    paint(new THREE.CylinderGeometry(radius, radius * 1.08, length, 10), C.lens, C.lens, C.glass).translate(
      w * 0.12,
      -t / 2 - length / 2,
      -l * 0.04
    ),
    box(w * 0.32, t * 0.6, 0.016, C.camera).translate(-w * 0.18, 0, l / 2 + 0.008)
  ]);
}
// The camera strap: thin round segments along the solved path (spine_03 frame), round the neck to the camera.
function strapGeometry(path) {
  const parts = [];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i],
      d = b.clone().sub(a);
    parts.push(
      paint(new THREE.CylinderGeometry(PROPS.strap, PROPS.strap, d.length(), 4, 1, true), PROP_COLOURS.strap)
        .applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()))
        .translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2)
    );
  }
  return merged(parts);
}
const triangleCount = g => (g.index ? g.index.count : g.attributes.position.count) / 3;

// prepare(holder) runs once the walkers are built from the loaded model (garden.mjs compiles their shaders then).
// The visitor's reshaped geometry (eyes, trousers, shoes, shirt, sleeves, hair: visitor-shape.mjs), kept per page.
// Every garden rebuild loads the same model and reshaped it again, ~35 ms of each rearrangement in one piece
// (round 21); now the later ones copy the result. Returns false (reshape it) if the model has changed shape.
let shapedVisitor = null;
function restoreShape(geometry) {
  if (!shapedVisitor) return false;
  const attributes = Object.entries(geometry.attributes);
  if (attributes.some(([name, a]) => shapedVisitor[name]?.length !== a.array.length)) return false;
  for (const [name, a] of attributes) {
    a.array.set(shapedVisitor[name]);
    a.needsUpdate = true;
  }
  return true;
}
export function createVisitor(scene, route, invalidate = () => {}, prepare = () => {}) {
  const holder = new THREE.Group();
  holder.name = 'garden-visitor';
  scene.add(holder);
  holder.visible = route.segments > 0;
  const capacity = visitorCount(route, false),
    economyCount = visitorCount(route, true),
    crowd = createCrowd(route, { capacity });
  const people = [],
    viewCamera = { x: 0, y: 0, z: 0 },
    projected = new THREE.Vector3(),
    scratch = new THREE.Quaternion(),
    steadyTurn = new THREE.Quaternion(),
    IDENTITY = new THREE.Quaternion(),
    // carryCamera's scratch.
    carry = {
      inverse: new THREE.Matrix4(),
      a: new THREE.Matrix4(),
      b: new THREE.Matrix4(),
      pa: new THREE.Vector3(),
      pb: new THREE.Vector3(),
      qa: new THREE.Quaternion(),
      qb: new THREE.Quaternion(),
      scale: new THREE.Vector3(),
      one: new THREE.Vector3(1, 1, 1)
    },
    frustum = new THREE.Frustum(),
    viewMatrix = new THREE.Matrix4(),
    sphere = new THREE.Sphere();
  let source = null,
    baseMesh = null,
    poses = null,
    hands = null,
    soles = [null, null],
    propMaterial = null,
    props = {},
    propTriangles = {},
    disposed = false,
    lastTime = null,
    phase = 'loading',
    error = null,
    strideLength = 1.1,
    clipDuration = 1.333,
    triangles = 0,
    economy = false,
    camera = null;
  new GLTFLoader().load(
    gardenFile('assets/visitor-r7.glb'),
    asset => {
      if (disposed) {
        asset.scene.traverse(o => {
          o.geometry?.dispose();
          if (o.material) o.material.dispose();
        });
        return;
      }
      try {
        build(asset);
        phase = 'idle';
        prepare(holder);
        invalidate();
      } catch (reason) {
        error = String(reason?.message || reason);
        phase = 'unavailable';
        console.warn('Garden visitors could not be built', error);
      }
    },
    undefined,
    reason => {
      error = String(reason?.message || reason);
      phase = 'unavailable';
      console.warn('Garden visitor could not load', error);
    }
  );
  function build(asset) {
    source = asset.scene;
    source.traverse(o => {
      if (o.isSkinnedMesh && !baseMesh) baseMesh = o;
    });
    triangles = (baseMesh.geometry.index?.count || baseMesh.geometry.attributes.position.count) / 3;
    // Joint indices as floats: as integers they needed a second vertex shader, compiled by the driver in the
    // garden's first frame (round 21, see garden-owners.mjs OWNER_NORMALIZED).
    const joints = baseMesh.geometry.attributes.skinIndex;
    if (joints && !(joints.array instanceof Float32Array))
      baseMesh.geometry.setAttribute(
        'skinIndex',
        new THREE.BufferAttribute(Float32Array.from(joints.array), 4)
      );
    const idleClip = asset.animations.find(c => c.name === 'Idle'),
      walkClip = asset.animations.find(c => c.name === 'Walk');
    // Open hands instead of the clips' fists: finger poses from the straight rest rig, before any mixer runs;
    // every clone starts relaxed and only a holder's fingers are written per frame.
    hands = handPoses(source);
    freeFingers([idleClip, walkClip]);
    for (const [name, q] of hands.relaxed) source.getObjectByName(name).quaternion.copy(q);
    // Feet under the hips, flat and planted: once, on the shared clip, while source is still in its rest pose.
    plantIdleStance(source, idleClip);
    clipDuration = walkClip.duration;
    // Estimate the no-root-motion clip's full stride from the foot's local sweep.
    {
      const mixer = new THREE.AnimationMixer(source),
        walk = mixer.clipAction(walkClip),
        foot = source.getObjectByName('foot_l'),
        p = new THREE.Vector3();
      let low = Infinity,
        high = -Infinity;
      walk.play();
      for (let i = 0; i <= 24; i++) {
        mixer.setTime((i / 24) * walkClip.duration);
        source.updateMatrixWorld(true);
        if (foot) {
          source.worldToLocal(foot.getWorldPosition(p));
          low = Math.min(low, p.z);
          high = Math.max(high, p.z);
        }
      }
      strideLength = THREE.MathUtils.clamp((high - low) * 2 * Math.abs(source.scale.z), 0.5, 2.4);
      mixer.stopAllAction();
      mixer.uncacheRoot(source);
    }
    poses = solvePoses(source, idleClip, hands);
    if (!restoreShape(baseMesh.geometry)) {
      // Real eyes and slimmer trouser legs, once on the shared geometry (visitor-shape.mjs).
      paintEyes(baseMesh.geometry.attributes.position, baseMesh.geometry.attributes.color);
      slimTrousers(
        baseMesh.geometry.attributes.position,
        baseMesh.geometry.attributes.color,
        OUTFIT_SOURCE.trousers
      );
      tuckTrousers(
        baseMesh.geometry.attributes.position,
        baseMesh.geometry.attributes.color,
        OUTFIT_SOURCE.trousers
      );
      // Low sneakers instead of the boxy shoes; the collar fits under the trouser hem as it stands in Idle.
      shapeShoes(
        baseMesh.geometry.attributes.position,
        baseMesh.geometry.attributes.color,
        OUTFIT_SOURCE.trousers,
        hemToShoe(source, baseMesh, idleClip)
      );
      smoothShirt(baseMesh.geometry, [OUTFIT_SOURCE.shirt, OUTFIT_SOURCE.collar]);
      fitArmsInSleeves(baseMesh.geometry, [OUTFIT_SOURCE.shirt, OUTFIT_SOURCE.collar]);
      bindScalpToHair(baseMesh.geometry);
      shapedVisitor = Object.fromEntries(
        Object.entries(baseMesh.geometry.attributes).map(([name, a]) => [name, a.array.slice()])
      );
    }
    soles = solePoints(baseMesh);
    const colors = baseMesh.geometry.attributes.color,
      classes = new Uint8Array(colors.count);
    for (let i = 0; i < colors.count; i++)
      classes[i] = clothingClass(colors.getX(i), colors.getY(i), colors.getZ(i));
    propMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0 });
    props = {
      notebook: propGeometry('notebook'),
      phone: propGeometry('phone'),
      camera: propGeometry('camera'),
      strap: strapGeometry(poses.sets.camera.strap.path)
    };
    for (const [kind, geometry] of Object.entries(props)) propTriangles[kind] = triangleCount(geometry);
    crowd.visitors.forEach((v, k) => {
      const model = cloneSkinned(source);
      let mesh = null;
      model.traverse(o => {
        if (o.isSkinnedMesh) mesh = o;
      });
      // Shared position/normal/skin attributes; only the colour attribute is per visitor.
      const geometry = new THREE.BufferGeometry(),
        base = baseMesh.geometry;
      geometry.setIndex(base.index);
      for (const name of Object.keys(base.attributes))
        geometry.setAttribute(name, name === 'color' ? base.attributes.color.clone() : base.attributes[name]);
      const outfit = OUTFITS[k % OUTFITS.length];
      if (outfit) {
        const shirt = new THREE.Color(outfit.shirt),
          collar = shirt.clone().multiplyScalar(0.52),
          trousers = new THREE.Color(outfit.trousers),
          color = geometry.attributes.color;
        for (let i = 0; i < color.count; i++) {
          const c = classes[i] === 1 ? shirt : classes[i] === 2 ? collar : classes[i] === 3 ? trousers : null;
          if (c) color.setXYZ(i, c.r, c.g, c.b);
        }
      }
      const material = baseMesh.material.clone();
      material.alphaHash = true;
      mesh.geometry = geometry;
      mesh.material = material;
      mesh.frustumCulled = true;
      mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.95, 0), 1.3);
      mesh.castShadow = mesh.receiveShadow = false;
      mesh.userData.dynamic = true;
      const group = new THREE.Group();
      group.name = 'garden-visitor-' + k;
      group.scale.setScalar(v.scale);
      if (v.scale < 0.8) model.getObjectByName('Head')?.scale.setScalar(CHILD_HEAD);
      group.add(model);
      holder.add(group);
      const mixer = new THREE.AnimationMixer(model),
        idle = mixer.clipAction(idleClip),
        walk = mixer.clipAction(walkClip);
      idle.play();
      walk.play();
      idle.time = (k * 0.61) % idleClip.duration;
      walk.time = (k * 0.37) % walkClip.duration;
      walk.setEffectiveWeight(0);
      walk.setEffectiveTimeScale(0);
      const bones = {};
      for (const name of BONES) bones[name] = model.getObjectByName(name);
      let prop = null,
        set = null,
        armBones = [],
        armOffsets = [],
        oscBone = null,
        fingers = [],
        strap = null,
        rig = null,
        steady = [];
      if (v.kit !== 'none') {
        set = poses.sets[v.kit];
        prop = new THREE.Mesh(props[v.kit], propMaterial);
        prop.name = 'garden-visitor-prop';
        prop.matrixAutoUpdate = false;
        prop.matrix.copy(set.prop.matrix);
        prop.userData.dynamic = true;
        rig = model.getObjectByName('GardenVisitor') || model.children[0];
        if (set.strap) {
          // The camera moves between its strap at the chest and the raised hands (carryCamera), in the rig's
          // frame; the strap itself rides on the chest.
          rig.add(prop);
          strap = new THREE.Mesh(props.strap, propMaterial);
          strap.name = 'garden-visitor-strap';
          strap.userData.dynamic = true;
          bones[set.strap.bone].add(strap);
        } else bones[set.prop.bone].add(prop);
        armBones = set.targets.map(e => bones[e[0]]);
        armOffsets = set.targets.map(e => e[1]);
        steady = set.targets.map(e => e[2]);
        oscBone = bones[set.osc[0]];
        // The holding hand(s): [bone, relaxed, grip]; the same joint order in every HANDS pose.
        const sides = HOLD[v.kit].hand ? [HOLD[v.kit].hand] : ['l', 'r'];
        fingers = hands[v.kit]
          .map(([name, q], i) => [model.getObjectByName(name), hands.relaxed[i][1], q])
          .filter(([bone]) => sides.includes(bone.name.slice(-1)));
      }
      people.push({
        v,
        group,
        model,
        mesh,
        mixer,
        idle,
        walk,
        material,
        bones,
        prop,
        strap,
        rig,
        set,
        armBones,
        armOffsets,
        steady,
        oscBone,
        fingers,
        grip: 0,
        feet: soles.map(s => (s ? model.getObjectByName(s.bone) : null)),
        hold: 0,
        up: 0,
        down: 0,
        tilt: 0,
        posed: false,
        boneList: BONES.map(name => bones[name]),
        base: BONES.map(() => new THREE.Quaternion()),
        additive: false
      });
    });
    setEconomy(economy);
  }
  // The mixer writes a bone only when its sampled value changes; put back its last output before every
  // update so additive gestures can never accumulate (dt=0 frames, constant keys).
  function restore(person) {
    if (!person.additive) return;
    for (let i = 0; i < person.boneList.length; i++) person.boneList[i].quaternion.copy(person.base[i]);
    person.additive = false;
  }
  function keep(person) {
    for (let i = 0; i < person.boneList.length; i++) person.base[i].copy(person.boneList[i].quaternion);
    person.additive = true;
  }
  const premultiply = (bone, offset, weight) => {
    if (weight <= 0.001 || !bone) return;
    scratch.copy(IDENTITY).slerp(offset, Math.min(1, weight));
    bone.quaternion.premultiply(scratch);
  };
  // Fingers close round the prop as the hold blends in. Absolute writes (no mixer track touches the fingers),
  // only while the blend changes.
  function grip(person, weight) {
    if (weight === person.grip) return;
    person.grip = weight;
    const list = person.fingers;
    for (let i = 0; i < list.length; i++)
      list[i][0].quaternion.slerpQuaternions(list[i][1], list[i][2], weight);
  }
  // The hold pose at weight person.hold: the shoulders square up to the prop (not while walking), the holding
  // arm(s) take their solved rotations outright, so neither the Idle sway nor the walk's arm swing pulls a hand
  // away from the prop; `moving` rocks the wrist (scrolling, turning a page).
  function holdPose(person, walkWeight, moving) {
    const w = Math.min(1, person.hold),
      set = person.set;
    if (!set || w <= 0.001) return;
    // Standing, the shoulders square up to the prop; walking, the upper body keeps that squared pose in the
    // rig's frame instead of the walk's shoulder swing (people walk stiffer while reading a phone), so the
    // holding hand stays steady. The neck turns back either way, keeping the gaze.
    const [[, twist, upright], [, neck]] = set.spine,
      spine = person.bones.spine_02,
      chest = person.bones.spine_03;
    premultiply(spine, twist, w * (1 - walkWeight));
    if (walkWeight > 0.001)
      chest.quaternion.slerp(
        rigTurn(chest.parent, person.rig, steadyTurn).invert().multiply(upright),
        w * walkWeight
      );
    premultiply(person.bones.neck_01, neck, w);
    for (let i = 0; i < person.armBones.length; i++) {
      const bone = person.armBones[i],
        steady = person.steady[i];
      if (!bone) continue;
      // An upper arm: its solved rotation in the rig's frame, re-expressed under the shoulder as it moves now.
      const target = steady
        ? rigTurn(bone.parent, person.rig, steadyTurn).invert().multiply(steady)
        : person.armOffsets[i];
      bone.quaternion.slerp(target, w);
    }
    if (moving)
      premultiply(
        person.oscBone,
        set.osc[1],
        w * (0.5 + 0.5 * Math.sin(person.v.dwell * TAU * (person.v.kit === 'phone' ? 3.1 : 1.7)))
      );
  }
  function gestures(person, dt, walkWeight) {
    const v = person.v,
      stop = v.phase === 'dwell' ? v.stop : null,
      settled = !!stop && v.dwell > 0.9 && v.timer > 0.75,
      g = stop ? stop.gesture : 'none';
    // Phones are also held while walking; the notebook only at a stop; the camera only for a brief shot at a
    // stop, hanging on its strap otherwise.
    const photo =
        settled && g === 'photo' && (v.dwell * CAMERA_SHOT.rate + CAMERA_SHOT.delay) % 1 < CAMERA_SHOT.share,
      holding =
        photo || (settled && (g === 'notes' || g === 'phone')) || (v.phase === 'walk' && v.kit === 'phone'),
      reading = holding && !photo && (v.dwell * 0.27) % 1 < 0.62;
    const rate = 2.2 * dt;
    person.hold = approach(person.hold, holding ? 1 : 0, rate);
    person.down = approach(person.down, reading ? 1 : settled && stop.kind === 'look' ? 0.45 : 0, rate);
    person.up = approach(
      person.up,
      settled && (stop.kind === 'view' || stop.kind === 'glance') && !reading && !photo ? 1 : 0,
      rate * 0.8
    );
    person.tilt = approach(person.tilt, settled && g === 'tilt' && v.dwell > 1.6 ? 1 : 0, rate * 0.6);
    holdPose(person, walkWeight, reading);
    const head = person.bones.Head;
    premultiply(head, poses.head.up, person.up * (1 - person.down));
    premultiply(head, poses.head.down, person.down);
    premultiply(head, poses.head.tilt, person.tilt);
  }
  // The camera between its strap at the chest and the raised hands, as the hold blends; computed in the rig's
  // frame (where both solved matrices are rigid) after the pose, before grounding moves the model.
  function carryCamera(person) {
    const w = smooth(clamp((person.hold - 0.1) / 0.8, 0, 1)),
      b = person.bones,
      set = person.set,
      c = carry;
    person.strap.visible = person.prop.visible && w < 0.05;
    b.hand_l.updateWorldMatrix(true, false);
    c.inverse.copy(person.rig.matrixWorld).invert();
    c.a
      .multiplyMatrices(c.inverse, b.spine_03.matrixWorld)
      .multiply(set.strap.matrix)
      .decompose(c.pa, c.qa, c.scale);
    c.b
      .multiplyMatrices(c.inverse, b.hand_l.matrixWorld)
      .multiply(set.prop.matrix)
      .decompose(c.pb, c.qb, c.scale);
    person.prop.matrix.compose(c.pa.lerp(c.pb, w), c.qa.slerp(c.qb, w), c.one);
  }
  // Puts the lowest sole point FOOTING.clearance above the deck by moving the model inside its group. On the
  // stairs each sole point is measured against the tread under it, so no foot sinks into a step: the body
  // rises or drops until the foot on the higher tread stands on it (by up to a step more than on the flat).
  function ground(person) {
    const v = person.v,
      stairs = crowd.nearStairs(v);
    let need = -Infinity;
    for (let s = 0; s < 2; s++) {
      const bone = person.feet[s];
      if (!bone) continue;
      bone.updateWorldMatrix(true, false);
      const e = bone.matrixWorld.elements,
        pts = soles[s].points;
      for (let i = 0; i < pts.length; i += 3) {
        const x = pts[i],
          y = pts[i + 1],
          z = pts[i + 2],
          wy = e[1] * x + e[5] * y + e[9] * z + e[13],
          deck = stairs
            ? crowd.groundUnder(
                v,
                e[0] * x + e[4] * y + e[8] * z + e[12],
                e[2] * x + e[6] * y + e[10] * z + e[14]
              )
            : person.group.matrixWorld.elements[13];
        need = Math.max(need, deck + FOOTING.clearance - wy);
      }
    }
    if (need === -Infinity) return;
    const scale = v.scale,
      model = person.model;
    model.position.y = clamp(
      model.position.y + need / scale,
      -(FOOTING.down + (stairs ? STAIR_RISE : 0)) / scale,
      (FOOTING.up + (stairs ? STAIR_RISE : 0)) / scale
    );
  }
  function place(person) {
    const v = person.v;
    person.group.position.set(v.x, v.y, v.z);
    person.group.rotation.y = v.yaw;
  }
  // Reduced motion or economy: a still tableau of people standing at pavilions in their Idle pose, phones and
  // notebooks held up and read, the camera on its strap.
  function poseStill() {
    const moved = crowd.freeze();
    for (let pi = 0; pi < people.length; pi++) {
      const person = people[pi];
      const v = person.v;
      if (!v.active) {
        person.group.visible = false;
        continue;
      }
      place(person);
      v.alpha = crowd.visibility(v);
      person.group.visible = v.alpha > 0.5;
      person.material.opacity = 1;
      const still = person.set && v.kit !== 'camera' ? 1 : 0;
      if (person.prop) person.prop.visible = still > 0 || !!person.strap;
      if (moved || !person.posed) {
        person.walk.setEffectiveWeight(0);
        person.walk.setEffectiveTimeScale(0);
        person.idle.setEffectiveWeight(1);
        person.idle.time = (0.5 + v.id * 0.37) % 2.4;
        restore(person);
        person.mixer.update(0);
        keep(person);
        person.hold = person.down = still;
        person.up = person.tilt = 0;
        holdPose(person, 0, false);
        premultiply(person.bones.Head, poses.head.down, person.down);
        grip(person, still);
        if (person.strap) carryCamera(person);
        ground(person);
        person.posed = true;
      }
    }
  }
  function animate(person, dt) {
    const v = person.v;
    person.posed = false;
    place(person);
    v.alpha = approach(v.alpha, crowd.visibility(v), 3.2 * dt);
    person.material.opacity = v.alpha;
    person.group.visible = v.alpha > 0.01;
    // Economy runs no gestures, so a hold left from before would keep the prop up beside a free, open hand.
    if (economy) person.hold = 0;
    // A prop shows only while it is held, never swinging through a hand; the camera also on its strap.
    if (person.prop) person.prop.visible = v.alpha > 0.5 && (person.hold > 0.25 || !!person.strap);
    if (!person.group.visible) return;
    // Animate only what can be seen; a culled visitor keeps its last pose until it comes back into view.
    if (camera) {
      sphere.center.set(v.x, v.y + 0.95, v.z);
      sphere.radius = 1.6;
      if (!frustum.intersectsSphere(sphere)) return;
    }
    const walkWeight = clamp(v.speed / 0.32, 0, 1);
    person.walk.setEffectiveWeight(walkWeight);
    person.idle.setEffectiveWeight(1 - walkWeight);
    person.walk.setEffectiveTimeScale((v.speed * clipDuration) / (strideLength * v.scale));
    restore(person);
    person.mixer.update(dt);
    if (!economy) {
      keep(person);
      gestures(person, dt, walkWeight);
    }
    grip(person, economy ? 0 : Math.min(1, person.hold));
    if (person.strap) carryCamera(person);
    ground(person);
  }
  function update(now, enabled) {
    const dt = lastTime === null ? 0 : Math.min(5, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    if (!people.length) return;
    if (!enabled) {
      poseStill();
      return;
    }
    crowd.step(dt);
    if (camera) {
      viewMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(viewMatrix);
    }
    for (let pi = 0; pi < people.length; pi++) {
      const person = people[pi];
      if (person.v.active) animate(person, dt);
      else person.group.visible = false;
    }
  }
  function observe(nextCamera, { mode = 'overview', focus = -1 } = {}) {
    if (nextCamera) {
      camera = nextCamera;
      viewCamera.x = nextCamera.position.x;
      viewCamera.y = nextCamera.position.y;
      viewCamera.z = nextCamera.position.z;
    }
    crowd.setView(mode, focus, nextCamera ? viewCamera : null);
  }
  function setEconomy(value) {
    economy = !!value;
    crowd.setCount(economy ? economyCount : capacity);
    for (const person of people) if (!person.v.active) person.group.visible = false;
    invalidate();
  }
  function suspend() {
    lastTime = null;
  }
  function needsAnimation(cam) {
    if (!people.length || !holder.visible) return false;
    for (let pi = 0; pi < people.length; pi++) {
      const v = people[pi].v;
      if (!v.active || v.alpha <= 0.01) continue;
      projected.set(v.x, v.y + 0.9, v.z);
      const distance = projected.distanceTo(cam.position);
      if (distance >= 42) continue;
      projected.project(cam);
      if (projected.z > -1 && projected.z < 1 && Math.abs(projected.x) < 1.15 && Math.abs(projected.y) < 1.2)
        return true;
    }
    return false;
  }
  function visitorStatus(person) {
    const v = person.v,
      stop = v.stop;
    return {
      id: v.id,
      active: v.active,
      visible: person.group.visible,
      activity: v.phase === 'dwell' ? stop?.kind || 'idle' : v.speed > 0.05 ? 'walk' : 'idle',
      station: stop?.station ?? -1,
      slot: stop?.spot?.slot ?? -1,
      gesture: v.phase === 'dwell' ? stop?.gesture || 'none' : 'none',
      progress: v.p,
      lane: v.lane,
      position: person.group.position.toArray(),
      heading: v.yaw,
      speed: v.speed,
      alpha: v.alpha,
      scale: v.scale,
      kit: v.kit,
      direction: v.dir,
      metresTravelled: v.travelled,
      stops: v.stops,
      waiting: v.wait || null
    };
  }
  function status() {
    const first = people[0],
      v = crowd.visitors[0],
      list = people.map(visitorStatus),
      visible = list.filter(p => p.active && p.visible);
    // While idle, the first visitor's speed tells walking from standing.
    let shownPhase = phase;
    if (phase === 'idle' && v) shownPhase = v.speed > 0.05 ? 'walk' : 'idle';
    return {
      loaded: !!source,
      phase: shownPhase,
      progress: v ? v.p : 0,
      position: first ? first.group.position.toArray() : holder.position.toArray(),
      heading: v ? v.yaw : 0,
      triangles,
      materials: 1,
      textureMaps: 0,
      strideLength,
      metresTravelled: v ? v.travelled : 0,
      error,
      activity: list[0]?.activity || 'none',
      count: crowd.active,
      capacity,
      economy,
      visible: visible.length,
      trianglesVisible: visible.reduce(
        (n, p) =>
          n + triangles + (propTriangles[p.kit] || 0) + (p.kit === 'camera' ? propTriangles.strap || 0 : 0),
        0
      ),
      skinnedMeshes: visible.length,
      props: visible.filter(p => p.kit !== 'none').length,
      materialsTotal: people.length + (propMaterial ? 1 : 0),
      focus: crowd.focus,
      mode: crowd.mode,
      visitors: list
    };
  }
  function audit() {
    const joints = [];
    people[0]?.model.traverse(o => {
      if (o.isBone && ['Head', 'foot_l', 'foot_r', 'hand_l', 'hand_r'].includes(o.name))
        joints.push({ name: o.name, position: o.getWorldPosition(new THREE.Vector3()).toArray() });
    });
    const spots = crowd.spots.map(list =>
      list.map(s => ({
        station: s.station,
        slot: s.slot,
        p: s.p,
        offset: s.offset,
        owner: s.owner,
        position: [s.position.x, s.position.y, s.position.z],
        yaw: s.yaw
      }))
    );
    return { ...status(), joints, spots };
  }
  function dispose() {
    disposed = true;
    for (const person of people) {
      person.mixer.stopAllAction();
      person.mixer.uncacheRoot(person.model);
      person.mesh.geometry.dispose();
      person.mesh.skeleton?.dispose();
      person.material.dispose();
    }
    for (const geometry of Object.values(props)) geometry.dispose();
    propMaterial?.dispose();
    source?.traverse(o => {
      o.geometry?.dispose();
      o.skeleton?.dispose();
      if (o.material) o.material.dispose();
    });
    if (globalThis.__gardenVisitors?.crowd === crowd) delete globalThis.__gardenVisitors;
    holder.removeFromParent();
  }
  // Captures and audits only (?audit=1): stage or fast-forward the crowd.
  if (typeof location !== 'undefined' && /[?&]audit=1(&|$)/.test(location.search))
    globalThis.__gardenVisitors = {
      crowd,
      stage: (station, n, seconds) => {
        const used = crowd.stage(station, n, seconds);
        invalidate();
        return used;
      },
      warp: seconds => {
        for (let t = 0; t < seconds; t += 0.5) crowd.step(0.5);
        invalidate();
        return status();
      },
      status
    };
  return { update, status, audit, dispose, suspend, needsAnimation, observe, setEconomy };
}
