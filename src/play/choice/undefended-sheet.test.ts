// Rules: rr.step-6-4-1, rr.step-6-4-2, rr.step-6-4-3 (data/rules/entries.json).
// The attack sheet leaves an attack undefended with no hero named, and asks for the hero once the shadow effect has resolved.
import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../../rules/core/test-fixture.ts";
import { moveCard } from "../../rules/core/zones.ts";
import { legalIntents, reduce, startScenario, type ReduceContext, type ScenarioState } from "../../rules/engine/reduce.ts";
import { starterStart, starterWorld } from "../../../test/scenarios/a-shadow-of-the-past/game.ts";

import { defenseSheet } from "./combat-sheets.ts";
import type { SheetNames } from "./sheet-types.ts";

const names: SheetNames = { card: (id) => id, line: () => null };
let ctx: ReduceContext;
let attacked: ScenarioState;
let enemyId = "";

beforeAll(async () => {
  ctx = (await starterWorld("stealth-and-steadfastness")).ctx;
  const kept = expectOk(reduce(startScenario(starterStart("stealth-and-steadfastness", 1), ctx), { type: "Keep" }, ctx)).state;
  // An enemy of the encounter deck is engaged with the seat's three heroes and attacks; every character is exhausted, so none can defend.
  enemyId = kept.encounterDeck.find((id) => ctx.cards.get(kept.cards[id]?.code ?? "")?.type === "enemy") ?? "";
  let state = moveCard(kept, enemyId, { zone: "engaged", seat: 0 });
  for (const id of [...state.seats[0].heroes, ...state.seats[0].play]) state = { ...state, cards: { ...state.cards, [id]: { ...state.cards[id]!, exhausted: true } } };
  attacked = { ...state, phase: "Combat", mode: "enemyAttacks", pendingAttack: { enemyId, seat: 0 }, window: { kind: "defense", enemyId, seat: 0 } };
});

describe("the attack sheet of an undefended attack", () => {
  it("leaves the attack undefended with no hero named, then offers each hero after the shadow effect", () => {
    const heroes = attacked.seats[0].heroes;
    expect(heroes.length).toBeGreaterThan(1);
    const first = defenseSheet(attacked, ctx, legalIntents(attacked, ctx), names);
    expect(first.kind === "pick" && first.options).toEqual([]);
    expect(first.kind === "pick" && first.alternative).toMatchObject({ label: "Leave undefended", intent: { type: "Undefended" } });
    expect(first.kind === "pick" && first.alternative && "intent" in first.alternative && "heroId" in first.alternative.intent).toBe(false);
    // The shadow card and the action windows between the steps of the attack, to the damage step.
    let state = expectOk(reduce(attacked, { type: "Undefended" }, ctx)).state;
    for (let guard = 0; guard < 10 && state.window?.kind !== "defense"; guard += 1) state = expectOk(reduce(state, { type: "Pass" }, ctx)).state;
    expect(state.pendingAttack).toMatchObject({ enemyId, undefended: true, shadowResolved: true });
    expect(heroes.map((id) => state.cards[id]?.damage)).toEqual(heroes.map((id) => attacked.cards[id]?.damage));
    const second = defenseSheet(state, ctx, legalIntents(state, ctx), names);
    expect(second).toMatchObject({ kind: "pick", key: `undefended:${enemyId}`, confirm: "Take the damage", alternative: null });
    expect(second.kind === "pick" && second.options.map((option) => "intent" in option && option.intent)).toEqual(heroes.map((id) => ({ type: "Undefended", heroId: id })));
    const hit = expectOk(reduce(state, { type: "Undefended", heroId: heroes[1] }, ctx));
    expect(hit.steps.filter((step) => step.kind === "strike")).toEqual([expect.objectContaining({ targetId: heroes[1], undefended: true })]);
  });
});
