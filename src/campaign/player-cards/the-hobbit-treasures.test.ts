// Rules: hob.treasure-ohauh, hob.treasure-otd, hob.baggins-sphere-ohauh, hob.baggins-sphere-otd, rr.attachment-cards, rr.restricted, rr.ranged, rr.response, rr.action, rr.cancel, rr.defending-player (data/rules/entries.json).
// The nine treasure cards of The Hobbit's two boxes, written from their printed lines (data/printed/the-hobbit.json): Sting 131020:A:1 to A:3, Orcrist 131021:A:1 to A:3, Glamdring 131022:A:1 to A:3,
// Bilbo's Magic Ring 132019:A:1 to A:3, The Arkenstone 132020:A:1 and A:2, Mithril Shirt 132021:A:1 and A:2, Thrór's Battle Axe 132022:A:1 to A:3, Thrór's Hunting Bow 132023:A:1 to A:3 and Thrór's
// Golden Cup 132024:A:1 and A:2. A treasure is played from the hand like an attachment (the briefing adds it to a deck at the Setup). The two Baggins events are in the misc family's saga test.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted, type PrintedCard } from "../../rules/core/printed.ts";
import { modifiedStat } from "../../rules/core/keywords.ts";
import { updateCard, type ScenarioState } from "../../rules/core/state.ts";
import { attachTo } from "../../rules/core/zones.ts";
import { legalIntents, legalTargets, reduce } from "../../rules/engine/reduce.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { table as attackTable } from "../../rules/families/attack/fixture.ts";
import { enemy, hero, offered, send as defend, table as defenseTable, until } from "../../rules/families/defense/table.ts";
import { PLAY_CARDS, put, run, seat, triggers } from "../../rules/families/play/fixture.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";

const BILBO_OHAUH = "131001";
const BILBO_OTD = "132001";
const STING = "131020";
const ORCRIST = "131021";
const GLAMDRING = "131022";
const RING = "132019";
const ARKENSTONE = "132020";
const MITHRIL = "132021";
const AXE = "132022";
const BOW = "132023";
const CUP = "132024";

let real: ReadonlyMap<string, PrintedCard>;
beforeAll(async () => {
  real = await loadPrinted([BILBO_OHAUH, BILBO_OTD, STING, ORCRIST, GLAMDRING, RING, ARKENSTONE, MITHRIL, AXE, BOW, CUP]);
});

// A hero, an ally and enemies with the numbers a test reads; "rohan" and "dwarf" (the play fixture's heroes) are neither Bilbo nor Gandalf.
const gandalf = () => definePrinted({ code: "gandalf-ally", name: "Gandalf", type: "ally", sphere: "neutral", cost: 5, willpower: 4, attack: 4, defense: 4, health: 4, traits: ["Istari"], isUnique: true });
const helper = () => definePrinted({ code: "plain-ally", name: "Plain Ally", type: "ally", sphere: "leadership", cost: 2, willpower: 1, attack: 1, defense: 1, health: 2 });
const tactics = () => definePrinted({ code: "tactics-ally", name: "Tactics Ally", type: "ally", sphere: "tactics", cost: 2, willpower: 1, attack: 1, defense: 1, health: 2 });
const orc = () => definePrinted({ code: "orcling", name: "Orcling", type: "enemy", threat: 1, engagementCost: 30, attack: 1, defense: 0, health: 1, traits: ["Orc"] });
const troll = () => definePrinted({ code: "stonetroll", name: "Stone Troll", type: "enemy", threat: 3, engagementCost: 40, attack: 4, defense: 0, health: 9, traits: ["Troll"] });
const warrior = () => definePrinted({ code: "warrior", name: "Warrior", type: "hero", sphere: "tactics", threat: 10, willpower: 1, attack: 3, defense: 1, health: 5, traits: ["Warrior"] });

// The play fixture's cards with the real treasures and Bilbo: a table of seats in the planning phase.
const world = (effects: readonly Effect[]) => ({ effects, cards: new Map<string, PrintedCard>([...PLAY_CARDS, ...real, ...[gandalf(), helper(), tactics(), orc(), troll(), warrior()].map((card) => [card.code, card] as const)]) });
// An intent the engine must accept: a refusal fails the expectation (the line check of lineSpec tells it from an error in the test).
type Ctx = { effects: readonly Effect[]; cards: ReadonlyMap<string, PrintedCard> };
function accept(state: ScenarioState, intent: Parameters<typeof reduce>[1], ctx: Ctx): ScenarioState {
  const result = reduce(state, intent, ctx);
  expect(result.ok, result.ok ? "" : result.reason).toBe(true);
  return result.ok ? result.state : state;
}
const fire = (state: ScenarioState, cardId: string, effectId: string, ctx: Ctx): ScenarioState => accept(state, { type: "Trigger", cardId, effectId }, ctx);
const hostsOf = (state: ScenarioState, cardId: string, ctx: Ctx) => [...legalTargets(state, { type: "PlayCard", cardId }, ctx)].sort();

describe("131020:A:1 to A:3 Sting", () => {
  lineSpec("131020:A:1", "goes on Bilbo Baggins and no other hero or ally, and is played from the hand onto him", (effects) => {
    const ctx = world(effects);
    const table = seat(1, [BILBO_OHAUH, "rohan"]);
    const [bilbo] = table.heroes;
    const ally = put(table.state, "plain-ally", "play");
    const sting = put(ally.state, STING, "hand");
    expect(hostsOf(sting.state, sting.id, ctx)).toEqual([bilbo]);
    const played = accept(sting.state, { type: "PlayCard", cardId: sting.id, payments: [], hostId: bilbo ?? "" }, ctx);
    expect(played.cards[sting.id]?.host).toBe(bilbo);
    expect(played.cards[sting.id]?.zone).not.toBe("hand");
  });

  lineSpec("131020:A:2", "gives Bilbo +1 Willpower, +1 Attack and +1 Defense", (effects) => {
    const ctx = world(effects);
    const table = seat(1, [BILBO_OHAUH]);
    const bilbo = table.heroes[0] ?? "";
    const sting = put(table.state, STING, "play");
    const state = syncConstants(attachTo(sting.state, sting.id, bilbo), ctx);
    const base = ctx.cards.get(BILBO_OHAUH);
    for (const stat of ["willpower", "attack", "defense"] as const) expect(modifiedStat(state, state.cards[bilbo]!, stat, ctx.cards)).toBe((base?.[stat] ?? 0) + 1);
  });

  // Bilbo defends an orc that attacks for 3: he exhausts to defend, the top card of the encounter deck (a Stone Troll, Threat 3) is discarded and the orc takes 3 damage. The first card is the shadow card the orc is dealt.
  const scene = (effects: readonly Effect[], defender: string) => {
    const built = defenseTable({
      cards: [hero(BILBO_OHAUH, { sphere: "baggins", defense: 1, health: 3, traits: ["Hobbit"] }), hero("other-hero"), real.get(STING)!, enemy("orc", { attack: 3, defense: 1, health: 6, threat: 1 }), enemy("stonetroll", { threat: 3 }), definePrinted({ code: "mist", name: "Mist", type: "treachery" })],
      effects,
      heroes: [{ code: BILBO_OHAUH }, { code: "other-hero" }],
      attachments: [{ code: STING, host: BILBO_OHAUH }],
      enemies: [{ code: "orc" }],
      encounter: ["mist", "stonetroll"],
    });
    const defending = until(defend(built.state, { type: "DeclineEngage" }, built.ctx), built.ctx, (current) => current.window?.kind === "defense");
    return { built, defended: defend(defending, { type: "DeclareDefender", defenderId: built.ids[defender]! }, built.ctx) };
  };

  lineSpec("131020:A:3", "after Bilbo exhausts to defend, discards the top card of the encounter deck and deals its Threat to the attacker", (effects) => {
    const { built, defended } = scene(effects, BILBO_OHAUH);
    expect(offered(legalIntents(defended, built.ctx), "131020:response:1")).toBe(true);
    const used = defend(defended, { type: "Trigger", cardId: built.ids[STING]!, effectId: "131020:response:1" }, built.ctx);
    const troll = Object.values(used.cards).find((card) => card.code === "stonetroll");
    expect(troll?.zone).toBe("encounterDiscard");
    expect(used.cards[built.ids.orc!]?.damage).toBe(3);
  });

  it("131020:A:3 is not offered when another hero defends", () => {
    const { built, defended } = scene(EFFECTS, "other-hero");
    expect(offered(legalIntents(defended, built.ctx), "131020:response:1")).toBe(false);
  });
});

describe("131021:A:1 to A:3 Orcrist", () => {
  lineSpec("131021:A:1", "goes on a hero, not on an ally", (effects) => {
    const ctx = world(effects);
    const table = seat(1, ["rohan", BILBO_OHAUH]);
    const ally = put(table.state, "plain-ally", "play");
    const orcrist = put(ally.state, ORCRIST, "hand");
    expect(hostsOf(orcrist.state, orcrist.id, ctx)).toEqual([...table.heroes].sort());
  });

  lineSpec("131021:A:2", "gives the attached hero +2 Attack", (effects) => {
    const ctx = world(effects);
    const table = seat(1, ["rohan"]);
    const hostId = table.heroes[0] ?? "";
    const orcrist = put(table.state, ORCRIST, "play");
    const state = syncConstants(attachTo(orcrist.state, orcrist.id, hostId), ctx);
    expect(modifiedStat(state, state.cards[hostId]!, "attack", ctx.cards)).toBe((ctx.cards.get("rohan")?.attack ?? 0) + 2);
  });

  // The warrior destroys the orcling, a 1 hit point Orc; the Troll is no Orc.
  const attacked = (effects: readonly Effect[], bilbo = false) => {
    const t = attackTable(
      [{ code: bilbo ? BILBO_OHAUH : "warrior", at: { zone: "heroes", seat: 0 }, as: "host" }, { code: "orcling", at: { zone: "engaged", seat: 0 } }, { code: ORCRIST, at: { zone: "play", seat: 0 } }],
      effects,
      [...real.values(), warrior(), orc(), troll()],
    );
    const state = syncConstants(attachTo(t.state, t.ids[ORCRIST]!, t.ids.host!), t.ctx);
    return { t, declared: accept(state, { type: "DeclareAttackers", enemyId: t.ids.orcling!, attackerIds: [t.ids.host!] }, t.ctx) };
  };

  lineSpec("131021:A:3", "after the attached hero destroys an Orc, adds 1 resource to that hero's pool", (effects) => {
    const { t, declared } = attacked(effects);
    expect(declared.cards[t.ids.orcling!]?.zone).toBe("encounterDiscard");
    const used = accept(declared, { type: "Trigger", cardId: t.ids[ORCRIST]!, effectId: "131021:response:1" }, t.ctx);
    expect(used.cards[t.ids.host!]?.resources).toBe(1);
  });

  it("131021:A:3 is not offered when the enemy destroyed is no Orc", () => {
    const t = attackTable([{ code: "warrior", at: { zone: "heroes", seat: 0 }, as: "host" }, { code: "stonetroll", at: { zone: "engaged", seat: 0 } }, { code: ORCRIST, at: { zone: "play", seat: 0 } }], EFFECTS, [...real.values(), warrior(), troll()]);
    const state = attachTo({ ...t.state, cards: { ...t.state.cards, [t.ids.stonetroll!]: { ...t.state.cards[t.ids.stonetroll!]!, damage: 8 } } }, t.ids[ORCRIST]!, t.ids.host!);
    const declared = accept(syncConstants(state, t.ctx), { type: "DeclareAttackers", enemyId: t.ids.stonetroll!, attackerIds: [t.ids.host!] }, t.ctx);
    expect(declared.cards[t.ids.stonetroll!]?.zone).toBe("encounterDiscard");
    expect(triggers(declared, t.ctx, "131021:response:1")).toEqual([]);
  });

  // Bilbo of the Over Hill and Under Hill box "cannot gain resources from player card effects", and a treasure is a player card: the card wins over the box's wish for his own treasures (hob.baggins-sphere-ohauh).
  it("131021:A:3 adds no resource to Bilbo Baggins of the Over Hill and Under Hill box (131001:A:2)", () => {
    const { t, declared } = attacked(EFFECTS, true);
    const used = accept(declared, { type: "Trigger", cardId: t.ids[ORCRIST]!, effectId: "131021:response:1" }, t.ctx);
    expect(used.cards[t.ids.host!]?.resources).toBe(0);
  });
});

describe("131022:A:1 to A:3 Glamdring", () => {
  lineSpec("131022:A:1", "goes on a hero or on Gandalf, and on no other ally", (effects) => {
    const ctx = world(effects);
    const table = seat(1, ["rohan"]);
    const wizard = put(table.state, "gandalf-ally", "play");
    const ally = put(wizard.state, "plain-ally", "play");
    const glamdring = put(ally.state, GLAMDRING, "hand");
    expect(hostsOf(glamdring.state, glamdring.id, ctx)).toEqual([...table.heroes, wizard.id].sort());
  });

  lineSpec("131022:A:2", "gives the attached character +2 Attack", (effects) => {
    const ctx = world(effects);
    const table = seat(1, ["rohan"]);
    const wizard = put(table.state, "gandalf-ally", "play");
    const glamdring = put(wizard.state, GLAMDRING, "play");
    const state = syncConstants(attachTo(glamdring.state, glamdring.id, wizard.id), ctx);
    expect(modifiedStat(state, state.cards[wizard.id]!, "attack", ctx.cards)).toBe(4 + 2);
  });

  // Gandalf (an ally) carries Glamdring and destroys the orcling: "attached character", so any character draws, and a card is drawn from the deck.
  lineSpec("131022:A:3", "after the attached character destroys an Orc, draws 1 card", (effects) => {
    const t = attackTable(
      [{ code: "gandalf-ally", at: { zone: "play", seat: 0 }, as: "host" }, { code: "warrior", at: { zone: "heroes", seat: 0 } }, { code: "orcling", at: { zone: "engaged", seat: 0 } }, { code: GLAMDRING, at: { zone: "play", seat: 0 } }, { code: "event", at: { zone: "deck", seat: 0 } }],
      effects,
      [...real.values(), gandalf(), warrior(), orc()],
    );
    const state = syncConstants(attachTo(t.state, t.ids[GLAMDRING]!, t.ids.host!), t.ctx);
    const declared = accept(state, { type: "DeclareAttackers", enemyId: t.ids.orcling!, attackerIds: [t.ids.host!] }, t.ctx);
    const used = accept(declared, { type: "Trigger", cardId: t.ids[GLAMDRING]!, effectId: "131022:response:1" }, t.ctx);
    expect(used.seats[0]?.hand).toContain(t.ids.event);
  });
});

describe("132019:A:1 to A:3 Bilbo's Magic Ring", () => {
  lineSpec("132019:A:1", "goes on Bilbo Baggins and on no other hero", (effects) => {
    const ctx = world(effects);
    const table = seat(1, [BILBO_OTD, "rohan"]);
    const ring = put(table.state, RING, "hand");
    expect(hostsOf(ring.state, ring.id, ctx)).toEqual([table.heroes[0]]);
  });

  // The Ring is a treasure, so Bilbo of the On the Doorstep box gains the resource from it ("cannot gain resources from non-treasure cards", 132001:A:1). Once per round: with the Ring readied, a second use is not offered.
  lineSpec("132019:A:2", "exhausts the Ring and raises the threat by 1 to give Bilbo a Baggins resource, once per round", (effects) => {
    const ctx = world(effects);
    const table = seat(1, [BILBO_OTD, "rohan"]);
    const bilbo = table.heroes[0] ?? "";
    const ring = put(table.state, RING, "play");
    const synced = syncConstants(attachTo(ring.state, ring.id, bilbo), ctx);
    const threat = synced.seats[0]?.threat ?? 0;
    const used = fire(synced, ring.id, "132019:action:1", ctx);
    expect(used.cards[bilbo]?.resources).toBe(6);
    expect(used.seats[0]?.threat).toBe(threat + 1);
    expect(used.cards[ring.id]?.exhausted).toBe(true);
    const readied = updateCard(used, ring.id, { exhausted: false });
    expect(triggers(readied, ctx, "132019:action:1")).toEqual([]);
  });

  // The Stone Troll-like orc attacks for 3 against Bilbo's Defense 1: he takes 2. With the Ring used after he exhausts to defend, the attack deals no damage and the player's threat rises by 3.
  const scene = (effects: readonly Effect[]) => {
    const built = defenseTable({
      cards: [hero(BILBO_OTD, { sphere: "baggins", defense: 1, health: 3, traits: ["Hobbit"] }), real.get(RING)!, enemy("orc", { attack: 3, defense: 1, health: 6, threat: 1 })],
      effects,
      heroes: [{ code: BILBO_OTD }],
      attachments: [{ code: RING, host: BILBO_OTD }],
      enemies: [{ code: "orc" }],
    });
    const defending = until(defend(built.state, { type: "DeclineEngage" }, built.ctx), built.ctx, (current) => current.window?.kind === "defense");
    return { built, defended: defend(defending, { type: "DeclareDefender", defenderId: built.ids[BILBO_OTD]! }, built.ctx) };
  };

  lineSpec("132019:A:3", "after Bilbo exhausts to defend, exhausts the Ring and raises the threat by 3 to cancel all the damage of the attack", (effects) => {
    const { built, defended } = scene(effects);
    const bilbo = built.ids[BILBO_OTD]!;
    const threat = defended.seats[0]?.threat ?? 0;
    expect(offered(legalIntents(defended, built.ctx), "132019:response:1")).toBe(true);
    // Passing instead, the orc deals 3 - 1 = 2 damage.
    const passed = until(defend(defended, { type: "Pass" }, built.ctx), built.ctx, (current) => (current.cards[bilbo]?.damage ?? 0) > 0);
    expect(passed.cards[bilbo]?.damage).toBe(2);
    const used = defend(defended, { type: "Trigger", cardId: built.ids[RING]!, effectId: "132019:response:1" }, built.ctx);
    expect(used.cards[built.ids[RING]!]?.exhausted).toBe(true);
    expect(used.seats[0]?.threat).toBe(threat + 3);
    const done = until(used, built.ctx, (current) => current.window?.kind === "defense" || (current.cards[bilbo]?.damage ?? 0) > 0 || current.round > 1);
    expect(done.cards[bilbo]?.damage).toBe(0);
  });
});

describe("132020:A:1 and A:2 The Arkenstone", () => {
  lineSpec("132020:A:1", "goes on a hero, not on an ally", (effects) => {
    const ctx = world(effects);
    const table = seat(1, ["rohan", "dwarf"]);
    const ally = put(table.state, "plain-ally", "play");
    const stone = put(ally.state, ARKENSTONE, "hand");
    expect(hostsOf(stone.state, stone.id, ctx)).toEqual([...table.heroes].sort());
  });

  // "Dain" (the play fixture's leadership hero) carries the stone: X is chosen, the threat rises by X and the next leadership ally costs X less this phase; a tactics ally is not cheaper.
  lineSpec("132020:A:2", "exhausts the stone, raises the threat by X and lowers by X the cost of the next ally of the attached hero's sphere this phase", (effects) => {
    const ctx = world(effects);
    const table = seat(1, ["dwarf"]);
    const dain = table.heroes[0] ?? "";
    const stone = put(table.state, ARKENSTONE, "play");
    const ally = put(stone.state, "plain-ally", "hand");
    const other = put(ally.state, "tactics-ally", "hand");
    const synced = syncConstants(attachTo(other.state, stone.id, dain), ctx);
    const threat = synced.seats[0]?.threat ?? 0;
    let state = fire(synced, stone.id, "132020:action:1", ctx);
    expect(state.window?.kind).toBe("choose");
    state = accept(state, { type: "Choose", optionId: "x2" }, ctx);
    state = run(state, ctx);
    expect(state.seats[0]?.threat).toBe(threat + 2);
    expect(state.cards[stone.id]?.exhausted).toBe(true);
    // The leadership ally (cost 2) is played for nothing; the tactics ally still costs 2.
    const played = accept(state, { type: "PlayCard", cardId: ally.id, payments: [] }, ctx);
    expect(played.cards[ally.id]?.zone).toBe("play");
    const refused = reduce(state, { type: "PlayCard", cardId: other.id, payments: [] }, ctx);
    expect(refused.ok).toBe(false);
  });
});

describe("132021:A:1 and A:2 Mithril Shirt", () => {
  lineSpec("132021:A:1", "goes on Bilbo Baggins and on no other hero", (effects) => {
    const ctx = world(effects);
    const table = seat(1, [BILBO_OTD, "rohan"]);
    const shirt = put(table.state, MITHRIL, "hand");
    expect(hostsOf(shirt.state, shirt.id, ctx)).toEqual([table.heroes[0]]);
  });

  lineSpec("132021:A:2", "gives the attached hero +1 Defense and +1 hit point", (effects) => {
    const ctx = world(effects);
    const table = seat(1, [BILBO_OTD]);
    const bilbo = table.heroes[0] ?? "";
    const shirt = put(table.state, MITHRIL, "play");
    const state = syncConstants(attachTo(shirt.state, shirt.id, bilbo), ctx);
    const base = ctx.cards.get(BILBO_OTD);
    expect(modifiedStat(state, state.cards[bilbo]!, "defense", ctx.cards)).toBe((base?.defense ?? 0) + 1);
    expect(modifiedStat(state, state.cards[bilbo]!, "hitPoints", ctx.cards)).toBe((base?.health ?? 0) + 1);
  });
});

describe("132022:A:1 to A:3 Thrór's Battle Axe", () => {
  lineSpec("132022:A:1", "goes on a hero, not on an ally", (effects) => {
    const ctx = world(effects);
    const table = seat(1, ["rohan", "dwarf"]);
    const ally = put(table.state, "plain-ally", "play");
    const axe = put(ally.state, AXE, "hand");
    expect(hostsOf(axe.state, axe.id, ctx)).toEqual([...table.heroes].sort());
  });

  lineSpec("132022:A:2", "gives the attached hero +2 Attack", (effects) => {
    const ctx = world(effects);
    const table = seat(1, ["rohan"]);
    const hostId = table.heroes[0] ?? "";
    const axe = put(table.state, AXE, "play");
    const state = syncConstants(attachTo(axe.state, axe.id, hostId), ctx);
    expect(modifiedStat(state, state.cards[hostId]!, "attack", ctx.cards)).toBe((ctx.cards.get("rohan")?.attack ?? 0) + 2);
  });

  // The warrior destroys one orcling; the other, engaged with the same player, takes 1 damage. With no other enemy engaged, the Response is not offered.
  lineSpec("132022:A:3", "after the attached hero attacks and destroys an enemy, deals 1 damage to another enemy engaged with you", (effects) => {
    const t = attackTable(
      [{ code: "warrior", at: { zone: "heroes", seat: 0 }, as: "host" }, { code: "orcling", at: { zone: "engaged", seat: 0 }, as: "first" }, { code: "stonetroll", at: { zone: "engaged", seat: 0 }, as: "second" }, { code: AXE, at: { zone: "play", seat: 0 } }],
      effects,
      [...real.values(), warrior(), orc(), troll()],
    );
    const state = syncConstants(attachTo(t.state, t.ids[AXE]!, t.ids.host!), t.ctx);
    const declared = accept(state, { type: "DeclareAttackers", enemyId: t.ids.first!, attackerIds: [t.ids.host!] }, t.ctx);
    expect(declared.cards[t.ids.first!]?.zone).toBe("encounterDiscard");
    const used = accept(declared, { type: "Trigger", cardId: t.ids[AXE]!, effectId: "132022:response:1" }, t.ctx);
    expect(used.cards[t.ids.second!]?.damage).toBe(1);
  });

  it("132022:A:3 is not offered when no other enemy is engaged with you", () => {
    const t = attackTable([{ code: "warrior", at: { zone: "heroes", seat: 0 }, as: "host" }, { code: "orcling", at: { zone: "engaged", seat: 0 }, as: "only" }, { code: AXE, at: { zone: "play", seat: 0 } }], EFFECTS, [...real.values(), warrior(), orc()]);
    const state = syncConstants(attachTo(t.state, t.ids[AXE]!, t.ids.host!), t.ctx);
    const declared = accept(state, { type: "DeclareAttackers", enemyId: t.ids.only!, attackerIds: [t.ids.host!] }, t.ctx);
    expect(triggers(declared, t.ctx, "132022:response:1")).toEqual([]);
  });
});

describe("132023:A:1 to A:3 Thrór's Hunting Bow", () => {
  lineSpec("132023:A:1", "goes on a hero, not on an ally", (effects) => {
    const ctx = world(effects);
    const table = seat(1, ["rohan", "dwarf"]);
    const ally = put(table.state, "plain-ally", "play");
    const bow = put(ally.state, BOW, "hand");
    expect(hostsOf(bow.state, bow.id, ctx)).toEqual([...table.heroes].sort());
  });

  // Two seats: the warrior holds the Bow and may attack the enemy engaged with the other player, which a hero with no Ranged cannot.
  const ranged = (effects: readonly Effect[], bow: boolean) => {
    const t = attackTable(
      [{ code: "warrior", at: { zone: "heroes", seat: 0 }, as: "host" }, { code: "aragorn", at: { zone: "heroes", seat: 1 } }, { code: "stonetroll", at: { zone: "engaged", seat: 1 } }, { code: "orcling", at: { zone: "engaged", seat: 0 } }, { code: BOW, at: { zone: "play", seat: 0 } }],
      effects,
      [...real.values(), warrior(), orc(), troll()],
      2,
    );
    return { t, state: syncConstants(bow ? attachTo(t.state, t.ids[BOW]!, t.ids.host!) : t.state, t.ctx) };
  };

  lineSpec("132023:A:2", "makes the attached hero able to attack an enemy engaged with another player", (effects) => {
    const { t, state } = ranged(effects, true);
    const declared = accept(state, { type: "DeclareAttackers", enemyId: t.ids.stonetroll!, attackerIds: [t.ids.host!] }, t.ctx);
    expect(declared.cards[t.ids.stonetroll!]?.damage).toBeGreaterThan(0);
  });

  it("132023:A:2 the hero without the Bow cannot attack that enemy", () => {
    const { t, state } = ranged(EFFECTS, false);
    expect(reduce(state, { type: "DeclareAttackers", enemyId: t.ids.stonetroll!, attackerIds: [t.ids.host!] }, t.ctx).ok).toBe(false);
  });

  // Attack 3 + 2 on a ranged attack against the Stone Troll (Defense 0); +0 on an attack against an enemy engaged with the hero's own player.
  lineSpec("132023:A:3", "gives the attached hero +2 Attack when making a ranged attack, and not otherwise", (effects) => {
    const rangedHit = ranged(effects, true);
    const far = accept(rangedHit.state, { type: "DeclareAttackers", enemyId: rangedHit.t.ids.stonetroll!, attackerIds: [rangedHit.t.ids.host!] }, rangedHit.t.ctx);
    expect(far.cards[rangedHit.t.ids.stonetroll!]?.damage).toBe(3 + 2);
    const near = ranged(effects, true);
    const close = accept(near.state, { type: "DeclareAttackers", enemyId: near.t.ids.orcling!, attackerIds: [near.t.ids.host!] }, near.t.ctx);
    expect(close.cards[near.t.ids.orcling!]?.zone).toBe("encounterDiscard");
    const bigger = attackTable([{ code: "warrior", at: { zone: "heroes", seat: 0 }, as: "host" }, { code: "stonetroll", at: { zone: "engaged", seat: 0 } }, { code: BOW, at: { zone: "play", seat: 0 } }], effects, [...real.values(), warrior(), troll()]);
    const state = syncConstants(attachTo(bigger.state, bigger.ids[BOW]!, bigger.ids.host!), bigger.ctx);
    const own = accept(state, { type: "DeclareAttackers", enemyId: bigger.ids.stonetroll!, attackerIds: [bigger.ids.host!] }, bigger.ctx);
    expect(own.cards[bigger.ids.stonetroll!]?.damage).toBe(3);
  });
});

describe("132024:A:1 and A:2 Thrór's Golden Cup", () => {
  lineSpec("132024:A:1", "goes on a hero, not on an ally", (effects) => {
    const ctx = world(effects);
    const table = seat(1, ["rohan", "dwarf"]);
    const ally = put(table.state, "plain-ally", "play");
    const cup = put(ally.state, CUP, "hand");
    expect(hostsOf(cup.state, cup.id, ctx)).toEqual([...table.heroes].sort());
  });

  lineSpec("132024:A:2", "adds the Cup to the victory display and draws 3 cards", (effects) => {
    const ctx = world(effects);
    const table = seat(1, ["rohan"]);
    const hostId = table.heroes[0] ?? "";
    const cup = put(table.state, CUP, "play");
    let state = attachTo(cup.state, cup.id, hostId);
    const drawn = ["filler", "filler", "filler", "filler"].map((code) => {
      const made = put(state, code, "deck");
      state = made.state;
      return made.id;
    });
    const used = fire(syncConstants(state, ctx), cup.id, "132024:action:1", ctx);
    expect(used.cards[cup.id]?.zone).toBe("victory");
    expect(used.seats[0]?.hand).toEqual(drawn.slice(0, 3));
    expect(used.seats[0]?.deck).toEqual(drawn.slice(3));
  });
});

describe("hob.treasure-ohauh, hob.treasure-otd: a treasure is played like an attachment", () => {
  it("is refused with no host and offered in the hand with a host (132024:A:1)", () => {
    const ctx = world(EFFECTS);
    const table = seat(1, ["rohan"]);
    const cup = put(table.state, CUP, "hand");
    expect(reduce(cup.state, { type: "PlayCard", cardId: cup.id, payments: [] }, ctx).ok).toBe(false);
    expect(legalIntents(cup.state, ctx).filter((intent) => intent.type === "PlayCard")).not.toEqual([]);
  });
});
