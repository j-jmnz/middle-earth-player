// The fixtures of The Hunt for Gollum (shadows-of-mirkwood cycle part 1), written into src/campaign/fixtures/the-hunt-for-gollum.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the One Deck and
// Defenders of Gondor lists of data/decks), two-handed, Easy, so each is one open game. `gollum-won` is the first seed that wins, parked on the win (the outcome screen is one tap away); `gollum-lost` the first that loses,
// parked on the loss. A cycle has no log and no earlier part. A game not found in the seeds is left out. `gollum-won` is rare for the auto-player on real decklists (seed 520); `gollum-lost` is seed 1.
// The saved decklists' policy answers the scenario's questions: the auto-player plays cards and answers each Response it can pay for (it claims a Signs of Gollum after a successful quest), and takes the first option of a choice.
import { nextIntent } from "../../../test/harness/auto-player.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-gollum");

export const gollumFixtures = async () => standaloneWonLost(say, "gollum", { campaignId: "shadows-of-mirkwood", scenarioId: "the-hunt-for-gollum", seatCount: 2, answer: (state, ctx, memory) => nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory) }, "GOLLUM_SEEDS");
