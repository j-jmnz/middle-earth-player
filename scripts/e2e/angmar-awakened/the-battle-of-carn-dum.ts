// The Maestro fixtures of The Battle of Carn Dûm (angmar-awakened part 8), written into src/campaign/fixtures/the-battle-of-carn-dum.json by scripts/e2e/fixtures.ts: real games of saved decklists (the Defenders of
// Gondor and Swords of the Noldor lists of data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `dum-won` is the first seed that wins, parked on the win (the Resolution waits); `dum-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it.
// TODO: say what the Campaign Setup and the Resolution ask, and which answers the saved decklists' policy gives them.
import type { CampaignLog } from "../../../src/campaign/log.ts";
import type { StoredLoadout } from "../../../src/campaign/save.ts";
import type { PlayerIntent, ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { RHUDAUR_GOLDENS, rhudaurWorld, playGolden as playRhudaur } from "../../../test/scenarios/the-treachery-of-rhudaur/game.ts";
import { ettenmoorsWonLog } from "./the-treachery-of-rhudaur.ts";
import { nextIntent } from "../../../test/harness/auto-player.ts";
import { createLog } from "../../log.ts";
import { firstSeed, wonLog } from "../seed-kit.ts";

const say = createLog("e2e-dum");

export type DumFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type DumFixtureName = "dum-won" | "dum-lost";

// The log of a playthrough whose first 7 parts were won: the log of the parts before The Treachery of Rhudaur (scripts/e2e/angmar-awakened/the-treachery-of-rhudaur.ts), then the The Treachery of Rhudaur golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function rhudaurWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "The Treachery of Rhudaur", goldens: RHUDAUR_GOLDENS, world: rhudaurWorld, play: playRhudaur }, await ettenmoorsWonLog());
}

export async function dumFixtures(): Promise<Partial<Record<DumFixtureName, DumFixture>>> {
  const log = await rhudaurWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): DumFixture | null => {
    // TODO: the scenario's own answers in place of the saved decklists' policy, when the scenario needs them (scripts/e2e/temple-of-the-deceived.ts is the pattern).
    const found = firstSeed(say, { campaignId: "angmar-awakened", scenarioId: "the-battle-of-carn-dum", seatCount: 2, log, answer: (state: ScenarioState, ctx: Parameters<typeof nextIntent>[1], memory: Set<string>) => nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory) }, "DUM_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "dum-won");
  const lost = find((state) => state.lost, "dum-lost");
  return { ...(won ? { "dum-won": won } : {}), ...(lost ? { "dum-lost": lost } : {}) };
}
