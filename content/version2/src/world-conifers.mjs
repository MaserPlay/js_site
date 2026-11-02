// The garden's own conifers: the Scots pine, and the Italian cypress on its trunk, as a lawn tree with a
// shorter companion or as a cypress plant. world.mjs creates them while it builds a garden (buildWorldSteps)
// and hands over the scene parts they build into.
import * as THREE from './vendor/three.module.js';
import { WOOD, createTrunk, createRoots, limbCurve, createLimb } from './tree-structure.mjs';
import { pineWoodUV } from './bark-material.mjs';
import { CYPRESS } from './tree-foliage.mjs';

// Scots pine: height per unit tree size; crown clumps start at this share of the height.
const PINE = { height: 8, crownFrom: 0.56, clumps: 7 };
// Instance tints on the painted needle atlas: a dark blue-green pine, a deeper cypress green.
const PINE_TINT = '#78937a',
  CYPRESS_TINT = '#6e9466';
// Cypress bole for a full-size tree (scaled down for smaller ones): how far the column stands above the lawn
// on it, its radius, and how far up the column it climbs (a share of the crown's height).
const CYPRESS_TRUNK = { lift: 0.36, radius: 0.05, reach: 0.92 };

export function createConiferBuilders(world) {
  const { blockers, mesh, palette, batch } = world;
  // Scots pine: a tall, nearly bare bole (orange bark above), short limbs near the top ending in flat
  // needle cushions, and a rounded leader clump. Conifer needles keep their colour in every season.
  function pineTree(x, z, size, base, ground, detail) {
    const phase = x * 0.31 + z * 0.27,
      H = PINE.height * size,
      leanX = 0.06 * Math.sin(phase * 2.3),
      leanZ = 0.06 * Math.cos(phase * 1.9),
      P = (dx, h, dz) => new THREE.Vector3(x + dx * size + leanX * h, base + h, z + dz * size + leanZ * h),
      trunkCurve = new THREE.CatmullRomCurve3([
        P(0, 0, 0).setY(ground - WOOD.sink * size),
        P(0.07, 0.3 * H, -0.04),
        P(-0.05, 0.58 * H, 0.05),
        P(0.08, 0.82 * H, -0.02),
        P(0, H, 0.03)
      ]),
      profile = u => (0.25 * Math.pow(1 - u, 0.75) + 0.02) * size,
      limbs = PINE.clumps - 1,
      limbAt = k => PINE.crownFrom + ((0.93 - PINE.crownFrom) * k) / (limbs - 1),
      rootAngles = [0.4, 2.5, 4.4].map(a => a + phase),
      trunk = createTrunk(THREE, trunkCurve, {
        size,
        ground,
        profile,
        roots: rootAngles,
        sides: detail.trunk,
        segments: detail.rings,
        seed: phase,
        swells: Array.from({ length: limbs }, (_, k) => limbAt(k)),
        flare: 0.55
      });
    // Pine wood rides in the broadleaf bark draw call, marked by its mirrored UVs (pineWoodUV).
    blockers.push(mesh(pineWoodUV(trunk.geometry), palette.treeBark));
    mesh(
      pineWoodUV(
        createRoots(THREE, {
          centre: trunk.soil,
          ground,
          size,
          angles: rootAngles,
          reach: 0.55,
          sides: detail.rootSides,
          seed: phase,
          radius: 0.08
        })
      ),
      palette.treeBark
    );
    const clump = (position, s, turn) =>
      batch('pineCrown', 'treeAtlas', position, { x: s, y: s * 0.8, z: s }, { y: turn }, false, PINE_TINT);
    // Low limbs climb steeply and high ones spread flat, so the tips meet in a flat, uneven umbrella;
    // each limb bends sideways as it goes (sway), the twisted look of an old pine.
    for (let k = 0; k < limbs; k++) {
      const u = limbAt(k),
        share = k / (limbs - 1),
        angle = phase * 2 + k * 2.4,
        reach = (1.45 - 0.45 * share) * size * (0.9 + 0.2 * Math.sin(phase + k * 1.7)),
        root = trunkCurve.getPointAt(u),
        top = base + H * (0.84 + 0.1 * share + 0.03 * Math.sin(phase * 3 + k * 2.3)),
        tip = new THREE.Vector3(
          root.x + Math.sin(angle) * reach,
          Math.max(top, root.y + 0.12 * reach),
          root.z + Math.cos(angle) * reach
        ),
        curve = limbCurve(THREE, root, tip, trunkCurve.getTangentAt(u), {
          rise: 0.2,
          lift: 0.25,
          sway: 0.3 * Math.sin(phase * 3 + k * 1.9)
        }),
        limb = createLimb(THREE, curve, {
          parentRadius: profile(u),
          rootRadius: 0.075 * size,
          tipRadius: 0.018 * size,
          sides: detail.limb,
          segments: 4,
          seed: phase + k
        });
      blockers.push(mesh(pineWoodUV(limb.geometry), palette.treeBark));
      // A main cushion on the tip and a smaller one beside it break the crown into separate tufts.
      const s = (1.35 - 0.3 * share) * size,
        side = new THREE.Vector3(Math.cos(angle), 0, -Math.sin(angle)).multiplyScalar(0.42 * size);
      clump(tip.clone().setY(tip.y + 0.05 * size), s, angle);
      const beside = tip.clone().add(side);
      beside.y -= 0.1 * size;
      if (k < limbs - 1) clump(beside, s * 0.72, angle + 1.3);
      if (k < 3)
        clump(curve.getPointAt(0.62).add(new THREE.Vector3(0, 0.14 * size, 0)), s * 0.6, angle + 2.1);
    }
    // The leader: a rounded cushion crowns the bole, another fills the top of the crown.
    clump(P(0, H + 0.05 * size, 0.03), 1.05 * size, phase);
    clump(P(0.35, 0.95 * H, -0.3), 0.95 * size, phase + 2);
  }
  // A cypress's own trunk: a root flare on the lawn and one bole that tapers up through the column, as on the
  // real tree (the frond column alone went straight into the soil and read as a potted plant, and a bole that
  // stopped at the crown's foot did not read inside it). `tall` is the column's height in crown units. Returns
  // the height the column is raised to stand on it.
  function cypressTrunk(x, z, base, girth, tall) {
    const ground = base + 0.2,
      lift = CYPRESS_TRUNK.lift * Math.min(1.6, girth * 4),
      r = CYPRESS_TRUNK.radius * Math.min(1.6, girth * 4),
      foot = ground - 0.1 * lift,
      reach = ground + lift + CYPRESS_TRUNK.reach * (base + tall * CYPRESS.height - ground - lift);
    batch('bole', 'bark', { x, y: (foot + reach) / 2, z }, { x: r, y: reach - foot, z: r });
    // The root flare: a low cone, sunk so only its sloping shoulder shows round the foot of the bole.
    batch('cone', 'bark', { x, y: ground + 0.02, z }, { x: r * 2.2, y: 0.32, z: r * 2.2 });
    return 0.2 + lift;
  }
  // A cypress plant: one dense frond column (createCypressColumn, replacing the three stacked cones) standing on a
  // short visible trunk, not straight in the soil.
  function cypressPlantColumn(p) {
    const tall = p.scale * 1.12,
      lift = cypressTrunk(p.x, p.z, p.base, p.scale * 0.5, tall);
    batch(
      'cypress',
      'treeAtlas',
      { x: p.x, y: p.base + lift, z: p.z },
      { x: p.scale * 1.05, y: tall - lift / CYPRESS.height, z: p.scale * 1.05 },
      { y: p.random[10] * Math.PI * 2 },
      false,
      CYPRESS_TINT
    );
  }
  // Italian cypress: a narrow, dense flame-shaped column on a short trunk, with a shorter companion beside it.
  function cypressTree(x, z, size, base) {
    const phase = x * 0.31 + z * 0.27;
    for (const [dx, dz, h] of [
      [0, 0, 1],
      [0.95, 0.4, 0.72]
    ]) {
      const at = {
          x: x + (Math.cos(phase) * dx - Math.sin(phase) * dz) * size,
          z: z + (Math.sin(phase) * dx + Math.cos(phase) * dz) * size
        },
        tall = 2.7 * size * h,
        lift = cypressTrunk(at.x, at.z, base, size * h, tall);
      batch(
        'cypress',
        'treeAtlas',
        { ...at, y: base + lift },
        {
          x: 2.1 * size * (0.85 + 0.15 * h),
          y: tall - lift / CYPRESS.height,
          z: 2.1 * size * (0.85 + 0.15 * h)
        },
        { y: phase * 3 + dx },
        false,
        CYPRESS_TINT
      );
    }
  }
  return { pineTree, cypressPlantColumn, cypressTree };
}
