import { createFireworkTimeline } from './firework-sounds.mjs';
// Celebrations: maserplay.ru's birthday, the January holidays (New Year, Christmas, the Old New Year) and the
// smaller days of the calendar. On every page load during an occasion a greeting rises in over the garden. The
// birthday and the January holidays get the big fireworks show, some shells opening into the occasion itself
// ("3 ГОДА", "2027", "С РОЖДЕСТВОМ"); the other days get a light themed touch (drifting hearts, falling petals,
// a rocket, steady warm lights, a few tricolour bursts). Everything shares one pooled Points draw: a shell or a
// wave is written once (each spark with its own future birth time) and then moves entirely in the vertex
// shader, so a frame allocates nothing and runs no CPU simulation. The draw is hidden once the last spark fades.

import { createRocketModel } from './celebration-rocket.mjs';

// maserplay.ru was created on 30 June 2023 (the creation date of its first, hidden project, confirmed by Dima).
// Month is 1-based.
export const SITE_BIRTHDAY = { month: 6, day: 30, year: 2023 };
// The January window, 1 to 14 inclusive, and the holidays inside it: New Year (1 to 6, and again 8 to 12 while
// the winter holidays go on), Christmas on 7 January and the Old New Year on 13 and 14 January.
export const NEW_YEAR = { month: 1, first: 1, last: 14 };
export const CHRISTMAS = { month: 1, first: 7, last: 7 };
export const OLD_NEW_YEAR = { month: 1, first: 13, last: 14 };
// The smaller days, [month, day]. The programmer's day is the 256th day of the year instead (13 September, or
// 12 September in a leap year).
export const DAYS = {
  valentine: [2, 14],
  defender: [2, 23],
  march8: [3, 8],
  cosmonautics: [4, 12],
  may1: [5, 1],
  victory: [5, 9],
  russia: [6, 12],
  unity: [11, 4]
};
export const PROGRAMMER_DAY = 256;
// The creators' birthdays, [month, day]: Dima made maserplay.ru and the garden, Andrey is the garden's co-author.
// Dima's day falls inside the January window and wins over New Year: his day is the main event, the New Year
// decorations stay in the background.
export const PERSONAL = { dima: [1, 9], andrey: [1, 25] };
// Their birth years: the age on the day is the calendar year minus it (21 in 2026, 22 in 2027).
export const BORN = { dima: 2005, andrey: 2005 };
export const personAge = (key, date = new Date()) =>
  Math.max(1, date.getFullYear() - (BORN[key] ?? date.getFullYear() - 1));
export const GRAND = ['birthday', 'newyear', 'christmas', 'oldnewyear', 'dima', 'andrey'];
export const OCCASIONS = [...GRAND, ...Object.keys(DAYS), 'programmer'];
// A project's birthday (project-birthdays.mjs) on a day without another occasion; not a calendar date, so it is
// not in OCCASIONS. ?celebrate=project[:<station number or name>] previews it.
export const PROJECT = 'project';
export const isOccasion = key => key === PROJECT || OCCASIONS.includes(key);
// Spellings a hand-typed preview link may use (case, dashes, digits-only separators and spaces are ignored).
const OVERRIDES = {
  bday: 'birthday',
  деньрождения: 'birthday',
  др: 'birthday',
  ny: 'newyear',
  новыйгод: 'newyear',
  xmas: 'christmas',
  рождество: 'christmas',
  oldny: 'oldnewyear',
  старыйновыйгод: 'oldnewyear',
  valentines: 'valentine',
  валентин: 'valentine',
  feb23: 'defender',
  women: 'march8',
  mar8: 'march8',
  space: 'cosmonautics',
  космонавтика: 'cosmonautics',
  mayday: 'may1',
  победа: 'victory',
  russiaday: 'russia',
  programmers: 'programmer',
  dev: 'programmer',
  unityday: 'unity',
  дима: 'dima',
  dmitry: 'dima',
  андрей: 'andrey',
  andrew: 'andrey',
  off: null,
  none: null,
  no: null
};
for (const key of OCCASIONS) OVERRIDES[key] = key;

// The day of the year, 1 on 1 January.
export const dayOfYear = date =>
  Math.round(
    (new Date(date.getFullYear(), date.getMonth(), date.getDate()) - new Date(date.getFullYear(), 0, 1)) /
      864e5
  ) + 1;

// ?celebrate=project, project:3, project:<name> (or проект...): a project's birthday preview.
export const projectOverride = (search = '') =>
  /^(project|проект)/.test(String(new URLSearchParams(search).get('celebrate') ?? '').toLowerCase());

// The visitor's local date decides; ?celebrate=<occasion>|off overrides it for previews and tests. With the
// project list, a day without another occasion that is some project's birthday is the PROJECT occasion.
export function celebrationFor(date = new Date(), search = '', projects = null) {
  if (projectOverride(search)) return PROJECT;
  const override = String(new URLSearchParams(search).get('celebrate') ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]/g, '');
  if (Object.hasOwn(OVERRIDES, override)) return OVERRIDES[override];
  const month = date.getMonth() + 1,
    day = date.getDate(),
    within = span => month === span.month && day >= span.first && day <= span.last;
  if (month === SITE_BIRTHDAY.month && day === SITE_BIRTHDAY.day) return 'birthday';
  for (const [key, [m, d]] of Object.entries(PERSONAL)) if (month === m && day === d) return key;
  if (within(CHRISTMAS)) return 'christmas';
  if (within(OLD_NEW_YEAR)) return 'oldnewyear';
  if (within(NEW_YEAR)) return 'newyear';
  if (dayOfYear(date) === PROGRAMMER_DAY) return 'programmer';
  for (const [key, [m, d]] of Object.entries(DAYS)) if (month === m && day === d) return key;
  return projects && birthdaysOn(projects, date).length ? PROJECT : null;
}

// The day an occasion falls on in a given year (its first day for the January window): a date
// celebrationFor() maps back to that occasion (tests and the calendar-order checks rely on it).
export function occasionDate(occasion, year = new Date().getFullYear()) {
  if (occasion === 'birthday') return new Date(year, SITE_BIRTHDAY.month - 1, SITE_BIRTHDAY.day);
  if (occasion === 'newyear') return new Date(year, NEW_YEAR.month - 1, NEW_YEAR.first);
  if (occasion === 'christmas') return new Date(year, CHRISTMAS.month - 1, CHRISTMAS.first);
  if (occasion === 'oldnewyear') return new Date(year, OLD_NEW_YEAR.month - 1, OLD_NEW_YEAR.first);
  if (occasion === 'programmer') return new Date(year, 0, PROGRAMMER_DAY);
  const [month, day] = DAYS[occasion] || PERSONAL[occasion];
  return new Date(year, month - 1, day);
}
// Every occasion in calendar order.
export const calendarOrder = (year = new Date().getFullYear()) =>
  [...OCCASIONS].sort((a, b) => occasionDate(a, year) - occasionDate(b, year));

// The address with ?celebrate=<key> (or off), every other parameter and the hash kept: the developer preview
// (the audit switch keeps the address in step with what is on screen).
export function celebrateUrl(href, key) {
  const url = new URL(href);
  if (key === 'auto') url.searchParams.delete('celebrate');
  else url.searchParams.set('celebrate', key || 'off');
  return url.pathname + url.search + url.hash;
}

// A project's creation date (the API's `created`, the page data's `createdAt`) as a local date, or null.
// The first sentence of a project's description, without markup, at most `max` characters (cut at a word):
// the project's own line in its birthday greeting (owner, round 9: the greetings all said the same).
export function projectPitch(description, max = 120) {
  const text = String(description || '')
    .split('<')
    .map((part, i) => (i ? part.slice(part.indexOf('>') + 1) : part))
    .join(' ')
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replace(/\s+/g, ' ')
    .replace(/ ([.,!?;:])/g, '$1')
    .trim();
  // The first sentence without a link (links lost their words with the markup), else the first one with its
  // links shortened to their address.
  const link = word => /^https?:\/\//.test(word) || word.startsWith('www.'),
    sentences = text.split(/(?<=[.!?…]) /).filter(Boolean),
    sentence =
      sentences.find(s => !s.split(' ').some(link)) ||
      (sentences[0] || '')
        .split(' ')
        .map(word =>
          link(word)
            ? word
                .replace(/^https?:\/\//, '')
                .replace(/^www\./, '')
                .split('/')[0]
            : word
        )
        .join(' ');
  if (sentence.length <= max) return sentence;
  const space = sentence.lastIndexOf(' ', max - 1);
  let cut = space > max / 2 ? sentence.slice(0, space) : sentence.slice(0, max - 1);
  while (cut && ' ,;:—-'.includes(cut.at(-1))) cut = cut.slice(0, -1);
  return cut + '…';
}
export function createdDate(project) {
  const raw = project?.createdAt ?? project?.created;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}
const leapYear = year => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
// The projects whose creation anniversary is `date` (local month and day; 29 February is kept on 28 February in
// other years), oldest first in list order: [{ index, age, name }]. The creation day itself (age 0) is not one.
export function birthdaysOn(projects, date = new Date()) {
  const out = [],
    year = date.getFullYear(),
    month = date.getMonth(),
    day = date.getDate();
  (projects || []).forEach((project, index) => {
    const created = createdDate(project);
    if (!created) return;
    let m = created.getMonth(),
      d = created.getDate();
    if (m === 1 && d === 29 && !leapYear(year)) d = 28;
    const age = year - created.getFullYear();
    if (m === month && d === day && age >= 1) out.push({ index, age, name: String(project.name || '') });
  });
  return out;
}
// The birthdays the garden shows: the real ones, or with ?celebrate=project[:<n>|:<name>] a preview of
// station n (1-based, as on the island tags) or of the project with that name; without a choice today's
// birthdays or else station 1. A preview's age is the project's real age that year, at least 1. Off shows none.
export function projectBirthdays(projects, date = new Date(), search = '') {
  const list = projects || [],
    raw = String(new URLSearchParams(search).get('celebrate') ?? '').trim();
  if (/^(off|none|no)$/i.test(raw)) return [];
  if (!projectOverride(search)) return birthdaysOn(list, date);
  if (!list.length) return [];
  const choice = raw.replace(/^(project|проект)\s*[:=-]?\s*/i, '').toLowerCase();
  // A project's id first (the settings picker writes it): stations and names change with the sort and filters,
  // and a station number picked before a re-sort greeted whoever stood there after it (owner, round 17).
  let index = choice ? list.findIndex(p => String(p.id ?? '').toLowerCase() === choice) : -1;
  if (index < 0 && /^\d+$/.test(choice)) index = Math.min(list.length, Math.max(1, Number(choice))) - 1;
  else if (index < 0 && choice)
    index = list.findIndex(p =>
      String(p.name || '')
        .toLowerCase()
        .includes(choice)
    );
  if (index < 0) {
    const today = birthdaysOn(list, date);
    if (today.length) return today;
    index = 0;
  }
  const created = createdDate(list[index]);
  return [
    {
      index,
      age: Math.max(1, created ? date.getFullYear() - created.getFullYear() : 1),
      name: String(list[index].name || '')
    }
  ];
}
// The January holidays share the year number and the winter look.
const wintry = occasion => occasion === 'newyear' || occasion === 'christmas' || occasion === 'oldnewyear';

// Whole years since the site was created, counted by calendar year (30 June 2027 → 4). A preview before the
// first birthday still shows at least 1.
export const siteAge = (date = new Date()) => Math.max(1, date.getFullYear() - SITE_BIRTHDAY.year);
// The year being greeted: the current one in January, the coming one in a preview from July on.
export const newYearNumber = (date = new Date()) => date.getFullYear() + (date.getMonth() >= 6 ? 1 : 0);
export const STAR = '★',
  HEART = '♥',
  // Defender of the Fatherland Day: a gold star outline around a red one (two colours, see MULTI_GLYPHS).
  ORDER_STAR = '✯';
// The card's big mark: the site's age, the new year or a star for Christmas; the smaller days take theirs from
// the lang files (celebrate<Key>Mark); a project's birthday shows the project's age.
export function figureFor(occasion, date = new Date(), labels = {}, party = []) {
  if (occasion === PROJECT) return String(party[0]?.age ?? 1);
  if (BORN[occasion]) return String(personAge(occasion, date));
  if (occasion === 'christmas') return STAR;
  if (wintry(occasion)) return String(newYearNumber(date));
  if (occasion === 'birthday' || !occasion) return String(siteAge(date));
  return String(labels['celebrate' + copyKey(occasion) + 'Mark'] || STAR);
}

// "3 года", "5 лет", "21 год" / "1 year", "3 years": the noun forms come from the lang files.
export function yearsPhrase(count, locale = 'ru', labels = {}) {
  let form = 'Many';
  if (locale === 'ru') {
    const last = count % 10,
      lastTwo = count % 100;
    if (last === 1 && lastTwo !== 11) form = 'One';
    else if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) form = 'Few';
  } else if (count === 1) form = 'One';
  return count + ' ' + (labels['celebrateYears' + form] || '');
}

// Lang keys: celebrate<Key>Title / Text (and Mark / Unit for the smaller days).
const COPY_KEYS = {
  birthday: 'Birthday',
  newyear: 'NewYear',
  christmas: 'Christmas',
  oldnewyear: 'OldNewYear',
  valentine: 'Valentine',
  defender: 'Defender',
  march8: 'March8',
  cosmonautics: 'Cosmonautics',
  may1: 'May1',
  victory: 'Victory',
  russia: 'Russia',
  programmer: 'Programmer',
  unity: 'Unity',
  dima: 'Dima',
  andrey: 'Andrey',
  project: 'Project'
};
const copyKey = occasion => COPY_KEYS[occasion] || COPY_KEYS.birthday;
// What the word shells spell, in order (they repeat in that order afterwards). Every character must have a
// glyph in GLYPHS; the Christmas greeting is the lang file's own word (celebrateChristmasSky, with a built-in
// fallback while a server still serves older lang files). The smaller days spell nothing, except the
// programmer's day.
const CHRISTMAS_SKY = { ru: 'С РОЖДЕСТВОМ', en: 'MERRY XMAS' },
  NAME_SKY = { dima: { ru: 'ДИМА', en: 'DIMA' }, andrey: { ru: 'АНДРЕЙ', en: 'ANDREY' } };
function skyWords(occasion, mark, phrase, labels, locale) {
  if (occasion === 'birthday' || occasion === PROJECT) return [phrase, phrase, phrase];
  // The creators' names, from the lang file (celebrate<Name>Sky) or built in, around their age.
  if (NAME_SKY[occasion]) {
    const name = String(
      labels['celebrate' + copyKey(occasion) + 'Sky'] || NAME_SKY[occasion][locale]
    ).toUpperCase();
    return [name, mark, name];
  }
  if (occasion === 'christmas') {
    const word = String(
      labels.celebrateChristmasSky || CHRISTMAS_SKY[locale] || CHRISTMAS_SKY.en
    ).toUpperCase();
    return [word, STAR, word];
  }
  if (occasion === 'programmer') return ['256', '</>', '256'];
  return wintry(occasion) ? [mark, mark, mark] : [];
}

// The greeting's title and line, with {age}, {year} and {name} filled in, its big mark (the site's age with its
// noun "3" + "года", the new year "2027", the Christmas star, or the day's own mark) and the words the sky
// spells. `party`: today's project birthdays (projectBirthdays); on another occasion's day the card adds a line
// for them (celebrateProjectAlso), so a project's birthday is never lost under a holiday.
export function greetingCopy(occasion, labels = {}, date = new Date(), locale = 'ru', party = []) {
  const key = copyKey(occasion),
    projects = party || [],
    names = projects.map(p => p.name).join(', '),
    years =
      occasion === PROJECT
        ? (projects[0]?.age ?? 1)
        : BORN[occasion]
          ? personAge(occasion, date)
          : siteAge(date),
    age = yearsPhrase(years, locale, labels),
    projectAge = projects.length ? yearsPhrase(projects[0].age, locale, labels) : '',
    fill = (text, years = age) =>
      String(text || '')
        .replace('{age}', years)
        .replace('{name}', names)
        .replace('{year}', String(newYearNumber(date)))
        .replace('{pitch}', projects[0]?.pitch || '')
        .replace(/\s{2,}/g, ' ')
        .trim(),
    mark = figureFor(occasion, date, labels, projects),
    also = occasion !== PROJECT && projects.length ? ' ' + fill(labels.celebrateProjectAlso, projectAge) : '';
  return {
    title: fill(labels['celebrate' + key + 'Title']),
    text: fill(labels['celebrate' + key + 'Text']) + also,
    mark,
    unit:
      occasion === 'birthday' || occasion === PROJECT || BORN[occasion]
        ? age.slice(age.indexOf(' ') + 1)
        : String(labels['celebrate' + key + 'Unit'] || ''),
    sky: skyWords(occasion, mark, age.toUpperCase().trim(), labels, locale === 'ru' ? 'ru' : 'en')
  };
}

// How much daylight is in the sky for a lighting blend from world.lighting(): { from, to, mix }. By day the
// sparks burn brighter and leave smoke; at night they glow on their own.
// Dawn (morning) is bright enough for the deep day palettes (above DAY_PALETTE_FROM).
const DAYLIGHT = { day: 1, morning: 0.7, evening: 0.75, sunset: 0.4, night: 0 };
export function daylight(light) {
  const { from, to, mix, weights } = light || {},
    level = phase => DAYLIGHT[phase] ?? 0.5;
  if (weights)
    return Object.entries(weights).reduce((sum, [phase, weight]) => sum + level(phase) * weight, 0);
  return level(from) + (level(to) - level(from)) * (mix || 0);
}

// Linear colours. The glow pass makes them shine; a star peaks at about 1.5 in its main channel, so cores glow
// while the other channels keep the hue instead of burning out to white.
export const PALETTES = {
  birthday: [
    [1, 0.66, 0.24],
    [1, 0.34, 0.66],
    [0.3, 0.86, 1]
  ],
  newyear: [
    [1, 0.66, 0.24],
    [0.94, 0.93, 1],
    [1, 0.2, 0.17],
    [0.3, 1, 0.42]
  ],
  // Gold first: the Christmas star and the word open in it.
  christmas: [
    [1, 0.7, 0.26],
    [0.94, 0.93, 1],
    [1, 0.18, 0.14],
    [0.32, 0.6, 1]
  ],
  // Frosty: ice blue, silver, violet and gold.
  oldnewyear: [
    [0.36, 0.78, 1],
    [0.94, 0.95, 1],
    [0.72, 0.42, 1],
    [1, 0.7, 0.3]
  ],
  valentine: [
    [1, 0.25, 0.5],
    [1, 0.5, 0.72],
    [0.95, 0.12, 0.25]
  ],
  // A gold and red star, a calm salute in the same two colours and a warm white.
  defender: [
    [1, 0.7, 0.24],
    [1, 0.16, 0.1],
    [1, 0.86, 0.62]
  ],
  march8: [
    [1, 0.5, 0.72],
    [1, 0.75, 0.35],
    [1, 0.82, 0.9]
  ],
  cosmonautics: [
    [0.6, 0.8, 1],
    [1, 0.85, 0.55],
    [0.85, 0.9, 1]
  ],
  may1: [
    [1, 0.35, 0.3],
    [1, 0.8, 0.25],
    [0.35, 1, 0.45],
    [0.5, 0.65, 1]
  ],
  // Warm orange and gold: shared by the Victory Day lanterns and salute; no black sparks.
  victory: [
    [1, 0.62, 0.25],
    [1, 0.75, 0.42],
    [1, 0.52, 0.16]
  ],
  russia: [
    [0.94, 0.94, 1],
    [0.22, 0.45, 1],
    [1, 0.18, 0.15]
  ],
  programmer: [
    [0.3, 1, 0.5],
    [0.35, 0.85, 1],
    [1, 0.75, 0.3]
  ],
  unity: [
    [0.94, 0.94, 1],
    [0.22, 0.45, 1],
    [1, 0.18, 0.15]
  ],
  // Dima's day: blue. Sky blue first (the name opens in it), ice white, royal blue and azure.
  dima: [
    [0.35, 0.62, 1],
    [0.88, 0.93, 1],
    [0.22, 0.32, 1],
    [0.3, 0.85, 1]
  ],
  // Andrey's day: neon. Magenta first, electric cyan, violet and acid lime.
  andrey: [
    [1, 0.16, 0.86],
    [0.1, 0.95, 1],
    [0.62, 0.24, 1],
    [0.78, 1, 0.12]
  ],
  // A project's birthday: party colours.
  project: [
    [1, 0.42, 0.66],
    [1, 0.78, 0.24],
    [0.32, 0.85, 1],
    [0.5, 1, 0.42]
  ]
};
// By day pale stars vanish into the bright hazy sky (the New Year's silver and gold did), so by day the shells
// carry deep, saturated colours instead.
export const DAY_PALETTES = {
  birthday: [
    [1, 0.42, 0.02],
    [1, 0.08, 0.5],
    [0.02, 0.55, 1]
  ],
  newyear: [
    [1, 0.5, 0.02],
    [1, 0.06, 0.06],
    [0.05, 0.85, 0.2],
    [0.1, 0.35, 1]
  ],
  christmas: [
    [1, 0.5, 0.02],
    [0.05, 0.3, 1],
    [1, 0.05, 0.05],
    [0.05, 0.75, 0.25]
  ],
  oldnewyear: [
    [0.02, 0.5, 1],
    [0.45, 0.1, 1],
    [1, 0.45, 0.02],
    [0.05, 0.8, 0.85]
  ],
  valentine: [
    [1, 0.04, 0.35],
    [0.9, 0.02, 0.1],
    [1, 0.08, 0.6]
  ],
  defender: [
    [1, 0.52, 0.02],
    [0.95, 0.04, 0.02],
    [1, 0.66, 0.06]
  ],
  march8: [
    [1, 0.08, 0.5],
    [1, 0.5, 0.02],
    [0.85, 0.05, 0.7]
  ],
  cosmonautics: [
    [0.05, 0.4, 1],
    [1, 0.5, 0.02],
    [0.3, 0.1, 1]
  ],
  may1: [
    [1, 0.08, 0.05],
    [1, 0.55, 0.02],
    [0.05, 0.8, 0.2],
    [0.08, 0.3, 1]
  ],
  victory: [
    [1, 0.42, 0.02],
    [1, 0.55, 0.05],
    [0.95, 0.3, 0.02]
  ],
  russia: [
    [0.05, 0.25, 1],
    [1, 0.06, 0.04],
    [0.08, 0.5, 1]
  ],
  programmer: [
    [0.02, 0.85, 0.3],
    [0.02, 0.5, 1],
    [1, 0.5, 0.02]
  ],
  unity: [
    [0.05, 0.25, 1],
    [1, 0.06, 0.04],
    [0.08, 0.5, 1]
  ],
  dima: [
    [0.02, 0.35, 1],
    [0.05, 0.6, 1],
    [0.15, 0.08, 1],
    [0.02, 0.8, 1]
  ],
  andrey: [
    [1, 0.02, 0.75],
    [0.02, 0.85, 1],
    [0.45, 0.02, 1],
    [0.6, 1, 0.02]
  ],
  project: [
    [1, 0.06, 0.5],
    [1, 0.55, 0.02],
    [0.02, 0.5, 1],
    [0.1, 0.8, 0.05]
  ]
};
const DAY_PALETTE_FROM = 0.5;
const WILLOW = [1, 0.58, 0.2],
  EMBER = [1, 0.7, 0.38],
  SMOKE = [0.6, 0.6, 0.63],
  STAR_GAIN = 1.45;

export const FIREWORKS = {
  capacity: 3600, // pooled particles
  compactCapacity: 1800, // phones and the economy setting draw fewer
  compactDensity: 0.55
};
// The opening show (seconds): it starts a moment after the greeting, lasts about 20 s and ends with a volley.
// Reduced motion: a few slow bursts only, and nothing afterwards.
export const SHOW = {
  delay: 1.8,
  length: 24,
  gap: [0.75, 1.45],
  pairs: 0.22,
  finale: 5,
  finaleSpan: 1.8,
  calmBursts: 3,
  calmGap: 2.8
};
// After the opening show, while the occasion lasts: a small salvo of shells now and then and, about every two
// minutes, a word shell, so the sky stays festive without a constant crackle. Seconds; a salvo's gap counts
// from its first shell. The first salvo and the first word count from the end of the opening show. The word
// keeps `wordClear` s away from a salvo so it opens in a clear sky. The economy setting (and phones) fire
// smaller salvos `economyStretch` times less often; reduced motion fires nothing after the opening.
export const RHYTHM = {
  salvo: [2, 3],
  salvoEvery: [25, 40],
  shotGap: [0.45, 1.1],
  wordEvery: [110, 130],
  wordClear: 6,
  economySalvo: [1, 2],
  economyStretch: 1.5
};
// The smaller days: a short light opening (`intro` shells over `introLength` s, the programmer's day's words at
// `wordsAt`), then a slow rhythm of `salvo` shells every `every` s, a word every `wordEvery` s (only where the
// day has words), a wave of `wave` drifting sparks every `waveEvery` s, each living `waveLife` s and spread over
// `waveSpread` s, and a rocket every `rocketEvery` s. Economy: smaller salvos and waves, RHYTHM.economyStretch
// times less often. Reduced motion: at most three slow bursts and one still wave, nothing afterwards.
export const LIGHT = {
  intro: 5,
  introLength: 9,
  wordsAt: [2.5, 7.5],
  salvo: [1, 2],
  every: [18, 30],
  wordEvery: [70, 100],
  wave: 14,
  waveEvery: [22, 34],
  waveLife: [9, 12],
  waveSpread: 4,
  rocketEvery: [24, 40],
  firstRocket: 3
};
// Per occasion: the grand show, or the light one with its burst kinds (BURSTS names; none for the respectful
// days), their size (share of a normal burst), the shapes some shells open into (aside, like a burst; `shapes`
// is the share of such shells), the drifting sparks (DRIFT), a wave size factor and a rocket.
export const PROFILES = {
  birthday: { grand: true },
  newyear: { grand: true },
  christmas: { grand: true },
  oldnewyear: { grand: true },
  // The creators' days: the grand show in their own colours (their cake stands on the stage,
  // celebration-stage.mjs).
  dima: { grand: true },
  andrey: { grand: true },
  valentine: { kinds: ['peony'], size: 0.8, shape: HEART, shapes: 0.5, drift: 'heart' },
  // Dignified: the gold and red order star and "23" in the sky, single calm shells, a few still glints.
  defender: {
    kinds: ['peony', 'ring'],
    size: 0.75,
    intro: 3,
    salvo: [1, 1],
    every: [24, 36],
    shape: ORDER_STAR,
    shapes: 0.3,
    drift: 'glint'
  },
  march8: { kinds: ['peony', 'glitter'], size: 0.9, drift: 'petal', wave: 1.4 },
  cosmonautics: { kinds: ['ring', 'glitter'], size: 0.7, intro: 2, drift: 'twinkle', rocket: true },
  may1: { kinds: ['peony', 'ring', 'glitter'], size: 0.95, drift: 'petal', wave: 1.4 },
  // Restrained orange/gold salute in the existing style; keep the lanterns and stage composition.
  victory: {
    kinds: ['peony', 'ring'],
    size: 0.75,
    intro: 3,
    salvo: [1, 1],
    every: [24, 36],
    drift: 'lantern',
    wave: 1.8
  },
  // The flag gathers from sparks and waves in the sky (FLAG); tricolour shells around it.
  russia: { kinds: ['peony', 'ring'], size: 0.9, intro: 4, flag: true },
  programmer: { kinds: ['peony', 'ring', 'glitter'], size: 0.85 },
  unity: { kinds: ['peony', 'ring'], size: 0.8, intro: 3, salvo: [1, 1], every: [26, 40] },
  // A project's birthday on a day without another occasion: a light party show; the pavilion itself
  // celebrates (PARTY).
  project: { kinds: ['peony', 'glitter'], size: 0.8, intro: 4 }
};
// Drifting sparks: their kind in the shader (7 heart, 8 petal, 9 twinkle, 10 lantern), size and upward speed as
// shares of the distance (per s), sway (in sizes; 0 holds still) and the band of the view they start in
// (share of the half view up from the middle).
export const DRIFT = {
  heart: { kind: 7, size: 0.026, rise: 0.011, sway: 1.2, band: [-0.35, 0.5] },
  petal: { kind: 8, size: 0.021, rise: -0.022, sway: 2.4, band: [0.3, 1.05] },
  twinkle: { kind: 9, size: 0.012, rise: 0, sway: 0, band: [0.1, 0.95] },
  glint: { kind: 9, size: 0.016, rise: 0, sway: 0, band: [0.15, 0.85] },
  lantern: { kind: 10, size: 0.022, rise: 0.005, sway: 0.4, band: [-0.25, 0.55] }
};
// The cosmonautics rocket (celebration-rocket.mjs): it dives in from high on one side, sweeps low across the
// view and climbs away on the other side in `flight` s, along a cubic curve through `path` ([across, up] as
// shares of the half view, mirrored for the other side) at `depth` of the way to the garden centre. Its length is
// `size` of the distance; `trail` exhaust sparks (glowing at night, smoke by day) and `smoke` puffs stay behind
// it for `trailLife` / `smokeLife` s; the flame flickers by `flicker`.
export const ROCKET = {
  flight: [8, 10],
  path: [
    [-1.45, 0.95],
    [-0.55, -0.55],
    [0.45, -0.25],
    [1.45, 0.85]
  ],
  depth: 0.7,
  size: 0.075,
  trail: 170,
  trailLife: [1.3, 2.1],
  smoke: 40,
  smokeLife: [3, 4.2],
  flicker: 0.25
};
// Russia Day's flag: `first` s into the show and then every `every` s, sparks fly together from all sides
// (`gather` s of births, drag `drag`, starting `spread` flag widths out) into a white-blue-red cloth `width` of
// the view wide (`phoneWidth` on a narrow view), `up` of the half view above the middle at `depth` of the way to
// the garden centre, that waves from the gold pole outwards (amplitude `wave` of its height) for `life` s.
// `cols` at full density. A wide view hangs it `across` of the half view right of the cards in the middle; a
// narrow one centres it at `phoneUp`, below the cards at the top.
export const FLAG = {
  first: 2.4,
  every: [50, 70],
  cols: 42,
  aspect: 2 / 3,
  width: 0.3,
  phoneWidth: 0.62,
  up: 0.34,
  phoneUp: 0.02,
  across: 0.5,
  depth: 0.62,
  gather: 0.8,
  drag: 1.4,
  spread: [0.7, 1.4],
  life: [11, 12.5],
  wave: 0.07,
  // The cloth's sparks overlap about seven deep: at night (additive, with the glow pass) a lower gain keeps the
  // stripes from burning out to white; by day they also cover the sky, so they can be stronger.
  gain: 0.5,
  nightGain: 0.24,
  size: 2.7,
  pole: 1.35
};
// The flag's colours: deep by day, where pale stripes would vanish into the sky; the pole is gold.
export const FLAG_COLOURS = {
  night: [
    [0.95, 0.95, 1],
    [0.12, 0.36, 1],
    [1, 0.12, 0.1]
  ],
  day: [
    [1, 1, 1],
    [0.02, 0.22, 0.95],
    [0.95, 0.03, 0.03]
  ],
  pole: [1, 0.7, 0.25]
};
// A project's birthday at its pavilion (project-birthdays.mjs hands the pavilion groups to setParty): when the
// camera comes within `near` m of the door (again after leaving beyond `far`, or every `repeat` s while it
// stays), two stage fountains spray gold sparks on both sides of the entrance for `span` s and confetti bursts
// over the sign; and from anywhere, every `popEvery` s, confetti and a ring of stars pop over the roof, sized to
// the distance (`popScale`) so the pavilion stands out from the overview too. Offsets are in the pavilion's
// frame (front towards -z).
export const PARTY = {
  max: 8,
  near: 24,
  far: 34,
  repeat: 12,
  popFirst: 3,
  popEvery: [12, 18],
  door: [0, 0.7, -2.6],
  fountains: [
    [3.15, 0.66, -1.95],
    [-3.15, 0.66, -1.95]
  ],
  sign: [0, 6.6, -2.6],
  roof: [0, 7.4, -2.2],
  fountain: 130,
  span: 3.4,
  speed: [6.5, 8.6],
  fountainLife: [0.75, 1.15],
  confetti: 110,
  confettiLife: [3.4, 4.8],
  popStars: 48,
  popScale: 0.02,
  // Inside the hall (within `indoor` m of the house's inside point): smaller confetti over the visitor's head every
  // `indoorEvery` s, kept under the ceiling (owner, round 9: the party should show inside the building too).
  inside: [0, 2.2, 1.2],
  indoor: 4.2,
  indoorEvery: 7,
  indoorScale: 0.55
};
// Confetti flakes overlap a lot at night: kept below a star's gain so a burst stays colourful, not a white blob.
const CONFETTI_GAIN = 0.75,
  PARTY_GOLD = [1, 0.74, 0.3],
  PARTY_WHITE = [1, 0.92, 0.75];
// A birthday stage's sparkle (celebration-stage.mjs → sparkle): `fountain` glitter sparks shot up at `speed`
// (m/s at scale 1) over `span` s and `confetti` flakes, in the occasion's colours.
export const SPARKLE = { fountain: 90, confetti: 70, speed: [7, 9.5], span: 1.6, life: [0.8, 1.2] };
// The words in the sky: a shell that opens into letters, facing the camera in the middle of the view. When the
// opening show's three fly (s after it starts; the last one in the finale), letter height as a share of the
// distance, the share of the view width the word may take (less on a wide view), how high it hangs (share of the half view), its
// distance as a share of the way to the garden centre, spark spacing, letter advance and the width of a space in
// glyph units, the most sparks one word may use (a long word spaces its sparks wider), life (s), drag (1/s) and
// sinking. On a wide view the word sits `shift` of the half view right of the middle, clear of the hero text and
// of the day's composition over the central island (celebration-stage.mjs).
export const FIGURE = {
  at: [3.2, 11.5, 20.5],
  height: 0.17,
  fit: 0.84,
  wideFit: 0.36,
  shift: 0.52,
  pitch: 0.02,
  // On a narrow view (a phone) the word flies high, above the day's composition over the central island.
  phonePitch: 0.5,
  depth: 0.6,
  spacing: 0.1,
  advance: 1.3,
  space: 0.75,
  maxPoints: 400,
  life: [3.6, 4.2],
  drag: 2.6,
  fall: 0.05
};
// The compact glyph set: digits, the few Cyrillic and Latin capitals the sky words use, and a star, as
// polylines in a 1 x 1.6 box, y up. Latin letters that look like Cyrillic ones share them.
const O = [[0.5, 1.6, 0.12, 1.32, 0, 0.8, 0.12, 0.28, 0.5, 0, 0.88, 0.28, 1, 0.8, 0.88, 1.32, 0.5, 1.6]],
  P = [0.1, 0, 0.1, 1.6, 0.68, 1.6, 0.95, 1.38, 0.95, 1.02, 0.68, 0.8, 0.1, 0.8];
const GLYPHS = {
  0: O,
  1: [[0.2, 1.25, 0.58, 1.6, 0.58, 0]],
  2: [[0.05, 1.25, 0.25, 1.53, 0.6, 1.6, 0.9, 1.4, 0.93, 1.05, 0.72, 0.7, 0.05, 0, 1, 0]],
  3: [[0.05, 1.4, 0.4, 1.6, 0.85, 1.5, 0.9, 1.15, 0.45, 0.85, 0.95, 0.55, 0.9, 0.15, 0.45, 0, 0.05, 0.2]],
  4: [[0.75, 0, 0.75, 1.6, 0, 0.45, 1, 0.45]],
  5: [[0.95, 1.6, 0.15, 1.6, 0.1, 0.9, 0.55, 1, 0.92, 0.75, 0.92, 0.3, 0.55, 0, 0.05, 0.15]],
  6: [
    [0.85, 1.5, 0.5, 1.6, 0.1, 1.25, 0, 0.6, 0.15, 0.15, 0.5, 0, 0.88, 0.2, 0.92, 0.6, 0.55, 0.88, 0.1, 0.7]
  ],
  7: [[0, 1.6, 1, 1.6, 0.35, 0]],
  8: [
    [0.5, 0.88, 0.12, 1.1, 0.15, 1.45, 0.5, 1.6, 0.85, 1.45, 0.88, 1.1, 0.5, 0.88],
    [0.5, 0.88, 0.05, 0.55, 0.12, 0.12, 0.5, 0, 0.88, 0.12, 0.95, 0.55, 0.5, 0.88]
  ],
  А: [
    [0, 0, 0.5, 1.6, 1, 0],
    [0.2, 0.62, 0.8, 0.62]
  ],
  В: [
    [0.1, 0, 0.1, 1.6, 0.62, 1.6, 0.86, 1.42, 0.86, 1.04, 0.6, 0.84, 0.1, 0.84],
    [0.6, 0.84, 0.95, 0.64, 0.95, 0.2, 0.68, 0, 0.1, 0]
  ],
  Г: [[0.15, 0, 0.15, 1.6, 0.9, 1.6]],
  Д: [
    [0, -0.25, 0, 0.25, 1, 0.25, 1, -0.25],
    [0.12, 0.25, 0.32, 1.6, 0.84, 1.6, 0.84, 0.25]
  ],
  Е: [
    [0.92, 1.6, 0.12, 1.6, 0.12, 0, 0.92, 0],
    [0.12, 0.82, 0.75, 0.82]
  ],
  Ж: [
    [0.5, 0, 0.5, 1.6],
    [0, 1.6, 0.5, 0.8, 1, 1.6],
    [0, 0, 0.5, 0.8, 1, 0]
  ],
  И: [[0.1, 1.6, 0.1, 0, 0.9, 1.6, 0.9, 0]],
  Й: [
    [0.1, 1.6, 0.1, 0, 0.9, 1.6, 0.9, 0],
    [0.3, 1.95, 0.5, 1.8, 0.7, 1.95]
  ],
  Л: [[0, 0, 0.38, 1.6, 0.92, 1.6, 0.92, 0]],
  М: [[0, 0, 0.04, 1.6, 0.5, 0.65, 0.96, 1.6, 1, 0]],
  Н: [
    [0.1, 0, 0.1, 1.6],
    [0.9, 0, 0.9, 1.6],
    [0.1, 0.8, 0.9, 0.8]
  ],
  О: O,
  Р: [P],
  С: [[0.95, 1.35, 0.65, 1.6, 0.3, 1.52, 0.06, 1.15, 0, 0.8, 0.06, 0.45, 0.3, 0.08, 0.65, 0, 0.95, 0.25]],
  Т: [
    [0, 1.6, 1, 1.6],
    [0.5, 1.6, 0.5, 0]
  ],
  R: [P, [0.55, 0.8, 0.95, 0]],
  D: [[0.1, 0, 0.1, 1.6, 0.55, 1.6, 0.85, 1.38, 0.95, 0.8, 0.85, 0.22, 0.55, 0, 0.1, 0]],
  I: [
    [0.5, 0, 0.5, 1.6],
    [0.2, 1.6, 0.8, 1.6],
    [0.2, 0, 0.8, 0]
  ],
  N: [[0.1, 0, 0.1, 1.6, 0.9, 0, 0.9, 1.6]],
  S: [
    [
      0.92, 1.38, 0.6, 1.6, 0.25, 1.55, 0.05, 1.25, 0.2, 0.95, 0.8, 0.68, 0.95, 0.35, 0.75, 0.05, 0.4, 0,
      0.05, 0.2
    ]
  ],
  X: [
    [0, 1.6, 1, 0],
    [1, 1.6, 0, 0]
  ],
  Y: [
    [0, 1.6, 0.5, 0.8, 1, 1.6],
    [0.5, 0.8, 0.5, 0]
  ],
  '<': [[0.95, 1.35, 0.05, 0.8, 0.95, 0.25]],
  '>': [[0.05, 1.35, 0.95, 0.8, 0.05, 0.25]],
  '/': [[0.15, 0, 0.85, 1.6]],
  [HEART]: [
    [0.5, 0.05, 0.12, 0.55, -0.08, 0.95, -0.06, 1.3, 0.12, 1.5, 0.35, 1.5, 0.5, 1.28],
    [0.5, 1.28, 0.65, 1.5, 0.88, 1.5, 1.06, 1.3, 1.08, 0.95, 0.88, 0.55, 0.5, 0.05]
  ]
};
GLYPHS[9] = GLYPHS[6].map(line => line.map((v, i) => (i % 2 ? 1.6 - v : 1 - v)));
Object.assign(GLYPHS, {
  A: GLYPHS.А,
  B: GLYPHS.В,
  C: GLYPHS.С,
  E: GLYPHS.Е,
  M: GLYPHS.М,
  O,
  P: [P],
  T: GLYPHS.Т
});
// A five-pointed star a little larger than a letter, centred in the box.
const starLine = (outer, inner) =>
  Array.from({ length: 11 }, (_, k) => {
    const a = (k * Math.PI) / 5,
      r = k % 2 ? inner : outer;
    return [0.5 + Math.sin(a) * r, 0.84 + Math.cos(a) * r];
  }).flat();
GLYPHS[STAR] = [starLine(0.92, 0.36)];
// The order star: a large gold outline and a red star inside it, each line in its own colour.
GLYPHS[ORDER_STAR] = [starLine(1.25, 0.5), starLine(0.62, 0.24), starLine(0.3, 0.12)];
const MULTI_GLYPHS = new Set([ORDER_STAR]);
export const GLYPH_SET = Object.keys(GLYPHS).join('');
// A character's strokes (polylines in the 1 x 1.6 box), for the solid numbers of celebration-stage.mjs.
export const glyphLines = char => GLYPHS[char] || null;

// Spark positions spelling `text`, centred on the origin in glyph units: x, y and the letter index per spark, and
// the word's width. Characters without a glyph are skipped; a space only advances. A long word spaces its
// sparks wider so it stays within FIGURE.maxPoints.
export function figurePoints(text, spacing = FIGURE.spacing) {
  const chars = [...String(text).toUpperCase()].filter(c => c === ' ' || GLYPHS[c]),
    length = chars.reduce((sum, c) => {
      for (const line of c === ' ' ? [] : GLYPHS[c])
        for (let k = 0; k + 3 < line.length; k += 2)
          sum += Math.hypot(line[k + 2] - line[k], line[k + 3] - line[k + 1]);
      return sum;
    }, 0),
    step = Math.max(spacing, (length * 1.05) / FIGURE.maxPoints),
    lefts = [],
    out = [];
  let left = 0,
    letter = 0;
  for (const c of chars) {
    lefts.push(left);
    left += c === ' ' ? FIGURE.space : FIGURE.advance;
  }
  const width = chars.length ? lefts.at(-1) + 1 : 0;
  chars.forEach((c, d) => {
    if (c === ' ') return;
    const x = lefts[d] - width / 2,
      // A two-colour glyph colours each line by its index instead of the letter's.
      multi = MULTI_GLYPHS.has(c);
    for (let line = 0; line < GLYPHS[c].length; line++) {
      const points = GLYPHS[c][line];
      for (let k = 0; k + 3 < points.length; k += 2) {
        const x0 = points[k],
          y0 = points[k + 1],
          dx = points[k + 2] - x0,
          dy = points[k + 3] - y0,
          steps = Math.max(1, Math.round(Math.hypot(dx, dy) / step)),
          // Each segment adds its start; the line's last segment also adds its end.
          last = k + 4 >= points.length ? 1 : 0;
        for (let s = 0; s < steps + last; s++)
          out.push(x + x0 + (dx * s) / steps, y0 + (dy * s) / steps - 0.8, letter + (multi ? line : 0));
      }
    }
    letter++;
  });
  return { points: new Float32Array(out), width, count: out.length / 3 };
}
// A queued volley of WORD_SHELL + n shells means word shell n.
const WORD_SHELL = 200;
// The opening show as [time (s), shells] in time order (the queue is read from the front). Word shell k takes
// over the shell nearest FIGURE.at[k], so the sky around it stays clear.
function openingShells(random, withWords) {
  const finale = SHOW.length - SHOW.finaleSpan,
    shells = [];
  for (let t = 0; t < finale - 0.4; t += SHOW.gap[0] + random() * (SHOW.gap[1] - SHOW.gap[0]))
    shells.push([t, random() < SHOW.pairs ? 2 : 1]);
  for (let k = 0; k < SHOW.finale; k++) shells.push([finale + (k * SHOW.finaleSpan) / (SHOW.finale - 1), 1]);
  if (withWords) placeWords(shells);
  return shells.sort((p, q) => p[0] - q[0]);
}
function placeWords(shells) {
  FIGURE.at.forEach((at, k) => {
    const plain = shells.filter(shell => shell[1] < WORD_SHELL),
      near = plain.reduce((best, shell) => (Math.abs(shell[0] - at) < Math.abs(best[0] - at) ? shell : best));
    near[0] = at;
    near[1] = WORD_SHELL + k;
  });
}
// A schedule that fell this far behind (hidden tab, long stall) slides forward instead of firing at once (ms).
const SLIP_MS = 1500;
// Shell anatomy. Sizes are shares of the burst radius, and the radius is a share of the distance, so a burst
// fills a similar part of the view on a desktop and on a phone.
export const SHELL = {
  rise: [1.15, 1.6],
  climb: [0.2, 0.3],
  radius: [0.09, 0.13],
  drag: 0.6,
  trail: 14,
  trailLife: [0.55, 0.85],
  trailSmokeLife: [1.6, 2.4],
  strandStep: 0.42,
  strandLife: [0.9, 1.3],
  smoke: 9,
  smokeLife: [4.5, 6],
  smokeDay: 0.2
};
// Where bursts go relative to the camera: a share of the half view across (at least `aside` off the middle, where
// the greeting and the announcement sit, and the number flies) and up, a share of the distance to the garden
// centre, and metres.
export const PLACE = {
  aside: 0.36,
  spread: 0.88,
  low: 0.06,
  high: 0.52,
  depth: [0.85, 1.35],
  near: 70,
  far: 260,
  clearance: 16,
  ceiling: 120
};
export const SPARK = {
  head: 0,
  trail: 1,
  star: 2,
  glitter: 3,
  strand: 4,
  flash: 5,
  smoke: 6,
  heart: 7,
  petal: 8,
  twinkle: 9,
  lantern: 10,
  confetti: 11,
  flag: 12
};
// Burst kinds at full density: share of shells, stars, inner stars of the second colour, strand sparks hanging
// from each willow star, drag (1/s), star life (s) and how fast the stars sink (share of the radius per s²).
export const BURSTS = [
  {
    name: 'peony',
    share: 0.38,
    stars: 84,
    pistil: 18,
    strands: 0,
    ring: false,
    glitter: false,
    gold: false,
    drag: 1.7,
    life: [1.7, 2.3],
    fall: 0.3
  },
  {
    name: 'ring',
    share: 0.2,
    stars: 54,
    pistil: 14,
    strands: 0,
    ring: true,
    glitter: false,
    gold: false,
    drag: 1.8,
    life: [1.6, 2.1],
    fall: 0.25
  },
  {
    name: 'willow',
    share: 0.24,
    stars: 40,
    pistil: 0,
    strands: 6,
    ring: false,
    glitter: false,
    gold: true,
    drag: 2.4,
    life: [3, 3.6],
    fall: 0.55
  },
  {
    name: 'glitter',
    share: 0.18,
    stars: 80,
    pistil: 0,
    strands: 0,
    ring: false,
    glitter: true,
    gold: false,
    drag: 1.6,
    life: [1.9, 2.5],
    fall: 0.3
  }
];
// Reduced motion: the burst simply opens where it is, slowly, without a rising shell, flash or twinkle.
export const CALM_BURST = {
  name: 'calm',
  share: 0,
  stars: 64,
  pistil: 0,
  strands: 0,
  ring: false,
  glitter: false,
  gold: false,
  drag: 1.1,
  life: [3.2, 3.8],
  fall: 0.12
};
const TAU = Math.PI * 2;

// The flag stripe at height share v (0 bottom): white, blue, red from the top.
const stripeOf = v => (v > 0.66 ? 0 : 1 + (v <= 0.33));
// allocation-free:start (pure helpers; checked by test-garden-celebrations.mjs)
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

// Position after t seconds of a spark that left x with velocity v, under drag k (1/s) and gravity g (m/s²).
// This is the closed form the vertex shader uses, so trails and strands lie exactly on their paths.
export function drift(out, x, y, z, vx, vy, vz, k, g, t) {
  const e = Math.exp(-k * t),
    reach = (1 - e) / k,
    fall = -g / k;
  out[0] = x + vx * reach;
  out[1] = y + fall * t + (vy - fall) * reach;
  out[2] = z + vz * reach;
  return out;
}

// The launch velocity that carries a shell from s to b in t seconds under the same drag and gravity.
export function aimVelocity(out, sx, sy, sz, bx, by, bz, k, g, t) {
  const e = Math.exp(-k * t),
    reach = (1 - e) / k,
    fall = -g / k;
  out[0] = (bx - sx) / reach;
  out[1] = (by - sy - fall * t) / reach + fall;
  out[2] = (bz - sz) / reach;
  return out;
}

// Where the next burst goes: ahead of the camera in the upper part of its view, about as far away as the garden
// centre (a little before or beyond it), never lower than the floor above the islands. Writes x, y, z and the
// distance from the camera.
export function placeBurst(out, view, ground, random = Math.random) {
  const side = random() * 2 - 1,
    across = PLACE.aside + Math.abs(side) * (PLACE.spread - PLACE.aside),
    yaw = view.yaw + (side < 0 ? -across : across) * view.hHalf,
    pitch = clamp(view.pitch + view.vHalf * (PLACE.low + random() * (PLACE.high - PLACE.low)), -1.2, 1.2),
    reach = Math.hypot(ground.cx - view.x, ground.cz - view.z),
    distance = clamp(
      reach * (PLACE.depth[0] + random() * (PLACE.depth[1] - PLACE.depth[0])),
      PLACE.near,
      PLACE.far
    );
  out[0] = view.x + Math.sin(yaw) * distance;
  out[1] = clamp(view.y + Math.tan(pitch) * distance, ground.floor, ground.floor + PLACE.ceiling);
  out[2] = view.z + Math.cos(yaw) * distance;
  out[3] = Math.hypot(distance, out[1] - view.y);
  return out;
}

// A point in the view: across and up are shares of the half view from its middle, depth a share of the way to
// the garden centre. Writes x, y, z (never below the floor) and the distance from the camera.
export function placeInView(out, view, ground, across, up, depth) {
  const yaw = view.yaw + across * view.hHalf,
    pitch = clamp(view.pitch + view.vHalf * up, -1.2, 1.2),
    distance = clamp(Math.hypot(ground.cx - view.x, ground.cz - view.z) * depth, PLACE.near, PLACE.far);
  out[0] = view.x + Math.sin(yaw) * distance;
  out[1] = clamp(view.y + Math.tan(pitch) * distance, ground.floor, ground.floor + PLACE.ceiling);
  out[2] = view.z + Math.cos(yaw) * distance;
  out[3] = Math.hypot(distance, out[1] - view.y);
  return out;
}

// A burst kind for a uniform number u in [0,1), by share.
export function pickBurst(u) {
  let total = 0;
  for (let k = 0; k < BURSTS.length; k++) {
    total += BURSTS[k].share;
    if (u < total) return k;
  }
  return BURSTS.length - 1;
}

// Particles one shell writes: head, flash, trail, stars with their strands, the inner stars and day smoke.
export function shellSize(burst, density = 1, day = 0, calm = false) {
  const stars = Math.round(burst.stars * density),
    pistil = Math.round(burst.pistil * density);
  if (calm) return stars + pistil;
  const trail = Math.round(SHELL.trail * density),
    smoke = day > SHELL.smokeDay ? Math.round(SHELL.smoke * density) : 0;
  return 2 + trail + stars * (1 + burst.strands) + pistil + smoke;
}
// Particles a number shell writes: head, flash and trail, then one spark per point of the digits.
export function figureSize(count, density = 1, calm = false) {
  return calm ? count : 2 + Math.round(SHELL.trail * density) + count;
}
// allocation-free:end

// Bloom renders into a 4x MSAA half-float target: nothing here may produce NaN (no pow/log/sqrt/atan), and the
// drag is kept above zero before it divides.
const vertexShader = `uniform float uTime;
  uniform float uPixel;
  uniform float uDay;
  uniform float uFlicker;
  uniform float uMaxSize;
  attribute vec3 aVelocity;
  attribute vec4 aMotion;
  attribute vec4 aLook;
  attribute float aKind;
  varying vec3 vColor;
  varying float vGlow;
  varying float vCover;
  varying float vSoft;
  varying float vShape;
  varying float vTurn;
  float hash(float n){
    return fract(sin(n)*43758.5453);
  }
  void main(){
    vColor=vec3(0.);
    vGlow=0.;
    vCover=0.;
    vSoft=0.;
    vShape=0.;
    vTurn=0.;
    float age=uTime-aMotion.x,life=max(aMotion.y,.001);
    if(age<0.||age>life){
      gl_Position=vec4(2.,2.,2.,1.);
      gl_PointSize=0.;
      return;
    }
    // Drag k and gravity g in closed form: the velocity relaxes towards the terminal fall -g/k.
    // Drifters keep their sway in the gravity slot instead.
    float kind=floor(aKind),g=(kind<6.5||(kind>10.5&&kind<11.5))?aMotion.w:0.,
        k=max(aMotion.z,.05),e=exp(-k*age);
    vec3 fall=vec3(0.,-g/k,0.);
    vec3 p=position+fall*age+(aVelocity-fall)*(1.-e)/k;
    float t=age/life,seed=fract(aKind),size=aLook.w,glow=0.,cover=0.,soft=0.,shape=0.,turn=0.;
    vec3 color=aLook.rgb;
    if(kind<.5){
      glow=.95+.05*sin(age*70.+seed*40.)*uFlicker;
    }
    else if(kind<1.5){
      // Trail: a dying spark at night, a growing puff of grey smoke by day.
      glow=(1.-t)*(1.-t)*.5*(1.-.7*uDay);
      cover=uDay*.26*(1.-t)*smoothstep(0.,.12,t);
      color=mix(color,vec3(.62,.61,.64),uDay*.8);
      size*=1.+uDay*2.6*t;
      soft=uDay;
    } else if(kind<3.5){
      // Stars open hot and pale, hold their colour, then fade; glitter stars twinkle as they die.
      color=mix(color,vec3(1.,.94,.84),(1.-smoothstep(0.,.2,t))*.5);
      glow=smoothstep(0.,.025,t)*(1.-smoothstep(.5,1.,t));
      size*=1.-.4*t;
      if(kind>2.5){
        float tw=step(.45,hash(seed*97.+floor(uTime*17.)));
        glow*=mix(1.,.2+1.4*tw,smoothstep(.35,.6,t)*uFlicker);
      }
    } else if(kind<4.5){
      glow=(1.-t)*.55;
      size*=1.-.5*t;
    }
    else if(kind<5.5){
      glow=(1.-t)*(1.-t)*.6;
      size*=.55+.9*t;
      soft=1.;
    }
    else if(kind<6.5){
      cover=smoothstep(0.,.1,t)*(1.-t)*.3*uDay;
      size*=1.+1.3*t;
      soft=1.;
      color=mix(vec3(.3,.29,.33),vec3(.66,.65,.69),uDay);
    }
    else if(kind>11.5){
      // Flag: the sparks fly together (v = offset * drag), then the cloth waves from the pole (seed = share of
      // the width; the gravity slot holds the amplitude) and its folds catch the light.
      float wave=smoothstep(1.2,3.2,age)*uFlicker,ph=age*2.3-seed*8.;
      p.y+=sin(ph)*aMotion.w*seed*wave;
      glow=smoothstep(0.,.05,t)*(1.-smoothstep(.86,1.,t))*(.86+.22*cos(ph)*wave*seed);
      cover=glow*uDay*.95;
      soft=.95;
    } else if(kind>10.5){
      // Confetti: tumbling flakes that flutter down.
      shape=2.;
      turn=seed*6.283+age*(4.+seed*5.)*uFlicker;
      glow=smoothstep(0.,.03,t)*(1.-smoothstep(.75,1.,t))*.95;
    } else{
      // Drifters (hearts, petals, twinkles, lanterns) fade in and out and sway (off for reduced motion).
      float fade=smoothstep(0.,.12,t)*(1.-smoothstep(.72,1.,t)),sway=aMotion.w*uFlicker;
      p.x+=sin(age*.8+seed*40.)*sway;
      p.z+=cos(age*.6+seed*30.)*sway;
      glow=fade*.75;
      if(kind<7.5)shape=1.;
      else if(kind<8.5){
        shape=2.;
        turn=seed*6.283+age*1.1*uFlicker;
      }
      else if(kind<9.5)glow=fade*(.6+.4*sin(age*2.1+seed*50.)*uFlicker);
      else{
        glow=fade*(.7+.08*sin(age*1.3+seed*20.)*uFlicker);
        soft=.6;
      }
    }
    glow*=1.+.5*uDay;
    if(kind>1.5&&kind<3.5)size*=1.+.3*uDay;
    vec4 mv=modelViewMatrix*vec4(p,1.);
    gl_PointSize=clamp(size*uPixel/max(1.,-mv.z),1.,uMaxSize);
    gl_Position=projectionMatrix*mv;
    vColor=color;
    vGlow=glow;
    vCover=cover;
    vSoft=soft;
    vShape=shape;
    vTurn=turn;
  }`;
const fragmentShader = `uniform float uDay;
  varying vec3 vColor;
  varying float vGlow;
  varying float vCover;
  varying float vSoft;
  varying float vShape;
  varying float vTurn;
  void main(){
    vec2 c=gl_PointCoord*2.-1.;
    float r=dot(c,c);
    if(vGlow+vCover<.002)discard;
    float light,cover;
    if(vShape>.5){
      // A heart from its implicit curve (x²+y²-1)³ = x²y³, or a turning petal (an ellipse): polynomials only.
      float m;
      if(vShape<1.5){
        vec2 q=vec2(c.x*1.25,.3-c.y*1.25);
        float a=dot(q,q)-1.;
        m=clamp(-(a*a*a-q.x*q.x*q.y*q.y*q.y)*30.,0.,1.);
      }
      else{
        float s=sin(vTurn),o=cos(vTurn);
        vec2 q=vec2(o*c.x-s*c.y,s*c.x+o*c.y);
        m=clamp((1.-q.x*q.x*3.4-q.y*q.y)*4.,0.,1.);
      }
      if(m<.01)discard;
      light=m*vGlow*(.8+.35*(1.-r));
      cover=m*vGlow*.35;
    } else{
      if(r>1.)discard;
      float edge=1.-r,puff=edge*edge;
      // A hot core with a soft halo; smoke and the flash are plain soft discs. Everything reaches zero at the rim.
      light=mix(exp(-r*6.)+.35*exp(-r*1.7),puff,vSoft)*edge*vGlow;
      cover=puff*vCover;
    }
    // Premultiplied: sparks add light; by day they also hide most of the bright sky under them so their colour
    // reads instead of washing out to white.
    gl_FragColor=vec4(vColor*(light+cover),clamp(cover+light*uDay*.75,0.,1.));
  #include <colorspace_fragment>
  }`;

// A queued volley of SHAPE_SHELL means the day's shape shell (a heart).
const SHAPE_SHELL = 150;

export function createFireworks(
  THREE,
  {
    occasion = 'birthday',
    compact = false,
    reduced = false,
    random = Math.random,
    figure: figureText = '',
    onWake = () => {},
    onSound = () => {},
    stillOn = () => true,
    watchVisibility = true
  } = {}
) {
  const soundTimeline = createFireworkTimeline(onSound);
  const pool = FIREWORKS.capacity,
    origin = new Float32Array(pool * 3),
    velocity = new Float32Array(pool * 3),
    motion = new Float32Array(pool * 4),
    look = new Float32Array(pool * 4),
    kinds = new Float32Array(pool);
  // Every slot starts long dead: born far in the past, with no life.
  for (let i = 0; i < pool; i++) motion[i * 4] = -1e6;
  const geometry = new THREE.BufferGeometry(),
    attributes = [];
  for (const [name, array, size] of [
    ['position', origin, 3],
    ['aVelocity', velocity, 3],
    ['aMotion', motion, 4],
    ['aLook', look, 4],
    ['aKind', kinds, 1]
  ]) {
    const attribute = new THREE.BufferAttribute(array, size);
    attribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute(name, attribute);
    attributes.push(attribute);
  }
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  const uniforms = {
    uTime: { value: 0 },
    uPixel: { value: 1000 },
    uDay: { value: 0 },
    uFlicker: { value: reduced ? 0 : 1 },
    uMaxSize: { value: 72 }
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor
  });
  const points = new THREE.Points(geometry, material);
  points.name = 'garden-fireworks';
  points.frustumCulled = false;
  // After the cloud sea (cloud-sea.mjs, 4), which writes no depth: with the same order the sort fell back to the
  // objects' ids, and after a rebuild the new clouds were drawn over the salute and the year spelled in sparks
  // (owner, round 9). Islands and buildings still hide the sparks behind them through the depth test.
  points.renderOrder = 5;
  points.visible = false;
  points.userData.dynamic = true;
  // What the occasion decides; setOccasion() swaps it on the same pool (Settings → Праздники previews).
  let profile, grand, nightPalette, dayPalette, wordTexts, words, shapeWord, drifter, kindList, burstScale;
  let hasBursts, cadence, palette;
  function configure(key, text) {
    profile = PROFILES[key] || PROFILES.birthday;
    grand = !!profile.grand;
    nightPalette = PALETTES[key] || PALETTES.birthday;
    dayPalette = DAY_PALETTES[key] || DAY_PALETTES.birthday;
    // The glyphs are turned into spark offsets once, here: a word shell only copies them.
    wordTexts = (Array.isArray(text) ? text : [text]).map(String).filter(Boolean);
    words = wordTexts.map(word => figurePoints(word)).filter(word => word.count > 0);
    shapeWord = profile.shape ? figurePoints(profile.shape) : null;
    drifter = DRIFT[profile.drift] || null;
    // Burst kinds this day uses, as BURSTS indices (the grand show picks by share instead).
    kindList = Uint8Array.from((profile.kinds || []).map(name => BURSTS.findIndex(b => b.name === name)));
    burstScale = profile.size || 1;
    hasBursts = grand || kindList.length > 0;
    cadence = grand
      ? {
          salvo: RHYTHM.salvo,
          economySalvo: RHYTHM.economySalvo,
          every: RHYTHM.salvoEvery,
          word: RHYTHM.wordEvery
        }
      : {
          salvo: profile.salvo || LIGHT.salvo,
          economySalvo: [1, 1],
          every: profile.every || LIGHT.every,
          word: LIGHT.wordEvery
        };
    palette = nightPalette;
  }
  configure(occasion, figureText);
  let capacity = compact ? FIREWORKS.compactCapacity : pool,
    density = compact ? FIREWORKS.compactDensity : 1,
    economy = !!compact,
    calm = !!reduced;
  geometry.setDrawRange(0, capacity);
  let clock = 0,
    last = null,
    activeUntil = -1,
    next = 0,
    dirtyFrom = pool,
    dirtyTo = -1,
    day = 0,
    launched = 0,
    overwritten = 0,
    figures = 0,
    shapes = 0,
    salvos = 0,
    waves = 0,
    rockets = 0,
    flags = 0,
    cheers = 0,
    indoorPops = 0,
    pops = 0,
    sparkles = 0,
    rocketFrom = -1e6,
    rocketFlight = 1,
    rocketLength = 1,
    wordCount = 0,
    reservedLast = 0,
    writtenLast = 0,
    riseTime = 0;
  const queue = new Float64Array(64),
    volley = new Uint8Array(64);
  let head = 0,
    tail = 0,
    salvoAt = Infinity,
    wordAt = Infinity,
    waveAt = Infinity,
    rocketAt = Infinity,
    flagAt = Infinity,
    partyAt = Infinity,
    paused = false,
    pausedAt = 0,
    wakeFor = -1,
    wakeTimer = 0;
  const view = { x: 0, y: 40, z: 120, yaw: Math.PI, pitch: -0.4, vHalf: 0.42, hHalf: 0.7 },
    ground = { floor: 22, cx: 0, cz: 0 },
    burst = new Float64Array(4),
    at = new Float64Array(3),
    aim = new Float64Array(3),
    flashColor = new Float32Array(3),
    dir = new THREE.Vector3(),
    up = new THREE.Vector3(0, 1, 0),
    spot = new THREE.Vector3(),
    pathPoints = new Float64Array(12),
    partyNear = new Uint8Array(PARTY.max),
    partyCheer = new Float64Array(PARTY.max),
    partyIndoor = new Float64Array(PARTY.max);
  // The birthday pavilions (setParty) and the rocket model, made with the first scene.
  let partyGroups = [],
    rocket = null;

  // allocation-free:start (everything a frame or a launch runs; checked by test-garden-celebrations.mjs)
  function between(range) {
    return range[0] + random() * (range[1] - range[0]);
  }
  // A gap of the rhythm in ms: longer with the economy setting.
  function gap(range) {
    return between(range) * (economy ? RHYTHM.economyStretch : 1) * 1000;
  }
  // A contiguous block per shell, so one upload range covers it; the pool wraps to the start when full.
  function reserve(count) {
    if (next + count > capacity) next = 0;
    const start = next;
    next += count;
    for (let k = start; k < next; k++) if (motion[k * 4] + motion[k * 4 + 1] > clock) overwritten++;
    if (start < dirtyFrom) dirtyFrom = start;
    if (next - 1 > dirtyTo) dirtyTo = next - 1;
    reservedLast = count;
    return start;
  }
  // One spark: kind, birth time and life (s), drag (1/s), gravity (m/s²); the fraction of aKind is its seed.
  function put(i, kind, birth, life, drag, gravity) {
    motion[i * 4] = birth;
    motion[i * 4 + 1] = life;
    motion[i * 4 + 2] = drag;
    motion[i * 4 + 3] = gravity;
    kinds[i] = kind + random() * 0.9;
    if (birth + life > activeUntil) activeUntil = birth + life;
  }
  function move(i, x, y, z, vx, vy, vz) {
    origin[i * 3] = x;
    origin[i * 3 + 1] = y;
    origin[i * 3 + 2] = z;
    velocity[i * 3] = vx;
    velocity[i * 3 + 1] = vy;
    velocity[i * 3 + 2] = vz;
  }
  function paint(i, rgb, gain, size) {
    look[i * 4] = rgb[0] * gain;
    look[i * 4 + 1] = rgb[1] * gain;
    look[i * 4 + 2] = rgb[2] * gain;
    look[i * 4 + 3] = size;
  }
  function writeStars(i, type, bx, by, bz, radius, birth, first, second) {
    const stars = Math.round(type.stars * density),
      pistil = Math.round(type.pistil * density),
      kind = type.glitter ? SPARK.glitter : SPARK.star,
      colour = type.gold ? WILLOW : first,
      gravity = radius * type.fall;
    // A ring lies in a plane turned roughly towards the camera, so it reads as a ring and not a line.
    let nx = view.x - bx + (random() - 0.5) * radius * 9,
      ny = view.y - by + (random() - 0.5) * radius * 9,
      nz = view.z - bz + (random() - 0.5) * radius * 9;
    const n = Math.hypot(nx, ny, nz) || 1;
    nx /= n;
    ny /= n;
    nz /= n;
    const across = Math.hypot(nx, nz) || 1,
      ux = -nz / across,
      uz = nx / across,
      wx = ny * uz,
      wy = nz * ux - nx * uz,
      wz = -ny * ux;
    for (let s = 0; s < stars + pistil; s++) {
      const inner = s >= stars,
        speed = radius * type.drag * (inner ? 0.42 : 0.9 + random() * 0.14);
      let dx, dy, dz;
      if (type.ring && !inner) {
        const a = (s / stars) * TAU + random() * 0.05,
          ca = Math.cos(a),
          sa = Math.sin(a);
        dx = ux * ca + wx * sa;
        dy = wy * sa;
        dz = uz * ca + wz * sa;
      } else {
        const up = random() * 2 - 1,
          phi = random() * TAU,
          flat = Math.sqrt(1 - up * up);
        dx = flat * Math.cos(phi);
        dy = up;
        dz = flat * Math.sin(phi);
      }
      put(i, kind, birth, between(type.life) * (inner ? 0.8 : 1), type.drag, gravity);
      move(i, bx, by, bz, dx * speed, dy * speed, dz * speed);
      paint(i, inner ? second : colour, STAR_GAIN, radius * (type.gold ? 0.1 : 0.12));
      i++;
      // Willow strands: sparks left along each star's path that hang and fade.
      for (let m = 1; m <= type.strands && !inner; m++) {
        const tau = m * SHELL.strandStep;
        drift(at, bx, by, bz, dx * speed, dy * speed, dz * speed, type.drag, gravity, tau);
        put(i, SPARK.strand, birth + tau, between(SHELL.strandLife), 3, radius * 0.2);
        move(i, at[0], at[1], at[2], 0, -radius * 0.04, 0);
        paint(i, WILLOW, 0.7, radius * 0.05);
        i++;
      }
    }
    return i;
  }
  function writeSmoke(i, bx, by, bz, radius, birth) {
    const puffs = Math.round(SHELL.smoke * density),
      spread = radius * 1.1;
    for (let k = 0; k < puffs; k++) {
      put(i, SPARK.smoke, birth + 0.15 + random() * 0.4, between(SHELL.smokeLife), 0.5, -radius * 0.03);
      move(
        i,
        bx + (random() - 0.5) * spread,
        by + (random() - 0.5) * spread,
        bz + (random() - 0.5) * spread,
        (random() - 0.5) * radius * 0.12,
        radius * 0.04,
        (random() - 0.5) * radius * 0.12
      );
      paint(i, SMOKE, 1, radius * 0.55);
      i++;
    }
    return i;
  }
  // The rising shell (head and trail) that ends at b, and the flash where it opens; riseTime is its flight.
  function rise(i, bx, by, bz, distance, radius, colour) {
    const flight = between(SHELL.rise),
      climb = distance * between(SHELL.climb),
      sx = bx + (random() - 0.5) * radius * 0.8,
      sy = by - climb,
      sz = bz + (random() - 0.5) * radius * 0.8,
      gravity = (1.6 * climb) / (flight * flight),
      trail = Math.round(SHELL.trail * density),
      trailLife = between(day > SHELL.smokeDay ? SHELL.trailSmokeLife : SHELL.trailLife);
    aimVelocity(aim, sx, sy, sz, bx, by, bz, SHELL.drag, gravity, flight);
    put(i, SPARK.head, clock, flight, SHELL.drag, gravity);
    move(i, sx, sy, sz, aim[0], aim[1], aim[2]);
    paint(i, EMBER, 1, radius * 0.07);
    i++;
    for (let k = 0; k < trail; k++) {
      const t = (flight * (k + 0.5)) / trail,
        jitter = radius * 0.12;
      drift(at, sx, sy, sz, aim[0], aim[1], aim[2], SHELL.drag, gravity, t);
      put(i, SPARK.trail, clock + t, trailLife * (0.8 + random() * 0.4), 2.4, radius * 0.25);
      move(i, at[0], at[1], at[2], (random() - 0.5) * jitter, -radius * 0.05, (random() - 0.5) * jitter);
      paint(i, EMBER, 0.75, radius * 0.05);
      i++;
    }
    for (let c = 0; c < 3; c++) flashColor[c] = 0.5 + 0.5 * colour[c];
    put(i, SPARK.flash, clock + flight, 0.3, 1, 0);
    move(i, bx, by, bz, 0, 0, 0);
    paint(i, flashColor, 0.6, radius * 0.9);
    riseTime = flight;
    return i + 1;
  }
  // The grand show picks by share; a light day from its own kinds.
  function burstType() {
    return grand ? BURSTS[pickBurst(random())] : BURSTS[kindList[Math.floor(random() * kindList.length)]];
  }
  function launch() {
    if (!hasBursts) return;
    placeBurst(burst, view, ground, random);
    palette = day > DAY_PALETTE_FROM ? dayPalette : nightPalette;
    const bx = burst[0],
      by = burst[1],
      bz = burst[2],
      distance = burst[3],
      radius = distance * between(SHELL.radius) * burstScale,
      type = calm ? CALM_BURST : burstType(),
      a = Math.floor(random() * palette.length),
      b = (a + 1 + Math.floor(random() * (palette.length - 1))) % palette.length,
      start = reserve(shellSize(type, density, day, calm));
    let i = start,
      birth = clock;
    if (!calm) {
      i = rise(i, bx, by, bz, distance, radius, palette[a]);
      birth = clock + riseTime;
    }
    soundTimeline.shell(clock, birth, burstScale, !calm);
    i = writeStars(i, type, bx, by, bz, radius, birth, palette[a], palette[b]);
    if (!calm && day > SHELL.smokeDay) i = writeSmoke(i, bx, by, bz, radius, birth);
    writtenLast = i - start;
    launched++;
  }
  // A word shell rises to the middle of the view, well short of the garden centre so it hangs in the air under
  // the greeting, and opens into the letters: each spark flies out to its point of the glyph (v = offset · drag,
  // so it settles there) and hangs while it glows. The word faces the camera and is sized to fit the view width.
  // A shape shell (aside = true) opens the same way where a normal burst would, at a burst's size.
  function launchFigure(word, aside) {
    palette = day > DAY_PALETTE_FROM ? dayPalette : nightPalette;
    let bx, by, bz, distance, unit;
    if (aside) {
      placeBurst(burst, view, ground, random);
      bx = burst[0];
      by = burst[1];
      bz = burst[2];
      distance = burst[3];
      unit = (distance * between(SHELL.radius) * burstScale) / 0.8;
    } else {
      const reach =
          clamp(Math.hypot(ground.cx - view.x, ground.cz - view.z), PLACE.near, PLACE.far) * FIGURE.depth,
        wide = view.hHalf > view.vHalf * 1.2,
        pitch = clamp(view.pitch + view.vHalf * (wide ? FIGURE.pitch : FIGURE.phonePitch), -1.2, 1.2);
      const half = Math.tan(view.hHalf) * reach,
        offset = wide ? FIGURE.shift * half : 0;
      bx = view.x + Math.sin(view.yaw) * reach - Math.cos(view.yaw) * offset;
      by = Math.min(view.y + Math.tan(pitch) * reach, ground.floor + PLACE.ceiling);
      bz = view.z + Math.cos(view.yaw) * reach + Math.sin(view.yaw) * offset;
      distance = Math.hypot(reach, by - view.y);
      unit = Math.min(
        (distance * FIGURE.height) / 1.6,
        ((wide ? FIGURE.wideFit : FIGURE.fit) * 2 * half) / Math.max(1, word.width)
      );
    }
    const rx = -Math.cos(view.yaw),
      rz = Math.sin(view.yaw),
      k = FIGURE.drag,
      tint = Math.floor(random() * palette.length),
      start = reserve(figureSize(word.count, density, calm));
    let i = start,
      birth = clock;
    if (!calm) {
      i = rise(i, bx, by, bz, distance, unit * 1.6, palette[aside ? tint : 0]);
      birth = clock + riseTime;
    }
    soundTimeline.shell(clock, birth, 0.65, !calm);
    for (let s = 0; s < word.count; s++) {
      const ox = word.points[s * 3] * unit,
        oy = word.points[s * 3 + 1] * unit,
        colour = aside ? tint : word.points[s * 3 + 2] % palette.length;
      put(i, SPARK.star, birth + random() * 0.08, between(FIGURE.life), k, unit * 1.6 * FIGURE.fall);
      move(i, bx, by, bz, rx * ox * k, oy * k, rz * ox * k);
      paint(i, palette[colour], STAR_GAIN, unit * 0.15);
      i++;
    }
    writtenLast = i - start;
    launched++;
    if (aside) shapes++;
    else figures++;
  }
  // A wave of drifting sparks spread over the whole view; reduced motion holds them still.
  function writeWave() {
    const count = Math.round(LIGHT.wave * (profile.wave || 1) * density),
      start = reserve(count);
    palette = day > DAY_PALETTE_FROM ? dayPalette : nightPalette;
    let i = start;
    for (let s = 0; s < count; s++) {
      placeInView(
        burst,
        view,
        ground,
        (random() * 2 - 1) * 0.95,
        between(drifter.band),
        between(PLACE.depth) * 0.8
      );
      const distance = burst[3],
        speed = calm ? 0 : distance * drifter.rise,
        sideways = calm ? 0 : distance * 0.002 * (random() - 0.5);
      // The gravity slot carries the sway (m) for a drifter.
      put(
        i,
        drifter.kind,
        clock + random() * LIGHT.waveSpread,
        between(LIGHT.waveLife),
        0.05,
        distance * drifter.size * drifter.sway
      );
      move(i, burst[0], burst[1], burst[2], sideways, speed, sideways);
      paint(
        i,
        palette[Math.floor(random() * palette.length)],
        1.1,
        distance * drifter.size * (0.8 + random() * 0.4)
      );
      i++;
    }
    writtenLast = i - start;
    waves++;
  }
  // The rocket's path: a cubic curve through the four points of ROCKET.path (pathPoints, x y z each).
  function onPath(out, u) {
    const v = 1 - u,
      a = v * v * v,
      b = 3 * v * v * u,
      c = 3 * v * u * u,
      d = u * u * u;
    for (let n = 0; n < 3; n++)
      out[n] = a * pathPoints[n] + b * pathPoints[3 + n] + c * pathPoints[6 + n] + d * pathPoints[9 + n];
    return out;
  }
  // Its unit direction at u.
  function alongPath(out, u) {
    const v = 1 - u,
      a = 3 * v * v,
      b = 6 * v * u,
      c = 3 * u * u;
    for (let n = 0; n < 3; n++)
      out[n] =
        a * (pathPoints[3 + n] - pathPoints[n]) +
        b * (pathPoints[6 + n] - pathPoints[3 + n]) +
        c * (pathPoints[9 + n] - pathPoints[6 + n]);
    const length = Math.hypot(out[0], out[1], out[2]) || 1;
    out[0] /= length;
    out[1] /= length;
    out[2] /= length;
    return out;
  }
  // The cosmonautics rocket: the model flies the path (moved each frame in update), its exhaust and smoke are
  // written once here along the same path, each spark born as the nozzle passes.
  function launchRocket() {
    const flight = between(ROCKET.flight),
      side = random() < 0.5 ? -1 : 1,
      trail = Math.round(ROCKET.trail * density),
      smoke = day > SHELL.smokeDay ? Math.round(ROCKET.smoke * density) : 0,
      start = reserve(trail + smoke);
    let reach = 0;
    for (let k = 0; k < 4; k++) {
      placeInView(burst, view, ground, ROCKET.path[k][0] * side, ROCKET.path[k][1], ROCKET.depth);
      pathPoints[k * 3] = burst[0];
      pathPoints[k * 3 + 1] = burst[1];
      pathPoints[k * 3 + 2] = burst[2];
      reach += burst[3] / 4;
    }
    const length = reach * ROCKET.size;
    rocketFrom = clock;
    rocketFlight = flight;
    rocketLength = length;
    let i = start;
    for (let k = 0; k < trail + smoke; k++) {
      const puff = k >= trail,
        t = (flight * ((puff ? k - trail : k) + 0.5)) / (puff ? smoke : trail);
      onPath(at, t / flight);
      alongPath(aim, t / flight);
      const back = length * (puff ? 0.9 : 0.62),
        jitter = length * 0.5;
      if (puff) {
        put(i, SPARK.smoke, clock + t, between(ROCKET.smokeLife), 0.5, -length * 0.05);
        paint(i, SMOKE, 1, length * 1.1);
      } else {
        put(i, SPARK.trail, clock + t, between(ROCKET.trailLife), 2.4, length * 0.12);
        // Brighter and bigger than a shell trail: the exhaust is what makes the rocket read at a distance.
        paint(i, EMBER, 1.8, length * 0.42);
      }
      move(
        i,
        at[0] - aim[0] * back,
        at[1] - aim[1] * back,
        at[2] - aim[2] * back,
        -aim[0] * length * 1.6 + (random() - 0.5) * jitter,
        -aim[1] * length * 1.6 + (random() - 0.5) * jitter,
        -aim[2] * length * 1.6 + (random() - 0.5) * jitter
      );
      i++;
    }
    writtenLast = i - start;
    rockets++;
  }
  // The model follows the path while the flight lasts; the flame flickers (still for reduced motion).
  function flyRocket() {
    if (!rocket) return;
    const u = (clock - rocketFrom) / rocketFlight,
      flying = u >= 0 && u < 1;
    rocket.group.visible = flying;
    if (!flying) return;
    onPath(at, u);
    alongPath(aim, u);
    rocket.group.position.set(at[0], at[1], at[2]);
    dir.set(aim[0], aim[1], aim[2]);
    rocket.group.quaternion.setFromUnitVectors(up, dir);
    rocket.group.scale.setScalar(rocketLength);
    const flicker =
      1 + ROCKET.flicker * Math.sin(clock * 41) * Math.sin(clock * 17) * uniforms.uFlicker.value;
    rocket.flame.scale.set(1, flicker, 1);
    // Lit by the day; at night its own flame and the glow keep it readable.
    rocket.body.material.color.setScalar(0.6 + 0.4 * day);
  }
  // Russia Day's flag: every spark flies from a scattered start to its place in the cloth (v = offset · drag,
  // so it settles there); the gold pole on the left holds still, the cloth waves in the shader.
  function launchFlag() {
    const reach =
        clamp(Math.hypot(ground.cx - view.x, ground.cz - view.z), PLACE.near, PLACE.far) * FLAG.depth,
      wide = view.hHalf > view.vHalf * 1.2,
      pitch = clamp(view.pitch + view.vHalf * (wide ? FLAG.up : FLAG.phoneUp), -1.2, 1.2),
      // On a wide view it hangs right of the greeting and the announcement cards in the middle.
      yaw = view.yaw - (wide ? FLAG.across * view.hHalf : 0),
      width = 2 * Math.tan(view.hHalf) * reach * (wide ? FLAG.width : FLAG.phoneWidth),
      height = width * FLAG.aspect,
      cols = Math.max(12, Math.round(FLAG.cols * Math.sqrt(density))),
      rows = Math.max(8, Math.round(cols * FLAG.aspect)),
      step = width / (cols - 1),
      poles = Math.round((height * FLAG.pole) / step),
      cloth = cols * rows,
      cx = view.x + Math.sin(yaw) * reach,
      cy = Math.min(view.y + Math.tan(pitch) * reach, ground.floor + PLACE.ceiling),
      cz = view.z + Math.cos(yaw) * reach,
      rx = -Math.cos(yaw),
      rz = Math.sin(yaw),
      k = FLAG.drag,
      colours = day > DAY_PALETTE_FROM ? FLAG_COLOURS.day : FLAG_COLOURS.night,
      start = reserve(cloth + poles);
    let i = start;
    for (let s = 0; s < cloth + poles; s++) {
      const pole = s >= cloth,
        u = pole ? 0 : (s % cols) / (cols - 1),
        v = pole ? 0 : Math.floor(s / cols) / (rows - 1),
        across = pole ? -width / 2 - step * 0.8 : (u - 0.5) * width,
        upward = pole ? height / 2 + step - (s - cloth) * step : (v - 0.5) * height,
        tx = cx + rx * across,
        ty = cy + upward,
        tz = cz + rz * across;
      let sx = tx,
        sy = ty,
        sz = tz;
      if (!calm) {
        const lift = random() * 2 - 1,
          phi = random() * TAU,
          flat = Math.sqrt(1 - lift * lift),
          out = width * between(FLAG.spread);
        sx = cx + flat * Math.cos(phi) * out;
        sy = cy + lift * out * 0.6;
        sz = cz + flat * Math.sin(phi) * out;
      }
      put(
        i,
        SPARK.flag,
        clock + (calm ? 0 : random() * FLAG.gather),
        between(FLAG.life),
        k,
        height * FLAG.wave
      );
      // The seed is the share of the width: the cloth waves more towards its free end.
      kinds[i] = SPARK.flag + u * 0.9;
      move(i, sx, sy, sz, (tx - sx) * k, (ty - sy) * k, (tz - sz) * k);
      paint(
        i,
        pole ? FLAG_COLOURS.pole : colours[stripeOf(v)],
        day > DAY_PALETTE_FROM ? FLAG.gain : FLAG.nightGain,
        step * FLAG.size * (pole ? 0.8 : 1)
      );
      i++;
    }
    writtenLast = i - start;
    flags++;
  }
  // A point of birthday pavilion k in world space (offset in its frame); one shared vector.
  // A party place (PARTY: door, fountains, sign, roof, inside) of pavilion k: the house's own (greenhouse.mjs) or
  // the pavilion's numbers, then into the world.
  function partyPlace(k, key) {
    return partyGroups[k].userData.party?.[key] ?? PARTY[key];
  }
  function partyPoint(k, offset) {
    return spot.set(offset[0], offset[1], offset[2]).applyMatrix4(partyGroups[k].matrixWorld);
  }
  // A stage fountain (gerb): gold and white sparks shot up over PARTY.span s.
  function fountain(x, y, z) {
    const count = Math.round(PARTY.fountain * density),
      start = reserve(count);
    let i = start;
    for (let s = 0; s < count; s++) {
      const speed = between(PARTY.speed),
        a = random() * TAU,
        lean = random() * 0.16;
      put(i, SPARK.glitter, clock + (s / count) * PARTY.span, between(PARTY.fountainLife), 0.8, 9.8);
      move(i, x, y, z, Math.cos(a) * lean * speed, speed, Math.sin(a) * lean * speed);
      paint(i, random() < 0.7 ? PARTY_GOLD : PARTY_WHITE, STAR_GAIN, 0.22);
      i++;
    }
    writtenLast = i - start;
  }
  // Confetti flakes thrown up and out from a point, fluttering down; with stars, a ring of party stars too.
  // scale 1 is a burst seen from close by; a distant pop scales with the distance.
  function confettiPop(x, y, z, scale, stars) {
    const flakes = Math.round(PARTY.confetti * density),
      ring = stars ? Math.round(PARTY.popStars * density) : 0,
      start = reserve(flakes + ring),
      colours = day > DAY_PALETTE_FROM ? DAY_PALETTES.project : PALETTES.project;
    let i = start;
    for (let s = 0; s < flakes + ring; s++) {
      const star = s >= flakes,
        lift = star ? random() * 2 - 1 : 0.15 + random() * 0.85,
        phi = random() * TAU,
        flat = Math.sqrt(1 - lift * lift),
        speed = scale * (star ? 4.6 + random() * 0.6 : 3 + random() * 4.5),
        colour = colours[Math.floor(random() * colours.length)];
      if (star) {
        put(i, SPARK.star, clock + 0.05, between(BURSTS[0].life), 1.7, scale * 0.6);
        paint(i, colour, STAR_GAIN, scale * 0.3);
      } else {
        put(i, SPARK.confetti, clock + random() * 0.12, between(PARTY.confettiLife), 1.6, scale * 2);
        paint(i, colour, CONFETTI_GAIN, scale * 0.17);
      }
      move(i, x, y, z, flat * Math.cos(phi) * speed, lift * speed, flat * Math.sin(phi) * speed);
      i++;
    }
    writtenLast = i - start;
  }
  // A birthday stage's sparkle (SPARKLE): a glitter fountain and confetti in the stage's colours, sized by
  // scale (the stage's own); reduced motion throws nothing.
  function sparkle(x, y, z, scale, colours) {
    if (calm || paused) return;
    const sparks = Math.round(SPARKLE.fountain * density),
      flakes = Math.round(SPARKLE.confetti * density),
      start = reserve(sparks + flakes);
    let i = start;
    for (let s = 0; s < sparks + flakes; s++) {
      const flake = s >= sparks,
        a = random() * TAU,
        colour = colours[Math.floor(random() * colours.length)];
      if (flake) {
        const lift = 0.3 + random() * 0.7,
          flat = Math.sqrt(1 - lift * lift),
          speed = scale * (3 + random() * 4);
        put(i, SPARK.confetti, clock + random() * 0.15, between(PARTY.confettiLife), 1.6, scale * 2);
        move(i, x, y, z, flat * Math.cos(a) * speed, lift * speed, flat * Math.sin(a) * speed);
        paint(i, colour, CONFETTI_GAIN, scale * 0.2);
      } else {
        const speed = between(SPARKLE.speed) * scale,
          lean = random() * 0.2;
        put(i, SPARK.glitter, clock + (s / sparks) * SPARKLE.span, between(SPARKLE.life), 0.8, 9.8 * scale);
        move(i, x, y, z, Math.cos(a) * lean * speed, speed, Math.sin(a) * lean * speed);
        paint(i, random() < 0.3 ? PARTY_WHITE : colour, STAR_GAIN, 0.26 * scale);
      }
      i++;
    }
    writtenLast = i - start;
    sparkles++;
  }
  // The visitor at the door of birthday pavilion k: fountains on both sides of the entrance, confetti over it.
  function cheer(k) {
    for (const at of partyPlace(k, 'fountains')) {
      partyPoint(k, at);
      fountain(spot.x, spot.y, spot.z);
    }
    partyPoint(k, partyPlace(k, 'sign'));
    confettiPop(spot.x, spot.y, spot.z, 1, false);
    partyCheer[k] = clock;
    cheers++;
  }
  // Approaches are checked every frame; the pops over the roofs keep their own clock (partyAt).
  function keepParty(now) {
    if (calm || !partyGroups.length) return;
    for (let k = 0; k < partyGroups.length; k++) {
      partyPoint(k, partyPlace(k, 'door'));
      const distance = Math.hypot(spot.x - view.x, spot.y - view.y, spot.z - view.z);
      if (distance < PARTY.near) {
        if (!partyNear[k] || clock - partyCheer[k] > PARTY.repeat) {
          partyNear[k] = 1;
          cheer(k);
        }
      } else if (distance > PARTY.far) partyNear[k] = 0;
      partyPoint(k, partyPlace(k, 'inside'));
      if (
        Math.hypot(spot.x - view.x, spot.y - view.y, spot.z - view.z) < PARTY.indoor &&
        clock - partyIndoor[k] > PARTY.indoorEvery
      ) {
        partyIndoor[k] = clock;
        confettiPop(spot.x, spot.y, spot.z, PARTY.indoorScale, false);
        indoorPops++;
      }
    }
    if (partyAt > now) return;
    for (let k = 0; k < partyGroups.length; k++) {
      partyPoint(k, partyPlace(k, 'roof'));
      const distance = Math.hypot(spot.x - view.x, spot.y - view.y, spot.z - view.z);
      // Close by, the fountains celebrate instead.
      if (distance > PARTY.far)
        confettiPop(spot.x, spot.y, spot.z, Math.max(1, distance * PARTY.popScale), true);
    }
    pops++;
    partyAt = now + gap(PARTY.popEvery);
  }
  function flush() {
    if (dirtyTo < dirtyFrom) return;
    // three records each range as a small object: once per launch frame, never on an idle frame.
    for (let k = 0; k < attributes.length; k++) {
      const attribute = attributes[k],
        size = attribute.itemSize;
      attribute.clearUpdateRanges();
      attribute.addUpdateRange(dirtyFrom * size, (dirtyTo - dirtyFrom + 1) * size);
      attribute.needsUpdate = true;
    }
    dirtyFrom = pool;
    dirtyTo = -1;
  }
  function aimFrom(camera, viewHeight) {
    camera.getWorldDirection(dir);
    view.x = camera.position.x;
    view.y = camera.position.y;
    view.z = camera.position.z;
    view.yaw = Math.atan2(dir.x, dir.z);
    view.pitch = Math.asin(clamp(dir.y, -1, 1));
    view.vHalf = (camera.fov * Math.PI) / 360;
    view.hHalf = Math.atan(Math.tan(view.vHalf) * camera.aspect);
    uniforms.uPixel.value = viewHeight / (2 * Math.tan(view.vHalf));
    uniforms.uMaxSize.value = clamp(viewHeight * 0.08, 48, 256);
  }
  function wake() {
    wakeFor = -1;
    wakeTimer = 0;
    if (!paused) onWake();
  }
  function nextDue() {
    let due = Math.min(salvoAt, wordAt, waveAt, rocketAt, flagAt, partyAt);
    if (head < tail && queue[head] < due) due = queue[head];
    return due;
  }
  // While nothing is in the air the garden may stop rendering; a timer wakes it for the next shell.
  function sleepUntilNext(now) {
    const due = paused ? Infinity : nextDue();
    if (due === wakeFor) return;
    clearTimeout(wakeTimer);
    wakeFor = due;
    wakeTimer = due === Infinity ? 0 : setTimeout(wake, Math.max(0, due - now));
  }
  // Every pending time moves by shift ms (a hidden tab, a long stall).
  function slide(shift) {
    for (let k = head; k < tail; k++) queue[k] += shift;
    salvoAt += shift;
    wordAt += shift;
    waveAt += shift;
    rocketAt += shift;
    flagAt += shift;
    partyAt += shift;
  }
  function schedule(time, shells) {
    if (tail >= queue.length) return;
    queue[tail] = time;
    volley[tail++] = shells;
  }
  function stopRhythm() {
    salvoAt = wordAt = waveAt = rocketAt = flagAt = partyAt = Infinity;
  }
  // A shell of the rhythm: a plain one, or (on Valentine's Day) now and then a heart.
  function nextShell() {
    return shapeWord && random() < profile.shapes ? SHAPE_SHELL : 1;
  }
  // A queued volley: that many shells, a word, the day's shape or the rocket.
  function fire(shells) {
    if (shells >= WORD_SHELL) {
      if (words.length) launchFigure(words[(shells - WORD_SHELL) % words.length], false);
    } else if (shells === SHAPE_SHELL) launchFigure(shapeWord, true);
    else for (let n = shells; n > 0; n--) launch();
  }
  // The rhythm after the opening: a word when due (kept clear of salvos), else a salvo.
  function keepTime(now) {
    if (head < tail || (wordAt > now && salvoAt > now)) return;
    head = tail = 0;
    if (wordAt <= now) {
      schedule(now, WORD_SHELL + (wordCount++ % words.length));
      wordAt = now + gap(cadence.word);
      if (salvoAt < now + RHYTHM.wordClear * 1000) salvoAt = now + RHYTHM.wordClear * 1000;
      return;
    }
    const count = Math.round(between(economy ? cadence.economySalvo : cadence.salvo));
    let time = now;
    for (let k = 0; k < count; k++) {
      schedule(time, nextShell());
      time += between(RHYTHM.shotGap) * 1000;
    }
    salvos++;
    salvoAt = now + gap(cadence.every);
    if (wordAt < time + RHYTHM.wordClear * 1000) wordAt = time + RHYTHM.wordClear * 1000;
  }
  // The light days' waves of drifters and the rocket, on their own clocks.
  function keepAmbient(now) {
    if (waveAt <= now) {
      if (drifter) writeWave();
      waveAt = calm || !drifter ? Infinity : now + gap(LIGHT.waveEvery);
    }
    if (rocketAt <= now) {
      launchRocket();
      rocketAt = calm ? Infinity : now + gap(LIGHT.rocketEvery);
    }
    if (flagAt <= now) {
      launchFlag();
      flagAt = calm ? Infinity : now + gap(FLAG.every);
    }
  }
  function fireDue(now) {
    while (head < tail && queue[head] <= now) fire(volley[head++]);
  }
  // now: the frame time (ms); daylightLevel: daylight() of the current lighting.
  function update(now, camera, viewHeight = 900, daylightLevel = 0) {
    const dt = last === null ? 0 : Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    clock += dt;
    day = daylightLevel;
    uniforms.uDay.value = daylightLevel;
    if (camera) aimFrom(camera, viewHeight);
    if (!paused) {
      const late = now - nextDue();
      if (late > SLIP_MS) slide(late);
      fireDue(now);
      if (nextDue() <= now && !stillOn()) {
        head = tail = 0;
        stopRhythm();
      }
      keepAmbient(now);
      keepParty(now);
      fireDue(now);
      if (hasBursts) keepTime(now);
      fireDue(now);
    }
    if (paused) soundTimeline.clear();
    else soundTimeline.update(clock);
    flush();
    flyRocket();
    uniforms.uTime.value = clock;
    const alive = clock < activeUntil;
    points.visible = alive;
    if (alive) onWake();
    else sleepUntilNext(now);
    return alive;
  }
  // allocation-free:end

  // Out of sight the show pauses: nothing is launched and no wake timer runs; on return every pending time
  // moves on by the time away, so the rhythm picks up where it left off.
  function pause(now = performance.now()) {
    if (paused) return;
    soundTimeline.clear();
    paused = true;
    pausedAt = now;
    clearTimeout(wakeTimer);
    wakeTimer = 0;
    wakeFor = -1;
  }
  function resume(now = performance.now()) {
    if (!paused) return;
    paused = false;
    slide(now - pausedAt);
    sleepUntilNext(now);
    onWake();
  }
  // Reduced motion: the word opens first (slowly, without a rising shell), then plain bursts; a light day
  // without bursts shows one still wave instead. Each opening returns [time (ms), volley] and sets the rhythm.
  function calmOpening(begin) {
    const timed = [];
    if (hasBursts)
      for (let k = 0; k < SHOW.calmBursts; k++)
        timed.push([begin + k * SHOW.calmGap * 1000, k === 0 && words.length ? WORD_SHELL : 1]);
    if (drifter) waveAt = begin;
    if (profile.flag) flagAt = begin;
    return timed;
  }
  function grandOpening(begin) {
    const timed = openingShells(random, words.length > 0).map(([t, count]) => [begin + t * 1000, count]),
      end = begin + SHOW.length * 1000;
    salvoAt = end + gap(cadence.every);
    if (words.length) wordAt = end + gap(cadence.word);
    return timed;
  }
  function lightOpening(begin) {
    const intro = hasBursts ? (profile.intro ?? LIGHT.intro) : 0,
      end = begin + LIGHT.introLength * 1000,
      timed = [];
    for (let k = 0; k < intro; k++)
      timed.push([begin + ((k + 0.3 * random()) * LIGHT.introLength * 1000) / intro, nextShell()]);
    const said = Math.min(words.length, LIGHT.wordsAt.length);
    for (let k = 0; k < said; k++) timed.push([begin + LIGHT.wordsAt[k] * 1000, WORD_SHELL + k]);
    if (hasBursts) salvoAt = end + gap(cadence.every);
    if (words.length && hasBursts) {
      wordCount = said;
      wordAt = end + gap(cadence.word);
    }
    if (drifter) waveAt = begin;
    if (profile.rocket) rocketAt = begin + LIGHT.firstRocket * 1000;
    if (profile.flag) flagAt = begin + FLAG.first * 1000;
    return timed;
  }
  const doc = watchVisibility ? globalThis.document : null,
    onVisibility = () => (doc.hidden ? pause() : resume());
  doc?.addEventListener?.('visibilitychange', onVisibility);

  // The show ends at once: nothing more is queued and the sparks not yet born are dropped (their slots go
  // back to the pool); the sparks already in the air finish on their own, so a switch never cuts mid-burst.
  function stop() {
    soundTimeline.clear();
    head = tail = 0;
    wordCount = 0;
    stopRhythm();
    rocketFrom = -1e6;
    activeUntil = -1;
    for (let i = 0; i < pool; i++) {
      const birth = motion[i * 4];
      if (birth > clock) motion[i * 4] = -1e6;
      else if (birth + motion[i * 4 + 1] > activeUntil) activeUntil = birth + motion[i * 4 + 1];
    }
    dirtyFrom = 0;
    dirtyTo = pool - 1;
    clearTimeout(wakeTimer);
    wakeTimer = 0;
    wakeFor = -1;
  }

  return {
    points,
    get occasion() {
      return occasion;
    },
    // The fireworks move into each rebuilt world scene; bursts stay clear above its highest island.
    attach(target, route) {
      if (points.parent !== target) target.add(points);
      if (route?.anchors?.length)
        ground.floor = route.anchors.reduce((m, p) => Math.max(m, p.y), 0) + PLACE.clearance;
      rocket ??= createRocketModel(THREE);
      if (rocket.group.parent !== target) target.add(rocket.group);
    },
    // The birthday pavilions (Object3Ds in their own frame, see PARTY): their entrances celebrate as the camera
    // comes near and their roofs pop now and then. An empty list ends the party.
    setParty(groups = [], now = performance.now()) {
      partyGroups = groups.filter(Boolean).slice(0, PARTY.max);
      partyNear.fill(0);
      partyCheer.fill(-1e6);
      partyIndoor.fill(-1e6);
      partyAt = partyGroups.length && !calm ? now + PARTY.popFirst * 1000 : Infinity;
      wakeFor = -1;
      sleepUntilNext(now);
    },
    // The opening show, counted from `now` (ms, the frame clock): see SHOW, RHYTHM and LIGHT.
    start(now = performance.now()) {
      head = tail = 0;
      wordCount = 0;
      stopRhythm();
      const begin = now + SHOW.delay * 1000,
        opening = (calm && calmOpening) || (grand && grandOpening) || lightOpening,
        timed = opening(begin);
      timed.sort((p, q) => p[0] - q[0]);
      for (const [time, shells] of timed) schedule(time, shells);
      wakeFor = -1;
      sleepUntilNext(now);
    },
    update,
    stop,
    // A birthday stage's sparkle at a world point (celebration-stage.mjs).
    sparkle(x, y, z, scale = 1, colours = PALETTES.birthday) {
      sparkle(x, y, z, scale, colours);
      flush();
      onWake();
    },
    // Another occasion on the same pool and draw: the current show stops (see stop) and start() opens the new one.
    setOccasion(key, figure = '') {
      stop();
      occasion = key;
      configure(key, figure);
    },
    active: () => clock < activeUntil,
    pause,
    resume,
    setEconomy(value) {
      economy = !!value;
      capacity = value ? FIREWORKS.compactCapacity : pool;
      density = value ? FIREWORKS.compactDensity : 1;
      geometry.setDrawRange(0, capacity);
    },
    // Reduced motion stops the rest of the show; sparks already in the air finish without twinkling.
    setReduced(value) {
      calm = !!value;
      uniforms.uFlicker.value = calm ? 0 : 1;
      if (calm) {
        head = tail = 0;
        stopRhythm();
      }
    },
    audit() {
      let live = 0,
        pending = 0;
      for (let i = 0; i < pool; i++) {
        const age = clock - motion[i * 4];
        if (age >= 0 && age <= motion[i * 4 + 1]) live++;
        else if (age < 0) pending++;
      }
      return {
        occasion,
        grand,
        capacity,
        density,
        economy,
        calm,
        paused,
        clock,
        live,
        pending,
        launched,
        figures,
        shapes,
        salvos,
        waves,
        rockets,
        flags,
        party: partyGroups.length,
        cheers,
        indoorPops,
        pops,
        sparkles,
        rocketVisible: !!rocket?.group.visible,
        words: wordTexts,
        figure: wordTexts[0] || '',
        figurePoints: words[0]?.count ?? 0,
        overwritten,
        queued: tail - head,
        visible: points.visible,
        lastShell: { reserved: reservedLast, written: writtenLast }
      };
    },
    dispose() {
      clearTimeout(wakeTimer);
      doc?.removeEventListener?.('visibilitychange', onVisibility);
      points.removeFromParent();
      geometry.dispose();
      material.dispose();
      rocket?.dispose();
    }
  };
}

// The greeting banner (#celebration in page.html): it is shown as soon as the page starts, over the loading
// screen too, so a slow world never hides the reason for the fireworks. Its countdown (GREETING.stay) starts
// once the world is on screen (arm), or after GREETING.armLatest at the latest. It can be closed with its button
// or Escape and pauses while it is hovered or focused.
const textSpan = (document, className, text) => {
  const span = document.createElement('span');
  span.className = className;
  span.textContent = text;
  return span;
};
export const GREETING = { stay: 60000, leave: 650, minimum: 600, armLatest: 20000 };
export function mountGreeting(
  document,
  { occasion, labels = {}, date = new Date(), locale = 'ru', party = [] } = {}
) {
  const box = document.getElementById('celebration');
  if (!box || !isOccasion(occasion)) return null;
  const title = document.getElementById('celebration-title'),
    mark = document.getElementById('celebration-mark');
  let copy = greetingCopy(occasion, labels, date, locale, party);
  box.dataset.occasion = occasion;
  box.style.setProperty('--celebration-stay', GREETING.stay + 'ms');
  // Written when the card appears, so the live region announces it. Words rise in one after another.
  const write = () => {
    mark?.replaceChildren(
      textSpan(document, 'celebration-number', copy.mark),
      textSpan(document, 'celebration-unit', copy.unit)
    );
    title.replaceChildren();
    copy.title
      .split(/\s+/)
      .filter(Boolean)
      .forEach((word, i) => {
        const span = document.createElement('span');
        span.className = 'celebration-word';
        span.style.setProperty('--i', String(i));
        span.textContent = word;
        if (i) title.append(' ');
        title.append(span);
      });
    document.getElementById('celebration-text').textContent = copy.text;
  };
  let timer = 0,
    leaving = 0,
    deadline = 0,
    armed = false,
    latest = 0,
    paused = false,
    remaining = GREETING.stay;
  const shown = () => !box.hidden && !box.classList.contains('is-leaving');
  const hide = () => {
    clearTimeout(timer);
    clearTimeout(latest);
    timer = 0;
    if (!shown()) return;
    box.classList.remove('is-shown', 'is-paused');
    box.classList.add('is-leaving');
    leaving = setTimeout(() => {
      box.hidden = true;
      box.classList.remove('is-leaving');
    }, GREETING.leave);
  };
  const resume = () => {
    if (!shown() || timer || !armed || paused) return;
    box.classList.remove('is-paused');
    deadline = performance.now() + remaining;
    timer = setTimeout(hide, remaining);
  };
  const pause = () => {
    if (!timer) return;
    clearTimeout(timer);
    timer = 0;
    remaining = Math.max(GREETING.minimum, deadline - performance.now());
    box.classList.add('is-paused');
  };
  // The world is on screen: the countdown starts (paused while the pointer or focus is on the card).
  const arm = () => {
    if (armed) return;
    armed = true;
    clearTimeout(latest);
    if (!shown()) return;
    box.classList.add('is-counting');
    box.classList.toggle('is-paused', paused);
    resume();
  };
  const show = () => {
    // A page opened in a background tab greets when it is first looked at.
    if (document.hidden) {
      document.addEventListener('visibilitychange', show, { once: true });
      return;
    }
    clearTimeout(leaving);
    box.classList.remove('is-leaving');
    box.hidden = false;
    write();
    // Lay out the hidden state first so the entrance transition runs.
    box.getBoundingClientRect();
    box.classList.add('is-shown');
    remaining = GREETING.stay;
    timer = 0;
    if (armed) {
      box.classList.add('is-counting');
      resume();
    } else latest = setTimeout(arm, GREETING.armLatest);
  };
  const enter = () => {
    paused = true;
    pause();
  };
  const leave = () => {
    paused = false;
    resume();
  };
  box.addEventListener('pointerenter', enter);
  box.addEventListener('pointerleave', leave);
  box.addEventListener('focusin', enter);
  box.addEventListener('focusout', event => {
    if (!box.contains(event.relatedTarget)) leave();
  });
  document.getElementById('celebration-close')?.addEventListener('click', hide);
  // Escape closes the greeting first (it is the newest layer), before it would close a panel or leave a hall.
  document.defaultView?.addEventListener(
    'keydown',
    event => {
      if (event.key !== 'Escape' || !shown() || document.querySelector('dialog[open]')) return;
      event.preventDefault();
      event.stopPropagation();
      hide();
    },
    true
  );
  // Another occasion's card (Settings → Праздники): the current one goes at once, without its exit, so the
  // next show() writes the new words and runs the entrance again with a fresh countdown.
  // `next`: the project birthdays to greet with it (projectBirthdays), when they change too.
  const setOccasion = (key, next = party) => {
    if (!isOccasion(key)) return;
    party = next;
    clearTimeout(timer);
    clearTimeout(latest);
    clearTimeout(leaving);
    timer = 0;
    copy = greetingCopy(key, labels, date, locale, party);
    box.dataset.occasion = key;
    box.classList.remove('is-shown', 'is-leaving', 'is-counting', 'is-paused');
    box.hidden = true;
  };
  return {
    show,
    hide,
    arm,
    setOccasion,
    get copy() {
      return copy;
    },
    get occasion() {
      return box.dataset.occasion;
    },
    get visible() {
      return shown();
    }
  };
}
