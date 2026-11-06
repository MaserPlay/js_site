type PositionXZ = [number, number];
type NavigationMode = 'vehicle' | 'pedestrian';

interface SimulationZonesData {
    schemaVersion: 1;
    kind: 'city-simulation-zones';
    exportId: string;
    citySha256: string;

    roadNetwork: {
        url: string;
        sha256: string;
    };

    coordinates: {
        units: 'metres';
        up: '+Y';
        forward: '-Z';
        space: 'world';
    };

    status: 'baked-geometry-not-runtime-reviewed';
    zones: SimulationZone[];
}

interface SimulationZone {
    id: string;
    name: string;

    boundaryXZ: PositionXZ[];
    minHeightMetres: number;
    maxHeightMetres: number;

    boundaryPolicy: 'included';
    activationRule: 'actor-origin-in-prism';

    edgeIntervals: SimulationZoneEdge[];
    portals: SimulationPortal[];

    activeJunctionIds: string[];
    activeSignalGroupIds: string[];
    internalTerminalNodeIds: string[];
}

interface SimulationZoneEdge {
    edgeId: string;
    mode: NavigationMode;
    intervals: SimulationEdgeInterval[];
}

interface SimulationEdgeInterval {
    // Расстояния от начала полного edge, в метрах.
    startDistanceMetres: number;
    endDistanceMetres: number;

    entryPortalId?: string;
    exitPortalId?: string;
}

interface SimulationPortal {
    id: string;
    zoneId: string;
    edgeId: string;

    mode: NavigationMode;
    direction: 'entry' | 'exit';

    distanceAlongMetres: number;
    position: PossibleVector3;
    tangent: PossibleVector3;

    // Индекс в intervals соответствующего SimulationZoneEdge.
    intervalIndex: number;
    automaticSpawnAllowed: boolean;

    // Есть при совпадении пересечения с узлом графа.
    graphNodeId?: string;
    outsideAdjacentEdgeIds?: string[];
}