import { applyResolution, emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import { NO_COPY_LIMITS } from "../../../src/campaign/wilderland.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { UPANDUIN_GOLDENS, upanduinWorld } from "../journey-up-the-anduin/game.ts";
import { LOSTMIRK_GOLDENS, lostmirkWorld } from "../lost-in-mirkwood/game.ts";
import { CODES, TREASURES, campaign, kingsquest } from "./scene.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { campaignGame, fillerLoadout, HERO_STATS, type PlayedGame } from "../../harness/game-kit.ts";
import { goldenState } from "../../harness/golden-state.ts";

// Test helper. A whole game of The King's Quest in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. The players travel to the Abandoned Ruin when it is offered (its treasure), engage Fire-drake once the stage allows it and
// attack it with every character together; every other enemy is left alone (an engaged enemy costs threat and attacks), and every choice takes the first option or the last, as the policy says.
export const KINGSQUEST_POLICY: PolicyOptions = { scout: "q3", prefer: CODES.abandonedRuin, protect: "q3", play: false, act: true };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type KingsquestDecks = "strong" | "weak" | "brittle";

export const kingsquestLoadout = fillerLoadout;

export type KingsquestPolicy = {
  // The option a Choose window with these answers takes: "smart" prefers replacing a location from the Caves deck, removing the progress, the immunity, adding the location and the card that is the Dragon Hoard (the order below), "first" or "last" takes the first or the last.
  choose: "smart" | "first" | "last";
  // The Resolution's first question: Isolde joins the pool for the first seat's player (pool) or the line "Isolde is on the hunt" is written (line).
  isolde: "pool" | "line";
  // The Resolution's second question, the first player's choice for Abandoned Ruin: The Threat to Wilderland (threat) or Dagnir's Spawn (spawn).
  burden: "threat" | "spawn";
};
export const DEFAULT_POLICY: KingsquestPolicy = { choose: "smart", isolde: "pool", burden: "threat" };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says; the Resolution's questions are answered as the policy says; Fire-drake is engaged and
// attacked by every character together. Every intent is one the reducer listed. `options`: the auto-player's own policy for the answers this one does not give; the fixtures
// (scripts/e2e/the-kings-quest.ts) play real decklists, so they turn card play on.
export function kingsquestIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: KingsquestPolicy = DEFAULT_POLICY, options: PolicyOptions = KINGSQUEST_POLICY): PlayerIntent {
  if (state.window?.kind === "resolution") {
    const offered = legalIntents(state, ctx).flatMap((intent) => (intent.type === "ChooseResolution" ? [intent.optionId] : []));
    // The burden question offers the two cards by code; Isolde's offers her for each seat, or the line.
    const burdens = offered.filter((option) => option === CODES.theThreatToWilderland || option === CODES.dagnirSSpawn);
    const wanted = burdens.length > 0 ? burdens.find((option) => option === (policy.burden === "spawn" ? CODES.dagnirSSpawn : CODES.theThreatToWilderland)) : policy.isolde === "line" ? offered.find((option) => option === "line") : offered.find((option) => option !== "line");
    return { type: "ChooseResolution", optionId: wanted ?? offered[0] ?? "" };
  }
  if (state.window?.kind === "choose") return { type: "Choose", optionId: chosen(state, state.window.options, policy) };
  const isDrake = (id: string) => state.cards[id]?.code === CODES.fireDrake;
  if (state.window?.kind === "optionalEngage") {
    const drake = legalTargets(state, { type: "Engage" }, ctx).find(isDrake);
    return drake ? { type: "Engage", enemyId: drake } : { type: "DeclineEngage" };
  }
  // Every character that can attacks Fire-drake together: the stage asks for one choice for the attack as a whole.
  if (state.window?.kind === "playerAttack" && legalIntents(state, ctx).some((intent) => intent.type === "DeclareAttackers")) {
    const mine = Object.values(state.cards).filter((card) => card.controller === state.activeSeat && (card.zone === "heroes" || card.zone === "play")).map((card) => card.id);
    const attackers = mine.filter((id) => legalTargets(state, { type: "DeclareAttackers", cardId: id }, ctx).some(isDrake));
    const drake = attackers[0] ? legalTargets(state, { type: "DeclareAttackers", cardId: attackers[0] }, ctx).find(isDrake) : undefined;
    if (drake) return { type: "DeclareAttackers", enemyId: drake, attackerIds: attackers };
  }
  return nextIntent(state, ctx, options, memory, legalIntents(state, ctx));
}

// The answers of "smart", best first: the Caves deck's replacement (18045:A:2), the progress removed (18080:B:2), the immunity (12172:A:2), the location added to the staging area (18078:B:1), the card or resource taken, the damage spared.
const PREFERRED = ["replace", "remove", "immune", "add", "do", "threat", "draw", "resource", "discard", "decline", "cancel", "distribute"];

function chosen(state: ScenarioState, options: readonly string[], policy: KingsquestPolicy): string {
  if (policy.choose === "last") return options.at(-1) ?? "";
  if (policy.choose === "first") return options[0] ?? "";
  // A look at the Caves deck (18079:B:2): Dragon Hoard stays on top, else the card that is not Underground Lake (the other goes to the bottom).
  const hoard = options.find((id) => state.cards[id]?.code === CODES.dragonHoard);
  if (hoard) return hoard;
  const looked = options.filter((id) => state.cards[id] != null);
  if (looked.length > 0) return looked.find((id) => state.cards[id]?.code !== CODES.undergroundLake) ?? looked[0] ?? "";
  const ranked = [...options].sort((left, right) => (PREFERRED.indexOf(left) + 1 || 99) - (PREFERRED.indexOf(right) + 1 || 99));
  return ranked[0] ?? "";
}

export type KingsquestGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-kings-quest/golden.test.ts).
// `after`: the log of a campaign whose earlier parts were won (Journey Up the Anduin and Lost in Mirkwood, their real Resolutions chained: `afterEarlier`); `oath`: the log with Turayn's oath line instead of Turayn in the pool.
// `upgraded`: the Upgraded sides. `mode`: the Hard or Expert Mode card.
export type KingsquestGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: KingsquestDecks; outcome: "won" | "lost"; policy?: Partial<KingsquestPolicy>; after?: boolean; oath?: boolean; upgraded?: boolean; mode?: ModeCard; lossReason?: string };

// The pinned games, each on a fixed seed: see KINGSQUEST_GOLDENS below.
const STATS = { ...HERO_STATS, strong: { ...HERO_STATS.strong, willpower: 100 }, brittle: { ...HERO_STATS.brittle, willpower: 100 } } as const;

const TREASURE_CODES: readonly string[] = TREASURES;
const earlierCodes = ["12166", "12167", "12169", "18070", ...loadScenario("journey-up-the-anduin").cards.map((card) => card.code), ...loadScenario("lost-in-mirkwood").cards.map((card) => card.code), ...TREASURE_CODES];

const game = campaignGame<KingsquestDecks, KingsquestPolicy>({
  campaign,
  scenario: kingsquest,
  stats: STATS,
  // The scenario's cards, the cards its campaign card places (Isolde and the three burdens), Haldan, the treasures, and what the first two parts leave in the pool (Turayn, Melanwar, A Growing Threat, any card of their encounter sets).
  codes: [...kingsquest.cards.map((card) => card.code), CODES.isolde, CODES.theThreatToWilderland, CODES.dagnirSSpawn, CODES.abandonedRuin, ...earlierCodes],
  intent: kingsquestIntent,
  policy: DEFAULT_POLICY,
  limit: 8000,
  upgraded: [],
  // Not used: the log of the earlier parts is chained from their real Resolutions (`afterEarlier`).
  earlier: { xp: [0, 0], pool: [], marks: {} },
});

// The two earlier parts' goldens that the King's Quest goldens follow, by the seats and by whether Turayn is in the pool or the oath line is written (and Melanwar or the guidance line to match).
const EARLIER: Readonly<Record<string, { upanduin: string; lostmirk: string }>> = {
  "1:pool": { upanduin: "true solo, won, Turayn joins the pool", lostmirk: "true solo, won, Melanwar joins the pool, a treasure discovered, a hero carried away" },
  "2:pool": { upanduin: "two-handed, won, a treasure discovered, Turayn joins the pool", lostmirk: "two-handed, won, Melanwar joins the pool, a treasure discovered" },
  "1:oath": { upanduin: "true solo, Easy, won, the oath line", lostmirk: "true solo, Easy, won, the guidance line" },
  "2:oath": { upanduin: "two-handed, Easy, won, a treasure discovered, the oath line", lostmirk: "two-handed, Easy, won, the guidance line" },
};
const earlierLogs = new Map<string, CampaignLog>();
const rawLogs = new Map<string, CampaignLog>();

/** Reads the final states of the two earlier parts' goldens from golden.json (test/harness/golden-state.ts) and writes their Resolutions onto a blank log, once for each (seats, variant): what The King's Quest is handed. */
export async function prepareEarlier(): Promise<void> {
  const upanduin = await upanduinWorld("strong");
  const lostmirk = await lostmirkWorld("strong");
  for (const [key, names] of Object.entries(EARLIER)) {
    const first = UPANDUIN_GOLDENS.find((item) => item.name === names.upanduin)!;
    const second = LOSTMIRK_GOLDENS.find((item) => item.name === names.lostmirk)!;
    const one = goldenState("journey-up-the-anduin", first.name);
    const log = applyResolution(emptyLog(first.seatCount), one.scenarioId, one, upanduin.cards, NO_COPY_LIMITS);
    // Lost in Mirkwood's golden is played from its own after-Upanduin log (`after`) unless it starts blank; the Resolution is written onto the real log of the first part.
    const two = goldenState("lost-in-mirkwood", second.name);
    const written = applyResolution(log, two.scenarioId, two, lostmirk.cards, NO_COPY_LIMITS);
    rawLogs.set(key, written);
    // The stand-in heroes of the golden seats are not the heroes the earlier games lost or carried: they start fresh, and what hangs on a hero stays behind.
    const blank = emptyLog(first.seatCount);
    earlierLogs.set(key, { ...written, heroesBySeat: blank.heroesBySeat, fallenHeroesBySeat: blank.fallenHeroesBySeat, campaignPool: written.campaignPool.filter((card) => card.attachedTo == null) });
  }
}

/** The log of a campaign that won Journey Up the Anduin and Lost in Mirkwood, their real Resolutions chained: `oath` for Turayn's oath line (and the guidance line) in place of the allies in the pool. */
export function afterEarlier(seatCount: 1 | 2, oath = false): CampaignLog {
  const log = earlierLogs.get(`${seatCount}:${oath ? "oath" : "pool"}`);
  if (!log) throw new Error("Call kingsquestWorld first: it builds the earlier parts' log");
  return log;
}

/** The log the two earlier parts' real Resolutions write, with the heroes of their games still on it (what the campaign test reads). */
export function rawEarlier(seatCount: 1 | 2, oath = false): CampaignLog {
  const log = rawLogs.get(`${seatCount}:${oath ? "oath" : "pool"}`);
  if (!log) throw new Error("Call kingsquestWorld first: it builds the earlier parts' log");
  return log;
}

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier parts were won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const kingsquestWorld = async (decks: KingsquestDecks = "strong") => {
  if (earlierLogs.size === 0) await prepareEarlier();
  return game.world(decks);
};
export const kingsquestPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount), choices?: readonly string[]) => game.plan(seatCount, log, choices);
export const kingsquestStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard, choices?: readonly string[]) => game.start(seatCount, seed, difficulty, { facts, log, modeCard, choices });

// The treacheries Turayn's oath removes: the first three titles of the scenario's encounter deck (the briefing asks one card at a time).
export function oathChoices(ctx: ReduceContext): string[] {
  const seen: string[] = [];
  for (const card of kingsquest.cards) {
    const printed = ctx.cards.get(card.code);
    if (printed?.type === "treachery" && !seen.includes(card.code) && seen.length < 3) seen.push(card.code);
  }
  return seen;
}

// The pinned games: wins (true solo and two-handed, Normal and Easy, from a blank log and after the two earlier parts' real Resolutions, Isolde joining the pool and her line, The Threat to Wilderland and Dagnir's Spawn chosen for Abandoned Ruin,
// a treasure discovered, Turayn's oath removing 3 treacheries) and losses (heroes too small to quest, heroes too brittle to survive), each on a fixed seed. Every win has the stage 3 fight: Fire-drake engaged and defeated.
export const KINGSQUEST_GOLDENS: readonly KingsquestGolden[] = [
  { name: "true solo, won, after the earlier parts, Isolde joins the pool, The Threat to Wilderland, a treasure discovered", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", after: true },
  { name: "true solo, won, after the earlier parts, Dagnir's Spawn, a treasure discovered", seatCount: 1, seed: 7, difficulty: "Normal", decks: "strong", outcome: "won", after: true, policy: { burden: "spawn" } },
  { name: "true solo, won from a blank log, a treasure discovered", seatCount: 1, seed: 11, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, Easy, won, Turayn's oath, Isolde's line, Dagnir's Spawn, no treasure", seatCount: 1, seed: 8, difficulty: "Easy", decks: "strong", outcome: "won", oath: true, policy: { isolde: "line", burden: "spawn" } },
  { name: "true solo, Easy, won, Turayn's oath, Isolde joins the pool, a treasure discovered", seatCount: 1, seed: 10, difficulty: "Easy", decks: "strong", outcome: "won", oath: true },
  { name: "two-handed, won, after the earlier parts, a treasure discovered", seatCount: 2, seed: 16, difficulty: "Normal", decks: "strong", outcome: "won", after: true },
  { name: "two-handed, won, after the earlier parts, Dagnir's Spawn, no treasure", seatCount: 2, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won", after: true, policy: { burden: "spawn" } },
  { name: "two-handed, Easy, won, Turayn's oath, Isolde's line, Dagnir's Spawn, a treasure discovered", seatCount: 2, seed: 10, difficulty: "Easy", decks: "strong", outcome: "won", oath: true, policy: { isolde: "line", burden: "spawn" } },
  { name: "true solo, weak, lost on threat", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed, weak, lost on threat", seatCount: 2, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "true solo, brittle, lost with every hero dead", seatCount: 1, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed, brittle, lost with every hero dead", seatCount: 2, seed: 3, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
];

export const playGolden = (golden: KingsquestGolden, ctx: ReduceContext): KingsquestGame => {
  if (!golden.after && !golden.oath) return game.playGolden(golden, ctx);
  const log = afterEarlier(golden.seatCount, golden.oath === true);
  return game.play(golden.seatCount, golden.seed, golden.difficulty, ctx, { log, policy: golden.policy, mode: golden.mode, ...(golden.oath ? { choices: oathChoices(ctx) } : {}) });
};

/** The log a golden's Resolution is written onto: the earlier parts' real Resolutions, or a blank log. */
export const logBeforeGolden = (golden: KingsquestGolden): CampaignLog => (golden.after || golden.oath ? afterEarlier(golden.seatCount, golden.oath === true) : emptyLog(golden.seatCount));
