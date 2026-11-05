// Audit-only measurements of a finished garden: snow clear of the falls, flight sections, the walking route,
// bridge geometry, plants on their ground and water sheets clear of the rock. The tests and
// window.__gardenDebug read them; the garden itself never does. world.mjs hands over what they measure once
// its build is done (buildWorldSteps, just before it returns the world).
import * as THREE from './vendor/three.module.js';
import { HALL } from './pavilion-hall.mjs';
import { laneBoxDistance, unrailedEdges } from './bridge-structure.mjs';
import { plantForm, formMatrix } from './plant-forms.mjs';
import { WINTER_FOLIAGE_SCALE } from './winter-geometry.mjs';

const V = p => new THREE.Vector3(p.x, p.y, p.z);

export function createWorldAudits(world) {
  const {
    projects,
    scene,
    palette,
    geometries,
    winterObjects,
    waterZones,
    waterSurfaces,
    route,
    zonePose,
    zoneCurve,
    bodyClearance,
    floors,
    pointClearance,
    edgeOffset,
    railIslands,
    railSpans,
    waterStairs,
    bridgeEdges,
    bridgeWidth,
    bridgeLandings,
    obstacleBoxes,
    obstacleShapes,
    treeBounds,
    islandSurfaces,
    acceptedPlants,
    plantFixtureHits,
    rimPlacementMs,
    lawnPlacementMs,
    lawnDonors,
    lawnDonor
  } = world;
  function snowAudit() {
    const objects = winterObjects.filter(
        object => object.parent && object.isMesh && object.material === palette.snow
      ),
      ray = new THREE.Raycaster(),
      direction = new THREE.Vector3(0, -1, 0);
    let blocked = 0,
      samples = 0;
    scene.updateMatrixWorld(true);
    for (const zone of waterZones) {
      const finish = zone.lip.clone().sub(zone.center).dot(zone.flow) + 1.15;
      for (let i = 0; i < 9; i++)
        for (const side of [-1, 0, 1]) {
          const point = zone.center
            .clone()
            .addScaledVector(zone.flow, zone.rz * 0.6 + ((finish - zone.rz * 0.6) * i) / 8)
            .addScaledVector(zone.across, side * zone.width * 0.15);
          point.y = zone.base + 0.35;
          ray.set(point, direction);
          ray.near = 0;
          ray.far = 0.16;
          samples++;
          if (ray.intersectObjects(objects, false).length) blocked++;
        }
    }
    let waterMouthSamples = 0,
      waterMouthBlocked = 0;
    for (const surface of waterSurfaces) {
      const p = surface.geometry.attributes.position;
      for (let row = 5; row <= 7; row++)
        for (let column = 0; column <= surface.columns; column++) {
          const index = row * (surface.columns + 1) + column,
            point = new THREE.Vector3(p.getX(index), surface.base + 0.4, p.getZ(index));
          ray.set(point, direction);
          ray.near = 0;
          ray.far = 0.25;
          waterMouthSamples++;
          if (ray.intersectObjects(objects, false).length) waterMouthBlocked++;
        }
    }
    return {
      outlets: waterZones.length,
      samples,
      blocked,
      waterMouthSamples,
      waterMouthBlocked,
      canopyScale: WINTER_FOLIAGE_SCALE,
      canopyCapTriangles: geometries.crownSnow.attributes.position.count / 3,
      firCapTriangles: geometries.firSnow.attributes.position.count / 3,
      // Triangles per small fir and for the central fir (needles, trunk, twigs, cord, bulbs, star, decor).
      firTriangles: Object.fromEntries(
        [
          ['small', ['firNeedles', 'firTrunk', 'firTwigs', 'firCord', 'firBulbs', 'firStar']],
          [
            'central',
            [
              'centralFirNeedles',
              'centralFirTrunk',
              'centralFirTwigs',
              'centralFirCord',
              'centralFirBulbs',
              'centralFirDecor',
              'centralFirStar'
            ]
          ]
        ].map(([name, keys]) => [
          name,
          keys.reduce(
            (n, k) => n + (geometries[k].index?.count ?? geometries[k].attributes.position.count) / 3,
            0
          )
        ])
      )
    };
  }
  function sectionAudit() {
    const records = [];
    for (let index = 0; index < projects.length; index++)
      for (const [fromZone, toZone] of [
        ['main', 'description'],
        ['description', 'comments'],
        ['comments', 'gallery']
      ]) {
        const pose = z =>
            z === 'main' || z === 'gallery'
              ? V(route.point(index, HALL.station.wide, 3.3))
              : zonePose(index, z).position,
          curve = zoneCurve(index, fromZone, toZone, pose(fromZone), pose(toZone));
        let minimum = Infinity,
          at = 0,
          obstacle = null;
        for (let j = 0; j <= 200; j++) {
          const c = bodyClearance(curve.getPoint(j / 200));
          if (c < minimum) {
            minimum = c;
            at = j / 200;
            obstacle = bodyClearance(curve.getPoint(j / 200), true).label;
          }
        }
        records.push({ index, fromZone, toZone, minimum, at, obstacle });
      }
    return records;
  }
  function routeAudit(cameraPoint) {
    const ray = new THREE.Raycaster(),
      down = new THREE.Vector3(0, -1, 0);
    let noFloor = 0,
      minClearance = Infinity,
      maxFloorGap = 0;
    const samples = route.segments * 100;
    for (let i = 0; i < samples; i++) {
      const p = (i / samples) * route.segments,
        position = cameraPoint ? cameraPoint(p) : V(route.point(p, 0, 2.9));
      ray.set(position, down);
      const hit = ray.intersectObjects(floors, false)[0];
      if (!hit) noFloor++;
      else maxFloorGap = Math.max(maxFloorGap, hit.distance);
      minClearance = Math.min(minClearance, pointClearance(position));
    }
    // Covered deck: a floor (island ground, a pad) lying above the walking surface, where the route dives
    // under an island top. Checked on the centre line and both walking lanes.
    let coveredDeck = 0,
      coveredDepth = 0;
    const coveredAt = [];
    for (let i = 0; i < samples; i++) {
      const p = (i / samples) * route.segments;
      for (const lane of [-1.6, 0, 1.6]) {
        const deck = route.point(p, lane, 0.02);
        ray.set(V(route.point(p, lane, 6)), down);
        const hit = ray.intersectObjects(floors, false)[0];
        if (hit && hit.object.material === palette.ground && hit.point.y > deck.y) {
          coveredDeck++;
          coveredDepth = Math.max(coveredDepth, hit.point.y - deck.y);
          if (coveredAt.length < 40)
            coveredAt.push([Math.round(p * 100) / 100, lane, Math.round((hit.point.y - deck.y) * 100) / 100]);
        }
      }
    }
    const unrailed = unrailedEdges(route, railIslands, railSpans, { edge: edgeOffset });
    return {
      samples,
      noFloor,
      minClearance,
      maxFloorGap,
      coveredDeck,
      coveredDepth,
      coveredAt,
      count: projects.length,
      segments: route.segments,
      bridgeLoopClosed: route.closed,
      radius: route.radius,
      unrailedEdge: Math.max(0, ...unrailed.map(r => r.metres)),
      waterStairs: waterStairs.length
    };
  }
  function geometryAudit() {
    let wrongEdges = 0,
      minEdgeOffset = Infinity,
      maxEdgeOverflow = 0,
      objectsInLane = 0;
    for (const edge of bridgeEdges) {
      const center = route.point(edge.p),
        normal = route.normal(edge.p),
        actual = (edge.point.x - center.x) * normal.x + (edge.point.z - center.z) * normal.z;
      minEdgeOffset = Math.min(minEdgeOffset, Math.abs(actual));
      maxEdgeOverflow = Math.max(maxEdgeOverflow, Math.abs(actual) - edge.halfWidth);
      if (Math.abs(actual) < 2.05 || Math.abs(actual) > edge.halfWidth + 0.01) wrongEdges++;
    }
    for (let i = 0; i < route.segments * 100; i++) {
      const p = route.point(i / 100);
      for (const [index, box] of obstacleBoxes.entries()) {
        if (box.min.y > p.y + 1.9 || box.max.y < p.y + 0.2) continue;
        const dx = Math.max(box.min.x - p.x, 0, p.x - box.max.x),
          dz = Math.max(box.min.z - p.z, 0, p.z - box.max.z);
        if (Math.hypot(dx, dz) < 0.65) {
          const shape = obstacleShapes[index];
          if (laneBoxDistance(THREE, p, shape) < 0.65) objectsInLane++;
        }
      }
    }
    const treePavilionOverlap = treeBounds.filter(
      t => Math.abs(t.x) - t.r < 4 && Math.abs(t.z - 0.25) - t.r < 3
    ).length;
    return {
      edgeSamples: bridgeEdges.length,
      wrongEdges,
      minEdgeOffset,
      maxEdgeOverflow,
      objectsInLane,
      treePavilionOverlap,
      screenFrameMargin: 0.075,
      spokeJunctionGap: 3.6,
      bridgeWidth,
      pointLights: 3,
      bridgeStructure: {
        deckDepth: 0.5,
        curbHeight: 0.18,
        landingCount: bridgeLandings.length,
        landings: bridgeLandings,
        transverseRibs: route.segments * 6 + (route.count ? 5 : 0)
      }
    };
  }
  function groundingAudit() {
    const moved = acceptedPlants.filter(p => p.relocated),
      rim = acceptedPlants.filter(p => p.rim),
      lawn = acceptedPlants.filter(p => p.lawn),
      ray = new THREE.Raycaster(),
      down = new THREE.Vector3(0, -1, 0);
    let samples = 0,
      misses = 0,
      maxLeafRadiusRatio = 0;
    for (const p of [...moved, ...rim, ...lawn])
      for (let j = -1; j < 12; j++) {
        const a = (j / 12) * Math.PI * 2,
          r = j < 0 ? 0 : p.rootRadius || p.radius;
        ray.set(new THREE.Vector3(p.x + Math.sin(a) * r, p.base + 1, p.z + Math.cos(a) * r), down);
        samples++;
        if (
          !ray
            .intersectObjects(
              islandSurfaces.map(s => s.top),
              false
            )
            .some(hit => Math.abs(hit.point.y - p.base - 0.2) < 0.15)
        )
          misses++;
      }
    const species = {};
    let fixtureOverlaps = 0;
    for (const p of acceptedPlants) {
      const form = plantForm(p);
      species[form.species] = (species[form.species] || 0) + 1;
      fixtureOverlaps += plantFixtureHits(p);
      for (const part of form.parts) {
        const matrix = formMatrix(THREE, part),
          position = geometries[part.kind].attributes.position;
        for (let k = 0; k < position.count; k++) {
          const v = new THREE.Vector3().fromBufferAttribute(position, k).applyMatrix4(matrix);
          maxLeafRadiusRatio = Math.max(maxLeafRadiusRatio, Math.hypot(v.x - p.x, v.z - p.z) / p.radius);
        }
      }
    }
    return {
      moved: moved.length,
      shifted: moved.filter(p => p.shifted).length,
      rim: rim.length,
      rimRootRadiusPerScale: 0.4,
      rimIslands: new Set(rim.map(p => p.rimIsland)).size,
      rimPlacementMs,
      lawn: lawn.length,
      lawnAvailableDonors: lawnDonors.length,
      lawnFarMoved: lawnDonor,
      lawnIslands: new Set(lawn.map(p => p.lawnIsland)).size,
      lawnPlacementMs,
      samples,
      misses,
      accepted: acceptedPlants.length,
      maxLeafRadiusRatio,
      fixtureOverlaps,
      species
    };
  }
  function waterSurfaceAudit() {
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
      ray = new THREE.Raycaster();
    let samples = 0,
      embedded = 0,
      maxEmbedding = 0;
    const records = [];
    for (const [index, s] of waterSurfaces.entries()) {
      const probe = new THREE.Mesh(s.cliff.geometry, material);
      probe.matrixAutoUpdate = false;
      probe.matrixWorld.copy(s.cliff.matrixWorld);
      const p = s.geometry.attributes.position;
      let count = 0,
        maximum = 0;
      for (let j = 8; j <= 12; j++)
        for (let k = 1; k < s.columns; k++) {
          const point = new THREE.Vector3().fromBufferAttribute(p, j * (s.columns + 1) + k);
          ray.set(point.clone().addScaledVector(s.flow, 80), s.flow.clone().negate());
          const hit = ray.intersectObject(probe, false)[0],
            inside = hit ? 80 - hit.distance : 0;
          samples++;
          if (inside > 0.06) {
            count++;
            embedded++;
            maximum = Math.max(maximum, inside);
            maxEmbedding = Math.max(maxEmbedding, inside);
          }
        }
      if (count) records.push({ index, samples: count, maximum });
    }
    material.dispose();
    return {
      outlets: waterSurfaces.length,
      samples,
      embedded,
      maxEmbedding,
      records,
      mouthBuildMs: waterSurfaces.reduce((n, s) => n + s.mouth.cpuMs, 0),
      mouthSamples: waterSurfaces.reduce((n, s) => n + s.mouth.samples, 0),
      maxApproachError: Math.max(...waterSurfaces.map(s => s.mouth.maxApproachError)),
      maxBendError: Math.max(...waterSurfaces.map(s => s.mouth.maxBendError))
    };
  }
  return { snowAudit, sectionAudit, routeAudit, geometryAudit, groundingAudit, waterSurfaceAudit };
}
