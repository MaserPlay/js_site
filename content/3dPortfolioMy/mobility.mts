import type {
    Vec3,
    Quat,
    Mode,
    Axis,
    Aspect,
    BarrierReason,
    SignalTimings,
    SignalTimingOverrides,
    Checked,
    Edge,
    Approach,
    ActorAsset,
    MobilityData,
    ActorState,
    SignalClock,
    BarrierLimit,
    ActorPose,
    ActorFootprint,
    PathSpan,
    RouteTransition
} from './mobility-types.js';

// Совместимость с существующими type-import из mobility.mjs.
export type * from './mobility-types.js';



/** Spatial data is authored in Blender. Timing, routing choices and queues belong to the site. */







/** Длительность фаз в секундах. Геометрию Blender для изменения времени экспортировать не нужно. */




export const DEFAULT_SIGNAL_TIMINGS: Readonly<SignalTimings> = {
    vehicleGreen: 14,    // зелёный для машин — 14 секунд
    pedestrianGreen: 8,  // зелёный для пешеходов — 8 секунд
    amber: 3,           // жёлтый — 3 секунды
    clearance: 1        // пауза: всем красный — 1 секунда
};






function requireValue(value: unknown, message: string): asserts value {
    if (!value) {
        throw new Error('Движение: ' + message);
    }
}
function vector(value: unknown): value is Vec3 {
    return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
}
function distance(a: Vec3, b: Vec3): number {
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
function index<T extends {
    id: string;
}>(items: T[], label: string): Map<string, T> {
    requireValue(Array.isArray(items), label + ': нужен массив');
    const result = new Map<string, T>();
    for (const item of items) {
        requireValue(item &&
            typeof item.id === 'string' &&
            /^[a-z0-9][a-z0-9._:-]*$/i.test(item.id) &&
            !result.has(item.id), label +
        ': неверный/повторный ID');
        result.set(item.id, item);
    }
    return result;
}
const axes: Record<Axis, Vec3> = {
    '+X': [1, 0, 0], '-X': [-1, 0, 0], '+Y': [0, 1, 0], '-Y': [0, -1, 0], '+Z': [0, 0, 1], '-Z': [0, 0, -1]
};
/** Поворачивает вектор кватернионом из экспорта. Three.js для этой математики не нужен. */
function rotate(v: Vec3, q: Quat): Vec3 {
    const [x, y, z, w] = q;
    const [a, b, c] = v;
    const tx = 2 * (y * c - z * b);
    const ty = 2 * (z * a - x * c);
    const tz = 2 * (x * b - y * a);
    return [a + w * tx + y * tz - z * ty, b + w * ty + z * tx - x * tz, c + w * tz + x * ty - y * tx];
}
/** Длины сегментов считаются один раз; sample() получает положение по пройденным метрам. */
export class EdgePath {
    readonly cumulative = [0];
    readonly length: number;
    readonly straightSpans: PathSpan[] = [];
    constructor(readonly data: Edge) {
        for (let i = 1;i < data.points.length;i++) {
            this.cumulative.push(this.cumulative[i - 1] + distance(data.points[i - 1], data.points[i]));
        }
        this.length = this.cumulative[this.cumulative.length - 1];
        let start = 0;
        let heading: Vec3 | undefined;
        for (let i = 1;i < data.points.length;i++) {
            const a = data.points[i - 1];
            const b = data.points[i];
            const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
            const current: Vec3 = [(b[0] - a[0]) / length, 0, (b[2] - a[2]) / length];
            if (heading && heading[0] * current[0] + heading[2] * current[2] < .99985) {
                this.straightSpans.push({
                    start, end: this.cumulative[i - 1]
                });
                start = this.cumulative[i - 1];
                heading = undefined;
            }
            heading ??= current;
        }
        this.straightSpans.push({
            start, end: this.length
        });
    }
    sample(at: number): ActorPose {
        const d = Math.min(this.length, Math.max(0, at));
        let i = 1;
        while (i < this.cumulative.length - 1 && this.cumulative[i] < d) {
            i++;
        }
        const a = this.data.points[i - 1];
        const b = this.data.points[i];
        const length = this.cumulative[i] - this.cumulative[i - 1];
        const t = (d - this.cumulative[i - 1]) / length;
        const horizontal = Math.hypot(b[0] - a[0], b[2] - a[2]);
        return {
            position: [a[0] +
                (b[0] - a[0]) * t, a[1] +
            (b[1] - a[1]) * t, a[2] +
            (b[2] - a[2]) * t], forward: [(b[0] - a[0]) / horizontal, 0, (b[2] - a[2]) / horizontal]
        };
    }
}
/** Stable personal lane choice; fade to authored endpoints without frame randomness. */
// Хэш ID задаёт постоянный личный сдвиг. Smoothstep плавно убирает его у концов пути.
export function pedestrianOffset(id: string, at: number, length: number, room: number): {
    offset: number;
    slope: number;
} {
    let seed = 2166136261;
    for (const c of id) {
        seed = Math.imul(seed ^ c.charCodeAt(0), 16777619) >>> 0;
    }
    const amplitude = ((seed % 10007) / 10006 * 2 - 1) * Math.max(0, Math.min(.12, room));
    const ramp = Math.min(8, length / 3);
    const fromStart = at < length - at;
    const t = Math.max(0, Math.min(1, (fromStart ? at : length - at) / ramp));
    return {
        offset: amplitude * t * t * (3 - 2 * t), slope: amplitude * 6 * t * (1 - t) / ramp * (fromStart ? 1 : -1)
    };
}
function actorPose(actor: ActorState, path: EdgePath, at: number): ActorPose {
    const pose = path.sample(at);
    const edge = path.data;
    if (actor.asset.mode !== 'pedestrian' || edge.kind !== 'sidewalk' || path.length < 12) {
        return pose;
    }
    // Curves keep their authored centreline. Long straight spans can vary even
    // when their parent sidewalk edge also contains a bend at its endpoints.
    const span = path.straightSpans.find(span => at >= span.start && at <= span.end);
    if (!span || span.end - span.start < 12) {
        return pose;
    }
    const f = actor.asset.footprint;
    const room = edge.widthMetres / 2 - f.halfWidthMetres - Math.abs(f.centerOffset[0]) - .08;
    const { offset, slope } = pedestrianOffset(actor.id, at - span.start, span.end - span.start, room);
    const [x, , z] = pose.forward;
    const right: Vec3 = [-z, 0, x];
    pose.position[0] += right[0] * offset;
    pose.position[2] += right[2] * offset;
    const norm = Math.hypot(1, slope);
    pose.forward = [(x + right[0] * slope) / norm, 0, (z + right[2] * slope) / norm];
    return pose;
}
/** Reject drafts and mismatched versions before moving a single city object. */
// Проверки контракта: версия пакета, геометрия, связи, светофоры и стартовые позиции.
export function validateMobility(raw: unknown, exportId: string, citySha256: string, roles: Map<string, string>): MobilityData {
    const d = raw as MobilityData;
    requireValue(d && d.schemaVersion === 1 && d.kind === 'city-mobility' && d.status === 'ready', 'не готовая сеть v1');
    requireValue(d.exportId === exportId && d.citySha256 === citySha256, 'сеть относится к другой версии города');
    requireValue(d.coordinates?.units === 'metres' &&
        d.coordinates.up === '+Y' &&
        d.coordinates.forward === '-Z' &&
        d.coordinates.space === 'world', 'неверные координаты');
    const checked = (v: Checked): boolean => !!v &&
        ['sampled-static', 'validated-static'].includes(v.status) &&
        Number.isInteger(v.sourceFrame);
    requireValue(checked(d.validation) && ['partial', 'full'].includes(d.coverage), 'не проверены пространственные данные');
    const nodes = index(d.nodes, 'nodes');
    const edges = index(d.edges, 'edges');
    const junctions = index(d.junctions, 'junctions');
    const lines = index(d.stopLines, 'stopLines');
    const controls = index(d.controls, 'controls');
    const groups = index(d.signalGroups, 'signalGroups');
    const heads = index(d.signalHeads, 'signalHeads');
    const assets = index(d.actorAssets, 'actorAssets');
    const spawns = index(d.actorSpawns, 'actorSpawns');
    requireValue(edges.size > 0 && spawns.size > 0, 'пустая сеть');
    for (const node of nodes.values()) {
        requireValue(vector(node.position) && ['endpoint', 'junction', 'crossing'].includes(node.kind), `неверная точка ${node.id}`);
    }
    const paths = new Map<string, EdgePath>();
    for (const edge of edges.values()) {
        requireValue(nodes.has(edge.from) &&
            nodes.has(edge.to) &&
            ['vehicle', 'pedestrian', 'cycle'].includes(edge.mode) &&
            ['lane', 'turn', 'sidewalk', 'crosswalk'].includes(edge.kind), `неверное ребро ${edge.id}`);
        requireValue(Array.isArray(edge.points) &&
            edge.points.length >= 2 &&
            edge.points.every(vector) &&
            Number.isFinite(edge.widthMetres) &&
            edge.widthMetres > 0 &&
            checked(edge.validation), `не проверено ребро ${edge.id}`);
        requireValue(distance(edge.points[0], nodes.get(edge.from)!.position) < .02 &&
            distance(edge.points.at(-1)!, nodes.get(edge.to)!.position) < .02, `разрыв концов ${edge.id}`);
        for (let i = 1;i < edge.points.length;i++) {
            requireValue(Math.hypot(edge.points[i][0] - edge.points[i - 1][0], edge.points[i][2] - edge.points[i - 1][2]) > .00001, `нулевой/вертикальный сегмент ${edge.id}`);
        }
        paths.set(edge.id, new EdgePath(edge));
    }
    for (const edge of edges.values()) {
        requireValue(d.edges.some(next => next.from === edge.to &&
            next.mode === edge.mode), `тупик ${edge.id}: нужен явный дальнейший путь`);
    }
    for (const line of lines.values()) {
        requireValue(Array.isArray(line.endpoints) &&
            line.endpoints.length === 2 &&
            line.endpoints.every(vector) &&
            distance(...line.endpoints) > .05 &&
            (!line.nodeId ||
                roles.has(line.nodeId)), `неверная стоп-линия ${line.id}`);
    }
    const lensIds = new Set<string>();
    for (const head of heads.values()) {
        requireValue(roles.get(head.nodeId) === 'signal-head' &&
            ['vehicle', 'pedestrian'].includes(head.kind) &&
            Object.hasOwn(axes, head.facingAxis), `неверная голова ${head.id}`);
        requireValue(Array.isArray(head.lenses) &&
            new Set(head.lenses.map(l => l.aspect)).size === head.lenses.length &&
            head.lenses.some(l => l.aspect === 'red') &&
            head.lenses.some(l => l.aspect === 'green') &&
            (head.kind !== 'vehicle' ||
                head.lenses.some(l => l.aspect === 'amber')), `неполные линзы ${head.id}`);
        for (const lens of head.lenses) {
            requireValue(['red', 'amber', 'green'].includes(lens.aspect) &&
                roles.get(lens.nodeId) === 'signal-lens' &&
                !lensIds.has(lens.nodeId), `повторная/отсутствующая линза ${head.id}`);
            lensIds.add(lens.nodeId);
        }
    }
    const movementOwners = new Map<string, string>();
    for (const junction of junctions.values()) {
        requireValue(junction.control === 'signals' &&
            junction.conflictsReviewed === true &&
            Array.isArray(junction.conflicts) &&
            Array.isArray(junction.nodeIds) &&
            junction.nodeIds.every(id => nodes.has(id)) &&
            Array.isArray(junction.movementEdgeIds) &&
            junction.movementEdgeIds.length > 0, `не проверен перекрёсток ${junction.id}`);
        for (const id of junction.movementEdgeIds) {
            requireValue(edges.has(id) && !movementOwners.has(id), `неверное движение ${id}`);
            movementOwners.set(id, junction.id);
        }
        for (const pair of junction.conflicts) {
            requireValue(Array.isArray(pair) &&
                pair.length === 2 &&
                pair[0] !== pair[1] &&
                pair.every(id => junction.movementEdgeIds.includes(id)), `неверный конфликт ${junction.id}`);
        }
    }
    const approaches = index(d.approaches ?? [], 'approaches');
    const approachOwners = new Map<string, string>();
    const approachLanes = new Set<string>();
    const approachGroups = new Set<string>();
    for (const approach of approaches.values()) {
        const junction = junctions.get(approach.junctionId);
        const incoming = edges.get(approach.incomingEdgeId);
        const group = groups.get(approach.signalGroupId);
        requireValue(junction &&
            incoming?.mode === 'vehicle' &&
            !movementOwners.has(incoming.id) &&
            group?.junctionId === junction.id &&
            lines.has(approach.stopLineId), `неверный подход ${approach.id}`);
        requireValue(!approachLanes.has(incoming.id) && !approachGroups.has(group.id), `повторная полоса/группа подхода ${approach.id}`);
        approachLanes.add(incoming.id);
        approachGroups.add(group.id);
        requireValue(Array.isArray(approach.movementEdgeIds) &&
            approach.movementEdgeIds.length > 0 &&
            new Set(approach.movementEdgeIds).size === approach.movementEdgeIds.length, `пустые/повторные направления подхода ${approach.id}`);
        requireValue(Array.isArray(group.controlledEdgeIds) &&
            group.controlledEdgeIds.length === approach.movementEdgeIds.length &&
            group.controlledEdgeIds.every(id => approach.movementEdgeIds.includes(id)), `группа не совпадает с подходом ${approach.id}`);
        for (const id of approach.movementEdgeIds) {
            const movement = edges.get(id);
            requireValue(movement?.mode === 'vehicle' &&
                movement.from === incoming.to &&
                movementOwners.get(id) === junction.id &&
                !approachOwners.has(id), `нет общего входа подхода ${approach.id}: ${id}`);
            approachOwners.set(id, approach.id);
        }
        requireValue(d.controls.some(c => c.edgeId === incoming.id &&
            c.signalGroupId === group.id &&
            c.stopLineId === approach.stopLineId), `нет стоп-линии подхода ${approach.id}`);
    }
    const groupEdges = new Set<string>();
    const ownedHeads = new Set<string>();
    for (const group of groups.values()) {
        const junction = junctions.get(group.junctionId);
        requireValue(junction &&
            Array.isArray(group.headIds) &&
            group.headIds.length > 0 &&
            group.headIds.every(id => heads.has(id)) &&
            new Set(group.headIds.map(id => heads.get(id)!.kind)).size === 1, `неверная группа ${group.id}`);
        requireValue(Array.isArray(group.controlledEdgeIds) &&
            group.controlledEdgeIds.length > 0 &&
            group.controlledEdgeIds.every(id => junction.movementEdgeIds.includes(id)), `неверные направления группы ${group.id}`);
        const pedestrian = heads.get(group.headIds[0])!.kind === 'pedestrian';
        requireValue(group.controlledEdgeIds.every(id => (edges.get(id)!.mode === 'pedestrian') === pedestrian), `группа управляет неверным типом движения ${group.id}`);
        for (const id of group.headIds) {
            requireValue(!ownedHeads.has(id), `голова в нескольких группах ${id}`);
            ownedHeads.add(id);
        }
        for (const id of group.controlledEdgeIds) {
            requireValue(!groupEdges.has(id), `двойная сигнальная группа ${id}`);
            groupEdges.add(id);
        }
        requireValue(!junction.conflicts.some(pair => pair.every(id => group.controlledEdgeIds.includes(id)) &&
            !(approachOwners.has(pair[0]) &&
                approachOwners.get(pair[0]) === approachOwners.get(pair[1]))), `конфликтующие направления зелёной группы ${group.id}`);
    }
    for (const junction of junctions.values()) {
        requireValue(junction.movementEdgeIds.every(id => groupEdges.has(id)), `направление без сигнала ${junction.id}`);
    }
    for (const head of heads.values()) {
        requireValue(ownedHeads.has(head.id), `голова без группы ${head.id}`);
    }
    for (const control of controls.values()) {
        requireValue(control.kind === 'signal' &&
            edges.has(control.edgeId) &&
            Number.isFinite(control.distanceAlongMetres) &&
            control.distanceAlongMetres >= 0 &&
            control.distanceAlongMetres <= paths.get(control.edgeId)!.length &&
            groups.has(control.signalGroupId) &&
            (!control.stopLineId ||
                lines.has(control.stopLineId)), `неверный signal control ${control.id}`);
    }
    for (const group of groups.values()) {
        for (const id of group.controlledEdgeIds) {
            const movement = edges.get(id)!;
            requireValue(d.controls.some(c => c.signalGroupId === group.id &&
                (c.edgeId === id ||
                    edges.get(c.edgeId)!.to === movement.from)), `нет управляющей точки перед ${id}`);
        }
    }
    for (const asset of assets.values()) {
        requireValue(['vehicle', 'pedestrian', 'cycle'].includes(asset.mode) &&
            Object.hasOwn(axes, asset.forwardAxis) &&
            Object.hasOwn(axes, asset.upAxis) &&
            Array.isArray(asset.basisRotation) &&
            asset.basisRotation.length === 4 &&
            asset.basisRotation.every(Number.isFinite) &&
            Math.abs(asset.basisRotation.reduce((s, v) => s +
                v * v, 0) - 1) < .001, `неверный базис ${asset.id}`);
        requireValue(distance(rotate(axes[asset.forwardAxis], asset.basisRotation), [0, 0, -1]) < .01 &&
            distance(rotate(axes[asset.upAxis], asset.basisRotation), [0, 1, 0]) < .01, `базис не приведён к -Z/+Y ${asset.id}`);
        const f = asset.footprint;
        requireValue(f &&
            [f.halfLengthMetres, f.halfWidthMetres, f.heightMetres].every(n => Number.isFinite(n) &&
                n > 0) &&
            vector(f.centerOffset), `неверный размер ${asset.id}`);
        requireValue(Boolean(asset.nodeId) !== Boolean(asset.externalAsset), `нужен один источник модели ${asset.id}`);
        if (asset.nodeId) {
            requireValue(roles.get(asset.nodeId) === asset.mode, `не найден asset node ${asset.id}`);
        }
        if (asset.externalAsset) {
            requireValue(asset.mode === 'pedestrian' &&
                asset.externalAsset.profile === 'city-people-rig-v1' &&
                typeof asset.externalAsset.url === 'string' &&
                /^[a-f0-9]{64}$/i.test(asset.externalAsset.sha256) &&
                typeof asset.externalAsset.variantId === 'string' &&
                asset.externalAsset.variantId.length > 0, `неподдержанный внешний asset ${asset.id}`);
        }
    }
    const carriers = new Set<string>();
    for (const spawn of spawns.values()) {
        const asset = assets.get(spawn.assetId);
        const edge = edges.get(spawn.edgeId);
        requireValue(asset &&
            edge &&
            asset.mode === edge.mode &&
            roles.get(spawn.nodeId) === asset.mode &&
            !carriers.has(spawn.nodeId) &&
            Number.isFinite(spawn.distanceAlongMetres) &&
            spawn.distanceAlongMetres >= 0 &&
            spawn.distanceAlongMetres < paths.get(edge.id)!.length, `неверный spawn ${spawn.id}`);
        requireValue(asset.footprint.halfWidthMetres * 2 <= edge.widthMetres, `модель шире пути ${spawn.id}`);
        carriers.add(spawn.nodeId);
    }
    return d;
}


function footprint(actor: ActorState, position = actor.position, forward = actor.forward): ActorFootprint {
    const f = actor.asset.footprint;
    const c = f.centerOffset;
    const right: Vec3 = [-forward[2], 0, forward[0]];
    return {
        center: [position[0] +
            right[0] * c[0] - forward[0] * c[2], position[1] +
        c[1], position[2] +
        right[2] * c[0] - forward[2] * c[2]], right, forward
    };
}
// Проверка ориентированных прямоугольников: ищем ось, разделяющую два габарита.
export function actorsOverlap(a: ActorState, b: ActorState, position = a.position, forward = a.forward): boolean {
    const aa = footprint(a, position, forward);
    const bb = footprint(b);
    const af = a.asset.footprint;
    const bf = b.asset.footprint;
    if (Math.abs(aa.center[1] - bb.center[1]) >= (af.heightMetres + bf.heightMetres) / 2) {
        return false;
    }
    const dx = aa.center[0] - bb.center[0];
    const dz = aa.center[2] - bb.center[2];
    const padA = a.asset.mode === 'pedestrian' ? .04 : .12;
    const padB = b.asset.mode === 'pedestrian' ? .04 : .12;
    for (const axis of [aa.right, aa.forward, bb.right, bb.forward]) {
        const dot = (v: Vec3): number => Math.abs(v[0] * axis[0] + v[2] * axis[2]);
        const extent = (af.halfWidthMetres +
            padA) * dot(aa.right) +
            (af.halfLengthMetres +
                padA) * dot(aa.forward) +
            (bf.halfWidthMetres +
                padB) * dot(bb.right) +
            (bf.halfLengthMetres +
                padB) * dot(bb.forward);
        if (Math.abs(dx * axis[0] + dz * axis[2]) >= extent) {
            return false;
        }
    }
    return true;
}
export class MobilitySimulation {
    readonly paths = new Map<string, EdgePath>();
    readonly actors: ActorState[] = [];
    private clocks = new Map<string, SignalClock>();
    private signalTimings = new Map<string, SignalTimings>();
    private groupKind = new Map<string, 'vehicle' | 'pedestrian'>();
    private movements = new Map<string, string>();
    private outgoing = new Map<string, string[]>();
    private approachByMovement = new Map<string, Approach>();
    private approachExits = new Map<string, Map<string, number>>();
    private crossingExits = new Map<string, { direction: Vec3; laneExit: number }>();
    constructor(readonly data: MobilityData, timings: SignalTimingOverrides = {}) {
        for (const edge of data.edges) {
            this.paths.set(edge.id, new EdgePath(edge));
            const key = edge.from + ':' + edge.mode;
            this.outgoing.set(key, [...(this.outgoing.get(key) || []), edge.id]);
        }
        for (const approach of data.approaches || []) {
            this.approachExits.set(approach.id, new Map());
            for (const id of approach.movementEdgeIds) {
                this.approachByMovement.set(id, approach);
            }
        }
        for (const junction of data.junctions) {
            junction.movementEdgeIds.forEach(id => this.movements.set(id, junction.id));
            const groups = data.signalGroups.filter(g => g.junctionId === junction.id);
            for (const group of groups) {
                this.groupKind.set(group.id, data.signalHeads.find(h => h.id === group.headIds[0])!.kind);
            }
            const order = new Map((data.approaches || []).filter(a => a.junctionId === junction.id).map((a, i) => [a.signalGroupId, i]));
            groups.sort((a, b) => (this.groupKind.get(a.id) === 'vehicle' ? 0 : 1) - (this.groupKind.get(b.id) === 'vehicle' ? 0 : 1) ||
                ((order.get(a.id) ?? 999) - (order.get(b.id) ?? 999)) ||
                a.id.localeCompare(b.id));
            this.clocks.set(junction.id, {
                groups: groups.map(g => g.id), index: 0, stage: 'green', elapsed: 0
            });
            this.setSignalTimings(junction.id, timings[junction.id] ?? {});
        }
        this.prepareCrossingExits();
        for (const spawn of data.actorSpawns) {
            const asset = data.actorAssets.find(asset => asset.id === spawn.assetId)!;
            const pose = this.paths.get(spawn.edgeId)!.sample(spawn.distanceAlongMetres);
            const actor: ActorState = {
                id: spawn.id, nodeId: spawn.nodeId, asset, edgeId: spawn.edgeId, distance: spawn.distanceAlongMetres, travelled: 0, speed: 0, active: true, desiredActive: true, ...pose, plan: [], choices: 0, exits: new Map()
            };
            Object.assign(actor, actorPose(actor, this.paths.get(spawn.edgeId)!, spawn.distanceAlongMetres));
            this.fillPlan(actor);
            this.actors.push(actor);
        }
        requireValue(!this.collisionPairs().length, 'пересекающиеся стартовые позиции');
    }
    aspect(groupId: string): Aspect {
        const group = this.data.signalGroups.find(group => group.id === groupId);
        if (!group) {
            return 'red';
        }
        const clock = this.clocks.get(group.junctionId)!;
        return clock.groups[clock.index] === groupId &&
            clock.stage === 'green' ? 'green' : clock.groups[clock.index] === groupId &&
                clock.stage === 'amber' ? 'amber' : 'red';
    }
    setEnabled(id: string, enabled: boolean): void {
        const actor = this.actors.find(actor => actor.id === id);
        if (actor) {
            actor.desiredActive = enabled;
            if (!enabled) {
                actor.active = false;
                actor.speed = 0;
            }
        }
    }
    private fillPlan(actor: ActorState): void {
        let id = actor.plan.at(-1) || actor.edgeId;
        let length = actor.plan.reduce((sum, id) => sum + this.paths.get(id)!.length, 0);
        while (length < 30 && actor.plan.length < 64) {
            const edge = this.paths.get(id)!.data;
            const choices = this.outgoing.get(edge.to + ':' + actor.asset.mode) || [];
            if (!choices.length) {
                return;
            }
            let hash = 0;
            for (const c of actor.id) {
                hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
            }
            id = choices[(hash + (choices.length > 1 ? actor.choices++ : 0)) % choices.length];
            actor.plan.push(id);
            length += this.paths.get(id)!.length;
        }
    }
    /** Частичное обновление применяется со следующего шага, не обнуляя текущую фазу. */
    setSignalTimings(junctionId: string, changes: Partial<SignalTimings>): void {
        requireValue(this.clocks.has(junctionId), `неизвестный перекрёсток ${junctionId}`);
        const current = this.signalTimings.get(junctionId) ?? DEFAULT_SIGNAL_TIMINGS;
        const next = { ...current, ...changes };
        for (const [name, seconds] of Object.entries(next)) {
            requireValue(Number.isFinite(seconds) && seconds > 0,
                `${junctionId}: время ${name} должно быть положительным числом секунд`);
        }
        this.signalTimings.set(junctionId, next);
    }

    private startSignalStage(clock: SignalClock, stage: SignalClock['stage']): void {
        clock.stage = stage;
        clock.elapsed = 0;
    }

    private updateSignals(dt: number): void {
        for (const [junctionId, clock] of this.clocks) {
            clock.elapsed += dt;
            const timing = this.signalTimings.get(junctionId)!;
            const groupId = clock.groups[clock.index];
            const kind = this.groupKind.get(groupId);

            switch (clock.stage) {
                case 'green': {
                    const greenDuration = kind === 'pedestrian'
                        ? timing.pedestrianGreen
                        : timing.vehicleGreen;
                    if (clock.elapsed < greenDuration) break;

                    // Пешеходный зелёный заканчивается без жёлтой фазы.
                    const nextStage = kind === 'vehicle' ? 'amber' : 'clearance';
                    this.startSignalStage(clock, nextStage);
                    break;
                }
                case 'amber': {
                    if (clock.elapsed < timing.amber) break;
                    this.startSignalStage(clock, 'clearance');
                    break;
                }
                case 'clearance': {
                    if (clock.elapsed < timing.clearance) break;
                    // Следующая фаза начинается по таймеру, независимо от участников.

                    clock.index = (clock.index + 1) % clock.groups.length;
                    this.startSignalStage(clock, 'green');
                    break;
                }
            }
        }
    }
    /** Границу каждой автомобильной полосы считаем один раз при загрузке сети. */
    private prepareCrossingExits(): void {
        for (const group of this.data.signalGroups) {
            const junction = this.data.junctions.find(junction => junction.id === group.junctionId)!;
            const vehiclePaths = group.controlledEdgeIds
                .map(id => this.paths.get(id)!)
                .filter(path => path.data.mode === 'vehicle');
            if (!vehiclePaths.length) continue;

            const crosswalkIds = new Set<string>();
            for (const [first, second] of junction.conflicts) {
                if (group.controlledEdgeIds.includes(first)) crosswalkIds.add(second);
                if (group.controlledEdgeIds.includes(second)) crosswalkIds.add(first);
            }
            for (const id of crosswalkIds) {
                const path = this.paths.get(id)!;
                if (path.data.kind !== 'crosswalk') continue;
                const start = path.data.points[0];
                const end = path.data.points[path.data.points.length - 1];
                const length = Math.hypot(end[0] - start[0], end[2] - start[2]);
                const direction: Vec3 = [(end[0] - start[0]) / length, 0, (end[2] - start[2]) / length];
                for (const vehiclePath of vehiclePaths) {
                    let laneExit = -Infinity;
                    for (const point of vehiclePath.data.points) {
                        const projection = point[0] * direction[0] + point[2] * direction[2];
                        laneExit = Math.max(laneExit, projection + vehiclePath.data.widthMetres / 2);
                    }
                    this.crossingExits.set(vehiclePath.data.id + ':' + id, { direction, laneExit });
                }
            }
        }
    }

    /** Участник уже на конфликтующем маршруте имеет время освободить его, даже после смены фазы. */
    private findCrossingBlocker(actor: ActorState, signalGroupId: string): ActorState | undefined {
        const group = this.data.signalGroups.find(group => group.id === signalGroupId);
        const junction = this.data.junctions.find(junction => junction.id === group?.junctionId);
        if (!group || !junction) return undefined;
        const movementEdgeId = [actor.edgeId, ...actor.plan]
            .find(id => group.controlledEdgeIds.includes(id));

        const conflictingEdges = new Set<string>();
        for (const [first, second] of junction.conflicts) {
            if (group.controlledEdgeIds.includes(first)) conflictingEdges.add(second);
            if (group.controlledEdgeIds.includes(second)) conflictingEdges.add(first);
        }

        return this.actors.find(other => {
            if (other === actor || !other.active) return false;
            if (actor.asset.mode === 'vehicle' && other.asset.mode === 'pedestrian') {
                const exit = this.crossingExits.get(movementEdgeId + ':' + other.edgeId);
                // На тротуаре ждать завершения всего маршрута и дополнительного таймера уже не нужно.
                if (!exit) return false;
                const shape = footprint(other);
                const size = other.asset.footprint;
                const project = (vector: Vec3): number => vector[0] * exit.direction[0] + vector[2] * exit.direction[2];
                const bodyExtent = size.halfLengthMetres * Math.abs(project(shape.forward))
                    + size.halfWidthMetres * Math.abs(project(shape.right));
                const rearPosition = project(shape.center) - bodyExtent;
                const safetyMargin = 0.1;
                return rearPosition <= exit.laneExit + safetyMargin;
            }
            if (conflictingEdges.has(other.edgeId)) return true;

            // После выхода с маршрута задняя часть ещё может оставаться на переходе.
            const exitDistance = other.exits.get(junction.id);
            if (exitDistance === undefined || other.asset.mode === actor.asset.mode) return false;
            const size = other.asset.footprint;
            const rearClearance = size.halfLengthMetres + Math.abs(size.centerOffset[2]) + 0.5;
            return other.travelled - exitDistance < rearClearance;
        });
    }

    /** @returns Расстояние, на котором можно продолжить движение. */
    private barrier(actor: ActorState, trace?: BarrierLimit[]): number {
        const actorSize = actor.asset.footprint;
        const frontOverhang = actorSize.halfLengthMetres - actorSize.centerOffset[2];
        const actorIsPedestrian = actor.asset.mode === 'pedestrian';
        const route = [actor.edgeId, ...actor.plan];
        const lookAheadDistance = 30;
        let allowedDistance = Infinity;
        let nearestQueueActorId: string | undefined;
        const addLimit = (maxDistance: number, reason: BarrierReason, sourceId: string): void => {
            const permittedDistance = Math.max(0, maxDistance);
            const isQueueLimit = reason === 'queue' || reason === 'nearby-queue';
            if (isQueueLimit && permittedDistance <= allowedDistance) {
                nearestQueueActorId = sourceId;
            }
            allowedDistance = Math.min(allowedDistance, permittedDistance);
            trace?.push({ distance: permittedDistance, reason, sourceId });
        };
        // 1. Очередь: учитываем только участников впереди на нашем направленном маршруте.
        const actorFootprint = footprint(actor);
        for (const other of this.actors) {
            if (other === actor || !other.active) {
                continue;
            }
            const otherIsPedestrian = other.asset.mode === 'pedestrian';
            if (otherIsPedestrian !== actorIsPedestrian) {
                continue;
            }
            let edgeStartDistance = -actor.distance;
            let otherIsAheadOnRoute = false;
            for (const edgeId of route) {
                const distanceToOther = edgeStartDistance + other.distance;
                const otherIsOnThisEdge = edgeId === other.edgeId;
                if (otherIsOnThisEdge && distanceToOther > 0) {
                    otherIsAheadOnRoute = true;
                    const actorIsTurning = this.paths.get(actor.edgeId)!.data.kind === 'turn';
                    const otherIsTurning = this.paths.get(edgeId)!.data.kind === 'turn';
                    const followingGap = actorIsPedestrian ? 0.5 : actorIsTurning || otherIsTurning ? 2 : 0.8;
                    const otherSize = other.asset.footprint;
                    const occupiedLength = actorSize.halfLengthMetres + otherSize.halfLengthMetres
                        + Math.abs(actorSize.centerOffset[2]) + Math.abs(otherSize.centerOffset[2]);
                    addLimit(distanceToOther - occupiedLength - followingGap, 'queue', other.id);
                    break;
                }
                edgeStartDistance += this.paths.get(edgeId)!.length;
                if (edgeStartDistance > lookAheadDistance) {
                    break;
                }
            }
            // Пространственная поправка к очереди нужна на изгибах маршрута.
            // Соседняя независимая полоса не должна создавать нам очередь.
            if (!otherIsAheadOnRoute) {
                continue;
            }
            const headingAlignment = actor.forward[0] * other.forward[0] + actor.forward[2] * other.forward[2];
            const facingSameDirection = headingAlignment >= 0.7;
            if (!facingSameDirection) {
                continue;
            }
            const otherFootprint = footprint(other);
            const otherSize = other.asset.footprint;
            const verticalSeparation = Math.abs(actorFootprint.center[1] - otherFootprint.center[1]);
            const combinedHalfHeight = (actorSize.heightMetres + otherSize.heightMetres) / 2;
            if (verticalSeparation > combinedHalfHeight) {
                continue;
            }
            const deltaX = otherFootprint.center[0] - actorFootprint.center[0];
            const deltaZ = otherFootprint.center[2] - actorFootprint.center[2];
            const distanceAhead = deltaX * actor.forward[0] + deltaZ * actor.forward[2];
            const lateralDistance = Math.abs(deltaX * actorFootprint.right[0] + deltaZ * actorFootprint.right[2]);
            const lateralEnvelope = actorSize.halfWidthMetres + otherSize.halfWidthMetres + 0.1;
            const followingGap = actorIsPedestrian ? 0.5 : 0.8;
            if (distanceAhead > 0 && lateralDistance < lateralEnvelope) {
                const occupiedLength = actorSize.halfLengthMetres + otherSize.halfLengthMetres;
                addLimit(distanceAhead - occupiedLength - followingGap, 'nearby-queue', other.id);
            }
        }
        // Место в очереди считаем отдельно от светофоров и запретов на въезд.
        const distanceAvailableBeforeQueue = allowedDistance;
        const queueLeader = this.actors.find(other => other.id === nearestQueueActorId);
        const waitingQueueSpeed = 0.5;
        const queueIsWaiting = queueLeader !== undefined && queueLeader.speed < waitingQueueSpeed;
        // 2. Проверяем проезды, повороты и стоп-линии в порядке следования по маршруту.
        let edgeStartDistance = -actor.distance;
        const currentApproach = this.approachByMovement.get(actor.edgeId);
        for (const edgeId of route) {
            const edge = this.paths.get(edgeId)!.data;
            const approach = this.approachByMovement.get(edgeId);
            const enteringApproach = approach && currentApproach?.id !== approach.id && edgeStartDistance >= 0;
            if (enteringApproach) {
                const exits = this.approachExits.get(approach.id)!;
                const approachIsOccupied = this.actors.some(other => {
                    if (other === actor || !other.active) {
                        return false;
                    }
                    if (this.approachByMovement.get(other.edgeId)?.id === approach.id) {
                        return true;
                    }
                    const exitDistance = exits.get(other.id);
                    if (exitDistance === undefined) {
                        return false;
                    }
                    const otherSize = other.asset.footprint;
                    const distanceSinceExit = other.travelled - exitDistance;
                    const rearClearance = otherSize.halfLengthMetres + Math.abs(otherSize.centerOffset[2]) + 0.5;
                    return distanceSinceExit < rearClearance;
                });
                if (approachIsOccupied) {
                    addLimit(edgeStartDistance - frontOverhang - 0.3, 'approach-occupied', approach.id);
                }
            }
            for (const control of this.data.controls) {
                if (control.edgeId !== edgeId) {
                    continue;
                }
                const distanceToStopLine = edgeStartDistance + control.distanceAlongMetres - frontOverhang;
                const distanceBeforeStopLine = distanceToStopLine - 0.2;
                const signal = this.aspect(control.signalGroupId);
                const frontPassedStopLine = distanceToStopLine < -0.001;
                if (frontPassedStopLine) {
                    continue;
                }
                const crossingBlocker = this.findCrossingBlocker(actor, control.signalGroupId);
                if (crossingBlocker) {
                    addLimit(distanceBeforeStopLine, 'approach-occupied', crossingBlocker.id);
                }
                if (signal === 'green') {
                    continue;
                }
                const brakingDistance = actor.speed * actor.speed / 8;
                const cannotStopForAmber = signal === 'amber' && actor.speed > 0.5
                    && distanceBeforeStopLine < brakingDistance + 0.25;
                if (cannotStopForAmber) {
                    continue;
                }
                addLimit(distanceBeforeStopLine, `signal-${signal}`, control.id);
            }
            edgeStartDistance += this.paths.get(edgeId)!.length;
            if (edgeStartDistance > lookAheadDistance) {
                break;
            }
        }
        // 3. Не въезжаем в перекрёсток, если после него нельзя разместить весь кузов.
        if (actor.asset.mode === 'vehicle') {
            const stopLineDistances = new Map<string, number>();
            let movementStartDistance = -actor.distance;
            for (const edgeId of route) {
                const path = this.paths.get(edgeId)!;
                for (const control of this.data.controls) {
                    if (control.edgeId !== edgeId) continue;
                    const group = this.data.signalGroups.find(group => group.id === control.signalGroupId);
                    if (group) {
                        stopLineDistances.set(group.junctionId, movementStartDistance + control.distanceAlongMetres);
                    }
                }
                const enteringJunction = edgeId !== actor.edgeId && this.movements.has(edgeId)
                    && movementStartDistance >= 0;
                if (enteringJunction) {
                    const rearClearance = actorSize.halfLengthMetres + Math.abs(actorSize.centerOffset[2]) + 0.5;
                    const distanceToClearJunction = movementStartDistance + path.length + rearClearance;
                    if (queueIsWaiting && distanceAvailableBeforeQueue < distanceToClearJunction) {
                        const junctionId = this.movements.get(edgeId)!;
                        const stopLineDistance = stopLineDistances.get(junctionId);
                        const entryDistance = stopLineDistance ?? movementStartDistance;
                        const distanceBeforeEntry = entryDistance - frontOverhang;
                        // Уже пересёк линию передней частью — освобождаем переход, а не останавливаемся на нём.
                        if (distanceBeforeEntry >= -0.001) {
                            const stopMargin = stopLineDistance === undefined ? 0.3 : 0.2;
                            addLimit(distanceBeforeEntry - stopMargin, 'exit-blocked', edgeId);
                        }
                    }
                }
                movementStartDistance += path.length;
                if (movementStartDistance > lookAheadDistance) {
                    break;
                }
            }
        }

        const negligibleDistance = 1e-7;
        return allowedDistance < negligibleDistance ? 0 : allowedDistance;
    }

    debugSnapshot() {
        return {
            signals: this.data.signalGroups.map(g => ({
                id: g.id, aspect: this.aspect(g.id)
            })), clocks: [...this.clocks],
            actors: this.actors.map(actor => {
                const limits: BarrierLimit[] = [];
                const barrier = this.barrier(actor, limits);
                if (actor.collisionBlockerId) {
                    limits.push({ distance: 0, reason: 'collision-risk', sourceId: actor.collisionBlockerId });
                }
                return {
                    id: actor.id, assetId: actor.asset.id, edgeId: actor.edgeId, distance: actor.distance, travelled: actor.travelled, speed: actor.speed,
                    active: actor.active, desiredActive: actor.desiredActive, position: actor.position, forward: actor.forward, plan: actor.plan, choices: actor.choices,
                    exits: [...actor.exits], barrier: Number.isFinite(barrier) ? barrier : null, limits: limits.sort((a, b) => a.distance - b.distance)
                };
            })
        };
    }
    private advance(actor: ActorState, amount: number): void {
        let edgeId = actor.edgeId;
        let at = actor.distance + amount;
        let consumed = 0;
        const transitions: RouteTransition[] = [];
        while (at >= this.paths.get(edgeId)!.length) {
            const next = actor.plan[consumed];
            if (!next) {
                at = this.paths.get(edgeId)!.length;
                break;
            }
            at -= this.paths.get(edgeId)!.length;
            transitions.push({
                from: edgeId, to: next, offset: amount - at
            });
            edgeId = next;
            consumed++;
        }
        const pose = actorPose(actor, this.paths.get(edgeId)!, at);
        const blocker = this.actors.find(other => other !== actor && other.active
            && actorsOverlap(actor, other, pose.position, pose.forward));
        if (blocker) {
            actor.collisionBlockerId = blocker.id;
            actor.speed = 0;
            return;
        }
        for (const transition of transitions) {
            const junction = this.movements.get(transition.from);
            if (junction && this.movements.get(transition.to) !== junction) {
                actor.exits.set(junction, actor.travelled + transition.offset);
            }
            const approach = this.approachByMovement.get(transition.from);
            if (approach && this.approachByMovement.get(transition.to)?.id !== approach.id) {
                this.approachExits.get(approach.id)!.set(actor.id, actor.travelled + transition.offset);
            }
        }
        actor.edgeId = edgeId;
        actor.distance = at;
        actor.position = pose.position;
        actor.forward = pose.forward;
        actor.travelled += amount;
        actor.plan.splice(0, consumed);
        this.fillPlan(actor);
    }
    private activate(actor: ActorState): void {
        const f = actor.asset.footprint;
        const front = f.halfLengthMetres - f.centerOffset[2];
        const route = [actor.edgeId, ...actor.plan];
        let searched = route.reduce((n, id) => n + this.paths.get(id)!.length, 0);
        while (searched < 100 && route.length < 64) {
            const edge = this.paths.get(route.at(-1)!)!.data;
            const next = this.outgoing.get(edge.to + ':' + actor.asset.mode)?.[0];
            if (!next) {
                break;
            }
            route.push(next);
            searched += this.paths.get(next)!.length;
        }
        for (let i = 0;i < route.length;i++) {
            const path = this.paths.get(route[i])!;
            if (path.data.kind === 'turn' || this.movements.has(route[i])) {
                continue;
            }
            const rear = f.halfLengthMetres + Math.abs(f.centerOffset[2]) + .5;
            const starts = i === 0 ? [Math.max(rear, actor.distance), rear] : [rear];
            for (const start of starts) {
                for (let at = start;at < path.length - front - 3;at += 2 * f.halfLengthMetres + 1) {
                    if (this.data.controls.some(c => c.edgeId === route[i] && at + front + .2 > c.distanceAlongMetres)) {
                        continue;
                    }
                    const pose = path.sample(at);
                    if (this.actors.some(other => other !== actor &&
                        other.active &&
                        actorsOverlap(actor, other, pose.position, pose.forward))) {
                        continue;
                    }
                    actor.edgeId = route[i];
                    actor.distance = at;
                    actor.position = pose.position;
                    actor.forward = pose.forward;
                    actor.speed = 0;
                    actor.plan = route.slice(i + 1);
                    actor.exits.clear();
                    for (const exits of this.approachExits.values()) {
                        exits.delete(actor.id);
                    }
                    this.fillPlan(actor);
                    actor.active = true;
                    return;
                }
            }
        }
    }
    // Длинный кадр разбиваем на шаги не более 25 мс, чтобы не перескакивать препятствия.
    update(seconds: number): void {
        if (!Number.isFinite(seconds) || seconds <= 0) {
            return;
        }
        const duration = Math.min(seconds, .25);
        const steps = Math.ceil(duration / .025);
        const dt = duration / steps;
        for (let i = 0;i < steps;i++) {
            this.updateSignals(dt);
            for (const actor of this.actors) {
                actor.collisionBlockerId = undefined;
                if (!actor.desiredActive) {
                    continue;
                }
                if (!actor.active) {
                    this.activate(actor);
                    if (!actor.active) {
                        continue;
                    }
                }
                const barrier = this.barrier(actor);
                const maxSpeed = actor.asset.mode === 'pedestrian' ? 1.1 : 4;
                const brake = 4;
                // v² = 2as: скорость, с которой ещё можно остановиться перед ограничением.
                const target = Math.min(maxSpeed, Math.sqrt(2 * brake * barrier));
                actor.speed = target < actor.speed ? Math.max(target, actor.speed - brake * dt) : Math.min(target, actor.speed + 2 * dt);
                this.advance(actor, Math.min(actor.speed * dt, barrier));
            }
        }
    }
    collisionPairs(): string[][] {
        const pairs: string[][] = [];
        for (let i = 0;i < this.actors.length;i++) {
            for (let j = i + 1;j < this.actors.length;j++) {
                if (this.actors[i].active && this.actors[j].active && actorsOverlap(this.actors[i], this.actors[j])) {
                    pairs.push([this.actors[i].id, this.actors[j].id]);
                }
            }
        }
        return pairs;
    }
}
