// Makes a rearrangement readable: numbered name tags float over the islands, and a light runs along
// the bridges from island 1 to the last one, so a visitor sees the new order and its direction.
import { inFrontOfCamera } from './near-plane.mjs';

export const SHOWCASE = { step: 520, maxRun: 3800, linger: 4600, fade: 600 };

// Run timing for n islands: one hop per island, capped so long rings stay brisk.
export function showcaseTiming(count, { reduced = false } = {}) {
  if (reduced || count < 1) return { hop: 0, run: 0, total: SHOWCASE.linger };
  const hops = Math.max(0, count - 1),
    hop = hops ? Math.min(SHOWCASE.step, SHOWCASE.maxRun / hops) : 0;
  return { hop, run: hop * hops, total: hop * hops + SHOWCASE.linger };
}
// How many islands the running light has reached at time t (1-based count, at least the first).
export function reachedCount(t, count, hop) {
  if (count < 1) return 0;
  if (!hop) return count;
  return Math.min(count, 1 + Math.floor(Math.max(0, t) / hop));
}

export function createShowcase(THREE, { container, caption, labels }) {
  const tags = [],
    v = new THREE.Vector3(),
    eye = new THREE.Vector3(),
    orbMaterial = new THREE.MeshBasicMaterial({
      color: 0xe9ddff,
      toneMapped: false,
      transparent: true,
      opacity: 0.95,
      depthWrite: false
    });
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 10), orbMaterial),
    halo = new THREE.Mesh(
      new THREE.SphereGeometry(1.25, 16, 10),
      new THREE.MeshBasicMaterial({
        color: 0x9f86ff,
        toneMapped: false,
        transparent: true,
        opacity: 0.28,
        depthWrite: false
      })
    );
  orb.add(halo);
  orb.visible = false;
  orb.renderOrder = 20;
  let run = null,
    staticOrder = false,
    // Pinned tags keep islands outside the view on the screen edge; free ones (observatory) hide instead.
    pinned = true,
    captionTimer = 0;
  function clearTags() {
    container.replaceChildren();
    tags.length = 0;
  }
  function buildTags(world, projects) {
    clearTags();
    const frames = world.transitions?.frames || [];
    projects.forEach((project, index) => {
      const frame = frames.find(f => f.id === project.id);
      if (!frame) return;
      const tag = document.createElement('span');
      tag.className = 'island-tag';
      tag.dataset.index = String(index);
      const number = document.createElement('b');
      number.textContent = String(index + 1);
      const name = document.createElement('span');
      name.textContent = project.name;
      tag.append(number, name);
      container.append(tag);
      tags.push({ tag, x: frame.x, y: frame.y + 9.5, z: frame.z });
    });
  }
  function place(camera, width, height) {
    for (const item of tags) {
      v.set(item.x, item.y, item.z);
      const ahead = inFrontOfCamera(camera, v, eye);
      v.project(camera);
      // Behind the eye the projection comes out mirrored (it used to hang islands behind the terrace in the sky):
      // a free tag hides, a pinned one turns back the right way and goes to the screen's edge.
      if (!ahead && pinned) v.multiplyScalar(-2 / Math.max(1e-6, Math.abs(v.x), Math.abs(v.y)));
      const hidden = !ahead ? !pinned : !pinned && (Math.abs(v.x) > 1 || Math.abs(v.y) > 1);
      item.tag.style.visibility = hidden ? 'hidden' : 'visible';
      if (hidden) continue;
      const half = Math.min(90, item.tag.offsetWidth / 2 + 8),
        x = Math.min(width - half, Math.max(half, ((v.x + 1) / 2) * width)),
        y = Math.min(height - 150, Math.max(70, ((1 - v.y) / 2) * height));
      item.tag.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-100%)`;
    }
  }
  const api = {
    get active() {
      return !!run || staticOrder;
    },
    // Static tags while the order chooser is open: the visitor sees what "1, 2, 3" currently means.
    showOrder(world, projects, text, { pin = true } = {}) {
      if (run) return;
      staticOrder = true;
      pinned = pin;
      buildTags(world, projects);
      container.hidden = false;
      container.classList.add('is-visible');
      tags.forEach(item => item.tag.classList.add('is-lit'));
      api.setCaption(text);
    },
    hideOrder() {
      if (run || !staticOrder) return;
      staticOrder = false;
      container.classList.remove('is-visible');
      api.setCaption('');
      setTimeout(() => {
        if (!run && !staticOrder) {
          clearTags();
          container.hidden = true;
        }
      }, SHOWCASE.fade);
    },
    setCaption(text) {
      clearTimeout(captionTimer);
      caption.hidden = !text;
      if (text) {
        caption.textContent = '';
        captionTimer = setTimeout(() => {
          caption.textContent = text;
        }, 60);
      }
    },
    // After a rearrangement: run the light from island 1 to the last, lighting each tag as it passes.
    play(world, projects, text, { reduced = false, now = performance.now() } = {}) {
      staticOrder = false;
      pinned = true;
      buildTags(world, projects);
      container.hidden = false;
      container.classList.add('is-visible');
      api.setCaption(text);
      const timing = showcaseTiming(projects.length, { reduced });
      run = { start: now, timing, world, count: projects.length, lit: 0 };
      if (!reduced && projects.length && world.route) {
        world.scene.add(orb);
        orb.visible = true;
      }
    },
    stop() {
      run = null;
      orb.visible = false;
      orb.removeFromParent();
      if (!staticOrder) {
        container.classList.remove('is-visible');
        api.setCaption('');
        clearTags();
        container.hidden = true;
      }
    },
    // Returns true while it still needs frames.
    tick(now, camera, width, height, fx) {
      if (!run && !staticOrder) return false;
      place(camera, width, height);
      if (!run) return false;
      const t = now - run.start,
        { hop, run: length, total } = run.timing,
        route = run.world.route,
        lit = reachedCount(t, run.count, hop);
      for (let i = run.lit; i < lit; i++) {
        tags[i]?.tag.classList.add('is-lit');
        const item = tags[i];
        if (fx && item && hop) fx.ripple?.(item.x, item.y - 9.5 + 0.6, item.z, 5.5, 1.1);
      }
      run.lit = lit;
      if (orb.visible && route?.count) {
        const p = Math.min(Math.max(0, run.count - 1), hop ? t / hop : 0),
          point = route.point(Math.min(p, route.count - 1e-4), 0, 2.6);
        orb.position.set(point.x, point.y, point.z);
        const pulse = 1 + 0.18 * Math.sin(t * 0.02);
        orb.scale.setScalar(pulse);
        if (fx && t < length)
          fx.burst?.(point.x, point.y, point.z, 2, {
            radius: 0.35,
            speed: 0.8,
            up: 0.4,
            size: [0.06, 0.14],
            life: [0.4, 0.8]
          });
        if (t >= length) {
          orbMaterial.opacity = Math.max(0, 0.95 - (t - length) / 400);
          if (t > length + 400) {
            orb.visible = false;
            orb.removeFromParent();
            orbMaterial.opacity = 0.95;
          }
        }
      }
      if (t >= total - SHOWCASE.fade) container.classList.remove('is-visible');
      if (t >= total) {
        api.stop();
        return false;
      }
      return true;
    },
    dispose() {
      api.stop();
      orb.geometry.dispose();
      orbMaterial.dispose();
      halo.geometry.dispose();
      halo.material.dispose();
    }
  };
  return api;
}
