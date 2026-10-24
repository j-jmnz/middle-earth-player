import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { expectOk } from "../rules/fixture.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../rules/reduce.ts";
import { campaign, knife, knifeIntent, knifeStart, knifeWorld } from "../../scripts/knife-game.ts";

import { choiceSentence, declineSentence, resolutionView, settledSentence } from "./resolution-view.ts";
import type { World } from "./world.ts";

// Rules: rr.first-player, ltp.campaign-pool (data/rules/entries.json). The resolution screen's view of 141044:B:1: starting
// with the first player, each seat in turn may take one boon onto a hero it controls, or decline. Each tile names the boon
// and the hero; the decline is the reducer's skip, shown as "No boon"; the sentence above the last Confirm names the hero.
const BOONS = ["141018", "141019", "141020", "141021"];
let ctx: ReduceContext;
let world: World;

beforeAll(async () => {
  ({ ctx } = await knifeWorld());
  world = { campaign, scenario: knife, effects: EFFECTS, cards: ctx.cards, sets: new Map() };
}, 60_000);

// A golden win (the big-number loadout), played up to the first Resolution choice.
function atResolution(seatCount: 1 | 2, seed: number): ScenarioState {
  let state = startScenario(knifeStart(seatCount, seed, "Normal", "strong"), ctx);
  const memory = new Set<string>();
  for (let turn = 0; turn < 6000 && !state.lost && state.window?.kind !== "resolution"; turn += 1) state = expectOk(reduce(state, knifeIntent(state, ctx, memory), ctx)).state;
  expect(state.window?.kind).toBe("resolution");
  return state;
}

const nameOf = (code: string) => ctx.cards.get(code)?.name ?? code;

describe("141044's Resolution on the resolution screen", () => {
  it("two-handed: the first player chooses first, may decline, then the other seat chooses a boon on a named hero", () => {
    // Two-handed seed 2 (the strong loadout) wins with the first-player token on the second seat, so the Resolution starts
    // there. The seed moves when the policy or a rule moves where the token ends (seed 10, then seed 6, did before).
    let state = atResolution(2, 2);
    expect(state.firstPlayer).toBe(1);
    const first = resolutionView(state, world);
    expect(first.kind).toBe("choosing");
    if (first.kind !== "choosing") return;
    expect(first.eyebrow).toBe("Choose a boon");
    expect(first.seat).toBe(1);
    expect(first.seatLabel).toBe("Player 2 (first player) chooses");
    expect(first.decline).toEqual({ optionId: "skip", label: "No boon" });
    expect(first.tiles.length).toBeGreaterThan(0);
    const heroes = (state.seats[1]?.heroes ?? []).map((id) => nameOf(state.cards[id]?.code ?? ""));
    for (const tile of first.tiles) {
      expect(BOONS).toContain(tile.code);
      expect(tile.optionId).toContain(">");
      expect(heroes).toContain(tile.hero);
    }
    expect(new Set(first.tiles.map((tile) => tile.code))).toEqual(new Set(BOONS));
    expect(declineSentence(first)).toBe("Player 2 takes no boon. Nothing is recorded for this choice.");

    state = expectOk(reduce(state, { type: "ChooseResolution", optionId: "skip" }, ctx)).state;
    const second = resolutionView(state, world);
    expect(second.kind).toBe("choosing");
    if (second.kind !== "choosing") return;
    expect(second.seat).toBe(0);
    expect(second.seatLabel).toBe("Player 1 chooses");
    // Nothing was taken, so every boon is still offered.
    expect(new Set(second.tiles.map((tile) => tile.code))).toEqual(new Set(BOONS));
    const tile = second.tiles[0];
    if (!tile) throw new Error("no tile");
    expect(choiceSentence(second, tile)).toBe(`${tile.name} is attached to ${tile.hero} and recorded on the log.`);

    state = expectOk(reduce(state, { type: "ChooseResolution", optionId: tile.optionId }, ctx)).state;
    const settled = resolutionView(state, world);
    expect(settled.kind).toBe("settled");
    if (settled.kind !== "settled") return;
    expect(settled.earned).toHaveLength(1);
    expect(settledSentence(settled, world, "Flight to the Ford")).toBe(`Confirming records ${tile.name} on ${tile.hero} in the campaign and unlocks Flight to the Ford.`);
  }, 120_000);

  it("true solo: no seat label, and the decline speaks to the one player", () => {
    const state = atResolution(1, 2);
    const view = resolutionView(state, world);
    expect(view.kind).toBe("choosing");
    if (view.kind !== "choosing") return;
    expect(view.seatLabel).toBeNull();
    expect(view.decline?.label).toBe("No boon");
    expect(declineSentence(view)).toBe("You take no boon. Nothing is recorded for this choice.");
    const settled = resolutionView(expectOk(reduce(state, { type: "ChooseResolution", optionId: "skip" }, ctx)).state, world);
    expect(settled.kind === "settled" ? settledSentence(settled, world, "Flight to the Ford") : "").toBe("Confirming records the win and unlocks Flight to the Ford.");
  }, 120_000);
});
