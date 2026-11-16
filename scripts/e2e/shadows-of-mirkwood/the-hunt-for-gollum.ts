// The Maestro fixtures of The Hunt for Gollum (shadows-of-mirkwood cycle part 1), written into src/campaign/fixtures/the-hunt-for-gollum.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the One Deck and
// Defenders of Gondor lists of data/decks), two-handed, Easy, so each is one open game. `gollum-won` is the first seed that wins, parked on the win (the outcome screen is one tap away); `gollum-lost` the first that loses,
// parked on the loss. A cycle has no log and no earlier part. A game not found in the seeds is left out. `gollum-won` is rare for the auto-player on real decklists (seed 520); `gollum-lost` is seed 1.
// The saved decklists' policy answers the scenario's questions: the auto-player plays cards and answers each Response it can pay for (it claims a Signs of Gollum after a successful quest), and takes the first option of a choice.
import type { StandaloneLoadout } from "../../../src/campaign/standalone.ts";
import type { PlayerIntent, ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { nextIntent } from "../../../test/harness/auto-player.ts";
import { createLog } from "../../log.ts";
import { firstStandaloneSeed } from "../seed-kit.ts";

const say = createLog("e2e-gollum");

export type GollumFixture = { campaignId: string; seatCount: 2; loadout: StandaloneLoadout; seed: number; intents: PlayerIntent[] };
export type GollumFixtureName = "gollum-won" | "gollum-lost";

export async function gollumFixtures(): Promise<Partial<Record<GollumFixtureName, GollumFixture>>> {
  const find = (wanted: (state: ScenarioState) => boolean, label: string): GollumFixture | null =>
    firstStandaloneSeed(say, { campaignId: "shadows-of-mirkwood", scenarioId: "the-hunt-for-gollum", seatCount: 2, answer: (state: ScenarioState, ctx: Parameters<typeof nextIntent>[1], memory: Set<string>) => nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory) }, "GOLLUM_SEEDS", wanted, label);
  const won = find((state) => state.stageCleared && !state.lost, "gollum-won");
  const lost = find((state) => state.lost, "gollum-lost");
  return { ...(won ? { "gollum-won": won } : {}), ...(lost ? { "gollum-lost": lost } : {}) };
}
