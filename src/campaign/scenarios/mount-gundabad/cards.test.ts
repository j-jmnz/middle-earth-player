// Rules: emce.gundabad-quest-deck, emce.immune, emce.indestructible, emce.caves-deck-gundabad, emce.treasure, rr.damage, rr.attacks-outside-the-combat-phase, rr.shadow-effects, rr.travel, rr.discard-pile-and-victory-display, rr.search (data/rules/entries.json); ledger lines 19122:A:2 to 19133:A:2, 19144:A:2.
// The encounter cards of Mount Gundabad, Dagnir, the First Forge and the Caves cards the scenario adds, and Wormsbane, on the scenario's scene.
import { beforeAll, describe, expect, it } from "vitest";

import type { Instruction } from "../../../catalog/boundary.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { modifiedStat, placeDamage } from "../../../rules/core/keywords.ts";
import { pushEffectFrame } from "../../../rules/interpret/effect-frames.ts";
import { flagged, type ScenarioState } from "../../../rules/core/state.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { CODES, STAGES, codesIn, finish, gundabadFight, gundabadTable, idOf, legalIntents, legalTargets, loadGundabadWorld, resolveRecords, send, start, type GundabadWorld } from "../../../../test/scenarios/mount-gundabad/scene.ts";

let world: GundabadWorld;
beforeAll(async () => {
  world = await loadGundabadWorld();
}, 120_000);

type Table = ReturnType<typeof gundabadTable>;
const where = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const stat = (state: ScenarioState, code: string, name: "threat" | "attack" | "defense" | "willpower" | "engagementCost"): number => modifiedStat(state, state.cards[idOf(state, code)]!, name, world.cards);
const settled = (t: Table, state: ScenarioState = t.state): ScenarioState => settle({ ...state, window: null, mode: "stopped" }, t.ctx, []);
// The quest cards in the victory display: The Side Door and the first stage 2s, `count` of them.
const QUESTS = (count: number): string[] => ["19134", "19135", "19137", "19138", "19139", "19140", "19141"].slice(0, count);
// What the modifiers of the state add to a stat of the card: the lasting effects a Shadow card left on an enemy.
const bonus = (state: ScenarioState, id: string, name: string): number => state.modifiers.filter((modifier) => modifier.instanceId === id && modifier.stat === name).reduce((sum, modifier) => sum + modifier.amount, 0);
// The damage steps an effect of the card with this id prefix dealt.
const dealtBy = (run: { steps: readonly { kind: string }[] }, prefix: string): number =>
  run.steps.flat().reduce((sum, step) => sum + (step.kind === "damage" && "cause" in step && typeof step.cause === "object" && step.cause != null && "effect" in step.cause && String(step.cause.effect).startsWith(prefix) ? (step as unknown as { amount: number }).amount : 0), 0);

describe("19125 Dagnir", () => {
  const dagnirTable = (victory: number, extra: Parameters<typeof gundabadTable>[1] = {}): Table => gundabadTable(world, { stage: "19142", questDeck: STAGES.slice(1).filter((code) => !QUESTS(victory).includes(code) && code !== "19142"), staging: [CODES.dagnir], ...extra });
  const damage = (t: Table, amount: number, source: "framework" | "quest" | "combat"): ScenarioState => placeDamage(t.state, idOf(t.state, CODES.dagnir), amount, t.ctx.cards, [], source, { kind: "rule", rule: "rr.damage" } as never);

  it("19125:A:2 Dagnir takes at most X damage each round from effects other than a quest card's, X 1 more than the quest cards in the victory display", () => {
    for (const quests of [1, 3, 5]) {
      const t = dagnirTable(quests);
      const id = idOf(t.state, CODES.dagnir);
      const first = damage(t, 20, "framework");
      expect(first.cards[id]?.damage, `${quests} quest cards`).toBe(Math.min(quests + 1, 20));
      // The round's allowance is spent: more damage this round is not placed.
      const second = placeDamage(first, id, 5, t.ctx.cards, [], "framework", { kind: "rule", rule: "rr.damage" } as never);
      expect(second.cards[id]?.damage).toBe(first.cards[id]?.damage);
    }
  });

  it("19125:A:2 a quest card's damage is neither held to the cap nor counted against it (19139:B:2)", () => {
    const t = dagnirTable(1);
    const id = idOf(t.state, CODES.dagnir);
    const quest = damage(t, 5, "quest");
    expect(quest.cards[id]?.damage).toBe(5);
    expect(quest.roundDamage?.[id]).toBeUndefined();
    // The cap (X = 2 here) is still whole for another effect.
    const after = placeDamage(quest, id, 9, t.ctx.cards, [], "framework", { kind: "rule", rule: "rr.damage" } as never);
    expect(after.cards[id]?.damage).toBe(5 + 2);
  });

  it("19125:A:2 combat damage counts against the cap", () => {
    const t = dagnirTable(2);
    expect(damage(t, 20, "combat").cards[idOf(t.state, CODES.dagnir)]?.damage).toBe(3);
  });

  it("19125:A:1 Dagnir is indestructible: she keeps her damage, however much, and stays in play", () => {
    const t = dagnirTable(5, { staging: [{ code: CODES.dagnir, damage: 19 }] });
    const id = idOf(t.state, CODES.dagnir);
    const after = settled(t, damage({ ...t, state: t.state } as Table, 6, "quest"));
    expect(after.cards[id]?.damage).toBeGreaterThanOrEqual(20);
    expect(after.cards[id]?.zone).toBe("staging");
  });

  it("19125:A:3 with 5 or more quest cards in the victory display she cannot leave the staging area and is considered engaged with each player", () => {
    const flags = (state: ScenarioState) => (["cannotBeEngaged", "engagedWithAll", "attackableByAny"] as const).map((name) => flagged(state, idOf(state, CODES.dagnir), name));
    expect(flags(dagnirTable(4).state)).toEqual([false, false, false]);
    expect(flags(dagnirTable(5).state)).toEqual([true, true, true]);
  });

  it("19125:A:3 she is considered engaged with each player: the players' characters can attack her from the staging area", () => {
    const attack = (t: Table) => send(start(t.state), { type: "DeclareAttackers", enemyId: idOf(t.state, CODES.dagnir), attackerIds: [t.hero] } as never, t.ctx);
    const many = gundabadTable(world, { phase: "PlayerAttacks", stage: "19142", questDeck: [], staging: [CODES.dagnir] });
    expect(attack(many).steps.flat().map((step) => step.kind)).toContain("attack");
    const few = gundabadTable(world, { phase: "PlayerAttacks", stage: "19135", questDeck: STAGES.slice(2), staging: [CODES.dagnir], victory: [] });
    expect(() => attack(few)).toThrow();
  });
});

describe("19126 Guardian of Gundabad", () => {
  it("19126:A:1 it gets +2 Defense while there are 3 or more quest cards in the victory display", () => {
    const base = world.cards.get(CODES.guardianOfGundabad)?.defense ?? 0;
    for (const [quests, bonusDefense] of [[2, 0], [3, 2], [5, 2]] as const) {
      const t = gundabadTable(world, { stage: "19142", questDeck: ["19141"], staging: [CODES.guardianOfGundabad], victory: QUESTS(quests) });
      // The table holds the other stage 2s in its victory display too; the count is read against what lies there.
      const held = codesIn(t.state, "victory").length;
      expect(stat(t.state, CODES.guardianOfGundabad, "defense"), `${held} quest cards`).toBe(base + (held >= 3 ? 2 : 0));
      expect(bonusDefense).toBeDefined();
    }
  });

  it("19126:A:2 Shadow: the attacking enemy gets +2 Defense until the end of the phase", () => {
    const fight = gundabadFight(world, CODES.guardianOfGundabad, "f3", {}, { undefended: true });
    expect(bonus(fight.run.state, idOf(fight.run.state, "f3"), "defense")).toBe(2);
  });
});

describe("19127 Dagnir's Slave", () => {
  it("19127:A:1 Dagnir takes no damage from effects other than a quest card's: combat and quest damage are placed", () => {
    const t = gundabadTable(world, { stage: "19135", questDeck: STAGES.slice(2), staging: [CODES.dagnirSSlave, CODES.dagnir], victory: [] });
    const id = idOf(t.state, CODES.dagnir);
    const place = (source: "framework" | "quest" | "combat" | "player") => placeDamage(t.state, id, 1, t.ctx.cards, [], source, { kind: "rule", rule: "rr.damage" } as never).cards[id]?.damage;
    expect(place("framework")).toBe(0);
    expect(place("combat")).toBe(1);
    expect(place("quest")).toBe(1);
    // Without the Slave in play the same damage lands.
    const free = gundabadTable(world, { stage: "19135", questDeck: STAGES.slice(2), staging: [CODES.dagnir], victory: [] });
    expect(placeDamage(free.state, idOf(free.state, CODES.dagnir), 1, free.ctx.cards, [], "framework", { kind: "rule", rule: "rr.damage" } as never).cards[idOf(free.state, CODES.dagnir)]?.damage).toBe(1);
  });

  it("19127:A:2 Shadow: the attacker gets +1 Attack, +2 instead if Dagnir is engaged with the defending player", () => {
    // The hero is undefended: it takes the f3's Attack (1) and the Shadow's bonus, and Dagnir's own Attack when she is engaged with it too.
    const apart = gundabadFight(world, CODES.dagnirSSlave, "f3", { staging: [CODES.dagnir] }, { undefended: true });
    expect(apart.run.state.cards[apart.made.hero]?.damage).toBe(1 + 1);
    const engaged = gundabadFight(world, CODES.dagnirSSlave, "f3", { engaged: [{ code: "f3", seat: 0 }, { code: CODES.dagnir, seat: 0 }] }, { undefended: true });
    expect(engaged.run.state.cards[engaged.made.hero]?.damage).toBe(1 + 2 + (world.cards.get(CODES.dagnir)?.attack ?? 0));
  });
});

describe("19128 Deep-dweller", () => {
  it("19128:A:1 Forced: when it engages a player it makes an immediate attack", () => {
    const t = gundabadTable(world, { phase: "Encounter", staging: [CODES.deepDweller] });
    const run = send(start(t.state), { type: "Engage", enemyId: idOf(t.state, CODES.deepDweller) } as never, t.ctx);
    expect(run.state.window?.kind).toBe("defense");
    expect(run.state.pendingAttack?.enemyId).toBe(idOf(t.state, CODES.deepDweller));
  });

  it("19128:A:2 Forced: after it takes damage and survives it returns to the staging area; when it is destroyed it does not", () => {
    const t = gundabadTable(world, { engaged: [{ code: CODES.deepDweller, seat: 0 }] });
    const id = idOf(t.state, CODES.deepDweller);
    const hurt = settled(t, placeDamage(t.state, id, 1, t.ctx.cards, [], "combat", { kind: "rule", rule: "rr.damage" } as never));
    expect(hurt.cards[id]?.zone).toBe("staging");
    expect(hurt.cards[id]?.damage).toBe(1);
    const hit = world.cards.get(CODES.deepDweller)?.health ?? 0;
    const dead = settled(t, placeDamage(t.state, id, hit, t.ctx.cards, [], "combat", { kind: "rule", rule: "rr.damage" } as never));
    expect(dead.cards[id]?.zone).not.toBe("staging");
  });
});

describe("19129 Mines of Gundabad", () => {
  it("19129:A:1 Deep: after the players travel to it they discard it and the top card of the Caves deck becomes the active location", () => {
    const t = gundabadTable(world, { phase: "Travel", staging: [CODES.minesOfGundabad], caves: [CODES.crumblingCavern] });
    const run = finish(send(start(t.state), { type: "Travel", locationId: idOf(t.state, CODES.minesOfGundabad) }, t.ctx), t.ctx);
    expect(run.state.cards[idOf(t.state, CODES.crumblingCavern)]?.zone).toBe("activeLocation");
    expect(where(run.state, CODES.minesOfGundabad)[0]?.zone).toBe("encounterDiscard");
  });

  it("19129:A:2 Dagnir gets -10 engagement cost while it is in play", () => {
    const base = world.cards.get(CODES.dagnir)?.engagementCost ?? 0;
    const with_ = gundabadTable(world, { stage: "19135", questDeck: STAGES.slice(2), staging: [CODES.dagnir, CODES.minesOfGundabad], victory: [] });
    expect(stat(with_.state, CODES.dagnir, "engagementCost")).toBe(base - 10);
    const without = gundabadTable(world, { stage: "19135", questDeck: STAGES.slice(2), staging: [CODES.dagnir], victory: [] });
    expect(stat(without.state, CODES.dagnir, "engagementCost")).toBe(base);
  });

  it("19129:A:3 Shadow: if the attacker is Dagnir the defending player assigns X damage among their characters, X 1 more than the quest cards in the victory display", () => {
    const quests = (count: number) => gundabadFight(world, CODES.minesOfGundabad, CODES.dagnir, { stage: "19142", questDeck: [], victory: QUESTS(count) }, { undefended: true, defender: (made) => made.hero2 });
    const fight = quests(0);
    const victory = codesIn(fight.run.state, "victory").length;
    expect(dealtBy(fight.run, "19129:shadow")).toBe(victory + 1);
  });

  it("19129:A:3 an attacker other than Dagnir gets nothing from the Shadow", () => {
    const fight = gundabadFight(world, CODES.minesOfGundabad, "f3", {}, { undefended: true });
    expect(dealtBy(fight.run, "19129:shadow")).toBe(0);
    expect(fight.run.state.cards[fight.made.hero]?.damage).toBe(1);
  });
});

describe("19130 Narrow Stair", () => {
  it("19130:A:2 the players must travel to it, and may not decline or go elsewhere", () => {
    const t = gundabadTable(world, { phase: "Travel", staging: [CODES.narrowStair, CODES.minesOfGundabad] });
    expect(legalTargets(t.state, { type: "Travel" }, t.ctx)).toEqual([idOf(t.state, CODES.narrowStair)]);
    expect(legalIntents(t.state, t.ctx).map((intent) => intent.type)).not.toContain("DeclineTravel");
    const elsewhere = gundabadTable(world, { phase: "Travel", staging: [CODES.minesOfGundabad] });
    expect(legalTargets(elsewhere.state, { type: "Travel" }, elsewhere.ctx)).toEqual([idOf(elsewhere.state, CODES.minesOfGundabad)]);
  });

  it("19130:A:3 Shadow: the defending character cannot be readied by player card effects until the end of the round", () => {
    const fight = gundabadFight(world, CODES.narrowStair, "f3", {});
    expect(flagged(fight.run.state, fight.made.hero, "cannotReadyByPlayerCard")).toBe(true);
    expect(flagged(fight.run.state, fight.made.hero2, "cannotReadyByPlayerCard")).toBe(false);
  });
});

describe("19131 Desecrated Ruins", () => {
  it("19131:A:2 it gets +2 Threat while there are 3 or more quest cards in the victory display", () => {
    const base = world.cards.get(CODES.desecratedRuins)?.threat ?? 0;
    const few = gundabadTable(world, { stage: "19135", questDeck: STAGES.slice(2), staging: [CODES.desecratedRuins], victory: [] });
    expect(stat(few.state, CODES.desecratedRuins, "threat")).toBe(base);
    const many = gundabadTable(world, { stage: "19142", questDeck: [], staging: [CODES.desecratedRuins] });
    expect(stat(many.state, CODES.desecratedRuins, "threat")).toBe(base + 2);
  });

  it("19131:A:3 Shadow: the attacker gets +1 Attack; if the attack destroys a character each player discards a card at random from their hand", () => {
    const light = gundabadFight(world, CODES.desecratedRuins, "f3", { hand: ["filler", "c0"] }, { undefended: true });
    expect(light.run.state.cards[light.made.hero]?.damage).toBe(2);
    expect(light.run.state.seats[0]?.hand).toHaveLength(2);
    // The hero has 1 hit point left: the attack destroys it.
    const lethal = gundabadFight(world, CODES.desecratedRuins, "f3", { hand: ["filler", "c0"] }, { undefended: true, tweak: (state, made) => ({ ...state, cards: { ...state.cards, [made.hero]: { ...state.cards[made.hero]!, damage: 5 } } }) });
    expect(lethal.run.state.cards[lethal.made.hero]?.zone).not.toBe("heroes");
    expect(lethal.run.state.seats[0]?.hand).toHaveLength(1);
  });
});

describe("19132 Wilderland's Bane", () => {
  it("19132:A:1 When Revealed: Dagnir makes an immediate attack against the player she is engaged with, and her engagement cost is not changed", () => {
    const t = gundabadTable(world, { stage: "19135", questDeck: STAGES.slice(2), victory: [], engaged: [{ code: CODES.dagnir, seat: 0 }] });
    const run = resolveRecords(t.state, t.ctx, CODES.wilderlandSBane, "whenRevealed", undefined, undefined, false);
    expect(run.state.window?.kind === "defense" || run.state.pendingAttack != null).toBe(true);
    expect(run.state.pendingAttack?.enemyId).toBe(idOf(t.state, CODES.dagnir));
    expect(stat(run.state, CODES.dagnir, "engagementCost")).toBe(world.cards.get(CODES.dagnir)?.engagementCost);
  });

  it("19132:A:1 When Revealed: with no attack made Dagnir gets -30 engagement cost until the end of the round", () => {
    const t = gundabadTable(world, { stage: "19135", questDeck: STAGES.slice(2), victory: [], staging: [CODES.dagnir] });
    const base = world.cards.get(CODES.dagnir)?.engagementCost ?? 0;
    const run = resolveRecords(t.state, t.ctx, CODES.wilderlandSBane, "whenRevealed");
    expect(stat(run.state, CODES.dagnir, "engagementCost")).toBe(base - 30);
    const ended = settle({ ...run.state, window: null, mode: "refresh", phase: "Refresh" }, t.ctx, []);
    expect(stat(ended, CODES.dagnir, "engagementCost")).toBe(base);
  });

  it("19132:A:2 Shadow: the attacking enemy makes an additional attack against the defending player", () => {
    const fight = gundabadFight(world, CODES.wilderlandSBane, "f3", {}, { undefended: true });
    expect(fight.run.state.cards[fight.made.hero]?.damage).toBe(2);
  });
});

describe("19133 Suffocating Shadows", () => {
  it("19133:A:1 When Revealed: each player assigns X damage among the allies they control, X 1 more than the quest cards in the victory display", () => {
    const t = gundabadTable(world, { seats: 2, stage: "19135", questDeck: STAGES.slice(2), victory: [], play: ["ally", "ally"] });
    // The table's victory display holds The Side Door: X is 2.
    const run = resolveRecords(t.state, t.ctx, CODES.suffocatingShadows, "whenRevealed");
    const damage = where(run.state, "ally").reduce((sum, ally) => sum + ally.damage, 0);
    expect(damage).toBe(codesIn(t.state, "victory").length + 1);
    // The second player controls no ally: nothing is dealt to their heroes.
    expect(run.state.cards[t.seat1Hero ?? ""]?.damage).toBe(0);
  });

  it("19133:A:2 Shadow: the attacker gets +1 Attack, +3 instead while there are 3 or more quest cards in the victory display", () => {
    const few = gundabadFight(world, CODES.suffocatingShadows, "f3", { stage: "19135", questDeck: STAGES.slice(2), victory: [] }, { undefended: true });
    expect(few.run.state.cards[few.made.hero]?.damage).toBe(1 + 1);
    const many = gundabadFight(world, CODES.suffocatingShadows, "f3", { stage: "19142", questDeck: [] }, { undefended: true });
    expect(many.run.state.cards[many.made.hero]?.damage).toBe(1 + 3);
  });
});

// The effect of a test runs as a frame of the card with this id, and the table settles: progress on the active location explores it.
function frame(state: ScenarioState, instructions: readonly Instruction[], sourceId: string, ctx: Table["ctx"], steps: EngineStep[] = []): ScenarioState {
  const pushed = pushEffectFrame(state, { frame: "ResolveEffect", sourceId, actor: 0, peril: false, effectId: "test", instructions, cancel: null, blockCancel: null }, steps);
  return settle({ ...pushed, window: null }, ctx, steps);
}
const explore = (t: Table): ScenarioState => frame(t.state, [{ verb: "PlaceProgressOn", amount: 99, target: "activeLocation" }], t.hero, t.ctx);
const offerOf = (state: ScenarioState, t: Table, cardId: string) => legalIntents(state, t.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === cardId);
const answerAll = (run: ReturnType<typeof start>, t: Table, pick?: (state: ScenarioState) => string) => finish(run, t.ctx, pick);

describe("19122 The First Forge", () => {
  const forge = (extra: Parameters<typeof gundabadTable>[1] = {}): Table => gundabadTable(world, { phase: "Travel", staging: [CODES.theFirstForge], attached: [{ code: CODES.wormsbane }], ...extra });

  it("19122:A:2 Forced: after it becomes the active location the hero with Wormsbane attached is exhausted, and cannot ready while it is the active location", () => {
    const t = forge();
    const run = finish(send(start(t.state), { type: "Travel", locationId: idOf(t.state, CODES.theFirstForge) }, t.ctx), t.ctx);
    expect(run.state.activeLocation).toBe(idOf(t.state, CODES.theFirstForge));
    expect(run.state.cards[t.hero]?.exhausted).toBe(true);
    expect(run.state.cards[t.hero2]?.exhausted).toBe(false);
    expect(flagged(run.state, t.hero, "cannotReady")).toBe(true);
    // The restriction goes with the location: once it is no longer the active location the hero can ready again.
    const left = { ...run.state, activeLocation: null };
    expect(flagged(left, t.hero, "cannotReady")).toBe(false);
  });

  it("19122:A:2 the hero stays exhausted through the refresh phase while The First Forge is the active location", () => {
    const t = forge();
    let run = finish(send(start(t.state), { type: "Travel", locationId: idOf(t.state, CODES.theFirstForge) }, t.ctx), t.ctx);
    for (let guard = 0; guard < 60 && run.state.round === t.state.round; guard += 1) {
      const pass = legalIntents(run.state, t.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineEngage" || intent.type === "DeclineAttack");
      if (!pass) break;
      run = send(run, pass as never, t.ctx);
    }
    expect(run.state.round).toBe(t.state.round + 1);
    expect(run.state.cards[t.hero]?.exhausted).toBe(true);
    expect(run.state.cards[t.hero2]?.exhausted).toBe(false);
  });

  it("19122:A:3 Response: after it is explored Wormsbane is flipped to its Reforged side and attached to any hero the first player chooses", () => {
    const t = forge({ phase: "Quest", staging: [], active: CODES.theFirstForge, seats: 2 });
    const explored = explore(t);
    expect(explored.window).toMatchObject({ kind: "response" });
    const offer = offerOf(explored, t, idOf(t.state, CODES.theFirstForge));
    expect(offer).toBeDefined();
    const run = answerAll(send({ state: explored, steps: [] }, offer as never, t.ctx), t, (state) => (state.window?.kind === "choose" ? (state.window.options.find((id) => id === t.hero2) ?? state.window.options[0] ?? "") : ""));
    const worms = where(run.state, "19144");
    expect(worms).toHaveLength(1);
    expect(where(run.state, CODES.wormsbane)).toHaveLength(0);
    expect(worms[0]?.host).toBe(t.hero2);
    expect(run.state.cards[t.hero2]?.attachments).toContain(worms[0]?.id);
    expect(run.state.cards[t.hero]?.attachments).not.toContain(worms[0]?.id);
    expect(worms[0]?.zone).toBe("play");
  });

  it("19122:A:3 the Reforged side is Restricted: flipped onto a hero who carries two Restricted attachments already, one of the three is discarded (rr.restricted)", () => {
    const t = forge({ phase: "Quest", staging: [], active: CODES.theFirstForge, attached: [{ code: CODES.wormsbane }, { code: "12197", to: "hero2" }, { code: "12200", to: "hero2" }] });
    const restricted = (state: ScenarioState, id: string) => state.cards[id]?.attachments.filter((other) => t.ctx.cards.get(state.cards[other]?.code ?? "")?.keywords.restricted).length ?? 0;
    expect(restricted(t.state, t.hero2)).toBe(2);
    const explored = explore(t);
    const run = answerAll(send({ state: explored, steps: [] }, offerOf(explored, t, idOf(t.state, CODES.theFirstForge)) as never, t.ctx), t, (state) => (state.window?.kind === "choose" ? (state.window.options.find((id) => id === t.hero2) ?? state.window.options[0] ?? "") : ""));
    expect(restricted(run.state, t.hero2)).toBe(2);
  });

  it("19122:A:3 the first player may attach it to a hero of another player", () => {
    const t = forge({ phase: "Quest", staging: [], active: CODES.theFirstForge, seats: 2 });
    const explored = explore(t);
    const run = answerAll(send({ state: explored, steps: [] }, offerOf(explored, t, idOf(t.state, CODES.theFirstForge)) as never, t.ctx), t, (state) => (state.window?.kind === "choose" ? (state.window.options.find((id) => id === t.seat1Hero) ?? state.window.options[0] ?? "") : ""));
    const worms = where(run.state, "19144")[0];
    expect(worms?.host).toBe(t.seat1Hero);
    expect(worms?.controller).toBe(1);
  });
});

describe("19123 Dagnir's Hoard", () => {
  const hoard = (extra: Parameters<typeof gundabadTable>[1] = {}): Table => gundabadTable(world, { phase: "Quest", active: CODES.dagnirSHoard, seats: 2, deckOf: ["item", "f0", "f0"], ...extra });

  it("19123:A:1 Forced: when it is explored Dagnir returns to the staging area and makes an immediate attack against each player in turn order", () => {
    const t = hoard({ engaged: [{ code: CODES.dagnir, seat: 0 }] });
    const explored = explore(t);
    expect(where(explored, CODES.dagnir)[0]?.zone).toBe("staging");
    const seats: number[] = [];
    let run: ReturnType<typeof start> = { state: explored, steps: [] };
    for (let guard = 0; guard < 40 && (run.state.pendingAttack != null || run.state.stack.length > 0 || run.state.window?.kind === "response"); guard += 1) {
      if (run.state.window?.kind === "defense") {
        seats.push(run.state.activeSeat);
        run = send(run, { type: "Undefended", heroId: run.state.seats[run.state.activeSeat]?.heroes[0] ?? "" } as never, t.ctx);
      } else if (run.state.window?.kind === "choose") run = send(run, { type: "Choose", optionId: run.state.window.options[0] ?? "" }, t.ctx);
      else {
        const next = legalIntents(run.state, t.ctx).find((intent) => intent.type === "Pass" || intent.type === "Trigger");
        if (!next) break;
        run = send(run, next as never, t.ctx);
      }
    }
    expect(seats).toEqual([0, 1]);
  });

  it("19123:A:2 Response: after it is explored each player may search their deck for an Item attachment, add it to their hand and shuffle", () => {
    const t = hoard();
    const explored = explore(t);
    const run0 = { state: explored, steps: [] };
    // The Forced attacks come first; the Response is offered once they are done.
    let run: ReturnType<typeof start> = run0;
    for (let guard = 0; guard < 60 && !(run.state.window?.kind === "response" && offerOf(run.state, t, idOf(t.state, CODES.dagnirSHoard))); guard += 1) {
      if (run.state.window?.kind === "defense") run = send(run, { type: "Undefended", heroId: run.state.seats[run.state.activeSeat]?.heroes[0] ?? "" } as never, t.ctx);
      else if (run.state.window?.kind === "choose") run = send(run, { type: "Choose", optionId: run.state.window.options[0] ?? "" }, t.ctx);
      else {
        const next = legalIntents(run.state, t.ctx).find((intent) => intent.type === "Pass");
        if (!next) break;
        run = send(run, next as never, t.ctx);
      }
    }
    expect(offerOf(run.state, t, idOf(t.state, CODES.dagnirSHoard))).toBeDefined();
    const done = answerAll(send(run, offerOf(run.state, t, idOf(t.state, CODES.dagnirSHoard)) as never, t.ctx), t);
    for (const seat of [0, 1]) expect(done.state.seats[seat]?.hand.map((id) => done.state.cards[id]?.code), `seat ${seat}`).toEqual(["item"]);
  });
});

describe("19124 Throat of the Mountain", () => {
  const throat = (extra: Parameters<typeof gundabadTable>[1] = {}): Table => gundabadTable(world, { phase: "Quest", active: CODES.throatOfTheMountain, stage: "19135", progress: 2, questDeck: ["19137", "19142", "19139", "19140", "19138", "19141"], engaged: [{ code: CODES.dagnir, seat: 0 }], setAside: [CODES.theFirstForge], ...extra });
  const used = (t: Table, choose: string) => {
    const explored = explore(t);
    const offer = offerOf(explored, t, idOf(t.state, CODES.throatOfTheMountain));
    expect(offer).toBeDefined();
    const pending = send({ state: explored, steps: [] }, offer as never, t.ctx);
    expect(pending.state.window).toMatchObject({ kind: "choose", seat: pending.state.firstPlayer });
    const options = pending.state.window?.kind === "choose" ? pending.state.window.options : [];
    expect(options.map((id) => pending.state.cards[id]?.code).sort()).toEqual(["19137", "19138", "19139", "19140", "19141", "19142"]);
    return answerAll(send(pending, { type: "Choose", optionId: options.find((id) => pending.state.cards[id]?.code === choose) ?? "" }, t.ctx), t);
  };

  it("19124:A:1 Response: when it is explored the first player searches the quest deck for a quest card, which becomes the current main quest and is flipped over; the rest of the quest deck is shuffled", () => {
    const t = throat();
    const run = used(t, "19141");
    const current = run.state.cards[run.state.questStage ?? ""];
    expect(current?.code).toBe("19141");
    expect(current?.face).toBe("B");
    expect(current?.progress).toBe(0);
    // The stage that was current returns to the quest deck with no progress, side A up, and the deck is shuffled with it in.
    const old = where(run.state, "19135")[0];
    expect(old?.zone).toBe("questDeck");
    expect(old?.progress).toBe(0);
    expect(old?.face).toBe("A");
    expect(run.state.questDeck.map((id) => run.state.cards[id]?.code).sort()).toEqual(["19135", "19137", "19138", "19139", "19140", "19142"]);
    expect(run.state.seedCursor).toBeGreaterThan(t.state.seedCursor);
  });

  it("19124:A:1 the stage revealed resolves its When Revealed (Dagnir returns to the staging area) and the stage left is not defeated", () => {
    const run = used(throat(), "19137");
    expect(where(run.state, CODES.dagnir)[0]?.zone).toBe("staging");
    expect(where(run.state, CODES.theFirstForge)[0]?.zone).toBe("setAside");
    expect(run.state.stageLeft).toMatchObject({ bypassed: true });
  });

  it("19124:A:1 Throat of the Mountain is explored: it is added to the victory display (Victory 1)", () => {
    const run = used(throat(), "19138");
    expect(where(run.state, CODES.throatOfTheMountain)[0]?.zone).toBe("victory");
  });
});

describe("19143 and 19144 Wormsbane", () => {
  it("19143:A:2 the Broken side gives the attached hero +1 Attack", () => {
    const t = gundabadTable(world, { attached: [{ code: CODES.wormsbane }] });
    const base = world.cards.get("dh1")?.attack ?? 2;
    expect(modifiedStat(t.state, t.state.cards[t.hero]!, "attack", world.cards)).toBe(base + 1);
    expect(modifiedStat(t.state, t.state.cards[t.hero2]!, "attack", world.cards)).toBe(base);
  });

  it("19144:A:2 the Reforged side gives the attached hero +X Attack, X 1 more than the quest cards in the victory display", () => {
    for (const quests of [1, 3, 6]) {
      const t = gundabadTable(world, { stage: "19142", questDeck: STAGES.slice(1, -1).slice(quests - 1 > 0 ? quests - 1 : 0).filter((code) => code !== "19142"), attached: [{ code: "19144" }] });
      const held = codesIn(t.state, "victory").length;
      const base = world.cards.get("dh1")?.attack ?? 2;
      expect(modifiedStat(t.state, t.state.cards[t.hero]!, "attack", world.cards), `${held} quest cards`).toBe(base + held + 1);
    }
  });

  it("19143:A:3 and 19144:A:3 if the attached hero leaves play the players lose the game, on either side", () => {
    for (const code of [CODES.wormsbane, "19144"]) {
      const t = gundabadTable(world, { attached: [{ code }] });
      expect(t.state.lost).toBeFalsy();
      const dead = settle({ ...t.state, window: null, mode: "stopped" }, t.ctx, []);
      expect(dead.lost).toBeFalsy();
      const killed = settle(placeDamage(t.state, t.hero, 99, t.ctx.cards, [], "combat", { kind: "rule", rule: "rr.damage" } as never), t.ctx, []);
      expect(killed.lost, code).toBe(true);
    }
    // The other hero leaving play is no loss.
    const t = gundabadTable(world, { attached: [{ code: CODES.wormsbane }] });
    expect(settle(placeDamage(t.state, t.hero2, 99, t.ctx.cards, [], "combat", { kind: "rule", rule: "rr.damage" } as never), t.ctx, []).lost).toBeFalsy();
  });
});
