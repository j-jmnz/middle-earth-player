import { describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";

import { canAttack, canDefend } from "./combat.ts";
import { cardMap, expectOk, fixtureDefinition, hero } from "../core/test-fixture.ts";
import { definePrinted } from "../core/printed.ts";
import { legalIntents, legalTargets, reduce } from "../engine/reduce.ts";
import { blankScenario, updateCard, withThreat, type ScenarioState } from "../core/state.ts";
import { clearEliminated } from "../core/eliminate.ts";
import { discardShadows } from "./shadow.ts";
import { moveCard, spawn } from "../core/zones.ts";

function enemy(code: string, patch: Partial<Parameters<typeof definePrinted>[0]> = {}) {
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
      id: "shade:shadow:1", cardCode: "shade", lines: ["fixture:A:1"],
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
    // The shadow card stays face down until the defender is declared or the attack is undefended.
    expect(opened.steps.some((step) => step.kind === "push")).toBe(false);
    expect(opened.state.window?.kind).toBe("defense");
    const hit = expectOk(reduce(opened.state, { type: "Undefended" }, ctx));
    const frames = hit.steps.filter((step) => step.kind === "push" || step.kind === "pop");
    expect(frames.map((step) => `${step.kind}:${step.kind === "push" || step.kind === "pop" ? step.frame : ""}`)).toEqual([
      "push:shadow",
      "push:ResolveEffect",
      "pop:ResolveEffect",
      "pop:shadow",
    ]);
    expect(hit.state.stack).toEqual([]);
    expect(hit.state.cards[ids.aragorn ?? ""]?.damage).toBe(2);
    const popAt = hit.steps.findIndex((step) => step.kind === "pop" && step.frame === "shadow");
    expect(hit.steps.findIndex((step) => step.kind === "damage")).toBeGreaterThan(popAt);
  });

  it("runs a shadow effect and not When Revealed, then pops before attack damage", () => {
    const effects: Effect[] = [
      { id: "shade:whenRevealed:2", cardCode: "shade", lines: ["fixture:A:1"], timing: "whenRevealed", instructions: [{ verb: "DealDamage" }] },
      { id: "shade:shadow:3", cardCode: "shade", lines: ["fixture:A:1"], timing: "shadow", instructions: [{ verb: "DealDamage" }] },
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
    expect(opened.steps.some((step) => step.kind === "damage")).toBe(false);
    const hit = expectOk(reduce(opened.state, { type: "Undefended" }, ctx));
    const popAt = hit.steps.findIndex((step) => step.kind === "pop");
    expect(hit.steps.filter((step) => step.kind === "damage")).toEqual([
      expect.objectContaining({ kind: "damage", targetId: ids.orc, amount: 1 }),
      expect.objectContaining({ kind: "damage", targetId: ids.aragorn, amount: 2 }),
    ]);
    expect(popAt).toBeGreaterThan(hit.steps.findIndex((step) => step.kind === "damage"));
    expect(popAt).toBeLessThan(hit.steps.findIndex((step) => step.kind === "damage" && step.targetId === ids.aragorn));
    expect(hit.steps.some((step) => step.kind === "push" && step.frame === "whenRevealed")).toBe(false);
    expect(hit.state.cards[ids.aragorn ?? ""]?.damage).toBe(2);
    expect(hit.state.cards[ids.orc ?? ""]?.damage).toBe(1);
    expect(hit.state.stack).toEqual([]);
  });

  it("places no attack damage after a shadow effect destroys the attacker", () => {
    const effects: Effect[] = [{ id: "shade:shadow:4", cardCode: "shade", lines: ["fixture:A:1"], timing: "shadow", instructions: [{ verb: "DealDamage" }] }];
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
      const answered = expectOk(reduce(opened.state, { type: "Undefended" }, ctx));
      expect(answered.state.cards[ids.orc ?? ""]?.zone).toBe(victory == null ? "encounterDiscard" : "victory");
      expect(answered.state.cards[ids.aragorn ?? ""]?.damage).toBe(0);
      expect(answered.state.pendingAttack).toBeNull();
      expect(answered.state.window?.kind).not.toBe("defense");
      expect(answered.steps.filter((step) => step.kind === "damage")).toEqual([
        expect.objectContaining({ kind: "damage", targetId: ids.orc, amount: 1 }),
      ]);
      const again = reduce(answered.state, { type: "Undefended" }, ctx);
      expect(again.ok).toBe(false);
      if (!again.ok) expect(again.state.cards[ids.aragorn ?? ""]?.damage).toBe(0);
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

  it("reduces enemy damage by toughness, then destroys at hit points, leaving an indestructible enemy in play (mec109.indestructible, hob.indestructible)", () => {
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

  it("lets a treasure with printed combat stats defend and attack as a character", () => {
    const gildor = definePrinted({ code: "elf", name: "Elf Lord", type: "treasure", attack: 2, defense: 2, health: 4 });
    const relic = definePrinted({ code: "relic", name: "Relic", type: "treasure" });
    const cards = cardMap([gildor, relic, enemy("orc")]);
    let state = blankScenario({ seatCount: 1, seed: 1, definition: fixtureDefinition(["stage"]) });
    const elf = spawn(state, "elf", { zone: "play", seat: 0 });
    const prop = spawn(elf.state, "relic", { zone: "play", seat: 0 });
    const orc = spawn(prop.state, "orc", { zone: "engaged", seat: 0 });
    state = orc.state;
    expect(canDefend(state, 0, elf.id, cards)).toBe(true);
    expect(canAttack(state, 0, elf.id, orc.id, cards)).toBe(true);
    expect(canDefend(state, 0, prop.id, cards)).toBe(false);
    expect(canAttack(state, 0, prop.id, orc.id, cards)).toBe(false);
  });
});

describe("combat framework rules", () => {
  function fighter(code: string, patch: Partial<Parameters<typeof definePrinted>[0]> = {}) {
    return definePrinted({ code, name: code, type: "hero", sphere: "leadership", threat: 10, willpower: 1, attack: 3, defense: 1, health: 5, ...patch });
  }

  function attackPhase(state: ScenarioState): ScenarioState {
    return { ...state, phase: "Combat", mode: "playerAttacks", window: { kind: "playerAttack" }, activeSeat: 0, passed: [] };
  }

  it("lets a seat declare one attack against each enemy in the combat phase (faq.limitations-on-attacks)", () => {
    const cards = cardMap([fighter("a"), fighter("b"), enemy("orc", { defense: 2, health: 9 })]);
    let state = blankScenario({ seatCount: 1, seed: 1, definition: fixtureDefinition(["stage"]) });
    const a = spawn(state, "a", { zone: "heroes", seat: 0 });
    const b = spawn(a.state, "b", { zone: "heroes", seat: 0 });
    const orc = spawn(b.state, "orc", { zone: "engaged", seat: 0 });
    state = attackPhase(orc.state);
    const ctx = { effects: [], cards };
    const first = expectOk(reduce(state, { type: "DeclareAttackers", enemyId: orc.id, attackerIds: [a.id] }, ctx));
    expect(first.state.cards[orc.id]?.damage).toBe(1);
    // b is still ready, but the seat has already attacked the orc this phase.
    expect(legalTargets(first.state, { type: "DeclareAttackers", cardId: b.id }, ctx)).toEqual([]);
    const second = reduce(first.state, { type: "DeclareAttackers", enemyId: orc.id, attackerIds: [b.id] }, ctx);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe("That enemy was already attacked this phase");
  });

  it("lets another seat's ranged character join an attack (rr.ranged, rr.step-6-8-1), but not a character without ranged", () => {
    const cards = cardMap([fighter("a", { attack: 2 }), fighter("archer", { attack: 2, keywords: { ranged: true } }), fighter("plain"), enemy("orc", { defense: 3 })]);
    let state = blankScenario({ seatCount: 2, seed: 1, definition: fixtureDefinition(["stage"]) });
    const a = spawn(state, "a", { zone: "heroes", seat: 0 });
    const archer = spawn(a.state, "archer", { zone: "heroes", seat: 1 });
    const plain = spawn(archer.state, "plain", { zone: "heroes", seat: 1 });
    const orc = spawn(plain.state, "orc", { zone: "engaged", seat: 0 });
    state = attackPhase(orc.state);
    const ctx = { effects: [], cards };
    expect(reduce(state, { type: "DeclareAttackers", enemyId: orc.id, attackerIds: [a.id, plain.id] }, ctx).ok).toBe(false);
    const joined = expectOk(reduce(state, { type: "DeclareAttackers", enemyId: orc.id, attackerIds: [a.id, archer.id] }, ctx));
    // 2 + 2 attack against 3 defense.
    expect(joined.state.cards[orc.id]?.damage).toBe(1);
    expect(joined.state.cards[archer.id]?.exhausted).toBe(true);
  });

  it("deals shadow cards to a seat's enemies by highest engagement cost first (rr.step-6-2)", () => {
    const cards = cardMap([hero("aragorn", "leadership", 10, 1), enemy("low", { engagementCost: 10 }), enemy("high", { engagementCost: 40 }), definePrinted({ code: "s1", name: "s1", type: "treachery" }), definePrinted({ code: "s2", name: "s2", type: "treachery" })]);
    let state = blankScenario({ seatCount: 1, seed: 1, definition: fixtureDefinition(["stage"]) });
    const h = spawn(state, "aragorn", { zone: "heroes", seat: 0 });
    const low = spawn(h.state, "low", { zone: "engaged", seat: 0 });
    const high = spawn(low.state, "high", { zone: "engaged", seat: 0 });
    const s1 = spawn(high.state, "s1", { zone: "encounterDeck" });
    const s2 = spawn(s1.state, "s2", { zone: "encounterDeck" });
    state = withThreat(s2.state, 0, 50 - 1);
    state = { ...state, phase: "Encounter", mode: "optionalEngage", window: { kind: "optionalEngage" }, activeSeat: 0, passed: [] };
    const dealt = expectOk(reduce(state, { type: "DeclineEngage" }, { effects: [], cards }));
    expect(dealt.state.cards[high.id]?.shadowId).toBe(s1.id);
    expect(dealt.state.cards[low.id]?.shadowId).toBe(s2.id);
  });

  it("assigns archery as the combat phase begins, before any shadow card is dealt (mec109.archery, rr.step-6-1)", () => {
    const { state, ids } = engageWindow({ seatCount: 1, enemies: [{ code: "orc", seat: 0 }], shadows: ["shade"], heroes: [{ code: "aragorn", seat: 0 }] });
    const cards = cardMap([enemy("orc", { keywords: { archery: 1 } }), hero("aragorn", "leadership", 10, 1), definePrinted({ code: "shade", name: "shade", type: "treachery" })]);
    const ctx = { effects: [], cards };
    const opened = expectOk(reduce(state, { type: "DeclineEngage" }, ctx));
    expect(opened.state.window).toEqual({ kind: "archery", total: 1 });
    expect(opened.state.cards[ids.shade ?? ""]?.zone).toBe("encounterDeck");
    const assigned = expectOk(reduce(opened.state, { type: "Distribute", assignments: [{ cardId: ids.aragorn ?? "", amount: 1 }] }, ctx));
    expect(assigned.state.cards[ids.orc ?? ""]?.shadowId).toBe(ids.shade);
  });

  it("destroys a character whose hit point bonus ends while its damage is at its hit points (rr.hit-points)", () => {
    const pony: Effect = {
      id: "pony:constant:1", cardCode: "pony", lines: ["fixture:A:1"], timing: "constant",
      instructions: [{ verb: "ModifyStat", stat: "hitPoints", amount: 1, until: "whileSourceInPlay", target: "ownHeroes" }],
    };
    const cards = cardMap([fighter("a", { health: 2 }), definePrinted({ code: "pony", name: "pony", type: "ally", health: 1, cost: 1, sphere: "leadership" }), enemy("orc", { attack: 1 })]);
    let state = blankScenario({ seatCount: 1, seed: 1, definition: fixtureDefinition(["stage"]) });
    const a = spawn(state, "a", { zone: "heroes", seat: 0 });
    const b = spawn(a.state, "a", { zone: "heroes", seat: 0 });
    const pet = spawn(b.state, "pony", { zone: "play", seat: 0 });
    const orc = spawn(pet.state, "orc", { zone: "engaged", seat: 0 });
    state = updateCard(orc.state, a.id, { damage: 2 });
    state = { ...state, phase: "Combat", mode: "enemyAttacks", window: { kind: "defense", enemyId: orc.id, seat: 0 }, pendingAttack: { enemyId: orc.id, seat: 0 }, activeSeat: 0, passed: [] };
    const ctx = { effects: [pony], cards };
    state = { ...state, modifiers: [{ instanceId: a.id, sourceId: pet.id, stat: "hitPoints", amount: 1, until: "whileSourceInPlay", origin: pony.id }, { instanceId: b.id, sourceId: pet.id, stat: "hitPoints", amount: 1, until: "whileSourceInPlay", origin: pony.id }] };
    // The pony defends and is destroyed; a's third hit point goes with it.
    const done = expectOk(reduce(state, { type: "DeclareDefender", defenderId: pet.id }, ctx));
    expect(done.state.cards[pet.id]?.zone).toBe("discard");
    expect(done.state.cards[a.id]?.zone).toBe("discard");
    expect(done.state.cards[b.id]?.zone).toBe("heroes");
  });
});

describe("player elimination", () => {
  it("discards the seat's cards, returns its enemies to staging with their damage, and passes the first player token (rr.player-elimination)", () => {
    const cards = cardMap([hero("aragorn", "leadership", 10, 1), hero("gimli", "tactics", 10, 1), enemy("orc"), definePrinted({ code: "spear", name: "spear", type: "attachment", sphere: "leadership", cost: 1 })]);
    let state = blankScenario({ seatCount: 2, seed: 1, definition: fixtureDefinition(["stage"]) });
    const a = spawn(state, "aragorn", { zone: "heroes", seat: 0 });
    const g = spawn(a.state, "gimli", { zone: "heroes", seat: 1 });
    const orc = spawn(g.state, "orc", { zone: "engaged", seat: 0 });
    const held = spawn(orc.state, "spear", { zone: "hand", seat: 0 });
    state = updateCard(held.state, orc.id, { damage: 3 });
    state = withThreat(state, 0, 49);
    state = { ...state, phase: "Planning", mode: "planning", window: { kind: "pass" }, activeSeat: 0, firstPlayer: 0, passed: [] };
    const bolt: Effect = { id: "bolt:action:1", cardCode: "bolt", lines: ["fixture:A:1"], timing: "action", instructions: [{ verb: "RaiseThreat" }] };
    const withBolt = spawn(state, "bolt", { zone: "hand", seat: 0 });
    const local = { effects: [bolt], cards: cardMap([...cards.values(), definePrinted({ code: "bolt", name: "bolt", type: "event", sphere: "neutral", cost: 0 })]) };
    const done = expectOk(reduce(withBolt.state, { type: "PlayCard", cardId: withBolt.id, payments: [] }, local));
    expect(done.state.seats[0]?.eliminated).toBe(true);
    expect(done.state.cards[a.id]?.zone).toBe("discard");
    expect(done.state.cards[held.id]?.zone).toBe("discard");
    expect(done.state.cards[orc.id]).toMatchObject({ zone: "staging", damage: 3, controller: null });
    expect(done.state.staging).toContain(orc.id);
    expect(done.state.firstPlayer).toBe(1);
    expect(done.state.lost).toBe(false);
  });

  // A Peril card's attack on seat 0 kills its last hero while the window after combat damage is open to both seats
  // (faq.peril-attacks): the attack, its window and the Peril lock end with the seat, so seat 1 is not left locked out.
  it("ends the seat's attack, the window between its steps and its Peril lock (rr.player-elimination, mec109.peril)", () => {
    const cards = cardMap([hero("gimli", "tactics", 10, 1), enemy("orc")]);
    let state = blankScenario({ seatCount: 2, seed: 1, definition: fixtureDefinition(["stage"]) });
    const g = spawn(state, "gimli", { zone: "heroes", seat: 1 });
    const orc = spawn(g.state, "orc", { zone: "engaged", seat: 0 });
    state = orc.state;
    state = {
      ...state,
      seats: [{ ...state.seats[0], eliminated: true }, state.seats[1]],
      phase: "Quest",
      mode: "staging",
      perilSeat: 0,
      pendingAttack: { enemyId: orc.id, seat: 0, immediate: true, damaged: true, awaiting: "end", awaitDepth: 0 },
      window: { kind: "frameAction" },
      activeSeat: 1,
      passed: [],
    };
    const cleared = clearEliminated(state, cards, { effects: [], cards: cards }, []);
    expect(cleared.pendingAttack).toBeNull();
    expect(cleared.window).toBeNull();
    expect(cleared.perilSeat).toBeNull();
    expect(cleared.cards[orc.id]?.zone).toBe("staging");
  });
});

describe("unused shadow cards", () => {
  function dealt() {
    const { state, ids, cards } = engageWindow({
      seatCount: 1,
      enemies: [{ code: "orc", seat: 0 }],
      shadows: ["shade"],
      heroes: [{ code: "aragorn", seat: 0 }],
    });
    const opened = expectOk(reduce(state, { type: "DeclineEngage" }, { effects: [], cards }));
    const shadowId = ids.shade ?? "";
    expect(opened.state.cards[shadowId]?.zone).toBe("shadow");
    return { state: opened.state, orcId: ids.orc ?? "", shadowId };
  }

  it("go to the encounter discard when their enemy leaves play", () => {
    const { state, orcId, shadowId } = dealt();
    const gone = moveCard(state, orcId, { zone: "encounterDiscard" });
    expect(gone.cards[shadowId]?.zone).toBe("encounterDiscard");
    expect(gone.encounterDiscard).toContain(shadowId);
    expect(gone.cards[orcId]?.shadowId).toBeNull();
  });

  it("stay with an enemy that only moves between staging and engagement", () => {
    const { state, orcId, shadowId } = dealt();
    const back = moveCard(state, orcId, { zone: "staging" });
    expect(back.cards[shadowId]?.zone).toBe("shadow");
    expect(back.cards[orcId]?.shadowId).toBe(shadowId);
  });

  it("are all discarded at the end of the combat phase", () => {
    const { state, shadowId } = dealt();
    const ended = discardShadows(state);
    expect(ended.cards[shadowId]?.zone).toBe("encounterDiscard");
    expect(Object.values(ended.cards).some((card) => card.zone === "shadow")).toBe(false);
  });
});
