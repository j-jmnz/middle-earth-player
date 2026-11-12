// The Maestro fixtures of Deadmen's Dike (angmar-awakened part 3), written into src/campaign/fixtures/deadmens-dike.json by scripts/e2e/fixtures.ts: real games of saved decklists (the Defenders of
// Gondor and Swords of the Noldor lists of data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `dike-won` is the first seed that wins, parked on the win (the Resolution waits); `dike-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it.
// The Campaign Setup asks nothing (Iârion's Pendant is attached, Protect the Innocent staged with the damage the log noted, Mysterious Omens shuffled in from the pool); the Resolution asks the first player for the Pendant or Amarthiúl's Courage (the decklists' policy takes the first
// option). The decklists are played with the scenario's golden policy (test/scenarios/deadmens-dike/game.ts: the players engage nobody, one hero quests and the others attack Thaurdir first, every attack lands undefended) with card play on.
import type { CampaignLog } from "../../../src/campaign/log.ts";
import type { StoredLoadout } from "../../../src/campaign/save.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { HILLS_GOLDENS, hillsWorld, playGolden as playHills } from "../../../test/scenarios/the-weather-hills/game.ts";
import { chetwoodWonLog } from "./the-weather-hills.ts";
import { DEFAULT_POLICY, DIKE_POLICY, dikeIntent } from "../../../test/scenarios/deadmens-dike/game.ts";
import { createLog } from "../../log.ts";
import { firstSeed, wonLog } from "../seed-kit.ts";

const say = createLog("e2e-dike");

export type DikeFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type DikeFixtureName = "dike-won" | "dike-lost";

// The log of a playthrough whose first 2 parts were won: the log of the parts before The Weather Hills (scripts/e2e/angmar-awakened/the-weather-hills.ts), then the The Weather Hills golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function hillsWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "The Weather Hills", goldens: HILLS_GOLDENS, world: hillsWorld, play: playHills, golden: "two-handed, won, Normal", scenarioId: "the-weather-hills" }, await chetwoodWonLog());
}

export async function dikeFixtures(): Promise<Partial<Record<DikeFixtureName, DikeFixture>>> {
  const log = await hillsWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): DikeFixture | null => {
    const found = firstSeed(say, { campaignId: "angmar-awakened", scenarioId: "deadmens-dike", seatCount: 2, log, answer: (state: ScenarioState, ctx: ReduceContext, memory: Set<string>) => dikeIntent(state, ctx, memory, DEFAULT_POLICY, { ...DIKE_POLICY, play: true, act: true }) }, "DIKE_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "dike-won");
  const lost = find((state) => state.lost, "dike-lost");
  return { ...(won ? { "dike-won": won } : {}), ...(lost ? { "dike-lost": lost } : {}) };
}
