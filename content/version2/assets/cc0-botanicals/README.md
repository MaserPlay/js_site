# Poly Haven foliage maps

The leaf, blossom and bark maps that `realistic-foliage.mjs` puts on the garden's own (procedural) plants. Source maps are **CC0-1.0**, verified on the official asset pages and [Poly Haven license](https://polyhaven.com/license) on 2026-10-13. Attribution is optional; source credit is retained here for provenance.

- [Jacaranda Tree](https://polyhaven.com/a/jacaranda_tree): Rico Cilliers; guidance Rob Tuytel. Source of `leaves.png`, `trunk.jpg`, `trunk-normal.jpg`.
- [Flower Gazania](https://polyhaven.com/a/flower_gazania): James Ray Cock (model), Jenelle van Heerden (photography). Source of `flowers.png`.
- [CC0 legal text](https://creativecommons.org/publicdomain/zero/1.0/legalcode).

Only the maps are used; the website never loads the Poly Haven models. Both atlases stay 1024 px (the official alpha masks are combined with the albedo); bark and its normal map are 512 px JPEG. `../../../../scripts/prepare-cc0-textures.ps1` prepares them from the source downloads.

The Poly Haven 3D comparison (opt-in `audit=1&botanicals=cc0`) was removed once the garden kept its original plants. Its geometry, converter and test are kept outside the repository for rollback.

These files do not replace or alter the Mundo CC0 or LOLIPOP CC BY source assets or their attribution.
