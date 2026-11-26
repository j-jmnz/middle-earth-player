import type { Ask } from "../asks.ts";

// The choice words of Beneath the Sands (haradrim part 6), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario beneath-the-sands --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=beneath-the-sands` prints each sentence.
export const ASKS: Readonly<Record<string, Ask>> = {
  // 17073:whenRevealed:1 (Forced Off Track, whenRevealed): When Revealed: Either flip the Search objective to Off Track, or deal 1 damage to each questing character.
  "17073:whenRevealed:1 @0 flip": { label: "Flip the Search objective to Off Track" },
  "17073:whenRevealed:1 @0 damage": { label: "Deal 1 damage to each questing character" },
  // 17079:forced:1 (Off Track, forced): Forced: At the end of the quest phase, place 1 resource here. Then, either return the topmost location in the encounter discard pile to the staging area, or raise each player's threat by 1 for each resource here.
  "17079:forced:1 @1 location": { label: "Return the topmost location in the encounter discard pile to the staging area" },
  "17079:forced:1 @1 threat": { label: "Each player raises their threat by 1 for each resource here" },

  // 17065:forced:2 (Brood Mother): at the end of the round, a Spider Broodling from the encounter deck or discard pile joins the staging area.
  "17065:forced:2 @0 SearchMove": { note: "Brood Mother: choose a Spider Broodling in the encounter deck or discard pile to add to the staging area.", verb: "Add" },

  // 17071:shadow:1 (shadow): the defending player exhausts a character.
  "17071:shadow:1 @0 Pick": { owned: true, note: "{card}: choose a character you control to exhaust.", verb: "Exhaust" },

  // 17072:shadow:1 (shadow): the defending player discards an attachment.
  "17072:shadow:1 @0 Pick": { owned: true, note: "{card}: choose an attachment you control to discard.", verb: "Discard" },

  // 17074:forced:1 (Grabbed by Spiders, attached to the main quest): each player discards an ally they control.
  "17074:forced:1 @1.0 Pick": { owned: true, note: "Grabbed by Spiders: choose an ally you control to discard.", verb: "Discard" },
};
