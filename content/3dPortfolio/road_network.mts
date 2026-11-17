import { fetchJson } from "./utils.mjs";
import type { VehicleActor } from "./vehicle.mjs";

export class RoadNetwork {
    private readonly edgesById = new Map<string, RoadEdge>();
    private readonly outgoingByNode = new Map<string, RoadEdge[]>();
    private readonly signalControlsByEdge = new Map<string, RoadSignalControl[]>();
    private readonly lengthsByEdge = new Map<string, number>();
    
    private readonly vehiclesOnEdges = new Map<string, VehicleActor[]>();

    private constructor(
        readonly data: RoadNetworkData
    ) {
        for (const control of data.controls) {
            let controls = this.signalControlsByEdge.get(control.edgeId);
            if (!controls) {
                controls = [];
                this.signalControlsByEdge.set(control.edgeId, controls);
            }
            controls.push(control);
        }
        for (const edge of data.edges) {
            this.edgesById.set(edge.id, edge);

            let length = 0;
            for (let i = 1; i < edge.points.length; i++) {
                const [ax, ay, az] = edge.points[i - 1];
                const [bx, by, bz] = edge.points[i];
                length += Math.hypot(bx - ax, by - ay, bz - az);
            }
            this.lengthsByEdge.set(edge.id, length);

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

    getSignalControls(edgeId: string): readonly RoadSignalControl[] {
        return this.signalControlsByEdge.get(edgeId) ?? [];
    }

    getRoadController(edgeId: string): RoadSignalControl | undefined {
        return this.getSignalControls(edgeId).at(-1);
    }

    getEdgeLength(edgeId: string): number {
        const length = this.lengthsByEdge.get(edgeId);
        if (length === undefined) throw new Error(`Unknown road edge: ${edgeId}`);
        return length;
    }

    getVehiclesByEdgeId(edgeId: string) {
        return this.vehiclesOnEdges.get(edgeId)!
    }
    getFarVehicleByEdge(edgeId: string): VehicleActor | undefined {
        const vehicles = this.getVehiclesByEdgeId(edgeId);
        return vehicles[vehicles.length - 1];
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