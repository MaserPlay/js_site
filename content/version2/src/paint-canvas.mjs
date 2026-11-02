// The garden's canvases are paintings for its textures, never shown themselves, so the CPU draws them
// (willReadFrequently keeps a canvas out of the GPU). Accelerated, each one also held a GPU surface of its own beside
// the texture made from it (round 20: about 350 MB per garden). A sort builds the next garden beside the shown one,
// and that took the GPU process over its memory budget: the driver moved memory for 250–330 ms, the sort's one
// long stop. With CPU canvases its longest frame fell to 35–75 ms. A canvas keeps the settings of its first
// getContext call, so every texture canvas gets its context here.
export const PAINT_OPTIONS = Object.freeze({ willReadFrequently: true });
export function paintContext(canvas) {
  return canvas.getContext('2d', PAINT_OPTIONS);
}
