// The Maestro fixtures of The Drowned Ruins (dream-chaser part 7), written into src/campaign/fixtures/the-drowned-ruins.json by scripts/e2e/fixtures.ts: real games of saved decklists (the Defenders of
// Gondor and Swords of the Noldor lists of data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `ruins-won` is the first seed that wins, parked on the win (the Resolution waits); `ruins-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it.
// TODO: say what the Campaign Setup and the Resolution ask, and which answers the saved decklists' policy gives them.
import type { CampaignLog } from "../../src/campaign/log.ts";
import type { StoredLoadout } from "../../src/campaign/save.ts";
import type { PlayerIntent, ScenarioState } from "../../src/rules/engine/reduce.ts";

import { TEMPLE_GOLDENS, templeWorld, playGolden as playTemple } from "../../test/scenarios/temple-of-the-deceived/game.ts";
import { depthsWonLog } from "./temple-of-the-deceived.ts";
import { intentFor } from "./raid-on-the-grey-havens.ts";
import { createLog } from "../log.ts";
import { DREAM_CHASER, firstSeed, wonLog } from "./seed-kit.ts";

const say = createLog("e2e-ruins");

export type RuinsFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type RuinsFixtureName = "ruins-won" | "ruins-lost";

// The log of a playthrough whose first 6 parts were won: the log of the parts before Temple of the Deceived (scripts/e2e/temple-of-the-deceived.ts), then the Temple of the Deceived golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function templeWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "Temple of the Deceived", goldens: TEMPLE_GOLDENS, world: templeWorld, play: playTemple }, await depthsWonLog());
}

export async function ruinsFixtures(): Promise<Partial<Record<RuinsFixtureName, RuinsFixture>>> {
  const log = await templeWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): RuinsFixture | null => {
    // TODO: the scenario's own answers in place of the saved decklists' policy, when the scenario needs them (scripts/e2e/temple-of-the-deceived.ts is the pattern).
    const found = firstSeed(say, { campaignId: DREAM_CHASER, scenarioId: "the-drowned-ruins", seatCount: 2, log, answer: intentFor }, "RUINS_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "ruins-won");
  const lost = find((state) => state.lost, "ruins-lost");
  return { ...(won ? { "ruins-won": won } : {}), ...(lost ? { "ruins-lost": lost } : {}) };
}
