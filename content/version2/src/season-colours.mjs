// Leaf and flower colours and crown sizes by season, for world.mjs setSeason. A list is picked by the instance's
// index (list[i % list.length]), so neighbouring crowns and flowers differ. `season` is 'winter', 'spring',
// 'autumn' or anything else for summer.
import { WINTER_FOLIAGE_SCALE } from './winter-geometry.mjs';

// Crown tint markers (world.mjs tints a crown when it plants it; untinted ordinary crowns are oaks).
export const MAPLE = '#c0392b';
export const BIRCH = '#a9c46c';

const LEAVES = {
  // Maples keep their summer red under the winter snow.
  maple: {
    spring: [0xd8707a, 0xc85a64],
    autumn: [0xe0662f, 0xd4482a],
    summer: [0xc0392b, 0xd4553a, 0x9e2a3a]
  },
  birch: {
    spring: [0xc6dc92, 0xb4cf84],
    autumn: [0xf0c43c, 0xe2ad2a, 0xf4d45a],
    summer: [0xa6c46c, 0xb8d07c, 0x94b462]
  },
  // Ordinary oaks turn russet brown in autumn; the rest of the year they share the other crowns' greens.
  oakAutumn: [0xa8703a, 0x8e5c30, 0xb8823f],
  // Every other crown, the central tree among them (it keeps its gold in autumn). Every fourth spring crown is in
  // blossom.
  other: {
    spring: [0x819b73, 0xa3b985, 0x819b73, 0xd6b0ba],
    autumn: [0xa9774e, 0xbd985d],
    summer: [0x718c58, 0x99b573, 0x59775c]
  },
  // Bare winter crowns under the snow, all kinds but maple.
  winter: 0x8592af
};

const FLOWERS = {
  winter: 0xa29cac,
  spring: [0xf2b9d2, 0xe79ad0],
  autumn: [0xc77964, 0xd38a5c],
  summer: [0xe85d9c, 0xc2429a, 0x9a5ce0, 0xf08ab8]
};

const pick = (list, i) => list[i % list.length];
// A table's list for the season; winter falls back to summer where the table has no winter of its own.
const forSeason = (table, season) => table[season === 'spring' || season === 'autumn' ? season : 'summer'];

// The colour of crown `i`: its tint (MAPLE, BIRCH or none), whether it is an ordinary oak, and the season.
export function leafColour(season, tint, oak, i) {
  if (tint === MAPLE) return pick(forSeason(LEAVES.maple, season), i);
  if (season === 'winter') return LEAVES.winter;
  if (tint === BIRCH) return pick(forSeason(LEAVES.birch, season), i);
  if (oak && season === 'autumn') return pick(LEAVES.oakAutumn, i);
  return pick(forSeason(LEAVES.other, season), i);
}

export function flowerColour(season, i) {
  if (season === 'winter') return FLOWERS.winter;
  return pick(forSeason(FLOWERS, season), i);
}

// Crown size: spring buds (the central tree a little fuller), autumn, winter's bare crowns, summer.
export function crownScale(season, central) {
  if (season === 'spring') return central ? 0.9 : 0.72;
  if (season === 'autumn') return 0.94;
  if (season === 'winter') return WINTER_FOLIAGE_SCALE;
  return 1.05;
}

// Leafy sprigs follow the crowns, except that the ordinary ones keep their summer size under the winter snow.
export function sprigScale(season, central) {
  if (season === 'winter' && !central) return 1.05;
  return crownScale(season, central);
}
