// Adaptive resolution. Owner, 2026-10-30: on the RTX 5060 Ti nothing may stutter, and the garden should hold up
// while another program loads the GPU; phones and weak devices need the load spread too. When frames come late
// and the main thread is not what holds them up, the garden draws fewer pixels, one step at a time; once frames
// are on time again it steps back up. A step up that soon runs late again makes the next try wait twice as long.
// A step down after which frames come no sooner is undone: the device is held up by something other than pixels,
// and drawing fewer of them only blurs the picture (owner's iPhone 16 Pro Max, 2026-11-01: it stepped down to its
// lowest level for nothing; the Realme 11 Pro+ went from 39 to 48 between ×1.3 and ×1.1).
// Measured (round 22): next to a game-like GPU load, 2560×1440 ran at 45 fps (95th percentile frame 43 ms); the
// same view at 0.7 of the pixels ran at 66 fps (17 ms).
//
// levels: shares of the device's pixel ratio, best first; floor: lowest pixel ratio ever drawn; late: a frame
// later than late × the target interval counts as late; window: frames per verdict; down: share of late frames in
// a window that steps down; up: share at or below which a window is calm; calm: ms of calm windows before a step
// up, doubling after each step up that failed, up to calm[1]; fail: a step up that turns late within this many ms
// failed; settle: ms after a step before the next step down; pause: a longer interval is a pause (a hidden tab, a
// stalled load), not a late frame; busy: a window whose median main-thread time per frame exceeds busy × the
// target is held up by the CPU, and fewer pixels would not help; gain: a step down is judged by the first window
// that starts a settle after it, and undone unless its mean frame interval is below gain × the one that stepped
// down; hold: ms before the next step down after an undone one, doubling after each undone step, up to hold[1].
export const ADAPTIVE_RESOLUTION = Object.freeze({
  levels: Object.freeze([1, 0.8, 0.68, 0.56]),
  floor: 0.5,
  late: 1.4,
  window: 30,
  down: 0.15,
  up: 0.04,
  calm: Object.freeze([4000, 64000]),
  fail: 3000,
  settle: 1000,
  pause: 250,
  busy: 0.6,
  gain: 0.9,
  hold: Object.freeze([60000, 480000])
});

export function createAdaptiveResolution(options = ADAPTIVE_RESOLUTION) {
  const o = options;
  let level = 0,
    late = 0,
    frames = 0,
    spent = 0,
    windowFrom = 0,
    cpu = [],
    steppedAt = -Infinity,
    raisedAt = -Infinity,
    calmSince = null,
    calmNeed = o.calm[0],
    verdict = null,
    // The step down being judged: the level it left, that window's mean interval and when.
    trial = null,
    heldUntil = -Infinity,
    holdNeed = o.hold[0];
  const clear = () => {
    late = frames = spent = 0;
    cpu = [];
  };
  return {
    get scale() {
      return o.levels[level];
    },
    get level() {
      return level;
    },
    // The last window's verdict: share of late frames, mean interval and median main-thread ms (for the audit and
    // the meter).
    get verdict() {
      return verdict;
    },
    // One drawn frame: now (ms), the interval since the frame before, the interval the loop aims at and the
    // main-thread time its updates took. Returns the new scale when it changes, otherwise null.
    frame(now, interval, target, cpuMs = 0) {
      const judged = target > 0 && interval > 0 && interval <= o.pause;
      if (!judged) {
        clear();
        calmSince = null;
        trial = null;
        return null;
      }
      if (!frames) windowFrom = now - interval;
      frames++;
      spent += interval;
      if (interval > target * o.late) late++;
      cpu.push(cpuMs);
      if (frames < o.window) return null;
      const share = late / frames,
        mean = spent / frames,
        cpuMedian = cpu.sort((a, b) => a - b)[cpu.length >> 1],
        held = cpuMedian > target * o.busy;
      verdict = { at: now, share, mean, cpu: cpuMedian, target };
      clear();
      if (trial && windowFrom - trial.at >= o.settle) {
        const { from, mean: before } = trial;
        trial = null;
        // Frames no sooner with fewer pixels: back to where it was, and wait before trying again.
        if (mean > before * o.gain) {
          level = from;
          steppedAt = now;
          calmSince = null;
          heldUntil = now + holdNeed;
          holdNeed = Math.min(holdNeed * 2, o.hold[1]);
          return o.levels[level];
        }
        holdNeed = o.hold[0];
      }
      if (share >= o.down) {
        calmSince = null;
        if (held || trial || level >= o.levels.length - 1 || now - steppedAt < o.settle || now < heldUntil)
          return null;
        // A step up that runs late again soon: the next one waits twice as long.
        if (now - raisedAt < o.fail) calmNeed = Math.min(calmNeed * 2, o.calm[1]);
        trial = { from: level, mean, at: now };
        level++;
        steppedAt = now;
        return o.levels[level];
      }
      if (share > o.up) {
        calmSince = null;
        return null;
      }
      calmSince ??= now;
      // Long calm at the top level: the next try up is quick again.
      if (level === 0) {
        if (now - raisedAt > o.calm[1]) calmNeed = o.calm[0];
        return null;
      }
      if (now - calmSince < calmNeed) return null;
      level--;
      steppedAt = raisedAt = now;
      calmSince = null;
      return o.levels[level];
    },
    // Forget the current window and a step being judged (after a resize, a hidden tab, a rebuild); the level stays.
    reset() {
      clear();
      calmSince = null;
      trial = null;
    },
    // Back to full resolution at once (a benchmark, the option switched off).
    restore() {
      level = 0;
      clear();
      calmSince = null;
      calmNeed = o.calm[0];
      trial = null;
      heldUntil = -Infinity;
      holdNeed = o.hold[0];
      return o.levels[0];
    }
  };
}
