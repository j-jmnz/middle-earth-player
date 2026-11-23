import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { modifiedStat } from "../../../src/rules/core/keywords.ts";
import { nextIntent, triggerPayments, type PolicyOptions } from "../../harness/auto-player.ts";
import { fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";

const cycle = loadCampaign("the-hobbit");
const armies = loadAnyScenario("the-battle-of-five-armies");

// Test helper. A whole standalone game of The Battle of Five Armies played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. Bilbo Baggins is dealt as the loadout deals him (hob.bilbo-baggins-otd) and the players
// keep him out of every defense. The first player chooses, each round, the first stage in play that is not full (hob.current-quest-stage); a choice among characters or an archery total names a character other than Bilbo Baggins; the first player pays for the Misty Mountain Eagle's Action; at stage 5 a Bodyguard of Bolg is engaged and attacked first; every other choice takes the first option.
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

// Bilbo Baggins takes no damage the players choose: a choice among characters, or an archery total, names another character when there is one (his Willpower 1 and 2 hit points make him the first to leave play, and the players lose with him).
const notBilbo = (state: ScenarioState, ids: readonly string[]): string | undefined => ids.find((id) => state.cards[id] != null && state.cards[id]?.code !== BILBO);

// The Misty Mountain Eagle's Action (132052:A:1), once a round: the first player pays 2 Baggins resources to take control of it, so the Eagle fights for the players.
function eagleAction(state: ScenarioState, ctx: ReduceContext, memory: Set<string>): PlayerIntent | null {
  if (state.window?.kind !== "pass" && state.window?.kind !== "response") return null;
  const trigger = legalIntents(state, ctx).find((intent) => intent.type === "Trigger" && state.cards[intent.cardId]?.code === "132052" && !memory.has(`eagle:${state.round}`));
  if (!trigger || trigger.type !== "Trigger") return null;
  const payments = triggerPayments(state, ctx, trigger);
  if (!payments) return null;
  memory.add(`eagle:${state.round}`);
  return { type: "Trigger", cardId: trigger.cardId, effectId: trigger.effectId, payments };
}

// At stage 5 a Bodyguard of Bolg is engaged when the rules offer it, so the heroes can attack it: Bolg takes no damage while one is in play (132054:A:1).
function engageBodyguard(state: ScenarioState, ctx: ReduceContext): PlayerIntent | null {
  if (state.window?.kind !== "optionalEngage" || state.cards[state.questStage ?? ""]?.code !== "132079") return null;
  const target = legalTargets(state, { type: "Engage" }, ctx).find((id) => state.cards[id]?.code === BODYGUARD);
  return target ? { type: "Engage", enemyId: target } : null;
}

export function armiesIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: ArmiesPolicy = DEFAULT_POLICY): PlayerIntent {
  const attack = bolgAttack(state, ctx);
  if (attack) return attack;
  const engage = engageBodyguard(state, ctx);
  if (engage) return engage;
  const eagle = eagleAction(state, ctx, memory);
  if (eagle) return eagle;
  if (state.window?.kind === "archery") {
    const recipients = legalTargets(state, { type: "Distribute" }, ctx);
    const recipient = notBilbo(state, recipients) ?? recipients[0];
    if (recipient) return { type: "Distribute", assignments: [{ cardId: recipient, amount: state.window.total }] };
  }
  // A defender that must defend (Ravenous Warg, 132059:A:1) leaves no undefended attack.
  if (state.window?.kind === "defense" && !legalIntents(state, ctx).some((intent) => intent.type === "Undefended")) {
    const defenders = legalTargets(state, { type: "DeclareDefender" }, ctx);
    const defender = notBilbo(state, defenders) ?? defenders[0];
    if (defender && state.cards[state.questStage ?? ""]?.code !== "132079") return { type: "DeclareDefender", defenderId: defender };
  }
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
    // A choice among cards that includes Bilbo Baggins names another one.
    const other = state.window.options.some((id) => state.cards[id]?.code === BILBO) ? notBilbo(state, state.window.options) : undefined;
    if (other != null) return { type: "Choose", optionId: other };
  }
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  return nextIntent(state, ctx, ARMIES_POLICY, memory, legalIntents(state, ctx));
}

export type ArmiesGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-battle-of-five-armies/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type ArmiesGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: ArmiesDecks; outcome: "won" | "lost"; policy?: Partial<ArmiesPolicy>; lossReason?: string };

// The games to pin (about 600 intents in all, .claude/rules/code-standards.md, Test cost): a true solo win and two-handed wins on Normal and Easy that reach stage 5 and destroy Bolg, and the two ways to lose: every player's threat at 50 (heroes too small to quest, true solo) and
// Bilbo Baggins leaving play (heroes that die to an attack, two-handed). The seeds are ordinary ones: every seed 1 to 10 on Normal and Easy, solo and two-handed, is won by the policy with the strong decks.
export const ARMIES_GOLDENS: readonly ArmiesGolden[] = [
  { name: "solo win", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed win", seatCount: 2, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "Easy two-handed win", seatCount: 2, seed: 1, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "solo loss: threat 50", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: Bilbo leaves play", seatCount: 2, seed: 2, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "Bilbo Baggins left play" },
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
