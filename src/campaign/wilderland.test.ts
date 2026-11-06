import { describe, expect, it } from "vitest";

import { ALLY_LINE_FACTS, ALLY_LINES } from "../catalog/ally-lines.ts";
import { cardMap, hero, idleScenario } from "../rules/core/test-fixture.ts";
import { definePrinted } from "../rules/core/printed.ts";
import type { CampaignFacts } from "../rules/core/campaign-state.ts";
import { openResolution } from "../rules/setup/resolution.ts";
import { legalIntents, reduce, type ReduceContext, type ScenarioState } from "../rules/engine/reduce.ts";
import { updateCard } from "../rules/core/state.ts";
import { attachTo, spawn } from "../rules/core/zones.ts";

import { applyResolution, emptyLog, type CampaignLog } from "./log.ts";
import { parseLog, newSave } from "./save.ts";
import { choiceSentence, promptSentence, resolutionView, settledSentence } from "./resolution-view.ts";
import { cappedTally, logConditionHolds, NO_COPY_LIMITS, poolEncounterCopies, wilderlandFacts, WILDERLAND_CAMPAIGN } from "./wilderland.ts";
import { copiesMark, encounterSpeech, keepsWilderlandLog, wilderlandView } from "./wilderland-view.ts";
import { campaignPath } from "./path.ts";
import type { World } from "./world.ts";

// Rules: emce.campaign-log, emce.treasure, emce.boon-allies, emce.campaign-pool-encounter (data/rules/entries.json). The Ered Mithrin Campaign Log: its columns, what a won
// scenario's Resolution writes into them, what the game reads back, and an older save that has none of them.
const cards = cardMap([
  hero("frodo", "lore"),
  hero("sam", "spirit"),
  definePrinted({ code: "stage", name: "Stage", type: "quest" }),
  definePrinted({ code: "growing", name: "A Growing Threat", type: "treachery" }),
  definePrinted({ code: "wolf", name: "Gundabad Hunter", type: "enemy" }),
  definePrinted({ code: "t1", name: "Anvil of Gundabad", type: "treasure", campaignKind: "treasure" }),
  definePrinted({ code: "turayn", name: "Turayn", type: "ally", isUnique: true }),
]);
const ctx: ReduceContext = { effects: [], cards };
const SCENARIO = "journey-up-the-anduin";

function game(facts?: CampaignFacts): ScenarioState {
  let state: ScenarioState = { ...idleScenario(1), scenarioId: SCENARIO, ...(facts ? { campaignFacts: facts } : {}) };
  state = spawn(state, "frodo", { zone: "heroes", seat: 0 }).state;
  return state;
}

function won(state: ScenarioState, resolution: ScenarioState["resolution"]): ScenarioState {
  return openResolution({ ...state, stageCleared: true, window: null, resolution }, ctx);
}

const baseFacts: CampaignFacts = { prisoner: null, usedOnce: [], counters: {} };

describe("the log's Ered Mithrin columns", () => {
  it("starts empty", () => {
    expect(emptyLog(2)).toMatchObject({ treasures: [], allyLines: [], beldisUses: [], encounterPool: {} });
  });

  it("round-trips through the save's schema", () => {
    const log: CampaignLog = { ...emptyLog(2), treasures: ["t1"], allyLines: ["turayn", "beldis"], beldisUses: [2, 4], encounterPool: { growing: 1, wolf: 3 } };
    expect(parseLog(JSON.parse(JSON.stringify(log)))).toEqual(log);
  });

  it("keeps the pool cards a Resolution shuffles into a deck after the starting hand, and the copy number, so a save written after Misplaced Trust loads (12184:B:3)", () => {
    const pooled = [{ code: "12186", back: "player" as const, burdenSet: null, attachedTo: null, seat: 0, perPlayer: true, afterHand: true as const }, { code: "11197", back: "player" as const, burdenSet: null, attachedTo: null, seat: 1, afterHand: true as const, copy: 2 }];
    const log: CampaignLog = { ...emptyLog(2), campaignPool: pooled };
    expect(parseLog(JSON.parse(JSON.stringify(log)))).toEqual(log);
    expect(() => parseLog({ ...log, campaignPool: [{ ...pooled[0], afterHand: false }] })).toThrow();
  });

  it("reads a log saved before them with the defaults, so an old save loads", () => {
    const { treasures: _t, allyLines: _a, beldisUses: _b, encounterPool: _e, ...old } = emptyLog(1);
    const parsed = parseLog(JSON.parse(JSON.stringify(old)));
    expect(parsed).toEqual(emptyLog(1));
    expect(newSave("s", WILDERLAND_CAMPAIGN, 1).log).toEqual(emptyLog(1));
  });

  it("refuses more than four boxes beside Beldis and a pool card with no copies", () => {
    expect(() => parseLog({ ...emptyLog(1), beldisUses: [5] })).toThrow();
    expect(() => parseLog({ ...emptyLog(1), encounterPool: { wolf: 0 } })).toThrow();
    expect(() => parseLog({ ...emptyLog(1), allyLines: ["gimli"] })).toThrow();
  });
});

describe("what a won scenario writes", () => {
  const resolution: ScenarioState["resolution"] = [
    { verb: "AddEncounterToPool", codes: ["growing", "wolf"] },
    { verb: "BoonAllyOrLogLine", ally: "turayn", line: "turayn" },
  ];

  function resolved(state: ScenarioState, answer: string, lines: ScenarioState["resolution"] = resolution): ScenarioState {
    const waiting = won(state, lines);
    const answered = reduce(waiting, { type: "ChooseResolution", optionId: answer }, ctx);
    if (!answered.ok) throw new Error(answered.reason);
    return answered.state;
  }

  it("records the line, the tally and the treasures, keeping what the log held", () => {
    const table = game({ ...baseFacts, encounterPool: { wolf: 1 } });
    const treasure = spawn(table, "t1", { zone: "attached" });
    const held = updateCard(attachTo(treasure.state, treasure.id, Object.values(table.cards)[0]?.id ?? ""), treasure.id, { controller: 0, claimed: true });
    const state = resolved(held, "line", [...resolution, { verb: "DiscoverTreasure" }]);
    const before: CampaignLog = { ...emptyLog(1), treasures: ["t0"], allyLines: ["isolde"], encounterPool: { wolf: 1 } };
    const log = applyResolution(before, SCENARIO, state, cards, NO_COPY_LIMITS);
    expect(log.allyLines).toEqual(["isolde", "turayn"]);
    expect(log.encounterPool).toEqual({ wolf: 2, growing: 1 });
    expect(log.treasures).toEqual(["t0", "t1"]);
    expect(log.completed).toEqual([SCENARIO]);
    expect(log.campaignPool).toEqual([]);
  });

  it("puts the ally in the pool for the player chosen, and no line in the log", () => {
    const waiting = won(game(), resolution);
    const ally = legalIntents(waiting, ctx).flatMap((intent) => (intent.type === "ChooseResolution" && intent.optionId !== "line" ? [intent.optionId] : []))[0] ?? "";
    const log = applyResolution(emptyLog(1), SCENARIO, resolved(game(), ally), cards, NO_COPY_LIMITS);
    expect(log.campaignPool.map((card) => [card.code, card.seat, card.back])).toEqual([["turayn", 0, "player"]]);
    expect(log.allyLines).toEqual([]);
  });

  it("never tallies more copies of a card than one collection holds", () => {
    const state = resolved(game({ ...baseFacts, encounterPool: { wolf: 2 } }), "line");
    const log = applyResolution(emptyLog(1), SCENARIO, state, cards, new Map([["wolf", 2], ["growing", 1]]));
    expect(log.encounterPool).toEqual({ wolf: 2, growing: 1 });
    expect(cappedTally({ wolf: 3, growing: 1, other: 2 }, new Map([["wolf", 2]]))).toEqual({ wolf: 2, growing: 1, other: 2 });
    expect(cappedTally({ wolf: 3 }, undefined)).toEqual({ wolf: 3 });
  });

  it("writes nothing for a loss, and does not grant a scenario twice", () => {
    const lost = { ...resolved(game(), "line"), lost: true };
    expect(applyResolution(emptyLog(1), SCENARIO, lost, cards, NO_COPY_LIMITS)).toEqual(emptyLog(1));
    const once = applyResolution(emptyLog(1), SCENARIO, resolved(game(), "line"), cards, NO_COPY_LIMITS);
    expect(applyResolution(once, SCENARIO, resolved(game(), "line"), cards, NO_COPY_LIMITS)).toBe(once);
  });

  it("returns the boxes beside Beldis the game ended with", () => {
    const state = resolved(game({ ...baseFacts, beldisUses: [3] }), "line");
    expect(applyResolution({ ...emptyLog(1), beldisUses: [3] }, SCENARIO, state, cards, NO_COPY_LIMITS).beldisUses).toEqual([3]);
    expect(applyResolution(emptyLog(1), SCENARIO, resolved(game(), "line"), cards, NO_COPY_LIMITS).beldisUses).toEqual([]);
  });
});

describe("what the game reads back (CampaignFacts)", () => {
  const log: CampaignLog = { ...emptyLog(2), treasures: ["t1"], allyLines: ["melanwar"], beldisUses: [0, 2], encounterPool: { wolf: 2 }, campaignPool: [{ code: "turayn", back: "player", burdenSet: null, attachedTo: null, seat: 1 }] };

  it("hands the Ered Mithrin campaign the columns it holds and the pool's cards", () => {
    expect(wilderlandFacts(log, WILDERLAND_CAMPAIGN)).toEqual({ treasures: ["t1"], allyLines: ["melanwar"], beldisUses: [0, 2], encounterPool: { wolf: 2 }, pool: [{ code: "turayn", seat: 1 }] });
    expect(wilderlandFacts(emptyLog(1), WILDERLAND_CAMPAIGN)).toEqual({});
  });

  it("hands every other campaign nothing, so its game is dealt exactly as before", () => {
    expect(wilderlandFacts(log, "dream-chaser")).toEqual({});
    expect(wilderlandFacts(log, "mirkwood-paths")).toEqual({});
  });

  it("reads the lines and the treasure count for a campaign Setup line's condition, and holds any other condition", () => {
    const facts: CampaignFacts = { ...baseFacts, allyLines: ["turayn"], treasures: ["a", "b", "c", "d", "e", "f"] };
    expect(logConditionHolds(undefined, facts)).toBe(true);
    expect(logConditionHolds({ kind: "treasuresLogged", min: 6 }, facts)).toBe(true);
    expect(logConditionHolds({ kind: "treasuresLogged", min: 7 }, facts)).toBe(false);
    expect(logConditionHolds({ kind: "treasuresLogged", min: 1 }, undefined)).toBe(false);
    expect(logConditionHolds({ kind: "logged", line: "turayn" }, facts)).toBe(true);
    expect(logConditionHolds({ kind: "logged", line: "isolde" }, facts)).toBe(false);
    expect(logConditionHolds({ kind: "not", condition: { kind: "logged", line: "isolde" } }, facts)).toBe(true);
    expect(logConditionHolds({ kind: "any", conditions: [{ kind: "logged", line: "isolde" }, { kind: "logged", line: "turayn" }] }, facts)).toBe(true);
    expect(logConditionHolds({ kind: "all", conditions: [{ kind: "logged", line: "isolde" }, { kind: "logged", line: "turayn" }] }, facts)).toBe(false);
    expect(logConditionHolds({ kind: "freeOfEncounters" }, facts)).toBe(true);
  });

  it("lists the pool's encounter cards once for each copy, in code order", () => {
    expect(poolEncounterCopies({ wolf: 2, growing: 1 })).toEqual(["growing", "wolf", "wolf"]);
    expect(poolEncounterCopies({})).toEqual([]);
  });
});

describe("the path and the log screen's view", () => {
  it("keeps the columns for Ered Mithrin only", () => {
    expect(keepsWilderlandLog({ id: "ered-mithrin" })).toBe(true);
    expect(keepsWilderlandLog({ id: "dream-chaser" })).toBe(false);
  });

  it("reads the lines as the log prints them, Beldis's boxes for each seat, and the tally in code order", () => {
    const log: CampaignLog = { ...emptyLog(2), treasures: ["t1"], allyLines: ["beldis", "turayn"], beldisUses: [1], encounterPool: { wolf: 2, growing: 1 } };
    expect(wilderlandView(log, 2)).toEqual({
      treasures: ["t1"],
      lines: [ALLY_LINE_FACTS.turayn.words, ALLY_LINE_FACTS.beldis.words],
      beldis: [
        { prefix: "Player 1: ", boxes: "\u25a0\u25a1\u25a1\u25a1", used: 1, speech: "Player 1: Beldis, 1 of 4 boxes marked" },
        { prefix: "Player 2: ", boxes: "\u25a1\u25a1\u25a1\u25a1", used: 0, speech: "Player 2: Beldis, 0 of 4 boxes marked" },
      ],
      encounter: [{ code: "growing", copies: 1 }, { code: "wolf", copies: 2 }],
    });
    expect(wilderlandView(emptyLog(1), 1).beldis).toEqual([{ prefix: "", boxes: "\u25a1\u25a1\u25a1\u25a1", used: 0, speech: "Beldis, 0 of 4 boxes marked" }]);
    expect(wilderlandView({ ...emptyLog(1), beldisUses: [2] }, 1).beldis[0]?.boxes).toBe("\u25a0\u25a0\u25a1\u25a1");
    // A screen reader hears the copies of an encounter card, not the multiplication sign.
    expect(encounterSpeech([{ code: "growing", copies: 1 }, { code: "wolf", copies: 2 }], (code) => (code === "wolf" ? "Gundabad Hunter" : "A Growing Threat"))).toBe("A Growing Threat. Gundabad Hunter, 2 copies");
    expect(copiesMark(1)).toBe("");
    expect(copiesMark(3)).toBe(" \u00d73");
  });

  it("names the four allies' lines as the Campaign Log sheet prints them (emce.boon-allies)", () => {
    expect(ALLY_LINES.map((line) => ALLY_LINE_FACTS[line].words)).toEqual([
      "Turayn has taken an oath of vigilance",
      "Melanwar has given you guidance on traversing Wilderland",
      "Isolde is on the hunt",
      "Beldis’s care has bolstered the heroes’ spirits",
    ]);
  });

  it("completes the campaign when the ninth scenario is won (the path has no next part)", () => {
    const campaign = { id: WILDERLAND_CAMPAIGN, name: "Ered Mithrin", scenarios: ["a", "b"], campaignCards: {}, bookletId: WILDERLAND_CAMPAIGN, saga: false, prelude: [], starterDecks: [] };
    const log = { ...emptyLog(1), completed: ["a", "b"] };
    expect(campaignPath(campaign, { a: "A", b: "B" }, log).every((node) => node.status === "completed")).toBe(true);
  });
});

describe("the Resolution screen's words", () => {
  const world = { cards, campaign: {}, scenario: {}, effects: [], sets: new Map() } as unknown as World;

  it("asks for the ally on a player, or the line, with no default", () => {
    const waiting = won(game(), [{ verb: "BoonAllyOrLogLine", ally: "turayn", line: "turayn" }]);
    const view = resolutionView(waiting, world);
    if (view.kind !== "choosing") throw new Error("expected a choice");
    expect(view.to).toBe("ally");
    expect(view.decline).toBeNull();
    expect(view.tiles.map((tile) => [tile.code, tile.name])).toEqual([["turayn", "Turayn"], [null, ALLY_LINE_FACTS.turayn.words]]);
  });

  function twoHanded(facts?: CampaignFacts): ScenarioState {
    let state: ScenarioState = { ...idleScenario(2), scenarioId: SCENARIO, ...(facts ? { campaignFacts: facts } : {}) };
    state = spawn(state, "frodo", { zone: "heroes", seat: 0 }).state;
    return spawn(state, "sam", { zone: "heroes", seat: 1 }).state;
  }

  it("names the ally for a player, not for the hero that names them, and lays the log line in a row of its own", () => {
    const resolution: ScenarioState["resolution"] = [{ verb: "BoonAllyOrLogLine", ally: "turayn", line: "turayn" }];
    const solo = resolutionView(won(game(), resolution), world);
    const two = resolutionView(won(twoHanded(), resolution), world);
    if (solo.kind !== "choosing" || two.kind !== "choosing") throw new Error("expected a choice");
    expect(solo.tiles.map((tile) => tile.label)).toEqual(["Turayn", ALLY_LINE_FACTS.turayn.words]);
    expect(two.tiles.map((tile) => tile.label)).toEqual(["Turayn for Player 1", "Turayn for Player 2", ALLY_LINE_FACTS.turayn.words]);
    expect(two.tiles.map((tile) => tile.wide === true)).toEqual([false, false, true]);
    const [ally, line] = [two.tiles[0], two.tiles[2]];
    if (!ally || !line) throw new Error("missing tiles");
    // Each choice says what is given up.
    // The line says what it buys at the later campaign cards that read it (12170, 12187 and 12195 print the Setups).
    expect(choiceSentence(two, line)).toBe(`“${ALLY_LINE_FACTS.turayn.words}” is marked in the campaign log. Turayn does not join the campaign pool. Later Setups remove from the encounter deck ${ALLY_LINE_FACTS.turayn.later}.`);
    expect(ALLY_LINE_FACTS.turayn.later).toBe("3 treacheries in The King's Quest, 3 non-unique locations in Fire in the Night and 3 non-unique enemies in The Fate of Wilderland");
    expect(choiceSentence(two, ally)).toMatch(/adds it to their deck for the rest of the campaign\. The log line is not recorded, so no card is removed from the encounter deck for it later\.$/);
    // The offer names who takes the ally, and in a table of several players whose choice it is.
    expect(promptSentence(solo)).toBe("Take Turayn, or the line for the log.");
    expect(promptSentence(two)).toBe("Choose which player takes Turayn, or the line for the log.");
    expect(solo.seatLabel).toBeNull();
    expect(two.seatLabel).toBe("Player 1 (first player) chooses");
  });

  it("calls the decline of a removal \"Remove nothing\", tells encounter cards from the pool's own with their copies, and a boon two seats hold by seat", () => {
    const facts: CampaignFacts = { ...baseFacts, encounterPool: { wolf: 2, growing: 1 }, pool: [{ code: "turayn", seat: 0 }, { code: "turayn", seat: 1 }] };
    const waiting = won(twoHanded(facts), [{ verb: "RemoveFromPool", choice: "eachPlayerNonBurden" }]);
    const view = resolutionView(waiting, world);
    if (view.kind !== "choosing") throw new Error("expected a choice");
    expect(view.decline?.label).toBe("Remove nothing");
    const byId = new Map(view.tiles.map((tile) => [tile.optionId, tile]));
    expect(byId.get("e:wolf")).toMatchObject({ label: "Gundabad Hunter", tag: "encounter card \u00b7 2 copies", copies: 2 });
    expect(byId.get("e:growing")).toMatchObject({ tag: "encounter card", copies: 1 });
    expect(byId.get("p:turayn@0")).toMatchObject({ label: "Turayn (Player 1)" });
    expect(byId.get("p:turayn@1")).toMatchObject({ label: "Turayn (Player 2)" });
    expect(choiceSentence(view, byId.get("e:wolf")!)).toBe("One copy of Gundabad Hunter leaves the campaign pool (1 stays).");
    expect(choiceSentence(view, byId.get("e:growing")!)).toBe("A Growing Threat leaves the campaign pool: it was the last copy.");
  });

  it("says what each seat that answered chose", () => {
    const facts: CampaignFacts = { ...baseFacts, encounterPool: { wolf: 2 } };
    const waiting = won(twoHanded(facts), [{ verb: "RemoveFromPool", choice: "eachPlayerNonBurden" }]);
    const first = reduce(waiting, { type: "ChooseResolution", optionId: "e:wolf" }, ctx);
    if (!first.ok) throw new Error(first.reason);
    const second = resolutionView(first.state, world);
    if (second.kind !== "choosing") throw new Error("expected a choice");
    expect(second.answered).toEqual([{ seat: 0, words: "Gundabad Hunter" }]);
    const declined = reduce(waiting, { type: "ChooseResolution", optionId: "skip" }, ctx);
    if (!declined.ok) throw new Error(declined.reason);
    const view = resolutionView(declined.state, world);
    expect(view.kind === "choosing" && view.answered).toEqual([{ seat: 0, words: "Nothing removed" }]);
  });

  it("states the pool's copies as the log will hold them, capped at what one collection holds", () => {
    const resolution: ScenarioState["resolution"] = [{ verb: "AddEncounterToPool", codes: ["wolf", "wolf"] }];
    const state = won(game({ ...baseFacts, encounterPool: { wolf: 1 } }), resolution);
    const capped = resolutionView(state, { ...world, copies: new Map([["wolf", 2]]) });
    const open = resolutionView(state, world);
    if (capped.kind !== "settled" || open.kind !== "settled") throw new Error("expected the settled view");
    expect(capped.poolAdded).toEqual(["wolf"]);
    expect(open.poolAdded).toEqual(["wolf", "wolf"]);
  });

  it("states what confirming records: treasures, lines and the pool's encounter cards", () => {
    const state = won(game({ ...baseFacts, encounterPool: { wolf: 1 } }), [{ verb: "AddEncounterToPool", codes: ["growing", "wolf"] }, { verb: "RemoveFromPool", codes: ["wolf"] }]);
    const view = resolutionView(state, world);
    if (view.kind !== "settled") throw new Error("expected the settled view");
    expect(view.poolAdded).toEqual(["growing"]);
    expect(view.poolRemoved).toEqual(["wolf"]);
    const sentence = settledSentence({ ...view, treasures: ["t1"], lines: ["isolde"] }, world, null);
    expect(sentence).toContain("The players discover Anvil of Gundabad.");
    expect(sentence).toContain("“Isolde is on the hunt” is marked in the campaign log.");
    expect(sentence).toContain("A Growing Threat joins the campaign pool as encounter cards.");
    expect(sentence).toContain("Gundabad Hunter leaves the campaign pool.");
  });
});
