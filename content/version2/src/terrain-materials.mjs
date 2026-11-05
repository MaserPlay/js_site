// Surface detail uses existing geometry and the existing ground canvas texture.
// Local cliff coordinates survive the static merge; season changes only uniforms.
import { parkMiller } from './seeded-random.mjs';
// soil: island cliffs show a dark root-streaked soil band under the turf lip (local y above SOIL_FOOT);
// boulders share the shader with it switched off.
const SOIL_FOOT = -0.3;
// moss: how much moss grows on it (boulders carry less than island cliffs).
export function configureCliffMaterial(material, groundColor, { soil = false, moss: mossScale = 1 } = {}) {
  const mossColor = { value: groundColor.clone().multiplyScalar(0.55) },
    mossStrength = { value: mossScale },
    soilStrength = { value: soil ? 1 : 0 };
  material.customProgramCacheKey = () => 'garden-cliff-basalt-v3';
  material.onBeforeCompile = shader => {
    shader.uniforms.mossColor = mossColor;
    shader.uniforms.mossStrength = mossStrength;
    shader.uniforms.soilStrength = soilStrength;
    shader.vertexShader =
      'attribute vec3 terrainPoint;varying vec3 vTerrainPoint;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvTerrainPoint=terrainPoint;'
      );
    shader.fragmentShader =
      `
        uniform vec3 mossColor;
        uniform float mossStrength,soilStrength;
        varying vec3 vTerrainPoint;
        // Hash without Sine, David Hoskins (third-party-notices.txt).
        float cliffHash(vec2 p){
          vec3 q=fract(vec3(p.xyx)*.1031);
          q+=dot(q,q.yzx+33.33);
          return fract((q.x+q.y)*q.z);
        }
        float cliffNoise(vec2 p){
          vec2 i=floor(p),f=fract(p);
          f=f*f*(3.-2.*f);
          return mix(mix(cliffHash(i),cliffHash(i+vec2(1.,0.)),f.x),
              mix(cliffHash(i+vec2(0.,1.)),cliffHash(i+vec2(1.)),f.x),f.y);
        }
        // Hash without Sine, David Hoskins (third-party-notices.txt).
        float cliffHash3(vec3 p){
          p=fract(p*.1031);
          p+=dot(p,p.zyx+31.32);
          return fract((p.x+p.y)*p.z);
        }
        float cliffNoise3(vec3 p){
          vec3 i=floor(p),f=fract(p);
          f=f*f*(3.-2.*f);
          return mix(mix(mix(cliffHash3(i),cliffHash3(i+vec3(1,0,0)),f.x),
              mix(cliffHash3(i+vec3(0,1,0)),cliffHash3(i+vec3(1,1,0)),f.x),f.y),
              mix(mix(cliffHash3(i+vec3(0,0,1)),cliffHash3(i+vec3(1,0,1)),f.x),
              mix(cliffHash3(i+vec3(0,1,1)),cliffHash3(i+vec3(1,1,1)),f.x),f.y),f.z);
        }
        // Rock relief: vertical basalt grain plus fractured detail, in local cliff metres.
        float cliffRelief(vec3 p){
          return cliffNoise3(p*vec3(1.7,.32,1.7))*.55+cliffNoise3(p*vec3(4.1,1.3,4.1)+3.1)*.3+
              cliffNoise3(p*vec3(11.,6.,11.)+7.7)*.15;
        }
        vec3 cliffBump(vec3 surf,vec3 n,vec2 dh,float side){
          vec3 sx=normalize(dFdx(surf)),sy=normalize(dFdy(surf)),r1=cross(sy,n),r2=cross(n,sx);
          float det=dot(sx,r1)*side;
          return normalize(abs(det)*n-sign(det)*(dh.x*r1+dh.y*r2));
        }
` +
      shader.fragmentShader
        .replace(
          '#include <color_fragment>',
          `
            #include <color_fragment>
            vec2 terrain=vTerrainPoint.xz;
            float broad=cliffNoise(terrain*.48),detail=cliffNoise(terrain*1.65+7.3);
            float growth=broad*.68+detail*.32;
            float reach=.10+.92*smoothstep(.30,.76,growth);
            // Moss starts below the soil band on island cliffs and grows in patches and trails, not as a band.
            float drop=max(0.,-vTerrainPoint.y+${SOIL_FOOT.toFixed(2)}*soilStrength);
            float patches=smoothstep(.36,.7,cliffNoise(terrain*.85+vec2(vTerrainPoint.y*.45,5.1)));
            float moss=(1.-smoothstep(reach-.25,reach+.2,drop+(detail-.5)*.3))*mossStrength*.7*
                (.15+.85*patches)*(.22+.78*smoothstep(.30,.68,broad));
            float relief=cliffRelief(vTerrainPoint);
            diffuseColor.rgb*=(.97+.06*broad)*(.62+.62*relief);
            // A muted, greyed green over the rock, not paint.
            vec3 mossTone=mix(mossColor,vec3(dot(mossColor,vec3(.3,.59,.11))),.35)*(.91+.18*detail);
            diffuseColor.rgb=mix(diffuseColor.rgb,mossTone,moss);
            // Soil band: dark earth with root streaks under the turf (whose cut edge carries on the same earth), its
            // foot ragged and fading into the rock over half a metre instead of ending on a line.
            float fibre=cliffNoise(terrain*9.+3.7)*.6+cliffNoise(terrain*23.)*.4;
            float soil=soilStrength*
                smoothstep(${(SOIL_FOOT - 0.4).toFixed(2)},${(SOIL_FOOT + 0.1).toFixed(2)},vTerrainPoint.y+
                (detail-.5)*.45+(fibre-.5)*.12);
            vec3 soilTone=vec3(.10,.068,.045)*(.55+.8*fibre)*(.85+.3*broad);
            soilTone=mix(diffuseColor.rgb*.55,soilTone,smoothstep(0.,.6,soil));
            diffuseColor.rgb=mix(diffuseColor.rgb,soilTone,soil);
            moss=max(moss,soil);
`
        )
        .replace(
          '#include <roughnessmap_fragment>',
          '#include <roughnessmap_fragment>\nroughnessFactor=mix(.80+.16*relief,.99,moss);'
        )
        .replace(
          '#include <normal_fragment_maps>',
          '#include <normal_fragment_maps>\nnormal=cliffBump(-vViewPosition,normal,vec2(dFdx(relief),dFdy(relief))*(1.6-moss*1.1),faceDirection);'
        );
  };
  return season => {
    mossColor.value.copy(groundColor).multiplyScalar(0.55);
    mossStrength.value = (season === 'winter' ? 0.23 : 1) * mossScale;
  };
}

// The turf slab's cut edge. Its side wall carries turfDepth (0 at the top ring, 1 at the bottom): a ragged fringe
// of grass over dark earth and roots that runs on into the cliff's soil band, instead of the lawn texture smeared
// down a vertical face. Surfaces without the attribute read 0: plain lawn.
export function configureTurfEdge(material) {
  material.defaultAttributeValues = { ...(material.defaultAttributeValues || {}), turfDepth: [0] };
  const previous = material.onBeforeCompile.bind(material);
  material.customProgramCacheKey = () => 'garden-turf-edge-v1';
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer);
    shader.vertexShader =
      `attribute float turfDepth;
        varying float vTurfDepth;
        varying vec3 vTurfWorld;
` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvTurfDepth=turfDepth;vTurfWorld=(modelMatrix*vec4(transformed,1.)).xyz;'
      );
    shader.fragmentShader =
      `varying float vTurfDepth;
        varying vec3 vTurfWorld;
        // Hash without Sine, David Hoskins (third-party-notices.txt).
        float turfHash(vec2 p){
          vec3 q=fract(vec3(p.xyx)*.1031);
          q+=dot(q,q.yzx+33.33);
          return fract((q.x+q.y)*q.z);
        }
        float turfNoise(vec2 p){
          vec2 i=floor(p),f=fract(p);
          f=f*f*(3.-2.*f);
          return mix(mix(turfHash(i),turfHash(i+vec2(1.,0.)),f.x),
              mix(turfHash(i+vec2(0.,1.)),turfHash(i+vec2(1.)),f.x),f.y);
        }
` +
      shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        #ifdef USE_MAP
          // Close-up detail: the lawn tile spans some 13 m, so the same blades again at 5.3x, as a ratio to the
          // local mean (a blurred mip), crisp near the camera and averaging out in the distance.
          float fineLuma=dot(texture2D(map,vMapUv*5.3+vec2(.37,.11)).rgb,vec3(.299,.587,.114));
          float meanLuma=dot(texture2D(map,vMapUv*5.3+vec2(.37,.11),6.).rgb,vec3(.299,.587,.114));
          diffuseColor.rgb*=mix(1.,clamp(fineLuma/max(meanLuma,.04),.6,1.4),.55*(1.-vTurfDepth));
        #endif
        if(vTurfDepth>.001){
          vec2 q=vTurfWorld.xz*2.6+vec2(vTurfWorld.y*3.1,0.);
          float n=turfNoise(q)*.6+turfNoise(q*3.3+1.7)*.4;
          // A few centimetres of grass hanging over the edge, ragged, then earth with pale roots.
          float fringe=1.-smoothstep(.1,.42,vTurfDepth+(n-.5)*.4);
          float roots=turfNoise(vec2(q.x*6.,vTurfWorld.y*14.))*.5+turfNoise(q*11.)*.5;
          vec3 earth=vec3(.10,.068,.045)*(.6+.75*roots);
          diffuseColor.rgb=mix(earth,diffuse*(.62+.5*n),fringe);
        }`
      );
  };
}

// Periodic (tile n) hash and value noise shared by the ground painters: seamless across the tile edges.
const tileHash = (x, y, n) => {
  x = ((x % n) + n) % n;
  y = ((y % n) + n) % n;
  let q = (x * 374761393 + y * 668265263 + 1907) | 0;
  q = Math.imul(q ^ (q >>> 13), 1274126177);
  return ((q ^ (q >>> 16)) >>> 0) / 4294967295;
};
const tileNoise = (x, y, n) => {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    sx = x - ix,
    sy = y - iy,
    u = sx * sx * (3 - 2 * sx),
    v = sy * sy * (3 - 2 * sy),
    a = tileHash(ix, iy, n),
    b = tileHash(ix + 1, iy, n),
    c = tileHash(ix, iy + 1, n),
    d = tileHash(ix + 1, iy + 1, n);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
};

// Periodic broad soil/grass mottling, without repeated bright speckles or round stamps.
export function paintGroundTexture(context) {
  const noise = tileNoise;
  const image = context.createImageData(256, 256),
    data = image.data;
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 256; x++) {
      const field =
        noise((x / 256) * 3, (y / 256) * 3, 3) * 0.62 +
        noise((x / 256) * 7, (y / 256) * 7, 7) * 0.28 +
        noise((x / 256) * 19, (y / 256) * 19, 19) * 0.1;
      const tone = 0.75 + field * 0.5,
        dry = Math.max(0, (field - 0.54) * 0.25),
        i = (y * 256 + x) * 4;
      data[i] = 187 * tone + dry * 48;
      data[i + 1] = 199 * tone;
      data[i + 2] = 196 * tone - dry * 32;
      data[i + 3] = 255;
    }
  context.putImageData(image, 0, 0);
}

// Tileable lawn, neat rather than scribbled (owner, 2026-10-27): soft broad mottling, a few darker clumps for
// depth, and a dense fine nap of short thin blades that all lean roughly one way, like a kept lawn, in low
// contrast. Neutral tones: the season colour of the ground material tints it.
export function paintGrassTexture(context, size = 512) {
  const noise = tileNoise;
  const image = context.createImageData(size, size),
    data = image.data;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const field =
        noise((x / size) * 3, (y / size) * 3, 3) * 0.55 +
        noise((x / size) * 7, (y / size) * 7, 7) * 0.27 +
        noise((x / size) * 23, (y / size) * 23, 23) * 0.18;
      const tone = 0.73 + field * 0.42,
        dry = Math.max(0, (field - 0.6) * 0.28),
        i = (y * size + x) * 4;
      data[i] = 182 * tone + dry * 52;
      data[i + 1] = 198 * tone + dry * 10;
      data[i + 2] = 186 * tone - dry * 30;
      data[i + 3] = 255;
    }
  context.putImageData(image, 0, 0);
  const random = parkMiller(48271);
  // Everything is drawn again across the tile's edges, so the texture repeats without seams.
  const wrapped = (x, y, reach, draw) => {
    for (const dx of [0, -size, size])
      for (const dy of [0, -size, size]) {
        const x0 = x + dx,
          y0 = y + dy;
        if (x0 >= -reach && x0 <= size + reach && y0 >= -reach && y0 <= size + reach) draw(x0, y0);
      }
  };
  // Darker clumps: soft round shadows a blade-length or two across.
  for (let k = 0; k < GRASS.clumps; k++) {
    const x = random() * size,
      y = random() * size,
      radius = (0.012 + random() * 0.02) * size,
      depth = 0.07 + 0.06 * random();
    wrapped(x, y, radius, (x0, y0) => {
      const shade = context.createRadialGradient(x0, y0, 0, x0, y0, radius);
      shade.addColorStop(0, `rgba(36,52,40,${depth})`);
      shade.addColorStop(1, 'rgba(36,52,40,0)');
      context.fillStyle = shade;
      context.fillRect(x0 - radius, y0 - radius, radius * 2, radius * 2);
    });
  }
  // The nap: short thin blades leaning one way (± a little), dark and light in turn.
  context.lineCap = 'round';
  for (let k = 0; k < (size * size) / GRASS.density; k++) {
    const x = random() * size,
      y = random() * size,
      length = (GRASS.blade[0] + random() * (GRASS.blade[1] - GRASS.blade[0])) * (size / 512),
      angle = GRASS.lean + (random() - 0.5) * GRASS.spread,
      dark = random() < 0.55,
      bend = (random() - 0.5) * 0.8;
    context.strokeStyle = dark
      ? `rgba(38,56,42,${0.08 + 0.09 * random()})`
      : `rgba(232,244,222,${0.06 + 0.08 * random()})`;
    context.lineWidth = (0.55 + random() * 0.45) * (size / 512);
    wrapped(x, y, 8, (x0, y0) => {
      context.beginPath();
      context.moveTo(x0, y0);
      context.quadraticCurveTo(
        x0 + Math.sin(angle) * length * 0.5 + bend,
        y0 - Math.cos(angle) * length * 0.5,
        x0 + Math.sin(angle) * length,
        y0 - Math.cos(angle) * length
      );
      context.stroke();
    });
  }
}
// The lawn's nap: one blade per `density` pixels, blades `blade` px long (at 512 px), leaning `lean` rad
// (± spread/2), and the darker clumps under it.
export const GRASS = { density: 9, blade: [2.2, 5], lean: -0.35, spread: 1.5, clumps: 70 };
