// How close a point comes to the garden's solid things (obstacle boxes and shapes, rails): pointClearance for the
// camera on flights and in the overview grid, bodyClearance for a standing figure's height under a point. Used
// once the garden is built; world.mjs creates them at the end of its build (buildWorldSteps).
import * as THREE from './vendor/three.module.js';

export function createClearance(world) {
  const { railSegments, obstacleShapes, obstacleBoxes, clearanceLine, clearancePoint } = world;
  function bodyClearance(position, detail = false) {
    let result = Infinity,
      label = '',
      nearest = null;
    const low = position.y - 2.4,
      high = position.y + 0.05;
    for (const shape of obstacleShapes) {
      for (let j = 0; j <= 10; j++) {
        const local = new THREE.Vector3(position.x, low + ((high - low) * j) / 10, position.z).applyMatrix4(
            shape.inverse
          ),
          distance = (shape.distance ? shape.distance(local) : shape.box.distanceToPoint(local)) - 0.35;
        if (distance < result) {
          result = distance;
          label = shape.label;
          nearest = shape;
        }
      }
    }
    // The nearest shape's world centre helps an audit name what is in the way.
    return detail
      ? {
          minimum: result,
          label,
          centre: nearest
            ? nearest.box.getCenter(new THREE.Vector3()).applyMatrix4(nearest.inverse.clone().invert())
            : null
        }
      : result;
  }
  function pointClearance(position, detail = false) {
    let clearance = Infinity,
      nearest = -1;
    for (let index = 0; index < obstacleBoxes.length; index++) {
      const distance = obstacleBoxes[index].distanceToPoint(position);
      if (distance < clearance) {
        clearance = distance;
        nearest = index;
      }
    }
    for (let index = 0; index < railSegments.length; index++) {
      const segment = railSegments[index];
      clearanceLine.set(segment.a, segment.b).closestPointToPoint(position, true, clearancePoint);
      const distance = clearancePoint.distanceTo(position) - segment.radius;
      if (distance < clearance) {
        clearance = distance;
        nearest = obstacleBoxes.length + index;
      }
    }
    if (!detail) return clearance;
    const box = obstacleBoxes[nearest],
      rail = railSegments[nearest - obstacleBoxes.length];
    return {
      clearance,
      nearest: box
        ? { label: obstacleShapes[nearest]?.label, min: box.min.clone(), max: box.max.clone() }
        : rail
          ? { label: 'rail', min: rail.a.clone(), max: rail.b.clone() }
          : null
    };
  }
  return { bodyClearance, pointClearance };
}
