// East Asian shells for the project houses (owner, round 5: "уйди от тепличных зданий", a Japanese or Chinese
// hall as one idea). The house's content (screen on its easel, exhibits, boards, plants, lamps: greenhouse.mjs)
// stays where it is; this builds the building round it on the same footprint, in one of three styles by how much
// the project has to show (building-variants.mjs):
//   temple   - a Chinese hall on a stone podium: red lacquered columns, lattice doors, a painted frieze and a
//              double roof (a skirt roof round the walls, the main hip roof above) with upturned corners and a gold
//              ridge;
//   dojo     - a Japanese hall: dark timber frame, white plaster below and shoji above, a heavy tiled hip roof with
//              lifted corners and a noren curtain in the project's colour over the door;
//   pavilion - an open pavilion (no walls): columns, low rails, folding screens behind the side exhibits and the
//              hero, a pyramid roof with strongly upturned corners and a finial.
// Local axes as greenhouse.mjs: -z is the entrance, floor at GREENHOUSE.floor.
import { paintContext } from './paint-canvas.mjs';

// Heights (m, local) and overhangs per style. wall: top of columns and walls (the eave beam); edge: the roof's
// eave line at mid-front (corners lift by `lift`); ridge: the main ridge; sign: the name plaque under the eave.
export const EAST = {
  temple: {
    wall: 4.8,
    edge: 4.65,
    ridge: 7.9,
    over: 1.0,
    lift: 0.5,
    ridgeHalf: 1.6,
    upper: { wall: 6.2, edge: 6.05, inset: 1.15, over: 0.85 }
  },
  dojo: { wall: 4.8, edge: 4.6, ridge: 7.1, over: 0.95, lift: 0.38, ridgeHalf: 1.2 },
  pavilion: { wall: 4.4, edge: 4.25, ridge: 6.9, over: 1.05, lift: 0.62, ridgeHalf: 0 },
  // The name plaque (the sign texture's 5.2 : 1, on a board 0.1 larger) hangs between the door columns, its board
  // 1.5 cm under the front beam and in front of the door head; z: the plaque's plane (the board 4 cm behind it).
  sign: { width: 2.34, height: 0.45, z: -1.75 }
};
// Roof tiles per dojo, picked by the project so neighbouring dojos differ: charcoal, slate blue, copper green, umber.
const DOJO_TILES = [0x3b3d44, 0x34465c, 0x4f7a68, 0x5a4234];

// Tiles (rows of half-round tiles running down the slope) or shoji (paper in a timber lattice) as a canvas texture.
function canvasTexture(THREE, draw) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const c = paintContext(canvas);
  if (!c) return null;
  draw(c, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}
const drawTiles = (c, n) => {
  c.fillStyle = '#6d6d6d';
  c.fillRect(0, 0, n, n);
  const columns = 4;
  for (let k = 0; k < columns; k++) {
    const x = (k * n) / columns,
      w = n / columns,
      round = c.createLinearGradient(x, 0, x + w, 0);
    round.addColorStop(0, '#5a5a5a');
    round.addColorStop(0.45, '#d0d0d0');
    round.addColorStop(1, '#4c4c4c');
    c.fillStyle = round;
    c.fillRect(x + 2, 0, w - 4, n);
  }
  // Courses: the lower lip of each tile row casts a thin shadow.
  for (let y = 0; y < n; y += n / 4) {
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.fillRect(0, y, n, 5);
    c.fillStyle = 'rgba(255,255,255,0.12)';
    c.fillRect(0, y + 5, n, 3);
  }
};
const drawShoji = (c, n) => {
  c.fillStyle = '#f4ecdc';
  c.fillRect(0, 0, n, n);
  c.fillStyle = '#4a3324';
  const bar = 7;
  for (let k = 0; k <= 4; k++) c.fillRect((k * n) / 4 - bar / 2, 0, bar, n);
  for (let k = 0; k <= 6; k++) c.fillRect(0, (k * n) / 6 - bar / 2, n, bar);
};
const drawLattice = (c, n) => {
  // Temple doors: a dense diagonal lattice of red-brown timber over warm paper.
  c.fillStyle = '#e8d6b0';
  c.fillRect(0, 0, n, n);
  c.strokeStyle = '#6b2a1c';
  c.lineWidth = 6;
  for (let k = -n; k <= 2 * n; k += n / 6) {
    c.beginPath();
    c.moveTo(k, 0);
    c.lineTo(k + n, n);
    c.moveTo(k + n, 0);
    c.lineTo(k, n);
    c.stroke();
  }
};
const drawFrieze = (c, n) => {
  // The painted beam band under the eaves: blue-green fields with gold edging and a repeating flower medallion.
  c.fillStyle = '#1f5a5e';
  c.fillRect(0, 0, n, n);
  c.fillStyle = '#c8a24a';
  c.fillRect(0, 0, n, 14);
  c.fillRect(0, n - 14, n, 14);
  c.fillStyle = '#2f7a6e';
  c.fillRect(10, 24, n - 20, n - 48);
  c.fillStyle = '#c8a24a';
  c.beginPath();
  c.arc(n / 2, n / 2, n * 0.18, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#9c2a22';
  c.beginPath();
  c.arc(n / 2, n / 2, n * 0.09, 0, Math.PI * 2);
  c.fill();
};

// Materials shared by every house in a world (the world bakes by material, so all houses draw in few calls).
export function createEastMaterials(THREE, resources) {
  const own = m => (resources.add(m), m),
    textures = {
      tiles: canvasTexture(THREE, drawTiles),
      shoji: canvasTexture(THREE, drawShoji),
      lattice: canvasTexture(THREE, drawLattice),
      frieze: canvasTexture(THREE, drawFrieze)
    };
  for (const t of Object.values(textures)) if (t) resources.add(t);
  const standard = o => own(new THREE.MeshStandardMaterial(o));
  return {
    lacquer: standard({ color: 0x9a2a22, roughness: 0.42, metalness: 0.05 }),
    timber: standard({ color: 0x3a281d, roughness: 0.7 }),
    plaster: standard({ color: 0xe9e2d4, roughness: 0.95 }),
    podium: standard({ color: 0x8f8a82, roughness: 0.9 }),
    gold: standard({ color: 0xd2a43a, roughness: 0.35, metalness: 0.65 }),
    // Front faces only: every shoji and lattice part is a box, its far side is a face of its own (two-sided boxes
    // drew their inner faces into the neighbouring beam and dado).
    shoji: standard({ color: 0xffffff, roughness: 0.85, map: textures.shoji }),
    lattice: standard({ color: 0xffffff, roughness: 0.8, map: textures.lattice }),
    frieze: standard({ color: 0xffffff, roughness: 0.7, map: textures.frieze }),
    // The ceiling faces down, away from the sky and the sun: a little warm bounce from the lit floor keeps the
    // timber from going pitch black by day (round 9).
    ceiling: standard({ color: 0x5a3c29, roughness: 0.8, side: THREE.BackSide, emissive: 0x1c1108 }),
    lantern: own(new THREE.MeshBasicMaterial({ color: 0xff7a4a, toneMapped: false })),
    // Roof tiles: temple grey-green glaze, pavilion dark, and one per dojo tint (DOJO_TILES).
    tiles: [0x4b5a52, 0x2f3236, ...DOJO_TILES].map(color =>
      standard({ color, roughness: 0.78, metalness: 0.04, map: textures.tiles })
    ),
    // Neon strips under the ceiling: shown only in the Neon light style (world.mjs setLightStyle), cyan along the
    // side walls, magenta over the door and along the back (owner, round 9: two lights for the houses).
    neonCyan: own(new THREE.MeshBasicMaterial({ color: 0x5fe2ff, toneMapped: false, visible: false })),
    neonMagenta: own(new THREE.MeshBasicMaterial({ color: 0xe46bff, toneMapped: false, visible: false }))
  };
}

// The roof's sweep: nearly flat at the eave, steep at the ridge.
const sweep = (from, to, u) => from + (to - from) * Math.pow(u, 1.7);

// One face of a hip roof: a grid from its eave edge (`at(s)` gives the eave point and the ridge point at s along it)
// up to the ridge, with texture coordinates in tiles. Adds to `out`; returns the face's eave points.
function roofFace(out, { at, length }, { edge, ridge, lift }, steps) {
  const base = out.positions.length / 3,
    eave = [];
  for (let i = 0; i <= steps; i++) {
    const s = i / steps,
      [[ex, ez], [rx, rz]] = at(s),
      // The corners lift: nothing at mid-edge, all of `lift` at the ends.
      ey = edge + lift * Math.pow(Math.abs(2 * s - 1), 4),
      span = Math.hypot(rx - ex, rz - ez);
    eave.push([ex, ey, ez]);
    for (let j = 0; j <= steps; j++) {
      const u = j / steps;
      out.positions.push(ex + (rx - ex) * u, sweep(ey, ridge, u), ez + (rz - ez) * u);
      out.uvs.push((s * length) / 0.9, (u * span) / 1.1);
    }
  }
  for (let i = 0; i < steps; i++)
    for (let j = 0; j < steps; j++) {
      const a = base + i * (steps + 1) + j,
        b = a + steps + 1;
      out.indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  return eave;
}

// A hip roof with its ridge along x: eave rectangle |x| <= halfX, front..back at `edge` (corners lifted by `lift`),
// rising concavely to a ridge from -ridgeHalf to ridgeHalf at `ridge` above the middle (ridgeHalf 0: a pyramid).
// Returns the tile surface (texture coordinates in tiles), the hip lines (for their ridge tiles) and the eave line.
function hipRoof(THREE, roof, steps = 10) {
  const { halfX, front, back, edge, ridge, ridgeHalf, lift } = roof,
    mid = (front + back) / 2,
    out = { positions: [], uvs: [], indices: [] };
  // Front, back, right and left faces, each laid out to face outwards.
  const faces = [
    {
      at: s => [
        [-halfX + 2 * halfX * s, front],
        [-ridgeHalf + 2 * ridgeHalf * s, mid]
      ],
      length: 2 * halfX
    },
    {
      at: s => [
        [halfX - 2 * halfX * s, back],
        [ridgeHalf - 2 * ridgeHalf * s, mid]
      ],
      length: 2 * halfX
    },
    {
      at: s => [
        [halfX, front + (back - front) * s],
        [ridgeHalf, mid]
      ],
      length: back - front
    },
    {
      at: s => [
        [-halfX, back - (back - front) * s],
        [-ridgeHalf, mid]
      ],
      length: back - front
    }
  ];
  const eaves = faces.map(face => roofFace(out, face, roof, steps)),
    { indices } = out;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out.positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(out.uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  // Flip the whole set if the first normal points down.
  if (g.attributes.normal.getY(0) < 0) {
    for (let k = 0; k < indices.length; k += 3)
      [indices[k + 1], indices[k + 2]] = [indices[k + 2], indices[k + 1]];
    g.setIndex(indices);
    g.computeVertexNormals();
  }
  // Hip lines from each eave corner up to its ridge end.
  const hips = [
    [-halfX, front, -ridgeHalf],
    [halfX, front, ridgeHalf],
    [halfX, back, ridgeHalf],
    [-halfX, back, -ridgeHalf]
  ].map(([x, z, rx]) =>
    Array.from({ length: steps + 1 }, (_, j) => {
      const u = j / steps;
      return new THREE.Vector3(x + (rx - x) * u, sweep(edge + lift, ridge, u) + 0.06, z + (mid - z) * u);
    })
  );
  // The eave all round, in order (front, right side, back, left side), for the fascia.
  const eaveLine = [eaves[0], eaves[2], eaves[1], eaves[3]].flatMap(e => e.slice(0, -1));
  return { geometry: g, hips, eaveLine, mid };
}

// Box texture coordinates in repeats of `tile` metres, face by face (BoxGeometry: +x, -x, +y, -y, +z, -z).
function metricBox(m, tile) {
  const { width: w, height: h, depth: d } = m.geometry.parameters,
    uv = m.geometry.attributes.uv,
    faces = [
      [d, h],
      [d, h],
      [w, d],
      [w, d],
      [w, h],
      [w, h]
    ];
  for (let i = 0; i < uv.count; i++) {
    const [fu, fv] = faces[Math.floor(i / 4)];
    uv.setXY(i, (uv.getX(i) * fu) / tile, (uv.getY(i) * fv) / tile);
  }
  return m;
}

// Column radius per style (dojo posts are square, this is half their side).
const COLUMN_R = { temple: 0.16, pavilion: 0.14, dojo: 0.12 };

// The parts below share one context `k` (made in buildEastShell): THREE, the style and its spec S, the footprint G,
// greenhouse.mjs's `box` and `mesh`, the materials M, and the lists they fill (blockers, winterParts).

// A stone plinth round the walls, columns on stone bases, and beams round the top of the walls.
function shellFrame(k) {
  const { G, S, M, box, temple, pavilion, round } = k,
    { sideX, front, back, floor, door } = G;
  // The curb stands 12 cm over the island's paving (the house floor lies on that paving, so a podium under it
  // would be hidden), open at the door. Every part standing on the floor starts at its own height (curb 3 cm
  // under the paving, column bases 1.5 cm, columns and walls 2 cm up inside them), so no two undersides share a
  // plane: coplanar faces flicker from afar (scripts/zfight.mjs). It runs outside the walls, its inner edge 1 cm
  // inside their inner face (0.02 inside the wall line; level with it, the two faces flickered), so nothing
  // standing in the house (stand legs, the easel's back leg, pots) meets it.
  const curb = (w, d, x, z) => box(w, 0.15, d, x, floor + 0.045, z, M.podium),
    inner = sideX - 0.02;
  for (const s of [-1, 1]) {
    curb(0.3, k.depth + 0.56, s * (sideX + 0.13), k.midZ);
    curb(inner - door.half, 0.3, (s * (inner + door.half)) / 2, front - 0.13);
  }
  curb(inner * 2, 0.3, 0, back + 0.13);
  // Columns: the corners, either side of the door and along the sides (and either side of the back middle bay).
  // Columns stop 4 cm under the beam top, inside the beam, so their tops do not lie in the beam's top face.
  const columnFoot = floor + 0.02,
    columnH = S.wall - 0.04 - columnFoot,
    columnR = COLUMN_R[k.style],
    columns = [
      ...[-1, 1].flatMap(s => [
        [s * sideX, front],
        [s * sideX, back],
        [s * sideX, k.midZ],
        [s * door.half, front]
      ]),
      ...(pavilion
        ? []
        : [
            [-door.half, back],
            [door.half, back]
          ])
    ];
  for (const [x, z] of columns) {
    const c = round
      ? k.cylinder(columnR, columnH, x, columnFoot + columnH / 2, z, k.column)
      : box(columnR * 2, columnH, columnR * 2, x, columnFoot + columnH / 2, z, k.column);
    k.blockers.push(c);
    // A stone base a little wider than the column (wider ones reached the stand legs inside).
    k.cylinder(columnR * 1.35, 0.155, x, floor + 0.0625, z, M.podium, 10);
  }
  // Beams (the painted frieze on the temple).
  const beamMaterial = temple ? M.frieze : M.timber,
    beam = (w, d, x, z) => metricBox(box(w, 0.32, d, x, S.wall - 0.16, z, beamMaterial), 0.32);
  beam(k.width + 0.2, 0.22, 0, front);
  beam(k.width + 0.2, 0.22, 0, back);
  beam(0.22, k.depth + 0.2, -sideX, k.midZ);
  beam(0.22, k.depth + 0.2, sideX, k.midZ);
  // The Neon strips (hidden in the Natural style) along the lower inner edge of the beams, one per bay between the
  // columns: cyan along the sides, magenta along the front and back. Higher up they were buried in the beams.
  const stripY = S.wall - 0.34,
    gap = columnR + 0.04,
    bays = (stops, place) => {
      stops.sort((a, b) => a - b);
      for (let i = 1; i < stops.length; i++) {
        const a = stops[i - 1] + gap,
          b = stops[i] - gap;
        if (b - a > 0.2) place((a + b) / 2, b - a);
      }
    };
  for (const s of [-1, 1]) {
    const stops = columns.filter(([x]) => x === s * sideX).map(([, z]) => z);
    bays(stops, (z, len) => box(0.035, 0.035, len, s * (sideX - 0.13), stripY, z, M.neonCyan));
  }
  for (const [line, d] of [
    [front, 1],
    [back, -1]
  ]) {
    const stops = columns.filter(([, z]) => z === line).map(([x]) => x);
    bays(stops, (x, len) => box(len, 0.035, 0.035, x, stripY, line + d * 0.13, M.neonMagenta));
  }
}

// One wall bay between columns, from (x0, z0) to (x1, z1) along x or z: a solid dado (red lacquer on the temple,
// plaster on the dojo), lattice doors (temple) or shoji (dojo) up to the beam, and a rail at the sill.
function wallFill(k, [x0, z0], [x1, z1], alongX) {
  const { G, M, box, temple } = k,
    { floor } = G,
    len = alongX ? x1 - x0 : z1 - z0,
    cx = (x0 + x1) / 2,
    cz = (z0 + z1) / 2,
    sill = temple ? floor + 0.55 : floor + 1.15,
    top = k.S.wall - 0.32,
    [sx, sz] = alongX ? [len, 0.06] : [0.06, len],
    [dado, screen] = temple ? [M.lacquer, M.lattice] : [M.plaster, M.shoji];
  // The dado stands on the curb (from its top, 12 cm up): their faces never lie side by side in one plane.
  k.blockers.push(box(sx, sill - floor - 0.12, sz, cx, (floor + 0.12 + sill) / 2, cz, dado));
  // One lattice repeat per 0.9 m.
  k.blockers.push(metricBox(box(sx * 0.98, top - sill, sz * 0.98, cx, (sill + top) / 2, cz, screen), 0.9));
  const [rx, rz] = alongX ? [sx, sz + 0.04] : [sx + 0.04, sz];
  box(rx, 0.08, rz, cx, sill, cz, k.column);
}

// Walls of the temple and the dojo: the side and back bays, the front bays beside the door, a transom over it.
function shellWalls(k) {
  const { G, M, box, temple } = k,
    { sideX, front, back, door } = G,
    top = k.S.wall - 0.32;
  for (const s of [-1, 1]) {
    wallFill(k, [s * sideX, front], [s * sideX, k.midZ], false);
    wallFill(k, [s * sideX, k.midZ], [s * sideX, back], false);
    wallFill(
      k,
      [Math.min(s * door.half, s * sideX), front],
      [Math.max(s * door.half, s * sideX), front],
      true
    );
  }
  wallFill(k, [-sideX, back], [-door.half, back], true);
  wallFill(k, [door.half, back], [sideX, back], true);
  wallFill(k, [-door.half, back], [door.half, back], true);
  const transom = temple ? M.frieze : M.plaster;
  metricBox(box(door.half * 2, top - door.top, 0.08, 0, (door.top + top) / 2, front, transom), 0.6);
  box(door.half * 2 + 0.1, 0.12, 0.14, 0, door.top, front, k.column);
}

// A folding screen of shoji in a timber frame, w wide and `height` tall from 40 cm up, turned by ry about its
// centre (x, z).
function foldingScreen(k, x, z, w, ry, height = 2.3) {
  const { M, box } = k,
    { floor } = k.G,
    top = floor + 0.4 + height,
    panel = box(w, height, 0.05, x, floor + 0.4 + height / 2, z, M.shoji, { y: ry }),
    uv = panel.geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / 0.9, (uv.getY(i) * height) / 0.9);
  box(w + 0.08, 0.08, 0.08, x, top + 0.04, z, M.timber, { y: ry });
  for (const s of [-1, 1]) {
    const reach = s * (w / 2 + 0.02);
    box(
      0.06,
      top - floor,
      0.06,
      x + Math.cos(ry) * reach,
      (floor + top) / 2,
      z - Math.sin(ry) * reach,
      M.timber
    );
  }
}

// The open pavilion: low rails along the sides and the back (the front stays open for the walk in), on the curb
// 10 cm outside the column line, and folding screens behind each side exhibit and behind the hero easel, between
// the exhibits and the rails (the side exhibits hang at |x| 3.0, the easel's back leg reaches z 3.87).
function pavilionRails(k) {
  const { G, M, box } = k,
    { sideX, front, back, floor } = G,
    rx = sideX + 0.1,
    rz = back + 0.1;
  for (const [x0, z0, x1, z1] of [
    [-rx, front, -rx, rz],
    [rx, front, rx, rz],
    [-rx, rz, rx, rz]
  ]) {
    const len = Math.hypot(x1 - x0, z1 - z0),
      [sx, sz] = z0 === z1 ? [len, 0.08] : [0.08, len],
      posts = Math.round(len / 0.5);
    box(sx, 0.08, sz, (x0 + x1) / 2, floor + 0.62, (z0 + z1) / 2, M.lacquer);
    for (let p = 0; p <= posts; p++) {
      const t = p / posts;
      box(0.05, 0.6, 0.05, x0 + (x1 - x0) * t, floor + 0.3, z0 + (z1 - z0) * t, M.timber);
    }
  }
  // Round 5 (the wall gallery): the screens carry the content. Behind: one screen across the back between the
  // corner columns (the hero and two frames); on each side: one between the middle and the back column (frames) and
  // one between the front and the middle column (the description or comments panel).
  const height = 2.7,
    clear = 0.25,
    midZ = k.midZ,
    backSpan = midZ + clear,
    frontSpan = front + clear;
  foldingScreen(k, 0, back, (sideX - clear) * 2, 0, height);
  for (const s of [-1, 1]) {
    const x = s * (sideX - 0.01),
      ry = (-s * Math.PI) / 2;
    foldingScreen(k, x, (backSpan + back - clear) / 2, back - clear - backSpan, ry, height);
    foldingScreen(k, x, (frontSpan + midZ - clear) / 2, midZ - clear - frontSpan, ry, height);
  }
}

// Coffered ceiling seen from inside (dark timber); the roof above is drawn from outside only. Returns its height.
function shellCeiling(k) {
  const { G, M, box, width, depth, midZ } = k,
    ceilingY = k.S.wall - 0.02;
  k.mesh(new k.THREE.PlaneGeometry(width, depth).rotateX(-Math.PI / 2), M.ceiling).position.set(
    0,
    ceilingY,
    midZ
  );
  for (let c = 1; c < 5; c++)
    box(0.08, 0.1, depth, -G.sideX + (width * c) / 5, ceilingY - 0.05, midZ, M.timber);
  for (let c = 1; c < 4; c++) box(width, 0.1, 0.08, 0, ceilingY - 0.05, G.front + (depth * c) / 4, M.timber);
  return ceilingY;
}

// One hip roof: tiles from above, timber from below, snow over it in winter, ridge tiles on the hips and a fascia
// along the eaves.
function roofAt(k, edge, halfX, f, b, ridgeY) {
  const { THREE, S, M, mesh, temple } = k,
    roof = hipRoof(THREE, {
      halfX,
      front: f,
      back: b,
      edge,
      ridge: ridgeY,
      ridgeHalf: S.ridgeHalf,
      lift: S.lift
    });
  k.blockers.push(mesh(roof.geometry, k.tiles));
  mesh(roof.geometry, M.ceiling);
  // Winter: a snow blanket 8 cm over the tiles, drawn in a little from the eave so the tile edge still shows.
  if (M.snow) {
    const snow = roof.geometry.clone(),
      p = snow.attributes.position,
      mid = (f + b) / 2;
    for (let i = 0; i < p.count; i++)
      p.setXYZ(i, p.getX(i) * 0.97, p.getY(i) + 0.08, mid + (p.getZ(i) - mid) * 0.97);
    snow.computeVertexNormals();
    k.winterParts.push(mesh(snow, M.snow));
  }
  const hipMaterial = temple ? M.gold : M.timber;
  for (const line of roof.hips)
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(line), 12, 0.07, 6), hipMaterial);
  const eave = new THREE.CatmullRomCurve3(
    roof.eaveLine.map(([x, y, z]) => new THREE.Vector3(x, y - 0.05, z)),
    true
  );
  mesh(new THREE.TubeGeometry(eave, 80, 0.06, 6, true), k.round ? M.lacquer : M.timber);
  return roof;
}

// The main hip roof; on the temple a skirt roof round the walls with an upper storey under the main one.
// Returns the top roof (its ridge carries the ornaments).
function shellRoofs(k, eaves) {
  const { S, M, box, G, depth, midZ } = k;
  if (!k.temple) return roofAt(k, S.edge, eaves.halfX, eaves.front, eaves.back, S.ridge);
  // Skirt roof: from the wall top out over the walls, up to the upper storey wall.
  const U = S.upper;
  roofAt(k, S.edge, eaves.halfX, eaves.front, eaves.back, U.wall - 0.3);
  // Upper storey: a painted band of wall between the roofs, red columns at its corners.
  const uw = (G.sideX - U.inset) * 2,
    ud = depth - 2 * U.inset,
    h = U.wall - S.wall;
  metricBox(box(uw, h, ud, 0, (S.wall + U.wall) / 2, midZ, M.frieze), 0.7);
  for (const [x, z] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1]
  ])
    k.cylinder(0.12, h + 0.1, (x * uw) / 2, (S.wall + U.wall) / 2, midZ + (z * ud) / 2, M.lacquer);
  return roofAt(k, U.edge, uw / 2 + U.over, midZ - ud / 2 - U.over, midZ + ud / 2 + U.over, S.ridge);
}

// The ridge and its end ornaments (horns curling up); a finial on the pavilion's pyramid.
function shellRidge(k, mid) {
  const { S, M, box } = k;
  if (S.ridgeHalf > 0) {
    const material = k.temple ? M.gold : M.timber;
    box(S.ridgeHalf * 2 + 0.3, 0.26, 0.24, 0, S.ridge + 0.1, mid, material);
    for (const s of [-1, 1]) {
      box(0.18, 0.6, 0.2, s * (S.ridgeHalf + 0.12), S.ridge + 0.38, mid, material, { z: -s * 0.35 });
      box(0.12, 0.3, 0.16, s * (S.ridgeHalf + 0.3), S.ridge + 0.7, mid, material, { z: -s * 0.9 });
    }
    return;
  }
  k.cylinder(0.14, 0.3, 0, S.ridge + 0.15, mid, M.gold, 10);
  k.mesh(new k.THREE.SphereGeometry(0.2, 12, 10), M.gold).position.set(0, S.ridge + 0.45, mid);
  k.cylinder(0.04, 0.6, 0, S.ridge + 0.85, mid, M.gold, 6);
}

// Red paper lanterns at the front eave corners (they glow at night; the world lights the lamps). Returns their places.
function shellLanterns(k) {
  const { G, M, box } = k,
    { sideX, front, door } = G,
    lanterns = [];
  for (const s of [-1, 1]) {
    const x = (s * (sideX + door.half)) / 2,
      z = front - 0.2,
      y = k.S.wall - 0.32 - 0.62;
    box(0.02, 0.32, 0.02, x, y + 0.46, z, M.timber);
    const shade = k.mesh(new k.THREE.SphereGeometry(0.22, 12, 10), M.lantern);
    shade.scale.y = 1.35;
    shade.position.set(x, y, z);
    for (const dy of [-0.3, 0.3]) k.cylinder(0.12, 0.05, x, y + dy, z, M.timber, 10);
    lanterns.push({ x, y, z });
  }
  return lanterns;
}

// Dojo: a noren curtain in the project's colour hangs from the door head, split in strips.
function noren(k, material) {
  const { door, front } = k.G,
    w = (door.half * 2) / 4 - 0.04;
  for (let s = 0; s < 4; s++)
    k.box(
      w,
      0.7,
      0.02,
      -door.half + ((s + 0.5) * (door.half * 2)) / 4,
      door.top - 0.35 - 0.06,
      front - 0.08,
      material
    );
}

// The project's name where the garden's overview sees it (owner, round 5: the names on the old roofs were gone; the
// plaque under the eave only reads from the door). The temple carries it like a Chinese hall's name board, on the
// upper storey above the skirt roof; the dojo and the pavilion on the front slope of the roof, `lift` m off the tiles
// (clear of the winter snow). Same texture as the plaque (5.2 : 1). Returns its centre and `tilt`: the board's
// normal turned up from facing the door (-z) toward the sky, in radians.
// 3.6 m wide: about the old roof label's reach from the overview, read at a glance.
export const NAME_BOARD = { width: 3.6, height: 0.69, lift: 0.15, up: 0.3 };
function nameBoard(k, eaves) {
  const { S, temple } = k,
    B = NAME_BOARD,
    mid = (eaves.front + eaves.back) / 2;
  if (temple) {
    const U = S.upper,
      face = k.midZ - (k.depth - 2 * U.inset) / 2,
      skirt = sweep(S.edge, U.wall - 0.3, (face - eaves.front) / (mid - eaves.front));
    return { ...B, x: 0, y: (skirt + U.wall) / 2, z: face - 0.06, tilt: 0 };
  }
  const u = B.up,
    rise = (S.ridge - S.edge) * 1.7 * Math.pow(u, 0.7),
    run = mid - eaves.front,
    slope = Math.atan2(rise, run);
  // The outward normal of the front slope: up and toward the door.
  const ny = Math.cos(slope),
    nz = -Math.sin(slope);
  return {
    ...B,
    x: 0,
    y: sweep(S.edge, S.ridge, u) + ny * B.lift,
    z: eaves.front + run * u + nz * B.lift,
    tilt: Math.PI / 2 - slope
  };
}

// Builds the shell. `box(w, h, d, x, y, z, material, rot)` and `mesh(geometry, material)` come from greenhouse.mjs
// (static, baked by material). Returns blockers, the lamp height, the sign place, the badge anchor, the lanterns,
// the winter-only parts and the materials the lamps should light.
// The eave height at mid-edge (`edge`) raised just enough for the front and back slopes to clear the wall-top beams
// (their outer edge 0.11 m beyond the wall) by 3 cm. The sweep is nearly flat at the eave and the front slope runs
// to the middle of the house, so on the deeper temples and dojos the beam's top showed through the tiles along the
// middle of the front and back (owner, round 12: holes and seams). Shallow houses that already cleared keep theirs.
function clearedEave(S, G) {
  const ridge = S.upper ? S.upper.wall - 0.3 : S.ridge,
    p = Math.pow((S.over - 0.11) / ((G.back - G.front) / 2 + S.over), 1.7);
  return { ...S, edge: Math.max(S.edge, (S.wall + 0.03 - ridge * p) / (1 - p)) };
}

// norenMaterial: the dojo noren's own copy of the accent, so it can dissolve in the doorway (greenhouse.mjs).
export function buildEastShell(
  THREE,
  { style, G, box, mesh, materials: M, accentMaterial, norenMaterial, project }
) {
  const S = clearedEave(EAST[style], G),
    temple = style === 'temple',
    pavilion = style === 'pavilion',
    pick = [...(project.id || 'x')].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7),
    // Temple grey-green glaze, pavilion dark, a dojo's tint by its project.
    tileIndex = { temple: 0, pavilion: 1 }[style] ?? 2 + (pick % DOJO_TILES.length),
    k = {
      THREE,
      style,
      S,
      G,
      M,
      box,
      mesh,
      temple,
      pavilion,
      // Temple and pavilion stand on round red columns, the dojo on square timber posts.
      round: temple || pavilion,
      column: temple || pavilion ? M.lacquer : M.timber,
      tiles: M.tiles[tileIndex],
      width: G.sideX * 2,
      depth: G.back - G.front,
      midZ: (G.front + G.back) / 2,
      blockers: [],
      winterParts: [],
      cylinder: (r, h, x, y, z, material, segments = 12) => {
        const m = mesh(new THREE.CylinderGeometry(r, r * 1.04, h, segments), material);
        m.position.set(x, y, z);
        return m;
      }
    };
  shellFrame(k);
  if (pavilion) pavilionRails(k);
  else shellWalls(k);
  const ceilingY = shellCeiling(k),
    eaves = { halfX: G.sideX + S.over, front: G.front - S.over, back: G.back + S.over },
    top = shellRoofs(k, eaves);
  shellRidge(k, top.mid);
  const lanterns = shellLanterns(k);
  if (style === 'dojo') noren(k, norenMaterial || accentMaterial);
  return {
    blockers: k.blockers,
    lampTop: ceilingY,
    sign: { ...EAST.sign, y: S.wall - 0.335 - (EAST.sign.height + 0.1) / 2 },
    nameBoard: nameBoard(k, eaves),
    winterParts: k.winterParts,
    badge: { x: 0, y: S.edge + 0.75, z: eaves.front - 0.2 },
    // The highest point of the roof (the main ridge).
    top: S.ridge,
    // The outermost roof outline (on the temple the skirt roof): plants keep their lawn clear of it.
    roof: { ...eaves },
    lanterns,
    practicalMaterials: [
      M.lacquer,
      M.timber,
      M.plaster,
      M.podium,
      M.shoji,
      M.lattice,
      M.frieze,
      M.gold,
      // The coffered ceiling over the lamps (owner, round 9: it stayed black, the only part the lamps did not light).
      M.ceiling,
      k.tiles
    ]
  };
}
