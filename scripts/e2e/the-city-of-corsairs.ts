// The Maestro fixtures of The City of Corsairs (dream-chaser part 9), written into src/campaign/fixtures/the-city-of-corsairs.json by scripts/e2e/fixtures.ts: real games of saved decklists (the Defenders of
// Gondor and Swords of the Noldor lists of data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `corsairs-won` is the first seed that wins, parked on the win (the Resolution waits); `corsairs-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it.
// TODO: say what the Campaign Setup and the Resolution ask, and which answers the saved decklists' policy gives them.
import type { CampaignLog } from "../../src/campaign/log.ts";
import type { StoredLoadout } from "../../src/campaign/save.ts";
import type { PlayerIntent, ScenarioState } from "../../src/rules/engine/reduce.ts";

import { HAVEN_GOLDENS, havenWorld, playGolden as playHaven } from "../../test/scenarios/a-storm-on-cobas-haven/game.ts";
import { ruinsWonLog } from "./a-storm-on-cobas-haven.ts";
import { intentFor } from "./raid-on-the-grey-havens.ts";
import { createLog } from "../log.ts";
import { DREAM_CHASER, firstSeed, wonLog } from "./seed-kit.ts";

const say = createLog("e2e-corsairs");

export type CorsairsFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type CorsairsFixtureName = "corsairs-won" | "corsairs-lost";

// The log of a playthrough whose first 8 parts were won: the log of the parts before A Storm on Cobas Haven (scripts/e2e/a-storm-on-cobas-haven.ts), then the A Storm on Cobas Haven golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function havenWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "A Storm on Cobas Haven", goldens: HAVEN_GOLDENS, world: havenWorld, play: playHaven }, await ruinsWonLog());
}

export async function corsairsFixtures(): Promise<Partial<Record<CorsairsFixtureName, CorsairsFixture>>> {
  const log = await havenWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): CorsairsFixture | null => {
    // TODO: the scenario's own answers in place of the saved decklists' policy, when the scenario needs them (scripts/e2e/temple-of-the-deceived.ts is the pattern).
    const found = firstSeed(say, { campaignId: DREAM_CHASER, scenarioId: "the-city-of-corsairs", seatCount: 2, log, answer: intentFor }, "CORSAIRS_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "corsairs-won");
  const lost = find((state) => state.lost, "corsairs-lost");
  return { ...(won ? { "corsairs-won": won } : {}), ...(lost ? { "corsairs-lost": lost } : {}) };
}
