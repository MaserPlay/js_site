// Where the garden's own files are: the folder of the running bundle. maserplay.ru serves it from /garden/, a copy on
// another site (js.maserplay.ru/content/version2/) from its own folder, so audio, models and textures load from beside
// the script instead of a fixed /garden/. Node tests (no document) and an inline build keep /garden/.
const script = typeof document === 'undefined' ? null : document.currentScript;
export const GARDEN_ROOT = script?.src ? new URL('./', script.src).pathname : '/garden/';
export const gardenFile = path => GARDEN_ROOT + path;
