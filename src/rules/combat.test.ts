import { describe, expect, it } from "vitest";

import type { Effect } from "../catalog/boundary.ts";

import { cardMap, expectOk, fixtureDefinition, hero } from "./fixture.ts";
import { definePrinted } from "./printed.ts";
import { legalIntents, legalTargets, reduce } from "./reduce.ts";
import { blankScenario, updateCard, withThreat, type ScenarioState } from "./state.ts";
import { moveCard, spawn } from "./zones.ts";

function enemy(code: string, patch: Parameters<typeof definePrinted>[0] = { code, name: code, type: "enemy" }) {
  return definePrinted({
    attack: 0,
    defense: 0,
    health: 10,
    engagementCost: 20,
    threat: 1,
    ...patch,
    code,
    name: code,
    type: "enemy",
  });
}

function engageWindow(input: {
  seatCount: 1 | 2;
  enemies: readonly { code: string; seat: number }[];
  shadows: readonly string[];
  heroes?: readonly { code: string; seat: number }[];
}): { state: ScenarioState; ids: Record<string, string>; cards: ReturnType<typeof cardMap> } {
  const heroCards = (input.heroes ?? [{ code: "aragorn", seat: 0 }, { code: "gimli", seat: 1 }]).map((row) =>
    hero(row.code, "leadership", 10, 1),
  );
  const enemyCards = input.enemies.map((row) => enemy(row.code));
  const shadowCards = input.shadows.map((code) => definePrinted({ code, name: code, type: "treachery" }));
  const cards = cardMap([...heroCards, ...enemyCards, ...shadowCards]);
  let state = blankScenario({ seatCount: input.seatCount, seed: 6, definition: fixtureDefinition(["stage"]) });
  const ids: Record<string, string> = {};
  for (const row of input.heroes ?? [{ code: "aragorn", seat: 0 }, { code: "gimli", seat: 1 }]) {
    if (row.seat >= input.seatCount) continue;
    const spawned = spawn(state, row.code, { zone: "heroes", seat: row.seat });
    state = spawned.state;
    ids[row.code] = spawned.id;
  }
  for (const row of input.enemies) {
    const spawned = spawn(state, row.code, { zone: "engaged", seat: row.seat });
    state = spawned.state;
    ids[row.code] = spawned.id;
  }
  for (const code of input.shadows) {
    const spawned = spawn(state, code, { zone: "encounterDeck" });
    state = spawned.state;
    ids[code] = spawned.id;
  }
  state = withThreat(state, 0, 20);
  if (input.seatCount === 2) state = withThreat(state, 1, 20);
  state = {
    ...state,
    phase: "Encounter",
    mode: "optionalEngage",
    window: { kind: "optionalEngage" },
    activeSeat: 0,
    passed: [],
  };
  return { state, ids, cards };
}

describe("combat", () => {
  it("resolves a nested shadow frame before damage is placed", () => {
    const effect: Effect = {
      cardCode: "shade",
      timing: "shadow",
      instructions: [{ verb: "ResolveEffect" }],
    };
    const { state, ids } = engageWindow({
      seatCount: 1,
      enemies: [{ code: "orc", seat: 0 }],
      shadows: ["shade"],
      heroes: [{ code: "aragorn", seat: 0 }],
    });
    const orc = enemy("orc", { code: "orc", name: "Orc", type: "enemy", attack: 2, health: 8 });
    const ctx = { effects: [effect], cards: cardMap([orc, hero("aragorn", "leadership", 10, 1), definePrinted({ code: "shade", name: "Shade", type: "treachery" })]) };
    const opened = expectOk(reduce(state, { type: "DeclineEngage" }, ctx));
    const frames = opened.steps.filter((step) => step.kind === "push" || step.kind === "pop");
    expect(frames.map((step) => `${step.kind}:${step.kind === "push" || step.kind === "pop" ? step.frame : ""}`)).toEqual([
      "push:shadow",
      "push:ResolveEffect",
      "pop:ResolveEffect",
      "pop:shadow",
    ]);
    expect(opened.steps.some((step) => step.kind === "damage")).toBe(false);
    expect(opened.state.stack).toEqual([]);
    const hit = expectOk(reduce(opened.state, { type: "Undefended" }, ctx));
    expect(hit.steps.some((step) => step.kind === "push")).toBe(false);
    expect(hit.state.cards[ids.aragorn ?? ""]?.damage).toBe(2);
    expect(hit.steps.some((step) => step.kind === "damage")).toBe(true);
  });

  it("runs a shadow effect and not When Revealed, then pops before attack damage", () => {
    const effects: Effect[] = [
      { cardCode: "shade", timing: "whenRevealed", instructions: [{ verb: "DealDamage" }] },
      { cardCode: "shade", timing: "shadow", instructions: [{ verb: "DealDamage" }] },
    ];
    const { state, ids } = engageWindow({
      seatCount: 1,
      enemies: [{ code: "orc", seat: 0 }],
      shadows: ["shade"],
      heroes: [{ code: "aragorn", seat: 0 }],
    });
    const orc = enemy("orc", { code: "orc", name: "Orc", type: "enemy", attack: 2, health: 8 });
    const ctx = {
      effects,
      cards: cardMap([
        orc,
        hero("aragorn", "leadership", 10, 1),
        definePrinted({ code: "shade", name: "Shade", type: "treachery" }),
      ]),
    };
    const opened = expectOk(reduce(state, { type: "DeclineEngage" }, ctx));
    const popAt = opened.steps.findIndex((step) => step.kind === "pop");
    const attackAt = opened.steps.findIndex((step) => step.kind === "attack");
    expect(opened.steps.filter((step) => step.kind === "damage")).toEqual([
      { kind: "damage", targetId: ids.orc, amount: 1 },
    ]);
    expect(popAt).toBeGreaterThan(opened.steps.findIndex((step) => step.kind === "damage"));
    expect(attackAt).toBeGreaterThan(popAt);
    expect(opened.steps.some((step) => step.kind === "push" && step.frame === "whenRevealed")).toBe(false);
    expect(opened.state.cards[ids.orc ?? ""]?.damage).toBe(1);
    expect(opened.state.cards[ids.aragorn ?? ""]?.damage).toBe(0);
    expect(opened.state.stack).toEqual([]);
    const hit = expectOk(reduce(opened.state, { type: "Undefended" }, ctx));
    expect(hit.steps.some((step) => step.kind === "push" || step.kind === "pop")).toBe(false);
    expect(hit.steps.some((step) => step.kind === "damage")).toBe(true);
    expect(hit.state.cards[ids.aragorn ?? ""]?.damage).toBe(2);
    expect(hit.state.cards[ids.orc ?? ""]?.damage).toBe(1);
  });

  it("does not defend or place attack damage after a shadow effect destroys the attacker", () => {
    const effects: Effect[] = [{ cardCode: "shade", timing: "shadow", instructions: [{ verb: "DealDamage" }] }];
    function attacked(victory: number | null) {
      const { state, ids } = engageWindow({
        seatCount: 1,
        enemies: [{ code: "orc", seat: 0 }],
        shadows: ["shade"],
        heroes: [{ code: "aragorn", seat: 0 }],
      });
      const ctx = {
        effects,
        cards: cardMap([
          enemy("orc", { attack: 2, health: 1, victory }),
          hero("aragorn", "leadership", 10, 1),
          definePrinted({ code: "shade", name: "Shade", type: "treachery" }),
        ]),
      };
      const opened = expectOk(reduce(state, { type: "DeclineEngage" }, ctx));
      expect(opened.state.cards[ids.orc ?? ""]?.zone).toBe(victory == null ? "encounterDiscard" : "victory");
      expect(opened.state.cards[ids.aragorn ?? ""]?.damage).toBe(0);
      expect(opened.state.pendingAttack).toBeNull();
      expect(opened.state.window?.kind).not.toBe("defense");
      expect(opened.steps.filter((step) => step.kind === "damage")).toEqual([
        { kind: "damage", targetId: ids.orc, amount: 1 },
      ]);
      expect(opened.steps.some((step) => step.kind === "attack")).toBe(false);
      const hit = reduce(opened.state, { type: "Undefended" }, ctx);
      expect(hit.ok).toBe(false);
      if (!hit.ok) expect(hit.state.cards[ids.aragorn ?? ""]?.damage).toBe(0);
    }
    attacked(null);
    attacked(3);
  });

  it("distributes staging archery when no enemy is engaged", () => {
    const shooter = enemy("archer", { keywords: { archery: 2 }, engagementCost: 50, attack: 3, defense: 3 });
    const heroCard = hero("aragorn", "leadership", 10, 1);
    const cards = cardMap([shooter, heroCard]);
    let state = blankScenario({ seatCount: 1, seed: 6, definition: fixtureDefinition(["stage"]) });
    const heroSpawn = spawn(state, "aragorn", { zone: "heroes", seat: 0 });
    state = heroSpawn.state;
    const enemySpawn = spawn(state, "archer", { zone: "staging" });
    state = withThreat(enemySpawn.state, 0, 20);
    state = {
      ...state,
      phase: "Encounter",
      mode: "optionalEngage",
      window: { kind: "optionalEngage" },
      activeSeat: 0,
    };
    const ctx = { effects: [], cards };
    const opened = expectOk(reduce(state, { type: "DeclineEngage" }, ctx));
    expect(opened.state.seats[0].engaged).toEqual([]);
    expect(opened.state.staging).toEqual([enemySpawn.id]);
    expect(opened.state.window).toEqual({ kind: "archery", total: 2 });
    expect(opened.state.cards[heroSpawn.id]?.damage).toBe(0);
    expect(legalTargets(opened.state, { type: "Distribute" }, ctx)).toEqual([heroSpawn.id]);
    const assigned = expectOk(
      reduce(opened.state, { type: "Distribute", assignments: [{ cardId: heroSpawn.id, amount: 2 }] }, ctx),
    );
    expect(assigned.state.cards[heroSpawn.id]?.damage).toBe(2);
  });

  it("does not deal a second shadow to an enemy that already has one", () => {
    const { state, ids } = engageWindow({
      seatCount: 1,
      enemies: [{ code: "orc", seat: 0 }],
      shadows: ["kept", "extra"],
      heroes: [{ code: "aragorn", seat: 0 }],
    });
    const prepared = updateCard(
      moveCard(state, ids.kept ?? "", { zone: "shadow", enemyId: ids.orc ?? "" }),
      ids.kept ?? "",
      { face: "down" },
    );
    const cards = cardMap([
      enemy("orc", { keywords: { archery: 1 } }),
      hero("aragorn", "leadership", 10, 1),
      definePrinted({ code: "kept", name: "kept", type: "treachery" }),
      definePrinted({ code: "extra", name: "extra", type: "treachery" }),
    ]);
    const opened = expectOk(reduce(prepared, { type: "DeclineEngage" }, { effects: [], cards }));
    expect(opened.state.window?.kind).toBe("archery");
    expect(opened.state.encounterDeck).toEqual([ids.extra]);
    expect(opened.state.cards[ids.orc ?? ""]?.shadowId).toBe(ids.kept);
    expect(opened.state.cards[ids.kept ?? ""]?.zone).toBe("shadow");
    expect(opened.state.cards[ids.extra ?? ""]?.zone).toBe("encounterDeck");
  });

  it("finishes enemy attacks in seat order before any player attack", () => {
    const { state, ids, cards } = engageWindow({
      seatCount: 2,
      enemies: [
        { code: "orc", seat: 0 },
        { code: "warg", seat: 1 },
      ],
      shadows: [],
    });
    const ctx = { effects: [], cards };
    let next = expectOk(reduce(state, { type: "DeclineEngage" }, ctx));
    next = expectOk(reduce(next.state, { type: "DeclineEngage" }, ctx));
    expect(next.state.window).toMatchObject({ kind: "defense", seat: 0, enemyId: ids.orc });
    const first = expectOk(reduce(next.state, { type: "Undefended" }, ctx));
    expect(first.state.window).toMatchObject({ kind: "defense", seat: 1, enemyId: ids.warg });
    expect(legalIntents(first.state, ctx).some((intent) => intent.type === "DeclareAttackers")).toBe(false);
    const second = expectOk(reduce(first.state, { type: "Undefended" }, ctx));
    expect(second.state.window?.kind).toBe("playerAttack");
    expect(second.state.cards[ids.orc ?? ""]?.damage).toBe(0);
    expect(second.state.cards[ids.warg ?? ""]?.damage).toBe(0);
  });

  it("reduces enemy damage by toughness, then destroys at hit points, leaving an indestructible enemy in play", () => {
    const tough = enemy("tough", { code: "tough", name: "Tough", type: "enemy", defense: 0, health: 10, keywords: { toughness: 1 } });
    const fragile = enemy("fragile", { code: "fragile", name: "Fragile", type: "enemy", defense: 0, health: 3 });
    const statue = enemy("statue", {
      code: "statue",
      name: "Statue",
      type: "enemy",
      defense: 0,
      health: 3,
      keywords: { indestructible: true },
    });
    const striker = definePrinted({
      code: "aragorn",
      name: "aragorn",
      type: "hero",
      sphere: "leadership",
      threat: 10,
      attack: 3,
      defense: 1,
      health: 5,
    });
    const cards = cardMap([tough, fragile, statue, striker]);
    const ctx = { effects: [], cards };

    function strike(code: string) {
      const { state, ids } = engageWindow({
        seatCount: 1,
        enemies: [{ code, seat: 0 }],
        shadows: [],
        heroes: [{ code: "aragorn", seat: 0 }],
      });
      const ready = expectOk(reduce(state, { type: "DeclineEngage" }, ctx));
      const defended = expectOk(reduce(ready.state, { type: "Undefended" }, ctx));
      return expectOk(
        reduce(defended.state, { type: "DeclareAttackers", enemyId: ids[code] ?? "", attackerIds: [ids.aragorn ?? ""] }, ctx),
      ).state;
    }

    const toughed = strike("tough");
    const toughId = Object.values(toughed.cards).find((card) => card.code === "tough")?.id ?? "";
    expect(toughed.cards[toughId]?.damage).toBe(2);
    expect(toughed.cards[toughId]?.zone).toBe("engaged");

    const broken = strike("fragile");
    const fragileId = Object.values(broken.cards).find((card) => card.code === "fragile")?.id ?? "";
    expect(broken.cards[fragileId]?.zone).toBe("encounterDiscard");

    const standing = strike("statue");
    const statueId = Object.values(standing.cards).find((card) => card.code === "statue")?.id ?? "";
    expect(standing.cards[statueId]?.damage).toBe(3);
    expect(standing.cards[statueId]?.zone).toBe("engaged");
  });

  it("rejects a defender without sentinel and an attack without ranged", () => {
    const { state, ids, cards } = engageWindow({
      seatCount: 2,
      enemies: [{ code: "orc", seat: 1 }],
      shadows: [],
    });
    let defender = blankScenario({ seatCount: 2, seed: 1, definition: fixtureDefinition(["stage"]) });
    const enemySpawn = spawn(defender, "orc", { zone: "engaged", seat: 1 });
    defender = enemySpawn.state;
    const ally = spawn(defender, "guard", { zone: "play", seat: 0 });
    defender = updateCard(ally.state, ally.id, { exhausted: false });
    const waiting = spawn(defender, "orc", { zone: "engaged", seat: 1 });
    defender = waiting.state;
    defender = {
      ...defender,
      phase: "Combat",
      mode: "enemyAttacks",
      window: { kind: "defense", enemyId: enemySpawn.id, seat: 1 },
      pendingAttack: { enemyId: enemySpawn.id, seat: 1 },
      activeSeat: 1,
    };
    const guard = definePrinted({ code: "guard", name: "Guard", type: "ally", defense: 2, health: 2 });
    const sentinel = definePrinted({
      code: "guard",
      name: "Guard",
      type: "ally",
      defense: 2,
      health: 2,
      keywords: { sentinel: true },
    });
    const orc = enemy("orc");
    const refused = reduce(defender, { type: "DeclareDefender", defenderId: ally.id }, { effects: [], cards: cardMap([guard, orc, hero("aragorn", "leadership")]) });
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.reason).toBe("Sentinel is required to defend for another seat");
      expect(refused.state).toBe(defender);
    }
    const allowed = expectOk(
      reduce(defender, { type: "DeclareDefender", defenderId: ally.id }, { effects: [], cards: cardMap([sentinel, orc]) }),
    );
    expect(allowed.state.cards[ally.id]?.exhausted).toBe(true);

    const attackState: ScenarioState = {
      ...state,
      phase: "Combat",
      mode: "playerAttacks",
      window: { kind: "playerAttack" },
      activeSeat: 0,
      passed: [],
    };
    const plain = reduce(attackState, { type: "DeclareAttackers", enemyId: ids.orc ?? "", attackerIds: [ids.aragorn ?? ""] }, {
      effects: [],
      cards,
    });
    expect(plain.ok).toBe(false);
    if (!plain.ok) expect(plain.reason).toBe("Ranged is required to attack an enemy engaged with another seat");
  });

  it("rejects a duplicate attacker and places that attack once", () => {
    const fighter = definePrinted({
      code: "aragorn",
      name: "aragorn",
      type: "hero",
      sphere: "leadership",
      threat: 10,
      willpower: 1,
      attack: 3,
      defense: 1,
      health: 5,
    });
    const cards = cardMap([fighter, enemy("orc")]);
    let state = blankScenario({ seatCount: 1, seed: 1, definition: fixtureDefinition(["stage"]) });
    const heroSpawn = spawn(state, "aragorn", { zone: "heroes", seat: 0 });
    state = heroSpawn.state;
    const enemySpawn = spawn(state, "orc", { zone: "engaged", seat: 0 });
    state = {
      ...enemySpawn.state,
      phase: "Combat",
      mode: "playerAttacks",
      window: { kind: "playerAttack" },
      activeSeat: 0,
    };
    const doubled = reduce(state, {
      type: "DeclareAttackers",
      enemyId: enemySpawn.id,
      attackerIds: [heroSpawn.id, heroSpawn.id],
    }, { effects: [], cards });
    expect(doubled.ok).toBe(false);
    if (!doubled.ok) {
      expect(doubled.reason).toBe("That character cannot attack twice");
      expect(doubled.state).toBe(state);
    }
    expect(state.cards[enemySpawn.id]?.damage).toBe(0);
    const once = expectOk(reduce(state, {
      type: "DeclareAttackers",
      enemyId: enemySpawn.id,
      attackerIds: [heroSpawn.id],
    }, { effects: [], cards }));
    expect(once.state.cards[enemySpawn.id]?.damage).toBe(3);
  });
});
