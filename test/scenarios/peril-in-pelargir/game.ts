import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { legalIntents, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { attackTogether, engageOneEach, fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";

const cycle = loadCampaign("against-the-shadow");
const pelargir = loadAnyScenario("peril-in-pelargir");

// Test helper. A whole standalone game of Peril in Pelargir played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. The third hero of the first player (q3) stays out of the quest and attacks; nobody defends (the damage of an undefended attack goes to the seat's least damaged hero), the players engage one enemy each and attack the enemy that holds Alcaron's Scroll first, and answer every choice with its first option.
export const PELARGIR_POLICY: PolicyOptions = { scout: "q3", prefer: "", protect: "", play: false, act: true };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type PelargirDecks = "strong" | "weak" | "brittle";

export const pelargirLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const pelargirWorld = (decks: PelargirDecks = "strong") => game.world(decks);
export const pelargirStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type PelargirPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: PelargirPolicy = { choose: "first" };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says. Every intent is one the reducer listed.
export function pelargirIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: PelargirPolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  // Nobody defends, so the scout stays ready to attack: the damage of an undefended attack goes to the seat's least damaged hero.
  if (state.window?.kind === "defense") {
    const heroes = (state.seats[state.window.seat]?.heroes ?? []).filter((id) => state.cards[id]?.zone === "heroes");
    const least = [...heroes].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (least) return { type: "Undefended", heroId: least };
  }
  // Everyone who can attack does, the enemy holding Alcaron's Scroll first (the stage waits for it: a defeated host returns it to the staging area).
  const holder = (id: string) => ((state.cards[id]?.attachments ?? []).some((attached) => state.cards[attached]?.code === "05019") ? 0 : 1);
  const attack = attackTogether(state, ctx, () => true, holder);
  if (attack) return attack;
  const engage = engageOneEach(state, ctx, 6);
  if (engage) return engage;
  return nextIntent(state, ctx, PELARGIR_POLICY, memory, legalIntents(state, ctx));
}

export type PelargirGame = PlayedGame;

// The goldens (src/campaign/scenarios/peril-in-pelargir/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type PelargirGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: PelargirDecks; outcome: "won" | "lost"; policy?: Partial<PelargirPolicy>; lossReason?: string };

// The games to pin (about 650 intents in all, .claude/rules/code-standards.md, Test cost): wins true solo and two-handed on Normal and Easy (the solo Normal win is long: Umbar Assassin holds Alcaron's Scroll in the staging area, so stage 3B waits for it), and the two ways to lose:
// the threat of every player at 50 (heroes too weak to quest) and every hero destroyed (heroes too brittle). The scenario has no Nightmare deck and no card that loses the game.
export const PELARGIR_GOLDENS: readonly PelargirGolden[] = [
  { name: "solo win", seatCount: 1, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed win", seatCount: 2, seed: 16, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "Easy solo win", seatCount: 1, seed: 3, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "Easy two-handed win", seatCount: 2, seed: 1, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "solo loss: threat 50", seatCount: 1, seed: 2, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: threat 50", seatCount: 2, seed: 2, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "solo loss: every hero destroyed", seatCount: 1, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: every hero destroyed", seatCount: 2, seed: 3, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
];

const game = standaloneGame<PelargirDecks, PelargirPolicy>({
  campaign: cycle,
  scenario: pelargir,
  stats: HERO_STATS,
  codes: [...pelargir.cards.map((card) => card.code)],
  intent: pelargirIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: PelargirGolden, ctx: ReduceContext): PelargirGame => game.playGolden(golden, ctx);
