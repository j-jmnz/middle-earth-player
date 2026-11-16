// The Maestro fixtures of Conflict at the Carrock (shadows-of-mirkwood cycle part 2), written into src/campaign/fixtures/conflict-at-the-carrock.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the One Deck and
// Defenders of Gondor lists of data/decks), two-handed, Easy, so each is one open game. `carrock-won` is the first seed that wins, parked on the win (the outcome screen is one tap away); `carrock-lost` the first that loses,
// parked on the loss. A cycle has no log and no earlier part. A game not found in the seeds is left out.
// TODO: say which answers the saved decklists' policy gives the scenario's questions.
import type { StandaloneLoadout } from "../../../src/campaign/standalone.ts";
import type { PlayerIntent, ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { nextIntent } from "../../../test/harness/auto-player.ts";
import { createLog } from "../../log.ts";
import { firstStandaloneSeed } from "../seed-kit.ts";

const say = createLog("e2e-carrock");

export type CarrockFixture = { campaignId: string; seatCount: 2; loadout: StandaloneLoadout; seed: number; intents: PlayerIntent[] };
export type CarrockFixtureName = "carrock-won" | "carrock-lost";

export async function carrockFixtures(): Promise<Partial<Record<CarrockFixtureName, CarrockFixture>>> {
  const find = (wanted: (state: ScenarioState) => boolean, label: string): CarrockFixture | null =>
    // TODO: the scenario's own answers in place of the saved decklists' policy, when the scenario needs them (scripts/e2e/temple-of-the-deceived.ts is the pattern).
    firstStandaloneSeed(say, { campaignId: "shadows-of-mirkwood", scenarioId: "conflict-at-the-carrock", seatCount: 2, answer: (state: ScenarioState, ctx: Parameters<typeof nextIntent>[1], memory: Set<string>) => nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory) }, "CARROCK_SEEDS", wanted, label);
  const won = find((state) => state.stageCleared && !state.lost, "carrock-won");
  const lost = find((state) => state.lost, "carrock-lost");
  return { ...(won ? { "carrock-won": won } : {}), ...(lost ? { "carrock-lost": lost } : {}) };
}
