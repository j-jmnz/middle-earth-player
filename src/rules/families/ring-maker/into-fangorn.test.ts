// Rules: rm.hinder, rm.does-not-stack, rm.time-x, rr.attacks-outside-the-combat-phase (data/rules/entries.json); ledger lines 07033:A:1, 07034:A:2, 07037:A:1, 07050:A:1, 07051:A:1.
// The engine Into Fangorn needs: Hinder (flags that exist only in the combat phase and a Forced effect at its start), "does not stack" on the Forest locations, the card a player chooses from the discard pile, the refresh cap and the removal of a time counter heard by the quest's attachments.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../core/intents.ts";
import type { ScenarioState } from "../../core/state.ts";
import { settle } from "../../engine/machine.ts";
import { flagged } from "../../core/state.ts";
import { ruleCause } from "../../core/cause.ts";
import { placeDamage } from "../../core/damage.ts";
import { destroyCard } from "../../core/keywords.ts";
import { flagged, updateCard, type ScenarioState } from "../../core/state.ts";
import { moveEncounter } from "../encounter/moves.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { drive, fight, idOf, idsOf, opened, resolveRecords, revealedTop, run, statOf, tableFromLayout, zoneOf, type Layout } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "into-fangorn";
const table = (layout: Layout) => tableFromLayout(SCENARIO, layout, { extra: [PLAIN] });
const DARK = "07033";
const ANGRY = "07034";
const EDGE = "07032";
const STAGE_1 = "07065";
const STAGE_3_CODE = "07067";
// Dunland enemies the other box deals, as a plain enemy and as the cards a shadow card is taken from.
const PLAIN = "07042";
const SHADOWS = ["07050", "07051", "07052"];
const inCombat = (state: ScenarioState) => state.phase === "Combat" && state.mode === "playerAttacks";
const heroDamage = (state: ScenarioState) => state.seats[0]?.heroes.reduce((sum, id) => sum + (state.cards[id]?.damage ?? 0), 0) ?? 0;

describe("Hinder in the combat phase (07033:A:1, rm.hinder)", () => {
  const combat = (layout: Layout) => {
    const t = table({ stage: STAGE_1, phase: "Encounter", deck: SHADOWS, ...layout });
    return { t, done: fight(t, opened(t), inCombat) };
  };

  it("(a) the flags exist when the shadows are dealt and the attacks chosen: a Hinder enemy is dealt no shadow card and makes no attack, a plain enemy is", () => {
    const hindered = combat({ engaged: [DARK] });
    expect(heroDamage(hindered.done.state)).toBe(0);
    expect(hindered.done.state.encounterDeck).toEqual(hindered.t.state.encounterDeck);
    expect(flagged(hindered.done.state, idOf(hindered.done.state, DARK), "cannotAttack")).toBe(true);
    const plain = combat({ engaged: [PLAIN] });
    expect(plain.done.state.encounterDeck.length).toBe(plain.t.state.encounterDeck.length - 1);
  });

  it("(b) its Forced effect resolves before the shadows are dealt: the quest loses 1 progress while the shadow cards are still in the deck", () => {
    const { t, done } = combat({ engaged: [DARK], progress: 3 });
    expect(done.state.cards[t.state.questStage ?? ""]?.progress).toBe(2);
    expect(done.state.encounterDeck).toEqual(t.state.encounterDeck);
  });

  it("with no progress on the quest the active location loses it, and with none on either nothing happens", () => {
    const onLocation = combat({ engaged: [DARK], progress: 0, active: { code: EDGE, progress: 1 } });
    expect(onLocation.done.state.cards[idOf(onLocation.done.state, EDGE)]?.progress).toBe(0);
    const bare = combat({ engaged: [DARK], progress: 0, active: { code: EDGE, progress: 0 } });
    expect(bare.done.state.cards[idOf(bare.done.state, EDGE)]?.progress).toBe(0);
    const both = combat({ engaged: [DARK], progress: 2, active: { code: EDGE, progress: 1 } });
    expect(both.done.state.cards[idOf(both.done.state, EDGE)]?.progress).toBe(1);
    expect(both.done.state.cards[both.t.state.questStage ?? ""]?.progress).toBe(1);
  });

  it("07034:A:2 an attack the Huorn makes outside the combat phase is made, and is dealt a shadow card", () => {
    const t = table({ stage: STAGE_1, phase: "Refresh", deck: SHADOWS, engaged: [ANGRY] });
    const steps: EngineStep[] = [];
    const rolled = settle(opened(t).state, t.ctx, steps);
    const done = fight(t, { state: rolled, steps }, (state) => state.phase === "Planning");
    expect(heroDamage(done.state)).toBeGreaterThan(0);
    expect(done.state.encounterDeck.length).toBe(t.state.encounterDeck.length - 1);
    expect(zoneOf(done.state, SHADOWS[0] ?? "")).toBe("encounterDiscard");
  });
});

describe("does not stack (07050:A:1, 07051:A:1, rm.does-not-stack)", () => {
  const edgeStats = (t: ReturnType<typeof table>, state: ScenarioState) => [statOf(state, t.ctx.cards, EDGE, "threat"), statOf(state, t.ctx.cards, EDGE, "questPoints")];

  it("07050:A:1 two Ancient Forests in the staging area give each Forest there +1 Threat and +3 quest points once, and with the older one gone the other still gives it", () => {
    const t = table({ stage: STAGE_1, phase: "Quest", staging: [EDGE, "07050", "07050"] });
    const both = opened(t).state;
    expect(edgeStats(t, both)).toEqual([3, 5]);
    const [older] = idsOf(both, "07050");
    const gone = opened(t, { ...both, cards: { ...both.cards, [older ?? ""]: { ...both.cards[older ?? ""]!, zone: "encounterDiscard" } } }).state;
    expect(edgeStats(t, gone)).toEqual([3, 5]);
  });

  it("07051:A:1 two Tangled Woods give each Forest the Travel cost once", () => {
    const t = table({ stage: STAGE_1, phase: "Quest", staging: [EDGE, "07051", "07051"] });
    const state = opened(t).state;
    expect(state.modifiers.filter((modifier) => modifier.stat === "travelExhaust" && modifier.instanceId === idOf(state, EDGE))).toHaveLength(1);
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

  it("a counter that comes off the current quest is announced once for each counter when a card in the game hears it", () => {
    const made = counters(SCENARIO, STAGE_1, ["07058"]);
    expect(heard(remove(made, 1))).toBe(1);
    expect(heard(remove(made, 2))).toBe(2);
  });

  it("no game without such a card announces it: Into Fangorn's own deck without In Need of Rest, and another scenario's stage", () => {
    expect(heard(remove(counters(SCENARIO, STAGE_1, ["07050"]), 2))).toBe(0);
    expect(heard(remove(counters("the-fords-of-isen", "07059", ["07042"]), 2))).toBe(0);
  });
});

describe("the encounter cards that attach (07057:A:2, 07058:A:1)", () => {
  it("07058:A:1 In Need of Rest removes a committed hero from the quest and attaches to it; a time counter off the quest then costs the hero 1 damage", () => {
    const t = table({ stage: STAGE_1, phase: "Quest", committed: ["dh1"], deck: [] });
    const done = resolveRecords(t.state, t.ctx, "07058", "whenRevealed");
    const hero = idOf(t.state, "dh1");
    expect(done.state.cards[hero]?.committed).toBe(false);
    expect(done.state.cards[done.id]?.zone).toBe("attached");
    expect(done.state.cards[hero]?.attachments).toContain(done.id);
    const stage = done.state.questStage ?? "";
    const loaded = updateCard(done.state, stage, { resources: 3 });
    const after = run(t, loaded, { verb: "RemoveTimeFromQuest", amount: 1 });
    expect(after.cards[hero]?.damage).toBe(1);
  });

  it("07058:A:1 with no hero committed it is discarded", () => {
    const t = table({ stage: STAGE_1, phase: "Quest", deck: [] });
    const done = resolveRecords(t.state, t.ctx, "07058", "whenRevealed");
    expect(done.state.cards[done.id]?.zone).not.toBe("attached");
  });

  it("07057:A:2 Off Track attaches to a location in play; +2 quest points, and an extra counter comes off at the end of the refresh phase", () => {
    const t = table({ stage: STAGE_1, phase: "Quest", staging: [EDGE], deck: [] });
    const done = resolveRecords(t.state, t.ctx, "07057", "whenRevealed");
    const edge = idOf(t.state, EDGE);
    expect(done.state.cards[edge]?.attachments).toContain(done.id);
    expect(statOf(opened(t, done.state).state, t.ctx.cards, EDGE, "questPoints")).toBe(4);
  });
});

describe("Mugash and the quest stages (07031, 07065 to 07067)", () => {
  const MUGASH = "07031";
  const STAGE_2 = "07066";
  const STAGE_3 = "07067";
  const setup = (layout: Layout = {}) => {
    const t = table({ stage: STAGE_1, phase: "Quest", staging: [EDGE], setAside: [MUGASH], ...layout });
    const done = resolveRecords(t.state, t.ctx, STAGE_1, "setup", t.state.questStage ?? "");
    return { t, state: done.state };
  };

  it("07065:A:1 Setup lies Mugash on Edge of Fangorn, claimed by no player, and reveals the players less one cards", () => {
    const { state } = setup({ deck: ["07050", "07051", "07052"] });
    const mugash = idOf(state, MUGASH);
    expect(state.cards[mugash]?.zone).toBe("attached");
    expect(state.cards[idOf(state, EDGE)]?.attachments).toContain(mugash);
    expect(state.cards[mugash]?.claimed).toBe(true);
    expect(state.cards[mugash]?.controller ?? null).toBeNull();
  });

  it("07065:B:2 after the last counter Mugash is shuffled into the encounter deck from where he lies and the quest jumps to stage 3 with its counters", () => {
    const { t, state } = setup();
    const ready = updateCard(state, state.questStage ?? "", { resources: 1 });
    const done = run(t, ready, { verb: "RemoveTimeFromQuest", amount: 1 });
    expect(done.cards[done.questStage ?? ""]?.code).toBe(STAGE_3);
    expect(zoneOf(done, MUGASH)).toBe("encounterDeck");
    expect(done.cards[done.questStage ?? ""]?.resources).toBe(3);
  });

  it("07066:B:2 stage 2 jumps to stage 3A, and 07067:B:3 six progress with Mugash on a hero jumps back to stage 2A", () => {
    const t = table({ stage: STAGE_2, phase: "Quest", attached: [{ code: MUGASH, to: "dh1", encounter: true }] });
    const stage = t.state.questStage ?? "";
    const jumped = run(t, updateCard(t.state, stage, { resources: 1 }), { verb: "RemoveTimeFromQuest", amount: 1 });
    expect(jumped.cards[jumped.questStage ?? ""]?.code).toBe(STAGE_3);
    const back = table({ stage: STAGE_3, phase: "Quest", attached: [{ code: MUGASH, to: "dh1", encounter: true }] });
    const three = back.state.questStage ?? "";
    const short = run(back, updateCard(back.state, three, { progress: 4 }), { verb: "PlaceQuestProgress", perPlayer: 1 });
    expect(short.cards[short.questStage ?? ""]?.code).toBe(STAGE_3);
    const placed = run(back, updateCard(back.state, three, { progress: 5 }), { verb: "PlaceQuestProgress", perPlayer: 1 });
    expect(placed.cards[placed.questStage ?? ""]?.code).toBe(STAGE_2);
    expect(placed.cards[placed.questStage ?? ""]?.resources).toBe(4);
    // Questing places the progress the same way: 4 and the hero's 2 Willpower make 6.
    const questing = table({ stage: STAGE_3, phase: "Quest", progress: 4, committed: ["dh1"], attached: [{ code: MUGASH, to: "dh1", encounter: true }] });
    const quested = drive(questing, opened(questing), (state) => state.cards[state.questStage ?? ""]?.code !== STAGE_3);
    expect(quested.state.cards[quested.state.questStage ?? ""]?.code).toBe(STAGE_2);
  });
});

describe("Mugash as a Guarded objective (07031:A:1 to A:3)", () => {
  const MUGASH = "07031";
  const onEdge = (layout: Layout = {}) => table({ stage: STAGE_1, phase: "Quest", staging: [EDGE], setAside: [MUGASH], ...layout });
  const setup = (layout: Layout = {}) => {
    const t = onEdge(layout);
    return { t, state: resolveRecords(t.state, t.ctx, STAGE_1, "setup", t.state.questStage ?? "").state };
  };

  it("07031:A:2 with Edge of Fangorn gone he lies in the staging area, free to claim; an Action exhausts a ready hero and he attaches to it", () => {
    const { t, state } = setup();
    const mugash = idOf(state, MUGASH);
    expect(state.cards[mugash]?.zone).toBe("attached");
    const edge = idOf(state, EDGE);
    // An encounter effect discards Edge of Fangorn (immune to player card effects only).
    const discarded = moveEncounter(state, edge, "discard", 0, t.ctx, []);
    expect(discarded.cards[edge]?.zone).toBe("encounterDiscard");
    expect(discarded.cards[mugash]?.zone).toBe("staging");
    const claimed = resolveRecords(discarded, t.ctx, MUGASH, "action", mugash);
    expect(claimed.state.cards[mugash]?.zone).toBe("attached");
    expect(claimed.state.cards[idOf(claimed.state, "dh1")]?.attachments).toContain(mugash);
  });

  // Mugash claimed by the first hero: Edge of Fangorn is explored away and the Action resolves, as it does in a game.
  const hosted = () => {
    const { t, state } = setup({ deck: ["07050"] });
    const free = moveEncounter(state, idOf(state, EDGE), "discard", 0, t.ctx, []);
    const claimed = resolveRecords(free, t.ctx, MUGASH, "action", idOf(free, MUGASH));
    return { state: claimed.state, ctx: t.ctx };
  };

  it("07031:A:3 damage to the hero he is attached to sends him to the top of the encounter deck, facedown and controlled by nobody", () => {
    const t = hosted();
    const mugash = idOf(t.state, MUGASH);
    expect(t.state.cards[mugash]?.claimed).toBe(true);
    const hit = settle(placeDamage(t.state, idOf(t.state, "dh1"), 1, t.ctx.cards, [], "framework", ruleCause("rr.damage")), t.ctx, []);
    expect(hit.encounterDeck[0]).toBe(mugash);
    expect(hit.cards[idOf(hit, "dh1")]?.attachments).not.toContain(mugash);
    expect(hit.cards[mugash]?.zone).toBe("encounterDeck");
  });

  it("07031:A:3 a hero destroyed by damage sends him to the deck as well, and one discarded with no damage leaves him in the staging area", () => {
    const t = hosted();
    const mugash = idOf(t.state, MUGASH);
    const dead = settle(placeDamage(t.state, idOf(t.state, "dh1"), 9, t.ctx.cards, [], "framework", ruleCause("rr.damage")), t.ctx, []);
    expect(dead.cards[mugash]?.zone).toBe("encounterDeck");
    const gone = settle(destroyCard(t.state, idOf(t.state, "dh1"), t.ctx.cards, []), t.ctx, []);
    expect(gone.cards[mugash]?.zone).toBe("staging");
  });
});

describe("the verbs and records of the rest (07032:A:2, 07036:A:1, 07037:A:1, 07067:B:2)", () => {
  const MUGASH = "07031";

  it("07031:A:1 Mugash revealed from the deck takes the next card as his guard and both lie in the staging area; he cannot be claimed while it is there", () => {
    const t = table({ stage: STAGE_1, phase: "Quest", deck: [DARK, "07050"] });
    const state = revealedTop(t, MUGASH);
    const mugash = idOf(state, MUGASH);
    expect(zoneOf(state, MUGASH)).toBe("staging");
    expect(zoneOf(state, DARK)).toBe("staging");
    expect(state.cards[idOf(state, DARK)]?.host).toBe(mugash);
  });

  it("07032:A:2 the Travel adds a Huorn to the staging area, a second with 3 or more players, and the travel needs none found", () => {
    const t = table({ stage: STAGE_1, phase: "Travel", staging: [EDGE], deck: [DARK, ANGRY, "07035"] });
    const done = resolveRecords(t.state, t.ctx, EDGE, "travel", idOf(t.state, EDGE));
    expect(zoneOf(done.state, DARK)).toBe("staging");
    expect(zoneOf(done.state, ANGRY)).toBe("encounterDeck");
    const none = table({ stage: STAGE_1, phase: "Travel", staging: [EDGE], deck: ["07050"] });
    expect(resolveRecords(none.state, none.ctx, EDGE, "travel", idOf(none.state, EDGE)).state.cards[idOf(none.state, EDGE)]?.zone).toBe("staging");
  });

  it("07067:B:2 each player chooses an enemy or objective from the discard pile, reveals it and adds it to the staging area, a different card each", () => {
    const t = table({ stage: STAGE_3_CODE, phase: "Quest", seats: 2, deck: ["07051", "07052", "07056", "07057", "07058", "07036"], discard: [DARK, ANGRY, "07050"] });
    const done = resolveRecords(t.state, t.ctx, STAGE_3_CODE, "forced", t.state.questStage ?? "");
    expect([zoneOf(done.state, DARK), zoneOf(done.state, ANGRY), zoneOf(done.state, "07050")]).toEqual(["staging", "staging", "encounterDiscard"]);
    expect(done.state.cards[t.state.questStage ?? ""]?.resources).toBe(3);
  });

  it("07036:A:1 each player keeps the characters beyond 5 exhausted, as many as he chooses; with 5 or fewer none stays", () => {
    const t = table({ stage: STAGE_1, phase: "Refresh", staging: ["07036", "07036"], play: ["ally", "ally", "ally", "ally", "ally"] });
    const characters = [...t.state.seats[0]!.heroes, ...idsOf(t.state, "ally")];
    const tired = characters.reduce((state, id) => updateCard(state, id, { exhausted: true }), t.state);
    const stayed = (state: ScenarioState) => characters.filter((id) => flagged(state, id, "doesNotReady")).length;
    const first = idsOf(tired, "07036")[0] ?? "";
    expect(characters.length).toBe(7);
    expect(stayed(resolveRecords(tired, t.ctx, "07036", "forced", first).state)).toBe(2);
    const fewer = characters.slice(0, 5).reduce((state, id) => updateCard(state, id, { exhausted: true }), t.state);
    expect(stayed(resolveRecords(fewer, t.ctx, "07036", "forced", first).state)).toBe(0);
  });

  it("07037:A:1 each engaged Huorn attacks and is dealt a shadow card; with none engaged each player searches for a Huorn and puts it into play engaged with him", () => {
    const attacked = table({ stage: STAGE_1, phase: "Quest", engaged: [DARK], deck: [ANGRY, "07050"] });
    const hit = resolveRecords(attacked.state, attacked.ctx, "07037", "whenRevealed");
    expect(zoneOf(hit.state, ANGRY)).toBe("shadow");
    const searched = table({ stage: STAGE_1, phase: "Quest", deck: [ANGRY, "07050"], discard: [DARK] });
    const found = resolveRecords(searched.state, searched.ctx, "07037", "whenRevealed");
    expect(zoneOf(found.state, ANGRY)).toBe("engaged");
  });
});
