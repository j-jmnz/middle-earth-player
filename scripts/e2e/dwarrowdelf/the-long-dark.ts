// The Maestro fixtures of The Long Dark (dwarrowdelf cycle part 7), written into src/campaign/fixtures/the-long-dark.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the One Deck and
// Defenders of Gondor lists of data/decks), two-handed, Easy, so each is one open game. `dark-won` is the first seed that wins, parked on the win (the outcome screen is one tap away); `dark-lost` the first that loses,
// parked on the loss. A cycle has no log and no earlier part. A game not found in the seeds is left out.
// TODO: say which answers the saved decklists' policy gives the scenario's questions.
import { nextIntent } from "../../../test/harness/auto-player.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-dark");

// TODO: the scenario's own answers in place of the saved decklists' policy, when the scenario needs them (scripts/e2e/temple-of-the-deceived.ts is the pattern).
export const darkFixtures = async () => standaloneWonLost(say, "dark", { campaignId: "dwarrowdelf", scenarioId: "the-long-dark", seatCount: 2, answer: (state, ctx, memory) => nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory) }, "DARK_SEEDS");
