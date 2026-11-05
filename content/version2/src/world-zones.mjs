// A project's sections (main, description, comments, gallery): where the camera stands for each, and the
// rounded path between two of them, which keeps inside a pavilion and goes straight under a greenhouse roof.
// world.mjs creates them while it builds a garden (buildWorldSteps).
import * as THREE from './vendor/three.module.js';
import { HALL } from './pavilion-hall.mjs';
import { zoneLook as greenhouseLook, GREENHOUSE } from './greenhouse.mjs';

const V = p => new THREE.Vector3(p.x, p.y, p.z);

export function createZonePaths(world) {
  const { route, pavilionGroups, platformSites, greenhouseParts, slotOf, isGreenhouse } = world;
  function zonePose(index, zone) {
    const group = pavilionGroups[slotOf(index)];
    // Inside a greenhouse every section is a turn from one spot on the axis, at the station's eye height.
    if (isGreenhouse(index)) {
      group.updateWorldMatrix(true, false);
      const eye = group.worldToLocal(V(route.point(slotOf(index), HALL.station.wide, 3.3))).y,
        aim = greenhouseParts.get(slotOf(index))?.zoneLook?.(zone) || greenhouseLook(zone);
      return {
        position: group.localToWorld(new THREE.Vector3(0, eye, GREENHOUSE.stand.z)),
        look: group.localToWorld(new THREE.Vector3(aim.x, aim.y, aim.z))
      };
    }
    const positions = { description: [-4.6, 3.3, 5.5], comments: [4.4, 3.3, 10.8] },
      targets = { description: [-4.6, 2.45, 9.6], comments: [4.5, 2.45, 16.0] },
      // The camera keeps its standing point (the path lamp at 2.5, 10.8 is close beside it) and looks at the
      // board where its platform was slid onto the turf (platform-site.mjs).
      site = platformSites[slotOf(index)]?.[zone];
    if (site) targets[zone] = [site[0], targets[zone][1], site[1]];
    return {
      position: group.localToWorld(new THREE.Vector3(...positions[zone])),
      look: group.localToWorld(new THREE.Vector3(...targets[zone]))
    };
  }
  function roundedCurve(points, radius = 0.7) {
    const path = new THREE.CurvePath();
    let previous = points[0];
    for (let i = 1; i < points.length - 1; i++) {
      const corner = points[i],
        distance = Math.min(
          radius,
          previous.distanceTo(corner) * 0.35,
          corner.distanceTo(points[i + 1]) * 0.35
        ),
        entry = corner.clone().addScaledVector(previous.clone().sub(corner).normalize(), distance),
        exit = corner.clone().addScaledVector(points[i + 1].clone().sub(corner).normalize(), distance);
      path.add(new THREE.LineCurve3(previous, entry));
      path.add(new THREE.QuadraticBezierCurve3(entry, corner, exit));
      previous = exit;
    }
    path.add(new THREE.LineCurve3(previous, points.at(-1)));
    return path;
  }
  function zoneCurve(index, fromZone, toZone, from, to) {
    // A greenhouse keeps every section under one roof: a straight step along its axis (the doorway is free).
    if (isGreenhouse(index)) return new THREE.LineCurve3(from.clone(), to.clone());
    const group = pavilionGroups[index],
      local = p => group.localToWorld(new THREE.Vector3(p[0], 3.3, p[1]));
    const front = z => z === 'main' || z === 'gallery',
      junction = [4.4, 5.5],
      entry = [
        [0, -4.5],
        [4.4, -4.5]
      ];
    let points = [];
    if (front(fromZone)) points.push(...entry, junction);
    else if (fromZone === 'description') points.push(junction);
    else points.push(junction);
    if (front(toZone)) points.push(...entry.toReversed());
    return roundedCurve([from.clone(), ...points.map(local), to.clone()]);
  }
  return { zonePose, zoneCurve };
}
