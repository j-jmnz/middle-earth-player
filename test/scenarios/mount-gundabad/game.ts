import { checklist } from "../../../src/campaign/checklist.ts";
import { applyResolution, emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import { NO_COPY_LIMITS } from "../../../src/campaign/wilderland.ts";
import { campaignScenario, type Difficulty } from "../../../src/catalog/scenario-data.ts";
import { EFFECTS } from "../../../src/effects/index.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import type { PrintedCard } from "../../../src/rules/core/printed.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { FRAMSBURG_GOLDENS, framsburgWorld, rawEarlier as rawFramsburgEarlier, type FramsburgVariant } from "../the-ghost-of-framsburg/game.ts";
import { EARLIER_POOL } from "../the-ghost-of-framsburg/scene.ts";
import { TREASURES } from "../the-withered-heath/scene.ts";
import { campaign, CODES, gundabad } from "./scene.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { attackTogether, campaignGame, engageOneEach, fillerLoadout, HERO_STATS, type PlayedGame } from "../../harness/game-kit.ts";
import { goldenState } from "../../harness/golden-state.ts";

// Test helper. A whole game of Mount Gundabad in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. The first two characters of a seat quest (their willpower is a little above the staging area's threat, so a stage can outlast a
// round and be bypassed) and the others stay ready. The players travel to the first location they may, engage the enemies of the staging area when the policy says, attack with every ready character together (Dagnir first when the policy
// hunts her), use the Responses and Actions the policy allows (the Hoard's search, the Response that adds Dagnir to the victory display) and answer every other choice with the first option, or the last. Every intent is one the reducer listed.
export const GUNDABAD_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type GundabadDecks = "strong" | "weak" | "brittle";

export const gundabadLoadout = fillerLoadout;

export type GundabadPolicy = {
  // The option a Choose window with other answers takes: the first or the last.
  choose: "first" | "last";
  // The first player's answer at the end of the combat phase (emce.bypassing): never bypass the stage, bypass it whenever it is offered, or bypass it when it holds no progress.
  bypass: "never" | "always" | "bare";
  // The stage the first player puts on the bottom of the quest deck after a look at the top 2 (19134:B:1, 19140:B:2) and the stage Throat of the Mountain makes the current quest (19124:A:1): the first or the last.
  stage: "first" | "last";
  // The quest: the first two characters of a seat quest or every character that can does.
  quest: "pair" | "all";
  // Whether the players engage the enemies of the staging area, one at a time, and attack them.
  engage: boolean;
  // Whether the players hunt Dagnir: they attack her before every other enemy, and engage her first.
  hunt: boolean;
  // Whether a character defends: every attack ("all") or none. A defender is exhausted, so it cannot quest or attack; with nobody defending the attack falls on the character with the least damage.
  defend: "none" | "all";
  // Whether the players use the Responses and Actions the cards offer (Dagnir's Hoard's search, the Reforged Wormsbane's Response, The First Forge's and Throat of the Mountain's Responses), or pass them.
  use: boolean;
  // The Resolution's treasure of the 3 offered (12193:B:2): the first or the last.
  treasure: "first" | "last";
};
export const DEFAULT_POLICY: GundabadPolicy = { choose: "first", bypass: "never", stage: "first", quest: "pair", engage: false, hunt: false, defend: "none", use: true, treasure: "first" };

const stageIds = (state: ScenarioState, options: readonly string[]): boolean => options.length > 0 && options.every((id) => (STAGE_CODES as readonly string[]).includes(state.cards[id]?.code ?? ""));
const STAGE_CODES = ["19134", "19135", "19137", "19138", "19139", "19140", "19141", "19142"];

// The auto-player's answer (test/harness/auto-player.ts), except: the bypass, the stage put on the bottom or searched for, an engagement, the attack, a defender, the Responses and Actions and the Resolution's treasure are answered as the policy says;
// a choice takes the first answer, or the last. Every intent is one the reducer listed. `options`: the auto-player's own policy for the answers this one does not give; the fixtures (scripts/e2e/mount-gundabad.ts) play real decklists, so they turn card play on.
export function gundabadIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: GundabadPolicy = DEFAULT_POLICY, options: PolicyOptions = GUNDABAD_POLICY): PlayerIntent {
  const intents = legalIntents(state, ctx);
  if (state.window?.kind === "resolution") {
    const offered = intents.flatMap((intent) => (intent.type === "ChooseResolution" ? [intent.optionId] : []));
    return { type: "ChooseResolution", optionId: (policy.treasure === "last" ? offered.at(-1) : offered[0]) ?? "" };
  }
  if (state.window?.kind === "choose") {
    const offered = intents.flatMap((intent) => (intent.type === "Choose" ? [intent.optionId] : []));
    const answers = state.window.options.filter((id) => offered.includes(id));
    // The bypass (emce.bypassing): "bypass" or "stay".
    if (answers.includes("bypass") && answers.includes("stay")) {
      const bare = (state.cards[state.questStage ?? ""]?.progress ?? 0) === 0;
      return { type: "Choose", optionId: policy.bypass === "always" || (policy.bypass === "bare" && bare) ? "bypass" : "stay" };
    }
    // The stages looked at, or searched for: the first or the last of them.
    if (stageIds(state, answers)) return { type: "Choose", optionId: (policy.stage === "last" ? answers.at(-1) : answers[0]) ?? "" };
    // "Each player may search their deck for an Item attachment" (19123:A:2): the players search when they use their cards.
    if (answers.includes("do") && answers.includes("decline")) return { type: "Choose", optionId: policy.use ? "do" : "decline" };
    return { type: "Choose", optionId: (policy.choose === "last" ? answers.at(-1) : answers[0]) ?? "" };
  }
  if (state.window?.kind === "response") return nextIntent(state, ctx, { ...options, act: policy.use }, memory, intents);
  if (state.window?.kind === "optionalEngage") {
    if (!policy.engage) return { type: "DeclineEngage" };
    const dagnir = policy.hunt ? legalTargets(state, { type: "Engage" }, ctx).find((id) => state.cards[id]?.code === CODES.dagnir) : undefined;
    return (dagnir ? { type: "Engage", enemyId: dagnir } : engageOneEach(state, ctx)) ?? { type: "DeclineEngage" };
  }
  // Each ready character attacks, together, the first enemy any can reach; Dagnir last, or first when the players hunt her.
  if (state.window?.kind === "playerAttack") {
    const rank = (id: string) => ((state.cards[id]?.code === CODES.dagnir) === policy.hunt ? 0 : 1);
    const attack = attackTogether(state, ctx, undefined, rank);
    if (attack) return attack;
  }
  // A defender, if the policy has one, is the character with the least damage; with nobody defending the attack falls on the character with the least damage.
  if (state.window?.kind === "defense") {
    const byDamage = (ids: readonly string[]) => [...ids].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    const defender = policy.defend === "all" && intents.some((intent) => intent.type === "DeclareDefender") ? byDamage(legalTargets(state, { type: "DeclareDefender" }, ctx)) : undefined;
    if (defender) return { type: "DeclareDefender", defenderId: defender };
    const least = byDamage(legalTargets(state, { type: "Undefended" }, ctx));
    if (least) return { type: "Undefended", heroId: least };
  }
  // The quest: the first two characters of the seat quest; the others stay ready to attack and defend.
  if (state.window?.kind === "pass" && state.mode === "questCommit" && policy.quest === "pair") {
    const quested = Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat);
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    if (!quested && ids.length > 0) return { type: "Commit", cardIds: ids.slice(0, 2) };
  }
  if (state.window?.kind === "pass") return nextIntent(state, ctx, { ...options, act: policy.use }, memory, intents);
  return nextIntent(state, ctx, options, memory, intents);
}

export type GundabadGame = PlayedGame;

// The goldens (src/campaign/scenarios/mount-gundabad/golden.test.ts).
// `growing`: A Growing Threat is still in the campaign pool (no earlier game revealed it), which the Resolution removes. `after`: the log of a campaign whose first seven parts were won (Journey Up the Anduin, Lost in Mirkwood, The King's Quest, The Withered Heath, Roam Across Rhovanion, Fire in the Night and The Ghost of Framsburg, their real Resolutions chained: `afterFramsburg`) and `variant` the way
// they were won (the Ghost of Framsburg goldens' variants and their seats). `upgraded`: the Upgraded sides. `mode`: the Hard or Expert Mode card.
export type GundabadGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: GundabadDecks; outcome: "won" | "lost"; policy?: Partial<GundabadPolicy>; after?: boolean; variant?: FramsburgVariant; growing?: boolean; upgraded?: boolean; mode?: ModeCard; lossReason?: string };

// The goldens' stand-in heroes: a willpower of 8 beside the staging area's threat, so a stage 2 outlasts a round now and then (the bypass is offered only to a stage still in play at the end of the combat phase), and a high hit point total for the attacks.
const STATS = { ...HERO_STATS, strong: { ...HERO_STATS.strong, willpower: 8 }, brittle: { ...HERO_STATS.brittle, willpower: 8 } } as const;

const EARLIER_SCENARIOS = ["journey-up-the-anduin", "lost-in-mirkwood", "the-kings-quest", "the-withered-heath", "roam-across-rhovanion", "fire-in-the-night", "the-ghost-of-framsburg"];

const game = campaignGame<GundabadDecks, GundabadPolicy>({
  campaign,
  scenario: gundabad,
  stats: STATS,
  // The scenario's cards, its campaign card and the cards that card places, and what the earlier parts leave in the pool (the boon allies, the burdens, the Accolade and Song boons, Misplaced Trust and Urdug's Cunning, Gundabad Hunter and Gundabad Stalker, the Hazard cards,
  // any card of their encounter sets) and the treasures a Resolution may offer.
  codes: [...gundabad.cards.map((card) => card.code), ...gundabad.campaignPlaced, gundabad.campaignCard, "19144", ...EARLIER_POOL, "18052", "18070", ...TREASURES, ...EARLIER_SCENARIOS.flatMap((id) => [...loadScenario(id).cards.map((card) => card.code), ...loadScenario(id).campaignPlaced])],
  intent: gundabadIntent,
  policy: DEFAULT_POLICY,
  limit: 8000,
  upgraded: [],
  // Not used: the log of the earlier parts is chained from their real Resolutions (`afterFramsburg`).
  earlier: { xp: [0, 0, 0, 0, 0, 0, 0], pool: [], marks: {} },
});

// The Ghost of Framsburg goldens that the Mount Gundabad goldens follow, by the seats and the way the earlier parts were won: each is played from the log the parts before it wrote (test/scenarios/the-ghost-of-framsburg/game.ts).
const EARLIER: Readonly<Record<string, string>> = {
  "1:pool": "true solo, won, after the earlier parts, the encounter discard pile shuffled, Gundabad Hunter",
  "1:beldis": "true solo, won, after the earlier parts, Beldis's line, a treasure attached to Fram's Shade, Gundabad Stalker",
  "1:oathline": "true solo, Easy, won, Melanwar's and Isolde's lines, a burden of the two Hazard cards for the pool",
  "2:pool": "two-handed, won, after the earlier parts, Misplaced Trust, the discard pile shuffled",
  "2:cunning": "two-handed, won, after the earlier parts, Urdug's Cunning, a treasure attached to Fram's Shade",
  "2:oath": "two-handed, Easy, won, the oath and guidance lines, a treasure attached to Fram's Shade",
};
const earlierLogs = new Map<string, CampaignLog>();
const rawLogs = new Map<string, CampaignLog>();
const keyOf = (seatCount: 1 | 2, variant: FramsburgVariant = "pool") => `${seatCount}:${variant}`;
let worldCards: ReadonlyMap<string, PrintedCard> | null = null;

/** Reads the final states of the Ghost of Framsburg goldens that follow the first six parts from golden.json (test/harness/golden-state.ts) and writes their Resolutions onto the log those parts wrote, once for each (seats, variant): what Mount Gundabad is handed. */
export async function prepareEarlier(): Promise<void> {
  const framsburg = await framsburgWorld("strong");
  for (const [key, name] of Object.entries(EARLIER)) {
    const golden = FRAMSBURG_GOLDENS.find((item) => item.name === name);
    if (!golden) throw new Error(`No Ghost of Framsburg golden named ${name}`);
    const played = goldenState("the-ghost-of-framsburg", golden.name);
    const written = applyResolution(rawFramsburgEarlier(golden.seatCount, golden.variant), played.scenarioId, played, framsburg.cards, NO_COPY_LIMITS);
    rawLogs.set(key, written);
    // The stand-in heroes of the golden seats are not the heroes the earlier games lost or carried: they start fresh, and what hangs on a hero stays behind.
    const blank = emptyLog(golden.seatCount);
    earlierLogs.set(key, { ...written, heroesBySeat: blank.heroesBySeat, fallenHeroesBySeat: blank.fallenHeroesBySeat, campaignPool: written.campaignPool.filter((card) => card.attachedTo == null) });
  }
}

/** The log of a campaign that won the first seven parts, their real Resolutions chained. */
export function afterFramsburg(seatCount: 1 | 2, variant: FramsburgVariant = "pool"): CampaignLog {
  const log = earlierLogs.get(keyOf(seatCount, variant));
  if (!log) throw new Error("Call gundabadWorld first: it builds the earlier parts' log");
  return log;
}

/** The log the seven earlier parts' real Resolutions write, with the heroes of their games still on it (what the campaign test reads). */
export function rawEarlier(seatCount: 1 | 2, variant: FramsburgVariant = "pool"): CampaignLog {
  const log = rawLogs.get(keyOf(seatCount, variant));
  if (!log) throw new Error("Call gundabadWorld first: it builds the earlier parts' log");
  return log;
}

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier parts were won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const gundabadWorld = async (decks: GundabadDecks = "strong") => {
  if (earlierLogs.size === 0) await prepareEarlier();
  const made = await game.world(decks);
  worldCards = made.cards;
  return made;
};

/**
 * The answers the Campaign Setup asks of the players for `log`: with Melanwar's line the first player names 2 non-unique locations of the encounter deck and a location of the Caves deck to remove (12193:A:2), with Beldis's line 3 treacheries,
 * each the first the search offers that an earlier search did not take. The checklist is asked until it needs nothing more.
 */
export function gundabadSetupChoices(seatCount: 1 | 2, log: CampaignLog, difficulty: Difficulty = "Normal", facts?: Omit<CampaignFacts, "modeCard">): string[] {
  if (!worldCards) throw new Error("Call gundabadWorld first");
  const answers: string[] = [];
  for (let guard = 0; guard < 40; guard += 1) {
    const plan = checklist({ log, scenario: campaignScenario(gundabad), seats: gundabadLoadout(seatCount), effects: EFFECTS, cards: worldCards, difficulty, choices: answers, ...(facts ? { facts } : {}) } as Parameters<typeof checklist>[0]);
    if (plan.ok) return answers;
    const needs = plan.needs;
    if (!needs) throw new Error(plan.errors.join("; "));
    const offered = needs.options.filter((option) => option !== "skip");
    answers.push(offered.find((option) => !answers.includes(option)) ?? offered[0] ?? "skip");
  }
  throw new Error("The Campaign Setup keeps asking");
}
export const gundabadPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount), choices?: readonly string[], difficulty?: Difficulty) => game.plan(seatCount, log, choices, difficulty);
export const gundabadStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard, choices?: readonly string[]) => game.start(seatCount, seed, difficulty, { facts, log, modeCard, choices });

// The pinned games: wins (true solo and two-handed, Normal and Easy, from a blank log and after the seven earlier parts' real Resolutions with the allies and Misplaced Trust or Urdug's Cunning in the pool, Dragon-sickness shuffled in with 6 or more
// treasures logged, or the Turayn, Melanwar, Isolde and Beldis lines written; no stage bypassed and several, in several orders of the quest deck; Dagnir hunted and engaged or left to the quest; every win slays Dagnir with the Reforged Wormsbane at the Great Worm) and losses
// (heroes too small to quest, heroes too brittle to survive, the hero who carries Wormsbane destroyed, the threat of every player at 50), each on a fixed seed.
const HUNT = { hunt: true, engage: true } as const;
const BYPASS = { bypass: "always" } as const;
export const GUNDABAD_GOLDENS: readonly GundabadGolden[] = [
  { name: "true solo, won from a blank log, no stage bypassed, the Hoard searched", seatCount: 1, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, won from a blank log, every stage that outlasts a round bypassed", seatCount: 1, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won", policy: BYPASS },
  { name: "true solo, Easy, won from a blank log, no stage bypassed", seatCount: 1, seed: 1, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "true solo, Easy, won from a blank log, a stage bypassed, the Hoard searched", seatCount: 1, seed: 2, difficulty: "Easy", decks: "strong", outcome: "won", policy: BYPASS },
  { name: "true solo, Easy, won from a blank log, Dagnir hunted and engaged", seatCount: 1, seed: 1, difficulty: "Easy", decks: "strong", outcome: "won", policy: HUNT },
  { name: "true solo, won, after the earlier parts, no stage bypassed", seatCount: 1, seed: 8, difficulty: "Normal", decks: "strong", outcome: "won", after: true, variant: "pool" },
  { name: "true solo, won, after the earlier parts, Dagnir hunted and engaged", seatCount: 1, seed: 3, difficulty: "Normal", decks: "strong", outcome: "won", after: true, variant: "pool", policy: HUNT },
  { name: "true solo, won, after the earlier parts, Beldis's line, Dagnir hunted and engaged", seatCount: 1, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won", after: true, variant: "beldis", policy: HUNT },
  { name: "true solo, Easy, won, Melanwar's and Isolde's lines, a stage bypassed", seatCount: 1, seed: 5, difficulty: "Easy", decks: "strong", outcome: "won", after: true, variant: "oathline", policy: BYPASS },
  { name: "two-handed, won from a blank log, no stage bypassed, the Hoard searched", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed, won from a blank log, a stage bypassed", seatCount: 2, seed: 6, difficulty: "Normal", decks: "strong", outcome: "won", policy: BYPASS },
  { name: "two-handed, Easy, won from a blank log, no stage bypassed", seatCount: 2, seed: 1, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "two-handed, Easy, won from a blank log, a stage bypassed", seatCount: 2, seed: 2, difficulty: "Easy", decks: "strong", outcome: "won", policy: BYPASS },
  { name: "two-handed, won, after the earlier parts, Misplaced Trust, no stage bypassed", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", after: true, variant: "pool" },
  { name: "two-handed, won, after the earlier parts, Misplaced Trust, Dagnir hunted and engaged", seatCount: 2, seed: 5, difficulty: "Normal", decks: "strong", outcome: "won", after: true, variant: "pool", policy: HUNT },
  { name: "two-handed, won, after the earlier parts, Urdug's Cunning, Dragon-sickness in the encounter deck", seatCount: 2, seed: 6, difficulty: "Normal", decks: "strong", outcome: "won", after: true, variant: "cunning" },
  { name: "two-handed, won, after the earlier parts, Urdug's Cunning, Dragon-sickness in the encounter deck, a stage bypassed", seatCount: 2, seed: 9, difficulty: "Normal", decks: "strong", outcome: "won", after: true, variant: "cunning", policy: BYPASS },
  { name: "two-handed, Easy, won, the oath and guidance lines, a stage bypassed", seatCount: 2, seed: 1, difficulty: "Easy", decks: "strong", outcome: "won", after: true, variant: "oath", policy: BYPASS },
  { name: "two-handed, Easy, won, the oath and guidance lines, Dagnir hunted and engaged", seatCount: 2, seed: 2, difficulty: "Easy", decks: "strong", outcome: "won", after: true, variant: "oath", policy: HUNT },
  { name: "true solo, won, after the earlier parts, A Growing Threat in the pool removed by the Resolution", seatCount: 1, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won", after: true, variant: "pool", growing: true },
  { name: "two-handed, won, after the earlier parts, Misplaced Trust, A Growing Threat in the pool removed by the Resolution", seatCount: 2, seed: 8, difficulty: "Normal", decks: "strong", outcome: "won", after: true, variant: "pool", growing: true },
  { name: "true solo, weak, lost on threat", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed, weak, lost on threat", seatCount: 2, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "true solo, brittle, lost with the hero who carries Wormsbane destroyed", seatCount: 1, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "q1 left play" },
  { name: "two-handed, brittle, lost with the hero who carries Wormsbane destroyed", seatCount: 2, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "q1 left play" },
  { name: "true solo, lost with the hero who carries Wormsbane destroyed", seatCount: 1, seed: 5, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: "q1 left play" },
  { name: "true solo, lost with the threat at 50", seatCount: 1, seed: 2, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed, lost with the threat of every player at 50", seatCount: 2, seed: 3, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: "No seats remain" },
  { name: "true solo, Easy, lost after the earlier parts, Melanwar's and Isolde's lines", seatCount: 1, seed: 1, difficulty: "Easy", decks: "strong", outcome: "lost", after: true, variant: "oathline", lossReason: "No seats remain" },
  { name: "two-handed, lost after the earlier parts, Urdug's Cunning, Dragon-sickness in the encounter deck", seatCount: 2, seed: 4, difficulty: "Normal", decks: "strong", outcome: "lost", after: true, variant: "cunning", lossReason: "No seats remain" },
  { name: "two-handed, Easy, lost after the earlier parts, the oath and guidance lines, the hero who carries Wormsbane destroyed", seatCount: 2, seed: 64, difficulty: "Easy", decks: "strong", outcome: "lost", after: true, variant: "oath", lossReason: "q4 left play" },
  { name: "two-handed, lost after the earlier parts, Misplaced Trust, A Growing Threat stays in the pool", seatCount: 2, seed: 13, difficulty: "Normal", decks: "strong", outcome: "lost", after: true, variant: "pool", growing: true, lossReason: "q1 left play" },
  { name: "two-handed, lost with a stage bypassed, the threat of every player at 50", seatCount: 2, seed: 5, difficulty: "Easy", decks: "strong", outcome: "lost", policy: BYPASS, lossReason: "No seats remain" },
];

/** The log a golden's Resolution is written onto: the earlier parts' real Resolutions, or a blank log. */
export function logBeforeGolden(golden: GundabadGolden): CampaignLog {
  const log = golden.after ? afterFramsburg(golden.seatCount, golden.variant) : emptyLog(golden.seatCount);
  return golden.growing ? { ...log, encounterPool: { ...log.encounterPool, [CODES.aGrowingThreat]: 1 } } : log;
}

/** The answers the Campaign Setup asks for a golden's log. */
export const gundabadChoices = (golden: GundabadGolden): string[] => gundabadSetupChoices(golden.seatCount, logBeforeGolden(golden), golden.difficulty);

export const playGolden = (golden: GundabadGolden, ctx: ReduceContext): GundabadGame => game.play(golden.seatCount, golden.seed, golden.difficulty, ctx, { log: logBeforeGolden(golden), policy: golden.policy, mode: golden.mode, choices: gundabadChoices(golden) });

/** Plays a game by seat count, seed and policy outside the goldens (a seed finder, an exploration). */
export const playSeed = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, ctx: ReduceContext, options: { log?: CampaignLog; policy?: Partial<GundabadPolicy>; limit?: number } = {}): GundabadGame => game.play(seatCount, seed, difficulty, ctx, { ...options, choices: gundabadSetupChoices(seatCount, options.log ?? emptyLog(seatCount), difficulty) });
