// Golden Mile Cover Studio — entry for make.fun's gta6-cover-art-01 bounty (Node 22, standard library only).
//
// The app lives in app/: plain static files (index.html, style.css and ES modules under app/src/) that desktop
// Chrome opens offline, with no build step, no library and no network request. It turns the user's own photos into
// a crime-epic cast poster — a mosaic of slanted photo panels, each framed on a face, a chunky sunset-gradient title
// with a 3D extrude, a neon script subtitle, tagline ribbon, review quote, seal, barcode and billing block — and
// exports it as PNG at 1080x1080, 1080x1350 and 1920x1080. Fonts are SIL OFL / Apache 2.0 files in app/fonts/; the
// demo cast in app/samples/ is AI-generated (see app/samples/PHOTOS.md) and shows no real person.
//
// This program hands the entry in: it copies app/ and screenshots/ from beside this file to the output directory
// and writes dossier.json, the summary the judge reads, with the vendored make.fun library.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Sanity checks: refuse to hand in an entry that is missing its pieces.
function refuse(reason: string): never {
  console.error(`main.ts: refusing to run: ${reason}`);
  process.exit(1);
}

const shotsDir = join(here, 'screenshots');
const shots = existsSync(shotsDir) ? readdirSync(shotsDir).filter((name) => /\.(jpe?g|png)$/i.test(name)) : [];
if (shots.length < 3 || shots.length > 4) refuse(`screenshots/ must hold 3 or 4 .jpg/.png files, found ${shots.length}`);

if (!existsSync(join(here, 'app', 'index.html'))) refuse('app/index.html is missing');

const castDir = join(here, 'app', 'samples', 'cast');
const cast = existsSync(castDir) ? readdirSync(castDir).filter((name) => /\.jpg$/i.test(name)) : [];
if (cast.length !== 6) refuse(`app/samples/cast/ must hold 6 .jpg demo cast photos, found ${cast.length}`);
for (const name of cast) {
  const bytes = statSync(join(castDir, name)).size;
  if (bytes > 200 * 1024) refuse(`app/samples/cast/${name} is ${bytes} bytes, over the 200 KB cap`);
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
