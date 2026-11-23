// Rules: hob.baggins-sphere-ohauh, hob.baggins-sphere-otd, hob.bilbo-multiplayer-ohauh, hob.treasure-ohauh, hob.treasure-otd, rr.limits, rr.lasting-effects, faq.lasting-effects, rr.triggered-ability, rr.cost, rr.response, rr.action, rr.attachment-cards, rr.player-elimination (data/rules/entries.json).
// More tests of the cycle's player cards, written from the printed lines (data/printed/the-hobbit.json, data/printed/player-cards.json): Bilbo Baggins 131001:A:2 and 132001:A:1, Burglar Baggins 131019:A:1, The Lucky Number 132013:A:1, Sting 131020:A:3 and
// the Fellowship's Sting 142011:A:3, Bilbo's Magic Ring 132019:A:2, The Arkenstone 132020:A:2 and Thrór's Golden Cup 132024:A:2: the limits and durations, the resources Bilbo may gain, the cases where a Response or Action can change nothing, and the Skirmishers' "exhausts to defend".
// The first tests of these cards are in the-hobbit-treasures.test.ts.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted, type PrintedCard } from "../../rules/core/printed.ts";
import { modifiedStat } from "../../rules/core/keywords.ts";
import { updateCard, withMode, withThreat, type ScenarioState } from "../../rules/core/state.ts";
import { attachTo } from "../../rules/core/zones.ts";
import { settle } from "../../rules/engine/machine.ts";
import { legalIntents, reduce } from "../../rules/engine/reduce.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { table as attackTable } from "../../rules/families/attack/fixture.ts";
import { enemy, hero, offered, send as defend, table as defenseTable, until } from "../../rules/families/defense/table.ts";
import { PLAY_CARDS, put, run, seat, triggers } from "../../rules/families/play/fixture.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";

const BILBO_OHAUH = "131001";
const BILBO_OTD = "132001";
const BURGLAR = "131019";
const LUCKY = "132013";
const STING = "131020";
const FELLOWSHIP_STING = "142011";
const ORCRIST = "131021";
const RING = "132019";
const ARKENSTONE = "132020";
const CUP = "132024";
const STEWARD = "01026";
const CELEBRIANS_STONE = "01027";

let real: ReadonlyMap<string, PrintedCard>;
beforeAll(async () => {
  real = await loadPrinted([BILBO_OHAUH, BILBO_OTD, BURGLAR, LUCKY, STING, FELLOWSHIP_STING, ORCRIST, RING, ARKENSTONE, CUP, STEWARD, CELEBRIANS_STONE]);
});

// A Leadership and a Tactics ally with the numbers a test reads.
const helper = () => definePrinted({ code: "plain-ally", name: "Plain Ally", type: "ally", sphere: "leadership", cost: 2, willpower: 1, attack: 1, defense: 1, health: 2 });
const tactics = () => definePrinted({ code: "tactics-ally", name: "Tactics Ally", type: "ally", sphere: "tactics", cost: 2, willpower: 1, attack: 1, defense: 1, health: 2 });

type Ctx = { effects: readonly Effect[]; cards: ReadonlyMap<string, PrintedCard> };
const world = (effects: readonly Effect[]): Ctx => ({ effects, cards: new Map<string, PrintedCard>([...PLAY_CARDS, ...real, ...[helper(), tactics()].map((card) => [card.code, card] as const)]) });
// An intent the engine must accept: a refusal fails the expectation (the line check of lineSpec tells it from an error in the test).
function accept(state: ScenarioState, intent: Parameters<typeof reduce>[1], ctx: Ctx): ScenarioState {
  const result = reduce(state, intent, ctx);
  expect(result.ok, result.ok ? "" : result.reason).toBe(true);
  return result.ok ? result.state : state;
}
const fire = (state: ScenarioState, cardId: string, effectId: string, ctx: Ctx): ScenarioState => accept(state, { type: "Trigger", cardId, effectId }, ctx);
// A try at a Trigger the engine may refuse: the state after it, or the state as it was.
const tryTrigger = (state: ScenarioState, cardId: string, effectId: string, ctx: Ctx): ScenarioState => {
  const result = reduce(state, { type: "Trigger", cardId, effectId }, ctx);
  return result.ok ? result.state : state;
};
const hostOn = (state: ScenarioState, cardId: string, hostId: string, ctx: Ctx): ScenarioState => syncConstants(attachTo(state, cardId, hostId), ctx);
const resourcesOf = (state: ScenarioState, id: string): number => state.cards[id]?.resources ?? 0;
// The resource phase's collection (rr.step-1-2) with a card in the deck for the draw that follows it.
const collect = (state: ScenarioState, ctx: Ctx): ScenarioState => {
  const stocked = put(state, "filler", "deck").state;
  return settle({ ...withMode(stocked, "resourceGrant"), phase: "Resource", window: null }, ctx, []);
};
// The attached hero (Bilbo, or the warrior) attacks the 1 hit point Orc and destroys it: Orcrist's Response is open.
const orc = () => definePrinted({ code: "orcling", name: "Orcling", type: "enemy", threat: 1, engagementCost: 30, attack: 1, defense: 0, health: 1, traits: ["Orc"] });
const orcristAttack = (effects: readonly Effect[], hostCode: string) => {
  const t = attackTable([{ code: hostCode, at: { zone: "heroes", seat: 0 }, as: "host" }, { code: "orcling", at: { zone: "engaged", seat: 0 } }, { code: ORCRIST, at: { zone: "play", seat: 0 } }], effects, [...real.values(), orc()]);
  const state = syncConstants(attachTo(t.state, t.ids[ORCRIST]!, t.ids.host!), t.ctx);
  return { t, declared: accept(state, { type: "DeclareAttackers", enemyId: t.ids.orcling!, attackerIds: [t.ids.host!] }, t.ctx) };
};
// One player, Bilbo with an empty pool, and the cards each given as [code, host?] in play.
const bilboTable = (ctx: Ctx, bilboCode: string, cards: readonly string[]) => {
  const base = seat(1, [bilboCode]);
  const bilbo = base.heroes[0] ?? "";
  let state = updateCard(base.state, bilbo, { resources: 0 });
  const ids: Record<string, string> = {};
  for (const code of cards) {
    const made = put(state, code, "play");
    ids[code] = made.id;
    state = hostOn(made.state, made.id, bilbo, ctx);
  }
  return { state, bilbo, ids };
};

describe("131001:A:2 and 132001:A:1: the resources Bilbo Baggins gains", () => {
  // The card prints "cannot gain resources from player card effects" (131001:A:2): the Steward of Gondor (a non-treasure attachment) and Orcrist (a treasure) are player cards, and the resource he collects is no card effect (hob.baggins-sphere-ohauh).
  // An ability that can add him nothing may be refused (rr.triggered-ability), so a try that is refused leaves his pool as it was: these tests read the pool, the offer is tested apart.
  lineSpec("131001:A:2", "Bilbo of the Over Hill and Under Hill box gains no resource from a player card effect, a treasure's included, and still collects 1 in the resource phase", (effects) => {
    const ctx = world(effects);
    const { state, bilbo, ids } = bilboTable(ctx, BILBO_OHAUH, [STEWARD]);
    const stewarded = tryTrigger(state, ids[STEWARD] ?? "", "01026:action:1", ctx);
    expect(resourcesOf(stewarded, bilbo)).toBe(0);
    // Orcrist: the attached Bilbo destroys an Orc and the Response would add 1 resource to him.
    const { t, declared } = orcristAttack(effects, BILBO_OHAUH);
    expect(declared.cards[t.ids.orcling!]?.zone).toBe("encounterDiscard");
    const orcrist = tryTrigger(declared, t.ids[ORCRIST]!, "131021:response:1", t.ctx);
    expect(resourcesOf(orcrist, t.ids.host!)).toBe(0);
    // The resource phase: his own collection is no card effect, so it comes.
    expect(resourcesOf(collect(stewarded, ctx), bilbo)).toBe(1);
  });

  // The card prints "cannot gain resources from non-treasure cards" (132001:A:1): the Ring (a treasure) adds 1, the Steward of Gondor adds none, and the collection is no card.
  lineSpec("132001:A:1", "Bilbo of the On the Doorstep box gains a resource from a treasure's effect, none from another player card effect, and collects 1 in the resource phase", (effects) => {
    const ctx = world(effects);
    const { state, bilbo, ids } = bilboTable(ctx, BILBO_OTD, [STEWARD, RING]);
    const stewarded = tryTrigger(state, ids[STEWARD] ?? "", "01026:action:1", ctx);
    expect(resourcesOf(stewarded, bilbo), "a non-treasure player card gives him nothing").toBe(0);
    const ringed = fire(stewarded, ids[RING] ?? "", "132019:action:1", ctx);
    expect(resourcesOf(ringed, bilbo), "a treasure gives him 1").toBe(1);
    expect(resourcesOf(collect(ringed, ctx), bilbo)).toBe(2);
  });

  it("131001:A:2 the Ring's Action 132019:A:2 is not offered on Bilbo of the Over Hill and Under Hill box, whose pool it cannot fill", () => {
    const ctx = world(EFFECTS);
    const { state, ids } = bilboTable(ctx, BILBO_OHAUH, [RING]);
    expect(ids[RING]).toBeDefined();
    expect(triggers(state, ctx, "132019:action:1")).toEqual([]);
  });

  it("131001:A:2 Orcrist's Response 131021:A:3 is not offered when the attached hero is Bilbo of the Over Hill and Under Hill box", () => {
    const { t, declared } = orcristAttack(EFFECTS, BILBO_OHAUH);
    expect(declared.cards[t.ids.orcling!]?.zone).toBe("encounterDiscard");
    expect(triggers(declared, t.ctx, "131021:response:1")).toEqual([]);
  });
});

describe("131001:A:2 the other player cards that add resources to Bilbo Baggins", () => {
  it("131001:A:2 the Action of the Steward of Gondor (01026:A:3) is not offered on Bilbo of the Over Hill and Under Hill box, and is offered on another hero", () => {
    const ctx = world(EFFECTS);
    const barred = bilboTable(ctx, BILBO_OHAUH, [STEWARD]);
    expect(triggers(barred.state, ctx, "01026:action:1")).toEqual([]);
    const other = seat(1, ["rohan"]);
    const held = put(other.state, STEWARD, "play");
    expect(triggers(hostOn(held.state, held.id, other.heroes[0] ?? "", ctx), ctx, "01026:action:1")).not.toEqual([]);
  });
});

describe("132019:A:2 Bilbo's Magic Ring: Limit once per round, a second use in the same round is refused and it works again in the next round", () => {
  lineSpec("132019:A:2", "a second use in the same round is not offered, and the Ring may be used again in the next round", (effects) => {
    const ctx = world(effects);
    const { state, bilbo, ids } = bilboTable(ctx, BILBO_OTD, [RING]);
    const ring = ids[RING] ?? "";
    const first = fire(state, ring, "132019:action:1", ctx);
    expect(resourcesOf(first, bilbo)).toBe(1);
    // The Ring readies (as in the refresh phase of a later round) but the round is the same: the limit holds.
    const readied = updateCard(first, ring, { exhausted: false });
    expect(triggers(readied, ctx, "132019:action:1"), "the second use in the same round").toEqual([]);
    expect(reduce(readied, { type: "Trigger", cardId: ring, effectId: "132019:action:1" }, ctx).ok).toBe(false);
    // The next round: offered again, and it gives the resource again.
    const next = { ...readied, round: readied.round + 1 };
    expect(triggers(next, ctx, "132019:action:1")).not.toEqual([]);
    expect(resourcesOf(fire(next, ring, "132019:action:1", ctx), bilbo)).toBe(2);
  });
});

// The Arkenstone's table: Dain (a Leadership hero) or the named hero carries the stone; the cards in `hand` are in the first player's hand and the threat is as given.
const stoneTable = (ctx: Ctx, hand: readonly string[], options: { threat?: number; hero?: string; extra?: readonly string[] } = {}) => {
  const base = seat(1, [options.hero ?? "dwarf"]);
  const carrier = base.heroes[0] ?? "";
  let state = withThreat(base.state, 0, options.threat ?? 20);
  const stone = put(state, ARKENSTONE, "play");
  state = stone.state;
  for (const code of options.extra ?? []) {
    const extra = put(state, code, "play");
    state = hostOn(extra.state, extra.id, carrier, ctx);
  }
  const ids = hand.map((code) => {
    const made = put(state, code, "hand");
    state = made.state;
    return made.id;
  });
  return { state: hostOn(state, stone.id, carrier, ctx), stone: stone.id, ids, carrier };
};
// The stone is used and X chosen.
const useStone = (state: ScenarioState, stone: string, x: number, ctx: Ctx): ScenarioState => run(accept(fire(state, stone, "132020:action:1", ctx), { type: "Choose", optionId: `x${x}` }, ctx), ctx);
const playFree = (state: ScenarioState, cardId: string, ctx: Ctx) => reduce(state, { type: "PlayCard", cardId, payments: [] }, ctx);

describe("132020:A:2 The Arkenstone: the next ally this phase, the lowered cost ends with the phase, and what it can change", () => {
  lineSpec("132020:A:2", "lowers the cost of the next ally only: a second ally this phase costs its price, and the lowered cost is gone at the end of the phase", (effects) => {
    const ctx = world(effects);
    const t = stoneTable(ctx, ["plain-ally", "plain-ally"]);
    const used = useStone(t.state, t.stone, 2, ctx);
    const first = accept(used, { type: "PlayCard", cardId: t.ids[0] ?? "", payments: [] }, ctx);
    expect(first.cards[t.ids[0] ?? ""]?.zone, "the next ally is free").toBe("play");
    expect(playFree(first, t.ids[1] ?? "", ctx).ok, "the second ally costs its full price").toBe(false);
    // The price is paid in full by the hero.
    expect(accept(first, { type: "PlayCard", cardId: t.ids[1] ?? "", payments: [{ heroId: t.carrier, amount: 2 }] }, ctx).cards[t.ids[1] ?? ""]?.zone).toBe("play");
    // The next phase: the lowering has ended, the ally is not free.
    const later = { ...withMode(withMode({ ...used, window: null }, "beginRound"), "planning"), window: { kind: "pass" as const }, activeSeat: 0 };
    expect(playFree(later, t.ids[0] ?? "", ctx).ok, "the cost is lowered until the end of the phase").toBe(false);
  });

  lineSpec("132020:A:2", "is not offered with no ally in hand, and is offered with an ally of the attached hero's sphere", (effects) => {
    const ctx = world(effects);
    const none = stoneTable(ctx, []);
    expect(triggers(none.state, ctx, "132020:action:1")).toEqual([]);
    const some = stoneTable(ctx, ["plain-ally"]);
    expect(triggers(some.state, ctx, "132020:action:1")).not.toEqual([]);
  });

  it("132020:A:2 is not offered when the only ally in hand is of another sphere than the attached hero's", () => {
    const ctx = world(EFFECTS);
    const some = stoneTable(ctx, ["plain-ally"]);
    expect(triggers(some.state, ctx, "132020:action:1"), "a Leadership ally with a Leadership hero").not.toEqual([]);
    const other = stoneTable(ctx, ["tactics-ally"]);
    expect(triggers(other.state, ctx, "132020:action:1")).toEqual([]);
  });

  it("132020:A:2 is not offered when X can only be 0, at a threat of 49", () => {
    const ctx = world(EFFECTS);
    const low = stoneTable(ctx, ["plain-ally"], { threat: 48 });
    expect(triggers(low.state, ctx, "132020:action:1"), "at 48, X may be 1").not.toEqual([]);
    const high = stoneTable(ctx, ["plain-ally"], { threat: 49 });
    expect(triggers(high.state, ctx, "132020:action:1")).toEqual([]);
  });

  // Aragorn with Celebrían's Stone also has the Spirit icon (01027:A:3, docs/brief.md, Three layers): he is a Leadership hero and a Spirit hero, and an ally of either sphere "matches the attached hero's sphere".
  lineSpec("132020:A:2", "a hero that kept his own sphere with a gained icon still makes the next ally of that sphere cheaper, and an ally of another sphere is not", (effects) => {
    const ctx = world(effects);
    const t = stoneTable(ctx, ["plain-ally", "tactics-ally"], { hero: "ranger", extra: [CELEBRIANS_STONE] });
    const used = useStone(t.state, t.stone, 2, ctx);
    expect(playFree(used, t.ids[1] ?? "", ctx).ok, "a Tactics ally matches neither icon").toBe(false);
    expect(playFree(used, t.ids[0] ?? "", ctx).ok, "the Leadership ally (cost 2) is free with X = 2").toBe(true);
  });

  it("132020:A:2 a hero that gained a resource icon counts as that sphere: the Spirit ally of Aragorn with Celebrían's Stone costs X less", () => {
    const ctx = world(EFFECTS);
    const t = stoneTable(ctx, ["rider"], { hero: "ranger", extra: [CELEBRIANS_STONE] });
    // The Leadership ally keeps the Action offered without the Stone (an Action with no ally of his sphere in hand is not offered).
    const plain = stoneTable(ctx, ["rider", "plain-ally"], { hero: "ranger" });
    expect(playFree(useStone(plain.state, plain.stone, 1, ctx), plain.ids[0] ?? "", ctx).ok, "without the Stone he is no Spirit hero").toBe(false);
    expect(playFree(useStone(t.state, t.stone, 1, ctx), t.ids[0] ?? "", ctx).ok).toBe(true);
  });
});

// Sting (131020, on Bilbo) and the Fellowship's Sting (142011, on a Hobbit hero): the attacking orc has Attack 3 and 6 hit points; the encounter deck holds the cards a test names, top first. The first card is the shadow card the orc is dealt (an empty list deals none).
const mist = () => definePrinted({ code: "mist", name: "Mist", type: "treachery" });
const bigFoe = () => definePrinted({ code: "bigfoe", name: "Big Foe", type: "enemy", threat: 5, engagementCost: 50, attack: 1, defense: 1, health: 9 });
const lair = () => definePrinted({ code: "lair", name: "Lair", type: "location", threat: 2, questPoints: 3 });
const stingScene = (effects: readonly Effect[], sting: string, hostCode: string, encounter: readonly string[]) => {
  const built = defenseTable({
    cards: [hero(hostCode, { sphere: "baggins", defense: 1, health: 3, traits: ["Hobbit"] }), real.get(sting)!, enemy("orc", { attack: 3, defense: 1, health: 6, threat: 1 }), mist(), bigFoe(), lair()],
    effects,
    heroes: [{ code: hostCode }],
    attachments: [{ code: sting, host: hostCode }],
    enemies: [{ code: "orc" }],
    encounter,
  });
  const defending = until(defend(built.state, { type: "DeclineEngage" }, built.ctx), built.ctx, (current) => current.window?.kind === "defense");
  const defended = defend(defending, { type: "DeclareDefender", defenderId: built.ids[hostCode]! }, built.ctx);
  return { built, defended, response: `${sting}:response:1`, stingId: built.ids[sting]! };
};
const responseOffered = (scene: ReturnType<typeof stingScene>): boolean => offered(legalIntents(scene.defended, scene.built.ctx), scene.response);

describe("131020:A:3 and 142011:A:3 Sting: the discard from the encounter deck", () => {
  it("131020:A:3 is not offered with an empty encounter deck", () => {
    expect(responseOffered(stingScene(EFFECTS, STING, BILBO_OHAUH, ["mist", "bigfoe"])), "a card to discard").toBe(true);
    expect(responseOffered(stingScene(EFFECTS, STING, BILBO_OHAUH, [])), "no shadow card, no card to discard").toBe(false);
    expect(responseOffered(stingScene(EFFECTS, STING, BILBO_OHAUH, ["mist"])), "the shadow card was the last").toBe(false);
  });

  it("142011:A:3 is not offered with an empty encounter deck", () => {
    expect(responseOffered(stingScene(EFFECTS, FELLOWSHIP_STING, "hobbit-hero", ["mist", "bigfoe"])), "a card to discard").toBe(true);
    expect(responseOffered(stingScene(EFFECTS, FELLOWSHIP_STING, "hobbit-hero", [])), "no shadow card, no card to discard").toBe(false);
    expect(responseOffered(stingScene(EFFECTS, FELLOWSHIP_STING, "hobbit-hero", ["mist"])), "the shadow card was the last").toBe(false);
  });

  // The damage is the printed Threat of the card discarded: 5 for an enemy of Threat 5, 2 for a location of Threat 2.
  const damageEqualsThreat = (sting: string, host: string) => (effects: readonly Effect[]) => {
    for (const [top, damage] of [["bigfoe", 5], ["lair", 2]] as const) {
      const scene = stingScene(effects, sting, host, ["mist", top]);
      expect(responseOffered(scene), `${top} on top`).toBe(true);
      const used = defend(scene.defended, { type: "Trigger", cardId: scene.stingId, effectId: scene.response }, scene.built.ctx);
      expect(Object.values(used.cards).find((card) => card.code === top)?.zone).toBe("encounterDiscard");
      expect(used.cards[scene.built.ids.orc!]?.damage).toBe(damage);
    }
  };
  lineSpec("131020:A:3", "deals damage equal to the printed Threat of the card it discarded", damageEqualsThreat(STING, BILBO_OHAUH));
  lineSpec("142011:A:3", "deals damage equal to the printed Threat of the card it discarded", damageEqualsThreat(FELLOWSHIP_STING, "hobbit-hero"));
});

// Two players: the first seat holds Bilbo (2 resources in his pool) and "rohan", the second seat holds "rohan" (5 Spirit resources) and has the cards named in its hand. The second seat acts.
const burglarTable = (bilboCode: string, hand: readonly string[]) => {
  const base = seat(2, ["rohan"]);
  const bilbo = put(base.state, bilboCode, "heroes", 0);
  let state = updateCard(bilbo.state, bilbo.id, { resources: 2 });
  const ids = hand.map((code) => {
    const made = put(state, code, "hand", 1);
    state = made.state;
    return made.id;
  });
  const own = base.heroes[1] ?? "";
  return { state: { ...state, activeSeat: 1 }, bilbo: bilbo.id, ids, own, firstSeatHero: base.heroes[0] ?? "" };
};
const pay = (heroId: string, amount = 1) => ({ type: "PlayCard" as const, payments: [{ heroId, amount }] });

describe("131019:A:1 Burglar Baggins: the bonus lasts until the end of the phase", () => {
  // "You may spend a Baggins resource from Bilbo Baggins' resource pool to play this card even if you do not control Bilbo Baggins": the second seat pays with Bilbo's pool, and the Action gives him +2 Willpower, Attack and Defense.
  lineSpec("131019:A:1", "is paid with a Baggins resource from Bilbo's pool by a player who does not control him, and gives Bilbo +2 Willpower, Attack and Defense", (effects) => {
    const ctx = world(effects);
    const t = burglarTable(BILBO_OHAUH, [BURGLAR]);
    const card = t.ids[0] ?? "";
    const before = ["willpower", "attack", "defense"].map((stat) => modifiedStat(t.state, t.state.cards[t.bilbo]!, stat as "attack", ctx.cards));
    const played = accept(t.state, { ...pay(t.bilbo), cardId: card }, ctx);
    expect(resourcesOf(played, t.bilbo), "one resource left Bilbo's pool").toBe(1);
    expect(resourcesOf(played, t.own), "the player's own hero paid nothing").toBe(5);
    const after = ["willpower", "attack", "defense"].map((stat) => modifiedStat(played, played.cards[t.bilbo]!, stat as "attack", ctx.cards));
    expect(after).toEqual(before.map((value) => value + 2));
  });

  // The allowance is for this card only: the same player cannot pay The Lucky Number (a Baggins card of cost 1) from Bilbo's pool, nor Burglar Baggins with a Spirit resource of his own, whereas the player who controls Bilbo can pay The Lucky Number from it.
  lineSpec("131019:A:1", "lets Bilbo's pool pay for no other card, and no other pool pay for Burglar Baggins", (effects) => {
    const ctx = world(effects);
    const t = burglarTable(BILBO_OHAUH, [BURGLAR, LUCKY]);
    const [burglar, lucky] = [t.ids[0] ?? "", t.ids[1] ?? ""];
    // Precondition: the allowance works for Burglar Baggins.
    expect(reduce(t.state, { ...pay(t.bilbo), cardId: burglar }, ctx).ok).toBe(true);
    expect(reduce(t.state, { ...pay(t.bilbo), cardId: lucky }, ctx).ok, "Bilbo's pool does not pay for The Lucky Number of a player who does not control him").toBe(false);
    expect(reduce(t.state, { ...pay(t.own), cardId: burglar }, ctx).ok, "a Spirit resource is no Baggins resource").toBe(false);
    // The player who controls Bilbo pays for The Lucky Number from his pool.
    const owner = burglarTable(BILBO_OHAUH, []);
    const mine = put(owner.state, LUCKY, "hand", 0);
    expect(reduce({ ...mine.state, activeSeat: 0 }, { ...pay(owner.bilbo), cardId: mine.id }, ctx).ok).toBe(true);
  });

  lineSpec("131019:A:1", "the +2 lasts until the end of the phase and is gone in the next phase, and a second Burglar Baggins in the same phase adds another +2", (effects) => {
    const ctx = world(effects);
    const t = burglarTable(BILBO_OHAUH, [BURGLAR, BURGLAR]);
    const attack = (state: ScenarioState) => modifiedStat(state, state.cards[t.bilbo]!, "attack", ctx.cards);
    const base = attack(t.state);
    const first = accept(t.state, { ...pay(t.bilbo), cardId: t.ids[0] ?? "" }, ctx);
    expect(attack(first)).toBe(base + 2);
    const second = accept({ ...first, activeSeat: 1 }, { ...pay(t.bilbo), cardId: t.ids[1] ?? "" }, ctx);
    expect(attack(second), "a second use in the phase").toBe(base + 4);
    const next = withMode(withMode({ ...second, window: null }, "beginRound"), "planning");
    expect(attack(next), "gone in the next phase").toBe(base);
  });
});

// The Lucky Number: Bilbo (On the Doorstep) and "rohan" (Willpower 2, Attack 2, Defense 2) in play; the event costs 1 Baggins resource.
const luckyTable = (ctx: Ctx, withSting: boolean) => {
  const base = seat(1, [BILBO_OTD, "rohan"]);
  const [bilbo, target] = [base.heroes[0] ?? "", base.heroes[1] ?? ""];
  const card = put(base.state, LUCKY, "hand");
  const sting = put(card.state, STING, "play");
  return { state: withSting ? hostOn(sting.state, sting.id, bilbo, ctx) : sting.state, bilbo, target, card: card.id, sting: sting.id };
};
const STATS = ["willpower", "attack", "defense"] as const;
const statsOf = (state: ScenarioState, id: string, ctx: Ctx) => STATS.map((stat) => modifiedStat(state, state.cards[id]!, stat, ctx.cards));
const playLucky = (t: ReturnType<typeof luckyTable>, ctx: Ctx) => run(accept(t.state, { type: "PlayCard", cardId: t.card, payments: [{ heroId: t.bilbo, amount: 1 }] }, ctx), ctx);

describe("132013:A:1 The Lucky Number: the bonus lasts until the end of the phase", () => {
  // "Add Bilbo Baggins' total Willpower, Attack, and Defense to that character's ... until the end of the phase": Bilbo's total counts Sting's +1 (131020:A:2); the bonus is gone in the next phase.
  lineSpec("132013:A:1", "adds Bilbo's total Willpower, Attack and Defense to another character until the end of the phase, and the bonus is gone in the next phase", (effects) => {
    const ctx = world(effects);
    const t = luckyTable(ctx, true);
    const bilboTotal = statsOf(t.state, t.bilbo, ctx);
    const targetBase = statsOf(t.state, t.target, ctx);
    const played = playLucky(t, ctx);
    expect(played.cards[t.card]?.zone, "the event is played").not.toBe("hand");
    expect(statsOf(played, t.target, ctx)).toEqual(targetBase.map((value, at) => value + (bilboTotal[at] ?? 0)));
    expect(statsOf(played, t.bilbo, ctx), "Bilbo's own stats are not doubled").toEqual(bilboTotal);
    const next = withMode(withMode({ ...played, window: null }, "beginRound"), "planning");
    expect(statsOf(next, t.target, ctx), "gone in the next phase").toEqual(targetBase);
  });

  // faq.lasting-effects: a lasting effect of a player card is calculated when the ability is triggered and is not recalculated when the game state changes later (the Nenya example, "Galadriel's 4 willpower"): Sting arrives after the event.
  lineSpec("132013:A:1", "the bonus is fixed when the event resolves: Bilbo's stats rising later in the phase do not raise it", (effects) => {
    const ctx = world(effects);
    const t = luckyTable(ctx, false);
    const bilboBase = statsOf(t.state, t.bilbo, ctx);
    const targetBase = statsOf(t.state, t.target, ctx);
    const played = playLucky(t, ctx);
    const stung = hostOn(played, t.sting, t.bilbo, ctx);
    expect(statsOf(stung, t.bilbo, ctx), "Sting raised Bilbo").toEqual(bilboBase.map((value) => value + 1));
    expect(statsOf(stung, t.target, ctx)).toEqual(targetBase.map((value, at) => value + (bilboBase[at] ?? 0)));
  });
});

describe("132024:A:2 Thrór's Golden Cup: an in-play attachment's Action", () => {
  // The Action is on a card in play (an attachment on a hero): a Cup lying in a discard pile is out of play and offers nothing (rr.in-play-and-out-of-play).
  lineSpec("132024:A:2", "is offered while the Cup is attached to a hero and is not offered while it lies in a discard pile", (effects) => {
    const ctx = world(effects);
    const table = seat(1, ["rohan"]);
    // A deck of 3 cards: the draw has something to do.
    const deck = ["filler", "filler", "filler"].reduce((state, code) => put(state, code, "deck").state, table.state);
    const cup = put(deck, CUP, "play");
    const attached = hostOn(cup.state, cup.id, table.heroes[0] ?? "", ctx);
    expect(triggers(attached, ctx, "132024:action:1")).not.toEqual([]);
    const lying = put(deck, CUP, "discard");
    expect(triggers(lying.state, ctx, "132024:action:1")).toEqual([]);
    expect(reduce(lying.state, { type: "Trigger", cardId: lying.id, effectId: "132024:action:1" }, ctx).ok).toBe(false);
  });
});
