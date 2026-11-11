import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadCampaign, loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { attackTogether, campaignGame, fillerLoadout, HERO_STATS, type PlayedGame } from "../../harness/game-kit.ts";

const ORTHANC = "143053";
const SARUMAN = "143047";
const campaign = loadCampaign("the-two-towers");
const isengard = loadScenario("the-road-to-isengard");

// Test helper. A whole game of The Road to Isengard in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. The players do nothing on stage 1B (no commitment, no staging), advance to stage 2A at the first end of the round (the first
// option of its Choose) and then quest with one character of a seat, engage the enemies of the staging area, attack with every ready character together (Saruman's gate wants 6 damage on him), travel to the first location they may, and
// answer every choice with the first option, or the last as the policy says. A Wolf's or an Isengard Orc's first option discards a card, so a game that takes it empties the hands on stage 3B (143080:B:3).
export const ISENGARD_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type IsengardDecks = "strong" | "weak" | "brittle";

export const isengardLoadout = fillerLoadout;

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier parts were won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const isengardWorld = (decks: IsengardDecks = "strong") => game.world(decks);
export const afterDeep = (seatCount: 1 | 2) => game.after(seatCount);
export const isengardPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount)) => game.plan(seatCount, log);
export const isengardStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard) => game.start(seatCount, seed, difficulty, { facts, log, modeCard });

export type IsengardPolicy = {
  // The option a Choose window or a Resolution question takes: the first or the last. The first option of Rouse the Ents' end of round is to advance.
  choose: "first" | "last";
  // Whether the players engage the enemies of the staging area, one at a time, and attack them.
  engage: boolean;
  // Whether a character defends every attack ("all") or none: with nobody defending the attack falls on the character with the least damage.
  defend: "none" | "all";
  // The quest: the first ready character of a seat, or every one but the last (the Willpower to beat a staging area that fills with the Threat of Saruman's army, and a character left ready to attack Saruman).
  quest: "one" | "most";
};
export const DEFAULT_POLICY: IsengardPolicy = { choose: "first", engage: true, defend: "none", quest: "most" };

// The auto-player's answer (test/harness/auto-player.ts), except: the Resolution's questions, the travel, an engagement, the attack and a defender are answered as the policy says; a choice takes the first answer, or the last.
// Every intent is one the reducer listed.
export function isengardIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: IsengardPolicy = DEFAULT_POLICY, options: PolicyOptions = ISENGARD_POLICY): PlayerIntent {
  const intents = legalIntents(state, ctx);
  if (state.window?.kind === "resolution") {
    const offered = intents.flatMap((intent) => (intent.type === "ChooseResolution" ? [intent.optionId] : []));
    return { type: "ChooseResolution", optionId: (policy.choose === "last" ? offered.at(-1) : offered[0]) ?? "" };
  }
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  if (state.window?.kind === "optionalEngage") {
    const seat = state.seats[state.activeSeat];
    const wanted = legalTargets(state, { type: "Engage" }, ctx)[0];
    return policy.engage && wanted && seat && seat.engaged.length < seat.heroes.length ? { type: "Engage", enemyId: wanted } : { type: "DeclineEngage" };
  }
  if (state.window?.kind === "travel") {
    // Orthanc first: it is the active location that engages Saruman with the first player (143080:B:1), whom the attack must wound before the last stage can be defeated (143048:A:2).
    // Once Saruman has taken his 6 damage and Orthanc has been explored (143080:B:2 cancels that phase's progress and sends it back to staging), the players stay away from it: the next quest fills the stage.
    const targets = legalTargets(state, { type: "Travel" }, ctx);
    const wounded = Object.values(state.cards).some((card) => card.code === SARUMAN && card.damage >= 6);
    const wanted = wounded ? targets.find((id) => state.cards[id]?.code !== ORTHANC) : (targets.find((id) => state.cards[id]?.code === ORTHANC) ?? targets[0]);
    return wanted ? { type: "Travel", locationId: wanted } : { type: "DeclineTravel" };
  }
  if (state.window?.kind === "playerAttack" && policy.engage) {
    // Saruman first: the gate on the last stage wants 6 damage on him (143048:A:2).
    const attack = attackTogether(state, ctx, undefined, (id) => (state.cards[id]?.code === SARUMAN ? 0 : 1));
    if (attack) return attack;
  }
  if (state.window?.kind === "defense") {
    const byDamage = (ids: readonly string[]) => [...ids].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    const defender = policy.defend === "all" && intents.some((intent) => intent.type === "DeclareDefender") ? byDamage(legalTargets(state, { type: "DeclareDefender" }, ctx)) : undefined;
    if (defender) return { type: "DeclareDefender", defenderId: defender };
    const least = byDamage(legalTargets(state, { type: "Undefended" }, ctx));
    if (least) return { type: "Undefended", heroId: least };
  }
  if (state.window?.kind === "pass" && state.mode === "questCommit") {
    const quested = Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat);
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    if (!quested && ids.length > 0) return { type: "Commit", cardIds: policy.quest === "most" ? ids.slice(0, Math.max(1, ids.length - 1)) : ids.slice(0, 1) };
  }
  return nextIntent(state, ctx, options, memory, intents);
}

export type IsengardGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-road-to-isengard/golden.test.ts), also played by the causes and replay tests once test/harness/golden-registry.ts lists them.
// `after`: the log of a campaign whose earlier parts were won. `upgraded`: the Upgraded sides. `mode`: the Hard or Expert Mode card.
export type IsengardGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: IsengardDecks; outcome: "won" | "lost"; policy?: Partial<IsengardPolicy>; after?: boolean; upgraded?: boolean; mode?: ModeCard; lossReason?: string };

// A few wins (true solo and two-handed, Normal and Easy) and the ways to lose: the players' threat at 50 (heroes too small to quest on stage 2B), every hero destroyed (heroes too brittle to survive the army), and a player with no cards in
// hand on stage 3B (143080:B:3: the players never attack, so the games run long and each first option a Wolf, an Isengard Orc or a Wizardry discard empties a hand). The wins quest with all but one character, travel to Orthanc, wound Saruman
// with the character left ready (8 damage: the gate of 143048:A:2 opens) and defeat stage 3B.
export const ISENGARD_GOLDENS: readonly IsengardGolden[] = [
  { name: "true solo, won, Normal", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", after: true },
  { name: "true solo, won, Easy", seatCount: 1, seed: 2, difficulty: "Easy", decks: "strong", outcome: "won", after: true },
  { name: "two-handed, won, Normal", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", after: true },
  { name: "two-handed, won, Easy", seatCount: 2, seed: 2, difficulty: "Easy", decks: "strong", outcome: "won", after: true },
  { name: "true solo, lost, threat reaches 50", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", after: true, lossReason: "No seats remain" },
  { name: "two-handed, lost, threat reaches 50", seatCount: 2, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", after: true, lossReason: "No seats remain" },
  { name: "true solo, lost, every hero is destroyed", seatCount: 1, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", after: true, lossReason: "No seats remain" },
  { name: "two-handed, lost, every hero is destroyed", seatCount: 2, seed: 4, difficulty: "Normal", decks: "brittle", outcome: "lost", after: true, lossReason: "No seats remain" },
  { name: "true solo, lost, the hand is empty on stage 3B", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "lost", after: true, policy: { engage: false }, lossReason: "No seats remain" },
  { name: "two-handed, lost, a hand is empty on stage 3B", seatCount: 2, seed: 2, difficulty: "Normal", decks: "strong", outcome: "lost", after: true, policy: { engage: false }, lossReason: "No seats remain" },
];

const game = campaignGame<IsengardDecks, IsengardPolicy>({
  campaign,
  scenario: isengard,
  stats: HERO_STATS,
  // The scenario's own cards and what the earlier Resolutions leave in the pool (the Skill boons, Beyond All Hope, Poisoned Counsels); the campaign card's and the campaign's game codes are added by the kit.
  codes: [...isengard.cards.map((card) => card.code), "143015", "143016", "143017", "143018", "143019", "143020", "143021"],
  intent: isengardIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
  upgraded: [],
  // The earlier parts' players earned no XP in the golden (the Two Towers award none) and no card; the Resolution's boons are the campaign test's.
  earlier: { xp: [0, 0], pool: [], marks: {} },
});

export const playGolden = (golden: IsengardGolden, ctx: ReduceContext): IsengardGame => game.playGolden(golden, ctx);
