// The fixtures of Road to Rivendell (dwarrowdelf cycle part 5), written into src/campaign/fixtures/road-to-rivendell.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the One Deck and
// Defenders of Gondor lists of data/decks), two-handed, Easy, so each is one open game. `rivendell-won` is the first seed that wins, parked on the win (the outcome screen is one tap away); `rivendell-lost` the first that loses,
// parked on the loss. A cycle has no log and no earlier part. A game not found in the seeds is left out.
// The saved decklists' policy answers the scenario's questions: the auto-player plays cards and answers each Response it can pay for, takes the first option of every choice (Ruined Road: 2 progress) except Followed by Night,
// where it chooses the immediate attacks so Arwen takes no damage, and attacks; an enemy is engaged after the quest while a seat has fewer engaged than heroes, and a ready character attacks an engaged enemy (the auto-player alone never engages or attacks).
import { nextIntent } from "../../../test/harness/auto-player.ts";
import { engageOneEach } from "../../../test/harness/game-kit.ts";
import { legalIntents, legalTargets } from "../../../src/rules/engine/reduce.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-rivendell");

export const rivendellFixtures = async () =>
  standaloneWonLost(
    say,
    "rivendell",
    {
      campaignId: "dwarrowdelf",
      scenarioId: "road-to-rivendell",
      seatCount: 2,
      answer: (state, ctx, memory) => {
        if (state.window?.kind === "choose" && state.window.options.includes("attack") && state.window.options.includes("damage")) return { type: "Choose", optionId: "attack" };
        if (state.window?.kind === "playerAttack" && legalIntents(state, ctx).some((intent) => intent.type === "DeclareAttackers")) {
          for (const hero of state.seats[state.activeSeat]?.heroes ?? []) {
            const enemy = legalTargets(state, { type: "DeclareAttackers", cardId: hero }, ctx)[0];
            if (enemy) return { type: "DeclareAttackers", enemyId: enemy, attackerIds: [hero] };
          }
        }
        return engageOneEach(state, ctx) ?? nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory);
      },
    },
    "RIVENDELL_SEEDS",
  );
