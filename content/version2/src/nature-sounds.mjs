import { createWaterRecording } from './water-recording.mjs';
import { createBirdRecordings } from './bird-recordings.mjs';

// Quiet nature sounds (water near the falls and birds, with their own Settings switch).
// A recorded water bed follows the camera's distance to the nearest waterfall, alongside a soft generated wind
// and short recorded birdsong phrases from
// different sides and, on summer nights, faint crickets. The controller in ambient-music.mjs owns the audio
// context, the gesture start, the hidden-tab pause and the on/off switches; this module only plans and plays.

export const NATURE = {
  // Gain updates (distance and wind) and the bird queue run on this tick: a few times a second is enough
  // for a camera that glides, and no work happens per frame.
  tickMs: 250,
  lookahead: 3,
  layerFade: 1.5,
  // Dark brown wind loop; the recorded waterfall has its own loop.
  noiseSeconds: 4,
  water: {
    // A longer, irregular texture avoids an obvious short repeating splash pattern.
    noiseSeconds: 13.3,
    // Relative to the sound master: keep the recorded water gentle near a fall.
    level: 0.6,
    // A faint murmur stays wherever the garden is in view; it grows as the camera comes close.
    floor: 0.02,
    near: 5,
    far: 65,
    smoothing: 0.6,
    rushCutoff: 1900,
    babble: [700, 2400],
    babbleQ: 0.75,
    babbleLevel: 0.35,
    babbleGlide: 0.07
  },
  wind: { level: 0.22, cutoff: [260, 620], glide: 2.5, swell: 0.45, everyTicks: 10 },
  birds: {
    // Phrases per minute by season; mornings are livelier, nights nearly silent.
    perMinute: { spring: 9, summer: 7, autumn: 4, winter: 1.5 },
    morning: 1.7,
    night: 0.06,
    minGap: 1.6,
    firstDelay: 2,
    level: 0.16,
    attack: 0.008,
    spread: 0.85
  },
  crickets: {
    // Summer nights; a few late or early ones in autumn and spring, none in winter.
    seasons: { summer: 1, autumn: 0.35, spring: 0.15 },
    hz: 4300,
    level: 0.05,
    every: [0.75, 1.05],
    pulses: [2, 4],
    pulse: 0.024,
    gap: 0.018,
    attack: 0.004
  },
  // Nature is a little brighter than the music bus, but nothing needs the top octave.
  cutoff: 6500
};

// Short songs: a whistle (thrush-like slow notes), a trill (rapid notes falling in pitch) and a chirp pair.
export const BIRD_SONGS = ['whistle', 'trill', 'chirp'];

const between = (random, min, max) => min + (max - min) * random();
const clamp01 = value => Math.min(1, Math.max(0, value || 0));

// Brown noise whose head is cross-faded with the samples after its end, so the loop has no seam click.
export function loopedNoise(ctx, seconds, random = Math.random) {
  return noiseLoop(ctx, seconds, random, false);
}

// Turbulence plus irregular splash grains and quiet rising bubble resonances.
// Timbre still needs listening QA: spectral tests do not establish naturalness.
// It is generated independently; no recordings, downloads or extra live oscillators.
export function loopedWaterNoise(ctx, seconds, random = Math.random) {
  return noiseLoop(ctx, seconds, random, true);
}

function noiseLoop(ctx, seconds, random, water) {
  const length = Math.max(2, Math.round(seconds * ctx.sampleRate)),
    fade = Math.min(length, Math.round(0.25 * ctx.sampleRate)),
    raw = new Float32Array(length + fade),
    buffer = ctx.createBuffer(1, length, ctx.sampleRate),
    data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < raw.length; i++) {
    const white = random() * 2 - 1;
    last = water ? last * 0.65 + white * 0.35 : (last + 0.02 * white) / 1.02;
    raw[i] = water ? last * 0.38 : last * 3.5;
  }
  if (water) {
    // Pre-render little impacts and entrained bubbles into the loop. This avoids
    // allocating a new oscillator/envelope for every splash during playback.
    let at = 0;
    while (at < raw.length) {
      const duration = between(random, 0.065, 0.2),
        count = Math.round(duration * ctx.sampleRate),
        hz = between(random, 480, 1550),
        strength = between(random, 0.045, 0.15);
      let phase = 0,
        smooth = 0;
      for (let j = 0; j < count && at + j < raw.length; j++) {
        const u = j / count,
          // Soft attack, fast uneven decay: water hitting rock, not steady wind.
          envelope = Math.sin(Math.PI * u) * Math.exp(-3.5 * u),
          white = random() * 2 - 1;
        smooth = smooth * 0.35 + white * 0.65;
        // A shrinking air bubble rises slightly in pitch; kept below the spray.
        phase += (2 * Math.PI * hz * (1 + 0.65 * u)) / ctx.sampleRate;
        raw[at + j] += strength * envelope * (smooth * 1.8 + Math.sin(phase) * 0.32);
      }
      at += Math.max(1, Math.round(between(random, 0.035, 0.17) * ctx.sampleRate));
    }
  }
  for (let i = 0; i < length; i++) {
    const w = i < fade ? i / fade : 1;
    data[i] = i < fade ? raw[i] * w + raw[length + i] * (1 - w) : raw[i];
  }
  return buffer;
}

// Distance from a point to the nearest fall: each fall is a vertical segment from its lip down its height.
export function nearestFallDistance(falls, x, y, z) {
  let best = Infinity;
  for (const fall of falls || []) {
    const lip = fall.lip,
      top = fall.base,
      bottom = fall.base - (fall.height || 0),
      dy = Math.max(0, y - top, bottom - y),
      d = Math.hypot(x - lip[0], dy, z - lip[2]);
    if (d < best) best = d;
  }
  return best;
}

// 1 at or inside `near`, the floor at `far` and beyond; squared, so the water swells late, like a real stream.
export function waterProximity(distance, { near, far, floor } = NATURE.water) {
  if (!Number.isFinite(distance)) return floor;
  const t = clamp01((far - distance) / (far - near));
  return floor + (1 - floor) * t * t;
}

// How lively the garden is: bird phrases per minute, cricket and wind levels (0..1).
// `night` and `morning` are 0..1 weights of the current light, `season` a season name.
export function natureMood({ season = 'summer', night = 0, morning = 0 } = {}) {
  const { birds } = NATURE,
    base = birds.perMinute[season] ?? birds.perMinute.summer,
    awake = 1 + (birds.morning - 1) * clamp01(morning),
    dark = 1 + (birds.night - 1) * clamp01(night);
  const insects = NATURE.crickets.seasons[season] || 0;
  return {
    birdsPerMinute: base * awake * dark,
    crickets: insects * clamp01((night - 0.4) / 0.6),
    // Winter keeps the wind (and only the wind) at night; other seasons have just a breath of it.
    wind: season === 'winter' ? 1 : 0.3 + 0.2 * clamp01(night)
  };
}

export function createNaturePlan(random = Math.random) {
  return { random, birdAt: NATURE.birds.firstDelay, cricketAt: 0, lastBirdSong: null };
}

// Moves the cursors to `time` or later, so a stalled timer never releases a backlog of birds at once.
export function catchUpNature(plan, time) {
  if (plan.birdAt < time) plan.birdAt = time + NATURE.birds.firstDelay * plan.random();
  if (plan.cricketAt < time) plan.cricketAt = time;
}

// One phrase: notes relative to its start, each { t, length, from, to } in seconds and Hz.
export function birdPhrase(random, song = BIRD_SONGS[Math.floor(random() * BIRD_SONGS.length)]) {
  const notes = [];
  if (song === 'whistle') {
    const count = 2 + Math.floor(random() * 3);
    let t = 0,
      hz = between(random, 1900, 2900);
    for (let i = 0; i < count; i++) {
      const length = between(random, 0.12, 0.24),
        to = hz * between(random, 0.85, 1.18);
      notes.push({ t, length, from: hz, to });
      t += length + between(random, 0.06, 0.16);
      hz = Math.min(3600, Math.max(1600, hz * between(random, 0.88, 1.14)));
    }
  } else if (song === 'trill') {
    const count = 6 + Math.floor(random() * 6),
      high = between(random, 3800, 4600),
      low = high * between(random, 0.62, 0.75);
    let t = 0;
    for (let i = 0; i < count; i++) {
      const hz = high + ((low - high) * i) / (count - 1),
        length = between(random, 0.035, 0.055);
      notes.push({ t, length, from: hz * 1.06, to: hz * 0.94 });
      t += length + between(random, 0.025, 0.04);
    }
  } else {
    const count = 2 + Math.floor(random() * 2);
    let t = 0;
    for (let i = 0; i < count; i++) {
      const length = between(random, 0.06, 0.09),
        hz = between(random, 4200, 5200);
      notes.push({ t, length, from: hz, to: hz * 0.72 });
      t += length + between(random, 0.08, 0.14);
    }
  }
  return { song, notes, length: notes.at(-1).t + notes.at(-1).length };
}

// Events that start before `horizon`, in time order, for the given mood.
export function planNature(plan, horizon, mood) {
  const { birds, crickets } = NATURE,
    { random } = plan,
    events = [];
  if (mood.birdsPerMinute > 0) {
    const mean = 60 / mood.birdsPerMinute;
    while (plan.birdAt < horizon) {
      const choices = BIRD_SONGS.filter(song => song !== plan.lastBirdSong);
      const song = choices[Math.floor(random() * choices.length)];
      plan.lastBirdSong = song;
      const phrase = birdPhrase(random, song);
      // Mostly one side or the other, some from ahead: different birds in different trees.
      events.push({
        type: 'bird',
        at: plan.birdAt,
        ...phrase,
        pan: (random() * 2 - 1) * birds.spread,
        level: birds.level * between(random, 0.35, 1)
      });
      // Exponential gaps read as a natural, uneven chorus; the floor keeps two phrases from colliding.
      plan.birdAt += Math.max(birds.minGap, phrase.length - mean * Math.log(1 - random() * 0.98));
    }
  } else if (plan.birdAt < horizon) plan.birdAt = horizon;
  if (mood.crickets > 0.01)
    while (plan.cricketAt < horizon) {
      const pulses =
        crickets.pulses[0] + Math.floor(random() * (crickets.pulses[1] - crickets.pulses[0] + 1));
      events.push({ type: 'cricket', at: plan.cricketAt, pulses, level: crickets.level * mood.crickets });
      plan.cricketAt += between(random, crickets.every[0], crickets.every[1]);
    }
  else if (plan.cricketAt < horizon) plan.cricketAt = horizon;
  return events.sort((a, b) => a.at - b.at);
}

function panner(ctx, pan, target) {
  // StereoPanner is missing only in very old Safari; there the bird is simply centred.
  const node = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
  if ('pan' in node) node.pan.value = pan;
  node.connect(target);
  return node;
}

// The nature graph: one switchable bus, a recorded water loop, an independent low wind loop,
// short-lived birds and one cricket oscillator made on first need.
export function createNatureVoices(ctx, output = ctx.destination, random = Math.random, birdOptions = {}) {
  const { water, wind, crickets } = NATURE;
  const bus = ctx.createGain();
  bus.gain.value = 0;
  bus.connect(output);
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = NATURE.cutoff;
  tone.connect(bus);
  const buffer = loopedNoise(ctx, NATURE.noiseSeconds, random);
  const loop = (offset, sourceBuffer = buffer) => {
    const source = ctx.createBufferSource();
    source.buffer = sourceBuffer;
    source.loop = true;
    source.start(ctx.currentTime, offset);
    return source;
  };
  // The selected CC0 field recording shares the existing proximity and nature bus.
  const waterGain = ctx.createGain();
  waterGain.gain.value = 0;
  waterGain.connect(tone);
  const recording = createWaterRecording(ctx, waterGain);
  // Wind retains its dark brown noise, with a slow drift of colour and level.
  const windGain = ctx.createGain();
  windGain.gain.value = 0;
  windGain.connect(tone);
  const windFilter = ctx.createBiquadFilter();
  windFilter.type = 'lowpass';
  windFilter.frequency.value = wind.cutoff[0];
  windFilter.connect(windGain);
  loop(NATURE.noiseSeconds / 2).connect(windFilter);
  const birdRecordings = createBirdRecordings(ctx, tone, { ...birdOptions, random });
  let birdUntil = -Infinity;
  let cricketGate = null,
    windTicks = 0,
    ramp = { from: 0, to: 0, start: 0, end: 0 };

  const startOf = event => Math.max(event.at, ctx.currentTime + 0.05);
  function playBird(event) {
    if (event.at < birdUntil) return;
    const phrase = birdRecordings.choose();
    if (!phrase) return;
    if (birdRecordings.play({ ...event, phrase }))
      birdUntil = Math.max(event.at, ctx.currentTime + 0.05) + phrase.duration + 1.2;
  }
  function playCricket(event) {
    if (!cricketGate) {
      // One steady oscillator gated on and off: no node is made per chirp.
      cricketGate = ctx.createGain();
      cricketGate.gain.value = 0;
      cricketGate.connect(panner(ctx, 0.5, tone));
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = crickets.hz;
      osc.connect(cricketGate);
      osc.start();
    }
    let at = startOf(event);
    for (let i = 0; i < event.pulses; i++) {
      cricketGate.gain.setValueAtTime(0, at);
      cricketGate.gain.linearRampToValueAtTime(event.level, at + crickets.attack);
      cricketGate.gain.linearRampToValueAtTime(0, at + crickets.pulse);
      at += crickets.pulse + crickets.gap;
    }
  }
  return {
    bus,
    waterReady: recording.ready,
    birdReady: birdRecordings.ready,
    dispose: () => {
      recording.dispose();
      birdRecordings.dispose();
    },
    // The water level follows the camera; exposed so a check can read where it is heading.
    water: waterGain.gain,
    play(event) {
      if (event.type === 'bird') playBird(event);
      else playCricket(event);
    },
    // Gain targets glide (setTargetAtTime), so a camera jump or a season change never steps the level.
    update(proximity, mood) {
      const now = ctx.currentTime;
      waterGain.gain.setTargetAtTime(Math.max(1e-4, water.level * proximity), now, water.smoothing);
      if (windTicks-- <= 0) {
        windTicks = wind.everyTicks;
        const level = wind.level * mood.wind * (1 - wind.swell * random());
        windGain.gain.setTargetAtTime(Math.max(1e-4, level), now, wind.glide);
        windFilter.frequency.setTargetAtTime(
          between(random, wind.cutoff[0], wind.cutoff[1]),
          now,
          wind.glide
        );
      }
    },
    // Linear layer fade from the level that is playing now (AudioParam.value does not report automation).
    fade(value, seconds) {
      if (!value) {
        birdRecordings.stop();
        birdUntil = -Infinity;
      }
      const now = ctx.currentTime,
        from = layerLevel(ramp, now);
      bus.gain.cancelScheduledValues(now);
      bus.gain.setValueAtTime(from, now);
      bus.gain.linearRampToValueAtTime(value, now + seconds);
      ramp = { from, to: value, start: now, end: now + seconds };
    },
    level: () => layerLevel(ramp, ctx.currentTime)
  };
}

function layerLevel(ramp, time) {
  if (time >= ramp.end) return ramp.to;
  if (time <= ramp.start) return ramp.from;
  return ramp.from + ((ramp.to - ramp.from) * (time - ramp.start)) / (ramp.end - ramp.start);
}
