// node scripts/build-garden.mjs [--readable <file>], from Web/
// --readable writes the same bundle unminified, for a site that minifies it itself (export-garden-copy.mjs).
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2),
  readable = args.includes('--readable') ? args[args.indexOf('--readable') + 1] : null;
if (readable === undefined) throw new Error('--readable needs a file');
const three = path => ({ path: fileURLToPath(new URL('../node_modules/three/' + path, import.meta.url)) });
const fileName = path => path.split('/').pop();

mkdirSync('wwwroot/garden/vendor', { recursive: true });
// Imports use locked local dependencies; this standalone build is independent of the older gallery.
await build({
  entryPoints: ['wwwroot/garden/garden.mjs'],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  outfile: readable ?? 'wwwroot/garden/garden.bundle.js',
  minify: !readable,
  legalComments: 'eof',
  define: {
    __GARDEN_BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC')
  },
  plugins: [
    {
      name: 'garden-three',
      setup(api) {
        api.onResolve({ filter: /vendor\/three\.module\.js$/ }, () => three('build/three.module.js'));
        api.onResolve({ filter: /vendor\/postprocessing\/[A-Za-z]+\.js$/ }, args =>
          three('examples/jsm/postprocessing/' + fileName(args.path))
        );
        api.onResolve({ filter: /vendor\/shaders\/[A-Za-z]+\.js$/ }, args =>
          three('examples/jsm/shaders/' + fileName(args.path))
        );
        api.onResolve({ filter: /vendor\/BufferGeometryUtils\.js$/ }, () =>
          three('examples/jsm/utils/BufferGeometryUtils.js')
        );
      }
    }
  ]
});
if (!readable) writeFileSync('wwwroot/garden/three.licenses.txt', readFileSync('node_modules/three/LICENSE'));
