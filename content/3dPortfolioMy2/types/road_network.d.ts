interface RoadNetworkData {
    nodes: RoadNode[];
    edges: RoadEdge[];

    controls: RoadSignalControl[];
    stopLines: RoadStopLine[];
    signalGroups: RoadSignalGroup[];
    signalHeads: RoadSignalHead[];
    junctions: RoadJunction[];
}

interface RoadNode {
    id: string;
    position: PossibleVector3;
}

interface RoadEdge {
    id: string;
    from: string;
    to: string;
    points: PossibleVector3[];
    widthMetres: number;
    mode: "vehicle" | "pedestrian";
    kind: "lane" | "turn" | "sidewalk" | "crosswalk";
}

interface RoadSignalControl {
    id: string;
    kind: 'signal';

    edgeId: string;
    distanceAlongMetres: number;

    signalGroupId: string;
    stopLineId: string;
}

interface RoadStopLine {
    id: string;

    endpoints: [
        PossibleVector3,
        PossibleVector3,
    ];
}

interface RoadSignalGroup {
    id: string;
    junctionId: string;

    headIds: string[];
    controlledEdgeIds: string[];
}

interface RoadSignalHead {
    id: string;
    nodeId: string;

    kind: 'vehicle' | 'pedestrian';
    facingAxis: '+X' | '-X' | '+Z' | '-Z';

    lenses: {
        aspect: 'red' | 'amber' | 'green';
        nodeId: string;
    }[];
}

interface RoadJunction {
    id: string;

    nodeIds: string[];
    movementEdgeIds: string[];

    control: 'signals' | 'priority';

    // Пары участков, движение по которым конфликтует.
    conflicts: [string, string][];
    conflictsReviewed: boolean;
}