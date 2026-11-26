import type { Ask } from "../asks.ts";

// The choice words of The Antlered Crown (the-ring-maker part 9), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-antlered-crown --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-antlered-crown` prints each sentence.
export const ASKS: Readonly<Record<string, Ask>> = {
  // 08147:setup:1 (Battle for Dunland, setup): Setup: The first player takes control of Chief Turch. Set Raven Chief and Raven Chief's Camp aside, out of play. Reveal 1 copy of Dunland Battlefield and make it the active location. Reveal 1 copy of Raven War-camp and add it to the staging area. Create the Raven deck (see insert) and set it next to the quest deck. Each player chooses 1 different enemy from the Raven deck and adds it to the staging area. Shuffle the encounter deck and Raven deck.
  "08147:setup:1 @3.0 Pick": { owned: true, note: "Setup: choose an enemy from the Raven deck with a different title from the others chosen. It joins the staging area.", verb: "Add" },
  // 08154:whenRevealed:1 (Raven Skirmisher, whenRevealed): When Revealed: Either remove 1 time counter from the active location, or reveal an additional encounter card.
  "08154:whenRevealed:1 @0 Choose": { note: "Raven Skirmisher: remove 1 time counter from the active location, or reveal an additional encounter card." },
  "08154:whenRevealed:1 @0 time": { label: "Remove 1 time counter from the active location" },
  "08154:whenRevealed:1 @0 reveal": { label: "Reveal an additional encounter card" },
  // 08153:shadow:1 (Raven Warrior): the defender discards one of his own attachments.
  "08153:shadow:1 @0 Pick": { owned: true, note: "Raven Warrior shadow: choose an attachment you control to discard.", verb: "Discard" },
  // 08157:forced:1 (Dunland Battlefield): each player assigns damage equal to the cards in his hand.
  "08157:forced:1 @0.0 AssignDamage": { owned: true, note: "Dunland Battlefield: assign damage among characters you control, one for each card in your hand ({left} left).", title: "{card}: assign {left}", verb: "Assign" },
  // 08158:shadow:1 (Raven Country): the defender assigns the printed Time X of the active location.
  "08158:shadow:1 @0 AssignDamage": { owned: true, note: "Raven Country's shadow: assign damage among characters you control, as many as the Time value of the active location ({left} left).", title: "{card}: assign {left}", verb: "Assign" },
};
