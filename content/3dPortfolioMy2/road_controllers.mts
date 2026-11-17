import * as THREE from 'three';
import type { RoadNetwork } from './road_network.mjs';
import type { VehicleActor } from './vehicle.mjs';

export interface RoadFeature {
    kind: 'speed';
    startMetres: number;
    endMetres?: number;
    maxSpeedMps: number;
}

export interface RoadController {
    readonly approachEdgeIds: readonly string[];
    update(delta: DeltaTime): void;
    getFeatures(vehicle: VehicleActor, maxStepMetres: number): readonly RoadFeature[];
    releaseVehicle?(vehicle: VehicleActor): void;
}

type LampAspect = RoadSignalHead['lenses'][number]['aspect'];
type LampMode = 'off' | 'on' | 'blink';

export interface SignalGroupState {
    lamps: Record<LampAspect, LampMode>;
    allowEntry: boolean;
}

const RED: SignalGroupState = { lamps: { red: 'on', amber: 'off', green: 'off' }, allowEntry: false };
const AMBER: SignalGroupState = { lamps: { red: 'off', amber: 'on', green: 'off' }, allowEntry: false };
const GREEN: SignalGroupState = { lamps: { red: 'off', amber: 'off', green: 'on' }, allowEntry: true };
const LAMP_COLORS = { red: 0xff2222, amber: 0xffa000, green: 0x25ff55 };

const DEFAULT_SIGNAL_TIMINGS = {
    vehicleGreen: 14,
    pedestrianGreen: 8,
    amber: 3,
    allRed: 1.5,
};

const ROAD_STOP_GAP_METRES = 0.2;

/** One physical head in the GLB. Its lamps have independently editable materials. */
class TrafficSignal {
    private readonly lamps: {
        aspect: LampAspect;
        materials: (THREE.MeshStandardMaterial | THREE.MeshBasicMaterial)[];
        on?: boolean;
    }[] = [];

    constructor(head: RoadSignalHead, objects: ReadonlyMap<string, THREE.Object3D>) {
        for (const lens of head.lenses) {
            const materials: (THREE.MeshStandardMaterial | THREE.MeshBasicMaterial)[] = [];
            objects.get(lens.nodeId)?.traverse(object => {
                if (!(object instanceof THREE.Mesh)) return;

                const cloneMaterial = (material: THREE.Material): THREE.Material => {
                    if (!(material instanceof THREE.MeshStandardMaterial) &&
                        !(material instanceof THREE.MeshBasicMaterial)) return material;

                    const copy = material.clone();
                    materials.push(copy);
                    return copy;
                };

                object.material = Array.isArray(object.material)
                    ? object.material.map(cloneMaterial)
                    : cloneMaterial(object.material);
            });

            if (!materials.length) console.warn(`Signal lens has no supported material: ${lens.nodeId}`);
            this.lamps.push({ aspect: lens.aspect, materials });
        }
    }

    show(state: SignalGroupState, blinkOn: boolean): void {
        for (const lamp of this.lamps) {
            const mode = state.lamps[lamp.aspect];
            const on = mode === 'on' || (mode === 'blink' && blinkOn);
            if (lamp.on === on) continue;
            lamp.on = on;

            const color = LAMP_COLORS[lamp.aspect];
            for (const material of lamp.materials) {
                material.color.setHex(on ? color : 0x16191b);

                if (material instanceof THREE.MeshStandardMaterial) {
                    material.emissive.setHex(on ? color : 0);
                    material.emissiveIntensity = on ? 2.5 : 0;
                }
            }
        }
    }
}

interface JunctionMovement {
    edge: RoadEdge;
    stopLineMetres: number;
    signalGroupId?: string;
}

interface JunctionPhase {
    duration: number;
    groupId?: string;
    state?: SignalGroupState;
}

/** Coordinates the crossing, including the signals and vehicles already committed to it. */
export class JunctionController implements RoadController {
    readonly approachEdgeIds: readonly string[];
    private readonly approaches = new Map<string, Map<string, JunctionMovement>>();
    private readonly conflicts = new Map<string, Set<string>>();
    private readonly signalsByGroup = new Map<string, TrafficSignal[]>();
    private readonly reservations = new Map<VehicleActor, { movement: RoadEdge; releaseAtMetres: number }>();
    private readonly phases: JunctionPhase[] = [];
    private phaseIndex = 0;
    private phaseElapsed = 0;
    private time = 0;
    private override?: ReadonlyMap<string, SignalGroupState>;

    constructor(
        readonly junction: RoadJunction,
        private readonly network: RoadNetwork,
        objects: ReadonlyMap<string, THREE.Object3D>,
        timings = DEFAULT_SIGNAL_TIMINGS,
    ) {
        const groups = network.data.signalGroups.filter(group => group.junctionId === junction.id);
        const movements = new Set(junction.movementEdgeIds);

        for (const [first, second] of junction.conflicts) {
            if (!this.conflicts.has(first)) this.conflicts.set(first, new Set());
            if (!this.conflicts.has(second)) this.conflicts.set(second, new Set());
            this.conflicts.get(first)!.add(second);
            this.conflicts.get(second)!.add(first);
        }

        for (const edge of network.data.edges) {
            if (edge.mode !== 'vehicle' || movements.has(edge.id)) continue;

            for (const movement of network.getOutgoingEdges(edge.to)) {
                if (movement.mode !== 'vehicle' || !movements.has(movement.id)) continue;

                const authoredApproach = network.data.approaches?.find(approach =>
                    approach.junctionId === junction.id &&
                    approach.incomingEdgeId === edge.id &&
                    approach.movementEdgeIds.includes(movement.id),
                );
                const signalGroupId = authoredApproach?.signalGroupId ??
                    groups.find(group => group.controlledEdgeIds.includes(movement.id))?.id;
                const control = network.getSignalControls(edge.id).find(item =>
                    item.signalGroupId === signalGroupId &&
                    (!authoredApproach || item.stopLineId === authoredApproach.stopLineId),
                );

                let exits = this.approaches.get(edge.id);
                if (!exits) {
                    exits = new Map();
                    this.approaches.set(edge.id, exits);
                }

                exits.set(movement.id, {
                    edge: movement,
                    stopLineMetres: control?.distanceAlongMetres ?? network.getEdgeLength(edge.id),
                    signalGroupId,
                });
            }
        }
        this.approachEdgeIds = [...this.approaches.keys()];

        for (const group of groups) {
            const heads = network.data.signalHeads.filter(head => group.headIds.includes(head.id));
            this.signalsByGroup.set(group.id, heads.map(head => new TrafficSignal(head, objects)));

            const pedestrian = heads.every(head => head.kind === 'pedestrian');
            this.phases.push({
                groupId: group.id,
                state: GREEN,
                duration: pedestrian ? timings.pedestrianGreen : timings.vehicleGreen,
            });
            if (!pedestrian) this.phases.push({ groupId: group.id, state: AMBER, duration: timings.amber });
            this.phases.push({ duration: timings.allRed });
        }

        this.update(0);
    }

    setSignalOverride(states?: ReadonlyMap<string, SignalGroupState>): void {
        this.override = states;
        this.update(0);
    }

    update(delta: DeltaTime): void {
        for (const [vehicle, reservation] of this.reservations) {
            if (vehicle.totalDistanceMetres >= reservation.releaseAtMetres) {
                this.reservations.delete(vehicle);
            }
        }

        if (!this.phases.length) return;

        this.time += delta;
        this.phaseElapsed += delta;
        while (this.phaseElapsed >= this.phases[this.phaseIndex].duration) {
            this.phaseElapsed -= this.phases[this.phaseIndex].duration;
            this.phaseIndex = (this.phaseIndex + 1) % this.phases.length;
        }

        for (const [groupId, heads] of this.signalsByGroup) {
            const state = this.getSignalState(groupId);
            for (const head of heads) head.show(state, this.time % 1 < 0.5);
        }
    }

    releaseVehicle(vehicle: VehicleActor): void {
        this.reservations.delete(vehicle);
    }

    getFeatures(vehicle: VehicleActor, maxStepMetres: number): readonly RoadFeature[] {
        const movement = this.approaches.get(vehicle.edgeId)?.get(vehicle.nextEdgeId ?? '');
        if (!movement || this.reservations.has(vehicle)) return [];

        const stopAt = Math.max(0, movement.stopLineMetres - vehicle.frontOverhangMetres - ROAD_STOP_GAP_METRES);
        // A leader still on this approach owns the decision at the stop line.
        const forwardCar = vehicle.laneQueue.forwardCar;
        if (forwardCar && forwardCar.distanceAlongEdgeMetres + forwardCar.frontOverhangMetres <= movement.stopLineMetres + 0.01) {
            return [];
        }

        const signalAllowsEntry = this.junction.control === 'priority' ||
            (movement.signalGroupId !== undefined && this.getSignalState(movement.signalGroupId).allowEntry);

        if (!signalAllowsEntry || this.isMovementOccupied(movement.edge) ||
            !this.hasSpaceAfter(movement.edge, vehicle)) {
            return [{ kind: 'speed', startMetres: stopAt, maxSpeedMps: 0 }];
        }

        if (stopAt - vehicle.distanceAlongEdgeMetres <= Math.max(1, maxStepMetres)) {
            const distanceToMovementEnd =
                this.network.getEdgeLength(vehicle.edgeId) - vehicle.distanceAlongEdgeMetres +
                this.network.getEdgeLength(movement.edge.id);

            this.reservations.set(vehicle, {
                movement: movement.edge,
                releaseAtMetres: vehicle.totalDistanceMetres + distanceToMovementEnd +
                    vehicle.rearOverhangMetres + ROAD_STOP_GAP_METRES,
            });
        }

        return [];
    }

    private getSignalState(groupId: string): SignalGroupState {
        const phase = this.phases[this.phaseIndex];
        return this.override?.get(groupId) ??
            (phase?.groupId === groupId ? phase.state ?? RED : RED);
    }

    private isMovementOccupied(movement: RoadEdge): boolean {
        for (const { movement: occupied } of this.reservations.values()) {
            if (occupied.id === movement.id || occupied.to === movement.to ||
                this.conflicts.get(movement.id)?.has(occupied.id)) return true;
        }

        return false;
    }

    private hasSpaceAfter(movement: RoadEdge, vehicle: VehicleActor): boolean {
        const lengthNeeded = vehicle.frontOverhangMetres + vehicle.rearOverhangMetres + ROAD_STOP_GAP_METRES;

        return this.network.getOutgoingEdges(movement.to).every(exit => {
            if (exit.mode !== 'vehicle') return true;

            const tail = this.network.getFarVehicleByEdge(exit.id);
            if (!tail || tail === vehicle) return true;

            return tail.distanceAlongEdgeMetres - tail.rearOverhangMetres >= lengthNeeded;
        });
    }
}
