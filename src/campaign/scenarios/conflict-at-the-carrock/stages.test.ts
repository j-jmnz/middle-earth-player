// Rules: rr.quest-advancement, rr.winning-the-game, rr.setup, rr.search (data/rules/entries.json); ledger lines 02036:B:2, 900511:A:1.
// The quest cards of Conflict at the Carrock: two stages on Normal and Easy (defeating Against the Trolls wins), three on Nightmare, whose quest card Grimbeorn's Folly is dealt after them (nightmare.questCards, src/campaign/start.ts).
import { describe, expect, it } from "vitest";

import { coreSpiritGame } from "../../../../test/harness/core-spirit-game.ts";

import { expectOk } from "../../../rules/core/test-fixture.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { reduce } from "../../../rules/engine/reduce.ts";
import { advanceStage } from "../../../rules/quest/quest.ts";
import { afterProgress } from "../../../rules/quest/stage-reveal.ts";



const game = (difficulty: "Normal" | "Nightmare", seatCount: 1 | 2 = 1) => coreSpiritGame("shadows-of-mirkwood", "conflict-at-the-carrock", difficulty, seatCount);

const codesOf = (state: ScenarioState, ids: readonly string[]) => ids.map((id) => state.cards[id]?.code);
const codeAt = (state: ScenarioState, id: string | null | undefined) => (id ? state.cards[id]?.code : undefined);

describe("the quest deck of Conflict at the Carrock", () => {
  it("the quest deck deals two stages on Normal, and Grimbeorn's Folly after them on Nightmare", () => {
    const normal = game("Normal");
    expect(codeAt(normal.state, normal.state.questStage)).toBe("02035");
    expect(codesOf(normal.state, normal.state.questDeck)).toEqual(["02036"]);
    const nightmare = game("Nightmare");
    expect(codeAt(nightmare.state, nightmare.state.questStage)).toBe("02035");
    expect(codesOf(nightmare.state, nightmare.state.questDeck)).toEqual(["02036", "900511"]);
    expect(nightmare.state.stages.map((stage) => stage.code)).toEqual(["02035", "02036", "900511"]);
  });

  it("900511:A:1 advances from Against the Trolls to Grimbeorn's Folly on Nightmare: Rob and Bob and a Troll for each player come out", () => {
    const { state, ctx } = game("Nightmare", 2);
    const second = advanceStage({ ...state, window: null }, ctx.cards, [], () => true);
    expect(codeAt(second, second.questStage)).toBe("02036");
    const steps: never[] = [];
    const third = advanceStage(second, ctx.cards, steps, () => true);
    expect(codeAt(third, third.questStage)).toBe("900511");
    let revealed = settle(afterProgress(third, 0, ctx, [{ kind: "advance", cardId: third.questStage ?? "" }]), ctx, []);
    // Each player chooses the Troll the search adds (the first one offered here).
    for (let guard = 0; guard < 6 && revealed.window?.kind === "choose"; guard += 1) revealed = expectOk(reduce(revealed, { type: "Choose", optionId: revealed.window.options[0] ?? "" }, ctx)).state;
    const staged = codesOf(revealed, revealed.staging);
    expect(staged).toContain("900503");
    const trolls = revealed.staging.filter((id) => ctx.cards.get(revealed.cards[id]?.code ?? "")?.traits.includes("Troll") && ctx.cards.get(revealed.cards[id]?.code ?? "")?.isUnique !== true);
    expect(trolls).toHaveLength(2);
  });

  it("900501:A:2 sets Rob and Bob aside with the four Nightmare Trolls at Setup on Nightmare, and 02035:A:1 shuffles a Sacked! for each player into the encounter deck", () => {
    const { state } = game("Nightmare", 2);
    const zoneOf = (code: string) => Object.values(state.cards).filter((card) => card.code === code).map((card) => card.zone);
    expect(zoneOf("900503")).toEqual(["setAside"]);
    for (const code of ["900504", "900505", "900506", "900507"]) expect(zoneOf(code)).toEqual(["setAside"]);
    // The deck holds the one Sacked! the Setup leaves in it, and Setup shuffles one more in for each player.
    expect(zoneOf("02048").filter((zone) => zone === "encounterDeck")).toHaveLength(3);
  });

  it("900501:A:3 puts the four Nightmare Trolls into the staging area when stage 2B is revealed, and not Rob and Bob", () => {
    const { state, ctx } = game("Nightmare", 1);
    const second = advanceStage({ ...state, window: null }, ctx.cards, [], () => true);
    const revealed = settle(afterProgress(second, 0, ctx, [{ kind: "advance", cardId: second.questStage ?? "" }]), ctx, []);
    const staged = codesOf(revealed, revealed.staging);
    for (const code of ["900504", "900505", "900506", "900507"]) expect(staged).toContain(code);
    expect(staged).not.toContain("900503");
  });

  it("02036:B:2 wins the game on Normal when Against the Trolls is defeated", () => {
    const { state, ctx } = game("Normal");
    const second = advanceStage({ ...state, window: null }, ctx.cards, [], () => true);
    expect(codeAt(second, second.questStage)).toBe("02036");
    expect(second.stageCleared).not.toBe(true);
    const won = advanceStage(second, ctx.cards, [], () => true);
    expect(won.stageCleared).toBe(true);
  });
});
