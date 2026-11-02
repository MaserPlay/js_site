// The back of each pavilion screen: a lit poster in the project's accent colour (number, icon, name,
// status, description, dates, a framed preview and a cue that the exhibit is on the other side).
import { paintContext } from './paint-canvas.mjs';
export const REAR = { width: 1024, height: 597, pad: 44, split: 470 };

// Accent helpers: a deep tint for the background and a readable light tone for accents.
export function accentTones(hex) {
  const value = /^#?[0-9a-f]{6}$/i.test(hex || '') ? parseInt(String(hex).replace('#', ''), 16) : 0xa895e5,
    r = (value >> 16) & 255,
    g = (value >> 8) & 255,
    b = value & 255;
  const mix = (t, k, o) => Math.round(t * k + o * (1 - k));
  return {
    deep: `rgb(${mix(r, 0.22, 14)},${mix(g, 0.22, 12)},${mix(b, 0.22, 30)})`,
    light: `rgb(${mix(r, 0.7, 255)},${mix(g, 0.7, 255)},${mix(b, 0.7, 255)})`,
    solid: `rgb(${r},${g},${b})`,
    glow: `rgba(${r},${g},${b},.30)`
  };
}
// Greedy word wrap into at most maxLines; the last line gets an ellipsis when text remains.
export function wrapLines(measure, value, width, maxLines) {
  const words = String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean),
    lines = [];
  let line = '',
    i = 0;
  for (; i < words.length; i++) {
    const next = line ? line + ' ' + words[i] : words[i];
    if (measure(next) > width && line) {
      lines.push(line);
      line = words[i];
      if (lines.length === maxLines) break;
    } else line = next;
  }
  if (lines.length < maxLines && line) {
    lines.push(line);
    line = '';
    i = words.length;
  }
  if (i < words.length || line) {
    let last = lines[maxLines - 1] || '';
    while (last && measure(last + '…') > width) last = last.slice(0, -1).trimEnd();
    lines[maxLines - 1] = last + '…';
  }
  return lines;
}

export function createRearPanel(THREE, project, index, { resources, invalidate, isDisposed, labels }) {
  const { width: W, height: H, pad: P, split: S } = REAR,
    canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const c = paintContext(canvas),
    texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  resources.add(texture);
  const tone = accentTones(project.accent);
  let preview = null,
    icon = null;
  const rounded = (x, y, w, h, r) => {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  };
  const lines = (text, x, y, width, font, lineHeight, max, color) => {
    c.font = font;
    c.fillStyle = color;
    const out = wrapLines(t => c.measureText(t).width, text, width, max);
    out.forEach((line, k) => c.fillText(line, x, y + k * lineHeight));
    return out.length;
  };
  function draw() {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
    const base = c.createLinearGradient(0, 0, W, H);
    base.addColorStop(0, tone.deep);
    base.addColorStop(1, '#0d0b19');
    c.fillStyle = base;
    c.fillRect(0, 0, W, H);
    const glow = c.createRadialGradient(150, 110, 10, 150, 110, 420);
    glow.addColorStop(0, tone.glow);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = glow;
    c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(255,255,255,.035)';
    c.lineWidth = 1;
    for (let x = -H; x < W; x += 26) {
      c.beginPath();
      c.moveTo(x, H);
      c.lineTo(x + H, 0);
      c.stroke();
    }
    // Left column: number, icon, name, status, description, dates.
    c.font = '600 17px system-ui';
    c.fillStyle = tone.light;
    c.fillText(((labels.station || 'Pavilion') + ' ' + (index + 1)).toUpperCase().split('').join(' '), P, 64);
    const iconSize = 92;
    rounded(P, 86, iconSize, iconSize, 20);
    c.fillStyle = 'rgba(255,255,255,.08)';
    c.fill();
    if (icon) {
      c.save();
      rounded(P, 86, iconSize, iconSize, 20);
      c.clip();
      const s = Math.min(iconSize / icon.naturalWidth, iconSize / icon.naturalHeight) * 0.86,
        w = icon.naturalWidth * s,
        h = icon.naturalHeight * s;
      c.drawImage(icon, P + (iconSize - w) / 2, 86 + (iconSize - h) / 2, w, h);
      c.restore();
    } else if (project.iconCanvas) c.drawImage(project.iconCanvas, P + 14, 100, iconSize - 28, iconSize - 28);
    const nameLines = lines(project.name, P, 232, S - P - 10, '600 44px system-ui', 50, 2, '#f6f1ff');
    let y = 232 + (nameLines - 1) * 50 + 42;
    const chips = [
      project.archived ? labels.archived : labels.active,
      project.hidden ? labels.hiddenProject : ''
    ].filter(Boolean);
    let x = P;
    c.font = '500 17px system-ui';
    for (const chip of chips) {
      const w = c.measureText(chip).width + 26;
      rounded(x, y - 22, w, 32, 16);
      c.strokeStyle = tone.light;
      c.globalAlpha = 0.75;
      c.lineWidth = 1.5;
      c.stroke();
      c.globalAlpha = 1;
      c.fillStyle = tone.light;
      c.fillText(chip, x + 13, y);
      x += w + 10;
    }
    y += 46;
    lines(
      project.description,
      P,
      y,
      S - P - 10,
      '21px system-ui',
      30,
      Math.max(2, Math.min(5, Math.floor((H - 110 - y) / 30) + 1)),
      '#cfc8e3'
    );
    c.font = '17px system-ui';
    c.fillStyle = '#a69fc0';
    const dates = [
      project.createdLabel && (labels.created || 'Created') + ' · ' + project.createdLabel,
      project.updatedLabel && (labels.updated || 'Updated') + ' · ' + project.updatedLabel
    ].filter(Boolean);
    dates.forEach((line, k) => c.fillText(line, P, H - 66 + k * 26, S - P));
    // Right column: framed preview and the cue toward the front.
    const fx = S + 16,
      fy = 64,
      fw = W - fx - P,
      fh = Math.round(fw * 0.64);
    rounded(fx, fy, fw, fh, 16);
    c.fillStyle = 'rgba(8,7,18,.82)';
    c.fill();
    if (preview) {
      c.save();
      rounded(fx, fy, fw, fh, 16);
      c.clip();
      const s = Math.min(fw / preview.naturalWidth, fh / preview.naturalHeight),
        w = preview.naturalWidth * s,
        h = preview.naturalHeight * s;
      c.drawImage(preview, fx + (fw - w) / 2, fy + (fh - h) / 2, w, h);
      c.restore();
    }
    rounded(fx, fy, fw, fh, 16);
    c.strokeStyle = tone.light;
    c.globalAlpha = 0.55;
    c.lineWidth = 2;
    c.stroke();
    c.globalAlpha = 1;
    // The cue sits on the bottom line with the dates, so both columns end together.
    const cueY = H - 52,
      cue = labels.rearHint || 'The exhibit is on the other side';
    c.font = '500 22px system-ui';
    const cw = c.measureText(cue).width + 74;
    rounded(fx, cueY - 36, Math.min(cw, fw), 54, 27);
    c.fillStyle = 'rgba(255,255,255,.07)';
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,.22)';
    c.lineWidth = 1.5;
    c.stroke();
    c.strokeStyle = tone.light;
    c.lineWidth = 3;
    c.beginPath();
    c.arc(fx + 30, cueY - 9, 11, Math.PI * 0.15, Math.PI * 1.75);
    c.stroke();
    c.beginPath();
    c.moveTo(fx + 38, cueY - 23);
    c.lineTo(fx + 43, cueY - 16);
    c.lineTo(fx + 35, cueY - 14);
    c.stroke();
    c.fillStyle = '#efeaff';
    c.fillText(cue, fx + 52, cueY, fw - 64);
    c.fillStyle = tone.solid;
    c.fillRect(0, H - 7, W, 7);
    texture.needsUpdate = true;
  }
  const load = (source, assign) => {
    if (!source) return;
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      image.onload = image.onerror = null;
      if (isDisposed()) return;
      assign(image);
      draw();
      invalidate();
    };
    image.onerror = () => {
      image.onload = image.onerror = null;
    };
    image.src = source;
  };
  draw();
  load(project.image, image => {
    preview = image;
  });
  load(project.ico, image => {
    icon = image;
  });
  return texture;
}
