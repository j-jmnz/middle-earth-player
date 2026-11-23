// Rules: dcce.gaining-xp, dcce.campaign-mode, rr.victory (data/rules/entries.json); ledger lines 11215:B:4 to 11215:B:9.
// The Resolution of The City of Corsairs' campaign card (11215), the last of the Dream-chaser campaign: the XP lines no golden reaches yet, each read from its record on the table of the scenario, and the win that ends the campaign.
import { beforeAll, describe, expect, it } from "vitest";

import { sideInstructions } from "../../../catalog/scenario-data.ts";
import { EFFECTS } from "../../../effects/index.ts";
import type { ScenarioState } from "../../../rules/engine/reduce.ts";
import { openResolution, resolutionResult } from "../../../rules/setup/resolution.ts";
import { CODES, corsairsTable, loadCorsairsWorld, type CorsairsLayout, type CorsairsWorld, campaign } from "../../../../test/scenarios/the-city-of-corsairs/scene.ts";
import { loadPrinted } from "../../../../test/harness/catalog.ts";
import { withoutLine } from "../../../../test/harness/card-spec.ts";
import type { Effect } from "../../../catalog/boundary.ts";

import { applyResolution, emptyLog } from "../../log.ts";
import { NO_COPY_LIMITS } from "../../wilderland.ts";
import { campaignPath, nextStep } from "../../path.ts";

let world: CorsairsWorld;
const OMINOUS_FATE = "11176";
const MONUMENT = "110129";
beforeAll(async () => {
  world = await loadCorsairsWorld();
  for (const [code, card] of await loadPrinted([OMINOUS_FATE])) world.cards.set(code, card);
}, 120_000);

const LINES = sideInstructions(EFFECTS, CODES.campaignCard, "B", "resolution");

// The scenario won with `layout` on the table: the state the Resolution opens on.
function won(layout: CorsairsLayout): { state: ScenarioState; made: ReturnType<typeof corsairsTable> } {
  const made = corsairsTable(world, { stage: "12150", ...layout });
  return { made, state: openResolution({ ...made.state, scenarioId: "the-city-of-corsairs", window: null, stageCleared: true, resolution: LINES }, made.ctx) };
}
const xp = (layout: CorsairsLayout): number => resolutionResult(won(layout).state)?.xp ?? 0;

describe("11215:B Gain the following", () => {
  it("B:6: 1 XP for each surviving player", () => {
    expect(xp({ seats: 1 })).toBe(1);
    expect(xp({ seats: 2 })).toBe(2);
  });

  it("B:7: 1 XP for each Corsair Warship, Shattered Monument, Crowley and Stormcaller in the victory display, and none for another card", () => {
    const base = xp({});
    expect(xp({ victory: [CODES.corsairWarship] }) - base).toBe(1);
    expect(xp({ victory: [CODES.corsairWarship, CODES.corsairWarship, CODES.corsairWarship] }) - base).toBe(3);
    expect(xp({ victory: [MONUMENT] }) - base).toBe(1);
    expect(xp({ victory: [CODES.crowley] }) - base).toBe(1);
    expect(xp({ victory: [CODES.stormcaller] }) - base).toBe(1);
    expect(xp({ victory: [CODES.corsairWarship, MONUMENT, CODES.crowley, CODES.stormcaller] }) - base).toBe(4);
    expect(xp({ victory: [CODES.umbarRaider, CODES.lightCruiser] }) - base).toBe(0);
  });

  it("B:8: 2 XP if Thunderstruck is in the victory display; B:9: -1 XP for Ominous Fate", () => {
    const base = xp({});
    expect(xp({ victory: [CODES.thunderstruck] }) - base).toBe(2);
    expect(xp({ victory: [OMINOUS_FATE] }) - base).toBe(-1);
  });
});

describe("11215:B:8 Thunderstruck", () => {
  // "2 XP if Thunderstruck is in the victory display." Counted on the Resolution's own lines, and on the lines without its record.
  const xpWith = (layout: CorsairsLayout, effects: readonly Effect[]): number => {
    const made = corsairsTable(world, { stage: "12150", ...layout });
    const state = openResolution({ ...made.state, scenarioId: "the-city-of-corsairs", window: null, stageCleared: true, resolution: sideInstructions(effects, CODES.campaignCard, "B", "resolution") }, made.ctx);
    return resolutionResult(state)?.xp ?? 0;
  };

  it("11215:B:8 gives 2 XP for Thunderstruck in the victory display, none for it in the encounter discard pile, and none without its record", () => {
    const base = xpWith({}, EFFECTS);
    expect(xpWith({ victory: [CODES.thunderstruck] }, EFFECTS) - base).toBe(2);
    expect(xpWith({ discard: [CODES.thunderstruck] }, EFFECTS) - base).toBe(0);
    expect(xpWith({ victory: [CODES.thunderstruck] }, withoutLine(EFFECTS, "11215:B:8")) - base).toBe(0);
  });
});

describe("11215:B:4 Resolution: The players win the campaign!", () => {
  it("is the last scenario of the campaign, so winning it leaves no scenario unwon and the path is finished", () => {
    expect(campaign.scenarios.at(-1)).toBe("the-city-of-corsairs");
    const { state, made } = won({});
    const before = { ...emptyLog(1), completed: campaign.scenarios.slice(0, -1) };
    expect(nextStep(campaignPath(campaign, {}, before), null)).toMatchObject({ kind: expect.stringMatching(/begin|soon/) });
    const after = applyResolution(before, "the-city-of-corsairs", state, made.ctx.cards, NO_COPY_LIMITS);
    expect(after.completed).toEqual([...campaign.scenarios]);
    expect(nextStep(campaignPath(campaign, {}, after), null)).toEqual({ kind: "finished" });
  });
});
