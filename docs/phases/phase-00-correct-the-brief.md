# Phase 0 — Correct the brief

Depends on: nothing
Blocks: every later phase

## Goal

Make `docs/brief.md` and `README.md` agree with the MEC109 booklet and the core-set Learn to Play, and with each other. No application code.

`docs/brief.md` stays the source of truth. These phase files carry the corrections. If a later phase still finds the old wording, stop and finish this phase.

## Edits

README links to `docs/brief.md` for product rules and `docs/architecture.md` for structure. If a link still names `IMPLEMENTATION.md` or a root `ARCHITECTURE.md`, point it at those paths.

Replace mixed outcome words. In the app and in the brief, a finished scenario is `won` or `lost`. The booklet's "players defeat the scenario" means `won`. A loss writes nothing and stays current. A win runs that scenario's resolution, then unlocks the next id.

Setup, in this order:

1. Shuffle decks. Place heroes. Starting threat is the sum of the dealt heroes' threat costs, plus the log's threat modifier.
2. Search out player cards with Setup and resolve them before the opening hand.
3. Draw 6. One mulligan: shuffle the hand back and draw 6. No second mulligan.
4. Search out encounter cards with Setup and resolve them before the quest card's Setup.
5. Run the quest card's Setup, then flip to side B.

Quest resolution compares committed willpower with staging threat. The active location is not in staging and does not add threat. Progress that would go on the quest goes on the active location first. Overflow goes on the quest. A shortfall raises that seat's threat by the difference. Scenario 6 stage 2B may override this. The core round does not.

Engagement: each seat may optionally engage one enemy, then seats repeat engagement checks in order until no enemy still in staging has an engagement cost at or below that seat's threat.

Adding a card to a zone is not revealing it. Hide runs when a card with Hide is revealed. The setup Black Rider in scenario 1 is added to staging and does not take a Hide test.

Saved decks stay at exactly three heroes. The briefing builds a scenario loadout. The first seat's loadout has exactly one Fellowship-sphere Ring-bearer. That hero does not count toward the hero limit once The One Ring is attached. A fourth hero is legal only when the extra hero is that Ring-bearer. The slot is required when the saved deck has no Ring-bearer, and unused when it already has one. MEC109 says Frodo is the only Ring-bearer in this box. Do not insert a Frodo the player did not choose. Run the three-hero rule on the saved deck. Run the saga rules on the loadout.

A save has its own id. `fellowship-of-the-ring` is the campaign id. Heroes and fallen heroes are stored per seat.

The Fellowship six scenario ids and their order stay fixed. The log shows those six now. Later saga rows are filled from each later booklet. Do not store the other twelve names from this brief as a canonical order.

The pool holds earned cards that are not attached. A Permanent boon or burden is attached to one hero when it is earned, and that hero is recorded on the log. It is not left in the pool. Say what happens to the unchosen resolution card.

Fixtures stay codes and counts, with no card text. Card rows come from RingsDB. The fixture only selects codes. Name a source for The One Ring if the payload has no row. Step 3's setup lines are frozen only after they are read on the quest card. Hall of Beorn is a reading aid.

Unique cards may appear in two saved decks. A second unique with the same title cannot enter play. The Gandalf-to-Elrond note on the paired starters stays a note. Do not mutate either saved deck. Do not reject the pair for sharing Faramir, Steward of Gondor, or Celebrían's Stone.

Indestructible and Toughness are defined in MEC109 for enemies. Keep that scope unless a card in this box prints the keyword on something else. Cite the card if you widen it.

The effect model is one interpreter. It must be able to grow verbs. Scenario 1 needs static modifiers, a response trigger event, cancel, and delayed instructions, not only the framework verbs listed today. Record, from the quest card and Learn to Play pages 28–30, when Gandalf's Delay's "draw 1 less" applies. Do not guess.

Lists and the inspect screen use `expo-image`. The table is one Skia canvas and decodes with Skia. `expo-image` does not decode table cards.

Open `catalog.db` and `user.db` as two handles. Do not nest `SQLiteProvider` as the only way to reach both. `useSQLiteContext` returns the nearest provider.

1,039 official rows had an `imagesrc` on the fetch date in the brief. About 420 MB is the player-card subset. Quest and encounter images are extra files in the same cache.

Exactly three heroes, at least 50 other cards, and at most three copies are the proof-of-concept save rules. Official contract decks that change those numbers are a known limit. Do not invent contract support in this pass.

The coverage job builds `catalog.db` before Vitest. The database stays gitignored.

Pin Expo SDK 57 at 57.0.17 or later. Do not move to SDK 58 in these phases.

Remove the step 4 debug resolution button before the table phase is done. Say that in the build order.

## Exit

`docs/brief.md` contains one wording for each item above. The README links resolve. No `src/` tree exists yet.
