import type { Ask } from "../asks.ts";

// The choice words of the picks the engine asks in the-ring-goes-south: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-ring-goes-south --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-ring-goes-south` prints each sentence.
// The first player answers for the group at a tie, so those sentences are not owned (the sheet adds who chooses).
export const ASKS: Readonly<Record<string, Ask>> = {
  "142020:forced:1 @0 AssignFaceup": { note: "{card}: assign the faceup cards one at a time. Play 1 at no cost, add 1 to its owner's hand, discard 1 and shuffle 1 into its owner's deck.", verb: "Assign" },
  "142036:whenRevealed:1 @0 AttachToActiveLocation": { note: "{card}: choose the active location it attaches to. No more than 3 progress can be placed on that location each round.", verb: "Attach" },
  "142038:whenRevealed:1 @0.attack.0 PickHighestEngagement": { owned: true, note: "{card}: Warg enemies in the staging area are tied for the highest engagement cost. Choose the one that attacks you.", verb: "Choose" },
  "906407:whenRevealed:1 @0.engage.0 PickLowestEngagement": { owned: true, note: "{card}: enemies in the staging area are tied for the lowest engagement cost. Choose the one you engage. Then reveal an encounter card.", verb: "Engage" },
};
