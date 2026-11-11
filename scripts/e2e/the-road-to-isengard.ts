// The Maestro fixtures of The Road to Isengard (the-two-towers part 3), written into src/campaign/fixtures/the-road-to-isengard.json by scripts/e2e/fixtures.ts: real games of saved decklists (the Defenders of
// Gondor and Swords of the Noldor lists of data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `isengard-won` is the first seed that wins, parked on the win (the Resolution waits); `isengard-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it.
// The Campaign Setup asks nothing (Helm's Deep's boons are in the log, the checklist places them: an earned Poisoned Counsels is shuffled into its owner's deck after the starting hand); the quest card's Setup shuffles the encounter deck and
// asks nothing; stage 1B's end of round asks the first player whether to advance (the first option does); the Resolution (143081) asks nothing. The decklists are played with the scenario's golden policy (test/scenarios/the-road-to-isengard/game.ts:
// one character of each seat is left ready to attack Saruman at Orthanc, the others quest) with card play on.
import type { CampaignLog } from "../../src/campaign/log.ts";
import type { StoredLoadout } from "../../src/campaign/save.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../src/rules/engine/reduce.ts";

import { DEEP_GOLDENS, deepWorld, playGolden as playDeep } from "../../test/scenarios/helms-deep/game.ts";
import { haiWonLog } from "./helms-deep.ts";
import { DEFAULT_POLICY, ISENGARD_POLICY, isengardIntent } from "../../test/scenarios/the-road-to-isengard/game.ts";
import { createLog } from "../log.ts";
import { firstSeed, wonLog } from "./seed-kit.ts";

const say = createLog("e2e-isengard");

export type IsengardFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type IsengardFixtureName = "isengard-won" | "isengard-lost";

// The log of a playthrough whose first 2 parts were won: the log of the parts before Helm's Deep (scripts/e2e/helms-deep.ts), then the Helm's Deep golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function deepWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "Helm's Deep", golden: "two-handed, won, Normal", goldens: DEEP_GOLDENS, world: deepWorld, play: playDeep }, await haiWonLog());
}

export async function isengardFixtures(): Promise<Partial<Record<IsengardFixtureName, IsengardFixture>>> {
  const log = await deepWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): IsengardFixture | null => {
    const answer = (state: ScenarioState, ctx: ReduceContext, memory: Set<string>) => isengardIntent(state, ctx, memory, DEFAULT_POLICY, { ...ISENGARD_POLICY, play: true, act: true });
    const found = firstSeed(say, { campaignId: "the-two-towers", scenarioId: "the-road-to-isengard", seatCount: 2, log, answer }, "ISENGARD_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "isengard-won");
  const lost = find((state) => state.lost, "isengard-lost");
  return { ...(won ? { "isengard-won": won } : {}), ...(lost ? { "isengard-lost": lost } : {}) };
}
