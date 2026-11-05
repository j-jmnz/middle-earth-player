// Rules: emce.treasure, emce.guarded-x, emce.haldan, rr.victory, rr.quest-advancement, emce.campaign-pool-encounter (data/rules/entries.json); ledger lines 12168:A:2, 12168:B:3, 18028:A:2, 18029:A:3, 18071:A:1.
// The verbs of Lost in Mirkwood on fixture cards: the stage a letter names, Haldan at Setup, the treasure guarded by a searched-for card and claimed once it is free, the cards the Resolution discards into the pool, and the Objective-Location Searching for a Way Out puts into play.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { cardMap, hero, idleScenario } from "../../core/test-fixture.ts";
import { definePrinted } from "../../core/printed.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { settle } from "../../engine/machine.ts";
import { reduce } from "../../engine/reduce.ts";
import { moveCard, spawn } from "../../core/zones.ts";
import type { ScenarioState } from "../../core/state.ts";
import { guardWith } from "../objectives/guard.ts";
import { discardToPoolFromSets, putObjectiveLocation } from "./mirkwood.ts";
import { run } from "./index.ts";
import { codesOf } from "./fixture.ts";

const cards = cardMap([
  hero("frodo", "lore"),
  definePrinted({ code: "s1", name: "One", type: "quest" }),
  definePrinted({ code: "s2a", name: "Two A", type: "quest" }),
  definePrinted({ code: "s2c", name: "Two C", type: "quest" }),
  definePrinted({ code: "s3a", name: "Three A", type: "quest" }),
  definePrinted({ code: "haldan", name: "Haldan", type: "objective" }),
  definePrinted({ code: "hall", name: "Twilight Hall", type: "location", threat: 2, questPoints: 3 }),
  definePrinted({ code: "t1", name: "Treasure One", type: "treasure", campaignKind: "treasure" }),
  definePrinted({ code: "t2", name: "Treasure Two", type: "treasure", campaignKind: "treasure" }),
  definePrinted({ code: "spider", name: "Spider", type: "enemy", threat: 1, engagementCost: 10, attack: 1, defense: 1, health: 2, encounterSet: "Spiders of Mirkwood" }),
  definePrinted({ code: "orc", name: "Orc", type: "enemy", threat: 1, engagementCost: 10, attack: 1, defense: 1, health: 2, encounterSet: "Dol Guldur Orcs" }),
  definePrinted({ code: "bat", name: "Bat", type: "enemy", threat: 1, engagementCost: 10, attack: 1, defense: 1, health: 2, encounterSet: "Dark Woods" }),
  definePrinted({ code: "path", name: "Path", type: "objective", traits: ["Forest"], questPoints: 4, victory: 4, objectiveLocation: true }),
  definePrinted({ code: "camp", name: "Campaign", type: "campaign" }),
  definePrinted({ code: "lost", name: "Searching for a Way Out", type: "objective" }),
]);
const marker: Effect = { id: "lost:forced:1", cardCode: "lost", lines: ["lost:A:2"], timing: "forced", trigger: "progressReplaced", instructions: [{ verb: "PutObjectiveLocationAfterDiscard" }] };
const treasureRecord: Effect = { id: "camp:campaignSetup:1", cardCode: "camp", lines: ["camp:A:2"], timing: "campaignSetup", instructions: [{ verb: "SearchGuardForTreasure", code: "hall" }] };
const ctx = (effects: readonly Effect[] = []): ReduceContext => ({ effects, cards });
const LEVELS = [["s1"], ["s2a", "s2c"], ["s3a"]];

function base(): ScenarioState {
  let state: ScenarioState = { ...idleScenario(1), seed: 3, firstPlayer: 0 };
  state = spawn(state, "frodo", { zone: "heroes", seat: 0 }).state;
  return state;
}
const focus = { seat: 0, sourceId: null };

describe("AdvanceToLetterStage (18029:A:3)", () => {
  function atStageOne(): ScenarioState {
    let state = base();
    state = spawn(state, "s1", { zone: "questStage" }, "B").state;
    for (const code of ["s2a", "s2c", "s3a"]) state = spawn(state, code, { zone: "questDeck" }, "A").state;
    return state;
  }
  const advance = (state: ScenarioState, letter: "A" | "C"): ScenarioState => run(state, { verb: "AdvanceToLetterStage", letter, levels: LEVELS }, focus, ctx(), []) ?? state;
  const stageOf = (state: ScenarioState): string | undefined => (state.questStage ? state.cards[state.questStage]?.code : undefined);

  it("advances to the stage one number up with the letter: A the first of its level, C the second", () => {
    expect(stageOf(advance(atStageOne(), "A"))).toBe("s2a");
    expect(stageOf(advance(atStageOne(), "C"))).toBe("s2c");
  });

  it("does nothing when the next level has no stage with that letter, or there is no next level", () => {
    const atTwo = advance(atStageOne(), "A");
    expect(stageOf(advance(atTwo, "C"))).toBe("s2a");
    const atThree = advance(atTwo, "A");
    expect(stageOf(atThree)).toBe("s3a");
    expect(stageOf(advance(atThree, "A"))).toBe("s3a");
  });
});

describe("TakeControlOfSetAside (18071:A:1)", () => {
  it("brings the set-aside card into the first player's play area, faceup and ready", () => {
    const aside = spawn(base(), "haldan", { zone: "setAside" }, "down");
    const next = run(aside.state, { verb: "TakeControlOfSetAside", code: "haldan" }, focus, ctx(), []) ?? aside.state;
    expect(next.cards[aside.id]).toMatchObject({ zone: "play", controller: 0, face: "up", exhausted: false });
  });

  it("does nothing with no such card set aside", () => {
    const state = base();
    expect(run(state, { verb: "TakeControlOfSetAside", code: "haldan" }, focus, ctx(), [])).toBe(state);
  });
});

describe("SearchGuardForTreasure (12168:A:2) and the claim of the freed treasure (emce.treasure)", () => {
  function searched(): ScenarioState {
    const deck = spawn(base(), "hall", { zone: "encounterDeck" }, "down");
    const camp = spawn(deck.state, "camp", { zone: "campaign" }).state;
    return pushEffectFrame(camp, { frame: "setup", sourceId: deck.id, actor: 0, peril: false, effectId: treasureRecord.id, instructions: [{ verb: "SearchGuardForTreasure", code: "hall" }], cancel: null, blockCancel: null }, []);
  }

  it("asks the first player whether to search; declining changes nothing", () => {
    const waiting = settle(searched(), ctx([treasureRecord]), []);
    expect(waiting.window).toMatchObject({ kind: "choose", seat: 0 });
    const declined = reduce(waiting, { type: "Choose", optionId: "decline" }, ctx([treasureRecord]));
    expect(declined.ok).toBe(true);
    if (declined.ok) expect(declined.state.staging).toEqual([]);
  });

  it("searching adds the copy to the staging area and a drawn treasure is guarded by it; the treasure is claimed once the guard leaves play", () => {
    const c = ctx([treasureRecord]);
    const waiting = settle(searched(), c, []);
    const searchedState = reduce(waiting, { type: "Choose", optionId: "search" }, c);
    expect(searchedState.ok).toBe(true);
    if (!searchedState.ok) return;
    let state = searchedState.state;
    if (state.window?.kind === "choose") {
      const picked = reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, c);
      if (picked.ok) state = picked.state;
    }
    const treasure = Object.values(state.cards).find((card) => card.code.startsWith("t"));
    const hall = Object.values(state.cards).find((card) => card.code === "hall");
    expect(codesOf(state, state.staging).sort()).toEqual(["hall", treasure?.code].sort());
    expect(hall).toMatchObject({ host: treasure?.id, guard: true });
    // Its guard is discarded: the treasure is free of encounters and the first player attaches it to a character.
    const freed = settle(moveCard(state, hall?.id ?? "", { zone: "encounterDiscard" }), c, []);
    const claimed = freed.cards[treasure?.id ?? ""];
    // The treasure types as a card with no Attach to line here, so the pick of a host is asked or resolved: it is no longer in the staging area under a guard.
    expect(claimed?.zone).not.toBe("staging");
    expect(freed.staging).not.toContain(treasure?.id);
  });
});

describe("DiscardToPoolFromSets (12168:B:3)", () => {
  it("discards from the top of the deck until X cards of the sets are discarded and names them", () => {
    let state = base();
    for (const code of ["bat", "spider", "bat", "orc", "spider"]) state = spawn(state, code, { zone: "encounterDeck" }, "down").state;
    const result = discardToPoolFromSets(state, ["Spiders of Mirkwood", "Dol Guldur Orcs"], 2, ctx());
    expect(result.codes).toEqual(["spider", "orc"]);
    expect(codesOf(result.state, result.state.encounterDiscard)).toEqual(["bat", "spider", "bat", "orc"]);
    expect(codesOf(result.state, result.state.encounterDeck)).toEqual(["spider"]);
  });

  it("stops with the deck empty", () => {
    let state = base();
    for (const code of ["bat", "spider"]) state = spawn(state, code, { zone: "encounterDeck" }, "down").state;
    expect(discardToPoolFromSets(state, ["Dol Guldur Orcs"], 3, ctx()).codes).toEqual([]);
  });
});

describe("Searching for a Way Out puts the topmost Objective-Location in the discard pile into play (18028:A:2)", () => {
  it("moves it to the staging area", () => {
    let state = spawn(base(), "lost", { zone: "staging" }).state;
    const first = spawn(state, "path", { zone: "encounterDiscard" });
    const second = spawn(first.state, "path", { zone: "encounterDiscard" });
    state = second.state;
    const next = putObjectiveLocation(state, ctx([marker]), []);
    expect(next.cards[second.id]?.zone).toBe("staging");
    expect(next.cards[first.id]?.zone).toBe("encounterDiscard");
  });

  it("does nothing without the card in play, or with no Objective-Location in the discard pile", () => {
    const state = spawn(base(), "path", { zone: "encounterDiscard" }).state;
    expect(putObjectiveLocation(state, ctx([marker]), [])).toBe(state);
    const lost = spawn(base(), "lost", { zone: "staging" }).state;
    expect(putObjectiveLocation(lost, ctx([marker]), [])).toBe(lost);
  });
});

describe("an Objective-Location is a location (rr.victory)", () => {
  it("is guarded like an objective", () => {
    const spawned = spawn(base(), "path", { zone: "staging" });
    const guard = spawn(spawned.state, "spider", { zone: "staging" });
    const guarded = guardWith(guard.state, guard.id, spawned.id);
    expect(guarded.cards[guard.id]).toMatchObject({ host: spawned.id, guard: true });
  });
});
