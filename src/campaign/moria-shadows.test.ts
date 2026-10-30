// Rules: rr.step-6-2, rr.step-6-4-1, rr.step-6-4-2, rr.step-6-4-3, rr.shadow-effects, rr.cancel, rr.destroy, rr.engaged, rr.immune,
// mec109.immune-to-player-card-effects (data/rules/entries.json). The shadow effects of Journey in the Dark.
import { beforeAll, describe, expect, it } from "vitest";

import { syncConstants } from "../rules/constants.ts";
import { legalIntents, legalTargets } from "../rules/legal.ts";
import { playerCardEffectCanChoose } from "../rules/keywords.ts";
import type { PlayerIntent, ReduceContext } from "../rules/reduce.ts";
import type { ScenarioState } from "../rules/state.ts";
import { definePrinted } from "../rules/printed.ts";
import { loadPrinted } from "../../scripts/test-catalog.ts";
import { causeProblems } from "../../scripts/cause-check.ts";
import { BALROG, loadMoriaWorld, moriaTable, settled, type MoriaLayout, type MoriaWorld } from "../../scripts/moria-scene.ts";
import { first, send, start, type Run } from "../../scripts/past-scene.ts";

let world: MoriaWorld;

beforeAll(async () => {
  world = await loadMoriaWorld();
  for (const [code, card] of await loadPrinted(["01048"])) world.cards.set(code, card);
  world.cards.set("spirit", definePrinted({ code: "spirit", name: "spirit", type: "hero", sphere: "spirit", threat: 8, willpower: 2, attack: 1, defense: 1, health: 5 }));
}, 60_000);

type Fight = { run: Run; ctx: ReduceContext; sam: string; frodo: string };

// The combat phase begins with `engaged` enemies dealt shadow cards from the top of the deck. Sam defends the first attack (or the attack is left
// undefended on Sam), a choice takes `answer` (the first option when it names none). Returns once the attack is over.
function fight(shadow: string, enemy: string, layout: MoriaLayout = {}, defense: "sam" | "undefended" = "undefended", answer?: (state: ScenarioState) => PlayerIntent): Fight {
  const made = moriaTable(world, { phase: "Encounter", engaged: [{ code: enemy, seat: 0 }], deck: [shadow, "f0", "f0", "f0"], ...layout });
  const state = syncConstants(made.state, made.ctx);
  let run: Run = send(start(state), { type: "DeclineEngage" }, made.ctx);
  for (let guard = 0; guard < 60 && run.state.window?.kind !== "defense"; guard += 1) {
    // With several enemies engaged the first player chooses which attacks first: the one the test is about.
    if (run.state.window?.kind === "chooseEnemy") {
      run = send(run, { type: "ChooseEnemy", enemyId: first(run.state, enemy) }, made.ctx);
      continue;
    }
    const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack" || intent.type === "DeclineEngage");
    if (!pass) break;
    run = send(run, pass as PlayerIntent, made.ctx);
  }
  expect(run.state.window?.kind).toBe("defense");
  run = defense === "sam" ? send(run, { type: "DeclareDefender", defenderId: made.sam }, made.ctx) : send(run, { type: "Undefended", heroId: made.sam }, made.ctx);
  for (let guard = 0; guard < 40 && (run.state.pendingAttack != null || run.state.stack.length > 0); guard += 1) {
    const window = run.state.window;
    if (window?.kind === "choose") {
      run = send(run, answer?.(run.state) ?? { type: "Choose", optionId: window.options[0] ?? "" }, made.ctx);
      continue;
    }
    if (window?.kind === "defense") {
      const target = legalTargets(run.state, { type: "Undefended" }, made.ctx)[0];
      run = send(run, answer?.(run.state) ?? { type: "Undefended", heroId: target }, made.ctx);
      continue;
    }
    const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass");
    if (!pass) break;
    run = send(run, pass as PlayerIntent, made.ctx);
  }
  return { run, ctx: made.ctx, sam: made.sam, frodo: made.frodo };
}

const strikes = (run: Run) => run.steps.flatMap((step) => (step.kind === "strike" && step.side === "enemy" ? [step] : []));

describe("shadow effects of Journey in the Dark", () => {
  it("Uruk from Mordor gives +1 Attack, and the attacker attacks again when the attack destroys a character (142047:A:2)", () => {
    // Orc: Attack 2, +1 against Sam's 3 hit points: Sam is destroyed, the Orc attacks again (the second strike lands on another hero).
    const killed = fight("142047", "orc", { heroes: ["strong"] });
    expect(strikes(killed.run)[0]?.attack).toBe(3);
    expect(killed.run.state.cards[killed.sam]?.zone).toBe("discard");
    expect(strikes(killed.run)).toHaveLength(2);
    // Grunt: Attack 1 +1 destroys nobody: one attack.
    const spared = fight("142047", "grunt", { heroes: ["strong"] });
    expect(spared.run.state.cards[spared.sam]?.zone).toBe("heroes");
    expect(strikes(spared.run)).toHaveLength(1);
  });

  it("Moria Orc raises the defending player's threat by 1 for each enemy engaged with them (142048:A:2)", () => {
    // The shadow card goes to the engaged enemy with the highest engagement cost first (rr.step-6-2): the Warg.
    const { run } = fight("142048", "warg", { engaged: [{ code: "orc", seat: 0 }, { code: "grunt", seat: 0 }, { code: "warg", seat: 0 }] });
    // Three enemies engaged with seat 0: threat 8 -> 11.
    expect(run.state.seats[0].threat).toBe(11);
    expect(causeProblems(run.steps)).toEqual([]);
  });

  it("Mines of Moria discards one non-objective attachment, two when the defending player's threat is 35 or more (142052:A:2)", () => {
    for (const [threat, left] of [[20, 1], [36, 0]] as const) {
      const { run, sam } = fight("142052", "grunt", { threat, onSam: ["gear", "gear2"] });
      expect(run.state.cards[sam]?.attachments, `threat ${threat}`).toHaveLength(left);
    }
  });

  it("Mines of Moria leaves the attached burden objectives and the Ring alone", () => {
    const { run, frodo } = fight("142052", "grunt", { threat: 40 });
    expect(run.state.cards[frodo]?.attachments).toHaveLength(2);
  });

  it("Many-pillared Hall gives +1 Attack, +2 when the defending player's threat is 35 or more (142053:A:2)", () => {
    for (const [threat, attack] of [[20, 2], [35, 3]] as const) {
      const { run } = fight("142053", "grunt", { threat });
      expect(strikes(run)[0]?.attack, `threat ${threat}`).toBe(attack);
    }
  });

  it("We Cannot Get Out assigns damage for each enemy engaged with the defending player (142057:A:2)", () => {
    const { run } = fight("142057", "warg", { heroes: ["strong"], engaged: [{ code: "orc", seat: 0 }, { code: "warg", seat: 0 }, { code: "grunt", seat: 0 }] }, "sam", (state) => ({ type: "Choose", optionId: first(state, "strong") }));
    const damage = Object.values(run.state.cards).filter((card) => card.zone === "heroes" || card.zone === "discard").reduce((sum, card) => sum + (card.code === "strong" ? card.damage : 0), 0);
    // Three enemies are engaged with seat 0: three damage, all placed on the strong hero.
    expect(damage).toBe(3);
  });

  it("Fool of a Took! reveals an encounter card when the attack destroys a character (142059:A:3)", () => {
    const killed = fight("142059", "warg", { heroes: ["strong"], deck: ["142059", "grunt", "grunt"] });
    expect(killed.run.state.cards[killed.sam]?.zone).toBe("discard");
    expect(killed.run.state.staging.some((id) => killed.run.state.cards[id]?.code === "grunt")).toBe(true);
    const spared = fight("142059", "grunt", { heroes: ["strong"], deck: ["142059", "orc", "orc"] });
    expect(spared.run.state.staging.some((id) => spared.run.state.cards[id]?.code === "orc")).toBe(false);
  });

  it("Shadow of Fear takes the defending character's Defense away (142085:A:3)", () => {
    // Grunt: Attack 1; Sam defends with Defense 1 or more, so the attack is stopped, until the Shadow takes his Defense away.
    const defended = fight("142085", "grunt", {}, "sam");
    const strike = strikes(defended.run)[0];
    expect(strike?.defense).toBe(0);
    expect(defended.run.state.cards[defended.sam]?.damage).toBe(1);
  });

  it("Pursued by the Enemy makes the attacker attack again after this one (142086:A:3)", () => {
    const { run } = fight("142086", "grunt", { heroes: ["strong"] });
    expect(strikes(run)).toHaveLength(2);
  });
});

describe("the Balrog's shadow cards (142044:A:1)", () => {
  // Hasty Stroke (01048) cancels a shadow effect just triggered. A spirit hero with resources can pay for it.
  function attacked(enemyZone: "balrog" | "orc"): { offered: boolean; shadowed: boolean } {
    const made = moriaTable(world, {
      phase: "Encounter",
      deck: ["142053", "f0", "f0"],
      heroes: ["spirit"],
      hand: ["01048"],
      doom: 0,
      ...(enemyZone === "balrog" ? { staging: [BALROG] } : { engaged: [{ code: "orc", seat: 0 }] }),
    });
    const spirit = first(made.state, "spirit");
    let state = syncConstants({ ...made.state, cards: { ...made.state.cards, [spirit]: { ...made.state.cards[spirit]!, resources: 3 } } }, made.ctx);
    let run: Run = start(state);
    if (enemyZone === "balrog") {
      run = { state: settled(made, { ...state, mode: "combatStart", phase: "Combat", boundaryPhase: "Combat", window: null }), steps: [] };
    } else {
      run = send(run, { type: "DeclineEngage" }, made.ctx);
    }
    for (let guard = 0; guard < 60 && run.state.window?.kind !== "defense"; guard += 1) {
      const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack" || intent.type === "DeclineEngage");
      if (!pass) break;
      run = send(run, pass as PlayerIntent, made.ctx);
    }
    expect(run.state.window?.kind).toBe("defense");
    run = send(run, { type: "Undefended", heroId: made.sam }, made.ctx);
    const enemy = first(run.state, enemyZone === "balrog" ? BALROG : "orc");
    const offered = legalIntents(run.state, made.ctx).some((intent) => intent.type === "Trigger" && "effectId" in intent && intent.effectId === "01048:response:1");
    state = run.state;
    return { offered, shadowed: state.cards[enemy]?.shadowId != null };
  }

  it("are immune to player card effects: a cancel is offered for the shadow of another enemy, never for a card dealt to the Balrog", () => {
    const control = attacked("orc");
    expect(control.shadowed).toBe(true);
    expect(control.offered).toBe(true);
    const balrog = attacked("balrog");
    expect(balrog.shadowed).toBe(true);
    expect(balrog.offered).toBe(false);
  });

  it("the Balrog is immune to player card effects too (the flag the record sets)", () => {
    const table = moriaTable(world, { doom: 0, staging: [BALROG], heroes: ["strong"] });
    const balrog = first(table.state, BALROG);
    const synced = syncConstants(table.state, table.ctx);
    expect(playerCardEffectCanChoose(world.cards.get(BALROG)!, synced, balrog)).toBe(false);
    expect(synced.modifiers.some((modifier) => modifier.stat === "shadowsImmune" && modifier.instanceId === balrog)).toBe(true);
  });
});
