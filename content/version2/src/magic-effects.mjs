// Magical transition effects: GPU-driven motes, levitation rune rings, light
// columns, arrival ripples and the portal light tunnel. One group follows the
// current world scene; nothing is drawn while idle and nothing is allocated per
// frame. Motes are written once at birth and animated entirely in the shader.
import { spanEdges } from './garden-transition.mjs';

const TAU = Math.PI * 2;
// Bloom renders into a 4x MSAA half-float target, where varyings extrapolate slightly past triangle
// edges: no pow()/atan() here may see a negative base or the origin, or one NaN pixel spreads over the frame.
// Premultiplied output: sparkles add light (alpha ~0), mist partly covers (alpha > 0).
const premultiplied = THREE => ({
  transparent: true,
  depthWrite: false,
  toneMapped: false,
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneMinusSrcAlphaFactor,
  blendSrcAlpha: THREE.ZeroFactor,
  blendDstAlpha: THREE.OneFactor
});
export const MOTE = { drift: 0, spiral: 1, mist: 2 };
export const MAGIC_CAPACITY = 1800;
// Garden-wide touches (motes at full density; economy keeps ~30%). The trail is per second while moving.
// A touch more for taps and hover glints (owner, 2026-10-27: "чуть выразительнее без визуального шума").
export const MAGIC_BUDGET = { trail: 44, shimmer: 54, tap: 18, glint: 10 };
const palette = {
  blue: [0.52, 0.7, 1],
  violet: [0.78, 0.55, 1],
  white: [1, 0.96, 1],
  mist: [0.86, 0.8, 0.97],
  gold: [1, 0.86, 0.62]
};

const moteVertex = `uniform float uTime;
  uniform float uPixel;
  uniform vec3 uPortalCenter;
  uniform vec3 uPortalAxis;
  attribute vec3 aVelocity;
  attribute vec4 aData;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vKind;
  void main(){
    float age=uTime-aData.x,life=aData.y;
    if(age<0.||age>life){
      gl_Position=vec4(2.,2.,2.,1.);
      gl_PointSize=0.;
      vAlpha=0.;
      return;
    }
    float t=age/life;
    vec3 p;
    float grow=1.-.45*t;
    if(aData.w<.5){
      p=position+aVelocity*(1.-exp(-age*1.4))/1.4+vec3(0.,.22,0.)*age*age;
      vAlpha=smoothstep(0.,.1,t)*(1.-smoothstep(.5,1.,t));
    }
    else if(aData.w<1.5){
      vec3 off=position-uPortalCenter;
      float along=dot(off,uPortalAxis);
      vec3 o=off-uPortalAxis*along,b=cross(uPortalAxis,o);
      float k=1.-t*t,ang=age*(2.2+aVelocity.x)*(1.+2.5*t);
      p=uPortalCenter+(o*cos(ang)+b*sin(ang))*k+uPortalAxis*(along*k-t*aVelocity.y);
      vAlpha=smoothstep(0.,.18,t)*(1.-smoothstep(.82,1.,t));
    } else{
      p=position+aVelocity*age;
      grow=1.+1.6*t;
      vAlpha=smoothstep(0.,.25,t)*(1.-t);
    }
    vec4 mv=modelViewMatrix*vec4(p,1.);
    gl_PointSize=min(256.,aData.z*grow*uPixel/max(.4,-mv.z));
    gl_Position=projectionMatrix*mv;
    vColor=aColor;
    vKind=aData.w;
  }`;
const moteFragment = `varying vec3 vColor;
  varying float vAlpha;
  varying float vKind;
  void main(){
    vec2 c=gl_PointCoord*2.-1.;
    float r=dot(c,c);
    if(r>1.||vAlpha<=0.)discard;
    if(vKind>1.5){
      float soft=(1.-r)*(1.-r)*vAlpha*.42;
      gl_FragColor=vec4(vColor*soft,soft*.78);
      return;
    }
    float core=exp(-r*7.)+.28*exp(-r*1.8)+.55*max(0.,1.-abs(c.x)*9.)*max(0.,1.-abs(c.y))+.55*
        max(0.,1.-abs(c.y)*9.)*max(0.,1.-abs(c.x));
    gl_FragColor=vec4(vColor*core*vAlpha*1.35,0.);
  }`;
const ringVertex = `attribute float aFade;
  attribute vec2 aStyle;
  varying vec2 vUv;
  varying float vFade;
  varying vec2 vStyle;
  void main(){
    vUv=uv;
    vFade=aFade;
    vStyle=aStyle;
    vec4 p=vec4(position,1.);
  #ifdef USE_INSTANCING
    p=instanceMatrix*p;
  #endif
    gl_Position=projectionMatrix*modelViewMatrix*p;
  }`;
const ringFragment = `uniform float uTime;
  varying vec2 vUv;
  varying float vFade;
  varying vec2 vStyle;
  float band(float r,float at,float width){
    float d=(r-at)/width;
    return exp(-d*d);
  }
  void main(){
    vec2 p=vUv*2.-1.;
    float r=length(p);
    if(r>1.||vFade<=0.)discard;
    float a=atan(p.y,p.x+1e-5),glow;
    vec3 color;
    if(vStyle.x<.5){
      float spin=uTime*.42+vStyle.y,cells=fract((a+spin)/6.2831853*40.),id=floor((a+spin)/6.2831853*40.);
      float glyph=step(.32,fract(sin(id*12.9898+vStyle.y*7.)*43758.5453))*
          (1.-smoothstep(.18,.34,abs(cells-.5)));
      float runes=smoothstep(.80,.815,r)*(1.-smoothstep(.885,.90,r))*glyph;
      float arcs=band(r,.665,.012)*step(.38,fract((a-spin*1.7)/6.2831853*7.));
      glow=band(r,.93,.016)+.75*band(r,.79,.011)+.5*band(r,.55,.009)+.9*runes+.7*arcs+.35*band(r,.86,.16);
      color=mix(vec3(.30,.52,1.),vec3(.70,.40,1.),.5+.5*sin(a*2.+uTime*.9));
    } else{
      glow=1.2*band(r,.9,.035)+.3*band(r,.78,.12);
      color=vec3(.72,.8,1.);
    }
    float v=glow*vFade*.78;
    gl_FragColor=vec4(color*v,0.);
  }`;
const columnVertex = `attribute float aFade;
  varying float vFade;
  varying float vHeight;
  varying float vFacing;
  varying float vAngle;
  void main(){
    vFade=aFade;
    vHeight=position.y;
    vAngle=atan(position.z,position.x);
    vec4 p=vec4(position,1.);
    vec3 n=normal;
  #ifdef USE_INSTANCING
    p=instanceMatrix*p;
    n=mat3(instanceMatrix)*n;
  #endif
    vec4 world=modelMatrix*p;
    vec3 nn=mat3(modelMatrix)*n,view=cameraPosition-world.xyz;
    vFacing=abs(dot(nn,view))*inversesqrt(max(dot(nn,nn)*dot(view,view),1e-12));
    gl_Position=projectionMatrix*viewMatrix*world;
  }`;
const columnFragment = `uniform float uTime;
  varying float vFade;
  varying float vHeight;
  varying float vFacing;
  varying float vAngle;
  void main(){
    float facing=clamp(vFacing,0.,1.),height=clamp(vHeight,0.,1.),edge=facing*facing,
        fall=smoothstep(0.,.3,height)*(1.-smoothstep(.45,1.,height));
    float stripes=.6+.4*sin(height*46.-uTime*7.+vAngle*3.);
    float v=clamp(edge*fall*stripes*vFade*.55,0.,1.);
    if(v<=.001)discard;
    gl_FragColor=vec4(mix(vec3(.55,.70,1.),vec3(.86,.70,1.),height)*v,0.);
  }`;
const tunnelVertex = `varying vec2 vUv;
  void main(){
    vUv=uv;
    gl_Position=vec4(position.xy,0.,1.);
  }`;
const tunnelFragment = `uniform float uTime;
  uniform float uTunnel;
  uniform float uFlash;
  uniform float uAspect;
  uniform float uDetail;
  varying vec2 vUv;
  float hash(vec2 p){
    return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);
  }
  void main(){
    // Radius against the shorter side, so a portrait phone gets the same tunnel as a desktop.
    vec2 p=vUv*2.-1.;
    if(uAspect>=1.)p.x*=uAspect;
    else p.y/=uAspect;
    float r=length(p),a=atan(p.y,p.x+1e-5)/6.2831853+.5;
    float depth=.32/(r+.03)+uTime*(2.2+3.8*uTunnel),sectors=floor(mix(48.,110.,uDetail)),s=floor(a*sectors),
        across=fract(a*sectors);
    float run=depth*1.15+hash(vec2(s,1.7))*9.,cell=floor(run),f=fract(run);
    float star=step(.80,hash(vec2(s,cell)))*smoothstep(0.,.06,f)*(1.-smoothstep(.10,.62,f))*
        (1.-smoothstep(.06,.42,abs(across-.5)*2.));
    vec3 tint=mix(vec3(.50,.66,1.),vec3(.86,.58,1.),hash(vec2(s,cell+3.)));
    vec3 color=vec3(.045,.032,.13)*(.55+.6*r)+tint*star*smoothstep(.04,.45,r)*1.6;
    color+=uDetail*vec3(.30,.22,.85)*pow(max(0.,.5+.5*sin(a*18.85+depth*1.6-uTime*2.4)),7.)*
        smoothstep(.1,.95,r)*.42;
    color+=vec3(.78,.74,1.)*exp(-r*r*12.)*(.6+.4*uTunnel);
    color=mix(color,vec3(.70,.60,1.),uFlash);
    float alpha=clamp(uTunnel*1.8-(1.-min(r,1.))*.8,0.,1.);
    alpha=max(alpha,uFlash);
    gl_FragColor=vec4(color*alpha,alpha);
  }`;

export function createMagicEffects(THREE, { economy = false, onSurge = () => {} } = {}) {
  const group = new THREE.Group();
  group.name = 'garden-magic';
  const resources = [];
  const own = x => {
    resources.push(x);
    return x;
  };
  let density = economy ? 0.3 : 1,
    detail = economy ? 0 : 1,
    clock = 0,
    last = null,
    activeUntil = 0,
    carry = 0;
  // ---- motes: a ring buffer written at birth only ----
  const origin = new Float32Array(MAGIC_CAPACITY * 3),
    velocity = new Float32Array(MAGIC_CAPACITY * 3),
    data = new Float32Array(MAGIC_CAPACITY * 4).fill(-1e4),
    color = new Float32Array(MAGIC_CAPACITY * 3);
  const moteGeometry = own(new THREE.BufferGeometry()),
    attrs = [];
  for (const [name, array, size] of [
    ['position', origin, 3],
    ['aVelocity', velocity, 3],
    ['aData', data, 4],
    ['aColor', color, 3]
  ]) {
    const a = new THREE.BufferAttribute(array, size);
    a.setUsage(THREE.DynamicDrawUsage);
    moteGeometry.setAttribute(name, a);
    attrs.push([a, size]);
  }
  moteGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
  const moteUniforms = {
    uTime: { value: 0 },
    uPixel: { value: 600 },
    uPortalCenter: { value: new THREE.Vector3() },
    uPortalAxis: { value: new THREE.Vector3(0, 0, 1) }
  };
  const motes = new THREE.Points(
    moteGeometry,
    own(
      new THREE.ShaderMaterial({
        uniforms: moteUniforms,
        vertexShader: moteVertex,
        fragmentShader: moteFragment,
        ...premultiplied(THREE)
      })
    )
  );
  motes.frustumCulled = false;
  motes.renderOrder = 40;
  group.add(motes);
  let next = 0,
    dirtyFrom = MAGIC_CAPACITY,
    dirtyTo = -1;
  function emit(kind, x, y, z, vx, vy, vz, life, size, rgb) {
    const i = next;
    next = (next + 1) % MAGIC_CAPACITY;
    origin[i * 3] = x;
    origin[i * 3 + 1] = y;
    origin[i * 3 + 2] = z;
    velocity[i * 3] = vx;
    velocity[i * 3 + 1] = vy;
    velocity[i * 3 + 2] = vz;
    data[i * 4] = clock;
    data[i * 4 + 1] = life;
    data[i * 4 + 2] = size;
    data[i * 4 + 3] = kind;
    color[i * 3] = rgb[0];
    color[i * 3 + 1] = rgb[1];
    color[i * 3 + 2] = rgb[2];
    if (i < dirtyFrom) dirtyFrom = i;
    if (i > dirtyTo) dirtyTo = i;
    if (clock + life > activeUntil) activeUntil = clock + life;
  }
  function flush() {
    if (dirtyTo < dirtyFrom) return;
    for (const [a, size] of attrs) {
      a.clearUpdateRanges();
      a.addUpdateRange(dirtyFrom * size, (dirtyTo - dirtyFrom + 1) * size);
      a.needsUpdate = true;
    }
    dirtyFrom = MAGIC_CAPACITY;
    dirtyTo = -1;
  }
  // Fractional emission: `rate` per second at full density, carried across frames.
  const count = (rate, dt) => {
    carry += rate * density * dt;
    const n = Math.floor(carry);
    carry -= n;
    return n;
  };
  const pick = (a, b) => a + Math.random() * (b - a),
    hue = () => (Math.random() < 0.55 ? palette.blue : Math.random() < 0.8 ? palette.violet : palette.white);

  // ---- instanced rings (levitation runes and arrival ripples) ----
  const RINGS = 40,
    ringGeometry = own(new THREE.PlaneGeometry(2, 2));
  ringGeometry.rotateX(-Math.PI / 2);
  const ringFade = new THREE.InstancedBufferAttribute(new Float32Array(RINGS), 1),
    ringStyle = new THREE.InstancedBufferAttribute(new Float32Array(RINGS * 2), 2);
  ringFade.setUsage(THREE.DynamicDrawUsage);
  ringStyle.setUsage(THREE.DynamicDrawUsage);
  ringGeometry.setAttribute('aFade', ringFade);
  ringGeometry.setAttribute('aStyle', ringStyle);
  const timeUniform = { value: 0 };
  const rings = new THREE.InstancedMesh(
    ringGeometry,
    own(
      new THREE.ShaderMaterial({
        uniforms: { uTime: timeUniform },
        vertexShader: ringVertex,
        fragmentShader: ringFragment,
        side: THREE.DoubleSide,
        ...premultiplied(THREE)
      })
    ),
    RINGS
  );
  rings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  rings.frustumCulled = false;
  rings.renderOrder = 38;
  rings.count = 0;
  group.add(rings);
  let ringCount = 0;
  const ripples = [];
  // ---- instanced light columns for rising islands ----
  const COLUMNS = 24,
    columnGeometry = own(new THREE.CylinderGeometry(1, 1, 1, 28, 1, true));
  columnGeometry.translate(0, 0.5, 0);
  const columnFade = new THREE.InstancedBufferAttribute(new Float32Array(COLUMNS), 1);
  columnFade.setUsage(THREE.DynamicDrawUsage);
  columnGeometry.setAttribute('aFade', columnFade);
  const columns = new THREE.InstancedMesh(
    columnGeometry,
    own(
      new THREE.ShaderMaterial({
        uniforms: { uTime: timeUniform },
        vertexShader: columnVertex,
        fragmentShader: columnFragment,
        side: THREE.DoubleSide,
        ...premultiplied(THREE)
      })
    ),
    COLUMNS
  );
  columns.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  columns.frustumCulled = false;
  columns.renderOrder = 37;
  columns.count = 0;
  group.add(columns);
  let columnCount = 0;
  // ---- full-screen light tunnel for the portal trip ----
  const tunnelUniforms = {
    uTime: { value: 0 },
    uTunnel: { value: 0 },
    uFlash: { value: 0 },
    uAspect: { value: 1 },
    uDetail: { value: detail }
  };
  const tunnel = new THREE.Mesh(
    own(new THREE.PlaneGeometry(2, 2)),
    own(
      new THREE.ShaderMaterial({
        uniforms: tunnelUniforms,
        vertexShader: tunnelVertex,
        fragmentShader: tunnelFragment,
        depthTest: false,
        ...premultiplied(THREE)
      })
    )
  );
  tunnel.frustumCulled = false;
  tunnel.renderOrder = 10000;
  tunnel.visible = false;
  group.add(tunnel);
  // ---- portal charge: motes spiral into the ring while the swirl surges ----
  let chargeUntil = 0,
    surge = 0,
    surgeTarget = 0,
    swirl = 0;
  const portalCenter = moteUniforms.uPortalCenter.value,
    portalAxis = moteUniforms.uPortalAxis.value,
    up = new THREE.Vector3(0, 1, 0),
    side = new THREE.Vector3();

  const m4 = new THREE.Matrix4(),
    local = new THREE.Matrix4(),
    v3 = new THREE.Vector3(),
    q = new THREE.Quaternion(),
    s3 = new THREE.Vector3();
  // Island-local frame of a land outline (ellipse), placed `drop` below its top.
  function landMatrix(shape, drop, grow, target) {
    return target
      .makeRotationY(shape.rotation)
      .scale(s3.set(shape.radius * shape.stretch * grow, 1, (shape.radius / shape.stretch) * grow))
      .setPosition(shape.x, shape.y - drop, shape.z);
  }
  // A point on the underside of a land, carried by the island's owner matrix.
  function underside(shape, matrix, depthMin, depthMax, spread = 0.62) {
    const a = Math.random() * TAU,
      r = Math.sqrt(Math.random()) * spread,
      lx = Math.sin(a) * r * shape.radius * shape.stretch,
      lz = (Math.cos(a) * r * shape.radius) / shape.stretch;
    v3.set(
      shape.x + Math.cos(shape.rotation) * lx + Math.sin(shape.rotation) * lz,
      shape.y - pick(depthMin, depthMax),
      shape.z - Math.sin(shape.rotation) * lx + Math.cos(shape.rotation) * lz
    );
    return matrix ? v3.applyMatrix4(matrix) : v3;
  }
  const api = {
    group,
    emit,
    MOTE,
    get clock() {
      return clock;
    },
    get surge() {
      return surge;
    },
    setEconomy(value) {
      density = value ? 0.3 : 1;
      detail = value ? 0 : 1;
      tunnelUniforms.uDetail.value = detail;
    },
    // Rings and columns are declared again by every relayout frame before tick(); ripples animate themselves.
    ring(shape, matrix, fade, seed = 0) {
      if (ringCount >= RINGS - 8 || fade <= 0.002) return;
      landMatrix(shape, 2.4, 1.2, local);
      rings.setMatrixAt(ringCount, matrix ? m4.multiplyMatrices(matrix, local) : local);
      ringFade.array[ringCount] = fade;
      ringStyle.array[ringCount * 2] = 0;
      ringStyle.array[ringCount * 2 + 1] = seed;
      ringCount++;
    },
    column(shape, fade) {
      if (columnCount >= COLUMNS || fade <= 0.002) return;
      const radius = shape.radius * 0.72;
      columns.setMatrixAt(
        columnCount,
        m4.compose(
          v3.set(shape.x, shape.y - 46, shape.z),
          q.identity(),
          s3.set(radius * 0.62, 64, radius * 0.62)
        )
      );
      columnFade.array[columnCount++] = fade;
    },
    trail(shape, matrix, rate, dt) {
      for (let n = count(rate, dt); n > 0; n--) {
        const p = underside(shape, matrix, 2, 9);
        emit(
          MOTE.drift,
          p.x,
          p.y,
          p.z,
          pick(-0.4, 0.4),
          pick(-1.6, -0.5),
          pick(-0.4, 0.4),
          pick(1.1, 1.8),
          pick(0.15, 0.28),
          hue()
        );
      }
    },
    mist(shape, matrix, rate, dt) {
      for (let n = count(rate, dt); n > 0; n--) {
        const p = underside(shape, matrix, 4, 14, 0.5),
          a = Math.random() * TAU,
          speed = pick(1.2, 3.2);
        emit(
          MOTE.mist,
          p.x,
          p.y,
          p.z,
          Math.sin(a) * speed,
          pick(-0.3, 0.6),
          Math.cos(a) * speed,
          pick(1.3, 2.1),
          pick(2.6, 4.6),
          palette.mist
        );
      }
      for (let n = count(rate * 0.6, dt); n > 0; n--) {
        const p = underside(shape, matrix, 1, 6);
        emit(
          MOTE.drift,
          p.x,
          p.y,
          p.z,
          pick(-0.8, 0.8),
          pick(0.6, 2.2),
          pick(-0.8, 0.8),
          pick(0.8, 1.4),
          pick(0.1, 0.18),
          hue()
        );
      }
    },
    rise(shape, matrix, rate, dt) {
      for (let n = count(rate, dt); n > 0; n--) {
        const p = underside(shape, matrix, -1, 10, 0.95);
        emit(
          MOTE.drift,
          p.x,
          p.y,
          p.z,
          pick(-0.3, 0.3),
          pick(2, 4.5),
          pick(-0.3, 0.3),
          pick(0.9, 1.5),
          pick(0.1, 0.22),
          hue()
        );
      }
    },
    burst(
      x,
      y,
      z,
      amount,
      { radius = 1, speed = 2.4, up = 1.6, size = [0.1, 0.24], life = [0.9, 1.6], colors = null } = {}
    ) {
      const n = Math.max(1, Math.round(amount * density));
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU,
          r = Math.sqrt(Math.random()) * radius,
          s = pick(0.4, 1) * speed;
        emit(
          MOTE.drift,
          x + Math.sin(a) * r,
          y + pick(0, 0.4),
          z + Math.cos(a) * r,
          Math.sin(a) * s,
          pick(0.3, 1) * up,
          Math.cos(a) * s,
          pick(life[0], life[1]),
          pick(size[0], size[1]),
          colors ? colors[i % colors.length] : hue()
        );
      }
    },
    burstShape(shape, amount) {
      const n = Math.max(1, Math.round(amount * density));
      for (let i = 0; i < n; i++) {
        const p = underside(shape, null, -0.6, 0.4, 1.05),
          a = Math.atan2(p.x - shape.x, p.z - shape.z),
          s = pick(0.6, 2.4);
        emit(
          MOTE.drift,
          p.x,
          p.y,
          p.z,
          Math.sin(a) * s,
          pick(1.2, 3.4),
          Math.cos(a) * s,
          pick(1, 1.7),
          pick(0.12, 0.26),
          hue()
        );
      }
    },
    // Motes where a bridge span is dissolving (`edge`) or being re-woven (`thread`).
    spans(world, reveal, rate, dt, mode = 'edge') {
      const spans = world.bridgeSpans;
      if (!spans) return;
      const route = world.route;
      const place = (at, i) => (i < 0 ? route.spoke(at) : route.point(i + at));
      const each = (span, i) => {
        if (mode === 'edge') {
          const edges = spanEdges(span, reveal);
          if (!edges) return;
          for (const u of edges)
            for (let n = count(rate, dt); n > 0; n--) {
              const p = place(u + pick(-0.01, 0.01), i);
              emit(
                MOTE.drift,
                p.x + pick(-1, 1),
                p.y + pick(0.2, 0.9),
                p.z + pick(-1, 1),
                pick(-0.5, 0.5),
                pick(1, 2.6),
                pick(-0.5, 0.5),
                pick(0.8, 1.3),
                pick(0.09, 0.17),
                hue()
              );
            }
        } else
          for (let n = count(rate, dt); n > 0; n--) {
            const u = pick(span.from, span.to),
              p = place(u, i);
            emit(
              MOTE.drift,
              p.x + pick(-0.5, 0.5),
              p.y + pick(0.3, 0.8),
              p.z + pick(-0.5, 0.5),
              pick(-0.15, 0.15),
              pick(0.05, 0.35),
              pick(-0.15, 0.15),
              pick(0.5, 0.9),
              pick(0.08, 0.14),
              Math.random() < 0.5 ? palette.blue : palette.white
            );
          }
      };
      spans.spans.forEach((span, i) => each(span, i));
      if (spans.spoke) each(spans.spoke, -1);
    },
    // Trip trail: sparkles born a few metres ahead of the moving camera and to its sides, so the visitor
    // flies through a stream of light. `speed` in m/s scales the rate; nothing below a slow walk.
    stream(position, forward, speed, dt) {
      if (!Number.isFinite(speed) || speed <= 0.6) return 0;
      side.set(-forward.z, 0, forward.x);
      if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
      side.normalize();
      let born = 0;
      for (let n = count(Math.min(1, speed / 6) * MAGIC_BUDGET.trail, dt); n > 0; n--, born++) {
        const lateral = (Math.random() < 0.5 ? -1 : 1) * pick(0.6, 1.7),
          ahead = pick(2.4, 5.2);
        emit(
          MOTE.drift,
          position.x + forward.x * ahead + side.x * lateral,
          position.y + forward.y * ahead + pick(-0.75, 0.45),
          position.z + forward.z * ahead + side.z * lateral,
          side.x * lateral * 0.12 - forward.x * 0.4,
          pick(-0.1, 0.25),
          side.z * lateral * 0.12 - forward.z * 0.4,
          pick(0.8, 1.3),
          pick(0.05, 0.1),
          Math.random() < 0.25 ? palette.gold : hue()
        );
      }
      return born;
    },
    // Arrival: a ring of light runs across the deck and a wave of sparkles rises round its edge.
    shimmer(x, y, z, radius = 4.2) {
      api.ripple(x, y, z, radius, 1.5, 2.2);
      const n = Math.max(1, Math.round(MAGIC_BUDGET.shimmer * density));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + pick(-0.08, 0.08),
          r = radius * pick(0.55, 1),
          out = pick(0.15, 0.6);
        emit(
          MOTE.drift,
          x + Math.sin(a) * r,
          y + pick(0, 0.3),
          z + Math.cos(a) * r,
          Math.sin(a) * out,
          pick(0.9, 2.1),
          Math.cos(a) * out,
          pick(1, 1.7),
          pick(0.06, 0.13),
          i % 3 ? palette.gold : palette.white
        );
      }
      return n;
    },
    // A tap on the ground: a small ring of light and a few sparks where the finger or click landed.
    tap(x, y, z, radius = 1.7) {
      api.ripple(x, y, z, radius, 0.9, 2.6);
      api.burst(x, y, z, MAGIC_BUDGET.tap, {
        radius: 0.25,
        speed: 1,
        up: 1.2,
        size: [0.04, 0.09],
        life: [0.5, 0.9]
      });
    },
    // Hover glint on something that can be clicked: a pinch of white, gold and portal-blue sparks, gone in under a
    // second.
    glint(x, y, z) {
      api.burst(x, y, z, MAGIC_BUDGET.glint, {
        radius: 0.16,
        speed: 0.65,
        up: 0.8,
        size: [0.05, 0.1],
        life: [0.4, 0.75],
        colors: [palette.white, palette.gold, palette.blue]
      });
    },
    ripple(x, y, z, radius = 4.5, seconds = 1.1, gain = 1) {
      ripples.push({ x, y, z, radius, start: clock, seconds, gain });
      if (clock + seconds > activeUntil) activeUntil = clock + seconds;
    },
    charge(portal, seconds) {
      if (!portal?.center) return;
      portalCenter.set(portal.center.x, portal.center.y, portal.center.z);
      portalAxis.set(portal.normal.x, portal.normal.y, portal.normal.z).normalize();
      chargeUntil = Math.max(chargeUntil, clock + seconds);
      if (chargeUntil > activeUntil) activeUntil = chargeUntil + 1.4;
    },
    set surgeTarget(value) {
      surgeTarget = value;
    },
    setTunnel(level, flash) {
      tunnelUniforms.uTunnel.value = level;
      tunnelUniforms.uFlash.value = flash;
      tunnel.visible = level > 0.001 || flash > 0.001;
    },
    active() {
      return clock < activeUntil || tunnel.visible || ripples.length > 0 || surge > 0.002 || surgeTarget > 0;
    },
    tick(now, camera, heightPx, aspect) {
      // Wall clock, at most 250 ms per frame like the relayout clock: a throttled window still finishes.
      const dt = last === null ? 0 : Math.min(0.25, Math.max(0, (now - last) / 1000));
      last = now;
      clock += dt;
      moteUniforms.uTime.value = timeUniform.value = tunnelUniforms.uTime.value = clock;
      tunnelUniforms.uAspect.value = aspect || 1;
      moteUniforms.uPixel.value = heightPx / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
      if (clock < chargeUntil) {
        side.crossVectors(portalAxis, up).normalize();
        for (let n = count(70, dt); n > 0; n--) {
          const a = Math.random() * TAU,
            r = pick(1.5, 2.7);
          v3.copy(portalCenter)
            .addScaledVector(up, Math.cos(a) * r)
            .addScaledVector(side, Math.sin(a) * r)
            .addScaledVector(portalAxis, pick(-0.2, 0.6));
          emit(
            MOTE.spiral,
            v3.x,
            v3.y,
            v3.z,
            pick(0, 1.4),
            pick(0.4, 1.2),
            0,
            pick(0.9, 1.4),
            pick(0.07, 0.14),
            hue()
          );
        }
      }
      surge += (surgeTarget - surge) * Math.min(1, dt * 5);
      if (Math.abs(surge) < 0.002 && !surgeTarget) surge = 0;
      swirl += dt * surge * 7;
      onSurge(surge, swirl);
      // Ripples follow the declared rings; finished ones are dropped in place.
      let r = ringCount;
      for (let i = ripples.length - 1; i >= 0; i--) {
        const ripple = ripples[i],
          t = (clock - ripple.start) / ripple.seconds;
        if (t >= 1) {
          ripples.splice(i, 1);
          continue;
        }
        if (r >= RINGS) continue;
        const grow = 0.25 + 0.95 * (1 - (1 - t) * (1 - t));
        rings.setMatrixAt(
          r,
          m4
            .makeScale(ripple.radius * grow, 1, ripple.radius * grow)
            .setPosition(ripple.x, ripple.y, ripple.z)
        );
        ringFade.array[r] = (1 - t) * (t < 0.12 ? t / 0.12 : 1) * 1.1 * ripple.gain;
        ringStyle.array[r * 2] = 1;
        r++;
      }
      rings.count = r;
      columns.count = columnCount;
      if (r) {
        rings.instanceMatrix.needsUpdate = true;
        ringFade.needsUpdate = true;
        ringStyle.needsUpdate = true;
      }
      if (columnCount) {
        columns.instanceMatrix.needsUpdate = true;
        columnFade.needsUpdate = true;
      }
      flush();
      motes.visible = clock < activeUntil;
      ringCount = 0;
      columnCount = 0;
    },
    reset() {
      ringCount = columnCount = 0;
      rings.count = columns.count = 0;
      ripples.length = 0;
      chargeUntil = 0;
      surgeTarget = 0;
      activeUntil = 0;
      data.fill(-1e4);
      dirtyFrom = 0;
      dirtyTo = MAGIC_CAPACITY - 1;
      api.setTunnel(0, 0);
    },
    dispose() {
      group.removeFromParent();
      resources.forEach(resource => resource.dispose?.());
    }
  };
  return api;
}
