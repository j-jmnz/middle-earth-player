// Rules: rr.forced, rr.response, rr.cancel, rr.event-cards (data/rules/entries.json).
// "After an event is played" (`eventResolved`) is heard on every exit of a played event: the end of its effects, a cancel, an
// event with nothing to run, an event that goes on into an attack, an event that returns to its hand, a Response event and an
// event played for no cost from a deck (windows/queue.ts, announceEventResolved).
import { describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { expectOk } from "../core/test-fixture.ts";
import { definePrinted, type PrintedCard } from "../core/printed.ts";
import { legalIntents, reduce } from "../engine/reduce.ts";
import { withThreat, type ScenarioState } from "../core/state.ts";
import { attachTo } from "../core/zones.ts";
import { RECORDS as ENCOUNTER_RECORDS } from "../../effects/authored/families/encounter.ts";
import { ENCOUNTER_CARDS, put, seat } from "../families/encounter/fixture.ts";

const ev = (code: string) => definePrinted({ code, name: code, type: "event", sphere: "spirit", cost: 0 });
const extra: PrintedCard[] = [ev("ev"), ev("evnone"), ev("evback"), ev("evresp"), ev("evatk"), ev("evfree"), ev("evdraw"), definePrinted({ code: "tower", name: "Tower", type: "location", questPoints: 1, threat: 1 })];
const cards = new Map([...ENCOUNTER_CARDS, ...extra.map((card) => [card.code, card] as const)]);

const lower = (code: string, instructions: Effect["instructions"] = [{ verb: "LowerThreat", amount: 3, who: "actor" }]): Effect => ({ id: `${code}:action:1`, cardCode: code, lines: [`${code}:A:1`], timing: "action", instructions });
const after: Effect = {
  id: "tower:forced:1",
  cardCode: "tower",
  lines: ["tower:A:1"],
  timing: "forced",
  trigger: "eventResolved",
  subject: { type: "card", control: "any", cardType: "event" },
  instructions: [{ verb: "RaiseThreat", amount: 2, who: "eventSeat" }],
};
const cancels: Effect = { ...after, id: "tower:forced:2", lines: ["tower:A:2"], trigger: "played", instructions: [{ verb: "CancelEventEffects" }] };
const response: Effect = {
  id: "evresp:response:1",
  cardCode: "evresp",
  lines: ["evresp:A:1"],
  timing: "response",
  trigger: "played",
  subject: { type: "card", control: "any", cardType: "event" },
  cost: { kind: "playEvent" },
  instructions: [{ verb: "LowerThreat", amount: 1, who: "actor" }],
};
const effects = [
  lower("ev"),
  lower("evback", [{ verb: "LowerThreat", amount: 3, who: "actor" }, { verb: "ReturnEventToHand" }]),
  lower("evatk", [{ verb: "Pick", pick: { type: "character", control: "you", state: "ready" } }, { verb: "Pick", pick: { type: "enemy", control: "any", stagingOnly: true } }, { verb: "DeclareAttack" }, { verb: "LowerThreat", amount: 1, who: "actor" }]),
  lower("evfree"),
  lower("evdraw", [{ verb: "ReturnEventToHand" }, { verb: "Draw", amount: 1 }]),
  response,
  after,
];
const ctx = (extraEffects: readonly Effect[] = []) => ({ effects: [...effects, ...ENCOUNTER_RECORDS.filter((effect) => effect.cardCode === "04137"), ...extraEffects], cards });

// The table, with a hand that grows as `hand` is called: `kit.state` is always the latest.
function table(): { state: ScenarioState; hand: (code: string) => string } {
  const base = seat(1, ["elrond", "hobbit"]);
  const kit = {
    state: withThreat(put(base.state, "tower", "staging").state, 0, 10),
    hand(code: string): string {
      const made = put(kit.state, code, "hand");
      kit.state = made.state;
      return made.id;
    },
  };
  return kit;
}

const threats = (steps: readonly { kind: string; amount?: number }[]) => steps.filter((step) => step.kind === "threat").map((step) => step.amount ?? 0);

describe("After an event is played, on every exit of the event", () => {
  it("rr.cancel: an event whose effects are canceled is still played, and announced", () => {
    const kit = table();
    const id = kit.hand("ev");
    const result = expectOk(reduce(kit.state, { type: "PlayCard", cardId: id, payments: [] }, ctx([cancels])));
    expect(threats(result.steps)).toEqual([2]);
    expect(result.state.cards[id]?.zone).toBe("discard");
  });

  it("rr.event-cards: an event that returns to its hand is announced when its effects are done", () => {
    const kit = table();
    const id = kit.hand("evback");
    const result = expectOk(reduce(kit.state, { type: "PlayCard", cardId: id, payments: [] }, ctx()));
    expect(threats(result.steps)).toEqual([-3, 2]);
    expect(result.state.cards[id]?.zone).toBe("hand");
  });

  it("rr.response: a Response event hears \"when\" and \"after\" like an Action event", () => {
    const kit = table();
    const played = kit.hand("ev");
    const reply = kit.hand("evresp");
    const first = expectOk(reduce(kit.state, { type: "PlayCard", cardId: played, payments: [] }, ctx()));
    const answered = expectOk(reduce(first.state, { type: "Trigger", cardId: reply, effectId: "evresp:response:1" }, ctx()));
    // Every seat passes the Responses still offered.
    let done = answered;
    const steps = [...first.steps, ...answered.steps];
    for (let guard = 0; guard < 6 && done.state.window?.kind === "response"; guard += 1) {
      done = expectOk(reduce(done.state, { type: "Pass" }, ctx()));
      steps.push(...done.steps);
    }
    // Both events are announced: the Action event and the Response event.
    expect(threats(steps).filter((amount) => amount === 2)).toHaveLength(2);
    expect(done.state.cards[reply]?.zone).toBe("discard");
  });

  it("rr.response: a Response event does not answer its own play, and joins the cards played this round", () => {
    const kit = table();
    const played = kit.hand("ev");
    const reply = kit.hand("evresp");
    const first = expectOk(reduce(kit.state, { type: "PlayCard", cardId: played, payments: [] }, ctx()));
    const answered = expectOk(reduce(first.state, { type: "Trigger", cardId: reply, effectId: "evresp:response:1" }, ctx()));
    expect(answered.state.played?.map((entry) => entry.id)).toEqual([played, reply]);
    const offered = legalIntents(answered.state, ctx()).filter((intent) => intent.type === "Trigger" && intent.cardId === reply);
    expect(offered).toEqual([]);
  });

  it("rr.event-cards: an event that goes on into an attack is announced once it has left the hand", () => {
    const kit = table();
    kit.state = put(kit.state, "orc", "staging").state;
    const id = kit.hand("evatk");
    let result = expectOk(reduce(kit.state, { type: "PlayCard", cardId: id, payments: [] }, ctx()));
    const steps = [...result.steps];
    // The player picks the attacker (the first offered), then the attack is declared.
    for (let guard = 0; guard < 4 && result.state.window?.kind === "choose"; guard += 1) {
      result = expectOk(reduce(result.state, { type: "Choose", optionId: result.state.window.options[0] ?? "" }, ctx()));
      steps.push(...result.steps);
    }
    expect(result.state.cards[id]?.zone).toBe("discard");
    expect(threats(steps)).toEqual([-1, 2]);
  });

  it("rr.event-cards: an event that goes on into an attack is announced after the attack's damage and its last instruction", () => {
    const kit = table();
    kit.state = put(kit.state, "orc", "staging").state;
    const id = kit.hand("evatk");
    let result = expectOk(reduce(kit.state, { type: "PlayCard", cardId: id, payments: [] }, ctx()));
    const steps = [...result.steps];
    // The attacker is picked, the attack declared and every seat passes the windows until the strike is done.
    for (let guard = 0; guard < 12 && result.state.window; guard += 1) {
      const window = result.state.window;
      if (window.kind !== "choose" && window.kind !== "pass") break;
      result = expectOk(reduce(result.state, window.kind === "choose" ? { type: "Choose", optionId: window.options[0] ?? "" } : { type: "Pass" }, ctx()));
      steps.push(...result.steps);
    }
    const damage = steps.findIndex((step) => step.kind === "damage");
    const announced = steps.findIndex((step) => step.kind === "threat" && step.amount === 2);
    expect(damage).toBeGreaterThanOrEqual(0);
    expect(announced).toBeGreaterThan(damage);
    expect(steps.findIndex((step) => step.kind === "threat" && step.amount === -1)).toBeLessThan(announced);
  });

  it("rr.event-cards: an event that returns to its hand is announced after the rest of its effects (a draw)", () => {
    const kit = table();
    const id = kit.hand("evdraw");
    kit.state = put(kit.state, "hobbit", "deck").state;
    const result = expectOk(reduce(kit.state, { type: "PlayCard", cardId: id, payments: [] }, ctx()));
    const draw = result.steps.findIndex((step) => step.kind === "draw");
    const announced = result.steps.findIndex((step) => step.kind === "threat" && step.amount === 2);
    expect(draw).toBeGreaterThanOrEqual(0);
    expect(announced).toBeGreaterThan(draw);
    expect(result.state.cards[id]?.zone).toBe("hand");
  });

  it("rr.forced: an event played for no cost from the top of a deck is announced", () => {
    const kit = table();
    const ring = put(kit.state, "04137", "play");
    const top = put(ring.state, "evfree", "deck");
    const elrond = Object.keys(top.state.cards).find((key) => top.state.cards[key]?.code === "elrond") ?? "";
    const attached = attachTo(top.state, ring.id, elrond);
    const looking = expectOk(reduce(attached, { type: "Trigger", cardId: ring.id, effectId: "04137:action:1" }, ctx()));
    const passed = expectOk(reduce(looking.state, { type: "Pass" }, ctx()));
    const done = expectOk(reduce(passed.state, { type: "Choose", optionId: "play" }, ctx()));
    expect(done.state.cards[top.id]?.zone).toBe("discard");
    expect(threats(done.steps)).toEqual([-3, 2]);
  });
});
