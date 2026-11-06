/** Общие типы контракта, состояния и диагностики движения. Исполняемого кода здесь нет. */

export type Vec3 = [number,number,number];

export type Quat = [number, number, number, number];

export type Mode = 'vehicle' | 'pedestrian' | 'cycle';

export type Axis = '+X' | '-X' | '+Y' | '-Y' | '+Z' | '-Z';

export type Aspect = 'red' | 'amber' | 'green';

export type BarrierReason =
    | 'queue'
    | 'nearby-queue'
    | 'approach-occupied'
    | 'turn-occupied'
    | 'exit-blocked'
    | 'signal-red'
    | 'signal-amber'
    | 'collision-risk';

export interface SignalTimings {
    vehicleGreen: number;
    pedestrianGreen: number;
    amber: number;
    clearance: number;
}

export type SignalTimingOverrides = Readonly<Record<string, Partial<SignalTimings>>>;

export interface Checked {
    status: 'sampled-static' | 'validated-static';
    sourceFrame: number;
    clearanceRadiusMetres?: number;
    report?: string;
}

export interface Edge {
    id: string;
    from: string;
    to: string;
    mode: Mode;
    kind: 'lane' | 'turn' | 'sidewalk' | 'crosswalk';
    points: Vec3[];
    widthMetres: number;
    validation: Checked;
}

export interface Approach {
    id: string;
    junctionId: string;
    incomingEdgeId: string;
    movementEdgeIds: string[];
    signalGroupId: string;
    stopLineId: string;
}

export interface ActorAsset {
    id: string;
    mode: Mode;
    nodeId?: string;
    externalAsset?: {
        url: string;
        sha256: string;
        profile: 'city-people-rig-v1';
        variantId: string;
    };
    forwardAxis: Axis;
    upAxis: Axis;
    basisRotation: Quat;
    footprint: {
        halfLengthMetres: number;
        halfWidthMetres: number;
        heightMetres: number;
        centerOffset: Vec3;
    };
}

export interface MobilityData {
    schemaVersion: 1;
    kind: 'city-mobility';
    status: 'ready';
    exportId: string;
    citySha256: string;
    coordinates: {
        units: 'metres';
        up: '+Y';
        forward: '-Z';
        space: 'world';
    };
    coverage: 'partial' | 'full';
    validation: Checked;
    nodes: {
        id: string;
        position: Vec3;
        kind: 'endpoint' | 'junction' | 'crossing';
    }[];
    edges: Edge[];
    junctions: {
        id: string;
        nodeIds: string[];
        movementEdgeIds: string[];
        control: 'signals';
        conflicts: [string, string][];
        conflictsReviewed: true;
    }[];
    approaches?: Approach[];
    stopLines: {
        id: string;
        endpoints: [Vec3, Vec3];
        nodeId?: string;
    }[];
    controls: {
        id: string;
        kind: 'signal';
        edgeId: string;
        distanceAlongMetres: number;
        stopLineId?: string;
        signalGroupId: string;
    }[];
    signalGroups: {
        id: string;
        junctionId: string;
        headIds: string[];
        controlledEdgeIds: string[];
    }[];
    signalHeads: {
        id: string;
        nodeId: string;
        kind: 'vehicle' | 'pedestrian';
        facingAxis: Axis;
        lenses: {
            aspect: Aspect;
            nodeId: string;
        }[];
    }[];
    actorAssets: ActorAsset[];
    actorSpawns: {
        id: string;
        nodeId: string;
        assetId: string;
        edgeId: string;
        distanceAlongMetres: number;
    }[];
}

export interface ActorState {
    id: string;
    nodeId: string;
    asset: ActorAsset;
    edgeId: string;
    distance: number;
    travelled: number;
    speed: number;
    active: boolean;
    desiredActive: boolean;
    /** Кто не дал выполнить последний шаг из-за пересечения габаритов. */
    collisionBlockerId?: string;
    position: Vec3;
    forward: Vec3;
    plan: string[];
    choices: number;
    exits: Map<string, number>;
}

export interface SignalClock {
    groups: string[];
    index: number;
    stage: 'green' | 'amber' | 'clearance';
    elapsed: number;
}

export interface BarrierLimit {
    distance: number;
    reason: BarrierReason;
    sourceId: string;
}

export interface ActorPose {
    position: Vec3;
    forward: Vec3;
}

export interface ActorFootprint {
    center: Vec3;
    right: Vec3;
    forward: Vec3;
}

export interface PathSpan {
    start: number;
    end: number;
}

export interface RouteTransition {
    from: string;
    to: string;
    offset: number;
}
