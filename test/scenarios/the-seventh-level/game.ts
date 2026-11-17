import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { attackTogether, engageOneEach, fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";

const cycle = loadCampaign("dwarrowdelf");
const level = loadAnyScenario("the-seventh-level");

// Test helper. A whole standalone game of The Seventh Level played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. The third hero of the first player (q3) stays out of the quest and attacks; the players engage Overseer Maurûl first (Nightmare), then enemies one each after the optional step, enemies after the optional step, travel as the auto-player does and take the first option of every choice.
export const LEVEL_POLICY: PolicyOptions = { scout: "q3", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "steady": strong attackers that quest slowly, so a game has more than a round of play; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type LevelDecks = "strong" | "steady" | "weak" | "brittle";

export const levelLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const levelWorld = (decks: LevelDecks = "strong") => game.world(decks);
export const levelStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type LevelPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: LevelPolicy = { choose: "first" };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says. Every intent is one the reducer listed.
export function levelIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: LevelPolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  // Nobody defends, so q3 stays ready to attack: the damage of an undefended attack goes to the seat's least damaged hero.
  if (state.window?.kind === "defense") {
    const heroes = (state.seats[state.window.seat]?.heroes ?? []).filter((id) => state.cards[id]?.zone === "heroes");
    const least = [...heroes].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (least) return { type: "Undefended", heroId: least };
  }
  // Nightmare: Overseer Maurûl bars the stage until he is in the victory display, so the players engage him first and attack him together; every other enemy is engaged one each and attacked by a hero alone.
  const maurul = (id: string) => state.cards[id]?.code === "901102";
  if (state.window?.kind === "optionalEngage") {
    const target = legalTargets(state, { type: "Engage" }, ctx).find(maurul);
    if (target) return { type: "Engage", enemyId: target };
  }
  if (state.window?.kind === "playerAttack" && legalIntents(state, ctx).some((intent) => intent.type === "DeclareAttackers")) {
    const together = attackTogether(state, ctx, () => true, (id) => (maurul(id) ? 0 : 1));
    if (together?.type === "DeclareAttackers" && maurul(together.enemyId)) return together;
    for (const hero of state.seats[state.activeSeat]?.heroes ?? []) {
      const enemy = legalTargets(state, { type: "DeclareAttackers", cardId: hero }, ctx)[0];
      if (enemy) return { type: "DeclareAttackers", enemyId: enemy, attackerIds: [hero] };
    }
  }
  const engage = engageOneEach(state, ctx, 6);
  if (engage) return engage;
  return nextIntent(state, ctx, LEVEL_POLICY, memory, legalIntents(state, ctx));
}

export type LevelGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-seventh-level/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type LevelGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: LevelDecks; outcome: "won" | "lost"; policy?: Partial<LevelPolicy>; lossReason?: string };

// The games to pin (about 500 intents in all, .claude/rules/code-standards.md, Test cost): wins true solo and two-handed, on Normal, Easy and Nightmare, and the two ways to lose: the threat of every player at 50 (heroes too weak to quest) and every hero
// destroyed (heroes too brittle for the Goblins). The strong heroes quest through Search for the Chamber and The Fate of Balin in two rounds (on Nightmare they engage Overseer Maurûl and destroy him together first, since he bars the stage).
export const LEVEL_GOLDENS: readonly LevelGolden[] = [
  { name: "solo win", seatCount: 1, seed: 2, difficulty: "Normal", decks: "steady", outcome: "won" },
  { name: "two-handed win", seatCount: 2, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "Easy two-handed win", seatCount: 2, seed: 4, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "Nightmare solo win", seatCount: 1, seed: 5, difficulty: "Nightmare", decks: "steady", outcome: "won" },
  { name: "Nightmare two-handed win", seatCount: 2, seed: 2, difficulty: "Nightmare", decks: "strong", outcome: "won" },
  { name: "solo loss: threat 50", seatCount: 1, seed: 5, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "solo loss: every hero destroyed", seatCount: 1, seed: 6, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
];

const game = standaloneGame<LevelDecks, LevelPolicy>({
  campaign: cycle,
  scenario: level,
  // "brittle" quest for nothing and carry 3 hit points, so the staged and engaged Goblins destroy them before the threat reaches 50 (the strong ones win in round 2, too fast to be attacked).
  stats: { ...HERO_STATS, brittle: { threat: 10, willpower: 0, attack: 0, defense: 0, health: 3 } },
  codes: [...level.cards.map((card) => card.code)],
  intent: levelIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: LevelGolden, ctx: ReduceContext): LevelGame => game.playGolden(golden, ctx);
