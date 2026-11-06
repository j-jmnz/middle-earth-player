// The Maestro fixtures of Fire in the Night (ered-mithrin part 6), written into src/campaign/fixtures/fire-in-the-night.json by scripts/e2e/fixtures.ts: real games of saved decklists (the Defenders of
// Gondor and Swords of the Noldor lists of data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `night-won` is the first seed that wins, parked on the win (the Resolution waits); `night-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it.
// TODO: say what the Campaign Setup and the Resolution ask, and which answers the saved decklists' policy gives them.
import type { CampaignLog } from "../../src/campaign/log.ts";
import type { StoredLoadout } from "../../src/campaign/save.ts";
import type { PlayerIntent, ScenarioState } from "../../src/rules/engine/reduce.ts";

import { RHOVANION_GOLDENS, rhovanionWorld, playGolden as playRhovanion } from "../../test/scenarios/roam-across-rhovanion/game.ts";
import { heathWonLog } from "./roam-across-rhovanion.ts";
import { nextIntent } from "../../test/harness/auto-player.ts";
import { createLog } from "../log.ts";
import { firstSeed, wonLog } from "./seed-kit.ts";

const say = createLog("e2e-night");

export type NightFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type NightFixtureName = "night-won" | "night-lost";

// The log of a playthrough whose first 5 parts were won: the log of the parts before Roam Across Rhovanion (scripts/e2e/roam-across-rhovanion.ts), then the Roam Across Rhovanion golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function rhovanionWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "Roam Across Rhovanion", goldens: RHOVANION_GOLDENS, world: rhovanionWorld, play: playRhovanion }, await heathWonLog());
}

export async function nightFixtures(): Promise<Partial<Record<NightFixtureName, NightFixture>>> {
  const log = await rhovanionWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): NightFixture | null => {
    // TODO: the scenario's own answers in place of the saved decklists' policy, when the scenario needs them (scripts/e2e/temple-of-the-deceived.ts is the pattern).
    const found = firstSeed(say, { campaignId: "ered-mithrin", scenarioId: "fire-in-the-night", seatCount: 2, log, answer: (state: ScenarioState, ctx: Parameters<typeof nextIntent>[1], memory: Set<string>) => nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory) }, "NIGHT_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "night-won");
  const lost = find((state) => state.lost, "night-lost");
  return { ...(won ? { "night-won": won } : {}), ...(lost ? { "night-lost": lost } : {}) };
}
