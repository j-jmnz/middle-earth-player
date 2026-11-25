// Rules: hob.unconscious-characters, hob.staging-area-creating, hob.staging-area-combining, rr.then, rr.action, rr.first-player (data/rules/entries.json). The quest stages of Flies and Spiders, each test from the printed line (data/printed/the-hobbit.json) on a table built from data/ by the layout kit,
// and run again without the records of its line (`lineSpec`): 132067:A:1, 132067:B:1, 132068:B:1, 132069:A:1, 132069:B:1, 132069:B:2, 132070:A:1, 132070:B:1, 132070:B:2, 132070:B:4. The Actions of 132069:B:3 and 132070:B:3 are in stage-actions.test.ts.
import { expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { flagged, updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { poisonOf, givePoison, makeUnconscious } from "../../../rules/families/poison/poison.ts";
import { stageOf, stagingDest, stagingOf } from "../../../rules/families/breaking/areas.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { idOf, legalIntents, legalTargets, resolveRecords, send, start } from "../../../../test/harness/scene-kit.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { spawn } from "../../../rules/core/zones.ts";
import type { PlayerIntent } from "../../../rules/engine/reduce.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { codeOf, GLADE, spiderTable, STAGE_1, STAGE_2, STAGE_3, STAGE_4, toNextRound, withBilbo } from "../../../../test/scenarios/flies-and-spiders/scene.ts";

const BARS = ["cannotQuest", "cannotAttack", "cannotDefend", "noCollection", "cannotTriggerEffects", "cannotTriggerForced", "cannotBePoisoned", "cannotReady"] as const;
const on = (effects: readonly Effect[], layout: Parameters<typeof spiderTable>[0] = {}) => spiderTable(layout, { effects });
// Stage 2B revealed: the first player (seat 0) at stage 3 in an area of his own, the other at stage 4 (two players), or alone at stage 3.
const revealed = (effects: readonly Effect[], layout: Parameters<typeof spiderTable>[0] = {}) => {
  const t = on(effects, { stage: STAGE_2, setAside: [GLADE], seats: 2, ...layout });
  return { t, state: resolveRecords(t.state, t.ctx, STAGE_2, "whenRevealed", t.state.questStage ?? "").state };
};
const syncOf = (t: { ctx: Parameters<typeof legalTargets>[2] }, state: ScenarioState) => syncConstants(state, t.ctx);
const codesIn = (state: ScenarioState, seat: number) => stagingOf(state, seat).map((id) => codeOf(state, id)).sort();

// ---- 132067:A:1 Setup ----
const intoMirkwood = (effects: readonly Effect[], seats: 1 | 2, pick?: (state: ScenarioState) => string) => {
  const t = on(effects, { seats, setAside: ["132019", "132019", "132019", "132019"], deck: ["f0", "f0", "f0"] });
  const out = resolveRecords(t.state, t.ctx, STAGE_1, "setup", t.state.questStage ?? "", pick).state;
  const rings = Object.values(out.cards).filter((card) => card.code === "132019");
  return { t, out, inDecks: rings.filter((card) => card.zone === "deck").length, aside: rings.filter((card) => card.zone === "setAside").length };
};
lineSpec("132067:A:1", "each player may shuffle a copy of Bilbo's Magic Ring into his deck, then the encounter deck is shuffled and each player reveals 1 encounter card", (effects) => {
  const two = intoMirkwood(effects, 2);
  expect(two.inDecks, "a copy for each of 2 players").toBe(2);
  expect(two.aside).toBe(2);
  expect(two.out.encounterDeck.length, "1 card per player is revealed").toBe(two.t.state.encounterDeck.length - 2);
  const one = intoMirkwood(effects, 1);
  expect(one.inDecks).toBe(1);
  expect(one.out.encounterDeck.length).toBe(one.t.state.encounterDeck.length - 1);
});
lineSpec("132067:A:1", "a player may keep his copy of the Ring out of his deck, and the reveal still happens", (effects) => {
  const kept = intoMirkwood(effects, 2, (state) => (state.window?.kind === "choose" ? (state.window.options.find((id) => id === "keep") ?? "") : ""));
  expect(kept.inDecks).toBe(0);
  expect(kept.aside).toBe(4);
  expect(kept.out.encounterDeck.length).toBe(kept.t.state.encounterDeck.length - 2);
});

// ---- 132067:B:1, 132069:B:1, 132070:B:1 the unconscious bars ----
const barsOf = (state: ScenarioState, id: string) => BARS.filter((bar) => flagged(state, id, bar));
const barsCheck = (stage: string) => (effects: readonly Effect[]) => {
  const t = on(effects, { seats: 1, stage });
  const down = makeUnconscious(t.state, t.hero, t.ctx, []);
  expect(barsOf(syncOf(t, down), t.hero)).toEqual([...BARS]);
  expect(barsOf(syncOf(t, down), t.hero2), "a conscious character").toEqual([]);
  expect(legalTargets({ ...syncOf(t, down), phase: "Quest", mode: "questCommit" }, { type: "Commit" }, t.ctx), "it cannot be committed").not.toContain(t.hero);
  expect(legalTargets({ ...syncOf(t, down), phase: "Quest", mode: "questCommit" }, { type: "Commit" }, t.ctx), "another character can").toContain(t.hero2);
  expect(poisonOf(givePoison(syncOf(t, down), t.hero, 1, t.ctx, []), t.hero), "it cannot be poisoned").toBe(0);
};
const refreshCheck = (stage: string) => (effects: readonly Effect[]) => {
  const t = on(effects, { seats: 1, stage, phase: "Refresh" });
  const down = syncOf(t, makeUnconscious(t.state, t.hero, t.ctx, []));
  const tired = syncOf(t, updateCard(down, t.hero2, { exhausted: true }));
  const out = toNextRound(tired, t.ctx).state;
  expect(out.round, "a round passed").toBeGreaterThan(tired.round);
  expect(out.cards[t.hero2]?.exhausted, "an exhausted character is readied").toBe(false);
  expect(out.cards[t.hero]).toMatchObject({ unconscious: true, exhausted: true });
  expect(out.cards[t.hero2]?.resources, "a character collects a resource").toBe(1);
  expect(out.cards[t.hero]?.resources, "an unconscious character collects none").toBe(0);
};
const BARS_TITLE = "an unconscious character cannot quest, attack, defend, collect resources, trigger abilities, be poisoned or ready; a conscious one is not barred";
const REFRESH_TITLE = "the refresh phase does not ready an unconscious character and the next resource phase gives it no resource";
lineSpec("132067:B:1", BARS_TITLE, barsCheck(STAGE_1));
lineSpec("132067:B:1", REFRESH_TITLE, refreshCheck(STAGE_1));
lineSpec("132069:B:1", BARS_TITLE, barsCheck(STAGE_3));
lineSpec("132069:B:1", REFRESH_TITLE, refreshCheck(STAGE_3));
lineSpec("132070:B:1", BARS_TITLE, barsCheck(STAGE_4));
lineSpec("132070:B:1", REFRESH_TITLE, refreshCheck(STAGE_4));

// ---- 132068:B:1 Lost in the Dark ----
lineSpec("132068:B:1", "with 2 players the first player takes stage 3 in an area of his own, the other advances to stage 4 and keeps the cards of the staging area", (effects) => {
  const { state } = revealed(effects, { staging: ["132032"] });
  expect(codeOf(state, stageOf(state, 0))).toBe(STAGE_3);
  expect(codeOf(state, stageOf(state, 1))).toBe(STAGE_4);
  expect(state.separate).toBe(true);
  expect(codesIn(state, 1), "the shared area keeps its cards and 4A adds the Glade").toEqual([GLADE, "132032"].sort());
  expect(codesIn(state, 0)).toEqual([]);
});
lineSpec("132068:B:1", "alone, stage 2 and each card of its staging area are discarded and the first player is at stage 3 in the one area", (effects) => {
  const { state } = revealed(effects, { seats: 1, staging: ["132032", "132033"] });
  expect(codeOf(state, state.questStage)).toBe(STAGE_3);
  expect(state.separate).toBeUndefined();
  expect(state.staging).toEqual([]);
  expect(state.encounterDiscard.map((id) => codeOf(state, id)).sort()).toEqual(["132032", "132033"]);
  expect(Object.values(state.cards).find((card) => card.code === STAGE_2)?.zone).toBe("setAside");
  expect(Object.values(state.cards).find((card) => card.code === GLADE)?.zone, "the Glade waits for stage 4A").toBe("setAside");
});

// ---- 132069:A:1 Captured by Spiders ----
// Stage 3A is revealed to the first player (seat 0) of a table with Bilbo, two stand-in heroes and an ally of his, after stage 2B has split the players.
const captured = (effects: readonly Effect[], resources: number, seats: 1 | 2 = 2) => {
  const t = on(effects, { stage: STAGE_2, setAside: [GLADE], seats, heroResources: resources, play: [{ code: "ally", seat: 0 }] });
  const withB = withBilbo(t.state);
  const dealt = updateCard(withB.state, withB.id, { resources });
  const state = resolveRecords(dealt, t.ctx, STAGE_2, "whenRevealed", dealt.questStage ?? "").state;
  return { t, state, bilbo: withB.id, ally: idOf(state, "ally") };
};
lineSpec("132069:A:1", "every resource is removed from each hero's pool, Bilbo's included, and every character the first player controls but Bilbo Baggins is unconscious, allies too", (effects) => {
  const { t, state, bilbo, ally } = captured(effects, 2);
  for (const id of [bilbo, t.hero, t.hero2]) expect(state.cards[id]?.resources, `pool of ${state.cards[id]?.code}`).toBe(0);
  for (const id of [t.hero, t.hero2, ally]) expect(state.cards[id]?.unconscious, `${state.cards[id]?.code} is unconscious`).toBe(true);
  expect(state.cards[bilbo]?.unconscious, "Bilbo Baggins is not made unconscious").toBeUndefined();
  expect(state.cards[t.seat1Hero ?? ""], "the other player's hero is not touched").toMatchObject({ resources: 2 });
  expect(state.cards[t.seat1Hero ?? ""]?.unconscious).toBeUndefined();
});
// FAULT-free reading (docs/scenarios/the-hobbit/flies-and-spiders.md, Flies and Spiders, Stage 3, "Then"): an empty pool is all removed, so the second sentence resolves.
lineSpec("132069:A:1", "with every resource pool already empty the characters are still made unconscious (Then: removing all of none resolves in full)", (effects) => {
  const { t, state, bilbo } = captured(effects, 0, 1);
  for (const id of [t.hero, t.hero2]) expect(state.cards[id]?.unconscious).toBe(true);
  expect(state.cards[bilbo]?.unconscious).toBeUndefined();
});

// ---- 132069:B:2 Captured by Spiders, the first player token and the delayed join ----
lineSpec("132069:B:2", "do not pass the first player token while stage 3 is in play, so the token stays at the end of the round", (effects) => {
  const { t, state } = revealed(effects);
  const quiet = { ...state, phase: "Refresh" as const, mode: "refresh" as const, window: null, activeSeat: 0 };
  const out = toNextRound(quiet, t.ctx).state;
  expect(out.round).toBeGreaterThan(quiet.round);
  expect(out.firstPlayer, "the token did not pass").toBe(0);
});
// The other players advance from stage 2 to stage 4: stage 2 is the stage defeated, so the Forced of stage 3 ("when this stage is defeated") does not hear it and schedules no join.
// A negative lock, so a plain test: it holds without the Forced record of the line.
it("132069:B:2 stage 3 is not defeated when the other players advance to stage 4, so its delayed join is not scheduled", () => {
  const { state } = revealed(EFFECTS);
  expect(codeOf(state, stageOf(state, 0))).toBe(STAGE_3);
  expect(codeOf(state, stageOf(state, 1))).toBe(STAGE_4);
  expect(state.delayed ?? [], "no delayed join").toEqual([]);
  expect(state.stageHeld, "stage 3 is not held").toBeUndefined();
});
// The false case of the lock: with no stage 3 in play the token passes (it holds without the line's records, so it is a plain test and the lineSpec above is the one that fails without them).
it("132069:B:2 the first player token passes at the end of a round when stage 3 is not in play", () => {
  const t = on(EFFECTS, { seats: 2, stage: STAGE_1, phase: "Refresh" });
  const out = toNextRound(t.state, t.ctx).state;
  expect(out.round).toBeGreaterThan(t.state.round);
  expect(out.firstPlayer, "the token passed to the other player").toBe(1);
});

// Stage 3 holds all its progress but one; Bilbo of the first player commits and quests the last point. Stage 4 is where the other player is, with an enemy of the first player's area waiting in his staging area.
const questToComplete = (effects: readonly Effect[]) => {
  const { t, state: split } = revealed(effects, { staging: ["f0"] });
  const withB = withBilbo(split);
  const stage3 = stageOf(withB.state, 0) ?? "";
  const placed = spawn(withB.state, "f0", stagingDest(withB.state, 0));
  const ready = updateCard({ ...placed.state, phase: "Quest", mode: "questCommit", window: { kind: "pass" }, activeSeat: 0 }, stage3, { progress: (t.cards.get(STAGE_3)?.questPoints ?? 11) - 1 });
  const before = syncConstants(ready, t.ctx);
  let run = send(start(before), { type: "Commit", cardIds: [withB.id] }, t.ctx);
  for (let guard = 0; guard < 12 && run.state.phase === "Quest"; guard += 1) {
    const pass = legalIntents(run.state, t.ctx).find((intent) => intent.type === "Pass");
    if (!pass) break;
    run = send(run, pass as PlayerIntent, t.ctx);
  }
  return { t, run, before, stage3, enemy: placed.id };
};
lineSpec("132069:B:2", "when stage 3 is complete the first player advances to stage 4 at the end of the quest phase: the areas combine, stage 4A is not revealed again", (effects) => {
  const { run, before, enemy } = questToComplete(effects);
  const state = run.state;
  expect(before.separate, "the players were split").toBe(true);
  expect(state.phase, "the travel phase began").toBe("Travel");
  expect(state.separate, "the staging areas are combined").toBeUndefined();
  expect(codeOf(state, state.questStage)).toBe(STAGE_4);
  expect(Object.values(state.cards).find((card) => card.code === STAGE_3)?.zone).not.toBe("questStage");
  expect(state.cards[enemy]?.zone, "the enemy of his area is in the shared staging area").toBe("staging");
  expect(state.staging).toContain(enemy);
  expect(Object.values(state.cards).filter((card) => card.code === GLADE).length, "4A did not add a second Glade").toBe(1);
});

// ---- 132070:A:1, 132070:B:2, 132070:B:4 Battle with the Spiders ----
lineSpec("132070:A:1", "stage 4A adds The Spider's Glade to the staging area", (effects) => {
  const t = on(effects, { seats: 1, stage: STAGE_4, side: "A", setAside: [GLADE] });
  expect(Object.values(t.state.cards).find((card) => card.code === GLADE)?.zone).toBe("setAside");
  const out = resolveRecords(t.state, t.ctx, STAGE_4, "whenRevealed", t.state.questStage ?? "").state;
  expect(Object.values(out.cards).find((card) => card.code === GLADE)?.zone, "the Glade is in the staging area").toBe("staging");
});
// The first player commits both stand-in heroes (4 Willpower) against the Glade's 1 Threat, or against an empty staging area: 3 progress when none is barred, the 3 quest points of stage 4.
const questStage4 = (effects: readonly Effect[], layout: Parameters<typeof spiderTable>[0]) => {
  const t = on(effects, { seats: 1, stage: STAGE_4, ...layout });
  let run = send(start(t.state), { type: "Commit", cardIds: [t.hero, t.hero2] }, t.ctx);
  for (let guard = 0; guard < 12 && run.state.phase === "Quest" && !run.state.stageCleared; guard += 1) {
    const pass = legalIntents(run.state, t.ctx).find((intent) => intent.type === "Pass");
    if (!pass) break;
    run = send(run, pass as PlayerIntent, t.ctx);
  }
  return { state: run.state, stage: idOf(t.state, STAGE_4) };
};
lineSpec("132070:B:2", "no progress is placed on stage 4 while The Spider's Glade is in play, in the staging area or as the active location", (effects) => {
  const staged = questStage4(effects, { staging: [GLADE] });
  expect(staged.state.cards[staged.stage]?.progress, "the quest succeeded but no progress was placed").toBe(0);
  expect(staged.state.stageCleared).toBeFalsy();
  const active = questStage4(effects, { active: GLADE });
  expect(active.state.cards[active.stage]?.progress).toBe(0);
  const gone = questStage4(effects, { setAside: [GLADE] });
  expect(gone.state.cards[gone.stage]?.progress, "progress is placed when the Glade is not in play").toBeGreaterThan(0);
});
// The record of this line is empty (the win is the last stage's defeat, the Ring is discovered nowhere), so there is nothing to remove: a plain test.
it("132070:B:4 if the players defeat stage 4 they have won the game, and not while the Glade holds the progress off", () => {
  const effects = EFFECTS;
  const won = questStage4(effects, { setAside: [GLADE] });
  expect(won.state.stageCleared, "stage 4 was defeated").toBe(true);
  expect(won.state.lost).toBeFalsy();
  const held = questStage4(effects, { staging: [GLADE] });
  expect(held.state.stageCleared).toBeFalsy();
});
