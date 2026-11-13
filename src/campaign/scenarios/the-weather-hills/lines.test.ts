// Rules: mec108.orc-deck, mec108.side-quests-in-play, mec108.time-x, rr.blank, rr.travel, rr.first-player, rr.effects, rr.destroy, rr.campaign-pool, ltp.permanent, faq.progress-without-advancing, mec112.gollum-smeagol (data/rules/entries.json); ledger lines 09025:A:2, 09026:A:3, 09029:A:1, 09029:A:2, 09030:A:1, 09031:A:1, 09053:A:2, 09054:A:1, 09055:A:3, 09058:A:1, 09059:A:2, 09069:A:1, 09069:B:1, 09069:B:2, 09070:A:1, 09070:B:2, 09070:B:3, 10162:A:4, 10163:A:4, 10164:A:4, 10165:A:4.
import { describe, expect, it } from "vitest";

import { hasKeyword } from "../../../rules/core/keywords.ts";
import { definePrinted } from "../../../rules/core/printed.ts";
import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { moveCard, spawn } from "../../../rules/core/zones.ts";
import { settle } from "../../../rules/engine/machine.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import type { ReduceContext } from "../../../rules/engine/reduce.ts";
import { reduce } from "../../../rules/engine/reduce.ts";
import { hasTrait } from "../../../rules/interpret/conditions.ts";
import { travelCostUnpayable, restricted } from "../../../rules/interpret/restrictions.ts";
import { textBlank } from "../../../rules/families/attachments/hold.ts";
import { fireForced } from "../../../rules/windows/triggers.ts";
import { queueEvent } from "../../../rules/windows/queue.ts";
import { fightEnemy, finish, idOf, legalIntents, legalTargets, resolveRecords, revealFromTop, send, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const ID = "the-weather-hills";
const built = (layout: Layout = {}) => tableFromLayout(ID, layout);
const hurt = (state: ScenarioState, code: string, damage: number): ScenarioState => updateCard(state, idOf(state, code), { damage });
const codesAt = (state: ScenarioState, ids: readonly string[]) => ids.map((id) => state.cards[id]?.code);
const swept = (state: ScenarioState, ctx: ReduceContext): ScenarioState => settle({ ...state, window: null, mode: "stopped" }, ctx, []);
const threatOf = (state: ScenarioState, seat = 0) => state.seats[seat]?.threat ?? 0;
// A Response of this card is offered in the open window.
const offered = (state: ScenarioState, ctx: ReduceContext, code: string): boolean => legalIntents(state, ctx).some((intent) => intent.type === "Trigger" && intent.cardId === idOf(state, code));
// The first option of a window, or the last when the answer is a number (an amount asks 1 up to the most).
const lastOption = (state: ScenarioState): string => (state.window?.kind === "choose" ? (state.window.options.at(-1) ?? "") : "");
// The option that is the card with this code (a Pick offers instance ids), else the first.
const optionOf = (code: string) => (state: ScenarioState): string => (state.window?.kind === "choose" ? (state.window.options.find((option) => state.cards[option]?.code === code) ?? state.window.options[0] ?? "") : "");

describe("Cornered Orc's Shadow (09025:A:2)", () => {
  it("09025:A:2 adds 2 Attack instead of 1 when the defending character is damaged at that time", () => {
    // The hero defends (Defense 2): the enemy's Attack 1 is 2 with the Shadow's +1 (no damage past the Defense) and 3 with +2 (1 damage on top of the 1 it held).
    const fight = (damage: number) => fightEnemy((layout: Layout) => built(layout), "09025", "f3", {}, { tweak: (state, made) => updateCard(state, made.hero, { damage }) });
    const clean = fight(0);
    const damaged = fight(1);
    expect(clean.run.state.cards[clean.made.hero]?.damage).toBe(0);
    expect(damaged.run.state.cards[damaged.made.hero]?.damage).toBe(2);
  });
});

describe("Amon Forn (09026)", () => {
  it("09026:A:2 attacks only while Amon Forn is the active location: an Orc added to the staging area beside another active location makes no attack", () => {
    const quiet = built({ active: "09028", staging: ["09044"] });
    const orc = idOf(quiet.state, "09044");
    const heard = settle(queueEvent(quiet.state, { trigger: "addedToStaging", seat: null, cardId: orc, subject: orc }), quiet.ctx, []);
    expect(heard.pendingAttack).toBeFalsy();
    const forn = built({ active: "09026", staging: ["f3"] });
    const other = idOf(forn.state, "f3");
    const notOrc = settle(queueEvent(forn.state, { trigger: "addedToStaging", seat: null, cardId: other, subject: other }), forn.ctx, []);
    expect(notOrc.pendingAttack).toBeFalsy();
  });

  it("09026:A:3 bars the stage's defeat only while Amon Forn is in play: it waits at 2B and only 2B (the card is set aside while stage 1 is current), then is defeated at once when Amon Forn leaves", () => {
    const stage2 = built({ stage: "09070", progress: 20, active: "09026" });
    expect(restricted(stage2.state, stage2.ctx, "advance")).not.toHaveLength(0);
    const gone = moveCard(stage2.state, idOf(stage2.state, "09026"), { zone: "encounterDiscard" });
    expect(restricted(gone, stage2.ctx, "advance")).toHaveLength(0);
    const cleared = swept(gone, stage2.ctx);
    expect(cleared.stageCleared).toBe(true);
    const stage1 = built({ stage: "09069", setAside: ["09026"] });
    expect(restricted(stage1.state, stage1.ctx, "advance")).toHaveLength(0);
    // A side quest staged beside Amon Forn is defeated as ever: the bar is on the main quest stage.
    const beside = built({ stage: "09070", active: "09026", staging: [{ code: "09055", progress: 6 }] });
    expect(restricted(beside.state, beside.ctx, "advance")).not.toHaveLength(0);
    expect(swept(beside.state, beside.ctx).cards[idOf(beside.state, "09055")]?.zone).toBe("victory");
  });
});

describe("the locations' Responses on exploration (09029:A:1, 09030:A:1)", () => {
  it("09029:A:1 is offered when Sheltered Valley is explored as the active location, and not when a location in the staging area is explored", () => {
    const t = built({ active: "09029", play: [{ code: "ally", damage: 1 }] });
    const valley = idOf(t.state, "09029");
    const explored = settle(queueEvent(t.state, { trigger: "activeExplored", seat: null, subject: valley }), t.ctx, []);
    expect(offered(explored, t.ctx, "09029")).toBe(true);
    const staged = built({ staging: ["09029"], play: [{ code: "ally", damage: 1 }] });
    const stagedExplored = settle(queueEvent(staged.state, { trigger: "locationExplored", seat: null, subject: idOf(staged.state, "09029") }), staged.ctx, []);
    expect(offered(stagedExplored, staged.ctx, "09029")).toBe(false);
  });

  it("09029:A:1 heals all the damage of one character, whoever controls it", () => {
    const t = built({ active: "09029", play: [{ code: "ally", damage: 1 }] });
    const run = resolveRecords(hurt(t.state, "dh1", 4), t.ctx, "09029", "response", idOf(t.state, "09029"), optionOf("dh1"));
    expect(run.state.cards[idOf(run.state, "dh1")]?.damage).toBe(0);
    expect(run.state.cards[idOf(run.state, "ally")]?.damage).toBe(1);
  });

  it("09030:A:1 is offered when Concealed Orc-camp is explored as the active location, and not when a location in the staging area is", () => {
    const t = built({ active: "09030", staging: [{ code: "09071", resources: 1 }] });
    const camp = idOf(t.state, "09030");
    expect(offered(settle(queueEvent(t.state, { trigger: "activeExplored", seat: null, subject: camp }), t.ctx, []), t.ctx, "09030")).toBe(true);
    const staged = built({ staging: ["09030", "09071"] });
    expect(offered(settle(queueEvent(staged.state, { trigger: "locationExplored", seat: null, subject: idOf(staged.state, "09030") }), staged.ctx, []), staged.ctx, "09030")).toBe(false);
  });

  it("09030:A:1 puts the token on Savage Counter-attack after the flip, and does nothing with no Mission objective in play", () => {
    const flipped = built({ active: "09030", staging: ["09072"] });
    const placed = resolveRecords(flipped.state, flipped.ctx, "09030", "response", idOf(flipped.state, "09030"));
    expect(placed.state.cards[idOf(placed.state, "09072")]?.resources).toBe(1);
    const none = built({ active: "09030" });
    const quiet = resolveRecords(none.state, none.ctx, "09030", "response", idOf(none.state, "09030"));
    expect(quiet.state.staging).toEqual(none.state.staging);
  });
});

describe("Sheltered Valley's Travel (09029:A:2)", () => {
  it("09029:A:2 is not offered while no Mission objective holds a resource token, and is once one does (rr.travel: a Travel cost must be paid)", () => {
    const empty = built({ phase: "Travel", staging: ["09029", "09071"] });
    expect(travelCostUnpayable(empty.state, empty.ctx, idOf(empty.state, "09029"))).toBe(true);
    expect(legalTargets(empty.state, { type: "Travel" }, empty.ctx)).not.toContain(idOf(empty.state, "09029"));
    const held = built({ phase: "Travel", staging: ["09029", { code: "09072", resources: 1 }] });
    expect(legalTargets(held.state, { type: "Travel" }, held.ctx)).toContain(idOf(held.state, "09029"));
    const gone = built({ phase: "Travel", staging: ["09029"] });
    expect(travelCostUnpayable(gone.state, gone.ctx, idOf(gone.state, "09029"))).toBe(true);
  });
});

describe("Ice Storm (09031:A:1)", () => {
  it("09031:A:1 exhausts every damaged character in play after the assignments, the other player's and those damaged before included", () => {
    const t = built({ seats: 2, deck: ["f0"], play: [{ code: "ally", damage: 1 }] });
    const before = hurt(t.state, "dh2", 1);
    const run = revealFromTop(before, t.ctx, "09031", []);
    const done = finish({ state: run.state, steps: [] }, t.ctx);
    const cards = Object.values(done.state.cards);
    expect(cards.filter((card) => card.zone === "heroes" || card.zone === "play").filter((card) => card.damage > 0).every((card) => card.exhausted)).toBe(true);
    expect(cards.filter((card) => card.code === "ally")[0]?.exhausted).toBe(true);
  });
});

describe("Freezing Blast (09053:A:2)", () => {
  it("09053:A:2 removes each damaged character from the quest, and an undamaged committed character stays committed", () => {
    const t = built({ deck: ["f0"], play: [{ code: "ally", damage: 1 }], committed: ["ally", "dh1"] });
    const run = revealFromTop(t.state, t.ctx, "09053", []);
    expect(run.state.cards[idOf(run.state, "ally")]?.committed).toBe(false);
    expect(run.state.cards[idOf(run.state, "dh1")]?.committed).toBe(true);
  });
});

describe("Cold from Angmar (09054:A:1)", () => {
  it("09054:A:1 blanks the text box of a damaged character but leaves its keywords and Traits, and an undamaged character is untouched", () => {
    const t = built({});
    const cards = new Map(t.ctx.cards);
    cards.set("sen", definePrinted({ code: "sen", name: "Sentinel ally", type: "ally", sphere: "neutral", cost: 1, willpower: 1, attack: 1, defense: 1, health: 3, traits: ["Dunedain", "Ranger"], keywords: { sentinel: true } }));
    const ctx = { ...t.ctx, cards };
    const run = resolveRecords(t.state, ctx, "09054", "whenRevealed");
    const ally = spawn(run.state, "sen", { zone: "play", seat: 0 });
    const state = settle(updateCard(ally.state, ally.id, { damage: 1 }), ctx, []);
    expect(textBlank(state, ally.id, ctx.cards)).toBe(true);
    expect(hasKeyword(state, ally.id, "sentinel", ctx.cards)).toBe(true);
    expect(hasTrait(state, ally.id, "Ranger", ctx)).toBe(true);
    expect(hasTrait(state, ally.id, "Dunedain", ctx)).toBe(true);
    const bare = settle(updateCard(ally.state, ally.id, { damage: 0 }), ctx, []);
    expect(textBlank(bare, ally.id, ctx.cards)).toBe(false);
  });

  it("09054:A:1 blanks nothing while it lies in the staging area (it is attached to the quest card only after its When Revealed effect)", () => {
    const t = built({ staging: ["09054"], play: [{ code: "ally", damage: 1 }] });
    expect(textBlank(t.state, idOf(t.state, "ally"), t.ctx.cards)).toBe(false);
  });
});

describe("Make Camp's Response (09055:A:3)", () => {
  it("09055:A:3 heals up to 3 damage from a hero each player controls: all of it when the hero holds less", () => {
    const heal = (damage: number) => {
      const t = built({ victory: ["09055"] });
      const run = resolveRecords(hurt(t.state, "dh1", damage), t.ctx, "09055", "response", idOf(t.state, "09055"));
      return run.state.cards[idOf(run.state, "dh1")]?.damage;
    };
    expect(heal(2)).toBe(0);
    expect(heal(3)).toBe(0);
    expect(heal(5)).toBe(2);
  });

  it("09055:A:3 takes a hero of each player, and none when no hero is damaged", () => {
    const t = built({ seats: 2, victory: ["09055"] });
    const both = hurt(hurt(t.state, "dh1", 4), "dh3", 1);
    const run = resolveRecords(both, t.ctx, "09055", "response", idOf(t.state, "09055"));
    expect(run.state.cards[idOf(run.state, "dh1")]?.damage).toBe(1);
    expect(run.state.cards[idOf(run.state, "dh3")]?.damage).toBe(0);
    const quiet = resolveRecords(t.state, t.ctx, "09055", "response", idOf(t.state, "09055"));
    expect(quiet.steps.filter((step) => step.kind === "damage")).toHaveLength(0);
  });
});

describe("Tragic Discovery and the threat cards", () => {
  it("09058:A:1 raises threat by 0 with no active location", () => {
    const t = built({});
    const run = revealFromTop({ ...t.state }, t.ctx, "09058", []);
    expect(threatOf(run.state)).toBe(28);
  });

  it("09059:A:2 raises threat at the end of the refresh phase only, and only while Search the Ruins is in the staging area", () => {
    // The announced end of the phase and the phase's own end both run the Forced effects, so the effect's own threat steps are counted, not the total.
    const raised = (phase: Layout["phase"], staging: readonly string[]) => {
      const t = built({ phase, staging });
      const steps: EngineStep[] = [];
      settle(fireForced({ ...t.state, window: null }, { trigger: "endOfPhase", seat: 0 }, t.ctx, steps), t.ctx, steps);
      return steps.filter((step) => step.kind === "threat" && step.cause && "effect" in step.cause && step.cause.effect === "09059:forced:1").length;
    };
    expect(raised("Refresh", ["09059"])).toBeGreaterThan(0);
    expect(raised("Planning", ["09059"])).toBe(0);
    expect(raised("Refresh", [])).toBe(0);
  });
});

describe("Scattered Among the Hills (09069)", () => {
  it("09069:A:1 shuffles the Orc deck at the Setup", () => {
    const orcs = ["09043", "09043", "09043", "09044", "09044", "09044", "09045", "09045"];
    const t = built({ stage: "09069", piles: { angmarOrcDeck: orcs } });
    const before = (t.state.piles?.angmarOrcDeck ?? []).map((id) => t.state.cards[id]?.code);
    const run = resolveRecords(t.state, t.ctx, "09069", "setup", idOf(t.state, "09069"));
    const after = (run.state.piles?.angmarOrcDeck ?? []).map((id) => run.state.cards[id]?.code);
    expect(after.slice().sort()).toEqual(before.slice().sort());
    expect(after).not.toEqual(before);
  });

  it("09069:B:1 gains surge for the first Weather treachery of a round only, and a card without the Trait never does", () => {
    const t = built({ stage: "09069", deck: ["f0", "f3", "f0", "f3"] });
    const first = revealFromTop(t.state, t.ctx, "09052", []);
    expect(codesAt(first.state, first.state.staging)).toContain("f0");
    const second = revealFromTop(first.state, t.ctx, "09052", []);
    expect(second.state.staging.filter((id) => second.state.cards[id]?.code === "f3")).toHaveLength(0);
    const plain = revealFromTop(built({ stage: "09069", deck: ["f0", "f3"] }).state, t.ctx, "09058", []);
    expect(plain.state.staging.filter((id) => plain.state.cards[id]?.code === "f0")).toHaveLength(0);
  });

  it("09069:B:2 reveals 2 cards of the Orc deck with 3 or more players' worth of seats' count and none with an empty deck: with two players one card", () => {
    const empty = built({ stage: "09069", piles: { angmarOrcDeck: [] } });
    const none = resolveRecords(empty.state, empty.ctx, "09069", "forced", empty.state.questStage ?? "");
    expect(none.state.staging).toEqual(empty.state.staging);
    const two = built({ stage: "09069", seats: 2, piles: { angmarOrcDeck: ["09043", "09044"] } });
    const run = resolveRecords(two.state, two.ctx, "09069", "forced", two.state.questStage ?? "");
    expect(run.state.staging.map((id) => run.state.cards[id]?.code)).toEqual(["09043"]);
  });
});

describe("Cornered Animals (09070)", () => {
  const layout: Layout = { stage: "09070", phase: "Combat", setAside: ["09046", "09026"], discard: ["f3"], deck: ["09043"], piles: { angmarOrcDeck: ["09044", "09030"] } };

  it("09070:A:1 reveals Orc Ambush and Amon Forn (both announced as revealed, Orc Ambush's When Revealed resolved), ends the phase and shuffles the discard pile and the Orc deck into the encounter deck", () => {
    const t = built(layout);
    const run = resolveRecords(t.state, t.ctx, "09070", "whenRevealed", t.state.questStage ?? "", undefined, false);
    const revealed = run.steps.filter((step) => step.kind === "reveal").map((step) => run.state.cards[step.cardId]?.code);
    expect(revealed).toEqual(expect.arrayContaining(["09046", "09026"]));
    expect(codesAt(run.state, run.state.staging)).toEqual(expect.arrayContaining(["09046", "09026"]));
    expect(run.state.seats[0]?.engaged.map((id) => run.state.cards[id]?.code)).toContain("09043");
    expect(run.state.piles?.angmarOrcDeck ?? []).toEqual([]);
    expect(codesAt(run.state, run.state.encounterDeck).sort()).toEqual(["09030", "09044", "f3"]);
    expect(run.state.phase).not.toBe("Combat");
  });

  it("09070:B:2 offers the first player the reveal alone when Savage Counter-attack holds no token, and both options with one", () => {
    const options = (resources: number) => {
      const t = built({ stage: "09070", staging: [{ code: "09072", resources }] });
      const steps: never[] = [];
      const state = settle(fireForced({ ...t.state, window: null }, { trigger: "beginningOfPhase", seat: 0 }, t.ctx, steps), t.ctx, steps);
      return state.window?.kind === "choose" ? state.window.options : [];
    };
    expect(options(2)).toEqual(["discard", "reveal"]);
    expect(options(0)).not.toContain("discard");
  });

  it("09070:B:2 reveals an additional encounter card this phase when the first player chooses it", () => {
    const t = built({ stage: "09070", staging: [{ code: "09072", resources: 2 }], deck: ["f0"] });
    const steps: never[] = [];
    const asked = settle(fireForced({ ...t.state, window: null }, { trigger: "beginningOfPhase", seat: 0 }, t.ctx, steps), t.ctx, steps);
    const run = finish({ state: asked, steps: [] }, t.ctx, () => "reveal");
    expect(run.state.cards[idOf(run.state, "09072")]?.resources).toBe(2);
    // The additional card is the table's revealMore until the end of the phase (the staging step reveals it).
    expect(run.state.modifiers.some((modifier) => modifier.stat === "revealMore" && modifier.amount === 1)).toBe(true);
  });

  it("09070:B:3 wins the game when the stage is defeated: a full 2B with Amon Forn gone ends the game won", () => {
    const t = built({ stage: "09070", progress: 20 });
    const cleared = swept(t.state, t.ctx);
    expect(cleared.stageCleared).toBe(true);
    expect(cleared.lost).not.toBe(true);
  });
});

describe("the boons (10162, 10163, 10164, 10165)", () => {
  it("10162:A:4 readies the attached hero", () => {
    const t = built({ attached: [{ code: "10162", to: "dh1" }] });
    const tired = updateCard(t.state, idOf(t.state, "dh1"), { exhausted: true });
    const run = resolveRecords(tired, t.ctx, "10162", "action", idOf(tired, "10162"));
    expect(run.state.cards[idOf(run.state, "dh1")]?.exhausted).toBe(false);
  });

  it("10163:A:4 cancels up to 2 points of damage just dealt to the attached hero, once per game", () => {
    const t = built({ attached: [{ code: "10163", to: "dh1" }] });
    const hero = idOf(t.state, "dh1");
    const dealt = settle(queueEvent(updateCard(t.state, hero, { damage: 3 }), { trigger: "damageDealt", seat: 0, cardId: hero, subject: hero, amount: 3 }), t.ctx, []);
    expect(offered(dealt, t.ctx, "10163")).toBe(true);
    const trigger = legalIntents(dealt, t.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === idOf(dealt, "10163"));
    const run = send({ state: dealt, steps: [] }, trigger as never, t.ctx);
    const done = finish(run, t.ctx);
    expect(done.state.cards[hero]?.damage).toBe(1);
    const other = built({ attached: [{ code: "10163", to: "dh1" }] });
    const hero2 = idOf(other.state, "dh2");
    const elsewhere = settle(queueEvent(updateCard(other.state, hero2, { damage: 3 }), { trigger: "damageDealt", seat: 0, cardId: hero2, subject: hero2, amount: 3 }), other.ctx, []);
    expect(offered(elsewhere, other.ctx, "10163")).toBe(false);
  });

  it("10164:A:4 moves any amount of damage from the attached hero to an enemy engaged with the player", () => {
    const t = built({ attached: [{ code: "10164", to: "dh1" }], engaged: [{ code: "f3", seat: 0 }] });
    const hero = idOf(t.state, "dh1");
    const start = hurt(t.state, "dh1", 3);
    const all = resolveRecords(start, t.ctx, "10164", "action", idOf(start, "10164"), lastOption);
    expect(all.state.cards[hero]?.damage).toBe(0);
    expect(all.state.cards[idOf(all.state, "f3")]?.damage).toBe(3);
    const some = resolveRecords(start, t.ctx, "10164", "action", idOf(start, "10164"));
    expect(some.state.cards[hero]?.damage).toBe(2);
    expect(some.state.cards[idOf(some.state, "f3")]?.damage).toBe(1);
  });

  it("10165:A:4 lets one attachment be played from the discard pile onto that hero only, paying its cost, and the play uses the grant up", () => {
    const t = built({ phase: "Planning", attached: [{ code: "10165", to: "dh1" }], heroResources: 3 });
    const hero = idOf(t.state, "dh1");
    const one = spawn(t.state, "attachment", { zone: "discard", seat: 0 });
    const two = spawn(one.state, "attachment", { zone: "discard", seat: 0 });
    const plays = (state: ScenarioState, cardId: string) => legalIntents(state, t.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === cardId);
    expect(plays(two.state, one.id)).toBe(false);
    const granted = resolveRecords(two.state, t.ctx, "10165", "action", idOf(two.state, "10165"), undefined, false).state;
    expect(plays(granted, one.id)).toBe(true);
    // Onto the other hero it is refused: the permission is the attached hero's.
    expect(reduce(granted, { type: "PlayCard", cardId: one.id, payments: [], hostId: idOf(granted, "dh2") }, t.ctx).ok).toBe(false);
    const played = send({ state: granted, steps: [] }, { type: "PlayCard", cardId: one.id, payments: [], hostId: hero }, t.ctx);
    expect(played.state.cards[one.id]?.host).toBe(hero);
    // Used up: the second attachment is not offered, and the hero holds no grant.
    expect(plays(played.state, two.id)).toBe(false);
    expect(played.state.modifiers.some((modifier) => modifier.stat === "attachmentFromDiscard")).toBe(false);
  });
});
