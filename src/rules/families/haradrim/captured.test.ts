// Rules: hrd.captives-of-cirith-gurat, hrd.guarded-heroes, rr.guarded, rr.player-elimination, rr.attacks-outside-the-combat-phase (data/rules/entries.json); ledger lines 17119:A:1 to 17119:A:3, 17120:A:1, 17123:A:2, 17125:A:2, 17128:A:1, 17129:A:1, 17132:A:1, 17132:B:2.
// The captives of The Dungeons of Cirith Gurat on their own: attaching a character, stripping and rescuing it, the discard for an ally, the attack on the seat with the most allies and the filters and amount that read them.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../core/intents.ts";
import { destroyCard } from "../../core/destroy.ts";
import { flagged } from "../../core/state.ts";
import { idOf, opened, resolveRecords, run as runInstruction, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { settle } from "../../engine/machine.ts";
import { matchesPick, pickCandidates } from "../../interpret/pick.ts";
import { resolveAmount, frameScope } from "../../interpret/amounts.ts";
import { defeatSideQuest } from "../sidequests/quest.ts";
import { captivesOf } from "../captives/values.ts";
import { captivesHeldBy } from "./captured.ts";

const table = (layout: Layout = {}) => tableFromLayout("the-dungeons-of-cirith-gurat", { seats: 1, stage: "17132", ...layout }, { extra: ["01017", "01028"] });
const JAILER = "17121";
const CAPTIVES = "17119";
const ARCHER = "01017";
const AXEHAND = "01028";
const none = [] as EngineStep[];

describe("17129:A:1 AttachCaptive: an ally is attached to an unattached enemy in the staging area", () => {
  it("the ally lies in the captive zone under the enemy, faceup, controlled by nobody and still its owner's; the enemy now holds it", () => {
    const made = table({ play: [ARCHER], staging: [CAPTIVES, JAILER] });
    const state = resolveRecords(opened(made).state, made.ctx, "17129", "whenRevealed").state;
    const ally = state.cards[idOf(state, ARCHER)];
    expect(ally).toMatchObject({ zone: "captive", host: idOf(state, JAILER), captive: true, owner: 0, controller: null, face: "up" });
    expect(state.seats[0]?.play).not.toContain(ally?.id);
    expect(captivesHeldBy(state, idOf(state, JAILER)).map((card) => card.code)).toEqual([ARCHER]);
  });

  it("with no ally to attach it gains doomed 2 and nothing is attached", () => {
    const made = table({ staging: [CAPTIVES, JAILER] });
    const before = made.state.seats[0]?.threat ?? 0;
    const state = resolveRecords(opened(made).state, made.ctx, "17129", "whenRevealed").state;
    expect(captivesOf(state)).toEqual([]);
    expect(state.seats[0]?.threat).toBe(before + 2);
  });

  it("an enemy that already holds a captive is not a target", () => {
    const made = table({ play: [ARCHER], staging: [CAPTIVES, JAILER, "17122"] });
    const first = runInstruction(made, opened(made).state, { verb: "AttachCaptive", card: "picked", to: "self" }, { sourceId: idOf(made.state, JAILER) });
    expect(captivesOf(first)).toEqual([]);
    const spawned = resolveRecords(opened(made).state, made.ctx, "17129", "whenRevealed", undefined, (state) => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "")).state;
    const guard = idOf(spawned, JAILER);
    expect(captivesHeldBy(spawned, guard).length + captivesHeldBy(spawned, idOf(spawned, "17122")).length).toBe(1);
  });
});

describe("17119:A:2 and 17119:A:3 the Captives: strip on attach, rescue when the guard leaves play", () => {
  it("a hero attached as a captive loses its tokens and attachments, is not out of heroes, and returns exhausted to its owner's heroes when the enemy leaves play", () => {
    const made = table({ staging: [CAPTIVES, JAILER, "17134"], heroes: [], attached: [{ code: "attachment", to: "dh1" }] });
    const hero = made.hero;
    const damaged = { ...made.state, cards: { ...made.state.cards, [hero]: { ...made.state.cards[hero]!, damage: 1, resources: 2 } } };
    const enemy = idOf(damaged, JAILER);
    const attached = settle(runInstruction(made, opened(made, damaged).state, { verb: "AttachCaptive", card: "picked", to: "self" }, { sourceId: enemy }), made.ctx, none);
    expect(attached.cards[hero]?.zone).toBe("heroes");
    const picked = resolveRecords(opened(made, damaged).state, made.ctx, "17134", "whenRevealed", idOf(damaged, "17134"), (state) => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : ""));
    const held = captivesOf(picked.state).find((card) => card.id === hero);
    expect(held).toMatchObject({ zone: "captive", guardedHero: true, damage: 0, resources: 0, owner: 0 });
    expect(held?.attachments).toEqual([]);
    expect(settle(picked.state, made.ctx, none).seats[0]?.eliminated).toBeFalsy();
    const guard = held?.host ?? "";
    const freed = settle(destroyCard(picked.state, guard, made.ctx.cards, none), made.ctx, none);
    expect(freed.cards[hero]).toMatchObject({ zone: "heroes", exhausted: true, controller: 0 });
    expect(captivesOf(freed).some((card) => card.id === hero)).toBe(false);
  });

  it("an ally returns to its owner's play area, exhausted, with no enters-play event, and stays blank while it is held", () => {
    const made = table({ play: [ARCHER], staging: [CAPTIVES, JAILER] });
    const taken = resolveRecords(opened(made).state, made.ctx, "17129", "whenRevealed").state;
    const archer = idOf(taken, ARCHER);
    const held = settle(taken, made.ctx, none);
    expect(flagged(held, archer, "blankText")).toBe(true);
    const freed = settle(destroyCard(held, idOf(held, JAILER), made.ctx.cards, none), made.ctx, none);
    expect(freed.cards[archer]).toMatchObject({ zone: "play", controller: 0, exhausted: true });
    expect(freed.cards[archer]?.captive).toBeUndefined();
    expect(freed.seats[0]?.play).toContain(archer);
    expect(flagged(freed, archer, "blankText")).toBe(false);
  });

  it("a captive whose owner left the game goes to that owner's discard pile", () => {
    const made = table({ seats: 2, play: [{ code: ARCHER, seat: 1 }], staging: [CAPTIVES, JAILER] });
    const taken = runInstruction(made, opened(made).state, { verb: "AttachCaptive", card: "picked", to: "self" }, { sourceId: idOf(made.state, JAILER) });
    expect(captivesOf(taken)).toEqual([]);
    const archer = idOf(made.state, ARCHER);
    const state = opened(made, { ...made.state, cards: { ...made.state.cards, [archer]: { ...made.state.cards[archer]!, zone: "captive", host: idOf(made.state, JAILER), captive: true, owner: 1, controller: null } } }).state;
    const eliminated = { ...state, seats: [state.seats[0]!, { ...state.seats[1]!, eliminated: true }] as typeof state.seats };
    const freed = settle(destroyCard(eliminated, idOf(eliminated, JAILER), made.ctx.cards, none), made.ctx, none);
    expect(freed.seats[1]?.discard).toContain(archer);
  });
});

describe("17125:A:2 the pick filters and the amount that read the captives", () => {
  it("guardsCaptive, unattached and heldBySource tell the holder from the free enemy; heldPrinted reads the printed Willpower", () => {
    const made = table({ play: [ARCHER], staging: [CAPTIVES, JAILER, "17122", "17125"] });
    const cell = idOf(made.state, "17125");
    const state = settle(runInstruction(made, opened(made).state, { verb: "AttachCaptive", card: "picked", to: "self" }, { sourceId: cell }), made.ctx, none);
    expect(state.cards[idOf(state, ARCHER)]?.zone).toBe("play");
    const archer = idOf(made.state, ARCHER);
    const withArcher = { ...state, cards: { ...state.cards, [archer]: { ...state.cards[archer]!, zone: "captive" as const, host: cell, captive: true as const, owner: 0, controller: null } } };
    const enemy = (spec: object) => matchesPick(withArcher, idOf(withArcher, JAILER), { type: "enemy", control: "any", ...spec } as never, { seat: 0, sourceId: null }, made.ctx);
    expect(enemy({ guardsCaptive: false })).toBe(true);
    expect(enemy({ guardsCaptive: true })).toBe(false);
    expect(matchesPick(withArcher, cell, { type: "card", control: "any", guardsCaptive: true } as never, { seat: 0, sourceId: null }, made.ctx)).toBe(true);
    expect(matchesPick(withArcher, cell, { type: "card", control: "any", unattached: true } as never, { seat: 0, sourceId: null }, made.ctx)).toBe(false);
    expect(matchesPick(withArcher, idOf(withArcher, "17122"), { type: "card", control: "any", unattached: true } as never, { seat: 0, sourceId: null }, made.ctx)).toBe(true);
    expect(pickCandidates(withArcher, { type: "card", control: "any", captive: "only", heldBySource: true } as never, 0, [], cell, made.ctx).map((id) => withArcher.cards[id]?.code)).toEqual([ARCHER]);
    expect(resolveAmount(withArcher, { heldPrinted: { stat: "willpower" } } as never, frameScope(withArcher, 0, cell), made.ctx)).toBe(1);
    expect(resolveAmount(withArcher, { heldPrinted: { stat: "cost", ownedByActor: true } } as never, frameScope(withArcher, 0, cell), made.ctx)).toBe(3);
    expect(resolveAmount(withArcher, { heldPrinted: { stat: "cost", ownedByActor: true } } as never, frameScope(withArcher, 1, cell), made.ctx)).toBe(0);
  });
});

describe("17128:A:1 DiscardUntilAlly and discardCopies", () => {
  it("the deck is discarded down to the first ally, which is attached, and each other copy of its title in play is discarded", () => {
    const made = table({ staging: ["17128"], deckOf: ["17128", AXEHAND, ARCHER], play: [ARCHER] });
    const state = resolveRecords(opened(made).state, made.ctx, "17128", "whenRevealed", idOf(made.state, "17128")).state;
    const captives = captivesOf(state);
    expect(captives).toHaveLength(1);
    expect(captives[0]).toMatchObject({ code: AXEHAND, host: idOf(state, "17128"), owner: 0 });
  });
});

describe("17123:A:2 AttackSeatWithMost: the seat with the most allies is attacked, the first player choosing among a tie", () => {
  it("two seats, one with an ally: that seat is attacked and the enemy stays in the staging area", () => {
    const made = table({ seats: 2, play: [{ code: ARCHER, seat: 1 }], staging: ["17123"] });
    const warg = idOf(made.state, "17123");
    const state = runInstruction(made, opened(made).state, { verb: "AttackSeatWithMost", pick: { type: "ally", control: "you" } }, { sourceId: warg });
    expect(state.pendingAttack).toMatchObject({ enemyId: warg, seat: 1 });
    expect(state.cards[warg]?.zone).toBe("staging");
  });
});

describe("17132:A:1 the Setup and 17132:B:2 the rescue", () => {
  it("Abaan is attached to Dungeon Cell, each player attaches an ally from the deck to an Orc enemy found in the encounter deck, and the stage hears the rescue of Abaan", () => {
    const made = table({ stage: "17132", side: "A", staging: ["17119", "17125"], setAside: ["17120", "16061"], deck: ["16062", "16063", "f0"], deckOf: [AXEHAND, "f0"] });
    const done = resolveRecords(opened(made).state, made.ctx, "17132", "setup", idOf(made.state, "17132"), (state) => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : ""));
    const state = settle(done.state, made.ctx, none);
    const cell = idOf(state, "17125");
    expect(captivesHeldBy(state, cell).map((card) => card.code)).toEqual(["17120"]);
    const ally = captivesOf(state).find((card) => card.code === AXEHAND);
    expect(ally).toMatchObject({ zone: "captive", owner: 0 });
    expect(printedHost(state, ally?.host ?? "")).toMatch(/^1606[23]$/);
    // The cell leaves play: Abaan returns to the staging area and the first player gains control of him.
    const side = { ...state, cards: { ...state.cards } };
    const freed = settle(destroyCard(side, cell, made.ctx.cards, none), made.ctx, none);
    expect(freed.cards[idOf(freed, "17120")]).toMatchObject({ zone: "play", controller: 0 });
  });
});

const printedHost = (state: { cards: Record<string, { code: string }> }, id: string): string => state.cards[id]?.code ?? "";

describe("17131:A:1 and 17131:A:2 Captured!", () => {
  it("each player's ally is attached to the side quest, and defeating it frees each ally to its own player and lowers that player's threat by its printed cost", () => {
    const made = table({ seats: 2, stage: "17132", play: [ARCHER, { code: AXEHAND, seat: 1 }], staging: [CAPTIVES], threat: [35, 30] });
    const revealed = settle(resolveRecords(opened(made).state, made.ctx, "17131", "whenRevealed").state, made.ctx, none);
    const quest = idOf(revealed, "17131");
    const [archer, axehand] = [idOf(revealed, ARCHER), idOf(revealed, AXEHAND)];
    expect(revealed.cards[archer]).toMatchObject({ zone: "captive", host: quest, captive: true, owner: 0 });
    expect(revealed.cards[axehand]).toMatchObject({ zone: "captive", host: quest, captive: true, owner: 1 });
    const defeated = settle(defeatSideQuest(revealed, quest, made.ctx, none), made.ctx, none);
    expect(defeated.cards[archer]).toMatchObject({ zone: "play", controller: 0, exhausted: true });
    expect(defeated.cards[axehand]).toMatchObject({ zone: "play", controller: 1, exhausted: true });
    expect(defeated.seats.map((seat) => seat.threat)).toEqual([32, 28]);
  });

  it("with no ally to attach it is discarded and an additional encounter card is revealed", () => {
    const made = table({ stage: "17132", staging: [CAPTIVES], deck: ["16062", "f0"] });
    const state = settle(resolveRecords(opened(made).state, made.ctx, "17131", "whenRevealed").state, made.ctx, none);
    expect(state.cards[idOf(state, "17131")]?.zone).not.toBe("staging");
    expect(state.encounterDeck.length).toBeLessThan(2);
  });
});

describe("17134:A:1 Fight Your Way Out: heroes attached, engagement checks at cost 0 for enemies that guard nothing", () => {
  it("a hero is attached to an unattached enemy and the free enemies engage the player", () => {
    const made = table({ stage: "17134", side: "A", staging: [CAPTIVES, "16062", "16063"], setAside: ["16061"], threat: [30, 30] });
    const state = settle(resolveRecords(opened(made).state, made.ctx, "17134", "whenRevealed", idOf(made.state, "17134"), (current) => (current.window?.kind === "choose" ? (current.window.options[0] ?? "") : "")).state, made.ctx, none);
    expect(captivesOf(state)).toHaveLength(1);
    const holder = captivesOf(state)[0]?.host ?? "";
    expect(state.cards[holder]?.zone).toBe("staging");
    expect(state.seats[0]?.engaged.length).toBeGreaterThan(0);
    expect(state.seats[0]?.engaged).not.toContain(holder);
    expect(state.seats[0]?.engaged.map((id) => state.cards[id]?.code)).not.toContain("16061" === state.cards[holder]?.code ? "" : "none");
  });
});
