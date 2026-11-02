import { visiblePickHits } from './visible-pick.mjs';
import { gardenFile } from './garden-paths.mjs';
import { SOLAR_CITIES, solarState } from './solar-clock.mjs';
import { enhanceCityPicker } from './city-picker.mjs';
import {
  ORBIT,
  createOrbit,
  resetOrbit,
  orbitRange,
  orbitTurn,
  orbitHold,
  orbitZoom,
  orbitStep,
  orbitPose,
  orbitFocus,
  rayFocus,
  traceSurface,
  CAMERA_DIRECTIONS,
  resolveCameraDirection,
  dragSign
} from './overview-orbit.mjs';
import { createClearanceGrid } from './camera-clearance.mjs';
import { loadLolipopFirs } from './imported-firs.mjs';
import { createFrameProbe } from './frame-probe.mjs';
import { ADAPTIVE_RESOLUTION, createAdaptiveResolution } from './adaptive-resolution.mjs';
import { resolveTreeTrial, loadMundoPine, treeReviewPose, mountTreeComparison } from './imported-pine.mjs';
import {
  resolveDisplayPrototype,
  useDisplayDetailPose,
  mountDisplayComparison
} from './display-prototypes.mjs';
import { installLightReach, resolveLightStyle } from './practical-lighting.mjs';
import {
  cameraDelta,
  tweenProgress,
  travelDuration,
  travelCurve,
  travelRate,
  travelStep,
  bridgeArc,
  aimQuaternion,
  orientLook
} from './camera-progress.mjs';
import { mountAnnouncements } from './announcements.mjs';
import { bindSegmentedChoice } from './segmented-choice.mjs';
import {
  bindEntryDive,
  bindGalleryGesture,
  bindPointerLight,
  createStirWatch,
  decorateLanguageOption
} from './control-strip.mjs';
import * as THREE from './vendor/three.module.js';
import { buildWorldSteps, lighting, lightingModes, chooseSunsetVariant } from './world.mjs';
import { wrapped, smooth, transitOffset, routeTarget, layoutFrames } from './path.mjs';
import {
  DEFAULT_FILTERS,
  normalizeFilters,
  parseFilterState,
  filterSearch,
  fetchProjects,
  fetchLinks,
  fetchLanguages
} from './api-catalog.mjs';
import { createBloom } from './garden-bloom.mjs';
import { createSkyLife } from './sky-life.mjs';
import { createShowcase } from './arrange-showcase.mjs';
import {
  planTransition,
  displacement,
  sinkMatrix,
  phaseProgress,
  timeScale,
  TIMELINE,
  LIFT,
  levitation,
  portalTripShape,
  magicJumpShape,
  MAGIC_JUMP_CUT,
  wipeRadius
} from './garden-transition.mjs';
import { createMagicEffects } from './magic-effects.mjs';
import { createPocketPortal } from './pocket-portal.mjs';
import { lensShape } from './black-hole-lens.mjs';
import { createPortalDial } from './portal-dial.mjs';
import { HALL } from './pavilion-hall.mjs';
import { GREENHOUSE } from './greenhouse.mjs';
import { cablePoint } from './sky-transit.mjs';
import {
  SKY_ZIP,
  TERRACE,
  terraceInput,
  terracePose,
  terraceState,
  terraceStep,
  terraceWalk
} from './sky-island.mjs';
import { glowThreshold } from './content-level.mjs';
import { createPerfHud, perfEnabled } from './perf-hud.mjs';
import { BENCH, benchRequest, benchStrings, mountBench } from './garden-bench.mjs';
import { mountAmbientMusic } from './ambient-music.mjs';
import { bindSettingsTabs } from './settings-tabs.mjs';
import {
  celebrateUrl,
  celebrationFor,
  createFireworks,
  daylight,
  mountGreeting,
  projectBirthdays,
  projectPitch
} from './celebrations.mjs';
import { calendarOrder } from './celebrations.mjs';
import { createPavilionParty } from './project-birthdays.mjs';
import { createCelebrationStage } from './celebration-stage.mjs';
import { NEAR_PLANE, nearPlane, outsideGarden, inFrontOfCamera } from './near-plane.mjs';
import { videoEmbed } from './video-embed.mjs';
import { createUltraEffects } from './ultra-effects.mjs';
import { shaderSnapshot } from './shader-snapshot.mjs';

const data = JSON.parse(document.querySelector('#garden-data').textContent);
// A copy on another site (js.maserplay.ru) names the server that keeps comments (data.api) and, instead of setting a
// language on the server, the page of each language (data.localePages).
const API = typeof data.api === 'string' ? data.api : '';
const { labels } = data;
// The visible garden follows the API order for the current filters; the world is rebuilt per list.
let projects = data.projects;
let filters = parseFilterState(location.search),
  appliedFilters = filters,
  worldFilters = filters;
let relayout = null,
  pendingList = null,
  queuedList = null,
  historyPending = false,
  listToken = 0,
  listAbort = null,
  filterTimer = 0,
  filteredOut = null,
  noticeTimer = 0,
  trialAssets = { pineAsset: null },
  mediaSelections = null;
const accentCache = new Map(),
  relayoutStats = [];
const $ = id => document.getElementById(id);
const app = $('garden-app'),
  canvas = $('garden-scene'),
  dialog = $('portal-dialog');
// The viewport's size, read once per resize (this listener comes first): window.innerWidth and innerHeight force a
// layout of the whole page when it changed since the last frame (round 22: 30–80 ms a read on a phone, in
// updateMode, the portal's opening, the crossing and the arrival).
const viewport = { width: innerWidth, height: innerHeight };
addEventListener('resize', () => {
  viewport.width = innerWidth;
  viewport.height = innerHeight;
});
const mobile = () => viewport.width <= 740;
const prefs = window.matchMedia('(prefers-reduced-motion: reduce)');
let renderer,
  world,
  bloom = null,
  skyLife = null,
  fireworks = null,
  soundController = null,
  pavilionParty = null;
// The site's birthday or New Year (celebrations.mjs), decided once per page load by the date (or the
// temporary settings picker or ?celebrate=<key> preview). Nothing is persisted outside the URL.
// A day that is only some project's birthday is the 'project' occasion (project-birthdays.mjs). The day's
// composition over the central island is celebrationStage (celebration-stage.mjs).
let occasion = celebrationFor(new Date(), location.search, projects),
  celebrationStage = null;
// The greeting says why there are fireworks: up at once, over the loading screen, before the world exists.
let greeting = occasion
  ? mountGreeting(document, { occasion, labels, locale: data.locale, party: birthdaysNow() })
  : null;
greeting?.show();
let lightStyle = resolveLightStyle(safePreference('light-style'));
// Settings → Управление: which way a drag turns the camera (overview-orbit.mjs dragSign).
let cameraDirection = resolveCameraDirection(safePreference('camera-direction'));
let reduced = prefs.matches,
  economy = false,
  graphics = 'high',
  mode = 'overview',
  current = 0,
  target = 0,
  selected = 0,
  portalSelection = 0,
  // The rune dial's slot 0 is the garden overview; it only changes what «Перейти» travels to.
  portalToOverview = false;
const seasonNames = ['auto', 'spring', 'summer', 'autumn', 'winter'];
const calendarSeason = (date = new Date()) =>
  [
    'winter',
    'winter',
    'spring',
    'spring',
    'spring',
    'summer',
    'summer',
    'summer',
    'autumn',
    'autumn',
    'autumn',
    'winter'
  ][date.getMonth()];
const readSeason = () => {
  const value = new URLSearchParams(location.search).get('season') || safePreference('season') || 'auto';
  return seasonNames.includes(value) ? value : 'auto';
};
const seasonButton = name => $(name === 'auto' ? 'season-auto' : name);
let seasonMode = readSeason(),
  season = seasonMode === 'auto' ? calendarSeason() : seasonMode,
  winter = season === 'winter',
  timeMode = new URLSearchParams(location.search).get('time') || 'auto';
// Morning is listed before its lighting preset lands; presetMode() shows day until world.mjs has it.
const TIME_MODES = ['auto', 'morning', 'day', 'sunset', 'night'];
const presetMode = mode => (mode === 'auto' || lightingModes.includes(mode) ? mode : 'day');
if (!TIME_MODES.includes(timeMode)) timeMode = 'auto';
let solarCity = safePreference('solar-city') || '';
if (!SOLAR_CITIES.some(city => city.id === solarCity)) solarCity = '';

let waterTimer = 0,
  frameWatchdog = 0,
  clockTimer = 0,
  auditTimer = 0,
  frameGeneration = 0,
  runtimeGeneration = 0,
  rafStarved = false,
  rafRecovery = 0,
  drawBreakAt = 0,
  drawBreakUntil = 0;
let contextLost = false,
  pageSuspended = false;
const auditEnabled = new URLSearchParams(location.search).get('audit') === '1';
// ?perf=1 shows a frame-rate meter for checking a real phone (perf-hud.mjs).
const perfHud = perfEnabled(location.search) ? createPerfHud(document) : null;
// The built-in benchmark (garden-bench.mjs): the run in progress (it drives the camera), its UI once opened,
// what it changed (restored afterwards), and when the first frame was drawn (ms since navigation).
let bench = null,
  benchUi = null,
  benchSaved = null,
  firstFrameAt = 0;
// Adaptive resolution (adaptive-resolution.mjs), Settings → «Подстраивать чёткость под нагрузку». Off with
// ?adaptive=0, in audit captures unless ?adaptive=1 (they compare fixed frames) and during a benchmark.
// adaptiveScale: the share of the pixel ratio drawn; adaptivePending: a new share for the next frame; adaptiveFrom:
// no verdicts before the boot's first-use hitches are over; drawStart: when the frame's draw was handed over;
// idleTick: this frame waits for the idle water tick, so its lateness is the loop's own doing.
const adaptiveParam = new URLSearchParams(location.search).get('adaptive');
const adaptive =
  adaptiveParam === '0' || (auditEnabled && adaptiveParam !== '1') ? null : createAdaptiveResolution();
let autoQuality = true,
  adaptiveScale = 1,
  adaptivePending = null,
  adaptiveFrom = Infinity,
  drawStart = 0,
  idleTick = false;
const adaptiveLog = [];
const treeTrial = resolveTreeTrial(data, location.search);
const displayPrototype = resolveDisplayPrototype(data, location.search);
const lookTiming = { pendingAt: 0, events: [], frames: [] };
const frameTiming = {
  requestedAt: 0,
  callbacks: 0,
  callbackGapMs: 0,
  requestWaitMs: 0,
  cpuMs: 0,
  source: 'raf',
  fallbackFrames: 0,
  previousCallback: 0,
  timerGapMs: 0,
  timerAt: 0,
  samples: []
};
function timingSnapshot() {
  return {
    source: frameTiming.source,
    fallbackFrames: frameTiming.fallbackFrames,
    callbacks: frameTiming.callbacks,
    callbackGapMs: frameTiming.callbackGapMs,
    requestWaitMs: frameTiming.requestWaitMs,
    cpuMs: frameTiming.cpuMs,
    timerGapMs: frameTiming.timerGapMs,
    focus: document.hasFocus(),
    visibility: document.visibilityState,
    now: performance.now(),
    samples: frameTiming.samples
  };
}
// The last flight's closest pass to any obstacle, for audits (state.lastFlightClearance): its paths are kept and
// measured when read. Measured at every take-off it cost 8 ms there, 30 ms on a slow phone (round 22).
function flightClearance(flight) {
  if (!flight?.paths) return flight;
  if (flight.clearance === undefined) {
    flight.clearance = Infinity;
    for (const path of flight.paths)
      for (let i = 0; i <= flight.samples; i++)
        flight.clearance = Math.min(
          flight.clearance,
          world.pointClearance(path.getPoint(i / flight.samples))
        );
  }
  return flight.clearance;
}
let journeyArrival = null,
  announcements = null;
// A lift or zipline ride in progress: drags, wheel, keys and clicks in the scene do not cut it short.
let ride = null;
let animation = null,
  frame = 0,
  lastFrame = 0,
  renderCount = 0,
  lightFade = null,
  lastLighting = null;
let look = new THREE.Vector3(),
  moving = false,
  lastFlightClearance = null,
  velocity = 0,
  portalTransit = null,
  portalHovered = false,
  portalHoverAt = 0,
  portalApproaching = false;
let zone = 'main',
  galleryImage = 0,
  commentToken = 0;
let walkStart = 0,
  walkOffset = 0;
// The overview orbit (overview-orbit.mjs): eased state, its goal and a flick's spin.
const orbitView = createOrbit();
let scenicFocus = null,
  // A drag that takes over a flight into the overview fades from where the flight was (no jump).
  overviewBlend = null;
// Travel between pavilions: the eased trip in progress, and the speed carried into a retarget.
let travel = null,
  travelCarry = 0;
// While travelling a drag glances aside (yaw, pitch) and the view drifts back when let go.
const travelLook = { yaw: 0, pitch: 0, holding: false };
// A pavilion's free look stays within reach of the direction it started from.
const FREE_LOOK = { yaw: 1.6, up: -0.75, down: 0.9, glance: 0.75, glancePitch: 0.4, back: 2.2 };
let lookYaw = 0,
  lookPitch = 0,
  lookBase = 0,
  // Audit review poses keep their exact camera (resize must not move it).
  pinnedPose = null;
let lastExhibitRect = null,
  freeLook = false;
// A project is viewed from inside its glass hall; phones stop at the open doors (pavilion-hall.mjs).
// A greenhouse (greenhouse.mjs) fits the narrow view from inside, so phones walk in there too.
const inspectionOffset = (index = target) =>
  mobile() && !world?.isGreenhouse?.(index) ? HALL.station.phone : HALL.station.wide;
// A hall is entered and left over a short stretch of bridge, so the walk passes through its door.
const lateralReach = (offset, station) =>
  offset > 0 ? HALL.entryMetres / world.route.metersPerStation(station) : 0.24;
const zones = ['main', 'gallery', 'description', 'comments'];
const commentsCache = new Map();
const camera = new THREE.PerspectiveCamera(48, viewport.width / viewport.height, NEAR_PLANE.close, 680);
const alive = { disposed: false };
const vec = p => new THREE.Vector3(p.x, p.y, p.z);
function safePreference(key) {
  try {
    return localStorage.getItem('garden-' + key);
  } catch {
    return null;
  }
}
function savePreference(key, value) {
  try {
    localStorage.setItem('garden-' + key, String(value));
  } catch {}
}
// Graphics quality (Settings → Ещё, owner 2026-10-31): low is the former economy (fewer pixels, 30 fps, a still
// background), medium draws at 0.9 with FXAA, high at up to 1.65 with glow on computers and at up to 1.3 with FXAA
// on phones and tablets, ultra at up to 2.5 with glow on every device (chosen by hand only, for powerful devices).
// A visitor who never chose gets the device's recommendation; an old «Экономить ресурсы» choice carries over as low.
// A phone or tablet: a coarse pointer and a short screen side up to 820 px. Unlike mobile() it does not change when
// the screen turns, so the canvas's antialiasing can follow it.
const handheld = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) <= 820;
// An iPhone or iPad, which holds a page's frame rate down after 20 s of unbroken drawing (DRAW_BREAK).
const appleTouch =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
const GRAPHICS = ['low', 'medium', 'high', 'ultra'],
  recommendedGraphics = recommendGraphics();
graphics = GRAPHICS.includes(safePreference('graphics'))
  ? safePreference('graphics')
  : safePreference('economy') === 'true'
    ? 'low'
    : recommendedGraphics;
economy = graphics === 'low';
autoQuality = safePreference('auto-quality') !== 'false';
reduced = prefs.matches;
$('auto-quality').toggleAttribute('checked', autoQuality);
// Whether the canvas was made with MSAA (levelMsaa when the page opened).
function canvasMsaa() {
  return renderer?.getContext().getContextAttributes()?.antialias !== false;
}
// Whether a level draws with the canvas's 4× MSAA: ultra, and high on a computer. The others smooth edges with FXAA
// (garden-bloom.mjs), which costs a phone's GPU far less: owner's Realme 11 Pro+, medium 35 fps with MSAA and 55
// with FXAA (2026-10-31); high at ×1.3, 31 and 39 (2026-11-01).
function levelMsaa(level) {
  return level === 'ultra' || (level === 'high' && !handheld);
}
// A phone or tablet is recommended medium, a computer high; a device that reports 2 GB of memory or less, low.
function recommendGraphics() {
  if (navigator.deviceMemory && navigator.deviceMemory <= 2) return 'low';
  return handheld ? 'medium' : 'high';
}

function fallback(error) {
  console.error('Garden unavailable', error);
  $('fallback').hidden = false;
  $('loader').hidden = true;
  $('hero').hidden = true;
  document.querySelector('.journey-bar').hidden = true;
  if (world) world.dispose();
  if (renderer) {
    renderer.gardenFrameProbe?.dispose();
    renderer.dispose();
  }
}
// Load stages as performance marks (garden:*), read by the load measurement (owner, round 17: about 7 s to load).
const loadMark = name => performance.mark('garden:' + name);
async function boot() {
  loadMark('boot');
  try {
    await loadLinkedFilters();
    worldFilters = appliedFilters;
    await prepareProjects(projects);
    loadMark('identity');
    createRenderer();
    const { pineAsset, treeError } = await loadTreeTrial();
    if (alive.disposed) {
      if (pineAsset)
        (pineAsset.resources || [pineAsset.geometry, pineAsset.material, ...pineAsset.textures]).forEach(r =>
          r.dispose()
        );
      return;
    }
    trialAssets = { pineAsset };
    loadMark('renderer');
    world = createWorld(projects);
    loadMark('world');
    mountTreeComparison(treeTrial, data.locale, treeError);
    mountDisplayComparison(displayPrototype, data.locale);
    chooseReviewPose();
    initialize();
  } catch (error) {
    fallback(error);
  }
}
// A shared or reloaded filtered link opens directly on its own list; if that list cannot load, the default
// garden opens with a notice.
async function loadLinkedFilters() {
  if (filterSearch(filters)) {
    try {
      projects = await loadProjects(filters);
      appliedFilters = filters;
    } catch (error) {
      console.warn('Filtered projects unavailable; showing the default garden', error);
      filters = appliedFilters = normalizeFilters(DEFAULT_FILTERS);
      writeFilterUrl();
      showNotice(labels.filterError);
    }
  }
}
// The page's renderer (its settings are fixed for the page's life) and the glow chain, if it starts.
function createRenderer() {
  installLightReach(THREE);
  renderer = new THREE.WebGLRenderer({
    canvas,
    // The canvas's 4× MSAA where the level wants it (levelMsaa). It is fixed for the page's life: a level that
    // wants the other kind says so and takes it after a reload.
    antialias: levelMsaa(graphics),
    alpha: false,
    powerPreference: 'low-power',
    // Reversed depth (owner, round 5: surfaces flickered seen from afar): with the float depth of the glow
    // pass's target (garden-bloom.mjs) depth keeps the same relative precision at every distance, so layers a
    // few millimetres apart stay apart across the whole garden. Without EXT_clip_control three.js keeps the
    // usual depth and the moving near plane (near-plane.mjs) does what it can.
    reversedDepthBuffer: true
  });
  if (auditEnabled) renderer.gardenFrameProbe = createFrameProbe(renderer);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  try {
    bloom = createBloom(renderer, { samples: canvasMsaa() ? 4 : 0 });
  } catch (error) {
    console.warn('Glow unavailable; rendering without it', error);
    bloom = null;
  }
}
// The ?trees= trial: the imported tree model, or the error that kept the original tree.
async function loadTreeTrial() {
  let pineAsset = null,
    treeError = '';
  if (treeTrial === 'mundo' || treeTrial === 'mundo-full' || treeTrial === 'lolipop') {
    try {
      pineAsset = await (treeTrial === 'lolipop' ? loadLolipopFirs() : loadMundoPine());
      if (treeTrial === 'mundo-full') pineAsset.variant = 'mundo-full';
    } catch (error) {
      treeError = String(error);
      console.warn('Imported tree trial: original tree retained', error);
    }
  }
  return { pineAsset, treeError };
}
// The pose a review opens at, later ones winning: a display comparison close-up, an audit capture
// (?capture=fir-apex, lamp-far, bridge-under, ...) or a tree trial's own view.
function chooseReviewPose() {
  if (useDisplayDetailPose(displayPrototype, location.search, readHash())) {
    const local = stationLocal();
    data.reviewPose = {
      kind: 'local display comparison three-quarter',
      position: mobile() ? local(4.8, 4.3, -8.4) : local(6.1, 4.8, -8.8),
      look: local(0, 2.55, 1.45),
      progress: 0
    };
  }
  if (auditEnabled && Object.hasOwn(data, 'reviewPose')) {
    const view = new URLSearchParams(location.search).get('capture');
    if (
      view === 'fir-apex' ||
      view === 'fir-apex-back' ||
      view === 'fir-apex-side' ||
      view === 'fir-lod1' ||
      view === 'fir-lod2'
    ) {
      const positions = {
        'fir-apex': [1.0, 10.5, 0.8],
        'fir-apex-back': [-2.6, 10.5, -5.1],
        'fir-apex-side': [2.8, 10.5, -3.1],
        'fir-lod1': [27, 12, 38],
        'fir-lod2': [57, 18, 82]
      };
      data.reviewPose = {
        kind: 'diagnostic ' + view,
        position: positions[view],
        look: view.startsWith('fir-apex') ? [-0.8, 10.55, -2.15] : [-0.8, 5.7, -2.15],
        progress: 0
      };
    }
    if (view === 'lamp-far' || view === 'lamp-near') {
      const p = view === 'lamp-far' ? 0.08 : 0.34,
        eye = world.route.point(p, 0, 3.3),
        aim = world.route.point(0.7, 0, 0.9);
      data.reviewPose = {
        kind: 'diagnostic ' + view,
        position: [eye.x, eye.y, eye.z],
        look: [aim.x, aim.y, aim.z],
        progress: p
      };
    }
    if (view === 'botanical-tree' || view === 'botanical-bed') {
      const local = stationLocal();
      data.reviewPose =
        view === 'botanical-tree'
          ? {
              kind: 'diagnostic ordinary tree',
              position: local(-12, 4.0, -4),
              look: local(-7.1, 2.25, 2.4),
              progress: 0
            }
          : {
              kind: 'diagnostic botanical bed',
              position: local(-3.3, 2.0, 10.2),
              look: local(-0.4, 0.85, 12.5),
              progress: 0
            };
    }
    if (view === 'pavilion-top' || view === 'pavilion-side') {
      const local = stationLocal();
      data.reviewPose =
        view === 'pavilion-top'
          ? {
              kind: 'diagnostic pavilion plan',
              position: local(-1.5, 24, 6.5),
              look: local(-1.5, 0, 5.6),
              progress: 0
            }
          : {
              kind: 'diagnostic pavilion side',
              position: local(-13, 3.2, 1.2),
              look: local(0, 2.2, 1.2),
              progress: 0
            };
    }
    if (view === 'lake-bank' || view === 'rear-path') {
      const local = stationLocal();
      data.reviewPose =
        view === 'lake-bank'
          ? {
              kind: 'diagnostic lake bank',
              position: local(9.7, 5.0, 13.5),
              look: local(5.4, 0.65, 7.5),
              progress: 0
            }
          : {
              kind: 'diagnostic rear passage',
              position: local(-3.0, 5.2, 6.5),
              look: local(4.4, 0.65, 11.5),
              progress: 0
            };
    }
    if (view === 'bridge-profile' || view === 'bridge-under') {
      const p = 0.52,
        center = world.route.point(p),
        normal = world.route.normal(p),
        tangent = world.route.tangent(p);
      data.reviewPose = {
        kind: 'diagnostic ' + view,
        position: [
          center.x + normal.x * 11 - tangent.x * 3,
          center.y + (view === 'bridge-under' ? -2 : 1.2),
          center.z + normal.z * 11 - tangent.z * 3
        ],
        look: [center.x, center.y - 0.15, center.z],
        progress: p
      };
    }
  }
  const treePose = treeReviewPose(treeTrial, location.search, mobile(), readHash());
  if (treePose) data.reviewPose = treePose;
}
boot();

const nightLevel = l =>
  l ? (l.weights?.night ?? (l.from === 'night' ? 1 - l.mix : 0) + (l.to === 'night' ? l.mix : 0)) : 0;
// Nature sounds read the camera, the falls, the season and the light a few times a second (one reused object).
const natureView = { x: 0, y: 0, z: 0, falls: [], season: 'summer', night: 0, morning: 0 };
let natureFallsOf = null;
function readNatureView() {
  if (!world) return null;
  if (natureFallsOf !== world) {
    natureFallsOf = world;
    natureView.falls = world.fallPoses?.() || [];
  }
  natureView.x = camera.position.x;
  natureView.y = camera.position.y;
  natureView.z = camera.position.z;
  natureView.season = season;
  const l = lastLighting;
  natureView.night = nightLevel(l);
  natureView.morning = 0;
  if (l)
    natureView.morning =
      l.weights?.morning ?? (l.from === 'morning' ? 1 - l.mix : 0) + (l.to === 'morning' ? l.mix : 0);
  // On the clock the early hours count as morning even while the palette blends night into day.
  if (l && timeMode === 'auto' && l.localHour >= 5 && l.localHour < 10)
    natureView.morning = Math.max(natureView.morning, 1 - Math.abs(l.localHour - 7) / 3);
  return natureView;
}
function createWorld(list, options = {}) {
  const steps = worldSteps(list, options);
  for (;;) {
    const step = steps.next();
    if (step.done) return adoptWorld(step.value);
  }
}
// The world's own build, step by step (world.mjs); it touches nothing of the garden on screen until adoptWorld.
function worldSteps(list, options = {}) {
  const seedLog = auditEnabled && new URLSearchParams(location.search).has('island-seeds');
  return buildWorldSteps(
    list,
    requestRender,
    labels,
    displayPrototype,
    trialAssets.pineAsset,
    // ?greenhouse=all|none|smallest|2,3 previews the greenhouse gallery on other islands (greenhouse.mjs).
    {
      recordIslandSeeds: seedLog,
      greenhouse: new URLSearchParams(location.search).get('greenhouse'),
      prepare: prepareShaders,
      // The screen in focus is painted and sent to the GPU as the trip starts. A phone shows it at most about 1000 px
      // wide, and four times the pixels only make that one frame longer.
      screenWidth: handheld ? 1024 : 2048,
      ...options
    }
  );
}
function adoptWorld(built) {
  // Balloons and birds live outside the world build and move into each rebuilt scene.
  skyLife ??= createSkyLife(THREE, { economy });
  built.visitor?.setEconomy?.(economy);
  // With the observatory preview one balloon starts from and returns to the station's launch mast.
  skyLife.attach(built.scene, {
    radius: built.route.radius,
    scenicPush: built.transitions?.scenicPush || 0,
    station: built.skyIsland?.launch || null
  });
  attachCelebration(built);
  return built;
}
// On the first world of a festive day the fireworks show starts (with the age or the year spelled in sparks)
// and the greeting's countdown begins; the fireworks live on across rebuilds.
function attachCelebration(built) {
  if (!occasion && !fireworks) return;
  if (!fireworks) {
    fireworks = createFireworks(THREE, {
      occasion,
      compact: mobile() || economy,
      reduced,
      figure: greeting?.copy.sky,
      onWake: requestRender,
      onSound: event => soundController?.playFirework(event),
      stillOn: () => celebrationFor(new Date(), location.search, projects) === occasion
    });
    fireworks.start();
    greeting?.arm();
  }
  fireworks.attach(built.scene, built.route);
  partyFor(built);
  stageFor(built);
}
// The composition follows the occasion and moves into each rebuilt scene, anchored over its portal.
function stageFor(built) {
  const fresh = !celebrationStage;
  celebrationStage ??= createCelebrationStage(THREE, {
    document,
    labels,
    locale: data.locale,
    onWake: requestRender
  });
  celebrationStage.attach(built.scene, built, fireworks);
  if (fresh) celebrationStage.setOccasion(occasion, birthdaysNow());
}
// Today's project birthdays, or the ?celebrate=project[:n|:name] preview.
// Each with its project's own line (projectPitch) for the greeting.
function birthdaysNow() {
  return projectBirthdays(projects, new Date(), location.search).map(b => ({
    ...b,
    pitch: projectPitch(projects[b.index]?.description)
  }));
}
// The birthday pavilions celebrate on any occasion's day (none when the celebrations are off).
function partyFor(built) {
  pavilionParty ??= createPavilionParty(THREE, {
    document,
    labels,
    locale: data.locale,
    projectOf: index => projects[index]
  });
  pavilionParty.attach(built, occasion ? birthdaysNow() : [], fireworks);
}
// Route dots and the portal chooser always mirror the islands that exist.
function renderProjectLists() {
  $('route-dots').replaceChildren();
  // Rune dial: slot 0 is the whole garden (a sprig sigil), then one sigil per project.
  const home = document.createElement('button');
  home.type = 'button';
  home.className = 'rune-sigil is-home';
  home.dataset.slot = 0;
  home.dataset.dest = 'overview';
  home.dataset.name = labels.overview;
  home.setAttribute('aria-label', labels.portalOverview);
  home.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5V9.5M12 13c-3.6 0-5.6-2.3-5.6-5.6 3.4 0 5.6 2 5.6 5.6Zm0-2.4c0-3.2 2-5.2 5.4-5.2 0 3.2-2 5.2-5.4 5.2ZM7.5 20.5h9"/></svg>';
  $('portal-projects').replaceChildren(home);
  projects.forEach((project, index) => {
    const dot = document.createElement('button');
    dot.append(projectIcon(project));
    dot.title = project.name;
    dot.setAttribute('aria-label', project.name);
    dot.dataset.index = index;
    dot.addEventListener('click', () => goTo(index));
    $('route-dots').append(dot);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rune-sigil';
    button.dataset.index = index;
    button.dataset.slot = index + 1;
    button.dataset.name = project.name;
    if (project.accent) button.dataset.accent = project.accent;
    button.style.setProperty('--sigil-accent', project.accent || '#b9a2ff');
    button.setAttribute('aria-label', project.name);
    button.append(projectIcon(project));
    $('portal-projects').append(button);
  });
  portalStrip?.layout();
  portalStrip?.sync(true);
}
function initialize() {
  const hash = readHash();
  world.setSeason(season);
  updateSeasonButtons();
  // ?sunset=crimson|fire|golden|rose shows that sunset whatever the day (to compare them); else the day picks.
  chooseSunsetVariant(new URLSearchParams(location.search).get('sunset'));
  lastLighting = lighting(world, presetMode(timeMode), new Date(), lightStyle, solarCity);
  resize();
  const pose = overviewPose();
  camera.position.copy(pose.position);
  look.copy(pose.look);
  camera.lookAt(look);
  compileBootShaders();
  renderProjectLists();
  // A filtered link loads its own list after the picker was first filled.
  renderHolidayProjects();
  bindEvents();
  bindFilters();
  bindCommentForm();
  enhancePicker('language');
  enhanceTime();
  bindSolarCity();
  if ($('solar-city'))
    enhanceCityPicker(document, {
      select: /** @type {HTMLSelectElement} */ ($('solar-city')),
      cities: SOLAR_CITIES,
      locale: data.locale,
      labels
    });
  bindSegmentedChoice(document.querySelector('.season-switch'), {
    getSelected: () => seasonNames.indexOf(seasonMode),
    onSelect: i => setSeason(seasonNames[i])
  });
  preview(0);
  updateProject(0);
  updateMode();
  prewarmPortalPaint();
  loadSiteLinks();
  loadLanguages();
  setTimeout(() => (window.requestIdleCallback || setTimeout)(prewarmMagic), 4000);
  if (data.fixture?.label) {
    for (const id of ['fixture-note', 'filter-source']) {
      $(id).textContent = data.fixture.label;
      $(id).hidden = false;
    }
  }
  if (hash.kind === 'overview' && new URLSearchParams(location.hash.slice(1)).get('project'))
    showNotice(labels.hashHidden);
  bindLightStyleChoice();
  bindCameraDirectionChoice();
  buildBanners();
  bindBench();
  openLinkedPlace(hash);
  announcements?.handlePopstate();
  if (auditEnabled && data.reviewPose) applyReviewPose(data.reviewPose);
  requestRender();
  installAuditHooks();
  scheduleClock();
}
// Settings → light style: natural or neon, remembered, relit at once.
function bindLightStyleChoice() {
  const styles = ['natural', 'neon'];
  const syncStyle = () => {
    $('light-style').style.setProperty('--segment-index', styles.indexOf(lightStyle));
    styles.forEach(style => $('light-' + style).setAttribute('aria-pressed', String(style === lightStyle)));
    app.dataset.lightStyle = lightStyle;
  };
  bindSegmentedChoice($('light-style'), {
    getSelected: () => styles.indexOf(lightStyle),
    onSelect: i => {
      lightStyle = styles[i];
      savePreference('light-style', lightStyle);
      syncStyle();
      setLighting();
    }
  });
  syncStyle();
}
// Settings → controls: whether a drag grabs the world or turns the camera, remembered.
function bindCameraDirectionChoice() {
  const syncDirection = () => {
    $('camera-direction').style.setProperty('--segment-index', CAMERA_DIRECTIONS.indexOf(cameraDirection));
    CAMERA_DIRECTIONS.forEach(d =>
      $('camera-' + d).setAttribute('aria-pressed', String(d === cameraDirection))
    );
  };
  bindSegmentedChoice($('camera-direction'), {
    getSelected: () => CAMERA_DIRECTIONS.indexOf(cameraDirection),
    onSelect: i => {
      cameraDirection = CAMERA_DIRECTIONS[i];
      savePreference('camera-direction', cameraDirection);
      syncDirection();
    }
  });
  syncDirection();
}
// The page opens where its link points: a project (and its section and picture), the portal, the teaser
// island, or the overview.
function openLinkedPlace(hash) {
  if (hash.kind === 'project') goTo(hash.index, false, true, 0, hash.zone, hash.image);
  else if (hash.kind === 'portal') openPortal(false, true);
  else if (hash.kind === 'teaser') inspectTeaser(false, true);
  else
    history.replaceState({ ...history.state, garden: 'overview' }, '', location.pathname + location.search);
}
// Audit: an opening review pose (chooseReviewPose) pins the camera there, on the route at its progress.
function applyReviewPose(pose) {
  animation = null;
  mode = 'journey';
  current = target = pose.progress;
  moving = false;
  pinnedPose = new THREE.Vector3(...pose.position);
  camera.position.copy(pinnedPose);
  look.set(...pose.look);
  updateProject(Math.floor(current));
}
// The audit hooks (window.__gardenDebug: state, metrics, free camera, shader snapshot, ...) and, with ?audit=1,
// read-only DOM diagnostics for the local preview and browser tooling. Called once from initialize.
function installAuditHooks() {
  window.__gardenDebug = {
    celebration: () => fireworks?.audit() ?? null,
    party: () => pavilionParty?.audit() ?? null,
    stage: () => celebrationStage?.audit() ?? null,
    // Audit only: switch the occasion live (the developer preview without a reload).
    celebrate: auditEnabled ? key => (switchCelebration(key), true) : undefined,
    skyLife: () => skyLife,
    get state() {
      return {
        mode,
        current,
        target,
        selected,
        zone,
        galleryImage,
        portalSelection,
        portalOpen: dialog.open,
        portalApproaching,
        portalTransit: !!portalTransit,
        freeLook,
        travelling: !!travel,
        travelLook: [travelLook.yaw, travelLook.pitch],
        lookAngles: [lookYaw, lookPitch],
        lookInput: lookTiming,
        waterFlow: world.flowOffset(),
        waterEffects: world.waterEffectsStatus(),
        celestial: {
          sun: world.backdrop.sun.position.toArray(),
          moon: world.backdrop.moon.position.toArray(),
          sunVisible: world.backdrop.sun.visible,
          moonVisible: world.backdrop.moon.visible
        },
        visitor: world.visitor.status(),
        velocity,
        seasonMode,
        season,
        winter,
        reduced,
        economy,
        timeMode,
        lightStyle,
        orbit: [orbitView.yaw, orbitView.pitch, orbitView.zoom],
        orbitPan: [orbitView.pan.x, orbitView.pan.y, orbitView.pan.z],
        walkOffset: mode === 'journey' ? transitPose(current).offset : 0,
        lighting: lastLighting,
        overviewClearance: mode === 'overview' ? world.pointClearance(camera.position) : null,
        animating: !!animation,
        cloudDrift: world.backdrop.cloudMaterial.uniforms.drift.value,
        moving,
        position: camera.position.toArray(),
        gaze: camera.quaternion.toArray(),
        lastFlightClearance: flightClearance(lastFlightClearance)
      };
    },
    // The adaptive resolution: its share, level, recent steps ([ms, share]) and whether it is judging frames.
    quality: () => ({
      scale: adaptiveScale,
      level: adaptive?.level ?? null,
      active: adaptiveActive(),
      autoQuality,
      pixelRatio: renderer.getPixelRatio(),
      steps: adaptiveLog.slice(),
      verdict: adaptive?.verdict ?? null
    }),
    // Audit only: every material's final shader text (shader-snapshot.mjs), to prove a shader move changed nothing.
    shaderSnapshot: auditEnabled ? () => shaderSnapshot(THREE, world.scene) : undefined,
    // Audit only: Ultra's corner shading on or off, to compare one frame with and without it.
    occlusion: auditEnabled
      ? on => {
          bloom?.setOcclusion(on);
          requestRender();
          return !!on;
        }
      : undefined,
    // Audit only: tune the Ultra sun shafts' look live (SUN_SHAFT_LOOKS fields); returns the look in use.
    shaftLook: auditEnabled
      ? (look = {}) => {
          Object.assign(ultraEffects.shaftLook, look);
          requestRender();
          return { ...ultraEffects.shaftLook };
        }
      : undefined,
    // Audit only: draw at a given share of the pixel ratio (to see what a step costs), applied at the next frame.
    setQualityScale: auditEnabled
      ? scale => {
          adaptivePending = scale;
          requestRender();
          return true;
        }
      : undefined,
    get metrics() {
      const scene = bloom?.sceneInfo || renderer.info.render;
      return {
        drawCalls: scene.calls,
        triangles: scene.triangles,
        glow: !!bloom?.enabled,
        textures: renderer.info.memory.textures,
        geometries: renderer.info.memory.geometries,
        pixelRatio: renderer.getPixelRatio(),
        resolution: [canvas.width, canvas.height],
        renderCount,
        timing: auditEnabled ? timingSnapshot() : undefined,
        frameProbe: renderer.gardenFrameProbe?.snapshot(),
        pointLights: world.activePointLights(),
        localLights: world.lightStatus(),
        practicals: world.practicalAudit(),
        projectAccents: projects.map(p => ({ id: p.id, color: p.accent })),
        projectTextures: world.mediaStatus.map(s => ({ id: s.id, texture: s.texture })),
        cloudInstances: world.backdrop.clouds.count
      };
    },
    auditRoute: () => world.routeAudit(p => vec(world.route.point(p, 0, 3.3))),
    auditSections: () => world.sectionAudit(),
    auditVisitor: () => world.visitor.audit(),
    localClock: date => lighting(world, 'auto', new Date(date), lightStyle),
    get projectIds() {
      return projects.map(p => p.id);
    },
    get anchors() {
      return world.route.anchors;
    },
    get routeLength() {
      return world.route.length;
    },
    auditGeometry: () => world.geometryAudit(),
    auditVegetation: () => world.vegetationAudit(),
    get portalGeometry() {
      return world.portalGeometry;
    },
    mediaBounds: () => mediaBounds(),
    get media() {
      return world.mediaStatus;
    },
    get filters() {
      return {
        current: filters,
        applied: appliedFilters,
        pending: !!pendingList,
        filteredOut: filteredOut?.id || null
      };
    },
    get relayout() {
      return relayout
        ? {
            phase: relayout.phase,
            clock: relayout.clock,
            plan: { glide: relayout.plan.glide, sink: relayout.plan.sink, rise: relayout.plan.rise },
            ride: relayout.ride
          }
        : null;
    },
    // Audit-only fixture: present a subset of the current islands as if the API had returned it.
    // Audit-only QA hooks: a free camera for close-ups, the live world, and a clean frame without the UI.
    setCamera: auditEnabled
      ? (position, target) => {
          animation = null;
          portalTransit = null;
          bloom?.setLens(null);
          camera.position.set(position[0], position[1], position[2]);
          look.set(target[0], target[1], target[2]);
          camera.lookAt(look);
          requestRender();
          return true;
        }
      : undefined,
    // Audit only: drive the overview orbit like input would - a drag (pixels), a zoom step toward a screen
    // point - or set it outright ({ yaw, pitch, zoom }), then settle it at once.
    orbit: auditEnabled
      ? ({ dx = 0, dy = 0, zoom = 0, at = null, set = null, settle = true } = {}) => {
          if (set) {
            Object.assign(orbitView.goal, set);
            orbitRange(orbitView, overviewHome());
          } else orbit(dx, dy, zoom, null, at);
          if (settle) orbitStep(orbitView, 1, true);
          // Unsettled, the frame loop eases the collision corrections as it would after real input.
          overviewFrame(settle ? undefined : 0);
          return {
            orbit: [orbitView.yaw, orbitView.pitch, orbitView.zoom],
            position: camera.position.toArray()
          };
        }
      : undefined,
    // Audit only: the double-click focus at a screen point (pixels); returns the new pivot goal.
    focusAt: auditEnabled
      ? (x, y) =>
          focusOverview(x, y) && {
            pan: { ...(orbitView.glide?.to.pan || orbitView.goal.pan) },
            distance: (orbitView.glide?.to.zoom ?? orbitView.goal.zoom) * overviewHome().dist,
            aim: overviewHome().aim.toArray()
          }
      : undefined,
    // Audit only: switch the glow pass to compare a frame with and without it.
    setBloom: auditEnabled
      ? value => {
          bloom?.setEnabled(!!value);
          requestRender();
          return !!bloom;
        }
      : undefined,
    get world() {
      return auditEnabled ? world : undefined;
    },
    get camera() {
      return auditEnabled ? camera : undefined;
    },
    hideUi: auditEnabled
      ? (on = true) => {
          let style = document.getElementById('audit-clean-style');
          if (!style) {
            style = document.createElement('style');
            style.id = 'audit-clean-style';
            style.textContent = '#garden-app.audit-clean>:not(#garden-scene){visibility:hidden!important}';
            document.head.append(style);
          }
          app.classList.toggle('audit-clean', !!on);
          requestRender();
          return true;
        }
      : undefined,
    simulateList: auditEnabled
      ? ids =>
          trialAssets.pineAsset
            ? false
            : applyList(ids.map(id => projects.find(p => p.id === id)).filter(Boolean))
      : undefined,
    relayoutStats,
    get islands() {
      const t = world.transitions;
      return {
        frames: t.frames,
        seeds: t.seeds,
        scenicPush: t.scenicPush,
        fieldExtent: t.fieldExtent,
        movable: t.movable,
        route: {
          count: world.route.count,
          segments: world.route.segments,
          closed: world.route.closed,
          radius: world.route.radius
        }
      };
    }
  };
  // Opt-in, read-only DOM diagnostics for the local preview and accessible browser tooling.
  if (auditEnabled) {
    const output = document.createElement('output');
    output.id = 'garden-audit';
    output.hidden = true;
    app.append(output);
    const gl = renderer.getContext(),
      debug = gl.getExtension('WEBGL_debug_renderer_info');
    output.dataset.renderer = debug
      ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER);
    startAuditTimer();
    output.dataset.fixtures = JSON.stringify(world.fixtureAudit());
    output.dataset.tree = JSON.stringify(world.treeAudit());
    output.dataset.display = JSON.stringify(world.displayAudit());
    output.dataset.capture = data.reviewPose?.kind || 'ordinary UI';
    output.dataset.route = JSON.stringify(window.__gardenDebug.auditRoute());
    output.dataset.geometry = JSON.stringify(window.__gardenDebug.auditGeometry());
    output.dataset.sections = JSON.stringify(world.sectionAudit());
    output.dataset.snow = JSON.stringify(world.snowAudit());
    output.dataset.landscape = JSON.stringify(world.backdrop.audit());
    output.dataset.grounding = JSON.stringify(world.groundingAudit());
    output.dataset.waterSurface = JSON.stringify(world.waterSurfaceAudit());
    output.dataset.vegetation = JSON.stringify(world.vegetationAudit());
  }
}
// Audit review poses: a point given in the first island's frame (x across, z along its pavilion axis).
function stationLocal() {
  const origin = world.route.radial(0, world.route.radius + 3.85, 0),
    angle = world.route.angle(0);
  return (x, y, z) => [
    origin.x + Math.cos(angle) * x + Math.sin(angle) * z,
    origin.y + y,
    origin.z - Math.sin(angle) * x + Math.cos(angle) * z
  ];
}
// Desktop overview: camera distance factor and how far (radians) the view lifts above the garden centre.
const OVERVIEW_DESKTOP = { reach: 1.06, lift: 0.07 };
// The per-frame pose lands in these (no allocation while the orbit moves); other callers get fresh vectors.
const overviewScratch = { position: new THREE.Vector3(), look: new THREE.Vector3() };
// dt (s) eases the orbit's collision corrections; without it they land at once (flight targets, a resize).
function overviewPose(dt, into = null) {
  const position = into ? into.position : new THREE.Vector3(),
    look = into ? into.look : new THREE.Vector3();
  // The observatory terrace: the camera stands at the railing where the visitor walked it (sky-island.mjs).
  if (scenicFocus?.lookAround && scenicFocus.terrace && world.skyIsland) {
    terracePose(world.skyIsland.view, scenicFocus.terrace, position, look);
    return { position, look };
  }
  orbitPose(overviewHome(), orbitView, position, look, {
    lands: overviewLands(),
    clearance: overviewClearance,
    dt
  });
  return into || { position, look };
}
// The default overview: where the orbit's yaw, pitch and zoom are measured from. The pivot may wander up to
// `extent` metres from `aim` when zoomed in (overview-orbit.mjs). Cached: the orbit asks for it every frame
// and on every input event; it only changes with the world, the screen shape or the scenic focus.
const homeCache = { world: null, focus: null, mobile: false, x: NaN, z: NaN, home: null };
function overviewHome() {
  const r = world.route.radius,
    phone = mobile(),
    c = homeCache;
  if (
    c.home &&
    c.world === world &&
    c.focus === scenicFocus &&
    c.mobile === phone &&
    c.r === r &&
    (!scenicFocus || (c.x === scenicFocus.position.x && c.z === scenicFocus.position.z))
  )
    return c.home;
  const base = scenicFocus
    ? scenicFocus.position.clone()
    : phone
      ? new THREE.Vector3(r * 2.5, r * 2.8, r * 3.8)
      : new THREE.Vector3(r * 2.15, r * 1.62, r * 2.65).multiplyScalar(OVERVIEW_DESKTOP.reach);
  const aim = scenicFocus ? scenicFocus.center.clone() : new THREE.Vector3(0, 1.3, 0),
    spherical = new THREE.Spherical().setFromVector3(base.sub(aim));
  // Phones and desktops look down on the garden at the same angle at most; the station fits above it.
  c.home = {
    aim,
    theta: spherical.theta,
    phi: scenicFocus ? spherical.phi : Math.min(spherical.phi, 1.13),
    dist: spherical.radius,
    // Desktop frames are wide and short: the view lifts a little (the camera stays put) so the balloon
    // station and its docked envelopes fit above the far pavilion. Phones are tall enough without it.
    lift: scenicFocus || phone ? 0 : OVERVIEW_DESKTOP.lift,
    // Zoomed in, the pivot may reach every island's far rim (a tree on the edge can be inspected too).
    extent: scenicFocus ? 8 : r + 24
  };
  Object.assign(c, { world, focus: scenicFocus, mobile: phone, r });
  c.x = scenicFocus?.position.x;
  c.z = scenicFocus?.position.z;
  return c.home;
}
// Footprints the overview eye glides over (and a zoom can aim at): every project island, the central one and
// the bridge decks as a chain of small discs, so a close look never sinks through a deck.
const DECK_DISC = { radius: 2.6, step: 0.125 };
let landCache = null;
function overviewLands() {
  if (landCache?.world === world) return landCache.lands;
  const lands = (world.transitions?.shapes || []).filter(Boolean).map(s => ({ ...s })),
    route = world.route,
    disc = p => ({ x: p.x, y: p.y, z: p.z, radius: DECK_DISC.radius, stretch: 1, rotation: 0 });
  lands.push({ x: 0, y: 0, z: 0, radius: 7.8, stretch: 1, rotation: 0 });
  if (route.count) {
    for (let p = 0; p <= route.segments + 1e-9; p += DECK_DISC.step) lands.push(disc(route.point(p, 0, 0)));
    for (let t = 0.2; t <= 1 + 1e-9; t += 0.1) lands.push(disc(route.spoke(t)));
  }
  landCache = { world, lands };
  return lands;
}
// Trees, halls, rails and the sky island keep the overview eye at a distance: a continuous distance field
// (camera-clearance.mjs buckets the world's obstacle boxes and rails; the sky island is a soft cylinder), so
// the arm slides along an obstacle instead of stepping when it meets one.
const SKY_SOLID = { radius: 9.5, above: 4, below: 12 };
let clearanceGrid = null;
function overviewClearance(p) {
  if (clearanceGrid?.world !== world)
    clearanceGrid = { world, grid: world.obstacleField ? createClearanceGrid(world.obstacleField) : null };
  let clear = clearanceGrid.grid ? clearanceGrid.grid.clearance(p) : world.pointClearance(p);
  const sky = world.skyIsland?.view;
  if (sky) {
    const out = Math.max(0, Math.hypot(p.x - sky.island.x, p.z - sky.island.z) - SKY_SOLID.radius),
      up = Math.max(0, sky.deck - SKY_SOLID.below - p.y, p.y - sky.deck - SKY_SOLID.above);
    clear = Math.min(clear, Math.hypot(out, up));
  }
  return clear;
}
// The point under a screen position (pixels) on the garden, for zooming toward it: the first solid thing on
// the view ray (a crown, a hall) when it is nearer than the lawn behind it.
const focusRay = new THREE.Raycaster(),
  focusPointer = new THREE.Vector2(),
  focusHit = { x: 0, y: 0, z: 0 };
function overviewRay(at) {
  focusPointer.set((at.x / viewport.width) * 2 - 1, (-at.y / viewport.height) * 2 + 1);
  camera.updateMatrixWorld();
  focusRay.setFromCamera(focusPointer, camera);
  return focusRay.ray;
}
function overviewFocus(at) {
  if (!at) return null;
  const ray = overviewRay(at),
    home = overviewHome(),
    lawn = rayFocus(ray.origin, ray.direction, overviewLands(), home.aim.y, home.dist * 3),
    reach = lawn ? ray.origin.distanceTo(lawn) : home.dist * 1.5,
    solid = traceSurface(ray.origin, ray.direction, overviewClearance, reach, focusHit);
  if (!solid) return lawn;
  return {
    x: ray.origin.x + ray.direction.x * solid.entry,
    y: ray.origin.y + ray.direction.y * solid.entry,
    z: ray.origin.z + ray.direction.z * solid.entry
  };
}
// Double-click / double-tap in the overview: the thing under the pointer becomes the pivot, seen from a few
// metres, so it can be turned round and looked at from every side (Home, Escape or Overview go back).
function focusOverview(x, y) {
  if (mode !== 'overview' || scenicFocus || relayout || ride || animation || portalTransit) return false;
  const ray = overviewRay({ x, y }),
    home = overviewHome(),
    lawn = rayFocus(ray.origin, ray.direction, overviewLands(), home.aim.y, home.dist * 3),
    reach = lawn ? ray.origin.distanceTo(lawn) : home.dist * 1.5,
    solid = traceSurface(ray.origin, ray.direction, overviewClearance, reach, focusHit);
  const point = solid ? { x: solid.x, y: solid.y, z: solid.z } : lawn && { ...lawn, y: lawn.y + 1.2 },
    distance = solid
      ? THREE.MathUtils.clamp(solid.depth / 2 + 3.5, ORBIT.inspect.near, ORBIT.inspect.far)
      : ORBIT.inspect.far;
  if (!point) return false;
  orbitRange(orbitView, home);
  if (!orbitFocus(orbitView, point, distance, home)) return false;
  app.classList.add('is-exploring');
  cameraUserMotion = true;
  stirCamera();
  if (reduced) {
    orbitStep(orbitView, 0, true);
    overviewFrame();
  }
  requestRender();
  return true;
}
// Each frame in the overview: ease the orbit, place the camera, and fade out of a flight a drag took over.
// Without dt (a resize, an instant reset) the collision corrections land at once.
function overviewFrame(dt) {
  const pose = overviewPose(reduced ? undefined : dt, overviewScratch);
  if (overviewBlend) {
    overviewBlend.elapsed += (dt || 0) * 1000;
    const b = 1 - smooth(Math.min(1, overviewBlend.elapsed / 380));
    pose.position.lerp(overviewBlend.position, b);
    pose.look.lerp(overviewBlend.look, b);
    if (b === 0) overviewBlend = null;
  }
  camera.position.copy(pose.position);
  look.copy(pose.look);
}
// Clean overview (owner, M18): while the visitor turns or zooms the overview, the intro, announcements and
// footer fade away (garden-ui-panels.css, .is-camera-moving) and return once the camera has been still a moment.
// Frames only push a deadline forward (control-strip.mjs createStirWatch), so a long drag allocates nothing.
// Share of the frame interval the accumulated tick time must reach before the next render (see render()); the
// slack absorbs jittery ticks. paceDebt: tick time owed since the last render, paceTick: the last tick seen.
const FRAME_PACE = 0.9;
let paceDebt = 0,
  paceTick = 0;
const CAMERA_CALM_MS = 600,
  // rad/s below which a coasting flick counts as resting.
  CAMERA_STIR_SPIN = 0.25;
let cameraUserMotion = false;
const cameraStir = createStirWatch(on => app.classList.toggle('is-camera-moving', on), CAMERA_CALM_MS);
const stirCamera = () => cameraStir.stir();
function calmCamera() {
  cameraUserMotion = false;
  cameraStir.settle();
}
function stepOverview(dt) {
  if (
    mode !== 'overview' ||
    animation ||
    portalTransit ||
    relayout ||
    ride ||
    scenicFocus?.terrace ||
    scenicFocus?.remoteDock ||
    scenicFocus?.remoteHold
  )
    return false;
  // With reduced motion one step lands on the goal and reports rest, so the pose is placed whenever the step moved
  // the view, not only while it eases. Owner, 2026-10-31: with the phone's battery saver on (it turns on reduced
  // motion) the overview no longer turned: each drag moved the goal, but the camera stayed put.
  const { yaw, pitch, zoom } = orbitView,
    { x, y, z } = orbitView.pan;
  // The collision corrections may still be settling after the orbit itself has come to rest.
  const moving = orbitStep(orbitView, dt, reduced) || orbitView.rig.moving;
  const landed =
    yaw !== orbitView.yaw ||
    pitch !== orbitView.pitch ||
    zoom !== orbitView.zoom ||
    x !== orbitView.pan.x ||
    y !== orbitView.pan.y ||
    z !== orbitView.pan.z;
  // A visitor's turn keeps the clean view through its easing and coasting; a reset never hides the UI. The
  // last slow creep of a flick already reads as still, so the interface returns before it ends.
  if (cameraUserMotion) {
    const spin = Math.hypot(orbitView.spin.yaw, orbitView.spin.pitch);
    if (!moving) cameraUserMotion = false;
    else if (!spin || spin > CAMERA_STIR_SPIN) stirCamera();
  }
  if (!moving && !overviewBlend && !landed) return false;
  overviewFrame(dt);
  return moving || !!overviewBlend;
}
// Islands present: station travel uses the existing bridges only (open arc, single spoke, none).
const routeIndex = (index, direction = 0) => routeTarget(world.route, index, current, direction);
// Observatory terrace input: a turn round the rim, a tilt and a lens change, eased in by settleTerrace().
function lookFromTerrace(input) {
  if (relayout || ride || !scenicFocus?.terrace) return;
  terraceInput(scenicFocus.terrace, input);
  requestRender();
}
function settleTerrace(dt) {
  const view = world.skyIsland?.view,
    state = scenicFocus.terrace;
  if (!view) return false;
  const moving = terraceStep(state, reduced ? Infinity : dt);
  terracePose(view, state, camera.position, look);
  // The overview lens for this screen, narrowed like a telescope; leaving the terrace restores it (updateMode).
  updateCameraProjection();
  if (state.zoom !== 1) {
    camera.fov *= state.zoom;
    camera.updateProjectionMatrix();
  }
  return moving;
}
// Telescope mode: on the terrace every island wears its numbered name tag; clicking one flies there. The order
// chooser's own tags take precedence while it is open.
function syncSkyTags() {
  const wanted =
    !!(scenicFocus?.terrace && !ride && !relayout && projects.length) && $('arrange-panel').hidden;
  if (wanted && showcase && !showcase.active) {
    showcase.showOrder(world, projects, '', { pin: false });
    skyTags = true;
    app.classList.add('is-sky-tags');
  } else if (!wanted && skyTags) {
    skyTags = false;
    app.classList.remove('is-sky-tags');
    if ($('arrange-panel').hidden) showcase?.hideOrder();
  }
}
function flyFromTag(event) {
  const tag = event.target.closest?.('.island-tag');
  if (!tag || !skyTags || ride || relayout) return;
  goTo(Number(tag.dataset.index));
}
// Overview input: a drag (dx, dy pixels), a zoom step (garden units, + is out) toward the screen point `at`,
// or a pinch's finger-distance ratio (lens). `time` dates the drag for a flick's coasting spin.
function orbit(dx = 0, dy = 0, zoom = 0, lens = null, at = null, time = 0) {
  // Standing in the tour balloon's basket a drag looks round; everything else waits for the ride.
  if (ride === 'sky-tour' && animation?.pose && !animation.remoteTransit)
    return void world.skyIsland.tourLook(dx / viewport.width, dy / viewport.height);
  if (relayout || ride) return;
  if (scenicFocus?.remoteDock || scenicFocus?.remoteHold) {
    const view = new THREE.Spherical().setFromVector3(look.clone().sub(camera.position));
    view.theta -= dx * 0.0055;
    view.phi = THREE.MathUtils.clamp(view.phi + dy * 0.0042, 0.1, 3.04);
    look.copy(camera.position).add(new THREE.Vector3().setFromSpherical(view));
    requestRender();
    return;
  }
  // On the terrace a sideways drag walks round the rim (grab-the-world, like a street panorama), a drag up looks
  // down, and the wheel, +/- or a pinch (lens: the finger-distance ratio) work the telescope.
  if (scenicFocus?.terrace) {
    lookFromTerrace({
      turn: (dx / viewport.width) * TERRACE.lap,
      tilt: (-dy / viewport.height) * TERRACE.pitch,
      zoom: lens ?? Math.exp(zoom * TERRACE.wheel)
    });
    return;
  }
  if (mode !== 'overview') return;
  if (dx || dy || zoom || lens) {
    app.classList.add('is-exploring');
    cameraUserMotion = true;
    stirCamera();
  }
  // A drag during the flight into the overview takes over from where the camera is, without a jump.
  if (animation && !animation.pose) {
    const done = animation.done;
    animation = null;
    overviewBlend = { position: camera.position.clone(), look: look.clone(), elapsed: 0 };
    done?.();
  }
  const home = overviewHome();
  orbitRange(orbitView, home);
  if (dx || dy) orbitTurn(orbitView, dx, dy, time);
  const factor = lens ?? Math.exp(zoom * ORBIT.zoomRate);
  if (factor !== 1) orbitZoom(orbitView, factor, factor < 1 ? overviewFocus(at) : null, home);
  requestRender();
}
function beginWalk() {
  journeyArrival = null;
  const center = vec(world.route.point(current, 0, 3.3)),
    normal = world.route.normal(current);
  walkStart = current;
  walkOffset = THREE.MathUtils.clamp(
    (camera.position.x - center.x) * normal.x + (camera.position.z - center.z) * normal.z,
    -4.8,
    HALL.station.wide + 0.2
  );
}
function transitPose(progress) {
  const offset = transitOffset(progress, walkStart, walkOffset, target, inspectionOffset(), lateralReach);
  // A trip crests each bridge a little higher than the deck walk (none at the pavilions themselves).
  const arc = travel ? bridgeArc(progress) : 0;
  return { position: vec(world.route.point(progress, offset, 3.3 + arc)), offset };
}
function stationPose(index) {
  const fraction = wrapped(index, 1),
    distance = Math.min(fraction, 1 - fraction),
    influence = 1 - smooth(Math.min(1, distance / 0.22));
  const position = vec(world.route.point(index, inspectionOffset(index) * influence, 3.3));
  const lookAt = world.screenTarget(index);
  // Explicit selection aims at the real stand centre for every aspect ratio.
  return { position, look: lookAt };
}
// Stand back far enough to see the whole gate, its dais and some island; on desktop the projection's view
// offset (updateCameraProjection) already sets the gate left of the chooser, on portrait phones it sits a bit high.
function portalPose() {
  // lift: on a portrait phone the gate rides up into the free sky above the chooser's bottom sheet.
  const PORTAL_VIEW = { wide: 7.6, tall: 8.4, eye: 3.75, lift: 0.2 },
    a = world.route.spoke(1),
    length = Math.hypot(a.x, a.z),
    nx = a.x / length,
    nz = a.z / length,
    center = vec(world.portalGeometry.center),
    aspect = camera.aspect || 1,
    portrait = aspect < 1,
    distance = portrait ? PORTAL_VIEW.tall : PORTAL_VIEW.wide,
    // Half the view height at the gate, for the portal-mode field of view (76 phone, 66 desktop).
    halfHeight = distance * Math.tan(THREE.MathUtils.degToRad((portrait ? 76 : 66) / 2)),
    drop = portrait ? PORTAL_VIEW.lift * halfHeight : 0;
  return {
    position: new THREE.Vector3(center.x + nx * distance, PORTAL_VIEW.eye, center.z + nz * distance),
    look: center.add(new THREE.Vector3(0, -drop, 0))
  };
}
function resetTransit() {
  soundController?.stopPortal();
  ride = null;
  journeyArrival = null;
  travel = null;
  travelLook.yaw = travelLook.pitch = 0;
  pinnedPose = null;
  overviewBlend = null;
  portalTransit = null;
  bloom?.setLens(null);
  portalApproaching = false;
  velocity = 0;
  $('portal-fade').style.opacity = '0';
  if (magicFx) {
    magicFx.setTunnel(0, 0);
    magicFx.surgeTarget = 0;
  }
}
// Some visible Chromium windows deliver rAF only once a second. Keep one pending
// rAF and a bounded 30 Hz fallback; native rAF takes over as soon as it responds.
function runtimeAvailable() {
  return !document.hidden && !contextLost && !pageSuspended && !alive.disposed;
}
function cancelRenderWork() {
  frameGeneration++;
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  clearTimeout(waterTimer);
  clearTimeout(frameWatchdog);
  waterTimer = frameWatchdog = 0;
  lastFrame = 0;
}
function suspendRuntime() {
  runtimeGeneration++;
  cancelRenderWork();
  clearTimeout(clockTimer);
  clearInterval(auditTimer);
  clockTimer = auditTimer = 0;
  orbitHold(orbitView, false);
  travelLook.holding = false;
  world.visitor.suspend();
  frameTiming.previousCallback = frameTiming.timerAt = 0;
}
function startAuditTimer() {
  if (!auditEnabled || auditTimer || !runtimeAvailable()) return;
  const output = $('garden-audit');
  if (!output) return;
  const generation = runtimeGeneration,
    timer = setInterval(() => {
      if (generation !== runtimeGeneration || auditTimer !== timer) return;
      if (!runtimeAvailable()) {
        clearInterval(timer);
        auditTimer = 0;
        return;
      }
      const now = performance.now();
      frameTiming.timerGapMs = frameTiming.timerAt ? now - frameTiming.timerAt : 0;
      frameTiming.timerAt = now;
      output.dataset.timing = JSON.stringify(timingSnapshot());
      output.dataset.resources = JSON.stringify(
        (performance.getEntriesByType?.('resource') || [])
          .filter(r => r.name.includes('/garden/assets/'))
          .map(r => ({
            name: r.name.split('/garden/')[1],
            transferSize: r.transferSize,
            encodedBodySize: r.encodedBodySize,
            decodedBodySize: r.decodedBodySize,
            duration: r.duration
          }))
      );
    }, 250);
  auditTimer = timer;
}
function resumeRuntime() {
  if (!runtimeAvailable()) return;
  lastFrame = 0;
  world.visitor.suspend();
  if (timeMode === 'auto') setLighting();
  if (seasonMode === 'auto') applySeason();
  scheduleClock();
  startAuditTimer();
  requestRender();
}
function handlePageHide(event) {
  pageSuspended = true;
  const dispose = !event.persisted && !alive.disposed;
  if (dispose) alive.disposed = true;
  suspendRuntime();
  if (dispose) {
    world.dispose();
    renderer.gardenFrameProbe?.dispose();
    renderer.dispose();
  }
}
function handlePageShow(event) {
  if (event.persisted) {
    pageSuspended = false;
    resumeRuntime();
  }
}
function requestRender() {
  if (frame || !runtimeAvailable()) return;
  const requestedAt = performance.now(),
    generation = frameGeneration;
  // A break in the drawing (DRAW_BREAK) cut short does nothing: the request waits for its end.
  if (requestedAt < drawBreakUntil) {
    clearTimeout(waterTimer);
    waterTimer = setTimeout(requestRender, drawBreakUntil - requestedAt + 1);
    return;
  }
  if (auditEnabled) frameTiming.requestedAt = requestedAt;
  frame = requestAnimationFrame(now => {
    if (generation !== frameGeneration || !runtimeAvailable()) return;
    clearTimeout(frameWatchdog);
    frameWatchdog = 0;
    if (performance.now() - requestedAt > 120) {
      rafStarved = true;
      rafRecovery = 0;
    } else if (++rafRecovery >= 3) rafStarved = false;
    render(now, 'raf');
  });
  frameWatchdog = setTimeout(
    () => {
      if (generation !== frameGeneration) return;
      frameWatchdog = 0;
      if (!frame || !runtimeAvailable() || !document.hasFocus()) return;
      frameGeneration++;
      cancelAnimationFrame(frame);
      frame = 0;
      rafStarved = true;
      rafRecovery = 0;
      render(performance.now(), 'timer');
    },
    rafStarved ? 1000 / 30 : 180
  );
}
let firstFrame = false;
// Owner, round 17: the garden took about 7 s to load. Its controls were bound after 2 s, but the first frame then
// compiled every shader one after another (some 7 s on this PC, the page frozen and the loader stuck). The shaders
// now compile in parallel off the main thread (KHR_parallel_shader_compile via compileAsync, as for a rearranged
// garden) with the loader up and turning; the first frame waits for them. A failure or a driver slower than
// BOOT_SHADER_WAIT only falls back to compiling in the first frame, as before.
const BOOT_SHADER_WAIT = 20000;
let shadersPending = false;
function compileBootShaders() {
  shadersPending = true;
  let compiling;
  try {
    // The portal crossing's lens too: first drawn mid-crossing, it was compiled at the jump (round 22).
    compiling = Promise.all([compileScene(world.scene), bloom?.compileLens()]);
  } catch (error) {
    compiling = Promise.reject(error);
  }
  Promise.race([compiling, new Promise(ok => setTimeout(ok, BOOT_SHADER_WAIT))])
    .catch(error => console.warn('Shaders could not be prepared ahead', error))
    .finally(() => {
      if (alive.disposed) return;
      shadersPending = false;
      loadMark('shaders');
      requestRender();
      // The first frame still takes a second or so (the driver's first use of each program, the geometry's first
      // upload); it is drawn under the loader, which turns on the compositor meanwhile. A page that cannot draw yet
      // (hidden tab) still gets its controls.
      setTimeout(revealGarden, BOOT_REVEAL_WAIT);
    });
}
const BOOT_REVEAL_WAIT = 5000;
// Round 22: the first «Войти в сад» froze the garden for 0.3 s (0.14 s with the browser's caches warm from an earlier
// visit). The rune portal it opens is 28 kinds of gradient and glow the browser had not drawn yet, and it prepared
// them on the GPU process's main thread, which the garden's frames wait for. The portal is drawn once while the
// loader is up (over it, all but invisible, inert), so they are ready before the first click.
const PORTAL_PREWARM = { frames: 4, fallback: 1500 };
function prewarmPortalPaint() {
  const portal = /** @type {HTMLDialogElement} */ (dialog);
  if (portal.open || !portalStrip) return;
  const focused = document.activeElement;
  let frames = 0,
    done = false;
  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(fallback);
    if (dialog.classList.contains('is-prewarm')) {
      portal.close();
      dialog.classList.remove('is-prewarm');
      dialog.inert = false;
    }
    if (focused instanceof HTMLElement && document.activeElement !== focused)
      focused.focus({ preventScroll: true });
  };
  const step = () => {
    if (done) return;
    if (++frames < PORTAL_PREWARM.frames && !alive.disposed && app.dataset.ready !== 'true')
      requestAnimationFrame(step);
    else finish();
  };
  // A hidden tab draws nothing: the portal closes after a while all the same.
  const fallback = setTimeout(finish, PORTAL_PREWARM.fallback);
  dialog.classList.add('is-prewarm');
  dialog.inert = true;
  portal.show();
  portalStrip.layout();
  portalStrip.sync();
  requestAnimationFrame(step);
}
function revealGarden() {
  if (alive.disposed || app.dataset.ready === 'true') return;
  $('loader').hidden = true;
  app.dataset.ready = 'true';
  loadMark('ready');
  adaptiveFrom = performance.now() + 2500;
}
function adaptiveActive() {
  return !!adaptive && autoQuality && !bench && !relayout && performance.now() >= adaptiveFrom;
}
// The highest pixel ratio the chosen graphics level draws at (drawRatio below says why these).
function levelRatioCap() {
  if (graphics === 'ultra') return handheld ? 2 : 2.5;
  if (graphics === 'high') return handheld ? 1.3 : 1.65;
  return 0.9;
}
// The device's pixel ratio for the chosen graphics quality, times the adaptive share (never below its floor). Medium
// draws at 0.9 with FXAA (phones are recommended medium): owner, 2026-10-31, the Realme 11 Pro+ (Mali-G68) ran the
// overview at about 30 fps at the former phone ratio of 1.35 and 35 at 1.1 with MSAA; 55 at 0.9 with FXAA. High on
// a phone draws at up to 1.3 with FXAA, still twice medium's pixels: the Realme ran it at 47 fps (2026-11-01; 23 at
// the former 1.65 with MSAA) and the adaptive share settles at 1.04 and 58 fps; the owner's iPhone 16 Pro Max holds
// 55 (DRAW_BREAK). Ultra draws at up to 2 on a phone: the owner's iPhone ran it at 17 fps at 2.5 (2026-10-31), 28 at
// 1.65.
function drawRatio() {
  const base = economy ? Math.min(devicePixelRatio, 1) * 0.75 : Math.min(devicePixelRatio, levelRatioCap());
  return adaptiveScale < 1 ? Math.min(base, Math.max(ADAPTIVE_RESOLUTION.floor, base * adaptiveScale)) : base;
}
// A new share is applied just before a frame is drawn: a resized canvas is blank until it is drawn again.
function applyAdaptiveScale() {
  if (adaptivePending === null) return;
  adaptiveScale = adaptivePending;
  adaptivePending = null;
  sizeCanvas();
  bloom?.setSize(viewport.width, viewport.height, renderer.getPixelRatio());
  adaptiveLog.push([Math.round(performance.now()), adaptiveScale]);
  if (adaptiveLog.length > 24) adaptiveLog.shift();
  updateQuality();
}
function render(now, source = 'raf') {
  if (!runtimeAvailable()) return;
  // Until the boot shaders are ready nothing is drawn; the frame request is let go, so the next one can run.
  if (shadersPending) {
    frame = 0;
    return;
  }
  const cpuStart = auditEnabled || perfHud || bench || adaptive ? performance.now() : 0;
  if (auditEnabled) noteFrameStart(now, source, cpuStart);
  frame = 0;
  // A benchmark run renders every display frame (no 60/30 fps cap) to measure what the device can do.
  // At rest the portal, water, balloons and birds still move: at 30 fps they stepped visibly, smoothing out only
  // under a hover or a drag (round 4). Phones rest at 60 too: owner, 2026-10-31, the Realme's water and balloons
  // looked choppy next to a desktop because they ran at 30 between touches. Economy keeps 30 for the battery.
  const interval = bench ? 0 : economy ? 1000 / 30 : 1000 / 60;
  // The cap keeps an average rather than a gap per frame: the time of every display tick adds to paceDebt, a render
  // is due once the debt reaches FRAME_PACE of the interval, and the remainder carries over (at most half an
  // interval, so a stall is not paid back with a burst). 60 Hz screens render every tick, 120 Hz every second, 90 Hz
  // two ticks of three and 144 Hz about one of 2.4: 60 fps on each. The former nearest-tick rule gave 45 fps on 90 Hz
  // (owner's Realme 11 Pro+, 2026-10-31: 11.1 ms ticks fell just short of 0.7 of 16.7 ms) and 72 on 144 Hz.
  if (!lastFrame) paceDebt = 0;
  else if (interval) {
    paceDebt += now - (paceTick || lastFrame);
    paceTick = now;
    if (paceDebt < interval * FRAME_PACE) {
      requestRender();
      return;
    }
    paceDebt = Math.min(paceDebt - interval, interval / 2);
  }
  paceTick = now;
  renderCount++;
  const dt = cameraDelta(now, lastFrame),
    sinceLast = lastFrame ? now - lastFrame : 0;
  lastFrame = now;
  applyAdaptiveScale();
  firstFrameAt ||= performance.now();
  if (auditEnabled && lookTiming.pendingAt) {
    lookTiming.frames.push(performance.now() - lookTiming.pendingAt);
    if (lookTiming.frames.length > 128) lookTiming.frames.shift();
    lookTiming.pendingAt = 0;
  }
  if (relayout) {
    try {
      stepRelayout(now);
    } catch (error) {
      abortRelayout(error);
    }
  } else if (pendingList) maybeStartDeferred();
  updateCamera(now, dt);
  const hallsMoving = drawScene(now, dt);
  // How late this frame came and how long the main thread spent on its updates before the draw: a slow CPU (round
  // 22: a phone at a quarter speed) is not helped by fewer pixels (adaptive-resolution.mjs). The draw is left out:
  // handing it over waits for a GPU that is behind, which fewer pixels do help (owner's Realme 11 Pro+, 2026-11-01:
  // 10 ms a frame at medium, 13 at high at ×1.3, 17 at ×1.65 with MSAA).
  if (adaptiveActive() && !idleTick) {
    const next = adaptive.frame(now, sinceLast, interval, drawStart - cpuStart);
    if (next !== null) adaptivePending = next;
  }
  idleTick = false;
  bench?.sample(now, performance.now() - cpuStart, bloom?.sceneInfo || renderer.info.render);
  perfHud?.tick(
    now,
    performance.now() - cpuStart,
    bloom?.sceneInfo || renderer.info.render,
    renderer.getPixelRatio(),
    !!bloom?.enabled
  );
  if (relayout) {
    try {
      afterRelayoutRender();
    } catch (error) {
      abortRelayout(error);
    }
  }
  if (auditEnabled) noteFrameEnd(source, cpuStart);
  writeDomAudit();
  if (wantsNextFrame(hallsMoving)) requestRender();
  else if (!reduced && !economy) scheduleIdleFrame();
}
// Audit: when this frame's callback came, how long after it was asked for, and by what (raf or the timer).
function noteFrameStart(now, source, cpuStart) {
  frameTiming.source = source;
  if (source === 'timer') frameTiming.fallbackFrames++;
  frameTiming.callbacks++;
  frameTiming.callbackGapMs = frameTiming.previousCallback ? now - frameTiming.previousCallback : 0;
  frameTiming.previousCallback = now;
  frameTiming.requestWaitMs = cpuStart - frameTiming.requestedAt;
}
// Audit: the main thread's time for this frame, kept with the last 16 frames' timing.
function noteFrameEnd(source, cpuStart) {
  frameTiming.cpuMs = performance.now() - cpuStart;
  frameTiming.samples.push([
    Math.round(frameTiming.callbackGapMs),
    Math.round(frameTiming.requestWaitMs),
    Math.round(frameTiming.cpuMs),
    source
  ]);
  if (frameTiming.samples.length > 16) frameTiming.samples.shift();
}
// The read-only DOM diagnostics (?audit=1, garden-audit): tree, state, metrics, media and the stand on screen.
function writeDomAudit() {
  const audit = $('garden-audit');
  if (audit) {
    audit.textContent = JSON.stringify({
      tree: world.treeAudit(),
      state: window.__gardenDebug.state,
      metrics: window.__gardenDebug.metrics
    });
    audit.dataset.media = JSON.stringify(world.mediaStatus);
    audit.dataset.projectedStand = JSON.stringify(
      world.screenBounds(selected, camera, viewport.width, viewport.height)
    );
  }
}
// Whether something is still moving (a flight or crossing, a fade, the orbit, halls, effects, a run, a
// rearrangement, a waiting list, a trip), so the next frame is wanted at once.
function wantsNextFrame(hallsMoving) {
  return (
    animation ||
    portalTransit ||
    lightFade ||
    orbitView.active ||
    overviewBlend ||
    travelLook.yaw ||
    travelLook.pitch ||
    hallsMoving ||
    perfHud ||
    bench ||
    relayout ||
    magicFx?.active() ||
    showcase?.active ||
    (pendingList &&
      !(scenicFocus?.remoteDock || scenicFocus?.remoteHold) &&
      !ride &&
      (!filteredOut || mode !== 'journey')) ||
    (mode === 'journey' && travelStep(travel, current, target, moving) !== 'idle')
  );
}
// At rest: a steady frame while walkers, birds, a balloon, snow or the portal move; otherwise the water ticks
// every 85 ms.
// Owner's iPhone 16 Pro Max, 2026-11-01: after 20 s of unbroken drawing the page falls from 55 to 30 fps and stays
// there, at any load (a cap of 30 fps falls just the same) and any WebGL setting; a page that draws only the sky is
// spared, and so is a bare page of the same GPU load. A break of 0.2 s in the drawing gives the 55 back for another
// 20 s, and 0.1 s does not. So with nothing moving under the visitor's hand the garden takes that break now and then:
// the slow things in the air stand still for a dozen frames, against twice the frames the rest of the time.
const DRAW_BREAK = { every: 17000, ms: 220 };
// A touch or a key does not wait for it: the break ends there, lost for this round.
for (const type of ['pointerdown', 'keydown']) addEventListener(type, () => (drawBreakUntil = 0), true);
function scheduleIdleFrame() {
  clearTimeout(waterTimer);
  if (appleTouch && performance.now() - drawBreakAt >= DRAW_BREAK.every) {
    drawBreakAt = performance.now();
    drawBreakUntil = drawBreakAt + DRAW_BREAK.ms;
    idleTick = true;
    requestRender();
    return;
  }
  // Falling snow needs a steady frame rate; the 85 ms water tick would make it stutter.
  if (
    world.visitor.needsAnimation(camera) ||
    skyLife?.needsAnimation(camera) ||
    world.skyIsland?.moving ||
    world.snowfall?.visible ||
    world.portalNeedsAnimation?.(camera.position)
  )
    requestRender();
  else {
    idleTick = true;
    waterTimer = setTimeout(requestRender, 85);
  }
}
// One frame's camera: the benchmark route, a crossing, a trip, the overview orbit or the terrace, by mode.
function updateCamera(now, dt) {
  // A benchmark run owns the camera (garden-bench.mjs: a fixed scripted route).
  if (bench) bench.pose(now, camera.position, look);
  else if (portalTransit) stepPortalTransit(now);
  else if (animation) stepCameraAnimation(now);
  else if (mode === 'journey' && travelStep(travel, current, target, moving) !== 'idle') {
    // The trip runs to the end of its own clock: stopping it once it was "close enough" left the walk
    // short of the stand, still moving, with the card closed until "skip" (owner bug, 2026-10-25).
    if (travelStep(travel, current, target, moving) === 'travel') stepTravel(now, dt);
    else arriveTravel();
  } else if (stepOverview(dt)) requestRender();
  // A glance aside while travelling drifts back to the path once the finger lets go.
  if (!travelLook.holding && (travelLook.yaw || travelLook.pitch)) {
    const decay = reduced ? 0 : Math.exp(-dt * FREE_LOOK.back);
    travelLook.yaw *= decay;
    travelLook.pitch *= decay;
    if (Math.abs(travelLook.yaw) + Math.abs(travelLook.pitch) < 0.002) travelLook.yaw = travelLook.pitch = 0;
  }
  // Observatory terrace: ease the camera round the rim towards where the visitor dragged it.
  if (scenicFocus?.terrace && !animation && !portalTransit && settleTerrace(dt)) requestRender();
  if (lightFade) stepLightFade(now);
  syncSkyTags();
  if (showcase?.active) showcase.tick(now, camera, viewport.width, viewport.height, magicFx);
}
// One frame of a portal crossing: in along the entry curve, the jump at .55 under a flash (or the black hole
// when the glow is on), out along the exit curve; at the end the camera is in the overview or at the stand.
function stepPortalTransit(now) {
  const transit = portalTransit;
  transit.duration ??= crossingDuration();
  const t = tweenProgress(transit, now);
  if (t < 0.55) {
    const s = smooth(t / 0.55);
    camera.position.copy(transit.entry.getPoint(s));
    look.copy(transit.fromLook).lerp(transit.entryLook, s);
  } else {
    const s = smooth((t - 0.55) / 0.45);
    camera.position.copy(transit.exit.getPoint(s));
    look.copy(transit.pose.look);
  }
  // A light tunnel closes in from the edges, a flash covers the jump at .55, the tunnel opens on arrival.
  const trip = portalTripShape(t),
    fx = transit.fx,
    // With the glow composer on, a black hole swallows the view instead of the white flash (black-hole-lens).
    lensed = applyPortalLens(transit, t, now),
    flash = lensed ? trip.flash * 0.2 : trip.flash;
  fx.setTunnel(trip.tunnel, flash);
  fx.surgeTarget = trip.surge;
  if (t >= 0.6 && !transit.arrived) {
    transit.arrived = true;
    const a = transit.arrival;
    fx.ripple(a.x, a.y, a.z, a.radius, 1.25);
    fx.burst(a.x, a.y, a.z, 70, { radius: a.radius * 0.55, speed: 1.5, up: 2.4 });
  }
  $('portal-fade').style.opacity = String(flash * 0.35);
  if (t === 1) {
    bloom?.setLens(null);
    fx.setTunnel(0, 0);
    fx.surgeTarget = 0;
    world.setPortalTint?.(null);
    world.setPortalPreview?.(null);
    portalTransit = null;
    if (transit.destination === 'overview') {
      mode = 'overview';
      zone = 'main';
      app.classList.remove('is-exploring');
    } else current = target;
    moving = false;
    updateMode();
  }
}
// One frame of a camera animation (a flight, a turn at the stand, a return from a side section, a balloon
// ride); its `done` runs once, when it ends.
function stepCameraAnimation(now) {
  const t = tweenProgress(animation, now);
  const s = smooth(t);
  // Balloon rides pose the camera themselves (sky-island.mjs), from the linear trip fraction.
  if (animation.pose) animation.finished = animation.pose(t, now) === true;
  else {
    camera.position.copy(animation.curve.getPoint(s));
    if (animation.fromQuaternion)
      orientLook(
        THREE,
        camera.position,
        look,
        animation.fromQuaternion.clone().slerp(animation.toQuaternion, s)
      );
    else look.copy(animation.fromLook).lerp(animation.toLook, s);
  }
  if (t === 1 || animation.finished) {
    const done = animation.done;
    animation = null;
    done?.();
  }
}
// One frame of the 0.7 s crossfade between two lightings: sky, fog, the three lights, neon, sun and moon, and
// the ribbon.
function stepLightFade(now) {
  const t = Math.min(1, (now - lightFade.start) / 700),
    a = smooth(t);
  for (const [key, value] of Object.entries(lightFade.from.sky))
    world.skyMaterial.uniforms[key].value.copy(value).lerp(lightFade.to.sky[key], a);
  world.scene.fog.color.copy(lightFade.from.fog).lerp(lightFade.to.fog, a);
  for (const id of ['ambient', 'key', 'fill']) {
    world[id].color.copy(lightFade.from[id].color).lerp(lightFade.to[id].color, a);
    world[id].intensity = THREE.MathUtils.lerp(lightFade.from[id].intensity, lightFade.to[id].intensity, a);
  }
  for (const key of ['blue', 'violet', 'coral'])
    world.palette[key].emissiveIntensity = THREE.MathUtils.lerp(
      lightFade.from.neon[key],
      lightFade.to.neon[key],
      a
    );
  const blended = {
    sunStrength: THREE.MathUtils.lerp(
      lightFade.from.backdrop.sunStrength,
      lightFade.to.backdrop.sunStrength,
      a
    ),
    sunHeight: THREE.MathUtils.lerp(lightFade.from.backdrop.sunHeight, lightFade.to.backdrop.sunHeight, a)
  };
  blended.moonStrength = THREE.MathUtils.lerp(
    lightFade.from.backdrop.moonStrength,
    lightFade.to.backdrop.moonStrength,
    a
  );
  for (const key of ['sunPosition', 'moonPosition'])
    blended[key] = lightFade.from.backdrop[key].map((v, i) =>
      THREE.MathUtils.lerp(v, lightFade.to.backdrop[key][i], a)
    );
  for (const key of ['sunColor', 'cloudColor', 'mountainColor'])
    blended[key] = lightFade.from.backdrop[key].clone().lerp(lightFade.to.backdrop[key], a);
  world.backdrop.setLight(blended);
  world.ribbonMaterial.opacity = THREE.MathUtils.lerp(lightFade.from.ribbon, lightFade.to.ribbon, a);
  if (t === 1) lightFade = null;
}
// One frame's scene: effects, lights, water, sky, visitors and halls brought up to `now`, then drawn (through the
// glow chain when it is on). Returns whether a hall door is still moving.
function drawScene(now, dt) {
  // Outside the check so the class also goes when the tags do; the terrace tags keep the scenic hints.
  const showing = !!showcase?.active && !skyTags;
  if (app.classList.contains('is-showcase') !== showing) app.classList.toggle('is-showcase', showing);
  streamTripMagic(dt);
  if (magicFx) magicFx.tick(now, camera, canvas.height, viewport.width / viewport.height);
  if (timeMode === 'auto' && !lightFade && !economy && !reduced)
    lastLighting = lighting(world, 'auto', new Date(), lightStyle, solarCity);
  world.visitor.observe?.(camera, { mode, focus: mode === 'journey' ? selected : -1 });
  // The gate brightens under the cursor and, more softly, while the visitor stands at it.
  const atPortal = mode === 'portal' && !portalTransit ? 0.45 : 0;
  world.setPortalHover?.(portalHovered ? 1 : atPortal);
  world.updateWater(now, !reduced && !economy);
  world.snowfall?.update(now, camera, canvas.height, !reduced);
  world.skyTransit?.update(now);
  if (!animation?.magicJump) closeStrayGates();
  world.skyIsland?.update(now, camera.position, nightLevel(lastLighting));
  skyLife?.setLight({ night: nightLevel(lastLighting) });
  bloom?.setThreshold(glowThreshold(lastLighting));
  bloom?.setStrength((winter ? 0.3 : 0.55) + (lightStyle === 'neon' ? 0.3 * nightLevel(lastLighting) : 0));
  skyLife?.update(now, !reduced);
  // Keeps itself awake while sparks are in the air (onWake) and sleeps on a timer until the next shell.
  fireworks?.update(now, camera, canvas.height, daylight(lastLighting));
  pavilionParty?.update(now, reduced ? 0 : 1, daylight(lastLighting));
  celebrationStage?.update(now, camera, daylight(lastLighting), reduced ? 0 : 1);
  world.updateLocalLights(current, mode, zone, camera.position);
  const hallsMoving = world.updateHalls?.(camera.position, dt, reduced);
  world.sky.position.copy(camera.position);
  applyLook();
  updateTeaserCue();
  world.updateTrees?.(camera);
  world.syncMaterials();
  fitNearPlane();
  ultraEffects.updateReflection();
  ultraEffects.updateShafts();
  renderer.gardenFrameProbe?.begin();
  drawStart = performance.now();
  if (bloom) bloom.render(world.scene, camera);
  else renderer.render(world.scene, camera);
  if (!firstFrame) {
    firstFrame = true;
    loadMark('first-frame');
    revealGarden();
  }
  renderer.gardenFrameProbe?.end();
  return hallsMoving;
}
function fly(pose, duration, done, approach = null) {
  // approach: optional offset of the last control point from the destination, to arrive from the side.
  // A glass hall is left and entered level through its door, never through the roof.
  const from = camera.position.clone(),
    to = pose.position.clone();
  const high = Math.max(23, from.y, to.y),
    leave = world.hallExit?.(from),
    enter = approach ? null : world.hallExit?.(to);
  const curve = new THREE.CubicBezierCurve3(
    from,
    leave ? from.clone().addScaledVector(leave, 10) : new THREE.Vector3(from.x, high, from.z),
    approach
      ? to.clone().add(approach)
      : enter
        ? to.clone().addScaledVector(enter, 10)
        : new THREE.Vector3(to.x, high, to.z),
    to
  );
  lastFlightClearance = { paths: [curve], samples: 160 };
  animation = {
    curve,
    fromLook: look.clone(),
    toLook: pose.look.clone(),
    fromQuaternion: camera.quaternion.clone(),
    toQuaternion: aimQuaternion(THREE, to, pose.look),
    start: performance.now(),
    duration: reduced ? 0 : duration,
    done
  };
  if (reduced) {
    camera.position.copy(to);
    look.copy(pose.look);
    animation = null;
    done?.();
  }
  requestRender();
}
// Ultra graphics' shadows, extra lamps, aurora, pool mirror and sun shafts (ultra-effects.mjs).
const ultraEffects = createUltraEffects({
  ultra: () => graphics === 'ultra',
  renderer: () => renderer,
  world: () => world,
  bloom: () => bloom,
  camera,
  shaftLook: auditEnabled ? new URLSearchParams(location.search).get('shafts') : null
});
// Seen from outside the garden the near plane moves out (near-plane.mjs); rides and the terrace keep it close.
function fitNearPlane() {
  const p = camera.position,
    near =
      ride || scenicFocus ? NEAR_PLANE.close : nearPlane(outsideGarden(p.x, p.y, p.z, world.route.radius));
  if (Math.abs(camera.near - near) < 0.02) return;
  camera.near = near;
  camera.updateProjectionMatrix();
}
function updateCameraProjection() {
  // A phone looks wider; the overview is narrower than every closer view.
  const [overviewFov, closeFov] = mobile() ? [58, 76] : [48, 66];
  camera.fov = mode === 'overview' ? overviewFov : closeFov;
  // Frame the stand above the portrait card without changing route positions or gaze.
  // Opt-in display studies retain their ordinary projection.
  if (
    mobile() &&
    viewport.height > viewport.width &&
    mode === 'journey' &&
    (!displayPrototype || ['workbench', 'relay'].includes(displayPrototype))
  )
    camera.setViewOffset(
      viewport.width,
      viewport.height,
      0,
      viewport.height * 0.1,
      viewport.width,
      viewport.height
    );
  // The portal chooser covers the right side on smaller desktops: keep the ring in the free left part.
  else if (!mobile() && mode === 'portal' && dialog.open && viewport.width <= 1500)
    camera.setViewOffset(
      viewport.width,
      viewport.height,
      viewport.width * 0.17,
      0,
      viewport.width,
      viewport.height
    );
  else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}
// Dock ride buttons carry the signposts' pictograms (the sky-transit.mjs inlays, redrawn in SVG) instead of
// drawn arrows. The label is rebuilt only when it changes.
const RIDE_GLYPHS = {
  telescope:
    '<g transform="translate(12 9.1) rotate(-28.6)"><path d="M-10.1-1.7 7.2-2.9v5.8l-17.3-1.2Z"/>' +
    '<path d="M7.2-3.4h1.9v6.8H7.2Z"/></g><path d="M12 10.1 6.5 22.5M12 10.1l5.5 12.4M12 10.1v12.4"/>',
  tour:
    '<path d="M12 14.6C3 9.6 4.4 1.5 12 1.5s9 8.1 0 13.1Z"/><path d="M12 1.8Q7.6 8 12 14.4q4.4-6.4 0-12.6"/>' +
    '<path d="M10.3 14.9v2.8m3.4-2.8v2.8M9.6 17.7h4.8v3.1H9.6Z"/>' +
    '<path d="M23 14.4A11.5 11.5 0 0 1 5.5 20.5" stroke-dasharray="1 1.6"/>',
  zip: '<path d="M1.5 3 22.5 14.5"/><circle cx="11.5" cy="8.4" r="2.4"/><path d="M10.6 10.6 8.4 19m4-8.4 2.2 8.4M6.8 19.6h9.4"/>'
};
function rideLabel(button, glyph, text) {
  if (button.dataset.glyph === glyph && button.textContent === text) return;
  button.dataset.glyph = glyph;
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('class', 'ride-glyph');
  icon.innerHTML = RIDE_GLYPHS[glyph];
  const name = document.createElement('span');
  name.textContent = text;
  button.replaceChildren(icon, name);
}
function updateMode() {
  if (mode !== 'overview') scenicFocus = null;
  app.classList.toggle('is-scenic', !!scenicFocus);
  // Observatory: the dock button rides the lift up; on the terrace it hides (the overview button leads back and
  // the tour button crosses to the balloon station).
  const skyEntry = $('sky-entry');
  if (skyEntry) rideLabel(skyEntry, 'telescope', labels.skyIsland || 'Observatory');
  syncSkyButtons();
  updateCameraProjection();
  app.classList.toggle('is-overview', mode === 'overview');
  $('overview').title =
    mode === 'overview' && !scenicFocus ? labels.overviewReset || labels.overview : labels.overview;
  app.classList.toggle('reduce-motion', reduced);
  $('input-hint').textContent =
    mode === 'overview'
      ? labels.overviewGesture
      : zone === 'gallery'
        ? labels.galleryGesture
        : mobile()
          ? labels.mobileHint
          : labels.hint;
  app.classList.toggle('is-journey', mode !== 'overview');
  app.classList.toggle('is-portal', mode === 'portal');
  if (dialog.open) portalStrip?.sync();
  $('hero').hidden = mode !== 'overview' || !!scenicFocus;
  $('project-card').hidden = mode !== 'journey' || moving;
  // Only the way back from a free look remains of the old walking controls.
  $('walk-controls').hidden =
    !['journey', 'portal'].includes(mode) || dialog.open || zone !== 'main' || moving || !freeLook;
  $('look-reset').hidden = !freeLook;
  $('media-viewer').hidden = mode !== 'journey' || moving || zone !== 'gallery';
  if ($('media-viewer').hidden) {
    leaveVideoFullscreen();
    $('gallery-video')?.querySelector('iframe')?.remove();
  }
  $('travel-status').hidden = !moving;
  $('travel-message').textContent = scenicFocus
    ? labels.teaserApproach
    : mode === 'portal'
      ? labels.portalApproach
      : portalTransit
        ? labels.portalMoving
        : labels.moving + (projects[selected] ? ' · ' + projects[selected].name : '');
  $('portal-go').disabled = portalApproaching || !!portalTransit;
  $('journey-label').textContent = labels.route;
  $('journey-count').textContent =
    (mode === 'overview' ? '' : String(selected + 1) + ' / ') + projects.length;
  const previousName = projects.length
      ? projects[wrapped(mode === 'overview' ? -1 : selected - 1, projects.length)].name
      : '',
    nextName = projects.length
      ? projects[wrapped(mode === 'overview' ? 0 : selected + 1, projects.length)].name
      : '';
  $('next-name').textContent = nextName;
  $('previous-name').textContent = previousName;
  // The destination name floats above the arrow (garden-ui.css); a native title would repeat it.
  $('next').setAttribute('aria-label', labels.next + ' · ' + nextName);
  $('previous').setAttribute('aria-label', labels.previous + ' · ' + previousName);
  const stuck = projects.length < 2 || !!filteredOut || !!relayout;
  $('next').disabled = $('previous').disabled = stuck;
  $('portal-go').disabled ||= !projects.length && !portalToOverview;
  $('start').disabled = !!relayout;
  $('garden-empty').hidden = !!projects.length || mode !== 'overview' || !!relayout;
  $('hero').hidden ||= !projects.length;
  updateFilteredOut();
}
function updateProject(index) {
  if (!projects.length) {
    selected = 0;
    $('route-dots').replaceChildren();
    updateMode();
    return;
  }
  selected = wrapped(Math.round(index), projects.length);
  const project = projects[selected];
  // The building the project stands in (owner, round 12: every house still read "Greenhouse") and its place.
  const house = {
    temple: labels.houseTemple,
    dojo: labels.houseDojo,
    pavilion: labels.housePavilion,
    glasshouse: labels.greenhouse
  }[world.houseStyle?.(selected)];
  $('project-count').textContent = (house || labels.station) + ' ' + String(selected + 1);
  $('project-icon').replaceWith(Object.assign(projectIcon(project), { id: 'project-icon' }));
  world.focusProject(selected);
  $('project-symbol').textContent = '';
  $('project-name').textContent = project.name;
  fitLongName($('project-name'));
  $('project-description').textContent = project.description;
  $('project-date').textContent = project.createdLabel;
  $('project-link').href = project.href;
  $('project-status').textContent =
    (project.archived ? labels.archived : labels.active) +
    (project.hidden ? ' · ' + labels.hiddenProject : '');
  $('project-status').classList.toggle('is-hidden-project', !!project.hidden);
  $('project-updated-row').hidden = !project.updatedLabel;
  $('project-updated-date').textContent = project.updatedLabel || '';
  $('project-repository').hidden = !project.repository;
  if (project.repository) $('project-repository').href = project.repository;
  $('project-videos').replaceChildren();
  $('project-videos').hidden = true;
  updateSection();
  [...$('route-dots').children].forEach((button, i) => {
    button.classList.toggle('active', i === selected && mode !== 'overview');
    button.setAttribute('aria-current', i === selected && mode !== 'overview' ? 'step' : 'false');
  });
  updateMode();
}
function writeHash(kind, index, replace = false) {
  const hash =
    kind === 'project'
      ? '#project=' +
        encodeURIComponent(projects[index].id) +
        (zone !== 'main' ? '&zone=' + zone + (zone === 'gallery' ? '&image=' + galleryImage : '') : '')
      : kind === 'portal'
        ? '#portal'
        : kind === 'teaser'
          ? '#teaser'
          : '';
  if (location.hash === hash) return;
  history[replace ? 'replaceState' : 'pushState'](
    { garden: kind },
    '',
    location.pathname + location.search + hash
  );
}
function readHash() {
  if (location.hash === '#teaser') return { kind: 'teaser' };
  if (location.hash === '#portal') return { kind: 'portal' };
  const params = new URLSearchParams(location.hash.slice(1)),
    id = params.get('project'),
    index = projects.findIndex(p => p.id === id),
    value = params.get('zone');
  return index >= 0
    ? {
        kind: 'project',
        index,
        zone: zones.includes(value) ? value : 'main',
        image: Math.max(0, Number(params.get('image')) || 0)
      }
    : { kind: 'overview' };
}
// A blocked remote dock is a stable, controllable place. Navigation must first return safely.
function remoteDockTransitionLocked() {
  return !!(
    scenicFocus?.remoteDock ||
    scenicFocus?.remoteHold ||
    ride === 'sky-tour-return' ||
    (ride === 'sky-tour' && world?.skyIsland?.tour?.remote)
  );
}
function rejectRemoteDockNavigation() {
  if (!remoteDockTransitionLocked()) return false;
  showNotice(
    labels.skyDockNavigationBlocked || 'Return safely from the balloon dock before changing location.'
  );
  return true;
}
let deferredRemoteHistory = false;
let languageChangePending = false;
let pendingLanguageReload = false;
function goTo(
  index,
  historyWrite = true,
  instant = false,
  direction = 0,
  desiredZone = 'main',
  desiredImage = 0
) {
  if (rejectRemoteDockNavigation()) return;
  if (!projects.length || relayout || filteredOut) return;
  if (
    moving &&
    mode === 'journey' &&
    zone === 'main' &&
    !freeLook &&
    wrapped(index, projects.length) === selected &&
    desiredZone === 'main' &&
    !instant
  )
    return;
  const actualAim = camera.position.clone().addScaledVector(camera.getWorldDirection(new THREE.Vector3()), 8);
  // A new choice mid-trip keeps going at the current speed instead of stopping first.
  const carry = travel && mode === 'journey' ? travel.rate : 0;
  freeLook = false;
  lookYaw = lookPitch = 0;
  look.copy(actualAim);
  resetTransit();
  travelCarry = carry;
  const returnFrom =
    animation?.returningFrom ||
    (['description', 'comments'].includes(zone) ? { index: selected, zone } : null);
  const wasJourney = mode === 'journey' && (!animation || !!returnFrom || animation.turnOnly);
  animation = null;
  zone = 'main';
  galleryImage = 0;
  commentToken++;
  index = wrapped(index, projects.length);
  if (historyWrite) writeHash('project', index);
  if (dialog.open) dialog.close();

  const destination = routeIndex(index, direction);
  beginWalk();
  mode = 'journey';
  target = destination;
  moving = !instant && !reduced;
  updateProject(index);
  const done = () => {
    current = target;
    moving = false;
    // On arrival a greenhouse turns smoothly to the wanted section (the card already shows it).
    if (desiredZone !== 'main')
      showZone(desiredZone, false, instant || !world.isGreenhouse?.(index), desiredImage);
    updateMode();
  };
  if (wasJourney && !instant && !reduced && Math.abs(target - current) >= 0.002) journeyArrival = done;
  if (instant || reduced) {
    animation = null;
    current = target;
    const pose = stationPose(current);
    camera.position.copy(pose.position);
    look.copy(pose.look);
    done();
    requestRender();
    return;
  }
  // Back from a side section to the stand, a turn on the spot, a flight in from outside the journey, or (already
  // there) nothing to move; a walk along the bridges is left to stepTravel.
  if (returnFrom && wasJourney) animation = returnToStand(returnFrom, done);
  else if (wasJourney && Math.abs(target - current) < 0.002) animation = turnAtStand(done);
  else if (!wasJourney) fly(stationPose(target), 1450, done);
  else if (Math.abs(target - current) < 0.002) done();
  // Target trips retain the ring route; desired sections open after arrival.
  requestRender();
}
// The camera's way back from a side section (description, comments) to the stand; if the trip goes on to
// another pavilion, the walk departs from the stand once it is reached.
function returnToStand(returnFrom, done) {
  const pose = stationPose(current),
    curve = world.zoneCurve(
      returnFrom.index,
      returnFrom.zone,
      'main',
      camera.position.clone(),
      pose.position
    );
  return {
    curve,
    fromLook: look.clone(),
    toLook: pose.look,
    fromQuaternion: camera.quaternion.clone(),
    toQuaternion: aimQuaternion(THREE, pose.position, pose.look),
    returningFrom: returnFrom,
    start: performance.now(),
    duration: 1300,
    done: () => {
      if (Math.abs(target - current) < 0.002) {
        look.copy(stationPose(target).look);
        done();
      } else {
        // The return curve ends at the stand; depart from that pose, not the side section.
        beginWalk();
        moving = true;
        updateMode();
        requestRender();
      }
    }
  };
}
// Already at the chosen pavilion: the camera only turns back to its stand.
function turnAtStand(done) {
  const pose = stationPose(target);
  return {
    curve: new THREE.LineCurve3(camera.position.clone(), pose.position),
    fromLook: look.clone(),
    toLook: pose.look,
    fromQuaternion: camera.quaternion.clone(),
    toQuaternion: aimQuaternion(THREE, pose.position, pose.look),
    turnOnly: true,
    start: performance.now(),
    duration: 850,
    done
  };
}
// One frame of a trip between pavilions: eased along the bridges (travelCurve), cresting each one a little,
// looking ahead down the path and turning to the stand on arrival. A retarget starts a new trip from here
// that keeps the current speed (travelCarry), so a second "next" never stops the camera mid-bridge.
const travelMatrix = new THREE.Matrix4(),
  travelAim = new THREE.Quaternion(),
  UP = new THREE.Vector3(0, 1, 0);
function stepTravel(now, dt) {
  if (!travel || travel.to !== target) {
    const span = target - current;
    travel = {
      from: current,
      to: target,
      start: now,
      duration: travelDuration(world.route.distance(current, target)),
      lead: 0,
      rate: 0,
      gaze: camera.quaternion.clone()
    };
    if (span) travel.lead = (travelCarry * travel.duration) / 1000 / span;
    travelCarry = 0;
  }
  const t = tweenProgress(travel, now),
    span = travel.to - travel.from;
  current = t >= 1 ? target : travel.from + span * travelCurve(t, travel.lead);
  travel.rate = (travelRate(t, travel.lead) * span * 1000) / travel.duration;
  velocity = Math.abs(travel.rate) * world.route.metersPerStation(current);
  camera.position.copy(transitPose(current).position);
  const remaining = Math.abs(target - current),
    ahead = current + (Math.sign(span) || 1) * 0.32,
    facing = vec(world.route.point(ahead, 0, 1.65 + bridgeArc(ahead) * 0.5)).lerp(
      stationPose(target).look,
      1 - smooth(Math.min(1, remaining / 0.34))
    );
  travelAim.setFromRotationMatrix(travelMatrix.lookAt(camera.position, facing, UP));
  travel.gaze.slerp(travelAim, 1 - Math.exp(-dt * 8));
  orientLook(THREE, camera.position, look, travel.gaze);
  if (current === target) {
    travel = null;
    velocity = 0;
    look.copy(stationPose(target).look);
    finishWalk();
  }
}
function finishWalk() {
  arrivalMagic(wrapped(Math.round(target), projects.length));
  if (journeyArrival) {
    const done = journeyArrival;
    journeyArrival = null;
    done();
    return;
  }
  moving = false;
  updateProject(wrapped(Math.round(target), projects.length));
  writeHash('project', selected);
}
// A walk that is already at its stand (a retarget onto the spot it stands on) lands now: the card opens and
// the "on the bridge" status goes, instead of easing over nothing or waiting for "skip".
function arriveTravel() {
  travel = null;
  velocity = 0;
  current = target;
  camera.position.copy(transitPose(current).position);
  look.copy(stationPose(target).look);
  finishWalk();
}
function galleryItems(project = projects[selected]) {
  return [
    ...(project.images?.length ? project.images : [project.image])
      .filter(Boolean)
      .map(src => ({ kind: 'image', src })),
    ...(project.videos || []).map((video, index) => ({ kind: 'video', video, index }))
  ];
}
function updateSection() {
  const project = projects[selected],
    items = galleryItems(project),
    images = items.map(item => (item.kind === 'image' ? item.src : item.video.poster || project.image)),
    item = items[wrapped(galleryImage, items.length)];
  galleryImage = wrapped(galleryImage, images.length);
  app.dataset.area = zone;
  // A greenhouse has three tabs: Gallery (its exhibits; a picture opens large), Description and Comments.
  const greenhouse = !!world.isGreenhouse?.(selected);
  app.classList.toggle('is-greenhouse', greenhouse);
  updateZoneTabs(greenhouse);
  $('zone-content').hidden = zone === 'main';
  $('gallery-controls').hidden = zone !== 'gallery';
  $('zone-description').hidden = zone !== 'description';
  $('zone-comments').hidden = zone !== 'comments';
  $('zone-description').textContent = project.description;
  $('comments-link').href = project.href + '#commento';
  // The card's × closes Description and Comments; on a desktop the gallery closes from the viewer's own ×,
  // on a phone the card's × does (garden-ui-panels.css hides the other one per layout).
  $('detail-close').hidden = zone === 'main';
  closeProjectSwitch(false);
  $('gallery-counter').textContent = galleryImage + 1 + ' / ' + images.length;
  // The viewer's own heading (garden-project.css): whose pictures these are.
  $('media-title').textContent = project.name;
  renderGalleryDots(items);
  $('gallery-original').href = images[galleryImage];
  $('gallery-previous').disabled = $('gallery-next').disabled = images.length <= 1;
  const image = $('gallery-image');
  if (image.getAttribute('src') !== images[galleryImage]) {
    image.src = images[galleryImage];
    animateSurface(image);
  }
  image.alt = labels.galleryCount + ' ' + (galleryImage + 1);
  $('image-full').src = images[galleryImage];
  $('image-full').alt = image.alt;
  $('image-original').href = images[galleryImage];
  $('gallery-expand').hidden = item?.kind === 'video';
  $('gallery-original').hidden = item?.kind === 'video';
  updateGalleryVideo(item);
  $('media-viewer').hidden = zone !== 'gallery' || moving || mode !== 'journey';
  $('input-hint').textContent =
    mode === 'overview'
      ? labels.overviewGesture
      : zone === 'gallery'
        ? labels.galleryGesture
        : mobile()
          ? labels.mobileHint
          : labels.hint;
  updateZoneScreen(project, item, images);
}
// The section tabs: which one is pressed, and a greenhouse's own set (its Gallery is the main tab).
function updateZoneTabs(greenhouse) {
  document.querySelectorAll('[data-zone]').forEach(button =>
    button.setAttribute(
      'aria-pressed',
      String(
        // A greenhouse's "Gallery" (the main tab) lights only while the pictures are open, not at the hall.
        greenhouse
          ? zone !== 'main' && button.dataset.zone === (zone === 'gallery' ? 'main' : zone)
          : button.dataset.zone === zone
      )
    )
  );
  document.querySelector('[data-zone=gallery]').hidden = greenhouse;
  document.querySelector('[data-zone=main] span').textContent = greenhouse
    ? labels.zoneGallery
    : labels.zoneMain;
}
// The viewer's thumbnail strip: a button per picture or video (a poster thumbnail, ▶ on videos), the open one
// marked and scrolled into view.
function renderGalleryDots(items) {
  const dots = $('gallery-dots');
  dots.replaceChildren();
  items.forEach((entry, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute(
      'aria-label',
      (entry.kind === 'video' ? labels.video : labels.galleryCount) +
        ' ' +
        (entry.kind === 'video' ? entry.index + 1 : i + 1)
    );
    b.title = b.getAttribute('aria-label');
    b.setAttribute('aria-current', String(i === galleryImage));
    b.dataset.kind = entry.kind;
    if (entry.kind === 'image' || entry.video.poster) {
      const thumb = document.createElement('img');
      thumb.alt = '';
      thumb.src = entry.kind === 'image' ? entry.src : entry.video.poster;
      b.append(thumb);
    }
    if (entry.kind === 'video') {
      const mark = document.createElement('span');
      mark.textContent = '▶';
      b.append(mark);
    }
    b.addEventListener('click', () => {
      galleryImage = i;
      updateSection();
      writeHash('project', selected);
    });
    dots.append(b);
  });
  // The strip is rebuilt on every change and would start again from its left end, leaving the open item (from
  // the fifth on a phone) out of sight: scroll it to the middle once the viewer is laid out.
  requestAnimationFrame(() => {
    const current = dots.children[galleryImage];
    if (!current || dots.scrollWidth <= dots.clientWidth) return;
    const strip = dots.getBoundingClientRect(),
      thumb = current.getBoundingClientRect();
    dots.scrollLeft += thumb.left - strip.left - (strip.width - thumb.width) / 2;
  });
}
// What the stand's screen shows for the open section: the picture with its caption, or the description.
function updateZoneScreen(project, item, images) {
  if (zone === 'gallery')
    world.setZoneContent(
      selected,
      zone,
      project.name +
        ' · ' +
        (item.kind === 'video'
          ? labels.video + ' ' + (item.index + 1)
          : galleryImage + 1 + ' / ' + images.length),
      '',
      images[galleryImage]
    );
  if (zone === 'description') world.setZoneContent(selected, zone, project.name, project.description);
  if (zone === 'main')
    world.setZoneContent(selected, 'description', project.name, project.description, undefined, 'main');
}
function showZone(value, historyWrite = true, instant = false, image = galleryImage) {
  if (rejectRemoteDockNavigation()) return;
  if (relayout || mode !== 'journey' || (moving && !instant)) return;
  const fromZone = zone;
  lastExhibitRect = world.screenBounds(selected, camera, viewport.width, viewport.height);
  freeLook = false;
  lookYaw = lookPitch = 0;
  zone = zones.includes(value) ? value : 'main';
  galleryImage = image;
  updateSection();
  if (historyWrite) writeHash('project', selected);
  const pose = zone === 'main' || zone === 'gallery' ? stationPose(current) : world.zonePose(selected, zone);
  if (zone === 'comments') loadComments(selected);
  moving = !instant && !reduced;
  updateMode();
  if (
    instant ||
    reduced ||
    fromZone === zone ||
    (['main', 'gallery'].includes(fromZone) && ['main', 'gallery'].includes(zone))
  ) {
    animation = null;
    camera.position.copy(pose.position);
    look.copy(pose.look);
    moving = false;
    updateMode();
    if (zone === 'gallery') unfoldExhibit($('media-viewer'), lastExhibitRect);
    requestRender();
    return;
  }
  const curve = world.zoneCurve(selected, fromZone, zone, camera.position, pose.position);
  // In a greenhouse the card shows the section at once while the camera turns to it (greenhouse.mjs).
  if (world.isGreenhouse?.(selected)) {
    moving = false;
    updateMode();
    animation = {
      curve,
      fromLook: look.clone(),
      toLook: pose.look.clone(),
      fromQuaternion: camera.quaternion.clone(),
      toQuaternion: aimQuaternion(THREE, pose.position, pose.look),
      turnOnly: true,
      start: performance.now(),
      duration: GREENHOUSE.turnMs,
      done: requestRender
    };
    requestRender();
    return;
  }
  lastFlightClearance = { paths: [curve], samples: 240 };
  animation = {
    curve,
    fromLook: look.clone(),
    toLook: pose.look.clone(),
    start: performance.now(),
    duration: Math.max(950, (curve.getLength() / 8.2) * 1000),
    done: () => {
      moving = false;
      updateMode();
      if (zone !== 'main')
        unfoldExhibit(
          $('project-card'),
          world.screenBounds(selected, camera, viewport.width, viewport.height, zone)
        );
    }
  };
  requestRender();
}
function parseComments(list) {
  return (Array.isArray(list) ? list : []).map(item => {
    const parsed = new DOMParser().parseFromString(item.body || '', 'text/html');
    return { name: item.userNickName || '', body: parsed.body.textContent || '', created: item.createdAt };
  });
}
function renderComments(index, comments, fresh = null) {
  const host = $('comments-list');
  host.replaceChildren();
  if (!comments.length) host.textContent = labels.commentEmpty;
  let arrived = null;
  for (const comment of comments) {
    const article = document.createElement('article'),
      heading = document.createElement('b'),
      body = document.createElement('p');
    heading.textContent = comment.name;
    body.textContent = comment.body;
    article.append(heading, body);
    host.append(article);
    if (fresh && comment === fresh) arrived = article;
  }
  world.setZoneContent(
    index,
    'comments',
    labels.zoneComments,
    comments.length
      ? comments
          .slice(0, 3)
          .map(c => c.name + ': ' + c.body)
          .join(' · ')
      : labels.commentEmpty
  );
  // A greenhouse pins the latest comments as notes on its cork board; the full text stays in the card.
  if (comments.length)
    world.pinNotes?.(
      index,
      [...comments].sort((a, b) => String(b.created).localeCompare(String(a.created))).slice(0, 6)
    );
  return arrived;
}
// The newest comment is the one with the latest creation time; the server returns the page's whole list.
function newestComment(comments) {
  return comments.reduce(
    (best, comment) => (!best || String(comment.created) > String(best.created) ? comment : best),
    null
  );
}
function setCommentStatus(text) {
  $('comment-status').textContent = text;
  $('comment-form').classList.toggle('has-status', !!text);
}
function bindCommentForm() {
  const form = $('comment-form'),
    body = $('comment-body'),
    send = $('comment-send');
  body.addEventListener('input', () => {
    send.disabled = body.value.trim().length < 2;
    setCommentStatus('');
    form.classList.remove('is-error');
  });
  body.addEventListener('keydown', event => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    postComment();
  });
}
// Posts to the site's own comment API (same origin). Nothing is shown as posted unless the server saved it.
async function postComment() {
  const project = projects[selected],
    body = $('comment-body'),
    form = $('comment-form'),
    send = $('comment-send'),
    text = body.value.trim();
  if (!project || text.length < 2) {
    setCommentStatus(labels.commentTooShort);
    return;
  }
  const index = selected,
    token = ++commentPostToken,
    from = body.getBoundingClientRect();
  send.disabled = true;
  body.readOnly = true;
  form.classList.add('is-sending');
  form.classList.remove('is-error');
  setCommentStatus(labels.commentSending);
  try {
    const response = await fetch(API + '/api/comment/post', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: project.id, body: text })
    });
    if ([404, 405, 501].includes(response.status)) {
      const error = new Error('Comment posting unavailable ' + response.status);
      error.unavailable = true;
      throw error;
    }
    if (!response.ok) throw new Error('Comment ' + response.status);
    const comments = parseComments(await response.json());
    commentsCache.set(project.id, comments);
    if (token !== commentPostToken) return;
    body.value = '';
    setCommentStatus(labels.commentSent);
    if (zone === 'comments' && index === selected) {
      const arrived = renderComments(index, comments, newestComment(comments));
      if (arrived) {
        arrived.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
        flyComment(text, from, arrived);
      }
      if (!reduced) {
        const pose = world.zonePose?.(index, 'comments');
        if (pose?.look)
          ensureMagic().burst(pose.look.x, pose.look.y, pose.look.z, 46, { radius: 1.4, speed: 2, up: 1.2 });
        requestRender();
      }
    }
  } catch (error) {
    if (token !== commentPostToken) return;
    console.warn('Comment not sent', error);
    setCommentStatus(error.unavailable ? labels.commentPreviewOnly : labels.commentPostFailed);
    form.classList.add('is-error');
  } finally {
    if (token === commentPostToken) {
      body.readOnly = false;
      send.disabled = body.value.trim().length < 2;
      form.classList.remove('is-sending');
    }
  }
}
// The written text lifts off the field and lands as the new entry, which then glows.
function flyComment(text, from, arrived) {
  arrived.classList.add('is-new');
  if (reduced || !document.body.animate) return;
  const to = arrived.getBoundingClientRect(),
    ghost = document.createElement('div');
  ghost.className = 'comment-flight';
  ghost.textContent = text;
  document.body.append(ghost);
  ghost
    .animate(
      [
        { left: from.left + 'px', top: from.top + 'px', opacity: 0.95, transform: 'scale(1)' },
        {
          left: (from.left + to.left) / 2 + 'px',
          top: Math.min(from.top, to.top) - 40 + 'px',
          opacity: 1,
          transform: 'scale(1.04)'
        },
        { left: to.left + 'px', top: to.top + 'px', opacity: 0, transform: 'scale(.9)' }
      ],
      { duration: 820, easing: 'cubic-bezier(.3,.7,.2,1)' }
    )
    .finished.then(
      () => ghost.remove(),
      () => ghost.remove()
    );
}
async function loadComments(index) {
  const token = ++commentToken,
    project = projects[index];
  $('comments-list').textContent = labels.commentLoading;
  world.setZoneContent(index, 'comments', labels.zoneComments, labels.commentLoading);
  try {
    let comments = commentsCache.get(project.id);
    if (!comments) {
      const response = await fetch(API + '/api/comment/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: project.id })
      });
      if (!response.ok) throw new Error('Comments ' + response.status);
      comments = parseComments(await response.json());
      commentsCache.set(project.id, comments);
    }
    if (token !== commentToken || zone !== 'comments' || index !== selected) return;
    renderComments(index, comments);
  } catch (error) {
    if (token === commentToken) {
      $('comments-list').textContent = labels.commentFailed;
      world.setZoneContent(index, 'comments', labels.zoneComments, labels.commentFailed);
    }
    console.warn(error);
  }
}
function showOverview(historyWrite = true, instant = false) {
  if (relayout) return;
  if (ride === 'sky-tour-return') {
    rejectRemoteDockNavigation();
    return;
  }
  if (ride === 'sky-tour' && world.skyIsland?.tour?.remote) return stopSkyTour();
  if ((scenicFocus?.remoteDock || scenicFocus?.remoteHold) && world.skyIsland?.tour?.remote)
    return returnRemoteTourToOverview();
  resetSkyRideActors();
  // Already looking round the overview: Overview (or Escape) eases back to the default view instead.
  if (mode === 'overview' && !scenicFocus && !animation && !portalTransit && !ride) {
    if (historyWrite) writeHash('overview');
    resetOrbit(orbitView, reduced);
    app.classList.remove('is-exploring');
    calmCamera();
    if (reduced) overviewFrame();
    requestRender();
    return;
  }
  // Restoring overview text must not replay a flight from the same camera pose.
  instant = instant || (mode === 'overview' && !scenicFocus);
  scenicFocus = null;
  // Every return to the overview starts from its default view (the station framing).
  resetOrbit(orbitView, true);
  app.classList.remove('is-exploring');
  calmCamera();
  resetTransit();
  if (dialog.open) dialog.close();
  if (historyWrite) writeHash('overview');
  mode = 'overview';
  moving = false;
  updateMode();
  updateProject(selected);
  const pose = overviewPose();
  if (instant || reduced) {
    animation = null;
    camera.position.copy(pose.position);
    look.copy(pose.look);
    requestRender();
  } else fly(pose, 1400);
}
function updateTeaserCue() {
  const cue = $('teaser-entry');
  if (!cue || !world.teaser) return;
  const hidden = mode !== 'overview' || moving || !!scenicFocus;
  if (cue.hidden !== hidden) {
    cue.hidden = hidden;
    teaserLayout.at = -Infinity;
  }
  if (hidden) return;
  const ahead = inFrontOfCamera(camera, world.teaser.cue, screenScratch),
    p = teaserPoint.copy(world.teaser.cue).project(camera),
    anchorY = (1 - p.y) * viewport.height * 0.5;
  // The projected cue includes its own height; keep it below the header and top controls. Their edge and the
  // cue's height are read from the layout at most twice a second (round 22: four rects every frame).
  const clock = performance.now();
  if (clock - teaserLayout.at > 500) {
    teaserLayout.at = clock;
    teaserLayout.controlsBottom = Math.max(
      ...['.garden-header', '.garden-utilities', '.top-context', '#overview-announcement'].map(
        selector => document.querySelector(selector)?.getBoundingClientRect().bottom || 0
      )
    );
    teaserLayout.height = cue.offsetHeight;
  }
  const edge =
    !ahead ||
    Math.abs(p.x) > 0.82 ||
    p.y < -0.77 ||
    anchorY - teaserLayout.height < teaserLayout.controlsBottom + 8;
  cue.classList.toggle('is-edge', edge);
  if (!edge) {
    const left = Math.round((p.x + 1) * viewport.width * 5) / 10 + 'px',
      top = Math.round((1 - p.y) * viewport.height * 5) / 10 + 'px';
    if (cue.style.left !== left) cue.style.left = left;
    if (cue.style.top !== top) cue.style.top = top;
  }
}
const teaserLayout = { at: -Infinity, controlsBottom: 0, height: 0 },
  teaserPoint = new THREE.Vector3();
function inspectTeaser(historyWrite = true, instant = false) {
  if (rejectRemoteDockNavigation()) return;
  if (relayout || !world.teaser || (scenicFocus && moving)) return;
  resetTransit();
  hidePreferences();
  if (dialog.open) dialog.close();
  mode = 'overview';
  freeLook = false;
  scenicFocus = world.teaser;
  resetOrbit(orbitView, true);
  app.classList.add('is-exploring');
  if (historyWrite) writeHash('teaser');
  moving = !instant && !reduced;
  updateMode();
  const pose = overviewPose(),
    done = () => {
      moving = false;
      updateMode();
      requestRender();
    };
  if (instant || reduced) {
    animation = null;
    camera.position.copy(pose.position);
    look.copy(pose.look);
    done();
  } else fly(pose, 1450, done);
}
let portalPreviewAnimation;
// The selected destination: its name and preview in the dial, its accent on the dial and in the gate's vortex.
function showPortalChoice(name, accent, changed) {
  $('portal-go').setAttribute('aria-label', labels.go + ' · ' + name);
  dialog.classList.toggle('to-overview', portalToOverview);
  if (accent) dialog.style.setProperty('--accent', accent);
  world?.setPortalTint?.(accent || null, portalToOverview ? 0.45 : 0.85);
  portalPreviewAnimation?.forEach(animation => animation.cancel());
  // The new destination surfaces from the light in the middle of the dial.
  if (changed && dialog.open && !reduced)
    portalPreviewAnimation = [
      document.querySelector('.rune-preview')?.animate(
        [
          { opacity: 0.25, filter: 'blur(3px)' },
          { opacity: 1, filter: 'blur(0)' }
        ],
        {
          duration: 280,
          easing: 'cubic-bezier(.2,.8,.2,1)'
        }
      ),
      document.querySelector('.rune-core')?.animate(
        [
          { opacity: 0.2, scale: 0.82 },
          { opacity: 1, scale: 1 }
        ],
        {
          duration: 360,
          easing: 'cubic-bezier(.2,.9,.25,1.15)'
        }
      )
    ].filter(Boolean);
  requestRender();
}
// Dial slot 0 is the whole garden, slot k > 0 the project k - 1. Choosing never travels; only «Перейти» does.
function previewSlot(slot) {
  if (slot > 0) {
    preview(slot - 1);
    return;
  }
  const changed = !portalToOverview;
  portalToOverview = true;
  portalStrip?.sync();
  const image = $('portal-preview-image');
  image.removeAttribute('src');
  image.alt = '';
  $('portal-preview-name').textContent = labels.overview;
  $('portal-preview-name').classList.remove('long-name');
  $('portal-preview-description').textContent = labels.portalEndpoint;
  $('portal-preview-date').textContent = '';
  $('portal-go').disabled = portalApproaching;
  world?.setPortalPreview?.(null);
  showPortalChoice(labels.overview, '#bcd4ff', changed);
}
function preview(index) {
  if (!projects.length) {
    portalSelection = 0;
    portalToOverview = false;
    portalStrip?.sync();
    $('portal-preview-name').textContent = labels.emptyTitle;
    $('portal-preview-description').textContent = labels.emptyBody;
    $('portal-preview-date').textContent = '';
    $('portal-preview-image').removeAttribute('src');
    $('portal-go').setAttribute('aria-label', labels.go);
    $('portal-go').disabled = true;
    return;
  }
  const changed = portalToOverview || portalSelection !== index;
  portalSelection = index;
  portalToOverview = false;
  const project = projects[index];
  portalStrip?.sync();
  $('portal-preview-symbol').textContent = '';
  const previewImage = $('portal-preview-image');
  previewImage.src = project.image || project.ico;
  previewImage.alt = project.name;
  $('portal-preview-name').textContent = project.name;
  fitLongName($('portal-preview-name'));
  $('portal-preview-description').textContent = project.description;
  $('portal-preview-date').textContent = labels.created + ' · ' + project.createdLabel;
  $('portal-go').disabled = portalApproaching;
  // The gate's vortex opens a window onto the chosen project.
  world?.setPortalPreview?.(project.image || null);
  showPortalChoice(project.name, project.accent, changed);
}
function enterGarden() {
  if (rejectRemoteDockNavigation()) return;
  if (relayout) return;
  resetTransit();
  hidePreferences();
  freeLook = false;
  writeHash('portal');
  mode = 'portal';
  moving = portalApproaching = !reduced;
  preview(selected);
  if (!dialog.open) dialog.show();
  portalStrip?.layout();
  portalStrip?.sync(true);
  $('portal-heading').focus();
  updateMode();
  const fx = wakePortal(1.55);
  const arrive = () => {
    portalApproaching = false;
    moving = false;
    if (fx) fx.surgeTarget = 0;
    updateMode();
  };
  // Arrive low and level from outside the central tree, never down through its crown.
  const a = world.route.spoke(1),
    reach = Math.hypot(a.x, a.z) || 1;
  fly(portalPose(), 1550, arrive, new THREE.Vector3((a.x / reach) * 13, 1.3, (a.z / reach) * 13));
}
function openPortal(historyWrite = true, instant = false) {
  if (rejectRemoteDockNavigation()) return;
  if (portalTransit) return;
  if (mode === 'overview' && !instant) {
    enterGarden();
    return;
  }
  if (mode === 'portal') {
    hidePreferences();
    $('movement-help').open = false;
    if (!dialog.open) dialog.show();
    portalStrip?.layout();
    portalStrip?.sync();
    $('portal-heading').focus();
    updateMode();
    return;
  }
  if (relayout || !projects.length) return;
  const fromZone = zone,
    origin = camera.position.clone(),
    fromLook = look.clone(),
    destination = routeIndex(0),
    pose = portalPose(),
    points = [origin];
  if (fromZone === 'description' || fromZone === 'comments') {
    const returnCurve = world.zoneCurve(selected, fromZone, 'main', origin, stationPose(current).position);
    for (let i = 1; i <= 32; i++) points.push(returnCurve.getPoint(i / 32));
  }
  const routeStart = points.at(-1),
    centre = vec(world.route.point(current, 0, 3.3));
  for (let i = 1; i <= 10; i++) points.push(routeStart.clone().lerp(centre, i / 10));
  const count = Math.max(1, Math.ceil(Math.abs(destination - current) * 80));
  for (let i = 1; i <= count; i++)
    points.push(vec(world.route.point(current + ((destination - current) * i) / count, 0, 3.3)));
  const length = Math.hypot(world.route.anchors[0].x, world.route.anchors[0].z);
  for (let i = 1; i <= 64; i++) points.push(vec(world.route.spoke(1 - ((1 - 6.3 / length) * i) / 64, 3.3)));
  const curve = new THREE.CurvePath();
  for (let i = 1; i < points.length; i++) curve.add(new THREE.LineCurve3(points[i - 1], points[i]));
  resetTransit();
  hidePreferences();
  freeLook = false;
  zone = 'main';
  if (historyWrite) writeHash('portal');
  mode = 'portal';
  moving = portalApproaching = !instant && !reduced;
  preview(selected);
  if (!dialog.open) dialog.show();
  portalStrip?.layout();
  $('portal-heading').focus();
  updateMode();
  const fx = instant ? null : wakePortal(1.3);
  const done = () => {
    current = target = destination;
    portalApproaching = false;
    moving = false;
    if (fx) fx.surgeTarget = 0;
    camera.position.copy(pose.position);
    look.copy(pose.look);
    updateMode();
  };
  lastFlightClearance = { paths: [curve], samples: 200 };
  if (instant || reduced) {
    animation = null;
    done();
  } else
    animation = {
      curve,
      fromLook,
      toLook: pose.look,
      start: performance.now(),
      duration: Math.min(4200, Math.max(1300, (curve.getLength() / 8.2) * 1000)),
      done
    };
  requestRender();
}
function closePortal() {
  // Selection is only a preview until Go. Closing keeps the camera by the central tree; a half charge drains.
  portalStrip?.cancel();
  world?.setPortalTint?.(null);
  world?.setPortalPreview?.(null);
  dialog.close();
  $('portal').focus();
  updateMode();
}
function travelPortal(destination = 'project') {
  if (rejectRemoteDockNavigation()) return;
  // One crossing at a time: a second fire mid-crossing used to restart it from the portal (the same crossing twice).
  if (portalTransit || portalApproaching || relayout || (destination === 'project' && !projects.length))
    return;
  const index = portalSelection;
  if (reduced) {
    if (destination === 'overview') showOverview(true, true);
    else goTo(index);
    soundController?.playPortal();
    return;
  }
  animation = null;
  resetTransit();
  zone = 'main';
  galleryImage = 0;
  dialog.close();
  freeLook = false;
  if (destination === 'overview') {
    writeHash('overview');
    mode = 'portal';
  } else {
    writeHash('project', index);
    mode = 'journey';
    target = routeIndex(index);
    updateProject(index);
  }
  moving = true;
  const origin = portalPose();
  camera.position.copy(origin.position);
  look.copy(origin.look);
  const a = world.route.spoke(1),
    length = Math.hypot(a.x, a.z),
    direction = new THREE.Vector3(a.x / length, 0, a.z / length);
  // Finish at the portal plane; never continue toward the tree behind it.
  const entryEnd = vec(world.portalGeometry.center).addScaledVector(direction, 0.025);
  const entry = new THREE.CubicBezierCurve3(
    origin.position,
    origin.position.clone().lerp(entryEnd, 0.4),
    entryEnd.clone().addScaledVector(direction, 1.4),
    entryEnd
  );
  const pose = destination === 'overview' ? overviewPose() : stationPose(target),
    start = pose.position.clone().addScaledVector(vec({ ...world.route.normal(target), y: 0 }), -0.35),
    exit = new THREE.LineCurve3(start, pose.position);
  lastFlightClearance = { paths: [entry, exit], samples: 100 };
  // Arrival: a ripple of light on the deck in front of the stand, or round the central island in overview.
  const landing =
    destination === 'overview'
      ? { x: 0, y: 0.55, z: 0, radius: 11 }
      : (stand => ({ x: stand.x, y: world.route.point(target, 0, 0).y + 0.15, z: stand.z, radius: 4.2 }))(
          world.screenTarget(target)
        );
  const fx = ensureMagic();
  fx.charge(world.portalGeometry, 0.95);
  world.flashPortal?.();
  portalTransit = {
    entry,
    exit,
    pose,
    destination,
    fromLook: origin.look,
    entryLook: vec(world.portalGeometry.center).addScaledVector(direction, -0.4),
    start: performance.now(),
    fx,
    arrival: landing
  };
  // One sound for the whole crossing, timed to it: swell, whoosh at the cut, chime on arrival.
  soundController?.playPortal({ duration: crossingDuration() / 1000, cut: 0.55 });
  updateMode();
  requestRender();
}
// How long a portal crossing takes: the black hole swallows and unfolds a little slower than the plain light
// tunnel.
function crossingDuration() {
  return (bloom?.enabled && !reduced ? 2500 : 1900) * auditJumpScale();
}
// The black hole of a portal crossing: born in the portal's centre on screen, it swallows the view at the
// camera's cut and unfolds the destination from the middle of the screen. False where it cannot be drawn.
const lensPoint = new THREE.Vector3(),
  // Scratch for inFrontOfCamera (near-plane.mjs): the teaser cue, the portal lens and the wipe's centre.
  screenScratch = new THREE.Vector3();
function applyPortalLens(transit, t, now) {
  if (!bloom?.enabled || reduced) return false;
  const shape = lensShape(t);
  let x = 0.5,
    y = 0.5;
  if (t < 0.55 && world.portalGeometry?.center) {
    lensPoint.copy(vec(world.portalGeometry.center));
    if (inFrontOfCamera(camera, lensPoint, screenScratch)) {
      lensPoint.project(camera);
      x = Math.min(0.85, Math.max(0.15, lensPoint.x * 0.5 + 0.5));
      y = Math.min(0.85, Math.max(0.15, lensPoint.y * 0.5 + 0.5));
    }
    // Drift to the screen's middle as the hole grows, so the swallow closes evenly.
    const pull = Math.min(1, Math.max(0, (t - 0.4) / 0.15));
    x += (0.5 - x) * pull;
    y += (0.5 - y) * pull;
  }
  // The horizon grows to the farthest screen corner on wide (21:9 and wider) and tall windows too.
  const aspect = camera.aspect,
    reach = 0.5 * Math.hypot(Math.max(aspect, 1), Math.max(1 / aspect, 1)),
    horizon = shape.horizon * Math.max(1, reach / 1.1);
  return bloom.setLens({ ...shape, horizon, x, y, aspect, time: now / 1000 });
}
function buildBanners() {
  announcements = mountAnnouncements({
    document,
    window,
    container: $('banner-list'),
    dialog: $('banners-dialog'),
    title: $('banners-title'),
    back: $('banners-back'),
    close: $('banners-close'),
    overview: $('overview-announcement'),
    access: $('banners-entry'),
    count: $('banners-count'),
    ribbonTitle: $('overview-announcement-title'),
    ribbonImage: $('overview-announcement-image'),
    ribbonCount: $('overview-announcement-count'),
    ribbonExcerpt: $('overview-announcement-excerpt'),
    records: data.banners || [],
    labels,
    beforeOpen: hidePreferences,
    feedback: attachActionFeedback
  });
}
function step(direction) {
  if (animation || portalTransit || relayout || filteredOut || projects.length < 2) return;
  // Mid-trip, the next one is counted from the pavilion the trip is heading for.
  // From the overview the first step lands on the first pavilion either way (-1 + 1 or 1 - 1).
  let base = selected;
  if (mode === 'overview') base = direction > 0 ? -1 : 1;
  goTo(base + direction, true, false, direction);
}
function animateSurface(element) {
  if (!reduced && element.animate)
    element.animate(
      [
        { opacity: 0.58, transform: 'translateY(3px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ],
      { duration: 200, easing: 'ease-out' }
    );
}
function updateSeasonButtons() {
  for (const name of seasonNames)
    seasonButton(name).setAttribute('aria-pressed', String(name === seasonMode));
  app.dataset.season = season;
  document
    .querySelector('.season-switch')
    ?.style.setProperty('--season-index', seasonNames.indexOf(seasonMode));
  $('season-calendar').textContent =
    seasonMode === 'auto' ? labels.seasonCalendar + ' · ' + labels[season] : labels.seasonManual;
}
function applySeason() {
  season = seasonMode === 'auto' ? calendarSeason() : seasonMode;
  winter = season === 'winter';
  world.setSeason(season);
  skyLife?.setSeason(season);
  updateSeasonButtons();
  requestRender();
}
// The season and the light change the garden, not the visitor's place: they stay available during a balloon
// flight and at a remote dock (owner, round 9: they had been locked with the navigation).
function setSeason(value) {
  seasonMode = value;
  savePreference('season', value);
  applySeason();
  const url = new URL(location.href);
  if (value === 'auto') url.searchParams.delete('season');
  else url.searchParams.set('season', value);
  history.replaceState(history.state, '', url);
  if (!reduced && canvas.animate)
    canvas.animate([{ opacity: 0.6 }, { opacity: 1 }], { duration: 360, easing: 'ease-out' });
}
function lightState() {
  return {
    backdrop: world.backdrop.getLight(),
    ribbon: world.ribbonMaterial.opacity,
    sky: Object.fromEntries(
      ['top', 'horizon', 'low', 'redNear', 'redFar', 'blushTint', 'sunColor'].map(k => [
        k,
        world.skyMaterial.uniforms[k].value.clone()
      ])
    ),
    fog: world.scene.fog.color.clone(),
    ...Object.fromEntries(
      ['ambient', 'key', 'fill'].map(k => [
        k,
        { color: world[k].color.clone(), intensity: world[k].intensity }
      ])
    ),
    neon: Object.fromEntries(['blue', 'violet', 'coral'].map(k => [k, world.palette[k].emissiveIntensity]))
  };
}
function updateSolarStatus() {
  const hint = $('solar-city-status');
  if (!hint) return;
  const now = new Date(),
    state = solarCity ? solarState(now, solarCity) : null;
  const modeLabel =
    timeMode === 'auto' ? labels.seasonAuto : timeMode === 'morning' ? morningLabel() : labels[timeMode];
  const city = SOLAR_CITIES.find(entry => entry.id === solarCity);
  const sourceLabel = city ? city.name[data.locale === 'ru' ? 'ru' : 'en'] : labels.solarLocal;
  const modeSource = modeLabel + ' · ' + sourceLabel + '\n';
  if (!state) {
    hint.textContent = modeSource + (timeMode === 'auto' ? labels.solarLocalHint : labels.timeManual);
    return;
  }
  const locale = data.locale === 'ru' ? 'ru-RU' : 'en-GB';
  const clock = new Intl.DateTimeFormat(locale, {
    timeZone: state.timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  });
  const calendar = new Intl.DateTimeFormat(locale, {
    timeZone: state.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const time = moment => (moment ? clock.format(moment) : '—');
  let riseSet;
  if (state.polar === 'day') riseSet = labels.solarPolarDay;
  else if (state.polar) riseSet = labels.solarPolarNight;
  else riseSet = `${labels.solarRise} ${time(state.sunrise)} · ${labels.solarSet} ${time(state.sunset)}`;
  hint.textContent =
    modeSource +
    calendar.format(now) +
    ' · ' +
    clock.format(now) +
    ' · ' +
    state.timeZone +
    '\n' +
    riseSet +
    '\n' +
    (timeMode === 'auto' ? labels.solarAutoHint : labels.solarManualHint);
}
function bindSolarCity() {
  const select = $('solar-city');
  if (!select) return;
  const option = (value, text) => {
    const entry = document.createElement('option');
    entry.value = value;
    entry.textContent = text;
    select.append(entry);
  };
  option('', labels.solarLocal);
  for (const city of SOLAR_CITIES) option(city.id, city.name[data.locale === 'ru' ? 'ru' : 'en']);
  select.value = solarCity;
  select.addEventListener('change', () => {
    solarCity = SOLAR_CITIES.some(city => city.id === select.value) ? select.value : '';
    savePreference('solar-city', solarCity);
    $('time').value = 'auto';
    $('time').dispatchEvent(new Event('change'));
    $('time').dispatchEvent(new Event('picker-sync'));
  });
  updateSolarStatus();
}
function setLighting() {
  updateSolarStatus();
  const from = lightState();
  lastLighting = lighting(world, presetMode(timeMode), new Date(), lightStyle, solarCity);
  const to = lightState();
  if (!reduced) lightFade = { from, to, start: performance.now() };
  else lightFade = null;
  requestRender();
}
function scheduleClock() {
  clearTimeout(clockTimer);
  clockTimer = 0;
  if (!runtimeAvailable()) return;
  const generation = runtimeGeneration,
    timer = setTimeout(() => {
      if (generation !== runtimeGeneration || clockTimer !== timer) return;
      clockTimer = 0;
      if (!runtimeAvailable()) return;
      if (timeMode === 'auto') setLighting();
      if (seasonMode === 'auto' && season !== calendarSeason()) applySeason();
      updateSolarStatus();
      scheduleClock();
    }, 60000);
  clockTimer = timer;
}
// A name that does not fit on one line where it stands (owner, round 17: at 18 characters the cut-off let
// FenesyyySupport and games.m2023.ru stay beside the Open button and drop their last letter onto a line of its own)
// first takes a slightly smaller font, down to NAME_SHRINK of its own; if even that is too wide it is long and takes
// a line of its own above the button (CSS .long-name). The name's one-line width is measured in its own font; the
// space is the heading's as laid out without .long-name. Checked again whenever its row changes width (shown,
// resized, a phone turned).
const NAME_SHRINK = 0.8;
const nameRows = new Map();
let nameMeter = null,
  nameWatch = null;
function fitLongName(heading) {
  if (!heading?.parentElement) return;
  nameMeter ??= document.createElement('canvas').getContext('2d');
  nameWatch ??= new ResizeObserver(entries => {
    for (const entry of entries) {
      const row = nameRows.get(entry.target),
        width = Math.round(entry.contentRect.width);
      if (row && width !== row.fitWidth) fitLongName(row);
    }
  });
  if (!nameRows.has(heading.parentElement)) {
    nameRows.set(heading.parentElement, heading);
    nameWatch.observe(heading.parentElement);
  }
  heading.fitWidth = Math.round(heading.parentElement.getBoundingClientRect().width);
  heading.classList.remove('long-name');
  heading.style.fontSize = '';
  const space = heading.clientWidth;
  if (!space) return;
  const style = getComputedStyle(heading),
    size = parseFloat(style.fontSize);
  nameMeter.font = style.font;
  nameMeter.letterSpacing = style.letterSpacing === 'normal' ? '0px' : style.letterSpacing;
  // 4 px to spare, so a fitted name never runs up against the button.
  const wide = nameMeter.measureText(heading.textContent).width + 4;
  if (wide <= space + 0.5) return;
  const fit = Math.floor((size * space) / wide);
  if (fit >= Math.ceil(size * NAME_SHRINK)) heading.style.fontSize = fit + 'px';
  else heading.classList.add('long-name');
}
// The canvas takes a new size only when its size or pixel ratio changes: setting it reallocates the drawing buffer
// even at the same size (a hitch), and resize events also come with nothing changed.
function sizeCanvas() {
  const ratio = drawRatio(),
    size = renderer.getSize(new THREE.Vector2());
  if (ratio === renderer.getPixelRatio() && size.x === viewport.width && size.y === viewport.height) return;
  renderer.setPixelRatio(ratio);
  renderer.setSize(viewport.width, viewport.height, false);
}
function resize() {
  if (dialog.open) portalStrip?.sync();
  // A resized canvas is blank until it is drawn again: no break now.
  drawBreakUntil = 0;
  sizeCanvas();
  adaptive?.reset();
  bloom?.setEnabled(graphics === 'ultra' || (graphics === 'high' && !handheld && !mobile()));
  // FXAA where the canvas has no MSAA, except low, which saves every pass it can.
  bloom?.setSmoothing(!canvasMsaa() && graphics !== 'low');
  bloom?.setOcclusion(graphics === 'ultra');
  bloom?.setSize(viewport.width, viewport.height, renderer.getPixelRatio());
  world.setEconomy(economy, graphics === 'medium');
  ultraEffects.applyTo(world);
  $('input-hint').textContent =
    mode === 'overview'
      ? labels.overviewGesture
      : zone === 'gallery'
        ? labels.galleryGesture
        : mobile()
          ? labels.mobileHint
          : labels.hint;
  camera.aspect = viewport.width / viewport.height;
  updateCameraProjection();
  if (mode === 'overview' && !animation && !(scenicFocus?.remoteDock || scenicFocus?.remoteHold)) {
    orbitRange(orbitView, overviewHome());
    overviewFrame();
  } else if (mode === 'journey' && pinnedPose) {
    camera.position.copy(pinnedPose);
  } else if (mode === 'journey' && !animation) {
    const pose = moving
      ? transitPose(current)
      : zone === 'main' || zone === 'gallery'
        ? stationPose(current)
        : world.zonePose(selected, zone);
    camera.position.copy(pose.position);
    if (pose.look) look.copy(pose.look);
  }
  requestRender();
}
function skip() {
  if (ride === 'sky-tour-return') return finishRemoteReturn();
  if (scenicFocus?.remoteDock || scenicFocus?.remoteHold) return returnRemoteTourToOverview();
  if (ride === 'sky-tour') return stopSkyTour();
  if (relayout) return;
  if (ride === 'sky-lift') return showOverview();
  if (ride) return finishRide();
  if (portalTransit) {
    const destination = portalTransit.destination;
    if (destination === 'overview') showOverview(true, true);
    else goTo(portalSelection, true, true);
    return;
  }
  resetTransit();
  if (mode === 'journey') {
    animation = null;
    current = target;
    const pose =
      zone === 'main' || zone === 'gallery' ? stationPose(current) : world.zonePose(selected, zone);
    camera.position.copy(pose.position);
    look.copy(pose.look);
    moving = false;
    updateMode();
    requestRender();
  } else if (animation) {
    const pose = mode === 'portal' ? portalPose() : overviewPose();
    animation = null;
    camera.position.copy(pose.position);
    look.copy(pose.look);
    moving = false;
    portalApproaching = false;
    updateMode();
    requestRender();
  }
}
// Project videos play inside the gallery viewer: one stage (poster, play, player), one toolbar. The stage is
// the element that goes full screen (Fullscreen API), so the player keeps the viewer's own frame and Esc.
let videoProvider = '';
const videoProviders = [
  ['youtube', 'YouTube'],
  ['rutube', 'Rutube'],
  ['vk', 'VK']
];
// Safari before 16.4 has only the webkit-prefixed Fullscreen API, which the DOM types do not declare.
const prefixedDocument = /** @type {any} */ (document);
const fullscreenOwner = () => document.fullscreenElement || prefixedDocument.webkitFullscreenElement || null;
function leaveVideoFullscreen() {
  if (fullscreenOwner()?.closest?.('#gallery-video'))
    (document.exitFullscreen || prefixedDocument.webkitExitFullscreen)?.call(document)?.catch?.(() => {});
}
function updateGalleryVideo(item) {
  const host = $('gallery-video');
  leaveVideoFullscreen();
  host.replaceChildren();
  host.hidden = item?.kind !== 'video' || zone !== 'gallery';
  if (host.hidden) return;
  const video = item.video,
    total = (projects[selected].videos || []).length,
    name = labels.video + ' ' + (item.index + 1) + (total > 1 ? ' / ' + total : '');
  const options = videoProviders
    .map(([key, provider]) => ({ provider, url: video[key], embed: video[key] && videoEmbed(video[key]) }))
    .filter(option => option.url);
  const playable = options.filter(option => option.embed);
  let active = playable.find(option => option.provider === videoProvider) || playable[0] || null;
  const stage = document.createElement('div');
  stage.className = 'video-stage';
  if (video.poster) {
    const poster = document.createElement('img');
    poster.src = video.poster;
    poster.alt = '';
    stage.append(poster);
  }
  const bar = document.createElement('div');
  bar.className = 'video-toolbar';
  const link = document.createElement('a');
  link.className = 'video-open';
  link.target = '_blank';
  link.rel = 'noopener';
  attachActionFeedback(link);
  const syncLink = () => {
    const option = active || options[0];
    if (!option) {
      link.hidden = true;
      return;
    }
    link.href = option.url;
    link.textContent = labels.open + ' ' + option.provider;
    link.title = labels.videoFallback + ': ' + option.provider;
  };
  const choices = [];
  const play = option => {
    active = option;
    videoProvider = option.provider;
    stage.querySelector('iframe')?.remove();
    const frame = document.createElement('iframe');
    frame.title = projects[selected].name + ' · ' + name + ' · ' + option.provider;
    frame.src = option.embed;
    frame.allow = 'fullscreen; autoplay; picture-in-picture; encrypted-media; clipboard-write';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    stage.append(frame);
    stage.classList.add('is-playing');
    for (const [b, o] of choices) b.setAttribute('aria-pressed', String(o === option));
    syncLink();
    animateSurface(stage);
  };
  const caption = document.createElement('span');
  caption.className = 'video-caption';
  caption.textContent = name;
  if (playable.length) {
    const start = document.createElement('button');
    start.type = 'button';
    start.className = 'video-start';
    start.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5-11-6.5Z"/></svg>';
    start.append(caption);
    start.addEventListener('click', () => play(active));
    stage.append(start);
  } else stage.append(caption);
  const exit = document.createElement('button');
  exit.type = 'button';
  exit.className = 'video-exit';
  exit.setAttribute('aria-label', labels.close);
  exit.title = labels.close;
  exit.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 6 8 8m0-8-8 8"/></svg>';
  exit.addEventListener('click', leaveVideoFullscreen);
  stage.append(exit);
  if (playable.length > 1) {
    const group = document.createElement('div');
    group.className = 'video-providers';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', labels.videoPlatform);
    for (const option of playable) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = option.provider;
      button.setAttribute('aria-pressed', String(option === active));
      button.addEventListener('click', () => play(option));
      choices.push([button, option]);
      group.append(button);
    }
    bar.append(group);
  }
  syncLink();
  bar.append(link);
  // Real full screen of the stage. Where the browser has none (iPhone), the player's own button does it.
  const enter = stage.requestFullscreen || /** @type {any} */ (stage).webkitRequestFullscreen,
    canFull = !!enter;
  const full = document.createElement('button');
  full.type = 'button';
  full.className = 'video-full';
  full.setAttribute('aria-label', labels.fullscreen);
  full.title = labels.fullscreen;
  full.hidden = !canFull || !playable.length;
  full.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
  full.addEventListener('click', () => {
    if (fullscreenOwner() === stage) return leaveVideoFullscreen();
    if (!stage.querySelector('iframe') && active) play(active);
    enter.call(stage)?.catch?.(() => {});
  });
  stage.addEventListener('fullscreenchange', () => {
    const on = fullscreenOwner() === stage;
    stage.classList.toggle('is-fullscreen', on);
    full.setAttribute('aria-pressed', String(on));
  });
  bar.append(full);
  host.append(stage, bar);
}
let portalStrip;
function dismissPortalForGlobalAction(event) {
  if (
    !event.target.closest(
      '.garden-header,.garden-footer,.top-context,#route-dots,#previous,#next,#entry-settings'
    )
  )
    return;
  if (dialog.open) {
    dialog.close();
    updateMode();
  }
  // A picker's own trigger toggles it: closing every picker here, before the trigger's click, made the
  // trigger see its menu closed and open it again.
  if (event.target.closest('.control-picker')) {
    $('preferences').hidden = true;
    $('settings').setAttribute('aria-expanded', 'false');
  } else if (!event.target.closest('#settings,#entry-settings')) hidePreferences();
}
// The page's event bindings, in the order they were always made.
function bindEvents() {
  bindHeaderEvents();
  bindGalleryEvents();
  bindSoundEvents();
  bindTravelButtons();
  bindSettingsEvents();
  bindWindowEvents();
  bindKeyboard();
  bindCanvasWheel();
  bindPointer();
  bindPageLifecycle();
}
// The gallery's wheel: one picture per notch (a shared clock), also used by the canvas wheel.
let imageWheelAt = 0;
const galleryWheel = event => {
  event.preventDefault();
  if (performance.now() - imageWheelAt < 170 || Math.abs(event.deltaY) < 2) return;
  imageWheelAt = performance.now();
  changeImage(Math.sign(event.deltaY));
};
// The header, the modeless project chooser and the hover lights on every glass button.
function bindHeaderEvents() {
  // The announcement card sits a fixed gap left of the header controls, whose width follows the language.
  const headerActions = /** @type {HTMLElement | null} */ (document.querySelector('.header-actions'));
  if (headerActions && typeof ResizeObserver === 'function')
    new ResizeObserver(() =>
      app.style.setProperty('--header-actions-width', headerActions.offsetWidth + 'px')
    ).observe(headerActions);
  // The trip's status, the entry and the project card stand above the journey bar, whose height follows the screen
  // (garden.css). Its layout box, not its rect: the rise animation replays each time an open card gives the bar back.
  const journeyBar = /** @type {HTMLElement | null} */ (document.querySelector('.journey-bar'));
  if (journeyBar && typeof ResizeObserver === 'function')
    new ResizeObserver(() => {
      if (journeyBar.offsetHeight)
        app.style.setProperty('--journey-bar-top', app.offsetHeight - journeyBar.offsetTop + 'px');
    }).observe(journeyBar);
  // A project chooser is modeless. Global actions dismiss it without stealing focus.
  document.addEventListener('click', dismissPortalForGlobalAction, true);
  bindCleanView();
  portalStrip = createPortalDial({
    dialog,
    sigils: $('portal-projects'),
    go: $('portal-go'),
    dock: document.querySelector('.journey-bar'),
    getSelected: () => (portalToOverview || !projects.length ? 0 : portalSelection + 1),
    onSelect: previewSlot,
    onCharge: chargePortal,
    onFire: () => travelPortal(portalToOverview ? 'overview' : 'project'),
    isReduced: () => reduced,
    // A low wide screen has the phone's row of sigils too (garden-ui-panels.css).
    isCompact: () => mobile() || viewport.height <= 359,
    win: window
  });
  for (const link of document.querySelectorAll('a[target="_blank"],.garden-footer a,.site-version-link'))
    attachActionFeedback(link);
  // One hover light per floating group, so buttons other features add to the dock light up the same way.
  // Panels and dialogs too, so their glass chips, close orbs and switch rows (labels) light the same way.
  for (const group of document.querySelectorAll(
    '.garden-header,.top-context,.garden-utilities,.journey-bar,.garden-footer,#arrange-panel,#preferences,' +
      '#project-card,#media-viewer,#garden-empty,.portal-dialog,.banners-dialog,.image-dialog,' +
      '.overview-announcement'
  ))
    bindPointerLight(group, { selector: 'button,a,summary,label', isReduced: () => reduced });
  $('teaser-entry')?.addEventListener('click', () => inspectTeaser());
  for (const id of [
    'project-link',
    'project-repository',
    'gallery-original',
    'comments-link',
    'teaser-entry',
    'start'
  ])
    attachActionFeedback($(id));
  $('detail-close').addEventListener('click', () => {
    if (relayout) return;
    const el = zone === 'gallery' ? $('media-viewer') : $('project-card');
    foldExhibit(el, lastExhibitRect, () => showZone('main'));
  });
  $('media-close').addEventListener('click', () => $('detail-close').click());
  $('preferences-close').addEventListener('click', () => {
    $('preferences').hidden = true;
    $('settings').setAttribute('aria-expanded', 'false');
    $('settings').focus();
  });
  $('look-reset').addEventListener('click', () => {
    freeLook = false;
    lookYaw = lookPitch = 0;
    look.copy(mode === 'portal' ? vec(world.portalGeometry.center) : world.screenTarget(Math.round(current)));
    updateMode();
    requestRender();
  });
}
// The greenhouse tab, the media viewer and the dive into the garden.
function bindGalleryEvents() {
  // In a greenhouse the first tab reads "Gallery" and opens the pictures at once. Owner, 2026-10-31: on a phone
  // it only lit up, and the gallery opened only from a tap on the hall screen, which nobody guessed.
  document
    .querySelectorAll('[data-zone]')
    .forEach(button =>
      button.addEventListener('click', () =>
        showZone(
          button.dataset.zone === 'main' && world.isGreenhouse?.(selected) ? 'gallery' : button.dataset.zone
        )
      )
    );
  $('gallery-previous').addEventListener('click', () => changeImage(-1));
  $('gallery-next').addEventListener('click', () => changeImage(1));
  const viewer = $('media-viewer');
  viewer.addEventListener(
    'wheel',
    event => {
      event.stopPropagation();
      galleryWheel(event);
    },
    { passive: false }
  );
  let viewerDragged = false;
  bindGalleryGesture(viewer, $('gallery-expand'), {
    isActive: () => zone === 'gallery' && !moving && !viewer.hidden && !$('gallery-expand').hidden,
    onChange: changeImage,
    onDragged: value => (viewerDragged = value),
    isReduced: () => reduced
  });
  $('gallery-expand').addEventListener('click', event => {
    if (viewerDragged && event.detail !== 0) {
      event.preventDefault();
      viewerDragged = false;
      return;
    }
    expandImage();
  });
  $('image-close').addEventListener('click', collapseImage);
  $('image-dialog').addEventListener('cancel', event => {
    event.preventDefault();
    collapseImage();
  });
  viewer.addEventListener('keydown', event => {
    if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      changeImage(event.key === 'ArrowRight' ? 1 : -1);
    }
  });
  // The dive class lands before the intro hides, so the ripple and the intro's exit start in one frame.
  bindEntryDive($('start'), { isReduced: () => reduced });
  $('start').addEventListener('click', enterGarden);
  $('previous').addEventListener('click', () => step(-1));
  $('next').addEventListener('click', () => step(1));
  $('overview').addEventListener('click', () => showOverview());
}
// Music and nature sounds, and their pause while a video plays.
function bindSoundEvents() {
  // Calm generated music and nature sounds (ambient-music.mjs, nature-sounds.mjs): on by default, start with
  // the first gesture; the dock button switches both, Settings › Sound switches each one.
  const music = (soundController = mountAmbientMusic($('music'), {
    labels,
    musicInput: $('sound-music'),
    natureInput: $('sound-nature'),
    natureContext: readNatureView
  }));
  // An embedded video brings its own sound, so the music waits while a player frame is on the page.
  if (music) {
    const players = [$('gallery-video')],
      syncMusic = () => music.setPaused(players.some(host => host.querySelector('iframe')));
    const watcher = new MutationObserver(syncMusic);
    for (const host of players) watcher.observe(host, { childList: true, subtree: true });
  }
}
// The dock buttons that travel: the observatory lift, the portal chooser and its dial.
function bindTravelButtons() {
  // Observatory (in every garden unless ?sky=off): a dock button next to the Portal rides the lift up to the sky island.
  if (world.skyIsland) {
    const sky = document.createElement('button');
    sky.id = 'sky-entry';
    sky.type = 'button';
    sky.className = 'portal-button';
    rideLabel(sky, 'telescope', labels.skyIsland || 'Observatory');
    $('portal').before(sky);
    sky.addEventListener('click', () => rideSkyLift());
    // On the terrace a second button boards the tour balloon; during the flight a large pill ends it.
    const tour = document.createElement('button');
    tour.id = 'sky-tour';
    tour.type = 'button';
    tour.className = 'portal-button';
    rideLabel(tour, 'tour', labels.skyTour || 'Balloon flight');
    tour.hidden = true;
    sky.before(tour);
    tour.addEventListener('click', () => rideSkyTour());
    const stop = document.createElement('button');
    stop.id = 'sky-tour-stop';
    stop.type = 'button';
    stop.className = 'sky-tour-stop';
    stop.textContent = '✕  ' + (labels.skyTourStop || 'End the flight');
    stop.hidden = true;
    app.append(stop);
    stop.addEventListener('click', stopSkyTour);
  }
  // The Portal button toggles its chooser, like the other panels.
  $('portal').addEventListener('click', () => (dialog.open ? closePortal() : openPortal()));
  $('portal-close').addEventListener('click', closePortal);
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    closePortal();
  });
  // «Перейти» charges and travels through the rune dial (portal-dial.mjs).

  $('skip').addEventListener('click', skip);
  $('entry-settings').addEventListener('click', () => {
    $('preferences').hidden = false;
    $('settings').setAttribute('aria-expanded', 'true');
    $('preferences-close').focus();
  });
  document.addEventListener('pointerdown', event => {
    if (!event.target.closest('#movement-help')) $('movement-help').open = false;
  });
  $('movement-help').addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      $('movement-help').open = false;
      $('movement-help').querySelector('summary').focus();
    }
  });
}
// Settings: their sections, preferences, graphics quality, language and time of day.
function bindSettingsEvents() {
  // Settings sections: the last one a visitor opened comes back next time.
  bindSettingsTabs($('settings-tabs'), {
    storage: {
      getItem: () => safePreference('settings-tab'),
      setItem: (_, value) => savePreference('settings-tab', value)
    }
  });
  $('settings').addEventListener('click', () => {
    setArrangeOpen(false);
    const expanded = $('settings').getAttribute('aria-expanded') !== 'true';
    $('settings').setAttribute('aria-expanded', String(expanded));
    $('preferences').hidden = !expanded;
  });
  prefs.addEventListener('change', event => {
    reduced = event.matches;
    if (reduced) skip();
    app.classList.toggle('reduce-motion', reduced);
    fireworks?.setReduced(reduced);
    requestRender();
  });
  bindGraphicsQuality();
  bindLanguageChoice();
  $('time').value = TIME_MODES.includes(timeMode) ? timeMode : 'auto';
  timeMode = $('time').value;
  $('time').addEventListener('change', () => {
    timeMode = $('time').value;
    const url = new URL(location.href);
    if (timeMode === 'auto') url.searchParams.delete('time');
    else url.searchParams.set('time', timeMode);
    history.replaceState(history.state, '', url);
    setLighting();
  });
}
// Settings → graphics: the four levels (each with its hint and the recommended one), and automatic quality.
function bindGraphicsQuality() {
  const graphicsLabel = g => labels['graphics' + g[0].toUpperCase() + g.slice(1)];
  const syncGraphics = () => {
    $('graphics-quality').style.setProperty('--segment-index', GRAPHICS.indexOf(graphics));
    GRAPHICS.forEach(g => $('graphics-' + g).setAttribute('aria-pressed', String(g === graphics)));
    $('graphics-hint').textContent =
      labels['graphics' + graphics[0].toUpperCase() + graphics.slice(1) + 'Hint'] +
      ' ' +
      labels.graphicsRecommended.replace('{0}', graphicsLabel(recommendedGraphics).toLowerCase()) +
      (levelMsaa(graphics) !== canvasMsaa() ? ' ' + labels.graphicsReload : '');
  };
  bindSegmentedChoice($('graphics-quality'), {
    getSelected: () => GRAPHICS.indexOf(graphics),
    onSelect: i => {
      graphics = GRAPHICS[i];
      savePreference('graphics', graphics);
      economy = graphics === 'low';
      skyLife?.setEconomy(economy);
      fireworks?.setEconomy(mobile() || economy);
      world.visitor?.setEconomy?.(economy);
      syncGraphics();
      updateQuality();
      resize();
    }
  });
  syncGraphics();
  $('auto-quality').addEventListener('change', () => {
    autoQuality = $('auto-quality').matches(':checked');
    savePreference('auto-quality', autoQuality);
    // Switched off: back to the full resolution at the next frame.
    if (!autoQuality && adaptive && (adaptiveScale < 1 || adaptivePending !== null))
      adaptivePending = adaptive.restore();
    adaptive?.reset();
    updateQuality();
    requestRender();
  });
  updateQuality();
}
// Settings → language: a page of its own where the site has one, else the server switches the locale and the
// page reloads (held back while a remote dock transition runs; the choice is restored if it fails).
function bindLanguageChoice() {
  $('language').addEventListener('change', async () => {
    const select = $('language');
    if (rejectRemoteDockNavigation()) {
      select.value = data.locale;
      select.dispatchEvent(new Event('picker-sync'));
      return;
    }
    if (languageChangePending) return;
    languageChangePending = true;
    select.disabled = true;
    try {
      const page = data.localePages?.[select.value];
      if (page) {
        location.href = page + location.hash;
        return;
      }
      const response = await fetch('/api/translate/locale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: select.value })
      });
      if (!response.ok) throw new Error('Locale ' + response.status);
      if (remoteDockTransitionLocked()) {
        pendingLanguageReload = true;
        return;
      }
      const url = new URL(location.href);
      url.searchParams.delete('lang');
      history.replaceState(history.state, '', url);
      location.reload();
    } catch (error) {
      console.error(error);
      languageChangePending = false;
      select.disabled = false;
      select.value = data.locale;
      select.dispatchEvent(new Event('picker-sync'));
    }
  });
}
// The window: resize, focus, visibility and the browser history.
function bindWindowEvents() {
  window.addEventListener('resize', resize);
  window.addEventListener('focus', () => {
    cancelRenderWork();
    requestRender();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) suspendRuntime();
    else resumeRuntime();
  });
  window.addEventListener('popstate', () => {
    if (remoteDockTransitionLocked()) {
      // The browser has already moved its history pointer. Retain that entry untouched and defer applying it.
      deferredRemoteHistory = true;
      rejectRemoteDockNavigation();
      return;
    }
    if (announcements?.handlePopstate()) return;
    const params = new URLSearchParams(location.search),
      nextSeason = readSeason(),
      rawTime = params.get('time') || 'auto',
      nextTime = TIME_MODES.includes(rawTime) ? rawTime : 'auto';
    if (nextSeason !== seasonMode) {
      seasonMode = nextSeason;
      applySeason();
    }
    if (nextTime !== timeMode) {
      timeMode = nextTime;
      $('time').value = timeMode;
      $('time').dispatchEvent(new Event('picker-sync'));
      setLighting();
    }
    // Filters are part of the query too; the hash is applied again once their garden has settled.
    const nextFilters = parseFilterState(location.search);
    if (filterSearch(nextFilters) !== filterSearch(filters)) {
      historyPending = true;
      setFilters(nextFilters);
    }
    // A rearrangement owns the camera: Back/Forward waits for the new garden.
    if (relayout) {
      historyPending = true;
      return;
    }
    const hash = readHash();
    // Leaving an island hidden by the new filters goes through the overview, where the garden rearranges first.
    if (filteredOut && !(hash.kind === 'project' && projects[hash.index]?.id === filteredOut.id)) {
      historyPending = true;
      showOverview(false);
      return;
    }
    // Media history changes the open exhibit in place, retaining the reader's view.
    if (
      hash.kind === 'project' &&
      hash.index === selected &&
      mode === 'journey' &&
      zone === 'gallery' &&
      !moving &&
      !animation &&
      hash.zone === zone
    ) {
      galleryImage = hash.image;
      updateSection();
      requestRender();
      return;
    }
    // Browser Back can arrive before the portal trip completes. Cancel it before restoring the hash.
    if (portalTransit) resetTransit();
    applyHash(hash);
  });
}
// Keyboard navigation and shortcuts.
function bindKeyboard() {
  window.addEventListener('keydown', onKey);
  function onKey(event) {
    // Keys sent to the window itself (no focused element) are treated as sent to the page body.
    const target = typeof event.target?.closest === 'function' ? event.target : document.body;
    // Escape ends the balloon tour or skips to a ride's end; every other key waits for the ride.
    if (ride === 'sky-tour' && event.key === 'Escape') return stopSkyTour();
    if (ride && event.key === 'Escape') return skip();
    if (ride && !target.closest('input,textarea,select')) return;
    if (
      (target.closest('#preferences,#movement-help,#arrange-panel') && event.key !== 'Escape') ||
      target.closest('.control-picker,.segmented-choice') ||
      (target.closest('#zone-content') && event.key !== 'Escape')
    )
      return;
    if (dialog.open) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePortal();
      }
      return;
    }
    if ($('banners-dialog').open || $('image-dialog').open || target.matches('select,input,textarea')) return;
    if (hiddenInterfaceKey(event, target) || overviewKey(event)) return;
    if (mode === 'journey' && zone === 'gallery' && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      changeImage(event.key === 'ArrowRight' ? 1 : -1);
      return;
    }
    if (travelKey(event)) return;
    if (event.key === 'Escape') escapeBack();
  }
  function hiddenInterfaceKey(event, target) {
    // Hidden interface: Escape brings it back first; H (no modifiers) toggles it on a keyboard.
    if (uiHidden && event.key === 'Escape') {
      event.preventDefault();
      setUiHidden(false);
      return true;
    }
    if (
      event.code === 'KeyH' &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      !event.repeat &&
      !target.closest('[contenteditable],#zone-content')
    ) {
      event.preventDefault();
      setUiHidden(!uiHidden);
      return true;
    }
    return false;
  }
  // The overview: arrows turn, + / - (Page Up / Down) zoom toward the middle, Home goes back to the start.
  function overviewKey(event) {
    if (
      mode === 'overview' &&
      ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', '+', '=', '-', 'PageUp', 'PageDown'].includes(
        event.key
      )
    ) {
      event.preventDefault();
      // On the observatory terrace the arrows turn and look like a visitor: right turns right, up looks up.
      // Elsewhere they follow the camera direction setting, like a drag.
      const flip = scenicFocus?.terrace ? -1 : dragSign(cameraDirection),
        closer = ['+', '=', 'PageUp'].includes(event.key),
        farther = ['-', 'PageDown'].includes(event.key);
      orbit(
        flip * (event.key === 'ArrowRight' ? 40 : event.key === 'ArrowLeft' ? -40 : 0),
        flip * (event.key === 'ArrowDown' ? 30 : event.key === 'ArrowUp' ? -30 : 0),
        closer ? -0.08 : farther ? 0.08 : 0,
        null,
        // Keys zoom toward the middle of the screen.
        { x: viewport.width / 2, y: viewport.height / 2 }
      );
      return true;
    }
    if (mode === 'overview' && event.key === 'Home' && !scenicFocus) {
      event.preventDefault();
      showOverview(false);
      return true;
    }
    return false;
  }
  function travelKey(event) {
    // At a pavilion or on the way: left / right (A / D) travel to the previous / next project.
    const direction = { KeyD: 1, ArrowRight: 1, KeyA: -1, ArrowLeft: -1 }[event.code];
    if (
      (mode === 'journey' || mode === 'portal') &&
      zone === 'main' &&
      direction &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
      if (!event.repeat) step(direction);
      return true;
    }
    return false;
  }
  // Escape: closes the settings, skips to the arrival, goes back from a section to the pavilion, or out to the
  // overview.
  function escapeBack() {
    if (!$('preferences').hidden) {
      $('preferences').hidden = true;
      $('settings').setAttribute('aria-expanded', 'false');
    }
    // On the way somewhere, Escape jumps to the arrival.
    else if (moving || portalTransit) skip();
    // From the gallery, Description or Comments, Escape goes back to the pavilion, not out to the overview.
    else if (mode === 'journey' && zone !== 'main') $('detail-close').click();
    else showOverview();
  }
}
// The wheel on the scene: overview zoom, gallery pictures and looking round.
function bindCanvasWheel() {
  canvas.addEventListener(
    'wheel',
    event => {
      if (ride) return;
      if (
        mode === 'journey' &&
        !moving &&
        ['main', 'gallery'].includes(zone) &&
        galleryHit(event.clientX, event.clientY)
      ) {
        if (zone === 'main') showZone('gallery');
        galleryWheel(event);
        return;
      }
      if (dialog.open) return;
      event.preventDefault();
      if (mode === 'overview') {
        // Lines and pages scroll in bigger units than pixels; the zoom follows the point under the cursor.
        const unit = event.deltaMode === 1 ? 33 : event.deltaMode === 2 ? 400 : 1;
        orbit(0, 0, THREE.MathUtils.clamp(event.deltaY * unit, -240, 240) * 0.00045, null, {
          x: event.clientX,
          y: event.clientY
        });
        return;
      }
      if (event.ctrlKey) return;
      if (animation || portalTransit) return;
      // Empty canvas scroll must not replay a flight to the current pavilion.
      // The screenshot hit region handles image browsing above; route travel starts in main.
      if (mode !== 'journey' || zone !== 'main') return;
      // Wheel input never selects or launches a project. Walking remains explicit.
    },
    { passive: false }
  );
}
// Pointer and touch: dragging, pinching, taps and double taps on the scene.
function bindPointer() {
  // One pointer drags (overview: turns the garden; elsewhere: looks round), two fingers pinch the overview
  // zoom toward their midpoint. A tap picks, or skips a trip that is under way. Lifting one finger of a pinch
  // hands the drag to the other. On the scene even a quick sideways swipe only looks round: the next project is
  // a swipe across the project card (bindProjectCardSwipe), the next picture one across the stand's screen
  // (owner, round 9: a brisk turn of the view sometimes changed the project).
  // doubleTap / doubleSlop: two taps this close in time (ms) and space (px) focus the overview on a thing.
  const DRAG = { start: 9, doubleTap: 340, doubleSlop: 30 };
  let lastTap = null;
  let pointer = null,
    dragged = false,
    pinch = null;
  const touches = new Map();
  const follow = (id, x, y, time, drag = false) => {
    pointer = { id, touch: true, x, y, lastX: x, lastY: y, at: time, gallery: false };
    dragged = drag;
  };
  const release = (time = 0) => {
    orbitHold(orbitView, false, time);
    travelLook.holding = false;
  };
  canvas.addEventListener('pointerdown', startGesture);
  canvas.addEventListener('pointermove', moveGesture);
  canvas.addEventListener('pointerup', endGesture);
  canvas.addEventListener('pointerleave', () => setPortalHovered(false));
  canvas.addEventListener('pointercancel', event => {
    touches.delete(event.pointerId);
    if (touches.size < 2) pinch = null;
    if (!pointer || pointer.id === event.pointerId) {
      pointer = null;
      release();
    }
  });
  // Only the captured pointer itself ends the drag (a pinch's second finger used to end the first one's).
  canvas.addEventListener('lostpointercapture', event => {
    touches.delete(event.pointerId);
    if (touches.size < 2) pinch = null;
    if (pointer?.id === event.pointerId) {
      pointer = null;
      release();
    }
  });
  window.addEventListener('blur', () => {
    touches.clear();
    pinch = pointer = null;
    release();
  });
  // A finger or the mouse goes down: a second finger turns the drag into a pinch; otherwise a drag or a tap
  // begins (on the stand's screen, a gallery gesture).
  function startGesture(event) {
    if (dialog.open) return;
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    // Capture can fail for a pointer the browser no longer tracks; the gesture still works without it.
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {}
    if (touches.size === 2 && pointer) {
      const [a, b] = [...touches.values()];
      pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y) };
      dragged = true;
      pointer = null;
      return;
    }
    if (touches.size > 1 || !event.isPrimary) return;
    pointer = {
      id: event.pointerId,
      touch: event.pointerType === 'touch',
      x: event.clientX,
      y: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      at: event.timeStamp,
      gallery:
        mode === 'journey' &&
        !moving &&
        ['main', 'gallery'].includes(zone) &&
        galleryHit(event.clientX, event.clientY)
    };
    dragged = false;
    // Grabbing the scene stops a coasting turn.
    if (mode === 'overview') orbitHold(orbitView, true);
  }
  // The mouse hovers the portal; a pinch zooms the overview; past DRAG.start pixels a press becomes a drag that
  // turns the overview (or looks round the balloon basket) or looks round elsewhere.
  function moveGesture(event) {
    if (!pointer && event.pointerType === 'mouse') hoverPortal(event.clientX, event.clientY, event.timeStamp);
    if (touches.has(event.pointerId)) touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch) {
      if (touches.size !== 2) return;
      const [a, b] = [...touches.values()],
        distance = Math.hypot(a.x - b.x, a.y - b.y),
        // The ratio since the last move works the overview zoom and the observatory telescope alike.
        lens = (pinch.last ?? pinch.distance) / Math.max(1, distance);
      pinch.last = distance;
      if (mode === 'overview') orbit(0, 0, 0, lens, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      return;
    }
    if (!pointer || pointer.id !== event.pointerId) return;
    const moveX = event.clientX - pointer.lastX,
      moveY = event.clientY - pointer.lastY;
    pointer.lastX = event.clientX;
    pointer.lastY = event.clientY;
    if (!dragged && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > DRAG.start)
      dragged = true;
    if (!dragged || pointer.gallery) return;
    // Settings → Управление: the inverted (default) direction grabs the world, the normal one turns the camera.
    const sign = dragSign(cameraDirection);
    // In the balloon (boarded from anywhere) a drag looks round the basket.
    if (mode === 'overview' || ride === 'sky-tour')
      orbit(moveX * sign, moveY * sign, 0, null, null, event.timeStamp);
    else if (mode === 'journey' || mode === 'portal') nudgeLook(moveX * sign, moveY * sign, event.timeStamp);
  }
  // Lifting: the end of a pinch hands over to the finger left; a drag on the stand's screen opens the gallery;
  // a tap skips a trip under way or picks, and two taps on nothing pickable focus the overview there.
  function endGesture(event) {
    touches.delete(event.pointerId);
    if (pinch) {
      if (touches.size < 2) pinch = null;
      // The finger left on the glass carries on turning; no tap, no jump.
      const [rest] = [...touches.entries()];
      if (rest) follow(rest[0], rest[1].x, rest[1].y, event.timeStamp, true);
      if (mode === 'overview') orbitHold(orbitView, !!rest);
      return;
    }
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = pointer.x - event.clientX,
      dy = pointer.y - event.clientY;
    const tapped = !dragged;
    if (dragged && pointer.gallery) {
      // A drag on the stand's screen opens the gallery; only a sideways one also turns the picture.
      if (zone === 'main') showZone('gallery');
      if (Math.abs(dx) > Math.abs(dy)) changeImage(dx > 0 ? 1 : -1);
    } else if (tapped && mode === 'journey' && moving) skip();
    else if (tapped && !pick(event.clientX, event.clientY) && mode === 'overview') {
      // A second tap on something that is not a link (a tree, a hall, the lawn) makes it the pivot.
      const at = { x: event.clientX, y: event.clientY, time: event.timeStamp };
      if (
        lastTap &&
        at.time - lastTap.time < DRAG.doubleTap &&
        Math.hypot(at.x - lastTap.x, at.y - lastTap.y) < DRAG.doubleSlop
      ) {
        lastTap = null;
        focusOverview(at.x, at.y);
      } else lastTap = at;
    }
    release(event.timeStamp);
    pointer = null;
  }
}
// The WebGL context lost and restored, and the page put away and shown again (back-forward cache).
function bindPageLifecycle() {
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    if (alive.disposed) return;
    contextLost = true;
    renderer.gardenFrameProbe?.lost();
    suspendRuntime();
    $('loader').hidden = false;
    $('load-message').textContent = labels.loading;
  });
  canvas.addEventListener('webglcontextrestored', () => {
    if (alive.disposed) return;
    contextLost = false;
    renderer.gardenFrameProbe?.restored();
    $('loader').hidden = true;
    resumeRuntime();
  });
  window.addEventListener('pagehide', handlePageHide);
  window.addEventListener('pageshow', handlePageShow);
}
// Tall-islands preview: hang under the cable from the tower to the far island, then stand at its pavilion.
// Observatory: the balloon shuttle winches the visitor up from its pad beside the central island to the
// sky island's pier, then they step onto the terrace and look over the whole garden (sky-island.mjs).
function rideSkyLift() {
  if (rejectRemoteDockNavigation()) return;
  const sky = world.skyIsland;
  if (!sky || animation || portalTransit || relayout) return;
  // Already up on the observatory: clicking its ground does nothing (the zipline leads down).
  if (scenicFocus?.lookAround) return;
  resetTransit();
  ride = 'sky-lift';
  hidePreferences();
  if (dialog.open) dialog.close();
  const { base, stage, pier } = sky.lift,
    view = sky.view,
    stageAt = vec(stage),
    basketAt = new THREE.Vector3(base.x, base.y + 1.6, base.z);
  // From far away, fly to the shuttle on its pad first (the flight arcs over the central tree), then ride.
  if (camera.position.distanceTo(stageAt) > 6) {
    mode = 'overview';
    scenicFocus = null;
    moving = false;
    updateMode();
    fly({ position: stageAt, look: basketAt }, 1500, () => {
      ride = null;
      rideSkyLift();
    });
    return;
  }
  // A ride is an animation, not a walk: no 'walking over the bridge' status or skip button.
  mode = 'overview';
  scenicFocus = null;
  moving = false;
  updateMode();
  // Three legs: step into the basket, ride up looking out at the horizon (turning to the deck near the top),
  // then cross the pier onto the terrace that turns to the garden below.
  const inside = new THREE.Vector3(),
    outward = new THREE.Vector3();
  sky.shuttlePose(0, inside, outward);
  const terrace = () => {
    animation = {
      curve: new THREE.CatmullRomCurve3(
        [camera.position.clone(), vec(pier), view.position.clone()],
        false,
        'centripetal'
      ),
      fromLook: look.clone(),
      toLook: view.center.clone(),
      fromQuaternion: camera.quaternion.clone(),
      toQuaternion: aimQuaternion(THREE, view.position, view.center),
      start: performance.now(),
      duration: reduced ? 0 : 2200,
      done: () => {
        sky.releaseShuttle(reduced || economy);
        standOnTerrace(terraceState(view));
      }
    };
    requestRender();
  };
  const up = () => {
    animation = {
      pose: t => sky.shuttlePose(t, camera.position, look),
      start: performance.now(),
      duration: reduced ? 0 : 7500,
      done: terrace
    };
    requestRender();
  };
  animation = {
    curve: new THREE.LineCurve3(camera.position.clone(), inside.clone()),
    fromLook: look.clone(),
    toLook: outward.clone(),
    fromQuaternion: camera.quaternion.clone(),
    toQuaternion: aimQuaternion(THREE, inside, outward),
    start: performance.now(),
    duration: reduced ? 0 : 1300,
    done: up
  };
  requestRender();
}
// Stand at the railing; dragging walks round the rim, the wheel works the telescope.
function standOnTerrace(terrace) {
  const view = world.skyIsland.view;
  ride = null;
  scenicFocus = {
    position: view.position.clone(),
    center: view.center.clone(),
    lookAround: true,
    terrace
  };
  resetOrbit(orbitView, true);
  app.classList.add('is-exploring');
  moving = false;
  updateMode();
  requestRender();
}
// Observatory: walk the rim to the tour dock, step into the basket and fly once round the whole garden
// standing in it (sky-island.mjs moves the balloon and poses the eye; a drag looks round). Stop turns the
// balloon back to the station; while it flies home, the same button (or Escape) skips straight to the dock.
function completeRemoteOverview() {
  if (pendingLanguageReload) {
    pendingLanguageReload = false;
    deferredRemoteHistory = false;
    const url = new URL(location.href);
    url.searchParams.delete('lang');
    history.replaceState(history.state, '', url);
    location.reload();
    return;
  }
  if (deferredRemoteHistory) {
    deferredRemoteHistory = false;
    window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
  } else writeHash('overview');
}
// Skip during the jump back: land in the overview at once.
function finishRemoteReturn() {
  if (ride !== 'sky-tour-return' || !animation) return;
  finishRide();
}
// Magic gate jump from wherever the camera is to `to` ({ position, look }). First a portal opens in front of
// the visitor (the standing gate `through`, or a ring of its own a few steps ahead), they step into it, a light
// tunnel and a flash cover the cut (`onCut` changes the world there, unseen), and they step out of the far ring
// (the gate `exit`, or a ring of its own just behind the arrival) onto the destination view.
// through / exit: { key, centre, normal } of a sky-island magic gate.
// ahead: where our own ring opens in front of the visitor; beyond: how far past a ring the step in goes;
// behind: the visitor arrives this far behind the far ring, far enough to see it whole, and walks out through
// it; past: where our own far ring stands before the destination view.
const JUMP = {
  duration: 2600,
  ahead: 4.2,
  motes: 40,
  radius: 1.15,
  beyond: 0.35,
  behind: 2.4,
  past: 1,
  // Ending a flight in the basket: the ring opens right in front of the visitor at the front rim, smaller, instead
  // of out in the air beyond the balloon (owner, round 3: «представлял его перед собой/в корзине»).
  basket: { ahead: 0.95, drop: 0.22, scale: 0.52 }
};
let jumpPortal = null;
// Audits may slow jumps and portal crossings (__gardenDebug.jumpScale) to capture their moments.
function auditJumpScale() {
  const debug = auditEnabled ? /** @type {any} */ (window).__gardenDebug : null;
  return Number(debug?.jumpScale) || 1;
}
function jumpDuration() {
  if (reduced) return 0;
  return JUMP.duration * auditJumpScale();
}
function ownJumpPortal() {
  jumpPortal ??= createPocketPortal(THREE, { radius: JUMP.radius, style: 'rune' });
  if (jumpPortal.mesh.parent !== world.scene) world.scene.add(jumpPortal.mesh);
  return jumpPortal;
}
// `to` is the destination pose, or a function returning it: it is read at the cut, after `onCut` has changed the
// world (the overview's default view only exists once the orbit is reset there).
function magicJump(to, done, { through = null, exit = null, onCut = null, near = null } = {}) {
  const from = camera.position.clone(),
    fromLook = look.clone(),
    forward = fromLook.clone().sub(from).normalize(),
    level = new THREE.Vector3(forward.x, 0, forward.z).normalize(),
    gates = world.skyIsland?.magicGate;
  // The ring stepped into (a gate, our own ring ahead, or `near`: close in front at eye level less `drop`), and the
  // point just through it.
  const ahead = near
      ? from
          .clone()
          .addScaledVector(level, near.ahead)
          .setY(from.y - near.drop)
      : from.clone().addScaledVector(forward, JUMP.ahead),
    door = through ? vec(through.centre) : ahead,
    doorDir = door.clone().sub(from).normalize(),
    inside = door.clone().addScaledVector(doorDir, JUMP.beyond);
  // Where the visitor lands, the far ring, and the point behind it where they appear (set at the cut).
  let target = null,
    aim = null,
    exitAt = null,
    exitDir = null,
    outOf = null;
  const land = () => {
    const pose = typeof to === 'function' ? to() : to;
    target = vec(pose.position);
    aim = vec(pose.look);
    const arriveDir = aim.clone().sub(target).normalize();
    exitAt = exit ? vec(exit.centre) : target.clone().addScaledVector(arriveDir, -JUMP.past);
    exitDir = exit ? vec(exit.normal) : arriveDir;
    outOf = exitAt.clone().addScaledVector(exitDir, -JUMP.behind);
  };
  let fx = null,
    own = null,
    cut = false;
  try {
    fx = reduced ? null : ensureMagic();
    own = reduced ? null : ownJumpPortal();
  } catch {
    fx = own = null; // A missing effect never strands the visitor.
  }
  // Our own ring faces the visitor; a gate already stands the right way.
  const placeOwn = (at, facing, size = 1) => {
    if (!own) return;
    own.mesh.position.copy(at);
    own.mesh.lookAt(facing);
    own.mesh.scale.setScalar(size);
  };
  if (!through) placeOwn(door, from, near?.scale);
  soundController?.playPortal?.({ duration: jumpDuration() / 1000, cut: MAGIC_JUMP_CUT });
  const fade = $('portal-fade');
  const atCut = () => {
    cut = true;
    try {
      onCut?.();
    } catch (error) {
      console.error(error); // The jump finishes whatever the world change does.
    }
    land();
    if (through) gates?.drive(through.key, 0);
    if (!exit) placeOwn(exitAt, exitAt.clone().sub(exitDir));
    fx?.ripple(target.x, target.y - 1.6, target.z, 1.8, 1.1);
    fx?.burst(exitAt.x, exitAt.y, exitAt.z, JUMP.motes, { radius: 1.2, speed: 1.2, up: 1.4 });
  };
  // Whatever ends the jump (its end, a skip, or End flight cutting it short) leaves no ring, tunnel or veil.
  const clear = () => {
    fx?.setTunnel(0, 0);
    own?.set(0, 0);
    if (through) gates?.drive(through.key, 0);
    if (exit) gates?.drive(exit.key, 0);
    if (fade) fade.style.opacity = '0';
  };
  animation = {
    // Drags during the jump are not the balloon's look-round (orbit), and stray gates are left alone.
    magicJump: true,
    remoteTransit: true,
    cancel: clear,
    pose: t => {
      const shape = magicJumpShape(t);
      fx?.setTunnel(shape.tunnel, shape.flash);
      if (fade) fade.style.opacity = String(shape.flash * 0.8);
      if (t < MAGIC_JUMP_CUT) {
        // Turn to the opening ring, lean in a little, then step through.
        camera.position
          .copy(from)
          .lerp(door, 0.12 * shape.open)
          .lerp(inside, shape.enter);
        look
          .copy(fromLook)
          .lerp(door, shape.open)
          .addScaledVector(doorDir, shape.enter * 4);
        if (through) gates?.drive(through.key, shape.open);
        else own?.set(shape.open, performance.now() / 1000);
      } else {
        if (!cut) atCut();
        camera.position.copy(outOf).lerp(target, shape.settle);
        // Through the far ring first, then round to the destination's view while walking out.
        look.copy(exitAt).addScaledVector(exitDir, 4).lerp(aim, shape.settle);
        if (exit) gates?.drive(exit.key, shape.exit);
        else own?.set(shape.exit, performance.now() / 1000);
      }
      return t >= 1;
    },
    start: performance.now(),
    duration: jumpDuration(),
    done: () => {
      if (!cut) atCut();
      clear();
      camera.position.copy(target);
      look.copy(aim);
      done?.();
    }
  };
  requestRender();
}
// Steps from the station ring onto its deck after the jump.
const SKY_GATE_STEP = 1.8;
// A jump cut short some other way (navigation, a reset) never leaves a gate ring or our own ring standing.
function closeStrayGates() {
  const sky = world.skyIsland?.magicGate;
  if (sky) for (const [key, gate] of Object.entries(sky.gates)) if (gate.open > 0) sky.drive(key, 0);
  if (jumpPortal?.mesh.visible) jumpPortal.set(0, 0);
}
const gateRef = key => {
  const g = world.skyIsland?.magicGate?.gates?.[key];
  return g ? { key, centre: g.centre, normal: g.normal } : null;
};
// Back from the station (or out of the flight) to the overview of the whole garden through the magic gate. The
// view stays as it is (no overview layout, intro or docked balloon) until the flash covers the cut.
let returnCut = false;
function returnRemoteTourToOverview(onCut = null, near = null) {
  ride = 'sky-tour-return';
  returnCut = false;
  moving = false;
  syncSkyButtons();
  // The overview's default view, read at the cut once the orbit is reset and the terrace left behind.
  magicJump(
    overviewPose,
    () => {
      ride = null;
      updateMode();
      completeRemoteOverview();
      requestRender();
    },
    {
      near,
      onCut: () => {
        returnCut = true;
        onCut?.();
        resetOrbit(orbitView, true);
        scenicFocus = null;
        mode = 'overview';
        // The full overview (intro, not the compact explorer header), as showOverview leaves it.
        app.classList.remove('is-exploring');
        calmCamera();
        updateMode();
      }
    }
  );
}
let nextSkyTourRoute = 0;
// Board the tour balloon: from the terrace walk the rim to the magic gate and step across to the station (or,
// from anywhere else, step across at once), walk to the gangway and into the basket, then fly.
function rideSkyTour() {
  const sky = world.skyIsland,
    tour = sky?.tour;
  if (!tour || animation || portalTransit || relayout) return;
  if (languageChangePending) {
    showNotice(labels.skyLanguagePending || 'Wait for the language change to finish.');
    return;
  }
  if (!tour.remote && !scenicFocus?.terrace) return rideSkyLift();
  resetTransit();
  ride = 'sky-tour';
  // A free look left over from a project zone would fight the flight's own look.
  freeLook = false;
  hidePreferences();
  if (dialog.open) dialog.close();
  const terrace = scenicFocus?.terrace;
  if (terrace) terrace.zoom = terrace.goal.zoom = 1;
  updateCameraProjection();
  sky.dockTour();
  const route = nextSkyTourRoute;
  sky.startTour(route);
  nextSkyTourRoute = 1 - route;
  const eye = new THREE.Vector3(),
    aim = new THREE.Vector3();
  sky.tourPose(eye, aim);
  syncSkyButtons();
  // A walk along points ending in the basket; `then` runs at the end.
  const walk = (points, then, extra = 0) => {
    animation = {
      curve: new THREE.CatmullRomCurve3(points, false, 'centripetal'),
      fromLook: look.clone(),
      toLook: aim.clone(),
      fromQuaternion: camera.quaternion.clone(),
      toQuaternion: aimQuaternion(THREE, eye, aim),
      start: performance.now(),
      duration: reduced ? 0 : 2200 + extra,
      done: then
    };
    requestRender();
  };
  if (!tour.remote) {
    const points = [camera.position.clone()];
    for (const p of terraceWalk(sky.view, terrace.angle, tour.gate)) points.push(vec(p));
    points.push(vec(tour.board), eye.clone());
    walk(points, flySkyTour, (points.length - 3) * 450);
    return;
  }
  const board = () => walk([camera.position.clone(), vec(tour.board), eye.clone()], flySkyTour);
  // Out of the station's ring a couple of steps onto its deck, facing the gangway.
  const exit = gateRef('station'),
    stage = vec(tour.stage);
  if (exit) stage.addScaledVector(exit.normal, SKY_GATE_STEP);
  const jump = through => magicJump({ position: stage, look: vec(tour.board) }, board, { through, exit });
  if (!terrace) {
    scenicFocus = null;
    jump(null);
    return;
  }
  // On the terrace: round the rim to stand in front of the gate, looking through it.
  const gate = gateRef('terrace'),
    stand = vec(sky.magicGate.approach),
    points = [camera.position.clone()];
  for (const p of terraceWalk(sky.view, terrace.angle, tour.gate)) points.push(vec(p));
  points.push(stand);
  if (points.length < 3) points.splice(1, 0, camera.position.clone().lerp(stand, 0.5));
  const through = gate ? gate.centre.clone() : vec(sky.station.centre);
  animation = {
    curve: new THREE.CatmullRomCurve3(points, false, 'centripetal'),
    fromLook: look.clone(),
    toLook: through,
    fromQuaternion: camera.quaternion.clone(),
    toQuaternion: aimQuaternion(THREE, stand, through),
    start: performance.now(),
    duration: reduced ? 0 : 1200 + (points.length - 2) * 450,
    done: () => {
      scenicFocus = null;
      jump(gate);
    }
  };
  requestRender();
}
function flySkyTour() {
  const sky = world.skyIsland;
  updateCameraProjection();
  const lens = camera.fov;
  let last = 0,
    phase = '';
  // The flight is slow and asked for, so it also plays with reduced motion; only the walks are cut. Audits may
  // fast-forward it (__gardenDebug.tourScale) to capture its moments.
  animation = {
    pose: (t, now) => {
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0,
        scale = (auditEnabled && window.__gardenDebug?.tourScale) || 1;
      last = now;
      const docked = sky.tourFrame(dt * scale, camera.position, look),
        fov = lens * sky.tourLens(camera.aspect);
      if (Math.abs(camera.fov - fov) > 1e-3) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
      if (sky.tour.state.phase !== phase) {
        phase = sky.tour.state.phase;
        syncSkyButtons();
      }
      return docked;
    },
    start: performance.now(),
    duration: Infinity,
    done: leaveSkyTour
  };
  requestRender();
}
// Docked: step back across the gangway and walk the rim to the place that faces the garden.
function leaveSkyTour() {
  const remoteSky = world.skyIsland;
  if (remoteSky.tour.remote) {
    const tour = remoteSky.tour,
      points = [camera.position.clone(), vec(tour.board), vec(tour.stage)],
      curve = new THREE.CurvePath(),
      target = vec(tour.dock);
    for (let i = 1; i < points.length; i++) curve.add(new THREE.LineCurve3(points[i - 1], points[i]));
    updateCameraProjection();
    animation = {
      curve,
      fromLook: look.clone(),
      toLook: target,
      fromQuaternion: camera.quaternion.clone(),
      toQuaternion: aimQuaternion(THREE, vec(tour.stage), target),
      start: performance.now(),
      duration: reduced ? 0 : 2400,
      done: () => returnRemoteTourToOverview()
    };
    syncSkyButtons();
    requestRender();
    return;
  }
  const sky = world.skyIsland,
    view = sky.view,
    terrace = terraceState(view),
    points = [camera.position.clone(), vec(sky.tour.board)];
  for (const p of terraceWalk(view, sky.tour.gate, view.gardenAngle)) points.push(vec(p));
  updateCameraProjection();
  animation = {
    curve: new THREE.CatmullRomCurve3(points, false, 'centripetal'),
    fromLook: look.clone(),
    toLook: view.center.clone(),
    fromQuaternion: camera.quaternion.clone(),
    toQuaternion: aimQuaternion(THREE, view.position, view.center),
    start: performance.now(),
    duration: reduced ? 0 : 2400 + (points.length - 2) * 450,
    done: () => standOnTerrace(terrace)
  };
  syncSkyButtons();
  requestRender();
}
// Escape on the lift or the zipline: run the ride's remaining legs to their ends at once (each leg's end
// starts the next), so a long ride never locks the visitor in. Its final flight lands at once too.
function finishRide() {
  for (let guard = 0; animation && guard < 8; guard++) {
    const leg = animation;
    animation = null;
    if (leg.pose) leg.pose(1, performance.now());
    else if (leg.curve) {
      camera.position.copy(leg.curve.getPoint(1));
      look.copy(leg.toLook);
    }
    leg.done?.();
    if (!ride && animation && !animation.pose && mode !== 'overview') break;
  }
  moving = false;
  updateMode();
  requestRender();
}
// Both explicit exit and overview restore the physical balloons, not only the camera.
function resetSkyRideActors() {
  const sky = world?.skyIsland;
  if (!sky) return;
  const returning = ride === 'sky-tour' ? sky.tour?.dock : ride === 'sky-lift' ? sky.lift?.base : null;
  const origin =
    returning && !reduced ? { x: camera.position.x, y: camera.position.y, z: camera.position.z } : null;
  sky.dockTour();
  sky.releaseShuttle(true);
  // The effect never delays or controls the return; a rendering failure cannot strand a ride.
  if (origin && returning) {
    try {
      const fx = ensureMagic();
      fx.burst(origin.x, origin.y, origin.z, 20, { radius: 1.1, speed: 1, up: 0.8, life: [0.4, 0.8] });
      fx.burst(returning.x, returning.y, returning.z, 20, {
        radius: 1.1,
        speed: 1,
        up: 0.8,
        life: [0.4, 0.8]
      });
      fx.ripple(returning.x, returning.y, returning.z, 1.5, 0.7, 0.6);
    } catch {
      /* Ride cleanup must succeed even when effects are unavailable. */
    }
  }
}
// End the tour immediately at the station, including during boarding or disembarkation.
function stopSkyTour() {
  const sky = world?.skyIsland;
  if (ride !== 'sky-tour' || !sky) return;
  // A boarding jump cut short closes its rings and tunnel first.
  animation?.cancel?.();
  animation = null;
  // From the station the magic gate takes the visitor straight back to the overview; the balloon is docked
  // under the flash, so the basket never vanishes from under the visitor.
  if (sky.tour.remote) {
    returnRemoteTourToOverview(() => {
      sky.dockTour();
      sky.releaseShuttle(true);
    }, JUMP.basket);
    return;
  }
  resetSkyRideActors();
  const terrace = terraceState(sky.view);
  terracePose(sky.view, terrace, camera.position, look);
  standOnTerrace(terrace);
}
// Terrace: the tour button shows; in flight one large pill ends the flight.
function syncSkyButtons() {
  const tour = $('sky-tour'),
    stop = $('sky-tour-stop'),
    entry = $('sky-entry');
  if (!tour || !stop) return;
  const flying = ride === 'sky-tour';
  tour.hidden = flying || (!world.skyIsland?.tour?.remote && !scenicFocus?.terrace);
  if (entry) entry.hidden = flying || !!scenicFocus?.lookAround;
  stop.hidden = !flying;
  stop.textContent = '×  ' + (labels.skyTourStop || 'End the flight');
  // The flight's look (no intro, no announcement) lasts until the jump home cuts to the overview.
  app.classList.toggle('is-sky-tour', flying || (ride === 'sky-tour-return' && !returnCut));
}
// Observatory: round the rim to the zipline gate, down the cable to its own landing rock (never into a
// pavilion), then up and back to the overview of the whole garden.
function rideSkyZip() {
  if (rejectRemoteDockNavigation()) return;
  const sky = world.skyIsland,
    line = sky?.zipline;
  if (!line || animation || portalTransit || relayout) return;
  resetTransit();
  ride = 'sky-zip';
  hidePreferences();
  if (dialog.open) dialog.close();
  const points = [camera.position.clone()],
    terrace = scenicFocus?.terrace;
  // From the terrace, walk the rim to the gate instead of cutting across the telescope.
  if (terrace) for (const p of terraceWalk(sky.view, terrace.angle, line.gate)) points.push(vec(p));
  const walk = points.length - 1;
  for (let j = 0; j <= 24; j++) {
    const p = cablePoint(line.start, line.end, j / 24, SKY_ZIP.sag);
    points.push(new THREE.Vector3(p.x, p.y - SKY_ZIP.hang, p.z));
  }
  // Step off the landing post and turn to the garden.
  const stand = vec(line.stand),
    garden = new THREE.Vector3(0, 4, 0);
  points.push(stand);
  // The glide uses the ordinary lens, not the telescope.
  if (terrace) terrace.zoom = terrace.goal.zoom = 1;
  updateCameraProjection();
  animation = {
    curve: new THREE.CatmullRomCurve3(points, false, 'centripetal'),
    fromLook: look.clone(),
    toLook: garden,
    fromQuaternion: camera.quaternion.clone(),
    toQuaternion: aimQuaternion(THREE, stand, garden),
    start: performance.now(),
    duration: reduced ? 0 : 7400 + walk * 450,
    done: () => {
      ride = null;
      scenicFocus = null;
      resetOrbit(orbitView, true);
      app.classList.remove('is-exploring');
      writeHash('overview');
      mode = 'overview';
      moving = false;
      updateMode();
      updateProject(selected);
      fly(overviewPose(), 2200);
    }
  };
  requestRender();
}
function rideZipline(zip) {
  if (rejectRemoteDockNavigation()) return;
  const line = world.skyTransit?.zipline;
  if (!line || animation || portalTransit || relayout) return;
  resetTransit();
  const hang = 1.25,
    points = [
      camera.position.clone(),
      new THREE.Vector3(line.deckA.x, line.deckA.y + 3.3, line.deckA.z),
      new THREE.Vector3(line.start.x, line.start.y - hang, line.start.z)
    ];
  for (let j = 1; j <= 24; j++) {
    const p = cablePoint(line.start, line.end, j / 24);
    points.push(new THREE.Vector3(p.x, p.y - hang, p.z));
  }
  const dest = wrapped(zip.to, projects.length),
    arrival = stationPose(dest);
  // Step off beside the landing post (not through it), then walk into the hall.
  points.push(vec(world.route.point(dest, 0.9, 3.3)), arrival.position.clone());
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  animation = {
    curve,
    fromLook: look.clone(),
    toLook: arrival.look,
    fromQuaternion: camera.quaternion.clone(),
    toQuaternion: aimQuaternion(THREE, arrival.position, arrival.look),
    start: performance.now(),
    duration: reduced ? 0 : 7000,
    done: () => goTo(dest, true, true)
  };
  requestRender();
}
// Hovering the gate: a throttled raycast against the gate only; the gate glows and the cursor shows a link.
const portalRay = new THREE.Raycaster(),
  portalPointer = new THREE.Vector2();
function hoverPortal(x, y, at) {
  if (at - portalHoverAt < 60 || relayout || ride || portalTransit) return;
  portalHoverAt = at;
  portalPointer.set((x / viewport.width) * 2 - 1, (-y / viewport.height) * 2 + 1);
  portalRay.setFromCamera(portalPointer, camera);
  setPortalHovered(!!world.portalHit?.(portalRay));
  hoverGlint(portalRay);
}
function setPortalHovered(hovered) {
  if (hovered === portalHovered) return;
  portalHovered = hovered;
  canvas.style.cursor = hovered ? 'pointer' : '';
  requestRender();
}
function pick(x, y) {
  if (rejectRemoteDockNavigation()) return;
  if (relayout || ride) return true;
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2((x / viewport.width) * 2 - 1, (-y / viewport.height) * 2 + 1), camera);
  // With the scene, a ride never starts through an island, tree or pavilion standing in front of its target.
  const intersections = visiblePickHits(ray, world.pickable, world.scene);
  tapMagic(ray, intersections[0]);
  if (intersections.length) {
    const chosen = world.pickable.find(p => p.object === intersections[0].object);
    if (chosen.kind === 'portal') openPortal();
    else if (chosen.kind === 'zipline') rideZipline(chosen);
    else if (chosen.kind === 'skylift') rideSkyLift();
    else if (chosen.kind === 'skyzip') rideSkyZip();
    else if (chosen.kind === 'skytour') rideSkyTour();
    else if (chosen.kind === 'teaser') inspectTeaser();
    else if (chosen.kind === 'zone' && chosen.index === selected) showZone(chosen.zone);
    // A picture on the hall wall opens the gallery at that picture.
    else if (chosen.kind === 'frame' && chosen.index === selected && mode === 'journey')
      showZone('gallery', true, false, chosen.images[Math.floor(intersections[0].faceIndex / 2)] ?? 0);
    // The in-world "Open project" pill opens the project like the card's Open link.
    else if (chosen.kind === 'open' && chosen.index === selected && mode === 'journey')
      $('project-link').click();
    else if (chosen.index === selected && mode === 'journey' && !moving) showZone('gallery');
    else goTo(chosen.index);
    return true;
  }
  // Nothing to open here: the overview may take the tap as half of a focus double-tap.
  return false;
}
function attachActionFeedback(element) {
  if (!element || element.dataset.feedback) return;
  element.dataset.feedback = 'true';
  element.classList.add('action-feedback');
  let bounds = null;
  const reset = () => {
    bounds = null;
    for (const key of ['--pointer-x', '--pointer-y', '--drift-x', '--drift-y'])
      element.style.removeProperty(key);
  };
  element.addEventListener('pointerenter', event => {
    if (event.pointerType === 'mouse' && !reduced) bounds = element.getBoundingClientRect();
  });
  element.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || reduced || !bounds) return;
    const x = THREE.MathUtils.clamp((event.clientX - bounds.left) / bounds.width, 0, 1),
      y = THREE.MathUtils.clamp((event.clientY - bounds.top) / bounds.height, 0, 1);
    element.style.setProperty('--pointer-x', x * 100 + '%');
    element.style.setProperty('--pointer-y', y * 100 + '%');
    element.style.setProperty('--drift-x', (x - 0.5) * 2.6 + 'px');
    element.style.setProperty('--drift-y', (y - 0.5) * 2 + 'px');
  });
  for (const name of ['pointerleave', 'pointercancel', 'blur']) element.addEventListener(name, reset);
}
function updateQuality() {
  app.classList.toggle('is-economy', economy);
  let text = labels['quality' + graphics[0].toUpperCase() + graphics.slice(1)];
  if (adaptiveScale < 1)
    text += ' · ' + labels.qualityAdaptive.replace('{0}', String(Math.round(adaptiveScale * 100)));
  $('quality-state').textContent = text;
  $('settings').title = labels.settings + ' · ' + text;
}
function changeImage(direction) {
  const images = galleryItems();
  if (zone !== 'gallery' || images.length <= 1) return;
  galleryImage += direction;
  updateSection();
  writeHash('project', selected);
}
function mediaBounds() {
  const screen = world.screenBounds(selected, camera, viewport.width, viewport.height),
    viewer =
      zone === 'gallery' && !$('media-viewer').hidden ? $('media-viewer').getBoundingClientRect() : null;
  return {
    screen,
    viewer: viewer ? { x: viewer.x, y: viewer.y, width: viewer.width, height: viewer.height } : null
  };
}
function galleryHit(x, y) {
  if (zone === 'gallery') return false;
  const screen = world.screenBounds(selected, camera, viewport.width, viewport.height);
  return (
    !!screen &&
    x >= screen.x &&
    x <= screen.x + screen.width &&
    y >= screen.y &&
    y <= screen.y + screen.height
  );
}

function projectIcon(project) {
  const img = document.createElement('img');
  img.src = project.ico || project.image;
  img.alt = '';
  img.decoding = 'async';
  img.addEventListener(
    'error',
    () => {
      img.hidden = true;
    },
    { once: true }
  );
  return img;
}
const lookAim = new THREE.Vector3(),
  lookSphere = new THREE.Spherical();
function applyLook() {
  if (['journey', 'portal'].includes(mode) && freeLook) {
    lookSphere.set(8, Math.PI / 2 + lookPitch, lookYaw);
    camera.lookAt(lookAim.setFromSpherical(lookSphere).add(camera.position));
    return;
  }
  // A glance aside while travelling turns the gaze from the path by (yaw, pitch).
  if (travelLook.yaw || travelLook.pitch) {
    lookSphere.setFromVector3(lookAim.copy(look).sub(camera.position));
    lookSphere.theta += travelLook.yaw;
    lookSphere.phi = THREE.MathUtils.clamp(lookSphere.phi + travelLook.pitch, 0.05, Math.PI - 0.05);
    camera.lookAt(lookAim.setFromSpherical(lookSphere).add(camera.position));
    return;
  }
  camera.lookAt(look);
}
// A drag looks round. On the way (a trip or a flight in) it is a glance that drifts back to the path when let
// go; at a pavilion or the portal it turns the view freely, within reach of where it started.
function nudgeLook(dx, dy, eventTime) {
  const inputStart = auditEnabled ? performance.now() : 0,
    entered = !freeLook && !(mode === 'journey' && moving);
  if (mode === 'journey' && moving) {
    travelLook.holding = true;
    travelLook.yaw = THREE.MathUtils.clamp(travelLook.yaw - dx * 0.004, -FREE_LOOK.glance, FREE_LOOK.glance);
    travelLook.pitch = THREE.MathUtils.clamp(
      travelLook.pitch + dy * 0.003,
      -FREE_LOOK.glancePitch,
      FREE_LOOK.glancePitch
    );
  } else {
    if (!freeLook) {
      const direction = camera.getWorldDirection(new THREE.Vector3()),
        s = new THREE.Spherical().setFromVector3(direction);
      lookYaw = lookBase = s.theta;
      lookPitch = s.phi - Math.PI / 2;
      // The direction already holds any glance left from the trip.
      travelLook.yaw = travelLook.pitch = 0;
      freeLook = true;
    }
    lookYaw = THREE.MathUtils.clamp(lookYaw - dx * 0.004, lookBase - FREE_LOOK.yaw, lookBase + FREE_LOOK.yaw);
    lookPitch = THREE.MathUtils.clamp(lookPitch + dy * 0.003, FREE_LOOK.up, FREE_LOOK.down);
  }
  if (entered) updateMode();
  requestRender();
  if (auditEnabled) {
    lookTiming.pendingAt ||= inputStart;
    lookTiming.events.push({
      age: Math.max(0, inputStart - (eventTime || inputStart)),
      handler: performance.now() - inputStart
    });
    if (lookTiming.events.length > 128) lookTiming.events.shift();
  }
}
function unfoldExhibit(el, origin) {
  if (reduced || !origin || !el.animate) return;
  const rect = el.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const x = origin.x + origin.width / 2 - rect.x - rect.width / 2,
    y = origin.y + origin.height / 2 - rect.y - rect.height / 2,
    sx = Math.max(0.12, origin.width / rect.width),
    sy = Math.max(0.12, origin.height / rect.height);
  const transform = getComputedStyle(el).transform,
    base = transform === 'none' ? '' : transform + ' ';
  el.animate(
    [
      {
        transform: base + 'translate(' + x + 'px,' + y + 'px) scale(' + sx + ',' + sy + ')',
        opacity: 0.2,
        filter: 'brightness(1.7)'
      },
      { transform: base + 'translate(0,0) scale(1)', opacity: 1, filter: 'brightness(1)' }
    ],
    { duration: 520, easing: 'cubic-bezier(.16,.85,.24,1)' }
  );
}
function foldExhibit(el, origin, done) {
  if (reduced || !origin || !el.animate) {
    done();
    return;
  }
  const rect = el.getBoundingClientRect(),
    transform = getComputedStyle(el).transform,
    base = transform === 'none' ? '' : transform + ' ';
  el.animate(
    [
      { transform: base + 'scale(1)', opacity: 1 },
      {
        transform:
          base +
          'translate(' +
          (origin.x + origin.width / 2 - rect.x - rect.width / 2) +
          'px,' +
          (origin.y + origin.height / 2 - rect.y - rect.height / 2) +
          'px) scale(.2)',
        opacity: 0
      }
    ],
    { duration: 260, easing: 'ease-in' }
  ).finished.then(done, done);
}
function expandImage() {
  const r = $('gallery-image').getBoundingClientRect(),
    img = $('image-full'),
    ratio = (img.naturalWidth || 1) / (img.naturalHeight || 1),
    width = Math.min(viewport.width - 32, (viewport.height - 122) * ratio);
  $('image-dialog').style.width = width + 'px';
  img.style.width = width + 'px';
  img.style.height = width / ratio + 'px';
  $('image-dialog').showModal();
  unfoldExhibit(img, r);
}
function collapseImage() {
  foldExhibit($('image-full'), $('gallery-image').getBoundingClientRect(), () => {
    $('image-dialog').close();
    $('gallery-expand').focus();
  });
}

// Every picture read on a canvas asks for CORS: a copy on another site gets them from maserplay.ru, and without it
// the canvas is tainted, so its pixels cannot be read and it cannot become a texture.
async function prepareIdentity(list) {
  await Promise.all(
    list.map(
      project =>
        new Promise(resolve => {
          const image = new Image();
          image.crossOrigin = 'anonymous';
          let settled = false;
          const finish = () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve();
          };
          const timer = setTimeout(() => {
            image.onload = image.onerror = null;
            project.accent = '#a895e5';
            finish();
          }, 3500);
          image.onload = () => {
            try {
              const c = document.createElement('canvas');
              c.width = c.height = 32;
              const ctx = c.getContext('2d', { willReadFrequently: true });
              ctx.drawImage(image, 0, 0, 32, 32);
              const pixels = ctx.getImageData(0, 0, 32, 32).data;
              let r = 0,
                g = 0,
                b = 0,
                total = 0;
              for (let i = 0; i < pixels.length; i += 4) {
                const max = Math.max(pixels[i], pixels[i + 1], pixels[i + 2]),
                  min = Math.min(pixels[i], pixels[i + 1], pixels[i + 2]),
                  weight = (((max - min) / 255) * pixels[i + 3]) / 255;
                if (max < 45 || weight < 0.12) continue;
                r += pixels[i] * weight;
                g += pixels[i + 1] * weight;
                b += pixels[i + 2] * weight;
                total += weight;
              }
              const color = new THREE.Color(
                total ? Math.round(r / total) / 255 : 0.48,
                total ? Math.round(g / total) / 255 : 0.52,
                total ? Math.round(b / total) / 255 : 0.9
              );
              const hsl = {};
              color.getHSL(hsl);
              color.setHSL(hsl.h, Math.min(0.7, Math.max(0.35, hsl.s)), 0.67);
              project.accent = '#' + color.getHexString();
              project.iconCanvas = c;
              // The page could read its pixels, so the birthday emblem may draw it (project-birthdays.mjs).
              project.iconImage = image;
            } catch {
              project.accent = '#a895e5';
            }
            finish();
          };
          image.onerror = () => {
            project.accent = '#a895e5';
            finish();
          };
          image.src = project.ico || project.image;
        })
    )
  );
}

// ---- Projects in the garden: API lists, filters and island relayout ----
const exhibitAccents = {
  quickvox: '#77c9f4',
  FenesyyySupport: '#88bdf1',
  ArcadeGames: '#ffd36a',
  EscapeFromLava: '#ff985c',
  Appai: '#b899ef',
  FlaskSite: '#7bd7cc',
  Chtgptforpers: '#f57583'
};
const ownerScratch = new THREE.Matrix4(),
  identityMatrix = new THREE.Matrix4();
// Transition magic (motes, rune rings, light columns, portal tunnel) follows the current world scene.
let magicFx = null;
function magicEffects() {
  magicFx ??= createMagicEffects(THREE, {
    economy,
    onSurge: (level, swirl) => world?.setPortalSurge?.(level, swirl)
  });
  return magicFx;
}
function ensureMagic() {
  magicEffects().setEconomy(economy);
  if (magicFx.group.parent !== world.scene) world.scene.add(magicFx.group);
  return magicFx;
}
// The sort and portal magic is made and its shaders compiled in the background a few seconds after the garden
// appears: at its first use the compile stalled the frame for 70–120 ms (round 9). Not during a benchmark run.
function prewarmMagic() {
  if (alive.disposed || reduced || bench || magicFx || !world) return;
  compileScene(magicEffects().group, world.scene);
}
function wakePortal(seconds) {
  if (reduced || !world.portalGeometry?.center) return null;
  const fx = ensureMagic();
  fx.charge(world.portalGeometry, seconds);
  fx.surgeTarget = 0.35;
  return fx;
}
// «Перейти» charging in the rune dial: motes spiral into the ring and the vortex spins up with the charge.
function chargePortal(level) {
  if (reduced || !world.portalGeometry?.center) return;
  const fx = ensureMagic();
  if (level > 0) {
    fx.charge(world.portalGeometry, 0.35);
    fx.surgeTarget = 0.3 + 0.7 * level;
  } else if (!portalTransit) fx.surgeTarget = 0;
  requestRender();
}
// ---- Garden-wide magic (magic-effects.mjs budgets): trip trail, arrival shimmer, tap ripple, hover glint ----
const tripMagic = { last: new THREE.Vector3(), forward: new THREE.Vector3(), primed: false };
// Called every rendered frame: while the camera travels between projects or flies, sparkles stream past it.
function streamTripMagic(dt) {
  const travelling = (moving || !!animation) && !portalTransit && !ride && !relayout && !bench;
  if (!travelling || reduced || dt <= 0) {
    tripMagic.primed = false;
    return;
  }
  if (tripMagic.primed) {
    tripMagic.forward.subVectors(camera.position, tripMagic.last);
    const speed = tripMagic.forward.length() / dt;
    if (speed > 0) ensureMagic().stream(camera.position, tripMagic.forward.normalize(), speed, dt);
  }
  tripMagic.last.copy(camera.position);
  tripMagic.primed = true;
}
// Arriving at a pavilion: a ring of light runs across its deck and a wave of sparkles rises round it.
function arrivalMagic(index) {
  if (reduced || !projects[index] || !world?.screenTarget) return;
  // Between the visitor and the stand, on the pavilion's own floor (halls stand above the bridge deck).
  const stand = world.screenTarget(index),
    x = THREE.MathUtils.lerp(camera.position.x, stand.x, 0.55),
    z = THREE.MathUtils.lerp(camera.position.z, stand.z, 0.55),
    floor = floorAt(index, x, z, camera.position.y),
    y = floor ?? world.route.point(routeIndex(index), 0, 0).y;
  ensureMagic().shimmer(x, y + RING_LIFT, z, 3.2);
  requestRender();
}
// Rings of light float a hand above the floor so planks and grass never hide them.
const RING_LIFT = 0.12;
// Floor of a pavilion under (x, z), found by one downward ray into that pavilion only (cheap, not per frame).
const floorRay = new THREE.Raycaster(),
  floorOrigin = new THREE.Vector3(),
  DOWN = new THREE.Vector3(0, -1, 0);
function floorAt(index, x, z, top) {
  const group = world.pavilionGroups?.[index];
  if (!group) return null;
  floorRay.set(floorOrigin.set(x, top, z), DOWN);
  floorRay.far = 6;
  const hit = floorRay.intersectObject(group, true).find(h => !h.face || h.face.normal.y > 0.5);
  return hit ? hit.point.y : null;
}
// A tap inside a pavilion lands on its floor; elsewhere on the island tops.
function pavilionHit(ray) {
  if (mode !== 'journey' || !world.pavilionGroups?.[selected]) return null;
  ray.far = 16;
  const hit = ray
    .intersectObject(world.pavilionGroups[selected], true)
    .find(h => h.face && h.face.normal.y > 0.5);
  ray.far = Infinity;
  return hit ? { x: hit.point.x, y: hit.point.y + RING_LIFT, z: hit.point.z } : null;
}
// Islands as flat ellipses at their top (world.transitions.shapes) plus the central island: where a tap lands.
const tapPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
  tapPoint = new THREE.Vector3();
const CENTRAL_LAND = { x: 0, y: 0.47, z: 0, radius: 10.5, stretch: 1, rotation: 0 };
function groundHit(ray) {
  let best = null,
    distance = Infinity;
  for (const land of [CENTRAL_LAND, ...(world.transitions?.shapes || [])]) {
    if (!land) continue;
    tapPlane.constant = -land.y;
    if (!ray.ray.intersectPlane(tapPlane, tapPoint)) continue;
    const dx = tapPoint.x - land.x,
      dz = tapPoint.z - land.z,
      c = Math.cos(land.rotation || 0),
      s = Math.sin(land.rotation || 0),
      u = (dx * c - dz * s) / (land.radius * (land.stretch || 1)),
      v = (dx * s + dz * c) / (land.radius / (land.stretch || 1)),
      d = ray.ray.origin.distanceTo(tapPoint);
    if (u * u + v * v <= 1 && d < distance) {
      distance = d;
      best = { x: tapPoint.x, y: land.y + 0.04, z: tapPoint.z };
    }
  }
  return best;
}
// A tap or click in the scene: sparks on the thing it picked, else a small ring of light on the ground.
function tapMagic(ray, hit) {
  if (reduced || relayout) return;
  const fx = ensureMagic();
  if (hit) fx.glint(hit.point.x, hit.point.y, hit.point.z);
  else {
    const ground = pavilionHit(ray) || groundHit(ray);
    if (ground) fx.tap(ground.x, ground.y, ground.z);
  }
  requestRender();
}
// Mouse hover over a pavilion screen, sign or the gate: one glint where the cursor meets it.
let hoverGlintObject = null;
function hoverGlint(ray) {
  if (reduced || economy || relayout || ride) return;
  const hit = visiblePickHits(ray, world.pickable)[0];
  const object = hit?.object || null;
  if (object && object !== hoverGlintObject) ensureMagic().glint(hit.point.x, hit.point.y, hit.point.z);
  if (object !== hoverGlintObject) requestRender();
  hoverGlintObject = object;
}
const islandBob = (owner, t) => 0.16 * Math.sin(t * 0.0058 + owner * 1.9);
let listBusy = false,
  showcase = null,
  skyTags = false,
  arrangeShowcase = false,
  commentPostToken = 0;
async function mediaMap() {
  if (!mediaSelections) {
    try {
      const response = await fetch(gardenFile('media-presentation.json'), { credentials: 'same-origin' });
      mediaSelections = response.ok ? await response.json() : {};
    } catch {
      mediaSelections = {};
    }
  }
  return mediaSelections;
}
// A response whose every item fails the contract (e.g. an older API without technical_name) is an error,
// never an empty garden; partly malformed lists keep their valid projects and log the rest.
async function loadProjects(state, signal) {
  const list = await fetchProjects(state, {
    locale: data.locale,
    signal,
    api: API,
    mediaSelections: await mediaMap()
  });
  if (list.rejected.length) {
    if (!list.length) {
      const error = new Error('Projects response does not match the API contract');
      error.rejected = list.rejected;
      throw error;
    }
    console.warn('Projects skipped by the API adapter', list.rejected);
  }
  return list;
}
async function prepareProjects(list) {
  const fresh = list.filter(project => !accentCache.has(project.id));
  await prepareIdentity(fresh);
  for (const project of fresh)
    accentCache.set(project.id, { accent: project.accent, iconCanvas: project.iconCanvas });
  for (const project of list) {
    const cached = accentCache.get(project.id);
    project.accent = exhibitAccents[project.id] || cached?.accent || project.accent;
    if (cached?.iconCanvas) project.iconCanvas = cached.iconCanvas;
  }
  return list;
}
function writeFilterUrl() {
  const url = new URL(location.href);
  url.search = filterSearch(filters, url.search);
  history.replaceState(history.state, '', url);
}
function projectCount(count) {
  const rule = new Intl.PluralRules(data.locale).select(count);
  return (
    rule === 'one' ? labels.filterCountOne : rule === 'few' ? labels.filterCountFew : labels.filterCountMany
  ).replace('{n}', count);
}
// Live regions announce changes rather than reveals, so the text lands just after the notice appears.
function showNotice(text) {
  const notice = $('garden-notice');
  notice.hidden = false;
  notice.textContent = '';
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    notice.textContent = text;
    noticeTimer = setTimeout(() => {
      notice.hidden = true;
    }, 6000);
  }, 60);
}
const sortKeys = ['created', 'last_update', 'name'];
function syncFilterControls() {
  const control = $('sort-key');
  control.style.setProperty('--segment-index', sortKeys.indexOf(filters.sortBy));
  [...control.children].forEach(button =>
    button.setAttribute('aria-pressed', String(button.dataset.sort === filters.sortBy))
  );
  const direction = sortDirectionLabel();
  $('sort-direction-label').textContent = direction;
  $('sort-direction').dataset.descend = String(!!filters.descend);
  $('sort-direction').setAttribute('aria-label', labels.sortBy + ': ' + direction);
  $('filter-hidden').checked = filters.showHidden;
  $('filter-github').checked = filters.onlyGithub;
  $('filter-reset').hidden = !filterSearch(filters);
  const busy = listBusy || !!relayout || !!filterTimer;
  document.querySelector('.project-filters').setAttribute('aria-busy', String(busy));
  $('filter-status').textContent = busy ? labels.filterLoading : projectCount(projects.length);
  $('arrange').classList.toggle('is-filtered', !!filterSearch(filters));
}
// A choice from the order panel closes it and steps back to the overview, so the visitor watches the
// islands rearrange; numbered tags and a running light then show the new order and its direction.
function chooseArrangement(next) {
  if (rejectRemoteDockNavigation()) {
    syncFilterControls();
    return;
  }
  setFilters(next);
  setArrangeOpen(false);
  arrangeShowcase = true;
  if (mode !== 'overview' || scenicFocus) showOverview();
}
// The order's direction in words: A–Z or Z–A by name, newest or oldest first by date.
function sortDirectionLabel() {
  if (filters.sortBy === 'name') return filters.descend ? labels.sortZA : labels.sortAZ;
  return filters.descend ? labels.sortNewest : labels.sortOldest;
}
function orderCaption() {
  const key = { created: labels.sortCreated, last_update: labels.sortUpdated, name: labels.sortName }[
      filters.sortBy
    ],
    direction = sortDirectionLabel();
  return [
    labels.arrangeHeading + ': ' + key,
    direction,
    filters.onlyGithub ? labels.orderOnlyGithub : '',
    filters.showHidden ? labels.orderWithHidden : '',
    labels.orderStart
  ]
    .filter(Boolean)
    .join(' · ');
}
function setArrangeOpen(open) {
  const panel = $('arrange-panel');
  if (!panel || panel.hidden === !open) return;
  panel.hidden = !open;
  $('arrange').setAttribute('aria-expanded', String(open));
  if (open) {
    hidePreferences();
    if (dialog.open) dialog.close();
    if (mode === 'overview' && !relayout && projects.length)
      showcase?.showOrder(world, projects, orderCaption());
    panel.querySelector('button[aria-pressed=true]')?.focus();
  } else {
    showcase?.hideOrder();
  }
  requestRender();
}
function bindFilters() {
  showcase = createShowcase(THREE, { container: $('island-tags'), caption: $('arrange-caption'), labels });
  $('island-tags').addEventListener('click', flyFromTag);
  $('arrange').addEventListener('click', () => setArrangeOpen($('arrange-panel').hidden));
  $('arrange-close').addEventListener('click', () => {
    setArrangeOpen(false);
    $('arrange').focus();
  });
  $('arrange-panel').addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setArrangeOpen(false);
      $('arrange').focus();
    }
  });
  document.addEventListener('pointerdown', event => {
    if (!$('arrange-panel').hidden && !event.target.closest('#arrange-panel,#arrange')) setArrangeOpen(false);
  });
  bindSegmentedChoice($('sort-key'), {
    getSelected: () => sortKeys.indexOf(filters.sortBy),
    onSelect: i => chooseArrangement({ ...filters, sortBy: sortKeys[i], descend: sortKeys[i] !== 'name' })
  });
  $('sort-direction').addEventListener('click', () =>
    chooseArrangement({ ...filters, descend: !filters.descend })
  );
  $('filter-hidden').addEventListener('change', () =>
    chooseArrangement({ ...filters, showHidden: $('filter-hidden').checked })
  );
  $('filter-github').addEventListener('change', () =>
    chooseArrangement({ ...filters, onlyGithub: $('filter-github').checked })
  );
  $('filter-reset').addEventListener('click', () => chooseArrangement(DEFAULT_FILTERS));
  $('empty-reset').addEventListener('click', () => chooseArrangement(DEFAULT_FILTERS));
  $('filtered-reset').addEventListener('click', () => setFilters(DEFAULT_FILTERS));
  $('filtered-show').addEventListener('click', showFilteredProject);
  $('filtered-overview').addEventListener('click', () => showOverview());
  for (const id of ['sort-direction', 'filtered-show', 'empty-reset']) attachActionFeedback($(id));
  syncFilterControls();
}
// Rapid toggles settle for 150 ms; only the newest request may change the garden.
// The imported tree trial shares its asset with the world, so it reloads on the new list instead of rebuilding in place.
function setFilters(next) {
  if (rejectRemoteDockNavigation()) {
    syncFilterControls();
    return;
  }
  filters = normalizeFilters(next);
  writeFilterUrl();
  if (trialAssets.pineAsset) {
    location.reload();
    return;
  }
  // A choice supersedes every request in flight: a late error can no longer revert it.
  listToken++;
  listAbort?.abort();
  listAbort = null;
  clearTimeout(filterTimer);
  filterTimer = setTimeout(requestProjects, 150);
  syncFilterControls();
}
async function requestProjects() {
  filterTimer = 0;
  const state = filters,
    token = ++listToken;
  listAbort?.abort();
  const controller = new AbortController();
  listAbort = controller;
  listBusy = true;
  syncFilterControls();
  try {
    const list = await loadProjects(state, controller.signal);
    if (token !== listToken) return;
    await prepareProjects(list);
    if (token !== listToken) return;
    list.filters = state;
    appliedFilters = state;
    listBusy = false;
    applyList(list);
  } catch (error) {
    if (token !== listToken || controller.signal.aborted) return;
    console.warn('Projects could not be loaded', error);
    filters = appliedFilters;
    // A previously started request must not rewrite a Back/Forward entry while its application is deferred.
    if (!remoteDockTransitionLocked()) writeFilterUrl();
    showNotice(labels.filterError);
    settleHistory();
  } finally {
    if (token === listToken) {
      listBusy = false;
      syncFilterControls();
    }
  }
}
function applyList(list) {
  // A list that arrives mid-rearrangement waits for it; only the newest one is kept.
  if (relayout) {
    queuedList = list;
    relayout.hurry = true;
    return;
  }
  const ids = list.map(project => project.id);
  if (ids.join('\n') === projects.map(project => project.id).join('\n')) {
    // Same islands in the same order: refresh their data in place, no rebuild.
    const byId = new Map(list.map(project => [project.id, project]));
    projects = projects.map(project => Object.assign(project, byId.get(project.id)));
    pendingList = null;
    filteredOut = null;
    worldFilters = list.filters || filters;
    if (projects.length) updateProject(selected);
    else updateMode();
    syncFilterControls();
    if (arrangeShowcase && mode === 'overview' && !remoteDockTransitionLocked()) {
      arrangeShowcase = false;
      if (!reduced) ensureMagic();
      showcase?.play(world, projects, orderCaption(), { reduced });
      requestRender();
    }
    settleHistory();
    return;
  }
  // The rearrangement itself starts from the render loop, once no flight or walk is running.
  pendingList = list;
  holdsFocus(list);
  if (scenicFocus?.remoteDock || scenicFocus?.remoteHold)
    showNotice(labels.skyRelayoutDeferred || 'Sorting and filters will update after a safe return.');
  requestRender();
}
// Never select another project silently: a reader on an island the new list drops stays there, clearly marked.
function holdsFocus(list) {
  const focus = mode === 'journey' ? projects[selected]?.id : null;
  if (!focus || list.some(project => project.id === focus)) {
    if (filteredOut) {
      filteredOut = null;
      updateMode();
    }
    return false;
  }
  if (filteredOut?.id !== focus) {
    filteredOut = { id: focus };
    updateMode();
    syncFilterControls();
  }
  return true;
}
function maybeStartDeferred() {
  if (!pendingList || relayout || !world) return;
  // Keep a visitor on a blocked remote dock until a checked return has succeeded.
  if (scenicFocus?.remoteDock || scenicFocus?.remoteHold || ride || animation || portalTransit || moving)
    return;
  if (holdsFocus(pendingList)) return;
  startRelayout();
}
// Back/Forward that arrived during a rearrangement is applied once the new garden has settled.
function settleHistory() {
  if (remoteDockTransitionLocked()) return;
  // A list still waiting to rearrange the garden comes first; its own end settles the history.
  if (!historyPending || relayout || (pendingList && !filteredOut)) return;
  historyPending = false;
  const hash = readHash();
  const here =
    hash.kind === 'project'
      ? mode === 'journey' && hash.index === selected && hash.zone === zone
      : hash.kind === 'portal'
        ? mode === 'portal'
        : hash.kind === 'teaser'
          ? !!scenicFocus
          : mode === 'overview' && !scenicFocus;
  if (!here) applyHash(hash);
}
function applyHash(hash) {
  if (rejectRemoteDockNavigation()) return;
  animation = null;
  if (hash.kind === 'project') goTo(hash.index, false, false, 0, hash.zone, hash.image);
  else if (hash.kind === 'portal') openPortal(false);
  else if (hash.kind === 'teaser') inspectTeaser(false, true);
  else showOverview(false);
}
function updateFilteredOut() {
  const box = $('filtered-out'),
    show = !!filteredOut && mode === 'journey',
    reveal = show && box.hidden;
  box.hidden = !show;
  $('project-card').classList.toggle('is-filtered-out', show);
  if (!show) return;
  const project = projects.find(p => p.id === filteredOut.id),
    reasons = [];
  if (project?.hidden && !filters.showHidden) reasons.push(labels.reasonHidden);
  if (filters.onlyGithub && !project?.repository) reasons.push(labels.reasonGithub);
  const text = labels.filteredOut
      .replace('{name}', project?.name || '')
      .replace('{reasons}', reasons.join('; ') || labels.filtersHeading),
    output = $('filtered-out-text');
  if (reveal) {
    output.textContent = '';
    setTimeout(() => {
      output.textContent = text;
    }, 60);
  } else if (output.textContent !== text) output.textContent = text;
  $('filtered-show').hidden = !reasons.length;
  $('walk-controls').hidden = true;
}
function showFilteredProject() {
  const project = projects.find(p => p.id === filteredOut?.id);
  if (project)
    setFilters({
      ...filters,
      showHidden: filters.showHidden || !!project.hidden,
      onlyGithub: filters.onlyGithub && !!project.repository
    });
}

function startRelayout() {
  const list = pendingList;
  pendingList = null;
  if (!list) return;
  freeLook = false;
  lookYaw = lookPitch = 0;
  const fromIds = projects.map(p => p.id),
    toIds = list.map(p => p.id),
    fromFrames = layoutFrames(fromIds),
    toFrames = layoutFrames(toIds),
    plan = planTransition(fromIds, toIds, fromFrames, toFrames);
  const focus =
      mode === 'journey' && projects[selected] && toIds.includes(projects[selected].id)
        ? projects[selected].id
        : null,
    turn = focus ? plan.turn(focus) : null;
  // Ride along for up to ~50°; a longer trip, or a sink and rise, is met at its new place behind the crossfade.
  const ride = !!focus && turn !== null && Math.abs(turn) <= 0.9;
  relayout = {
    phase: 'a',
    clock: 0,
    last: null,
    plan,
    list,
    filters: list.filters || filters,
    fromIds,
    toIds,
    fromFrames,
    toFrames,
    focus,
    ride,
    teleport: !!focus && !ride,
    scale: world.transitions.movable ? timeScale({ reduced }) : 0,
    hurry: false,
    previewed: projects[portalSelection]?.id,
    selectedId: projects[selected]?.id,
    camera: { position: camera.position.clone(), look: look.clone() },
    stats: {
      started: performance.now(),
      from: fromIds.length,
      to: toIds.length,
      glide: plan.glide.length,
      sink: plan.sink.length,
      rise: plan.rise.length,
      frames: { a: [], b: [] }
    }
  };
  // Animated rearrangements get their magic; reduced motion and diagnostic worlds swap plainly.
  relayout.showcase = arrangeShowcase;
  arrangeShowcase = false;
  showcase?.stop();
  relayout.fx = relayout.scale ? ensureMagic() : null;
  relayout.landed = new Set();
  startBuild(relayout);
  if (relayout.fx) world.transitions.setGlow(1, 0.08);
  app.classList.add('is-relayout');
  world.transitions.setActive(true);
  updateMode();
  syncFilterControls();
  requestRender();
}
function stepRelayout(now) {
  // Wall-clock time (up to 250 ms per frame): a throttled window still finishes the rearrangement.
  const r = relayout,
    dt = r.last === null ? 0 : Math.min(250, Math.max(0, now - r.last));
  r.last = now;
  if (dt) r.stats.frames[r.phase === 'b' ? 'b' : 'a'].push(Math.round(dt * 10) / 10);
  const before = r.clock;
  r.clock += dt * (r.hurry ? 4 : 1);
  const seconds = (r.clock - before) / 1000;
  if (r.phase === 'a') relayoutPhaseA(r, r.clock, r.scale, seconds);
  else if (r.phase === 'b') relayoutPhaseB(r, r.clock, r.scale, seconds);
}
// Phase A of a rearrangement: bridges dissolve into motes from mid-span; leaving or reordered islands sink
// into the cloud haze; gliders lift off over a rune ring. It hands over to the capture once its time is up and
// the next garden is built.
function relayoutPhaseA(r, t, s, seconds) {
  const T = world.transitions,
    fx = r.fx;
  const A = TIMELINE.a,
    reveal = 1.01 - 1.02 * phaseProgress(t, A.retract, s);
  T.setReveal(reveal);
  T.setPracticalLevel(1 - phaseProgress(t, A.light, s));
  const e = phaseProgress(t, A.sink, s);
  for (const id of r.plan.sink)
    if (id !== r.focus) {
      const owner = r.fromIds.indexOf(id) + 1;
      T.setOwner(owner, sinkMatrix(THREE, r.fromFrames.get(id), e, ownerScratch));
      if (fx) {
        T.setFade(owner, e * 0.9);
        const shape = T.shapes[owner - 1];
        if (shape && e > 0 && e < 1) fx.mist(shape, ownerScratch, 34, seconds);
      }
    }
  if (fx) {
    fx.spans(world, reveal, 20, seconds, 'edge');
    const lift = levitation('a', t, s);
    for (const id of r.plan.glide) {
      const owner = r.fromIds.indexOf(id) + 1,
        shape = T.shapes[owner - 1];
      if (id === r.focus) ownerScratch.identity();
      else {
        ownerScratch.makeTranslation(0, lift * (1 + islandBob(owner, t) / LIFT), 0);
        T.setOwner(owner, ownerScratch);
      }
      if (shape) fx.ring(shape, ownerScratch, lift / LIFT, owner * 1.7);
    }
  }
  if (t >= A.end * s && builtFor(r)) {
    r.phase = 'capture';
    r.bobOffset = t;
  }
}
// Phase B: gliders float to their places and settle; new islands rise out of the clouds in a light column;
// spans re-weave as threads of light, then solidify from the landings; the overlay goes.
function relayoutPhaseB(r, t, s, seconds) {
  const T = world.transitions,
    fx = r.fx;
  if (r.cameraGlide) {
    const k = phaseProgress(t, [0, 1100], s);
    camera.position.lerpVectors(r.cameraGlide.from.position, r.cameraGlide.to.position, k);
    look.lerpVectors(r.cameraGlide.from.look, r.cameraGlide.to.look, k);
  }
  const B = TIMELINE.b,
    g = phaseProgress(t, B.glide, s),
    e = phaseProgress(t, B.rise, s),
    overlayScale = s || 200 / B.overlay[1],
    lift = levitation('b', t, s),
    bobAt = t + (r.bobOffset || 0);
  glideIslands(r, g, lift, bobAt, seconds);
  riseIslands(r, t, s, e, seconds);
  T.setReveal(-0.01 + (fx ? 1.32 : 1.02) * phaseProgress(t, B.extend, s));
  T.setPracticalLevel(phaseProgress(t, B.light, s));
  if (fx) {
    if (t >= B.thread[0] * s && t <= B.thread[1] * s) fx.spans(world, 1, 12, seconds, 'thread');
    T.setGlow(1, 0.3);
  }
  const o = phaseProgress(t, B.overlay, overlayScale);
  wipeOverlay(r, o);
  if (t >= B.end * s && t >= B.overlay[1] * overlayScale) finishRelayout();
}
// Phase B's gliders float to their new places; the reader's own island carries the camera, or jumps when
// teleporting.
function glideIslands(r, g, lift, bobAt, seconds) {
  const T = world.transitions,
    fx = r.fx;
  for (const id of r.plan.glide) {
    const owner = r.toIds.indexOf(id) + 1,
      shape = T.shapes[owner - 1];
    if (id === r.focus && r.teleport) {
      T.setOwner(owner, identityMatrix);
      if (fx && shape) fx.ring(shape, identityMatrix, lift / LIFT, owner * 1.7);
      continue;
    }
    displacement(THREE, r.plan.frameAt(id, g), r.toFrames.get(id), ownerScratch);
    // The reader's own island never bobs: the camera rides its glide only.
    if (id === r.focus && r.ride) {
      camera.position.copy(r.cameraFinal.position).applyMatrix4(ownerScratch);
      look.copy(r.cameraFinal.look).applyMatrix4(ownerScratch);
    } else if (fx) ownerScratch.elements[13] += lift * (1 + islandBob(owner, bobAt) / LIFT);
    T.setOwner(owner, ownerScratch);
    if (fx && shape) {
      fx.ring(shape, ownerScratch, lift / LIFT, owner * 1.7);
      if (g > 0 && g < 1) fx.trail(shape, ownerScratch, 22, seconds);
    }
  }
}
// Phase B's new islands rise out of the clouds in a light column and land with a burst.
function riseIslands(r, t, s, e, seconds) {
  const T = world.transitions,
    fx = r.fx,
    B = TIMELINE.b;
  for (const id of r.plan.rise) {
    const owner = r.toIds.indexOf(id) + 1;
    if (id === r.focus) {
      T.setOwner(owner, identityMatrix);
      continue;
    }
    T.setOwner(owner, sinkMatrix(THREE, r.toFrames.get(id), 1 - e, ownerScratch));
    if (fx) {
      T.setFade(owner, (1 - e) * 0.9);
      const shape = T.shapes[owner - 1];
      if (shape) {
        fx.column(shape, Math.sin(Math.PI * phaseProgress(t, [B.rise[0] - 150, B.rise[1] + 300], s)));
        if (e > 0 && e < 1) fx.rise(shape, ownerScratch, 28, seconds);
        if (e >= 0.97 && !r.landed.has(id)) {
          r.landed.add(id);
          fx.burstShape(shape, 44);
        }
      }
    }
  }
}
// The overlay over the rearrangement goes: a widening wipe when it has one, else a fade.
function wipeOverlay(r, o) {
  const overlay = $('relayout-overlay');
  if (r.wipe) {
    const radius = wipeRadius(o, r.wipe).toFixed(1) + 'px',
      ripple = $('relayout-ripple');
    overlay.style.setProperty('--wipe', radius);
    ripple.style.setProperty('--wipe', radius);
    ripple.style.opacity = String(1 - o * o);
  } else overlay.style.opacity = String(1 - o);
}
function afterRelayoutRender() {
  const r = relayout;
  if (!r) return;
  if (r.disposeAfterRender) {
    r.disposeAfterRender.dispose();
    r.disposeAfterRender = null;
    r.stats.firstFrameMs = Math.round(performance.now() - r.stats.swapEnd);
  }
  // The last frame of the old garden is laid over the new one at the swap and fades out; with magic it is wiped
  // away by a ripple of light instead of a flat fade.
  if (r.phase === 'capture') {
    r.phase = 'swap';
    const overlay = $('relayout-overlay');
    overlay.width = canvas.width;
    overlay.height = canvas.height;
    overlay.getContext('2d').drawImage(canvas, 0, 0);
    overlay.style.opacity = '1';
    overlay.style.setProperty('--wipe', '-60px');
    overlay.classList.toggle('is-wiping', !!r.fx);
    overlay.hidden = false;
    swapWorld();
  }
}
// The next garden is built in short slices between frames, one message per slice, so a frame that falls due is
// drawn in between: the garden on screen, its celebrations included, keeps moving while the new one is put
// together (owner, round 9: the whole scene used to stop for ~3 s). Phase A waits for it with its islands hovering.
const BUILD_SLICE_MS = 5,
  buildChannel = new MessageChannel();
buildChannel.port1.onmessage = () => buildSlice();
function startBuild(r) {
  r.build?.return();
  r.build = worldSteps(r.list);
  r.built = null;
  r.uploads = null;
  r.meshes = null;
  r.stats.buildStart = performance.now();
  r.stats.slices = 0;
  r.stats.steps = 0;
  r.stats.longestSliceMs = 0;
  // Steps over 12 ms ([step number, ms]): where world.mjs needs another pause.
  r.stats.longSteps = [];
  queueSlice(r);
}
function queueSlice(r) {
  if (r.buildQueued) return;
  r.buildQueued = true;
  buildChannel.port2.postMessage(0);
}
function buildSlice() {
  const r = relayout;
  if (!r) return;
  r.buildQueued = false;
  if ((!r.build && !r.uploads?.length && !r.meshes?.length) || alive.disposed) return;
  const start = performance.now(),
    open = () => performance.now() - start < BUILD_SLICE_MS;
  try {
    while (r.build && open()) buildStep(r);
    while (!r.build && r.uploads.length && open()) renderer.initTexture(r.uploads.pop());
    // The meshes wait for their shaders: a draw with a shader still compiling stops the page until it is done.
    while (!r.build && !r.uploads.length && r.compiled && r.meshes.length && open()) warmMeshes(r);
  } catch (error) {
    r.build = null;
    abortRelayout(error);
    return;
  }
  r.stats.slices++;
  r.stats.longestSliceMs = Math.max(r.stats.longestSliceMs, Math.round(performance.now() - start));
  if (r.build || r.uploads.length || (r.meshes.length && r.compiled)) queueSlice(r);
  else if (!r.meshes.length) {
    r.stats.buildMs = Math.round(performance.now() - r.stats.buildStart);
    requestRender();
  }
}
function buildStep(r) {
  const before = performance.now(),
    step = r.build.next(),
    took = performance.now() - before;
  if (took > 12) r.stats.longSteps.push([r.stats.steps, Math.round(took)]);
  r.stats.steps++;
  if (step.done) {
    r.build = null;
    prepareBuilt(r, step.value);
  }
}
// A finished garden is made ready for its first frame in the next slices.
function prepareBuilt(r, built) {
  r.built = built;
  // Its textures go to the GPU a few per slice: they all used to arrive in the new garden's first frame (~200
  // uploads, a stall of up to half a second). Then its visible meshes (warmMeshes).
  r.uploads = worldTextures(built.scene);
  r.meshes = [];
  built.scene.traverseVisible(object => {
    if (object.geometry && (object.isMesh || object.isPoints || object.isLine || object.isSprite))
      r.meshes.push(object);
  });
  r.stats.textures = r.uploads.length;
  r.stats.meshes = r.meshes.length;
  r.stats.slowWarm = [];
  // Its shaders are taken over while the old garden still holds them, hidden parts too (the falls' mist, hidden
  // while islands move): they were let go with the old garden and compiled again in the rearrangement's last frame.
  built.setSeason(season);
  built.setEconomy(economy, graphics === 'medium');
  ultraEffects.applyTo(built);
  r.compiled = false;
  compileScene(built.scene).then(() => {
    if (r.built !== built) return;
    r.compiled = true;
    if (r.meshes.length) queueSlice(r);
    requestRender();
  });
}
// Whether the garden for the current list is ready. A newer list from phase A is built once phase A is over,
// unless it drops the island being read: that one waits and goes through the filtered-out check afterwards.
function builtFor(r) {
  if (queuedList && (!r.focus || queuedList.some(p => p.id === r.focus))) {
    r.list = queuedList;
    queuedList = null;
    r.filters = r.list.filters || filters;
    r.toIds = r.list.map(p => p.id);
    r.toFrames = layoutFrames(r.toIds);
    r.plan = planTransition(r.fromIds, r.toIds, r.fromFrames, r.toFrames);
    const turn = r.focus ? r.plan.turn(r.focus) : null;
    r.ride = !!r.focus && turn !== null && Math.abs(turn) <= 0.9;
    r.teleport = !!r.focus && !r.ride;
    r.stats.to = r.toIds.length;
    r.stats.glide = r.plan.glide.length;
    r.stats.sink = r.plan.sink.length;
    r.stats.rise = r.plan.rise.length;
    startBuild(r);
  }
  return !!r.built && !r.uploads.length && !r.meshes.length && r.compiled;
}
// Geometry goes up the same way: a few of the new garden's visible meshes are drawn into a one-pixel target, which
// sends their buffers to the GPU now and not all in the garden's first frame (~740 buffers). Only those meshes and
// the lights are on the warm layer for that draw; the target passes for the scene pass's own (same shaders).
const WARM_LAYER = 30,
  WARM_BATCH = 4,
  warmCamera = new THREE.PerspectiveCamera();
let warmTarget = null;
function warmMeshes(r) {
  const scene = r.built.scene,
    batch = r.meshes.splice(-WARM_BATCH),
    lights = [];
  warmTarget ??= new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  warmTarget.isXRRenderTarget = true;
  warmTarget.texture.colorSpace = bloom?.composing ? THREE.LinearSRGBColorSpace : renderer.outputColorSpace;
  warmCamera.copy(camera);
  warmCamera.layers.set(WARM_LAYER);
  scene.traverse(object => {
    if (object.isLight) lights.push(object);
  });
  const culled = batch.map(object => object.frustumCulled);
  for (const object of [...batch, ...lights]) object.layers.enable(WARM_LAYER);
  for (const object of batch) object.frustumCulled = false;
  const previous = renderer.getRenderTarget(),
    started = performance.now();
  try {
    renderer.setRenderTarget(warmTarget);
    renderer.render(scene, warmCamera);
    // Slow batches ([ms, "name vertices"]): which meshes cost the most to send.
    const took = performance.now() - started;
    if (took > 20)
      r.stats.slowWarm.push([
        Math.round(took),
        batch
          .map(object => `${object.name || object.type} ${object.geometry.attributes.position?.count ?? 0}v`)
          .join(', ')
      ]);
  } finally {
    renderer.setRenderTarget(previous);
    for (const object of [...batch, ...lights]) object.layers.disable(WARM_LAYER);
    batch.forEach((object, k) => (object.frustumCulled = culled[k]));
  }
}
// Shaders of a scene (or an object about to join the world's scene) made ahead of its first frame.
function compileScene(object, scene = object) {
  return bloom ? bloom.compile(object, camera, scene) : renderer.compileAsync(object, camera, scene);
}
// The same for a part that arrives later inside a world's scene (the walkers' model).
function prepareShaders(object) {
  if (alive.disposed || !renderer) return;
  let scene = object;
  while (scene.parent) scene = scene.parent;
  // Only a head start: a failure leaves the shaders to their first frame, as before.
  try {
    compileScene(object, scene);
  } catch (error) {
    console.warn('Shaders could not be prepared ahead', error);
  }
}
// The textures of a world's materials that can go to the GPU now (not pictures still loading, not render targets).
function worldTextures(scene) {
  const found = new Set(),
    take = value => {
      if (!value?.isTexture || value.isRenderTargetTexture || value.isCubeTexture || !value.version) return;
      const image = value.image;
      if (!image || (image instanceof HTMLImageElement && !image.complete)) return;
      found.add(value);
    };
  scene.traverse(object => {
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material) continue;
      for (const key in material) take(material[key]);
      if (material.uniforms) for (const key in material.uniforms) take(material.uniforms[key]?.value);
    }
  });
  return [...found];
}
function swapWorld() {
  try {
    rebuildWorld();
  } catch (error) {
    abortRelayout(error);
  }
}
function rebuildWorld() {
  const r = relayout;
  if (!r || r.phase !== 'swap' || alive.disposed) return;
  const started = performance.now(),
    oldWorld = world,
    next = adoptWorld(r.built);
  r.built = null;
  projects = r.list;
  world = next;
  worldFilters = r.filters;
  r.disposeAfterRender = oldWorld;
  r.stats.adoptMs = Math.round(performance.now() - started);
  world.setSeason(season);
  lastLighting = lighting(world, presetMode(timeMode), new Date(), lightStyle, solarCity);
  lightFade = null;
  world.setEconomy(economy, graphics === 'medium');
  ultraEffects.applyTo(world);
  world.focusProject(-1);
  poseIslandsForPhaseB(r);
  keepViewAcrossSwap(r);
  portalSelection = Math.max(0, r.toIds.indexOf(r.previewed));
  renderProjectLists();
  renderHolidayProjects();
  preview(projects.length ? portalSelection : 0);
  if (projects.length) updateProject(selected);
  else updateMode();
  if (mode === 'journey' && projects.length) {
    updateSection();
    if (zone === 'comments') loadComments(selected);
  }
  if (r.fx) startRelayoutWipe(r);
  r.phase = 'b';
  r.clock = 0;
  r.last = null;
  r.stats.swapEnd = performance.now();
  requestRender();
}
// The new garden as phase B starts it: bridges hidden, lamps off, rising islands sunk out of sight (and faded
// with the effects), gliders at their old places.
function poseIslandsForPhaseB(r) {
  const T = world.transitions;
  T.setActive(true);
  T.setReveal(-0.01);
  T.setPracticalLevel(0);
  if (r.fx) {
    world.scene.add(r.fx.group);
    T.setGlow(1, 0.3);
    for (const id of r.plan.rise) if (id !== r.focus) T.setFade(r.toIds.indexOf(id) + 1, 0.9);
  }
  for (const id of r.plan.rise)
    if (id !== r.focus)
      T.setOwner(r.toIds.indexOf(id) + 1, sinkMatrix(THREE, r.toFrames.get(id), 1, ownerScratch));
  for (const id of r.plan.glide)
    if (!(id === r.focus && r.teleport)) {
      displacement(THREE, r.plan.frameAt(id, 0), r.toFrames.get(id), ownerScratch);
      T.setOwner(r.toIds.indexOf(id) + 1, ownerScratch);
    }
}
// Across the swap the reader keeps their view: the focused island carries the camera to its new frame; otherwise
// the selection, the terrace or teaser and the overview orbit are re-expressed for the new garden.
function keepViewAcrossSwap(r) {
  if (r.focus) {
    // Camera keeps its pose relative to the focused island, at that island's new frame.
    const move = displacement(THREE, r.toFrames.get(r.focus), r.fromFrames.get(r.focus));
    r.cameraFinal = {
      position: r.camera.position.clone().applyMatrix4(move),
      look: r.camera.look.clone().applyMatrix4(move)
    };
    selected = r.toIds.indexOf(r.focus);
    current = target = selected;
    if (pinnedPose) pinnedPose = r.cameraFinal.position.clone();
    if (r.teleport) {
      camera.position.copy(r.cameraFinal.position);
      look.copy(r.cameraFinal.look);
    }
  } else {
    const kept = r.toIds.indexOf(r.selectedId);
    selected = kept >= 0 ? kept : Math.max(0, Math.min(selected, projects.length - 1));
    current = target = projects.length ? routeIndex(selected) : 0;
    // The teaser island may move out with the scenery; meet it at its new place behind the crossfade.
    if (scenicFocus) {
      // The observatory never moves: a visitor on its terrace stays there and watches the garden rearrange.
      scenicFocus = scenicFocus.lookAround && world.skyIsland ? scenicFocus : world.teaser || null;
      if (!scenicFocus) app.classList.remove('is-exploring');
      const pose = overviewPose();
      camera.position.copy(pose.position);
      look.copy(pose.look);
    }
    // Overview keeps the camera where it is; the zoom is re-expressed for the new ring size.
    // A chosen arrangement frames the whole new garden; otherwise the camera stays and the zoom is re-expressed.
    else if (mode === 'overview' && r.showcase) {
      const from = { position: camera.position.clone(), look: look.clone() };
      resetOrbit(orbitView, true);
      const pose = overviewPose();
      r.cameraGlide = { from, to: { position: pose.position.clone(), look: pose.look.clone() } };
    } else if (mode === 'overview') {
      // The orbit is re-expressed about the new garden's home, from where the camera stands.
      const home = overviewHome(),
        s = new THREE.Spherical().setFromVector3(camera.position.clone().sub(home.aim));
      orbitRange(orbitView, home);
      Object.assign(orbitView.goal, {
        yaw: s.theta - home.theta,
        pitch: THREE.MathUtils.clamp(s.phi - home.phi, ...orbitView.range.pitch),
        zoom: THREE.MathUtils.clamp(s.radius / home.dist, ...orbitView.range.zoom),
        pan: { x: 0, y: 0, z: 0 }
      });
      orbitStep(orbitView, 0, true);
    }
    if (mode === 'journey' && !projects.length) mode = 'overview';
  }
}
// The ripple wipe starts at the stand being read, or at the garden centre in overview.
function startRelayoutWipe(r) {
  let x = viewport.width / 2,
    y = viewport.height * 0.52;
  if (mode !== 'journey') {
    const p = new THREE.Vector3(0, 1.2, 0);
    if (inFrontOfCamera(camera, p, screenScratch)) {
      p.project(camera);
      x = THREE.MathUtils.clamp(((p.x + 1) / 2) * viewport.width, 0, viewport.width);
      y = THREE.MathUtils.clamp(((1 - p.y) / 2) * viewport.height, 0, viewport.height);
    }
  }
  r.wipe = { width: viewport.width, height: viewport.height, x, y };
  const ripple = $('relayout-ripple');
  for (const element of [$('relayout-overlay'), ripple]) {
    element.style.setProperty('--wipe-x', x.toFixed(0) + 'px');
    element.style.setProperty('--wipe-y', y.toFixed(0) + 'px');
    element.style.setProperty('--wipe', '-60px');
  }
  ripple.style.opacity = '1';
  ripple.hidden = false;
}
function clearRelayoutOverlay() {
  const overlay = $('relayout-overlay'),
    ripple = $('relayout-ripple');
  overlay.hidden = true;
  overlay.classList.remove('is-wiping');
  overlay.style.opacity = '';
  ripple.hidden = true;
  ripple.style.opacity = '';
}
function finishRelayout() {
  const r = relayout,
    T = world.transitions;
  T.resetOwners();
  T.setActive(false);
  T.setPracticalLevel(1);
  T.setReveal(1);
  T.setGlow?.(0);
  clearRelayoutOverlay();
  relayout = null;
  app.classList.remove('is-relayout');
  if (r.cameraFinal && mode === 'journey') {
    camera.position.copy(r.cameraFinal.position);
    look.copy(r.cameraFinal.look);
    if (pinnedPose) pinnedPose = camera.position.clone();
  }
  if (r.cameraGlide && mode === 'overview') {
    camera.position.copy(r.cameraGlide.to.position);
    look.copy(r.cameraGlide.to.look);
  }
  world.focusProject(mode === 'journey' ? selected : -1);
  if (r.showcase && mode === 'overview') {
    if (!reduced) ensureMagic();
    showcase?.play(world, projects, orderCaption(), { reduced });
  }
  const summary = frames => {
    if (!frames.length) return null;
    const sorted = [...frames].sort((a, b) => a - b),
      at = q => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
    return { count: frames.length, median: at(0.5), p95: at(0.95), max: sorted.at(-1) };
  };
  r.stats.totalMs = Math.round(performance.now() - r.stats.started);
  r.stats.phaseA = summary(r.stats.frames.a);
  r.stats.phaseB = summary(r.stats.frames.b);
  r.stats.reduced = reduced;
  r.stats.economy = economy;
  delete r.stats.frames;
  relayoutStats.push(r.stats);
  if (relayoutStats.length > 24) relayoutStats.shift();
  updateMode();
  syncFilterControls();
  if (queuedList) {
    const list = queuedList;
    queuedList = null;
    applyList(list);
  }
  settleHistory();
  requestRender();
}
// A failed rearrangement never leaves the garden frozen behind the overlay. Before the swap the
// current garden simply stays (filters revert, as for a failed request); after it the new one settles.
function abortRelayout(error) {
  console.error('Island relayout failed', error);
  const r = relayout;
  relayout = null;
  r?.build?.return();
  queuedList = pendingList = null;
  filteredOut = null;
  if (r?.disposeAfterRender && r.disposeAfterRender !== world) {
    try {
      r.disposeAfterRender.dispose();
    } catch {}
  }
  try {
    const T = world.transitions;
    T.resetOwners();
    T.setActive(false);
    T.setPracticalLevel(1);
    T.setReveal(1);
    T.setGlow?.(0);
    world.focusProject(mode === 'journey' ? selected : -1);
  } catch {}
  try {
    clearRelayoutOverlay();
  } catch {}
  app.classList.remove('is-relayout');
  if (r && projects !== r.list) {
    filters = appliedFilters = worldFilters;
    writeFilterUrl();
    showNotice(labels.filterError);
  } else if (r?.cameraFinal && mode === 'journey') {
    camera.position.copy(r.cameraFinal.position);
    look.copy(r.cameraFinal.look);
  }
  updateMode();
  syncFilterControls();
  settleHistory();
  requestRender();
}

// ---- Site links and languages from the API; the server-rendered markup stays as the fallback ----
const linkIcons = {
  TELEGRAM: '<path d="m3 10 18-7-6 18-5-7-7-4Zm7 4 11-11"/>',
  GITHUB:
    '<path d="M9 21v-3c-4 1-4-2-6-2m12 5v-3c0-1-.3-2-1-2.5 3-.4 5-1.5 5-5 0-1-.4-2-1-3 .2-1 .1-2-.5-3-1.3 0-2.5.5-3.5 1.2a10 10 0 0 0-6 0C7 4.5 5.8 4 4.5 4c-.6 1-.7 2-.5 3-.6 1-1 2-1 3 0 3.5 2 4.6 5 5-.7.5-1 1.5-1 2.5v3"/>',
  MAIL: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>',
  DOCS: '<path d="M6 3h9l4 4v14H6V3Zm9 0v5h4M9 12h7m-7 4h7"/>',
  OTHER:
    '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1m2 3.7a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'
};
async function loadSiteLinks() {
  // A copy on another site keeps the footer of its page (that site's API does not answer other origins).
  if (data.localePages) return;
  try {
    const links = await fetchLinks({});
    if (!links.length) return;
    const host = document.querySelector('.garden-footer>div');
    host.replaceChildren(
      ...links.map(link => {
        const a = document.createElement('a');
        a.href = link.href;
        a.dataset.linkType = link.type;
        if (link.type === 'MAIL') {
          a.className = 'email-contact';
          a.setAttribute('aria-label', labels.contact);
        } else if (!link.href.startsWith('/')) a.rel = 'nofollow';
        a.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + linkIcons[link.type] + '</svg>';
        const span = document.createElement('span');
        span.textContent = link.type === 'DOCS' ? labels.docs : link.label;
        a.append(span);
        attachActionFeedback(a);
        return a;
      })
    );
  } catch (error) {
    console.info('Site links: keeping the built-in footer', error.status || error.message);
  }
}
async function loadLanguages() {
  // A copy offers the languages it has pages for (data.localePages).
  if (data.localePages) return;
  try {
    const list = await fetchLanguages({});
    if (!list.length) return;
    const select = $('language'),
      auto = [...select.options].find(option => option.value === 'auto');
    select.replaceChildren(
      ...list.map(language => {
        const option = document.createElement('option');
        option.value = language.value;
        option.textContent = language.nativeName;
        option.dataset.short = language.value.toUpperCase();
        return option;
      }),
      ...(auto ? [auto] : [])
    );
    select.value = list.some(language => language.value === data.locale)
      ? data.locale
      : list.find(language => language.current)?.value || select.options[0].value;
    select.dispatchEvent(new Event('picker-options'));
  } catch (error) {
    console.info('Languages: keeping the built-in list', error.status || error.message);
  }
}

// ---------- Built-in benchmark (garden-bench.mjs) ----------
// The bundle's build stamp (build-garden.mjs defines it); unbundled sources report 'dev'.
// eslint-disable-next-line no-undef
const GARDEN_BUILD = typeof __GARDEN_BUILD__ === 'string' ? __GARDEN_BUILD__ : 'dev';
// The Settings row (its text falls back to the module's strings until the server dictionaries have it) and
// ?bench=1 / ?bench=winter, which starts a run shortly after the garden is ready.
function bindBench() {
  const button = $('bench-open');
  if (button) {
    const strings = benchStrings(data.locale, labels),
      text = button.querySelector('span'),
      heading = $('bench-heading');
    if (text && !text.textContent.trim()) text.textContent = strings.title;
    if (heading && !heading.textContent.trim()) heading.textContent = strings.heading;
    button.addEventListener('click', () => openBench());
  }
  const scene = benchRequest(location.search);
  if (scene) setTimeout(() => runtimeAvailable() && !relayout && openBench(scene), BENCH.autoDelay);
}
function openBench(scene = null) {
  if (rejectRemoteDockNavigation()) return;
  benchUi ??= mountBench({
    document,
    window,
    labels,
    locale: data.locale,
    canvas,
    gl: () => renderer.getContext(),
    garden: benchGarden,
    enter: enterBench,
    leave: leaveBench,
    settings: () => ({
      economy,
      graphics,
      reduced,
      bloom: !!bloom?.enabled,
      pixelRatio: renderer.getPixelRatio(),
      lightStyle,
      mobile: mobile()
    }),
    projects: () => projects.length,
    build: GARDEN_BUILD,
    firstFrameMs: () => Math.round(firstFrameAt)
  });
  if (scene) benchUi.start(scene);
  else {
    hidePreferences();
    benchUi.open($('settings'));
  }
}
// The garden as the route builder sees it: the bridge route, the sky island and the cloud floor.
function benchGarden() {
  const route = world.route,
    sky = world.skyIsland;
  return {
    radius: route.radius,
    segments: route.count ? route.segments : 0,
    point: (p, offset, eye) => route.point(p, offset, eye),
    normal: p => route.normal(p),
    station: sky?.view ? { island: sky.view.island, deck: sky.view.deck } : null,
    floor: ORBIT.floor
  };
}
// Fixed season, time of day and natural light; the overview state with nothing in flight; UI hidden.
function enterBench(preset, runner, probe) {
  hidePreferences();
  // No holiday show runs over a benchmark: the fireworks hold still until it is over.
  fireworks?.pause();
  if (dialog.open) dialog.close();
  if (ride) skip();
  showOverview(false, true);
  benchSaved = { seasonMode, timeMode, lightStyle, probe: renderer.gardenFrameProbe };
  seasonMode = preset.season;
  applySeason();
  timeMode = preset.time;
  lightStyle = 'natural';
  lastLighting = lighting(world, presetMode(timeMode), new Date(), lightStyle, solarCity);
  lightFade = animation = portalTransit = null;
  bloom?.setLens(null);
  travelLook.yaw = travelLook.pitch = 0;
  // The run's GPU timer takes the probe's place (two timer queries cannot be open at once).
  renderer.gardenFrameProbe = probe;
  app.classList.add('is-benchmark');
  // A benchmark measures the device at its own resolution: the adaptive share goes back to full before the run
  // reads the canvas size.
  if (adaptive && (adaptiveScale < 1 || adaptivePending !== null)) {
    adaptivePending = adaptive.restore();
    applyAdaptiveScale();
  }
  bench = runner;
  lastFrame = 0;
  requestRender();
}
function leaveBench() {
  if (!benchSaved) return;
  bench = null;
  fireworks?.resume();
  renderer.gardenFrameProbe = benchSaved.probe;
  ({ seasonMode, timeMode, lightStyle } = benchSaved);
  benchSaved = null;
  app.classList.remove('is-benchmark');
  applySeason();
  lastLighting = lighting(world, presetMode(timeMode), new Date(), lightStyle, solarCity);
  showOverview(false, true);
  resetOrbit(orbitView, true);
  overviewFrame();
  requestRender();
}

// ---------- Temporary holiday preview in settings ----------
// The current show and greeting stop and the chosen ones start on the same fireworks pool, without a reload.
// The address keeps ?celebrate=<key> so the view can be shared; nothing is saved.
function switchCelebration(next) {
  if (rejectRemoteDockNavigation()) {
    syncHolidayPreview();
    return;
  }
  if (bench) return;
  history.replaceState(history.state, '', celebrateUrl(location.href, next));
  occasion = celebrationFor(new Date(), location.search, projects);
  syncHolidayPreview();
  if (!occasion) {
    greeting?.hide();
    fireworks?.stop();
  } else {
    if (greeting) greeting.setOccasion(occasion, birthdaysNow());
    else greeting = mountGreeting(document, { occasion, labels, locale: data.locale, party: birthdaysNow() });
    greeting?.show();
    greeting?.arm();
    if (fireworks) {
      fireworks.setOccasion(occasion, greeting?.copy.sky);
      fireworks.start();
    } else if (world) attachCelebration(world);
  }
  if (fireworks && world) partyFor(world);
  celebrationStage?.setOccasion(occasion, birthdaysNow());
  requestRender();
}
// A compact native select keeps all supported occasions accessible without persisting test state.
const holidayPreview = /** @type {HTMLSelectElement} */ ($('holiday-preview'));
function syncHolidayPreview() {
  if (!holidayPreview) return;
  const raw = new URLSearchParams(location.search).get('celebrate');
  let value = raw === null ? 'auto' : raw;
  if (![...holidayPreview.options].some(option => option.value === value)) {
    value = occasion || 'off';
    if (occasion === 'project' && raw) {
      holidayPreview.add(new Option(labels.celebrateNameProject + ' (' + raw + ')', raw));
      value = raw;
    }
  }
  holidayPreview.value = value;
}
if (holidayPreview) {
  holidayPreview.add(new Option(labels.holidayPreviewAuto, 'auto'));
  holidayPreview.add(new Option(labels.holidayPreviewOff, 'off'));
  const titleKeys = { newyear: 'NewYear', oldnewyear: 'OldNewYear', march8: 'March8' };
  for (const key of calendarOrder()) {
    const titleKey = titleKeys[key] || key[0].toUpperCase() + key.slice(1);
    holidayPreview.add(new Option(labels['celebrate' + titleKey + 'Title'] || key, key));
  }
  holidayPreview.add(new Option(labels.celebrateNameProject, 'project'));
  renderHolidayProjects();
  holidayPreview.addEventListener('change', () => switchCelebration(holidayPreview.value));
}
// One option per project in the current list, keyed by the project's id: a station number picked before a re-sort
// or a filter greeted whoever stood there afterwards (owner, round 17). Rebuilt with every new list.
function renderHolidayProjects() {
  if (!holidayPreview) return;
  for (const option of [...holidayPreview.options]) if (option.value.startsWith('project:')) option.remove();
  for (const project of projects)
    holidayPreview.add(
      new Option(labels.celebrateNameProject + ': ' + project.name, 'project:' + project.id)
    );
  syncHolidayPreview();
}
function hidePreferences() {
  $('preferences').hidden = true;
  $('settings').setAttribute('aria-expanded', 'false');
  document.querySelectorAll('.control-picker').forEach(el => el.dispatchEvent(new Event('picker-close')));
}
// Hidden interface (owner, M18): the eye in the top bar (or H) leaves only the garden and a small «Показать»;
// that button, Escape or H bring everything back.
let uiHidden = false;
function setUiHidden(on, focus = true) {
  uiHidden = !!on;
  app.classList.toggle('is-ui-hidden', uiHidden);
  $('ui-show').hidden = !uiHidden;
  if (uiHidden) {
    hidePreferences();
    closeProjectSwitch(false);
  }
  if (focus) $(uiHidden ? 'ui-show' : 'ui-hide').focus({ preventScroll: true });
}
// «Другой проект» (owner, M18): on a phone the open card offers one compact list instead of the dock's
// prev/next; choosing a project starts the trip there.
function openProjectSwitch() {
  const list = $('project-switch-list');
  list.replaceChildren(
    ...projects.map((project, i) => {
      const b = document.createElement('button'),
        name = document.createElement('span');
      b.type = 'button';
      b.dataset.index = String(i);
      name.textContent = project.name;
      b.append(projectIcon(project), name);
      if (i === selected) b.setAttribute('aria-current', 'true');
      return b;
    })
  );
  list.hidden = false;
  $('project-switch').setAttribute('aria-expanded', 'true');
  const current = list.querySelector('[aria-current]') || list.firstElementChild;
  current?.scrollIntoView?.({ block: 'nearest' });
  current?.focus({ preventScroll: true });
}
function closeProjectSwitch(focus = true) {
  const list = $('project-switch-list');
  if (!list || list.hidden) return;
  list.hidden = true;
  list.replaceChildren();
  $('project-switch').setAttribute('aria-expanded', 'false');
  if (focus) $('project-switch').focus({ preventScroll: true });
}
function bindCleanView() {
  $('ui-hide').addEventListener('click', () => setUiHidden(true));
  $('ui-show').addEventListener('click', () => setUiHidden(false));
  $('project-switch').addEventListener('click', () =>
    $('project-switch-list').hidden ? openProjectSwitch() : closeProjectSwitch()
  );
  $('project-switch-list').addEventListener('click', event => {
    const choice = event.target.closest?.('button[data-index]');
    if (!choice) return;
    const index = Number(choice.dataset.index);
    closeProjectSwitch(false);
    if (index !== selected) goTo(index);
  });
  $('project-switch-list').addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeProjectSwitch();
    }
  });
  // A tap anywhere else folds the list away.
  document.addEventListener('pointerdown', event => {
    if (!event.target.closest?.('#project-switch,#project-switch-list')) closeProjectSwitch(false);
  });
  // The phone gallery starts right under the card, whatever its height (long names wrap).
  const card = $('project-card');
  bindProjectCardSwipe(card);
  if (typeof ResizeObserver === 'function')
    new ResizeObserver(() => {
      if (card.offsetHeight) app.style.setProperty('--card-height', card.offsetHeight + 'px');
    }).observe(card);
}
// A quick sideways swipe across the project card (touch) travels to the next or previous project: the card is
// what is being read, so the gesture cannot be mistaken for turning the view. Text being typed or scrolled, the
// project list and the comment form keep their own gestures; the click after a swipe is swallowed.
// distance (px), time (ms) and ratio (sideways over upright) are what makes it a swipe.
const CARD_SWIPE = { distance: 56, time: 450, ratio: 1.6 };
function bindProjectCardSwipe(card) {
  let start = null,
    swallow = false;
  card.addEventListener('pointerdown', event => {
    start =
      event.pointerType === 'touch' &&
      !event.target.closest?.('#zone-content,#project-switch-list,#comment-form,input,textarea,select')
        ? { id: event.pointerId, x: event.clientX, y: event.clientY, at: event.timeStamp }
        : null;
  });
  card.addEventListener('pointerup', event => {
    const s = start;
    start = null;
    if (!s || s.id !== event.pointerId || mode !== 'journey') return;
    const dx = s.x - event.clientX,
      dy = s.y - event.clientY;
    if (
      event.timeStamp - s.at < CARD_SWIPE.time &&
      Math.abs(dx) > CARD_SWIPE.distance &&
      Math.abs(dx) > Math.abs(dy) * CARD_SWIPE.ratio
    ) {
      swallow = true;
      step(dx > 0 ? 1 : -1);
    }
  });
  card.addEventListener('pointercancel', () => (start = null));
  card.addEventListener(
    'click',
    event => {
      if (!swallow) return;
      swallow = false;
      event.preventDefault();
      event.stopPropagation();
    },
    true
  );
}
function enhancePicker(id) {
  const select = $(id),
    wrap = document.createElement('div'),
    trigger = document.createElement('button'),
    menu = document.createElement('div'),
    options = [];
  wrap.className = 'control-picker ' + id + '-picker';
  trigger.type = 'button';
  trigger.id = id + '-trigger';
  trigger.className = 'picker-trigger';
  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-label', select.getAttribute('aria-label'));
  menu.id = id + '-menu';
  menu.className = 'picker-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', select.getAttribute('aria-label'));
  menu.hidden = true;
  trigger.setAttribute('aria-controls', menu.id);
  const close = () => {
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
  };
  const sync = () => {
    const label = select.selectedOptions[0]?.textContent || '';
    trigger.textContent =
      id === 'language' && select.value === 'auto'
        ? 'AUTO'
        : select.selectedOptions[0]?.dataset.short || label;
    trigger.title = label;
    trigger.disabled = select.disabled;
    options.forEach(button =>
      button.setAttribute('aria-checked', String(button.dataset.value === select.value))
    );
  };
  const rebuild = () => {
    menu.replaceChildren();
    options.splice(0);
    for (const option of select.options) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.value = option.value;
      button.setAttribute('role', 'menuitemradio');
      if (id === 'language') decorateLanguageOption(button, option.value, option.textContent);
      else button.textContent = option.textContent;
      button.addEventListener('click', () => {
        select.value = option.value;
        sync();
        close();
        trigger.focus();
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
      menu.append(button);
      options.push(button);
    }
    sync();
  };
  trigger.addEventListener('click', () => {
    const open = menu.hidden;
    document.querySelectorAll('.control-picker').forEach(el => el.dispatchEvent(new Event('picker-close')));
    menu.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
    if (open) options.find(button => button.dataset.value === select.value)?.focus();
  });
  wrap.addEventListener('picker-close', close);
  wrap.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      trigger.focus();
    } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) && options.length) {
      event.preventDefault();
      menu.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      const current = options.indexOf(document.activeElement),
        up = event.key === 'ArrowUp';
      let index;
      if (event.key === 'Home') index = 0;
      else if (event.key === 'End') index = options.length - 1;
      // Nothing focused yet: Up starts from the last option, Down from the first.
      else if (current < 0) index = up ? options.length - 1 : 0;
      // The arrows wrap round.
      else index = (current + (up ? -1 : 1) + options.length) % options.length;
      options[index].focus();
    } else if (event.key === 'Tab') close();
  });
  document.addEventListener('pointerdown', event => {
    if (!wrap.contains(event.target)) close();
  });
  select.addEventListener('change', sync);
  select.addEventListener('picker-sync', sync);
  select.addEventListener('picker-options', rebuild);
  select.hidden = true;
  select.after(wrap);
  wrap.append(trigger, menu);
  rebuild();
}
// The server reads lang strings from an embedded resource, so until it is rebuilt the new key may be missing.
const morningLabel = () => labels.lightMorning || (String(data.locale).startsWith('ru') ? 'Утро' : 'Morning');
function enhanceTime() {
  const select = $('time'),
    control = $('time-switch'),
    values = TIME_MODES;
  select.hidden = true;
  for (const value of values) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.value = value;
    b.textContent =
      value === 'auto' ? labels.seasonAuto : value === 'morning' ? morningLabel() : labels[value];
    control.append(b);
  }
  const sync = () => {
    control.style.setProperty('--segment-index', values.indexOf(select.value));
    [...control.children].forEach(b =>
      b.setAttribute('aria-pressed', String(b.dataset.value === select.value))
    );
    $('time-calendar').textContent = select.value === 'auto' ? labels.auto : labels.timeManual;
  };
  bindSegmentedChoice(control, {
    getSelected: () => values.indexOf(select.value),
    onSelect: index => {
      select.value = values[index];
      select.dispatchEvent(new Event('change', { bubbles: true }));
      sync();
    }
  });
  select.addEventListener('change', sync);
  select.addEventListener('picker-sync', sync);
  sync();
}
