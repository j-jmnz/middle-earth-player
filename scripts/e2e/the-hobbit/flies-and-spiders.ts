// The save fixtures of Flies and Spiders (the-hobbit cycle part 4), written into src/campaign/fixtures/flies-and-spiders.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the fixture decks of scripts/e2e/seed-kit.ts), two-handed, Easy, so each is one open game. `spiders-lost` is the first seed that loses,
// parked on the loss. A cycle has no log and no earlier part. There is no won fixture: the registry names none, so `standaloneWonLost` plays for none (docs/architecture.md, Tests).
// The saved decklists' policy answers the scenario's questions: the Setup's choice of a copy of Bilbo's Magic Ring (132067:A:1) and every other choice take their first option, and the policy plays and uses every card it can.
import { nextIntent } from "../../../test/harness/auto-player.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-spiders");

// The scenario needs no answers of its own in place of that policy: a game of it is lost by threat or by Bilbo leaving play whatever the policy answers.
export const spidersFixtures = async () => standaloneWonLost(say, "spiders", { campaignId: "the-hobbit", scenarioId: "flies-and-spiders", seatCount: 2, answer: (state, ctx, memory) => nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory) }, "SPIDERS_SEEDS");
