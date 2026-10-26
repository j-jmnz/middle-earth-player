import { describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { RECORDS } from "../../effects/authored/families/defense.ts";

import { holds } from "../conditions.ts";
import { syncConstants } from "../constants.ts";
import { modifiedStat } from "../keywords.ts";
import { definePrinted } from "../printed.ts";
import { resolveQuest } from "../quest.ts";
import { legalIntents } from "../reduce.ts";
import type { ScenarioState } from "../state.ts";
import { ally, enemy, hero, offered, recordsOf, send, table, treachery, until, type TableSpec } from "./defense-table.ts";

// Rules: rr.step-6-2, rr.step-6-4-2, rr.shadow-effects, rr.cancel, rr.combat-phase, rr.step-3-4, rr.modifiers
// (data/rules/entries.json). Shadow cards looked at, discarded, dealt face up or dealt again; when in combat an event may be
// played; enemies that cannot attack; quest progress dealt as damage; Defense read from Willpower; attacking first.

const shade = treachery("shade");
const spite = treachery("spite");
// Shadow: attacking enemy gets +2 Attack.
const spiteShadow: Effect = { id: "spite:shadow:1", cardCode: "spite", lines: ["spite:A:1"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker" }] };
const event = (code: string, sphere: "leadership" | "tactics" | "spirit" | "lore" = "tactics") => definePrinted({ code, name: code, type: "event", sphere, cost: 0 });

function stopped(spec: TableSpec): TableSpec {
  return { ...spec, seatCount: 2, cards: [...spec.cards, hero("stopper"), enemy("brute", { attack: 1 })], heroes: [...spec.heroes, { code: "stopper", seat: 1 }], enemies: [...(spec.enemies ?? []), { code: "brute", seat: 1 }], encounter: [...(spec.encounter ?? []), "shade"] };
}

function toCombat(spec: TableSpec, stop: Parameters<typeof until>[2]) {
  const built = table(spec);
  return { ...built, state: until(send(built.state, { type: "DeclineEngage" }, built.ctx), built.ctx, stop) };
}

const defenseWindow = (state: ScenarioState) => state.window?.kind === "defense";

describe("shadow cards", () => {
  it("lets Dark Knowledge look at a shadow card just dealt to an enemy engaged with its player", () => {
    const knowledge = definePrinted({ code: "01071", name: "Dark Knowledge", type: "attachment", sphere: "lore", cost: 1 });
    const { state, ids, ctx } = toCombat({ cards: [hero("a"), knowledge, enemy("orc"), spite], effects: [...recordsOf(RECORDS, "01071"), spiteShadow], heroes: [{ code: "a" }], attachments: [{ code: "01071", host: "a" }], enemies: [{ code: "orc" }], encounter: ["spite"] }, (_state, legal) => offered(legal, "01071:response:1"));
    const looked = send(state, { type: "Trigger", cardId: ids["01071"]!, effectId: "01071:response:1" }, ctx);
    expect(looked.window).toEqual({ kind: "look", seat: 0, cardIds: [ids["deck:spite"]] });
    expect(looked.cards[ids["deck:spite"]!]?.face).toBe("down");
  });

  it("gives Eldahir +2 Defense when the shadow card it looks at has a shadow effect, and none when it has not", () => {
    for (const [card, defense] of [["spite", 3], ["shade", 1]] as const) {
      const { state, ids, ctx } = toCombat({ cards: [hero("a", { sphere: "lore" }), ally("12031", { sphere: "leadership", defense: 1, keywords: { sentinel: true } }), enemy("orc"), spite, shade], effects: [...recordsOf(RECORDS, "12031"), spiteShadow], heroes: [{ code: "a" }], allies: [{ code: "12031" }], enemies: [{ code: "orc" }], encounter: [card] }, (current, legal) => current.phase === "Combat" && offered(legal, "12031:action:1"));
      const looked = send(state, { type: "Trigger", cardId: ids["12031"]!, effectId: "12031:action:1", payments: [{ heroId: ids.a!, amount: 1 }] }, ctx);
      expect(looked.window?.kind).toBe("look");
      const after = send(looked, { type: "Pass" }, ctx);
      expect(modifiedStat(after, after.cards[ids["12031"]!]!, "defense", ctx.cards)).toBe(defense);
    }
  });

  it("deals shadow cards face up while Silver Lamp's hero is ready", () => {
    const lamp = definePrinted({ code: "07009", name: "Silver Lamp", type: "attachment", sphere: "spirit", cost: 2 });
    for (const [tired, face] of [[false, "up"], [true, "down"]] as const) {
      const built = table({ cards: [hero("a", { sphere: "spirit" }), lamp, enemy("orc"), shade], effects: recordsOf(RECORDS, "07009"), heroes: [{ code: "a" }], attachments: [{ code: "07009", host: "a" }], enemies: [{ code: "orc" }], encounter: ["shade"] });
      const start = tired ? { ...built.state, cards: { ...built.state.cards, [built.ids.a!]: { ...built.state.cards[built.ids.a!]!, exhausted: true } } } : built.state;
      const dealt = until(send(start, { type: "DeclineEngage" }, built.ctx), built.ctx, defenseWindow);
      expect(dealt.cards[built.ids["deck:shade"]!]?.face).toBe(face);
    }
  });

  it("lets Balin cancel a shadow effect and deal the attacking enemy another shadow card, which resolves in its place", () => {
    // The orc is dealt the first spite, the second player's enemy the shade, and Balin deals the orc the second spite.
    const { state, ids, ctx } = toCombat(
      { seatCount: 2, cards: [hero("132002", { sphere: "leadership", defense: 1, health: 9 }), hero("stopper"), enemy("orc", { attack: 3 }), enemy("brute", { attack: 1 }), spite, shade], effects: [...recordsOf(RECORDS, "132002"), spiteShadow], heroes: [{ code: "132002" }, { code: "stopper", seat: 1 }], enemies: [{ code: "orc" }, { code: "brute", seat: 1 }], encounter: ["spite", "shade", "spite"] },
      defenseWindow,
    );
    const balin = ids["132002"]!;
    const pending = send(state, { type: "DeclareDefender", defenderId: balin }, ctx);
    expect(offered(legalIntents(pending, ctx), "132002:response:1")).toBe(true);
    const first = send(pending, { type: "Trigger", cardId: balin, effectId: "132002:response:1", payments: [{ heroId: balin, amount: 1 }] }, ctx);
    // The second shadow card has the same effect; Balin's limit of once per attack leaves it to resolve: 5 Attack, 1 Defense.
    expect(offered(legalIntents(first, ctx), "132002:response:1")).toBe(false);
    expect(first.cards[balin]?.damage).toBe(4);
    expect(first.cards[balin]?.resources).toBe(2);
  });

  it("discards a facedown shadow card when Jubayr exhausts to defend, and when Staff of Lebethron's hero does against a costly enemy", () => {
    const { state, ids, ctx } = toCombat(
      stopped({ cards: [hero("a"), ally("17006", { sphere: "spirit", defense: 3, keywords: { sentinel: true } }), enemy("orc", { attack: 3 }), spite], effects: [...recordsOf(RECORDS, "17006"), spiteShadow], heroes: [{ code: "a" }], allies: [{ code: "17006" }], enemies: [{ code: "orc" }], encounter: ["spite"] }),
      defenseWindow,
    );
    const declared = send(state, { type: "DeclareDefender", defenderId: ids["17006"]! }, ctx);
    // Both players' enemies have a facedown shadow card: Jubayr's player chooses the attacking orc's.
    const asked = send(declared, { type: "Trigger", cardId: ids["17006"]!, effectId: "17006:response:1" }, ctx);
    expect(asked.window).toEqual({ kind: "choose", seat: 0, options: [ids.orc, ids.brute] });
    const discarded = send(asked, { type: "Choose", optionId: ids.orc! }, ctx);
    expect(discarded.cards[ids["deck:spite"]!]?.zone).toBe("encounterDiscard");
    // The spite was discarded before it could add 2 Attack: 3 Attack against 3 Defense.
    expect(discarded.cards[ids["17006"]!]?.damage).toBe(0);

    const staff = definePrinted({ code: "144008", name: "Staff of Lebethron", type: "attachment", sphere: "leadership", cost: 1 });
    const other = toCombat(
      stopped({ cards: [hero("faramir", { traits: ["Gondor"], defense: 3 }), staff, enemy("orc", { attack: 3, engagementCost: 45 }), spite], effects: [...recordsOf(RECORDS, "144008"), spiteShadow], heroes: [{ code: "faramir" }], attachments: [{ code: "144008", host: "faramir" }], enemies: [{ code: "orc" }], encounter: ["spite"] }),
      defenseWindow,
    );
    const staffed = send(send(other.state, { type: "DeclareDefender", defenderId: other.ids.faramir! }, other.ctx), { type: "Trigger", cardId: other.ids["144008"]!, effectId: "144008:response:1" }, other.ctx);
    expect(staffed.cards[other.ids["deck:spite"]!]?.zone).toBe("encounterDiscard");
    expect(staffed.cards[other.ids.faramir!]?.damage).toBe(0);
  });

  it("cancels a shadow effect with Sterner than Steel by exhausting a Weapon on the defender", () => {
    const sword = definePrinted({ code: "sword", name: "Sword", type: "attachment", sphere: "tactics", cost: 1, traits: ["Item", "Weapon"] });
    const { state, ids, ctx } = toCombat(
      stopped({ cards: [hero("a", { defense: 3 }), sword, enemy("orc", { attack: 3 }), event("145008"), spite], effects: [...recordsOf(RECORDS, "145008"), spiteShadow], heroes: [{ code: "a" }], attachments: [{ code: "sword", host: "a" }], hand: [{ code: "145008" }], enemies: [{ code: "orc" }], encounter: ["spite"] }),
      defenseWindow,
    );
    const pending = send(state, { type: "DeclareDefender", defenderId: ids.a! }, ctx);
    const canceled = send(pending, { type: "Trigger", cardId: ids["145008"]!, effectId: "145008:response:1", payments: [] }, ctx);
    expect(canceled.cards[ids.sword!]?.exhausted).toBe(true);
    expect(canceled.cards[ids.a!]?.damage).toBe(0);
  });

  it("answers Tides of Fate before damage when a shadow card raised the enemy's Attack", () => {
    const { state, ids, ctx } = toCombat(
      stopped({ cards: [hero("a", { sphere: "spirit", defense: 2, health: 9 }), enemy("orc", { attack: 3 }), event("12007", "spirit"), spite], effects: [...recordsOf(RECORDS, "12007"), spiteShadow], heroes: [{ code: "a" }], hand: [{ code: "12007" }], enemies: [{ code: "orc" }], encounter: ["spite"] }),
      defenseWindow,
    );
    const raised = send(state, { type: "DeclareDefender", defenderId: ids.a! }, ctx);
    expect(offered(legalIntents(raised, ctx), "12007:response:1")).toBe(true);
    expect(raised.cards[ids.a!]?.damage).toBe(0);
    // 5 Attack against 2 + 3 Defense; nobody has the Tactics resources for the rest.
    const held = send(raised, { type: "Trigger", cardId: ids["12007"]!, effectId: "12007:response:1", payments: [] }, ctx);
    expect(held.cards[ids.a!]?.damage).toBe(0);
  });

  it("readies the defending character with Wind from the Sea's shadow effect", () => {
    const wind = definePrinted({ code: "17144", name: "Wind from the Sea", type: "event", sphere: "neutral" });
    const { state, ids, ctx } = toCombat(stopped({ cards: [hero("a", { defense: 3 }), enemy("orc", { attack: 3 }), wind], effects: recordsOf(RECORDS, "17144"), heroes: [{ code: "a" }], enemies: [{ code: "orc" }], encounter: ["17144"] }), defenseWindow);
    expect(send(state, { type: "DeclareDefender", defenderId: ids.a! }, ctx).cards[ids.a!]?.exhausted).toBe(false);
  });
});

describe("when in combat an event may be played", () => {
  it("reads the combat step: before enemy attacks, after shadows and before any attack resolves, after enemy attacks", () => {
    const built = table({ cards: [hero("a"), enemy("orc")], effects: [], heroes: [{ code: "a" }], enemies: [{ code: "orc" }] });
    const at = (mode: ScenarioState["mode"], resolved: string[] = []) => ({ ...built.state, phase: "Combat" as const, mode, resolvedAttacks: resolved });
    const scope = { actor: 0, sourceId: null, returned: 0 };
    const check = (state: ScenarioState, is: "beforeEnemyAttacks" | "beforeAttacksResolve" | "afterEnemyAttacks") => holds(state, { kind: "combatStep", is }, scope, built.ctx);
    expect(check(at("combatActions"), "beforeEnemyAttacks")).toBe(true);
    expect(check(at("enemyAttacks"), "beforeEnemyAttacks")).toBe(false);
    expect(check(at("combatActions"), "beforeAttacksResolve")).toBe(true);
    expect(check(at("enemyAttacks"), "beforeAttacksResolve")).toBe(true);
    expect(check(at("enemyAttacks", [built.ids.orc!]), "beforeAttacksResolve")).toBe(false);
    expect(check(at("playerAttacks"), "afterEnemyAttacks")).toBe(true);
    expect(check(at("enemyAttacks"), "afterEnemyAttacks")).toBe(false);
    expect(holds(built.state, { kind: "resources", min: 3, sphere: "tactics" }, scope, built.ctx)).toBe(true);
    expect(holds(built.state, { kind: "resources", min: 4, sphere: "tactics", group: true }, scope, built.ctx)).toBe(false);
  });
});

describe("enemies that cannot attack, and other combat effects", () => {
  it("keeps the chosen player's engaged enemies from attacking that player this phase (Thicket of Spears)", () => {
    const { state, ids, ctx } = toCombat({ cards: [hero("a"), enemy("orc"), event("01036"), shade], effects: recordsOf(RECORDS, "01036"), heroes: [{ code: "a" }], hand: [{ code: "01036" }], enemies: [{ code: "orc" }], encounter: ["shade"] }, (current, legal) => current.phase === "Combat" && legal.some((intent) => intent.type === "PlayCard"));
    const played = send(state, { type: "PlayCard", cardId: ids["01036"]!, payments: [] }, ctx);
    const after = until(played, ctx, (current) => current.phase !== "Combat");
    expect(after.cards[ids.a!]?.damage).toBe(0);
    expect(after.resolvedAttacks).toEqual([]);
  });

  it("assigns Ride Them Down's enemy the progress questing would place on the quest, after the active location", () => {
    const built = table({ cards: [hero("a", { willpower: 6 }), enemy("orc", { health: 9 }), definePrinted({ code: "stage", name: "Stage", type: "quest", questPoints: 9 })], effects: recordsOf(RECORDS, "08142"), heroes: [{ code: "a" }], staging: [{ code: "orc" }] });
    let state = syncConstants(built.state, built.ctx);
    state = { ...state, modifiers: [...state.modifiers, { instanceId: built.ids.orc!, sourceId: built.ids.a!, stat: "takesQuestProgress", amount: 1, until: "endOfPhase" }] };
    const committed = { ...state, cards: { ...state.cards, [built.ids.a!]: { ...state.cards[built.ids.a!]!, committed: true } } };
    const quested = resolveQuest(committed, built.ctx.cards, []);
    // 6 Willpower against the orc's 1 Threat: 5 damage instead of 5 progress.
    expect(quested.cards[built.ids.orc!]?.damage).toBe(5);
  });

  it("reads a Spirit character's Defense from its Willpower after Against the Shadow", () => {
    const built = table({ cards: [hero("a", { sphere: "spirit", willpower: 4, defense: 1 }), hero("b", { sphere: "lore", willpower: 4, defense: 1 }), event("06038", "spirit")], effects: recordsOf(RECORDS, "06038"), heroes: [{ code: "a" }, { code: "b" }], hand: [{ code: "06038" }] });
    const planning = { ...built.state, phase: "Planning" as const, mode: "planning" as const, window: { kind: "pass" as const }, planningSeat: 0 };
    const played = send(planning, { type: "PlayCard", cardId: built.ids["06038"]!, payments: [] }, built.ctx);
    expect(modifiedStat(played, played.cards[built.ids.a!]!, "defense", built.ctx.cards)).toBe(4);
    expect(modifiedStat(played, played.cards[built.ids.b!]!, "defense", built.ctx.cards)).toBe(1);
  });

  it("opens Oath of Eorl's player attack window before the first enemy attack", () => {
    const { state, ids, ctx } = toCombat({ cards: [hero("a", { attack: 3 }), enemy("orc", { attack: 1, defense: 0, health: 3 }), event("17085"), shade], effects: recordsOf(RECORDS, "17085"), heroes: [{ code: "a" }], hand: [{ code: "17085" }], enemies: [{ code: "orc" }], encounter: ["shade"] }, (_state, legal) => offered(legal, "17085:response:1"));
    const sworn = send(state, { type: "Trigger", cardId: ids["17085"]!, effectId: "17085:response:1", payments: [] }, ctx);
    const early = until(sworn, ctx, (current) => current.window?.kind === "playerAttack" || current.window?.kind === "defense");
    expect(early.window?.kind).toBe("playerAttack");
    expect(early.mode).toBe("enemyAttacks");
    const struck = send(early, { type: "DeclareAttackers", enemyId: ids.orc!, attackerIds: [ids.a!] }, ctx);
    expect(struck.cards[ids.orc!]?.zone).toBe("encounterDiscard");
  });
});
