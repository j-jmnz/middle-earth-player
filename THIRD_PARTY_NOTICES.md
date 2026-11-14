# Third-party notices

`LICENSE` (MIT) covers this project's own code and documentation, not the material below.

## Game content

The Lord of the Rings: The Card Game, its card text, card art, rules text and icons are © Fantasy Flight Games. The Lord of the Rings and the names of its characters, items, events and places are trademarks of Middle-earth Enterprises, used under license by Fantasy Flight Games. This is a fan-made, community-supported project and not an official client. It is not associated with, endorsed by, sponsored by or approved by Fantasy Flight Games, Asmodee or Middle-earth Enterprises in any way. No license is granted for this material.

Locations:

- `data/cards/`, `data/scenarios/`, `data/campaigns/`, `data/printed/`, `data/rules/`, `data/decks/`, `src/effects/generated/`: game text and scenario lists.
- `data/raw/`: verbatim source snapshots.
- `assets/icons/`, `src/ui/icons/`: game icons built from `data/raw/icons/`.
- Card images and PDFs: downloaded at build time, never committed.

## Data sources

None of these publishes a license for its data; it is used as published.

| Source | Used for | Location |
| --- | --- | --- |
| [RingsDB](https://ringsdb.com) | Player cards and packs; the icon font (`ringsdb.svg`, `ringsdb-app.css`) | `data/raw/ringsdb/`, `data/raw/icons/` |
| [Hall of Beorn](https://hallofbeorn.com) | Encounter and quest cards, scenarios, card scans | `data/raw/hallofbeorn/`, `.cache/` |
| [DragnCards LotR LCG plugin](https://github.com/seastan/dragncards-lotrlcg-plugin) by seastan | Card database, scenario lists, pre-built decks, game steps, token and card-back images | `data/raw/dragncards/`, `data/raw/icons/dragncards/` |
| [Fantasy Flight Games](https://www.fantasyflightgames.com/en/the-lord-of-the-rings-the-card-game/) | Rules PDFs, print-and-play cards, the icon font in the Dream-chaser rulebook (`mec111-icons.ttf`) | `data/raw/icons/`, `.cache/` |
| JvZijp's enhanced proxies and u/LepcisMagna's scans on [lotr.cardgame.tools](https://lotr.cardgame.tools) | Card pictures | `.cache/` |
| A community Google Drive folder | Nightmare deck pictures and card lists | `data/raw/nightmare/`, `.cache/` |

All sources are pinned by URL and sha256 in `data/sources.json`.

## Fonts

`assets/fonts/` (and the web build's copies in `public/fonts/`): Barlow Semi Condensed (Copyright 2017 The Barlow Project Authors) and Marcellus SC (Copyright 2012 Brian J. Bonislawsky DBA Astigmatic), SIL Open Font License 1.1. License texts: `assets/fonts/BarlowSemiCondensed-OFL.txt`, `assets/fonts/MarcellusSC-OFL.txt`.

## Dependencies

npm dependencies keep their own licenses, in each package under `node_modules/`.
