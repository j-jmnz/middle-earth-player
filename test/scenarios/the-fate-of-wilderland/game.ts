import { checklist } from "../../../src/campaign/checklist.ts";
import { NO_COPY_LIMITS } from "../../../src/campaign/wilderland.ts";
import type { LoadoutSeat } from "../../../src/campaign/loadout.ts";
import { applyResolution, emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import { campaignScenario, type Difficulty } from "../../../src/catalog/scenario-data.ts";
import { EFFECTS } from "../../../src/effects/index.ts";
import type { PrintedCard } from "../../../src/rules/core/printed.ts";
import type { ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { characters } from "../../../src/rules/combat/combat.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import type { FramsburgVariant } from "../the-ghost-of-framsburg/game.ts";
import { GUNDABAD_GOLDENS, gundabadWorld, logBeforeGolden as logBeforeGundabad } from "../mount-gundabad/game.ts";
import { EARLIER_POOL } from "../the-ghost-of-framsburg/scene.ts";
import { TREASURES } from "../the-withered-heath/scene.ts";
import { campaign, CODES, wilderland } from "./scene.ts";
import { loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { campaignGame, engageOneEach, fillerLoadout, HERO_STATS, type PlayedGame, type StartOptions } from "../../harness/game-kit.ts";
import { goldenState } from "../../harness/golden-state.ts";

// Test helper. A whole game of The Fate of Wilderland in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. The first character of a seat quests (the others stay ready to attack and defend), the players travel to the first location they may,
// engage the enemies of the staging area one at a time when the policy says, attack one enemy at a time with each ready character (Urdug last, when he can be attacked at all), use the Responses the policy allows (The Heroes' Defense's resource) and answer
// every other choice as the policy says. Every intent is one the reducer listed.
export const WILDERLAND_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type WilderlandDecks = "strong" | "weak" | "brittle";

export const wilderlandLoadout = fillerLoadout;

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier parts were won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
let loaded: ReadonlyMap<string, PrintedCard> | null = null;
const worldCards = (): ReadonlyMap<string, PrintedCard> => {
  if (!loaded) throw new Error("Call wilderlandWorld first");
  return loaded;
};
export const wilderlandWorld = async (decks: WilderlandDecks = "strong") => {
  if (earlierLogs.size === 0) await prepareEarlier();
  const made = await game.world(decks);
  loaded = made.cards;
  return made;
};
export const wilderlandPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount), choices?: readonly string[], difficulty?: Difficulty, loadout?: LoadoutSeat[]) => game.plan(seatCount, log, choices, difficulty, loadout);
export const wilderlandStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, options: StartOptions = {}) => game.start(seatCount, seed, difficulty, options);

/**
 * The answers the Campaign Setup asks of the players for `log`: the search for a boon or treasure card (each player may take one, 12195:A:2), then the 3 non-unique enemies Turayn's line removes and the 3 treacheries Beldis's line removes,
 * each the first the search offers that an earlier search did not take. The checklist is asked until it needs nothing more.
 */
export function wilderlandSetupChoices(seatCount: 1 | 2, log: CampaignLog, difficulty: Difficulty = "Normal", loadout: LoadoutSeat[] = fillerLoadout(seatCount)): string[] {
  const answers: string[] = [];
  for (let guard = 0; guard < 40; guard += 1) {
    const plan = checklist({ log, scenario: campaignScenario(wilderland), seats: loadout, effects: EFFECTS, cards: worldCards(), difficulty, choices: answers });
    if (plan.ok) return answers;
    const needs = plan.needs;
    if (!needs) throw new Error(plan.errors.join("; "));
    const offered = needs.options.filter((option) => option !== "skip");
    answers.push(offered.find((option) => !answers.includes(option)) ?? offered[0] ?? "skip");
  }
  throw new Error("The Campaign Setup keeps asking");
}

export type WilderlandPolicy = {
  // The option a Choose window takes: the first, the last, "progress" (the one that places progress on The Goblins' Assault, else the first), "other" (the first that does not) or "spare" (the first that neither places that progress nor raises threat).
  choose: "first" | "last" | "progress" | "other" | "spare";
  // The quest: the first character of a seat quests ("one": the others stay ready to attack and defend), the first two ("pair") or every character that can ("all").
  quest: "one" | "pair" | "all";
  // The attack: every ready character together on the first enemy any can reach ("together"), or one character at a time so each reaches an enemy of its own ("single").
  attack: "together" | "single";
  // Whether the players engage the enemies of the staging area, one at a time (up to a hero each), and attack them.
  engage: boolean;
  // The most enemies a seat is engaged with at once when it engages (by default one for each hero).
  most?: number;
  // Whether a character defends: every attack ("all") or none. A defender is exhausted, so it cannot quest or attack; with nobody defending the attack falls on the character with the least damage.
  defend: "none" | "all";
  // Whether the players use the Responses the cards offer (The Heroes' Defense's resource after an enemy is destroyed), or pass them.
  use: boolean;
};
export const DEFAULT_POLICY: WilderlandPolicy = { choose: "first", quest: "one", attack: "single", engage: true, defend: "none", use: true };

// The attack the next ready character makes (every ready character that reaches the same enemy, when `single` is false): at the first enemy a character may still declare an attack against, Urdug after every other. Null when nobody can attack.
function attackFrom(state: ScenarioState, ctx: ReduceContext, single: boolean): PlayerIntent | null {
  const reach = characters(state, state.activeSeat, ctx.cards).map((id) => [id, legalTargets(state, { type: "DeclareAttackers", cardId: id }, ctx)] as const).filter(([, enemies]) => enemies.length > 0);
  const urdug = (id: string) => (state.cards[id]?.code === CODES.urdug ? 1 : 0);
  const enemy = [...new Set(reach.flatMap(([, enemies]) => enemies))].sort((left, right) => urdug(left) - urdug(right))[0];
  if (!enemy) return null;
  const attackers = reach.filter(([, enemies]) => enemies.includes(enemy)).map(([id]) => id);
  return { type: "DeclareAttackers", enemyId: enemy, attackerIds: single ? attackers.slice(0, 1) : attackers };
}

const byDamage = (state: ScenarioState, ids: readonly string[]): string | undefined => [...ids].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the option the policy names (only among the options the reducer offered), the engagement, the attack (Urdug last), a defender and the Responses are answered as the policy says.
// Every intent is one the reducer listed. `options`: the auto-player's own policy for the answers this one does not give; the Maestro fixtures (scripts/e2e/the-fate-of-wilderland.ts) play real decklists, so they turn card play on.
export function wilderlandIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: WilderlandPolicy = DEFAULT_POLICY, options: PolicyOptions = WILDERLAND_POLICY): PlayerIntent {
  const intents = legalIntents(state, ctx);
  if (state.window?.kind === "choose") {
    const offered = intents.flatMap((intent) => (intent.type === "Choose" ? [intent.optionId] : []));
    const answers = state.window.options.filter((id) => offered.includes(id));
    const progress = answers.find((id) => id === "progress");
    const other = answers.find((id) => id !== "progress");
    const spare = answers.find((id) => id !== "progress" && id !== "threat");
    const picked = policy.choose === "spare" ? (spare ?? answers[0]) : policy.choose === "last" ? answers.at(-1) : policy.choose === "progress" ? (progress ?? answers[0]) : policy.choose === "other" ? (other ?? answers[0]) : answers[0];
    // Only an option the reducer offered is sent; with none offered the auto-player answers the window.
    if (picked != null) return { type: "Choose", optionId: picked };
    return nextIntent(state, ctx, options, memory, intents);
  }
  if (state.window?.kind === "response") return nextIntent(state, ctx, { ...options, act: policy.use }, memory, intents);
  if (state.window?.kind === "optionalEngage") return (policy.engage ? engageOneEach(state, ctx, policy.most) : null) ?? { type: "DeclineEngage" };
  // Each ready character attacks, together, the first enemy any can reach; Urdug after every other.
  if (state.window?.kind === "playerAttack" && policy.engage) {
    const attack = attackFrom(state, ctx, policy.attack === "single");
    if (attack) return attack;
  }
  // A defender, if the policy has one, is the character with the least damage; with nobody defending the attack falls on the character with the least damage.
  if (state.window?.kind === "defense") {
    const defender = policy.defend === "all" && intents.some((intent) => intent.type === "DeclareDefender") ? byDamage(state, legalTargets(state, { type: "DeclareDefender" }, ctx)) : undefined;
    if (defender) return { type: "DeclareDefender", defenderId: defender };
    const least = byDamage(state, legalTargets(state, { type: "Undefended" }, ctx));
    if (least) return { type: "Undefended", heroId: least };
  }
  // The quest: the first character of the seat quests (or the first two); the others stay ready to attack and defend.
  if (state.window?.kind === "pass" && state.mode === "questCommit") {
    const quested = Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat);
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    if (!quested && ids.length > 0) return { type: "Commit", cardIds: policy.quest === "all" ? ids : ids.slice(0, policy.quest === "pair" ? 2 : 1) };
  }
  if (state.window?.kind === "pass") return nextIntent(state, ctx, { ...options, act: policy.use }, memory, intents);
  return nextIntent(state, ctx, options, memory, intents);
}

export type WilderlandGame = PlayedGame;

// The Mount Gundabad goldens that The Fate of Wilderland follows, by the seats and the way the earlier parts were won: each is played from the log the parts before it wrote (test/scenarios/mount-gundabad/game.ts).
const EARLIER_SCENARIOS = ["journey-up-the-anduin", "lost-in-mirkwood", "the-kings-quest", "the-withered-heath", "roam-across-rhovanion", "fire-in-the-night", "the-ghost-of-framsburg", "mount-gundabad"];
const EARLIER: Readonly<Record<string, string>> = {
  "1:pool": "true solo, won, after the earlier parts, no stage bypassed",
  "1:beldis": "true solo, won, after the earlier parts, Beldis's line, Dagnir hunted and engaged",
  "1:oathline": "true solo, Easy, won, Melanwar's and Isolde's lines, a stage bypassed",
  "2:pool": "two-handed, won, after the earlier parts, Misplaced Trust, no stage bypassed",
  "2:cunning": "two-handed, won, after the earlier parts, Urdug's Cunning, Dragon-sickness in the encounter deck",
  "2:oath": "two-handed, Easy, won, the oath and guidance lines, a stage bypassed",
};
const earlierLogs = new Map<string, CampaignLog>();
const rawLogs = new Map<string, CampaignLog>();
const keyOf = (seatCount: 1 | 2, variant: FramsburgVariant = "pool") => `${seatCount}:${variant}`;

/** Reads the final states of the Mount Gundabad goldens that follow the first seven parts from golden.json (test/harness/golden-state.ts) and writes their Resolutions onto the log those parts wrote, once for each (seats, variant): what The Fate of Wilderland is handed. */
export async function prepareEarlier(): Promise<void> {
  const gundabad = await gundabadWorld("strong");
  for (const [key, name] of Object.entries(EARLIER)) {
    if (rawLogs.has(key)) continue;
    const golden = GUNDABAD_GOLDENS.find((item) => item.name === name);
    if (!golden) throw new Error(`No Mount Gundabad golden named ${name}`);
    const played = goldenState("mount-gundabad", golden.name);
    const written = applyResolution(logBeforeGundabad(golden), played.scenarioId, played, gundabad.cards, NO_COPY_LIMITS);
    rawLogs.set(key, written);
    // The stand-in heroes of the golden seats are not the heroes the earlier games lost or carried: they start fresh, and what hangs on a hero stays behind.
    const blank = emptyLog(golden.seatCount);
    earlierLogs.set(key, { ...written, heroesBySeat: blank.heroesBySeat, fallenHeroesBySeat: blank.fallenHeroesBySeat, campaignPool: written.campaignPool.filter((card) => card.attachedTo == null) });
  }
}

/** The log of a campaign that won the first eight parts, their real Resolutions chained: the fresh heroes' log the next game starts from. */
export function afterGundabad(seatCount: 1 | 2, variant: FramsburgVariant = "pool"): CampaignLog {
  const log = earlierLogs.get(keyOf(seatCount, variant));
  if (!log) throw new Error("Call prepareEarlier first: it builds the earlier parts' log");
  return log;
}

/** The log the eight earlier parts' real Resolutions write, with the heroes of their games still on it (what the campaign test reads). */
export function rawEarlier(seatCount: 1 | 2, variant: FramsburgVariant = "pool"): CampaignLog {
  const log = rawLogs.get(keyOf(seatCount, variant));
  if (!log) throw new Error("Call prepareEarlier first: it builds the earlier parts' log");
  return log;
}

// The goldens (src/campaign/scenarios/the-fate-of-wilderland/golden.test.ts).
// `after`: the log of a campaign whose first eight parts were won (Journey Up the Anduin through Mount Gundabad, their real Resolutions chained: `afterGundabad`) and `variant` the way they were won (the Mount Gundabad goldens' variants and their seats).
// `upgraded`: the Upgraded sides. `mode`: the Hard or Expert Mode card.
export type WilderlandGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: WilderlandDecks; outcome: "won" | "lost"; policy?: Partial<WilderlandPolicy>; after?: boolean; variant?: FramsburgVariant; upgraded?: boolean; mode?: ModeCard; lossReason?: string };

// The pinned games: wins (true solo and two-handed, Normal and Easy, from a blank log and after the eight earlier parts' real Resolutions with the allies and Misplaced Trust or Urdug's Cunning in the pool, the treasures logged and the Turayn, Melanwar, Isolde and Beldis
// lines written; the Choose windows answered each way; one character questing or the attacks made together) and losses (The Goblins' Assault holding as much progress as the players can bear, from the engaged enemies destroyed too slowly or none engaged at all; heroes too small to
// quest, heroes too brittle to survive, every seat eliminated), each on a fixed seed. Every win destroys Urdug with his Defense engaged by The Heroes' Defense.
const TOGETHER = { attack: "together" } as const;
const PASSIVE = { engage: false } as const;
export const WILDERLAND_GOLDENS: readonly WilderlandGolden[] = [
  { name: "true solo, won from a blank log", seatCount: 1, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, won from a blank log, the Choose windows spare The Goblins' Assault", seatCount: 1, seed: 11, difficulty: "Normal", decks: "strong", outcome: "won", policy: { choose: "other" } },
  { name: "true solo, Easy, won from a blank log", seatCount: 1, seed: 1, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "true solo, Easy, won from a blank log, a later seed", seatCount: 1, seed: 3, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "true solo, won, after the earlier parts", seatCount: 1, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won", after: true, variant: "pool" },
  { name: "true solo, won, after the earlier parts, Beldis's line, the last option of every Choose window", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", after: true, variant: "beldis", policy: { choose: "last" } },
  { name: "true solo, Easy, won, Melanwar's and Isolde's lines, the attacks made together", seatCount: 1, seed: 2, difficulty: "Easy", decks: "strong", outcome: "won", after: true, variant: "oathline", policy: TOGETHER },
  { name: "two-handed, won from a blank log", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed, won from a blank log, the Choose windows spare The Goblins' Assault", seatCount: 2, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won", policy: { choose: "other" } },
  { name: "two-handed, Easy, won from a blank log", seatCount: 2, seed: 7, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "two-handed, won, after the earlier parts, Misplaced Trust", seatCount: 2, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won", after: true, variant: "pool" },
  { name: "two-handed, won, after the earlier parts, Urdug's Cunning, the last option of every Choose window", seatCount: 2, seed: 11, difficulty: "Normal", decks: "strong", outcome: "won", after: true, variant: "cunning", policy: { choose: "last" } },
  { name: "two-handed, Easy, won, the oath and guidance lines, the attacks made together", seatCount: 2, seed: 3, difficulty: "Easy", decks: "strong", outcome: "won", after: true, variant: "oath", policy: TOGETHER },
  { name: "true solo, weak, lost on threat", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed, weak, lost on threat", seatCount: 2, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "true solo, brittle, lost with every hero destroyed", seatCount: 1, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed, brittle, lost with every hero destroyed", seatCount: 2, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
  { name: "true solo, lost with The Goblins' Assault at 8 plus 8 progress", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: "The Goblins' Assault" },
  { name: "true solo, lost with nobody engaged, the enemies left to the staging area", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "lost", policy: PASSIVE, lossReason: "The Goblins' Assault" },
  { name: "two-handed, lost with The Goblins' Assault at 8 plus 8 progress", seatCount: 2, seed: 2, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: "The Goblins' Assault" },
  { name: "two-handed, Easy, lost with nobody engaged, the enemies left to the staging area", seatCount: 2, seed: 1, difficulty: "Easy", decks: "strong", outcome: "lost", policy: PASSIVE, lossReason: "The Goblins' Assault" },
  { name: "two-handed, lost with every seat eliminated", seatCount: 2, seed: 6, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: "No seats remain" },
  { name: "true solo, lost after the earlier parts", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "lost", after: true, variant: "pool", lossReason: "The Goblins' Assault" },
  { name: "true solo, Easy, lost after the earlier parts, Melanwar's and Isolde's lines, every Choose window places progress", seatCount: 1, seed: 2, difficulty: "Easy", decks: "strong", outcome: "lost", after: true, variant: "oathline", policy: { choose: "progress" }, lossReason: "The Goblins' Assault" },
  { name: "two-handed, lost after the earlier parts, Urdug's Cunning", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "lost", after: true, variant: "cunning", lossReason: "The Goblins' Assault" },
  { name: "two-handed, Easy, lost after the earlier parts, the oath and guidance lines, nobody engaged", seatCount: 2, seed: 1, difficulty: "Easy", decks: "strong", outcome: "lost", after: true, variant: "oath", policy: PASSIVE, lossReason: "The Goblins' Assault" },
  { name: "two-handed, lost after the earlier parts, Misplaced Trust, every seat eliminated", seatCount: 2, seed: 3, difficulty: "Normal", decks: "strong", outcome: "lost", after: true, variant: "pool", lossReason: "No seats remain" },
];

const game = campaignGame<WilderlandDecks, WilderlandPolicy>({
  campaign,
  scenario: wilderland,
  stats: HERO_STATS,
  // The scenario's cards, and what the earlier parts leave in the pool (the boon allies, the burdens, the Accolade and Song boons, Misplaced Trust and Urdug's Cunning, Gundabad Hunter and Gundabad Stalker, Dragon-sickness) and the treasures a
  // deck may hold or a Resolution may offer.
  codes: [...wilderland.cards.map((card) => card.code), ...EARLIER_POOL, "12191", "12192", "12194", "18052", "18070", ...TREASURES, ...EARLIER_SCENARIOS.flatMap((id) => [...loadScenario(id).cards.map((card) => card.code), ...loadScenario(id).campaignPlaced])],
  intent: wilderlandIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
  upgraded: [],
  // Not used: the log of the earlier parts is chained from their real Resolutions (`afterGundabad`).
  earlier: { xp: [0, 0, 0, 0, 0, 0, 0, 0], pool: [], marks: {} },
});

/** The log a golden's Resolution is written onto: the earlier parts' real Resolutions, or a blank log. */
export const logBeforeGolden = (golden: WilderlandGolden): CampaignLog => (golden.after ? afterGundabad(golden.seatCount, golden.variant) : emptyLog(golden.seatCount));

/** The answers the Campaign Setup asks for a golden's log. */
export const wilderlandChoices = (golden: WilderlandGolden): string[] => wilderlandSetupChoices(golden.seatCount, logBeforeGolden(golden), golden.difficulty);

export const playGolden = (golden: WilderlandGolden, ctx: ReduceContext): WilderlandGame => game.play(golden.seatCount, golden.seed, golden.difficulty, ctx, { log: logBeforeGolden(golden), policy: golden.policy, mode: golden.mode, choices: wilderlandChoices(golden) });

/** Plays a game by seat count, seed and policy outside the goldens (a seed finder, an exploration). */
export const playSeed = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, ctx: ReduceContext, options: { log?: CampaignLog; policy?: Partial<WilderlandPolicy>; limit?: number } = {}): WilderlandGame => game.play(seatCount, seed, difficulty, ctx, { ...options, choices: wilderlandSetupChoices(seatCount, options.log ?? emptyLog(seatCount), difficulty) });
