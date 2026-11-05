// Advance visible motion by rendered time, so a blocked frame cannot teleport
// across a large part of the route. No-animation is handled by the caller.
export const cameraDelta = (now, previous) => Math.max(0, Math.min(0.05, (now - (previous || now)) / 1000));
export function tweenProgress(tween, now, duration = tween.duration) {
  if (!duration) return 1;
  const previous = tween.renderedAt ?? tween.start ?? now;
  tween.elapsed = (tween.elapsed || 0) + Math.max(0, Math.min(50, now - previous));
  tween.renderedAt = now;
  return Math.min(1, tween.elapsed / duration);
}
// Travel between pavilions: an eased trip along the bridges whose length sets its time, so one bridge is a
// short glide and a jump across the garden is quicker per metre but never a teleport.
export const TRAVEL = {
  cruise: 9,
  settle: 1000,
  min: 1600,
  max: 6500,
  arc: 1.1
};
export function travelDuration(metres) {
  return Math.min(
    TRAVEL.max,
    Math.max(TRAVEL.min, TRAVEL.settle + (Math.max(0, metres || 0) / TRAVEL.cruise) * 1000)
  );
}
const lead = m => Math.max(-0.6, Math.min(2, Number.isFinite(m) ? m : 0));
// Share of the trip done at normalised time t. It starts at rate `start` (0 from rest; a retarget keeps the
// current speed) and ends at rest without a jerk: zero speed and acceleration, like smootherstep.
export function travelCurve(t, start = 0) {
  const m = lead(start),
    s = 1 - m,
    x = Math.max(0, Math.min(1, t));
  return m * x + (10 * s + 4 * m) * x ** 3 + (-15 * s - 7 * m) * x ** 4 + (6 * s + 3 * m) * x ** 5;
}
// d(travelCurve)/dt, to carry the speed into a new trip.
export function travelRate(t, start = 0) {
  const m = lead(start),
    s = 1 - m,
    x = Math.max(0, Math.min(1, t));
  return m + 3 * (10 * s + 4 * m) * x ** 2 + 4 * (-15 * s - 7 * m) * x ** 3 + 5 * (6 * s + 3 * m) * x ** 4;
}
// Within this many stations of the stand a walk counts as there. The eased curve spends its last frames
// closer than this, so a running trip is ended by its own clock (t = 1), never by this distance.
export const ARRIVAL_EPSILON = 0.0004;
// What a journey frame does: 'travel' steps the eased trip, 'arrive' lands one that is already at its stand
// (a retarget onto the spot it is on, or a walk still marked as moving), 'idle' nothing.
export function travelStep(travel, current, target, moving) {
  if (travel && travel.to === target) return 'travel';
  if (Math.abs(target - current) > ARRIVAL_EPSILON) return 'travel';
  return travel || moving ? 'arrive' : 'idle';
}
// Extra eye height over a bridge: none at a pavilion, a gentle crest mid-span.
export function bridgeArc(progress, height = TRAVEL.arc) {
  const f = progress - Math.floor(progress);
  return height * Math.sin(Math.PI * f) ** 2;
}
export function aimQuaternion(THREE, position, target) {
  return new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().lookAt(position, target, new THREE.Vector3(0, 1, 0))
  );
}
export function orientLook(THREE, position, look, rotation) {
  look.copy(position).addScaledVector(new THREE.Vector3(0, 0, -1).applyQuaternion(rotation), 8);
}
