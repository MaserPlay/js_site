// The main portal's crossing: space folds into a black hole. A full-screen pass over the rendered frame bends
// the view round a dark horizon as gravity bends light (each point is drawn from where the thin-lens equation
// sends it, so the far side wraps round into an Einstein ring and a mirrored inner image), twists it with the
// hole's spin, splits the colours a little at the ring, and lights a thin photon ring and a glowing accretion
// swirl. Growing the horizon until it fills the screen hides the jump; shrinking it again unfolds the
// destination. Runs only during a crossing, and only where the glow composer runs (not in economy or on
// phones, which keep the light tunnel alone).
// Owner, round 4 ("сквозь космос/галактику"): the horizon is no longer a black disc but a window onto deep space
// that the visitor flies through: three layers of stars streaming past, nebulae in the portal's turquoise, violet
// and pink, and a spiral galaxy that grows out of the dark and is crossed at the cut, then left behind as the
// destination unfolds. Same length as before; nothing but the shader changes.
export const LENS = { einstein: 2.3, chroma: 0.035, ring: 1.1, disc: 1.55 };

export const LENS_FRAGMENT = `uniform sampler2D tDiffuse;
  uniform vec2 center;
  uniform float aspect;
  uniform float horizon;
  uniform float spin;
  uniform float time;
  uniform float glow;
  uniform float voyage;
  varying vec2 vUv;
  vec2 toPlane(vec2 uv){
    vec2 p=uv-center;
    if(aspect>=1.)p.x*=aspect;
    else p.y/=aspect;
    return p;
  }
  vec2 toUv(vec2 p){
    if(aspect>=1.)p.x/=aspect;
    else p.y*=aspect;
    return p+center;
  }
  // Mirror at the frame edges, so the bent view never samples outside it.
  vec2 fold(vec2 uv){
    return 1.-abs(1.-mod(uv,2.));
  }
  vec2 bend(vec2 p,float e){
    float r2=max(dot(p,p),1e-6);
    return p*(1.-e*e/r2);
  }
  float sHash(vec2 c){
    return fract(sin(dot(c,vec2(127.1,311.7)))*43758.5453);
  }
  // One layer of stars (cells per unit across), flown through: they stream out from the middle and stretch
  // radially as they pass.
  float starLayer(vec2 p,float cells,float speed,float seed){
    float r=max(length(p),1e-4);
    vec2 dir=p/r;
    // Flying forward: the field expands from the centre (a point at r was at r/zoom a moment ago).
    float zoom=exp(voyage*speed);
    vec2 q=p/zoom*cells+seed*17.;
    vec2 cell=floor(q),f=fract(q)-.5;
    float h=sHash(cell+seed);
    if(h<.72)return 0.;
    vec2 off=vec2(sHash(cell+3.1),sHash(cell+7.7))-.5;
    vec2 d=f-off*.6;
    // Streak along the radius, longer for faster layers and further out.
    float along=dot(d,dir),across=dot(d,vec2(-dir.y,dir.x));
    float len=1.+speed*r*2.2;
    return smoothstep(.09,0.,length(vec2(along/len,across)))*(.4+.6*fract(h*13.));
  }
  // Deep space seen through the horizon (p in screen-plane units, centred on the hole).
  vec3 cosmos(vec2 p){
    float r=length(p),a=atan(p.y,p.x+1e-5);
    // Nebulae: soft clouds in the portal's colours, drifting outward as we fly.
    vec2 n=p*(1.6-voyage*.8);
    float cloud=.5+.25*sin(n.x*3.1+sin(n.y*2.3+time*.2)*1.7)+.25*sin(n.y*2.7-n.x*1.3+voyage*2.);
    vec3 neb=mix(vec3(.04,.22,.32),vec3(.2,.05,.34),.5+.5*sin(a*1.5+voyage*3.))+vec3(.28,.04,.18)*
        smoothstep(.7,1.,cloud);
    vec3 c=vec3(.002,.003,.012)+neb*neb*cloud*.45;
    // The galaxy: a two-armed log spiral that grows as we close on it; at the cut (voyage ~.5) we pass its disc.
    float g=.06*exp(voyage*4.6),gr=r/g,ga=a+voyage*1.4;
    float arms=pow(.5+.5*cos(2.*(ga-log(max(gr,1e-3))*2.2)),3.);
    float disc=(exp(-gr*1.3)*(.15+.75*arms)+exp(-gr*gr*9.)*.7)*.55;
    c+=mix(vec3(.55,.75,1.),vec3(1.,.8,.95),.5+.5*sin(ga))*disc*(1.-smoothstep(.55,.72,voyage)*.85);
    c+=vec3(.9,.95,1.)*(starLayer(p,9.,.6,1.)*.6+starLayer(p,17.,1.6,2.)*.5+starLayer(p,30.,3.,3.)*.45);
    return c;
  }
  void main(){
    vec4 base=texture2D(tDiffuse,vUv);
    if(horizon<=1e-4){
      gl_FragColor=base;
      return;
    }
    vec2 p=toPlane(vUv);
    float r=length(p),rs=horizon,a=atan(p.y,p.x+1e-5);
    // Frame dragging: the view twists harder towards the horizon.
    float twist=spin*rs*rs/max(r*r,rs*rs*.8);
    float c=cos(twist),s=sin(twist);
    vec2 q=mat2(c,-s,s,c)*p;
    float e=rs*${LENS.einstein.toFixed(3)};
    vec3 color=vec3(texture2D(tDiffuse,fold(toUv(bend(q,e*(1.+${LENS.chroma.toFixed(3)}))))).r,
    texture2D(tDiffuse,fold(toUv(bend(q,e)))).g,
    texture2D(tDiffuse,fold(toUv(bend(q,e*(1.-${LENS.chroma.toFixed(3)}))))).b);
    // Light climbing out of the well dims and reddens near the horizon.
    float well=smoothstep(rs,rs*2.2,r);
    color*=mix(vec3(.55,.35,.5),vec3(1.),well);
    // Accretion swirl: bright streams spiralling in, hotter on the side turning towards the viewer.
    float d=(r-rs*${LENS.disc.toFixed(3)})/(rs*.45);
    float streams=.55+.45*sin(a*7.-log(max(r,1e-3))*9.+time*5.*sign(spin+1e-3));
    float beam=.55+.45*sin(a+time*.8);
    // In the portal's own colours: turquoise and violet streams with pink between (the vortex reference).
    float hue=.5+.5*sin(a*2.-time);
    color+=mix(mix(vec3(.08,.75,1.),vec3(.45,.15,1.),hue),vec3(1.,.25,.75),smoothstep(.7,1.,streams)*.5)*
        exp(-d*d)*streams*beam*1.2*glow;
    // Photon ring: a thin, very bright circle just outside the horizon.
    float pr=(r-rs*${LENS.ring.toFixed(3)})/(rs*.035+.002);
    color+=vec3(.82,.95,1.)*exp(-pr*pr)*(1.2+.8*beam)*glow;
    // Inside the horizon: deep space, flown through (it was a black disc).
    float inside=1.-smoothstep(rs*.97,rs*1.03,r);
    color=mix(color,cosmos(p),inside);
    gl_FragColor=vec4(color,base.a);
  }`;

export const LENS_VERTEX = `varying vec2 vUv;
    void main(){
      vUv=uv;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
    }`;

// The lens as a pass for three's EffectComposer (the same contract as its ShaderPass: one full-screen triangle
// drawn with the previous pass's frame as tDiffuse), built from the garden's own THREE. `uniforms` is live.
export function createLensPass(THREE) {
  const uniforms = {
      tDiffuse: { value: null },
      center: { value: new THREE.Vector2(0.5, 0.5) },
      aspect: { value: 1 },
      horizon: { value: 0 },
      spin: { value: 0 },
      time: { value: 0 },
      glow: { value: 1 },
      voyage: { value: 0 }
    },
    geometry = new THREE.BufferGeometry(),
    material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: LENS_VERTEX,
      fragmentShader: LENS_FRAGMENT,
      depthTest: false,
      depthWrite: false
    }),
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, 3, 0, -1, -1, 0, 3, -1, 0], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 2, 0, 0, 2, 0], 2));
  const quad = new THREE.Mesh(geometry, material);
  quad.frustumCulled = false;
  return {
    enabled: false,
    needsSwap: true,
    clear: false,
    renderToScreen: false,
    uniforms,
    setSize() {},
    render(renderer, writeBuffer, readBuffer) {
      uniforms.tDiffuse.value = readBuffer.texture;
      renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
      if (this.clear && !this.renderToScreen)
        renderer.clear(renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil);
      renderer.render(quad, camera);
    },
    // The pass's program, made ahead for the target it draws into: first drawn mid-crossing, it was compiled there
    // (a 60 ms stall at the jump, round 22).
    compile(renderer, target) {
      const previous = renderer.getRenderTarget();
      renderer.setRenderTarget(target);
      try {
        return renderer.compileAsync(quad, camera);
      } finally {
        renderer.setRenderTarget(previous);
      }
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

// The hole over a crossing's normalised time (the camera cuts at `cut`): it opens small in the portal, swallows
// the screen just before the cut, stays black across it, then unfolds the destination spinning the other way.
// How far through space the visitor has flown: from the hole's birth to the end of the unfolding.
export function voyageAt(t) {
  const x = Math.min(1, Math.max(0, (t - 0.18) / 0.72));
  return x * x * (3 - 2 * x);
}
export function lensShape(t, cut = 0.55) {
  const clamp01 = x => Math.min(1, Math.max(0, x)),
    smooth = x => x * x * (3 - 2 * x),
    full = 1.15;
  if (t < cut) {
    const seed = 0.11 * smooth(clamp01((t - 0.18) / 0.22)),
      swallow = smooth(clamp01((t - (cut - 0.1)) / 0.1));
    return { horizon: seed + (full - seed) * swallow, spin: 2.2 + 3 * swallow, glow: 1, voyage: voyageAt(t) };
  }
  const unfold = smooth(clamp01((t - cut - 0.02) / 0.3));
  return {
    horizon: full * (1 - unfold),
    spin: -2.6 * (1 - unfold),
    glow: 1 - 0.5 * unfold,
    voyage: voyageAt(t)
  };
}
