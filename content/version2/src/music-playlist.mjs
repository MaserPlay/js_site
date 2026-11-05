// The calm playlist: pieces play one after another (the first one is always the original theme), then in a
// shuffled order that never repeats a piece back to back, and it loops forever. Neighbouring pieces overlap by a
// few seconds with an equal-power crossfade, so there is no gap and no change of loudness.
// The playlist owns one `bus` (the music layer fade, as the single voice bank had before) and one gain per piece.
// A piece is { id, title, length?, create(ctx, random, output) -> { voices, catchUp(time), planUntil(horizon, limit) } }.

export const PLAYLIST = {
  crossfade: 7,
  minSeconds: 150,
  maxSeconds: 190,
  curvePoints: 64
};

const between = (random, min, max) => min + (max - min) * random();

// Piece order: `first` once, then shuffled rounds (or the plain order); a round never starts with the piece just heard.
export function createOrder(count, { mode = 'shuffle', random = Math.random, first = 0 } = {}) {
  let bag = [],
    last = -1,
    started = false;
  const refill = skipFirst => {
    const list = Array.from({ length: count }, (_, i) => i).filter(i => !(skipFirst && i === first));
    if (mode === 'shuffle') {
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
      if (list.length > 1 && list[0] === last) [list[0], list[1]] = [list[1], list[0]];
    }
    bag = list;
  };
  return {
    next() {
      if (count === 1) return 0;
      if (!started) {
        started = true;
        last = first;
        refill(true);
        return first;
      }
      if (!bag.length) refill(false);
      last = bag.shift();
      return last;
    }
  };
}

// Equal-power fade curve: the sum of the two pieces keeps the loudness of one.
export function fadeCurve(rising, points = PLAYLIST.curvePoints) {
  const curve = new Float32Array(points);
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1);
    curve[i] = rising ? Math.sin((t * Math.PI) / 2) : Math.cos((t * Math.PI) / 2);
  }
  return curve;
}

function shape(param, rising, start, seconds) {
  if (param.setValueCurveAtTime) param.setValueCurveAtTime(fadeCurve(rising), start, seconds);
  else {
    param.setValueAtTime(rising ? 0 : 1, start);
    param.linearRampToValueAtTime(rising ? 1 : 0, start + seconds);
  }
}

// Level of a linear ramp at `time` (AudioParam.value does not report automation everywhere).
function rampLevel(ramp, time) {
  if (time >= ramp.end) return ramp.to;
  if (time <= ramp.start) return ramp.from;
  return ramp.from + ((ramp.to - ramp.from) * (time - ramp.start)) / (ramp.end - ramp.start);
}

export function createPlaylist(ctx, pieces, random = Math.random, output = ctx.destination, options = {}) {
  const { mode = 'shuffle', crossfade = PLAYLIST.crossfade } = options;
  const order = createOrder(pieces.length, { mode, random, first: 0 });
  const bus = ctx.createGain();
  bus.gain.value = 0;
  bus.connect(output);
  let ramp = { from: 0, to: 0, start: 0, end: 0 },
    current = null,
    outgoing = [],
    played = 0;

  const begin = (index, at, fadeIn) => {
    const piece = pieces[index],
      slot = ctx.createGain(),
      length = Math.max(
        crossfade * 2.5,
        piece.length ?? between(random, PLAYLIST.minSeconds, PLAYLIST.maxSeconds)
      );
    slot.gain.value = fadeIn ? 0 : 1;
    slot.connect(bus);
    if (fadeIn) shape(slot.gain, true, at, crossfade);
    const made = piece.create(ctx, random, slot);
    made.catchUp(at);
    played++;
    return {
      index,
      id: piece.id,
      slot,
      ...made,
      start: at,
      fadeStart: at + length - crossfade,
      dead: Infinity
    };
  };
  const transition = now => {
    const old = current,
      at = Math.max(now, old.fadeStart) + 0.05;
    shape(old.slot.gain, false, at, crossfade);
    old.dead = at + crossfade + 0.5;
    outgoing.push(old);
    current = begin(order.next(), at, true);
  };
  const retire = now => {
    outgoing = outgoing.filter(p => {
      if (now < p.dead) return true;
      p.slot.disconnect();
      p.voices.dispose?.();
      return false;
    });
  };

  return {
    bus,
    // The layer fade (music on or off), from the level that is playing now.
    fade(value, seconds) {
      const now = ctx.currentTime,
        from = rampLevel(ramp, now);
      bus.gain.cancelScheduledValues(now);
      bus.gain.setValueAtTime(from, now);
      bus.gain.linearRampToValueAtTime(value, now + seconds);
      ramp = { from, to: value, start: now, end: now + seconds };
    },
    level: () => rampLevel(ramp, ctx.currentTime),
    // After a silence the current piece continues from `time` (or hands over at the next tick if it is already over).
    catchUp(time) {
      current?.catchUp(time);
    },
    // Plays the notes that start before `horizon`; starts the next piece when the current one reaches its crossfade.
    tick(now, horizon) {
      current ??= begin(order.next(), now, false);
      if (now >= current.fadeStart) transition(now);
      for (const piece of [current, ...outgoing])
        for (const event of piece.planUntil(horizon, piece.fadeStart)) piece.voices.play(event);
      retire(now);
    },
    get state() {
      return {
        current: current?.id ?? null,
        index: current?.index ?? -1,
        start: current?.start ?? 0,
        fadeStart: current?.fadeStart ?? 0,
        outgoing: outgoing.map(p => p.id),
        played
      };
    },
    dispose() {
      for (const piece of [current, ...outgoing]) piece?.voices.dispose?.();
      bus.disconnect();
    }
  };
}
