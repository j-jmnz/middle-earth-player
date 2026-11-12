import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { holds } from "../../interpret/conditions.ts";
import { attachBlocked, travelBlocked } from "../../interpret/restrictions.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import { heroPays } from "../../player/payments.ts";
import { modifiedStat, placeDamage } from "../../core/keywords.ts";
import { definePrinted } from "../../core/printed.ts";
import { moveCard, spawn } from "../../core/zones.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { eliminateSeat } from "../../core/eliminate.ts";
import { settle } from "../../engine/machine.ts";
import { legalIntents } from "../../engine/reduce.ts";
import { enemy, hero, offered, recordsOf, send, table, treachery, until } from "../defense/table.ts";

// Rules: mec113.setup-the-tower-of-cirith-ungol, mec113.the-fellowship-sphere, rr.lasting-effects, rr.discard-pile-and-victory-display, rr.traits, faq.lasting-effects (data/rules/entries.json); ledger lines 146068:A:1, 146023:A:1, 146019:A:1, 146067:B:1, 146020:A:1, 146014:A:1.
// The Tower of Cirith Ungol's small pieces: a card back from the victory display as its other side, the Threat that follows an enemy's damage, the copy of a picked enemy, the boons a card may carry and the Fellowship sphere a hero is granted.

const focus = { seat: 0, sourceId: null };
const watchersLocation = definePrinted({ code: "watchers-l", name: "The Two Watchers", type: "location", traits: ["Mordor"], isUnique: true });
const watchersEnemy = definePrinted({ code: "watchers-e", name: "The Two Watchers", type: "enemy", traits: ["Mordor"], isUnique: true, attack: 5, defense: 2, health: 4, threat: 2, engagementCost: 50 });
const orc = (code: string, extra = {}) => enemy(code, { name: "Orc of Mordor", traits: ["Orc"], ...extra } as never);

describe("ReturnFromVictory (146068:A:1)", () => {
  function inVictory() {
    const base = table({ cards: [hero("a"), watchersLocation, watchersEnemy], effects: [], heroes: [{ code: "a" }] });
    const spawned = spawn(base.state, "watchers-e", { zone: "staging" });
    const defeated = moveCard(spawned.state, spawned.id, { zone: "victory" });
    return { ...base, state: { ...defeated, cards: { ...defeated.cards, [spawned.id]: { ...defeated.cards[spawned.id]!, damage: 4, exhausted: true } } }, id: spawned.id };
  }

  it("returns the card of the victory display to the staging area as its other side, faceup, ready and undamaged", () => {
    const { state, ctx, id } = inVictory();
    const next = runInstruction(state, { verb: "ReturnFromVictory", code: "watchers-e", into: "watchers-l" }, focus, ctx, []);
    const card = next.cards[id]!;
    expect([card.code, card.other, card.zone, card.face, card.damage, card.exhausted, card.controller]).toEqual(["watchers-l", "watchers-e", "staging", "up", 0, false, null]);
    expect(next.victory).not.toContain(id);
    expect(next.staging).toContain(id);
  });

  it("does nothing when the card is not in the victory display", () => {
    const base = table({ cards: [hero("a"), watchersLocation, watchersEnemy], effects: [], heroes: [{ code: "a" }], staging: [{ code: "watchers-e" }] });
    expect(runInstruction(base.state, { verb: "ReturnFromVictory", code: "watchers-e", into: "watchers-l" }, focus, base.ctx, [])).toBe(base.state);
  });
});

describe("threatPerDamage (146023:A:1)", () => {
  const howls = (code: string): Effect => ({ id: `${code}:whenRevealed:1`, cardCode: code, lines: [`${code}:A:1`], timing: "whenRevealed", instructions: [{ verb: "ModifyStat", stat: "threatPerDamage", amount: 1, until: "endOfPhase", target: "enemies" }] });

  it("adds Threat for each damage on an enemy, read live and for an enemy that arrives later", () => {
    const base = table({ cards: [hero("a"), orc("o1"), orc("o2"), definePrinted({ code: "howls", name: "Orcish Howls", type: "treachery" })], effects: [howls("howls")], heroes: [{ code: "a" }], staging: [{ code: "o1" }] });
    const source = spawn(base.state, "howls", { zone: "encounterDiscard" });
    const laid = runInstruction(source.state, { verb: "ModifyStat", stat: "threatPerDamage", amount: 1, until: "endOfPhase", target: "enemies" }, { seat: 0, sourceId: source.id }, base.ctx, []);
    const o1 = base.ids.o1!;
    expect(modifiedStat(laid, laid.cards[o1]!, "threat", base.ctx.cards)).toBe(1);
    const hit = placeDamage(laid, o1, 3, base.ctx.cards, [], "framework", { kind: "rule", ruleId: "test" } as never);
    expect(modifiedStat(hit, hit.cards[o1]!, "threat", base.ctx.cards)).toBe(4);
    const later = spawn(hit, "o2", { zone: "staging" });
    const harmed = placeDamage(later.state, later.id, 2, base.ctx.cards, [], "framework", { kind: "rule", ruleId: "test" } as never);
    expect(modifiedStat(harmed, harmed.cards[later.id]!, "threat", base.ctx.cards)).toBe(3);
  });

  it("changes no enemy's Threat when the flag is not held", () => {
    const base = table({ cards: [hero("a"), orc("o1")], effects: [], heroes: [{ code: "a" }], staging: [{ code: "o1" }] });
    const hit = placeDamage(base.state, base.ids.o1!, 3, base.ctx.cards, [], "framework", { kind: "rule", ruleId: "test" } as never);
    expect(modifiedStat(hit, hit.cards[base.ids.o1!]!, "threat", base.ctx.cards)).toBe(1);
  });
});

describe("sameTitleAs picked (146019:A:1, 146067:B:1)", () => {
  const copy = { type: "enemy", control: "any", stagingOnly: true, sameTitleAs: "picked" } as const;

  it("finds the copy of the last picked enemy in the staging area, never that card itself", () => {
    const base = table({ cards: [hero("a"), orc("o1"), orc("o2"), enemy("troll", { name: "Troll" } as never)], effects: [], heroes: [{ code: "a" }], staging: [{ code: "o1" }, { code: "troll" }] });
    const discarded = spawn(base.state, "o2", { zone: "encounterDiscard" });
    expect(pickCandidates(discarded.state, copy, 0, [discarded.id], null, base.ctx)).toEqual([base.ids.o1]);
    expect(pickCandidates(discarded.state, copy, 0, [base.ids.o1!], null, base.ctx)).toEqual([]);
    expect(pickCandidates(discarded.state, copy, 0, [base.ids.troll!], null, base.ctx)).toEqual([]);
  });

  it("holds as a condition while a copy is there", () => {
    const base = table({ cards: [hero("a"), orc("o1"), orc("o2")], effects: [], heroes: [{ code: "a" }], staging: [{ code: "o1" }] });
    const discarded = spawn(base.state, "o2", { zone: "encounterDiscard" });
    expect(holds(discarded.state, { kind: "canPick", pick: copy }, { actor: 0, sourceId: null, returned: 0, picked: [discarded.id] }, base.ctx)).toBe(true);
    expect(holds(base.state, { kind: "canPick", pick: copy }, { actor: 0, sourceId: null, returned: 0, picked: [] }, base.ctx)).toBe(false);
  });
});

describe("Restrict attach exceptBoon (146020:A:1)", () => {
  const boon = definePrinted({ code: "sting", name: "Sting", type: "attachment", traits: ["Item"], campaignKind: "boon" });
  const gift = definePrinted({ code: "gift", name: "Gift", type: "attachment", traits: ["Item"] });
  const shagrat: Effect = { id: "shagrat:constant:1", cardCode: "shagrat", lines: ["shagrat:A:1"], timing: "constant", instructions: [{ verb: "Restrict", what: "attach", exceptBoon: true }] };

  it("lets a boon attach and bars every other attachment", () => {
    const base = table({ cards: [hero("a"), enemy("shagrat"), boon, gift], effects: [shagrat], heroes: [{ code: "a" }], staging: [{ code: "shagrat" }] });
    const state = syncConstants(base.state, base.ctx);
    expect(attachBlocked(state, base.ctx, base.ids.shagrat!, "sting")).toBe(false);
    expect(attachBlocked(state, base.ctx, base.ids.shagrat!, "gift")).toBe(true);
  });
});

describe("GrantIcon fellowship (146014:A:1)", () => {
  const company: Effect = { id: "company:constant:1", cardCode: "company", lines: ["company:A:1"], timing: "constant", instructions: [{ verb: "GrantIcon", sphere: "fellowship" }] };

  it("lets the attached hero pay for Fellowship cards", () => {
    const base = table({
      cards: [hero("sam", { sphere: "lore" }), definePrinted({ code: "company", name: "Last of the Company", type: "objective" })],
      effects: [company],
      heroes: [{ code: "sam" }],
      attachments: [{ code: "company", host: "sam" }],
    });
    expect(heroPays(base.state, base.ids.sam!, "fellowship", base.ctx)).toBe(true);
    const bare = table({ cards: [hero("sam", { sphere: "lore" })], effects: [company], heroes: [{ code: "sam" }] });
    expect(heroPays(bare.state, bare.ids.sam!, "fellowship", bare.ctx)).toBe(false);
  });
});

describe("ResolveAttackAgainst (146023:A:2)", () => {
  const other = { type: "enemy", control: "any", engaged: "you", attackingEnemy: false } as const;
  const howls: Effect = {
    id: "howls:shadow:1",
    cardCode: "howls",
    lines: ["howls:A:2"],
    timing: "shadow",
    condition: { kind: "canPick", pick: other },
    instructions: [{ verb: "Pick", pick: other }, { verb: "ResolveAttackAgainst" }],
  };
  const play = (enemies: readonly { code: string }[]) => {
    const built = table({ cards: [hero("a"), enemy("attacker", { attack: 4 }), enemy("victim", { defense: 1, health: 9 }), treachery("howls")], effects: [howls], heroes: [{ code: "a" }], enemies, encounter: ["howls"] });
    const declined = send(built.state, { type: "DeclineEngage" }, built.ctx);
    const chosen = declined.window?.kind === "chooseEnemy" ? send(declined, { type: "ChooseEnemy", enemyId: built.ids.attacker! }, built.ctx) : declined;
    const defense = until(chosen, built.ctx, (state) => state.window?.kind === "defense");
    const after = until(send(defense, { type: "Undefended", heroId: built.ids.a! }, built.ctx), built.ctx, (state) => state.pendingAttack == null);
    return { after, ids: built.ids };
  };

  it("resolves the attack against the player's other engaged enemy: it takes the damage after its Defense and no hero is hurt", () => {
    const { after, ids } = play([{ code: "attacker" }, { code: "victim" }]);
    expect(after.cards[ids.a!]?.damage).toBe(0);
    expect(after.cards[ids.victim!]?.damage).toBe(3);
  });

  it("changes nothing when the player is engaged with no other enemy", () => {
    const { after, ids } = play([{ code: "attacker" }]);
    expect(after.cards[ids.a!]?.damage).toBe(4);
  });
});

describe("Last of the Company's action (146014:A:2)", () => {
  const records = recordsOf(EFFECTS, "146014");
  const company = definePrinted({ code: "146014", name: "Last of the Company", type: "objective" });
  const ring = definePrinted({ code: "146065", name: "The One Ring", type: "objective" });
  const act = () => {
    const built = table({
      cards: [hero("sam", { willpower: 3 }), company, ring, orc("o1"), enemy("watchers", { keywords: { immuneToPlayerCardEffects: true } })],
      effects: records,
      heroes: [{ code: "sam" }],
      attachments: [{ code: "146014", host: "sam" }, { code: "146065", host: "sam" }],
      staging: [{ code: "o1" }],
    });
    const state = built.state;
    return { ...built, state };
  };

  it("exhausts The One Ring, raises the actor's threat by 1 and gives the enemy -X Threat, X the attached hero's Willpower, until the end of the phase", () => {
    const { state, ids, ctx } = act();
    const at = until(state, ctx, (_current, legal) => offered(legal, "146014:action:1"));
    expect(offered(legalIntents(at, ctx), "146014:action:1")).toBe(true);
    const used = until(send(at, { type: "Trigger", cardId: ids["146014"]!, effectId: "146014:action:1", payments: [] }, ctx), ctx, (current) => current.stack.length === 0 && current.window?.kind !== "choose");
    expect(used.cards[ids["146065"]!]?.exhausted).toBe(true);
    expect(used.seats[0].threat).toBe(at.seats[0].threat + 1);
    expect(modifiedStat(used, used.cards[ids.o1!]!, "threat", ctx.cards)).toBe(0);
  });

  it("is not offered while The One Ring is exhausted", () => {
    const { state, ids, ctx } = act();
    const at = until(state, ctx, (_current, legal) => offered(legal, "146014:action:1"));
    const tired = { ...at, cards: { ...at.cards, [ids["146065"]!]: { ...at.cards[ids["146065"]!]!, exhausted: true } } };
    expect(offered(legalIntents(tired, ctx), "146014:action:1")).toBe(false);
  });
});

describe("The Two Watchers' enemy side in the staging area (146066:B:2, 146071:A:2)", () => {
  const records = recordsOf(EFFECTS, "146066", "146071");
  const stage = definePrinted({ code: "146066", name: "Pass the Two Watchers", type: "quest", questPoints: 0 });
  const watchers = definePrinted({ code: "146071", name: "The Two Watchers", type: "enemy", traits: ["Mordor"], isUnique: true, attack: 5, defense: 2, health: 4, threat: 2, engagementCost: 50, keywords: { immuneToPlayerCardEffects: true } });

  function attacked() {
    const built = table({ cards: [hero("a"), stage, watchers, treachery("shade")], effects: records, heroes: [{ code: "a" }], staging: [{ code: "146071" }], encounter: ["shade"] });
    const state = syncConstants(spawn(built.state, "146066", { zone: "questStage" }).state, built.ctx);
    const defense = until(send(state, { type: "DeclineEngage" }, built.ctx), built.ctx, (current) => current.window?.kind === "defense");
    const before = defense.seats[0].threat;
    const after = until(send(defense, { type: "Undefended", heroId: built.ids.a! }, built.ctx), built.ctx, (current) => current.pendingAttack == null);
    return { defense, after, before, ids: built.ids };
  }

  it("attacks the players from the staging area and its damage is canceled for threat, though nothing engaged it", () => {
    const { defense, after, before, ids } = attacked();
    expect(defense.pendingAttack?.enemyId).toBe(ids["146071"]);
    expect(after.cards[ids.a!]?.damage).toBe(0);
    expect(after.seats[0].threat).toBe(before + 5);
    expect(after.cards[ids["146071"]!]?.zone).toBe("staging");
  });
});

describe("a location that cannot leave the staging area (146066:B:1)", () => {
  const stage = definePrinted({ code: "146066", name: "Pass the Two Watchers", type: "quest", questPoints: 0 });
  const place = (code: string, isUnique: boolean) => definePrinted({ code, name: code, type: "location", threat: 2, questPoints: 3, isUnique });

  it("is not offered for travel, and gets -1 Threat, while a unique location is", () => {
    const built = table({ cards: [hero("a"), stage, place("passage", false), place("chamber", true)], effects: recordsOf(EFFECTS, "146066"), heroes: [{ code: "a" }], staging: [{ code: "passage" }, { code: "chamber" }] });
    const state = syncConstants(spawn(built.state, "146066", { zone: "questStage" }).state, built.ctx);
    expect(travelBlocked(state, built.ctx, built.ids.passage!)).toBe(true);
    expect(travelBlocked(state, built.ctx, built.ids.chamber!)).toBe(false);
    expect(modifiedStat(state, state.cards[built.ids.passage!]!, "threat", built.ctx.cards)).toBe(1);
    expect(modifiedStat(state, state.cards[built.ids.chamber!]!, "threat", built.ctx.cards)).toBe(2);
  });
});

describe("Bloodied Courtyard hears an enemy sent back to the staging area when its player is eliminated (146017:A:1)", () => {
  const courtyard = definePrinted({ code: "146017", name: "Bloodied Courtyard", type: "location", threat: 2, questPoints: 3 });
  const twoHanded = (withCourtyard: boolean) => {
    const built = table({ seatCount: 2, cards: [hero("a"), hero("b"), orc("o1", { health: 6 }), courtyard], effects: withCourtyard ? recordsOf(EFFECTS, "146017") : [], heroes: [{ code: "a" }, { code: "b", seat: 1 }], enemies: [{ code: "o1", seat: 1 }] });
    const active = spawn(built.state, "146017", { zone: "activeLocation" });
    return { ...built, state: { ...active.state, activeLocation: active.id } };
  };

  it("deals the enemy 1 damage as it returns to the staging area", () => {
    const { state, ctx, ids } = twoHanded(true);
    const after = settle(eliminateSeat(state, 1, []), ctx, []);
    expect(after.cards[ids.o1!]?.zone).toBe("staging");
    expect(after.cards[ids.o1!]?.damage).toBe(1);
  });

  it("queues nothing in a game without the record: the enemy returns undamaged", () => {
    const { state, ctx, ids } = twoHanded(false);
    const after = settle(eliminateSeat(state, 1, []), ctx, []);
    expect(after.cards[ids.o1!]?.zone).toBe("staging");
    expect(after.cards[ids.o1!]?.damage).toBe(0);
  });
});
