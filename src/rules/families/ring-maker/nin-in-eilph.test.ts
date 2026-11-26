// Rules: rm.time-x, rm.parallel-stages, rr.quest-advancement, rr.quest-cards-quest-deck, rr.forced (data/rules/entries.json); ledger lines 08094:B:1, 08095:B:2, 08095:B:4, 08098:B:2.
// The engine The Nîn-in-Eilph adds: the stages 2 and 3 are played in a random order and come back to the quest deck (AdvanceToRandomStage with and without `onDefeat`, the quest's order skipping a set of alternatives), time counters removed announced once for a whole removal
// (`timeCountersRemoved`), and the table flags that bar what player card effects give and what committing costs.
import { describe, expect, it } from "vitest";

import { updateCard, type ScenarioState } from "../../core/state.ts";
import type { EngineStep } from "../../core/intents.ts";
import { settle } from "../../engine/machine.ts";
import { legalTargets } from "../../engine/legal.ts";
import { reduce } from "../../engine/reduce.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { drawMany } from "../../interpret/interpret.ts";
import { mayGainResources } from "../misc/guards.ts";
import { ruleCause, UNATTRIBUTED } from "../../core/cause.ts";
import { placeDamage } from "../../core/keywords.ts";
import { codesIn, fight, idOf, resolveRecords, run, statOf, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const table = (layout: Layout) => tableFromLayout("the-nin-in-eilph", layout);
const STAGE_2 = ["08095", "08096", "08097"];
const STAGE_3 = ["08098", "08099", "08100"];
const codeOf = (state: ScenarioState, id: string | null | undefined): string | undefined => (id ? state.cards[id]?.code : undefined);
const inDeck = (state: ScenarioState, code: string): boolean => state.questDeck.some((id) => state.cards[id]?.code === code);
// A modifier of the table, held while the stage is in play.
const hold = (state: ScenarioState, stat: ScenarioState["modifiers"][number]["stat"]): ScenarioState => ({ ...state, modifiers: [...state.modifiers, { instanceId: "table", sourceId: state.questStage ?? "", stat, amount: 1, until: "whileSourceInPlay" }] });
const flaggedNotReady = (state: ScenarioState, id: string): boolean => state.modifiers.some((modifier) => modifier.instanceId === id && modifier.stat === "doesNotReady");
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

describe("the stages 2 and 3 take a random stage and come back (AdvanceToRandomStage)", () => {
  it("08095:B:2 the last time counter takes the quest to a different stage 2A and the stage goes back into the quest deck with no progress or counters", () => {
    const chosen = new Set<string>();
    for (const seed of SEEDS) {
      const t = table({ stage: "08095", phase: "Refresh", seed });
      const stage = t.state.questStage ?? "";
      const done = settle(updateCard(t.state, stage, { resources: 1, progress: 2 }), t.ctx, []);
      const now = codeOf(done, done.questStage) ?? "";
      expect(STAGE_2).toContain(now);
      expect(now).not.toBe("08095");
      expect(inDeck(done, "08095")).toBe(true);
      expect(done.cards[stage]).toMatchObject({ progress: 0, resources: 0, face: "A" });
      chosen.add(now);
    }
    expect([...chosen].sort()).toEqual(["08096", "08097"]);
  });

  it("08095:B:2 a stage that returns takes its Time 3 again when it is revealed next", () => {
    const t = table({ stage: "08095", phase: "Refresh", seed: 1 });
    const first = t.state.questStage ?? "";
    const away = settle(updateCard(t.state, first, { resources: 1 }), t.ctx, []);
    // The returned stage is revealed again (the quest comes back to it): its Time puts 3 counters on it, none are left from before.
    const back = run(t, away, { verb: "AdvanceToStage", code: "08095" });
    expect(codeOf(back, back.questStage)).toBe("08095");
    expect(back.cards[first]).toMatchObject({ progress: 0, resources: 3, face: "B" });
  });

  it("08095:B:4 defeating a stage 2 takes the quest to a random stage 3A, and it does not come back", () => {
    const chosen = new Set<string>();
    for (const seed of SEEDS) {
      const t = table({ stage: "08096", seed });
      const stage = t.state.questStage ?? "";
      const done = run(t, t.state, { verb: "AdvanceStage" }, { sourceId: stage });
      const now = codeOf(done, done.questStage) ?? "";
      expect(STAGE_3).toContain(now);
      expect(inDeck(done, "08096")).toBe(false);
      chosen.add(now);
    }
    expect(chosen.size).toBeGreaterThan(1);
  });

  it("08098:B:2 the last time counter of a stage 3 takes the quest to a different stage 3A", () => {
    for (const seed of SEEDS) {
      const t = table({ stage: "08099", phase: "Refresh", seed });
      const stage = t.state.questStage ?? "";
      const done = settle(updateCard(t.state, stage, { resources: 1 }), t.ctx, []);
      const now = codeOf(done, done.questStage) ?? "";
      expect(STAGE_3).toContain(now);
      expect(now).not.toBe("08099");
      expect(inDeck(done, "08099")).toBe(true);
    }
  });

  it("defeating any stage 3 goes on to stage 4, whichever of the three it is", () => {
    for (const code of STAGE_3) {
      const t = table({ stage: code });
      const done = run(t, t.state, { verb: "AdvanceStage" }, { sourceId: t.state.questStage ?? "" });
      expect(codeOf(done, done.questStage)).toBe("08101");
    }
  });

  it("08094:B:1 stage 1 advances to one of the stages 2A, and the others stay in the quest deck", () => {
    const t = table({ stage: "08094", side: "A" });
    const stage = t.state.questStage ?? "";
    const done = resolveRecords(t.state, t.ctx, "08094", "whenRevealed", stage).state;
    expect(STAGE_2).toContain(codeOf(done, done.questStage) ?? "");
    expect(codesIn(done, "questDeck").filter((code) => STAGE_2.includes(code))).toHaveLength(2);
  });
});

describe("timeCountersRemoved: once for a whole removal of counters from the current quest (08103:A:3)", () => {
  const MARSH = "08103";
  const withCounters = (counters: number) => {
    const t = table({ stage: "08095", phase: "Refresh", staging: [MARSH] });
    const stage = t.state.questStage ?? "";
    return { t, stage, state: updateCard(t.state, stage, { resources: counters }) };
  };
  const tokens = (state: ScenarioState): number => Object.values(state.cards).find((card) => card.code === MARSH)?.resources ?? 0;

  it("a removal of 2 counters puts 1 token on the Marsh-dweller, not 2", () => {
    const { t, stage, state } = withCounters(3);
    const done = run(t, state, { verb: "RemoveTimeFromQuest", amount: 2 });
    expect(done.cards[stage]?.resources).toBe(1);
    expect(tokens(done)).toBe(1);
  });

  it("a removal that takes the last counter is announced too", () => {
    const { t, state } = withCounters(1);
    expect(tokens(run(t, state, { verb: "RemoveTimeFromQuest", amount: 1 }))).toBe(1);
  });

  it("each removal is announced: two removals, two tokens", () => {
    const { t, state } = withCounters(3);
    const once = run(t, state, { verb: "RemoveTimeFromQuest", amount: 1 });
    expect(tokens(run(t, once, { verb: "RemoveTimeFromQuest", amount: 1 }))).toBe(2);
  });

  it("the refresh phase's removal is one too", () => {
    const { t, state } = withCounters(3);
    expect(tokens(settle(state, t.ctx, []))).toBe(1);
  });

  it("RemoveTimeCounters of the refresh sweep is one too", () => {
    const { t, state } = withCounters(3);
    expect(tokens(run(t, state, { verb: "RemoveTimeCounters" }))).toBe(1);
  });

  it("a stage with no counter loses none and tells nobody", () => {
    const { t, state } = withCounters(0);
    expect(tokens(run(t, state, { verb: "RemoveTimeFromQuest", amount: 2 }))).toBe(0);
  });

  it("08075:A:2 while no time counter can be removed nothing is announced", () => {
    const { t, state } = withCounters(3);
    const barred = hold(state, "timeBarred");
    const done = run(t, barred, { verb: "RemoveTimeFromQuest", amount: 2 });
    expect(done.cards[state.questStage ?? ""]?.resources).toBe(3);
    expect(tokens(done)).toBe(0);
  });

  it("a game that deals no card that hears it queues nothing", () => {
    const t = tableFromLayout("the-fords-of-isen", { stage: "07059" });
    const stage = t.state.questStage ?? "";
    const done = run(t, updateCard(t.state, stage, { resources: 2 }), { verb: "RemoveTimeFromQuest", amount: 1 });
    expect((done.pendingEvents ?? []).some((event) => event.trigger === "timeCountersRemoved")).toBe(false);
  });
});

describe("the stage 2 flags: what player card effects give and what committing costs (08095:B:3, 08096:B:3)", () => {
  const at = (stage: string, layout: Layout = {}) => table({ stage, hand: ["event", "ally", "event"], deckOf: ["filler", "filler", "filler"], play: ["ally"], ...layout });

  it("08095:B:3 a resource a player card effect would give is not gained, the resource phase's collection and an encounter card's are", () => {
    const t = at("08095");
    const hero = t.hero;
    const event = t.state.seats[0]?.hand[0] ?? "";
    const barred = (state: ScenarioState, source: string | null): boolean => !mayGainResources(state, hero, source, t.ctx);
    const held = hold(t.state, "cannotGainResourcesByPlayerCard");
    expect(barred(held, event)).toBe(true);
    expect(barred(held, null)).toBe(false);
    expect(barred(at("08097").state, event)).toBe(false);
    const staged = tableFromLayout("the-nin-in-eilph", { stage: "08095", staging: ["08103"] });
    expect(!mayGainResources(hold(staged.state, "cannotGainResourcesByPlayerCard"), staged.hero, idOf(staged.state, "08103"), staged.ctx)).toBe(false);
  });

  it("08095:B:3 the stage holds both flags while it is the current quest, and none at 08096 or 08097", () => {
    const flags = (stage: string): string[] => {
      const t = table({ stage });
      return syncConstants(t.state, t.ctx).modifiers.map((modifier) => modifier.stat).filter((stat) => ["cannotGainResourcesByPlayerCard", "cannotDrawByPlayerCard", "commitDiscardsRandom"].includes(stat)).sort();
    };
    expect(flags("08095")).toEqual(["cannotDrawByPlayerCard", "cannotGainResourcesByPlayerCard"]);
    expect(flags("08096")).toEqual(["commitDiscardsRandom"]);
    expect(flags("08097")).toEqual([]);
  });

  it("08095:B:3 a draw a player card effect makes is not made, one the framework makes is", () => {
    const t = at("08095");
    const held = hold(t.state, "cannotDrawByPlayerCard");
    const hand = (state: ScenarioState): number => state.seats[0]?.hand.length ?? 0;
    const before = hand(t.state);
    expect(hand(drawMany(held, 0, 1, [], UNATTRIBUTED, t.ctx, false, true))).toBe(before);
    expect(hand(drawMany(held, 0, 1, [], UNATTRIBUTED, t.ctx, false, false, true))).toBe(before + 1);
    const free = at("08097");
    expect(hand(drawMany(free.state, 0, 1, [], UNATTRIBUTED, free.ctx, false, true))).toBe(before + 1);
  });

  const commits = (state: ScenarioState, ctx: ReturnType<typeof at>["ctx"], ids: string[]): ScenarioState => reduce(state, { type: "Commit", cardIds: ids }, ctx).state;

  it("08096:B:3 a player who commits discards a card at random from his hand first", () => {
    const t = at("08096", { phase: "Quest" });
    const hero = t.hero;
    const before = t.state.seats[0]?.hand.length ?? 0;
    const done = commits(t.state, t.ctx, [hero]);
    expect(done.cards[hero]?.committed).toBe(true);
    expect(done.seats[0]?.hand.length).toBe(before - 1);
    expect(done.seats[0]?.discard.length).toBe(1);
  });

  it("08096:B:3 a player with no card in hand cannot commit", () => {
    const t = tableFromLayout("the-nin-in-eilph", { stage: "08096", phase: "Quest", play: ["ally"] });
    expect(t.state.seats[0]?.hand.length).toBe(0);
    expect(legalTargets(t.state, { type: "Commit" }, t.ctx)).toEqual([]);
    expect(reduce(t.state, { type: "Commit", cardIds: [t.hero] }, t.ctx).ok).toBe(false);
  });

  it("08097:B:3 a player with no card in hand commits freely under any other stage 2", () => {
    const t = tableFromLayout("the-nin-in-eilph", { stage: "08097", phase: "Quest", play: ["ally"] });
    expect(commits(t.state, t.ctx, [t.hero]).cards[t.hero]?.committed).toBe(true);
  });
});

describe("the Ancient Marsh-dweller joins the staging area and attacks (08098:A:1, 08101:A:1, 08101:B:2, 08101:B:3)", () => {
  const MARSH = "08103";
  const FILLERS = ["f0", "f0", "f0", "f0"];
  // The attacks are fought out: every defense window is answered with an undefended hero, every other window passed, until nothing resolves.
  const fought = (t: ReturnType<typeof table>, from: { state: ScenarioState; steps: EngineStep[] }) => fight(t, from, (state) => state.pendingAttack == null && state.stack.length === 0 && state.window?.kind !== "defense");
  const attacked = (steps: readonly { kind: string }[]): number[] => steps.flatMap((step) => (step.kind === "attack" ? [(step as unknown as { seat: number }).seat] : []));
  const marshOf = (state: ScenarioState) => state.cards[idOf(state, MARSH)];

  it("08098:A:1 the set-aside copy joins the staging area and each player's threat goes up by 1", () => {
    const t = table({ stage: "08098", side: "A", setAside: [MARSH], threat: [28, 30], seats: 2 });
    const done = resolveRecords(t.state, t.ctx, "08098", "whenRevealed", t.state.questStage ?? "").state;
    expect(marshOf(done)?.zone).toBe("staging");
    expect([done.seats[0]?.threat, done.seats[1]?.threat]).toEqual([29, 31]);
  });

  it("08099:A:1 a copy engaged with a player returns to the staging area, healed, and keeps its resource tokens", () => {
    const t = table({ stage: "08099", side: "A", engaged: [{ code: MARSH, seat: 0, damage: 4, resources: 2 }] });
    const done = resolveRecords(t.state, t.ctx, "08099", "whenRevealed", t.state.questStage ?? "").state;
    expect(marshOf(done)).toMatchObject({ zone: "staging", damage: 0, resources: 2 });
    expect(done.seats[0]?.engaged).toEqual([]);
  });

  it("08100:A:1 a copy already in the staging area is healed", () => {
    const t = table({ stage: "08100", side: "A", staging: [{ code: MARSH, damage: 5 }] });
    const done = resolveRecords(t.state, t.ctx, "08100", "whenRevealed", t.state.questStage ?? "").state;
    expect(marshOf(done)).toMatchObject({ zone: "staging", damage: 0 });
  });

  it("08101:A:1 it attacks each player once, in player order, and stays in the staging area", () => {
    const t = table({ stage: "08101", side: "A", setAside: [MARSH], seats: 2, deck: FILLERS, threat: [20, 20] });
    const done = fought(t, resolveRecords(t.state, t.ctx, "08101", "whenRevealed", t.state.questStage ?? ""));
    expect(attacked(done.steps)).toEqual([0, 1]);
    expect(marshOf(done.state)?.zone).toBe("staging");
  });

  it("08101:A:1 with the first player in the second seat, that seat is attacked first", () => {
    const t = table({ stage: "08101", side: "A", setAside: [MARSH], seats: 2, firstPlayer: 1, deck: FILLERS, threat: [20, 20] });
    const done = fought(t, resolveRecords(t.state, t.ctx, "08101", "whenRevealed", t.state.questStage ?? ""));
    expect(attacked(done.steps)).toEqual([1, 0]);
  });

  it("08101:B:2 after the last time counter it attacks each player, and only then 2 time counters go on the stage, which does not advance", () => {
    const t = table({ stage: "08101", phase: "Refresh", staging: [MARSH], deck: FILLERS, threat: [20, 20] });
    const stage = t.state.questStage ?? "";
    const steps: EngineStep[] = [];
    const started = { state: settle(updateCard(t.state, stage, { resources: 1 }), t.ctx, steps), steps };
    expect(started.state.window?.kind).toBe("defense");
    expect(started.state.cards[stage]?.resources).toBe(0);
    const done = fought(t, started);
    expect(attacked(done.steps)).toEqual([0]);
    expect(done.state.cards[stage]?.resources).toBe(2);
    expect(done.state.questStage).toBe(stage);
  });

  it("08101:B:3 the players win when the Marsh-dweller is destroyed, staged or engaged", () => {
    for (const layout of [{ staging: [MARSH] }, { engaged: [{ code: MARSH, seat: 0 }] }] as const) {
      const t = table({ stage: "08101", ...layout });
      const alive = placeDamage(t.state, idOf(t.state, MARSH), 8, t.ctx.cards, [], "combat", ruleCause("rr.damage"));
      expect(settle(alive, t.ctx, []).stageCleared).toBeFalsy();
      const destroyed = placeDamage(t.state, idOf(t.state, MARSH), 9, t.ctx.cards, [], "combat", ruleCause("rr.damage"));
      expect(settle(destroyed, t.ctx, []).stageCleared).toBe(true);
    }
  });

  it("08103:A:2 it gets +1 Threat and +1 Attack for each resource token on it", () => {
    for (const tokens of [0, 3]) {
      const t = table({ stage: "08098", staging: [{ code: MARSH, resources: tokens }] });
      expect(statOf(t.state, t.ctx.cards, MARSH, "attack")).toBe(6 + tokens);
      expect(statOf(t.state, t.ctx.cards, MARSH, "threat")).toBe(3 + tokens);
    }
  });
});

describe("the stage rules that read the table (08097:B:3, 08098:B:3, 08099:B:3, 08100:B:3)", () => {
  it("08097:B:3 a player plays 1 card each round and no more, whichever card it is", () => {
    const t = table({ stage: "08097", phase: "Planning", hand: ["ally", "ally"], heroResources: 4 });
    const [first, second] = t.state.seats[0]?.hand ?? [];
    const played = reduce(t.state, { type: "PlayCard", cardId: first ?? "", payments: [{ heroId: t.hero, amount: 1 }] }, t.ctx);
    expect(played.ok).toBe(true);
    expect(reduce(played.state, { type: "PlayCard", cardId: second ?? "", payments: [{ heroId: t.hero, amount: 1 }] }, t.ctx).ok).toBe(false);
    const free = table({ stage: "08098", phase: "Planning", hand: ["ally", "ally"], heroResources: 4 });
    const open = reduce(free.state, { type: "PlayCard", cardId: free.state.seats[0]?.hand[0] ?? "", payments: [{ heroId: free.hero, amount: 1 }] }, free.ctx);
    expect(reduce(open.state, { type: "PlayCard", cardId: free.state.seats[0]?.hand[1] ?? "", payments: [{ heroId: free.hero, amount: 1 }] }, free.ctx).ok).toBe(true);
  });

  it("08098:B:3 each location in play gets +1 Threat, the staging area's and the active location", () => {
    const threats = (stage: string): number[] => {
      const t = table({ stage, staging: ["08106"], active: "08107" });
      return [statOf(t.state, t.ctx.cards, "08106", "threat"), statOf(t.state, t.ctx.cards, "08107", "threat")];
    };
    const [a, b] = threats("08098");
    const [c, d] = threats("08099");
    expect([a - c, b - d]).toEqual([1, 1]);
  });

  it("08099:B:3 at the beginning of the refresh phase a player readies at most 5 characters", () => {
    const allies = ["ally", "ally", "ally", "ally", "ally", "ally", "ally"];
    const t = table({ stage: "08099", phase: "Refresh", play: allies, exhaustedCards: ["ally", "dh1", "dh2"] });
    const done = resolveRecords(syncConstants(t.state, t.ctx), t.ctx, "08099", "forced", t.state.questStage ?? "").state;
    const held = Object.values(done.cards).filter((card) => card.exhausted && flaggedNotReady(done, card.id));
    const characters = Object.values(done.cards).filter((card) => card.exhausted && (card.zone === "heroes" || card.zone === "play")).length;
    expect(characters - held.length).toBe(5);
  });

  it("08100:B:3 each enemy in the staging area gets -20 engagement cost, an engaged enemy does not", () => {
    const cost = (stage: string, layout: Layout): number => {
      const t = table({ stage, ...layout });
      return statOf(t.state, t.ctx.cards, "08104", "engagementCost");
    };
    expect(cost("08099", { staging: ["08104"] }) - cost("08100", { staging: ["08104"] })).toBe(20);
    expect(cost("08099", { engaged: [{ code: "08104", seat: 0 }] })).toBe(cost("08100", { engaged: [{ code: "08104", seat: 0 }] }));
  });
});
