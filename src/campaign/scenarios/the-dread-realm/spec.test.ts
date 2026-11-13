// Rules: mec108.reanimated-dead, mec108.indestructible, rr.setup, rr.reveal, rr.search, rr.active-location, rr.forced, rr.first-player, rr.shadow-effects, rr.destroy, rr.effects (data/rules/entries.json).
import { describe, it } from "vitest";

import { answer, attack, cardSpecs, damageOn, deckCount, flag, resolve, stat, won, zone, announce, notWon, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Dread Realm (angmar-awakened part 9): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/handover/agent-brief.md, Scenario procedure, Finish). What a row cannot express (a Reanimated Dead on the table, a choice by several seats, a count over several steps, a
// divided placement) is a test titled with its line id in reanimate.test.ts, stages.test.ts and campaign.test.ts. The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points; every seat starts at threat 28; the filler enemy f3 has 1 Attack and an engagement cost of 50.
const STAGE1 = "10150";
const STAGE2 = "10151";
const STAGE3 = "10152";
const DAECHANAR = "10153";
const ALTAR = "10154";
const FELL_DREAD = "101163";
const CALAMITY = "101164";
const DECK = ["f0", "f0", "f0", "f0", "f0", "f0"];

const ROWS: readonly Row[] = [
  { line: "10150:A:1", name: "Setup: each player reveals an encounter card (a Reanimated Dead is made from the top card of each deck: see reanimate.test.ts)", layout: { seats: 2, stage: STAGE1, deck: DECK, deckOf: ["filler", "filler"] }, act: resolve(STAGE1, "setup"), expect: [deckCount(DECK.length - 2), zone("f0", "staging")] },
  { line: "10151:A:1", name: "When Revealed: Daechanar joins the staging area and the Altar of Midwinter becomes the active location", layout: { stage: STAGE2, setAside: [DAECHANAR, ALTAR] }, act: resolve(STAGE2, "whenRevealed"), expect: [zone(DAECHANAR, "staging"), zone(ALTAR, "activeLocation")] },
  { line: "10151:B:2", name: "when Daechanar is defeated the players advance to stage 3", layout: { stage: STAGE2, staging: [DAECHANAR] }, act: announce("enemyDestroyed", DAECHANAR), expect: zone(STAGE3, "questStage") },
  { line: "10152:A:1", name: "When Revealed: the first player adds locations from the encounter deck to the staging area until there is one for each player", layout: { stage: STAGE3, deck: ["place", "f0", "place"] }, act: resolve(STAGE3, "whenRevealed"), expect: zone("place", "staging") },
  { line: "10152:B:3", name: "Forced at the end of the quest phase: with a location in play every character takes 1 damage", layout: { stage: STAGE3, staging: ["place"] }, act: resolve(STAGE3, "forced"), expect: [damageOn("dh1", 1), notWon] },
  { line: "10152:B:3", name: "Forced at the end of the quest phase: with no location in play the players win the game", layout: { stage: STAGE3 }, act: resolve(STAGE3, "forced"), expect: won },
  { line: "10153:A:2", name: "Daechanar gets +1 Attack for each Sorcery card in play and cannot be destroyed while there is one", layout: { stage: STAGE2, staging: [DAECHANAR], attached: [{ code: CALAMITY, to: STAGE2 }] }, act: [], expect: [stat(DAECHANAR, "attack", 5), flag(DAECHANAR, "indestructible")] },
  { line: "10154:A:1", name: "while Daechanar is in play no progress can be placed on the Altar of Midwinter", layout: { stage: STAGE2, active: ALTAR, staging: [DAECHANAR] }, act: [], expect: flag(ALTAR, "noProgressPlaced") },
  { line: "10154:A:2", name: "Forced at the end of the staging step: the first player reveals 1 additional card from the encounter deck", layout: { stage: STAGE2, active: ALTAR, deck: DECK, deckOf: ["filler"] }, act: [resolve(ALTAR, "forced"), answer("reveal")], expect: deckCount(DECK.length - 1) },
  { line: "101163:A:1", name: "attached hero has 0 Willpower and must commit to the quest", layout: { attached: [{ code: FELL_DREAD, to: "dh1" }] }, act: [], expect: [stat("dh1", "willpower", 0), flag("dh1", "mustCommit")] },
  { line: "101164:A:2", name: "Shadow: the attacking enemy gets +1 Attack for each Sorcery card in play", layout: { stage: STAGE1, attached: [{ code: CALAMITY, to: STAGE1 }] }, act: attack("f3", { shadow: CALAMITY, undefended: true }), expect: damageOn("dh1", 2) },
];

if (ROWS.length > 0) cardSpecs("the-dread-realm", ROWS);
else describe("the-dread-realm card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
