// The Maestro fixtures of The Battle of Lake-town (standalone-scenarios cycle part 2), written into src/campaign/fixtures/the-battle-of-lake-town.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the One Deck and
// Defenders of Gondor lists of data/decks), two-handed, Easy, so each is one open game. `town-won` is the first seed that wins, parked on the win (the outcome screen is one tap away); `town-lost` the first that loses,
// parked on the loss. A cycle has no log and no earlier part. A game not found in the seeds is left out.
// TODO: say which answers the saved decklists' policy gives the scenario's questions.
import { nextIntent } from "../../test/harness/auto-player.ts";
import { createLog } from "../log.ts";
import { standaloneWonLost } from "./seed-kit.ts";

const say = createLog("e2e-town");

// TODO: the scenario's own answers in place of the saved decklists' policy, when the scenario needs them (scripts/e2e/temple-of-the-deceived.ts is the pattern).
export const townFixtures = async () => standaloneWonLost(say, "town", { campaignId: "standalone-scenarios", scenarioId: "the-battle-of-lake-town", seatCount: 2, answer: (state, ctx, memory) => nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory) }, "TOWN_SEEDS");
