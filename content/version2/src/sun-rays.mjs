// Sun rays and glare for a low sun: a fan of crepuscular rays, a hot core and a thin horizontal glint, drawn once
// on a single camera-facing quad on the sky dome (backdrop.mjs). The sky shader's own faint shafts stay as they were.

// How strongly the rays show for the sun's elevation (sinus of the angle above the horizon): full at a low sun,
// none by midday, so a high sun keeps its plain disc.
export function sunRayLevel(sunY, sunStrength = 1) {
  const t = Math.max(0, Math.min(1, (Math.abs(sunY) - 0.08) / 0.47));
  return Math.max(0, Math.min(1, sunStrength)) * (1 - t * t * (3 - 2 * t));
}

// The rays, deterministic and spread around the sun: angle (radians), half width (radians), length (0-1 of the
// radius) and strength (0-1). A few long and broad ones, many short thin ones; none exactly alike.
export function sunRayList(count = 46) {
  const rays = [];
  for (let i = 0; i < count; i++) {
    const a = Math.sin(i * 12.9898 + 4.1) * 43758.5453,
      b = Math.sin(i * 78.233 + 1.7) * 24634.6345,
      c = Math.sin(i * 37.719 + 9.3) * 12543.8731,
      ra = a - Math.floor(a),
      rb = b - Math.floor(b),
      rc = c - Math.floor(c);
    const long = rb > 0.62;
    rays.push({
      angle: ((i + (ra - 0.5) * 0.7) / count) * Math.PI * 2,
      halfWidth: long ? 0.016 + rc * 0.02 : 0.006 + rc * 0.012,
      length: long ? 0.62 + rb * 0.38 : 0.28 + rb * 0.42,
      strength: long ? 0.55 + ra * 0.4 : 0.3 + ra * 0.35
    });
  }
  return rays;
}

// The ray texture (white on transparent, the material tints it): rays tapering out from the centre, a soft core and
// a thin horizontal glint through it. Plain canvas drawing, no filters (they are missing on some phones).
export function drawSunRays(context, size = 512) {
  const mid = size / 2;
  context.globalCompositeOperation = 'lighter';
  for (const ray of sunRayList()) {
    const length = ray.length * mid;
    for (const [widen, level] of [
      [1.7, 0.32],
      [1, 0.5],
      [0.45, 0.7]
    ]) {
      const reach = Math.tan(ray.halfWidth * widen) * length;
      const fade = context.createLinearGradient(0, 0, length, 0);
      fade.addColorStop(0, `rgba(255,255,255,${(ray.strength * level).toFixed(3)})`);
      fade.addColorStop(0.3, `rgba(255,255,255,${(ray.strength * level * 0.55).toFixed(3)})`);
      fade.addColorStop(1, 'rgba(255,255,255,0)');
      context.save();
      context.translate(mid, mid);
      context.rotate(ray.angle);
      context.fillStyle = fade;
      context.beginPath();
      context.moveTo(0, 0);
      context.lineTo(length, -reach);
      context.lineTo(length, reach);
      context.closePath();
      context.fill();
      context.restore();
    }
  }
  const core = context.createRadialGradient(mid, mid, 0, mid, mid, mid * 0.34);
  core.addColorStop(0, 'rgba(255,255,255,0.75)');
  core.addColorStop(0.35, 'rgba(255,255,255,0.26)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = core;
  context.fillRect(0, 0, size, size);
  // The glint: a long thin horizontal streak, and a shorter vertical one.
  for (const { along, across, level, upright } of [
    { along: 0.96, across: 0.028, level: 0.5, upright: false },
    { along: 0.3, across: 0.02, level: 0.3, upright: true }
  ]) {
    context.save();
    context.translate(mid, mid);
    if (upright) context.rotate(Math.PI / 2);
    context.scale(1, across / along);
    const streak = context.createRadialGradient(0, 0, 0, 0, 0, mid * along);
    streak.addColorStop(0, `rgba(255,255,255,${level})`);
    streak.addColorStop(0.45, `rgba(255,255,255,${level * 0.4})`);
    streak.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = streak;
    context.fillRect(-mid, -mid * along, size, size * along);
    context.restore();
  }
  context.globalCompositeOperation = 'source-over';
}

// Soft rays for a day sun. Owner, 2026-10-31: the day sun wanted soft, beautiful rays, visible on the day sky but
// never washing it out or reading as a hard star. Broad feathered rays (each a stack of ever wider, fainter wedges)
// and a wide faint core; no glint. They come in as the sun climbs, where the low-sun fan above fades out.
// Owner, 2026-10-31 (second look): a little fewer and wider, still soft.
export function sunDayRayLevel(sunY, sunStrength = 1) {
  const t = Math.max(0, Math.min(1, (Math.abs(sunY) - 0.1) / 0.3));
  return Math.max(0, Math.min(1, sunStrength)) * t * t * (3 - 2 * t);
}
export function softSunRayList(count = 14) {
  const rays = [];
  for (let i = 0; i < count; i++) {
    const a = Math.sin(i * 41.37 + 2.9) * 43758.5453,
      b = Math.sin(i * 17.11 + 6.1) * 24634.6345,
      ra = a - Math.floor(a),
      rb = b - Math.floor(b);
    rays.push({
      angle: ((i + (ra - 0.5) * 0.6) / count) * Math.PI * 2,
      halfWidth: 0.065 + rb * 0.05,
      length: 0.55 + ra * 0.45,
      strength: 0.35 + rb * 0.45
    });
  }
  return rays;
}
export function drawSoftSunRays(context, size = 512) {
  const mid = size / 2;
  context.globalCompositeOperation = 'lighter';
  for (const ray of softSunRayList()) {
    const length = ray.length * mid;
    // The feather: seven wedges, each wider and fainter, so the edge fades instead of cutting.
    for (let k = 0; k < 7; k++) {
      const widen = 0.35 + k * 0.38,
        level = 0.11 * (1 - k / 8);
      const reach = Math.tan(ray.halfWidth * widen) * length;
      const fade = context.createLinearGradient(0, 0, length, 0);
      fade.addColorStop(0, `rgba(255,255,255,${(ray.strength * level).toFixed(3)})`);
      fade.addColorStop(0.25, `rgba(255,255,255,${(ray.strength * level * 0.6).toFixed(3)})`);
      fade.addColorStop(1, 'rgba(255,255,255,0)');
      context.save();
      context.translate(mid, mid);
      context.rotate(ray.angle);
      context.fillStyle = fade;
      context.beginPath();
      context.moveTo(0, 0);
      context.lineTo(length, -reach);
      context.lineTo(length, reach);
      context.closePath();
      context.fill();
      context.restore();
    }
  }
  const core = context.createRadialGradient(mid, mid, 0, mid, mid, mid * 0.55);
  core.addColorStop(0, 'rgba(255,255,255,0.32)');
  core.addColorStop(0.3, 'rgba(255,255,255,0.1)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = core;
  context.fillRect(0, 0, size, size);
  context.globalCompositeOperation = 'source-over';
}
