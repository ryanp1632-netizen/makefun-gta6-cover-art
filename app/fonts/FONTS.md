# Fonts

All five font files were downloaded unchanged from the Google Fonts repository and are loaded by `app/style.css`
with `@font-face` from relative paths. The app waits for `document.fonts` before it draws a cover. None of them is
the font of any game; the lettering effects (gradient, outline, extrude, stripes, glow) are drawn by
`app/src/lettering.js`.

| File | Family | Used for | Designer / copyright | License |
| --- | --- | --- | --- | --- |
| `Anton-Regular.ttf` | Anton | Default poster title, seal centre | Vernon Adams; Copyright 2020 The Anton Project Authors | SIL Open Font License 1.1 |
| `SairaCondensed-Black.ttf` | Saira Condensed Black | Alternative title font | Omnibus-Type (Héctor Gatti and team); Copyright 2016 The Saira Project Authors | SIL Open Font License 1.1 |
| `BarlowCondensed-SemiBold.ttf` | Barlow Condensed SemiBold | Name tags, ribbon, quote, billing block, release line, editor headings | Jeremy Tribby; Copyright 2017 The Barlow Project Authors | SIL Open Font License 1.1 |
| `Yellowtail-Regular.ttf` | Yellowtail | Default neon script subtitle | Brian J. Bonislawsky, Astigmatic (AOETI); Copyright (c) 2011 | Apache License 2.0 |
| `Pacifico-Regular.ttf` | Pacifico | Alternative script subtitle | Vernon Adams; Copyright 2018 The Pacifico Project Authors | SIL Open Font License 1.1 |

The SIL Open Font License 1.1 allows the fonts to be used, bundled and redistributed with software, provided they
are not sold on their own and their reserved font names are not used for modified versions (these files are not
modified). The Apache License 2.0 allows use and redistribution with attribution, which this file provides.
