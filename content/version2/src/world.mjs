import { ROOT_SUPPORTS, rootSupportGeometry } from './connected-root-support531.mjs';
import { prismDistance } from './prism-distance.mjs';
import { pickPondSite } from './pond-site.mjs';
import { buildStoneGallery, createStoneDeckShape } from './stone-gallery.mjs';
import { planBuildings, buildingSets } from './building-variants.mjs';
import { separatePlants, envelopeIntersections, boxIndex } from './plant-clearance.mjs';
import { createLolipopFirs } from './imported-firs.mjs';
import { createMundoFullPine } from './mundo-full.mjs';
import { createMundoPine } from './imported-pine.mjs';
import { engineeringKinds, createEngineeringCatalog } from './engineering-displays.mjs';
import * as THREE from './vendor/three.module.js';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';
import { topology, islandFrame, HEIGHT_PREVIEW } from './path.mjs';
import { createProjectDeckShape } from './project-deck.mjs';
import { PLATFORM, turfOutline, platformSite, trimPlinth } from './platform-site.mjs';
import { createBackdrop } from './backdrop.mjs';
import { solarState } from './solar-clock.mjs';
import { moonPhase } from './moon-phase.mjs';
import {
  createPracticalLighting,
  weightedFixtures,
  REAL_LIGHT_SHARE,
  LANTERN,
  createLanternGeometries,
  createLanternMaterials
} from './practical-lighting.mjs';
import { GARLAND, GARLAND_COLOURS, createGarland, roofSwags, railSwags } from './festive-garland.mjs';
import { createGraniteBridgeMaterial } from './bridge-material.mjs';
import { createBridgeArch, createBridgeCurb, findBridgeLanding, railSpan } from './bridge-structure.mjs';
import { buildDisplayStructure, createDisplayCatalog } from './display-prototypes.mjs';
import { createProjectScreen } from './media-screen.mjs';
import { createZoneScreens } from './zone-screens.mjs';
import { createVisitor } from './character.mjs';
import { createWorldAudits } from './world-audits.mjs';
import { createWaterBuilders } from './world-water.mjs';
import { createConiferBuilders } from './world-conifers.mjs';
import { createIslandBuilder } from './world-islands.mjs';
import { createGardenLamp } from './world-lamps.mjs';
import { createHallMotion } from './world-halls.mjs';
import { createZonePaths } from './world-zones.mjs';
import { createScreenLocator } from './world-screens.mjs';
import { createDeckBuilder } from './world-decks.mjs';
import { createClearance } from './world-clearance.mjs';
import { surfaceSnow } from './winter-geometry.mjs';
import {
  SMALL_FIR,
  CENTRAL_FIR,
  createFirModel,
  firModelSteps,
  createFirLights,
  firLightSteps,
  createTwinkleMaterial,
  addNeedleSnow,
  addBarkSnow,
  snowFromNormals
} from './winter-firs.mjs';
import { XMAS, xmasDecorSteps, createXmasMaterials, paintStarRays } from './xmas-tree.mjs';
import { configureWaterMaterial, createFallMist } from './water-effects.mjs';
import { STAIR_RISE, stairFlight } from './stairs.mjs';
import { WOOD, WOOD_DETAIL, createTrunk, createRoots, createLimb, limbCurve } from './tree-structure.mjs';
import { createBarkMaterial } from './bark-material.mjs';
import { createPortalGate } from './portal-gate.mjs';
import { createRearPanel } from './rear-panel.mjs';
import { buildGlassPavilion, createGlassMaterials } from './pavilion-glass.mjs';
import { GREENHOUSE, buildGreenhouse, createGreenhouseMaterials } from './greenhouse.mjs';
import { contentLevel } from './content-level.mjs';
import { createEastMaterials } from './east-shell.mjs';
import { HALL, buildHall, buildInterior, createInteriorMaterials, pottedPlant } from './pavilion-hall.mjs';
import { createCloudSea } from './cloud-sea.mjs';
import { createSnowfall } from './snowfall.mjs';
import { createSkyTransit } from './sky-transit.mjs';
import { SKY_ENABLED, createSkyIsland } from './sky-island.mjs';
import {
  loadFoliageMaps,
  createCardCluster,
  createFoliageMaterial,
  SPRITES,
  foliageDaylight
} from './realistic-foliage.mjs';
import {
  createOrdinarySpray,
  createGardenFlower,
  createFoliagePartition,
  setDeciduousSeason
} from './ordinary-botanicals.mjs';
import {
  createTreeSpray,
  createBareCrown,
  createCypressColumn,
  createCypressBole,
  paintTreeAtlas,
  ATLAS_SIZE,
  TREE_ATLAS
} from './tree-foliage.mjs';
import { createFirGeometry } from './botanical-geometry.mjs';
import { createBasaltGeometry, createBoulderGeometry } from './terrain-forms.mjs';
import {
  createHangingVine,
  createVineAtlasTexture,
  createVineMaterial,
  setVineDrape,
  setVineSeason
} from './vine-plant.mjs';
import { createCliffSurface, planDrape, createDrapeTexture } from './vine-drape.mjs';
import {
  configureCliffMaterial,
  configureTurfEdge,
  paintGroundTexture,
  paintGrassTexture
} from './terrain-materials.mjs';
import { plantForm, formMatrix, createBroadLeafGeometry, createCanopyGeometry } from './plant-forms.mjs';
import {
  MAX_OWNERS,
  REVEAL_FIXED,
  OWNER_NORMALIZED,
  createOwnerUniforms,
  patchOwnerMaterial,
  ownedGeometry,
  spanReveal
} from './garden-owners.mjs';
import { islandIdentity, randomStream } from './island-identity.mjs';
import { paintContext } from './paint-canvas.mjs';
// Crown tint markers (maple, birch) and the colours and sizes the season pass gives them.
import { MAPLE, BIRCH, leafColour, flowerColour, crownScale, sprigScale } from './season-colours.mjs';

// Weeping birch twigs: leafy hanging strands (the 4 m ivy strand) at this share of the tree size.
const BIRCH_WEEP = 0.5;
// Deliberate planting per project island, cycled by slot so neighbours differ:
// [arrival tree, rear tree, lawn spot, lawn spot]. Spruces also stand by every pavilion all year.
const ISLAND_TREES = [
  ['oak', 'maple', 'pine', 'cypress'],
  ['birch', 'oak', 'cypress', 'pine'],
  ['maple', 'birch', 'pine', 'oak'],
  ['oak', 'pine', 'birch', 'cypress'],
  ['birch', 'maple', 'cypress', 'pine'],
  ['maple', 'oak', 'pine', 'birch'],
  ['birch', 'pine', 'cypress', 'oak']
];
// Distant scenic islands, in island order.
// (Spruces stand by every pavilion all year; the far islands keep to lighter species.)
const SCENIC_TREES = ['pine', 'oak', 'birch', 'pine', 'maple', 'cypress', 'oak'];
// Island-local lawn spots tried for the two extra trees (first valid ones win), clear of paths and halls.
// The island is narrow across (about ±8 m at mid-length), so the spots stay well inside its rim.
const LAWN_TREE_SPOTS = [
  [-7.0, 6.6],
  [7.0, 4.6],
  [6.6, 10.6],
  [-7.2, 13.2],
  [3.6, 22.2],
  [7.2, 7.6],
  [-2.6, 23.0],
  [1.6, 23.4]
];
// Broadleaf scaffold per unit tree size: limb and twig radii at the parent and the tip; limbs run on `through`
// of the crown's half-width past its centre and climb `climb`; twigs run `twigThrough` past their cluster.
const LIMB = {
  root: 0.15,
  tip: 0.016,
  through: 0.55,
  climb: 0.22,
  twigRoot: 0.07,
  twigTip: 0.02,
  twigThrough: 0.3
};
// Central old oak limbs: [turn from the portal spoke, trunk share, reach, rise, twist] in tree units.
// The low limbs spread to the sides and back; only the high last one leans out over the portal.
const OAK_LIMBS = [
  [1.2, 0.47, 3.5, 1.7, 0.5],
  [2.25, 0.54, 3.3, 1.9, -0.6],
  [3.25, 0.6, 3.1, 2.2, 0.55],
  [-2.2, 0.5, 3.5, 1.8, -0.5],
  [-1.2, 0.64, 3, 2.2, 0.6],
  [0.05, 0.86, 2.1, 2.4, -0.4]
];
export const symbols = {
  quickvox: '♩',
  FenesyyySupport: '⌘',
  ArcadeGames: '✚',
  EscapeFromLava: '△',
  Appai: '◎',
  FlaskSite: '⌁',
  Chtgptforpers: '◇'
};
const V = p => new THREE.Vector3(p.x, p.y, p.z);
const dummy = new THREE.Object3D();
// The lawn picture, drawn once per page and shared by every rebuilt garden's own texture (~55 ms of each sort).
let lawnPicture = null;

// The imported pine model for its asset's variant: the lolipop firs, the full Mundo pine or the Mundo pine.
function createImportedPine(asset, resources) {
  if (asset.variant === 'lolipop') return createLolipopFirs(asset, resources);
  if (asset.variant === 'mundo-full') return createMundoFullPine(asset, resources);
  return createMundoPine(asset, resources);
}

// The whole garden in one go (tests, audits and the first world of a visit).
export function buildWorld(...args) {
  const steps = buildWorldSteps(...args);
  for (;;) {
    const step = steps.next();
    if (step.done) return step.value;
  }
}
// The same build in short steps: each `yield` is a place where a rearrangement may hand the frame back, so the
// current garden keeps moving while the next one is built (garden.mjs). The result does not depend on the pauses.
export function* buildWorldSteps(
  projects,
  onChange = () => {},
  labels = {},
  displayPrototype = null,
  pineAsset = null,
  options = {}
) {
  const pondPreview =
    typeof location !== 'undefined' && new URLSearchParams(location.search).get('pond') === 'large';
  const scene = new THREE.Scene();
  const route = topology(projects.length);
  // Islands, bridges and planting move only with the transition owners below.
  // Diagnostic display/tree variants keep their own instancing and rebuild instantly.
  const movable = !displayPrototype && !pineAsset && projects.length < MAX_OWNERS;
  let currentOwner = 0,
    currentConnective = null,
    currentScenic = false;
  const floors = [],
    blockers = [],
    pickable = [],
    resources = new Set(),
    railSegments = [],
    bridgeEdges = [],
    mediaStatus = [],
    zoneBoards = [],
    pavilionGroups = [],
    treeBounds = [],
    mainScreens = [];
  const importedPine = pineAsset ? createImportedPine(pineAsset, resources) : null;
  if (importedPine) {
    scene.add(importedPine.object);
    blockers.push(...(importedPine.collisionObjects || [importedPine.object]));
  }
  const economyExtras = [],
    economyDetail = [],
    buckets = new Map(),
    fixtureBoxes = [],
    foliageObjects = [],
    treeSnowObjects = [],
    sprigObjects = [],
    flowerObjects = [],
    deciduousObjects = [],
    shrubObjects = [],
    shrubSnowObjects = [],
    vineObjects = [],
    ordinaryLods = [],
    foliageMatrices = new Map(),
    islandSurfaces = [],
    waterZones = [],
    waterSurfaces = [],
    plantPlans = [],
    vinePlans = [],
    acceptedPlants = [],
    rejectedPlants = [];
  let ordinaryLodDirty = true,
    ordinaryLodEconomy = false,
    // Medium graphics: the lighter shrubs, vine curtains and mountains and two local lights (setEconomy).
    mediumDetail = false;
  const ordinaryLodCamera = new THREE.Vector3(Infinity, Infinity, Infinity);
  let glassMaterials = null,
    hallLight = null,
    interiorMaterials = null,
    portalEffect = null,
    portalGate = null;
  const portalGeometry = { center: null, normal: null };
  const palette = {
    // Dark basalt with procedural relief (terrain-materials), as in the confirmed realistic reference.
    rock: new THREE.MeshStandardMaterial({ color: 0x928a96, roughness: 0.9, vertexColors: true }),
    ground: new THREE.MeshStandardMaterial({ color: 0x777b9a, roughness: 0.94, flatShading: true }),
    path: new THREE.MeshStandardMaterial({ color: 0xb1abc7, roughness: 0.8, flatShading: true }),
    stone: new THREE.MeshStandardMaterial({ color: 0x8c8e9d, roughness: 0.85, flatShading: true }),
    roof: new THREE.MeshStandardMaterial({
      color: 0x575b73,
      roughness: 0.67,
      metalness: 0.17,
      flatShading: true,
      side: THREE.DoubleSide
    }),
    metal: new THREE.MeshStandardMaterial({ color: 0x515066, roughness: 0.6, metalness: 0.45 }),
    bark: new THREE.MeshStandardMaterial({ color: 0x765e54, roughness: 0.95 }),
    leaves: new THREE.MeshStandardMaterial({
      color: 0xa86aa7,
      roughness: 0.98,
      vertexColors: true,
      side: THREE.DoubleSide,
      emissive: 0x304032,
      emissiveIntensity: 0.8
    }),
    shrub: new THREE.MeshStandardMaterial({ color: 0x2d626d, roughness: 0.96, flatShading: true }),
    redLeaf: new THREE.MeshStandardMaterial({ color: 0x8e3652, roughness: 0.91, flatShading: true }),
    // Confirmed realistic reference: slim dark metal bridge rails, cool neon along the deck edge.
    rail: new THREE.MeshStandardMaterial({ color: 0x34313f, roughness: 0.42, metalness: 0.62 }),
    cloud: new THREE.MeshStandardMaterial({ color: 0xb693b3, roughness: 1, flatShading: true }),
    pine: new THREE.MeshStandardMaterial({ color: 0x505e74, roughness: 0.98, flatShading: true }),
    snow: new THREE.MeshStandardMaterial({ color: 0xe0e3ee, roughness: 0.9, flatShading: true }),
    blue: new THREE.MeshStandardMaterial({
      color: 0x9bcde8,
      emissive: 0x348fe9,
      emissiveIntensity: 1.1,
      roughness: 0.42
    }),
    violet: new THREE.MeshStandardMaterial({
      color: 0xb0a7dd,
      emissive: 0x835bdd,
      emissiveIntensity: 0.95,
      roughness: 0.42
    }),
    coral: new THREE.MeshStandardMaterial({
      color: 0xd4a2aa,
      emissive: 0xc35b72,
      emissiveIntensity: 0.55,
      roughness: 0.5
    }),
    water: new THREE.MeshStandardMaterial({
      color: 0x79b5e2,
      emissive: 0x497bbb,
      emissiveIntensity: 0.38,
      roughness: 0.27,
      metalness: 0,
      transparent: true,
      opacity: 0.86,
      side: THREE.DoubleSide,
      depthWrite: false
    }),
    waterLight: new THREE.MeshBasicMaterial({
      color: 0xb1d0e0,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false
    }),
    dark: new THREE.MeshStandardMaterial({ color: 0x29253d, roughness: 0.76 }),
    // Potting soil inside the pavilion pots (pavilion-hall.mjs pottedPlant).
    soil: new THREE.MeshStandardMaterial({ color: 0x3b2b21, roughness: 1 })
  };
  const waterCanvas = document.createElement('canvas');
  waterCanvas.width = 128;
  waterCanvas.height = 256;
  const wc = paintContext(waterCanvas);
  wc.fillStyle = '#468baf';
  wc.fillRect(0, 0, 128, 256);
  // Soft curved streaks, no repeated rectangular highlight tiles.
  for (let i = 0; i < 15; i++) {
    wc.strokeStyle = i % 3 ? 'rgba(183,221,231,.22)' : 'rgba(207,240,241,.34)';
    wc.lineWidth = i % 3 ? 1.1 : 2.1;
    wc.beginPath();
    for (let y = -16; y <= 272; y += 4) {
      const x = i * 9 + Math.sin(y * 0.043 + i * 1.7) * 3.1;
      y === -16 ? wc.moveTo(x, y) : wc.lineTo(x, y);
    }
    wc.stroke();
  }
  const flowTexture = new THREE.CanvasTexture(waterCanvas);
  flowTexture.colorSpace = THREE.SRGBColorSpace;
  flowTexture.wrapS = flowTexture.wrapT = THREE.RepeatWrapping;
  resources.add(flowTexture);
  palette.water.map = flowTexture;
  palette.water.opacity = 0.91;
  // Water writes depth so the cloud sea, drawn after it, is hidden behind a waterfall and covers it from in front.
  palette.water.depthWrite = true;
  const waterTime = { value: 0 };
  palette.water.roughness = 0.4;
  const waterAppearance = configureWaterMaterial(palette.water, waterTime);
  palette.water.forceSinglePass = true;
  palette.waterLight.forceSinglePass = true;
  let effectTime = 0,
    lastEffectTime = null;
  function updateWater(now, enabled) {
    if (enabled && lastEffectTime !== null) effectTime += Math.min(1, (now - lastEffectTime) / 1000);
    lastEffectTime = now;
    waterTime.value = effectTime;
    flowTexture.offset.y = -(effectTime * 0.16) % 1;
    if (portalEffect) portalEffect.uniforms.time.value = effectTime;
    portalGate?.update(effectTime);
    foliageTime.value = effectTime;
    backdrop.update(now, enabled);
    cloudSea.setTime(effectTime);
    visitor.update(now, enabled);
    engineeringDisplays.forEach(display => display.update(now, enabled));
  }
  palette.brand = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, toneMapped: false });
  palette.starGold = new THREE.MeshBasicMaterial({ color: 0xffd94f, toneMapped: false });
  palette.lampBlue = new THREE.MeshBasicMaterial({ color: 0x69bdff, toneMapped: false });
  palette.lampViolet = new THREE.MeshBasicMaterial({ color: 0xa487ff, toneMapped: false });
  palette.bridgeNeonBlue = new THREE.MeshBasicMaterial({ color: 0x6fb6ff, toneMapped: false });
  palette.bridgeNeonViolet = new THREE.MeshBasicMaterial({ color: 0xa487ff, toneMapped: false });
  // Realistic foliage: photo leaf, needle and blossom cards plus textured bark, all from local CC0 maps.
  const foliageTime = { value: 0 },
    foliageMaps = loadFoliageMaps(THREE, resources, onChange);
  palette.leaves = createFoliageMaterial(THREE, {
    map: foliageMaps.leaves,
    time: foliageTime,
    name: 'leaves'
  });
  palette.shrubFoliage = createFoliageMaterial(THREE, {
    map: foliageMaps.leaves,
    time: foliageTime,
    wind: 0.55,
    gain: 2.5,
    name: 'shrubFoliage'
  });
  // Plants inside the glass halls: no wind and no seasonal tint, so they stay green behind the glass in winter.
  palette.indoorFoliage = createFoliageMaterial(THREE, {
    map: foliageMaps.leaves,
    time: foliageTime,
    wind: 0,
    gain: 2.5,
    name: 'indoorFoliage'
  });
  palette.indoorFoliage.color.set(0x9fbf85);
  palette.needles = createFoliageMaterial(THREE, {
    map: foliageMaps.needles,
    time: foliageTime,
    wind: 0.3,
    recolor: 0.5,
    gain: 3.3,
    name: 'needles'
  });
  palette.redLeaf = createFoliageMaterial(THREE, {
    map: foliageMaps.blossoms,
    time: foliageTime,
    wind: 0.45,
    recolor: 0.9,
    gain: 2.4,
    translucency: 0.14,
    name: 'blossoms'
  });
  yield;
  // Hanging vines (vine-plant.mjs): leafy stem sprigs painted into a data atlas, coloured per season in the
  // shader; light through the leaves lifts the curtains in the rim's shade. Swings like a pendulum.
  const vineAtlas = createVineAtlasTexture(THREE);
  resources.add(vineAtlas);
  palette.vine = createVineMaterial(THREE, {
    map: vineAtlas,
    time: foliageTime,
    translucency: 0.3
  });
  palette.bark.map = foliageMaps.bark;
  palette.bark.normalMap = foliageMaps.barkNormal;
  palette.bark.normalScale.set(0.9, 0.9);
  palette.bark.color.set(0xc4b2a4);
  // Winter snow on fir bough tops and on the upper side of every limb; twinkling fir bulbs.
  // firBark shares the bark material under a non-solid key, so bough twigs are no obstacles.
  const winterSnow = { value: 0 };
  addNeedleSnow(palette.needles, winterSnow);
  addBarkSnow(palette.bark, winterSnow);
  // Painted oak-leaf, pine-brush and cypress-frond atlas (tree-foliage.mjs): one material for the central
  // oak crown, the Scots pine cushions and the cypress columns, which keep their own buckets (no new draws).
  {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = ATLAS_SIZE;
    paintTreeAtlas(paintContext(canvas));
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    resources.add(map);
    palette.treeAtlas = addNeedleSnow(
      createFoliageMaterial(THREE, {
        map,
        time: foliageTime,
        recolor: 0.72,
        gain: 2.5,
        wind: 0.75,
        name: 'treeAtlas'
      }),
      winterSnow
    );
  }
  yield;
  // Broadleaf wood: procedural furrowed bark (three species), the photo bark only as micro-detail.
  for (const [key, species] of [
    ['treeBark', 'broadleaf'],
    ['birchBark', 'birch'],
    ['oldBark', 'old']
  ])
    palette[key] = addBarkSnow(
      createBarkMaterial(THREE, { species, map: foliageMaps.bark, normalMap: foliageMaps.barkNormal }),
      winterSnow
    );
  palette.firBark = palette.bark;
  palette.firWire = palette.metal;
  palette.firNeedles = palette.needles;
  palette.firLights = createTwinkleMaterial(THREE, foliageTime);
  Object.values(palette).forEach(x => resources.add(x));
  yield;
  const geometries = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 10),
    sphere: new THREE.IcosahedronGeometry(1, 1),
    crown: createCanopyGeometry(THREE),
    cone: new THREE.ConeGeometry(1, 1, 8),
    pebble: new THREE.IcosahedronGeometry(1, 0),
    stem: new THREE.CylinderGeometry(1, 1, 1, 4),
    crownCentral: new THREE.IcosahedronGeometry(1, 1)
  };
  const fir = createFirGeometry(THREE);
  geometries.fir = fir.geometry;
  yield;
  // Winter firs (small pavilion firs and the decorated central fir): trunk, twigs, needles, lights.
  // The central New Year fir keeps its low boughs and gifts clear of the portal gate, which floats 2.8 m
  // out along the first spoke (see tree()); xmas-tree.mjs dresses it.
  const xmasGate = (() => {
    const spoke = route.spoke(1),
      length = Math.hypot(spoke.x, spoke.z) || 1;
    return Math.atan2((spoke.x / length) * 2.8 - XMAS.at.x, (spoke.z / length) * 2.8 - XMAS.at.z);
  })();
  const smallFir = createFirModel(THREE, SMALL_FIR),
    smallFirLights = createFirLights(THREE, smallFir, SMALL_FIR.lights);
  yield;
  const centralFir = yield* firModelSteps(THREE, {
    ...CENTRAL_FIR,
    prune: { ...CENTRAL_FIR.prune, angle: xmasGate }
  });
  yield;
  const centralFirLights = yield* firLightSteps(THREE, centralFir, CENTRAL_FIR.lights);
  const centralDecor = yield* xmasDecorSteps(THREE, centralFir, centralFirLights, { gate: xmasGate });
  centralFirLights.bulbs.dispose();
  centralFirLights.cord.dispose();
  Object.assign(geometries, {
    firNeedles: smallFir.needles,
    firTrunk: smallFir.trunk,
    firTwigs: smallFir.twigs,
    // Trunk and twigs share the bark material: one draw call for a spruce's wood (the trunk's collision
    // comes from an unrendered blocker, see firInstance).
    firWood: mergeGeometries([smallFir.trunk, smallFir.twigs], false),
    firBulbs: smallFirLights.bulbs,
    firCord: smallFirLights.cord,
    firStar: smallFirLights.star,
    centralFirNeedles: centralFir.needles,
    centralFirTrunk: centralFir.trunk,
    centralFirTwigs: centralFir.twigs,
    // The fir's own string first, then the gold string and the swags (economy draws the first part).
    centralFirBulbs: centralDecor.bulbs,
    centralFirCord: centralDecor.cord,
    centralFirDecor: centralDecor.ornaments,
    centralFirStar: centralDecor.star
  });
  geometries.flower = createGardenFlower(THREE);
  palette.shrub.vertexColors = palette.redLeaf.vertexColors = true;
  yield;
  const bush = createOrdinarySpray(THREE, false, true),
    bushLow = createOrdinarySpray(THREE, true, true);
  bushLow.twigs.dispose();
  geometries.shrubCrown = bush.leaves;
  geometries.shrubTwig = bush.twigs;
  geometries.shrubCrownEconomy = bushLow.leaves;
  geometries.shrubSnow = surfaceSnow(THREE, bush.twigs, -0.05, 0.006);
  geometries.shrubSnowEconomy = geometries.shrubSnow;
  geometries.crownSnow = surfaceSnow(THREE, geometries.crown, 0.12, 0.025);
  // Only upward faces collect snow; the cap follows every bough, including its lip.
  geometries.firSnow = fir.snow;
  geometries.crownCentral.dispose();
  const spray = createOrdinarySpray(THREE);
  geometries.treeCrown = spray.leaves;
  // Bare winter crowns fork up and out from the branch tip instead of a starburst of straight spokes.
  spray.twigs.dispose();
  geometries.treeSprig = createBareCrown(THREE);
  const centralSpray = createTreeSpray(THREE, false, true);
  geometries.crownCentral = centralSpray.leaves;
  geometries.treeSprigCentral = centralSpray.twigs;
  geometries.treeSnow = surfaceSnow(THREE, geometries.treeSprig, -0.05, 0.006);
  const economySpray = createOrdinarySpray(THREE, true);
  economySpray.twigs.dispose();
  geometries.treeCrownEconomy = economySpray.leaves;
  const centralEconomy = createTreeSpray(THREE, true, true);
  centralEconomy.twigs.dispose();
  geometries.crownCentralEconomy = centralEconomy.leaves;
  geometries.treeSnowEconomy = geometries.treeSnow;
  // Photo-card crowns replace the folded solid leaves at the same extents; far LOD keeps fewer, flat cards.
  for (const key of [
    'treeCrown',
    'treeCrownEconomy',
    'crownCentral',
    'crownCentralEconomy',
    'shrubCrown',
    'shrubCrownEconomy',
    'flower'
  ])
    geometries[key].dispose();
  yield;
  geometries.treeCrown = createCardCluster(THREE, {
    cards: 58,
    radius: 0.6,
    height: 0.42,
    cardLength: 0.68,
    droop: 0.14,
    lift: 0.2,
    core: 0.6,
    seed: 11
  });
  geometries.treeCrownEconomy = createCardCluster(THREE, {
    cards: 30,
    radius: 0.58,
    height: 0.42,
    cardLength: 0.74,
    droop: 0.12,
    lift: 0.2,
    core: 0.6,
    columns: 2,
    seed: 12
  });
  // Central oak: lobed oak-leaf sprays from the painted atlas; no snow (the winter fir replaces the tree).
  geometries.crownCentral = createCardCluster(THREE, {
    sprites: TREE_ATLAS.oak,
    cards: 96,
    radius: 0.64,
    height: 0.44,
    cardLength: 0.58,
    droop: 0.14,
    lift: 0.2,
    core: 0.62,
    seed: 13
  });
  geometries.crownCentralEconomy = createCardCluster(THREE, {
    sprites: TREE_ATLAS.oak,
    cards: 38,
    radius: 0.62,
    height: 0.44,
    cardLength: 0.76,
    droop: 0.12,
    lift: 0.2,
    core: 0.62,
    columns: 2,
    seed: 14
  });
  snowFromNormals(THREE, geometries.crownCentral, 0);
  snowFromNormals(THREE, geometries.crownCentralEconomy, 0);
  yield;
  geometries.shrubCrown = createCardCluster(THREE, {
    cards: 34,
    radius: 0.42,
    height: 0.24,
    cardLength: 0.42,
    droop: 0.07,
    lift: 0.45,
    core: 0.6,
    seed: 21
  });
  geometries.shrubCrownEconomy = createCardCluster(THREE, {
    cards: 16,
    radius: 0.42,
    height: 0.24,
    cardLength: 0.46,
    droop: 0.06,
    lift: 0.45,
    core: 0.6,
    columns: 2,
    seed: 22
  });
  // Medium graphics: two thirds of the folded cards, a little longer, so the bush keeps its fill.
  geometries.shrubCrownMedium = createCardCluster(THREE, {
    cards: 22,
    radius: 0.42,
    height: 0.24,
    cardLength: 0.46,
    droop: 0.07,
    lift: 0.45,
    core: 0.6,
    seed: 21
  });
  geometries.flower = createCardCluster(THREE, {
    sprites: SPRITES.blossom,
    cards: 11,
    radius: 0.24,
    height: 0.14,
    cardLength: 0.22,
    lift: 0.6,
    seed: 5
  });
  yield;
  // Italian cypress: a dense flame-shaped column of upswept scale-leaf fronds (tree-foliage.mjs).
  geometries.cypress = createCypressColumn(THREE, { seed: 31 });
  geometries.bole = createCypressBole(THREE);
  // Cypress cards share the needle snow shader: a light dusting where their normals face up.
  snowFromNormals(THREE, geometries.cypress, 0.7);
  // Scots pine crown cushion: short needle brushes, tips turned up, in a flat dome at a limb tip;
  // snow settles on its top.
  geometries.pineCrown = createCardCluster(THREE, {
    sprites: TREE_ATLAS.pine,
    cards: 56,
    radius: 0.7,
    height: 0.42,
    cardLength: 0.46,
    droop: 0.02,
    lift: 0.6,
    core: 0.6,
    spread: 0.5,
    // Short brushes need no bend: flat cards halve the triangles.
    columns: 2,
    seed: 41,
    shade: [0.45, 1]
  });
  snowFromNormals(THREE, geometries.pineCrown, 0.85);
  geometries.groundFern = createCardCluster(THREE, {
    cards: 10,
    radius: 0.22,
    height: 0.05,
    cardLength: 0.36,
    droop: 0.08,
    lift: -0.35,
    columns: 2,
    core: 0.3,
    yOffset: 0.06,
    seed: 51,
    shade: [0.5, 0.95]
  });
  yield;
  geometries.mote = new THREE.IcosahedronGeometry(1, 1);
  // Cast-iron lanterns, standards, crook arms and sconce brackets (practical-lighting.mjs): one instanced
  // draw per part for every lantern in the garden.
  {
    const parts = createLanternGeometries(THREE);
    Object.assign(geometries, {
      lanternHead: parts.head,
      lanternStem: parts.stem,
      lanternPane: parts.pane,
      lanternHalo: parts.halo,
      lampStandard: parts.standard,
      lampCrook: parts.crook,
      sconceBracket: parts.bracket
    });
  }
  const lanternLook = createLanternMaterials(THREE, {
    blue: palette.lampBlue.color,
    violet: palette.lampViolet.color
  });
  palette.lanternPane = lanternLook.pane;
  palette.lanternHalo = lanternLook.halo;
  resources.add(lanternLook.pane);
  resources.add(lanternLook.halo);
  // Weathered boulders with basalt relief and moss; economy keeps a 20-face version.
  geometries.boulder = createBoulderGeometry(THREE, { detail: 1, seed: 3 });
  geometries.boulderLow = createBoulderGeometry(THREE, { detail: 0, seed: 3 });
  yield;
  // Potted plants on the pavilion floors: arching photo leaves instead of five folded solids.
  geometries.potPlant = createCardCluster(THREE, {
    cards: 16,
    radius: 0.16,
    height: 0.12,
    cardLength: 0.46,
    droop: 0.16,
    lift: 1.1,
    core: 0.3,
    yOffset: 0.08,
    seed: 61,
    shade: [0.6, 1.05]
  });
  // Tall leafy plants for the back corners of the glass halls.
  geometries.hallPlant = createCardCluster(THREE, {
    cards: 26,
    radius: 0.34,
    height: 0.95,
    cardLength: 0.6,
    droop: 0.2,
    lift: 1.25,
    core: 0.35,
    yOffset: 0.5,
    seed: 83,
    shade: [0.6, 1.05]
  });
  yield;
  // Vine curtains under the island lips. One instance: a 4 m lead strand and shorter side strands
  // ([x, z, length, flowering]) with roots and a grass tuft at the lip, merged so a dense rim costs one draw
  // call. Flowers live in the atlas (shown in spring and some summers). perRadius sets the density.
  const VINES = {
    strands: [
      [0, 0, 4, false],
      [0.4, 0.05, 3, true],
      [-0.38, -0.03, 2.4, false],
      [0.18, 0.1, 1.7, true],
      [-0.14, 0.08, 1.15, false]
    ],
    perRadius: 2.6,
    min: 8
  };
  geometries.vine = createHangingVine(THREE, { strands: VINES.strands, seed: 23 });
  geometries.vineLite = createHangingVine(THREE, { strands: VINES.strands, seed: 23, lite: true });
  // A weeping birch twig is a narrow bundle of the same strands: every top lies on its limb's wood (at: share of the
  // limb's length where it hangs). It hangs free, so it carries no cliff drape.
  const WEEP = {
    strands: [
      [0, 0, 4, false],
      [0.08, 0.02, 3, true],
      [-0.08, -0.02, 2.4, false],
      [0.04, 0.03, 1.7, true],
      [-0.04, 0.02, 1.15, false]
    ],
    at: 0.9
  };
  geometries.vineWeep = createHangingVine(THREE, {
    strands: WEEP.strands,
    seed: 23,
    follow: false,
    lip: false
  });
  Object.values(geometries).forEach(x => resources.add(x));
  // A curved, broad leaf with shared normals, instead of triangular blades.
  const leaf = createBroadLeafGeometry(THREE);
  leaf.computeVertexNormals();
  leaf.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(Array(leaf.attributes.position.count * 3).fill(1), 3)
  );
  geometries.leaf = leaf;
  resources.add(leaf);
  palette.shrub.side = palette.redLeaf.side = THREE.DoubleSide;
  palette.shrub.flatShading = palette.redLeaf.flatShading = false;
  geometries.leafSnow = surfaceSnow(THREE, leaf, 0.55, 0.015);
  resources.add(geometries.leafSnow);
  yield;
  let textureSeed = 1907;
  function stoneTexture(base, tiles = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = paintContext(canvas);
    context.fillStyle = base;
    context.fillRect(0, 0, 256, 256);
    const ground = base === '#bbc7c4';
    if (ground) paintGroundTexture(context);
    // Speckles, dark and pale in turn; fainter on the ground's stone.
    const speckles = ground
      ? ['rgba(26,30,45,.032)', 'rgba(235,235,245,.022)']
      : ['rgba(26,30,45,.06)', 'rgba(235,235,245,.045)'];
    for (let i = 0; i < 5600; i++) {
      textureSeed = (textureSeed * 16807) % 2147483647;
      const x = textureSeed % 256;
      textureSeed = (textureSeed * 16807) % 2147483647;
      const y = textureSeed % 256;
      context.fillStyle = speckles[i % 2];
      context.fillRect(x, y, 1 + (i % 3), 1);
    }
    if (tiles) {
      context.strokeStyle = 'rgba(26,28,42,.22)';
      context.lineWidth = 2;
      context.strokeRect(1, 1, 254, 254);
      context.strokeStyle = 'rgba(255,255,255,.15)';
      context.strokeRect(3, 3, 250, 250);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    resources.add(texture);
    return texture;
  }
  // Lawn: tileable blades over soft mottling, sharp at grazing angles. The picture is the same for every garden.
  function grassTexture() {
    if (lawnPicture?.document !== document) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 512;
      paintGrassTexture(paintContext(canvas), 512);
      lawnPicture = { document, canvas };
    }
    const texture = new THREE.CanvasTexture(lawnPicture.canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 8;
    resources.add(texture);
    return texture;
  }
  yield;
  palette.path.map = stoneTexture('#c6c2ca', true);
  palette.stone.map = stoneTexture('#d3d3dd');
  yield;
  palette.ground.map = grassTexture();
  configureTurfEdge(palette.ground);
  yield;
  palette.roof.map = stoneTexture('#b5b5c3');
  yield;
  palette.bridgeDeck = createGraniteBridgeMaterial(THREE, document, resources);
  // Owner, round 4: the granite still showed through the stair slabs in a sawtooth on the owner's computer, though
  // the slabs stand 4-35 cm above it. The deck yields in depth by a few steps of whatever depth buffer the GPU gives
  // (the offset scales with its precision), so stair slabs, path tiles and lines over the deck always win.
  palette.bridgeDeck.polygonOffset = true;
  palette.bridgeDeck.polygonOffsetFactor = 1;
  palette.bridgeDeck.polygonOffsetUnits = 4;
  // Snow lies on things (island tops, twigs, roofs), often exactly in their plane: always drawn in front of them
  // (round 5, scripts/zfight-audit.mjs: the winter cover flickered against the ground from above).
  Object.assign(palette.snow, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
  // The stair risers: the deck's granite a shade darker, so each step reads in flat daylight.
  palette.stairRiser = palette.bridgeDeck.clone();
  palette.stairRiser.color.multiplyScalar(0.8);
  resources.add(palette.stairRiser);
  const setCliffSeason = configureCliffMaterial(palette.rock, palette.ground.color, { soil: true });
  palette.boulder = new THREE.MeshStandardMaterial({ color: 0x7d7682, roughness: 0.9, vertexColors: true });
  resources.add(palette.boulder);
  const setBoulderSeason = configureCliffMaterial(palette.boulder, palette.ground.color, { moss: 0.4 });
  // Bridge parts get their own material copies: only they carry the reveal discard.
  // Shared colours and maps stay linked; changing scalars are copied before each render.
  const bridgeMaterials = new Map();
  function bridgeMaterial(base) {
    if (!bridgeMaterials.has(base)) {
      const copy = base.clone();
      // clone() drops a material's own shader hook (only water has one among bridge parts); keep it.
      if (Object.prototype.hasOwnProperty.call(base, 'onBeforeCompile')) {
        copy.onBeforeCompile = base.onBeforeCompile;
        copy.customProgramCacheKey = base.customProgramCacheKey;
      }
      for (const key of ['color', 'emissive', 'map']) if (base[key]) copy[key] = base[key];
      copy.userData.bridgeOf = base;
      resources.add(copy);
      bridgeMaterials.set(base, copy);
    }
    return bridgeMaterials.get(base);
  }
  function syncBridgeMaterials() {
    for (const [base, copy] of bridgeMaterials) {
      copy.opacity = base.opacity;
      if ('emissiveIntensity' in base) copy.emissiveIntensity = base.emissiveIntensity;
      copy.visible = base.visible;
    }
  }
  function batch(
    kind,
    material,
    position,
    scale,
    rotation = { x: 0, y: 0, z: 0 },
    winter = false,
    tint,
    extra
  ) {
    const key = kind + ':' + material + ':' + winter + (currentConnective ? ':bridge' : '');
    if (!buckets.has(key))
      buckets.set(key, {
        geometry: geometries[kind],
        material: currentConnective ? bridgeMaterial(palette[material]) : palette[material],
        transforms: [],
        tints: [],
        extras: [],
        owners: [],
        reveals: [],
        winter,
        connective: !!currentConnective
      });
    dummy.position.copy(V(position));
    dummy.rotation.set(rotation.x || 0, rotation.y || 0, rotation.z || 0, rotation.order || 'XYZ');
    dummy.scale.copy(V(scale));
    dummy.updateMatrix();
    const bucket = buckets.get(key);
    bucket.transforms.push(dummy.matrix.clone());
    bucket.tints.push(tint);
    bucket.extras.push(extra);
    bucket.owners.push(currentOwner);
    bucket.reveals.push(currentConnective);
  }
  function mesh(geometry, material, parent = scene) {
    resources.add(geometry);
    const result = new THREE.Mesh(geometry, currentConnective ? bridgeMaterial(material) : material);
    parent.add(result);
    result.userData.owner = currentOwner;
    if (currentConnective) result.userData.connective = currentConnective;
    return result;
  }
  // A baked mesh drawn as one instance at the identity (the material's instanced program; see the bake).
  function bakedInstance(geometry, material) {
    resources.add(geometry);
    const result = new THREE.InstancedMesh(geometry, material, 1);
    scene.add(result);
    resources.add(result);
    result.userData.owner = currentOwner;
    return result;
  }
  const winterObjects = [],
    summerObjects = [];
  function snow(geometry, position, scale, parent = scene) {
    const object = mesh(geometry, palette.snow, parent);
    object.position.copy(V(position));
    object.scale.copy(V(scale));
    winterObjects.push(object);
    return object;
  }
  function line(points, material, radius = 0.05, parent = scene, closed = false, segments) {
    const curve = new THREE.CatmullRomCurve3(points.map(V), closed);
    return mesh(
      new THREE.TubeGeometry(
        curve,
        segments ?? Math.max(12, Math.ceil(points.length * 0.9)),
        radius,
        4,
        closed
      ),
      palette[material],
      parent
    );
  }
  const fixtures = [];
  let lightStyle = 'natural',
    nightStrength = 0,
    practicalField = null,
    lightEconomy = false,
    lightSelection = [],
    practicalLevel = 1;
  function practical(
    position,
    parent = scene,
    radius = 6,
    strength = 0.85,
    channel = 0,
    base = 0,
    power = 42
  ) {
    parent.updateWorldMatrix(true, false);
    const p = parent.localToWorld(V(position));
    fixtures.push({
      x: p.x,
      y: p.y,
      z: p.z,
      radius,
      strength,
      channel,
      base: base + parent.position.y,
      power
    });
  }
  // Cast-iron lantern parts (LANTERN): frame and cap, an optional post stem, glass and glow, all instanced.
  // The glass tint picks blue, violet (both follow the light style) or a warm that stays warm in Neon.
  function lanternParts(at, size, rotation, tint, stem = true) {
    const scale = { x: size, y: size, z: size },
      turn = { y: rotation };
    batch('lanternHead', 'rail', at, scale, turn);
    if (stem) batch('lanternStem', 'rail', at, scale, turn);
    batch('lanternPane', 'lanternPane', at, scale, turn, false, tint);
    batch('lanternHalo', 'lanternHalo', at, scale, undefined, false, tint);
  }
  function lantern(position, variant = 'lampBlue', size = 1, rotation = 0) {
    practical(position, scene, 5.8, 0.65, variant === 'lampViolet' ? 1 : 0, position.y - 1.35 * size, 30);
    const x = position.x,
      y = position.y,
      z = position.z;
    fixtureBoxes.push(
      new THREE.Box3(
        new THREE.Vector3(x - 0.5 * size, y - 0.8 * size, z - 0.5 * size),
        new THREE.Vector3(x + 0.5 * size, y + LANTERN.finial * size, z + 0.5 * size)
      )
    );
    lanternParts({ x, y, z }, size, rotation, LANTERN.tint[variant === 'lampViolet' ? 'violet' : 'blue']);
  }
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 128;
  const gc = paintContext(glowCanvas),
    gradient = gc.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,.8)');
  gradient.addColorStop(0.3, 'rgba(255,255,255,.28)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  gc.fillStyle = gradient;
  gc.fillRect(0, 0, 128, 128);
  const glowTexture = new THREE.CanvasTexture(glowCanvas);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  resources.add(glowTexture);
  const glowMaterial = new THREE.MeshBasicMaterial({
    map: glowTexture,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0.48,
    side: THREE.DoubleSide,
    // Added light does not depend on the order of the faces: one draw, not three's back-then-front pair (which
    // re-chose the program twice every frame, round 22).
    forceSinglePass: true,
    toneMapped: false,
    // Pools of lamp light lie a centimetre over floors, rugs and paths: pulled in front of them at any distance
    // (past the rugs' own -8, pavilion-hall.mjs).
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -16
  });
  resources.add(glowMaterial);
  function groundGlow(position, width = 4, depth = 4, parent = scene, tint = '#6e8bff') {
    const g = new THREE.PlaneGeometry(width, depth),
      c = new THREE.Color(tint);
    g.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(
        Array.from({ length: g.attributes.position.count }, () => c.toArray()).flat(),
        3
      )
    );
    const object = mesh(g, glowMaterial, parent);
    object.rotation.x = -Math.PI / 2;
    object.position.copy(V(position));
    return object;
  }
  let seed = 739,
    islandRandom = null;
  // A project island draws from its own identity stream, so its shape and planting
  // do not depend on which other projects are shown; scenery keeps the shared one.
  function random() {
    if (islandRandom) return islandRandom();
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }
  const groundRoute = route.count
    ? Array.from({ length: route.segments * 100 + (route.closed ? 0 : 1) }, (_, i) => route.point(i / 100))
    : [];
  const spokeLength = Math.hypot(route.spoke(1).x, route.spoke(1).z);
  if (route.count)
    for (let r = 6.1; r < spokeLength - 2.6; r += 0.35) groundRoute.push(route.spoke(r / spokeLength));
  function clearOfWalkway(x, z, margin = 2.95) {
    return !groundRoute.some(p => Math.hypot(p.x - x, p.z - z) < margin);
  }
  const contour = (angle, profile = 0) =>
    1 +
    (profile % 3 === 0
      ? 0.1 * Math.cos(angle * 3) + 0.05 * Math.sin(angle * 5)
      : profile % 3 === 1
        ? 0.13 * Math.sin(angle * 2) + 0.045 * Math.cos(angle * 5)
        : 0.11 * Math.cos(angle) + 0.08 * Math.sin(angle * 3));
  function terrainUV(geometry) {
    const p = geometry.attributes.position,
      uv = [];
    for (let i = 0; i < p.count; i++) uv.push(p.getX(i) * 0.075, p.getZ(i) * 0.075);
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    return geometry;
  }
  function rockGeometry(radius, depth, offset, profile = 0) {
    return createBasaltGeometry(THREE, radius, depth, offset, profile, contour, random);
  }
  // Baking the lawn: the turf slabs keep their cut-edge depth, and every other lawn piece merges with them as plain
  // lawn (depth 0).
  const keepsTurfDepth = (name, object) => name === 'turfDepth' && object.material === palette.ground;
  function plainLawnDepth(object, source) {
    if (object.material !== palette.ground || source.attributes.turfDepth) return;
    source.setAttribute(
      'turfDepth',
      new THREE.BufferAttribute(new Float32Array(source.attributes.position.count), 1)
    );
  }
  // The depth below the turf's top (0) down to its bottom (1) at every vertex, for the cut edge's shading.
  function withTurfDepth(geometry, topY, height) {
    const p = geometry.attributes.position,
      depth = new Float32Array(p.count);
    for (let k = 0; k < p.count; k++) depth[k] = Math.min(1, Math.max(0, (topY - p.getY(k)) / height));
    geometry.setAttribute('turfDepth', new THREE.BufferAttribute(depth, 1));
    return geometry;
  }
  // The island bodies: rock, turf top and snow (world-islands.mjs).
  const { island } = createIslandBuilder({
    floors,
    islandSurfaces,
    palette,
    batch,
    mesh,
    snow,
    random,
    clearOfWalkway,
    contour,
    terrainUV,
    rockGeometry,
    withTurfDepth,
    hangVines
  });
  // Ivy curtains hang from the rim in varied lengths, some with violet wisteria or small pale flowers.
  // Deterministic (never the scenery RNG); planned here, emitted by emitVines once every fall is known. The cliff
  // tapers in under the lip, so each strand is laid along the rock (vine-drape.mjs) and the curtain stops where
  // the rock turns into an underside.
  function hangVines(x, z, radius, depth, y, stretch, profile, rotation, cliff) {
    const count = Math.max(VINES.min, Math.round(radius * VINES.perRadius)),
      surface = createCliffSurface(cliff);
    for (let j = 0; j < count; j++) {
      const hash = k => Math.abs(Math.sin(x * 12.9898 + z * 78.233 + j * 37.719 + k * 5.13) * 43758.5453) % 1,
        h = hash(0),
        g = hash(1),
        a = ((j + 0.35 * h) / count) * Math.PI * 2 + 0.21,
        // Just inside the top edge of the slab: a 26-gon, so mid-edge sits in by its sagitta.
        r = radius * contour(a, profile) * 0.99 * Math.cos(Math.PI / 26) - 0.08 - 0.06 * h;
      const lx = Math.sin(a) * r * stretch,
        lz = (Math.cos(a) * r) / stretch,
        px = x + Math.cos(rotation) * lx + Math.sin(rotation) * lz,
        pz = z - Math.sin(rotation) * lx + Math.cos(rotation) * lz;
      const heading = Math.atan2(px - x, pz - z),
        // Width scale, mirrored on half the curtains for variety.
        width = (0.92 + 0.22 * h) * (g > 0.5 ? -1 : 1),
        yaw = heading + (h - 0.5) * 0.35,
        // From short tufts to long trails; even scale only (the lead strand is built 4 m long).
        fit = planDrape({
          surface,
          frame: { x, z, rotation, stretch },
          origin: { x: px, z: pz },
          yaw,
          width,
          length: Math.min(depth * 0.6, 1.5 + 4.4 * g),
          paths: geometries.vine.userData.strandPaths
        });
      vinePlans.push({
        x: px,
        y,
        z: pz,
        yaw,
        width,
        length: fit.length,
        drape: fit.offsets,
        owner: currentOwner,
        connective: currentConnective
      });
    }
  }
  // No strand hangs within reach of a fall's curtain, so the water never pours through the ivy.
  function emitVines() {
    const owner = currentOwner,
      connective = currentConnective;
    for (const v of vinePlans) {
      if (waterZones.some(w => Math.hypot(v.x - w.lip.x, v.z - w.lip.z) < w.width + 1.3)) continue;
      currentOwner = v.owner;
      currentConnective = v.connective;
      // Width scale (mirrored on half the curtains for variety) and strand length on y; the shader keeps
      // each leaf card at its real size, so short tufts are dense and long trails open up.
      batch(
        'vine',
        'vine',
        { x: v.x, y: v.y + 0.2, z: v.z },
        { x: v.width, y: (Math.abs(v.width) * v.length) / 4, z: Math.abs(v.width) },
        { y: v.yaw },
        false,
        undefined,
        v.drape
      );
    }
    currentOwner = owner;
    currentConnective = connective;
  }
  function plant(x, z, scale = 1, base = 0, red = false) {
    if (!clearOfWalkway(x, z, 3.25)) return;
    // Delay emission until every concrete surface and shore is known; preserve the scenery RNG sequence.
    plantPlans.push({
      x,
      z,
      scale,
      base,
      red,
      radius: 1.12 * scale,
      random: Array.from({ length: 12 }, random),
      owner: currentOwner,
      scenic: currentScenic
    });
  }
  function emitPlant(p) {
    const previous = currentOwner;
    currentOwner = p.owner || 0;
    const form = plantForm(p);
    for (const part of form.parts) {
      if (
        part.kind === 'fir' ||
        part.kind === 'firSnow' ||
        (part.kind === 'stem' && part.winter === 'summer')
      )
        continue;
      // Basal leaves become low photo fronds at the root, sharing the underplanting geometry.
      if (part.kind === 'leaf') {
        batch(
          'groundFern',
          'shrubFoliage',
          { x: part.position.x, y: p.base, z: part.position.z },
          { x: part.scale.x * 1.7, y: part.scale.y * 1.4, z: part.scale.z * 1.7 },
          { y: part.rotation.y || 0 }
        );
        continue;
      }
      // Blossoms sit in the foliage instead of on bare stalks; woody sprays show only as bare winter shrubs.
      const position =
        part.kind === 'flower'
          ? { ...part.position, y: p.base + (part.position.y - p.base) * 0.66 }
          : part.position;
      batch(
        part.kind,
        part.kind === 'shrubCrown' ? 'shrubFoliage' : part.material,
        position,
        part.scale,
        part.rotation,
        part.kind === 'shrubTwig' ? true : part.winter,
        part.tint
      );
    }
    // Flowering shrubs: blossom clusters settle into most green shrubs, not only the red-flag beds.
    if (form.species !== 'cypress' && !p.red && p.random[9] > 0.3)
      form.parts
        .filter(part => part.kind === 'shrubCrown')
        .slice(0, 2)
        .forEach((part, i) =>
          batch(
            'flower',
            'redLeaf',
            { x: part.position.x, y: part.position.y + 0.16 * p.scale, z: part.position.z },
            { x: 0.62 * p.scale, y: 0.62 * p.scale, z: 0.62 * p.scale },
            { y: i * 2.1 + p.random[8] * 6 },
            'summer'
          )
        );
    // Underplanting inside the plant's own accepted footprint, so it never reaches paving or shore.
    for (let i = 0; i < 3; i++) {
      const a = p.random[i + 4] * Math.PI * 2,
        r = p.radius * (0.45 + 0.35 * p.random[(i + 7) % 12]);
      batch(
        'groundFern',
        'shrubFoliage',
        { x: p.x + Math.sin(a) * r, y: p.base, z: p.z + Math.cos(a) * r },
        { x: p.scale * (0.8 + 0.4 * p.random[i]), y: p.scale, z: p.scale * (0.8 + 0.4 * p.random[i]) },
        { y: a * 3 }
      );
    }
    if (form.species === 'cypress') cypressPlantColumn(p);
    currentOwner = previous;
  }
  // Front firs by the pavilions are winter-only Christmas trees; they join the fir buckets last (see
  // flushWinterFirs) so the season pass hides them by instance count without extra draw calls.
  const winterOnlyFirs = [],
    seasonalFirs = [],
    speciesLog = [];
  let yearRoundFirs = 0;
  function pine(x, z, scale = 1, base = 0, decorated = true, winterOnly = false) {
    const count = importedPine?.collisionObjects?.length || 0;
    if (importedPine?.addSmall?.(x, z, scale, base)) {
      blockers.push(...importedPine.collisionObjects.slice(count));
      return;
    }
    if (winterOnly) winterOnlyFirs.push({ x, z, scale, base, owner: currentOwner });
    else firInstance(x, z, scale, base, decorated);
  }
  // One instance per part: needles, trunk, twigs, the spiral light string and its star.
  // The root sits on the lawn top (island top + 0.2); the model is 5.6 m tall at scale 1.
  // The spruce itself stands all year; its light string and star are winter-only.
  function firInstance(x, z, scale, base, decorated) {
    const at = { x, y: base + 0.2, z },
      size = { x: scale, y: scale, z: scale },
      turn = { y: x * 1.7 + z * 0.9 };
    batch('firNeedles', 'needles', at, size, turn);
    batch('firWood', 'firBark', at, size, turn);
    // The trunk alone is an obstacle (the twigs are not): an unrendered copy feeds the collision boxes.
    const trunk = new THREE.Mesh(geometries.firTrunk);
    trunk.position.copy(V(at));
    trunk.scale.setScalar(scale);
    trunk.rotation.y = turn.y;
    trunk.updateMatrixWorld();
    blockers.push(trunk);
    if (!decorated) return;
    batch('firCord', 'firWire', at, size, turn, true);
    batch('firBulbs', 'firLights', at, size, turn, true);
    batch('firStar', 'starGold', at, size, turn, true);
  }
  function flushWinterFirs() {
    yearRoundFirs = buckets.get('firNeedles:needles:false')?.transforms.length || 0;
    const previous = currentOwner;
    for (const f of winterOnlyFirs) {
      currentOwner = f.owner;
      firInstance(f.x, f.z, f.scale, f.base, true);
    }
    currentOwner = previous;
  }
  // Ordinary species from the same phase as the crown habit (maples, some birches, the rest oaks),
  // unless the planting names one.
  function treeWood(x, z, central, species) {
    const phase = x * 0.31 + z * 0.27,
      maple = Math.sin(phase * 3.7 + 1.3) > 0.15,
      kind = central
        ? 'old'
        : species || (maple ? 'maple' : Math.sin(phase * 5.3 + 0.4) > 0.1 ? 'birch' : 'oak');
    const woodMaterial = { old: palette.oldBark, birch: palette.birchBark }[kind];
    return { kind, birch: kind === 'birch', woodMaterial: woodMaterial || palette.treeBark };
  }
  // The Scots pine and the Italian cypress with its trunk (world-conifers.mjs).
  const { pineTree, cypressPlantColumn, cypressTree } = createConiferBuilders({
    blockers,
    mesh,
    palette,
    batch
  });
  // species: oak | maple | birch | pine | spruce | cypress (default from the spot's phase). A quiet tree
  // (planted after the scenery) draws from its own stream instead of the shared scenery RNG.
  function tree(x, z, size = 1, central = false, base = 0, species, quiet = false) {
    // Lawn top (island top is 0.4 m thick, centred on base); wood sinks below it, never stands on it.
    const ground = base + 0.2,
      detail = currentScenic ? WOOD_DETAIL.scenic : WOOD_DETAIL.near,
      { kind, birch, woodMaterial } = treeWood(x, z, central, species),
      draw = quiet ? randomStream(Math.floor(Math.abs(x * 977 + z * 131)) + 1) : random;
    speciesLog.push({
      kind,
      x: +x.toFixed(2),
      z: +z.toFixed(2),
      size: +size.toFixed(2),
      owner: currentOwner
    });
    if (kind === 'pine' || kind === 'spruce' || kind === 'cypress') {
      // The eight samples a broadleaf crown draws keep every later scenery placement where it was.
      if (!quiet) for (let k = 0; k < 8; k++) random();
      if (kind === 'pine') pineTree(x, z, size, base, ground, detail);
      else if (kind === 'spruce') pine(x, z, size * 1.1, base, false);
      else cypressTree(x, z, size, base);
      return;
    }
    // Oaks spread broad and low with crooked limbs; birches are narrow, tall and airy.
    const [crownWide, crownTall] = kind === 'oak' ? [1.08, 0.94] : birch ? [0.8, 1.15] : [1, 1],
      shaped = s => ({ x: s.x * crownWide, y: s.y * crownTall, z: s.z * crownWide });
    // A twig leaves its parent's axis (wood = {curve, radiusAt}) with a collar and arcs into a crown.
    const twig = (wood, u, to, summerOnly = false) => {
      const from = wood.curve.getPointAt(u),
        // On past the cluster's centre, outwards and a little up, so the twig shows among the outer leaves.
        out = V(to).sub(from).setY(0),
        end = V(to)
          .addScaledVector(out.lengthSq() > 1e-6 ? out.normalize() : out, LIMB.twigThrough * size)
          .setY(to.y + 0.4 * LIMB.twigThrough * size),
        curve = limbCurve(THREE, from, end, wood.curve.getTangentAt(u), {
          rise: 0.35,
          lift: 0.35
        }),
        object = mesh(
          createLimb(THREE, curve, {
            parentRadius: wood.radiusAt(u),
            rootRadius: LIMB.twigRoot * size,
            tipRadius: LIMB.twigTip * size,
            sides: detail.twig,
            segments: 2,
            seed: u * 7
          }).geometry,
          woodMaterial
        );
      blockers.push(object);
      if (summerOnly) summerObjects.push(object);
    };
    const crown = (position, form, rotation, wood, u, tint) => {
      const scale = shaped(form);
      twig(wood, u, position);
      batch('treeCrown', 'leaves', position, scale, rotation, false, tint);
      batch('treeSprig', 'bark', position, scale, rotation, true);
      batch(
        'treeSnow',
        'snow',
        position,
        { x: scale.x * 1.05, y: scale.y * 1.05, z: scale.z * 1.05 },
        rotation,
        true
      );
    };
    if (central && !importedPine) {
      const local = p => new THREE.Vector3(x + p[0] * size, base + p[1] * size, z + p[2] * size);
      // Summer-only wood (the winter fir stands in for this tree); roots stay out of the collision boxes.
      const keep = (geometry, blocker = true) => {
        const object = mesh(geometry, woodMaterial);
        summerObjects.push(object);
        if (blocker) blockers.push(object);
      };
      const limb = (curve, parent, u, rootRadius, tipRadius, sides, segments) => {
        const piece = createLimb(THREE, curve, {
          parentRadius: parent.radiusAt(u),
          rootRadius: rootRadius * size,
          tipRadius: tipRadius * size,
          sides,
          segments,
          seed: u * 5
        });
        keep(piece.geometry);
        return { curve, radiusAt: piece.radiusAt };
      };
      // Buttresses and surface roots face away from the portal plinth on the spoke side.
      const spoke = Math.atan2(route.spoke(1).x, route.spoke(1).z),
        rootAngles = [1.5, 2.3, 3.1, 3.9, 4.75].map(offset => spoke + offset),
        trunkCurve = new THREE.CatmullRomCurve3([
          local([0, 0, 0]).setY(ground - WOOD.sink * size),
          ...[
            [-0.48, 1.35, 0.17],
            [-0.25, 2.35, -0.08],
            [0.3, 3.25, -0.32],
            [-0.56, 3.98, -1.078]
          ].map(local)
        ]),
        mainTrunk = { curve: trunkCurve, radiusAt: u => (0.66 * Math.pow(1 - u, 0.8) + 0.06 * u) * size },
        trunk = createTrunk(THREE, trunkCurve, {
          size,
          ground,
          profile: mainTrunk.radiusAt,
          roots: rootAngles,
          sides: 14,
          segments: 10,
          flute: 0.07,
          flutes: 6,
          twist: 8,
          seed: 0.7,
          // Collars where the oak's limbs leave the bole.
          swells: OAK_LIMBS.map(l => l[1])
        });
      keep(trunk.geometry);
      keep(
        createRoots(THREE, {
          centre: trunk.soil,
          ground,
          size,
          angles: rootAngles,
          reach: 1.15,
          radius: 0.17,
          sides: 6,
          seed: 0.7
        }),
        false
      );
      // One lobed oak-leaf cluster: its card crown, the bare winter sprig, the twig that carries it and
      // two blue motes drifting below it (the glow pass makes them shine).
      let lobes = 0;
      const lobe = (wood, u, position, sx, sy, sz) => {
        const phase = lobes++ * 2.21,
          scale = { x: sx * size, y: sy * size, z: sz * size },
          rotation = { x: 0.1 * Math.cos(phase), y: phase * 0.83, z: 0.08 * Math.sin(phase * 1.3) };
        twig(wood, u, position, true);
        batch('crownCentral', 'treeAtlas', position, scale, rotation, 'summer');
        for (const k of [0, 1])
          batch(
            'mote',
            'lampBlue',
            {
              x: position.x + Math.sin(phase * 3 + k * 2.4) * scale.x * 0.5,
              y: position.y - scale.y * (0.45 + 0.3 * k),
              z: position.z + Math.cos(phase * 2 + k * 1.7) * scale.z * 0.5
            },
            { x: 0.035 + 0.02 * k, y: 0.035 + 0.02 * k, z: 0.035 + 0.02 * k },
            undefined,
            'summer'
          );
      };
      // Old oak: limbs leave the bole low, spread wide and twist (alternating sideways bends) as they
      // climb; each forks twice. Leaf clusters on the tips, forks and above each limb build a broad dome
      // with gaps that show the limbs inside.
      OAK_LIMBS.forEach(([turn, at, reach, rise, twist], a) => {
        const heading = spoke + turn,
          out = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading)),
          across = new THREE.Vector3(out.z, 0, -out.x),
          start = trunkCurve.getPointAt(at),
          // A point in this limb's frame, tree units [outward, up, sideways] from where it leaves the bole.
          along = (o, up, c) =>
            start
              .clone()
              .addScaledVector(out, o * size)
              .addScaledVector(across, c * size)
              .setY(start.y + up * size),
          arm = limb(
            new THREE.CatmullRomCurve3([
              start,
              along(reach * 0.3, rise * 0.06, twist * 0.5),
              along(reach * 0.6, rise * 0.3, -twist * 0.45),
              along(reach * 0.85, rise * 0.68, twist * 0.35),
              along(reach, rise, 0)
            ]),
            mainTrunk,
            at,
            0.24 - 0.02 * Math.floor(a / 2),
            0.05,
            8,
            8
          ),
          sign = a % 2 ? 1 : -1;
        // The first fork leaves low to one side, the second higher to the other.
        [0.45, 0.72].forEach((u, f) => {
          const from = arm.curve.getPointAt(u),
            tip = along(
              reach * (0.62 + 0.18 * f),
              rise * (0.62 + 0.3 * f) + 0.45,
              sign * (f ? -1 : 1) * (1.25 - 0.25 * f)
            ),
            bend = from.clone().lerp(tip, 0.5),
            fork = limb(
              new THREE.CatmullRomCurve3([from, bend.setY(bend.y + 0.2 * size), tip]),
              arm,
              u,
              0.09,
              0.025,
              6,
              4
            );
          lobe(fork, 0.85, tip.clone().setY(tip.y + 0.35 * size), 0.95, 0.85, 0.9);
        });
        lobe(arm, 0.92, along(reach + 0.25, rise + 0.4, 0), 1.25, 1, 1.1);
        lobe(arm, 0.55, along(reach * 0.45, rise + 1.35, -sign * 0.35), 1.1, 0.9, 1.05);
      });
      // A short leader rises from the bole's top and carries the dome's crown clusters.
      const leader = limb(
        new THREE.CatmullRomCurve3([
          trunkCurve.getPointAt(0.95),
          ...[
            [-0.6, 5, -1],
            [-0.3, 6.3, -0.5]
          ].map(local)
        ]),
        mainTrunk,
        0.95,
        0.12,
        0.04,
        7,
        5
      );
      for (const [u, p, s] of [
        [0.95, [-0.3, 6.95, -0.45], 1.2],
        [0.6, [0.8, 6.6, 0.5], 1],
        [0.7, [-1.4, 6.55, 0.7], 1]
      ])
        lobe(leader, u, local(p), s, s * 0.82, s * 0.94);
    }
    if (!central) {
      const phase = x * 0.31 + z * 0.27,
        heading = phase * 1.13,
        habit = Math.sin(phase * 2.4),
        wide = (1 + 0.11 * habit) * crownWide,
        height = (1 - 0.1 * habit) * crownTall,
        maple = kind === 'maple' ? MAPLE : birch ? BIRCH : undefined;
      const local = p =>
        new THREE.Vector3(
          x + (Math.cos(heading) * p[0] + Math.sin(heading) * p[2]) * size * wide,
          base + p[1] * size * height,
          z + (-Math.sin(heading) * p[0] + Math.cos(heading) * p[2]) * size * wide
        );
      // The bole sinks below the lawn and runs on as a thin leader into limb 1's inner crown,
      // so neither a cut ring at the soil nor a cut stub above the limbs shows.
      const trunkCurve = new THREE.CatmullRomCurve3([
          local([0, 0, 0]).setY(ground - WOOD.sink * size),
          ...[
            [-0.15, 1.65, 0.12],
            [0.12, 2.6, -0.09],
            [0.32, 3.24, 0.11],
            [0.745, 4.33, 0.198]
          ].map(local)
        ]),
        // Arc-length share of the old trunk top (control point 3 of 4 spans).
        top = trunkCurve.getLengths(200)[150] / trunkCurve.getLength(),
        // Birches are slimmer and straighter in the bole.
        bole = v => (0.31 * Math.pow(1 - v, 0.8) + 0.044 * v) * size * (birch ? 0.8 : 1),
        profile = u =>
          u <= top ? bole(u / top) : bole(1) + (0.014 * size - bole(1)) * ((u - top) / (1 - top)),
        rootAngles = Array.from(
          { length: detail.roots },
          (_, k) => heading + 0.6 + (k * Math.PI * 2) / detail.roots + 0.3 * Math.sin(phase * 1.7 + k * 2.1)
        ),
        trunk = createTrunk(THREE, trunkCurve, {
          size,
          ground,
          profile,
          roots: rootAngles,
          sides: detail.trunk,
          segments: detail.rings,
          seed: phase,
          // Limbs leave at (0.58 + i * 0.12) * top, below.
          swells: [0, 1, 2, 3].map(i => (0.58 + i * 0.12) * top),
          flare: birch ? 0.65 : 1
        }),
        trunkWood = { curve: trunkCurve, radiusAt: profile };
      blockers.push(mesh(trunk.geometry, woodMaterial));
      // Low surface roots are not collision boxes: they would wall off the lawn around the tree.
      mesh(
        createRoots(THREE, {
          centre: trunk.soil,
          ground,
          size,
          angles: rootAngles,
          sides: detail.rootSides,
          seed: phase,
          radius: birch ? 0.09 : 0.12
        }),
        woodMaterial
      );
      const limbs = [
        [-1.72, 3.95, -0.61],
        [1.49, 4.53, 0.45],
        [0.62, 4.18, 1.34],
        [-0.62, 4.98, -1.03]
      ];
      limbs.forEach(([dx, dy, dz], i) => {
        // Exactly the original eight scenery samples per tree preserve all other planting.
        const crownWidth = 1.1 + draw() * 0.1,
          crownHeight = 0.86 + draw() * 0.12,
          angle = phase + i * 2.17;
        // Limbs leave the bole along its grain with a collar, arc out and turn up into the crown.
        const position = local([dx, dy + 0.13 * Math.sin(angle), dz]),
          at = (0.58 + i * 0.12) * top,
          from = trunkCurve.getPointAt(at),
          // The limb runs on through its crown's centre towards the outer leaves (LIMB.through of the
          // crown's half-width), so the wood reads through summer gaps and as a real scaffold in winter.
          outward = position.clone().sub(from).setY(0),
          reachTip = position
            .clone()
            .addScaledVector(outward.normalize(), LIMB.through * 0.6 * 1.1 * size * crownWide)
            .setY(position.y + LIMB.climb * size),
          arm = limbCurve(THREE, from, reachTip, trunkCurve.getTangentAt(at), {
            sway: (kind === 'oak' ? 0.16 : 0.06) * Math.sin(angle * 1.3)
          }),
          limb = createLimb(THREE, arm, {
            parentRadius: trunkWood.radiusAt(at),
            rootRadius: LIMB.root * size,
            tipRadius: LIMB.tip * size,
            sides: detail.limb,
            seed: phase + i * 1.7
          }),
          wood = { curve: arm, radiusAt: limb.radiusAt };
        blockers.push(mesh(limb.geometry, woodMaterial));
        const scale = shaped({ x: crownWidth * 1.05 * size, y: crownHeight * 0.96 * size, z: 1.02 * size }),
          rotation = { x: 0.18 * Math.cos(angle), y: heading + angle, z: 0.16 * Math.sin(angle) };
        batch('treeCrown', 'leaves', position, scale, rotation, false, maple);
        batch('treeSprig', 'bark', position, scale, rotation, true);
        batch(
          'treeSnow',
          'snow',
          position,
          { x: scale.x * 1.05, y: scale.y * 1.05, z: scale.z * 1.05 },
          rotation,
          true
        );
        crown(
          local([dx * 1.25, dy - 0.32, dz + 0.52]),
          { x: 0.81 * size, y: 0.72 * size, z: 0.78 * size },
          { x: -0.16, y: heading + angle + 0.8, z: 0.14 },
          wood,
          0.61,
          maple
        );
        crown(
          local([dx * 0.67, dy + 0.55, dz - 0.47]),
          { x: 0.78 * size, y: 0.84 * size, z: 0.74 * size },
          { x: 0.23, y: heading - angle, z: -0.12 },
          wood,
          0.78,
          maple
        );
        // Inner fork fills the bare gap above the crotch without increasing crown radius.
        // A birch leaves it open: its crown is airy, and a weeping leafy twig hangs from each limb's wood.
        if (!birch)
          crown(
            local([dx * 0.5, dy - 0.2, dz * 0.44]),
            { x: 0.72 * size, y: 0.8 * size, z: 0.69 * size },
            { y: heading + i * 0.9, z: 0.22 * Math.sin(angle) },
            wood,
            0.41,
            maple
          );
        else {
          const hold = arm.getPointAt(WEEP.at);
          batch(
            'vineWeep',
            'vine',
            hold,
            { x: BIRCH_WEEP * size, y: BIRCH_WEEP * size, z: BIRCH_WEEP * size },
            // Out of the tree: the twig's arch drapes over the limb's outer side.
            { y: Math.atan2(hold.x - x, hold.z - z) }
          );
        }
      });
    }
    if (central) {
      // The portal gate (portal-gate.mjs) floats over the plinth, 2.8 m from the tree along the spoke.
      const a = Math.atan2(route.spoke(1).x, route.spoke(1).z),
        center = { x: Math.sin(a) * 2.8, y: 2.35, z: Math.cos(a) * 2.8 };
      portalGeometry.center = center;
      portalGeometry.normal = { x: Math.sin(a), y: 0, z: Math.cos(a) };
      portalGate = createPortalGate(THREE, { center, angle: a, resources });
      scene.add(portalGate.group);
      portalEffect = portalGate.effect;
      for (const object of portalGate.pickables) pickable.push({ object, kind: 'portal' });
      const plinth = mesh(new THREE.CylinderGeometry(2.2, 2.35, 0.24, 40), palette.path);
      plinth.position.set(center.x, 0.25, center.z);
      floors.push(plinth);
    }
  }
  // The rim stones and outlet boulders a pond places for itself; every other boulder keeps out of the water.
  const pondStones = new Set();
  function markPondStone() {
    pondStones.add(buckets.get('boulder:boulder:false')?.transforms.at(-1));
  }
  // Audit-only: every stone a pond placed for itself, in world space (position and radii).
  const pondStoneList = () =>
    [...pondStones].filter(Boolean).map(matrix => {
      const p = new THREE.Vector3(),
        q = new THREE.Quaternion(),
        s = new THREE.Vector3();
      matrix.decompose(p, q, s);
      return { x: p.x, y: p.y, z: p.z, sx: s.x, sy: s.y, sz: s.z };
    });
  // Island rim and scenery boulders are placed before the ponds exist, and some landed in the water ("a strange
  // stone in the middle of the pond"). Each one inside a pond's shore moves out onto the bank along the line
  // from the pond's centre; one that would end up over the island's edge is left out instead.
  function clearPondsOfBoulders() {
    const bucket = buckets.get('boulder:boulder:false');
    if (!bucket) return;
    const p = new THREE.Vector3(),
      q = new THREE.Quaternion(),
      s = new THREE.Vector3();
    for (const matrix of bucket.transforms) {
      if (pondStones.has(matrix)) continue;
      matrix.decompose(p, q, s);
      const reach = 0.8 * Math.max(s.x, s.z);
      for (const zone of waterZones)
        if (moveOntoBank(p, reach, zone)) {
          if (!onIsland(zone.island, p.x, p.z, 0.9)) s.setScalar(0);
          matrix.compose(p, q, s);
        }
    }
  }
  // Moves p (a boulder reaching `reach` round its centre) out of the pond onto its bank, along the line from the
  // pond's centre (straight back from the lip when it sits at the very centre). Returns whether it moved.
  const pondOffset = new THREE.Vector3();
  function moveOntoBank(p, reach, zone) {
    pondOffset.copy(p).sub(zone.center).setY(0);
    const u = pondOffset.dot(zone.across) / zone.rx,
      v = pondOffset.dot(zone.flow) / zone.rz,
      e = Math.hypot(u, v),
      clear = 1 + reach / Math.min(zone.rx, zone.rz);
    if (e >= clear) return false;
    const k = e > 0.05 ? clear / e : 0,
      [cu, cv] = k ? [u * k, v * k] : [0, -clear],
      // Its own height stays (copying the pond's centre would drop it to the water level).
      y = p.y;
    p.copy(zone.center)
      .addScaledVector(zone.across, cu * zone.rx)
      .addScaledVector(zone.flow, cv * zone.rz)
      .setY(y);
    return true;
  }
  // Whether (x, z) lies within `share` of the island's own outline.
  function onIsland(target, x, z, share) {
    if (!target) return true;
    const dx = x - target.x,
      dz = z - target.z,
      c = Math.cos(target.rotation || 0),
      n = Math.sin(target.rotation || 0),
      stretch = target.stretch || 1,
      lx = (c * dx - n * dz) / stretch,
      lz = (n * dx + c * dz) * stretch;
    return Math.hypot(lx, lz) < target.radius * contour(Math.atan2(lx, lz), target.profile) * share;
  }
  // The ponds and falls (world-water.mjs), built from here on into this garden's scene parts.
  const { waterfall } = createWaterBuilders({
    resources,
    pondPreview,
    palette,
    contour,
    islandSurfaces,
    waterSurfaces,
    waterZones,
    mesh,
    batch,
    terrainUV,
    withTurfDepth,
    markPondStone,
    onIsland
  });
  yield;
  const backdrop = createBackdrop(THREE, scene, resources, random, palette.rock),
    { sky, skyMaterial } = backdrop;
  yield;
  // The cloud sea follows every backdrop light change (time of day, light fades).
  const cloudSea = createCloudSea(THREE, { scene, resources }),
    snowfall = createSnowfall(THREE, { scene, resources }),
    backdropSetLight = backdrop.setLight;
  backdrop.setLight = light => {
    backdropSetLight(light);
    cloudSea.setLight(light);
  };
  waterAppearance.bindSky(skyMaterial);
  yield;
  scene.fog = new THREE.FogExp2('#a080bc', 0.002);
  yield;
  // A continuous edge-to-centre falloff follows the same deck geometry as the camera route.
  const ribbonCanvas = document.createElement('canvas');
  ribbonCanvas.width = 128;
  ribbonCanvas.height = 4;
  const rc = paintContext(ribbonCanvas),
    edgeGradient = rc.createLinearGradient(0, 0, 128, 0);
  for (const [p, c] of [
    [0, 'rgba(62,121,255,.66)'],
    [0.12, 'rgba(75,106,255,.38)'],
    [0.4, 'rgba(104,61,255,.04)'],
    [0.6, 'rgba(104,61,255,.04)'],
    [0.88, 'rgba(125,70,255,.38)'],
    [1, 'rgba(132,92,255,.66)']
  ])
    edgeGradient.addColorStop(p, c);
  rc.fillStyle = edgeGradient;
  rc.fillRect(0, 0, 128, 4);
  const ribbonTexture = new THREE.CanvasTexture(ribbonCanvas);
  ribbonTexture.colorSpace = THREE.SRGBColorSpace;
  resources.add(ribbonTexture);
  const ribbonMaterial = new THREE.MeshBasicMaterial({
    map: ribbonTexture,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    side: THREE.DoubleSide,
    // Added light: one draw instead of three's back-then-front pair (see glowMaterial).
    forceSinglePass: true,
    opacity: 0.7
  });
  resources.add(ribbonMaterial);
  const rp = [],
    ruv = [],
    rindex = [],
    rCount = route.segments * 100,
    edgeCount = route.segments * 24;
  currentConnective = 'ring';
  if (rCount) {
    for (let i = 0; i <= rCount; i++)
      for (const [side, uv] of [
        [-1, 0],
        [1, 1]
      ]) {
        const p = route.point((i / rCount) * route.segments, side * 2.3, 0.135);
        rp.push(p.x, p.y, p.z);
        ruv.push(uv, i / rCount);
      }
    for (let i = 0; i < rCount; i++) {
      const k = i * 2;
      rindex.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
    const ribbonGeometry = new THREE.BufferGeometry();
    ribbonGeometry.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
    ribbonGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(ruv, 2));
    ribbonGeometry.setIndex(rindex);
    ribbonGeometry.computeVertexNormals();
    mesh(ribbonGeometry, ribbonMaterial);
    for (const [side, material] of [
      [-1, 'bridgeNeonBlue'],
      [1, 'bridgeNeonViolet']
    ])
      line(
        Array.from({ length: edgeCount + (route.closed ? 0 : 1) }, (_, i) =>
          route.point((i / edgeCount) * route.segments, side * 2.28, 0.14)
        ),
        material,
        0.034,
        scene,
        route.closed
      );
  }
  currentConnective = null;
  const ambient = new THREE.HemisphereLight(0xd7cced, 0x28324c, 2);
  scene.add(ambient);
  const key = new THREE.DirectionalLight(0xffc5ac, 2.4);
  key.position.set(-28, 40, -55);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x8a9beb, 1);
  fill.position.set(30, 15, 28);
  scene.add(fill);
  const localBlue = new THREE.PointLight(0x4383ff, 44, 15, 2),
    localViolet = new THREE.PointLight(0x935aff, 38, 14, 2);
  scene.add(localBlue, localViolet);
  const portalLight = new THREE.PointLight(0x6e70ff, 20, 13, 2);
  portalLight.position.set(1, 2.8, 3);
  scene.add(portalLight);
  // Ultra graphics (owner, 2026-10-31, «как свет падает в темноте»): three more real lamp lights round the eye, so
  // more of the lamps near it shade the walls, stones, rails and water from their side (setUltraLamps).
  const ULTRA_LAMP_SHARE = 2.5;
  const ultraLamps = Array.from({ length: 3 }, () => {
    const light = new THREE.PointLight(0xffd4a0, 0, 12, 2);
    light.visible = false;
    scene.add(light);
    return light;
  });
  // Existing scenic exhibit: the close view and cue share the actual sign transform.
  let teaser = null;
  function comingSoon(x, z, y, angle) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = angle + Math.PI;
    scene.add(group);
    const base = mesh(new THREE.CylinderGeometry(2.7, 2.85, 0.3, 8), palette.stone, group);
    base.position.y = 0.3;
    const cloth = mesh(new THREE.CylinderGeometry(0.85, 2.0, 2.5, 7, 1), palette.stone, group);
    cloth.position.y = 1.75;
    cloth.scale.z = 0.74;
    const folded = mesh(new THREE.BoxGeometry(2.05, 0.22, 1.4), palette.stone, group);
    folded.position.set(0, 3.04, 0);
    folded.rotation.z = 0.07;
    for (const side of [-1, 1]) {
      const p = mesh(new THREE.CylinderGeometry(0.055, 0.065, 1.4, 5), palette.metal, group);
      p.position.set(side * 1.8, 1.03, 1.6);
    }
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 96;
    const ctx = paintContext(c);
    ctx.fillStyle = '#282338';
    ctx.fillRect(0, 0, 256, 96);
    ctx.strokeStyle = '#a894cd';
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, 248, 88);
    ctx.fillStyle = '#e9dff2';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '500 31px sans-serif';
    ctx.fillText(labels.comingSoon || 'Coming Soon', 128, 49);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    resources.add(texture);
    const mat = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
    resources.add(mat);
    const backing = mesh(new THREE.BoxGeometry(3.65, 1.43, 0.14), palette.dark, group);
    backing.position.set(0, 1.65, 1.6);
    const sign = mesh(new THREE.PlaneGeometry(3.55, 1.33), mat, group);
    sign.position.set(0, 1.65, 1.7);
    groundGlow({ x: 0, y: 0.465, z: 1.2 }, 4, 3, group);
    group.updateMatrixWorld(true);
    teaser = {
      center: group.localToWorld(new THREE.Vector3(0, 1.65, 1.7)),
      cue: group.localToWorld(new THREE.Vector3(0, 5.0, 1.7)),
      position: group.localToWorld(new THREE.Vector3(0, 6.4, 16))
    };
    sign.userData.dynamic = true;
    pickable.push({ object: sign, kind: 'teaser' });
  }
  // Ten or more projects widen the ring; distant scenery then moves out to keep
  // 3 m beyond the outermost island tip (69.06 m is the nearest scenic rim today).
  const islandShapes = {
    radius: [12.6, 12.4, 13.0, 12.4, 12.8, 13.1, 12.7],
    depth: [17, 14, 20, 15, 23, 19, 16],
    stretch: [0.7, 0.72, 0.68, 0.74, 0.71, 0.69, 0.73]
  };
  const identities = projects.map(project => islandIdentity(project.id)),
    styleOf = i => (options.recordIslandSeeds ? i : identities[i].style);
  const projectReach = projects.reduce((reach, _, i) => {
    const c = route.radial(i, route.radius + 10.2, 0),
      s = styleOf(i) % 7;
    return Math.max(reach, Math.hypot(c.x, c.z) + (islandShapes.radius[s] / islandShapes.stretch[s]) * 1.15);
  }, 0);
  const scenicPush = Math.max(0, projectReach + 3 - 69.06);
  // Three depths, uneven elevations and widths: scenery is legible from the bridges.
  currentScenic = true;
  for (let i = 0; i < 21; i++) {
    const a = (i / 21) * Math.PI * 2 + 0.12,
      layer = i % 3,
      r = [82, 119, 156][layer] + random() * 13 + scenicPush,
      y = [-7, 5, -12][layer] + random() * 9;
    const x = Math.sin(a) * r,
      z = Math.cos(a) * r,
      size = [5.7, 8.6, 5.4][layer] + random() * 2.4,
      stretch = [0.72, 1.32, 0.9, 1.12][i % 4];
    island(x, z, size, size * ([1.15, 1.85, 2.3, 0.95][i % 4] + random() * 0.25), y, stretch, i, a);
    // The rock and its vines, then the rest: one island in one step was up to 20 ms of a rearrangement (round 21).
    yield;
    for (let j = 0; j < 5; j++) {
      const q = i + (j < 3 ? 0.62 + j * 0.26 : 3.54 + (j - 3) * 0.32),
        px = x + Math.sin(q) * size * (j === 1 ? 0.63 : 0.53),
        pz = z + Math.cos(q) * size * (j === 1 ? 0.59 : 0.5);
      plant(px, pz, 0.6 + size * 0.065, y, j % 3 === 0);
    }
    if (i === 10) comingSoon(x, z, y, a);
    if (i % 3 !== 1)
      tree(
        x - size * 0.17,
        z + size * 0.1,
        0.35 + size * 0.075,
        false,
        y,
        SCENIC_TREES[i % SCENIC_TREES.length]
      );
    else
      for (const [dx, dz, red] of [
        [-0.25, 0.12, false],
        [0.18, -0.18, true],
        [0.25, 0.24, false]
      ])
        plant(x + size * dx, z + size * dz, 0.6 + size * 0.04, y, red);
    const localAngle = Math.PI + 0.24,
      edge = size * contour(localAngle, i) * 1.04,
      lx = Math.sin(localAngle) * edge * stretch,
      lz = (Math.cos(localAngle) * edge) / stretch;
    if (i % 3 !== 1)
      waterfall(
        x + Math.cos(a) * lx + Math.sin(a) * lz,
        z - Math.sin(a) * lx + Math.cos(a) * lz,
        y,
        a + localAngle,
        1.5 + size * 0.22,
        size * 3.3,
        Math.min(2.4, size * 0.4)
      );
    for (let j = 0; j < 3; j++) {
      const q = a + j * 2.1,
        p = { x: x + Math.sin(q) * size * 0.55, y: y + 0.35, z: z + Math.cos(q) * size * 0.52 };
      batch(
        'boulder',
        'boulder',
        p,
        { x: size * 0.18, y: size * (0.07 + 0.04 * j), z: size * 0.22 },
        { y: q }
      );
    }
    if (i % 3 === 0) {
      const p = { x: x - size * 0.35, z: z + size * 0.35 };
      plant(p.x, p.z, 0.55, y, true);
    }
    yield;
  }
  currentScenic = false;
  yield;

  island(0, 0, 7.8, 13.6);
  tree(0, 0, 1.6, true);
  // Two grounded garden lamps light the portal approach and the central planting.
  for (const [x, z] of [
    [-2.3, 4.5],
    [3.5, 0.6]
  ]) {
    // A turned cast-iron standard on a stone footing; its top meets the lantern's stem.
    batch('lampStandard', 'rail', { x, y: 0.2 + 0.16, z }, { x: 1, y: 1, z: 1 });
    batch('cylinder', 'stone', { x, y: 0.28, z }, { x: 0.34, y: 0.18, z: 0.34 });
    lantern({ x, y: 2.9, z }, 'lampBlue', 1.12);
    Object.assign(fixtures.at(-1), { radius: 9, strength: 1.2, channel: 2, base: 0.2, power: 66 });
  }
  let xmasTree = null;
  if (!importedPine) {
    const firX = XMAS.at.x,
      firZ = XMAS.at.z,
      root = { x: firX, y: 0.2, z: firZ },
      unit = { x: 1, y: 1, z: 1 };
    // The New Year fir: drooping photo-needle boughs on twigs and a buttressed trunk (instanced buckets);
    // its light strings, ornaments, ribbon, tinsel, gifts and star come from xmas-tree.mjs, one draw each.
    for (const [kind, material] of [
      ['centralFirNeedles', 'firNeedles'],
      ['centralFirTrunk', 'bark'],
      ['centralFirTwigs', 'firBark'],
      ['centralFirCord', 'firWire']
    ])
      batch(kind, material, root, unit, undefined, true);
    const raysCanvas = document.createElement('canvas');
    raysCanvas.width = raysCanvas.height = 256;
    paintStarRays(paintContext(raysCanvas), 256);
    const raysMap = new THREE.CanvasTexture(raysCanvas);
    raysMap.colorSpace = THREE.SRGBColorSpace;
    resources.add(raysMap);
    const look = createXmasMaterials(THREE, {
      time: foliageTime,
      snow: winterSnow,
      raysMap,
      glowMap: glowTexture
    });
    [look.decor, look.star, look.rays, look.glow].forEach(material => resources.add(material));
    const [, , star, rays, glow] = [
      mesh(geometries.centralFirBulbs, palette.firLights),
      mesh(geometries.centralFirDecor, look.decor),
      mesh(geometries.centralFirStar, look.star),
      mesh(new THREE.PlaneGeometry(XMAS.star.rays, XMAS.star.rays), look.rays),
      mesh(new THREE.PlaneGeometry(XMAS.glow.size, XMAS.glow.size), look.glow)
    ].map(part => {
      part.position.set(firX, root.y, firZ);
      // Own shaders and attributes (twinkle, finish, billboard): kept out of the static bake.
      part.userData.dynamic = true;
      winterObjects.push(part);
      return part;
    });
    star.rotation.y = 0.5;
    rays.position.y += centralDecor.starHeight;
    glow.rotation.x = -Math.PI / 2;
    glow.position.y += XMAS.glow.lift;
    xmasTree = {
      setNight: look.setNight,
      // Economy keeps only the fir's own string lit: the gold string and the swags are not drawn.
      setEconomy: enabled =>
        geometries.centralFirBulbs.setDrawRange(0, enabled ? centralDecor.economyIndex : Infinity)
    };
    xmasTree.setNight(nightStrength);
  }
  const fallAngle = 2.15,
    fallRadius = 7.8 * contour(fallAngle) * 1.075,
    fx = Math.sin(fallAngle) * fallRadius,
    fz = Math.cos(fallAngle) * fallRadius;
  waterfall(fx, fz, 0, fallAngle, 2.7, 21, 2.2);

  // The bridges' continuous deck in three strips (world-decks.mjs).
  const { continuousDeck } = createDeckBuilder({ scene, floors, palette, mesh });
  const bridgeWidth = 4.8,
    edgeOffset = 2.2;
  yield;
  // Rails run wherever a walkable edge is above void; only the pavilion deck and spoke junctions stay open.
  const railIslands = [
    { central: true, x: 0, z: 0, radius: 7.8 },
    ...projects.map((project, i) => {
      const style = styleOf(i);
      return {
        ...islandFrame(route, i),
        radius: islandShapes.radius[style % 7],
        stretch: islandShapes.stretch[style % 7],
        profile: style,
        contour
      };
    })
  ];
  const railSpans = Array.from({ length: route.segments }, (_, i) => [
    railSpan(route, railIslands, i, -1, { edge: edgeOffset }),
    railSpan(route, railIslands, i, 1, { edge: edgeOffset })
  ]);
  currentConnective = 'ring';
  if (route.segments) {
    // Rows every 1/700 of the route plus one at each end of every stair flight, so the bare stretch starts and
    // ends exactly where the treads do.
    const flights = Array.from({ length: route.segments }, (_, i) => stairFlight(route, i, STAIR_RISE)),
      cuts = flights.flatMap((f, i) => (f ? [i + f.edges[0], i + f.edges[f.edges.length - 1]] : [])),
      rows = [...Array.from({ length: 701 }, (_, i) => (i / 700) * route.segments), ...cuts].sort(
        (a, b) => a - b
      ),
      onStairs = q => {
        const f = flights[Math.floor(q)],
          u = q - Math.floor(q);
        return !!f && u > f.edges[0] && u < f.edges[f.edges.length - 1];
      };
    continuousDeck(
      rows.map(q => V(route.point(q, 0, 0.1))),
      bridgeWidth,
      scene,
      i => onStairs((rows[i] + rows[i + 1]) / 2)
    );
  }

  // The treads in the deck's own tiled granite (owner, round 5: the steps in the same design as the rest): per
  // flight one mesh of tops and one of risers (a shade darker). The pavers run along each tread with a joint at
  // its nosing, on the risers from the nosing down. Each tread's corners lie on
  // the route's lanes at its two ends, so on a bend neighbours meet edge to edge (straight boxes left wedge gaps
  // on the outer side, which the deck under them used to fill). The tread boxes stay solid for the camera
  // (treadMatrices, with the other solid boxes) and the mesh is a floor for the ground rays.
  const treadMatrices = [];
  // Faces of a tread as corner indices (0-3 bottom, 4-7 top; a/b the low/high progress end, - and + the lanes).
  const TREAD_FACES = [
    [4, 5, 7, 6],
    [0, 2, 3, 1],
    [0, 1, 5, 4],
    [2, 6, 7, 3],
    [0, 4, 6, 2],
    [1, 3, 7, 5]
  ];
  function treadMesh(treads) {
    const half = STAIR_LANES[0][1] / 2,
      tops = { positions: [], uv: [] },
      risers = { positions: [], uv: [] };
    for (const { pa, pb, top, bottom } of treads) {
      const ends = [
          route.point(pa, -half),
          route.point(pa, half),
          route.point(pb, -half),
          route.point(pb, half)
        ],
        corners = [
          ...ends.map(q => V({ x: q.x, y: bottom, z: q.z })),
          ...ends.map(q => V({ x: q.x, y: top, z: q.z }))
        ],
        depth =
          Math.hypot(
            ends[2].x + ends[3].x - ends[0].x - ends[1].x,
            ends[2].z + ends[3].z - ends[0].z - ends[1].z
          ) / 2;
      TREAD_FACES.forEach((face, f) => {
        const into = f < 2 ? tops : risers,
          order = [0, 1, 2, 0, 2, 3];
        for (const k of order.map(j => face[j])) {
          const q = corners[k],
            across = (k % 2 ? half : -half) / 1.4,
            along = (k % 4 < 2 ? 0 : depth) / 1.4;
          into.positions.push(q.x, q.y, q.z);
          // Tops (and bottoms): across and along the tread. Ends: across and down from the nosing. Sides: along
          // and down.
          if (f < 2) into.uv.push(across, along);
          else into.uv.push(f < 4 ? across : along, (top - q.y) / 1.4);
        }
      });
    }
    for (const [part, material] of [
      [tops, palette.bridgeDeck],
      [risers, palette.stairRiser]
    ]) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(part.positions, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(part.uv, 2));
      g.computeVertexNormals();
      const stairs = mesh(g, material);
      stairs.userData.stairs = true;
      floors.push(stairs);
    }
  }
  const waterStairs = [];
  for (let i = 0; i < route.segments; i++) {
    // No water on the bridges (owner: it made no sense there); the climb is a full-width stone staircase.
    // Real stairs (owner: the old thin lips read as lines): level stone treads at equal height steps of the
    // climb, each tread as high as its upper end, so a riser shows at every step, across the deck between the
    // curbs (STAIR_LANES) and only on the climbing part of the span. The visitors stand on the same treads
    // (stairs.mjs).
    const flight = stairFlight(route, i, STAIR_RISE);
    if (!flight) continue;
    const { steps, edges, climb: rise } = flight,
      treads = [];
    for (let k = 0; k < steps; k++) {
      const pa = i + edges[k],
        pb = i + edges[k + 1],
        mid = (pa + pb) / 2,
        top = flight.tops[k],
        bottom = Math.min(route.point(pa).y, route.point(pb).y) - 0.05,
        t = route.tangent(mid);
      for (const [lane, width] of STAIR_LANES) {
        const a = route.point(pa, lane),
          b = route.point(pb, lane),
          c = route.point(mid, lane);
        dummy.position.set(c.x, (top + bottom) / 2, c.z);
        dummy.rotation.set(0, Math.atan2(t.x, t.z), 0);
        dummy.scale.set(width, top - bottom, Math.hypot(b.x - a.x, b.z - a.z) + 0.02);
        dummy.updateMatrix();
        treadMatrices.push(dummy.matrix.clone());
      }
      treads.push({ pa, pb, top, bottom });
    }
    treadMesh(treads);
    waterStairs.push({ segment: i, rise, steps });
    yield;
  }
  for (let i = 0; i < route.segments; i++) {
    const from = i + 0.24,
      to = i + 0.76;
    for (const offset of [-edgeOffset, edgeOffset]) {
      const { from: railFrom, to: railTo } = railSpans[i][offset > 0 ? 1 : 0];
      mesh(
        createBridgeCurb(
          THREE,
          Array.from({ length: 33 }, (_, j) =>
            V(route.point(railFrom + ((railTo - railFrom) * j) / 32, offset + Math.sign(offset) * 0.08, 0.25))
          )
        ),
        palette.stone
      );
      for (const [height, material, width] of [
        [1.14, 'rail', 0.1],
        [0.64, 'rail', 0.065],
        [0.12, 'blue', 0.035]
      ]) {
        const points = Array.from({ length: 25 }, (_, j) =>
          route.point(
            railFrom + ((railTo - railFrom) * j) / 24,
            offset - (material === 'blue' ? Math.sign(offset) * 0.13 : 0),
            height
          )
        );
        line(points, material, width);
        if (material === 'rail')
          for (let k = 1; k < points.length; k++)
            railSegments.push({ a: V(points[k - 1]), b: V(points[k]), radius: width });
        if (material === 'blue')
          for (let k = 0; k < points.length; k++)
            bridgeEdges.push({
              p: railFrom + ((railTo - railFrom) * k) / 24,
              point: points[k],
              offset,
              halfWidth: bridgeWidth / 2
            });
      }
      for (let j = 0; j < 6; j++) {
        const p = railFrom + ((railTo - railFrom) * j) / 5,
          base = route.point(p, offset, 0.61);
        batch('box', 'rail', base, { x: 0.18, y: 1.25, z: 0.18 }, { y: route.angle(p) });
        batch(
          'box',
          'stone',
          route.point(p, offset, 0.22),
          { x: 0.42, y: 0.3, z: 0.42 },
          { y: route.angle(p) }
        );
        batch(
          'box',
          'metal',
          route.point(p, offset, 0.4),
          { x: 0.25, y: 0.06, z: 0.25 },
          { y: route.angle(p) }
        );
        const lamp = route.point(p, offset, 1.55);
        lantern(lamp, j % 4 === 0 ? 'lampViolet' : 'lampBlue', 0.95, route.angle(p));
      }
    }
    // A solid stone arch under the span (owner: the bridges read as a thin line, then the first thin arch with
    // posts looked odd): deep where it springs from the islands, shallow at the crown.
    mesh(
      createBridgeArch(
        THREE,
        // Both ends run on into the islands, so the arch springs from inside the rock and never hangs in the air.
        Array.from({ length: 49 }, (_, j) =>
          V(route.point(i + BRIDGE_ARCH.from + ((BRIDGE_ARCH.to - BRIDGE_ARCH.from) * j) / 48, 0, 0.1))
        ),
        bridgeWidth,
        t => BRIDGE_ARCH.crown + BRIDGE_ARCH.sag * (1 - Math.sin(Math.PI * t)) ** 1.6
      ),
      palette.stone
    );
    // Shallow transverse ribs meet the solid underside, never the walking surface.
    for (let j = 0; j < 6; j++) {
      const p = from + ((to - from) * j) / 5;
      batch('box', 'stone', route.point(p, 0, -0.47), { x: 0.34, y: 0.2, z: 4.5 }, { y: route.angle(p) });
    }
    // Winter garlands on the outer face of both rails: catenary swags from post to post, just under the top
    // rail, with round bulbs on sockets twinkling like the big tree (festive-garland.mjs); clear of the deck.
    for (const side of [-1, 1]) {
      const { from: winterFrom, to: winterTo } = railSpans[i][side > 0 ? 1 : 0],
        posts = Array.from({ length: 6 }, (_, j) => winterFrom + ((winterTo - winterFrom) * j) / 5),
        outside = side * (edgeOffset + GARLAND.rail.out),
        swags = railSwags(THREE, posts, (p, h) => V(route.point(p, outside, h))),
        garland = createGarland(THREE, swags, {
          ...GARLAND.rail,
          colours: GARLAND_COLOURS[['ice', 'warm', 'red'][i % 3]]
        });
      winterObjects.push(mesh(garland.bulbs, palette.firLights), mesh(garland.cord, palette.firWire));
      for (let j = 1; j < 3; j++) {
        const p = route.point(winterFrom + ((winterTo - winterFrom) * j) / 3, side * 1.65, 0.17);
        winterObjects.push(groundGlow(p, 1.3, 1.8));
      }
    }
    yield;
  }

  // The one radial bridge joins the tree island to the project ring.
  const spokeStart = 6.3,
    spokeEnd = Math.hypot(route.spoke(1).x, route.spoke(1).z),
    spokeAngle = Math.atan2(route.spoke(1).x, route.spoke(1).z);
  yield;
  currentConnective = 'spoke';
  if (route.count) {
    continuousDeck(
      Array.from({ length: 80 }, (_, i) =>
        V(route.spoke((spokeStart + ((spokeEnd - spokeStart) * i) / 79) / spokeEnd, 0.085))
      ),
      4.2
    );
    for (const side of [-1, 1]) {
      // Leave the T junction open; spoke rails must never cross the circulating route.
      const end = spokeEnd - 3.6,
        a = spokeAngle,
        off = new THREE.Vector3(Math.cos(a) * side * 1.95, 0, -Math.sin(a) * side * 1.95);
      mesh(
        createBridgeCurb(
          THREE,
          Array.from({ length: 33 }, (_, i) =>
            V(route.spoke((spokeStart + ((end - spokeStart) * i) / 32) / spokeEnd, 0.235)).add(
              off.clone().multiplyScalar(1.01)
            )
          )
        ),
        palette.stone
      );
      const pts = Array.from({ length: 16 }, (_, i) =>
        V(route.spoke((spokeStart + ((end - spokeStart) * i) / 15) / spokeEnd, 1.1)).add(off)
      );
      line(pts, 'rail', 0.07);
      for (let k = 1; k < pts.length; k++) railSegments.push({ a: pts[k - 1], b: pts[k], radius: 0.07 });
      line(
        pts.map(p => ({ x: p.x - off.x * 0.077, y: p.y - 0.95, z: p.z - off.z * 0.077 })),
        'violet',
        0.035
      );
      for (let i = 0; i < 5; i++) {
        const t = (spokeStart + ((end - spokeStart) * i) / 4) / spokeEnd,
          p = V(route.spoke(t, 0.57)).add(off);
        batch('box', 'rail', p, { x: 0.18, y: 1.2, z: 0.18 }, { y: spokeAngle });
        batch(
          'box',
          'stone',
          V(route.spoke(t, 0.205)).add(off),
          { x: 0.4, y: 0.3, z: 0.4 },
          { y: spokeAngle }
        );
        batch(
          'box',
          'metal',
          V(route.spoke(t, 0.385)).add(off),
          { x: 0.25, y: 0.06, z: 0.25 },
          { y: spokeAngle }
        );
        lantern(V(route.spoke(t, 1.55)).add(off), 'lampViolet', 0.9, spokeAngle);
      }
      // The same winter garland on the outer face of the spoke rails, post to post.
      const outside = off.clone().multiplyScalar(1 + GARLAND.rail.out / 1.95),
        spec = { ...GARLAND.rail, hook: 1.06 },
        posts = Array.from({ length: 5 }, (_, i) => (spokeStart + ((end - spokeStart) * i) / 4) / spokeEnd),
        garland = createGarland(
          THREE,
          railSwags(THREE, posts, (t, h) => V(route.spoke(t, h)).add(outside), spec),
          { ...spec, colours: GARLAND_COLOURS.warm }
        );
      winterObjects.push(mesh(garland.bulbs, palette.firLights), mesh(garland.cord, palette.firWire));
    }

    for (let i = 0; i < 5; i++) {
      const t = (spokeStart + ((spokeEnd - 3.6 - spokeStart) * i) / 4) / spokeEnd;
      batch('box', 'stone', route.spoke(t, -0.485), { x: 3.9, y: 0.2, z: 0.34 }, { y: spokeAngle });
    }
  }
  currentConnective = null;
  yield;

  let disposed = false;
  const engineeringDisplays = [];
  const engineeringCatalog = engineeringKinds.has(displayPrototype)
    ? createEngineeringCatalog(THREE, projects, labels, resources)
    : null;
  const displayAudits = [],
    displayCatalog = displayPrototype ? createDisplayCatalog(THREE, projects, resources) : null;
  const zoneScreens = createZoneScreens(THREE, resources, onChange, () => disposed, labels);
  const platformSites = [],
    islandSeedLog = [],
    islandFrames = [],
    pavilionGaps = [],
    lawnTreePlans = [],
    pondSiteLog = [],
    halls = [];
  // Project buildings (building-variants.mjs): by content volume a hall with rear stands, the wooden glasshouse
  // (greenhouse.mjs) or the stone gallery (stone-gallery.mjs). ?greenhouse=all|none|smallest|2,3 overrides it for previews.
  // Display studies keep their own structures. Both roofed variants count as "greenhouses" for the walk-in logic below.
  const buildingPlan = displayPrototype
      ? []
      : planBuildings(
          projects,
          options.greenhouse || 'volume',
          projects.map((_, i) => ({
            radius: islandShapes.radius[styleOf(i) % 7],
            stretch: islandShapes.stretch[styleOf(i) % 7]
          }))
        ),
    { houses: greenhouses, stone: stoneGalleries } = buildingSets(buildingPlan),
    greenhouseParts = new Map();
  let greenhouseMaterials = null,
    eastMaterials = null;
  for (let i = 0; i < projects.length; i++) {
    const project = projects[i];
    // Owner i+1 moves this island; its look follows the project, not the slot.
    const identity = identities[i],
      style = styleOf(i);
    currentOwner = i + 1;
    if (options.recordIslandSeeds) islandSeedLog.push({ id: project.id, slot: i, seed });
    else islandRandom = randomStream(identity.seed);
    const frame = islandFrame(route, i),
      a = frame.angle,
      center = frame;
    const base = center.y,
      radius = islandShapes.radius[style % 7],
      depth = islandShapes.depth[style % 7];
    const stretch = islandShapes.stretch[style % 7],
      outline = turfOutline(contour, { radius, stretch, profile: style }),
      sites = {
        description: platformSite(outline, 'description'),
        comments: platformSite(outline, 'comments')
      },
      land = island(
        center.x,
        center.z,
        radius,
        depth,
        base,
        stretch,
        style,
        a,
        greenhouses.has(i) ? [] : Object.values(sites).map(([sx, sz]) => ({ x: sx, z: sz, r: PLATFORM.base }))
      );
    platformSites[i] = sites;
    land.slot = i;
    land.owner = i + 1;
    yield;
    islandFrames.push({
      id: project.id,
      slot: i,
      owner: i + 1,
      style,
      source: identity.source,
      x: center.x,
      y: center.y,
      z: center.z,
      angle: a
    });
    const group = new THREE.Group();
    group.position.copy(V(route.radial(i, route.radius + 3.85, 0)));
    group.rotation.y = a;
    scene.add(group);
    pavilionGroups.push(group);
    function deckUV(geometry, dx = 0, dz = 0) {
      const p = geometry.attributes.position,
        uv = geometry.attributes.uv;
      for (let n = 0; n < p.count; n++) {
        const x = p.getX(n) + dx,
          z = p.getZ(n) + dz;
        uv.setXY(
          n,
          (group.position.x + Math.cos(a) * x + Math.sin(a) * z) / 1.4,
          (group.position.z - Math.sin(a) * x + Math.cos(a) * z) / 1.4
        );
      }
      return geometry;
    }
    // Join the pavilion to the exact sampled outer edge of the ring, with one top surface.
    // A closed ring wraps the sample index; open arcs and single islands sample the slot ring as it is.
    const outerEdge = p => {
      const n = route.count * 100,
        j = Math.floor(p * 100),
        t = p * 100 - j;
      const vertex = k => {
        if (route.closed) k = (k + n) % n;
        const q = V(route.point(k / 100, 0, 0.1)),
          before = V(route.point((route.closed ? Math.max(0, k - 1) : k - 1) / 100, 0, 0.1)),
          after = V(route.point((route.closed ? Math.min(n, k + 1) : k + 1) / 100, 0, 0.1)),
          // Level, as bridgeTangent: a sloped tangent pulled the strip 0.3 m onto the deck (a 0-3 mm overlap
          // that fought from the observatory where a bridge meets the island path, round 3).
          tangent = after.sub(before).setY(0).normalize();
        q.x -= (tangent.z * bridgeWidth) / 2;
        q.z += (tangent.x * bridgeWidth) / 2;
        return q;
      };
      return vertex(j).lerp(vertex(j + 1), t);
    };
    const local = p => {
      const dx = p.x - group.position.x,
        dz = p.z - group.position.z;
      return new THREE.Vector3(
        Math.cos(a) * dx - Math.sin(a) * dz,
        p.y - base,
        Math.sin(a) * dx + Math.cos(a) * dz
      );
    };
    const vertices = [],
      floorUV = [],
      floorIndices = [],
      columns = 24;
    for (let k = 0; k <= columns; k++) {
      const x = -3.275 + (6.55 * k) / columns;
      let lo = i - 0.3,
        hi = i + 0.3;
      for (let q = 0; q < 24; q++) {
        const mid = (lo + hi) / 2;
        if (local(outerEdge(mid)).x < x) lo = mid;
        else hi = mid;
      }
      const edge = local(outerEdge((lo + hi) / 2)),
        // A walk-in house's planks start at its front wall, so the landing ends there. It ran on under the floor
        // to the deck, and where the bridge edge stands higher its slope came up through the planks round the
        // pots inside the door (owner, round 12: holes and seams).
        inner = greenhouses.has(i) ? Math.max(GREENHOUSE.front, edge.z) : -0.65;
      for (const point of [edge, new THREE.Vector3(x, 0.48, inner)]) {
        vertices.push(point.x, point.y, point.z);
        floorUV.push(0, 0);
      }
      if (k < columns) {
        const n = k * 2;
        floorIndices.push(n, n + 1, n + 2, n + 2, n + 1, n + 3);
      }
    }
    const floorGeometry = new THREE.BufferGeometry();
    floorGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    floorGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(floorUV, 2));
    floorGeometry.setIndex(floorIndices);
    floorGeometry.computeVertexNormals();
    deckUV(floorGeometry);
    floors.push(mesh(floorGeometry, palette.path, group));
    if (displayPrototype) {
      const display = buildDisplayStructure(THREE, displayPrototype, {
        group,
        palette,
        mesh,
        blockers,
        practical,
        catalog: displayCatalog,
        index: i,
        project,
        engineeringCatalog
      });
      displayAudits.push(display);
      if (display.interactions) {
        pickable.push(...display.interactions);
        engineeringDisplays.push(display);
      }
      const texture = createProjectScreen(THREE, project, i, {
          resources,
          invalidate: onChange,
          isDisposed: () => disposed,
          status: mediaStatus,
          exhibit: true,
          focusWidth: options.screenWidth
        }),
        screenMaterial = contentLevel(new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
      resources.add(screenMaterial);
      const screen = mesh(new THREE.PlaneGeometry(...display.hero.size), screenMaterial, group);
      screen.position.set(...display.hero.position);
      screen.rotation.y = Math.PI;
      pickable.push({ object: screen, kind: 'project', index: i });
      mainScreens.push({ screen, material: screenMaterial, texture });
    } else if (greenhouses.has(i)) {
      // Greenhouse gallery (greenhouse.mjs): gallery, description and comments under one glass roof.
      const texture = createProjectScreen(THREE, project, i, {
          resources,
          invalidate: onChange,
          isDisposed: () => disposed,
          status: mediaStatus,
          focusWidth: options.screenWidth
        }),
        screenMaterial = contentLevel(new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
      resources.add(screenMaterial);
      glassMaterials ??= createGlassMaterials(THREE, resources);
      interiorMaterials ??= createInteriorMaterials(THREE, resources);
      greenhouseMaterials ??= createGreenhouseMaterials(THREE, resources);
      eastMaterials ??= { ...createEastMaterials(THREE, resources), snow: palette.snow };
      if (!hallLight) {
        hallLight = new THREE.MeshBasicMaterial({ color: '#ffd8a8', toneMapped: false });
        resources.add(hallLight);
      }
      const houseOptions = {
        owner: currentOwner,
        group,
        mesh,
        merge: mergeGeometries,
        materials: {
          ...greenhouseMaterials,
          glass: glassMaterials.glass,
          floor: interiorMaterials.floor,
          light: hallLight,
          east: eastMaterials
        },
        style: ['temple', 'dojo', 'pavilion'].includes(buildingPlan[i]?.variant)
          ? buildingPlan[i].variant
          : 'glasshouse',
        project,
        images: project.images?.length ? project.images : [project.image],
        videos: project.videos || [],
        labels,
        resources,
        invalidate: onChange,
        isDisposed: () => disposed,
        screenMaterial,
        idleMaterial: zoneScreens.items.idle.material,
        plants: {
          pot: palette.roof,
          soil: palette.soil,
          tall: geometries.hallPlant,
          small: geometries.potPlant,
          material: palette.indoorFoliage
        }
      };
      // `planned` lets the stone gallery stand on any project the building plan gave it.
      const house = stoneGalleries.has(i)
        ? buildStoneGallery(THREE, { ...houseOptions, planned: true })
        : buildGreenhouse(THREE, houseOptions);
      pickable.push({ object: house.screen, kind: 'project', index: i });
      mainScreens.push({ screen: house.screen, material: screenMaterial, texture });
      pickable.push({ object: house.open, kind: 'open', index: i });
      if (house.gallery)
        pickable.push({
          object: house.gallery.object,
          kind: 'frame',
          index: i,
          images: house.gallery.images
        });
      for (const { board, zone, own } of house.boards) {
        zoneBoards.push({ board, zone, index: i, own });
        pickable.push({ object: board, kind: 'zone', zone, index: i });
      }
      blockers.push(...house.blockers);
      halls.push({ group, ...house, open: 0 });
      greenhouseParts.set(i, house);
      // An East house's depth follows its content (greenhouse.mjs): the plan records it for the tests.
      if (buildingPlan[i]) buildingPlan[i].back = house.back;
      winterObjects.push(...(house.winterParts || []));
      // A house lamp knows its place in the house: in the Neon style its real light turns cyan or violet.
      house.lamps.forEach((lamp, k) => {
        // Its baked pool on the warm or the cool channel by turns (owner, round 17: in the practical channel it stayed
        // amber in Neon and the hall barely changed): warm and amber in Natural, cyan and violet in Neon.
        practical(lamp, group, 7, 0.8, k % 2, 0.48, 48);
        fixtures.at(-1).hall = k;
      });
      groundGlow({ x: 0, y: 0.5, z: 1.2 }, 5.6, 5.2, group, '#ffbf80');
    } else {
      // Modern flat roof from the confirmed realistic reference: a dark bevelled slab with a neon edge.
      // It covers the deeper glass hall (pavilion-hall.mjs); its front edge stays at z -2.83.
      const { rx, rz, cz } = HALL.roof,
        { back: backZ, screenZ } = HALL;
      const roofShape = new THREE.Shape();
      roofShape.absellipse(0, 0, rx, rz, 0, Math.PI * 2, false, 0);
      const roofGeometry = new THREE.ExtrudeGeometry(roofShape, {
        depth: 0.24 + (style % 3) * 0.03,
        bevelEnabled: true,
        bevelThickness: 0.05,
        bevelSize: 0.07,
        bevelSegments: 2,
        curveSegments: 44
      });
      roofGeometry.rotateX(-Math.PI / 2);
      const roof = mesh(roofGeometry, palette.dark, group);
      roof.position.set(0, 4.83, cz);
      blockers.push(roof);
      const roofEdge = [];
      for (let k = 0; k <= 64; k++) {
        const t = (k / 64) * Math.PI * 2;
        roofEdge.push({ x: Math.sin(t) * (rx + 0.09), y: 4.83 + 0.12, z: cz + Math.cos(t) * (rz + 0.09) });
      }
      line(roofEdge, 'bridgeNeonViolet', 0.03, group, true, 64);
      // No separate ceiling disc: one sat 1 cm inside the slab, never seen under its dark underside, and only
      // flickered against it (round 5, scripts/zfight-audit.mjs). The slab is the ceiling and the blocker.
      for (const z of [HALL.front, cz, backZ]) {
        const beam = mesh(new THREE.BoxGeometry(6.08, 0.13, 0.18), palette.metal, group);
        beam.position.set(0, 4.76, z);
      }
      const eave = mesh(new THREE.TorusGeometry(rx - 0.08, 0.06, 6, 42), palette.stone, group);
      eave.rotation.x = Math.PI / 2;
      eave.position.set(0, 4.8, cz);
      eave.scale.y = (rz - 0.08) / (rx - 0.08);
      snow(
        new THREE.CylinderGeometry(1, 1, 0.12, 44),
        { x: 0, y: 5.16 + (style % 3) * 0.03, z: cz },
        { x: rx - 0.06, y: 1, z: rz - 0.06 },
        group
      );
      for (const [x, z] of [
        [-2.95, HALL.front],
        [2.95, HALL.front],
        [-2.95, backZ],
        [2.95, backZ]
      ]) {
        const pillar = mesh(new THREE.CylinderGeometry(0.13, 0.2, 4.3, 8), palette.stone, group);
        pillar.position.set(x, 2.72, z);
        blockers.push(pillar);
        const capital = mesh(new THREE.CylinderGeometry(0.28, 0.2, 0.17, 8), palette.stone, group);
        capital.position.set(x, 4.73, z);
        const base = mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.25, 8), palette.stone, group);
        base.position.set(x, 0.605, z);
        const trim = mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.75, 8), palette.violet, group);
        trim.position.set(x, 1.6, z);
      }
      const back = mesh(new THREE.BoxGeometry(5.36, 3.08, 0.16), palette.roof, group);
      back.position.set(0, 2.75, screenZ + 0.15);
      blockers.push(back);
      const texture = createProjectScreen(THREE, project, i, {
          resources,
          invalidate: onChange,
          isDisposed: () => disposed,
          status: mediaStatus,
          focusWidth: options.screenWidth
        }),
        screenMaterial = contentLevel(new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
      resources.add(screenMaterial);
      const screen = mesh(new THREE.PlaneGeometry(5.18, 3.02), screenMaterial, group);
      screen.position.set(0, 2.75, screenZ);
      screen.rotation.y = Math.PI;
      pickable.push({ object: screen, kind: 'project', index: i });
      mainScreens.push({ screen, material: screenMaterial, texture });
      // The back of the screen is a lit poster about the project (rear-panel.mjs), framed in its accent colour.
      const rearMaterial = contentLevel(
        new THREE.MeshBasicMaterial({
          map: createRearPanel(THREE, project, i, {
            resources,
            invalidate: onChange,
            isDisposed: () => disposed,
            labels
          }),
          toneMapped: false
        })
      );
      resources.add(rearMaterial);
      const rearPoster = mesh(new THREE.PlaneGeometry(5.18, 3.02), rearMaterial, group);
      rearPoster.position.set(0, 2.75, screenZ + 0.236);
      const rearAccent = new THREE.MeshBasicMaterial({
        color: project.accent || '#a895e5',
        toneMapped: false,
        // Trim laid on the poster frame and roof edge: kept in front of them at any distance.
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -4
      });
      resources.add(rearAccent);
      for (const y of [1.215, 4.285]) {
        const trim = mesh(new THREE.BoxGeometry(5.3, 0.04, 0.03), rearAccent, group);
        trim.position.set(0, y, screenZ + 0.255);
      }
      for (const x of [-2.63, 2.63]) {
        const trim = mesh(new THREE.BoxGeometry(0.04, 3.11, 0.03), rearAccent, group);
        trim.position.set(x, 2.75, screenZ + 0.255);
      }
      for (const y of [1.18, 4.31]) {
        const trim = mesh(new THREE.BoxGeometry(5.43, 0.05, 0.06), palette.lampBlue, group);
        trim.position.set(0, y, screenZ - 0.06);
      }
      for (const x of [-2.69, 2.69]) {
        const trim = mesh(new THREE.BoxGeometry(0.05, 3.18, 0.06), palette.lampBlue, group);
        trim.position.set(x, 2.75, screenZ - 0.06);
      }
      const roofLine = Array.from({ length: 44 }, (_, j) => ({
        x: Math.sin((j / 44) * Math.PI * 2) * (rx - 0.14),
        y: 4.76,
        z: cz + Math.cos((j / 44) * Math.PI * 2) * (rz - 0.12)
      }));
      line(roofLine, 'lampViolet', 0.038, group, true);
      for (const x of [-2.94, 2.94]) {
        const trim = mesh(new THREE.BoxGeometry(0.035, 3.6, 0.035), palette.lampBlue, group);
        trim.position.set(x, 2.73, -1.63);
      }
      const accentGeometry = new THREE.BoxGeometry(5.35, 0.11, 0.1),
        accentColor = new THREE.Color(project.accent);
      accentGeometry.setAttribute(
        'color',
        new THREE.Float32BufferAttribute(
          Array.from({ length: accentGeometry.attributes.position.count }, () =>
            accentColor.toArray()
          ).flat(),
          3
        )
      );
      const accentStrip = mesh(accentGeometry, palette.brand, group);
      accentStrip.position.set(0, 4.4, screenZ - 0.05);
      // Wall lanterns on the outer side of the two front pillars: a scrolled bracket on the pillar and a warm
      // cast-iron lantern hanging clear of the shaft (instanced like every other lantern).
      group.updateMatrixWorld(true);
      for (const side of [-1, 1]) {
        const px = side * 2.94,
          shaft = 0.2 - ((2.42 - 0.57) / 4.3) * 0.07,
          face = px + side * shaft,
          { reach, size } = LANTERN.sconce,
          wall = group.localToWorld(new THREE.Vector3(face, 2.34, -1.6)),
          hanging = group.localToWorld(new THREE.Vector3(face + side * reach, 2.34, -1.6));
        const turn = group.rotation.y;
        batch('sconceBracket', 'rail', wall, { x: 1, y: 1, z: 1 }, { y: turn + (side * Math.PI) / 2 });
        lanternParts(hanging, size, turn, LANTERN.tint.warm, false);
      }
      // Warm ceiling fixtures stay legible in both quality modes; they hang just in front of the screen
      // and light it, above its top edge in the view from the station inside.
      const plaque = mesh(new THREE.BoxGeometry(1.5, 0.18, 0.38), palette.metal, group);
      plaque.position.set(0, 4.73, 3.0);
      const brandGeometry = new THREE.BoxGeometry(1.26, 0.055, 0.29),
        brandColor = new THREE.Color('#ffd4a0');
      brandGeometry.setAttribute(
        'color',
        new THREE.Float32BufferAttribute(
          Array.from({ length: brandGeometry.attributes.position.count }, () => brandColor.toArray()).flat(),
          3
        )
      );
      const diffuser = mesh(brandGeometry, palette.brand, group);
      diffuser.position.set(0, 4.62, 3.0);
      for (const [x, material] of [
        [-1.9, 'lampBlue'],
        [1.9, 'lampViolet']
      ]) {
        const housing = mesh(new THREE.CylinderGeometry(0.27, 0.23, 0.18, 10), palette.metal, group);
        housing.position.set(x, 4.52, 3.0);
        const lens = mesh(new THREE.CircleGeometry(0.205, 12), palette[material], group);
        lens.rotation.x = Math.PI / 2;
        lens.position.set(x, 4.421, 3.0);
        const mount = mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.18, 6), palette.metal, group);
        mount.position.set(x, 4.69, 3.0);
        practical({ x, y: 4.39, z: 3.0 }, group, 8, 0.9, material === 'lampViolet' ? 1 : 0, 0.48, 64);
      }
      // Floor pots by the entrance, the plant rooted in each pot's soil (pavilion-hall.mjs).
      for (const x of [-2.35, 2.35])
        pottedPlant(THREE, {
          group,
          mesh,
          pot: palette.roof,
          soil: palette.soil,
          plant: geometries.potPlant,
          plantMaterial: palette.indoorFoliage,
          x,
          z: -1.1,
          floor: 0.66,
          turn: x * 1.3,
          top: 0.21,
          bottom: 0.26,
          height: 0.38,
          segments: 8
        });
      // Glass walls, rooftop sign, warm interior and the in-world "Open project" pill (pavilion-glass.mjs).
      glassMaterials ??= createGlassMaterials(THREE, resources);
      const glassParts = buildGlassPavilion(THREE, {
        group,
        mesh,
        materials: glassMaterials,
        project,
        labels,
        resources,
        invalidate: onChange,
        isDisposed: () => disposed
      });
      pickable.push({ object: glassParts.open, kind: 'open', index: i });
      // The glass front with sliding doors and the project's gallery on the side walls (pavilion-hall.mjs).
      if (!hallLight) {
        hallLight = new THREE.MeshBasicMaterial({ color: '#ffd8a8', toneMapped: false });
        resources.add(hallLight);
      }
      const hall = buildHall(THREE, {
        group,
        mesh,
        merge: mergeGeometries,
        materials: glassMaterials,
        project,
        images: project.images?.length ? project.images : [project.image],
        resources,
        invalidate: onChange,
        isDisposed: () => disposed,
        light: hallLight
      });
      if (hall.gallery)
        pickable.push({ object: hall.gallery.object, kind: 'frame', index: i, images: hall.gallery.images });
      halls.push({ group, ...hall, open: 0 });
      // The room inside: wooden floor, rug, bench and corner plants (pavilion-hall.mjs).
      interiorMaterials ??= createInteriorMaterials(THREE, resources);
      buildInterior(THREE, {
        group,
        mesh,
        materials: interiorMaterials,
        frame: glassMaterials.frame,
        pot: palette.roof,
        soil: palette.soil,
        plant: geometries.hallPlant,
        plantMaterial: palette.indoorFoliage,
        accent: project.accent
      });
      groundGlow({ x: 0, y: 0.5, z: 1.2 }, 5.4, 5.0, group, '#ffbf80');
    }
    yield;
    // Pond site (pond-site.mjs), chosen before the trees stand. The fixed east-coast site (lip at x = edgeX * 1.04, z 7.5, flowing
    // +x) is kept where its basin, rim stones and outlet clear every paved or built shape (the stone-gallery island); elsewhere the
    // rear path ran across the water, so the pond takes the roomiest clear site on the rear-west shoulder (the rear spruce moves to
    // the pond's landward bank only if that is the only way to clear it).
    const shape = stoneGalleries.has(i)
      ? createStoneDeckShape(THREE)
      : createProjectDeckShape(
          THREE,
          greenhouses.has(i) ? greenhouseParts.get(i)?.deck || GREENHOUSE.deck : undefined
        );
    let lowX = 0,
      highX = 20;
    for (let j = 0; j < 14; j++) {
      const x = (lowX + highX) / 2,
        z = (7.5 - 6.35) * stretch,
        polar = Math.atan2(x / stretch, z);
      if (Math.hypot(x / stretch, z) <= radius * contour(polar, style)) lowX = x;
      else highX = x;
    }
    const edgeX = lowX;
    const circle = (cx, cz, r) =>
        Array.from({ length: 24 }, (_, k) => [
          cx + Math.cos((k / 24) * Math.PI * 2) * r,
          cz + Math.sin((k / 24) * Math.PI * 2) * r
        ]),
      pondSite = pickPondSite({
        contour,
        radius,
        stretch,
        style,
        legacy: { lip: { x: edgeX * 1.04, z: 7.5 }, flow: { x: 1, z: 0 } },
        blockers: [
          { polygon: shape.getPoints(12).map(p => [p.x, -p.y]), clearance: 0.6 },
          {
            polygon: Array.from({ length: 32 }, (_, k) => [
              Math.cos((k / 32) * Math.PI * 2) * (HALL.roof.rx + 0.07),
              HALL.roof.cz + Math.sin((k / 32) * Math.PI * 2) * (HALL.roof.rz + 0.07)
            ]),
            clearance: 0.5
          },
          ...(greenhouses.has(i)
            ? []
            : [
                { polygon: circle(...sites.description, 2.85), clearance: 0.3 },
                { polygon: circle(...sites.comments, 2.85), clearance: 0.3 }
              ])
        ],
        route: groundRoute
          .map(p => local({ x: p.x, y: base, z: p.z }))
          .filter(p => Math.hypot(p.x, p.z - 6.35) < 26)
          .map(p => [p.x, p.z]),
        // the arrival tree, the front fir and (outside style 1) the rear tree stay where they are; the rear spruce moves only if
        // no pond site clears it
        trunks: [[-7.1, 2.4], [-6.2, 0.5], ...(style % 3 !== 1 ? [[-5.7, 17.0]] : [])],
        mover: [-2.0, 19.0]
      }),
      spruceAt = pondSite.mover;
    pondSiteLog.push({ slot: i, ...pondSite });
    // Vegetation stays outside the clear route and pavilion entrance.
    const side = (dx, dz) => ({
      x: group.position.x + Math.cos(a) * dx + Math.sin(a) * dz,
      z: group.position.z - Math.sin(a) * dx + Math.cos(a) * dz
    });
    const planting = ISLAND_TREES[i % ISLAND_TREES.length];
    if (style % 3 !== 1) {
      const t = side(-5.7, 17.0),
        size = 0.58 + (style % 3) * 0.035;
      tree(t.x, t.z, size, false, base, planting[1]);
      treeBounds.push({ index: i, x: -5.7, z: 17.0, r: 3.2 * size });
    }
    // Two more lawn trees are placed after the plants settle (placeLawnTrees).
    lawnTreePlans.push({
      index: i,
      owner: i + 1,
      base,
      side,
      species: planting.slice(2),
      fixed: [[-7.1, 2.4], [-6.2, 0.5], [-5.7, 17.0], spruceAt]
    });
    const arrivalTree = side(-7.1, 2.4);
    tree(arrivalTree.x, arrivalTree.z, 0.64, false, base, planting[0]);
    treeBounds.push({ index: i, x: -7.1, z: 2.4, r: 2.05 });
    // The rear spruce stands all year (decorated in winter).
    const t2 = side(spruceAt[0], spruceAt[1]);
    pine(t2.x, t2.z, 0.7, base);
    speciesLog.push({ kind: 'spruce', x: +t2.x.toFixed(2), z: +t2.z.toFixed(2), size: 0.7, owner: i + 1 });
    // The fir beside the pavilion keeps clear lawn to the roof edge; at 7 cm it read as growing inside the exhibit.
    // It shares the arrival tree's lawn, so it is a winter-only Christmas tree.
    const frontFir = side(-6.2, 0.5);
    pine(frontFir.x, frontFir.z, 0.86, base, true, true);
    const roofGap = (dx, dz, r) => hallRoofGap(dx, dz) - r;
    pavilionGaps.push({
      index: i,
      gx: group.position.x,
      gz: group.position.z,
      a,
      frontFir: roofGap(-6.2, 0.5, SMALL_FIR.radius * 0.86 * 0.8),
      arrivalTree: roofGap(-7.1, 2.4, 2.05)
    });
    winterObjects.push(groundGlow({ x: frontFir.x, y: base + 0.29, z: frontFir.z }, 2.5, 2.5));
    for (const [j, [dx, dz]] of [
      [-7.0, 8.2],
      [7.9, 8.4],
      [-6.0, 12.5],
      [1.5, 20.0],
      [-6.8, -0.9],
      [-7.3, 4.4],
      [7.4, 2.4],
      [-7.2, 10.5],
      [1.2, 14.2],
      [7.4, 12.8]
    ].entries()) {
      const p = side(dx, dz),
        near = (ax, az, bx, bz) => {
          const vx = bx - ax,
            vz = bz - az,
            t = THREE.MathUtils.clamp(((dx - ax) * vx + (dz - az) * vz) / (vx * vx + vz * vz), 0, 1);
          return Math.hypot(dx - ax - t * vx, dz - az - t * vz);
        },
        gap = Math.min(near(4.4, -4.5, 4.4, 10.8), near(-4.6, 5.5, 4.4, 5.5));
      const size = Math.min(1.15 + random() * 0.18, (gap - 1.45) / 1.8);
      if (size > 0.55) plant(p.x, p.z, size, base, j % 3 === 0);
    }
    // Screenshots stay in the single pavilion. The other areas are along the island's rear path
    // (a greenhouse holds them inside).
    for (const [zone, x, z, rotation] of greenhouses.has(i)
      ? []
      : [
          ['description', ...sites.description, 0],
          ['comments', ...sites.comments, 0]
        ]) {
      const plinth = new THREE.CylinderGeometry(PLATFORM.top, PLATFORM.base, PLATFORM.height, 20),
        terrace = mesh(trimPlinth(plinth, outline, [x, z]), palette.path, group);
      terrace.position.set(x, 0.355, z);
      deckUV(terrace.geometry, x, z);
      floors.push(terrace);
      const stand = new THREE.Group();
      stand.position.set(x, 0, z);
      stand.rotation.y = rotation;
      stand.scale.set(0.86, 0.86, 0.86);
      group.add(stand);
      const backing = mesh(new THREE.BoxGeometry(4.03, 2.55, 0.14), palette.stone, stand);
      backing.position.set(0, 2.45, 0.08);
      blockers.push(backing);
      for (const sx of [-1.72, 1.72]) {
        const leg = mesh(new THREE.CylinderGeometry(0.09, 0.16, 1.3, 7), palette.stone, stand);
        leg.position.set(sx, 0.9, 0.1);
        blockers.push(leg);
      }
      const board = mesh(new THREE.PlaneGeometry(3.88, 2.43), zoneScreens.items.idle.material, stand);
      board.position.set(0, 2.45, -0.01);
      board.rotation.y = Math.PI;
      zoneBoards.push({ board, zone, index: i });
      pickable.push({ object: board, kind: 'zone', zone, index: i });
      for (const y of [1.19, 3.71]) {
        const trim = mesh(new THREE.BoxGeometry(4.07, 0.045, 0.04), palette.lampViolet, stand);
        trim.position.set(0, y, -0.05);
      }
      for (const sx of [-2.02, 2.02]) {
        const trim = mesh(new THREE.BoxGeometry(0.045, 2.55, 0.04), palette.lampBlue, stand);
        trim.position.set(sx, 2.45, -0.05);
      }
      groundGlow({ x: x - 1.0, y: 0.515, z: z - 1.05 }, 5.6, 5.4, group, '#ffb95e');
      // Attached low architectural lights illuminate the rear terraces without entering the paths.
      for (const side of [-1, 1]) {
        const lx = x + side * 2.18,
          lz = z - 0.45;
        // A smaller cast-iron standard with a warm post lantern (instanced like the others).
        group.updateMatrixWorld(true);
        const foot = group.localToWorld(new THREE.Vector3(lx, 0.48, lz)),
          glass = group.localToWorld(new THREE.Vector3(lx, 2.5, lz));
        batch('lampStandard', 'rail', foot, { x: 0.8, y: 0.8, z: 0.8 }, { y: group.rotation.y });
        lanternParts(glass, 0.8, group.rotation.y, LANTERN.tint.warm);
        practical({ x: lx, y: 2.45, z: lz }, group, 7.5, 1.12, 2, 0.48, 58);
        groundGlow({ x: lx, y: 0.515, z: lz - 0.6 }, 3.0, 3.5, group, '#ffbd6a');
      }
      const cueGeometry = new THREE.BoxGeometry(0.08, 1.05, 0.035),
        cueColor = new THREE.Color(project.accent);
      cueGeometry.setAttribute(
        'color',
        new THREE.Float32BufferAttribute(
          Array.from({ length: cueGeometry.attributes.position.count }, () => cueColor.toArray()).flat(),
          3
        )
      );
      for (const side of [-1, 1]) {
        const cue = mesh(cueGeometry, palette.brand, group);
        cue.position.set(x + side * 1.72, 1.17, z - 0.01);
      }
      for (const [dx, material] of [
        [-1.35, 'lampBlue'],
        [1.35, 'lampViolet']
      ]) {
        const arm = mesh(new THREE.BoxGeometry(0.08, 0.15, 0.48), palette.metal, group);
        arm.position.set(x + dx, 3.3, z - 0.1);
        const housing = mesh(new THREE.BoxGeometry(0.4, 0.13, 0.32), palette.metal, group);
        housing.position.set(x + dx, 3.26, z - 0.34);
        const lens = mesh(new THREE.BoxGeometry(0.29, 0.025, 0.25), palette[material], group);
        lens.position.set(x + dx, 3.18, z - 0.34);
        practical(
          { x: x + dx, y: 3.18, z: z - 0.34 },
          group,
          6.2,
          0.55,
          material === 'lampViolet' ? 1 : 0,
          0.48,
          34
        );
      }
    }
    // A single union-shaped surface: no coplanar T-junction or snow intersection.
    const deckGeometry = new THREE.ShapeGeometry(shape, 6);
    deckGeometry.rotateX(-Math.PI / 2);
    const uv = deckGeometry.attributes.uv,
      dp = deckGeometry.attributes.position;
    for (let v = 0; v < uv.count; v++) {
      const x = dp.getX(v),
        z = dp.getZ(v),
        w = side(x, z);
      dp.setY(v, 0.48);
      uv.setXY(v, w.x / 1.4, w.z / 1.4);
    }
    deckGeometry.computeVertexNormals();
    const sideDeck = mesh(deckGeometry, palette.path, group);
    floors.push(sideDeck);
    const waterPos = side(pondSite.x, pondSite.z);
    waterfall(waterPos.x, waterPos.z, base, a + pondSite.angle, 2.9, depth + 6, 2.7);
    // The left stone lantern keeps clear of the rear pillar's base (it sat 2 cm into it).
    for (const [dx, dz] of [
      [-4.15, 1.0],
      [7.1, 1.35]
    ]) {
      const p = side(dx, dz);
      batch('box', 'stone', { x: p.x, y: base + 0.48, z: p.z }, { x: 0.55, y: 0.48, z: 0.55 });
      lantern({ x: p.x, y: base + 1.05, z: p.z }, 'lampBlue', 1.1, a);
    }
    // A greenhouse has no hall roof edge to hang it from (its own garland comes with the decorations).
    if (!displayPrototype && !greenhouses.has(i)) {
      // Winter garland draped under the roof edge: swags sag between hooks round the bevel, round bulbs
      // on sockets in warm white and colours, the big tree's twinkle rolling along it (festive-garland.mjs).
      const { rx, rz, cz } = HALL.roof,
        garland = createGarland(THREE, roofSwags(THREE, { rx: rx + 0.07, rz: rz + 0.07, cz, y: 4.8 }), {
          ...GARLAND.pavilion,
          colours: GARLAND_COLOURS.pavilion
        });
      winterObjects.push(
        mesh(garland.bulbs, palette.firLights, group),
        mesh(garland.cord, palette.firWire, group)
      );
    }
    islandRandom = null;
    currentOwner = 0;
    yield;
  }

  yield;
  // Tall-islands preview only: water lifts and a zipline (sky-transit.mjs).
  const skyTransit =
    HEIGHT_PREVIEW > 1
      ? createSkyTransit(THREE, {
          route,
          mesh,
          line,
          batch,
          stone: palette.stone,
          resources,
          frames: islandFrames,
          pickable,
          labels
        })
      : null;
  yield;
  // Observatory and balloon station: one island high above the garden (sky-island.mjs); ?sky=off leaves it out.
  const skyIsland = SKY_ENABLED
    ? createSkyIsland(THREE, {
        island,
        mesh,
        line,
        batch,
        palette,
        resources,
        route,
        pickable,
        labels,
        camera: { x: 2.15, z: 2.65 }
      })
    : null;
  yield;
  scene.updateMatrixWorld(true);
  const bridgeLandings = [],
    bearingRay = new THREE.Raycaster();
  projects.forEach((_, i) => {
    const land = islandSurfaces.find(l => l.slot === i);
    if (!land) return;
    const supports = q => {
      bearingRay.set(new THREE.Vector3(q.x, land.y + 5, q.z), new THREE.Vector3(0, -1, 0));
      const hit = bearingRay.intersectObject(land.top, false)[0];
      return !!hit && Math.abs(hit.point.y - land.y - 0.2) < 0.03;
    };
    currentConnective = 'ring';
    // An open arc has no bridge before its first or after its last island.
    for (const direction of [-1, 1]) {
      if (!route.closed && (direction < 0 ? i === 0 : i >= route.segments)) continue;
      const p = findBridgeLanding(route, i, direction, supports);
      if (p === null) continue;
      // Overlap the underside by .10m while clearing the lower island side paths.
      const q = route.point(p),
        bottom = land.y - 0.72,
        top = q.y - 0.3;
      batch(
        'box',
        'stone',
        { x: q.x, y: (top + bottom) / 2, z: q.z },
        { x: 0.9, y: top - bottom, z: 5 },
        { y: route.angle(p) }
      );
      bridgeLandings.push({
        station: i,
        direction,
        progress: p,
        width: 5,
        depth: 0.9,
        top,
        bottom,
        ground: land.y + 0.2,
        supported: true
      });
    }
    currentConnective = null;
  });
  yield;
  // The radial bridge starts inside the tree island and ends inside the ring island.
  currentConnective = 'spoke';
  if (route.count)
    for (const [t, ground] of [
      [spokeStart / spokeEnd, 0.2],
      [(spokeEnd - 1.1) / spokeEnd, route.anchors[0].y - 0.06]
    ]) {
      const q = route.spoke(t),
        top = q.y - 0.075,
        bottom = ground - 0.8;
      batch(
        'box',
        'stone',
        { x: q.x, y: (top + bottom) / 2, z: q.z },
        { x: 4.4, y: top - bottom, z: 0.85 },
        { y: spokeAngle }
      );
    }
  currentConnective = null;
  yield;
  // Plants and stones (owner, round 3: flowers grew out of stones): the pond pass moves its stones first, so
  // every plant below is placed against the final boulders, kept 0.2 m from their boxes (no draw changes).
  clearPondsOfBoulders();
  const stoneRaw = [],
    stoneBoxes = [];
  {
    const unit = geometries.boulder,
      at = new THREE.Vector3(),
      turn = new THREE.Quaternion(),
      size = new THREE.Vector3();
    if (!unit.boundingBox) unit.computeBoundingBox();
    for (const matrix of buckets.get('boulder:boulder:false')?.transforms ?? []) {
      matrix.decompose(at, turn, size);
      if (size.x <= 0) continue;
      const raw = unit.boundingBox.clone().applyMatrix4(matrix);
      stoneRaw.push(raw);
      stoneBoxes.push(raw.clone().expandByScalar(0.2));
    }
  }
  const baseMaterial = material => material.userData.bridgeOf || material,
    hardSurfaces = floors
      .filter(
        o => baseMaterial(o.material) === palette.path || baseMaterial(o.material) === palette.bridgeDeck
      )
      .map(o => {
        const g = o.geometry,
          p = g.attributes.position,
          idx = g.index,
          triangles = [];
        for (let k = 0; k < (idx?.count || p.count); k += 3) {
          const [a, b, c] = [0, 1, 2].map(j =>
            new THREE.Vector3()
              .fromBufferAttribute(p, idx ? idx.getX(k + j) : k + j)
              .applyMatrix4(o.matrixWorld)
          );
          // With its ground-plane box, so a probe skips the triangles too far away to matter.
          triangles.push({
            a,
            b,
            c,
            x0: Math.min(a.x, b.x, c.x),
            x1: Math.max(a.x, b.x, c.x),
            z0: Math.min(a.z, b.z, c.z),
            z1: Math.max(a.z, b.z, c.z)
          });
        }
        return { box: new THREE.Box3().setFromObject(o), triangles };
      });
  const segmentDistance = (x, z, a, b) => {
    const dx = b.x - a.x,
      dz = b.z - a.z,
      t = THREE.MathUtils.clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1), 0, 1);
    return Math.hypot(x - a.x - t * dx, z - a.z - t * dz);
  };
  function hardDistance(p) {
    let min = Infinity;
    for (const surface of hardSurfaces) {
      if (
        p.base < surface.box.min.y - 1 ||
        p.base > surface.box.max.y + 1 ||
        p.x < surface.box.min.x - p.radius ||
        p.x > surface.box.max.x + p.radius ||
        p.z < surface.box.min.z - p.radius ||
        p.z > surface.box.max.z + p.radius
      )
        continue;
      // Round 5 (the ~1.4 s rebuild behind a reorder): a triangle whose box lies at least `min` away can neither
      // hold the point nor come closer, so it is skipped; the answer is the same as visiting them all.
      for (const { a, b, c, x0, x1, z0, z1 } of surface.triangles) {
        const bx = Math.max(x0 - p.x, 0, p.x - x1),
          bz = Math.max(z0 - p.z, 0, p.z - z1);
        if (bx * bx + bz * bz >= min * min) continue;
        const sab = (p.x - b.x) * (a.z - b.z) - (a.x - b.x) * (p.z - b.z),
          sbc = (p.x - c.x) * (b.z - c.z) - (b.x - c.x) * (p.z - c.z),
          sca = (p.x - a.x) * (c.z - a.z) - (c.x - a.x) * (p.z - a.z),
          area = (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
        if (Math.abs(area) > 1e-6 && !((sab < 0 || sbc < 0 || sca < 0) && (sab > 0 || sbc > 0 || sca > 0)))
          return 0;
        min = Math.min(
          min,
          segmentDistance(p.x, p.z, a, b),
          segmentDistance(p.x, p.z, b, c),
          segmentDistance(p.x, p.z, c, a)
        );
      }
    }
    return min;
  }
  function shoreDistance(p) {
    let min = Infinity;
    for (const w of waterZones) {
      if (Math.abs(p.base - w.base) > 1) continue;
      const dx = p.x - w.center.x,
        dz = p.z - w.center.z,
        across = dx * w.across.x + dz * w.across.z,
        along = dx * w.flow.x + dz * w.flow.z,
        ellipse = (Math.hypot(across / w.rx, along / w.rz) - 1) * Math.min(w.rx, w.rz),
        channel = segmentDistance(p.x, p.z, w.center, w.lip) - w.width;
      min = Math.min(min, ellipse, channel);
    }
    return min;
  }
  const centralPlants = [
    [-3.8, -2.0, 1.18],
    [-4.65, -2.45, 0.82],
    [-3.75, -3.25, 0.92],
    [-3.35, 2.35, 0.86],
    [-4.35, 2.65, 1.12],
    [-4.4, 1.45, 0.72]
  ];
  centralPlants.forEach(([x, z, scale], i) => {
    const p = plantPlans[8 + i * 6],
      candidate = { ...p, x, z, base: 0, scale, radius: 1.12 * scale, scenic: false, owner: 0 };
    if (hardDistance(candidate) >= candidate.radius && shoreDistance(candidate) >= candidate.radius)
      Object.assign(p, candidate);
  });
  yield;
  // Redistribute distant plants into mixed groups beside the existing arrival trees.
  // Candidate footprints pass concrete, shoreline, route and actual island-top masks.
  // Donors are scenic plants by origin, not by radius: a ten-island ring reaches past 70 m.
  const donors = plantPlans.filter(
    p => p.scenic && Math.hypot(p.x - teaser.center.x, p.z - teaser.center.z) > 18
  );
  const plantingRay = new THREE.Raycaster(),
    plantingDown = new THREE.Vector3(0, -1, 0);
  function groundedPlant(p) {
    const surfaces = islandSurfaces.filter(s => Math.abs(s.y - p.base) < 0.01).map(s => s.top);
    for (let j = -1; j < 12; j++) {
      const a = (j / 12) * Math.PI * 2,
        r = j < 0 ? 0 : p.rootRadius || p.radius;
      plantingRay.set(
        new THREE.Vector3(p.x + Math.sin(a) * r, p.base + 1, p.z + Math.cos(a) * r),
        plantingDown
      );
      if (
        !plantingRay
          .intersectObjects(surfaces, false)
          .some(hit => Math.abs(hit.point.y - p.base - 0.2) < 0.15)
      )
        return false;
    }
    return true;
  }
  // Low shielded garden standards, rooted on dry land rather than the basin.
  // Reuse box/cylinder batches. The warm underside remains warm in Neon too.
  const gardenLampAudit = [];
  // A garden lamp on the lake bank or by the side paths (world-lamps.mjs).
  const { gardenLamp } = createGardenLamp({
    fixtureBoxes,
    batch,
    fixtures,
    lanternParts,
    contour,
    hardDistance,
    shoreDistance,
    gardenLampAudit
  });
  const lampLands = islandSurfaces.filter(s => s.radius > 11 || (s.x === 0 && s.z === 0));
  for (const land of lampLands) {
    currentOwner = land.owner || 0;
    const water = waterZones.find(
      w =>
        Math.abs(w.base - land.y) < 0.001 &&
        Math.hypot(w.center.x - land.x, w.center.z - land.z) < land.radius * 1.5
    );
    if (!water) continue;
    for (const side of [-1, 1]) {
      let placed = false;
      for (const offset of [0, 0.55, -0.55, 1.05, -1.05])
        for (const inset of [0.7, 1.1, 1.5]) {
          if (placed) continue;
          const p = water.center
            .clone()
            .addScaledVector(water.across, side * (water.rx + inset))
            .addScaledVector(water.flow, offset);
          const probe = { x: p.x, z: p.z, base: land.y, radius: 0.43, rootRadius: 0.3 };
          if (
            hardDistance(probe) < 0.48 ||
            shoreDistance(probe) < 0.4 ||
            !groundedPlant(probe) ||
            !clearOfWalkway(p.x, p.z, 2.6)
          )
            continue;
          const aim = water.center.clone().sub(p).normalize();
          gardenLamp(land, p, { x: aim.x, z: aim.z }, 'lake bank');
          placed = true;
        }
    }
    const index = land.slot ?? null;
    // A greenhouse has no path to the old rear stands, so no lamp for it.
    if (index !== null && !greenhouses.has(index)) {
      const group = pavilionGroups[index];
      for (const [x, z] of [
        [2.5, 10.8],
        [2.45, 11.4],
        [2.3, 10.1]
      ]) {
        const p = group.localToWorld(new THREE.Vector3(x, 0, z)),
          probe = { x: p.x, z: p.z, base: land.y, radius: 0.43, rootRadius: 0.3 };
        if (hardDistance(probe) < 0.48 || shoreDistance(probe) < 0.4 || !groundedPlant(probe)) continue;
        const aim = group
          .localToWorld(new THREE.Vector3(4.4, 0, 10.0))
          .sub(p)
          .normalize();
        gardenLamp(land, p, { x: aim.x, z: aim.z }, 'description-comments path');
        break;
      }
    }
  }
  yield;
  currentOwner = 0;
  let donorIndex = 0;
  for (let i = 0; i < projects.length; i++) {
    const group = pavilionGroups[i],
      pattern = [
        [-6.05, -1.1, 1.22],
        [-7.05, 0.05, 1.05],
        [-5.95, 1.0, 0.86],
        [-6.85, 2.0, 1.03],
        [-6.25, 3.35, 0.83],
        [-5.25, 3.6, 0.94]
      ];
    for (const [j, [dx, dz, scale]] of pattern.entries()) {
      const point = group.localToWorld(new THREE.Vector3(dx, 0, dz)),
        source = donors[donorIndex++];
      if (!source) continue;
      const candidate = {
        ...source,
        x: point.x,
        z: point.z,
        base: group.position.y,
        scale,
        red: j % 3 === 2,
        radius: 1.12 * scale,
        relocated: true,
        groupIndex: i,
        groupSlot: j,
        groupStyle: styleOf(i),
        owner: i + 1,
        scenic: false
      };
      if (
        hardDistance(candidate) >= candidate.radius + 0.08 &&
        shoreDistance(candidate) >= candidate.radius + 0.08 &&
        clearOfWalkway(candidate.x, candidate.z, candidate.radius + 2.15) &&
        groundedPlant(candidate)
      )
        Object.assign(source, candidate);
    }
  }
  // Distance from a local point to the hall roof edge, scaled conservatively by the ellipse's short radius.
  function hallRoofGap(x, z) {
    const a = HALL.roof.rx + 0.07,
      b = HALL.roof.rz + 0.07;
    return (Math.hypot(x / a, (z - HALL.roof.cz) / b) - 1) * Math.min(a, b);
  }
  // Distance from a local point to the building on island `index`: the stone gallery's walls, a house's roof
  // outline (the East roofs reach a metre past the walls and past the hall's ellipse at their corners), else the
  // hall roof. 0 inside a rectangle.
  const outsideRect = (x, z, halfX, front, back) =>
    Math.hypot(Math.max(Math.abs(x) - halfX, 0), Math.max(front - z, z - back, 0));
  function buildingGap(index, x, z) {
    if (stoneGalleries.has(index)) return outsideRect(x, z, 3.135, -1.7, 12.345);
    const roof = greenhouseParts.get(index)?.roof;
    return roof ? outsideRect(x, z, roof.halfX, roof.front, roof.back) : hallRoofGap(x, z);
  }
  // Clear lawn from a planting's footprint to the nearest building's roof edge (local, conservative).
  function pavilionGap(p) {
    let min = Infinity;
    for (const { gx, gz, a, index } of pavilionGaps) {
      const X = p.x - gx,
        Z = p.z - gz,
        x = Math.cos(a) * X - Math.sin(a) * Z,
        z = Math.sin(a) * X + Math.cos(a) * Z;
      min = Math.min(min, buildingGap(index, x, z) - p.radius);
    }
    return min;
  }
  // Extra lawn trees per project island, after the plants settle: the first LAWN_TREE_SPOTS that clear
  // paving, water, walkways, fixtures, pavilion roofs (with lawn to spare), the fixed trees and the shrubs.
  // [size, crown radius m, height m] per species.
  const LAWN_TREE_FORM = {
    pine: [0.66, 1.6, 6.4],
    cypress: [0.62, 1.0, 5.6],
    oak: [0.6, 2.3, 4.6],
    birch: [0.62, 1.7, 5.4],
    maple: [0.6, 2.1, 4.6]
  };
  const FIXED_TREE_SPOTS = [
    [-7.1, 2.4],
    [-6.2, 0.5],
    [-5.7, 17.0],
    [-2.0, 19.0]
  ];
  function placeLawnTrees() {
    const previous = currentOwner;
    for (const plan of lawnTreePlans) {
      const placed = [];
      currentOwner = plan.owner;
      for (const species of plan.species) {
        const [size, R, H] = LAWN_TREE_FORM[species];
        for (const [dx, dz] of LAWN_TREE_SPOTS) {
          const { x, z } = plan.side(dx, dz),
            p = { x, z, base: plan.base, radius: R * 0.7, rootRadius: 0.6 },
            box = new THREE.Box3(
              new THREE.Vector3(x - R, plan.base, z - R),
              new THREE.Vector3(x + R, plan.base + H, z + R)
            );
          if (
            placed.some(q => Math.hypot(q[0] - dx, q[1] - dz) < q[2] + R + 1.2) ||
            (plan.fixed ?? FIXED_TREE_SPOTS).some(([fx, fz]) => Math.hypot(fx - dx, fz - dz) < R + 2.4) ||
            acceptedPlants.some(
              q => Math.abs(q.base - plan.base) < 0.1 && Math.hypot(q.x - x, q.z - z) < q.radius * 0.5 + 0.9
            ) ||
            hardDistance(p) < p.radius ||
            shoreDistance(p) < 1 ||
            !clearOfWalkway(x, z, 2.15 + R * 0.6) ||
            pavilionGap({ x, z, radius: R }) < 1 ||
            fixtureBoxes.some(f => f.intersectsBox(box)) ||
            !groundedPlant(p)
          )
            continue;
          placed.push([dx, dz, R]);
          tree(x, z, size, false, plan.base, species, true);
          treeBounds.push({ index: plan.index, x: dx, z: dz, r: R, species });
          break;
        }
      }
    }
    currentOwner = previous;
  }
  yield;
  for (const p of plantPlans) {
    const hard = hardDistance(p),
      shore = shoreDistance(p);
    if (hard < p.radius || shore < p.radius) {
      rejectedPlants.push({
        x: p.x,
        z: p.z,
        reason: hard < p.radius ? 'concrete' : 'shore',
        hard,
        shore,
        radius: p.radius
      });
      continue;
    }
    acceptedPlants.push({ ...p, hard, shore });
  }
  yield;
  // Redistribution must not increase the existing 146-plant rendering budget.
  while (acceptedPlants.length > 146) {
    let farthest = 0;
    for (let i = 1; i < acceptedPlants.length; i++)
      if (
        Math.hypot(acceptedPlants[i].x, acceptedPlants[i].z) >
        Math.hypot(acceptedPlants[farthest].x, acceptedPlants[farthest].z)
      )
        farthest = i;
    const [p] = acceptedPlants.splice(farthest, 1);
    rejectedPlants.push({ ...p, reason: 'budget' });
  }
  // Against the fixture and stone boxes near the part only (both lists are complete here; round 21: testing every
  // box took ~90 ms of each garden build).
  let fixturesNear = null,
    fixtureNear = null;
  const fixtureAt = box => {
    fixtureNear ??= boxIndex(fixtureBoxes, 0);
    return fixtureNear([box]).some(f => f.intersectsBox(box));
  };
  function plantFixtureHits(p) {
    fixturesNear ??= boxIndex([...fixtureBoxes, ...stoneBoxes], 0);
    return plantForm(p).parts.filter(part => {
      const geometry = geometries[part.kind];
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      const box = geometry.boundingBox.clone().applyMatrix4(formMatrix(THREE, part));
      return fixturesNear([box]).some(f => f.intersectsBox(box));
    }).length;
  }
  yield;
  // Small asymmetric shifts break the six-position stamp, while retaining all accepted donors.
  // Fall back to the original supported footprint when a shore or walkway restricts a shift.
  for (const p of acceptedPlants) {
    if (!p.relocated) continue;
    const group = pavilionGroups[p.groupIndex],
      slot = p.groupSlot,
      angle = p.groupStyle * 2.17 + slot * 1.73;
    const species = p.red
      ? 'flowers'
      : [
          ['cypress', 'broadleaf', 'shrub', 'cypress'],
          ['broadleaf', 'shrub', 'cypress', 'shrub'],
          ['shrub', 'cypress', 'broadleaf', 'broadleaf']
        ][p.groupStyle % 3][slot % 4];
    p.species = species;
    for (const fraction of [1, 0.65, 0.35, 0]) {
      const delta = new THREE.Vector3(
        Math.cos(angle) * 0.65 * fraction,
        0,
        Math.sin(angle) * 0.78 * fraction
      ).applyQuaternion(group.quaternion);
      const candidate = { ...p, x: p.x + delta.x, z: p.z + delta.z };
      if (
        hardDistance(candidate) >= p.radius + 0.08 &&
        shoreDistance(candidate) >= p.radius + 0.08 &&
        clearOfWalkway(candidate.x, candidate.z, p.radius + 2.15) &&
        !plantFixtureHits(candidate) &&
        groundedPlant(candidate)
      ) {
        Object.assign(p, candidate, {
          hard: hardDistance(candidate),
          shore: shoreDistance(candidate),
          shifted: fraction > 0
        });
        break;
      }
    }
    // A low compact form also clears fixtures if a taller variant would touch a lantern.
    if (plantFixtureHits(p)) {
      p.species = 'shrub';
    }
    yield;
  }
  yield;
  // Existing scenic plants also clear the complete fixture envelope, rather than
  // silently deleting individual leaves from an otherwise intersecting plant.
  for (const p of acceptedPlants) {
    if (!plantFixtureHits(p)) continue;
    let resolved = false;
    for (const distance of [0.45, 0.85, 1.25, 1.7, 2.2, 2.8, 3.5, 4.2]) {
      for (let j = 0; j < 12; j++) {
        const angle = (j / 12) * Math.PI * 2 + p.random[10],
          candidate = { ...p, x: p.x + Math.sin(angle) * distance, z: p.z + Math.cos(angle) * distance };
        if (
          hardDistance(candidate) >= p.radius + 0.08 &&
          shoreDistance(candidate) >= p.radius + 0.08 &&
          clearOfWalkway(candidate.x, candidate.z, p.radius + 2.15) &&
          !plantFixtureHits(candidate) &&
          groundedPlant(candidate)
        ) {
          Object.assign(p, candidate, {
            hard: hardDistance(candidate),
            shore: shoreDistance(candidate),
            fixtureShift: true
          });
          resolved = true;
          break;
        }
      }
      if (resolved) break;
    }
    yield;
  }
  yield;
  // Reuse a bounded set of distant plants for volumetric groups at real rims.
  // Roots stay on actual ground. Foliage may overhang dry rock; its full envelope
  // still clears concrete, water and fixtures, and never reaches the camera lane.
  const rimPlacementStarted = performance.now(),
    rimDonors = acceptedPlants.filter(
      p =>
        !p.relocated &&
        p.scenic &&
        Math.hypot(p.x - teaser.center.x, p.z - teaser.center.z) > 18 &&
        plantForm(p).species !== 'cypress'
    );
  const rimTargets = islandSurfaces.filter(s => s.radius > 11 || (s.x === 0 && s.z === 0));
  let rimDonor = 0;
  for (const [index, land] of rimTargets.entries()) {
    const central = land.x === 0 && land.z === 0,
      key = central ? 0 : 1 + styleOf(land.slot),
      heading = central
        ? 0.9
        : (key % 2 ? Math.PI / 2 + 0.29 : -Math.PI / 2 + 0.42) + Math.sin(key * 1.8) * 0.14;
    for (let j = 0; j < 3; j++) {
      const source = rimDonors[rimDonor];
      if (!source) break;
      const baseAngle = heading + (j - 1) * (0.17 + source.random[3] * 0.04),
        scale = [1.08, 0.84, 0.98][(j + key) % 3];
      let placed = false;
      for (const turn of [
        0, 0.16, -0.16, 0.29, -0.29, 0.42, -0.42, 0.55, -0.55, 0.7, -0.7, 0.9, -0.9, 1.2, -1.2
      ]) {
        const angle = baseAngle + turn;
        for (const fraction of [0.95, 0.92, 0.89, 0.86]) {
          const r = land.radius * contour(angle, land.profile) * fraction,
            lx = Math.sin(angle) * r * land.stretch,
            lz = (Math.cos(angle) * r) / land.stretch;
          const candidate = {
            ...source,
            x: land.x + Math.cos(land.rotation) * lx + Math.sin(land.rotation) * lz,
            z: land.z - Math.sin(land.rotation) * lx + Math.cos(land.rotation) * lz,
            base: land.y,
            scale,
            radius: 1.12 * scale,
            rootRadius: 0.4 * scale,
            species: 'rim',
            rim: true,
            rimIsland: index,
            owner: land.owner || 0,
            scenic: false
          };
          if (
            !acceptedPlants.some(
              p =>
                p.rim &&
                p.rimIsland === index &&
                Math.hypot(p.x - candidate.x, p.z - candidate.z) < 0.82 * Math.max(p.scale, candidate.scale)
            ) &&
            hardDistance(candidate) >= candidate.radius + 0.08 &&
            shoreDistance(candidate) >= candidate.radius + 0.08 &&
            clearOfWalkway(candidate.x, candidate.z, candidate.radius + 2.15) &&
            groundedPlant(candidate) &&
            !plantFixtureHits(candidate)
          ) {
            Object.assign(source, candidate, {
              hard: hardDistance(candidate),
              shore: shoreDistance(candidate)
            });
            rimDonor++;
            placed = true;
            break;
          }
        }
        if (placed) break;
      }
      if (!placed) continue;
    }
    yield;
  }
  const rimPlacementMs = performance.now() - rimPlacementStarted;

  yield;
  // Fill the broad inner lawns with three unequal existing distant plants.
  // Small groups leave open soil around them instead of isolated pairs. Rim groups,
  // arrival groups, cypresses and the 146-plant cap stay intact.
  const lawnPlacementStarted = performance.now(),
    lawnDonors = acceptedPlants.filter(
      p =>
        !p.relocated &&
        !p.rim &&
        p.scenic &&
        Math.hypot(p.x - teaser.center.x, p.z - teaser.center.z) > 18 &&
        plantForm(p).species !== 'cypress'
    );
  let lawnDonor = 0;
  for (let i = 0; i < projects.length; i++) {
    const group = pavilionGroups[i];
    const pattern = [
      [-0.3, 11.6, 1.32],
      [-0.05, 13.55, 1.05],
      [-1.0, 12.65, 0.91]
    ];
    for (const [j, [dx, dz, scale]] of pattern.entries()) {
      const source = lawnDonors[lawnDonor];
      if (!source) continue;
      const phase = styleOf(i) * 1.91 + j * 2.13;
      for (const drift of [0, 0.35, -0.35, 0.65]) {
        const point = group.localToWorld(
            new THREE.Vector3(
              dx + 0.28 * Math.sin(phase) + drift,
              0,
              dz + 0.32 * Math.cos(phase) + drift * 0.4
            )
          ),
          candidate = {
            ...source,
            x: point.x,
            z: point.z,
            base: group.position.y,
            scale,
            radius: 1.12 * scale,
            lawn: true,
            lawnIsland: i,
            owner: i + 1,
            scenic: false
          };
        const spacing = acceptedPlants.every(
          p =>
            p === source ||
            Math.abs(p.base - candidate.base) > 0.1 ||
            Math.hypot(p.x - candidate.x, p.z - candidate.z) > 0.72 * Math.max(p.scale, candidate.scale)
        );
        if (
          spacing &&
          hardDistance(candidate) >= candidate.radius + 0.12 &&
          shoreDistance(candidate) >= candidate.radius + 0.12 &&
          clearOfWalkway(candidate.x, candidate.z, candidate.radius + 2.15) &&
          groundedPlant(candidate) &&
          !plantFixtureHits(candidate)
        ) {
          Object.assign(source, candidate, {
            hard: hardDistance(candidate),
            shore: shoreDistance(candidate)
          });
          lawnDonor++;
          break;
        }
      }
    }
  }
  const lawnPlacementMs = performance.now() - lawnPlacementStarted;

  yield;
  // A fuller spray can touch a lantern even when its ground disk is clear.
  // Keep the whole plant and shrink its complete form together as a final guard.
  for (const p of acceptedPlants) {
    if (!plantFixtureHits(p)) continue;
    for (const ratio of [0.9, 0.8, 0.7, 0.6, 0.5]) {
      const candidate = { ...p, scale: p.scale * ratio };
      if (!plantFixtureHits(candidate)) {
        p.scale = candidate.scale;
        p.fixtureScale = ratio;
        break;
      }
    }
    yield;
  }
  yield;
  const plantBounds = p =>
    plantForm(p)
      .parts.filter(part => part.winter !== true)
      .map(part => {
        const g = geometries[part.kind];
        if (!g.boundingBox) g.computeBoundingBox();
        return g.boundingBox.clone().applyMatrix4(
          formMatrix(THREE, {
            ...part,
            scale: { x: part.scale.x * 1.05, y: part.scale.y * 1.05, z: part.scale.z * 1.05 }
          })
        );
      });
  const flowerPlants = acceptedPlants.filter(p => plantForm(p).parts.some(part => part.kind === 'flower'));
  const firClearance = separatePlants(
    flowerPlants,
    importedPine?.plantExclusionBounds?.() || [],
    plantBounds,
    p =>
      hardDistance(p) >= p.radius + 0.08 &&
      shoreDistance(p) >= p.radius + 0.08 &&
      clearOfWalkway(p.x, p.z, p.radius + 2.15) &&
      groundedPlant(p) &&
      !plantBounds(p).some(b => fixtureAt(b))
  );
  // Every plant clear of the stones: narrow rim strips have no room for a full root ring, so the stem's reach
  // (0.4 of the scale) must stand on the lawn; a plant left inside a stone is not planted.
  const stoneClearance = separatePlants(
    acceptedPlants,
    stoneBoxes,
    plantBounds,
    p =>
      hardDistance(p) >= p.radius + 0.08 &&
      shoreDistance(p) >= p.radius + 0.08 &&
      clearOfWalkway(p.x, p.z, p.radius + 2.15) &&
      groundedPlant({ ...p, rootRadius: 0.4 * p.scale }) &&
      !plantBounds(p).some(b => fixtureAt(b))
  );
  for (const u of stoneClearance.unresolved) {
    const k = acceptedPlants.findIndex(p => p.x === u.x && p.z === u.z);
    if (k < 0 || !envelopeIntersections(plantBounds(acceptedPlants[k]), stoneRaw, 0)) continue;
    const [p] = acceptedPlants.splice(k, 1);
    rejectedPlants.push({ x: p.x, z: p.z, reason: 'stone', radius: p.radius });
  }
  // Final positions keep clear lawn around every pavilion roof: 0.9 m for low plants and 2 m for tall
  // cypress columns, so nothing grows under the roof edge or stands in front of an exhibit.
  // A cypress first becomes a low shrub, then a plant steps outward; if no valid spot exists it is dropped.
  const pavilionClear = p => pavilionGap(p) >= (plantForm(p).species === 'cypress' ? 2 : 0.9);
  // A spot stepping out from the building (unit direction dx, dz) clear of the roof and of everything else:
  // straight out first, then turned up to ±70°, since a stone or a lamp may stand straight out (round the East
  // houses the hall's terraces are lawn, and their plants meet such things). Null if there is none.
  function stepAway(p, dx, dz) {
    for (const turn of [0, 0.6, -0.6, 1.2, -1.2]) {
      const ux = dx * Math.cos(turn) - dz * Math.sin(turn),
        uz = dx * Math.sin(turn) + dz * Math.cos(turn);
      for (const step of [0.4, 0.8, 1.2, 1.6, 2.1, 2.6]) {
        const candidate = { ...p, x: p.x + ux * step, z: p.z + uz * step };
        if (
          pavilionClear(candidate) &&
          hardDistance(candidate) >= p.radius + 0.08 &&
          shoreDistance(candidate) >= p.radius + 0.08 &&
          clearOfWalkway(candidate.x, candidate.z, p.radius + 2.15) &&
          !plantFixtureHits(candidate) &&
          groundedPlant(candidate)
        )
          return { ...candidate, pavilionShift: step };
      }
    }
    return null;
  }
  for (let k = acceptedPlants.length - 1; k >= 0; k--) {
    const p = acceptedPlants[k];
    if (pavilionClear(p)) continue;
    if (plantForm(p).species === 'cypress') {
      p.species = 'shrub';
      p.pavilionShrub = true;
      if (pavilionClear(p)) continue;
    }
    let nearest = null;
    for (const g of pavilionGaps)
      if (!nearest || Math.hypot(p.x - g.gx, p.z - g.gz) < Math.hypot(p.x - nearest.gx, p.z - nearest.gz))
        nearest = g;
    const away = Math.hypot(p.x - nearest.gx, p.z - nearest.gz) || 1,
      moved = stepAway(p, (p.x - nearest.gx) / away, (p.z - nearest.gz) / away);
    if (moved) Object.assign(p, moved);
    else {
      acceptedPlants.splice(k, 1);
      rejectedPlants.push({ x: p.x, z: p.z, reason: 'pavilion', gap: pavilionGap(p), radius: p.radius });
    }
  }
  for (const p of acceptedPlants) {
    p.hard = hardDistance(p);
    p.shore = shoreDistance(p);
  }
  // Small connected turf lips; preserve every plant and its original transform.
  for (const spec of ROOT_SUPPORTS) {
    const plant = acceptedPlants.find(
      p =>
        Math.abs(p.x - spec.x) < 1e-6 && Math.abs(p.z - spec.z) < 1e-6 && Math.abs(p.base - spec.base) < 1e-6
    );
    if (!plant) continue;
    const savedOwner = currentOwner,
      savedConnective = currentConnective;
    currentOwner = plant.owner;
    currentConnective = false;
    const top = mesh(terrainUV(rootSupportGeometry(THREE, spec)), palette.ground);
    top.name = 'connected-root-support';
    floors.push(top);
    const frost = snow(
      terrainUV(rootSupportGeometry(THREE, spec, 0.205, 0.235)),
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 1, z: 1 }
    );
    frost.name = 'connected-root-support-frost';
    currentOwner = savedOwner;
    currentConnective = savedConnective;
  }
  yield;
  acceptedPlants.forEach(emitPlant);
  placeLawnTrees();
  yield;
  // Plantings beside each pavilion, in its local metres: species and clear lawn to the roof edge.
  const pavilionAudit = () =>
    pavilionGaps.map(({ gx, gz, a, ...gap }) => ({
      ...gap,
      plants: acceptedPlants
        .map(p => {
          const X = p.x - gx,
            Z = p.z - gz,
            x = Math.cos(a) * X - Math.sin(a) * Z,
            z = Math.sin(a) * X + Math.cos(a) * Z;
          return {
            species: plantForm(p).species,
            x: +x.toFixed(2),
            z: +z.toFixed(2),
            gap: +((Math.hypot(x / 4.15, (z - 0.25) / 3.15) - 1) * 3.15 - p.radius).toFixed(2)
          };
        })
        .filter(q => q.gap < 3)
        .sort((q, r) => q.gap - r.gap)
    }));
  const vegetationAudit = () => ({
    firClearance,
    pavilionGaps: pavilionAudit(),
    planned: plantPlans.length,
    accepted: acceptedPlants.length,
    budget: 146,
    ordinaryGeometry: {
      alphaCards: geometries.treeCrown.userData.cards,
      newTextures: 5,
      fullSprayTriangles: geometries.treeCrown.index.count / 3,
      farSprayTriangles: geometries.treeCrownEconomy.index.count / 3,
      shrubTriangles: geometries.shrubCrown.index.count / 3
    },
    rejectedBudget: rejectedPlants.filter(p => p.reason === 'budget').length,
    rejectedConcrete: rejectedPlants.filter(p => p.reason === 'concrete').length,
    rejectedPavilion: rejectedPlants.filter(p => p.reason === 'pavilion').length,
    rejectedShore: rejectedPlants.filter(p => p.reason === 'shore').length,
    rejectedStone: rejectedPlants.filter(p => p.reason === 'stone').length,
    // Plants whose whole envelope reaches into a boulder's box (round 3: flowers grew out of stones).
    stoneShifted: stoneClearance.shifted.length,
    stoneOverlaps: acceptedPlants.filter(p => envelopeIntersections(plantBounds(p), stoneRaw, 0)).length,
    waterZones: waterZones.length,
    hardSurfaces: hardSurfaces.length,
    overlaps: acceptedPlants.filter(p => p.hard < p.radius || p.shore < p.radius).length,
    minimumHardMargin: Math.min(...acceptedPlants.map(p => p.hard - p.radius)),
    minimumShoreMargin: Math.min(...acceptedPlants.map(p => p.shore - p.radius)),
    rejected: rejectedPlants
  });

  // Bridge parts belong to the island at either end up to its landing; only the free
  // span between landings is hidden when bridges retract. Ring vertices find their
  // place on the route from their polar angle; spoke vertices from their radius.
  const footprint = land =>
    Array.from({ length: 26 }, (_, k) => {
      const a = (k / 26) * Math.PI * 2,
        r = land.radius * contour(a, land.profile),
        lx = Math.sin(a) * r * land.stretch,
        lz = (Math.cos(a) * r) / land.stretch;
      return {
        x: land.x + Math.cos(land.rotation) * lx + Math.sin(land.rotation) * lz,
        z: land.z - Math.sin(land.rotation) * lx + Math.cos(land.rotation) * lz
      };
    });
  const insidePolygon = (x, z, polygon) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i],
        b = polygon[j];
      if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
    }
    return inside;
  };
  const projectLands = projects.map((_, i) => islandSurfaces.find(l => l.slot === i)),
    centralLand = islandSurfaces.find(l => l.x === 0 && l.z === 0);
  const landPolygons = new Map(
    [...projectLands, centralLand].filter(Boolean).map(land => [land, footprint(land)])
  );
  const routeTable = [];
  if (route.segments) {
    let previous = null;
    for (let j = 0; j <= route.segments * 200; j++) {
      const p = j / 200,
        q = route.point(p);
      let angle = Math.atan2(q.x, q.z);
      if (previous !== null) {
        while (angle - previous > Math.PI) angle -= 2 * Math.PI;
        while (angle - previous < -Math.PI) angle += 2 * Math.PI;
      }
      previous = angle;
      routeTable.push({ p, angle });
    }
  }
  const spans = Array.from({ length: route.segments }, (_, i) => {
    const from = projectLands[i],
      to = projectLands[(i + 1) % route.count],
      inside = (land, p) => {
        const q = route.point(p);
        return insidePolygon(q.x, q.z, landPolygons.get(land));
      };
    let a = 0,
      b = 1;
    while (a < 0.5 && inside(from, i + a)) a += 0.005;
    while (b > 0.5 && inside(to, i + b)) b -= 0.005;
    return { from: a, to: b };
  });
  const spokeSpan = (() => {
    if (!route.count) return null;
    let a = 0,
      b = 1;
    const inside = (land, t) => {
      const q = route.spoke(t);
      return insidePolygon(q.x, q.z, landPolygons.get(land));
    };
    while (a < 0.5 && inside(centralLand, a + 0.005)) a += 0.005;
    while (b > 0.5 && inside(projectLands[0], b)) b -= 0.005;
    return { from: a, to: b };
  })();
  function routeProgressAt(x, z) {
    if (!routeTable.length) return 0;
    let angle = Math.atan2(x, z);
    const start = routeTable[0].angle;
    while (angle < start) angle += 2 * Math.PI;
    while (angle >= start + 2 * Math.PI) angle -= 2 * Math.PI;
    let lo = 0,
      hi = routeTable.length - 1;
    if (angle >= routeTable[hi].angle)
      return angle - routeTable[hi].angle < start + 2 * Math.PI - angle ? routeTable[hi].p : 0;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (routeTable[mid].angle <= angle) lo = mid;
      else hi = mid;
    }
    const t = (angle - routeTable[lo].angle) / (routeTable[hi].angle - routeTable[lo].angle || 1);
    return routeTable[lo].p + (routeTable[hi].p - routeTable[lo].p) * t;
  }
  function bridgePlace(x, z, kind) {
    if (kind === 'spoke') {
      const t = Math.hypot(x, z) / spokeEnd;
      return t <= spokeSpan.from
        ? { owner: 0, reveal: REVEAL_FIXED }
        : t >= spokeSpan.to
          ? { owner: 1, reveal: REVEAL_FIXED }
          : { owner: 0, reveal: spanReveal(t, spokeSpan.from, spokeSpan.to) };
    }
    const p = routeProgressAt(x, z),
      i = Math.min(route.segments - 1, Math.max(0, Math.floor(p))),
      u = p - i,
      span = spans[i];
    return u <= span.from
      ? { owner: i + 1, reveal: REVEAL_FIXED }
      : u >= span.to
        ? { owner: ((i + 1) % route.count) + 1, reveal: REVEAL_FIXED }
        : { owner: 0, reveal: spanReveal(u, span.from, span.to) };
  }
  yield;
  const ownerUniforms = createOwnerUniforms(THREE),
    ownedMeshes = [];
  // Shared base geometry plus this mesh's per-instance owner (and reveal) attributes.
  function setInstanceGeometry(object, base) {
    const cache = (object.userData.ownedGeometries ??= new Map());
    if (!cache.has(base)) {
      const geometry = ownedGeometry(THREE, base, object.userData.instanceAttributes);
      resources.add(geometry);
      cache.set(base, geometry);
    }
    object.geometry = cache.get(base);
  }
  function ownInstances(object, base, owners, reveals) {
    const count = owners.length,
      attributes = {
        gardenOwner: new THREE.InstancedBufferAttribute(Uint8Array.from(owners), 1, OWNER_NORMALIZED)
      };
    if (reveals)
      attributes.gardenRevealPoint = new THREE.InstancedBufferAttribute(
        Uint8Array.from(reveals),
        1,
        OWNER_NORMALIZED
      );
    for (const attribute of Object.values(attributes)) attribute.setUsage(THREE.DynamicDrawUsage);
    object.userData.instanceAttributes = attributes;
    object.userData.instanceOwners = count;
    setInstanceGeometry(object, base);
    ownedMeshes.push(object);
  }
  emitVines();
  flushWinterFirs();
  yield;
  // One draw call per shared geometry/material instead of hundreds of individual plants/planks.
  for (const [key, bucket] of buckets) {
    if (key.startsWith('leaf:') || key.startsWith('leafSnow:')) {
      bucket.geometry.computeBoundingBox();
      const kept = [],
        owners = [],
        reveals = [];
      bucket.transforms = bucket.transforms.filter((matrix, i) => {
        const box = bucket.geometry.boundingBox.clone().applyMatrix4(matrix),
          clear = !fixtureAt(box);
        if (clear) {
          kept.push(bucket.tints[i]);
          owners.push(bucket.owners[i]);
          reveals.push(bucket.reveals[i]);
        }
        return clear;
      });
      bucket.tints = kept;
      bucket.owners = owners;
      bucket.reveals = reveals;
    }
    if (bucket.connective)
      bucket.transforms.forEach((matrix, i) => {
        const place = bridgePlace(matrix.elements[12], matrix.elements[14], bucket.reveals[i]);
        bucket.owners[i] = place.owner;
        bucket.reveals[i] = place.reveal;
      });
    const instance = new THREE.InstancedMesh(bucket.geometry, bucket.material, bucket.transforms.length);
    // The bucket key (kind:material:winter), so a triangle can be traced back to what made it.
    instance.name ||= key;
    ownInstances(instance, bucket.geometry, bucket.owners, bucket.connective ? bucket.reveals : null);
    if (bucket.tints.some(Boolean)) {
      bucket.tints.forEach((tint, i) => instance.setColorAt(i, new THREE.Color(tint || '#ffffff')));
      instance.instanceColor.needsUpdate = true;
    }
    bucket.transforms.forEach((matrix, index) => instance.setMatrixAt(index, matrix));
    instance.instanceMatrix.needsUpdate = true;
    instance.computeBoundingSphere();
    scene.add(instance);
    resources.add(instance);
    // Curtains that follow a cliff: their strand offsets, one texture row per instance.
    if (bucket.extras.some(Boolean)) {
      const drape = createDrapeTexture(THREE, bucket.extras);
      resources.add(drape.texture);
      setVineDrape(bucket.material, drape);
      instance.userData.vineDrape = drape;
    }
    if (key.startsWith('treeCrown:leaves:') || key.startsWith('crownCentral:treeAtlas:')) {
      instance.userData.central = key.startsWith('crownCentral:');
      instance.userData.tints = bucket.tints.slice();
      foliageObjects.push(instance);
      foliageMatrices.set(
        instance,
        bucket.transforms.map(m => m.clone())
      );
    }
    if (key.startsWith('treeSnow:snow:')) treeSnowObjects.push(instance);
    if (key.startsWith('treeSprig:bark:') || key.startsWith('treeSprigCentral:bark:')) {
      instance.userData.central = bucket.winter === 'summer';
      sprigObjects.push(instance);
      foliageMatrices.set(
        instance,
        bucket.transforms.map(m => m.clone())
      );
    }
    if (/^fir(Needles|Wood):\w+:false$/.test(key)) seasonalFirs.push(instance);
    if (key.startsWith('flower:redLeaf:')) flowerObjects.push(instance);
    if (key.startsWith('shrubCrown:')) shrubObjects.push(instance);
    if (key.startsWith('vine:')) vineObjects.push(instance);
    if (key.startsWith('shrubSnow:')) shrubSnowObjects.push(instance);
    if (
      key.startsWith('treeCrown:') ||
      key.startsWith('shrubCrown:') ||
      key.startsWith('leaf:') ||
      key.startsWith('flower:') ||
      key.startsWith('wisteria:') ||
      key.startsWith('groundFern:')
    )
      deciduousObjects.push(instance);
    if (key.startsWith('treeCrown:leaves:') || key.startsWith('treeSnow:snow:')) {
      const snowy = key.startsWith('treeSnow:'),
        farGeometry = snowy ? geometries.treeSnowEconomy : geometries.treeCrownEconomy,
        far = new THREE.InstancedMesh(farGeometry, bucket.material, bucket.transforms.length);
      ownInstances(far, farGeometry, bucket.owners, null);
      far.count = 0;
      scene.add(far);
      resources.add(far);
      if (snowy) winterObjects.push(far);
      else deciduousObjects.push(far);
      const record = {
        near: instance,
        far,
        snowy,
        matrices: bucket.transforms.map(m => m.clone()),
        owners: bucket.owners.slice(),
        colors: []
      };
      ordinaryLods.push(record);
      instance.userData.ordinaryLod = record;
    }
    if (bucket.winter === 'summer') summerObjects.push(instance);
    else if (bucket.winter) winterObjects.push(instance);
    if (key.startsWith('box:path:')) floors.push(instance);
    // Decorative extras that the economy setting removes entirely.
    if (/^(vine|vineWeep|wisteria|groundFern|mote):/.test(key)) economyExtras.push(instance);
    if (key.startsWith('boulder:'))
      economyDetail.push(on => {
        setInstanceGeometry(instance, on ? geometries.boulderLow : geometries.boulder);
        instance.computeBoundingSphere();
      });
  }
  scene.updateMatrixWorld(true);
  yield;
  const obstacleShapes = [];
  const addShape = (geometry, matrix, label, prism = null) => {
    geometry.computeBoundingBox();
    const scale = new THREE.Vector3(),
      rotation = new THREE.Quaternion(),
      position = new THREE.Vector3();
    matrix.decompose(position, rotation, scale);
    const rigid = new THREE.Matrix4().compose(position, rotation, new THREE.Vector3(1, 1, 1));
    obstacleShapes.push({
      distance: prism ? point => prismDistance(point, prism, scale) : null,
      box: geometry.boundingBox
        .clone()
        .applyMatrix4(new THREE.Matrix4().makeScale(scale.x, scale.y, scale.z)),
      inverse: rigid.invert(),
      label
    });
  };
  blockers.forEach((object, i) =>
    addShape(object.geometry, object.matrixWorld, 'structure:' + i, object.userData.prismCollision)
  );
  const obstacleBoxes = blockers.map((object, index) => {
    const box = new THREE.Box3().setFromObject(object),
      shape = obstacleShapes[index];
    if (shape.distance)
      box.distanceToPoint = point => shape.distance(point.clone().applyMatrix4(shape.inverse));
    return box;
  });
  const solidMaterials = new Set([
    'bark',
    'leaves',
    'shrub',
    'redLeaf',
    'pine',
    'firNeedles',
    'snow',
    'stone',
    'metal',
    'rail',
    'dark'
  ]);
  for (const [key, bucket] of buckets) {
    if (!solidMaterials.has(key.split(':')[1])) continue;
    bucket.geometry.computeBoundingBox();
    for (const matrix of bucket.transforms) {
      obstacleBoxes.push(bucket.geometry.boundingBox.clone().applyMatrix4(matrix));
      addShape(bucket.geometry, matrix, key);
    }
  }
  // The stair treads are solid as the stone boxes they were.
  geometries.box.computeBoundingBox();
  for (const matrix of treadMatrices) {
    obstacleBoxes.push(geometries.box.boundingBox.clone().applyMatrix4(matrix));
    addShape(geometries.box, matrix, 'box:stone:false:bridge');
  }
  // One program per material. three keeps one program per material, and a material drawn both plainly and
  // instanced (a palette material of the baked architecture and of instance buckets), or instanced with and without
  // per-instance colours, had it re-chosen twice every frame (round 22, the frame profile: 7 materials). Instanced
  // draws of a tinted material all carry colours (white where untinted: the same pixels), and a baked mesh whose
  // material instance buckets also draw is baked as a single instance at the identity.
  const instancedMaterials = new Set(),
    tintedMaterials = new Set(),
    untinted = new THREE.Color(1, 1, 1);
  scene.traverse(object => {
    if (!object.isInstancedMesh) return;
    instancedMaterials.add(object.material);
    if (object.instanceColor) tintedMaterials.add(object.material);
  });
  scene.traverse(object => {
    if (!object.isInstancedMesh || object.instanceColor || !tintedMaterials.has(object.material)) return;
    for (let i = 0; i < object.instanceMatrix.count; i++) object.setColorAt(i, untinted);
    object.instanceColor.needsUpdate = true;
  });
  // Bake the stationary architecture by material. Picking meshes and audit sources keep their transforms.
  const frostSet = new Set(winterObjects),
    summerSet = new Set(summerObjects),
    pickingSet = new Set(pickable.map(item => item.object)),
    mergeBuckets = new Map();
  scene.traverse(object => {
    if (
      !object.isMesh ||
      object.isInstancedMesh ||
      object === sky ||
      object.userData.dynamic ||
      pickingSet.has(object) ||
      Array.isArray(object.material)
    )
      return;
    const key = object.material.uuid + ':' + frostSet.has(object) + ':' + summerSet.has(object);
    if (!mergeBuckets.has(key)) mergeBuckets.set(key, []);
    mergeBuckets.get(key).push(object);
  });
  yield;
  for (const objects of mergeBuckets.values()) {
    const prepared = objects.map(object => {
      const source = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
      plainLawnDepth(object, source);
      source.applyMatrix4(object.matrixWorld);
      for (const name of Object.keys(source.attributes))
        if (
          !['position', 'normal'].includes(name) &&
          !(name === 'color' && object.material.vertexColors) &&
          // Garland bulbs keep their twinkle phase (the tree's bulb material, or its bridge copy).
          !(
            name === 'twinkle' && (object.material.userData.bridgeOf || object.material) === palette.firLights
          ) &&
          !(name === 'uv' && object.material.map) &&
          !(['basinDepth', 'flowData', 'lakeData'].includes(name) && object.material === palette.water) &&
          !(name === 'terrainPoint' && object.material === palette.rock) &&
          !keepsTurfDepth(name, object)
        )
          source.deleteAttribute(name);
      const count = source.attributes.position.count,
        owners = new Uint8Array(count);
      if (object.userData.connective) {
        const reveals = new Uint8Array(count),
          p = source.attributes.position;
        for (let v = 0; v < count; v++) {
          const place = bridgePlace(p.getX(v), p.getZ(v), object.userData.connective);
          owners[v] = place.owner;
          reveals[v] = place.reveal;
        }
        source.setAttribute('gardenRevealPoint', new THREE.BufferAttribute(reveals, 1, OWNER_NORMALIZED));
      } else owners.fill(object.userData.owner || 0);
      source.setAttribute('gardenOwner', new THREE.BufferAttribute(owners, 1, OWNER_NORMALIZED));
      return source;
    });
    const moves = objects.some(object => object.userData.connective || object.userData.owner);
    const combined = mergeGeometries(prepared, false);
    // Where each source starts (first vertex) in the baked geometry, by the source's name: for audits and
    // debugging (scripts/zfight.mjs), so a baked triangle can be traced back to the object it came from.
    let first = 0;
    const sources = objects.map((object, i) => {
      const at = first;
      first += prepared[i].attributes.position.count;
      return [object.name || object.parent?.name || object.geometry.type, at];
    });
    prepared.forEach(g => g.dispose());
    if (!combined) continue;
    const material = objects[0].material,
      baked = instancedMaterials.has(material) ? bakedInstance(combined, material) : mesh(combined, material);
    baked.userData.sources = sources;
    baked.computeBoundingSphere?.();
    if (moves) ownedMeshes.push(baked);
    if (frostSet.has(objects[0])) winterObjects.push(baked);
    if (summerSet.has(objects[0])) summerObjects.push(baked);
    objects.forEach(object => object.removeFromParent());
    yield;
  }
  const fallMist = createFallMist(THREE, scene, resources, backdrop, waterSurfaces, waterTime);
  yield;
  function setSeason(season) {
    importedPine?.setSeason(season);
    ordinaryLodDirty = true;
    for (const lod of ordinaryLods) lod.near.count = lod.matrices.length;
    backdrop.setSnow?.(season === 'winter' ? 1 : 0);
    backdrop.setSeason?.(season);
    snowfall.setVisible(season === 'winter');
    const enabled = season === 'winter',
      autumn = season === 'autumn',
      spring = season === 'spring';
    winterObjects.forEach(object => (object.visible = enabled));
    summerObjects.forEach(object => (object.visible = !enabled));
    // Year-round spruces lead each fir bucket; the pavilion Christmas firs after them show in winter only.
    for (const fir of seasonalFirs) fir.count = enabled ? fir.userData.instanceOwners : yearRoundFirs;
    setDeciduousSeason(deciduousObjects, season);
    palette.leaves.color.set(0xffffff);
    for (const object of foliageObjects) {
      const matrices = foliageMatrices.get(object),
        scale = crownScale(season, object.userData.central);
      for (let i = 0; i < object.count; i++) {
        const tint = object.userData.tints?.[i],
          // Untinted ordinary crowns are oaks: russet brown in autumn (the central tree keeps its gold).
          oak = !tint && !object.userData.central;
        object.setColorAt(i, new THREE.Color(leafColour(season, tint, oak, i)));
        object.setMatrixAt(i, matrices[i].clone().scale(new THREE.Vector3(scale, scale, scale)));
      }
      object.instanceColor.needsUpdate = true;
      object.instanceMatrix.needsUpdate = true;
      object.computeBoundingSphere();
    }
    palette.shrub.color.set(enabled ? 0x73879b : spring ? 0x779477 : autumn ? 0x84794b : 0x5f8157);
    palette.pine.color.set(enabled ? 0x505e74 : autumn ? 0x62775d : 0x507862);
    // Winter needles keep a cool green under the painted snow so the two read apart.
    palette.needles.color.set(enabled ? 0x8aa596 : autumn ? 0xa9b48e : 0xa6c296);
    // Pine and cypress keep their tinted green all year; only winter cools it under the snow.
    palette.treeAtlas.color.set(enabled ? 0xd2dcd8 : 0xffffff);
    winterSnow.value = enabled ? 1 : 0;
    setVineSeason(palette.vine, season);
    palette.shrubFoliage.color.set(enabled ? 0x9aa7b8 : spring ? 0xb7d29e : autumn ? 0xc9a46a : 0x9fbf85);
    palette.redLeaf.color.set(0xffffff);
    for (const object of flowerObjects) {
      for (let i = 0; i < object.count; i++) object.setColorAt(i, new THREE.Color(flowerColour(season, i)));
      object.instanceColor.needsUpdate = true;
    }
    for (const object of sprigObjects) {
      const matrices = foliageMatrices.get(object),
        scale = sprigScale(season, object.userData.central);
      for (let i = 0; i < object.count; i++)
        object.setMatrixAt(i, matrices[i].clone().scale(new THREE.Vector3(scale, scale, scale)));
      object.instanceMatrix.needsUpdate = true;
      object.computeBoundingSphere();
    }
    for (const lod of ordinaryLods) {
      for (let i = 0; i < lod.matrices.length; i++) {
        if (!lod.snowy) lod.near.getMatrixAt(i, lod.matrices[i]);
        if (!lod.snowy) {
          const color = new THREE.Color();
          lod.near.getColorAt(i, color);
          lod.colors[i] = color;
        }
      }
    }
    palette.ground.color.set(enabled ? 0x9fa8bb : spring ? 0x8ba28a : autumn ? 0x96917b : 0x87a279);
    palette.path.color.set(enabled ? 0xc2c5d2 : 0xb7b0c2);
    setCliffSeason(season);
    setBoulderSeason(season);
    for (const object of economyExtras) object.userData.seasonVisible = object.visible;
    applyEconomyExtras();
  }
  // Economy hides vines, wisteria, underplanting and canopy motes; season visibility returns with full quality.
  function applyEconomyExtras() {
    for (const object of economyExtras)
      object.visible = !ordinaryLodEconomy && object.userData.seasonVisible !== false;
  }
  yield;
  // Partition shared sprays only after a 2m camera move or a settings change.
  // Far crowns retain every leaflet and the same wood with simpler folded outlines.
  const partitionOrdinaryFoliage = createFoliagePartition(THREE);
  function updateOrdinaryLods(camera) {
    if (!ordinaryLodDirty && ordinaryLodCamera.distanceToSquared(camera.position) < 4) return;
    ordinaryLodCamera.copy(camera.position);
    ordinaryLodDirty = false;
    partitionOrdinaryFoliage(ordinaryLods, camera.position, ordinaryLodEconomy);
  }
  function setWinter(enabled) {
    setSeason(enabled ? 'winter' : 'summer');
  }
  // Where a project's screens and boards are, in the world and on the page (world-screens.mjs).
  const { screenTarget, screenBounds } = createScreenLocator({ projects, route, zoneBoards, mainScreens });
  yield;
  // Doors open as the camera comes near; a hall's pictures load the first time the camera gets close.
  const hallDoor = new THREE.Vector3(),
    NAME_NEAR = 16,
    // Distance to the door (m, height counted half) where the doorway plaque and noren are gone and fully back.
    DOORWAY_FADE = [0.9, 2.6];
  // The halls as the camera moves: doors, names, pictures and the doorway fade (world-halls.mjs).
  const { updateHalls, hallExit } = createHallMotion({ halls, hallDoor, NAME_NEAR, DOORWAY_FADE });
  const slotOf = index => ((Math.round(index) % projects.length) + projects.length) % projects.length;
  const isGreenhouse = index => projects.length > 0 && greenhouses.has(slotOf(index));
  // The building a walk-in project stands in: temple, dojo, pavilion or glasshouse (null for a station).
  const houseStyle = index =>
    isGreenhouse(index) ? greenhouseParts.get(slotOf(index))?.style || null : null;
  // Where the camera stands for a project's sections and how it gets there (world-zones.mjs).
  const { zonePose, zoneCurve } = createZonePaths({
    route,
    pavilionGroups,
    platformSites,
    greenhouseParts,
    slotOf,
    isGreenhouse
  });
  function setZoneContent(index, zone, title, body, image, activeZone = zone) {
    engineeringDisplays.forEach((display, i) => display.setActive(i === index, activeZone));
    zoneBoards.forEach(item => {
      // A greenhouse's cork board keeps its own pinned notes (pinNotes).
      if (item.own) return;
      item.board.material =
        item.index === index ? zoneScreens.items[item.zone].material : zoneScreens.items.idle.material;
    });
    mainScreens.forEach((item, i) => {
      item.material.map =
        i === index && zone === 'gallery' ? zoneScreens.items.gallery.texture : item.texture;
    });
    if (zone === 'gallery') zoneScreens.image(title, image);
    else zoneScreens.draw(zone, title, body);
    // Loading, empty and failed states show as one line on the cork board until the notes arrive.
    if (zone === 'comments') greenhouseParts.get(index)?.pinNotes(title, body);
  }
  // Pins the latest comments ({ name, body }) as notes on a greenhouse's board; other islands ignore it.
  function pinNotes(index, comments) {
    greenhouseParts.get(index)?.pinNotes(labels.zoneComments || 'Comments', comments.slice(0, 6));
  }
  // Allocation-free (camera2, M18): flights and audits call this hundreds of times; the nearest thing is
  // described only when asked for.
  const clearanceLine = new THREE.Line3(),
    clearancePoint = new THREE.Vector3();
  // How close the camera (or a standing visitor's body) comes to solid things (world-clearance.mjs).
  const { bodyClearance, pointClearance } = createClearance({
    railSegments,
    obstacleShapes,
    obstacleBoxes,
    clearanceLine,
    clearancePoint
  });
  function setLightStyle(style, night) {
    lightStyle = style === 'neon' ? 'neon' : 'natural';
    nightStrength = night;
    const neon = lightStyle === 'neon';
    // Neon is cyan and magenta, far enough apart to read as two colours at a glance.
    palette.lampBlue.color.set(neon ? '#3fe3ff' : '#ffe0b2');
    palette.lampViolet.color.set(neon ? '#ff5fd6' : '#ffca92');
    glowMaterial.opacity = neon ? 0.48 : 0.055;
    // Lantern glass: frosted by day, a hot core and a soft halo after dusk.
    lanternLook.setNight(night);
    xmasTree?.setNight(night);
    practicalField?.set(lightStyle, night, practicalLevel);
    // The boards inside the houses take the same look as the project card (zone-screens.mjs BOARD_LOOKS).
    zoneScreens.setStyle(lightStyle);
    if (eastMaterials) eastMaterials.neonCyan.visible = eastMaterials.neonMagenta.visible = neon;
    // The house bulbs: warm in Natural, a pale violet white in Neon.
    hallLight?.color.set(neon ? '#e2d6ff' : '#ffd8a8');
    for (const house of greenhouseParts.values()) house.setStyle?.(lightStyle);
    // Deck-edge neon stays cool in both styles; Natural keeps it faint by day and lets it glow at dusk.
    const edge = neon ? 1 : 0.38 + 0.62 * Math.min(1, night);
    palette.bridgeNeonBlue.color.set(neon ? 0x38e1ff : 0x6fb6ff).multiplyScalar(edge);
    palette.bridgeNeonViolet.color.set(neon ? 0xd46bff : 0xa487ff).multiplyScalar(edge);
  }
  // Transitions fade baked pools and real lights; islands are leaving the spots they were baked for.
  function setPracticalLevel(level) {
    practicalLevel = level;
    practicalField?.set(lightStyle, nightStrength, level);
  }
  // The colour of a fixture's real light: warm in Natural; in Neon cool blue and violet, the house lamps a soft
  // cyan and violet in turn (their baked pool stays warm underneath).
  function lightColour(f) {
    if (lightStyle !== 'neon') return f.channel === 1 ? '#ffca92' : '#ffe0b2';
    if (f.hall !== undefined) return f.hall % 2 ? '#d88cff' : '#7fe6ff';
    return f.channel === 1 ? '#a487ff' : f.channel === 2 ? '#ffd4a0' : '#69bdff';
  }
  function updateLocalLights(progress, mode, zone = 'main', position) {
    const eye = position || V(route.point(progress, 0, 3.3));
    const lights = [localBlue, localViolet, portalLight, ...ultraLamps.filter(light => light.visible)],
      chosen = weightedFixtures(fixtures, eye, lightEconomy ? 2 : lights.length);
    lightSelection = chosen;
    lights.forEach((light, i) => {
      const entry = chosen[i];
      if (!entry) {
        light.intensity = 0;
        return;
      }
      const { fixture: f, weight } = entry;
      light.position.set(f.x, f.y, f.z);
      light.color.set(lightColour(f));
      // Ultra lets the real lights carry more of each lamp than the baked pool, so they shape what stands near them.
      light.intensity =
        REAL_LIGHT_SHARE *
        (ultraLamps[0].visible ? ULTRA_LAMP_SHARE : 1) *
        weight *
        f.power *
        (0.025 + nightStrength * 0.975) *
        practicalLevel;
      light.distance = f.radius * 1.65;
    });
  }
  // medium: the medium graphics' lighter models (ignored with the economy, which has its own).
  function setEconomy(enabled, medium = false) {
    mediumDetail = !enabled && !!medium;
    cloudSea.setEconomy(enabled);
    snowfall.setEconomy(enabled);
    ordinaryLodEconomy = enabled;
    ordinaryLodDirty = true;
    importedPine?.setEconomy?.(enabled);
    // Owner's Realme 11 Pro+, 2026-10-31: the three local lights cost about 1.9 ms a frame at medium; it keeps two.
    lightEconomy = enabled || mediumDetail;
    localViolet.visible = true;
    portalLight.visible = !lightEconomy;
    xmasTree?.setEconomy(enabled);
    backdrop.setEconomy(enabled, enabled || mediumDetail);
    fallMist.setEconomy(enabled);
    waterAppearance.setEconomy(enabled);
    for (const object of foliageObjects) {
      const central = object.userData.central,
        economyCrown = central ? geometries.crownCentralEconomy : geometries.treeCrownEconomy,
        fullCrown = central ? geometries.crownCentral : geometries.treeCrown;
      setInstanceGeometry(object, enabled ? economyCrown : fullCrown);
      object.computeBoundingSphere();
    }
    for (const object of treeSnowObjects) {
      setInstanceGeometry(object, enabled ? geometries.treeSnowEconomy : geometries.treeSnow);
      object.computeBoundingSphere();
    }
    for (const object of shrubObjects) {
      setInstanceGeometry(
        object,
        enabled
          ? geometries.shrubCrownEconomy
          : mediumDetail
            ? geometries.shrubCrownMedium
            : geometries.shrubCrown
      );
      object.computeBoundingSphere();
    }
    // The economy hides the curtains (applyEconomyExtras); medium hangs the lite ones.
    for (const object of vineObjects) {
      setInstanceGeometry(object, mediumDetail ? geometries.vineLite : geometries.vine);
      object.computeBoundingSphere();
    }
    for (const object of shrubSnowObjects) {
      setInstanceGeometry(object, enabled ? geometries.shrubSnowEconomy : geometries.shrubSnow);
      object.computeBoundingSphere();
    }
    applyEconomyExtras();
    economyDetail.forEach(apply => apply(enabled));
  }
  // Ultra graphics (owner, 2026-10-31): the key light, the sun's side, casts shadows over the garden. Opaque lit
  // surfaces cast and take them; a vine curtain is laid along its cliff by its own shader, so it only takes them.
  // Leaves cast but take none: a crown shading itself went dull brown at sunset, where its lit cards carried the glow.
  // Islands that fly in a filter or sort carry their owner matrices into the shadow pass as well (a depth material
  // with the same patch), so a shadow never stays behind. The shadow box covers the route islands with a margin.
  const shadowDepth = new Map(),
    shadowReach = Math.max(40, Math.max(...route.anchors.map(p => Math.hypot(p.x, p.z))) + 20);
  let shadowsOn = false;
  function shadowDepthFor(material) {
    if (!shadowDepth.has(material)) {
      const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
      patchOwnerMaterial(depth, ownerUniforms, { reveal: material.userData.gardenPatch === 'reveal' });
      resources.add(depth);
      shadowDepth.set(material, depth);
    }
    return shadowDepth.get(material);
  }
  function setShadows(enabled) {
    shadowsOn = !!enabled;
    key.castShadow = shadowsOn;
    if (shadowsOn) {
      const box = key.shadow.camera;
      box.left = box.bottom = -shadowReach;
      box.right = box.top = shadowReach;
      box.near = 1;
      box.far = 160 + shadowReach;
      box.updateProjectionMatrix();
      key.shadow.mapSize.set(4096, 4096);
      key.shadow.bias = -0.0004;
      key.shadow.normalBias = 0.03;
      // A little of the light stays in the shade, so a shadow reads as shade, not as a hole.
      key.shadow.intensity = 0.85;
    }
    scene.traverse(object => {
      if (!object.isMesh || Array.isArray(object.material)) return;
      const m = object.material,
        lit = m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial;
      object.receiveShadow = shadowsOn && lit && !m.userData.foliageUniforms;
      object.castShadow =
        shadowsOn && lit && !m.transparent && !vineObjects.includes(object) && !/^vine/.test(object.name);
      if (object.castShadow && object.geometry.attributes.gardenOwner)
        object.customDepthMaterial = shadowDepthFor(m);
    });
  }
  function focusProject(index) {
    engineeringDisplays.forEach((display, i) => display.setActive(i === index, 'main'));
    mainScreens.forEach((entry, i) => entry.texture.userData.setFocused?.(i === index));
  }
  yield;
  // Up to nine islands (and the default garden) keep the established 64 m field.
  const fieldExtent = route.radius > 28.8 ? Math.ceil(projectReach + 6) : 64,
    practicalMaterials = [
      'ground',
      'path',
      'bridgeDeck',
      'stairRiser',
      'stone',
      'roof',
      'metal',
      'bark',
      'leaves',
      'shrub',
      'shrubFoliage',
      'indoorFoliage',
      'needles',
      'treeAtlas',
      'vine',
      'redLeaf',
      'pine',
      'snow',
      'dark',
      'rail',
      'boulder'
    ].map(key => palette[key]);
  yield;
  practicalField = createPracticalLighting(
    THREE,
    fixtures,
    // Each material once: the houses share their East shell materials, and a hook patched twice breaks the shader.
    [
      ...new Set(
        practicalMaterials
          .concat([...greenhouseParts.values()].flatMap(house => house.practicalMaterials || []))
          .concat(practicalMaterials.map(material => bridgeMaterials.get(material)).filter(Boolean))
          .concat(importedPine ? pineAsset.materials || [pineAsset.material] : [])
      )
    ],
    resources,
    { extent: fieldExtent }
  );
  // Patched after the light field so every existing shader hook chains underneath.
  const patchedMaterials = new Set();
  yield;
  scene.traverse(object => {
    if (!object.isMesh || !object.geometry.attributes.gardenOwner || patchedMaterials.has(object.material))
      return;
    patchedMaterials.add(object.material);
    patchOwnerMaterial(object.material, ownerUniforms, { reveal: !!object.material.userData.bridgeOf });
  });
  pavilionGroups.forEach(group => {
    group.updateMatrix();
    group.userData.baseMatrix = group.matrix.clone();
  });
  function setOwner(owner, matrix) {
    // Only movable worlds carry owner attributes; pavilions must not move without their islands.
    if (!movable || !(owner >= 1 && owner < MAX_OWNERS)) return;
    ownerUniforms.gardenOwners.value[owner].copy(matrix);
    const group = pavilionGroups[owner - 1];
    if (group) {
      group.matrixAutoUpdate = false;
      group.matrix.multiplyMatrices(matrix, group.userData.baseMatrix);
      group.matrixWorldNeedsUpdate = true;
    }
  }
  function resetOwners() {
    for (let owner = 1; owner < MAX_OWNERS; owner++) ownerUniforms.gardenOwners.value[owner].identity();
    pavilionGroups.forEach(group => {
      group.matrix.copy(group.userData.baseMatrix);
      group.matrixAutoUpdate = true;
      group.matrixWorldNeedsUpdate = true;
    });
    ownerUniforms.gardenReveal.value = 1;
  }
  function setTransitionActive(active) {
    for (const object of ownedMeshes) object.frustumCulled = !active;
    fallMist.mesh.visible = !active;
    const walker = scene.getObjectByName('garden-visitor');
    if (walker) walker.visible = !active && route.segments > 0;
  }
  // options.prepare: shaders of the walkers are made as soon as their model arrives (they are hidden while islands
  // move, and at the end of a rearrangement they used to compile in the frame they appeared).
  const visitor = createVisitor(scene, route, onChange, options.prepare);
  yield;
  // Where each fall starts and which way it pours: the nature sounds (garden.mjs) and close-up captures.
  const fallPoses = () =>
    waterSurfaces.map(w => ({
      lip: w.lip.toArray(),
      flow: w.flow.toArray(),
      across: w.across.toArray(),
      base: w.base,
      height: w.height,
      width: w.width
    }));
  const waterMeshes = scene.children.filter(o => o.material === palette.water),
    flowAttributesPreserved = waterMeshes.every(
      o => o.geometry.attributes.flowData?.count === o.geometry.attributes.position.count
    ),
    lakeAttributesPreserved = waterMeshes.every(
      o => o.geometry.attributes.lakeData?.count === o.geometry.attributes.position.count
    );
  const waterEffectsStatus = () => ({
    time: waterTime.value,
    mistInstances: fallMist.count,
    sprayDrops: fallMist.sprayCount,
    flowAttributesPreserved,
    lakeAttributesPreserved
  });
  function dispose() {
    disposed = true;
    visitor.dispose();
    resources.forEach(resource => resource.dispose?.());
  }
  // The audits (tests and window.__gardenDebug only) measure the finished build (world-audits.mjs).
  const { snowAudit, sectionAudit, routeAudit, geometryAudit, groundingAudit, waterSurfaceAudit } =
    createWorldAudits({
      projects,
      scene,
      palette,
      geometries,
      winterObjects,
      waterZones,
      waterSurfaces,
      route,
      zonePose,
      zoneCurve,
      bodyClearance,
      floors,
      pointClearance,
      edgeOffset,
      railIslands,
      railSpans,
      waterStairs,
      bridgeEdges,
      bridgeWidth,
      bridgeLandings,
      obstacleBoxes,
      obstacleShapes,
      treeBounds,
      islandSurfaces,
      acceptedPlants,
      plantFixtureHits,
      rimPlacementMs,
      lawnPlacementMs,
      lawnDonors,
      lawnDonor
    });
  return {
    updateTrees: camera => {
      importedPine?.update?.(camera);
      updateOrdinaryLods(camera);
    },
    treeAudit: () => ({
      ...(importedPine?.audit() || { variant: 'original' }),
      firClearance,
      ordinary: ordinaryLods.map(lod => ({
        snow: lod.snowy,
        visible: lod.near.visible,
        near: lod.near.count,
        far: lod.far.count,
        total: lod.matrices.length
      })),
      deciduous: {
        visibleGroups: deciduousObjects.filter(o => o.visible).length,
        totalGroups: deciduousObjects.length,
        visibleFlowers: flowerObjects.filter(o => o.visible).reduce((n, o) => n + o.count, 0)
      }
    }),
    displayAudit: () => ({
      prototype: displayPrototype,
      exhibits: displayAudits.map(({ screenBack, interactions, setActive, update, ...record }) => record)
    }),
    scene,
    route,
    teaser,
    visitor,
    portalGeometry,
    vegetationAudit,
    // Every planted tree's species and place, plus the fir split (year-round spruces vs winter-only firs).
    speciesAudit: () => ({
      trees: speciesLog,
      lawnTrees: treeBounds.filter(t => t.species),
      yearRoundFirs,
      winterOnlyFirs: winterOnlyFirs.length
    }),
    groundingAudit,
    waterSurfaceAudit,
    fallPoses,
    pondStones: pondStoneList,
    waterEffectsStatus,
    snowAudit,
    sky,
    skyMaterial,
    backdrop,
    ambient,
    key,
    fill,
    palette,
    ribbonMaterial,
    pickable,
    screenTarget,
    zonePose,
    updateHalls,
    hallExit,
    halls,
    // Greenhouse gallery islands (greenhouse.mjs) and the comment notes pinned in them.
    greenhouses: [...greenhouses],
    // Which building every project island got and why (building-variants.mjs).
    buildings: buildingPlan,
    isGreenhouse,
    houseStyle,
    pinNotes,
    // Per project index, in the pavilion's own frame (project-birthdays.mjs decorates a birthday pavilion).
    pavilionGroups,
    // Light through leaves, set by lighting() from the sun (realistic-foliage.mjs).
    foliageDaylight,
    // Where each project island puts its pond and fall, in the pavilion frame (pond-site.mjs).
    pondSites: pondSiteLog,
    zoneCurve,
    setZoneContent,
    setWinter,
    setSeason,
    setEconomy,
    setShadows,
    shadowsOn: () => shadowsOn,
    // Ultra: the three extra lamp lights on or off (a level change remakes the lit programs once).
    setUltraLamps: on => ultraLamps.forEach(light => (light.visible = !!on)),
    // Ultra: the cube map the pools mirror (ultra-effects.mjs), or null for the painted sky.
    setWaterReflection: texture => waterAppearance.setReflection(texture),
    setLightStyle,
    fixtureAudit: () => fixtures.map(f => ({ ...f, boundary: undefined })),
    practicalAudit: () => ({
      ...practicalField.audit(),
      gardenLamps: gardenLampAudit,
      selection: lightSelection.map(({ fixture, weight }) => ({ index: fixtures.indexOf(fixture), weight })),
      budget: lightEconomy ? 2 : 3
    }),
    updateLocalLights,
    routeAudit,
    geometryAudit,
    mediaStatus,
    focusProject,
    screenBounds,
    flowOffset: () => flowTexture.offset.y,
    lightStatus: () =>
      [localBlue, localViolet, portalLight].map(l => ({
        color: '#' + l.color.getHexString(),
        visible: l.visible,
        intensity: l.intensity,
        position: l.position.toArray(),
        distance: l.distance
      })),
    pointClearance,
    // The same solid things for the overview camera's clearance grid (camera-clearance.mjs).
    obstacleField: { boxes: obstacleBoxes, rails: railSegments },
    bodyClearance,
    sectionAudit,
    updateWater,
    snowfall,
    skyTransit,
    skyIsland,
    activePointLights: () => [localBlue, localViolet, portalLight].filter(light => light.visible).length,
    syncMaterials: syncBridgeMaterials,
    transitions: {
      movable,
      frames: islandFrames,
      seeds: islandSeedLog,
      scenicPush,
      fieldExtent,
      setOwner,
      resetOwners,
      setReveal: level => {
        ownerUniforms.gardenReveal.value = level;
      },
      setPracticalLevel,
      setActive: setTransitionActive,
      // Magical transitions: haze per owner (see FADE_ELEMENT), dissolve glow, land outlines by slot, free bridge spans.
      setFade: (owner, level) => {
        if (movable && owner >= 1 && owner < MAX_OWNERS)
          ownerUniforms.gardenOwners.value[owner].elements[3] = level;
      },
      setGlow: (level, band = 0.08) => {
        ownerUniforms.gardenRevealGlow.value = level;
        ownerUniforms.gardenRevealBand.value = band;
      },
      shapes: projectLands.map(
        land =>
          land && {
            x: land.x,
            y: land.y,
            z: land.z,
            radius: land.radius,
            stretch: land.stretch,
            rotation: land.rotation
          }
      )
    },
    bridgeSpans: route.count ? { spans, spoke: spokeSpan } : null,
    setPortalSurge: (level, swirl) => {
      portalGate?.setSurge(level);
      if (portalEffect) {
        portalEffect.uniforms.surge.value = level;
        portalEffect.uniforms.swirl.value = swirl;
      }
    },
    // Portal reactions: hover/approach level, activation flash, and whether it wants full-rate frames.
    setPortalHover: level => portalGate?.setHover(level),
    flashPortal: () => portalGate?.flash(),
    setPortalTint: (color, level) => portalGate?.setTint(color, level),
    setPortalPreview: url => portalGate?.setPreview(url),
    portalNeedsAnimation: eye => !!portalGate?.needsAnimation(eye),
    portalHit: ray => !!portalGate && ray.intersectObjects(portalGate.pickables, false).length > 0,
    dispose
  };
}

const times = {
  // Dawn, told apart from the sunset at a glance: the sun rises opposite the sunset pass, just clear of the
  // ridges, so the overview sees the ranges lit warm from the front instead of backlit, and the palette is
  // cooler and more distinct: blue overhead and in shadow, red-gold low, cool cloud bodies and mist
  // (valley mist, a pink arch opposite the sun, the last stars: backdrop setDawn).
  morning: {
    top: '#345b9d',
    horizon: '#f3a18d',
    low: '#657ea8',
    sun: '#fff2cc',
    cloud: '#adc1df',
    mountain: '#657daa',
    fog: '#a1afcf',
    key: '#ffd1a1',
    fill: '#7eaff0',
    ambient: '#b4c9e8',
    keyPower: 2.4,
    ambientPower: 1.85,
    fillPower: 0.95,
    neon: 0.9,
    sunStrength: 1,
    sunHeight: 68,
    // Azimuth 0.52 rad (atan2(x, z)), opposite the sunset's 3.66, about 14° up: clear of the crests there
    // (about 9°) seen from the garden.
    sunPosition: [160, 68, 280],
    keyPosition: [31, 30, 54],
    fogDensity: 0.0019,
    dawn: 1
  },
  day: {
    top: '#587cb5',
    horizon: '#b6c8e6',
    low: '#8c99ba',
    sun: '#ffe0a1',
    cloud: '#c2bed6',
    mountain: '#8c91b8',
    fog: '#adb8d5',
    key: '#fff0df',
    fill: '#9faee8',
    ambient: '#dddfe9',
    keyPower: 2.6,
    ambientPower: 2.2,
    fillPower: 0.9,
    neon: 0.65,
    sunStrength: 1,
    sunHeight: 215,
    fogDensity: 0.0018
  },
  evening: {
    top: '#6572a7',
    horizon: '#d4b8b0',
    low: '#9a94b8',
    sun: '#ffe0ad',
    cloud: '#c2abc5',
    mountain: '#8885af',
    fog: '#b8a7c7',
    key: '#ffe0c8',
    fill: '#9aa7dc',
    ambient: '#d5cee5',
    keyPower: 2.5,
    ambientPower: 2.15,
    fillPower: 0.95,
    neon: 0.8,
    sunStrength: 1,
    sunHeight: 47,
    fogDensity: 0.0022
  },
  // Golden hour: a deep violet zenith over a coral-pink band, a low saturated key light and less ambient and fog,
  // so the islands are lit warm on one side and violet in shade instead of a pastel wash.
  sunset: {
    top: '#392a78',
    // Owner, 2026-10-27: clearly red, not orange and pink: a coral-red horizon, rose-red clouds and a redder key,
    // while the zenith, fill and ambient stay cool.
    horizon: '#f08570',
    low: '#72558e',
    // A luminous pale core; the warm key and horizon retain the golden-hour atmosphere.
    sun: '#fff0bf',
    cloud: '#e08a74',
    mountain: '#574675',
    fog: '#a9739a',
    key: '#ff9580',
    fill: '#8377dd',
    ambient: '#ae92c7',
    keyPower: 3.1,
    ambientPower: 1.35,
    fillPower: 1.0,
    neon: 1.45,
    sunStrength: 1,
    // Open-sky sunset: the center reaches the actual dome equator, not an assumed mountain.
    sunHeight: 0,
    fogDensity: 0.0023
  },
  night: {
    top: '#101832',
    horizon: '#373968',
    low: '#293760',
    sun: '#94a9d4',
    cloud: '#596aab',
    mountain: '#7d8dcc',
    fog: '#445887',
    key: '#8099da',
    fill: '#7862c9',
    ambient: '#6686d4',
    keyPower: 0.78,
    ambientPower: 1.25,
    fillPower: 0.95,
    neon: 2.25,
    sunStrength: 0,
    sunHeight: -45,
    fogDensity: 0.0021
  }
};
// Stair treads: the height of one step (m), and [lateral centre, width] of the treads across the deck.
export { STAIR_RISE };
export const STAIR_LANES = [[0, 4.36]];
// Stone arch under each span: depth below the deck at the crown and the extra depth where it springs (m).
export const BRIDGE_ARCH = { crown: 1.15, sag: 2.6, from: 0.1, to: 0.9 };
// The key light's default position (buildWorld); a preset may move it with keyPosition.
const KEY_POSITION = [-28, 40, -55];
// A preset's own sun position (day: high overhead; morning: over the ridge); others place it by sunHeight.
const PRESET_SUN = { day: [0, 215, -290], morning: times.morning.sunPosition };
const presetSun = mode => (PRESET_SUN[mode] ? { sunPosition: PRESET_SUN[mode] } : {});
export function localTimeBlend(date = new Date()) {
  const hour =
    date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600 + date.getMilliseconds() / 3600000;
  // Early morning is the dawn preset: night fades into it from 4:30, it holds 6:00-7:30, then turns to day.
  if (hour < 4.5) return ['night', 'night', 0];
  if (hour < 6) return ['night', 'morning', (hour - 4.5) / 1.5];
  if (hour < 7.5) return ['morning', 'morning', 0];
  if (hour < 9.5) return ['morning', 'day', (hour - 7.5) / 2];
  if (hour < 16) return ['day', 'day', 0];
  if (hour < 18) return ['day', 'evening', (hour - 16) / 2];
  if (hour < 19.5) return ['evening', 'sunset', (hour - 18) / 1.5];
  if (hour < 20) return ['sunset', 'sunset', 0];
  if (hour < 22) return ['sunset', 'night', (hour - 20) / 2];
  return ['night', 'night', 0];
}
// Local calendar date, not elapsed UTC hours: stable through reloads and DST.
// The vivid dawn (blue overhead, rose-red horizon and clouds) is the usual one, eight days in ten: it is the look the
// owner chose. The pale gentle dawn and the rose one are the occasional days. The pale one used to be the usual, so
// the morning "turned softer" between two reviews only because the calendar moved from a vivid day (27 Oct 2026) to
// a gentle one (28 Oct); no code in between had changed the picture (round 5, morning bisect).
export function dawnVariant(date = new Date(), localDateKey = null) {
  const calendar = localDateKey
    ? Date.parse(localDateKey + 'T00:00:00Z')
    : Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const day = Math.floor(calendar / 86400000);
  let seed = Math.imul(day ^ (day >>> 16), 0x45d9f3b);
  seed = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b);
  const bucket = ((seed ^ (seed >>> 16)) >>> 0) % 10;
  return bucket === 1 ? 'rose' : bucket === 9 ? 'gentle' : 'vivid';
}
const DAWN_VARIANTS = {
  gentle: {
    top: '#668bb6',
    horizon: '#e8c8c2',
    low: '#91a7bf',
    cloud: '#d7cbdc',
    fog: '#c5c2d1',
    key: '#fff0cf',
    fill: '#a5c6ed',
    ambient: '#d1deea'
  },
  rose: {
    top: '#6179b2',
    horizon: '#efb6b2',
    low: '#9e99bc',
    cloud: '#d9c4dc',
    fog: '#c3b6ce',
    key: '#ffdec6',
    fill: '#a2b6e8',
    ambient: '#d1c9e4'
  },
  vivid: {
    top: '#345b9d',
    horizon: '#f18c88',
    low: '#7b7eaa',
    cloud: '#dbadcc',
    fog: '#b3a7c9',
    key: '#ffd1a1',
    fill: '#7eaff0',
    ambient: '#b4c9e8'
  }
};
// Sunsets differ from day to day too (owner, 2026-11-01: the sunset had grown ordinary, with too little red;
// «разные вариации закатов»). Each keeps the sunset's lights and powers and changes its colours: rose is the
// sunset palette above; crimson and fire are deep red skies with red and orange clouds, golden an amber evening.
// The local calendar day picks one (its own hash, so dawn and dusk vary apart): crimson 3 days in 10, rose 3,
// fire 2, golden 2.
export function sunsetVariant(date = new Date(), localDateKey = null) {
  if (sunsetChoice) return sunsetChoice;
  const calendar = localDateKey
    ? Date.parse(localDateKey + 'T00:00:00Z')
    : Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const day = Math.floor(calendar / 86400000) + 7919;
  let seed = Math.imul(day ^ (day >>> 15), 0x2c1b3c6d);
  seed = Math.imul(seed ^ (seed >>> 12), 0x297a2d39);
  const bucket = ((seed ^ (seed >>> 15)) >>> 0) % 10;
  if (bucket < 3) return 'crimson';
  if (bucket < 6) return 'rose';
  return bucket < 8 ? 'fire' : 'golden';
}
// A variant chosen by hand (?sunset=crimson|fire|golden|rose, to compare them), or null for the day's own.
let sunsetChoice = null;
export function chooseSunsetVariant(name) {
  sunsetChoice = Object.hasOwn(SUNSET_VARIANTS, name ?? '') ? name : null;
}
// The sunset sky's red tones as the shader had them (linear RGB): the red toward the sun, the deeper red-violet on
// the far side and the rose blush above (shaders/sky.mjs); a variant may set its own.
const SKY_TONES = { redNear: [0.95, 0.17, 0.06], redFar: [0.42, 0.09, 0.3], blushTint: [0.88, 0.38, 0.7] };
const SUNSET_VARIANTS = {
  rose: {},
  crimson: {
    redNear: [1, 0.1, 0.035],
    redFar: [0.55, 0.06, 0.2],
    blushTint: [0.95, 0.32, 0.42],
    top: '#2c2168',
    horizon: '#ff6347',
    low: '#8c3d6a',
    sun: '#ffe7b0',
    cloud: '#f2694f',
    mountain: '#4f3461',
    fog: '#b0637a',
    key: '#ff7f62',
    fill: '#7569d4',
    ambient: '#a880b3'
  },
  fire: {
    redNear: [1, 0.24, 0.02],
    redFar: [0.62, 0.1, 0.1],
    blushTint: [1, 0.45, 0.3],
    top: '#221a52',
    horizon: '#ff4a2a',
    low: '#9c3352',
    sun: '#ffd89c',
    cloud: '#ff7440',
    mountain: '#3e2950',
    fog: '#a04c66',
    key: '#ff6d4a',
    fill: '#685bc6',
    ambient: '#9b6ca7'
  },
  golden: {
    redNear: [1, 0.45, 0.08],
    redFar: [0.6, 0.28, 0.24],
    blushTint: [1, 0.62, 0.45],
    top: '#353c8a',
    horizon: '#ffa055',
    low: '#a0687a',
    sun: '#fff3c8',
    cloud: '#ffb26e',
    mountain: '#5b4567',
    fog: '#c48c7e',
    key: '#ffb47a',
    fill: '#7f7cd9',
    ambient: '#b799b3'
  }
};
export function timePalette(mode, date = new Date(), localDateKey = null) {
  const base = times[mode] || times.sunset;
  if (mode === 'morning') return { ...base, ...DAWN_VARIANTS[dawnVariant(date, localDateKey)] };
  if (mode === 'sunset') return { ...base, ...SUNSET_VARIANTS[sunsetVariant(date, localDateKey)] };
  return base;
}
// The named presets, so the Light control knows which options already have their own lighting.
export const lightingModes = Object.keys(times);
export function lighting(world, mode = 'auto', date = new Date(), style = 'natural', cityId = '') {
  const solar = mode === 'auto' && cityId ? solarState(date, cityId) : null;
  const [from, to, mix] = solar
    ? [solar.from, solar.to, solar.mix]
    : mode === 'auto'
      ? localTimeBlend(date)
      : [mode, mode, 0];
  const a = timePalette(from, date, solar?.localDateKey),
    b = timePalette(to, date, solar?.localDateKey);
  const weights = solar?.weights;
  const palettes =
    weights &&
    Object.entries(weights)
      .filter(([, weight]) => weight > 0)
      .map(([name, weight]) => [timePalette(name, date, solar.localDateKey), weight]);
  const scalar = (key, fallback = 0) =>
    palettes
      ? palettes.reduce((sum, [palette, weight]) => sum + (palette[key] ?? fallback) * weight, 0)
      : THREE.MathUtils.lerp(a[key] ?? fallback, b[key] ?? fallback, mix);
  // A palette colour: a hex string, or for the sky's sunset tones a linear [r, g, b] (SKY_TONES where a palette
  // has none of its own).
  const tone = (palette, key) => {
    const value = palette[key] ?? SKY_TONES[key];
    return Array.isArray(value) ? new THREE.Color(value[0], value[1], value[2]) : new THREE.Color(value);
  };
  const color = key => {
    if (!palettes) return tone(a, key).lerp(tone(b, key), mix);
    const result = new THREE.Color(0, 0, 0);
    for (const [palette, weight] of palettes) result.add(tone(palette, key).multiplyScalar(weight));
    return result;
  };
  for (const key of ['top', 'horizon', 'low', 'redNear', 'redFar', 'blushTint'])
    world.skyMaterial.uniforms[key]?.value.copy(color(key));
  world.skyMaterial.uniforms.sunColor.value.copy(color('sun'));
  world.skyMaterial.uniforms.sunStrength.value = solar?.sunStrength ?? scalar('sunStrength');
  world.backdrop.setLight({
    sunColor: color('sun'),
    sunStrength: scalar('sunStrength'),
    cloudColor: color('cloud'),
    mountainColor: color('mountain'),
    sunHeight: scalar('sunHeight'),
    ...(mode === 'auto' ? clockCelestials(date) : presetSun(mode)),
    ...(solar
      ? {
          sunPosition: solar.sunPosition,
          sunStrength: solar.sunStrength,
          moonStrength: 0.84 * (1 - solar.sunStrength)
        }
      : {})
  });
  // Dawn sky, valley mist and the key light's side follow the morning preset (the clock sun keeps its own
  // path in Auto; only the key light and palette blend).
  // Light through leaves fades with the sun: at night it lit the foliage like a lamp.
  if (world.foliageDaylight)
    world.foliageDaylight.value =
      0.1 + 0.9 * Math.min(1, Math.max(0, (solar?.sunStrength ?? scalar('sunStrength')) * 1.4));
  // The Moon shows the phase of the date (a crescent, a quarter or the full disc).
  world.backdrop.setMoonPhase?.(moonPhase(date));
  const dawn = scalar('dawn', 0);
  world.backdrop.setDawn?.(dawn);
  const keyFrom = a.keyPosition || KEY_POSITION,
    keyTo = b.keyPosition || KEY_POSITION;
  world.key.position.set(
    ...keyFrom.map((v, i) =>
      palettes
        ? palettes.reduce(
            (sum, [palette, weight]) => sum + (palette.keyPosition || KEY_POSITION)[i] * weight,
            0
          )
        : THREE.MathUtils.lerp(v, keyTo[i], mix)
    )
  );
  world.scene.fog.color.copy(color('fog'));
  if ('density' in world.scene.fog) world.scene.fog.density = scalar('fogDensity', 0.002);
  world.ambient.color.copy(color('ambient'));
  world.key.color.copy(color('key'));
  world.fill.color.copy(color('fill'));
  world.key.intensity = scalar('keyPower');
  world.ambient.intensity = scalar('ambientPower');
  world.fill.intensity = scalar('fillPower');
  for (const key of ['blue', 'violet', 'coral']) world.palette[key].emissiveIntensity = scalar('neon');
  const nightAmount =
    weights?.night ?? (from === 'night' ? 1 : 0) * (1 - mix) + (to === 'night' ? 1 : 0) * mix;
  world.ribbonMaterial.opacity = 0.16 + nightAmount * 0.74;
  const dusk = weights?.sunset ?? (from === 'sunset' ? 1 : 0) * (1 - mix) + (to === 'sunset' ? 1 : 0) * mix;
  // Lamps still burn softly at dawn, a little less than at dusk.
  world.setLightStyle(style, Math.min(1, nightAmount + dusk * 0.48 + dawn * 0.3));
  // Neon nights keep the surfaces a little darker so the coloured light carries the scene.
  if (style === 'neon') world.ambient.intensity *= 1 - 0.28 * nightAmount;
  if (style !== 'neon') {
    // The sky and cloud colors stay intact; ordinary moonlight is less violet on surfaces.
    world.ambient.color.lerp(new THREE.Color('#bac4d8'), nightAmount * 0.66);
    world.fill.color.lerp(new THREE.Color('#9cacc7'), nightAmount * 0.78);
    world.ribbonMaterial.opacity = 0.015 + nightAmount * 0.025;
    for (const key of ['blue', 'violet', 'coral'])
      world.palette[key].emissiveIntensity = 0.1 + nightAmount * 0.12;
  }
  return {
    from,
    to,
    mix,
    weights,
    style,
    localHour: solar?.localHour ?? date.getHours() + date.getMinutes() / 60,
    solar
  };
}

// Approximate device-clock cycle; no location, ephemeris or astronomical accuracy claim.
export function clockCelestials(date = new Date()) {
  const h =
      date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600 + date.getMilliseconds() / 3600000,
    phase =
      h >= 6 && h < 20 ? (Math.PI * (h - 6)) / 14 : Math.PI + (Math.PI * ((((h - 20) % 24) + 24) % 24)) / 10,
    s = Math.sin(phase),
    x = 330 * Math.cos(phase);
  return {
    sunPosition: [x, s * 225 - 10, -290],
    moonPosition: [-x, -s * 195 - 12, -305],
    sunStrength: THREE.MathUtils.clamp(s * 4 + 0.18, 0, 1),
    moonStrength: THREE.MathUtils.clamp(-s * 3 + 0.05, 0, 0.84)
  };
}
