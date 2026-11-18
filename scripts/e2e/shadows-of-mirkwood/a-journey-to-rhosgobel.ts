// The fixtures of A Journey to Rhosgobel (shadows-of-mirkwood cycle part 3), written into src/campaign/fixtures/a-journey-to-rhosgobel.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the One Deck and
// Defenders of Gondor lists of data/decks), two-handed, Easy, so each is one open game. `rhosgobel-won` is the first seed that wins, parked on the win (the outcome screen is one tap away); `rhosgobel-lost` the first that loses,
// parked on the loss. A cycle has no log and no earlier part. A game not found in the seeds is left out.
// The saved decklists' policy is the goldens' one (test/scenarios/a-journey-to-rhosgobel/game.ts, rhosgobelIntent) with the auto-player's card play and Responses: every character quests, each seat engages every enemy it may and attacks together, a defender takes every
// attack he can, Radagast's Request is never used (it costs Wilyador damage) and a choice takes the first option, Athelas when it is offered. The seeds searched are RHOSGOBEL_SEEDS.
import { DEFAULT_POLICY, rhosgobelIntent } from "../../../test/scenarios/a-journey-to-rhosgobel/game.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-rhosgobel");

export const rhosgobelFixtures = async () => standaloneWonLost(say, "rhosgobel", { campaignId: "shadows-of-mirkwood", scenarioId: "a-journey-to-rhosgobel", seatCount: 2, answer: (state, ctx, memory) => rhosgobelIntent(state, ctx, memory, DEFAULT_POLICY, { scout: "", prefer: "", protect: "", play: true, act: true }) }, "RHOSGOBEL_SEEDS");
