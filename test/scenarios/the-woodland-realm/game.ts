import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { attackTogether, engageOneEach, fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";

const cycle = loadCampaign("standalone-scenarios");
const woodland = loadAnyScenario("the-woodland-realm");
const MENDOR = "51111";
const STAGES_2 = ["51103", "51104", "51105"];
const STAGES_3 = ["51107", "51108", "51109"];

// Test helper. A whole standalone game of The Woodland Realm played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. TODO: say how the players travel, engage and answer the choices this scenario asks.
export const WOODLAND_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type WoodlandDecks = "strong" | "weak" | "brittle";

export const woodlandLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const woodlandWorld = (decks: WoodlandDecks = "strong") => game.world(decks);
export const woodlandStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type WoodlandPolicy = {
  // The stage 2 card (51103, 51104, 51105) and the stage 3 card (51107, 51108, 51109) the first player takes: the first, the second or the third option of those Choose windows. Every other choice takes the first option.
  stage2: 0 | 1 | 2;
  stage3: 0 | 1 | 2;
};
export const DEFAULT_POLICY: WoodlandPolicy = { stage2: 0, stage3: 0 };

// The auto-player's answer (test/harness/auto-player.ts), except: the first player's stage choices are the policy's, every other choice takes the first option, and never Mendor while another card is offered (his loss loses the game). Every intent
// is one the reducer listed. The players engage the enemies of the staging area one each and attack in turn, the enemy that carries the resource of The Forest of Great Fear first (the stage cannot be defeated while it is in play).
// A seat with several heroes sends one to quest and keeps the others to defend, so an attack is rarely undefended (Lost and Witless discards an ally on an undefended one: Mendor).
const rankOf = (state: ScenarioState, enemyId: string): number => ((state.cards[enemyId]?.resources ?? 0) > 0 ? 0 : 1);

export function woodlandIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: WoodlandPolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") {
    const options = state.window.options;
    const stage = (codes: readonly string[]): boolean => options.length === 3 && options.every((option) => codes.includes(state.cards[option]?.code ?? option));
    if (stage(STAGES_2)) return { type: "Choose", optionId: options[policy.stage2] ?? "" };
    if (stage(STAGES_3)) return { type: "Choose", optionId: options[policy.stage3] ?? "" };
    // A choice among cards never takes Mendor while another card is offered: his loss loses the game.
    const others = options.filter((option) => state.cards[option]?.code !== MENDOR);
    return { type: "Choose", optionId: (others.length > 0 ? others : options)[0] ?? "" };
  }
  if (state.window?.kind === "optionalEngage") return engageOneEach(state, ctx) ?? { type: "DeclineEngage" };
  if (state.window?.kind === "playerAttack") {
    // One hero at a time, so the others may attack another enemy in the next window; an enemy is attacked once in a phase (the memory holds the round and the enemy).
    const seat = state.seats[state.activeSeat];
    const attack = (seat?.heroes ?? []).map((one) => attackTogether(state, ctx, (id) => id === one, (id) => rankOf(state, id))).find((intent) => intent?.type === "DeclareAttackers" && !memory.has(`${state.round}:${intent.enemyId}`));
    if (attack?.type === "DeclareAttackers") {
      memory.add(`${state.round}:${attack.enemyId}`);
      return attack;
    }
  }
  if (state.window?.kind === "pass" && state.mode === "questCommit" && !Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) {
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    if (ids.length > 0 && (state.seats[state.activeSeat]?.heroes.length ?? 0) > 1) return { type: "Commit", cardIds: ids.slice(0, 1) };
  }
  if (state.window?.kind === "defense") {
    const heroes = state.seats[state.activeSeat]?.heroes ?? [];
    const attacker = heroes.at(-1);
    const defender = legalTargets(state, { type: "DeclareDefender" }, ctx).find((id) => id !== attacker && heroes.includes(id));
    if (defender) return { type: "DeclareDefender", defenderId: defender };
    const least = [...legalTargets(state, { type: "Undefended" }, ctx)].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (least) return { type: "Undefended", heroId: least };
  }
  return nextIntent(state, ctx, WOODLAND_POLICY, memory, legalIntents(state, ctx));
}

export type WoodlandGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-woodland-realm/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type WoodlandGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: WoodlandDecks; outcome: "won" | "lost"; policy?: Partial<WoodlandPolicy>; lossReason?: string };

// The games to pin (a few hundred intents in all, .claude/rules/code-standards.md, Test cost): wins true solo and two-handed with five of the nine pairs of stage cards (the policy's `stage2` and `stage3` take the first, the second or
// the third option of the first player's choices: A Chosen Path with On the Trail 51107 The Forest of Great Fear, "Don't Leave the Path" with To the Elvenking's Halls, Ambushed at Night with Escape from Taur-nu-Fuin, A Chosen Path with
// To the Elvenking's Halls), and the three ways to lose: every player's threat at 50 (heroes too small to quest), every hero destroyed (brittle heroes) and Mendor leaving play. The scenario has no Easy twin and no Nightmare deck.
export const WOODLAND_GOLDENS: readonly WoodlandGolden[] = [
  { name: "solo win: A Chosen Path, The Forest of Great Fear", seatCount: 1, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won", policy: { stage2: 0, stage3: 0 } },
  { name: "two-handed win: A Chosen Path, The Forest of Great Fear", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", policy: { stage2: 0, stage3: 0 } },
  { name: "solo win: Don't Leave the Path, To the Elvenking's Halls", seatCount: 1, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won", policy: { stage2: 1, stage3: 1 } },
  { name: "two-handed win: Ambushed at Night, Escape from Taur-nu-Fuin", seatCount: 2, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won", policy: { stage2: 2, stage3: 2 } },
  { name: "two-handed win: A Chosen Path, To the Elvenking's Halls", seatCount: 2, seed: 3, difficulty: "Normal", decks: "strong", outcome: "won", policy: { stage2: 0, stage3: 1 } },
  { name: "solo loss: threat 50", seatCount: 1, seed: 4, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "solo loss: every hero destroyed", seatCount: 1, seed: 3, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
  { name: "solo loss: Mendor leaves play", seatCount: 1, seed: 9, difficulty: "Normal", decks: "strong", outcome: "lost", policy: { stage2: 0, stage3: 0 }, lossReason: "Mendor left play" },
];

const game = standaloneGame<WoodlandDecks, WoodlandPolicy>({
  campaign: cycle,
  scenario: woodland,
  stats: HERO_STATS,
  // TODO: the cards a game loads besides the scenario's piles and its Nightmare deck.
  codes: woodland.cards.flatMap((card) => (card.back != null ? [card.code, card.back] : [card.code])),
  intent: woodlandIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: WoodlandGolden, ctx: ReduceContext): WoodlandGame => game.playGolden(golden, ctx);
