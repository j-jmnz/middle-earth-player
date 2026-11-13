import type { Condition, PickSpec } from "../../../catalog/boundary.ts";
import type { Ask } from "../asks.ts";
import { DETERMINATION_ASKS, POOL_BOON_ASKS } from "../pool-boon-asks.ts";

// The choice words of The Wastes of Eriador (angmar-awakened part 4), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-wastes-of-eriador --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-wastes-of-eriador` prints each sentence.
// A choice of one player's own (the character Pack Leader exhausts, Predatory Wolves' discard or search, the character a Determination goes to) is owned: two-handed the sentence leads with the player. The first player answers for the group at Nightfall's discard and at Eriador Wastes' Travel,
// so those sentences are not owned and the sheet adds who chooses. Amarthiúl (10016) is an objective ally with no printed cost: Predatory Wolves counts him as cost 0, and discarding him loses the game (10016:A:2), so his row, or the whole discard option when he is the only highest-cost ally, is armed.
// Ruthless (10164) is worded once for every scenario that can deal it (src/play/words/pool-boon-asks.ts).
const WARGS_ENGAGED_WITH_YOU: PickSpec = { type: "enemy", control: "any", engaged: "you", trait: "Warg" };
const AMARTHIUL: PickSpec = { type: "ally", control: "you", names: ["Amarthiúl"] };
const HIGHEST_COST_ALLY: PickSpec = { type: "ally", control: "you", highestCost: true };
// The row Amarthiúl is: discarding him loses the game for every player.
const PICKED_AMARTHIUL: Condition = { kind: "matches", card: "picked", pick: AMARTHIUL };
// Every highest-cost ally the player controls is Amarthiúl: the discard option can only take him.
const ONLY_AMARTHIUL: Condition = { kind: "allMatch", of: HIGHEST_COST_ALLY, match: AMARTHIUL };
const NIGHT: Condition = { kind: "timeOfDay", is: "night" };
const LOSES: string = "Tap again: discarding Amarthiúl loses the game";

export const ASKS: Readonly<Record<string, Ask>> = {
  // 10014:B:2 (Forced when it becomes Night): the first player chooses the non-objective ally to discard, any player's; with 3 or more players the second ally is chosen the same way.
  "10014:forced:2 @0 Pick": { note: "Nightfall: choose a non-objective ally in play, any player's, to discard.", verb: "Discard" },
  "10014:forced:2 @2 Pick": { note: "Nightfall, 3 or more players: choose a second non-objective ally in play, any player's, to discard.", verb: "Discard" },

  // 10017:A:3 (Forced after Pack Leader engages you): exhaust a character you control for each Warg enemy engaged with you, Pack Leader included.
  "10017:forced:1 @0.0 Pick": { owned: true, note: "Pack Leader: exhaust a ready character you control, once for each Warg engaged with you ({x} in all).", bind: { x: { count: WARGS_ENGAGED_WITH_YOU } }, verb: "Exhaust" },

  // 10021:A:1 (Forced after it engages you): deal 1 damage to a character you control, 2 at Night.
  "10021:forced:1 @0 Pick": { owned: true, note: [{ when: NIGHT, text: "White Warg engaged you at Night: choose a character you control to take 2 damage." }, { text: "White Warg engaged you: choose a character you control to take 1 damage." }], verb: "Assign" },

  // 10023:A:2 (Travel): the first player engages a Warg enemy of his choice in the staging area and it is dealt a shadow card.
  "10023:travel:1 @0 Pick": { note: "Eriador Wastes: to travel here, choose a Warg enemy in the staging area. It engages the first player and is dealt a shadow card.", verb: "Engage" },

  // 10027:A:1 (When Revealed): each player, in player order, discards their highest-cost ally or searches for a Warg enemy.
  "10027:whenRevealed:1 @0.0 Choose": { owned: true, note: "Predatory Wolves: discard your highest-cost ally (Amarthiúl counts as cost 0), or search for a Warg enemy to add to the staging area." },
  // With one highest-cost ally the option takes it with no second step, so its row names it ("Discard Faramir"); with a tie the player picks next.
  "10027:whenRevealed:1 @0.0 discard": { named: { ally: { pick: HIGHEST_COST_ALLY, otherwise: "your highest-cost ally" } }, label: "Discard {ally}", caution: { when: ONLY_AMARTHIUL, text: LOSES } },
  "10027:whenRevealed:1 @0.0 search": { label: "Search for a Warg enemy and add it to the staging area" },
  "10027:whenRevealed:1 @0.0.discard.0 Pick": { owned: true, note: "Predatory Wolves: choose which of your highest-cost allies to discard.", verb: "Discard", caution: { when: PICKED_AMARTHIUL, text: LOSES } },

  // 10027:A:2 (Shadow): the defending player exhausts a character he controls.
  "10027:shadow:1 @0 Pick": { owned: true, note: "Predatory Wolves' shadow: choose a character you control to exhaust.", verb: "Exhaust" },

  // Determination (10172:A:1) and Ruthless (10164:A:4), worded once for every scenario that can deal them.
  ...DETERMINATION_ASKS,
  ...POOL_BOON_ASKS,
};
