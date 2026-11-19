// The save fixtures of The Battle of Lake-town (standalone-scenarios cycle part 2), written into src/campaign/fixtures/the-battle-of-lake-town.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the One Deck and
// Defenders of Gondor lists of data/decks), two-handed, Easy, so each is one open game. `town-won` is the first seed that wins, parked on the win (the outcome screen is one tap away); `town-lost` the first that loses,
// parked on the loss. A cycle has no log and no earlier part. A game not found in the seeds is left out.
// The saved decklists are played with the auto-player's card play on; the scenario's own answers are the golden game's (test/scenarios/the-battle-of-lake-town/game.ts): Smaug comes into the play area, a hero takes the Burn damage, the
// first character quests alone and the others defend and attack Smaug.
import { nextIntent } from "../../../test/harness/auto-player.ts";
import { townIntent } from "../../../test/scenarios/the-battle-of-lake-town/game.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-town");

export const townFixtures = async () =>
  standaloneWonLost(
    say,
    "town",
    {
      campaignId: "standalone-scenarios",
      scenarioId: "the-battle-of-lake-town",
      seatCount: 2,
      answer: (state, ctx, memory) => {
        const own = state.window?.kind === "choose" || state.window?.kind === "playerAttack" || (state.window?.kind === "pass" && state.mode === "questCommit");
        return own ? townIntent(state, ctx, memory) : nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory);
      },
    },
    "TOWN_SEEDS",
  );
