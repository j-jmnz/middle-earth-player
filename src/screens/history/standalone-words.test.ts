import { describe, expect, it } from "vitest";

import type { StandaloneGame } from "../../campaign/standalone";
import { gameCaption, outcomeLines, statusWord } from "./standalone-words";

const game: StandaloneGame = {
  id: "game-a",
  campaignId: "fellowship-of-the-ring",
  scenarioId: "a-shadow-of-the-past",
  seatCount: 1,
  loadout: { scenarioId: "a-shadow-of-the-past", difficulty: "Easy", seats: [], ringBearer: null },
  active: { engineVersion: 1, dataHash: 1, world: null, seed: 1, intents: [] },
  result: null,
};

describe("standalone list words", () => {
  it("says how each game stands", () => {
    expect(gameCaption(game)).toBe("True solo · Easy · In progress");
    expect(statusWord({ ...game, active: null, result: { outcome: "won", score: { rounds: 5, victoryPoints: 3, score: 88 } } })).toBe("Won · score 88");
    expect(statusWord({ ...game, active: null, result: { outcome: "lost", reason: null, rounds: 2 } })).toBe("Lost");
    expect(gameCaption({ ...game, needsChoice: true })).toBe("True solo · Easy · Needs a choice");
    expect(gameCaption({ ...game, seatCount: 2, active: null, loadout: null })).toBe("Two-handed · Dropped");
  });

  it("words the outcome: the score and its parts on a win, the reason on a loss", () => {
    expect(outcomeLines({ outcome: "won", score: { rounds: 1, victoryPoints: 0, score: 40 } })).toEqual(["Score 40. Lower is better.", "1 completed round · 0 victory points"]);
    expect(outcomeLines({ outcome: "lost", reason: "The One Ring left play", rounds: 3 })).toEqual(["The One Ring left play.", "3 rounds completed."]);
    // The final game, when at hand, says why each seat went out after the engine's reason.
    expect(outcomeLines({ outcome: "lost", reason: "No seats remain", rounds: 4 }, "No seats remain. Player 1's threat reached 50.")).toEqual(["Every player is eliminated. Player 1's threat reached 50.", "4 rounds completed."]);
    expect(outcomeLines({ outcome: "lost", reason: "No seats remain", rounds: 2 })).toEqual(["Every player is eliminated.", "2 rounds completed."]);
  });
});
