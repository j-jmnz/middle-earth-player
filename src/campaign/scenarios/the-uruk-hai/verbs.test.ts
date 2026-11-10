// Rules: rr.attachment-cards, rr.reveal, rr.search, rr.cannot, rr.response, rr.shadow-effects, rr.step-6-8b, mec112.pursuit, mec112.toughness (data/rules/entries.json); ledger lines 143015:A:2, 143015:A:3, 143017:A:3, 143019:A:3, 143023:A:2, 143024:A:2, 143026:A:1, 143028:A:2, 143029:A:1, 143029:A:2, 143030:A:1, 143031:A:2, 143032:A:2, 143063:A:2, 143065:A:2, 143066:A:2, 143067:A:2, 143069:B:2, 143070:B:2. The verbs, flags and Responses The Uruk-hai added or uses, on a table of its own cards: what a card-spec row cannot see (damage, a hand, Responses offered).
import { beforeAll, describe, expect, it } from "vitest";

import type { EngineStep } from "../../../rules/core/intents.ts";
import { questRoom } from "../../../rules/families/caves/progress.ts";
import { attachBlocked, restricted } from "../../../rules/interpret/restrictions.ts";
import { attachHeroHosts } from "../../../rules/families/play/hooks.ts";
import { modifiedStat, placeDamage } from "../../../rules/core/keywords.ts";
import { UNATTRIBUTED } from "../../../rules/core/cause.ts";
import { fireForced } from "../../../rules/windows/triggers.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { captivesOf } from "../../../rules/families/captives/values.ts";
import { stagingThreat } from "../../../rules/quest/quest.ts";
import { printedOf } from "../../../rules/core/printed.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import type { ReduceContext } from "../../../rules/engine/reduce.ts";
import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { attachTo, moveCard, shadowCards, spawn } from "../../../rules/core/zones.ts";
import { queueEvent } from "../../../rules/windows/queue.ts";
import { probeTable } from "../../../../scripts/card-smoke/encounter.ts";
import { encounterWorld, type EncounterWorld } from "../../../../scripts/card-smoke/encounter-world.ts";
import { fightEnemy, finish, idOf, legalIntents, legalTargets, resolveRecords, revealFromTop, send, start as begin, tableFromLayout, type Layout, type LayoutTable } from "../../../../test/harness/scene-kit.ts";

let world: EncounterWorld;
let table: ScenarioState;
let ctx: ReduceContext;

beforeAll(async () => {
  world = await encounterWorld("the-uruk-hai");
  ctx = world.contexts.strong;
  table = probeTable(world);
});

describe("AttachSelf to a hero with a trait (143015:A:2)", () => {
  it("offers only the heroes that print the trait", () => {
    const hero = table.seats[0].heroes.map((id) => table.cards[id]).find((card) => card?.code === "q2");
    const cards = new Map(ctx.cards);
    cards.set("q2", { ...printedOf(ctx.cards, "q2"), traits: ["Warrior"] });
    expect(attachHeroHosts(table, { kind: "hero", control: "any", trait: "Warrior" }, 0, cards)).toEqual([hero?.id]);
    expect(attachHeroHosts(table, { kind: "hero", control: "any", trait: "Healer" }, 0, cards)).toEqual([]);
    expect(attachHeroHosts(table, { kind: "hero", control: "any" }, 0, cards)).toHaveLength(table.seats[0].heroes.length);
  });
});

describe("Beyond All Hope's flag cannotHaveTreachery (143019:A:3)", () => {
  it("bars a treachery card from the hero, and not another attachment", () => {
    const hero = table.seats[0].heroes[1] ?? "";
    const boon = spawn(table, "143019", { zone: "attached" });
    const synced = syncConstants(attachTo(boon.state, boon.id, hero), ctx);
    expect(printedOf(ctx.cards, "143030").type).toBe("treachery");
    expect(attachBlocked(synced, ctx, hero, "143030")).toBe(true);
    expect(attachBlocked(synced, ctx, hero, "143015")).toBe(false);
    expect(attachBlocked(synced, ctx, table.seats[0].heroes[2] ?? "", "143030")).toBe(false);
  });
});

describe("SearchReveal to an engaged enemy (143065:A:2)", () => {
  it("reveals an Uruk-hai enemy from the deck engaged with the revealing player, who then has its Threat added to the staging area's", () => {
    const steps: EngineStep[] = [];
    const revealed = revealFromTop(table, ctx, "143065", steps);
    const run = finish({ state: revealed.state, steps }, ctx);
    const found = run.state.seats[0].engaged.map((id) => run.state.cards[id]).filter((card) => card && printedOf(ctx.cards, card.code).traits.includes("Uruk-hai"));
    expect(found).toHaveLength(1);
    expect(run.state.cards[found[0]?.id ?? ""]?.zone).toBe("engaged");
    // Live: the seat holds the flag, so the enemy engaged now and one that engages later both add their Threat to the staging area's.
    expect(run.state.modifiers.some((modifier) => modifier.stat === "engagedThreatSeat" && modifier.instanceId === "seat:0")).toBe(true);
    const total = stagingThreat(run.state, ctx.cards);
    const without = stagingThreat({ ...run.state, modifiers: run.state.modifiers.filter((modifier) => modifier.stat !== "engagedThreatSeat") }, ctx.cards);
    expect(total - without).toBe(modifiedStat(run.state, run.state.cards[found[0]?.id ?? ""]!, "threat", ctx.cards));
  });
});

describe("DiscardRandomFromHand with remember (143066:A:2)", () => {
  it("gives Snaga its discarded card's printed cost as Threat until the end of the round, and 0 with no card in hand", () => {
    const costly = new Map(ctx.cards);
    costly.set("filler", { ...printedOf(ctx.cards, "filler"), cost: 3 });
    const withCost: ReduceContext = { ...ctx, cards: costly };
    const snaga = spawn(table, "143066", { zone: "staging" });
    const run = resolveRecords(snaga.state, withCost, "143066", "whenRevealed", snaga.id);
    const threat = (state: ScenarioState): number => modifiedStat(state, state.cards[snaga.id]!, "threat", withCost.cards);
    expect(run.state.seats[0].hand).toHaveLength(table.seats[0].hand.length - 1);
    expect(threat(run.state)).toBe(threat(snaga.state) + 3);
    const empty = resolveRecords({ ...snaga.state, seats: [{ ...snaga.state.seats[0], hand: [] }, snaga.state.seats[1]] }, withCost, "143066", "whenRevealed", snaga.id);
    expect(threat(empty.state)).toBe(threat(snaga.state));
  });
});

describe("Uglúk cannot leave the staging area (143069:B:2)", () => {
  it("stays in the staging area whatever moves him, and takes no damage, while stage 1B is the quest", () => {
    const synced = syncConstants(table, ctx);
    const ugluk = idOf(table, "143023");
    expect(moveCard(synced, ugluk, { zone: "engaged", seat: 0 }).cards[ugluk]?.zone).toBe("staging");
    expect(moveCard(synced, ugluk, { zone: "encounterDiscard" }).cards[ugluk]?.zone).toBe("staging");
    expect(placeDamage(synced, ugluk, 3, ctx.cards, [], "framework", UNATTRIBUTED).cards[ugluk]?.damage).toBe(0);
    // Once the quest card is gone the flag is too: stage 2 has no such line.
    const free = syncConstants({ ...table, cards: { ...table.cards, [idOf(table, "143069")]: { ...table.cards[idOf(table, "143069")]!, zone: "setAside" } } }, ctx);
    expect(moveCard(free, ugluk, { zone: "engaged", seat: 0 }).cards[ugluk]?.zone).toBe("engaged");
  });
});

describe("the records a spec row cannot see", () => {
  it("143032:A:1 holds the quest to 3 progress for the round", () => {
    const steps: EngineStep[] = [];
    expect(questRoom(table)).toBe(Number.MAX_SAFE_INTEGER);
    const run = finish({ state: revealFromTop(table, ctx, "143032", steps).state, steps }, ctx);
    expect(questRoom(run.state)).toBe(3);
  });

  it("143070:B:3 bars defeating the stage while Uglúk is in play, and not otherwise", () => {
    const withUgluk = tableFromLayout("the-uruk-hai", { stage: "143070", staging: ["143023"], pursuit: 10 }, {});
    const without = tableFromLayout("the-uruk-hai", { stage: "143070", pursuit: 10 }, {});
    expect(restricted(withUgluk.state, withUgluk.ctx, "advance")).toHaveLength(1);
    expect(restricted(without.state, without.ctx, "advance")).toHaveLength(0);
  });

  it("143070:B:2 offers its Response when an enemy is destroyed, and using it lowers the pursuit value by 1", () => {
    const made = tableFromLayout("the-uruk-hai", { stage: "143070", pursuit: 10, engaged: [{ code: "f0", seat: 0 }] }, {});
    const enemy = idOf(made.state, "f0");
    const stage = idOf(made.state, "143070");
    const destroyed = settle({ ...placeDamage({ ...made.state, window: null }, enemy, 99, made.ctx.cards, [], "framework", UNATTRIBUTED), window: null }, made.ctx, []);
    expect(destroyed.cards[enemy]?.zone).not.toBe("engaged");
    expect(legalIntents(destroyed, made.ctx)).toContainEqual({ type: "Trigger", cardId: stage, effectId: "143070:response:1" });
    const used = send({ state: destroyed, steps: [] }, { type: "Trigger", cardId: stage, effectId: "143070:response:1" }, made.ctx);
    expect(used.state.pursuit).toBe(9);
  });

  it("143024:A:2 deals 1 damage to the Captive Grishnákh holds at the end of the quest phase", () => {
    const grishnakh = spawn(table, "143024", { zone: "staging" });
    const [captive] = captivesOf(table);
    const holding = updateCard(grishnakh.state, captive?.id ?? "", { host: grishnakh.id });
    const steps: EngineStep[] = [];
    const fired = fireForced({ ...holding, window: null, phase: "Quest" }, { trigger: "endOfPhase", seat: null, phase: "Quest" }, ctx, steps);
    expect(settle(fired, ctx, steps).cards[captive?.id ?? ""]?.damage).toBe(1);
    const wrong = fireForced({ ...holding, window: null, phase: "Combat" }, { trigger: "endOfPhase", seat: null, phase: "Combat" }, ctx, steps);
    expect(settle(wrong, ctx, steps).cards[captive?.id ?? ""]?.damage).toBe(0);
  });

  it("143026:A:1 has each player draw 1 card", () => {
    const layout = tableFromLayout("the-uruk-hai", { active: "143026", seats: 2, deckOf: ["filler", "filler", "filler", "filler"] }, {});
    const run = resolveRecords(layout.state, layout.ctx, "143026", "response");
    for (const seat of [0, 1]) expect(run.state.seats[seat]?.hand.length).toBe((layout.state.seats[seat]?.hand.length ?? 0) + 1);
  });

  it("143016:A:3 heals up to 3 damage from any hero in play, a Captive included", () => {
    const [captive] = captivesOf(table);
    const hurt = updateCard(table, captive?.id ?? "", { damage: 5 });
    const boon = spawn(hurt, "143016", { zone: "attached" });
    const run = resolveRecords(attachTo(boon.state, boon.id, table.seats[0].heroes[1] ?? ""), ctx, "143016", "action", boon.id);
    expect(run.state.cards[captive?.id ?? ""]?.damage).toBe(2);
  });
});

// The combat records: an attack on the first player's seat, played as far as the defense window or to its end. `fightEnemy` (the shared test kit) deals the shadow card and answers every window.
const build = (layout: Layout): LayoutTable => tableFromLayout("the-uruk-hai", layout, {});
const CAPTIVE = { hero: "dh2", under: "143022" };
// The Captive lies under To Isengard!, which is on the table, and the pursuit value is what the quest card's Setup sets.
const PURSUING: Layout = { staging: ["143022"], pursuit: 10, captive: CAPTIVE };
const hurt = (damage: number) => (state: ScenarioState, made: LayoutTable) => updateCard(state, made.hero, { damage });

// The attack begins in the encounter phase and stops at the defense window (the shadow card dealt), for the Responses a declared defender opens.
function toDefense(layout: Layout, shadow: string, enemy: string): { run: { state: ScenarioState; steps: EngineStep[] }; made: LayoutTable } {
  const made = build({ phase: "Encounter", engaged: [{ code: enemy, seat: 0 }], deck: [shadow, "f0", "f0", "f0"], ...layout });
  let run = send(begin(syncConstants(made.state, made.ctx)), { type: "DeclineEngage" }, made.ctx);
  for (let guard = 0; guard < 60 && run.state.window?.kind !== "defense"; guard += 1) {
    const window = run.state.window;
    if (window?.kind === "chooseEnemy") run = send(run, { type: "ChooseEnemy", enemyId: window.options[0] ?? "" }, made.ctx);
    else if (window?.kind === "choose") run = send(run, { type: "Choose", optionId: window.options[0] ?? "" }, made.ctx);
    else {
      const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack" || intent.type === "DeclineEngage");
      if (!pass) break;
      run = send(run, pass, made.ctx);
    }
  }
  expect(run.state.window?.kind).toBe("defense");
  return { run, made };
}

describe("Intimidation's Response (143015:A:3)", () => {
  const layout: Layout = { phase: "PlayerAttacks", engaged: [{ code: "143025", seat: 0 }], attached: [{ code: "143015", to: "dh1" }] };

  it("is offered when the host is declared as the only attacker against a non-unique enemy, and lowers its Defense by 2 until the attack ends", () => {
    const made = build(layout);
    const enemy = idOf(made.state, "143025");
    const boon = idOf(made.state, "143015");
    const declared = send(begin(made.state), { type: "DeclareAttackers", enemyId: enemy, attackerIds: [made.hero] }, made.ctx);
    expect(legalIntents(declared.state, made.ctx)).toContainEqual({ type: "Trigger", cardId: boon, effectId: "143015:response:1" });
    const before = modifiedStat(declared.state, declared.state.cards[enemy]!, "defense", made.cards);
    expect(before).toBe(2);
    // Declining the Response: the hero's Attack 2 meets Defense 2, no damage. Using it: Defense 0, so 2 is dealt less the enemy's Toughness 1.
    const declined = send(declared, { type: "Pass" }, made.ctx);
    expect(declined.state.cards[enemy]?.damage).toBe(0);
    const used = send(declared, { type: "Trigger", cardId: boon, effectId: "143015:response:1" }, made.ctx);
    expect(used.state.cards[enemy]?.damage).toBe(1);
  });

  it("is not offered when two characters are declared as attackers", () => {
    const made = build(layout);
    const declared = send(begin(made.state), { type: "DeclareAttackers", enemyId: idOf(made.state, "143025"), attackerIds: [made.hero, made.hero2] }, made.ctx);
    expect(legalIntents(declared.state, made.ctx).some((intent) => intent.type === "Trigger" && intent.effectId === "143015:response:1")).toBe(false);
  });

  it("is not offered against a unique enemy", () => {
    const made = build({ ...layout, engaged: [{ code: "143024", seat: 0 }] });
    const declared = send(begin(made.state), { type: "DeclareAttackers", enemyId: idOf(made.state, "143024"), attackerIds: [made.hero] }, made.ctx);
    expect(legalIntents(declared.state, made.ctx).some((intent) => intent.type === "Trigger" && intent.effectId === "143015:response:1")).toBe(false);
  });
});

describe("Forewarned's Response (143017:A:3)", () => {
  it("is offered when the host is declared as the defender against a non-unique enemy with a shadow card, and discards that shadow card", () => {
    const { run, made } = toDefense({ attached: [{ code: "143017", to: "dh1" }] }, "143064", "f3");
    const enemy = idOf(run.state, "f3");
    const boon = idOf(run.state, "143017");
    const defended = send(run, { type: "DeclareDefender", defenderId: made.hero }, made.ctx);
    expect(shadowCards(defended.state.cards[enemy])).toHaveLength(1);
    expect(legalIntents(defended.state, made.ctx)).toContainEqual({ type: "Trigger", cardId: boon, effectId: "143017:response:1" });
    const used = send(defended, { type: "Trigger", cardId: boon, effectId: "143017:response:1" }, made.ctx);
    expect(shadowCards(used.state.cards[enemy])).toHaveLength(0);
  });

  it("is not offered against a unique enemy", () => {
    const { run, made } = toDefense({ attached: [{ code: "143017", to: "dh1" }] }, "143064", "143024");
    const defended = send(run, { type: "DeclareDefender", defenderId: made.hero }, made.ctx);
    expect(legalIntents(defended.state, made.ctx).some((intent) => intent.type === "Trigger" && intent.effectId === "143017:response:1")).toBe(false);
  });
});

describe("Uglúk's text (143023:A:2): allies cannot be declared as attackers or defenders against him", () => {
  it("bars an ally from attacking him and from defending his attacks, and not a hero", () => {
    const attack = build({ phase: "PlayerAttacks", engaged: [{ code: "143023", seat: 0 }, { code: "f0", seat: 0 }], play: ["ally"] });
    const ugluk = idOf(attack.state, "143023");
    const ally = idOf(attack.state, "ally");
    expect(legalTargets(attack.state, { type: "DeclareAttackers", cardId: ally }, attack.ctx)).toEqual([idOf(attack.state, "f0")]);
    expect(legalTargets(attack.state, { type: "DeclareAttackers", cardId: attack.hero }, attack.ctx)).toContain(ugluk);
    const { run, made } = toDefense({ play: ["ally"] }, "f3", "143023");
    const defenders = legalTargets(run.state, { type: "DeclareDefender" }, made.ctx);
    expect(defenders).toContain(made.hero);
    expect(defenders).not.toContain(idOf(run.state, "ally"));
  });
});

describe("Uglúk cannot be engaged (143069:B:2)", () => {
  it("is not offered to the players to engage while stage 1B is the quest, though his engagement cost is within their threat", () => {
    const withStage = build({ phase: "Encounter", staging: ["143023", "f0"], threat: [40, 40] });
    expect(printedOf(withStage.cards, "143023").engagementCost).toBeLessThanOrEqual(40);
    const offered = legalTargets(withStage.state, { type: "Engage" }, withStage.ctx);
    expect(offered).not.toContain(idOf(withStage.state, "143023"));
    expect(offered).toContain(idOf(withStage.state, "f0"));
    const free = build({ phase: "Encounter", stage: "143070", staging: ["143023"], threat: [40, 40] });
    expect(legalTargets(free.state, { type: "Engage" }, free.ctx)).toContain(idOf(free.state, "143023"));
  });
});

describe("the Shadow cards that raise the pursuit value or return the attacker after a character is destroyed (143028:A:2, 143032:A:2, 143067:A:2)", () => {
  // f3 attacks (Attack 1) undefended, the Shadow gives +1: 2 damage to the first hero, which has `damage` already.
  const fight = (shadow: string, damage: number) => fightEnemy(build, shadow, "f3", PURSUING, { undefended: true, tweak: hurt(damage) });

  it("143028 and 143032 give +1 Attack and raise the pursuit value by 1 only when the attack destroys a character", () => {
    for (const shadow of ["143028", "143032"]) {
      const lethal = fight(shadow, 5);
      const calm = fight(shadow, 0);
      // The same fight with a Shadow card that does nothing (f0): the rounds go on alike (To Isengard! raises the value in the refresh phase), so the destroyed character is the difference.
      const plainLethal = fight("f0", 5);
      const plainCalm = fight("f0", 0);
      expect(lethal.run.state.cards[lethal.made.hero]?.zone).not.toBe("heroes");
      expect((lethal.run.state.pursuit ?? 0) - (plainLethal.run.state.pursuit ?? 0)).toBe(1);
      // +1 Attack: 2 damage instead of 1, and nothing is destroyed, so the value is as it was.
      expect([calm.run.state.cards[calm.made.hero]?.damage, plainCalm.run.state.cards[plainCalm.made.hero]?.damage]).toEqual([2, 1]);
      expect(calm.run.state.pursuit).toBe(plainCalm.run.state.pursuit);
    }
  });

  it("143067 returns the attacker to the staging area only when the attack destroys a character", () => {
    const lethal = fight("143067", 5);
    expect(lethal.run.state.cards[idOf(lethal.run.state, "f3")]?.zone).toBe("staging");
    const calm = fight("143067", 0);
    expect(calm.run.state.cards[idOf(calm.run.state, "f3")]?.zone).toBe("engaged");
  });
});

describe("Banks of Entwash (143029:A:1, 143029:A:2)", () => {
  it("raises the pursuit value by 1 when progress is placed on it", () => {
    const made = build({ ...PURSUING, staging: ["143022", "143029"] });
    const banks = idOf(made.state, "143029");
    const queued = queueEvent({ ...made.state, window: null }, { trigger: "progressPlaced", seat: null, cardId: banks });
    expect(settle(queued, made.ctx, []).pursuit).toBe(11);
  });

  it("as a Shadow card the defending player either raises the pursuit value by 1 or has the attack considered undefended", () => {
    const raised = fightEnemy(build, "143029", "f3", PURSUING, { pick: () => "pursuit" });
    const undefended = fightEnemy(build, "143029", "f3", PURSUING, { pick: () => "undefended" });
    // The first option raises the value by 1 and the defender holds (Attack 1 against Defense 2: no damage).
    expect((raised.run.state.pursuit ?? 0) - (undefended.run.state.pursuit ?? 0)).toBe(1);
    const damageOf = (state: ScenarioState): number => state.seats[0].heroes.map((id) => state.cards[id]?.damage ?? 0).reduce((total, each) => total + each, 0);
    expect(damageOf(raised.run.state)).toBe(0);
    // Considered undefended, the defender's Defense no longer counts and the attack's 1 damage lands on a hero.
    expect(damageOf(undefended.run.state)).toBe(1);
  });
});

describe("the choices of the encounter cards (143030:A:1, 143063:A:2, 143031:A:2)", () => {
  it("143030's second option deals 1 damage to each character committed to the quest", () => {
    const made = build({ ...PURSUING, committed: ["dh1"] });
    const steps: EngineStep[] = [];
    const revealed = revealFromTop(made.state, made.ctx, "143030", steps);
    const run = finish({ state: revealed.state, steps }, made.ctx, () => "damage");
    expect(run.state.cards[made.hero]?.damage).toBe(1);
    expect(run.state.pursuit).toBe(10);
  });

  it("143063's first option has the player assign 3 damage among the characters they control", () => {
    const made = build(PURSUING);
    const steps: EngineStep[] = [];
    const revealed = revealFromTop(made.state, made.ctx, "143063", steps);
    const run = finish({ state: revealed.state, steps }, made.ctx, () => "damage");
    const total = run.state.seats[0].heroes.map((id) => run.state.cards[id]?.damage ?? 0).reduce((sum, each) => sum + each, 0);
    expect(total).toBe(3);
  });

  it("143031's Shadow gives the attacker one more attack, dealt a new shadow card", () => {
    const attacks = (shadow: string) => fightEnemy(build, shadow, "f3", {}, { undefended: true }).run.steps.filter((step) => step.kind === "attack" && step.side === "enemy").length;
    expect(attacks("143031")).toBeGreaterThan(attacks("f0"));
  });
});
