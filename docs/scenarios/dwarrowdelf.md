# Dwarrowdelf

The rulings, readings and table pieces of Dwarrowdelf, scenario by scenario. Product rules, the Domain and the Core round are in `docs/brief.md`; the authority order is in `.claude/rules/authority.md`.

The second cycle (2012): the Khazad-dûm deluxe expansion (Into the Pit, The Seventh Level, Flight from Moria; pack `KD`) and the six Adventure Packs The Redhorn Gate, Road to Rivendell, The Watcher in the Water, The Long Dark, Foundations of Stone and Shadow and Flame (`TRG`, `RtR`, `WitW`, `TLD`, `FoS`, `SaF`). Like Shadows of Mirkwood it is `kind: "cycle"` (`data/campaigns/dwarrowdelf.json`): no campaign card, no booklet, no Campaign Mode, every game standalone on Easy, Normal and Nightmare (user decision, 2026-11-16, for the cycle's nine scenarios). It lists under Coming later until one scenario is playable (`src/campaign/playable.ts`). The cycle is data: `scripts/data/campaign-defs.ts` (its seven products and nine scenarios, with the DragnCards decks `Q02.n` and `E02.n`), `scripts/data/normalize/setup-cycles.ts` (one reader of Setup sentences for every cycle), and the folder of its id for authored effects and seed finders (`scripts/data/effects/authored-paths.ts`, `seed-finder-paths.ts`); `scripts/data/cycles.test.ts` holds what every cycle shares and `scripts/data/dwarrowdelf.test.ts` this one's piles, counts and Nightmare decks.

- **Data.** Each scenario file has no `campaignCard` and a `nightmare` block for decks 9010 to 9018 (`scripts/data/nightmare-defs.ts`). The rules inserts are pinned as rules docs with `dwd.*` spans: the Khazad-dûm insert (`kd`, MEC08) holds the three scenarios' encounter sets (`dwd.setup-<scenario id>`) and special rules, and each Adventure Pack's rulesheet (`trg`, `rtr`, `witw`, `tld`, `fos`, `saf`) its own; all have a text layer. The piles are the DragnCards load lists' (Q02.1 to Q02.9, E02.1 to E02.9), checked against the stage 1A card's printed Setup. Cave Torch (Into the Pit, The Long Dark, Foundations of Stone) and Book of Mazarbul are attached to a hero at Setup (`attachedChosen`, `data/overrides.json`, `scenarioPiles`); Arwen Undómiel is set aside until Setup puts her into play under the first player (`groups`); Foundations of Stone's own encounter set is its second encounter deck (`encounterDeck2`). The seven stage 2 cards of Flight from Moria (all titled Search for an Exit) and the four stage 4 cards of Foundations of Stone (Below the Mines) are dealt in no printed order, so the load list's order may differ from Hall of Beorn's within a stage number.
- **Nightmare removals.** A setup card's list names the quest cards it takes out of the quest deck too (Into the Pit's Goblin Patrol, Road to Rivendell's "Orc Outpost (quest stage 2)", Flight from Moria's Blocked by Shadow, a stage 2 card named by its side B title) and, for Foundations of Stone, cards of the set-aside encounter set: `nightmare.removed` carries them with the piles `quest` and `encounterDeck2` (`NIGHTMARE_PILES`). `questDeckCodes` (`src/catalog/scenario-data.ts`) applies the quest removals: a Nightmare quest card takes the place of the first stage the setup card removes, and one that removes none follows the stages. The Nightmare deck's cards with the Foundations of Stone set icon are in the `encounter` pile (the icon is on the picture, in no source).
- **Readings.** Each scenario adds a `###` subsection below for what its cards and rulesheet leave open, with its sources (`.claude/rules/authority.md`, Open points).
- Wrapped! (The Watcher in the Water, #76): Hall of Beorn gives it the code 04076, RingsDB's Háma of The Long Dark, so the build dropped it; its code is the six-digit 040076 (`data/overrides.json`, `productCodes`). Agent recommendation: no source gives another code.
- Encounter sets, The Long Dark and Foundations of Stone: the rulesheets list Hazards of the Pit for The Long Dark (Hall of Beorn and the DragnCards load list deal Deeps of Moria) and Deeps of Moria for Foundations of Stone (the lists deal Hazards of the Pit). The built piles follow the lists, which the printed Nightmare removals agree with (Stray Goblin and Abandoned Mine are Deeps of Moria's, Cave In is Hazards of the Pit's); agent recommendation, no official ruling found, not confirmed by the user.
- Printed over Hall of Beorn's text, read from the scans (`data/printed/dwarrowdelf.json`, `nightmare.json`): lines Hall of Beorn runs together are split; the Nightmare Shadow and Flame setup card names the Shadow and Flame scenario (Hall of Beorn: Foundations of Stone); Trapdoor Spider's Forced line and Chill of the Roots' Shadow line are on the cards and not in Hall of Beorn's text; Foundations of Stone's setup card prints "Mitril Lode" for Mithril Lode.

## Scenario files

- `docs/scenarios/dwarrowdelf/into-the-pit.md`: Into the Pit
- `docs/scenarios/dwarrowdelf/the-seventh-level.md`: The Seventh Level
- `docs/scenarios/dwarrowdelf/flight-from-moria.md`: Flight from Moria
- `docs/scenarios/dwarrowdelf/the-redhorn-gate.md`: The Redhorn Gate
- `docs/scenarios/dwarrowdelf/road-to-rivendell.md`: Road to Rivendell
- `docs/scenarios/dwarrowdelf/the-watcher-in-the-water.md`: The Watcher in the Water
- `docs/scenarios/dwarrowdelf/the-long-dark.md`: The Long Dark
- `docs/scenarios/dwarrowdelf/foundations-of-stone.md`: Foundations of Stone
- `docs/scenarios/dwarrowdelf/shadow-and-flame.md`: Shadow and Flame

## Readings to confirm

Readings not yet confirmed by the user (`.claude/rules/authority.md`, Open points). Delete a line when the user confirms it.

- Readings not user-confirmed (`docs/scenarios/dwarrowdelf.md`, Dwarrowdelf): Wrapped!'s code 040076, and The Long Dark and Foundations of Stone dealing the encounter sets their load lists give where the rulesheets swap Hazards of the Pit and Deeps of Moria.
- Burning Low (03040:A:1) reads Dark once, when it resolves: a location that turns Dark later in the phase does not get the +2 (agent recommendation; re-reading needs effects in `modifiedStat`).
- With two Blinding Blizzards (901307) the first in staging takes the progress, with no first-player choice between them; Blinding Blizzard's progress readout ("3 / 5") does not warm near 5 (agent recommendation, `docs/scenarios/dwarrowdelf/the-redhorn-gate.md`, The Redhorn Gate).
