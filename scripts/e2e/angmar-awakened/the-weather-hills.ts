// The fixtures of The Weather Hills (angmar-awakened part 2), written into src/campaign/fixtures/the-weather-hills.json by scripts/e2e/fixtures.ts: real games of saved decklists (the Defenders of
// Gondor and Swords of the Noldor lists of data/prebuilt-decks.json), two-handed, Easy, so each is a real save. `hills-won` is the first seed that wins, parked on the win (the Resolution waits); `hills-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the earlier parts recorded as won (Intruders in Chetwood's two-handed win, with Protect the Innocent in its pool), so the open scenario is the playthrough's current node and `openNode` resumes it.
// The Campaign Setup asks nothing (Protect the Innocent and Mysterious Omens are dealt from the pool); the Resolution asks nothing (the damage is noted, a boon is earned only when Mysterious Omens was defeated and a player chose one). The decklists are played with
// the scenario's golden policy (test/scenarios/the-weather-hills/game.ts: the players engage and kill the enemies, one character defends each attack, one quests) with card play on.
import type { CampaignLog } from "../../../src/campaign/log.ts";
import type { StoredLoadout } from "../../../src/campaign/save.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { CHETWOOD_GOLDENS, chetwoodWorld, playGolden as playChetwood } from "../../../test/scenarios/intruders-in-chetwood/game.ts";
import { DEFAULT_POLICY, HILLS_POLICY, hillsIntent } from "../../../test/scenarios/the-weather-hills/game.ts";
import { createLog } from "../../log.ts";
import { firstSeed, wonLog } from "../seed-kit.ts";

const say = createLog("e2e-hills");

export type HillsFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type HillsFixtureName = "hills-won" | "hills-lost";

// The log of a playthrough whose first 1 part was won: the Intruders in Chetwood golden's two-handed win, resolved onto a blank log, their heroes and what hangs on them left out.
export async function chetwoodWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "Intruders in Chetwood", goldens: CHETWOOD_GOLDENS, world: chetwoodWorld, play: playChetwood, golden: "two-handed, won, Normal", scenarioId: "intruders-in-chetwood" });
}

export async function hillsFixtures(): Promise<Partial<Record<HillsFixtureName, HillsFixture>>> {
  const log = await chetwoodWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): HillsFixture | null => {
    const found = firstSeed(say, { campaignId: "angmar-awakened", scenarioId: "the-weather-hills", seatCount: 2, log, answer: (state: ScenarioState, ctx: ReduceContext, memory: Set<string>) => hillsIntent(state, ctx, memory, { ...DEFAULT_POLICY, defend: "all", quest: "one" }, { ...HILLS_POLICY, play: true, act: true }) }, "HILLS_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "hills-won");
  const lost = find((state) => state.lost, "hills-lost");
  return { ...(won ? { "hills-won": won } : {}), ...(lost ? { "hills-lost": lost } : {}) };
}
