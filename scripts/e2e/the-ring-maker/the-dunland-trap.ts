// The save fixtures of The Dunland Trap (the-ring-maker cycle part 4), written into src/campaign/fixtures/the-dunland-trap.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the fixture decks of scripts/e2e/seed-kit.ts), two-handed, Easy, so each is one open game. `trap-lost` is the first seed that loses,
// parked on the loss. A cycle has no log and no earlier part. There is no won fixture: the registry names none, so `standaloneWonLost` plays for none (docs/architecture.md, Tests).
// TODO: say which answers the saved decklists' policy gives the scenario's questions.
import { nextIntent } from "../../../test/harness/auto-player.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-trap");

// TODO: the scenario's own answers in place of the saved decklists' policy, when the scenario needs them (scripts/e2e/temple-of-the-deceived.ts is the pattern).
export const trapFixtures = async () => standaloneWonLost(say, "trap", { campaignId: "the-ring-maker", scenarioId: "the-dunland-trap", seatCount: 2, answer: (state, ctx, memory) => nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory) }, "TRAP_SEEDS");
