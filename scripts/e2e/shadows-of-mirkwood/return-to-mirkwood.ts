// The fixtures of Return to Mirkwood (shadows-of-mirkwood cycle part 6), written into src/campaign/fixtures/return-to-mirkwood.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the One Deck and
// Defenders of Gondor lists of data/decks), two-handed, Easy, so each is one open game. `returnmirkwood-won` is the first seed that wins, parked on the win (the outcome screen is one tap away); `returnmirkwood-lost` the first that loses,
// parked on the loss. A cycle has no log and no earlier part. A game not found in the seeds is left out.
// The saved decklists' policy is the goldens' one (test/scenarios/return-to-mirkwood/game.ts, returnmirkwoodIntent) with the auto-player's card play and Responses: one hero of a seat quests, the others stay ready to defend the guard, the seats engage and attack
// together, a choice takes the first option (surge in place of exhausting a hero, Gollum when a character is to be exhausted). The seeds searched are RETURNMIRKWOOD_SEEDS.
import { DEFAULT_POLICY, returnmirkwoodIntent } from "../../../test/scenarios/return-to-mirkwood/game.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-returnmirkwood");

export const returnmirkwoodFixtures = async () => standaloneWonLost(say, "returnmirkwood", { campaignId: "shadows-of-mirkwood", scenarioId: "return-to-mirkwood", seatCount: 2, answer: (state, ctx, memory) => returnmirkwoodIntent(state, ctx, memory, DEFAULT_POLICY, { scout: "", prefer: "", protect: "", play: true, act: true }) }, "RETURNMIRKWOOD_SEEDS");
