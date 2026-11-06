// The Maestro fixtures of The Ghost of Framsburg (ered-mithrin part 7), written into src/campaign/fixtures/the-ghost-of-framsburg.json by scripts/e2e/fixtures.ts: real games of saved decklists (the Defenders of
// Gondor and Swords of the Noldor lists of data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `framsburg-won` is the first seed that wins, parked on the win (the Resolution waits); `framsburg-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it.
// TODO: say what the Campaign Setup and the Resolution ask, and which answers the saved decklists' policy gives them.
import type { CampaignLog } from "../../src/campaign/log.ts";
import type { StoredLoadout } from "../../src/campaign/save.ts";
import type { PlayerIntent, ScenarioState } from "../../src/rules/engine/reduce.ts";

import { NIGHT_GOLDENS, nightWorld, playGolden as playNight } from "../../test/scenarios/fire-in-the-night/game.ts";
import { rhovanionWonLog } from "./fire-in-the-night.ts";
import { nextIntent } from "../../test/harness/auto-player.ts";
import { createLog } from "../log.ts";
import { firstSeed, wonLog } from "./seed-kit.ts";

const say = createLog("e2e-framsburg");

export type FramsburgFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type FramsburgFixtureName = "framsburg-won" | "framsburg-lost";

// The log of a playthrough whose first 6 parts were won: the log of the parts before Fire in the Night (scripts/e2e/fire-in-the-night.ts), then the Fire in the Night golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function nightWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "Fire in the Night", goldens: NIGHT_GOLDENS, world: nightWorld, play: playNight }, await rhovanionWonLog());
}

export async function framsburgFixtures(): Promise<Partial<Record<FramsburgFixtureName, FramsburgFixture>>> {
  const log = await nightWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): FramsburgFixture | null => {
    // TODO: the scenario's own answers in place of the saved decklists' policy, when the scenario needs them (scripts/e2e/temple-of-the-deceived.ts is the pattern).
    const found = firstSeed(say, { campaignId: "ered-mithrin", scenarioId: "the-ghost-of-framsburg", seatCount: 2, log, answer: (state: ScenarioState, ctx: Parameters<typeof nextIntent>[1], memory: Set<string>) => nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory) }, "FRAMSBURG_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "framsburg-won");
  const lost = find((state) => state.lost, "framsburg-lost");
  return { ...(won ? { "framsburg-won": won } : {}), ...(lost ? { "framsburg-lost": lost } : {}) };
}
