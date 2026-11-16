// The Maestro fixtures of Conflict at the Carrock (shadows-of-mirkwood cycle part 2), written into src/campaign/fixtures/conflict-at-the-carrock.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the One Deck and
// Defenders of Gondor lists of data/decks), two-handed, Easy, so each is one open game. `carrock-won` is the first seed that wins, parked on the win (the outcome screen is one tap away); `carrock-lost` the first that loses,
// parked on the loss. A cycle has no log and no earlier part. A game not found in the seeds is left out.
// The saved decklists' policy is the goldens' fighting one (test/scenarios/conflict-at-the-carrock/game.ts, carrockIntent) with the auto-player's card play and Responses: it engages Louis alone first, takes the attacks undefended and attacks one Troll
// with each ready hero, and takes the first option of a choice. A win needs all four unique Trolls defeated, which the real decklists rarely manage; the seeds searched are CARROCK_SEEDS.
import type { StandaloneLoadout } from "../../../src/campaign/standalone.ts";
import type { PlayerIntent, ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { carrockIntent, DEFAULT_POLICY } from "../../../test/scenarios/conflict-at-the-carrock/game.ts";
import { createLog } from "../../log.ts";
import { firstStandaloneSeed } from "../seed-kit.ts";

const say = createLog("e2e-carrock");

export type CarrockFixture = { campaignId: string; seatCount: 2; loadout: StandaloneLoadout; seed: number; intents: PlayerIntent[] };
export type CarrockFixtureName = "carrock-won" | "carrock-lost";

export async function carrockFixtures(): Promise<Partial<Record<CarrockFixtureName, CarrockFixture>>> {
  const find = (wanted: (state: ScenarioState) => boolean, label: string): CarrockFixture | null =>
    firstStandaloneSeed(say, { campaignId: "shadows-of-mirkwood", scenarioId: "conflict-at-the-carrock", seatCount: 2, answer: (state: ScenarioState, ctx: Parameters<typeof carrockIntent>[1], memory: Set<string>) => carrockIntent(state, ctx, memory, DEFAULT_POLICY, { scout: "", prefer: "", protect: "", play: true, act: true }) }, "CARROCK_SEEDS", wanted, label);
  const won = find((state) => state.stageCleared && !state.lost, "carrock-won");
  const lost = find((state) => state.lost, "carrock-lost");
  return { ...(won ? { "carrock-won": won } : {}), ...(lost ? { "carrock-lost": lost } : {}) };
}
