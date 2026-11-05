// The Maestro fixtures of Roam Across Rhovanion (ered-mithrin part 5), written into src/campaign/fixtures/roam-across-rhovanion.json by scripts/e2e/fixtures.ts: real games of saved decklists (the Defenders of
// Gondor and Swords of the Noldor lists of data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `rhovanion-won` is the first seed that wins, parked on the win (the Resolution waits); `rhovanion-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it.
// TODO: say what the Campaign Setup and the Resolution ask, and which answers the saved decklists' policy gives them.
import type { CampaignLog } from "../../src/campaign/log.ts";
import type { StoredLoadout } from "../../src/campaign/save.ts";
import type { PlayerIntent, ScenarioState } from "../../src/rules/engine/reduce.ts";

import { HEATH_GOLDENS, heathWorld, playGolden as playHeath } from "../../test/scenarios/the-withered-heath/game.ts";
import { kingsquestWonLog } from "./the-withered-heath.ts";
import { nextIntent } from "../../test/harness/auto-player.ts";
import { createLog } from "../log.ts";
import { firstSeed, wonLog } from "./seed-kit.ts";

const say = createLog("e2e-rhovanion");

export type RhovanionFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type RhovanionFixtureName = "rhovanion-won" | "rhovanion-lost";

// The log of a playthrough whose first 4 parts were won: the log of the parts before The Withered Heath (scripts/e2e/the-withered-heath.ts), then the The Withered Heath golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function heathWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "The Withered Heath", goldens: HEATH_GOLDENS, world: heathWorld, play: playHeath }, await kingsquestWonLog());
}

export async function rhovanionFixtures(): Promise<Partial<Record<RhovanionFixtureName, RhovanionFixture>>> {
  const log = await heathWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): RhovanionFixture | null => {
    // TODO: the scenario's own answers in place of the saved decklists' policy, when the scenario needs them (scripts/e2e/temple-of-the-deceived.ts is the pattern).
    const found = firstSeed(say, { campaignId: "ered-mithrin", scenarioId: "roam-across-rhovanion", seatCount: 2, log, answer: (state: ScenarioState, ctx: Parameters<typeof nextIntent>[1], memory: Set<string>) => nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory) }, "RHOVANION_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "rhovanion-won");
  const lost = find((state) => state.lost, "rhovanion-lost");
  return { ...(won ? { "rhovanion-won": won } : {}), ...(lost ? { "rhovanion-lost": lost } : {}) };
}
