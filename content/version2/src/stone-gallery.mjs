import { buildGreenhouse } from './greenhouse.mjs';
import { buildGallerySample, SAMPLE } from './gallery-sample.mjs';
import { buildGalleryVariant } from './gallery-variant-core.mjs';
export function galleryVariant(search = globalThis.location?.search || '') {
  const value = new URLSearchParams(search).get('gallery');
  return /^[1-5]$/.test(value || '') ? Number(value) : 1;
}

export const STONE_GALLERY_ID = 'FenesyyySupport';
// Explicit ID selection, including after filters/reordering; duplicate IDs fail closed.
export function stoneGallerySlots(projects, selected = new Set(projects.map((_, i) => i))) {
  const matches = projects.flatMap((p, i) => (p.id === STONE_GALLERY_ID ? [i] : []));
  return new Set(matches.length === 1 && selected.has(matches[0]) ? matches : []);
}
export const STONE_DECK = [
  [-3.4, -0.65],
  [3.4, -0.65],
  [3.4, 12.625],
  [-3.4, 12.625]
];
export function createStoneDeckShape(THREE) {
  const shape = new THREE.Shape();
  STONE_DECK.forEach(([x, z], i) => (i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)));
  return shape.closePath();
}

export function buildStoneGallery(THREE, options) {
  // The building plan (building-variants.mjs) passes `planned` for any project with enough content.
  if (options.project.id !== STONE_GALLERY_ID && !options.planned)
    throw new Error('Stone gallery requires the exact project ID');
  // Use the real builder as content owner, including its original sign, atlas loader,
  // video indices and pinned-note canvas. Its temporary architecture is never mounted.
  let disposed = false;
  const staging = new THREE.Group(),
    temporary = new Set();
  const source = buildGreenhouse(THREE, {
    ...options,
    group: staging,
    plants: null,
    isDisposed: () => disposed || options.isDisposed(),
    mesh(geometry, material, parent = staging) {
      temporary.add(geometry);
      const object = new THREE.Mesh(geometry, material);
      parent.add(object);
      return object;
    }
  });
  const variant = galleryVariant();
  const builder =
    variant === 1 ? buildGallerySample : (three, settings) => buildGalleryVariant(three, variant, settings);
  const sample = builder(THREE, {
    signMaterial: source.sign.material,
    accent: options.project.accent,
    lights: false,
    content: {
      screenMaterial: source.screen.material,
      openMaterial: source.open.material,
      descriptionMaterial: source.boards.find(b => b.zone === 'description').board.material,
      commentsMaterial: source.boards.find(b => b.zone === 'comments').board.material,
      galleryMaterial: source.gallery?.object.material,
      galleryImages: source.gallery?.images || [],
      loadPictures: source.loadPictures,
      pinNotes: source.pinNotes
    }
  });
  for (const geometry of temporary) geometry.dispose();
  staging.clear();
  sample.group.userData.galleryVariant = variant;
  options.group.add(sample.group);
  options.group.userData.badgeAnchor = { ...SAMPLE.badge };
  // Already batched locally. The global architecture bake traverses hidden objects:
  // exclude this whole subtree so collision proxies never become visible batches.
  // Its pavilion parent already supplies island animation and filtering transforms.
  sample.group.traverse(object => {
    object.userData.owner = options.owner;
    object.userData.dynamic = true;
  });
  const practicalMaterials = [
    ...new Set(
      sample.group.children
        .filter(o => o.isMesh && o.material.isMeshStandardMaterial && !o.material.transparent)
        .map(o => o.material)
    )
  ];
  const result = {
    ...sample,
    practicalMaterials,
    dispose() {
      if (disposed) return;
      disposed = true;
      sample.dispose();
    },
    loadPictures() {
      if (!disposed) source.loadPictures();
    },
    pinNotes(...args) {
      if (!disposed) source.pinNotes(...args);
    },
    inside: local => sample.inside(local.x, local.z) && local.y < SAMPLE.eave,
    doorCentre: { x: 0, y: (SAMPLE.floor + SAMPLE.doorTop) / 2, z: SAMPLE.front },
    leaves: [],
    winterParts: [],
    // Its depth, as the East houses report theirs (the plan records it).
    back: SAMPLE.back,
    zoneLook(zone) {
      const board = sample.boards.find(b => b.zone === zone)?.board;
      return board ? board.position : { x: 0, y: SAMPLE.hero.y, z: SAMPLE.hero.z };
    }
  };
  options.resources.add(result);
  return result;
}
