// The fixtures of Shadow and Flame (dwarrowdelf cycle part 9), written into src/campaign/fixtures/shadow-and-flame.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the fixture decks of scripts/e2e/seed-kit.ts), two-handed, Easy, so each is one open game. `flame-won` is the first seed that wins, parked on the win (the outcome screen is one tap away); `flame-lost` the first that loses,
// parked on the loss. A cycle has no log and no earlier part. A game not found in the seeds is left out.
// The saved decklists' policy answers the scenario's questions: the characters defend, the auto-player plays cards and uses each Action once, except Dark Pit's, which only the scenario's policy takes (test/scenarios/shadow-and-flame/game.ts, flameIntent): when the top cards of
// the deck it would discard cost more than the hit points Durin's Bane has left. The third hero of the first player stays out of the quest and attacks Durin's Bane with every ready character, which nothing is committed to while Dark Pit is the active location, and an enemy is engaged
// one each after the quest. Every other choice takes its first option.
import { flameIntent } from "../../../test/scenarios/shadow-and-flame/game.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-flame");

export const flameFixtures = async () => standaloneWonLost(say, "flame", { campaignId: "dwarrowdelf", scenarioId: "shadow-and-flame", seatCount: 2, answer: (state, ctx, memory) => flameIntent(state, ctx, memory, { choose: "first", cards: true }) }, "FLAME_SEEDS");
