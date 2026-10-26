// Rules: rr.setup, rr.step-2-2, rr.resource-match, rr.cost, rr.restricted, rr.response, rr.refresh-phase (data/rules/entries.json).
// Contracts with two sides: Forth, The Three Hunters!, The Grey Wanderer and Council of the Wise, through their real records.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { RECORDS } from "../../effects/authored/families/sidequests.ts";
import { playCost } from "../attach.ts";
import { codes, fixtureDefinition } from "../fixture.ts";
import { modifiedStat } from "../keywords.ts";
import { definePrinted } from "../printed.ts";
import { reduce, startScenario } from "../reduce.ts";
import { heldAmount, updateCard, type ScenarioState } from "../state.ts";
import { attachTo } from "../zones.ts";
import { crossTo, offered, play, put, run, seat, send, SIDE_CARDS, sideCtx, synced, trigger, withContract } from "./sidequests-fixture.ts";

// The fixture event has an Action that does nothing: an event with no record at all cannot be played (rr.triggered-ability).
const FILLER: Effect = { id: "filler:action:1", cardCode: "filler", lines: ["filler:A:1"], timing: "action", instructions: [] };
const ctx = sideCtx([...RECORDS, FILLER]);

function flipped(state: ScenarioState, id: string): ScenarioState {
  return synced(updateCard(state, id, { face: "B" }), ctx);
}

describe("Forth, The Three Hunters! (22049)", () => {
  function table() {
    const base = seat(1, ["gondor", "rohan"]);
    const contract = withContract(base.state, "22049");
    return { base, contract, state: synced(contract.state, ctx) };
  }

  it("side A: each hero can have a third restricted attachment (22049:A:2)", () => {
    const { base, state } = table();
    for (const hero of base.heroes) expect(heldAmount(state, hero, "extraRestricted")).toBe(1);
    expect(heldAmount(synced(base.state, ctx), base.heroes[0] ?? "", "extraRestricted")).toBe(0);
  });

  it("side A: the first restricted attachment played on each hero each round costs 1 less (22049:A:2)", () => {
    const { base, state } = table();
    const [gondor, rohan] = base.heroes;
    const first = put(state, "rblade", "hand");
    const second = put(first.state, "rshield", "hand");
    const third = put(second.state, "rcloak", "hand");
    expect(playCost(third.state, first.id, 0, ctx, gondor)).toBe(1);
    // After one is played on Gondor, the next on Gondor costs full, on Rohan 1 less.
    const played = play(third.state, first.id, ctx, [{ heroId: gondor ?? "", amount: 1 }], gondor);
    expect(playCost(played, second.id, 0, ctx, gondor)).toBe(1);
    expect(playCost(played, second.id, 0, ctx, rohan)).toBe(0);
    // A card that is not a restricted attachment gets no discount.
    const charm = put(played, "cheap1", "hand");
    expect(playCost(charm.state, charm.id, 0, ctx, gondor)).toBe(1);
  });

  it("side A: the Refresh Action flips the card when each hero has 2 restricted attachments (22049:A:3)", () => {
    const { base, contract, state } = table();
    let next = state;
    for (const hero of base.heroes) {
      for (const code of ["rblade", "rshield"]) {
        const made = put(next, code, "play");
        next = attachTo(made.state, made.id, hero);
      }
    }
    const refresh = { ...next, phase: "Refresh" as const, mode: "stopped" as const, window: { kind: "pass" as const }, activeSeat: 0 };
    expect(offered(refresh, ctx).some((intent) => intent.type === "Trigger" && intent.effectId === "22049:action:1")).toBe(true);
    const flippedOver = trigger(refresh, contract.id, "22049:action:1", ctx);
    expect(flippedOver.cards[contract.id]?.face).toBe("B");
    // A hero with one restricted attachment only: not offered.
    const [gondorBlade] = refresh.cards[base.heroes[0] ?? ""]?.attachments ?? [];
    const short = { ...refresh, cards: { ...refresh.cards, [gondorBlade ?? ""]: { ...refresh.cards[gondorBlade ?? ""]!, zone: "discard" as const, host: null } } };
    const lacking = updateCard(short, base.heroes[0] ?? "", { attachments: (refresh.cards[base.heroes[0] ?? ""]?.attachments ?? []).slice(1) });
    expect(offered(lacking, ctx).some((intent) => intent.type === "Trigger" && intent.effectId === "22049:action:1")).toBe(false);
  });

  it("side B: +1 Willpower for each restricted attachment, and the Action heals each hero (22049:B:1, B:2)", () => {
    const { base, contract, state } = table();
    const hero = base.heroes[0] ?? "";
    const made = put(state, "rblade", "play");
    const attached = attachTo(made.state, made.id, hero);
    const sideA = synced(attached, ctx);
    const baseWill = modifiedStat(sideA, sideA.cards[hero]!, "willpower", ctx.cards);
    const sideB = flipped(sideA, contract.id);
    expect(modifiedStat(sideB, sideB.cards[hero]!, "willpower", ctx.cards)).toBe(baseWill + 1);
    expect(heldAmount(sideB, hero, "extraRestricted")).toBe(1);
    const hurt = base.heroes.reduce((acc, id) => updateCard(acc, id, { damage: 2 }), sideB);
    const healed = trigger(hurt, contract.id, "22049:action:2", ctx);
    for (const id of base.heroes) expect(healed.cards[id]?.damage).toBe(1);
    expect(healed.cards[contract.id]?.exhausted).toBe(true);
  });
});

describe("The Grey Wanderer (22074)", () => {
  it("Setup puts an attachment with printed cost 1 from the deck into play and flips the card (22074:A:2)", () => {
    const filler = codes("f", 20);
    const cards = new Map([...SIDE_CARDS, ...filler.map((code) => [code, definePrinted({ code, name: code, type: "event", sphere: "neutral", cost: 0 })] as const)]);
    const gameCtx = { effects: RECORDS, cards };
    let state = startScenario(
      { seatCount: 1, seed: 4, threatModifier: 0, definition: fixtureDefinition(["stage"]), seats: [{ heroes: ["dwarf"], deck: ["22074", "cheap1", ...filler] }], encounterDeck: [], questDeck: ["stage"] },
      gameCtx,
    );
    // The charm might be drawn in the opening hand; take seeds until it stays in the deck.
    for (let seed = 5; seed < 40 && Object.values(state.cards).find((card) => card.code === "cheap1")?.zone !== "deck"; seed += 1) {
      state = startScenario(
        { seatCount: 1, seed, threatModifier: 0, definition: fixtureDefinition(["stage"]), seats: [{ heroes: ["dwarf"], deck: ["22074", "cheap1", ...filler] }], encounterDeck: [], questDeck: ["stage"] },
        gameCtx,
      );
    }
    state = reduce(state, { type: "Keep" }, gameCtx).ok ? (reduce(state, { type: "Keep" }, gameCtx) as { state: ScenarioState }).state : state;
    const charm = Object.values(state.cards).find((card) => card.code === "cheap1");
    const contract = Object.values(state.cards).find((card) => card.code === "22074");
    expect(charm).toMatchObject({ zone: "play", host: state.seats[0].heroes[0] });
    expect(contract?.face).toBe("B");
  });

  it("side B: the first non-unique card played each planning phase needs no resource match (22074:B:1)", () => {
    const base = seat(1, ["dwarf", "rohan"]);
    const contract = withContract(base.state, "22074");
    const onB = flipped(contract.state, contract.id);
    const first = put(onB, "tactic", "hand");
    const second = put(first.state, "tactic", "hand");
    const unique = put(second.state, "01019", "hand");
    const pay = (hero: number) => [{ heroId: base.heroes[hero] ?? "", amount: 1 }];
    // Tactics cards, with Leadership and Spirit heroes: the first one is played, the second needs a match.
    expect(reduce(synced(contract.state, ctx), { type: "PlayCard", cardId: first.id, payments: pay(0) }, ctx).ok).toBe(false);
    const played = play(unique.state, first.id, ctx, pay(0));
    expect(played.cards[first.id]?.zone).toBe("play");
    expect(reduce(synced(played, ctx), { type: "PlayCard", cardId: second.id, payments: pay(0) }, ctx).ok).toBe(false);
  });

  it("side B: the Action exhausts it, raises threat by 1 and does two different things for the starting hero (22074:B:2)", () => {
    const base = seat(1, ["dwarf"]);
    const contract = withContract(base.state, "22074");
    const hero = base.heroes[0] ?? "";
    let state = flipped(updateCard(contract.state, hero, { damage: 4, exhausted: true, resources: 0 }), contract.id);
    state = { ...state, seats: [{ ...state.seats[0], threat: 20 }, state.seats[1]] };
    state = trigger(state, contract.id, "22074:action:1", ctx);
    expect(state.cards[contract.id]?.exhausted).toBe(true);
    expect(state.seats[0].threat).toBe(21);
    expect(state.window).toMatchObject({ kind: "choose" });
    state = send(state, { type: "Choose", optionId: "heal" }, ctx);
    // The second choice does not offer the option already taken.
    expect(state.window).toMatchObject({ kind: "choose", options: ["ready", "resources"] });
    state = send(state, { type: "Choose", optionId: "resources" }, ctx);
    expect(state.cards[hero]).toMatchObject({ damage: 1, resources: 2, exhausted: true });
  });
});

describe("Council of the Wise (22091)", () => {
  function table() {
    const base = seat(1, ["dwarf", "rohan"]);
    const contract = withContract(base.state, "22091");
    let state = base.state;
    state = withContract(state, "22091").state;
    state = put(state, "filler", "hand").state;
    state = put(state, "filler", "hand").state;
    state = put(state, "helper", "deck").state;
    return { base, contract, state: synced(state, ctx) };
  }

  it("offers a choice after an event is played, each option once per round (22091:A:2)", () => {
    const { base, state } = table();
    const events = Object.values(state.cards).filter((card) => card.code === "filler");
    const contractId = Object.values(state.cards).find((card) => card.code === "22091")?.id ?? "";
    let next = play(state, events[0]?.id ?? "", ctx);
    next = run(next, ctx);
    expect(next.window).toMatchObject({ kind: "response" });
    next = trigger(next, contractId, "22091:response:1", ctx);
    expect(next.window).toMatchObject({ kind: "choose", options: ["threat", "draw", "resource"] });
    next = send(next, { type: "Choose", optionId: "draw" }, ctx);
    expect(next.seats[0].hand.some((id) => next.cards[id]?.code === "helper")).toBe(true);
    // The second event: draw is spent.
    next = play(run(next, ctx), events[1]?.id ?? "", ctx);
    next = trigger(run(next, ctx), contractId, "22091:response:1", ctx);
    expect(next.window).toMatchObject({ kind: "choose", options: ["threat", "resource"] });
    next = send(next, { type: "Choose", optionId: "resource" }, ctx);
    // Auto-picked hero: two heroes, so the player chooses which.
    expect(next.window).toMatchObject({ kind: "choose" });
    next = send(next, { type: "Choose", optionId: base.heroes[0] ?? "" }, ctx);
    expect(next.cards[base.heroes[0] ?? ""]?.resources).toBe(6);
    // A new round: all three options are back.
    const later = crossTo(crossTo(next, "End of round", ctx), "Beginning of round", ctx);
    expect(heldAmount(later, "seat:0", "councilDraw")).toBe(0);
    expect(heldAmount(later, "seat:0", "councilResource")).toBe(0);
  });
});
