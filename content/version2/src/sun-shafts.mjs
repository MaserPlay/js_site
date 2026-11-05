// Ultra graphics (owner, 2026-10-31: «солнце сквозь деревья, лучи проходят»): light shafts from the sun across the
// frame, in the glow chain (garden-bloom.mjs). The bright sky round the sun is the light: whatever stands in front
// of it (crowns, trunks, a ridge, a pavilion) is dark in the frame and leaves a shadow in the shafts, and a sun
// behind the mountains has no bright sky round it, so it casts none. Three quarter-resolution passes: the bright
// mask round the sun, two radial blurs toward it (a long step, then a short one), then the shafts are added.
const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

// The sky near the sun, weighted by brightness and by distance from the sun (aspect-correct), never the
// whole bright frame: snow and clouds far from the sun send no shafts.
const MASK = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 sun;
uniform float aspect, threshold, reach;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  vec2 d = (vUv - sun) * vec2(aspect, 1.0);
  float near = 1.0 - smoothstep(0.0, reach, length(d));
  gl_FragColor = vec4(min(c, vec3(4.0)) * smoothstep(threshold, threshold + 0.3, lum) * near * near, 1.0);
}`;

// Light marched toward the sun: each sample a step closer, fading with distance (decay).
const BLUR = /* glsl */ `
#define SAMPLES 24
uniform sampler2D tDiffuse;
uniform vec2 sun;
uniform float stride, decay;
varying vec2 vUv;
void main() {
  vec2 toward = (sun - vUv) * stride / float(SAMPLES);
  vec2 uv = vUv;
  vec3 sum = vec3(0.0);
  float weight = 1.0, total = 0.0;
  for (int i = 0; i < SAMPLES; i++) {
    sum += texture2D(tDiffuse, uv).rgb * weight;
    total += weight;
    weight *= decay;
    uv += toward;
  }
  gl_FragColor = vec4(sum / total, 1.0);
}`;

// The blur gathers the most light at the sun itself, so the disc and the sky right round it get only a little of
// the shafts (owner, 2026-11-01: «само солнце пересвечивает»): the rays show beside the sun, not as a blot on it.
const COMPOSITE = /* glsl */ `
uniform sampler2D tDiffuse, tShafts;
uniform vec3 tint;
uniform vec2 sun;
uniform float strength, aspect, core, coreFloor;
varying vec2 vUv;
void main() {
  vec4 scene = texture2D(tDiffuse, vUv);
  float fromSun = length((vUv - sun) * vec2(aspect, 1.0));
  float aside = mix(coreFloor, 1.0, smoothstep(core * 0.2, core, fromSun));
  vec3 shafts = texture2D(tShafts, vUv).rgb * tint * strength * aside;
  // Added light that rolls off before white: the bright sky round the sun never clips to a flat disc.
  gl_FragColor = vec4(scene.rgb + shafts * (1.0 - min(scene.rgb, vec3(1.0)) * 0.6), scene.a);
}`;

// Variants for the owner's choice [?]: strength by day and at a low sun, how far from the sun the sky counts
// (reach, of the frame height), the brightness the sky must have, and the warmth added to the sun's own colour.
// Tuned 2026-10-31 on the garden at day and sunset: a wider reach or more strength turns the shafts into a haze over
// the islands, and by day into a white blot instead of the disc, so the day keeps about a third of the low sun's.
export const SUN_SHAFT_LOOKS = {
  soft: { day: 0.45, low: 1.6, reach: 0.18, threshold: 0.5, warm: 0.15 },
  medium: { day: 0.7, low: 2.2, reach: 0.2, threshold: 0.5, warm: 0.25 },
  strong: { day: 1.1, low: 3.4, reach: 0.25, threshold: 0.5, warm: 0.4 }
};

// Round the sun the shafts add only `floor` of their light, rising to all of it `radius` (of the frame height) away.
export const SHAFT_CORE = { radius: 0.24, floor: 0.1 };

export function createSunShaftsPass(THREE) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, 3, 0, -1, -1, 0, 3, -1, 0], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 2, 0, 0, 2, 0], 2));
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const material = (fragmentShader, uniforms) =>
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERTEX,
      fragmentShader,
      depthTest: false,
      depthWrite: false
    });
  const sun = { value: new THREE.Vector2(0.5, 0.5) };
  const mask = material(MASK, {
      tDiffuse: { value: null },
      sun,
      aspect: { value: 1 },
      threshold: { value: 0.58 },
      reach: { value: 0.45 }
    }),
    blur = material(BLUR, { tDiffuse: { value: null }, sun, stride: { value: 1 }, decay: { value: 0.96 } }),
    composite = material(COMPOSITE, {
      tDiffuse: { value: null },
      tShafts: { value: null },
      tint: { value: new THREE.Color(1, 0.9, 0.75) },
      strength: { value: 0 },
      sun,
      aspect: { value: 1 },
      core: { value: SHAFT_CORE.radius },
      coreFloor: { value: SHAFT_CORE.floor }
    });
  const quad = new THREE.Mesh(geometry, mask);
  quad.frustumCulled = false;
  const target = () =>
    new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      depthBuffer: false,
      stencilBuffer: false
    });
  const a = target(),
    b = target();
  function draw(renderer, shader, output) {
    quad.material = shader;
    renderer.setRenderTarget(output);
    renderer.render(quad, camera);
  }
  return {
    enabled: false,
    needsSwap: true,
    clear: false,
    renderToScreen: false,
    sun: sun.value,
    uniforms: { mask: mask.uniforms, blur: blur.uniforms, composite: composite.uniforms },
    setSize(width, height) {
      const w = Math.max(1, Math.round(width / 4)),
        h = Math.max(1, Math.round(height / 4));
      a.setSize(w, h);
      b.setSize(w, h);
      mask.uniforms.aspect.value = width / Math.max(1, height);
      composite.uniforms.aspect.value = mask.uniforms.aspect.value;
    },
    render(renderer, writeBuffer, readBuffer) {
      mask.uniforms.tDiffuse.value = readBuffer.texture;
      draw(renderer, mask, a);
      // A long stride first (the whole way to the sun), then a short one that smooths the banding between samples.
      blur.uniforms.tDiffuse.value = a.texture;
      blur.uniforms.stride.value = 1;
      blur.uniforms.decay.value = 0.965;
      draw(renderer, blur, b);
      blur.uniforms.tDiffuse.value = b.texture;
      blur.uniforms.stride.value = 0.18;
      blur.uniforms.decay.value = 1;
      draw(renderer, blur, a);
      composite.uniforms.tDiffuse.value = readBuffer.texture;
      composite.uniforms.tShafts.value = a.texture;
      draw(renderer, composite, this.renderToScreen ? null : writeBuffer);
    },
    // The pass's programs, made ahead for the targets they draw into.
    compile(renderer, output) {
      const previous = renderer.getRenderTarget();
      try {
        return Promise.all(
          [
            [mask, a],
            [blur, b],
            [composite, output]
          ].map(([shader, into]) => {
            renderer.setRenderTarget(into);
            return renderer.compileAsync(new THREE.Mesh(geometry, shader), camera);
          })
        );
      } finally {
        renderer.setRenderTarget(previous);
      }
    },
    dispose() {
      geometry.dispose();
      mask.dispose();
      blur.dispose();
      composite.dispose();
      a.dispose();
      b.dispose();
    }
  };
}

// The pass's state for a frame, or null: the sun's place on screen (0..1, may lie a little outside), how
// strongly it shines (sunStrength 0..1, its sine of elevation `height`) and its colour, for a look.
export function sunShaftState(look, { x, y, inFront, height, sunStrength, sunColor }) {
  if (!inFront || sunStrength <= 0.01 || height < -0.02) return null;
  // Off screen the shafts fade over a fifth of the frame: a sun just outside still streams in.
  const outside = Math.max(0, -x, x - 1, -y, y - 1),
    onScreen = 1 - Math.min(1, outside / 0.2),
    low = 1 - Math.min(1, Math.max(0, (height - 0.05) / 0.4)),
    strength = (look.day + (look.low - look.day) * low) * Math.min(1, sunStrength) * onScreen;
  if (strength <= 0.005) return null;
  return {
    x,
    y,
    strength,
    warm: look.warm * (0.4 + 0.6 * low),
    reach: look.reach,
    threshold: look.threshold,
    sunColor
  };
}
