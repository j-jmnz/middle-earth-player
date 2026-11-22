// The fixtures of The Drowned Ruins (dream-chaser part 7), written into src/campaign/fixtures/the-drowned-ruins.json by scripts/e2e/fixtures.ts: real games of saved decklists (The One Deck and the Defenders of Gondor lists of data/decks/test-decks.json and data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `ruins-won` is the first seed that wins, parked on the win (the Resolution waits); `ruins-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it.
// The Campaign Setup asks which Command copy each player takes and which player takes the Círdan's Blessing (each seat is asked in turn until one does; neither player takes one here: "skip"), and the game asks the damage-for-threat question, which the policy answers
// with its first option; the Resolution asks nothing (the copies chosen join the pool). `ruins-won` and `ruins-lost`, real-decklist games, are open when the seeds hold none (GitHub issue #188).
import type { CampaignLog } from "../../src/campaign/log.ts";
import type { StoredLoadout } from "../../src/campaign/save.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../src/rules/engine/reduce.ts";

import { TEMPLE_GOLDENS, templeWorld, playGolden as playTemple } from "../../test/scenarios/temple-of-the-deceived/game.ts";
import { ruinsTravel } from "../../test/scenarios/the-drowned-ruins/game.ts";
import { depthsWonLog } from "./temple-of-the-deceived.ts";
import { intentFor } from "./raid-on-the-grey-havens.ts";
import { createLog } from "../log.ts";
import { DREAM_CHASER, firstSeed, wonLog } from "./seed-kit.ts";

const say = createLog("e2e-ruins");
const ELITE: readonly string[] = ["11077", "11079"];

export type RuinsFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type RuinsFixtureName = "ruins-won" | "ruins-lost";

// The log of a playthrough whose first 6 parts were won: the log of the parts before Temple of the Deceived (scripts/e2e/temple-of-the-deceived.ts), then the Temple of the Deceived golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function templeWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "Temple of the Deceived", goldens: TEMPLE_GOLDENS, world: templeWorld, play: playTemple }, await depthsWonLog());
}

// The saved decklists' policy (scripts/e2e/raid-on-the-grey-havens.ts), except that the players travel as the Drowned Ruins game policy does (test/scenarios/the-drowned-ruins/game.ts), flip the Grotto location they travel to,
// keep an Underwater location Underwater, and never defend with Captain Sahír or Na'asiyah or give them the damage the players assign (the game is lost if either leaves play, 11077:A:4, 11079:A:4).
export function intentForRuins(state: ScenarioState, ctx: ReduceContext, memory: Set<string>): PlayerIntent {
  const intents = legalIntents(state, ctx);
  if (state.window?.kind === "choose" && state.window.options.includes("stay") && state.window.options.includes("flip")) return { type: "Choose", optionId: "stay" };
  if (state.window?.kind === "response") {
    const flip = intents.find((intent) => intent.type === "Trigger" && /^(12098|12099|12100):response:1$/.test(intent.effectId));
    if (flip?.type === "Trigger") return { type: "Trigger", cardId: flip.cardId, effectId: flip.effectId };
  }
  if (state.window?.kind === "travel" && intents.some((intent) => intent.type === "Travel")) {
    const pick = ruinsTravel(state, legalTargets(state, { type: "Travel" }, ctx), ctx);
    if (pick) return { type: "Travel", locationId: pick };
  }
  if (state.window?.kind === "defense") {
    const defenders = intents.some((intent) => intent.type === "DeclareDefender") ? legalTargets(state, { type: "DeclareDefender" }, ctx).filter((id) => !ELITE.includes(state.cards[id]?.code ?? "")) : [];
    if (defenders[0]) return { type: "DeclareDefender", defenderId: defenders[0] };
    const bare = [...legalTargets(state, { type: "Undefended" }, ctx)].filter((id) => !ELITE.includes(state.cards[id]?.code ?? "")).sort((a, b) => (state.cards[a]?.damage ?? 0) - (state.cards[b]?.damage ?? 0))[0];
    if (bare) return { type: "Undefended", heroId: bare };
  }
  return intentFor(state, ctx, memory);
}

export async function ruinsFixtures(): Promise<Partial<Record<RuinsFixtureName, RuinsFixture>>> {
  const log = await templeWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): RuinsFixture | null => {
    // Neither player takes a Command copy or a Círdan's Blessing at the Campaign Setup.
    const found = firstSeed(say, { campaignId: DREAM_CHASER, scenarioId: "the-drowned-ruins", seatCount: 2, log, answer: intentForRuins }, "RUINS_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "ruins-won");
  const lost = find((state) => state.lost, "ruins-lost");
  return { ...(won ? { "ruins-won": won } : {}), ...(lost ? { "ruins-lost": lost } : {}) };
}
