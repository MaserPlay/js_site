# Yughues Mundo pine — CC0 local comparison

Author: Yughues. Commissioned by R. Robles for Mundo and shared with his agreement.

- Source: https://opengameart.org/content/freebies-mundo-commissions
- License: CC0 — https://creativecommons.org/publicdomain/zero/1.0/
- Public download: https://opengameart.org/sites/default/files/Mundo.7z
- Downloaded and source page checked on 2026-10-13. No account, purchase or gated download.
- Archive: 26,652,796 bytes; SHA-256 `a4794cbb9d1f281b7d51ba79e04c0a97a6962a4f63ddaa480f695bcc64a5ff3e`.

Files derive from `pine/snow_pine_tree.obj`, `diffuse_none.tga`, `normal_none.tga` and `diffuse_half.tga`. The mesh name includes “snow”, but snow is in the optional diffuse texture. The original none/half preview JPGs were inspected. No textures from Sketchfab were used.

Conversion uses the project's locked Three.js OBJLoader, TGALoader and mergeVertices, plus Node zlib for lossless PNG encoding. OBJ normals and UV seams are preserved. The source has 763 positions, 784 triangles, Y-up, root Y=0, height 98.9630966. The indexed runtime mesh has 826 vertices because of UV/normal seams. Geometry is normalized to unit height. Texture pixels and orientation are unchanged; all three PNGs are 1024×1024. Winter and summer alpha channels match exactly. No executable content is taken from the archive.

Reproduce from an extracted `pine` folder with `node scripts/convert-mundo-pine.mjs PATH_TO_PINE OUTPUT_DIRECTORY`. See `asset-facts.json` for original and converted hashes.

Runtime trial: one central tree at (-0.8, 0.2, -2.15), scale (6.45, 11.05, 6.45), Y rotation 0.24. Independent vertical scale retains the former fir's tall silhouette and footprint. Standard opaque material uses alpha test 0.38, alpha-to-coverage, depth writes and DoubleSide. A restrained normal map preserves needle detail. Linear albedo multiplier (2.7, 3.0, 2.3) compensates the source's dark prelit colors; winter uses (1.12, 1.12, 1.12). No emissive contribution is added. The existing practical-light field includes this material.

The trial replaces the central summer broadleaf and central decorated winter fir only. The model uses the artist's half-snow diffuse on the same geometry, with no snow planes or additional draws. Original ornaments/cord/star are omitted in the candidate because they belong to the old branch geometry. All other planting and existing variants remain unchanged. The ordinary garden loads no Mundo assets. This is an evaluation option, not the selected final tree.
