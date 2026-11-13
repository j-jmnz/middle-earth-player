// The Maestro fixtures of The Treachery of Rhudaur (angmar-awakened part 7), written into src/campaign/fixtures/the-treachery-of-rhudaur.json by scripts/e2e/fixtures.ts: real games of saved decklists (the Defenders of
// Gondor and Swords of the Noldor lists of data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `rhudaur-won` is the first seed that wins, parked on the win (the Resolution waits); `rhudaur-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it.
// TODO: say what the Campaign Setup and the Resolution ask, and which answers the saved decklists' policy gives them.
import type { CampaignLog } from "../../../src/campaign/log.ts";
import type { StoredLoadout } from "../../../src/campaign/save.ts";
import type { PlayerIntent, ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { ETTENMOORS_GOLDENS, ettenmoorsWorld, playGolden as playEttenmoors } from "../../../test/scenarios/across-the-ettenmoors/game.ts";
import { gramWonLog } from "./across-the-ettenmoors.ts";
import { nextIntent } from "../../../test/harness/auto-player.ts";
import { createLog } from "../../log.ts";
import { firstSeed, wonLog } from "../seed-kit.ts";

const say = createLog("e2e-rhudaur");

export type RhudaurFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type RhudaurFixtureName = "rhudaur-won" | "rhudaur-lost";

// The log of a playthrough whose first 6 parts were won: the log of the parts before Across the Ettenmoors (scripts/e2e/angmar-awakened/across-the-ettenmoors.ts), then the Across the Ettenmoors golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function ettenmoorsWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "Across the Ettenmoors", goldens: ETTENMOORS_GOLDENS, world: ettenmoorsWorld, play: playEttenmoors }, await gramWonLog());
}

export async function rhudaurFixtures(): Promise<Partial<Record<RhudaurFixtureName, RhudaurFixture>>> {
  const log = await ettenmoorsWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): RhudaurFixture | null => {
    // TODO: the scenario's own answers in place of the saved decklists' policy, when the scenario needs them (scripts/e2e/temple-of-the-deceived.ts is the pattern).
    const found = firstSeed(say, { campaignId: "angmar-awakened", scenarioId: "the-treachery-of-rhudaur", seatCount: 2, log, answer: (state: ScenarioState, ctx: Parameters<typeof nextIntent>[1], memory: Set<string>) => nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory) }, "RHUDAUR_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "rhudaur-won");
  const lost = find((state) => state.lost, "rhudaur-lost");
  return { ...(won ? { "rhudaur-won": won } : {}), ...(lost ? { "rhudaur-lost": lost } : {}) };
}
