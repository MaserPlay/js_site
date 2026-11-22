interface BuildingCatalogData {
    schemaVersion: 1;
    exportId: string;

    coordinates: {
        units: 'metres';
        up: PossibleAxisSide;
        space: 'building-local';
    };

    models: BuildingModelData[];
}

interface BuildingModelData {
    id: string;
    name: string;
    technical_name: string;

    url: string;
    nodeId: string;
    sha256: string;

    platformNodeName?: string;

    interaction: {
        point: BuildingProjectPointData;
        cameraRoute: BuildingCameraRouteData;
    };
}

interface BuildingProjectPointData {
    id: string;
    nodeId: string;
    buildingId: string;

    role: 'project-point';
    behavior: 'enter-project';
    routeId: string;

    pick: {
        min: PossibleVector3;
        max: PossibleVector3;
    };

    slots: {
        nodeId: string;
        role: 'media-slot' | 'comments-slot';
    }[];

    interiorLighting: {
        positions: PossibleVector3[];
        distance: number;
    };
}

interface BuildingCameraRouteData {
    id: string;
    pointId: string;
    arrivalNodeId: string;

    points: PossibleVector3[];
    lookAt: PossibleVector3;
    reversible: boolean;
}

interface BuildingPlacementsData {
    schemaVersion: 1;
    exportId: string;

    coordinates: {
        units: 'metres';
        up: PossibleAxisSide;
        space: 'world';
    };

    buildings: BuildingPlacementData[];
}

interface BuildingPlacementData {
    id: string;
    modelId: string;

    position: PossibleVector3;
    quaternion: [number, number, number, number]; // x, y, z, w
    scale: PossibleVector3;
}