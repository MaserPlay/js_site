// One interaction for season and light. The selected tile always owns its ink
// and background; a moving indicator never determines whether text is readable.
export function bindSegmentedChoice(control, { getSelected, onSelect }) {
  const buttons = [...control.querySelectorAll('button')];
  let drag = null,
    suppress = false;
  const clear = () => {
    drag = null;
    control.style.removeProperty('--season-preview-index');
    control.classList.remove('is-dragging');
    buttons.forEach(b => b.classList.remove('drag-choice'));
  };
  const choose = index => {
    if (index !== getSelected()) onSelect(index);
  };
  control.addEventListener(
    'click',
    event => {
      if (suppress && event.detail !== 0) {
        suppress = false;
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      suppress = false;
      const index = buttons.indexOf(event.target.closest('button'));
      if (index >= 0) choose(index);
    },
    { capture: true }
  );
  control.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    suppress = false;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, index: getSelected(), active: false };
  });
  control.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x,
      dy = event.clientY - drag.y;
    if (!drag.active) {
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) {
        clear();
        return;
      }
      if (Math.abs(dx) < 7) return;
      drag.active = true;
      control.setPointerCapture(event.pointerId);
      control.classList.add('is-dragging');
    }
    event.preventDefault();
    const rect = control.getBoundingClientRect();
    drag.index = Math.max(
      0,
      Math.min(buttons.length - 1, Math.floor(((event.clientX - rect.left) / rect.width) * buttons.length))
    );
    const first = buttons[0].getBoundingClientRect(),
      last = buttons.at(-1).getBoundingClientRect(),
      start = first.left + first.width / 2,
      step = (last.left + last.width / 2 - start) / (buttons.length - 1);
    control.style.setProperty(
      '--season-preview-index',
      Math.max(0, Math.min(buttons.length - 1, (event.clientX - start) / step))
    );
    buttons.forEach((b, i) => b.classList.toggle('drag-choice', i === drag.index));
  });
  control.addEventListener('pointerup', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const { active, index } = drag;
    clear();
    if (active) {
      suppress = true;
      choose(index);
    }
  });
  control.addEventListener('pointercancel', () => {
    clear();
    suppress = false;
  });
  control.addEventListener('lostpointercapture', () => {
    if (drag) clear();
  });
  control.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const index =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? buttons.length - 1
          : Math.max(0, Math.min(buttons.length - 1, getSelected() + (event.key === 'ArrowRight' ? 1 : -1)));
    choose(index);
    buttons[index].focus();
  });
}
