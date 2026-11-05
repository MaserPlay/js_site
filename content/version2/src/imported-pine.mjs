// Local tree trials (Mundo CC0; LOLIPOP CC BY 4.0). The normal garden neither downloads nor enables these assets.
import * as THREE from './vendor/three.module.js';
import { gardenFile } from './garden-paths.mjs';
export function resolveTreeTrial(data, search) {
  const q = new URLSearchParams(search),
    value = q.get('trees');
  return Object.hasOwn(data, 'reviewPose') &&
    q.get('audit') === '1' &&
    ['original', 'mundo', 'mundo-full', 'lolipop'].includes(value)
    ? value
    : null;
}
export async function loadMundoPine() {
  const started = performance.now(),
    root = gardenFile('assets/mundo-pine/'),
    textures = [];
  let geometry;
  try {
    const response = await fetch(root + 'pine.geometry.json');
    if (!response.ok) throw new Error('Mundo geometry HTTP ' + response.status);
    geometry = new THREE.BufferGeometryLoader().parse(await response.json());
    // Wait for every load before cleanup on failure (no late texture leak).
    const settled = await Promise.allSettled(
      ['diffuse', 'winter', 'normal'].map(async name => {
        const texture = await new THREE.TextureLoader().loadAsync(root + name + '.png');
        textures.push(texture);
        return texture;
      })
    );
    const failed = settled.find(r => r.status === 'rejected');
    if (failed) throw failed.reason;
    const [diffuse, winter, normal] = settled.map(r => r.value);
    diffuse.colorSpace = winter.colorSpace = THREE.SRGBColorSpace;
    for (const texture of textures) {
      texture.anisotropy = 4;
      texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    }
    const material = new THREE.MeshStandardMaterial({
      map: diffuse,
      normalMap: normal,
      normalScale: new THREE.Vector2(0.45, 0.45),
      color: 0xffffff,
      roughness: 0.94,
      metalness: 0,
      side: THREE.DoubleSide,
      alphaTest: 0.38,
      alphaToCoverage: true,
      transparent: false,
      depthWrite: true
    });
    material.name = 'Yughues Mundo pine CC0';
    // The legacy albedo is heavily pre-darkened. Lift its linear reflectance so
    // existing warm fixtures reveal needles without adding emissive light.
    material.color.setRGB(2.7, 3.0, 2.3);
    return { geometry, material, textures, diffuse, winter, loadMs: performance.now() - started };
  } catch (error) {
    geometry?.dispose();
    textures.forEach(t => t.dispose());
    throw error;
  }
}
export function createMundoPine(asset, resources) {
  const object = new THREE.Mesh(asset.geometry, asset.material);
  object.name = 'Mundo central pine';
  // Normalize height independently of spread to retain the original fir envelope.
  object.position.set(-0.8, 0.2, -2.15);
  object.scale.set(6.45, 11.05, 6.45);
  object.rotation.y = 0.24;
  object.userData.dynamic = true;
  [asset.geometry, asset.material, ...asset.textures].forEach(r => resources.add(r));
  object.updateMatrixWorld(true);
  return {
    object,
    setSeason: season => {
      asset.material.map = season === 'winter' ? asset.winter : asset.diffuse;
      asset.material.color.setRGB(...(season === 'winter' ? [1.12, 1.12, 1.12] : [2.7, 3.0, 2.3]));
    },
    audit: () => ({
      variant: 'mundo',
      author: 'Yughues',
      license: 'CC0',
      triangles: asset.geometry.index.count / 3,
      vertices: asset.geometry.attributes.position.count,
      draws: 1,
      alphaTest: asset.material.alphaTest,
      doubleSided: asset.material.side === THREE.DoubleSide,
      depthWrite: asset.material.depthWrite,
      alphaToCoverage: asset.material.alphaToCoverage,
      height: 11.05,
      root: object.position.toArray(),
      bounds: new THREE.Box3().setFromObject(object),
      textures: asset.textures.length,
      textureSize: 1024,
      textureRgbaBytes: 3 * 1024 * 1024 * 4,
      textureRgbaWithMipsBytes: (3 * 1024 * 1024 * 4 * 4) / 3,
      loadMs: asset.loadMs,
      winter: asset.material.map === asset.winter,
      snow: 'artist diffuse_half, same alpha silhouette; no overlay geometry'
    })
  };
}
export function treeReviewPose(kind, search, narrow, route = { kind: 'overview' }) {
  const view = new URLSearchParams(search).get('tree-view');
  if (!kind || route.kind !== 'overview') return null;
  if (view === 'small')
    return {
      kind: 'local small fir comparison',
      position: [8, 3.2, 32],
      look: [3.94, 1.65, 27.45],
      progress: 0
    };
  if (view === 'branches')
    return {
      kind: 'local pine branch inspection',
      position: [4, 4.7, 1],
      look: [-0.8, 3.4, -2.15],
      progress: 0
    };
  if (view === 'left')
    return {
      kind: 'local pine left inspection',
      position: narrow ? [-24, 6.3, 12] : [-17, 6.3, 7],
      look: [-0.8, 5.4, -2.15],
      progress: 0
    };
  if (view === 'right')
    return {
      kind: 'local pine right inspection',
      position: narrow ? [24, 6.3, -16] : [16, 6.3, -10],
      look: [-0.8, 5.4, -2.15],
      progress: 0
    };
  if (view === 'back')
    return {
      kind: 'local pine reverse inspection',
      position: narrow ? [-11, 6.3, -24] : [-10, 6.3, -15],
      look: [-0.8, 5.4, -2.15],
      progress: 0
    };
  return view === 'detail'
    ? {
        kind: 'local central tree comparison',
        position: narrow ? [9, 6.3, 21] : [9, 6.3, 12],
        look: [-0.8, 5.4, -2.15],
        progress: 0
      }
    : null;
}
export function mountTreeComparison(kind, locale = 'en', error = '') {
  if (!kind) return;
  const ru = locale === 'ru',
    panel = document.createElement('details');
  panel.id = 'tree-comparison';
  const summary = document.createElement('summary');
  summary.textContent =
    (ru ? 'ДЕРЕВО · ' : 'TREE · ') +
    (kind === 'lolipop'
      ? 'LOLIPOP'
      : kind === 'mundo-full'
        ? 'Mundo CC0 +'
        : kind === 'mundo'
          ? 'Mundo CC0'
          : ru
            ? 'Исходное'
            : 'Original');
  panel.append(summary);
  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', ru ? 'Сравнение деревьев' : 'Tree comparison');
  const choices = [
    ['trees', 'original', ru ? 'Исходное' : 'Original'],
    ['trees', 'mundo', ru ? 'Mundo · до' : 'Mundo · before'],
    ['trees', 'mundo-full', ru ? 'Mundo · пышнее' : 'Mundo · fuller'],
    ['trees', 'lolipop', ru ? 'Пышная LOLIPOP' : 'Lush LOLIPOP'],
    ['tree-view', 'detail', ru ? 'Близко' : 'Detail'],
    ['tree-view', '', ru ? 'Общий вид' : 'Overview'],
    ['tree-view', 'branches', ru ? 'Ветви' : 'Branches'],
    ['tree-view', 'small', ru ? 'Малые ели' : 'Small firs'],
    ['tree-view', 'back', ru ? 'Сзади' : 'Back'],
    ['tree-view', 'left', ru ? 'Слева' : 'Left'],
    ['tree-view', 'right', ru ? 'Справа' : 'Right']
  ];
  for (const [key, value, label] of choices) {
    const a = document.createElement('a');
    a.textContent = label;
    const href = () => {
      const url = new URL(location.href);
      value ? url.searchParams.set(key, value) : url.searchParams.delete(key);
      if (key === 'tree-view') {
        url.hash = '';
        url.searchParams.delete('capture');
        url.searchParams.delete('display-view');
      }
      return url.pathname + url.search + url.hash;
    };
    a.href = href();
    a.addEventListener('click', () => (a.href = href()));
    if (key === 'trees' && value === kind) a.setAttribute('aria-current', 'page');
    nav.append(a);
  }
  panel.append(nav);
  const note = document.createElement('small');
  if (error)
    note.textContent = ru
      ? 'Модель не загрузилась; показано исходное дерево.'
      : 'Model unavailable; original tree shown.';
  else
    note.textContent = ru
      ? 'Проба одного центрального дерева · Yughues, CC0'
      : 'One central tree trial · Yughues, CC0';
  if (kind === 'lolipop' && !error)
    note.textContent = ru
      ? 'LOLIPOP · CC BY 4.0 · 1 большая + 6 малых елей. Адаптация: LOD, текстуры, снег и декор.'
      : 'LOLIPOP · CC BY 4.0 · 1 central + 6 small firs. Adapted LODs, textures, snow and ornaments.';
  if (kind === 'mundo-full' && !error)
    note.textContent = ru
      ? 'Yughues · Mundo CC0. Пышнее крона; собственные ветви и текстуры Mundo, зимний декор.'
      : 'Yughues · Mundo CC0. Fuller crown using Mundo branches and maps, with winter decorations.';
  panel.append(note);
  if (kind === 'lolipop') {
    const credits = document.createElement('details');
    credits.className = 'tree-credits';
    const heading = document.createElement('summary');
    heading.textContent = ru ? 'Авторство материалов' : 'Material credits';
    credits.append(heading);
    const description = document.createElement('p');
    description.textContent = ru
      ? 'Realistic fir trees pack — LOLIPOP (@lolipop_1707). Изменены LOD и текстуры, выправлен ствол; добавлены снег и украшения.'
      : 'Realistic fir trees pack — LOLIPOP (@lolipop_1707). Adapted LODs and textures, straightened leader; added snow and decorations.';
    credits.append(description);
    for (const [label, url] of [
      ['LOLIPOP', 'https://sketchfab.com/lolipop_1707'],
      [
        ru ? 'Исходная модель · Sketchfab' : 'Source model · Sketchfab',
        'https://sketchfab.com/3d-models/realistic-fir-trees-pack-lods-gameready-f58e8b6d733e4b0586e5b7db847b89e7'
      ],
      ['CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/']
    ]) {
      const a = document.createElement('a');
      a.textContent = label;
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
      credits.append(a);
    }
    panel.append(credits);
  }
  const style = document.createElement('style');
  style.textContent = `
    #tree-comparison {
      position:fixed;
      z-index:24;
      right:20px;
      bottom:78px;
      max-width:280px;
      padding:3px 9px;
      border:1px solid #b7c2d355;
      border-radius:10px;
      background:#222636ee;
      color:#eef0f5;
      font:11px/1.4 system-ui
    }
    #tree-comparison summary {
      cursor:pointer;
      min-height:44px;
      display:flex;
      align-items:center;
      letter-spacing:.05em
    }
    #tree-comparison[open] {
      max-height:calc(100dvh - 240px);
      overflow:auto
    }
    #tree-comparison .tree-credits {
      margin-top:5px;
      border-top:1px solid #7b8a9b55
    }
    #tree-comparison .tree-credits summary {
      letter-spacing:0
    }
    #tree-comparison .tree-credits p {
      margin:0 0 6px;
      color:#bbc7cd
    }
    #tree-comparison nav {
      display:flex;
      flex-wrap:wrap;
      gap:5px
    }
    #tree-comparison a {
      display:flex;
      align-items:center;
      justify-content:center;
      min-height:44px;
      padding:0 10px;
      color:inherit;
      border:1px solid #7b8a9b66;
      border-radius:5px;
      text-decoration:none
    }
    #tree-comparison a[aria-current] {
      background:#d8e6e5;
      color:#14242a
    }
    #tree-comparison small {
      display:block;
      margin-top:7px;
      color:#bbc7cd
    }
    #tree-comparison :focus-visible {
      outline:3px solid #ffcf82;
      outline-offset:2px
    }
    body:has(#preferences:not([hidden])) #tree-comparison,body:has(#portal-dialog[open]) #tree-comparison,body:has(#media-viewer:not([hidden])) #tree-comparison {
      display:none
    }
    @media(max-width:740px) {
      #tree-comparison {
        right:12px;
        bottom:128px;
        max-width:calc(100vw - 42px)
      }
      body:has(#garden-app.is-journey) #tree-comparison {
        bottom:auto;
        top:130px
      }
    }
  `;
  // Keep the local tree disclosure clear of the existing display disclosure on phones.
  style.textContent +=
    '@media(max-width:740px){body:has(#display-comparison) #tree-comparison{bottom:176px}body:has(#garden-app.is-journey):has(#display-comparison) #tree-comparison{top:176px;bottom:auto}body:has(#display-comparison[open]) #tree-comparison{display:none}}';
  document.head.append(style);
  document.body.append(panel);
}
