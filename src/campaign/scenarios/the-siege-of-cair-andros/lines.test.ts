// Rules: ats.cair-andros-location-damage, ats.cair-andros-defense-carry-over, ats.cair-andros-remove-stage, rr.removed-from-game, rr.in-play-and-out-of-play, rr.lasting-effects, rr.cannot, rr.quest-advancement, rr.step-3-4, rr.victory, rr.staging, faq.errata.05061, faq.errata.06123, hon.battle, hon.siege, hon.archery (data/rules/entries.json).
// The lines of The Siege of Cair Andros that a card-spec row cannot show (spec.test.ts holds the rest): 05033:A:1, 05034:A:1, 05035:A:1, 05036:A:1, 05056:A:1, 05057:A:1, 05057:A:2, 05058:A:1, 05059:A:1, 05061:A:2, 05072:A:1, 05072:B:1, 05072:B:2, 05073:B:1, 05074:B:1, 05074:B:2, 05075:B:1, 05076:B:1, 05076:B:3, 05076:B:4.
// Each test builds its moment with the scene kit (test/scenarios/the-siege-of-cair-andros/table.ts); the Setup test starts the game and plays nothing else. The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points and are Tactics.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { archeryTotal, undefendedTargets } from "../../../rules/combat/combat.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { spawn } from "../../../rules/core/zones.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario } from "../../../rules/engine/reduce.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { currentQuestHas } from "../../../rules/families/quest/conditions.ts";
import { progressRoom } from "../../../rules/families/south/locations.ts";
import { advanceStage, committedWillpower, questStatOf } from "../../../rules/quest/quest.ts";
import { attack, defend, quest, resolve, rowProblems, threat, type Row } from "../../../../test/harness/card-spec.ts";
import { payerOk } from "../../../rules/families/costs/pay.ts";
import { spendablePools } from "../../../rules/families/costs/verbs.ts";
import { play } from "../../../../test/harness/card-spec-play.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { finish, heroCard, idOf, idsOf, revealFromTop, type Layout, type LayoutTable } from "../../../../test/harness/scene-kit.ts";
import { androsStart, androsWorld } from "../../../../test/scenarios/the-siege-of-cair-andros/game.ts";
import { CODES, SCENARIO, THREE, codeOf, hurt, run, table } from "../../../../test/scenarios/the-siege-of-cair-andros/table.ts";

const { citadel: CITADEL, approach: APPROACH, banks: BANKS, defense: DEFENSE, reinforcing: REINFORCING, atApproach: AT_APPROACH, atCitadel: AT_CITADEL, lastBattle: LAST_BATTLE, lieutenant: LIEUTENANT, arbalesters: ARBALESTERS, vanguard: VANGUARD, warCamp: WAR_CAMP } = CODES;
const ASSAULT = "05036";
const ORC = "05062";

// A Battleground location removed from the game as soon as it holds its total of damage: the damage on it stops short of the total, then reaches it.
function removedAt(effects: readonly Effect[], code: string, total: number): void {
  const t = table({ staging: THREE }, effects);
  const short = hurt(t, code, total - 1);
  expect(short.cards[idOf(t.state, code)]?.zone).toBe("staging");
  const gone = hurt(t, code, total);
  expect(gone.cards[idOf(t.state, code)]).toMatchObject({ zone: "removed", damage: 0, progress: 0 });
  expect(gone.victory).toEqual([]);
  expect(gone.encounterDiscard).toEqual([]);
  expect(gone.window?.kind).not.toBe("response");
  const active = table({ active: code, staging: THREE.filter((one) => one !== code) }, effects);
  const goneActive = hurt(active, code, total + 2);
  expect(goneActive.cards[idOf(active.state, code)]?.zone).toBe("removed");
  expect(goneActive.activeLocation).toBeNull();
}

describe("05033:A:1, 05034:A:1 and 05035:A:1 removed from the game at a total of damage", () => {
  lineSpec("05033:A:1", "The Citadel is removed from the game at 11 damage, in the staging area or as the active location: not explored, no points, damage beyond 11 lost", (effects) => removedAt(effects, CITADEL, 11));
  lineSpec("05034:A:1", "The Approach is removed from the game at 7 damage, in the staging area or as the active location", (effects) => removedAt(effects, APPROACH, 7));
  lineSpec("05035:A:1", "The Banks is removed from the game at 3 damage, in the staging area or as the active location", (effects) => removedAt(effects, BANKS, 3));

  it("05033:A:1 damage and progress stay apart: progress on the active location does not remove it, and a removed location is no Response of its own", () => {
    const t = table({ active: { code: BANKS, progress: 1 }, staging: [CITADEL, APPROACH] });
    expect(settle({ ...t.state, window: null }, t.ctx, []).cards[idOf(t.state, BANKS)]?.zone).toBe("activeLocation");
    expect(hurt(table({ active: BANKS, staging: [CITADEL, APPROACH] }), BANKS, 3).window?.kind).not.toBe("response");
  });
});

describe("05036:A:1 later entrants", () => {
  lineSpec("05036:A:1", "a character that enters play after the When Revealed effect, in the same round, gets -2 Attack and -2 Defense too (rr.lasting-effects)", (effects) => {
    const done = play(SCENARIO, { line: "05036:A:1", layout: { stage: REINFORCING }, act: resolve(ASSAULT, "whenRevealed"), expect: [] }, effects, false);
    const entered = spawn(done.run.state, "dh3", { zone: "heroes", seat: 0 });
    const state = syncConstants(entered.state, done.table.ctx);
    const hero = state.cards[entered.id]!;
    expect(modifiedStat(state, hero, "attack", done.table.ctx.cards)).toBe(0);
    expect(modifiedStat(state, hero, "defense", done.table.ctx.cards)).toBe(0);
  });
});

describe("05056:A:1 allies cannot defend", () => {
  lineSpec("05056:A:1", "no ally can be declared as the defender against Lieutenant of Mordor", (effects) => {
    const row: Row = { line: "05056:A:1", layout: { stage: REINFORCING, play: ["ally"] }, act: [attack(LIEUTENANT), defend("ally")], expect: [] };
    expect(rowProblems(SCENARIO, row, effects)).toEqual([expect.stringContaining("Allies cannot be declared as defenders")]);
  });
});

describe("05057:A:1 and 05057:A:2 Archery X", () => {
  const spheres = { extra: ["01001", "01007", "01010"], heroes: ["01001", "01007", "01010"] } as const;
  const archery = (effects: readonly Effect[], heroes: readonly string[]): number => {
    const t = table({ stage: REINFORCING, staging: [ARBALESTERS], heroes }, effects, spheres.extra);
    return archeryTotal(t.state, t.ctx.cards);
  };

  lineSpec("05057:A:1", "Orc Arbalesters has Archery X: with only Tactics heroes X is 1, and it has no archery when it is not in play", (effects) => {
    expect(archery(effects, [])).toBe(1);
    const away = table({ stage: REINFORCING }, effects);
    expect(archeryTotal(away.state, away.ctx.cards)).toBe(0);
  });

  lineSpec("05057:A:2", "X is the number of different Leadership, Tactics, Spirit and Lore icons on the heroes in play, each counted once", (effects) => {
    expect(archery(effects, ["01001"])).toBe(2);
    expect(archery(effects, spheres.heroes)).toBe(4);
    const two = table({ stage: REINFORCING, staging: [ARBALESTERS, ARBALESTERS], heroes: ["01001", "01001"] }, effects, spheres.extra);
    expect(archeryTotal(two.state, two.ctx.cards)).toBe(4);
  });
});

describe("05058:A:1 resources locked", () => {
  // The stand-in hero dh1 is given another sphere; dh2 stays Tactics.
  const withSphere = (layout: Layout, effects: readonly Effect[], sphere: "leadership" | "spirit" | "lore" | "neutral"): LayoutTable => {
    const t = table(layout, effects);
    const cards = new Map(t.ctx.cards).set("dh1", { ...heroCard("dh1"), sphere });
    const ctx = { ...t.ctx, cards };
    return { ...t, ctx, state: syncConstants(t.state, ctx) };
  };

  lineSpec("05058:A:1", "while Orc Vanguard is in the staging area a hero with a Leadership, Spirit or Lore icon cannot spend resources, and a Tactics hero can", (effects) => {
    for (const sphere of ["leadership", "spirit", "lore"] as const) {
      const t = withSphere({ heroResources: 2, staging: [VANGUARD] }, effects, sphere);
      const marked = idOf(t.state, "dh1");
      const tactics = idOf(t.state, "dh2");
      expect(payerOk(t.state, marked, 0, undefined, t.ctx)).toBe(false);
      expect(payerOk(t.state, tactics, 0, undefined, t.ctx)).toBe(true);
      expect(spendablePools(t.state, 0, { sphere }, t.ctx).pools).not.toContain(marked);
      expect(spendablePools(t.state, 0, { sphere: "tactics" }, t.ctx).pools).toEqual([tactics]);
    }
  });

  it("05058:A:1 a neutral hero pays, and nothing is held back while Orc Vanguard is not in the staging area", () => {
    const neutral = withSphere({ heroResources: 2, staging: [VANGUARD] }, EFFECTS, "neutral");
    expect(payerOk(neutral.state, idOf(neutral.state, "dh1"), 0, undefined, neutral.ctx)).toBe(true);
    const away = withSphere({ heroResources: 2 }, EFFECTS, "lore");
    expect(payerOk(away.state, idOf(away.state, "dh1"), 0, undefined, away.ctx)).toBe(true);
  });
});

describe("05059:A:1 no progress on Orc War Camp", () => {
  lineSpec("05059:A:1", "with an Orc enemy in the staging area no progress can be placed on Orc War Camp in the staging area", (effects) => {
    const t = table({ stage: REINFORCING, staging: [WAR_CAMP, ORC] }, effects);
    expect(progressRoom(t.state, idOf(t.state, WAR_CAMP), t.ctx.cards)).toBe(0);
  });

  it("05059:A:1 an enemy that is no Orc, no enemy at all, or Orc War Camp as the active location leaves room for its 2 progress", () => {
    const plain = table({ stage: REINFORCING, staging: [WAR_CAMP, "f3"] });
    expect(progressRoom(plain.state, idOf(plain.state, WAR_CAMP), plain.ctx.cards)).toBe(2);
    const alone = table({ stage: REINFORCING, staging: [WAR_CAMP] });
    expect(progressRoom(alone.state, idOf(alone.state, WAR_CAMP), alone.ctx.cards)).toBe(2);
    const active = table({ stage: REINFORCING, active: WAR_CAMP, staging: [ORC] });
    expect(progressRoom(active.state, idOf(active.state, WAR_CAMP), active.ctx.cards)).toBe(2);
  });

  it("05059:A:1 an Orc enemy engaged with a player counts too", () => {
    const t = table({ stage: REINFORCING, staging: [WAR_CAMP], engaged: [ORC] });
    expect(progressRoom(t.state, idOf(t.state, WAR_CAMP), t.ctx.cards)).toBe(0);
  });
});

describe("05061:A:2 The Power of Mordor", () => {
  const power = (effects: readonly Effect[], layout: Layout) => {
    const t = table({ stage: REINFORCING, ...layout }, effects);
    const top = revealFromTop(t.state, t.ctx, "05061", []);
    return { t, state: finish({ state: top.state, steps: [] }, t.ctx).state };
  };

  lineSpec("05061:A:2", "the cards in the staging area are shuffled into the encounter deck and as many cards are revealed one at a time (a Battleground location loses its damage)", (effects) => {
    const { t, state } = power(effects, { staging: [{ code: CITADEL, damage: 5 }, "f3"], deck: ["f0", "f0", "f0"] });
    expect(state.staging).toHaveLength(2);
    expect(state.encounterDeck).toHaveLength(3);
    expect(state.cards[idOf(t.state, CITADEL)]?.damage).toBe(0);
    expect(state.cards[idOf(state, "05061")]?.zone).toBe("encounterDiscard");
  });

  it("05061:A:2 with no card in the staging area none is shuffled and none is revealed", () => {
    const { state } = power(EFFECTS, { deck: ["f0", "f0", "f0"] });
    expect(state.staging).toHaveLength(0);
    expect(state.encounterDeck).toHaveLength(3);
  });
});

describe("05072:A:1 Setup", () => {
  it("05072:A:1 puts The Approach, The Citadel and The Banks in the staging area, one each, for one and two players", async () => {
    const { ctx } = await androsWorld();
    for (const seats of [1, 2] as const) {
      let state = startScenario(androsStart(seats, 3, "Normal"), ctx);
      for (let guard = 0; guard < 12 && state.window?.kind === "mulligan"; guard += 1) state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
      for (const code of THREE) expect(idsOf(state, code).filter((id) => state.cards[id]?.zone === "staging")).toHaveLength(1);
      expect(state.cards[state.questStage ?? ""]?.code).toBe(DEFENSE);
    }
  });
});

describe("05072:B:1, 05074:B:1, 05075:B:1 and 05076:B:1 Battle and Siege", () => {
  const keywords = (stage: string): { siege: boolean; battle: boolean; stat: string } => {
    const t = table({ stage, committed: ["dh1"] });
    return { siege: currentQuestHas(t.state, "siege", t.ctx.cards), battle: currentQuestHas(t.state, "battle", t.ctx.cards), stat: questStatOf(t.state, idOf(t.state, "dh1"), t.ctx.cards) };
  };

  it("05072:B:1 Siege on stage 1: characters quest with their Defense", () => {
    expect(keywords(DEFENSE)).toEqual({ siege: true, battle: false, stat: "defense" });
  });
  it("05074:B:1 Battle on stage 3: characters quest with their Attack", () => {
    expect(keywords(AT_APPROACH)).toEqual({ siege: false, battle: true, stat: "attack" });
  });
  it("05075:B:1 Siege on stage 4: characters quest with their Defense", () => {
    expect(keywords(AT_CITADEL)).toEqual({ siege: true, battle: false, stat: "defense" });
  });
  it("05076:B:1 Siege on stage 5 with fewer than 4 points: characters quest with their Defense", () => {
    expect(keywords(LAST_BATTLE)).toEqual({ siege: true, battle: false, stat: "defense" });
  });
  it("05073:B:1 stage 2 has neither keyword: characters quest with their Willpower", () => {
    expect(keywords(REINFORCING)).toEqual({ siege: false, battle: false, stat: "willpower" });
  });
});

describe("05072:B:2 the redirect and the advance", () => {
  const targets = (made: ReturnType<typeof table>): (string | undefined)[] => undefendedTargets(made.state, 0, made.ctx.cards).map((id) => codeOf(made.state, id));

  it("05072:B:2 the target is the lowest Threat Battleground location in play, staging or active, and it moves up as the lowest is removed", () => {
    expect(targets(table({ staging: THREE }))).toEqual([BANKS]);
    expect(targets(table({ active: BANKS, staging: [CITADEL, APPROACH] }))).toEqual([BANKS]);
    expect(targets(table({ staging: [CITADEL, APPROACH] }))).toEqual([APPROACH]);
  });

  it("05072:B:2 with two locations of the same Threat both are offered, so the defending player names one", () => {
    expect(targets(table({ staging: [BANKS, BANKS, CITADEL] }))).toEqual([BANKS, BANKS]);
  });

  it("05072:B:2 with no Battleground location in play, or on another stage, the heroes take the damage", () => {
    expect(targets(table({ staging: [WAR_CAMP] }))).toEqual(["dh1", "dh2"]);
    expect(targets(table({ staging: THREE, stage: AT_APPROACH }))).toEqual(["dh1", "dh2"]);
  });

  it("05072:B:2 the quest advances only when no Battleground location is left: not while one remains, and not from another stage", () => {
    const t = table({ staging: [BANKS, APPROACH] });
    expect(codeOf(hurt(t, BANKS, 3), hurt(t, BANKS, 3).questStage)).toBe(DEFENSE);
    const later = table({ staging: [], stage: AT_APPROACH });
    expect(codeOf(settle({ ...later.state, window: null }, later.ctx, []), later.state.questStage)).toBe(AT_APPROACH);
  });

  it("05072:B:2 each of the three locations removed by damage, in any order, leaves the quest at stage 2 and its Responses nowhere: the stage ends on 2 while no stage is removed", () => {
    for (const last of THREE) {
      const t = table({ staging: THREE });
      let state = t.state;
      for (const code of [...THREE.filter((one) => one !== last), last]) state = hurt(t, code, { [CITADEL]: 11, [APPROACH]: 7, [BANKS]: 3 }[code] ?? 0, state);
      expect(codeOf(state, state.questStage)).toBe(REINFORCING);
    }
  });

  it("05072:B:2 the stages the explored locations removed are skipped: with stages 2 to 4 removed the quest advances from stage 1 to stage 5", () => {
    const t = table({ staging: [BANKS] });
    let state = t.state;
    for (const code of [REINFORCING, AT_APPROACH, AT_CITADEL]) state = run(t, state, { verb: "RemoveStage", code });
    expect(codeOf(hurt(t, BANKS, 3, state), hurt(t, BANKS, 3, state).questStage)).toBe(LAST_BATTLE);
  });
});

describe("05074:B:2 a tie", () => {
  it("05074:B:2 a quest that ties the Threat is neither unsuccessful nor successful: nobody discards, and the tie raises no threat either", () => {
    const row: Row = { line: "05074:B:2", layout: { stage: AT_APPROACH, staging: [ARBALESTERS, ORC] }, act: quest("success"), expect: [threat(28)] };
    expect(rowProblems(SCENARIO, row, EFFECTS)).toEqual([]);
    const done = play(SCENARIO, row, EFFECTS, false);
    expect(done.run.state.cards[idOf(done.run.state, "dh2")]?.zone).toBe("heroes");
  });
});

describe("05076:B:3 and 05076:B:4 The Last Battle", () => {
  const last = (effects: readonly Effect[], victory: readonly string[]) => table({ stage: LAST_BATTLE, victory, committed: ["dh1"] }, effects);

  lineSpec("05076:B:3", "with 4 or more victory points in the display The Last Battle gains Battle and loses Siege: the characters quest with their Attack", (effects) => {
    for (const victory of [[BANKS, CITADEL], [BANKS, APPROACH, APPROACH], [LIEUTENANT, BANKS]]) {
      const t = last(effects, victory);
      expect(currentQuestHas(t.state, "battle", t.ctx.cards)).toBe(true);
      expect(currentQuestHas(t.state, "siege", t.ctx.cards)).toBe(false);
      expect(questStatOf(t.state, idOf(t.state, "dh1"), t.ctx.cards)).toBe("attack");
      expect(committedWillpower(t.state, t.ctx.cards)).toBe(2);
    }
  });

  it("05076:B:3 with 3 points it keeps Siege and quests with Defense, and the points are counted again at every change", () => {
    const few = last(EFFECTS, [APPROACH, BANKS]);
    expect(currentQuestHas(few.state, "siege", few.ctx.cards)).toBe(true);
    expect(currentQuestHas(few.state, "battle", few.ctx.cards)).toBe(false);
    const more = last(EFFECTS, [APPROACH, BANKS, CITADEL]);
    expect(currentQuestHas(more.state, "siege", more.ctx.cards)).toBe(false);
  });

  it("05076:B:4 defeating the last stage wins the game: no stage follows it", () => {
    const t = table({ stage: LAST_BATTLE });
    expect(advanceStage(t.state, t.ctx.cards, [], () => true).stageCleared).toBe(true);
  });
});
