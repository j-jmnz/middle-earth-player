import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { legalIntents, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";
import { printedOf } from "../../../src/rules/core/printed.ts";
import { inPlay } from "../../../src/rules/core/state.ts";
import type { LoadoutSeat } from "../../../src/campaign/loadout.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { attackTogether, engageOneEach, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";

const cycle = loadCampaign("dwarrowdelf");
const flame = loadAnyScenario("shadow-and-flame");

// Test helper. A whole standalone game of Shadow and Flame played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution.
// The decks are thirty copies of Gandalf (cost 5, never played): Dark Pit's Action discards from the top of a deck and compares the printed cost with the remaining hit points of Durin's Bane.
// The policy: the third hero of the first player (q3) stays out of the quest and attacks Durin's Bane (the players at threat 1 or more are all engaged with it); the players travel to Dark Pit as soon as it is in the staging area, and use its Refresh Action
// once a round (exhausting every ready character he may, 3) until Durin's Bane is gone; the other enemies are engaged one each after the quest and attacked; every choice takes its first option, or the last as the policy says.
export const FLAME_POLICY: PolicyOptions = { scout: "q3", prefer: "04141", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type FlameDecks = "strong" | "weak" | "brittle";

const DARK_PIT_ACTION = "04141:action:1";
const BANE = "04150";
const DARK_PIT = "04141";
export const flameLoadout = (seatCount: 1 | 2): LoadoutSeat[] => {
  const deck = Array.from({ length: 30 }, () => "01073");
  const first = { heroes: ["q1", "q2", "q3"], deck };
  return seatCount === 1 ? [first] : [first, { heroes: ["q4", "q5", "q6"], deck }];
};

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const flameWorld = (decks: FlameDecks = "strong") => game.world(decks);
export const flameStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type FlamePolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
  // Real decklists (the fixtures): the characters defend, the cards in hand are played and the Actions other than Dark Pit's are used. The goldens' stand-in heroes defend with nobody and play nothing.
  cards?: boolean;
};
export const DEFAULT_POLICY: FlamePolicy = { choose: "first" };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says. Every intent is one the reducer listed.
// The Action exhausts the characters it discards for: it is used only when the printed cost of the top cards of the deck it would discard (one for each of up to three ready characters, the first the choice offers) tops what Durin's Bane has left,
// so it is not spent on a round that discards nothing.
function discardsBane(state: ScenarioState, ctx: ReduceContext): boolean {
  const bane = Object.values(state.cards).find((card) => card.code === BANE && inPlay(card.zone));
  const seat = state.seats[state.activeSeat];
  const ready = Object.values(state.cards).filter((card) => card.controller === state.activeSeat && !card.exhausted && (card.zone === "heroes" || (card.zone === "play" && card.host == null && printedOf(ctx.cards, card.code).type === "ally"))).length;
  const top = (seat?.deck ?? []).slice(0, Math.min(3, ready));
  const cost = top.reduce((sum, id) => sum + (printedOf(ctx.cards, state.cards[id]?.code ?? "").cost ?? 0), 0);
  return bane != null && cost > (printedOf(ctx.cards, BANE).health ?? 0) - bane.damage;
}

export function flameIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: FlamePolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  const intents = legalIntents(state, ctx);
  // Dark Pit's Refresh Action, once a round for each seat that can take it.
  if (state.window?.kind === "pass" || state.window?.kind === "response" || state.window?.kind === "frameAction") {
    for (const intent of intents) {
      if (intent.type !== "Trigger" || intent.effectId !== DARK_PIT_ACTION) continue;
      const key = `${state.round}:${state.activeSeat}:${intent.cardId}:${intent.effectId}`;
      if (memory.has(key) || !discardsBane(state, ctx)) continue;
      memory.add(key);
      return { type: "Trigger", cardId: intent.cardId, effectId: intent.effectId };
    }
  }
  // Nobody defends (a hero has the health for it): the damage of an undefended attack goes to the seat's least damaged hero.
  if (state.window?.kind === "defense" && !policy.cards) {
    const heroes = (state.seats[state.window.seat]?.heroes ?? []).filter((id) => state.cards[id]?.zone === "heroes");
    const least = [...heroes].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (least) return { type: "Undefended", heroId: least };
  }
  // Nothing is committed while Dark Pit is the active location: the progress would explore it and discard it before its Action can be used.
  if (state.window?.kind === "pass" && state.mode === "questCommit" && state.cards[state.activeLocation ?? ""]?.code === DARK_PIT) return { type: "Pass" };
  const attackers = attackTogether(state, ctx, undefined, (id) => (state.cards[id]?.code === BANE ? 0 : 1));
  if (attackers) return attackers;
  const engage = engageOneEach(state, ctx, 6);
  if (engage) return engage;
  // Dark Pit's Action is the policy's alone: the auto-player never sees it, so it cannot spend it on a round that discards nothing.
  const others = intents.filter((intent) => !(intent.type === "Trigger" && intent.effectId === DARK_PIT_ACTION));
  const scout = policy.cards ? (state.cards[state.seats[0]?.heroes.at(-1) ?? ""]?.code ?? "") : FLAME_POLICY.scout;
  return nextIntent(state, ctx, { ...FLAME_POLICY, scout, play: policy.cards === true, act: policy.cards === true }, memory, others);
}

export type FlameGame = PlayedGame;

// The goldens (src/campaign/scenarios/shadow-and-flame/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type FlameGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: FlameDecks; outcome: "won" | "lost"; policy?: Partial<FlamePolicy>; lossReason?: string };

// The games to pin (about 700 intents in all, .claude/rules/code-standards.md, Test cost): wins true solo and two-handed on Normal, Easy and Nightmare (Durin's Bane is damaged by the players that are engaged with it, Dark Pit is the active location, its Refresh Action discards Durin's
// Bane and the game is won), and the ways to lose: the threat of every player at 50 (heroes too weak to quest) and every hero destroyed (heroes too brittle to survive Durin's Bane).
export const FLAME_GOLDENS: readonly FlameGolden[] = [
  { name: "solo win", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed win", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "Easy solo win", seatCount: 1, seed: 1, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "Easy two-handed win", seatCount: 2, seed: 1, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "Nightmare solo win", seatCount: 1, seed: 1, difficulty: "Nightmare", decks: "strong", outcome: "won" },
  { name: "Nightmare two-handed win", seatCount: 2, seed: 1, difficulty: "Nightmare", decks: "strong", outcome: "won" },
  { name: "solo loss: threat 50", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: threat 50", seatCount: 2, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "solo loss: every hero destroyed", seatCount: 1, seed: 3, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: every hero destroyed", seatCount: 2, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
];

const game = standaloneGame<FlameDecks, FlamePolicy>({
  campaign: cycle,
  scenario: flame,
  stats: HERO_STATS,
  codes: [...flame.cards.map((card) => card.code), "01073"],
  loadout: flameLoadout,
  intent: flameIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: FlameGolden, ctx: ReduceContext): FlameGame => game.playGolden(golden, ctx);
