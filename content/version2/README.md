# version2 — maserplay.ru in 3D

The floating garden of projects, version 2 of maserplay.ru, shown on js.maserplay.ru as a full-window page
(`Style.Bare`): `index.ejs` puts `v2.ru.html` or `v2.en.html` (by the site's language, `server.ts`) in a frame over
the whole window.

Everything else in this folder is a static copy of the garden, exported from the maserplay.ru repository. Do not edit
it here: change the garden there and export again.

## Reading the code

`src/` holds the garden's sources; start with `src/README.md`, the map of its modules. Imports of `vendor/...` are
three.js r186, which the build takes from npm, so it is not in `src/`.

`garden.bundle.js` is those sources and three.js joined by esbuild and left readable. This site's build (`build.ts`)
minifies it with uglify-js into `garden.bundle.min.js`, and that is the file the pages load. It exists only in `build/`,
so the pages need the site's build to run: opening them from this folder finds no script.

## Updating the copy

In the maserplay.ru repository (`Web/`):

```
npm run preview:garden
node scripts/export-garden-copy.mjs --out <this folder>
```

The export renders one page per language from the running preview, makes the garden's own files relative, points
links, project pictures and the project list at https://maserplay.ru, builds the readable bundle, and copies the
sources, styles, audio and the assets the garden loads (trial-only tree models stay out). The garden finds its files
beside its script, so the folder can live under any path.

## What the copy needs from maserplay.ru

- Project pictures (`/upload/...`) and the project list (`/api/projects.json`) already answer other origins
  (`Access-Control-Allow-Origin: *`), so the gallery panel and the sorting and filters work.
- The pictures in the 3D scene do not work yet: the garden loads them without `crossOrigin`, so the browser refuses
  them as textures (`Tainted canvases may not be loaded`) and the frames stay blank.
- Comments (`/api/comment/list`, `/api/comment/post`) do not yet: until maserplay.ru allows
  `https://js.maserplay.ru` there, the comments section of a project says it could not load them.
- The project data in the pages is a snapshot taken at export; new projects appear after the next export (or when a
  visitor changes the sorting or filters, which reloads the list from maserplay.ru).

## Licenses

`three.licenses.txt` (three.js), `third-party-notices.txt` (code in the shaders by David Hoskins and Inigo Quilez),
`assets/README.md` and the notices in `audio/` and `assets/*/README.md`.
