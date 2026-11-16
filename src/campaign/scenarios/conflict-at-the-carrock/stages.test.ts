// Rules: rr.quest-advancement, rr.winning-the-game, rr.setup, rr.search (data/rules/entries.json); ledger lines 02036:B:2, 900511:A:1.
// The quest cards of Conflict at the Carrock: two stages on Normal and Easy (defeating Against the Trolls wins), three on Nightmare, whose quest card Grimbeorn's Folly is dealt after them (nightmare.questCards, src/campaign/start.ts).
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { reduce, startScenario } from "../../../rules/engine/reduce.ts";
import { advanceStage } from "../../../rules/quest/quest.ts";
import { afterProgress } from "../../../rules/quest/stage-reveal.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { temporaryCatalog } from "../../../../test/harness/temp-catalog.ts";
import prebuilt from "../../../../data/decks/prebuilt.json" with { type: "json" };

import { contextOf } from "../../session.ts";
import { buildStart } from "../../start.ts";
import { loadWorld } from "../../world.ts";

const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));
const campaign = loadCampaign("shadows-of-mirkwood");
const core = prebuilt.find((entry) => entry.id === "core-spirit");
const heroes = core?.heroes ?? [];
const deck = core?.cards.flatMap((card) => Array.from({ length: card.count }, () => card.code)) ?? [];

function game(difficulty: "Normal" | "Nightmare", seatCount: 1 | 2 = 1) {
  const world = loadWorld(catalog, campaign, loadAnyScenario("conflict-at-the-carrock"), EFFECTS, [...heroes, ...deck]);
  const ctx = contextOf(world);
  const seats = Array.from({ length: seatCount }, () => ({ heroes, deck }));
  const start = buildStart({ campaign, scenario: world.scenario, seatCount, seed: 1, threatModifier: 0, seats, difficulty, effects: world.effects, mode: "standalone" });
  let state = startScenario(start, ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  return { state, ctx };
}

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

  it("02036:B:2 wins the game on Normal when Against the Trolls is defeated", () => {
    const { state, ctx } = game("Normal");
    const second = advanceStage({ ...state, window: null }, ctx.cards, [], () => true);
    expect(codeAt(second, second.questStage)).toBe("02036");
    expect(second.stageCleared).not.toBe(true);
    const won = advanceStage(second, ctx.cards, [], () => true);
    expect(won.stageCleared).toBe(true);
  });
});
