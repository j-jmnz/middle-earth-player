import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { engageOneEach, fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";

const cycle = loadCampaign("dwarrowdelf");
const pit = loadAnyScenario("into-the-pit");

// Test helper. A whole standalone game of Into the Pit played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. The third hero of the first player (q3) stays out of the quest and attacks an engaged enemy, so Goblin Ambush (Nightmare) gets its progress; the players engage enemies after the optional step, travel as the auto-player does and take the first option of every choice.
export const PIT_POLICY: PolicyOptions = { scout: "q3", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type PitDecks = "strong" | "weak" | "brittle";

export const pitLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const pitWorld = (decks: PitDecks = "strong") => game.world(decks);
export const pitStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type PitPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: PitPolicy = { choose: "first" };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says. Every intent is one the reducer listed.
export function pitIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: PitPolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  // Nobody defends, so q3 stays ready to attack: the damage of an undefended attack goes to the seat's least damaged hero.
  if (state.window?.kind === "defense") {
    const heroes = (state.seats[state.window.seat]?.heroes ?? []).filter((id) => state.cards[id]?.zone === "heroes");
    const least = [...heroes].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (least) return { type: "Undefended", heroId: least };
  }
  // Each hero attacks alone, an engaged enemy: the Goblin Ambush stage (Nightmare) is advanced by the enemies destroyed, and the others fall as they come.
  if (state.window?.kind === "playerAttack" && legalIntents(state, ctx).some((intent) => intent.type === "DeclareAttackers")) {
    for (const hero of state.seats[state.activeSeat]?.heroes ?? []) {
      const enemy = legalTargets(state, { type: "DeclareAttackers", cardId: hero }, ctx)[0];
      if (enemy) return { type: "DeclareAttackers", enemyId: enemy, attackerIds: [hero] };
    }
  }
  const engage = engageOneEach(state, ctx, 6);
  if (engage) return engage;
  return nextIntent(state, ctx, PIT_POLICY, memory, legalIntents(state, ctx));
}

export type PitGame = PlayedGame;

// The goldens (src/campaign/scenarios/into-the-pit/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type PitGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: PitDecks; outcome: "won" | "lost"; policy?: Partial<PitPolicy>; lossReason?: string };

// The games to pin (about 1100 intents in all, .claude/rules/code-standards.md, Test cost): wins true solo and two-handed, on Normal, Easy and Nightmare, and the two ways to lose: the threat of every player at 50 (heroes too weak to quest) and every
// hero destroyed (heroes too brittle for the attacks). The strong heroes quest through East-gate, First Hall and the Bridge to A Way Up in a few rounds; the weak ones cannot quest, so the threat rises; the brittle ones die to the staged enemies.
export const PIT_GOLDENS: readonly PitGolden[] = [
  { name: "solo win", seatCount: 1, seed: 5, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed win", seatCount: 2, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "Easy two-handed win", seatCount: 2, seed: 4, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "Nightmare solo win", seatCount: 1, seed: 3, difficulty: "Nightmare", decks: "strong", outcome: "won" },
  { name: "Nightmare two-handed win", seatCount: 2, seed: 2, difficulty: "Nightmare", decks: "strong", outcome: "won" },
  { name: "solo loss: threat 50", seatCount: 1, seed: 3, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: every hero destroyed", seatCount: 2, seed: 2, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
];

const game = standaloneGame<PitDecks, PitPolicy>({
  campaign: cycle,
  scenario: pit,
  stats: HERO_STATS,
  codes: [...pit.cards.map((card) => card.code)],
  intent: pitIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: PitGolden, ctx: ReduceContext): PitGame => game.playGolden(golden, ctx);
