import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { RECORDS } from "../../../effects/authored/families/costs.ts";

import { syncConstants } from "../../interpret/constants.ts";
import { expectOk, hero } from "../../core/test-fixture.ts";
import { gainSeatResources } from "../../interpret/interpret.ts";
import { modifiedStat } from "../../core/keywords.ts";
import { hasResourceMatch, heroPays } from "../../player/payments.ts";
import { qualifyingEnemies } from "../../quest/quest.ts";
import { legalIntents, reduce } from "../../engine/reduce.ts";
import { ruleCause } from "../../core/cause.ts";
import { updateCard, withThreat } from "../../core/state.ts";
import { paymentsFor, triggerPayments } from "../../../../test/harness/auto-player.ts";
import { card, put, table } from "./fixture.ts";
import { threatCostCut, threatCostOf } from "./stats.ts";

// Rules: rr.resource-match, rr.resources, rr.cost, rr.response, rr.initiating-abilities-playing-cards, rr.step-1-2, rr.setup,
// rr.initial-threat-level, rr.modifiers, rr.engagement-check, rr.limits (data/rules/entries.json).
// Who may pay for a card and with which icons: distinct pools, ally pools, pools that may not pay, icons held as flags or only
// while paying; threat costs at setup; the engagement cost an enemy checks against one player.

const thicket = card("01036", "event", "tactics", 3);
const knight = card("12139", "ally", "leadership", 2);
const radagast = card("02059", "ally", "neutral", 5, { traits: ["Istari"] });
const eagle = card("eagle", "ally", "lore", 2, { traits: ["Creature", "Eagle"] });
const mule = card("mule", "ally", "lore", 1, { traits: ["Hobbit"] });
const naasiyah = card("12109", "hero", "tactics", null, { threat: 10 });
const amarthiul = card("10115", "hero", "leadership", null, { threat: 10 });
const orc = card("orc", "enemy", null, null, { engagementCost: 30, threat: 2, traits: ["Orc"] });
const goblin = card("goblin", "enemy", null, null, { engagementCost: 30, threat: 2, traits: ["Goblin"] });
const disguise = card("146009", "attachment", "lore", 1);
const bard = card("18002", "hero", "tactics", null, { threat: 10 });
const bow = card("bow", "attachment", "lore", 1, { traits: ["Item", "Weapon"] });
const muster = card("22062", "event", "spirit", 2);
const rohanHero = card("rohan", "hero", "leadership", null, { threat: 9, traits: ["Rohan"] });
const narvi = card("03003", "attachment", "neutral", 1);
const mirlonde = card("06032", "hero", "lore", null, { threat: 8 });
const folco = card("17109", "hero", "spirit", null, { threat: 5, traits: ["Hobbit"] });
const pippin = card("pippin", "hero", "tactics", null, { threat: 6, traits: ["Hobbit"] });
const answer = card("answer", "event", "lore", 0);

const lead2 = hero("lead2", "leadership", 9);
const ceorl = card("ceorl", "ally", "leadership", 2);

const CARDS = [lead2, ceorl, thicket, knight, radagast, eagle, mule, naasiyah, amarthiul, orc, goblin, disguise, bard, bow, muster, rohanHero, narvi, mirlonde, folco, pippin, answer];

describe("pools that must differ (PayDistinctHeroes)", () => {
  it("refuses 3 resources from one hero for a card paid from 3 different heroes' pools, and the first guess spreads them", () => {
    const { state, ids, ctx } = table(RECORDS, CARDS, [["tac", "tac2", "tac3"]]);
    const hand = put(state, "01036", "hand");
    const [a = "", b = "", c = ""] = ids[0] ?? [];
    expect(reduce(hand.state, { type: "PlayCard", cardId: hand.id, payments: [{ heroId: a, amount: 3 }] }, ctx)).toMatchObject({ ok: false, reason: "Pay from at least 3 different heroes" });
    const played = expectOk(reduce(hand.state, { type: "PlayCard", cardId: hand.id, payments: [{ heroId: a, amount: 1 }, { heroId: b, amount: 1 }, { heroId: c, amount: 1 }] }, ctx)).state;
    expect(played.cards[a]?.resources).toBe(2);
  });

  it("is not offered when fewer heroes than that could pay, and a single-pool card's first guess is one pool", () => {
    const { state, ids, ctx } = table(RECORDS, CARDS, [["tac", "tac2", "lead"]]);
    const hand = put(state, "01036", "hand");
    expect(legalIntents(hand.state, ctx)).not.toContainEqual({ type: "PlayCard", cardId: hand.id });
    const knightCard = put(hand.state, "12139", "hand");
    const two = updateCard(knightCard.state, ids[0]?.[2] ?? "", { resources: 1 });
    const lone = put(two, "lead", "heroes");
    const ready = updateCard(lone.state, lone.id, { resources: 2 });
    expect(reduce(ready, { type: "PlayCard", cardId: knightCard.id, payments: [{ heroId: ids[0]?.[2] ?? "", amount: 1 }, { heroId: lone.id, amount: 1 }] }, ctx)).toMatchObject({ ok: false, reason: "Pay from a single hero" });
    expect(reduce(ready, { type: "PlayCard", cardId: knightCard.id, payments: [{ heroId: lone.id, amount: 2 }] }, ctx).ok).toBe(true);
  });
});

// "Knight of the White Tower's resource cost must be paid from a single hero's resource pool." With 1 resource in each of two
// pools and a cost of 2, no payment is legal: the card is not offered, the first guess is empty, and the auto-player sends no split.
describe("a card paid from a single hero's pool, when no one pool holds its cost", () => {
  it("is not offered, and neither the table's first guess nor the auto-player splits the cost", () => {
    const { state, ids, ctx } = table(RECORDS, CARDS, [["lead", "lead2"]], 1);
    const hand = put(state, "12139", "hand");
    expect(legalIntents(hand.state, ctx)).not.toContainEqual({ type: "PlayCard", cardId: hand.id });
    expect(paymentsFor(hand.state, ctx, 0, hand.id, 2)).toBeNull();
    const first = ids[0]?.[0] ?? "";
    const rich = updateCard(hand.state, first, { resources: 2 });
    expect(legalIntents(rich, ctx)).toContainEqual({ type: "PlayCard", cardId: hand.id });
    expect(paymentsFor(rich, ctx, 0, hand.id, 2)).toEqual([{ heroId: first, amount: 2 }]);
  });
});

// Ceorl (12058:A:1): a Leadership ally whose Action costs 1 Spirit resource. The auto-player pays an Action from the sphere of its cost,
// not of the card, so the Leadership hero listed first is not named.
describe("an Action whose cost names another sphere than its card", () => {
  const record: Effect = { id: "ceorl:action:1", cardCode: "ceorl", lines: ["ceorl:A:1"], timing: "action", cost: { kind: "resources", amount: 1, sphere: "spirit" }, instructions: [{ verb: "Ready" }] };

  it("is paid by a hero of the cost's sphere, and the reducer accepts it", () => {
    const { state, ids, ctx } = table([...RECORDS, record], CARDS, [["lead", "spirit"]], 1);
    const placed = put(state, "ceorl", "play");
    const tired = updateCard(placed.state, placed.id, { exhausted: true });
    const paid = triggerPayments(tired, ctx, { type: "Trigger", cardId: placed.id, effectId: record.id });
    expect(paid).toEqual([{ heroId: ids[0]?.[1], amount: 1 }]);
    expect(reduce(tired, { type: "Trigger", cardId: placed.id, effectId: record.id, payments: paid ?? [] }, ctx)).toMatchObject({ ok: true });
  });
});

describe("Response events (rr.response, rr.resource-match)", () => {
  const answerRecord = (extra: Partial<Effect> = {}): Effect => ({
    id: "answer:response:1",
    cardCode: "answer",
    lines: ["answer:A:1"],
    timing: "response",
    trigger: "enteredPlay",
    subject: { type: "ally", control: "you" },
    cost: { kind: "playEvent" },
    instructions: [{ verb: "Draw" }],
    ...extra,
  });

  it("are not offered without a resource match, even at 0 cost, nor when their play restriction fails", () => {
    const blocked: Effect = { id: "answer:constant:1", cardCode: "answer", lines: ["answer:A:1"], timing: "constant", instructions: [{ verb: "PlayOnlyIf", condition: { kind: "threat", min: 40, valour: true } }] };
    for (const [heroes, effects, offered] of [
      [["tac"], [answerRecord()], false],
      [["lore"], [answerRecord()], true],
      [["lore"], [answerRecord(), blocked], false],
    ] as const) {
      const { state, ctx } = table([...effects], [...CARDS, card("pal", "ally", "neutral", 0)], [heroes]);
      // The Response draws a card, so the deck holds one (a draw from an empty deck changes nothing, rr.running-out-of-cards).
      const event = put(put(state, "pal", "deck").state, "answer", "hand");
      const ally = put(event.state, "pal", "hand");
      const paid = expectOk(reduce(ally.state, { type: "PlayCard", cardId: ally.id, payments: [] }, ctx));
      expect(legalIntents(paid.state, ctx).some((intent) => intent.type === "Trigger" && intent.cardId === event.id), `${heroes[0]} ${effects.length}`).toBe(offered);
    }
  });

  it("charge the seat that answers: a raised-threat cost raises that player's threat (two players)", () => {
    const sentry: Effect = {
      id: "mule:response:1",
      cardCode: "mule",
      lines: ["mule:A:1"],
      timing: "response",
      trigger: "enteredPlay",
      subject: { type: "ally", control: "other" },
      cost: { kind: "raiseThreat", amount: 2 },
      instructions: [{ verb: "Draw" }],
    };
    const { state, ids, ctx } = table([sentry], CARDS, [["lore"], ["lore"]]);
    const watcher = put(state, "mule", "play", 1);
    // The answering seat has a card to draw: a draw from an empty deck changes nothing (rr.running-out-of-cards).
    const stocked = put(watcher.state, "eagle", "deck", 1);
    const ally = put(stocked.state, "eagle", "hand", 0);
    const start = withThreat(withThreat(ally.state, 0, 20), 1, 30);
    const played = expectOk(reduce(start, { type: "PlayCard", cardId: ally.id, payments: [{ heroId: ids[0]?.[0] ?? "", amount: 2 }] }, ctx)).state;
    expect(played.window).toEqual({ kind: "response", seat: 1 });
    const used = expectOk(reduce(played, { type: "Trigger", cardId: watcher.id, effectId: "mule:response:1" }, ctx)).state;
    expect([used.seats[0].threat, used.seats[1].threat]).toEqual([20, 32]);
  });
});

describe("who pays (PaysFor on an ally, CannotPayFor)", () => {
  it("Radagast collects a resource each resource phase that pays for a Creature card of any sphere, and only for one", () => {
    const { state, ids, ctx } = table(RECORDS, CARDS, [["tac"]], 0);
    const wizard = put(state, "02059", "play");
    const synced = syncConstants(wizard.state, ctx);
    const gained = gainSeatResources(synced, 0, [], ruleCause("rr.step-1-2"));
    expect(gained.cards[wizard.id]?.resources).toBe(1);
    expect(gained.cards[ids[0]?.[0] ?? ""]?.resources).toBe(1);
    const bird = put(gained, "eagle", "hand");
    const hobbit = put(bird.state, "mule", "hand");
    expect(hasResourceMatch(hobbit.state, 0, "lore", ctx, bird.id)).toBe(true);
    expect(hasResourceMatch(hobbit.state, 0, "lore", ctx, hobbit.id)).toBe(false);
    const richer = updateCard(hobbit.state, wizard.id, { resources: 2 });
    const played = expectOk(reduce(richer, { type: "PlayCard", cardId: bird.id, payments: [{ heroId: wizard.id, amount: 2 }] }, ctx)).state;
    expect(played.cards[bird.id]?.zone).toBe("play");
    expect(reduce(richer, { type: "PlayCard", cardId: hobbit.id, payments: [{ heroId: wizard.id, amount: 1 }] }, ctx)).toMatchObject({ ok: false });
  });

  it("Na'asiyah's resources cannot pay for allies, but still pay for other cards", () => {
    const { state, ctx } = table(RECORDS, CARDS, [[]]);
    const hero = put(state, "12109", "heroes");
    const rich = updateCard(hero.state, hero.id, { resources: 3 });
    const ally = put(rich, "eagle", "hand");
    const tacAlly = card("tacally", "ally", "tactics", 1);
    const tacEvent = card("tacevent", "event", "tactics", 1);
    const cards = new Map([...ctx.cards, ["tacally", tacAlly], ["tacevent", tacEvent]]);
    const withCards = put(put(ally.state, "tacally", "hand").state, "tacevent", "hand");
    const allyId = Object.values(withCards.state.cards).find((entry) => entry.code === "tacally")?.id ?? "";
    expect(heroPays(withCards.state, hero.id, "tactics", { ...ctx, cards }, allyId)).toBe(false);
    expect(heroPays(withCards.state, hero.id, "tactics", { ...ctx, cards }, withCards.id)).toBe(true);
  });
});

describe("resource icons", () => {
  it("Amarthiúl has the Tactics icon only while engaged with an enemy (a constant flag)", () => {
    const { state, ctx } = table(RECORDS, CARDS, [[]]);
    const hero = put(state, "10115", "heroes");
    expect(heroPays(syncConstants(hero.state, ctx), hero.id, "tactics", ctx)).toBe(false);
    const engaged = syncConstants(put(hero.state, "orc", "engaged").state, ctx);
    expect(heroPays(engaged, hero.id, "tactics", ctx)).toBe(true);
  });

  it("Narvi's Belt gives the chosen icon until the end of the phase", () => {
    const dwarf = card("dwarf", "hero", "tactics", null, { threat: 9, traits: ["Dwarf"] });
    const { state, ctx } = table(RECORDS, [...CARDS, dwarf], [[]]);
    const hero = put(state, "dwarf", "heroes");
    const belt = put(hero.state, "03003", "play");
    const attached = { ...belt.state, cards: { ...belt.state.cards, [belt.id]: { ...belt.state.cards[belt.id]!, host: hero.id }, [hero.id]: { ...belt.state.cards[hero.id]!, attachments: [belt.id] } } };
    const asked = expectOk(reduce(attached, { type: "Trigger", cardId: belt.id, effectId: "03003:action:1" }, ctx)).state;
    expect(asked.window).toMatchObject({ kind: "choose", options: ["leadership", "lore", "tactics", "spirit"] });
    const chosen = expectOk(reduce(asked, { type: "Choose", optionId: "lore" }, ctx)).state;
    expect(heroPays(chosen, hero.id, "lore", ctx)).toBe(true);
    expect(heroPays(chosen, hero.id, "spirit", ctx)).toBe(false);
  });

  it("Bard pays for Item attachments with any of three icons; Rohan heroes pay for The Muster of Rohan as Spirit", () => {
    const { state, ctx } = table(RECORDS, CARDS, [[]]);
    const hero = put(state, "18002", "heroes");
    const item = put(hero.state, "bow", "hand");
    expect(heroPays(item.state, hero.id, "lore", ctx, item.id)).toBe(true);
    expect(heroPays(item.state, hero.id, "lore", ctx)).toBe(false);
    const rider = put(item.state, "rohan", "heroes");
    const event = put(rider.state, "22062", "hand");
    expect(heroPays(event.state, rider.id, "spirit", ctx, event.id)).toBe(true);
    expect(heroPays(event.state, hero.id, "spirit", ctx, event.id)).toBe(false);
  });
});

describe("threat cost (rr.setup step 2, rr.initial-threat-level)", () => {
  it("Mirlonde lowers each of your printed-Lore heroes' threat cost; Folco Boffin his own per Hobbit hero", () => {
    const { state, ctx } = table(RECORDS, CARDS, [["lore", "tac"]]);
    const elf = put(state, "06032", "heroes");
    expect(threatCostOf(elf.state, elf.id, ctx)).toBe(7);
    expect(threatCostCut(elf.state, 0, ctx)).toBe(2);
    const hobbits = put(put(table(RECORDS, CARDS, [[]]).state, "17109", "heroes").state, "pippin", "heroes");
    const folcoId = Object.values(hobbits.state.cards).find((entry) => entry.code === "17109")?.id ?? "";
    expect(threatCostOf(hobbits.state, folcoId, ctx)).toBe(3);
  });
});

describe("Orc Disguise (rr.engagement-check)", () => {
  it("gives an Orc +5 engagement cost while it checks against its controller only", () => {
    const { state, ctx } = table(RECORDS, CARDS, [["lore"], ["lore"]]);
    const ringBearer = Object.values(state.cards).find((entry) => entry.controller === 0)?.id ?? "";
    const worn = put(state, "146009", "play", 0);
    const attached = { ...worn.state, cards: { ...worn.state.cards, [worn.id]: { ...worn.state.cards[worn.id]!, host: ringBearer } } };
    const foes = put(put(attached, "orc", "staging").state, "goblin", "staging");
    const synced = syncConstants(withThreat(withThreat(foes.state, 0, 32), 1, 32), ctx);
    const orcId = Object.values(synced.cards).find((entry) => entry.code === "orc")?.id ?? "";
    expect(qualifyingEnemies(synced, 0, ctx.cards)).toEqual([foes.id]);
    expect(qualifyingEnemies(synced, 1, ctx.cards)).toContain(orcId);
    expect(modifiedStat(synced, synced.cards[orcId]!, "engagementCost", ctx.cards)).toBe(30);
  });
});
