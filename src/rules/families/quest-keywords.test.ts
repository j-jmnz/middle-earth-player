// Rules: hon.battle, hon.siege, rr.step-3-4 (data/rules/entries.json).
// Battle and Siege on the current quest: committed characters count their Attack / Defense instead of their Willpower when the quest
// resolves, whether the quest card prints the keyword or gains it from an effect (06036:A:2).
import { describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { RECORDS } from "../../effects/authored/families/quest.ts";

import { pushCardEffects } from "../effect-frames.ts";
import { cardMap, idleScenario } from "../fixture.ts";
import { settle } from "../machine.ts";
import { definePrinted } from "../printed.ts";
import { committedWillpower, questStatOf } from "../quest.ts";
import { updateCard, withThreat, type ScenarioState } from "../state.ts";
import { spawn } from "../zones.ts";

const plain = definePrinted({ code: "plain", name: "Plain", type: "quest", questPoints: 20 });
const battleQuest = definePrinted({ code: "battleQuest", name: "Battle Quest", type: "quest", questPoints: 20, keywords: { battle: true } });
const siegeQuest = definePrinted({ code: "siegeQuest", name: "Siege Quest", type: "quest", questPoints: 20, keywords: { siege: true } });
const knight = definePrinted({ code: "knight", name: "Knight", type: "hero", sphere: "tactics", threat: 8, willpower: 1, attack: 3, defense: 4, health: 5 });
const squire = definePrinted({ code: "squire", name: "Squire", type: "ally", sphere: "tactics", cost: 1, willpower: 2, attack: 5, defense: 1, health: 1 });
const trained = definePrinted({ code: "06036", name: "Trained for War", type: "event", sphere: "tactics", cost: 0 });
const fen = definePrinted({ code: "fen", name: "Fen", type: "location", threat: 4, questPoints: 3 });
const cards = cardMap([fen, plain, battleQuest, siegeQuest, knight, squire, trained]);
const trainedRecord = RECORDS.find((record) => record.id === "06036:action:1") as Effect;

// A one-seat table on the given quest stage with the knight (Willpower 1, Attack 3, Defense 4) and the squire (2 / 5 / 1) committed.
function table(stageCode: string): { state: ScenarioState; stage: string; knight: string; squire: string } {
  const base = idleScenario(1, "Quest");
  const placed = spawn({ ...base, stages: [{ code: stageCode }] }, stageCode, { zone: "questStage" });
  const hero = spawn(updateCard(placed.state, placed.id, { face: "B" }), "knight", { zone: "heroes", seat: 0 });
  const ally = spawn(hero.state, "squire", { zone: "play", seat: 0 });
  const committed = updateCard(updateCard(withThreat(ally.state, 0, 20), hero.id, { committed: true }), ally.id, { committed: true });
  return { state: committed, stage: placed.id, knight: hero.id, squire: ally.id };
}

describe("a quest with Battle or Siege (hon.battle, hon.siege)", () => {
  it("counts Willpower on a quest without either keyword", () => {
    const { state } = table("plain");
    expect(committedWillpower(state, cards)).toBe(3);
  });

  it("counts Attack instead of Willpower on a quest that prints Battle (hon.battle)", () => {
    const { state, knight: k } = table("battleQuest");
    expect(questStatOf(state, k, cards)).toBe("attack");
    expect(committedWillpower(state, cards)).toBe(8);
  });

  it("counts Defense instead of Willpower on a quest that prints Siege (hon.siege)", () => {
    const { state } = table("siegeQuest");
    expect(committedWillpower(state, cards)).toBe(5);
  });

  it("counts a character's own Attack and Defense after modifiers, and Willpower again once the keyword is gone", () => {
    const { state, stage, knight: k } = table("battleQuest");
    const buffed = { ...state, modifiers: [...state.modifiers, { instanceId: k, sourceId: k, stat: "attack" as const, amount: 2, until: "endOfPhase" as const }] };
    expect(committedWillpower(buffed, cards)).toBe(10);
    expect(committedWillpower(table("plain").state, cards)).toBe(3);
    expect(stage).toBeTruthy();
  });

  it("counts the quest's keyword for a character that quests with Attack anyway (11005:A:2)", () => {
    const { state, squire: s } = table("siegeQuest");
    const hooked = { ...state, modifiers: [...state.modifiers, { instanceId: s, sourceId: s, stat: "questsWithAttack" as const, amount: 1, until: "endOfPhase" as const }] };
    // The knight's Defense 4 plus the squire's Attack 5.
    expect(committedWillpower(hooked, cards)).toBe(9);
  });

  it("counts Willpower when the quest has both, since the two replacements contradict each other", () => {
    const { state, stage } = table("siegeQuest");
    const both = { ...state, modifiers: [...state.modifiers, { instanceId: stage, sourceId: stage, stat: "battle" as const, amount: 1, until: "endOfPhase" as const }] };
    expect(committedWillpower(both, cards)).toBe(3);
  });

  it("changes the quest result: Attack beats the staging threat that Willpower does not (rr.step-3-4)", () => {
    for (const [code, threat, progress] of [["plain", 24, 0], ["battleQuest", 20, 4]] as const) {
      const { state, stage } = table(code);
      const staged = spawn(state, "fen", { zone: "staging" });
      const resolved = settle({ ...staged.state, mode: "resolution" }, { effects: [], cards }, []);
      expect(resolved.seats[0]?.threat).toBe(code === "plain" ? 21 : threat);
      expect(resolved.cards[stage]?.progress).toBe(progress);
    }
  });
});

describe("Trained for War gives the current quest Battle until the end of the phase (06036:A:2)", () => {
  function play(state: ScenarioState): ScenarioState {
    const event = spawn(state, "06036", { zone: "hand", seat: 0 });
    return settle(pushCardEffects(event.state, "ResolveEffect", event.id, 0, false, [trainedRecord], { effects: [trainedRecord], cards }, []), { effects: [trainedRecord], cards }, []);
  }

  it("makes the committed characters count Attack, then lets it go at the end of the phase", () => {
    const { state, stage } = table("plain");
    expect(committedWillpower(state, cards)).toBe(3);
    const after = play(state);
    expect(after.modifiers.some((modifier) => modifier.instanceId === stage && modifier.stat === "battle")).toBe(true);
    expect(committedWillpower(after, cards)).toBe(8);
  });

  it("does nothing to a quest that has Siege, which keeps counting Defense", () => {
    const { state } = table("siegeQuest");
    const after = play(state);
    expect(committedWillpower(after, cards)).toBe(5);
  });

  it("leaves a quest that already has Battle with Battle", () => {
    const { state } = table("battleQuest");
    expect(committedWillpower(play(state), cards)).toBe(8);
  });
});
