import type { Ask } from "../asks.ts";

// The choice words of the picks the engine asks in temple-of-the-deceived: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario temple-of-the-deceived --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=temple-of-the-deceived` prints each sentence.
// The first player answers for the group at a tie, so those sentences are not owned (the sheet adds who chooses).
export const ASKS: Readonly<Record<string, Ask>> = {
  "12076:forced:1 @0 PickHighestThreat": { note: "{card}: players are tied for the highest threat. Choose the player it engages. It is then dealt 2 shadow cards.", verb: "Engage" },
  "11197:campaignSetup:1 @10 TradeDamageForThreat": { owned: true, note: "Campaign Setup: you may deal 1 damage to a character you control to lower your threat by 1. Each character in play is offered in turn.", verb: "Trade" },
};
