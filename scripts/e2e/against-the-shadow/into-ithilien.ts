// The save fixtures of Into Ithilien (against-the-shadow cycle part 2), written into src/campaign/fixtures/into-ithilien.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the fixture decks of scripts/e2e/seed-kit.ts), two-handed, Easy, so each is one open game. `ithilien-lost` is the first seed that loses,
// parked on the loss. A cycle has no log and no earlier part. There is no won fixture: the registry names none, so `standaloneWonLost` plays for none (docs/architecture.md, Tests).
// The saved decklists' policy answers the scenario's questions: the auto-player plays cards and answers each Response it can pay for, takes the first option of every choice, archery damage follows `archeryAnswer` (test/scenarios/into-ithilien/game.ts): a character other than Celador and the Ithilien Guardians,
// an enemy is engaged after the quest while a seat has fewer engaged than heroes, and a ready character attacks (the auto-player alone never engages or attacks).
import { archeryAnswer } from "../../../test/scenarios/into-ithilien/game.ts";
import { nextIntent } from "../../../test/harness/auto-player.ts";
import { attackTogether, engageOneEach } from "../../../test/harness/game-kit.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-ithilien");

export const ithilienFixtures = async () =>
  standaloneWonLost(
    say,
    "ithilien",
    {
      campaignId: "against-the-shadow",
      scenarioId: "into-ithilien",
      seatCount: 2,
      answer: (state, ctx, memory) => {
        const archery = archeryAnswer(state, ctx);
        if (archery) return archery;
        return attackTogether(state, ctx) ?? engageOneEach(state, ctx) ?? nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory);
      },
    },
    "ITHILIEN_SEEDS",
  );
