// The Maestro fixtures of The Dead Marshes (shadows-of-mirkwood cycle part 5), written into src/campaign/fixtures/the-dead-marshes.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the One Deck and
// Defenders of Gondor lists of data/decks), two-handed, Easy, so each is one open game. `deadmarshes-won` is the first seed that wins, parked on the win (the outcome screen is one tap away); `deadmarshes-lost` the first that loses,
// parked on the loss. A cycle has no log and no earlier part. A game not found in the seeds is left out.
// The saved decklists' policy is the goldens' one (test/scenarios/the-dead-marshes/game.ts, deadmarshesIntent) with the auto-player's card play and Responses: each seat's last hero stays home from the quest for the escape tests, the seats engage and attack together,
// the travel phase goes to the first location offered and a choice takes the first option. The seeds searched are DEADMARSHES_SEEDS.
import type { StandaloneLoadout } from "../../../src/campaign/standalone.ts";
import type { PlayerIntent, ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { DEFAULT_POLICY, deadmarshesIntent } from "../../../test/scenarios/the-dead-marshes/game.ts";
import { createLog } from "../../log.ts";
import { firstStandaloneSeed } from "../seed-kit.ts";

const say = createLog("e2e-deadmarshes");

export type DeadmarshesFixture = { campaignId: string; seatCount: 2; loadout: StandaloneLoadout; seed: number; intents: PlayerIntent[] };
export type DeadmarshesFixtureName = "deadmarshes-won" | "deadmarshes-lost";

export async function deadmarshesFixtures(): Promise<Partial<Record<DeadmarshesFixtureName, DeadmarshesFixture>>> {
  const find = (wanted: (state: ScenarioState) => boolean, label: string): DeadmarshesFixture | null =>
    firstStandaloneSeed(say, { campaignId: "shadows-of-mirkwood", scenarioId: "the-dead-marshes", seatCount: 2, answer: (state: ScenarioState, ctx: Parameters<typeof deadmarshesIntent>[1], memory: Set<string>) => deadmarshesIntent(state, ctx, memory, DEFAULT_POLICY, { scout: "", prefer: "", protect: "", play: true, act: true }) }, "DEADMARSHES_SEEDS", wanted, label);
  const won = find((state) => state.stageCleared && !state.lost, "deadmarshes-won");
  const lost = find((state) => state.lost, "deadmarshes-lost");
  return { ...(won ? { "deadmarshes-won": won } : {}), ...(lost ? { "deadmarshes-lost": lost } : {}) };
}
