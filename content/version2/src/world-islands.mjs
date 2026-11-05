// A floating island's body: the rock underneath, the turf top it is walked on (its outline from `contour`), the
// winter snow on it and the vines hanging from its rim. world.mjs creates the builder while it builds a garden
// (buildWorldSteps) and hands over the scene parts it builds into.
import { LIP } from './terrain-forms.mjs';
import * as THREE from './vendor/three.module.js';

export function createIslandBuilder(world) {
  const {
    floors,
    islandSurfaces,
    palette,
    batch,
    mesh,
    snow,
    random,
    clearOfWalkway,
    contour,
    terrainUV,
    rockGeometry,
    withTurfDepth,
    hangVines
  } = world;
  function island(
    x,
    z,
    radius = 6,
    depth = 6,
    y = 0,
    stretch = 1,
    profile = 0,
    rotation = 0,
    keepClear = []
  ) {
    const cliff = mesh(rockGeometry(radius, depth, 0.18, profile), palette.rock);
    cliff.position.set(x, y, z);
    cliff.scale.set(stretch, 1, 1 / stretch);
    function topGeometry(height, ratio, centre = 0) {
      const g = new THREE.CylinderGeometry(radius * ratio, radius, height, 26).translate(0, centre, 0),
        p = g.attributes.position;
      for (let k = 0; k < p.count; k++) {
        const a = Math.atan2(p.getX(k), p.getZ(k)),
          scale = contour(a, profile);
        p.setX(k, p.getX(k) * scale);
        p.setZ(k, p.getZ(k) * scale);
      }
      g.computeVertexNormals();
      return terrainUV(g);
    }
    // A thin turf slab whose edge overhangs the soil band at the top of the cliff (terrain-forms LIP); its cut edge
    // shades from a grass fringe into earth (configureTurfEdge).
    const top = mesh(
      withTurfDepth(topGeometry(0.2 - LIP.bottom, 0.99, (0.2 + LIP.bottom) / 2), 0.2, 0.2 - LIP.bottom),
      palette.ground
    );
    top.position.set(x, y, z);
    floors.push(top);
    top.scale.set(stretch, 1, 1 / stretch);
    const frost = snow(topGeometry(0.1, 0.985), { x, y: y + 0.23, z }, { x: 1, y: 1, z: 1 });
    frost.scale.set(stretch, 1, 1 / stretch);
    top.rotation.y = frost.rotation.y = cliff.rotation.y = rotation;
    for (let j = 0; j < 11; j++) {
      const a = (j / 11) * Math.PI * 2 + 0.1,
        r = radius * contour(a, profile) * (0.81 + random() * 0.08),
        lx = Math.sin(a) * r * stretch,
        lz = (Math.cos(a) * r) / stretch,
        px = x + Math.cos(rotation) * lx + Math.sin(rotation) * lz,
        pz = z - Math.sin(rotation) * lx + Math.cos(rotation) * lz;
      const localZ = lz + 6.35,
        branchReserved =
          radius > 11 &&
          ((Math.abs(lx) < 2.2 && localZ < -2) ||
            (Math.abs(lx - 4.4) < 2.3 && localZ > -6.5 && localZ < 13) ||
            (Math.abs(localZ - 5.5) < 2.3 && lx > -6.7 && lx < 6.5));
      if (!branchReserved && clearOfWalkway(px, pz, 3.4)) {
        // The three draws stay, so every later draw on this island is unchanged. A stone whose footprint
        // (1.18 of its larger half-size) would touch a platform (platform-site.mjs) is not placed.
        const size = { x: 0.6 + random() * 0.6, y: 0.28 + random() * 0.55, z: 0.6 + random() * 0.6 },
          reach = 1.18 * Math.max(size.x, size.z) + 0.1;
        if (!keepClear.some(c => Math.hypot(lx - c.x, localZ - c.z) < c.r + reach))
          batch('boulder', 'boulder', { x: px, y: y + 0.15, z: pz }, size, { y: a });
      }
    }
    hangVines(x, z, radius, depth, y, stretch, profile, rotation, cliff.geometry);
    const result = { top, frost, cliff, radius, profile, x, z, y, stretch, rotation };
    islandSurfaces.push(result);
    return result;
  }
  return { island };
}
