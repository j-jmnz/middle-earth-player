// The save fixtures of Attack on Dol Guldur (standalone-scenarios cycle part 9), written into src/campaign/fixtures/attack-on-dol-guldur.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the One Deck and
// Defenders of Gondor lists of data/decks), two-handed, Easy, so each is one open game. `guldur-won` is the first seed that wins, parked on the win (the outcome screen is one tap away); `guldur-lost` the first that loses,
// parked on the loss. A cycle has no log and no earlier part. A game not found in the seeds is left out.
// TODO: say which answers the saved decklists' policy gives the scenario's questions.
import { nextIntent } from "../../../test/harness/auto-player.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-guldur");

// TODO: the scenario's own answers in place of the saved decklists' policy, when the scenario needs them (scripts/e2e/temple-of-the-deceived.ts is the pattern).
export const guldurFixtures = async () => standaloneWonLost(say, "guldur", { campaignId: "standalone-scenarios", scenarioId: "attack-on-dol-guldur", seatCount: 2, answer: (state, ctx, memory) => nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory) }, "GULDUR_SEEDS");
