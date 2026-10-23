# Phase 8 — Scenario 1 effects

Depends on: phases 4 and 7
Blocks: phases 9 and 10

## Goal

A Shadow of the Past is playable in Vitest. Every Setup, Forced, When Revealed, Response, Action, and shadow on its dealt cards has an effect id. Starter-deck sentences may still be inactive.

## Interpreter

Effects are authored records in `src/effects`, grouped by set. They import only `src/catalog`. Pass the effect list into the reducer. The interpreter does not import `src/effects`. Vitest passes the TypeScript records. The build script is the only production writer of the `effects` table. A round-trip test asserts the `catalog.db` ids equal the TypeScript ids.

An effect names a card code, a timing, an optional limit, an optional cost, an optional condition, and instructions. Responses name the trigger event they answer. A `constant` timing appends a record to the phase 7 modifier list. Do not fork combat math. Instructions call engine verbs. Grow the verb set when a dealt card needs a verb. Do not add a second language, a card-text parser, or a manual resolver.

Forced effects in the current window run in timestamp order. Responses are offered and may be passed. A Hide test, a shadow reveal, or a When Revealed pushes a frame and pops it before the parent continues.

Hide, when a card with Hide X is revealed: the revealing seat may exhaust characters it controls to commit them. Discard the top X cards of the encounter deck. Sum committed willpower. Sum the threat of the discarded cards. A treachery adds 0. Then an action window. Then success if willpower is greater than or equal to threat. Then uncommit. The booklet fixture: Hide 3, 2 willpower committed, discarded threat 2 + 2 + 0, an action raises willpower to 4, the test succeeds. Also assert a scripted failure. Hide runs before When Revealed or Forced on that card.

Apply Gandalf's Delay's "draw 1 less" at the timing phase 0 recorded from the quest card and Learn to Play pages 28–30. If that reading is still missing, leave the test red and name the card.

Campaign-dealt cards cannot be inactive. That includes encounter cards, quest cards, boons, burdens, and The One Ring. A missing effect id fails coverage, and the scenario stays unplayable. A player card outside the dealt set and outside the later starter gate does not fail this test.

## Script

Build the Normal encounter deck from the phase 4 fixture and run the quest card's setup. The setup Black Rider is added to staging and does not take a Hide test.

On a win the player chooses one of Gandalf's Delay or The Ring Draws Them, then one of Gildor Inglorion or Mr. Underhill. Look up codes from the catalog build. Do not hardcode a code you have not just read. Each chosen card is recorded once. A loss writes nothing. A second win does not grant the reward again.

Refuse illegal Fellowship loads: two Fellowship heroes, a second Frodo, a missing Ring-bearer. The first seat must control a Fellowship-sphere Ring-bearer the player chose. Attach The One Ring to that hero. It is not a deck card and it does not count against the 50-card minimum. While it is attached, that hero does not count against the hero limit. Only one Fellowship-sphere hero may be in play. No other version of Frodo may be a starting hero or in the deck. Saga Frodo's resource is the ordinary resource-phase gain. His pool may pay Fellowship and neutral costs.

Two-handed: when the first-player token passes, the new first seat gains control of the attached Ring-bearer, the resources in that hero's pool, and every card attached to that hero. If that leaves a seat with no heroes, that seat is eliminated immediately.

## Review batches

Keep this one phase. Each batch is green before the next starts. Ask `/reviewer` to review that batch before the next starts.

1. Window and Hide frame.
2. Quest setup.
3. When Revealed and Forced.
4. Shadows.
5. Resolution and Fellowship loadout checks.

## Exit

`vitest` is green, apart from a Gandalf's Delay test that is still red because the quest card and Learn to Play pages 28–30 are not yet cited. Coverage fails if a dealt card has a printed ability and no effect id. The round-trip test matches effect ids in `catalog.db` to the TypeScript records. The CI job builds `catalog.db` when the cached file is missing or older than the payloads, before that test. No table component exists.
