import { MeshPhysicalMaterial, MeshStandardMaterial, NoColorSpace, RepeatWrapping, TextureLoader } from 'three';

/** Linear colours from the original road/river generator palettes. */
const palette: Record<string, [number, number, number]> = {
    road_trunk: [0.19, 0.10, 0.055], river_trunk: [0.18, 0.10, 0.055],
    road_leaf_0: [0.06, 0.24, 0.12], road_leaf_1: [0.12, 0.31, 0.15], road_leaf_2: [0.20, 0.30, 0.10],
    river_leaf_0: [0.055, 0.23, 0.10], river_leaf_1: [0.12, 0.30, 0.14], river_leaf_2: [0.23, 0.32, 0.09]
};

export class NatureMaterials {
    readonly time = { value: 0 };
    restoredColours = 0;
    waterMaterials = 0;
    private seen = new Set<MeshStandardMaterial>();

    async loadExportedMaterials(url: string, expectedHash: string): Promise<void> {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Не загружен контракт материалов природы');
        const data = await response.json() as {
            source_glb_sha256: string;
            overrides: { material_name: string; base_color_linear: number[]; roughness: number; kind: string }[];
            water_normal: { file: string; suggested_tile_size_m: number; uv_channel: number };
        };
        if (data.source_glb_sha256 !== expectedHash || data.water_normal.uv_channel !== 0 ||
            !(data.water_normal.suggested_tile_size_m > 0)) throw new Error('Материалы относятся к другой сцене');
        const texture = await new TextureLoader().loadAsync(new URL(data.water_normal.file, new URL(url, location.href)).href);
        texture.colorSpace = NoColorSpace;
        texture.flipY = false;
        texture.wrapS = texture.wrapT = RepeatWrapping;
        texture.repeat.setScalar(1 / data.water_normal.suggested_tile_size_m);
        const overrides = new Map(data.overrides.map(item => [item.material_name, item]));
        this.seen.forEach(material => {
            const item = overrides.get(material.name);
            if (!item) return;
            material.color.fromArray(item.base_color_linear);
            material.roughness = item.roughness;
            if (item.kind === 'water') {
                material.normalMap = texture;
                material.normalScale.set(0.5, 0.5);
            }
            material.needsUpdate = true;
        });
    }

    prepare(material: MeshStandardMaterial): void {
        if (this.seen.has(material)) return;
        this.seen.add(material);
        const key = material.name.toLowerCase().replace(/\.\d+$/, '').split('/').pop()!.trim();
        const colour = palette[key];
        // Only repair missing export values; keep existing maps and authored colours.
        if (colour && !material.map && material.color.r === 1 && material.color.g === 1 && material.color.b === 1) {
            material.color.setRGB(...colour);
            this.restoredColours++;
        }
        if (key !== 'river_water') return;
        this.waterMaterials++;
        material.color.setRGB(0.028, 0.13, 0.115);
        material.roughness = 0.18;
        material.metalness = 0;
        if (material instanceof MeshPhysicalMaterial) material.ior = 1.333;
        const previousCompile = material.onBeforeCompile;
        const previousKey = material.customProgramCacheKey();
        material.onBeforeCompile = (shader, renderer) => {
            previousCompile.call(material, shader, renderer);
            shader.uniforms.natureTime = this.time;
            shader.vertexShader = 'varying vec3 vRiverPosition;\n' + shader.vertexShader.replace(
                '#include <project_vertex>', `#include <project_vertex>
                vec4 riverPosition = vec4(transformed, 1.0);
                #ifdef USE_INSTANCING
                    riverPosition = instanceMatrix * riverPosition;
                #endif
                vRiverPosition = (modelMatrix * riverPosition).xyz;`);
            shader.fragmentShader = 'uniform float natureTime;\nvarying vec3 vRiverPosition;\n' + shader.fragmentShader
                .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
                    float waveA = dot(vRiverPosition.xz, vec2(3.2, 1.4)) - natureTime * 1.1;
                    float waveB = dot(vRiverPosition.xz, vec2(-5.1, 7.7)) + natureTime * 0.83;
                    float waveC = dot(vRiverPosition.xz, vec2(21.0, 13.0)) - natureTime * 1.7;
                    vec2 slope = cos(waveA) * vec2(3.2, 1.4) * 0.012
                        + cos(waveB) * vec2(-5.1, 7.7) * 0.004
                        + cos(waveC) * vec2(21.0, 13.0) * 0.0015;
                    normal = normalize(normal + mat3(viewMatrix) * vec3(-slope.x, 0.0, -slope.y));`)
                .replace('#include <color_fragment>', `#include <color_fragment>
                    float riverTint = 0.5 + 0.5 * sin(vRiverPosition.x * 0.13 + sin(vRiverPosition.z * 0.19));
                    diffuseColor.rgb *= mix(vec3(0.65, 0.72, 0.70), vec3(1.25, 1.18, 1.05), riverTint);`);
        };
        material.customProgramCacheKey = () => `${previousKey}:river_ripples_v1`;
        material.needsUpdate = true;
    }
}
