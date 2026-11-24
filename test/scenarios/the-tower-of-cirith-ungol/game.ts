import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadCampaign, loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import type { LoadoutSeat } from "../../../src/campaign/loadout.ts";
import { attackTogether, campaignGame, fillerLoadout, HERO_STATS, RING_BEARER, type HeroStats, type PlayedGame } from "../../harness/game-kit.ts";

const campaign = loadCampaign("the-return-of-the-king");
// The Item boons a pool can hold (Sting, the Mithril shirt, Glamdring, Andúril, the Lórien gifts): the campaign card's Setup sets one aside for each player (146069:A:1; Andúril is not offered).
export const ITEM_BOONS = ["142011", "142012", "142013", "142014", "142015", "142016", "142017", "142018"] as const;
const ungol = loadScenario("the-tower-of-cirith-ungol");

// Test helper. A whole game of The Tower of Cirith Ungol in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. The players travel to Topmost Chamber once the stage lets them and to The Two Watchers otherwise, quest with every ready character
// but the last (kept to attack), attack The Two Watchers first and the other enemies by their hit points, engage what the policy says, defend with nobody (an attack falls on the character with the least damage) and answer each choice as the policy says.
export const UNGOL_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type UngolDecks = "strong" | "weak" | "brittle";

// The strong stand-ins start at a threat of 3 each and Frodo, who lies under Topmost Chamber, at 0: the Watchers' attacks (each raises the threat by its Attack) and the refresh raise a seat's threat every round and it cannot be reduced, so a game of ten rounds or so ends under 50.
const UNGOL_STATS = { strong: { ...HERO_STATS.strong, attack: 30, defense: 20 }, weak: HERO_STATS.weak, brittle: { ...HERO_STATS.brittle, threat: 8 } } as const satisfies Record<UngolDecks, HeroStats>;

// The first player holds the Ring-bearer with The One Ring attached (the saga start of scenario 16, mec113.setting-up-the-game): Frodo, beside three stand-in heroes (Setup lays him under Topmost Chamber and gives Last of the Company to one of them); a second seat has three.
export const ungolLoadout = (seatCount: 1 | 2): LoadoutSeat[] => {
  const [, second] = fillerLoadout(2);
  const first = { heroes: [RING_BEARER, "q1", "q2", "q3"], deck: fillerLoadout(1)[0]!.deck };
  return seatCount === 1 ? [first] : [first, second!];
};

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier parts were won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
// Frodo, the Ring-bearer, takes the numbers of the deck like the stand-in heroes beside him (his printed numbers could not quest or defend a game of auto-played turns).
export const ungolWorld = async (decks: UngolDecks = "strong") => {
  const world = await game.world(decks);
  world.cards.set(RING_BEARER, { ...world.cards.get(RING_BEARER)!, ...UNGOL_STATS[decks], threat: 0 });
  return world;
};
export const afterFields = (seatCount: 1 | 2) => game.after(seatCount);
export const ungolPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount), choices?: readonly string[]) => game.plan(seatCount, log, choices);
export const ungolStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard, extra: { choices?: readonly string[] } = {}) => game.start(seatCount, seed, difficulty, { facts, log, modeCard, ...extra });

export type UngolPolicy = {
  // The option a Choose window takes: the first or the last (Drawn to the Ring's Ring or enemy; Deep Shadows' hand or card; Evil Vigilance's character or threat).
  choose: "first" | "last";
  // Whether the players engage the enemies of the staging area, one at a time.
  engage: boolean;
  // Whether the players engage and attack Shagrat: when they do not, he is still in play when the scenario is won and the boons guarded on him are lost (146069:B:2).
  hunt: boolean;
  // The quest: the first ready character of a seat, or every one but the last, or all.
  quest: "one" | "most" | "all";
};
export const DEFAULT_POLICY: UngolPolicy = { choose: "first", engage: true, hunt: true, quest: "most" };

// The Two Watchers (enemy side) first, so stage 1 and stage 3B can advance; Shagrat next, so the boons on him come home; then the enemy with the fewest hit points.
const WATCHERS = "146071";
const SHAGRAT = "146020";
const TOPMOST_CHAMBER = "146015";
const EVIL_VIGILANCE = "146063";
const THE_ONE_RING = "146065";

// The auto-player's answer (test/harness/auto-player.ts), except: the travel goes to Topmost Chamber whenever the stage lets the players, an engagement and the attack are answered as the policy says, a choice takes the first option or the last, and an attack
// falls on the character with the least damage that does not carry The One Ring. Every intent is one the reducer listed.
export function ungolIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: UngolPolicy = DEFAULT_POLICY, options: PolicyOptions = UNGOL_POLICY): PlayerIntent {
  const intents = legalIntents(state, ctx);
  if (state.window?.kind === "choose") {
    // Evil Vigilance's discard of a questing character could discard the hero carrying The One Ring, which loses the game: the players raise their threat instead.
    if (state.cards[state.stack.at(-1)?.cardId ?? ""]?.code === EVIL_VIGILANCE && state.window.options.includes("threat")) return { type: "Choose", optionId: "threat" };
    return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  }
  if (state.window?.kind === "optionalEngage") {
    const seat = state.seats[state.activeSeat];
    const wanted = legalTargets(state, { type: "Engage" }, ctx).find((id) => policy.hunt || state.cards[id]?.code !== SHAGRAT);
    return policy.engage && wanted && seat && seat.engaged.length < seat.heroes.length ? { type: "Engage", enemyId: wanted } : { type: "DeclineEngage" };
  }
  if (state.window?.kind === "travel") {
    const targets = legalTargets(state, { type: "Travel" }, ctx);
    const wanted = targets.find((id) => state.cards[id]?.code === TOPMOST_CHAMBER) ?? targets[0];
    return wanted ? { type: "Travel", locationId: wanted } : { type: "DeclineTravel" };
  }
  if (state.window?.kind === "playerAttack") {
    // One character at a time, so the others are left to attack another enemy.
    const seat = state.seats[state.activeSeat];
    const seen = (enemyId: string) => memory.has(`${state.round}:${enemyId}`);
    const rank = (enemyId: string) => {
      const code = state.cards[enemyId]?.code ?? "";
      return seen(enemyId) || (code === SHAGRAT && !policy.hunt) ? 1000 : code === WATCHERS ? -2 : code === SHAGRAT ? -1 : (ctx.cards.get(code)?.health ?? 99);
    };
    const attack = [...(seat?.heroes ?? []), ...(seat?.play ?? [])].map((one) => attackTogether(state, ctx, (id) => id === one, rank)).find((intent) => intent?.type === "DeclareAttackers" && !seen(intent.enemyId));
    if (attack?.type === "DeclareAttackers") {
      memory.add(`${state.round}:${attack.enemyId}`);
      return attack;
    }
  }
  if (state.window?.kind === "defense") {
    // An attack falls on the character with the least damage, but never on the hero that carries The One Ring while another can take it: its destruction loses the game.
    const carrier = Object.values(state.cards).find((card) => card.code === THE_ONE_RING)?.host;
    const least = [...legalTargets(state, { type: "Undefended" }, ctx)].sort((left, right) => Number(left === carrier) - Number(right === carrier) || (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (least) return { type: "Undefended", heroId: least };
  }
  if (state.window?.kind === "pass" && state.mode === "questCommit") {
    const quested = Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat);
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    if (!quested && ids.length > 0) return { type: "Commit", cardIds: policy.quest === "all" ? ids : policy.quest === "most" ? ids.slice(0, Math.max(1, ids.length - 1)) : ids.slice(0, 1) };
  }
  return nextIntent(state, ctx, options, memory, intents);
}

export type UngolGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-tower-of-cirith-ungol/golden.test.ts).
// `after`: the log of the earlier parts (Overcome by Fear, the Esquires, the Wraiths on Wings and the Item boons they hand on). `upgraded`: the Upgraded sides. `mode`: the Hard or Expert Mode card. `lossKind`: how a lost game ended (threat at 50, or the hero carrying The One Ring destroyed).
export type UngolGolden = {
  name: string;
  seatCount: 1 | 2;
  seed: number;
  difficulty: Difficulty;
  decks: UngolDecks;
  outcome: "won" | "lost";
  policy?: Partial<UngolPolicy>;
  after?: boolean;
  upgraded?: boolean;
  mode?: ModeCard;
  lossReason?: string;
  lossKind?: "threat" | "ring";
};

// The Item boons the goldens' pool holds: each seat sets one aside at Setup (Sting for the first seat, Glamdring for the second), the others stay in the deck. The real chain's Resolutions earn none; the Fellowship and Two Towers saga does, so they are written by hand.
export const STING = "142011";
export const MITHRIL = "142012";
export const GLAMDRING = "142013";
export const PHIAL = "142015";
const ITEM_POOL = [{ code: STING, seat: 0 }, { code: MITHRIL, seat: 0 }, { code: GLAMDRING, seat: 1 }, { code: PHIAL, seat: 1 }] as const;
// The choices a game after the earlier parts answers at the Campaign Setup: each seat sets aside the first Item boon of the pool it is offered.
export const ITEM_CHOICES = (seatCount: 1 | 2): readonly string[] => (seatCount === 1 ? [STING] : [STING, GLAMDRING]);

// Wins (true solo and two-handed, Normal and Easy, after the earlier parts with the Item boons in the pool and once with an empty log; the boons come home when Shagrat is defeated, stay set aside when he is defeated before stage 3A and are lost when he is
// still in play at the end) and the two ways to lose that a game of stand-ins reaches: the threat at 50 (heroes too small to quest) and the hero with The One Ring destroyed (heroes too brittle to survive the Watchers' and the Orcs' attacks).
export const UNGOL_GOLDENS: readonly UngolGolden[] = [
  { name: "true solo, won, Normal, after the earlier parts, Shagrat defeated", seatCount: 1, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won", after: true },
  { name: "true solo, won, Easy, after the earlier parts, the other options", seatCount: 1, seed: 2, difficulty: "Easy", decks: "strong", outcome: "won", after: true, policy: { choose: "last" } },
  { name: "true solo, won, Normal, with no earlier log", seatCount: 1, seed: 3, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, won, Normal, after the earlier parts, Shagrat left in play", seatCount: 1, seed: 5, difficulty: "Normal", decks: "strong", outcome: "won", after: true, policy: { hunt: false } },
  { name: "two-handed, won, Normal, after the earlier parts, Shagrat defeated", seatCount: 2, seed: 7, difficulty: "Normal", decks: "strong", outcome: "won", after: true },
  { name: "two-handed, won, Easy, after the earlier parts, the other options", seatCount: 2, seed: 4, difficulty: "Easy", decks: "strong", outcome: "won", after: true, policy: { choose: "last" } },
  { name: "two-handed, won, Normal, after the earlier parts, Shagrat left in play", seatCount: 2, seed: 8, difficulty: "Normal", decks: "strong", outcome: "won", after: true, policy: { hunt: false } },
  { name: "two-handed, won, Easy, after the earlier parts, Shagrat defeated before stage 3A", seatCount: 2, seed: 44, difficulty: "Easy", decks: "strong", outcome: "won", after: true },
  { name: "true solo, lost, threat reaches 50", seatCount: 1, seed: 4, difficulty: "Normal", decks: "weak", outcome: "lost", after: true, lossReason: "No seats remain", lossKind: "threat" },
  { name: "two-handed, lost, threat reaches 50", seatCount: 2, seed: 2, difficulty: "Normal", decks: "weak", outcome: "lost", after: true, lossReason: "No seats remain", lossKind: "threat" },
  { name: "true solo, lost, The One Ring leaves play", seatCount: 1, seed: 4, difficulty: "Normal", decks: "brittle", outcome: "lost", after: true, lossReason: "The One Ring left play", lossKind: "ring" },
  { name: "two-handed, lost, The One Ring leaves play", seatCount: 2, seed: 2, difficulty: "Normal", decks: "brittle", outcome: "lost", after: true, lossReason: "The One Ring left play", lossKind: "ring" },
];

const game = campaignGame<UngolDecks, UngolPolicy>({
  campaign,
  scenario: ungol,
  stats: UNGOL_STATS,
  // The cards a game loads besides the scenario's piles, its campaign card's and the campaign's game codes.
  codes: [...ungol.cards.map((card) => card.code), RING_BEARER, "144052", "146065", "146071", ...ITEM_BOONS, "145014", "145015", "145016", "145062", "143020", "143021", "145001", "142014", "145013"],
  loadout: ungolLoadout,
  intent: ungolIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
  upgraded: [],
  // The three earlier parts earn no XP. What the Pelennor's chain leaves in the pool: an Overcome by Fear for each seat (the Grey Company's; this Setup leaves it out of the game), a Wraith on Wings for each seat and the two Esquires on the first seat's heroes (the Pelennor's, 145078:B:2), the Two Towers' cards
  // the real chain carries (Poisoned Counsels for each seat, 143021, whose burden set this Setup leaves out, and the Palantír of Orthanc, 143020, an Item boon), and the Item boons written above.
  earlier: { xp: [0, 0, 0], pool: [{ code: "143021", seat: 0 }, { code: "143021", seat: 1 }, { code: "143020", seat: 0 }, { code: "145016", seat: 0 }, { code: "145016", seat: 1 }, { code: "145062", seat: 0 }, { code: "145062", seat: 1 }, { code: "145014", seat: 0 }, { code: "145015", seat: 0 }, ...ITEM_POOL], marks: {} },
});

// A golden: the log of the earlier parts it plays after, its policy over the default, the Setup's boon choices answered.
export const playGolden = (golden: UngolGolden, ctx: ReduceContext): UngolGame => game.playGolden(golden, ctx, golden.after ? ITEM_CHOICES(golden.seatCount) : undefined);
