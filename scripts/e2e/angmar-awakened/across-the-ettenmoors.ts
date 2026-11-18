// The fixtures of Across the Ettenmoors (angmar-awakened part 6), written into src/campaign/fixtures/across-the-ettenmoors.json by scripts/e2e/fixtures.ts: real games of saved decklists (the Defenders of
// Gondor and Swords of the Noldor lists of data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `ettenmoors-won` is the first seed that wins, parked on the win (the Resolution waits); `ettenmoors-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it.
// The Campaign Setup asks nothing (the five Losing Time are set aside, the Setup of the quest card reveals a random safe location and its guarding side quest); the Resolution asks nothing of its own (each Losing Time in the encounter deck or discard pile joins the Campaign Pool,
// the Determinations on characters are marked). The decklists are played with the scenario's golden policy (test/scenarios/across-the-ettenmoors/game.ts: every hero quests, the players engage and defend nobody, every choice takes its first option) with card play on.
import type { CampaignLog } from "../../../src/campaign/log.ts";
import type { StoredLoadout } from "../../../src/campaign/save.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { GRAM_GOLDENS, gramWorld, playGolden as playGram } from "../../../test/scenarios/escape-from-mount-gram/game.ts";
import { DEFAULT_POLICY, ETTENMOORS_POLICY, ettenmoorsIntent } from "../../../test/scenarios/across-the-ettenmoors/game.ts";
import { eriadorWonLog } from "./escape-from-mount-gram.ts";
import { createLog } from "../../log.ts";
import { firstSeed, wonLog } from "../seed-kit.ts";

const say = createLog("e2e-ettenmoors");

export type EttenmoorsFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type EttenmoorsFixtureName = "ettenmoors-won" | "ettenmoors-lost";

// The log of a playthrough whose first 5 parts were won: the log of the parts before Escape from Mount Gram (scripts/e2e/angmar-awakened/escape-from-mount-gram.ts), then the Escape from Mount Gram golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function gramWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "Escape from Mount Gram", goldens: GRAM_GOLDENS, world: gramWorld, play: playGram, golden: "two-handed, won, Normal" }, await eriadorWonLog());
}

export async function ettenmoorsFixtures(): Promise<Partial<Record<EttenmoorsFixtureName, EttenmoorsFixture>>> {
  const log = await gramWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): EttenmoorsFixture | null => {
    const found = firstSeed(say, { campaignId: "angmar-awakened", scenarioId: "across-the-ettenmoors", seatCount: 2, log, answer: (state: ScenarioState, ctx: ReduceContext, memory: Set<string>) => ettenmoorsIntent(state, ctx, memory, DEFAULT_POLICY, { ...ETTENMOORS_POLICY, play: true, act: true }) }, "ETTENMOORS_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "ettenmoors-won");
  const lost = find((state) => state.lost, "ettenmoors-lost");
  return { ...(won ? { "ettenmoors-won": won } : {}), ...(lost ? { "ettenmoors-lost": lost } : {}) };
}
