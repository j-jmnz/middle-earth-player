// The save fixtures of Over the Misty Mountains Grim (the-hobbit cycle part 2), written into src/campaign/fixtures/over-the-misty-mountains-grim.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the fixture decks of scripts/e2e/seed-kit.ts), two-handed, Easy, so each is one open game. `grim-lost` is the first seed that loses,
// parked on the loss. A cycle has no log and no earlier part. There is no won fixture: the registry names none, so `standaloneWonLost` plays for none (docs/architecture.md, Tests).
// The saved decklists are played by the plain auto-player (`nextIntent`, which plays cards and uses actions and answers every choice as it does in any scenario); Bilbo Baggins is dealt in front of the first seat by the loadout.
import { nextIntent } from "../../../test/harness/auto-player.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-grim");

export const grimFixtures = async () => standaloneWonLost(say, "grim", { campaignId: "the-hobbit", scenarioId: "over-the-misty-mountains-grim", seatCount: 2, answer: (state, ctx, memory) => nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory) }, "GRIM_SEEDS");
