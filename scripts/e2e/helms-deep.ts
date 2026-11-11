// The Maestro fixtures of Helm's Deep (the-two-towers part 2), written into src/campaign/fixtures/helms-deep.json by scripts/e2e/fixtures.ts: real games of saved decklists (the One Deck and the
// Defenders of Gondor lists of data/decks/prebuilt.json, `FIXTURE_DECKS`), two-handed, Easy, so each is a real save. `deep-won` is the first seed that wins, parked on the win (the Resolution waits); `deep-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it.
// The Campaign Setup asks nothing (the previous part's boons are in the log, the checklist places them); the quest card's Setup asks the first player for the group, and the saved decklists take Poisoned Counsels in each deck (the first
// option); the Resolution (143077) asks nothing. The decklists are played with the scenario's golden policy (test/scenarios/helms-deep/game.ts: the enemies are engaged and attacked, one character of each seat quests, the
// Defense stages place the Threat that beats the Willpower as progress for the encounter deck) with card play on.
import type { CampaignLog } from "../../src/campaign/log.ts";
import type { StoredLoadout } from "../../src/campaign/save.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../src/rules/engine/reduce.ts";

import { HAI_GOLDENS, haiWorld, playGolden as playHai } from "../../test/scenarios/the-uruk-hai/game.ts";
import { DEEP_POLICY, DEFAULT_POLICY, deepIntent } from "../../test/scenarios/helms-deep/game.ts";
import { createLog } from "../log.ts";
import { firstSeed, wonLog } from "./seed-kit.ts";

const say = createLog("e2e-deep");

export type DeepFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type DeepFixtureName = "deep-won" | "deep-lost";

// The log of a playthrough whose first part was won: The Uruk-hai golden's two-handed win, resolved onto a blank log, their heroes and what hangs on them left out.
export async function haiWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "The Uruk-hai", golden: "two-handed, won, Normal", goldens: HAI_GOLDENS, world: haiWorld, play: playHai, scenarioId: "the-uruk-hai" });
}

export async function deepFixtures(): Promise<Partial<Record<DeepFixtureName, DeepFixture>>> {
  const log = await haiWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): DeepFixture | null => {
    const answer = (state: ScenarioState, ctx: ReduceContext, memory: Set<string>) => deepIntent(state, ctx, memory, DEFAULT_POLICY, { ...DEEP_POLICY, play: true, act: true });
    const found = firstSeed(say, { campaignId: "the-two-towers", scenarioId: "helms-deep", seatCount: 2, log, answer }, "DEEP_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "deep-won");
  const lost = find((state) => state.lost, "deep-lost");
  return { ...(won ? { "deep-won": won } : {}), ...(lost ? { "deep-lost": lost } : {}) };
}
