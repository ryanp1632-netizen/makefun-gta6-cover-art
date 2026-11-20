// Hands in Afterglow Cover Studio, an entry for make.fun's gta6-cover-art-01 bounty (Node 22, standard library only).
//
// The app is app/: static files that desktop Chrome opens offline (index.html, style.css, plain ES modules in
// app/src/, the fonts in app/fonts/ and the two sample photos in app/samples/), with no build step and no network
// request. It turns your own photos into open-world-game style key art: a slanted mosaic of smart-cropped, colour
// graded panels under a sunset drawn in code, a chunky gradient title with extrude and stripe cuts, a neon script
// subtitle, a tagline ribbon, name tags, a review quote, billing, a seal and a barcode, exported as PNGs at
// 1080x1080, 1080x1350 and 1920x1080. Photos are read in the browser and never leave the machine.
//
// This program copies app/ and screenshots/ (made by `node tools/shoot.mjs`; the first by name is the cover) to the
// output folder and writes dossier.json, the summary the judge reads, with the vendored make.fun library.
//
// Serve the app locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/**
 * Refuses to hand in a broken entry: the app's entry point, its modules, fonts and sample photos must exist, and
 * screenshots/ must hold 3 or 4 .jpg/.png files (and nothing else) within the size cap, the first being the cover.
 */
function checkEntry(root: string): string[] {
  const problems: string[] = [];
  const required = [
    'app/index.html',
    'app/style.css',
    'app/src/main.js',
    'app/src/composer.js',
    'app/src/lettering.js',
    'app/fonts/Anton-Regular.ttf',
    'app/fonts/FONTS.md',
    'app/samples/boulevard.jpg',
    'app/samples/pier.jpg',
  ];
  for (const rel of required) if (!existsSync(join(root, rel))) problems.push(`missing ${rel}`);
  const shotsDir = join(root, 'screenshots');
  const shots = existsSync(shotsDir) ? readdirSync(shotsDir).sort() : [];
  const images = shots.filter((name) => /^[A-Za-z0-9._-]+\.(jpe?g|png)$/i.test(name));
  if (images.length < 3 || images.length > 4) problems.push(`screenshots/ holds ${images.length} .jpg/.png files, needs 3 or 4`);
  for (const name of shots) {
    if (!images.includes(name)) problems.push(`screenshots/${name} is not a .jpg/.png with a plain name`);
    else if (statSync(join(shotsDir, name)).size > 262144) problems.push(`screenshots/${name} is over 256 KiB`);
  }
  if (images.length && !/cover/i.test(images[0])) problems.push(`the first screenshot (${images[0]}) should be the cover`);
  return problems;
}

const problems = checkEntry(here);
if (problems.length) {
  console.error(`main.ts: not handing in this entry:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in app/ or 48 MiB of app
// files, in all, or a path under app/ over 1000 bytes: app/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);
