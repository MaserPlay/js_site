interface RoadNetworkData {
    nodes: RoadNode[];
    edges: RoadEdge[];

    controls: RoadSignalControl[];
    stopLines: RoadStopLine[];
    signalGroups: RoadSignalGroup[];
    signalHeads: RoadSignalHead[];
    junctions: RoadJunction[];
}

export class RoadNetwork {
    private readonly edgesById = new Map<string, RoadEdge>();
    private readonly outgoingByNode = new Map<string, RoadEdge[]>();

    private constructor(data: RoadNetworkData) {
        data.controls[0].edgeId
        for (const edge of data.edges) {
            this.edgesById.set(edge.id, edge);

            let outgoing = this.outgoingByNode.get(edge.from);

            if (!outgoing) {
                outgoing = [];
                this.outgoingByNode.set(edge.from, outgoing);
            }

            outgoing.push(edge);
        }
    }
    static async load(setup:ViewerSetupData) {
        const response = await fetch(setup.initialCityPackUrl + "/road-network.json");

        if (!response.ok) {
            throw new Error(`loading error: ${response.status}`);
        }

        const data: RoadNetworkData = await response.json();

        return new RoadNetwork(data)
    }

    getEdge(id: string) {
        return this.edgesById.get(id);
    }

    getOutgoingEdges(nodeId: string) {
        return this.outgoingByNode.get(nodeId) ?? [];
    }
}