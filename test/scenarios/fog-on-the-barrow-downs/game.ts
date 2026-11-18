import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { legalIntents, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";

const cycle = loadCampaign("standalone-scenarios");
const downs = loadAnyScenario("fog-on-the-barrow-downs");

// Test helper. A whole standalone game of Fog on the Barrow-downs played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. The players travel to the first location they
// may, quest with everyone, answer every search and choice with the first option (or the last as the policy says), keep the allies Trapped Inside a Barrow offers first, and attack what the auto-player attacks.
export const DOWNS_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type DownsDecks = "strong" | "weak" | "brittle";

export const downsLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const downsWorld = (decks: DownsDecks = "strong") => game.world(decks);
export const downsStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type DownsPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: DownsPolicy = { choose: "first" };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says. Every intent is one the reducer listed.
export function downsIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: DownsPolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  return nextIntent(state, ctx, DOWNS_POLICY, memory, legalIntents(state, ctx));
}

export type DownsGame = PlayedGame;

// The goldens (src/campaign/scenarios/fog-on-the-barrow-downs/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
// `returns` is how many times a player came back from stage 4B to stage 3B, `raises` how many players raised their threat by 10 for an elimination while apart (148003:B:2), `parked` that the game ended with stage 3B parked.
export type DownsGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: DownsDecks; outcome: "won" | "lost"; policy?: Partial<DownsPolicy>; lossReason?: string; returns: number; raises?: number; parked?: true };

// The games to pin (about 330 intents in all, .claude/rules/code-standards.md, Test cost): a solo win through a split (a player trapped at stage 4A, back at stage 3B, which he defeats with Standing Stones in the victory display) and a
// two-handed win through two splits (a location revealed at stage 4B raises the threat); the losses: every player's threat at 50 in stage 2, a solo player destroyed at stage 4B with stage 3B parked, and two players destroyed one after the
// other while apart (the player left at stage 3B raises his threat by 10). No card of the scenario ends the game itself and it has no Nightmare deck.
export const DOWNS_GOLDENS: readonly DownsGolden[] = [
  { name: "solo win through a split", seatCount: 1, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won", returns: 1 },
  { name: "two-handed win through two splits", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", returns: 2 },
  { name: "solo loss: threat 50", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain", returns: 0 },
  { name: "solo loss: destroyed at stage 4B with stage 3B parked", seatCount: 1, seed: 4, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain", returns: 0, parked: true },
  { name: "two-handed loss: both destroyed while apart", seatCount: 2, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain", returns: 2, raises: 1 },
];

const game = standaloneGame<DownsDecks, DownsPolicy>({
  campaign: cycle,
  scenario: downs,
  stats: HERO_STATS,
  codes: [...downs.cards.map((card) => card.code)],
  intent: downsIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: DownsGolden, ctx: ReduceContext): DownsGame => game.playGolden(golden, ctx);
