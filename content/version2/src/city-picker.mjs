// The city for the sun and the sky (settings): a searchable list over the hidden #solar-city select, which stays the
// one source of truth (garden.mjs bindSolarCity reads its change). Owner, round 18: a nicer design, a search, and
// many more Russian cities, small ones too. Russia and the world in two groups, each city with its local time.

// Lower case, ё as е, no hyphens or spaces: «Ростов на дону», «ростов-на-дону» and «РостовНаДону» find the same city.
export function normalizeCity(text) {
  return String(text || '')
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replace(/[\s\-‐–—.'’]+/g, '');
}
// The cities a query finds, best first: a name that starts with it, then a word of it, then anywhere in it; in both
// languages, so «tomsk» and «томск» both work. An empty query finds every city, in the given order.
export function matchCities(cities, query) {
  const q = normalizeCity(query);
  if (!q) return cities.slice();
  const scored = [];
  for (const city of cities) {
    let best = 9;
    for (const name of [city.name.ru, city.name.en]) {
      const whole = normalizeCity(name),
        words = String(name)
          .toLowerCase()
          .replaceAll('ё', 'е')
          .split(/[\s\-–—]+/);
      if (whole.startsWith(q)) best = Math.min(best, 0);
      else if (words.some(word => normalizeCity(word).startsWith(q))) best = Math.min(best, 1);
      else if (whole.includes(q)) best = Math.min(best, 2);
    }
    if (best < 9) scored.push([best, city]);
  }
  return scored.sort((a, b) => a[0] - b[0]).map(([, city]) => city);
}
// A city's local time now, as on a clock (14:05).
export function cityTime(city, now = new Date(), locale = 'ru') {
  try {
    return new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: city.timeZone
    }).format(now);
  } catch {
    return '';
  }
}

// Builds the picker after `select` (its options must already hold the cities) and hides the select.
/** @param {Document} document @param {{ select: HTMLSelectElement, cities: any[], locale?: string, labels?: Record<string, string> }} options */
export function enhanceCityPicker(document, { select, cities, locale = 'ru', labels = {} }) {
  const ru = String(locale).startsWith('ru'),
    text = {
      search: labels.citySearch || (ru ? 'Найти город' : 'Find a city'),
      russia: labels.cityRussia || (ru ? 'Россия' : 'Russia'),
      world: labels.cityWorld || (ru ? 'Мир' : 'World'),
      none: labels.cityNone || (ru ? 'Такого города в списке нет' : 'No such city in the list'),
      local: select.options[0]?.textContent || ''
    },
    nameOf = city => city.name[ru ? 'ru' : 'en'],
    collator = new Intl.Collator(ru ? 'ru' : 'en'),
    sorted = cities.slice().sort((a, b) => collator.compare(nameOf(a), nameOf(b))),
    el = (tag, className, content) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (content !== undefined) node.textContent = content;
      return node;
    };
  const wrap = el('div', 'city-picker'),
    trigger = el('button', 'city-trigger'),
    panel = el('div', 'city-panel'),
    search = el('input', 'city-search'),
    list = el('div', 'city-list'),
    empty = el('p', 'city-empty', text.none);
  trigger.type = 'button';
  trigger.id = 'solar-city-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-labelledby', 'solar-city-label solar-city-trigger');
  panel.hidden = true;
  search.type = 'search';
  search.placeholder = text.search;
  search.autocomplete = 'off';
  search.spellcheck = false;
  search.setAttribute('role', 'combobox');
  search.setAttribute('aria-autocomplete', 'list');
  search.setAttribute('aria-expanded', 'true');
  search.setAttribute('aria-label', text.search);
  list.id = 'solar-city-list';
  list.setAttribute('role', 'listbox');
  search.setAttribute('aria-controls', list.id);
  empty.hidden = true;
  let shown = [],
    active = -1;
  const option = (value, name, time, current) => {
    const button = el('button', 'city-option');
    button.type = 'button';
    button.id = 'solar-city-' + (value || 'local');
    button.dataset.value = value;
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', String(current));
    button.tabIndex = -1;
    button.append(el('span', 'city-name', name));
    if (time) button.append(el('time', 'city-time', time));
    button.addEventListener('click', () => pick(value));
    return button;
  };
  const group = label => {
    const head = el('div', 'city-group', label);
    head.setAttribute('role', 'presentation');
    return head;
  };
  // The list for the current query: the device's own clock first (unless searching), then Russia, then the world.
  const render = () => {
    const now = new Date(),
      found = matchCities(sorted, search.value),
      query = search.value.trim();
    list.replaceChildren();
    shown = [];
    if (!query) shown.push(option('', text.local, '', select.value === ''));
    for (const [region, label] of [
      ['ru', text.russia],
      ['world', text.world]
    ]) {
      const mine = found.filter(city => (city.region || 'world') === region);
      if (!mine.length) continue;
      // While searching the best match comes first, so the groups follow the order of the matches.
      shown.push(group(label));
      for (const city of mine)
        shown.push(option(city.id, nameOf(city), cityTime(city, now, locale), city.id === select.value));
    }
    list.append(...shown);
    shown = shown.filter(node => node.getAttribute('role') === 'option');
    empty.hidden = shown.length > 0;
    setActive(query ? 0 : shown.findIndex(node => node.dataset.value === select.value));
  };
  const setActive = index => {
    shown[active]?.classList.remove('is-active');
    active = shown.length ? Math.max(0, Math.min(shown.length - 1, index)) : -1;
    const node = shown[active];
    if (node) {
      node.classList.add('is-active');
      search.setAttribute('aria-activedescendant', node.id);
      node.scrollIntoView?.({ block: 'nearest' });
    } else search.removeAttribute('aria-activedescendant');
  };
  const sync = () => {
    const city = cities.find(c => c.id === select.value);
    trigger.replaceChildren(el('span', 'city-name', city ? nameOf(city) : text.local));
    if (city) trigger.append(el('time', 'city-time', cityTime(city, new Date(), locale)));
  };
  const open = () => {
    document
      .querySelectorAll('.control-picker')
      .forEach(node => node.dispatchEvent(new Event('picker-close')));
    panel.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    search.value = '';
    render();
    search.focus();
  };
  const close = (focus = false) => {
    if (panel.hidden) return;
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (focus) trigger.focus();
  };
  const pick = value => {
    select.value = value;
    sync();
    close(true);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  };
  trigger.addEventListener('click', () => (panel.hidden ? open() : close()));
  search.addEventListener('input', render);
  search.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(active + (event.key === 'ArrowDown' ? 1 : -1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (shown[active]) pick(shown[active].dataset.value);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    }
  });
  wrap.addEventListener('focusout', event => {
    if (!wrap.contains(/** @type {Node} */ (event.relatedTarget)) && event.relatedTarget) close();
  });
  document.addEventListener('pointerdown', event => {
    if (!wrap.contains(/** @type {Node} */ (event.target))) close();
  });
  select.addEventListener('change', sync);
  select.addEventListener('picker-sync', sync);
  panel.append(search, list, empty);
  wrap.append(trigger, panel);
  select.hidden = true;
  select.after(wrap);
  sync();
  return { open, close, render, sync, element: wrap };
}
