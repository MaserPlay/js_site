// Glow levels. The glow pass (garden-bloom.mjs) should catch what shines, not what the sun lights.
// At noon a pale bridge or a cloud tone-maps close to white and was blooming into a milky haze, so the
// threshold rises with daylight and comes back down for lamps and neon at night.
export const GLOW_THRESHOLD = { morning: 0.93, day: 0.97, evening: 0.92, sunset: 0.86, night: 0.8 };

// The threshold for a lighting blend as returned by world.lighting(): { from, to, mix }.
export function glowThreshold({ from, to, mix, weights } = {}) {
  const level = phase => GLOW_THRESHOLD[phase] ?? 0.9;
  if (weights)
    return Object.entries(weights).reduce((sum, [phase, weight]) => sum + level(phase) * weight, 0);
  return level(from) + (level(to) - level(from)) * (mix || 0);
}

// Project content (screens, rear posters, section boards, wall pictures) is lit, not a light. Its brightest
// pixel stays under the lowest (night) threshold, so a white web page or a missing-media placeholder reads as a
// white screen instead of a glowing panel.
export const CONTENT_LEVEL = 0.76;

// Content lies on a wall or a backing millimetres off it: a polygon offset keeps it in front of that at any
// distance and depth precision (round 5, scripts/zfight-audit.mjs: boards flickered against their walls).
export function contentLevel(material) {
  material.color.setScalar(CONTENT_LEVEL);
  material.polygonOffset = true;
  material.polygonOffsetFactor = -1;
  material.polygonOffsetUnits = -4;
  return material;
}
