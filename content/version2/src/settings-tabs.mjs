// Settings sections (owner, M18: «Звук», «Внешний вид», «Управление»… — no long flat list). A tab row picks
// one section; the others are hidden, so the desktop sheet and the phone bottom sheet stay short.
// Keyboard follows the ARIA tabs pattern: arrows, Home and End move and select, focus stays on the tab row.

export const SETTINGS_TAB_KEY = 'garden-settings-tab';

export function bindSettingsTabs(
  list,
  { doc = list?.ownerDocument, storage = null, onChange = () => {} } = {}
) {
  if (!list || !doc) return null;
  const tabs = [...list.querySelectorAll('[role="tab"]')],
    panels = tabs.map(tab => doc.getElementById(tab.getAttribute('aria-controls')));
  if (!tabs.length || panels.some(panel => !panel)) return null;
  let selected = 0;
  const select = (index, { focus = false, save = true } = {}) => {
    selected = Math.max(0, Math.min(tabs.length - 1, index));
    tabs.forEach((tab, i) => {
      const on = i === selected;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      panels[i].hidden = !on;
    });
    list.dataset.section = tabs[selected].dataset.section || String(selected);
    if (focus) tabs[selected].focus();
    if (save)
      try {
        storage?.setItem(SETTINGS_TAB_KEY, list.dataset.section);
      } catch {}
    onChange(list.dataset.section);
  };
  // Shows the section that holds `element` (for a control another feature focuses).
  const reveal = element => {
    const index = panels.findIndex(panel => panel.contains(element));
    if (index >= 0 && index !== selected) select(index);
  };
  const onClick = event => {
    const index = tabs.indexOf(event.target.closest?.('[role="tab"]'));
    if (index >= 0) select(index);
  };
  const onKey = event => {
    const moves = { ArrowRight: selected + 1, ArrowLeft: selected - 1, Home: 0, End: tabs.length - 1 };
    if (!(event.key in moves)) return;
    event.preventDefault();
    select((moves[event.key] + tabs.length) % tabs.length, { focus: true });
  };
  list.addEventListener('click', onClick);
  list.addEventListener('keydown', onKey);
  let saved = null;
  try {
    saved = storage?.getItem(SETTINGS_TAB_KEY);
  } catch {}
  const initial = tabs.findIndex(tab => tab.dataset.section === saved);
  select(initial >= 0 ? initial : 0, { save: false });
  return {
    get section() {
      return list.dataset.section;
    },
    select,
    reveal,
    dispose() {
      list.removeEventListener('click', onClick);
      list.removeEventListener('keydown', onKey);
    }
  };
}
