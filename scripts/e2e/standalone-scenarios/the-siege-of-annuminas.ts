// The save fixtures of The Siege of Annúminas (standalone-scenarios cycle part 8), written into src/campaign/fixtures/the-siege-of-annuminas.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the One Deck and
// Defenders of Gondor lists of data/decks), two-handed, Easy, so each is one open game. `annuminas-won` is the first seed that wins, parked on the win (the outcome screen is one tap away); `annuminas-lost` the first that loses,
// parked on the loss. A cycle has no log and no earlier part. A game not found in the seeds is left out.
// The answers are the goldens' (test/scenarios/the-siege-of-annuminas/game.ts) with the decklists' cards played: the players engage and attack, the Lieutenant of Angmar first.
import { ANNUMINAS_POLICY, annuminasIntent, DEFAULT_POLICY } from "../../../test/scenarios/the-siege-of-annuminas/game.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-annuminas");

export const annuminasFixtures = async () => standaloneWonLost(say, "annuminas", { campaignId: "standalone-scenarios", scenarioId: "the-siege-of-annuminas", seatCount: 2, answer: (state, ctx, memory) => annuminasIntent(state, ctx, memory, DEFAULT_POLICY, { ...ANNUMINAS_POLICY, play: true }) }, "ANNUMINAS_SEEDS");
