// The Maestro fixtures of Conflict at the Carrock (shadows-of-mirkwood cycle part 2), written into src/campaign/fixtures/conflict-at-the-carrock.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the One Deck and
// Defenders of Gondor lists of data/decks), two-handed, Easy, so each is one open game. `carrock-won` is the first seed that wins, parked on the win (the outcome screen is one tap away); `carrock-lost` the first that loses,
// parked on the loss. A cycle has no log and no earlier part. A game not found in the seeds is left out.
// The saved decklists' policy is the goldens' fighting one (test/scenarios/conflict-at-the-carrock/game.ts, carrockIntent) with the auto-player's card play and Responses: it engages Louis alone first, defends (the real heroes cannot take a Troll's damage undefended) and attacks one Troll
// with each ready hero, and takes the first option of a choice. A win needs all four unique Trolls defeated, which the real decklists did not manage in any of the first 300 seeds (nor of 600 with the heroes undefended), so `carrock-won` is open (STATUS); the seeds searched are CARROCK_SEEDS.
import { carrockIntent, DEFAULT_POLICY } from "../../../test/scenarios/conflict-at-the-carrock/game.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-carrock");

export const carrockFixtures = async () => standaloneWonLost(say, "carrock", { campaignId: "shadows-of-mirkwood", scenarioId: "conflict-at-the-carrock", seatCount: 2, answer: (state, ctx, memory) => carrockIntent(state, ctx, memory, { ...DEFAULT_POLICY, undefended: false }, { scout: "", prefer: "", protect: "", play: true, act: true }) }, "CARROCK_SEEDS");
