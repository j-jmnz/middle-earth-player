// The Maestro fixtures of The Battle of the Pelennor Fields (the-return-of-the-king part 3), written into src/campaign/fixtures/the-battle-of-the-pelennor-fields.json by scripts/e2e/fixtures.ts: real games of saved decklists (the Defenders of
// Gondor and Swords of the Noldor lists of data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `fields-won` is the first seed that wins, parked on the win (the Resolution waits); `fields-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it.
// TODO: say what the Campaign Setup and the Resolution ask, and which answers the saved decklists' policy gives them.
import type { CampaignLog } from "../../src/campaign/log.ts";
import type { StoredLoadout } from "../../src/campaign/save.ts";
import type { PlayerIntent, ScenarioState } from "../../src/rules/engine/reduce.ts";

import { GONDOR_GOLDENS, gondorWorld, playGolden as playGondor } from "../../test/scenarios/the-siege-of-gondor/game.ts";
import { companyWonLog } from "./the-siege-of-gondor.ts";
import { nextIntent } from "../../test/harness/auto-player.ts";
import { createLog } from "../log.ts";
import { firstSeed, wonLog } from "./seed-kit.ts";

const say = createLog("e2e-fields");

export type FieldsFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type FieldsFixtureName = "fields-won" | "fields-lost";

// The log of a playthrough whose first 2 parts were won: the log of the parts before The Siege of Gondor (scripts/e2e/the-siege-of-gondor.ts), then the The Siege of Gondor golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function gondorWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "The Siege of Gondor", goldens: GONDOR_GOLDENS, world: gondorWorld, play: playGondor }, await companyWonLog());
}

export async function fieldsFixtures(): Promise<Partial<Record<FieldsFixtureName, FieldsFixture>>> {
  const log = await gondorWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): FieldsFixture | null => {
    // TODO: the scenario's own answers in place of the saved decklists' policy, when the scenario needs them (scripts/e2e/temple-of-the-deceived.ts is the pattern).
    const found = firstSeed(say, { campaignId: "the-return-of-the-king", scenarioId: "the-battle-of-the-pelennor-fields", seatCount: 2, log, answer: (state: ScenarioState, ctx: Parameters<typeof nextIntent>[1], memory: Set<string>) => nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory) }, "FIELDS_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "fields-won");
  const lost = find((state) => state.lost, "fields-lost");
  return { ...(won ? { "fields-won": won } : {}), ...(lost ? { "fields-lost": lost } : {}) };
}
