// The fixtures of Passage Through Mirkwood (Mirkwood Paths part 1), written into src/campaign/fixtures/passage-through-mirkwood.json
// by scripts/e2e/fixtures.ts: two real games of saved decklists (The One Deck and the Elves of Lórien lists of data/decks/test-decks.json and data/decks/prebuilt.json),
// two-handed, Easy, from an empty Mirkwood Paths log, played by the auto-player, every intent one the reducer listed.
// `mirkwood-won`: the first seed that wins, parked on the win (the Resolution asks nothing, so the table shows Victory and the
// Resolution screen offers Confirm). `mirkwood-lost`: the first seed that loses when Mendor leaves play (01129:A:3), parked on the loss.
import type { StoredLoadout } from "../../src/campaign/save.ts";
import { type PlayerIntent, type ScenarioState } from "../../src/rules/engine/reduce.ts";

import { nextIntent } from "../../test/harness/auto-player.ts";
import { createLog } from "../log.ts";
import { firstSeed } from "./seed-kit.ts";

const say = createLog("e2e-mirkwood");

export type MirkwoodFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[] };

function find(wanted: (state: ScenarioState) => boolean, label: string): MirkwoodFixture {
  const spec = {
    campaignId: "mirkwood-paths",
    scenarioId: "passage-through-mirkwood",
    seatCount: 2,
    decks: ["the-one-deck", "elves-of-lorien"],
    limit: 6000,
    seeds: 60,
    answer: (state: ScenarioState, ctx: Parameters<typeof nextIntent>[1], memory: Set<string>) => nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory),
  } as const;
  const found = firstSeed(say, spec, "MIRKWOOD_SEEDS", wanted, label);
  if (!found) throw new Error(`No ${label} game found`);
  return found;
}

export function mirkwoodFixtures(): { "mirkwood-won": MirkwoodFixture; "mirkwood-lost": MirkwoodFixture } {
  return {
    "mirkwood-won": find((state) => state.stageCleared && !state.lost, "mirkwood-won"),
    "mirkwood-lost": find((state) => state.lost && (state.lossReason ?? "").includes("Mendor left play"), "mirkwood-lost"),
  };
}
