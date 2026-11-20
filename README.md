# makefun-gta6-cover-art

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/ryanp1632-netizen/makefun-gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/ryanp1632-netizen/makefun-gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

**Afterglow Cover Studio** turns your own photos into open-world-game style key art: a slanted mosaic of smart-cropped,
colour-graded panels under a code-drawn sunset, with a giant gradient title, neon script, tagline ribbon, name tags,
review quote, billing, seal and barcode. Pick a layout and a grade, edit the caption, and export PNGs at 1080×1080,
1080×1350 and 1920×1080, all in the browser.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. The app is plain static files in `app/` (an `index.html`, a
stylesheet and ES modules, no build step, no libraries, no network requests), so any static file server works too.

## Features

- **Any photo.** Add photos with the file picker (many at once), drag and drop onto the page or straight onto a panel,
  or paste from the clipboard. "Try samples" loads the two bundled sample photos.
- **Smart auto layout.** Every photo gets a small saliency analysis on a downscaled copy (cast-corrected skin tone,
  edges, saturation, warm sky, blue water, saturated reds, via integral images). It finds the face, then picks a
  different crop for each panel role: face close-up, mid shot, palms against the sun, the sea, a detail such as the
  car or the fishing reel. The most face-like, contrasty photo takes the hero panel; the others are spread so every
  photo appears and no two panels look alike. One photo alone still fills every panel with distinct crops.
- **Three layouts per ratio, recomposed for each size** (not cropped): Hero Mosaic, Diagonal Strips and Six Grid,
  each drawn separately for 1:1, 4:5 and 16:9, with slanted gutters, dark and light frames and drop shadows.
- **Five colour grades done on real pixel data**: Sunset Gold, Neon Night (turns daylight into a pink/cyan dusk with
  electric water), Tropic Teal, Ultraviolet and Retro Print. Each runs a gradient map, saturation, an S-curve, split
  toning, halftone dots in the shadows and film grain per pixel, then bloom, a light leak and a vignette; every panel
  gets a slight variation so the mosaic stays rich while the cover tells one colour story. The grade also sets the
  sky, sun, title gradient and neon colours.
- **Lettering drawn by code**: a justified, auto-fitting title with a sunset gradient face, stripe cuts, gloss, bevel,
  a stepped 3D extrude, a thick outline and a sticker rim, glow and sparkles; a neon-tube script subtitle with a
  swash; a tagline ribbon with folded tails; name tags; five stars with a quote between laurels; a squeezed billing
  block; a starburst seal with lettering on a circle; a barcode; and a "Coming soon" line. Two title fonts.
- **Code-drawn scenery** ties the panels together: sky gradient with cloud bands and halftone dots, a striped retro
  sun, sea glints, a two-layer skyline with lit windows, palm silhouettes, a glow behind the title, sun rays and a
  film-grain pass over the whole cover.
- **Direct panel editing** on the live preview: click a panel to select it (outline, corner handles, its number),
  drag to pan, mouse wheel or the slider to zoom, previous/next photo, flip, reset to the smart crop, re-run
  auto-fill, drag a panel's number onto another panel to swap them, drop a photo on a panel to fill it. Undo/redo
  (Ctrl+Z / Ctrl+Y) covers captions, layouts, grades and crops.
- **Export**: one button per size plus "Export all 3 PNGs", which downloads all three sizes in one click. Each PNG is
  rendered offscreen at its exact size with the same composer as the preview and named after the title, e.g.
  `sunset-syndicate-1920x1080.png`.

## How to use

1. **Add photos**: drop them on the page, click the drop zone, paste, or press *Try samples*. Panels fill
   themselves.
2. **Caption**: type the title (use `/` to force a line break), script subtitle, tagline, quote and its source,
   billing (separate credits with `·` or `|`), seal text (`centre | ring`), release line and a name tag per panel.
   Clear a field to hide that element. Choose a layout and a colour grade on the left and a size above the preview;
   adjust any panel by clicking and dragging it.
3. **Export PNG**: click a size, or *Export all 3 PNGs*.

## Your photos stay on your machine

Photos are decoded in the browser with `createImageBitmap` and drawn on canvases in memory. Nothing is uploaded, the
app makes no network requests at all, and it uses no cookies, storage or service worker. Closing the tab discards
everything.

## Fonts and licenses

The five fonts in `app/fonts/` come unchanged from the Google Fonts repository: Anton, Saira Condensed Black, Bebas
Neue and Barlow Condensed SemiBold (SIL Open Font License 1.1) and Yellowtail (Apache License 2.0). See
[`app/fonts/FONTS.md`](app/fonts/FONTS.md) for designers, copyrights and what each one is used for. The title look
is the app's own drawing code, not any existing game's logo or lettering. The sample photos in `app/samples/` were
made with an image model for make.fun and are free to use.

## Screenshots

| File | What it shows |
| --- | --- |
| `screenshots/1-cover.jpg` | The app's own 1920×1080 export (Hero Mosaic, Sunset Gold), scaled to 1280×720 |
| `screenshots/2-editor.jpg` | The editor at 1280×800 with both samples loaded, the angler's panel selected |
| `screenshots/3-portrait.jpg` | The 1080×1350 export (Diagonal Strips, Neon Night), scaled to 1024×1280 |
| `screenshots/4-square.jpg` | The 1080×1080 export (Six Grid, Tropic Teal), as is |

### How the screenshots were made

`node tools/shoot.mjs` (Node 22+, standard library only) serves `app/` on 127.0.0.1, starts headless Chrome with a
temporary profile and background networking switched off, and drives the app over the DevTools protocol through its
`window.coverStudio` test hook (`loadSamples()`, `setSize()`, `setLayout()`, `setGrade()`, `selectPanel()`,
`renderCoverDataURL()`). Each cover screenshot is exactly the PNG the app exports, only scaled down in the page with
a canvas and encoded as JPEG under 256 KiB; the editor screenshot is a plain page capture. The script then runs an
interaction self-test with real mouse events (drag to pan, wheel to zoom, undo, swap by dragging a panel number,
typing a title, and *Export all 3*, checking the three downloaded PNGs are 1080×1080, 1080×1350 and 1920×1080), and
fails on any console error or a screenshot outside the limits.

## Handing it in

`node main.ts` checks the entry (app files present, 3–4 screenshots within the limits, the cover first), copies
`app/` and `screenshots/` to `/output` (or `MAKEFUN_OUTPUT_DIR`) and writes `dossier.json` with the vendored make.fun
library. Two runs write identical bytes.

---

<sub>Entered on [make.fun](https://make.fun/?ref=z79n7aa6&utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards</sub>
