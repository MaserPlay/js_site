// The garden's standing lamps: a stone foot, a turned post with a crook arm toward the water and a warm lantern
// hanging from it, kept clear of plants (fixtureBoxes) and listed with its light pool (fixtures) for the
// practical lighting. world.mjs creates the builder while it builds a garden (buildWorldSteps).
import { LANTERN } from './practical-lighting.mjs';
import * as THREE from './vendor/three.module.js';

export function createGardenLamp(world) {
  const {
    fixtureBoxes,
    batch,
    fixtures,
    lanternParts,
    contour,
    hardDistance,
    shoreDistance,
    gardenLampAudit
  } = world;
  function gardenLamp(land, point, aim, purpose) {
    const x = point.x,
      z = point.z,
      base = land.y + 0.2,
      angle = Math.atan2(aim.x, aim.z),
      h = 1.95;
    const part = (kind, material, y, scale, tint) =>
      batch(kind, material, { x, y: base + y, z }, scale, { y: angle }, false, tint);
    part('cylinder', 'stone', 0.07, { x: 0.28, y: 0.14, z: 0.28 });
    // A turned post with a crook arm towards the water; a warm lantern hangs from it (warm in Neon too).
    part('lampCrook', 'rail', 0.14, { x: 1, y: 1, z: 1 });
    const { reach, hang, size } = LANTERN.crook,
      head = { x: x + aim.x * reach, y: base + 0.14 + hang, z: z + aim.z * reach };
    lanternParts(head, size, angle, LANTERN.tint.warm, false);
    fixtureBoxes.push(
      new THREE.Box3(
        new THREE.Vector3(Math.min(x, head.x) - 0.42, base, Math.min(z, head.z) - 0.42),
        new THREE.Vector3(Math.max(x, head.x) + 0.42, base + h + 0.6, Math.max(z, head.z) + 0.42)
      )
    );
    const boundary = Array.from({ length: 26 }, (_, k) => {
      const a = (k / 26) * Math.PI * 2,
        r = land.radius * 0.985 * contour(a, land.profile),
        lx = Math.sin(a) * r * land.stretch,
        lz = (Math.cos(a) * r) / land.stretch;
      return {
        x: land.x + Math.cos(land.rotation) * lx + Math.sin(land.rotation) * lz,
        z: land.z - Math.sin(land.rotation) * lx + Math.cos(land.rotation) * lz
      };
    });
    // These stationary pools are baked into the shared diffuse texture. Keeping
    // them out of the unshadowed real-light pool avoids new light through cliffs.
    fixtures.push({
      x,
      y: base + h - 0.06,
      z,
      base,
      radius: 5.8,
      strength: 2.35,
      channel: 2,
      power: 0,
      aim,
      boundary,
      purpose
    });
    gardenLampAudit.push({
      x,
      z,
      base: land.y,
      purpose,
      groundSamples: 13,
      hardClearance: hardDistance({ x, z, base: land.y, radius: 0.43 }),
      shoreClearance: shoreDistance({ x, z, base: land.y }),
      supported: true
    });
  }
  return { gardenLamp };
}
