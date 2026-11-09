import { VehicleActor, VehicleSetupData, VehicleSetupDataWithoutStartingEdge } from './vehicle.mjs';
import { fetchJson, getRandom, randomMix, wrap } from './utils.mjs';

import * as THREE from 'three';
import { RoadNetwork } from './road_network.mjs';


export class RoadSimulationManager {

    private readonly entries: SimulationPortal[]
    private readonly exits: SimulationPortal[]
    private readonly inside: SimulationZoneEdge[]

    private readonly simulationBox: THREE.Box2

    private readonly checkPoint = new THREE.Vector2()

    private constructor(
        data: SimulationZonesData,
        private readonly SContext : () => SceneContext, 
        private readonly rContext : RenderContext,
        private readonly vehicleSetupDatas: () => VehicleSetupDataWithoutStartingEdge[]
    ) {
        const zone = data.zones.find(
            zone => zone.id === 'simulation.portfolio'
        )!;

        this.entries = zone.portals.filter(p => p.direction === 'entry');
        this.exits = zone.portals.filter(p => p.direction === 'exit');
        this.inside = zone.edgeIntervals.filter(
            edge => edge.mode === 'vehicle'
        );

        const minX = Math.min(...zone.boundaryXZ.map(p => p[0]));
        const maxX = Math.max(...zone.boundaryXZ.map(p => p[0]));
        const minZ = Math.min(...zone.boundaryXZ.map(p => p[1]));
        const maxZ = Math.max(...zone.boundaryXZ.map(p => p[1]));

        this.simulationBox = new THREE.Box2(
            new THREE.Vector2(minX, minZ),
            new THREE.Vector2(maxX, maxZ),
        );
    }
    static async load(
        simulationZonesPath:string, 
        _SContext : () => SceneContext, 
        _rContext : RenderContext, 
        _vehicleSetupDatasGetter: () => VehicleSetupDataWithoutStartingEdge[]
    ) {
        return new RoadSimulationManager(
            await fetchJson(simulationZonesPath), 
            _SContext, 
            _rContext, 
            _vehicleSetupDatasGetter
        )
    }

    setup(setup:ViewerSetupData) {
        const spawnEdgesArray = randomMix(this.inside)
        for (let i = 0; i < setup.startingVehiclesCountGetter(); i++) {
            const startEdgeId = spawnEdgesArray[wrap(i, 0, spawnEdgesArray.length - 1)].edgeId
            const vehicle = this.createVehicle({
                ...getRandom(this.vehicleSetupDatas()),
                startingEdge: startEdgeId
            })
            const followCar : VehicleActor | undefined = this.SContext().network.getFarVehicleByEdge(startEdgeId)
            if (followCar) {
                vehicle.followCar = followCar
                followCar.backCar = vehicle
            }
            vehicle.name = String(i)
            this.addVehicle(startEdgeId, vehicle)
        }
    }
    update(delta: DeltaTime) {
        const actors = this.SContext().actors;

        for (let i = actors.length - 1; i >= 0; i--) {
            const actor = actors[i];

            if (actor instanceof VehicleActor) {
                this.checkPoint.set(actor.position.x, actor.position.z);

                if (!this.simulationBox.containsPoint(this.checkPoint)) {
                    actor.outsideTimer -= delta
                    if (actor.outsideTimer <= 0) {
                        this.removeVehicle(actor);
                    }
                } else {
                    actor.outsideTimer = 1
                }
            }
        }
    }

    onVehicleAdded(_vehicle: VehicleActor) {

    }
    
    onVehicleRemoved(delVehicle: VehicleActor) {
        delVehicle.detachFromLane();
        const startEdgeId = getRandom(this.entries).edgeId
        const vehicle = this.createVehicle({
            ...getRandom(this.vehicleSetupDatas()),
            startingEdge: startEdgeId
        })
        const followCar : VehicleActor | undefined = this.SContext().network.getFarVehicleByEdge(startEdgeId)
        if (followCar) {
            vehicle.followCar = followCar
            followCar.backCar = vehicle
        }
        vehicle.name = delVehicle.name
        this.addVehicle(startEdgeId, vehicle)
    }
    
    createVehicle(setupData: VehicleSetupData) {
        return new VehicleActor(setupData, this.SContext().network, this)
    }

    addVehicle(startEdgeId: string, actor: VehicleActor) {

        this.rContext.scene.add(actor.setupData.model)
        
        this.SContext().actors.push(actor)

        this.SContext().network.spawnVehicleActor(startEdgeId, actor)
        
        this.onVehicleAdded(actor)
    }
    removeVehicle(actor: VehicleActor) {
        const index = this.SContext().actors.indexOf(actor);

        if (index !== -1) {
            this.SContext().actors.splice(index, 1);
            actor.setupData.model.removeFromParent()
            this.SContext().network.removeVehicleActor(actor)
            this.onVehicleRemoved(actor)
        } else {
            console.warn("This actor not in scene")
        }        
    }
}