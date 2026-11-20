# Fonts

Afterglow Cover Studio ships five font files, downloaded unchanged from the Google Fonts repository and loaded with
`@font-face` from this folder (see `../style.css`). The app waits for `document.fonts` before drawing, so every
cover uses these files and never a system font. All of them are free to use, embed and redistribute.

| File | Family | Used for | Designer / copyright | License |
| --- | --- | --- | --- | --- |
| `Anton-Regular.ttf` | Anton | the giant cover title (default), seal centre, app logo | Vernon Adams; Copyright 2020 The Anton Project Authors | SIL Open Font License 1.1 |
| `SairaCondensed-Black.ttf` | Saira Condensed Black | the alternative title font ("Saira Black") | Omnibus-Type (Héctor Gatti and team); Copyright 2016 The Saira Project Authors | SIL Open Font License 1.1 |
| `BebasNeue-Regular.ttf` | Bebas Neue | tagline ribbon, name tags, review quote, seal ring, release line | Ryoichi Tsunekawa (Dharma Type); Copyright 2019 The Bebas Neue Project Authors | SIL Open Font License 1.1 |
| `Yellowtail-Regular.ttf` | Yellowtail | the neon script subtitle | Brian J. Bonislawsky (Astigmatic); Copyright (c) 2011 Brian J. Bonislawsky DBA Astigmatic (AOETI) | Apache License 2.0 |
| `BarlowCondensed-SemiBold.ttf` | Barlow Condensed SemiBold | billing block, barcode digits, the editor's interface text | Jeremy Tribby; Copyright 2017 The Barlow Project Authors | SIL Open Font License 1.1 |

The SIL Open Font License 1.1 allows the fonts to be used, studied, modified and redistributed freely, including
bundled with software, as long as they are not sold by themselves; reserved font names are not used for modified
versions (none of these files is modified). The Apache License 2.0 allows use, modification and redistribution with
the license notice retained. The full license texts are published with each family in the Google Fonts repository
(`ofl/<family>/OFL.txt` and `apache/yellowtail/LICENSE.txt`).

None of these is, or imitates, the lettering of any existing game's logo; the title look (gradient, outline, extrude,
stripe cuts, sparkles) is drawn by the app's own code in `../src/lettering.js`.
