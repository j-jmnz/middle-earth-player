// Rules: rr.forced, rr.drawing-cards, rr.after, rm.time-x, rm.grima-objective-ally, rr.quest-advancement (data/rules/entries.json); ledger lines 07016:A:2, 07018:A:2, 07020:A:2, 07021:A:1, 07022:A:1, 07044:A:1, 07046:A:2, 07048:A:1, 07059:B:1, 07061:B:3.
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import { updateCard } from "../../../rules/core/state.ts";
import { moveCard } from "../../../rules/core/zones.ts";
import { timeOnReveal } from "../../../rules/families/angmar/time.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { destroyCard } from "../../../rules/core/keywords.ts";
import { mayGainResources } from "../../../rules/families/misc/guards.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { announce, endRound, reveal, rowProblems, type Row } from "../../../../test/harness/card-spec.ts";
import { play } from "../../../../test/harness/card-spec-play.ts";
import { fightEnemy, finish, idOf, legalIntents, resolveRecords, revealedTop, revealFromTop, run, start, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "the-fords-of-isen";
const GRIMA = "07016";
const ISLET = "07017";
const FORDS = "07018";
const STAGE_1 = "07059";
const STAGE_2 = "07060";
const STAGE_3 = "07061";
const table = (layout: Layout) => tableFromLayout(SCENARIO, layout);
const hand = (n: number, seat: number) => Array.from({ length: n }, () => ({ code: "filler", seat }));
const DECKS = Array.from({ length: 12 }, () => "filler");
// The problems a row has on the scenario's records ([] when it holds): a test of a case no record is needed for (a card that does nothing) reads the row the same way.
const holds = (row: Row): string[] => rowProblems(SCENARIO, row, EFFECTS);

describe("Gríma's Action is his controller's (07016:A:2)", () => {
  const offered = (made: ReturnType<typeof table>, state = made.state): boolean => legalIntents(start(state).state, made.ctx).some((intent) => intent.type === "Trigger" && intent.cardId === idOf(state, GRIMA));

  it("07016:A:2 the player who controls him may trigger it", () => {
    expect(offered(table({ play: [GRIMA], deckOf: DECKS }))).toBe(true);
  });

  it("07016:A:2 no player may trigger it while he lies uncontrolled on The Islet", () => {
    const t = table({ seats: 2, staging: [ISLET], setAside: [GRIMA], deckOf: DECKS });
    const lying = run(t, t.state, { verb: "AttachSetAsideTo", code: GRIMA, to: "The Islet", uncontrolled: true, claimed: true });
    expect(offered(t, lying)).toBe(false);
  });

  it("07016:A:2 the other player may not trigger it while the first player controls him", () => {
    const t = table({ seats: 2, play: [{ code: GRIMA, seat: 1 }], deckOf: DECKS });
    expect(offered(t)).toBe(false);
  });
});

describe("Time on the first stage (07059:B:1)", () => {
  it("07059:B:1 turning the stage to side B at the end of Setup puts 5 time counters on it", () => {
    const t = table({ stage: STAGE_1, side: "A" });
    const stage = t.state.questStage ?? "";
    expect(timeOnReveal(updateCard(t.state, stage, { face: "B" }), stage, t.ctx).cards[stage]?.resources).toBe(5);
  });
});

describe("Fords of Isen with a full hand (07018:A:2)", () => {
  const BERSERKER = "07048";
  // Fords of Isen becomes active while the Berserker is engaged with a seat that holds `cards`: what the seat holds after, and whether the Berserker attacked.
  const becomesActive = (cards: number) => {
    const done = play(SCENARIO, { line: "07018:A:2", layout: { staging: [FORDS], engaged: [{ code: BERSERKER, seat: 0 }], deckOf: DECKS, hand: hand(cards, 0), deck: ["f0", "f0", "f0"] }, act: announce("becameActive", FORDS), expect: [] }, EFFECTS, false);
    return { held: done.run.state.seats[0]?.hand.length, attacked: done.run.steps.some((step) => step.kind === "attack") };
  };

  it("07018:A:2 a hand of 5 draws nothing, and the Berserker hears no draw", () => {
    expect(becomesActive(5)).toEqual({ held: 5, attacked: false });
  });

  it("07018:A:2 a hand of 4 draws one card, and the Berserker hears it and attacks", () => {
    expect(becomesActive(4)).toEqual({ held: 5, attacked: true });
  });
});

describe("Constants that stop when their words stop (07017:A:2, 07019:A:1, 07019:A:2, 07020:A:1)", () => {
  const PROWLER = "07042";
  const stat = (code: string, name: "threat" | "attack" | "questPoints", value: number) => ({ expect: "stat" as const, code, name, value });
  it("07017:A:2 a Dunland enemy keeps its Threat while The Islet is in the staging area", () => {
    expect(holds({ line: "07017:A:2", layout: { staging: [ISLET, PROWLER] }, act: [], expect: stat(PROWLER, "threat", 1) })).toEqual([]);
  });
  it("07019:A:1 the King's Road keeps its quest points while every hand holds 2 cards", () => {
    expect(holds({ line: "07019:A:1", layout: { seats: 2, staging: ["07019"], hand: [...hand(2, 0), ...hand(2, 1)] }, act: [], expect: stat("07019", "questPoints", 2) })).toEqual([]);
  });
  it("07019:A:2 the players may decline to travel while every hand holds 4 cards", () => {
    expect(holds({ line: "07019:A:2", layout: { seats: 2, phase: "Travel", staging: ["07019", "place"], hand: [...hand(4, 0), ...hand(4, 1)] }, act: [], expect: { expect: "offers", intent: "DeclineTravel" } })).toEqual([]);
  });
  it("07020:A:1 Gap of Rohan as the active location gives no Attack", () => {
    expect(holds({ line: "07020:A:1", layout: { active: "07020", staging: [PROWLER] }, act: [], expect: stat(PROWLER, "attack", 2) })).toEqual([]);
  });
});

describe("Time counters that a card removes (07020:A:2, 07022:A:1)", () => {
  const RAIDER = "07044";
  // The second stage holds `counters`; the Raider attacks with Gap of Rohan's Shadow card, undefended: 5 + 1 damage kills a hero of 6 hit points, 1 + 1 does not.
  const shadowed = (enemy: string, counters: number) => {
    const fight = fightEnemy((layout: Layout) => table(layout), "07020", enemy, { stage: STAGE_2, hand: [] as never[] }, { undefended: true, tweak: (state) => updateCard(state, state.questStage ?? "", { resources: counters }) });
    return fight.run.state.cards[fight.run.state.questStage ?? ""]?.resources;
  };

  it("07020:A:2 an attack that destroys a character takes the last counter off the stage, and its Forced effect puts 2 back", () => {
    expect(shadowed(RAIDER, 1)).toBe(2);
  });

  it("07020:A:2 an attack that only damages a character takes no counter off", () => {
    expect(shadowed("f0", 1)).toBe(1);
  });

  // Down from the Hills with 2 players who both remove a counter from a stage that holds 1: the Forced effect of the last counter (2 counters back) waits for the end of the When Revealed, so the second player's choice finds none to remove.
  it("07022:A:1 the players choose in turn and the Forced effect of the last counter resolves after the whole When Revealed", () => {
    const t = table({ seats: 2, stage: STAGE_2, deckOf: DECKS, deck: ["f0", "f0", "f0"] });
    const stage = t.state.questStage ?? "";
    const steps: EngineStep[] = [];
    const revealed = revealFromTop(updateCard(t.state, stage, { resources: 1 }), t.ctx, "07022", steps);
    const asked = ["time", "time"];
    const done = finish({ state: revealed.state, steps }, t.ctx, (state) => (state.window?.kind === "choose" ? (asked.shift() ?? state.window.options[0] ?? "") : ""));
    expect(asked).toEqual([]);
    expect(done.state.cards[stage]?.resources).toBe(2);
  });

  it("07022:A:1 a player who chooses to search adds a Dunland enemy to the staging area and no counter comes off", () => {
    const t = table({ stage: STAGE_2, deckOf: DECKS, deck: ["07042", "f0", "f0"] });
    const stage = t.state.questStage ?? "";
    const steps: EngineStep[] = [];
    const revealed = revealFromTop(updateCard(t.state, stage, { resources: 1 }), t.ctx, "07022", steps);
    const done = finish({ state: revealed.state, steps }, t.ctx, (state) => (state.window?.kind === "choose" ? (state.window.options.includes("search") ? "search" : (state.window.options[0] ?? "")) : ""));
    expect(done.state.cards[stage]?.resources).toBe(1);
    expect(done.state.cards[idOf(done.state, "07042")]?.zone).toBe("staging");
  });
});

describe("Pillaging and Burning (07021:A:1)", () => {
  it("07021:A:1 every player draws, each raises his threat by his hand, and only then do the Forced effects of the draws resolve", () => {
    // The Berserker engaged with the first player hears his draw and attacks: its attack comes after the whole When Revealed, so both threats are raised when it begins.
    const done = play(SCENARIO, { line: "07021:A:1", layout: { seats: 2, engaged: [{ code: "07048", seat: 0 }], deckOf: DECKS, hand: [...hand(1, 0), ...hand(2, 1)], deck: ["f0", "f0", "f0"] }, act: reveal("07021"), expect: [] }, EFFECTS, false);
    const steps = done.run.steps;
    expect(steps.some((step) => step.kind === "attack")).toBe(true);
    expect(done.run.state.seats[0]?.threat).toBe(30);
    expect(done.run.state.seats[1]?.threat).toBe(31);
    const at = (predicate: (step: EngineStep) => boolean) => steps.findIndex(predicate);
    expect(at((step) => step.kind === "attack")).toBeGreaterThan(at((step) => step.kind === "draw"));
  });
});

describe("Draws that Forced effects hear after the whole effect (07018:A:2, 07046:A:1)", () => {
  // Both players draw before the Berserker engaged with the first player hears his draw and attacks (rr.after, rr.forced: docs/scenarios/the-ring-maker/the-fords-of-isen.md, Readings).
  const attackAfterEveryDraw = (line: string, staging: string[], act: ReturnType<typeof announce> | ReturnType<typeof reveal>) => {
    const done = play(SCENARIO, { line, layout: { seats: 2, staging, engaged: [{ code: "07048", seat: 0 }], deckOf: DECKS, hand: [...hand(4, 0), ...hand(4, 1)], deck: ["f0", "f0", "f0", "f0"] }, act, expect: [] }, EFFECTS, false);
    const steps = done.run.steps;
    const draws = steps.flatMap((step, at) => (step.kind === "draw" ? [at] : []));
    return { draws: draws.length, attackAfter: steps.findIndex((step) => step.kind === "attack") > Math.max(...draws) };
  };

  it("07046:A:1 each player draws a card, and only then the Berserker hears the first player's draw", () => {
    expect(attackAfterEveryDraw("07046:A:1", [], reveal("07046"))).toEqual({ draws: 2, attackAfter: true });
  });

  it("07018:A:2 each player draws up to 5, and only then the Berserker hears the first player's draw", () => {
    expect(attackAfterEveryDraw("07018:A:2", [FORDS], announce("becameActive", FORDS))).toEqual({ draws: 2, attackAfter: true });
  });
});

describe("Draws heard by the cards of the box (07045:A:2, 07046:A:2, 07048:A:1, 07049:A:2)", () => {
  const draws = (seat: number): ReturnType<typeof announce> => announce("cardsDrawn", undefined, { seat, amount: 1 });

  it("07045:A:2 each player's draw in the resource phase is heard on its own: both players raise their own threat by 1", () => {
    const problems = holds({ line: "07045:A:2", layout: { seats: 2, stage: STAGE_1, deckOf: DECKS, deck: ["f0", "f0", "f0"] }, act: [reveal("07045"), draws(0), draws(1)], expect: [{ expect: "threat", value: 29, seat: 0 }, { expect: "threat", value: 29, seat: 1 }] });
    expect(problems).toEqual([]);
  });

  it("07049:A:2 each player's draw deals 1 damage to a character of that player", () => {
    const problems = holds({ line: "07049:A:2", layout: { seats: 2, stage: STAGE_1, deckOf: DECKS, deck: ["f0", "f0", "f0"] }, act: [reveal("07049"), draws(0), draws(1)], expect: [{ expect: "damageOn", code: "dh1", value: 1 }, { expect: "damageOn", code: "dh3", value: 1 }] });
    expect(problems).toEqual([]);
  });

  it("07046:A:2 each draw gives the Tribesman +1 Threat until the end of the round, and the round's end takes it away", () => {
    const layout: Layout = { seats: 2, staging: ["07046"], deck: ["f0", "f0", "f0"] };
    const twice = holds({ line: "07046:A:2", layout, act: [draws(0), draws(1)], expect: { expect: "stat", code: "07046", name: "threat", value: 2 } });
    expect(twice).toEqual([]);
    const ended = holds({ line: "07046:A:2", layout: { ...layout, phase: "Refresh" }, act: [draws(0), endRound], expect: { expect: "stat", code: "07046", name: "threat", value: 0 } });
    expect(ended).toEqual([]);
  });

  it("07048:A:1 a draw of the other player does not make the Berserker attack", () => {
    const done = play(SCENARIO, { line: "07048:A:1", layout: { seats: 2, engaged: [{ code: "07048", seat: 0 }], deck: ["f0", "f0", "f0"] }, act: draws(1), expect: [] }, EFFECTS, false);
    expect(done.run.steps.some((step) => step.kind === "attack")).toBe(false);
  });

  it("07048:A:1 the engaged player's draw makes it attack him", () => {
    const attacked = play(SCENARIO, { line: "07048:A:1", layout: { seats: 2, engaged: [{ code: "07048", seat: 1 }], deck: ["f0", "f0", "f0"] }, act: draws(1), expect: [] }, EFFECTS, false);
    expect(attacked.run.steps.some((step) => step.kind === "attack")).toBe(true);
  });
});

describe("Dunland Chieftain engages a Raider (07044:A:1)", () => {
  it("07044:A:1 the Raider put into play engaged by the Chieftain deals damage equal to the cards in that player's hand", () => {
    const t = table({ hand: hand(2, 0), deck: ["07044", "place", "f0"] });
    const done = resolveRecords(t.state, t.ctx, "07047", "forced").state;
    expect(done.cards[idOf(done, "07044")]?.zone).toBe("engaged");
    const damage = done.seats[0]?.heroes.reduce((total, id) => total + (done.cards[id]?.damage ?? 0), 0);
    expect(damage).toBe(2);
  });
});

describe("The last enemy leaves play (07061:B:3)", () => {
  it("07061:B:3 a full stage that waits for the last enemy to leave play is defeated the moment it does, and the game is won", () => {
    const t = table({ stage: STAGE_3, progress: 16, staging: ["07042"] });
    const waiting = settle({ ...t.state, window: null, mode: "stopped" }, t.ctx, []);
    expect(waiting.stageCleared).toBeFalsy();
    const gone = moveCard(waiting, idOf(waiting, "07042"), { zone: "encounterDiscard" });
    expect(settle({ ...gone, window: null, mode: "stopped" }, t.ctx, []).stageCleared).toBe(true);
  });
});

describe("Advancing with Gríma (07059:B:3)", () => {
  it("07059:B:3 the first player controls Gríma: the players advance to the next stage", () => {
    expect(holds({ line: "07059:B:3", layout: { stage: STAGE_1, progress: 3, play: [GRIMA], deck: ["f0", "f0"] }, act: { act: "quest", outcome: "success" }, expect: { expect: "resourcesOn", code: STAGE_2, value: 2 } })).toEqual([]);
  });
});

describe("The Fords of Isen Setup and the cards no spec row holds (07016:A:1, 07018:A:1, 07023:A:1, 07047:A:1, 07059:A:1)", () => {
  const lying = () => {
    const t = table({ seats: 2, stage: STAGE_1, staging: [ISLET], setAside: [GRIMA], deck: ["07042", "07043", "f0"], deckOf: DECKS });
    const state = resolveRecords(t.state, t.ctx, STAGE_1, "setup", t.state.questStage ?? "").state;
    return { t, state };
  };

  it("07059:A:1 Setup lays Gríma on The Islet, and each player adds a different Dunland enemy from the encounter deck to the staging area", () => {
    const { state } = lying();
    expect(state.cards[idOf(state, GRIMA)]).toMatchObject({ zone: "attached", host: idOf(state, ISLET), controller: null });
    expect(state.cards[idOf(state, "07042")]?.zone).toBe("staging");
    expect(state.cards[idOf(state, "07043")]?.zone).toBe("staging");
  });

  it("07016:A:1 when The Islet leaves play Gríma is in the staging area, and the first player gains control of him", () => {
    const { t, state } = lying();
    const explored = destroyCard(state, idOf(state, ISLET), t.ctx.cards, [], true);
    expect(explored.cards[idOf(explored, GRIMA)]?.zone).toBe("staging");
    const done = settle({ ...explored, window: null, mode: "stopped" }, t.ctx, []);
    expect(done.cards[idOf(done, GRIMA)]).toMatchObject({ zone: "play", controller: 0 });
    expect(done.lost).toBeFalsy();
  });

  it("07018:A:1 no card gives a hero a resource while Fords of Isen is in the staging area, and the resource phase still does", () => {
    const t = table({ staging: [FORDS, "07042"] });
    const hero = t.state.seats[0]?.heroes[0] ?? "";
    expect(mayGainResources(t.state, hero, idOf(t.state, "07042"), t.ctx)).toBe(false);
    expect(mayGainResources(t.state, hero, null, t.ctx)).toBe(true);
  });

  it("07023:A:1 Ill Tidings goes into the first player's hand and stays there: no discard takes it out", () => {
    const t = table({ hand: ["event", "ally"], deck: ["f0", "f0"] });
    const state = revealedTop(t, "07023");
    const id = idOf(state, "07023");
    expect(state.cards[id]?.zone).toBe("hand");
    expect(moveCard(state, id, { zone: "encounterDiscard" }).cards[id]?.zone).toBe("hand");
  });

  it("07047:A:1 the topmost Dunland enemy discarded this way is the last one discarded", () => {
    const t = table({ hand: hand(3, 0), deck: ["07042", "07043", "07044", "f0"] });
    const done = resolveRecords(t.state, t.ctx, "07047", "forced").state;
    expect(done.cards[idOf(done, "07044")]?.zone).toBe("engaged");
    expect(done.cards[idOf(done, "07042")]?.zone).toBe("encounterDiscard");
    expect(done.cards[idOf(done, "07043")]?.zone).toBe("encounterDiscard");
  });
});
