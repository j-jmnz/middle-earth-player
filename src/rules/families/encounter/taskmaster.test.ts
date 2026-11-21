import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";

import { cardMap, expectOk, fixtureDefinition, hero } from "../../core/test-fixture.ts";
import { placeDamage } from "../../core/keywords.ts";
import { definePrinted } from "../../core/printed.ts";
import { reduce } from "../../engine/reduce.ts";
import { blankScenario, updateCard, type ScenarioState } from "../../core/state.ts";
import { ruleCause } from "../../core/cause.ts";
import { spawn } from "../../core/zones.ts";
import { markEnemyDamage } from "./patrol.ts";

// Rules: rr.cancel, rr.damage, rr.forced (data/rules/entries.json); ledger line 901104:A:2. "Forced: When a Goblin enemy with at least 1 resource on it is dealt any amount of damage, remove 1 resource from that enemy and cancel all damage just dealt to it."
// A Forced effect that hears damage dealt to enemies in general (markEnemyDamage marks every dealt enemy) is offered the damage before the enemy it would destroy is destroyed.

const lead = hero("lead", "leadership", 9, 2);
const stats = { attack: 3, defense: 1, health: 4, engagementCost: 30, threat: 2 };
const master = definePrinted({ code: "master", name: "Master", type: "enemy", traits: ["Mordor", "Orc"], ...stats });
const goblin = definePrinted({ code: "goblin", name: "Goblin", type: "enemy", traits: ["Goblin", "Orc"], ...stats });
const troll = definePrinted({ code: "troll", name: "Troll", type: "enemy", traits: ["Troll"], ...stats });
const cards = cardMap([lead, master, goblin, troll]);

// 901104:forced:1 as the records write it.
const FORCED: Effect = {
  id: "master:forced:1",
  cardCode: "master",
  lines: ["master:A:2"],
  timing: "forced",
  trigger: "damageDealt",
  subject: { type: "enemy", control: "any", trait: "Goblin", hasResources: true },
  instructions: [{ verb: "RemoveResourceTokens", on: "subject", amount: 1 }, { verb: "CancelDamage", all: true }],
};

function scene(masters = 1) {
  let state = blankScenario({ seatCount: 1, seed: 3, definition: fixtureDefinition(["stage"]) });
  const ids: Record<string, string> = {};
  const put = (key: string, code: string, dest: Parameters<typeof spawn>[2]) => {
    const placed = spawn(state, code, dest);
    state = placed.state;
    ids[key] = placed.id;
  };
  put("lead", "lead", { zone: "heroes", seat: 0 });
  for (let index = 0; index < masters; index += 1) put(`master${index}`, "master", { zone: "staging" });
  put("charged", "goblin", { zone: "engaged", seat: 0 });
  put("bare", "goblin", { zone: "engaged", seat: 0 });
  put("brute", "troll", { zone: "engaged", seat: 0 });
  state = updateCard(updateCard(updateCard(state, ids.charged!, { resources: 2 }), ids.brute!, { resources: 2 }), ids.master0!, { resources: 1 });
  state = { ...state, phase: "Combat", mode: "planning", window: { kind: "pass" }, activeSeat: 0, firstPlayer: 0 };
  const ctx = { effects: Array.from({ length: masters }, (_, index) => ({ ...FORCED, id: `master:forced:${index + 1}` })), cards };
  return { state: markEnemyDamage(state, ctx), ids, ctx };
}

function hit(state: ScenarioState, id: string, amount: number, ctx: ReturnType<typeof scene>["ctx"]): ScenarioState {
  const damaged = placeDamage({ ...state, holdLethal: true }, id, amount, ctx.cards, [], "framework", ruleCause("rr.damage"));
  return expectOk(reduce(damaged, { type: "Pass" }, ctx)).state;
}

describe("901104:A:2 damage dealt to a Goblin with resources", () => {
  it("901104:A:2 marks every dealt enemy when a dealt card hears damage dealt to enemies", () => {
    expect(scene().state.enemyDamageHeard?.toSorted()).toEqual(["goblin", "master", "troll"]);
  });

  it("901104:A:2 removes 1 resource and cancels all the damage, so the Goblin the damage would destroy lives", () => {
    const { state, ids, ctx } = scene();
    const after = hit(state, ids.charged!, 4, ctx);
    expect(after.cards[ids.charged!]?.damage).toBe(0);
    expect(after.cards[ids.charged!]?.resources).toBe(1);
    expect(after.cards[ids.charged!]?.zone).toBe("engaged");
  });

  it("901104:A:2 is not heard for a Goblin with no resource, nor for an enemy that is not a Goblin, nor for the Taskmaster itself", () => {
    const { state, ids, ctx } = scene();
    expect(hit(state, ids.bare!, 4, ctx).cards[ids.bare!]?.zone).toBe("encounterDiscard");
    const brute = hit(state, ids.brute!, 4, ctx);
    expect(brute.cards[ids.brute!]?.zone).toBe("encounterDiscard");
    expect(hit(state, ids.master0!, 4, ctx).cards[ids.master0!]?.zone).toBe("encounterDiscard");
  });

  it("901104:A:2 is heard by each Taskmaster: two of them each remove a resource", () => {
    const { state, ids, ctx } = scene(2);
    const after = hit(state, ids.charged!, 4, ctx);
    expect(after.cards[ids.charged!]?.resources).toBe(0);
    expect(after.cards[ids.charged!]?.damage).toBe(0);
  });
});
