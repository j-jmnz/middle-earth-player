// Rules: rr.attachment-cards, rr.shadow-effects, rr.travel, rr.damage, rr.lasting-effects (data/rules/entries.json); ledger lines 21032:A:2, 21032:A:3, 21039:A:1, 21042:A:2, 21048:A:2, 21051:A:1, 21078:A:1, 21079:A:1.
// The verbs and hooks the mordor family adds for Danger in Dorwinion, each on a table of the scenario.
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../core/state.ts";
import { modifiedStat } from "../../core/keywords.ts";
import { dealShadows } from "../../combat/combat.ts";
import { discardShadows } from "../../combat/shadow.ts";
import { expireModifiers, updateCard } from "../../core/state.ts";
import { raiseThreat } from "../../core/threat-dial.ts";
import { holds } from "../../interpret/conditions.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import { moveCard, spawn } from "../../core/zones.ts";
import { UNATTRIBUTED } from "../../core/cause.ts";
import { placeDamage } from "../../core/damage.ts";
import { engageWith } from "../../quest/quest.ts";
import { settle } from "../../engine/machine.ts";
import { allyCard, idOf, opened, revealedTop, run, tableFromLayout, where, type Layout } from "../../../../test/harness/scene-kit.ts";

const SECRET = "21039";
const table = (layout: Layout = {}) => tableFromLayout("danger-in-dorwinion", { seats: 1, stage: "21077", phase: "Quest", ...layout });
const settled = (made: { ctx: Parameters<typeof settle>[1] }, state: ScenarioState): ScenarioState => settle(state, made.ctx, []);

describe("AddRandomSetAsideToStaging: a random set-aside card with the Trait enters the staging area (21078:A:1, 21079:A:1)", () => {
  it("adds one Plot objective, not revealed, and leaves the others set aside; with none set aside nothing is added", () => {
    const made = table({ setAside: ["21033", "21034", "21035", "21030"] });
    const state = run(made, opened(made).state, { verb: "AddRandomSetAsideToStaging", trait: "Plot" });
    const plots = ["21033", "21034", "21035"].filter((code) => where(state, code) === "staging");
    expect(plots).toHaveLength(1);
    expect(state.setAside.map((id) => state.cards[id]?.code).sort()).toEqual(["21030", ...["21033", "21034", "21035"].filter((code) => code !== plots[0])].sort());
    const none = table({ setAside: ["21030"] });
    expect(run(none, opened(none).state, { verb: "AddRandomSetAsideToStaging", trait: "Plot" }).setAside).toHaveLength(1);
  });

  it("adds one Cultist enemy of the three", () => {
    const made = table({ setAside: ["21030", "21031", "21032", "21033"] });
    const state = run(made, opened(made).state, { verb: "AddRandomSetAsideToStaging", trait: "Cultist" });
    expect(["21030", "21031", "21032"].filter((code) => where(state, code) === "staging")).toHaveLength(1);
    expect(where(state, "21033")).toBe("setAside");
  });
});

// A table with a weak ally (attack 1) in play and a strong one (attack 4, the Cultist's target), the Cultist on top of the deck.
function cultistTable(layout: Layout = {}) {
  const made = table({ play: ["ally"], ...layout });
  made.cards.set("strong", allyCard("strong", 3, { attack: 4 }));
  const spawned = spawn(made.state, "strong", { zone: "play", seat: 0 });
  return { made: { ...made, state: spawned.state }, strong: spawned.id };
}

describe("Secret Cultist (21039:A:1): an ally defeated as an enemy", () => {
  it("an ally defeated as an enemy goes to its owner's discard pile with its own card", () => {
    const { made, strong } = cultistTable();
    const state = revealedTop(made, SECRET);
    const dead = placeDamage(state, strong, 5, made.ctx.cards, [], "framework", UNATTRIBUTED);
    const done = settled(made, dead);
    expect(done.cards[strong]).toMatchObject({ code: "strong", zone: "discard" });
    expect(done.seats[0]?.discard).toContain(strong);
    expect(where(done, SECRET)).toBe("encounterDiscard");
  });
});

describe("ResolveActiveTravel: the Travel effect of the active location resolves, unpaid and with no travel (21051:A:1)", () => {
  it("does nothing with no active location", () => {
    const made = table({ hand: ["01021"] });
    expect(run(made, opened(made).state, { verb: "ResolveActiveTravel" }).seats[0]?.hand).toHaveLength(1);
  });
});

describe("BarDamageToEngaged: until the end of the round the enemies engaged with the first player cannot take damage (21042:A:2)", () => {
  const damage = (made: { ctx: { cards: Parameters<typeof placeDamage>[3] } }, state: ScenarioState, id: string): number => placeDamage(state, id, 2, made.ctx.cards, [], "framework", UNATTRIBUTED).cards[id]?.damage ?? 0;
  it("an enemy engaged with him takes none, one in the staging area takes it, and one that engages him later takes none", () => {
    const made = table({ engaged: ["21040"], staging: ["21045"] });
    const barred = run(made, opened(made).state, { verb: "BarDamageToEngaged", who: "firstPlayer", until: "endOfRound" });
    const engaged = idOf(barred, "21040");
    const staged = idOf(barred, "21045");
    expect(damage(made, barred, engaged)).toBe(0);
    expect(damage(made, barred, staged)).toBe(2);
    const later = engageWith(barred, 0, staged, []);
    expect(damage(made, later, staged)).toBe(0);
    expect(damage(made, opened(made).state, engaged)).toBe(2);
  });
});

describe("Black Númenórean (21032:A:2, 21032:A:3): the shadow cards with a shadow effect stay faceup and resolve again at each attack", () => {
  const BLACK = "21032";
  const WITH_EFFECT = "21042";
  const WITHOUT_EFFECT = "21043";
  function dealt(made: ReturnType<typeof table>, state: ScenarioState): ScenarioState {
    return settle(dealShadows(state, made.ctx, []), made.ctx, []);
  }

  it("keeps a dealt shadow card that has a shadow effect past the end of the combat phase, and discards one that has none", () => {
    const made = table({ phase: "Combat", engaged: [BLACK], deck: [WITH_EFFECT] });
    const first = dealt(made, opened(made).state);
    const enemy = idOf(first, BLACK);
    const kept = first.cards[enemy]?.shadowId ?? "";
    expect(first.cards[kept]?.code).toBe(WITH_EFFECT);
    expect(discardShadows(first).cards[kept]?.zone).toBe("shadow");
    const plain = table({ phase: "Combat", engaged: [BLACK], deck: [WITHOUT_EFFECT] });
    const second = dealt(plain, opened(plain).state);
    expect(discardShadows(second).cards[second.cards[idOf(second, BLACK)]?.shadowId ?? ""]?.zone).toBe("encounterDiscard");
  });

  it("deals the next card first, so the attack resolves it and the card held stays beside it; the held card leaves with him", () => {
    const made = table({ phase: "Combat", engaged: [BLACK], deck: [WITH_EFFECT, "21040"] });
    const first = dealt(made, opened(made).state);
    const enemy = idOf(first, BLACK);
    const old = first.cards[enemy]?.shadowId ?? "";
    const next = dealt(made, updateCard(discardShadows(first), idOf(first, BLACK), {}));
    const card = next.cards[enemy];
    expect(card?.shadowId).not.toBe(old);
    expect(card?.extraShadowIds).toEqual([old]);
    expect(next.cards[card?.shadowId ?? ""]?.code).toBe("21040");
    const gone = moveCard(next, enemy, { zone: "encounterDiscard" });
    expect(gone.cards[old]?.zone).toBe("encounterDiscard");
  });

  // The attack in progress on the enemy, the held card faceup (the engine turned it up when its own attack resolved it).
  const attackOn = (state: ScenarioState, enemy: string): ScenarioState => ({ ...state, pendingAttack: { enemyId: enemy, seat: 0, defenderId: null, undefended: true } }) as unknown as ScenarioState;

  it("ResolveHeldShadowEffects resolves the cards held faceup from an earlier attack against the attack in progress, not the card dealt for it (21048: +1 Attack)", () => {
    const made = table({ phase: "Combat", engaged: [BLACK], deck: ["21048", "21040"] });
    const first = dealt(made, opened(made).state);
    const enemy = idOf(first, BLACK);
    const held = first.cards[enemy]?.shadowId ?? "";
    // Round 1: the card is turned up by its own attack, and the verb notes it as resolved (it resolves nothing: no older card).
    const round1 = run(made, attackOn(updateCard(first, held, { face: "up" }), enemy), { verb: "ResolveHeldShadowEffects" }, { sourceId: enemy });
    const second = dealt(made, discardShadows({ ...round1, pendingAttack: null }));
    expect(second.cards[enemy]?.extraShadowIds).toEqual([held]);
    const attacking = attackOn(second, enemy);
    const before = modifiedStat(attacking, attacking.cards[enemy]!, "attack", made.ctx.cards);
    const after = run(made, attacking, { verb: "ResolveHeldShadowEffects" }, { sourceId: enemy });
    expect(modifiedStat(after, after.cards[enemy]!, "attack", made.ctx.cards)).toBe(before + 1);
  });

  it("21032:A:3 a kept card that stayed facedown (no attack that round) is turned up by the engine in the next attack and is not resolved a second time", () => {
    const made = table({ phase: "Combat", engaged: [BLACK], deck: ["21048", "21040"] });
    const first = dealt(made, opened(made).state);
    const enemy = idOf(first, BLACK);
    const held = first.cards[enemy]?.shadowId ?? "";
    // No attack in round 1: the card is still facedown. Round 2: the new card comes first, the engine turns the held one up as an additional shadow card and resolves it itself.
    const second = dealt(made, discardShadows(first));
    const turned = attackOn(updateCard(second, held, { face: "up" }), enemy);
    const before = modifiedStat(turned, turned.cards[enemy]!, "attack", made.ctx.cards);
    const after = run(made, turned, { verb: "ResolveHeldShadowEffects" }, { sourceId: enemy });
    expect(modifiedStat(after, after.cards[enemy]!, "attack", made.ctx.cards)).toBe(before);
    // The next attack resolves it: it was faceup and resolved before that one.
    const third = run(made, attackOn(after, enemy), { verb: "ResolveHeldShadowEffects" }, { sourceId: enemy });
    expect(modifiedStat(third, third.cards[enemy]!, "attack", made.ctx.cards)).toBe(before + 1);
  });
});

describe("raisedThreatThisRound (21048:A:2): a seat that raised its threat this round holds the note until the round ends", () => {
  it("the note is made only while the table holds noteThreatRaised, and the condition reads the acting seat", () => {
    const made = table({ phase: "Combat" });
    const state = opened(made).state;
    const shadow = (from: ScenarioState) => holds(from, { kind: "raisedThreatThisRound" }, { actor: 0, sourceId: null, returned: 0 }, made.ctx);
    expect(shadow(raiseThreat(state, 0, 1, [], UNATTRIBUTED))).toBe(false);
    const noting = run(made, state, { verb: "ModifyStat", stat: "noteThreatRaised", amount: 1, until: "endOfGame", target: "table" }, { sourceId: idOf(state, "21077") });
    expect(shadow(noting)).toBe(false);
    expect(shadow(raiseThreat(noting, 0, 1, [], UNATTRIBUTED))).toBe(true);
    expect(shadow(expireModifiers(raiseThreat(noting, 0, 1, [], UNATTRIBUTED), ["endOfRound"]))).toBe(false);
  });
});

describe("highestAttack (21039:A:1): of the allies in play only those with the highest current Attack", () => {
  it("an ally with a bonus is chosen over a stronger printed one; allies tied are all candidates", () => {
    const { made, strong } = cultistTable();
    const weak = idOf(made.state, "ally");
    const state = { ...opened(made).state, modifiers: [{ instanceId: weak, sourceId: weak, stat: "attack" as const, amount: 5, until: "endOfPhase" as const }] };
    const candidates = (from: ScenarioState): string[] => pickCandidates(from, { type: "ally", control: "any", highestAttack: true }, 0, [], null, made.ctx);
    expect(candidates(state)).toEqual([weak]);
    expect(candidates(opened(made).state)).toEqual([strong]);
    const tied = spawn(opened(made).state, "strong", { zone: "play", seat: 0 });
    expect(candidates(tied.state).sort()).toEqual([strong, tied.id].sort());
  });
});
