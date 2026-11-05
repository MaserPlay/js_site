// Stationary diffuse spill carries the visible pool at every viewing distance.
// The existing real-light slots now add only a small close specular/shape detail.
export const REAL_LIGHT_SHARE = 0.18;
export const SELECTION_FEATHER = 4.5;
// three runs a point light's whole BRDF for every lit pixel, though past the light's distance its term is exactly 0
// (the attenuation ends there) and a light faded out has no colour: such a pixel skips it, with the same result.
// Replaces the chunk once, before any program compiles. Idempotent.
const REACHES =
  'dot( pointLight.color, vec3( 1.0 ) ) > 0.0 && ( pointLight.distance <= 0.0 || ' +
  'dot( pointLight.position - geometryPosition, pointLight.position - geometryPosition ) < ' +
  'pointLight.distance * pointLight.distance )';
export function installLightReach(THREE) {
  const chunks = THREE.ShaderChunk,
    chunk = chunks.lights_fragment_begin,
    start = chunk.indexOf('pointLight = pointLights[ i ];'),
    end = chunk.indexOf('#pragma unroll_loop_end', start);
  if (chunk.includes(REACHES) || start < 0 || end < 0) return false;
  const loop = chunk.slice(start, end),
    close = loop.lastIndexOf('}');
  chunks.lights_fragment_begin =
    chunk.slice(0, start) +
    loop
      .slice(0, close)
      .replace('pointLight = pointLights[ i ];', `pointLight = pointLights[ i ];\n\t\tif ( ${REACHES} ) {`) +
    '}\n\t' +
    loop.slice(close) +
    chunk.slice(end);
  return true;
}
export const resolveLightStyle = value => (value === 'neon' ? 'neon' : 'natural');
export function nearestFixtures(fixtures, eye, limit = 3) {
  const ranked = fixtures
      .map(f => ({ f, d: (f.x - eye.x) ** 2 + (f.z - eye.z) ** 2 + (f.y - eye.y) ** 2 * 0.3 }))
      .sort((a, b) => a.d - b.d),
    chosen = [];
  for (const { f } of ranked) {
    if (chosen.every(other => Math.hypot(f.x - other.x, f.z - other.z) > 1.25)) chosen.push(f);
    if (chosen.length === limit) break;
  }
  return chosen;
}
// The last active light fades to zero at a selection boundary. Assignment can
// change without a bright pool teleporting; no timer or extra render loop needed.
export function weightedFixtures(fixtures, eye, limit = 3) {
  const chosen = nearestFixtures(
    fixtures.filter(f => f.power > 0),
    eye,
    limit + 1
  );
  const distance = f => Math.sqrt((f.x - eye.x) ** 2 + (f.z - eye.z) ** 2 + (f.y - eye.y) ** 2 * 0.3);
  const boundary = chosen[limit] ? distance(chosen[limit]) : Infinity;
  return chosen.slice(0, limit).map(f => {
    const t = Math.min(1, Math.max(0, (boundary - distance(f)) / SELECTION_FEATHER));
    return { fixture: f, weight: t * t * (3 - 2 * t) };
  });
}
export function fieldWeight(f, x, z) {
  const dx = x - f.x,
    dz = z - f.z,
    q = Math.hypot(dx, dz) / f.radius;
  if (q >= 1) return 0;
  // Hooded garden lamps aim across a bank/path; a dim back lobe avoids a hard cut.
  const facing = f.aim
    ? Math.max(
        0.12,
        Math.min(1, 0.52 + ((dx * f.aim.x + dz * f.aim.z) / Math.max(0.5, Math.hypot(dx, dz))) * 0.65)
      )
    : 1;
  if (f.boundary) {
    let inside = false;
    for (let i = 0, j = f.boundary.length - 1; i < f.boundary.length; j = i++) {
      const a = f.boundary[i],
        b = f.boundary[j];
      if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
    }
    if (!inside) return 0;
  }
  // Compact core approximates the close diffuse part formerly dominated by
  // camera-selected point lights. It is baked once, including distant fixtures.
  // Power-zero hooded bank/path lamps retain their existing pool exactly.
  const core =
    f.power > 0 ? Math.min(1.15, (f.power / 30) * 0.9) / (1 + (Math.hypot(dx, dz) / 1.65) ** 2) ** 1.5 : 0;
  return (f.strength + core) * (1 - q * q) ** 2 * facing;
}
// Shared, bounded light-field approximation for stationary practical fixtures.
// One RGBA8 texture lookup per surface fragment; no per-lamp fragment loop,
// shadow maps or new draw calls. It is diffuse fill, not an occlusion solution.
export function buildLightFieldData(fixtures, size = 256, extent = 64) {
  const values = new Float32Array(size * size * 4),
    weights = new Float32Array(size * size);
  for (const f of fixtures) {
    const r = f.radius,
      toPixel = v => ((v + extent) / (2 * extent)) * size - 0.5;
    const x0 = Math.max(0, Math.floor(toPixel(f.x - r))),
      x1 = Math.min(size - 1, Math.ceil(toPixel(f.x + r)));
    const z0 = Math.max(0, Math.floor(toPixel(f.z - r))),
      z1 = Math.min(size - 1, Math.ceil(toPixel(f.z + r)));
    for (let z = z0; z <= z1; z++)
      for (let x = x0; x <= x1; x++) {
        const dx = ((x + 0.5) / size) * extent * 2 - extent - f.x,
          dz = ((z + 0.5) / size) * extent * 2 - extent - f.z;
        const q = Math.hypot(dx, dz) / r;
        if (q >= 1) continue;
        const w = fieldWeight(f, f.x + dx, f.z + dz),
          i = z * size + x;
        values[i * 4 + (f.channel || 0)] += w;
        values[i * 4 + 3] += f.base * w;
        weights[i] += w;
      }
  }
  const bytes = new Uint8Array(size * size * 4);
  for (let i = 0; i < weights.length; i++) {
    for (let c = 0; c < 3; c++) bytes[i * 4 + c] = Math.round(Math.min(1, values[i * 4 + c] / 3) * 255);
    bytes[i * 4 + 3] = Math.round(
      Math.max(0, Math.min(1, ((weights[i] ? values[i * 4 + 3] / weights[i] : 0) + 8) / 16)) * 255
    );
  }
  return { bytes, size, extent };
}

export function createPracticalLighting(THREE, fixtures, materials, resources, { extent = 64 } = {}) {
  const started = performance.now(),
    field = buildLightFieldData(fixtures, 256, extent);
  const texture = new THREE.DataTexture(field.bytes, field.size, field.size, THREE.RGBAFormat);
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  resources.add(texture);
  const uniforms = {
    gardenField: { value: texture },
    gardenLightStrength: { value: 0 },
    gardenWarm: { value: new THREE.Color('#ffe0b2') },
    gardenCool: { value: new THREE.Color('#ffc18b') },
    gardenPractical: { value: new THREE.Color('#ffd39a') },
    gardenExtent: { value: field.extent }
  };
  for (const material of materials) {
    const previous = material.onBeforeCompile.bind(material),
      cacheKey = material.customProgramCacheKey();
    material.customProgramCacheKey = () => cacheKey + '-practical-field-v2';
    material.onBeforeCompile = shader => {
      previous(shader);
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader =
        'varying vec3 vGardenWorld;\n' +
        shader.vertexShader.replace(
          '#include <project_vertex>',
          `#include <project_vertex>
        vec4 gardenWorld=vec4(transformed,1.0);
        #ifdef USE_INSTANCING
          gardenWorld=instanceMatrix*gardenWorld;
        #endif
        vGardenWorld=(modelMatrix*gardenWorld).xyz;`
        );
      shader.fragmentShader =
        `varying vec3 vGardenWorld;
          uniform sampler2D gardenField;
          uniform float gardenLightStrength;
          uniform float gardenExtent;
          uniform vec3 gardenWarm;
          uniform vec3 gardenCool;
          uniform vec3 gardenPractical;
          \n` +
        shader.fragmentShader.replace(
          '#include <lights_fragment_end>',
          `#include <lights_fragment_end>
        vec2 gardenUv=(vGardenWorld.xz+gardenExtent)/(2.0*gardenExtent);
        vec4 gardenLight=texture2D(gardenField,clamp(gardenUv,0.0,1.0));
        float gardenHeight=vGardenWorld.y-(gardenLight.a*16.0-8.0);
        float gardenMask=step(0.0,gardenUv.x)*step(gardenUv.x,1.0)*step(0.0,gardenUv.y)*step(gardenUv.y,1.0);
        gardenMask*=smoothstep(-.62,-.22,gardenHeight)*(1.0-smoothstep(3.0,6.5,gardenHeight));
        vec3 gardenNormal=inverseTransformDirection(normal,viewMatrix);
        float gardenFacing=.25+.75*max(0.0,gardenNormal.y);
        vec3 gardenDiffuse=gardenWarm*gardenLight.r+gardenCool*gardenLight.g+gardenPractical*gardenLight.b;
        reflectedLight.indirectDiffuse+=diffuseColor.rgb*gardenDiffuse*3.0*gardenLightStrength*gardenMask*gardenFacing;`
        );
    };
  }
  const buildMs = performance.now() - started;
  return {
    // level fades the baked pools while islands move away from the fixtures they were baked for.
    set(style, night, level = 1) {
      uniforms.gardenLightStrength.value = (0.035 + night * (style === 'neon' ? 0.52 : 0.62)) * level;
      uniforms.gardenWarm.value.set(style === 'neon' ? '#4fd8ff' : '#ffe0b2');
      uniforms.gardenCool.value.set(style === 'neon' ? '#e27bff' : '#ffc18b');
    },
    audit: () => ({
      fixtures: fixtures.length,
      targeted: fixtures
        .filter(f => f.purpose)
        .map(({ x, y, z, base, radius, purpose, aim, power }) => ({
          x,
          y,
          z,
          base,
          radius,
          purpose,
          aim,
          power
        })),
      textureSize: field.size,
      textureExtent: field.extent,
      textureBytes: field.bytes.byteLength,
      buildMs,
      shadowMaps: 0,
      method: 'shared diffuse field + nearest real point lights'
    })
  };
}

// ---------- cast-iron lanterns ----------
// One lantern of size 1 has its glass centre at the origin (y up). Each part is a single merged geometry,
// drawn instanced for every lantern in the garden: the frame with its tray, glazing bars, ogee cap and finial;
// a turned stem for post lanterns; the four glass panes; a camera-facing glow quad. Post standards, the crook
// arm of the bank lamps and the wall bracket of the pavilion sconces are merged the same way.
export const LANTERN = {
  // Glass: half width and half height of the four panes; the frame posts sit just outside them.
  pane: { half: 0.18, height: 0.21 },
  // Top of the finial and bottom of the post stem above / below the glass centre.
  finial: 0.7,
  stemBottom: -0.75,
  // Glow quad edge per lantern size, pushed this far towards the viewer so the frame never cuts it.
  halo: { size: 1.45, lift: 0.3, near: 28, far: 70 },
  // Instance tints pick the glass colour: blue and violet follow the light style, warm stays warm.
  tint: { blue: '#ffffff', violet: '#000000', warm: '#808080' },
  // Bank lamp: a crook-arm standard, the lantern hangs `reach` out towards the water.
  crook: { reach: 0.55, hang: 1.87, size: 0.78 },
  // Pavilion sconce: the lantern hangs `reach` off the pillar face.
  sconce: { reach: 0.3, size: 0.55 }
};

// Merges [geometry, matrix, flat] parts into one position + normal geometry (flat: faceted normals).
export function mergeParts(THREE, parts) {
  const position = [],
    normal = [];
  for (const [source, matrix, flat] of parts) {
    const g = source.index ? source.toNonIndexed() : source.clone();
    g.applyMatrix4(matrix);
    if (flat) g.computeVertexNormals();
    position.push(...g.attributes.position.array);
    normal.push(...g.attributes.normal.array);
    g.dispose();
    source.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

export function createLanternGeometries(THREE) {
  const T = (x, y, z, turn = 0) =>
    new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, turn, 0)),
      new THREE.Vector3(1, 1, 1)
    );
  const I = new THREE.Matrix4();
  const box = (w, h, d, x, y, z) => [new THREE.BoxGeometry(w, h, d), T(x, y, z)];
  const square = (top, bottom, h, y, open = false) => [
    new THREE.CylinderGeometry(top, bottom, h, 4, 1, open),
    T(0, y, 0, Math.PI / 4),
    true
  ];
  const lathe = (profile, segments = 8) =>
    new THREE.LatheGeometry(
      profile.map(([r, y]) => new THREE.Vector2(r, y)),
      segments
    );
  const tube = (points, radius, segments = 10) =>
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z))),
      segments,
      radius,
      5
    );
  const { half, height } = LANTERN.pane,
    post = half + 0.006;
  const head = mergeParts(THREE, [
    box(0.44, 0.035, 0.44, 0, -height - 0.018, 0),
    // A shallow inverted pyramid under the tray and a drip knob (hidden by the stem on post lanterns).
    square(0.31, 0.085, 0.07, -height - 0.07, true),
    [new THREE.SphereGeometry(0.034, 6, 4), T(0, -height - 0.115, 0)],
    ...[-1, 1].flatMap(sx => [-1, 1].map(sz => box(0.03, 2 * height + 0.02, 0.03, sx * post, 0, sz * post))),
    // A glazing bar across each pane, a third of the way up.
    ...[-1, 1].flatMap(s => [
      box(2 * half, 0.016, 0.014, 0, -0.07, s * post),
      box(0.014, 0.016, 2 * half, s * post, -0.07, 0)
    ]),
    box(0.42, 0.05, 0.42, 0, height + 0.015, 0),
    box(0.52, 0.025, 0.52, 0, height + 0.052, 0),
    // Ogee cap: a flared lower frustum and a steeper upper one, then a neck, a ball and a spike.
    square(0.17, 0.355, 0.1, height + 0.115),
    square(0.03, 0.17, 0.13, height + 0.23),
    [new THREE.CylinderGeometry(0.035, 0.04, 0.04, 8), T(0, height + 0.315, 0)],
    [new THREE.SphereGeometry(0.045, 7, 5), T(0, height + 0.375, 0)],
    [new THREE.ConeGeometry(0.016, 0.07, 6), T(0, LANTERN.finial - 0.035, 0)]
  ]);
  // Turned cast-iron stem from the post top up into the tray.
  const stem = mergeParts(THREE, [
    [
      lathe([
        [0.062, LANTERN.stemBottom],
        [0.062, -0.45],
        [0.095, -0.43],
        [0.095, -0.4],
        [0.055, -0.38],
        [0.045, -0.335],
        [0.07, -0.3],
        [0.001, -0.29]
      ]),
      I
    ]
  ]);
  const pane = mergeParts(THREE, [square(half * Math.SQRT2, half * Math.SQRT2, 2 * height, 0, true)]);
  const halo = new THREE.PlaneGeometry(1, 1);
  // Free-standing standard (ground at y 0) whose top meets a size 1.12 lantern's stem.
  const standard = mergeParts(THREE, [
    [
      lathe([
        [0.001, 0],
        [0.26, 0],
        [0.26, 0.12],
        [0.2, 0.16],
        [0.19, 0.3],
        [0.13, 0.34],
        [0.1, 0.5],
        [0.075, 0.55],
        [0.068, 1.72],
        [0.1, 1.75],
        [0.1, 1.82],
        [0.07, 1.86],
        [0.062, 1.92],
        [0.001, 1.93]
      ]),
      I
    ]
  ]);
  // Bank lamp: turned post with a crook arm reaching towards +z and a brace under it.
  const { reach, hang, size } = LANTERN.crook,
    hook = hang + LANTERN.finial * size;
  const crook = mergeParts(THREE, [
    [
      lathe([
        [0.001, 0],
        [0.2, 0],
        [0.2, 0.09],
        [0.15, 0.12],
        [0.14, 0.24],
        [0.095, 0.28],
        [0.08, 0.42],
        [0.06, 0.46],
        [0.052, 2.1],
        [0.075, 2.13],
        [0.075, 2.19],
        [0.05, 2.22],
        [0.001, 2.23]
      ]),
      I
    ],
    [new THREE.SphereGeometry(0.05, 7, 5), T(0, 2.26, 0)],
    [
      tube(
        [
          [0, 2.18, 0],
          [0, 2.38, 0.1],
          [0, 2.47, 0.3],
          [0, 2.45, reach - 0.04],
          [0, hook + 0.005, reach]
        ],
        0.022,
        12
      ),
      I
    ],
    [
      tube(
        [
          [0, 1.86, 0.03],
          [0, 2.08, 0.12],
          [0, 2.33, 0.25]
        ],
        0.012,
        8
      ),
      I
    ]
  ]);
  // Wall bracket (wall face at z 0, lantern centre height at y 0, lantern hanging at z = reach).
  const s = LANTERN.sconce,
    top = LANTERN.finial * s.size;
  const bracket = mergeParts(THREE, [
    box(0.13, 0.42, 0.04, 0, 0.1, 0.02),
    [
      tube(
        [
          [0, 0.22, 0.03],
          [0, 0.34, 0.12],
          [0, top + 0.05, 0.24],
          [0, top + 0.005, s.reach]
        ],
        0.016,
        10
      ),
      I
    ],
    [
      tube(
        [
          [0, -0.06, 0.03],
          [0, 0.12, 0.11],
          [0, 0.3, 0.17]
        ],
        0.01,
        8
      ),
      I
    ]
  ]);
  return { head, stem, pane, halo, standard, crook, bracket };
}

// Lantern glass and glow. The panes are frosted glass by day (a pale sheen, a faint warm hint) and glow at
// night with a hot core that fades towards the frame; the glow quad adds a soft halo where there is no bloom.
// Instance tints pick the colour (LANTERN.tint). No pow/log/sqrt; divisions only by constants.
export function createLanternMaterials(THREE, { blue, violet, warm = new THREE.Color('#ffd39a') }) {
  const uniforms = {
    lanternNight: { value: 0 },
    lanternHaloGain: { value: 0 },
    lanternBlue: { value: blue },
    lanternViolet: { value: violet },
    lanternWarm: { value: warm }
  };
  const head = `uniform float lanternNight;
    uniform float lanternHaloGain;
    uniform vec3 lanternBlue;
    uniform vec3 lanternViolet;
    uniform vec3 lanternWarm;
    vec3 lanternColour(){
      float pick=1.;
    #ifdef USE_COLOR
      pick=vColor.r;
    #endif
      return mix(mix(lanternViolet,lanternWarm,step(.1,pick)),lanternBlue,step(.6,pick));
    }`;
  const { half, height } = LANTERN.pane,
    h = LANTERN.halo;
  const pane = new THREE.MeshBasicMaterial({ toneMapped: false });
  pane.name = 'lantern glass';
  pane.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
          varying vec3 vPaneLocal;
          varying vec3 vPaneView;
          varying vec3 vPaneNormal;`
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
      vPaneLocal=position;vPaneView=-mvPosition.xyz;
      {vec3 paneN=normal;
      #ifdef USE_INSTANCING
        paneN=mat3(instanceMatrix)*paneN;
      #endif
      vPaneNormal=normalMatrix*paneN;}`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
          varying vec3 vPaneLocal;
          varying vec3 vPaneView;
          varying vec3 vPaneNormal;`
      )
      .replace('#include <color_pars_fragment>', '#include <color_pars_fragment>\n' + head)
      .replace(
        '#include <color_fragment>',
        `{vec3 lamp=lanternColour();
      vec2 q=vec2(min(abs(vPaneLocal.x),abs(vPaneLocal.z))/${half.toFixed(3)},vPaneLocal.y/${height.toFixed(3)});
      float core=1.-smoothstep(0.,1.,q.x*q.x*.5+q.y*q.y*.75);
      vec3 n=normalize(vPaneNormal+vec3(0.,1e-4,0.)),v=normalize(vPaneView+vec3(0.,0.,1e-4));
      float rim=1.-abs(dot(n,v));
      // A diagonal sheen streak across each pane and a brighter rim: glass, not a painted block.
      float along=abs(vPaneLocal.x)>abs(vPaneLocal.z)?vPaneLocal.z*sign(vPaneLocal.x):-vPaneLocal.x*sign(vPaneLocal.z);
      float streak=1.-smoothstep(0.,.09,abs(along/${half.toFixed(3)}*.7+q.y*.45-.2));
      vec3 day=vec3(.3,.32,.35)+lamp*(.1+.2*core)+vec3(.42,.45,.5)*(rim*rim*.5+streak*.22);
      vec3 lit=lamp*(.3+.55*core)+vec3(1.,.86,.62)*core*core*core*.35+lamp*rim*.12+vec3(.2)*streak*.1;
      diffuseColor.rgb=mix(day,lit,lanternNight);}`
      );
  };
  pane.customProgramCacheKey = () => 'garden-lantern-glass-v1';
  const halo = new THREE.MeshBasicMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    fog: false
  });
  halo.name = 'lantern glow';
  halo.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vHaloUv;varying float vHaloFade;')
      .replace(
        '#include <project_vertex>',
        `vec4 haloCentre=vec4(0.,0.,0.,1.);float haloScale=1.;
      #ifdef USE_INSTANCING
        haloCentre=instanceMatrix*haloCentre;haloScale=length(instanceMatrix[0].xyz);
      #endif
      vec4 mvPosition=modelViewMatrix*haloCentre;
      float haloDistance=max(-mvPosition.z,1e-3);
      mvPosition.xyz+=normalize(-mvPosition.xyz+vec3(0.,0.,1e-4))*${h.lift.toFixed(2)}*haloScale;
      mvPosition.xy+=transformed.xy*haloScale*${h.size.toFixed(2)};
      gl_Position=projectionMatrix*mvPosition;
      vHaloUv=uv;vHaloFade=1.-smoothstep(${h.near.toFixed(1)},${h.far.toFixed(1)},haloDistance);`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vHaloUv;varying float vHaloFade;')
      .replace('#include <color_pars_fragment>', '#include <color_pars_fragment>\n' + head)
      .replace(
        '#include <color_fragment>',
        `{vec2 c=(vHaloUv-.5)*2.;float a=clamp(1.-dot(c,c),0.,1.);a*=a*(.3+.7*a);
      diffuseColor=vec4(lanternColour()*a*lanternHaloGain*vHaloFade,1.);}`
      );
  };
  halo.customProgramCacheKey = () => 'garden-lantern-glow-v1';
  return {
    pane,
    halo,
    uniforms,
    // night 0 by day … 1 at full night; the glow quad stays off by day.
    setNight(night) {
      const n = Math.min(1, Math.max(0, night));
      uniforms.lanternNight.value = n;
      uniforms.lanternHaloGain.value = 0.16 * n * n;
    }
  };
}
