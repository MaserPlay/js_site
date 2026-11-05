// A repeating granite-paver surface. It uses the existing deck UVs and never
// changes the bridge mesh, collision floor or the garden's seeded vegetation.
import { paintContext } from './paint-canvas.mjs';
// The granite's colour and relief pictures, drawn once per page: each rebuilt garden makes its own textures from
// the same canvases (the pixel loop cost ~70 ms of every sort, round 9).
let pictures = null;
function granitePictures(document) {
  if (pictures?.document === document) return pictures;
  const size = 512,
    tileWidth = 256,
    tileHeight = 128;
  const colorCanvas = document.createElement('canvas');
  const reliefCanvas = document.createElement('canvas');
  colorCanvas.width = reliefCanvas.width = size;
  colorCanvas.height = reliefCanvas.height = size;
  const colorContext = paintContext(colorCanvas);
  const reliefContext = paintContext(reliefCanvas);
  const colorPixels = colorContext.createImageData(size, size);
  const reliefPixels = reliefContext.createImageData(size, size);
  // Independent integer hash keeps the pattern stable without consuming the
  // world's texture or plant random sequence. Periodic coordinates hide seams.
  const hash = (x, y, salt = 0) => {
    let value = Math.imul(x + 317 + salt, 374761393) ^ Math.imul(y + 911, 668265263);
    value = Math.imul(value ^ (value >>> 13), 1274126177);
    return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
  };
  for (let y = 0; y < size; y++) {
    const row = Math.floor(y / tileHeight),
      localY = y % tileHeight;
    for (let x = 0; x < size; x++) {
      const shiftedX = (x + ((row % 2) * tileWidth) / 2) % size;
      const column = Math.floor(shiftedX / tileWidth),
        localX = shiftedX % tileWidth;
      const edge = Math.min(localX, tileWidth - 1 - localX, localY, tileHeight - 1 - localY);
      const grain = hash(x, y),
        crystal = hash(Math.floor(x / 2), Math.floor(y / 2), 41);
      const tileTone = (hash(column, row, 19) - 0.5) * 14;
      const mottling =
        Math.sin((x * Math.PI) / 64 + Math.sin((y * Math.PI) / 128)) * 2.4 +
        Math.cos((y * Math.PI) / 32 + (x * Math.PI) / 128) * 1.8;
      const fleck = crystal < 0.045 ? -28 : crystal > 0.935 ? 15 : 0;
      const tone = tileTone + mottling + (grain - 0.5) * 17 + fleck;
      const bevel = Math.min(1, Math.max(0, (edge - 1) / 3));
      const grout = edge < 2;
      const offset = (y * size + x) * 4;
      // Warm neutral cut stone: lamps and sky supply the colour, not emission.
      const base = grout ? [112, 111, 107] : [185 + tone, 182 + tone, 174 + tone];
      for (let channel = 0; channel < 3; channel++) {
        colorPixels.data[offset + channel] = base[channel] * (grout ? 1 : 0.94 + bevel * 0.06);
        reliefPixels.data[offset + channel] = grout ? 72 : 170 + bevel * 52 + (grain - 0.5) * 15;
      }
      colorPixels.data[offset + 3] = reliefPixels.data[offset + 3] = 255;
    }
  }
  colorContext.putImageData(colorPixels, 0, 0);
  reliefContext.putImageData(reliefPixels, 0, 0);
  pictures = { document, colorCanvas, reliefCanvas };
  return pictures;
}

export function createGraniteBridgeMaterial(THREE, document, resources) {
  const { colorCanvas, reliefCanvas } = granitePictures(document);
  const map = new THREE.CanvasTexture(colorCanvas);
  const bumpMap = new THREE.CanvasTexture(reliefCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  for (const texture of [map, bumpMap]) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    // Existing UV unit = 1.4 m: a 2.8 m repeat yields 1.4 x .7 m pavers.
    texture.repeat.set(0.5, 0.5);
    texture.anisotropy = 4;
    resources.add(texture);
  }
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map,
    bumpMap,
    bumpScale: 0.022,
    roughness: 0.91,
    metalness: 0,
    flatShading: true
  });
  resources.add(material);
  return material;
}
