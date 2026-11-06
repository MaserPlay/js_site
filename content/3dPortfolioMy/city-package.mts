import type { MobilityData } from './mobility-types.js';
import { Object3D, Vector3 } from 'three';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { validateMobility } from './mobility.mjs';

export type Vec3 = [number, number, number];
export type Asset = { url: string; sha256: string };
export type CityManifest = {
    schemaVersion: 1; exportId: string;
    assets: { city: Asset; scene: Asset; mobility?: Asset };
    compatibility?: { sourceSha256: string; note: string };
};
export type CameraRoute = {
    id: string; pointId: string; arrivalNodeId: string; anchor: { focusZ: number; distance: number };
    points: Vec3[]; lookAt: Vec3; reversible: boolean;
    validation: { status: 'sampled-legacy' | 'blender-checked'; clearanceRadius: number };
};
export type ProjectPoint = {
    id: string; nodeId: string; buildingId: string; role: 'project-point'; behavior: 'enter-project'; routeId: string;
    pick: { min: Vec3; max: Vec3 };
    slots: { nodeId: string; role: 'media-slot' | 'comments-slot' }[];
    interiorLighting?: { positions: Vec3[]; distance: number };
};
export type CityDescription = {
    schemaVersion: 1; exportId: string; citySha256: string;
    coordinates: { units: 'metres'; up: '+Y'; forward: '-Z'; space: 'world' };
    bounds: { min: Vec3; max: Vec3 };
    objects: { id: string; role: string }[];
    projectPoints: ProjectPoint[];
    camera: { street: { focusStartZ: number; focusEndZ: number; minDistance: number;
        maxDistance: number; defaultDistance: number; pitch: number; targetHeight: number };
        routes: CameraRoute[] };
    materialBindings: { materialId: string; profile: 'standard' }[];
};

function requireValue(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(`Пакет города: ${message}`);
}
function vector(value: unknown): value is Vec3 {
    return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
}
function bounds(value: { min: Vec3; max: Vec3 }): boolean {
    return !!value && vector(value.min) && vector(value.max) && value.min.every((v, i) => v <= value.max[i]);
}
function unique<T extends { id: string }>(items: T[], label: string): Map<string, T> {
    requireValue(Array.isArray(items), `${label}: требуется массив`);
    const result = new Map<string, T>();
    for (const item of items) {
        requireValue(typeof item.id === 'string' && /^[a-z0-9][a-z0-9._:-]*$/i.test(item.id) && !result.has(item.id), `${label}: неверный или повторный ID`);
        result.set(item.id, item);
    }
    return result;
}

/** Validate before binding scene objects or registering interactions. */
export function validatePackage(manifest: CityManifest, data: CityDescription): void {
    requireValue(manifest.schemaVersion === 1 && data.schemaVersion === 1, 'неподдержанная версия контракта');
    requireValue(typeof manifest.exportId === 'string' && manifest.exportId.length > 0 && data.exportId === manifest.exportId, 'версии GLB/JSON различаются');
    for (const asset of [manifest.assets?.city, manifest.assets?.scene]) {
        requireValue(asset && typeof asset.url === 'string' && /^[a-f0-9]{64}$/i.test(asset.sha256), 'неверное описание ресурса');
    }
    requireValue(data.citySha256 === manifest.assets.city.sha256, 'JSON относится к другому GLB');
    const c = data.coordinates;
    requireValue(c?.units === 'metres' && c.up === '+Y' && c.forward === '-Z' && c.space === 'world', 'неверная система координат');
    requireValue(bounds(data.bounds), 'неверные границы города');
    const objects = unique(data.objects, 'объекты');
    requireValue(Array.isArray(data.materialBindings) && data.materialBindings.every(item =>
        typeof item.materialId === 'string' && item.profile === 'standard') &&
        new Set(data.materialBindings.map(item => item.materialId)).size === data.materialBindings.length, 'неверные ID/неподдержанный профиль материала');
    const routes = unique(data.camera?.routes, 'маршруты');
    const points = unique(data.projectPoints, 'точки');
    const street = data.camera?.street;
    requireValue(street && Object.values(street).every(Number.isFinite) && street.focusStartZ > street.focusEndZ &&
        street.minDistance > 0 && street.maxDistance >= street.minDistance && street.defaultDistance >= street.minDistance &&
        street.defaultDistance <= street.maxDistance && street.pitch > 0 && street.pitch < Math.PI / 2, 'неверные ограничения уличной камеры');
    for (const point of points.values()) {
        requireValue(point.role === 'project-point' && point.behavior === 'enter-project' && point.nodeId === point.id && objects.get(point.nodeId)?.role === 'project-point', `нет узла точки ${point.id}`);
        requireValue(objects.get(point.buildingId)?.role === 'building', `нет здания ${point.buildingId}`);
        requireValue(routes.get(point.routeId)?.pointId === point.id && bounds(point.pick), `нет маршрута/области выбора ${point.id}`);
        requireValue(Array.isArray(point.slots) && point.slots.every(slot => objects.get(slot.nodeId)?.role === slot.role), `неверные слоты ${point.id}`);
        if (point.interiorLighting) requireValue(point.interiorLighting.positions.length > 0 && point.interiorLighting.positions.every(vector) &&
            Number.isFinite(point.interiorLighting.distance) && point.interiorLighting.distance > 0, `неверный свет ${point.id}`);
    }
    for (const route of routes.values()) {
        requireValue(points.has(route.pointId) && objects.get(route.arrivalNodeId)?.role === 'camera-anchor' && route.reversible === true && route.points.length >= 2 && route.points.every(vector) && vector(route.lookAt), `неверный путь ${route.id}`);
        requireValue(Number.isFinite(route.anchor.focusZ) && route.anchor.focusZ >= street.focusEndZ && route.anchor.focusZ <= street.focusStartZ &&
            Number.isFinite(route.anchor.distance) && route.anchor.distance >= street.minDistance && route.anchor.distance <= street.maxDistance, `точка присоединения вне улицы ${route.id}`);
        const expected = streetPose(street, route.anchor.focusZ, route.anchor.distance);
        requireValue(expected.distanceTo(new Vector3().fromArray(route.points[0])) < 0.01, `разрыв между улицей и маршрутом ${route.id}`);
        requireValue(route.validation && ['sampled-legacy', 'blender-checked'].includes(route.validation.status) &&
            Number.isFinite(route.validation.clearanceRadius) && route.validation.clearanceRadius > 0, `нет статуса проверки ${route.id}`);
    }
}

export function streetPose(street: CityDescription['camera']['street'], focusZ: number, distance: number): Vector3 {
    return new Vector3(0, street.targetHeight + distance * Math.sin(street.pitch), focusZ + distance * Math.cos(street.pitch));
}

export function indexObjects(root: Object3D, data: CityDescription): Map<string, Object3D> {
    const result = new Map<string, Object3D>();
    root.traverse(object => {
        const id: unknown = object.userData.web_id;
        if (id === undefined) return;
        requireValue(typeof id === 'string' && !result.has(id), 'повторный web_id в GLB');
        result.set(id, object);
    });
    for (const item of data.objects) requireValue(result.get(item.id)?.userData.web_role === item.role, `не найден ID/роль ${item.id}`);
    root.updateWorldMatrix(true, true);
    for (const route of data.camera.routes) {
        const destination = result.get(route.arrivalNodeId)!.getWorldPosition(new Vector3());
        requireValue(destination.distanceTo(new Vector3().fromArray(route.points[route.points.length - 1])) < 0.02, `маршрут не заканчивается в метке ${route.id}`);
    }
    return result;
}

export async function verifiedBytes(url: string, hash: string): Promise<ArrayBuffer> {
    requireValue(typeof hash === 'string' && /^[a-f0-9]{64}$/i.test(hash), 'неверная контрольная сумма ресурса');
    const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(`Ресурс города: HTTP ${response.status}`);
    const bytes = await response.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const actual = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
    requireValue(actual === hash.toLowerCase(), 'не совпала контрольная сумма ресурса');
    return bytes;
}

export async function loadCityPackage(loader: GLTFLoader, manifestUrl: string): Promise<{
    manifest: CityManifest; description: CityDescription; root: Object3D; objects: Map<string, Object3D>;
    mobility?: MobilityData; mobilityUrl?: string;
}> {
    const url = new URL(manifestUrl, location.href);
    const response = await fetch(url, { cache: 'no-cache', signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`Манифест: HTTP ${response.status}`);
    const manifest = await response.json() as CityManifest;
    requireValue(manifest.schemaVersion === 1 && manifest.assets?.city && manifest.assets?.scene, 'неверный манифест');
    const sceneBytes = await verifiedBytes(new URL(manifest.assets.scene.url, url).href, manifest.assets.scene.sha256);
    const description = JSON.parse(new TextDecoder().decode(sceneBytes)) as CityDescription;
    validatePackage(manifest, description);
    let mobility: MobilityData | undefined;
    let mobilityUrl: string | undefined;
    if (manifest.assets.mobility) {
        requireValue(typeof manifest.assets.mobility.url === 'string', 'неверный адрес сети движения');
        mobilityUrl = new URL(manifest.assets.mobility.url, url).href;
        const data = JSON.parse(new TextDecoder().decode(await verifiedBytes(mobilityUrl, manifest.assets.mobility.sha256)));
        mobility = validateMobility(data, manifest.exportId, manifest.assets.city.sha256,
            new Map(description.objects.map(object => [object.id, object.role])));
    }
    const cityUrl = new URL(manifest.assets.city.url, url);
    const bytes = await verifiedBytes(cityUrl.href, manifest.assets.city.sha256);
    const gltf = await loader.parseAsync(bytes, new URL('.', cityUrl).href);
    requireValue(gltf.parser.json.asset.extras?.web_export_id === manifest.exportId, 'GLB имеет другой exportId');
    return { manifest, description, root: gltf.scene, objects: indexObjects(gltf.scene, description), mobility, mobilityUrl };
}
