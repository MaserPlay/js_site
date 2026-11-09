import { RoadNetwork } from "./road_network.mjs";
import { RoadSimulationManager } from "./simulation.mjs";

import * as THREE from 'three';
import { SimulationActor, SimulationActorSetupData } from "./simulation_actor.mjs";
import { boxDistance, getRandom } from "./utils.mjs";


export interface VehicleSetupData extends SimulationActorSetupData {
    startingEdge: string
    speed: number,
    rotatingSpeed: number,
}
export type VehicleSetupDataWithoutModel = Omit<VehicleSetupData, 'model'>
export type VehicleSetupDataWithoutStartingEdge = Omit<VehicleSetupData, 'startingEdge'>
export type SummonVehicleSetupData = Omit<Omit<VehicleSetupDataWithoutModel, 'startingEdge'>, 'model'>

export class VehicleActor extends SimulationActor<VehicleSetupData> {
    private readonly upAxis = new THREE.Vector3(0, 1, 0);
    private readonly targetRotation = new THREE.Quaternion();

    private readonly edgeStartPos = new THREE.Vector3()
    private readonly edgeEndPos = new THREE.Vector3()

    private edge: RoadEdge
    private nextEdge?: RoadEdge
    private currentPoint: number = 0
    private _travelledPath: number = 0

    public outsideTimer = 10

    public followCar?: VehicleActor
    public backCar?: VehicleActor
    
    constructor(
        setupData: VehicleSetupData, 
        private readonly network: RoadNetwork, 
        private readonly manager: RoadSimulationManager
    ) {
        super(setupData)

        this.edge = network.getEdge(setupData.startingEdge)!;
        this.calcNextEdge()
        
        this.calcStartEndEdgePos()

        this.moveByPath()
        
        this.rotateByPath(1)
    }
    get edgeId(): Readonly<string> {
        return this.edge.id
    }
    get travelledPath(): Readonly<number> {
        return this._travelledPath
    }
    update(delta: DeltaTime) {
        const requestedDistance = delta * this.setupData.speed;
        this._travelledPath += Math.min(requestedDistance, this.getDistanceTo());


        // Сначала находим отрезок, на котором заканчивается шаг.
        if (!this.trySwitchToNextPoint()) return;

        this.rotateByPath(delta)
        this.moveByPath()        
    }
    private getDistanceTo(): number {
        // Если ведущая уже сменила edge, смотрим на выбранное продолжение.
        const nextLaneTail = !this.followCar && this.nextEdge
            ? this.network.getFarVehicleByEdge(this.nextEdge.id)
            : undefined;

        const leader = this.followCar ?? nextLaneTail;
        if (!leader || leader === this) return Infinity;

        const gap = boxDistance(
            this.getUpdateboudingBox(),
            leader.getUpdateboudingBox(),
        );

        return Math.max(0, gap - 0.5);
    }
    private moveByPath() {
        const segmentLength = this.edgeStartPos.distanceTo(this.edgeEndPos);
        const fraction = this.travelledPath / segmentLength;

        this.position.lerpVectors(this.edgeStartPos, this.edgeEndPos, fraction);
    }
    private rotateByPath(delta: DeltaTime) {
        const dx = this.edgeEndPos.x - this.edgeStartPos.x; 
        const dz = this.edgeEndPos.z - this.edgeStartPos.z;

        if (dx !== 0 || dz !== 0) {
            const angle = Math.atan2(-dx, -dz);

            this.targetRotation.setFromAxisAngle(this.upAxis, angle);

            const smoothing = 1 - Math.exp(-this.setupData.rotatingSpeed * delta);

            this.quaternion.slerp(this.targetRotation, smoothing);
        }
    }
    private trySwitchToNextPoint(): boolean {
        while (true) {
            const length = this.edgeStartPos.distanceTo(this.edgeEndPos);

            if (this._travelledPath < length) {
                return true;
            }

            this._travelledPath -= length;
            this.currentPoint++;

            if (this.currentPoint >= this.edge.points.length - 1) {
                if (!this.findNextedge()) return false;
            }

            this.calcStartEndEdgePos();
        }
    }
    detachFromLane(): void {
        const { backCar, followCar } = this;

        if (backCar) backCar.followCar = followCar;
        if (followCar) followCar.backCar = backCar;

        this.backCar = undefined;
        this.followCar = undefined;
    }

    private calcNextEdge() {
        const nextEdges = this.network.getOutgoingEdges(this.edge.to);
        if (nextEdges.length == 0) {
            this.nextEdge = nextEdges[0]
        } else {
            this.nextEdge = getRandom(nextEdges);
        }
    }

    private findNextedge(): boolean {
        const nextEdge = this.nextEdge;

        if (!nextEdge) {
            this.manager.removeVehicle(this);
            return false;
        }

        const fromEdgeId = this.edgeId;
        this.detachFromLane();

        // Читаем хвост до добавления нашей машины в новый список.
        const tail = this.network.getFarVehicleByEdge(nextEdge.id);
        this.followCar = tail;

        if (tail) tail.backCar = this;

        this.network.swapEdge(fromEdgeId, nextEdge.id, this);
        this.edge = nextEdge;
        this.currentPoint = 0;
        
        this.calcNextEdge()
        return true;
    }
    private calcStartEndEdgePos() {
        this.edgeStartPos.fromArray(this.edge.points[this.currentPoint]);
        this.edgeEndPos.fromArray(this.edge.points[this.currentPoint+1]);
    }

}