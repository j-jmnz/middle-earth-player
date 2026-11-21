# Third-party notices

The MIT license in `LICENSE` covers this project's own code and documentation. It does not cover the material described below.

## Game content

The Lord of the Rings: The Card Game, its card text, card art, rules text and icons are © Fantasy Flight Games. The Lord of the Rings and the names of its characters, items, events and places are trademarks of Middle-earth Enterprises, used under license by Fantasy Flight Games. This is a fan-made, community-supported project and not an official client. It is not associated with, endorsed by, sponsored by or approved by Fantasy Flight Games, Asmodee or Middle-earth Enterprises in any way. No license is granted for this material.

Game content appears in these places:

- `data/cards/`, `data/scenarios/`, `data/campaigns/`, `data/printed/`, `data/rules/`, `data/decks/` and `src/effects/generated/` hold game text and scenario lists.
- `data/raw/` holds verbatim snapshots of the sources.
- `assets/icons/` and `src/ui/icons/` hold game icons built from `data/raw/icons/`.
- Card images and PDFs are downloaded at build time and never committed.

## Sound effects

The phone app's sound effects are cut from Darkest Dungeon II (© Red Hook Studios) by `pnpm assets sounds --from`, from the player's own copy of the game. They are never committed: `data/sources.json` pins them by sha256 and the asset mirror holds them, and the phone builds of each release carry them. No license is granted for them.

## Data sources

None of these sources publishes a license for its data, so the data is used as published.

| Source | Used for | Location |
| --- | --- | --- |
| [RingsDB](https://ringsdb.com) | Player cards and packs; the icon font (`ringsdb.svg`, `ringsdb-app.css`) | `data/raw/ringsdb/`, `data/raw/icons/` |
| [Hall of Beorn](https://hallofbeorn.com) | Encounter and quest cards, scenarios, card scans | `data/raw/hallofbeorn/`, `.cache/` |
| [DragnCards LotR LCG plugin](https://github.com/seastan/dragncards-lotrlcg-plugin) by seastan | Card database, scenario lists, pre-built decks, game steps, token and card-back images | `data/raw/dragncards/`, `data/raw/icons/dragncards/` |
| [Fantasy Flight Games](https://www.fantasyflightgames.com/en/the-lord-of-the-rings-the-card-game/) | Rules PDFs, print-and-play cards, the icon font in the Dream-chaser rulebook (`mec111-icons.ttf`) | `data/raw/icons/`, `.cache/` |
| JvZijp's enhanced proxies and u/LepcisMagna's scans on [lotr.cardgame.tools](https://lotr.cardgame.tools) | Card pictures | `.cache/` |
| A community Google Drive folder | Nightmare deck pictures and card lists | `data/raw/nightmare/`, `.cache/` |

Every source is pinned by URL and sha256 in `data/sources.json`.

## Fonts

The fonts in `assets/fonts/`, and the web build's copies in `public/fonts/`, are Barlow Semi Condensed (Copyright 2017 The Barlow Project Authors) and Marcellus SC (Copyright 2012 Brian J. Bonislawsky DBA Astigmatic). Both are under the SIL Open Font License 1.1, and the license texts are in `assets/fonts/BarlowSemiCondensed-OFL.txt` and `assets/fonts/MarcellusSC-OFL.txt`.

## Dependencies

The npm dependencies keep their own licenses, which you can find in each package under `node_modules/`.

The web and desktop builds ship [pdf.js](https://github.com/mozilla/pdf.js) (`pdfjs-dist`, Apache License 2.0, Copyright Mozilla Foundation) to read the booklets: its worker, CMaps, standard fonts, ICC profiles and wasm decoders are copied to `public/pdfjs` by `pnpm assets pdfjs`, and its license text is `node_modules/pdfjs-dist/LICENSE`. The standard fonts it carries (Foxit and Liberation) keep the licenses in that package.

The web and desktop builds draw the table with [CanvasKit](https://skia.org/docs/user/modules/canvaskit/), Skia's WebAssembly build (`canvaskit-wasm`, BSD 3-Clause License, Copyright Google LLC): `pnpm assets canvaskit` copies its `.wasm` to `public/canvaskit.wasm`, and its license text is `node_modules/canvaskit-wasm/LICENSE`.

The desktop app is built on [Electron](https://www.electronjs.org) (MIT License, Copyright (c) Electron contributors and GitHub Inc.), which bundles [Chromium](https://www.chromium.org) and Node.js under their own licenses, and is packaged with [electron-builder](https://www.electron.build) (MIT) and bundled with [esbuild](https://esbuild.github.io) (MIT). Every installer carries the license texts Electron ships: `LICENSE.electron.txt` (Electron's own) and `LICENSES.chromium.html` (Chromium and everything it includes) sit in the app's folder, beside its executable on Windows and Linux and in `Contents/Resources` inside the application on macOS, and this file and the project's `LICENSE` are in the app's `resources` folder. The app's About box says where they are.
