import { describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { RECORDS } from "../../effects/authored/families/costs.ts";

import { holds } from "../conditions.ts";
import { expectOk } from "../fixture.ts";
import { modifiedStat } from "../keywords.ts";
import { legalIntents, reduce } from "../reduce.ts";
import { flagged, updateCard, withThreat, type ScenarioState } from "../state.ts";
import { attachTo } from "../zones.ts";
import { card, put, table } from "./costs-fixture.ts";
import { noteEvent } from "./costs-pay.ts";

// Rules: rr.play-and-put-into-play, rr.initiating-abilities-playing-cards, rr.cost, rr.resource-match, rr.resources,
// rr.attachment-cards, rr.limits, rr.doomed-x, rr.then, rr.may, rr.step-3-4 (data/rules/entries.json).
// Cards an effect plays from the hand, additional costs, moving an attachment, and resources gained, spent or discarded.

const thranduil = card("19056", "hero", "leadership", null, { threat: 12 });
const silvan = card("silvan", "ally", "lore", 2, { traits: ["Silvan"] });
const wiglaf = card("19027", "ally", "leadership", 2, { traits: ["Dale"] });
const lamp = card("lamp", "attachment", "leadership", 2, { traits: ["Item"] });
const host = card("22036", "event", "lore", 3);
const guardian = card("12010", "ally", "lore", 3);
const filler = card("filler", "event", "neutral", 0);
const houses = card("12118", "event", "lore", 5);
const healer = card("healer", "ally", "lore", 2, { traits: ["Healer"] });
const mark = card("02002", "attachment", "leadership", 1);
const signal = card("02117", "attachment", "leadership", 1, { traits: ["Signal"] });
const runeMaster = card("12110", "attachment", "leadership", 1);
const belts = card("08086", "event", "spirit", 0);
const linhir = card("12115", "ally", "leadership", 2);
const presence = card("12143", "event", "leadership", 1);
const steward = card("17037", "ally", "lore", 2);
const quick = card("quick", "event", "lore", 0);
const strength = card("06003", "event", "spirit", 0);
const radagast = card("02059", "ally", "neutral", 5);
const eagle = card("eagle", "ally", "lore", 2, { traits: ["Creature"] });
const frodo = card("21002", "hero", "spirit", null, { threat: 7, isUnique: true });
const sam = card("sam", "hero", "leadership", null, { threat: 8, isUnique: true });

const CARDS = [thranduil, silvan, wiglaf, lamp, host, guardian, filler, houses, healer, mark, signal, runeMaster, belts, linhir, presence, steward, quick, strength, radagast, eagle, frodo, sam];
const QUICK: Effect = { id: "quick:action:1", cardCode: "quick", lines: ["quick:A:1"], timing: "action", instructions: [] };

function combat(state: ScenarioState): ScenarioState {
  return { ...state, phase: "Combat", mode: "combatActions", boundaryPhase: "Combat" };
}

describe("a card an effect plays from the hand (PlayFromHand)", () => {
  it("Thranduil plays a Silvan ally in combat with no resource match, paying a resource at a time from the pool chosen", () => {
    const { state, ids, ctx } = table(RECORDS, CARDS, [["lead", "tac"]]);
    const elf = put(state, "19056", "heroes");
    const ally = put(updateCard(elf.state, elf.id, { resources: 1 }), "silvan", "hand");
    const asked = expectOk(reduce(combat(ally.state), { type: "Trigger", cardId: elf.id, effectId: "19056:action:1" }, ctx)).state;
    expect(asked.window).toMatchObject({ kind: "choose", options: [ids[0]?.[0], ids[0]?.[1], elf.id] });
    const first = expectOk(reduce(asked, { type: "Choose", optionId: elf.id }, ctx)).state;
    const second = first.window?.kind === "choose" ? expectOk(reduce(first, { type: "Choose", optionId: ids[0]?.[1] ?? "" }, ctx)).state : first;
    expect(second.cards[ally.id]?.zone).toBe("play");
    expect([second.cards[elf.id]?.resources, second.cards[ids[0]?.[1] ?? ""]?.resources]).toEqual([0, 2]);
    expect(legalIntents(combat(put(second, "silvan", "hand").state), ctx).some((intent) => intent.type === "Trigger" && intent.cardId === elf.id)).toBe(false);
  });

  it("Wiglaf plays an Item attachment on himself for no cost; Host of Galadhrim returns each Silvan ally and plays it again free", () => {
    const { state, ids, ctx } = table(RECORDS, CARDS, [["lead", "lore"]]);
    const item = put(state, "lamp", "hand");
    const dale = put(item.state, "19027", "hand");
    const played = expectOk(reduce(dale.state, { type: "PlayCard", cardId: dale.id, payments: [{ heroId: ids[0]?.[0] ?? "", amount: 2 }] }, ctx)).state;
    const used = expectOk(reduce(played, { type: "Trigger", cardId: dale.id, effectId: "19027:response:1" }, ctx)).state;
    expect(used.cards[item.id]?.host).toBe(dale.id);
    expect(used.cards[ids[0]?.[0] ?? ""]?.resources).toBe(1);
    const elves = put(put(used, "silvan", "play").state, "silvan", "play");
    const hurt = updateCard(elves.state, elves.id, { damage: 1, exhausted: true });
    const event = put(hurt, "22036", "hand");
    const again = expectOk(reduce(event.state, { type: "PlayCard", cardId: event.id, payments: [{ heroId: ids[0]?.[1] ?? "", amount: 3 }] }, ctx)).state;
    expect(again.cards[elves.id]).toMatchObject({ zone: "play", damage: 0, exhausted: false });
    expect(Object.values(again.cards).filter((entry) => entry.code === "silvan" && entry.zone === "play").length).toBe(2);
    expect(again.cards[ids[0]?.[1] ?? ""]?.resources).toBe(0);
  });
});

describe("additional costs", () => {
  it("Guardian of Rivendell needs 2 other cards to discard, chosen as it is played", () => {
    const { state, ids, ctx } = table(RECORDS, CARDS, [["lore"]]);
    const ally = put(state, "12010", "hand");
    const one = put(ally.state, "filler", "hand");
    expect(legalIntents(one.state, ctx)).not.toContainEqual({ type: "PlayCard", cardId: ally.id });
    const two = put(one.state, "silvan", "hand");
    const three = put(two.state, "filler", "hand");
    const played = expectOk(reduce(three.state, { type: "PlayCard", cardId: ally.id, payments: [{ heroId: ids[0]?.[0] ?? "", amount: 3 }] }, ctx)).state;
    expect(played.window?.kind).toBe("choose");
    let after = played;
    while (after.window?.kind === "choose") after = expectOk(reduce(after, { type: "Choose", optionId: after.window.options[0] ?? "" }, ctx)).state;
    expect(after.cards[ally.id]?.zone).toBe("play");
    expect(after.seats[0].hand.length).toBe(1);
  });

  it("The Houses of Healing: the cost not paid in resources is paid by exhausting that many Healers", () => {
    const { state, ids, ctx } = table(RECORDS, CARDS, [["lore"]]);
    const first = put(state, "healer", "play");
    const second = put(first.state, "healer", "play");
    const event = put({ ...second.state, phase: "Refresh", mode: "refresh" }, "12118", "hand");
    const ready = { ...event.state, window: { kind: "pass" as const } };
    expect(reduce(ready, { type: "PlayCard", cardId: event.id, payments: [{ heroId: ids[0]?.[0] ?? "", amount: 2 }] }, ctx)).toMatchObject({ ok: false, reason: "Underpay" });
    const paid = expectOk(reduce(updateCard(ready, ids[0]?.[0] ?? "", { resources: 3 }), { type: "PlayCard", cardId: event.id, payments: [{ heroId: ids[0]?.[0] ?? "", amount: 3 }] }, ctx)).state;
    expect([paid.cards[first.id]?.exhausted, paid.cards[second.id]?.exhausted]).toEqual([true, true]);
  });
});

describe("moving an attachment (Reattach) and the attached event", () => {
  it("Dúnedain Mark pays 1 from its hero to move to another hero; Rune-master adds 1 resource when a Signal is attached to a hero", () => {
    const { state, ids, ctx } = table(RECORDS, CARDS, [["lead", "tac", "lore"]]);
    const [a = "", b = "", c = ""] = ids[0] ?? [];
    const markCard = put(state, "02002", "play");
    let next = attachTo(markCard.state, markCard.id, a);
    const asked = expectOk(reduce(next, { type: "Trigger", cardId: markCard.id, effectId: "02002:action:1", payments: [{ heroId: a, amount: 1 }] }, ctx)).state;
    expect(asked.window).toMatchObject({ kind: "choose", options: [b, c] });
    next = expectOk(reduce(asked, { type: "Choose", optionId: c }, ctx)).state;
    expect(next.cards[markCard.id]?.host).toBe(c);
    expect(next.cards[a]?.attachments).not.toContain(markCard.id);
    expect(next.cards[c]?.attachments).toContain(markCard.id);
    expect(next.cards[a]?.resources).toBe(2);
    const master = put(next, "12110", "play");
    const sign = put(attachTo(master.state, master.id, a), "02117", "hand");
    const played = expectOk(reduce(sign.state, { type: "PlayCard", cardId: sign.id, payments: [{ heroId: a, amount: 1 }], hostId: b }, ctx)).state;
    const used = expectOk(reduce(played, { type: "Trigger", cardId: master.id, effectId: "12110:response:1" }, ctx)).state;
    expect(used.cards[b]?.resources).toBe(4);
  });
});

describe("resources", () => {
  it("Tighten Our Belts: each hero of the chosen player that spent nothing this round gains 1 resource; one copy a round", () => {
    const { state, ids, ctx } = table(RECORDS, CARDS, [["lead", "spirit"]]);
    const [a = "", b = ""] = ids[0] ?? [];
    const event = put(state, "08086", "hand");
    const second = put(event.state, "08086", "hand");
    const ally = put(second.state, "silvan", "hand");
    const lore = { ...ctx, cards: new Map([...ctx.cards, ["silvan", { ...silvan, sphere: "leadership" as const }]]) };
    const spent = expectOk(reduce(ally.state, { type: "PlayCard", cardId: ally.id, payments: [{ heroId: a, amount: 2 }] }, lore)).state;
    const refresh = { ...spent, phase: "Refresh" as const, mode: "refresh" as const, window: { kind: "pass" as const } };
    const played = expectOk(reduce(refresh, { type: "PlayCard", cardId: event.id, payments: [] }, lore)).state;
    expect([played.cards[a]?.resources, played.cards[b]?.resources]).toEqual([1, 4]);
    expect(legalIntents(played, lore)).not.toContainEqual({ type: "PlayCard", cardId: second.id });
  });

  it("Gaining Strength turns 2 resources into 3 on one hero; Radagast spends X of his own to heal X on a Creature", () => {
    const { state, ids, ctx } = table(RECORDS, CARDS, [["spirit"]], 2);
    const event = put(state, "06003", "hand");
    const played = expectOk(reduce(event.state, { type: "PlayCard", cardId: event.id, payments: [] }, ctx)).state;
    expect(played.cards[ids[0]?.[0] ?? ""]?.resources).toBe(3);
    const wizard = put(played, "02059", "play");
    const bird = put(updateCard(wizard.state, wizard.id, { resources: 3 }), "eagle", "play");
    const hurt = updateCard(bird.state, bird.id, { damage: 2 });
    const asked = expectOk(reduce(hurt, { type: "Trigger", cardId: wizard.id, effectId: "02059:action:1" }, ctx)).state;
    expect(asked.window).toMatchObject({ kind: "choose", options: ["x1", "x2"] });
    const healed = expectOk(reduce(asked, { type: "Choose", optionId: "x2" }, ctx)).state;
    expect([healed.cards[bird.id]?.damage, healed.cards[wizard.id]?.resources]).toEqual([0, 1]);
  });

  it("Linhir Sea-captain: when one hero's pool paid all of its cost, that hero and Linhir do not exhaust to quest this round", () => {
    const { state, ids, ctx } = table(RECORDS, CARDS, [["lead", "lead"]]);
    const [a = "", b = ""] = ids[0] ?? [];
    const captain = put(state, "12115", "hand");
    const played = expectOk(reduce(captain.state, { type: "PlayCard", cardId: captain.id, payments: [{ heroId: a, amount: 2 }] }, ctx)).state;
    const used = expectOk(reduce(played, { type: "Trigger", cardId: captain.id, effectId: "12115:response:1" }, ctx)).state;
    expect([flagged(used, a, "noExhaustQuest"), flagged(used, captain.id, "noExhaustQuest"), flagged(used, b, "noExhaustQuest")]).toEqual([true, true, false]);
    const split = put(state, "12115", "hand");
    const shared = expectOk(reduce(split.state, { type: "PlayCard", cardId: split.id, payments: [{ heroId: a, amount: 1 }, { heroId: b, amount: 1 }] }, ctx)).state;
    const none = expectOk(reduce(shared, { type: "Trigger", cardId: split.id, effectId: "12115:response:1" }, ctx)).state;
    expect([flagged(none, a, "noExhaustQuest"), flagged(none, split.id, "noExhaustQuest")]).toEqual([false, false]);
  });

  it("Inspiring Presence: heroes with lower threat cost than the chosen hero get +2 Defense, and +2 Attack if the group spends 2 Leadership", () => {
    const { state, ids, ctx } = table(RECORDS, CARDS, [["lead", "spirit"], ["lead"]]);
    const [high = "", low = ""] = ids[0] ?? [];
    const other = ids[1]?.[0] ?? "";
    const event = put(updateCard(updateCard(state, high, { resources: 1 }), other, { resources: 1 }), "12143", "hand");
    const tall = put(event.state, "sam", "heroes");
    const played = expectOk(reduce(tall.state, { type: "PlayCard", cardId: event.id, payments: [{ heroId: high, amount: 1 }] }, ctx)).state;
    expect(played.window).toMatchObject({ kind: "choose" });
    // With 1 Leadership resource left among the players, spending is not offered: the effect ends with +2 Defense only.
    const chosen = expectOk(reduce(played, { type: "Choose", optionId: high }, ctx)).state;
    expect(chosen.window).toEqual({ kind: "pass" });
    expect([modifiedStat(chosen, chosen.cards[low]!, "defense", ctx.cards), modifiedStat(chosen, chosen.cards[low]!, "attack", ctx.cards)]).toEqual([3, 1]);
    const event2 = put(updateCard(updateCard(state, high, { resources: 2 }), other, { resources: 1 }), "12143", "hand");
    const heroAt = expectOk(reduce(event2.state, { type: "PlayCard", cardId: event2.id, payments: [{ heroId: high, amount: 1 }] }, ctx)).state;
    const spend = expectOk(reduce(heroAt.window?.kind === "choose" && heroAt.window.options.includes(high) ? expectOk(reduce(heroAt, { type: "Choose", optionId: high }, ctx)).state : heroAt, { type: "Choose", optionId: "spend" }, ctx)).state;
    expect(modifiedStat(spend, spend.cards[low]!, "defense", ctx.cards)).toBe(3);
    expect(modifiedStat(spend, spend.cards[low]!, "attack", ctx.cards)).toBe(3);
    expect(modifiedStat(spend, spend.cards[high]!, "attack", ctx.cards)).toBe(1);
    expect([spend.cards[high]?.resources, spend.cards[other]?.resources]).toEqual([0, 0]);
  });
});

describe("optional Doomed (rr.doomed-x, rr.may)", () => {
  it("Greyflood Wanderer: taking the Response gives it Doomed 2, raising each player's threat, then progress goes on each location", () => {
    const wanderer = card("08030", "ally", "lore", 3);
    const place = card("place", "location", null, null, { questPoints: 4, threat: 1 });
    const { state, ids, ctx } = table(RECORDS, [...CARDS, wanderer, place], [["lore"], ["lore"]]);
    const ally = put(put(state, "place", "staging").state, "08030", "hand");
    const start = withThreat(withThreat(ally.state, 0, 20), 1, 22);
    const played = expectOk(reduce(start, { type: "PlayCard", cardId: ally.id, payments: [{ heroId: ids[0]?.[0] ?? "", amount: 3 }] }, ctx)).state;
    expect(legalIntents(played, ctx)).toContainEqual({ type: "Pass" });
    const used = expectOk(reduce(played, { type: "Trigger", cardId: ally.id, effectId: "08030:response:1" }, ctx)).state;
    expect([used.seats[0].threat, used.seats[1].threat]).toEqual([22, 24]);
    expect(Object.values(used.cards).find((entry) => entry.code === "place")?.progress).toBe(1);
  });
});

describe("limits and the quest's success", () => {
  it("Steward of Orthanc: once a round for each player across every copy, giving the event Doomed 1 to draw", () => {
    const { state, ids, ctx } = table([...RECORDS, QUICK], CARDS, [["lore"]]);
    const one = put(state, "17037", "play");
    const two = put(one.state, "17037", "play");
    const first = put(two.state, "quick", "hand");
    const copy = put(first.state, "quick", "hand");
    const second = { ...put(copy.state, "filler", "deck"), id: copy.id };
    const ready = withThreat(put(second.state, "filler", "deck").state, 0, 20);
    const played = expectOk(reduce(ready, { type: "PlayCard", cardId: first.id, payments: [] }, ctx)).state;
    const offered = legalIntents(played, ctx).filter((intent) => intent.type === "Trigger");
    expect(offered.length).toBe(2);
    const used = expectOk(reduce(played, offered[0] as Parameters<typeof reduce>[1], ctx)).state;
    expect(used.seats[0].threat).toBe(21);
    const playedAgain = expectOk(reduce(used.window?.kind === "response" ? expectOk(reduce(used, { type: "Pass" }, ctx)).state : used, { type: "PlayCard", cardId: second.id, payments: [] }, ctx)).state;
    expect(legalIntents(playedAgain, ctx).some((intent) => intent.type === "Trigger")).toBe(false);
    expect(ids.length).toBe(1);
  });

  it("remembers a successful quest for the round only in a game that reads it (Frodo Baggins)", () => {
    const { state, ctx } = table(RECORDS, CARDS, [["sam"]]);
    const event = { trigger: "questSucceeded" as const, seat: 0 };
    expect(noteEvent(state, event, ctx).quested).toBeUndefined();
    const withFrodo = put(state, "21002", "heroes");
    const committed = noteEvent(withFrodo.state, { trigger: "committed", seat: 0, cardId: withFrodo.id }, ctx);
    const noted = noteEvent(committed, event, ctx);
    const scope = { actor: 0, sourceId: withFrodo.id, returned: 0 };
    expect(holds(noted, { kind: "questSucceeded" }, scope, ctx)).toBe(true);
    expect(holds(noted, { kind: "questSucceeded", committed: true }, scope, ctx)).toBe(true);
    expect(holds(noted, { kind: "questSucceeded", committed: true }, { ...scope, sourceId: "other" }, ctx)).toBe(false);
    expect(holds({ ...noted, round: 2 }, { kind: "questSucceeded" }, scope, ctx)).toBe(false);
  });

  it("Hirgon: after he quests successfully, a Tactics ally is played from the hand for 1 less (not below 1), then may get +1/+1", () => {
    const hirgon = card("17055", "hero", "tactics", null, { threat: 10, willpower: 5 });
    const pikeman = card("pike", "ally", "tactics", 2);
    const stage = card("stage", "quest", null, null, { questPoints: 20 });
    const { state, ids, ctx } = table(RECORDS, [...CARDS, hirgon, pikeman, stage], [["tac"]]);
    const hero = put(state, "17055", "heroes");
    const ally = put(hero.state, "pike", "hand");
    const questing = { ...ally.state, phase: "Quest" as const, mode: "questCommit" as const, boundaryPhase: "Quest" as const };
    const committed = expectOk(reduce(questing, { type: "Commit", cardIds: [hero.id] }, ctx)).state;
    let next = committed;
    for (let guard = 0; guard < 12 && !(next.window?.kind === "response"); guard += 1) next = expectOk(reduce(next, { type: "Pass" }, ctx)).state;
    expect(legalIntents(next, ctx)).toContainEqual({ type: "Trigger", cardId: hero.id, effectId: "17055:response:1" });
    const used = expectOk(reduce(next, { type: "Trigger", cardId: hero.id, effectId: "17055:response:1" }, ctx)).state;
    expect(used.cards[ally.id]?.zone).toBe("play");
    expect(used.cards[ids[0]?.[0] ?? ""]?.resources).toBe(2);
    const raised = expectOk(reduce(used, { type: "Choose", optionId: "raise" }, ctx)).state;
    expect(modifiedStat(raised, raised.cards[ally.id]!, "attack", ctx.cards)).toBe(2);
  });
});
