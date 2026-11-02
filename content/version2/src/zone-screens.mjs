import { contentLevel } from './content-level.mjs';
import { paintContext } from './paint-canvas.mjs';

// The two looks of the boards inside the houses, matched to the project card (garden-project.css): Natural is warm
// paper, ink and a lacquer-red accent with a gold hairline; Neon is deep violet glass, light text and a cyan accent
// (owner, round 9: the boards had kept the old violet-black look in both styles). `stage` sits behind pictures.
export const BOARD_LOOKS = {
  natural: {
    paper: ['#fcf9f2', '#f2e9d6'],
    edge: '#d9c7a3',
    hairline: '#c09445',
    accent: '#b4372a',
    title: '#241d17',
    body: '#5f5246',
    stage: '#1c1815',
    glow: null
  },
  neon: {
    paper: ['#241b3d', '#16112a'],
    edge: '#6d55b8',
    hairline: '#4fd8ff',
    accent: '#4fd8ff',
    title: '#f2ecff',
    body: '#c9bde6',
    stage: '#0d0a17',
    glow: '#4fd8ff'
  }
};

// Three reusable canvases for the active island. Images are decoded one at a time.
export function createZoneScreens(THREE, resources, invalidate, isDisposed, labels) {
  const items = Object.fromEntries(
    ['gallery', 'description', 'comments', 'idle'].map(key => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 640;
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      resources.add(texture);
      const material = contentLevel(new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
      resources.add(material);
      return [key, { canvas, texture, material, shown: null }];
    })
  );
  let token = 0,
    style = 'natural';
  function draw(key, title, body, image) {
    const item = items[key],
      c = paintContext(item.canvas),
      look = BOARD_LOOKS[style];
    item.shown = [title, body, image];
    const paper = c.createLinearGradient(0, 0, 0, 640);
    paper.addColorStop(0, look.paper[0]);
    paper.addColorStop(1, look.paper[1]);
    c.fillStyle = paper;
    c.fillRect(0, 0, 1024, 640);
    c.strokeStyle = look.edge;
    c.lineWidth = 6;
    c.strokeRect(3, 3, 1018, 634);
    c.fillStyle = look.hairline;
    c.fillRect(38, 100, 948, 2);
    c.save();
    if (look.glow) {
      c.shadowColor = look.glow;
      c.shadowBlur = 16;
    }
    c.fillStyle = look.accent;
    c.fillRect(38, 40, 6, 45);
    c.restore();
    c.fillStyle = look.title;
    c.font = '650 36px Georgia, "Noto Serif", serif';
    c.textBaseline = 'alphabetic';
    c.fillText(title, 64, 75, 920);
    if (image) {
      c.fillStyle = look.stage;
      c.fillRect(38, 118, 948, 478);
      const scale = Math.min(916 / image.naturalWidth, 448 / image.naturalHeight),
        w = image.naturalWidth * scale,
        h = image.naturalHeight * scale;
      c.drawImage(image, (1024 - w) / 2, 133 + (448 - h) / 2, w, h);
    } else {
      c.font = '28px system-ui';
      c.fillStyle = look.body;
      let y = 162,
        line = '';
      for (const word of String(body).split(/\s+/)) {
        if (c.measureText(line + ' ' + word).width > 870) {
          c.fillText(line, 64, y);
          y += 42;
          line = '';
          if (y > 560) break;
        }
        line += (line ? ' ' : '') + word;
      }
      if (y <= 560) c.fillText(line, 64, y);
    }
    item.texture.needsUpdate = true;
    invalidate();
  }
  draw('idle', labels.sectionHint, '');
  return {
    items,
    draw,
    // The light style (world.setLightStyle, called every frame): the boards are redrawn only when it changes.
    setStyle(next) {
      const value = next === 'neon' ? 'neon' : 'natural';
      if (value === style) return;
      style = value;
      for (const [key, item] of Object.entries(items)) if (item.shown) draw(key, ...item.shown);
    },
    async image(title, url) {
      const id = ++token;
      draw('gallery', title, labels.loading);
      if (!url) return;
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.decoding = 'async';
      image.onload = () => {
        if (id === token && !isDisposed()) draw('gallery', title, '', image);
      };
      image.onerror = () => {
        if (id === token && !isDisposed()) draw('gallery', title, labels.fallback);
      };
      image.src = url;
    },
    cancel() {
      token++;
    }
  };
}
