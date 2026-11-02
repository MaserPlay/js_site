// Opt-in diagnostic. CPU submission and GPU elapsed time are distinct from presented FPS.
export function createFrameProbe(renderer) {
  const gl = renderer.getContext(),
    pending = [],
    samples = [];
  let extension = gl.getExtension('EXT_disjoint_timer_query_webgl2'),
    active = null,
    frames = 0,
    disjoint = 0,
    disposed = false;
  function poll() {
    if (!extension) return;
    if (gl.getParameter(extension.GPU_DISJOINT_EXT)) {
      disjoint++;
      for (const q of pending) gl.deleteQuery(q);
      pending.length = 0;
      return;
    }
    while (pending.length && gl.getQueryParameter(pending[0], gl.QUERY_RESULT_AVAILABLE)) {
      const q = pending.shift(),
        ns = gl.getQueryParameter(q, gl.QUERY_RESULT);
      gl.deleteQuery(q);
      samples.push(ns / 1e6);
      if (samples.length > 180) samples.shift();
    }
  }
  return {
    begin() {
      if (disposed || gl.isContextLost()) return;
      poll();
      if (extension && ++frames % 3 === 0 && pending.length < 4) {
        active = gl.createQuery();
        gl.beginQuery(extension.TIME_ELAPSED_EXT, active);
      }
    },
    end() {
      if (active) {
        gl.endQuery(extension.TIME_ELAPSED_EXT);
        pending.push(active);
        active = null;
      }
    },
    lost() {
      pending.length = 0;
      active = null;
      samples.length = 0;
      extension = null;
    },
    restored() {
      extension = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    },
    snapshot() {
      return {
        gpuSupported: !!extension,
        gpuMs: samples.slice(),
        gpuDisjointEvents: disjoint,
        heap: performance.memory
          ? {
              used: performance.memory.usedJSHeapSize,
              total: performance.memory.totalJSHeapSize,
              limit: performance.memory.jsHeapSizeLimit
            }
          : null,
        note: 'GPU elapsed when extension available; CPU timing separately; neither is presentation or handset FPS'
      };
    },
    dispose() {
      disposed = true;
      if (!gl.isContextLost()) {
        if (active) {
          gl.endQuery(extension.TIME_ELAPSED_EXT);
          gl.deleteQuery(active);
        }
        pending.forEach(q => gl.deleteQuery(q));
      }
      active = null;
      pending.length = 0;
    }
  };
}
