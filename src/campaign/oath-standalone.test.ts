// Rules: rr.campaign-setup-checklist, rr.campaign-cards (data/rules/entries.json); ledger lines 41050:A:2, 41050:A:3. The Oath as a standalone game: no campaign card,
// no Adaptation and no Stalking Goblin (they are chosen and shuffled in by the campaign card's Setup), no tokens and no Resolution.
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { expectOk } from "../rules/core/test-fixture.ts";
import { reduce, startScenario } from "../rules/engine/reduce.ts";
import { oathStart, oathWorld } from "../../test/scenarios/the-oath/game.ts";
import { campaign, oath } from "../../test/scenarios/the-oath/scene.ts";

import { buildStart } from "./start.ts";

describe("the standalone game", () => {
  it("has no campaign card, no Adaptation, no Stalking Goblin and no Resolution, and deals the scenario's own cards", async () => {
    const { ctx } = await oathWorld();
    const seats = oathStart(1, 4, "Normal").seats.map((seat) => ({ ...seat, attachments: [] }));
    const standalone = buildStart({ campaign, scenario: oath, seatCount: 1, seed: 4, threatModifier: 0, seats, effects: EFFECTS, mode: "standalone" });
    expect(standalone.definition.resolution).toEqual([]);
    let state = startScenario(standalone, ctx);
    while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
    const codes = Object.values(state.cards).map((card) => card.code);
    for (const code of ["41050", "41041", "41043", "41044", "41045", "41046", "41047"]) expect(codes, code).not.toContain(code);
    expect(state.cards[state.questStage ?? ""]?.code).toBe("41001");
    expect(Object.values(state.cards).some((card) => card.code === "41010" && card.zone === "staging")).toBe(true);
    expect(Object.values(state.cards).find((card) => card.code === "41019")?.zone).toBe("setAside");
  });
});
