// Rules: mec108.the-investigation, mec108.objective-allies, mec108.indestructible, mec108.side-quests-in-play, rr.attachment-cards, rr.shadow-effects, rr.constant-ability, rr.restricted, rr.travel, rr.quest-advancement, faq.progress-without-advancing, faq.additional-attacks (data/rules/entries.json); ledger lines 10095:B:1, 10095:B:2, 10096:A:1, 10102:A:2, 10105:A:3, 10106:A:2, 10110:A:2, 10112:A:1, 10114:A:1, 10113:A:1, 10111:A:1, 10111:A:3, 10113:A:3, 10185:A:1, 10185:A:2, 10186:A:3, 10187:A:2, 10103:A:2, 10104:A:1.
// The Clue objectives and what the players who hold them change, on tables built from data/ by the layout kit.
import { describe, expect, it } from "vitest";

import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { legalIntents, type PlayerIntent } from "../../../rules/engine/reduce.ts";
import { restrictedLoad, travelCostUnpayable } from "../../../rules/interpret/restrictions.ts";
import { enforceRestricted } from "../../../rules/player/attach.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { setCurrentQuest } from "../../../rules/families/angmar/quest.ts";
import { play } from "../../../../test/harness/card-spec-play.ts";
import { quest } from "../../../../test/harness/card-spec.ts";
import { fightEnemy, finish, HERO, idOf, resolveRecords, send, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";

const built = (layout: Layout = {}) => tableFromLayout("the-treachery-of-rhudaur", { stage: "10094", ...layout });
const table = (layout: Layout) => tableFromLayout("the-treachery-of-rhudaur", layout);
const stat = (t: ReturnType<typeof built>, state: ScenarioState, code: string, name: Parameters<typeof modifiedStat>[2], against?: string) => modifiedStat(state, state.cards[idOf(state, code)]!, name, t.ctx.cards, against);
const strike = (state: ScenarioState, hero: string, enemy: string): ScenarioState => ({ ...state, pendingStrike: { seat: 0, enemyId: enemy, attackerIds: [hero] } });
const CLUE_ON_HERO: Layout = { attached: [{ code: "10110", to: HERO }] };

describe("Thaurdir's Pursuit", () => {
  it("10095:B:1 has 5 fewer quest points for each Clue objective attached to a character, and a Clue in the staging area counts for nothing", () => {
    const t = built({ stage: "10095", seats: 2, staging: ["10114"], attached: [{ code: "10110", to: HERO }] });
    const stage = t.state.cards[t.state.questStage ?? ""]!;
    const base = t.ctx.cards.get("10095")?.questPoints ?? 0;
    expect(modifiedStat(t.state, stage, "questPoints", t.ctx.cards)).toBe(base - 5);
    const two = built({ stage: "10095", staging: ["10114"], attached: [{ code: "10110", to: HERO }, { code: "10112", to: HERO }] });
    expect(modifiedStat(two.state, two.state.cards[two.state.questStage ?? ""]!, "questPoints", two.ctx.cards)).toBe(base - 10);
    const none = built({ stage: "10095", staging: ["10112"] });
    expect(modifiedStat(none.state, none.state.cards[none.state.questStage ?? ""]!, "questPoints", none.ctx.cards)).toBe(base);
  });

  it("10095:B:2 wins the game when the stage is defeated with Thaurdir's hit points gone", () => {
    const layout: Layout = { stage: "10095", progress: 29, staging: [{ code: "10098", damage: 9 }], play: ["ally"], committed: ["ally"] };
    const done = play("the-treachery-of-rhudaur", { line: "10095:B:2", layout, act: quest("success"), expect: [] }, EFFECTS, false).run.state;
    expect(done.stageCleared).toBe(true);
    expect(done.lost).toBeFalsy();
  });
});

describe("Amarthiúl", () => {
  it("10096:A:1 lets the player who controls him give him to the player an enemy engages", () => {
    const t = built({ seats: 2, play: ["10096"], staging: ["f3"] });
    const amarthiul = idOf(t.state, "10096");
    const queued = { ...t.state, pendingEvents: [{ trigger: "engaged" as const, seat: 1, subject: idOf(t.state, "f3") }] };
    const rested = settle({ ...queued, window: null, mode: "stopped" }, t.ctx, []);
    const offer = legalIntents(rested, t.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === amarthiul);
    expect(offer).toBeDefined();
    const given = finish(send({ state: rested, steps: [] }, offer as PlayerIntent, t.ctx), t.ctx).state;
    expect(given.cards[amarthiul]?.controller).toBe(1);
  });

  it("10113:A:1 gives each ally -2 Willpower while it is the current quest, Amarthiúl an objective ally included, and no hero", () => {
    const t = built({ phase: "Quest", staging: ["10113"], play: ["10096", "ally"] });
    const before = [stat(t, t.state, "10096", "willpower"), stat(t, t.state, "ally", "willpower"), stat(t, t.state, HERO, "willpower")];
    const chosen = ownCurrent(t, "10113");
    const after = [stat(t, chosen, "10096", "willpower"), stat(t, chosen, "ally", "willpower"), stat(t, chosen, HERO, "willpower")];
    expect(after[0]).toBe(Math.max(0, before[0]! - 2));
    expect(after[1]).toBe(Math.max(0, before[1]! - 2));
    expect(after[2]).toBe(before[2]);
    expect(before[0]).toBeGreaterThan(0);
  });
});

function ownCurrent(t: ReturnType<typeof built>, code: string): ScenarioState {
  return syncConstants(settle(setCurrentQuest(t.state, idOf(t.state, code), t.ctx), t.ctx, []), t.ctx);
}

describe("the shadows that read the Clues", () => {
  it("10102:A:2 gives the attacking enemy no additional attack when the defending player controls a Clue", () => {
    const attackSteps = (steps: readonly { kind: string }[]) => steps.filter((step) => step.kind === "attack").length;
    expect(attackSteps(fightEnemy(table, "10102", "f3", CLUE_ON_HERO, { undefended: true }).run.steps)).toBe(1);
    expect(attackSteps(fightEnemy(table, "10102", "f3", {}, { undefended: true }).run.steps)).toBe(2);
  });

  it("10105:A:3 leaves the attack defended when the defending player controls a Clue", () => {
    const damageOf = (layout: Layout) => {
      const fought = fightEnemy(table, "10105", "f3", layout, {});
      return fought.run.state.cards[fought.made.hero]?.damage;
    };
    expect(damageOf(CLUE_ON_HERO)).toBe(0);
    expect(damageOf({})).toBe(1);
  });

  it("10106:A:2 gives the attacker +1 Attack with a Clue controlled and +3 without", () => {
    const damageOf = (layout: Layout) => {
      const fought = fightEnemy(table, "10106", "f3", layout, { undefended: true });
      return fought.run.state.cards[fought.made.hero]?.damage;
    };
    expect(damageOf(CLUE_ON_HERO)).toBe(2);
    expect(damageOf({})).toBe(4);
  });
});

describe("what a claimed Clue gives its host", () => {
  it("10110:A:2 gives the host +1 Attack only while it attacks an Undead enemy", () => {
    const t = built({ phase: "Combat", attached: [{ code: "10110", to: HERO }], engaged: ["10100", "f3"] });
    const [wight, other] = t.state.seats[0]?.engaged ?? [];
    const hero = idOf(t.state, HERO);
    if (!wight || !other) throw new Error("table");
    const base = stat(t, t.state, HERO, "attack");
    expect(stat(t, strike(t.state, hero, wight), HERO, "attack", wight)).toBe(base + 1);
    expect(stat(t, strike(t.state, hero, other), HERO, "attack", other)).toBe(base);
    expect(stat(t, t.state, HERO, "attack")).toBe(base);
  });

  const claimWith = (clue: string) => {
    const t = built({ phase: "Planning", staging: [clue] });
    const id = idOf(t.state, clue);
    const pick = (state: ScenarioState) => (state.window?.kind === "choose" ? (state.window.options.includes("hero") ? "hero" : (state.window.options[0] ?? "")) : "");
    const run = finish(resolveRecords(t.state, t.ctx, clue, "action", id, pick), t.ctx, pick);
    expect(run.state.cards[idOf(run.state, HERO)]?.exhausted).toBe(true);
    expect(run.state.cards[id]?.host).toBe(idOf(run.state, HERO));
    expect(run.state.cards[id]?.controller).toBe(0);
  };
  it("10112:A:1 is claimed by exhausting a ready hero, attaching to it under the exhausting player's control", () => claimWith("10112"));
  it("10114:A:1 is claimed by exhausting a ready hero, attaching to it under the exhausting player's control", () => claimWith("10114"));
});

describe("the side quests that raise the Threat and flip", () => {
  it("10111:A:1 gives each location in the staging area +1 Threat while it is the current quest, not the active location", () => {
    const t = built({ phase: "Quest", staging: ["10111", "10102"], active: "10097" });
    const base = stat(t, t.state, "10102", "threat");
    const chosen = ownCurrent(t, "10111");
    expect(stat(t, chosen, "10102", "threat")).toBe(base + 1);
    expect(stat(t, chosen, "10097", "threat")).toBe(stat(t, t.state, "10097", "threat"));
    expect(stat(t, t.state, "10102", "threat")).toBe(base);
  });

  const flips = (side: string, clue: string) => {
    const t = built({ phase: "Quest", staging: [{ code: side, progress: 40 }] });
    const done = ownCurrent(t, side);
    const flipped = Object.values(done.cards).filter((card) => card.code === clue);
    expect(flipped).toHaveLength(1);
    expect(flipped[0]?.zone).toBe("staging");
    expect(Object.values(done.cards).filter((card) => card.code === side)).toHaveLength(0);
    expect(done.cards[done.questStage ?? ""]?.code).toBe("10094");
  };
  it("10111:A:3 flips into Heirloom of Iârchon in the staging area when it is defeated", () => flips("10111", "10112"));
  it("10113:A:3 flips into Orders from Angmar in the staging area when it is defeated", () => flips("10113", "10114"));
});

describe("Ghostly Ruins and Decrepit Remains", () => {
  it("10103:A:2 cannot be travelled to with no Undead enemy in the encounter discard pile, and can with one: it returns to the staging area", () => {
    const empty = built({ phase: "Travel", staging: ["10103"], discard: ["f3", "10102"] });
    expect(travelCostUnpayable(empty.state, empty.ctx, idOf(empty.state, "10103"))).toBe(true);
    const some = built({ phase: "Travel", staging: ["10103"], discard: ["f3", "10100"] });
    expect(travelCostUnpayable(some.state, some.ctx, idOf(some.state, "10103"))).toBe(false);
    const run = resolveRecords(some.state, some.ctx, "10103", "travel", idOf(some.state, "10103"));
    expect(run.state.cards[idOf(run.state, "10100")]?.zone).toBe("staging");
  });

  it("10104:A:1 gives each location and encounter side quest in the staging area +2 quest points, the active location and the main quest nothing, and a second copy another 2", () => {
    const t = built({ phase: "Quest", staging: ["10104", "10102", "10109"], active: "10097" });
    const plain = built({ phase: "Quest", staging: ["10102", "10109"], active: "10097" });
    expect(stat(t, t.state, "10102", "questPoints")).toBe(stat(plain, plain.state, "10102", "questPoints") + 2);
    expect(stat(t, t.state, "10104", "questPoints")).toBe((t.ctx.cards.get("10104")?.questPoints ?? 0) + 2);
    expect(stat(t, t.state, "10109", "questPoints")).toBe(stat(plain, plain.state, "10109", "questPoints") + 2);
    expect(stat(t, t.state, "10097", "questPoints")).toBe(stat(plain, plain.state, "10097", "questPoints"));
    const two = built({ phase: "Quest", staging: ["10104", "10104", "10102"] });
    expect(stat(two, two.state, "10102", "questPoints")).toBe(stat(plain, plain.state, "10102", "questPoints") + 4);
  });
});

describe("the boons of the Clues", () => {
  it("10185:A:2 gives the hero +1 Attack, +2 instead while it attacks an Undead enemy", () => {
    const t = built({ phase: "Combat", attached: [{ code: "10185", to: HERO }], engaged: ["10100", "f3"] });
    const [wight, other] = t.state.seats[0]?.engaged ?? [];
    const hero = idOf(t.state, HERO);
    if (!wight || !other) throw new Error("table");
    const bare = built({ phase: "Combat", engaged: ["10100", "f3"] });
    const base = stat(bare, bare.state, HERO, "attack");
    expect(stat(t, strike(t.state, hero, other), HERO, "attack", other)).toBe(base + 1);
    expect(stat(t, strike(t.state, hero, wight), HERO, "attack", wight)).toBe(base + 2);
  });

  it("10186:A:3 heals all the damage from the attached hero when it is played", () => {
    const t = built({ attached: [{ code: "10186", to: HERO }] });
    const hurt = updateCard(t.state, idOf(t.state, HERO), { damage: 4 });
    const run = finish(resolveRecords(hurt, t.ctx, "10186", "response", idOf(hurt, "10186")), t.ctx);
    expect(run.state.cards[idOf(run.state, HERO)]?.damage).toBe(0);
  });

  it("10187:A:2 gives the hero +1 Defense, +2 instead while it defends against an Undead enemy", () => {
    const t = built({ phase: "Combat", attached: [{ code: "10187", to: HERO }], engaged: ["10100", "f3"] });
    const hero = t.state.cards[idOf(t.state, HERO)]!;
    const [wight, other] = t.state.seats[0]?.engaged ?? [];
    if (!wight || !other) throw new Error("table");
    const bare = built({ phase: "Combat", engaged: ["10100", "f3"] });
    const base = stat(bare, bare.state, HERO, "defense");
    const defending = (enemy: string): ScenarioState => ({ ...t.state, pendingAttack: { enemyId: enemy, seat: 0, shadowOffered: true, shadowResolved: true, defenderId: hero.id } });
    expect(modifiedStat(defending(other), hero, "defense", t.ctx.cards)).toBe(base + 1);
    expect(modifiedStat(defending(wight), hero, "defense", t.ctx.cards)).toBe(base + 2);
  });

  it("10185:A:1 is Restricted, like 10186 and 10187: a third restricted attachment on one hero discards one of them", () => {
    const t = built({ attached: [{ code: "10185", to: HERO }, { code: "10186", to: HERO }, { code: "10187", to: HERO }] });
    const hero = idOf(t.state, HERO);
    for (const code of ["10185", "10186", "10187"]) expect(t.ctx.cards.get(code)?.keywords.restricted, code).toBe(true);
    expect(restrictedLoad(t.state, hero, t.ctx)).toBe(3);
    const run = finish({ state: settle(enforceRestricted(t.state, hero, t.ctx, []), t.ctx, []), steps: [] }, t.ctx);
    expect(restrictedLoad(run.state, hero, t.ctx)).toBe(2);
    expect(["10185", "10186", "10187"].filter((code) => run.state.cards[idOf(run.state, code)]?.zone === "discard")).toHaveLength(1);
  });
});
