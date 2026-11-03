// Rules: rr.encounter-deck, rr.search, rr.effects, rr.active-location, rr.attachment-cards (data/rules/entries.json).
// The encounter family's verbs in combat and after it: an enemy put back into the encounter deck, the top card discarded for
// its Threat, cards discarded until an enemy, and progress from the card looked at. Real records
// (src/effects/authored/families/encounter.ts) with fixture encounter cards.
import { describe, expect, it } from "vitest";

import { RECORDS } from "../../../effects/authored/families/encounter.ts";

import { settle } from "../../machine.ts";
import { offerResponses } from "../../responses.ts";
import { updateCard, withThreat, type ScenarioState } from "../../state.ts";
import { attachTo } from "../../zones.ts";
import { deck, encounterCtx, offered, play, put, resolveChoices, seat, send } from "./fixture.ts";

const ctx = encounterCtx(RECORDS);
const codes = (state: ScenarioState, ids: readonly string[]) => ids.map((id) => state.cards[id]?.code);

function respond(state: ScenarioState, event: Parameters<typeof offerResponses>[1]): ScenarioState {
  return settle(offerResponses({ ...state, window: null }, event, ctx, []), ctx, []);
}

describe("after an enemy attacks you (A Elbereth! Gilthoniel!, 04132:A:2)", () => {
  it("puts a non-unique enemy on the bottom of the encounter deck and raises your threat to its engagement cost", () => {
    const built = deck(withThreat(seat().state, 0, 20), ["marsh"]);
    const orc = put(built.state, "orc", "engaged");
    const event = put(orc.state, "04132", "hand");
    const asked = respond(event.state, { trigger: "attackResolved", seat: 0, cardId: orc.id });
    const done = send(asked, { type: "Trigger", cardId: event.id, effectId: "04132:response:1" }, ctx);
    expect(done.encounterDeck).toEqual([built.ids[0], orc.id]);
    expect(done.seats[0].engaged).toEqual([]);
    expect(done.seats[0].threat).toBe(25);
  });

  it("is not offered for a unique enemy, and does not lower a higher threat", () => {
    const base = withThreat(seat().state, 0, 30);
    const troll = put(base, "troll", "engaged");
    const event = put(troll.state, "04132", "hand");
    expect(offerResponses({ ...event.state, window: null }, { trigger: "attackResolved", seat: 0, cardId: troll.id }, ctx, []).stack).toHaveLength(0);
    const orc = put(event.state, "orc", "engaged");
    const done = send(respond(orc.state, { trigger: "attackResolved", seat: 0, cardId: orc.id }), { type: "Trigger", cardId: event.id, effectId: "04132:response:1" }, ctx);
    expect(done.seats[0].threat).toBe(30);
  });
});

describe("after the attached hero exhausts to defend (Sting, 142011:A:3)", () => {
  it("discards the top card of the encounter deck and deals its Threat in damage to the attacker", () => {
    const table = seat();
    const ranger = table.heroes[0] ?? "";
    const built = deck(table.state, ["troll", "marsh"]);
    const orc = put(built.state, "orc", "engaged");
    const sting = put(orc.state, "142011", "play");
    let state = attachTo(updateCard(sting.state, ranger, { exhausted: true }), sting.id, ranger);
    state = { ...state, pendingAttack: { enemyId: orc.id, seat: 0, defenderId: ranger } };
    const asked = respond(state, { trigger: "declaredDefender", seat: 0, cardId: ranger, other: orc.id });
    expect(offered(asked, ctx)).toContainEqual({ type: "Trigger", cardId: sting.id, effectId: "142011:response:1" });
    const done = send(asked, { type: "Trigger", cardId: sting.id, effectId: "142011:response:1" }, ctx);
    expect(done.encounterDiscard[0]).toBe(built.ids[0]);
    // The troll's 3 Threat destroys the 3 hit point orc.
    expect(done.cards[orc.id]?.zone).toBe("encounterDiscard");
  });
});

describe("after you attack and destroy an enemy (Bilbo's Plan, 22114:A:1)", () => {
  it("shuffles the discard pile in, discards to an enemy, adds it to the staging area and discards a location no more threatening", () => {
    const table = seat();
    let state = deck(table.state, ["mist"]).state;
    state = put(state, "orc", "encounterDiscard").state;
    const ford = put(state, "ford", "staging");
    const keep = put(ford.state, "keep", "staging");
    const event = put(keep.state, "22114", "hand");
    const asked = respond(event.state, { trigger: "attackDestroyed", seat: 0, cardId: table.heroes[0] ?? "", other: "gone" });
    const done = send(asked, { type: "Trigger", cardId: event.id, effectId: "22114:response:1" }, ctx);
    // The orc (Threat 2) is added; the Keep (Threat 4, unique) stays, the Ford (Threat 1) goes.
    expect(codes(done, done.staging).sort()).toEqual(["keep", "orc"]);
    expect(done.cards[ford.id]?.zone).toBe("encounterDiscard");
  });
});

describe("progress from the card looked at (Ravens of the Mountain, 132011:A:1)", () => {
  it("exhausts a hero, shuffles, and places progress equal to the top card's Threat, leaving it on top", () => {
    const table = seat();
    const built = deck(table.state, ["troll", "troll", "troll"]);
    const event = put(built.state, "132011", "hand");
    const done = resolveChoices(play(event.state, event.id, ctx), ctx);
    expect(done.cards[done.questStage ?? ""]?.progress).toBe(3);
    expect(done.encounterDeck).toHaveLength(3);
    expect(table.heroes.filter((id) => done.cards[id]?.exhausted)).toHaveLength(1);
  });
});

describe("after Firyal commits to the quest (17008:A:1)", () => {
  it("looks at the top card and may discard it", () => {
    const built = deck(seat().state, ["marsh", "orc"]);
    const firyal = put(built.state, "17008", "play");
    const committed = { ...updateCard(firyal.state, firyal.id, { committed: true, exhausted: true }), phase: "Quest" as const, mode: "questCommit" as const };
    const asked = respond(committed, { trigger: "committed", seat: 0, cardId: firyal.id });
    const looked = send(asked, { type: "Trigger", cardId: firyal.id, effectId: "17008:response:1" }, ctx);
    expect(looked.window).toEqual({ kind: "look", seat: 0, cardIds: [built.ids[0]] });
    const done = send(send(looked, { type: "Pass" }, ctx), { type: "Choose", optionId: "discard" }, ctx);
    expect(done.encounterDiscard).toEqual([built.ids[0]]);
  });
});
