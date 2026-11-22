import { VehicleActor, VehicleSetupData, VehicleSetupDataId, VehicleSpawnData } from './vehicle.mjs';
import { fetchJson, getRandom, randomMix } from './utils.mjs';

import * as THREE from 'three';
import { JunctionController, type RoadController, type RoadFeature } from './road_controllers.mjs';
import { findVehicaleInstanceByName } from './scene.mjs';


export class RoadSimulationManager {

    private readonly entries: SimulationPortal[]
    private readonly inside: SimulationZoneEdge[]

    private readonly simulationBox: THREE.Box2

    private readonly checkPoint = new THREE.Vector2()
    private readonly controllers: RoadController[] = [];
    private readonly controllersByEdge = new Map<string, RoadController[]>();
    private readonly pendingSpawns: string[] = [];
    private spawnRetryElapsed = 0;

    public constructor(
        data: SimulationZonesData,
        private readonly SContext : () => SceneContext, 
        private readonly rContext : RenderContext,
        private readonly vehicleSetupDatas: () => VehicleSetupDataId[]
    ) {
        const zone = data.zones.find(
            zone => zone.id === 'simulation.portfolio'
        )!;

        this.entries = zone.portals.filter(p => p.direction === 'entry');
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

    setup(setup: ViewerSetupData, city: THREE.Object3D): void {
        const { network } = this.SContext();
        const objects = new Map<string, THREE.Object3D>();

        city.traverse(object => {
            const id = object.userData.web_id;
            if (typeof id === 'string') objects.set(id, object);
        });

        const crossingEdges = new Set<string>();
        for (const junction of network.data.junctions) {
            this.addController(new JunctionController(junction, network, objects));
            for (const edgeId of junction.movementEdgeIds) crossingEdges.add(edgeId);
        }

        const spawnEdges = randomMix(this.inside.filter(edge => !crossingEdges.has(edge.edgeId)));
        const vehicleModels = this.vehicleSetupDatas();
        if (!spawnEdges.length || !vehicleModels.length) return;

        const count = setup.startingVehiclesCountGetter();
        for (let i = 0; i < count; i++) {
            const model = getRandom(vehicleModels)
            const spawnData : VehicleSpawnData = {
                startingEdge: spawnEdges[i % spawnEdges.length].edgeId,
                transform: new THREE.Object3D(),
                modelName: model.id,
                localBounds: new THREE.Box3()
            }
            const vehicle = this.createVehicle(spawnData, model);
            vehicle.name = String(i);

            if (!this.addVehicle(vehicle)) this.pendingSpawns.push(vehicle.name);
        }
    }

    addController(controller: RoadController): void {
        this.controllers.push(controller);

        for (const edgeId of controller.approachEdgeIds) {
            const controllers = this.controllersByEdge.get(edgeId) ?? [];
            controllers.push(controller);
            this.controllersByEdge.set(edgeId, controllers);
        }
    }

    updateControllers(delta: DeltaTime): void {
        for (const controller of this.controllers) controller.update(delta);
    }

    getRoadFeatures(vehicle: VehicleActor, maxStepMetres: number): RoadFeature[] {
        const controllers = this.controllersByEdge.get(vehicle.edgeId);
        return controllers?.flatMap(controller => controller.getFeatures(vehicle, maxStepMetres)) ?? [];
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

        this.retrySpawn(delta);
    }

    onVehicleAdded(_vehicle: VehicleActor) {

    }
    
    onVehicleRemoved(vehicle: VehicleActor): void {
        for (const controller of this.controllers) controller.releaseVehicle?.(vehicle);
        this.pendingSpawns.push(vehicle.name);
    }

    private retrySpawn(delta: DeltaTime): void {
        if (delta <= 0 || !this.pendingSpawns.length || !this.entries.length) return;

        this.spawnRetryElapsed += delta;
        if (this.spawnRetryElapsed < 0.25) return;
        this.spawnRetryElapsed = 0;

        const models = this.vehicleSetupDatas();
        if (!models.length) return;

        const model = getRandom(models)

        const spawnData : VehicleSpawnData = {
            startingEdge: getRandom(this.entries).edgeId,
            transform: new THREE.Object3D(),
            modelName: model.id,
            localBounds: new THREE.Box3()
        }
        const vehicle = this.createVehicle(spawnData, model);
        vehicle.name = this.pendingSpawns[0];

        if (this.addVehicle(vehicle)) this.pendingSpawns.shift();
    }

    createVehicle(spawnData: VehicleSpawnData, setupData: VehicleSetupData) {
        const [inst, transforms] = findVehicaleInstanceByName(this.SContext(), spawnData.modelName)!
        
        spawnData.localBounds.copy(inst.geometry.boundingBox!)
        return new VehicleActor(spawnData, setupData, this.SContext().network, this)
    }

    addVehicle(actor: VehicleActor): boolean {
        const { actors, network } = this.SContext();
        const spawnBox = actor.getUpdateboudingBox().clone().expandByScalar(0.5);

        const occupied = actors.some(other =>
            other instanceof VehicleActor && spawnBox.intersectsBox(other.getUpdateboudingBox()),
        );
        if (occupied) return false;

        const tail = network.getFarVehicleByEdge(actor.edgeId);
        const [inst, transforms] = findVehicaleInstanceByName(this.SContext(), actor.spawnData.modelName)!

        network.spawnVehicleActor(actor.edgeId, actor);
        this.appendToLaneQueue(actor, tail);
        actors.push(actor);
        transforms.push(actor.spawnData.transform)
        this.onVehicleAdded(actor);
        return true;
    }
    moveVehicleToEdge(actor: VehicleActor, nextEdgeId: string): void {
        const { network } = this.SContext();
        const vehicles = network.getVehiclesByEdgeId(nextEdgeId);
        // A self-loop can make the moving actor the current tail of its destination.
        const tail = vehicles.at(-1) === actor ? vehicles.at(-2) : vehicles.at(-1);

        network.swapEdge(actor.edgeId, nextEdgeId, actor);
        this.removeFromLaneQueue(actor);
        this.appendToLaneQueue(actor, tail);
    }

    private appendToLaneQueue(actor: VehicleActor, tail: VehicleActor | undefined): void {
        actor.laneQueue.forwardCar = tail;
        if (tail) tail.laneQueue.backCar = actor;
    }

    private removeFromLaneQueue(actor: VehicleActor): void {
        const { backCar, forwardCar } = actor.laneQueue;

        if (backCar) backCar.laneQueue.forwardCar = forwardCar;
        if (forwardCar) forwardCar.laneQueue.backCar = backCar;

        actor.laneQueue.backCar = undefined;
        actor.laneQueue.forwardCar = undefined;
    }

    removeVehicle(actor: VehicleActor) {
        const index = this.SContext().actors.indexOf(actor);

        if (index !== -1) {
            this.SContext().network.removeVehicleActor(actor);
            this.removeFromLaneQueue(actor);
            this.SContext().actors.splice(index, 1);

            const [inst, transforms] = findVehicaleInstanceByName(this.SContext(), actor.spawnData.modelName)!
            const ti = transforms.indexOf(actor.spawnData.transform)
            transforms.splice(ti, 1)
                
            this.onVehicleRemoved(actor)
        } else {
            console.warn("This actor not in scene")
        }        
    }
}