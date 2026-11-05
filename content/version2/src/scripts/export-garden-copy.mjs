// node scripts/export-garden-copy.mjs --out <folder> [--from http://localhost:3001] [--site https://maserplay.ru]
// A static copy of the 3D site (version 2) for another site, e.g. js.maserplay.ru/content/version2/: one page per
// language (v2.ru.html, v2.en.html) rendered by the running preview server (npm run preview:garden), plus the bundle,
// styles, audio and the assets the garden really loads. The garden finds its files beside its script
// (garden-paths.mjs); links to projects and the home page go to the site; comments go to the site's API (data.api,
// which needs CORS for the copy's origin on that site); the language menu switches between the two pages.
// The bundle stays readable and the pages load garden.bundle.min.js, which js_site's build writes beside it. The
// sources the bundle is made from go to src/, for reading.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2),
  arg = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const out = arg('--out'),
  from = arg('--from', 'http://localhost:3001'),
  site = arg('--site', 'https://maserplay.ru');
if (!out) {
  console.error('Usage: node scripts/export-garden-copy.mjs --out <folder> [--from <preview>] [--site <origin>]');
  process.exit(1);
}
const web = resolve(fileURLToPath(new URL('..', import.meta.url))),
  garden = join(web, 'wwwroot', 'garden'),
  LOCALES = ['ru', 'en'],
  pageOf = locale => `v2.${locale}.html`;
// Trial models only an audit address loads (imported-pine.mjs, imported-firs.mjs) stay out of the copy; of the Mundo
// pine only its needle texture is used by every garden (realistic-foliage.mjs), with its notice.
const SKIP_ASSETS = new Set(['lolipop-fir', 'mundo-pine']),
  KEEP_FILES = ['mundo-pine/diffuse.png', 'mundo-pine/README.md'];

// A site path becomes an address on the site, a garden path a file beside the page.
const rebase = value =>
  value.startsWith('/garden/') ? value.slice('/garden/'.length) : value.startsWith('/') && !value.startsWith('//') ? site + value : value;
const rebaseData = value =>
  typeof value === 'string'
    ? rebase(value)
    : Array.isArray(value)
      ? value.map(rebaseData)
      : value && typeof value === 'object'
        ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rebaseData(v)]))
        : value;

mkdirSync(out, { recursive: true });
for (const locale of LOCALES) {
  const response = await fetch(from + '/Garden', { headers: { 'Accept-Language': locale } });
  if (!response.ok) throw new Error(`${from}/Garden answered ${response.status}`);
  let html = await response.text();
  if (!html.includes(`<html lang="${locale}"`)) throw new Error(`the preview did not answer in ${locale}`);
  const open = '<script type="application/json" id="garden-data">',
    start = html.indexOf(open) + open.length,
    end = html.indexOf('</script>', start);
  if (start < open.length) throw new Error('no garden data in the page');
  const data = rebaseData(JSON.parse(html.slice(start, end)));
  // The preview's fixture note («Preview fixture · … snapshot») is about this machine's test data, not the copy.
  delete data.fixture;
  data.api = site;
  data.localePages = Object.fromEntries(LOCALES.map(l => [l, pageOf(l)]));
  const payload = JSON.stringify(data).replace(/</g, '\\u003c');
  html = html.slice(0, start) + payload + html.slice(end);
  // Attributes outside the data: the garden's files are relative, everything else is on the site.
  html = html.replace(/\b(href|src)="(\/[^"/][^"]*|\/)"/g, (_, attr, value) => `${attr}="${rebase(value)}"`);
  // Shown in a frame on the other site: a link to a project or the home page opens as the whole page, not inside it.
  html = html.replace('<head>', '<head>\n  <base target="_top">');
  if (!html.includes('src="garden.bundle.js"')) throw new Error('no bundle script in the page');
  html = html.replace('src="garden.bundle.js"', 'src="garden.bundle.min.js"');
  writeFileSync(join(out, pageOf(locale)), html);
  console.log('page', pageOf(locale), html.length, 'bytes');
}
execFileSync(process.execPath, ['scripts/build-garden.mjs', '--readable', resolve(out, 'garden.bundle.js')], {
  cwd: web,
  stdio: 'inherit'
});
for (const name of readdirSync(garden))
  if (/\.css$|^media-presentation\.json$|^three\.licenses\.txt$|^third-party-notices\.txt$/.test(name))
    cpSync(join(garden, name), join(out, name));
// A module removed here leaves the copy too. Links out of docs/garden have nowhere to lead there, so they become names.
const src = join(out, 'src');
rmSync(src, { recursive: true, force: true });
mkdirSync(join(src, 'scripts'), { recursive: true });
for (const name of readdirSync(garden))
  if (/\.mjs$|^page\.html$/.test(name)) cpSync(join(garden, name), join(src, name));
cpSync(join(garden, 'shaders'), join(src, 'shaders'), { recursive: true });
for (const name of ['build-garden.mjs', 'export-garden-copy.mjs'])
  cpSync(join(web, 'scripts', name), join(src, 'scripts', name));
const codeMap = readFileSync(join(web, '..', 'docs', 'garden', 'README.md'), 'utf8');
writeFileSync(
  join(src, 'README.md'),
  'Копия исходников сада из репозитория maserplay.ru, для чтения: менять их там, пути ниже даны от него.\n\n' +
    codeMap.replace(/\[([^\]]+)\]\(\.\.\/[^)]+\)/g, '`$1`')
);
cpSync(join(garden, 'audio'), join(out, 'audio'), { recursive: true });
for (const name of readdirSync(join(garden, 'assets')))
  if (!SKIP_ASSETS.has(name)) cpSync(join(garden, 'assets', name), join(out, 'assets', name), { recursive: true });
for (const file of KEEP_FILES) cpSync(join(garden, 'assets', file), join(out, 'assets', file));
const build = (readFileSync(join(out, 'garden.bundle.js'), 'utf8').match(/20\d\d-\d\d-\d\d \d\d:\d\d UTC/) || ['dev'])[0];
console.log('copied the bundle (build ' + build + '), sources, styles, audio and assets to', out);
