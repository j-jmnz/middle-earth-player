// The fixtures of Intruders in Chetwood (angmar-awakened part 1), written into src/campaign/fixtures/intruders-in-chetwood.json by scripts/e2e/fixtures.ts: real games of saved decklists (the Defenders of
// Gondor and Swords of the Noldor lists of data/prebuilt-decks.json, `FIXTURE_DECKS`), two-handed, Easy, so each is a real save. `chetwood-won` is the first seed that wins, parked on the win (the Resolution waits); `chetwood-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The Campaign Setup's question (each player may place 4 damage on Protect the Innocent for 1 resource on each hero) is answered by the policy's safe options ("keep"); the Resolution asks nothing (the damage is noted and Protect the Innocent joins the pool).
// The decklists are played with the scenario's golden policy (test/scenarios/intruders-in-chetwood/game.ts: the players engage and kill the enemies, one character defends each attack, one quests) with card play on.
import type { StoredLoadout } from "../../../src/campaign/save.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { CHETWOOD_POLICY, DEFAULT_POLICY, chetwoodIntent } from "../../../test/scenarios/intruders-in-chetwood/game.ts";
import { createLog } from "../../log.ts";
import { firstSeed } from "../seed-kit.ts";

const say = createLog("e2e-chetwood");

export type ChetwoodFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[] };
export type ChetwoodFixtureName = "chetwood-won" | "chetwood-lost";

export async function chetwoodFixtures(): Promise<Partial<Record<ChetwoodFixtureName, ChetwoodFixture>>> {
  const find = (wanted: (state: ScenarioState) => boolean, label: string): ChetwoodFixture | null => {
    const answer = (state: ScenarioState, ctx: ReduceContext, memory: Set<string>) => chetwoodIntent(state, ctx, memory, { ...DEFAULT_POLICY, defend: "all", quest: "one" }, { ...CHETWOOD_POLICY, play: true, act: true });
    return firstSeed(say, { campaignId: "angmar-awakened", scenarioId: "intruders-in-chetwood", seatCount: 2, answer }, "CHETWOOD_SEEDS", wanted, label);
  };
  const won = find((state) => state.stageCleared && !state.lost, "chetwood-won");
  const lost = find((state) => state.lost, "chetwood-lost");
  return { ...(won ? { "chetwood-won": won } : {}), ...(lost ? { "chetwood-lost": lost } : {}) };
}
