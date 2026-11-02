// The portal gate, after the owner's reference: a living energy ring (pocket-portal.mjs 'flame': turquoise
// and pink-violet flames round a white-hot core) burning round a deep vortex membrane (parallax starfield,
// spiral arms, dark well), wisps drawn into the centre and light spilled on the dais. The old stone halo stays
// only as an invisible pick target; its carved runes, crystals and floating arc segments are gone.
// Contract with world.mjs: the membrane centre is the travel point (portalGeometry.center), the membrane and
// halo are pickable, `effect` carries the time/surge/swirl/glow uniforms (shared by every gate shader).
import { createPocketPortal } from './pocket-portal.mjs';

export const GATE = {
  halo: [1.38, 1.66],
  depth: 0.26,
  membrane: 1.37,
  // The outer bound the (invisible) halo stays inside.
  segments: 1.96,
  dais: 1.55,
  floorRing: 1.72,
  innerRing: 0.98,
  glowDisc: 2.25
};
// Wisps flowing in, embers thrown off the ring, and how far the gate is seen as "near" (full frame rate).
const WISPS = 90,
  EMBERS = 140,
  NEAR = 34;
// The energy ring stands just outside the membrane; its flames swell with hover, charge and activation.
const FLAME = { radius: 1.5, offset: 0.03, rest: 1, swell: 0.3 };
// Volume (owner, round 2: the portal read flat and all but vanished from the side): the vortex membrane dips into
// a bowl `depth` metres deep, and a glowing hoop (tube radius) runs round the flame ring, still a ring edge-on.
// Round 4 (still a thin sliver edge-on): a thicker hoop and a lens of light, a flattened glowing shell round the
// ring whose rim lights where it turns away from the eye (faint head-on, a bright ellipse from the side).
const VOLUME = { depth: 0.6, rings: 12, hoop: 0.13, lens: 0.55 };
// Hover and approach ease in over ~0.2 s; the activation flash fades over ~0.7 s.
const HOVER_RATE = 6,
  FLASH_FADE = 1.4,
  // The destination tint crossfades over ~0.4 s when the chooser changes selection.
  TINT_RATE = 5;

// Membrane colour model, shared by the shader and tests. Only sin/exp/smoothstep/fract: bloom-safe.
export const MEMBRANE_FRAGMENT = `varying vec2 coord;
  varying vec3 vView;
  uniform float time;
  uniform float surge;
  uniform float swirl;
  uniform float glow;
  uniform vec4 tint;
  uniform sampler2D preview;
  uniform float previewMix;
  uniform float previewAspect;
  float gateHash(vec2 p){
    return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);
  }
  float gateNoise(vec2 p){
    vec2 i=floor(p),f=fract(p);
    f=f*f*(3.-2.*f);
    return mix(mix(gateHash(i),gateHash(i+vec2(1.,0.)),f.x),
        mix(gateHash(i+vec2(0.,1.)),gateHash(i+vec2(1.,1.)),f.x),f.y);
  }
  mat2 gateRot(float a){
    float c=cos(a),s=sin(a);
    return mat2(c,-s,s,c);
  }
  vec3 gateStars(vec2 p,float scale,float seed){
    vec2 c=p*scale,id=floor(c),f=fract(c)-.5;
    float h=gateHash(id+seed);
    return vec3(.82,.86,1.)*step(.93,h)*smoothstep(.17,0.,length(f))*(.6+.4*sin(time*2.4+h*40.));
  }
  void main(){
    float r=length(coord),t=time*.35+swirl;
    // Layers behind the surface shift against the view: the sky inside reads as deep, not painted on.
    vec3 v=normalize(vView);
    vec2 par=v.xy/max(abs(v.z),.3);
    vec2 far=coord-par*.5,mid=coord-par*.24;
    float a=atan(coord.y,coord.x+1e-5);
    // A deep starry well (the owner's vortex reference): near black at the centre, indigo towards the rim.
    vec3 color=mix(vec3(.01,.008,.04),vec3(.07,.03,.2),smoothstep(.15,1.,r));
    vec2 q=gateRot(t*.18)*far;
    float neb=gateNoise(q*1.8+3.)*.6+gateNoise(q*4.1)*.4;
    color+=mix(vec3(.08,.14,.5),vec3(.42,.1,.5),neb)*smoothstep(.45,.9,neb)*.45;
    color+=gateStars(gateRot(t*.12)*far,15.,0.)*.9+gateStars(gateRot(t*.3)*mid,9.,7.)*.6;
    // Two painterly spiral arms sweep into the well: turquoise crests over violet, torn by turbulence, twisting
    // harder towards the centre and fading at the dark core and just inside the rim.
    float twist=t*1.1+(1.-r)*(4.6+surge*3.+glow*1.4);
    vec2 p=gateRot(twist)*(coord-par*.06);
    float n=gateNoise(p*2.4+vec2(t*.15,0.))*.55+gateNoise(p*5.1-vec2(0.,t*.2))*.3+gateNoise(p*10.5)*.15;
    // Arms stay under the glow threshold (only their crests and the motes bloom), with dark gaps between them.
    float s=.5+.5*sin(a*2.+(1.-r)*7.+t*2.2+n*2.4),body=smoothstep(.22,.55,r)*(1.-smoothstep(.82,1.,r));
    float arms=smoothstep(.42,.95,s)*body,crest=smoothstep(.8,.98,s)*body;
    vec3 cyan=vec3(.22,.92,1.),violet=vec3(.5,.22,.95),pink=vec3(1.,.42,.9);
    color=mix(color,mix(violet,cyan,smoothstep(.3,.85,n))*(.38+.42*n),arms*.9);
    color+=cyan*crest*.35+pink*smoothstep(.58,.86,n)*(1.-arms)*body*.3;
    // Glowing motes ride the spiral inwards: a polar grid sliding towards the centre, a blob in some cells.
    vec2 grid=vec2((a+(1.-r)*4.+t*.8)/6.2831853*22.,r*5.-t*.9),cell=floor(grid);
    vec2 f=fract(grid)-.5-(vec2(gateHash(cell+1.3),gateHash(cell+5.9))-.5)*.4;
    float size=.1+.2*gateHash(cell+7.7),mote=step(.78,gateHash(cell+3.1))*
        (1.-smoothstep(size*.3,size,length(f*vec2(1.,1.7))));
    color+=mix(vec3(1.,.82,.95),vec3(.35,.95,1.),gateHash(cell+9.2))*mote*body*(1.1+surge);
    // The chosen destination's accent runs through the arms (tint.a eases in from the chooser).
    color+=tint.rgb*tint.a*(arms*(.35+.4*n)+crest*.3)*(1.+surge*.6);
    // A dark core with a pin of light at its bottom; hover and the charge brighten the whole vortex.
    color*=mix(.15,1.,smoothstep(0.,.45,r));
    // The charge lights the vortex, but only a little: the black hole of the crossing is born in its centre.
    color+=vec3(.85,.8,1.)*exp(-r*r*(26.-surge*10.))*(.1+surge*.55+glow*.4);
    color*=.85+surge*.45+glow*.25;
    // The lip is added after the boost so hover and activation never turn it into a white band.
    color+=vec3(.3,.85,1.)*smoothstep(.86,1.,r)*(.3+glow*.2+surge*.25);
    // Picked as seen on screen; the frame is lit in linear light.
    vec3 lit=color*color;
    // The chosen project looks through a round window in the middle of the vortex: its edge swirls, and the twist
    // unwinds as the picture arrives (previewMix eases in with the choice). The picture fills the window (cover).
    if(previewMix>.001){
      float win=1.-smoothstep(.34,.62,r+.07*(n-.5));
      vec2 w=gateRot((1.-r)*2.4*(1.-previewMix))*coord/1.24;
      vec2 uv=.5+(previewAspect>1.?vec2(w.x/previewAspect,w.y):vec2(w.x,w.y*previewAspect));
      vec3 picture=texture2D(preview,uv).rgb;
      lit=mix(lit,picture*.9+lit*.2,win*previewMix);
    }
    gl_FragColor=vec4(lit,1.);
  #include <colorspace_fragment>
  }`;
const MEMBRANE_VERTEX = `varying vec2 coord;
  varying vec3 vView;
  void main(){
    coord=uv*2.-1.;
    vec4 world=modelMatrix*vec4(position,1.);
    vec3 toEye=cameraPosition-world.xyz;
    vView=vec3(dot(toEye,normalize(modelMatrix[0].xyz)),dot(toEye,normalize(modelMatrix[1].xyz)),
        dot(toEye,normalize(modelMatrix[2].xyz)));
    gl_Position=projectionMatrix*viewMatrix*world;
  }`;

// Wisps: each spirals in from outside the ring to the centre and is reborn; all motion in the shader.
export const WISP_VERTEX = `attribute vec3 seed;
  uniform float flow;
  uniform float height;
  varying float vAlpha;
  varying float vHue;
  void main(){
    float life=fract(seed.y+flow*(.7+.6*seed.z)),k=1.-life;
    float r=.1+(2.75+.5*seed.z)*k*k,ang=seed.x+life*life*4.2+flow*.25;
    vec4 mv=modelViewMatrix*vec4(cos(ang)*r,sin(ang)*r,(seed.z-.5)*1.5*k,1.);
    gl_Position=projectionMatrix*mv;
    vAlpha=smoothstep(0.,.2,life)*(1.-smoothstep(.86,1.,life));
    vHue=seed.z;
    gl_PointSize=clamp((.03+.045*k)*projectionMatrix[1][1]*height*.5/max(.1,-mv.z),1.,22.);
  }`;
const WISP_FRAGMENT = `varying float vAlpha;
  varying float vHue;
  uniform float glow;
  uniform float surge;
  void main(){
    vec2 c=gl_PointCoord-.5;
    float a=smoothstep(.25,0.,dot(c,c))*vAlpha;
    vec3 hue=mix(vec3(.35,.92,1.),vec3(.95,.5,1.),vHue);
    gl_FragColor=vec4(hue*hue*(.8+glow*.4+surge*.7),a);
  }`;
// Embers: sparks thrown off the burning ring, drifting out and up and fading, turquoise or pink as the flames
// where they leave (`spin` is the ring's turn); all motion in the shader.
export const EMBER_VERTEX = `attribute vec3 seed;
  uniform float flow;
  uniform float height;
  uniform float spin;
  uniform float time;
  varying float vAlpha;
  varying vec3 vColor;
  void main(){
    float life=fract(seed.y+flow*(.45+.6*seed.z)),dir=seed.z>.5?1.:-1.;
    float ang=seed.x+dir*life*(.2+.35*seed.z),r=${(FLAME.radius + 0.04).toFixed(2)}+life*(.25+1.05*seed.z);
    vec3 pos=vec3(cos(ang)*r,sin(ang)*r+life*life*(.45+.55*seed.z),(seed.z-.5)*.8*
        life+sin(life*9.+seed.x)*.05);
    vec4 mv=modelViewMatrix*vec4(pos,1.);
    gl_Position=projectionMatrix*mv;
    float side=.5+.5*cos(ang-spin-.6+.25*sin(time*.4));
    vColor=mix(vec3(.85,.4,1.),vec3(.35,.92,1.),side);
    vAlpha=smoothstep(0.,.08,life)*(1.-smoothstep(.5,1.,life));
    gl_PointSize=clamp((.02+.03*seed.z)*(1.-.5*life)*projectionMatrix[1][1]*height*.5/max(.1,-mv.z),1.,12.);
  }`;
// The hoop: the energy ring as a solid glowing tube, turquoise and pink like its flames, flickering along it.
const HOOP_VERTEX = `varying vec2 vUv;
    void main(){
      vUv=uv;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
    }`;
const HOOP_FRAGMENT = `varying vec2 vUv;
  uniform float time;
  uniform float glow;
  uniform float surge;
  void main(){
    float a=vUv.x*6.2831853,side=.5+.5*cos(a-.6);
    vec3 hue=mix(vec3(1.,.4,.85),vec3(.25,.92,1.),side);
    float flick=.72+.28*sin(a*9.+time*6.)*sin(a*4.-time*3.7);
    gl_FragColor=vec4(hue*hue*flick*(.55+glow*.25+surge*.5),1.);
  }`;
// The lens shell: fresnel glow, turquoise on one side, pink on the other, flickering a little; additive.
const LENS_SHELL_VERTEX = `varying vec3 vN;
    varying vec3 vV;
    varying vec2 vUv;
    void main(){
      vUv=uv;
      vec4 mv=modelViewMatrix*vec4(position,1.);
      vN=normalize(normalMatrix*normal);
      vV=normalize(-mv.xyz);
      gl_Position=projectionMatrix*mv;
    }`;
const LENS_SHELL_FRAGMENT = `varying vec3 vN;
  varying vec3 vV;
  varying vec2 vUv;
  uniform float time;
  uniform float glow;
  uniform float surge;
  void main(){
    float f=1.-abs(dot(normalize(vN),normalize(vV)));
    f=f*f*f;
    vec3 hue=mix(vec3(.25,.92,1.),vec3(1.,.4,.85),.5+.5*sin(vUv.x*6.2831853+time*.6));
    float flick=.8+.2*sin(vUv.y*40.-time*3.);
    gl_FragColor=vec4(hue*hue*f*flick*(.32+glow*.12+surge*.35),1.);
  }`;
const EMBER_FRAGMENT = `varying float vAlpha;
  varying vec3 vColor;
  uniform float glow;
  uniform float surge;
  void main(){
    vec2 c=gl_PointCoord-.5;
    float d=dot(c,c),a=(1.-smoothstep(0.,.25,d))*vAlpha;
    vec3 hot=mix(vColor,vec3(1.),1.-smoothstep(0.,.04,d));
    gl_FragColor=vec4(hot*hot*(1.2+glow*.5+surge*.8),a);
  }`;
// Light spilled on the dais: strongest under the ring, pulsing slowly, brighter on hover and surge.
export const GLOW_FRAGMENT = `varying vec2 vPos;
  uniform float time;
  uniform float glow;
  uniform float surge;
  uniform vec4 tint;
  void main(){
    float r=length(vPos)/${GATE.glowDisc.toFixed(2)},fall=smoothstep(1.,0.,r);
    fall*=fall;
    float under=1.-smoothstep(0.,1.,abs(vPos.y)/1.1),pulse=.85+.15*sin(time*1.3);
    vec3 color=mix(mix(vec3(.25,.42,1.),vec3(.55,.32,1.),.5+.5*sin(time*.4+r*3.)),tint.rgb,tint.a*.55);
    gl_FragColor=vec4(color*fall*(.22+.3*under)*pulse*(1.+glow*1.1+surge*1.8),1.);
  }`;

// Turn rate of the floating segments (rad/s): a slow drift at rest, quick while the portal charges.
export function segmentSpin(surge) {
  const s = Math.min(1, Math.max(0, surge || 0));
  return 0.12 + 1.1 * s * s;
}
// Shared brightness boost of every gate shader from hover/approach and the activation flash.
export function gateGlow(hover, flash) {
  return Math.min(1.4, Math.max(0, hover) * 0.7 + Math.max(0, flash) * 1.2);
}

export function createPortalGate(THREE, { center, angle, resources, economy = false }) {
  const group = new THREE.Group();
  group.name = 'portal-gate';
  group.position.set(center.x, 0, center.z);
  group.rotation.y = angle;
  const own = r => {
      resources.add(r);
      return r;
    },
    add = (geometry, material, parent = group) => {
      const m = new THREE.Mesh(own(geometry), material);
      parent.add(m);
      return m;
    };
  // Own cool neon: the garden's shared lamp materials turn warm in the Natural light style.
  const mirror = own(new THREE.MeshStandardMaterial({ color: 0x221e33, roughness: 0.42, metalness: 0.25 }));
  const neonBlue = own(new THREE.MeshBasicMaterial({ color: 0x6fb2ff, toneMapped: false })),
    neonViolet = own(new THREE.MeshBasicMaterial({ color: 0xa38cff, toneMapped: false }));
  // One set of uniform objects shared by the membrane, wisps and floor glow.
  const uniforms = {
    time: { value: 0 },
    surge: { value: 0 },
    swirl: { value: 0 },
    glow: { value: 0 },
    tint: { value: new THREE.Vector4(0, 0, 0, 0) },
    // The chosen project's picture in the vortex (see setPreview).
    preview: { value: null },
    previewMix: { value: 0 },
    previewAspect: { value: 1 }
  };
  const previews = new Map(),
    loader = new THREE.TextureLoader();
  let previewTarget = 0,
    previewWanted = null;
  const tintTarget = new THREE.Vector4(0, 0, 0, 0),
    tintColor = new THREE.Color();
  const glowMaterial = (fragmentShader, vertexShader, extra = {}) =>
    own(
      new THREE.ShaderMaterial({
        uniforms: {
          time: uniforms.time,
          surge: uniforms.surge,
          glow: uniforms.glow,
          tint: uniforms.tint,
          ...extra.uniforms
        },
        vertexShader:
          vertexShader ||
          `varying vec2 vPos;
            void main(){
              vPos=position.xy;
              gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
            }`,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        side: extra.side ?? THREE.FrontSide
      })
    );
  const y = center.y;
  // Halo: a lathe-swept rounded profile; shared vertices give smooth normals round the inner wall.
  const [inner, outer] = GATE.halo,
    half = GATE.depth / 2,
    round = 0.05,
    // Start and end mid inner wall so the lathe seam normal is exact.
    profile = [new THREE.Vector2(inner, 0)];
  for (const [cx, cy, start] of [
    [inner + round, -half + round, Math.PI],
    [outer - round, -half + round, -Math.PI / 2],
    [outer - round, half - round, 0],
    [inner + round, half - round, Math.PI / 2]
  ])
    for (let i = 0; i <= 4; i++) {
      const t = start + (i / 4) * (Math.PI / 2);
      profile.push(new THREE.Vector2(cx + Math.cos(t) * round, cy + Math.sin(t) * round));
    }
  profile.push(new THREE.Vector2(inner, 0));
  const haloGeometry = new THREE.LatheGeometry(profile, 128);
  haloGeometry.rotateX(Math.PI / 2);
  // Never drawn (no colour, no depth): it only keeps the ring easy to click (a pick target is never baked).
  const halo = add(haloGeometry, own(new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })));
  halo.position.y = y;
  // Invisible, so it never hides a ride target behind it from a tap (visible-pick.mjs).
  halo.userData.noOcclude = true;
  // world.mjs bakes every stationary mesh into shared geometry whatever its visibility, so the old carved runes,
  // neon edge, crystals and floating arc segments are not built at all (they would come back after the bake).
  // Membrane.
  const effect = own(
    new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      toneMapped: false,
      uniforms,
      vertexShader: MEMBRANE_VERTEX,
      fragmentShader: MEMBRANE_FRAGMENT
    })
  );
  // A bowl rather than a flat disc (RingGeometry for its concentric rows; its uv matches CircleGeometry's).
  const bowl = new THREE.RingGeometry(1e-4, GATE.membrane, 72, VOLUME.rings),
    bowlPoints = bowl.attributes.position;
  for (let k = 0; k < bowlPoints.count; k++) {
    const r = Math.hypot(bowlPoints.getX(k), bowlPoints.getY(k)) / GATE.membrane;
    bowlPoints.setZ(k, -VOLUME.depth * (1 - r * r));
  }
  bowl.computeVertexNormals();
  const membrane = add(bowl, effect);
  membrane.position.y = y;
  membrane.userData.dynamic = true;
  // The energy ring: one double-sided disc a hair in front of the membrane (its ring stands outside the membrane,
  // so it reads from both sides). It turns slowly round the travel axis, so its turquoise and pink sides drift,
  // and spins up while the portal charges.
  const orbit = new THREE.Group();
  orbit.position.y = y;
  group.add(orbit);
  const rings = [FLAME.offset].map(z => {
    const ring = createPocketPortal(THREE, { radius: FLAME.radius, style: 'flame', well: false });
    own(ring.mesh.geometry);
    own(ring.mesh.material);
    ring.mesh.position.set(0, 0, z);
    ring.mesh.userData.dynamic = true;
    ring.mesh.userData.noOcclude = true;
    orbit.add(ring.mesh);
    return ring;
  });
  const hoop = add(
    new THREE.TorusGeometry(FLAME.radius, VOLUME.hoop, 10, 120),
    glowMaterial(HOOP_FRAGMENT, HOOP_VERTEX, { side: THREE.DoubleSide }),
    orbit
  );
  hoop.userData.dynamic = true;
  hoop.userData.noOcclude = true;
  const lensShell = add(
    new THREE.SphereGeometry(FLAME.radius + VOLUME.hoop, 48, 24),
    glowMaterial(LENS_SHELL_FRAGMENT, LENS_SHELL_VERTEX, { side: THREE.DoubleSide }),
    orbit
  );
  lensShell.scale.z = VOLUME.lens / (FLAME.radius + VOLUME.hoop);
  lensShell.userData.dynamic = true;
  lensShell.userData.noOcclude = true;
  // Wisps drawn into the vortex: one Points draw, positions computed in the vertex shader.
  const seeds = new Float32Array(WISPS * 3);
  for (let i = 0; i < WISPS; i++) {
    seeds[i * 3] = (i / WISPS) * Math.PI * 2 * 7.3;
    seeds[i * 3 + 1] = (i * 0.618034) % 1;
    seeds[i * 3 + 2] = (i * 0.414214 + 0.13) % 1;
  }
  const wispGeometry = own(new THREE.BufferGeometry());
  wispGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(WISPS * 3), 3));
  wispGeometry.setAttribute('seed', new THREE.BufferAttribute(seeds, 3));
  wispGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 3.4);
  const flow = { value: 0 },
    height = { value: 900 },
    wisps = new THREE.Points(
      wispGeometry,
      glowMaterial(WISP_FRAGMENT, WISP_VERTEX, { uniforms: { flow, height } })
    );
  wisps.position.y = y;
  wisps.visible = !economy;
  const drawing = new THREE.Vector2();
  // Point sizes follow the drawing buffer; read it before the draw (no per-frame allocation).
  wisps.onBeforeRender = renderer => {
    height.value = renderer.getDrawingBufferSize(drawing).y || 900;
  };
  group.add(wisps);
  // Embers off the ring: one more Points draw, every spark animated in its vertex shader.
  const emberSeeds = new Float32Array(EMBERS * 3);
  for (let i = 0; i < EMBERS; i++) {
    emberSeeds[i * 3] = (i / EMBERS) * Math.PI * 2 * 5.3;
    emberSeeds[i * 3 + 1] = (i * 0.754878) % 1;
    emberSeeds[i * 3 + 2] = (i * 0.56984 + 0.29) % 1;
  }
  const emberGeometry = own(new THREE.BufferGeometry());
  emberGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(EMBERS * 3), 3));
  emberGeometry.setAttribute('seed', new THREE.BufferAttribute(emberSeeds, 3));
  emberGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4);
  const emberFlow = { value: 0 },
    spin = { value: 0 },
    embers = new THREE.Points(
      emberGeometry,
      glowMaterial(EMBER_FRAGMENT, EMBER_VERTEX, { uniforms: { flow: emberFlow, height, spin } })
    );
  embers.position.y = y;
  embers.visible = !economy;
  group.add(embers);
  // Dais: a dark mirror disc, a neon floor ring and the spilled light (top of the plinth at y=.37).
  const daisRings = [],
    // A copy of a material drawn step x 4 depth units in front (the shared neon stays as it is elsewhere).
    layered = (material, step) =>
      own(
        Object.assign(material.clone(), {
          polygonOffset: true,
          polygonOffsetFactor: -step,
          polygonOffsetUnits: -4 * step
        })
      );
  const disc = add(new THREE.CircleGeometry(GATE.dais, 56), mirror);
  disc.rotation.x = -Math.PI / 2;
  disc.position.set(0, 0.374, 0);
  for (const [radius, material, width] of [
    [GATE.floorRing, neonViolet, 0.035],
    [GATE.innerRing, neonBlue, 0.02]
  ]) {
    const ring = add(new THREE.RingGeometry(radius - width, radius + width, 96), material);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 0.376, 0);
    daisRings.push(ring);
  }
  const floorGlow = add(new THREE.CircleGeometry(GATE.glowDisc, 48), glowMaterial(GLOW_FRAGMENT));
  floorGlow.rotation.x = -Math.PI / 2;
  floorGlow.position.set(0, 0.379, 0);
  floorGlow.renderOrder = 1;
  // The dais layers lie millimetres apart over the plinth (mirror, rings, glow): each a step further in front
  // at any distance and depth precision (round 5, scripts/zfight-audit.mjs).
  disc.material = layered(mirror, 1);
  for (const ring of daisRings) ring.material = layered(ring.material, 2);
  // The glow's own shader material (its uniforms are shared with the membrane, so it is not copied).
  Object.assign(floorGlow.material, {
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -12
  });
  // Its shader reads local positions (the pool round the dais centre): kept out of the stationary bake.
  floorGlow.userData.dynamic = true;
  let surge = 0,
    hover = 0,
    hoverTarget = 0,
    flash = 0,
    lastTime = null;
  const centre = new THREE.Vector3(center.x, y, center.z);
  return {
    group,
    effect,
    pickables: [membrane, halo],
    membrane,
    setSurge(level) {
      surge = level;
    },
    // 1 under the cursor, ~0.45 while the visitor stands at the portal, 0 otherwise.
    setHover(level) {
      hoverTarget = Math.min(1, Math.max(0, level || 0));
    },
    // Activation: a flash through the ring, membrane and floor that fades by itself.
    flash() {
      flash = 1;
    },
    // The chooser's selected destination colours the vortex arms; null fades the tint out.
    setTint(color, level = 0.8) {
      if (!color) {
        tintTarget.w = 0;
        return;
      }
      tintColor.set(color);
      tintTarget.set(tintColor.r, tintColor.g, tintColor.b, Math.min(1, Math.max(0, level)));
      if (uniforms.tint.value.w < 0.01) uniforms.tint.value.set(tintColor.r, tintColor.g, tintColor.b, 0);
    },
    // The chosen project's picture (an image URL) opens as a window in the vortex; null closes it. Pictures are
    // loaded once and kept; one that fails to load (or has no URL) leaves the tint alone.
    setPreview(url) {
      previewWanted = url || null;
      if (!url) {
        previewTarget = 0;
        return;
      }
      const show = texture => {
        if (previewWanted !== url || !texture?.image) return;
        const { width = 1, height = 1 } = texture.image;
        if (uniforms.preview.value !== texture) uniforms.previewMix.value = 0;
        uniforms.preview.value = texture;
        uniforms.previewAspect.value = width / Math.max(1, height);
        previewTarget = 1;
      };
      if (previews.has(url)) return show(previews.get(url));
      previewTarget = 0;
      const texture = own(
        loader.load(
          url,
          loaded => show(loaded),
          undefined,
          () => previews.delete(url)
        )
      );
      texture.colorSpace = THREE.SRGBColorSpace;
      previews.set(url, texture);
    },
    get previewLevel() {
      return uniforms.previewMix.value;
    },
    get tint() {
      return uniforms.tint.value;
    },
    get glow() {
      return uniforms.glow.value;
    },
    // Full frame rate only while the gate is near or still easing; otherwise the idle tick is enough.
    needsAnimation(eye) {
      return (
        flash > 0 ||
        Math.abs(hover - hoverTarget) > 0.01 ||
        Math.abs(uniforms.tint.value.w - tintTarget.w) > 0.01 ||
        Math.abs(uniforms.previewMix.value - previewTarget) > 0.01 ||
        (!!eye && eye.distanceToSquared(centre) < NEAR * NEAR)
      );
    },
    // effectTime only advances when motion is allowed, so reduced motion and economy stay still.
    update(time) {
      const dt = lastTime === null ? 0 : Math.min(0.25, Math.max(0, time - lastTime));
      lastTime = time;
      if (dt > 0) {
        hover += (hoverTarget - hover) * Math.min(1, dt * HOVER_RATE);
        flash = Math.max(0, flash - dt * FLASH_FADE);
        uniforms.tint.value.lerp(tintTarget, Math.min(1, dt * TINT_RATE));
        uniforms.previewMix.value +=
          (previewTarget - uniforms.previewMix.value) * Math.min(1, dt * TINT_RATE * 0.6);
      } else {
        // Frozen clock: show the state without easing.
        hover = hoverTarget;
        flash = 0;
        uniforms.tint.value.copy(tintTarget);
        uniforms.previewMix.value = previewTarget;
      }
      uniforms.glow.value = gateGlow(hover, flash);
      orbit.rotation.z -= segmentSpin(Math.max(surge, hover * 0.45)) * dt;
      const swell = FLAME.rest + FLAME.swell * Math.min(1, Math.max(surge, hover * 0.6, flash));
      for (const ring of rings) ring.set(1, time, swell);
      spin.value = orbit.rotation.z;
      emberFlow.value += dt * (0.3 + 0.9 * Math.min(1, Math.max(0, surge)) + 0.3 * hover);
      flow.value += dt * (0.16 + 0.9 * Math.min(1, Math.max(0, surge)) + 0.25 * hover);
    }
  };
}
