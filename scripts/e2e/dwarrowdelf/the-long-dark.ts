// The fixtures of The Long Dark (dwarrowdelf cycle part 7), written into src/campaign/fixtures/the-long-dark.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the fixture decks of scripts/e2e/seed-kit.ts), two-handed, Easy, so each is one open game. `dark-won` is the first seed that wins, parked on the win (the outcome screen is one tap away); `dark-lost` the first that loses,
// parked on the loss. A cycle has no log and no earlier part. A game not found in the seeds is left out.
// The saved decklists' policy answers the scenario's questions: the auto-player plays cards and answers each Response it can pay for, a locate test discards a hand card while more than 2 are left and then stops (a PASS card ends it sooner), the Lost effects and
// every other choice take their first option, and an enemy is engaged after the quest while a seat has fewer engaged than heroes, a ready character attacking an engaged enemy (the auto-player alone never engages or attacks).
import { nextIntent } from "../../../test/harness/auto-player.ts";
import { engageOneEach } from "../../../test/harness/game-kit.ts";
import { legalIntents, legalTargets } from "../../../src/rules/engine/reduce.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-dark");

export const darkFixtures = async () =>
  standaloneWonLost(
    say,
    "dark",
    {
      campaignId: "dwarrowdelf",
      scenarioId: "the-long-dark",
      seatCount: 2,
      answer: (state, ctx, memory) => {
        if (state.window?.kind === "choose" && state.window.options.includes("stop")) {
          const hand = state.window.options.filter((option) => option !== "stop");
          return { type: "Choose", optionId: hand.length > 2 ? (hand[0] ?? "stop") : "stop" };
        }
        if (state.window?.kind === "playerAttack" && legalIntents(state, ctx).some((intent) => intent.type === "DeclareAttackers")) {
          for (const hero of state.seats[state.activeSeat]?.heroes ?? []) {
            const enemy = legalTargets(state, { type: "DeclareAttackers", cardId: hero }, ctx)[0];
            if (enemy) return { type: "DeclareAttackers", enemyId: enemy, attackerIds: [hero] };
          }
        }
        return engageOneEach(state, ctx) ?? nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory);
      },
    },
    "DARK_SEEDS",
  );
