import { describe, expect, it } from "vitest";

import { playStarter, starterLoadout, starterWorld, STARTER_SEEDS } from "../../../test/scenarios/a-shadow-of-the-past/game.ts";
import { campaign } from "../../../test/scenarios/a-shadow-of-the-past/scene.ts";

import { checksOf } from "../../../test/harness/golden-suite.ts";
import { endOf, goldenText } from "../../../scripts/game/golden-file.ts";

import { validateLoadout } from "../loadout.ts";

// Permanent goldens: a whole game of A Shadow of the Past with each seeded starter deck (test/scenarios/a-shadow-of-the-past/game.ts), played by
// the auto-player with card play on. Each file stores the intents, the digest of the table after each intent and a hash of the final state. It pins the path from data/ through the starter effect records and the reducer, so a
// change to a record or to the engine that moves a game shows up as a diff here. Update the snapshot only when the change
// is meant.
describe("golden: A Shadow of the Past with a starter deck", () => {
  for (const deck of campaign.starterDecks) {
    it(`${deck.name}: the same intents play to the same state on fixed seeds`, async () => {
      const { cards, ctx } = await starterWorld(deck.id);
      expect(validateLoadout([starterLoadout(deck.id)], cards, true)).toEqual([]);
      const out: Record<string, unknown>[] = [];
      for (const seed of STARTER_SEEDS) {
        const { kept, run } = playStarter(deck.id, seed, ctx);
        expect(run.state.failure).toBeNull();
        // A lost game can end inside an effect.
        if (!run.state.lost) expect(run.state.stack).toEqual([]);
        // The row is the one every golden.json holds (scripts/game/golden-file.ts): no test reads a starter game's final state, so it stores the hash.
        out.push({ seed, intents: run.intents, checks: checksOf({ kept, intents: run.intents }, ctx), end: endOf(run.state) });
      }
      const file = new URL(`./golden/starter-${deck.id}.json`, import.meta.url).pathname;
      await expect(goldenText(out)).toMatchFileSnapshot(file);
    });
  }
});
