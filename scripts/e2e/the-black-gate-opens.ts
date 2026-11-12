// The Maestro fixtures of The Black Gate Opens (the-return-of-the-king part 5), written into src/campaign/fixtures/the-black-gate-opens.json by scripts/e2e/fixtures.ts: real games of saved decklists (the Defenders of
// Gondor and Swords of the Noldor lists of data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `opens-won` is the first seed that wins, parked on the win (the Resolution waits); `opens-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it.
// TODO: say what the Campaign Setup and the Resolution ask, and which answers the saved decklists' policy gives them.
import type { CampaignLog } from "../../src/campaign/log.ts";
import type { StoredLoadout } from "../../src/campaign/save.ts";
import type { PlayerIntent, ScenarioState } from "../../src/rules/engine/reduce.ts";

import { UNGOL_GOLDENS, ungolWorld, playGolden as playUngol } from "../../test/scenarios/the-tower-of-cirith-ungol/game.ts";
import { fieldsWonLog } from "./the-tower-of-cirith-ungol.ts";
import { nextIntent } from "../../test/harness/auto-player.ts";
import { createLog } from "../log.ts";
import { firstSeed, wonLog } from "./seed-kit.ts";

const say = createLog("e2e-opens");

export type OpensFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type OpensFixtureName = "opens-won" | "opens-lost";

// The log of a playthrough whose first 4 parts were won: the log of the parts before The Tower of Cirith Ungol (scripts/e2e/the-tower-of-cirith-ungol.ts), then the The Tower of Cirith Ungol golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function ungolWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "The Tower of Cirith Ungol", goldens: UNGOL_GOLDENS, world: ungolWorld, play: playUngol }, await fieldsWonLog());
}

export async function opensFixtures(): Promise<Partial<Record<OpensFixtureName, OpensFixture>>> {
  const log = await ungolWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): OpensFixture | null => {
    // TODO: the scenario's own answers in place of the saved decklists' policy, when the scenario needs them (scripts/e2e/temple-of-the-deceived.ts is the pattern).
    const found = firstSeed(say, { campaignId: "the-return-of-the-king", scenarioId: "the-black-gate-opens", seatCount: 2, log, answer: (state: ScenarioState, ctx: Parameters<typeof nextIntent>[1], memory: Set<string>) => nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory) }, "OPENS_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "opens-won");
  const lost = find((state) => state.lost, "opens-lost");
  return { ...(won ? { "opens-won": won } : {}), ...(lost ? { "opens-lost": lost } : {}) };
}
