// The fixtures of The Dread Realm (angmar-awakened part 9), written into src/campaign/fixtures/the-dread-realm.json by scripts/e2e/fixtures.ts: real games of saved decklists (the One Deck and
// Defenders of Gondor lists, `FIXTURE_DECKS` in scripts/e2e/seed-kit.ts), two-handed, Easy, so each is a real save. `realm-won` is the first seed that wins, parked on the win (the Resolution waits); `realm-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it.
// The Campaign Setup offers each player a boon for their opening hand (`boonChoices`: both skip); the Resolution (10193:B:1) asks nothing and ends the campaign. The decklists are played with the scenario's golden policy (test/scenarios/the-dread-realm/game.ts) with card play on.
import type { CampaignLog } from "../../../src/campaign/log.ts";
import type { StoredLoadout } from "../../../src/campaign/save.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { DUM_GOLDENS, dumWorld, playGolden as playDum } from "../../../test/scenarios/the-battle-of-carn-dum/game.ts";
import { boonChoices, DEFAULT_POLICY, REALM_POLICY, realmIntent } from "../../../test/scenarios/the-dread-realm/game.ts";
import { rhudaurWonLog } from "./the-battle-of-carn-dum.ts";
import { createLog } from "../../log.ts";
import { firstSeed, wonLog } from "../seed-kit.ts";

const say = createLog("e2e-realm");

export type RealmFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type RealmFixtureName = "realm-won" | "realm-lost";

// The log of a playthrough whose first 8 parts were won: the log of the parts before The Battle of Carn Dûm (scripts/e2e/angmar-awakened/the-battle-of-carn-dum.ts), then the The Battle of Carn Dûm golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function dumWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "The Battle of Carn Dûm", golden: "two-handed, won, Thaurdir destroyed on stage 2B", goldens: DUM_GOLDENS, world: dumWorld, play: playDum, scenarioId: "the-battle-of-carn-dum" }, await rhudaurWonLog());
}

export async function realmFixtures(): Promise<Partial<Record<RealmFixtureName, RealmFixture>>> {
  const log = await dumWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): RealmFixture | null => {
    const found = firstSeed(say, { campaignId: "angmar-awakened", scenarioId: "the-dread-realm", seatCount: 2, log, choices: boonChoices(2), answer: (state: ScenarioState, ctx: ReduceContext, memory: Set<string>) => realmIntent(state, ctx, memory, DEFAULT_POLICY, { ...REALM_POLICY, play: true, act: true }) }, "REALM_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "realm-won");
  const lost = find((state) => state.lost, "realm-lost");
  return { ...(won ? { "realm-won": won } : {}), ...(lost ? { "realm-lost": lost } : {}) };
}
