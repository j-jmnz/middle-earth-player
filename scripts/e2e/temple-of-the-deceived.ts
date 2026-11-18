// The fixtures of Temple of the Deceived (Dream-chaser part 6), written into src/campaign/fixtures/temple-of-the-deceived.json by scripts/e2e/fixtures.ts: real games of saved decklists (The One Deck and the Defenders of Gondor lists of data/decks/test-decks.json and data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `temple-won` is the first seed that wins, parked on the win (the Resolution waits); `temple-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the first five parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it (a blank log keeps this part locked and the path opens Voyage Across Belegaer): it is the
// log of `scripts/e2e/the-thing-in-the-depths.ts` (the Voyage, Fate, Raid and Flight goldens' wins), and on top of it the one of The Thing in the Depths' golden ("two-handed, won"), each run through the same `applyResolution` that writes
// it in the app, with the goldens' plain-number heroes taken out (the fixture's seats play real decklists). `voyage-won`, `fate-won`, `raid-won`, `stormcaller-won` and `depths-won`, real-decklist wins, are open
// (docs/phases/STATUS.md). The Campaign Setup asks no choice (its questions, damage for threat and Spyglass for threat, come in the game and the policy answers them); the Resolution asks which player a Recurring Nightmare
// goes to when one was flipped.
import type { CampaignLog } from "../../src/campaign/log.ts";
import type { StoredLoadout } from "../../src/campaign/save.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ScenarioState, type ReduceContext } from "../../src/rules/engine/reduce.ts";

import { DEPTHS_GOLDENS, depthsWorld, playGolden as playDepths } from "../../test/scenarios/the-thing-in-the-depths/game.ts";
import { stormcallerWonLog } from "./the-thing-in-the-depths.ts";
import { intentFor } from "./raid-on-the-grey-havens.ts";
import { createLog } from "../log.ts";
import { keyClaimed, templeTravel } from "../../test/scenarios/temple-of-the-deceived/game.ts";
import { DREAM_CHASER, firstSeed, wonLog } from "./seed-kit.ts";

const say = createLog("e2e-temple");
const ELITE: readonly string[] = ["11077", "11079"];

export type TempleFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type TempleFixtureName = "temple-won" | "temple-lost";

// The log of a playthrough whose first five parts were won: the log of the first four (scripts/e2e/the-thing-in-the-depths.ts), then the Depths golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function depthsWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "Depths", goldens: DEPTHS_GOLDENS, world: depthsWorld, play: playDepths }, await stormcallerWonLog());
}

// The saved decklists' policy (scripts/e2e/raid-on-the-grey-havens.ts), except that the players travel as the Temple game's policy does (test/scenarios/temple-of-the-deceived/game.ts) and claim the Gate Key when it falls free.
export function intentForTemple(state: ScenarioState, ctx: ReduceContext, memory: Set<string>): PlayerIntent {
  const intents = legalIntents(state, ctx);
  if (state.window?.kind === "travel" && intents.some((intent) => intent.type === "Travel")) {
    const pick = templeTravel(state, legalTargets(state, { type: "Travel" }, ctx));
    if (pick) return { type: "Travel", locationId: pick };
  }
  // Captain Sahír and Na'asiyah never defend and take no damage the players assign: the game is lost if either leaves play (11077:A:4, 11079:A:4).
  if (state.window?.kind === "defense") {
    const defenders = legalIntents(state, ctx).some((intent) => intent.type === "DeclareDefender") ? legalTargets(state, { type: "DeclareDefender" }, ctx).filter((id) => !ELITE.includes(state.cards[id]?.code ?? "")) : [];
    if (defenders[0]) return { type: "DeclareDefender", defenderId: defenders[0] };
    const bare = [...legalTargets(state, { type: "Undefended" }, ctx)].filter((id) => !ELITE.includes(state.cards[id]?.code ?? "")).sort((a, b) => (state.cards[a]?.damage ?? 0) - (state.cards[b]?.damage ?? 0))[0];
    if (bare) return { type: "Undefended", heroId: bare };
  }
  // Archery damage is spread over the heroes, one point at a time to the least wounded.
  if (state.window?.kind === "archery" && intents.some((intent) => intent.type === "Distribute")) {
    const heroes = legalTargets(state, { type: "Distribute" }, ctx).filter((id) => state.cards[id]?.zone === "heroes");
    if (heroes.length > 0) {
      const given = new Map<string, number>();
      for (let point = 0; point < state.window.total; point += 1) {
        const target = [...heroes].sort((a, b) => (state.cards[a]?.damage ?? 0) + (given.get(a) ?? 0) - ((state.cards[b]?.damage ?? 0) + (given.get(b) ?? 0)))[0] ?? "";
        given.set(target, (given.get(target) ?? 0) + 1);
      }
      return { type: "Distribute", assignments: [...given].map(([cardId, amount]) => ({ cardId, amount })) };
    }
  }
  const claim = intents.find((intent) => intent.type === "Trigger" && /^110078:action:[13]$/.test(intent.effectId));
  if (claim?.type === "Trigger" && !keyClaimed(state)) return { type: "Trigger", cardId: claim.cardId, effectId: claim.effectId };
  return intentFor(state, ctx, memory);
}

export async function templeFixtures(): Promise<Partial<Record<TempleFixtureName, TempleFixture>>> {
  const log = await depthsWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): TempleFixture | null => {
    const found = firstSeed(say, { campaignId: DREAM_CHASER, scenarioId: "temple-of-the-deceived", seatCount: 2, log, answer: intentForTemple }, "TEMPLE_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "temple-won");
  const lost = find((state) => state.lost, "temple-lost");
  return { ...(won ? { "temple-won": won } : {}), ...(lost ? { "temple-lost": lost } : {}) };
}
