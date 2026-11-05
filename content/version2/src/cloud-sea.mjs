// The cloud sea the islands float in: below the island bases every fogged surface dissolves into lit
// cloud (a wavy height fog added to three's fog chunks), and soft billowing puffs drift around the bases.
// The sea's colour follows the scene fog, so sunset clouds are warm and night clouds moonlit.
import { parkMiller } from './seeded-random.mjs';
// The violet the shaded side of sunset clouds leans to (linear).
const SUNSET_SHADE = { r: 0.16, g: 0.09, b: 0.3 };
export const SEA = { top: -4, depth: 14, wave: 6, puffs: 160, economyPuffs: 60, inner: 8, outer: 165 };

const SEA_FOG_VERTEX = `#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  // World position from the view-space position (the view matrix is rigid): no extra uniforms needed.
  vGardenFogWorld = transpose( mat3( viewMatrix ) ) * ( mvPosition.xyz - viewMatrix[ 3 ].xyz );
#endif`;
const SEA_FOG_PARS_VERTEX = `#ifdef USE_FOG
  varying float vFogDepth;
  varying vec3 vGardenFogWorld;
#endif`;
const SEA_FOG_PARS_FRAGMENT = `#ifdef USE_FOG
  uniform vec3 fogColor;
  varying float vFogDepth;
  varying vec3 vGardenFogWorld;
  #ifdef FOG_EXP2
  uniform float fogDensity;
  #else
  uniform float fogNear;
  uniform float fogFar;
  #endif
  float gardenSeaHash( vec2 p ) {
    return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 );
  }
  float gardenSeaNoise( vec2 p ) {
    vec2 i = floor( p ), f = fract( p );
    f = f * f * ( 3.0 - 2.0 * f );
    return mix( mix( gardenSeaHash( i ), gardenSeaHash( i + vec2( 1.0, 0.0 ) ), f.x ),
        mix( gardenSeaHash( i + vec2( 0.0, 1.0 ) ), gardenSeaHash( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
  }
  #endif`;
const SEA_FOG_FRAGMENT = `#ifdef USE_FOG
  #ifdef FOG_EXP2
  float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
  #else
  float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
  #endif
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
  // Cloud sea: a wavy layer top; everything below it fades into brighter, cloud-tinted fog. The waves only go down
  // from SEA.top, so above it (the garden, on the overview) nothing here changes the pixel and the noise is skipped.
  if ( vGardenFogWorld.y < ${SEA.top.toFixed(1)} ) {
    float gardenSeaWave = gardenSeaNoise( vGardenFogWorld.xz * 0.045 ) * 0.6 +
        gardenSeaNoise( vGardenFogWorld.xz * 0.11 + 3.7 ) * 0.4;
    float gardenSeaTop = ${SEA.top.toFixed(1)} - ${SEA.wave.toFixed(1)} * gardenSeaWave;
    float gardenSea = 1.0 - smoothstep( gardenSeaTop - ${SEA.depth.toFixed(1)}, gardenSeaTop,
        vGardenFogWorld.y );
    vec3 gardenSeaColor = fogColor * 1.12 + vec3( 0.045, 0.035, 0.05 );
    gl_FragColor.rgb = mix( gl_FragColor.rgb, gardenSeaColor, gardenSea * 0.94 );
  }
  #endif`;

// Replace three's fog chunks once, before any program compiles. Idempotent.
export function installCloudSeaFog(THREE) {
  const chunks = THREE.ShaderChunk;
  if (chunks.fog_fragment.includes('gardenSea')) return false;
  chunks.fog_vertex = SEA_FOG_VERTEX;
  chunks.fog_pars_vertex = SEA_FOG_PARS_VERTEX;
  chunks.fog_pars_fragment = SEA_FOG_PARS_FRAGMENT;
  chunks.fog_fragment = SEA_FOG_FRAGMENT;
  return true;
}

// Deterministic puff layout in a ring band around the garden; nothing depends on the scenery RNG.
export function puffLayout(count, { inner = SEA.inner, outer = SEA.outer, seed = 11 } = {}) {
  const next = parkMiller(seed),
    out = [];
  for (let i = 0; i < count; i++) {
    const a = next() * Math.PI * 2,
      r = Math.sqrt(inner * inner + next() * (outer * outer - inner * inner)),
      far = (r - inner) / (outer - inner);
    out.push({
      x: Math.sin(a) * r,
      y: -12 - 5 * next() - 3 * far,
      z: Math.cos(a) * r,
      size: 10 + 9 * next() + 8 * far,
      seed: next()
    });
  }
  return out;
}

// Billboard cloud puffs: soft noisy discs lit from above, fogged like the rest of the scene.
// puffs: [{x,y,z,size,seed}]; glow adds a light of its own (waterfall spray at night).
export function createPuffMesh(THREE, { puffs, resources, name, glow = 0, drift = 1 }) {
  const base = new THREE.PlaneGeometry(2, 2),
    geometry = new THREE.InstancedBufferGeometry();
  geometry.index = base.index;
  geometry.setAttribute('position', base.attributes.position);
  geometry.setAttribute('uv', base.attributes.uv);
  geometry.setAttribute(
    'puff',
    new THREE.InstancedBufferAttribute(new Float32Array(puffs.flatMap(p => [p.x, p.y, p.z, p.size])), 4)
  );
  geometry.setAttribute(
    'puffSeed',
    new THREE.InstancedBufferAttribute(new Float32Array(puffs.map(p => p.seed)), 1)
  );
  geometry.instanceCount = puffs.length;
  resources.add(geometry);
  resources.add(base);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        time: { value: 0 },
        lit: { value: new THREE.Color(0xffd6c4) },
        shade: { value: new THREE.Color(0x8e7cae) },
        sunStrength: { value: 1 },
        glowColor: { value: new THREE.Color(0x7fb6ff) },
        glow: { value: glow },
        drift: { value: drift }
      }
    ]),
    vertexShader: `attribute vec4 puff;
      attribute float puffSeed;
      uniform float time;
      uniform float drift;
      varying vec2 vUv;
      varying float vSeed;
      #include <fog_pars_vertex>
      void main(){
        vec3 centre=puff.xyz;
        centre.x+=sin(time*.021+puffSeed*6.283)*6.*drift;
        centre.z+=cos(time*.017+puffSeed*4.1)*5.*drift;
        centre.y+=sin(time*.3+puffSeed*9.)*.4*(1.-drift);
        vec4 mvPosition=modelViewMatrix*vec4(centre,1.);
        mvPosition.xy+=position.xy*puff.w;
        vUv=uv;
        vSeed=puffSeed;
        gl_Position=projectionMatrix*mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform vec3 lit;
      uniform vec3 shade;
      uniform float sunStrength;
      uniform vec3 glowColor;
      uniform float glow;
      uniform float time;
      varying vec2 vUv;
      varying float vSeed;
      #include <fog_pars_fragment>
      float puffHash(vec2 p){
        return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);
      }
      float puffNoise(vec2 p){
        vec2 i=floor(p),f=fract(p);
        f=f*f*(3.-2.*f);
        return mix(mix(puffHash(i),puffHash(i+vec2(1.,0.)),f.x),
            mix(puffHash(i+vec2(0.,1.)),puffHash(i+vec2(1.,1.)),f.x),f.y);
      }
      void main(){
        vec2 p=vUv*2.-1.;
        // The quad's corners: even the thinnest billow leaves alpha under the .01 cut past this radius (1.27).
        if(dot(p*p,vec2(1.,1.69))>1.61)discard;
        vec2 q=p*2.2+vSeed*17.+vec2(0.,time*.05);
        float billow=puffNoise(q)*.55+puffNoise(p*4.7+vSeed*9.)*.3+puffNoise(p*9.+vSeed*3.)*.15;
        float r=length(p*vec2(1.,1.3))+(billow-.5)*.6;
        float alpha=1.-smoothstep(.42,1.,r);
        if(alpha<.01)discard;
        float top=clamp(.55+.5*p.y+.3*(billow-.5),0.,1.);
        vec3 color=mix(shade,lit,top*(.3+.7*sunStrength)+.1)+glowColor*glow*(1.-smoothstep(0.,.9,r));
        gl_FragColor=vec4(color,alpha*.9);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
      }`
  });
  resources.add(material);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.frustumCulled = false;
  mesh.userData.dynamic = true;
  mesh.renderOrder = -1;
  return { mesh, material, geometry };
}

export function createCloudSea(THREE, { scene, resources, economy = false }) {
  installCloudSeaFog(THREE);
  const { mesh, material, geometry } = createPuffMesh(THREE, {
    puffs: puffLayout(SEA.puffs),
    resources,
    name: 'garden-cloud-sea'
  });
  geometry.instanceCount = economy ? SEA.economyPuffs : SEA.puffs;
  // Drawn after the water (which writes depth) and the glass: a cloud in front of a waterfall now covers it, and
  // a cloud behind one stays hidden, instead of the falling water being painted over every cloud.
  mesh.renderOrder = 4;
  scene.add(mesh);
  return {
    mesh,
    setTime(time) {
      material.uniforms.time.value = time;
    },
    setEconomy(value) {
      geometry.instanceCount = value ? SEA.economyPuffs : SEA.puffs;
    },
    // Puffs take the backdrop's cloud and sun colours, lit from above like the reference.
    setLight({ cloudColor, sunColor, sunStrength = 1 }) {
      if (cloudColor) {
        // Very warm (sunset) clouds keep violet in their shade: coral tops over violet shadows, not all red.
        const warmth = Math.min(1, Math.max(0, (cloudColor.r - cloudColor.b - 0.3) / 0.3));
        material.uniforms.shade.value
          .copy(cloudColor)
          .multiplyScalar(0.78)
          .lerp(SUNSET_SHADE, 0.55 * warmth);
      }
      if (cloudColor && sunColor)
        material.uniforms.lit.value
          .copy(cloudColor)
          .lerp(sunColor, 0.45 * sunStrength)
          .multiplyScalar(1.08);
      material.uniforms.sunStrength.value = sunStrength;
    }
  };
}
