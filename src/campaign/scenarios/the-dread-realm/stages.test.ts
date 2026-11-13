// Rules: mec108.reanimated-dead, rr.quest-advancement, rr.attachment-cards, rr.active-location, rr.search, rr.first-player, rr.cancel, rr.removed-from-game, rr.modifiers, rr.effects, faq.progress-without-advancing, faq.triggering-forced-effects (data/rules/entries.json)
// ledger lines 10150:B:2, 10151:A:1, 10151:B:2, 10152:A:1, 10152:B:2, 10152:B:3, 10153:A:2, 10153:A:3, 10154:A:1, 10154:A:2, 101163:A:1. The three stages, Daechanar, the Altar of Midwinter and A Fell Dread, on tables built from a layout.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../../rules/core/intents.ts";
import { modifiedStat, placeDamage } from "../../../rules/core/keywords.ts";
import { flagged, type ScenarioState } from "../../../rules/core/state.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { legalIntents } from "../../../rules/engine/legal.ts";
import { ruleCause } from "../../../rules/core/cause.ts";
import { placeQuestProgress, advanceStage } from "../../../rules/quest/quest.ts";
import { finish, idOf, idsOf, resolveRecords, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "the-dread-realm";
const DAECHANAR = "10153";
const ALTAR = "10154";
const CALAMITY = "101164";
const FELL_DREAD = "101163";
const SET_ASIDE = [DAECHANAR, ALTAR];
const ENCOUNTER = ["f0", "f0", "f0", "f0", "f0", "f0"];

const built = (layout: Layout = {}) => tableFromLayout(SCENARIO, { seats: 2, deck: ENCOUNTER, ...layout });
const settled = (state: ScenarioState, t: { ctx: Parameters<typeof settle>[1] }, steps: EngineStep[] = []): ScenarioState => settle({ ...state, window: null, mode: "stopped" }, t.ctx, steps);
const deadOf = (state: ScenarioState, seat: number): string[] => state.seats[seat]?.engaged.filter((id) => state.cards[id]?.code.endsWith("~dead")) ?? [];
const canAdvance = () => true;

describe("stage 1", () => {
  it("10150:B:2 moves the Sorcery cards attached to stage 1 to stage 2 when the quest advances, and discards any other attachment with stage 1", () => {
    const t = built({ stage: "10150", progress: 18, attached: [{ code: CALAMITY, to: "10150" }, { code: "attachment", to: "10150" }] });
    const advanced = advanceStage(t.state, t.cards, [], canAdvance);
    const stage2 = idOf(advanced, "10151");
    expect(advanced.questStage).toBe(stage2);
    expect(advanced.cards[idOf(advanced, CALAMITY)]?.host).toBe(stage2);
    expect(advanced.cards[stage2]?.attachments).toEqual([idOf(advanced, CALAMITY)]);
    expect(advanced.cards[idOf(advanced, "attachment")]?.zone).not.toBe("attached");
  });

  it("10150:B:2 hands Sorcery cards on from stage 1 only: stage 2 discards them when it advances", () => {
    const t = built({ stage: "10151", attached: [{ code: CALAMITY, to: "10151" }] });
    const advanced = advanceStage(t.state, t.cards, [], canAdvance);
    expect(advanced.cards[idOf(advanced, CALAMITY)]?.zone).toBe("encounterDiscard");
  });
});

describe("stage 2 and the Altar of Midwinter", () => {
  it("10151:A:1 adds Daechanar to the staging area, makes the Altar the active location returning the previous one to the staging area, and has each player reanimate the top card of their deck", () => {
    const t = built({ stage: "10151", setAside: SET_ASIDE, active: "place", deckOf: ["filler", "filler"] });
    const run = resolveRecords(t.state, t.ctx, "10151", "whenRevealed", idOf(t.state, "10151"));
    const state = run.state;
    expect(state.cards[idOf(state, DAECHANAR)]?.zone).toBe("staging");
    expect(state.activeLocation).toBe(idOf(state, ALTAR));
    expect(state.cards[idOf(state, "place")]?.zone).toBe("staging");
    for (const seat of [0, 1]) expect(deadOf(state, seat), `seat ${seat}`).toHaveLength(1);
  });

  it("10151:B:2 advances the quest when Daechanar is destroyed", () => {
    const t = built({ stage: "10151", staging: [DAECHANAR], setAside: [ALTAR] });
    const id = idOf(t.state, DAECHANAR);
    const slain = settled(placeDamage(settled(t.state, t), id, 99, t.cards, [], "combat", ruleCause("rr.damage")), t);
    expect(slain.cards[id]?.zone).toBe("victory");
    expect(slain.cards[slain.questStage ?? ""]?.code).toBe("10152");
  });

  it("10153:A:2 gives Daechanar +1 Attack for each Sorcery card in play, none of them a shadow card", () => {
    const none = built({ staging: [DAECHANAR] });
    const two = built({ staging: [DAECHANAR], attached: [{ code: CALAMITY, to: "10150" }, { code: CALAMITY, to: "10150" }] });
    const attack = (t: ReturnType<typeof built>) => modifiedStat(t.state, t.state.cards[idOf(t.state, DAECHANAR)]!, "attack", t.cards);
    expect(attack(two)).toBe(attack(none) + 2);
  });

  it("10153:A:2 makes Daechanar indestructible while a Sorcery card is in play, and 10153:A:3 cancels all damage dealt to him and has the first player remove a Sorcery card from the game", () => {
    const t = built({ staging: [DAECHANAR], attached: [{ code: CALAMITY, to: "10150" }] });
    const id = idOf(t.state, DAECHANAR);
    const hit = placeDamage(settled(t.state, t), id, 99, t.cards, [], "combat", ruleCause("rr.damage"));
    const done = finish({ state: settled(hit, t), steps: [] }, t.ctx);
    expect(done.state.cards[id]).toMatchObject({ zone: "staging", damage: 0 });
    expect(done.state.cards[idOf(done.state, CALAMITY)]?.zone).toBe("removed");
    // With no Sorcery card left the next damage lands, and a lethal blow destroys him.
    const again = settled(placeDamage(settled(done.state, t), id, 99, t.cards, [], "combat", ruleCause("rr.damage")), t);
    expect(again.cards[id]?.zone).toBe("victory");
  });

  it("10153:A:3 takes the damage as it falls: with no Sorcery card in play it lands, and the Forced effect does nothing", () => {
    const t = built({ staging: [DAECHANAR] });
    const id = idOf(t.state, DAECHANAR);
    const hit = settled(placeDamage(settled(t.state, t), id, 2, t.cards, [], "combat", ruleCause("rr.damage")), t);
    expect(hit.cards[id]).toMatchObject({ zone: "staging", damage: 2 });
  });

  it("10154:A:1 stops progress being placed on the Altar while Daechanar is in play, and not otherwise", () => {
    const with_ = built({ active: ALTAR, staging: [DAECHANAR] });
    expect(flagged(settled(with_.state, with_), idOf(with_.state, ALTAR), "noProgressPlaced")).toBe(true);
    const without = built({ active: ALTAR });
    expect(flagged(settled(without.state, without), idOf(without.state, ALTAR), "noProgressPlaced")).toBe(false);
    const aside = built({ active: ALTAR, setAside: [DAECHANAR] });
    expect(flagged(settled(aside.state, aside), idOf(aside.state, ALTAR), "noProgressPlaced")).toBe(false);
  });

  it("10154:A:1 sends the progress the Altar cannot take on to the quest card while Daechanar is in play, and the Altar takes it again once he is gone", () => {
    const t = built({ stage: "10151", active: ALTAR, staging: [DAECHANAR] });
    const placed = placeQuestProgress(settled(t.state, t), 2, t.cards, [], canAdvance);
    expect(placed.cards[idOf(placed, ALTAR)]?.progress).toBe(0);
    expect(placed.cards[placed.questStage ?? ""]?.progress).toBe(2);
    const gone = built({ stage: "10151", active: ALTAR });
    const taken = placeQuestProgress(settled(gone.state, gone), 2, gone.cards, [], canAdvance);
    expect(taken.cards[idOf(taken, ALTAR)]?.progress).toBe(2);
  });

  it("10154:A:2 has the first player reveal 1 additional card or reanimate the top card of their deck, the second not offered with an empty deck", () => {
    const t = built({ active: ALTAR, deckOf: ["filler"], firstPlayer: 1 });
    const altar = idOf(t.state, ALTAR);
    const reveal = resolveRecords(t.state, t.ctx, ALTAR, "forced", altar, (state) => (state.window?.kind === "choose" ? (state.window.options.find((option) => option.includes("reveal")) ?? state.window.options[0] ?? "") : ""));
    expect(reveal.state.staging.length).toBeGreaterThan(t.state.staging.length);
    expect(deadOf(reveal.state, 1)).toHaveLength(0);
    const reanimate = resolveRecords(t.state, t.ctx, ALTAR, "forced", altar, (state) => (state.window?.kind === "choose" ? (state.window.options.find((option) => option.includes("reanimate")) ?? state.window.options[0] ?? "") : ""));
    expect(deadOf(reanimate.state, 1)).toHaveLength(1);
    expect(deadOf(reanimate.state, 0)).toHaveLength(0);
    // The first player's deck is the one read: the player who is not the first player holds the cards, the first player none.
    const other = built({ active: ALTAR, firstPlayer: 1, deckOf: [{ code: "filler", seat: 0 }] });
    const noChoice = resolveRecords(other.state, other.ctx, ALTAR, "forced", idOf(other.state, ALTAR));
    expect(noChoice.state.staging.length).toBeGreaterThan(other.state.staging.length);
    expect(deadOf(noChoice.state, 0)).toHaveLength(0);
    const empty = built({ active: ALTAR, firstPlayer: 1 });
    const only = resolveRecords(empty.state, empty.ctx, ALTAR, "forced", idOf(empty.state, ALTAR));
    expect(only.state.staging.length).toBeGreaterThan(empty.state.staging.length);
  });
});

describe("stage 3", () => {
  it("10152:A:1 has the first player search the encounter deck for locations until the staging area holds one for each player, none when it already does", () => {
    const t = built({ stage: "10152", deck: ["place", "f0", "place", "place", "f0"], staging: [] });
    const two = resolveRecords(t.state, t.ctx, "10152", "whenRevealed", idOf(t.state, "10152"));
    expect(idsOf(two.state, "place").filter((id) => two.state.cards[id]?.zone === "staging")).toHaveLength(2);
    const full = built({ stage: "10152", deck: ["place", "place"], staging: ["place", "place"] });
    const same = resolveRecords(full.state, full.ctx, "10152", "whenRevealed", idOf(full.state, "10152"));
    expect(same.state.staging.filter((id) => same.state.cards[id]?.code === "place")).toHaveLength(2);
    const solo = built({ seats: 1, stage: "10152", deck: ["place", "place"], staging: [] });
    const one = resolveRecords(solo.state, solo.ctx, "10152", "whenRevealed", idOf(solo.state, "10152"));
    expect(one.state.staging.filter((id) => one.state.cards[id]?.code === "place")).toHaveLength(1);
  });

  it("10152:B:2 places the progress that would go on the quest on locations in the staging area, the first player choosing, and a location it explores leaves play", () => {
    const t = built({ stage: "10152", staging: ["place", "place"] });
    const synced = settled(t.state, t);
    // Always the first location offered, and all it can take (the last option of the amount step).
    const takeAll = (state: ScenarioState): string => (state.window?.kind === "choose" ? (state.window.options.at(/^\d+$/.test(state.window.options[0] ?? "") ? -1 : 0) ?? "") : "");
    const placed = finish({ state: settled(placeQuestProgress(synced, 3, t.cards, [], canAdvance), t), steps: [] }, t.ctx, takeAll);
    const left = placed.state.staging.filter((id) => placed.state.cards[id]?.code === "place");
    // Two quest points each: one location took 2 and was explored, the other holds the last 1.
    expect(left).toHaveLength(1);
    expect(placed.state.cards[left[0]!]?.progress).toBe(1);
    expect(placed.state.encounterDiscard.filter((id) => placed.state.cards[id]?.code === "place")).toHaveLength(1);
    expect(placed.state.cards[placed.state.questStage ?? ""]?.progress).toBe(0);
  });

  it("10152:B:2 lets the first player divide the progress as they choose, an amount at a time, each location taking at most what it still needs and the active location taking its share first", () => {
    const t = built({ stage: "10152", staging: ["place", "place", "place"], active: "place" });
    const synced = settled(t.state, t);
    const asked: string[][] = [];
    // One at a time on the location with the least progress: 2 on the active location first, then 1 and 1 on two staged locations, the third left unexplored.
    const fewest = (state: ScenarioState): string => {
      if (state.window?.kind !== "choose") return "";
      asked.push([...state.window.options]);
      if (/^\d+$/.test(state.window.options[0] ?? "")) return "1";
      return [...state.window.options].sort((a, b) => (state.cards[a]?.progress ?? 0) - (state.cards[b]?.progress ?? 0))[0] ?? "";
    };
    const placed = finish({ state: settled(placeQuestProgress(synced, 4, t.cards, [], canAdvance), t), steps: [] }, t.ctx, fewest);
    const staged = placed.state.staging.filter((id) => placed.state.cards[id]?.code === "place");
    expect(staged.map((id) => placed.state.cards[id]?.progress ?? 0).sort()).toEqual([0, 1, 1]);
    expect(placed.state.cards[placed.state.activeLocation ?? ""]?.progress ?? 0).toBeLessThanOrEqual(2);
    // The amount step offers 1 and 2 for a location that needs 2, never a number the location cannot take.
    expect(asked.some((options) => options.join() === "1,2")).toBe(true);
    expect(placed.state.cards[placed.state.questStage ?? ""]?.progress).toBe(0);
  });

  it("10152:B:3 deals 1 damage to every character in play at the end of the quest phase while a location is in play", () => {
    const t = built({ stage: "10152", staging: ["place"], play: ["10176"] });
    const run = resolveRecords(t.state, t.ctx, "10152", "forced", idOf(t.state, "10152"), undefined, false);
    expect(run.state.cards[t.hero]?.damage).toBe(1);
    expect(run.state.cards[t.hero2]?.damage).toBe(1);
    expect(run.state.cards[idOf(run.state, "10176")]?.damage).toBe(1);
    expect(run.state.stageCleared).toBe(false);
  });

  it("10152:B:3 wins the game at the end of the quest phase when no location is in play, the active location counting as in play", () => {
    const empty = built({ stage: "10152" });
    const won = resolveRecords(empty.state, empty.ctx, "10152", "forced", idOf(empty.state, "10152"), undefined, false);
    expect(won.state.stageCleared).toBe(true);
    const active = built({ stage: "10152", active: "place" });
    const held = resolveRecords(active.state, active.ctx, "10152", "forced", idOf(active.state, "10152"), undefined, false);
    expect(held.state.stageCleared).toBe(false);
    expect(held.state.cards[active.hero]?.damage).toBe(1);
  });
});

describe("A Fell Dread", () => {
  it("101163:A:1 is attached by the player with the highest threat to a hero they control without a copy, the Willpower of that hero reduced to 0", () => {
    const t = built({ threat: [25, 33] });
    const run = resolveRecords(t.state, t.ctx, FELL_DREAD, "whenRevealed");
    const hero = run.state.cards[run.id]?.host;
    expect(hero).toBe(t.seat1Hero);
    expect(modifiedStat(settled(run.state, t), settled(run.state, t).cards[hero!]!, "willpower", t.cards)).toBe(0);
    const again = resolveRecords(settled(run.state, t), t.ctx, FELL_DREAD, "whenRevealed");
    expect(again.state.cards[again.id]?.zone).not.toBe("attached");
  });

  it("101163:A:1 goes on a hero without A Fell Dread already attached: a player with two heroes gets one on each, and a copy on an ally reduces nothing", () => {
    const t = built({ threat: [33, 25] });
    const first = resolveRecords(t.state, t.ctx, FELL_DREAD, "whenRevealed");
    const second = resolveRecords(settled(first.state, t), t.ctx, FELL_DREAD, "whenRevealed");
    const hosts = [first.state.cards[first.id]?.host, second.state.cards[second.id]?.host];
    expect(new Set(hosts)).toEqual(new Set([t.hero, t.hero2]));
    const third = resolveRecords(settled(second.state, t), t.ctx, FELL_DREAD, "whenRevealed");
    expect(third.state.cards[third.id]?.zone).not.toBe("attached");
    const ally = built({ play: ["10176"], attached: [{ code: FELL_DREAD, to: "10176" }] });
    const synced = settled(ally.state, ally);
    expect(modifiedStat(synced, synced.cards[idOf(synced, "10176")]!, "willpower", ally.cards)).toBe(1);
  });

  it("101163:A:1 leaves no Pass in the quest commitment while the hero it is on is able to commit, and the hero commits like any other character", () => {
    const t = built({ attached: [{ code: FELL_DREAD, to: "dh1" }] });
    const state = settled(t.state, t);
    const open = { ...state, phase: "Quest" as const, mode: "questCommit" as const, window: { kind: "pass" as const }, activeSeat: 0 };
    expect(legalIntents(open, t.ctx).some((intent) => intent.type === "Pass")).toBe(false);
    expect(legalIntents(open, t.ctx).some((intent) => intent.type === "Commit")).toBe(true);
    const committed = { ...open, cards: { ...open.cards, [t.hero]: { ...open.cards[t.hero]!, committed: true } } };
    expect(legalIntents(committed, t.ctx).some((intent) => intent.type === "Pass")).toBe(true);
    const tired = { ...open, cards: { ...open.cards, [t.hero]: { ...open.cards[t.hero]!, exhausted: true } } };
    expect(legalIntents(tired, t.ctx).some((intent) => intent.type === "Pass")).toBe(true);
  });
});
