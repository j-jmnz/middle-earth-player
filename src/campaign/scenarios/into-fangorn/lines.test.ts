// Rules: rm.hinder, rm.does-not-stack, rm.time-x, rr.attacks-outside-the-combat-phase, rr.guarded, rr.attachment-cards, rr.search, rr.refresh-phase (data/rules/entries.json).
// What a spec row cannot show (a row must fail without the line's records, and it reads the table at the end of a round or a phase): Hinder through the combat phase, the Forced effects of the resource phase, the searches of two players, the stacking pick,
// the refresh cap and the encounter cards that attach (Mugash and the stages are in mugash.test.ts). The rows are in spec.test.ts. The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points; dh1 and dh2 are the first seat's, dh3 the second's. The tests of one line are titled with its id.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../../rules/core/intents.ts";
import { flagged, updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { runInstruction } from "../../../rules/interpret/interpret.ts";
import { crossBoundary } from "../../../rules/windows/triggers.ts";
import { fight, idOf, idsOf, opened, resolveRecords, run, statOf, tableFromLayout, zoneOf, type Layout } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "into-fangorn";
const table = (layout: Layout) => tableFromLayout(SCENARIO, layout, { extra: [PLAIN] });
const DARK = "07033";
const ANGRY = "07034";
const DEADLY = "07035";
const EDGE = "07032";
const FOREST = "07050";
const WOODS = "07051";
const TURNED = "07052";
const STAGE_1 = "07065";
const STAGE_3 = "07067";
// Dunland enemies the other box deals, as a plain enemy and as the cards a shadow card is taken from.
const PLAIN = "07042";
const SHADOWS = [FOREST, WOODS, TURNED];
const inCombat = (state: ScenarioState) => state.phase === "Combat" && state.mode === "playerAttacks";
const damageOf = (state: ScenarioState, seat = 0) => state.seats[seat]?.heroes.reduce((sum, id) => sum + (state.cards[id]?.damage ?? 0), 0) ?? 0;
const offTrack = { code: "07057", to: EDGE, encounter: true } as const;
// The state in the resource phase: a Forced effect of that phase resolves as the phase begins.
const inResourcePhase = (t: ReturnType<typeof table>): ScenarioState => ({ ...t.state, phase: "Resource" });

describe("Hinder in the combat phase (07033:A:1, 07034:A:1, 07035:A:1, rm.hinder)", () => {
  const combat = (layout: Layout) => {
    const t = table({ stage: STAGE_1, phase: "Encounter", deck: SHADOWS, ...layout });
    return { t, done: fight(t, opened(t), inCombat) };
  };
  // The same three checks for each Huorn: no attack, no shadow card, and 1 progress comes off the quest before the shadows are dealt.
  const hinders = (code: string) => {
    const { t, done } = combat({ engaged: [code], progress: 3 });
    expect(damageOf(done.state)).toBe(0);
    expect(done.state.encounterDeck).toEqual(t.state.encounterDeck);
    expect(done.state.cards[t.state.questStage ?? ""]?.progress).toBe(2);
    expect(flagged(done.state, idOf(done.state, code), "cannotAttack")).toBe(true);
  };

  it("07033:A:1 the flags exist when the shadows are dealt and the attacks chosen: a Hinder enemy is dealt no shadow card and makes no attack, a plain enemy is", () => {
    const hindered = combat({ engaged: [DARK] });
    expect(damageOf(hindered.done.state)).toBe(0);
    expect(hindered.done.state.encounterDeck).toEqual(hindered.t.state.encounterDeck);
    expect(flagged(hindered.done.state, idOf(hindered.done.state, DARK), "cannotAttack")).toBe(true);
    const plain = combat({ engaged: [PLAIN] });
    expect(plain.done.state.encounterDeck.length).toBe(plain.t.state.encounterDeck.length - 1);
  });

  it("07033:A:1 its Forced effect resolves before the shadows are dealt: the quest loses 1 progress while the shadow cards are still in the deck", () => hinders(DARK));

  it("07034:A:1 an Angry Huorn makes no attack in the combat phase, is dealt no shadow card and takes 1 progress off the quest", () => hinders(ANGRY));

  it("07035:A:1 a Deadly Huorn makes no attack in the combat phase, is dealt no shadow card and takes 1 progress off the quest", () => hinders(DEADLY));

  it("07033:A:1 with no progress on the quest the active location loses it, and with none on either nothing happens", () => {
    const onLocation = combat({ engaged: [DARK], progress: 0, active: { code: EDGE, progress: 1 } });
    expect(onLocation.done.state.cards[idOf(onLocation.done.state, EDGE)]?.progress).toBe(0);
    const bare = combat({ engaged: [DARK], progress: 0, active: { code: EDGE, progress: 0 } });
    expect(bare.done.state.cards[idOf(bare.done.state, EDGE)]?.progress).toBe(0);
    const both = combat({ engaged: [DARK], progress: 2, active: { code: EDGE, progress: 1 } });
    expect(both.done.state.cards[idOf(both.done.state, EDGE)]?.progress).toBe(1);
    expect(both.done.state.cards[both.t.state.questStage ?? ""]?.progress).toBe(1);
  });

  it("07033:A:1 a Huorn in the staging area is not hindered but still takes no player attachment (Cannot have attachments)", () => {
    const t = table({ stage: STAGE_1, phase: "Combat", staging: [DEADLY] });
    const state = opened(t).state;
    expect(flagged(state, idOf(state, DEADLY), "cannotHaveAttachments")).toBe(true);
    expect(flagged(state, idOf(state, DEADLY), "cannotAttack")).toBe(false);
  });
});

describe("the Forced effects of the resource phase (07033:A:2, 07034:A:2, 07035:A:2)", () => {
  it("07033:A:2 the engaged player raises his threat by 2, and a Huorn in the staging area does nothing", () => {
    const t = table({ stage: STAGE_1, engaged: [DARK], threat: [30, 30] });
    expect(resolveRecords(inResourcePhase(t), t.ctx, DARK, "forced", idOf(t.state, DARK)).state.seats[0]?.threat).toBe(32);
    const staged = table({ stage: STAGE_1, staging: [DARK], threat: [30, 30] });
    expect(resolveRecords(inResourcePhase(staged), staged.ctx, DARK, "forced", idOf(staged.state, DARK)).state.seats[0]?.threat).toBe(30);
  });

  it("07033:A:2 each Huorn raises the threat of the player it is engaged with, not the first player's", () => {
    const t = table({ seats: 2, stage: STAGE_1, engaged: [{ code: DARK, seat: 1 }], threat: [30, 30] });
    const done = resolveRecords(inResourcePhase(t), t.ctx, DARK, "forced", idOf(t.state, DARK)).state;
    expect([done.seats[0]?.threat, done.seats[1]?.threat]).toEqual([30, 32]);
  });

  it("07034:A:2 the Huorn's attack outside the combat phase is made, and it is dealt a shadow card", () => {
    const t = table({ stage: STAGE_1, deck: SHADOWS, engaged: [ANGRY] });
    const steps: EngineStep[] = [];
    const pushed = resolveRecords(inResourcePhase(t), t.ctx, ANGRY, "forced", idOf(t.state, ANGRY), undefined, false);
    const done = fight(t, { state: pushed.state, steps }, (state) => state.window?.kind !== "defense" && state.stack.length === 0);
    expect(damageOf(done.state)).toBeGreaterThan(0);
    expect(done.state.encounterDeck.length).toBe(t.state.encounterDeck.length - 1);
    expect(zoneOf(done.state, SHADOWS[0] ?? "")).toBe("encounterDiscard");
  });

  it("07035:A:2 the engaged player deals 3 damage to one character he controls, as one instance", () => {
    const t = table({ stage: STAGE_1, engaged: [DEADLY] });
    const done = resolveRecords(inResourcePhase(t), t.ctx, DEADLY, "forced", idOf(t.state, DEADLY)).state;
    const hurt = [...t.state.seats[0]!.heroes].map((id) => done.cards[id]?.damage ?? 0).filter((damage) => damage > 0);
    expect(hurt).toEqual([3]);
  });
});

describe("does not stack (07050:A:1, 07051:A:1, rm.does-not-stack)", () => {
  const edgeStats = (t: ReturnType<typeof table>, state: ScenarioState) => [statOf(state, t.ctx.cards, EDGE, "threat"), statOf(state, t.ctx.cards, EDGE, "questPoints")];
  const discarded = (t: ReturnType<typeof table>, state: ScenarioState, id: string) => opened(t, { ...state, cards: { ...state.cards, [id]: { ...state.cards[id]!, zone: "encounterDiscard" } } }).state;

  it("07050:A:1 two Ancient Forests in the staging area give each Forest there +1 Threat and +3 quest points once, and with the older one gone the other still gives it", () => {
    const t = table({ stage: STAGE_1, phase: "Quest", staging: [EDGE, FOREST, FOREST] });
    const both = opened(t).state;
    expect(edgeStats(t, both)).toEqual([3, 5]);
    expect(edgeStats(t, discarded(t, both, idsOf(both, FOREST)[0] ?? ""))).toEqual([3, 5]);
  });

  it("07050:A:1 an Ancient Forest that is the active location gives nothing, and does not stop a newer one in the staging area from giving its bonus", () => {
    const t = table({ stage: STAGE_1, phase: "Quest", active: FOREST, staging: [EDGE, FOREST] });
    const state = opened(t).state;
    expect(idsOf(state, FOREST).map((id) => state.cards[id]?.zone).sort()).toEqual(["activeLocation", "staging"]);
    expect(edgeStats(t, state)).toEqual([3, 5]);
    // The one in the staging area is the only giver: Edge of Fangorn gets it once, not for each copy in play.
    expect(state.modifiers.filter((modifier) => modifier.stat === "threat" && modifier.instanceId === idOf(state, EDGE))).toHaveLength(1);
  });

  it("07050:A:1 an Ancient Forest alone in play as the active location gives no bonus to a Forest in the staging area", () => {
    const t = table({ stage: STAGE_1, phase: "Quest", active: FOREST, staging: [EDGE] });
    expect(edgeStats(t, opened(t).state)).toEqual([2, 2]);
  });

  it("07051:A:1 two Tangled Woods give each Forest the Travel cost once", () => {
    const t = table({ stage: STAGE_1, phase: "Quest", staging: [EDGE, WOODS, WOODS] });
    const state = opened(t).state;
    expect(state.modifiers.filter((modifier) => modifier.stat === "travelExhaust" && modifier.instanceId === idOf(state, EDGE))).toHaveLength(1);
  });

  it("07051:A:1 a Forest that is the active location gains the Travel cost as well as one in the staging area, and an older copy in play lets the newer one give it again", () => {
    const t = table({ stage: STAGE_1, phase: "Quest", active: EDGE, staging: [FOREST, WOODS] });
    const state = opened(t).state;
    expect(flagged(state, idOf(state, EDGE), "travelExhaust")).toBe(true);
    expect(flagged(state, idOf(state, FOREST), "travelExhaust")).toBe(true);
    const twin = table({ stage: STAGE_1, phase: "Quest", active: WOODS, staging: [EDGE, WOODS] });
    const twinState = opened(twin).state;
    expect(flagged(twinState, idOf(twinState, EDGE), "travelExhaust")).toBe(true);
  });
});

describe("07050:A:2 and 07052:A:2 Shadow effects at the end of an attack", () => {
  it("07050:A:2 the Shadow effect exhausts a character the defending player controls", () => {
    const exhaustedHeroes = (shadow: string) => {
      const t = table({ stage: STAGE_1, phase: "Encounter", deck: [shadow, "07051"], engaged: [PLAIN] });
      const done = fight(t, opened(t), inCombat);
      return t.state.seats[0]!.heroes.filter((id) => done.state.cards[id]?.exhausted === true).length;
    };
    expect(exhaustedHeroes(FOREST)).toBe(exhaustedHeroes("07036") + 1);
  });

  it("07052:A:2 a defended attack leaves the active location where it is", () => {
    const t = table({ stage: STAGE_1, phase: "Encounter", deck: [TURNED, "07051"], active: EDGE, engaged: [PLAIN] });
    const done = fight(t, opened(t), inCombat, { defender: "dh2" });
    expect(zoneOf(done.state, EDGE)).toBe("activeLocation");
  });
});

describe("the encounter cards that attach (07057:A:2, 07058:A:1)", () => {
  const rested = (stage: string) => ({ code: "07058", to: stage, encounter: true as const });

  it("07058:A:1 In Need of Rest removes a committed hero from the quest and attaches to it; a time counter off the quest then costs the hero 1 damage", () => {
    const t = table({ stage: STAGE_1, phase: "Quest", committed: ["dh1"], deck: [] });
    const done = resolveRecords(t.state, t.ctx, "07058", "whenRevealed");
    const hero = idOf(t.state, "dh1");
    expect(done.state.cards[hero]?.committed).toBe(false);
    expect(done.state.cards[done.id]?.zone).toBe("attached");
    expect(done.state.cards[hero]?.attachments).toContain(done.id);
    const loaded = updateCard(done.state, done.state.questStage ?? "", { resources: 3 });
    const after = run(t, loaded, { verb: "RemoveTimeFromQuest", amount: 1 });
    expect(after.cards[hero]?.damage).toBe(1);
  });

  it("07058:A:1 with no hero committed it is discarded", () => {
    const t = table({ stage: STAGE_1, phase: "Quest", deck: [] });
    const done = resolveRecords(t.state, t.ctx, "07058", "whenRevealed");
    expect(done.state.cards[done.id]?.zone).not.toBe("attached");
  });

  it("07058:A:1 a second In Need of Rest attaches to another hero (Limit 1 per hero), and again with both heroes holding one it is discarded; the damage again falls on each hero for the next counter", () => {
    const t = table({ stage: STAGE_1, phase: "Quest", committed: ["dh1", "dh2"], attached: [rested("dh1")], deck: [] });
    const second = resolveRecords(t.state, t.ctx, "07058", "whenRevealed");
    expect(second.state.cards[idOf(t.state, "dh2")]?.attachments).toContain(second.id);
    const both = table({ stage: STAGE_1, phase: "Quest", committed: ["dh1", "dh2"], attached: [rested("dh1"), rested("dh2")], deck: [] });
    const third = resolveRecords(both.state, both.ctx, "07058", "whenRevealed");
    expect(third.state.cards[third.id]?.zone).not.toBe("attached");
    // With a copy on each hero, one counter costs each hero 1 damage.
    const loaded = updateCard(both.state, both.state.questStage ?? "", { resources: 3 });
    const after = run(both, loaded, { verb: "RemoveTimeFromQuest", amount: 1 });
    expect([after.cards[idOf(after, "dh1")]?.damage, after.cards[idOf(after, "dh2")]?.damage]).toEqual([1, 1]);
  });

  it("07058:A:1 the hero takes the damage once for each counter that comes off the quest, and none when no counter is left to remove", () => {
    const t = table({ stage: STAGE_1, phase: "Quest", attached: [rested("dh1")], deck: [] });
    const two = run(t, updateCard(t.state, t.state.questStage ?? "", { resources: 2 }), { verb: "RemoveTimeFromQuest", amount: 2 });
    expect(two.cards[idOf(two, "dh1")]?.damage).toBe(2);
    const none = run(t, updateCard(t.state, t.state.questStage ?? "", { resources: 0 }), { verb: "RemoveTimeFromQuest", amount: 1 });
    expect(none.cards[idOf(none, "dh1")]?.damage).toBe(0);
  });

  it("07057:A:2 with no location in play it is discarded, and a second Off Track goes to a location with none (Limit 1 per location), again discarded when each has one", () => {
    const bare = table({ stage: STAGE_1, phase: "Quest", deck: [] });
    const lone = resolveRecords(bare.state, bare.ctx, "07057", "whenRevealed");
    expect(lone.state.cards[lone.id]?.zone).not.toBe("attached");
    const one = table({ stage: STAGE_1, phase: "Quest", staging: [EDGE, FOREST], attached: [offTrack], deck: [] });
    const second = resolveRecords(one.state, one.ctx, "07057", "whenRevealed");
    expect(second.state.cards[idOf(one.state, FOREST)]?.attachments).toContain(second.id);
    const full = table({ stage: STAGE_1, phase: "Quest", staging: [EDGE], attached: [offTrack], deck: [] });
    const third = resolveRecords(full.state, full.ctx, "07057", "whenRevealed");
    expect(third.state.cards[third.id]?.zone).not.toBe("attached");
  });

  it("07057:A:2 the extra time counter comes off at the end of the refresh phase, again each round, wherever the location lies in play", () => {
    const t = table({ stage: STAGE_1, timeCounters: 4, phase: "Combat", staging: [EDGE], attached: [offTrack] });
    const done = fight(t, opened(t), (state) => state.round > t.state.round);
    // One counter comes off for the stage's own Time and one for Off Track.
    expect(done.state.cards[done.state.questStage ?? ""]?.resources).toBe(2);
  });
});

describe("the order at the end of the refresh phase (07057:A:2, mec108.time-x)", () => {
  it("07057:A:2 Off Track's counter comes off before the stage's own: its Forced effect is on top of the stack and the stage's removal under it", () => {
    const t = table({ stage: STAGE_1, timeCounters: 4, phase: "Refresh", staging: [EDGE], attached: [offTrack] });
    // The refresh phase has just ended: the boundary pushes the stage's own removal first and the Forced effects after it, so the last one pushed (the top) resolves first.
    const crossed = crossBoundary({ ...t.state, phase: "Planning", boundaryPhase: "Refresh" }, t.ctx, []);
    const at = (id: string) => crossed.stack.findIndex((frame) => JSON.stringify(frame).includes(id));
    expect(at("time:refresh")).toBeGreaterThanOrEqual(0);
    expect(at("07057:forced:1")).toBeGreaterThan(at("time:refresh"));
    expect(crossed.cards[crossed.questStage ?? ""]?.resources).toBe(4);
  });
});

describe("timeCounterRemoved (07058:A:1)", () => {
  const counters = (scenario: string, stage: string, deck: readonly string[]) => {
    const t = tableFromLayout(scenario, { stage, deck });
    const id = t.state.questStage ?? "";
    return { t, state: updateCard(t.state, id, { resources: 2 }) };
  };
  const heard = (state: ScenarioState) => (state.pendingEvents ?? []).filter((event) => event.trigger === "timeCounterRemoved").length;
  const remove = (made: ReturnType<typeof counters>, amount: number) => runInstruction({ ...made.state, mode: "stopped" }, { verb: "RemoveTimeFromQuest", amount }, { seat: 0, sourceId: null }, made.t.ctx, []);

  it("07058:A:1 a counter that comes off the current quest is announced once for each counter when a card in the game hears it", () => {
    const made = counters(SCENARIO, STAGE_1, ["07058"]);
    expect(heard(remove(made, 1))).toBe(1);
    expect(heard(remove(made, 2))).toBe(2);
  });

  it("07058:A:1 no game without such a card announces it: Into Fangorn's own deck without In Need of Rest, and another scenario's stage", () => {
    expect(heard(remove(counters(SCENARIO, STAGE_1, [FOREST]), 2))).toBe(0);
    expect(heard(remove(counters("the-fords-of-isen", "07059", ["07042"]), 2))).toBe(0);
  });
});

describe("the searches and the refresh cap (07032:A:2, 07036:A:1, 07037:A:1, 07067:B:2)", () => {
  it("07032:A:2 the Travel adds a Huorn to the staging area and the travel needs none found", () => {
    const t = table({ stage: STAGE_1, phase: "Travel", staging: [EDGE], deck: [DARK, ANGRY, DEADLY] });
    const done = resolveRecords(t.state, t.ctx, EDGE, "travel", idOf(t.state, EDGE));
    expect(zoneOf(done.state, DARK)).toBe("staging");
    expect(zoneOf(done.state, ANGRY)).toBe("encounterDeck");
    const none = table({ stage: STAGE_1, phase: "Travel", staging: [EDGE], deck: [FOREST] });
    expect(resolveRecords(none.state, none.ctx, EDGE, "travel", idOf(none.state, EDGE)).state.cards[idOf(none.state, EDGE)]?.zone).toBe("staging");
  });

  // Each seat's characters beyond 5 stay exhausted: the Forced effect marks them as the refresh phase begins.
  const refresh = (layout: Layout) => {
    const t = table({ stage: STAGE_1, phase: "Refresh", staging: ["07036"], ...layout });
    const seats = t.state.seats.filter((seat) => seat.heroes.length > 0);
    const everyone = seats.flatMap((seat) => [...seat.heroes, ...seat.play]);
    const tired = everyone.reduce((state, id) => updateCard(state, id, { exhausted: true }), t.state);
    const done = resolveRecords(tired, t.ctx, "07036", "forced", idOf(tired, "07036")).state;
    return seats.map((seat) => [...seat.heroes, ...seat.play].filter((id) => flagged(done, id, "doesNotReady")).length);
  };

  it("07036:A:1 with 1 player the characters beyond 5 stay exhausted, 2 of 7, and with 5 or fewer none stays", () => {
    expect(refresh({ play: ["ally", "ally", "ally", "ally", "ally"] })).toEqual([2]);
    expect(refresh({ play: ["ally", "ally", "ally"] })).toEqual([0]);
  });

  it("07036:A:1 with 2 players each keeps his own 5: the cap is not shared between them", () => {
    const six = ["ally", "ally", "ally", "ally"];
    const seven = [{ code: "ally", seat: 1 }, { code: "ally", seat: 1 }, { code: "ally", seat: 1 }, { code: "ally", seat: 1 }, { code: "ally", seat: 1 }, { code: "ally", seat: 1 }];
    expect(refresh({ seats: 2, play: [...six, ...seven] })).toEqual([1, 2]);
    expect(refresh({ seats: 2, play: [{ code: "ally", seat: 1 }, { code: "ally", seat: 1 }] })).toEqual([0, 0]);
  });

  it("07037:A:1 each engaged Huorn attacks and is dealt a shadow card, no player searches and the deck is not shuffled", () => {
    const t = table({ stage: STAGE_1, phase: "Quest", engaged: [DARK], deck: [ANGRY, FOREST, WOODS, TURNED, "07056"] });
    const done = resolveRecords(t.state, t.ctx, "07037", "whenRevealed");
    expect(zoneOf(done.state, ANGRY)).toBe("shadow");
    expect(done.state.seedCursor).toBe(t.state.seedCursor);
  });

  it("07037:A:1 revealed in the combat phase a Hinder Huorn makes no attack and is dealt no shadow card, so no attack was made and the player searches", () => {
    const t = table({ stage: STAGE_1, phase: "Combat", engaged: [DARK], deck: [ANGRY, FOREST, WOODS, TURNED, "07056"] });
    const hindered = opened(t).state;
    expect(flagged(hindered, idOf(hindered, DARK), "cannotAttack")).toBe(true);
    const done = resolveRecords(hindered, t.ctx, "07037", "whenRevealed");
    expect(damageOf(done.state)).toBe(0);
    expect(done.state.window).toBeFalsy();
    expect(Object.values(done.state.cards).some((card) => card.zone === "shadow")).toBe(false);
    expect(zoneOf(done.state, ANGRY)).toBe("engaged");
  });

  it("07037:A:1 with no Huorn engaged each player searches for a Huorn and puts it into play engaged with him, and the deck is shuffled", () => {
    const t = table({ stage: STAGE_1, phase: "Quest", deck: [ANGRY, FOREST, WOODS, TURNED, "07056"], discard: [DARK] });
    const done = resolveRecords(t.state, t.ctx, "07037", "whenRevealed");
    expect(zoneOf(done.state, ANGRY)).toBe("engaged");
    expect(done.state.seedCursor).toBeGreaterThan(t.state.seedCursor);
  });

  it("07037:A:1 with two players, a Huorn that the first player took from the discard pile does not stop the second player's search", () => {
    const t = table({ seats: 2, stage: STAGE_1, phase: "Quest", deck: [FOREST, DEADLY], discard: [DARK] });
    const done = resolveRecords(t.state, t.ctx, "07037", "whenRevealed");
    const engaged = (seat: number) => (done.state.seats[seat]?.engaged ?? []).map((id) => done.state.cards[id]?.code);
    expect(engaged(0)).toHaveLength(1);
    expect(engaged(1)).toHaveLength(1);
    expect(new Set([...engaged(0), ...engaged(1)]).size).toBe(2);
    const fromDiscard = table({ seats: 2, stage: STAGE_1, phase: "Quest", deck: [FOREST], discard: [DARK, ANGRY] });
    const both = resolveRecords(fromDiscard.state, fromDiscard.ctx, "07037", "whenRevealed").state;
    expect([zoneOf(both, DARK), zoneOf(both, ANGRY)]).toEqual(["engaged", "engaged"]);
  });

  it("07067:B:2 each player chooses an enemy or objective from the discard pile, reveals it and adds it to the staging area, a different card each", () => {
    const t = table({ stage: STAGE_3, phase: "Quest", seats: 2, deck: [WOODS, TURNED, "07056", "07057", "07058", "07036"], discard: [DARK, ANGRY, FOREST] });
    const done = resolveRecords(t.state, t.ctx, STAGE_3, "forced", t.state.questStage ?? "");
    expect([zoneOf(done.state, DARK), zoneOf(done.state, ANGRY), zoneOf(done.state, FOREST)]).toEqual(["staging", "staging", "encounterDiscard"]);
    expect(done.state.cards[t.state.questStage ?? ""]?.resources).toBe(3);
  });
});
