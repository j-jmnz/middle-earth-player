import { checklist } from "../../../src/campaign/checklist.ts";
import { applyResolution, emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import { NO_COPY_LIMITS } from "../../../src/campaign/wilderland.ts";
import { campaignScenario, type Difficulty } from "../../../src/catalog/scenario-data.ts";
import { EFFECTS } from "../../../src/effects/index.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import type { PrintedCard } from "../../../src/rules/core/printed.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { HEATH_GOLDENS, heathWorld, rawEarlier as rawHeathEarlier } from "../the-withered-heath/game.ts";
import { TREASURES } from "../the-withered-heath/scene.ts";
import { CODES, campaign, rhovanion } from "./scene.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { campaignGame, fillerLoadout, HERO_STATS, type PlayedGame } from "../../harness/game-kit.ts";
import { goldenState } from "../../harness/golden-state.ts";

// Test helper. A whole game of Roam Across Rhovanion in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. The players travel to the location that guards an objective as soon as the stage lets them (5 progress on it), engage one enemy
// at a time (the guard of an objective first, then Tiny, then Urdug last) and attack with every character together, in that order; nobody defends; the first answer of a choice, or the last, or the trust in Urdug as the policy says.
export const RHOVANION_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type RhovanionDecks = "strong" | "weak" | "brittle";

export const rhovanionLoadout = fillerLoadout;

export type RhovanionPolicy = {
  // The option a Choose window with other answers takes: the first or the last.
  choose: "first" | "last";
  // How many times the first player puts their trust in Urdug (12184:A:2, 12184:B:1); every later question takes the burden (a copy of Urdug's Cunning).
  trust: number;
  // The location a player chooses at the Resolution for the pool (12184:B:4): the first or the last offered.
  location: "first" | "last";
  // Harsh Weather (19045:A:1): exhaust a ready character or raise the player's threat. The goldens' heroes raise their threat by default, so the character that quests is not exhausted.
  weather: "exhaust" | "threat";
  // The quest: the first character of a seat quests alone (the goldens' heroes have willpower far above the staging area's threat) or every character that can does (the Maestro fixtures' real decklists).
  quest: "alone" | "all";
  // Whether a character defends: the goldens' heroes are numbers that shrug an attack off and stay ready to attack (nobody defends), the Maestro fixtures' real decklists defend as the auto-player does.
  defend: boolean;
};
export const DEFAULT_POLICY: RhovanionPolicy = { choose: "first", trust: 9, location: "first", weather: "threat", quest: "alone", defend: false };

const GUARDS: readonly string[] = [CODES.greyMoorland, CODES.deepRavine];
const isTiny = (state: ScenarioState, id: string) => state.cards[id]?.code === CODES.tinyEnemy;
const isUrdug = (state: ScenarioState, id: string) => state.cards[id]?.code === CODES.urdugEnemy;
const guardsObjective = (state: ScenarioState, ctx: ReduceContext, id: string) => state.cards[id]?.attachments.some((other) => ctx.cards.get(state.cards[other]?.code ?? "")?.type === "objective") === true;
// The order the players deal with enemies in: the guard of an objective, any other enemy, Tiny (Urdug takes no damage while he is in play), Urdug last.
const priority = (state: ScenarioState, ctx: ReduceContext, id: string): number => (guardsObjective(state, ctx, id) ? 0 : isTiny(state, id) ? 2 : isUrdug(state, id) ? 3 : 1);

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the answer the policy says; the Resolution's questions are answered as the policy says; the players travel to a location that guards an objective, engage an enemy at a time and attack together in the order above.
// Every intent is one the reducer listed. `options`: the auto-player's own policy for the answers this one does not give; the Maestro fixtures (scripts/e2e/roam-across-rhovanion.ts) play real decklists, so they turn card play on.
export function rhovanionIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: RhovanionPolicy = DEFAULT_POLICY, options: PolicyOptions = RHOVANION_POLICY): PlayerIntent {
  if (state.window?.kind === "resolution") {
    const offered = legalIntents(state, ctx).flatMap((intent) => (intent.type === "ChooseResolution" ? [intent.optionId] : []));
    const staged = offered.filter((option) => option !== "skip");
    return { type: "ChooseResolution", optionId: (policy.location === "last" ? staged.at(-1) : staged[0]) ?? offered[0] ?? "" };
  }
  if (state.window?.kind === "choose") {
    const answers = state.window.options;
    // The trust in Urdug: "trust" for the first `trust` questions, then the burden.
    if (answers.length === 2 && answers[0] === "trust" && answers[1] === "burden") {
      const asked = [...memory].filter((key) => key.startsWith("trust:")).length;
      memory.add(`trust:${asked}`);
      return { type: "Choose", optionId: asked < policy.trust ? "trust" : "burden" };
    }
    if (answers.includes("exhaust") && answers.includes("threat") && state.cards[state.stack.at(-1)?.cardId ?? ""]?.code === CODES.harshWeather) return { type: "Choose", optionId: policy.weather };
    return { type: "Choose", optionId: (policy.choose === "last" ? answers.at(-1) : answers[0]) ?? "" };
  }
  if (state.window?.kind === "travel") {
    const targets = legalTargets(state, { type: "Travel" }, ctx);
    const wanted = targets.find((id) => GUARDS.includes(state.cards[id]?.code ?? "") && guardsObjective(state, ctx, id)) ?? targets[0];
    return wanted ? { type: "Travel", locationId: wanted } : { type: "DeclineTravel" };
  }
  if (state.window?.kind === "optionalEngage") {
    const seat = state.seats[state.activeSeat];
    const enemy = [...legalTargets(state, { type: "Engage" }, ctx)].sort((left, right) => priority(state, ctx, left) - priority(state, ctx, right))[0];
    return enemy && seat && seat.engaged.length < seat.heroes.length ? { type: "Engage", enemyId: enemy } : { type: "DeclineEngage" };
  }
  // Each ready character attacks, the enemy that guards an objective first, then any other, Tiny, then Urdug.
  if (state.window?.kind === "playerAttack" && legalIntents(state, ctx).some((intent) => intent.type === "DeclareAttackers")) {
    const mine = Object.values(state.cards).filter((card) => card.controller === state.activeSeat && (card.zone === "heroes" || card.zone === "play")).map((card) => card.id);
    const attacker = mine.find((id) => legalTargets(state, { type: "DeclareAttackers", cardId: id }, ctx).length > 0);
    const targets = attacker ? legalTargets(state, { type: "DeclareAttackers", cardId: attacker }, ctx) : [];
    const enemy = [...targets].sort((left, right) => priority(state, ctx, left) - priority(state, ctx, right))[0];
    if (attacker && enemy) return { type: "DeclareAttackers", enemyId: enemy, attackerIds: [attacker] };
  }
  // Nobody defends (a defender is exhausted and cannot attack in the same round): the attack falls on the character with the least damage.
  if (state.window?.kind === "defense" && !policy.defend) {
    const heroes = legalTargets(state, { type: "Undefended" }, ctx);
    const least = [...heroes].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (least) return { type: "Undefended", heroId: least };
  }
  // The quest: the first character of the seat quests alone (a hero's willpower is far above the staging area's threat); the others stay ready to attack and defend.
  if (state.window?.kind === "pass" && state.mode === "questCommit" && policy.quest === "alone") {
    const quested = Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat);
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    if (!quested && ids.length > 0) return { type: "Commit", cardIds: [ids[0] ?? ""] };
  }
  return nextIntent(state, ctx, options, memory, legalIntents(state, ctx));
}

export type RhovanionGame = PlayedGame;

// The goldens (src/campaign/scenarios/roam-across-rhovanion/golden.test.ts).
// `after`: the log of a campaign whose first four parts were won (Journey Up the Anduin, Lost in Mirkwood, The King's Quest and The Withered Heath, their real Resolutions chained: `afterHeath`) and `variant` the way they were won: the allies in the pool (pool),
// or Turayn's oath and Melanwar's guidance lines (oath), Isolde's line too (oathline). `ally`: the unique boon ally the boon-ally search of the Campaign Setup (12184:A:2) takes (a card code), or "skip"; by default the first one offered.
// `upgraded`: the Upgraded sides. `mode`: the Hard or Expert Mode card.
export type RhovanionVariant = "pool" | "oath" | "oathline";
export type RhovanionGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: RhovanionDecks; outcome: "won" | "lost"; policy?: Partial<RhovanionPolicy>; after?: boolean; variant?: RhovanionVariant; ally?: string; upgraded?: boolean; mode?: ModeCard; lossReason?: string };

// The goldens' stand-in heroes: Urdug's attack and the staging area's threat are small beside a hero's willpower and hit points.
const STATS = { ...HERO_STATS, strong: { ...HERO_STATS.strong, willpower: 100 }, brittle: { ...HERO_STATS.brittle, willpower: 100 } } as const;

const earlierCodes = [
  "12166", "12167", "12169", "12171", "12172", "12173", "12174", "12176", "12177", "12178", "12179", "12180", "12181", "12182", "12183", "18070", ...TREASURES,
  ...["journey-up-the-anduin", "lost-in-mirkwood", "the-kings-quest", "the-withered-heath"].flatMap((id) => loadScenario(id).cards.map((card) => card.code)),
];

const game = campaignGame<RhovanionDecks, RhovanionPolicy>({
  campaign,
  scenario: rhovanion,
  stats: STATS,
  // The scenario's cards and the enemy sides of Urdug and Tiny, the burdens its campaign card adds, and what the earlier parts leave in the pool (Turayn, Melanwar, Isolde, A Growing Threat, the burdens, the Accolade and Song boons, any card of their encounter sets).
  codes: [...rhovanion.cards.map((card) => card.code), ...rhovanion.cards.flatMap((card) => (card.back != null ? [card.back] : [])), "12185", "12186", ...earlierCodes],
  intent: rhovanionIntent,
  policy: DEFAULT_POLICY,
  limit: 8000,
  upgraded: [],
  // Not used: the log of the earlier parts is chained from their real Resolutions (`afterHeath`).
  earlier: { xp: [0, 0, 0, 0], pool: [], marks: {} },
});

// The Withered Heath goldens that the Roam Across Rhovanion goldens follow, by the seats and the way the earlier parts were won: each is played from the log the parts before it wrote (test/scenarios/the-withered-heath/game.ts).
const EARLIER: Readonly<Record<string, string>> = {
  "1:pool": "true solo, won, after the earlier parts, Dragon-slayer, 4 Dragon Signs, a treasure chosen",
  "2:pool": "two-handed, won, after the earlier parts, an Accolade boon for each player, 4 Dragon Signs",
  "1:oath": "true solo, Easy, won, the oath and guidance lines, Unbroken, Rhyme of the Slayer, 4 Dragon Signs",
  "2:oath": "two-handed, Easy, won, Melanwar's and Isolde's lines, 4 Dragon Signs",
  "1:oathline": "true solo, Easy, won, Melanwar's and Isolde's lines, The Steadfast, no Song, 4 Dragon Signs",
};
const earlierLogs = new Map<string, CampaignLog>();
const rawLogs = new Map<string, CampaignLog>();
const keyOf = (seatCount: 1 | 2, variant: RhovanionVariant = "pool") => `${seatCount}:${variant}`;
let worldCards: ReadonlyMap<string, PrintedCard> | null = null;

/** Reads the final states of the four earlier parts' goldens from golden.json (test/harness/golden-state.ts) and writes their Resolutions onto a blank log, once for each (seats, variant): what Roam Across Rhovanion is handed. */
export async function prepareEarlier(): Promise<void> {
  const heath = await heathWorld("strong");
  for (const [key, name] of Object.entries(EARLIER)) {
    const golden = HEATH_GOLDENS.find((item) => item.name === name)!;
    const played = goldenState("the-withered-heath", golden.name);
    const written = applyResolution(rawHeathEarlier(golden.seatCount, golden.variant), played.scenarioId, played, heath.cards, NO_COPY_LIMITS);
    rawLogs.set(key, written);
    // The stand-in heroes of the golden seats are not the heroes the earlier games lost or carried: they start fresh, and what hangs on a hero stays behind.
    const blank = emptyLog(golden.seatCount);
    earlierLogs.set(key, { ...written, heroesBySeat: blank.heroesBySeat, fallenHeroesBySeat: blank.fallenHeroesBySeat, campaignPool: written.campaignPool.filter((card) => card.attachedTo == null) });
  }
}

/** The log of a campaign that won the first four parts, their real Resolutions chained: `oath` and `oathline` for the lines in place of the allies in the pool. */
export function afterHeath(seatCount: 1 | 2, variant: RhovanionVariant = "pool"): CampaignLog {
  const log = earlierLogs.get(keyOf(seatCount, variant));
  if (!log) throw new Error("Call rhovanionWorld first: it builds the earlier parts' log");
  return log;
}

/** The log the four earlier parts' real Resolutions write, with the heroes of their games still on it (what the campaign test reads). */
export function rawEarlier(seatCount: 1 | 2, variant: RhovanionVariant = "pool"): CampaignLog {
  const log = rawLogs.get(keyOf(seatCount, variant));
  if (!log) throw new Error("Call rhovanionWorld first: it builds the earlier parts' log");
  return log;
}

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier parts were won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const rhovanionWorld = async (decks: RhovanionDecks = "strong") => {
  if (earlierLogs.size === 0) await prepareEarlier();
  const made = await game.world(decks);
  worldCards = made.cards;
  return made;
};

/**
 * The answers the Campaign Setup asks of the players for `log`: the boon-ally search (12184:A:2; `ally`, or the first ally offered, "skip" to take none), then Melanwar's three non-unique enemies when the log holds the line, each the first the search offers.
 * The checklist is asked until it needs nothing more.
 */
export function rhovanionSetupChoices(seatCount: 1 | 2, log: CampaignLog, difficulty: Difficulty, ally?: string): string[] {
  if (!worldCards) throw new Error("Call rhovanionWorld first");
  const answers: string[] = [];
  for (let guard = 0; guard < 40; guard += 1) {
    const plan = checklist({ log, scenario: campaignScenario(rhovanion), seats: fillerLoadout(seatCount), effects: EFFECTS, cards: worldCards, difficulty, choices: answers });
    if (plan.ok) return answers;
    const needs = plan.needs;
    if (!needs) throw new Error(plan.errors.join("; "));
    const offered = needs.options.filter((option) => option !== "skip");
    answers.push(ally != null && needs.options.includes(ally) ? ally : (offered[0] ?? "skip"));
  }
  throw new Error("The Campaign Setup keeps asking");
}
export const rhovanionPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount), choices?: readonly string[], difficulty?: Difficulty) => game.plan(seatCount, log, choices, difficulty);
export const rhovanionStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard, choices?: readonly string[]) => game.start(seatCount, seed, difficulty, { facts, log, modeCard, choices });

// The pinned games: wins (true solo and two-handed, Normal and Easy, from a blank log and after the four earlier parts' real Resolutions with the allies in the pool or the oath, guidance and Isolde lines, the boon-ally search taken or skipped, Misplaced Trust
// and Urdug's Cunning, each of the six orders of the three stages 2, the first or the last location chosen for the pool) and losses (heroes too small to quest, heroes too brittle to survive, the threat at a stage 2, Urdug's Gambit holding as much progress as it has quest points),
// each on a fixed seed. Every win has the stage 3 fight: Urdug's damage as great as his hit points.
export const RHOVANION_GOLDENS: readonly RhovanionGolden[] = [
  { name: "true solo, won from a blank log, Tiny, Key, Horn, three locations left in the staging area, Deep Ravine for the pool, Misplaced Trust", seatCount: 1, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, won from a blank log, Key, Horn, Tiny, trust twice, Urdug's Cunning", seatCount: 1, seed: 7, difficulty: "Normal", decks: "strong", outcome: "won", policy: { trust: 2 } },
  { name: "true solo, won from a blank log, Key, Tiny, Horn, no trust at all, the last location offered, Urdug's Cunning", seatCount: 1, seed: 6, difficulty: "Normal", decks: "strong", outcome: "won", policy: { trust: 0, location: "last" } },
  { name: "true solo, won from a blank log, Horn, Key, Tiny, the last answers taken, no location left for the pool", seatCount: 1, seed: 8, difficulty: "Normal", decks: "strong", outcome: "won", policy: { choose: "last", weather: "exhaust" } },
  { name: "true solo, won, after the earlier parts, Horn, Tiny, Key", seatCount: 1, seed: 12, difficulty: "Normal", decks: "strong", outcome: "won", after: true },
  { name: "true solo, won, after the earlier parts, no boon ally searched, Tiny, Horn, Key", seatCount: 1, seed: 11, difficulty: "Normal", decks: "strong", outcome: "won", after: true, ally: "skip" },
  { name: "true solo, Easy, won, the oath and guidance lines, Key, Tiny, Horn", seatCount: 1, seed: 5, difficulty: "Easy", decks: "strong", outcome: "won", after: true, variant: "oath" },
  { name: "true solo, Easy, won, Melanwar's and Isolde's lines, Key, Horn, Tiny", seatCount: 1, seed: 7, difficulty: "Easy", decks: "strong", outcome: "won", after: true, variant: "oathline" },
  { name: "two-handed, won from a blank log, Tiny, Key, Horn, a different location chosen by each player, a Misplaced Trust for each", seatCount: 2, seed: 11, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed, won from a blank log, Key, Tiny, Horn, the last location offered to each player, different titles", seatCount: 2, seed: 12, difficulty: "Normal", decks: "strong", outcome: "won", policy: { location: "last" } },
  { name: "two-handed, won from a blank log, Horn, Tiny, Key, no location left in the staging area, so nobody is asked", seatCount: 2, seed: 5, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed, won, after the earlier parts, Horn, Tiny, Key, one title in the staging area twice, so both players choose it", seatCount: 2, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won", after: true },
  { name: "two-handed, won, after the earlier parts, Tiny, Horn, Key", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", after: true },
  { name: "two-handed, won, after the earlier parts, Key, Horn, Tiny, trust twice, Urdug's Cunning for each player", seatCount: 2, seed: 9, difficulty: "Normal", decks: "strong", outcome: "won", after: true, policy: { trust: 2 } },
  { name: "two-handed, Easy, won, Melanwar's and Isolde's lines, Horn, Key, Tiny", seatCount: 2, seed: 11, difficulty: "Easy", decks: "strong", outcome: "won", after: true, variant: "oath" },
  { name: "two-handed, Easy, won, Melanwar's and Isolde's lines, no boon ally searched, Key, Horn, Tiny", seatCount: 2, seed: 5, difficulty: "Easy", decks: "strong", outcome: "won", after: true, variant: "oath", ally: "skip" },
  { name: "true solo, weak, lost on threat", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed, weak, lost on threat", seatCount: 2, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "true solo, brittle, lost with every hero dead", seatCount: 1, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed, brittle, lost with every hero dead", seatCount: 2, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
  { name: "true solo, lost at stage 2 on threat, after the earlier parts", seatCount: 1, seed: 6, difficulty: "Normal", decks: "strong", outcome: "lost", after: true, lossReason: "No seats remain" },
  { name: "two-handed, lost at stage 2 on threat, Tiny and the Horn found", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: "No seats remain" },
  { name: "true solo, lost at stage 3, Urdug's Gambit holds as much progress as it has quest points", seatCount: 1, seed: 7, difficulty: "Normal", decks: "strong", outcome: "lost", policy: { choose: "last", weather: "exhaust" }, lossReason: "Urdug's Gambit holds as much progress as it has quest points" },
];

/** The log a golden's Resolution is written onto: the earlier parts' real Resolutions, or a blank log. */
export const logBeforeGolden = (golden: RhovanionGolden): CampaignLog => (golden.after ? afterHeath(golden.seatCount, golden.variant) : emptyLog(golden.seatCount));

/** The answers the Campaign Setup asks for a golden's log. */
export const rhovanionChoices = (golden: RhovanionGolden): string[] => rhovanionSetupChoices(golden.seatCount, logBeforeGolden(golden), golden.difficulty, golden.ally);

export const playGolden = (golden: RhovanionGolden, ctx: ReduceContext): RhovanionGame => game.play(golden.seatCount, golden.seed, golden.difficulty, ctx, { log: logBeforeGolden(golden), policy: golden.policy, mode: golden.mode, choices: rhovanionChoices(golden) });
