# Third-party notices

The MIT license in `LICENSE` covers the code and documentation written for this project. It does not cover the material below, which keeps its owners' terms.

## Game content

The Lord of the Rings: The Card Game, its card text, card art, rules text and icons are © Fantasy Flight Games. The Lord of the Rings and the names of its characters, items, events and places are trademarks of Middle-earth Enterprises, used under license by Fantasy Flight Games. This is a fan-made, community-supported project and not an official client. It is not associated with, endorsed by, sponsored by or approved by Fantasy Flight Games, Asmodee or Middle-earth Enterprises in any way. No license is granted for this material.

It appears in:

- `data/cards/`, `data/scenarios/`, `data/campaigns/`, `data/printed/`, `data/rules/`, `data/decks/` and the generated records in `src/effects/generated/`: card text, scenario lists and rules text.
- `data/raw/`: snapshots of the sources below, kept verbatim.
- `assets/icons/` and `src/ui/icons/`: game icons built from `data/raw/icons/`.
- Card scans, card pictures and PDFs, which are downloaded at build time and never committed.

## Data sources

None of these sources publishes a license for its data. Their data is used as published and is not covered by `LICENSE`.

| Source | Used for | Location |
| --- | --- | --- |
| [RingsDB](https://ringsdb.com) | Player cards, packs, the icon font (`ringsdb.svg`, `ringsdb-app.css`) | `data/raw/ringsdb/`, `data/raw/icons/` |
| [Hall of Beorn](https://hallofbeorn.com) | Encounter and quest cards, scenarios, card scans | `data/raw/hallofbeorn/`, `.cache/` |
| [DragnCards LotR LCG plugin](https://github.com/seastan/dragncards-lotrlcg-plugin) by seastan | Card database, scenario lists, pre-built decks, game steps, token and card-back images | `data/raw/dragncards/`, `data/raw/icons/dragncards/` |
| [Fantasy Flight Games](https://www.fantasyflightgames.com/en/the-lord-of-the-rings-the-card-game/) | Rules PDFs, print-and-play cards, the icon font in the Dream-chaser rulebook (`mec111-icons.ttf`) | `data/raw/icons/`, `.cache/` |
| JvZijp's enhanced proxies, u/LepcisMagna's scans on [lotr.cardgame.tools](https://lotr.cardgame.tools), a Nightmare deck folder on Google Drive | Card pictures | `.cache/` |

Every source is pinned by URL and sha256 in `data/sources.json`.

## Fonts

`assets/fonts/` holds Barlow Semi Condensed (Copyright 2017 The Barlow Project Authors) and Marcellus SC (Copyright 2012 Brian J. Bonislawsky DBA Astigmatic), both under the SIL Open Font License 1.1. The full license texts are in `assets/fonts/BarlowSemiCondensed-OFL.txt` and `assets/fonts/MarcellusSC-OFL.txt`.

## Expo template

`expo-logo.png`, `expo-badge*.png`, `react-logo*.png`, `tutorial-web.png` and `tabIcons/` in `assets/images/` come from the Expo app template, MIT License, Copyright (c) 2015-present 650 Industries, Inc. (aka Expo).

## Dependencies

npm dependencies keep their own licenses, listed in each package under `node_modules/`.
