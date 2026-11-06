import { VehicleActor, VehicleSetupData, VehicleSetupDataWithoutStartingEdge } from './vehicle.mjs';
import { SimulationActor, SimulationActorSetupData } from './simulation_actor.mjs';
import { getRandom, randomMix, wrap } from './utils.mjs';

import * as THREE from 'three';


export class RoadSimulationManager {

    private vehicleSetupDatas!: VehicleSetupDataWithoutStartingEdge[];

    private readonly entries: SimulationPortal[]
    private readonly exits: SimulationPortal[]
    private readonly inside: SimulationZoneEdge[]

    private readonly simulationBox: THREE.Box2

    private readonly checkPoint = new THREE.Vector2()

    private constructor(
        data: SimulationZonesData,
        private readonly SContext : () => SceneContext, 
        private readonly rContext : RenderContext,
        private readonly _vehicleSetupDatasGetter: () => VehicleSetupDataWithoutStartingEdge[]
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
        setup:ViewerSetupData, 
        _SContext : () => SceneContext, 
        _rContext : RenderContext, 
        _vehicleSetupDatasGetter: () => VehicleSetupDataWithoutStartingEdge[]
    ) {
        const response = await fetch(
            `${setup.initialCityPackUrl}/simulation-zones.json`
        );

        if (!response.ok) {
            throw new Error(`Can\`t load zones: ${response.status}`);
        }

        const data: SimulationZonesData = await response.json();
        
        return new RoadSimulationManager(data, _SContext, _rContext, _vehicleSetupDatasGetter)
    }

    setup() {
        this.vehicleSetupDatas = this._vehicleSetupDatasGetter()
        const spawnEdgesArray = randomMix(this.inside)
        for (let i = 0; i < 20; i++) {
            this.addVehicle(this.createVehicle({
                ...getRandom(this.vehicleSetupDatas),
                startingEdge: spawnEdgesArray[wrap(i, 0, spawnEdgesArray.length - 1)].edgeId
            }))
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
    
    onVehicleRemoved(_vehicle: VehicleActor) {
        this.addVehicle(this.createVehicle({
            ...getRandom(this.vehicleSetupDatas),
            startingEdge: getRandom(this.entries).edgeId
        }))
    }
    
    createVehicle(setupData: VehicleSetupData) {
        return new VehicleActor(setupData, this.SContext().network, this)
    }

    addVehicle(actor: VehicleActor) {

        this.rContext.scene.add(actor.setupData.model)
        
        this.SContext().actors.push(actor)
        
        this.onVehicleAdded(actor)
    }
    removeVehicle(actor: VehicleActor) {
        const index = this.SContext().actors.indexOf(actor);

        if (index !== -1) {
            this.SContext().actors.splice(index, 1);
            actor.setupData.model.removeFromParent()
            this.onVehicleRemoved(actor)
        } else {
            console.warn("This actor not in scene")
        }        
    }
}