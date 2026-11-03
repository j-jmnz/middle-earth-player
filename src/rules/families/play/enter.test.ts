// Rules: rr.play-and-put-into-play, rr.in-play-and-out-of-play, rr.delayed-effects, rr.ownership-and-control, rr.unique-cards,
// rr.doomed-x, rr.hit-points (data/rules/entries.json).
// Cards put into play rather than played, run through the real records of the play family (src/effects/authored/families/play.ts).
import { describe, expect, it } from "vitest";

import { RECORDS } from "../../../effects/authored/families/play.ts";

import { placeDamage } from "../../keywords.ts";
import { ruleCause } from "../../cause.ts";
import { updateCard, withMode, type ScenarioState } from "../../state.ts";
import { crossTo, offered, passResponses, play, playCtx, put, run, seat, send, trigger, triggers } from "./fixture.ts";

const ctx = playCtx(RECORDS);

function zoneOf(state: ScenarioState, id: string): string | undefined {
  return state.cards[id]?.zone;
}

// The end of the current phase: the next phase begins and the delayed effects of the one that ended resolve.
function endPhase(state: ScenarioState, mode: Parameters<typeof withMode>[1]): ScenarioState {
  return run({ ...withMode({ ...state, window: null }, mode) }, ctx);
}

describe("an ally's own ability puts it into play from the hand", () => {
  it("offers Brok Ironfist from the hand after a Dwarf hero you control leaves play, and not with a copy in play (01019:A:1)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const brok = put(table.state, "01019", "hand");
    const dwarf = table.heroes[0] ?? "";
    const destroyed = run(placeDamage({ ...brok.state, window: null }, dwarf, 9, ctx.cards, [], "player", ruleCause("rr.damage")), ctx);
    expect(destroyed.window?.kind).toBe("response");
    expect(triggers(destroyed, ctx, "01019:response:1")).toEqual([{ type: "Trigger", cardId: brok.id, effectId: "01019:response:1" }]);
    const entered = trigger(destroyed, brok.id, "01019:response:1", ctx);
    expect(zoneOf(entered, brok.id)).toBe("play");
    expect(entered.cards[brok.id]?.exhausted).toBe(false);
    // Put into play, not played: no cost was paid.
    expect(entered.cards[table.heroes[1] ?? ""]?.resources).toBe(5);
    // A copy already in play keeps the unique card in the hand.
    const copy = put(put(table.state, "01019", "hand").state, "01019", "play");
    const again = run(placeDamage({ ...copy.state, window: null }, dwarf, 9, ctx.cards, [], "player", ruleCause("rr.damage")), ctx);
    expect(triggers(again, ctx, "01019:response:1")).toEqual([]);
  });

  it("puts Bofur into play exhausted and committed in the quest phase, and returns him if the quest succeeded (04006:A:1)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const bofur = put(table.state, "04006", "hand");
    expect(triggers(bofur.state, ctx, "04006:action:1")).toEqual([]);
    const questing: ScenarioState = { ...bofur.state, phase: "Quest", mode: "questCommit", boundaryPhase: "Quest" };
    expect(triggers(questing, ctx, "04006:action:1")).toHaveLength(1);
    const spirit = table.heroes[1] ?? "";
    const entered = trigger(questing, bofur.id, "04006:action:1", ctx, [{ heroId: spirit, amount: 1 }]);
    expect(entered.cards[bofur.id]).toMatchObject({ zone: "play", exhausted: true, committed: true });
    expect(entered.cards[spirit]?.resources).toBe(4);
    // The quest succeeded: back to the hand when the phase ends.
    const succeeded: ScenarioState = { ...entered, quested: { round: entered.round, committed: [], succeeded: [0] } };
    expect(zoneOf(endPhase(succeeded, "travel"), bofur.id)).toBe("hand");
    // It did not: he stays.
    expect(zoneOf(endPhase(entered, "travel"), bofur.id)).toBe("play");
  });

  it("discards 2 other cards from the hand to put Elven Jeweler into play (10033:A:1)", () => {
    const table = seat();
    const jeweler = put(table.state, "10033", "hand");
    expect(triggers(put(jeweler.state, "filler", "hand").state, ctx, "10033:action:1")).toEqual([]);
    const first = put(jeweler.state, "filler", "hand");
    const second = put(first.state, "helper", "hand");
    let state = trigger(second.state, jeweler.id, "10033:action:1", ctx);
    expect(state.window).toMatchObject({ kind: "choose", options: [first.id, second.id] });
    state = send(state, { type: "Choose", optionId: first.id }, ctx);
    expect(zoneOf(state, first.id)).toBe("discard");
    expect(zoneOf(state, second.id)).toBe("discard");
    expect(zoneOf(state, jeweler.id)).toBe("play");
  });

  it("spends a Rohan hero's resource for Elfhelm and discards him at the end of the phase (146006:A:1)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const elfhelm = put(table.state, "146006", "hand");
    const rohan = table.heroes[1] ?? "";
    const entered = trigger(elfhelm.state, elfhelm.id, "146006:action:1", ctx);
    expect(zoneOf(entered, elfhelm.id)).toBe("play");
    expect(entered.cards[rohan]?.resources).toBe(4);
    expect(entered.cards[table.heroes[0] ?? ""]?.resources).toBe(5);
    const ended = passResponses(endPhase(entered, "questCommit"), ctx);
    expect(zoneOf(ended, elfhelm.id)).toBe("discard");
    // No Rohan hero with a resource: not offered.
    const broke = updateCard(elfhelm.state, rohan, { resources: 0 });
    expect(triggers(broke, ctx, "146006:action:1")).toEqual([]);
  });

  it("puts Ranger of Cardolan into play after you engage an enemy, and shuffles it into the deck at the end of the round (10010:A:1)", () => {
    const table = seat(1, ["ranger", "rohan"]);
    const ranger = put(table.state, "10010", "hand");
    const orc = put(ranger.state, "orc", "engaged");
    const engaged = run({ ...orc.state, window: null, pendingEvents: [{ trigger: "engaged", seat: 0, subject: orc.id }] }, ctx);
    expect(triggers(engaged, ctx, "10010:response:1")).toHaveLength(1);
    const entered = trigger(engaged, ranger.id, "10010:response:1", ctx, [{ heroId: table.heroes[1] ?? "", amount: 1 }]);
    expect(zoneOf(entered, ranger.id)).toBe("play");
    const nextRound = crossTo({ ...entered, phase: "End of round", boundaryPhase: "End of round" }, "Beginning of round", ctx);
    expect(zoneOf(nextRound, ranger.id)).toBe("deck");
    // Without a Dúnedain hero it is not offered.
    const plain = seat(1, ["dwarf", "rohan"]);
    const other = put(plain.state, "10010", "hand");
    const enemy = put(other.state, "orc", "engaged");
    expect(triggers(run({ ...enemy.state, window: null, pendingEvents: [{ trigger: "engaged", seat: 0, subject: enemy.id }] }, ctx), ctx, "10010:response:1")).toEqual([]);
  });

  it("puts Curious Brandybuck into play after you travel, under the player the actor chooses (10006:A:2)", () => {
    const table = seat(2, ["dwarf", "rohan"]);
    const hobbit = put(table.state, "10006", "hand");
    const marsh = put(hobbit.state, "marsh", "activeLocation");
    let state = run({ ...marsh.state, window: null, pendingEvents: [{ trigger: "traveled", seat: null, cardId: marsh.id }] }, ctx);
    state = trigger(state, hobbit.id, "10006:response:1", ctx);
    expect(state.window).toMatchObject({ kind: "choose", options: ["seat:0", "seat:1"] });
    state = send(state, { type: "Choose", optionId: "seat:1" }, ctx);
    expect(state.cards[hobbit.id]).toMatchObject({ zone: "play", controller: 1, owner: 0 });
    expect(state.seats[1].play).toContain(hobbit.id);
  });

  it("places 1 damage token on Veteran of Nanduhirion as it enters play (03006:A:1)", () => {
    const table = seat(1, ["gondor", "rohan"]);
    const veteran = put(table.state, "03006", "hand");
    const played = run(play(veteran.state, veteran.id, ctx, [{ heroId: table.heroes[0] ?? "", amount: 2 }]), ctx);
    expect(played.cards[veteran.id]).toMatchObject({ zone: "play", damage: 1 });
  });
});

describe("allies put into play from the players' hands", () => {
  it("Reinforcements: up to 2 allies from any hand, each under any player, back to their owners' hands at the end of the phase (10085:A:2)", () => {
    const table = seat(2, ["dwarf", "rohan"]);
    const event = put(table.state, "10085", "hand");
    const mine = put(event.state, "helper", "hand", 0);
    const theirs = put(mine.state, "eagle", "hand", 1);
    let state = play(theirs.state, event.id, ctx);
    expect(state.window).toMatchObject({ kind: "choose", seat: 0, options: [mine.id, theirs.id, "none"] });
    state = send(state, { type: "Choose", optionId: theirs.id }, ctx);
    expect(state.window).toMatchObject({ kind: "choose", options: ["seat:0", "seat:1"] });
    state = send(state, { type: "Choose", optionId: "seat:0" }, ctx);
    expect(state.cards[theirs.id]).toMatchObject({ zone: "play", controller: 0, owner: 1 });
    // The second: the player stops.
    expect(state.window).toMatchObject({ kind: "choose", options: [mine.id, "none"] });
    state = send(state, { type: "Choose", optionId: "none" }, ctx);
    expect(zoneOf(state, mine.id)).toBe("hand");
    expect(zoneOf(state, event.id)).toBe("discard");
    const ended = endPhase(state, "questCommit");
    expect(ended.cards[theirs.id]).toMatchObject({ zone: "hand", controller: 1 });
    expect(ended.seats[1].hand).toContain(theirs.id);
  });

  it("Horns! Horns! Horns!: each player may put one ally into play, shuffled into its owner's deck at the end of the phase (22056:A:2)", () => {
    const table = seat(2, ["dwarf", "rohan"]);
    const event = put(table.state, "22056", "hand");
    const mine = put(event.state, "helper", "hand", 0);
    const theirs = put(mine.state, "eagle", "hand", 1);
    let state = play(theirs.state, event.id, ctx);
    expect(state.window).toMatchObject({ kind: "choose", seat: 0, options: [mine.id, "none"] });
    state = send(state, { type: "Choose", optionId: mine.id }, ctx);
    expect(state.window).toMatchObject({ kind: "choose", seat: 1, options: [theirs.id, "none"] });
    state = send(state, { type: "Choose", optionId: theirs.id }, ctx);
    expect(state.cards[theirs.id]).toMatchObject({ zone: "play", controller: 1 });
    const ended = endPhase(state, "questCommit");
    expect(zoneOf(ended, mine.id)).toBe("deck");
    expect(ended.seats[1].deck).toContain(theirs.id);
  });

  it("Herald of Anórien: giving it doomed 2 raises each threat, then the chosen player may put an ally costing 2 or less into play (08057:A:1)", () => {
    const table = seat(2, ["dwarf", "rohan"]);
    const herald = put(table.state, "08057", "hand");
    const cheap = put(herald.state, "cheap", "hand", 1);
    const dear = put(cheap.state, "dear", "hand", 1);
    let state = run(play(dear.state, herald.id, ctx, [{ heroId: table.heroes[0] ?? "", amount: 2 }]), ctx);
    state = trigger(state, herald.id, "08057:response:1", ctx);
    expect(state.seats.map((entry) => entry.threat)).toEqual([2, 2]);
    expect(state.window).toMatchObject({ kind: "choose", seat: 0, options: ["seat:0", "seat:1"] });
    state = send(state, { type: "Choose", optionId: "seat:1" }, ctx);
    // The chosen player decides, among the allies they could put into play.
    expect(state.window).toMatchObject({ kind: "choose", seat: 1, options: [cheap.id, "none"] });
    state = send(state, { type: "Choose", optionId: cheap.id }, ctx);
    expect(state.cards[cheap.id]).toMatchObject({ zone: "play", controller: 1 });
    expect(zoneOf(state, dear.id)).toBe("hand");
  });

  it("keeps the offer to the cards that may enter play: a unique card with a copy in play is not one", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const event = put(table.state, "22056", "hand");
    const ceorl = put(event.state, "12058", "hand");
    const copy = put(ceorl.state, "12058", "play");
    const state = play(copy.state, event.id, ctx);
    expect(state.window?.kind).not.toBe("choose");
    expect(offered(state, ctx).some((intent) => intent.type === "Choose")).toBe(false);
  });
});
