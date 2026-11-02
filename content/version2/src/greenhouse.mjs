// Greenhouse gallery (M18 prototype): a light glass greenhouse on a wooden frame that replaces the pavilion and the
// separate description/comments stands. The camera walks in through a free doorway; the project's pictures stand
// as exhibits on easels, the description hangs on a board on the left wall and the comments are notes pinned on a
// cork board on the right wall. The card's tabs turn the camera between the three zones.
// Local frame as in world.mjs / pavilion-hall.mjs: x along the route tangent, -z towards the bridge.
// The footprint stays inside the old hall roof ellipse (HALL.roof), so plantings, visitors and the clearance of
// the lawn around it keep working unchanged.
import { buildEastShell } from './east-shell.mjs';
import { contentLevel } from './content-level.mjs';
import { BOARD_LOOKS } from './zone-screens.mjs';
import { fitFont } from './pavilion-glass.mjs';
import { pottedPlant, seatPlantGeometry, TALL_POT, STEM_SPREAD } from './pavilion-hall.mjs';
import { paintContext } from './paint-canvas.mjs';

// Common base for every greenhouse. Per project: the sign (name + icon), the accent colour (door frame, ridge cap,
// sign border, exhibit frames) and later one characteristic detail (see GREENHOUSE_DETAILS).
export const GREENHOUSE = {
  // Which project islands get a greenhouse: 'smallest' (the prototype: the island with the smallest radius),
  // 'all', 'none', or a list of slot indices. ?greenhouse=all|none|smallest|2,3 overrides it for previews.
  islands: 'smallest',
  sideX: 3.1,
  front: -1.6,
  back: 3.95,
  floor: 0.486,
  plinth: 0.95,
  eave: 4.35,
  ridge: 5.8,
  // Timber frames along the depth, the gables included.
  frames: 5,
  timber: 0.1,
  // A free doorway (no leaves): wider than any walk into the hall (pavilion-hall test: |x| < 1.15).
  door: { half: 1.4, top: 3.95 },
  // The project screen as the main exhibit on a big easel at the back (5.18 x 3.02 proportions).
  hero: { width: 2.7, height: 1.574, y: 2.62, z: 3.4 },
  pill: { width: 1.5, height: 0.28, y: 1.58, z: 3.36 },
  exhibit: { width: 1.12, height: 0.79, canvas: { width: 384, height: 272 } },
  // Back pair on easels turned to the entrance, side pair hung on the side walls behind the boards.
  exhibits: [
    { x: -2.08, z: 3.05, yaw: Math.PI - 0.5, y: 2.05, easel: true },
    { x: 2.08, z: 3.05, yaw: Math.PI + 0.5, y: 2.05, easel: true },
    { x: -3.0, z: 2.2, yaw: Math.PI / 2, y: 2.55, easel: false },
    { x: 3.0, z: 2.2, yaw: -Math.PI / 2, y: 2.55, easel: false }
  ],
  // Section boards on the side walls, turned a little towards the door. Width/height keep the 1024 x 640 canvas.
  boards: {
    // x keeps the turned frame and its legs inside the side walls (at 2.72 they passed through the glass, round 5;
    // at 2.66 the frame touched the dojo's sill rail and a leg the stone base of the middle column).
    description: { x: -2.58, z: 0.45, yaw: Math.PI / 2 + 0.32, width: 2.1, height: 1.3125, y: 2.35 },
    comments: { x: 2.58, z: 0.45, yaw: -Math.PI / 2 - 0.32, width: 2.1, height: 1.3125, y: 2.35 }
  },
  // Potted plants [x, z] (mirrored in x): tall tubs in the back corners, their leaves drawn in to `spread` across
  // and `rise` up so they stay inside the walls and under the easels' frames (the full plant spread 0.8 m and
  // pushed 0.45 m out through the walls); small pots inside the door, clear of the front wall.
  plants: { tall: { at: [2.64, 3.48], spread: 0.5, rise: 0.75 }, small: { at: [2.4, -0.96] } },
  // Where the camera stands for Description and Comments (local z, on the axis), and how long a tab turn takes.
  stand: { z: -0.55 },
  turnMs: 900,
  sign: { width: 2.6, height: 0.5, y: 4.64, z: -1.7 },
  // The birthday badge (project-birthdays.mjs) stands on top of the sign.
  badge: { x: 0, y: 5.42, z: -1.78 },
  // Warm pendant lamps under the ridge (local z).
  lamps: [0.4, 2.5],
  // The island deck under a greenhouse: a pad round the house only (no paths to the old stands).
  deck: [
    [-3.6, -0.65],
    [3.6, -0.65],
    [3.6, 4.7],
    [-3.6, 4.7]
  ]
};

// Planned per-project characteristic details (not built in the prototype): one object by the door or on the ridge
// that says what the project is, e.g. a weather vane, a watering can, a lantern, a bird house, a sun dial.
// Keyed by project id; the builder ignores them until they exist.
export const GREENHOUSE_DETAILS = {};

// Slots that get a greenhouse. `islands` are { radius, stretch } per slot; ties on radius go to the narrower one.
export function greenhouseSlots(islands, mode = GREENHOUSE.islands) {
  const n = islands.length;
  if (!n || mode === 'none' || mode === 'off' || mode === false) return new Set();
  if (mode === 'all') return new Set(islands.keys());
  if (typeof mode === 'string' && /^\d+(,\d+)*$/.test(mode)) mode = mode.split(',').map(Number);
  if (Array.isArray(mode)) return new Set(mode.filter(i => Number.isInteger(i) && i >= 0 && i < n));
  let best = 0;
  for (let i = 1; i < n; i++) {
    const a = islands[i],
      b = islands[best];
    if (a.radius < b.radius - 1e-9 || (Math.abs(a.radius - b.radius) <= 1e-9 && a.stretch < b.stretch))
      best = i;
  }
  return new Set([best]);
}

// Inside the greenhouse's footprint, below the eaves (the hall test's camera eye is local y 3.56).
export function insideGreenhouse(local) {
  const { sideX, front, back, eave } = GREENHOUSE;
  return Math.abs(local.x) < sideX && local.z > front - 0.05 && local.z < back && local.y < eave;
}

// The roof line at |x| (local y), for clearance checks.
export function roofHeight(x) {
  const { sideX, eave, ridge } = GREENHOUSE;
  return eave + (ridge - eave) * Math.max(0, 1 - Math.abs(x) / sideX);
}

// Zone look targets in local metres: the gallery is the hero at the back, the others their boards.
export function zoneLook(zone) {
  const b = GREENHOUSE.boards[zone];
  if (b) return { x: b.x, y: b.y, z: b.z };
  const h = GREENHOUSE.hero;
  return { x: 0, y: h.y, z: h.z };
}

// Up to four exhibits: gallery images other than the screen's own, then video posters; each keeps its index in
// the card's gallery (images first, then videos), so a click opens that item large.
export function exhibitItems(images = [], videos = [], hero = images[0]) {
  const pictures = images.map((src, index) => ({ src, index })).filter(e => e.src),
    others = pictures.filter(e => e.src !== hero),
    posters = videos
      .map((video, k) => ({ src: video?.poster, index: images.length + k, video: true }))
      .filter(e => e.src),
    list = [...others, ...posters];
  return (list.length >= 2 ? list : [...pictures, ...posters]).slice(0, GREENHOUSE.exhibits.length);
}

// Owner, round 5: the East houses keep the old layout's easels and boards no more (they stood in front of the
// pictures and the comments, and showed 5 of a big project's 11 materials). Everything hangs on the walls: the
// project screen on the back wall between its columns, the description and comments panels on the side walls by
// the door, and every other picture and video poster in its own frame (all of them), in rows on the back wall
// beside the screen and on the side walls behind the middle columns; the middle of the room stays free. A house
// is deeper by `perItem` m for each item over `from` (up to `max`), so a big project gets a bigger hall.
// rows: frame centres above the floor; flankX: the back-wall frames' centres; wallX: the side frames' and panels'
// faces; clear: room left to a column; panelY: the panels' centres above the floor; aboveY: overflow frames over
// the panels. The pavilion hangs them on screens (east-shell.mjs).
export const WALL_GALLERY = {
  perItem: 0.25,
  from: 6,
  max: 1.2,
  // The screen's frame clears the temple's back columns (inner faces at 1.24 m) by 2 cm.
  hero: { width: 2.28, height: 1.33, y: 2.26 },
  pill: { y: 1.34 },
  rows: [1.75, 2.85],
  flankX: 2.3,
  wallX: 3.0,
  gap: 0.25,
  clear: 0.25,
  panelY: 1.95,
  aboveY: 3.2
};

// The dimensions of an East house for a project of `volume` items (the glasshouse keeps GREENHOUSE).
export function houseLayout(volume) {
  const W = WALL_GALLERY,
    G = GREENHOUSE,
    back = G.back + Math.min(W.max, Math.max(0, (volume - W.from) * W.perItem)),
    depth = back - G.front,
    hero = { width: W.hero.width, height: W.hero.height, y: G.floor + W.hero.y, z: back - 0.095 };
  return {
    ...G,
    back,
    hero,
    pill: { ...G.pill, y: G.floor + W.pill.y, z: back - 0.12 },
    lamps: [G.front + depth * 0.36, G.front + depth * 0.74],
    deck: [
      [-3.6, -0.65],
      [3.6, -0.65],
      [3.6, back + 0.75],
      [-3.6, back + 0.75]
    ]
  };
}

// Every gallery item but the screen's own picture: the other pictures, then the videos (by their poster, or a
// drawn play screen with the video's number when they have none), each with its index in the card's gallery
// (images first, then videos), so a click opens that item large.
export function wallItems(images = [], videos = [], hero = images[0]) {
  const pictures = images
      .map((src, index) => ({ src, index, video: false, number: 0 }))
      .filter(e => e.src && e.src !== hero),
    posters = videos
      .map((video, k) => ({
        src: video?.poster || null,
        index: images.length + k,
        video: true,
        number: k + 1
      }))
      .filter((_, k) => videos[k]);
  return [...pictures, ...posters];
}

// Where the description and comments panels hang: the side walls between the front and the middle columns.
export function panelPlace(G, zone) {
  const W = WALL_GALLERY,
    s = zone === 'description' ? -1 : 1,
    midZ = (G.front + G.back) / 2;
  return {
    ...G.boards[zone],
    x: s * W.wallX,
    y: G.floor + W.panelY,
    z: (G.front + midZ) / 2,
    yaw: (-s * Math.PI) / 2
  };
}

// Frame places for `count` items, in order: per row (low, then high) the two back-wall places beside the screen,
// then the side walls behind the middle columns (as many as their length holds), then the overflow over the panels.
// The pavilion has its screens only where the house walls stand, so the same places serve it.
export function wallSlots(G, count) {
  const W = WALL_GALLERY,
    E = G.exhibit,
    midZ = (G.front + G.back) / 2,
    from = midZ + W.clear + E.width / 2,
    to = G.back - W.clear - E.width / 2,
    perRow = Math.max(1, Math.floor((to - from) / (E.width + W.gap)) + 1),
    step = perRow > 1 ? (to - from) / (perRow - 1) : 0,
    first = perRow > 1 ? from : (from + to) / 2,
    slots = [];
  for (const row of W.rows) {
    const y = G.floor + row;
    for (const s of [-1, 1])
      slots.push({ x: s * W.flankX, y, z: G.back - 0.095, yaw: Math.PI, easel: false });
    for (let c = 0; c < perRow; c++)
      for (const s of [-1, 1])
        slots.push({ x: s * W.wallX, y, z: first + c * step, yaw: (-s * Math.PI) / 2, easel: false });
  }
  for (const s of [-1, 1]) {
    const p = panelPlace(G, s < 0 ? 'description' : 'comments');
    slots.push({ x: p.x, y: G.floor + W.aboveY, z: p.z, yaw: p.yaw, easel: false });
  }
  return slots.slice(0, count);
}

// Pinned notes on the comments board: up to six cards in two rows, slightly rotated, on a 1024 x 640 canvas.
const NOTE_WIDTH = { 1: 560, 2: 420, 3: 290 };
export function noteLayout(count) {
  const n = Math.max(0, Math.min(6, count)),
    columns = n <= 2 ? Math.max(1, n) : 3,
    rows = n > 3 ? 2 : 1,
    w = NOTE_WIDTH[columns],
    h = rows === 2 ? 220 : 300,
    top = 118;
  return Array.from({ length: n }, (_, k) => {
    const col = k % columns,
      row = Math.floor(k / columns),
      gap = (1024 - 80 - columns * w) / Math.max(1, columns - 1 || 1),
      x = columns === 1 ? (1024 - w) / 2 : 40 + col * (w + gap),
      y = top + row * (h + 34);
    return { x, y, w, h, tilt: ((k * 37) % 7) * 0.008 - 0.024 };
  });
}

function wrapLines(c, text, width, max) {
  const lines = [];
  let line = '';
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const next = line ? line + ' ' + word : word;
    if (c.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
      if (lines.length === max) break;
    } else line = next;
  }
  if (lines.length < max && line) lines.push(line);
  else if (lines.length === max) {
    // The cut line ends on a whole word and an ellipsis.
    const last = lines[max - 1],
      cut = last.lastIndexOf(' ');
    lines[max - 1] = (cut > 0 ? last.slice(0, cut) : last) + ' …';
  }
  return lines;
}

const NOTE_PAPER = ['#fff4b8', '#ffe1ec', '#dff3ff', '#e5f8d8', '#fbe7c8', '#efe4ff'],
  // Neon: dark glass notes, each with its own soft neon edge.
  NOTE_NEON = ['#4fd8ff', '#ff5fd6', '#9b7bff', '#5dffb0', '#ffb84f', '#ff7a9e'];

// The comments board in the boards' look (zone-screens.mjs BOARD_LOOKS: paper in Natural, violet glass in Neon):
// a title and either the pinned notes or one status line (loading, empty, failed).
function drawNotes(c, title, notes, accent, style = 'natural') {
  const look = BOARD_LOOKS[style] || BOARD_LOOKS.natural,
    neon = style === 'neon',
    paper = c.createLinearGradient(0, 0, 0, 640);
  paper.addColorStop(0, look.paper[0]);
  paper.addColorStop(1, look.paper[1]);
  c.fillStyle = paper;
  c.fillRect(0, 0, 1024, 640);
  c.strokeStyle = look.edge;
  c.lineWidth = 6;
  c.strokeRect(3, 3, 1018, 634);
  c.fillStyle = look.hairline;
  c.fillRect(38, 100, 948, 2);
  c.fillStyle = neon ? look.accent : accent;
  c.fillRect(38, 40, 6, 45);
  c.fillStyle = look.title;
  c.font = '650 38px Georgia, "Noto Serif", serif';
  c.textBaseline = 'middle';
  c.fillText(title, 64, 64, 920);
  if (!Array.isArray(notes)) {
    c.font = '30px system-ui';
    c.fillStyle = look.body;
    wrapLines(c, notes || '', 900, 4).forEach((line, k) => c.fillText(line, 60, 200 + k * 44));
    return;
  }
  noteLayout(notes.length).forEach((r, k) => {
    const note = notes[k];
    c.save();
    c.translate(r.x + r.w / 2, r.y + r.h / 2);
    c.rotate(r.tilt);
    const edge = NOTE_NEON[k % NOTE_NEON.length];
    c.shadowColor = neon ? edge : 'rgba(30,15,5,.35)';
    c.shadowBlur = neon ? 12 : 14;
    c.shadowOffsetY = neon ? 0 : 6;
    c.fillStyle = neon ? '#2a2148' : NOTE_PAPER[k % NOTE_PAPER.length];
    c.fillRect(-r.w / 2, -r.h / 2, r.w, r.h);
    c.shadowColor = 'transparent';
    if (neon) {
      c.strokeStyle = edge;
      c.lineWidth = 2;
      c.strokeRect(-r.w / 2, -r.h / 2, r.w, r.h);
    }
    c.fillStyle = neon ? edge : accent;
    c.beginPath();
    c.arc(0, -r.h / 2 + 16, 9, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = neon ? look.title : '#3a2a1c';
    c.font = '600 26px system-ui';
    c.fillText(note.name || '—', -r.w / 2 + 20, -r.h / 2 + 48, r.w - 40);
    c.font = '24px system-ui';
    const lines = wrapLines(c, note.body || '', r.w - 40, r.h > 250 ? 6 : 4);
    lines.forEach((line, n) => c.fillText(line, -r.w / 2 + 20, -r.h / 2 + 88 + n * 32));
    c.restore();
  });
}

function canvasTexture(THREE, width, height, resources) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  resources.add(texture);
  return { canvas, c: paintContext(canvas), texture };
}

// The wooden sign over the door: the project icon and name, framed in the accent colour.
function signTexture(THREE, project, accent, { resources, invalidate, isDisposed }) {
  const W = 1024,
    H = 196,
    { c, texture } = canvasTexture(THREE, W, H, resources);
  let icon = null;
  const draw = () => {
    const wood = c.createLinearGradient(0, 0, 0, H);
    wood.addColorStop(0, '#8a5a34');
    wood.addColorStop(1, '#6b4224');
    c.fillStyle = wood;
    c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(40,20,8,.18)';
    for (let y = 18; y < H; y += 30) c.fillRect(0, y, W, 2);
    c.strokeStyle = accent;
    c.lineWidth = 10;
    c.strokeRect(6, 6, W - 12, H - 12);
    const size = H - 56,
      ix = 36,
      iy = 28;
    if (icon) {
      const s = Math.min(size / icon.naturalWidth, size / icon.naturalHeight);
      c.drawImage(
        icon,
        ix + (size - icon.naturalWidth * s) / 2,
        iy + (size - icon.naturalHeight * s) / 2,
        icon.naturalWidth * s,
        icon.naturalHeight * s
      );
    } else if (project.iconCanvas) c.drawImage(project.iconCanvas, ix, iy, size, size);
    const tx = ix + size + 28,
      max = W - tx - 36,
      px = fitFont(
        (text, p) => {
          c.font = `600 ${p}px system-ui`;
          return c.measureText(text).width;
        },
        project.name,
        max,
        92,
        40
      );
    c.font = `600 ${px}px system-ui`;
    c.textBaseline = 'middle';
    c.fillStyle = '#fff6e6';
    c.shadowColor = 'rgba(0,0,0,.4)';
    c.shadowBlur = 6;
    c.fillText(project.name, tx, H / 2 + 4, max);
    c.shadowBlur = 0;
    texture.needsUpdate = true;
  };
  draw();
  if (project.ico) {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      image.onload = image.onerror = null;
      if (isDisposed()) return;
      icon = image;
      draw();
      invalidate();
    };
    image.onerror = () => (image.onload = image.onerror = null);
    image.src = project.ico;
  }
  return texture;
}

function pillTexture(THREE, text, accent, resources) {
  const { c, texture } = canvasTexture(THREE, 512, 96, resources);
  c.fillStyle = '#3d2716';
  c.beginPath();
  c.roundRect(3, 3, 506, 90, 45);
  c.fill();
  c.lineWidth = 5;
  c.strokeStyle = accent;
  c.stroke();
  c.fillStyle = '#fff4e4';
  c.font = '600 38px system-ui';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text + '  →', 256, 50, 470);
  return texture;
}

// Shared per world: the frame timber and its darker trim.
export function createGreenhouseMaterials(THREE, resources) {
  const wood = new THREE.MeshStandardMaterial({ color: 0xa8774c, roughness: 0.72, metalness: 0 }),
    dark = new THREE.MeshStandardMaterial({ color: 0x6e4a2e, roughness: 0.8, metalness: 0 });
  resources.add(wood);
  resources.add(dark);
  return { wood, dark };
}

// Builds one greenhouse in a pavilion group. Static parts go through `mesh` (the world bakes them by material);
// pickables and the notes board keep their own meshes. Returns what world.mjs registers.
export function buildGreenhouse(
  THREE,
  {
    group,
    mesh,
    merge,
    materials,
    project,
    images,
    videos,
    labels,
    resources,
    invalidate,
    isDisposed,
    screenMaterial,
    idleMaterial,
    plants,
    // 'glasshouse' (the timber and glass house) or an East Asian shell: 'temple', 'dojo' or 'pavilion'.
    style = 'glasshouse'
  }
) {
  // The East houses take their size from their content (WALL_GALLERY); the glasshouse keeps its own.
  const east = style !== 'glasshouse',
    items = east ? wallItems(images, videos, project.image) : exhibitItems(images, videos, project.image),
    G = east ? houseLayout(items.length + 1) : GREENHOUSE,
    { sideX, front, back, floor, plinth, eave, ridge, timber: t, door } = G,
    depth = back - front,
    midZ = (front + back) / 2,
    accent = project.accent || '#a895e5',
    accentMaterial = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5 }),
    { wood, dark, glass, floor: floorMaterial, light } = materials,
    blockers = [];
  resources.add(accentMaterial);
  // A dojo's noren has its own material, so it can dissolve in the doorway (fadeDoorway below).
  const norenMaterial = style === 'dojo' ? accentMaterial.clone() : null;
  if (norenMaterial) resources.add(norenMaterial);
  const box = (w, h, d, x, y, z, material = wood, rot = null) => {
    const m = mesh(new THREE.BoxGeometry(w, h, d), material, group);
    m.position.set(x, y, z);
    if (rot) m.rotation.set(rot.x || 0, rot.y || 0, rot.z || 0, rot.order || 'XYZ');
    return m;
  };
  const pane = (geometry, x, y, z, ry = 0) => {
    const m = mesh(geometry, glass, group);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.renderOrder = 3;
    return m;
  };
  // Floor: the halls' plank floor, one tile per 1.6 m.
  const width = sideX * 2 - 0.1,
    floorGeometry = new THREE.PlaneGeometry(width, depth - 0.1).rotateX(-Math.PI / 2),
    uv = floorGeometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * width) / 1.6, (uv.getY(i) * depth) / 1.6);
  mesh(floorGeometry, floorMaterial, group).position.set(0, floor, midZ);

  // The building round the content: the timber frame and glass of the glasshouse, or an East Asian shell. Shell
  // parts are marked (userData.shell), so the tests can tell the building from the stands and exhibits in it.
  const shellPart = m => ((m.userData.shell = true), m);
  const shell =
    style === 'glasshouse'
      ? null
      : buildEastShell(THREE, {
          style,
          G,
          box: (...args) => shellPart(box(...args)),
          mesh: (geometry, material) => shellPart(mesh(geometry, material, group)),
          materials: materials.east,
          accentMaterial,
          norenMaterial,
          project
        });
  if (shell) blockers.push(...shell.blockers);
  else {
    // Timber frames: posts, rafters and a ridge; eave beams and a mid rail along the sides.
    const frameZ = Array.from({ length: G.frames }, (_, k) => front + (depth * k) / (G.frames - 1)),
      rafter = Math.hypot(sideX, ridge - eave),
      pitch = Math.atan2(ridge - eave, sideX),
      postHeight = eave - floor;
    for (const z of frameZ)
      for (const side of [-1, 1]) {
        const post = box(t, postHeight, t, side * sideX, floor + postHeight / 2, z);
        if (z === front || z === back) blockers.push(post);
        box(rafter, t * 0.9, t * 0.8, (side * sideX) / 2, (eave + ridge) / 2, z, wood, { z: -side * pitch });
      }
    blockers.push(box(t * 1.1, t * 1.3, depth + 0.2, 0, ridge, midZ));
    box(t * 1.6, t * 0.5, depth + 0.24, 0, ridge + t * 0.85, midZ, accentMaterial);
    for (const side of [-1, 1]) {
      blockers.push(box(t * 1.2, t * 1.2, depth + 0.1, side * sideX, eave, midZ));
      box(0.05, 0.05, depth, side * sideX, 2.65, midZ);
      // A purlin halfway up each slope.
      box(0.06, 0.06, depth, (side * sideX) / 2, (eave + ridge) / 2 + 0.06, midZ);
      // Glazing bars between the frames.
      for (let k = 0; k < G.frames - 1; k++)
        box(
          0.04,
          postHeight - (plinth - floor),
          0.04,
          side * sideX,
          (plinth + eave) / 2,
          (frameZ[k] + frameZ[k + 1]) / 2
        );
      // Knee wall of boards.
      box(0.07, plinth - floor, depth, side * sideX, (plinth + floor) / 2, midZ, dark);
    }
    box(sideX * 2, plinth - floor, 0.07, 0, (plinth + floor) / 2, back, dark);
    // Front: knee wall and a post either side of the doorway, an accent door frame and a rail at the door head.
    for (const side of [-1, 1]) {
      const inner = door.half + 0.06,
        w = sideX - inner;
      box(w, plinth - floor, 0.07, side * (inner + w / 2), (plinth + floor) / 2, front, dark);
      box(0.12, door.top - floor, 0.12, side * door.half, (door.top + floor) / 2, front, accentMaterial);
    }
    box(door.half * 2 + 0.12, 0.12, 0.12, 0, door.top, front, accentMaterial);
    for (const z of [front, back]) box(sideX * 2, 0.06, 0.06, 0, door.top, z);
    for (const x of [-1.4, 1.4]) box(0.04, eave - plinth, 0.04, x, (eave + plinth) / 2, back);

    // Glass: side walls, roof slopes, front beside and above the doorway, the back wall and both gables.
    const wall = eave - plinth;
    for (const side of [-1, 1]) {
      pane(new THREE.PlaneGeometry(depth, wall), side * sideX, (plinth + eave) / 2, midZ, Math.PI / 2);
      const slope = mesh(
        new THREE.PlaneGeometry(rafter, depth)
          .rotateX(-Math.PI / 2)
          .rotateZ(-side * pitch)
          .translate((side * sideX) / 2, (eave + ridge) / 2 + 0.05, midZ),
        glass,
        group
      );
      slope.renderOrder = 3;
      const w = sideX - door.half;
      pane(
        new THREE.PlaneGeometry(w, door.top - plinth),
        side * (door.half + w / 2),
        (plinth + door.top) / 2,
        front
      );
    }
    pane(new THREE.PlaneGeometry(sideX * 2, eave - door.top), 0, (door.top + eave) / 2, front);
    pane(new THREE.PlaneGeometry(sideX * 2, wall), 0, (plinth + eave) / 2, back);
    const gable = new THREE.Shape();
    gable.moveTo(-sideX, eave);
    gable.lineTo(sideX, eave);
    gable.lineTo(0, ridge);
    gable.closePath();
    for (const z of [front, back]) pane(new THREE.ShapeGeometry(gable), 0, 0, z);
  }
  // The sign over the doorway, facing the bridge.
  const signMaterial = new THREE.MeshBasicMaterial({
    map: signTexture(THREE, project, accent, { resources, invalidate, isDisposed }),
    toneMapped: false,
    // A face a few centimetres off its frame or box: kept in front of it at any distance (round 5 z-fight audit).
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4
  });
  resources.add(signMaterial);
  const signAt = shell ? shell.sign : G.sign,
    nameBoard = shell?.nameBoard,
    // Own materials for the two name signs, so each can be shown alone (showName below).
    nameMaterials = nameBoard ? [dark.clone(), signMaterial.clone(), dark.clone()] : [],
    doorBoard = nameMaterials[0] || dark;
  nameMaterials.forEach(material => resources.add(material));
  const sign = mesh(new THREE.PlaneGeometry(signAt.width, signAt.height), signMaterial, group);
  sign.position.set(0, signAt.y, signAt.z);
  sign.rotation.y = Math.PI;
  box(signAt.width + 0.1, signAt.height + 0.1, 0.05, 0, signAt.y, signAt.z + 0.04, doorBoard);

  // The doorway plaque reads from the bridge; the name board (east-shell.mjs) from the garden's overview. The name
  // shows once (owner, round 12: it was written twice on every facade): world.mjs updateHalls calls showName with
  // whether the camera is near the door.
  let showName = null;
  if (nameBoard) {
    const nb = nameBoard,
      [, plaqueMaterial, boardMaterial] = nameMaterials,
      plaque = mesh(new THREE.PlaneGeometry(nb.width, nb.height), plaqueMaterial, group),
      board = box(nb.width + 0.14, nb.height + 0.14, 0.05, 0, 0, 0, boardMaterial),
      normal = new THREE.Vector3(0, Math.sin(nb.tilt), -Math.cos(nb.tilt));
    plaque.position.set(nb.x, nb.y, nb.z);
    plaque.rotation.set(-nb.tilt, Math.PI, 0, 'YXZ');
    board.position.copy(plaque.position).addScaledVector(normal, -0.035);
    board.rotation.copy(plaque.rotation);
    showName = near => {
      signMaterial.visible = doorBoard.visible = near;
      plaqueMaterial.visible = boardMaterial.visible = !near;
    };
  }
  // An East house's doorway plaque (with its board) and a dojo's noren hang where the camera comes through the door
  // (owner, 2026-11-01: it flew through them). world.mjs updateHalls passes how much of them shows: 1 from a few
  // metres out, 0 in the doorway and inside. The glasshouse's sign is above its door and its board is house timber.
  // They are drawn as transparent from the start: three builds an opaque material's program without alpha, so switching
  // it on only when the fade begins would need a new program mid-flight.
  const doorway = shell ? [signMaterial, doorBoard, norenMaterial].filter(Boolean) : [];
  doorway.forEach(material => (material.transparent = true));
  const fadeDoorway = doorway.length
    ? shown => doorway.forEach(material => (material.opacity = shown))
    : null;

  // The hero exhibit: the project screen with a picture light and the Open pill; on a big easel at the back of the
  // glasshouse, on the back wall between its columns in the East houses.
  const h = G.hero;
  box(h.width + 0.16, h.height + 0.16, 0.05, 0, h.y, h.z + 0.035, dark);
  if (!east) {
    blockers.push(box(h.width + 0.24, 0.07, 0.24, 0, h.y - h.height / 2 - 0.1, h.z - 0.02));
    for (const side of [-1, 1]) {
      const length = h.y + h.height / 2 + 0.25 - floor;
      box(0.07, length, 0.07, side * (h.width / 2 - 0.25), floor + length / 2, h.z + 0.1);
    }
  }
  // The easel's back leg, from behind the screen's top down to the floor 12 cm short of the back glass (it was a
  // fixed tilt that ran 37 cm through the back wall; owner, round 5).
  if (!east) {
    const top = { y: h.y + h.height / 2 - 0.1, z: h.z + 0.1 },
      foot = { y: floor, z: G.back - 0.12 },
      length = Math.hypot(top.y - foot.y, foot.z - top.z);
    box(0.07, length, 0.07, 0, (top.y + foot.y) / 2, (top.z + foot.z) / 2, wood, {
      x: -Math.atan2(foot.z - top.z, top.y - foot.y)
    });
  }
  box(0.7, 0.035, 0.06, 0, h.y + h.height / 2 + 0.14, h.z - 0.1, light);
  const screen = mesh(new THREE.PlaneGeometry(h.width, h.height), screenMaterial, group);
  screen.position.set(0, h.y, h.z);
  screen.rotation.y = Math.PI;
  const pillMaterial = new THREE.MeshBasicMaterial({
    map: pillTexture(THREE, labels.openProject || 'Open project', accent, resources),
    toneMapped: false,
    transparent: true,
    // A face a few centimetres off its frame or box: kept in front of it at any distance (round 5 z-fight audit).
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4
  });
  resources.add(pillMaterial);
  const open = mesh(new THREE.PlaneGeometry(G.pill.width, G.pill.height), pillMaterial, group);
  open.position.set(0, G.pill.y, G.pill.z);
  open.rotation.y = Math.PI;

  // Exhibits: one atlas texture per greenhouse, all pictures in one pickable mesh (two triangles each). The atlas
  // holds two columns for the glasshouse's four, four for the East houses' many.
  const E = G.exhibit,
    places = east ? wallSlots(G, items.length) : G.exhibits,
    columns = east ? 4 : 2,
    rows = Math.max(1, Math.ceil(items.length / columns)),
    atlas = items.length
      ? canvasTexture(THREE, E.canvas.width * columns, E.canvas.height * rows, resources)
      : null,
    faces = [],
    // Each cell's picture once loaded, so the mats can be drawn again in the other light style.
    cellImages = [];
  // The mat round each picture follows the light style like the boards and the card (owner, round 17: the
  // frames stayed cream while the boards, the card and the viewer turned dark violet in Neon): cream paper with
  // the project's accent in Natural, dark violet glass with a cyan edge in Neon. The pictures are never tinted.
  let matStyle = 'natural';
  const drawCell = (k, image) => {
    cellImages[k] = image;
    const { width: W, height: H } = E.canvas,
      x0 = (k % columns) * W,
      y0 = Math.floor(k / columns) * H,
      c = atlas.c,
      // The glasshouse's exhibits carry no video number (exhibitItems): read both kinds alike.
      item = /** @type {{ src?: string, video?: boolean, number?: number }} */ (items[k]);
    const look = BOARD_LOOKS[matStyle];
    c.fillStyle = matStyle === 'neon' ? look.paper[1] : '#f1e8d8';
    c.fillRect(x0, y0, W, H);
    c.strokeStyle = matStyle === 'neon' ? look.glow : accent;
    c.lineWidth = 8;
    c.strokeRect(x0 + 4, y0 + 4, W - 8, H - 8);
    if (matStyle === 'neon') {
      c.strokeStyle = look.edge;
      c.lineWidth = 2;
      c.strokeRect(x0 + 11, y0 + 11, W - 22, H - 22);
    }
    const play = () => {
      c.fillStyle = 'rgba(0,0,0,.55)';
      c.beginPath();
      c.arc(x0 + W / 2, y0 + H / 2, 34, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#fff';
      c.beginPath();
      c.moveTo(x0 + W / 2 - 11, y0 + H / 2 - 17);
      c.lineTo(x0 + W / 2 + 18, y0 + H / 2);
      c.lineTo(x0 + W / 2 - 11, y0 + H / 2 + 17);
      c.fill();
    };
    if (image) {
      const pad = 14,
        s = Math.min((W - pad * 2) / image.naturalWidth, (H - pad * 2) / image.naturalHeight),
        w = image.naturalWidth * s,
        hh = image.naturalHeight * s;
      c.drawImage(image, x0 + (W - w) / 2, y0 + (H - hh) / 2, w, hh);
      if (item.video) play();
    } else if (item.video && !item.src) {
      // A video with no picture of its own: a dark screen with the play mark and its number, drawn here rather
      // than fetched from the video site before the visitor asks for it.
      c.fillStyle = matStyle === 'neon' ? '#0d0a17' : '#1d1a26';
      c.fillRect(x0 + 14, y0 + 14, W - 28, H - 28);
      play();
      c.fillStyle = matStyle === 'neon' ? BOARD_LOOKS.neon.title : '#f1e8d8';
      c.font = '600 30px system-ui, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'alphabetic';
      c.fillText((labels.video || 'Video') + ' ' + item.number, x0 + W / 2, y0 + H - 38);
    }
    atlas.texture.needsUpdate = true;
  };
  items.forEach((item, k) => {
    const p = places[k],
      normal = { x: Math.sin(p.yaw), z: Math.cos(p.yaw) },
      ry = p.yaw;
    drawCell(k, null);
    // A dark wooden frame behind the picture (its back reads as wood from outside); the mat carries the accent.
    const frame = box(
      E.width + 0.1,
      E.height + 0.1,
      0.05,
      p.x - normal.x * 0.03,
      p.y,
      p.z - normal.z * 0.03,
      dark,
      { y: ry }
    );
    frame.userData.exhibit = k;
    if (p.easel) {
      const length = p.y + E.height / 2 + 0.2 - floor;
      for (const s of [-1, 1]) {
        const lx = p.x + Math.cos(ry) * s * 0.36 - normal.x * 0.06,
          lz = p.z - Math.sin(ry) * s * 0.36 - normal.z * 0.06;
        box(0.05, length, 0.05, lx, floor + length / 2, lz, wood, { y: ry });
      }
      box(0.05, 2.0, 0.05, p.x - normal.x * 0.42, floor + 0.98, p.z - normal.z * 0.42, wood, {
        y: ry,
        x: 0.3,
        order: 'YXZ'
      });
      box(
        E.width + 0.12,
        0.05,
        0.12,
        p.x + normal.x * 0.02,
        p.y - E.height / 2 - 0.08,
        p.z + normal.z * 0.02,
        wood,
        { y: ry }
      );
    } else
      box(0.5, 0.03, 0.06, p.x + normal.x * 0.06, p.y + E.height / 2 + 0.12, p.z + normal.z * 0.06, light, {
        y: ry
      });
    const face = new THREE.PlaneGeometry(E.width, E.height),
      fuv = face.attributes.uv,
      u0 = (k % columns) / columns,
      v0 = 1 - (Math.floor(k / columns) + 1) / rows;
    for (let n = 0; n < fuv.count; n++) fuv.setXY(n, u0 + fuv.getX(n) / columns, v0 + fuv.getY(n) / rows);
    face.applyMatrix4(
      new THREE.Matrix4().compose(
        new THREE.Vector3(p.x, p.y, p.z),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry),
        new THREE.Vector3(1, 1, 1)
      )
    );
    faces.push(face);
  });
  let gallery = null;
  if (faces.length) {
    const material = contentLevel(new THREE.MeshBasicMaterial({ map: atlas.texture, toneMapped: false }));
    resources.add(material);
    gallery = { object: mesh(merge(faces), material, group), images: items.map(e => e.index) };
    for (const face of faces) face.dispose();
  }
  let loaded = false;
  function loadPictures() {
    if (loaded) return;
    loaded = true;
    items.forEach((item, k) => {
      if (!item.src) return;
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => {
        image.onload = image.onerror = null;
        if (isDisposed()) return;
        drawCell(k, image);
        invalidate();
      };
      image.onerror = () => (image.onload = image.onerror = null);
      image.src = item.src;
    });
  }

  // Section boards: the description on the zone canvas, the comments as pinned notes on cork.
  const notes = canvasTexture(THREE, 1024, 640, resources),
    notesMaterial = contentLevel(new THREE.MeshBasicMaterial({ map: notes.texture, toneMapped: false }));
  resources.add(notesMaterial);
  let notesStyle = 'natural',
    pinned = null;
  const pinNotes = (title, list) => {
    pinned = [title, list];
    drawNotes(notes.c, title, list, accent, notesStyle);
    notes.texture.needsUpdate = true;
    invalidate();
  };
  // The light style (world.setLightStyle): the board is redrawn only when it changes.
  const setStyle = style => {
    const next = style === 'neon' ? 'neon' : 'natural';
    if (next === notesStyle) return;
    notesStyle = next;
    if (pinned) pinNotes(...pinned);
    if (!atlas) return;
    matStyle = next;
    items.forEach((_, k) => drawCell(k, cellImages[k] || null));
    invalidate();
  };
  pinNotes(labels.zoneComments || 'Comments', labels.sectionHint || '');
  const boards = [];
  const boardAt = zone => (east ? panelPlace(G, zone) : G.boards[zone]);
  for (const zone of Object.keys(G.boards)) {
    const b = boardAt(zone),
      normal = { x: Math.sin(b.yaw), z: Math.cos(b.yaw) },
      tangent = { x: Math.cos(b.yaw), z: -Math.sin(b.yaw) };
    box(b.width + 0.14, b.height + 0.14, 0.05, b.x - normal.x * 0.035, b.y, b.z - normal.z * 0.035, wood, {
      y: b.yaw
    });
    // In the East houses the panels hang on the wall: no legs.
    for (const s of east ? [] : [-1, 1]) {
      const length = b.y - b.height / 2 - floor + 0.05;
      box(
        0.07,
        length,
        0.07,
        b.x + tangent.x * s * (b.width / 2 - 0.12) - normal.x * 0.06,
        floor + length / 2,
        b.z + tangent.z * s * (b.width / 2 - 0.12) - normal.z * 0.06,
        wood,
        { y: b.yaw }
      );
    }
    const board = mesh(
      new THREE.PlaneGeometry(b.width, b.height),
      zone === 'comments' ? notesMaterial : idleMaterial,
      group
    );
    board.position.set(b.x, b.y, b.z);
    board.rotation.y = b.yaw;
    boards.push({ board, zone, own: zone === 'comments' });
  }

  // Plants: tall tubs in the back corners, small pots inside the door, a planter under the hero in the glasshouse
  // (in the East houses the easel's back leg and the back columns stand where it was).
  if (plants) {
    const { pot, soil, tall, small, material } = plants,
      P = G.plants;
    for (const side of [-1, 1]) {
      const { leaves } = pottedPlant(THREE, {
        group,
        mesh,
        pot,
        soil,
        plant: tall,
        plantMaterial: material,
        x: side * P.tall.at[0],
        z: back - (GREENHOUSE.back - P.tall.at[1]),
        floor,
        turn: side * 2.1,
        ...TALL_POT
      });
      leaves.scale.set(P.tall.spread, P.tall.rise, P.tall.spread);
      pottedPlant(THREE, {
        group,
        mesh,
        pot,
        soil,
        plant: small,
        plantMaterial: material,
        x: side * P.small.at[0],
        z: P.small.at[1],
        floor,
        turn: side * 1.7,
        top: 0.2,
        bottom: 0.24,
        height: 0.36,
        segments: 8
      });
    }
    if (!shell) {
      const trough = { width: 2.6, depth: 0.34, height: 0.42, z: 3.74 };
      box(trough.width, trough.height, trough.depth, 0, floor + trough.height / 2, trough.z, dark);
      mesh(
        new THREE.PlaneGeometry(trough.width - 0.08, trough.depth - 0.06).rotateX(-Math.PI / 2),
        soil,
        group
      ).position.set(0, floor + trough.height - 0.03, trough.z);
      seatPlantGeometry(small, 0.2 * STEM_SPREAD);
      for (const x of [-0.85, 0, 0.85]) {
        const leaves = mesh(small, material, group);
        leaves.position.set(x, floor + trough.height - 0.03, trough.z);
        leaves.rotation.y = x * 2.3 + 0.4;
      }
    }
  }

  // Pendant lamps under the ridge: a cord, a wooden shade and a warm bulb (the world adds the light).
  const lamps = [],
    hangFrom = shell ? shell.lampTop : ridge;
  for (const z of G.lamps) {
    box(0.015, 0.5, 0.015, 0, hangFrom - 0.3, z, dark);
    mesh(new THREE.CylinderGeometry(0.08, 0.26, 0.18, 12, 1, true), dark, group).position.set(
      0,
      hangFrom - 0.6,
      z
    );
    mesh(new THREE.SphereGeometry(0.07, 10, 8), light, group).position.set(0, hangFrom - 0.66, z);
    lamps.push({ x: 0, y: hangFrom - 0.7, z });
  }
  group.userData.badgeAnchor = shell ? { ...shell.badge } : { ...G.badge };
  // Where a project's birthday celebrates at this house (celebrations.mjs PARTY, house frame): the approach in
  // front of the door, fountains just outside the front corners, confetti in front of the sign and over the
  // ridge, and the hall itself. Owner, round 9: the pavilion's numbers put them in the walls of the larger
  // houses, so the party was hard to see up close.
  const badge = group.userData.badgeAnchor,
    top = shell ? shell.top : ridge;
  group.userData.party = {
    door: [0, floor + 0.3, front - 1.4],
    fountains: [
      [sideX + 0.25, floor + 0.15, front - 0.45],
      [-sideX - 0.25, floor + 0.15, front - 0.45]
    ],
    sign: [0, badge.y + 0.5, badge.z - 0.5],
    roof: [0, top + 1.4, midZ],
    inside: [0, floor + 2.3, midZ],
    // The project's emblem (project-birthdays.mjs) over the front of the roof, its balloons above the ridge.
    emblem: [0, top + 1.0, front + 0.6]
  };
  return {
    screen,
    open,
    sign,
    gallery,
    loadPictures,
    boards,
    pinNotes,
    setStyle,
    blockers,
    lamps,
    leaves: [],
    // This house's own room (an East house may be deeper than GREENHOUSE), the paving it needs, its depth and where
    // the camera looks for each section.
    inside: local => Math.abs(local.x) < sideX && local.z > front - 0.05 && local.z < back && local.y < eave,
    deck: G.deck,
    back,
    frames: items.length,
    zoneLook: zone => {
      if (zone === 'description' || zone === 'comments') {
        const b = boardAt(zone);
        return { x: b.x, y: b.y, z: b.z };
      }
      return { x: 0, y: h.y, z: h.z };
    },
    doorCentre: { x: 0, y: (floor + door.top) / 2, z: front },
    style,
    // Roof outline in plan (the glasshouse roof ends at its timber frame, the East roofs overhang the walls).
    roof: shell ? shell.roof : { halfX: sideX + 0.1, front: front - 0.1, back: back + 0.1 },
    // The house timber takes the lamps' light too: the pendant shades and picture frames went black at night.
    practicalMaterials: [
      ...(shell?.practicalMaterials || []),
      wood,
      dark,
      nameMaterials[0],
      nameMaterials[2]
    ].filter(Boolean),
    showName,
    fadeDoorway,
    // Parts shown in winter only (snow on the East roofs): the world adds them to its winter set.
    winterParts: shell?.winterParts || []
  };
}
