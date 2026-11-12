// The Maestro fixtures of The Tower of Cirith Ungol (the-return-of-the-king part 4), written into src/campaign/fixtures/the-tower-of-cirith-ungol.json by scripts/e2e/fixtures.ts: real games of saved decklists (the Defenders of
// Gondor and Swords of the Noldor lists of data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `ungol-won` is the first seed that wins, parked on the win (the Resolution waits); `ungol-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it.
// TODO: say what the Campaign Setup and the Resolution ask, and which answers the saved decklists' policy gives them.
import type { CampaignLog } from "../../src/campaign/log.ts";
import type { StoredLoadout } from "../../src/campaign/save.ts";
import type { PlayerIntent, ScenarioState } from "../../src/rules/engine/reduce.ts";

import { FIELDS_GOLDENS, fieldsWorld, playGolden as playFields } from "../../test/scenarios/the-battle-of-the-pelennor-fields/game.ts";
import { gondorWonLog } from "./the-battle-of-the-pelennor-fields.ts";
import { nextIntent } from "../../test/harness/auto-player.ts";
import { createLog } from "../log.ts";
import { firstSeed, wonLog } from "./seed-kit.ts";

const say = createLog("e2e-ungol");

export type UngolFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type UngolFixtureName = "ungol-won" | "ungol-lost";

// The log of a playthrough whose first 3 parts were won: the log of the parts before The Battle of the Pelennor Fields (scripts/e2e/the-battle-of-the-pelennor-fields.ts), then the The Battle of the Pelennor Fields golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function fieldsWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "The Battle of the Pelennor Fields", goldens: FIELDS_GOLDENS, world: fieldsWorld, play: playFields }, await gondorWonLog());
}

export async function ungolFixtures(): Promise<Partial<Record<UngolFixtureName, UngolFixture>>> {
  const log = await fieldsWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): UngolFixture | null => {
    // TODO: the scenario's own answers in place of the saved decklists' policy, when the scenario needs them (scripts/e2e/temple-of-the-deceived.ts is the pattern).
    const found = firstSeed(say, { campaignId: "the-return-of-the-king", scenarioId: "the-tower-of-cirith-ungol", seatCount: 2, log, answer: (state: ScenarioState, ctx: Parameters<typeof nextIntent>[1], memory: Set<string>) => nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory) }, "UNGOL_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "ungol-won");
  const lost = find((state) => state.lost, "ungol-lost");
  return { ...(won ? { "ungol-won": won } : {}), ...(lost ? { "ungol-lost": lost } : {}) };
}
