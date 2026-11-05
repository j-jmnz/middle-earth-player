// The Maestro fixtures of The Withered Heath (ered-mithrin part 4), written into src/campaign/fixtures/the-withered-heath.json by scripts/e2e/fixtures.ts: real games of saved decklists (the Defenders of
// Gondor and Swords of the Noldor lists of data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `heath-won` is the first seed that wins, parked on the win (the Resolution waits); `heath-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it.
// TODO: say what the Campaign Setup and the Resolution ask, and which answers the saved decklists' policy gives them.
import type { CampaignLog } from "../../src/campaign/log.ts";
import type { StoredLoadout } from "../../src/campaign/save.ts";
import type { PlayerIntent, ScenarioState } from "../../src/rules/engine/reduce.ts";

import { KINGSQUEST_GOLDENS, kingsquestWorld, playGolden as playKingsquest } from "../../test/scenarios/the-kings-quest/game.ts";
import { lostmirkWonLog } from "./the-kings-quest.ts";
import { nextIntent } from "../../test/harness/auto-player.ts";
import { createLog } from "../log.ts";
import { firstSeed, wonLog } from "./seed-kit.ts";

const say = createLog("e2e-heath");

export type HeathFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type HeathFixtureName = "heath-won" | "heath-lost";

// The log of a playthrough whose first 3 parts were won: the log of the parts before The King's Quest (scripts/e2e/the-kings-quest.ts), then the The King's Quest golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function kingsquestWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "The King's Quest", goldens: KINGSQUEST_GOLDENS, world: kingsquestWorld, play: playKingsquest }, await lostmirkWonLog());
}

export async function heathFixtures(): Promise<Partial<Record<HeathFixtureName, HeathFixture>>> {
  const log = await kingsquestWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): HeathFixture | null => {
    // TODO: the scenario's own answers in place of the saved decklists' policy, when the scenario needs them (scripts/e2e/temple-of-the-deceived.ts is the pattern).
    const found = firstSeed(say, { campaignId: "ered-mithrin", scenarioId: "the-withered-heath", seatCount: 2, log, answer: (state: ScenarioState, ctx: Parameters<typeof nextIntent>[1], memory: Set<string>) => nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory) }, "HEATH_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "heath-won");
  const lost = find((state) => state.lost, "heath-lost");
  return { ...(won ? { "heath-won": won } : {}), ...(lost ? { "heath-lost": lost } : {}) };
}
