// Soft glow around neon, lanterns, the portal and bright sky, as in the confirmed realistic reference.
// Three's own UnrealBloomPass at half resolution over a 4× MSAA HDR target; economy renders directly.
// The same chain smooths edges with FXAA where the canvas has no MSAA (medium graphics, garden.mjs): the scene, the
// sRGB output and FXAA, with the glow and lens passes skipped. Owner, 2026-10-31: on the Realme 11 Pro+ (Mali-G68)
// the canvas's 4× MSAA cost a third of the frame rate; FXAA keeps rails and roof edges from stair-stepping.
import * as THREE from './vendor/three.module.js';
import { EffectComposer } from './vendor/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './vendor/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './vendor/postprocessing/OutputPass.js';
import { ShaderPass } from './vendor/postprocessing/ShaderPass.js';
import { FXAAShader } from './vendor/shaders/FXAAShader.js';
import { GTAOPass } from './vendor/postprocessing/GTAOPass.js';
import { createLensPass } from './black-hole-lens.mjs';
import { createSunShaftsPass } from './sun-shafts.mjs';
import { GLOW_THRESHOLD } from './content-level.mjs';

const WHITE = new THREE.Color(1, 1, 1),
  GOLD = new THREE.Color(1, 0.72, 0.38);

export function createBloom(
  renderer,
  { strength = 0.5, radius = 0.6, threshold = GLOW_THRESHOLD.night, samples = 4 } = {}
) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), {
    type: THREE.HalfFloatType,
    samples,
    // 32-bit float depth: with the renderer's reversed depth it parts layers millimetres apart at any distance.
    // Only the multisampled buffer is used (nothing reads depth), so it is never resolved into the texture.
    depthTexture: new THREE.DepthTexture(Math.max(1, size.x), Math.max(1, size.y), THREE.FloatType),
    resolveDepthBuffer: false
  });
  const composer = new EffectComposer(renderer, target),
    scenePass = new RenderPass(null, null);
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(Math.max(1, size.x), Math.max(1, size.y)),
    strength,
    radius,
    threshold
  );
  // One NaN or infinite pixel from any shader would be blurred across the whole frame; clamping keeps it out
  // of the glow (max() returns the non-NaN operand on D3D; isnan() is optimised away there).
  bloom.materialHighPassFilter.fragmentShader = bloom.materialHighPassFilter.fragmentShader.replace(
    'vec4 texel = texture2D( tDiffuse, vUv );',
    'vec4 texel = texture2D( tDiffuse, vUv );\n\t\t\ttexel = min( max( texel, vec4( 0.0 ) ), vec4( 64000.0 ) );'
  );
  bloom.materialHighPassFilter.needsUpdate = true;
  // Each material tone-maps itself inside the scene target, exactly as it would on screen, so project
  // screens, lamps and neon (toneMapped:false) keep their full colour. three applies per-material tone
  // mapping only for the screen or XR-flagged targets; the final pass then only converts to sRGB.
  const output = new OutputPass(),
    renderOutput = output.render.bind(output);
  output.render = (target, ...rest) => {
    const mapping = target.toneMapping;
    target.toneMapping = THREE.NoToneMapping;
    try {
      renderOutput(target, ...rest);
    } finally {
      target.toneMapping = mapping;
    }
  };
  const screenLike = () => {
    for (const buffer of [composer.renderTarget1, composer.renderTarget2]) {
      buffer.isXRRenderTarget = true;
      buffer.texture.colorSpace = THREE.LinearSRGBColorSpace;
    }
  };
  // The main portal's black-hole lens bends the glowing frame; it runs only during a crossing.
  const lens = createLensPass(THREE);
  // Ultra graphics: shafts from the sun through the crowns (sun-shafts.mjs), after the glow so it does not bloom them.
  const shafts = createSunShaftsPass(THREE);
  // Ultra graphics: shade in the corners (ground-truth ambient occlusion) from the scene's own depth, normals rebuilt
  // from it, so no second scene pass and the leaf cards' cut-outs stay open. Before the glow, so lamps still bloom.
  const ao = new GTAOPass(null, new THREE.PerspectiveCamera(), Math.max(1, size.x), Math.max(1, size.y));
  ao.output = GTAOPass.OUTPUT.Default;
  ao.enabled = false;
  ao.setGBuffer(target.depthTexture);
  // Tuned 2026-10-31 on the garden: a metre's reach at full strength darkened whole cliffs and the bridge's underside.
  ao.updateGtaoMaterial({ radius: 0.7, distanceExponent: 1.4, thickness: 1.2, scale: 1, samples: 12 });
  ao.blendIntensity = 0.75;
  ao.updatePdMaterial({ radius: 6, rings: 2, samples: 12 });
  // The scene lands in either buffer, so the AO reads the depth of the one it was just drawn into.
  const renderAo = ao.render.bind(ao);
  ao.render = (r, writeBuffer, readBuffer, ...rest) => {
    const depth = readBuffer.depthTexture;
    if (ao.depthTexture !== depth) {
      ao.depthTexture = depth;
      ao.gtaoMaterial.uniforms.tDepth.value = depth;
      ao.pdMaterial.uniforms.tDepth.value = depth;
    }
    renderAo(r, writeBuffer, readBuffer, ...rest);
  };
  // At half the frame's size (the shade is soft, and its normals still come from the full depth): at full size it
  // took the owner's iPhone from 27 to 17 fps on Ultra (2026-10-31).
  const sizeAo = ao.setSize.bind(ao);
  ao.setSize = (width, height) =>
    sizeAo(Math.max(1, Math.ceil(width / 2)), Math.max(1, Math.ceil(height / 2)));
  composer.addPass(scenePass);
  composer.addPass(ao);
  composer.addPass(bloom);
  composer.addPass(shafts);
  composer.addPass(lens);
  composer.addPass(output);
  // After the sRGB output, so FXAA weighs edges as they are seen; off unless smoothing is asked for.
  const fxaa = new ShaderPass(FXAAShader);
  fxaa.enabled = false;
  composer.addPass(fxaa);
  screenLike();
  // Audits count the scene pass only; the glow passes are a fixed handful of full-screen quads.
  let enabled = true,
    smooth = false,
    shaftsReady = null;
  const sceneInfo = { calls: 0, triangles: 0 };
  const renderScene = scenePass.render.bind(scenePass);
  scenePass.render = (...args) => {
    renderScene(...args);
    sceneInfo.calls = renderer.info.render.calls;
    sceneInfo.triangles = renderer.info.render.triangles;
  };
  return {
    get enabled() {
      return enabled;
    },
    get sceneInfo() {
      return enabled || smooth ? sceneInfo : null;
    },
    // Whether the chain draws the scene (glow, or FXAA without the glow) rather than the renderer straight to screen.
    get composing() {
      return enabled || smooth;
    },
    render(scene, camera) {
      if (!enabled && !smooth) {
        renderer.render(scene, camera);
        return;
      }
      bloom.enabled = enabled;
      fxaa.enabled = smooth;
      if (!enabled) lens.enabled = shafts.enabled = ao.enabled = false;
      scenePass.scene = scene;
      scenePass.camera = camera;
      ao.camera = camera;
      composer.render();
    },
    setSize(width, height, ratio) {
      composer.setPixelRatio(ratio);
      composer.setSize(width, height);
      fxaa.material.uniforms.resolution.value.set(
        1 / Math.max(1, width * ratio),
        1 / Math.max(1, height * ratio)
      );
      screenLike();
    },
    setEnabled(value) {
      enabled = !!value;
    },
    setSmoothing(value) {
      smooth = !!value;
    },
    // Shaders for objects not on screen yet, made for the scene pass's own target (the target decides their colour
    // space and tone mapping, so the screen's programs would not match); resolves when they are ready.
    compile(object, camera, scene = object) {
      const previous = renderer.getRenderTarget();
      if (enabled || smooth) renderer.setRenderTarget(composer.readBuffer);
      try {
        return renderer.compileAsync(object, camera, scene);
      } finally {
        renderer.setRenderTarget(previous);
      }
    },
    // The crossing's lens program, made ahead (garden.mjs boot).
    compileLens() {
      return lens.compile(renderer, composer.writeBuffer);
    },
    // Ultra: shade in the corners. The multisampled scene's depth is resolved for it only while it is on.
    setOcclusion(value) {
      ao.enabled = enabled && !!value;
      for (const buffer of [composer.renderTarget1, composer.renderTarget2])
        buffer.resolveDepthBuffer = ao.enabled;
    },
    // sunShaftState (sun-shafts.mjs) or null to switch the shafts off; drawn only with the glow on. Their programs
    // are made in the background the first time they are asked for (Ultra only), and they show once ready.
    setShafts(state) {
      if (state && enabled && shaftsReady !== true) {
        shaftsReady ??= shafts.compile(renderer, composer.writeBuffer).then(() => (shaftsReady = true));
        state = null;
      }
      shafts.enabled = enabled && !!state;
      if (!state) return;
      const { mask, composite } = shafts.uniforms;
      shafts.sun.set(state.x, state.y);
      mask.threshold.value = state.threshold;
      mask.reach.value = state.reach;
      composite.strength.value = state.strength;
      // The sun's own colour, pale, warmed toward gold at a low sun.
      composite.tint.value.copy(state.sunColor).lerp(WHITE, 0.5).lerp(GOLD, state.warm);
    },
    // { horizon, spin, glow, x, y (0..1 on screen), aspect, time } or null to switch the lens off. Returns
    // whether the lens can be drawn (the composer is on).
    setLens(state) {
      const u = lens.uniforms;
      lens.enabled = enabled && !!state && state.horizon > 1e-4;
      if (state) {
        u.horizon.value = state.horizon;
        u.spin.value = state.spin;
        u.glow.value = state.glow;
        u.center.value.set(state.x, state.y);
        u.aspect.value = state.aspect;
        u.time.value = state.time;
        u.voyage.value = state.voyage ?? 0;
      }
      return enabled;
    },
    setStrength(value) {
      bloom.strength = value;
    },
    // UnrealBloomPass copies this into its high-pass uniform on every render.
    setThreshold(value) {
      bloom.threshold = value;
    },
    dispose() {
      composer.dispose();
      bloom.dispose();
      fxaa.dispose();
      lens.dispose();
      shafts.dispose();
      ao.dispose();
    }
  };
}
