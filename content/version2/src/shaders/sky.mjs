// The sky dome and the clouds' shaders, one statement a line (owner, 2026-11-01: readable shaders apart from the
// code). backdrop.mjs builds the materials and sets their uniforms.

// The sky dome: the day gradient, sun glow and shafts, the painted cloud layer, twilight, the night with stars and the
// aurora curtains (uniforms in backdrop.mjs skyMaterial).
export const SKY_VERTEX = `
  varying vec3 direction;
  void main(){
    direction=position;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
  }
`;

export const SKY_FRAGMENT = `
  varying vec3 direction;
  uniform float diffuseLimit;
  uniform vec3 top;
  uniform vec3 horizon;
  uniform vec3 low;
  // The sunset's red sky toward the sun and on the far side, and its rose blush (world.mjs: sunset variants).
  uniform vec3 redNear;
  uniform vec3 redFar;
  uniform vec3 blushTint;
  uniform vec3 sunColor;
  uniform float sunStrength;
  uniform vec3 sunDir;
  uniform vec3 sunView;
  uniform float sunScale;
  uniform vec3 glow;
  uniform float aurora;
  uniform float skyTime;
  uniform vec3 auroraLow;
  uniform vec3 auroraHigh;
  uniform vec3 auroraMid;
  uniform vec3 auroraTip;
  uniform float auroraCoolSpread;
  uniform float auroraFull;
  uniform float auroraGain;
  uniform float stars;
  uniform float dawn;
  uniform float skyDetail;
  uniform vec4 weather;
  uniform vec2 cloudSeed;
  // Hash without Sine, David Hoskins (third-party-notices.txt).
  float skyHash(vec2 p,float period){
    p.x=mod(p.x,period);
    vec3 q=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));
    q+=dot(q,q.yzx+33.33);
    return fract((q.x+q.y)*q.z);
  }
  float skyNoise(vec2 p,float period){
    vec2 i=floor(p),f=fract(p);
    f=f*f*(3.-2.*f);
    return mix(mix(skyHash(i,period),skyHash(i+vec2(1,0),period),f.x),
        mix(skyHash(i+vec2(0,1),period),skyHash(i+vec2(1,1),period),f.x),f.y);
  }
  // Value noise along the horizon (x wraps every period cells), with its slope.
  float auroraNoise(float x,float period,float seed,out float slope){
    float i=floor(x),f=fract(x),a=skyHash(vec2(i,seed),period),b=skyHash(vec2(i+1.,seed),period);
    slope=(b-a)*6.*f*(1.-f);
    return mix(a,b,f*f*(3.-2.*f));
  }
  // One aurora curtain seen from afar: s runs 0…1 around the horizon. Its bright lower edge folds up and
  // down; fine rays rise from it, taller where the edge is higher (a nearer curtain), and fade into the
  // season-tinted fringe. The edge is brighter where it folds steeply (the sheet seen edge-on).
  // Returns the weights of the lower and the upper colour.
  vec3 auroraCurtain(float s,float h,float seed,float base,float rise,float t){
    float slopeA,slopeB,unused;
    float fold=auroraNoise(s*22.+t*.02+seed*3.1,22.,3.+seed,slopeA)*.8+
        auroraNoise(s*61.-t*.05,61.,5.+seed,slopeB)*.2;
    float kink=.75+.6*smoothstep(4.,22.,abs(slopeA*17.6+slopeB*12.2));
    float edge=base+rise*fold,above=h-edge,lift=max(above,0.),warp=fold*3.;
    float rays=auroraNoise(s*560.+warp*8.+t*.3,560.,2.+seed,unused)*.55+
        auroraNoise(s*1400.+warp*20.,1400.,4.+seed,unused)*.45;
    // Rays come in bundles: where they are taller they are also brighter.
    float bundle=auroraNoise(s*160.+warp*2.,160.,9.+seed,unused);
    float fine=rays*rays*rays,span=.02+edge*1.1,reach=span*(.6+.8*bundle);
    // Each bundle slowly brightens and dims on its own (gentle shimmer, never a flash).
    float shimmer=.55+.9*auroraNoise(s*90.-t*.09,90.,11.+seed,unused);
    rays=fine*(.6+1.8*bundle)*shimmer;
    // A thin bright line right at the lower edge, a broader glow above it and the rays.
    float hem=exp(-lift*70.)*.35+exp(-lift/(reach*.4))*(.55+.45*rays)*.6,
        body=exp(-lift/(reach*.8))*(.3+.7*rays);
    // The season colour is a soft, even glow over the ray tops (not bundled, so it never forms bars).
    float fringe=smoothstep(.3*span,span,above)*exp(-lift/(span*1.2))*(.6+.6*fine);
    // A faint skirt of diffuse glow under the edge, so the dark sky below it does not read as a ridge.
    float skirt=exp(-max(-above,0.)*45.)*.1,inside=smoothstep(-.006,.004,above);
    // Weights of the lower edge colour, of the body above it (where the shifting violet and magenta live)
    // and of the season fringe over the ray tops.
    return vec3(mix(skirt,hem+body*.32,inside),body*.6*inside,fringe*1.05)*kink;
  }
  void main(){
    vec3 d=normalize(direction);
    float h=d.y;
    vec3 color=mix(horizon,top,smoothstep(-.16,.24,h));
    color=mix(color,low,1.-smoothstep(-.30,-.055,h));
    // Sunset: a warm band hugging the horizon, strongest toward the sun, a magenta blush above it and a
    // soft halo around the disc. Only smoothstep and dot products, so no NaN can reach the glow pass.
    float sunsetSky=clamp((horizon.r-horizon.b)*2.,0.,1.)*sunStrength;
    vec3 flat2=vec3(d.x,0.,d.z)+vec3(1e-4,0.,1e-4),sunFlat=vec3(sunDir.x,0.,sunDir.z)+vec3(1e-4,0.,1e-4);
    float toward=dot(normalize(flat2),normalize(sunFlat))*.5+.5;
    // Closeness to the disc where it is seen, scaled like the disc, so the glow round the sun stays on it from
    // any camera position (it used to sit where the disc would be seen from the garden's centre).
    float near=1.-(1.-dot(d,sunView))/(sunScale*sunScale);
    // Height measured from the disc as the centre sees it, for the glow that hugs the horizon under the sun.
    float hSun=sunDir.y+(h-sunView.y)/sunScale;
    // Daylight (no warm horizon): a deeper zenith, a paler horizon and a wide forward-scattering glow
    // around the sun, so the blue has depth instead of one flat wash.
    float daySky=sunStrength*(1.-sunsetSky);
    color=mix(color,top*vec3(.8,.87,1.),smoothstep(.3,.95,h)*daySky*.75);
    color=mix(color,horizon*1.06+vec3(.035),(1.-smoothstep(0.,.16,h))*smoothstep(-.08,0.,h)*daySky*.55);
    float scatter=smoothstep(.8,1.,near);
    color+=sunColor*scatter*scatter*.06*daySky;
    // Dawn keeps the sunset band but in peach and rose-gold, lower and softer, with a pale lilac blush.
    float dawnVivid=clamp((horizon.r-horizon.b-.35)*3.,0.,1.);
    vec3 dawnGold=mix(vec3(1.,.75,.64),vec3(1.,.39,.28),dawnVivid);
    vec3 glowTint=mix(mix(vec3(1.,.42,.61),vec3(1.,.36,.12),toward*.65),dawnGold,dawn);
    // A restrained coral accent toward the sunset; dawn keeps its existing rose-gold.
    glowTint=mix(glowTint,vec3(1.,.18,.10),.55*toward*toward*toward*toward*(1.-dawn));
    float band=(1.-smoothstep(.015,.17,abs(h-.02)))*smoothstep(-.14,-.01,h);
    color=mix(color,glowTint,band*sunsetSky*(.10+.70*toward*toward)*(1.-.12*dawn));
    float blush=smoothstep(.05,.15,h)*(1.-smoothstep(.15,.38,h));
    // The dusk blush is gentler than the dawn one: rose low down, cooling to blue-violet above it.
    color=mix(color,mix(horizon,mix(blushTint,vec3(.53,.65,.86),dawn),.55),blush*sunsetSky*
        (.22+.2*toward)*mix(.5,1.,dawn));
    float dusk=sunsetSky*(1.-dawn);
    color=mix(color,vec3(.12,.10,.40),dusk*smoothstep(.05,.2,h)*(1.-smoothstep(.3,.8,h))*(.5-.25*toward));
    // Sunset (not dawn): a broad deep-red sky like the owner's reference, orange at the sun, crimson further up and
    // on the far side, fading out well below a cool zenith, so the rose blush above it survives (2026-10-27:
    // the warm band alone hugged the horizon, where the ridges hide it, and read orange and pink).
    // A mix, not a red filter (owner, round 2): red only toward the sun, magenta and violet on the far side.
    float redSky=sunsetSky*(1.-dawn)*smoothstep(-.06,.0,h)*(1.-smoothstep(.1,.5,h))*(.2+.8*toward);
    vec3 redTone=mix(redFar,redNear,toward*toward);
    redTone=mix(redTone,vec3(1.,.36,.09),smoothstep(.93,.995,near));
    color=mix(color,redTone,redSky*.42);
    // A bright warm gold horizon band right under the sun, so the red is a gradient from light to deep.
    color+=vec3(.5,.2,.05)*exp(-(1.-near)*30.)*smoothstep(-.04,.03,hSun)*(1.-smoothstep(.04,.22,hSun))*dusk;
    // Dawn: the pink anti-twilight arch opposite the sun and a pale morning mist on the horizon.
    float away=1.-toward;
    color=mix(color,vec3(.9,.56,.66),dawn*away*away*smoothstep(.0,.07,h)*(1.-smoothstep(.1,.26,h))*.5);
    color=mix(color,horizon*1.08+vec3(.05,.045,.06),dawn*(1.-smoothstep(.0,.09,abs(h-.01)))*.45);
    // Broad, quiet shafts near a low sun; no noise samples, geometry or postprocessing.
    vec3 sunUnit=normalize(sunDir+vec3(0,1e-4,0));
    vec3 sunRight=normalize(cross(sunView,vec3(0,1,0))+vec3(1e-4,0,0));
    vec3 sunUp=cross(sunRight,sunView);
    float lowSun=1.-smoothstep(.12,.65,abs(sunUnit.y));
    float shaftA=1.-smoothstep(.005,.055,abs(dot(d,sunUp)));
    float shaftB=1.-smoothstep(.004,.035,abs(dot(d,sunUp)*.8+dot(d,sunRight)*.6));
    float shaftC=1.-smoothstep(.004,.035,abs(dot(d,sunUp)*.8-dot(d,sunRight)*.6));
    float shaftRegion=smoothstep(.94,.995,near)*lowSun*sunStrength;
    float shaftPattern=clamp((shaftA+shaftB*.5+shaftC*.5)/2.,0.,1.);
    float shaftTransmission=1.;
    float halo=smoothstep(.985,1.,near);
    // Sunset depth: a broad pale-gold glow round the sun (light to deep outward), and violet higher up, away from it.
    color+=vec3(.30,.13,.06)*exp(-(1.-near)*9.)*smoothstep(-.05,.04,hSun)*(1.-smoothstep(.1,.5,hSun))*dusk;
    color=mix(color,vec3(.36,.18,.60),dusk*smoothstep(.2,.5,h)*(1.-smoothstep(.55,.95,h))*.2*(1.-.5*toward));
    color+=mix(sunColor,vec3(1.,.48,.18),dusk*.8)*halo*halo*(.09+.04*sunsetSky)*sunStrength;
    // Stars: a hashed grid on a stereographic view of the upper sky, a few brighter ones, slow twinkle. At
    // dawn the last of them linger high up, away from the sun. Drawn before the clouds, which hide them.
    float starLevel=max(stars,dawn*.55*away*smoothstep(.3,.75,h));
    if(starLevel>.001&&h>.02){
      vec2 starUv=d.xz/(1.+d.y)*190.;
      vec2 starCell=floor(starUv),starIn=fract(starUv)-.5;
      float starSeed=skyHash(starCell,4096.);
      float starOn=step(.986,starSeed);
      float starSize=mix(.1,.2,skyHash(starCell+7.,4096.));
      float starDot=1.-smoothstep(starSize*.35,starSize,length(starIn));
      float twinkle=.65+.35*sin(skyTime*1.7+starSeed*80.);
      color+=vec3(.86,.9,1.)*starOn*starDot*twinkle*smoothstep(.02,.22,h)*starLevel*.9;
    }
    // Distant cirrus belongs to the existing sky draw; nearby cloud meshes retain their depth. By day it
    // steps back for the dome clouds; at sunset it is the orange streaking the owner likes, unchanged.
    float sunset=clamp((horizon.r-horizon.b)*2.,0.,1.)*sunStrength;
    if(h>-.24&&h<.40){
      vec2 uv=vec2((atan(d.x,d.z)/6.2831853+.5)*64.,(h+.26)*96.);
      uv.x+=sin(uv.y*.63)*.24;
      float broad=skyNoise(uv,64.),detail=skyNoise(uv*3.+vec2(0,8),192.);
      float field=broad*.72+detail*.28;
      float density=smoothstep(.60,.76,field)*smoothstep(-.24,-.16,h)*(1.-smoothstep(.27,.40,h));
      vec3 cool=mix(top,low,.40),warm=mix(vec3(1.,.44,.66),dawnGold,dawn);
      vec3 cloud=mix(cool,warm,sunset*(.72+.28*detail));
      color=mix(color,cloud,density*(.20+sunStrength*.38)*(.45+.55*sunset));
      shaftTransmission*=1.-density*(.20+sunStrength*.38)*(.45+.55*sunset);
    }
    // Dome clouds over the whole sky: high cirrus streaks and a low deck of soft cumulus, both projected on
    // flat decks (they shrink and crowd toward the horizon), with a slow coverage field so clear and cloudy
    // regions alternate with no edge. Cumulus are lit on the side toward the sun (one offset sample).
    // They evolve: every octave drifts at its own speed and heading, so shapes grow, split and dissolve
    // rather than slide as one picture. The weather (amount and size of cumulus, cirrus, a milky veil) and a
    // per-visit seed come from the page; the time of day sets their character.
    if(h>-.06){
      float t=skyTime;
      vec2 wind=vec2(t*.004,t*.0015);
      // Character: dawn stretches the deck into thin pink streaks, sunset into long lit bands; daylight is
      // crisp, other light softer.
      float dayLook=sunStrength*(1.-sunsetSky)*(1.-dawn);
      float bands=max(dawn,sunset*(1.-dawn));
      vec2 high=d.xz/(max(h,0.)+.3);
      vec2 streak=vec2(high.x*.8-high.y*.6,high.x*.6+high.y*.8);
      streak=streak*vec2(1.3,8.)+wind*3.+cloudSeed;
      streak.x+=sin(streak.y*.35)*.8;
      float ci=skyNoise(streak+vec2(t*.0021,0.),4096.)*.65+
          skyNoise(streak*vec2(2.6,1.7)+vec2(5.2,3.1)-vec2(t*.0052,t*.003),4096.)*.35;
      float ciCover=skyNoise(high*.45+vec2(2.3,9.1)+cloudSeed*.37+vec2(t*.0013,-t*.0007),4096.);
      float ciLo=.55-.5*weather.z;
      float ciD=smoothstep(.56,.86,ci)*smoothstep(ciLo,ciLo+.38,ciCover)*smoothstep(.02,.16,h)*(1.-.5*dusk);
      vec3 ciLit=mix(vec3(.93,.94,.97),mix(vec3(.96,.51,.73),dawnGold,dawn),sunset*.9);
      ciLit=mix(ciLit,vec3(.75,.84,1.),dawn*(1.-toward)*.65);
      vec3 ciCol=mix(mix(top,horizon,.5),ciLit,.35+.65*sunStrength);
      // A high milky veil (cirrostratus): no extra noise, only the cirrus coverage field.
      float veilD=weather.w*smoothstep(.0,.3,h)*(.45+.55*ciCover)*(.1+.25*sunStrength);
      color=mix(color,ciCol,veilD);
      color=mix(color,ciCol,ciD*(.06+.46*sunStrength));
      shaftTransmission*=(1.-veilD)*(1.-ciD*(.06+.46*sunStrength));
      vec2 deck=d.xz/(max(h,0.)+.07);
      // Bands: squeeze the deck across the sun's direction so cloud lies in long strips.
      vec2 sunAxis=normalize(sunDir.xz+vec2(1e-4,0.));
      vec2 along=vec2(dot(deck,sunAxis),dot(deck,vec2(-sunAxis.y,sunAxis.x)));
      // (Dusk strips are less stretched than dawn ones, so they do not fan out like spokes overhead.)
      deck=mix(deck,along*vec2(1.+1.6*dawn+.8*dusk,mix(.72,.55,dawn)),bands);
      vec2 cp=deck*2.3*weather.y+wind+cloudSeed;
      vec2 o2=vec2(17.1,9.3)+vec2(-t*.0061,t*.0043),o3=vec2(3.7,1.9)+vec2(t*.0094,t*.0071),
          o4=vec2(9.4,6.2)-vec2(t*.016,t*.006);
      // Owner, round 5: the clouds read as smeared paint. The low octave now bends the finer ones (a domain
      // warp: masses billow and curl instead of lying as smooth blobs), and the finer octaves fold
      // into puffs (billows: |2n-1|, round bumps on both sides of the mean) along the edges. The warp's second axis is the cirrus coverage field,
      // already sampled: the sky keeps its ten noise samples. At dawn and sunset (long lit bands) the fine octaves
      // stay smooth as before: there the folds drew veins through the bands.
      float n1=skyNoise(cp,4096.);
      vec2 cuWarp=vec2(n1-.5,ciCover-.5)*.55;
      float n2=skyNoise(cp*2.03+o2+cuWarp,4096.),n3=skyNoise(cp*4.1+o3+cuWarp*1.7,4096.);
      float n4=skyDetail>.5?skyNoise(cp*8.3+o4+cuWarp*2.4,4096.):.5;
      float cu=(n1*.5+n2*.25+mix(abs(2.*n3-1.),n3,bands)*.125+mix(abs(2.*n4-1.),n4,bands)*.0625)/.9375;
      float cover=skyNoise(deck*.16+vec2(11.3,4.7)+cloudSeed*.21+vec2(t*.0009,t*.0011),4096.);
      // Thin streaks need more air between them; crisp edges by day, soft at dawn, sunset and night. In fair
      // weather the coverage field leads, so the few clouds gather in groups instead of scattered flecks.
      // The broad cirrus coverage field (already sampled, no extra noise) also opens gaps and gathers bigger
      // masses in the cumulus (not at dawn: that look is kept).
      float edge=mix(.8,.5,weather.x)-(.2+.3*(1.-weather.x))*(cover-.5)+.06*dawn-.22*(ciCover-.5)*(1.-dawn);
      float cuD=smoothstep(edge,edge+mix(.16,.07,dayLook),cu);
      // Sparser toward the zenith and near the sunset band, which stays as it was.
      cuD*=smoothstep(-.03,.05,h)*(1.-.35*smoothstep(.45,1.,h))*
          (1.-.65*sunset*(1.-dawn)*(1.-smoothstep(.12,.4,h)));
      vec2 sp=cp+sunAxis*.22;
      // The side toward the sun is lit: the broad octave one step toward it (the finer octave is shared).
      float lit=clamp(.55+(n1-skyNoise(sp,4096.))*2.5,0.,1.);
      // Volume: a cloud's mass seen from below has a flat, shaded base. Where the mass grows toward the zenith (up
      // the screen) this pixel is under it: the base; where it thins upward, the lit top. The broad octave one
      // step toward the zenith on the deck.
      vec2 upDeck=cp-normalize(deck+vec2(1e-4,0.))*.2;
      float base=clamp((skyNoise(upDeck,4096.)-n1)*2.5,0.,1.);
      vec3 cuShade=mix(mix(top,horizon,.6)*vec3(.8,.84,.95),
          mix(vec3(.25,.26,.46),vec3(.30,.43,.62),dawn),sunset*.72);
      // Sunset: gold-orange tops toward the sun, rose away from it (no uniform pink).
      vec3 cuLit=mix(vec3(.9,.9,.89),
          mix(mix(vec3(.95,.5,.72),vec3(1.,.6,.34),toward*toward),dawnGold,dawn),sunset);
      cuLit=mix(cuLit,vec3(.65,.78,.98),dawn*(1.-toward)*.75);
      // Sunset bands: the lit side glows hotter.
      cuLit*=1.+.18*sunset*(1.-dawn);
      float litFace=mix(lit,lit*lit,.65*sunset);
      vec3 cuCol=mix(cuShade,cuLit,clamp(litFace*(.3+.7*sunStrength)+.1*(1.-cuD),0.,1.));
      // Silver lining on thin edges near the sun; distant cumulus fade into the horizon haze.
      // Body shading: the thick core on the side away from the sun is cool and dim; thin edges stay bright.
      float thick=smoothstep(edge,edge+.34,cu);
      cuCol=mix(cuCol,cuShade,(1.-lit)*thick*.45*(1.-dawn));
      cuCol+=cuLit*(1.-thick)*lit*.1*(1.-dawn);
      // The base: darker and cooler under thick masses by day; at dawn and sunset the light stays as it was.
      cuCol=mix(cuCol,cuShade*vec3(.86,.88,.96),base*thick*.6*sunStrength*(1.-dawn)*(1.-.7*sunset));
      cuCol+=mix(sunColor,mix(vec3(1.,.40,.64),dawnGold,dawn),.55)*smoothstep(.97,1.,near)*cuD*(1.-cuD)*
          (.35+lowSun*.2)*sunStrength;
      cuCol=mix(cuCol,horizon,(1.-smoothstep(.0,.22,h))*.25);
      // At night they are faint dark veils, so the stars and the aurora keep the sky.
      color=mix(color,cuCol*(.25+.75*sunStrength),cuD*(.16+.74*sunStrength)*(1.-.35*dawn));
      shaftTransmission*=1.-cuD*(.16+.74*sunStrength)*(1.-.35*dawn);
    }
    // Sunset: inside the sun cone the glow rolls off softly under a lower ceiling instead of meeting the flat cap, so
    // it brightens right up to the disc and, with the rays' hot core on top, stays under the glow threshold: the disc
    // keeps its shape and is the part that blooms.
    float sunCone=shaftRegion*dusk,skyGlow=luminance(color);
    float rolled=skyGlow<.3?skyGlow:.3+.2*(1.-exp(-(skyGlow-.3)/.2));
    color*=mix(1.,rolled/max(skyGlow,.0001),sunCone);
    // Keep contrast inside the small sun cone without lifting clouds above the diffuse ceiling.
    // shaft-budget:start
    float shaftBudget=.12*shaftRegion*shaftTransmission;
    float baseLimit=max(.01,diffuseLimit-shaftBudget);
    color*=mix(1.,min(1.,baseLimit/max(luminance(color),.0001)),smoothstep(0.,.05,sunStrength));
    vec3 shaftTint=mix(sunColor,vec3(1.,.55,.23),.3);
    color+=shaftTint*(shaftBudget*shaftPattern/max(luminance(shaftTint),.0001));
    // Keep broad daylight/cloud fields reflective, not secondary bloom emitters.
    color*=mix(1.,min(1.,diffuseLimit/max(luminance(color),.0001)),smoothstep(0.,.05,sunStrength));
    // shaft-budget:end
    // Aurora on every night: two folded curtains low over the mountains (a far, fainter one behind), long
    // bright arcs with fainter gaps between them, the whole oval turning slowly. It stays below the zenith and
    // adds only a little light, so stars, the moon and the project screens keep the eye. The azimuth is an
    // octant polynomial (no atan); exp and smoothstep only, divisions by values kept above zero.
    if(aurora>.001&&h>0.&&h<.4){
      vec2 across=abs(d.xz);
      float m=min(across.x,across.y)/max(max(across.x,across.y),1e-4);
      float turn=m*(.7853982+.273*(1.-m));
      turn=mix(turn,1.5707963-turn,step(across.y,across.x));
      turn=mix(turn,3.1415927-turn,step(d.z,0.));
      turn=mix(turn,6.2831853-turn,step(d.x,0.));
      float s=fract(turn/6.2831853+skyTime*.0004),unused;
      float arcs=.1+.9*smoothstep(.4,.62,auroraNoise(s*5.,5.,10.,unused));
      float surge=.4+.6*smoothstep(.25,.75,auroraNoise(s*13.+skyTime*.015,13.,7.,unused));
      vec3 veil=auroraCurtain(s,h,0.,.07,.11,skyTime);
      if(auroraFull>.5)veil+=auroraCurtain(s+.031,h,6.,.055,.07,skyTime)*.5;
      veil*=arcs*surge*(1.-smoothstep(.24,.4,h))*aurora*.24*auroraGain;
      // Slow colour waves travel along the curtains (whole turns of s, so nothing breaks where it wraps):
      // the green edge leans to teal and back, violet and magenta drift through the body, and the fringe
      // trades the season tint for a little blue or pink. All sines and mixes: smooth, never banded.
      float waveA=.5+.5*sin(s*18.849556+skyTime*.05);
      float waveB=.5+.5*sin(s*31.415927-skyTime*.037+1.7);
      float waveC=.5+.5*sin(s*12.566371+skyTime*.043+.8*sin(s*25.132741-skyTime*.029));
      vec3 edgeTint=mix(auroraLow,
          vec3(auroraLow.r*.55,auroraLow.g*.92,max(auroraLow.b,auroraLow.g*.86)),waveA*.7);
      // Winter and summer carry their cool season colours through the bright lower ribbons too.
      edgeTint=mix(edgeTint,mix(auroraHigh,auroraMid,.45),auroraCoolSpread*
          (.12+.88*smoothstep(.18,.82,waveA)));
      vec3 bodyTint=mix(edgeTint,mix(auroraMid,auroraTip,waveB*.45),.42+.53*smoothstep(.12,.88,waveC));
      vec3 fringeTint=mix(auroraHigh,auroraTip,waveB*.7);
      color+=edgeTint*veil.x+bodyTint*veil.y+fringeTint*veil.z;
    }
    gl_FragColor=vec4(color,1.);
  #include <colorspace_fragment>
  }
`;

// The cloud puffs: instanced spheres broken into rounded lobes by solid noise, lit by the sun from the side and
// faded at their flat, shaded base (uniforms in backdrop.mjs cloudMaterial).
export const CLOUD_VERTEX = `
  uniform float drift;
  varying vec3 viewNormal;
  varying vec3 cloudNormal;
  varying vec3 viewPosition;
  varying float height;
  varying vec3 lobe;
  void main(){
    lobe=position*2.4+instanceMatrix[3].xyz*.071;
    vec4 p=instanceMatrix*vec4(position,1.);
    p.x+=sin(drift*.050+p.z*.012)*28.;
    p.z+=sin(drift*.027+p.x*.010)*12.;
    vec3 n=mat3(instanceMatrix)*
        vec3(normal.x/dot(instanceMatrix[0].xyz,instanceMatrix[0].xyz),
        normal.y/dot(instanceMatrix[1].xyz,instanceMatrix[1].xyz),
        normal.z/dot(instanceMatrix[2].xyz,instanceMatrix[2].xyz));
    cloudNormal=mat3(modelMatrix)*n;
    vec4 v=modelViewMatrix*p;
    viewNormal=normalMatrix*n;
    viewPosition=-v.xyz;
    height=position.y;
    gl_Position=projectionMatrix*v;
  }
`;

export const CLOUD_FRAGMENT = `
  varying vec3 viewNormal;
  varying vec3 cloudNormal;
  varying vec3 viewPosition;
  varying float height;
  varying vec3 lobe;
  uniform float diffuseLimit;
  uniform vec3 tint;
  uniform vec3 warm;
  uniform vec3 sunDirection;
  uniform float sunStrength;
  // Owner, round 5: these read as flat, smooth discs. Solid value noise on the cloud's own surface (two
  // octaves) breaks the outline into rounded lobes and thins the cloud between them; the lower part is its
  // flat, shaded base.
  // Hash without Sine, David Hoskins (third-party-notices.txt).
  float cloudHash(vec3 p){
    p=fract(p*.1031);
    p+=dot(p,p.zyx+31.32);
    return fract((p.x+p.y)*p.z);
  }
  float cloudNoise(vec3 x){
    vec3 i=floor(x),f=fract(x);
    f=f*f*(3.-2.*f);
    return mix(mix(mix(cloudHash(i),cloudHash(i+vec3(1,0,0)),f.x),
        mix(cloudHash(i+vec3(0,1,0)),cloudHash(i+vec3(1,1,0)),f.x),f.y),
        mix(mix(cloudHash(i+vec3(0,0,1)),cloudHash(i+vec3(1,0,1)),f.x),
        mix(cloudHash(i+vec3(0,1,1)),cloudHash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }
  void main(){
    float facing=abs(dot(normalize(viewNormal),normalize(viewPosition)));
    float lobes=cloudNoise(lobe)*.65+cloudNoise(lobe*2.3+7.1)*.35;
    float soft=smoothstep(.025,.72,facing)*smoothstep(.18,.62,facing*.9+lobes*.55-.12);
    float top=smoothstep(-.60,.85,height),light=max(0.,dot(normalize(cloudNormal),sunDirection));
    vec3 shade=tint*vec3(.58,.64,.94);
    vec3 highlight=mix(tint,warm,.45*sunStrength);
    vec3 color=mix(shade,highlight,top*(.15+.85*light));
    color=mix(color,shade*vec3(.9,.92,1.),(1.-smoothstep(-.55,.05,height))*.45);
    color*=.92+.16*lobes;
    float rim=(1.-facing)*(1.-facing);
    float lowSun=1.-smoothstep(.12,.65,abs(sunDirection.y));
    color=mix(color,tint*vec3(.55,.48,.8),(1.-top)*lowSun*.35);
    color+=mix(warm,tint*1.35,.55)*sunStrength*top*rim*light*(.04+.24*lowSun);
    color*=min(1.,diffuseLimit/max(luminance(color),.0001));
    gl_FragColor=vec4(color,soft*.65);
  #include <colorspace_fragment>
  }
`;
