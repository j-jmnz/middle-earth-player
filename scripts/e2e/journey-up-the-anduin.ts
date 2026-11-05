// The Maestro fixtures of Journey Up the Anduin (ered-mithrin part 1), written into src/campaign/fixtures/journey-up-the-anduin.json by scripts/e2e/fixtures.ts: real games of saved decklists (the Defenders of
// Gondor and Swords of the Noldor lists of data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `upanduin-won` is the first seed that wins, parked on the win (the Resolution waits); `upanduin-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The Campaign Setup asks nothing; the Resolution asks the first player whether Turayn joins the pool, and the saved decklists' policy takes the first option (the ally for the first hero).
import type { StoredLoadout } from "../../src/campaign/save.ts";
import type { PlayerIntent, ScenarioState } from "../../src/rules/engine/reduce.ts";

import { nextIntent } from "../../test/harness/auto-player.ts";
import { createLog } from "../log.ts";
import { firstSeed } from "./seed-kit.ts";

const say = createLog("e2e-upanduin");

export type UpanduinFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[] };
export type UpanduinFixtureName = "upanduin-won" | "upanduin-lost";

export async function upanduinFixtures(): Promise<Partial<Record<UpanduinFixtureName, UpanduinFixture>>> {
  const find = (wanted: (state: ScenarioState) => boolean, label: string): UpanduinFixture | null => {
    const found = firstSeed(say, { campaignId: "ered-mithrin", scenarioId: "journey-up-the-anduin", seatCount: 2, answer: (state: ScenarioState, ctx: Parameters<typeof nextIntent>[1], memory: Set<string>) => nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory) }, "UPANDUIN_SEEDS", wanted, label);
    return found && found;
  };
  const won = find((state) => state.stageCleared && !state.lost, "upanduin-won");
  const lost = find((state) => state.lost, "upanduin-lost");
  return { ...(won ? { "upanduin-won": won } : {}), ...(lost ? { "upanduin-lost": lost } : {}) };
}
