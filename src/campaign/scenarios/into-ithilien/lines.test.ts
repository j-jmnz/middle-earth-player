// Rules: ats.ally-objectives, rr.current-quest, rr.step-3-4, rr.removed-from-game, rr.engagement-check, rr.step-5-2, rr.quest-advancement, rr.search, hon.battle, hon.siege, hon.archery, faq.lasting-effects (data/rules/entries.json).
// The lines of Into Ithilien that a card-spec row cannot show (spec.test.ts holds the rest): 05025:A:1, 05025:A:2, 05025:A:3, 05026:A:1, 05028:A:1, 05049:A:1, 05052:A:1, 05052:A:2, 05068:A:1, 05068:B:1, 05068:B:2, 05069:B:1, 05069:B:2, 05069:B:3, 05069:B:4, 05070:B:1, 05071:B:1, 05071:B:3.
// Each test builds its moment with the scene kit (the Setup test starts the game and plays nothing else). The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points. Celador has 2 Willpower, 2 Attack, 2 Defense and a Guardian 2, 2, 1.
import { describe, expect, it } from "vitest";

import { archeryRecipients, archeryTotal } from "../../../rules/combat/combat.ts";
import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { legalIntents, reduce, startScenario, type PlayerIntent } from "../../../rules/engine/reduce.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { runInstruction } from "../../../rules/interpret/interpret.ts";
import { EFFECTS } from "../../../effects/index.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { advanceStage, committedWillpower, engagementCostOf, engagementStep, qualifyingEnemies, questStatOf } from "../../../rules/quest/quest.ts";
import { endPhase, endRound, reveal } from "../../../../test/harness/card-spec.ts";
import { play } from "../../../../test/harness/card-spec-play.ts";
import { finish, idOf, revealFromTop, send, start, type LayoutTable } from "../../../../test/harness/scene-kit.ts";
import { ithilienStart, ithilienWorld } from "../../../../test/scenarios/into-ithilien/game.ts";
import { CODES, leaves, questPhase, table } from "../../../../test/scenarios/into-ithilien/table.ts";

const BAT = "05050";
const { celador: CELADOR, guardian: GUARDIAN, company: COMPANY, road: ROAD, spider: SPIDER, mercenaries: MERCENARIES, battle: BATTLE, siege: SIEGE, hiddenWay: HIDDEN_WAY, approaching: APPROACHING } = CODES;

const nextStage = (made: ReturnType<typeof table>): string | undefined => {
  const advanced = advanceStage(made.state, made.ctx.cards, [], () => false);
  return advanced.questStage ? advanced.cards[advanced.questStage]?.code : undefined;
};

describe("05025:A:1 and 05026:A:1 committed in the staging area", () => {
  it("05025:A:1 Celador counts his Willpower, his Attack under Battle and his Defense under Siege in the quest total", () => {
    const layout = { staging: [CELADOR], committed: ["dh1"] } as const;
    expect(committedWillpower(table({ ...layout, stage: APPROACHING }).state, table({ ...layout, stage: APPROACHING }).ctx.cards)).toBe(2 + 2);
    const battle = table({ ...layout, stage: BATTLE });
    expect(questStatOf(battle.state, idOf(battle.state, CELADOR), battle.ctx.cards)).toBe("attack");
    expect(committedWillpower(battle.state, battle.ctx.cards)).toBe(2 + 2);
    const siege = table({ ...layout, stage: SIEGE });
    expect(committedWillpower(siege.state, siege.ctx.cards)).toBe(2 + 2);
  });

  it("05026:A:1 a Guardian is committed in the staging area as Celador is: Defense 1 under Siege, 2 Attack under Battle", () => {
    const siege = table({ staging: [GUARDIAN], stage: SIEGE });
    expect(committedWillpower(siege.state, siege.ctx.cards)).toBe(1);
    const battle = table({ staging: [GUARDIAN], stage: BATTLE });
    expect(committedWillpower(battle.state, battle.ctx.cards)).toBe(2);
  });

  it("05025:A:1 in a played Quest phase Celador quests with the hero who commits: 2 + 2 under the stage without a keyword", () => {
    const run = questPhase(table({ staging: [CELADOR, "f0"], stage: HIDDEN_WAY }));
    expect(run.steps.find((step) => step.kind === "quest")).toMatchObject({ willpower: 4, threat: 0 });
  });

  it("05025:A:1 once a player takes control of him he is committed no more, and the quest total drops", () => {
    const made = table({ staging: [CELADOR], stage: BATTLE });
    const state = runInstruction({ ...made.state, window: null }, { verb: "TakeControlOfStagedObjectives", trait: "Ranger" }, { seat: 0, sourceId: null }, made.ctx, []);
    expect(committedWillpower(syncConstants(state, made.ctx), made.ctx.cards)).toBe(0);
  });
});

describe("05025:A:2 Forced: damage to Celador", () => {
  const hurt = (made: ReturnType<typeof table>, state = made.state): number => state.cards[idOf(state, CELADOR)]?.damage ?? 0;

  it("05025:A:2 a Guardian under a player's control (after 05070:B:1) that leaves play deals exactly 1 damage to Celador, not 2", () => {
    const made = table({ staging: [CELADOR], play: [GUARDIAN], stage: HIDDEN_WAY });
    expect(hurt(made, leaves(made, GUARDIAN))).toBe(1);
  });

  it("05025:A:2 a Guardian in the staging area that leaves play deals exactly 1 damage", () => {
    const made = table({ staging: [CELADOR, GUARDIAN], stage: BATTLE });
    expect(hurt(made, leaves(made, GUARDIAN))).toBe(1);
  });

  it("05025:A:2 a hero, and an ally of any player, that leaves play deals 1 damage each; an enemy that leaves play deals none", () => {
    const heroes = table({ staging: [CELADOR], stage: BATTLE });
    expect(hurt(heroes, leaves(heroes, "dh2"))).toBe(1);
    const ally = table({ seats: 2, staging: [CELADOR], play: [{ code: "ally", seat: 1 }], stage: BATTLE });
    expect(hurt(ally, leaves(ally, "ally"))).toBe(1);
    const enemy = table({ staging: [CELADOR, "f3"], stage: BATTLE });
    expect(hurt(enemy, leaves(enemy, "f3"))).toBe(0);
  });

  it.each([
    [1, ["f3", MERCENARIES], 4, 5],
    [2, ["f3", "f3", BAT], 6, 7],
  ] as const)("05025:A:2 after the players quest unsuccessfully with %i seat(s) Celador takes 1 damage, once", (seats, staged, willpower, threat) => {
    const made = table({ seats, staging: [CELADOR, ...staged], stage: HIDDEN_WAY });
    const run = questPhase(made);
    expect(run.steps.find((step) => step.kind === "quest")).toMatchObject({ willpower, threat });
    expect(hurt(made, run.state)).toBe(1);
  });

  it("05025:A:2 a quest that ties its Threat is neither unsuccessful nor successful: no damage", () => {
    const made = table({ staging: [CELADOR, "f3", BAT], stage: HIDDEN_WAY });
    const run = questPhase(made);
    expect(run.steps.find((step) => step.kind === "quest")).toMatchObject({ willpower: 4, threat: 4 });
    expect(hurt(made, run.state)).toBe(0);
  });
});

describe("05025:A:3 removed from the game", () => {
  it("05025:A:3 Celador destroyed by damage in the staging area is removed from the game, not discarded", () => {
    const made = table({ staging: [{ code: CELADOR, damage: 2 }], stage: BATTLE });
    const state = leaves(made, CELADOR);
    expect(state.cards[idOf(state, CELADOR)]?.zone).toBe("removed");
    expect(state.removed).toContain(idOf(state, CELADOR));
  });
});

describe("05028:A:1 engagement cost 0", () => {
  it("05028:A:1 the engagement cost of an enemy in the staging area is 0, never negative, and it qualifies every player at the check", () => {
    const made = table({ seats: 2, active: ROAD, staging: [COMPANY], stage: BATTLE, threat: [0, 0] });
    const company = made.state.cards[idOf(made.state, COMPANY)]!;
    expect(engagementCostOf(made.state, company, made.ctx.cards)).toBe(0);
    for (const seat of [0, 1]) expect(qualifyingEnemies(made.state, seat, made.ctx.cards)).toContain(company.id);
    const engaged = engagementStep(made.state, made.ctx.cards, []);
    expect(engaged.cards[company.id]?.zone).toBe("engaged");
  });

  it("05028:A:1 with another location active the Company keeps its printed engagement cost 34", () => {
    const made = table({ staging: [COMPANY, ROAD], stage: BATTLE });
    expect(engagementCostOf(made.state, made.state.cards[idOf(made.state, COMPANY)]!, made.ctx.cards)).toBe(34);
  });
});

describe("05049:A:1 Morgul Spider", () => {
  const spiderAttack = (state: ScenarioState, made: LayoutTable): number => modifiedStat(state, state.cards[idOf(state, SPIDER)]!, "attack", made.ctx.cards);
  const layout = { stage: HIDDEN_WAY, staging: [CELADOR], play: ["ally"], committed: ["dh1"], deck: ["f0", "f0"] } as const;
  const revealed = (): { made: LayoutTable; state: ScenarioState } => {
    const made = table(layout);
    const steps: EngineStep[] = [];
    const top = revealFromTop(made.state, made.ctx, SPIDER, steps);
    return { made, state: finish({ state: top.state, steps }, made.ctx).state };
  };

  it("05049:A:1 counts the characters not committed again as the game changes: a hero who commits or leaves the quest changes the Attack at once", () => {
    const { made, state } = revealed();
    // Uncommitted: dh2 and the ally. Celador in the staging area is committed by his own text, so he is not counted.
    expect(spiderAttack(state, made)).toBe(4 + 2);
    const committedToo = syncConstants(updateCard(state, idOf(state, "dh2"), { committed: true }), made.ctx);
    expect(spiderAttack(committedToo, made)).toBe(4 + 1);
    const nobody = syncConstants(updateCard(state, idOf(state, "dh1"), { committed: false }), made.ctx);
    expect(spiderAttack(nobody, made)).toBe(4 + 3);
  });

  it("05049:A:1 after the quest phase no character is committed, so in combat the Spider has +1 for every character in play (heroes and ally; Celador in the staging area still counts as committed)", () => {
    const { made, state } = revealed();
    const afterQuest = syncConstants(updateCard(state, idOf(state, "dh1"), { committed: false }), made.ctx);
    expect(spiderAttack(afterQuest, made)).toBe(4 + 3);
  });

  it("05049:A:1 the bonus ends at the end of the round: the next round the Spider has its printed Attack again", () => {
    const made = table(layout);
    const rows = { line: "05049:A:1", layout, act: [reveal(SPIDER), endPhase] } as const;
    const during = play("into-ithilien", { ...rows, expect: [] }, EFFECTS, false);
    // The Quest phase is over: nobody is committed, so every character counts (two heroes and the ally).
    expect(spiderAttack(during.run.state, during.table)).toBe(4 + 3);
    const after = play("into-ithilien", { ...rows, act: [...rows.act, endRound], expect: [] }, EFFECTS, false);
    expect(after.run.state.round).toBeGreaterThan(during.run.state.round);
    expect(spiderAttack(after.run.state, made)).toBe(4);
  });
});

describe("05052:A:1 and 05052:A:2 Archery X, 05069:B:2 and 05069:B:3 on the quest card", () => {
  it("05052:A:1 Southron Mercenaries has Archery X, X the number of players: 1 with one seat, 2 with two", () => {
    expect(archeryTotal(table({ staging: [MERCENARIES], stage: HIDDEN_WAY }).state, table({}).ctx.cards)).toBe(1);
    const two = table({ seats: 2, staging: [MERCENARIES], stage: HIDDEN_WAY });
    expect(archeryTotal(two.state, two.ctx.cards)).toBe(2);
  });

  it("05052:A:2 X counts the players in the game now: a second Mercenaries adds its own X, and a player who is gone is not counted", () => {
    const two = table({ seats: 2, staging: [MERCENARIES, MERCENARIES], stage: HIDDEN_WAY });
    expect(archeryTotal(two.state, two.ctx.cards)).toBe(4);
    const gone = { ...two.state, seats: two.state.seats.map((seat, index) => (index === 1 ? { ...seat, eliminated: true } : seat)) };
    expect(archeryTotal(gone, two.ctx.cards)).toBe(2);
  });

  it("05069:B:2 the quest card Southron Counter-attack has Archery X, X the number of players (the card is in play as the current stage)", () => {
    const one = table({ stage: SIEGE });
    expect(archeryTotal(one.state, one.ctx.cards)).toBe(1);
    const two = table({ seats: 2, stage: SIEGE });
    expect(archeryTotal(two.state, two.ctx.cards)).toBe(2);
  });

  it("05069:B:3 X is the number of players: the quest card and a Mercenaries together make 3 with two seats, and a stage that is not the current one gives none", () => {
    const both = table({ seats: 2, stage: SIEGE, staging: [MERCENARIES] });
    expect(archeryTotal(both.state, both.ctx.cards)).toBe(4);
    const other = table({ seats: 2, stage: BATTLE });
    expect(archeryTotal(other.state, other.ctx.cards)).toBe(0);
  });

  it("05052:A:1 the archery damage may be assigned to Celador in the staging area, and is placed on him when the combat phase begins", () => {
    const made = table({ staging: [MERCENARIES, CELADOR], stage: HIDDEN_WAY, phase: "Encounter" });
    expect(archeryRecipients(made.state, made.ctx.cards).map((id) => made.state.cards[id]?.code)).toContain(CELADOR);
    let run = start(made.state);
    for (let guard = 0; guard < 30 && run.state.window?.kind !== "archery"; guard += 1) {
      const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineEngage");
      if (!pass) break;
      run = send(run, pass as PlayerIntent, made.ctx);
    }
    expect(run.state.window).toMatchObject({ kind: "archery", total: 1 });
    run = send(run, { type: "Distribute", assignments: [{ cardId: idOf(run.state, CELADOR), amount: 1 }] }, made.ctx);
    expect(run.state.cards[idOf(run.state, CELADOR)]?.damage).toBe(1);
  });
});
