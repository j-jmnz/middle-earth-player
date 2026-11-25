import { describe, expect, it } from "vitest";

import type { Condition } from "../../catalog/boundary.ts";
import { holds, traitHandlers } from "./conditions.ts";
import { cardHandlers } from "./condition-kinds/cards.ts";
import { combatHandlers } from "./condition-kinds/combat.ts";
import { eventHandlers } from "./condition-kinds/event.ts";
import { familyOnlyHandlers } from "./condition-kinds/family-only.ts";
import { playerHandlers } from "./condition-kinds/players.ts";
import { questHandlers } from "./condition-kinds/quest.ts";
import { scenarioHandlers } from "./condition-kinds/scenario.ts";
import { cardMap, hero, idleScenario } from "../core/test-fixture.ts";
import { definePrinted } from "../core/printed.ts";
import { updateCard } from "../core/state.ts";
import { spawn } from "../core/zones.ts";

const scope = { actor: 0, sourceId: null, returned: 0 };

describe("conditions", () => {
  const rider = definePrinted({ code: "rider", name: "Rider", type: "enemy", traits: ["Nazgûl"], engagementCost: 30 });
  const ring = definePrinted({ code: "ring", name: "Ring", type: "objective" });
  const ctx = { effects: [], cards: cardMap([hero("frodo", "fellowship"), rider, ring]) };

  it("reads a Hide failure by phase or by round, for the actor only", () => {
    const state = { ...idleScenario(2, "Quest"), round: 2, hideFailures: [{ seat: 0, round: 2, phase: "Quest" }] };
    const phase = { kind: "hideFailed", scope: "phase" } as const;
    const round = { kind: "hideFailed", scope: "round" } as const;
    expect(holds(state, phase, scope, ctx)).toBe(true);
    expect(holds({ ...state, phase: "Encounter" }, phase, scope, ctx)).toBe(false);
    expect(holds({ ...state, phase: "Encounter" }, round, scope, ctx)).toBe(true);
    expect(holds({ ...state, round: 3 }, round, scope, ctx)).toBe(false);
    expect(holds(state, round, { ...scope, actor: 1 }, ctx)).toBe(false);
  });

  it("reads engaged traits, exhaustion, returned enemies, and the phase that ended", () => {
    let state = idleScenario(1, "Refresh");
    state = spawn(state, "frodo", { zone: "heroes", seat: 0 }).state;
    const engaged = spawn(state, "rider", { zone: "engaged", seat: 0 });
    const theRing = spawn(engaged.state, "ring", { zone: "play", seat: 0 });
    state = theRing.state;
    expect(holds(state, { kind: "hasEngaged", trait: "Nazgûl" }, scope, ctx)).toBe(true);
    expect(holds(state, { kind: "hasEngaged", trait: "Orc" }, scope, ctx)).toBe(false);
    expect(holds(state, { kind: "exhausted", code: "ring", is: false }, scope, ctx)).toBe(true);
    expect(holds(updateCard(state, theRing.id, { exhausted: true }), { kind: "exhausted", code: "ring", is: true }, scope, ctx)).toBe(true);
    expect(holds(state, { kind: "exhausted", code: "missing", is: false }, scope, ctx)).toBe(false);
    expect(holds(state, { kind: "noneReturned" }, scope, ctx)).toBe(true);
    expect(holds(state, { kind: "noneReturned" }, { ...scope, returned: 1 }, ctx)).toBe(false);
    expect(holds(state, { kind: "phase", is: "Refresh" }, scope, ctx)).toBe(true);
    expect(holds(state, { kind: "phase", is: "Refresh" }, { ...scope, phase: "Combat" }, ctx)).toBe(false);
  });

  it("finds a card in the deck or the discard pile by trait or code", () => {
    let state = idleScenario(1);
    state = spawn(state, "rider", { zone: "encounterDiscard" }).state;
    expect(holds(state, { kind: "searchable", trait: "Nazgûl" }, scope, ctx)).toBe(true);
    expect(holds(state, { kind: "searchable", code: "rider" }, scope, ctx)).toBe(true);
    expect(holds(state, { kind: "searchable", trait: "Orc" }, scope, ctx)).toBe(false);
  });

  it("knows whether the source is engaged with the actor", () => {
    let state = idleScenario(2);
    const engaged = spawn(state, "rider", { zone: "engaged", seat: 1 });
    state = engaged.state;
    expect(holds(state, { kind: "engagedWithActor" }, { ...scope, sourceId: engaged.id, actor: 1 }, ctx)).toBe(true);
    expect(holds(state, { kind: "engagedWithActor" }, { ...scope, sourceId: engaged.id }, ctx)).toBe(false);
  });

  it("reads whether the attack in progress has a defender", () => {
    const state = idleScenario(1);
    const attack = { enemyId: "e1", seat: 0 };
    expect(holds(state, { kind: "undefended" }, scope, ctx)).toBe(false);
    expect(holds({ ...state, pendingAttack: attack }, { kind: "undefended" }, scope, ctx)).toBe(true);
    expect(holds({ ...state, pendingAttack: { ...attack, defenderId: "h1" } }, { kind: "undefended" }, scope, ctx)).toBe(false);
    expect(holds({ ...state, pendingAttack: { ...attack, defenderId: "h1", undefended: true } }, { kind: "undefended" }, scope, ctx)).toBe(true);
  });
});

describe("condition handler tables", () => {
  it("holds no kind in two tables (the later spread in HANDLERS would win silently)", () => {
    const tables = { "family-only.ts": familyOnlyHandlers, "cards.ts": cardHandlers, "combat.ts": combatHandlers, "event.ts": eventHandlers, "players.ts": playerHandlers, "quest.ts": questHandlers, "scenario.ts": scenarioHandlers, "conditions.ts (traits)": traitHandlers };
    const owner = new Map<string, string>();
    const repeated: string[] = [];
    for (const [file, table] of Object.entries(tables)) {
      for (const kind of Object.keys(table)) {
        const first = owner.get(kind);
        if (first !== undefined) repeated.push(`${kind}: ${first} and ${file}`);
        else owner.set(kind, file);
      }
    }
    expect(repeated).toEqual([]);
  });

  it("answers undefined, read as false, for a kind no handler lists", () => {
    const unknown = { kind: "noSuchKind" } as unknown as Condition;
    expect(holds(idleScenario(1, "Quest"), unknown, scope, { effects: [], cards: cardMap([]) })).toBeUndefined();
  });
});
