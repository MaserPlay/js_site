import type { RoadNetwork } from "./road_network.mjs";
import type { RoadSimulationManager } from "./simulation.mjs";

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

// Treat negligible rounding error as reaching the segment end.
const SEGMENT_END_TOLERANCE_METRES = 1e-8;

export class VehicleActor extends SimulationActor<VehicleSetupData> {
    private readonly upAxis = new THREE.Vector3(0, 1, 0);
    private readonly targetRotation = new THREE.Quaternion();

    private readonly edgeStartPos = new THREE.Vector3()
    private readonly edgeEndPos = new THREE.Vector3()

    private edge: RoadEdge
    private nextEdge?: RoadEdge
    private currentPoint: number = 0
    private _travelledPath: number = 0
    private segmentStartMetres = 0;
    private _totalDistanceMetres = 0;

    readonly frontOverhangMetres: number;
    readonly rearOverhangMetres: number;
    public speed = 0;
    public cruiseSpeed: number;

    public outsideTimer = 10

    // Neighbours on the current road edge.
    public readonly laneQueue: { forwardCar?: VehicleActor; backCar?: VehicleActor } = {};
    
    constructor(
        setupData: VehicleSetupData, 
        private readonly network: RoadNetwork, 
        private readonly manager: RoadSimulationManager
    ) {
        super(setupData)
        this.cruiseSpeed = setupData.speed;

        const initialBounds = this.getUpdateboudingBox();
        this.frontOverhangMetres = Math.max(0, this.position.z - initialBounds.min.z);
        this.rearOverhangMetres = Math.max(0, initialBounds.max.z - this.position.z);

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
    get nextEdgeId(): string | undefined {
        return this.nextEdge?.id;
    }

    get vehicleAhead(): VehicleActor | undefined {
        const sameEdgeLeader = this.laneQueue.forwardCar;
        if (sameEdgeLeader && sameEdgeLeader !== this && sameEdgeLeader.edgeId === this.edgeId) {
            return sameEdgeLeader;
        }

        if (!this.nextEdge) return undefined;

        const tail = this.network.getFarVehicleByEdge(this.nextEdge.id);
        return tail === this ? undefined : tail;
    }

    get distanceAlongEdgeMetres(): number {
        return this.segmentStartMetres + this._travelledPath;
    }

    get totalDistanceMetres(): number {
        return this._totalDistanceMetres;
    }

    update(delta: DeltaTime): void {
        if (delta <= 0) return;

        const cruiseSpeed = Number.isFinite(this.cruiseSpeed)
            ? Math.max(0, this.cruiseSpeed)
            : 0;
        const braking = 6;
        const acceleration = 3;
        let targetSpeed = cruiseSpeed;
        let availableDistance = Infinity;

        const positionAlongEdge = this.distanceAlongEdgeMetres;
        const remainingOnEdge = Math.max(0, this.network.getEdgeLength(this.edgeId) - positionAlongEdge);
        const leader = this.vehicleAhead;

        if (leader) {
            const centreDistance = leader.edgeId === this.edgeId
                ? leader.distanceAlongEdgeMetres - positionAlongEdge
                : remainingOnEdge + leader.distanceAlongEdgeMetres;
            const pathGap = centreDistance - this.frontOverhangMetres - leader.rearOverhangMetres;

            // A loop can put two distant points of the route next to each other.
            // Only use the world boxes for close following along the route.
            const closeFollowingDistance = 2 + cruiseSpeed * delta;
            const gap = pathGap <= closeFollowingDistance
                ? Math.min(pathGap, boxDistance(this.getUpdateboudingBox(), leader.getUpdateboudingBox()))
                : pathGap;

            const desiredGap = 0.5 + leader.speed * 0.6;
            targetSpeed = Math.min(targetSpeed, Math.max(0, leader.speed + (gap - desiredGap)));
            availableDistance = Math.max(0, gap - 0.5);
        }

        const features = this.manager.getRoadFeatures(this, cruiseSpeed * delta);
        for (const feature of features) {
            if (feature.endMetres !== undefined && positionAlongEdge >= feature.endMetres) continue;

            const distanceToStart = Math.max(0, feature.startMetres - positionAlongEdge);
            const speedAtStart = feature.maxSpeedMps;
            const approachSpeed = Math.sqrt(speedAtStart ** 2 + 2 * braking * distanceToStart);
            targetSpeed = Math.min(targetSpeed, approachSpeed);

            if (speedAtStart === 0 || this.speed > speedAtStart) {
                availableDistance = Math.min(availableDistance, distanceToStart + speedAtStart * delta);
            }
        }

        const speedChange = THREE.MathUtils.clamp(
            targetSpeed - this.speed, -braking * delta, acceleration * delta,
        );
        const allowedStep = Math.min((this.speed + speedChange) * delta, availableDistance);
        this.speed = allowedStep / delta;

        // Re-evaluate rules on the new approach before travelling on it.
        const distance = Math.min(allowedStep, remainingOnEdge);
        if (distance === 0) return;

        this._travelledPath += distance;
        this._totalDistanceMetres += distance;

        if (!this.trySwitchToNextPoint()) return;

        this.moveByPath();
        this.rotateByPath(delta);
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

            if (this._travelledPath + SEGMENT_END_TOLERANCE_METRES < length) {
                return true;
            }

            this._travelledPath = Math.max(0, this._travelledPath - length);
            this.segmentStartMetres += length;
            this.currentPoint++;

            if (this.currentPoint >= this.edge.points.length - 1) {
                if (!this.findNextedge()) return false;
            }

            this.calcStartEndEdgePos();
        }
    }
    private calcNextEdge(): void {
        const outgoing = this.network.getOutgoingEdges(this.edge.to)
            .filter(edge => edge.mode === 'vehicle');

        this.nextEdge = outgoing.length > 1 ? getRandom(outgoing) : outgoing[0];
    }

    private findNextedge(): boolean {
        const nextEdge = this.nextEdge;

        if (!nextEdge) {
            this.manager.removeVehicle(this);
            return false;
        }

        this.manager.moveVehicleToEdge(this, nextEdge.id);
        this.edge = nextEdge;
        this.currentPoint = 0;
        this.segmentStartMetres = 0;
        
        this.calcNextEdge()
        return true;
    }
    private calcStartEndEdgePos() {
        this.edgeStartPos.fromArray(this.edge.points[this.currentPoint]);
        this.edgeEndPos.fromArray(this.edge.points[this.currentPoint+1]);
    }

}