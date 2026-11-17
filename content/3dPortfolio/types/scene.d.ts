import * as THREE from 'three';

declare global {
    type PossibleVector3 = [number, number, number];

    interface SceneContext{
        vehiclesModels: THREE.Object3D<TEventMap>[],
        actors: SimulationActor[],
        network: RoadNetwork,
        roadManager: RoadSimulationManager
    }

}