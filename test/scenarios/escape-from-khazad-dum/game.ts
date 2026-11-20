import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { attackTogether, engageOneEach, fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";

const cycle = loadCampaign("standalone-scenarios");
const khazad = loadAnyScenario("escape-from-khazad-dum");
const DARK_PIT = "51310";
const BANE = "51311";
const STAGES_2 = ["51303", "51304", "51305"];
const STAGES_3 = ["51307", "51308", "51309"];

// Test helper. A whole standalone game of Escape from Khazad-dûm played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. The players engage the enemies of the staging area one each and attack in turn, Durin's Bane first (stage 3B Last Lord of Moria cannot be defeated while it is in play); a seat with several heroes sends one to quest and keeps the others to defend. The first player's stage choices are the policy's; the players travel to Dark Pit first and explore it there (stage 1B cannot be defeated while it is in play).
export const KHAZAD_POLICY: PolicyOptions = { scout: "", prefer: DARK_PIT, protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack; "steady": strong attackers with a willpower of 6, so the quest goes slowly.
export type KhazadDecks = "strong" | "weak" | "brittle" | "steady";

export const khazadLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const khazadWorld = (decks: KhazadDecks = "strong") => game.world(decks);
export const khazadStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type KhazadPolicy = {
  // The stage 2 card (51303, 51304, 51305) and the stage 3 card (51307, 51308, 51309) the first player takes: the first, the second or the third option of those Choose windows. Every other choice takes the first option.
  stage2: 0 | 1 | 2;
  stage3: 0 | 1 | 2;
  // Nobody defends: every attack is undefended, so Durin's Bane's attacks on The Bridge of Khazad-dûm put all their damage on the stage (the loss of 51307:B:3).
  undefended: boolean;
};
export const DEFAULT_POLICY: KhazadPolicy = { stage2: 0, stage3: 0, undefended: false };

// The auto-player's answer (test/harness/auto-player.ts), except: the first player's stage choices are the policy's and every other choice takes the first option. Every intent is one the reducer listed.
export function khazadIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: KhazadPolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") {
    const options = state.window.options;
    const stage = (codes: readonly string[]): boolean => options.length === 3 && options.every((option) => codes.includes(state.cards[option]?.code ?? option));
    if (stage(STAGES_2)) return { type: "Choose", optionId: options[policy.stage2] ?? "" };
    if (stage(STAGES_3)) return { type: "Choose", optionId: options[policy.stage3] ?? "" };
    return { type: "Choose", optionId: options[0] ?? "" };
  }
  if (state.window?.kind === "optionalEngage") return engageOneEach(state, ctx) ?? { type: "DeclineEngage" };
  if (state.window?.kind === "playerAttack") {
    // One hero at a time, so the others may attack another enemy in the next window; an enemy is attacked once in a phase (the memory holds the round and the enemy). Durin's Bane first.
    const seat = state.seats[state.activeSeat];
    const attack = (seat?.heroes ?? []).map((one) => attackTogether(state, ctx, (id) => id === one, (id) => (state.cards[id]?.code === BANE ? 0 : 1))).find((intent) => intent?.type === "DeclareAttackers" && !memory.has(`${state.round}:${intent.enemyId}`));
    if (attack?.type === "DeclareAttackers") {
      memory.add(`${state.round}:${attack.enemyId}`);
      return attack;
    }
  }
  if (state.window?.kind === "pass" && state.mode === "questCommit" && !Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) {
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    if (ids.length > 0 && (state.seats[state.activeSeat]?.heroes.length ?? 0) > 1) return { type: "Commit", cardIds: ids.slice(0, 1) };
  }
  if (state.window?.kind === "defense" && policy.undefended) return { type: "Undefended", heroId: legalTargets(state, { type: "Undefended" }, ctx)[0] };
  if (state.window?.kind === "defense") {
    const heroes = state.seats[state.activeSeat]?.heroes ?? [];
    const attacker = heroes.at(-1);
    const defender = legalTargets(state, { type: "DeclareDefender" }, ctx).find((id) => id !== attacker && heroes.includes(id));
    if (defender) return { type: "DeclareDefender", defenderId: defender };
  }
  return nextIntent(state, ctx, KHAZAD_POLICY, memory, legalIntents(state, ctx));
}

export type KhazadGame = PlayedGame;

// The goldens (src/campaign/scenarios/escape-from-khazad-dum/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type KhazadGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: KhazadDecks; outcome: "won" | "lost"; policy?: Partial<KhazadPolicy>; lossReason?: string };

// The games to pin (at most 3000 intents in all, .claude/rules/code-standards.md, Test cost): wins true solo and two-handed with different pairs of stage cards (Last Lord of Moria needs Durin's Bane killed), and the three ways to lose: the stage holds damage
// equal to its quest points (nobody defends Durin's Bane's attacks), every player's threat at 50 (heroes too small to quest) and every hero destroyed (brittle heroes). The scenario has no Easy twin and no Nightmare deck.
export const KHAZAD_GOLDENS: readonly KhazadGolden[] = [
  { name: "solo win: A Wrong Turn, The Bridge of Khazad-dûm", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", policy: { stage2: 1, stage3: 0 } },
  { name: "solo win: Old One Lair, The Bridge of Khazad-dûm", seatCount: 1, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won", policy: { stage2: 0, stage3: 0 } },
  { name: "solo win: A Way Up, The Rear Guard", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", policy: { stage2: 2, stage3: 2 } },
  { name: "two-handed win: Old One Lair, Last Lord of Moria", seatCount: 2, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won", policy: { stage2: 0, stage3: 1 } },
  { name: "two-handed win: A Wrong Turn, The Rear Guard", seatCount: 2, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won", policy: { stage2: 1, stage3: 2 } },
  { name: "two-handed win: A Way Up, The Bridge of Khazad-dûm", seatCount: 2, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won", policy: { stage2: 2, stage3: 0 } },
  { name: "solo loss: Durin's Bane's undefended attacks put 10 damage on the stage", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "lost", policy: { stage2: 1, stage3: 0, undefended: true }, lossReason: "Nearing the Gate holds" },
  { name: "solo loss: threat 50", seatCount: 1, seed: 4, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "solo loss: every hero destroyed", seatCount: 1, seed: 2, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
];

const game = standaloneGame<KhazadDecks, KhazadPolicy>({
  campaign: cycle,
  scenario: khazad,
  stats: HERO_STATS,
  codes: khazad.cards.flatMap((card) => (card.back != null ? [card.code, card.back] : [card.code])),
  intent: khazadIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: KhazadGolden, ctx: ReduceContext): KhazadGame => game.playGolden(golden, ctx);
