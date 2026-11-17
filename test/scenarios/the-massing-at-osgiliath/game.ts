import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { legalIntents, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";

const cycle = loadCampaign("standalone-scenarios");
const osgiliath = loadAnyScenario("the-massing-at-osgiliath");

// Test helper. A whole standalone game of The Massing at Osgiliath played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. The players quest every round, and a choice takes its first option (the Ranger shadow: take it; Anduin Crossing: discard a hero; The Witch-king: raise threat 3), or the last as the policy says.
export const OSGILIATH_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type OsgiliathDecks = "strong" | "weak" | "brittle";

export const osgiliathLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const osgiliathWorld = (decks: OsgiliathDecks = "strong") => game.world(decks);
export const osgiliathStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type OsgiliathPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: OsgiliathPolicy = { choose: "first" };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says. Every intent is one the reducer listed.
export function osgiliathIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: OsgiliathPolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  return nextIntent(state, ctx, OSGILIATH_POLICY, memory, legalIntents(state, ctx));
}

export type OsgiliathGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-massing-at-osgiliath/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type OsgiliathGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: OsgiliathDecks; outcome: "won" | "lost"; policy?: Partial<OsgiliathPolicy>; lossReason?: string };

// The games to pin (about 250 intents in all, .claude/rules/code-standards.md, Test cost): wins true solo and two-handed on Normal and Easy (the quest goes one stage a round, the Witch-king joins on stage 4), and the two ways the scenario is
// lost: every player's threat at 50 (heroes too weak to quest) and every hero destroyed (heroes with 1 hit point the Scouts attack). The Nightmare deck does not exist for this scenario.
export const OSGILIATH_GOLDENS: readonly OsgiliathGolden[] = [
  { name: "solo win", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed win", seatCount: 2, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "Easy solo win", seatCount: 1, seed: 3, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "solo loss: threat 50", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: every hero destroyed", seatCount: 2, seed: 2, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
];

const game = standaloneGame<OsgiliathDecks, OsgiliathPolicy>({
  campaign: cycle,
  scenario: osgiliath,
  // "brittle": heroes with 1 hit point that quest a little, so the first attack that lands destroys them (the Scouts engage by themselves).
  stats: { ...HERO_STATS, brittle: { threat: 3, willpower: 3, attack: 0, defense: 0, health: 1 } },
  codes: [...osgiliath.cards.map((card) => card.code)],
  intent: osgiliathIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: OsgiliathGolden, ctx: ReduceContext): OsgiliathGame => game.playGolden(golden, ctx);
