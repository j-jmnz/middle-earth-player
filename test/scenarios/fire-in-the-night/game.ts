import { checklist } from "../../../src/campaign/checklist.ts";
import { applyResolution, emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import { NO_COPY_LIMITS } from "../../../src/campaign/wilderland.ts";
import { campaignScenario, type Difficulty } from "../../../src/catalog/scenario-data.ts";
import { EFFECTS } from "../../../src/effects/index.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import type { PrintedCard } from "../../../src/rules/core/printed.ts";
import { MAIN_QUEST } from "../../../src/rules/families/wilderland/night.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { attackTogether, campaignGame, engageOneEach, fillerLoadout, HERO_STATS, type PlayedGame } from "../../harness/game-kit.ts";
import { RHOVANION_GOLDENS, rawEarlier as rawRhovanionEarlier, rhovanionWorld, playGolden as playRhovanion, type RhovanionVariant } from "../roam-across-rhovanion/game.ts";
import { TREASURES } from "../the-withered-heath/scene.ts";
import { CODES, campaign, night } from "./scene.ts";

// Test helper. A whole game of Fire in the Night in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. The first character of a seat quests alone (its willpower is far above the staging area's threat) and the others stay ready. At the
// beginning of each quest phase the first player makes the first side quest of the staging area the current quest, or keeps Hrogar's Hill, or alternates, as the policy says; the players travel to the first location, engage one enemy at a time
// when the policy says (or none), attack with every ready character together (the engaged enemies, and Dagnir once three side quests are in the victory display), and answer every other choice with the first option, or the last.
export const NIGHT_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type NightDecks = "strong" | "weak" | "brittle";

export const nightLoadout = fillerLoadout;

export type NightPolicy = {
  // The option a Choose window with other answers takes: the first or the last.
  choose: "first" | "last";
  // The first player's question at the beginning of the quest phase (emce.side-quests-in-play): the first side quest in the staging area is the current quest ("side"), Hrogar's Hill stays the quest ("main"), or a side quest on odd rounds ("alternate").
  current: "side" | "main" | "alternate";
  // Whether a character defends: only the attack on Hrogar's Hill (19083:B:1) ("hill"), every attack ("all") or none. A defender is exhausted, so it cannot quest or attack; with nobody defending the attack falls on the character with the least damage.
  defend: "none" | "hill" | "all";
  // The quest: the first character of a seat quests alone (the goldens' heroes have willpower far above the staging area's threat) or every character that can does (the Maestro fixtures' real decklists).
  quest: "alone" | "all";
  // Whether the players engage the enemies of the staging area, one at a time, and attack them.
  engage: boolean;
  // Whether the first player uses a Response of a defeated side quest (emce.side-quests-in-play), or passes it.
  respond: boolean;
  // Whether a player uses Beldis's Action (12188:A:1) for a character with damage, once a round.
  heal: boolean;
  // The Resolution's answers: Beldis joins the pool or the log takes the line (12187:B:1), the treasure of the three offered (12187:B:2), the card of the pool each player removes (12187:B:4: "skip" removes none).
  beldis: "ally" | "line";
  treasure: "first" | "last";
  remove: "skip" | "first" | "last";
};
export const DEFAULT_POLICY: NightPolicy = { choose: "first", current: "side", defend: "none", quest: "alone", engage: false, respond: true, heal: false, beldis: "ally", treasure: "first", remove: "skip" };

const damaged = (state: ScenarioState): boolean => Object.values(state.cards).some((card) => card.damage > 0 && (card.zone === "heroes" || card.zone === "play"));

// The auto-player's answer (test/harness/auto-player.ts), except: the first player's current quest, a defender, an engagement, the attack, a Response, Beldis's Action and the Resolution's questions are answered as the policy says; a choice takes the first answer, or the last.
// Every intent is one the reducer listed. `options`: the auto-player's own policy for the answers this one does not give; the Maestro fixtures (scripts/e2e/fire-in-the-night.ts) play real decklists, so they turn card play on.
export function nightIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: NightPolicy = DEFAULT_POLICY, options: PolicyOptions = NIGHT_POLICY): PlayerIntent {
  if (state.window?.kind === "resolution") {
    const offered = legalIntents(state, ctx).flatMap((intent) => (intent.type === "ChooseResolution" ? [intent.optionId] : []));
    const named = (code: string) => offered.filter((option) => option.startsWith(code));
    // Beldis: the boon ally for a player, or the line.
    if (offered.includes("line")) return { type: "ChooseResolution", optionId: policy.beldis === "line" ? "line" : (named(CODES.beldis)[0] ?? "line") };
    // The pool: a card to remove, or nothing.
    if (offered.includes("skip")) {
      const cards = offered.filter((option) => option !== "skip");
      return { type: "ChooseResolution", optionId: policy.remove === "skip" ? "skip" : ((policy.remove === "last" ? cards.at(-1) : cards[0]) ?? "skip") };
    }
    // The treasure of three.
    return { type: "ChooseResolution", optionId: (policy.treasure === "last" ? offered.at(-1) : offered[0]) ?? "" };
  }
  if (state.window?.kind === "choose") {
    const answers = state.window.options;
    // The first player's question at the beginning of the quest phase: the main quest, or a side quest.
    if (answers.includes(MAIN_QUEST) && answers.length > 1) {
      const side = answers.find((option) => option !== MAIN_QUEST);
      const wanted = policy.current === "main" || (policy.current === "alternate" && state.round % 2 === 0) ? MAIN_QUEST : side;
      return { type: "Choose", optionId: wanted ?? MAIN_QUEST };
    }
    return { type: "Choose", optionId: (policy.choose === "last" ? answers.at(-1) : answers[0]) ?? "" };
  }
  // A Response of a defeated side quest: the first player uses it, or passes.
  if (state.window?.kind === "response" && policy.respond) return nextIntent(state, ctx, { ...options, act: true }, memory, legalIntents(state, ctx));
  if (state.window?.kind === "optionalEngage") {
    const intent = policy.engage ? engageOneEach(state, ctx) : null;
    return intent ?? { type: "DeclineEngage" };
  }
  // Each ready character attacks, together, the first enemy any can reach.
  if (state.window?.kind === "playerAttack") {
    const attack = attackTogether(state, ctx, undefined, (id) => (state.cards[id]?.code === CODES.dagnir ? 0 : 1));
    if (attack) return attack;
  }
  // The defender, if the policy has one, is the character with the least damage (it is exhausted and cannot quest or attack); with nobody defending the attack falls on the character with the least damage.
  if (state.window?.kind === "defense") {
    const byDamage = (ids: readonly string[]) => [...ids].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    const wanted = policy.defend === "all" || (policy.defend === "hill" && state.pendingAttack?.toStage === true);
    const defender = wanted && legalIntents(state, ctx).some((intent) => intent.type === "DeclareDefender") ? byDamage(legalTargets(state, { type: "DeclareDefender" }, ctx)) : undefined;
    if (defender) return { type: "DeclareDefender", defenderId: defender };
    const least = byDamage(legalTargets(state, { type: "Undefended" }, ctx));
    if (least) return { type: "Undefended", heroId: least };
  }
  // The quest: the first character of the seat quests alone (a hero's willpower is far above the staging area's threat); the others stay ready to attack and defend.
  if (state.window?.kind === "pass" && state.mode === "questCommit" && policy.quest === "alone") {
    const quested = Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat);
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    if (!quested && ids.length > 0) return { type: "Commit", cardIds: [ids[0] ?? ""] };
  }
  // Beldis (12188:A:1): once a round a player with a resource spends it to heal a character that has damage.
  if (state.window?.kind === "pass" && policy.heal && damaged(state) && state.mode !== "questCommit") {
    const healed = nextIntent(state, ctx, { ...options, act: true }, memory, legalIntents(state, ctx));
    if (healed.type === "Trigger") return healed;
  }
  return nextIntent(state, ctx, options, memory, legalIntents(state, ctx));
}

export type NightGame = PlayedGame;

// The goldens (src/campaign/scenarios/fire-in-the-night/golden.test.ts).
// `after`: the log of a campaign whose first five parts were won (Journey Up the Anduin, Lost in Mirkwood, The King's Quest, The Withered Heath and Roam Across Rhovanion, their real Resolutions chained: `afterRhovanion`) and `variant` the way they were won: the allies in the pool
// with Misplaced Trust (pool) or Urdug's Cunning (cunning) in it, or Turayn's oath and Melanwar's guidance lines (oath), Isolde's line too (oathline). `upgraded`: the Upgraded sides. `mode`: the Hard or Expert Mode card.
export type NightVariant = "pool" | "cunning" | "oath" | "oathline";
export type NightGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: NightDecks; outcome: "won" | "lost"; policy?: Partial<NightPolicy>; after?: boolean; variant?: NightVariant; upgraded?: boolean; mode?: ModeCard; lossReason?: string };

// The goldens' stand-in heroes: the staging area's threat is small beside a hero's willpower.
const STATS = { ...HERO_STATS, strong: { ...HERO_STATS.strong, willpower: 100 }, brittle: { ...HERO_STATS.brittle, willpower: 100 } } as const;

const earlierCodes = [
  "12166", "12167", "12169", "12171", "12172", "12173", "12174", "12176", "12177", "12178", "12179", "12180", "12181", "12182", "12183", "12185", "12186", "12184", "18046", "18052", "18070", ...TREASURES,
  ...["journey-up-the-anduin", "lost-in-mirkwood", "the-kings-quest", "the-withered-heath", "roam-across-rhovanion"].flatMap((id) => loadScenario(id).cards.map((card) => card.code)),
];

const game = campaignGame<NightDecks, NightPolicy>({
  campaign,
  scenario: night,
  stats: STATS,
  // The scenario's cards, and what the earlier parts leave in the pool (the boon allies, the burdens, the Accolade and Song boons, Misplaced Trust and Urdug's Cunning, any card of their encounter sets) and the treasures a Resolution may offer.
  codes: [...night.cards.map((card) => card.code), ...earlierCodes],
  intent: nightIntent,
  policy: DEFAULT_POLICY,
  limit: 8000,
  upgraded: [],
  // Not used: the log of the earlier parts is chained from their real Resolutions (`afterRhovanion`).
  earlier: { xp: [0, 0, 0, 0, 0], pool: [], marks: {} },
});

// The Roam Across Rhovanion goldens that the Fire in the Night goldens follow, by the seats and the way the earlier parts were won: each is played from the log the parts before it wrote (test/scenarios/roam-across-rhovanion/game.ts).
const EARLIER: Readonly<Record<string, { golden: string; variant: RhovanionVariant }>> = {
  "1:pool": { golden: "true solo, won, after the earlier parts, Horn, Tiny, Key", variant: "pool" },
  "2:pool": { golden: "two-handed, won, after the earlier parts, Tiny, Horn, Key", variant: "pool" },
  "2:cunning": { golden: "two-handed, won, after the earlier parts, Key, Horn, Tiny, trust twice, Urdug's Cunning for each player", variant: "pool" },
  "1:oath": { golden: "true solo, Easy, won, the oath and guidance lines, Key, Tiny, Horn", variant: "oath" },
  "2:oath": { golden: "two-handed, Easy, won, Melanwar's and Isolde's lines, Horn, Key, Tiny", variant: "oath" },
  "1:oathline": { golden: "true solo, Easy, won, Melanwar's and Isolde's lines, Key, Horn, Tiny", variant: "oathline" },
};
const earlierLogs = new Map<string, CampaignLog>();
const rawLogs = new Map<string, CampaignLog>();
const keyOf = (seatCount: 1 | 2, variant: NightVariant = "pool") => `${seatCount}:${variant}`;
let worldCards: ReadonlyMap<string, PrintedCard> | null = null;

/** Plays the Roam Across Rhovanion goldens that follow the first four parts and writes their Resolutions onto the log those parts wrote, once for each (seats, variant): what Fire in the Night is handed. */
export async function prepareEarlier(): Promise<void> {
  const roam = await rhovanionWorld("strong");
  for (const [key, row] of Object.entries(EARLIER)) {
    const golden = RHOVANION_GOLDENS.find((item) => item.name === row.golden)!;
    const played = playRhovanion(golden, roam.ctx).state;
    const written = applyResolution(rawRhovanionEarlier(golden.seatCount, row.variant), played.scenarioId, played, roam.cards, NO_COPY_LIMITS);
    rawLogs.set(key, written);
    // The stand-in heroes of the golden seats are not the heroes the earlier games lost or carried: they start fresh, and what hangs on a hero stays behind.
    const blank = emptyLog(golden.seatCount);
    earlierLogs.set(key, { ...written, heroesBySeat: blank.heroesBySeat, fallenHeroesBySeat: blank.fallenHeroesBySeat, campaignPool: written.campaignPool.filter((card) => card.attachedTo == null) });
  }
}

/** The log of a campaign that won the first five parts, their real Resolutions chained. */
export function afterRhovanion(seatCount: 1 | 2, variant: NightVariant = "pool"): CampaignLog {
  const log = earlierLogs.get(keyOf(seatCount, variant));
  if (!log) throw new Error("Call nightWorld first: it plays the earlier parts");
  return log;
}

/** The log the five earlier parts' real Resolutions write, with the heroes of their games still on it (what the campaign test reads). */
export function rawEarlier(seatCount: 1 | 2, variant: NightVariant = "pool"): CampaignLog {
  const log = rawLogs.get(keyOf(seatCount, variant));
  if (!log) throw new Error("Call nightWorld first: it plays the earlier parts");
  return log;
}

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier parts were won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const nightWorld = async (decks: NightDecks = "strong") => {
  if (earlierLogs.size === 0) await prepareEarlier();
  const made = await game.world(decks);
  worldCards = made.cards;
  return made;
};

/**
 * The answers the Campaign Setup asks of the players for `log`: with Turayn's oath the first player names 3 non-unique locations to remove (12187:A:2), with Isolde's line 3 non-unique enemies, each the first the search offers.
 * The checklist is asked until it needs nothing more.
 */
export function nightSetupChoices(seatCount: 1 | 2, log: CampaignLog, difficulty: Difficulty): string[] {
  if (!worldCards) throw new Error("Call nightWorld first");
  const answers: string[] = [];
  for (let guard = 0; guard < 40; guard += 1) {
    const plan = checklist({ log, scenario: campaignScenario(night), seats: fillerLoadout(seatCount), effects: EFFECTS, cards: worldCards, difficulty, choices: answers });
    if (plan.ok) return answers;
    const needs = plan.needs;
    if (!needs) throw new Error(plan.errors.join("; "));
    const offered = needs.options.filter((option) => option !== "skip");
    // Each search takes a different card.
    answers.push(offered.find((option) => !answers.includes(option)) ?? offered[0] ?? "skip");
  }
  throw new Error("The Campaign Setup keeps asking");
}
export const nightPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount), choices?: readonly string[], difficulty?: Difficulty) => game.plan(seatCount, log, choices, difficulty);
export const nightStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard, choices?: readonly string[]) => game.start(seatCount, seed, difficulty, { facts, log, modeCard, choices });

// The pinned games: wins (true solo and two-handed, Normal and Easy, from a blank log and after the five earlier parts' real Resolutions with the allies and Misplaced Trust or Urdug's Cunning in the pool, or the oath, guidance and Isolde lines written; a side quest made the current
// quest every round or every other round; the attack on Hrogar's Hill defended or left undefended; the enemies engaged or left in the staging area; Beldis healing; a response used or passed; Beldis in the pool or the line; the treasure of three at 5 progress or none; a card of the pool removed or none)
// and losses (heroes too small to quest, heroes too brittle to survive, Hrogar's Hill holding 50 damage with no side quest defeated or after four or five, the heroes destroyed after four), each on a fixed seed. Every win has three or more side quests in the victory display, so Dagnir is attacked and destroyed.
export const NIGHT_GOLDENS: readonly NightGolden[] = [
  { name: "true solo, won from a blank log, a side quest every round, Hill attack undefended, Beldis's line, no treasure", seatCount: 1, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won", policy: { beldis: "line" } },
  { name: "true solo, won from a blank log, a side quest every other round, Hill attack defended, the last treasure, Beldis in the pool", seatCount: 1, seed: 3, difficulty: "Normal", decks: "strong", outcome: "won", policy: { current: "alternate", defend: "hill", treasure: "last" } },
  { name: "true solo, Easy, won from a blank log, every other round, Hill attack defended, enemies engaged, Beldis heals", seatCount: 1, seed: 2, difficulty: "Easy", decks: "strong", outcome: "won", policy: { current: "alternate", defend: "hill", engage: true, heal: true } },
  { name: "true solo, won from a blank log, every other round, Hill attack defended, enemies engaged, Beldis heals, the last answers taken", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", policy: { choose: "last", current: "alternate", defend: "hill", engage: true, heal: true } },
  { name: "true solo, won, after the earlier parts, every other round, Hill attack defended, the last treasure, the last card of the pool removed", seatCount: 1, seed: 3, difficulty: "Normal", decks: "strong", outcome: "won", after: true, policy: { current: "alternate", defend: "hill", treasure: "last", remove: "last" } },
  { name: "true solo, won, after the earlier parts, a side quest every round, Hill attack defended, Beldis's line, a copy of a location removed from the pool", seatCount: 1, seed: 3, difficulty: "Normal", decks: "strong", outcome: "won", after: true, policy: { defend: "hill", beldis: "line", remove: "first" } },
  { name: "true solo, Easy, won, the oath and guidance lines, every other round, Hill attack defended, the last card of the pool removed", seatCount: 1, seed: 2, difficulty: "Easy", decks: "strong", outcome: "won", after: true, variant: "oath", policy: { current: "alternate", defend: "hill", remove: "last" } },
  { name: "true solo, Easy, won, Melanwar's and Isolde's lines, a side quest every round, Hill attack defended, no response used", seatCount: 1, seed: 1, difficulty: "Easy", decks: "strong", outcome: "won", after: true, variant: "oathline", policy: { defend: "hill", respond: false, remove: "first" } },
  { name: "two-handed, won from a blank log, a side quest every round, Hill attack defended, no treasure", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", policy: { defend: "hill" } },
  { name: "two-handed, won from a blank log, every other round, Hill attack defended, the last treasure, Beldis's line", seatCount: 2, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won", policy: { current: "alternate", defend: "hill", treasure: "last", beldis: "line" } },
  { name: "two-handed, Easy, won from a blank log, Hill attack defended, enemies engaged, Beldis heals, Beldis for the second player", seatCount: 2, seed: 2, difficulty: "Easy", decks: "strong", outcome: "won", policy: { defend: "hill", engage: true, heal: true } },
  { name: "two-handed, won from a blank log, every other round, Hill attack defended, the last answers taken, no response used", seatCount: 2, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won", policy: { choose: "last", current: "alternate", defend: "hill", respond: false } },
  { name: "two-handed, won, after the earlier parts, Misplaced Trust, every other round, a card of the pool removed for each player", seatCount: 2, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won", after: true, policy: { current: "alternate", defend: "hill", remove: "last" } },
  { name: "two-handed, won, after the earlier parts, Urdug's Cunning, every other round, a copy of a location removed for each player", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", after: true, variant: "cunning", policy: { current: "alternate", defend: "hill", remove: "first" } },
  { name: "two-handed, Easy, won, Melanwar's and Isolde's lines, a side quest every round, Hill attack defended, no treasure", seatCount: 2, seed: 2, difficulty: "Easy", decks: "strong", outcome: "won", after: true, variant: "oath", policy: { defend: "hill", remove: "first" } },
  { name: "true solo, weak, lost with Hrogar's Hill holding 50 damage", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "Hrogar's Hill holds" },
  { name: "two-handed, weak, lost on threat", seatCount: 2, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "true solo, brittle, lost with every hero dead", seatCount: 1, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed, brittle, lost with every hero dead", seatCount: 2, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
  { name: "true solo, lost with Hrogar's Hill holding 50 damage, no side quest made the current quest", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "lost", policy: { current: "main" }, lossReason: "Hrogar's Hill holds" },
  { name: "two-handed, lost with Hrogar's Hill holding 50 damage, no side quest made the current quest", seatCount: 2, seed: 2, difficulty: "Normal", decks: "strong", outcome: "lost", policy: { current: "main" }, lossReason: "Hrogar's Hill holds" },
  { name: "two-handed, lost with Hrogar's Hill holding 50 damage after five side quests, the Hill attack undefended", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: "Hrogar's Hill holds" },
  { name: "true solo, Easy, lost with Hrogar's Hill holding 50 damage after four side quests, the oath and guidance lines", seatCount: 1, seed: 3, difficulty: "Easy", decks: "strong", outcome: "lost", after: true, variant: "oath", policy: { current: "alternate" }, lossReason: "Hrogar's Hill holds" },
  { name: "true solo, lost with every character destroyed after four side quests, after the earlier parts", seatCount: 1, seed: 2, difficulty: "Normal", decks: "strong", outcome: "lost", after: true, policy: { current: "alternate", defend: "hill", treasure: "last", remove: "last" }, lossReason: "No seats remain" },
];

/** The log a golden's Resolution is written onto: the earlier parts' real Resolutions, or a blank log. */
export const logBeforeGolden = (golden: NightGolden): CampaignLog => (golden.after ? afterRhovanion(golden.seatCount, golden.variant) : emptyLog(golden.seatCount));

/** The answers the Campaign Setup asks for a golden's log. */
export const nightChoices = (golden: NightGolden): string[] => nightSetupChoices(golden.seatCount, logBeforeGolden(golden), golden.difficulty);

export const playGolden = (golden: NightGolden, ctx: ReduceContext): NightGame => game.play(golden.seatCount, golden.seed, golden.difficulty, ctx, { log: logBeforeGolden(golden), policy: golden.policy, mode: golden.mode, choices: nightChoices(golden) });
