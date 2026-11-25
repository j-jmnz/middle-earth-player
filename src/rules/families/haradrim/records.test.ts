// Rules: rr.cannot, rr.engaged, rr.forced, hrd.encounter-side-quests, hrd.side-quests-in-play (data/rules/entries.json); ledger lines 16040:A:1, 16040:A:2, 16042:A:1. What the haradrim family's records need of the engine beyond the verbs:
// a side quest that bars its own defeat is held while it is full, and an enemy put into play engaged triggers the Forced effects that read "engages you".
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../core/intents.ts";
import { flagged } from "../../core/state.ts";
import { idOf, opened, run as runInstruction, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { settle } from "../../engine/machine.ts";

const table = (layout: Layout = {}) => tableFromLayout("escape-from-umbar", { seats: 1, ...layout });
const CHAMPION = "16041";

describe("16040:A:2 the side quest is held while the Champion is in play", () => {
  it("a full Southron Champion stays in the staging area while the Champion holds its token, and is defeated once it leaves play", () => {
    const held = table({ staging: [{ code: "16040", progress: 4 }, { code: CHAMPION, resources: 1 }] });
    const stays = settle(opened(held).state, held.ctx, [] as EngineStep[]);
    expect(stays.cards[idOf(stays, "16040")]?.zone).toBe("staging");
    const free = table({ staging: [{ code: "16040", progress: 4 }] });
    const defeated = settle(opened(free).state, free.ctx, [] as EngineStep[]);
    expect(defeated.cards[idOf(defeated, "16040")]?.zone).toBe("victory");
  });

  it("the Champion cannot take damage below 4 progress on the side quest, and can at 4", () => {
    const low = table({ staging: [{ code: "16040", progress: 3 }, { code: CHAMPION, resources: 1 }] });
    const lowState = opened(low).state;
    expect(flagged(lowState, idOf(lowState, CHAMPION), "cannotTakeDamage")).toBe(true);
    const full = table({ staging: [{ code: "16040", progress: 4 }, { code: CHAMPION, resources: 1 }] });
    const fullState = opened(full).state;
    expect(flagged(fullState, idOf(fullState, CHAMPION), "cannotTakeDamage")).toBe(false);
  });
});

describe("16042:A:1 an enemy put into play engaged engages the player", () => {
  it("Southron Soldier put into play engaged opens its choice of progress or an immediate attack", () => {
    const made = table({ stage: "16066", progress: 3, staging: ["16042"] });
    const soldier = idOf(made.state, "16042");
    const state = runInstruction(made, opened(made).state, { verb: "MoveEncounterCard", card: "self", to: "engaged" }, { sourceId: soldier });
    expect(state.cards[soldier]?.zone).toBe("engaged");
    expect(state.window?.kind).toBe("choose");
  });
});
