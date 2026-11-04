# Phase 9 — Starter effects

Depends on: phase 8c
Blocks: phase 11
Can run beside: phases 8d and 10

## Goal

Both seeded starter decks are fully automated. Every printed line on a card in either list is owned by an effect record, an implemented keyword, or an `inert` ledger entry. No table yet.

The seeds are Stealth and Steadfastness (Sam, Merry, Pippin) and Wisdom and Wizardry (Gandalf, Théodred, Éowyn).

## Starter lists are data

Move the two lists out of `src/screens/deck/starter-decks.ts` into `data/campaigns/fellowship-of-the-ring.json` as `starterDecks`, with the code chosen for each row and the MEC109 span that prints the list. A test checks each row's name and count against that span. The seed script reads the file. The Gandalf-to-Elrond note stays a note.

## Keywords

Implement `Restricted` once in `src/rules`, citing its span: a character with a third restricted attachment discards one to its owner's discard pile. Sting, Glamdring, Andúril and the starter attachments need it. Ranged and sentinel already exist.

## Templates first

Add player-card sentence templates to `scripts/data/effects/templates.ts` before authoring. They match whole ledger lines only. Candidates: "Attached hero/character gets +N [stat]", "Response: After …, ready …", "Action: Exhaust … to …", "Planning/Quest/Combat Action:" (an action limited to a phase), "Limit once per round/phase", and "Play only …". `pnpm data:build` reports how many lines each template took.

Then run `pnpm effects:draft` for the starter decks (extend it to take a deck id as well as a scenario id) and the `effect-author` agent on what is left.

## Batches

Each batch is green and reviewed by `/reviewer` before the next. Reuse the phase 8 verbs. Add a verb only when a line in these lists needs it, with one interpreter. Pass the records into the reducer. `src/rules` does not import `src/effects`.

1. Static modifiers, keyword-only cards, and Restricted. Hobbit Cloak, Dagger of Westernesse, Celebrían's Stone, Horn of Gondor, and any card whose lines are only a stat change.
2. Simple actions and responses. Ever Vigilant, Common Cause, Quick Strike, Feint, Valiant Sacrifice, Halfling Determination, and resource or ready effects of the same shape.
3. Cancel, look-at, and search. A Test of Will, Hasty Stroke, Henamarth Riversong, Frodo's Intuition, Galadriel, and the Gandalf ally's look.
4. Temporary play, play from discard, and delayed triggers. Sneak Attack, Stand and Fight, Dwarven Tomb, Elf-stone, Erebor Hammersmith, Unexpected Courage.
5. The remaining hero and attachment lines. Sam, Merry, Pippin, Gandalf, Théodred, Éowyn, Bilbo, Gandalf's Staff, Wizard Pipe, Fellowship of the Ring, Flame of Anor, Steward of Gondor, Grim Resolve, The Galadhrim's Greeting, Northern Tracker, and whatever the batches above did not cover.

If no rule span or ledger line fixes a timing, do not write the record. Leave the line unowned and name the card in STATUS.

A player card in neither starter and not dealt by a scenario keeps its printed numbers and implemented keywords. Its unowned lines are inactive: shown, not offered, and no sheet applies them.

## Exit

Ownership coverage is green for scenario 1 and both starter decks. A deck that also holds other official cards does not fail. Each batch adds an auto-player game on fixed seeds with that starter deck to the goldens, and the cause test from phase 8d covers it once 8d is done. `vitest` is green. No table component exists.
