// Offline approximation from NOAA General Solar Position Calculations:
// https://gml.noaa.gov/grad/solcalc/solareqns.PDF
// Geometric altitude/azimuth; sunrise uses NOAA's 90.833-degree zenith.
// City centers are approximate; terrain, weather/refraction variability are not modeled.
export const SOLAR_CITIES = [
  {
    id: 'moscow',
    name: { ru: 'Москва', en: 'Moscow' },
    lat: 55.7558,
    lon: 37.6173,
    timeZone: 'Europe/Moscow'
  },
  {
    id: 'st-petersburg',
    name: { ru: 'Санкт-Петербург', en: 'Saint Petersburg' },
    lat: 59.9343,
    lon: 30.3351,
    timeZone: 'Europe/Moscow'
  },
  {
    id: 'yekaterinburg',
    name: { ru: 'Екатеринбург', en: 'Yekaterinburg' },
    lat: 56.8389,
    lon: 60.6057,
    timeZone: 'Asia/Yekaterinburg'
  },
  {
    id: 'novosibirsk',
    name: { ru: 'Новосибирск', en: 'Novosibirsk' },
    lat: 55.0084,
    lon: 82.9357,
    timeZone: 'Asia/Novosibirsk'
  },
  {
    id: 'vladivostok',
    name: { ru: 'Владивосток', en: 'Vladivostok' },
    lat: 43.1155,
    lon: 131.8855,
    timeZone: 'Asia/Vladivostok'
  },
  {
    id: 'london',
    name: { ru: 'Лондон', en: 'London' },
    lat: 51.5074,
    lon: -0.1278,
    timeZone: 'Europe/London'
  },
  {
    id: 'new-york',
    name: { ru: 'Нью-Йорк', en: 'New York' },
    lat: 40.7128,
    lon: -74.006,
    timeZone: 'America/New_York'
  },
  {
    id: 'sydney',
    name: { ru: 'Сидней', en: 'Sydney' },
    lat: -33.8688,
    lon: 151.2093,
    timeZone: 'Australia/Sydney'
  },
  { id: 'tromso', name: { ru: 'Тромсё', en: 'Tromsø' }, lat: 69.6492, lon: 18.9553, timeZone: 'Europe/Oslo' },
  { id: 'paris', name: { ru: 'Париж', en: 'Paris' }, lat: 48.8566, lon: 2.3522, timeZone: 'Europe/Paris' },
  { id: 'berlin', name: { ru: 'Берлин', en: 'Berlin' }, lat: 52.52, lon: 13.405, timeZone: 'Europe/Berlin' },
  {
    id: 'madrid',
    name: { ru: 'Мадрид', en: 'Madrid' },
    lat: 40.4168,
    lon: -3.7038,
    timeZone: 'Europe/Madrid'
  },
  { id: 'rome', name: { ru: 'Рим', en: 'Rome' }, lat: 41.9028, lon: 12.4964, timeZone: 'Europe/Rome' },
  {
    id: 'istanbul',
    name: { ru: 'Стамбул', en: 'Istanbul' },
    lat: 41.0082,
    lon: 28.9784,
    timeZone: 'Europe/Istanbul'
  },
  {
    id: 'los-angeles',
    name: { ru: 'Лос-Анджелес', en: 'Los Angeles' },
    lat: 34.0522,
    lon: -118.2437,
    timeZone: 'America/Los_Angeles'
  },
  {
    id: 'chicago',
    name: { ru: 'Чикаго', en: 'Chicago' },
    lat: 41.8781,
    lon: -87.6298,
    timeZone: 'America/Chicago'
  },
  {
    id: 'houston',
    name: { ru: 'Хьюстон', en: 'Houston' },
    lat: 29.7604,
    lon: -95.3698,
    timeZone: 'America/Chicago'
  },
  {
    id: 'beijing',
    name: { ru: 'Пекин', en: 'Beijing' },
    lat: 39.9042,
    lon: 116.4074,
    timeZone: 'Asia/Shanghai'
  },
  {
    id: 'shanghai',
    name: { ru: 'Шанхай', en: 'Shanghai' },
    lat: 31.2304,
    lon: 121.4737,
    timeZone: 'Asia/Shanghai'
  },
  { id: 'tokyo', name: { ru: 'Токио', en: 'Tokyo' }, lat: 35.6895, lon: 139.6917, timeZone: 'Asia/Tokyo' }
];
// Owner, round 18: more Russian cities, small ones too, across every Russian time zone (city centres, approximate).
// [id, Russian name, English name, latitude, longitude, IANA zone]
/** @type {Array<[string, string, string, number, number, string]>} */
const RUSSIAN_TOWNS = [
  ['kaliningrad', 'Калининград', 'Kaliningrad', 54.71, 20.51, 'Europe/Kaliningrad'],
  ['pskov', 'Псков', 'Pskov', 57.82, 28.33, 'Europe/Moscow'],
  ['veliky-novgorod', 'Великий Новгород', 'Veliky Novgorod', 58.52, 31.27, 'Europe/Moscow'],
  ['smolensk', 'Смоленск', 'Smolensk', 54.78, 32.05, 'Europe/Moscow'],
  ['petrozavodsk', 'Петрозаводск', 'Petrozavodsk', 61.79, 34.36, 'Europe/Moscow'],
  ['murmansk', 'Мурманск', 'Murmansk', 68.97, 33.07, 'Europe/Moscow'],
  ['teriberka', 'Териберка', 'Teriberka', 69.16, 35.14, 'Europe/Moscow'],
  ['kirovsk', 'Кировск', 'Kirovsk', 67.61, 33.67, 'Europe/Moscow'],
  ['arkhangelsk', 'Архангельск', 'Arkhangelsk', 64.54, 40.54, 'Europe/Moscow'],
  ['naryan-mar', 'Нарьян-Мар', 'Naryan-Mar', 67.64, 53.01, 'Europe/Moscow'],
  ['vorkuta', 'Воркута', 'Vorkuta', 67.5, 64.05, 'Europe/Moscow'],
  ['syktyvkar', 'Сыктывкар', 'Syktyvkar', 61.67, 50.84, 'Europe/Moscow'],
  ['vologda', 'Вологда', 'Vologda', 59.22, 39.89, 'Europe/Moscow'],
  ['yaroslavl', 'Ярославль', 'Yaroslavl', 57.63, 39.87, 'Europe/Moscow'],
  ['kostroma', 'Кострома', 'Kostroma', 57.77, 40.93, 'Europe/Moscow'],
  ['plyos', 'Плёс', 'Plyos', 57.46, 41.51, 'Europe/Moscow'],
  ['suzdal', 'Суздаль', 'Suzdal', 56.42, 40.45, 'Europe/Moscow'],
  ['tver', 'Тверь', 'Tver', 56.86, 35.9, 'Europe/Moscow'],
  ['kaluga', 'Калуга', 'Kaluga', 54.51, 36.26, 'Europe/Moscow'],
  ['tula', 'Тула', 'Tula', 54.19, 37.62, 'Europe/Moscow'],
  ['ryazan', 'Рязань', 'Ryazan', 54.63, 39.74, 'Europe/Moscow'],
  ['voronezh', 'Воронеж', 'Voronezh', 51.66, 39.2, 'Europe/Moscow'],
  ['nizhny-novgorod', 'Нижний Новгород', 'Nizhny Novgorod', 56.33, 44.0, 'Europe/Moscow'],
  ['cheboksary', 'Чебоксары', 'Cheboksary', 56.15, 47.25, 'Europe/Moscow'],
  ['kazan', 'Казань', 'Kazan', 55.8, 49.11, 'Europe/Moscow'],
  ['kirov', 'Киров', 'Kirov', 58.6, 49.66, 'Europe/Kirov'],
  ['rostov-on-don', 'Ростов-на-Дону', 'Rostov-on-Don', 47.24, 39.71, 'Europe/Moscow'],
  ['krasnodar', 'Краснодар', 'Krasnodar', 45.04, 38.98, 'Europe/Moscow'],
  ['sochi', 'Сочи', 'Sochi', 43.59, 39.73, 'Europe/Moscow'],
  ['pyatigorsk', 'Пятигорск', 'Pyatigorsk', 44.05, 43.06, 'Europe/Moscow'],
  ['makhachkala', 'Махачкала', 'Makhachkala', 42.98, 47.5, 'Europe/Moscow'],
  ['volgograd', 'Волгоград', 'Volgograd', 48.71, 44.51, 'Europe/Volgograd'],
  ['astrakhan', 'Астрахань', 'Astrakhan', 46.35, 48.04, 'Europe/Astrakhan'],
  ['saratov', 'Саратов', 'Saratov', 51.53, 46.03, 'Europe/Saratov'],
  ['ulyanovsk', 'Ульяновск', 'Ulyanovsk', 54.31, 48.4, 'Europe/Ulyanovsk'],
  ['samara', 'Самара', 'Samara', 53.2, 50.15, 'Europe/Samara'],
  ['izhevsk', 'Ижевск', 'Izhevsk', 56.85, 53.2, 'Europe/Samara'],
  ['ufa', 'Уфа', 'Ufa', 54.74, 55.97, 'Asia/Yekaterinburg'],
  ['perm', 'Пермь', 'Perm', 58.01, 56.23, 'Asia/Yekaterinburg'],
  ['chelyabinsk', 'Челябинск', 'Chelyabinsk', 55.16, 61.4, 'Asia/Yekaterinburg'],
  ['tyumen', 'Тюмень', 'Tyumen', 57.15, 65.53, 'Asia/Yekaterinburg'],
  ['tobolsk', 'Тобольск', 'Tobolsk', 58.2, 68.25, 'Asia/Yekaterinburg'],
  ['salekhard', 'Салехард', 'Salekhard', 66.53, 66.61, 'Asia/Yekaterinburg'],
  ['omsk', 'Омск', 'Omsk', 54.99, 73.37, 'Asia/Omsk'],
  ['tomsk', 'Томск', 'Tomsk', 56.48, 84.95, 'Asia/Tomsk'],
  ['barnaul', 'Барнаул', 'Barnaul', 53.35, 83.78, 'Asia/Barnaul'],
  ['gorno-altaysk', 'Горно-Алтайск', 'Gorno-Altaysk', 51.96, 85.96, 'Asia/Barnaul'],
  ['novokuznetsk', 'Новокузнецк', 'Novokuznetsk', 53.76, 87.11, 'Asia/Novokuznetsk'],
  ['krasnoyarsk', 'Красноярск', 'Krasnoyarsk', 56.01, 92.85, 'Asia/Krasnoyarsk'],
  ['norilsk', 'Норильск', 'Norilsk', 69.34, 88.21, 'Asia/Krasnoyarsk'],
  ['irkutsk', 'Иркутск', 'Irkutsk', 52.29, 104.28, 'Asia/Irkutsk'],
  ['listvyanka', 'Листвянка', 'Listvyanka', 51.85, 104.87, 'Asia/Irkutsk'],
  ['ulan-ude', 'Улан-Удэ', 'Ulan-Ude', 51.83, 107.58, 'Asia/Irkutsk'],
  ['chita', 'Чита', 'Chita', 52.03, 113.5, 'Asia/Chita'],
  ['blagoveshchensk', 'Благовещенск', 'Blagoveshchensk', 50.26, 127.53, 'Asia/Yakutsk'],
  ['yakutsk', 'Якутск', 'Yakutsk', 62.03, 129.73, 'Asia/Yakutsk'],
  ['tiksi', 'Тикси', 'Tiksi', 71.64, 128.87, 'Asia/Yakutsk'],
  ['oymyakon', 'Оймякон', 'Oymyakon', 63.46, 142.79, 'Asia/Ust-Nera'],
  ['khabarovsk', 'Хабаровск', 'Khabarovsk', 48.48, 135.07, 'Asia/Vladivostok'],
  ['yuzhno-sakhalinsk', 'Южно-Сахалинск', 'Yuzhno-Sakhalinsk', 46.96, 142.74, 'Asia/Sakhalin'],
  ['magadan', 'Магадан', 'Magadan', 59.56, 150.81, 'Asia/Magadan'],
  [
    'petropavlovsk-kamchatsky',
    'Петропавловск-Камчатский',
    'Petropavlovsk-Kamchatsky',
    53.04,
    158.65,
    'Asia/Kamchatka'
  ],
  ['anadyr', 'Анадырь', 'Anadyr', 64.73, 177.51, 'Asia/Anadyr']
];
// The first Russian cities of the list, kept in place (their ids are in saved preferences).
const RUSSIAN_IDS = new Set(['moscow', 'st-petersburg', 'yekaterinburg', 'novosibirsk', 'vladivostok']);
for (const city of SOLAR_CITIES) city.region = RUSSIAN_IDS.has(city.id) ? 'ru' : 'world';
for (const [id, ru, en, lat, lon, timeZone] of RUSSIAN_TOWNS)
  SOLAR_CITIES.push({ id, name: { ru, en }, lat, lon, timeZone, region: 'ru' });
const rad = Math.PI / 180,
  dayMs = 86400000;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = x => {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};
const formatters = new Map(),
  eventCache = new Map(),
  localCache = new Map();
function localParts(date, timeZone) {
  const second = Math.floor(date.getTime() / 1000),
    cached = localCache.get(timeZone);
  if (cached?.second === second)
    return { ...cached.value, localHour: cached.value.localHour + date.getUTCMilliseconds() / 3600000 };
  let format = formatters.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    });
    formatters.set(timeZone, format);
  }
  const p = Object.fromEntries(
    format
      .formatToParts(date)
      .filter(p => p.type !== 'literal')
      .map(p => [p.type, p.value])
  );
  const value = {
    localDateKey: `${p.year}-${p.month}-${p.day}`,
    localHour: Number(p.hour) + Number(p.minute) / 60 + Number(p.second) / 3600
  };
  localCache.set(timeZone, { second, value });
  return { ...value, localHour: value.localHour + date.getUTCMilliseconds() / 3600000 };
}
function coefficients(date) {
  const year = date.getUTCFullYear(),
    start = Date.UTC(year, 0, 1),
    days = (Date.UTC(year + 1, 0, 1) - start) / dayMs;
  const gamma = ((2 * Math.PI) / days) * ((date.getTime() - start) / dayMs - 0.5);
  return {
    equation:
      229.18 *
      (0.000075 +
        0.001868 * Math.cos(gamma) -
        0.032077 * Math.sin(gamma) -
        0.014615 * Math.cos(2 * gamma) -
        0.040849 * Math.sin(2 * gamma)),
    declination:
      0.006918 -
      0.399912 * Math.cos(gamma) +
      0.070257 * Math.sin(gamma) -
      0.006758 * Math.cos(2 * gamma) +
      0.000907 * Math.sin(2 * gamma) -
      0.002697 * Math.cos(3 * gamma) +
      0.00148 * Math.sin(3 * gamma)
  };
}
function crossingAngle(lat, declination, altitude = -0.833) {
  const c =
    (Math.sin(altitude * rad) - Math.sin(lat * rad) * Math.sin(declination)) /
    (Math.cos(lat * rad) * Math.cos(declination));
  return c > 1
    ? { angle: null, polar: 'night' }
    : c < -1
      ? { angle: null, polar: 'day' }
      : { angle: Math.acos(clamp(c, -1, 1)) / rad, polar: null };
}
// Pure coordinate calculation is also exposed for tests and future manually entered locations.
export function solarPosition(date, lat, lon) {
  if (
    !(date instanceof Date) ||
    !Number.isFinite(date.getTime()) ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    Math.abs(lat) > 90 ||
    Math.abs(lon) > 180
  )
    return null;
  const { equation, declination } = coefficients(date);
  const minutes =
    date.getUTCHours() * 60 +
    date.getUTCMinutes() +
    (date.getUTCSeconds() + date.getUTCMilliseconds() / 1000) / 60;
  const solarMinutes = (((minutes + equation + 4 * lon) % 1440) + 1440) % 1440;
  const hourAngle = solarMinutes / 4 - 180,
    ha = hourAngle * rad,
    latitude = lat * rad;
  const altitude =
    Math.asin(
      clamp(
        Math.sin(latitude) * Math.sin(declination) +
          Math.cos(latitude) * Math.cos(declination) * Math.cos(ha),
        -1,
        1
      )
    ) / rad;
  const azimuth =
    (((Math.atan2(
      Math.sin(ha),
      Math.cos(ha) * Math.sin(latitude) - Math.tan(declination) * Math.cos(latitude)
    ) /
      rad +
      180) %
      360) +
      360) %
    360;
  return { altitude, azimuth, hourAngle, declination, equation };
}
export function solarEvents(localDateKey, lat, lon) {
  const midnight = Date.parse(localDateKey + 'T00:00:00Z');
  if (
    !Number.isFinite(midnight) ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    Math.abs(lat) >= 90 ||
    Math.abs(lon) > 180
  )
    return null;
  const noon = new Date(midnight + 12 * 3600000),
    { declination, equation } = coefficients(noon);
  const crossing = crossingAngle(lat, declination);
  if (crossing.polar) return { sunrise: null, sunset: null, polar: crossing.polar };
  const event = sign => {
    let minutes = 720 - 4 * lon - equation + sign * 4 * crossing.angle;
    for (let i = 0; i < 2; i++) {
      const c = coefficients(new Date(midnight + minutes * 60000)),
        h = crossingAngle(lat, c.declination);
      if (h.angle === null) return null;
      minutes = 720 - 4 * lon - c.equation + sign * 4 * h.angle;
    }
    return new Date(midnight + minutes * 60000);
  };
  return { sunrise: event(-1), sunset: event(1), polar: null };
}
function solarBlend(position, lat) {
  const crossing = crossingAngle(lat, position.declination);
  if (crossing.polar === 'day') return ['evening', 'day', smooth(position.altitude / 18)];
  if (crossing.polar === 'night') return ['night', 'evening', smooth((position.altitude + 8) / 8) * 0.65];
  const rise = crossing.angle,
    twilight = crossingAngle(lat, position.declination, -8);
  const edge = twilight.angle ?? 180;
  // Common noon/day and midnight/night knots avoid rising/falling branch jumps,
  // including white nights where astronomical twilight never quite finishes.
  const knots = [
    [-180, 'night'],
    [-edge, 'night'],
    [-rise, 'morning'],
    [-rise * 0.35, 'day'],
    [0, 'day'],
    [rise * 0.5, 'evening'],
    [rise, 'sunset'],
    [edge, 'night'],
    [180, 'night']
  ];
  for (let i = 1; i < knots.length; i++) {
    const [end, to] = knots[i],
      [start, from] = knots[i - 1];
    if (position.hourAngle <= end && end > start)
      return [from, to, smooth((position.hourAngle - start) / (end - start))];
  }
  return ['night', 'night', 0];
}
// Near polar crossings, preserve the existing stages while blending their weights continuously.
// Clamping the crossing angle prevents a whole day of stages collapsing into a few minutes.
export function polarStageWeights(position, lat) {
  const cosine = altitude =>
    (Math.sin(altitude * rad) - Math.sin(lat * rad) * Math.sin(position.declination)) /
    (Math.cos(lat * rad) * Math.cos(position.declination));
  const c = cosine(-0.833),
    limit = Math.SQRT1_2;
  const latitudeBlend = smooth((Math.abs(lat) - 61) / 4.5);
  if (Math.abs(c) <= limit || latitudeBlend === 0) return null;
  const rise = Math.acos(clamp(c, -limit, limit)) / rad;
  const edge = Math.max(rise, Math.acos(clamp(cosine(-8), -1, 1)) / rad);
  const knots = [
    [-180, 'night'],
    [-edge, 'night'],
    [-rise, 'morning'],
    [-rise * 0.35, 'day'],
    [0, 'day'],
    [rise * 0.5, 'evening'],
    [rise, 'sunset'],
    [edge, 'night'],
    [180, 'night']
  ];
  const weights = { night: 0, morning: 0, day: 0, evening: 0, sunset: 0 };
  for (let i = 1; i < knots.length; i++) {
    const [end, to] = knots[i],
      [start, from] = knots[i - 1];
    if (position.hourAngle <= end && end > start) {
      const mix = smooth((position.hourAngle - start) / (end - start));
      weights[from] += 1 - mix;
      weights[to] += mix;
      break;
    }
  }
  const polar = smooth((Math.abs(c) - limit) / (1 - limit));
  for (const name of Object.keys(weights)) weights[name] *= 1 - polar;
  if (c > 0) {
    const evening = smooth((position.altitude + 8) / 8) * 0.65;
    weights.night += polar * (1 - evening);
    weights.evening += polar * evening;
  } else {
    const day = smooth(position.altitude / 18);
    weights.evening += polar * (1 - day);
    weights.day += polar * day;
  }
  if (latitudeBlend < 1) {
    const [from, to, mix] = solarBlend(position, lat);
    for (const name of Object.keys(weights)) weights[name] *= latitudeBlend;
    weights[from] += (1 - latitudeBlend) * (1 - mix);
    weights[to] += (1 - latitudeBlend) * mix;
  }
  return weights;
}
export function solarState(date = new Date(), cityId = '') {
  const city = SOLAR_CITIES.find(c => c.id === cityId);
  if (!city || !(date instanceof Date) || !Number.isFinite(date.getTime())) return null;
  let local;
  try {
    local = localParts(date, city.timeZone);
  } catch {
    return null;
  }
  const position = solarPosition(date, city.lat, city.lon),
    [from, to, mix] = solarBlend(position, city.lat);
  const key = city.id + ':' + local.localDateKey;
  let events = eventCache.get(key);
  if (!events) {
    events = solarEvents(local.localDateKey, city.lat, city.lon);
    if (eventCache.size > 32) eventCache.clear();
    eventCache.set(key, events);
  }
  const altitude = position.altitude * rad,
    azimuth = position.azimuth * rad,
    radius = 330;
  return {
    cityId: city.id,
    timeZone: city.timeZone,
    ...local,
    ...events,
    altitude: position.altitude,
    azimuth: position.azimuth,
    rising: position.hourAngle < 0,
    from,
    to,
    mix,
    weights: polarStageWeights(position, city.lat),
    sunPosition: [
      radius * Math.cos(altitude) * Math.sin(azimuth),
      radius * Math.sin(altitude),
      -radius * Math.cos(altitude) * Math.cos(azimuth)
    ],
    sunStrength: smooth((position.altitude + 8) / 14)
  };
}
