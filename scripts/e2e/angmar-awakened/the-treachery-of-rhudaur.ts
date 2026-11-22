// The fixtures of The Treachery of Rhudaur (angmar-awakened part 7), written into src/campaign/fixtures/the-treachery-of-rhudaur.json by scripts/e2e/fixtures.ts: real games of saved decklists (the fixture decks of scripts/e2e/seed-kit.ts), two-handed, Easy, so each is a real save. `rhudaur-won` is the first seed that wins, parked on the win (the Resolution waits); `rhudaur-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it.
// The Campaign Setup asks nothing (Arnor Ravaged is staged, Mysterious Omens, Fend Off Despair and the Losing Time copies are shuffled in, a Determination goes to each player); the first player's question at the beginning of each quest phase (a side quest, or no current quest: Secrets of Rhudaur cannot be
// the current quest) and the other choices take their last option; the Resolution offers each player the boon of each Clue they control (a Clue is claimed by an Action the saved decklists' policy plays when it can). The decklists are played with the scenario's golden policy (test/scenarios/the-treachery-of-rhudaur/game.ts) with card play on.
import type { CampaignLog } from "../../../src/campaign/log.ts";
import type { StoredLoadout } from "../../../src/campaign/save.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { ETTENMOORS_GOLDENS, ettenmoorsWorld, playGolden as playEttenmoors } from "../../../test/scenarios/across-the-ettenmoors/game.ts";
import { gramWonLog } from "./across-the-ettenmoors.ts";
import { DEFAULT_POLICY, RHUDAUR_POLICY, rhudaurIntent } from "../../../test/scenarios/the-treachery-of-rhudaur/game.ts";
import { createLog } from "../../log.ts";
import { firstSeed, wonLog } from "../seed-kit.ts";

const say = createLog("e2e-rhudaur");

export type RhudaurFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type RhudaurFixtureName = "rhudaur-won" | "rhudaur-lost";

// The log of a playthrough whose first 6 parts were won: the log of the parts before Across the Ettenmoors (scripts/e2e/angmar-awakened/across-the-ettenmoors.ts), then the Across the Ettenmoors golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function ettenmoorsWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "Across the Ettenmoors", golden: "two-handed, won, a safe location in the victory display", goldens: ETTENMOORS_GOLDENS, world: ettenmoorsWorld, play: playEttenmoors }, await gramWonLog());
}

export async function rhudaurFixtures(): Promise<Partial<Record<RhudaurFixtureName, RhudaurFixture>>> {
  const log = await ettenmoorsWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): RhudaurFixture | null => {
    const found = firstSeed(say, { campaignId: "angmar-awakened", scenarioId: "the-treachery-of-rhudaur", seatCount: 2, log, answer: (state: ScenarioState, ctx: ReduceContext, memory: Set<string>) => rhudaurIntent(state, ctx, memory, DEFAULT_POLICY, { ...RHUDAUR_POLICY, play: true, act: true }) }, "RHUDAUR_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "rhudaur-won");
  const lost = find((state) => state.lost, "rhudaur-lost");
  return { ...(won ? { "rhudaur-won": won } : {}), ...(lost ? { "rhudaur-lost": lost } : {}) };
}
