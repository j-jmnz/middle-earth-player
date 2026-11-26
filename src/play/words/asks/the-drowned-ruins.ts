import type { Ask } from "../asks.ts";

// The choice words of the picks the engine asks in the-drowned-ruins: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-drowned-ruins --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-drowned-ruins` prints each sentence.
// The first player answers for the group at a tie, so those sentences are not owned (the sheet adds who chooses).
export const ASKS: Readonly<Record<string, Ask>> = {
  "11200:campaignSetup:1 @6 TradeDamageForThreat": { owned: true, note: "Campaign Setup: you may deal 1 damage to a character you control to lower your threat by 1. Each character in play is offered in turn.", verb: "Trade" },
  "11203:action:1 @0.spyglass.0.spyglassOutside.0 TakeCardFromCollection": { owned: true, note: "{card}: take Spyglass from outside the game and put it into play, attached to a hero in play.", verb: "Take" },
};
