// Rules: rr.encounter-deck, rr.search, rr.effects, rr.then, rr.active-location, rr.step-3-3, rr.resources, rr.doomed-x,
// rr.lasting-effects (data/rules/entries.json).
// The encounter family's verbs that look at, search and move the encounter deck, run through the real records of the cards
// that use them (src/effects/authored/families/encounter.ts).
import { describe, expect, it } from "vitest";

import { RECORDS } from "../../../effects/authored/families/encounter.ts";

import { modifiedStat } from "../../keywords.ts";
import { settle } from "../../machine.ts";
import { offerResponses } from "../../responses.ts";
import { updateCard, withThreat, type ScenarioState } from "../../state.ts";
import { attachTo } from "../../zones.ts";
import { deck, encounterCtx, offered, play, put, resolveChoices, seat, send } from "./fixture.ts";

const ctx = encounterCtx(RECORDS);
const codes = (state: ScenarioState, ids: readonly string[]) => ids.map((id) => state.cards[id]?.code);

// Offers the Responses to an event, as the engine does once no window is open.
function respond(state: ScenarioState, event: Parameters<typeof offerResponses>[1]): ScenarioState {
  return settle(offerResponses({ ...state, window: null }, event, ctx, []), ctx, []);
}

// The quest phase's commit window, open for the first player.
function questWindow(state: ScenarioState): ScenarioState {
  return { ...state, phase: "Quest", mode: "questCommit", boundaryPhase: "Quest", window: { kind: "pass" }, activeSeat: 0 };
}

describe("looking at the top of the encounter deck", () => {
  it("shows the actor the top card, then lets them move it to the bottom (Denethor, 01010:A:1)", () => {
    const table = seat(1, ["01010", "hobbit"]);
    const built = deck(table.state, ["orc", "marsh", "mist"]);
    const denethor = table.heroes[0] ?? "";
    expect(offered(built.state, ctx)).toContainEqual({ type: "Trigger", cardId: denethor, effectId: "01010:action:1" });
    const looking = send(built.state, { type: "Trigger", cardId: denethor, effectId: "01010:action:1" }, ctx);
    expect(looking.window).toEqual({ kind: "look", seat: 0, cardIds: [built.ids[0]] });
    expect(looking.cards[denethor]?.exhausted).toBe(true);
    const asked = send(looking, { type: "Pass" }, ctx);
    expect(asked.window).toEqual({ kind: "choose", seat: 0, options: ["bottom", "leave"] });
    const done = send(asked, { type: "Choose", optionId: "bottom" }, ctx);
    expect(codes(done, done.encounterDeck)).toEqual(["marsh", "mist", "orc"]);
    expect(done.cards[built.ids[0] ?? ""]?.face).toBe("down");
    expect(done.window).toEqual({ kind: "pass" });
  });

  it("moves one of the top 3 to the bottom and puts the others back in the order chosen (Risk Some Light, 04136:A:2)", () => {
    const table = seat();
    const built = deck(table.state, ["orc", "marsh", "mist", "ford"]);
    const event = put(built.state, "04136", "hand");
    const looking = play(event.state, event.id, ctx);
    expect(looking.window).toEqual({ kind: "look", seat: 0, cardIds: built.ids.slice(0, 3) });
    let state = send(send(looking, { type: "Pass" }, ctx), { type: "Choose", optionId: "bottom" }, ctx);
    expect(state.window).toEqual({ kind: "choose", seat: 0, options: built.ids.slice(0, 3) });
    state = send(state, { type: "Choose", optionId: built.ids[1] ?? "" }, ctx);
    // The two left on top: the actor names the new top card.
    expect(state.window).toEqual({ kind: "choose", seat: 0, options: [built.ids[0], built.ids[2]] });
    state = send(state, { type: "Choose", optionId: built.ids[2] ?? "" }, ctx);
    expect(codes(state, state.encounterDeck)).toEqual(["mist", "orc", "ford", "marsh"]);
    expect(state.cards[event.id]?.zone).toBe("discard");
  });

  it("puts the top 5 back in the same order (Far-sighted, 22058:A:2)", () => {
    const built = deck(seat().state, ["orc", "marsh", "mist", "ford", "gust", "troll"]);
    const event = put(built.state, "22058", "hand");
    const looking = play(event.state, event.id, ctx);
    expect(looking.window).toEqual({ kind: "look", seat: 0, cardIds: built.ids.slice(0, 5) });
    expect(send(looking, { type: "Pass" }, ctx).encounterDeck).toEqual(built.ids);
  });

  it("reads X from the Threat of the card looked at (Needful to Know, 04009:A:2)", () => {
    const built = deck(withThreat(seat().state, 0, 20), ["troll", "orc"]);
    const event = put(built.state, "04009", "hand");
    const looking = play(event.state, event.id, ctx);
    expect(looking.seats[0].threat).toBe(21);
    expect(send(looking, { type: "Pass" }, ctx).seats[0].threat).toBe(18);
  });

  it("offers to discard the card only when it is the type the card names (Ithilien Lookout 08008:A:2, Celduin Traveler 08089:A:2)", () => {
    const built = deck(seat().state, ["orc", "marsh"]);
    const lookout = put(built.state, "08008", "hand");
    let state = play(lookout.state, lookout.id, ctx);
    expect(offered(state, ctx)).toContainEqual({ type: "Trigger", cardId: lookout.id, effectId: "08008:response:1" });
    state = send(send(state, { type: "Trigger", cardId: lookout.id, effectId: "08008:response:1" }, ctx), { type: "Pass" }, ctx);
    expect(state.window).toEqual({ kind: "choose", seat: 0, options: ["discard", "keep"] });
    state = send(state, { type: "Choose", optionId: "discard" }, ctx);
    expect(codes(state, state.encounterDiscard)).toEqual(["orc"]);
    // The top card is now a location: the Traveler may discard it, the Lookout could not have.
    const traveler = put(state, "08089", "hand");
    state = send(play(traveler.state, traveler.id, ctx), { type: "Trigger", cardId: traveler.id, effectId: "08089:response:1" }, ctx);
    state = send(send(state, { type: "Pass" }, ctx), { type: "Choose", optionId: "discard" }, ctx);
    expect(codes(state, state.encounterDiscard)).toEqual(["orc", "marsh"]);
  });

  it("draws only when the card looked at is not an enemy (Cautious Halfling, 22004:A:1)", () => {
    let built = deck(seat().state, ["orc", "mist"]);
    built = { ...built, state: put(put(built.state, "helper", "deck").state, "helper", "deck").state };
    const first = put(built.state, "22004", "hand");
    let state = resolveChoices(send(play(first.state, first.id, ctx), { type: "Trigger", cardId: first.id, effectId: "22004:response:1" }, ctx), ctx);
    expect(state.seats[0].hand).toHaveLength(0);
    state = { ...state, encounterDeck: [...state.encounterDeck.slice(1), state.encounterDeck[0] ?? ""] };
    const second = put(state, "22004", "hand");
    state = resolveChoices(send(play(second.state, second.id, ctx), { type: "Trigger", cardId: second.id, effectId: "22004:response:1" }, ctx), ctx);
    expect(state.seats[0].hand).toHaveLength(1);
  });

  it("places progress on the quest for a location, else lowers the ally's willpower (Longbeard Elder, 04102:A:1)", () => {
    const table = seat();
    const built = deck(table.state, ["marsh", "orc"]);
    const elder = put(built.state, "04102", "play");
    const committed = questWindow(updateCard(elder.state, elder.id, { committed: true, exhausted: true }));
    const responding = respond(committed, { trigger: "committed", seat: 0, cardId: elder.id });
    const done = resolveChoices(send(responding, { type: "Trigger", cardId: elder.id, effectId: "04102:response:1" }, ctx), ctx);
    expect(done.cards[done.questStage ?? ""]?.progress).toBe(1);
    expect(modifiedStat(done, done.cards[elder.id]!, "willpower", ctx.cards)).toBe(1);
    const moved = { ...done, encounterDeck: [...done.encounterDeck.slice(1), done.encounterDeck[0] ?? ""] };
    const again = respond(moved, { trigger: "committed", seat: 0, cardId: elder.id });
    const lowered = resolveChoices(send(again, { type: "Trigger", cardId: elder.id, effectId: "04102:response:1" }, ctx), ctx);
    expect(modifiedStat(lowered, lowered.cards[elder.id]!, "willpower", ctx.cards)).toBe(0);
  });

  it("names a type and draws for each match, raising threat by 2 for each other card (Palantir, 06090:A:2)", () => {
    const table = seat();
    let state = deck(withThreat(table.state, 0, 20), ["orc", "marsh", "orc", "mist"]).state;
    for (let count = 0; count < 3; count += 1) state = put(state, "helper", "deck").state;
    const palantir = put(state, "06090", "play");
    state = attachTo(palantir.state, palantir.id, table.heroes[0] ?? "");
    state = send(state, { type: "Trigger", cardId: palantir.id, effectId: "06090:action:1" }, ctx);
    expect(state.window).toEqual({ kind: "choose", seat: 0, options: ["enemy", "location", "treachery", "objective"] });
    state = resolveChoices(state, ctx, ["enemy"]);
    expect(state.seats[0].hand).toHaveLength(2);
    expect(state.seats[0].threat).toBe(22);
    expect(state.cards[table.heroes[0] ?? ""]?.exhausted).toBe(true);
  });
});

describe("the encounter discard pile and the encounter deck", () => {
  it("moves the top card of the discard pile to the top of the deck (Shadow of the Past, 02125:A:1)", () => {
    let state = deck(seat().state, ["marsh"]).state;
    state = put(state, "mist", "encounterDiscard").state;
    const top = put(state, "orc", "encounterDiscard");
    const event = put(top.state, "02125", "hand");
    const done = play(event.state, event.id, ctx);
    expect(done.encounterDeck[0]).toBe(top.id);
    expect(codes(done, done.encounterDiscard)).toEqual(["mist"]);
    expect(done.cards[top.id]?.face).toBe("down");
  });

  it("shuffles the discard pile back in after a Dwarf leaves play (The End Comes, 04037:A:1)", () => {
    let state = deck(seat().state, ["marsh"]).state;
    for (const code of ["mist", "orc"]) state = put(state, code, "encounterDiscard").state;
    const dwarf = put(state, "04102", "play");
    const event = put(dwarf.state, "04037", "hand");
    const offeredState = respond(event.state, { trigger: "leftPlay", seat: 0, cardId: dwarf.id });
    const done = send(offeredState, { type: "Trigger", cardId: event.id, effectId: "04037:response:1" }, ctx);
    expect(done.encounterDiscard).toEqual([]);
    expect(codes(done, done.encounterDeck).sort()).toEqual(["marsh", "mist", "orc"]);
  });

  it("returns an explored location worth no victory points to the top of the deck (A Watchful Peace, 05012:A:1)", () => {
    const base = deck(seat().state, ["orc"]).state;
    const marsh = put(base, "marsh", "encounterDiscard");
    const keep = put(marsh.state, "keep", "encounterDiscard");
    const event = put(keep.state, "05012", "hand");
    // The Keep prints victory points: nothing is offered.
    expect(offerResponses(event.state, { trigger: "leftPlay", seat: null, cardId: keep.id }, ctx, []).stack).toHaveLength(0);
    const asked = respond(event.state, { trigger: "leftPlay", seat: null, cardId: marsh.id });
    const done = send(asked, { type: "Trigger", cardId: event.id, effectId: "05012:response:1" }, ctx);
    expect(done.encounterDeck[0]).toBe(marsh.id);
  });
});

describe("searching the encounter deck (rr.search)", () => {
  it("puts a non-unique enemy from the top 5 into play engaged with you, and keeps the ally (Dúnedain Hunter, 09004:A:1)", () => {
    const built = deck(seat().state, ["troll", "marsh", "orc", "mist", "ford", "orc"]);
    const hunter = put(built.state, "09004", "hand");
    const done = play(hunter.state, hunter.id, ctx);
    expect(codes(done, done.seats[0].engaged)).toEqual(["orc"]);
    expect(done.cards[done.seats[0].engaged[0] ?? ""]?.face).toBe("up");
    expect(done.cards[hunter.id]?.zone).toBe("play");
    expect(done.encounterDeck).toHaveLength(5);
  });

  it("discards the ally when no enemy enters play (09004:A:1, Dunedain Pathfinder 17033:A:1)", () => {
    const built = deck(seat().state, ["troll", "marsh", "mist", "gust", "relic", "orc"]);
    const hunter = put(built.state, "09004", "hand");
    const done = play(hunter.state, hunter.id, ctx);
    expect(done.cards[hunter.id]?.zone).toBe("discard");
    expect(done.seats[0].engaged).toEqual([]);
    const finder = put(done, "17033", "hand");
    const found = play(finder.state, finder.id, ctx);
    expect(codes(found, found.staging)).toEqual(["marsh"]);
    expect(found.cards[finder.id]?.zone).toBe("play");
  });

  it("discards a non-unique active location and makes one from the deck or discard pile active (Distant Stars, 10036:A:1)", () => {
    let state = deck(seat().state, ["orc", "keep"]).state;
    const ford = put(state, "ford", "activeLocation");
    state = put(ford.state, "marsh", "encounterDiscard").state;
    const event = put(state, "10036", "hand");
    const asked = play(event.state, event.id, ctx);
    // The Keep is unique; the Marsh and the Ford just discarded are not.
    expect(asked.window?.kind === "choose" ? codes(asked, asked.window.options).sort() : []).toEqual(["ford", "marsh"]);
    const marsh = asked.encounterDiscard.find((id) => asked.cards[id]?.code === "marsh") ?? "";
    const done = send(asked, { type: "Choose", optionId: marsh }, ctx);
    expect(done.cards[ford.id]?.zone).toBe("encounterDiscard");
    expect(done.activeLocation).toBe(marsh);
    expect(done.cards[marsh]?.face).toBe("up");
  });

  it("adds an enemy to the staging area and lowers the next ally's cost by its Threat (The Gathering Storm, 21007:A:1)", () => {
    const built = deck(seat().state, ["marsh", "orc"]);
    const event = put(built.state, "21007", "hand");
    const done = play(event.state, event.id, ctx);
    expect(codes(done, done.staging)).toEqual(["orc"]);
    expect(done.discounts).toEqual([expect.objectContaining({ seat: 0, amount: 2, until: "endOfPhase" })]);
  });

  it("switches a location in the top 5 with one in the staging area (Mariner's Compass, 11008:A:2)", () => {
    const table = seat();
    const built = deck(table.state, ["orc", "marsh", "mist"]);
    const ford = put(built.state, "ford", "staging");
    const compass = put(ford.state, "11008", "play");
    let state = attachTo(compass.state, compass.id, table.heroes[0] ?? "");
    state = { ...state, phase: "Travel", mode: "travel", boundaryPhase: "Travel", window: null, pendingEvents: [{ trigger: "beginningOfPhase", seat: null, phase: "Travel" }] };
    state = settle(state, ctx, []);
    expect(offered(state, ctx)).toContainEqual({ type: "Trigger", cardId: compass.id, effectId: "11008:response:1" });
    state = send(state, { type: "Trigger", cardId: compass.id, effectId: "11008:response:1" }, ctx);
    expect(codes(state, state.staging)).toEqual(["marsh"]);
    expect(state.encounterDeck).toContain(ford.id);
    expect(state.cards[ford.id]?.face).toBe("down");
  });
});

describe("the staging step reveals fewer cards (rr.step-3-3)", () => {
  it("makes a location from the top 5 active, the old one returning to the staging area, and reveals 1 less (The Hidden Way, 19007:A:1)", () => {
    let state = deck(seat().state, ["orc", "marsh", "mist"]).state;
    const ford = put(state, "ford", "activeLocation");
    const event = put(ford.state, "19007", "hand");
    state = send(event.state, { type: "Pass" }, ctx);
    expect(offered(state, ctx)).toContainEqual({ type: "Trigger", cardId: event.id, effectId: "19007:response:1" });
    state = send(state, { type: "Trigger", cardId: event.id, effectId: "19007:response:1" }, ctx);
    expect(state.cards[state.activeLocation ?? ""]?.code).toBe("marsh");
    expect(state.staging).toEqual([ford.id]);
    expect(state.mode).toBe("questCommit");
    const before = state.encounterDeck.length;
    const staged = send(state, { type: "Pass" }, ctx);
    // Solo, the one card of the staging step is not revealed.
    expect(staged.encounterDeck).toHaveLength(before);
    expect(staged.staging).toEqual([ford.id]);
  });

  it("reveals 1 less to a minimum of 1 (Gildor's Counsel, 02080:A:2)", () => {
    const table = seat(2);
    const built = deck(questWindow(table.state), ["orc", "marsh", "mist", "ford"]);
    const event = put(built.state, "02080", "hand");
    let state = play(event.state, event.id, ctx);
    state = send(send(state, { type: "Pass" }, ctx), { type: "Pass" }, ctx);
    // Two players reveal one card between them.
    expect(codes(state, state.staging)).toEqual(["orc"]);
    expect(state.encounterDeck).toHaveLength(3);
  });

  it("engages an enemy from the top 5 at the beginning of the quest phase and reveals 1 less (Wait no Longer, 17005:A:1)", () => {
    const built = deck(seat().state, ["marsh", "orc", "mist"]);
    const event = put(built.state, "17005", "hand");
    let state = send(send(event.state, { type: "Pass" }, ctx), { type: "Trigger", cardId: event.id, effectId: "17005:response:1" }, ctx);
    expect(codes(state, state.seats[0].engaged)).toEqual(["orc"]);
    state = send(state, { type: "Pass" }, ctx);
    expect(state.staging).toEqual([]);
  });
});

describe("paying and returning an event", () => {
  it("pays 1 Lore resource to return the event to the hand (Rumour from the Earth, 02124:A:1)", () => {
    const table = seat();
    const built = deck(table.state, ["orc"]);
    const event = put(built.state, "02124", "hand");
    const asked = send(play(event.state, event.id, ctx), { type: "Pass" }, ctx);
    expect(asked.window).toEqual({ kind: "choose", seat: 0, options: ["return", "discard"] });
    const returned = send(asked, { type: "Choose", optionId: "return" }, ctx);
    expect(returned.cards[event.id]?.zone).toBe("hand");
    expect(returned.cards[table.heroes[0] ?? ""]?.resources).toBe(4);
    // With no Lore resource left, it is discarded without asking.
    const broke = updateCard(returned, table.heroes[0] ?? "", { resources: 0 });
    const done = send(play(broke, event.id, ctx), { type: "Pass" }, ctx);
    expect(done.cards[event.id]?.zone).toBe("discard");
  });
});

describe("Vilya (04137:A:2)", () => {
  function vilya(topCode: string) {
    const table = seat(1, ["elrond", "hobbit"]);
    const top = put(table.state, topCode, "deck");
    const ring = put(top.state, "04137", "play");
    const state = attachTo(ring.state, ring.id, table.heroes[0] ?? "");
    return { state, top: top.id, ring: ring.id, elrond: table.heroes[0] ?? "" };
  }

  it("reveals the top card of your deck and puts an ally into play for no cost", () => {
    const { state, top, ring, elrond } = vilya("helper");
    const looking = send(state, { type: "Trigger", cardId: ring, effectId: "04137:action:1" }, ctx);
    expect(looking.window).toEqual({ kind: "look", seat: 0, cardIds: [top] });
    const done = send(send(looking, { type: "Pass" }, ctx), { type: "Choose", optionId: "play" }, ctx);
    expect(done.cards[top]?.zone).toBe("play");
    expect(done.cards[elrond]?.resources).toBe(5);
    expect(done.cards[elrond]?.exhausted).toBe(true);
  });

  it("moves a card it cannot play to the bottom of the deck", () => {
    const { state, top, ring } = vilya("04037");
    const withCard = put(state, "helper", "deck");
    const done = resolveChoices(send(withCard.state, { type: "Trigger", cardId: ring, effectId: "04137:action:1" }, ctx), ctx, ["play"]);
    expect(done.seats[0].deck).toEqual([withCard.id, top]);
  });
});
