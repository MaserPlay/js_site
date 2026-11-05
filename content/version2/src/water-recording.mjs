// CC0 field recording: jusufa, "Waterfall Small with Water Stream" (Freesound 200276).
import { gardenFile } from './garden-paths.mjs';
export const WATER_RECORDING = gardenFile('audio/jusufa-200276.mp3');
// Original preview RMS 0.0081, peak 0.0906; 8x retains headroom before the proximity gain.
export const WATER_RECORDING_GAIN = 8;
export function crossfadeWaterLoop(ctx, input, seconds = 2) {
  // The recording fades at its ends; use its steady interior before joining it.
  const head = Math.round(1.5 * input.sampleRate),
    tail = Math.round(2.5 * input.sampleRate);
  const usable = input.length - head - tail;
  const fade = Math.min(Math.round(seconds * input.sampleRate), Math.floor(usable / 3));
  if (fade < 1 || usable < input.sampleRate * 2) throw new Error('Water recording too short');
  const length = usable - fade;
  const output = ctx.createBuffer(input.numberOfChannels, length, input.sampleRate);
  for (let channel = 0; channel < input.numberOfChannels; channel++) {
    const original = input.getChannelData(channel),
      data = output.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      if (i < fade) {
        const angle = ((i / fade) * Math.PI) / 2;
        data[i] = original[head + length + i] * Math.cos(angle) + original[head + i] * Math.sin(angle);
      } else data[i] = original[head + i];
    }
  }
  return output;
}
export function createWaterRecording(ctx, output, fetchAudio = globalThis.fetch) {
  const controller = new AbortController();
  let disposed = false,
    source = null,
    gate = null;
  const ready = Promise.resolve()
    .then(async () => {
      if (!fetchAudio || disposed) return false;
      const response = await fetchAudio(WATER_RECORDING, { signal: controller.signal });
      if (!response.ok) return false;
      const bytes = await response.arrayBuffer();
      if (disposed) return false;
      const decoded = await ctx.decodeAudioData(bytes);
      if (disposed) return false;
      const buffer = crossfadeWaterLoop(ctx, decoded);
      if (disposed) return false;
      source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      gate = ctx.createGain();
      gate.gain.setValueAtTime(0, ctx.currentTime);
      gate.gain.linearRampToValueAtTime(WATER_RECORDING_GAIN, ctx.currentTime + 0.15);
      source.connect(gate);
      gate.connect(output);
      source.start();
      return true;
    })
    .catch(() => false);
  return {
    ready,
    dispose() {
      if (disposed) return;
      disposed = true;
      controller.abort();
      if (source) {
        try {
          source.stop();
        } catch {
          /* Already stopped. */
        }
        source.disconnect();
        gate.disconnect();
        source = null;
        gate = null;
      }
    }
  };
}
