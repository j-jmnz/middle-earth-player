import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { modifiedStat } from "../../../src/rules/core/keywords.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";

const cycle = loadCampaign("the-hobbit");
const armies = loadAnyScenario("the-battle-of-five-armies");

// Test helper. A whole standalone game of The Battle of Five Armies played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. Bilbo Baggins is dealt as the loadout deals him (hob.bilbo-baggins-otd) and the players
// keep him out of every defense. The first player chooses, each round, the first stage in play that is not full (hob.current-quest-stage), and takes the first option of every other choice.
export const ARMIES_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "132001", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type ArmiesDecks = "strong" | "weak" | "brittle";

// The seats as the loadout deals them: Bilbo Baggins (132001) in front of the first seat's heroes (hob.bilbo-baggins-otd), his own deck beside the filler events (src/campaign/briefing.ts, loadoutOf).
// The enemies the golden decks meet attack the stand-in heroes, so the filler decks are what the players draw.
export const BILBO = "132001";
export function armiesLoadout(seatCount: 1 | 2) {
  const [first, ...rest] = fillerLoadout(seatCount);
  return [{ ...first!, heroes: [BILBO, ...first!.heroes] }, ...rest];
}

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const armiesWorld = (decks: ArmiesDecks = "strong") => game.world(decks);
export const armiesStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type ArmiesPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: ArmiesPolicy = { choose: "first" };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says. Every intent is one the reducer listed.
// The stage of a current-stage choice that still has room (progress below its quest points), else the first: the players advance when the three stages are complete together.
function stageToChoose(state: ScenarioState, ctx: ReduceContext, options: readonly string[]): string | undefined {
  if (!options.every((id) => state.cards[id]?.zone === "questStage")) return undefined;
  return options.find((id) => (state.cards[id]?.progress ?? 0) < modifiedStat(state, state.cards[id]!, "questPoints", ctx.cards)) ?? options[0];
}

// At stage 5 the heroes attack, a Bodyguard of Bolg first (Bolg takes no damage while one is in play, 132054:A:1), then Bolg, then any other enemy; Bilbo Baggins stays out of it.
const BODYGUARD = "132054";
const BOLG = "132053";
function bolgAttack(state: ScenarioState, ctx: ReduceContext): PlayerIntent | null {
  if (state.window?.kind !== "playerAttack" || state.cards[state.questStage ?? ""]?.code !== "132079") return null;
  if (!legalIntents(state, ctx).some((intent) => intent.type === "DeclareAttackers")) return null;
  const seat = state.seats[state.activeSeat];
  const strikers = [...(seat?.heroes ?? []), ...(seat?.play ?? [])].filter((id) => state.cards[id]?.code !== BILBO);
  const targets = strikers.flatMap((id) => legalTargets(state, { type: "DeclareAttackers", cardId: id }, ctx));
  const enemyId = [BODYGUARD, BOLG].map((code) => targets.find((id) => state.cards[id]?.code === code)).find((id) => id != null) ?? targets[0];
  if (!enemyId) return null;
  return { type: "DeclareAttackers", enemyId, attackerIds: strikers.filter((id) => legalTargets(state, { type: "DeclareAttackers", cardId: id }, ctx).includes(enemyId)) };
}

// The hero of the active seat with the most Attack, Bilbo Baggins apart, at stage 5: the one that does not quest.
function stageFiveStriker(state: ScenarioState, ctx: ReduceContext): string | null {
  if (state.cards[state.questStage ?? ""]?.code !== "132079") return null;
  const heroes = (state.seats[state.activeSeat]?.heroes ?? []).filter((id) => state.cards[id]?.code !== BILBO);
  return [...heroes].sort((a, b) => modifiedStat(state, state.cards[b]!, "attack", ctx.cards) - modifiedStat(state, state.cards[a]!, "attack", ctx.cards))[0] ?? null;
}

export function armiesIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: ArmiesPolicy = DEFAULT_POLICY): PlayerIntent {
  const attack = bolgAttack(state, ctx);
  if (attack) return attack;
  const kept = stageFiveStriker(state, ctx);
  // The hero that attacks Bolg defends nothing, so he is ready for the player attack phase.
  if (kept != null && state.window?.kind === "defense") {
    const defenders = legalIntents(state, ctx).some((intent) => intent.type === "DeclareDefender") ? legalTargets(state, { type: "DeclareDefender" }, ctx) : [];
    const defender = defenders.find((id) => id !== kept && state.cards[id]?.code !== BILBO);
    if (defender) return { type: "DeclareDefender", defenderId: defender };
    // A defender that must defend (Ravenous Warg, 132059:A:1) leaves no undefended attack: the default answer declares it.
    const heroes = legalIntents(state, ctx).some((intent) => intent.type === "Undefended") ? legalTargets(state, { type: "Undefended" }, ctx) : [];
    const hero = heroes.find((id) => id !== kept && state.cards[id]?.code !== BILBO) ?? heroes.find((id) => id !== kept);
    if (hero) return { type: "Undefended", heroId: hero };
  }
  // No progress can be placed on stage 5 (132079:B:2), but the staging area still threatens: every hero but the one that attacks Bolg quests, so the threat of the players holds.
  if (kept != null && state.mode === "questCommit" && state.window?.kind === "pass" && !Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) {
    const cardIds = legalTargets(state, { type: "Commit" }, ctx).filter((id) => id !== kept);
    if (cardIds.length > 0) return { type: "Commit", cardIds };
  }
  if (state.window?.kind === "choose") {
    const stage = stageToChoose(state, ctx, state.window.options);
    if (stage != null) return { type: "Choose", optionId: stage };
  }
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  return nextIntent(state, ctx, ARMIES_POLICY, memory, legalIntents(state, ctx));
}

export type ArmiesGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-battle-of-five-armies/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type ArmiesGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: ArmiesDecks; outcome: "won" | "lost"; policy?: Partial<ArmiesPolicy>; lossReason?: string };

// The games to pin (about 1,600 intents in all, .claude/rules/code-standards.md, Test cost): two-handed wins on Normal and Easy that reach stage 5 and destroy Bolg, and the two ways to lose, each true solo or two-handed: every player's threat at 50 and
// Bilbo Baggins leaving play. No true solo win: the one player controls Bilbo Baggins (Willpower 1) and two heroes, and no seed in 16 (1 to 8, Normal and Easy) gets past the staging area of stage 5 (each is lost with Bilbo Baggins gone).
export const ARMIES_GOLDENS: readonly ArmiesGolden[] = [
  { name: "two-handed win", seatCount: 2, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "Easy two-handed win", seatCount: 2, seed: 8, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "solo loss: Bilbo leaves play", seatCount: 1, seed: 4, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: "Bilbo Baggins left play" },
  { name: "two-handed loss: threat 50", seatCount: 2, seed: 6, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: Bilbo leaves play", seatCount: 2, seed: 11, difficulty: "Easy", decks: "strong", outcome: "lost", lossReason: "Bilbo Baggins left play" },
];

const game = standaloneGame<ArmiesDecks, ArmiesPolicy>({
  campaign: cycle,
  scenario: armies,
  stats: HERO_STATS,
  codes: [BILBO, ...armies.cards.map((card) => card.code)],
  loadout: armiesLoadout,
  intent: armiesIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: ArmiesGolden, ctx: ReduceContext): ArmiesGame => game.playGolden(golden, ctx);
