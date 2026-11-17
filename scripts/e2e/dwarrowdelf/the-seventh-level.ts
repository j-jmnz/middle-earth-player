// The Maestro fixtures of The Seventh Level (dwarrowdelf cycle part 2), written into src/campaign/fixtures/the-seventh-level.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the One Deck and
// Defenders of Gondor lists of data/decks), two-handed, Easy, so each is one open game. `level-won` is the first seed that wins, parked on the win (the outcome screen is one tap away); `level-lost` the first that loses,
// parked on the loss. A cycle has no log and no earlier part. A game not found in the seeds is left out.
// TODO: say which answers the saved decklists' policy gives the scenario's questions.
import { nextIntent } from "../../../test/harness/auto-player.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-level");

// TODO: the scenario's own answers in place of the saved decklists' policy, when the scenario needs them (scripts/e2e/temple-of-the-deceived.ts is the pattern).
export const levelFixtures = async () => standaloneWonLost(say, "level", { campaignId: "dwarrowdelf", scenarioId: "the-seventh-level", seatCount: 2, answer: (state, ctx, memory) => nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory) }, "LEVEL_SEEDS");
