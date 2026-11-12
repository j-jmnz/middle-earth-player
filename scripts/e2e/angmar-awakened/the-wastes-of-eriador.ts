// The Maestro fixtures of The Wastes of Eriador (angmar-awakened part 4), written into src/campaign/fixtures/the-wastes-of-eriador.json by scripts/e2e/fixtures.ts: real games of saved decklists (the Defenders of
// Gondor and Swords of the Noldor lists of data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `eriador-won` is the first seed that wins, parked on the win (the Resolution waits); `eriador-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it.
// TODO: say what the Campaign Setup and the Resolution ask, and which answers the saved decklists' policy gives them.
import type { CampaignLog } from "../../../src/campaign/log.ts";
import type { StoredLoadout } from "../../../src/campaign/save.ts";
import type { PlayerIntent, ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { DIKE_GOLDENS, dikeWorld, playGolden as playDike } from "../../../test/scenarios/deadmens-dike/game.ts";
import { hillsWonLog } from "./deadmens-dike.ts";
import { nextIntent } from "../../../test/harness/auto-player.ts";
import { createLog } from "../../log.ts";
import { firstSeed, wonLog } from "../seed-kit.ts";

const say = createLog("e2e-eriador");

export type EriadorFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type EriadorFixtureName = "eriador-won" | "eriador-lost";

// The log of a playthrough whose first 3 parts were won: the log of the parts before Deadmen's Dike (scripts/e2e/angmar-awakened/deadmens-dike.ts), then the Deadmen's Dike golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function dikeWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "Deadmen's Dike", goldens: DIKE_GOLDENS, world: dikeWorld, play: playDike }, await hillsWonLog());
}

export async function eriadorFixtures(): Promise<Partial<Record<EriadorFixtureName, EriadorFixture>>> {
  const log = await dikeWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): EriadorFixture | null => {
    // TODO: the scenario's own answers in place of the saved decklists' policy, when the scenario needs them (scripts/e2e/temple-of-the-deceived.ts is the pattern).
    const found = firstSeed(say, { campaignId: "angmar-awakened", scenarioId: "the-wastes-of-eriador", seatCount: 2, log, answer: (state: ScenarioState, ctx: Parameters<typeof nextIntent>[1], memory: Set<string>) => nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory) }, "ERIADOR_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "eriador-won");
  const lost = find((state) => state.lost, "eriador-lost");
  return { ...(won ? { "eriador-won": won } : {}), ...(lost ? { "eriador-lost": lost } : {}) };
}
