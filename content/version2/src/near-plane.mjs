// The camera's near plane (owner, round 5: surfaces flickered when the garden was seen from above). A 24-bit
// depth buffer parts two surfaces a gap g apart only out to about sqrt(g * near * 2^24 / 4) metres, so with the
// old fixed 0.15 m a 1 cm gap began to flicker at 80 m. Inside the garden (and on rides, where a basket or a
// railing is close) the near plane stays at 0.15 m; once the eye is outside the garden it moves out with the
// eye's distance from it, so nothing closer than that can be cut while centimetre gaps hold out past 250 m.
export const NEAR_PLANE = { close: 0.15, far: 2.5, share: 0.03, margin: 25 };

// Near plane for an eye `outside` metres beyond the garden's bounding sphere (negative inside it).
export function nearPlane(outside) {
  return Math.min(NEAR_PLANE.far, Math.max(NEAR_PLANE.close, outside * NEAR_PLANE.share));
}

// How far the eye at (x, y, z) is outside a garden of route radius `radius` (sphere about the centre).
export function outsideGarden(x, y, z, radius) {
  return Math.hypot(x, y, z) - radius - NEAR_PLANE.margin;
}

// Whether a world point is in front of the camera's near plane. Vector3.project cannot tell on its own: with the
// reversed depth buffer (garden.mjs) a point behind the eye still lands inside -1..1 in depth, mirrored onto the
// screen. `scratch` is a Vector3 to work in; the camera's matrixWorldInverse must be current, as for project().
export function inFrontOfCamera(camera, point, scratch) {
  return scratch.copy(point).applyMatrix4(camera.matrixWorldInverse).z < -camera.near;
}
