import * as THREE from 'three';

declare global {
    interface SceneContext{
        vehiclesModelsPoses: Map<THREE.InstancedMesh, THREE.Object3D[]>,
        actors: SimulationActor[],
        network: RoadNetwork,
        roadManager: RoadSimulationManager
    }

}