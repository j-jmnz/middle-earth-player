// The Maestro fixtures of Helm's Deep (the-two-towers part 2), written into src/campaign/fixtures/helms-deep.json by scripts/e2e/fixtures.ts: real games of saved decklists (the Defenders of
// Gondor and Swords of the Noldor lists of data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `deep-won` is the first seed that wins, parked on the win (the Resolution waits); `deep-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it.
// TODO: say what the Campaign Setup and the Resolution ask, and which answers the saved decklists' policy gives them.
import type { CampaignLog } from "../../src/campaign/log.ts";
import type { StoredLoadout } from "../../src/campaign/save.ts";
import type { PlayerIntent, ScenarioState } from "../../src/rules/engine/reduce.ts";

import { HAI_GOLDENS, haiWorld, playGolden as playHai } from "../../test/scenarios/the-uruk-hai/game.ts";
import { nextIntent } from "../../test/harness/auto-player.ts";
import { createLog } from "../log.ts";
import { firstSeed, wonLog } from "./seed-kit.ts";

const say = createLog("e2e-deep");

export type DeepFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type DeepFixtureName = "deep-won" | "deep-lost";

// The log of a playthrough whose first 1 part was won: the The Uruk-hai golden's two-handed win, resolved onto a blank log, their heroes and what hangs on them left out.
export async function haiWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "The Uruk-hai", goldens: HAI_GOLDENS, world: haiWorld, play: playHai });
}

export async function deepFixtures(): Promise<Partial<Record<DeepFixtureName, DeepFixture>>> {
  const log = await haiWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): DeepFixture | null => {
    // TODO: the scenario's own answers in place of the saved decklists' policy, when the scenario needs them (scripts/e2e/temple-of-the-deceived.ts is the pattern).
    const found = firstSeed(say, { campaignId: "the-two-towers", scenarioId: "helms-deep", seatCount: 2, log, answer: (state: ScenarioState, ctx: Parameters<typeof nextIntent>[1], memory: Set<string>) => nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory) }, "DEEP_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "deep-won");
  const lost = find((state) => state.lost, "deep-lost");
  return { ...(won ? { "deep-won": won } : {}), ...(lost ? { "deep-lost": lost } : {}) };
}
