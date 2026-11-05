// Photo-leaf foliage from the project's own CC0 maps: Poly Haven Jacaranda leaves/bark and
// Gazania flower heads, Mundo pine needles. Nothing new is downloaded.
// A crown is a cluster of alpha-tested spray cards whose normals follow the crown volume,
// so light wraps around the whole canopy instead of every card shading flat.
import { parkMillerStream } from './seeded-random.mjs';
import { gardenFile } from './garden-paths.mjs';
const ROOT = gardenFile('assets/');
const SIZE = 1024;

// Sprites in atlas pixels (y down): box, the stem point where the card attaches, and the
// direction the spray grows from it ('x+' right, 'x-' left, 'y-' up the image).
// Centred sprites (flower heads) are placed around their base point and face outward.
// Light through the leaves (translucency) follows daylight: lighting() sets it from the sun, 1 by day. Owner, round 4:
// at night the foliage glowed, because the term was added whatever the light (vines and cypresses most of all).
export const foliageDaylight = { value: 1 };
export const SPRITES = {
  leaf: [
    { box: [160, 28, 1012, 484], base: [166, 236], axis: 'x+' },
    { box: [0, 330, 440, 712], base: [0, 512], axis: 'x+' },
    { box: [250, 598, 1024, 1012], base: [1024, 822], axis: 'x-' }
  ],
  needle: [{ box: [30, 10, 640, 1004], base: [318, 1004], axis: 'y-' }],
  blossom: [
    { box: [20, 676, 352, 1004], base: [186, 840], centred: true },
    { box: [396, 742, 648, 998], base: [522, 870], centred: true }
  ]
};

export function loadFoliageMaps(THREE, resources, invalidate = () => {}) {
  const loader = new THREE.TextureLoader(),
    maps = {};
  const load = (key, file, srgb = true) => {
    const texture = loader.load(
      ROOT + file,
      () => invalidate(),
      undefined,
      () => console.warn('Foliage map unavailable', file)
    );
    if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    resources?.add(texture);
    maps[key] = texture;
    return texture;
  };
  load('leaves', 'cc0-botanicals/leaves.png');
  load('blossoms', 'cc0-botanicals/flowers.png');
  load('needles', 'mundo-pine/diffuse.png');
  load('bark', 'cc0-botanicals/trunk.jpg');
  load('barkNormal', 'cc0-botanicals/trunk-normal.jpg', false);
  return maps;
}

// Grid of card corners: rows along the spray (from the stem), two columns across it.
// Each corner is [along metres-from-stem fraction, across pixels, u, v].
function cardGrid(sprite, columns) {
  const [x0, y0, x1, y1] = sprite.box,
    [bx, by] = sprite.base,
    steps = columns === 3 ? [0, 0.5, 1] : [0, 1],
    rows = [];
  if (sprite.centred) {
    const span = Math.max(x1 - x0, y1 - y0);
    for (const t of [0, 1])
      rows.push(
        [
          [x0, y1 - (y1 - y0) * t],
          [x1, y1 - (y1 - y0) * t]
        ].map(([x, y]) => ({ along: (by - y) / span, across: (x - bx) / span, u: x / SIZE, v: 1 - y / SIZE }))
      );
    return { rows, pixels: span };
  }
  if (sprite.axis === 'y-') {
    const length = by - y0;
    for (const t of steps) {
      const y = by - (by - y0) * t;
      rows.push(
        [x0, x1].map(x => ({
          along: (by - y) / length,
          across: (x - bx) / length,
          u: x / SIZE,
          v: 1 - y / SIZE
        }))
      );
    }
    return { rows, pixels: length };
  }
  const sign = sprite.axis === 'x-' ? -1 : 1,
    far = sign > 0 ? x1 : x0,
    length = Math.abs(far - bx);
  for (const t of steps) {
    const x = bx + (far - bx) * t;
    rows.push(
      [y0, y1].map(y => ({
        along: Math.abs(x - bx) / length,
        across: (y - by) / length,
        u: x / SIZE,
        v: 1 - y / SIZE
      }))
    );
  }
  return { rows, pixels: length };
}

/**
 * Cluster of spray cards inside an ellipsoid (radius × height × radius).
 * cards: spray count; cardLength: metres from stem to tip; droop: tip sag in metres;
 * lift: upward bias of growth directions; columns: 3 bends each card, 2 keeps it flat;
 * core: how deep inside the crown cards start; shade: [inner, outer] occlusion.
 */
export function createCardCluster(
  THREE,
  {
    sprites = SPRITES.leaf,
    cards = 32,
    radius = 1,
    height = 0.8,
    cardLength = 0.8,
    droop = 0.18,
    lift = 0.25,
    columns = 3,
    core = 0.55,
    seed = 1,
    shade = [0.52, 1.05],
    yOffset = 0,
    spread = 0.35
  } = {}
) {
  // Own Park–Miller stream: a cluster is identical for the same seed and never touches the scenery RNG.
  const random = parkMillerStream(seed),
    positions = [],
    normals = [],
    uvs = [],
    colors = [],
    sway = [],
    indices = [];
  const centre = new THREE.Vector3(0, yOffset, 0),
    scale = new THREE.Vector3(radius, height, radius),
    up = new THREE.Vector3(0, 1, 0),
    xAxis = new THREE.Vector3(1, 0, 0);
  const direction = new THREE.Vector3(),
    side = new THREE.Vector3(),
    face = new THREE.Vector3(),
    base = new THREE.Vector3(),
    point = new THREE.Vector3(),
    normal = new THREE.Vector3();
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < cards; i++) {
    // Fibonacci directions with jitter cover the crown evenly without visible rows.
    const y = 1 - ((i + 0.5) / cards) * 2,
      ring = Math.sqrt(Math.max(0, 1 - y * y)),
      theta = i * golden + random() * 0.7;
    direction
      .set(
        Math.cos(theta) * ring + (random() - 0.5) * spread,
        y + (random() - 0.5) * spread + lift,
        Math.sin(theta) * ring + (random() - 0.5) * spread
      )
      .normalize();
    base
      .copy(direction)
      .multiply(scale)
      .multiplyScalar(core * (0.35 + 0.65 * random()))
      .add(centre);
    const sprite = sprites[Math.floor(random() * sprites.length)],
      grid = cardGrid(sprite, sprite.centred ? 2 : columns),
      length = cardLength * (0.72 + 0.5 * random());
    // The card plane contains the growth direction; a random roll keeps cards from aligning.
    side
      .crossVectors(direction, Math.abs(direction.y) > 0.92 ? xAxis : up)
      .normalize()
      .applyAxisAngle(direction, (random() - 0.5) * 2.2);
    face.crossVectors(direction, side).normalize();
    const sag = droop * (0.6 + 0.8 * random()),
      first = positions.length / 3;
    for (const row of grid.rows)
      for (const corner of row) {
        if (sprite.centred)
          point
            .copy(base)
            .addScaledVector(face, corner.along * length)
            .addScaledVector(side, corner.across * length);
        else {
          point
            .copy(base)
            .addScaledVector(direction, corner.along * length)
            .addScaledVector(side, -corner.across * length);
          point.y -= sag * corner.along * corner.along;
        }
        positions.push(point.x, point.y, point.z);
        normal.copy(point).sub(centre).divide(scale);
        const distance = Math.min(1.25, normal.length());
        normal
          .normalize()
          .addScaledVector(up, 0.35)
          .addScaledVector(sprite.centred ? direction : face, 0.18)
          .normalize();
        normals.push(normal.x, normal.y, normal.z);
        uvs.push(corner.u, corner.v);
        const occlusion =
            (shade[0] + (shade[1] - shade[0]) * Math.min(1, distance)) * (point.y >= centre.y ? 1 : 0.88),
          tone = 0.92 + 0.16 * random();
        colors.push(occlusion * tone, occlusion * (0.95 + 0.1 * random()), occlusion * tone * 0.96);
        sway.push(Math.min(1, 0.25 + distance * 0.8) * (sprite.centred ? 0.6 : 0.3 + 0.7 * corner.along));
      }
    for (let r = 0; r < grid.rows.length - 1; r++) {
      const a = first + r * 2,
        b = a + 1,
        c = a + 2,
        d = a + 3;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('foliageSway', new THREE.Float32BufferAttribute(sway, 1));
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.cards = cards;
  return geometry;
}

// A hanging strand: sprays stacked down local -Y over `length` metres, fuller at the top, tips hanging.
// Build it at its real length and scale instances evenly: stretching a short strand on Y turned the leaves
// into long dark streaks that read as a rendering bug.
export function createVineStrand(
  THREE,
  {
    sprites = SPRITES.leaf,
    cards = 9,
    width = 0.42,
    seed = 1,
    cardLength = 0.42,
    length = 1,
    shade = [0.62, 0.25]
  } = {}
) {
  const random = parkMillerStream(seed),
    parts = [];
  for (let i = 0; i < cards; i++) {
    const t = (i + 0.3 * random()) / cards,
      light = shade[0] + shade[1] * (1 - t),
      g = createCardCluster(THREE, {
        sprites,
        cards: 1,
        radius: 0.01,
        height: 0.01,
        cardLength: cardLength * (1 - 0.35 * t),
        droop: 0.04,
        lift: -2.4,
        columns: 2,
        core: 0,
        seed: seed * 31 + i,
        spread: 0.6,
        shade: [light, light]
      });
    g.translate((random() - 0.5) * width * (1 - t * 0.5), -t * length, (random() - 0.5) * width * 0.35);
    parts.push(g);
  }
  return mergeCards(THREE, parts, cards);
}
export function mergeCards(THREE, parts, cards) {
  const names = [
      ['position', 3],
      ['normal', 3],
      ['uv', 2],
      ['color', 3],
      ['foliageSway', 1]
    ],
    data = Object.fromEntries(names.map(([n]) => [n, []])),
    indices = [];
  let offset = 0;
  for (const g of parts) {
    for (const [n] of names) for (const value of g.attributes[n].array) data[n].push(value);
    for (const i of g.index.array) indices.push(i + offset);
    offset += g.attributes.position.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  for (const [n, size] of names) out.setAttribute(n, new THREE.Float32BufferAttribute(data[n], size));
  out.setIndex(indices);
  out.computeBoundingBox();
  out.computeBoundingSphere();
  out.userData.cards = cards;
  return out;
}

/**
 * Alpha-tested, double-sided foliage. `recolor` blends the photo colour toward its luminance times
 * the vertex/instance colour, so seasons and species (red maple, frosted fir) keep photo detail.
 * Wind sways card tips with a phase per instance; no per-frame CPU work besides one uniform.
 */
export function createFoliageMaterial(
  THREE,
  {
    map,
    time,
    recolor = 0.82,
    gain = 2.7,
    wind = 1,
    translucency = 0.07,
    alphaTest = 0.42,
    roughness = 0.86,
    name = 'foliage'
  } = {}
) {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map,
    vertexColors: true,
    side: THREE.DoubleSide,
    alphaTest,
    roughness,
    metalness: 0
  });
  material.alphaToCoverage = true;
  material.name = name;
  const uniforms = {
    foliageTime: time || { value: 0 },
    foliageRecolor: { value: recolor },
    foliageGain: { value: gain },
    foliageWind: { value: wind },
    foliageTranslucency: { value: translucency },
    foliageDaylight
  };
  material.userData.foliageUniforms = uniforms;
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute float foliageSway;\nuniform float foliageTime;\nuniform float foliageWind;'
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
          {
            vec3 foliageAnchor=vec3(0.);
          #ifdef USE_INSTANCING
            foliageAnchor=instanceMatrix[3].xyz;
          #endif
            float foliagePhase=foliageTime*1.15+dot(foliageAnchor,vec3(.37,.11,.23));
            transformed+=foliageSway*foliageWind*
                vec3(sin(foliagePhase+position.y*1.7)*.045,sin(foliagePhase*1.7+position.x*2.3)*.022,
                cos(foliagePhase*.9+position.z*1.9)*.04);
          }`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float foliageRecolor;\nuniform float foliageGain;\nuniform float foliageTranslucency;\nuniform float foliageDaylight;'
      )
      .replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
          vec4 foliageTexel=texture2D(map,vMapUv);
          // Mipmaps average thin leaflets into transparency; raise alpha with the mip level so far crowns stay full.
          vec2 foliageTexels=vMapUv*1024.;
          foliageTexel.a*=1.+.34*
              max(0.,.5*
              log2(max(dot(dFdx(foliageTexels),dFdx(foliageTexels)),
              dot(dFdy(foliageTexels),dFdy(foliageTexels)))));
          float foliageLuma=dot(foliageTexel.rgb,vec3(.2126,.7152,.0722));
          diffuseColor.rgb*=mix(foliageTexel.rgb*1.35,vec3(foliageLuma*foliageGain),foliageRecolor);
          diffuseColor.a*=foliageTexel.a;
          #endif`
      )
      // Crown normals already face out of the canopy: back faces must not flip them inward.
      .replace(
        '#include <normal_fragment_begin>',
        THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', '')
      )
      .replace(
        '#include <opaque_fragment>',
        'outgoingLight+=diffuseColor.rgb*foliageTranslucency*foliageDaylight;\n#include <opaque_fragment>'
      );
  };
  material.customProgramCacheKey = () => 'garden-foliage';
  return material;
}

// Bark coordinates in metres (around, along) so every limb tiles at the same density.
export function barkUV(THREE, geometry, { tile = 0.9 } = {}) {
  const uv = geometry.attributes.uv,
    position = geometry.attributes.position,
    p = geometry.parameters || {};
  if (!uv || !p.path || !p.tubularSegments || !p.radialSegments) return geometry;
  const length = p.path.getLength(),
    sides = p.radialSegments,
    a = new THREE.Vector3(),
    b = new THREE.Vector3();
  for (let j = 0; j <= p.tubularSegments; j++) {
    let around = 0;
    for (let k = 0; k <= sides; k++) {
      const i = j * (sides + 1) + k;
      if (k) {
        a.fromBufferAttribute(position, i);
        b.fromBufferAttribute(position, i - 1);
        around += a.distanceTo(b);
      }
      uv.setXY(i, around / tile, ((j / p.tubularSegments) * length) / tile);
    }
  }
  uv.needsUpdate = true;
  return geometry;
}
