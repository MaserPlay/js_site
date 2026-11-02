// The Moon's phase by date: the mean synodic month counted from a known new moon. The mean phase is within about
// half a day of the true one, enough for the sky to show a crescent, a quarter or the full disc on the right night.
export const SYNODIC_DAYS = 29.530588853;
// New moon of 6 January 2000, 18:14 UTC.
const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
// 0 new, 0.25 first quarter (lit on the right, as seen from the northern hemisphere), 0.5 full, 0.75 last quarter.
export function moonPhase(date = new Date()) {
  const days = (date.getTime() - NEW_MOON) / 86400000;
  return (((days / SYNODIC_DAYS) % 1) + 1) % 1;
}
// The lit share of the disc.
export function moonLit(phase) {
  return (1 - Math.cos(phase * Math.PI * 2)) / 2;
}
