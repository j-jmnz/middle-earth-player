// Rules: rr.campaign-setup-checklist, rr.campaign-cards (data/rules/entries.json); ledger lines 41051:A:2, 41051:B:1, 41004:A:1. The Caves of Nibin-Dûm as a standalone game: no campaign card,
// no "No Time to Waste!", no Shiny Distraction and no Ranger Sense (the campaign card's Setup and Resolution deal and earn them), but the first quest card's Setup still attaches the Cave Torch.
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { expectOk } from "../rules/core/test-fixture.ts";
import { reduce, startScenario } from "../rules/engine/reduce.ts";
import { cavesStart, cavesWorld } from "../../scripts/nibin-dum-game.ts";
import { campaign, caves } from "../../scripts/nibin-dum-scene.ts";

import { buildStart } from "./start.ts";

describe("the standalone game", () => {
  it("has no campaign card, no boon, no burden and no Resolution, and deals the scenario's own cards with the Cave Torch on a hero", async () => {
    const { ctx } = await cavesWorld();
    const seats = cavesStart(2, 4, "Normal").seats.map((seat) => ({ ...seat, afterMulligan: [], attachments: [] }));
    const standalone = buildStart({ campaign, scenario: caves, seatCount: 2, seed: 4, threatModifier: 0, seats, effects: EFFECTS, mode: "standalone" });
    expect(standalone.definition.resolution).toEqual([]);
    let state = startScenario(standalone, ctx);
    while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
    for (let guard = 0; guard < 12 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
    const codes = Object.values(state.cards).map((card) => card.code);
    for (const code of ["41051", "41048", "41049", "41042"]) expect(codes, code).not.toContain(code);
    expect(state.cards[state.questStage ?? ""]?.code).toBe("41004");
    expect(Object.values(state.cards).find((card) => card.code === "41029")?.zone).toBe("play");
    expect(Object.values(state.cards).find((card) => card.code === "41027")?.zone).toBe("setAside");
    expect(Object.values(state.cards).find((card) => card.code === "41028")?.zone).toBe("setAside");
    expect(Object.values(state.cards).filter((card) => card.zone === "staging")).toHaveLength(2);
  });
});
