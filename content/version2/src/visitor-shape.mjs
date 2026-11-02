// Adjustments to the visitor test model, made once on load: real eyes, slimmer trousers and low sneakers. The
// asset's eyes are a single dark-brown colour with no white or pupil, so at a distance a highlight on them read
// as a white pupil; its straight trousers are boxy blocks that widened the legs; its shoes are flat-lidded boxes.
export const EYE = {
  colour: [0.07, 0.04, 0.02],
  sclera: [0.86, 0.84, 0.8],
  iris: [0.16, 0.1, 0.06],
  pupil: [0.02, 0.02, 0.02]
};
// Full width at the hips (the shirt hem hangs at 0.94 m and must stay covered), fully slimmed from `full` down.
export const TROUSERS_SLIM = { x: 0.78, z: 0.86, below: 0.88, full: 0.68 };

const near = (r, g, b, c) => Math.abs(r - c[0]) + Math.abs(g - c[1]) + Math.abs(b - c[2]) < 0.03;

// Colours eye vertices by their distance from each eye's front pole: pupil, iris ring, white around it.
export function paintEyes(positions, colors) {
  const eyes = [[], []];
  for (let i = 0; i < colors.count; i++)
    if (near(colors.getX(i), colors.getY(i), colors.getZ(i), EYE.colour))
      eyes[positions.getX(i) < 0 ? 0 : 1].push(i);
  let painted = 0;
  for (const list of eyes) {
    if (!list.length) continue;
    let front = -Infinity,
      cx = 0,
      cy = 0,
      span = 0;
    for (const i of list) {
      cx += positions.getX(i);
      cy += positions.getY(i);
      front = Math.max(front, positions.getZ(i));
    }
    cx /= list.length;
    cy /= list.length;
    for (const i of list) span = Math.max(span, Math.hypot(positions.getX(i) - cx, positions.getY(i) - cy));
    for (const i of list) {
      const r = Math.hypot(positions.getX(i) - cx, positions.getY(i) - cy) / Math.max(span, 1e-6),
        facing = positions.getZ(i) > front - span * 0.9;
      const c = !facing || r > 0.62 ? EYE.sclera : r > 0.28 ? EYE.iris : EYE.pupil;
      colors.setXYZ(i, c[0], c[1], c[2]);
      painted++;
    }
  }
  colors.needsUpdate = true;
  return painted;
}

// Pulls each trouser leg toward its own axis (by side of the body), leaving the waist and shoes untouched.
export function slimTrousers(positions, colors, trousers) {
  const legs = [
    { n: 0, x: 0, z: 0 },
    { n: 0, x: 0, z: 0 }
  ];
  const picked = [];
  for (let i = 0; i < colors.count; i++) {
    if (!near(colors.getX(i), colors.getY(i), colors.getZ(i), trousers)) continue;
    if (positions.getY(i) > TROUSERS_SLIM.below) continue;
    const leg = legs[positions.getX(i) < 0 ? 0 : 1];
    leg.n++;
    leg.x += positions.getX(i);
    leg.z += positions.getZ(i);
    picked.push(i);
  }
  for (const leg of legs) {
    leg.x /= Math.max(1, leg.n);
    leg.z /= Math.max(1, leg.n);
  }
  for (const i of picked) {
    const leg = legs[positions.getX(i) < 0 ? 0 : 1];
    const w = Math.min(
        1,
        (TROUSERS_SLIM.below - positions.getY(i)) / (TROUSERS_SLIM.below - TROUSERS_SLIM.full)
      ),
      sx = 1 + (TROUSERS_SLIM.x - 1) * w,
      sz = 1 + (TROUSERS_SLIM.z - 1) * w;
    positions.setX(i, leg.x + (positions.getX(i) - leg.x) * sx);
    positions.setZ(i, leg.z + (positions.getZ(i) - leg.z) * sz);
  }
  positions.needsUpdate = true;
  return picked.length;
}

// The shirt was modelled over a superhero body: sharp chest and arm muscles and a saw-tooth hem. Taubin smoothing
// (a shrink step then an inflate step, so the shirt keeps its size) evens the cloth over the muscles and the hem.
export const SHIRT_SMOOTH = { passes: 8, lambda: 0.5, mu: -0.53, rimPasses: 24 };
// Rim passes move each open-edge vertex only along its loop's axis (hem and sleeve ends: up and down), never
// toward the loop's centre, so the saw-tooth straightens (skin spikes poked through it) and the opening keeps
// its size (smoothing the rim in 3D shrank the sleeves, 2026-10-25).
export function smoothShirt(geometry, cloth) {
  const positions = geometry.attributes.position,
    colors = geometry.attributes.color,
    index = geometry.index;
  const isCloth = i => cloth.some(c => near(colors.getX(i), colors.getY(i), colors.getZ(i), c));
  // Vertices that share a position (UV or colour seams) move together.
  const key = i => [positions.getX(i), positions.getY(i), positions.getZ(i)].map(v => v.toFixed(4)).join();
  const groups = new Map(),
    home = new Map(); // each vertex's group key at load: positions move, so key(i) no longer finds it later
  for (let i = 0; i < positions.count; i++) {
    if (!isCloth(i)) continue;
    const k = key(i);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(i);
    home.set(i, k);
  }
  const lead = new Map();
  for (const list of groups.values()) for (const i of list) lead.set(i, list[0]);
  const neighbours = new Map();
  for (let t = 0; t < index.count; t += 3) {
    const tri = [index.getX(t), index.getX(t + 1), index.getX(t + 2)];
    for (let a = 0; a < 3; a++) {
      const i = lead.get(tri[a]);
      if (i === undefined) continue;
      if (!neighbours.has(i)) neighbours.set(i, new Set());
      for (let b = 0; b < 3; b++) {
        const j = lead.get(tri[b]) ?? tri[b];
        if (j !== i) neighbours.get(i).add(j);
      }
    }
  }
  const step = factor => {
    const moves = [];
    for (const [i, set] of neighbours) {
      let x = 0,
        y = 0,
        z = 0;
      for (const j of set) {
        x += positions.getX(j);
        y += positions.getY(j);
        z += positions.getZ(j);
      }
      const n = set.size;
      moves.push([
        i,
        (x / n - positions.getX(i)) * factor,
        (y / n - positions.getY(i)) * factor,
        (z / n - positions.getZ(i)) * factor
      ]);
    }
    for (const [i, dx, dy, dz] of moves)
      for (const j of groups.get(home.get(i)) || [i])
        positions.setXYZ(j, positions.getX(j) + dx, positions.getY(j) + dy, positions.getZ(j) + dz);
  };
  for (let p = 0; p < SHIRT_SMOOTH.passes; p++) {
    step(SHIRT_SMOOTH.lambda);
    step(SHIRT_SMOOTH.mu);
  }
  // Open edges (hem, sleeve ends, neckline) are smoothed along the edge itself, which straightens the saw-tooth.
  for (const { ring, axis } of openLoops(positions, openEdges(index, lead))) {
    const at = i => positions.getX(i) * axis[0] + positions.getY(i) * axis[1] + positions.getZ(i) * axis[2];
    for (let p = 0; p < SHIRT_SMOOTH.rimPasses; p++) {
      const h = ring.map(at),
        moves = ring.map((i, k) => {
          const d = ((h[(k + ring.length - 1) % ring.length] + h[(k + 1) % ring.length]) / 2 - h[k]) * 0.5;
          return d;
        });
      ring.forEach((i, k) => {
        for (const j of groups.get(home.get(i)) || [i])
          positions.setXYZ(
            j,
            positions.getX(j) + axis[0] * moves[k],
            positions.getY(j) + axis[1] * moves[k],
            positions.getZ(j) + axis[2] * moves[k]
          );
      });
    }
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  return neighbours.size;
}

// Open edges (used by one triangle only) of the triangles whose three vertices all have a lead (vertices merged
// by position): each lead on an open edge with its neighbours along it.
function openEdges(index, lead) {
  const edgeCount = new Map(),
    edgeKey = (i, j) => (i < j ? i + ':' + j : j + ':' + i);
  for (let t = 0; t < index.count; t += 3) {
    const tri = [index.getX(t), index.getX(t + 1), index.getX(t + 2)].map(i => lead.get(i));
    if (tri.some(i => i === undefined)) continue;
    for (let a = 0; a < 3; a++) {
      const k = edgeKey(tri[a], tri[(a + 1) % 3]);
      edgeCount.set(k, (edgeCount.get(k) || 0) + 1);
    }
  }
  const rim = new Map();
  for (const [k, n] of edgeCount) {
    if (n !== 1) continue;
    const [i, j] = k.split(':').map(Number);
    if (!rim.has(i)) rim.set(i, []);
    if (!rim.has(j)) rim.set(j, []);
    rim.get(i).push(j);
    rim.get(j).push(i);
  }
  return rim;
}
// Rim loops: each open edge's vertices in order, with the loop's axis (Newell normal). Loops that do not close
// cleanly, or have fewer than 6 vertices, are left out.
function openLoops(positions, rim) {
  const seen = new Set(),
    loops = [];
  for (const start of rim.keys()) {
    if (seen.has(start)) continue;
    const ring = [start];
    seen.add(start);
    let prev = -1,
      cur = start;
    for (;;) {
      const next = rim.get(cur).find(j => j !== prev && !seen.has(j));
      if (next === undefined) break;
      ring.push(next);
      seen.add(next);
      prev = cur;
      cur = next;
    }
    if (ring.length < 6 || ring.some(i => rim.get(i).length !== 2)) continue;
    const n = [0, 0, 0];
    for (let k = 0; k < ring.length; k++) {
      const i = ring[k],
        j = ring[(k + 1) % ring.length];
      const [x1, y1, z1] = [positions.getX(i), positions.getY(i), positions.getZ(i)],
        [x2, y2, z2] = [positions.getX(j), positions.getY(j), positions.getZ(j)];
      n[0] += (y1 - y2) * (z1 + z2);
      n[1] += (z1 - z2) * (x1 + x2);
      n[2] += (x1 - x2) * (y1 + y2);
    }
    const l = Math.hypot(...n) || 1;
    loops.push({ ring, axis: n.map(c => c / l) });
  }
  return loops;
}

// The hair is weighted to the head alone, the scalp under it partly to the neck too (Head 0.6-0.8): when the head
// bowed over a phone the scalp lagged behind the hair and came through it in ragged patches at the back of the head
// (owner, round 17). Every skin vertex under the hair (within `reach` behind the nearest hair vertex's surface)
// takes that hair vertex's weights, so scalp and hair move as one, and sits `inset` further in. Returns the count.
export const HAIR = { colour: [0.041, 0.027, 0.04], reach: 0.025, inset: 0.002 };
// Of the vertices `from`, the nearest to vertex i within `reach` (-1: none).
function nearestOf(P, i, from, reach) {
  const x = P.getX(i),
    y = P.getY(i),
    z = P.getZ(i);
  let best = -1,
    d2 = reach * reach;
  for (const j of from) {
    const e = (P.getX(j) - x) ** 2 + (P.getY(j) - y) ** 2 + (P.getZ(j) - z) ** 2;
    if (e < d2) {
      d2 = e;
      best = j;
    }
  }
  return best;
}
export function bindScalpToHair(geometry, hair = HAIR.colour) {
  const P = geometry.attributes.position,
    C = geometry.attributes.color,
    { skinIndex, skinWeight } = geometry.attributes,
    isHair = i => near(C.getX(i), C.getY(i), C.getZ(i), hair),
    // Skin: warm and light (the GLB's skin tones), not the eyes, the hair or the clothes.
    isSkin = i => C.getX(i) > 0.4 && C.getX(i) > C.getZ(i) + 0.2;
  geometry.computeVertexNormals();
  const N = geometry.attributes.normal,
    strands = [];
  for (let i = 0; i < P.count; i++) if (isHair(i)) strands.push(i);
  const under = [];
  for (let i = 0; i < P.count; i++) {
    const best = isSkin(i) ? nearestOf(P, i, strands, HAIR.reach) : -1;
    if (best < 0) continue;
    const behind =
      N.getX(best) * (P.getX(i) - P.getX(best)) +
      N.getY(best) * (P.getY(i) - P.getY(best)) +
      N.getZ(best) * (P.getZ(i) - P.getZ(best));
    if (behind < 0) under.push([i, best]);
  }
  for (const [i, j] of under) {
    skinIndex.setXYZW(i, skinIndex.getX(j), skinIndex.getY(j), skinIndex.getZ(j), skinIndex.getW(j));
    skinWeight.setXYZW(i, skinWeight.getX(j), skinWeight.getY(j), skinWeight.getZ(j), skinWeight.getW(j));
    P.setXYZ(
      i,
      P.getX(i) - N.getX(j) * HAIR.inset,
      P.getY(i) - N.getY(j) * HAIR.inset,
      P.getZ(i) - N.getZ(j) * HAIR.inset
    );
  }
  skinIndex.needsUpdate = skinWeight.needsUpdate = P.needsUpdate = true;
  geometry.computeVertexNormals();
  return under.length;
}

// The arm's skin ends inside the sleeve with an open, saw-toothed edge, and its teeth reached 3 cm below the
// sleeve's hem: between them the hollow arm showed the shirt's inside. With an arm raised (a phone or a notebook
// held up) the eye looks up the sleeve and saw it torn (owner, round 13). Each tooth moves up the arm, along it
// only, to `inside` metres above the hem, so the edge runs straight under the cloth. Returns the vertices moved.
export const ARM_EDGE = { inside: 0.03, reach: 0.1 };
export function fitArmsInSleeves(geometry, cloth) {
  const P = geometry.attributes.position,
    { clothLead, bodyLead, group } = weldByPosition(geometry, cloth),
    bodyRim = [...openEdges(geometry.index, bodyLead).keys()],
    at = i => [P.getX(i), P.getY(i), P.getZ(i)];
  let moved = 0;
  for (const { centre, down } of sleeveHems(P, openLoops(P, openEdges(geometry.index, clothLead))))
    for (const i of bodyRim) {
      const d = at(i).map((v, c) => v - centre[c]),
        shift = -ARM_EDGE.inside - (d[0] * down[0] + d[1] * down[1] + d[2] * down[2]);
      if (Math.hypot(...d) > ARM_EDGE.reach || shift >= 0) continue;
      for (const j of group.get(i)) P.setXYZ(j, ...at(j).map((v, c) => v + down[c] * shift));
      moved++;
    }
  P.needsUpdate = true;
  geometry.computeVertexNormals();
  return moved;
}
// Vertices merged by position, separately for the cloth and for the body: each one's lead (the first at its
// place) and every lead's group (all the vertices at its place, which move together).
function weldByPosition(geometry, cloth) {
  const P = geometry.attributes.position,
    C = geometry.attributes.color,
    clothLead = new Map(),
    bodyLead = new Map(),
    first = new Map(),
    group = new Map();
  for (let i = 0; i < P.count; i++) {
    const isCloth = cloth.some(c => near(C.getX(i), C.getY(i), C.getZ(i), c)),
      k = (isCloth ? 'c' : 'b') + [P.getX(i), P.getY(i), P.getZ(i)].map(v => v.toFixed(4)).join();
    if (!first.has(k)) first.set(k, i);
    const lead = first.get(k);
    (isCloth ? clothLead : bodyLead).set(i, lead);
    if (!group.has(lead)) group.set(lead, []);
    group.get(lead).push(i);
  }
  return { clothLead, bodyLead, group };
}
// Each sleeve's hem: of the cloth loops across an arm (centre out to the side, axis along x), the furthest out on
// each side; its centre and its axis turned to point down the arm.
function sleeveHems(P, loops) {
  const arms = loops
    .map(({ ring, axis }) => ({
      axis,
      centre: [0, 1, 2].map(c => ring.reduce((a, i) => a + P.getComponent(i, c), 0) / ring.length)
    }))
    .filter(l => Math.abs(l.centre[0]) > 0.15 && Math.abs(l.axis[0]) > 0.5);
  return [-1, 1]
    .map(
      side =>
        arms
          .filter(l => Math.sign(l.centre[0]) === side)
          .sort((a, b) => side * (b.centre[0] - a.centre[0]))[0]
    )
    .filter(Boolean)
    .map(({ centre, axis }) => ({
      centre,
      down: axis.map(c => c * Math.sign(axis[0]) * Math.sign(centre[0]))
    }));
}

// The trouser waist was wider than the shirt hem and showed through it. Above the hem the trousers are pulled in
// toward the body so they stay hidden under the shirt.
export const TROUSERS_TUCK = { hem: 0.94, top: 1.02, inward: 0.82 };
export function tuckTrousers(positions, colors, trousers) {
  let cz = 0,
    n = 0;
  for (let i = 0; i < colors.count; i++)
    if (
      near(colors.getX(i), colors.getY(i), colors.getZ(i), trousers) &&
      positions.getY(i) > TROUSERS_TUCK.hem - 0.1
    ) {
      cz += positions.getZ(i);
      n++;
    }
  cz /= Math.max(1, n);
  let moved = 0;
  for (let i = 0; i < colors.count; i++) {
    const y = positions.getY(i);
    if (!near(colors.getX(i), colors.getY(i), colors.getZ(i), trousers) || y <= TROUSERS_TUCK.hem - 0.04)
      continue;
    const w = Math.min(1, (y - (TROUSERS_TUCK.hem - 0.04)) / 0.06),
      s = 1 + (TROUSERS_TUCK.inward - 1) * w;
    positions.setX(i, positions.getX(i) * s);
    positions.setZ(i, cz + (positions.getZ(i) - cz) * s);
    moved++;
  }
  positions.needsUpdate = true;
  return moved;
}

// Each shoe in the asset is two stacked, closed ten-sided prisms skinned only to foot_l / foot_r: a light sole
// 2.8 cm thick and a dark upper whose flat lid runs the whole foot at the trouser hem (12 cm). Around the slim
// trouser leg that lid showed as a plateau on a thick light base: an iron, not a shoe (owner, 2026-10-25).
// Only positions move (skin, colours and topology stay): every ring vertex keeps its slot (heel, heel corner,
// waist, ball, toe corner, tip; one per side) and goes onto a sneaker: rounded heel and toe, a waist narrower
// on the arch side, a 1-1.4 cm sole with toe spring, a vamp sloping from the trouser hem to a low toe box, and
// a collar 3 mm under the hem so the trousers hang onto the shoe. Mesh metres (before the 0.87/1/0.96 root).
export const SHOE_SOURCE = { upper: [0.1, 0.127, 0.178], sole: [0.723, 0.687, 0.61] };
export const SHOE = {
  // Sole outline at its top edge; dx from the shoe's axis, positive outward, [lateral, medial] pairs.
  heel: { z: -0.134 },
  heelCorner: { z: -0.113, dx: [0.044, 0.044] },
  waist: { z: -0.045, dx: [0.057, 0.053] },
  ball: { z: [0.06, 0.07], dx: [0.063, 0.062] },
  toeCorner: { z: [0.145, 0.153], dx: [0.044, 0.047] },
  tip: { z: 0.17, dx: -0.009 },
  ground: 0.008,
  // Sole bottom lift (toe spring, a rounded heel) and thickness per station.
  lift: { heel: 0.003, heelCorner: 0.001, waist: 0, ball: 0, toeCorner: 0.004, tip: 0.008 },
  thick: { heel: 0.014, heelCorner: 0.014, waist: 0.013, ball: 0.011, toeCorner: 0.01, tip: 0.01 },
  bevel: 0.0025, // softened bottom edge
  welt: 0.003, // the upper starts this far inside the sole's edge
  overlap: 0.0005, // and this far below its top
  // Toe box and vamp: tops lean in by `inset`, drop to `y`, and `back` rounds the toe in side view.
  vamp: {
    ball: { y: 0.068, inset: 0.012, back: 0 },
    toeCorner: { y: 0.052, inset: 0.012, back: 0.01 },
    tip: { y: 0.048, inset: 0.004, back: 0.016 }
  },
  // Collar on the hem ellipse scaled by `fit` (its chords sag ~3 mm inside), `drop` below it; angles from the
  // back of the hem, the throat (top cap centre) at 180.
  collar: { fit: 1.04, drop: 0.003, heelCorner: 50, waist: 112 },
  // The hem after slimTrousers, used when no trouser colour is given.
  hem: { dz: -0.0578, hx: 0.0507, hz: 0.0613, y: 0.12 }
};
const STATION_T = [
  ['heelCorner', 0.096],
  ['waist', 0.346],
  ['ball', 0.654],
  ['toeCorner', 0.904]
];
const apply4 = (m, p) => {
  const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
  return [0, 1, 2].map(r => (m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r]) / w);
};

// Ring order: heel, the lateral side to the tip, the medial side back; with inward normals for insets.
export function shoeOutline(side) {
  const pick = (v, lateral) => (Array.isArray(v) ? v[lateral ? 0 : 1] : v),
    pts = [{ k: 'heel', lat: true, dx: 0, z: SHOE.heel.z }];
  for (const lateral of [true, false]) {
    const list = ['heelCorner', 'waist', 'ball', 'toeCorner'].map(k => ({
      k,
      lat: lateral,
      dx: (lateral ? 1 : -1) * pick(SHOE[k].dx, lateral),
      z: pick(SHOE[k].z, lateral)
    }));
    if (lateral) pts.push(...list, { k: 'tip', lat: true, dx: SHOE.tip.dx, z: SHOE.tip.z });
    else pts.push(...list.reverse());
  }
  // Lateral is away from the body midline: +x on the left shoe, -x on the right.
  for (const p of pts) p.x = p.dx * side;
  const n = pts.length;
  let area = 0;
  for (let i = 0; i < n; i++) area += pts[i].x * pts[(i + 1) % n].z - pts[(i + 1) % n].x * pts[i].z;
  const turn = area > 0 ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const a = pts[(i + n - 1) % n],
      b = pts[i],
      c = pts[(i + 1) % n],
      l1 = Math.hypot(b.x - a.x, b.z - a.z),
      l2 = Math.hypot(c.x - b.x, c.z - b.z),
      nx = (-(b.z - a.z) / l1 - (c.z - b.z) / l2) * turn,
      nz = ((b.x - a.x) / l1 + (c.x - b.x) / l2) * turn,
      l = Math.hypot(nx, nz);
    b.nx = nx / l;
    b.nz = nz / l;
  }
  return pts;
}

// Fits the shoes to a low sneaker; returns the number of vertices moved (0 if the shoes are not the asset's
// prisms, e.g. already reshaped). Call after slimTrousers/tuckTrousers (the collar follows the trouser hem)
// and before the normals are recomputed. `hemToShoe` ({ 1: left, -1: right }, column-major 4x4 such as
// THREE.Matrix4.elements) carries a hem point into the shoe's bind frame for the pose the collar should fit
// (the standing Idle: foot skin transform inverted times the calf's); without it the bind pose is fitted.
export function shapeShoes(positions, colors, trousers = null, hemToShoe = null) {
  const shoes = new Map();
  for (let i = 0; i < colors.count; i++) {
    const r = colors.getX(i),
      g = colors.getY(i),
      b = colors.getZ(i);
    let band = null;
    if (near(r, g, b, SHOE_SOURCE.upper)) band = 'upper';
    else if (near(r, g, b, SHOE_SOURCE.sole)) band = 'sole';
    if (!band) continue;
    const side = positions.getX(i) < 0 ? -1 : 1;
    if (!shoes.has(side)) shoes.set(side, { upper: [], sole: [] });
    shoes.get(side)[band].push(i);
  }
  let moved = 0;
  for (const [side, bands] of shoes) {
    const slotted = slotShoe(positions, bands, side);
    if (!slotted) continue;
    const hem = trouserHem(positions, colors, trousers, side, slotted.axis),
      place = shoePlacer(side, slotted.axis, hem, hemToShoe?.[side] || null);
    for (const slot of slotted.slots) {
      const p = place(slot);
      positions.setXYZ(slot.i, p[0], p[1], p[2]);
      moved++;
    }
  }
  positions.needsUpdate = true;
  return moved;
}
const box = (positions, list) => {
  const b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity };
  for (const i of list) {
    b.x0 = Math.min(b.x0, positions.getX(i));
    b.x1 = Math.max(b.x1, positions.getX(i));
    b.y0 = Math.min(b.y0, positions.getY(i));
    b.y1 = Math.max(b.y1, positions.getY(i));
    b.z0 = Math.min(b.z0, positions.getZ(i));
    b.z1 = Math.max(b.z1, positions.getZ(i));
  }
  return b;
};
// Slots every vertex of one shoe by its place in its own band's box; null if anything does not fit (not the
// asset's prisms, or already reshaped), so the shoe is left alone.
function slotShoe(positions, bands, side) {
  if (!bands.upper.length || !bands.sole.length) return null;
  const slots = [];
  let axis = 0;
  for (const band of ['sole', 'upper']) {
    const list = bands[band],
      b = box(positions, list),
      cx = (b.x0 + b.x1) / 2,
      hw = (b.x1 - b.x0) / 2;
    if (band === 'sole') axis = cx;
    for (const i of list) {
      const s = (positions.getX(i) - cx) / hw,
        t = (positions.getZ(i) - b.z0) / (b.z1 - b.z0),
        top = positions.getY(i) > (b.y0 + b.y1) / 2;
      let k = null,
        lat = true;
      if (Math.abs(s) < 0.1) {
        if (t < 0.05) k = 'heel';
        else if (t > 0.95) k = 'tip';
        else if (t > 0.2 && t < 0.8) k = 'centre';
      } else {
        const [name, ct] = STATION_T.reduce(
          (a, c) => (Math.abs(c[1] - t) < Math.abs(a[1] - t) ? c : a),
          STATION_T[0]
        );
        if (Math.abs(ct - t) < 0.06) k = name;
        lat = Math.sign(s) === side;
      }
      if (!k) return null;
      slots.push({ i, band, k, lat, top });
    }
  }
  return { slots, axis };
}
// This side's trouser hem (its lowest ring), or the measured default.
function trouserHem(positions, colors, trousers, side, axis) {
  const fallback = { x: axis, z: SHOE.hem.dz, hx: SHOE.hem.hx, hz: SHOE.hem.hz, y: SHOE.hem.y };
  if (!trousers) return fallback;
  const leg = [];
  let lowest = Infinity;
  for (let i = 0; i < colors.count; i++)
    if (
      near(colors.getX(i), colors.getY(i), colors.getZ(i), trousers) &&
      Math.sign(positions.getX(i)) === side
    ) {
      leg.push(i);
      lowest = Math.min(lowest, positions.getY(i));
    }
  const ring = leg.filter(i => positions.getY(i) <= lowest + 0.005);
  if (ring.length < 6 || lowest >= 0.3) return fallback;
  const b = box(positions, ring);
  return {
    x: (b.x0 + b.x1) / 2,
    z: (b.z0 + b.z1) / 2,
    hx: (b.x1 - b.x0) / 2,
    hz: (b.z1 - b.z0) / 2,
    y: lowest
  };
}
// Where each slot goes on the sneaker.
function shoePlacer(side, axis, hem, toShoe) {
  const ring = shoeOutline(side),
    at = (k, lat) => ring.find(p => p.k === k && (k === 'heel' || k === 'tip' || p.lat === lat)),
    C = SHOE.collar,
    midZ = (SHOE.heel.z + SHOE.tip.z) / 2;
  const collarPoint = (deg, lat) => {
    const a = (deg * Math.PI) / 180,
      p = [
        hem.x + (lat ? side : -side) * hem.hx * C.fit * Math.sin(a),
        hem.y - C.drop,
        hem.z - hem.hz * C.fit * Math.cos(a)
      ];
    return toShoe ? apply4(toShoe, p) : p;
  };
  return ({ band, k, lat, top }) => {
    if (k === 'centre') {
      // Cap centres: the sole's on the ground and its top; the upper's bottom inside the shoe and its top
      // (the vamp's peak) at the front of the collar.
      if (band === 'sole') return [axis, top ? SHOE.ground + SHOE.thick.waist : SHOE.ground, midZ];
      return top ? collarPoint(180, true) : [axis, SHOE.ground + SHOE.thick.waist - SHOE.overlap, midZ];
    }
    const o = at(k, lat),
      lift = SHOE.lift[k],
      soleTop = SHOE.ground + lift + SHOE.thick[k],
      inset = d => [axis + o.x + o.nx * d, o.z + o.nz * d];
    if (band === 'sole') {
      const [x, z] = inset(top ? 0 : SHOE.bevel);
      return [x, top ? soleTop : SHOE.ground + lift, z];
    }
    if (!top) {
      const [x, z] = inset(SHOE.welt);
      return [x, soleTop - SHOE.overlap, z];
    }
    const v = SHOE.vamp[k];
    if (!v) return collarPoint(k === 'heel' ? 0 : C[k], lat);
    const [x, z] = inset(SHOE.welt + v.inset);
    return [x, v.y, z - v.back];
  };
}
