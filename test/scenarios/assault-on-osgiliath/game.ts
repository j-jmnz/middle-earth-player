import { TOWER } from "../../../src/rules/families/pelargir/ruined-tower.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { characters, legalAttackEnemies } from "../../../src/rules/combat/combat.ts";
import { engageOneEach, fillerLoadout, HERO_STATS, playToEnd, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";

const cycle = loadCampaign("against-the-shadow");
const assault = loadAnyScenario("assault-on-osgiliath");

// Test helper. A whole standalone game of Assault on Osgiliath played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. The policy: the Setup takes the enemy and
// the unique location the golden names (the first of each otherwise), the players travel to the Osgiliath location with the fewest quest points (Ruined Tower as the second active location whenever it is offered), quest with
// every hero but the reserve, engage the enemies by choice, defend with the first hero who may (or, as the golden says, let the first attacks go undefended while a unique location is controlled), attack together and use each Action.
export const ASSAULT_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: true };
// "strong": big-number heroes that win; "steady": strong with a willpower of 6, so the quest is slow and the Tower and its split come up; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type AssaultDecks = "strong" | "weak" | "brittle" | "steady";

export const assaultLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const assaultWorld = (decks: AssaultDecks = "strong") => game.world(decks);
export const assaultStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type AssaultPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
  // The code of the enemy a player takes at Setup ("" is the first one offered) and of the unique location (a card code).
  enemy: string;
  location: string;
  // Heroes of each seat kept out of the quest, so they can defend and attack.
  reserve: number;
  // The most enemies a seat engages by choice.
  engage: number;
  // The attacks the players let go undefended while they control a unique location (06096 to 06099): the first `undefended` of the game.
  undefended: number;
  // The travels to a location the players control (Caleb's ruling: the control is lost), the first `retravel` times a travel window offers one.
  retravel: number;
  // Ruined Tower is never traveled to when false.
  tower: boolean;
  // The seats play the cards of their hands (a saved decklist's allies and events); the stand-in heroes' decks hold only free events.
  play: boolean;
};
export const DEFAULT_POLICY: AssaultPolicy = { choose: "first", enemy: "", location: "", reserve: 2, engage: 3, undefended: 0, retravel: 0, tower: true, play: false };

export const RETAKE = "06091";
export const WEST_GATE = "06096";
/** The Osgiliath locations: the cards of the Assault on Osgiliath set that are locations (06096 to 06103). */
export const OSGILIATH: ReadonlySet<string> = new Set(["06096", "06097", "06098", "06099", "06100", "06101", "06102", TOWER]);
/** The unique locations the Setup offers. */
export const UNIQUE = ["06096", "06097", "06098", "06099"] as const;
export const HARADRIM_ELITE = "05053";
const codeOf = (state: ScenarioState, id: string | null | undefined): string => state.cards[id ?? ""]?.code ?? "";

/** The ids of the locations the players control (the table notes the first player's seat on the card). */
export const controlledIds = (state: ScenarioState): string[] => state.modifiers.filter((modifier) => modifier.stat === "controlSeat").map((modifier) => modifier.instanceId);
const controlsUnique = (state: ScenarioState): boolean => controlledIds(state).some((id) => (UNIQUE as readonly string[]).includes(codeOf(state, id)));

/** A Choose window: the Setup's enemy and unique location by the codes the policy names (an option is a card id for the enemy and a card code for the location), any other choice the first or last option. */
function chooseAnswer(state: ScenarioState, policy: AssaultPolicy): PlayerIntent | null {
  if (state.window?.kind !== "choose") return null;
  const options = state.window.options;
  const enemy = policy.enemy ? options.find((option) => codeOf(state, option) === policy.enemy) : undefined;
  const place = policy.location ? options.find((option) => option === policy.location) : undefined;
  return { type: "Choose", optionId: (enemy ?? place ?? (policy.choose === "last" ? options.at(-1) : options[0])) ?? "" };
}

const POINTS = new Map<string, number>();
/** In a travel window: a controlled location while `retravel` allows, Ruined Tower when `tower` allows, else the Osgiliath location with the fewest quest points, else the first target. */
function travelAnswer(state: ScenarioState, ctx: ReduceContext, policy: AssaultPolicy, memory: Set<string>): PlayerIntent | null {
  if (state.window?.kind !== "travel") return null;
  const targets = legalTargets(state, { type: "Travel" }, ctx);
  const used = [...memory].filter((key) => key.startsWith("retravel:")).length;
  const control = controlledIds(state);
  const again = used < policy.retravel ? targets.find((id) => control.includes(id)) : undefined;
  if (again) {
    memory.add(`retravel:${used}`);
    return { type: "Travel", locationId: again };
  }
  const usable = targets.filter((id) => !control.includes(id) && (policy.tower || codeOf(state, id) !== TOWER));
  const tower = usable.find((id) => codeOf(state, id) === TOWER);
  if (tower && state.activeLocation) return { type: "Travel", locationId: tower };
  const points = (id: string): number => {
    const code = codeOf(state, id);
    if (!POINTS.has(code)) POINTS.set(code, ctx.cards.get(code)?.questPoints ?? 99);
    return POINTS.get(code) ?? 99;
  };
  const best = [...usable].sort((left, right) => points(left) - points(right))[0];
  return best ? { type: "Travel", locationId: best } : { type: "DeclineTravel" };
}

/** In a quest commit: every character but the last `reserve` heroes. */
function commitAnswer(state: ScenarioState, ctx: ReduceContext, policy: AssaultPolicy): PlayerIntent | null {
  if (state.mode !== "questCommit" || state.window?.kind !== "pass") return null;
  if (Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) return null;
  const home = new Set((state.seats[state.activeSeat]?.heroes ?? []).slice(-policy.reserve));
  const ids = legalTargets(state, { type: "Commit" }, ctx).filter((id) => !home.has(id));
  return ids.length > 0 ? { type: "Commit", cardIds: ids } : null;
}

/** In a defense window: an attack goes undefended while a unique location is controlled and the policy still allows one, else the first hero who may defends. */
function defenseAnswer(state: ScenarioState, ctx: ReduceContext, policy: AssaultPolicy, memory: Set<string>): PlayerIntent | null {
  if (state.window?.kind !== "defense") return null;
  const intents = legalIntents(state, ctx);
  const used = [...memory].filter((key) => key.startsWith("undefended:")).length;
  if (used < policy.undefended && controlsUnique(state) && intents.some((intent) => intent.type === "Undefended")) {
    const target = legalTargets(state, { type: "Undefended" }, ctx)[0];
    if (target) {
      memory.add(`undefended:${used}`);
      return { type: "Undefended", heroId: target };
    }
  }
  const defender = intents.some((intent) => intent.type === "DeclareDefender") ? legalTargets(state, { type: "DeclareDefender" }, ctx)[0] : undefined;
  if (defender) return { type: "DeclareDefender", defenderId: defender };
  const heroes = legalTargets(state, { type: "Undefended" }, ctx);
  return heroes[0] ? { type: "Undefended", heroId: heroes[0] } : null;
}

/** In the player attack window: the first ready character that can reach an enemy attacks the first it can reach, alone (one enemy for each character, so many enemies are defeated in a round). */
function attackAnswer(state: ScenarioState, ctx: ReduceContext): PlayerIntent | null {
  if (state.window?.kind !== "playerAttack" || !legalIntents(state, ctx).some((intent) => intent.type === "DeclareAttackers")) return null;
  for (const id of characters(state, state.activeSeat, ctx.cards)) {
    if (legalTargets(state, { type: "DeclareAttackers", cardId: id }, ctx).length === 0) continue;
    const enemy = legalAttackEnemies(state, state.activeSeat, id, ctx.cards)[0];
    if (enemy) return { type: "DeclareAttackers", enemyId: enemy, attackerIds: [id] };
  }
  return null;
}

// The auto-player's answer (test/harness/auto-player.ts), except: the choices (the Setup's by code), the travel, the commit, the defense, the attack and the engagement above. Every intent is one the reducer listed.
export function assaultIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: AssaultPolicy = DEFAULT_POLICY): PlayerIntent {
  const choice = chooseAnswer(state, policy);
  if (choice) return choice;
  const travel = travelAnswer(state, ctx, policy, memory);
  if (travel) return travel;
  const defense = defenseAnswer(state, ctx, policy, memory);
  if (defense) return defense;
  const commit = commitAnswer(state, ctx, policy);
  if (commit) return commit;
  const attack = attackAnswer(state, ctx);
  if (attack) return attack;
  const engage = engageOneEach(state, ctx, policy.engage);
  if (engage) return engage;
  if (state.window?.kind === "playerAttack") return { type: "DeclineAttack" };
  return nextIntent(state, ctx, policy.play ? { ...ASSAULT_POLICY, play: true } : ASSAULT_POLICY, memory, legalIntents(state, ctx));
}

export type AssaultGame = PlayedGame;

// The goldens (src/campaign/scenarios/assault-on-osgiliath/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type AssaultGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: AssaultDecks; outcome: "won" | "lost"; policy?: Partial<AssaultPolicy>; lossReason?: string };

// The games to pin (.claude/rules/code-standards.md, Test cost): a solo and a two-handed Normal win, a win with a Haradrim Elite chosen at Setup, an Easy win and a loss for each way to lose (the golden suite names each).
// - solo win (seed 40, slow heroes): the whole scenario in one game: control taken nine times, one attack undefended, a travel to a controlled location, East Quarter's Battle and West Quarter's Siege, West Gate's Action
//   used twice (the second time from the players' play area), Ruined Tower the second active location with a progress share;
// - solo win, Haradrim Elite at Setup (seed 14): the Elite's Forced attack on entering the staging area at Setup;
// - two-handed win (seed 1): each player's Setup choices and the first player's control of every location taken;
// - Easy solo win (seed 25): the Easy deal (no Uruk Lieutenant, no Southron Commander);
// - solo loss, every hero destroyed (seed 71, brittle heroes): a Shadow of West Quarter makes the controller return the location he controls;
// - two-handed loss, threat 50 (seed 2, weak heroes).
export const ASSAULT_GOLDENS: readonly AssaultGolden[] = [
  { name: "solo win", seatCount: 1, seed: 40, difficulty: "Normal", decks: "steady", outcome: "won", policy: { retravel: 1, undefended: 1 } },
  { name: "solo win, Haradrim Elite at Setup", seatCount: 1, seed: 14, difficulty: "Normal", decks: "strong", outcome: "won", policy: { enemy: HARADRIM_ELITE } },
  { name: "two-handed win", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "Easy solo win", seatCount: 1, seed: 25, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "solo loss: every hero destroyed", seatCount: 1, seed: 31, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: threat 50", seatCount: 2, seed: 2, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
];

const game = standaloneGame<AssaultDecks, AssaultPolicy>({
  campaign: cycle,
  scenario: assault,
  stats: HERO_STATS,
  // The scenario deals no Nightmare deck and no card besides its own piles, so the codes are the scenario's cards.
  codes: [...assault.cards.map((card) => card.code)],
  intent: assaultIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

// A golden keeps the state after each intent (`trail`), so the suite's checks read the moments between intents from the one play.
export const playGolden = (golden: AssaultGolden, ctx: ReduceContext): AssaultGame => {
  const policy = { ...DEFAULT_POLICY, ...golden.policy };
  return playToEnd(game.start(golden.seatCount, golden.seed, golden.difficulty), ctx, (state, memory) => assaultIntent(state, ctx, memory, policy), 6000, { trail: true });
};
