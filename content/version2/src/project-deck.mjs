// The pavilion pad and rear paths share one plateau. The sampled ring ramp
// meets its straight front edge; rounded outer corners cannot cut that seam.
// A greenhouse island passes its own outline (greenhouse.mjs GREENHOUSE.deck).
export const PROJECT_DECK = [
  [-3.275, -0.65],
  [5.6, -0.65],
  [5.6, 16.4],
  [3.275, 16.4],
  [3.275, 6.7],
  [-3.4, 6.7],
  [-3.4, 9.8],
  [-5.8, 9.8],
  [-5.8, 4.3],
  [-3.275, 4.3]
];
export function createProjectDeckShape(THREE, outline = PROJECT_DECK) {
  const shape = new THREE.Shape(),
    radius = 0.52;
  for (let n = 0; n < outline.length; n++) {
    const prev = new THREE.Vector2(...outline[(n + outline.length - 1) % outline.length]),
      p = new THREE.Vector2(...outline[n]),
      next = new THREE.Vector2(...outline[(n + 1) % outline.length]);
    if (!n) {
      shape.moveTo(p.x, -p.y);
      continue;
    }
    const entry = p.clone().addScaledVector(prev.clone().sub(p).normalize(), radius),
      exit = p.clone().addScaledVector(next.clone().sub(p).normalize(), radius);
    shape.lineTo(entry.x, -entry.y);
    shape.quadraticCurveTo(p.x, -p.y, exit.x, -exit.y);
  }
  shape.closePath();
  return shape;
}
