// The Maestro fixtures of Across the Ettenmoors (angmar-awakened part 6), written into src/campaign/fixtures/across-the-ettenmoors.json by scripts/e2e/fixtures.ts: real games of saved decklists (the Defenders of
// Gondor and Swords of the Noldor lists of data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `ettenmoors-won` is the first seed that wins, parked on the win (the Resolution waits); `ettenmoors-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it.
// TODO: say what the Campaign Setup and the Resolution ask, and which answers the saved decklists' policy gives them.
import type { CampaignLog } from "../../../src/campaign/log.ts";
import type { StoredLoadout } from "../../../src/campaign/save.ts";
import type { PlayerIntent, ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { GRAM_GOLDENS, gramWorld, playGolden as playGram } from "../../../test/scenarios/escape-from-mount-gram/game.ts";
import { eriadorWonLog } from "./escape-from-mount-gram.ts";
import { nextIntent } from "../../../test/harness/auto-player.ts";
import { createLog } from "../../log.ts";
import { firstSeed, wonLog } from "../seed-kit.ts";

const say = createLog("e2e-ettenmoors");

export type EttenmoorsFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type EttenmoorsFixtureName = "ettenmoors-won" | "ettenmoors-lost";

// The log of a playthrough whose first 5 parts were won: the log of the parts before Escape from Mount Gram (scripts/e2e/angmar-awakened/escape-from-mount-gram.ts), then the Escape from Mount Gram golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function gramWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "Escape from Mount Gram", goldens: GRAM_GOLDENS, world: gramWorld, play: playGram }, await eriadorWonLog());
}

export async function ettenmoorsFixtures(): Promise<Partial<Record<EttenmoorsFixtureName, EttenmoorsFixture>>> {
  const log = await gramWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): EttenmoorsFixture | null => {
    // TODO: the scenario's own answers in place of the saved decklists' policy, when the scenario needs them (scripts/e2e/temple-of-the-deceived.ts is the pattern).
    const found = firstSeed(say, { campaignId: "angmar-awakened", scenarioId: "across-the-ettenmoors", seatCount: 2, log, answer: (state: ScenarioState, ctx: Parameters<typeof nextIntent>[1], memory: Set<string>) => nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory) }, "ETTENMOORS_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "ettenmoors-won");
  const lost = find((state) => state.lost, "ettenmoors-lost");
  return { ...(won ? { "ettenmoors-won": won } : {}), ...(lost ? { "ettenmoors-lost": lost } : {}) };
}
