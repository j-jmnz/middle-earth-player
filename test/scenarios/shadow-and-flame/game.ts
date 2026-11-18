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
};
export const DEFAULT_POLICY: FlamePolicy = { choose: "first" };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says. Every intent is one the reducer listed.
// The Action exhausts the characters it discards for: it is used only when the cost of the cards it discards (up to three, of Gandalf's 5) tops what Durin's Bane has left, so it is not spent on a round that discards nothing.
function discardsBane(state: ScenarioState, ctx: ReduceContext): boolean {
  const bane = Object.values(state.cards).find((card) => card.code === BANE && inPlay(card.zone));
  const seat = state.seats[state.activeSeat];
  const ready = (seat?.heroes ?? []).filter((id) => state.cards[id]?.zone === "heroes" && !state.cards[id]?.exhausted).length;
  return bane != null && 5 * Math.min(3, ready, seat?.deck.length ?? 0) > (printedOf(ctx.cards, BANE).health ?? 0) - bane.damage;
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
  if (state.window?.kind === "defense") {
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
  return nextIntent(state, ctx, FLAME_POLICY, memory, intents);
}

export type FlameGame = PlayedGame;

// The goldens (src/campaign/scenarios/shadow-and-flame/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type FlameGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: FlameDecks; outcome: "won" | "lost"; policy?: Partial<FlamePolicy>; lossReason?: string };

// TODO: the games to pin (at most 3000 intents in all, .claude/rules/code-standards.md, Test cost), a few wins (true solo and two-handed, Normal and Nightmare) and a few losses (each way the scenario can be lost), each on a fixed seed.
export const FLAME_GOLDENS: readonly FlameGolden[] = [];

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
