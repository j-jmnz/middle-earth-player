// The Maestro fixtures of The Hills of Emyn Muil (shadows-of-mirkwood cycle part 4), written into src/campaign/fixtures/the-hills-of-emyn-muil.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the One Deck and
// Defenders of Gondor lists of data/decks), two-handed, Easy, so each is one open game. `muil-won` is the first seed that wins, parked on the win (the outcome screen is one tap away); `muil-lost` the first that loses,
// parked on the loss. A cycle has no log and no earlier part. A game not found in the seeds is left out.
// The saved decklists' policy is the goldens' one (test/scenarios/the-hills-of-emyn-muil/game.ts, muilIntent) with the auto-player's card play and Responses: every character quests, each seat engages every enemy it may and attacks together, a defender takes every
// attack he can, the travel phase goes to the first location offered and a choice takes the first option. The seeds searched are MUIL_SEEDS.
import type { StandaloneLoadout } from "../../../src/campaign/standalone.ts";
import type { PlayerIntent, ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { DEFAULT_POLICY, muilIntent } from "../../../test/scenarios/the-hills-of-emyn-muil/game.ts";
import { createLog } from "../../log.ts";
import { firstStandaloneSeed } from "../seed-kit.ts";

const say = createLog("e2e-muil");

export type MuilFixture = { campaignId: string; seatCount: 2; loadout: StandaloneLoadout; seed: number; intents: PlayerIntent[] };
export type MuilFixtureName = "muil-won" | "muil-lost";

export async function muilFixtures(): Promise<Partial<Record<MuilFixtureName, MuilFixture>>> {
  const find = (wanted: (state: ScenarioState) => boolean, label: string): MuilFixture | null =>
    firstStandaloneSeed(say, { campaignId: "shadows-of-mirkwood", scenarioId: "the-hills-of-emyn-muil", seatCount: 2, answer: (state: ScenarioState, ctx: Parameters<typeof muilIntent>[1], memory: Set<string>) => muilIntent(state, ctx, memory, DEFAULT_POLICY, { scout: "", prefer: "", protect: "", play: true, act: true }) }, "MUIL_SEEDS", wanted, label);
  const won = find((state) => state.stageCleared && !state.lost, "muil-won");
  const lost = find((state) => state.lost, "muil-lost");
  return { ...(won ? { "muil-won": won } : {}), ...(lost ? { "muil-lost": lost } : {}) };
}
