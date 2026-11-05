// Rigid island motion and bridge reveal for filter/sort transitions.
// Static merges keep one draw per material: every vertex (or instance) names its
// owner island, and the vertex stage applies that owner's world-space matrix.
// Owner 0 is the fixed scenery and is always the identity.
// 24 matrices use 96 of the 256 vertex uniform vectors every WebGL2 device provides.
export const MAX_OWNERS = 24;
// Connective (bridge) vertices store how far along their free span they lie:
// 0 at a landing, 254 at mid-span; 255 marks deck over an island, never hidden.
export const REVEAL_FIXED = 255;
// An owner matrix is affine, so its bottom row is free: element [3] (column 0, row 3)
// carries the island's haze level (0 clear, 1 fully into the fog). The shader reads it
// and clears it before the matrix moves anything.
export const FADE_ELEMENT = 3;

export function createOwnerUniforms(THREE) {
  return {
    gardenOwners: { value: Array.from({ length: MAX_OWNERS }, () => new THREE.Matrix4()) },
    gardenReveal: { value: 1 },
    // Bridge dissolve: a glowing ragged edge gardenRevealBand wide, scaled by gardenRevealGlow.
    gardenRevealGlow: { value: 0 },
    gardenRevealBand: { value: 0.08 },
    gardenGlowColor: { value: new THREE.Color(0x9fb6ff) }
  };
}

const vertexHead = `attribute float gardenOwner;
  uniform mat4 gardenOwners[${MAX_OWNERS}];
  varying float vGardenFade;
  \n`;
const revealHead = `attribute float gardenRevealPoint;
  varying float vGardenRevealPoint;
  varying vec3 vGardenRevealPos;
  \n`;
const fadeFragment = `#include <fog_fragment>
  #ifdef USE_FOG
    gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,clamp(vGardenFade,0.,1.));
  #endif`;
const revealFragmentHead = `uniform float gardenReveal;
  uniform float gardenRevealGlow;
  uniform float gardenRevealBand;
  uniform vec3 gardenGlowColor;
  varying float vGardenRevealPoint;
  varying vec3 vGardenRevealPos;
  float gardenHash(vec3 p){
    return fract(sin(dot(floor(p*3.1),vec3(12.9898,78.233,37.719)))*43758.5453);
  }
  \n`;
// The ragged noise only acts part-way (zero at both ends), so 0 hides every free span and 1 shows all of it.
const revealDiscard = `void main() {
        float gardenEdge=0.;
        if(vGardenRevealPoint<254.5){
          float gardenRagged=clamp(4.*gardenReveal*(1.-gardenReveal),0.,1.);
          float gardenLead=gardenReveal-(vGardenRevealPoint/254.+(gardenHash(vGardenRevealPos)-.5)*.16*gardenRagged);
          if(gardenLead<0.)discard;
          gardenEdge=1.-smoothstep(0.,gardenRevealBand,gardenLead);
        }`;
// The owner and reveal attributes are bytes read as normalized (0..1, back to 0..255 in the shader): a plain byte
// is an integer input to the GPU, and the driver built a second vertex shader for it at the first draw. That was
// 41 shaders compiled one by one in the garden's first frame (round 21: 0.6 s of it); read as normalized they
// match the shaders already compiled in parallel. Owner attributes are made with OWNER_NORMALIZED.
export const OWNER_NORMALIZED = true;
// Patch a material so owner matrices move its vertices and haze it into the fog.
// Bridge materials also dissolve beyond the current reveal level; island materials never do.
export function patchOwnerMaterial(material, uniforms, { reveal = false } = {}) {
  const tag = reveal ? 'reveal' : 'owner';
  if (material.userData.gardenPatch === tag) return material;
  if (material.userData.gardenPatch)
    throw new Error('Material already patched as ' + material.userData.gardenPatch);
  material.userData.gardenPatch = tag;
  material.defaultAttributeValues = {
    ...(material.defaultAttributeValues || {}),
    gardenOwner: [0],
    ...(reveal ? { gardenRevealPoint: [REVEAL_FIXED / 255] } : {})
  };
  const previous = material.onBeforeCompile.bind(material),
    cacheKey = material.customProgramCacheKey();
  material.customProgramCacheKey = () => cacheKey + '-garden-' + tag + '-v2';
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader =
      vertexHead +
      (reveal ? revealHead : '') +
      shader.vertexShader
        .replace(
          'void main() {',
          `void main() {
        mat4 gardenOwnerMatrix=gardenOwners[int(gardenOwner*255.+.5)];vGardenFade=gardenOwnerMatrix[0][3];gardenOwnerMatrix[0][3]=0.;${reveal ? 'vGardenRevealPoint=gardenRevealPoint*255.;' : ''}
        #ifdef USE_INSTANCING
          mat4 gardenInstanceMatrix=gardenOwnerMatrix*instanceMatrix;
          #define instanceMatrix gardenInstanceMatrix
        #endif`
        )
        .replace(
          '#include <beginnormal_vertex>',
          `#include <beginnormal_vertex>
        #ifndef USE_INSTANCING
          objectNormal=mat3(gardenOwnerMatrix)*objectNormal;
        #endif`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
        #ifndef USE_INSTANCING
          transformed=(gardenOwnerMatrix*vec4(transformed,1.)).xyz;
        #endif${
          reveal
            ? `
        #ifdef USE_INSTANCING
          vGardenRevealPos=(modelMatrix*instanceMatrix*vec4(transformed,1.)).xyz;
        #else
          vGardenRevealPos=(modelMatrix*vec4(transformed,1.)).xyz;
        #endif`
            : ''
        }`
        );
    shader.fragmentShader =
      'varying float vGardenFade;\n' + shader.fragmentShader.replace('#include <fog_fragment>', fadeFragment);
    if (reveal)
      shader.fragmentShader =
        revealFragmentHead +
        shader.fragmentShader
          .replace('void main() {', revealDiscard)
          .replace(
            '#include <dithering_fragment>',
            'gl_FragColor.rgb+=gardenGlowColor*gardenEdge*gardenRevealGlow*1.6;\n#include <dithering_fragment>'
          );
  };
  material.needsUpdate = true;
  return material;
}

// Per-instance attributes live on a light geometry that shares the base buffers,
// so the shared plant/box geometries stay untouched and economy swaps re-wrap.
export function ownedGeometry(THREE, base, attributes) {
  const geometry = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(base.attributes)) geometry.setAttribute(name, attribute);
  if (base.index) geometry.setIndex(base.index);
  for (const [name, attribute] of Object.entries(attributes)) geometry.setAttribute(name, attribute);
  if (base.boundingBox) geometry.boundingBox = base.boundingBox.clone();
  if (base.boundingSphere) geometry.boundingSphere = base.boundingSphere.clone();
  geometry.groups = base.groups.map(group => ({ ...group }));
  return geometry;
}

// A span's reveal value: hidden from mid-span toward both landings as the level falls.
export function spanReveal(u, from, to) {
  if (!(to > from) || u <= from || u >= to) return REVEAL_FIXED;
  const s = (u - from) / (to - from);
  return Math.round((1 - Math.abs(2 * s - 1)) * 254);
}
