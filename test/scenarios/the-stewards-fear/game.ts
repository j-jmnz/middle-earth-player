import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { characters } from "../../../src/rules/combat/combat.ts";
import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { attackTogether, engageOneEach, fillerLoadout, HERO_STATS, standaloneGame, type HeroStats, type PlayedGame } from "../../harness/game-kit.ts";

const cycle = loadCampaign("against-the-shadow");
const fear = loadAnyScenario("the-stewards-fear");

// Test helper. A whole standalone game of The Steward's Fear played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. The last hero of each seat stays out of
// the quest (`reserve`), so a ready hero is left to defend and attack. The policy claims every Clue it may (`act`: the Action of each objective exhausts a hero, once a round), travels to the first location it may, so the
// Underworld locations are explored and release their stacks, attacks together, engages one enemy for each hero, defends with the first hero who can and answers every choice with its first option.
export const FEAR_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: true };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type FearDecks = "strong" | "weak" | "brittle";

// The numbers of the stand-in heroes: the shared ones, with a Defense big enough to turn the attacks of the Streets of Gondor and the Villains aside.
const FEAR_STATS = { strong: { ...HERO_STATS.strong, defense: 14 }, weak: HERO_STATS.weak, brittle: { ...HERO_STATS.brittle, defense: 14 } } as const satisfies Record<FearDecks, HeroStats>;

export const fearLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const fearWorld = (decks: FearDecks = "strong") => game.world(decks);
export const fearStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type FearPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
  // Heroes of each seat kept out of the quest, so they can defend and attack.
  reserve: number;
  // The most enemies a seat engages by choice.
  engage: number;
};
export const DEFAULT_POLICY: FearPolicy = { choose: "first", reserve: 2, engage: 3 };
const VILLAINS = ["06015", "06016", "06017"];

/** In a player attack window: the first ready character attacks alone, a Villain first, so each ready character in turn takes a different enemy. Null outside the window or when nobody can attack. */
export function attackOneAtATime(state: ScenarioState, ctx: ReduceContext): PlayerIntent | null {
  if (state.window?.kind !== "playerAttack") return null;
  const ready = characters(state, state.activeSeat, ctx.cards).filter((id) => legalTargets(state, { type: "DeclareAttackers", cardId: id }, ctx).length > 0);
  const one = ready[0];
  return one ? attackTogether(state, ctx, (id) => id === one, (enemy) => (VILLAINS.includes(state.cards[enemy]?.code ?? "") ? 0 : 1)) : null;
}

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says, the seat keeps its reserve out of the quest, attacks together and engages one enemy for each hero.
// Every intent is one the reducer listed.
export function fearIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: FearPolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") return { type: "Choose", optionId: chooseAnswer(state, policy) };
  const archery = archeryAnswer(state, ctx);
  if (archery) return archery;
  const defense = defenseAnswer(state, ctx);
  if (defense) return defense;
  const commit = commitAnswer(state, ctx, policy.reserve);
  if (commit) return commit;
  const attack = attackOneAtATime(state, ctx);
  if (attack) return attack;
  const engage = engageOneEach(state, ctx, policy.engage);
  if (engage) return engage;
  return nextIntent(state, ctx, FEAR_POLICY, memory, legalIntents(state, ctx));
}

// The option of a Choose window: the first or the last as the policy says, but Daughter of Berúthiel's "raise 4 threat to keep her engaged" is taken while no seat's threat is above 36, so the players can attack her.
function chooseAnswer(state: ScenarioState, policy: FearPolicy): string {
  const options = state.window?.kind === "choose" ? state.window.options : [];
  if (options.includes("raise") && options.includes("return")) return state.seats.every((seat) => seat.threat <= 36) ? "raise" : "return";
  return (policy.choose === "last" ? options.at(-1) : options[0]) ?? "";
}

/** The archery policy: the damage goes to the least damaged character. Null outside an archery window. */
export function archeryAnswer(state: ScenarioState, ctx: ReduceContext): PlayerIntent | null {
  if (state.window?.kind !== "archery") return null;
  const targets = legalTargets(state, { type: "Distribute" }, ctx);
  const least = [...targets].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
  return least ? { type: "Distribute", assignments: [{ cardId: least, amount: state.window.total }] } : null;
}

/**
 * In the defense window: the first ready hero but the seat's last one defends (the last hero stays ready to attack the Villain), and when none may, the least damaged hero takes the attack.
 * Null outside the defense window.
 */
export function defenseAnswer(state: ScenarioState, ctx: ReduceContext): PlayerIntent | null {
  if (state.window?.kind !== "defense") return null;
  const attacker = state.seats[state.activeSeat]?.heroes.at(-1);
  const defender = legalIntents(state, ctx).some((intent) => intent.type === "DeclareDefender") ? legalTargets(state, { type: "DeclareDefender" }, ctx).find((id) => id !== attacker) : undefined;
  if (defender) return { type: "DeclareDefender", defenderId: defender };
  const heroes = legalTargets(state, { type: "Undefended" }, ctx);
  const least = [...heroes].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
  return least ? { type: "Undefended", heroId: least } : null;
}

/** The quest commit of the seat: its characters but the last `reserve` heroes. Null outside the commit, or when the seat has committed. */
export function commitAnswer(state: ScenarioState, ctx: ReduceContext, reserve: number): PlayerIntent | null {
  if (state.mode !== "questCommit" || state.window?.kind !== "pass") return null;
  if (Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) return null;
  const home = new Set((state.seats[state.activeSeat]?.heroes ?? []).slice(-reserve));
  const ids = legalTargets(state, { type: "Commit" }, ctx).filter((id) => !home.has(id));
  return ids.length > 0 ? { type: "Commit", cardIds: ids } : null;
}

export type FearGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-stewards-fear/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type FearGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: FearDecks; outcome: "won" | "lost"; policy?: Partial<FearPolicy>; lossReason?: string };

// TODO: the games to pin (at most 3000 intents in all, .claude/rules/code-standards.md, Test cost), a few wins (true solo and two-handed, Normal and Nightmare) and a few losses (each way the scenario can be lost), each on a fixed seed.
export const FEAR_GOLDENS: readonly FearGolden[] = [];

const game = standaloneGame<FearDecks, FearPolicy>({
  campaign: cycle,
  scenario: fear,
  stats: FEAR_STATS,
  // TODO: the cards a game loads besides the scenario's piles and its Nightmare deck.
  codes: [...fear.cards.map((card) => card.code)],
  intent: fearIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: FearGolden, ctx: ReduceContext): FearGame => game.playGolden(golden, ctx);
