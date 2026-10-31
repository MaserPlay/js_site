# version2 — maserplay.ru in 3D

The floating garden of projects, version 2 of maserplay.ru, shown on js.maserplay.ru as a full-window page
(`Style.Bare`): `index.ejs` puts `v2.ru.html` or `v2.en.html` (by the site's language, `server.ts`) in a frame over
the whole window.

Everything else in this folder is a static copy of the garden, exported from the maserplay.ru repository. Do not edit
it here: change the garden there and export again.

## Updating the copy

In the maserplay.ru repository (`Web/`):

```
npm run build:garden
npm run preview:garden
node scripts/export-garden-copy.mjs --out <this folder>
```

The export renders one page per language from the running preview, makes the garden's own files relative, points
links, project pictures and the project list at https://maserplay.ru, and copies the bundle, styles, audio and the
assets the garden loads (trial-only tree models stay out). The garden finds its files beside `garden.bundle.js`, so the
folder can live under any path.

## What the copy needs from maserplay.ru

- Project pictures (`/upload/...`) and the project list (`/api/projects.json`) already answer other origins
  (`Access-Control-Allow-Origin: *`), so the 3D screens and the sorting and filters work.
- Comments (`/api/comment/list`, `/api/comment/post`) do not yet: until maserplay.ru allows
  `https://js.maserplay.ru` there, the comments section of a project says it could not load them.
- The project data in the pages is a snapshot taken at export; new projects appear after the next export (or when a
  visitor changes the sorting or filters, which reloads the list from maserplay.ru).

## Licenses

`three.licenses.txt` (three.js), `assets/README.md` and the notices in `audio/` and `assets/*/README.md`.
