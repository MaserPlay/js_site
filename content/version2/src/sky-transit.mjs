// Tall-islands preview (?preview=tall): water lifts on spans too steep to walk, and a zipline from the highest
// island down to a far one. Both are one-draw effects plus a few static parts.
import { paintContext } from './paint-canvas.mjs';
export const LIFT_COLUMN = { radius: 2.9, below: 1.2, above: 4 };
export const ZIPLINE = { tower: 6.5, landing: 3.4, sag: 0.08, hang: 1.25, lane: -1.55, reach: 14, clear: 9 };

// A point on the cable at fraction t: a straight line with a parabolic sag of `sag` × span length.
export function cablePoint(a, b, t, sag = ZIPLINE.sag) {
  const length = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t - 4 * sag * length * t * (1 - t),
    z: a.z + (b.z - a.z) * t
  };
}

// Garden wayfinding: a carved wooden plank with cream-painted lettering beside a small brass-ringed pictogram
// (tethered balloon, touring balloon, zipline pulley, telescope) instead of a drawn arrow. `tip` ('left' |
// 'right') cuts the plank into a fingerpost pointing that way. Front and back are separate one-sided faces, so
// the text never reads mirrored from behind; both are listed in userData.faces for picking.
export const SIGN = {
  // Canvas pixels per metre of plank, capped: crisp a step away, mipmapped and anisotropic from the overview.
  density: 640,
  max: 1024,
  anisotropy: 8,
  // Plank thickness (metres between the two faces).
  thick: 0.06,
  // Fingerpost tip length as a share of the plank height.
  point: 0.42,
  wood: { light: '#a77a4f', mid: '#86593a', dark: '#5a3a25', groove: '#3a2417', ink: '#f6e7c4' },
  brass: { light: '#f3d488', dark: '#9a7333' },
  font: '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, "Noto Serif", serif'
};

// Deterministic grain: long wavy streaks, darker and lighter than the plank.
function woodGrain(c, w, h, seed) {
  let s = seed;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  for (let i = 0; i < 26; i++) {
    const y = rand() * h,
      amp = 2 + rand() * h * 0.03,
      freq = 2 + rand() * 4,
      phase = rand() * 6;
    c.strokeStyle = rand() < 0.6 ? 'rgba(58,36,23,0.22)' : 'rgba(214,170,120,0.18)';
    c.lineWidth = 1 + rand() * h * 0.012;
    c.beginPath();
    for (let j = 0; j <= 48; j++) {
      const x = (w * j) / 48,
        yy = y + Math.sin((j / 48) * freq * Math.PI + phase) * amp;
      if (j) c.lineTo(x, yy);
      else c.moveTo(x, yy);
    }
    c.stroke();
  }
}

// The plank outline: rounded corners, or a fingerpost tip on one side.
function plankPath(c, w, h, tip) {
  const r = h * 0.16,
    point = h * SIGN.point,
    left = tip === 'left' ? point : 0,
    right = tip === 'right' ? w - point : w;
  c.beginPath();
  if (tip === 'left') c.moveTo(left, 0);
  else c.moveTo(r, 0);
  if (tip === 'right') {
    c.lineTo(right, 0);
    c.lineTo(w, h / 2);
    c.lineTo(right, h);
  } else {
    c.lineTo(w - r, 0);
    c.quadraticCurveTo(w, 0, w, r);
    c.lineTo(w, h - r);
    c.quadraticCurveTo(w, h, w - r, h);
  }
  if (tip === 'left') {
    c.lineTo(left, h);
    c.lineTo(0, h / 2);
  } else {
    c.lineTo(r, h);
    c.quadraticCurveTo(0, h, 0, h - r);
    c.lineTo(0, r);
    c.quadraticCurveTo(0, 0, r, 0);
  }
  c.closePath();
}

function strokes(c, segments) {
  c.beginPath();
  for (const [x0, y0, x1, y1] of segments) {
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
  }
  c.stroke();
}

// A hot-air balloon: envelope with carved gores, ropes and basket; the tour adds a dotted flight path, the lift a
// tether down to its peg.
function balloonIcon(c, tour) {
  c.beginPath();
  c.moveTo(0, 0.12);
  c.bezierCurveTo(-0.44, -0.12, -0.36, -0.5, 0, -0.5);
  c.bezierCurveTo(0.36, -0.5, 0.44, -0.12, 0, 0.12);
  c.fill();
  c.save();
  c.globalCompositeOperation = 'destination-out';
  c.lineWidth = 0.035;
  for (const k of [-0.13, 0.13]) {
    c.beginPath();
    c.moveTo(0, -0.49);
    c.quadraticCurveTo(k * 1.8, -0.2, 0, 0.1);
    c.stroke();
  }
  c.restore();
  c.lineWidth = 0.035;
  strokes(c, [
    [-0.07, 0.13, -0.07, 0.24],
    [0.07, 0.13, 0.07, 0.24]
  ]);
  c.fillRect(-0.1, 0.24, 0.2, 0.13);
  if (tour) {
    c.setLineDash?.([0.04, 0.05]);
    c.lineWidth = 0.035;
    c.beginPath();
    c.arc(0, -0.08, 0.52, 0.35, 2.2);
    c.stroke();
    c.setLineDash?.([]);
  } else {
    c.lineWidth = 0.025;
    strokes(c, [[0, 0.37, 0, 0.5]]);
    c.fillRect(-0.12, 0.48, 0.24, 0.04);
  }
}

// Pictograms, drawn in a unit box centred on (0, 0).
const ICONS = {
  lift: c => balloonIcon(c, false),
  tour: c => balloonIcon(c, true),
  zip(c) {
    c.lineWidth = 0.045;
    strokes(c, [[-0.5, -0.38, 0.5, 0.12]]);
    // Pulley on the cable, harness straps down to a bar.
    c.beginPath();
    c.arc(-0.02, -0.17, 0.11, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 0.03;
    strokes(c, [
      [-0.06, -0.08, -0.16, 0.3],
      [0.02, -0.08, 0.12, 0.3]
    ]);
    c.lineWidth = 0.05;
    strokes(c, [[-0.22, 0.32, 0.18, 0.32]]);
  },
  telescope(c) {
    c.save();
    c.translate(0, -0.12);
    c.rotate(-0.5);
    c.beginPath();
    c.moveTo(-0.42, -0.07);
    c.lineTo(0.3, -0.12);
    c.lineTo(0.3, 0.12);
    c.lineTo(-0.42, 0.07);
    c.closePath();
    c.fill();
    c.fillRect(0.3, -0.14, 0.08, 0.28);
    c.restore();
    c.lineWidth = 0.04;
    strokes(c, [
      [0, -0.08, -0.24, 0.46],
      [0, -0.08, 0.24, 0.46],
      [0, -0.08, 0, 0.46]
    ]);
  }
};

// A brass-ringed round inlay holding a pictogram, centred at (x, y), radius r.
export function drawInlay(c, icon, x, y, r, ink = SIGN.wood.ink, ground = SIGN.wood.dark) {
  const brass = c.createLinearGradient(x - r, y - r, x + r, y + r);
  brass.addColorStop(0, SIGN.brass.light);
  brass.addColorStop(1, SIGN.brass.dark);
  c.fillStyle = brass;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = ground;
  c.beginPath();
  c.arc(x, y, r * 0.84, 0, Math.PI * 2);
  c.fill();
  if (!ICONS[icon]) return;
  c.save();
  c.translate(x, y);
  c.scale(r * 1.3, r * 1.3);
  c.fillStyle = ink;
  c.strokeStyle = ink;
  c.lineCap = 'round';
  ICONS[icon](c);
  c.restore();
}

// Lettering that fits `room` pixels: painted with a carved shadow under it. Returns the font size used.
export function paintText(
  c,
  text,
  cx,
  cy,
  room,
  size,
  { ink = SIGN.wood.ink, shadow = 'rgba(30,16,8,0.75)' } = {}
) {
  c.font = `600 ${size}px ${SIGN.font}`;
  const measured = c.measureText?.(text)?.width;
  if (Number.isFinite(measured) && measured > room) size *= room / measured;
  c.font = `600 ${size}px ${SIGN.font}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = shadow;
  c.fillText(text, cx + size * 0.03, cy + size * 0.05);
  c.fillStyle = ink;
  c.fillText(text, cx, cy);
  return size;
}

// A plank of w × h pixels: wood, a carved border with brass studs, the inlay and the lettering.
export function drawSignCanvas(c, w, h, text, { icon = null, tip = null, seed = 7 } = {}) {
  c.clearRect(0, 0, w, h);
  plankPath(c, w, h, tip);
  c.save();
  c.clip();
  const wood = c.createLinearGradient(0, 0, 0, h);
  wood.addColorStop(0, SIGN.wood.light);
  wood.addColorStop(0.55, SIGN.wood.mid);
  wood.addColorStop(1, SIGN.wood.dark);
  c.fillStyle = wood;
  c.fillRect(0, 0, w, h);
  woodGrain(c, w, h, seed);
  c.restore();
  const inset = h * 0.1,
    point = h * SIGN.point,
    x0 = inset + (tip === 'left' ? point * 0.7 : 0),
    x1 = w - inset - (tip === 'right' ? point * 0.7 : 0);
  // Carved border: a dark groove with a light lip under it.
  c.lineJoin = 'round';
  c.lineWidth = Math.max(2, h * 0.025);
  c.strokeStyle = 'rgba(255,226,180,0.35)';
  c.strokeRect(x0, inset + 2, x1 - x0, h - inset * 2);
  c.strokeStyle = SIGN.wood.groove;
  c.strokeRect(x0, inset, x1 - x0, h - inset * 2);
  for (const [x, y] of [
    [x0, inset],
    [x1, inset],
    [x0, h - inset],
    [x1, h - inset]
  ]) {
    c.fillStyle = SIGN.brass.dark;
    c.beginPath();
    c.arc(x, y, h * 0.035, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = SIGN.brass.light;
    c.beginPath();
    c.arc(x - h * 0.008, y - h * 0.008, h * 0.017, 0, Math.PI * 2);
    c.fill();
  }
  const r = (h - inset * 2) * 0.37,
    iconX = x0 + inset * 0.7 + r;
  if (icon) drawInlay(c, icon, iconX, h / 2, r);
  const left = icon ? iconX + r + inset * 0.6 : x0 + inset,
    room = x1 - inset * 0.8 - left;
  paintText(c, text, left + room / 2, h / 2 + h * 0.02, room, h * 0.42);
}

function signTexture(THREE, resources, w, h, text, options) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  drawSignCanvas(paintContext(canvas), w, h, text, options);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = SIGN.anisotropy;
  resources.add(texture);
  return texture;
}

// A plank sign width × height metres, centred on its own position. Returns the front face (+z side, turned with
// lookAt); the back face is its child.
export function createTransitSign(
  THREE,
  { mesh, resources },
  text,
  { width, height = width * 0.3, icon = null, tip = null, seed = 7 }
) {
  const w = Math.min(SIGN.max, Math.round((width * SIGN.density) / 8) * 8),
    h = Math.max(32, Math.round((w * height) / width));
  const face = (texture, parent) => {
    // Cut out (alphaTest), not blended: no sorting against the balloons and railings behind it.
    const material = new THREE.MeshBasicMaterial({ map: texture, alphaTest: 0.5, toneMapped: false });
    resources.add(material);
    const plane = mesh(new THREE.PlaneGeometry(width, height), material, parent);
    plane.userData.dynamic = true;
    return plane;
  };
  const front = face(signTexture(THREE, resources, w, h, text, { icon, tip, seed }));
  // Seen from behind, a fingerpost tip lies on the other side of the canvas: the back gets its own plank.
  const backTip = { left: 'right', right: 'left' }[tip] || null,
    back = face(
      tip ? signTexture(THREE, resources, w, h, text, { icon, tip: backTip, seed }) : front.material.map,
      front
    );
  back.rotation.y = Math.PI;
  back.position.z = -SIGN.thick;
  front.userData.faces = [front, back];
  front.userData.materials = [front.material, back.material];
  return front;
}

function liftMaterial(THREE) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 } },
    vertexShader: `varying vec2 vUv;
        void main(){
          vUv=uv;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
        }`,
    // Rising bands and soft vertical streaks; brightest at the base and fading at the top.
    fragmentShader: `uniform float time;varying vec2 vUv;
      void main(){
        float bands=.5+.5*sin(vUv.y*38.-time*3.2+sin(vUv.x*31.4)*1.4);
        float streak=.55+.45*sin(vUv.x*62.8+time*.7);
        float fade=(1.-smoothstep(.75,1.,vUv.y))*(.55+.45*(1.-vUv.y));
        gl_FragColor=vec4(vec3(.32,.78,1.)*(.35+.65*bands*streak),.22*fade);
      }`
  });
}

export function createSkyTransit(
  THREE,
  { route, mesh, line, batch, stone, resources, frames, pickable, labels }
) {
  const parts = { lifts: [], zipline: null };
  const lift = liftMaterial(THREE);
  resources.add(lift);
  for (let i = 0; i < route.segments; i++) {
    if (!route.isLift(i)) continue;
    const [from, to] = route.climbSpan(i),
      low = Math.min(route.point(i + from).y, route.point(i + to).y),
      high = Math.max(route.point(i + from).y, route.point(i + to).y),
      c = route.point(i + (from + to) / 2),
      height = high - low + LIFT_COLUMN.below + LIFT_COLUMN.above;
    const column = mesh(
      new THREE.CylinderGeometry(LIFT_COLUMN.radius, LIFT_COLUMN.radius, height, 40, 1, true),
      lift
    );
    column.position.set(c.x, low - LIFT_COLUMN.below + height / 2, c.z);
    column.userData.dynamic = true;
    column.renderOrder = 6;
    // A stone basin at the foot and a ring at the top.
    const basin = mesh(
      new THREE.CylinderGeometry(LIFT_COLUMN.radius + 0.3, LIFT_COLUMN.radius + 0.5, 0.5, 40),
      stone
    );
    basin.position.set(c.x, low - 0.75, c.z);
    parts.lifts.push({ segment: i, low, high, x: c.x, z: c.z });
  }
  // Zipline: from the highest island to the lowest island two or more stations away, never past the centre.
  if (frames.length >= 4) {
    const order = frames.map((f, i) => i).sort((a, b) => frames[b].y - frames[a].y),
      top = order[0];
    // Among islands two or more stations away and at least 8 m lower, take the one whose cable clears every other
    // island (its ground, pavilion and trees: ZIPLINE.clear above its centre height within ZIPLINE.reach) best.
    const plan = far => {
      const deckA = route.point(top, ZIPLINE.lane),
        deckB = route.point(far, ZIPLINE.lane),
        start = { x: deckA.x, y: deckA.y + ZIPLINE.tower, z: deckA.z },
        end = { x: deckB.x, y: deckB.y + ZIPLINE.landing, z: deckB.z };
      let clearance = Infinity;
      for (let j = 1; j < 40; j++) {
        const p = cablePoint(start, end, j / 40);
        frames.forEach((f, k) => {
          if (k === top || k === far || Math.hypot(p.x - f.x, p.z - f.z) > ZIPLINE.reach) return;
          clearance = Math.min(clearance, p.y - (f.y + ZIPLINE.clear));
        });
      }
      return { far, deckA, deckB, start, end, clearance };
    };
    const best = frames
      .map((f, i) => i)
      .filter(i => {
        const gap = Math.min(Math.abs(i - top), frames.length - Math.abs(i - top));
        return gap >= 2 && frames[top].y - frames[i].y > 8;
      })
      .map(plan)
      .sort((a, b) => b.clearance - a.clearance)[0];
    if (best && best.clearance > 0) {
      const { far, deckA, deckB, start, end } = best;
      for (const [p, h] of [
        [start, ZIPLINE.tower],
        [end, ZIPLINE.landing]
      ]) {
        batch('box', 'rail', { x: p.x, y: p.y - h / 2, z: p.z }, { x: 0.35, y: h, z: 0.35 });
        batch('box', 'stone', { x: p.x, y: p.y - h + 0.3, z: p.z }, { x: 1.4, y: 0.6, z: 1.4 });
      }
      line(
        Array.from({ length: 41 }, (_, j) => cablePoint(start, end, j / 40)),
        'rail',
        0.05
      );
      // A plank nailed to the tower's front, clear of the post itself: clicking it starts the ride.
      const sign = createTransitSign(THREE, { mesh, resources }, labels.zipline || 'Zipline', {
          width: 2.2,
          height: 0.62,
          icon: 'zip'
        }),
        facing = route.point(top, 2.5, 1.9),
        fx = facing.x - start.x,
        fz = facing.z - start.z,
        fl = Math.hypot(fx, fz) || 1;
      sign.position.set(start.x + (fx / fl) * 0.24, deckA.y + 1.9, start.z + (fz / fl) * 0.24);
      sign.lookAt(facing.x, sign.position.y, facing.z);
      parts.zipline = { from: top, to: far, start, end, deckA, deckB };
      for (const object of sign.userData.faces)
        pickable.push({ object, kind: 'zipline', index: top, to: far });
    }
  }
  return {
    ...parts,
    update(now) {
      lift.uniforms.time.value = now / 1000;
    }
  };
}
