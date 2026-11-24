// Rules: rr.response, rr.forced, rr.ownership-and-control, ats.villager-tokens-discarded, ats.villagers (data/rules/entries.json).
// Lord Alcaron's Response (06070:A:2): after a villager token is discarded he may exhaust to place it on a location. Dead Villagers' Forced effect resolves first (rr.forced, rr.response), so its damage token is already there.
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";
import { topFrame } from "../../../rules/windows/windows.ts";
import { idOf, legalIntents, send } from "../../../../test/harness/scene-kit.ts";
import { CODES, damageOn, runSettled, table, villagers } from "../../../../test/scenarios/encounter-at-amon-din/table.ts";

const { protect, rescued, dead, alcaron, farmhouse, hamlet, secluded } = CODES;

type Made = ReturnType<typeof table>;
const offer = (state: ScenarioState, made: Made) => legalIntents(state, made.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === idOf(state, alcaron));
// Alcaron's Response used, and the location it asks for answered with `where` (a code; the first option when absent).
function used(state: ScenarioState, made: Made, where?: string): ScenarioState {
  const intent = offer(state, made);
  if (!intent) throw new Error("no Response of Lord Alcaron is offered");
  const run = send({ state, steps: [] }, intent as never, made.ctx);
  if (run.state.window?.kind !== "choose") return run.state;
  const wanted = where ? run.state.window.options.find((id) => run.state.cards[id]?.code === where) : undefined;
  return send(run, { type: "Choose", optionId: wanted ?? run.state.window.options[0] ?? "" }, made.ctx).state;
}

describe("06070:A:2 Lord Alcaron's Response", () => {
  const scene = (layout: Parameters<typeof table>[0] = {}) => table({ stage: protect, active: { code: farmhouse, resources: 3 }, staging: [{ code: rescued, resources: 2 }, dead, hamlet], play: [alcaron], ...layout });
  const discard = (made: Made, from: Parameters<typeof runSettled>[2] = { verb: "DiscardVillagerTokens", from: "activeLocation", amount: 1 }) => runSettled(made, made.state, from);

  it("06070:A:2 after a villager token is discarded from the active location he is offered the Response, and using it exhausts him and puts the token on the location chosen", () => {
    const made = scene();
    const after = discard(made);
    expect(offer(after, made)).toBeDefined();
    const done = used(after, made, hamlet);
    expect(done.cards[idOf(done, alcaron)]?.exhausted).toBe(true);
    expect(villagers(done, hamlet)).toBe(1);
    expect(villagers(done, farmhouse)).toBe(2);
  });

  it("06070:A:2 reading (recommended, community only): Dead Villagers keeps the damage token when he saves the token, because its Forced effect resolves before the Response; the other reading, the villager is saved and no damage token is placed, is not taken", () => {
    const made = scene();
    const after = discard(made);
    expect(damageOn(after, dead)).toBe(1);
    const done = used(after, made, hamlet);
    expect(damageOn(done, dead)).toBe(1);
  });

  it("06070:A:2 he may place the token on the active location it was discarded from, or on a location in the staging area (both are offered)", () => {
    const made = scene();
    const intent = offer(discard(made), made);
    const run = send({ state: discard(made), steps: [] }, intent as never, made.ctx);
    const codes = run.state.window?.kind === "choose" ? run.state.window.options.map((id) => run.state.cards[id]?.code).sort() : [];
    expect(codes).toEqual([farmhouse, hamlet].sort());
    const back = used(discard(made), made, farmhouse);
    expect(villagers(back, farmhouse)).toBe(3);
  });

  it("06070:A:2 a token discarded from Rescued Villagers is answered too, and the token he places is no longer on Rescued Villagers", () => {
    const made = scene();
    const after = discard(made, { verb: "DiscardVillagerTokens", from: { code: rescued }, amount: 1 });
    expect(offer(after, made)).toBeDefined();
    const done = used(after, made, hamlet);
    expect(villagers(done, rescued)).toBe(1);
    expect(villagers(done, hamlet)).toBe(1);
    expect(damageOn(done, dead)).toBe(1);
  });

  it("06070:A:2 the location may hold more than its Villagers value afterwards: Gondorian Hamlet with 3 tokens and 1 more holds 4", () => {
    const made = scene({ staging: [{ code: rescued, resources: 2 }, dead, { code: hamlet, resources: 3 }] });
    const done = used(discard(made), made, hamlet);
    expect(villagers(done, hamlet)).toBe(4);
  });

  it("06070:A:2 he saves one token only: with 3 discarded at once he is exhausted for the rest and Dead Villagers has all 3 damage tokens", () => {
    const made = scene();
    const after = discard(made, { verb: "DiscardVillagerTokens", from: "activeLocation", amount: 3 });
    const done = used(after, made, hamlet);
    expect(villagers(done, hamlet)).toBe(1);
    expect(damageOn(done, dead)).toBe(3);
    expect(offer(done, made)).toBeUndefined();
  });

  it("06070:A:2 he may decline: the token stays discarded (back in the bank) and he stays ready", () => {
    const made = scene();
    const after = discard(made);
    const passed = send({ state: after, steps: [] }, { type: "Pass" }, made.ctx).state;
    expect(villagers(passed, farmhouse)).toBe(2);
    expect(villagers(passed, hamlet)).toBe(0);
    expect(passed.cards[idOf(passed, alcaron)]?.exhausted).toBeFalsy();
  });

  it("06070:A:2 an exhausted Lord Alcaron is not offered the Response", () => {
    const made = scene();
    const tired = { ...made.state, cards: { ...made.state.cards, [idOf(made.state, alcaron)]: { ...made.state.cards[idOf(made.state, alcaron)]!, exhausted: true } } };
    const after = runSettled(made, tired, { verb: "DiscardVillagerTokens", from: "activeLocation", amount: 1 });
    expect(offer(after, made)).toBeUndefined();
    expect(damageOn(after, dead)).toBe(1);
  });

  it("06070:A:2 he is not offered the Response when no location is in play to put the token on", () => {
    const made = table({ stage: protect, staging: [{ code: rescued, resources: 2 }, dead], play: [alcaron] });
    const after = runSettled(made, made.state, { verb: "DiscardVillagerTokens", from: { code: rescued }, amount: 1 });
    expect(offer(after, made)).toBeUndefined();
    expect(damageOn(after, dead)).toBe(1);
  });

  it("06070:A:2 a damage token put on Dead Villagers by a card (Ghulat's Forced effect, Marauding Orc's) is no villager token discarded: he is not offered the Response", () => {
    const made = scene();
    const direct = runSettled(made, made.state, { verb: "PlaceDamageOn", code: dead, amount: 1 });
    expect(offer(direct, made)).toBeUndefined();
    expect(damageOn(direct, dead)).toBe(1);
  });

  it("06070:A:2 a villager token that moves (explore, Panicked!) is not discarded: he is not offered the Response and Dead Villagers gets no damage token", () => {
    const made = scene();
    const moved = runSettled(made, made.state, { verb: "MoveVillagerTokens", from: "activeLocation", to: { code: rescued }, all: true });
    expect(offer(moved, made)).toBeUndefined();
    expect(damageOn(moved, dead)).toBe(0);
  });

  it("06070:A:2 with two players the first player controls him and is the one offered the Response", () => {
    const made = scene({ seats: 2, firstPlayer: 1, play: [{ code: alcaron, seat: 1 }] });
    const after = discard(made);
    const intent = offer(after, made);
    expect(intent).toBeDefined();
    expect(after.cards[idOf(after, alcaron)]?.controller).toBe(1);
    // The window that offers the Trigger belongs to his controller (seat 1), not to seat 0.
    expect(after.window).toMatchObject({ kind: "response", seat: 1 });
    expect(topFrame(after)).toMatchObject({ seat: 1 });
  });
});

describe("06070:A:2 the Response to a discard by another card", () => {
  it("06070:A:2 Secluded Farmhouse (2 tokens, travelled to) loses a token to Trapped Inside's discard and Lord Alcaron may put it back on a location", () => {
    const made = table({ stage: protect, active: { code: secluded, resources: 2 }, staging: [rescued, dead, hamlet], play: [alcaron] });
    const after = runSettled(made, made.state, { verb: "DiscardVillagerTokens", from: "activeLocation", amount: 2 });
    expect(damageOn(after, dead)).toBe(2);
    const done = used(after, made, hamlet);
    expect(villagers(done, hamlet)).toBe(1);
  });
});
