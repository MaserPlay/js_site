import { Vector3 } from 'three';
import { streetPose, type CameraRoute, type CityDescription } from './city-package.mjs';

/** Alignment stays on the same street camera constraint as manual navigation. */
export function entryPoints(street: CityDescription['camera']['street'], focusZ: number, distance: number, route: CameraRoute): Vector3[] {
    const alignment: Vector3[] = [];
    for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        alignment.push(streetPose(street, focusZ + (route.anchor.focusZ - focusZ) * t, distance + (route.anchor.distance - distance) * t));
    }
    return [...alignment, ...route.points.slice(1).map(point => new Vector3().fromArray(point))];
}

export class CameraPath {
    private cumulative = [0];
    readonly length: number;
    constructor(readonly points: Vector3[]) {
        if (points.length < 2) throw new Error('Маршруту камеры нужны две точки');
        for (let i = 1; i < points.length; i++) this.cumulative.push(this.cumulative[i - 1] + points[i].distanceTo(points[i - 1]));
        this.length = this.cumulative[this.cumulative.length - 1];
    }
    sample(progress: number, result: Vector3): void {
        const at = Math.max(0, Math.min(1, progress)) * this.length;
        let index = 1;
        while (index < this.cumulative.length - 1 && this.cumulative[index] < at) index++;
        const segment = this.cumulative[index] - this.cumulative[index - 1];
        result.lerpVectors(this.points[index - 1], this.points[index], segment ? (at - this.cumulative[index - 1]) / segment : 0);
    }
}
