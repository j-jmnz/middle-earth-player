// The fixtures of The Siege of Gondor (the-return-of-the-king part 2), written into src/campaign/fixtures/the-siege-of-gondor.json by scripts/e2e/fixtures.ts: real games of saved decklists (the Defenders of
// Gondor and Swords of the Noldor lists of data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `gondor-won` is the first seed that wins, parked on the win (the Resolution waits); `gondor-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it.
// The Campaign Setup asks the first player about the search for Andúril only when a saved deck holds it (the Defenders of Gondor and Swords of the Noldor lists do not), and the Resolution asks nothing (the Fleet's resources are written in the log and the
// Army of the Dead boon leaves the pool). The decklists are played with the scenario's golden policy (test/scenarios/the-siege-of-gondor/game.ts: all but the last character of a seat quest, every choice takes its first option) with card play on.
import type { CampaignLog } from "../../src/campaign/log.ts";
import type { StoredLoadout } from "../../src/campaign/save.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../src/rules/engine/reduce.ts";

import { COMPANY_GOLDENS, companyWorld, playGolden as playCompany } from "../../test/scenarios/the-passing-of-the-grey-company/game.ts";
import { DEFAULT_POLICY, GONDOR_POLICY, gondorIntent } from "../../test/scenarios/the-siege-of-gondor/game.ts";
import { createLog } from "../log.ts";
import { firstSeed, wonLog } from "./seed-kit.ts";

const say = createLog("e2e-gondor");

export type GondorFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type GondorFixtureName = "gondor-won" | "gondor-lost";

// The log of a playthrough whose first 1 part was won: the The Passing of the Grey Company golden's two-handed win, resolved onto a blank log, their heroes and what hangs on them left out.
export async function companyWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "The Passing of the Grey Company", golden: "two-handed, won, Normal", goldens: COMPANY_GOLDENS, world: companyWorld, play: playCompany, scenarioId: "the-passing-of-the-grey-company" });
}

export async function gondorFixtures(): Promise<Partial<Record<GondorFixtureName, GondorFixture>>> {
  const log = await companyWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): GondorFixture | null => {
    const answer = (state: ScenarioState, ctx: ReduceContext, memory: Set<string>) => gondorIntent(state, ctx, memory, DEFAULT_POLICY, { ...GONDOR_POLICY, play: true, act: true });
    const found = firstSeed(say, { campaignId: "the-return-of-the-king", scenarioId: "the-siege-of-gondor", seatCount: 2, log, answer }, "GONDOR_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "gondor-won");
  const lost = find((state) => state.lost, "gondor-lost");
  return { ...(won ? { "gondor-won": won } : {}), ...(lost ? { "gondor-lost": lost } : {}) };
}
