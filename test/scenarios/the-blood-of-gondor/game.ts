import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { characters, legalAttackEnemies } from "../../../src/rules/combat/combat.ts";
import { engageOneEach, fillerLoadout, HERO_STATS, playToEnd, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";

const cycle = loadCampaign("against-the-shadow");
const blood = loadAnyScenario("the-blood-of-gondor");

// Test helper. A whole standalone game of The Blood of Gondor played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. The policy: the combat start's choice
// takes the answers of `combat` in turn (`turn` or `take`, the list repeating), Faramir's choice of a player the first option, the players travel to the location with the fewest quest points (the Cross-roads included),
// quest with every hero but the reserve, engage the enemies by choice, defend with the first hero who may, attack one enemy for each character and use each Action (Faramir's and Lord Alcaron's among them).
export const BLOOD_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: true };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type BloodDecks = "strong" | "weak" | "brittle";

export const bloodLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const bloodWorld = (decks: BloodDecks = "strong") => game.world(decks);
export const bloodStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type BloodPolicy = {
  // The answers to The Ambush's choice at the start of combat, taken one after the other (the list repeats): `turn` the hidden cards or `take` another.
  combat: readonly ("turn" | "take")[];
  // Heroes of each seat kept out of the quest, so they can defend and attack.
  reserve: number;
  // The most enemies a seat engages by choice.
  engage: number;
  // The players keep away from The Cross-roads on stage 1 when false, so it is still in the staging area when stage 2 begins (where it gives the stage Siege and takes Battle away); true travels to it as any location.
  crossroads: boolean;
  // The seats play the cards of their hands (a saved decklist's allies and events); the stand-in heroes' decks hold only free events.
  play: boolean;
  // Faramir's and Lord Alcaron's Actions are never used when false.
  act: boolean;
};
export const DEFAULT_POLICY: BloodPolicy = { combat: ["take", "turn"], reserve: 2, engage: 3, crossroads: false, play: false, act: true };

export const AMBUSH = "06117";
export const CAPTURED = "06118";
export const FARAMIR = "06132";
export const ALCARON = "06133";
export const CROSSROADS = "06123";
const codeOf = (state: ScenarioState, id: string | null | undefined): string => state.cards[id ?? ""]?.code ?? "";

/** A Choose window: The Ambush's turn or take by the policy's list (the count of them answered so far is kept in `memory`), any other choice (Setup, Faramir's seat) the first option. */
function chooseAnswer(state: ScenarioState, policy: BloodPolicy, memory: Set<string>): PlayerIntent | null {
  if (state.window?.kind !== "choose") return null;
  const options = state.window.options;
  if (options.includes("turn") && options.includes("take")) {
    const used = [...memory].filter((key) => key.startsWith("combat:")).length;
    memory.add(`combat:${used}`);
    const wanted = policy.combat[used % policy.combat.length] ?? "take";
    return { type: "Choose", optionId: wanted };
  }
  return { type: "Choose", optionId: options[0] ?? "" };
}

const POINTS = new Map<string, number>();
/** In a travel window: the location with the fewest quest points (The Cross-roads only on stage 2, or on stage 1 when the policy goes there), else no travel. */
function travelAnswer(state: ScenarioState, ctx: ReduceContext, policy: BloodPolicy): PlayerIntent | null {
  if (state.window?.kind !== "travel") return null;
  const points = (id: string): number => {
    const code = codeOf(state, id);
    if (!POINTS.has(code)) POINTS.set(code, ctx.cards.get(code)?.questPoints ?? 99);
    return POINTS.get(code) ?? 99;
  };
  const best = legalTargets(state, { type: "Travel" }, ctx).filter((id) => policy.crossroads || codeOf(state, id) !== CROSSROADS || codeOf(state, state.questStage) !== AMBUSH).sort((left, right) => points(left) - points(right))[0];
  return best ? { type: "Travel", locationId: best } : { type: "DeclineTravel" };
}

/** In a quest commit: every character but the last `reserve` heroes and the two objective allies. */
function commitAnswer(state: ScenarioState, ctx: ReduceContext, policy: BloodPolicy): PlayerIntent | null {
  if (state.mode !== "questCommit" || state.window?.kind !== "pass") return null;
  if (Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) return null;
  const home = new Set((state.seats[state.activeSeat]?.heroes ?? []).slice(-policy.reserve));
  // The objective allies stay home: a committed Faramir is exhausted and cannot use his Action (the policy keeps him and Lord Alcaron for their Actions).
  const ids = legalTargets(state, { type: "Commit" }, ctx).filter((id) => !home.has(id) && ![FARAMIR, ALCARON].includes(codeOf(state, id)));
  return ids.length > 0 ? { type: "Commit", cardIds: ids } : null;
}

/** In a defense window: the first character who may defends, else the first hero is undefended. */
function defenseAnswer(state: ScenarioState, ctx: ReduceContext): PlayerIntent | null {
  if (state.window?.kind !== "defense") return null;
  const intents = legalIntents(state, ctx);
  const defender = intents.some((intent) => intent.type === "DeclareDefender") ? legalTargets(state, { type: "DeclareDefender" }, ctx)[0] : undefined;
  if (defender) return { type: "DeclareDefender", defenderId: defender };
  const heroes = legalTargets(state, { type: "Undefended" }, ctx);
  return heroes[0] ? { type: "Undefended", heroId: heroes[0] } : null;
}

/** In the player attack window: the first ready character that can reach an enemy attacks the first it can reach that no attack of the seat has declared this phase, alone. */
function attackAnswer(state: ScenarioState, ctx: ReduceContext): PlayerIntent | null {
  if (state.window?.kind !== "playerAttack" || !legalIntents(state, ctx).some((intent) => intent.type === "DeclareAttackers")) return null;
  for (const id of characters(state, state.activeSeat, ctx.cards)) {
    if (legalTargets(state, { type: "DeclareAttackers", cardId: id }, ctx).length === 0) continue;
    const enemy = legalAttackEnemies(state, state.activeSeat, id, ctx.cards).find((enemyId) => !state.declaredAttacks.includes(`${state.activeSeat}:${enemyId}`));
    if (enemy) return { type: "DeclareAttackers", enemyId: enemy, attackerIds: [id] };
  }
  return null;
}

/** Faramir's Action and Lord Alcaron's, each once a round when the engine offers it (to the controller only: the other seat is never offered them). */
function actionAnswer(state: ScenarioState, ctx: ReduceContext, policy: BloodPolicy, memory: Set<string>): PlayerIntent | null {
  if (!policy.act || state.window?.kind === "choose" || state.window?.kind === "chooseEnemy") return null;
  for (const intent of legalIntents(state, ctx)) {
    if (intent.type !== "Trigger" || ![`${FARAMIR}:action:1`, `${ALCARON}:action:1`].includes(intent.effectId)) continue;
    const key = `action:${state.round}:${intent.effectId}`;
    if (memory.has(key)) continue;
    memory.add(key);
    return { type: "Trigger", cardId: intent.cardId, effectId: intent.effectId };
  }
  return null;
}

// The auto-player's answer (test/harness/auto-player.ts), except: the choices, the travel, the commit, the defense, the attack and the engagement above. Every intent is one the reducer listed.
export function bloodIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: BloodPolicy = DEFAULT_POLICY): PlayerIntent {
  const choice = chooseAnswer(state, policy, memory);
  if (choice) return choice;
  const action = actionAnswer(state, ctx, policy, memory);
  if (action) return action;
  const travel = travelAnswer(state, ctx, policy);
  if (travel) return travel;
  const defense = defenseAnswer(state, ctx);
  if (defense) return defense;
  const commit = commitAnswer(state, ctx, policy);
  if (commit) return commit;
  const attack = attackAnswer(state, ctx);
  if (attack) return attack;
  const engage = engageOneEach(state, ctx, policy.engage);
  if (engage) return engage;
  if (state.window?.kind === "playerAttack") return { type: "DeclineAttack" };
  return nextIntent(state, ctx, { ...BLOOD_POLICY, play: policy.play, act: policy.act }, memory, legalIntents(state, ctx));
}

export type BloodGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-blood-of-gondor/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type BloodGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: BloodDecks; outcome: "won" | "lost"; policy?: Partial<BloodPolicy>; lossReason?: string };

// The games to pin (.claude/rules/code-standards.md, Test cost): a solo and a two-handed Normal win, an Easy two-handed win and a loss for each way to lose (the golden suite names each). The policy keeps The Cross-roads in the staging area
// until stage 2, so stage 2 has Siege in each win.
// - solo win (seed 13): the whole scenario in one game: hidden cards taken in the quest phase, by the combat choice, by a Travel cost and by a Shadow line, the combat choice's turn (an enemy engages and attacks in the same phase, a
//   location or treachery is discarded), Faramir's and Lord Alcaron's Actions, Captured! with the allies held under it, the turn at 5 hidden cards, The Cross-roads (Siege) and Conflict at the Crossroads, the win;
// - two-handed win (seed 10): the same moments for two players, the first-player token passing and with it the control of Faramir and Lord Alcaron, each Action used by the controller only;
// - Easy two-handed win (seed 29): the Easy deal (no Mordor Looms, no Conflict at the Crossroads, ...);
// - solo loss, Faramir leaves play (seed 5);
// - two-handed loss, Lord Alcaron leaves play (seed 2, weak heroes);
// - solo loss, every hero destroyed (seed 2, brittle heroes);
// - two-handed loss, threat 50 (seed 1, weak heroes).
export const BLOOD_GOLDENS: readonly BloodGolden[] = [
  { name: "solo win", seatCount: 1, seed: 13, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed win", seatCount: 2, seed: 10, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "Easy two-handed win", seatCount: 2, seed: 29, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "solo loss: Faramir leaves play", seatCount: 1, seed: 5, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: "Faramir left play" },
  { name: "two-handed loss: Lord Alcaron leaves play", seatCount: 2, seed: 2, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "Lord Alcaron left play" },
  { name: "solo loss: every hero destroyed", seatCount: 1, seed: 2, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: threat 50", seatCount: 2, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
];

const game = standaloneGame<BloodDecks, BloodPolicy>({
  campaign: cycle,
  scenario: blood,
  stats: HERO_STATS,
  codes: [...blood.cards.map((card) => card.code)],
  intent: bloodIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

// A golden keeps the state after each intent (`trail`), so the suite's checks read the moments between intents from the one play.
export const playGolden = (golden: BloodGolden, ctx: ReduceContext): BloodGame => {
  const policy = { ...DEFAULT_POLICY, ...golden.policy };
  return playToEnd(game.start(golden.seatCount, golden.seed, golden.difficulty), ctx, (state, memory) => bloodIntent(state, ctx, memory, policy), 6000, { trail: true });
};
