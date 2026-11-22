// The fixtures of The King's Quest (ered-mithrin part 3), written into src/campaign/fixtures/the-kings-quest.json by scripts/e2e/fixtures.ts: real games of saved decklists (the fixture decks of scripts/e2e/seed-kit.ts), two-handed, Easy, so each is a real save. `kingsquest-won` is the first seed that wins, parked on the win (the Resolution waits); `kingsquest-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it.
// The Campaign Setup asks nothing of a log without Turayn's oath line (the log is the two-handed wins of parts 1 and 2 that put the allies in the pool); the Resolution asks the first player two questions, whether Isolde joins the pool
// (the first option) and which burden goes to the pool with Abandoned Ruin (The Threat to Wilderland, the first). The decklists are played with the scenario's golden policy (test/scenarios/the-kings-quest/game.ts: the players travel to
// Abandoned Ruin, the third hero of the first seat stays out of the quest and attacks Fire-drake alone, a choice takes the best answer) with card play on.
import type { CampaignLog } from "../../src/campaign/log.ts";
import type { StoredLoadout } from "../../src/campaign/save.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../src/rules/engine/reduce.ts";

import { LOSTMIRK_GOLDENS, lostmirkWorld, playGolden as playLostmirk } from "../../test/scenarios/lost-in-mirkwood/game.ts";
import { KINGSQUEST_POLICY, kingsquestIntent } from "../../test/scenarios/the-kings-quest/game.ts";
import { upanduinWonLog } from "./lost-in-mirkwood.ts";
import { createLog } from "../log.ts";
import { firstSeed, wonLog } from "./seed-kit.ts";

const say = createLog("e2e-kingsquest");

export type KingsquestFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type KingsquestFixtureName = "kingsquest-won" | "kingsquest-lost";

// The log of a playthrough whose first 2 parts were won: the log of the parts before Lost in Mirkwood (scripts/e2e/lost-in-mirkwood.ts), then the Lost in Mirkwood golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function lostmirkWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "Lost in Mirkwood", golden: "two-handed, won, Melanwar joins the pool, a treasure discovered", goldens: LOSTMIRK_GOLDENS, world: lostmirkWorld, play: playLostmirk }, await upanduinWonLog());
}

export async function kingsquestFixtures(): Promise<Partial<Record<KingsquestFixtureName, KingsquestFixture>>> {
  const log = await lostmirkWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): KingsquestFixture | null => {
    // The first seat's third hero stays out of the quest and attacks (the stand-in heroes of the goldens are q1 to q3; the decklists' are their own).
    const answer = (state: ScenarioState, ctx: ReduceContext, memory: Set<string>) => {
      const scout = state.cards[state.seats[0]?.heroes[2] ?? ""]?.code ?? "";
      return kingsquestIntent(state, ctx, memory, undefined, { ...KINGSQUEST_POLICY, scout, protect: scout, play: true, act: true });
    };
    const found = firstSeed(say, { campaignId: "ered-mithrin", scenarioId: "the-kings-quest", seatCount: 2, log, answer }, "KINGSQUEST_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "kingsquest-won");
  const lost = find((state) => state.lost, "kingsquest-lost");
  return { ...(won ? { "kingsquest-won": won } : {}), ...(lost ? { "kingsquest-lost": lost } : {}) };
}
