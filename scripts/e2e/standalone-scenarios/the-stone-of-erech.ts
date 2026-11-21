// The save fixtures of The Stone of Erech (standalone-scenarios cycle part 3), written into src/campaign/fixtures/the-stone-of-erech.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the One Deck and
// Defenders of Gondor lists of data/decks), two-handed, Easy, so each is one open game. `erech-won` is the first seed that wins, parked on the win (the outcome screen is one tap away); `erech-lost` the first that loses,
// parked on the loss. A cycle has no log and no earlier part. A game not found in the seeds is left out.
// The saved decklists are played with the auto-player's card play on; every choice the scenario asks (stage 2B's, Tarlang's Neck's and Groping Horror's) takes its first option.
import { nextIntent } from "../../../test/harness/auto-player.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-erech");

export const erechFixtures = async () =>
  standaloneWonLost(
    say,
    "erech",
    {
      campaignId: "standalone-scenarios",
      scenarioId: "the-stone-of-erech",
      seatCount: 2,
      answer: (state, ctx, memory) => (state.window?.kind === "choose" ? { type: "Choose", optionId: state.window.options[0] ?? "" } : nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory)),
    },
    "ERECH_SEEDS",
  );
