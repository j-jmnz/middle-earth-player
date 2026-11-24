// Rules: hon.siege, rr.victory-display, rr.in-play-and-out-of-play, rr.discard-pile-and-victory-display, rr.destroy, rr.quest-advancement, faq.victory-display, faq.progress-without-advancing (data/rules/entries.json).
// The Passage Out (06044) and Drû-buri-Drû (06045), the lines a card-spec row cannot show: the Siege quest, the attack with Willpower, damage that becomes progress, an enemy that fills with its printed hit points, the win only with Drû-buri-Drû in the victory display, and his +1 Willpower and +1 Defense from there.
// Each test builds its moment with the scene kit; its title starts with the line id. The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points.
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { attackStrength } from "../../../rules/combat/combat.ts";
import { restricted } from "../../../rules/interpret/restrictions.ts";
import { committedWillpower } from "../../../rules/quest/quest.ts";
import { finish, idOf, send, start, statOf, type LayoutTable } from "../../../../test/harness/scene-kit.ts";
import { CODES, table } from "../../../../test/scenarios/the-druadan-forest/table.ts";

const { pursuit: STAGE_1, untimelyEnd: STAGE_2, passageOut: STAGE_3, druBuriDru: DRU, thief: THIEF, hunter: HUNTER, elite: ELITE } = CODES;

const buff = (state: ScenarioState, id: string, stat: "defense" | "willpower", amount: number): ScenarioState => ({ ...state, modifiers: [...state.modifiers, { instanceId: id, sourceId: id, stat, amount, until: "endOfPhase" }] });
const stat = (made: LayoutTable, code: string, which: "willpower" | "defense"): number => statOf(made.state, made.ctx.cards, code, which);

describe("06044:B:1 Siege", () => {
  it("06044:B:1 the committed characters count their Defense on this stage and their Willpower on the others", () => {
    const layout = { committed: ["dh1"] } as const;
    const siege = table({ ...layout, stage: STAGE_3 });
    const sieged = buff(siege.state, idOf(siege.state, "dh1"), "defense", 3);
    expect(committedWillpower(sieged, siege.ctx.cards)).toBe(5);
    const first = table({ ...layout, stage: STAGE_1 });
    expect(committedWillpower(buff(first.state, idOf(first.state, "dh1"), "defense", 3), first.ctx.cards)).toBe(2);
  });

  it("06044:B:1 the +1 Defense of Drû-buri-Drû in the victory display counts in the quest total", () => {
    const made = table({ committed: ["dh1"], stage: STAGE_3, victory: [DRU] });
    expect(committedWillpower(made.state, made.ctx.cards)).toBe(3);
  });
});

describe("06044:B:2 the attack, the progress and the enemy that fills", () => {
  const strike = (made: LayoutTable, enemy: string, attackers: readonly string[]): ScenarioState => {
    let run = send(start(made.state), { type: "DeclareAttackers", enemyId: idOf(made.state, enemy), attackerIds: attackers.map((code) => idOf(made.state, code)) }, made.ctx);
    run = finish(run, made.ctx);
    return run.state;
  };

  it("06044:B:2 characters attack with their Willpower, 2 here against the Defense of the Thief, and with their Attack on the other stages", () => {
    const made = table({ stage: STAGE_3, engaged: [THIEF] });
    expect(attackStrength(buff(made.state, idOf(made.state, "dh1"), "defense", 5), [idOf(made.state, "dh1")], idOf(made.state, THIEF), made.ctx.cards)).toBe(2);
    const other = table({ stage: STAGE_2, engaged: [THIEF] });
    expect(attackStrength(other.state, [idOf(other.state, "dh1")], idOf(other.state, THIEF), other.ctx.cards)).toBe(2);
  });

  it("06044:B:2 the damage of the attack is placed as progress tokens on the enemy and not as damage, the Defense still taken off", () => {
    const made = table({ stage: STAGE_3, phase: "PlayerAttacks", engaged: [{ code: HUNTER }] });
    const boosted = buff(made.state, idOf(made.state, "dh1"), "willpower", 1);
    const state = strike({ ...made, state: boosted }, HUNTER, ["dh1"]);
    // Willpower 3 against the Hunter's Defense 3 deals nothing; 4 deals 1.
    expect(state.cards[idOf(state, HUNTER)]).toMatchObject({ progress: 0, damage: 0 });
    const more = strike({ ...made, state: buff(made.state, idOf(made.state, "dh1"), "willpower", 2) }, HUNTER, ["dh1"]);
    expect(more.cards[idOf(more, HUNTER)]).toMatchObject({ progress: 1, damage: 0 });
  });

  it("06044:B:2 an enemy is full at its printed hit points: damage on it does not lower what it needs, and progress is never damage", () => {
    // The Hunter prints 3 hit points: 2 damage on it leaves 1 hit point, but it still needs 3 progress (the designer's answer, forum thread 221161).
    const short = table({ stage: STAGE_3, staging: [{ code: HUNTER, damage: 2, progress: 2 }] });
    const kept = settle(short.state, short.ctx, []);
    expect(kept.cards[idOf(short.state, HUNTER)]).toMatchObject({ zone: "staging", progress: 2, damage: 2 });
    const full = table({ stage: STAGE_3, staging: [{ code: HUNTER, damage: 2, progress: 3 }] });
    const gone = settle(full.state, full.ctx, []);
    expect(gone.cards[idOf(full.state, HUNTER)]?.zone).toBe("victory");
  });

  it("06044:B:2 the enemy goes to the victory display and all its progress goes on the quest, the surplus included, first the enemy and then the tokens", () => {
    const made = table({ stage: STAGE_3, progress: 1, engaged: [{ code: ELITE, progress: 6 }] });
    const settled = settle(made.state, made.ctx, []);
    expect(settled.cards[idOf(made.state, ELITE)]).toMatchObject({ zone: "victory", progress: 0 });
    expect(settled.cards[settled.questStage ?? ""]?.progress).toBe(7);
  });

  it("06044:B:2 damage from an effect stays damage, and on another stage the attack deals damage", () => {
    const made = table({ stage: STAGE_2, phase: "PlayerAttacks", engaged: [THIEF] });
    const state = strike(made, THIEF, ["dh1"]);
    expect(state.cards[idOf(state, THIEF)]).toMatchObject({ progress: 0, damage: 1 });
  });
});

describe("06044:B:3 and 06045:A:3 the win needs Drû-buri-Drû in the victory display", () => {
  // The quest holds 13 of 14 progress and a Hunter full of progress lies in the staging area: when it goes to the victory display its progress defeats the stage, if the stage may be defeated.
  const filled = (where: "victory" | "staging" | "discard"): { made: LayoutTable; settled: ScenarioState } => {
    const hunter = { code: HUNTER, progress: 3 };
    const made = table({ stage: STAGE_3, progress: 13, ...(where === "victory" ? { victory: [DRU], staging: [hunter] } : { staging: [hunter, DRU] }) });
    const state = where === "discard" ? { ...made.state, cards: { ...made.state.cards, [idOf(made.state, DRU)]: { ...made.state.cards[idOf(made.state, DRU)]!, zone: "encounterDiscard" as const } } } : made.state;
    return { made, settled: settle(state, made.ctx, []) };
  };

  it("06044:B:3 the players win when the stage is defeated with Drû-buri-Drû in the victory display", () => {
    const { settled } = filled("victory");
    expect(settled.cards[idOf(settled, HUNTER)]?.zone).toBe("victory");
    expect(settled.stageCleared).toBe(true);
  });

  it("06044:B:3 with 14 progress and Drû-buri-Drû still in play the game goes on", () => {
    const { made, settled } = filled("staging");
    expect(settled.cards[settled.questStage ?? ""]?.progress).toBe(16);
    expect(settled.stageCleared).toBeFalsy();
    expect(restricted(settled, made.ctx, "advance").length).toBeGreaterThan(0);
  });

  it("06044:B:3 and with him in the discard pile the game goes on: only the victory display wins", () => {
    const { made, settled } = filled("discard");
    expect(settled.cards[settled.questStage ?? ""]?.progress).toBe(16);
    expect(settled.stageCleared).toBeFalsy();
    expect(restricted(settled, made.ctx, "advance").length).toBeGreaterThan(0);
  });

  it("06045:A:3 the block is on stage 3 alone: stages 1 and 2 can be defeated while he is set aside", () => {
    for (const stage of [STAGE_1, STAGE_2]) {
      const made = table({ stage, progress: 30, setAside: [DRU] });
      expect(restricted(made.state, made.ctx, "advance")).toEqual([]);
    }
    const last = table({ stage: STAGE_3, progress: 30, setAside: [DRU] });
    expect(restricted(last.state, last.ctx, "advance").length).toBeGreaterThan(0);
  });
});

describe("06045:A:2 +1 Willpower and +1 Defense while in the victory display", () => {
  it("06045:A:2 every character of every player gets both while he is in the victory display, allies too, and none while he is in play or set aside", () => {
    for (const code of ["dh1", "dh3", "ally"]) {
      const shown = table({ seats: 2, stage: STAGE_3, victory: [DRU], play: ["ally"] });
      expect([stat(shown, code, "willpower"), stat(shown, code, "defense")]).toEqual(code === "ally" ? [2, 2] : [3, 3]);
      for (const where of [{ staging: [DRU] }, { setAside: [DRU] }, { engaged: [DRU] }] as const) {
        const away = table({ seats: 2, stage: STAGE_3, play: ["ally"], ...where });
        expect([stat(away, code, "willpower"), stat(away, code, "defense")]).toEqual(code === "ally" ? [1, 1] : [2, 2]);
      }
    }
  });
});
