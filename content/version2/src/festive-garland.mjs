import { mergeParts } from './practical-lighting.mjs';
import { BULBS } from './xmas-tree.mjs';
// Winter garlands for the pavilion roofs and the bridge rails, built like the big tree's strings: round bulbs
// (slightly tall) on short sockets hanging from a cord that sags in catenaries between hooks. The bulbs carry
// colour and a twinkle phase that grows along the string, so the tree's twinkle material (winter-firs.mjs)
// rolls slow waves of light along each garland. One merged geometry per garland for bulbs and one for the cord.

export const GARLAND = {
  sides: [8, 5],
  // Bulbs every `spacing` metres along a swag, `drop` below the cord on a socket; `sag` at mid-swag.
  pavilion: {
    hooks: 18,
    sag: 0.3,
    spacing: 0.27,
    bulb: 0.062,
    drop: 0.045,
    cord: 0.011,
    under: 0.04,
    out: 0.03
  },
  rail: { sag: 0.3, spacing: 0.26, bulb: 0.048, drop: 0.035, cord: 0.009, out: 0.12, hook: 1.12 },
  // Twinkle phase per metre of string: the brightness wave travels about 5 m per cycle.
  phase: 0.6
};

// Warm white strings with coloured bulbs between them (the tree's palettes), one look per garland kind.
const mixed = BULBS.multi.flatMap((c, i) => [BULBS.gold[i % 2], c]);
export const GARLAND_COLOURS = {
  pavilion: mixed,
  warm: BULBS.gold,
  ice: [BULBS.ice[0], BULBS.gold[0], BULBS.ice[1], BULBS.gold[1]],
  red: [BULBS.red[0], BULBS.gold[0], BULBS.red[1], BULBS.gold[1]]
};

/** 0 at both hooks, 1 at mid-swag: a hanging chain's catenary (k sets how flat its middle is). */
export function catenarySag(s, k = 1.4) {
  const c = Math.cosh(k);
  return (c - Math.cosh(k * (2 * s - 1))) / (c - 1);
}

/**
 * swags: [{ at(s) → Vector3 cord point (s 0…1, sag included), length }]. Returns the bulb geometry
 * (position, normal, color, twinkle), the cord geometry (cord tubes, sockets and hook clips) and the bulb count.
 */
export function createGarland(THREE, swags, { bulb, spacing, drop, cord, colours, sides = GARLAND.sides }) {
  const sphere = new THREE.SphereGeometry(1, ...sides).toNonIndexed(),
    sp = sphere.attributes.position,
    sn = sphere.attributes.normal,
    position = [],
    normal = [],
    color = [],
    twinkle = [],
    cords = [];
  let count = 0,
    travelled = 0;
  for (const swag of swags) {
    const n = Math.max(2, Math.round(swag.length / spacing)),
      steps = Math.max(6, Math.ceil(swag.length / 0.12)),
      path = Array.from({ length: steps + 1 }, (_, k) => swag.at(k / steps));
    cords.push([
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path), path.length, cord, 3),
      new THREE.Matrix4()
    ]);
    // A clip at the hook where this swag starts.
    cords.push([new THREE.SphereGeometry(cord * 2.6, 5, 3), new THREE.Matrix4().makeTranslation(path[0])]);
    for (let j = 0; j < n; j++) {
      const s = (j + 0.5) / n,
        top = swag.at(s),
        socket = drop + bulb * 0.35,
        centre = top.clone().setY(top.y - drop - bulb * 1.15),
        rgb = colours[count % colours.length],
        phase = (travelled + s * swag.length) * GARLAND.phase;
      cords.push([
        new THREE.CylinderGeometry(bulb * 0.42, bulb * 0.5, socket, 5, 1, true),
        new THREE.Matrix4().makeTranslation(top.x, top.y - socket / 2, top.z)
      ]);
      for (let v = 0; v < sp.count; v++) {
        position.push(
          centre.x + sp.getX(v) * bulb,
          centre.y + sp.getY(v) * bulb * 1.2,
          centre.z + sp.getZ(v) * bulb
        );
        normal.push(sn.getX(v), sn.getY(v), sn.getZ(v));
        color.push(...rgb);
        twinkle.push(phase);
      }
      count++;
    }
    travelled += swag.length;
  }
  sphere.dispose();
  const bulbs = new THREE.BufferGeometry();
  bulbs.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  bulbs.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  bulbs.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
  bulbs.setAttribute('twinkle', new THREE.Float32BufferAttribute(twinkle, 1));
  bulbs.computeBoundingBox();
  bulbs.computeBoundingSphere();
  return { bulbs, cord: mergeParts(THREE, cords), count };
}

/** Swags hanging under an elliptical roof edge (plan centre z = cz), `hooks` hooks evenly round it. */
export function roofSwags(THREE, { rx, rz, cz, y }, spec = GARLAND.pavilion) {
  const r = 1 + spec.out / Math.max(rx, rz),
    swags = [];
  for (let k = 0; k < spec.hooks; k++) {
    const a0 = (k / spec.hooks) * Math.PI * 2,
      a1 = ((k + 1) / spec.hooks) * Math.PI * 2;
    const at = s => {
      const a = a0 + (a1 - a0) * s;
      return new THREE.Vector3(
        Math.sin(a) * rx * r,
        y - spec.under - spec.sag * catenarySag(s),
        cz + Math.cos(a) * rz * r
      );
    };
    let length = 0;
    for (let q = 1; q <= 8; q++) length += at(q / 8).distanceTo(at((q - 1) / 8));
    swags.push({ at, length });
  }
  return swags;
}

/** Swags between consecutive posts: point(p, h) is the rail-side point at path parameter p, height h. */
export function railSwags(THREE, posts, point, spec = GARLAND.rail) {
  const swags = [];
  for (let k = 1; k < posts.length; k++) {
    const p0 = posts[k - 1],
      p1 = posts[k];
    const at = s => {
      const v = point(p0 + (p1 - p0) * s, spec.hook);
      v.y -= spec.sag * catenarySag(s);
      return v;
    };
    let length = 0;
    for (let q = 1; q <= 8; q++) length += at(q / 8).distanceTo(at((q - 1) / 8));
    swags.push({ at, length });
  }
  return swags;
}
