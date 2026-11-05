// Calm generated background music (owner: «приятную музыку… спокойная, умиротворённая», with an off switch).
// Everything is synthesised with the Web Audio API, so nothing is downloaded: a slow pad of detuned,
// low-passed oscillators, sparse pentatonic bells, and a generated convolution reverb.
// Browsers block autoplay, so the context is created on the first user gesture; it is suspended, and
// nothing is scheduled, while the sound is off or the tab is hidden. The same context carries the nature
// sounds (nature-sounds.mjs): the dock button switches both, Settings switch each one.

import { createFireworkVoices } from './firework-sounds.mjs';
import { createPortalVoices } from './portal-sounds.mjs';
import { PIECES, createPiecePlan, catchUpPiece, planPieceUntil, createPieceVoices } from './music-pieces.mjs';
import { createPlaylist } from './music-playlist.mjs';

import {
  NATURE,
  loopedNoise,
  nearestFallDistance,
  waterProximity,
  natureMood,
  createNaturePlan,
  catchUpNature,
  planNature,
  createNatureVoices
} from './nature-sounds.mjs';

export const MUSIC = {
  storageKey: 'garden-music',
  // Master gain for a mix that peaks near full scale: quiet background, never loud.
  masterDb: -24,
  fadeIn: 3,
  fadeOut: 1,
  // A hidden tab is leaving: fade quickly, then suspend.
  hiddenFade: 0.3,
  // Notes are queued this far ahead on the audio clock and the timer only tops the queue up,
  // so a busy main thread (a heavy frame, a slow phone) never reaches the sound.
  lookahead: 5,
  tickMs: 1000,
  // Half the usual rate halves the DSP work; nothing here sounds above ~6 kHz.
  sampleRate: 24000,
  pad: {
    minSeconds: 8,
    maxSeconds: 12,
    attack: 3.5,
    release: 4.5,
    level: 0.075,
    detuneCents: 7,
    cutoff: [650, 1100],
    q: 0.5,
    spread: 0.55
  },
  bell: {
    minGap: 2.5,
    maxGap: 7,
    firstDelay: 2.5,
    minDecay: 2.2,
    maxDecay: 3.8,
    level: 0.28,
    attack: 0.006,
    overtone: 3,
    overtoneLevel: 0.25,
    overtoneDecay: 0.4,
    spread: 0.35
  },
  reverb: { seconds: 2.8, decay: 2.6, wet: 0.55, dry: 0.75 }
};

// Open voicings (MIDI) of Cmaj7, Am9, Fmaj7 and G6sus4; every bell note is consonant over each of them.
export const PROGRESSION = [
  [48, 55, 59, 64],
  [45, 55, 60, 71],
  [41, 52, 57, 60],
  [43, 50, 60, 64]
];
// Keep the original as the first phrase. All variations share the same C-major tonal field,
// so the existing pentatonic bells and the previous pad's release remain compatible.
export const MUSIC_VARIATIONS = [
  { id: 'original', chords: PROGRESSION },
  {
    id: 'open-sky',
    chords: [
      [48, 55, 62, 64],
      [43, 55, 60, 64],
      [45, 52, 60, 67],
      [41, 53, 60, 67]
    ]
  },
  {
    id: 'quiet-water',
    chords: [
      [48, 52, 57, 67],
      [41, 48, 57, 64],
      [45, 55, 60, 64],
      [43, 50, 60, 69]
    ]
  }
];
// C major pentatonic over two octaves.
export const BELL_SCALE = [72, 74, 76, 79, 81, 84, 86, 88];
const BELL_STEPS = [-2, -1, -1, 1, 1, 2];

export { loopedNoise };

export const midiToHz = midi => 440 * 2 ** ((midi - 69) / 12);
export const dbToGain = db => 10 ** (db / 20);
const between = (random, min, max) => min + (max - min) * random();
const quietly = promise => promise?.catch?.(() => {});

export function createPlan(random = Math.random) {
  return {
    random,
    chordAt: 0,
    chordIndex: -1,
    variationIndex: 0,
    bellAt: MUSIC.bell.firstDelay,
    bellStep: 2
  };
}

// Moves the cursors to `time` or later, so a stalled timer never releases a backlog of notes at once.
export function catchUp(plan, time) {
  if (plan.chordAt < time) plan.chordAt = time;
  if (plan.bellAt < time) plan.bellAt = time + MUSIC.bell.firstDelay;
}

// Events that start before `horizon`, in time order; the plan's cursors move past them.
export function planUntil(plan, horizon) {
  const { pad, bell } = MUSIC,
    { random } = plan,
    events = [];
  while (plan.chordAt < horizon) {
    const previous = MUSIC_VARIATIONS[plan.variationIndex];
    plan.chordIndex++;
    if (plan.chordIndex === previous.chords.length) {
      // Pick any variation except the one just heard, only after its complete phrase.
      const offset = 1 + Math.floor(random() * (MUSIC_VARIATIONS.length - 1));
      plan.variationIndex = (plan.variationIndex + offset) % MUSIC_VARIATIONS.length;
      plan.chordIndex = 0;
    }
    const variation = MUSIC_VARIATIONS[plan.variationIndex];
    const length = between(random, pad.minSeconds, pad.maxSeconds);
    events.push({
      type: 'chord',
      at: plan.chordAt,
      length,
      notes: variation.chords[plan.chordIndex],
      variation: variation.id,
      cutoff: between(random, pad.cutoff[0], pad.cutoff[1])
    });
    plan.chordAt += length;
  }
  while (plan.bellAt < horizon) {
    // A small random walk over the scale reads as a slow, wandering tune rather than random pings.
    const step = BELL_STEPS[Math.floor(random() * BELL_STEPS.length)];
    plan.bellStep = Math.min(BELL_SCALE.length - 1, Math.max(0, plan.bellStep + step));
    events.push({
      type: 'bell',
      at: plan.bellAt,
      midi: BELL_SCALE[plan.bellStep],
      decay: between(random, bell.minDecay, bell.maxDecay),
      level: bell.level * between(random, 0.6, 1),
      side: random() < 0.5 ? 0 : 1
    });
    plan.bellAt += between(random, bell.minGap, bell.maxGap);
  }
  return events.sort((a, b) => a.at - b.at);
}

// Level of a linear master ramp at `time`. Tracked here because AudioParam.value does not report
// automation in every browser, and a fade must start from the level that is really playing.
export function rampLevel(ramp, time) {
  if (time >= ramp.end) return ramp.to;
  if (time <= ramp.start) return ramp.from;
  return ramp.from + ((ramp.to - ramp.from) * (time - ramp.start)) / (ramp.end - ramp.start);
}

// Stereo decaying noise; higher frequencies die first (the noise is smoothed more along the tail).
export function impulseResponse(ctx, seconds, decay, random = Math.random) {
  const length = Math.max(1, Math.round(seconds * ctx.sampleRate)),
    buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    let smooth = 0;
    for (let i = 0; i < length; i++) {
      const t = i / length;
      smooth += (random() * 2 - 1 - smooth) * (0.7 - 0.6 * t);
      data[i] = smooth * (1 - t) ** decay;
    }
  }
  return buffer;
}

function sidePanner(ctx, pan, targets) {
  // StereoPanner is missing only in very old Safari; there the side is simply centred.
  const node = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
  if ('pan' in node) node.pan.value = pan;
  for (const target of targets) node.connect(target);
  return node;
}

// The audio graph: a few long-lived nodes, plus short-lived oscillators per chord and per bell.
// Every gain starts at zero and ramps, so nothing clicks.
// `output` is the shared sound master in the page; alone (tests, tools) the music plays straight out.
export function createVoices(ctx, random = Math.random, output = ctx.destination) {
  const { pad, bell, reverb } = MUSIC;
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(output);
  const dry = ctx.createGain();
  dry.gain.value = reverb.dry;
  dry.connect(master);
  const wet = ctx.createGain();
  wet.gain.value = reverb.wet;
  const convolver = ctx.createConvolver();
  convolver.buffer = impulseResponse(ctx, reverb.seconds, reverb.decay, random);
  wet.connect(convolver);
  convolver.connect(master);
  const padFilter = ctx.createBiquadFilter();
  padFilter.type = 'lowpass';
  padFilter.frequency.value = pad.cutoff[0];
  padFilter.Q.value = pad.q;
  padFilter.connect(dry);
  padFilter.connect(wet);
  const padSides = [-pad.spread, pad.spread].map(pan => sidePanner(ctx, pan, [padFilter]));
  const bellSides = [-bell.spread, bell.spread].map(pan => sidePanner(ctx, pan, [dry, wet]));
  let ramp = { from: 0, to: 0, start: 0, end: 0 };

  const startOf = event => Math.max(event.at, ctx.currentTime + 0.05);
  const tone = (type, hz, detune, target, start, stop) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = hz;
    osc.detune.value = detune;
    osc.connect(target);
    osc.start(start);
    osc.stop(stop);
    return osc;
  };
  function playChord(event) {
    const start = startOf(event),
      hold = start + event.length,
      end = hold + pad.release;
    // The shared filter drifts slowly towards each chord's colour: the pad evolves rather than loops.
    padFilter.frequency.setTargetAtTime(event.cutoff, start, pad.attack);
    padSides.forEach((side, index) => {
      const envelope = ctx.createGain();
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.linearRampToValueAtTime(pad.level, start + pad.attack);
      envelope.gain.setValueAtTime(pad.level, hold);
      envelope.gain.linearRampToValueAtTime(0, end);
      envelope.connect(side);
      // The two sides are detuned against each other: a slow, wide chorus instead of a static chord.
      const detune = (index ? 1 : -1) * pad.detuneCents;
      let last = null;
      for (const midi of event.notes)
        last = tone('sawtooth', midiToHz(midi), detune, envelope, start, end + 0.05);
      last.onended = () => envelope.disconnect();
    });
  }
  function playBell(event) {
    const start = startOf(event),
      end = start + event.decay,
      hz = midiToHz(event.midi),
      envelope = ctx.createGain(),
      overtone = ctx.createGain();
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(event.level, start + bell.attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);
    envelope.gain.linearRampToValueAtTime(0, end + 0.05);
    envelope.connect(bellSides[event.side]);
    // A brief harmonic overtone gives the soft mallet (kalimba-like) strike.
    overtone.gain.setValueAtTime(0, start);
    overtone.gain.linearRampToValueAtTime(bell.overtoneLevel, start + bell.attack);
    overtone.gain.exponentialRampToValueAtTime(0.0001, start + bell.overtoneDecay);
    overtone.gain.linearRampToValueAtTime(0, start + bell.overtoneDecay + 0.02);
    overtone.connect(envelope);
    tone('sine', hz * bell.overtone, 0, overtone, start, start + bell.overtoneDecay + 0.05);
    tone('sine', hz, 0, envelope, start, end + 0.1).onended = () => envelope.disconnect();
  }
  return {
    master,
    play(event) {
      if (event.type === 'chord') playChord(event);
      else playBell(event);
    },
    // Linear master fade from the level that is playing now.
    fade(value, seconds) {
      const now = ctx.currentTime,
        from = rampLevel(ramp, now);
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(from, now);
      master.gain.linearRampToValueAtTime(value, now + seconds);
      ramp = { from, to: value, start: now, end: now + seconds };
    },
    level: () => rampLevel(ramp, ctx.currentTime)
  };
}

// The playlist: the original theme first (unchanged), then four more generated pieces. Everything is original
// music made by this code (no samples, no downloads); the credits of the CC0 water and bird recordings stay with
// those files (audio/*.txt, water-recording.mjs, bird-recordings.mjs).
const originalPiece = {
  id: 'original',
  title: 'Garden Glow',
  key: 'C major',
  create(ctx, random, output) {
    const voices = createVoices(ctx, random, output),
      plan = createPlan(random);
    voices.fade(1, 0.05);
    return {
      voices,
      catchUp: time => catchUp(plan, time),
      planUntil: (horizon, limit) => planUntil(plan, Math.min(horizon, limit))
    };
  }
};
export const MUSIC_PLAYLIST = [
  originalPiece,
  ...PIECES.map(piece => ({
    id: piece.id,
    title: piece.title,
    key: piece.key,
    create(ctx, random, output) {
      const voices = createPieceVoices(ctx, piece, random, output, impulseResponse),
        plan = createPiecePlan(piece, random);
      return {
        voices,
        catchUp: time => catchUpPiece(plan, time),
        planUntil: (horizon, limit) => planPieceUntil(plan, horizon, limit)
      };
    }
  }))
];
export const MUSIC_CREDITS = MUSIC_PLAYLIST.map(({ id, title, key }) => ({
  id,
  title,
  key,
  license: 'original generated music (code), no samples'
}));

// Three saved switches: the dock button (the whole sound; its old key keeps a visitor's earlier «off») and
// the two Settings layers.
export const SOUND = {
  keys: { sound: MUSIC.storageKey, music: 'garden-sound-music', nature: 'garden-sound-nature' }
};

export function readMusicPreference(storage, key = MUSIC.storageKey) {
  try {
    return storage?.getItem(key) !== 'off';
  } catch {
    return true;
  }
}
function savePreference(storage, key, on) {
  try {
    storage?.setItem(key, on ? 'on' : 'off');
  } catch {}
}
function safeStorage(win) {
  try {
    return win.localStorage;
  } catch {
    return null;
  }
}
function createContext(AudioContextClass) {
  // 'playback' lets the browser use large, battery-friendly buffers: background sound has no latency needs.
  try {
    return new AudioContextClass({ latencyHint: 'playback', sampleRate: MUSIC.sampleRate });
  } catch {
    return new AudioContextClass();
  }
}

// Wires the dock toggle and the two Settings switches. Sound is on by default (each switch persists), starts
// with the first gesture, fades out over about a second when switched off and pauses with a hidden tab or
// while setPaused(true) holds it (an embedded video brings its own sound).
// The dock button is the master: off silences both layers and keeps their choice; on with both layers off
// brings both back. Turning a layer on in Settings also turns the master on: the visitor asked to hear it.
// `natureContext()` returns { x, y, z, falls, season, night, morning } for the camera; it is read a few
// times a second while the nature layer plays, never per frame.
export function mountAmbientMusic(button, options = {}) {
  const {
    labels = {},
    win = window,
    doc = document,
    storage = safeStorage(win),
    AudioContextClass = win.AudioContext || win['webkitAudioContext'],
    random = Math.random,
    musicInput = null,
    natureInput = null,
    natureContext = () => null,
    playlistMode = 'shuffle',
    fireworkOptions = {}
  } = options;
  if (!button) return null;
  const inputs = [musicInput, natureInput].filter(Boolean);
  if (!AudioContextClass) {
    button.hidden = true;
    for (const input of inputs) input.disabled = true;
    return null;
  }
  // Mouse presses, touch releases and keys are the gestures browsers accept for starting audio.
  const gestures = ['pointerdown', 'pointerup', 'keydown'];
  const { keys } = SOUND;
  let enabled = readMusicPreference(storage, keys.sound),
    musicOn = readMusicPreference(storage, keys.music),
    natureOn = readMusicPreference(storage, keys.nature),
    ctx = null,
    master = null,
    playlist = null,
    nature = null,
    effects = null,
    portalEffects = null,
    naturePlan = null,
    musicLive = false,
    natureLive = false,
    paused = false,
    disposed = false,
    timer = 0,
    suspendTimer = 0,
    ramp = { from: 0, to: 0, start: 0, end: 0 };
  const audible = () => !disposed && enabled && (musicOn || natureOn) && !paused && !doc.hidden;
  const running = () => ctx?.state === 'running';
  const render = () => {
    const on = enabled && (musicOn || natureOn);
    button.setAttribute('aria-pressed', String(on));
    button.title =
      (labels.sound || labels.music || 'Sound') +
      ': ' +
      (on ? labels.musicOn || 'on' : labels.musicOff || 'off');
    button.dataset.audio = ctx ? ctx.state : 'idle';
    if (musicInput) musicInput.checked = musicOn;
    if (natureInput) natureInput.checked = natureOn;
  };
  // Linear master fade from the level that is playing now.
  const fadeMaster = (value, seconds) => {
    const now = ctx.currentTime,
      from = rampLevel(ramp, now);
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(from, now);
    master.gain.linearRampToValueAtTime(value, now + seconds);
    ramp = { from, to: value, start: now, end: now + seconds };
  };
  const ensureNature = () => {
    effects ??= createFireworkVoices(ctx, master, random, fireworkOptions);
    if (nature) return;
    nature = createNatureVoices(ctx, master, random);
    naturePlan = createNaturePlan(random);
  };
  // Each layer fades on its own bus; a layer that comes back skips the time it was silent.
  const syncMusic = (want, seconds) => {
    if (want === musicLive) return;
    musicLive = want;
    if (want) playlist.catchUp(ctx.currentTime + 0.1);
    playlist.fade(want ? 1 : 0, want ? seconds.in : seconds.out);
  };
  const syncNature = (want, seconds) => {
    if (!want) {
      effects?.stop();
      portalEffects?.stop();
    }
    if (want === natureLive) return;
    if (want) ensureNature();
    natureLive = want;
    if (!nature) return;
    if (want) catchUpNature(naturePlan, ctx.currentTime + 0.1);
    nature.fade(want ? 1 : 0, want ? NATURE.layerFade : seconds.out);
  };
  const syncLayers = seconds => {
    syncMusic(audible() && musicOn, seconds);
    syncNature(audible() && natureOn, seconds);
  };
  const tickNature = () => {
    const view = natureContext(),
      distance = view ? nearestFallDistance(view.falls, view.x, view.y, view.z) : Infinity,
      mood = natureMood(view || undefined);
    nature.update(waterProximity(distance), mood);
    for (const event of planNature(naturePlan, ctx.currentTime + NATURE.lookahead, mood)) nature.play(event);
  };
  const tick = () => {
    timer = 0;
    if (!audible() || !running()) return;
    if (musicLive) playlist.tick(ctx.currentTime, ctx.currentTime + MUSIC.lookahead);
    if (natureLive) tickNature();
    timer = win.setTimeout(tick, natureLive ? NATURE.tickMs : MUSIC.tickMs);
  };
  const startTicking = () => {
    if (timer || !audible() || !running()) return;
    if (musicLive) playlist.catchUp(ctx.currentTime + 0.1);
    if (natureLive) catchUpNature(naturePlan, ctx.currentTime + 0.1);
    tick();
  };
  const stopTicking = () => {
    win.clearTimeout(timer);
    timer = 0;
  };
  const onGesture = event => {
    // The toggle's own click decides; starting here would make its first press start and stop the sound.
    if (button.contains?.(event.target)) return;
    start();
  };
  const listen = () =>
    gestures.forEach(type => win.addEventListener(type, onGesture, { capture: true, passive: true }));
  const unlisten = () =>
    gestures.forEach(type => win.removeEventListener(type, onGesture, { capture: true }));
  const fadeIn = () => {
    win.clearTimeout(suspendTimer);
    suspendTimer = 0;
    // Without a gesture the browser may keep the context waiting; the next gesture tries again.
    if (running()) unlisten();
    else {
      quietly(ctx.resume());
      listen();
    }
    fadeMaster(dbToGain(MUSIC.masterDb), MUSIC.fadeIn);
    syncLayers({ in: MUSIC.fadeIn, out: MUSIC.fadeOut });
    startTicking();
  };
  const fadeOut = seconds => {
    effects?.stop();
    portalEffects?.stop();
    stopTicking();
    if (!ctx) return;
    fadeMaster(0, seconds);
    win.clearTimeout(suspendTimer);
    suspendTimer = win.setTimeout(
      () => {
        suspendTimer = 0;
        if (audible()) return;
        // Layers are marked silent only once the master is quiet, so a quick «on» again fades nothing in twice.
        syncLayers({ in: 0, out: 0.05 });
        if (running()) quietly(ctx.suspend());
      },
      seconds * 1000 + 100
    );
  };
  function start() {
    if (!audible()) return;
    if (!ctx) {
      try {
        ctx = createContext(AudioContextClass);
        master = ctx.createGain();
        master.gain.value = 0;
        master.connect(ctx.destination);
        playlist = createPlaylist(ctx, MUSIC_PLAYLIST, random, master, { mode: playlistMode });
      } catch (error) {
        console.warn('Garden sound unavailable', error);
        ctx = null;
        button.hidden = true;
        for (const input of inputs) input.disabled = true;
        unlisten();
        return;
      }
      ctx.addEventListener('statechange', () => {
        render();
        if (running()) {
          unlisten();
          startTicking();
        }
      });
    }
    fadeIn();
    render();
  }
  // Re-applies the switches: the master fades when nothing should sound, a layer fades on its own otherwise.
  const apply = () => {
    if (audible()) {
      if (!ctx || ramp.to === 0) start();
      else {
        syncLayers({ in: MUSIC.fadeIn, out: MUSIC.fadeOut });
        stopTicking();
        startTicking();
      }
    } else fadeOut(MUSIC.fadeOut);
    render();
  };
  const setEnabled = on => {
    enabled = Boolean(on);
    savePreference(storage, keys.sound, enabled);
    if (enabled && !musicOn && !natureOn) {
      musicOn = natureOn = true;
      savePreference(storage, keys.music, true);
      savePreference(storage, keys.nature, true);
    }
    apply();
  };
  const setLayer = (layer, on) => {
    if (layer === 'music') musicOn = Boolean(on);
    else natureOn = Boolean(on);
    savePreference(storage, keys[layer], Boolean(on));
    if (on && !enabled) {
      enabled = true;
      savePreference(storage, keys.sound, true);
    }
    apply();
  };
  const onClick = () => setEnabled(!(enabled && (musicOn || natureOn)));
  const onMusicInput = () => setLayer('music', musicInput.checked);
  const onNatureInput = () => setLayer('nature', natureInput.checked);
  const onVisibility = () => {
    if (!ctx) return;
    if (doc.hidden) fadeOut(MUSIC.hiddenFade);
    else if (audible()) fadeIn();
  };
  // A pause keeps the preferences and the button state; only the sound waits.
  const setPaused = on => {
    if (paused === Boolean(on)) return;
    paused = Boolean(on);
    if (!ctx) return;
    if (paused) fadeOut(MUSIC.fadeOut);
    else if (audible()) fadeIn();
  };
  button.addEventListener('click', onClick);
  musicInput?.addEventListener('change', onMusicInput);
  natureInput?.addEventListener('change', onNatureInput);
  doc.addEventListener('visibilitychange', onVisibility);
  listen();
  render();
  return {
    get enabled() {
      return enabled;
    },
    get music() {
      return musicOn;
    },
    get nature() {
      return natureOn;
    },
    get context() {
      return ctx;
    },
    get scheduling() {
      return Boolean(timer);
    },
    get paused() {
      return paused;
    },
    get layers() {
      return { music: musicLive, nature: natureLive };
    },
    get fireworkReady() {
      return effects?.ready ?? Promise.resolve(false);
    },
    get playlist() {
      return playlist;
    },
    get natureVoices() {
      return nature;
    },
    // Visual events are transient: never create/unlock audio or replay a queue for a missed event.
    playFirework(event) {
      if (!audible() || !natureOn || !running()) return false;
      effects ??= createFireworkVoices(ctx, master, random, fireworkOptions);
      return effects.play(event);
    },
    // plan: { duration, cut } of the crossing (seconds, share) so its layers follow the visual; none = a shimmer.
    playPortal(plan) {
      if (!audible() || !natureOn || !running()) return false;
      portalEffects ??= createPortalVoices(ctx, master, random);
      return portalEffects.play(plan);
    },
    stopPortal() {
      portalEffects?.stop();
    },
    setEnabled,
    setMusic: on => setLayer('music', on),
    setNature: on => setLayer('nature', on),
    setPaused,
    toggle: () => onClick(),
    dispose() {
      disposed = true;
      effects?.dispose();
      portalEffects?.dispose();
      nature?.dispose();
      playlist?.dispose();
      stopTicking();
      win.clearTimeout(suspendTimer);
      unlisten();
      button.removeEventListener('click', onClick);
      musicInput?.removeEventListener('change', onMusicInput);
      natureInput?.removeEventListener('change', onNatureInput);
      doc.removeEventListener('visibilitychange', onVisibility);
      if (ctx) quietly(ctx.close());
    }
  };
}
