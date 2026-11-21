// The save fixtures of Attack on Dol Guldur (standalone-scenarios cycle part 9), written into src/campaign/fixtures/attack-on-dol-guldur.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the One Deck and
// Defenders of Gondor lists of data/decks), two-handed, Easy, so each is one open game. `guldur-won` is the first seed that wins, parked on the win (the outcome screen is one tap away); `guldur-lost` the first that loses,
// parked on the loss. A cycle has no log and no earlier part. A game not found in the seeds is left out.
// The answers are the goldens' (test/scenarios/attack-on-dol-guldur/game.ts) with the decklists' cards played: the players engage and attack the enemies with the most Siege value, the Lieutenant last.
import { DEFAULT_POLICY, GULDUR_POLICY, guldurIntent } from "../../../test/scenarios/attack-on-dol-guldur/game.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-guldur");

export const guldurFixtures = async () => standaloneWonLost(say, "guldur", { campaignId: "standalone-scenarios", scenarioId: "attack-on-dol-guldur", seatCount: 2, answer: (state, ctx, memory) => guldurIntent(state, ctx, memory, DEFAULT_POLICY, { ...GULDUR_POLICY, play: true }) }, "GULDUR_SEEDS");
