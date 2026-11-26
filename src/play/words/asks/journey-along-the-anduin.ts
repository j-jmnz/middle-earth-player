import type { Ask } from "../asks.ts";

// The choice words of the picks the engine asks in journey-along-the-anduin: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario journey-along-the-anduin --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=journey-along-the-anduin` prints each sentence.
// The first player answers for the group at a tie, so those sentences are not owned (the sheet adds who chooses).
export const ASKS: Readonly<Record<string, Ask>> = {
  "900203:forced:1 @0 EngageSeatWith": { note: "{card}: several players are engaged with a Hill Troll. Choose the player it engages.", verb: "Engage" },
  "900207:whenRevealed:1 @0 PickMostHitPoints": { note: "{card}: enemies in the victory display and the encounter discard pile are tied for the most hit points. Choose the one that returns to the staging area.", verb: "Return" },
};
