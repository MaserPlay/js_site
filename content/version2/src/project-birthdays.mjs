// A project's birthday in the garden: on the anniversary of a project's creation (celebrations.mjs
// projectBirthdays) its house stands out even on a holiday. Over the roof floats the project's own emblem: a
// medallion in its colour with its icon, the age as a solid gold number and round balloons (celebration-stage.mjs
// buildProjectEmblem; owner, round 9: every house had had the same cake and flat balloons). A glowing badge with a
// candle on the sign says since when the project exists (the age is on the emblem already); the island tag, the
// route dot and the portal chip get a small candle mark, and the shared spark pool (celebrations.mjs setParty) adds
// the fountains at the door as the visitor comes near, confetti in the hall and over the roof now and then.
// Several projects on one day all celebrate. Nothing here runs per frame except the emblem's glow.
import { createdDate, yearsPhrase } from './celebrations.mjs';
import { buildProjectEmblem } from './celebration-stage.mjs';
import { paintContext } from './paint-canvas.mjs';

// Pavilion frame (front towards -z, see pavilion-glass.mjs GLASS.sign: centre y 5.77, z -2.38, 3.6 x 0.64 m):
// the badge stands on top of the sign, slightly in front of it; balloons ride over the roof's front corners.
export const BADGE = {
  canvas: [512, 176],
  width: 1.9,
  height: 0.66,
  x: 0,
  y: 6.47,
  z: -2.44,
  halo: 1.5
};
// The emblem over the roof in the pavilion's frame, unless the house names its own place (greenhouse.mjs party).
export const PAVILION_EMBLEM = { at: [0, 8.2, -1.2], glowDay: 0.25, glowNight: 0.6 };
// The badge's line: since when the project exists ("с 7 ноября 2025"), or its age when the date is unknown.
export function sinceLine(project, age, locale = 'ru', labels = {}) {
  const created = createdDate(project);
  if (!created) return yearsPhrase(age, locale, labels).trim();
  const full = created.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }),
    date = full.endsWith('г.') ? full.slice(0, -2).trimEnd() : full;
  return String(labels.celebrateProjectSince || (locale === 'ru' ? 'с {date}' : 'since {date}')).replace(
    '{date}',
    date
  );
}
// The candle icon used in the badge and the chips (24 px grid).
export const CANDLE_PATH = 'M9 21h6M10 21v-9h4v9M12 12V9.5m0-5c-1.2 1.4-1.2 2.8 0 3.4 1.2-.6 1.2-2 0-3.4Z';

// The badge picture: a gold pill with a soft glow, a candle and the age ("3 года").
export function drawBadge(c, width, height, text) {
  c.clearRect(0, 0, width, height);
  const r = height * 0.36,
    pad = height * 0.14,
    x = pad,
    y = pad,
    w = width - pad * 2,
    h = height - pad * 2;
  c.shadowColor = 'rgba(255,190,70,0.95)';
  c.shadowBlur = pad;
  const fill = c.createLinearGradient(0, y, 0, y + h);
  fill.addColorStop(0, '#fff2b8');
  fill.addColorStop(0.45, '#ffc53d');
  fill.addColorStop(1, '#f08a12');
  c.fillStyle = fill;
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fill();
  c.shadowBlur = 0;
  c.lineWidth = 4;
  c.strokeStyle = '#fff7d6';
  c.stroke();
  // The candle: a striped stick and a flame.
  const cx = x + h * 0.62,
    base = y + h * 0.84;
  c.fillStyle = '#ff4f8b';
  c.fillRect(cx - h * 0.09, base - h * 0.42, h * 0.18, h * 0.42);
  c.fillStyle = '#ffffff';
  for (let k = 0; k < 3; k++) c.fillRect(cx - h * 0.09, base - h * (0.12 + k * 0.13), h * 0.18, h * 0.04);
  c.fillStyle = '#ff7a00';
  c.beginPath();
  c.ellipse(cx, base - h * 0.55, h * 0.08, h * 0.14, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#fff3a0';
  c.beginPath();
  c.ellipse(cx, base - h * 0.52, h * 0.04, h * 0.07, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#4a2200';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  let size = h * 0.62;
  c.font = `800 ${Math.round(size)}px system-ui, "Segoe UI", Arial, sans-serif`;
  const room = w - h * 1.2;
  while (c.measureText(text).width > room && size > 20) {
    size -= 4;
    c.font = `800 ${Math.round(size)}px system-ui, "Segoe UI", Arial, sans-serif`;
  }
  c.fillText(text, x + h * 1.05 + room / 2, y + h * 0.53);
}

// Marks the route dots, the portal chips and the island tags of the birthday projects (data-index) with a
// candle and a gold ring; the lists are rebuilt now and then, so their containers are watched.
const CHIP_LISTS = ['route-dots', 'portal-projects', 'island-tags'];
export function markBirthdayChips(document, birthdays, { labels = {}, locale = 'ru' } = {}) {
  const ages = new Map(birthdays.map(b => [String(b.index), b.age]));
  for (const id of CHIP_LISTS) {
    const list = document.getElementById?.(id);
    if (!list) continue;
    for (const el of list.querySelectorAll?.('[data-index]') || []) {
      const age = ages.get(el.dataset.index),
        mark = el.querySelector?.(':scope > .birthday-mark');
      el.classList.toggle('has-birthday', age !== undefined);
      if (age === undefined) {
        mark?.remove();
        continue;
      }
      const title =
        (labels.celebrateNameProject || 'День рождения проекта') + ': ' + yearsPhrase(age, locale, labels);
      if (mark) {
        mark.title = title;
        continue;
      }
      const badge = document.createElement('span'),
        svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
        path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      badge.className = 'birthday-mark';
      badge.title = title;
      badge.setAttribute('aria-hidden', 'true');
      svg.setAttribute('viewBox', '0 0 24 24');
      path.setAttribute('d', CANDLE_PATH);
      svg.append(path);
      badge.append(svg);
      el.append(badge);
    }
  }
}

/**
 * @param {any} THREE
 * @param {{ document?: any, labels?: Record<string, string>, locale?: string, projectOf?: (index: number) => any }} [options]
 *   projectOf(index): the project shown at that slot (its colour, icon and creation date).
 */
export function createPavilionParty(
  THREE,
  { document = globalThis.document, labels = {}, locale = 'ru', projectOf = () => null } = {}
) {
  let decorations = [],
    emblems = [],
    birthdays = [],
    observer = null;
  const textures = new Map();
  const badgeTexture = text => {
    if (textures.has(text)) return textures.get(text);
    const [W, H] = BADGE.canvas,
      canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    drawBadge(paintContext(canvas), W, H, text);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    textures.set(text, texture);
    return texture;
  };
  function clear() {
    for (const item of decorations) {
      item.removeFromParent();
      item.material.dispose();
      item.geometry.dispose();
    }
    decorations = [];
    for (const item of emblems) item.dispose();
    emblems = [];
  }
  const mark = () => markBirthdayChips(document, birthdays, { labels, locale });
  function watch() {
    if (observer || typeof MutationObserver === 'undefined') return;
    observer = new MutationObserver(mark);
    for (const id of CHIP_LISTS) {
      const list = document.getElementById(id);
      if (list) observer.observe(list, { childList: true });
    }
  }
  return {
    // world: the built world (pavilionGroups), list: projectBirthdays(), fireworks: the shared show.
    attach(world, list, fireworks, now) {
      clear();
      birthdays = list || [];
      const groups = birthdays.map(b => world?.pavilionGroups?.[b.index]).filter(Boolean);
      fireworks?.setParty(groups, now);
      if (document?.createElement) {
        birthdays.forEach(b => {
          const group = world?.pavilionGroups?.[b.index];
          if (!group) return;
          const project = projectOf(b.index),
            text = sinceLine(project, b.age, locale, labels),
            material = new THREE.MeshBasicMaterial({
              map: badgeTexture(text),
              transparent: true,
              depthWrite: false,
              toneMapped: false
            }),
            badge = new THREE.Mesh(new THREE.PlaneGeometry(BADGE.width, BADGE.height), material);
          badge.name = 'birthday-badge';
          badge.userData.line = text;
          // A greenhouse (greenhouse.mjs) has its sign lower, over the door: it names its own anchor.
          const anchor = group.userData.badgeAnchor || BADGE;
          badge.position.set(anchor.x, anchor.y, anchor.z);
          badge.rotation.y = Math.PI;
          // After the cloud sea (cloud-sea.mjs, 4), like the balloons and the fireworks.
          badge.renderOrder = 5;
          group.add(badge);
          decorations.push(badge);
          const emblem = buildProjectEmblem(THREE, {
            age: b.age,
            accent: project?.accent,
            icon: project?.iconImage || null,
            document
          });
          emblem.group.position.fromArray(group.userData.party?.emblem || PAVILION_EMBLEM.at);
          group.add(emblem.group);
          emblems.push(emblem);
        });
        mark();
        watch();
      }
      return groups.length;
    },
    update(now, motion, light) {
      for (let k = 0; k < emblems.length; k++)
        emblems[k].lit.userData.glow.value =
          PAVILION_EMBLEM.glowNight + (PAVILION_EMBLEM.glowDay - PAVILION_EMBLEM.glowNight) * light;
    },
    get birthdays() {
      return birthdays;
    },
    audit: () => ({
      birthdays: birthdays.map(b => ({ ...b })),
      badges: decorations.length,
      emblems: emblems.length,
      lines: decorations.map(d => d.userData.line)
    }),
    dispose() {
      clear();
      observer?.disconnect();
      for (const texture of textures.values()) texture.dispose();
      textures.clear();
    }
  };
}
