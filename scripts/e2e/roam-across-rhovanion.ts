// The fixtures of Roam Across Rhovanion (ered-mithrin part 5), written into src/campaign/fixtures/roam-across-rhovanion.json by scripts/e2e/fixtures.ts: real games of saved decklists (The One Deck and the Defenders of Gondor lists of data/decks/test-decks.json and data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `rhovanion-won` is the first seed that wins (none of the first 100 does with The One Deck and the Defenders of Gondor lists, so it is not committed), parked on the win (the Resolution waits); `rhovanion-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it.
// The Campaign Setup asks the first player one question: the boon-ally search (12184:A:2), answered with the first ally the pool offers (Turayn). The log is the two-handed wins of parts 1 to 4 that put the allies in the pool, so no line is written and
// no enemy is removed. The game then asks the first player for the trust in Urdug (12184:A:2, 12184:B:1) at the Setup and after each claim: the policy trusts every time. The Resolution gives each player Misplaced Trust (3 or more resources on Urdug) and asks each
// player for a location of the staging area for the pool (12184:B:4): the flow answers the location question of each player with the first location offered.
// The decklists are played with the scenario's golden policy (test/scenarios/roam-across-rhovanion/game.ts: the location that guards an objective when the stage lets the players travel, the guard of an objective first, then Tiny, then Urdug, every character quests, Harsh Weather
// raises the threat) with card play on and the characters defending as the auto-player has them do.
import type { CampaignLog } from "../../src/campaign/log.ts";
import type { StoredLoadout } from "../../src/campaign/save.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../src/rules/engine/reduce.ts";

import { HEATH_GOLDENS, heathWorld, playGolden as playHeath } from "../../test/scenarios/the-withered-heath/game.ts";
import { DEFAULT_POLICY, RHOVANION_POLICY, rhovanionIntent } from "../../test/scenarios/roam-across-rhovanion/game.ts";
import { kingsquestWonLog } from "./the-withered-heath.ts";
import { createLog } from "../log.ts";
import { firstSeed, wonLog } from "./seed-kit.ts";

const say = createLog("e2e-rhovanion");


export type RhovanionFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type RhovanionFixtureName = "rhovanion-won" | "rhovanion-lost";

// The log of a playthrough whose first 4 parts were won: the log of the parts before The Withered Heath (scripts/e2e/the-withered-heath.ts), then the The Withered Heath golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function heathWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "The Withered Heath", golden: "two-handed, won, after the earlier parts, an Accolade boon for each player, 4 Dragon Signs", goldens: HEATH_GOLDENS, world: heathWorld, play: playHeath }, await kingsquestWonLog());
}

export async function rhovanionFixtures(): Promise<Partial<Record<RhovanionFixtureName, RhovanionFixture>>> {
  const log = await heathWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): RhovanionFixture | null => {
    const answer = (state: ScenarioState, ctx: ReduceContext, memory: Set<string>) => rhovanionIntent(state, ctx, memory, { ...DEFAULT_POLICY, quest: "all", defend: true }, { ...RHOVANION_POLICY, play: true, act: true });
    // The boon-ally search: the first player takes Turayn, the first ally of the pool (12166, joined to the pool by Journey Up the Anduin).
    const found = firstSeed(say, { campaignId: "ered-mithrin", scenarioId: "roam-across-rhovanion", seatCount: 2, log, choices: ["12166"], answer }, "RHOVANION_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "rhovanion-won");
  const lost = find((state) => state.lost, "rhovanion-lost");
  return { ...(won ? { "rhovanion-won": won } : {}), ...(lost ? { "rhovanion-lost": lost } : {}) };
}
