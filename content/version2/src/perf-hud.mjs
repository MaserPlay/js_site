// ?perf=1: a small on-screen meter for checking a real phone. While it is shown the render loop keeps running,
// so the numbers measure what the device can do, not the idle redraw rate: frames per second, the CPU time of a
// frame (median of the last second), draw calls, triangles, the render scale and whether the glow pass is on.
export function perfEnabled(search = '') {
  return new URLSearchParams(search).get('perf') === '1';
}

export function summarize(frames, cpu) {
  const sorted = [...cpu].sort((a, b) => a - b);
  return {
    fps: frames.length > 1 ? (1000 * (frames.length - 1)) / (frames.at(-1) - frames[0]) : 0,
    cpu: sorted.length ? sorted[sorted.length >> 1] : 0
  };
}

export function createPerfHud(document) {
  const box = document.createElement('div');
  box.id = 'perf-hud';
  box.setAttribute('aria-hidden', 'true');
  Object.assign(box.style, {
    position: 'fixed',
    top: '8px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: '60',
    padding: '4px 10px',
    borderRadius: '8px',
    background: '#0d0a18cc',
    color: '#e9e2ff',
    font: '12px/1.4 ui-monospace, monospace',
    pointerEvents: 'none',
    whiteSpace: 'nowrap'
  });
  document.body.append(box);
  const frames = [],
    cpu = [];
  let shown = 0;
  return {
    tick(now, cpuMs, { calls = 0, triangles = 0 } = {}, ratio = 1, glow = false) {
      frames.push(now);
      cpu.push(cpuMs);
      while (frames.length && now - frames[0] > 1000) frames.shift();
      while (cpu.length > frames.length) cpu.shift();
      if (now - shown < 500) return;
      shown = now;
      const { fps, cpu: median } = summarize(frames, cpu);
      box.textContent =
        `${fps.toFixed(0)} fps · CPU ${median.toFixed(1)} ms · ${calls} draws · ` +
        `${Math.round(triangles / 1000)}K tris · ×${ratio.toFixed(2)}${glow ? ' · glow' : ''}`;
      box.dataset.fps = fps.toFixed(1);
    },
    dispose() {
      box.remove();
    }
  };
}
