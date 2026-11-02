// Falling snow in winter: one draw of soft points in a box that wraps around the camera. Each flake keeps a
// fixed place in the world (the wrap is computed in world space), so walking does not drag the snow along.
import { lcg32 } from './seeded-random.mjs';
export const SNOWFALL = {
  count: 1400,
  economyCount: 450,
  box: [44, 26, 44],
  fall: 1.1,
  size: 0.11,
  level: 0.74
};

// Deterministic flake seeds in [0,1)^3 plus a per-flake phase.
export function flakeSeeds(count, seed = 11) {
  return Float32Array.from({ length: count * 4 }, lcg32(seed));
}

export function createSnowfall(THREE, { scene, resources, economy = false }) {
  const seeds = flakeSeeds(SNOWFALL.count),
    geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(new Float32Array(SNOWFALL.count * 3), 3)
  );
  geometry.setAttribute('flake', new THREE.Float32BufferAttribute(seeds, 4));
  geometry.setDrawRange(0, economy ? SNOWFALL.economyCount : SNOWFALL.count);
  resources.add(geometry);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        time: { value: 0 },
        centre: { value: new THREE.Vector3() },
        box: { value: new THREE.Vector3(...SNOWFALL.box) },
        fall: { value: SNOWFALL.fall },
        size: { value: SNOWFALL.size },
        scale: { value: 400 },
        level: { value: SNOWFALL.level }
      }
    ]),
    vertexShader: `attribute vec4 flake;
      uniform float time;
      uniform vec3 centre;
      uniform vec3 box;
      uniform float fall;
      uniform float size;
      uniform float scale;
      varying float flakeAlpha;
      #include <fog_pars_vertex>
      void main(){
        vec3 p=flake.xyz*box;
        p.y-=time*fall*(.75+.5*flake.w);
        p.x+=sin(time*.6+flake.w*6.283)*.6;
        p.z+=cos(time*.5+flake.w*4.1)*.5;
        // Wrap into the box around the camera, in world space.
        vec3 corner=centre-box*.5;
        p=corner+mod(p-corner,box);
        vec4 mvPosition=modelViewMatrix*vec4(p,1.);
        float depth=max(.2,-mvPosition.z);
        gl_PointSize=clamp(size*scale/depth,1.,9.);
        // Fade at the box edges so the wrap never shows, and very close to the lens.
        vec3 q=abs(p-centre)/(box*.5);
        flakeAlpha=(1.-smoothstep(.75,1.,max(q.x,max(q.y,q.z))))*smoothstep(.3,1.2,depth);
        gl_Position=projectionMatrix*mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform float level;varying float flakeAlpha;
      #include <fog_pars_fragment>
      void main(){
        vec2 c=gl_PointCoord*2.-1.;
        float a=(1.-smoothstep(.35,1.,dot(c,c)))*flakeAlpha;
        if(a<.02)discard;
        gl_FragColor=vec4(vec3(level),a*.85);
        #include <fog_fragment>
      }`
  });
  resources.add(material);
  const points = new THREE.Points(geometry, material);
  points.name = 'garden-snowfall';
  points.frustumCulled = false;
  points.userData.dynamic = true;
  points.renderOrder = 5;
  points.visible = false;
  scene.add(points);
  let previous = null,
    elapsed = 0;
  return {
    points,
    setVisible(value) {
      points.visible = !!value;
    },
    setEconomy(value) {
      geometry.setDrawRange(0, value ? SNOWFALL.economyCount : SNOWFALL.count);
    },
    // moving is false under reduced motion: the flakes stay where they are.
    update(now, camera, viewHeight, moving = true) {
      if (!points.visible) return;
      if (moving && previous !== null) elapsed += Math.min(0.1, (now - previous) / 1000);
      previous = now;
      material.uniforms.time.value = elapsed;
      material.uniforms.centre.value.copy(camera.position);
      material.uniforms.scale.value = viewHeight;
    },
    get visible() {
      return points.visible;
    }
  };
}
