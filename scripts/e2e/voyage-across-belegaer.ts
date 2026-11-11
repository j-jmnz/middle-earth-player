// The Maestro fixtures of Voyage Across Belegaer (Dream-chaser part 1), written into src/campaign/fixtures/voyage-across-belegaer.json by scripts/e2e/fixtures.ts:
// real games of saved decklists (The One Deck and the Defenders of Gondor lists of data/decks/test-decks.json and data/decks/prebuilt.json) from the blank log a new `dream-chaser`
// playthrough starts on, so each is a real save. The Campaign Setup (a ship each, a Modification boon, the damage trade) is answered in the game by the auto-player.
// `sea-solo`: true solo, parked on the first Sailing test's commit. `sea-duo`: two-handed, parked on the first player's planning window of round 1.
// `voyage-won` and `voyage-lost`: two-handed, Easy, parked on the win (the Resolution waits) and on the loss. `sea-showcase`: two-handed, a full sea table in round 3 or later, for the README. A game not found in the seeds is left out.
import type { StoredLoadout } from "../../src/campaign/save.ts";
import { askingToCommit } from "../../src/rules/families/sea/sailing-legal.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../src/rules/engine/reduce.ts";

import { nextIntent } from "../../test/harness/auto-player.ts";
import { createLog } from "../log.ts";
import { boardHolds, DREAM_CHASER, firstSeed } from "./seed-kit.ts";
import { attackTogether, engageOneEach } from "../../test/harness/game-kit.ts";

const say = createLog("e2e-voyage");

export type VoyageFixture = { campaignId: string; seatCount: 1 | 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[] };
export type VoyageFixtureName = "sea-solo" | "sea-duo" | "voyage-won" | "voyage-lost" | "sea-showcase";

// The auto-player's answer with what the sea asks: the damage on a ship is kept, the ships sail and defend, damage the players assign falls on the least wounded hero,
// the heroes attack together, and the first stage offered is chosen.
function intentFor(state: ScenarioState, ctx: ReduceContext, memory: Set<string>): PlayerIntent {
  if (state.window?.kind === "choose" && state.window.options.every((option) => option === "trade" || option === "keep")) return { type: "Choose", optionId: "keep" };
  if (state.window?.kind === "choose") {
    const heroes = state.window.options.filter((option) => state.cards[option]?.zone === "heroes");
    const least = [...heroes].sort((a, b) => (state.cards[a]?.damage ?? 0) - (state.cards[b]?.damage ?? 0))[0];
    if (least && heroes.length < state.window.options.length) return { type: "Choose", optionId: least };
  }
  if (askingToCommit(state)) {
    const ships = legalTargets(state, { type: "Commit" }, ctx).filter((id) => ctx.cards.get(state.cards[id]?.code ?? "")?.ship === "objective");
    if (ships.length > 0) return { type: "Commit", cardIds: ships };
    return { type: "Pass" };
  }
  if (state.window?.kind === "defense") {
    const defenders = legalIntents(state, ctx).some((intent) => intent.type === "DeclareDefender") ? legalTargets(state, { type: "DeclareDefender" }, ctx) : [];
    if (defenders[0]) return { type: "DeclareDefender", defenderId: defenders[0] };
    const targets = legalTargets(state, { type: "Undefended" }, ctx);
    const least = [...targets].sort((a, b) => (state.cards[a]?.damage ?? 0) - (state.cards[b]?.damage ?? 0))[0];
    if (least) return { type: "Undefended", heroId: least };
  }
  // Corsair Pursuit (stage 3) when it is offered: the shortest road to the win.
  if (state.window?.kind === "choose") {
    const pursuit = state.window.options.find((option) => state.cards[option]?.code === "11021");
    if (pursuit) return { type: "Choose", optionId: pursuit };
  }
  const together = attackTogether(state, ctx);
  if (together) return together;
  if (state.window?.kind === "optionalEngage") return engageOneEach(state, ctx, 2) ?? { type: "DeclineEngage" };
  return nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory, legalIntents(state, ctx));
}

const never = (): boolean => false;
const atCommit = (state: ScenarioState): boolean => askingToCommit(state);
const atPlanning = (state: ScenarioState): boolean => state.mode === "planning" && state.activeSeat === 0;
// The README showcase's sea table (docs/plans/readme-showcase.md, Saves and decks): a planning window from round 3 on, with the ships and the characters in play and cards in staging.
const atShowcase = (state: ScenarioState): boolean => state.round >= 3 && atPlanning(state) && !state.lost && boardHolds(state, { play: 8, staging: 2 });

// The first seed of the Voyage game that `wanted` accepts, parked where `stop` says (checked before each intent) or at the game's end.
function find(seatCount: 1 | 2, stop: ((state: ScenarioState, intents: number) => boolean) | undefined, wanted: (state: ScenarioState) => boolean, label: string): VoyageFixture | null {
  return firstSeed(say, { campaignId: DREAM_CHASER, scenarioId: "voyage-across-belegaer", seatCount, answer: intentFor, stop }, "VOYAGE_SEEDS", wanted, label);
}

export function voyageFixtures(): Partial<Record<VoyageFixtureName, VoyageFixture>> {
  const solo = find(1, atCommit, (state) => !state.lost && !state.stageCleared && atCommit(state), "sea-solo");
  const duo = find(2, atPlanning, (state) => !state.lost && atPlanning(state), "sea-duo");
  const won = find(2, never, (state) => state.stageCleared && !state.lost, "voyage-won");
  const lost = find(2, never, (state) => state.lost, "voyage-lost");
  const showcase = find(2, atShowcase, atShowcase, "sea-showcase");
  return { ...(solo ? { "sea-solo": solo } : {}), ...(duo ? { "sea-duo": duo } : {}), ...(won ? { "voyage-won": won } : {}), ...(lost ? { "voyage-lost": lost } : {}), ...(showcase ? { "sea-showcase": showcase } : {}) };
}
