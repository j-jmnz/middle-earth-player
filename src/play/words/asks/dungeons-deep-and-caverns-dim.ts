import type { Ask } from "../asks.ts";
import { MISTY_MOUNTAIN_GOBLINS_ASKS } from "../misty-mountain-goblins-asks.ts";

// The choice words of Dungeons Deep and Caverns Dim (the-hobbit part 3), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario dungeons-deep-and-caverns-dim --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=dungeons-deep-and-caverns-dim` prints each sentence.
export const ASKS: Readonly<Record<string, Ask>> = {
  // 131070:A:1 (Grip, Grab! Pinch, Nab!, When Revealed, a Misty Mountain Goblins card): each player in turn chooses a Goblin enemy from the encounter discard pile to add to the staging area.
  "131070:whenRevealed:1 @0.0 Pick": { owned: true, note: "Grip, Grab! Pinch, Nab!: choose a Goblin enemy from the encounter discard pile to add to the staging area.", verb: "Add" },

  // The riddle cards the first player may answer when one is revealed from the encounter deck (131075:A:2, 131076:A:2, 131077:A:2, 131080:A:2, 131082:A:2): the choice between the riddle and the card's own effect. The waits that follow are worded by words/scenarios/the-hobbit/riddles.ts.
  "131075:whenRevealed:1 @0 Choose": { owned: true, note: "Great Gray Wolf: answer its riddle, or resolve the card as any other card? The riddle names a card type, a sphere and a cost, then discards the top 3 cards of your deck." },
  "131075:whenRevealed:1 @0 answer": { label: "Answer the riddle: name a card type, a sphere and a cost" },
  "131075:whenRevealed:1 @0 resolve": { label: "Resolve Great Gray Wolf as any other card" },
  "131076:whenRevealed:1 @0 Choose": { owned: true, note: "Wild Wargs: answer its riddle, or resolve the card as any other card? The riddle names a card type, then discards the top 2 cards of your deck." },
  "131076:whenRevealed:1 @0 answer": { label: "Answer the riddle: name a card type" },
  "131076:whenRevealed:1 @0 resolve": { label: "Resolve Wild Wargs as any other card" },
  "131077:whenRevealed:1 @0 Choose": { owned: true, note: "The Wargs' Glade: answer its riddle, or resolve the card as any other card? The riddle names a sphere, then discards the top 1 card of your deck." },
  "131077:whenRevealed:1 @0 answer": { label: "Answer the riddle: name a sphere" },
  "131077:whenRevealed:1 @0 resolve": { label: "Resolve The Wargs' Glade as any other card" },
  "131080:whenRevealed:2 @0 Choose": { owned: true, note: "Come Down Little Bird: answer its riddle, or resolve the card as any other card? The riddle names a card type and a cost, then discards the top 3 cards of your deck." },
  "131080:whenRevealed:2 @0 answer": { label: "Answer the riddle: name a card type and a cost" },
  "131080:whenRevealed:2 @0 resolve": { label: "Resolve Come Down Little Bird as any other card" },
  "131082:whenRevealed:2 @0 Choose": { owned: true, note: "Hiding in the Trees: answer its riddle, or resolve the card as any other card? The riddle names a card type and a sphere, then discards the top 3 cards of your deck." },
  "131082:whenRevealed:2 @0 answer": { label: "Answer the riddle: name a card type and a sphere" },
  "131082:whenRevealed:2 @0 resolve": { label: "Resolve Hiding in the Trees as any other card" },

  ...MISTY_MOUNTAIN_GOBLINS_ASKS,
};
