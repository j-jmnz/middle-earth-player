import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { engageOneEach, fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";

const cycle = loadCampaign("dwarrowdelf");
const gate = loadAnyScenario("the-redhorn-gate");

// Test helper. A whole standalone game of The Redhorn Gate played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. The third hero of the first player (q3) stays out of the quest and
// attacks; nobody defends (the damage of an undefended attack goes to the seat's least damaged hero, so Arwen is never a defender), the players engage one enemy each and answer every choice with its first option (Fanuidhol's payment is the first).
export const GATE_POLICY: PolicyOptions = { scout: "q3", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type GateDecks = "strong" | "weak" | "brittle";

export const gateLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const gateWorld = (decks: GateDecks = "strong") => game.world(decks);
export const gateStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type GatePolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: GatePolicy = { choose: "first" };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says. Every intent is one the reducer listed.
export function gateIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: GatePolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  // Nobody defends, so q3 stays ready to attack: the damage of an undefended attack goes to the seat's least damaged hero.
  if (state.window?.kind === "defense") {
    const heroes = (state.seats[state.window.seat]?.heroes ?? []).filter((id) => state.cards[id]?.zone === "heroes");
    const least = [...heroes].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (least) return { type: "Undefended", heroId: least };
  }
  // Enemies are engaged one each after the optional step and attacked by one hero alone.
  if (state.window?.kind === "playerAttack" && legalIntents(state, ctx).some((intent) => intent.type === "DeclareAttackers")) {
    for (const hero of state.seats[state.activeSeat]?.heroes ?? []) {
      const enemy = legalTargets(state, { type: "DeclareAttackers", cardId: hero }, ctx)[0];
      if (enemy) return { type: "DeclareAttackers", enemyId: enemy, attackerIds: [hero] };
    }
  }
  const engage = engageOneEach(state, ctx, 6);
  if (engage) return engage;
  return nextIntent(state, ctx, GATE_POLICY, memory, legalIntents(state, ctx));
}

export type GateGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-redhorn-gate/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type GateGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: GateDecks; outcome: "won" | "lost"; policy?: Partial<GatePolicy>; lossReason?: string };

// The games to pin (about 600 intents in all, .claude/rules/code-standards.md, Test cost): wins true solo and two-handed, on Normal, Easy and Nightmare, and the four ways to lose: the threat of every player at 50 (heroes too weak to quest), every hero destroyed (heroes too brittle),
// Arwen discarded at 0 Willpower as Snowdrifts becomes stage 3B (the Snowstorm and Caradhras' -1 reach her, committed) and, on Nightmare, Arwen discarded by Snow-Giant (the ally with the highest Willpower). The wins end on The Mountains' Peaks with 5 victory points in the display.
export const GATE_GOLDENS: readonly GateGolden[] = [
  { name: "solo win", seatCount: 1, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed win", seatCount: 2, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "Easy solo win", seatCount: 1, seed: 2, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "Easy two-handed win", seatCount: 2, seed: 1, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "Nightmare solo win", seatCount: 1, seed: 2, difficulty: "Nightmare", decks: "strong", outcome: "won" },
  { name: "Nightmare two-handed win", seatCount: 2, seed: 2, difficulty: "Nightmare", decks: "strong", outcome: "won" },
  { name: "solo loss: threat 50", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "solo loss: every hero destroyed", seatCount: 1, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
  { name: "solo loss: Arwen discarded at 0 Willpower on stage 3B", seatCount: 1, seed: 3, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: "Arwen Undómiel left play" },
  { name: "Nightmare two-handed loss: Snow-Giant discards Arwen", seatCount: 2, seed: 5, difficulty: "Nightmare", decks: "strong", outcome: "lost", lossReason: "Arwen Undómiel left play" },
];

const game = standaloneGame<GateDecks, GatePolicy>({
  campaign: cycle,
  scenario: gate,
  stats: HERO_STATS,
  codes: [...gate.cards.map((card) => card.code)],
  intent: gateIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: GateGolden, ctx: ReduceContext): GateGame => game.playGolden(golden, ctx);
