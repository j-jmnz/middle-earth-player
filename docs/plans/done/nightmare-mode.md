# Plan: Nightmare mode

## Context

User request, 2026-10-30: "Implement nightmare mode for all of the currently available campaigns and scenarios, import all of the cards for future use, they will be sourced from https://drive.google.com/drive/folders/10pz9RF2e1QrJXqsmmLWPkO1Hu1auQuxB, use the eye of sauron icon to distinguish them from other modes, integrate their import, bundling, etc into the current systems."

This replaces the brief's "Do not include ALeP, playtest, or Nightmare cards. Easy and Normal counts only." Nightmare is now a third difficulty. ALeP and playtest cards stay out.

FFG published a Nightmare deck for each scenario of the Core Set to The Lord of the Rings saga: 72 decks. Each deck has a **setup card** and about 8 new encounter cards (a few later decks also have quest cards). The setup card's side B gives the recipe:

1. Begin with the scenario's standard quest deck and encounter deck.
2. Remove the listed cards, in the listed quantities.
3. Shuffle the Nightmare deck's encounter cards into what is left.
4. Flip the setup card to side A ("You are playing Nightmare mode", plus its rules) and place it next to the quest deck. Its effects stay active all game.

## Sources

- **Card text and stats:** Hall of Beorn's exports. The `EncounterCards` and `QuestCards` exports already pinned in `data/raw/hallofbeorn` hold all 637 cards of the 72 decks, as card sets named "<Scenario> Nightmare". No new fetch is needed.
- **Pictures and card lists:** the Google Drive folder the user named (`nightmare` source, `scripts/data/sources/nightmare.ts`). It holds one folder per deck, `<cycle>/<pack>/<scenario>`, with:
  - every card side at about 2348×3200;
  - the setup card as `NNN - <Scenario>.jpg` (side A) and `NNN - Setup.jpg` (side B);
  - the pack's insert as `000 - …` files, which are not cards;
  - a `cardlist.txt`.
  `pnpm data:sync nightmare` does three things:
  - pins the folder listing (`data/raw/nightmare/drive.json`) and each deck's card list (`data/raw/nightmare/<prefix>.txt`);
  - downloads every side into `.cache/pictures`;
  - pins each picture in `data/sources.json` (`nightmare`, paths `pictures/<code>.<side>.<ext>`).

  The folder lacks one side: the back of Raid on the Grey Havens' setup card. That side has no picture, so its card shows its text.
- **The Eye of Sauron:** no source carries FFG's printed Nightmare mark as a vector. game-icons.net's "Burning eye" (CC BY 3.0) was considered and set aside: it reads as a flame ring, not the Eye. The icon `nightmare` is drawn for the app in `scripts/data/icons.ts`, after the printed mark: an almond eye with a slit pupil under a crown of flame.

## Codes

Hall of Beorn reuses the codes of each deck's cycle for its Nightmare cards: 02002 is both Ungoliant's Spawn and The Hunt for Gollum's card 2. RingsDB does not list Nightmare cards. A Nightmare card's code is its deck's prefix plus its two-digit collector number:
- `scripts/data/nightmare-defs.ts` is a hand-checked table, one row per deck.
- The prefix is `9` followed by the deck's position, in FFG's release order.
- Ungoliant's Spawn is 900102. A Shadow of the Past's setup card is 906101.

A row never moves. A new deck is appended. Every card is printed in the pack `Nightmare` (`data/cards/Nightmare.json`). Hall of Beorn's types `Encounter_Side_Quest` and `Ship_Enemy` are built as `encounter-side-quest` and `ship-enemy`; neither is deck-legal.

## Scenario data

`data/scenarios/<id>.json` gains `nightmare` for each built scenario that has a deck (all but The Oath and The Caves of Nibin-Dûm, which have none). The build reads it from the setup card (`scripts/data/normalize/nightmare.ts`):
- `setupCard`;
- `removed`: each listed title resolved to the scenario's card, with the copies taken from each pile. Copies come from the encounter deck first, then from the piles the quest's Setup fills from it;
- `cards`: the deck's own cards with their printed copies.

A removed copy taken from a Setup pile leaves its slot to the Nightmare card of the same title. Nightmare Fell Rider is staged one per player, and Nightmare Weathertop and Ford of Bruinen are set aside, as the cards they replace. The setup card is applied before the quest's Setup, so the Setup's searches find the Nightmare cards. With no card of that title, the slot stays empty: Journey in the Dark removes all four Mines of Moria, the staged one included. A title the scenario does not deal, more copies than it deals, or a deck with quest cards (none of the nine) is a build problem.

`placementsAt(data, "Nightmare")` (`src/catalog/scenario-data.ts`) turns the Normal piles into the Nightmare ones, so `encounterCodes` and `setupInstructions` deal Nightmare as they deal Easy and Normal.

## Engine

- `Difficulty` is `"Easy" | "Normal" | "Nightmare"` (`DIFFICULTIES`). Saves accept it.
- On Nightmare, `buildStart` names the setup card (`definition.nightmareCard`). `startScenario` places it, side A, in a new in-play zone `nightmare` next to the quest deck. It is not the campaign card: the `campaign` condition and the campaign tokens do not see it.
- The setup card's side A lines are effect records like any other. That covers:
  - constants ("All Troll enemies gain…", "The players cannot win while Ford of Bruinen is in play");
  - Forced effects;
  - a Setup line (The Ring Goes South: set each Pale-green Tentacle aside).

## Gating

`NIGHTMARE_PLAYABLE` (`src/campaign/playable.ts`) lists the playable scenarios whose Nightmare cards and setup card have a record for every printed line. The effect coverage test holds it to that, both ways, as it does `PLAYABLE_SCENARIOS`.

The briefing offers Nightmare only for those scenarios, and a deal on Nightmare elsewhere is refused (`difficultyProblems`). Nightmare is allowed in Campaign Mode and in standalone play. The setup card does not change the campaign rules, and the Rules Reference sets no limit.

## Screens

- The difficulty switch on both briefings gets a third segment, **Nightmare**, with the Eye in threat red before the word (`Segmented`'s `icons`), and a note on what it changes.
- The encounter list gains the Nightmare deck's set, and the rules chips gain "Nightmare setup card".
- A standalone game's line in the list names the difficulty, with the Eye on Nightmare.

## Printed text and effects

Every built scenario's Nightmare deck is in the ledger's scan scope: `dealtCodes` includes it, and `nightmareCodes` names it alone. Its scan is the Drive picture (`scanTargets`), with Hall of Beorn's image as the fallback. The ledger entries live in `data/printed/nightmare.json`.

From there it is the per-scenario procedure of phases 29 to 33, one scenario at a time:
1. `pnpm effects:draft <scenario>` lists the Nightmare lines no record owns.
2. The `effect-author` agent writes the records.
3. The scenario joins `NIGHTMARE_PLAYABLE`.

## Phases

- **34. Nightmare data and pictures:** cards, codes, scenario `nightmare` blocks, the `nightmare` source, the picture pins and their bundling, the Eye icon.
- **35. Nightmare difficulty:** the engine's deal and setup card, saves, the briefing picker, the game list, gating.
- **36 onward. Nightmare effects, one scenario each:** the ledger entries and records of each deck, in the order of `PLAYABLE_SCENARIOS`: A Shadow of the Past, A Knife in the Dark, Flight to the Ford, The Ring Goes South, Passage Through Mirkwood, Journey Along the Anduin, Escape from Dol Guldur.
