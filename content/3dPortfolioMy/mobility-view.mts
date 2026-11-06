import type { ActorState, Aspect, MobilityData, SignalTimingOverrides } from './mobility-types.js';
import * as THREE from 'three';
import type { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { verifiedBytes } from './city-package.mjs';
import { MobilitySimulation } from './mobility.mjs';

type Binding={actor:ActorState;carrier:THREE.Object3D;render:THREE.Object3D;parentInverse:THREE.Matrix4;parentRotation:THREE.Quaternion;basis:THREE.Quaternion;
    mixer?:THREE.AnimationMixer;walk?:THREE.AnimationAction;idle?:THREE.AnimationAction;phaseSeconds:number;weight:number;owned:boolean};
type Lamp={groupId:string;aspect:Aspect;materials:THREE.Material[];last?:boolean};
type CarrierState={position:THREE.Vector3;quaternion:THREE.Quaternion;scale:THREE.Vector3;matrix:THREE.Matrix4;visible:boolean;matrixAutoUpdate:boolean;dynamic:unknown;actorId:unknown};
const lampColor={red:0xff2716,amber:0xffbe28,green:0x30ff67};

/** Adapter only: the simulation has no dependency on Three.js, meshes, or DOM. */
export class MobilityView {
    readonly simulation:MobilitySimulation;
    private bindings:Binding[]=[];private lamps:Lamp[]=[];
    private originalMaterials:{mesh:THREE.Mesh;material:THREE.Material|THREE.Material[]}[]=[];
    private ownedMaterials=new Set<THREE.Material>();
    private externalScenes:THREE.Object3D[]=[];
    private originals=new Map<THREE.Object3D,CarrierState>();
    private point=new THREE.Vector3();private heading=new THREE.Quaternion();
    private constructor(readonly data: MobilityData, timings: SignalTimingOverrides) {
        this.simulation = new MobilitySimulation(data, timings);
    }
    static async create(data:MobilityData,objects:Map<string,THREE.Object3D>,city:THREE.Object3D,loader:GLTFLoader,baseUrl:string,timings:SignalTimingOverrides = {}):Promise<MobilityView> {
        const view=new MobilityView(data, timings),cache=new Map<string,Promise<GLTF>>();
        city.updateWorldMatrix(true,true);
        try {
            for(const actor of view.simulation.actors) {
                const carrier=objects.get(actor.nodeId)!;
                view.originals.set(carrier,{position:carrier.position.clone(),quaternion:carrier.quaternion.clone(),scale:carrier.scale.clone(),matrix:carrier.matrix.clone(),
                    visible:carrier.visible,matrixAutoUpdate:carrier.matrixAutoUpdate,dynamic:carrier.userData.webDynamic,actorId:carrier.userData.mobility_actor_id});
                carrier.userData.webDynamic=true;carrier.matrixAutoUpdate=true;
                let render=carrier,mixer:THREE.AnimationMixer|undefined,walk:THREE.AnimationAction|undefined,idle:THREE.AnimationAction|undefined;
                if(actor.asset.externalAsset) {
                    const asset=actor.asset.externalAsset,url=new URL(asset.url,baseUrl).href,key=url+':'+asset.sha256;
                    if(!cache.has(key)) cache.set(key,verifiedBytes(url,asset.sha256).then(bytes=>loader.parseAsync(bytes,new URL('.',url).href)).then(gltf=>{view.externalScenes.push(gltf.scene);return gltf;}));
                    const gltf=await cache.get(key)!;
                    const rigs:THREE.Object3D[]=[];gltf.scene.traverse(node=>{if(node.userData.web_asset_id==='city-people.rig.v1'&&node.userData.city_people_rig_schema===1)rigs.push(node);});
                    const clip=gltf.animations.find(clip=>clip.name==='Walk'),idleClip=gltf.animations.find(clip=>clip.name==='Idle');
                    if(rigs.length!==1||!clip) throw new Error(`Неполный профиль ходьбы ${asset.variantId}`);
                    render=cloneSkeleton(rigs[0]);render.userData.webDynamic=true;
                    const remove:THREE.Object3D[]=[];let found=0;
                    render.traverse(node=>{
                        if(node.userData.people_source_mesh===undefined)return;
                        if(node.userData.web_variant_id===asset.variantId&&node.userData.lod_level==='high'){node.visible=true;found++;}
                        else remove.push(node);
                    });
                    remove.forEach(node=>node.removeFromParent());
                    if(found!==1) throw new Error(`Не найден единственный вариант ${asset.variantId}`);
                    mixer=new THREE.AnimationMixer(render);walk=mixer.clipAction(clip).play();walk.paused=true;
                    if(idleClip) idle=mixer.clipAction(idleClip).play();
                    carrier.visible=false;city.add(render);render.matrixAutoUpdate=true;
                    render.traverse(node=>{if(node instanceof THREE.SkinnedMesh)node.frustumCulled=false;});
                }
                render.parent!.updateWorldMatrix(true,false);
                render.userData.mobility_actor_id=actor.id;
                let seed=2166136261;for(const char of actor.id)seed=Math.imul(seed^char.charCodeAt(0),16777619)>>>0;
                view.bindings.push({actor,carrier,render,mixer,walk,idle,phaseSeconds:walk?(seed%10007)/10007*walk.getClip().duration:0,weight:0,owned:render!==carrier,
                    parentInverse:render.parent!.matrixWorld.clone().invert(),parentRotation:render.parent!.getWorldQuaternion(new THREE.Quaternion()).invert(),
                    basis:new THREE.Quaternion().fromArray(actor.asset.basisRotation).normalize()});
            }
            for(const head of data.signalHeads) {
                const group=data.signalGroups.find(group=>group.headIds.includes(head.id));
                if(!group)throw new Error(`Голова без сигнальной группы ${head.id}`);
                for(const lens of head.lenses) {
                    const object=objects.get(lens.nodeId)!;object.userData.webDynamic=true;
                    const materials:THREE.Material[]=[];
                    object.traverse(node=>{
                        if(!(node instanceof THREE.Mesh))return;
                        view.originalMaterials.push({mesh:node,material:node.material});
                        const clone=(material:THREE.Material):THREE.Material=>{const copy=material.clone();materials.push(copy);view.ownedMaterials.add(copy);return copy;};
                        node.material=Array.isArray(node.material)?node.material.map(clone):clone(node.material);
                    });
                    if(!materials.length)throw new Error(`У линзы нет геометрии ${lens.nodeId}`);
                    view.lamps.push({groupId:group.id,aspect:lens.aspect,materials});
                }
            }
            view.update(0);return view;
        } catch(error){view.dispose();throw error;}
    }
    update(seconds:number):void {
        this.simulation.update(seconds);
        for(const binding of this.bindings) {
            const {actor,render,carrier}=binding;
            render.visible=actor.active;
            if(!actor.active)continue;
            this.point.fromArray(actor.position);
            this.heading.setFromAxisAngle(THREE.Object3D.DEFAULT_UP,Math.atan2(-actor.forward[0],-actor.forward[2]));
            render.position.copy(this.point).applyMatrix4(binding.parentInverse);
            render.quaternion.copy(binding.parentRotation).multiply(this.heading).multiply(binding.basis);
            render.updateMatrix();
            if(binding.owned) {
                carrier.parent!.updateWorldMatrix(true,false);
                carrier.position.copy(this.point);carrier.parent!.worldToLocal(carrier.position);
                carrier.updateMatrix();
            }
            if(binding.walk&&binding.mixer) {
                // Walk v08: one 1.1m stride per second. No distance means no foot sliding.
                binding.walk.time=(actor.travelled/1.1+binding.phaseSeconds)%binding.walk.getClip().duration;
                binding.weight=THREE.MathUtils.damp(binding.weight,actor.speed>.03?Math.min(1,actor.speed/1.1):0,10,Math.min(seconds,.25));
                binding.walk.setEffectiveWeight(binding.idle?binding.weight:1);
                binding.idle?.setEffectiveWeight(1-binding.weight);
                binding.mixer.update(Math.min(seconds,.25));
            }
        }
        for(const lamp of this.lamps) {
            const on=this.simulation.aspect(lamp.groupId)===lamp.aspect;
            if(on===lamp.last)continue;lamp.last=on;
            for(const material of lamp.materials) {
                if(material instanceof THREE.MeshStandardMaterial){material.color.setHex(on?lampColor[lamp.aspect]:0x0b1012);material.emissive.setHex(on?lampColor[lamp.aspect]:0);material.emissiveIntensity=on?2.5:0;}
                else if(material instanceof THREE.MeshBasicMaterial)material.color.setHex(on?lampColor[lamp.aspect]:0x0b1012);
            }
        }
    }
    setVehicleDensity(fraction:number):number {
        const actors=this.simulation.actors.filter(actor=>actor.asset.mode!=='pedestrian');
        const count=Math.round(Math.max(0,Math.min(1,fraction))*actors.length);
        const chosen=new Set(Array.from({length:count},(_,i)=>Math.floor(i*actors.length/count)));
        actors.forEach((actor,i)=>this.simulation.setEnabled(actor.id,chosen.has(i)));return count;
    }
    dispose():void {
        for(const binding of this.bindings) {
            binding.mixer?.stopAllAction();binding.mixer?.uncacheRoot(binding.render);
            if(binding.owned){const skeletons=new Set<THREE.Skeleton>();binding.render.traverse(node=>{if(node instanceof THREE.SkinnedMesh)skeletons.add(node.skeleton);});skeletons.forEach(s=>s.dispose());binding.render.removeFromParent();}
        }
        for(const [carrier,state] of this.originals){
            carrier.position.copy(state.position);carrier.quaternion.copy(state.quaternion);carrier.scale.copy(state.scale);carrier.matrix.copy(state.matrix);
            carrier.visible=state.visible;carrier.matrixAutoUpdate=state.matrixAutoUpdate;carrier.matrixWorldNeedsUpdate=true;
            if(state.dynamic===undefined)delete carrier.userData.webDynamic;else carrier.userData.webDynamic=state.dynamic;
            if(state.actorId===undefined)delete carrier.userData.mobility_actor_id;else carrier.userData.mobility_actor_id=state.actorId;
        }
        for(const {mesh,material} of this.originalMaterials)mesh.material=material;
        this.ownedMaterials.forEach(material=>material.dispose());
        const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>(),bitmaps=new Set<ImageBitmap>();
        for(const scene of this.externalScenes)scene.traverse(node=>{if(node instanceof THREE.Mesh){geometries.add(node.geometry);for(const material of Array.isArray(node.material)?node.material:[node.material]){materials.add(material);for(const value of Object.values(material))if(value instanceof THREE.Texture){textures.add(value);if(typeof ImageBitmap!=='undefined'&&value.image instanceof ImageBitmap)bitmaps.add(value.image);}}}});
        geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());bitmaps.forEach(b=>b.close());
        this.bindings=[];this.lamps=[];this.originalMaterials=[];this.ownedMaterials.clear();this.externalScenes=[];this.originals.clear();
    }
}
