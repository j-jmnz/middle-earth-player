import type { Ask } from "../asks.ts";

// The choice words of The Wizard's Quest (standalone-scenarios part 10), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-wizards-quest --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-wizards-quest` prints each sentence.
// The opposing team's choices (docs/scenarios/standalone-scenarios/the-wizards-quest.md, The Wizard's Quest, readings 1 and 3) are the engine's, never a prompt: they carry no entry. The entries below are the choices a player makes, and the few the engine words for a sheet that may still open.
export const ASKS: Readonly<Record<string, Ask>> = {
  // 51004:B:1 (Carried Away): each player's ally of highest cost lies under the stage.
  "51004:whenRevealed:2 @0.0 Pick": { owned: true, note: "Carried Away: the ally you control with the highest cost lies under the stage. No copy of it can be played.", verb: "Choose" },

  // 51013:A:1 (Necromancer's Pass): the first player keeps a card, and the opposing team lays the highest cost of the others under the Pass.
  "51013:whenRevealed:1 @1 Pick": { owned: true, note: "Necromancer's Pass: choose a card in your hand to keep. The opposing team lays another one under the Pass.", verb: "Keep" },
  "51013:whenRevealed:1 @2 Pick": { note: "Necromancer's Pass: the other card of highest cost lies under the Pass. No copy of it can be played until the Pass is explored.", verb: "Choose" },

  // 51017:A:1 (Smoking Blood): attached to a Troll enemy.
  "51017:whenRevealed:1 @0 AttachSelf": { note: "Smoking Blood: attach it to the Troll enemy with the most hit points left. A Troll that has it is not chosen again.", verb: "Attach" },

  // 51036:A:1 (Befouled Equipment): attached to the character with the most attachments that has no Befouled Equipment.
  "51036:whenRevealed:1 @0 AttachSelf": { owned: true, note: "Befouled Equipment: characters are tied for the most attachments. Choose the one that carries it.", verb: "Attach" },
};
