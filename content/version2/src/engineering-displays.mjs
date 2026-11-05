// Local comparison only. Real project content, physical joints and existing route actions.
import { paintContext } from './paint-canvas.mjs';
export const engineeringKinds = new Set(['workbench', 'relay']);
export const engineeringHero = kind =>
  kind === 'workbench'
    ? { size: [4.8, 2.8], position: [0, 3.45, 1.48] }
    : { size: [3.78, 2.2], position: [0, 3.1, 1.48] };

export function createEngineeringCatalog(THREE, projects, labels, resources) {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 256 * projects.length;
  const c = paintContext(canvas);
  c.scale(0.5, 0.5);
  const titles = [labels.zoneGallery, labels.zoneDescription, labels.zoneComments];
  function wrap(text, x, y, width, limit) {
    let line = '',
      n = 0;
    for (const word of String(text || '').split(/\s+/)) {
      if (c.measureText(line + ' ' + word).width > width && line) {
        c.fillText(line, x, y + n * 39);
        line = '';
        if (++n === limit) return;
      }
      line += (line ? ' ' : '') + word;
    }
    if (n < limit) c.fillText(line, x, y + n * 39);
  }
  projects.forEach((p, i) =>
    titles.forEach((title, j) => {
      const x = j * 512,
        y = i * 512;
      c.fillStyle = '#18262d';
      c.fillRect(x, y, 512, 512);
      c.fillStyle = p.accent;
      c.fillRect(x + 30, y + 30, 44, 5);
      c.font = '500 35px system-ui';
      c.fillStyle = '#f0eee7';
      c.fillText(title, x + 30, y + 95, 452);
      c.strokeStyle = '#48606a';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(x + 30, y + 123);
      c.lineTo(x + 482, y + 123);
      c.stroke();
      c.fillStyle = '#c4d2d5';
      c.font = '29px system-ui';
      if (j === 1) wrap(p.description, x + 30, y + 181, 448, 7);
      else if (j === 0) {
        if (p.iconCanvas) c.drawImage(p.iconCanvas, x + 30, y + 155, 85, 85);
        wrap(p.name, x + 30, y + 302, 448, 3);
      } else {
        c.lineWidth = 4;
        c.strokeStyle = '#a1b6bd';
        c.beginPath();
        c.roundRect(x + 34, y + 159, 184, 102, 16);
        c.moveTo(x + 68, y + 261);
        c.lineTo(x + 68, y + 286);
        c.lineTo(x + 99, y + 261);
        c.stroke();
        c.fillStyle = '#c4d2d5';
        wrap(p.name, x + 30, y + 353, 448, 2);
      }
      c.fillStyle = p.accent;
      c.font = '24px system-ui';
      c.fillText(title, x + 30, y + 471, 452);
    })
  );
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  resources.add(texture);
  const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  resources.add(material);
  return { material, count: projects.length };
}

export function buildEngineeringDisplay(
  THREE,
  kind,
  { group, palette, mesh, blockers, practical, catalog, index, project, engineeringCatalog }
) {
  const parts = [],
    interactions = [],
    hero = engineeringHero(kind);
  function box(name, w, h, d, x, y, z, mat = 'metal', parent = group, solid = true) {
    let g;
    if (/foot$|worktop$|housing$|enclosure$/.test(name)) {
      const r = Math.min(0.038, h * 0.16, d * 0.16),
        s = new THREE.Shape();
      s.moveTo(-w / 2 + r, -h / 2 + r);
      s.lineTo(w / 2 - r, -h / 2 + r);
      s.lineTo(w / 2 - r, h / 2 - r);
      s.lineTo(-w / 2 + r, h / 2 - r);
      s.closePath();
      g = new THREE.ExtrudeGeometry(s, {
        depth: d - 2 * r,
        bevelEnabled: true,
        bevelThickness: r,
        bevelSize: r,
        bevelSegments: 2,
        steps: 1
      });
      g.translate(0, 0, -d / 2 + r);
    } else g = new THREE.BoxGeometry(w, h, d);
    const o = mesh(g, palette[mat], parent);
    o.name = name;
    o.position.set(x, y, z);
    parts.push(o);
    if (solid) blockers.push(o);
    return o;
  }
  function beam(name, a, b, w = 0.13, d = 0.16, mat = 'metal') {
    const av = new THREE.Vector3(...a),
      bv = new THREE.Vector3(...b),
      delta = bv.clone().sub(av);
    const o = box(name, w, delta.length(), d, ...av.add(bv).multiplyScalar(0.5).toArray(), mat);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    return o;
  }
  function round(name, r, h, x, y, z, mat = 'metal', axis = 'y') {
    const o = mesh(new THREE.CylinderGeometry(r, r, h, 20), palette[mat], group);
    o.name = name;
    o.position.set(x, y, z);
    if (axis === 'x') o.rotation.z = Math.PI / 2;
    if (axis === 'z') o.rotation.x = Math.PI / 2;
    parts.push(o);
    blockers.push(o);
    return o;
  }
  function panel(name, w, h, x, y, z, parent = group, column = null) {
    const g = new THREE.PlaneGeometry(w, h),
      uv = g.attributes.uv,
      source = column === null ? catalog : engineeringCatalog;
    for (let n = 0; n < uv.count; n++) {
      if (column !== null) uv.setX(n, (column + uv.getX(n)) / 3);
      uv.setY(n, 1 - (index + 1 - uv.getY(n)) / source.count);
    }
    const o = mesh(g, source.material, parent);
    o.name = name;
    o.position.set(x, y, z);
    o.rotation.y = Math.PI;
    parts.push(o);
    return o;
  }
  const [hw, hh] = hero.size,
    [, hy, hz] = hero.position;
  const casing = box('display-enclosure', hw + 0.22, hh + 0.21, 0.25, 0, hy, hz + 0.175, 'dark');
  for (const x of [-1, 1])
    box('screen-edge', 0.045, hh + 0.18, 0.055, x * (hw / 2 + 0.085), hy, hz + 0.013, 'metal', group, false);
  for (const y of [-1, 1])
    box(
      'screen-edge',
      hw + 0.2,
      0.045,
      0.055,
      0,
      hy + y * (hh / 2 + 0.083),
      hz + 0.013,
      'metal',
      group,
      false
    );
  const captionY = kind === 'workbench' ? 1.5 : 1.48,
    captionZ = kind === 'workbench' ? -0.1 : 0.61;
  box('caption-housing', 5.4, 0.44, 0.16, 0, captionY, captionZ + 0.09, 'dark');
  panel('project-caption', 5.2, 0.4, 0, captionY, captionZ);
  if (kind === 'workbench') {
    // Two bolted trestles carry the console; the screen arm has two visible pivot axes.
    for (const s of [-1, 1]) {
      box('bench-foot', 0.68, 0.18, 2.05, s * 2.39, 0.57, 0.78, 'stone');
      box('bench-shoe', 0.43, 0.13, 1.67, s * 2.39, 0.7, 0.81);
      beam('bench-front-leg', [s * 2.39, 0.73, 0.06], [s * 2.19, 1.68, 0.55], 0.2, 0.2);
      beam('bench-rear-leg', [s * 2.39, 0.73, 1.52], [s * 2.19, 1.68, 1.11], 0.2, 0.2);
      box('bench-worktop-cleat', 0.38, 0.13, 1.32, s * 2.19, 1.7, 0.77);
      // Counterbalanced cantilever mounted through the rear of the working surface.
      round('bench-arm-socket', 0.21, 0.16, s * 1.42, 1.94, 1.48, 'stone');
      beam('bench-arm-riser', [s * 1.42, 1.89, 1.48], [s * 1.42, 2.62, 2.18], 0.16, 0.21);
      beam('bench-arm-upper', [s * 1.42, 2.62, 2.18], [s * 1.42, 3.35, 1.98], 0.18, 0.2);
      round('bench-elbow', 0.18, 0.32, s * 1.42, 2.62, 2.18, 'stone', 'x');
      round('bench-screen-pivot', 0.13, 0.35, s * 1.42, 3.35, 1.93, 'metal', 'x');
      box('bench-vesa-plate', 0.65, 0.62, 0.16, s * 1.42, 3.35, 1.86);
      for (const y of [3.12, 3.58])
        for (const dx of [-0.23, 0.23])
          round('bench-vesa-bolt', 0.036, 0.028, s * 1.42 + dx, y, 1.955, 'stone', 'z');
    }
    box('bench-lower-tie', 4.8, 0.16, 0.25, 0, 0.87, 1.32);
    box('bench-worktop', 5.78, 0.18, 1.85, 0, 1.8, 0.74, 'stone');
    box('bench-edge-reveal', 5.69, 0.055, 1.74, 0, 1.683, 0.74, 'dark');
    box('bench-cable-tray', 3.55, 0.22, 0.29, 0, 1.52, 1.55, 'metal');
    beam('bench-screen-cable', [0, 1.58, 1.63], [0, 2.89, 1.86], 0.065, 0.065, 'dark');
    box('bench-keyboard-bed', 2.23, 0.045, 0.64, -0.39, 1.916, 0.35, 'dark');
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < 13; col++)
        box(
          'bench-keycap',
          0.128,
          0.028,
          0.105,
          -1.38 + col * 0.165,
          1.953,
          0.115 + row * 0.148,
          'metal',
          group,
          false
        );
    box('bench-trackpad', 0.58, 0.027, 0.57, 1.2, 1.921, 0.37, 'metal', group, false);
    box('bench-compute-module', 0.64, 0.87, 0.81, 1.72, 1.12, 0.77, 'dark');
    for (let j = 0; j < 7; j++)
      box('bench-vent-fin', 0.46, 0.028, 0.04, 1.72, 0.89 + j * 0.07, 0.344, 'metal', group, false);
    // Three real section selectors mounted in the front apron, not decorative source code.
    for (const [n, zone] of ['gallery', 'description', 'comments'].entries()) {
      const x = (n - 1) * 1.77;
      box('bench-selector-shell', 1.61, 0.34, 0.11, x, 1.08, 0.11, 'metal');
      const p = panel('bench-selector-' + zone, 1.53, 0.28, x, 1.08, 0.049, group, n);
      // Only the atlas's title band is used for the slim console controls.
      const uv = p.geometry.attributes.uv;
      for (let k = 0; k < uv.count; k++)
        uv.setY(k, 1 - (index + 0.04 + (1 - (k < 2 ? 1 : 0)) * 0.2) / engineeringCatalog.count);
      interactions.push({ object: p, kind: 'zone', zone, index });
      beam('bench-selector-mount', [x, 1.72, 0.4], [x, 1.08, 0.17], 0.07, 0.08);
    }
  } else {
    // Folded three-panel workstation. Rear bus and hinge barrels physically join each module.
    for (const s of [-1, 1]) {
      box('relay-foot', 0.68, 0.18, 1.86, s * 2.51, 0.57, 1.02, 'stone');
      box('relay-leg', 0.17, 0.8, 0.21, s * 2.51, 1.04, 1.12);
      beam('relay-knee-brace', [s * 2.51, 0.69, 1.72], [s * 2.1, 1.61, 1.91], 0.13, 0.13);
    }
    box('relay-bus', 5.2, 0.2, 0.26, 0, 1.53, 1.88, 'metal');
    box('relay-backbone', 0.3, 2.05, 0.25, 0, 2.3, 1.99);
    box('relay-vesa-plate', 1.2, 1.2, 0.18, 0, 3.05, 1.86);
    for (const s of [-1, 1]) {
      beam('relay-shoulder', [0, 2.18, 1.98], [s * 1.85, 2.95, 1.88], 0.14, 0.17);
      box('relay-hinge-bridge', 0.35, 0.17, 0.42, s * 2.04, 2.77, 1.68);
      for (const y of [2.01, 3.54]) round('relay-hinge', 0.092, 0.32, s * 2.06, y, 1.56, 'stone');
      // Wings turn in toward the visitor. Their backs stay attached along the hinge edge.
      const wing = new THREE.Group();
      group.add(wing);
      wing.position.set(s * 2.08, 2.78, 1.53);
      wing.rotation.y = s * 0.38;
      box('relay-module-housing', 1.1, 2.28, 0.15, s * 0.55, 0, 0.09, 'dark', wing);
      box('relay-module-rail', 1.1, 0.055, 0.06, s * 0.55, -1.15, 0.09, 'metal', wing);
      const zone = s < 0 ? 'description' : 'comments',
        column = s < 0 ? 1 : 2;
      const p = panel('relay-module-' + zone, 1.01, 2.13, s * 0.55, 0, 0, wing, column);
      interactions.push({ object: p, kind: 'zone', zone, index });
      beam('relay-module-brace', [s * 2.51, 1.45, 1.12], [s * 2.64, 1.87, 1.35], 0.1, 0.13);
      beam('relay-caption-mount', [s * 1.9, 1.53, 1.88], [s * 1.9, captionY, 0.72], 0.085, 0.085);
    }
    box('relay-gallery-socket', 2.25, 0.18, 0.24, 0, 1.95, 1.79, 'metal');
    const p = panel('relay-gallery-selector', 2.11, 0.31, 0, 1.78, 1.39, group, 0);
    interactions.push({ object: p, kind: 'zone', zone: 'gallery', index });
    const uv = p.geometry.attributes.uv;
    for (let k = 0; k < uv.count; k++)
      uv.setY(k, 1 - (index + 0.04 + (1 - (k < 2 ? 1 : 0)) * 0.2) / engineeringCatalog.count);
    box('relay-gallery-selector-housing', 2.2, 0.38, 0.13, 0, 1.78, 1.47, 'dark');
  }
  // Rear project identity sits on the load-bearing spine, without hiding its joints.
  const ry = kind === 'workbench' ? 3.36 : 3.1,
    rz = 2.4;
  beam('rear-caption-standoff', [0, ry, 1.75], [0, ry, rz], 0.12, 0.16);
  box('rear-caption-housing', 3.55, 0.48, 0.12, 0, ry, rz, 'dark');
  const rear = panel('rear-project-caption', 3.42, 0.42, 0, ry, rz + 0.068);
  rear.rotation.y = 0;
  // Warm practical fixtures are bolted to the console/outer module rails.
  for (const s of [-1, 1]) {
    const x = s * 2.83;
    box('engineering-lamp-post', 0.065, 0.74, 0.09, x, 2.12, 1.61);
    box('engineering-lamp-foot', 0.2, 0.1, 0.25, x, 1.8, 1.61);
    if (kind === 'relay') beam('relay-light-arm', [s * 2.51, 1.46, 1.12], [x, 1.8, 1.61], 0.075, 0.09);
    box(
      'engineering-light-lens',
      0.055,
      0.34,
      0.055,
      x,
      2.19,
      1.55,
      s < 0 ? 'lampBlue' : 'lampViolet',
      group,
      false
    );
    practical({ x, y: 2.19, z: 1.55 }, group, 8, 0.9, s < 0 ? 0 : 1, 0.48, 64);
  }
  box(
    'engineering-selector-track',
    4.04,
    0.044,
    0.045,
    0,
    kind === 'relay' ? 1.276 : 0.904,
    kind === 'relay' ? 0.624 : 0.06,
    'metal',
    group,
    false
  );
  const cursor = box(
    'engineering-section-cursor',
    0.18,
    0.035,
    0.025,
    0,
    kind === 'relay' ? 1.276 : 0.904,
    kind === 'relay' ? 0.604 : 0.045,
    'lampBlue',
    group,
    false
  );
  cursor.userData.dynamic = true;
  cursor.visible = false;
  let targetX = 0,
    lastTime = null;
  function setActive(active, zone) {
    cursor.visible = active;
    // Comments to the right; the gallery (on a workbench) or the description (elsewhere) to the left.
    const left = kind === 'workbench' ? 'gallery' : 'description';
    if (zone === 'comments') targetX = 1.77;
    else targetX = zone === left ? -1.77 : 0;
  }
  function update(now, animate) {
    const dt = lastTime === null ? 1 : Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;
    cursor.position.x = animate
      ? THREE.MathUtils.lerp(cursor.position.x, targetX, 1 - Math.exp(-dt * 12))
      : targetX;
  }
  group.updateMatrixWorld(true);
  const bounds = new THREE.Box3();
  for (const o of parts) bounds.union(new THREE.Box3().setFromObject(o));
  return {
    kind,
    parts: parts.length,
    roof: false,
    hero,
    bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
    screenBack: casing,
    interactions,
    setActive,
    update
  };
}
