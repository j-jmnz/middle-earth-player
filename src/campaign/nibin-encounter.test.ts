// Rules: rr.step-3-3, rr.engaged, rr.shadow-effects, rr.explored, rr.search, rr.damage, rr.hit-points, rr.active-location, rr.first-player (data/rules/entries.json). The encounter
// cards of The Caves of Nibin-Dûm that no template reads: each line of the ledger (data/printed/mirkwood-paths.json) has a record, and these tests run them on a table of
// plain-number heroes (test/scenarios/the-caves-of-nibin-dum/scene.ts). The Cave Torch cards are in nibin-torch.test.ts.
import { beforeAll, describe, expect, it } from "vitest";

import { syncConstants } from "../rules/interpret/constants.ts";
import { runInstruction } from "../rules/interpret/interpret.ts";
import { legalIntents } from "../rules/engine/legal.ts";
import { modifiedStat } from "../rules/core/keywords.ts";
import { settle } from "../rules/engine/machine.ts";
import type { PlayerIntent } from "../rules/engine/reduce.ts";
import { seatThreat } from "../rules/families/play/hooks.ts";
import type { ScenarioState } from "../rules/core/state.ts";
import { causeProblems } from "../../test/harness/cause-check.ts";
import { codesIn, fight, loadCavesWorld, cavesTable, resolveReveal, settleChoices, type CavesLayout, type CavesWorld } from "../../test/scenarios/the-caves-of-nibin-dum/scene.ts";
import { first, reveal, send, start, type Run } from "../../test/scenarios/a-shadow-of-the-past/scene.ts";

let world: CavesWorld;

beforeAll(async () => {
  world = await loadCavesWorld();
});

function make(layout: CavesLayout = {}) {
  const made = cavesTable(world, layout);
  return { ...made, state: syncConstants(made.state, made.ctx) };
}

type Table = ReturnType<typeof make>;

// `amount` progress placed on the quest, as questing does: the active location takes it first.
function progress(made: Table, amount: number, state: ScenarioState = made.state): ScenarioState {
  return settle(syncConstants(runInstruction({ ...state, window: null }, { verb: "ProgressQuest", amount }, { seat: 0, sourceId: state.questStage }, made.ctx, []), made.ctx), made.ctx, []);
}

const questProgress = (state: ScenarioState) => state.cards[state.questStage ?? ""]?.progress ?? 0;
const heroes = (state: ScenarioState) => Object.values(state.cards).filter((card) => card.zone === "heroes");

describe("Great Cave-troll (41030:A:1, 41030:A:2)", () => {
  it("cannot have attachments (41030:A:1)", () => {
    const made = make({ engaged: [{ code: "41030", seat: 0 }] });
    expect(made.state.modifiers.some((modifier) => modifier.stat === "cannotHaveAttachments" && modifier.instanceId === first(made.state, "41030"))).toBe(true);
  });

  it("removes 1 progress from the current quest for each point of excess combat damage (41030:A:2)", () => {
    // Attack 6 against a defender with Defense 2 deals 4; a hero with 6 hit points and 3 damage has 3 left: 1 point is excess.
    // A second enemy in the staging area keeps Surprise Attack at 8 quest points (4 for each enemy, 41005:B:2), so 5 progress does not complete it.
    const hit = fight(world, "f0", "41030", { stage: "41005", progress: 5, staging: ["f0"], damage: [["dh1", 3]] });
    expect(hit.run.state.cards[hit.hero]?.damage).toBe(7);
    expect(questProgress(hit.run.state)).toBe(4);
    expect(causeProblems(hit.run.steps)).toEqual([]);
  });

  it("removes nothing when the damage does not exceed the hit points left, or when the quest holds none (41030:A:2)", () => {
    const whole = fight(world, "f0", "41030", { stage: "41005", progress: 5, staging: ["f0"] });
    expect(whole.run.state.cards[whole.hero]?.damage).toBe(4);
    expect(questProgress(whole.run.state)).toBe(5);
    const empty = fight(world, "f0", "41030", { stage: "41005", progress: 0, damage: [["dh1", 3]] });
    expect(questProgress(empty.run.state)).toBe(0);
  });
});

describe("Goblin Chieftain (41027:A:2, 41027:A:3)", () => {
  it("cannot have attachments or take damage (41027:A:2)", () => {
    const made = make({ staging: ["41027"] });
    const id = first(made.state, "41027");
    expect(made.state.modifiers.some((modifier) => modifier.stat === "cannotHaveAttachments" && modifier.instanceId === id)).toBe(true);
    expect(made.state.modifiers.some((modifier) => modifier.stat === "cannotTakeDamage" && modifier.instanceId === id)).toBe(true);
  });

  it("has the first player choose after it attacks: remove X progress from the quest, or return it to the staging area (41027:A:3)", () => {
    // On stage 2 X is 2: the Chieftain attacks with Attack 2 against a defender with Defense 2.
    for (const [answer, progressLeft, zone] of [["progress", 3, "engaged"], ["staging", 5, "staging"]] as const) {
      // A second enemy keeps Surprise Attack at 8 quest points (41005:B:2), so 5 progress does not complete it.
      const hit = fight(world, "f0", "41027", { stage: "41005", progress: 5, staging: ["f0"] }, { answer: () => ({ type: "Choose", optionId: answer }) });
      const chieftain = hit.run.state.cards[first(hit.run.state, "41027")];
      expect(questProgress(hit.run.state), answer).toBe(progressLeft);
      expect(chieftain?.zone, answer).toBe(zone);
    }
  });

  it("does not offer the progress branch while the quest holds none: the Chieftain returns to the staging area (41027:A:3, rr.effects)", () => {
    // An effect with no potential to change the game state cannot be selected, so the only option left is the staging area.
    const hit = fight(world, "f0", "41027", { stage: "41005", progress: 0 }, { answer: () => ({ type: "Choose", optionId: "progress" }) });
    expect(questProgress(hit.run.state)).toBe(0);
    expect(hit.run.state.cards[first(hit.run.state, "41027")]?.zone).toBe("staging");
  });
});

describe("Goblin Tunnels (41032:A:1, 41032:A:2)", () => {
  it("takes a progress token off the quest when a Goblin is revealed while it is in the staging area (41032:A:1)", () => {
    const made = make({ staging: ["41032"], stage: "41006", progress: 4, deck: ["41020", "f0"] });
    const run = reveal(made.state, made.ctx);
    expect(codesIn(run.state, "staging")).toContain("41020");
    expect(questProgress(run.state)).toBe(3);
    const other = make({ staging: ["41032"], stage: "41006", progress: 4, deck: ["f0", "41020"] });
    expect(questProgress(reveal(other.state, other.ctx).state)).toBe(4);
  });

  it("does nothing from the active location or the discard pile (41032:A:1)", () => {
    const made = make({ active: "41032", stage: "41006", progress: 4, deck: ["41020", "f0"] });
    expect(questProgress(reveal(made.state, made.ctx).state)).toBe(4);
  });

  it("adds 1 Attack to the attacking enemy as a Shadow card, 3 when it is a Goblin (41032:A:2)", () => {
    // Defense 2: Attack 1 + 1 = 2 deals nothing; a Goblin's 1 + 3 = 4 deals 2.
    const plain = fight(world, "41032", "grunt");
    expect(plain.run.state.cards[plain.hero]?.damage).toBe(0);
    const goblin = fight(world, "41032", "gob");
    expect(goblin.run.state.cards[goblin.hero]?.damage).toBe(2);
  });
});

describe("Collapsed Mine (41035:A:1, 41035:A:2)", () => {
  it("lets no more than 4 progress be placed on the quest each round while it is in the staging area (41035:A:1)", () => {
    const made = make({ staging: ["41035"], stage: "41006", progress: 0 });
    const first6 = progress(made, 6);
    expect(questProgress(first6)).toBe(4);
    // Nothing more this round, and the cap is read afresh next round.
    expect(questProgress(progress(made, 3, first6))).toBe(4);
    const later = { ...first6, modifiers: first6.modifiers.filter((modifier) => modifier.stat !== "questProgressPlaced") };
    expect(questProgress(progress(made, 3, later))).toBe(7);
  });

  it("does not hold back progress on the active location, nor without the card in the staging area (41035:A:1)", () => {
    const made = make({ staging: ["41035"], active: "place", stage: "41006" });
    const placed = progress(made, 5);
    expect(questProgress(placed)).toBe(3);
    const free = make({ stage: "41006" });
    expect(questProgress(progress(free, 6))).toBe(6);
  });

  it("is a cap of 4, not 8, with two copies in the staging area (41035:A:1)", () => {
    const made = make({ staging: ["41035", "41035"], stage: "41006" });
    expect(questProgress(progress(made, 9))).toBe(4);
  });

  it("raises the defending player's threat by the damage the attack dealt as a Shadow card (41035:A:2)", () => {
    // Attack 1 against Defense 2 deals nothing; the strong "brute" deals 9 - 2 = 7.
    const quiet = fight(world, "41035", "grunt");
    expect(seatThreat(quiet.run.state, 0)).toBe(seatThreat(quiet.start, 0));
    const hit = fight(world, "41035", "brute");
    expect(seatThreat(hit.run.state, 0)).toBe(seatThreat(hit.start, 0) + 7);
    expect(causeProblems(hit.run.steps)).toEqual([]);
  });
});

describe("Branching Paths (41034:A:1, 41034:A:2)", () => {
  it("gives each Dark location +1 Threat while it is in the staging area, itself included (41034:A:1)", () => {
    const made = make({ staging: ["41034", "41032", "41037"] });
    const threat = (state: ScenarioState, code: string) => modifiedStat(state, state.cards[first(state, code)]!, "threat", made.ctx.cards);
    expect(threat(made.state, "41034")).toBe(2);
    expect(threat(made.state, "41032")).toBe(3);
    // Crumbling Stairs is Underground only.
    expect(threat(made.state, "41037")).toBe(3);
    const active = make({ active: "41034", staging: ["41032"] });
    expect(modifiedStat(active.state, active.state.cards[first(active.state, "41032")]!, "threat", active.ctx.cards)).toBe(2);
  });

  it("looks at the top 3 encounter cards when explored, reveals the one the players choose and moves the other 2 to the bottom (41034:A:2)", () => {
    const made = make({ active: "41034", deck: ["41030", "41031", "41036", "41038", "f0"] });
    let current = progress(made, 3);
    for (let guard = 0; guard < 8 && (current.window?.kind === "look" || current.window?.kind === "choose"); guard += 1) {
      const window = current.window;
      current = window.kind === "look" ? settle({ ...send({ state: current, steps: [] }, { type: "Pass" }, made.ctx).state }, made.ctx, []) : send({ state: current, steps: [] }, { type: "Choose", optionId: window.options.find((id) => current.cards[id]?.code === "41031") ?? window.options[0] ?? "" }, made.ctx).state;
    }
    expect(codesIn(current, "staging")).toContain("41031");
    expect(current.encounterDeck.map((id) => current.cards[id]?.code)).toEqual(["41038", "f0", "41030", "41036"]);
  });
});

describe("Goblin Dungeon (41036:A:1, 41036:A:2)", () => {
  it("has a card revealed to travel there, and the first player puts an ally from the top 5 cards of his deck into play when it is explored (41036:A:2)", () => {
    const made = make({ active: "41036", deckOf: ["filler", "ally", "filler", "filler", "filler", "filler"] });
    const explored = progress(made, 5);
    // The Response is the first player's to use once the location has left play.
    const offer = legalIntents(explored, made.ctx).find((intent) => intent.type === "Trigger" && explored.cards[intent.cardId]?.code === "41036");
    if (offer?.type !== "Trigger") throw new Error("the Goblin Dungeon's Response is not offered");
    const current = settleChoices(send({ state: explored, steps: [] }, offer, made.ctx), made.ctx).state;
    expect(Object.values(current.cards).filter((card) => card.code === "ally" && card.zone === "play")).toHaveLength(1);
    expect(Object.values(current.cards).filter((card) => card.code === "ally" && card.zone === "deck")).toHaveLength(0);
  });

  it("reveals the top encounter card to travel there (41036:A:1)", () => {
    const made = make({ staging: ["41036"], phase: "Travel", deck: ["f0", "f3"] });
    const effect = made.ctx.effects.find((entry) => entry.id === "41036:travel:1");
    expect(effect?.instructions).toEqual([{ verb: "RevealEncounter" }]);
  });
});

describe("Crumbling Stairs (41037:A:1, 41037:A:2)", () => {
  it("takes no progress in the staging area (41037:A:1)", () => {
    const made = make({ staging: ["41037"] });
    const placed = settle(runInstruction({ ...made.state, window: null }, { verb: "PlaceProgressOn", amount: 2, target: "self" }, { seat: 0, sourceId: first(made.state, "41037") }, made.ctx, []), made.ctx, []);
    expect(placed.cards[first(made.state, "41037")]?.progress).toBe(0);
  });

  it("discards the top encounter card when explored, and a location goes into play as the active location (41037:A:2)", () => {
    const made = make({ active: "41037", deck: ["41033", "f0"] });
    const current = progress(made, 3);
    expect(codesIn(current, "activeLocation")).toEqual(["41033"]);
    const enemy = make({ active: "41037", deck: ["f0", "41033"] });
    const after = progress(enemy, 3);
    expect(codesIn(after, "activeLocation")).toEqual([]);
    expect(codesIn(after, "encounterDiscard")).toContain("f0");
  });
});

describe("Crumbling Ruin (41038:A:1)", () => {
  it("has each player exhaust a character and discard the top card of his deck, and discard the character when the printed cost is its remaining hit points or more", () => {
    // The heroes have 6 hit points; "ally" costs 0: nothing is discarded. A filler event costs 0 too.
    const calm = make({ deckOf: ["ally", "filler"] });
    const run = resolveReveal(calm.state, calm.ctx, "41038", (state) => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : ""));
    expect(heroes(run.state).filter((card) => card.exhausted)).toHaveLength(1);
    expect(heroes(run.state)).toHaveLength(2);
    expect(run.state.seats[0].discard).toHaveLength(1);
    expect(causeProblems(run.steps)).toEqual([]);
  });

  it("discards the exhausted character when the discarded card's cost reaches its remaining hit points", () => {
    const made = make({ deckOf: ["costly"], damage: [["dh1", 5], ["dh2", 5]] });
    const run = resolveReveal(made.state, made.ctx, "41038", (state) => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : ""));
    expect(heroes(run.state)).toHaveLength(1);
  });

  it("does nothing more with an empty deck or no ready character", () => {
    const made = make({});
    const run = resolveReveal(made.state, made.ctx, "41038", (state) => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : ""));
    expect(heroes(run.state)).toHaveLength(2);
  });
});

describe("Watchful Eyes (41040:A:1)", () => {
  it("is attached by the first player to one of his heroes and counts as a Condition attachment", () => {
    const made = make({});
    const run = resolveReveal(made.state, made.ctx, "41040", (state) => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : ""));
    const eyes = run.state.cards[first(run.state, "41040")];
    expect(eyes?.zone).toBe("attached");
    expect(heroes(run.state).map((card) => card.id)).toContain(eyes?.host);
  });

  it("has an encounter card revealed and added to the staging area at the end of the combat phase if the attached hero is exhausted", () => {
    const made = make({ attachedEncounter: ["41040"], phase: "Combat", deck: ["f0", "41032"] });
    const tired = { ...made.state, cards: { ...made.state.cards, [made.hero]: { ...made.state.cards[made.hero]!, exhausted: true } } };
    let run: Run = start(syncConstants(tired, made.ctx));
    for (let guard = 0; guard < 30 && run.state.phase === "Combat" && !run.state.lost; guard += 1) {
      const window = run.state.window;
      if (window?.kind === "choose") run = send(run, { type: "Choose", optionId: window.options[0] ?? "" }, made.ctx);
      else {
        const intent = legalIntents(run.state, made.ctx).find((item) => item.type === "Pass" || item.type === "DeclineAttack");
        if (!intent) break;
        run = send(run, intent as PlayerIntent, made.ctx);
      }
    }
    expect(codesIn(run.state, "staging")).toContain("f0");
  });
});

describe("Shiny Distraction (41042:A:2)", () => {
  it("lets each player add 1 resource to each of his heroes' pools and raise his threat by 5", () => {
    const made = make({ seats: 2 });
    const run = resolveReveal(made.state, made.ctx, "41042", () => "add");
    expect(heroes(run.state).map((card) => card.resources)).toEqual([1, 1, 1]);
    expect(seatThreat(run.state, 0)).toBe(28 + 5);
    expect(seatThreat(run.state, 1)).toBe(26 + 5);
  });

  it("changes nothing for a player who declines, and only that player", () => {
    const made = make({ seats: 2 });
    let first = true;
    const run = resolveReveal(made.state, made.ctx, "41042", () => {
      const answer = first ? "decline" : "add";
      first = false;
      return answer;
    });
    expect(seatThreat(run.state, 0)).toBe(28);
    expect(seatThreat(run.state, 1)).toBe(31);
    expect(heroes(run.state).filter((card) => card.resources > 0)).toHaveLength(1);
  });
});
