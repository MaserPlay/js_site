// The water's shader parts, one statement a line (owner, 2026-11-01: readable shaders apart from the code).
// water-effects.mjs configureWaterMaterial puts them into three's standard material: pools with depth, caustics and
// ripples, the sky (or Ultra's cube map) mirrored in them, and the glowing falls with their streaks and foam.
import { POND_EDGE_GLSL } from '../pond-shape.mjs';

const glsl = value => value.toFixed(4);

// falls: FALLS (water-effects.mjs), the lip speed, gravity and streak count the sheets are drawn with.
export function waterShaders(falls) {
  // Seconds since the water passed the lip (negative upstream), fallAge in water-effects.mjs; the root never sees
  // less than speed squared, so it cannot produce NaN.
  const speed = glsl(falls.speed),
    speedSquared = glsl(falls.speed * falls.speed),
    twiceGravity = glsl(2 * falls.gravity),
    gravity = glsl(falls.gravity);
  const fallAge = `
    float waterAge(float d){
      return min(d,0.)/${speed}+(sqrt(${speedSquared}+${twiceGravity}*max(d,0.))-${speed})/${gravity};
    }
  `;
  return {
    // Attributes of the pool, channel and fall mesh, passed on to the fragment stage.
    vertexHead: `
      attribute float basinDepth;
      attribute vec3 flowData;
      attribute vec4 lakeData;
      varying float vBasinDepth;
      varying vec3 vWaterFlow;
      varying float vWaterAcross;
      varying vec4 vLakeData;
      varying vec3 vWaterWorld;
    `,
    beginVertex: `
      #include <begin_vertex>
      vBasinDepth=basinDepth;
      vWaterFlow=flowData;
      vWaterAcross=uv.x;
      vLakeData=lakeData;
      vWaterWorld=(modelMatrix*vec4(transformed,1.)).xyz;
    `,
    // Uniforms, the noise helpers, the fall clock, the pond outline and the painted sky the pools mirror.
    fragmentHead: `
      #ifdef WATER_ENV
      uniform samplerCube waterEnv;
      #endif
      uniform float waterTime;
      uniform float waterQuality;
      uniform float waterGlow;
      uniform vec3 waterSkyTop;
      uniform vec3 waterSkyHorizon;
      uniform vec3 waterSkyLow;
      uniform vec3 waterSunColor;
      uniform float waterSunStrength;
      uniform vec3 waterSunDir;
      varying float vBasinDepth;
      varying vec3 vWaterFlow;
      varying float vWaterAcross;
      varying vec4 vLakeData;
      varying vec3 vWaterWorld;
      // Hash without Sine, David Hoskins (third-party-notices.txt).
      float waterHash(vec2 p){
        vec3 q=fract(vec3(p.xyx)*.1031);
        q+=dot(q,q.yzx+33.33);
        return fract((q.x+q.y)*q.z);
      }
      float waterNoise(vec2 p){
        vec2 i=floor(p),f=fract(p);
        f=f*f*(3.-2.*f);
        return mix(mix(waterHash(i),waterHash(i+vec2(1.,0.)),f.x),
            mix(waterHash(i+vec2(0.,1.)),waterHash(i+vec2(1.)),f.x),f.y);
      }
      ${fallAge}
      ${POND_EDGE_GLSL}
      vec3 waterSky(vec3 d){
        float h=d.y;
        vec3 color=mix(waterSkyHorizon,waterSkyTop,smoothstep(-.16,.24,h));
        color=mix(color,waterSkyLow,1.-smoothstep(-.30,-.055,h));
        if(waterQuality>.5&&h>-.24&&h<.40){
          vec2 p=vec2((atan(d.x,d.z)/6.2831853+.5)*64.,(h+.26)*96.);
          p.x+=sin(p.y*.63)*.24;
          float broad=waterNoise(p),detail=waterNoise(p*3.+vec2(0.,8.)),
              density=smoothstep(.40,.98,broad*.72+detail*.28)*.55*smoothstep(-.24,-.16,h)*
              (1.-smoothstep(.27,.40,h));
          float warm=clamp((waterSkyHorizon.r-waterSkyHorizon.b)*2.,0.,1.)*waterSunStrength;
          vec3 cloud=mix(mix(waterSkyTop,waterSkyHorizon,.40),mix(waterSunColor,waterSkyHorizon,.64),
              warm*(.72+.28*detail));
          color=mix(color,cloud,density*(.20+waterSunStrength*.38));
        }
        return color;
      }
    `,
    // Three's chunks and what each becomes, in order.
    replacements: [
      // map: the lake, its banks, the falls and the outlet
      [
        '#include <map_fragment>',
        `
          float falling=clamp(vWaterFlow.y,0.,1.);
          // The outlet's share, evaluated here and not between the mesh rows (lakeData.z is the same formula at the vertices), so the
          // calm pond and the channel meet without a straight seam.
          float localFlow=smoothstep(.3,1.1,vLakeData.y)*(1.-smoothstep(.22,.9,abs(vLakeData.x)));
          // The pond's shoreline: the basin ellipse bent by this pond's own outline (pond-shape.mjs). shoreD is 1 on the
          // shore and 0 in the middle; the channel and the curtain, downstream of the pond, keep their mesh edges.
          float preview=step(3.5,vLakeData.w),tag=vLakeData.w-4.*preview,ringed=step(1.5,tag),
              pondSeed=tag-2.*ringed;
          float shoreWobble=waterQuality>.5?.03*(waterNoise(vLakeData.xy*3.7+pondSeed*17.)-.5)+.012*
              (waterNoise(vLakeData.xy*11.+pondSeed*5.)-.5):0.;
          float shoreD=length(vLakeData.xy)/((pondEdge(vLakeData.xy,pondSeed)+shoreWobble)*(1.+.45*preview));
          float mouth=max((1.-smoothstep(.46,.62,abs(vLakeData.x)))*smoothstep(.45,.75,vLakeData.y),
              smoothstep(1.15,1.4,vLakeData.y));
          float bankSpan=mix(.16,.001,ringed),shoreAA=fwidth(shoreD)*1.2+.004;
          float inWater=1.-smoothstep(1.-shoreAA,1.+shoreAA,shoreD);
          float bank=(1.-inWater)*(1.-mouth)*(1.-ringed);
          float lakeStill=(1.-falling)*(1.-smoothstep(.12,.72,localFlow));
          vec3 quietBase=diffuseColor.rgb;
          #include <map_fragment>
          // The scrolling streak map belongs to the outlet and curtain, not the lake interior.
          diffuseColor.rgb=mix(quietBase,diffuseColor.rgb,1.-lakeStill);
        `
      ],
      // colour and cover: depth, caustics, streaks, foam, the curtain's ragged edges
      [
        '#include <alphatest_fragment>',
        `
          // One connected body on one clock: flowData.x is the distance from the lip, so the pattern drifts
          // through the channel and then speeds up and stretches as it falls.
          float travel=(waterAge(vWaterFlow.x)-waterTime)*${glsl(falls.speed)};
          float streakPhase=vWaterAcross*${glsl(falls.streaks)};
          float streakFade=1.-smoothstep(.45,1.4,fwidth(streakPhase));
          float drift=waterNoise(vec2(vWaterAcross*3.,travel*.12));
          float streakNoise=waterNoise(vec2(streakPhase+drift*2.,travel*.45))*.62+
              waterNoise(vec2(streakPhase*2.3+5.1,travel*1.05))*.38;
          float streak=mix(.5,smoothstep(.36,.80,streakNoise),streakFade);
          float foamNoise=waterNoise(vec2(streakPhase*.7+1.7,travel*.8));
          float froth=smoothstep(.55,.85,foamNoise)*(1.-smoothstep(.55,2.0,fwidth(travel)*1.4));
          // Surges: broad pulses of aerated water that ride down and stretch with the fall.
          float surge=smoothstep(.55,.85,waterNoise(vec2(vWaterAcross*2.4+7.,travel*.28)))*falling;
          // White water: the sheet curls white over the lip and stays aerated for a metre or three (ragged lower
          // edge), and whitens again toward its foot.
          float lipFoam=smoothstep(-.5,.05,vWaterFlow.x)*(1.-smoothstep(.5,1.6+1.6*foamNoise,vWaterFlow.x))*
              (.65+.45*foamNoise)*
              (.30+.70*smoothstep(.25,.7,waterNoise(vec2(streakPhase*1.6+3.,travel*.35))));
          float footFoam=smoothstep(.40,.90,vWaterFlow.z)*(.4+.6*foamNoise);
          float whiteWater=clamp(max(max(lipFoam,footFoam),surge*(.45+.4*foamNoise)),0.,1.);
          // Shallow turquoise toward the shore, deep blue in the middle: the colour follows the pond's own outline.
          float shelf=smoothstep(.12,1.,shoreD);
          // Deep water dark and cool, the shallows a muted green-teal (owner, 2026-11-01: the saturated cyan read as a cartoon).
          vec3 lake=mix(vec3(.006,.03,.055),vec3(.09,.24,.24),shelf*shelf);
          // Shallow caustics: a slow web of light on the pool floor (full quality, by day, faded before it aliases), and sand
          // and pebbles on the shelf seen through the shallows.
          if(waterQuality>.5){
            vec2 C=vWaterWorld.xz*2.3;
            float web=abs(waterNoise(C+vec2(waterTime*.21,-waterTime*.13))-waterNoise(C*1.37+
                vec2(-waterTime*.17,waterTime*.19)+4.1));
            lake+=vec3(.10,.20,.17)*(.55*(1.-smoothstep(0.,.17,web)))*(.3+.7*shelf)*
                clamp(waterSunStrength,0.,1.)*lakeStill*(1.-smoothstep(.15,.5,fwidth(C.x)));
            float peb=waterNoise(vWaterWorld.xz*7.+pondSeed*31.);
            float sandK=smoothstep(.80,.97,shoreD)*(1.-smoothstep(.99,1.06,shoreD))*
                (.4+.6*smoothstep(.35,.7,peb))*(1.-smoothstep(.25,.6,fwidth(vWaterWorld.x*7.)))*(1.-mouth);
            lake=mix(lake,vec3(.26,.24,.15),sandK*.55*clamp(waterSunStrength+.25,0.,1.));
          }
          lake=mix(lake,diffuseColor.rgb*.55,localFlow*.48);
          // The channel carries the same streaks; it breaks white only in the last metre before the lip.
          lake=mix(lake,vec3(.80,.89,.93),
              max(localFlow*streak*streak*smoothstep(-1.4,-.2,vWaterFlow.x)*.45,lipFoam*.75));
          vec3 curtain=mix(vec3(.03,.13,.46),vec3(.60,.86,1.),.04+.96*streak);
          curtain+=vec3(.15,.19,.21)*froth*(.15+.28*vWaterFlow.z);
          float core=1.-abs(vWaterAcross-.5)*2.;
          curtain=mix(curtain,vec3(.62,.80,.88),core*core*.16);
          curtain=mix(curtain,vec3(.70,.88,1.),smoothstep(.30,.95,vWaterFlow.z)*(.16+.20*froth));
          curtain=mix(curtain,vec3(.90,.95,.98),whiteWater*.88);
          diffuseColor.rgb=mix(lake,curtain,falling);
          // Wavy, ragged edges: clumps travel down the sides and the sheet frays into spray. The sheet is
          // thinner between streaks and opaque in white water.
          float edgeNoise=waterNoise(vec2(vWaterAcross*26.,travel*1.9));
          float leftEdge=.02+(.14*waterNoise(vec2(3.1,travel*.35))+.07*edgeNoise)*falling,rightEdge=.02+
              (.14*waterNoise(vec2(9.7,travel*.35))+.07*edgeNoise)*falling;
          float edge=smoothstep(leftEdge-.02,leftEdge+.05,vWaterAcross)*
              (1.-smoothstep(.98-rightEdge-.05,1.-rightEdge+.02,vWaterAcross));
          float sheet=mix(.42+.58*streak,1.,whiteWater);
          // As it falls the sheet parts into ribbons: gaps that widen toward the foot show the rock behind.
          float parting=0.;
          if(falling>.001)parting=smoothstep(.40,.72,waterNoise(vec2(vWaterAcross*6.5+4.3,travel*.05+2.)))*
              smoothstep(.10,.75,vWaterFlow.z)*.85;
          sheet*=1.-parting*(1.-whiteWater);
          diffuseColor.a*=mix(1.,sheet*edge,falling)*(1.-smoothstep(.77,1.,vWaterFlow.z));
          // Seen edge-on the sheet is thicker: more opaque and whiter than face-on.
          float facing=1.;
          if(falling>.001)facing=abs(dot(normalize(vNormal),normalize(vViewPosition)));
          diffuseColor.a=clamp(diffuseColor.a*mix(1.,mix(.72,1.18,1.-facing),falling),0.,1.);
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.78,.90,1.),falling*(1.-facing)*(1.-facing)*.45);
          // The pond is cut along its own shoreline; where it lies on the lawn a soft wet bank fades out round it.
          diffuseColor.a*=mix(inWater+(1.-inWater)*(1.-smoothstep(1.,1.+bankSpan,shoreD))*.62*
              (1.-ringed),1.,mouth);
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.045,.055,.035),bank*.85);
          // The shallows let the basin floor show through, the middle stays deep (owner, 2026-11-01: the pools read as
          // flat paint).
          diffuseColor.a*=mix(1.,.55,shelf*shelf*lakeStill*(1.-bank));
          // Sparse sunlit glints riding the sheet (full quality only, faded before they could shimmer).
          float glitter=smoothstep(.78,.95,waterNoise(vec2(streakPhase*2.7+9.,travel*2.2+waterTime*1.3)))*
              smoothstep(.72,.92,waterNoise(vec2(streakPhase*1.3+2.,travel*1.1-waterTime*.7)))*
              (1.-smoothstep(.2,.6,fwidth(streakPhase*2.7)))*falling*waterQuality;
          #include <alphatest_fragment>
        `
      ],
      // roughness: calmer pools than falls
      [
        '#include <roughnessmap_fragment>',
        `
          #include <roughnessmap_fragment>
          roughnessFactor=mix(.34,.23,lakeStill);
        `
      ],
      // ripples: wind waves and drip rings on still pools
      [
        '#include <normal_fragment_maps>',
        `
          #include <normal_fragment_maps>
          if(lakeStill>.01&&waterQuality>.5){
            // Wind ripples drift across the pool, and rings spread from drips (one per cell, in 40% of the cells).
            vec2 P=vWaterWorld.xz;
            float a=dot(P,vec2(3.2,1.5))-waterTime*.9,b=dot(P,vec2(-1.3,4.1))-waterTime*.7,
                c=dot(P,vec2(6.1,-4.7))-waterTime*1.5,e=dot(P,vec2(-7.4,-2.2))-waterTime*1.9;
            float filterWave=1.-smoothstep(.35,1.4,max(fwidth(a),fwidth(b))),
                filterFine=1.-smoothstep(.35,1.4,max(fwidth(c),fwidth(e)));
            vec2 slope=(vec2(3.2,1.5)*.024*cos(a)+vec2(-1.3,4.1)*.014*cos(b))*
                filterWave+(vec2(6.1,-4.7)*.008*cos(c)+vec2(-7.4,-2.2)*.006*cos(e))*filterFine;
            vec2 R=P*1.2,cell=floor(R);
            float drip=waterHash(cell);
            vec2 dv=R-cell-.3-.4*vec2(drip,waterHash(cell+3.7));
            float age=fract(waterTime*.3+drip*5.3),ringRadius=age*.32,r=length(dv)+1e-4,
                ringPhase=(r-ringRadius)*40.;
            float ring=cos(ringPhase)*(1.-smoothstep(0.,.1,abs(r-ringRadius)))*(1.-age)*step(.9,drip)*
                (1.-smoothstep(.35,1.4,fwidth(ringPhase)));
            slope=(slope+dv/r*ring*.07)*lakeStill;
            normal=normalize(normal+(viewMatrix*vec4(-slope.x,0.,-slope.y,0.)).xyz);
          }
        `
      ],
      // glow: the falls' blue-violet light, white water and the pools that feed them
      [
        '#include <emissivemap_fragment>',
        `
          #include <emissivemap_fragment>
          // Pools keep a third of the glow they had; the falls keep theirs (their blue-violet glow follows the reference).
          totalEmissiveRadiance*=mix(.12,.18,falling);
          totalEmissiveRadiance+=vec3(.013,.027,.032)*streak*falling;
          // Falls glow blue-violet like the reference; the glow fades where the curtain breaks into spray.
          float fallCore=1.-abs(vWaterAcross-.5)*2.;
          totalEmissiveRadiance+=vec3(.16,.60,1.45)*falling*(.12+.88*streak)*(.45+.55*fallCore)*
              (1.-smoothstep(.8,1.,vWaterFlow.z))*(1.-.7*whiteWater)*waterGlow;
          // White water keeps a pale glow of its own, so the foam still reads at night.
          totalEmissiveRadiance+=vec3(.10,.15,.20)*whiteWater*waterGlow;
          // Pools that feed the falls glow softly too, brightest toward the outlet; by day the glow steps back so
          // the depth, caustics and sky reflection show.
          totalEmissiveRadiance+=vec3(.02,.07,.13)*(1.-falling)*(1.-bank)*(.35+.65*localFlow)*
              (1.-.5*clamp(waterSunStrength,0.,1.))*waterGlow;
        `
      ],
      // highlights: the sun and lamps on the water kept small
      [
        '#include <lights_fragment_end>',
        `
          #include <lights_fragment_end>
          reflectedLight.directSpecular*=mix(.14,.045,falling);
          reflectedLight.indirectSpecular*=.12;
        `
      ],
      // reflections: the sky (or the Ultra cube map), the sun's glint, shore foam
      [
        '#include <opaque_fragment>',
        `
          if(lakeStill>.01){
            vec3 worldNormal=inverseTransformDirection(normal,viewMatrix),
                viewDir=normalize(vWaterWorld-cameraPosition),reflection=reflect(viewDir,worldNormal);
            float fresnel=pow(1.-clamp(dot(-viewDir,worldNormal),0.,1.),4.);
            // The sky mirrors in a calmer surface than the ripples, so the clouds do not shimmer.
            vec3 mirrored=reflect(viewDir,normalize(mix(vec3(0.,1.,0.),worldNormal,.4)));
          #ifdef WATER_ENV
            // The real sky, mountains, islands and trees, a little blurred (one mip down) like a breathing surface.
            vec3 sky=textureLod(waterEnv,mirrored,1.).rgb;
          #else
            vec3 sky=waterSky(mirrored);
          #endif
            outgoingLight=mix(outgoingLight,sky,lakeStill*(1.-bank)*(.14+.78*fresnel));
            // The sun's reflection: a small bright core and, round it, glitter where the ripples catch it. (One broad
            // smooth highlight lay on still pools like a pale flat stone in the middle of the water.)
            float sunDot=dot(reflection,normalize(waterSunDir+vec3(0.,1e-4,0.))),
                sparkle=smoothstep(.62,.9,waterNoise(vWaterWorld.xz*9.+vec2(waterTime*1.7,-waterTime*1.3)))*
                smoothstep(.5,.85,waterNoise(vWaterWorld.xz*23.-vec2(waterTime*2.3,waterTime)));
            float glint=smoothstep(.993,.9995,sunDot)*.8+smoothstep(.95,.996,sunDot)*sparkle*.9*
                (1.-smoothstep(.25,.9,length(fwidth(vWaterWorld.xz*23.))));
            outgoingLight+=waterSunColor*glint*waterSunStrength*lakeStill*(1.-bank)*1.6*waterQuality;
          }
          // Clumps of foam lap along the shore; they are lit like the scene, not a constant white.
          float rimDistance=shoreD+.05*(waterNoise(vLakeData.xy*5.+vec2(waterTime*.5,-waterTime*.35))-.5),
              rimFoam=smoothstep(.90,.975,rimDistance)*(1.-smoothstep(.99,1.04,rimDistance))*
              smoothstep(.3,.7,waterNoise(vLakeData.xy*9.+vec2(waterTime*.3,0.)))*lakeStill*(1.-mouth);
          outgoingLight=mix(outgoingLight,vec3(.84,.90,.92)*
              (.3+.7*clamp(waterSunStrength,0.,1.)),rimFoam*.22);
          outgoingLight+=waterSunColor*glitter*waterSunStrength*2.2;
          #include <opaque_fragment>
        `
      ]
    ]
  };
}
