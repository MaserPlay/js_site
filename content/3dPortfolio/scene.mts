import { Viewer } from "./index.mjs";
import * as NOTIFICATIONS from "./notification.mjs"
import * as DEBUG from "./debug.mjs"
import { RoadNetwork } from "./road_network.mjs";
import { RoadSimulationManager } from "./simulation.mjs";

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { VehicleSetupData } from "./vehicle.mjs";
import { fetchJson } from "./utils.mjs";
import { VehicleCatalog } from "./types/vehicle_catalog";

let SContext : SceneContext

const MAX_INSTANCED_MESH = 1000

const vehicleSettings: Record<string, Partial<VehicleSetupData>> = {
    'vehicle.ambulance.white.v1': { speed: 6, rotatingSpeed: 8 },
    'vehicle.roadster.red.v1': { speed: 12, rotatingSpeed: 8 },
}

const defaultVehicleSetting: VehicleSetupData = {speed: 15, rotatingSpeed: 8}

export function findVehicaleInstanceByName(sContext: SceneContext, name: string) : [THREE.InstancedMesh, THREE.Object3D[]] | undefined {
    for (const [key, value] of sContext.vehiclesModelsPoses) {
        if (key.name == name.replaceAll(".", "")) return [key, value];
    }
    return undefined;
}

async function loop(delta: DeltaTime, sContext: SceneContext) {
    sContext.roadManager.updateControllers(delta)
    sContext.actors.forEach(a => a.update(delta))
    sContext.roadManager.update(delta)
    DEBUG.loop(delta, sContext)
    for (const [ instanced, posses ] of sContext.vehiclesModelsPoses) {
        instanced.count = posses.length
        let i = 0
        for (const pose of posses) {
            pose.updateMatrix()
            instanced.setMatrixAt(i++, pose.matrix)
        }
        instanced.instanceMatrix.needsUpdate = true
    }
}

export async function setup(viewer:Viewer, setup:ViewerSetupData) {
    const rContext = viewer.getContext();
    const loader = new GLTFLoader();

    const vehicleCatalog = await fetchJson<VehicleCatalog>(setup.initialCityPackUrl + "/vehicle-catalog.json")
    
    const [gltf, vehiclesLibrary, network, roadManager] = await Promise.all([
        loader.loadAsync(setup.initialCityPackUrl + "/city.glb"), 
        loader.loadAsync(setup.initialCityPackUrl + "/vehicles.glb"),
        RoadNetwork.load(
            setup.initialCityPackUrl + "/road-network.json"
        ),
        RoadSimulationManager.load(
            setup.initialCityPackUrl + "/simulation-zones.json", 
            () => SContext, 
            rContext,
            () => vehicleCatalog.models
                .map((v) => ({id: v.id, ...vehicleSettings[v.id] ?? {}, ...defaultVehicleSetting}))
        )
    ]);

    SContext = {
        vehiclesModelsPoses: new Map(vehiclesLibrary.scene.children.filter((object): object is THREE.Mesh =>
                object instanceof THREE.Mesh
            ).map((model) => {
                let instMesh = new THREE.InstancedMesh(model.geometry, model.material, MAX_INSTANCED_MESH);
                instMesh.name = model.name
                instMesh.count = 0
                model.geometry.computeBoundingBox()
                return [instMesh, []];
            })
        ),
        actors: [],
        network: network,
        roadManager: roadManager
    }
    const vehiclesGroup = new THREE.Group()
    vehiclesGroup.name = "vehiclesGroup"
    rContext.scene.add(vehiclesGroup)

    SContext.vehiclesModelsPoses.forEach((_, instMesh) => vehiclesGroup.add(instMesh))

    rContext.scene.add(gltf.scene);
    rContext.scene.fog = new THREE.Fog( 0xb8c9d9, 100, 110 );

    rContext.sky.scale.setScalar(10000);

    const elevation = 30; // Высота солнца над горизонтом
    const azimuth = 180;  // Направление солнца

    const phi = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);

    const sun = new THREE.Vector3()
        .setFromSphericalCoords(1, phi, theta);

    rContext.sky.material.uniforms.sunPosition.value.copy(sun);
    rContext.sky.material.uniforms[ 'rayleigh' ].value = .1
    rContext.sky.material.uniforms[ 'cloudDensity' ].value = .1
    

    SContext.roadManager.setup(setup, gltf.scene)

    rContext.sunlight.intensity = 1

    rContext.camera.position.set(0, 22, 12);
    rContext.controls.target.set(0, 2, -20);

    rContext.controls.maxPolarAngle = THREE.MathUtils.degToRad(90);

    rContext.controls.maxDistance = 50 // max view distance
    rContext.controls.enablePan = true;
    rContext.controls.screenSpacePanning = false

    viewer.addEventListener("loop", e => loop(e.delta, SContext))
}