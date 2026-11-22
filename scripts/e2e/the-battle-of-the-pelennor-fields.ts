// The fixtures of The Battle of the Pelennor Fields (the-return-of-the-king part 3), written into src/campaign/fixtures/the-battle-of-the-pelennor-fields.json by scripts/e2e/fixtures.ts: real games of saved decklists (The One Deck and the
// Defenders of Gondor list, `FIXTURE_DECKS`), two-handed, so each is a real save. `fields-won` is the first seed that wins, parked on the win (the Resolution waits); `fields-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out (`fields-won` is not found in 100 seeds, GitHub issue #188).
// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it.
// The Campaign Setup asks the first player the two Esquire questions (attach Esquire of Rohan, then Esquire of Gondor, each to a hero of any seat): the policy takes the first option, so both are attached. The Resolution asks nothing (each player earns a Wraith on Wings,
// and an Esquire still on a hero is earned for its controller). The decklists are played with the scenario's golden policy (test/scenarios/the-battle-of-the-pelennor-fields/game.ts: one character quests, the others attack, the players engage and defend Mordor Orc's
// attacks) with card play on. The Siege's win is the log's: its Fleet's resources are in the notes (what its golden recorded); the Two Towers' goldens record no enemy under The Black Gate, so the log's `blackGate` is empty and no Harad enemy is set aside.
import type { CampaignLog } from "../../src/campaign/log.ts";
import type { StoredLoadout } from "../../src/campaign/save.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../src/rules/engine/reduce.ts";

import { GONDOR_GOLDENS, gondorWorld, playGolden as playGondor } from "../../test/scenarios/the-siege-of-gondor/game.ts";
import { DEFAULT_POLICY, FIELDS_POLICY, fieldsIntent } from "../../test/scenarios/the-battle-of-the-pelennor-fields/game.ts";
import { companyWonLog } from "./the-siege-of-gondor.ts";
import { createLog } from "../log.ts";
import { firstSeed, wonLog } from "./seed-kit.ts";

const say = createLog("e2e-fields");

export type FieldsFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type FieldsFixtureName = "fields-won" | "fields-lost";

// The log of a playthrough whose first 2 parts were won: the log of the parts before The Siege of Gondor (scripts/e2e/the-siege-of-gondor.ts), then the The Siege of Gondor golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function gondorWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "The Siege of Gondor", golden: "two-handed, won, Normal", goldens: GONDOR_GOLDENS, world: gondorWorld, play: playGondor, scenarioId: "the-siege-of-gondor" }, await companyWonLog());
}

export async function fieldsFixtures(): Promise<Partial<Record<FieldsFixtureName, FieldsFixture>>> {
  const log = await gondorWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): FieldsFixture | null => {
    const answer = (state: ScenarioState, ctx: ReduceContext, memory: Set<string>) => fieldsIntent(state, ctx, memory, DEFAULT_POLICY, { ...FIELDS_POLICY, play: true, act: true });
    const found = firstSeed(say, { campaignId: "the-return-of-the-king", scenarioId: "the-battle-of-the-pelennor-fields", seatCount: 2, log, answer }, "FIELDS_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "fields-won");
  const lost = find((state) => state.lost, "fields-lost");
  return { ...(won ? { "fields-won": won } : {}), ...(lost ? { "fields-lost": lost } : {}) };
}
