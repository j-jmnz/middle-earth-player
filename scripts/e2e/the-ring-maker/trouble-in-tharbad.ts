// The save fixtures of Trouble in Tharbad (the-ring-maker cycle part 6), written into src/campaign/fixtures/trouble-in-tharbad.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the fixture decks of scripts/e2e/seed-kit.ts), two-handed, Easy, so each is one open game. `tharbad-lost` is the first seed that loses,
// parked on the loss. A cycle has no log and no earlier part. There is no won fixture: the registry names none, so `standaloneWonLost` plays for none (docs/architecture.md, Tests).
// The saved decklists play with the auto-player's own answers (a Choose takes its first option, no hero is kept home to defend Nalir), which the scenario's questions do not need changed: the first seed that loses (threat, or Nalir leaving play) is parked on the loss.
import { nextIntent } from "../../../test/harness/auto-player.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-tharbad");

export const tharbadFixtures = async () => standaloneWonLost(say, "tharbad", { campaignId: "the-ring-maker", scenarioId: "trouble-in-tharbad", seatCount: 2, answer: (state, ctx, memory) => nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory) }, "THARBAD_SEEDS");
