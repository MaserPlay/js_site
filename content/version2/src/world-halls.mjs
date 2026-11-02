// The walk-in halls as the camera moves: each door swings open as it comes near, the pictures load within
// FRAME_LOAD_DISTANCE, the house name shows on the door plaque near and on the roof board from afar, and the
// doorway plaque and curtain dissolve as the camera passes through; hallExit gives the way out for a camera
// standing inside. world.mjs creates them while it builds a garden (buildWorldSteps).
import { doorTarget, stepDoor, FRAME_LOAD_DISTANCE, placeLeaves, insideHall } from './pavilion-hall.mjs';
import * as THREE from './vendor/three.module.js';

export function createHallMotion(world) {
  const { halls, hallDoor, NAME_NEAR, DOORWAY_FADE } = world;
  function updateHalls(position, dt, instant = false) {
    let moving = false;
    for (const hall of halls) {
      hallDoor.set(hall.doorCentre.x, hall.doorCentre.y, hall.doorCentre.z);
      hall.group.localToWorld(hallDoor);
      const distance = Math.hypot(
          position.x - hallDoor.x,
          (position.y - hallDoor.y) * 0.5,
          position.z - hallDoor.z
        ),
        target = doorTarget(distance),
        open = instant ? target : stepDoor(hall.open, target, dt);
      if (open !== hall.open) {
        hall.open = open;
        placeLeaves(hall.leaves, open);
      }
      if (Math.abs(target - open) > 1e-4) moving = true;
      if (distance < FRAME_LOAD_DISTANCE) hall.loadPictures();
      // The house name shows once: the door plaque near, the roof board from afar (2 m apart, so it never flickers).
      const near = distance < (hall.nameNear ? NAME_NEAR + 2 : NAME_NEAR);
      if (near !== hall.nameNear) {
        hall.nameNear = near;
        hall.showName?.(near);
      }
      // The doorway plaque and noren dissolve as the camera comes through the door (greenhouse.mjs fadeDoorway), in
      // steps of a fiftieth so a still camera changes nothing.
      const shown =
        Math.round(THREE.MathUtils.smoothstep(distance, DOORWAY_FADE[0], DOORWAY_FADE[1]) * 50) / 50;
      if (shown !== hall.doorwayShown) {
        hall.doorwayShown = shown;
        hall.fadeDoorway?.(shown);
      }
    }
    return moving;
  }
  // For a camera standing inside a hall: the level world direction out through its front door.
  function hallExit(position) {
    for (const hall of halls) {
      hall.group.updateWorldMatrix(true, false);
      if (!(hall.inside || insideHall)(hall.group.worldToLocal(position.clone()))) continue;
      const origin = hall.group.localToWorld(new THREE.Vector3());
      return hall.group
        .localToWorld(new THREE.Vector3(0, 0, -1))
        .sub(origin)
        .setY(0)
        .normalize();
    }
    return null;
  }
  return { updateHalls, hallExit };
}
