// Rules: rr.setup, rr.winning-the-game, sotm.setup-the-hills-of-emyn-muil, sotm.emyn-muil-victory-points (data/rules/entries.json); ledger lines 02082:A:1, 02082:B:2, 900701:A:2.
// The Hills of Emyn Muil from its start: Amon Hen and Amon Lhaw wait in the staging area (the piles search them out), and the Nightmare deck caps the progress each location in the staging area takes.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { expireModifiers, heldAmount, updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { reduce, startScenario } from "../../../rules/engine/reduce.ts";
import { notePlaced, progressRoom } from "../../../rules/families/south/locations.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
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
  const world = loadWorld(catalog, campaign, loadAnyScenario("the-hills-of-emyn-muil"), EFFECTS, [...heroes, ...deck]);
  const ctx = contextOf(world);
  const seats = Array.from({ length: seatCount }, () => ({ heroes, deck }));
  const start = buildStart({ campaign, scenario: world.scenario, seatCount, seed: 1, threatModifier: 0, seats, difficulty, effects: world.effects, mode: "standalone" });
  let state = startScenario(start, ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  return { state, ctx };
}

const codes = (state: ScenarioState, ids: readonly string[]) => ids.map((id) => state.cards[id]?.code).sort();

describe("the start of The Hills of Emyn Muil", () => {
  it("02082:A:1 puts Amon Hen and Amon Lhaw into the staging area, and the quest card is the one stage", () => {
    const { state } = game("Normal", 2);
    expect(codes(state, state.staging)).toEqual(["02083", "02084"]);
    expect(state.cards[state.questStage ?? ""]?.code).toBe("02082");
    expect(state.questDeck).toEqual([]);
  });

  it("900701:A:2 caps the progress on each location in the staging area at 1 on Nightmare, and not on Normal; the active location has no cap", () => {
    const normal = game("Normal");
    const hen = (state: ScenarioState) => state.staging.find((id) => state.cards[id]?.code === "02083") ?? "";
    expect(heldAmount(syncConstants(normal.state, normal.ctx), hen(normal.state), "progressCap")).toBe(0);
    const nightmare = game("Nightmare");
    const synced = syncConstants(nightmare.state, nightmare.ctx);
    expect(heldAmount(synced, hen(synced), "progressCap")).toBe(1);
    const active = { ...synced, cards: { ...synced.cards, [hen(synced)]: { ...synced.cards[hen(synced)]!, zone: "activeLocation" as const } } };
    expect(heldAmount(syncConstants({ ...active, activeLocation: hen(synced), staging: synced.staging.filter((id) => id !== hen(synced)) }, nightmare.ctx), hen(synced), "progressCap")).toBe(0);
  });

  it("900701:A:2 caps each location in the staging area at 1 progress a round, not all of them together; the next round it is 1 again", () => {
    const { state, ctx } = game("Nightmare");
    const synced = syncConstants(state, ctx);
    const [hen, lhaw] = ["02083", "02084"].map((code) => synced.staging.find((id) => synced.cards[id]?.code === code) ?? "");
    expect(progressRoom(synced, hen, ctx.cards)).toBe(1);
    const placed = notePlaced(updateCard(synced, hen, { progress: 1 }), hen, 1);
    expect(progressRoom(placed, hen, ctx.cards)).toBe(0);
    expect(progressRoom(placed, lhaw, ctx.cards)).toBe(1);
    expect(progressRoom(expireModifiers(placed, ["endOfRound"]), hen, ctx.cards)).toBe(1);
  });
});
