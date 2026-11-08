// The Maestro fixtures of The Uruk-hai (the-two-towers part 1), written into src/campaign/fixtures/the-uruk-hai.json by scripts/e2e/fixtures.ts: real games of saved decklists (the Defenders of
// Gondor and Swords of the Noldor lists of data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `hai-won` is the first seed that wins, parked on the win (the Resolution waits); `hai-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// TODO: say what the Campaign Setup and the Resolution ask, and which answers the saved decklists' policy gives them.
import type { CampaignLog } from "../../src/campaign/log.ts";
import type { StoredLoadout } from "../../src/campaign/save.ts";
import type { PlayerIntent, ScenarioState } from "../../src/rules/engine/reduce.ts";

import { nextIntent } from "../../test/harness/auto-player.ts";
import { createLog } from "../log.ts";
import { firstSeed } from "./seed-kit.ts";

const say = createLog("e2e-hai");

export type HaiFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[] };
export type HaiFixtureName = "hai-won" | "hai-lost";

export async function haiFixtures(): Promise<Partial<Record<HaiFixtureName, HaiFixture>>> {
  const find = (wanted: (state: ScenarioState) => boolean, label: string): HaiFixture | null => {
    // TODO: the scenario's own answers in place of the saved decklists' policy, when the scenario needs them (scripts/e2e/temple-of-the-deceived.ts is the pattern).
    const found = firstSeed(say, { campaignId: "the-two-towers", scenarioId: "the-uruk-hai", seatCount: 2, answer: (state: ScenarioState, ctx: Parameters<typeof nextIntent>[1], memory: Set<string>) => nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory) }, "HAI_SEEDS", wanted, label);
    return found && found;
  };
  const won = find((state) => state.stageCleared && !state.lost, "hai-won");
  const lost = find((state) => state.lost, "hai-lost");
  return { ...(won ? { "hai-won": won } : {}), ...(lost ? { "hai-lost": lost } : {}) };
}
