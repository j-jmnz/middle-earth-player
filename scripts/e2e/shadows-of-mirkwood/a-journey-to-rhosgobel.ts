// The Maestro fixtures of A Journey to Rhosgobel (shadows-of-mirkwood cycle part 3), written into src/campaign/fixtures/a-journey-to-rhosgobel.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the One Deck and
// Defenders of Gondor lists of data/decks), two-handed, Easy, so each is one open game. `rhosgobel-won` is the first seed that wins, parked on the win (the outcome screen is one tap away); `rhosgobel-lost` the first that loses,
// parked on the loss. A cycle has no log and no earlier part. A game not found in the seeds is left out.
// The saved decklists' policy is the goldens' one (test/scenarios/a-journey-to-rhosgobel/game.ts, rhosgobelIntent) with the auto-player's card play and Responses: every character quests, each seat engages every enemy it may and attacks together, a defender takes every
// attack he can, Radagast's Request is never used (it costs Wilyador damage) and a choice takes the first option, Athelas when it is offered. The seeds searched are RHOSGOBEL_SEEDS.
import type { StandaloneLoadout } from "../../../src/campaign/standalone.ts";
import type { PlayerIntent, ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { DEFAULT_POLICY, rhosgobelIntent } from "../../../test/scenarios/a-journey-to-rhosgobel/game.ts";
import { createLog } from "../../log.ts";
import { firstStandaloneSeed } from "../seed-kit.ts";

const say = createLog("e2e-rhosgobel");

export type RhosgobelFixture = { campaignId: string; seatCount: 2; loadout: StandaloneLoadout; seed: number; intents: PlayerIntent[] };
export type RhosgobelFixtureName = "rhosgobel-won" | "rhosgobel-lost";

export async function rhosgobelFixtures(): Promise<Partial<Record<RhosgobelFixtureName, RhosgobelFixture>>> {
  const find = (wanted: (state: ScenarioState) => boolean, label: string): RhosgobelFixture | null =>
    firstStandaloneSeed(say, { campaignId: "shadows-of-mirkwood", scenarioId: "a-journey-to-rhosgobel", seatCount: 2, answer: (state: ScenarioState, ctx: Parameters<typeof rhosgobelIntent>[1], memory: Set<string>) => rhosgobelIntent(state, ctx, memory, DEFAULT_POLICY, { scout: "", prefer: "", protect: "", play: true, act: true }) }, "RHOSGOBEL_SEEDS", wanted, label);
  const won = find((state) => state.stageCleared && !state.lost, "rhosgobel-won");
  const lost = find((state) => state.lost, "rhosgobel-lost");
  return { ...(won ? { "rhosgobel-won": won } : {}), ...(lost ? { "rhosgobel-lost": lost } : {}) };
}
