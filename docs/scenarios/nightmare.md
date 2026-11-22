# Nightmare

The rulings, readings and table pieces of Nightmare, scenario by scenario. Product rules, the Domain and the Core round are in `docs/brief.md`; the authority order is in `.claude/rules/authority.md`.

User request, 2026-10-30: Nightmare mode for the scenarios the app has, every Nightmare card imported for later, pictures from the Google Drive folder the user named, and the Eye of Sauron to mark the mode.

- Every Nightmare deck of Hall of Beorn's exports is built (`data/cards/Nightmare.json`, pack `Nightmare`), whether or not the app has their scenario. Hall of Beorn reuses each cycle's codes for them, so a Nightmare card's code is its deck's prefix and its collector number (`scripts/data/nightmare-defs.ts`, a hand-checked row per deck, appended, never moved): Ungoliant's Spawn is 900102. Hall of Beorn's types `Encounter_Side_Quest` and `Ship_Enemy` are built as `encounter-side-quest` and `ship-enemy`, not deck-legal.
- Each built scenario with a deck carries it as `nightmare` in `data/scenarios/<id>.json`: the setup card, the copies side B removes (resolved by title to the scenario's cards, pile by pile) and the deck's cards with their piles (`scripts/data/normalize/nightmare.ts`). A removal the scenario cannot satisfy is a build problem.
- The Eye of Sauron (`nightmare` icon) is drawn for the app after the mark FFG prints on Nightmare cards (`scripts/data/icons.ts`); no source has it as a vector. It stands before the word Nightmare on the briefing's difficulty switch and a game's line in the Scenarios list, and in the table's top bar, where it opens the setup card.
- The Nightmare cards' lines are effect records like any card's, read from the ledger (`data/printed/nightmare.json`, from the Drive pictures). A scenario offers Nightmare once its deck's lines are all owned (`NIGHTMARE_PLAYABLE`).
- A Nightmare card that names the enemies "in play" counts or protects an enemy in the staging area as well as an engaged one (rr.in-play-and-out-of-play): Pale-green Tentacle, Weathertop, Expanse of Hollin and Great East Road.
- The part of a Nightmare card after "Then" is not attempted when the part before it could not resolve (rr.then): The Old Road and Pathless Wilderness with no resource token left to discard.
- The Twilight World (906309:A:2): "Limit 1 per hero" counts the copy already attached to the Ring-bearer, which an encounter card makes an attachment no player controls.
