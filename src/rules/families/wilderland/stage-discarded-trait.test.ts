import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import type { EngineStep } from "../../core/intents.ts";
import { settle } from "../../engine/machine.ts";
import { pushCardEffects } from "../../interpret/effect-frames.ts";
import { spawn } from "../../core/zones.ts";
import { enemy, hero, table, treachery } from "../defense/table.ts";

// Rules: rr.staging, rr.encounter-deck (data/rules/entries.json); ledger line 131063:A:1.
// "discard X cards from the encounter deck ... Add each Goblin enemy discarded by this effect to the staging area": StageDiscarded with a `trait`.

const RECORD: Effect = {
  id: "source:forced:1",
  cardCode: "source",
  lines: ["source:A:1"],
  timing: "whenRevealed",
  instructions: [{ verb: "DiscardEncounterTop", count: 3 }, { verb: "StageDiscarded", type: "enemy", trait: "Goblin" }],
};

describe("StageDiscarded trait (131063:A:1)", () => {
  it("131063:A:1 only the Goblin enemies the effect discarded go to the staging area, the others stay in the discard pile", () => {
    const cards = [hero("a"), treachery("source"), enemy("goblin", { traits: ["Goblin"] }), enemy("troll", { traits: ["Troll"] }), treachery("mist")];
    const built = table({ cards, effects: [RECORD], seatCount: 1, heroes: [{ code: "a" }], hand: [{ code: "source" }] });
    let state = built.state;
    for (const code of ["mist", "troll", "goblin"]) state = spawn(state, code, { zone: "encounterDeck" }).state;
    const source = Object.values(state.cards).find((card) => card.code === "source")!;
    const steps: EngineStep[] = [];
    const done = settle(pushCardEffects({ ...state, firstPlayer: 0, phase: "Quest", window: null }, "whenRevealed", source.id, 0, false, [RECORD], built.ctx, steps), built.ctx, steps);
    const zoneOf = (code: string) => Object.values(done.cards).find((card) => card.code === code)?.zone;
    expect(zoneOf("goblin")).toBe("staging");
    expect(zoneOf("troll")).toBe("encounterDiscard");
    expect(zoneOf("mist")).toBe("encounterDiscard");
  });
});
