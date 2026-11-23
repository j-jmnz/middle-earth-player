import { checklist } from "../../../src/campaign/checklist.ts";
import { applyResolution, emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import { NO_COPY_LIMITS } from "../../../src/campaign/wilderland.ts";
import { campaignScenario, type Difficulty } from "../../../src/catalog/scenario-data.ts";
import { EFFECTS } from "../../../src/effects/index.ts";
import type { PrintedCard } from "../../../src/rules/core/printed.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { UPANDUIN_GOLDENS, upanduinWorld } from "../journey-up-the-anduin/game.ts";
import { LOSTMIRK_GOLDENS, lostmirkWorld } from "../lost-in-mirkwood/game.ts";
import { KINGSQUEST_GOLDENS, kingsquestWorld } from "../the-kings-quest/game.ts";
import { CODES, TREASURES, campaign, heath } from "./scene.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { campaignGame, fillerLoadout, HERO_STATS, type PlayedGame } from "../../harness/game-kit.ts";
import { goldenState } from "../../harness/golden-state.ts";

// Test helper. A whole game of The Withered Heath in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. The players travel to a Deep location (or Creature Den) when one is offered, so the Dragon Signs come out of the Caves deck, engage one enemy at a time
// (a Dragon Sign's guard is an enemy of the staging area) and attack with every character together, Cold-Drake first (it is attackable from the staging area at stages 2 and 4); every choice takes the answer the policy says.
export const HEATH_POLICY: PolicyOptions = { scout: "q3", prefer: "", protect: "q3", play: false, act: true };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type HeathDecks = "strong" | "weak" | "brittle";

export const heathLoadout = fillerLoadout;

export type HeathPolicy = {
  // The option a Choose window with these answers takes: "smart" prefers the answers listed in PREFERRED and the card of a look that gets the players to a Dragon Sign soonest, "first" or "last" takes the first or the last.
  choose: "smart" | "first" | "last";
  // The stages (1 to 4) whose Accolade boon the players attach to a hero when it is offered (12175:B:1); the others are declined. A player controls one Accolade boon at a time, so the first stage taken in a game is the one a solo player holds.
  accolades: readonly number[];
  // The Resolution's Song boon of each seat (12175:B:6): the first or the last offered, or none (skip). And the treasure of the three drawn (12175:B:7): the first or the last.
  song: "first" | "last" | "skip";
  treasure: "first" | "last";
  // Whether a character defends: the goldens' heroes are numbers that shrug an attack off and stay ready to attack (nobody defends), the fixtures' real decklists defend as the auto-player does.
  defend: boolean;
};
export const DEFAULT_POLICY: HeathPolicy = { choose: "smart", accolades: [1, 2, 3, 4], song: "first", treasure: "first", defend: false };

// Where the players travel: a Deep location (the Caves deck replaces it, a Dragon Sign among its cards) or Creature Den (which guards a Dragon Sign itself), else the first location offered.
const WANTED_TRAVEL: readonly string[] = [CODES.creatureDen, CODES.dwarvenDoor, CODES.caveEntrance, CODES.highFalls];
const LOOK_ORDER: readonly string[] = WANTED_TRAVEL;

const TREASURE_CODES: readonly string[] = TREASURES;
const isCold = (state: ScenarioState, id: string) => state.cards[id]?.code === CODES.coldDrake;
// The order the players deal with enemies in: the guard of a Dragon Sign (the sign is attached to it), Cold-Drake, any other enemy.
// The main quest stage whose defeat the players are answering: stage n is defeated when stage n + 1 is revealed; the last is defeated by Cold-Drake lying in the victory display.
const STAGE_CODES: readonly string[] = [CODES.stage1, CODES.stage2, CODES.stage3, CODES.stage4];
const defeatedStage = (state: ScenarioState): number => {
  const now = STAGE_CODES.indexOf(state.cards[state.questStage ?? ""]?.code ?? "");
  const drakeDone = Object.values(state.cards).some((card) => card.code === CODES.coldDrake && card.zone === "victory");
  return now === 3 && drakeDone ? 4 : now;
};
const priority = (state: ScenarioState, id: string): number =>
  Object.values(state.cards).some((card) => card.code === CODES.dragonSign && card.host === id) ? 0 : isCold(state, id) ? 1 : 2;

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the answer the policy says; the Resolution's questions are answered as the policy says; the players travel to the locations above, engage an enemy at a time and attack together,
// Cold-Drake first. Every intent is one the reducer listed. `options`: the auto-player's own policy for the answers this one does not give; the fixtures (scripts/e2e/the-withered-heath.ts) play real decklists, so they turn card play on.
export function heathIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: HeathPolicy = DEFAULT_POLICY, options: PolicyOptions = HEATH_POLICY): PlayerIntent {
  if (state.window?.kind === "resolution") {
    const offered = legalIntents(state, ctx).flatMap((intent) => (intent.type === "ChooseResolution" ? [intent.optionId] : []));
    // The treasure draw offers three treasures; the Song question offers the Songs not taken yet and "skip".
    const treasures = offered.filter((option) => TREASURE_CODES.includes(option));
    if (treasures.length > 0) return { type: "ChooseResolution", optionId: (policy.treasure === "last" ? treasures.at(-1) : treasures[0]) ?? "" };
    const songs = offered.filter((option) => option !== "skip");
    const song = policy.song === "skip" ? "skip" : policy.song === "last" ? songs.at(-1) : songs[0];
    return { type: "ChooseResolution", optionId: song ?? offered[0] ?? "" };
  }
  if (state.window?.kind === "choose") return { type: "Choose", optionId: chosen(state, state.window.options, policy, ctx.cards) };
  if (state.window?.kind === "travel") {
    const targets = legalTargets(state, { type: "Travel" }, ctx);
    const wanted = WANTED_TRAVEL.map((code) => targets.find((id) => state.cards[id]?.code === code)).find((id) => id != null) ?? targets[0];
    return wanted ? { type: "Travel", locationId: wanted } : { type: "DeclineTravel" };
  }
  if (state.window?.kind === "optionalEngage") {
    const seat = state.seats[state.activeSeat];
    const enemy = [...legalTargets(state, { type: "Engage" }, ctx)].filter((id) => !isCold(state, id)).sort((left, right) => priority(state, left) - priority(state, right))[0];
    return enemy && seat && seat.engaged.length < seat.heroes.length ? { type: "Engage", enemyId: enemy } : { type: "DeclineEngage" };
  }
  // Each ready character attacks on its own, the enemy that guards a Dragon Sign first, then Cold-Drake, then any other.
  if (state.window?.kind === "playerAttack" && legalIntents(state, ctx).some((intent) => intent.type === "DeclareAttackers")) {
    const mine = Object.values(state.cards).filter((card) => card.controller === state.activeSeat && (card.zone === "heroes" || card.zone === "play")).map((card) => card.id);
    const attacker = mine.find((id) => legalTargets(state, { type: "DeclareAttackers", cardId: id }, ctx).length > 0);
    const targets = attacker ? legalTargets(state, { type: "DeclareAttackers", cardId: attacker }, ctx) : [];
    const enemy = [...targets].sort((left, right) => priority(state, left) - priority(state, right))[0];
    if (attacker && enemy) return { type: "DeclareAttackers", enemyId: enemy, attackerIds: [attacker] };
  }
  // Nobody defends (a defender is exhausted and cannot attack in the same round): the attack falls on the character with the least damage.
  if (state.window?.kind === "defense" && !policy.defend) {
    const heroes = legalTargets(state, { type: "Undefended" }, ctx);
    const least = [...heroes].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (least) return { type: "Undefended", heroId: least };
  }
  // The quest: the first character of the seat quests alone (a hero's willpower is far above the staging area's threat); the others stay ready to attack and defend.
  if (state.window?.kind === "pass" && state.mode === "questCommit") {
    const quested = Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat);
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    if (!quested && ids.length > 0) return { type: "Commit", cardIds: [ids[0] ?? ""] };
  }
  return nextIntent(state, ctx, options, memory, legalIntents(state, ctx));
}

// The answers of "smart", best first: attach the Accolade boon, then the same order the other scenarios prefer.
const PREFERRED = ["attach", "replace", "remove", "immune", "add", "do", "threat", "draw", "resource", "discard", "decline", "cancel", "distribute"];

function chosen(state: ScenarioState, options: readonly string[], policy: HeathPolicy, cards: ReadonlyMap<string, PrintedCard>): string {
  // An Accolade boon is offered with the stage it was defeated at (12175:B:1).
  if (options.includes("attach") && options.includes("decline")) return policy.accolades.includes(defeatedStage(state)) ? "attach" : "decline";
  if (policy.choose === "last") return options.at(-1) ?? "";
  if (policy.choose === "first") return options[0] ?? "";
  // A look at the top of the encounter deck (19022:B:1, 19024:B:1): the card to reveal is the one that gets the players to a Dragon Sign soonest, a Deep location or Creature Den, then any location, then an enemy, then the rest.
  const looked = options.filter((id) => state.cards[id] != null);
  if (looked.length > 0) {
    const rank = (id: string): number => {
      const code = state.cards[id]?.code ?? "";
      const at = LOOK_ORDER.indexOf(code);
      if (at >= 0) return at;
      const type = cards.get(code)?.type;
      return type === "location" ? LOOK_ORDER.length : type === "enemy" ? LOOK_ORDER.length + 1 : LOOK_ORDER.length + 2;
    };
    return [...looked].sort((left, right) => rank(left) - rank(right))[0] ?? "";
  }
  const ranked = [...options].sort((left, right) => (PREFERRED.indexOf(left) + 1 || 99) - (PREFERRED.indexOf(right) + 1 || 99));
  return ranked[0] ?? "";
}

export type HeathGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-withered-heath/golden.test.ts).
// `after`: the log of a campaign whose first three parts were won (Journey Up the Anduin, Lost in Mirkwood and The King's Quest, their real Resolutions chained: `afterKingsquest`) and `variant` the way they were won: the allies in the pool (pool),
// or Turayn's oath and Melanwar's guidance lines (oath), Isolde's line too (oathline). `upgraded`: the Upgraded sides. `mode`: the Hard or Expert Mode card.
export type HeathVariant = "pool" | "oath" | "oathline";
// `ally`: the unique boon ally the boon-ally search of the Campaign Setup (12175:A:2) takes (a card code), or "skip"; by default the first one offered.
export type HeathGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: HeathDecks; outcome: "won" | "lost"; policy?: Partial<HeathPolicy>; after?: boolean; variant?: HeathVariant; ally?: string; upgraded?: boolean; mode?: ModeCard; lossReason?: string };

// The pinned games, each on a fixed seed: see HEATH_GOLDENS below.
const STATS = { ...HERO_STATS, strong: { ...HERO_STATS.strong, willpower: 100 }, brittle: { ...HERO_STATS.brittle, willpower: 100 } } as const;

const earlierCodes = ["12166", "12167", "12169", "12171", "12172", "12173", "12174", "18070", ...loadScenario("journey-up-the-anduin").cards.map((card) => card.code), ...loadScenario("lost-in-mirkwood").cards.map((card) => card.code), ...loadScenario("the-kings-quest").cards.map((card) => card.code), ...TREASURE_CODES];

const game = campaignGame<HeathDecks, HeathPolicy>({
  campaign,
  scenario: heath,
  stats: STATS,
  // The scenario's cards, the boons its campaign card sets aside and the Songs its Resolution offers, and what the first three parts leave in the pool (Turayn, Melanwar, Isolde, A Growing Threat, the burdens, any card of their encounter sets).
  codes: [...heath.cards.map((card) => card.code), "12176", "12177", "12178", "12179", "12180", "12181", "12182", "12183", ...earlierCodes],
  intent: heathIntent,
  policy: DEFAULT_POLICY,
  limit: 8000,
  upgraded: [],
  // Not used: the log of the earlier parts is chained from their real Resolutions (`afterKingsquest`).
  earlier: { xp: [0, 0, 0], pool: [], marks: {} },
});

// The three earlier parts' goldens that the Withered Heath goldens follow, by the seats and the way they were won: each is played from the log the one before wrote.
const EARLIER: Readonly<Record<string, { upanduin: string; lostmirk: string; kingsquest: string }>> = {
  "1:pool": { upanduin: "true solo, won, Turayn joins the pool", lostmirk: "true solo, won, Melanwar joins the pool, a treasure discovered, a hero carried away", kingsquest: "true solo, won, after the earlier parts, Isolde joins the pool, The Threat to Wilderland, a treasure discovered" },
  "2:pool": { upanduin: "two-handed, won, a treasure discovered, Turayn joins the pool", lostmirk: "two-handed, won, Melanwar joins the pool, a treasure discovered", kingsquest: "two-handed, won, after the earlier parts, a treasure discovered" },
  "1:oath": { upanduin: "true solo, Easy, won, the oath line", lostmirk: "true solo, Easy, won, the guidance line", kingsquest: "true solo, Easy, won, Turayn's oath, Isolde joins the pool, a treasure discovered" },
  "2:oath": { upanduin: "two-handed, Easy, won, a treasure discovered, the oath line", lostmirk: "two-handed, Easy, won, the guidance line", kingsquest: "two-handed, Easy, won, Turayn's oath, Isolde's line, Dagnir's Spawn, a treasure discovered" },
  "1:oathline": { upanduin: "true solo, Easy, won, the oath line", lostmirk: "true solo, Easy, won, the guidance line", kingsquest: "true solo, Easy, won, Turayn's oath, Isolde's line, Dagnir's Spawn, no treasure" },
};
const earlierLogs = new Map<string, CampaignLog>();
const rawLogs = new Map<string, CampaignLog>();

const keyOf = (seatCount: 1 | 2, variant: HeathVariant = "pool") => `${seatCount}:${variant}`;

/** Reads the final states of the three earlier parts' goldens from golden.json (test/harness/golden-state.ts) and writes their Resolutions onto a blank log, once for each (seats, variant): what The Withered Heath is handed. */
export async function prepareEarlier(): Promise<void> {
  const upanduin = await upanduinWorld("strong");
  const lostmirk = await lostmirkWorld("strong");
  const kingsquest = await kingsquestWorld("strong");
  for (const [key, names] of Object.entries(EARLIER)) {
    const first = UPANDUIN_GOLDENS.find((item) => item.name === names.upanduin)!;
    const second = LOSTMIRK_GOLDENS.find((item) => item.name === names.lostmirk)!;
    const third = KINGSQUEST_GOLDENS.find((item) => item.name === names.kingsquest)!;
    const one = goldenState("journey-up-the-anduin", first.name);
    const log = applyResolution(emptyLog(first.seatCount), one.scenarioId, one, upanduin.cards, NO_COPY_LIMITS);
    const two = goldenState("lost-in-mirkwood", second.name);
    const logged = applyResolution(log, two.scenarioId, two, lostmirk.cards, NO_COPY_LIMITS);
    // The King's Quest golden is played from the log of the first two parts with the stand-in heroes dropped (its own `afterEarlier`); its Resolution is written onto the real log of the first two.
    const three = goldenState("the-kings-quest", third.name);
    const written = applyResolution(logged, three.scenarioId, three, kingsquest.cards, NO_COPY_LIMITS);
    rawLogs.set(key, written);
    // The stand-in heroes of the golden seats are not the heroes the earlier games lost or carried: they start fresh, and what hangs on a hero stays behind.
    const blank = emptyLog(first.seatCount);
    earlierLogs.set(key, { ...written, heroesBySeat: blank.heroesBySeat, fallenHeroesBySeat: blank.fallenHeroesBySeat, campaignPool: written.campaignPool.filter((card) => card.attachedTo == null) });
  }
}

/** The log of a campaign that won Journey Up the Anduin, Lost in Mirkwood and The King's Quest, their real Resolutions chained: `oath` and `oathline` for the lines in place of the allies in the pool. */
export function afterKingsquest(seatCount: 1 | 2, variant: HeathVariant = "pool"): CampaignLog {
  const log = earlierLogs.get(keyOf(seatCount, variant));
  if (!log) throw new Error("Call heathWorld first: it builds the earlier parts' log");
  return log;
}

/** The log the three earlier parts' real Resolutions write, with the heroes of their games still on it (what the campaign test reads). */
export function rawEarlier(seatCount: 1 | 2, variant: HeathVariant = "pool"): CampaignLog {
  const log = rawLogs.get(keyOf(seatCount, variant));
  if (!log) throw new Error("Call heathWorld first: it builds the earlier parts' log");
  return log;
}

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier parts were won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
let worldCards: ReadonlyMap<string, PrintedCard> | null = null;
export const heathWorld = async (decks: HeathDecks = "strong") => {
  if (earlierLogs.size === 0) await prepareEarlier();
  const made = await game.world(decks);
  worldCards = made.cards;
  return made;
};

/**
 * The answers the Campaign Setup asks of the players for `log`: the boon-ally search (12175:A:2; `ally`, or the first ally offered, "skip" to take none), then Melanwar's two locations and one Caves location and Isolde's three enemies
 * when the log holds the lines, each the first the search offers. The checklist is asked until it needs nothing more.
 */
export function heathSetupChoices(seatCount: 1 | 2, log: CampaignLog, difficulty: Difficulty, ally?: string): string[] {
  if (!worldCards) throw new Error("Call heathWorld first");
  const answers: string[] = [];
  for (let guard = 0; guard < 40; guard += 1) {
    const plan = checklist({ log, scenario: campaignScenario(heath), seats: fillerLoadout(seatCount), effects: EFFECTS, cards: worldCards, difficulty, choices: answers });
    if (plan.ok) return answers;
    const needs = plan.needs;
    if (!needs) throw new Error(plan.errors.join("; "));
    const offered = needs.options.filter((option) => option !== "skip");
    answers.push(ally != null && needs.options.includes(ally) ? ally : (offered[0] ?? "skip"));
  }
  throw new Error("The Campaign Setup keeps asking");
}
export const heathPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount), choices?: readonly string[], difficulty?: Difficulty) => game.plan(seatCount, log, choices, difficulty);
export const heathStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard, choices?: readonly string[]) => game.start(seatCount, seed, difficulty, { facts, log, modeCard, choices });

// The pinned games: wins (true solo and two-handed, Normal and Easy, from a blank log and after the three earlier parts' real Resolutions with the allies in the pool or the oath, guidance and Isolde lines, each Accolade boon, each Song boon and none,
// 3 and 4 Dragon Signs in the victory display, the treasure of the three drawn) and losses (heroes too small to quest, heroes too brittle to survive, the threat at the last stage), each on a fixed seed. Every win has the stage 4 fight: Cold-Drake defeated.
export const HEATH_GOLDENS: readonly HeathGolden[] = [
  { name: "true solo, won from a blank log, Master of the Hunt, 4 Dragon Signs, a treasure chosen", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", policy: { accolades: [1] } },
  { name: "true solo, won from a blank log, The Steadfast, Rhyme of the Slayer, 4 Dragon Signs, the last treasure chosen", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", policy: { accolades: [3], song: "last", treasure: "last" } },
  { name: "true solo, won from a blank log, Master of the Hunt, 3 Dragon Signs, no treasure", seatCount: 1, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won", policy: { accolades: [1] } },
  { name: "true solo, won, after the earlier parts, Dragon-slayer, 4 Dragon Signs, a treasure chosen", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", after: true, policy: { accolades: [4] } },
  { name: "true solo, won, after the earlier parts, no boon ally searched, Unbroken, no Song, 4 Dragon Signs", seatCount: 1, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won", after: true, ally: "skip", policy: { accolades: [2], song: "skip" } },
  { name: "true solo, Easy, won, the oath and guidance lines, Unbroken, Rhyme of the Slayer, 4 Dragon Signs", seatCount: 1, seed: 1, difficulty: "Easy", decks: "strong", outcome: "won", after: true, variant: "oath", policy: { accolades: [2], song: "last", treasure: "last" } },
  { name: "true solo, Easy, won, Melanwar's and Isolde's lines, The Steadfast, no Song, 4 Dragon Signs", seatCount: 1, seed: 5, difficulty: "Easy", decks: "strong", outcome: "won", after: true, variant: "oathline", policy: { accolades: [3], song: "skip" } },
  { name: "two-handed, won, after the earlier parts, an Accolade boon for each player, 4 Dragon Signs", seatCount: 2, seed: 112, difficulty: "Normal", decks: "strong", outcome: "won", after: true },
  { name: "two-handed, won, after the earlier parts, Unbroken and Dragon-slayer, 4 Dragon Signs, the last treasure chosen", seatCount: 2, seed: 3, difficulty: "Normal", decks: "strong", outcome: "won", after: true, policy: { accolades: [2, 4], song: "last", treasure: "last" } },
  { name: "two-handed, won, after the earlier parts, 3 Dragon Signs, no treasure drawn", seatCount: 2, seed: 89, difficulty: "Normal", decks: "strong", outcome: "won", after: true },
  { name: "two-handed, Easy, won, Melanwar's and Isolde's lines, 4 Dragon Signs", seatCount: 2, seed: 2, difficulty: "Easy", decks: "strong", outcome: "won", after: true, variant: "oath" },
  { name: "two-handed, won from a blank log, Lay of Courage, Rhyme of the Slayer, 4 Dragon Signs", seatCount: 2, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won", policy: { song: "last" } },
  { name: "true solo, weak, lost on threat", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed, weak, lost on threat", seatCount: 2, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "true solo, brittle, lost with every hero dead", seatCount: 1, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed, brittle, lost with every hero dead", seatCount: 2, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
  { name: "true solo, lost at the last stage, after the earlier parts, Cold-Drake alive with 4 Dragon Signs", seatCount: 1, seed: 19, difficulty: "Normal", decks: "strong", outcome: "lost", after: true, policy: { accolades: [4] }, lossReason: "No seats remain" },
  { name: "two-handed, lost at the last stage, after the earlier parts", seatCount: 2, seed: 11, difficulty: "Normal", decks: "strong", outcome: "lost", after: true, policy: { accolades: [2, 4], song: "last", treasure: "last" }, lossReason: "No seats remain" },
];

/** The log a golden's Resolution is written onto: the earlier parts' real Resolutions, or a blank log. */
export const logBeforeGolden = (golden: HeathGolden): CampaignLog => (golden.after ? afterKingsquest(golden.seatCount, golden.variant) : emptyLog(golden.seatCount));

/** The answers the Campaign Setup asks for a golden's log. */
export const heathChoices = (golden: HeathGolden): string[] => heathSetupChoices(golden.seatCount, logBeforeGolden(golden), golden.difficulty, golden.ally);

export const playGolden = (golden: HeathGolden, ctx: ReduceContext): HeathGame => game.play(golden.seatCount, golden.seed, golden.difficulty, ctx, { log: logBeforeGolden(golden), policy: golden.policy, mode: golden.mode, choices: heathChoices(golden) });
