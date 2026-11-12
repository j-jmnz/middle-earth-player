// The Maestro fixtures of Mount Doom (the-return-of-the-king part 6), written into src/campaign/fixtures/mount-doom.json by scripts/e2e/fixtures.ts: real games of saved decklists (the-one-deck and
// defenders-of-gondor of data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `doom-won` is the first seed that wins, parked on the win (the Resolution waits); `doom-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it.
// The Campaign Setup asks nothing (the tokens The Black Gate recorded are placed on the campaign card, 146079:A:1); the Resolution asks the first player to keep or destroy The One Ring (146079:B:1), which the saved decklists' policy answers with its first
// option, keeping it (the players lose the campaign), when the game goes on to answer it; a fixture is parked before that answer. Under Dire a threat of 99 eliminates a player, so a game of real decklists may be lost on threat, on the timer or on the last Fortitude test.
import type { CampaignLog } from "../../src/campaign/log.ts";
import type { StoredLoadout } from "../../src/campaign/save.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../src/rules/engine/reduce.ts";

import { OPENS_GOLDENS, opensWorld, playGolden as playOpens } from "../../test/scenarios/the-black-gate-opens/game.ts";
import { ungolWonLog } from "./the-black-gate-opens.ts";
import { DEFAULT_POLICY, DOOM_POLICY, doomIntent } from "../../test/scenarios/mount-doom/game.ts";
import { createLog } from "../log.ts";
import { firstSeed, FIXTURE_DECKS, prebuiltDeck, wonLog } from "./seed-kit.ts";

const say = createLog("e2e-doom");
// The saga Frodo (141001, Fellowship sphere, Ring-bearer) is the first seat's Ring-bearer with The One Ring (mec113.setting-up-the-game), beside the first saved deck's heroes.
const FRODO = "141001";
const loadout: StoredLoadout = { scenarioId: "mount-doom", difficulty: "Easy", seats: FIXTURE_DECKS.map((id) => ({ deckId: id, ...prebuiltDeck(id) })), ringBearer: FRODO, choices: [], acceptPenalty: false };

export type DoomFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type DoomFixtureName = "doom-won" | "doom-lost";

// The log of a playthrough whose first 5 parts were won: the log of the parts before The Black Gate Opens (scripts/e2e/the-black-gate-opens.ts), then the The Black Gate Opens golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function opensWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "The Black Gate Opens", golden: "two-handed, ended, Normal, after the earlier parts, Gwaihir held by the first player", goldens: OPENS_GOLDENS, world: opensWorld, play: playOpens, scenarioId: "the-black-gate-opens" }, await ungolWonLog());
}

export async function doomFixtures(): Promise<Partial<Record<DoomFixtureName, DoomFixture>>> {
  const log = await opensWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): DoomFixture | null => {
    const found = firstSeed(say, { campaignId: "the-return-of-the-king", scenarioId: "mount-doom", seatCount: 2, log, loadout, codes: [FRODO], answer: (state: ScenarioState, ctx: ReduceContext, memory: Set<string>) => doomIntent(state, ctx, memory, DEFAULT_POLICY, { ...DOOM_POLICY, play: true, act: true }) }, "DOOM_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "doom-won");
  const lost = find((state) => state.lost, "doom-lost");
  return { ...(won ? { "doom-won": won } : {}), ...(lost ? { "doom-lost": lost } : {}) };
}
