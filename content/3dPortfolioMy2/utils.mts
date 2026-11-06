import * as THREE from 'three';

export function getRandom<T>(input:T[]) : T {
    return input[Math.floor(Math.random() * input.length)]
}

/**
 * Перемешивает массив случайным образом.
 * @param array - Исходный массив.
 * @returns Перемешанный массив.
 */
export function randomMix<T>(array: T[]): T[] {
    return [...array].sort(() => Math.random() - 0.5);
}

/**
 * Циклически "оборачивает" значение в диапазон [min, max)
 * Аналог fmod, но корректно работает с отрицательными числами.
 * 
 * Примеры:
 * wrap(7, 0, 5) → 2
 * wrap(-1, 0, 5) → 4
 * wrap(12.3, 10, 15) → 12.3
 * wrap(25, 10, 15) → 10 + (25 - 10) % (15 - 10) = 10 + 15 % 5 = 10
 */
export function wrap(value: number, min: number, max: number): number {
    const range = (max) - min;
    return ((value - min) % range + range) % range + min;
}

export function boxDistance(a: THREE.Box3, b: THREE.Box3): number {
    const dx = Math.max(0, a.min.x - b.max.x, b.min.x - a.max.x);
    const dy = Math.max(0, a.min.y - b.max.y, b.min.y - a.max.y);
    const dz = Math.max(0, a.min.z - b.max.z, b.min.z - a.max.z);

    return Math.hypot(dx, dy, dz);
}