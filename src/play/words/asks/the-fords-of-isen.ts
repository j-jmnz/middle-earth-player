import type { Ask } from "../asks.ts";

// The choice words of The Fords of Isen (the-ring-maker part 1), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-fords-of-isen --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-fords-of-isen` prints each sentence.
// Every choice here is a player's own (the one the effect names for each player in turn), so two-handed it leads with the player. The hand counts are read when the sheet opens, from the asked player's hand.
const HAND = { hand: true } as const;

export const ASKS: Readonly<Record<string, Ask>> = {
  // 07021:A:2 and 07044:A:2 (Shadow): the defending player discards an attachment he controls (each one if this attack is undefended: no choice then).
  "07021:shadow:1 @0 Pick": { owned: true, note: "Pillaging and Burning's shadow: choose an attachment you control to discard.", verb: "Discard" },
  "07044:shadow:1 @0 Pick": { owned: true, note: "Dunland Raider's shadow: choose an attachment you control to discard.", verb: "Discard" },

  // 07022:A:1 (When Revealed): each player chooses to remove 1 time counter from the current quest, or to search for a Dunland enemy and add it to the staging area.
  "07022:whenRevealed:1 @0.0 Choose": { owned: true, note: "Down from the Hills: remove 1 time counter from the quest, or search for a Dunland enemy to stage." },
  "07022:whenRevealed:1 @0.0 time": { label: "Remove 1 time counter from the current quest" },
  "07022:whenRevealed:1 @0.0 search": { label: "Search for a Dunland enemy and add it to the staging area" },

  // 07044:A:1 (Forced after it engages you): deal X damage divided among your characters, X the cards in your hand. 07049:A:2: 1 damage after you draw. 07060:B:3: X damage, X your hand, after the last time counter.
  "07044:forced:1 @0 AssignDamage": { owned: true, note: "Dunland Raider: assign {x} damage, 1 for each card in your hand, among the characters you control ({left} left).", bind: { x: HAND }, verb: "Assign" },
  "07049:forced:1 @0 AssignDamage": { owned: true, note: "Wild Men of Dunland: you drew cards. Assign 1 damage to a character you control.", verb: "Assign" },
  "07060:forced:1 @0.0 AssignDamage": { owned: true, note: "Dunlending Attack: the last time counter is gone. Assign {x} damage, 1 for each card in your hand, among the characters you control ({left} left).", bind: { x: HAND }, verb: "Assign" },

  // 07059:A:1 (Setup): each player searches the encounter deck for 1 different Dunland enemy and adds it to the staging area.
  "07059:setup:1 @1.0 SearchMove": { owned: true, note: "The Fords of Isen: search the encounter deck for a Dunland enemy with a title no other player took. Add it to the staging area.", verb: "Add" },

  // 07060:B:1 and 07061:A:1 (When Revealed): the same, from the encounter deck and the discard pile.
  "07060:whenRevealed:1 @0.0 SearchMove": { owned: true, note: "Dunlending Attack: search the encounter deck and discard pile for a Dunland enemy with a title no other player took. Add it to the staging area.", verb: "Add" },
  "07061:whenRevealed:1 @0.0 SearchMove": { owned: true, note: "{card}: search the encounter deck and discard pile for a Dunland enemy with a title no other player took. Add it to the staging area.", verb: "Add" },
};
