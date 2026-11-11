// The Maestro fixtures of The Passage of the Marshes (the-two-towers part 4), written into src/campaign/fixtures/the-passage-of-the-marshes.json by scripts/e2e/fixtures.ts: real games of saved decklists (the Defenders of
// Gondor and Swords of the Noldor lists of data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `marshes-won` is the first seed that wins, parked on the win (the Resolution waits); `marshes-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it.
// TODO: say what the Campaign Setup and the Resolution ask, and which answers the saved decklists' policy gives them.
import type { CampaignLog } from "../../src/campaign/log.ts";
import type { StoredLoadout } from "../../src/campaign/save.ts";
import type { PlayerIntent, ScenarioState } from "../../src/rules/engine/reduce.ts";

import { ISENGARD_GOLDENS, isengardWorld, playGolden as playIsengard } from "../../test/scenarios/the-road-to-isengard/game.ts";
import { deepWonLog } from "./the-road-to-isengard.ts";
import { nextIntent } from "../../test/harness/auto-player.ts";
import { createLog } from "../log.ts";
import { firstSeed, wonLog } from "./seed-kit.ts";

const say = createLog("e2e-marshes");

export type MarshesFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type MarshesFixtureName = "marshes-won" | "marshes-lost";

// The log of a playthrough whose first 3 parts were won: the log of the parts before The Road to Isengard (scripts/e2e/the-road-to-isengard.ts), then the The Road to Isengard golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function isengardWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "The Road to Isengard", goldens: ISENGARD_GOLDENS, world: isengardWorld, play: playIsengard }, await deepWonLog());
}

export async function marshesFixtures(): Promise<Partial<Record<MarshesFixtureName, MarshesFixture>>> {
  const log = await isengardWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): MarshesFixture | null => {
    // TODO: the scenario's own answers in place of the saved decklists' policy, when the scenario needs them (scripts/e2e/temple-of-the-deceived.ts is the pattern).
    const found = firstSeed(say, { campaignId: "the-two-towers", scenarioId: "the-passage-of-the-marshes", seatCount: 2, log, answer: (state: ScenarioState, ctx: Parameters<typeof nextIntent>[1], memory: Set<string>) => nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory) }, "MARSHES_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "marshes-won");
  const lost = find((state) => state.lost, "marshes-lost");
  return { ...(won ? { "marshes-won": won } : {}), ...(lost ? { "marshes-lost": lost } : {}) };
}
