import { describe, expect, it } from "vitest";

import { DEFAULT_SCENARIOS, hasReaderGames, readerGames } from "./reader-play/games.ts";
import { ALLOWED } from "./reader-play/allowed.ts";
import { playReaderGame } from "./reader-play/run.ts";

const only = process.env.READER_PLAY_SCENARIO;
const scenarios = only ? [only] : DEFAULT_SCENARIOS;

describe.each(scenarios)("a screen reader can play %s", (id) => {
  it("reaches every intent the engine offers through a labelled element", async () => {
    expect(hasReaderGames(id), `${id} has no game to play (test/harness/golden-registry.ts)`).toBe(true);
    for (const game of await readerGames(id)) {
      const run = playReaderGame(game, ALLOWED);
      expect(run.failure, run.failure ?? "").toBeNull();
      expect(run.states).toBeGreaterThanOrEqual(20);
    }
  }, 120_000);
});
