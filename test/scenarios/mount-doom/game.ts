import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadCampaign, loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import type { LoadoutSeat } from "../../../src/campaign/loadout.ts";
import { campaignGame, fillerLoadout, HERO_STATS, RING_BEARER, type HeroStats, type PlayedGame } from "../../harness/game-kit.ts";

const campaign = loadCampaign("the-return-of-the-king");
const doom = loadScenario("mount-doom");

// Test helper. A whole game of Mount Doom in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. TODO: say how the players travel, engage and answer the choices this scenario asks.
export const DOOM_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type DoomDecks = "strong" | "weak" | "brittle";

// The strong stand-ins start at a threat of 20 each and Frodo, the Ring-bearer, takes the numbers of the deck like them (his printed numbers could not quest or defend a game of auto-played turns).
const DOOM_STATS = { strong: { ...HERO_STATS.strong, threat: 8, attack: 30, defense: 20 }, weak: HERO_STATS.weak, brittle: { ...HERO_STATS.brittle, threat: 8 } } as const satisfies Record<DoomDecks, HeroStats>;

// The first player holds the Ring-bearer with The One Ring attached (the saga start of scenario 18, mec113.setting-up-the-game), beside three stand-in heroes; a second seat has three.
export const doomLoadout = (seatCount: 1 | 2): LoadoutSeat[] => {
  const [, second] = fillerLoadout(2);
  const first = { heroes: [RING_BEARER, "q1", "q2", "q3"], deck: fillerLoadout(1)[0]!.deck };
  return seatCount === 1 ? [first] : [first, second!];
};

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier parts were won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const doomWorld = async (decks: DoomDecks = "strong") => {
  const world = await game.world(decks);
  world.cards.set(RING_BEARER, { ...world.cards.get(RING_BEARER)!, ...DOOM_STATS[decks], threat: 0 });
  return world;
};
export const afterOpens = (seatCount: 1 | 2) => game.after(seatCount);
export const doomPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount)) => game.plan(seatCount, log);
export const doomStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard) => game.start(seatCount, seed, difficulty, { facts, log, modeCard });

export type DoomPolicy = {
  // What the first player does with The One Ring in the Resolution (146079:B:1): destroys it (the players win the campaign) or keeps it (they lose the campaign). Every other choice takes its last option, which keeps Frodo and The One Ring in play (the discard of a questing character is a first option of Evil Vigilance).
  ring: "destroy" | "keep";
  // The quest: every ready character but the last (kept ready for a Fortitude test, which exhausts the heroes it commits), or all of them.
  quest: "most" | "all";
  // How many heroes a Fortitude test commits (the first that may): none fails the test unless X is 0.
  fortitude: number;
};
// The resource tokens The Black Gate Opens leaves on its card in a golden whose earlier parts were won (146079:A:1 places as many on the campaign card).
export const TOKENS = 6;
export const DEFAULT_POLICY: DoomPolicy = { ring: "destroy", quest: "most", fortitude: 1 };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes its last option, and the Resolution's as the policy says. Every intent is one the reducer listed.
// TODO: the scenario's own answers (where the players travel, who defends, which locations they explore) go before the auto-player's.
export function doomIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: DoomPolicy = DEFAULT_POLICY, options: PolicyOptions = DOOM_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") return { type: "Choose", optionId: state.window.options.at(-1) ?? "" };
  // The Resolution's choice (146079:B:1): the first player keeps or destroys The One Ring.
  if (state.window?.kind === "resolution") {
    const answers = legalIntents(state, ctx).filter((intent) => intent.type === "ChooseResolution");
    return answers.find((intent) => intent.optionId === policy.ring) ?? answers[0] ?? nextIntent(state, ctx, DOOM_POLICY, memory, legalIntents(state, ctx));
  }
  const intents = legalIntents(state, ctx);
  // A Fortitude test commits one hero, so the rest quest: the test exhausts the heroes it commits, and a quest of exhausted heroes has no Willpower.
  if (state.window?.kind === "fortitudeCommit") return { type: "CommitFortitude", cardIds: legalTargets(state, { type: "CommitFortitude" }, ctx).slice(0, policy.fortitude) };
  if (state.window?.kind === "travel") {
    const wanted = legalTargets(state, { type: "Travel" }, ctx)[0];
    return wanted ? { type: "Travel", locationId: wanted } : { type: "DeclineTravel" };
  }
  // A character of another seat defends only with Sentinel: the saved decklists' characters of the other seat are left out of the candidates.
  if (state.window?.kind === "defense" && state.pendingAttack && !state.pendingAttack.undefended) {
    const seat = state.pendingAttack.seat;
    const defender = legalTargets(state, { type: "DeclareDefender" }, ctx).find((id) => state.cards[id]?.controller === seat);
    return defender ? { type: "DeclareDefender", defenderId: defender } : { type: "Undefended", heroId: legalTargets(state, { type: "Undefended" }, ctx)[0] ?? "" };
  }
  if (state.window?.kind === "pass" && state.mode === "questCommit") {
    const quested = Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat);
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    if (!quested && ids.length > 0) return { type: "Commit", cardIds: policy.quest === "all" ? ids : ids.slice(0, Math.max(1, ids.length - 1)) };
  }
  return nextIntent(state, ctx, options, memory, intents);
}

export type DoomGame = PlayedGame;

// The goldens (src/campaign/scenarios/mount-doom/golden.test.ts).
// `after`: the log of a campaign whose earlier parts were won. `upgraded`: the Upgraded sides. `mode`: the Hard or Expert Mode card.
export type DoomGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: DoomDecks; outcome: "won" | "lost"; policy?: Partial<DoomPolicy>; after?: boolean; upgraded?: boolean; mode?: ModeCard; lossReason?: string; tokens?: number };

// The goldens are a few wins and a loss for each way the scenario is lost: the players destroy The One Ring (they win the campaign) or keep it (they lose the campaign), solo and two-handed, with and without the earlier parts' tokens on the campaign
// card; the last stage's Fortitude test failed (the Ring-bearer claims The One Ring), the threat at 99 under Dire, the Ring-bearer destroyed (The One Ring leaves play) and the campaign card's timer at 0. 4B's test is the game's last, so the wins pass it.
export const DOOM_GOLDENS: readonly DoomGolden[] = [
  { name: "true solo, Normal, after the earlier parts, The One Ring destroyed", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", after: true, policy: { ring: "destroy" } },
  { name: "true solo, Easy, after the earlier parts, The One Ring kept", seatCount: 1, seed: 3, difficulty: "Easy", decks: "strong", outcome: "won", after: true, policy: { ring: "keep" } },
  { name: "true solo, Normal, with no earlier log, The One Ring destroyed", seatCount: 1, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won", policy: { ring: "destroy" } },
  { name: "two-handed, Normal, after the earlier parts, The One Ring destroyed", seatCount: 2, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won", after: true, policy: { ring: "destroy" } },
  { name: "two-handed, Easy, after the earlier parts, The One Ring kept", seatCount: 2, seed: 4, difficulty: "Easy", decks: "strong", outcome: "won", after: true, policy: { ring: "keep" } },
  { name: "true solo, lost, the last Fortitude test fails", seatCount: 1, seed: 3, difficulty: "Normal", decks: "strong", outcome: "lost", after: true, lossReason: "The Ring-bearer claimed The One Ring" },
  { name: "two-handed, lost, the last Fortitude test fails", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "lost", after: true, lossReason: "The Ring-bearer claimed The One Ring" },
  { name: "true solo, lost, the threat reaches 99", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", after: true, lossReason: "No seats remain" },
  { name: "two-handed, lost, the threat reaches 99", seatCount: 2, seed: 3, difficulty: "Normal", decks: "weak", outcome: "lost", after: true, lossReason: "No seats remain" },
  { name: "true solo, lost, the Ring-bearer is destroyed", seatCount: 1, seed: 2, difficulty: "Normal", decks: "brittle", outcome: "lost", after: true, lossReason: "The One Ring left play" },
  { name: "two-handed, lost, the Ring-bearer is destroyed", seatCount: 2, seed: 4, difficulty: "Normal", decks: "brittle", outcome: "lost", after: true, lossReason: "The One Ring left play" },
  { name: "true solo, lost, the campaign card's last token is removed", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "lost", after: true, tokens: 2, lossReason: "No resource token is left on Mount Doom" },
  { name: "two-handed, lost, the campaign card's last token is removed", seatCount: 2, seed: 2, difficulty: "Normal", decks: "strong", outcome: "lost", after: true, tokens: 2, lossReason: "No resource token is left on Mount Doom" },
];

const game = campaignGame<DoomDecks, DoomPolicy>({
  campaign,
  scenario: doom,
  stats: DOOM_STATS,
  loadout: doomLoadout,
  // TODO: the cards a game loads besides the scenario's piles, its campaign card's and the campaign's game codes.
  codes: [...doom.cards.map((card) => card.code), RING_BEARER, "146065", "145014", "145015", "145016", "145062", "143020", "143021"],
  intent: doomIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
  upgraded: [],
  // TODO: the XP each earlier part gained (in campaign order), the cards they put in the pool and the marks on the cards, as a campaign that won them leaves the log.
  earlier: { xp: [0, 0, 0, 0, 0], pool: [], marks: {} },
});

// The campaign log's count of resource tokens on The Black Gate reaches the game through the notes of its facts (src/campaign/log-return-of-the-king.ts); a game with no earlier parts has none recorded.
export const doomFacts = (tokens: number | null): Omit<CampaignFacts, "modeCard"> => ({ prisoner: null, usedOnce: [], counters: {}, notes: { blackGate: {}, corsairFleet: null, blackGateTokens: tokens } });
export const playGolden = (golden: DoomGolden, ctx: ReduceContext): DoomGame =>
  game.play(golden.seatCount, golden.seed, golden.difficulty, ctx, { facts: doomFacts(golden.after ? (golden.tokens ?? TOKENS) : null), ...(golden.after ? { log: game.after(golden.seatCount) } : {}), ...(golden.policy ? { policy: golden.policy } : {}), ...(golden.mode ? { mode: golden.mode } : {}) });
