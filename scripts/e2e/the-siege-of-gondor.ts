// The Maestro fixtures of The Siege of Gondor (the-return-of-the-king part 2), written into src/campaign/fixtures/the-siege-of-gondor.json by scripts/e2e/fixtures.ts: real games of saved decklists (the Defenders of
// Gondor and Swords of the Noldor lists of data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `gondor-won` is the first seed that wins, parked on the win (the Resolution waits); `gondor-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it.
// TODO: say what the Campaign Setup and the Resolution ask, and which answers the saved decklists' policy gives them.
import type { CampaignLog } from "../../src/campaign/log.ts";
import type { StoredLoadout } from "../../src/campaign/save.ts";
import type { PlayerIntent, ScenarioState } from "../../src/rules/engine/reduce.ts";

import { COMPANY_GOLDENS, companyWorld, playGolden as playCompany } from "../../test/scenarios/the-passing-of-the-grey-company/game.ts";
import { nextIntent } from "../../test/harness/auto-player.ts";
import { createLog } from "../log.ts";
import { firstSeed, wonLog } from "./seed-kit.ts";

const say = createLog("e2e-gondor");

export type GondorFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type GondorFixtureName = "gondor-won" | "gondor-lost";

// The log of a playthrough whose first 1 part was won: the The Passing of the Grey Company golden's two-handed win, resolved onto a blank log, their heroes and what hangs on them left out.
export async function companyWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "The Passing of the Grey Company", goldens: COMPANY_GOLDENS, world: companyWorld, play: playCompany });
}

export async function gondorFixtures(): Promise<Partial<Record<GondorFixtureName, GondorFixture>>> {
  const log = await companyWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): GondorFixture | null => {
    // TODO: the scenario's own answers in place of the saved decklists' policy, when the scenario needs them (scripts/e2e/temple-of-the-deceived.ts is the pattern).
    const found = firstSeed(say, { campaignId: "the-return-of-the-king", scenarioId: "the-siege-of-gondor", seatCount: 2, log, answer: (state: ScenarioState, ctx: Parameters<typeof nextIntent>[1], memory: Set<string>) => nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory) }, "GONDOR_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "gondor-won");
  const lost = find((state) => state.lost, "gondor-lost");
  return { ...(won ? { "gondor-won": won } : {}), ...(lost ? { "gondor-lost": lost } : {}) };
}
