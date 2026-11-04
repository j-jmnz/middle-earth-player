// Rules: rr.ownership-and-control, rr.first-player, rr.doomed-x, rr.card-types, rr.step-1-2, rr.limits, rr.response
// (data/rules/entries.json).
// Control changes, the first player token, card types and the threat a player is treated as having, run through the real
// records of the play family (src/effects/authored/families/play.ts).
import { describe, expect, it } from "vitest";

import { RECORDS } from "../../../effects/authored/families/play.ts";

import { holds } from "../../interpret/conditions.ts";
import { gainSeatResources } from "../../interpret/interpret.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import { qualifyingEnemies } from "../../quest/quest.ts";
import { ruleCause } from "../../core/cause.ts";
import { raiseThreat } from "../../core/keywords.ts";
import { updateCard, withThreat, type ScenarioState } from "../../core/state.ts";
import { attachTo, moveCard } from "../../core/zones.ts";
import { crossTo, offered, passResponses, play, playCtx, put, run, seat, send, trigger, triggers } from "./fixture.ts";

const ctx = playCtx(RECORDS);

function attach(state: ScenarioState, code: string, hostId: string, seatIndex = 0): { state: ScenarioState; id: string } {
  const made = put(state, code, "play", seatIndex);
  return { state: attachTo(made.state, made.id, hostId), id: made.id };
}

describe("giving control of a card to another player", () => {
  it("Rider of the Mark goes to the chosen player with its attachments, still its owner's card (04033:A:1)", () => {
    const table = seat(2, ["dwarf", "rohan"]);
    const rider = put(table.state, "04033", "play");
    const blade = attach(rider.state, "blade", rider.id);
    const given = trigger(blade.state, rider.id, "04033:action:1", ctx, [{ heroId: table.heroes[1] ?? "", amount: 1 }]);
    expect(given.cards[rider.id]).toMatchObject({ zone: "play", controller: 1, owner: 0, attachments: [blade.id] });
    expect(given.cards[blade.id]).toMatchObject({ zone: "play", controller: 1, owner: 0, host: rider.id });
    expect(given.seats[1].play).toEqual(expect.arrayContaining([rider.id, blade.id]));
    expect(given.seats[0].play).toEqual([]);
    // Once a round.
    expect(triggers(given, ctx, "04033:action:1")).toEqual([]);
    // Discarded, it goes to its owner's discard pile.
    const gone = moveCard(given, rider.id, { zone: "discard", seat: given.cards[rider.id]?.owner ?? 1 });
    expect(gone.seats[0].discard).toEqual(expect.arrayContaining([rider.id, blade.id]));
  });

  it("Blue Mountain Trader: the new controller moves a resource to your hero, or it is discarded (08006:A:1)", () => {
    const table = seat(2, ["dwarf", "rohan"]);
    const trader = put(table.state, "08006", "play");
    let state = trigger(trader.state, trader.id, "08006:action:1", ctx);
    expect(state.cards[trader.id]?.controller).toBe(1);
    // The other player decides.
    expect(state.window).toMatchObject({ kind: "choose", seat: 1, options: ["move", "discard"] });
    state = send(state, { type: "Choose", optionId: "move" }, ctx);
    expect(state.window).toMatchObject({ kind: "choose", seat: 1, options: [table.heroes[2], table.heroes[3]] });
    state = send(state, { type: "Choose", optionId: table.heroes[3] ?? "" }, ctx);
    expect(state.window).toMatchObject({ kind: "choose", seat: 1, options: [table.heroes[0], table.heroes[1]] });
    state = send(state, { type: "Choose", optionId: table.heroes[0] ?? "" }, ctx);
    expect(state.cards[table.heroes[3] ?? ""]?.resources).toBe(4);
    expect(state.cards[table.heroes[0] ?? ""]?.resources).toBe(6);
    // With nothing to move, it is discarded.
    const poor = [2, 3].reduce((acc, index) => updateCard(acc, table.heroes[index] ?? "", { resources: 0 }), trader.state);
    const discarded = trigger(poor, trader.id, "08006:action:1", ctx);
    expect(discarded.cards[trader.id]?.zone).toBe("discard");
    expect(discarded.seats[0].discard).toContain(trader.id);
  });

  it("Desperate Alliance gives a hero and its resources to another player until the end of the phase (132010:A:1)", () => {
    const table = seat(2, ["dwarf", "rohan"]);
    const event = put(table.state, "132010", "hand");
    const hero = table.heroes[1] ?? "";
    let state = play(event.state, event.id, ctx);
    state = send(state, { type: "Choose", optionId: hero }, ctx);
    expect(state.cards[hero]).toMatchObject({ zone: "heroes", controller: 1, owner: 0, resources: 5 });
    expect(state.seats[1].heroes).toContain(hero);
    const back = crossTo(state, "Quest", ctx);
    expect(back.cards[hero]?.controller).toBe(0);
    expect(back.cards[hero]?.owner).toBeUndefined();
    expect(back.seats[0].heroes).toContain(hero);
  });

  it("Defender of the West keeps the attached ally with the first player, as the token moves (08093:A:2)", () => {
    const table = seat(2, ["dwarf", "rohan"]);
    const ally = put(table.state, "helper", "play", 1);
    const defender = attach(ally.state, "08093", ally.id, 1);
    let state = run(defender.state, ctx);
    expect(state.cards[ally.id]?.controller).toBe(0);
    expect(state.cards[defender.id]?.controller).toBe(0);
    state = run({ ...state, firstPlayer: 1 }, ctx);
    expect(state.cards[ally.id]).toMatchObject({ controller: 1 });
    expect(state.cards[ally.id]?.owner).toBeUndefined();
  });

  it("Soldier of Isengard is offered to go to a player whose threat the doomed keyword raised (22057:A:2)", () => {
    const table = seat(2, ["dwarf", "rohan"]);
    const soldier = put(table.state, "22057", "play");
    const raised = run(raiseThreat(raiseThreat({ ...soldier.state, window: null }, 0, 2, [], ruleCause("rr.doomed-x")), 1, 2, [], ruleCause("rr.doomed-x")), ctx);
    expect(triggers(raised, ctx, "22057:response:1")).toHaveLength(1);
    const given = trigger(raised, soldier.id, "22057:response:1", ctx);
    expect(given.cards[soldier.id]?.controller).toBe(1);
    // Any other raise is not the doomed keyword.
    const plain = run(raiseThreat({ ...soldier.state, window: null }, 1, 2, [], ruleCause("rr.step-3-4")), ctx);
    expect(triggers(plain, ctx, "22057:response:1")).toEqual([]);
  });

  it("Ceorl: any player may ready him, then give him to another player (12058:A:1)", () => {
    const table = seat(2, ["dwarf", "rohan"]);
    const ceorl = put(table.state, "12058", "play");
    const tired = updateCard(ceorl.state, ceorl.id, { exhausted: true });
    const theirTurn = { ...tired, activeSeat: 1 };
    expect(triggers(theirTurn, ctx, "12058:action:1")).toHaveLength(1);
    let state = trigger(theirTurn, ceorl.id, "12058:action:1", ctx, [{ heroId: table.heroes[3] ?? "", amount: 1 }]);
    expect(state.cards[ceorl.id]?.exhausted).toBe(false);
    expect(state.window).toMatchObject({ kind: "choose", seat: 1, options: ["give", "keep"] });
    state = send(state, { type: "Choose", optionId: "give" }, ctx);
    expect(state.cards[ceorl.id]).toMatchObject({ controller: 0 });
  });

  it("Follow Me!: the actor takes the first player token and draws a card (08085:A:1)", () => {
    const table = seat(2, ["dwarf", "rohan"]);
    const event = put(table.state, "08085", "hand", 1);
    const card = put(event.state, "filler", "deck", 1);
    const state = play({ ...card.state, activeSeat: 1 }, event.id, ctx);
    expect(state.firstPlayer).toBe(1);
    expect(state.cards[card.id]?.zone).toBe("hand");
  });
});

describe("card types and the threat a player is treated as having", () => {
  it("Sword-thain: the attached ally is a hero among its controller's heroes, collects resources, and is an ally again when it goes (10149:A:2)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const ally = put(table.state, "helper", "play");
    const sword = attach(ally.state, "10149", ally.id);
    const hero = run(sword.state, ctx);
    expect(hero.cards[ally.id]?.zone).toBe("heroes");
    expect(hero.seats[0].heroes).toContain(ally.id);
    expect(pickCandidates(hero, { type: "hero", control: "you" }, 0, [], null, ctx)).toContain(ally.id);
    expect(pickCandidates(hero, { type: "ally", control: "you" }, 0, [], null, ctx)).not.toContain(ally.id);
    expect(gainSeatResources(hero, 0, [], ruleCause("rr.step-1-2")).cards[ally.id]?.resources).toBe(1);
    const lost = run(moveCard(hero, sword.id, { zone: "discard", seat: 0 }), ctx);
    expect(lost.cards[ally.id]?.zone).toBe("play");
    expect(lost.seats[0].heroes).not.toContain(ally.id);
  });

  it("Vanish from Sight: until the end of the phase a threat above 20 is treated as 20 (12011:A:2)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const event = put(withThreat(table.state, 0, 32), "12011", "hand");
    const orc = put(event.state, "orc", "staging");
    expect(qualifyingEnemies(orc.state, 0, ctx.cards)).toEqual([orc.id]);
    const vanished = play(orc.state, event.id, ctx);
    expect(vanished.seats[0].threat).toBe(32);
    expect(holds(vanished, { kind: "threat", max: 20 }, { actor: 0, sourceId: null, returned: 0 }, ctx)).toBe(true);
    expect(qualifyingEnemies(vanished, 0, ctx.cards)).toEqual([]);
    const later = crossTo(vanished, "Quest", ctx);
    expect(holds(later, { kind: "threat", max: 20 }, { actor: 0, sourceId: null, returned: 0 }, ctx)).toBe(false);
  });

  it("Gwaihir readies after an Eagle ally enters play or leaves play, once a phase (22108:A:3)", () => {
    const table = seat(1, ["22108", "gondor"]);
    const gwaihir = table.heroes[0] ?? "";
    const eagle = put(updateCard(table.state, gwaihir, { exhausted: true }), "eagle", "hand");
    const entered = run(play(eagle.state, eagle.id, ctx, [{ heroId: gwaihir, amount: 2 }]), ctx);
    expect(triggers(entered, ctx, "22108:response:1")).toHaveLength(1);
    const readied = trigger(entered, gwaihir, "22108:response:1", ctx);
    expect(readied.cards[gwaihir]?.exhausted).toBe(false);
    // Leaving play is heard too, but the limit is spent for the phase.
    const again = run(moveCard(updateCard(passResponses(readied, ctx), gwaihir, { exhausted: true }), eagle.id, { zone: "hand", seat: 0 }), ctx);
    expect(triggers(again, ctx, "22108:response:1")).toEqual([]);
    // Next phase, an Eagle ally leaving play readies him.
    const back = put({ ...passResponses(again, ctx), phase: "Quest", boundaryPhase: "Quest" }, "eagle", "play");
    const left = run(moveCard(back.state, back.id, { zone: "hand", seat: 0 }), ctx);
    expect(triggers(left, ctx, "22108:response:1")).toHaveLength(1);
  });
});

describe("events that go back to the hand", () => {
  it("Swift and Silent returns to the hand the first time it is played each round at threat 20 or less (08003:A:1)", () => {
    const table = seat(1, ["lore", "rohan"]);
    const event = put(updateCard(table.state, table.heroes[0] ?? "", { exhausted: true }), "08003", "hand");
    let state = play(event.state, event.id, ctx);
    state = send(state, { type: "Choose", optionId: table.heroes[0] ?? "" }, ctx);
    expect(state.cards[table.heroes[0] ?? ""]?.exhausted).toBe(false);
    expect(state.cards[event.id]?.zone).toBe("hand");
    // The second time this round it is discarded.
    state = send(play(state, event.id, ctx), { type: "Choose", optionId: table.heroes[0] ?? "" }, ctx);
    expect(state.cards[event.id]?.zone).toBe("discard");
    // Above 20 threat it is discarded the first time too.
    const high = put(withThreat(table.state, 0, 25), "08003", "hand");
    const spent = send(play(high.state, high.id, ctx), { type: "Choose", optionId: table.heroes[0] ?? "" }, ctx);
    expect(spent.cards[high.id]?.zone).toBe("discard");
  });

  it("Master of Lore names a card type: the next Lore card of that type costs 1 less this phase, not below 1 (05016:A:1)", () => {
    const table = seat(1, ["lore", "rohan"]);
    const master = put(table.state, "05016", "play");
    let state = trigger(master.state, master.id, "05016:action:1", ctx);
    expect(state.window).toMatchObject({ kind: "choose", options: ["ally", "attachment", "event", "player-side-quest"] });
    state = send(state, { type: "Choose", optionId: "ally" }, ctx);
    expect(state.discounts).toEqual([expect.objectContaining({ seat: 0, amount: 1, min: 1, until: "endOfPhase" })]);
    expect(offered(state, ctx).length).toBeGreaterThan(0);
  });
});
