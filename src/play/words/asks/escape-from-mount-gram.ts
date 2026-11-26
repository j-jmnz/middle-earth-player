import type { PickSpec } from "../../../catalog/boundary.ts";
import type { Ask } from "../asks.ts";
import { DETERMINATION_ASKS, LOOT_BOON_ASKS, POOL_BOON_ASKS } from "../pool-boon-asks.ts";

// The choice words of Escape from Mount Gram (angmar-awakened part 5), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario escape-from-mount-gram --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=escape-from-mount-gram` prints each sentence.
// A choice of one player's own (the starting hero, the ally Captives of Gornákh takes, the character a shadow exhausts, Feeble and Weary's either/or, the boon of Loot the Dungeons) is owned: two-handed the sentence leads with the player. The first player of the staging area answers for the group at Jailor Gornákh's
// target, Dungeon Guard's and Prison Cell's cards and Captives' tie, so those sentences are not owned and the sheet adds who chooses. A row of a pick that spans players names the owner of its card (`seatedLabel`: "Berelind · Player 2's ally"). The Campaign Pool's cards a game can deal are worded once
// (src/play/words/pool-boon-asks.ts).
const EXHAUSTED_MINE: PickSpec = { type: "character", control: "you", state: "exhausted" };
const EXHAUSTED_COMMITTED_MINE: PickSpec = { type: "character", control: "you", state: "exhausted", committed: true };

export const ASKS: Readonly<Record<string, Ask>> = {
  // 10038:A:1 (Setup): each player chooses the starting hero. It gets 2 resources, the threat is set to its threat cost, the other heroes go to the captured deck (one of them on top).
  "10038:setup:1 @0.1 Pick": { owned: true, note: "Unexpected Rescue: choose your starting hero. It gets 2 resources and your threat is set to its threat cost. Your other heroes go to your captured deck.", verb: "Start with" },

  // 10041:A:1 (Forced after captured cards are rescued): he engages the player with the highest threat; the first player chooses among those tied.
  "10041:forced:1 @0 Pick": { note: "Jailor Gornákh: cards were rescued. Choose which of the players tied for the highest threat he engages. He attacks that player at once.", verb: "Engage" },

  // 10044:A:2 (Response): the first player of the area chooses 1 of the cards rescued from under Dungeon Guard, any owner's, to put into play at no cost under its owner.
  "10044:response:1 @0 Pick": { note: "Dungeon Guard: choose 1 of the cards rescued from underneath it to put into play at no cost, under its owner. The others stay in hand.", verb: "Play it" },

  // 10046:A:2 (Response): after the players travel to Prison Cell, look at the captured cards under it (any owner's) and choose 1 to put into play at no cost.
  "10046:response:1 @0 Pick": { note: "Prison Cell: look at the cards captured underneath it and choose 1 to put into play at no cost, under its owner. The others stay underneath.", verb: "Play it" },

  // 10050:A:1 (When Revealed): each player chooses for themselves: 1 damage to each exhausted character they control, or each exhausted character they control is removed from the quest.
  "10050:whenRevealed:1 @0.0 Choose": { owned: true, note: "Feeble and Weary: deal 1 damage to each exhausted character you control, or remove each exhausted character you control from the quest." },
  // The labels say what the row does now: none, the one, or the many.
  "10050:whenRevealed:1 @0.0 damage": {
    label: [
      { when: { kind: "count", pick: EXHAUSTED_MINE, max: 0 }, text: "Deal 1 damage to each exhausted character you control (you control none: nothing happens)" },
      { when: { kind: "count", pick: EXHAUSTED_MINE, max: 1 }, text: "Deal 1 damage to your exhausted character" },
      { text: "Deal 1 damage to each of your {n} exhausted characters" },
    ],
    bind: { n: { count: EXHAUSTED_MINE } },
  },
  "10050:whenRevealed:1 @0.0 remove": {
    label: [
      { when: { kind: "count", pick: EXHAUSTED_COMMITTED_MINE, max: 0 }, text: "Remove each exhausted character you control from the quest (none is committed: nothing happens)" },
      { when: { kind: "count", pick: EXHAUSTED_COMMITTED_MINE, max: 1 }, text: "Remove your exhausted character that is committed from the quest" },
      { text: "Remove your {n} exhausted characters that are committed from the quest" },
    ],
    bind: { n: { count: EXHAUSTED_COMMITTED_MINE } },
  },

  // 10050:A:2 (Shadow): the defending player exhausts a character he controls.
  "10050:shadow:1 @0 Pick": { owned: true, note: "Feeble and Weary's shadow: choose a character you control to exhaust.", verb: "Exhaust" },

  // 10051:A:1 (When Revealed): each player chooses one of their allies; it is captured underneath the encounter card with the highest Threat in the area (the first player chooses among those tied).
  "10051:whenRevealed:1 @0.0 Pick": { owned: true, note: "Captives of Gornákh: choose one of your allies to be captured underneath the encounter card with the highest Threat.", verb: "Capture" },
  "10051:whenRevealed:1 @0.1 Pick": { note: "Captives of Gornákh: choose which of the encounter cards tied for the highest Threat captures the ally.", verb: "Capture" },

  // 10175:A:2 (Forced after Loot the Dungeons is defeated): each player in turn may take one boon not yet taken into their hand and the Campaign Pool.
  "10175:forced:1 @0 ChooseBoonToHand": { owned: true, note: "Loot the Dungeons: choose one of the boons not yet taken to add to your hand and the Campaign Pool, or take none.", verb: "Take", labels: { none: "Take no boon" } },

  // Determination (10172:A:1) and Ruthless (10164:A:4), worded once for every scenario that can deal them.
  ...DETERMINATION_ASKS,
  ...POOL_BOON_ASKS,
  ...LOOT_BOON_ASKS,

  "10044:response:1 @1 PutCapturedIntoPlay": { note: "{card}: choose 1 of the rescued cards to put into play at no cost, under its owner's control.", verb: "Put" },
  "10046:response:1 @1 PutCapturedIntoPlay": { note: "{card}: choose 1 of the cards captured under it to put into play at no cost. The others stay captured under it.", verb: "Put" },
};
