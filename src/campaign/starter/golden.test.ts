import { describe, expect, it } from "vitest";

import { playStarter, starterLoadout, starterWorld, STARTER_SEEDS } from "../../../test/scenarios/a-shadow-of-the-past/game.ts";
import { campaign } from "../../../test/scenarios/a-shadow-of-the-past/scene.ts";

import { validateLoadout } from "../loadout.ts";

// Permanent goldens: a whole game of A Shadow of the Past with each seeded starter deck (test/scenarios/a-shadow-of-the-past/game.ts), played by
// the auto-player with card play on. It pins the path from data/ through the starter effect records and the reducer, so a
// change to a record or to the engine that moves a game shows up as a diff here. Update the snapshot only when the change
// is meant.
describe("golden: A Shadow of the Past with a starter deck", () => {
  for (const deck of campaign.starterDecks) {
    it(`${deck.name}: the same intents play to the same state on fixed seeds`, async () => {
      const { cards, ctx } = await starterWorld(deck.id);
      expect(validateLoadout([starterLoadout(deck.id)], cards, true)).toEqual([]);
      const out: unknown[] = [];
      for (const seed of STARTER_SEEDS) {
        const { run } = playStarter(deck.id, seed, ctx);
        expect(run.state.failure).toBeNull();
        // A lost game can end inside an effect.
        if (!run.state.lost) expect(run.state.stack).toEqual([]);
        out.push({ seed, intents: run.intents, state: run.state });
      }
      const file = new URL(`./golden/starter-${deck.id}.json`, import.meta.url).pathname;
      await expect(JSON.stringify(out)).toMatchFileSnapshot(file);
    });
  }
});
