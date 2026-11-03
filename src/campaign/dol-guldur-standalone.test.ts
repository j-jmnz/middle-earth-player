// Rules: rr.campaign-setup-checklist (data/rules/entries.json); ledger line 01131:A:3. Escape from Dol Guldur as a standalone game.
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { expectOk } from "../rules/core/test-fixture.ts";
import { prisonerHero } from "../rules/families/prisoner/index.ts";
import { reduce, startScenario } from "../rules/engine/reduce.ts";
import { dolGuldurStart, dolGuldurWorld } from "../../test/scenarios/escape-from-dol-guldur/game.ts";
import { dolGuldur, campaign, MENDOR } from "../../test/scenarios/escape-from-dol-guldur/scene.ts";

import { buildStart } from "./start.ts";

describe("the standalone game", () => {
  it("takes a random prisoner and has no Mendor and no campaign card", async () => {
    const { ctx } = await dolGuldurWorld();
    const standalone = buildStart({ campaign, scenario: dolGuldur, seatCount: 1, seed: 4, threatModifier: 0, seats: dolGuldurStart(1, 4, "Normal").seats, effects: EFFECTS, mode: "standalone" });
    let state = startScenario(standalone, ctx);
    while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
    for (let guard = 0; guard < 6 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
    expect(prisonerHero(state)).not.toBeNull();
    expect(Object.values(state.cards).filter((card) => card.code === MENDOR || card.code === "01131")).toEqual([]);
  });

  it("turns only the hero facedown: the cards attached to it stay faceup, because 'each card attached' is the campaign card's line (01131:A:3)", async () => {
    const { ctx } = await dolGuldurWorld();
    let checked = 0;
    for (let seed = 1; seed <= 12; seed += 1) {
      const standalone = buildStart({ campaign, scenario: dolGuldur, seatCount: 1, seed, threatModifier: 0, seats: dolGuldurStart(1, seed, "Normal").seats, effects: EFFECTS, mode: "standalone" });
      let state = startScenario(standalone, ctx);
      while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
      for (let guard = 0; guard < 6 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
      const prisoner = state.cards[prisonerHero(state) ?? ""];
      expect(prisoner?.face).toBe("down");
      for (const id of prisoner?.attachments ?? []) {
        expect(state.cards[id]?.face).toBe("up");
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});

