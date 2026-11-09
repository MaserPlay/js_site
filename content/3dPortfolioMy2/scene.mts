import { Viewer } from "./index.mjs";
import * as NOTIFICATIONS from "./notification.mjs"
import * as DEBUG from "./debug.mjs"
import { SummonVehicleSetupData, VehicleSetupDataWithoutModel, VehicleSetupDataWithoutStartingEdge } from "./vehicle.mjs";
import { RoadNetwork } from "./road_network.mjs";
import { RoadSimulationManager } from "./simulation.mjs";

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

let SContext : SceneContext

const vehicleSettings: Record<string, SummonVehicleSetupData> = {
    'vehicle.ambulance.white.v1': { speed: 6, rotatingSpeed: 8 },
    'vehicle.roadster.red.v1': { speed: 12, rotatingSpeed: 8 },
}

const defaultVehicleSetting: SummonVehicleSetupData = {speed: 15, rotatingSpeed: 8}

function VehicleSetupDatas() : VehicleSetupDataWithoutStartingEdge[] {
    return SContext.vehiclesModels.map(o => {
        return {...vehicleSettings[o.userData.web_id] ?? defaultVehicleSetting, model: o}
    })
}

async function loop(delta: DeltaTime, sContext: SceneContext) {
    sContext.actors.forEach(a => a.update(delta))
    sContext.roadManager.update(delta)
    DEBUG.loop(delta, sContext)
}

export async function setup(viewer:Viewer, setup:ViewerSetupData) {
    const rContext = viewer.getContext();
    const loader = new GLTFLoader();

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
            VehicleSetupDatas
        )
    ]);

    SContext = {
        vehiclesModels: vehiclesLibrary.scene.children.filter(
                (object): object is THREE.Group => object instanceof THREE.Group
            ),
        actors: [],
        network: network,
        roadManager: roadManager
    }

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
    

    SContext.roadManager.setup(setup)

    rContext.sunlight.intensity = 1

    rContext.camera.position.set(0, 22, 12);
    rContext.controls.target.set(0, 2, -20);

    rContext.controls.maxPolarAngle = THREE.MathUtils.degToRad(90);

    rContext.controls.maxDistance = 50 // max view distance
    rContext.controls.enablePan = true;
    rContext.controls.screenSpacePanning = false

    viewer.addEventListener("loop", e => loop(e.delta, SContext))
}