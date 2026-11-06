// The Maestro fixtures of The Fate of Wilderland (ered-mithrin part 9), written into src/campaign/fixtures/the-fate-of-wilderland.json by scripts/e2e/fixtures.ts: real games of saved decklists (the Defenders of
// Gondor and Swords of the Noldor lists of data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `wilderland-won` is the first seed that wins, parked on the win (the Resolution waits); `wilderland-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it.
// TODO: say what the Campaign Setup and the Resolution ask, and which answers the saved decklists' policy gives them.
import type { CampaignLog } from "../../src/campaign/log.ts";
import type { StoredLoadout } from "../../src/campaign/save.ts";
import type { PlayerIntent, ScenarioState } from "../../src/rules/engine/reduce.ts";

import { GUNDABAD_GOLDENS, gundabadWorld, playGolden as playGundabad } from "../../test/scenarios/mount-gundabad/game.ts";
import { framsburgWonLog } from "./mount-gundabad.ts";
import { nextIntent } from "../../test/harness/auto-player.ts";
import { createLog } from "../log.ts";
import { firstSeed, wonLog } from "./seed-kit.ts";

const say = createLog("e2e-wilderland");

export type WilderlandFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type WilderlandFixtureName = "wilderland-won" | "wilderland-lost";

// The log of a playthrough whose first 8 parts were won: the log of the parts before Mount Gundabad (scripts/e2e/mount-gundabad.ts), then the Mount Gundabad golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function gundabadWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "Mount Gundabad", goldens: GUNDABAD_GOLDENS, world: gundabadWorld, play: playGundabad }, await framsburgWonLog());
}

export async function wilderlandFixtures(): Promise<Partial<Record<WilderlandFixtureName, WilderlandFixture>>> {
  const log = await gundabadWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): WilderlandFixture | null => {
    // TODO: the scenario's own answers in place of the saved decklists' policy, when the scenario needs them (scripts/e2e/temple-of-the-deceived.ts is the pattern).
    const found = firstSeed(say, { campaignId: "ered-mithrin", scenarioId: "the-fate-of-wilderland", seatCount: 2, log, answer: (state: ScenarioState, ctx: Parameters<typeof nextIntent>[1], memory: Set<string>) => nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory) }, "WILDERLAND_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "wilderland-won");
  const lost = find((state) => state.lost, "wilderland-lost");
  return { ...(won ? { "wilderland-won": won } : {}), ...(lost ? { "wilderland-lost": lost } : {}) };
}
