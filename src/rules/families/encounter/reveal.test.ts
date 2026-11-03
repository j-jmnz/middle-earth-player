// Rules: rr.staging, rr.step-3-3, rr.reveal, rr.cancel, rr.surge, rr.lasting-effects, rr.active-location, rr.travel,
// rr.step-3-4, rr.then (data/rules/entries.json).
// What the encounter family adds to the staging of encounter cards: cancels that replace the card, Responses to a reveal,
// the lasting effects that watch the reveals, the first location of the round, a card entering play, the start and end of
// the staging step, and threat raised by an encounter card effect. Real records (src/effects/authored/families/encounter.ts)
// with fixture encounter cards.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { RECORDS } from "../../../effects/authored/families/encounter.ts";

import type { EngineStep } from "../../core/intents.ts";
import { modifiedStat } from "../../core/keywords.ts";
import { expectOk } from "../../core/test-fixture.ts";
import { settle } from "../../engine/machine.ts";
import { reduce } from "../../engine/reduce.ts";
import { updateCard, withMode, withThreat, type ScenarioState } from "../../core/state.ts";
import { attachTo } from "../../core/zones.ts";
import { deck, encounterCtx, offered, play, put, resolveChoices, seat, send } from "./fixture.ts";
import { revealsAllowed } from "./reveal.ts";

// Mist: "When Revealed: Raise your threat by 3." (a fixture).
const mistRevealed: Effect = { id: "mist:whenRevealed:1", cardCode: "mist", lines: ["fixture:A:1"], timing: "whenRevealed", instructions: [{ verb: "RaiseThreat", amount: 3 }] };
const ctx = encounterCtx([...RECORDS, mistRevealed]);
const codes = (state: ScenarioState, ids: readonly string[]) => ids.map((id) => state.cards[id]?.code);

// The staging step, run until a player is asked something.
function stage(state: ScenarioState, steps: EngineStep[] = []): ScenarioState {
  return settle({ ...withMode({ ...state, window: null }, "staging"), boundaryPhase: "Quest" }, ctx, steps);
}

// The quest phase's commit window, open for the first player.
function questWindow(state: ScenarioState): ScenarioState {
  return { ...state, phase: "Quest", mode: "questCommit", boundaryPhase: "Quest", window: { kind: "pass" }, activeSeat: 0 };
}

describe("the number of cards the staging step reveals (rr.step-3-3)", () => {
  it("is one per player, less the table's revealFewer flags, to their minimum", () => {
    const state = seat(2).state;
    const flag = (stat: "revealFewer" | "revealFewerMinOne", amount: number) => ({ instanceId: "table", sourceId: "x", stat, amount, until: "endOfPhase" as const });
    expect(revealsAllowed(state, 2)).toBe(2);
    expect(revealsAllowed({ ...state, modifiers: [flag("revealFewerMinOne", 1)] }, 1)).toBe(1);
    expect(revealsAllowed({ ...state, modifiers: [flag("revealFewerMinOne", 2)] }, 2)).toBe(1);
    expect(revealsAllowed({ ...state, modifiers: [flag("revealFewer", 1)] }, 1)).toBe(0);
    expect(revealsAllowed({ ...state, modifiers: [flag("revealFewer", 1), flag("revealFewerMinOne", 1)] }, 3)).toBe(1);
  });
});

describe("canceling a card just revealed and replacing it (rr.cancel)", () => {
  it("cancels a treachery's when revealed effects, discards it and reveals the next card (Eleanor, 01008:A:1)", () => {
    const table = seat(1, ["01008", "hobbit"]);
    const built = deck(withThreat(table.state, 0, 20), ["mist", "orc", "marsh"]);
    const asked = stage(built.state);
    expect(asked.window).toEqual({ kind: "response", seat: 0 });
    expect(offered(asked, ctx)).toContainEqual({ type: "Trigger", cardId: table.heroes[0], effectId: "01008:response:1" });
    const done = send(asked, { type: "Trigger", cardId: table.heroes[0] ?? "", effectId: "01008:response:1" }, ctx);
    // Mist raised nothing; the quest then failed against the orc's 2 threat.
    expect(done.seats[0].threat).toBe(22);
    expect(codes(done, done.encounterDiscard)).toEqual(["mist"]);
    // The replacement is revealed: the orc is in the staging area, and the step revealed nothing more.
    expect(codes(done, done.staging)).toEqual(["orc"]);
    expect(codes(done, done.encounterDeck)).toEqual(["marsh"]);
    expect(done.cards[table.heroes[0] ?? ""]?.exhausted).toBe(true);
  });

  it("offers Eleanor only for a treachery", () => {
    const table = seat(1, ["01008", "hobbit"]);
    const done = stage(deck(table.state, ["orc", "marsh"]).state);
    expect(offered(done, ctx).some((intent) => intent.type === "Trigger" && intent.effectId === "01008:response:1")).toBe(false);
  });

  it("cancels an enemy just revealed, shuffles it back and reveals another (Quick Ears, 10123:A:1)", () => {
    const table = seat();
    const built = deck(table.state, ["orc", "marsh"]);
    const event = put(built.state, "10123", "hand");
    const asked = stage(event.state);
    expect(offered(asked, ctx)).toContainEqual({ type: "Trigger", cardId: event.id, effectId: "10123:response:1" });
    const done = send(asked, { type: "Trigger", cardId: event.id, effectId: "10123:response:1" }, ctx);
    expect(done.cards[table.heroes[0] ?? ""]?.exhausted).toBe(true);
    expect(done.staging).toHaveLength(1);
    expect(done.encounterDeck).toHaveLength(1);
    expect(done.cards[event.id]?.zone).toBe("discard");
  });
});

describe("Responses to a card just revealed", () => {
  it("readies Gimli after an enemy is revealed (143004:A:2)", () => {
    const gimli = put(deck(seat().state, ["orc"]).state, "143004", "play");
    const asked = stage(updateCard(gimli.state, gimli.id, { exhausted: true }));
    const done = send(asked, { type: "Trigger", cardId: gimli.id, effectId: "143004:response:1" }, ctx);
    expect(done.cards[gimli.id]?.exhausted).toBe(false);
  });

  it("travels to a location just revealed, the active one returning to the staging area (Strider's Path, 02009:A:1)", () => {
    const built = deck(seat().state, ["marsh"]);
    const ford = put(built.state, "ford", "activeLocation");
    const event = put(ford.state, "02009", "hand");
    const done = send(stage(event.state), { type: "Trigger", cardId: event.id, effectId: "02009:response:1" }, ctx);
    expect(done.activeLocation).toBe(built.ids[0]);
    expect(done.staging).toEqual([ford.id]);
  });
});

describe("lasting effects that watch the reveals (rr.lasting-effects)", () => {
  it("discards the next card revealed after a surge card, of the type named, without resolving it (Minas Tirith Lampwright, 06061:A:1)", () => {
    const built = deck(withThreat(seat().state, 0, 20), ["gust", "mist", "orc"]);
    const lamp = put(built.state, "06061", "play");
    const asked = stage(lamp.state);
    const naming = send(asked, { type: "Trigger", cardId: lamp.id, effectId: "06061:response:1" }, ctx);
    expect(naming.window).toEqual({ kind: "choose", seat: 0, options: ["enemy", "location", "treachery"] });
    const done = send(naming, { type: "Choose", optionId: "treachery" }, ctx);
    expect(done.cards[lamp.id]?.zone).toBe("discard");
    // Gust surged into Mist, which is discarded unresolved: no threat. The watcher ended with that reveal.
    expect(done.seats[0].threat).toBe(20);
    expect(codes(done, done.encounterDiscard)).toEqual(["gust", "mist"]);
    expect(done.modifiers.filter((modifier) => modifier.stat === "watchDiscard")).toEqual([]);
  });

  it("deals 2 damage to the first enemy revealed this phase only (Expecting Mischief, 131018:A:2)", () => {
    const table = seat(2);
    const built = deck(questWindow(table.state), ["orc", "orc"]);
    const event = put(built.state, "131018", "hand");
    let state = play(event.state, event.id, ctx);
    state = send(send(state, { type: "Pass" }, ctx), { type: "Pass" }, ctx);
    expect(built.ids.map((id) => state.cards[id]?.damage)).toEqual([2, 0]);
  });

  it("lowers the Threat of the next enemy added to the staging area to 0 until the end of the phase (Ithilien Tracker, 05015:A:1)", () => {
    const built = deck(questWindow(seat().state), ["orc"]);
    const tracker = put(built.state, "05015", "play");
    const watching = send(tracker.state, { type: "Trigger", cardId: tracker.id, effectId: "05015:action:1" }, ctx);
    const quested = expectOk(reduce(watching, { type: "Pass" }, ctx));
    expect(quested.state.cards[built.ids[0] ?? ""]?.zone).toBe("staging");
    // The quest is resolved against 0 threat, and the phase is over: the orc has its Threat again.
    expect(quested.steps.find((step) => step.kind === "quest")).toMatchObject({ threat: 0 });
    expect(modifiedStat(quested.state, quested.state.cards[built.ids[0] ?? ""]!, "threat", ctx.cards)).toBe(2);
  });

  it("readies the attached hero when a card of the named type is revealed this quest phase (Wingfoot, 08092:A:2)", () => {
    const table = seat();
    const ranger = table.heroes[0] ?? "";
    const built = deck(questWindow(table.state), ["orc", "marsh"]);
    const wingfoot = put(built.state, "08092", "play");
    let state = attachTo(wingfoot.state, wingfoot.id, ranger);
    state = send(state, { type: "Commit", cardIds: [ranger] }, ctx);
    expect(offered(state, ctx)).toContainEqual({ type: "Trigger", cardId: wingfoot.id, effectId: "08092:response:1" });
    state = send(send(state, { type: "Trigger", cardId: wingfoot.id, effectId: "08092:response:1" }, ctx), { type: "Choose", optionId: "enemy" }, ctx);
    expect(state.cards[ranger]?.exhausted).toBe(true);
    state = send(state, { type: "Pass" }, ctx);
    expect(state.cards[ranger]?.exhausted).toBe(false);
    expect(state.cards[wingfoot.id]?.exhausted).toBe(true);
  });

  it("places 1 progress on the first location revealed each round while the host is committed (Warden of Arnor, 08031:A:2)", () => {
    const table = seat(2);
    const hobbit = table.heroes[1] ?? "";
    const built = deck(table.state, ["marsh", "ford"]);
    const warden = put(built.state, "08031", "play");
    const state = attachTo(updateCard(warden.state, hobbit, { committed: true, exhausted: true }), warden.id, hobbit);
    const done = stage(state);
    expect(built.ids.map((id) => done.cards[id]?.progress)).toEqual([1, 0]);
  });

  it("raises no event and keeps no marker in a game without a card that hears it", () => {
    const steps: EngineStep[] = [];
    const done = stage(deck(seat().state, ["marsh"]).state, steps);
    expect(done.modifiers).toEqual([]);
    expect(done.pendingEvents ?? []).toEqual([]);
  });
});

describe("a card entering play, and the staging step's start and end", () => {
  it("shuffles a location back once it has entered play, then reveals a card (Short Cut, 04060:A:1)", () => {
    const table = seat();
    const built = deck(table.state, ["marsh", "orc"]);
    const event = put(built.state, "04060", "hand");
    const asked = stage(event.state);
    expect(offered(asked, ctx)).toContainEqual({ type: "Trigger", cardId: event.id, effectId: "04060:response:1" });
    const done = send(asked, { type: "Trigger", cardId: event.id, effectId: "04060:response:1" }, ctx);
    expect(done.cards[table.heroes[1] ?? ""]?.exhausted).toBe(true);
    expect(done.staging).toHaveLength(1);
    expect(done.encounterDeck).toHaveLength(1);
  });

  it("discards a non-unique enemy in the staging area once the characters are committed, then reveals a card (Hunting Party, 17057:A:2)", () => {
    const built = deck(seat().state, ["marsh", "ford", "relic"]);
    const orc = put(built.state, "orc", "staging");
    const event = put(orc.state, "17057", "hand");
    const asked = stage(event.state);
    const done = send(asked, { type: "Trigger", cardId: event.id, effectId: "17057:response:1" }, ctx);
    expect(done.cards[orc.id]?.zone).toBe("encounterDiscard");
    // The Response's card and the staging step's card.
    expect(codes(done, done.staging)).toEqual(["marsh", "ford"]);
  });

  it("discards until a treachery at the end of the staging step, resolves it, and readies the questing characters (A Desperate Path, 22145:A:1)", () => {
    const table = seat();
    const ranger = table.heroes[0] ?? "";
    const built = deck(withThreat(table.state, 0, 20), ["ford", "orc", "mist", "marsh"]);
    const event = put(built.state, "22145", "hand");
    const asked = stage(updateCard(event.state, ranger, { committed: true, exhausted: true }));
    expect(offered(asked, ctx)).toContainEqual({ type: "Trigger", cardId: event.id, effectId: "22145:response:1" });
    const result = expectOk(reduce(asked, { type: "Trigger", cardId: event.id, effectId: "22145:response:1" }, ctx));
    const done = result.state;
    expect(codes(done, done.encounterDiscard)).toEqual(["orc", "mist"]);
    expect(done.cards[ranger]?.exhausted).toBe(false);
    // Mist raised the threat by 3; the ranger quested with 2 + 1 willpower against the ford's 1.
    expect(result.steps.find((step) => step.kind === "quest")).toMatchObject({ willpower: 3, threat: 1 });
    expect(done.seats[0].threat).toBe(23);
  });
});

describe("threat raised by an encounter card effect", () => {
  it("is lowered by the same amount (Free to Choose, 08062:A:1)", () => {
    const built = deck(withThreat(seat().state, 0, 20), ["mist"]);
    const event = put(built.state, "08062", "hand");
    const asked = stage(event.state);
    expect(asked.seats[0].threat).toBe(23);
    const done = send(asked, { type: "Trigger", cardId: event.id, effectId: "08062:response:1" }, ctx);
    expect(done.seats[0].threat).toBe(20);
  });

  it("is not heard when the threat comes from questing unsuccessfully (rr.step-3-4)", () => {
    const table = seat();
    const built = deck(withThreat(table.state, 0, 20), ["orc"]);
    const event = put(built.state, "08062", "hand");
    const done = resolveChoices(stage(event.state), ctx);
    expect(done.seats[0].threat).toBe(22);
    expect(offered(done, ctx).some((intent) => intent.type === "Trigger" && intent.cardId === event.id)).toBe(false);
  });
});
