// The fixtures of The Battle of Carn Dûm (angmar-awakened part 8), written into src/campaign/fixtures/the-battle-of-carn-dum.json by scripts/e2e/fixtures.ts: real games of saved decklists (the fixture decks of scripts/e2e/seed-kit.ts), two-handed, Easy, so each is a real save. `dum-won` is the first seed that wins, parked on the win (the Resolution waits); `dum-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it.
// The Campaign Setup offers each player one of the four boons (the first player takes Elrond's Champion, the second Lore of Ancient Arnor: `boonChoices`); the Resolution asks nothing (the damage on each hero is noted and the Determination marks are written). The decklists are played with the
// scenario's golden policy (test/scenarios/the-battle-of-carn-dum/game.ts) with card play on.
import type { CampaignLog } from "../../../src/campaign/log.ts";
import type { StoredLoadout } from "../../../src/campaign/save.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { boonChoices, DEFAULT_POLICY, DUM_POLICY, dumIntent } from "../../../test/scenarios/the-battle-of-carn-dum/game.ts";
import { RHUDAUR_GOLDENS, rhudaurWorld, playGolden as playRhudaur } from "../../../test/scenarios/the-treachery-of-rhudaur/game.ts";
import { ettenmoorsWonLog } from "./the-treachery-of-rhudaur.ts";
import { createLog } from "../../log.ts";
import { firstSeed, wonLog } from "../seed-kit.ts";

const say = createLog("e2e-dum");

export type DumFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type DumFixtureName = "dum-won" | "dum-lost";

// The log of a playthrough whose first 7 parts were won: the log of the parts before The Treachery of Rhudaur (scripts/e2e/angmar-awakened/the-treachery-of-rhudaur.ts), then the The Treachery of Rhudaur golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function rhudaurWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "The Treachery of Rhudaur", golden: "two-handed, won, no side quest chosen and all three removed when the time ran out", goldens: RHUDAUR_GOLDENS, world: rhudaurWorld, play: playRhudaur, scenarioId: "the-treachery-of-rhudaur" }, await ettenmoorsWonLog());
}

export async function dumFixtures(): Promise<Partial<Record<DumFixtureName, DumFixture>>> {
  const log = await rhudaurWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): DumFixture | null => {
    const found = firstSeed(say, { campaignId: "angmar-awakened", scenarioId: "the-battle-of-carn-dum", seatCount: 2, log, choices: boonChoices(2), answer: (state: ScenarioState, ctx: ReduceContext, memory: Set<string>) => dumIntent(state, ctx, memory, DEFAULT_POLICY, { ...DUM_POLICY, play: true, act: true }) }, "DUM_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "dum-won");
  const lost = find((state) => state.lost, "dum-lost");
  return { ...(won ? { "dum-won": won } : {}), ...(lost ? { "dum-lost": lost } : {}) };
}
