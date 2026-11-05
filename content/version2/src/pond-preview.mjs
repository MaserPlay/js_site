export const isSamplePond = (target, enabled) => enabled && !!target && target.x === 0 && target.z === 0;
export function reshapePondPoint(point, center, flow, across, rz, enabled) {
  if (!enabled) return point;
  const d = point.clone().sub(center),
    x = d.dot(across),
    t = d.dot(flow) / rz;
  if (t >= 0) return point;
  const w = Math.min(1, -t);
  return point.addScaledVector(flow, -0.58 * w * w).addScaledVector(across, x * 0.14 * w);
}
