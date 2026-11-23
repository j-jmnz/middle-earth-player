// Rules: hob.venom-poison, hob.unconscious-characters, hob.staging-area-creating, rr.active-location, rr.explored, rr.travel, rr.forced, rr.response, rr.then (data/rules/entries.json). The locations of Flies and Spiders (132025 to 132027), each test from the printed line (data/printed/the-hobbit.json)
// on a table built from data/ by the layout kit, and run again without the records of its line (`lineSpec`). 132025:A:1 (Immune to player card effects) is a keyword the printed card gives, with no record.
import { expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { flagged, updateCard, type GameEvent, type ScenarioState } from "../../../rules/core/state.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { settle } from "../../../rules/engine/machine.ts";
import type { PlayerIntent } from "../../../rules/engine/reduce.ts";
import { givePoison, makeUnconscious, poisonOf } from "../../../rules/families/poison/poison.ts";
import { stageOf, stagingOf } from "../../../rules/families/breaking/areas.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { offerResponses } from "../../../rules/windows/responses.ts";
import { finish, idOf, legalIntents, legalTargets, send, start } from "../../../../test/harness/scene-kit.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { codeOf, fire, GLADE, placeIn, spiderTable, splitTable, withBilbo } from "../../../../test/scenarios/flies-and-spiders/scene.ts";

const on = (effects: readonly Effect[], layout: Parameters<typeof spiderTable>[0] = {}) => spiderTable(layout, { effects });
type Table = ReturnType<typeof on>;
const synced = (t: Table, state: ScenarioState) => syncConstants(state, t.ctx);
const stat = (t: Table, state: ScenarioState, id: string, which: Parameters<typeof modifiedStat>[2]) => modifiedStat(state, state.cards[id]!, which, t.ctx.cards);
const poisoned = (t: Table, n: number, id = t.hero) => synced(t, givePoison(t.state, id, n, t.ctx, []));
const total = (state: ScenarioState) => state.seats.reduce((sum, seat) => sum + seat.heroes.reduce((inner, id) => inner + poisonOf(state, id), 0), 0);
// The location leaves play (`explored`: as an explored location, or discarded) and the Trigger the engine offers for its Response, if any, is used with every choice answered by its first option.
const afterLeaving = (t: Table, state: ScenarioState, code: string, explored: boolean): { offered: boolean; state: ScenarioState } => {
  const id = idOf(state, code);
  const steps: EngineStep[] = [];
  const open = settle(offerResponses({ ...state, window: null, mode: "stopped" }, { trigger: "leftPlay", seat: 0, cardId: id, explored } as GameEvent, t.ctx, steps), t.ctx, steps);
  const intent = legalIntents(open, t.ctx).find((one) => one.type === "Trigger" && one.cardId === id);
  return intent ? { offered: true, state: finish(send({ state: open, steps }, intent as PlayerIntent, t.ctx), t.ctx).state } : { offered: false, state: open };
};
const travelTargets = (t: Table, state: ScenarioState, seat = 0) => legalTargets({ ...state, phase: "Travel", mode: "travel", window: { kind: "travel" }, activeSeat: seat }, { type: "Travel" }, t.ctx);

// ---- 132025 The Spider's Glade ----
lineSpec("132025:A:2", "Travel: exhaust Bilbo Baggins to travel here; a ready Bilbo travels and is exhausted, an exhausted Bilbo or none cannot", (effects) => {
  // An enemy engaged with the player stops the round at its attack, after the travel and before the refresh phase readies Bilbo again.
  const t = on(effects, { seats: 1, phase: "Travel", staging: [GLADE], engaged: [{ code: "f0", seat: 0 }] });
  const glade = idOf(t.state, GLADE);
  const ready = withBilbo(t.state);
  expect(travelTargets(t, ready.state), "a ready Bilbo pays").toContain(glade);
  const gone = send(start(ready.state), { type: "Travel", locationId: glade }, t.ctx).state;
  expect(gone.activeLocation).toBe(glade);
  expect(gone.cards[ready.id]?.exhausted, "Bilbo exhausted to travel").toBe(true);
  expect(travelTargets(t, updateCard(ready.state, ready.id, { exhausted: true })), "an exhausted Bilbo cannot").not.toContain(glade);
  expect(travelTargets(t, t.state), "with no Bilbo nobody can").not.toContain(glade);
});
// FAULT: the Glade's Travel says "Exhaust Bilbo Baggins" and a staging area is closed to players who do not share it (hob.staging-area-creating), but `readyNamedCard` takes the first ready Bilbo of the table, so the first player's Bilbo pays for a Glade in the other player's area.
it.fails("132025:A:2 Bilbo, who the first player controls at stage 3, cannot pay for a Glade in the staging area of the other player's area", () => {
  const { t, state } = splitTable(EFFECTS);
  const glade = idOf(state, GLADE);
  expect(stagingOf(state, 1), "the Glade lies in the area of the player at stage 4").toContain(glade);
  const bilbo = withBilbo(state, 0);
  expect(travelTargets(t, bilbo.state, 1), "Bilbo is at stage 3 in the other area").not.toContain(glade);
});
it("132025:A:2 Bilbo pays for a Glade in the staging area of the first player's own area", () => {
  const { t, state } = splitTable(EFFECTS);
  const bilbo = withBilbo(state, 0);
  const own = placeIn(bilbo.state, GLADE, 0);
  expect(travelTargets(t, own.state, 0)).toContain(own.id);
});
const spiders = (state: ScenarioState, seat: number) => stagingOf(state, seat).filter((id) => ["132031", "132032"].includes(codeOf(state, id) ?? ""));
lineSpec("132025:A:3", "at the start of each quest phase one Spider enemy is searched from the encounter deck (not the discard pile) and added to the staging area, and the deck is shuffled", (effects) => {
  const t = on(effects, { seats: 1, staging: [GLADE], deck: ["132033", "132031", "132032", "f0"], discard: ["132032"] });
  const out = fire(t.ctx, t.state, { trigger: "beginningOfPhase", seat: null, phase: "Quest" } as GameEvent);
  expect(spiders(out, 0).length, "one Spider is added").toBe(1);
  expect(out.encounterDeck.length).toBe(t.state.encounterDeck.length - 1);
  expect(out.encounterDeck.map((id) => out.cards[id]?.code), "the treachery and the other Spider stay in the deck").toContain("132033");
  expect(out.encounterDiscard.map((id) => out.cards[id]?.code), "the discard pile is not searched").toEqual(["132032"]);
  expect(out.cards[spiders(out, 0)[0] ?? ""]?.zone).toBe("staging");
});
lineSpec("132025:A:3", "with 2 players at the stage only one Spider is added, only in the quest phase, and nothing is added when the deck holds no Spider", (effects) => {
  const t = on(effects, { seats: 2, staging: [GLADE], deck: ["132031", "132032", "132033"] });
  const out = fire(t.ctx, t.state, { trigger: "beginningOfPhase", seat: null, phase: "Quest" } as GameEvent);
  expect(spiders(out, 0).length, "3 or more players are needed for 2 Spiders").toBe(1);
  expect(fire(t.ctx, t.state, { trigger: "beginningOfPhase", seat: null, phase: "Planning" } as GameEvent).staging.length, "not at the start of another phase").toBe(t.state.staging.length);
  const bare = on(effects, { seats: 1, staging: [GLADE], deck: ["132033", "f0"] });
  const none = fire(bare.ctx, bare.state, { trigger: "beginningOfPhase", seat: null, phase: "Quest" } as GameEvent);
  expect(none.staging.length, "no Spider to find").toBe(bare.state.staging.length);
  expect(none.encounterDeck.length, "the deck is shuffled, not changed in size").toBe(bare.state.encounterDeck.length);
});
lineSpec("132025:A:3", "once the players are split the Spider joins the area the Glade lies in, not the area of the token holder", (effects) => {
  const { t, state } = splitTable(effects, { deck: ["132031", "132032"] });
  const out = fire(t.ctx, state, { trigger: "beginningOfPhase", seat: null, phase: "Quest" } as GameEvent);
  expect(spiders(out, 1).length, "the area of the Glade").toBe(1);
  expect(stagingOf(out, 0), "the first player's area").toEqual([]);
  expect(stageOf(out, 0)).toBeDefined();
});

// ---- 132026 Giant Web ----
lineSpec("132026:A:1", "while Giant Web is the active location each character gets -1 Willpower, Attack and Defense for each poison it has, to 0 at the least", (effects) => {
  const t = on(effects, { seats: 1, active: "132026" });
  const base = { w: stat(t, t.state, t.hero, "willpower"), a: stat(t, t.state, t.hero, "attack"), d: stat(t, t.state, t.hero, "defense") };
  const one = poisoned(t, 1);
  expect([stat(t, one, t.hero, "willpower"), stat(t, one, t.hero, "attack"), stat(t, one, t.hero, "defense")]).toEqual([base.w - 1, base.a - 1, base.d - 1]);
  const two = poisoned(t, 2);
  expect(stat(t, two, t.hero, "willpower"), "2 poison, -2").toBe(base.w - 2);
  expect(stat(t, poisoned(t, 5), t.hero, "willpower"), "to 0 at the least").toBe(0);
  expect(stat(t, one, t.hero2, "willpower"), "a character with no poison").toBe(base.w);
});
lineSpec("132026:A:1", "Giant Web in the staging area changes nothing, and with 2 players it reaches the characters of both", (effects) => {
  const staged = on(effects, { seats: 1, staging: ["132026"], active: "132027" });
  const base = stat(staged, staged.state, staged.hero, "willpower");
  expect(stat(staged, poisoned(staged, 1), staged.hero, "willpower"), "not the active location").toBe(base);
  const t = on(effects, { seats: 2, active: "132026" });
  const sick = synced(t, givePoison(givePoison(t.state, t.hero, 1, t.ctx, []), t.seat1Hero, 1, t.ctx, []));
  expect(stat(t, sick, t.seat1Hero ?? "", "attack"), "the other player's poisoned hero").toBe(stat(t, t.state, t.seat1Hero ?? "", "attack") - 1);
  expect(stat(t, sick, t.hero, "attack")).toBe(stat(t, t.state, t.hero, "attack") - 1);
});
lineSpec("132026:A:2", "after Giant Web leaves play as an explored location it readies an unconscious character, chosen by the first player: one of two is readied", (effects) => {
  const t = on(effects, { seats: 1, active: "132026" });
  const down = makeUnconscious(makeUnconscious(t.state, t.hero, t.ctx), t.hero2, t.ctx);
  const out = afterLeaving(t, down, "132026", true);
  expect(out.offered).toBe(true);
  const awake = [t.hero, t.hero2].filter((id) => out.state.cards[id]?.unconscious !== true);
  expect(awake.length, "exactly one is readied").toBe(1);
  expect(out.state.cards[awake[0] ?? ""]?.exhausted).toBe(false);
});
lineSpec("132026:A:2", "is not offered when Giant Web leaves play unexplored, or when no character is unconscious", (effects) => {
  const t = on(effects, { seats: 1, active: "132026" });
  const down = makeUnconscious(t.state, t.hero, t.ctx);
  expect(afterLeaving(t, down, "132026", true).offered, "explored, one unconscious").toBe(true);
  expect(afterLeaving(t, down, "132026", false).offered, "discarded unexplored").toBe(false);
  expect(afterLeaving(t, t.state, "132026", true).offered, "nothing to ready").toBe(false);
});

// ---- 132027 Forest Stream ----
lineSpec("132027:A:1", "while Forest Stream is the active location a poisoned character cannot be committed to the quest, a character with no poison can", (effects) => {
  const t = on(effects, { seats: 1, active: "132027" });
  const state = poisoned(t, 1);
  expect(flagged(state, t.hero, "cannotQuest")).toBe(true);
  expect(flagged(state, t.hero2, "cannotQuest")).toBe(false);
  const at = { ...state, phase: "Quest" as const, mode: "questCommit" as const };
  expect(legalTargets(at, { type: "Commit" }, t.ctx)).not.toContain(t.hero);
  expect(legalTargets(at, { type: "Commit" }, t.ctx)).toContain(t.hero2);
  const staged = on(effects, { seats: 1, staging: ["132027"], active: "132026" });
  expect(flagged(synced(staged, givePoison(staged.state, staged.hero, 1, staged.ctx, [])), staged.hero, "cannotQuest"), "not while it is in the staging area").toBe(false);
});
lineSpec("132027:A:2", "after Forest Stream leaves play as an explored location 4 poison are discarded from the characters, all of it when fewer than 4 are there", (effects) => {
  const t = on(effects, { seats: 1, active: "132027" });
  const six = givePoison(givePoison(t.state, t.hero, 3, t.ctx, []), t.hero2, 3, t.ctx, []);
  expect(total(afterLeaving(t, six, "132027", true).state), "6 poison, 4 discarded").toBe(2);
  const two = givePoison(t.state, t.hero2, 2, t.ctx, []);
  expect(total(afterLeaving(t, two, "132027", true).state), "2 poison, all discarded").toBe(0);
  expect(total(afterLeaving(t, givePoison(t.state, t.hero, 4, t.ctx, []), "132027", true).state), "exactly 4").toBe(0);
});
lineSpec("132027:A:2", "is not offered when Forest Stream leaves play unexplored or when no character is poisoned, and discards from the other player's characters too", (effects) => {
  const t = on(effects, { seats: 2, active: "132027" });
  const sick = givePoison(givePoison(t.state, t.hero, 1, t.ctx, []), t.seat1Hero, 2, t.ctx, []);
  const explored = afterLeaving(t, sick, "132027", true);
  expect(explored.offered).toBe(true);
  expect(total(explored.state), "the poison of both players is discarded").toBe(0);
  expect(afterLeaving(t, sick, "132027", false).offered, "unexplored").toBe(false);
  expect(afterLeaving(t, t.state, "132027", true).offered, "no poison").toBe(false);
});
