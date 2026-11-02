// Built-in benchmark (?bench=1, ?bench=winter, or Settings > Benchmark): the camera flies one fixed ~38 s route
// through the garden at a fixed season and time of day with the UI hidden and input locked, then a glass card
// shows the score, frame-time statistics, a frame-time graph and the device specs. Nothing is sent anywhere;
// the last runs stay in this browser's localStorage. Nothing here runs until a test is started, so normal
// visitors pay nothing per frame.

export const BENCH = {
  // Seconds of the route not counted (shaders, textures and caches settle), and the whole route.
  warmup: 4,
  duration: 38,
  // The score is normalised to a Full HD frame.
  baselinePixels: 1920 * 1080,
  // Frames recorded per run (38 s at 400 fps), preallocated so a run allocates nothing per frame.
  capacity: 16000,
  gpuQueries: 8,
  historyKey: 'garden-bench-history',
  historySize: 10,
  // Overlay text refresh (ms), and the delay before ?bench=1 starts after the garden is ready.
  overlayMs: 250,
  autoDelay: 1500,
  // Common display rates the refresh estimate snaps to.
  rates: [30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 180, 200, 240, 360]
};
// Fixed scenes: summer sunset (the default) and the heavier winter night (snow, lit windows, glow).
export const BENCH_SCENES = {
  summer: { season: 'summer', time: 'sunset' },
  winter: { season: 'winter', time: 'night' }
};

// ?bench=1 | summer -> 'summer', ?bench=winter | night -> 'winter', otherwise null.
export function benchRequest(search = '') {
  const value = new URLSearchParams(search).get('bench');
  if (value === '1' || value === 'summer') return 'summer';
  if (value === 'winter' || value === 'night') return 'winter';
  return null;
}

// ---------- Route ----------
const TAU = Math.PI * 2;
const mod = (a, m) => ((a % m) + m) % m;
const key = (t, p, l, phase) => ({ t, p: [p.x, p.y, p.z], l: [l.x, l.y, l.z], phase });
const v = (x, y, z) => ({ x, y, z });

// The phases of the route in seconds (for the progress line and the tests).
export const BENCH_PHASES = [
  { name: 'orbit', from: 0, to: 11 },
  { name: 'bridge', from: 11, to: 16.5 },
  { name: 'trip', from: 16.5, to: 25.6 },
  { name: 'centre', from: 25.6, to: 31 },
  { name: 'horizon', from: 31, to: 38 }
];
export const benchPhase = t => (BENCH_PHASES.find(p => t < p.to) || BENCH_PHASES.at(-1)).name;

// Keyframes of the route from a plain description of the garden:
// { radius, segments, point(p, offset, eye), normal(p), station: { island: {x, z}, deck } | null, floor }.
// Pure and deterministic: the same garden gives the same route every run.
export function buildBenchRoute(g) {
  const r = Math.max(10, g.radius || 22),
    floor = Number.isFinite(g.floor) ? g.floor : -6,
    keys = [],
    centre = v(0, 1.3, 0),
    hasBridge = (g.segments || 0) >= 1 && typeof g.point === 'function';
  // Bridge: the middle of the first span, seen from its outer side.
  let bridge = v(r, 0.3, 0),
    side = v(1, 0, 0);
  if (hasBridge) {
    bridge = g.point(0.5, 0, 0);
    const n = g.normal(0.5),
      out = n.x * bridge.x + n.z * bridge.z >= 0 ? 1 : -1;
    side = v(n.x * out, 0, n.z * out);
  }
  const approach = v(bridge.x + side.x * 16, bridge.y + 9, bridge.z + side.z * 16);
  // 1. Orbit: from the overview's home direction round to the bridge's side (0.6 .. 2.6 half turns).
  const a0 = Math.atan2(2.15, 2.65),
    a1 = Math.atan2(approach.x, approach.z);
  let sweep = mod(a1 - a0, TAU);
  if (sweep < 0.6 * Math.PI) sweep += TAU;
  const R = r * 3.05,
    H = r * 1.6;
  for (let i = 0; i <= 6; i++) {
    const a = a0 + (sweep * i) / 6,
      // Closing in during the last third so the descent to the bridge is gentle.
      k = i < 4 ? 1 : 1 - (i - 3) * 0.12;
    keys.push(key((11 * i) / 6, v(Math.sin(a) * R * k, H * k, Math.cos(a) * R * k), centre, 'orbit'));
  }
  // 2. Zoom down to the bridge.
  keys.push(key(13.6, approach, bridge, 'bridge'));
  keys.push(key(16, v(bridge.x + side.x * 7, bridge.y + 3.2, bridge.z + side.z * 7), bridge, 'bridge'));
  // 3. Trip between two pavilions along the deck at walking eye height (over the next span).
  const from = hasBridge && g.segments >= 2 ? 1.1 : 0.1;
  if (hasBridge) {
    const roof = g.point(from - 0.05, 0, 7.5),
      ahead = g.point(from + 0.15, 0, 2.5);
    keys.push(key(17.4, roof, ahead, 'trip'));
    for (let k = 0; k <= 8; k++) {
      const p = from + k * 0.1;
      keys.push(key(18.6 + k * 0.875, g.point(p, 0, 3.3), g.point(p + 0.12, 0, 2.6), 'trip'));
    }
  } else {
    keys.push(key(18.6, v(r * 0.9, 9, r * 0.9), centre, 'trip'));
    keys.push(key(25.6, v(-r * 0.9, 9, r * 0.9), centre, 'trip'));
  }
  // 4. Over the central island, then past the balloon station's sky island.
  const last = keys.at(-1).p;
  keys.push(key(27.8, v(last[0] * 0.4, 13, last[2] * 0.4), v(0, 3.5, 0), 'centre'));
  const sky = g.station;
  let towards = v(0, 0, -1);
  if (sky?.island) {
    const ix = sky.island.x,
      iz = sky.island.z,
      d = Math.hypot(ix, iz) || 1,
      deck = Number.isFinite(sky.deck) ? sky.deck : 23;
    towards = v(ix / d, 0, iz / d);
    // Beside the island, off its flank, a little below the deck, looking up at it.
    keys.push(
      key(
        30.2,
        v(ix * 0.55 - towards.z * 14, deck - 3, iz * 0.55 + towards.x * 14),
        v(ix, deck + 1, iz),
        'centre'
      )
    );
  } else keys.push(key(30.2, v(-r * 0.5, 16, r * 0.3), v(0, 3, 0), 'centre'));
  // 5. Near the horizon: low over the cloud sea outside the ring, looking across the garden to the far sky.
  const out = v(-towards.x, 0, -towards.z),
    low = floor + 1.6;
  for (let k = 0; k < 3; k++) {
    const a = Math.atan2(out.x, out.z) + (k - 1) * 0.22,
      dx = Math.sin(a),
      dz = Math.cos(a),
      dist = r + 26 - k * 4;
    keys.push(
      key(32.8 + k * 2.6, v(dx * dist, low + k * 0.8, dz * dist), v(-dx * 260, low + 9, -dz * 260), 'horizon')
    );
  }
  keys.at(-1).t = BENCH.duration;
  return { keys, duration: BENCH.duration, floor };
}

// Non-uniform Catmull-Rom (cubic Hermite) through the keyframes; writes into `position` and `look`.
export function benchPose(route, t, position, look) {
  const keys = route.keys,
    n = keys.length,
    time = Math.max(0, Math.min(route.duration, t));
  let i = 0;
  while (i < n - 2 && time > keys[i + 1].t) i++;
  const a = keys[i],
    b = keys[i + 1],
    h = Math.max(1e-6, b.t - a.t),
    s = Math.max(0, Math.min(1, (time - a.t) / h)),
    s2 = s * s,
    s3 = s2 * s,
    h00 = 2 * s3 - 3 * s2 + 1,
    h10 = s3 - 2 * s2 + s,
    h01 = -2 * s3 + 3 * s2,
    h11 = s3 - s2,
    prev = keys[Math.max(0, i - 1)],
    next = keys[Math.min(n - 1, i + 2)];
  for (const [out, f] of [
    [position, 'p'],
    [look, 'l']
  ]) {
    for (let c = 0; c < 3; c++) {
      const axis = c === 0 ? 'x' : c === 1 ? 'y' : 'z',
        m0 = (b[f][c] - prev[f][c]) / Math.max(1e-6, b.t - prev.t),
        m1 = (next[f][c] - a[f][c]) / Math.max(1e-6, next.t - a.t);
      out[axis] = h00 * a[f][c] + h10 * h * m0 + h01 * b[f][c] + h11 * h * m1;
    }
  }
  // Never dip into the cloud sea.
  if (position.y < route.floor + 0.6) position.y = route.floor + 0.6;
  return position;
}

// ---------- Statistics ----------
// Linear-interpolated percentile (q in 0..1) of an ascending array.
export function percentile(sorted, q) {
  const n = sorted.length;
  if (!n) return 0;
  const x = Math.max(0, Math.min(1, q)) * (n - 1),
    lo = Math.floor(x),
    hi = Math.min(n - 1, lo + 1);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (x - lo);
}
// "1% low": the frame rate of the slowest `share` of frames (their mean frame time), at least one frame.
export function lowFps(sorted, share) {
  const n = sorted.length;
  if (!n) return 0;
  const k = Math.max(1, Math.round(n * share));
  let sum = 0;
  for (let i = n - k; i < n; i++) sum += sorted[i];
  return sum > 0 ? (1000 * k) / sum : 0;
}
const mean = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const maxOf = a => a.reduce((m, x) => (x > m ? x : m), 0);
// Score = 10 x (0.7 x average FPS + 0.3 x 1% low FPS) x sqrt(frame pixels / 1920x1080).
// Rendering more pixels earns proportionally to the square root (the cost is not linear in pixels).
export function benchScore({ avgFps = 0, low1Fps = 0, pixels = BENCH.baselinePixels }) {
  const scale = Math.sqrt(Math.max(1, pixels) / BENCH.baselinePixels);
  return Math.round(10 * (0.7 * avgFps + 0.3 * low1Fps) * scale);
}
export const SCORE_FORMULA = '10 × (0.7 × avg FPS + 0.3 × 1% low FPS) × √(pixels / 1920×1080)';

// Snap the shortest steady frame interval (10th percentile of the warm-up) to a common display rate.
export function estimateRefresh(intervals) {
  const sorted = Array.from(intervals)
    .filter(x => x > 1 && x < 200)
    .sort((a, b) => a - b);
  if (sorted.length < 10) return null;
  const hz = 1000 / percentile(sorted, 0.1);
  return BENCH.rates.reduce((best, r) => (Math.abs(r - hz) < Math.abs(best - hz) ? r : best), BENCH.rates[0]);
}

// Summary of the measured frames: arrays (or typed arrays) of frame ms, CPU ms, draw calls, triangles, GPU ms.
export function summarizeRun({
  frame = [],
  cpu = [],
  calls = [],
  tris = [],
  gpu = [],
  pixels,
  refresh = null
}) {
  const sorted = Float64Array.from(frame).sort(),
    total = sorted.reduce((s, x) => s + x, 0),
    cpuSorted = Float64Array.from(cpu).sort(),
    gpuSorted = Float64Array.from(gpu).sort(),
    avgFps = total > 0 ? (1000 * sorted.length) / total : 0,
    low1Fps = lowFps(sorted, 0.01),
    low01Fps = lowFps(sorted, 0.001);
  return {
    frames: sorted.length,
    seconds: total / 1000,
    avgFps,
    low1Fps,
    low01Fps,
    frameMs: {
      median: percentile(sorted, 0.5),
      p95: percentile(sorted, 0.95),
      p99: percentile(sorted, 0.99)
    },
    cpuMs: { avg: mean(cpu), p95: percentile(cpuSorted, 0.95) },
    gpuMs: gpu.length ? { avg: mean(gpu), p95: percentile(gpuSorted, 0.95), samples: gpu.length } : null,
    calls: { avg: mean(calls), max: maxOf(calls) },
    triangles: { avg: mean(tris), max: maxOf(tris) },
    refresh,
    pixels,
    score: benchScore({ avgFps, low1Fps, pixels })
  };
}

// ---------- Device specs ----------
const safe = (f, fallback = null) => {
  try {
    const value = f();
    return value === undefined ? fallback : value;
  } catch {
    return fallback;
  }
};
// Browser and OS from userAgentData when present (Chromium), else a plain parse of the UA string.
export function describeBrowser(nav = {}, high = null) {
  const ua = String(nav.userAgent || '');
  let browser = null,
    os = null;
  const brands = safe(() => nav.userAgentData?.brands, null);
  if (Array.isArray(brands) && brands.length) {
    const named = brands.filter(b => !/not.?a.?brand|chromium/i.test(b.brand));
    const pick = named[0] || brands.find(b => /chromium/i.test(b.brand)) || brands[0];
    const full = high?.fullVersionList?.find(b => b.brand === pick.brand);
    browser = `${pick.brand} ${full?.version || pick.version}`;
    os = safe(() => nav.userAgentData.platform, null);
    if (os === 'Windows' && high?.platformVersion)
      os = parseInt(high.platformVersion, 10) >= 13 ? 'Windows 11' : 'Windows 10';
    else if (os && high?.platformVersion) os += ' ' + high.platformVersion;
    if (high?.model) os = (os ? os + ' · ' : '') + high.model;
  }
  if (!browser) {
    const m =
      ua.match(/(Edg|OPR|YaBrowser|Firefox|SamsungBrowser)\/([\d.]+)/) ||
      ua.match(/(Chrome)\/([\d.]+)/) ||
      ua.match(/Version\/([\d.]+).*(Safari)/);
    if (m)
      browser = m[2] && /Safari/.test(m[2]) ? `Safari ${m[1]}` : `${m[1].replace('Edg', 'Edge')} ${m[2]}`;
  }
  if (!os) {
    const m =
      ua.match(/Windows NT [\d.]+/) ||
      ua.match(/Android [\d.]+/) ||
      ua.match(/(iPhone|iPad); CPU [^;)]*OS [\d_]+/) ||
      ua.match(/Mac OS X [\d_]+/) ||
      ua.match(/Linux|CrOS/);
    os = m ? m[0].replace(/_/g, '.') : null;
  }
  return { browser, os, ua };
}
// Every field is optional: a missing API gives null, never an exception.
export function collectSpecs({
  navigator: nav = {},
  screen: scr = null,
  devicePixelRatio: dpr = 1,
  gl = null,
  canvas = null,
  high = null,
  settings = {},
  build = null,
  projects = null,
  refresh = null,
  firstFrameMs = null
} = {}) {
  const debug = gl ? safe(() => gl.getExtension('WEBGL_debug_renderer_info')) : null;
  const param = p => (gl && p !== undefined && p !== null ? safe(() => gl.getParameter(p)) : null);
  const webgl2 =
    gl && typeof WebGL2RenderingContext !== 'undefined'
      ? safe(() => gl instanceof WebGL2RenderingContext, false)
      : false;
  const { browser, os } = describeBrowser(nav, high);
  return {
    gpu: (debug ? param(debug.UNMASKED_RENDERER_WEBGL) : null) || param(gl?.RENDERER),
    vendor: (debug ? param(debug.UNMASKED_VENDOR_WEBGL) : null) || param(gl?.VENDOR),
    webgl: gl ? param(gl.VERSION) || (webgl2 ? 'WebGL 2.0' : 'WebGL') : null,
    maxTexture: param(gl?.MAX_TEXTURE_SIZE),
    gpuTimer: gl ? !!safe(() => gl.getExtension('EXT_disjoint_timer_query_webgl2')) : false,
    cores: Number.isFinite(nav.hardwareConcurrency) ? nav.hardwareConcurrency : null,
    memory: Number.isFinite(nav.deviceMemory) ? nav.deviceMemory : null,
    screen: scr && scr.width ? `${scr.width}×${scr.height}` : null,
    canvas: canvas ? `${canvas.width}×${canvas.height}` : null,
    dpr: Number.isFinite(dpr) ? dpr : null,
    browser,
    os,
    refresh,
    settings,
    build,
    projects,
    firstFrameMs
  };
}

// ---------- Recording ----------
export function createRecorder(capacity = BENCH.capacity) {
  const frame = new Float32Array(capacity),
    cpu = new Float32Array(capacity),
    calls = new Float32Array(capacity),
    tris = new Float32Array(capacity),
    warm = new Float32Array(1024);
  let count = 0,
    warmCount = 0;
  return {
    warm(ms) {
      if (warmCount < warm.length) warm[warmCount++] = ms;
    },
    record(frameMs, cpuMs, drawCalls, triangles) {
      if (count >= capacity) return;
      frame[count] = frameMs;
      cpu[count] = cpuMs;
      calls[count] = drawCalls;
      tris[count] = triangles;
      count++;
    },
    get count() {
      return count;
    },
    data() {
      return {
        frame: frame.subarray(0, count),
        cpu: cpu.subarray(0, count),
        calls: calls.subarray(0, count),
        tris: tris.subarray(0, count),
        warm: warm.subarray(0, warmCount)
      };
    }
  };
}
// GPU time per frame from EXT_disjoint_timer_query_webgl2 with a small reused pool of queries. It stands in for
// renderer.gardenFrameProbe while a run lasts (garden.mjs brackets the render with begin()/end()).
export function createGpuTimer(gl, capacity = BENCH.capacity) {
  let ext = gl ? safe(() => gl.getExtension('EXT_disjoint_timer_query_webgl2')) : null;
  const free = [],
    pending = [],
    samples = new Float32Array(capacity);
  let active = null,
    count = 0,
    disjoint = 0;
  if (ext) for (let i = 0; i < BENCH.gpuQueries; i++) free.push(gl.createQuery());
  function poll() {
    if (!ext) return;
    if (gl.getParameter(ext.GPU_DISJOINT_EXT)) {
      disjoint++;
      while (pending.length) free.push(pending.shift());
      return;
    }
    while (pending.length && gl.getQueryParameter(pending[0], gl.QUERY_RESULT_AVAILABLE)) {
      const q = pending.shift(),
        ns = gl.getQueryParameter(q, gl.QUERY_RESULT);
      free.push(q);
      if (timer.recording && count < capacity) samples[count++] = ns / 1e6;
    }
  }
  const timer = {
    recording: false,
    get supported() {
      return !!ext;
    },
    begin() {
      if (!ext || active || gl.isContextLost()) return;
      poll();
      const q = free.pop();
      if (!q) return;
      gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
      active = q;
    },
    end() {
      if (!active) return;
      gl.endQuery(ext.TIME_ELAPSED_EXT);
      pending.push(active);
      active = null;
    },
    poll,
    lost() {
      ext = null;
      active = null;
      pending.length = free.length = 0;
    },
    restored() {},
    samples: () => samples.subarray(0, count),
    snapshot: () => ({
      gpuSupported: !!ext,
      gpuMs: Array.from(samples.subarray(Math.max(0, count - 180), count)),
      gpuDisjointEvents: disjoint
    }),
    dispose() {
      if (gl && !gl.isContextLost()) {
        if (active && ext) gl.endQuery(ext.TIME_ELAPSED_EXT);
        for (const q of [...free, ...pending, active]) if (q) gl.deleteQuery(q);
      }
      active = null;
      free.length = pending.length = 0;
    }
  };
  return timer;
}

// ---------- History (this browser only) ----------
export function loadHistory(storage) {
  try {
    const list = JSON.parse(storage?.getItem(BENCH.historyKey) || '[]');
    return Array.isArray(list) ? list.filter(r => r && Number.isFinite(r.score)) : [];
  } catch {
    return [];
  }
}
export function saveHistory(storage, entry) {
  const list = [entry, ...loadHistory(storage)].slice(0, BENCH.historySize);
  try {
    storage?.setItem(BENCH.historyKey, JSON.stringify(list));
  } catch {}
  return list;
}

// ---------- Strings ----------
const STRINGS = {
  ru: {
    title: 'Тест производительности',
    heading: 'Производительность',
    intro:
      'Камера ~40 секунд летит по одному и тому же маршруту: облёт, мост, поездка между павильонами, центральный остров и станция шаров, вид у горизонта. Первые 4 с — разогрев. Интерфейс скрыт, управление заблокировано.',
    summer: 'Лето, закат',
    winter: 'Зима, ночь — тяжелее',
    start: 'Начать',
    stop: 'Остановить',
    warmup: 'Разогрев',
    orbit: 'Облёт',
    bridge: 'Мост',
    trip: 'Между павильонами',
    centre: 'Центр и станция шаров',
    horizon: 'У горизонта',
    score: 'баллов',
    formula: 'Баллы = 10 × (0,7 × средний FPS + 0,3 × 1% low) × √(пикселей в кадре / 1920×1080)',
    // Owner, 2026-10-31: with Economy (a 0.75 frame) a smoother run scored lower; the size of the frame counts too.
    formulaNote:
      'Меньший кадр (например, в «Экономии») даёт больше FPS, но меньше баллов: сравнивайте при одном размере кадра.',
    avgFps: 'Средний FPS',
    low1: '1% low',
    low01: '0,1% low',
    median: 'Кадр, медиана',
    p95: 'Кадр, p95',
    p99: 'Кадр, p99',
    cpu: 'CPU (JS) на кадр',
    gpu: 'GPU на кадр',
    // The device list says whether the GPU timer exists; it read «GPU на кадр» like the frame time above it.
    gpuTimer: 'Таймер GPU',
    na: 'недоступно',
    draws: 'Вызовы отрисовки',
    tris: 'Треугольники',
    heap: 'JS-память',
    load: 'До первого кадра',
    frames: 'Кадров',
    avg: 'сред.',
    max: 'макс.',
    specs: 'Устройство',
    gpuName: 'Видеокарта',
    vendor: 'Производитель',
    webgl: 'WebGL',
    maxTex: 'Макс. текстура',
    cores: 'Потоки CPU',
    memory: 'Память устройства',
    screen: 'Экран',
    canvas: 'Кадр (canvas)',
    browser: 'Браузер',
    os: 'Система',
    refresh: 'Частота экрана (оценка)',
    quality: 'Качество',
    build: 'Сборка',
    projects: 'Проектов',
    sceneName: 'Сцена',
    economy: 'экономия',
    full: 'полное',
    low: 'низкое',
    medium: 'среднее',
    high: 'высокое',
    ultra: 'ультра',
    reduced: 'меньше движения',
    bloom: 'свечение',
    copy: 'Скопировать результат',
    copied: 'Скопировано',
    repeat: 'Повторить',
    close: 'Закрыть',
    history: 'Прошлые запуски',
    stopped: 'Тест остановлен — результат не засчитан.',
    hidden: 'Вкладка была скрыта — тест прерван.',
    resized: 'Размер окна менялся во время теста — сравнивать осторожно.',
    privacy: 'Ничего не отправляется: результаты хранятся только в этом браузере.',
    vsync: 'FPS не бывает выше частоты экрана (vsync) — сравнивайте и время кадра CPU/GPU.',
    best: 'лучший',
    graph: 'Время кадра, мс',
    gb: 'ГБ',
    mb: 'МБ',
    s: 'с',
    ms: 'мс',
    hz: 'Гц'
  },
  en: {
    title: 'Benchmark',
    heading: 'Performance',
    intro:
      'For about 40 seconds the camera flies one fixed route: an orbit, a bridge, a trip between pavilions, the central island and the balloon station, a view near the horizon. The first 4 s warm up. The UI is hidden and input is locked.',
    summer: 'Summer sunset',
    winter: 'Winter night — heavier',
    start: 'Start',
    stop: 'Stop',
    warmup: 'Warm-up',
    orbit: 'Orbit',
    bridge: 'Bridge',
    trip: 'Between pavilions',
    centre: 'Centre and balloon station',
    horizon: 'Near the horizon',
    score: 'points',
    formula: 'Score = 10 × (0.7 × average FPS + 0.3 × 1% low) × √(frame pixels / 1920×1080)',
    formulaNote:
      'A smaller frame (Economy, say) gives more FPS but a lower score: compare runs at the same frame size.',
    avgFps: 'Average FPS',
    low1: '1% low',
    low01: '0.1% low',
    median: 'Frame, median',
    p95: 'Frame, p95',
    p99: 'Frame, p99',
    cpu: 'CPU (JS) per frame',
    gpu: 'GPU per frame',
    gpuTimer: 'GPU timer',
    na: 'unavailable',
    draws: 'Draw calls',
    tris: 'Triangles',
    heap: 'JS heap',
    load: 'To first frame',
    frames: 'Frames',
    avg: 'avg',
    max: 'max',
    specs: 'Device',
    gpuName: 'GPU',
    vendor: 'Vendor',
    webgl: 'WebGL',
    maxTex: 'Max texture',
    cores: 'CPU threads',
    memory: 'Device memory',
    screen: 'Screen',
    canvas: 'Frame (canvas)',
    browser: 'Browser',
    os: 'OS',
    refresh: 'Refresh rate (estimate)',
    quality: 'Quality',
    build: 'Build',
    projects: 'Projects',
    sceneName: 'Scene',
    economy: 'economy',
    full: 'full',
    low: 'low',
    medium: 'medium',
    high: 'high',
    ultra: 'ultra',
    reduced: 'reduced motion',
    bloom: 'glow',
    copy: 'Copy result',
    copied: 'Copied',
    repeat: 'Run again',
    close: 'Close',
    history: 'Previous runs',
    stopped: 'Benchmark stopped — no result recorded.',
    hidden: 'The tab was hidden — benchmark aborted.',
    resized: 'The window was resized during the run — compare with care.',
    privacy: 'Nothing is sent anywhere: results stay in this browser only.',
    vsync: 'FPS cannot exceed the display refresh rate (vsync) — compare CPU/GPU frame times too.',
    best: 'best',
    graph: 'Frame time, ms',
    gb: 'GB',
    mb: 'MB',
    s: 's',
    ms: 'ms',
    hz: 'Hz'
  }
};
export function benchStrings(locale = 'ru', labels = {}) {
  const base = STRINGS[locale === 'ru' ? 'ru' : 'en'];
  const out = { ...base };
  // Server labels (benchTitle, ...) win when present.
  for (const k of Object.keys(base)) {
    const label = labels?.['bench' + k[0].toUpperCase() + k.slice(1)];
    if (typeof label === 'string' && label) out[k] = label;
  }
  return out;
}

// ---------- Plain-text summary (for messengers) ----------
const fmt = (locale, x, digits = 1) =>
  Number.isFinite(x)
    ? x.toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US', {
        maximumFractionDigits: digits,
        minimumFractionDigits: 0
      })
    : '—';
function settingsText(s, S) {
  const set = s.settings || {};
  return [
    (set.graphics && S[set.graphics]) || (set.economy ? S.economy : S.full),
    `${S.bloom} ${set.bloom ? '✓' : '✗'}`,
    set.reduced ? S.reduced : null,
    Number.isFinite(set.pixelRatio) ? `×${set.pixelRatio.toFixed(2)}` : null
  ]
    .filter(Boolean)
    .join(', ');
}
export function formatSummary(result, S, locale = 'ru') {
  const r = result.stats,
    s = result.specs,
    f = (x, d) => fmt(locale, x, d),
    lines = [
      `${S.title} — ${S[result.scene] || result.scene}`,
      `${f(r.score, 0)} ${S.score}`,
      `${S.avgFps}: ${f(r.avgFps)} · ${S.low1}: ${f(r.low1Fps)} · ${S.low01}: ${f(r.low01Fps)}`,
      `${S.median}/p95/p99: ${f(r.frameMs.median, 2)} / ${f(r.frameMs.p95, 2)} / ${f(r.frameMs.p99, 2)} ${S.ms}`,
      `${S.cpu}: ${f(r.cpuMs.avg, 2)} ${S.ms} (p95 ${f(r.cpuMs.p95, 2)})`,
      `${S.gpu}: ${r.gpuMs ? `${f(r.gpuMs.avg, 2)} ${S.ms} (p95 ${f(r.gpuMs.p95, 2)})` : S.na}`,
      `${S.draws}: ${f(r.calls.avg, 0)} ${S.avg} / ${f(r.calls.max, 0)} ${S.max} · ${S.tris}: ${f(r.triangles.avg / 1000, 0)}K / ${f(r.triangles.max / 1000, 0)}K`,
      result.heapMb ? `${S.heap}: ${f(result.heapMb, 0)} ${S.mb}` : null,
      s.firstFrameMs ? `${S.load}: ${f(s.firstFrameMs / 1000, 2)} ${S.s}` : null,
      `${S.gpuName}: ${s.gpu || '—'}`,
      `${S.cores}: ${s.cores ?? '—'} · ${S.memory}: ${s.memory ? s.memory + ' ' + S.gb : '—'}`,
      `${S.screen}: ${s.screen || '—'} · ${S.canvas}: ${s.canvas || '—'} · DPR ${s.dpr ?? '—'} · ${S.refresh}: ${s.refresh ? s.refresh + ' ' + S.hz : '—'}`,
      `${S.browser}: ${s.browser || '—'} · ${S.os}: ${s.os || '—'}`,
      `${S.quality}: ${settingsText(s, S)} · ${s.webgl || '—'}`,
      `${S.build}: ${s.build || '—'} · ${S.projects}: ${s.projects ?? '—'} · ${new Date(result.at).toISOString().slice(0, 16).replace('T', ' ')}`,
      result.resized ? S.resized : null
    ];
  return lines.filter(Boolean).join('\n');
}

// ---------- UI and run ----------
const STYLE = `
  #garden-app.is-benchmark>:not(#garden-scene),body.bench-running>:not(#garden-app,#bench-shield,#bench-card,script,style) {
    visibility:hidden!important
  }
  #bench-shield {
    position:fixed;
    inset:0;
    z-index:90;
    touch-action:none;
    cursor:wait;
    background:transparent
  }
  #bench-shield .bench-pill {
    position:absolute;
    top:max(12px,env(safe-area-inset-top));
    left:50%;
    translate:-50% 0;
    display:flex;
    align-items:center;
    gap:12px;
    padding:6px 6px 6px 16px;
    border-radius:999px;
    cursor:default;
    max-width:calc(100vw - 32px);
    box-sizing:border-box;
    background:linear-gradient(180deg,var(--glass-solid-top,rgba(56,45,82,.93)),var(--glass-solid-bottom,rgba(27,21,43,.95)));
    border:1px solid var(--glass-edge,rgba(238,228,255,.19));
    box-shadow:var(--glass-highlight,inset 0 1px 0 rgba(255,255,255,.16)),0 10px 28px rgba(10,5,30,.3);
    color:#f6f0ff;
    font:500 13px/1.3 system-ui,sans-serif
  }
  #bench-shield .bench-status {
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
    font-variant-numeric:tabular-nums
  }
  #bench-shield .bench-bar {
    position:absolute;
    left:18px;
    right:18px;
    bottom:-1px;
    height:2px;
    border-radius:2px;
    background:rgba(255,255,255,.12);
    overflow:hidden
  }
  #bench-shield .bench-bar i {
    display:block;
    height:100%;
    transform:scaleX(0);
    transform-origin:left;
    will-change:transform;
    background:linear-gradient(90deg,#b79bff,#7ad0ff)
  }
  .bench-button {
    min-height:38px;
    padding:0 16px;
    border-radius:999px;
    border:1px solid rgba(238,228,255,.28);
    cursor:pointer;
    background:linear-gradient(180deg,rgba(86,70,124,.5),rgba(38,30,62,.62));
    color:#f6f0ff;
    font:600 13px/1 system-ui,sans-serif;
    white-space:nowrap
  }
  .bench-button:hover {
    border-color:rgba(228,212,255,.6)
  }
  .bench-button:focus-visible {
    outline:2px solid #f4ecff;
    outline-offset:2px
  }
  .bench-button.is-primary {
    background:linear-gradient(135deg,#fefcff,#ede3ff 50%,#cfbaff);
    color:#22163a;
    border-color:rgba(255,255,255,.78)
  }
  #bench-card {
    position:fixed;
    z-index:91;
    top:50%;
    left:50%;
    translate:-50% -50%;
    width:min(780px,calc(100vw - 32px));
    max-height:calc(100vh - 32px);
    max-height:calc(100dvh - 32px);
    overflow:auto;
    box-sizing:border-box;
    padding:20px 22px 18px;
    border-radius:26px;
    color:#f6f0ff;
    font:14px/1.45 system-ui,sans-serif;
    overscroll-behavior:contain;
    background:linear-gradient(180deg,var(--glass-solid-top,rgba(56,45,82,.93)),var(--glass-solid-bottom,rgba(27,21,43,.95)));
    border:1px solid var(--glass-edge,rgba(238,228,255,.19));
    box-shadow:inset 0 1px 0 rgba(255,255,255,.16),0 24px 60px rgba(10,5,30,.5)
  }
  #bench-card h2 {
    margin:0;
    font-size:18px;
    font-weight:650;
    flex:1
  }
  #bench-card .bench-head {
    display:flex;
    align-items:center;
    gap:12px;
    margin:-20px -22px 10px;
    padding:16px 22px 8px;
    position:sticky;
    top:-20px;
    z-index:1;
    background:var(--glass-solid-top,rgba(56,45,82,.97))
  }
  #bench-card .bench-x {
    width:38px;
    height:38px;
    padding:0;
    border-radius:50%;
    font-size:20px
  }
  #bench-card p {
    margin:6px 0;
    color:#d9cff0
  }
  #bench-card .bench-note {
    font-size:12px;
    color:#bfb3da
  }
  #bench-card .bench-alert {
    color:#ffd59a
  }
  #bench-card .bench-scenes {
    display:flex;
    gap:6px;
    padding:4px;
    margin:12px 0;
    border-radius:999px;
    background:rgba(12,8,24,.45);
    border:1px solid rgba(238,228,255,.12)
  }
  #bench-card .bench-scenes button {
    flex:1;
    min-height:38px;
    border:0;
    border-radius:999px;
    background:transparent;
    color:#e6dcff;
    font:600 13px/1.2 system-ui,sans-serif;
    cursor:pointer
  }
  #bench-card .bench-scenes button[aria-pressed=true] {
    background:linear-gradient(180deg,rgba(150,120,230,.55),rgba(90,66,170,.6));
    color:#fff;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.25)
  }
  #bench-card .bench-score {
    display:flex;
    align-items:baseline;
    gap:10px;
    margin:2px 0 4px
  }
  #bench-card .bench-score b {
    font-size:54px;
    line-height:1;
    font-weight:700;
    letter-spacing:-.02em;
    background:linear-gradient(135deg,#fff,#cdb8ff);
    -webkit-background-clip:text;
    background-clip:text;
    color:transparent
  }
  #bench-card .bench-score span {
    color:#cfc2ec
  }
  #bench-card .bench-grid {
    display:grid;
    grid-template-columns:repeat(4,1fr);
    gap:6px;
    margin:10px 0
  }
  #bench-card .bench-grid div {
    padding:7px 10px;
    border-radius:14px;
    background:rgba(255,255,255,.05);
    border:1px solid rgba(238,228,255,.1);
    min-width:0
  }
  #bench-card .bench-grid small {
    display:block;
    font-size:11px;
    color:#bfb3da;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis
  }
  #bench-card .bench-grid strong {
    font-size:15px;
    font-weight:650;
    font-variant-numeric:tabular-nums
  }
  #bench-card canvas {
    display:block;
    width:100%;
    height:96px;
    border-radius:14px;
    background:rgba(12,8,24,.45);
    border:1px solid rgba(238,228,255,.1)
  }
  #bench-card details {
    margin-top:10px
  }
  #bench-card summary {
    cursor:pointer;
    font-weight:600
  }
  #bench-card dl {
    display:grid;
    grid-template-columns:auto 1fr auto 1fr;
    gap:3px 12px;
    margin:8px 0 0;
    font-size:12.5px
  }
  #bench-card dt {
    color:#bfb3da
  }
  #bench-card dd {
    margin:0;
    word-break:break-word
  }
  #bench-card .bench-actions {
    display:flex;
    flex-wrap:wrap;
    gap:8px;
    margin-top:14px
  }
  #bench-card ol {
    margin:6px 0 0;
    padding-left:20px;
    font-size:12.5px;
    color:#d9cff0;
    font-variant-numeric:tabular-nums
  }
  #bench-card ol .is-best {
    color:#fff;
    font-weight:600
  }
  @media (max-width:740px) {
    #bench-card {
      top:auto;
      bottom:max(8px,env(safe-area-inset-bottom));
      translate:-50% 0;
      width:calc(100vw - 16px);
      padding:16px 16px 14px;
      border-radius:24px;
      max-height:calc(100vh - 24px);
      max-height:calc(100dvh - 16px - max(8px,env(safe-area-inset-top)) - max(8px,env(safe-area-inset-bottom)))
    }
    #bench-card .bench-head {
      margin:-16px -16px 10px;
      padding:14px 16px 8px;
      top:-16px
    }
    #bench-card .bench-grid {
      grid-template-columns:repeat(2,1fr)
    }
    #bench-card dl {
      grid-template-columns:auto 1fr
    }
    #bench-card .bench-score b {
      font-size:44px
    }
  }
`;

const esc = s =>
  String(s ?? '—').replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

// host (garden.mjs): { document, window, labels, locale, canvas, gl(), garden(), enter(scene, runner, probe),
// leave(), info(), settings(), projects(), build, firstFrameMs() }.
export function mountBench(host) {
  const doc = host.document,
    win = host.window,
    S = benchStrings(host.locale, host.labels),
    L = host.locale,
    storage = safe(() => win.localStorage);
  let card = null,
    shield = null,
    run = null,
    scene = 'summer',
    last = null,
    returnFocus = null;
  if (!doc.getElementById('bench-style')) {
    const style = doc.createElement('style');
    style.id = 'bench-style';
    style.textContent = STYLE;
    doc.head.append(style);
  }
  function closeCard() {
    card?.remove();
    card = null;
    returnFocus?.focus?.();
    returnFocus = null;
  }
  function onCardKey(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeCard();
    }
  }
  function showCard(message = '') {
    card?.remove();
    card = doc.createElement('aside');
    card.id = 'bench-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-labelledby', 'bench-title');
    const history = loadHistory(storage),
      best = history.reduce((m, h) => Math.max(m, h.score), 0),
      r = last?.stats,
      s = last?.specs,
      f = (x, d = 1) => fmt(L, x, d),
      cell = (label, value) => `<div><small>${esc(label)}</small><strong>${esc(value)}</strong></div>`,
      row = (label, value) =>
        value === null || value === undefined || value === ''
          ? ''
          : `<dt>${esc(label)}</dt><dd>${esc(value)}</dd>`;
    let body;
    if (r) {
      body =
        `<div class="bench-score"><b>${esc(f(r.score, 0))}</b><span>${esc(S.score)} · ${esc(S[last.scene])}</span></div>` +
        `<p class="bench-note">${esc(S.formula)} ${esc(S.formulaNote)}</p>` +
        `<div class="bench-grid">` +
        cell(S.avgFps, f(r.avgFps)) +
        cell(S.low1, f(r.low1Fps)) +
        cell(S.low01, f(r.low01Fps)) +
        cell(S.median, `${f(r.frameMs.median, 2)} ${S.ms}`) +
        cell(S.p95, `${f(r.frameMs.p95, 2)} ${S.ms}`) +
        cell(S.p99, `${f(r.frameMs.p99, 2)} ${S.ms}`) +
        cell(S.cpu, `${f(r.cpuMs.avg, 2)} ${S.ms}`) +
        cell(S.gpu, r.gpuMs ? `${f(r.gpuMs.avg, 2)} ${S.ms}` : S.na) +
        cell(S.draws, `${f(r.calls.avg, 0)} / ${f(r.calls.max, 0)}`) +
        cell(S.tris, `${f(r.triangles.avg / 1000, 0)}K / ${f(r.triangles.max / 1000, 0)}K`) +
        cell(S.heap, last.heapMb ? `${f(last.heapMb, 0)} ${S.mb}` : S.na) +
        cell(S.load, s.firstFrameMs ? `${f(s.firstFrameMs / 1000, 2)} ${S.s}` : S.na) +
        `</div><canvas aria-label="${esc(S.graph)}" role="img"></canvas>` +
        `<p class="bench-note">${esc(S.graph)} · ${esc(S.frames)}: ${esc(f(r.frames, 0))} · ${esc(S.vsync)}</p>` +
        (last.resized ? `<p class="bench-alert">${esc(S.resized)}</p>` : '') +
        `<details open><summary>${esc(S.specs)}</summary><dl>` +
        row(S.gpuName, s.gpu) +
        row(S.vendor, s.vendor) +
        row(S.webgl, s.webgl) +
        row(S.maxTex, s.maxTexture) +
        row(S.cores, s.cores) +
        row(S.memory, s.memory ? `${s.memory} ${S.gb}` : S.na) +
        row(S.screen, s.screen) +
        row(S.canvas, s.canvas) +
        row('devicePixelRatio', s.dpr) +
        row(S.refresh, s.refresh ? `${s.refresh} ${S.hz}` : S.na) +
        row(S.browser, s.browser) +
        row(S.os, s.os) +
        row(S.quality, settingsText(s, S)) +
        row(S.gpuTimer, s.gpuTimer ? 'EXT_disjoint_timer_query_webgl2' : S.na) +
        row(S.build, s.build) +
        row(S.projects, s.projects) +
        `</dl></details>`;
    } else body = `<p>${esc(S.intro)}</p>`;
    const scenes = `<div class="bench-scenes" role="group" aria-label="${esc(S.sceneName)}">${[
      'summer',
      'winter'
    ]
      .map(k => `<button type="button" data-scene="${k}" aria-pressed="${k === scene}">${esc(S[k])}</button>`)
      .join('')}</div>`;
    const list = history.length
      ? `<details${r ? '' : ' open'}><summary>${esc(S.history)}</summary><ol>${history
          .slice(0, 6)
          .map(
            h =>
              `<li class="${h.score === best ? 'is-best' : ''}">${esc(new Date(h.at).toLocaleString(L === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))} · ${esc(S[h.scene] || h.scene)} · ${esc(f(h.score, 0))} ${esc(S.score)} · ${esc(f(h.avgFps))} FPS · ${esc(h.canvas || '')}${h.score === best && history.length > 1 ? ' · ' + esc(S.best) : ''}</li>`
          )
          .join('')}</ol></details>`
      : '';
    card.innerHTML =
      `<div class="bench-head"><h2 id="bench-title">${esc(S.title)}</h2><button type="button" class="bench-button bench-x" data-act="close" aria-label="${esc(S.close)}">×</button></div>` +
      (message ? `<p class="bench-alert">${esc(message)}</p>` : '') +
      body +
      scenes +
      `<div class="bench-actions">` +
      (r ? `<button type="button" class="bench-button" data-act="copy">${esc(S.copy)}</button>` : '') +
      `<button type="button" class="bench-button is-primary" data-act="start">${esc(r ? S.repeat : S.start)}</button>` +
      // Owner, 2026-10-31: on a phone the card stood taller than the visible screen and its × was out of reach;
      // a close button next to the others is always at hand.
      `<button type="button" class="bench-button" data-act="close">${esc(S.close)}</button></div>` +
      list +
      `<p class="bench-note">${esc(S.privacy)}</p>`;
    card.addEventListener('keydown', onCardKey);
    card.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.dataset.scene) {
        scene = button.dataset.scene;
        card
          .querySelectorAll('[data-scene]')
          .forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      } else if (button.dataset.act === 'close') closeCard();
      else if (button.dataset.act === 'start') start(scene);
      else if (button.dataset.act === 'copy') copy(button);
    });
    doc.body.append(card);
    if (r) drawGraph(card.querySelector('canvas'), last.graph);
    card.querySelector('[data-act=start]')?.focus({ preventScroll: true });
  }
  async function copy(button) {
    const text = formatSummary(last, S, L);
    let ok;
    try {
      await win.navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      const area = doc.createElement('textarea');
      area.value = text;
      area.style.cssText = 'position:fixed;opacity:0';
      doc.body.append(area);
      area.select();
      ok = safe(() => doc.execCommand('copy'), false);
      area.remove();
    }
    if (ok) {
      button.textContent = S.copied;
      win.setTimeout(() => (button.textContent = S.copy), 1600);
    }
  }
  function drawGraph(canvas, graph) {
    if (!canvas || !graph?.length) return;
    const ratio = win.devicePixelRatio || 1,
      w = Math.max(1, Math.round(canvas.clientWidth * ratio)),
      h = Math.max(1, Math.round(canvas.clientHeight * ratio)),
      ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = w;
    canvas.height = h;
    const top = Math.min(100, Math.max(40, Math.max(...graph) * 1.15)),
      y = ms => h - (Math.min(ms, top) / top) * (h - 6 * ratio) - 2 * ratio;
    ctx.font = `${10 * ratio}px system-ui,sans-serif`;
    for (const [ms, label] of [
      [1000 / 60, '60 FPS'],
      [1000 / 30, '30 FPS']
    ]) {
      if (ms > top) continue;
      ctx.strokeStyle = 'rgba(238,228,255,.22)';
      ctx.setLineDash([4 * ratio, 4 * ratio]);
      ctx.beginPath();
      ctx.moveTo(0, y(ms));
      ctx.lineTo(w, y(ms));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(238,228,255,.6)';
      ctx.fillText(label, 6 * ratio, y(ms) - 3 * ratio);
    }
    ctx.strokeStyle = '#b79bff';
    ctx.lineWidth = 1.5 * ratio;
    ctx.beginPath();
    graph.forEach((ms, i) => {
      const x = (i / Math.max(1, graph.length - 1)) * w;
      if (i) ctx.lineTo(x, y(ms));
      else ctx.moveTo(x, y(ms));
    });
    ctx.stroke();
  }
  // Up to `buckets` points: the slowest frame of each slice, so a hitch is never averaged away.
  function graphOf(frame, buckets = 240) {
    const n = frame.length,
      out = [];
    if (!n) return out;
    const step = Math.max(1, n / buckets);
    for (let b = 0; b * step < n; b++) {
      let m = 0;
      for (let i = Math.floor(b * step); i < Math.min(n, Math.floor((b + 1) * step)); i++)
        if (frame[i] > m) m = frame[i];
      out.push(Math.round(m * 100) / 100);
    }
    return out;
  }
  function onKey(event) {
    if (!run) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      abort(S.stopped);
      return;
    }
    // Only Tab/Enter/Space on the Stop button get through; everything else is locked.
    if (event.target?.closest?.('#bench-shield button') && ['Tab', 'Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }
  const block = event => {
    if (event.target?.closest?.('#bench-shield button')) return;
    event.preventDefault();
    event.stopPropagation();
  };
  function onVisibility() {
    if (run && doc.hidden) abort(S.hidden);
  }
  function mountShield() {
    shield = doc.createElement('div');
    shield.id = 'bench-shield';
    shield.innerHTML = `<div class="bench-pill" role="status" aria-live="off"><span class="bench-status"></span><button type="button" class="bench-button">${esc(S.stop)} · Esc</button><span class="bench-bar"><i></i></span></div>`;
    for (const type of [
      'pointerdown',
      'pointermove',
      'pointerup',
      'wheel',
      'touchstart',
      'touchmove',
      'contextmenu',
      'dblclick'
    ])
      shield.addEventListener(type, block, { passive: false });
    shield.querySelector('button').addEventListener('click', () => abort(S.stopped));
    doc.body.append(shield);
    shield.querySelector('button').focus();
  }
  async function start(name = 'summer') {
    if (run) return;
    scene = BENCH_SCENES[name] ? name : 'summer';
    returnFocus ??= doc.activeElement;
    card?.remove();
    card = null;
    const high = await safe(
      () =>
        win.navigator.userAgentData?.getHighEntropyValues?.(['platformVersion', 'model', 'fullVersionList']),
      null
    )?.catch?.(() => null);
    const route = buildBenchRoute(host.garden()),
      recorder = createRecorder(),
      gpu = createGpuTimer(host.gl()),
      canvas = host.canvas,
      size = `${canvas.width}×${canvas.height}`;
    let t0 = 0,
      prev = 0,
      shown = 0,
      line = '',
      heapMax = 0,
      heapAt = 0,
      finished = false;
    const status = () => shield?.querySelector('.bench-status'),
      bar = () => shield?.querySelector('.bench-bar i');
    run = {
      scene,
      high,
      size,
      recorder,
      gpu,
      // Called by garden.mjs at the start of every frame of the run.
      pose(now, position, look) {
        if (!t0) t0 = now;
        const t = (now - t0) / 1000;
        benchPose(route, t, position, look);
        if (now - shown >= BENCH.overlayMs) {
          shown = now;
          // The pill is part of what the phone draws: a new line of text is new layout and paint over the live
          // canvas, and the old blurred pill gave the Realme 108 long frames a run against 19 (2026-11-01). So
          // nothing is blurred here and the pill changes once a second, when its text does.
          const text = `${S.title} · ${t < BENCH.warmup ? S.warmup : S[benchPhase(t)]} · ${Math.min(BENCH.duration, t).toFixed(0)} / ${BENCH.duration} ${S.s}`;
          if (text !== line) {
            line = text;
            const el = status(),
              b = bar();
            if (el) el.textContent = text;
            if (b) b.style.transform = `scaleX(${Math.min(1, t / BENCH.duration).toFixed(3)})`;
          }
        }
      },
      // Called after the frame is rendered, with its CPU time and renderer counters.
      sample(now, cpuMs, info) {
        if (finished || !t0) return;
        const t = (now - t0) / 1000;
        if (prev) {
          const ms = now - prev;
          if (t >= BENCH.warmup) recorder.record(ms, cpuMs, info?.calls || 0, info?.triangles || 0);
          else recorder.warm(ms);
        }
        prev = now;
        gpu.recording = t >= BENCH.warmup;
        if (now - heapAt > 1000) {
          heapAt = now;
          const used = safe(() => win.performance.memory.usedJSHeapSize, 0);
          if (used > heapMax) heapMax = used;
        }
        if (t >= BENCH.duration) {
          finished = true;
          win.setTimeout(finish, 0);
        }
      }
    };
    win.addEventListener('keydown', onKey, true);
    doc.addEventListener('visibilitychange', onVisibility);
    doc.body.classList.add('bench-running');
    mountShield();
    host.enter(BENCH_SCENES[scene], run, gpu);
    function finish() {
      if (!run) return;
      gpu.poll();
      const data = recorder.data(),
        gpuSamples = Float32Array.from(gpu.samples()),
        refresh = estimateRefresh(data.warm),
        pixels = canvas.width * canvas.height,
        stats = summarizeRun({ ...data, gpu: gpuSamples, pixels, refresh }),
        specs = collectSpecs({
          navigator: win.navigator,
          screen: win.screen,
          devicePixelRatio: win.devicePixelRatio,
          gl: host.gl(),
          canvas,
          high: run.high,
          settings: host.settings(),
          build: host.build,
          projects: host.projects(),
          refresh,
          firstFrameMs: host.firstFrameMs()
        });
      const resized = `${canvas.width}×${canvas.height}` !== run.size;
      last = {
        at: Date.now(),
        scene: run.scene,
        stats,
        specs,
        heapMb: heapMax ? heapMax / 1048576 : null,
        resized,
        graph: graphOf(data.frame)
      };
      teardown();
      saveHistory(storage, {
        at: last.at,
        scene: last.scene,
        score: stats.score,
        avgFps: Math.round(stats.avgFps * 10) / 10,
        low1Fps: Math.round(stats.low1Fps * 10) / 10,
        canvas: specs.canvas,
        gpu: specs.gpu
      });
      showCard();
      win.__gardenBench = last;
    }
  }
  function teardown() {
    const current = run;
    run = null;
    win.removeEventListener('keydown', onKey, true);
    doc.removeEventListener('visibilitychange', onVisibility);
    shield?.remove();
    shield = null;
    doc.body.classList.remove('bench-running');
    host.leave();
    current?.gpu.dispose();
  }
  function abort(message) {
    if (!run) return;
    teardown();
    showCard(message);
  }
  return {
    open(trigger = null) {
      returnFocus = trigger;
      showCard();
    },
    start,
    get running() {
      return !!run;
    },
    get result() {
      return last;
    }
  };
}
