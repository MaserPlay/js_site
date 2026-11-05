// Stable look of a project island, keyed by technical_name rather than by its
// place in the current order: island shape family and scenery random stream.
// Known entries reproduce the established default garden exactly; any other
// project gets a deterministic hash of its technical_name.
// Recorded from the default seven-island build (?audit=1&island-seeds): style is the
// island's former slot, seed the shared scenery stream at that island's start.
const KNOWN = {
  quickvox: { style: 0, seed: 448189618 },
  FenesyyySupport: { style: 1, seed: 89300469 },
  ArcadeGames: { style: 2, seed: 1562166949 },
  EscapeFromLava: { style: 3, seed: 975547028 },
  Appai: { style: 4, seed: 1362667380 },
  FlaskSite: { style: 5, seed: 1932416137 },
  Chtgptforpers: { style: 6, seed: 1668897172 }
};

function hash(text) {
  let h = 2166136261;
  for (const c of String(text)) {
    h ^= c.codePointAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}
export function islandIdentity(id) {
  const known = Object.hasOwn(KNOWN, id) ? KNOWN[id] : null;
  if (known) return { ...known, source: 'known' };
  const h = hash(id);
  return { style: h % 7, seed: 1 + (h % 2147483646), source: 'hash' };
}
export function randomStream(seed) {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}
