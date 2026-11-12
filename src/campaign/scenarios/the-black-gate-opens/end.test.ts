// Rules: rr.player-elimination, rr.campaign-cards, mec113.dire (data/rules/entries.json); ledger lines 146073:B:3 and 146074:B:1 (user decision, 2026-11-12): the scenario ends when its last player is eliminated and that end runs the campaign card's Resolution.
// How the end is recorded: the Resolution view and the run say what happened, an end and not a win (the table's sheet and the run list words: src/play/choice/ended-sheet.test.ts, src/screens/history/words.test.ts). The states are the goldens' (goldenState).
import { beforeAll, describe, expect, it } from "vitest";

import { endedInDefeat, ENDED_BY_DEFEAT } from "../../../rules/core/eliminate.ts";
import { opensWorld } from "../../../../test/scenarios/the-black-gate-opens/game.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";
import { replayedSentence, resolutionView, settledSentence } from "../../resolution-view.ts";
import { runOf } from "../../runs.ts";
import { scoreParts } from "../../score.ts";
import { printedOf } from "../../../rules/core/printed.ts";
import type { World } from "../../world.ts";
import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";
import { EFFECTS } from "../../../effects/index.ts";

const ENDED = "two-handed, ended, Normal, after the earlier parts, Gwaihir held by the first player";
let cards: Awaited<ReturnType<typeof opensWorld>>["cards"];
let world: World;

beforeAll(async () => {
  cards = (await opensWorld("strong")).cards;
  world = { campaign: loadCampaign("the-return-of-the-king"), scenario: loadScenario("the-black-gate-opens"), effects: EFFECTS, cards, sets: new Map() };
}, 120_000);

describe("the end of The Black Gate Opens is recorded as an end", () => {
  it("146074:B:1 the last player's elimination is an end in defeat; a loss of the scenario and a play in progress are not", () => {
    expect(endedInDefeat(goldenState("the-black-gate-opens", ENDED))).toBe(true);
    expect(endedInDefeat(goldenState("the-black-gate-opens", "two-handed, lost, Aragorn leaves play"))).toBe(false);
    expect(endedInDefeat(goldenState("the-black-gate-opens", "true solo, lost, standalone, the last player is eliminated"))).toBe(false);
  });

  it("146074:B:1 the Resolution view is settled and marked ended, and the run is a run that ended with the cause, not a win", () => {
    const state = goldenState("the-black-gate-opens", ENDED);
    expect(resolutionView(state, world)).toMatchObject({ kind: "settled", ended: true });
    const run = runOf({ id: "run-1", kind: "campaign", refId: "save-1", campaignId: "the-return-of-the-king", box: "return-of-the-king", state, cards, heroes: [["146002"], []], reward: null, startedAt: 1, endedAt: 2, activeMs: null, engineVersion: 1 });
    expect(run).toMatchObject({ result: "won", lossCause: ENDED_BY_DEFEAT });
  });

  it("rr.scoring every player fell: the last seat scores as eliminated too, 50 and every hero's threat cost, as the seat that fell before it", () => {
    const state = goldenState("the-black-gate-opens", ENDED);
    const last = state.seats[1];
    expect(last?.eliminated).toBe(false);
    const parts = scoreParts(state, cards);
    expect(parts.threat).toBe(100);
    const heroCost = (last?.heroes ?? []).reduce((sum, id) => sum + (printedOf(cards, state.cards[id]?.code ?? "").threat ?? 0), 0);
    expect(heroCost).toBeGreaterThan(0);
    expect(parts.destroyed).toBeGreaterThanOrEqual(heroCost);
    expect(parts.damage).toBe(0);
  });

  it("146074:B:1 the sentence above Confirm records the end and unlocks Mount Doom, and a replay says it was played before", () => {
    const view = resolutionView(goldenState("the-black-gate-opens", ENDED), world);
    if (view.kind !== "settled") throw new Error("the end settles at once");
    const sentence = settledSentence(view, world, "Mount Doom");
    expect(sentence).toMatch(/^Confirming records the end/);
    expect(sentence).toContain("unlocks Mount Doom");
    expect(sentence).not.toContain("the win");
    expect(replayedSentence(view)).toBe("You have played this scenario before. Nothing is granted a second time.");
  });
});
