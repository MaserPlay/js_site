// A bridge's walking deck as one continuous mesh along its points, in three strips across (edge, inner, edge);
// under stair treads the inner strip is left out. world.mjs creates the builder while it builds a garden
// (buildWorldSteps).
import * as THREE from './vendor/three.module.js';
import { createBridgeShell, bridgeTangent } from './bridge-structure.mjs';

// Width of the deck's inner strip: the treads' width, so on the stairs only the strips under the curbs remain.
const DECK_INNER = 4.36;

export function createDeckBuilder(world) {
  const { scene, floors, palette, mesh } = world;
  // The deck as three strips across (edge, inner, edge). `bare(i)` drops the inner strip between rows i and
  // i + 1: there the stair treads are the walking surface, and a deck a riser below a long, shallow tread
  // flickered through it (owner, round 5). The edge strips stay under the curbs.
  function continuousDeck(points, width, parent = scene, bare = _row => false) {
    const positions = [],
      uv = [],
      indices = [],
      across = [-width / 2, -DECK_INNER / 2, DECK_INNER / 2, width / 2];
    for (let i = 0; i < points.length; i++) {
      const tangent = bridgeTangent(THREE, points, i);
      for (const offset of across) {
        const x = points[i].x + tangent.z * offset,
          z = points[i].z - tangent.x * offset;
        positions.push(x, points[i].y, z);
        uv.push(x / 1.4, z / 1.4);
      }
      if (i < points.length - 1) {
        const k = i * 4;
        for (let strip = 0; strip < 3; strip++) {
          const a = k + strip;
          if (strip !== 1 || !bare(i)) indices.push(a, a + 4, a + 1, a + 1, a + 4, a + 5);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    const deck = mesh(g, palette.bridgeDeck, parent);
    floors.push(deck);
    mesh(createBridgeShell(THREE, points, width), palette.stone, parent);
    return deck;
  }
  return { continuousDeck };
}
