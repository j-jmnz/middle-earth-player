import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { characters, legalAttackEnemies } from "../../../src/rules/combat/combat.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { campaign, CODES, raid } from "./scene.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { campaignGame, engageOneEach, fillerLoadout, HERO_STATS, STRONG_HEROES as HEROES, type PlayedGame } from "../../harness/game-kit.ts";

// Test helper. A whole game of Raid on the Grey Havens in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an
// attack) and the decks free events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. The players travel to a location whenever they can, attack whatever the
// engine lets them attack, answer the Campaign Setup's offer of a Galdor's Counsel as the policy says, and (the tied Aflame locations and the damage to heal) take the first option.
export const RAID_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type RaidDecks = "strong" | "weak" | "brittle";

export const raidLoadout = fillerLoadout;

/** What each seat answers when the Campaign Setup offers a Galdor's Counsel: the code it takes, or "skip". */
export type CounselChoice = readonly string[];
const NO_COUNSEL: CounselChoice = ["skip", "skip"];

// The goldens' world, the plan and start of a game, and the log of a campaign whose first two parts were won (Ominous Fate in the pool and the XP they gained, marked on
// Galdor's Counsel and the Dream-chaser's Spyglass): the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const raidWorld = (decks: RaidDecks = "strong") => game.world(decks);
export const afterFate = (seatCount: 1 | 2) => game.after(seatCount);
export const raidPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount), counsel: CounselChoice = NO_COUNSEL) => game.plan(seatCount, log, counsel.slice(0, seatCount));
export const raidStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard, counsel: CounselChoice = NO_COUNSEL) => game.start(seatCount, seed, difficulty, facts, log, modeCard, counsel.slice(0, seatCount));

export type RaidPolicy = {
  // The option a Choose window with these answers takes: "damage" or "search" (Corsair Arsonist), "damage" or "discard" (Pillaged Ship), "character" or "location" (Put to the Torch).
  burn: "first" | "last";
};
export const DEFAULT_POLICY: RaidPolicy = { burn: "first" };

// The auto-player's answer (test/harness/auto-player.ts), except: the heroes of a seat that has three quest together, the last one staying out when the table has the strength; the players travel to the first
// location they can; defense falls to the strongest hero; a choice takes the first option, or the last as the policy says. Every intent is one the reducer listed.
export function raidIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: RaidPolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose" && policy.burn === "last") return { type: "Choose", optionId: state.window.options.at(-1) ?? "" };
  if (state.mode === "questCommit" && state.window?.kind === "pass" && !Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) {
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    const heroes = ids.filter((id) => HEROES.includes(state.cards[id]?.code ?? ""));
    if (heroes.length > 0) {
      const home = heroes.length >= 3 ? heroes.slice(-1) : [];
      const questers = ids.filter((id) => !home.includes(id));
      if (questers.length > 0) return { type: "Commit", cardIds: questers };
    }
  }
  if (state.window?.kind === "playerAttack" && legalIntents(state, ctx).some((intent) => intent.type === "DeclareAttackers")) {
    const seat = state.activeSeat;
    const ready = characters(state, seat, ctx.cards).filter((id) => legalTargets(state, { type: "DeclareAttackers", cardId: id }, ctx).length > 0);
    const reachable = (id: string) => legalAttackEnemies(state, seat, id, ctx.cards);
    const enemy = ready.flatMap(reachable)[0];
    // Graxar can be attacked by one character each round: the first alone.
    const attackers = ready.filter((id) => enemy != null && reachable(id).includes(enemy));
    if (enemy && attackers.length > 0) return { type: "DeclareAttackers", enemyId: enemy, attackerIds: ctx.cards.get(state.cards[enemy]?.code ?? "")?.name === "Graxar" ? attackers.slice(0, 1) : attackers };
  }
  // Nobody defends: the home hero stays ready to attack, and the heroes have the hit points to take what comes undefended.
  if (state.window?.kind === "defense") {
    const target = legalTargets(state, { type: "Undefended" }, ctx)[0];
    if (target) return { type: "Undefended", heroId: target };
  }
  const engaging = engageOneEach(state, ctx, 2);
  if (engaging) return engaging;
  return nextIntent(state, ctx, RAID_POLICY, memory, legalIntents(state, ctx));
}

export type RaidGame = PlayedGame;

// The goldens (src/campaign/scenarios/raid-on-the-grey-havens/golden.test.ts), also played by the causes and replay tests. A win runs the campaign card's Resolution and awards its XP; a loss writes nothing.
// `after`: the log of a campaign whose first two parts were won (the pool, XP and marks reach this part). `upgraded`: the Upgraded sides (Calphon, Spyglass, Black Key). `counsel`: what each seat takes at the Campaign Setup.
export type RaidGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: RaidDecks; outcome: "won" | "lost"; policy?: Partial<RaidPolicy>; after?: boolean; upgraded?: boolean; mode?: ModeCard; counsel?: CounselChoice; lossReason?: string };

export const UPGRADED_CODES = [CODES.calphon, CODES.spyglass, CODES.blackKey];
const THREAT_LOST = "No seats remain";
const FLEET_LOST = "The Corsairs have destroyed the Elven fleet";
const DREAM_CHASER_LOST = "The Dream-chaser was placed underneath The Havens Burn";

export const RAID_GOLDENS: readonly RaidGolden[] = [
  { name: "true solo, won", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, Easy, a Galdor's Counsel (Spirit) taken, won", seatCount: 1, seed: 2, difficulty: "Easy", decks: "strong", outcome: "won", counsel: [CODES.counselSpirit] },
  { name: "true solo, after The Fate of Númenor, a Galdor's Counsel (Leadership) taken, won", seatCount: 1, seed: 3, difficulty: "Normal", decks: "strong", outcome: "won", after: true, counsel: [CODES.counselLeadership] },
  { name: "true solo, the last option of each choice, won", seatCount: 1, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won", policy: { burn: "last" } },
  { name: "true solo, Hard Mode card, won", seatCount: 1, seed: 5, difficulty: "Normal", decks: "strong", outcome: "won", mode: "hard" },
  { name: "true solo, Upgraded Calphon, Spyglass and Black Key, won", seatCount: 1, seed: 6, difficulty: "Normal", decks: "strong", outcome: "won", upgraded: true },
  { name: "two-handed, won", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed, a Galdor's Counsel each (Leadership and Tactics), won", seatCount: 2, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won", counsel: [CODES.counselLeadership, CODES.counselTactics] },
  { name: "two-handed, Easy, after The Fate of Númenor, won", seatCount: 2, seed: 3, difficulty: "Easy", decks: "strong", outcome: "won", after: true, counsel: [CODES.counselLore, "skip"] },
  { name: "two-handed, Expert Mode card, Upgraded Calphon, Spyglass and Black Key, won", seatCount: 2, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won", mode: "expert", upgraded: true, policy: { burn: "last" } },
  { name: "true solo, weak, lost when the Dream-chaser burns", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: DREAM_CHASER_LOST },
  { name: "true solo, weak, lost with four cards underneath The Havens Burn", seatCount: 1, seed: 2, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: FLEET_LOST },
  { name: "two-handed, weak, lost on threat", seatCount: 2, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: THREAT_LOST },
  { name: "true solo, brittle heroes, lost", seatCount: 1, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: THREAT_LOST },
  { name: "two-handed, brittle heroes, lost", seatCount: 2, seed: 5, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: THREAT_LOST },
];

const game = campaignGame<RaidDecks, RaidPolicy>({
  campaign,
  scenario: raid,
  // The strong heroes attack for 40; the other numbers are the shared ones.
  stats: { ...HERO_STATS, strong: { ...HERO_STATS.strong, attack: 40 } },
  codes: [CODES.ominousFate, CODES.sahirAlly, CODES.naasiyahAlly, "11080", "11081", "11082", "11083"],
  intent: raidIntent,
  policy: DEFAULT_POLICY,
  limit: 8000,
  upgraded: UPGRADED_CODES,
  levels: { [CODES.counselLeadership]: 3, [CODES.counselTactics]: 1 },
  earlier: { xp: [4, 3], pool: [{ code: CODES.ominousFate }], marks: { "11080": 1, [CODES.counselLeadership]: 3, [CODES.counselTactics]: 1 } },
});

export const playGolden = (golden: RaidGolden, ctx: ReduceContext): RaidGame => game.playGolden(golden, ctx, (golden.counsel ?? NO_COUNSEL).slice(0, golden.seatCount));
export { DREAM_CHASER_LOST, FLEET_LOST, THREAT_LOST };
