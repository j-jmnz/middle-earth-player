import type { Ask } from "../asks.ts";

// The choice words of Return to Mirkwood (shadows-of-mirkwood part 6), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario return-to-mirkwood --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=return-to-mirkwood` prints each sentence.
// Who guards Gollum: the first player chooses at Setup; the guard chooses a new player at the end of the round (02130:A:2), after Wood Elf Path, and when a Tantrum says so. The other Picks and Chooses of the scenario read well in the chain's words.
export const ASKS: Readonly<Record<string, Ask>> = {
  // 02126:A:1 (Setup): the first player chooses the player who guards Gollum.
  "02126:setup:1 @0 Pick": { owned: true, note: "{card}: choose a player to guard Gollum. Gollum goes in front of that player: the game is lost if he leaves play or that player is eliminated.", verb: "Choose" },

  // 02130:A:2 (Forced, end of the round): the guard may choose a new player to guard Gollum.
  "02130:forced:1 @1.change.0 Pick": { owned: true, note: "{card}: choose another player to guard Gollum. Gollum goes in front of that player.", verb: "Choose" },

  // 02134:A:1 (Response after travelling): the guard may choose a new player to guard Gollum.
  "02134:response:1 @0 Pick": { owned: true, note: "{card}: choose another player to guard Gollum. Gollum goes in front of that player.", verb: "Choose" },

  // 02135 to 02137:A:1 (When Revealed): after the first part the guard must choose a new player to guard Gollum.
  "02135:whenRevealed:1 @1.change.0 Pick": { owned: true, note: "{card}: choose a new player to guard Gollum. Gollum goes in front of that player.", verb: "Choose" },
  "02136:whenRevealed:1 @1.change.0 Pick": { owned: true, note: "{card}: choose a new player to guard Gollum. Gollum goes in front of that player.", verb: "Choose" },
  "02137:whenRevealed:1 @1.change.0 Pick": { owned: true, note: "{card}: choose a new player to guard Gollum. Gollum goes in front of that player.", verb: "Choose" },

  // 02130:A:2: whether the guard passes Gollum on.
  "02130:forced:1 @1 Choose": { owned: true, note: "{card}: your threat has gone up by 3. You may choose another player to guard Gollum." },
  "02130:forced:1 @1 change": { label: "Choose another player to guard Gollum" },
  "02130:forced:1 @1 keep": { label: "Keep guarding Gollum" },

  // 02135 to 02137:A:1: the part the guard must do last (a single branch: the choice is made if any other player can take Gollum).
  "02135:whenRevealed:1 @1 Choose": { owned: true, note: "{card}: you must choose a new player to guard Gollum." },
  "02135:whenRevealed:1 @1 change": { label: "Choose a new player to guard Gollum" },
  "02136:whenRevealed:1 @1 Choose": { owned: true, note: "{card}: you must choose a new player to guard Gollum." },
  "02136:whenRevealed:1 @1 change": { label: "Choose a new player to guard Gollum" },
  "02137:whenRevealed:1 @1 Choose": { owned: true, note: "{card}: you must choose a new player to guard Gollum." },
  "02137:whenRevealed:1 @1 change": { label: "Choose a new player to guard Gollum" },

  // 900901:A:2 (Forced, beginning of the quest phase): the guard picks an option he can fully resolve.
  "900901:forced:1 @0 Choose": { owned: true, note: "{card}: exhaust a ready hero you control, or resolve the topmost Tantrum's When Revealed from the encounter discard pile." },
  "900901:forced:1 @0 exhaust": { label: "Exhaust a ready hero you control" },
  "900901:forced:1 @0 tantrum": { label: "Resolve the topmost Tantrum's When Revealed" },

  // 900904:A:1 (When Revealed): the guard exhausts a hero or the enemy gains surge.
  "900904:whenRevealed:1 @0 Choose": { owned: true, note: "{card}: choose one you can resolve: exhaust a ready hero you control, or {card} gains surge." },
  "900904:whenRevealed:1 @0 exhaust": { label: "Exhaust a ready hero you control" },
  "900904:whenRevealed:1 @0 surge": { label: "{card} gains surge: reveal 1 more encounter card" },

  // 900909:A:1 (When Revealed): the guard reveals the topmost Tantrum from the discard pile or 2 additional encounter cards.
  "900909:whenRevealed:1 @0 Choose": { owned: true, note: "{card}: choose one you can resolve: reveal the topmost Tantrum in the encounter discard pile, or reveal 2 additional encounter cards." },
  "900909:whenRevealed:1 @0 tantrum": { label: "Reveal the topmost Tantrum in the encounter discard pile" },
  "900909:whenRevealed:1 @0 reveal": { label: "Reveal 2 additional encounter cards" },
};
