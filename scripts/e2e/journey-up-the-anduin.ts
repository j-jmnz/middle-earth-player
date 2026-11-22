// The fixtures of Journey Up the Anduin (ered-mithrin part 1), written into src/campaign/fixtures/journey-up-the-anduin.json by scripts/e2e/fixtures.ts: real games of saved decklists (the fixture decks of scripts/e2e/seed-kit.ts), two-handed, Easy, so each is a real save. `upanduin-won` is the first seed that wins, parked on the win (the Resolution waits); `upanduin-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The Campaign Setup asks nothing; the Resolution asks the first player whether Turayn joins the pool, and the flow writes the line. The decklists are played with the scenario's golden policy (test/scenarios/journey-up-the-anduin/game.ts:
// the players engage the enemies and attack the Evil Creatures first, which keep the stages shut) with card play on.
import type { StoredLoadout } from "../../src/campaign/save.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../src/rules/engine/reduce.ts";

import { UPANDUIN_POLICY, upanduinIntent } from "../../test/scenarios/journey-up-the-anduin/game.ts";
import { createLog } from "../log.ts";
import { firstSeed } from "./seed-kit.ts";

const say = createLog("e2e-upanduin");

export type UpanduinFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[] };
export type UpanduinFixtureName = "upanduin-won" | "upanduin-lost";

export async function upanduinFixtures(): Promise<Partial<Record<UpanduinFixtureName, UpanduinFixture>>> {
  const find = (wanted: (state: ScenarioState) => boolean, label: string): UpanduinFixture | null => {
    const found = firstSeed(say, { campaignId: "ered-mithrin", scenarioId: "journey-up-the-anduin", seatCount: 2, answer: (state: ScenarioState, ctx: ReduceContext, memory: Set<string>) => upanduinIntent(state, ctx, memory, { choose: "first", resolve: "last", act: true }, { ...UPANDUIN_POLICY, play: true }) }, "UPANDUIN_SEEDS", wanted, label);
    return found;
  };
  const won = find((state) => state.stageCleared && !state.lost, "upanduin-won");
  const lost = find((state) => state.lost, "upanduin-lost");
  return { ...(won ? { "upanduin-won": won } : {}), ...(lost ? { "upanduin-lost": lost } : {}) };
}
