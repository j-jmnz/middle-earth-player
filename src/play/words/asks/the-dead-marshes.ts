import type { Ask } from "../asks.ts";

// The choice words of The Dead Marshes (shadows-of-mirkwood part 5), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-dead-marshes --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-dead-marshes` prints each sentence.
// The first player chooses the player who makes the last escape test. The Mere's two picks have a single card each, so no sheet asks them; they carry words for the allowlist.
export const ASKS: Readonly<Record<string, Ask>> = {
  // 02106:B:1 (Forced): the first player chooses the player who makes the escape test that captures Gollum.
  "02106:forced:1 @0 Pick": { owned: true, note: "{card}: choose the player who makes the escape test to capture Gollum, one card dealt for each token on him. Failing resets the quest.", verb: "Choose" },

  // 02108:A:1 (When Revealed): each player in turn, the first player first, may exhaust a Lore hero they control so the card places 1 token instead of 2; one reduction at most.
  "02108:whenRevealed:1 @1.0 Choose": {
    owned: true,
    note: "{card}: 2 resource tokens go on Gollum (on the Mere of Dead Faces while he is out of play). Exhaust a Lore hero you control to place 1 instead?",
  },
  "02108:whenRevealed:1 @1.0 reduce": { label: "Exhaust a Lore hero: place 1 resource token instead" },
  "02108:whenRevealed:1 @1.0 keep": { label: "Keep: place 2 resource tokens" },
  "02108:whenRevealed:1 @1.0.reduce.0 Pick": { owned: true, note: "{card}: choose a ready Lore hero you control to exhaust. The tokens it places drop to 1.", verb: "Exhaust" },

  // 900808:A:1 (When Revealed): each player in turn who fails their escape test raises their own threat by 5 or discards a hero they control.
  "900808:whenRevealed:1 @0.1 Choose": { owned: true, note: "{card}: you failed the escape test. Raise your threat by 5, or discard a hero you control from play." },
  "900808:whenRevealed:1 @0.1 threat": { label: "Raise your threat by 5" },
  "900808:whenRevealed:1 @0.1 discard": { label: "Discard a hero you control" },
  "900808:whenRevealed:1 @0.1.discard.0 Pick": { owned: true, note: "{card}: choose a hero you control to discard from play. It goes to your discard pile.", verb: "Discard" },

  // 900806:A:1 (Forced): after it is destroyed, the first player chooses the hero, of any player, that carries it.
  "900806:forced:1 @0 AttachSelf": { owned: true, note: "{card}: choose a hero with 1 or more Willpower, any player's, to carry it. The hero's Willpower becomes 0.", verb: "Attach" },

  // 900802:A:3 (Forced): the Mere is the card whose tokens move, Gollum the one that receives them.
  "900802:forced:1 @1 Pick": { note: "{card}: its resource tokens move to Gollum." },
  "900802:forced:1 @2 Pick": { note: "{card}: Gollum receives every resource token on The Mere of Dead Faces." },
};
