// The pavilion as a small glass hall you walk into: a deeper floor plan, a glass
// front with sliding doors that open as the camera comes near, and the project's gallery on the side walls.
// Local frame as in world.mjs: x along the route tangent, -z towards the bridge, the screen at the back.
import { contentLevel } from './content-level.mjs';
import { lcg32 } from './seeded-random.mjs';
import { paintContext } from './paint-canvas.mjs';

export const HALL = {
  front: -1.6,
  back: 3.95,
  sideX: 2.93,
  bottom: 0.62,
  top: 4.66,
  screenZ: 3.68,
  // Elliptical flat roof: the front edge stays where it was (z -2.83), the hall behind it is 2.2 m deeper.
  roof: { rx: 4.5, rz: 4.08, cz: 1.25 },
  // Two leaves slide behind the fixed panes. They open fully within `near` metres of the door, start to open at `far`.
  // The head is above 3.8 m: a phone camera at the doors looks at the screen through 2.8–3.8 m of the doorway.
  door: { half: 1.45, top: 3.95, track: -1.53, travel: 1.3, bottom: 0.74, near: 3.4, far: 5.6, speed: 2.4 },
  // Camera station as a lateral offset from the bridge centre (route.point): inside the hall on wide screens;
  // at the open doors on phones, where the 5.18 m screen needs about 8 m to fit the narrow view.
  station: { wide: 2.95, phone: -0.4 },
  // The walk turns into the hall over the last 1.5 m of bridge, so it passes through the open doorway (at most
  // 1.1 m off centre in a 2-3 island garden, 0.7-0.85 m in larger ones), not through the glass.
  entryMetres: 1.5
};
// Free-standing frames along the side walls, turned towards the entrance and kept outside the view cone
// from the station to the screen.
export const FRAME = {
  width: 1.3,
  height: 0.92,
  y: 2.5,
  x: 2.6,
  turn: 0.45,
  // The back pair comes first: it is the pair in view, at the edges, from the station inside.
  z: [2.0, 0.55],
  canvas: { width: 384, height: 272 }
};
export const FRAME_LOAD_DISTANCE = 32;

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
// 1 when the camera stands at the door, 0 beyond `far`.
export function doorTarget(distance) {
  return 1 - smoothstep(HALL.door.near, HALL.door.far, distance);
}
// Moves the door at a steady speed towards its target, without overshoot.
export function stepDoor(open, target, dt) {
  const step = HALL.door.speed * Math.max(0, dt);
  return open + Math.max(-step, Math.min(step, target - open));
}
// Inside the hall's footprint, below the roof, in the pavilion's local frame.
export function insideHall(local) {
  return (
    Math.abs(local.x) < HALL.sideX && local.z > HALL.front - 0.05 && local.z < HALL.back && local.y < HALL.top
  );
}
// Up to four gallery images for the walls: the screen already shows the first one, so it is used only when the
// project has too few others. Each entry keeps its index in the gallery so a click opens that picture.
export function wallImages(images = [], hero = images[0]) {
  const entries = images.map((src, index) => ({ src, index })).filter(e => e.src),
    others = entries.filter(e => e.src !== hero);
  return (others.length >= 2 ? others : entries).slice(0, 4);
}
// Frame k: side (-1 left, +1 right), position and yaw. Left frames face +x and turn towards the entrance.
export function framePlacement(k) {
  const side = k % 2 ? 1 : -1,
    z = FRAME.z[Math.floor(k / 2) % FRAME.z.length];
  return { side, x: side * FRAME.x, z, yaw: side < 0 ? Math.PI / 2 + FRAME.turn : -Math.PI / 2 - FRAME.turn };
}

// UV rectangle of picture k in a hall's 2 × 2 atlas (canvas row 0 is the top of the texture).
export function atlasCell(k) {
  const col = k % 2,
    row = Math.floor(k / 2) % 2;
  return { u0: col / 2, u1: (col + 1) / 2, v0: 1 - (row + 1) / 2, v1: 1 - row / 2 };
}
// One texture per hall holds all its pictures, so the hall's gallery is a single draw.
function atlasTexture(THREE, accent, resources) {
  const { width: W, height: H } = FRAME.canvas,
    canvas = document.createElement('canvas');
  canvas.width = W * 2;
  canvas.height = H * 2;
  const c = paintContext(canvas),
    texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  resources.add(texture);
  const draw = (k, image) => {
    const x0 = (k % 2) * W,
      y0 = Math.floor(k / 2) * H;
    c.fillStyle = '#16121f';
    c.fillRect(x0, y0, W, H);
    c.strokeStyle = accent;
    c.globalAlpha = 0.85;
    c.lineWidth = 3;
    c.strokeRect(x0 + 10, y0 + 10, W - 20, H - 20);
    c.globalAlpha = 1;
    if (image) {
      const pad = 18,
        scale = Math.min((W - pad * 2) / image.naturalWidth, (H - pad * 2) / image.naturalHeight),
        w = image.naturalWidth * scale,
        h = image.naturalHeight * scale;
      c.drawImage(image, x0 + (W - w) / 2, y0 + (H - h) / 2, w, h);
    }
    texture.needsUpdate = true;
  };
  for (let k = 0; k < 4; k++) draw(k, null);
  return { texture, draw };
}

// Builds the glass front with its doors and the gallery frames inside one pavilion group.
// Returns the moving door leaves, the pickable gallery mesh and a loader for its pictures.
export function buildHall(
  THREE,
  { group, mesh, merge, materials, project, images, resources, invalidate, isDisposed, light }
) {
  const { front, sideX, bottom, top, door } = HALL,
    accent = project.accent || '#a895e5';
  // Fixed panes beside the doorway and the transom above it, in slim frames.
  for (const side of [-1, 1]) {
    const inner = door.half,
      outer = sideX - 0.17,
      pane = mesh(new THREE.PlaneGeometry(outer - inner, door.top - bottom), materials.glass, group);
    pane.position.set((side * (inner + outer)) / 2, (bottom + door.top) / 2, front);
    pane.renderOrder = 3;
    const jamb = mesh(new THREE.BoxGeometry(0.06, door.top - bottom, 0.08), materials.frame, group);
    jamb.position.set(side * inner, (bottom + door.top) / 2, front);
    const sill = mesh(new THREE.BoxGeometry(outer - inner, 0.06, 0.08), materials.frame, group);
    sill.position.set((side * (inner + outer)) / 2, bottom, front);
  }
  const transom = mesh(new THREE.PlaneGeometry((sideX - 0.17) * 2, top - door.top), materials.glass, group);
  transom.position.set(0, (door.top + top) / 2, front);
  transom.renderOrder = 3;
  const header = mesh(new THREE.BoxGeometry((sideX - 0.17) * 2, 0.08, 0.1), materials.frame, group);
  header.position.set(0, door.top, front);
  const lintel = mesh(new THREE.BoxGeometry((sideX - 0.17) * 2, 0.06, 0.08), materials.frame, group);
  lintel.position.set(0, top, front);
  // Sliding leaves: glass in a frame with a long pull handle at the meeting edge.
  const leaves = [];
  for (const side of [-1, 1]) {
    const leaf = new THREE.Group(),
      height = door.top - 0.04 - door.bottom;
    leaf.position.set((side * door.half) / 2, door.bottom + height / 2, door.track);
    group.add(leaf);
    const glass = mesh(new THREE.PlaneGeometry(door.half - 0.06, height - 0.06), materials.glass, leaf);
    glass.renderOrder = 3;
    // The leaf moves, so it is never baked into the static merge: its frame is one mesh, not five.
    const parts = [
      ...[-door.half / 2 + 0.025, door.half / 2 - 0.025].map(x =>
        new THREE.BoxGeometry(0.05, height, 0.05).translate(x, 0, 0)
      ),
      ...[-height / 2 + 0.025, height / 2 - 0.025].map(y =>
        new THREE.BoxGeometry(door.half, 0.05, 0.05).translate(0, y, 0)
      ),
      new THREE.BoxGeometry(0.03, 1.1, 0.05).translate(-side * (door.half / 2 - 0.14), -0.25, -0.06)
    ];
    mesh(merge(parts), materials.frame, leaf);
    for (const part of parts) part.dispose();
    leaf.traverse(object => (object.userData.dynamic = true));
    leaves.push({ object: leaf, closedX: (side * door.half) / 2, side });
  }
  // Gallery frames on slim stands, each with a warm picture light above it. The pictures of one hall share an
  // atlas and form one mesh; a click finds its picture by the triangle hit (two per picture).
  const pictures = wallImages(images, project.image),
    atlas = pictures.length ? atlasTexture(THREE, accent, resources) : null,
    faces = [];
  pictures.forEach((picture, k) => {
    const { x, z, yaw } = framePlacement(k),
      stand = new THREE.Group();
    stand.position.set(x, 0, z);
    stand.rotation.y = yaw;
    group.add(stand);
    const border = mesh(
      new THREE.BoxGeometry(FRAME.width + 0.1, FRAME.height + 0.1, 0.05),
      materials.frame,
      stand
    );
    border.position.set(0, FRAME.y, -0.03);
    const post = mesh(
      new THREE.BoxGeometry(0.05, FRAME.y - FRAME.height / 2 - 0.48, 0.05),
      materials.frame,
      stand
    );
    post.position.set(0, (FRAME.y - FRAME.height / 2 + 0.48) / 2, -0.06);
    const foot = mesh(new THREE.BoxGeometry(0.42, 0.03, 0.28), materials.frame, stand);
    foot.position.set(0, 0.5, -0.06);
    const lamp = mesh(new THREE.BoxGeometry(0.62, 0.035, 0.06), light, stand);
    lamp.position.set(0, FRAME.y + FRAME.height / 2 + 0.1, 0.07);
    const face = new THREE.PlaneGeometry(FRAME.width, FRAME.height),
      uv = face.attributes.uv,
      { u0, u1, v0, v1 } = atlasCell(k);
    for (let n = 0; n < uv.count; n++) uv.setXY(n, u0 + uv.getX(n) * (u1 - u0), v0 + uv.getY(n) * (v1 - v0));
    face.applyMatrix4(
      new THREE.Matrix4().compose(
        new THREE.Vector3(x, FRAME.y, z),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
        new THREE.Vector3(1, 1, 1)
      )
    );
    faces.push(face);
  });
  let gallery = null;
  if (faces.length) {
    const material = contentLevel(new THREE.MeshBasicMaterial({ map: atlas.texture, toneMapped: false }));
    resources.add(material);
    gallery = { object: mesh(merge(faces), material, group), images: pictures.map(p => p.index) };
    for (const face of faces) face.dispose();
  }
  let loaded = false;
  function loadPictures() {
    if (loaded) return;
    loaded = true;
    pictures.forEach((picture, k) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => {
        image.onload = image.onerror = null;
        if (isDisposed()) return;
        atlas.draw(k, image);
        invalidate();
      };
      image.onerror = () => {
        image.onload = image.onerror = null;
      };
      image.src = picture.src;
    });
  }
  return {
    leaves,
    gallery,
    loadPictures,
    doorCentre: { x: 0, y: (door.bottom + door.top) / 2, z: front }
  };
}

// Applies an opening amount (0 closed, 1 open) to the leaves.
export function placeLeaves(leaves, open) {
  for (const { object, closedX, side } of leaves)
    object.position.x = closedX + side * HALL.door.travel * open;
}

// The room inside: a warm wooden floor (dry in winter too), a rug in the project's colour, a bench facing the
// screen and tall plants in the back corners, beside the screen but outside the view of it from the station.
export const INTERIOR = {
  floor: { y: 0.486, inset: 0.05, tile: 1.6 },
  rug: { width: 3.4, depth: 2.2, z: 1.45, y: 0.49 },
  bench: { width: 2.0, depth: 0.44, seat: 0.9, z: 2.15 },
  plants: [
    [-2.62, 3.3],
    [2.62, 3.3]
  ]
};

function canvasTexture(THREE, size, draw, resources) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(paintContext(canvas), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  resources.add(texture);
  return texture;
}
// Shared by every hall, so the static merge draws all floors (and bench seats) in one call and all rugs in another.
export function createInteriorMaterials(THREE, resources) {
  const planks = canvasTexture(
    THREE,
    512,
    (c, size) => {
      // A deterministic stream, so every build draws the same planks.
      const random = lcg32(29),
        row = size / 8;
      for (let y = 0; y < size; y += row) {
        let x = -random() * 200;
        while (x < size) {
          const length = 150 + random() * 170,
            tone = 0.82 + random() * 0.3;
          c.fillStyle = `rgb(${Math.round(150 * tone)},${Math.round(100 * tone)},${Math.round(66 * tone)})`;
          c.fillRect(x, y, length, row);
          c.globalAlpha = 0.08;
          c.fillStyle = '#2a170c';
          for (let g = 0; g < 4; g++) c.fillRect(x, y + 4 + random() * (row - 8), length, 1);
          c.globalAlpha = 1;
          c.fillStyle = 'rgba(40,22,12,.75)';
          c.fillRect(x, y, 2, row);
          x += length;
        }
        c.fillStyle = 'rgba(40,22,12,.75)';
        c.fillRect(0, y, size, 2);
      }
    },
    resources
  );
  const weave = canvasTexture(
    THREE,
    256,
    (c, size) => {
      c.fillStyle = '#cfcfcf';
      c.fillRect(0, 0, size, size);
      c.strokeStyle = '#8e8e8e';
      c.lineWidth = 10;
      c.strokeRect(14, 14, size - 28, size - 28);
      c.lineWidth = 3;
      c.strokeRect(34, 34, size - 68, size - 68);
      c.strokeStyle = '#a8a8a8';
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(size / 2, 52);
      c.lineTo(size - 52, size / 2);
      c.lineTo(size / 2, size - 52);
      c.lineTo(52, size / 2);
      c.closePath();
      c.stroke();
    },
    resources
  );
  weave.wrapS = weave.wrapT = THREE.ClampToEdgeWrapping;
  const floor = new THREE.MeshStandardMaterial({
    map: planks,
    roughness: 0.4,
    metalness: 0.05,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4
  });
  const rug = new THREE.MeshStandardMaterial({
    map: weave,
    vertexColors: true,
    roughness: 0.95,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -8
  });
  resources.add(floor);
  resources.add(rug);
  return { floor, rug };
}

// Builds the room's floor, rug, bench and corner plants in the pavilion group.
export function buildInterior(
  THREE,
  { group, mesh, materials, frame, pot, soil, plant, plantMaterial, accent }
) {
  const { floor: f, rug: r, bench: b } = INTERIOR,
    width = (HALL.sideX - f.inset) * 2,
    front = HALL.front + f.inset,
    back = HALL.back - f.inset,
    floorGeometry = new THREE.PlaneGeometry(width, back - front).rotateX(-Math.PI / 2);
  // Planks run along the hall; one texture tile covers `tile` metres.
  const uv = floorGeometry.attributes.uv;
  for (let i = 0; i < uv.count; i++)
    uv.setXY(i, (uv.getX(i) * width) / f.tile, (uv.getY(i) * (back - front)) / f.tile);
  const floor = mesh(floorGeometry, materials.floor, group);
  floor.position.set(0, f.y, (front + back) / 2);
  const tint = new THREE.Color(accent || '#a895e5').multiplyScalar(0.8),
    rugGeometry = new THREE.PlaneGeometry(r.width, r.depth).rotateX(-Math.PI / 2);
  rugGeometry.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(
      Array.from({ length: rugGeometry.attributes.position.count }, () => tint.toArray()).flat(),
      3
    )
  );
  const rug = mesh(rugGeometry, materials.rug, group);
  rug.position.set(0, r.y, r.z);
  // Bench: a plank seat (the floor's wood) on two slim metal frames, facing the screen.
  const seat = mesh(new THREE.BoxGeometry(b.width, 0.07, b.depth), materials.floor, group);
  seat.position.set(0, b.seat, b.z);
  for (const x of [-b.width / 2 + 0.18, b.width / 2 - 0.18]) {
    const leg = mesh(new THREE.BoxGeometry(0.05, b.seat - 0.52, b.depth - 0.04), frame, group);
    leg.position.set(x, (b.seat + 0.48) / 2 - 0.02, b.z);
  }
  for (const [x, z] of INTERIOR.plants)
    pottedPlant(THREE, {
      group,
      mesh,
      pot,
      soil,
      plant,
      plantMaterial,
      x,
      z,
      floor: 0.48,
      turn: x,
      ...TALL_POT
    });
}

// The tall corner tub; the small floor pots in world.mjs use the same builder with their own sizes.
export const TALL_POT = { top: 0.26, bottom: 0.2, height: 0.55, segments: 14 };
// The soil sits this far below the rim, so the rim reads as a pot edge around it.
export const SOIL_DROP = 0.035;
// The stems start this far below the soil surface, so no stem base floats over the pot.
export const STEM_SINK = 0.04;
// Stem bases are pulled inside this share of the pot's top radius, and to at most STEM_RISE above the soil.
export const STEM_SPREAD = 0.55;
export const STEM_RISE = 0.1;

// Moves a card-cluster plant so its stems rise from the origin: the mean stem base on the axis, the lowest one
// STEM_SINK below y 0, every stem base within `radius` of the axis and below STEM_RISE. Card clusters start each card at a jittered
// crown point up to a third of a metre off axis and half a metre up, which stood the leaves beside and above
// their pots. The geometry is shared, so this runs once per geometry (marked in userData).
export function seatPlantGeometry(geometry, radius) {
  if (geometry.userData.seated) return geometry;
  const p = geometry.attributes.position,
    cards = geometry.userData.cards || 1,
    per = p.count / cards;
  let cx = 0,
    cz = 0,
    low = Infinity;
  // The first two vertices of every card are its stem end.
  for (let c = 0; c < cards; c++)
    for (const i of [c * per, c * per + 1]) {
      cx += p.getX(i) / (cards * 2);
      cz += p.getZ(i) / (cards * 2);
      low = Math.min(low, p.getY(i));
    }
  for (let c = 0; c < cards; c++) {
    // Shift the whole card, so its leaf keeps its shape, until its stem end is inside the pot.
    const sx = (p.getX(c * per) + p.getX(c * per + 1)) / 2 - cx,
      sz = (p.getZ(c * per) + p.getZ(c * per + 1)) / 2 - cz,
      reach = Math.hypot(sx, sz),
      pull = reach > radius ? 1 - radius / reach : 0,
      rise = Math.min(p.getY(c * per), p.getY(c * per + 1)) - low,
      drop = low + STEM_SINK + Math.max(0, rise - STEM_RISE);
    for (let i = c * per; i < (c + 1) * per; i++)
      p.setXYZ(i, p.getX(i) - cx - sx * pull, p.getY(i) - drop, p.getZ(i) - cz - sz * pull);
  }
  p.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.seated = true;
  return geometry;
}

// A pot standing on `floor`, filled with soil just under its rim, and the plant rooted in that soil.
export function pottedPlant(
  THREE,
  { group, mesh, pot, soil, plant, plantMaterial, x, z, floor, turn, top, bottom, height, segments }
) {
  const body = height - SOIL_DROP,
    tub = mesh(new THREE.CylinderGeometry(top, bottom, body, segments), pot, group);
  tub.position.set(x, floor + body / 2, z);
  // The open rim above the soil: the pot's lip around the earth.
  const rim = mesh(new THREE.CylinderGeometry(top, top, SOIL_DROP, segments, 1, true), pot, group);
  rim.position.set(x, floor + body + SOIL_DROP / 2, z);
  // The earth 2 cm over the tub's closed top (still under the 3.5 cm lip): 3 mm flickered against it from afar.
  const soilY = floor + body + 0.02,
    earth = mesh(new THREE.CircleGeometry(top * 0.97, segments).rotateX(-Math.PI / 2), soil || pot, group);
  earth.position.set(x, soilY, z);
  const leaves = mesh(seatPlantGeometry(plant, top * STEM_SPREAD), plantMaterial, group);
  leaves.position.set(x, soilY, z);
  leaves.rotation.y = turn;
  return { tub, rim, earth, leaves, soilY };
}
