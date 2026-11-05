// Private local recording playback. The asset is served only by the opt-in loopback preview.
// Driven by the visual clock, so a slow frame never schedules an early explosion.
let nextRocketId = 0;

export function createFireworkTimeline(emit = () => {}) {
  const pending = [];
  const send = event => {
    try {
      emit(event);
    } catch {
      /* Audio must not interrupt rendering. */
    }
  };
  return {
    shell(now, birth, strength = 1, ascent = true) {
      if (pending.length >= 32) return;
      const rocketId = ++nextRocketId;
      if (ascent) send({ type: 'launch', strength, rocketId, flightDuration: Math.max(0, birth - now) });
      pending.push({ at: birth, strength, rocketId });
    },
    update(now) {
      for (let i = pending.length - 1; i >= 0; i--) {
        const event = pending[i];
        if (event.at > now) continue;
        pending.splice(i, 1);
        if (now - event.at <= 0.25)
          send({ type: 'burst', strength: event.strength, rocketId: event.rocketId, lateBy: now - event.at });
      }
    },
    clear() {
      pending.length = 0;
    }
  };
}

export const FIREWORK_RECORDING = Object.freeze({
  url: '/garden-private/firework-recording.wav',
  // Waveform-derived markers inside the user's selected 90–108s excerpt; not auditioned.
  launch: { offset: 18.05, duration: 1.85 },
  burst: { offset: 10.65, duration: 0.8 }
});

export function createFireworkVoices(ctx, output, random = Math.random, options = {}) {
  const host = options.hostname ?? globalThis.location?.hostname;
  const local = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(host);
  const fetchAudio = options.fetch ?? globalThis.fetch;
  let buffer = null,
    disposed = false;
  const live = new Set(),
    seen = new Set();
  const lastAnonymous = { launch: -Infinity, burst: -Infinity };
  // The clip already carries -8dB and edge fades. Do not apply a second attenuation.
  // Readiness never replays a missed visual event; production never fetches the private URL.
  const ready =
    local && fetchAudio
      ? Promise.resolve()
          .then(async () => {
            const response = await fetchAudio(FIREWORK_RECORDING.url, { cache: 'no-store' });
            if (!response.ok) return false;
            const decoded = await ctx.decodeAudioData(await response.arrayBuffer());
            // A decoder resampling to the device rate (22.05/44.1 kHz) may drop the last sample; the launch slice ends at
            // 19.9 s, so a few ms short still plays it whole. A strict 19.9 silently rejected the recording.
            if (disposed || decoded.duration < 19.8) return false;
            buffer = decoded;
            return true;
          })
          .catch(() => false)
      : Promise.resolve(false);
  function release(voice) {
    voice.source.disconnect();
    voice.gain.disconnect();
    live.delete(voice);
  }
  function stopVoice(voice) {
    voice.gain.gain.cancelScheduledValues(ctx.currentTime);
    voice.gain.gain.setValueAtTime(0, ctx.currentTime);
    try {
      voice.source.stop();
    } catch {
      /* Already ended. */
    }
    release(voice);
  }
  function fadeRise(voice) {
    if (voice.fading) return;
    voice.fading = true;
    const now = ctx.currentTime,
      elapsed = now - voice.started;
    const level =
      voice.strength * Math.max(0, Math.min(1, elapsed / 0.005, (voice.duration - elapsed) / 0.08));
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(level, now);
    voice.gain.gain.linearRampToValueAtTime(0, now + 0.02);
    voice.source.stop(now + 0.02);
    // Keep counting the fading source until its actual onended callback releases it.
  }
  function stopRise(id) {
    for (const voice of live) {
      if (voice.type === 'launch' && voice.id === id) fadeRise(voice);
    }
  }
  function remember(key) {
    seen.add(key);
    if (seen.size > 128) seen.delete(seen.values().next().value);
  }
  function play(event) {
    if (disposed || !buffer || ctx.state !== 'running' || event?.lateBy > 0.25) return false;
    const slice = FIREWORK_RECORDING[event?.type];
    if (!slice || !Number.isFinite(slice.offset)) return false;
    const now = ctx.currentTime,
      id = event.rocketId;
    const keyed = Number.isSafeInteger(id),
      key = keyed ? id + ':' + event.type : null;
    if (keyed && seen.has(key)) return false;
    if (!keyed && now - lastAnonymous[event.type] < 0.08) return false;
    // The visual burst ends only its own rocket's rise, never another rocket's decay.
    if (live.size >= 10 && event.type === 'burst' && keyed) {
      // Reserve the matching burst by stopping only its own rise when the voice limit is full.
      const rise = [...live].find(voice => voice.type === 'launch' && voice.id === id);
      if (rise) stopVoice(rise);
    }
    if (live.size >= 10) return false;
    if (event.type === 'burst') stopRise(id);
    if (keyed) {
      remember(key);
    } else lastAnonymous[event.type] = now;
    const source = ctx.createBufferSource(),
      gain = ctx.createGain();
    const strength = Number.isFinite(event.strength) ? Math.max(0.2, Math.min(1, event.strength)) : 1;
    // Keep the natural whistle through the known flight; the actual burst supplies the apex fade.
    const duration =
      event.type === 'launch' && Number.isFinite(event.flightDuration)
        ? Math.min(slice.duration, Math.max(0.02, event.flightDuration) + 0.08)
        : slice.duration;
    source.buffer = buffer;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(strength, now + 0.005);
    gain.gain.setValueAtTime(strength, now + duration - 0.08);
    gain.gain.linearRampToValueAtTime(0, now + duration);
    source.connect(gain);
    gain.connect(output);
    const voice = { source, gain, id, type: event.type, strength, started: now, duration };
    live.add(voice);
    source.onended = () => release(voice);
    source.start(now, slice.offset, duration);
    source.stop(now + duration + 0.01);
    return true;
  }
  function stop() {
    for (const voice of live) stopVoice(voice);
    lastAnonymous.launch = lastAnonymous.burst = -Infinity;
  }
  return {
    play,
    stop,
    ready,
    dispose() {
      disposed = true;
      stop();
      buffer = null;
    }
  };
}
