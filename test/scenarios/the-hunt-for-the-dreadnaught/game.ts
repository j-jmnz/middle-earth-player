import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { attackTogether, engageOneEach, fillerLoadout, HERO_STATS, standaloneGame, type HeroStats, type PlayedGame } from "../../harness/game-kit.ts";

const cycle = loadCampaign("standalone-scenarios");
const dreadnaught = loadAnyScenario("the-hunt-for-the-dreadnaught");

// Test helper. A whole standalone game of The Hunt for the Dreadnaught played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. Each player takes the first ship offered, the
// first hero quests, the second defends and the last attacks; a Ship objective defends against every attack a Ship enemy makes (the Dreadnaught's included: left undefended, its damage is dealt to the player's ship and a ship
// destroyed eliminates a player with no other,) and attacks the Ship enemies. The enemies are attacked in this order: the unique Corsairs (their "cannot attack the Dreadnaught" holds until they are
// destroyed), then the Dreadnaught, then the rest. The auto-player alone never attacks, so it never wins.
export const DREADNAUGHT_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes and ships that win; "weak": heroes too small to quest, so the players lose on threat; "wrecked": strong heroes whose ship the first attack destroys, which eliminates its player; "fragile": strong questers
// that die to an attack, with ships that last.
export type DreadnaughtDecks = "strong" | "weak" | "wrecked" | "fragile";

export const dreadnaughtLoadout = fillerLoadout;

// The numbers a deck gives the box's ships over their printed ones (ships that last the game; "wrecked": a ship the first attack destroys) and the heroes (HERO_STATS, the fragile ones too brittle to survive an attack).
const FLEET = ["40006", "40007", "40008", "40009", "40010", "40011", "40012"];
const LASTING = { health: 60, defense: 8, attack: 12 };
const SHIP_STATS: Record<DreadnaughtDecks, Partial<HeroStats>> = { strong: LASTING, weak: LASTING, fragile: LASTING, wrecked: { health: 1, defense: 0 } };
const STATS: Record<DreadnaughtDecks, HeroStats> = { strong: HERO_STATS.strong, weak: HERO_STATS.weak, wrecked: HERO_STATS.strong, fragile: HERO_STATS.brittle };

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const dreadnaughtWorld = async (decks: DreadnaughtDecks = "strong") => {
  const made = await game.world(decks);
  for (const code of FLEET) made.cards.set(code, { ...made.cards.get(code)!, ...SHIP_STATS[decks] });
  return made;
};
export const dreadnaughtStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type DreadnaughtPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: DreadnaughtPolicy = { choose: "first" };

const isShip = (state: ScenarioState, ctx: ReduceContext, id: string): boolean => ctx.cards.get(state.cards[id]?.code ?? "")?.ship === "objective";
// The enemies attacked first: an engaged unique Corsair (its bar holds the characters off the Dreadnaught), then the Dreadnaught, then the rest.
const rankOf = (state: ScenarioState, enemyId: string): number => {
  const enemy = state.cards[enemyId];
  return enemy?.code === "40013" ? 1 : enemy?.zone === "engaged" && /^400(14|15|16|17|18|19)$/.test(enemy.code) ? 0 : 2;
};

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says; a Ship objective defends against a Ship enemy and no other character does; the heroes attack in turn.
// Every intent is one the reducer listed.
export function dreadnaughtIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: DreadnaughtPolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  if (state.window?.kind === "optionalEngage") return engageOneEach(state, ctx) ?? { type: "DeclineEngage" };
  if (state.window?.kind === "playerAttack") {
    // One character at a time, so the others may attack another enemy in the next window; a seat attacks an enemy once in a phase (the memory holds the round and the enemy).
    const seat = state.seats[state.activeSeat];
    const who = [...(seat?.heroes ?? []), ...Object.values(state.cards).filter((card) => card.controller === state.activeSeat && isShip(state, ctx, card.id)).map((card) => card.id)];
    const attack = who.map((one) => attackTogether(state, ctx, (id) => id === one, (id) => rankOf(state, id))).find((intent) => intent?.type === "DeclareAttackers" && !memory.has(`${state.round}:${state.activeSeat}:${intent.enemyId}`));
    if (attack?.type === "DeclareAttackers") {
      memory.add(`${state.round}:${state.activeSeat}:${attack.enemyId}`);
      return attack;
    }
  }
  // The first hero of a seat quests (a character that quested or defended is exhausted, so the others are ready for the combat phase).
  if (state.window?.kind === "pass" && state.mode === "questCommit" && !Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) {
    const heroes = state.seats[state.activeSeat]?.heroes ?? [];
    const ids = legalTargets(state, { type: "Commit" }, ctx).filter((id) => heroes.includes(id));
    if (ids.length > 0) return { type: "Commit", cardIds: ids.slice(0, 1) };
  }
  if (state.window?.kind === "defense") {
    const heroes = state.seats[state.activeSeat]?.heroes ?? [];
    const candidates = legalTargets(state, { type: "DeclareDefender" }, ctx);
    // A Ship objective defends against a Ship enemy; the second hero defends against any other.
    const ship = candidates.find((id) => isShip(state, ctx, id));
    const defender = ship ?? candidates.find((id) => id !== heroes.at(-1) && heroes.includes(id));
    if (defender) return { type: "DeclareDefender", defenderId: defender };
    const least = [...legalTargets(state, { type: "Undefended" }, ctx)].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (least) return { type: "Undefended", heroId: least };
  }
  return nextIntent(state, ctx, DREADNAUGHT_POLICY, memory, legalIntents(state, ctx));
}

export type DreadnaughtGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-hunt-for-the-dreadnaught/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card of the players' choosing: Normal deals Standard Mode, Easy deals Easy Mode.
export type DreadnaughtGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: DreadnaughtDecks; outcome: "won" | "lost"; policy?: Partial<DreadnaughtPolicy>; lossReason?: string };

// The games to pin (about 1000 intents in all, .claude/rules/code-standards.md, Test cost): wins true solo and two-handed on Normal and solo on Easy (stage 1B's two rounds, the unique Corsairs the flip brings, the Dreadnaught
// destroyed at stage 2B), and the ways to lose: every player's threat at 50 (heroes too small to quest), no ship-objective left (the players' ships are destroyed, which eliminates them) and every hero destroyed.
export const DREADNAUGHT_GOLDENS: readonly DreadnaughtGolden[] = [
  { name: "solo win", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed win", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "solo win on Easy", seatCount: 1, seed: 3, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "solo loss: threat 50", seatCount: 1, seed: 2, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: no ship-objective", seatCount: 2, seed: 2, difficulty: "Normal", decks: "wrecked", outcome: "lost", lossReason: "No seats remain" },
  { name: "solo loss: every hero destroyed", seatCount: 1, seed: 1, difficulty: "Normal", decks: "fragile", outcome: "lost", lossReason: "No seats remain" },
];

const game = standaloneGame<DreadnaughtDecks, DreadnaughtPolicy>({
  campaign: cycle,
  scenario: dreadnaught,
  stats: STATS,
  // The scenario's own cards (the fleet, the Corsairs, the Dreadnaught); the mode cards and the quest stages come with the world.
  codes: [...dreadnaught.cards.map((card) => card.code)],
  intent: dreadnaughtIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: DreadnaughtGolden, ctx: ReduceContext): DreadnaughtGame => game.playGolden(golden, ctx);
