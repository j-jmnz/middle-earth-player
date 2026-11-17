// The Maestro fixtures of The Massing at Osgiliath (standalone-scenarios cycle part 1), written into src/campaign/fixtures/the-massing-at-osgiliath.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the One Deck and
// Defenders of Gondor lists of data/decks), two-handed, Easy, so each is one open game. `osgiliath-won` is the first seed that wins, parked on the win (the outcome screen is one tap away); `osgiliath-lost` the first that loses,
// parked on the loss. A cycle has no log and no earlier part. A game not found in the seeds is left out.
// The saved decklists are played with the auto-player's card play on; every choice the scenario asks (the Witch-king's, Cut Off's, the Ranger's and Anduin Crossing's) takes its first option.
import { nextIntent } from "../../../test/harness/auto-player.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-osgiliath");

export const osgiliathFixtures = async () =>
  standaloneWonLost(
    say,
    "osgiliath",
    {
      campaignId: "standalone-scenarios",
      scenarioId: "the-massing-at-osgiliath",
      seatCount: 2,
      answer: (state, ctx, memory) => (state.window?.kind === "choose" ? { type: "Choose", optionId: state.window.options[0] ?? "" } : nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory)),
    },
    "OSGILIATH_SEEDS",
  );
