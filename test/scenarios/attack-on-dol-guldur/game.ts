import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { attackTogether, fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";

const cycle = loadCampaign("standalone-scenarios");
const guldur = loadAnyScenario("attack-on-dol-guldur");

// Test helper. A whole standalone game of Attack on Dol Guldur played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. The players quest with one hero, engage the enemies
// of the staging area one each and attack in turn, the enemies with the highest Siege value first (each one destroyed and each location explored lowers the city strength at the end of a stage 3 round) and the Lieutenant last (it
// is Indestructible until the city strength is 0), take every Response (Power of Lórien) and answer a choice with its first option: the progress of a stage 3's Forced effect before its penalty.
export const GULDUR_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: true };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type GuldurDecks = "strong" | "weak" | "brittle";

export const guldurLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const guldurWorld = (decks: GuldurDecks = "strong") => game.world(decks);
export const guldurStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type GuldurPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
  // The heroes a seat sends to the quest: the others defend and attack.
  questers: number;
  // The most enemies a seat is engaged with when it stops engaging more.
  engage: number;
};
export const DEFAULT_POLICY: GuldurPolicy = { choose: "first", questers: 1, engage: 2 };

// The Siege value of an enemy the players attack first (the printed value of the card, docs/scenarios/standalone-scenarios.md, Attack on Dol Guldur): the Host of Dol Guldur 4, the Mirkwood Olog-hai 3, the Beast 2, the others 1, the Lieutenants (Indestructible) last.
const SIEGE: Readonly<Record<string, number>> = { "50914": 4, "50915": 3, "50916": 2 };
const rankOf = (state: ScenarioState, enemyId: string): number => {
  const code = state.cards[enemyId]?.code ?? "";
  return LIEUTENANTS.includes(code) ? (cityAt0(state) ? 0 : 9) : 5 - (SIEGE[code] ?? 1);
};

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says; the players engage the enemies of the staging area one each and every hero attacks in turn. Every intent is one the reducer listed.
const LIEUTENANTS = ["50910", "50911", "50912", "50913"];
// The Lieutenants are Indestructible until the city strength is 0: the players leave them be (a Lieutenant engaged with a player stays so) until then.
const cityAt0 = (state: ScenarioState): boolean => Object.values(state.cards).some((card) => card.code === "50907" && card.resources === 0);
// The stage 3 the players move to, the one whose penalty hurts least first: the Dungeons (no ally, no discard), the Tower, the Battle, the Siege (3 city strength).
const STAGE_ORDER = ["50906", "50904", "50905", "50903"];

export function guldurIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: GuldurPolicy = DEFAULT_POLICY, options: PolicyOptions = GULDUR_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") {
    const stage = STAGE_ORDER.find((code) => state.window?.kind === "choose" && state.window.options.includes(code));
    if (stage) return { type: "Choose", optionId: stage };
    return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  }
  if (state.window?.kind === "optionalEngage") {
    const seat = state.seats[state.activeSeat];
    const targets = legalTargets(state, { type: "Engage" }, ctx).filter((id) => !LIEUTENANTS.includes(state.cards[id]?.code ?? "") || cityAt0(state)).sort((left, right) => rankOf(state, left) - rankOf(state, right));
    const enemy = targets[0];
    return enemy && seat && seat.engaged.length < policy.engage ? { type: "Engage", enemyId: enemy } : { type: "DeclineEngage" };
  }
  if (state.window?.kind === "playerAttack") {
    // Every hero that can attacks the first enemy of the ranking together (two heroes kill what one cannot); an enemy is attacked once in a phase (the memory holds the round and the enemy).
    const attack = attackTogether(state, ctx, () => true, (id) => rankOf(state, id));
    if (attack?.type === "DeclareAttackers" && !memory.has(`${state.round}:${attack.enemyId}`)) {
      memory.add(`${state.round}:${attack.enemyId}`);
      return attack;
    }
  }
  // The first heroes of a seat quest, the next defends and the last attacks (a character that quested or defended is exhausted, so a hero that does neither is ready for the combat phase).
  if (state.window?.kind === "pass" && state.mode === "questCommit" && !Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) {
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    if (ids.length > 0) return { type: "Commit", cardIds: ids.slice(0, policy.questers) };
  }
  if (state.window?.kind === "defense") {
    const heroes = state.seats[state.activeSeat]?.heroes ?? [];
    const attacker = heroes.at(-1);
    const defender = legalTargets(state, { type: "DeclareDefender" }, ctx).find((id) => id !== attacker && heroes.includes(id));
    if (defender) return { type: "DeclareDefender", defenderId: defender };
    const least = [...legalTargets(state, { type: "Undefended" }, ctx)].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (least) return { type: "Undefended", heroId: least };
  }
  return nextIntent(state, ctx, options, memory, legalIntents(state, ctx));
}

export type GuldurGame = PlayedGame;

// The goldens (src/campaign/scenarios/attack-on-dol-guldur/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type GuldurGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: GuldurDecks; outcome: "won" | "lost"; policy?: Partial<GuldurPolicy>; lossReason?: string };

// The games to pin (about 1500 intents in all, .claude/rules/code-standards.md, Test cost): wins true solo and two-handed on Normal (one hero quests, the others engage and attack the enemies with the most Siege value, the city strength falls
// to 0 at stage 3 and the Lieutenant is destroyed) and the one way to lose that the cards leave (the scenario has no city-strength loss): every player's threat at 50 (heroes too small to quest), and every hero destroyed (brittle heroes).
// The scenario has no Nightmare deck.
export const GULDUR_GOLDENS: readonly GuldurGolden[] = [
  { name: "solo win", seatCount: 1, seed: 3, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed win", seatCount: 2, seed: 3, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "solo loss: threat 50", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: every hero destroyed", seatCount: 2, seed: 2, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
];

const game = standaloneGame<GuldurDecks, GuldurPolicy>({
  campaign: cycle,
  scenario: guldur,
  stats: HERO_STATS,
  codes: [...guldur.cards.map((card) => card.code)],
  intent: guldurIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: GuldurGolden, ctx: ReduceContext): GuldurGame => game.playGolden(golden, ctx);
