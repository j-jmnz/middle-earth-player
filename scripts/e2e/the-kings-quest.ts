// The Maestro fixtures of The King's Quest (ered-mithrin part 3), written into src/campaign/fixtures/the-kings-quest.json by scripts/e2e/fixtures.ts: real games of saved decklists (the Defenders of
// Gondor and Swords of the Noldor lists of data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `kingsquest-won` is the first seed that wins, parked on the win (the Resolution waits); `kingsquest-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it.
// TODO: say what the Campaign Setup and the Resolution ask, and which answers the saved decklists' policy gives them.
import type { CampaignLog } from "../../src/campaign/log.ts";
import type { StoredLoadout } from "../../src/campaign/save.ts";
import type { PlayerIntent, ScenarioState } from "../../src/rules/engine/reduce.ts";

import { LOSTMIRK_GOLDENS, lostmirkWorld, playGolden as playLostmirk } from "../../test/scenarios/lost-in-mirkwood/game.ts";
import { upanduinWonLog } from "./lost-in-mirkwood.ts";
import { nextIntent } from "../../test/harness/auto-player.ts";
import { createLog } from "../log.ts";
import { firstSeed, wonLog } from "./seed-kit.ts";

const say = createLog("e2e-kingsquest");

export type KingsquestFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type KingsquestFixtureName = "kingsquest-won" | "kingsquest-lost";

// The log of a playthrough whose first 2 parts were won: the log of the parts before Lost in Mirkwood (scripts/e2e/lost-in-mirkwood.ts), then the Lost in Mirkwood golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function lostmirkWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "Lost in Mirkwood", goldens: LOSTMIRK_GOLDENS, world: lostmirkWorld, play: playLostmirk }, await upanduinWonLog());
}

export async function kingsquestFixtures(): Promise<Partial<Record<KingsquestFixtureName, KingsquestFixture>>> {
  const log = await lostmirkWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): KingsquestFixture | null => {
    // TODO: the scenario's own answers in place of the saved decklists' policy, when the scenario needs them (scripts/e2e/temple-of-the-deceived.ts is the pattern).
    const found = firstSeed(say, { campaignId: "ered-mithrin", scenarioId: "the-kings-quest", seatCount: 2, log, answer: (state: ScenarioState, ctx: Parameters<typeof nextIntent>[1], memory: Set<string>) => nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory) }, "KINGSQUEST_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "kingsquest-won");
  const lost = find((state) => state.lost, "kingsquest-lost");
  return { ...(won ? { "kingsquest-won": won } : {}), ...(lost ? { "kingsquest-lost": lost } : {}) };
}
