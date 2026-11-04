// The Maestro fixtures of A Storm on Cobas Haven (dream-chaser part 8), written into src/campaign/fixtures/a-storm-on-cobas-haven.json by scripts/e2e/fixtures.ts: real games of saved decklists (the Defenders of
// Gondor and Swords of the Noldor lists of data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `haven-won` is the first seed that wins, parked on the win (the Resolution waits); `haven-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it.
// TODO: say what the Campaign Setup and the Resolution ask, and which answers the saved decklists' policy gives them.
import type { CampaignLog } from "../../src/campaign/log.ts";
import type { StoredLoadout } from "../../src/campaign/save.ts";
import type { PlayerIntent, ScenarioState } from "../../src/rules/engine/reduce.ts";

import { RUINS_GOLDENS, ruinsWorld, playGolden as playRuins } from "../../test/scenarios/the-drowned-ruins/game.ts";
import { templeWonLog } from "./the-drowned-ruins.ts";
import { intentFor } from "./raid-on-the-grey-havens.ts";
import { createLog } from "../log.ts";
import { DREAM_CHASER, firstSeed, wonLog } from "./seed-kit.ts";

const say = createLog("e2e-haven");

export type HavenFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type HavenFixtureName = "haven-won" | "haven-lost";

// The log of a playthrough whose first 7 parts were won: the log of the parts before The Drowned Ruins (scripts/e2e/the-drowned-ruins.ts), then the The Drowned Ruins golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function ruinsWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "The Drowned Ruins", goldens: RUINS_GOLDENS, world: ruinsWorld, play: playRuins }, await templeWonLog());
}

export async function havenFixtures(): Promise<Partial<Record<HavenFixtureName, HavenFixture>>> {
  const log = await ruinsWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): HavenFixture | null => {
    // TODO: the scenario's own answers in place of the saved decklists' policy, when the scenario needs them (scripts/e2e/temple-of-the-deceived.ts is the pattern).
    const found = firstSeed(say, { campaignId: DREAM_CHASER, scenarioId: "a-storm-on-cobas-haven", seatCount: 2, log, answer: intentFor }, "HAVEN_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "haven-won");
  const lost = find((state) => state.lost, "haven-lost");
  return { ...(won ? { "haven-won": won } : {}), ...(lost ? { "haven-lost": lost } : {}) };
}
