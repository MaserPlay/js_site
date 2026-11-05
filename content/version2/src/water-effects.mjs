import { createPuffMesh } from './cloud-sea.mjs';
import { waterShaders } from './shaders/water.mjs';
import { parkMiller } from './seeded-random.mjs';

// Falling water: a parcel crosses the lip at `speed` m/s and then accelerates under a softened gravity
// (air drag), so the streaks stretch and run faster as they drop. `streaks` is the cell count across a sheet.
// Spray counts are per fall (drops off the lip, a mist veil in front of it, drops off the edges, mist at the foot);
// `core` of them stay in the economy setting.
export const FALLS = {
  speed: 3.05,
  gravity: 6.5,
  streaks: 15,
  spray: { lip: 18, lipMist: 6, edge: 8, foot: 10, core: 12 }
};

// Seconds since the water passed the lip (negative upstream): steady over the pool and channel, free fall below.
export function fallAge(distance, { speed, gravity } = FALLS) {
  return (
    Math.min(distance, 0) / speed +
    (Math.sqrt(speed * speed + 2 * gravity * Math.max(distance, 0)) - speed) / gravity
  );
}
// The same curve in GLSL is in shaders/water.mjs.

// Extra attributes follow the existing continuous pool/ledge/fall mesh.
export function flowAttributes(THREE, sections, distances, height, columns) {
  const values = [];
  for (let j = 0; j < sections.length; j++) {
    const drop = Math.max(0, -sections[j][1]),
      fall = THREE.MathUtils.smoothstep(drop, 0.12, 0.85);
    for (let k = 0; k <= columns; k++) values.push(distances[j], fall, drop / height);
  }
  return new THREE.Float32BufferAttribute(values, 3);
}
// x, y: the vertex in basin ellipse units (across, along the flow); z: how much of the outlet it belongs to; w: the pond's
// outline seed (pond-shape.mjs pondSeed), plus 2 when a stone curb rings the pond and 4 for the opt-in large pond preview.
export function lakeAttributes(THREE, geometry, center, flow, across, rx, rz, shape = 0) {
  const p = geometry.attributes.position,
    values = [];
  for (let i = 0; i < p.count; i++) {
    const delta = new THREE.Vector3().fromBufferAttribute(p, i).sub(center),
      x = delta.dot(across) / rx,
      y = delta.dot(flow) / rz;
    const outlet =
      THREE.MathUtils.smoothstep(y, 0.3, 1.1) * (1 - THREE.MathUtils.smoothstep(Math.abs(x), 0.22, 0.9));
    values.push(x, y, outlet, shape);
  }
  return new THREE.Float32BufferAttribute(values, 4);
}

export function configureWaterMaterial(material, time) {
  const quality = { value: 1 },
    glow = { value: 1 },
    // Ultra graphics: the garden round the pools as a cube map (ultra-effects.mjs), mirrored in place of the painted sky.
    reflection = { value: null },
    environment = {
      waterSkyTop: { value: material.color.clone().setRGB(0.09, 0.06, 0.34) },
      waterSkyHorizon: { value: material.color.clone().setRGB(0.72, 0.22, 0.2) },
      waterSkyLow: { value: material.color.clone().setRGB(0.29, 0.18, 0.45) },
      waterSunColor: { value: material.color.clone().setRGB(1, 0.64, 0.34) },
      waterSunStrength: { value: 1 },
      waterSunDir: { value: { x: -0.52, y: 0.03, z: -0.86, isVector3: true } }
    };
  material.customProgramCacheKey = () => 'garden-glowing-falls-v7';
  // The shader parts live in shaders/water.mjs.
  const parts = waterShaders(FALLS);
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, environment, {
      waterTime: time,
      waterQuality: quality,
      waterGlow: glow,
      waterEnv: reflection
    });
    shader.vertexShader =
      parts.vertexHead + shader.vertexShader.replace('#include <begin_vertex>', parts.beginVertex);
    shader.fragmentShader = parts.replacements.reduce(
      (text, [chunk, code]) => text.replace(chunk, code),
      parts.fragmentHead + shader.fragmentShader
    );
  };
  return {
    bindSky: sky => {
      Object.assign(environment, {
        waterSkyTop: sky.uniforms.top,
        waterSkyHorizon: sky.uniforms.horizon,
        waterSkyLow: sky.uniforms.low,
        waterSunColor: sky.uniforms.sunColor,
        waterSunStrength: sky.uniforms.sunStrength,
        ...(sky.uniforms.sunDir ? { waterSunDir: sky.uniforms.sunDir } : {})
      });
    },
    setEconomy: enabled => {
      quality.value = enabled ? 0 : 1;
      glow.value = enabled ? 0.7 : 1;
    },
    // A cube texture to mirror (Ultra), or null for the painted sky; switching remakes the water's program once.
    setReflection: texture => {
      reflection.value = texture || null;
      const on = !!texture;
      if (!!material.defines?.WATER_ENV === on) return;
      material.defines = { ...material.defines };
      if (on) material.defines.WATER_ENV = 1;
      else delete material.defines.WATER_ENV;
      material.needsUpdate = true;
    }
  };
}

// A point on the corrected curtain `drop` metres below the lip, `u` across it (0..1). Rows 7–12 of the fall
// mesh hold the real, cliff-cleared sheet; a fall without its mesh (tests) uses the nominal bowed sheet.
export function curtainPoint(THREE, fall, drop, u, target = new THREE.Vector3()) {
  const g = fall.geometry;
  if (!g)
    return target
      .copy(fall.lip)
      .addScaledVector(fall.flow, 0.42 + 0.7 * Math.sqrt(Math.min(1, Math.max(0, drop / fall.height))))
      .addScaledVector(fall.across, (u - 0.5) * fall.width * 0.55)
      .setY(fall.base - drop);
  const p = g.attributes.position,
    width = fall.columns + 1,
    rows = p.count / width,
    x = Math.min(fall.columns - 1e-6, Math.max(0, u * fall.columns)),
    k = Math.floor(x),
    f = x - k,
    y = fall.base - drop;
  let j = 7;
  while (j < rows - 2 && p.getY((j + 1) * width) > y) j++;
  const y0 = p.getY(j * width),
    y1 = p.getY((j + 1) * width),
    t = y0 === y1 ? 0 : Math.min(1, Math.max(0, (y - y0) / (y1 - y0))),
    corner = (row, column) => new THREE.Vector3().fromBufferAttribute(p, row * width + column),
    top = corner(j, k).lerp(corner(j, k + 1), f);
  return target.copy(top.lerp(corner(j + 1, k).lerp(corner(j + 1, k + 1), f), t));
}

// Spray drops for every fall: start, velocity, lifetime and look per drop. Drops arc off the lip under a thin
// mist veil, peel off the curtain edges and puff into mist where the sheet breaks up. The first `core` drops
// of each fall come first, so the economy setting can draw a prefix. Deterministic: no scenery RNG.
export function sprayLayout(THREE, outlets, { lip, lipMist, edge, foot, core } = FALLS.spray) {
  const up = new THREE.Vector3(0, 1, 0),
    perFall = outlets.map((fall, i) => {
      const random = parkMiller(((i + 1) * 7919) % 2147483646),
        order = [],
        drops = [];
      // Kinds: 0 lip drop, 1 edge drop, 2 foot mist, 3 lip mist; interleaved so any prefix holds all four.
      for (let n = 0; n < Math.max(lip, lipMist, edge, foot); n++) {
        if (n < lip) order.push(0);
        if (n < foot) order.push(2);
        if (n < edge) order.push(1);
        if (n < lipMist) order.push(3);
      }
      order.forEach((kind, n) => {
        const r = [random(), random(), random(), random()],
          velocity = new THREE.Vector3();
        let start;
        if (kind === 0) {
          // Lip: thrown a little out and up from the tearing sheet.
          start = curtainPoint(THREE, fall, 0.15 + 0.5 * r[0], 0.08 + 0.84 * r[1]);
          velocity
            .copy(fall.flow)
            .multiplyScalar(0.35 + 0.9 * r[2])
            .addScaledVector(fall.across, (r[3] - 0.5) * 0.9)
            .addScaledVector(up, 0.25 + 0.6 * r[0]);
        } else if (kind === 1) {
          // Edges: drops peel sideways off the ragged sheet and fall away.
          const side = n % 2 ? 1 : -1;
          start = curtainPoint(THREE, fall, fall.height * (0.04 + 0.6 * r[0]), side > 0 ? 0.985 : 0.015);
          velocity
            .copy(fall.across)
            .multiplyScalar(side * (0.15 + 0.45 * r[1]))
            .addScaledVector(fall.flow, 0.1 + 0.35 * r[2])
            .addScaledVector(up, -(1.5 + 2.5 * r[3]));
        } else if (kind === 3) {
          // Lip mist: a thin veil drifting just in front of the white water at the top.
          start = curtainPoint(THREE, fall, 0.4 + 2 * r[0], 0.15 + 0.7 * r[1]);
          velocity
            .copy(fall.flow)
            .multiplyScalar(0.3 + 0.5 * r[2])
            .addScaledVector(fall.across, (r[3] - 0.5) * 1)
            .addScaledVector(up, -0.2 + 0.5 * r[0]);
        } else {
          // Foot: soft mist billows out where the curtain breaks up.
          start = curtainPoint(THREE, fall, fall.height * (0.58 + 0.3 * r[0]), 0.1 + 0.8 * r[1]);
          velocity
            .copy(fall.flow)
            .multiplyScalar(0.4 + 1.2 * r[2])
            .addScaledVector(fall.across, (r[3] - 0.5) * 1.6)
            .addScaledVector(up, -0.4 + 0.9 * r[0]);
        }
        drops.push({
          start,
          velocity,
          life: [1.1 + 0.6 * r[3], 1.3 + 0.8 * r[2], 2.2 + 1.4 * r[1], 2 + r[3]][kind],
          seed: random(),
          size: [0.03 + 0.03 * r[1], 0.04 + 0.04 * r[0], 0.32 + 0.4 * r[2], 0.45 + 0.4 * r[2]][kind],
          gravity: [5.5, 4, 0.4, 0.3][kind],
          kind
        });
      });
      return drops;
    });
  const all = [],
    longest = Math.max(0, ...perFall.map(d => d.length));
  for (let n = 0; n < longest; n++) for (const drops of perFall) if (n < drops.length) all.push(drops[n]);
  return {
    count: all.length,
    core: perFall.reduce((sum, drops) => sum + Math.min(core, drops.length), 0),
    position: Float32Array.from(all.flatMap(d => d.start.toArray())),
    motion: Float32Array.from(all.flatMap(d => [...d.velocity.toArray(), d.life])),
    shape: Float32Array.from(all.flatMap(d => [d.seed, d.size, d.gravity, d.kind]))
  };
}

// One Points draw for all falls: each drop flies a ballistic arc computed on the GPU from its start, velocity
// and lifetime, so nothing moves on the CPU per frame. Drops twinkle in sunlight and glow faintly blue at night.
export function createFallSpray(THREE, { outlets, time, resources, lit, shade, sunStrength, sunColor }) {
  const layout = sprayLayout(THREE, outlets),
    geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(layout.position, 3));
  geometry.setAttribute('sprayMotion', new THREE.BufferAttribute(layout.motion, 4));
  geometry.setAttribute('sprayShape', new THREE.BufferAttribute(layout.shape, 4));
  resources.add(geometry);
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    { pointScale: { value: 450 }, glowColor: { value: new THREE.Color(0x7fb6ff) } }
  ]);
  Object.assign(uniforms, { time, lit, shade, sunStrength, sunColor });
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    fog: true,
    vertexShader: `attribute vec4 sprayMotion;
      attribute vec4 sprayShape;
      uniform float time;
      uniform float pointScale;
      varying float vAlpha;
      varying float vMist;
      varying float vTwinkle;
      #include <fog_pars_vertex>
      void main(){
        float life=sprayMotion.w,cycle=time/life+sprayShape.x,age=fract(cycle),t=age*life;
        // Each cycle throws the drop a little harder or softer, so the arcs do not repeat exactly.
        float jitter=fract(sin(floor(cycle)*12.9898+sprayShape.x*78.233)*43758.5453);
        vec3 p=position+sprayMotion.xyz*(.75+.5*jitter)*t;
        p.y-=.5*sprayShape.z*t*t;
        vec4 mvPosition=modelViewMatrix*vec4(p,1.);
        float pixels=sprayShape.y*pointScale/max(-mvPosition.z,.1);
        gl_PointSize=clamp(pixels,1.5,64.);
        // Kinds 2 and 3 are soft mist; drops are small and bright, the lip veil the faintest.
        float kind=sprayShape.w,
            kindAlpha=mix(mix(.75,.8,step(.5,kind)),mix(.3,.2,step(2.5,kind)),step(1.5,kind));
        vMist=step(1.5,kind);
        vAlpha=smoothstep(0.,.12,age)*(1.-smoothstep(.6,1.,age))*clamp(pixels/1.5,0.,1.)*kindAlpha;
        vTwinkle=(1.-vMist)*smoothstep(.9,1.,sin(time*7.3+sprayShape.x*91.));
        gl_Position=projectionMatrix*mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform vec3 lit;
      uniform vec3 shade;
      uniform float sunStrength;
      uniform vec3 sunColor;
      uniform vec3 glowColor;
      varying float vAlpha;
      varying float vMist;
      varying float vTwinkle;
      #include <fog_pars_fragment>
      void main(){
        vec2 c=gl_PointCoord*2.-1.;
        float r=dot(c,c);
        if(r>1.)discard;
        float shape=mix(1.-smoothstep(.2,1.,r),(1.-r)*(1.-r),vMist);
        // Spray is near-neutral white at the scene's brightness, not the warm cloud tint.
        vec3 base=mix(shade,lit,.35+.55*sunStrength);
        vec3 color=mix(base,vec3(dot(base,vec3(.3,.59,.11)))*vec3(.94,.98,1.04),.7)*1.15+vec3(.14,.20,.30)*
            (.5+.5*sunStrength)*vMist+glowColor*(.12+.25*(1.-sunStrength))*(1.-.5*vMist);
        color+=sunColor*vTwinkle*sunStrength*2.4;
        gl_FragColor=vec4(color,shape*vAlpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
      }`
  });
  resources.add(material);
  const points = new THREE.Points(geometry, material),
    size = new THREE.Vector2();
  points.name = 'garden-fall-drops';
  points.frustumCulled = false;
  points.userData.dynamic = true;
  points.renderOrder = 3;
  // Points are sized in pixels: follow the render height and the camera's vertical zoom.
  points.onBeforeRender = (renderer, scene, camera) => {
    const target = renderer.getRenderTarget();
    uniforms.pointScale.value =
      (target ? target.height : renderer.getDrawingBufferSize(size).y) *
      0.5 *
      camera.projectionMatrix.elements[5];
  };
  return {
    points,
    count: layout.count,
    core: layout.core,
    setEconomy: enabled => geometry.setDrawRange(0, enabled ? layout.core : Infinity)
  };
}

export function createFallMist(THREE, scene, resources, backdrop, outlets, time = null) {
  const puffs = [];
  outlets.forEach((fall, i) => {
    for (let j = 0; j < 5; j++) {
      const a = i * 1.7 + j * 2.4,
        spread = fall.width * (0.45 + 0.25 * j),
        p = (fall.bottom || fall.lip)
          .clone()
          .addScaledVector(fall.flow, (fall.bottom ? 0 : 1.15) + Math.cos(a) * spread * 0.5)
          .addScaledVector(fall.across, Math.sin(a) * spread);
      puffs.push({
        x: p.x,
        y: fall.base - fall.height * (0.8 + 0.05 * j),
        z: p.z,
        size: fall.width * (1.1 + 0.35 * j) + 1.2,
        seed: (i * 7.31 + j * 3.17) % 1
      });
    }
  });
  const { mesh, material, geometry } = createPuffMesh(THREE, {
    puffs,
    resources,
    name: 'garden-fall-spray',
    glow: 0.55,
    drift: 0
  });
  material.uniforms.shade = backdrop.cloudMaterial.uniforms.tint;
  material.uniforms.lit = backdrop.cloudMaterial.uniforms.warm;
  material.uniforms.sunStrength = backdrop.cloudMaterial.uniforms.sunStrength;
  material.uniforms.time = backdrop.cloudMaterial.uniforms.drift || material.uniforms.time;
  mesh.renderOrder = 2;
  scene.add(mesh);
  // Drops ride on the mist mesh, so hiding it during island transitions hides them too.
  const spray = time
    ? createFallSpray(THREE, {
        outlets,
        time,
        resources,
        lit: backdrop.cloudMaterial.uniforms.warm,
        shade: backdrop.cloudMaterial.uniforms.tint,
        sunStrength: backdrop.cloudMaterial.uniforms.sunStrength,
        sunColor: backdrop.skyMaterial?.uniforms.sunColor || { value: new THREE.Color(1, 0.86, 0.66) }
      })
    : null;
  if (spray) mesh.add(spray.points);
  return {
    mesh,
    spray,
    get count() {
      return geometry.instanceCount;
    },
    get sprayCount() {
      return spray ? Math.min(spray.count, spray.points.geometry.drawRange.count) : 0;
    },
    setEconomy: enabled => {
      geometry.instanceCount = enabled ? outlets.length * 2 : puffs.length;
      spray?.setEconomy(enabled);
    }
  };
}
