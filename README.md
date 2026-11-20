# makefun-gta6-cover-art

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/ryanp1632-netizen/makefun-gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/ryanp1632-netizen/makefun-gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

Golden Mile Cover Studio turns your own photos into a crime-epic cast poster: one big hero panel and six framed
cast panels, each cropped on a face by a built-in face finder, a chunky sunset-gradient title with a 3D extrude, a
neon script subtitle over a striped sunset, a review bar with stars on top, and a full colour grade. It exports PNGs
at 1080×1080, 1080×1350 and 1920×1080 in one click.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. The app is plain static files in `app/` (HTML, CSS and ES
modules, no build step, no libraries, no network requests), so any static file server works too.

## How to use

1. **Add photos**: choose files, drop them on the page, or paste them. Press **Try samples** to load the
   8-person demo cast. The panels fill themselves: every panel gets a different person, the best face goes in
   the hero panel and the next-best faces fill the cast panels. With more photos than panels the weakest photo
   is left out; it stays in the photo strip, one click from any panel.
2. **Caption**: edit the title (Anton or Saira Condensed), script subtitle (Yellowtail or Pacifico), tagline
   ribbon, the review quote and source for the top bar, the edition tag ("VOL. 1"), billing block (words typed
   in lower case print small), seal text, release line and the per-panel name tags (filled from the photos
   automatically, or typed by hand).
3. **Export PNG**: one button per size, or **Export all 3 PNGs**. Each size is rendered offscreen at its exact
   pixel size and saved as `<title>-<width>x<height>.png`.

Panel moves in the live preview:
- **Click** a panel to select it (highlighted with handles and its number).
- **Drag** inside it to pan the photo; use the **mouse wheel** or the zoom slider to zoom; double-click to reset.
- **Drag a panel's number** onto another panel to swap them.
- **Drop a photo file** (or a thumbnail from the left column) onto a panel to fill it.
- The toolbar steps through photos, flips, resets and auto-fills. Undo/redo (Ctrl+Z / Ctrl+Shift+Z) covers
  every change.

The size switch recomposes the layout for 1:1, 4:5 and 16:9 rather than cropping it, and three live mini previews
show all sizes at once.

## Features

- **Layouts** (`app/src/layouts.js`), each composed separately for every ratio:
  - *Cast Mosaic* (the default): one big hero panel (38% of the 16:9 width, from the top bar to the billing)
    with six cast panels around it, each close to the shape of a portrait photo so every head stays large and
    whole. The title crosses the middle on the row gutter; the neon script and tagline ribbon sit on the hero's
    lower half, which fades into a striped sunset. In 4:5 and 1:1 the hero sits between two tall cast panels
    above the title, with four cast panels below.
  - *Diagonal Strips*: slanted portrait strips over a code-drawn sunset with palms and skyline.
  - *Six Grid*: in 16:9, three over three portrait panels beside a title stack over a sunset; in 4:5 and 1:1,
    three over three around a sunset band.
- **Framed stills**: every panel casts a soft drop shadow on a dark sunset ground and gets a thin warm-white
  keyline with a faint matte inside it, drawn after the grade so it stays crisp.
- **Review top bar**: five stars, the review quote in quotation marks and its source on the left, a boxed
  edition tag on the right, so no quote sits on the photos.
- **Face finder** (`app/src/faceFinder.js`): skin likelihood that tolerates golden-hour and neon light, combined
  with local-detail and upper-frame priors, searched with integral images on a downscaled copy, then fitted to
  the skin region (grown across a close-up's cheeks, trimmed off hair and background). A face-quality score
  (brightness, contrast, sharpness, size and resolution) ranks the photos; the hero is the best face that can
  fill a big hero frame with its head whole.
- **Smart crop** (`app/src/smartCrop.js`): each panel has a face zone that no lettering touches. The crop
  places the whole head, hair to chin, inside it with headroom. If a photo cannot cover a panel without
  cutting the head, it extends the photo's own edge instead. With a single photo, the panels show distinct
  crops (close-up, mid shot, wide, background detail, mirrored).
- **Photo finishing** (`app/src/photoFinish.js`), so all eight photos look like one shoot: every panel is
  auto-exposed (levels, face-weighted gamma, dehaze) and gets a gentle unsharp mask on the face area; the grade
  protects skin tones (skin keeps its own warm hue, never grey or magenta); one fine film grain covers the
  whole poster.
- **Five colour grades** on pixel data (`app/src/grades.js`): Sunset Gold, Neon Night, Tropic Teal, Ultraviolet
  and Retro Print. Each one uses a tone curve, split toning, saturation and vibrance, a contrast S-curve,
  vignette, film grain, bloom and light leaks; Retro Print adds halftone dots.
- **Lettering drawn in code** (`app/src/lettering.js`): the auto-fitting chrome title (gradient fill, thick
  outline, light rim, offset extrude, stripe cuts, gloss, sparkles), the neon script subtitle, tagline ribbon,
  name tags placed in each panel's free area, the review top bar, round seal, barcode, billing block and
  release line.
- **Decoration** (`app/src/decor.js`): the dark sunset poster ground, sunset sky with a striped sun, sea
  glints, palm and skyline silhouettes, lens flare and a title glow.
- **Test hook**: `window.coverStudio` (`loadSamples`, `setSize`, `setLayout`, `setGrade`, `selectPanel`,
  `renderCoverDataURL`, `faceReport`) lets a headless browser drive the editor.

## Privacy

Photos never leave this device. Files are read in the browser with `createImageBitmap` and drawn into canvases.
Nothing is uploaded, and the app makes no network request at all.

## Fonts and licenses

Five font files from the Google Fonts repository, unchanged, in `app/fonts/`: Anton, Saira Condensed Black,
Barlow Condensed SemiBold and Pacifico (SIL Open Font License 1.1), and Yellowtail (Apache License 2.0).
Designers, copyrights and what each font is used for are listed in [app/fonts/FONTS.md](app/fonts/FONTS.md). The
app is original work: it uses no game logo, wordmark, font, artwork or character.

## Sample photos

The demo cast is AI-generated and shows no real people. Two photos (`boulevard.jpg`, `pier.jpg`) come from the
make.fun bounty kit. The six in `app/samples/cast/` were made with the free Pollinations image API; the model is
"sana" according to the EXIF data. For v4, four of them were replaced by more photographic candidates ("candid
35mm film photograph" prompts); each was cropped to remove the service's corner mark. The prompts, seeds, how each
file was chosen, the request form and the crop are listed in [app/samples/PHOTOS.md](app/samples/PHOTOS.md).

## Screenshots

`screenshots/` holds four JPEGs made by `node tools/shoot.mjs` (Node 22, standard library only). The script serves
`app/` on localhost, starts headless Chrome with a throwaway profile, loads the demo cast and drives the editor
over the DevTools protocol:

| File | What it is |
| --- | --- |
| `1-cover.jpg` | The 1920×1080 Cast Mosaic cover (hero + 6 framed cast panels) in Sunset Gold, scaled to 1280×720 |
| `2-editor.jpg` | The editor at 1280×800 with the demo cast loaded, the 16:9 cover in the live preview and panel 3 selected |
| `3-portrait.jpg` | The 1080×1350 Diagonal Strips cover in Neon Night, scaled to 1024×1280 |
| `4-square.jpg` | The 1080×1080 Six Grid cover in Tropic Teal, at full size |

The covers are the exact PNGs the export button produces (via `renderCoverDataURL`), only scaled down and
JPEG-encoded in the page. The script fails if the page logs a console error, or if any face is cut by its
panel or covered by lettering. `node tools/shoot.mjs --interact` also drives the editor like a user: file upload,
single-photo crops, pan, wheel zoom, number-drag swap, flip, undo/redo, caption edits and export all.

## Handing it in

`node main.ts` checks the entry first: screenshots/ must hold 3–4 images, `app/index.html` must exist, and
the 6 cast photos must be at most 200 KB each. It then copies `app/` and `screenshots/` to the output directory
(`MAKEFUN_OUTPUT_DIR`, default `/output`) and writes `dossier.json` with the vendored make.fun library. Two runs
write identical bytes.

---

<sub>Entered on [make.fun](https://make.fun/?ref=z79n7aa6&utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards</sub>
