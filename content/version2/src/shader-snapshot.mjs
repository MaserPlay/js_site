// Audit tool (garden.mjs __gardenDebug.shaderSnapshot): every scene material's final shader text, to prove that moving
// or reformatting a shader changed nothing a GPU sees (owner, 2026-11-01: shaders moved into readable modules).
// ShaderMaterials are taken as they are; three's own materials go through their onBeforeCompile patches over three's
// own shader of that kind, as the renderer would build them (without its #define prefix, which no move touches).
const LIBRARY = {
  MeshStandardMaterial: 'standard',
  MeshPhysicalMaterial: 'physical',
  MeshBasicMaterial: 'basic',
  MeshLambertMaterial: 'lambert',
  MeshPhongMaterial: 'phong',
  MeshDepthMaterial: 'depth',
  MeshDistanceMaterial: 'distance',
  MeshNormalMaterial: 'normal',
  PointsMaterial: 'points',
  LineBasicMaterial: 'basic',
  SpriteMaterial: 'sprite'
};

export function shaderSnapshot(THREE, scene) {
  const materials = new Set();
  scene.traverse(object => {
    for (const material of [
      object.material,
      object.customDepthMaterial,
      object.customDistanceMaterial
    ].flat())
      if (material) materials.add(material);
  });
  const list = [];
  for (const material of materials) {
    if (material.isShaderMaterial) {
      list.push({ kind: material.type, vertex: material.vertexShader, fragment: material.fragmentShader });
      continue;
    }
    const library = THREE.ShaderLib[LIBRARY[material.type]];
    if (!library || !Object.prototype.hasOwnProperty.call(material, 'onBeforeCompile')) continue;
    const shader = {
      uniforms: {},
      vertexShader: library.vertexShader,
      fragmentShader: library.fragmentShader
    };
    material.onBeforeCompile(shader, null);
    list.push({
      kind: material.type + ' patched',
      vertex: shader.vertexShader,
      fragment: shader.fragmentShader
    });
  }
  return list;
}
