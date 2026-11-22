// The save fixtures of Fog on the Barrow-downs (standalone-scenarios cycle part 5), written into src/campaign/fixtures/fog-on-the-barrow-downs.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the One Deck and
// Defenders of Gondor lists of data/decks), two-handed, Easy, so each is one open game. `downs-won` is the first seed that wins, parked on the win (the outcome screen is one tap away); `downs-lost` the first that loses,
// parked on the loss. A cycle has no log and no earlier part. A game not found in the seeds is left out: no seed of the first 500 wins, so `downs-won` is not committed. The saved decklists' policy answers the scenario's questions with the first option.
import { nextIntent } from "../../../test/harness/auto-player.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-downs");

export const downsFixtures = async () => standaloneWonLost(say, "downs", { campaignId: "standalone-scenarios", scenarioId: "fog-on-the-barrow-downs", seatCount: 2, answer: (state, ctx, memory) => nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory) }, "DOWNS_SEEDS");
