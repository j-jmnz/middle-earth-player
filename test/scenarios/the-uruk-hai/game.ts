import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { campaign, CODES, hai } from "./scene.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { attackTogether, campaignGame, fillerLoadout, HERO_STATS, STRONG_HEROES as HEROES, type PlayedGame } from "../../harness/game-kit.ts";

// Test helper. A whole game of The Uruk-hai in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. Each seat picks its Captive (or the log names it), the players quest with all but one of their stand-in heroes, attack Uglúk first once
// stage 2 lets them, leave every attack undefended and answer the other choices with the first option.
export const HAI_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type HaiDecks = "strong" | "weak" | "brittle";

export const haiLoadout = fillerLoadout;

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier parts were won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const haiWorld = (decks: HaiDecks = "strong") => game.world(decks);
export const haiPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount)) => game.plan(seatCount, log);
export const haiStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard) => game.start(seatCount, seed, difficulty, { facts, log, modeCard });

export type HaiPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
  // The players attack Uglúk first, together (true), or never attack (false), so Uglúk stays in play, stage 2 cannot be defeated and the pursuit value climbs to 30.
  hunt: boolean;
};
export const DEFAULT_POLICY: HaiPolicy = { choose: "first", hunt: true };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says; Uglúk cannot be engaged while stage 1 is the quest (143069:B:2); the last stand-in hero of a seat stays home from the quest and every ready character attacks him first, together; nobody defends. Every intent is one the reducer listed.
export function haiIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: HaiPolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  // The last stand-in hero of a seat stays home to attack; the others quest.
  if (state.mode === "questCommit" && state.window?.kind === "pass" && !Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) {
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    const heroes = ids.filter((id) => HEROES.includes(state.cards[id]?.code ?? ""));
    const questers = ids.filter((id) => !(heroes.length >= 2 && id === heroes.at(-1)));
    if (questers.length > 0) return { type: "Commit", cardIds: questers };
  }
  if (state.window?.kind === "playerAttack" && !policy.hunt) return { type: "DeclineAttack" };
  const together = attackTogether(state, ctx, undefined, (enemyId) => (state.cards[enemyId]?.code === CODES.ugluk ? 0 : 1));
  if (together) return together;
  if (state.window?.kind === "defense") {
    const target = legalTargets(state, { type: "Undefended" }, ctx)[0];
    if (target) return { type: "Undefended", heroId: target };
  }
  if (state.window?.kind === "optionalEngage") {
    const ugluk = legalTargets(state, { type: "Engage" }, ctx).find((id) => state.cards[id]?.code === CODES.ugluk);
    if (ugluk) return { type: "Engage", enemyId: ugluk };
  }
  return nextIntent(state, ctx, HAI_POLICY, memory, legalIntents(state, ctx));
}

export type HaiGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-uruk-hai/golden.test.ts), also played by the causes and replay tests once test/harness/golden-registry.ts lists them.
// `mode`: the Hard or Expert Mode card. `logged`: the Campaign Log names the second hero of each seat as its captive.
export type HaiGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: HaiDecks; outcome: "won" | "lost"; policy?: Partial<HaiPolicy>; mode?: ModeCard; lossReason?: string; logged?: true };

// The cards the earlier parts of the saga leave in the pool that the campaign card's Setup acts on (143071:A:2), for the campaign test.
export const POOL = { gildor: "141077", underhill: "141017", shadowBurden: "141078", fordBurden: "141080", darkBurden: "142085" } as const;

const THREAT_LOST = "No seats remain";
const ISENGARD_LOST = "The Uruk-hai reached Isengard";

// A win (143070:B:3: Uglúk out of play and stage 2 defeated) in true solo and two-handed, Normal and Easy, with the Captives chosen by the players and named by the Campaign Log (R1), with Grishnákh holding a Captive at the end (R4), and with
// the pursuit value above 25 when it ends (no Resolution choice, 143071:B:1); a loss to the pursuit value (nobody attacks Uglúk, 143022:A:2), to the threat (weak heroes that cannot quest) and to the Uruk-hai's attacks (brittle heroes).
export const HAI_GOLDENS: readonly HaiGolden[] = [
  { name: "true solo, won", seatCount: 1, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, Easy, the pursuit value above 25 at the win, won", seatCount: 1, seed: 6, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "true solo, Grishnákh holds a Captive, won", seatCount: 1, seed: 7, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, the Campaign Log names the Captive, won", seatCount: 1, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won", logged: true },
  { name: "true solo, the last option of each choice, won", seatCount: 1, seed: 6, difficulty: "Normal", decks: "strong", outcome: "won", policy: { choose: "last" } },
  { name: "two-handed, won", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed, Grishnákh holds a Captive, won", seatCount: 2, seed: 3, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed, Easy, the Campaign Log names each seat's Captive, won", seatCount: 2, seed: 2, difficulty: "Easy", decks: "strong", outcome: "won", logged: true },
  { name: "true solo, nobody attacks Uglúk, the Uruk-hai reach Isengard, lost", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "lost", policy: { hunt: false }, lossReason: ISENGARD_LOST },
  { name: "two-handed, nobody attacks Uglúk, Grishnákh deals damage to a Captive, lost to Isengard", seatCount: 2, seed: 3, difficulty: "Normal", decks: "strong", outcome: "lost", policy: { hunt: false }, lossReason: ISENGARD_LOST },
  { name: "true solo, weak, lost on threat", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: THREAT_LOST },
  { name: "two-handed, weak, lost on threat", seatCount: 2, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: THREAT_LOST },
  { name: "true solo, brittle heroes, lost", seatCount: 1, seed: 3, difficulty: "Normal", decks: "brittle", outcome: "lost", policy: { hunt: false }, lossReason: THREAT_LOST },
  { name: "two-handed, brittle heroes, Grishnákh holds a Captive, lost", seatCount: 2, seed: 3, difficulty: "Normal", decks: "brittle", outcome: "lost", policy: { hunt: false }, lossReason: THREAT_LOST },
];

const game = campaignGame<HaiDecks, HaiPolicy>({
  campaign,
  scenario: hai,
  stats: HERO_STATS,
  codes: [...hai.cards.map((card) => card.code), ...Object.values(POOL)],
  intent: haiIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
  upgraded: [],
});

// The Campaign Log's hero lists as a Two Towers game reads them (twoTowersFacts, src/campaign/log-two-towers.ts): the stand-in heroes of each seat, no Fellowship hero, and, in a `logged` golden, the second hero of each seat named as its
// captive (143069:A:1 "choose each captive from the Campaign Log"). Without the log's captives each seat chooses its own.
export const heroLogFacts = (seatCount: 1 | 2, logged: boolean): Omit<CampaignFacts, "modeCard"> => ({
  prisoner: null,
  usedOnce: [],
  counters: {},
  heroLog: {
    heroes: seatCount === 1 ? [["q1", "q2", "q3"]] : [["q1", "q2", "q3"], ["q4", "q5", "q6"]],
    fallen: Array.from({ length: seatCount }, () => []),
    fellowship: [],
    captives: logged ? (seatCount === 1 ? [{ seat: 0, hero: "q2" }] : [{ seat: 0, hero: "q2" }, { seat: 1, hero: "q5" }]) : [],
  },
});

export const playGolden = (golden: HaiGolden, ctx: ReduceContext): HaiGame => game.play(golden.seatCount, golden.seed, golden.difficulty, ctx, { facts: heroLogFacts(golden.seatCount, golden.logged === true), policy: golden.policy, mode: golden.mode });
export { ISENGARD_LOST, THREAT_LOST };
