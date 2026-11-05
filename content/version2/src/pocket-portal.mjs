// Portals drawn on one disc; `open` (0..1) grows each from a spark to the full ring.
// - 'flame' (the owner's reference for the main portal): a thin bright ring burning with living energy,
//   turquoise flames on one side, pink and violet on the other, round a deep indigo vortex with sparks.
// - 'rune' (the balloon station's magic gates): light, airy rings of turning glyphs round a clear, shimmering
//   veil the far side shows through. It rises out of a gate's rune circle only while a visitor crosses.
// `ring`: where the full ring stands on the disc (the rest is room for flames and glow).
export const POCKET_PORTAL = { segments: 48, ring: 0.62 };

// vNear: the ring fades out as the camera comes within a couple of metres, so flying through it never fills the
// screen with its glow. The range scales with the ring: a small ring (the basket's) still shows a metre away.
const vertex = `varying vec2 vUv;
  varying float vNear;
  void main(){
    vUv=uv;
    vec4 mv=modelViewMatrix*vec4(position,1.);
    float s=length(modelMatrix[0].xyz);
    vNear=smoothstep(.8*s,2.2*s,-mv.z);
    gl_Position=projectionMatrix*mv;
  }`;
const common = `uniform float uTime;
  uniform float uOpen;
  uniform float uGain;
  uniform float uWell;
  varying vec2 vUv;
  varying float vNear;
  float hash(vec2 p){
    return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);
  }
  float noise(vec2 p){
    vec2 i=floor(p),f=fract(p);
    f=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }
  float fbm(vec2 p){
    float v=0.,a=.5;
    for(int i=0;i<4;i++){
      v+=a*noise(p);
      p=p*2.03+vec2(1.7,9.2);
      a*=.5;
    }
    return v;
  }
  // The colours are picked as seen on screen; the scene is lit and blended in linear light (squared: close to
  // sRGB, and with no pow/log/sqrt every operation stays defined on every GPU, which the bloom pass relies on).
  vec4 finish(vec3 color,float alpha){
    color=max(color,vec3(0.));
    alpha*=vNear;
    return vec4(color*color*alpha,alpha);
  }
`;
const flame = `${common}
  void main(){
    vec2 p=vUv*2.-1.;
    float r=length(p);
    float open=clamp(uOpen,0.,1.);
    float edge=.04+.58*open;
    if(r>.99||open<=.001)discard;
    float a=atan(p.y,p.x+1e-5),t=uTime;
    // Seamless along the ring: the noise is sampled on a circle.
    vec2 around=vec2(cos(a),sin(a))*2.2;
    float off=r-edge;
    // Two layers of flame streaming away from the ring: broad tongues and fine, smoky licks.
    float tongue=fbm(around*1.5+vec2(off*4.,-t*1.2)),lick=fbm(around*3.2+vec2(off*7.-t*2.3,t*.5));
    float reach=mix(.05,.5,tongue*tongue)*(.5+.5*open);
    float flame=off>0.?exp(-off/max(reach,.01)*2.):exp(off/max(reach*.3,.005)*2.6);
    flame*=smoothstep(.2,.7,tongue+.2);
    float wisps=lick*lick*exp(-abs(off)*7.)*smoothstep(.35,.8,lick);
    // Electric crackle (the owner's first reference): thin jagged arcs jumping along the ring several times a second.
    float beat=floor(t*7.),arc=(off-(noise(vec2(a*24.,t*11.))-.5)*.06)/.005;
    float crackle=exp(-arc*arc)*step(.6,noise(vec2(a*2.3+beat*1.7,beat)));
    // The core: a white-hot line that flickers along its length (x*x, never pow of a negative).
    float cq=off/.011,core=exp(-cq*cq)*(.75+.25*noise(vec2(a*7.,t*3.)));
    // Turquoise on one side, pink-violet on the other, drifting slowly round.
    float side=.5+.5*cos(a-.6+.25*sin(t*.4));
    vec3 cyan=vec3(.2,.92,1.),blue=vec3(.25,.5,1.),pink=vec3(1.,.38,.85),violet=vec3(.62,.3,1.);
    vec3 fire=mix(mix(violet,pink,smoothstep(.3,.9,tongue)),mix(blue,cyan,smoothstep(.3,.9,tongue)),side);
    // Inside: a deep indigo well, a slow spiral and a few sparks (uWell 0: the ring alone, round a vortex of
    // its own such as the main portal's membrane).
    float inside=(1.-smoothstep(edge-.02,edge+.01,r))*uWell,depth=r/max(edge,.01);
    float arm=.5+.5*sin(a*3.+(1.-depth)*5.-t*1.6+fbm(p*3.)*2.),swirl=arm*arm*arm*arm*depth;
    vec3 well=mix(vec3(.04,.03,.16),vec3(.16,.12,.48),swirl*.6+depth*depth*.4);
    vec2 sp=(p+vec2(0.,t*.05))*26.,cell=floor(sp);
    float lit=step(.94,hash(cell));
    float spark=lit*
        (1.-smoothstep(.04,.12,length(fract(sp)-.5-.3*(vec2(hash(cell+3.),hash(cell+7.))-.5))))*inside*.7;
    // Kept below the bloom's wash-out: the ring glows, the well stays deep.
    vec3 color=fire*(flame*1.7+wisps*1.3)+mix(fire,vec3(1.),.55)*core*.75+vec3(.85,.95,1.)*crackle*1.2+well*
        inside+vec3(.8,.85,1.)*spark;
    gl_FragColor=finish(color,clamp(flame*.9+wisps*.6+core+crackle+inside*.94,0.,1.)*uGain*
        smoothstep(0.,.12,open));
  }`;
const rune = `${common}
  float band(float r,float at,float w){
    float d=(r-at)/w;
    return exp(-d*d);
  }
  void main(){
    vec2 p=vUv*2.-1.;
    float r=length(p);
    float open=clamp(uOpen,0.,1.);
    float edge=.04+.58*open;
    if(r>.99||open<=.001)discard;
    float a=atan(p.y,p.x+1e-5),t=uTime,k=r/max(edge,.01);
    // Two glyph rings turning opposite ways between fine guide lines.
    float spin=t*.5,cells=fract((a+spin)/6.2831853*36.),id=floor((a+spin)/6.2831853*36.);
    float glyph=step(.3,hash(vec2(id,3.)))*(1.-smoothstep(.16,.32,abs(cells-.5)));
    float cells2=fract((a-spin*1.4)/6.2831853*24.),id2=floor((a-spin*1.4)/6.2831853*24.);
    float glyph2=step(.4,hash(vec2(id2,9.)))*(1.-smoothstep(.12,.3,abs(cells2-.5)));
    float rings=band(k,1.,.018)+.6*band(k,.9,.01)+.5*band(k,.74,.008)
    +glyph*smoothstep(.915,.93,k)*(1.-smoothstep(.975,.99,k))*.9
    +glyph2*smoothstep(.77,.78,k)*(1.-smoothstep(.86,.87,k))*.7;
    float halo=band(k,1.,.12)*.35;
    // The veil: clear in the middle, a slow ripple of light drawn inwards.
    float inside=1.-smoothstep(.97,1.,k);
    float ripple=.5+.5*sin(k*18.-t*3.+fbm(p*4.+t*.3)*3.);
    float veil=inside*(.1+.16*ripple*k);
    vec3 ice=vec3(.72,.9,1.),lilac=vec3(.8,.72,1.);
    vec3 tone=mix(ice,lilac,.5+.5*sin(a*2.+t*.6));
    vec3 color=tone*(rings*1.1+halo)+vec3(.75,.85,1.)*veil;
    gl_FragColor=finish(color,clamp(rings+halo+veil,0.,1.)*uGain*smoothstep(0.,.12,open));
  }`;

// `make(geometry, material)` lets a scene builder create (and own) the mesh, as createBalloon does.
export function createPocketPortal(
  THREE,
  { radius = 1, style = 'flame', well = true, make = (g, m) => new THREE.Mesh(g, m) } = {}
) {
  const uniforms = {
    uTime: { value: 0 },
    uOpen: { value: 0 },
    uGain: { value: 1 },
    uWell: { value: well ? 1 : 0 }
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: vertex,
    fragmentShader: style === 'rune' ? rune : flame,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    premultipliedAlpha: true,
    toneMapped: false
  });
  // The full ring has radius `radius`; the disc round it leaves room for the flames.
  const geometry = new THREE.CircleGeometry(radius / POCKET_PORTAL.ring, POCKET_PORTAL.segments);
  const mesh = make(geometry, material);
  mesh.name = 'pocket-portal';
  mesh.renderOrder = 6;
  mesh.frustumCulled = false;
  mesh.userData.noOcclude = true;
  return {
    mesh,
    set(open, time, gain = 1) {
      uniforms.uOpen.value = open;
      uniforms.uTime.value = time;
      uniforms.uGain.value = gain;
      mesh.visible = open > 0.001 && gain > 0.001;
    },
    dispose() {
      mesh.removeFromParent();
      geometry.dispose();
      material.dispose();
    }
  };
}
