import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { effectById } from "../../../src/rules/windows/listen.ts";
import { topFrame } from "../../../src/rules/windows/windows.ts";
import { characters } from "../../../src/rules/combat/combat.ts";
import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { attackTogether, engageOneEach, fillerLoadout, HERO_STATS, playToEnd, standaloneGame, type HeroStats, type PlayedGame } from "../../harness/game-kit.ts";

const cycle = loadCampaign("against-the-shadow");
const druadan = loadAnyScenario("the-druadan-forest");

// Test helper. A whole standalone game of The Drúadan Forest played by the auto-player, true solo or two-handed. The heroes are stand-ins (a Willpower that quests on stages 1 and 2, a Defense that quests on stage 3, a big
// Attack for the Woses of stages 1 and 2) and the decks free events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part,
// no Resolution. The policy keeps `reserve` heroes of each seat out of the quest, travels to the first location it may (Garden of Poisons asks each player for a resource, Ancestral Clearing exhausts a ready hero), engages up to
// `engage` enemies by choice, defends with the first hero who may, sends archery damage to the least damaged character (allies first: the engine lists only them while any is in play), and attacks together, Drû-buri-Drû
// first. On stage 3 (a Siege stage) the quest counts Defense and an attack counts Willpower, so the reserve heroes attack with their Willpower and the damage they deal is progress on the enemy. Choices: pay the resource of a
// pay-or-suffer card, discard the Prowl resources, keep the enemy of a shadow engaged by paying for it.
export const DRUADAN_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type DruadanDecks = "strong" | "weak" | "brittle";

// The numbers of the stand-in heroes: a Willpower of 8 (a stage 3 attack deals 5 progress to Drû-buri-Drû, Defense 3, so two attackers fill his 6 hit points and the stage 3 attack of one hero fills a Wose's).
const DRUADAN_STATS = { strong: { ...HERO_STATS.steady, willpower: 8 }, weak: HERO_STATS.weak, brittle: { ...HERO_STATS.brittle, willpower: 8 } } as const satisfies Record<DruadanDecks, HeroStats>;

export const druadanLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const druadanWorld = (decks: DruadanDecks = "strong") => game.world(decks);
export const druadanStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type DruadanPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
  // Heroes of each seat kept out of the quest, so they can defend and attack.
  reserve: number;
  // The most enemies a seat engages by choice.
  engage: number;
  // The seats play the cards of their hands (a saved decklist's allies take the archery damage); the stand-in heroes' decks hold only free events.
  play: boolean;
};
export const DEFAULT_POLICY: DruadanPolicy = { choose: "first", reserve: 2, engage: 3, play: false };
const DRU = "06045";
const PASSAGE_OUT = "06044";
// The quest points of stage 3 (14).
const QUEST_POINTS = 14;

/**
 * In a player attack window. On stage 3 (a Siege stage: an attack counts Willpower and its damage is progress on the enemy) every ready character attacks together, Drû-buri-Drû first, so two attackers fill his hit
 * points; on stages 1 and 2 the first ready character attacks alone, so each ready character in turn takes a different Wose. Null outside the window or when nobody can attack.
 */
export function attackDruFirst(state: ScenarioState, ctx: ReduceContext): PlayerIntent | null {
  if (state.window?.kind !== "playerAttack") return null;
  const rank = (enemy: string) => (state.cards[enemy]?.code === DRU ? 0 : 1);
  if (state.cards[state.questStage ?? ""]?.code === PASSAGE_OUT) return attackTogether(state, ctx, () => true, rank);
  const ready = characters(state, state.activeSeat, ctx.cards).filter((id) => legalTargets(state, { type: "DeclareAttackers", cardId: id }, ctx).length > 0);
  const one = ready[0];
  return one ? attackTogether(state, ctx, (id) => id === one, rank) : null;
}

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says (the pay of a pay-or-suffer card first), the seat keeps its reserve out of the quest, attacks
// together and engages up to `engage` enemies. Every intent is one the reducer listed.
export function druadanIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: DruadanPolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") return { type: "Choose", optionId: chooseAnswer(state, policy) };
  const archery = archeryAnswer(state, ctx);
  if (archery) return archery;
  const defense = defenseAnswer(state, ctx);
  if (defense) return defense;
  const commit = commitAnswer(state, ctx, policy.reserve);
  if (commit) return commit;
  const attack = attackDruFirst(state, ctx);
  if (attack) return attack;
  const engage = engageOneEach(state, ctx, policy.engage);
  if (engage) return engage;
  return nextIntent(state, ctx, policy.play ? { ...DRUADAN_POLICY, play: true } : DRUADAN_POLICY, memory, legalIntents(state, ctx));
}

// The option of a Choose window: the pay of a pay-or-suffer card (and the discard of a Prowl) when it is offered, else the first or the last as the policy says.
function chooseAnswer(state: ScenarioState, policy: DruadanPolicy): string {
  const options = state.window?.kind === "choose" ? state.window.options : [];
  const paid = options.find((option) => option === "pay" || option === "discard");
  return paid ?? (policy.choose === "last" ? options.at(-1) : options[0]) ?? "";
}

/** The archery policy: the damage goes to the least damaged character (the engine lists only allies while any is in play). Null outside an archery window. */
export function archeryAnswer(state: ScenarioState, ctx: ReduceContext): PlayerIntent | null {
  if (state.window?.kind !== "archery") return null;
  const targets = legalTargets(state, { type: "Distribute" }, ctx);
  const least = [...targets].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
  return least ? { type: "Distribute", assignments: [{ cardId: least, amount: state.window.total }] } : null;
}

/** In the defense window: the first ready character defends (the reserve is the last hero, so it may stay ready only if another may defend), else the least damaged hero takes the attack. Null outside the window. */
export function defenseAnswer(state: ScenarioState, ctx: ReduceContext): PlayerIntent | null {
  if (state.window?.kind !== "defense") return null;
  const defender = legalIntents(state, ctx).some((intent) => intent.type === "DeclareDefender") ? legalTargets(state, { type: "DeclareDefender" }, ctx)[0] : undefined;
  // On stage 3 a hero with health to spare takes the attack undefended, so every hero stays ready to attack Drû-buri-Drû.
  const stageThree = state.cards[state.questStage ?? ""]?.code === PASSAGE_OUT;
  const spare = stageThree && legalIntents(state, ctx).some((intent) => intent.type === "Undefended") && legalTargets(state, { type: "Undefended" }, ctx).some((id) => (ctx.cards.get(state.cards[id]?.code ?? "")?.health ?? 0) - (state.cards[id]?.damage ?? 0) > 20);
  if (defender && !spare) return { type: "DeclareDefender", defenderId: defender };
  const heroes = legalTargets(state, { type: "Undefended" }, ctx);
  const least = [...heroes].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
  return least ? { type: "Undefended", heroId: least } : null;
}

/** The quest commit of the seat: its characters but the last `reserve` heroes. Null outside the commit, or when the seat has committed. */
export function commitAnswer(state: ScenarioState, ctx: ReduceContext, reserve: number): PlayerIntent | null {
  if (state.mode !== "questCommit" || state.window?.kind !== "pass") return null;
  if (Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) return null;
  // On stage 3 the quest is full once its progress is enough (the win waits for Drû-buri-Drû): every hero stays home to attack him.
  const stage = state.cards[state.questStage ?? ""];
  const full = stage?.code === PASSAGE_OUT && stage.progress >= QUEST_POINTS;
  const home = new Set((state.seats[state.activeSeat]?.heroes ?? []).slice(full ? -3 : -reserve));
  const ids = legalTargets(state, { type: "Commit" }, ctx).filter((id) => !home.has(id));
  return ids.length > 0 ? { type: "Commit", cardIds: ids } : null;
}

export type DruadanGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-druadan-forest/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type DruadanGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: DruadanDecks; outcome: "won" | "lost"; policy?: Partial<DruadanPolicy>; lossReason?: string };

// The games to pin (.claude/rules/code-standards.md, Test cost): a solo and a two-handed Normal win, one Easy win and a loss for each way to lose (the threat of every player at 50, every hero destroyed).
// - solo win: one seat keeps two heroes home and one quests; the Prowl discards come from the one seat's heroes;
// - two-handed win (seed 6, five rounds): Prowl resources are discarded from the heroes of both seats, and Drû-buri-Drû fills with progress from attacks made with Willpower on stage 3;
// - Easy two-handed win: the Easy deal (fewer Woses and treacheries) wins in a few rounds;
// - losses: threat 50 (heroes too weak to quest, solo) and every hero destroyed (heroes too brittle, two-handed).
export const DRUADAN_GOLDENS: readonly DruadanGolden[] = [
  { name: "solo win", seatCount: 1, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed win", seatCount: 2, seed: 6, difficulty: "Normal", decks: "strong", outcome: "won", policy: { reserve: 1 } },
  { name: "Easy two-handed win", seatCount: 2, seed: 8, difficulty: "Easy", decks: "strong", outcome: "won", policy: { reserve: 1 } },
  { name: "solo loss: threat 50", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: every hero destroyed", seatCount: 2, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
];

const game = standaloneGame<DruadanDecks, DruadanPolicy>({
  campaign: cycle,
  scenario: druadan,
  stats: DRUADAN_STATS,
  // The scenario deals no Nightmare deck and no card besides its own piles, so the codes are the scenario's cards.
  codes: [...druadan.cards.map((card) => card.code)],
  intent: druadanIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

// A golden keeps the state after each intent (`trail`), so the suite's checks read the moments between intents (the Prowl discards) from the one play.
export const playGolden = (golden: DruadanGolden, ctx: ReduceContext): DruadanGame => {
  const policy = { ...DEFAULT_POLICY, ...golden.policy };
  return playToEnd(game.start(golden.seatCount, golden.seed, golden.difficulty), ctx, (state, memory) => druadanIntent(state, ctx, memory, policy), 6000, { trail: true });
};

const resourcesOf = (state: ScenarioState, seat: number): number => (state.seats[seat]?.heroes ?? []).reduce((sum, id) => sum + (state.cards[id]?.resources ?? 0), 0);

/** Whether the open window is a Prowl's: a choice of the frame of an effect whose record holds the GroupDiscardResources verb (its discard or stop, or the hero to discard from). Another payment among a seat's own heroes (Garden of Poisons' travel, a shadow's payment) is not. */
export function isProwlWindow(state: ScenarioState, ctx: Pick<ReduceContext, "effects">): boolean {
  if (state.window?.kind !== "choose") return false;
  const data = topFrame(state)?.data;
  const record = data?.kind === "effect" ? effectById(ctx, data.effectId) : undefined;
  return record?.instructions.some((step) => step.verb === "GroupDiscardResources") ?? false;
}

/**
 * The seats whose heroes a Prowl discarded resources from, read from the trail: an intent that answers a Prowl window (`isProwlWindow`) and leaves that seat's heroes with fewer resources.
 */
export function prowlSeats(played: Pick<PlayedGame, "kept" | "intents" | "trail">, ctx: Pick<ReduceContext, "effects">): number[] {
  const seats = new Set<number>();
  (played.trail ?? []).forEach((after, index) => {
    const before = index === 0 ? played.kept : played.trail?.[index - 1];
    if (!before || !isProwlWindow(before, ctx)) return;
    for (let seat = 0; seat < before.seats.length; seat += 1) if (resourcesOf(after, seat) < resourcesOf(before, seat)) seats.add(seat);
  });
  return [...seats].sort();
}
