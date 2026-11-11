import { checklist } from "../../../src/campaign/checklist.ts";
import { applyResolution, emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import { NO_COPY_LIMITS } from "../../../src/campaign/wilderland.ts";
import { campaignScenario, type Difficulty } from "../../../src/catalog/scenario-data.ts";
import { EFFECTS } from "../../../src/effects/index.ts";
import type { PrintedCard } from "../../../src/rules/core/printed.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { TREASURES } from "../the-withered-heath/scene.ts";
import { NIGHT_GOLDENS, nightWorld, playGolden as playNight, rawEarlier as rawNightEarlier, type NightVariant } from "../fire-in-the-night/game.ts";
import { CODES, campaign, EARLIER_POOL, framsburg } from "./scene.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { attackTogether, campaignGame, engageOneEach, fillerLoadout, HERO_STATS, type PlayedGame } from "../../harness/game-kit.ts";

// Test helper. A whole game of The Ghost of Framsburg in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. The first two characters of a seat quest (their willpower is far above the staging area's threat) and the others stay ready. The
// players travel to the first location they may (The Cursed Tomb as soon as they control 3 Loot objectives), engage the enemies of the staging area when the policy says (Fram's Shade first), attack with every ready character together
// (Fram's Shade first), use the Responses and Actions the policy allows (Crypt Key, Old Lantern, Scatha's Teeth, Ashen Brazier, the treasure for Fram's Shade, the Action that shuffles the encounter discard pile) and answer every other choice with the first option, or the last.
export const FRAMSBURG_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type FramsburgDecks = "strong" | "weak" | "brittle";

export const framsburgLoadout = fillerLoadout;

export type FramsburgPolicy = {
  // The option a Choose window with other answers takes: the first or the last.
  choose: "first" | "last";
  // The first player's choice at the beginning of each quest phase of Searching the Ruins (19110:B:1): raise each player's threat by 2, or discard from the encounter deck until a location is and add it to the staging area.
  stage2: "threat" | "location";
  // Whether the players engage the enemies of the staging area, one at a time, and attack them (Fram's Shade first).
  engage: boolean;
  // Whether a character defends: every attack ("all") or none. A defender is exhausted, so it cannot quest or attack; with nobody defending the attack falls on the character with the least damage.
  defend: "none" | "all";
  // The quest: the first two characters of a seat quest (the goldens' heroes have willpower far above the staging area's threat, and Afraid of the Dark or Scatha's Teeth may take one of them out of the quest) or every character that can does (the Maestro fixtures' real decklists).
  quest: "pair" | "all";
  // Whether the players use the Responses and Actions of the Loot objectives and the treasure for Fram's Shade, or pass them.
  use: boolean;
  // Whether a player uses the campaign card's Action (12189:B:3) once a round: each player raises their threat by 1 to shuffle the encounter discard pile into the encounter deck.
  reshuffle: boolean;
  // The Resolution's answers: Gundabad Hunter or Gundabad Stalker for the pool (12189:B:5), the Hazard card of the 2 discarded (12189:B:6), the treasure of the 3 offered to attach to Fram's Shade (12189:B:2, a Choose window).
  burden: "hunter" | "stalker";
  hazard: "first" | "last";
};
export const DEFAULT_POLICY: FramsburgPolicy = { choose: "first", stage2: "location", engage: false, defend: "none", quest: "pair", use: false, reshuffle: false, burden: "hunter", hazard: "first" };

const RESHUFFLE = "12189:action:1";
const TEETH = "19096:action:1";
const inVictory = (state: ScenarioState, code: string): boolean => Object.values(state.cards).some((card) => card.code === code && card.zone === "victory");
/** At the last stage Fram's Shade gains victory 6 only while The Cursed Tomb is in the victory display, so the players leave it alone until then. */
const shadeHeld = (state: ScenarioState): boolean => state.cards[state.questStage ?? ""]?.code === CODES.stage3 && !inVictory(state, CODES.theCursedTomb);

// The auto-player's answer (test/harness/auto-player.ts), except: the Resolution's questions, the travel, an engagement, the attack, a defender and the Responses and Actions are answered as the policy says; a choice takes the first answer, or the last.
// Every intent is one the reducer listed. `options`: the auto-player's own policy for the answers this one does not give; the Maestro fixtures (scripts/e2e/the-ghost-of-framsburg.ts) play real decklists, so they turn card play on.
export function framsburgIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: FramsburgPolicy = DEFAULT_POLICY, options: PolicyOptions = FRAMSBURG_POLICY): PlayerIntent {
  if (state.window?.kind === "resolution") {
    const offered = legalIntents(state, ctx).flatMap((intent) => (intent.type === "ChooseResolution" ? [intent.optionId] : []));
    // The burden of the pool: Gundabad Hunter or Gundabad Stalker; then the Hazard card (a prefixed option).
    const burdens = offered.filter((option) => option === CODES.gundabadHunter || option === CODES.gundabadStalker);
    const wanted = policy.burden === "stalker" ? CODES.gundabadStalker : CODES.gundabadHunter;
    if (burdens.length > 0) return { type: "ChooseResolution", optionId: burdens.includes(wanted) ? wanted : (burdens[0] ?? wanted) };
    return { type: "ChooseResolution", optionId: (policy.hazard === "last" ? offered.at(-1) : offered[0]) ?? "" };
  }
  if (state.window?.kind === "choose" && state.window.options.includes("threat") && state.window.options.includes("location")) return { type: "Choose", optionId: policy.stage2 };
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  const intents = legalIntents(state, ctx);
  // The Action that shuffles the encounter discard pile is used when the policy says, and never otherwise; the other Responses and Actions when the policy uses them.
  // Scatha's Teeth exhausts the hero it is attached to, so it is used once the quest is committed and not before (a hero that cannot quest makes the quest fail).
  const beforeQuest = state.mode === "resourceActions" || state.mode === "planning" || state.mode === "questCommit";
  const triggers = (action: boolean) => intents.filter((intent) => intent.type !== "Trigger" || (intent.effectId === RESHUFFLE ? policy.reshuffle : action && !(beforeQuest && intent.effectId === TEETH)));
  if (state.window?.kind === "response") return nextIntent(state, ctx, { ...options, act: policy.use }, memory, triggers(policy.use));
  if (state.window?.kind === "optionalEngage") return (policy.engage ? engageOneEach(state, ctx) : null) ?? { type: "DeclineEngage" };
  if (state.window?.kind === "travel") {
    const targets = legalTargets(state, { type: "Travel" }, ctx);
    const wanted = targets.find((id) => state.cards[id]?.code === CODES.theCursedTomb) ?? targets[0];
    return wanted ? { type: "Travel", locationId: wanted } : { type: "DeclineTravel" };
  }
  // Each ready character attacks, together, the first enemy any can reach: Fram's Shade before the rest.
  if (state.window?.kind === "playerAttack") {
    const shade = (id: string) => state.cards[id]?.code === CODES.framSShade;
    const attack = attackTogether(state, ctx, undefined, (id) => (shade(id) ? (shadeHeld(state) ? 2 : 0) : 1));
    // The Shade of the last stage is attacked once The Cursed Tomb is in the victory display: destroyed before, it goes to the encounter discard pile and not to the victory display (19111:B:2).
    if (attack && !(attack.type === "DeclareAttackers" && shade(attack.enemyId) && shadeHeld(state))) return attack;
  }
  // The defender, if the policy has one, is the character with the least damage (it is exhausted and cannot quest or attack); with nobody defending the attack falls on the character with the least damage.
  if (state.window?.kind === "defense") {
    const byDamage = (ids: readonly string[]) => [...ids].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    const defender = policy.defend === "all" && intents.some((intent) => intent.type === "DeclareDefender") ? byDamage(legalTargets(state, { type: "DeclareDefender" }, ctx)) : undefined;
    if (defender) return { type: "DeclareDefender", defenderId: defender };
    const least = byDamage(legalTargets(state, { type: "Undefended" }, ctx));
    if (least) return { type: "Undefended", heroId: least };
  }
  // The quest: the first two characters of the seat quest (a hero's willpower is far above the staging area's threat); the others stay ready to attack and defend.
  if (state.window?.kind === "pass" && state.mode === "questCommit" && policy.quest === "pair") {
    const quested = Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat);
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    if (!quested && ids.length > 0) return { type: "Commit", cardIds: ids.slice(0, 2) };
  }
  // Scatha's Teeth, once a round, in the combat phase once the attacks are made: its hero is exhausted, and a hero that quests and attacks has no use for it then.
  if (state.window?.kind === "frameAction" && policy.use && state.mode === "playerAttacks") {
    const key = `${state.round}:${TEETH}`;
    const teeth = intents.find((intent) => intent.type === "Trigger" && intent.effectId === TEETH);
    if (teeth?.type === "Trigger" && !memory.has(key)) {
      memory.add(key);
      return { type: "Trigger", cardId: teeth.cardId, effectId: teeth.effectId };
    }
  }
  if (state.window?.kind === "pass") return nextIntent(state, ctx, { ...options, act: policy.use || policy.reshuffle }, memory, triggers(policy.use));
  return nextIntent(state, ctx, options, memory, intents);
}

export type FramsburgGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-ghost-of-framsburg/golden.test.ts).
// `after`: the log of a campaign whose first six parts were won (Journey Up the Anduin, Lost in Mirkwood, The King's Quest, The Withered Heath, Roam Across Rhovanion and Fire in the Night, their real Resolutions chained: `afterNight`) and `variant` the way they were won
// (the night goldens' variants and their seats). `upgraded`: the Upgraded sides. `mode`: the Hard or Expert Mode card.
export type FramsburgVariant = "pool" | "cunning" | "oath" | "oathline" | "beldis";
export type FramsburgGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: FramsburgDecks; outcome: "won" | "lost"; policy?: Partial<FramsburgPolicy>; after?: boolean; variant?: FramsburgVariant; upgraded?: boolean; mode?: ModeCard; lossReason?: string };

// The goldens' stand-in heroes: the staging area's threat is small beside a hero's willpower, and a starting threat of 6 keeps most of the 50 for the rounds, and the tens digit the cards read rises from 0.
const STATS = { ...HERO_STATS, strong: { ...HERO_STATS.strong, willpower: 100, threat: 2 }, brittle: { ...HERO_STATS.brittle, willpower: 100, threat: 2 }, weak: { ...HERO_STATS.weak, threat: 9 } } as const;

const EARLIER_CARDS = [
  ...EARLIER_POOL, "18052", "18070", ...TREASURES,
  ...["journey-up-the-anduin", "lost-in-mirkwood", "the-kings-quest", "the-withered-heath", "roam-across-rhovanion", "fire-in-the-night"].flatMap((id) => loadScenario(id).cards.map((card) => card.code)),
];

const game = campaignGame<FramsburgDecks, FramsburgPolicy>({
  campaign,
  scenario: framsburg,
  stats: STATS,
  // The scenario's cards, its campaign card and the cards that card places, and what the earlier parts leave in the pool (the boon allies, the burdens, the Accolade and Song boons, Misplaced Trust and Urdug's Cunning, any card of their encounter sets) and the treasures a Resolution may offer.
  codes: [...framsburg.cards.map((card) => card.code), ...framsburg.campaignPlaced, framsburg.campaignCard, ...EARLIER_CARDS],
  intent: framsburgIntent,
  policy: DEFAULT_POLICY,
  limit: 8000,
  upgraded: [],
  // Not used: the log of the earlier parts is chained from their real Resolutions (`afterNight`).
  earlier: { xp: [0, 0, 0, 0, 0, 0], pool: [], marks: {} },
});

// The Fire in the Night goldens that the Ghost of Framsburg goldens follow, by the seats and the way the earlier parts were won: each is played from the log the parts before it wrote (test/scenarios/fire-in-the-night/game.ts).
const EARLIER: Readonly<Record<string, { golden: string; variant: NightVariant }>> = {
  "1:pool": { golden: "true solo, won, after the earlier parts, every other round, Hill attack defended, the last treasure, the last card of the pool removed", variant: "pool" },
  "1:beldis": { golden: "true solo, won, after the earlier parts, a side quest every round, Hill attack defended, Beldis's line, a copy of a location removed from the pool", variant: "pool" },
  "1:oath": { golden: "true solo, Easy, won, the oath and guidance lines, every other round, Hill attack defended, the last card of the pool removed", variant: "oath" },
  "1:oathline": { golden: "true solo, Easy, won, Melanwar's and Isolde's lines, a side quest every round, Hill attack defended, no response used", variant: "oathline" },
  "2:pool": { golden: "two-handed, won, after the earlier parts, Misplaced Trust, every other round, a card of the pool removed for each player", variant: "pool" },
  "2:cunning": { golden: "two-handed, won, after the earlier parts, Urdug's Cunning, every other round, a copy of a location removed for each player", variant: "cunning" },
  "2:oath": { golden: "two-handed, Easy, won, Melanwar's and Isolde's lines, a side quest every round, Hill attack defended, no treasure", variant: "oath" },
};
const earlierLogs = new Map<string, CampaignLog>();
const rawLogs = new Map<string, CampaignLog>();
const keyOf = (seatCount: 1 | 2, variant: FramsburgVariant = "pool") => `${seatCount}:${variant}`;
let worldCards: ReadonlyMap<string, PrintedCard> | null = null;

/** Plays the Fire in the Night goldens that follow the first five parts and writes their Resolutions onto the log those parts wrote, once for each (seats, variant): what The Ghost of Framsburg is handed. */
export async function prepareEarlier(): Promise<void> {
  const night = await nightWorld("strong");
  for (const [key, row] of Object.entries(EARLIER)) {
    const golden = NIGHT_GOLDENS.find((item) => item.name === row.golden);
    if (!golden) throw new Error(`No Fire in the Night golden named ${row.golden}`);
    const played = playNight(golden, night.ctx).state;
    const written = applyResolution(rawNightEarlier(golden.seatCount, row.variant), played.scenarioId, played, night.cards, NO_COPY_LIMITS);
    rawLogs.set(key, written);
    // The stand-in heroes of the golden seats are not the heroes the earlier games lost or carried: they start fresh, and what hangs on a hero stays behind.
    const blank = emptyLog(golden.seatCount);
    earlierLogs.set(key, { ...written, heroesBySeat: blank.heroesBySeat, fallenHeroesBySeat: blank.fallenHeroesBySeat, campaignPool: written.campaignPool.filter((card) => card.attachedTo == null) });
  }
}

/** The log of a campaign that won the first six parts, their real Resolutions chained. */
export function afterNight(seatCount: 1 | 2, variant: FramsburgVariant = "pool"): CampaignLog {
  const log = earlierLogs.get(keyOf(seatCount, variant));
  if (!log) throw new Error("Call framsburgWorld first: it plays the earlier parts");
  return log;
}

/** The log the six earlier parts' real Resolutions write, with the heroes of their games still on it (what the campaign test reads). */
export function rawEarlier(seatCount: 1 | 2, variant: FramsburgVariant = "pool"): CampaignLog {
  const log = rawLogs.get(keyOf(seatCount, variant));
  if (!log) throw new Error("Call framsburgWorld first: it plays the earlier parts");
  return log;
}

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier parts were won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const framsburgWorld = async (decks: FramsburgDecks = "strong") => {
  if (earlierLogs.size === 0) await prepareEarlier();
  const made = await game.world(decks);
  worldCards = made.cards;
  return made;
};

/**
 * The answers the Campaign Setup asks of the players for `log`: with Isolde's line the first player names 3 treacheries to remove (12189:A:2), with Beldis's line 3 non-unique locations, each the first the search offers.
 * The checklist is asked until it needs nothing more.
 */
export function framsburgSetupChoices(seatCount: 1 | 2, log: CampaignLog, difficulty: Difficulty = "Normal"): string[] {
  if (!worldCards) throw new Error("Call framsburgWorld first");
  const answers: string[] = [];
  for (let guard = 0; guard < 40; guard += 1) {
    const plan = checklist({ log, scenario: campaignScenario(framsburg), seats: framsburgLoadout(seatCount), effects: EFFECTS, cards: worldCards, difficulty, choices: answers });
    if (plan.ok) return answers;
    const needs = plan.needs;
    if (!needs) throw new Error(plan.errors.join("; "));
    const offered = needs.options.filter((option) => option !== "skip");
    // Each search takes a different card.
    answers.push(offered.find((option) => !answers.includes(option)) ?? offered[0] ?? "skip");
  }
  throw new Error("The Campaign Setup keeps asking");
}
export const framsburgPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount), choices?: readonly string[], difficulty?: Difficulty) => game.plan(seatCount, log, choices, difficulty);
export const framsburgStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard, choices?: readonly string[]) => game.start(seatCount, seed, difficulty, { facts, log, modeCard, choices });

// The pinned games: wins (true solo and two-handed, Normal and Easy, from a blank log and after the six earlier parts' real Resolutions with the allies and Misplaced Trust or Urdug's Cunning in the pool or the Turayn, Melanwar, Isolde and Beldis lines written; the Loot objectives claimed,
// Crypt Key and Old Lantern used, a treasure attached to Fram's Shade and claimed or none, the Action that shuffles the encounter discard pile used or not, Gundabad Hunter or Gundabad Stalker for the pool, a Hazard card or a burden among the two discarded) and losses (heroes too small to quest,
// heroes too brittle to survive, the threat of every player at 50), each on a fixed seed.
const USE = { use: true, engage: true } as const;
const SHUFFLE = { ...USE, reshuffle: true } as const;
export const FRAMSBURG_GOLDENS: readonly FramsburgGolden[] = [
  { name: "true solo, won from a blank log, Loot claimed, Crypt Key and Old Lantern used, Gundabad Hunter for the pool", seatCount: 1, seed: 3, difficulty: "Normal", decks: "strong", outcome: "won", policy: USE },
  { name: "true solo, won from a blank log, a treasure attached to Fram's Shade and claimed, Gundabad Hunter for the pool", seatCount: 1, seed: 24, difficulty: "Normal", decks: "strong", outcome: "won", policy: USE },
  { name: "true solo, won from a blank log, a burden of the two Hazard cards for the pool", seatCount: 1, seed: 10, difficulty: "Normal", decks: "strong", outcome: "won", policy: USE },
  { name: "true solo, Easy, won from a blank log, the last answers taken, a treasure attached to Fram's Shade", seatCount: 1, seed: 11, difficulty: "Easy", decks: "strong", outcome: "won", policy: { ...USE, choose: "last" } },
  { name: "true solo, Easy, won from a blank log, the encounter discard pile shuffled, Gundabad Stalker and the last Hazard card", seatCount: 1, seed: 1, difficulty: "Easy", decks: "strong", outcome: "won", policy: { ...SHUFFLE, burden: "stalker", hazard: "last" } },
  { name: "true solo, won, after the earlier parts, the encounter discard pile shuffled, Gundabad Hunter", seatCount: 1, seed: 3, difficulty: "Normal", decks: "strong", outcome: "won", after: true, variant: "pool", policy: SHUFFLE },
  { name: "true solo, won, after the earlier parts, Beldis's line, Gundabad Stalker and the last Hazard card", seatCount: 1, seed: 15, difficulty: "Normal", decks: "strong", outcome: "won", after: true, variant: "beldis", policy: { ...SHUFFLE, burden: "stalker", hazard: "last" } },
  { name: "true solo, won, after the earlier parts, Beldis's line, a treasure attached to Fram's Shade, Gundabad Stalker", seatCount: 1, seed: 138, difficulty: "Normal", decks: "strong", outcome: "won", after: true, variant: "beldis", policy: { ...SHUFFLE, burden: "stalker", hazard: "last" } },
  { name: "true solo, Easy, won, Melanwar's and Isolde's lines, the encounter discard pile shuffled, Gundabad Hunter", seatCount: 1, seed: 2, difficulty: "Easy", decks: "strong", outcome: "won", after: true, variant: "oathline", policy: SHUFFLE },
  { name: "true solo, Easy, won, Melanwar's and Isolde's lines, a burden of the two Hazard cards for the pool", seatCount: 1, seed: 7, difficulty: "Easy", decks: "strong", outcome: "won", after: true, variant: "oathline", policy: SHUFFLE },
  { name: "two-handed, won from a blank log, the encounter discard pile shuffled, Gundabad Stalker and the last Hazard card", seatCount: 2, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won", policy: { ...SHUFFLE, burden: "stalker", hazard: "last" } },
  { name: "two-handed, won from a blank log, a treasure attached to Fram's Shade and claimed, the discard pile shuffled", seatCount: 2, seed: 5, difficulty: "Normal", decks: "strong", outcome: "won", policy: { ...SHUFFLE, burden: "stalker", hazard: "last" } },
  { name: "two-handed, Easy, won from a blank log, Gundabad Hunter, the Hazard card first", seatCount: 2, seed: 14, difficulty: "Easy", decks: "strong", outcome: "won", policy: USE },
  { name: "two-handed, Easy, won from a blank log, a burden of the two Hazard cards for the pool", seatCount: 2, seed: 20, difficulty: "Easy", decks: "strong", outcome: "won", policy: USE },
  { name: "two-handed, won, after the earlier parts, Misplaced Trust, the discard pile shuffled", seatCount: 2, seed: 28, difficulty: "Easy", decks: "strong", outcome: "won", after: true, variant: "pool", policy: SHUFFLE },
  { name: "two-handed, won, after the earlier parts, Urdug's Cunning, a treasure attached to Fram's Shade", seatCount: 2, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won", after: true, variant: "cunning", policy: SHUFFLE },
  { name: "two-handed, Easy, won, the oath and guidance lines, a treasure attached to Fram's Shade", seatCount: 2, seed: 1, difficulty: "Easy", decks: "strong", outcome: "won", after: true, variant: "oath", policy: SHUFFLE },
  { name: "true solo, lost with the threat at 50", seatCount: 1, seed: 5, difficulty: "Normal", decks: "strong", outcome: "lost", policy: USE, lossReason: "No seats remain" },
  { name: "two-handed, lost with the threat of every player at 50", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "lost", policy: SHUFFLE, lossReason: "No seats remain" },
  { name: "true solo, weak, lost on threat", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed, weak, lost on threat", seatCount: 2, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "true solo, brittle, lost with every hero dead", seatCount: 1, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed, brittle, lost with every hero dead", seatCount: 2, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
  { name: "true solo, Easy, lost after the earlier parts, Melanwar's and Isolde's lines", seatCount: 1, seed: 1, difficulty: "Easy", decks: "strong", outcome: "lost", after: true, variant: "oathline", policy: USE, lossReason: "No seats remain" },
  { name: "two-handed, lost after the earlier parts, Urdug's Cunning", seatCount: 2, seed: 3, difficulty: "Normal", decks: "strong", outcome: "lost", after: true, variant: "cunning", policy: USE, lossReason: "No seats remain" },
];

/** The log a golden's Resolution is written onto: the earlier parts' real Resolutions, or a blank log. */
export const logBeforeGolden = (golden: FramsburgGolden): CampaignLog => (golden.after ? afterNight(golden.seatCount, golden.variant) : emptyLog(golden.seatCount));

/** The answers the Campaign Setup asks for a golden's log. */
export const framsburgChoices = (golden: FramsburgGolden): string[] => framsburgSetupChoices(golden.seatCount, logBeforeGolden(golden), golden.difficulty);

export const playGolden = (golden: FramsburgGolden, ctx: ReduceContext): FramsburgGame => game.play(golden.seatCount, golden.seed, golden.difficulty, ctx, { log: logBeforeGolden(golden), policy: golden.policy, mode: golden.mode, choices: framsburgChoices(golden) });
