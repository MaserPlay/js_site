import { engineeringKinds, buildEngineeringDisplay } from './engineering-displays.mjs';
import { paintContext } from './paint-canvas.mjs';
// Opt-in local exhibit studies. No selection or camera setting is persisted.
export const displayOptions = Object.freeze({
  folio: 'A · Folio',
  signal: 'B · Signal',
  cove: 'C · Cove',
  workbench: 'D · Workbench',
  relay: 'E · Relay'
});
export function resolveDisplayPrototype(data, search) {
  const query = new URLSearchParams(search),
    value = query.get('display');
  // Only the snapshot preview supplies this field. A production URL alone cannot enable it.
  return Object.hasOwn(data, 'reviewPose') &&
    query.get('audit') === '1' &&
    Object.hasOwn(displayOptions, value)
    ? value
    : null;
}

// The fixed comparison pose belongs to the explicit QuickVox front route.
export function useDisplayDetailPose(kind, search, route) {
  const query = new URLSearchParams(search);
  return (
    Object.hasOwn(displayOptions, kind) &&
    query.get('audit') === '1' &&
    query.get('display-view') === 'detail' &&
    route?.kind === 'project' &&
    route.index === 0 &&
    route.zone === 'main'
  );
}
export function mountDisplayComparison(kind, locale = 'en') {
  if (!kind) return;
  const ru = locale === 'ru',
    panel = document.createElement('details');
  panel.id = 'display-comparison';
  panel.setAttribute('aria-label', ru ? 'Локальное сравнение экспонатов' : 'Local display comparison');
  const title = document.createElement('summary');
  title.textContent = (ru ? 'ПРОТОТИП ' : 'PROTOTYPE ') + displayOptions[kind];
  panel.append(title);
  const links = document.createElement('nav');
  links.setAttribute('aria-label', ru ? 'Варианты экспоната' : 'Display options');
  for (const [value, label] of [
    ...Object.entries(displayOptions),
    ['', ru ? 'Обычный сад' : 'Normal garden']
  ]) {
    const link = document.createElement('a'),
      url = new URL(location.href);
    value ? url.searchParams.set('display', value) : url.searchParams.delete('display');
    link.href = url.pathname + url.search + url.hash;
    link.textContent = label;
    if (value === kind) link.setAttribute('aria-current', 'page');
    link.addEventListener('click', () => {
      const live = new URL(location.href);
      value ? live.searchParams.set('display', value) : live.searchParams.delete('display');
      if (!value) live.searchParams.delete('display-view');
      link.href = live.pathname + live.search + live.hash;
    });
    links.append(link);
  }
  panel.append(links);
  const views = document.createElement('nav');
  views.setAttribute('aria-label', ru ? 'Ракурс сравнения' : 'Comparison view');
  for (const [view, label] of [
    ['detail', ru ? 'Объект ¾' : 'Object ¾'],
    ['front', ru ? 'Спереди' : 'Front'],
    ['overview', ru ? 'Обзор' : 'Overview']
  ]) {
    const a = document.createElement('a'),
      url = new URL(location.href);
    url.searchParams.delete('capture');
    view === 'detail'
      ? url.searchParams.set('display-view', 'detail')
      : url.searchParams.delete('display-view');
    url.hash = view === 'overview' ? '' : 'project=quickvox';
    a.href = url.pathname + url.search + url.hash;
    a.textContent = label;
    a.addEventListener('click', event => {
      const live = new URL(location.href);
      live.searchParams.delete('capture');
      view === 'detail'
        ? live.searchParams.set('display-view', 'detail')
        : live.searchParams.delete('display-view');
      live.hash = view === 'overview' ? '' : 'project=quickvox';
      a.href = live.pathname + live.search + live.hash;
      if (view === 'detail' && live.pathname === location.pathname && live.search === location.search) {
        event.preventDefault();
        location.assign(a.href);
        location.reload();
      }
    });
    views.append(a);
  }
  panel.append(views);
  const note = document.createElement('small');
  note.textContent = ru
    ? 'Локальное сравнение · выбор не сохранён'
    : 'Local comparison · selection is not saved';
  panel.append(note);
  const style = document.createElement('style');
  style.textContent = `
    #display-comparison {
      position:fixed;
      z-index:24;
      top:154px;
      right:28px;
      background:#222636ee;
      color:#eef0f5;
      border:1px solid #b7c2d34a;
      border-radius:10px;
      padding:5px 10px;
      font:11px/1.35 system-ui;
      box-shadow:0 4px 16px #10152530;
      text-align:center
    }
    #display-comparison summary {
      font-size:10px;
      letter-spacing:.06em;
      color:#c7d8db;
      cursor:pointer;
      padding:9px 5px;
      min-height:32px;
      box-sizing:border-box
    }
    #display-comparison nav {
      display:flex;
      flex-wrap:wrap;
      gap:6px;
      margin:6px 0
    }
    #display-comparison a {
      padding:10px;
      border:1px solid #7b8a9b55;
      border-radius:5px;
      color:inherit;
      text-decoration:none;
      white-space:nowrap
    }
    #display-comparison a[aria-current] {
      background:#d8e6e5;
      color:#14242a;
      border-color:#d8e6e5
    }
    #display-comparison a:focus-visible,#display-comparison summary:focus-visible {
      outline:3px solid #ffcf82;
      outline-offset:2px
    }
    #display-comparison small {
      color:#aab7c6;
      font-size:10px
    }
    body:has(#preferences:not([hidden])) #display-comparison,body:has(#portal-dialog[open]) #display-comparison,body:has(#media-viewer:not([hidden])) #display-comparison {
      display:none
    }
    @media(max-width:740px) {
      #display-comparison {
        top:125px;
        left:14px;
        right:auto;
        padding:3px 7px;
        max-width:calc(100vw - 28px);
        width:max-content
      }
      #display-comparison nav {
        margin:4px 0 0;
        gap:4px
      }
      #display-comparison a {
        padding:10px 8px;
        font-size:10px
      }
      #display-comparison small {
        display:none
      }
      body:has(#garden-app.is-overview) #display-comparison {
        top:auto;
        bottom:128px
      }
    }
  `;
  document.head.append(style);
  document.body.append(panel);
}

// One shared atlas holds actual project identity/date captions for every stand.
export function createDisplayCatalog(THREE, projects, resources) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 128 * projects.length;
  const c = paintContext(canvas);
  c.fillStyle = '#17232b';
  c.fillRect(0, 0, canvas.width, canvas.height);
  projects.forEach((p, i) => {
    const y = i * 128;
    c.fillStyle = p.accent;
    c.fillRect(0, y, 7, 128);
    if (p.iconCanvas) c.drawImage(p.iconCanvas, 28, y + 25, 68, 68);
    c.fillStyle = '#f0f1ec';
    c.font = '500 36px system-ui';
    c.fillText(p.name, 120, y + 51, 770);
    c.fillStyle = '#b5c4c9';
    c.font = '19px ui-monospace, monospace';
    c.fillText(p.id + '  /  ' + (p.updatedLabel || p.createdLabel || ''), 120, y + 88, 775);
    c.fillStyle = p.accent;
    c.font = '22px ui-monospace, monospace';
    c.fillText(String(i + 1).padStart(2, '0'), 940, y + 46);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  resources.add(texture);
  const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  resources.add(material);
  return { material, count: projects.length };
}

// All coordinates are local to the inherited project deck; the hero screen is identical in all studies.
export function buildDisplayStructure(
  THREE,
  kind,
  { group, palette, mesh, blockers, practical, catalog, index, project }
) {
  if (engineeringKinds.has(kind)) return buildEngineeringDisplay(THREE, kind, arguments[2]);
  const parts = [],
    supports = [];
  const box = (name, w, h, d, x, y, z, material = 'metal', solid = true) => {
    const o = mesh(new THREE.BoxGeometry(w, h, d), palette[material], group);
    o.name = name;
    o.position.set(x, y, z);
    parts.push(o);
    if (solid) blockers.push(o);
    return o;
  };
  const beam = (name, a, b, width = 0.12, depth = 0.14, material = 'metal') => {
    const start = new THREE.Vector3(...a),
      end = new THREE.Vector3(...b),
      delta = end.clone().sub(start);
    const o = box(
      name,
      width,
      delta.length(),
      depth,
      ...start.clone().add(end).multiplyScalar(0.5).toArray(),
      material
    );
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    supports.push(o);
    return o;
  };
  const colorBox = (name, w, h, d, x, y, z, color) => {
    const g = new THREE.BoxGeometry(w, h, d),
      c = new THREE.Color(color);
    g.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(
        Array.from({ length: g.attributes.position.count }, () => c.toArray()).flat(),
        3
      )
    );
    const o = mesh(g, palette.brand, group);
    o.name = name;
    o.position.set(x, y, z);
    parts.push(o);
    return o;
  };
  const casing = box('display-enclosure', 5.4, 3.23, 0.25, 0, 2.75, 1.655, 'dark');
  // Narrow edge joints, a bottom cable connector and fasteners communicate a buildable object.
  for (const x of [-2.66, 2.66]) box('screen-side-edge', 0.055, 3.19, 0.055, x, 2.75, 1.493, 'metal', false);
  for (const y of [1.17, 4.33]) box('screen-edge', 5.35, 0.055, 0.055, 0, y, 1.493, 'metal', false);
  for (const x of [-2.52, 2.52])
    for (const y of [1.22, 4.27]) {
      const bolt = mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.018, 8), palette.stone, group);
      bolt.name = 'screen-fastener';
      bolt.rotation.x = Math.PI / 2;
      bolt.position.set(x, y, 1.479);
      parts.push(bolt);
    }
  colorBox('project-index', 0.55, 0.035, 0.04, 2.15, 1.18, 1.451, project.accent);
  if (kind === 'folio') {
    // Three offset pages rise from a terraced stone footing. Nothing spans overhead.
    box('folio-footing', 6.16, 0.2, 1.98, 0, 0.58, 1.34, 'stone');
    box('folio-shadow-joint', 5.9, 0.06, 1.8, 0, 0.71, 1.34, 'dark');
    box('folio-upper-course', 5.68, 0.2, 1.59, 0, 0.84, 1.36, 'stone');
    for (const [x, w, top, z] of [
      [2.83, 0.55, 4.98, 1.85],
      [1.75, 1.48, 4.7, 2.11],
      [-1.64, 1.72, 4.51, 2.2],
      [-2.83, 0.36, 4.04, 1.87]
    ]) {
      const fin = box('folio-vertical-fin', w, top - 0.94, 0.32, x, (top + 0.94) / 2, z, 'stone');
      supports.push(fin);
    }
    // Support visible below and behind the media plane, tied into both vertical fins.
    box('folio-rear-spine', 5.4, 0.22, 0.36, 0, 2.72, 1.89, 'metal');
    for (const x of [-2.34, 2.34]) {
      const leg = box('folio-screen-leg', 0.23, 0.66, 0.32, x, 1.2, 1.69, 'metal');
      supports.push(leg);
    }
    for (const x of [-2.83, 2.83]) {
      box('folio-light-channel', 0.065, 2.16, 0.12, x, 2.07, 1.7, 'dark', false);
      box('folio-diffuser', 0.024, 2.05, 0.025, x, 2.07, 1.636, 'lampBlue', false);
    }
    // Three inset index joints on the plinth echo file tabs without inventing code or content.
    for (const x of [-1.78, 0, 1.78])
      box('folio-plinth-joint', 0.018, 0.16, 0.014, x, 0.82, 0.556, 'dark', false);
    for (const [x, y] of [
      [2.83, 4.72],
      [1.75, 4.5],
      [-1.64, 4.34]
    ])
      colorBox('folio-index-tab', 0.24, 0.055, 0.032, x, y, x === 2.83 ? 1.67 : 1.93, project.accent);
  } else if (kind === 'signal') {
    // Independent runners, curved side cheeks and rear diagonal braces hold the screen.
    for (const s of [-1, 1]) {
      const x = s * 2.8;
      box('signal-runner', 0.72, 0.21, 1.94, x, 0.585, 1.27, 'stone');
      box('signal-runner-insert', 0.49, 0.07, 1.61, x, 0.725, 1.3, 'metal');
      const profile = [
        [2.61, 0.76],
        [3.03, 0.76],
        [3.12, 1.18],
        [3.12, 2.4],
        [2.98, 3.65],
        [2.84, 4.41],
        [2.65, 4.41],
        [2.76, 3.49],
        [2.84, 2.3],
        [2.7, 1.2]
      ];
      const shape = new THREE.Shape();
      profile.forEach(([px, y], n) => (n ? shape.lineTo(px * s, y) : shape.moveTo(px * s, y)));
      shape.closePath();
      const g = new THREE.ExtrudeGeometry(shape, {
        depth: 0.26,
        bevelEnabled: true,
        bevelThickness: 0.025,
        bevelSize: 0.025,
        bevelSegments: 2,
        steps: 1
      });
      const cheek = mesh(g, palette.metal, group);
      cheek.name = 'signal-cheek';
      cheek.position.z = 1.56;
      parts.push(cheek);
      blockers.push(cheek);
      supports.push(cheek);
      beam('signal-rear-brace', [x, 0.77, 2.17], [x, 2.73, 1.81], 0.14, 0.14);
      const pivot = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.37, 16), palette.stone, group);
      pivot.name = 'signal-pivot';
      pivot.rotation.x = Math.PI / 2;
      pivot.position.set(s * 2.79, 2.75, 1.56);
      parts.push(pivot);
      const hub = mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.015, 12), palette.dark, group);
      hub.rotation.x = Math.PI / 2;
      hub.position.set(s * 2.79, 2.75, 1.365);
      parts.push(hub);
      box('signal-axle', 0.32, 0.14, 0.18, s * 2.63, 2.75, 1.64, 'metal');
      box(
        'signal-inset-diffuser',
        0.035,
        1.13,
        0.03,
        s * 3.135,
        1.67,
        1.53,
        s < 0 ? 'lampBlue' : 'lampViolet',
        false
      );
      colorBox('signal-runner-index', 0.3, 0.02, 0.13, x, 0.766, 0.49, project.accent);
    }
    box('signal-cross-member', 5.56, 0.16, 0.22, 0, 0.94, 1.78, 'metal');
    box('signal-cable-spine', 0.11, 0.96, 0.1, 0, 1.28, 1.86, 'dark');
    for (const x of [-1.98, 1.98]) beam('signal-caption-mount', [x, 0.94, 1.78], [x, 0.99, 0.43], 0.09, 0.09);
  } else if (kind === 'cove') {
    // A rear-rooted branching carrier leaves the screen sides and the approach open.
    // Its two solid swept stone wings describe a small court, not a full-width plinth.
    const foot = mesh(new THREE.CylinderGeometry(0.65, 0.83, 0.22, 24), palette.stone, group);
    foot.name = 'cove-root';
    foot.scale.z = 0.62;
    foot.position.set(0, 0.59, 1.84);
    parts.push(foot);
    blockers.push(foot);
    box('cove-root-shoe', 0.64, 0.16, 0.62, 0, 0.76, 1.88, 'metal');
    beam('cove-trunk', [0, 0.77, 1.88], [0, 2.2, 2.12], 0.32, 0.28);
    for (const side of [-1, 1]) {
      beam('cove-upper-branch', [0, 1.67, 2.05], [side * 2.18, 3.87, 1.98], 0.19, 0.19);
      beam('cove-lower-branch', [0, 1.07, 1.94], [side * 2.17, 1.48, 1.94], 0.15, 0.16);
      for (const y of [1.48, 3.87]) box('cove-screen-cleat', 0.46, 0.22, 0.23, side * 2.17, y, 1.85, 'metal');
      // Closed curved shell, flat on the inherited .48m deck. No hidden floating ends.
      const path = new THREE.CatmullRomCurve3([
          new THREE.Vector3(side * 2.98, 0, -0.26),
          new THREE.Vector3(side * 3.03, 0, 0.57),
          new THREE.Vector3(side * 2.95, 0, 1.66),
          new THREE.Vector3(side * 1.52, 0, 2.15)
        ]),
        pos = [],
        indices = [],
        steps = 28;
      for (let j = 0; j <= steps; j++) {
        const t = j / steps,
          p = path.getPoint(t),
          d = path.getTangent(t),
          nx = -d.z,
          nz = d.x;
        const top = 0.9 + 0.63 * Math.sin(t * Math.PI * 0.78),
          half = 0.115;
        for (const [offset, y] of [
          [-half, 0.475],
          [half, 0.475],
          [-half, top],
          [half, top]
        ])
          pos.push(p.x + nx * offset, y, p.z + nz * offset);
        if (j < steps) {
          const a = j * 4,
            b = a + 4;
          indices.push(
            a,
            b,
            a + 1,
            a + 1,
            b,
            b + 1,
            a + 2,
            a + 3,
            b + 2,
            a + 3,
            b + 3,
            b + 2,
            a,
            a + 2,
            b,
            a + 2,
            b + 2,
            b,
            a + 1,
            b + 1,
            a + 3,
            a + 3,
            b + 1,
            b + 3
          );
        }
      }
      indices.push(0, 1, 2, 1, 3, 2);
      const end = steps * 4;
      indices.push(end, end + 2, end + 1, end + 1, end + 2, end + 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute(
        'uv',
        new THREE.Float32BufferAttribute(
          pos.flatMap((_, i) => (i % 3 === 0 ? [pos[i], pos[i + 2]] : [])),
          2
        )
      );
      geo.setIndex(indices);
      geo.computeVertexNormals();
      const wing = mesh(geo, palette.stone, group);
      wing.name = 'cove-stone-wing';
      parts.push(wing);
      blockers.push(wing);
      // Recessed warm/Neon light stays in the same field location as the other studies.
      box('cove-light-stem', 0.075, 1.13, 0.09, side * 2.83, 1.72, 1.6, 'metal');
      box('cove-light-socket', 0.2, 0.11, 0.22, side * 2.83, 1.22, 1.6, 'metal');
      box(
        'cove-light-lens',
        0.065,
        0.4,
        0.065,
        side * 2.83,
        2.07,
        1.53,
        side < 0 ? 'lampBlue' : 'lampViolet',
        false
      );
      box('cove-light-cap', 0.16, 0.055, 0.16, side * 2.83, 2.3, 1.6, 'metal', false);
      beam('cove-caption-arm', [0, 0.79, 1.8], [side * 1.92, 0.91, 0.43], 0.085, 0.085);
    }
    // A cable channel runs on the carrier itself, with one real project accent at its root.
    beam('cove-cable-channel', [0, 0.78, 1.72], [0, 2.14, 1.96], 0.045, 0.035, 'dark');
    colorBox('cove-root-index', 0.27, 0.025, 0.13, 0, 0.847, 1.7, project.accent);
  }
  // A separate caption bar identifies the work; the media stays visually dominant.
  box('caption-housing', 5.4, 0.67, 0.15, 0, 0.91, 0.395, 'dark');
  const captionGeometry = new THREE.PlaneGeometry(5.2, 0.63),
    uv = captionGeometry.attributes.uv;
  for (let v = 0; v < uv.count; v++) uv.setY(v, 1 - (index + 1 - uv.getY(v)) / catalog.count);
  const caption = mesh(captionGeometry, catalog.material, group);
  caption.name = 'project-caption';
  caption.position.set(0, 0.91, 0.305);
  caption.rotation.y = Math.PI;
  parts.push(caption);
  // The ring overview sees the rear of several exhibits: retain their real identity there too.
  const rearZ = kind === 'folio' ? 2.28 : kind === 'cove' ? 2.22 : 1.785,
    rearDepth = kind === 'folio' ? 0.2 : kind === 'cove' ? 0.25 : 0.04;
  box('rear-caption-housing', 4.9, 0.73, rearDepth, 0, 2.7, rearZ, 'dark');
  const rearGeometry = captionGeometry.clone();
  rearGeometry.scale(4.68 / 5.2, 0.59 / 0.63, 1);
  const rearCaption = mesh(rearGeometry, catalog.material, group);
  rearCaption.name = 'rear-project-caption';
  rearCaption.position.set(0, 2.7, rearZ + rearDepth / 2 + 0.008);
  parts.push(rearCaption);
  // All studies use the same two attached low lights and field inputs for a fair lighting comparison.
  for (const [x, channel] of [
    [-2.83, 0],
    [2.83, 1]
  ])
    practical({ x, y: 2.07, z: 1.6 }, group, 8, 0.9, channel, 0.48, 64);
  group.updateMatrixWorld(true);
  const bounds = new THREE.Box3();
  for (const o of parts) bounds.union(new THREE.Box3().setFromObject(o));
  return {
    kind,
    parts: parts.length,
    supports: supports.length,
    roof: false,
    hero: { size: [5.18, 3.02], position: [0, 2.75, 1.48] },
    bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
    screenBack: casing
  };
}
