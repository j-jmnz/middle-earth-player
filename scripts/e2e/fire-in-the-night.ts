// The Maestro fixtures of Fire in the Night (ered-mithrin part 6), written into src/campaign/fixtures/fire-in-the-night.json by scripts/e2e/fixtures.ts: real games of saved decklists (The One Deck and the Defenders of Gondor lists of data/decks/test-decks.json and data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `night-won` is the first seed that wins, parked on the win (the Resolution waits); `night-lost`
// the first that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it. It is the log of the two-handed Roam Across Rhovanion win that put Misplaced
// Trust for each player and a copy of a location in the pool, on the log of the four parts before it (no ally line is written, so the Campaign Setup asks nothing).
// The Resolution asks the first player whether Beldis joins the pool or the line is written, then (with 5 or more progress on Hrogar's Hill) which of 3 treasures, then each player which card of the pool to
// remove or none: the flow answers the first option of each, and the removals of the pool take none.
// The decklists are played with the scenario's golden policy (test/scenarios/fire-in-the-night/game.ts: a side quest is made the current quest every other round, the attack on Hrogar's Hill is defended,
// every character quests and the enemies are engaged and attacked) with card play on and the characters defending as the auto-player has them do.
import type { CampaignLog } from "../../src/campaign/log.ts";
import type { StoredLoadout } from "../../src/campaign/save.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../src/rules/engine/reduce.ts";

import { RHOVANION_GOLDENS, rhovanionWorld, playGolden as playRhovanion } from "../../test/scenarios/roam-across-rhovanion/game.ts";
import { DEFAULT_POLICY, NIGHT_POLICY, nightIntent } from "../../test/scenarios/fire-in-the-night/game.ts";
import { heathWonLog } from "./roam-across-rhovanion.ts";
import { createLog } from "../log.ts";
import { firstSeed, wonLog } from "./seed-kit.ts";

const say = createLog("e2e-night");

export type NightFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type NightFixtureName = "night-won" | "night-lost";

// The log of a playthrough whose first 5 parts were won: the log of the parts before Roam Across Rhovanion (scripts/e2e/roam-across-rhovanion.ts), then the Roam Across Rhovanion golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function rhovanionWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "Roam Across Rhovanion", golden: "two-handed, won, after the earlier parts, Tiny, Horn, Key", goldens: RHOVANION_GOLDENS, world: rhovanionWorld, play: playRhovanion }, await heathWonLog());
}

export async function nightFixtures(): Promise<Partial<Record<NightFixtureName, NightFixture>>> {
  const log = await rhovanionWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): NightFixture | null => {
    const answer = (state: ScenarioState, ctx: ReduceContext, memory: Set<string>) => nightIntent(state, ctx, memory, { ...DEFAULT_POLICY, current: "alternate", defend: "hill", quest: "all", engage: true, heal: true }, { ...NIGHT_POLICY, play: true, act: true });
    const found = firstSeed(say, { campaignId: "ered-mithrin", scenarioId: "fire-in-the-night", seatCount: 2, log, answer }, "NIGHT_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "night-won");
  const lost = find((state) => state.lost, "night-lost");
  return { ...(won ? { "night-won": won } : {}), ...(lost ? { "night-lost": lost } : {}) };
}
