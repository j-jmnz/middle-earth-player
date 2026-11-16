import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { attackDeclared, characters, legalAttackEnemies } from "../../../src/rules/combat/combat.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";

const LOUIS = "02038";
const cycle = loadCampaign("shadows-of-mirkwood");
const carrock = loadAnyScenario("conflict-at-the-carrock");

// Test helper. A whole standalone game of Conflict at the Carrock played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution.
export const CARROCK_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: true };
// "tense": big-number heroes that win, with a starting threat of 33 (the Trolls' engagement cost is 34, so a hero's low threat would never meet one); "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type CarrockDecks = "tense" | "weak" | "brittle";

export const carrockLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const carrockWorld = (decks: CarrockDecks = "tense") => game.world(decks);
export const carrockStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type CarrockPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: CarrockPolicy = { choose: "first" };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says. Every intent is one the reducer listed.
// The players fight the Trolls. One hero of each seat quests (his Willpower is more than the staging area's Threat) until a Troll is engaged; then all stay ready. They engage Louis alone first (his Forced effect raises the threat after every Troll's attack) and the other Trolls once he is dead, take
// every attack undefended (a Troll's damage is nothing to them; the Muck Adder, which discards a hero it damages, is defended when a hero can) and attack one Troll each, Louis first.
// `options` are the auto-player's for everything else (the Maestro fixtures play real decklists with `play: true`).
export function carrockIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: CarrockPolicy = DEFAULT_POLICY, options: PolicyOptions = CARROCK_POLICY): PlayerIntent {
  const window = state.window;
  if (window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? window.options.at(-1) : window.options[0]) ?? "" };
  const intents = legalIntents(state, ctx);
  if (window?.kind === "optionalEngage") {
    // Louis alone first (no other Troll is engaged while his Forced effect raises the threat), then the others, one for each hero.
    const options = legalTargets(state, { type: "Engage" }, ctx);
    const louis = options.find((id) => state.cards[id]?.code === LOUIS);
    const seat = state.seats[state.activeSeat];
    const enemyId = louis ?? options[0];
    const louisStays = louis == null && Object.values(state.cards).some((card) => card.code === LOUIS && card.zone === "engaged");
    if (enemyId && seat && !louisStays && seat.engaged.length < (louis ? 1 : seat.heroes.length)) return { type: "Engage", enemyId };
  }
  if (window?.kind === "playerAttack" && intents.some((intent) => intent.type === "DeclareAttackers")) {
    const seat = state.activeSeat;
    const ready = characters(state, seat, ctx.cards).find((id) => legalTargets(state, { type: "DeclareAttackers", cardId: id }, ctx).length > 0);
    const enemies = ready ? legalAttackEnemies(state, seat, ready, ctx.cards).filter((id) => !attackDeclared(state, seat, id)) : [];
    const enemyId = enemies.find((id) => state.cards[id]?.code === LOUIS) ?? enemies[0];
    if (ready && enemyId) return { type: "DeclareAttackers", enemyId, attackerIds: [ready] };
  }
  if (window?.kind === "pass" && state.mode === "questCommit" && intents.some((intent) => intent.type === "Commit")) {
    const quested = Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat);
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    // While a Troll is engaged every hero stays ready to attack; the quest has progress enough and is finished once they are dead.
    const fighting = state.seats.some((one) => one.engaged.some((id) => ctx.cards.get(state.cards[id]?.code ?? "")?.traits.includes("Troll")));
    if (!quested && !fighting && ids[0]) return { type: "Commit", cardIds: [ids[0]] };
    if (intents.some((intent) => intent.type === "Pass")) return { type: "Pass" };
  }
  if (window?.kind === "defense") {
    const heroes = legalTargets(state, { type: "Undefended" }, ctx);
    const defenders = intents.some((intent) => intent.type === "DeclareDefender") ? legalTargets(state, { type: "DeclareDefender" }, ctx) : [];
    const attacker = state.cards[window.enemyId]?.code;
    if (attacker === "02042" && defenders[0]) return { type: "DeclareDefender", defenderId: defenders[0] };
    // The damage is spread: the hero with the least takes it.
    const spread = [...heroes].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (spread) return { type: "Undefended", heroId: spread };
  }
  return nextIntent(state, ctx, options, memory, intents);
}

export type CarrockGame = PlayedGame;

// The goldens (src/campaign/scenarios/conflict-at-the-carrock/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type CarrockGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: CarrockDecks; outcome: "won" | "lost"; policy?: Partial<CarrockPolicy>; lossReason?: string };

// The games to pin (about 450 intents in all, .claude/rules/code-standards.md, Test cost): wins true solo and two-handed on Normal, Easy and Nightmare (the two Nightmare wins go through Against the Trolls to Grimbeorn's Folly and end when Rob and Bob is
// defeated), and the two losses the scenario has: every player's threat at 50 (heroes too weak to quest) and every hero destroyed. Nothing else in the scenario loses the game.
export const CARROCK_GOLDENS: readonly CarrockGolden[] = [
  { name: "solo win", seatCount: 1, seed: 1, difficulty: "Normal", decks: "tense", outcome: "won" },
  { name: "two-handed win", seatCount: 2, seed: 2, difficulty: "Normal", decks: "tense", outcome: "won" },
  { name: "Easy two-handed win", seatCount: 2, seed: 5, difficulty: "Easy", decks: "tense", outcome: "won" },
  { name: "Nightmare solo win", seatCount: 1, seed: 3, difficulty: "Nightmare", decks: "tense", outcome: "won" },
  { name: "Nightmare two-handed win", seatCount: 2, seed: 11, difficulty: "Nightmare", decks: "tense", outcome: "won" },
  { name: "solo loss: threat 50", seatCount: 1, seed: 3, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: every hero destroyed", seatCount: 2, seed: 3, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
];

const game = standaloneGame<CarrockDecks, CarrockPolicy>({
  campaign: cycle,
  scenario: carrock,
  // "tense": the heroes start at a threat of 33, so the Trolls (engagement cost 34) engage in the second round; they hit hard enough to kill a Troll (10 hit points, 2 Defense) alone and defend against everything Muck Adder (which discards a hero it damages) throws.
  stats: { ...HERO_STATS, tense: { threat: 11, willpower: 20, attack: 30, defense: 12, health: 100 } },
  codes: [...carrock.cards.map((card) => card.code)],
  intent: carrockIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: CarrockGolden, ctx: ReduceContext): CarrockGame => game.playGolden(golden, ctx);
