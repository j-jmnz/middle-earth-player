// Rules: rm.out-of-play-deck, rm.searches-x, rm.time-x, rm.mugash-player-card-backs, rr.then, rr.explored, rr.in-play-and-out-of-play, rr.engaged, rr.forced, rr.shadow-effects (data/rules/entries.json); ledger lines 07024:A:1, 07024:A:2, 07025:A:1, 07025:A:2, 07026:A:1, 07026:A:2, 07027:A:1, 07027:A:2, 07028:A:1, 07028:A:2, 07029:A:1, 07029:A:2, 07030:A:1, 07038:A:1, 07038:A:2, 07039:A:1, 07039:A:2, 07040:A:2, 07041:A:1, 07053:A:1, 07053:A:2, 07054:A:1, 07054:A:2, 07055:A:2, 07062:A:1, 07062:B:1, 07063:B:1, 07063:B:2, 07063:B:3, 07064:B:1, 07064:B:2, 07064:B:3.
// An audit of To Catch an Orc: each test is built from the printed words and the rule spans, on the smallest table of the scene kit. A line's test runs again without the line's records and must fail there (`lineSpec`).
import { describe, expect } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { pileOf } from "../../../rules/core/piles.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { stagingThreat } from "../../../rules/quest/quest.ts";
import { attachTargetCodes, engagedHandTable, codesIn, drive, fight, finish, fightEnemy, idOf, layoutTableFor, opening, opened, revealFromTop, run as runInstruction, send, statOf, type Layout, type LayoutTable, type Run } from "../../../../test/harness/scene-kit.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";

const make = layoutTableFor("to-catch-an-orc");

const codeOf = (state: ScenarioState, id: string): string => state.cards[id]?.code ?? "";
// The codes of a seat's out-of-play deck, top first.
const deckCodes = (state: ScenarioState, seat: number): string[] => pileOf(state, seat === 0 ? "outOfPlay0" : "outOfPlay1").map((id) => codeOf(state, id));
const handCodes = (state: ScenarioState, seat = 0): string[] => (state.seats[seat]?.hand ?? []).map((id) => codeOf(state, id)).sort();
const discardCodes = (state: ScenarioState, seat = 0): string[] => (state.seats[seat]?.discard ?? []).map((id) => codeOf(state, id)).sort();
const stagingCodes = (state: ScenarioState): string[] => codesIn(state, "staging");
const stageResources = (state: ScenarioState): number => state.cards[state.questStage ?? ""]?.resources ?? 0;
const first = (state: ScenarioState): string => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "");

// Every seat commits what it is given and the quest phase is played to its end; choices take the option `pick` names (the first by default).
function quest(made: LayoutTable, commit: readonly string[] = [made.hero], pick?: (state: ScenarioState) => string): Run {
  const committed = send(opened(made), { type: "Commit", cardIds: [...commit] }, made.ctx);
  return drive(made, committed, (st) => st.phase !== "Quest" && st.stack.length === 0, pick);
}

// The refresh phase is played to the next round's planning phase.
// The table opens in the combat phase (the refresh phase opens on no window), so every window up to the next planning phase is passed.
const refresh = (made: LayoutTable, pick?: (state: ScenarioState) => string): Run => drive(made, opened(made), (st) => st.phase === "Planning" && st.stack.length === 0, pick);

// The card is revealed from the top of the encounter deck by `seat`. With `pick` its choices are answered; without it the run stays at the first choice the effects open.
function reveal(made: LayoutTable, code: string, seat = 0, pick?: (state: ScenarioState) => string): Run {
  const steps: Run["steps"] = [];
  const revealed = { state: revealFromTop(made.state, made.ctx, code, steps, seat).state, steps };
  return pick == null ? revealed : finish(revealed, made.ctx, pick);
}

describe("07024 Mugash", () => {
  lineSpec("07024:A:1", "no attachment can be attached to Mugash, and one can be attached to another enemy", (effects) => {
    // Forest Snare: "Attach to an enemy engaged with a player."
    const made = engagedHandTable("to-catch-an-orc", "01069", "07024", effects);
    expect(attachTargetCodes(made, "01069")).toContain("f0");
    expect(attachTargetCodes(made, "01069")).not.toContain("07024");
  });
  const defeat = (made: LayoutTable, pick: (state: ScenarioState) => string = first): ScenarioState => {
    const id = idOf(made.state, "07024");
    const done = runInstruction(made, made.state, { verb: "Destroy", target: { kind: "self" } }, { sourceId: id });
    return drive(made, { state: done, steps: [] }, (st) => st.window?.kind !== "choose" && st.stack.length === 0, pick).state;
  };
  lineSpec("07024:A:2", "after he is defeated the first player (not the engaged player) attaches him to his own hero and exhausts it", (effects) => {
    const made = make({ seats: 2, firstPlayer: 1, engaged: [{ code: "07024", seat: 0 }] }, effects);
    const done = defeat(made);
    const mugash = done.cards[idOf(done, "07024")];
    expect(mugash?.zone).toBe("attached");
    expect(mugash?.host).toBe(made.seat1Hero);
    expect(done.cards[made.seat1Hero ?? ""]?.exhausted).toBe(true);
    expect(done.cards[made.hero]?.exhausted).toBe(false);
  });
  lineSpec("07024:A:2", "the first player picks among his own heroes, and the hero he picks is exhausted", (effects) => {
    const made = make({ seats: 1, engaged: ["07024"] }, effects);
    const asked = runInstruction(made, made.state, { verb: "Destroy", target: { kind: "self" } }, { sourceId: idOf(made.state, "07024") });
    expect(asked.window).toMatchObject({ kind: "choose" });
    const done = send({ state: asked, steps: [] }, { type: "Choose", optionId: made.hero2 }, made.ctx).state;
    expect(done.cards[idOf(done, "07024")]?.host).toBe(made.hero2);
    expect(done.cards[made.hero2]?.exhausted).toBe(true);
    expect(done.cards[made.hero]?.exhausted).toBe(false);
  });
  lineSpec("07024:A:2", "an exhausted hero cannot ready while Mugash is attached, and the players lose when it leaves play", (effects) => {
    const made = make({ phase: "Combat", attached: [{ code: "07024", to: "dh1", encounter: true }], exhaustedCards: ["dh1", "dh2"] }, effects);
    const done = refresh(made).state;
    expect(done.cards[made.hero]?.exhausted).toBe(true);
    expect(done.cards[made.hero2]?.exhausted).toBe(false);
    const hero = made.hero;
    const lost = settle(runInstruction(made, made.state, { verb: "Destroy", target: { kind: "self" } }, { sourceId: hero }), made.ctx, []);
    expect(lost.lost).toBe(true);
    const other = make({ phase: "Combat", attached: [{ code: "07024", to: "dh1", encounter: true }] }, effects);
    const kept = settle(runInstruction(other, other.state, { verb: "Destroy", target: { kind: "self" } }, { sourceId: other.hero2 }), other.ctx, []);
    expect(kept.lost).not.toBe(true);
  });
});

describe("07025 Mugash's Guard", () => {
  const holder = (seat: number): string => (seat === 0 ? "dh1" : "dh3");
  const engagedSeats = (state: ScenarioState, code: string): number[] => [0, 1].filter((seat) => (state.seats[seat]?.engaged ?? []).some((id) => codeOf(state, id) === code));
  lineSpec("07025:A:1", "a Guard in the staging area engages the player whose hero holds Mugash, whatever its engagement cost", (effects) => {
    const made = make({ seats: 2, staging: ["07025"], attached: [{ code: "07024", to: holder(1), encounter: true }] }, effects);
    const done = settle(made.state, made.ctx, []);
    expect(engagedSeats(done, "07025")).toEqual([1]);
    expect(stagingCodes(done)).not.toContain("07025");
    // Mugash held by no hero: the Guard stays in the staging area.
    const loose = make({ seats: 2, staging: ["07025", "07024"] }, effects);
    expect(stagingCodes(settle(loose.state, loose.ctx, []))).toContain("07025");
  });
  lineSpec("07025:A:1", "a Guard engaged with another player is engaged with the player whose hero holds Mugash", (effects) => {
    const made = make({ seats: 2, engaged: [{ code: "07025", seat: 0 }], attached: [{ code: "07024", to: holder(1), encounter: true }] }, effects);
    const done = settle(made.state, made.ctx, []);
    expect(engagedSeats(done, "07025")).toEqual([1]);
  });
  lineSpec("07025:A:2", "after the Guard destroys a character Mugash returns to the staging area; a character another enemy destroys changes nothing", (effects) => {
    const hold = [{ code: "07024", to: "dh1", encounter: true as const }];
    const slain = fightEnemy((layout: Layout) => make(layout, effects), "f0", "07025", { play: [{ code: "ally", damage: 1 }], attached: hold, deck: ["f0", "f0", "f0", "f0"] }, { defender: (made) => idOf(made.state, "ally") });
    expect(slain.run.state.cards[idOf(slain.run.state, "ally")]?.zone).not.toBe("play");
    expect(slain.run.state.cards[idOf(slain.run.state, "07024")]?.zone).toBe("staging");
    expect(slain.run.state.lost).not.toBe(true);
    // Mugash is not attached: he stays where he is.
    const free = fightEnemy((layout: Layout) => make(layout, effects), "f0", "07025", { play: [{ code: "ally", damage: 1 }], engaged: [{ code: "07025", seat: 0 }, { code: "07024", seat: 0 }], deck: ["f0", "f0", "f0", "f0"] }, { defender: (made) => idOf(made.state, "ally") });
    expect(free.run.state.cards[idOf(free.run.state, "07024")]?.zone).toBe("engaged");
    // Mugash lies on one hero and the Guard destroys the other: he returns, and the players have not lost.
    const other = fightEnemy((layout: Layout) => make(layout, effects), "f0", "07025", { attached: hold, deck: ["f0", "f0", "f0", "f0"] }, { undefended: true, lands: { "07025": "dh2" } });
    expect(other.run.state.cards[other.made.hero2]?.zone).not.toBe("heroes");
    expect(other.run.state.cards[idOf(other.run.state, "07024")]?.zone).toBe("staging");
    expect(other.run.state.lost).not.toBe(true);
  });
});

describe("07026 Methedras Orc", () => {
  const fightSeat1 = (effects: readonly Effect[], layout: Layout, shadow = "f0") =>
    fightEnemy((l: Layout) => make(l, effects), shadow, "07026", { seats: 2, engaged: [{ code: "07026", seat: 1 }], deck: ["f0", "f0", "f0", "f0"], ...layout }, { defender: (made) => made.seat1Hero ?? "" });
  lineSpec("07026:A:1", "when it attacks, the defending player (not the first player) shuffles 1 random card of his hand into his out-of-play deck", (effects) => {
    const done = fightSeat1(effects, { hand: [{ code: "filler", seat: 0 }, { code: "event", seat: 1 }, { code: "event", seat: 1 }], piles: { outOfPlay0: ["f0"], outOfPlay1: ["f0"] } }).run.state;
    expect(handCodes(done, 1)).toEqual(["event"]);
    expect(deckCodes(done, 1).sort()).toEqual(["event", "f0"]);
    expect(handCodes(done, 0)).toEqual(["filler"]);
    expect(deckCodes(done, 0)).toEqual(["f0"]);
    expect(pileOf(done, "outOfPlay1").every((id) => done.cards[id]?.face === "down")).toBe(true);
  });
  lineSpec("07026:A:1", "an empty hand puts nothing into the deck, and the attack goes on", (effects) => {
    const full = fightSeat1(effects, { hand: [{ code: "event", seat: 1 }], piles: { outOfPlay0: ["f0"], outOfPlay1: ["f0"] } }).run.state;
    expect(deckCodes(full, 1)).toHaveLength(2);
    const fought = fightSeat1(effects, { hand: [{ code: "event", seat: 0 }], piles: { outOfPlay0: ["f0"], outOfPlay1: ["f0"] } });
    const empty = fought.run.state;
    expect(deckCodes(empty, 1)).toEqual(["f0"]);
    expect(handCodes(empty, 0)).toEqual(["event"]);
    // The attack still lands: 5 Attack against the defender's 2 Defense.
    expect(empty.cards[fought.made.seat1Hero ?? ""]?.damage).toBe(3);
  });
  lineSpec("07026:A:2", "as a Shadow, an attack that destroys a character removes 1 time counter from the current quest", (effects) => {
    const destroyed = fightEnemy((l: Layout) => make(l, effects), "07026", "07038", { stage: "07063", timeCounters: 2, play: ["ally"] }, { defender: (made) => idOf(made.state, "ally") });
    expect(destroyed.run.state.cards[idOf(destroyed.run.state, "ally")]?.zone).not.toBe("play");
    expect(stageResources(destroyed.run.state)).toBe(1);
    const spared = fightEnemy((l: Layout) => make(l, effects), "07026", "07038", { stage: "07063", timeCounters: 2 });
    expect(stageResources(spared.run.state)).toBe(2);
  });
});

describe("07027 Methedras", () => {
  const explore = (effects: readonly Effect[], layout: Layout, pick?: (state: ScenarioState) => string): ScenarioState => {
    const made = make({ phase: "Quest", ...layout }, effects);
    return quest(made, [made.hero], pick).state;
  };
  lineSpec("07027:A:1", "while active, each location in the staging area gets +1 Threat; in the staging area it does not", (effects) => {
    const active = make({ active: "07027", staging: ["place", "f3"] }, effects);
    expect(stagingThreat(active.state, active.cards)).toBe(6);
    const staged = make({ staging: ["07027", "place"] }, effects);
    expect(stagingThreat(staged.state, staged.cards)).toBe(4);
  });
  lineSpec("07027:A:2", "explored: each player Searches 3 (enemies to the staging area, 1 other card to hand, the rest discarded, the 4th card stays)", (effects) => {
    const done = explore(effects, { seats: 2, active: { code: "07027", progress: 2 }, piles: { outOfPlay0: ["f0", "event", "filler", "ally"], outOfPlay1: ["treachery", "f3", "ally", "filler"] } });
    expect(stagingCodes(done).sort()).toEqual(["f0", "f3"]);
    expect([...handCodes(done, 0), ...discardCodes(done, 0)].sort()).toEqual(["event", "filler"]);
    expect(handCodes(done, 0)).toHaveLength(1);
    expect([...handCodes(done, 1), ...discardCodes(done, 1)].sort()).toEqual(["ally", "treachery"]);
    expect(handCodes(done, 1)).toHaveLength(1);
    expect(deckCodes(done, 0)).toEqual(["ally"]);
    expect(deckCodes(done, 1)).toEqual(["filler"]);
  });
  lineSpec("07027:A:2", "a location that leaves play without being explored searches nothing", (effects) => {
    const made = make({ seats: 2, active: "07027", piles: { outOfPlay0: ["f0", "event"], outOfPlay1: ["f0", "event"] } }, effects);
    const done = settle(runInstruction(made, made.state, { verb: "Discard", target: { kind: "self" } }, { sourceId: idOf(made.state, "07027") }), made.ctx, []);
    expect(done.cards[idOf(done, "07027")]?.zone).not.toBe("activeLocation");
    expect(deckCodes(done, 0)).toEqual(["f0", "event"]);
    expect(deckCodes(done, 1)).toEqual(["f0", "event"]);
    expect(stagingCodes(done)).toEqual([]);
    const searched = explore(effects, { seats: 2, active: { code: "07027", progress: 2 }, piles: { outOfPlay0: ["f0", "event"], outOfPlay1: ["f0", "event"] } });
    expect(deckCodes(searched, 0)).toEqual([]);
  });
  lineSpec("07027:A:2", "with fewer than 3 cards the player reveals what the deck holds; an empty deck reveals nothing", (effects) => {
    const done = explore(effects, { seats: 2, active: { code: "07027", progress: 2 }, piles: { outOfPlay0: ["event"], outOfPlay1: [] } });
    expect(handCodes(done, 0)).toEqual(["event"]);
    expect(deckCodes(done, 0)).toEqual([]);
    expect(handCodes(done, 1)).toEqual([]);
    expect(done.lost).not.toBe(true);
  });
});

describe("07028 Orc Cave", () => {
  const explore = (effects: readonly Effect[], layout: Layout): ScenarioState => {
    const made = make({ phase: "Quest", ...layout }, effects);
    return quest(made, [made.hero]).state;
  };
  lineSpec("07028:A:1", "explored: only the first player Searches 5", (effects) => {
    const done = explore(effects, { seats: 2, firstPlayer: 1, active: { code: "07028", progress: 3 }, piles: { outOfPlay0: ["event", "filler"], outOfPlay1: ["f0", "f0", "event", "filler", "ally", "treachery"] } });
    expect(stagingCodes(done)).toEqual(["f0", "f0"]);
    expect(handCodes(done, 1)).toHaveLength(1);
    expect(discardCodes(done, 1)).toHaveLength(2);
    expect(deckCodes(done, 1)).toEqual(["treachery"]);
    expect(deckCodes(done, 0)).toEqual(["event", "filler"]);
    expect(handCodes(done, 0)).toEqual([]);
    expect(discardCodes(done, 0)).toEqual([]);
  });
  const travelTo = (made: LayoutTable, pick?: (state: ScenarioState) => string): ScenarioState => {
    const sent = send(opened(made), { type: "Travel", locationId: idOf(made.state, "07028") }, made.ctx);
    return drive(made, sent, (st) => st.window?.kind !== "choose" && st.stack.length === 0, pick).state;
  };
  lineSpec("07028:A:2", "Travel: discards the top X cards of the encounter deck (X = players) and adds each Orc enemy discarded to the staging area", (effects) => {
    const two = travelTo(make({ seats: 2, phase: "Travel", staging: ["07028"], deck: ["07038", "f0", "07039"] }, effects));
    expect(stagingCodes(two)).toEqual(["07038"]);
    expect(codesIn(two, "encounterDiscard")).toEqual(["f0"]);
    expect(codesIn(two, "encounterDeck")).toEqual(["07039"]);
    expect(codesIn(two, "activeLocation")).toEqual(["07028"]);
    const solo = travelTo(make({ phase: "Travel", staging: ["07028"], deck: ["f0", "07038"] }, effects));
    expect(stagingCodes(solo)).toEqual([]);
    expect(codesIn(solo, "encounterDiscard")).toEqual(["f0"]);
    expect(codesIn(solo, "encounterDeck")).toEqual(["07038"]);
  });
});

describe("07029 Mugash's Lair", () => {
  // The round is played to the next planning phase: the encounter phase has no window of its own when no enemy can be engaged.
  const toEncounter = (made: LayoutTable): ScenarioState => drive(made, opened(made), (st) => st.phase === "Planning" && st.stack.length === 0).state;
  lineSpec("07029:A:1", "at the beginning of the encounter phase the top card of each out-of-play deck is revealed: an enemy goes to the staging area, the rest is discarded", (effects) => {
    const made = make({ seats: 2, phase: "Quest", staging: ["07029"], piles: { outOfPlay0: ["f0", "event"], outOfPlay1: ["event", "f3"] } }, effects);
    const done = toEncounter(made);
    expect(stagingCodes(done).sort()).toEqual(["07029", "f0"]);
    expect(deckCodes(done, 0)).toEqual(["event"]);
    expect(deckCodes(done, 1)).toEqual(["f3"]);
    expect(discardCodes(done, 1)).toEqual(["event"]);
    expect(discardCodes(done, 0)).toEqual([]);
  });
  lineSpec("07029:A:1", "an empty out-of-play deck reveals nothing, and a Lair that is not in play reveals nothing", (effects) => {
    const made = make({ seats: 2, phase: "Quest", deck: ["f0", "f0", "f0", "f0"], active: "07029", piles: { outOfPlay0: ["event"], outOfPlay1: [] } }, effects);
    const done = toEncounter(made);
    expect(discardCodes(done, 0)).toEqual(["event"]);
    expect(deckCodes(done, 0)).toEqual([]);
    expect(done.lost).not.toBe(true);
    const absent = toEncounter(make({ seats: 2, phase: "Quest", deck: ["f0", "f0", "f0", "f0"], discard: ["07029"], piles: { outOfPlay0: ["event"], outOfPlay1: ["event"] } }, effects));
    expect(deckCodes(absent, 0)).toEqual(["event"]);
  });
  lineSpec("07029:A:2", "as a Shadow, the defending player discards an attachment he controls; another player's attachment stays", (effects) => {
    const hit = fightEnemy((l: Layout) => make(l, effects), "07029", "f0", { attached: [{ code: "attachment", to: "dh1" }] });
    expect(hit.run.state.cards[idOf(hit.run.state, "attachment")]?.zone).toBe("discard");
    const other = fightEnemy((l: Layout) => make(l, effects), "07029", "f0", { seats: 2, engaged: [{ code: "f0", seat: 1 }], attached: [{ code: "attachment", to: "dh1" }] }, { defender: (made) => made.seat1Hero ?? "" });
    expect(other.run.state.cards[idOf(other.run.state, "attachment")]?.zone).not.toBe("discard");
  });
});

describe("07030 Orc Territory", () => {
  // The card is revealed and every attack it causes is played out: an undefended attack lands on the first hero of the seat attacked.
  const territory = (effects: readonly Effect[], layout: Layout): { made: LayoutTable; done: ScenarioState } => {
    const made = make({ phase: "Encounter", deck: ["place", "place", "f0", "f0", "f0", "f0"], ...layout }, effects);
    const steps: Run["steps"] = [];
    const revealed = revealFromTop(made.state, made.ctx, "07030", steps, 0);
    const done = fight(made, { state: revealed.state, steps }, (st) => st.pendingAttack == null && st.window?.kind !== "defense" && st.window?.kind !== "choose" && st.stack.length === 0, { choose: first });
    return { made, done: done.state };
  };
  lineSpec("07030:A:1", "each player adds a location to the staging area; if the staging Threat is lower than the committed Willpower, each Orc engaged with a player attacks", (effects) => {
    const { made, done } = territory(effects, { seats: 2, engaged: [{ code: "07038", seat: 0 }, { code: "07040", seat: 0 }, { code: "07026", seat: 1 }], staging: ["07039"], play: ["ally"], committed: ["dh1", "dh2", "dh3", "ally"] });
    expect(stagingCodes(done).filter((code) => code === "place")).toHaveLength(2);
    // Threat 4 (two places) + 2 (Orc Hunter) is 6; the committed Willpower is 7. Orc Skirmisher (Attack 4) and Methedras Orc (Attack 5) attack undefended, Orc Hound (a Creature) and the staged Orc do not.
    expect(done.cards[made.hero]?.damage).toBe(4);
    expect(done.cards[made.seat1Hero ?? ""]?.damage).toBe(5);
    expect(done.cards[made.hero2]?.damage).toBe(0);
  });
  lineSpec("07030:A:1", "the search covers the encounter discard pile too", (effects) => {
    const made = make({ phase: "Encounter", deck: ["f0", "f0"], discard: ["place"] }, effects);
    const steps: Run["steps"] = [];
    const done = finish({ state: revealFromTop(made.state, made.ctx, "07030", steps, 0).state, steps }, made.ctx, first).state;
    expect(stagingCodes(done)).toEqual(["place"]);
    expect(codesIn(done, "encounterDiscard").filter((code) => code === "place")).toEqual([]);
  });
  lineSpec("07030:A:1", "with the staging Threat equal to the committed Willpower nobody attacks", (effects) => {
    const { made, done } = territory(effects, { engaged: [{ code: "07038", seat: 0 }], committed: ["dh1"] });
    expect(stagingCodes(done)).toEqual(["place"]);
    expect(done.cards[made.hero]?.damage).toBe(0);
    const less = territory(effects, { engaged: [{ code: "07038", seat: 0 }], committed: ["dh1", "dh2"] });
    expect(less.done.cards[less.made.hero]?.damage).toBe(4);
  });
});

describe("07038 Orc Skirmisher", () => {
  // The engagement check engages the enemy; the table stops at the first choice its Forced effect opens (or at the combat phase).
  const engaged = (made: LayoutTable): Run => drive(made, opened(made), (st) => st.window?.kind === "choose" || st.phase === "Combat");
  const answerWith = (made: LayoutTable, at: Run, ...picks: string[]): ScenarioState => drive(made, at, (st) => st.window?.kind !== "choose", (st) => picks.shift() ?? first(st)).state;
  lineSpec("07038:A:1", "after it engages a player that player chooses: 3 damage to a character, or 1 time counter off the current quest", (effects) => {
    const made = make({ phase: "Encounter", stage: "07063", timeCounters: 2, staging: ["07038"], threat: [35, 28] }, effects);
    const asked = engaged(made);
    expect(asked.state.window).toMatchObject({ kind: "choose", options: expect.arrayContaining(["damage", "time"]) });
    const timed = answerWith(made, asked, "time");
    expect(stageResources(timed)).toBe(1);
    expect(timed.cards[made.hero]?.damage).toBe(0);
    const hurt = answerWith(made, engaged(make({ phase: "Encounter", stage: "07063", timeCounters: 2, staging: ["07038"], threat: [35, 28] }, effects)), "damage", made.hero2);
    expect(hurt.cards[made.hero2]?.damage).toBe(3);
    expect(stageResources(hurt)).toBe(2);
  });
  lineSpec("07038:A:1", "with no time counter to remove the only choice left is the character that takes 3 damage", (effects) => {
    const made = make({ phase: "Encounter", staging: ["07038"], threat: [35, 28] }, effects);
    const asked = engaged(made);
    expect(asked.state.window).toMatchObject({ kind: "choose", options: expect.not.arrayContaining(["time"]) });
    expect(asked.state.window?.kind === "choose" ? asked.state.window.options : []).toEqual(expect.arrayContaining([made.hero, made.hero2]));
    const done = answerWith(made, asked, made.hero);
    expect(done.cards[made.hero]?.damage).toBe(3);
  });
  lineSpec("07038:A:1", "two players: the player it engages answers, and only his characters can take the damage", (effects) => {
    const made = make({ seats: 2, phase: "Encounter", staging: ["07038"], threat: [28, 35] }, effects);
    const done = answerWith(made, engaged(made));
    expect(done.seats[1]?.engaged.map((id) => codeOf(done, id))).toEqual(["07038"]);
    expect(done.cards[made.seat1Hero ?? ""]?.damage).toBe(3);
    expect(done.cards[made.hero]?.damage).toBe(0);
    expect(done.cards[made.hero2]?.damage).toBe(0);
  });
});

describe("07040 Orc Hound", () => {
  lineSpec("07040:A:2", "after it engages a player that player exhausts a character he controls", (effects) => {
    const made = make({ seats: 2, phase: "Encounter", staging: ["07040"], threat: [10, 40] }, effects);
    const done = drive(made, opened(made), (st) => st.phase === "Combat").state;
    expect(done.seats[1]?.engaged.map((id) => codeOf(done, id))).toEqual(["07040"]);
    expect(done.cards[made.seat1Hero ?? ""]?.exhausted).toBe(true);
    expect(done.cards[made.hero]?.exhausted).toBe(false);
    expect(done.cards[made.hero2]?.exhausted).toBe(false);
  });
});

describe("07039 Orc Hunter", () => {
  lineSpec("07039:A:1", "When Revealed: the first player (not the player who revealed it) chooses to reveal an additional encounter card or to remove a time counter", (effects) => {
    const made = make({ seats: 2, firstPlayer: 1, stage: "07063", timeCounters: 2, deck: ["f3", "f0"] }, effects);
    const asked = reveal(made, "07039", 0);
    expect(asked.state.window).toMatchObject({ kind: "choose", seat: 1, options: expect.arrayContaining(["reveal", "time"]) });
    const more = send(asked, { type: "Choose", optionId: "reveal" }, made.ctx);
    const revealedMore = drive(made, more, (st) => st.window?.kind !== "choose" && st.stack.length === 0).state;
    expect(stagingCodes(revealedMore).sort()).toEqual(["07039", "f3"]);
    expect(stageResources(revealedMore)).toBe(2);
    const timed = send(asked, { type: "Choose", optionId: "time" }, made.ctx).state;
    expect(stageResources(timed)).toBe(1);
    expect(stagingCodes(timed)).not.toContain("f3");
  });
  lineSpec("07039:A:1", "with no time counter left to remove the additional card is revealed with no question", (effects) => {
    const made = make({ stage: "07063", timeCounters: 0, deck: ["f3", "f0"] }, effects);
    const done = reveal(made, "07039", 0, first).state;
    expect(done.window?.kind).not.toBe("choose");
    expect(stagingCodes(done)).toContain("f3");
  });
});

describe("07041 Orc Hunting Party", () => {
  const orcs = (state: ScenarioState): string[] => Object.values(state.cards).filter((card) => card.shadowId != null).map((card) => card.code).sort();
  lineSpec("07041:A:1", "each Orc enemy in play, in the staging area too, is dealt a shadow card and gets -15 engagement cost; a non-Orc is left alone", (effects) => {
    const made = make({ engaged: ["07038"], staging: ["07039", "07040"], deck: ["f0", "f0", "f0", "place"] }, effects);
    const done = reveal(made, "07041", 0, first).state;
    expect(orcs(done)).toEqual(["07038", "07039"]);
    expect(statOf(done, made.cards, "07038", "engagementCost")).toBe(18);
    expect(statOf(done, made.cards, "07039", "engagementCost")).toBe(20);
    expect(statOf(done, made.cards, "07040", "engagementCost")).toBe(20);
    // An Orc stands in the staging area, so the card gains no surge: the location below the two shadow cards is not revealed.
    expect(codesIn(done, "encounterDeck").sort()).toEqual(["f0", "place"]);
    expect(stagingCodes(done).sort()).toEqual(["07039", "07040"]);
  });
  lineSpec("07041:A:1", "the engagement cost returns when the round ends", (effects) => {
    const made = make({ staging: ["07039"], deck: ["f0", "f0"] }, effects);
    const done = reveal(made, "07041", 0, first).state;
    expect(statOf(done, made.cards, "07039", "engagementCost")).toBe(20);
    const next = drive(made, opened(made, { ...done, ...opening("Combat") }), (st) => st.phase === "Planning" && st.stack.length === 0).state;
    expect(statOf(next, made.cards, "07039", "engagementCost")).toBe(35);
  });
  lineSpec("07041:A:1", "with no Orc in the staging area it gains surge, with the Orc engaged it is dealt a shadow card", (effects) => {
    const made = make({ engaged: ["07038"], staging: ["07040"], deck: ["f0", "place", "f0"] }, effects);
    const done = reveal(made, "07041", 0, first).state;
    expect(orcs(done)).toEqual(["07038"]);
    expect(stagingCodes(done)).toContain("place");
  });
});

describe("07053 Prowling Wolf and 07054 Broken Lands", () => {
  lineSpec("07053:A:1", "while engaged it gets +1 Attack for each location in the staging area; in the staging area it does not", (effects) => {
    const engaged = make({ engaged: ["07053"], staging: ["place", "place"], active: "place" }, effects);
    expect(statOf(engaged.state, engaged.cards, "07053", "attack")).toBe(3);
    const staged = make({ staging: ["07053", "place", "place"] }, effects);
    expect(statOf(staged.state, staged.cards, "07053", "attack")).toBe(1);
    const none = make({ engaged: ["07053"] }, effects);
    expect(statOf(none.state, none.cards, "07053", "attack")).toBe(1);
  });
  const progressOn = (effects: readonly Effect[], layout: Layout): number => {
    const made = make(layout, effects);
    const done = runInstruction(made, made.state, { verb: "PlaceProgressOn", amount: 1, target: "eachStagingLocation" } as never, { sourceId: idOf(made.state, "place") });
    return done.cards[idOf(done, "place")]?.progress ?? 0;
  };
  lineSpec("07054:A:1", "while Broken Lands is in the staging area no progress can be placed on a location in the staging area", (effects) => {
    expect(progressOn(effects, { staging: ["07054", "place"] })).toBe(0);
    expect(progressOn(effects, { staging: ["place"], engaged: ["07053"] })).toBe(1);
    expect(progressOn(effects, { staging: ["place"], discard: ["07054"] })).toBe(1);
    expect(progressOn(effects, { staging: ["place"], active: "07054" })).toBe(1);
  });
  lineSpec("07054:A:2", "as a Shadow, the attacking enemy gets +1 Attack for each location in the staging area", (effects) => {
    const hit = fightEnemy((l: Layout) => make(l, effects), "07054", "f0", { staging: ["place", "place"] }, { undefended: true });
    expect(hit.run.state.cards[hit.made.hero]?.damage).toBe(3);
  });
});

describe("the Shadow lines of the Orcs", () => {
  const damaged = (state: ScenarioState, ...ids: string[]): number[] => ids.map((id) => state.cards[id]?.damage ?? 0);
  lineSpec("07038:A:2", "as a Shadow, the attacking enemy gets +1 Attack for this attack only", (effects) => {
    const hit = fightEnemy((l: Layout) => make(l, effects), "07038", "f0", { stage: "07062" }, { undefended: true });
    expect(damaged(hit.run.state, hit.made.hero)).toEqual([2]);
  });
  lineSpec("07039:A:2", "as a Shadow, the attacking enemy attacks again after this attack, with a new shadow card", (effects) => {
    const hit = fightEnemy((l: Layout) => make(l, effects), "07039", "f0", {}, { undefended: true });
    expect(damaged(hit.run.state, hit.made.hero)).toEqual([2]);
    expect(codesIn(hit.run.state, "encounterDeck")).toHaveLength(2);
  });
  lineSpec("07053:A:2", "as a Shadow, the defending player exhausts a character he controls: one hero, and his own", (effects) => {
    const hit = fightEnemy((l: Layout) => make(l, effects), "07053", "f0", {}, { undefended: true });
    // The state while the attack is in progress: the refresh phase after it readies every card.
    expect([hit.made.hero, hit.made.hero2].filter((id) => hit.during.cards[id]?.exhausted === true)).toHaveLength(1);
    const other = fightEnemy((l: Layout) => make(l, effects), "07053", "f0", { seats: 2, engaged: [{ code: "f0", seat: 1 }] }, { undefended: true, defender: (made) => made.seat1Hero ?? "" });
    expect(other.during.cards[other.made.seat1Hero ?? ""]?.exhausted).toBe(true);
    expect(other.during.cards[other.made.hero]?.exhausted).toBe(false);
    expect(other.during.cards[other.made.hero2]?.exhausted).toBe(false);
  });
});

describe("07055 Take Cover!", () => {
  // The deck below holds what surge reveals next.
  const cover = (effects: readonly Effect[], layout: Layout): Run => reveal(make({ seats: 2, firstPlayer: 1, deck: ["f0", "f0"], ...layout }, effects), "07055", 0);
  lineSpec("07055:A:2", "the first player chooses: 1 damage to each exhausted character of any player, or 1 time counter off the current quest", (effects) => {
    const made = make({ seats: 2, firstPlayer: 1, stage: "07063", timeCounters: 2, exhaustedCards: ["dh1", "dh3"] }, effects);
    const asked = reveal(made, "07055", 0);
    expect(asked.state.window).toMatchObject({ kind: "choose", seat: 1, options: expect.arrayContaining(["damage", "time"]) });
    const hurt = send(asked, { type: "Choose", optionId: "damage" }, made.ctx).state;
    expect([made.hero, made.hero2, made.seat1Hero ?? ""].map((id) => hurt.cards[id]?.damage)).toEqual([1, 0, 1]);
    expect(stageResources(hurt)).toBe(2);
    const timed = send(asked, { type: "Choose", optionId: "time" }, made.ctx).state;
    expect(stageResources(timed)).toBe(1);
    expect([made.hero, made.seat1Hero ?? ""].map((id) => timed.cards[id]?.damage)).toEqual([0, 0]);
  });
  lineSpec("07055:A:2", "with no exhausted character the time counter is removed with no question, and with no counter the damage is dealt", (effects) => {
    const noExhausted = cover(effects, { stage: "07063", timeCounters: 2 });
    expect(noExhausted.state.window?.kind).not.toBe("choose");
    expect(stageResources(noExhausted.state)).toBe(1);
    const noCounter = cover(effects, { exhaustedCards: ["dh2"] });
    expect(noCounter.state.window?.kind).not.toBe("choose");
    expect(noCounter.state.cards[idOf(noCounter.state, "dh2")]?.damage).toBe(1);
  });
});
