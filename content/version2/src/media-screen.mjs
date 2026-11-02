// Real published media is contained in a fixed-size GPU texture, never center-cropped.
import { paintContext } from './paint-canvas.mjs';
export function createProjectScreen(
  THREE,
  project,
  index,
  { resources, invalidate, isDisposed, status, exhibit = false, focusWidth = 2048 }
) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 300;
  const c = paintContext(canvas),
    texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.generateMipmaps = true;
  resources.add(texture);
  let loadedImage = null,
    focused = false;
  const entry = {
    id: project.id,
    state: 'loading',
    source: project.image,
    fit: 'contain',
    texture: [512, 300]
  };
  status.push(entry);
  function text(value, x, y, width, size, lineHeight, maxLines = 4) {
    c.font = size + 'px system-ui';
    const words = String(value || '').split(/\s+/),
      lines = [];
    let line = '';
    for (const word of words) {
      const next = line ? line + ' ' + word : word;
      if (c.measureText(next).width > width && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    for (const [i, line] of lines.slice(0, maxLines).entries())
      c.fillText(line, x, y + i * lineHeight, width);
  }
  // The screen names its project once (owner, round 12: up to three times with a footer): in the header beside the
  // icon, or, where the layout writes the name large (`named` false), only the icon stays up there.
  function background(named = true) {
    c.setTransform(canvas.width / 1024, 0, 0, canvas.height / 600, 0, 0);
    const gradient = c.createLinearGradient(0, 0, 1024, 600);
    gradient.addColorStop(0, '#182b55');
    gradient.addColorStop(1, '#211b39');
    c.fillStyle = gradient;
    c.fillRect(0, 0, 1024, 600);
    c.strokeStyle = '#627daf30';
    for (let x = 0; x < 1024; x += 64) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, 600);
      c.stroke();
    }
    c.fillStyle = '#899bcc';
    c.font = '20px system-ui';
    c.textAlign = 'left';
    if (project.iconCanvas) c.drawImage(project.iconCanvas, 28, 12, 42, 42);
    if (!named) return;
    c.font = '500 27px system-ui';
    c.fillStyle = '#edf0ff';
    c.fillText(project.name, 88, 43, 890);
  }
  function fallback() {
    background(false);
    c.textAlign = 'center';
    c.font = '80px system-ui';
    c.fillStyle = '#97afff';
    c.fillText('◇', 512, 235);
    c.fillStyle = '#e9efff';
    c.font = '500 37px system-ui';
    c.fillText(project.name, 512, 310, 900);
    c.textAlign = 'left';
    c.fillStyle = '#b1bfdc';
    text(project.description, 92, 367, 840, 21, 30, 3);
    texture.needsUpdate = true;
  }
  fallback();
  async function load(source, iconFallback = false) {
    if (!source) {
      entry.state = 'missing';
      invalidate();
      return;
    }
    const image = new Image();
    image.decoding = 'async';
    try {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = source;
      });
      if (isDisposed()) return;
      loadedImage = image;
      paint(image, iconFallback);
    } catch {
      if (!iconFallback && project.ico && project.ico !== source) {
        await load(project.ico, true);
      } else {
        entry.state = 'fallback';
        fallback();
        invalidate();
      }
    } finally {
      image.onload = image.onerror = null;
    }
  }
  function paint(image, iconFallback = false) {
    const portrait = image.naturalWidth / image.naturalHeight < 0.82;
    background(!portrait);
    if (exhibit) {
      c.fillStyle = '#101b25';
      c.fillRect(0, 0, 1024, 600);
      const region = portrait
        ? { x: 535, y: 16, width: 471, height: 568 }
        : { x: 14, y: 14, width: 996, height: 572 };
      const scale = Math.min(region.width / image.naturalWidth, region.height / image.naturalHeight),
        w = image.naturalWidth * scale,
        h = image.naturalHeight * scale;
      c.drawImage(image, region.x + (region.width - w) / 2, region.y + (region.height - h) / 2, w, h);
      if (portrait) {
        c.fillStyle = project.accent || '#a4c8d5';
        c.font = '19px ui-monospace,monospace';
        c.textAlign = 'left';
        c.fillText(String(index + 1).padStart(2, '0') + ' / ' + project.id, 36, 67, 466);
        c.fillStyle = '#f0f1ec';
        text(project.name, 36, 132, 465, 40, 48, 2);
        c.fillStyle = '#b8c7d0';
        text(project.description, 36, 260, 465, 25, 34, 7);
      }
      texture.needsUpdate = true;
      entry.state = iconFallback ? 'fallbackIcon' : 'loaded';
      entry.source = image.currentSrc || image.src;
      entry.image = [image.naturalWidth, image.naturalHeight];
      entry.portrait = portrait;
      entry.presentation = 'exhibit';
      invalidate();
      return;
    }
    // Without the footer the picture takes the screen's full height under the header (a portrait one all of it).
    const region = portrait
      ? { x: 554, y: 16, width: 446, height: 568 }
      : { x: 16, y: 65, width: 992, height: 519 };
    const scale = Math.min(region.width / image.naturalWidth, region.height / image.naturalHeight);
    const w = image.naturalWidth * scale,
      h = image.naturalHeight * scale;
    c.drawImage(image, region.x + (region.width - w) / 2, region.y + (region.height - h) / 2, w, h);
    if (portrait) {
      c.fillStyle = '#e7ecff';
      c.textAlign = 'left';
      text(project.name, 38, 130, 478, 44, 52, 2);
      c.fillStyle = '#abbadd';
      text(project.description, 38, 275, 455, 28, 37, 6);
      c.font = '18px system-ui';
      c.fillStyle = '#849cc9';
      c.fillText(project.createdLabel || '', 38, 560);
    }
    texture.needsUpdate = true;
    entry.state = iconFallback ? 'fallbackIcon' : 'loaded';
    entry.source = image.currentSrc || image.src;
    entry.image = [image.naturalWidth, image.naturalHeight];
    entry.portrait = portrait;
    invalidate();
  }
  texture.userData.setFocused = value => {
    if (focused === value) return;
    focused = value;
    texture.dispose();
    canvas.width = value ? focusWidth : 512;
    canvas.height = value ? (focusWidth * 300) / 512 : 300;
    entry.texture = [canvas.width, canvas.height];
    loadedImage ? paint(loadedImage) : fallback();
    invalidate();
  };
  load(project.image || project.ico);
  return texture;
}
