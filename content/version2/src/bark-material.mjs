// Procedural bark for broadleaf wood. The photo bark (a Jacaranda map) read as planed wood grain, so it is now
// only a faint micro-detail; furrows, plates, birch lenticels, the dark mossy foot and the bump come from
// texture-free noise. Wood UVs (tree-structure woodTube) are tiles around × tiles along with a whole number of
// tiles around every tube, and the noise repeats once per tile around, so the pattern closes at the seam.

// Shared shape of the pattern, in UV tiles (one tile is BARK.tile metres).
export const BARK = {
  tile: 0.9, // metres per UV unit, as woodTube
  foot: 1.1, // metres above the trunk's start over which the foot darkens (the trunk starts below the lawn)
  limbStart: 4, // metres: limbs and twigs start their along-coordinate here, so they get no dark foot
  bumpFar: 34, // metres: bump and fine contrast fade out by this distance to avoid shimmer
  bumpNear: 9
};

// Per material: tone (linear-ish sRGB multiplier), furrow darkness, bump depth in metres, plates per tile
// around, moss at the foot, birch mode (pale bark with dark lenticels and a dark rough foot), and an optional
// upper tone (Scots pine: thin flaking orange bark above 'upper' metres along the wood; 0 keeps one tone).
export const BARK_SPECIES = {
  // Common broadleaf (lime/elm-like): grey-brown, interlaced vertical furrows.
  broadleaf: { tone: 0x6e6359, furrow: 0.62, bump: 0.016, plates: 11, moss: 0.55, birch: 0 },
  // The old central tree: darker, deeper and wider plates.
  old: { tone: 0x645850, furrow: 0.66, bump: 0.024, plates: 9, moss: 0.45, birch: 0 },
  // Birch: chalky white, horizontal lenticels, black patches, dark fissured foot.
  birch: { tone: 0xd9d6cc, furrow: 0.3, bump: 0.008, plates: 7, moss: 0.25, birch: 1 },
  // Scots pine: deep grey-brown plates low on the trunk, smooth orange bark on the upper trunk and limbs.
  pine: {
    tone: 0x6a5046,
    furrow: 0.7,
    bump: 0.02,
    plates: 6,
    moss: 0.3,
    birch: 0,
    upper: 1.5,
    upperTone: 0xe2864a
  }
};
// Metres over which the pine's lower bark turns into the orange upper bark.
const UPPER_BLEND = 1.4;
// Pine wood shares the broadleaf material (one draw call for both): pineWoodUV mirrors its around-coordinate
// below zero, and the shader switches to these pine constants there. The noise is periodic, so the
// mirrored pattern still closes at the seam.
const linear = hex =>
  [16, 8, 0].map(shift => {
    const c = ((hex >> shift) & 255) / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
const vec = values => `vec${values.length}(${values.map(v => v.toFixed(4)).join(',')})`;
const PINE = BARK_SPECIES.pine,
  PINE_GLSL = `
const vec3 PINE_TONE=${vec(linear(PINE.tone))};
const vec4 PINE_SHAPE=${vec([PINE.furrow, PINE.bump, PINE.plates, PINE.moss])};
const vec4 PINE_UPPER=${vec([...linear(PINE.upperTone), PINE.upper])};`;
// Marks a pine wood geometry (any woodTube output) for the shared bark material.
export function pineWoodUV(geometry) {
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, -uv.getX(i) - 0.002);
  uv.needsUpdate = true;
  return geometry;
}

const GLSL_COMMON = /* glsl */ `
  varying vec2 vBarkUv;
  uniform vec3 barkTone;
  uniform vec4 barkShape;
  // furrow darkness, bump metres, plates per tile, moss
  uniform float barkBirch;
  uniform vec4 barkUpper;
  // upper tone, start metres (0 = none)
  ${PINE_GLSL}
  // Hash without Sine, David Hoskins (third-party-notices.txt).
  float barkHash(vec2 p){
    vec3 q=fract(vec3(p.xyx)*.1031);
    q+=dot(q,q.yzx+33.33);
    return fract((q.x+q.y)*q.z);
  }
  // Value noise that repeats every 'period' cells along x (period is a whole number).
  float barkNoise(vec2 p,float period){
    vec2 i=floor(p),f=fract(p);
    f=f*f*(3.-2.*f);
    float x0=mod(i.x,period),x1=mod(i.x+1.,period);
    return mix(mix(barkHash(vec2(x0,i.y)),barkHash(vec2(x1,i.y)),f.x),
    mix(barkHash(vec2(x0,i.y+1.)),barkHash(vec2(x1,i.y+1.)),f.x),f.y);
  }
  // Relief, 0 in a furrow .. 1 on a plate top. Slow sideways wander, then elongated cells: their mid-value
  // isolines are the interlaced vertical furrows, finer cracks split the plates. fw widens cracks far away.
  float barkFurrows(vec2 q,float plates,float fw){
    float wander=barkNoise(vec2(q.x*2.,q.y*.55),2.)-.5;
    vec2 g=vec2(q.x*plates+wander*2.8,q.y*1.1);
    float n=barkNoise(g,plates),n2=barkNoise(g*vec2(2.,1.7)+vec2(0.,5.3),plates*2.);
    float crack=1.-smoothstep(.04,.34+fw,abs(n*2.-1.));
    crack=max(crack,.35*(1.-smoothstep(.02,.14+fw,abs(n2*2.-1.))));
    return (1.-crack)*(.7+.3*n2);
  }
  // Birch: smooth with short horizontal lenticel dashes; the foot (rough 1) is fissured like other bark.
  float barkRelief(vec2 q,float plates,float fw,float rough){
    float h=barkFurrows(q,plates,fw);
    if(barkBirch<.5)return h;
    float lp=floor(plates*.7+.5),dash=smoothstep(.8,.9+fw*.3,barkNoise(vec2(q.x*lp,q.y*16.),lp));
    return mix(1.-.6*dash,h,rough);
  }`;

// Runs in place of map_fragment. The bump below needs the relief gradient: it is taken from two extra
// relief samples a few millimetres away in bark space, then mapped to the screen through the smooth UV
// derivatives. (dFdx of the thresholded relief itself steps per 2×2 pixel block and showed as pixel mosaic.)
const GLSL_COLOUR = `
  vec2 barkSlope=vec2(0.);
  // Pine wood: mirrored around-coordinate (pineWoodUV).
  float barkPine=1.-step(0.,vBarkUv.x);
  vec2 barkQ=vec2(abs(vBarkUv.x),vBarkUv.y);
  vec4 barkForm=mix(barkShape,PINE_SHAPE,barkPine);
  float barkDetail=1.-smoothstep(${BARK.bumpNear.toFixed(1)},${BARK.bumpFar.toFixed(1)},length(vViewPosition));
  {
    vec2 q=barkQ;
    float plates=max(1.,floor(barkForm.z+.5));
    float fw=max(fwidth(q.x*plates),fwidth(q.y*1.1))*.8;
    float along=q.y*${BARK.tile.toFixed(2)};
    float foot=1.-smoothstep(.0,${BARK.foot.toFixed(2)},along);
    float blotch=barkNoise(vec2(q.x*3.,q.y*1.1)+vec2(0.,9.1),3.);
    float rough=barkBirch>.5?smoothstep(.1,.9,foot*1.6+(blotch-.5)*.5):1.;
    float h=barkRelief(q,plates,fw,rough);
    const float e=.004;
    barkSlope=vec2(barkRelief(q+vec2(e,0.),plates,fw,rough)-h,barkRelief(q+vec2(0.,e),plates,fw,rough)-h)/e;
    vec3 tone=mix(barkTone,PINE_TONE,barkPine);
    vec4 upperBark=barkPine>.5?PINE_UPPER:barkUpper;
    float shade=mix(1.-barkForm.x,1.,h);
    if(barkBirch>.5){
      // Sparse black scars on the white bark; the fissured foot is dark grey-brown.
      float scar=smoothstep(.72,.8,barkNoise(vec2(q.x*2.,q.y*2.4)+vec2(0.,1.7),2.));
      shade=mix(min(shade,1.-.8*scar),shade*.55,rough);
      tone=mix(tone,vec3(.36,.33,.3),rough);
    }
    if(upperBark.w>0.){
      // Thin flaking upper bark: little furrow shade, papery patches a touch lighter.
      float up=smoothstep(upperBark.w,upperBark.w+${UPPER_BLEND.toFixed(2)},along);
      tone=mix(tone,upperBark.rgb*(.9+.2*blotch),up);
      shade=mix(shade,mix(.84,1.,h),up);
    }
    // Lichen-grey blotches up the trunk; darker, mossy green at the foot.
    tone*=.86+.28*blotch;
    vec3 moss=vec3(.32,.36,.2)*(.7+.3*h);
    tone=mix(tone,moss,foot*barkForm.w*smoothstep(.35,.75,blotch+.25*h));
    tone*=mix(1.,.62,foot*foot);
    shade=mix(.8,shade,barkDetail);
    #ifdef USE_MAP
      vec3 photo=texture2D(map,vMapUv).rgb;
      shade*=.8+.45*dot(photo,vec3(.2126,.7152,.0722));
    #endif
    diffuseColor.rgb*=tone*shade;
  }`;

// Bump from the relief gradient (Mikkelsen's surface-gradient method, no tangents needed).
const GLSL_BUMP = `
  {
    vec3 barkDx=dFdx(-vViewPosition),barkDy=dFdy(-vViewPosition);
    vec2 barkUx=dFdx(barkQ),barkUy=dFdy(barkQ);
    float barkHx=dot(barkSlope,barkUx),barkHy=dot(barkSlope,barkUy);
    vec3 barkR1=cross(barkDy,normal),barkR2=cross(normal,barkDx);
    float barkDet=dot(barkDx,barkR1);
    // Relief changes per pixel times the depth in metres: the surface gradient of the bumped height.
    vec3 barkGrad=sign(barkDet)*(barkHx*barkR1+barkHy*barkR2)*barkForm.y*barkDetail;
    vec3 barkN=abs(barkDet)*normal-barkGrad;
    // Degenerate derivatives (edge-on pixels) keep the unbumped normal instead of normalising zero.
    if(dot(barkN,barkN)>1e-24)normal=normalize(barkN);
  }`;

/**
 * A MeshStandardMaterial with procedural bark. `map` (optional photo bark) adds micro-detail only.
 * Chain other onBeforeCompile hooks (e.g. bark snow) after this one; it keeps every include it replaces.
 */
export function createBarkMaterial(
  THREE,
  { species = 'broadleaf', map = null, normalMap = null, name } = {}
) {
  const s = BARK_SPECIES[species] || BARK_SPECIES.broadleaf,
    material = new THREE.MeshStandardMaterial({
      name: name || 'bark-' + species,
      color: 0xffffff,
      map,
      normalMap,
      roughness: 0.93,
      metalness: 0
    });
  if (normalMap) material.normalScale.set(0.35, 0.35);
  const uniforms = {
    barkTone: { value: new THREE.Color(s.tone) },
    barkShape: { value: new THREE.Vector4(s.furrow, s.bump, s.plates, s.moss) },
    barkBirch: { value: s.birch },
    barkUpper: {
      value: new THREE.Vector4(...new THREE.Color(s.upperTone || 0).toArray(), s.upper || 0)
    }
  };
  material.userData.barkUniforms = uniforms;
  material.userData.barkSpecies = species;
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vBarkUv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvBarkUv=uv;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + GLSL_COMMON)
      .replace('#include <map_fragment>', GLSL_COLOUR)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + GLSL_BUMP);
  };
  material.customProgramCacheKey = () => 'garden-bark-v1';
  return material;
}
