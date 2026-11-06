import { Quaternion, Vector3 } from 'three';

export type RouteSample = { position: number[]; quaternion: number[]; distance: number };
export type RouteData = { id: string; length: number; samples: RouteSample[] };
export type StreetNetworkData = {
    source_sha256: string;
    vehicleRoutes: RouteData[];
    pedestrianRoutes: RouteData[];
    junctions?: { id: string; position: number[]; radius: number }[];
};

class Pose {
    position = new Vector3();
    quaternion = new Quaternion();
    forwardX = 0;
    forwardZ = -1;
    rightX = 1;
    rightZ = 0;
    updateAxes(): void {
        const { x, y, z, w } = this.quaternion;
        this.forwardX = -2 * (x * z + w * y);
        this.forwardZ = -(1 - 2 * (x * x + y * y));
        const length = Math.hypot(this.forwardX, this.forwardZ) || 1;
        this.forwardX /= length;
        this.forwardZ /= length;
        this.rightX = -this.forwardZ;
        this.rightZ = this.forwardX;
    }
    copy(other: Pose): void {
        this.position.copy(other.position);
        this.quaternion.copy(other.quaternion);
        this.forwardX = other.forwardX; this.forwardZ = other.forwardZ;
        this.rightX = other.rightX; this.rightZ = other.rightZ;
    }
}

export class ClosedStreetRoute {
    readonly id: string;
    readonly length: number;
    private samples: { position: Vector3; quaternion: Quaternion; distance: number }[];
    constructor(data: RouteData) {
        if (!data.id || !Number.isFinite(data.length) || data.length <= 1 || data.samples.length < 3) {
            throw new Error('Неполный замкнутый маршрут');
        }
        this.id = data.id;
        this.length = data.length;
        this.samples = data.samples.map((sample, index) => {
            if (sample.position.length !== 3 || sample.quaternion.length !== 4 ||
                ![...sample.position, ...sample.quaternion, sample.distance].every(Number.isFinite) ||
                Math.abs(sample.quaternion.reduce((sum, value) => sum + value * value, 0) - 1) > 0.01 ||
                (index > 0 && sample.distance <= data.samples[index - 1].distance)) {
                throw new Error(`Некорректный отсчёт ${data.id}:${index}`);
            }
            return { position: new Vector3().fromArray(sample.position),
                quaternion: new Quaternion().fromArray(sample.quaternion).normalize(), distance: sample.distance };
        });
        const first = this.samples[0], last = this.samples[this.samples.length - 1];
        if (Math.abs(first.distance) > 0.001 || Math.abs(last.distance - this.length) > 0.01 ||
            first.position.distanceTo(last.position) > 0.01 || first.quaternion.angleTo(last.quaternion) > 0.03) {
            throw new Error(`Маршрут ${this.id} не замкнут без скачка`);
        }
    }
    sample(distance: number, result: Pose): void {
        const at = ((distance % this.length) + this.length) % this.length;
        let lo = 0, hi = this.samples.length - 1;
        while (hi - lo > 1) {
            const middle = (lo + hi) >> 1;
            if (this.samples[middle].distance <= at) lo = middle; else hi = middle;
        }
        const a = this.samples[lo], b = this.samples[hi];
        const t = (at - a.distance) / (b.distance - a.distance);
        result.position.lerpVectors(a.position, b.position, t);
        result.quaternion.slerpQuaternions(a.quaternion, b.quaternion, t);
        result.updateAxes();
    }
    inspect(distance: number): { position: Vector3; quaternion: Quaternion } {
        const pose = new Pose();
        this.sample(distance, pose);
        return { position: pose.position, quaternion: pose.quaternion };
    }
}

export type ActorOptions = {
    id: string; kind: 'vehicle' | 'pedestrian'; speed: number;
    halfWidth: number; halfLength: number; height: number;
    ordinal: number; total: number; enabled?: boolean;
};

export class StreetActor extends Pose {
    readonly candidate = new Pose();
    travelled = 0;
    distance = 0;
    enabled: boolean;
    constructor(readonly route: ClosedStreetRoute, readonly options: ActorOptions) {
        super();
        this.enabled = options.enabled !== false;
    }
}

function separatedOnAxis(a: Pose, aw: number, al: number, b: Pose, bw: number, bl: number, x: number, z: number): boolean {
    const separation = Math.abs((a.position.x - b.position.x) * x + (a.position.z - b.position.z) * z);
    const extentA = aw * Math.abs(a.rightX * x + a.rightZ * z) + al * Math.abs(a.forwardX * x + a.forwardZ * z);
    const extentB = bw * Math.abs(b.rightX * x + b.rightZ * z) + bl * Math.abs(b.forwardX * x + b.forwardZ * z);
    return separation >= extentA + extentB;
}

function overlaps(a: Pose, specA: ActorOptions, b: Pose, specB: ActorOptions): boolean {
    // Дороги на разных уровнях моста не блокируют друг друга.
    if (Math.abs(a.position.y - b.position.y) > Math.max(specA.height, specB.height)) return false;
    const aw = specA.halfWidth + 0.12, al = specA.halfLength + 0.25;
    const bw = specB.halfWidth + 0.12, bl = specB.halfLength + 0.25;
    if (Math.abs(a.position.x - b.position.x) > al + aw + bl + bw ||
        Math.abs(a.position.z - b.position.z) > al + aw + bl + bw) return false;
    return !separatedOnAxis(a, aw, al, b, bw, bl, a.rightX, a.rightZ) &&
        !separatedOnAxis(a, aw, al, b, bw, bl, a.forwardX, a.forwardZ) &&
        !separatedOnAxis(a, aw, al, b, bw, bl, b.rightX, b.rightZ) &&
        !separatedOnAxis(a, aw, al, b, bw, bl, b.forwardX, b.forwardZ);
}

export class StreetSimulation {
    readonly actors: StreetActor[] = [];
    readonly vehicleRoutes: ClosedStreetRoute[];
    readonly pedestrianRoutes: ClosedStreetRoute[];
    private junctions: { position: Vector3; radius: number; owner?: StreetActor; entered: boolean }[];
    constructor(data: StreetNetworkData) {
        this.vehicleRoutes = data.vehicleRoutes.map(route => new ClosedStreetRoute(route));
        this.pedestrianRoutes = data.pedestrianRoutes.map(route => new ClosedStreetRoute(route));
        if (!this.vehicleRoutes.length || !this.pedestrianRoutes.length) throw new Error('Нет дорожной или пешеходной сети');
        this.junctions = (data.junctions || []).map(junction => ({
            position: new Vector3().fromArray(junction.position), radius: junction.radius, entered: false
        }));
    }
    add(options: ActorOptions): StreetActor {
        const routes = options.kind === 'vehicle' ? this.vehicleRoutes : this.pedestrianRoutes;
        const route = routes[options.ordinal % routes.length];
        const groupSize = Math.ceil(options.total / routes.length);
        const rank = Math.floor(options.ordinal / routes.length);
        const actor = new StreetActor(route, options);
        actor.distance = route.length * (rank + 0.3) / groupSize;
        this.placeSafely(actor);
        this.actors.push(actor);
        return actor;
    }
    setEnabled(actor: StreetActor, enabled: boolean): void {
        if (actor.enabled === enabled) return;
        actor.enabled = enabled;
        if (enabled) this.placeSafely(actor);
        else this.junctions.forEach(junction => { if (junction.owner === actor) junction.owner = undefined; });
    }
    private placeSafely(actor: StreetActor): void {
        const start = actor.distance;
        for (let attempt = 0; attempt < 256; attempt++) {
            actor.distance = (start + actor.route.length * attempt / 256) % actor.route.length;
            actor.route.sample(actor.distance, actor);
            const inJunction = actor.options.kind === 'vehicle' && this.junctions.some(junction =>
                Math.abs(actor.position.y - junction.position.y) < 2 &&
                Math.hypot(actor.position.x - junction.position.x, actor.position.z - junction.position.z) < junction.radius + actor.options.halfLength + 1);
            const collision = this.actors.some(other => other !== actor && other.enabled && overlaps(actor, actor.options, other, other.options));
            if (!inJunction && !collision) return;
        }
        throw new Error(`Не найдено свободное стартовое место для ${actor.options.id}`);
    }
    update(seconds: number): void {
        if (!Number.isFinite(seconds) || seconds <= 0) return;
        // Мелкие шаги не позволяют проехать сквозь соседа после медленного кадра.
        const duration = Math.min(seconds, 4.5);
        const steps = Math.ceil(duration / 0.08);
        const dt = duration / steps;
        for (let step = 0; step < steps; step++) {
            this.junctions.forEach(junction => {
                const owner = junction.owner;
                if (!owner) return;
                const distance = Math.hypot(owner.position.x - junction.position.x, owner.position.z - junction.position.z);
                if (distance < junction.radius) junction.entered = true;
                if (!owner.enabled || (junction.entered && distance > junction.radius + owner.options.halfLength + 1)) {
                    junction.owner = undefined;
                    junction.entered = false;
                }
            });
            for (const actor of this.actors) {
                if (!actor.enabled) continue;
                const movement = actor.options.speed * dt;
                actor.route.sample(actor.distance + movement, actor.candidate);
                let blocked = false;
                if (actor.options.kind === 'vehicle') {
                    for (const junction of this.junctions) {
                        if (Math.abs(actor.candidate.position.y - junction.position.y) >= 2) continue;
                        const distance = Math.hypot(actor.candidate.position.x - junction.position.x, actor.candidate.position.z - junction.position.z);
                        if (distance >= junction.radius + actor.options.halfLength + 1) continue;
                        if (junction.owner && junction.owner !== actor) { blocked = true; break; }
                        if (!junction.owner) { junction.owner = actor; junction.entered = distance < junction.radius; }
                    }
                }
                if (!blocked) blocked = this.actors.some(other => other !== actor && other.enabled &&
                    overlaps(actor.candidate, actor.options, other, other.options));
                if (blocked) continue;
                actor.distance = (actor.distance + movement) % actor.route.length;
                actor.travelled += movement;
                actor.copy(actor.candidate);
            }
        }
    }
    collisionPairs(): string[][] {
        const result: string[][] = [];
        for (let i = 0; i < this.actors.length; i++) for (let j = i + 1; j < this.actors.length; j++) {
            const a = this.actors[i], b = this.actors[j];
            if (a.enabled && b.enabled && overlaps(a, a.options, b, b.options)) result.push([a.options.id, b.options.id]);
        }
        return result;
    }
}
