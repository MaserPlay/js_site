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
    private currentPoint: number = 0
    private travelledPath: number = 0

    public outsideTimer = 10

    public followCar?: VehicleActor
    
    constructor(
        setupData: VehicleSetupData, 
        private readonly network: RoadNetwork, 
        private readonly manager: RoadSimulationManager
    ) {
        super(setupData)

        this.edge = network.getEdge(setupData.startingEdge)!;
        
        this.calcStartEndEdgePos()

        this.moveByPath()
        
        this.rotateByPath(1)
    }
    update(delta: DeltaTime) {
        if (this.getDistanceTo() > 0) {
            this.travelledPath += delta * this.setupData.speed
        }

        this.rotateByPath(delta)

        this.moveByPath()        

        this.trySwitchToNextPoint()
    }
    private getDistanceTo() {
        const followCar = this.followCar
        if (!followCar) return Infinity

        if (followCar.edge == this.edge && followCar.currentPoint == this.currentPoint) {
            return Math.max(followCar.travelledPath - this.travelledPath, 0)
        }

        return Math.max(boxDistance(this.boudingBox, followCar.boudingBox), 0)
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
    private trySwitchToNextPoint() {

        const segmentLength = this.edgeStartPos.distanceTo(this.edgeEndPos);
        const fraction = this.travelledPath / segmentLength;

        if (fraction > 1) {
            this.currentPoint++
            this.travelledPath -= segmentLength;
            if (this.currentPoint >= this.edge.points.length - 1) {
                if (!this.findNextedge()) {
                    return;
                }
            }
            this.calcStartEndEdgePos()
        }
    }
    private findNextedge(): boolean {
        const nextEdges = this.network.getOutgoingEdges(this.edge.to)
        if (nextEdges.length == 0) {
            this.manager.removeVehicle(this)
            return false;
        } 
        
        if (nextEdges.length > 1) {
            this.edge = getRandom(nextEdges)
        } else {
            this.edge = nextEdges[0]
        }
        
        this.currentPoint = 0
        return true;
    }
    private calcStartEndEdgePos() {
        this.edgeStartPos.fromArray(this.edge.points[this.currentPoint]);
        this.edgeEndPos.fromArray(this.edge.points[this.currentPoint+1]);
    }

}