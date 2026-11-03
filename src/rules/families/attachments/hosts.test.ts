// Rules: rr.attachment-cards, rr.quest-advancement, rr.step-3-4, rr.active-location, rr.explored, rr.blank, rr.travel,
// rr.in-play-and-out-of-play (data/rules/entries.json).
// Player attachments on locations, quest cards and threat dials: what they may be attached to, and what they do there.
// Real records with fixture cards.
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";

import type { Effect } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../intents.ts";
import { modifiedStat } from "../../keywords.ts";
import { legalTargets } from "../../legal.ts";
import { settle } from "../../machine.ts";
import { placeQuestProgress, stagingThreat } from "../../quest.ts";
import { reduce } from "../../reduce.ts";
import { flagged, updateCard, withMode, type ScenarioState } from "../../state.ts";
import { travelIntent } from "../../travel.ts";
import { attachTo, spawn } from "../../zones.ts";
import { attachmentCtx, deck, offered, play, put, resolveChoices, seat, send } from "./fixture.ts";

// Bog (a fixture): "While Bog is in play, it gets +2 Threat." "Travel: Raise each player's threat by 3."
const bogRecords: Effect[] = [
  { id: "bog:constant:1", cardCode: "bog", lines: ["fixture:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: 2, until: "whileSourceInPlay" }] },
  { id: "bog:travel:1", cardCode: "bog", lines: ["fixture:A:2"], timing: "travel", instructions: [{ verb: "RaiseThreat", amount: 3, who: "eachSeat" }] },
];
const ctx = attachmentCtx([...EFFECTS, ...bogRecords]);

// Settles the table in a mode no step moves, so constants and queued events catch up.
function idle(state: ScenarioState, steps: EngineStep[] = []): ScenarioState {
  return settle({ ...state, mode: "stopped", window: null }, ctx, steps);
}

describe("an attachment on a quest card (The Long Defeat, The Road Goes Ever On)", () => {
  it("may go on the current quest card, once per quest, and answers that quest card's defeat for each player", () => {
    let state = seat(1, ["ranger", "hobbit"], "stage1").state;
    state = { ...state, stages: [{ code: "stage1" }, { code: "stage2" }] };
    state = spawn(state, "stage2", { zone: "questDeck" }).state;
    const quest = state.questStage ?? "";
    const defeat = put(state, "10122", "hand");
    const road = put(defeat.state, "16012", "hand");
    expect(legalTargets(road.state, { type: "PlayCard", cardId: defeat.id }, ctx)).toEqual([quest]);
    expect(legalTargets(road.state, { type: "PlayCard", cardId: road.id }, ctx)).toEqual([quest]);
    const attached = play(road.state, defeat.id, ctx, quest);
    expect(attached.cards[quest]?.attachments).toEqual([defeat.id]);
    const second = put(attached, "10122", "hand");
    expect(legalTargets(second.state, { type: "PlayCard", cardId: second.id }, ctx)).toEqual([]);
    // A damaged hero; the quest card is defeated.
    const damaged = updateCard(attached, Object.values(attached.cards).find((card) => card.code === "ranger")?.id ?? "", { damage: 3 });
    const steps: EngineStep[] = [];
    const advanced = idle(placeQuestProgress(damaged, 3, ctx.cards, steps, () => true), steps);
    expect(advanced.cards[quest]?.zone).toBe("setAside");
    expect(advanced.cards[defeat.id]?.zone).toBe("discard");
    expect(offered(advanced, ctx)).toContainEqual({ type: "Trigger", cardId: defeat.id, effectId: "10122:response:1" });
    const asked = send(advanced, { type: "Trigger", cardId: defeat.id, effectId: "10122:response:1" }, ctx);
    expect(asked.window).toEqual({ kind: "choose", seat: 0, options: ["draw", "heal"] });
    // Heal up to 5 from among his characters, one damage at a time: 2, then stop.
    const ranger = Object.values(asked.cards).find((card) => card.code === "ranger")?.id ?? "";
    let healing = send(asked, { type: "Choose", optionId: "heal" }, ctx);
    healing = send(healing, { type: "Choose", optionId: ranger }, ctx);
    healing = send(healing, { type: "Choose", optionId: ranger }, ctx);
    expect(healing.window?.kind === "choose" && healing.window.options).toContain("done");
    const done = send(healing, { type: "Choose", optionId: "done" }, ctx);
    expect(done.cards[ranger]?.damage).toBe(1);
    expect(done.window).toBeNull();
  });
});

describe("Favor of the Valar on a player's threat dial", () => {
  it("is offered each player's dial, goes into that player's play area under their control, and only once per player", () => {
    const table = seat(2);
    const favor = put(table.state, "10124", "hand");
    expect(legalTargets(favor.state, { type: "PlayCard", cardId: favor.id }, ctx)).toEqual(["seat:0", "seat:1"]);
    const played = play(favor.state, favor.id, ctx, "seat:1");
    expect(played.cards[favor.id]).toMatchObject({ zone: "play", controller: 1, owner: 0, host: null });
    expect(played.seats[1].play).toContain(favor.id);
    const again = put(played, "10124", "hand");
    expect(legalTargets(again.state, { type: "PlayCard", cardId: again.id }, ctx)).toEqual(["seat:0"]);
    expect(reduce(again.state, { type: "PlayCard", cardId: again.id, payments: [], hostId: "seat:1" }, ctx).ok).toBe(false);
  });
});

describe("Explorer's Almanac", () => {
  it("asks whether progress from questing goes on the attached location before the quest, and places it there", () => {
    const table = seat(1, ["ranger", "hobbit"]);
    const marsh = put(table.state, "marsh", "staging");
    const almanac = put(marsh.state, "11011", "hand");
    expect(legalTargets(almanac.state, { type: "PlayCard", cardId: almanac.id }, ctx)).toEqual([marsh.id]);
    const attached = play(almanac.state, almanac.id, ctx, marsh.id);
    let state = attached;
    for (const id of table.heroes) state = updateCard(state, id, { committed: true, exhausted: true });
    // 4 willpower against the marsh's 2 Threat: 2 progress.
    const asked = settle({ ...withMode({ ...state, window: null }, "resolution"), boundaryPhase: "Quest" }, ctx, []);
    expect(asked.window).toEqual({ kind: "choose", seat: 0, options: ["location", "quest"] });
    const done = send(asked, { type: "Choose", optionId: "location" }, ctx);
    expect(done.cards[marsh.id]?.progress).toBe(2);
    expect(done.cards[done.questStage ?? ""]?.progress).toBe(0);
  });

  it("places it on the quest when the players say so, and asks nothing when the quest fails", () => {
    const table = seat(1, ["ranger", "hobbit"]);
    const marsh = put(table.state, "marsh", "staging");
    const almanac = put(marsh.state, "11011", "play");
    let state = attachTo(almanac.state, almanac.id, marsh.id);
    for (const id of table.heroes) state = updateCard(state, id, { committed: true, exhausted: true });
    const asked = settle({ ...withMode({ ...state, window: null }, "resolution"), boundaryPhase: "Quest" }, ctx, []);
    const done = send(asked, { type: "Choose", optionId: "quest" }, ctx);
    expect(done.cards[marsh.id]?.progress).toBe(0);
    expect(done.cards[done.questStage ?? ""]?.progress).toBe(2);
    const failing = put(state, "warg", "staging");
    const failed = settle({ ...withMode({ ...failing.state, window: null }, "resolution"), boundaryPhase: "Quest" }, ctx, []);
    expect(failed.window?.kind).not.toBe("choose");
  });
});

describe("locations with player attachments", () => {
  it("places progress on the location Hithlain is attached to after any player plays a Silvan ally from the hand", () => {
    const table = seat(2);
    const marsh = put(table.state, "marsh", "staging");
    const hithlain = put(marsh.state, "12088", "hand");
    const attached = play(hithlain.state, hithlain.id, ctx, marsh.id);
    const ally = put({ ...attached, activeSeat: 1, planningSeat: 1 }, "silvan", "hand", 1);
    const played = play(ally.state, ally.id, ctx);
    expect(offered(played, ctx)).toContainEqual({ type: "Trigger", cardId: hithlain.id, effectId: "12088:response:1" });
    const done = send(played, { type: "Trigger", cardId: hithlain.id, effectId: "12088:response:1" }, ctx);
    expect(done.cards[marsh.id]?.progress).toBe(1);
  });

  it("puts Woodmen's Path only on a location with no progress, and sets its quest points to 1 while it is active", () => {
    const table = seat();
    const marsh = put(table.state, "marsh", "staging");
    const ford = put(marsh.state, "ford", "staging");
    const path = put(updateCard(ford.state, ford.id, { progress: 1 }), "19030", "hand");
    expect(legalTargets(path.state, { type: "PlayCard", cardId: path.id }, ctx)).toEqual([marsh.id]);
    const attached = play(path.state, path.id, ctx, marsh.id);
    expect(modifiedStat(attached, attached.cards[marsh.id]!, "questPoints", ctx.cards)).toBe(3);
    const steps: EngineStep[] = [];
    const traveled = idle(travelIntent(attached, marsh.id, ctx, steps) , steps);
    expect(traveled.activeLocation).toBe(marsh.id);
    expect(modifiedStat(traveled, traveled.cards[marsh.id]!, "questPoints", ctx.cards)).toBe(1);
  });

  it("keeps heroes ready as they quest, attack and defend while Path of Need's location is active", () => {
    const table = seat();
    const ford = put(table.state, "ford", "activeLocation");
    const path = put(ford.state, "04103", "play");
    const state = idle(attachTo(path.state, path.id, ford.id));
    for (const id of table.heroes) {
      expect(flagged(state, id, "noExhaustQuest")).toBe(true);
      expect(flagged(state, id, "noExhaustAttack")).toBe(true);
      expect(flagged(state, id, "noExhaustDefend")).toBe(true);
    }
    const away = idle({ ...state, activeLocation: null, staging: [ford.id], cards: { ...state.cards, [ford.id]: { ...state.cards[ford.id]!, zone: "staging" } } });
    expect(flagged(away, table.heroes[0] ?? "", "noExhaustQuest")).toBe(false);
  });

  it("discards until a location, adds it to the staging area and shuffles a non-unique enemy away when Put Off Pursuit's location is explored", () => {
    const table = seat();
    const built = deck(table.state, ["mist", "ford", "orc"]);
    const marsh = put(built.state, "marsh", "activeLocation");
    const warg = put(marsh.state, "warg", "staging");
    const troll = put(warg.state, "troll", "staging");
    const pursuit = put(troll.state, "21008", "hand");
    const attached = play(pursuit.state, pursuit.id, ctx, marsh.id);
    const steps: EngineStep[] = [];
    // The marsh has 3 quest points, +2 from Put Off Pursuit.
    const explored = idle(placeQuestProgress(attached, 5, ctx.cards, steps, () => true), steps);
    expect(explored.cards[marsh.id]?.zone).toBe("encounterDiscard");
    expect(offered(explored, ctx)).toContainEqual({ type: "Trigger", cardId: pursuit.id, effectId: "21008:response:1" });
    const done = send(explored, { type: "Trigger", cardId: pursuit.id, effectId: "21008:response:1" }, ctx);
    const [mist, ford] = built.ids;
    expect(done.encounterDiscard).toContain(mist);
    // The ford is in the staging area; the troll is unique, so only the warg can go, and it is shuffled into the deck.
    expect(done.staging).toContain(ford);
    expect(done.staging).toContain(troll.id);
    expect(done.cards[warg.id]?.zone).toBe("encounterDeck");
  });
});

describe("Thrór's Key", () => {
  it("moves from its hero to a location added to the staging area, whose printed text box is then blank", () => {
    const table = seat();
    const key = put(table.state, "132016", "play");
    let state = attachTo(key.state, key.id, table.heroes[0] ?? "");
    const built = deck(state, ["bog"]);
    state = built.state;
    const bog = built.ids[0] ?? "";
    const staged = settle({ ...withMode({ ...state, window: null }, "staging"), boundaryPhase: "Quest" }, ctx, []);
    expect(offered(staged, ctx)).toContainEqual({ type: "Trigger", cardId: key.id, effectId: "132016:response:1" });
    const before = stagingThreat(staged, ctx.cards);
    const moved = resolveChoices(staged, ctx, ["132016:response:1"]);
    expect(moved.cards[key.id]?.host).toBe(bog);
    expect(moved.cards[table.heroes[0] ?? ""]?.attachments).not.toContain(key.id);
    expect(flagged(moved, bog, "blankText")).toBe(true);
    // Bog's +2 Threat is gone, and its Travel effect does not resolve.
    expect(before).toBe(3);
    expect(modifiedStat(moved, moved.cards[bog]!, "threat", ctx.cards)).toBe(1);
    const steps: EngineStep[] = [];
    const traveled = travelIntent({ ...moved, phase: "Travel", mode: "travel", window: { kind: "travel" } }, bog, ctx, steps);
    expect(traveled.activeLocation).toBe(bog);
    expect(traveled.seats[0].threat).toBe(moved.seats[0].threat);
  });
});
