// Rules: rr.attachment-cards, rr.objective-cards, rr.damage, rr.step-6-4-3, rr.optional-engagement, rr.reveal, rr.first-player, rr.travel, rr.running-out-of-cards (data/rules/entries.json). The pelargir family's verbs, flags and hooks
// (src/catalog/families/pelargir.ts) and the shared reads they join: the travel restriction by title, the announcement of a card discarded from the encounter deck and the mark of an optional engagement. The cards that use them
// are tested in src/campaign/scenarios/peril-in-pelargir/.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { EFFECTS } from "../../../effects/index.ts";
import type { EngineStep } from "../../core/intents.ts";
import { destroyCard } from "../../core/keywords.ts";
import { flagged, type GameEvent, type ScenarioState } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { settle } from "../../engine/machine.ts";
import { pushCardEffects } from "../../interpret/effect-frames.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { travelBlocked } from "../../interpret/restrictions.ts";
import { finish, idOf, revealFromTop, tableFromLayout, type LayoutTable } from "../../../../test/harness/scene-kit.ts";
import { announced, SCENARIO, SCROLL, scrollTable, withScroll } from "../../../../test/scenarios/peril-in-pelargir/scroll.ts";
import { noteOptionalEngage } from "./optional-engage.ts";

const THUG = "05020";
const STOREHOUSE = "05023";
const LOCAL_TROUBLE = "05041";

describe("AttachObjectiveTo", () => {
  it("returns the Scroll to the staging area when the enemy that holds it leaves play, as it does when its hero does", () => {
    const table = scrollTable({ engaged: [THUG] });
    const scroll = idOf(table.state, SCROLL);
    const thug = idOf(table.state, THUG);
    const held = announced(table, { trigger: "damagedByAttack", seat: 0, cardId: table.hero, subject: table.hero, other: thug } as GameEvent);
    const gone = destroyCard(held, thug, table.ctx.cards, []);
    expect(gone.cards[scroll]?.zone).toBe("staging");
    expect(gone.cards[scroll]?.host ?? null).toBeNull();
    expect(gone.cards[scroll]?.claimed).toBeUndefined();
    const heroGone = destroyCard(table.state, table.hero, table.ctx.cards, []);
    expect(heroGone.cards[scroll]?.zone).toBe("staging");
  });

  it("with a card named by code moves it to the picked enemy, from the staging area or from a hero, and with `orStaging` and none picked adds it to the staging area", () => {
    const table = scrollTable({ staging: [THUG] });
    const scroll = idOf(table.state, SCROLL);
    const thug = idOf(table.state, THUG);
    const none = runInstruction({ ...table.state, window: null }, { verb: "AttachObjectiveTo", code: SCROLL, orStaging: true }, { seat: 0, sourceId: null }, table.ctx, []);
    expect(none.cards[scroll]?.zone).toBe("staging");
    expect(none.cards[scroll]?.host ?? null).toBeNull();
    const nothing = runInstruction({ ...table.state, window: null }, { verb: "AttachObjectiveTo", code: SCROLL }, { seat: 0, sourceId: null }, table.ctx, []);
    expect(nothing.cards[scroll]?.host).toBe(table.hero);
    const frame = { ...table.state, window: null };
    const picked = runInstruction(frame, { verb: "AttachObjectiveTo", code: SCROLL, card: "subject" }, { seat: 0, sourceId: thug }, table.ctx, []);
    expect(picked.cards[scroll]?.host).toBe(table.hero);
  });
});

describe("AttachToHighestThreatCost", () => {
  it("attaches the source to the hero with the highest threat cost among those without a copy, asking the first player on a tie", () => {
    const table = tableFromLayout(SCENARIO, { staging: [LOCAL_TROUBLE] });
    const trouble = idOf(table.state, LOCAL_TROUBLE);
    const record = table.ctx.effects.filter((effect) => effect.id === "05041:whenRevealed:1");
    const steps: EngineStep[] = [];
    const pushed = pushCardEffects({ ...table.state, window: null, mode: "stopped" }, "whenRevealed", trouble, 0, false, record, table.ctx, steps);
    const asked = settle(pushed, table.ctx, steps);
    // Both stand-in heroes have the same threat cost: the first player chooses, and nothing is attached before.
    expect(asked.cards[trouble]?.host ?? null).toBeNull();
    expect(asked.window?.kind).toBe("choose");
    const chosen = finish({ state: asked, steps }, table.ctx, () => table.hero2).state;
    expect(chosen.cards[trouble]?.host).toBe(table.hero2);
  });

  it("leaves out a hero that carries a copy, and attaches nowhere when every hero does", () => {
    const table = tableFromLayout(SCENARIO, { staging: [LOCAL_TROUBLE, LOCAL_TROUBLE] });
    const [one, two] = table.state.staging.filter((id) => table.state.cards[id]?.code === LOCAL_TROUBLE);
    const focus = (id: string | undefined) => ({ seat: 0, sourceId: id ?? null, chosen: table.hero });
    const first = runInstruction({ ...table.state, window: null }, { verb: "AttachToHighestThreatCost" }, focus(one), table.ctx, []);
    expect(first.cards[one ?? ""]?.host).toBe(table.hero);
    // The second copy cannot go on the hero that has the first: it goes on the other one, without asking.
    const second = runInstruction({ ...first, window: null }, { verb: "AttachToHighestThreatCost" }, { seat: 0, sourceId: two ?? null }, table.ctx, []);
    expect(second.cards[two ?? ""]?.host).toBe(table.hero2);
    // A third copy has no hero left: it stays where it was.
    const third = spawn({ ...second, window: null }, LOCAL_TROUBLE, { zone: "staging" });
    const none = runInstruction(third.state, { verb: "AttachToHighestThreatCost" }, { seat: 0, sourceId: third.id }, table.ctx, []);
    expect(none.cards[third.id]?.zone).toBe("staging");
  });
});

describe("AttackScrollHolder", () => {
  // Stage 3B's Forced effect (05067:B:2): the first enemy the encounter deck reveals in a round attacks, from the staging area, the player whose hero has the Scroll.
  const revealed = (table: LayoutTable, code: string): ScenarioState => revealFromTop(table.state, table.ctx, code, []).state;

  it("attacks the player of the other seat when the Scroll is on his hero", () => {
    const base = tableFromLayout(SCENARIO, { stage: "05067", deck: ["f0", "f0", "f0"], seats: 2 });
    const table = withScroll(base, "dh3");
    const state = revealed(table, THUG);
    expect(state.pendingAttack?.seat).toBe(1);
  });

  it("makes no attack when the Scroll is in the staging area or on an enemy, or for an enemy that is not the first revealed", () => {
    const loose = tableFromLayout(SCENARIO, { stage: "05067", deck: ["f0", "f0", "f0"], staging: [SCROLL] });
    expect(revealed(loose, THUG).pendingAttack ?? null).toBeNull();
    const onEnemy = tableFromLayout(SCENARIO, { stage: "05067", deck: ["f0", "f0", "f0"], engaged: ["05042"], attached: [{ code: SCROLL, to: "05042" }] });
    expect(revealed(onEnemy, THUG).pendingAttack ?? null).toBeNull();
    // A round that has already revealed an enemy: the next one is not the first.
    const noted = scrollTable({ stage: "05067", deck: ["f0", "f0", "f0"] });
    const later = { ...noted, state: { ...noted.state, modifiers: [...noted.state.modifiers, { instanceId: "table", sourceId: noted.hero, stat: "firstEnemyNoted" as const, amount: 1, until: "endOfRound" as const }] } };
    expect(revealed(later, THUG).pendingAttack ?? null).toBeNull();
  });
});

describe("the reveal of the first enemy each round", () => {
  const FLAGGED = (state: ScenarioState): string[] => Object.values(state.cards).filter((card) => flagged(state, card.id, "firstEnemy")).map((card) => card.code);

  it("marks the first enemy the encounter deck reveals this round and no later one, from a quest phase to the end of the round", () => {
    const table = tableFromLayout(SCENARIO, { stage: "05067", deck: [THUG, "05042", "f0"] });
    const steps: EngineStep[] = [];
    const first1 = revealFromTop(table.state, table.ctx, THUG, steps);
    expect(FLAGGED(first1.state)).toEqual([THUG]);
    const second = revealFromTop(first1.state, table.ctx, "05042", steps);
    expect(FLAGGED(second.state)).toEqual([THUG]);
    expect(flagged(second.state, "table", "firstEnemyNoted")).toBe(true);
  });

  it("marks nothing in a game with no record that reads the condition", () => {
    const table = tableFromLayout(SCENARIO, { stage: "05067" }, { effects: EFFECTS.filter((effect) => effect.cardCode !== "05067") });
    const steps: EngineStep[] = [];
    expect(FLAGGED(revealFromTop(table.state, table.ctx, THUG, steps).state)).toEqual([]);
  });

  it("does not mark an enemy a search added to the staging area", () => {
    const table = tableFromLayout(SCENARIO, { stage: "05067", deck: [THUG] });
    const searched = runInstruction({ ...table.state, window: null }, { verb: "SearchMove", code: THUG, to: "staging" }, { seat: 0, sourceId: null }, table.ctx, []);
    expect(FLAGGED(searched)).toEqual([]);
  });
});

describe("the optional engagement mark", () => {
  it("marks the enemy the player chose in the optional engagement step as engaged optionally, and no other engagement", () => {
    const table = tableFromLayout(SCENARIO, { phase: "Encounter", staging: ["05042"] });
    const zealous = idOf(table.state, "05042");
    const marked = noteOptionalEngage(table.state, zealous, table.ctx);
    expect(flagged(marked, zealous, "engagedOptionally")).toBe(true);
    const unread = tableFromLayout(SCENARIO, { phase: "Encounter", staging: ["05042"] }, { effects: EFFECTS.filter((effect) => effect.cardCode !== "05042" && effect.cardCode !== "05043" && effect.cardCode !== "05044") });
    expect(noteOptionalEngage(unread.state, idOf(unread.state, "05042"), unread.ctx)).toBe(unread.state);
  });
});

describe("the shared reads", () => {
  it("Restrict travel with exceptTitle bars every location whose title is not the one, and no copy of it", () => {
    const table = tableFromLayout(SCENARIO, { staging: ["05038", "05021", "05038"], phase: "Travel" });
    const streets = table.state.staging.filter((id) => table.state.cards[id]?.code === "05038");
    const fish = idOf(table.state, "05021");
    expect(travelBlocked(table.state, table.ctx, fish)).toBe(true);
    expect(streets.map((id) => travelBlocked(table.state, table.ctx, id))).toEqual([false, false]);
    const gone = tableFromLayout(SCENARIO, { staging: ["05021"], phase: "Travel" });
    expect(travelBlocked(gone.state, gone.ctx, idOf(gone.state, "05021"))).toBe(false);
  });

  it("announces a card that goes from the top of the encounter deck to the discard pile only while Harbor Storehouse is in play", () => {
    const withStorehouse = tableFromLayout(SCENARIO, { staging: [STOREHOUSE], deck: ["05021", "f0"] });
    const steps: EngineStep[] = [];
    const discarded = runInstruction({ ...withStorehouse.state, window: null }, { verb: "DiscardEncounterTop", count: 1 }, { seat: 0, sourceId: null }, withStorehouse.ctx, steps);
    expect((discarded.pendingEvents ?? []).some((event) => event.trigger === "discardedFromEncounterDeck")).toBe(true);
    const without = tableFromLayout(SCENARIO, { deck: ["05021", "f0"] });
    const quiet = runInstruction({ ...without.state, window: null }, { verb: "DiscardEncounterTop", count: 1 }, { seat: 0, sourceId: null }, without.ctx, steps);
    expect((quiet.pendingEvents ?? []).some((event) => event.trigger === "discardedFromEncounterDeck")).toBe(false);
  });
});

describe("DiscardEncounterTopMore", () => {
  // Two cards, then one more; the threat of the actor rises by one for each location the effect discarded (`discardedMatching`).
  const threatAfter = (verb: "DiscardEncounterTop" | "DiscardEncounterTopMore"): number => {
    const table = tableFromLayout(SCENARIO, { staging: ["05024"], deck: ["05021", "05022", "f0", "f0"], threat: [20, 20] });
    const source = idOf(table.state, "05024");
    const record: Effect = { id: "05024:test:1", cardCode: "05024", lines: ["05024:A:1"], timing: "whenRevealed", instructions: [{ verb: "DiscardEncounterTop", count: 2 }, { verb, count: 1 }, { verb: "RaiseThreat", amount: { discardedMatching: { type: "location", control: "any" } }, who: "actor" }] };
    const steps: EngineStep[] = [];
    const pushed = pushCardEffects({ ...table.state, window: null }, "whenRevealed", source, 0, false, [record], table.ctx, steps);
    const done = settle(pushed, table.ctx, steps);
    return (done.seats[0]?.threat ?? 0) - 20;
  };

  it("counts the cards of both steps, where DiscardEncounterTop alone counts the last step's", () => {
    expect(threatAfter("DiscardEncounterTopMore")).toBe(2);
    expect(threatAfter("DiscardEncounterTop")).toBe(0);
  });
});

describe("RaiseThreatPerDiscarded", () => {
  // Collateral Damage's two discard steps with the deck reset between them (quest phase): the locations discarded before the reset still count.
  const threatAfter = (instructions: Effect["instructions"]): number => {
    const table = tableFromLayout(SCENARIO, { staging: ["05024"], deck: ["05021", "05022"], threat: [20, 20] });
    const source = idOf(table.state, "05024");
    const record: Effect = { id: "05024:test:1", cardCode: "05024", lines: ["05024:A:1"], timing: "whenRevealed", instructions };
    const steps: EngineStep[] = [];
    const done = settle(pushCardEffects({ ...table.state, window: null }, "whenRevealed", source, 0, false, [record], table.ctx, steps), table.ctx, steps);
    return (done.seats[0]?.threat ?? 0) - 20;
  };

  it("counts each location the effect discarded once, one the deck reset in the middle of the effect put back in the deck as well", () => {
    const steps: Effect["instructions"] = [{ verb: "DiscardEncounterTop", count: 2 }, { verb: "DiscardEncounterTopMore", count: 1, reset: true }];
    expect(threatAfter([...steps, { verb: "RaiseThreatPerDiscarded", type: "location", amount: 2 }])).toBe(4);
  });
});
