// Rules: mec108.orc-deck, mec108.campaign-setup-the-weather-hills, rr.travel, rr.damage, rr.cancel, faq.enemy-attacks-outside-combat, ltp.permanent (data/rules/entries.json);
// ledger lines 09026:A:2, 09029:A:2, 09030:A:1, 09055:A:2, 09056:A:1, 09069:B:2, 10159:A:2, 10160:A:3, 10165:A:4. The cards of The Weather Hills whose records use the angmar family's verbs, on tables built from data/ by the layout kit.
import { describe, expect, it } from "vitest";

import { flagged, updateCard, type ScenarioState } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { settle } from "../../engine/machine.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { setCurrentQuest } from "./quest.ts";
import { travelCostUnpayable } from "../../interpret/restrictions.ts";
import { queueEvent } from "../../windows/queue.ts";
import { idOf, legalIntents, resolveRecords, send, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const built = (layout: Layout = {}) => tableFromLayout("the-weather-hills", layout);

describe("the Orc deck", () => {
  it("09069:B:2 reveals the top card of the Orc deck for the first player when the active location is explored, and an empty deck does nothing", () => {
    const t = built({ piles: { angmarOrcDeck: ["09044", "09043"] } });
    const run = resolveRecords(t.state, t.ctx, "09069", "forced", t.state.questStage ?? "");
    expect(run.state.staging.map((id) => run.state.cards[id]?.code)).toContain("09044");
    expect((run.state.piles?.angmarOrcDeck ?? []).map((id) => run.state.cards[id]?.code)).toEqual(["09043"]);
    const empty = built({ piles: { angmarOrcDeck: [] } });
    const none = resolveRecords(empty.state, empty.ctx, "09069", "forced", empty.state.questStage ?? "");
    expect(none.state.staging).toEqual(empty.state.staging);
  });
});

describe("Amon Forn", () => {
  it("09026:A:2 makes an Orc enemy added to the staging area attack the first player while Amon Forn is the active location, and not otherwise", () => {
    const t = built({ active: "09026", staging: ["09044"] });
    const orc = idOf(t.state, "09044");
    const added = settle(queueEvent(t.state, { trigger: "addedToStaging", seat: null, cardId: orc, subject: orc }), t.ctx, []);
    expect(added.pendingAttack?.enemyId).toBe(orc);
    const other = built({ active: "09028", staging: ["09044"] });
    const quiet = settle(queueEvent(other.state, { trigger: "addedToStaging", seat: null, cardId: idOf(other.state, "09044"), subject: idOf(other.state, "09044") }), other.ctx, []);
    expect(quiet.pendingAttack).toBeFalsy();
  });
});

describe("the Mission objective", () => {
  it("09029:A:2 cannot be paid while no Mission objective holds a resource token, and 09030:A:1 places one on it", () => {
    const empty = built({ staging: ["09029", "09071"] });
    expect(travelCostUnpayable(empty.state, empty.ctx, idOf(empty.state, "09029"))).toBe(true);
    const held = built({ staging: ["09029", { code: "09071", resources: 1 }] });
    expect(travelCostUnpayable(held.state, held.ctx, idOf(held.state, "09029"))).toBe(false);
    const paid = resolveRecords(held.state, held.ctx, "09029", "travel", idOf(held.state, "09029"));
    expect(paid.state.cards[idOf(paid.state, "09071")]?.resources).toBe(0);
    const camp = built({ staging: ["09030", "09071"] });
    const placed = resolveRecords(camp.state, camp.ctx, "09030", "response", idOf(camp.state, "09030"));
    expect(placed.state.cards[idOf(placed.state, "09071")]?.resources).toBe(1);
  });
});

describe("Mysterious Omens", () => {
  const BOONS = ["10161", "10162", "10163", "10164", "10165"];
  const attachedTo = (state: ReturnType<typeof built>["state"], hero: string) => state.cards[hero]?.attachments.map((id) => state.cards[id]?.code);

  it("10160:A:3 offers each player, the first player first, the boons not yet taken, and attaches the one chosen to a hero they control", () => {
    const t = built({ seats: 2, setAside: BOONS, staging: ["10160"] });
    const run = resolveRecords(t.state, t.ctx, "10160", "forced", idOf(t.state, "10160"));
    expect(attachedTo(run.state, idOf(run.state, "dh1"))).toEqual(["10161"]);
    expect(attachedTo(run.state, run.state.seats[1]?.heroes[0] ?? "")).toEqual(["10162"]);
    expect(run.state.setAside.map((id) => run.state.cards[id]?.code)).toEqual(["10163", "10164", "10165"]);
    expect(run.state.removedFromPool?.map((entry) => entry.code)).toEqual(["10160"]);
  });

  it("10160:A:3 lets a player decline, and offers nothing once every boon is taken", () => {
    const t = built({ seats: 2, setAside: BOONS, staging: ["10160"] });
    const declined = resolveRecords(t.state, t.ctx, "10160", "forced", idOf(t.state, "10160"), (state) => (state.window?.kind === "choose" && state.window.options.includes("none") ? "none" : (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "")));
    expect(attachedTo(declined.state, idOf(declined.state, "dh1"))).toEqual([]);
    expect(attachedTo(declined.state, declined.state.seats[1]?.heroes[0] ?? "")).toEqual([]);
    expect(declined.state.setAside).toHaveLength(5);
    const none = built({ staging: ["10160"] });
    const quiet = resolveRecords(none.state, none.ctx, "10160", "forced", idOf(none.state, "10160"));
    expect(quiet.state.cards[idOf(quiet.state, "dh1")]?.attachments).toEqual([]);
  });
});

describe("the side quests and the damage the log noted", () => {
  it("09054:A:1 attaches to the side quest that is the current quest, and to the main quest card otherwise", () => {
    const t = built({ staging: ["09032"] });
    const side = idOf(t.state, "09032");
    const current = setCurrentQuest(t.state, side, t.ctx);
    const run = resolveRecords(current, t.ctx, "09054", "whenRevealed");
    expect(run.state.cards[idOf(run.state, "09054")]?.host).toBe(side);
    const plain = resolveRecords(t.state, t.ctx, "09054", "whenRevealed");
    expect(plain.state.cards[idOf(plain.state, "09054")]?.host).toBe(plain.state.questStage);
  });

  it("09055:A:2 stops healing while Make Camp is in the staging area, and 09055:A:3 heals up to 3 damage when it is defeated", () => {
    const t = built({ staging: ["09055"], hand: [] });
    const hero = idOf(t.state, "dh1");
    const hurt = settle(updateCard(t.state, hero, { damage: 4 }), t.ctx, []);
    expect(flagged(hurt, hero, "cannotBeHealed")).toBe(true);
    const away = built({ victory: ["09055"] });
    const healed = settle(updateCard(away.state, idOf(away.state, "dh1"), { damage: 4 }), away.ctx, []);
    expect(flagged(healed, idOf(healed, "dh1"), "cannotBeHealed")).toBe(false);
    const run = resolveRecords(updateCard(away.state, idOf(away.state, "dh1"), { damage: 4 }), away.ctx, "09055", "response", idOf(away.state, "09055"));
    expect(run.state.cards[idOf(run.state, "dh1")]?.damage).toBe(1);
  });

  it("10159:A:2 places on Protect the Innocent the damage the log noted for it, none without a note", () => {
    const t = built({ staging: ["10158"] });
    const logged = { ...t.state, campaignFacts: { angmar: { protectDamage: 3, heroDamage: {}, determined: [], stolen: [] } } as unknown as ScenarioState["campaignFacts"] };
    const placed = runInstruction(logged, { verb: "PlaceLoggedDamageOn", code: "10158" }, { seat: 0, sourceId: null }, t.ctx, []);
    expect(placed.cards[idOf(placed, "10158")]?.damage).toBe(3);
    const none = runInstruction(t.state, { verb: "PlaceLoggedDamageOn", code: "10158" }, { seat: 0, sourceId: null }, t.ctx, []);
    expect(none.cards[idOf(none, "10158")]?.damage).toBe(0);
  });

  it("09056:A:1 hears the cancel of a treachery's When Revealed effect with the treachery as its subject, and not the cancel of an enemy's", () => {
    const t = built({ staging: ["09056"] });
    const ruins = idOf(t.state, "09056");
    const treachery = spawn(t.state, "09052", { zone: "staging" });
    const heard = settle(queueEvent(treachery.state, { trigger: "whenRevealedCanceled", seat: 0, subject: treachery.id }), t.ctx, []);
    expect(heard.seats[0]?.threat).toBe((t.state.seats[0]?.threat ?? 0) + 2);
    const enemy = spawn(t.state, "09044", { zone: "staging" });
    const quiet = settle(queueEvent(enemy.state, { trigger: "whenRevealedCanceled", seat: 0, subject: enemy.id }), t.ctx, []);
    expect(quiet.seats[0]?.threat).toBe(t.state.seats[0]?.threat);
    expect(ruins).toBeTruthy();
  });
});

describe("Stalwart", () => {
  it("10165:A:4 lets its hero's controller play an attachment from their discard pile on that hero, once", () => {
    const t = built({ phase: "Planning", attached: [{ code: "10165", to: "dh1" }] });
    const hero = idOf(t.state, "dh1");
    const dropped = spawn(t.state, "attachment", { zone: "discard", seat: 0 });
    const plays = (state: ScenarioState) => legalIntents(state, t.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === dropped.id);
    expect(plays(dropped.state)).toBe(false);
    const action = resolveRecords(dropped.state, t.ctx, "10165", "action", idOf(dropped.state, "10165"), undefined, false);
    expect(plays(action.state)).toBe(true);
    const played = send({ state: action.state, steps: [] }, { type: "PlayCard", cardId: dropped.id, payments: [], hostId: hero }, t.ctx);
    expect(played.state.cards[dropped.id]?.host).toBe(hero);
    expect(played.state.modifiers.some((modifier) => modifier.stat === "attachmentFromDiscard")).toBe(false);
  });
});
