import { fetchJson } from "./utils.mjs";
import { VehicleActor } from "./vehicle.mjs";

export class RoadNetwork {
    private readonly edgesById = new Map<string, RoadEdge>();
    private readonly outgoingByNode = new Map<string, RoadEdge[]>();
    private readonly edgeControlls = new Map<string, RoadSignalControl>();
    
    private readonly vehiclesOnEdges = new Map<string, VehicleActor[]>();

    private constructor(
        roadNetworkData: RoadNetworkData
    ) {
        for (const controll of roadNetworkData.controls) {
            this.edgeControlls.set(controll.edgeId, controll);
        }
        for (const edge of roadNetworkData.edges) {
            this.edgesById.set(edge.id, edge);

            let outgoing = this.outgoingByNode.get(edge.from);

            if (!outgoing) {
                outgoing = [];
                this.outgoingByNode.set(edge.from, outgoing);
            }

            outgoing.push(edge);
            
            this.vehiclesOnEdges.set(edge.id, [])
        }
    }
    static async load(
        roadNetworkPath:string
    ) {
        return new RoadNetwork(await fetchJson(roadNetworkPath))
    }

    getEdge(id: string) {
        return this.edgesById.get(id);
    }

    getOutgoingEdges(nodeId: string) {
        return this.outgoingByNode.get(nodeId) ?? [];
    }

    getRoadController(edgeId: string) {
        return this.edgeControlls.get(edgeId);
    }

    getVehiclesByEdgeId(edgeId: string) {
        return this.vehiclesOnEdges.get(edgeId)!
    }
    getFarVehicleByEdge(edgeId: string) {
        return this.getVehiclesByEdgeId(edgeId).sort((a,b) => Number(a.travelledPath > b.travelledPath))[0]
    }

    spawnVehicleActor(edgeId: string, self: VehicleActor) {
        this.vehiclesOnEdges.get(edgeId)!.push(self)
    }
    removeVehicleActor(self: VehicleActor) {
        this._removeVehicleActor(self.edgeId, self)
    }
    private _removeVehicleActor(edgeId: string, self: VehicleActor) {
        const fromEdgeVehicles = this.vehiclesOnEdges.get(edgeId)!
        const fromIndex = fromEdgeVehicles.indexOf(self)
        if (fromIndex == -1) {
            throw new Error("VehicleActor must exsists in this.vehiclesOnEdges")
        }
        fromEdgeVehicles.splice(fromIndex, 1)
    }
    swapEdge(edgeIdFrom: string, edgeIdTo: string, self: VehicleActor) {
        this._removeVehicleActor(edgeIdFrom, self)
        this.spawnVehicleActor(edgeIdTo, self)
    }
}