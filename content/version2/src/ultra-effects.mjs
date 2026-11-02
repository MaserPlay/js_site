// Ultra graphics' extras, driven from the garden's frame (garden.mjs):
// - applyTo(world): shadows from the key light, three more lamp lights and a brighter aurora;
// - updateReflection(): the pools' mirror of the world round the garden (water-effects.mjs);
// - updateShafts(): the sun shafts through the crowns (sun-shafts.mjs).
// The level, the renderer, the world and the glow chain come through getters: garden.mjs makes the renderer at boot
// and swaps the world on a relayout.
import * as THREE from './vendor/three.module.js';
import { SUN_SHAFT_LOOKS, sunShaftState } from './sun-shafts.mjs';

// size: the cube map's face (px); every: frames between two faces drawn; lift: its height over the islands' mean (m).
const REFLECTION = { size: 256, every: 4, lift: 3 };

// ultra(): whether the level is Ultra; renderer(), world(), bloom(): the current ones; camera: the view's camera;
// shaftLook: a SUN_SHAFT_LOOKS name to preview (audit addresses, ?shafts=), else the medium look.
export function createUltraEffects({ ultra, renderer, world, bloom, camera, shaftLook = null }) {
  // Shadows from the key light (world.setShadows), three more lamp lights and a brighter aurora. The renderer's
  // shadow pass is on only then; turning it on or off remakes the lit materials' programs once (a level change by
  // hand).
  function applyTo(target) {
    const on = ultra();
    renderer().shadowMap.enabled = on;
    target.setShadows?.(on);
    target.setUltraLamps?.(on);
    target.backdrop?.setUltra?.(on);
  }

  // The pools mirror the world round the garden, seen from above its middle into a small cube map: the sky with its
  // real clouds, the sun or moon, the aurora, the mountains and the balloons. Only the backdrop: the islands,
  // pavilions and trees, seen from the middle and not from each pool, showed in the pools as stray coloured patches.
  // One face is drawn every few frames, without remaking the shadows; the first time all six at once, so the pools
  // never show an empty mirror.
  let reflection = null;
  function updateReflection() {
    const w = world();
    if (!ultra()) {
      if (reflection?.world) {
        reflection.world.setWaterReflection?.(null);
        reflection.world = null;
      }
      return;
    }
    if (!reflection) {
      const target = new THREE.WebGLCubeRenderTarget(REFLECTION.size, {
        type: THREE.HalfFloatType,
        generateMipmaps: true,
        minFilter: THREE.LinearMipmapLinearFilter
      });
      reflection = { target, cube: new THREE.CubeCamera(0.5, 1200, target), world: null, face: 0, tick: 0 };
    }
    if (reflection.world !== w) {
      const anchors = w.route.anchors,
        height = anchors.reduce((sum, p) => sum + p.y, 0) / anchors.length;
      reflection.cube.position.set(0, height + REFLECTION.lift, 0);
      reflection.cube.updateMatrixWorld();
      w.setWaterReflection?.(reflection.target.texture);
      reflection.world = w;
      reflection.far = w.scene.children.filter(
        o => o.userData.backdrop || /^(mountains-b|garden-sky-life)/.test(o.name)
      );
      for (let face = 0; face < 6; face++) drawReflectionFace(face);
      return;
    }
    if (++reflection.tick % REFLECTION.every) return;
    drawReflectionFace(reflection.face);
    reflection.face = (reflection.face + 1) % 6;
  }
  function drawReflectionFace(face) {
    const r = renderer(),
      w = world(),
      { target, cube, far } = reflection,
      // Lights stay: hiding one would change the lit materials' programs for the balloons.
      near = w.scene.children.filter(o => o.visible && !o.isLight && !far.includes(o)),
      previous = r.getRenderTarget(),
      previousFace = r.getActiveCubeFace(),
      previousLevel = r.getActiveMipmapLevel(),
      autoShadows = r.shadowMap.autoUpdate;
    if (cube.coordinateSystem !== r.coordinateSystem) {
      cube.coordinateSystem = r.coordinateSystem;
      cube.updateCoordinateSystem();
    }
    near.forEach(o => (o.visible = false));
    r.shadowMap.autoUpdate = false;
    w.sky.position.copy(cube.position);
    // Mipmaps (the slight blur the pools sample) are made after the last face, as CubeCamera.update does.
    target.texture.generateMipmaps = face === 5;
    try {
      r.setRenderTarget(target, face);
      if (r.state.buffers.depth.getReversed() && r.autoClear === false) r.clearDepth();
      r.render(w.scene, cube.children[face]);
    } finally {
      target.texture.generateMipmaps = true;
      r.setRenderTarget(previous, previousFace, previousLevel);
      r.shadowMap.autoUpdate = autoShadows;
      near.forEach(o => (o.visible = true));
      w.sky.position.copy(camera.position);
    }
  }

  // Shafts from the sun through the crowns, from where the sun is on screen this frame. The look is a choice for the
  // owner [?]; it is a copy, so an audit's live tuning (garden.mjs shaftLook) never changes the table.
  const look = { ...(SUN_SHAFT_LOOKS[shaftLook] || SUN_SHAFT_LOOKS.medium) },
    sunOnScreen = new THREE.Vector3(),
    sunInView = new THREE.Vector3();
  function updateShafts() {
    const b = bloom();
    if (!b) return;
    const w = world(),
      sun = w.backdrop.sun;
    if (!ultra() || !b.enabled || !sun.visible) return b.setShafts(null);
    camera.updateMatrixWorld();
    sunInView.copy(sun.position).applyMatrix4(camera.matrixWorldInverse);
    sunOnScreen.copy(sun.position).project(camera);
    b.setShafts(
      sunShaftState(look, {
        x: (sunOnScreen.x + 1) / 2,
        y: (sunOnScreen.y + 1) / 2,
        inFront: sunInView.z < 0,
        height: sun.position.y / sun.position.length(),
        sunStrength: sun.material.opacity,
        sunColor: w.backdrop.sunColor
      })
    );
  }

  return { applyTo, updateReflection, updateShafts, shaftLook: look };
}
