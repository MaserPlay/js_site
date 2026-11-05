// Recorded birdsong: small scheduled excerpts from independently licensed source files.
// Descriptors are selected only after loading; the caller uses duration to space scheduled events.
import { gardenFile } from './garden-paths.mjs';
export const BIRD_RECORDINGS = Object.freeze([
  {
    id: 'gammagool-850506',
    gain: 6,
    url: gardenFile('audio/birds-gammagool-850506.mp3'),
    creator: 'GammaGool',
    title: 'Birds in the Slovenian Forest - Processed',
    license: 'CC0-1.0',
    source: 'https://freesound.org/people/GammaGool/sounds/850506/',
    preview: 'https://cdn.freesound.org/previews/850/850506_8908475-hq.mp3'
  },
  {
    id: 'sadiquecat-802702',
    gain: 0.8,
    url: gardenFile('audio/birds-sadiquecat-802702.mp3'),
    creator: 'Sadiquecat',
    title: '250427-13h43 Bird flying by',
    license: 'CC0-1.0',
    source: 'https://freesound.org/people/Sadiquecat/sounds/802702/',
    preview: 'https://cdn.freesound.org/previews/802/802702_5287430-hq.mp3'
  },
  {
    id: 'shepherd-565946',
    gain: 0.8,
    url: gardenFile('audio/birds-shepherd-565946.mp3'),
    creator: 'f.anthony_shepherd',
    title: 'tweettweet.wav',
    license: 'CC0-1.0',
    source: 'https://freesound.org/people/f.anthony_shepherd/sounds/565946/',
    preview: 'https://cdn.freesound.org/previews/565/565946_12676589-hq.mp3'
  }
]);

export function createBirdRecordings(
  ctx,
  output,
  { recordings = BIRD_RECORDINGS, random = Math.random, fetchAudio = globalThis.fetch } = {}
) {
  const buffers = new Map(),
    live = new Set(),
    gains = new Map(recordings.map(item => [item.id, item.gain ?? 1]));
  const controller = new AbortController();
  let disposed = false,
    lastId = null,
    lastBucket = -1;
  const randomIndex = length => Math.min(length - 1, Math.max(0, Math.floor(random() * length)));
  const ready = Promise.all(
    recordings.map(async item => {
      try {
        const response = await fetchAudio(item.url, { signal: controller.signal });
        if (disposed || !response.ok) return false;
        const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
        if (disposed || !Number.isFinite(buffer.duration) || buffer.duration < 0.5) return false;
        buffers.set(item.id, buffer);
        return true;
      } catch {
        return false;
      }
    })
  ).then(values => values.some(Boolean));
  function choose() {
    if (disposed || !buffers.size) return null;
    const ids = [...buffers.keys()];
    const candidates = ids.length > 1 ? ids.filter(id => id !== lastId) : ids;
    const id = candidates[randomIndex(candidates.length)],
      buffer = buffers.get(id);
    const duration = buffer.duration <= 5 ? buffer.duration : 2.5 + Math.max(0, Math.min(1, random())) * 1.5;
    const available = Math.max(0, buffer.duration - duration);
    const count = Math.floor(available / 5) + 1;
    let buckets = Array.from({ length: count }, (_, i) => i);
    if (id === lastId && buckets.length > 1) buckets = buckets.filter(i => i !== lastBucket);
    const bucket = buckets[randomIndex(buckets.length)];
    const start = Math.min(
      available,
      bucket * 5 +
        Math.max(0, Math.min(1, random())) * Math.min(1, available - Math.min(available, bucket * 5))
    );
    lastId = id;
    lastBucket = bucket;
    return { id, offset: start, duration };
  }
  function play(event) {
    if (disposed || live.size >= 6 || !event || !Number.isFinite(event.at) || !Number.isFinite(event.level))
      return false;
    const phrase = event.phrase,
      buffer = buffers.get(phrase?.id);
    if (
      !buffer ||
      !Number.isFinite(phrase.offset) ||
      !Number.isFinite(phrase.duration) ||
      phrase.offset < 0 ||
      phrase.duration <= 0 ||
      phrase.offset + phrase.duration > buffer.duration
    )
      return false;
    const start = Math.max(event.at, ctx.currentTime + 0.05),
      source = ctx.createBufferSource(),
      gain = ctx.createGain();
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
    if (pan.pan) pan.pan.value = Math.max(-1, Math.min(1, Number.isFinite(event.pan) ? event.pan : 0));
    const level = Math.max(0, Math.min(1, event.level * (gains.get(phrase.id) ?? 1))),
      fade = Math.min(0.08, phrase.duration / 10);
    source.buffer = buffer;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(level, start + fade);
    gain.gain.setValueAtTime(level, start + phrase.duration - fade);
    gain.gain.linearRampToValueAtTime(0, start + phrase.duration);
    source.connect(gain);
    gain.connect(pan);
    pan.connect(output);
    const voice = { source, gain, pan };
    live.add(voice);
    const release = () => {
      source.disconnect();
      gain.disconnect();
      pan.disconnect();
      live.delete(voice);
    };
    source.onended = release;
    source.start(start, phrase.offset, phrase.duration);
    return true;
  }
  function stop() {
    for (const voice of live) {
      try {
        voice.source.stop();
      } catch {
        /* already stopped */
      }
      voice.source.disconnect();
      voice.gain.disconnect();
      voice.pan.disconnect();
      live.delete(voice);
    }
  }
  return {
    ready,
    choose,
    play,
    stop,
    dispose() {
      disposed = true;
      controller.abort();
      stop();
      buffers.clear();
    }
  };
}
