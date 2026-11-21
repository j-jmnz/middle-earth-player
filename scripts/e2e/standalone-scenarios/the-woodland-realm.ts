// The save fixtures of The Woodland Realm (standalone-scenarios cycle part 11), written into src/campaign/fixtures/the-woodland-realm.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the One Deck and
// Defenders of Gondor lists of data/decks), two-handed, Easy, so each is one open game. `woodland-won` is the first seed that wins, parked on the win (the outcome screen is one tap away); `woodland-lost` the first that loses,
// parked on the loss. A cycle has no log and no earlier part. A game not found in the seeds is left out.
// The saved decklists are played with the auto-player's card play on; the scenario's own answers are the golden game's (test/scenarios/the-woodland-realm/game.ts): the engagements, the quest commitment (a seat with several
// heroes sends one to quest), the defenders, the attacks (the enemy that carries the resource first) and every choice, the first player's stage 2 and stage 3 cards included (the first option of each), never Mendor.
import { nextIntent } from "../../../test/harness/auto-player.ts";
import { woodlandIntent } from "../../../test/scenarios/the-woodland-realm/game.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-woodland");

export const woodlandFixtures = async () =>
  standaloneWonLost(
    say,
    "woodland",
    {
      campaignId: "standalone-scenarios",
      scenarioId: "the-woodland-realm",
      seatCount: 2,
      answer: (state, ctx, memory) => {
        const kind = state.window?.kind;
        const own = kind === "choose" || kind === "optionalEngage" || kind === "playerAttack" || kind === "defense" || (kind === "pass" && state.mode === "questCommit");
        return own ? woodlandIntent(state, ctx, memory) : nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory);
      },
    },
    "WOODLAND_SEEDS",
  );
