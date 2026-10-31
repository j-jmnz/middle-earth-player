// Rules: rr.campaign-cards, rr.burdens, rr.attachment-cards, rr.objective-cards, rr.destroy, rr.damage, rr.exhausted, rr.blank, rr.attacks-outside-the-combat-phase
// (data/rules/entries.json). The burdens Journey in the Dark's campaign card (142039) deals: Overcome by Grief, Grievous Wound, Shadow of Fear, Pursued by the Enemy.
import { beforeAll, describe, expect, it } from "vitest";

import { countsAsAttachment, hasTrait } from "../rules/conditions.ts";
import { ruleCause } from "../rules/cause.ts";
import type { EngineStep } from "../rules/intents.ts";
import { placeDamage } from "../rules/keywords.ts";
import { exhaustCard } from "../rules/player-verbs.ts";
import { reduce } from "../rules/reduce.ts";
import { expectOk } from "../rules/fixture.ts";
import { flagged, type ScenarioState } from "../rules/state.ts";
import { BALROG, GRIEF, WOUND, fire, loadMoriaWorld, makeTable, settled, type MoriaLayout, type MoriaTable, type MoriaWorld } from "../../scripts/moria-scene.ts";
import { first } from "../../scripts/past-scene.ts";
import { attachTo, spawn } from "../rules/zones.ts";

let world: MoriaWorld;

beforeAll(async () => {
  world = await loadMoriaWorld();
}, 60_000);

const make = (layout: MoriaLayout = {}) => makeTable(world, layout);

function hurt(table: MoriaTable, state: ScenarioState, id: string, amount: number): ScenarioState {
  const steps: EngineStep[] = [];
  return settled(table, placeDamage(state, id, amount, table.ctx.cards, steps, "framework", ruleCause("rr.damage")), steps);
}

describe("Grievous Wound (142088:A:2)", () => {
  it("attaches to the hero that takes damage, counting as a Condition attachment, and stays in the staging area for damage on an ally", () => {
    const table = make({ staging: [WOUND], heroes: ["strong"], allies: ["ally"] });
    const strong = first(table.state, "strong");
    const ally = hurt(table, table.state, first(table.state, "ally"), 1);
    expect(ally.cards[first(ally, WOUND)]?.zone).toBe("staging");
    const after = hurt(table, table.state, strong, 1);
    const wound = after.cards[first(after, WOUND)];
    expect(wound?.zone).toBe("attached");
    expect(wound?.host).toBe(strong);
    expect(after.cards[strong]?.attachments).toContain(wound?.id);
    expect(hasTrait(after, wound?.id ?? "", "Condition", table.ctx)).toBe(true);
    expect(countsAsAttachment(after, wound?.id ?? "", table.ctx)).toBe(true);
  });

  it("stays on the first hero it attached to when another takes damage", () => {
    const table = make({ staging: [WOUND], heroes: ["strong"] });
    const strong = first(table.state, "strong");
    const once = hurt(table, table.state, strong, 1);
    const twice = hurt(table, once, table.sam, 1);
    expect(twice.cards[first(twice, WOUND)]?.host).toBe(strong);
  });

  it("deals 1 damage to the attached hero after it exhausts", () => {
    const table = make({ staging: [WOUND], heroes: ["strong"] });
    const strong = first(table.state, "strong");
    const wounded = hurt(table, table.state, strong, 1);
    const exhausted = settled(table, exhaustCard(wounded, strong));
    expect(exhausted.cards[strong]?.exhausted).toBe(true);
    expect(exhausted.cards[strong]?.damage).toBe(2);
    // A hero that does not carry it takes nothing when it exhausts.
    const other = settled(table, exhaustCard(wounded, table.sam));
    expect(other.cards[table.sam]?.damage).toBe(0);
  });

  it("is discarded with its hero like any attachment when the hero is destroyed (rr.attachment-cards)", () => {
    const table = make({ staging: [WOUND], heroes: ["strong"] });
    const strong = first(table.state, "strong");
    const wounded = hurt(table, table.state, strong, 1);
    const dead = hurt(table, wounded, strong, 99);
    expect(dead.cards[strong]?.zone).toBe("discard");
    expect(dead.cards[first(dead, WOUND)]?.zone).toBe("encounterDiscard");
  });
});

describe("Overcome by Grief (142087:A:2)", () => {
  it("attaches to a hero after a character is destroyed", () => {
    const table = make({ staging: [GRIEF], heroes: ["strong"], allies: ["ally"] });
    const strong = first(table.state, "strong");
    const killed = hurt(table, table.state, first(table.state, "ally"), 99);
    expect(killed.cards[first(killed, "ally")]?.zone).toBe("discard");
    // The first player chooses the hero it attaches to.
    expect(killed.window?.kind).toBe("choose");
    const chosen = settled(table, expectOk(reduce(killed, { type: "Choose", optionId: strong }, table.ctx)).state);
    const grief = chosen.cards[first(chosen, GRIEF)];
    expect(grief?.zone).toBe("attached");
    expect(grief?.host).toBe(strong);
    expect(hasTrait(chosen, grief?.id ?? "", "Condition", table.ctx)).toBe(true);
  });

  it("exhausts its hero after a character its hero's player controls is destroyed, and the hero cannot ready until the end of the round", () => {
    const table = make({ seats: 2, heroes: ["strong"], allies: ["ally"] });
    // Grief attached to Sam (seat 0): a seat-0 ally destroyed exhausts Sam; Merry's destruction (seat 1) does not.
    const withGrief = attachedTo(table.state, GRIEF, table.sam, table);
    const allyDies = hurt(table, withGrief, first(withGrief, "ally"), 99);
    expect(allyDies.cards[table.sam]?.exhausted).toBe(true);
    expect(flagged(allyDies, table.sam, "cannotReady")).toBe(true);
    const merryDies = hurt(table, withGrief, table.merry ?? "", 99);
    expect(merryDies.cards[table.sam]?.exhausted).toBe(false);
  });

  it("does nothing while it is in the staging area but a destroyed character, and attaches only when unattached", () => {
    const table = make({ staging: [GRIEF], heroes: ["strong"], allies: ["ally"] });
    const grief = attachedTo(table.state, GRIEF, table.sam, table);
    // The staging copy is gone (this table holds the attached one only): another destroyed character attaches nothing.
    const again = hurt(table, grief, first(grief, "ally"), 99);
    expect(again.window?.kind).not.toBe("choose");
  });
});

function attachedTo(state: ScenarioState, code: string, hostId: string, table: MoriaTable): ScenarioState {
  const existing = Object.values(state.cards).find((card) => card.code === code);
  const base = existing ? moveAside(state, existing.id) : state;
  const placed = spawn(base, code, { zone: "attached" });
  return settled(table, attachTo(placed.state, placed.id, hostId));
}

function moveAside(state: ScenarioState, id: string): ScenarioState {
  return { ...state, staging: state.staging.filter((entry) => entry !== id), cards: Object.fromEntries(Object.entries(state.cards).filter(([key]) => key !== id)) };
}

describe("Shadow of Fear (142085:A:2)", () => {
  it("blanks the printed text box of each character in play until the end of the round", () => {
    const table = make({ heroes: ["strong"], allies: ["ally"], staging: ["142085"] });
    const state = fire(table, table.state, first(table.state, "142085"), "142085:whenRevealed:1");
    for (const code of ["strong", "ally", "141002"]) expect(flagged(state, first(state, code), "blankText"), code).toBe(true);
    expect(flagged(state, first(state, "142085"), "blankText")).toBe(false);
  });
});

describe("Pursued by the Enemy (142086:A:2)", () => {
  it("has each enemy engaged with a player attack, and not the Balrog in the staging area", () => {
    const table = make({ seats: 2, doom: 0, staging: [BALROG, "142086"], engaged: [{ code: "orc", seat: 1 }], heroes: ["strong"] });
    const state = fire(table, table.state, first(table.state, "142086"), "142086:whenRevealed:1");
    expect(state.pendingAttack?.enemyId).toBe(first(state, "orc"));
    expect(state.pendingAttack?.seat).toBe(1);
    const alone = make({ doom: 0, staging: [BALROG, "142086"] });
    expect(fire(alone, alone.state, first(alone.state, "142086"), "142086:whenRevealed:1").pendingAttack).toBeNull();
  });
});
