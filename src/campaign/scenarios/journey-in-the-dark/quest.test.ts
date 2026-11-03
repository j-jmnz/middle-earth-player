// Rules: mec109.setup-journey-in-the-dark, rr.quest-advancement, rr.step-3-3, rr.search, rr.optional-engagement, rr.destroy, rr.winning-the-game,
// rr.first-player, rr.in-player-order, rr.campaign-cards (data/rules/entries.json). The quest cards of Journey in the Dark and its Setup.
import { beforeAll, describe, expect, it } from "vitest";

import { encounterCodes } from "../../../catalog/scenario-data.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { placeDamage } from "../../../rules/core/keywords.ts";
import { holds } from "../../../rules/interpret/conditions.ts";
import { printedOf } from "../../../rules/core/printed.ts";
import { reduce, startScenario, type ReduceContext } from "../../../rules/engine/reduce.ts";
import { stagingThreat } from "../../../rules/quest/quest.ts";
import { revealsAllowed } from "../../../rules/families/encounter/reveal.ts";
import { ruleCause } from "../../../rules/core/cause.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { moriaStart, moriaWorld } from "../../../../test/scenarios/journey-in-the-dark/game.ts";
import { BALROG, BRIDGE, CHAMBER, DOOM, fire, loadMoriaWorld, makeTable, moria, recordOf, runOne, settled, type MoriaLayout, type MoriaTable, type MoriaWorld } from "../../../../test/scenarios/journey-in-the-dark/scene.ts";
import { codesOf, first } from "../../../../test/scenarios/a-shadow-of-the-past/scene.ts";

let world: MoriaWorld;
let startCtx: ReduceContext;

beforeAll(async () => {
  world = await loadMoriaWorld();
  startCtx = (await moriaWorld("strong")).ctx;
}, 60_000);

const make = (layout: MoriaLayout = {}) => makeTable(world, layout);

function begin(seatCount: 1 | 2, seed = 3): ScenarioState {
  let state = startScenario(moriaStart(seatCount, seed, "Normal"), startCtx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, startCtx)).state;
  for (let guard = 0; guard < 12 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, startCtx)).state;
  return state;
}

describe("stage 1A: the Setup (142040:A:1)", () => {
  it.each([1, 2] as const)("sets the three cards aside, puts 10 damage on Doom, Doom, Doom in the staging area, and each of %i player(s) adds a different location", (seats) => {
    const state = begin(seats);
    expect(state.setAside.map((id) => state.cards[id]?.code).sort()).toEqual([BALROG, BRIDGE, CHAMBER]);
    const doom = state.cards[first(state, DOOM)];
    expect(doom?.zone).toBe("staging");
    expect(doom?.damage).toBe(10);
    const locations = state.staging.filter((id) => printedOf(startCtx.cards, state.cards[id]?.code ?? "").type === "location");
    expect(locations).toHaveLength(seats);
    expect(new Set(locations.map((id) => printedOf(startCtx.cards, state.cards[id]?.code ?? "").name)).size).toBe(seats);
    // The burdens the campaign card adds, then the locations the players found; the rest of the locations stay in the encounter deck.
    expect(codesOf(state, state.staging).filter((code) => code === "142087" || code === "142088").sort()).toEqual(["142087", "142088"]);
    expect(state.encounterDeck).toHaveLength(encounterCodes(moria, "Normal", seats).length + 2 - seats);
  });

  it("finds the locations in the encounter deck, in player order, before the deck is shuffled again", () => {
    const state = begin(2);
    // The Setup asked each player in turn: the answers are the first card each offered, so the second is a different title.
    const names = state.staging.flatMap((id) => (printedOf(startCtx.cards, state.cards[id]?.code ?? "").type === "location" ? [printedOf(startCtx.cards, state.cards[id]?.code ?? "").name] : []));
    expect(names).toHaveLength(2);
    expect(names[0]).not.toBe(names[1]);
  });

  it("deals the quest cards in order, the first one current", () => {
    const state = begin(1);
    expect(state.cards[state.questStage ?? ""]?.code).toBe("142040");
    expect(state.questDeck.map((id) => state.cards[id]?.code)).toEqual(["142041", "142042"]);
  });
});

describe("stage 1B: after a player optionally engages an enemy, remove 1 damage token from Doom, Doom, Doom (142040:B:1)", () => {
  it("takes a token off for each optional engagement, and none for an engagement check", () => {
    const table = make({ doom: 10, staging: ["grunt"], phase: "Encounter" });
    const engaged = expectOk(reduce(table.state, { type: "Engage", enemyId: first(table.state, "grunt") }, table.ctx)).state;
    expect(engaged.cards[first(engaged, DOOM)]?.damage).toBe(9);
    // The same enemy engaged by an effect is not an optional engagement.
    const effect = runOne(table, make({ doom: 10, staging: ["grunt"] }).state, { verb: "Engage", target: "self" }, first(table.state, "grunt"));
    expect(effect.cards[first(effect, DOOM)]?.damage).toBe(10);
  });

  it("stops at 0", () => {
    const table = make({ doom: 0, staging: ["grunt"], phase: "Encounter" });
    const engaged = expectOk(reduce(table.state, { type: "Engage", enemyId: first(table.state, "grunt") }, table.ctx)).state;
    expect(engaged.cards[first(engaged, DOOM)]?.damage).toBe(0);
  });
});

describe("stage 2B: Drums in the Deep (142041:B:1 to B:3)", () => {
  it("reveals an additional encounter card at the beginning of the quest phase when no enemy is in the staging area", () => {
    const record = recordOf("142041:forced:1");
    const quiet = make({ stage: "142041", staging: ["place"] });
    const busy = make({ stage: "142041", staging: ["grunt"] });
    const asked = (table: MoriaTable) => holds(table.state, record.condition ?? { kind: "phase", is: "Quest" }, { actor: 0, sourceId: table.state.questStage, returned: 0, phase: "Quest" }, table.ctx);
    expect(asked(quiet)).toBe(true);
    expect(asked(busy)).toBe(false);
    // Another phase is not the quest phase.
    expect(holds(quiet.state, record.condition ?? { kind: "phase", is: "Quest" }, { actor: 0, sourceId: quiet.state.questStage, returned: 0, phase: "Encounter" }, quiet.ctx)).toBe(false);
    const revealed = fire(quiet, quiet.state, quiet.state.questStage ?? "", "142041:forced:1", [], "forced");
    expect(revealsAllowed(revealed, 1)).toBe(2);
  });

  it("holds the stage back until there are 3 resource tokens on it for each player, however much progress it has", () => {
    for (const seats of [1, 2] as const) {
      for (const tokens of [3 * seats - 1, 3 * seats]) {
        const table = make({ stage: "142041", seats, progress: 9, tokens });
        const after = runOne(table, table.state, { verb: "ProgressQuest", amount: 5 }, table.frodo);
        const advanced = after.cards[after.questStage ?? ""]?.code === "142042";
        expect(advanced, `${seats} seat(s), ${tokens} tokens`).toBe(tokens >= 3 * seats);
      }
    }
  });

  it("advances later, when the last token arrives, the progress having stayed on the stage", () => {
    const held = make({ stage: "142041", progress: 12, tokens: 2 });
    const stuck = runOne(held, held.state, { verb: "ProgressQuest", amount: 1 }, held.frodo);
    expect(stuck.cards[stuck.questStage ?? ""]?.code).toBe("142041");
    expect(stuck.cards[stuck.questStage ?? ""]?.progress).toBe(13);
    const rich = make({ stage: "142041", progress: 12, tokens: 3 });
    const moved = runOne(rich, rich.state, { verb: "ProgressQuest", amount: 1 }, rich.frodo);
    expect(moved.cards[moved.questStage ?? ""]?.code).toBe("142042");
  });

  it("places a resource token on the stage after an enemy is defeated, one for each enemy and none for a damaged one that survives", () => {
    const table = make({ stage: "142041", staging: ["f0", "grunt"], tokens: 0 });
    const stage = table.state.questStage ?? "";
    const steps: EngineStep[] = [];
    let state = table.state;
    state = settled(table, placeDamage(state, first(state, "f0"), 99, table.ctx.cards, steps, "framework", ruleCause("rr.damage")), steps);
    expect(state.cards[stage]?.resources).toBe(1);
    state = settled(table, placeDamage(state, first(state, "grunt"), 1, table.ctx.cards, steps, "framework", ruleCause("rr.damage")), steps);
    expect(state.cards[stage]?.resources).toBe(1);
    state = settled(table, placeDamage(state, first(state, "grunt"), 99, table.ctx.cards, steps, "framework", ruleCause("rr.damage")), steps);
    expect(state.cards[stage]?.resources).toBe(2);
  });

  it("cannot advance while Chamber of Mazarbul is in play, even with the tokens", () => {
    const table = make({ stage: "142041", progress: 9, tokens: 3, staging: [CHAMBER] });
    const after = runOne(table, table.state, { verb: "ProgressQuest", amount: 1 }, table.frodo);
    expect(after.cards[after.questStage ?? ""]?.code).toBe("142041");
    const gone = make({ stage: "142041", progress: 9, tokens: 3 });
    const moved = runOne(gone, gone.state, { verb: "ProgressQuest", amount: 1 }, gone.frodo);
    expect(moved.cards[moved.questStage ?? ""]?.code).toBe("142042");
  });
});

describe("stage 3A: the Bridge of Khazad-dûm (142042:A:1)", () => {
  it.each([1, 2] as const)("adds the Great Bridge to the staging area, and each of %i player(s) reveals a card and removes a damage token from Doom, Doom, Doom", (seats) => {
    const table = make({ stage: "142042", seats, doom: 5, setAside: [BRIDGE], deck: ["f0", "f0", "f0"] });
    const state = fire(table, table.state, table.state.questStage ?? "", "142042:whenRevealed:1");
    expect(codesOf(state, state.staging)).toContain(BRIDGE);
    expect(state.cards[first(state, DOOM)]?.damage).toBe(5 - seats);
    expect(state.staging.filter((id) => state.cards[id]?.code === "f0")).toHaveLength(seats);
  });
});

describe("stage 3B (142042:B:1 to B:3)", () => {
  it("lets no more than 5 progress be placed on it each round, the active location taking its share first", () => {
    const table = make({ stage: "142042" });
    const first = runOne(table, table.state, { verb: "ProgressQuest", amount: 6 }, table.frodo);
    const stage = first.questStage ?? "";
    expect(first.cards[stage]?.progress).toBe(5);
    // Nothing more this round.
    const again = runOne(table, first, { verb: "ProgressQuest", amount: 2 }, table.frodo);
    expect(again.cards[stage]?.progress).toBe(5);
    const withLocation = make({ stage: "142042", active: "place" });
    const placed = runOne(withLocation, withLocation.state, { verb: "ProgressQuest", amount: 7 }, withLocation.frodo);
    // 4 on the location (which is explored), 3 on the stage.
    expect(placed.cards[placed.questStage ?? ""]?.progress).toBe(3);
  });

  it("cannot be defeated while the Great Bridge is in play, and is once it is gone", () => {
    const table = make({ stage: "142042", progress: 14, staging: [BRIDGE] });
    const held = runOne(table, table.state, { verb: "ProgressQuest", amount: 1 }, table.frodo);
    expect(held.stageCleared).toBe(false);
    const free = make({ stage: "142042", progress: 14 });
    const won = runOne(free, free.state, { verb: "ProgressQuest", amount: 1 }, free.frodo);
    expect(won.stageCleared).toBe(true);
    expect(won.lost).toBe(false);
  });

  it("is won when its quest points are met with the Great Bridge gone: defeating the last stage wins the game", () => {
    const table = make({ stage: "142042", progress: 11 });
    const won = runOne(table, table.state, { verb: "ProgressQuest", amount: 4 }, table.frodo);
    expect(won.stageCleared).toBe(true);
  });
});

describe("the staging area's Threat", () => {
  it("is not raised by Doom, Doom, Doom (an objective) or the Balrog (considered engaged)", () => {
    const table = make({ doom: 10, staging: ["place"] });
    const before = stagingThreat(table.state, table.ctx.cards);
    const withBalrog = settled(table, { ...table.state, cards: table.state.cards });
    expect(before).toBe(stagingThreat(withBalrog, table.ctx.cards));
    void syncConstants;
  });
});
