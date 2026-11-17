// The Maestro fixtures of Into the Pit (dwarrowdelf cycle part 1), written into src/campaign/fixtures/into-the-pit.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the One Deck and
// Defenders of Gondor lists of data/decks), two-handed, Easy, so each is one open game. `pit-won` is the first seed that wins, parked on the win (the outcome screen is one tap away); `pit-lost` the first that loses,
// parked on the loss. A cycle has no log and no earlier part. A game not found in the seeds is left out.
// TODO: say which answers the saved decklists' policy gives the scenario's questions.
import { nextIntent } from "../../../test/harness/auto-player.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-pit");

// TODO: the scenario's own answers in place of the saved decklists' policy, when the scenario needs them (scripts/e2e/temple-of-the-deceived.ts is the pattern).
export const pitFixtures = async () => standaloneWonLost(say, "pit", { campaignId: "dwarrowdelf", scenarioId: "into-the-pit", seatCount: 2, answer: (state, ctx, memory) => nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory) }, "PIT_SEEDS");
