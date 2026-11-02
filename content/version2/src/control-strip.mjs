// Selection never launches travel. Touch scrolling stays native; mouse dragging
// scrolls the same rail and suppresses only the click produced by that drag.
export function bindChoiceStrip(strip, { getSelected, onSelect, isReduced = () => false }) {
  let drag = null,
    suppressClick = false;
  const buttons = () => [...strip.querySelectorAll('button[data-index]')];
  const sync = (reveal = false) => {
    const button = buttons()[getSelected()];
    if (!button || !button.offsetWidth) return;
    strip.style.setProperty('--choice-x', button.offsetLeft + 'px');
    strip.style.setProperty('--choice-y', (button.offsetTop || 0) + 'px');
    strip.style.setProperty('--choice-width', button.offsetWidth + 'px');
    strip.style.setProperty('--choice-height', button.offsetHeight + 'px');
    if (reveal)
      button.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: isReduced() ? 'auto' : 'smooth'
      });
  };
  const choose = index => {
    if (!buttons()[index]) return;
    if (index !== getSelected()) onSelect(index);
    sync(true);
  };
  strip.addEventListener('click', event => {
    if (suppressClick && event.detail !== 0) {
      suppressClick = false;
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    suppressClick = false;
    const button = event.target.closest('button[data-index]');
    if (button && strip.contains(button)) choose(Number(button.dataset.index));
  });
  strip.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const list = buttons();
    if (!list.length) return;
    const columns = list.filter(b => (b.offsetTop || 0) === (list[0].offsetTop || 0)).length;
    const step =
      event.key === 'ArrowDown'
        ? columns
        : event.key === 'ArrowUp'
          ? -columns
          : event.key === 'ArrowRight'
            ? 1
            : -1;
    const index =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? list.length - 1
          : Math.max(0, Math.min(list.length - 1, getSelected() + step));
    choose(index);
    list[index]?.focus({ preventScroll: true });
  });
  strip.addEventListener('pointerdown', event => {
    if (
      event.pointerType !== 'mouse' ||
      !event.isPrimary ||
      event.button !== 0 ||
      strip.scrollWidth <= strip.clientWidth
    )
      return;
    suppressClick = false;
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      scroll: strip.scrollLeft,
      active: false
    };
  });
  strip.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x,
      dy = event.clientY - drag.y;
    if (!drag.active) {
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) {
        drag = null;
        return;
      }
      if (Math.abs(dx) < 7) return;
      drag.active = true;
      strip.setPointerCapture(event.pointerId);
      strip.classList.add('is-dragging');
    }
    event.preventDefault();
    strip.scrollLeft = drag.scroll - dx;
  });
  strip.addEventListener('pointerup', event => {
    if (!drag || event.pointerId !== drag.id) return;
    suppressClick = drag.active;
    drag = null;
    strip.classList.remove('is-dragging');
  });
  const cancel = () => {
    drag = null;
    suppressClick = false;
    strip.classList.remove('is-dragging');
  };
  strip.addEventListener('pointercancel', cancel);
  strip.addEventListener('lostpointercapture', () => {
    if (drag) cancel();
  });
  strip.addEventListener('dragstart', event => event.preventDefault());
  return { sync };
}

// The light under the mouse: one delegated listener per group of floating controls writes --pointer-x/y on
// the control being hovered, so buttons other features add later (music, observatory) light up too.
const POINTER_KEYS = ['--pointer-x', '--pointer-y'];
const unit = value => Math.round(Math.min(1, Math.max(0, value)) * 100) + '%';
export function bindPointerLight(root, { selector = 'button,a,summary', isReduced = () => false } = {}) {
  let target = null,
    bounds = null;
  const clear = () => {
    if (target) for (const key of POINTER_KEYS) target.style.removeProperty(key);
    target = bounds = null;
  };
  root.addEventListener('pointermove', event => {
    const control = event.pointerType === 'mouse' && !isReduced() ? event.target?.closest?.(selector) : null;
    if (!control || !root.contains(control)) {
      clear();
      return;
    }
    // Measured once per control: the hover lift moves it by 2 px, which the light does not need to follow.
    if (control !== target) {
      clear();
      target = control;
      bounds = control.getBoundingClientRect();
    }
    control.style.setProperty('--pointer-x', unit((event.clientX - bounds.left) / (bounds.width || 1)));
    control.style.setProperty('--pointer-y', unit((event.clientY - bounds.top) / (bounds.height || 1)));
  });
  root.addEventListener('pointerleave', clear);
  return { clear };
}

// Language rows show a script glyph (the first two letters of the native name: "Ру", "En"); the browser
// language gets a globe instead. The glyph is decorative, so the row's accessible name stays the native name.
export function languageGlyph(value, name) {
  if (value === 'auto') return '';
  const letters = [...String(name || value || '').trim()].slice(0, 2);
  return letters.length ? letters[0].toLocaleUpperCase() + letters.slice(1).join('').toLocaleLowerCase() : '';
}
export function decorateLanguageOption(button, value, name) {
  const doc = button.ownerDocument,
    glyph = doc.createElement('span'),
    label = doc.createElement('span');
  glyph.className = 'picker-glyph' + (value === 'auto' ? ' is-auto' : '');
  glyph.setAttribute('aria-hidden', 'true');
  glyph.textContent = languageGlyph(value, name);
  label.className = 'picker-option-name';
  label.textContent = name;
  button.replaceChildren(glyph, label);
}

// Press-and-dive: the entry button keeps a short-lived class while the intro steps away, so its halo can
// ripple out into the scene. With reduced motion the intro simply hides.
export const ENTRY_DIVE_MS = 900;
export function bindEntryDive(button, { isReduced = () => false, duration = ENTRY_DIVE_MS } = {}) {
  let timer = 0;
  button.addEventListener('click', () => {
    if (isReduced() || button.disabled) return;
    clearTimeout(timer);
    button.classList.add('is-diving');
    timer = setTimeout(() => button.classList.remove('is-diving'), duration);
  });
}

// Gallery swipe: the picture follows a sideways finger (or mouse) and, past a distance or with a quick flick,
// the next one slides in from that side; otherwise it springs back. The whole viewer is the swipe surface,
// so leaving the small portrait picture mid-swipe no longer drops it. A mostly vertical move is left to the
// browser (touch-action: pan-y) and never changes the picture; a tap still opens the picture full screen.
export const GALLERY_SWIPE = {
  slop: 8,
  axis: 1.15,
  commit: 44,
  share: 0.2,
  flick: 0.35,
  flickMin: 18,
  window: 90,
  enter: 0.28,
  settle: 240
};
export function bindGalleryGesture(
  viewer,
  expand,
  { isActive, onChange, onDragged, isReduced = () => false }
) {
  let pointer = null;
  const picture = () => expand.querySelector?.('img') || null;
  const shift = x => {
    const img = picture();
    if (img) img.style.transform = x ? 'translateX(' + Math.round(x) + 'px)' : '';
  };
  // Eases the picture from `from` px to rest (a spring back, or the new picture arriving from the side).
  const settle = from => {
    const img = picture();
    shift(0);
    if (!img?.animate || isReduced() || !from) return;
    img.animate(
      [{ transform: 'translateX(' + Math.round(from) + 'px)', opacity: 0.6 }, { transform: 'none' }],
      {
        duration: GALLERY_SWIPE.settle,
        easing: 'cubic-bezier(.2,.8,.2,1)'
      }
    );
  };
  const end = () => {
    viewer.classList?.remove('is-swiping');
    pointer = null;
  };
  viewer.addEventListener('pointerdown', event => {
    if (
      !isActive() ||
      !event.isPrimary ||
      event.button !== 0 ||
      event.target?.closest?.('a,button:not(#gallery-expand),iframe,#gallery-controls')
    )
      return;
    viewer.focus?.({ preventScroll: true });
    pointer = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      width: viewer.getBoundingClientRect().width || 300,
      axis: '',
      dx: 0,
      samples: [[event.clientX, event.timeStamp || 0]]
    };
    onDragged(false);
  });
  viewer.addEventListener('pointermove', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x,
      dy = event.clientY - pointer.y;
    if (!pointer.axis) {
      if (Math.hypot(dx, dy) < GALLERY_SWIPE.slop) return;
      pointer.axis = Math.abs(dx) > Math.abs(dy) * GALLERY_SWIPE.axis ? 'x' : 'y';
      // Either way it is no longer a tap: the click that may follow must not open the picture.
      onDragged(true);
      if (pointer.axis === 'y') return;
      viewer.classList?.add('is-swiping');
      // Capture only now, so a plain tap keeps its click on the picture. It can fail for a synthetic or
      // already released pointer; the swipe works without it.
      try {
        viewer.setPointerCapture(event.pointerId);
      } catch {}
    }
    if (pointer.axis !== 'x') return;
    event.preventDefault?.();
    const time = event.timeStamp || 0;
    pointer.samples.push([event.clientX, time]);
    while (pointer.samples.length > 2 && time - pointer.samples[0][1] > GALLERY_SWIPE.window)
      pointer.samples.shift();
    pointer.dx = dx;
    shift(dx);
  });
  const up = event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const p = pointer;
    end();
    if (p.axis !== 'x') return;
    const dx = event.clientX - p.x,
      [x0, t0] = p.samples[0],
      speed = (event.clientX - x0) / Math.max(16, (event.timeStamp || 0) - t0),
      far = Math.abs(dx) >= Math.min(GALLERY_SWIPE.commit, p.width * GALLERY_SWIPE.share),
      flick =
        Math.abs(speed) >= GALLERY_SWIPE.flick &&
        Math.abs(dx) >= GALLERY_SWIPE.flickMin &&
        Math.sign(speed) === Math.sign(dx);
    if (!isActive() || !(far || flick)) return settle(dx);
    const before = picture()?.getAttribute?.('src');
    // Finger to the left shows the next picture, entering from the right.
    const direction = dx < 0 ? 1 : -1;
    onChange(direction);
    const changed = picture()?.getAttribute?.('src') !== before;
    settle(changed ? direction * p.width * GALLERY_SWIPE.enter : dx);
  };
  viewer.addEventListener('pointerup', up);
  // Capture can fail (or be refused); a finger lifted outside the viewer still ends the swipe.
  viewer.ownerDocument?.addEventListener('pointerup', up);
  const cancel = () => {
    if (!pointer) return;
    const back = pointer.axis === 'x' ? pointer.dx : 0;
    if (pointer.axis) onDragged(true);
    end();
    if (back) settle(back);
  };
  viewer.addEventListener('pointercancel', cancel);
  viewer.addEventListener('lostpointercapture', cancel);
  viewer.addEventListener('dragstart', event => event.preventDefault());
}
// Clean overview (owner, M18): `stir()` marks camera motion (onChange(true)) and the mark clears once the camera
// has rested `calm` ms. stir() may run every frame: it only moves a deadline, and one timer at a time checks it.
export function createStirWatch(
  onChange,
  calm = 650,
  { now = () => performance.now(), setTimer = setTimeout } = {}
) {
  let until = 0,
    timer = 0,
    on = false;
  const check = () => {
    const left = until - now();
    if (left > 16) {
      timer = setTimer(check, left);
      return;
    }
    timer = 0;
    on = false;
    onChange(false);
  };
  return {
    stir() {
      until = now() + calm;
      if (!on) {
        on = true;
        onChange(true);
      }
      if (!timer) timer = setTimer(check, calm);
    },
    // A reset of the view ends the mark at the next check instead of after a full rest.
    settle() {
      until = 0;
    },
    get active() {
      return on;
    }
  };
}
