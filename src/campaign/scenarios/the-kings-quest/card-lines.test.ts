// Rules: emce.caves-deck, emce.deep, rr.attachment-cards, rr.cannot, rr.shadow-effects, rr.travel, rr.in-play-and-out-of-play (data/rules/entries.json).
// The King's Quest lines no test named (ledger data/printed/ered-mithrin.json): "Shadow: Attacking enemy gets +1 Attack." (18056:A:2) and "Deep." on Dark Tunnel (18054:A:1) and Forked Passage (18055:A:1)
// as card-spec rows; "Cannot have non-Dragon attachments." (18042:A:1) and "Cannot have player card attachments." (18049:A:1) as line specs on `attachBlocked`, the gate every attach passes. The stand-in
// heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points. `cardSpecs` and `lineSpec` run each test again without the records of its line, where it must fail.
import { describe, expect } from "vitest";

import { attachBlocked } from "../../../rules/interpret/restrictions.ts";
import { attack, cardSpecs, damageOn, endPhase, travel, zone, type Row } from "../../../../test/harness/card-spec.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { idOf, tableFromLayout } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "the-kings-quest";
const FIRE_DRAKE = "18042";
const STONE_TROLL = "18049";
const DARK_TUNNEL = "18054";
const FORKED_PASSAGE = "18055";
const DARK_PLACES = "18056";
const DRAGON_BREATH = "18058"; // a Dragon treachery that attaches to a Dragon enemy
const LOST_ARMORY = "18060";
const ANCIENT_TREASURY = "18061";
const CAVES = { cavesDeck: [LOST_ARMORY, ANCIENT_TREASURY] } as const;

const ROWS: readonly Row[] = [
  // 18056 Dark Places: "Shadow: Attacking enemy gets +1 Attack." A 1-Attack enemy's undefended attack deals 2.
  { line: "18056:A:2", name: "Shadow: the attacking enemy gets +1 Attack", act: attack("f0", { shadow: DARK_PLACES, undefended: true }), expect: damageOn("dh1", 2) },
  // "Deep.": once the players travel there, the location is discarded and the top card of the Caves deck is the active location (emce.deep).
  { line: "18054:A:1", name: "Deep: traveling to Dark Tunnel replaces it with the top card of the Caves deck", layout: { phase: "Travel", staging: [DARK_TUNNEL], piles: CAVES }, act: travel(DARK_TUNNEL), expect: [zone(LOST_ARMORY, "activeLocation"), zone(DARK_TUNNEL, "encounterDiscard")] },
  // Forked Passage's Response is passed: the keyword still resolves once the travel's Responses are done.
  { line: "18055:A:1", name: "Deep: traveling to Forked Passage replaces it with the top card of the Caves deck once its Response is passed", layout: { phase: "Travel", staging: [FORKED_PASSAGE], piles: CAVES }, act: [travel(FORKED_PASSAGE), endPhase], expect: [zone(LOST_ARMORY, "activeLocation"), zone(FORKED_PASSAGE, "encounterDiscard")] },
];

cardSpecs(SCENARIO, ROWS);

describe("the enemies' attachment bars (18042:A:1, 18049:A:1)", () => {
  lineSpec("18042:A:1", "Fire-drake cannot have a non-Dragon attachment, in the staging area or engaged, and can have a Dragon one", (effects) => {
    for (const where of ["staging", "engaged"] as const) {
      const made = tableFromLayout(SCENARIO, { [where]: [FIRE_DRAKE] }, { effects });
      const drake = idOf(made.state, FIRE_DRAKE);
      expect(attachBlocked(made.state, made.ctx, drake, "attachment"), where).toBe(true);
      expect(attachBlocked(made.state, made.ctx, drake, "treachery"), where).toBe(true);
      expect(attachBlocked(made.state, made.ctx, drake, DRAGON_BREATH), where).toBe(false);
    }
  });

  lineSpec("18049:A:1", "Stone-troll cannot have a player card attachment, in the staging area or engaged, and can have an encounter card one", (effects) => {
    for (const where of ["staging", "engaged"] as const) {
      const made = tableFromLayout(SCENARIO, { [where]: [STONE_TROLL] }, { effects });
      const troll = idOf(made.state, STONE_TROLL);
      expect(attachBlocked(made.state, made.ctx, troll, "attachment"), where).toBe(true);
      expect(attachBlocked(made.state, made.ctx, troll, "treachery"), where).toBe(false);
    }
  });
});
