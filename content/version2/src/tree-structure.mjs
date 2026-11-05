// Continuous wood surfaces avoid the exposed diagonal caps of joined cylinders.
export function taperedTube(THREE, points, rootRadius, tipRadius, segments = 4, sides = 5) {
  const curve = Array.isArray(points) ? new THREE.CatmullRomCurve3(points) : points,
    geometry = new THREE.TubeGeometry(curve, segments, 1, sides, false),
    position = geometry.attributes.position;
  for (let j = 0; j <= segments; j++) {
    const t = j / segments,
      center = curve.getPointAt(t),
      radius = rootRadius * Math.pow(1 - t, 0.8) + tipRadius * t;
    for (let k = 0; k <= sides; k++) {
      const i = j * (sides + 1) + k,
        v = new THREE.Vector3()
          .fromBufferAttribute(position, i)
          .sub(center)
          .multiplyScalar(radius)
          .add(center);
      position.setXYZ(i, v.x, v.y, v.z);
    }
  }
  geometry.computeVertexNormals();
  return geometry;
}

// Procedural wood. Lengths are shares of the tree size unless noted.
export const WOOD = {
  sink: 0.14, // trunks start below the lawn, so no cut ring shows at the soil line
  flareHeight: 0.42, // height over which the root flare fades into the bole
  flare: 0.34, // extra radius all round at the soil line
  buttress: 0.36, // extra radius on the ridges that run out into the surface roots (high ridges read as fins)
  buttressWidth: 0.8, // half-width of a ridge, radians
  rootStart: 0.24, // surface roots leave the trunk axis this high above the soil
  rootReach: 0.85, // default root run, shares of the tree size (long runs read as tentacles)
  rootTip: 0.02, // root radius where it dips under the lawn
  rootFlatten: 0.7, // surface roots are wider than tall
  collar: 0.45, // swell where a branch leaves its parent's bark
  collarFade: 0.08, // share of a branch's length over which the collar fades
  inside: 0.86, // a branch's first ring stays within this share of its parent's radius
  lobe: 0.07, // a trunk's cross-section is uneven: two and three lobes that drift round with height
  limbLobe: 0.05, // limbs are slightly oval, not perfect pipes
  wobble: 0.035, // slow swelling and thinning along the bole
  forkSwell: 0.16, // the bole swells where a limb leaves it
  forkWidth: 0.32, // metres per unit tree size over which that swell fades
  limbAlong: 4 // metres: limbs start their bark along-coordinate here, so only trunks and roots get a dark foot
};

// Ring sides per piece; trees on the distant scenic islands use fewer, at the same shape.
export const WOOD_DETAIL = {
  near: { trunk: 10, rings: 8, roots: 5, rootSides: 5, limb: 6, twig: 5 },
  scenic: { trunk: 7, rings: 6, roots: 4, rootSides: 4, limb: 5, twig: 4 }
};

// Around-coordinate: a whole number of bark tiles fitted to the girth of the ring nearest 0.4 of the length.
function tilesAround(uvs, girths, stations, sides, tile) {
  let middle = 0;
  for (let j = 1; j < stations.length; j++)
    if (Math.abs(stations[j] - 0.4) < Math.abs(stations[middle] - 0.4)) middle = j;
  const tiles = Math.max(1, Math.round(girths[middle] / tile));
  for (let j = 0; j < stations.length; j++)
    for (let k = 0; k <= sides; k++) uvs[(j * (sides + 1) + k) * 2] = (k / sides) * tiles;
}

// Rings at chosen stations along a curve. radius(u, dir, centre) sees each ring vertex's world
// direction, so buttresses line up with the roots that leave them. Parallel-transported frames
// keep the rings from twisting. UVs are bark tiles: along in metres / tile (plus along, in metres),
// around a whole number of tiles fitted to the girth near the middle, so procedural bark closes at the seam.
// cap closes the last ring with a low dome, so a thick end never shows as an open pipe.
export function woodTube(
  THREE,
  curve,
  { stations, sides = 6, radius, flatten = 1, tile = 0.9, cap = false, along = 0 }
) {
  const rings = stations.length,
    stride = sides + 1,
    apex = rings * stride,
    positions = new Float32Array((apex + (cap ? 1 : 0)) * 3),
    uvs = new Float32Array((apex + (cap ? 1 : 0)) * 2),
    indices = [],
    length = curve.getLength(),
    tangent = new THREE.Vector3(),
    previous = new THREE.Vector3(),
    normal = new THREE.Vector3(),
    binormal = new THREE.Vector3(),
    centre = new THREE.Vector3(),
    dir = new THREE.Vector3(),
    point = new THREE.Vector3(),
    last = new THREE.Vector3(),
    turn = new THREE.Quaternion(),
    girths = new Float32Array(rings);
  for (let j = 0; j < rings; j++) {
    const u = stations[j];
    curve.getPointAt(u, centre);
    curve.getTangentAt(u, tangent).normalize();
    if (j) normal.applyQuaternion(turn.setFromUnitVectors(previous, tangent));
    else normal.set(Math.abs(tangent.y) > 0.9 ? 1 : 0, Math.abs(tangent.y) > 0.9 ? 0 : 1, 0);
    normal.addScaledVector(tangent, -normal.dot(tangent)).normalize();
    binormal.crossVectors(tangent, normal);
    previous.copy(tangent);
    for (let k = 0; k <= sides; k++) {
      const angle = ((k % sides) / sides) * Math.PI * 2,
        i = j * stride + k;
      dir.copy(normal).multiplyScalar(Math.cos(angle)).addScaledVector(binormal, Math.sin(angle));
      point.copy(dir).multiplyScalar(radius(u, dir, centre));
      point.y *= flatten;
      point.add(centre);
      if (k) girths[j] += point.distanceTo(last);
      last.copy(point);
      positions[i * 3] = point.x;
      positions[i * 3 + 1] = point.y;
      positions[i * 3 + 2] = point.z;
      uvs[i * 2 + 1] = (u * length + along) / tile;
    }
  }
  tilesAround(uvs, girths, stations, sides, tile);
  for (let j = 0; j < rings - 1; j++)
    for (let k = 0; k < sides; k++) {
      const a = j * stride + k,
        b = a + stride;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  if (cap) {
    const end = radius(1, normal, centre);
    centre.addScaledVector(tangent, end * 0.6);
    positions.set([centre.x, centre.y, centre.z], apex * 3);
    uvs.set([0, (length + end * 0.6 + along) / tile], apex * 2);
    for (let k = 0; k < sides; k++)
      indices.push((rings - 1) * stride + k, (rings - 1) * stride + k + 1, apex);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  // The seam column is duplicated for UVs; share its normal so no shading crease runs down the wood.
  const n = geometry.attributes.normal;
  for (let j = 0; j < rings; j++) {
    const a = j * stride,
      b = a + sides;
    dir.set(n.getX(a) + n.getX(b), n.getY(a) + n.getY(b), n.getZ(a) + n.getZ(b)).normalize();
    n.setXYZ(a, dir.x, dir.y, dir.z);
    n.setXYZ(b, dir.x, dir.y, dir.z);
  }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

// Concatenate indexed wood pieces into one geometry (one mesh before the bark bake).
export function joinWood(THREE, parts) {
  let vertices = 0,
    count = 0;
  for (const g of parts) {
    vertices += g.attributes.position.count;
    count += g.index.count;
  }
  const position = new Float32Array(vertices * 3),
    normal = new Float32Array(vertices * 3),
    uv = new Float32Array(vertices * 2),
    index = vertices > 65535 ? new Uint32Array(count) : new Uint16Array(count);
  let v = 0,
    n = 0;
  for (const g of parts) {
    position.set(g.attributes.position.array, v * 3);
    normal.set(g.attributes.normal.array, v * 3);
    uv.set(g.attributes.uv.array, v * 2);
    for (let i = 0; i < g.index.count; i++) index[n++] = g.index.getX(i) + v;
    v += g.attributes.position.count;
    g.dispose();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

const angleGap = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

// A bole that sinks below the lawn and widens into buttresses at the soil line, one ridge per
// surface root, so the tree stands in the ground instead of a cylinder pushed into it.
// profile(u) is the plain trunk radius; flute adds twisted bark ridges (the old central tree).
// The section is lobed and the bole wobbles, so no stretch reads as a lathe-turned pipe; swells are the
// arc-length shares where limbs leave, and the bole thickens there. flare scales the foot (birches flare less).
export function createTrunk(
  THREE,
  curve,
  {
    size,
    ground,
    profile,
    roots = [],
    sides = 10,
    segments = 8,
    flute = 0,
    flutes = 6,
    twist = 0,
    seed = 0,
    swells = [],
    flare = 1
  }
) {
  const length = curve.getLength(),
    top = WOOD.flareHeight * size,
    soil = Math.min(0.3, (WOOD.sink * size) / length),
    flared = Math.min(0.5, ((WOOD.sink + WOOD.flareHeight) * size) / length),
    stations = [0, soil, soil + (flared - soil) * 0.3, soil + (flared - soil) * 0.62, flared];
  // Clamped: rounding past 1 makes CatmullRomCurve3 read a point beyond its last one.
  for (let j = 1; j <= segments; j++) stations.push(Math.min(1, flared + ((1 - flared) * j) / segments));
  // A ring at each fork carries its swell; rings closer than a sixth of a segment to another are skipped.
  const gap = (1 - flared) / segments / 6;
  for (const at of swells)
    if (at > flared && at < 1 && stations.every(v => Math.abs(v - at) > gap)) stations.push(at);
  stations.sort((a, b) => a - b);
  const reach = (WOOD.forkWidth * size) / length,
    phase = seed * 2.7;
  const geometry = woodTube(THREE, curve, {
    stations,
    sides,
    cap: true,
    radius: (u, dir, centre) => {
      const lift = Math.min(1, Math.max(0, (centre.y - ground) / top)),
        fade = (1 - lift) * (1 - lift),
        azimuth = Math.atan2(dir.x, dir.z);
      let ridge = 0;
      for (const angle of roots) {
        const gap = angleGap(azimuth, angle);
        if (gap < WOOD.buttressWidth)
          ridge = Math.max(ridge, 0.5 + 0.5 * Math.cos((Math.PI * gap) / WOOD.buttressWidth));
      }
      let swell = 0;
      for (const at of swells) swell = Math.max(swell, Math.exp(-(((u - at) / reach) ** 2)));
      const lobes =
        0.6 * Math.sin(2 * azimuth + phase + 2.1 * u) + 0.4 * Math.sin(3 * azimuth - phase * 1.3 - 3.2 * u);
      return (
        profile(u) *
        (1 + fade * flare * (WOOD.flare + WOOD.buttress * ridge)) *
        (1 + flute * Math.cos(flutes * azimuth + twist * u)) *
        (1 + WOOD.lobe * lobes) *
        (1 + WOOD.wobble * Math.sin(u * 9.4 + phase) + WOOD.forkSwell * swell)
      );
    }
  });
  return { geometry, soil: curve.getPointAt(soil) };
}

// Surface roots leave the buttresses inside the trunk, run over the lawn and dip under it.
export function createRoots(
  THREE,
  { centre, ground, size, angles, reach = WOOD.rootReach, radius = 0.12, sides = 5, seed = 0 }
) {
  const parts = angles.map((angle, k) => {
    const out = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle)),
      side = new THREE.Vector3(out.z, 0, -out.x),
      wave = Math.sin(seed + k * 2.3),
      span = reach * size * (0.82 + 0.3 * (0.5 + 0.5 * Math.sin(seed * 1.7 + k * 3.1)));
    const at = (d, h, s) =>
      new THREE.Vector3(centre.x, ground + h * size, centre.z)
        .addScaledVector(out, d * span)
        .addScaledVector(side, s * size);
    const curve = new THREE.CatmullRomCurve3([
      at(0, WOOD.rootStart, 0),
      at(0.3, 0.07, 0.05 * wave),
      at(0.62, 0.01, -0.06 * wave),
      at(1, -0.12, 0.03 * wave)
    ]);
    return woodTube(THREE, curve, {
      stations: [0, 0.22, 0.4, 0.58, 0.76, 1],
      sides,
      flatten: WOOD.rootFlatten,
      // A gentle taper keeps roots blunt where they dip under the lawn instead of ending in claws.
      radius: u => radius * size * Math.pow(1 - u, 0.85) + WOOD.rootTip * size
    });
  });
  return joinWood(THREE, parts);
}

// A limb leaves its parent along the parent's grain, arcs out and turns up into its crown.
export function limbCurve(THREE, root, tip, grain, { rise = 0.5, lift = 0.3, sway = 0 } = {}) {
  const span = tip.clone().sub(root),
    length = span.length(),
    out = span.clone().normalize(),
    side = new THREE.Vector3(out.z, 0, -out.x);
  if (side.lengthSq() < 1e-8) side.set(1, 0, 0);
  side.normalize();
  const start = out.clone().addScaledVector(grain, rise).normalize(),
    end = out
      .clone()
      .add(new THREE.Vector3(0, lift, 0))
      .normalize();
  return new THREE.CubicBezierCurve3(
    root.clone(),
    root.clone().addScaledVector(start, length * 0.34),
    tip
      .clone()
      .addScaledVector(end, -length * 0.3)
      .addScaledVector(side, sway * length),
    tip.clone()
  );
}

// Wood from a parent's axis to its tip: the first ring hides inside the parent, a collar swells
// at the parent's bark and fades, then the limb tapers to a tip that meets its twig hub.
export function createLimb(
  THREE,
  curve,
  { parentRadius, rootRadius, tipRadius, sides = 6, segments = 4, seed = 0 }
) {
  const length = curve.getLength(),
    base = Math.min(rootRadius, parentRadius * 0.8),
    exit = Math.min(0.45, parentRadius / length),
    swell = Math.max(0, Math.min(base * (1 + WOOD.collar), parentRadius * WOOD.inside) - base),
    fade = WOOD.collarFade;
  const radiusAt = u =>
    base * Math.pow(1 - u, 0.8) + tipRadius * u + swell * (u <= exit ? 1 : Math.exp(-(u - exit) / fade));
  const stations = [0, exit, exit + fade * 0.6, exit + fade * 1.8];
  const from = stations.at(-1);
  for (let j = 1; j <= segments; j++) stations.push(Math.min(1, from + ((1 - from) * j) / segments));
  return {
    geometry: woodTube(THREE, curve, {
      stations,
      sides,
      cap: true,
      along: WOOD.limbAlong,
      // Oval past the collar only, so the first ring still hides inside the parent.
      radius: (u, dir) =>
        radiusAt(u) *
        (1 + WOOD.limbLobe * Math.min(1, u * 6) * Math.sin(2 * Math.atan2(dir.x, dir.z) + seed + u * 2))
    }),
    radiusAt
  };
}
