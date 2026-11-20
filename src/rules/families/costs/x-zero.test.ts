import { describe, expect, it } from "vitest";

import { RECORDS } from "../../../effects/authored/pool/SaF.ts";

import { expectOk } from "../../core/test-fixture.ts";
import { legalIntents, reduce } from "../../engine/reduce.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { card, put, table } from "./fixture.ts";

// Rules: rr.the-letter-x, rr.cost (data/rules/entries.json).
// A cost of X that the player chooses may be 0, and the rest of the effect still resolves: We Are Not Idle (04129:A:1) draws 1
// card with no Dwarf hero exhausted.

const idle = card("04129", "event", "leadership", 0, { name: "We Are Not Idle" });
const dwarf = card("dwarf", "hero", "leadership", null, { threat: 10, traits: ["Dwarf"] });
const dwarf2 = card("dwarf2", "hero", "tactics", null, { threat: 10, traits: ["Dwarf"] });
const filler = card("filler", "event", "neutral", 0);

// The table: one seat with the heroes given, the event in hand and two cards in the deck.
function scene(heroes: readonly string[]): { state: ScenarioState; heroIds: string[]; eventId: string; ctx: ReturnType<typeof table>["ctx"] } {
  const { state, ids, ctx } = table(RECORDS, [idle, dwarf, dwarf2, filler], [heroes], 0);
  const event = put(state, "04129", "hand");
  const deck = put(put(event.state, "filler", "deck").state, "filler", "deck");
  return { state: deck.state, heroIds: ids[0] ?? [], eventId: event.id, ctx };
}

function play(state: ScenarioState, eventId: string, ctx: ReturnType<typeof table>["ctx"]): ScenarioState {
  return expectOk(reduce(state, { type: "PlayCard", cardId: eventId, payments: [] }, ctx)).state;
}

describe("We Are Not Idle with X = 0 (04129:A:1, rr.the-letter-x)", () => {
  it("is played with no Dwarf hero and draws 1 card", () => {
    const { state, eventId, ctx } = scene(["lead", "tac"]);
    expect(legalIntents(state, ctx)).toContainEqual({ type: "PlayCard", cardId: eventId });
    const after = play(state, eventId, ctx);
    expect(after.seats[0]?.hand).toHaveLength(1);
    expect(after.cards[eventId]?.zone).toBe("discard");
  });

  it("is played with only exhausted Dwarf heroes and draws 1 card", () => {
    const base = scene(["dwarf", "lead"]);
    const state = updateCard(base.state, base.heroIds[0] ?? "", { exhausted: true });
    const after = play(state, base.eventId, base.ctx);
    expect(after.seats[0]?.hand).toHaveLength(1);
  });

  it("offers X from 0 to the ready Dwarf heroes; X = 0 exhausts no hero and adds no resource", () => {
    const { state, heroIds, eventId, ctx } = scene(["dwarf", "dwarf2"]);
    const asked = play(state, eventId, ctx);
    expect(asked.window).toMatchObject({ kind: "choose", options: ["x0", "x1", "x2"] });
    const after = expectOk(reduce(asked, { type: "Choose", optionId: "x0" }, ctx)).state;
    expect(heroIds.map((id) => [after.cards[id]?.exhausted, after.cards[id]?.resources])).toEqual([[false, 0], [false, 0]]);
    expect(after.seats[0]?.hand).toHaveLength(1);
  });

  it("with X = 2 exhausts both Dwarf heroes, adds 2 resources to the hero picked and draws 1 card", () => {
    const { state, heroIds, eventId, ctx } = scene(["dwarf", "dwarf2"]);
    let next = expectOk(reduce(play(state, eventId, ctx), { type: "Choose", optionId: "x2" }, ctx)).state;
    // The two exhausted heroes, then the hero that gains the resources, are each picked while a choice is open.
    const answers = [heroIds[0], heroIds[1], heroIds[1]];
    for (const id of answers) if (next.window?.kind === "choose") next = expectOk(reduce(next, { type: "Choose", optionId: id ?? "" }, ctx)).state;
    expect(heroIds.map((id) => next.cards[id]?.exhausted)).toEqual([true, true]);
    expect(next.cards[heroIds[1] ?? ""]?.resources).toBe(2);
    expect(next.seats[0]?.hand).toHaveLength(1);
  });
});
