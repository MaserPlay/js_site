// Which building a project island gets, by how much the project has to show (pictures + videos).
// Round 5 (owner: away from the glasshouses, a Japanese or Chinese hall as one idea): East Asian houses round the
// same content (east-shell.mjs): a Chinese temple for the most content, a Japanese dojo for a fair amount and an
// open pavilion for a little. The older hall, wooden glasshouse and stone gallery stay for ?greenhouse= previews.
import { greenhouseSlots } from './greenhouse.mjs';

export const BUILDING = {
  temple: 'temple',
  dojo: 'dojo',
  pavilion: 'pavilion',
  // Exhibit volume from which the temple and the dojo are used (the pavilion below the dojo).
  templeFrom: 9,
  dojoFrom: 5,
  hall: 'hall',
  glasshouse: 'glasshouse',
  stone: 'stone',
  // Exhibit volume (images + videos) from which a variant is used: stone from 8, glasshouse from 4, else the hall.
  glasshouseFrom: 4,
  stoneFrom: 8
};

// Exhibits a project can show: distinct pictures plus videos (the card's gallery counts them the same way).
export function contentVolume(project) {
  const images = new Set((project?.images || []).filter(Boolean));
  if (!images.size && project?.image) images.add(project.image);
  return images.size + (project?.videos?.length || 0);
}

export function variantForVolume(volume) {
  if (volume >= BUILDING.templeFrom) return BUILDING.temple;
  if (volume >= BUILDING.dojoFrom) return BUILDING.dojo;
  return BUILDING.pavilion;
}
// The older variants by volume, for the ?greenhouse= previews.
function previewVariant(volume) {
  if (volume >= BUILDING.stoneFrom) return BUILDING.stone;
  if (volume >= BUILDING.glasshouseFrom) return BUILDING.glasshouse;
  return BUILDING.hall;
}

// Why a slot has its variant, for the plan's reason text.
const WHY = {
  [BUILDING.stone]: ` -> stone gallery (from ${BUILDING.stoneFrom})`,
  [BUILDING.glasshouse]: ` -> glasshouse (from ${BUILDING.glasshouseFrom})`,
  [BUILDING.hall]: ` -> hall with rear stands (under ${BUILDING.glasshouseFrom})`,
  [BUILDING.temple]: ` -> temple (from ${BUILDING.templeFrom})`,
  [BUILDING.dojo]: ` -> dojo (from ${BUILDING.dojoFrom})`,
  [BUILDING.pavilion]: ` -> pavilion (under ${BUILDING.dojoFrom})`
};
// An overridden preview slot is a glasshouse, or the stone gallery when its volume asks for one.
function forcedVariant(previewed, natural) {
  if (!previewed) return BUILDING.hall;
  return natural === BUILDING.stone ? natural : BUILDING.glasshouse;
}

// Plan for every slot: [{ slot, id, volume, variant, reason }]. `mode` is the ?greenhouse= override:
// 'volume' (default) chooses an East Asian house by content; 'none' keeps every hall; 'all' / 'smallest' / a slot
// list use the old preview selection (a glasshouse, or the stone gallery when the volume asks for it).
export function planBuildings(projects, mode = 'volume', islands = null) {
  const forced =
    mode === 'volume'
      ? null
      : greenhouseSlots(islands || projects.map(() => ({ radius: 0, stretch: 0 })), mode);
  const plan = projects.map((project, slot) => {
    const volume = contentVolume(project),
      natural = forced ? previewVariant(volume) : variantForVolume(volume);
    let variant = natural,
      reason = `${volume} exhibits (${project?.images?.length || 0} pictures, ${project?.videos?.length || 0} videos)`;
    if (forced) {
      variant = forcedVariant(forced.has(slot), natural);
      reason += ` / override ?greenhouse=${mode}`;
    } else reason += WHY[variant];
    return { slot, id: project?.id, volume, variant, reason };
  });
  return plan;
}

// Slots built as one roofed house (glasshouse or stone gallery) and the stone subset.
export function buildingSets(plan) {
  return {
    houses: new Set(plan.filter(p => p.variant !== BUILDING.hall).map(p => p.slot)),
    stone: new Set(plan.filter(p => p.variant === BUILDING.stone).map(p => p.slot))
  };
}
