# Phase 9 — Starter effects

Depends on: phase 8
Blocks: phase 11
Can run beside: phase 10

## Goal

Both seeded starter decks are fully automated. A printed ability on a card in either list has an effect id. No table yet.

The seeds are Stealth and Steadfastness (Sam, Merry, Pippin) and Wisdom and Wizardry (Gandalf, Théodred, Éowyn), as resolved to RingsDB codes in phase 6.

## How to author

Work in mechanism batches. Each batch is green before the next starts. Ask `/reviewer` to review that batch before the next starts. The phase stays `active` until the last batch. Reuse verbs added in phase 8. Add a verb when a card in these lists needs one. Keep a single interpreter. Pass the records into the reducer. Do not import `src/effects` from `src/rules`.

1. Static modifiers and keyword-only cards. Hobbit Cloak, Dagger of Westernesse, Celebrían's Stone, Horn of Gondor, and any list card whose text is only a printed number change.
2. Simple actions and responses. Ever Vigilant, Common Cause, Quick Strike, Feint, Valiant Sacrifice, Halfling Determination, and the resource or ready effects that fit the same shape.
3. Cancel, look-at, and search. A Test of Will, Hasty Stroke, Henamarth Riversong, Frodo's Intuition, Galadriel, and the Gandalf ally's look.
4. Temporary play, play from discard, and delayed triggers. Sneak Attack, Stand and Fight, Dwarven Tomb, Elf-stone, Erebor Hammersmith, Unexpected Courage.
5. The remaining hero and attachment sentences. Sam, Merry, Pippin, Gandalf, Théodred, Éowyn, Bilbo, Gandalf's Staff, Wizard Pipe, Fellowship of the Ring, Flame of Anor, Steward of Gondor, Grim Resolve, The Galadhrim's Greeting, Northern Tracker, and whatever the batches above did not cover.

If you cannot point at the booklet, the card, or the Learn to Play for a timing, do not write the effect. Leave coverage red and name the card.

A player card that is in neither starter and not dealt by the scenario stays inactive. Printed cost and combat numbers, plus implemented keywords, still work. The unique sentence is shown, not offered, and there is no sheet on which the player applies it.

## Exit

The coverage test loads the scenario 1 decks and both starter decks, and every listed ability has an effect id. A deck that also contains some other official card does not fail the test. `vitest` is green. No table component exists.
