// Glass pavilion details from the confirmed realistic reference: glazed side walls in slim metal frames,
// a lit rooftop sign with the project icon and name, a warm interior and an in-world "Open project" pill.
// Everything is built in the pavilion's local frame (front = -z, screen at the back) and parented to it.
// The hall's plan (depth, roof, doors) is in pavilion-hall.mjs.
import { HALL } from './pavilion-hall.mjs';
import { paintContext } from './paint-canvas.mjs';

export const GLASS = {
  sideX: HALL.sideX,
  front: HALL.front,
  back: HALL.back,
  bottom: HALL.bottom,
  top: HALL.top,
  // The sign stands on the front of the elliptical roof (HALL.roof, top about y 5.2) and its bottom clears
  // the roof rim, so the rim does not hide the name from the journey camera.
  sign: { width: 3.6, height: 0.64, y: 5.77, z: -2.38, base: 5.2 },
  pill: { width: 1.86, height: 0.34, y: 0.98, z: HALL.screenZ - 0.12 }
};
export const SIGN_CANVAS = { width: 1024, height: 182 };

// Glass reads as glass from the angle it reflects at: a little of the fog (horizon) colour and more opacity at
// grazing view angles, almost clear when seen straight through. Close to the camera it stays clear: standing in
// a hall, the panes beside you were turning into opaque sky-coloured sheets (at night a solid blue), which read
// as a rendering bug. The cube term avoids pow() on a negative base; the view length is guarded against zero.
const GLASS_FRESNEL = `
  float gardenGlassView = length( vViewPosition );
  float gardenGlassEdge = clamp( 1.0 - abs( dot( vViewPosition / max( gardenGlassView, 1e-3 ), normal ) ), 0.0, 1.0 );
  gardenGlassEdge = gardenGlassEdge * gardenGlassEdge * gardenGlassEdge * smoothstep( 1.5, 4.5, gardenGlassView );
  #ifdef USE_FOG
    outgoingLight += fogColor * gardenGlassEdge * 0.3;
  #endif
  diffuseColor.a = mix( diffuseColor.a, 0.4, gardenGlassEdge );
  #include <opaque_fragment>`;

// Shared per world: one glass and one frame material for every pavilion.
export function createGlassMaterials(THREE, resources) {
  const glass = new THREE.MeshStandardMaterial({
    color: 0xc9dcff,
    emissive: 0x1a2140,
    emissiveIntensity: 0.35,
    roughness: 0.06,
    metalness: 0.2,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    side: THREE.DoubleSide,
    // Panes sit flush in their frames: the frame wins where they meet, at any distance (round 5 z-fight audit).
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 4
  });
  glass.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', GLASS_FRESNEL);
  };
  glass.customProgramCacheKey = () => 'garden-pavilion-glass-v2';
  // A lighter anodised frame: the darker one turned into black bars across the view from inside at night.
  const frame = new THREE.MeshStandardMaterial({ color: 0x6a6582, roughness: 0.4, metalness: 0.55 });
  resources.add(glass);
  resources.add(frame);
  return { glass, frame };
}

// Sign text never overflows: shrink the font until the name fits the space beside the icon.
export function fitFont(measure, text, maxWidth, start = 96, min = 40) {
  let size = start;
  while (size > min && measure(text, size) > maxWidth) size -= 4;
  return size;
}

function signTexture(THREE, project, { resources, invalidate, isDisposed }) {
  const { width: W, height: H } = SIGN_CANVAS,
    canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const c = paintContext(canvas),
    texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  resources.add(texture);
  const accent = project.accent || '#a895e5';
  let icon = null;
  function draw() {
    const glow = c.createLinearGradient(0, 0, W, 0);
    glow.addColorStop(0, '#0c0a18');
    glow.addColorStop(0.5, '#15112a');
    glow.addColorStop(1, '#0c0a18');
    c.fillStyle = glow;
    c.fillRect(0, 0, W, H);
    c.strokeStyle = accent;
    c.lineWidth = 6;
    c.strokeRect(5, 5, W - 10, H - 10);
    const iconSize = H - 54,
      iconX = 34,
      iconY = 27;
    if (icon) {
      // Keep the icon's own proportions inside the square slot.
      const s = Math.min(iconSize / icon.naturalWidth, iconSize / icon.naturalHeight),
        w = icon.naturalWidth * s,
        h = icon.naturalHeight * s;
      c.drawImage(icon, iconX + (iconSize - w) / 2, iconY + (iconSize - h) / 2, w, h);
    } else if (project.iconCanvas) c.drawImage(project.iconCanvas, iconX, iconY, iconSize, iconSize);
    const textX = iconX + iconSize + 30,
      maxWidth = W - textX - 34,
      size = fitFont(
        (text, px) => {
          c.font = `600 ${px}px system-ui`;
          return c.measureText(text).width;
        },
        project.name,
        maxWidth
      );
    c.font = `600 ${size}px system-ui`;
    c.textBaseline = 'middle';
    c.shadowColor = accent;
    c.shadowBlur = 18;
    c.fillStyle = '#f7f2ff';
    c.fillText(project.name, textX, H / 2 + 4, maxWidth);
    c.shadowBlur = 0;
    texture.needsUpdate = true;
  }
  draw();
  if (project.ico) {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      image.onload = image.onerror = null;
      if (isDisposed()) return;
      icon = image;
      draw();
      invalidate();
    };
    image.onerror = () => {
      image.onload = image.onerror = null;
    };
    image.src = project.ico;
  }
  return texture;
}

function pillTexture(THREE, text, accent, resources) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 94;
  const c = paintContext(canvas);
  c.fillStyle = '#1b1530';
  c.beginPath();
  c.roundRect(3, 3, 506, 88, 44);
  c.fill();
  c.lineWidth = 5;
  c.strokeStyle = accent;
  c.stroke();
  c.fillStyle = '#f4efff';
  c.font = '600 38px system-ui';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text + '  →', 256, 49, 470);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  resources.add(texture);
  return texture;
}

// Returns the pickable "open" pill so the caller can register it.
export function buildGlassPavilion(
  THREE,
  { group, mesh, materials, project, labels, resources, invalidate, isDisposed }
) {
  const { sideX, front, back, bottom, top, sign, pill } = GLASS,
    depth = back - front,
    height = top - bottom,
    midZ = (front + back) / 2,
    midY = (top + bottom) / 2;
  // Glazed side walls between the pillars: a rail at the floor and under the roof, two slim mullions and no
  // waist-high transom, so the frame does not read as a railing.
  for (const side of [-1, 1]) {
    const pane = mesh(new THREE.PlaneGeometry(depth - 0.3, height), materials.glass, group);
    pane.position.set(side * sideX, midY, midZ);
    pane.rotation.y = Math.PI / 2;
    pane.renderOrder = 3;
    for (const y of [bottom, top]) {
      const rail = mesh(new THREE.BoxGeometry(0.06, 0.06, depth - 0.3), materials.frame, group);
      rail.position.set(side * sideX, y, midZ);
    }
    for (const t of [1 / 3, 2 / 3]) {
      const mullion = mesh(new THREE.BoxGeometry(0.04, height, 0.04), materials.frame, group);
      mullion.position.set(side * sideX, midY, front + 0.15 + (depth - 0.3) * t);
    }
  }
  // The back wall is glazed too, behind the rear poster, so the hall is closed on every side.
  const backWidth = (sideX - 0.17) * 2,
    backPane = mesh(new THREE.PlaneGeometry(backWidth, height), materials.glass, group);
  backPane.position.set(0, midY, back + 0.05);
  backPane.renderOrder = 3;
  for (const y of [bottom, top]) {
    const rail = mesh(new THREE.BoxGeometry(backWidth, 0.06, 0.06), materials.frame, group);
    rail.position.set(0, y, back + 0.05);
  }
  // Rooftop sign: a lightbox on two posts above the front of the roof.
  const signMaterial = new THREE.MeshBasicMaterial({
    map: signTexture(THREE, project, { resources, invalidate, isDisposed }),
    toneMapped: false,
    // A face a few centimetres off its frame or box: kept in front of it at any distance (round 5 z-fight audit).
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4
  });
  resources.add(signMaterial);
  const box = mesh(
    new THREE.BoxGeometry(sign.width + 0.12, sign.height + 0.12, 0.16),
    materials.frame,
    group
  );
  box.position.set(0, sign.y, sign.z + 0.09);
  const face = mesh(new THREE.PlaneGeometry(sign.width, sign.height), signMaterial, group);
  face.position.set(0, sign.y, sign.z);
  face.rotation.y = Math.PI;
  const postLength = sign.y - sign.height / 2 - sign.base;
  for (const x of [-sign.width * 0.32, sign.width * 0.32]) {
    const post = mesh(new THREE.BoxGeometry(0.07, postLength, 0.07), materials.frame, group);
    post.position.set(x, sign.base + postLength / 2, sign.z + 0.09);
  }
  // In-world "Open project" pill under the screen.
  const pillMaterial = new THREE.MeshBasicMaterial({
    map: pillTexture(THREE, labels.openProject || 'Open project', project.accent || '#a895e5', resources),
    toneMapped: false,
    transparent: true,
    // A face a few centimetres off its frame or box: kept in front of it at any distance (round 5 z-fight audit).
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4
  });
  resources.add(pillMaterial);
  const open = mesh(new THREE.PlaneGeometry(pill.width, pill.height), pillMaterial, group);
  open.position.set(0, pill.y, pill.z);
  open.rotation.y = Math.PI;
  return { open, sign: face };
}
