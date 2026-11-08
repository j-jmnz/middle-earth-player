// The Maestro fixtures of The Uruk-hai (the-two-towers part 1), written into src/campaign/fixtures/the-uruk-hai.json by scripts/e2e/fixtures.ts: real games of saved decklists (the Defenders of
// Gondor and Swords of the Noldor lists of data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `hai-won` is the first seed that wins, parked on the win (the Resolution waits); `hai-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The Campaign Setup asks nothing here (a fresh log names no Captive, so each seat chooses its own: the quest card's Setup asks the first option); the Resolution asks the first player for the Skill boon of each player or
// Beyond All Hope (the flow answers the first option of each). The decklists are played with the scenario's golden policy (test/scenarios/the-uruk-hai/game.ts: the enemies are engaged and attacked, Uglúk first, every
// character but one quests) with card play on.
import type { StoredLoadout } from "../../src/campaign/save.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../src/rules/engine/reduce.ts";

import { DEFAULT_POLICY, HAI_POLICY, haiIntent } from "../../test/scenarios/the-uruk-hai/game.ts";
import { createLog } from "../log.ts";
import { firstSeed } from "./seed-kit.ts";

const say = createLog("e2e-hai");

export type HaiFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[] };
export type HaiFixtureName = "hai-won" | "hai-lost";

export async function haiFixtures(): Promise<Partial<Record<HaiFixtureName, HaiFixture>>> {
  const find = (wanted: (state: ScenarioState) => boolean, label: string): HaiFixture | null => {
    const answer = (state: ScenarioState, ctx: ReduceContext, memory: Set<string>) => haiIntent(state, ctx, memory, { ...DEFAULT_POLICY, quest: "most" }, { ...HAI_POLICY, play: true, act: true });
    const found = firstSeed(say, { campaignId: "the-two-towers", scenarioId: "the-uruk-hai", seatCount: 2, answer }, "HAI_SEEDS", wanted, label);
    return found && found;
  };
  const won = find((state) => state.stageCleared && !state.lost, "hai-won");
  const lost = find((state) => state.lost, "hai-lost");
  return { ...(won ? { "hai-won": won } : {}), ...(lost ? { "hai-lost": lost } : {}) };
}
