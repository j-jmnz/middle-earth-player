// Rules: hrd.captives-of-cirith-gurat, hrd.guarded-heroes, rr.then, rr.forced, rr.travel, rr.shadow-effects, rr.engagement-check, rr.player-elimination (data/rules/entries.json); ledger lines of The Dungeons of Cirith Gurat (data/printed/haradrim.json).
// The lines a card-spec row cannot say (a real ally, a second table, the state between two steps) and the three shared engine reads the scenario needed. Each title starts with its line id; `lineSpec` runs a check again without the
// line's records and fails when it still passes (test/harness/line-spec.ts).
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { destroyAndAnnounce, destroyCard } from "../../../rules/core/destroy.ts";
import { eliminateEmpties } from "../../../rules/core/eliminate.ts";
import { ruleCause } from "../../../rules/core/cause.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { printedOf, type PrintedCard } from "../../../rules/core/printed.ts";
import { expireModifiers, flagged, updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { moveCard } from "../../../rules/core/zones.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { releaseHeldOnDefeat } from "../../../rules/families/angmar/hold.ts";
import { lowerThreatByEffect } from "../../../rules/families/quest/threat.ts";
import { captureHero } from "../../../rules/families/south/captive.ts";
import { fireForced } from "../../../rules/windows/triggers.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { play } from "../../../../test/harness/card-spec-play.ts";
import { attack, defend } from "../../../../test/harness/card-spec.ts";
import { costIncrease } from "../../../rules/player/cost-rules.ts";
import { idOf, opened, resolveRecords, run as runInstruction, statOf, tableFromLayout, where, type Layout } from "../../../../test/harness/scene-kit.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { captivesHeldBy, captivesOf } from "../../../rules/families/captives/values.ts";
import { defeatSideQuest } from "../../../rules/families/sidequests/quest.ts";

const CAPTIVES = "17119";
const GUARD = "17122";
const CELL = "17125";
const ARCHER = "01017";
const AXEHAND = "01028";
const none = [] as EngineStep[];
const first = (state: { window?: { kind?: string; options?: readonly string[] } | null }): string => (state.window?.kind === "choose" ? (state.window.options?.[0] ?? "") : "");

// The ally destroyed by damage: it leaves play and the Forced effects hear that it was destroyed.
const destroyed = (state: ScenarioState, id: string, ctx: { cards: ReadonlyMap<string, PrintedCard> }): ScenarioState => destroyAndAnnounce(state, state.cards[id]!, printedOf(ctx.cards, state.cards[id]!.code), ctx.cards, none);

const table = (layout: Layout, effects: readonly Effect[] = EFFECTS) => tableFromLayout("the-dungeons-of-cirith-gurat", { seats: 1, stage: "17132", ...layout }, { extra: [ARCHER, AXEHAND], effects });

describe("17119:A:1 a captive is a guarded objective until it is rescued", () => {
  lineSpec("17119:A:1", "a character attached to an encounter card is a guarded objective with a blank text box, and is neither once it is rescued", (effects) => {
    const made = table({ play: [AXEHAND], staging: [CAPTIVES, GUARD] }, effects);
    const taken = settle(runInstruction(made, opened(made).state, { verb: "AttachCaptive", card: "picked", to: "self" }, { sourceId: idOf(made.state, GUARD) }), made.ctx, none);
    const ally = idOf(taken, AXEHAND);
    expect(taken.cards[ally]?.zone).toBe("play");
    const state = settle(resolveRecords(opened(made).state, made.ctx, "17129", "whenRevealed").state, made.ctx, none);
    const held = idOf(state, AXEHAND);
    expect(flagged(state, held, "blankText")).toBe(true);
    const freed = settle(destroyCard(state, idOf(state, GUARD) in state.cards && state.cards[held]?.host ? (state.cards[held]?.host ?? "") : "", made.ctx.cards, none), made.ctx, none);
    expect(flagged(freed, held, "blankText")).toBe(false);
  });
});

describe("17122:A:2 Prison Guard attaches an ally it damages", () => {
  lineSpec("17122:A:2", "while it guards no objective an ally it attacked and damaged, still in play, is attached to it", (effects) => {
    const made = table({ play: [AXEHAND], staging: [CAPTIVES, GUARD] }, effects);
    const guard = idOf(made.state, GUARD);
    const ally = idOf(made.state, AXEHAND);
    const state = updateCard(opened(made).state, ally, { damage: 1 });
    const done = settle(fireForced({ ...state, window: null }, { trigger: "attackDamagedCharacter", seat: 0, cardId: guard, other: ally }, made.ctx, none), made.ctx, none);
    expect(done.cards[ally]).toMatchObject({ zone: "captive", host: guard, captive: true, owner: 0 });
  });

  it("17122:A:2 an ally the attack destroyed is not attached: it lies in its owner's discard pile", () => {
    const made = table({ play: [AXEHAND], staging: [CAPTIVES, GUARD] });
    const [guard, ally] = [idOf(made.state, GUARD), idOf(made.state, AXEHAND)];
    const dead = settle(destroyCard(opened(made).state, ally, made.ctx.cards, none), made.ctx, none);
    const done = settle(fireForced({ ...dead, window: null }, { trigger: "attackDamagedCharacter", seat: 0, cardId: guard, other: ally }, made.ctx, none), made.ctx, none);
    expect(done.cards[ally]?.zone).toBe("discard");
    expect(captivesOf(done)).toEqual([]);
  });

  it("17122:A:2 a Prison Guard that guards an objective does not attach the ally", () => {
    const made = table({ play: [AXEHAND], staging: [CAPTIVES, GUARD], heroes: ["dh3"], staged: [{ hero: "dh3", under: GUARD }] });
    const [guard, ally] = [idOf(made.state, GUARD), idOf(made.state, AXEHAND)];
    const done = settle(fireForced({ ...opened(made).state, window: null }, { trigger: "attackDamagedCharacter", seat: 0, cardId: guard, other: ally }, made.ctx, none), made.ctx, none);
    expect(done.cards[ally]?.zone).toBe("play");
  });
});

describe("17125:A:3 Dungeon Cell takes a destroyed ally", () => {
  lineSpec("17125:A:3", "while it is in the staging area and holds nothing, an ally that is destroyed is attached to it", (effects) => {
    const made = table({ play: [AXEHAND], staging: [CAPTIVES, CELL] }, effects);
    const state = settle(destroyed(opened(made).state, idOf(made.state, AXEHAND), made.ctx), made.ctx, none);
    expect(captivesHeldBy(state, idOf(state, CELL)).map((card) => card.code)).toEqual([AXEHAND]);
  });

  it("17125:A:3 with an objective already attached it takes no second ally", () => {
    const made = table({ play: [AXEHAND, ARCHER], staging: [CAPTIVES, CELL] });
    const first = settle(destroyed(opened(made).state, idOf(made.state, AXEHAND), made.ctx), made.ctx, none);
    const second = settle(destroyed(first, idOf(first, ARCHER), made.ctx), made.ctx, none);
    expect(captivesHeldBy(second, idOf(second, CELL)).map((card) => card.code)).toEqual([AXEHAND]);
    expect(second.cards[idOf(second, ARCHER)]?.zone).toBe("discard");
  });
});

describe("17126:A:2 Uruk Guardroom travel", () => {
  lineSpec("17126:A:2", "Travel: the encounter discard pile is shuffled into the deck and cards are discarded until an Orc enemy, which is added to the staging area", (effects) => {
    const made = table({ phase: "Travel", staging: ["17126"], discard: ["f0", "16062"], deck: ["f3"] }, effects);
    const state = resolveRecords(opened(made).state, made.ctx, "17126", "travel", idOf(made.state, "17126")).state;
    expect(where(state, "16062")).toBe("staging");
  });
});

describe("17126:A:1 Uruk Guardroom", () => {
  lineSpec("17126:A:1", "while it is in the staging area each ally costs 1 more to play, and each copy adds", (effects) => {
    const one = table({ staging: ["17126"], hand: ["ally"] }, effects);
    expect(costIncrease(opened(one).state, idOf(one.state, "ally"), 0, one.ctx)).toBe(1);
    const two = table({ staging: ["17126", "17126"], hand: ["ally"] }, effects);
    expect(costIncrease(opened(two).state, idOf(two.state, "ally"), 0, two.ctx)).toBe(2);
  });
});

describe("the durations of Cirith Gurat", () => {
  it("17120:A:2 the +1 Willpower, Attack and Defense ends at the end of the round", () => {
    const made = table({ play: ["17120"] });
    const state = resolveRecords(opened(made).state, made.ctx, "17120", "response", idOf(made.state, "17120")).state;
    expect(statOf(state, made.ctx.cards, "17120", "willpower")).toBe(2);
    const over = expireModifiers(state, ["endOfPhase", "endOfRound"]);
    expect([statOf(over, made.ctx.cards, "17120", "willpower"), statOf(over, made.ctx.cards, "17120", "attack"), statOf(over, made.ctx.cards, "17120", "defense")]).toEqual([1, 1, 1]);
  });

  it("17130:A:2 the +1 Defense lasts until the end of the phase and is gone after it", () => {
    const row = { line: "17130:A:2", layout: { staging: [CAPTIVES] }, act: [attack("f3", { shadow: "17130" }), defend("dh1")], expect: [] } as const;
    const done = play("the-dungeons-of-cirith-gurat", { ...row, act: attack("f3", { shadow: "17130" }) }, EFFECTS, false);
    expect(statOf(done.run.state, done.table.ctx.cards, "f3", "defense")).toBe(2);
    const over = expireModifiers(done.run.state, ["endOfPhase"]);
    expect(statOf(over, done.table.ctx.cards, "f3", "defense")).toBe(1);
  });
});

describe("17127:A:1 Mines of Cirith Gurat caps a player card's threat reduction", () => {
  lineSpec("17127:A:1", "while it is in the staging area a player card reduces a player's threat by at most 1, an encounter card's reduction is not capped", (effects) => {
    const made = table({ play: [AXEHAND], staging: ["17127", CAPTIVES, "17131"], threat: [35, 35] }, effects);
    const state = opened(made).state;
    const player = lowerThreatByEffect(state, 0, 3, idOf(state, AXEHAND), made.ctx, none, ruleCause("rr.forced"));
    expect(player.seats[0]?.threat).toBe(34);
    const encounter = lowerThreatByEffect(state, 0, 3, idOf(state, "17131"), made.ctx, none, ruleCause("rr.forced"));
    expect(encounter.seats[0]?.threat).toBe(32);
  });
});

describe("17127:A:2 Mines of Cirith Gurat travel", () => {
  lineSpec("17127:A:2", "Travel: each player discards the top 3 cards of his deck and raises his threat by 1 for each ally discarded", (effects) => {
    const made = table({ phase: "Travel", staging: ["17127"], deckOf: [AXEHAND, "f0", ARCHER, "f3"] }, effects);
    const state = resolveRecords(opened(made).state, made.ctx, "17127", "travel", idOf(made.state, "17127")).state;
    expect(state.seats[0]?.threat).toBe(30);
    expect(state.seats[0]?.discard).toHaveLength(3);
  });
});

describe("17128:A:1 Torture Room", () => {
  lineSpec("17128:A:1", "When Revealed: the first player discards until an ally, which is attached to Torture Room, and each other copy in play is discarded", (effects) => {
    const made = table({ staging: ["17128", CAPTIVES], deckOf: ["17128", AXEHAND, ARCHER], play: [ARCHER] }, effects);
    const state = resolveRecords(opened(made).state, made.ctx, "17128", "whenRevealed", idOf(made.state, "17128")).state;
    expect(captivesHeldBy(state, idOf(state, "17128")).map((card) => card.code)).toEqual([AXEHAND]);
  });
});

describe("17133:B:2 Sneak Past the Guards resource", () => {
  it("17133:B:2 with no encounter card to reveal no resource is placed (rr.then)", () => {
    const made = table({ stage: "17133" });
    const state = resolveRecords(opened(made).state, made.ctx, "17133", "forced", idOf(made.state, "17133")).state;
    expect(state.cards[idOf(state, "17133")]?.resources ?? 0).toBe(0);
  });

  it("17133:B:2 an enemy still engaged from an earlier round does not stop the resource", () => {
    const made = table({ stage: "17133", engaged: [{ code: "f0", seat: 0 }], deck: ["f3"] });
    const state = resolveRecords(opened(made).state, made.ctx, "17133", "forced", idOf(made.state, "17133")).state;
    expect(state.cards[idOf(state, "17133")]?.resources).toBe(1);
  });
});

describe("17124:A:2 Gate of Iron with nothing to discard", () => {
  it("17124:A:2 with an empty encounter deck and discard pile nothing is discarded and the text after Then does not resolve", () => {
    const made = table({ phase: "Travel", staging: ["17124"], hand: ["event"] });
    const before = made.state.seats[0]?.threat;
    const state = resolveRecords(opened(made).state, made.ctx, "17124", "travel", idOf(made.state, "17124")).state;
    expect(state.window?.kind).not.toBe("choose");
    expect(state.seats[0]?.threat).toBe(before);
  });
});

describe("17132:B:1 Rescue the Prisoners immunity reads enemies and locations only", () => {
  it("17132:B:1 the side quest Captured! that holds an ally is not immune to player card effects", () => {
    const made = table({ stage: "17132", staging: [CAPTIVES, "17131"], play: [AXEHAND] });
    const revealed = settle(resolveRecords(opened(made).state, made.ctx, "17131", "whenRevealed").state, made.ctx, none);
    expect(captivesOf(revealed)).toHaveLength(1);
    expect(flagged(revealed, idOf(revealed, "17131"), "immuneToPlayerCards")).toBe(false);
  });
});

describe("17134:A:1 Fight Your Way Out", () => {
  const FIGHT: Layout = { stage: "17134", side: "A", staging: [CAPTIVES, "16062", "16063"], setAside: ["16061"], threat: [30, 30] };
  const reveal = (layout: Layout) => {
    const made = table({ ...FIGHT, ...layout });
    return { made, state: settle(resolveRecords(opened(made).state, made.ctx, "17134", "whenRevealed", idOf(made.state, "17134"), first).state, made.ctx, none) };
  };

  it("17134:A:1 the hero's tokens and attachments are discarded before it is attached", () => {
    const made = table({ ...FIGHT, attached: [{ code: "attachment", to: "dh1" }] });
    const hero = made.hero;
    const damaged = { ...made.state, cards: { ...made.state.cards, [hero]: { ...made.state.cards[hero]!, damage: 2, resources: 1 } } };
    const state = settle(resolveRecords(opened(made, damaged).state, made.ctx, "17134", "whenRevealed", idOf(damaged, "17134"), first).state, made.ctx, none);
    expect(state.cards[hero]).toMatchObject({ damage: 0, resources: 0 });
    expect(state.cards[hero]?.attachments).toEqual([]);
  });

  it("17134:A:1 each enemy that guards nothing checks with engagement cost 0 and the guarded one does not engage", () => {
    const { state } = reveal({});
    expect(captivesOf(state)).toHaveLength(1);
    const holder = captivesOf(state)[0]?.host ?? "";
    expect(state.seats[0]?.engaged).not.toContain(holder);
    expect(state.seats[0]?.engaged.length).toBeGreaterThan(0);
  });

  it("17134:A:1 the engagement cost 0 lasts for the checks only: a later check reads the printed engagement cost", () => {
    const { made, state } = reveal({});
    const loose = Object.values(state.cards).find((card) => card.zone === "staging" && ["16062", "16063", "16061"].includes(card.code) && !captivesHeldBy(state, card.id).length);
    if (loose) expect(made.ctx.cards.get(loose.code)?.engagementCost ?? 0).toBeGreaterThan(0);
    expect(state.modifiers.filter((modifier) => modifier.stat === "engagementCost")).toEqual([]);
  });

  it("17134:A:1 with a player who cannot attach a hero no engagement check is made", () => {
    const { state } = reveal({ staging: [CAPTIVES], threat: [49, 49] });
    expect(state.seats[0]?.engaged).toEqual([]);
  });
});

describe("17134:B:1 Fight Your Way Out beginning of the quest phase", () => {
  lineSpec("17134:B:1", "Forced: at the beginning of the quest phase cards are discarded until an enemy, which is added to the staging area", (effects) => {
    const made = table({ stage: "17134", deck: ["treachery", "f3"] }, effects);
    const state = resolveRecords(opened(made).state, made.ctx, "17134", "forced", idOf(made.state, "17134")).state;
    expect(where(state, "f3")).toBe("staging");
  });
});

describe("the shared reads the scenario changed leave other scenarios as they were", () => {
  it("17119:A:3 eliminate.ts: a held ally keeps no seat in the game, a held hero without a hero slot (Lost in Mirkwood) and a Captive hero with one still do", () => {
    const made = table({ play: [AXEHAND], staging: [CAPTIVES, GUARD] });
    const [guard, ally] = [idOf(made.state, GUARD), idOf(made.state, AXEHAND)];
    const base = opened(made).state;
    const empty = (state: typeof base) => ({ ...state, seats: state.seats.map((seat, index) => (index === 0 ? { ...seat, heroes: [] } : seat)) as unknown as typeof base.seats });
    const heldAlly = empty(updateCard(moveCard(base, ally, { zone: "captive", hostId: guard }), ally, { captive: true, owner: 0, controller: null }));
    expect(eliminateEmpties(heldAlly, [], false).seats[0]?.eliminated).toBe(true);
    const hero = made.hero;
    const guarded = empty(updateCard(moveCard(base, hero, { zone: "captive", hostId: guard }), hero, { guardedHero: true, owner: 0 }));
    expect(eliminateEmpties(guarded, [], false).seats[0]?.eliminated).toBeFalsy();
    const slotted = empty(updateCard(moveCard(base, hero, { zone: "captive", hostId: guard }), hero, { captive: true, heroSlot: 0, owner: 0 }));
    expect(eliminateEmpties(slotted, [], false).seats[0]?.eliminated).toBeFalsy();
  });

  it("17119:A:3 zones.ts: an enemy or location that holds a captive announces that it left play, also from the active location; one that holds none does not", () => {
    const made = table({ play: [AXEHAND], staging: [CAPTIVES, GUARD, "17125"] });
    const base = opened(made).state;
    const cell = idOf(base, "17125");
    const withActive = moveCard(base, cell, { zone: "activeLocation" });
    const attached = updateCard(moveCard(withActive, idOf(base, AXEHAND), { zone: "captive", hostId: cell }), idOf(base, AXEHAND), { captive: true, owner: 0, controller: null });
    const leftHolding = moveCard({ ...attached, pendingEvents: [] }, cell, { zone: "encounterDiscard" });
    expect((leftHolding.pendingEvents ?? []).filter((event) => event.trigger === "leftPlay" && event.cardId === cell)).toHaveLength(1);
    const bare = moveCard({ ...moveCard(base, cell, { zone: "activeLocation" }), pendingEvents: [] }, cell, { zone: "encounterDiscard" });
    expect((bare.pendingEvents ?? []).filter((event) => event.trigger === "leftPlay" && event.cardId === cell)).toHaveLength(0);
  });

  it("17119:A:3 angmar/hold.ts: a card held under a side quest that is no Captive of Cirith Gurat still goes to the first player when it is defeated", () => {
    const made = table({ play: [AXEHAND], staging: [CAPTIVES, "17131"] });
    const base = opened(made).state;
    const [quest, ally] = [idOf(base, "17131"), idOf(base, AXEHAND)];
    const heldOther = captureHero(base, ally, quest);
    expect(releaseHeldOnDefeat(heldOther, quest).cards[ally]?.zone).toBe("play");
    const captive = updateCard(moveCard(base, ally, { zone: "captive", hostId: quest }), ally, { captive: true, owner: 0, controller: null });
    expect(releaseHeldOnDefeat(captive, quest).cards[ally]?.zone).toBe("captive");
  });
});

const pickFirst = (state: ScenarioState): string => first(state);

describe("the captives and the cards that take them", () => {
  lineSpec("17119:A:2", "Forced: when a character is attached to an encounter card its tokens and attachments are discarded", (effects) => {
    const made = table({ play: [AXEHAND], staging: [CAPTIVES, GUARD], attached: [{ code: "attachment", to: AXEHAND }] }, effects);
    const ally = idOf(made.state, AXEHAND);
    const hurt = updateCard(opened(made).state, ally, { damage: 1, resources: 1 });
    const state = settle(runInstruction(made, hurt, { verb: "AttachCaptive", card: "picked", to: "self" }, { sourceId: idOf(made.state, GUARD) }), made.ctx, none);
    const held = settle(resolveRecords(hurt, made.ctx, "17129", "whenRevealed").state, made.ctx, none);
    expect(state.cards[ally]).toBeDefined();
    expect(held.cards[ally]).toMatchObject({ zone: "captive", damage: 0, resources: 0 });
    expect(held.cards[ally]?.attachments).toEqual([]);
  });

  lineSpec("17120:A:1", "While Abaan is free of encounters the first player gains control of him", (effects) => {
    const made = table({ staging: [CAPTIVES, CELL], setAside: ["17120"] }, effects);
    const cell = idOf(made.state, CELL);
    const held = settle(runInstruction(made, opened(made).state, { verb: "AttachCaptive", code: "17120", to: "self" }, { sourceId: cell }), made.ctx, none);
    expect(held.cards[idOf(held, "17120")]?.zone).toBe("captive");
    const freed = settle(destroyCard(held, cell, made.ctx.cards, none), made.ctx, none);
    expect(freed.cards[idOf(freed, "17120")]).toMatchObject({ zone: "play", controller: 0 });
  });

  lineSpec("17123:A:2", "When Revealed: it makes an immediate attack against the player who controls the most allies", (effects) => {
    const made = table({ seats: 2, play: [{ code: ARCHER, seat: 1 }], staging: ["17123"] }, effects);
    const state = resolveRecords(opened(made).state, made.ctx, "17123", "whenRevealed", idOf(made.state, "17123"), pickFirst).state;
    expect(state.pendingAttack).toMatchObject({ seat: 1 });
  });

  lineSpec("17125:A:2", "Dungeon Cell gets +X Threat, X the printed Willpower of the objective attached to it", (effects) => {
    const made = table({ play: [ARCHER], staging: [CAPTIVES, CELL] }, effects);
    const cell = idOf(made.state, CELL);
    const state = settle(runInstruction(made, opened(made).state, { verb: "AttachCaptive", card: "picked", to: "self" }, { sourceId: cell }), made.ctx, none);
    const archer = idOf(state, ARCHER);
    const held = updateCard(moveCard(state, archer, { zone: "captive", hostId: cell }), archer, { captive: true, owner: 0, controller: null });
    expect(statOf(opened(made, held).state, made.ctx.cards, CELL, "threat")).toBe(2);
  });

  lineSpec("17129:A:1", "When Revealed: the first player attaches an ally to an unattached enemy in the staging area; with none it gains doomed 2", (effects) => {
    const made = table({ play: [ARCHER], staging: [CAPTIVES, "17121"] }, effects);
    const state = settle(resolveRecords(opened(made).state, made.ctx, "17129", "whenRevealed", undefined, pickFirst).state, made.ctx, none);
    expect(captivesHeldBy(state, idOf(state, "17121")).map((card) => card.code)).toEqual([ARCHER]);
    const bare = table({ staging: [CAPTIVES] }, effects);
    const before = bare.state.seats[0]?.threat ?? 0;
    expect(resolveRecords(opened(bare).state, bare.ctx, "17129", "whenRevealed").state.seats[0]?.threat).toBe(before + 2);
  });

  lineSpec("17131:A:1", "When Revealed: each player's ally is attached to Captured! and it is discarded with an additional encounter card revealed when none is", (effects) => {
    const made = table({ seats: 2, play: [ARCHER, { code: AXEHAND, seat: 1 }], staging: [CAPTIVES] }, effects);
    const revealed = settle(resolveRecords(opened(made).state, made.ctx, "17131", "whenRevealed").state, made.ctx, none);
    const quest = idOf(revealed, "17131");
    expect(revealed.cards[idOf(revealed, ARCHER)]).toMatchObject({ zone: "captive", host: quest, owner: 0 });
    expect(revealed.cards[idOf(revealed, AXEHAND)]).toMatchObject({ zone: "captive", host: quest, owner: 1 });
    const none1 = table({ staging: [CAPTIVES], deck: ["16062", "f0"] }, effects);
    const bare = settle(resolveRecords(opened(none1).state, none1.ctx, "17131", "whenRevealed").state, none1.ctx, none);
    expect(bare.cards[idOf(bare, "17131")]?.zone).not.toBe("staging");
  });

  lineSpec("17131:A:2", "Forced: when it is defeated each player reduces his threat by the printed cost of the ally of his that was attached, and the allies are rescued", (effects) => {
    const made = table({ seats: 2, play: [ARCHER, { code: AXEHAND, seat: 1 }], staging: [CAPTIVES], threat: [35, 30] }, effects);
    const revealed = settle(resolveRecords(opened(made).state, made.ctx, "17131", "whenRevealed").state, made.ctx, none);
    const defeated = settle(defeatSideQuest(revealed, idOf(revealed, "17131"), made.ctx, none), made.ctx, none);
    expect(defeated.seats.map((seat) => seat.threat)).toEqual([32, 28]);
    expect(defeated.cards[idOf(defeated, ARCHER)]).toMatchObject({ zone: "play", controller: 0, exhausted: true });
  });

  lineSpec("17132:A:1", "Setup: Abaan is attached to Dungeon Cell and each player attaches an ally from the top of his deck to an Orc enemy found in the encounter deck", (effects) => {
    const made = table({ stage: "17132", side: "A", staging: [CAPTIVES, CELL], setAside: ["17120", "16061"], deck: ["16062", "16063", "f0"], deckOf: [AXEHAND, "f0"] }, effects);
    const done = resolveRecords(opened(made).state, made.ctx, "17132", "setup", idOf(made.state, "17132"), first);
    const state = settle(done.state, made.ctx, none);
    expect(captivesHeldBy(state, idOf(state, CELL)).map((card) => card.code)).toEqual(["17120"]);
    expect(captivesOf(state).some((card) => card.code === AXEHAND)).toBe(true);
  });

  lineSpec("17132:B:2", "Forced: after characters are rescued an encounter card is revealed", (effects) => {
    const made = table({ stage: "17132", staging: [CAPTIVES, CELL], setAside: ["17120"], deck: ["f3"] }, effects);
    const cell = idOf(made.state, CELL);
    const held = settle(runInstruction(made, opened(made).state, { verb: "AttachCaptive", code: "17120", to: "self" }, { sourceId: cell }), made.ctx, none);
    const freed = settle(destroyCard(held, cell, made.ctx.cards, none), made.ctx, none);
    expect(where(freed, "f3")).toBe("staging");
  });
});
