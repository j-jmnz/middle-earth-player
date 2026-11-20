// The save fixtures of The Mines of Moria (standalone-scenarios cycle part 12), written into src/campaign/fixtures/the-mines-of-moria.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the One Deck and
// Defenders of Gondor lists of data/decks), two-handed, Easy, so each is one open game. `mines-won` is the first seed that wins, parked on the win (the outcome screen is one tap away); `mines-lost` the first that loses,
// parked on the loss. A cycle has no log and no earlier part. A game not found in the seeds is left out.
import { nextIntent } from "../../../test/harness/auto-player.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-mines");

// The saved decklists' policy answers every question; the players travel to Chamber of Mazarbul when the stage 3 card lets them.
export const minesFixtures = async () => standaloneWonLost(say, "mines", { campaignId: "standalone-scenarios", scenarioId: "the-mines-of-moria", seatCount: 2, answer: (state, ctx, memory) => nextIntent(state, ctx, { scout: "", prefer: "51211", protect: "", play: true, act: true }, memory) }, "MINES_SEEDS");
