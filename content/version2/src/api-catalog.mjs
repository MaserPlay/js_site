// Public API catalog for the garden: filter state, same-origin GETs and adapters to the garden project model.
// Dependency-free so the bundle and the Node tests share one implementation.
export const SORT_KEYS = Object.freeze(['name', 'created', 'last_update']);
export const LINK_TYPES = Object.freeze(['TELEGRAM', 'GITHUB', 'MAIL', 'DOCS', 'OTHER']);
// Newest first, like the classic list. The API itself defaults to created ascending, so the sort is always sent.
export const DEFAULT_FILTERS = Object.freeze({
  showHidden: false,
  onlyGithub: false,
  sortBy: 'created',
  descend: true
});
const SITE_HOST = 'maserplay.ru',
  FILTER_PARAMS = ['show_hidden', 'only_github', 'sort_by', 'sort_by_descend'];
const LINK_LABELS = { TELEGRAM: 'Telegram', GITHUB: 'GitHub', DOCS: 'Docs' };
const ENTITIES = Object.assign(Object.create(null), {
  amp: '&',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  nbsp: ' '
});
const flag = value => (value === 'true' ? true : value === 'false' ? false : undefined);
const bool = (value, fallback) => (typeof value === 'boolean' ? value : fallback);
const withRejected = (list, rejected) => Object.defineProperty(list, 'rejected', { value: rejected });

export function normalizeFilters(state) {
  const s = state || {};
  return {
    showHidden: bool(s.showHidden, DEFAULT_FILTERS.showHidden),
    onlyGithub: bool(s.onlyGithub, DEFAULT_FILTERS.onlyGithub),
    sortBy: SORT_KEYS.includes(s.sortBy) ? s.sortBy : DEFAULT_FILTERS.sortBy,
    descend: bool(s.descend, DEFAULT_FILTERS.descend)
  };
}
// Only the literal values true/false and the three sort keys count; anything else keeps that field's default.
export function parseFilterState(search = '') {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search);
  return normalizeFilters({
    showHidden: flag(params.get('show_hidden')),
    onlyGithub: flag(params.get('only_github')),
    sortBy: params.get('sort_by'),
    descend: flag(params.get('sort_by_descend'))
  });
}
// Canonical page query (no leading "?"): default fields are omitted, unrelated params of `base` are kept.
export function filterSearch(state, base = '') {
  const s = normalizeFilters(state),
    params = new URLSearchParams(base);
  for (const name of FILTER_PARAMS) params.delete(name);
  if (s.showHidden !== DEFAULT_FILTERS.showHidden) params.set('show_hidden', String(s.showHidden));
  if (s.onlyGithub !== DEFAULT_FILTERS.onlyGithub) params.set('only_github', String(s.onlyGithub));
  if (s.sortBy !== DEFAULT_FILTERS.sortBy) params.set('sort_by', s.sortBy);
  if (s.descend !== DEFAULT_FILTERS.descend) params.set('sort_by_descend', String(s.descend));
  return params.toString();
}
// Full /api/projects.json query: sort is always explicit, the two filters only when switched on.
export function projectQuery(state) {
  const s = normalizeFilters(state),
    params = new URLSearchParams();
  if (s.showHidden) params.set('show_hidden', 'true');
  if (s.onlyGithub) params.set('only_github', 'true');
  params.set('sort_by', s.sortBy);
  params.set('sort_by_descend', String(s.descend));
  return params.toString();
}

// Same-site (maserplay.ru or the page's own host) becomes pathname+search+hash; external http(s) and mailto stay
// absolute; every other scheme (javascript:, data:, ...) is rejected with null.
export function normalizeUrl(value, { origin = globalThis.location?.origin } = {}) {
  if (typeof value !== 'string' || !value.trim()) return null;
  let base, url;
  try {
    base = new URL(origin);
  } catch {
    base = new URL('https://' + SITE_HOST);
  }
  try {
    url = new URL(value.trim(), base);
  } catch {
    return null;
  }
  if (url.protocol === 'mailto:') return url.href;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  // A leading "//" would turn the relative result into a protocol-relative link to another host.
  if (url.hostname === SITE_HOST || (origin && url.host === base.host))
    return url.pathname.replace(/^\/+/, '/') + url.search + url.hash;
  return url.href;
}
const webUrl = (value, origin) => {
  const url = normalizeUrl(value, { origin });
  return url && !url.startsWith('mailto:') ? url : null;
};
const codePoint = n => (n > 0 && n <= 0x10ffff && (n < 0xd800 || n > 0xdfff) ? String.fromCodePoint(n) : '�');
// Descriptions arrive as localized HTML; the garden shows plain text. One pass, so "&amp;lt;" stays "&lt;".
export const plainText = value =>
  String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (match, dec, hex, name) =>
      dec ? codePoint(Number(dec)) : hex ? codePoint(parseInt(hex, 16)) : (ENTITIES[name] ?? match)
    )
    .replace(/\s+/g, ' ')
    .trim();
const dateFormat = locale => {
  const options = { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' };
  try {
    return new Intl.DateTimeFormat(locale || 'en', options);
  } catch {
    return new Intl.DateTimeFormat('en', options);
  }
};
const isDate = value => typeof value === 'string' && !Number.isNaN(Date.parse(value));

function projectProblem(p, seen, origin) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return 'not an object';
  if (typeof p.technical_name !== 'string' || !p.technical_name.trim()) return 'technical_name';
  if (seen.has(p.technical_name)) return 'duplicate technical_name';
  if (typeof p.name !== 'string' || !p.name.trim()) return 'name';
  if (typeof p.description !== 'string') return 'description';
  if (!webUrl(p.project_Page, origin)) return 'project_Page';
  if (!isDate(p.created)) return 'created';
  if (p.last_update != null && !isDate(p.last_update)) return 'last_update';
  if (typeof p.archived !== 'boolean') return 'archived';
  if (typeof p.hidden !== 'boolean') return 'hidden';
  if (p.media != null && !Array.isArray(p.media)) return 'media';
  return null;
}
// API order is kept as-is (the server sorts). Malformed items are dropped and listed on the result's `rejected`.
export function adaptProjects(list, { locale = 'en', mediaSelections = {}, origin } = {}) {
  if (!Array.isArray(list)) throw new TypeError('Projects response is not an array');
  const format = dateFormat(locale),
    seen = new Set(),
    projects = [],
    rejected = [];
  list.forEach((p, index) => {
    const reason = projectProblem(p, seen, origin);
    if (reason) {
      rejected.push({ index, id: typeof p?.technical_name === 'string' ? p.technical_name : null, reason });
      return;
    }
    const id = p.technical_name,
      media = (p.media || []).filter(m => m && typeof m === 'object');
    seen.add(id);
    const images = [...new Set(media.map(m => webUrl(m.image, origin)).filter(Boolean))],
      ico = webUrl(p.ico, origin),
      pick = mediaSelections?.[id];
    const videos = media
      .map(m => ({
        youtube: webUrl(m.yt_link, origin),
        rutube: webUrl(m.rutube_link, origin),
        poster: webUrl(m.image, origin)
      }))
      .filter(v => v.youtube || v.rutube);
    projects.push({
      id,
      name: p.name,
      description: plainText(p.description),
      href: webUrl(p.project_Page, origin),
      createdAt: p.created,
      createdLabel: format.format(new Date(p.created)),
      updatedAt: p.last_update ?? null,
      updatedLabel: p.last_update ? format.format(new Date(p.last_update)) : null,
      archived: p.archived,
      repository: webUrl(p.repository, origin),
      videos,
      image: images[Number.isInteger(pick) && pick >= 0 ? pick : 0] ?? ico,
      images,
      ico,
      hidden: p.hidden,
      distributions: Array.isArray(p.distributions) ? p.distributions : []
    });
  });
  return withRejected(projects, rejected);
}
export function adaptLinks(list, { origin } = {}) {
  if (!Array.isArray(list)) throw new TypeError('Links response is not an array');
  const links = [],
    rejected = [];
  list.forEach((item, index) => {
    const type = item?.type,
      uri = typeof item?.uri === 'string' ? item.uri.trim() : '';
    let href = null,
      label = null;
    if (type === 'MAIL') {
      const address = uri.replace(/^mailto:/i, '');
      if (/^[^\s@/?#:<>"'&]+@[^\s@/?#:<>"'&]+\.[^\s@/?#:<>"'&]+$/.test(address)) {
        href = 'mailto:' + address;
        label = address;
      }
    } else if (LINK_TYPES.includes(type) && (href = webUrl(uri, origin)))
      label = LINK_LABELS[type] ?? new URL(uri, 'https://' + SITE_HOST).hostname.replace(/^www\./, '');
    if (!href) {
      rejected.push({
        index,
        type: typeof type === 'string' ? type : null,
        reason: LINK_TYPES.includes(type) ? 'uri' : 'type'
      });
      return;
    }
    links.push({ type, href, label });
  });
  return withRejected(links, rejected);
}
export function adaptLanguages(list) {
  if (!Array.isArray(list)) throw new TypeError('Languages response is not an array');
  const languages = [],
    rejected = [],
    seen = new Set();
  list.forEach((item, index) => {
    const value = item?.value,
      nativeName = typeof item?.native_name === 'string' ? item.native_name.trim() : '';
    const reason =
      typeof value !== 'string' || !/^[a-z]{2}(-[A-Za-z]{2})?$/.test(value)
        ? 'value'
        : seen.has(value)
          ? 'duplicate value'
          : !nativeName
            ? 'native_name'
            : typeof item.current !== 'boolean'
              ? 'current'
              : null;
    if (reason) {
      rejected.push({ index, value: typeof value === 'string' ? value : null, reason });
      return;
    }
    seen.add(value);
    languages.push({ value, nativeName, current: item.current });
  });
  return withRejected(languages, rejected);
}

// api: the site that answers ('' here; a copy on another site names maserplay.ru).
async function getJson(path, { locale, signal, api = '', fetchImpl = globalThis.fetch } = {}) {
  const headers = { Accept: 'application/json' };
  if (locale) headers['Accept-Language'] = locale;
  const response = await fetchImpl(api + path, {
    method: 'GET',
    headers,
    credentials: 'same-origin',
    signal
  });
  if (!response.ok) {
    const error = new Error('GET ' + path + ' failed with HTTP ' + response.status);
    error.status = response.status;
    try {
      error.problem = await response.json();
    } catch {}
    throw error;
  }
  return response.json();
}
export const fetchProjects = async (state, options = {}) =>
  adaptProjects(await getJson('/api/projects.json?' + projectQuery(state), options), options);
export const fetchLinks = async (options = {}) =>
  adaptLinks(await getJson('/api/links.json', options), options);
export const fetchLanguages = async (options = {}) =>
  adaptLanguages(await getJson('/api/langs.json', options));
