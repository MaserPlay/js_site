// Where a project's screens are: the stand's main screen as a camera target, and the screen or cork board of
// a section as a rectangle on the page (for the media overlay). world.mjs creates them while it builds a
// garden (buildWorldSteps).
import * as THREE from './vendor/three.module.js';
import { inFrontOfCamera } from './near-plane.mjs';

const V = p => new THREE.Vector3(p.x, p.y, p.z);

export function createScreenLocator(world) {
  const { projects, route, zoneBoards, mainScreens } = world;
  function screenTarget(index) {
    const entry = Number.isInteger(index)
      ? mainScreens[((index % projects.length) + projects.length) % projects.length]
      : null;
    return entry
      ? entry.screen.getWorldPosition(new THREE.Vector3())
      : V(route.radial(index, route.radius + 5.0, 2.8));
  }
  function screenBounds(index, camera, width, height, zone = 'main') {
    const entry =
      zone === 'description' || zone === 'comments'
        ? zoneBoards.find(v => v.index === index && v.zone === zone)?.board
        : mainScreens[index]?.screen;
    if (!entry) return null;
    entry.updateWorldMatrix(true, false);
    entry.geometry.computeBoundingBox();
    const b = entry.geometry.boundingBox,
      points = [];
    for (const x of [b.min.x, b.max.x])
      for (const y of [b.min.y, b.max.y])
        points.push(new THREE.Vector3(x, y, 0).applyMatrix4(entry.matrixWorld));
    // A corner behind the eye would project mirrored (reversed depth keeps it inside -1..1).
    const scratch = new THREE.Vector3();
    if (points.some(v => !inFrontOfCamera(camera, v, scratch))) return null;
    points.forEach(v => v.project(camera));
    const xs = points.map(v => ((v.x + 1) * width) / 2),
      ys = points.map(v => ((1 - v.y) * height) / 2);
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys)
    };
  }
  return { screenTarget, screenBounds };
}
