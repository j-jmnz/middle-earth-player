// The Maestro fixtures of Journey to the Cross-roads (the-two-towers part 5), written into src/campaign/fixtures/journey-to-the-cross-roads.json by scripts/e2e/fixtures.ts: real games of saved decklists (the Defenders of
// Gondor and Swords of the Noldor lists of data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `roads-won` is the first seed that wins, parked on the win (the Resolution waits); `roads-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it.
// TODO: say what the Campaign Setup and the Resolution ask, and which answers the saved decklists' policy gives them.
import type { CampaignLog } from "../../src/campaign/log.ts";
import type { StoredLoadout } from "../../src/campaign/save.ts";
import type { PlayerIntent, ScenarioState } from "../../src/rules/engine/reduce.ts";

import { MARSHES_GOLDENS, marshesWorld, playGolden as playMarshes } from "../../test/scenarios/the-passage-of-the-marshes/game.ts";
import { isengardWonLog } from "./the-passage-of-the-marshes.ts";
import { nextIntent } from "../../test/harness/auto-player.ts";
import { createLog } from "../log.ts";
import { firstSeed, wonLog } from "./seed-kit.ts";

const say = createLog("e2e-roads");

export type RoadsFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type RoadsFixtureName = "roads-won" | "roads-lost";

// The log of a playthrough whose first 4 parts were won: the log of the parts before The Passage of the Marshes (scripts/e2e/the-passage-of-the-marshes.ts), then the The Passage of the Marshes golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function marshesWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "The Passage of the Marshes", goldens: MARSHES_GOLDENS, world: marshesWorld, play: playMarshes }, await isengardWonLog());
}

export async function roadsFixtures(): Promise<Partial<Record<RoadsFixtureName, RoadsFixture>>> {
  const log = await marshesWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): RoadsFixture | null => {
    // TODO: the scenario's own answers in place of the saved decklists' policy, when the scenario needs them (scripts/e2e/temple-of-the-deceived.ts is the pattern).
    const found = firstSeed(say, { campaignId: "the-two-towers", scenarioId: "journey-to-the-cross-roads", seatCount: 2, log, answer: (state: ScenarioState, ctx: Parameters<typeof nextIntent>[1], memory: Set<string>) => nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory) }, "ROADS_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "roads-won");
  const lost = find((state) => state.lost, "roads-lost");
  return { ...(won ? { "roads-won": won } : {}), ...(lost ? { "roads-lost": lost } : {}) };
}
