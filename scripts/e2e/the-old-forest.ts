// The Maestro fixtures of The Old Forest (standalone-scenarios cycle part 4), written into src/campaign/fixtures/the-old-forest.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the One Deck and
// Defenders of Gondor lists of data/decks), two-handed, Easy, so each is one open game. `forest-won` is the first seed that wins, parked on the win (the outcome screen is one tap away); `forest-lost` the first that loses,
// parked on the loss. A cycle has no log and no earlier part. A game not found in the seeds is left out: no seed of the first 100 wins, so `forest-won` is open. The saved decklists' policy answers the scenario's questions with the first option.
import { nextIntent } from "../../test/harness/auto-player.ts";
import { createLog } from "../log.ts";
import { standaloneWonLost } from "./seed-kit.ts";

const say = createLog("e2e-forest");

export const forestFixtures = async () => standaloneWonLost(say, "forest", { campaignId: "standalone-scenarios", scenarioId: "the-old-forest", seatCount: 2, answer: (state, ctx, memory) => nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory) }, "FOREST_SEEDS");
