import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { attackTogether, fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";

const cycle = loadCampaign("standalone-scenarios");
const town = loadAnyScenario("the-battle-of-lake-town");

// Test helper. A whole standalone game of The Battle of Lake-town played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. The first player has Smaug come into the play area
// (he engages at once, so the heroes can attack him), the players travel to the first location they may, quest with everyone and attack Smaug with every hero that can; a Burn question exhausts the first ready hero and gives it the whole pool (or takes "done" under the policy "town": Lake-town takes the damage), a cancel
// offer keeps the hero, and stage 2B's discard of progress takes the most.
export const TOWN_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type TownDecks = "strong" | "weak" | "brittle";

export const townLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const townWorld = (decks: TownDecks = "strong") => game.world(decks);
export const townStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type TownPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
  // Burn: the first ready hero is exhausted and takes the whole pool ("heroes"), or nobody takes it and it all goes on Lake-town ("town").
  burn: "heroes" | "town";
  // The quest: the first character alone (the others stay ready to take Burn damage, defend and attack Smaug), every one but the last, or all of them.
  quest: "one" | "most" | "all";
};
export const DEFAULT_POLICY: TownPolicy = { choose: "first", burn: "heroes", quest: "one" };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says. Every intent is one the reducer listed.
export function townIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: TownPolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") return { type: "Choose", optionId: answer(state.window.options, policy) };
  if (state.window?.kind === "playerAttack") return attackTogether(state, ctx) ?? { type: "DeclineAttack" };
  if (state.window?.kind === "pass" && state.mode === "questCommit" && !Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) {
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    if (ids.length > 0) return { type: "Commit", cardIds: policy.quest === "all" ? ids : policy.quest === "most" ? ids.slice(0, Math.max(1, ids.length - 1)) : ids.slice(0, 1) };
  }
  return nextIntent(state, ctx, TOWN_POLICY, memory, legalIntents(state, ctx));
}

// Where Smaug comes ("play": he engages the first player), Burn (a hero takes it, or "done"), a cancel offer ("keep"), stage 2B's discard (the most), else the first option or the last as the policy says.
function answer(options: readonly string[], policy: TownPolicy): string {
  if (options.includes("play") && options.includes("staging")) return "play";
  const exhaust = options.find((option) => option.startsWith("exhaust:"));
  if (exhaust && policy.burn === "heroes") return exhaust;
  if (options.includes("done")) return "done";
  if (options.some((option) => option.startsWith("burn:"))) return options.at(-1) ?? "";
  if (options.includes("keep")) return "keep";
  if (options.some((option) => option.startsWith("discard:"))) return options.at(-1) ?? "";
  return (policy.choose === "last" ? options.at(-1) : options[0]) ?? "";
}

export type TownGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-battle-of-lake-town/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type TownGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: TownDecks; outcome: "won" | "lost"; policy?: Partial<TownPolicy>; lossReason?: string };

// The games to pin (under 3000 intents in all, .claude/rules/code-standards.md, Test cost): wins true solo and two-handed on Normal and Easy (Smaug defeated on stage 3 with more Victory points in the display than damage on Lake-town; the solo win with
// burn taken by heroes plays 14 rounds of Burn, the two-handed one takes it all on Lake-town), and each way to lose: every player's threat at 50 (heroes too weak to quest), every hero destroyed, 50 damage on Lake-town, and Smaug defeated with too
// few points (a tie loses). The scenario has no Nightmare deck.
export const TOWN_GOLDENS: readonly TownGolden[] = [
  { name: "solo win", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed win", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", policy: { burn: "town" } },
  { name: "Easy solo win", seatCount: 1, seed: 4, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "solo loss: threat 50", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: every hero destroyed", seatCount: 2, seed: 2, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
  { name: "solo loss: 50 damage on Lake-town", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "lost", policy: { burn: "town", quest: "all" }, lossReason: "Lake-town holds 50 damage" },
  { name: "solo loss: Smaug defeated with too few points", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "lost", policy: { burn: "town" }, lossReason: "Smaug was defeated, but the victory display holds no more Victory points than the damage on Lake-town" },
];

const game = standaloneGame<TownDecks, TownPolicy>({
  campaign: cycle,
  scenario: town,
  // "strong": heroes whose Attack of 30 beats Smaug's Defense of 9 by more than his 20 hit points, so one attack defeats him once stage 3 lifts the cap on his damage.
  stats: { ...HERO_STATS, strong: { ...HERO_STATS.strong, attack: 30 } },
  codes: [...town.cards.map((card) => card.code)],
  // The cards a game loads besides the scenario's piles: none.
  intent: townIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: TownGolden, ctx: ReduceContext): TownGame => game.playGolden(golden, ctx);
