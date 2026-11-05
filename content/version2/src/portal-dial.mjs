// The portal chooser as a rune dial: destination sigils float round a ring (the garden overview at the
// bottom, the projects counter-clockwise from it), the selected one glows in its accent and a beam points at it.
// The ring can be grabbed and turned (mouse, touch, pen): it follows the pointer's angle, the sigil passing
// the beam is chosen live, a flick coasts and the ring settles softly on the nearest sigil. Turning it
// clockwise brings the next sigils to the beam, counter-clockwise the previous ones.
// «Перейти» charges on press-and-hold or click and only a full charge travels. On a phone the same sigils
// form a swipeable row in a bottom sheet (CSS); the sigil that settles in the middle is selected, and the
// small preview dial can be turned the same way.
// Selection never travels; keys: arrows step round the dial, Home/End jump, Enter/Space on «Перейти» charges.
export const DIAL = {
  // Radius of the sigil orbit (px, matches --dial-radius in garden-ui-panels.css).
  radius: 128,
  sigil: [40, 56],
  // Charge time from empty: a click finishes on its own, holding fills a little slower under the finger.
  clickMs: 620,
  holdMs: 1000,
  // A swipe on the phone row selects once scrolling has rested this long.
  settleMs: 140,
  // Turning the ring: travel (px) before a press becomes a drag; below it the press stays a tap.
  dragPx: 6,
  // Near the pivot the pointer angle jumps wildly: inside this share of its radius the ring holds still.
  deadZone: 0.16,
  // While turning, the preview text and the gate's tint follow the live sigil at most this often (ms).
  previewMs: 110,
  // A pointer resting longer than this before release lets go without a flick (ms).
  restMs: 80,
  // Flick: top speed (deg/ms), coast decay time constant (ms), and the speed where the snap takes over.
  // The hardest flick coasts about flickMax * flickTau degrees (under a turn), so a sigil stays in reach.
  flickMax: 0.9,
  flickTau: 240,
  flickMin: 0.09,
  // Soft snap: a critically damped spring onto the nearest sigil (natural period scale, ms).
  snapTau: 62
};

// Dial angles (CSS degrees, clockwise from 3 o'clock): slot 0 (the overview) at the bottom, then evenly
// counter-clockwise, so a clockwise turn of the ring brings the next slot to the beam.
export function dialAngles(count) {
  const slots = Math.max(1, count);
  return Array.from({ length: slots }, (_, k) => (((90 - (360 * k) / slots) % 360) + 360) % 360);
}
// Sigil diameter that keeps a gap between neighbours on the orbit.
export function sigilSize(count, radius = DIAL.radius) {
  const room = ((2 * Math.PI * radius) / Math.max(1, count)) * 0.66;
  return Math.round(Math.min(DIAL.sigil[1], Math.max(DIAL.sigil[0], room)));
}
// Arrow keys step round the dial with wrap; Home/End go to the first and last project (slot 0 is the overview).
export function stepSlot(slot, key, count) {
  if (count < 1) return slot;
  if (key === 'Home') return Math.min(1, count - 1);
  if (key === 'End') return count - 1;
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[key];
  return step ? (((slot + step) % count) + count) % count : slot;
}
// An angle difference folded into [-180, 180).
export function wrapDeg(delta) {
  return ((((delta + 180) % 360) + 360) % 360) - 180;
}
// Shortest turn from one dial angle to another, so the beam never spins the long way round.
export function turnTo(from, to) {
  return from + wrapDeg(to - from);
}
// The slot whose sigil sits nearest the beam at `mark` once the ring is turned by `turn` degrees.
export function slotAt(mark, turn, count) {
  if (count < 1) return 0;
  const k = Math.round(((90 + turn - mark) * count) / 360);
  return ((k % count) + count) % count;
}
// The ring turn closest to `turn` that puts `slot` exactly on the beam.
export function snapTurn(turn, mark, slot, count) {
  return turn + wrapDeg(mark - (dialAngles(count)[slot] + turn));
}
// One frame of charge: holding fills at the hold rate, a released press or a click finishes at the click rate.
export function chargeStep(level, dtMs, holding) {
  return Math.min(1, level + dtMs / (holding ? DIAL.holdMs : DIAL.clickMs));
}

export function createPortalDial({
  dialog,
  sigils,
  go,
  getSelected,
  onSelect,
  onCharge = () => {},
  onFire = () => {},
  isReduced = () => false,
  isCompact = () => false,
  dock = null,
  ring = sigils.parentElement,
  win = globalThis
}) {
  let beam = 90,
    turn = 0,
    charge = null,
    settleTimer = 0,
    // A press on the ring that has not moved far enough to be a drag (a tap stays a click).
    press = null,
    // The ring while it is dragged, coasts or snaps: { mark, live, angle, at, v, phase, raf, last }.
    spin = null,
    previewTimer = 0,
    lastPreview = -Infinity,
    swallowUntil = 0,
    // The press on «Перейти» while it is down (a pointer id, or the code of a key), and the one a fire used up:
    // { id, up } (see fire()).
    held = null,
    spent = null;
  const now = () => win.performance?.now?.() ?? Date.now();
  const buttons = () => [...sigils.querySelectorAll('button[data-slot]')];
  const paintTurn = () => {
    const list = buttons(),
      angles = dialAngles(list.length);
    list.forEach((button, k) => button.style.setProperty('--a', angles[k] + turn + 'deg'));
    dialog.style.setProperty('--spin', turn + 'deg');
  };
  const layout = () => {
    paintTurn();
    dialog.style.setProperty('--sigil', sigilSize(buttons().length) + 'px');
  };
  const sync = (reveal = false) => {
    const list = buttons(),
      slot = spin ? spin.live : getSelected(),
      chosen = list[slot];
    list.forEach((button, k) => {
      const on = k === slot;
      button.classList.toggle('selected', on);
      button.setAttribute('aria-pressed', String(on));
      button.tabIndex = on ? 0 : -1;
    });
    if (!chosen) return;
    // While the ring turns the beam is the fixed selection mark; otherwise it swings to the chosen sigil.
    if (!spin) {
      beam = turnTo(beam, dialAngles(list.length)[slot] + turn);
      dialog.style.setProperty('--beam', beam + 'deg');
    }
    dialog.style.setProperty('--accent', chosen.dataset.accent || '#b9a2ff');
    if (dock && isCompact()) {
      const top = dock.getBoundingClientRect().top;
      if (top > 0) dialog.style.setProperty('--sheet-bottom', Math.round(win.innerHeight - top + 8) + 'px');
    }
    if (reveal && isCompact() && sigils.scrollWidth > sigils.clientWidth)
      sigils.scrollTo({
        left: chosen.offsetLeft + chosen.offsetWidth / 2 - sigils.clientWidth / 2,
        behavior: isReduced() ? 'auto' : 'smooth'
      });
  };
  const choose = (slot, reveal = true) => {
    halt();
    if (!buttons()[slot]) return;
    if (slot !== getSelected()) onSelect(slot);
    sync(reveal);
  };
  sigils.addEventListener('click', event => {
    // The click that ends a drag is not a tap on the sigil under the pointer.
    if (now() < swallowUntil) {
      event.stopPropagation?.();
      return;
    }
    const button = event.target.closest('button[data-slot]');
    if (button && sigils.contains(button)) choose(Number(button.dataset.slot));
  });
  sigils.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const slot = stepSlot(getSelected(), event.key, buttons().length);
    choose(slot);
    buttons()[slot]?.focus({ preventScroll: true });
  });
  // Phone row: whichever sigil rests nearest the middle after a swipe is the selection.
  sigils.addEventListener(
    'scroll',
    () => {
      if (!isCompact()) return;
      win.clearTimeout(settleTimer);
      settleTimer = win.setTimeout(() => {
        if (spin) return;
        const middle = sigils.scrollLeft + sigils.clientWidth / 2;
        let best = -1,
          distance = Infinity;
        buttons().forEach((button, k) => {
          const d = Math.abs(button.offsetLeft + button.offsetWidth / 2 - middle);
          if (d < distance) {
            distance = d;
            best = k;
          }
        });
        if (best >= 0 && best !== getSelected()) choose(best, false);
      }, DIAL.settleMs);
    },
    { passive: true }
  );

  // ---- turning the ring ----
  // Desktop turns round the dial; on the phone the ring is hidden and the small preview dial is the pivot.
  const pivot = () => (isCompact() ? ring?.querySelector?.('.rune-core') : ring);
  const angleOf = event => {
    const box = pivot()?.getBoundingClientRect?.();
    if (!box || !box.width) return null;
    const dx = event.clientX - (box.left + box.width / 2),
      dy = event.clientY - (box.top + box.height / 2);
    if (Math.hypot(dx, dy) < (Math.min(box.width, box.height) / 2) * DIAL.deadZone) return null;
    return (Math.atan2(dy, dx) * 180) / Math.PI;
  };
  // The live sigil follows the geometry every frame; the preview and world tint follow it throttled.
  const flushPreview = () => {
    win.clearTimeout(previewTimer);
    previewTimer = 0;
    lastPreview = now();
    if (spin && spin.live !== getSelected()) onSelect(spin.live);
  };
  const track = () => {
    paintTurn();
    const slot = slotAt(spin.mark, turn, buttons().length);
    if (slot === spin.live) return;
    spin.live = slot;
    sync(isCompact());
    if (!previewTimer)
      previewTimer = win.setTimeout(flushPreview, Math.max(0, lastPreview + DIAL.previewMs - now()));
  };
  const finish = () => {
    if (!spin) return;
    win.cancelAnimationFrame(spin.raf);
    win.clearTimeout(previewTimer);
    previewTimer = 0;
    const slot = spin.live;
    spin = null;
    dialog.classList.toggle('is-spinning', false);
    if (slot !== getSelected()) onSelect(slot);
    sync(isCompact());
  };
  // Put the live sigil on the beam at once (reduced motion, a key or a tap during a coast, closing).
  const halt = () => {
    if (!spin) return;
    turn = snapTurn(turn, spin.mark, spin.live, buttons().length);
    paintTurn();
    finish();
  };
  const motion = time => {
    if (!spin) return;
    const dt = spin.last === null ? 16 : Math.min(48, Math.max(0, time - spin.last));
    spin.last = time;
    const count = buttons().length;
    if (spin.phase === 'coast') {
      turn += spin.v * dt;
      spin.v *= Math.exp(-dt / DIAL.flickTau);
      if (Math.abs(spin.v) < DIAL.flickMin) spin.phase = 'snap';
    }
    if (spin.phase === 'snap') {
      // Aim at the sigil the remaining speed would carry to, so the ring never jerks back against it.
      const ahead = slotAt(spin.mark, turn + spin.v * DIAL.snapTau, count),
        target = snapTurn(turn, spin.mark, ahead, count),
        w = 1 / DIAL.snapTau;
      for (let left = dt; left > 0; left -= 8) {
        const h = Math.min(8, left);
        spin.v += (-w * w * (turn - target) - 2 * w * spin.v) * h;
        turn += spin.v * h;
      }
      if (Math.abs(target - turn) < 0.08 && Math.abs(spin.v) < 0.004) {
        turn = target;
        track();
        finish();
        return;
      }
    }
    track();
    spin.raf = win.requestAnimationFrame(motion);
  };
  const letGo = (flick = true) => {
    if (!spin || spin.phase !== 'drag') return;
    swallowUntil = now() + 350;
    if (!flick || now() - spin.at > DIAL.restMs) spin.v = 0;
    if (isReduced()) {
      halt();
      return;
    }
    spin.phase = Math.abs(spin.v) >= DIAL.flickMin ? 'coast' : 'snap';
    spin.last = null;
    spin.raf = win.requestAnimationFrame(motion);
  };
  const grab = event => {
    const angle = angleOf(event);
    if (spin) win.cancelAnimationFrame(spin.raf);
    // Catching a coasting ring keeps its mark; a fresh grab marks wherever the beam points now.
    spin = spin
      ? Object.assign(spin, { angle, at: now(), v: 0, phase: 'drag' })
      : { mark: beam, live: getSelected(), angle, at: now(), v: 0, phase: 'drag', raf: 0, last: null };
    // Capture keeps the turn going outside the dial; a pointer the browser no longer tracks just skips it.
    try {
      ring.setPointerCapture?.(event.pointerId);
    } catch {
      /* not an active pointer */
    }
    dialog.classList.toggle('is-spinning', true);
  };
  if (ring) {
    ring.addEventListener('pointerdown', event => {
      if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
      if (buttons().length < 2) return;
      if (isCompact() && !event.target?.closest?.('.rune-core')) return;
      press = { id: event.pointerId, x: event.clientX, y: event.clientY, angle: angleOf(event) };
      // A press on a ring still in motion catches it straight away.
      if (spin) {
        grab(event);
        spin.angle = press.angle;
      }
    });
    ring.addEventListener('pointermove', event => {
      if (!press || event.pointerId !== press.id) return;
      if (!spin || spin.phase !== 'drag') {
        if (Math.hypot(event.clientX - press.x, event.clientY - press.y) < DIAL.dragPx) return;
        grab(event);
        spin.angle = press.angle;
      }
      event.preventDefault?.();
      const angle = angleOf(event);
      if (angle === null) {
        spin.angle = null;
        return;
      }
      if (spin.angle !== null) {
        const delta = wrapDeg(angle - spin.angle),
          time = now(),
          rate = delta / Math.max(1, time - spin.at);
        turn += delta;
        // Smoothed release speed, capped so a jittery flick cannot whirl the ring.
        spin.v = Math.max(-DIAL.flickMax, Math.min(DIAL.flickMax, spin.v * 0.5 + rate * 0.5));
        spin.at = time;
        track();
      }
      spin.angle = angle;
    });
    const up = flick => event => {
      if (!press || event.pointerId !== press.id) return;
      press = null;
      letGo(flick);
    };
    ring.addEventListener('pointerup', up(true));
    ring.addEventListener('pointercancel', up(false));
    ring.addEventListener('lostpointercapture', up(true));
  }

  // ---- charge ----
  const paint = level => {
    dialog.style.setProperty('--charge', level.toFixed(3));
    dialog.classList.toggle('is-charging', level > 0);
    onCharge(level);
  };
  // One press, one crossing (owner, round 3: one crossing sometimes played twice). A press still down when its
  // charge fires is spent: the click its release sends (to this button, hidden by then, or to whatever the closed
  // dialog uncovers under a finger) and the repeats of a held key start nothing, however long it is held.
  const fire = () => {
    spent = held === null ? null : { id: held, up: false };
    held = null;
    onFire();
  };
  const frame = now => {
    if (!charge) return;
    const dt = charge.last === null ? 0 : Math.min(100, Math.max(0, now - charge.last));
    charge.last = now;
    charge.level = chargeStep(charge.level, dt, charge.holding);
    paint(charge.level);
    if (charge.level >= 1) {
      charge = null;
      paint(0);
      fire();
      return;
    }
    charge.raf = win.requestAnimationFrame(frame);
  };
  const start = holding => {
    if (go.disabled) return;
    // A charge always goes to the sigil on the beam, never to one still passing it.
    halt();
    if (isReduced()) {
      fire();
      return;
    }
    if (charge) {
      charge.holding &&= holding;
      return;
    }
    charge = { level: 0, holding, last: null, raf: 0 };
    charge.raf = win.requestAnimationFrame(frame);
  };
  const release = event => {
    if (charge) charge.holding = false;
    if (held === event.pointerId) held = null;
    if (spent?.id === event.pointerId) spent.up = true;
  };
  const cancel = () => {
    press = null;
    halt();
    if (!charge) return;
    win.cancelAnimationFrame(charge.raf);
    charge = null;
    paint(0);
  };
  go.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary || go.disabled || isReduced()) return;
    go.setPointerCapture?.(event.pointerId);
    held = event.pointerId;
    start(true);
  });
  go.addEventListener('pointerup', release);
  go.addEventListener('lostpointercapture', release);
  go.addEventListener('pointercancel', event => {
    release(event);
    cancel();
  });
  go.addEventListener('keydown', event => {
    if (!event.repeat && (event.key === 'Enter' || event.key === ' ')) held = event.code;
  });
  // Keyboard and plain clicks: a click after our own pointerdown is already charging and is ignored by start().
  go.addEventListener('click', () => start(false));
  // A spent press, wherever its events land (the window, ahead of everything else). Only clicks a pointer sends
  // (detail > 0) are a release: keyboard and scripted clicks pass, and the next press ends a release missed.
  win.addEventListener(
    'click',
    event => {
      if (!spent?.up || !event.detail) return;
      spent = null;
      event.preventDefault();
      event.stopPropagation();
    },
    true
  );
  win.addEventListener(
    'pointerdown',
    () => {
      if (spent?.up) spent = null;
    },
    true
  );
  win.addEventListener(
    'keydown',
    event => {
      if (spent?.id !== event.code) return;
      event.preventDefault();
      event.stopPropagation();
    },
    true
  );
  win.addEventListener(
    'keyup',
    event => {
      if (held === event.code) held = null;
      if (spent?.id === event.code) spent = null;
    },
    true
  );
  win.addEventListener('blur', () => {
    held = spent = null;
  });
  return {
    layout,
    sync,
    choose,
    cancel,
    get charging() {
      return !!charge;
    },
    get level() {
      return charge ? charge.level : 0;
    },
    get turn() {
      return turn;
    },
    get spinning() {
      return !!spin;
    }
  };
}
