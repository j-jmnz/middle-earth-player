// Rules: rr.attachment-cards, rr.in-play-and-out-of-play, rr.destroy, rr.hit-points, rr.limits, rr.constant-ability
// (data/rules/entries.json).
// Cards leaving play and what happens to them after, run through the real records of the play family
// (src/effects/authored/families/play.ts).
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { RECORDS } from "../../../effects/authored/families/play.ts";

import { ruleCause } from "../../cause.ts";
import { placeDamage } from "../../keywords.ts";
import { updateCard, type ScenarioState } from "../../state.ts";
import { attachTo, cardsUnder, moveCard } from "../../zones.ts";
import { crossTo, offered, passResponses, play, playCtx, put, run, seat, send, trigger, triggers } from "./fixture.ts";

const ctx = playCtx(RECORDS);

function destroy(state: ScenarioState, id: string, context = ctx): ScenarioState {
  return run(placeDamage({ ...state, window: null }, id, 9, context.cards, [], "player", ruleCause("rr.damage")), context);
}

function attach(state: ScenarioState, code: string, hostId: string, seat = 0): { state: ScenarioState; id: string } {
  const made = put(state, code, "play", seat);
  return { state: attachTo(made.state, made.id, hostId), id: made.id };
}

describe("a card that leaves play takes its attachments with it", () => {
  it("discards an ally's attachments when it returns to its owner's hand, and clears the host links (rr.attachment-cards)", () => {
    const table = seat();
    const ally = put(table.state, "helper", "play");
    const blade = attach(ally.state, "blade", ally.id, 0);
    const returned = moveCard(blade.state, ally.id, { zone: "hand", seat: 0 });
    expect(returned.cards[blade.id]).toMatchObject({ zone: "discard", host: null, controller: 0 });
    expect(returned.cards[ally.id]?.attachments).toEqual([]);
    expect(returned.seats[0].discard).toContain(blade.id);
    expect(returned.pendingEvents).toContainEqual({ trigger: "leftPlayWithAttachments", seat: 0, subject: ally.id, attachments: [blade.id] });
  });

  it("sends an attachment to its owner's discard pile when another player controls it", () => {
    const table = seat(2);
    const ally = put(table.state, "helper", "play", 1);
    const blade = attach(ally.state, "blade", ally.id, 1);
    const given = updateCard(updateCard(blade.state, blade.id, { owner: 0 }), ally.id, {});
    const shuffled = moveCard(given, ally.id, { zone: "deck", seat: 1 });
    expect(shuffled.cards[blade.id]).toMatchObject({ zone: "discard", controller: 0 });
  });

  it("announces an attachment played as entering play, and drops its host link when it discards itself", () => {
    const listen: Effect = { id: "gondor:response:1", cardCode: "gondor", lines: ["gondor:A:1"], timing: "response", trigger: "enteredPlay", subject: { type: "attachment", control: "you" }, instructions: [{ verb: "Draw" }] };
    const drop: Effect = { id: "blade:action:1", cardCode: "blade", lines: ["blade:A:1"], timing: "action", instructions: [{ verb: "Discard", target: { kind: "self" } }] };
    const context = playCtx([...RECORDS, listen, drop]);
    const table = seat(1, ["gondor", "rohan"]);
    const blade = put(table.state, "blade", "hand");
    const hero = table.heroes[0] ?? "";
    const played = play(blade.state, blade.id, context, [], hero);
    expect(triggers(played, context, "gondor:response:1")).toEqual([{ type: "Trigger", cardId: hero, effectId: "gondor:response:1" }]);
    const discarded = trigger(passResponses(played, context), blade.id, "blade:action:1", context);
    expect(discarded.cards[blade.id]).toMatchObject({ zone: "discard", host: null });
    expect(discarded.cards[hero]?.attachments).toEqual([]);
  });
});

describe("abilities that answer a card leaving play", () => {
  it("Bard son of Brand returns the attachments of a character that left play to their owners' hands, once a phase (18002:A:2)", () => {
    const table = seat(1, ["18002", "rohan"]);
    const ally = put(table.state, "helper", "play");
    const blade = attach(ally.state, "blade", ally.id);
    const bard = table.heroes[0] ?? "";
    const destroyed = destroy(blade.state, ally.id);
    expect(triggers(destroyed, ctx, "18002:response:1")).toEqual([{ type: "Trigger", cardId: bard, effectId: "18002:response:1" }]);
    const returned = trigger(destroyed, bard, "18002:response:1", ctx);
    expect(returned.cards[blade.id]?.zone).toBe("hand");
    expect(returned.cards[ally.id]?.zone).toBe("discard");
    // A character with no attachments is not offered; nor a second time this phase.
    const plain = put(passResponses(returned, ctx), "helper", "play");
    expect(triggers(destroy(plain.state, plain.id), ctx, "18002:response:1")).toEqual([]);
    const other = put(passResponses(returned, ctx), "eagle", "play");
    const sword = attach(other.state, "blade", other.id);
    expect(triggers(destroy(sword.state, other.id), ctx, "18002:response:1")).toEqual([]);
  });

  it("Horn of the Mark draws a card when a character that shares a trait with the attached hero leaves play (22035:A:2)", () => {
    const table = seat(1, ["rohan", "dwarf"]);
    const horn = attach(table.state, "22035", table.heroes[0] ?? "");
    const rider = put(horn.state, "rider", "play");
    const helper = put(rider.state, "helper", "play");
    const deck = put(helper.state, "filler", "deck");
    expect(triggers(destroy(deck.state, helper.id), ctx, "22035:response:1")).toEqual([]);
    const left = destroy(deck.state, rider.id);
    expect(triggers(left, ctx, "22035:response:1")).toHaveLength(1);
    const drawn = trigger(left, horn.id, "22035:response:1", ctx);
    expect(drawn.cards[deck.id]?.zone).toBe("hand");
    expect(drawn.cards[horn.id]?.exhausted).toBe(true);
  });

  it("Eagles of the Misty Mountains takes another Eagle that left play facedown, and lets it go with itself (02119:A:2)", () => {
    const table = seat(1, ["gondor", "rohan"]);
    const eagles = put(table.state, "02119", "play");
    const scout = put(eagles.state, "eagle", "play");
    const left = destroy(scout.state, scout.id);
    const taken = trigger(left, eagles.id, "02119:response:1", ctx);
    expect(taken.cards[scout.id]).toMatchObject({ zone: "under", host: eagles.id, face: "down", owner: 0, controller: null });
    expect(cardsUnder(taken, eagles.id)).toEqual([scout.id]);
    // It is out of play: not a character, no text.
    expect(offered(taken, ctx).some((intent) => intent.type === "Trigger" && intent.cardId === scout.id)).toBe(false);
    const gone = moveCard(passResponses(taken, ctx), eagles.id, { zone: "hand", seat: 0 });
    expect(gone.cards[scout.id]).toMatchObject({ zone: "discard", face: "up", controller: 0 });
    expect(gone.seats[0].discard).toContain(scout.id);
  });

  it("Gamling and Éothain answer a Rohan ally discarded by a card effect, not one destroyed by damage (144007:A:1, 10141:A:1, rr.destroy)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const gamling = put(table.state, "144007", "play");
    const eothain = put(gamling.state, "10141", "play");
    const elfhelm = put(updateCard(eothain.state, eothain.id, { exhausted: true }), "146006", "hand");
    // Elfhelm, discarded by his own delayed effect at the end of the phase.
    const entered = trigger(elfhelm.state, elfhelm.id, "146006:action:1", ctx);
    const ended = crossTo(entered, "Quest", ctx);
    expect(ended.cards[elfhelm.id]?.zone).toBe("discard");
    expect(triggers(ended, ctx, "144007:response:1")).toHaveLength(1);
    expect(triggers(ended, ctx, "10141:response:1")).toHaveLength(1);
    const readied = trigger(ended, eothain.id, "10141:response:1", ctx);
    expect(readied.cards[eothain.id]?.exhausted).toBe(false);
    const back = trigger(readied, gamling.id, "144007:response:1", ctx);
    expect(back.cards[elfhelm.id]?.zone).toBe("hand");
    expect(back.cards[gamling.id]?.exhausted).toBe(true);
    // Destroyed by damage: not discarded.
    const rider = put(updateCard(table.state, table.heroes[0] ?? "", {}), "144007", "play");
    const victim = put(rider.state, "rider", "play");
    const killed = destroy(victim.state, victim.id);
    expect(triggers(killed, ctx, "144007:response:1")).toEqual([]);
  });

  it("Landroval goes back to his owner's hand to put a destroyed hero back into play with 1 damage, once per game (02053:A:3)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const landroval = put(table.state, "02053", "play");
    const hero = table.heroes[0] ?? "";
    const destroyed = destroy(landroval.state, hero);
    expect(destroyed.cards[hero]?.zone).toBe("discard");
    const saved = trigger(destroyed, landroval.id, "02053:response:1", ctx);
    expect(saved.cards[landroval.id]?.zone).toBe("hand");
    expect(saved.cards[hero]).toMatchObject({ zone: "heroes", damage: 1, controller: 0 });
    // Played again, he cannot do it a second time this game.
    const again = put(passResponses(saved, ctx), "02053", "play");
    expect(triggers(destroy(again.state, table.heroes[1] ?? ""), ctx, "02053:response:1")).toEqual([]);
  });

  it("Eryn Galen Settler discards itself as the active location is explored, for a staging location of the same title (17035:A:1)", () => {
    const table = seat();
    const settler = put(table.state, "17035", "play");
    const active = put(settler.state, "marsh", "activeLocation");
    const twin = put(active.state, "marsh", "staging");
    const ford = put(twin.state, "ford", "staging");
    const explored = run({ ...ford.state, window: null, activeLocation: active.id, pendingEvents: [{ trigger: "activeExplored", seat: null, subject: active.id }] }, ctx);
    const discarded = trigger(explored, settler.id, "17035:response:1", ctx);
    expect(discarded.cards[settler.id]?.zone).toBe("discard");
    expect(discarded.cards[twin.id]?.zone).toBe("encounterDiscard");
    expect(discarded.cards[ford.id]?.zone).toBe("staging");
  });
});

describe("cards that leave play by their own rule", () => {
  it("discards Denethor as soon as his Willpower is 0 or less (06057:A:2)", () => {
    const table = seat();
    const denethor = put(table.state, "06057", "play");
    expect(run(denethor.state, ctx).cards[denethor.id]?.zone).toBe("play");
    const weakened = { ...denethor.state, modifiers: [{ instanceId: denethor.id, sourceId: denethor.id, stat: "willpower" as const, amount: -1, until: "endOfRound" as const }] };
    expect(run(weakened, ctx).cards[denethor.id]?.zone).toBe("discard");
  });

  it("discards Dwarven Sellsword at the end of the round unless the players as a group spend 1 Leadership resource (12083:A:1)", () => {
    const table = seat(2, ["dwarf", "rohan"]);
    const sellsword = put(table.state, "12083", "play");
    const ending = { ...sellsword.state, phase: "End of round" as const, boundaryPhase: "End of round" as const };
    let state = crossTo(ending, "Beginning of round", ctx);
    expect(state.window).toMatchObject({ kind: "choose", options: ["spend", "discard"] });
    state = send(state, { type: "Choose", optionId: "spend" }, ctx);
    // Either player's Leadership hero may pay.
    expect(state.window).toMatchObject({ kind: "choose", options: [table.heroes[0], table.heroes[2]] });
    state = send(state, { type: "Choose", optionId: table.heroes[2] ?? "" }, ctx);
    expect(state.cards[sellsword.id]?.zone).toBe("play");
    expect(state.cards[table.heroes[2] ?? ""]?.resources).toBe(4);
    // No Leadership resource to spend: discarded.
    const broke = [0, 2].reduce<ScenarioState>((acc, index) => updateCard(acc, table.heroes[index] ?? "", { resources: 0 }), ending);
    expect(crossTo(broke, "Beginning of round", ctx).cards[sellsword.id]?.zone).toBe("discard");
  });

  it("lets any resource keep Wilyador (22117:A:3)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const wilyador = put(table.state, "22117", "play");
    const ending = updateCard({ ...wilyador.state, phase: "End of round" as const, boundaryPhase: "End of round" as const }, table.heroes[0] ?? "", { resources: 0 });
    let state = crossTo(ending, "Beginning of round", ctx);
    state = send(state, { type: "Choose", optionId: "spend" }, ctx);
    expect(state.cards[wilyador.id]?.zone).toBe("play");
    expect(state.cards[table.heroes[1] ?? ""]?.resources).toBe(4);
  });
});
