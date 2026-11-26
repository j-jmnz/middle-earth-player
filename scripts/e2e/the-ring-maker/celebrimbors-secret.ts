// The save fixtures of Celebrimbor's Secret (the-ring-maker cycle part 8), written into src/campaign/fixtures/celebrimbors-secret.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the fixture decks of scripts/e2e/seed-kit.ts), two-handed, Easy, so each is one open game. `secret-lost` is the first seed that loses,
// parked on the loss. A cycle has no log and no earlier part. There is no won fixture: the registry names none, so `standaloneWonLost` plays for none (docs/architecture.md, Tests).
// The saved decklists play with the scenario's own answers (test/scenarios/celebrimbors-secret/game.ts: one hero stays home to attack, Bellach is engaged by choice) and the auto-player's card play; the first seed that loses is parked on the loss.
import { DEFAULT_POLICY, SECRET_POLICY, secretIntent } from "../../../test/scenarios/celebrimbors-secret/game.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-secret");

export const secretFixtures = async () => standaloneWonLost(say, "secret", { campaignId: "the-ring-maker", scenarioId: "celebrimbors-secret", seatCount: 2, answer: (state, ctx, memory) => secretIntent(state, ctx, memory, DEFAULT_POLICY, { ...SECRET_POLICY, play: true, act: true }) }, "SECRET_SEEDS");
