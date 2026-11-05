// Original synthesized portal shimmer; no recordings or external audio assets.
// The shared controller owns gesture unlock, master volume, mute and hidden-tab suspension.
// Owner, round 18: the portal and the jump went unheard. At 0.22 the crossing's loudest layer (the whoosh) reached
// 0.077 on the shared master, under the music's own bells (0.28): it sank into the background. At 0.6 it peaks
// at 1.8 times the music around it (measured on the page) and the whole mix stays at the master's quiet -24 dB.
export const PORTAL_SOUND = { duration: 1.45, cooldown: 1.8, level: 0.6 };
// A crossing (owner, round 4: the portal forming and the teleport itself should be heard): a swell that builds while
// the portal opens, a deep whoosh and drop at the hidden cut, and a soft bell chord as the destination unfolds.
// Times are shares of the crossing; every level is relative to the bus and eases in and out (no jumps).
export const CROSSING_SOUND = { swell: 0.18, whoosh: 0.35, drop: 0.3, chime: 0.12, arrive: 0.8, ring: 1.4 };

export function createPortalVoices(ctx, output, random = Math.random) {
  let active = null;
  let lastPlay = -Infinity;
  let disposed = false;
  const air = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * PORTAL_SOUND.duration), ctx.sampleRate);
  const samples = air.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = random() * 2 - 1;

  function release(voice) {
    if (voice.released) return;
    voice.released = true;
    for (const node of voice.nodes) node.disconnect();
    if (active === voice) active = null;
  }
  function play(plan = null) {
    if (disposed || ctx.state !== 'running' || active || ctx.currentTime - lastPlay < PORTAL_SOUND.cooldown)
      return false;
    const now = ctx.currentTime;
    lastPlay = now;
    const bus = ctx.createGain();
    bus.gain.value = PORTAL_SOUND.level;
    bus.connect(output);
    const voice = { nodes: [bus], sources: [], remaining: 4, released: false };
    const crossing = plan && plan.duration > 0;
    active = voice;
    function end() {
      voice.remaining--;
      if (voice.remaining === 0) release(voice);
    }
    function envelope(gain, start, peak, attack, finish) {
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, finish);
    }
    // Soft consonant voices rise together; slow attacks avoid a notification-like beep.
    for (const [i, ratio] of [1, 1.5, 2].entries()) {
      const source = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + i * 0.065;
      source.type = 'sine';
      source.frequency.setValueAtTime(220 * ratio, start);
      source.frequency.exponentialRampToValueAtTime(330 * ratio, now + 0.85);
      envelope(gain, start, [0.24, 0.12, 0.065][i], 0.3, now + PORTAL_SOUND.duration);
      source.connect(gain);
      gain.connect(bus);
      voice.nodes.push(source, gain);
      voice.sources.push(source);
      source.onended = end;
      source.start(start);
      source.stop(now + PORTAL_SOUND.duration + 0.02);
    }
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    source.buffer = air;
    filter.type = 'bandpass';
    filter.Q.value = 0.55;
    filter.frequency.setValueAtTime(700, now);
    filter.frequency.exponentialRampToValueAtTime(2100, now + 0.9);
    envelope(gain, now, 0.18, 0.45, now + PORTAL_SOUND.duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(bus);
    voice.nodes.push(source, filter, gain);
    voice.sources.push(source);
    source.onended = end;
    source.start(now);
    source.stop(now + PORTAL_SOUND.duration + 0.02);
    if (crossing) crossingLayers(voice, bus, now, plan.duration, plan.cut ?? 0.55, end, envelope);
    return true;
  }
  // The crossing's own layers, scheduled once on the audio clock against its duration and cut.
  function crossingLayers(voice, bus, now, duration, cut, end, envelope) {
    const C = CROSSING_SOUND,
      cutAt = now + duration * cut,
      arriveAt = now + duration * C.arrive;
    const tone = (type, from, to, start, glideEnd, peak, attack, finish) => {
      const osc = ctx.createOscillator(),
        gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(from, start);
      osc.frequency.exponentialRampToValueAtTime(to, glideEnd);
      envelope(gain, start, peak, attack, finish);
      osc.connect(gain);
      gain.connect(bus);
      track(osc, gain, start, finish);
    };
    function track(source, gain, start, finish, extra = []) {
      voice.nodes.push(source, ...extra, gain);
      voice.sources.push(source);
      voice.remaining++;
      source.onended = end;
      source.start(start);
      source.stop(finish + 0.02);
    }
    // Swell: two slightly detuned low voices rising a fifth while the portal forms, peaking just before the cut.
    for (const detune of [1, 1.012])
      tone(
        'triangle',
        98 * detune,
        147 * detune,
        now,
        cutAt,
        C.swell,
        Math.max(0.2, cutAt - now - 0.1),
        cutAt + 0.35
      );
    // Whoosh: air rushing past, swept from bright to dark across the cut.
    const rush = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      rushGain = ctx.createGain(),
      rushStart = Math.max(now, cutAt - 0.3);
    rush.buffer = air;
    filter.type = 'bandpass';
    filter.Q.value = 0.8;
    filter.frequency.setValueAtTime(2800, rushStart);
    filter.frequency.exponentialRampToValueAtTime(240, rushStart + 1.0);
    envelope(rushGain, rushStart, C.whoosh, 0.28, rushStart + 1.1);
    rush.connect(filter);
    filter.connect(rushGain);
    rushGain.connect(bus);
    track(rush, rushGain, rushStart, rushStart + 1.1, [filter]);
    // Drop: a low body falling away under the cut.
    tone('sine', 82, 34, cutAt, cutAt + 0.55, C.drop, 0.03, cutAt + 0.7);
    // Arrival: a soft bell chord blooming as the destination unfolds.
    for (const [i, f] of [523.25, 783.99, 1046.5].entries())
      tone(
        'sine',
        f,
        f * 1.002,
        arriveAt + i * 0.05,
        arriveAt + C.ring,
        C.chime / (1 + i * 0.6),
        0.05,
        arriveAt + C.ring
      );
  }
  function stop() {
    if (!active) return;
    const voice = active;
    // Mute synchronously; context suspension must not preserve a half-played portal sound.
    voice.nodes[0].gain.value = 0;
    for (const source of voice.sources) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        /* Natural completion may have happened just before cancellation. */
      }
    }
    release(voice);
  }
  return {
    play,
    stop,
    dispose() {
      stop();
      disposed = true;
    }
  };
}
