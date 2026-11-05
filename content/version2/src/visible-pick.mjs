// Only custom gallery architecture participates; other project/ride picking stays unchanged.
// Pick kinds that start a ride: with the scene given they need a clear line of sight (occludedBySolid below).
const RIDE_KINDS = new Set(['zipline', 'skylift', 'skyzip', 'skytour']);
export function visiblePickHits(ray, pickable, scene = null) {
  const hits = ray.intersectObjects(
    pickable.map(p => p.object),
    false
  );
  const hit = hits[0];
  if (!hit) return hits;
  if (
    scene &&
    RIDE_KINDS.has(pickable.find(p => p.object === hit.object)?.kind) &&
    occludedBySolid(ray, hit, scene)
  )
    return [];
  let owner = hit.object;
  while (owner && !owner.userData?.pickOccluders) owner = owner.parent;
  if (!owner) return hits;
  for (let node = hit.object; node; node = node.parent) if (!node.visible) return [];
  const far = ray.far;
  try {
    ray.far = Math.min(far, hit.distance - 1e-4);
    return ray.intersectObjects(
      owner.userData.pickOccluders.filter(m => m.visible),
      false
    ).length
      ? []
      : hits;
  } finally {
    ray.far = far;
  }
}
// A surface that hides what is behind it: visible, opaque enough, not additive light or a back-faced sky.
function hidesBehind(o, m) {
  // Additive light, back-faced sky, and surfaces that draw no colour (invisible pick targets) hide nothing.
  if (!m || m.blending === 2 || m.side === 1 || m.colorWrite === false) return false;
  if (m.transparent && (m.alphaTest ?? 0) <= 0 && (m.opacity ?? 1) < 0.6) return false;
  for (let n = o; n; n = n.parent) if (!n.visible) return false;
  return true;
}
// Ride targets (the observatory, the station balloons, their signs) are only pickable where nothing solid stands
// in front of them: islands, trees and pavilions are not on the pick list, so without this a tap on an island in
// front of the observatory boarded a balloon.
export function occludedBySolid(ray, hit, scene) {
  if (!hit || !scene) return false;
  const far = ray.far;
  try {
    ray.far = Math.max(0, hit.distance - 0.05);
    return ray
      .intersectObject(scene, true)
      .some(
        ({ object: o }) =>
          o !== hit.object &&
          (o.isMesh || o.isInstancedMesh) &&
          !o.userData?.noOcclude &&
          hidesBehind(o, Array.isArray(o.material) ? o.material[0] : o.material)
      );
  } finally {
    ray.far = far;
  }
}
