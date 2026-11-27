import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import type { LoadoutSeat } from "../../../src/campaign/loadout.ts";
import { returnOfTheKingFacts } from "../../../src/campaign/log-return-of-the-king.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadCampaign, loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { attackTogether, campaignGame, fillerLoadout, HERO_STATS, type HeroStats, type PlayedGame } from "../../harness/game-kit.ts";

const campaign = loadCampaign("the-return-of-the-king");
const fields = loadScenario("the-battle-of-the-pelennor-fields");

// Test helper. A whole game of The Battle of the Pelennor Fields in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. The players travel to the first location they may (never a Pelennor location while stage 3B holds), quest with every ready
// character but the last (kept to attack whatever the players engage), engage nothing they need not, defend with nobody (an attack falls on the character with the least damage; Minas Tirith takes Mordor Orc's) and answer each choice
// as the policy says: the first option (the Esquires attached, the damage to a hero) or the last (no Esquire, the damage to Minas Tirith).
export const FIELDS_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat or Minas Tirith falls; "brittle": strong questers that die to an attack.
export type FieldsDecks = "strong" | "weak" | "brittle";

// The strong stand-ins start at a threat of 8 each (24 for three): the refresh and Overcome by Fear, which the Passing of the Grey Company leaves on each dial (the pool entries below), each raise a seat's threat by 1 a round and it cannot be reduced, so a game of ten rounds or so ends under 50.
// The Harad and Mordor enemies engage at costs of 30 and more, so they engage once the threat has risen to it, the numbers being the deck's, not the scenario's. The brittle ones start at 11: they die before the threat matters.
const FIELDS_STATS = { strong: { ...HERO_STATS.strong, threat: 8, attack: 30, defense: 20 }, weak: HERO_STATS.weak, brittle: { ...HERO_STATS.brittle, threat: 11 } } as const satisfies Record<FieldsDecks, HeroStats>;

const ARAGORN = "145001";
// The first player starts with the saga's Aragorn (145001, mec113.setting-up-the-game) beside two stand-in heroes; a second seat has three. The campaign card's Setup sets him aside with Andúril and the Banner of Elendil.
export const fieldsLoadout = (seatCount: 1 | 2): LoadoutSeat[] => {
  const [, second] = fillerLoadout(2);
  const first = { heroes: [ARAGORN, "q1", "q2", "q3"], deck: fillerLoadout(1)[0]!.deck };
  return seatCount === 1 ? [first] : [first, second!];
};

// What the earlier parts hand on (the campaign log): the resources on The Corsair Fleet the Siege recorded (145070:B:1) and the Harad enemies under The Black Gate that Journey to the Cross-roads recorded (the log's `blackGate`; each is
// set aside, one copy for each recorded, 145078:A:1). The numbers are the goldens' own choices, not what the real chain hands on: the Siege's golden records 12 resources on the Fleet and the Two Towers' goldens record no enemy under The Black Gate, so a 4 and three Harad enemies are
// written by hand here (enough that Aragorn returns at the fourth quest phase and that the Setup sets several enemies aside).
export const FLEET_RECORDED = 4;
export const BLACK_GATE_RECORDED: Readonly<Record<string, number>> = { "144028": 1, "144057": 1, "144058": 1 };

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier parts were won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
// Aragorn takes the numbers of the deck like the stand-in heroes beside him (his printed numbers could not quest or defend a game of auto-played turns).
export const fieldsWorld = async (decks: FieldsDecks = "strong") => {
  const world = await game.world(decks);
  world.cards.set(ARAGORN, { ...world.cards.get(ARAGORN)!, ...FIELDS_STATS[decks], threat: 0 });
  return world;
};
// The log the Siege of Gondor's win leaves on top of the earlier parts': the Fleet's resources and the Black Gate's Harad enemies the Two Towers' save carries (`blackGate`).
export const afterGondor = (seatCount: 1 | 2): CampaignLog => ({ ...game.after(seatCount), corsairFleet: FLEET_RECORDED, blackGate: { ...BLACK_GATE_RECORDED } });
export const fieldsPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount), choices?: readonly string[], loadout?: LoadoutSeat[]) => game.plan(seatCount, log, choices, undefined, loadout);
// The facts a game of this campaign reads from the log's notes (`CampaignFacts.notes`, src/campaign/briefing.ts): the Fleet's resources and the Harad enemies.
const logFacts = (log: CampaignLog, facts?: Omit<CampaignFacts, "modeCard">): Omit<CampaignFacts, "modeCard"> => ({ prisoner: null, usedOnce: [], counters: {}, ...facts, ...returnOfTheKingFacts(log, campaign.id) });
export const fieldsStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard, extra: { choices?: readonly string[]; loadout?: LoadoutSeat[] } = {}) =>
  game.start(seatCount, seed, difficulty, { facts: logFacts(log, facts), log, modeCard, ...extra });

export type FieldsPolicy = {
  // The option a Choose window takes: the first or the last (the Esquires attached or not; damage to a hero or to Minas Tirith).
  choose: "first" | "last";
  // Whether the players engage the enemies of the staging area, one at a time.
  engage: boolean;
  // Whether a ready character defends the attacks of Mordor Orc (its undefended damage goes to Minas Tirith; a defender keeps it from the City).
  defend: boolean;
  // The quest: the first ready character of a seat, or every one but the last, or all.
  quest: "one" | "most" | "all";
};
export const DEFAULT_POLICY: FieldsPolicy = { choose: "first", engage: true, defend: true, quest: "one" };

// The auto-player's answer (test/harness/auto-player.ts), except: the travel, an engagement and the attack are answered as the policy says; a choice takes the first option or the last; an attack falls on the character with the least damage
// (or on Minas Tirith, the one target the engine offers for Mordor Orc's). Every intent is one the reducer listed.
export function fieldsIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: FieldsPolicy = DEFAULT_POLICY, options: PolicyOptions = FIELDS_POLICY): PlayerIntent {
  const intents = legalIntents(state, ctx);
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  if (state.window?.kind === "optionalEngage") {
    const seat = state.seats[state.activeSeat];
    const wanted = legalTargets(state, { type: "Engage" }, ctx)[0];
    return policy.engage && wanted && seat && seat.engaged.length < seat.heroes.length ? { type: "Engage", enemyId: wanted } : { type: "DeclineEngage" };
  }
  if (state.window?.kind === "travel") {
    const wanted = legalTargets(state, { type: "Travel" }, ctx)[0];
    return wanted ? { type: "Travel", locationId: wanted } : { type: "DeclineTravel" };
  }
  if (state.window?.kind === "playerAttack") {
    // One character at a time, so the others are left to attack another enemy: the enemy with the fewest hit points that has not been attacked this round (the memory holds the round and the enemy), since only kills place progress on stage 3B.
    const seat = state.seats[state.activeSeat];
    const seen = (enemyId: string) => memory.has(`${state.round}:${enemyId}`);
    const rank = (enemyId: string) => (seen(enemyId) ? 1000 : (ctx.cards.get(state.cards[enemyId]?.code ?? "")?.health ?? 99));
    const attack = [...(seat?.heroes ?? []), ...(seat?.play ?? [])].map((one) => attackTogether(state, ctx, (id) => id === one, rank)).find((intent) => intent?.type === "DeclareAttackers" && !seen(intent.enemyId));
    if (attack?.type === "DeclareAttackers") {
      memory.add(`${state.round}:${attack.enemyId}`);
      return attack;
    }
  }
  if (state.window?.kind === "defense") {
    // Only Mordor Orc's attack is defended: its undefended damage would go to Minas Tirith, while a hero takes any other and keeps its attack for the enemies (a defender is exhausted).
    const attacker = state.pendingAttack ? state.cards[state.pendingAttack.enemyId] : undefined;
    const defender = policy.defend && attacker?.code === "145055" ? legalTargets(state, { type: "DeclareDefender" }, ctx)[0] : undefined;
    if (defender) return { type: "DeclareDefender", defenderId: defender };
    const least = [...legalTargets(state, { type: "Undefended" }, ctx)].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (least) return { type: "Undefended", heroId: least };
  }
  if (state.window?.kind === "pass" && state.mode === "questCommit") {
    const quested = Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat);
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    if (!quested && ids.length > 0) return { type: "Commit", cardIds: policy.quest === "all" ? ids : policy.quest === "most" ? ids.slice(0, Math.max(1, ids.length - 1)) : ids.slice(0, 1) };
  }
  return nextIntent(state, ctx, options, memory, intents);
}

export type FieldsGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-battle-of-the-pelennor-fields/golden.test.ts).
// `after`: the log of the earlier parts (the Fleet's resources, the Black Gate's Harad enemies). `upgraded`: the Upgraded sides. `mode`: the Hard or Expert Mode card. `lossKind`: how a lost game ended (Minas Tirith destroyed, every hero destroyed, threat at 50).
export type FieldsGolden = {
  name: string;
  seatCount: 1 | 2;
  seed: number;
  difficulty: Difficulty;
  decks: FieldsDecks;
  outcome: "won" | "lost";
  policy?: Partial<FieldsPolicy>;
  after?: boolean;
  upgraded?: boolean;
  mode?: ModeCard;
  lossReason?: string;
  lossKind?: "city" | "heroes" | "threat";
};

// Wins (true solo and two-handed, Normal and Easy; after the Siege with its Fleet and the Harad enemies recorded, once with an empty log so the Fleet holds no resource, once with no Esquire attached and the damage answered for the City) and the ways to
// lose that a game of stand-ins reaches: Minas Tirith destroyed (heroes too small to quest), every hero destroyed, and a threat at 50.
export const FIELDS_GOLDENS: readonly FieldsGolden[] = [
  { name: "true solo, won, Normal, after the Siege", seatCount: 1, seed: 5, difficulty: "Normal", decks: "strong", outcome: "won", after: true },
  { name: "true solo, won, Easy, after the Siege", seatCount: 1, seed: 1, difficulty: "Easy", decks: "strong", outcome: "won", after: true },
  { name: "true solo, won, Normal, with no earlier log", seatCount: 1, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, won, after the Siege, no Esquire, the City damaged", seatCount: 1, seed: 5, difficulty: "Normal", decks: "strong", outcome: "won", after: true, policy: { choose: "last" } },
  { name: "two-handed, won, Normal, after the Siege", seatCount: 2, seed: 6, difficulty: "Normal", decks: "strong", outcome: "won", after: true },
  { name: "two-handed, won, Easy, after the Siege", seatCount: 2, seed: 3, difficulty: "Easy", decks: "strong", outcome: "won", after: true },
  { name: "two-handed, won, after the Siege, no Esquire, the City damaged", seatCount: 2, seed: 15, difficulty: "Normal", decks: "strong", outcome: "won", after: true, policy: { choose: "last" } },
  { name: "true solo, lost, Minas Tirith destroyed", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", after: true, lossReason: "Minas Tirith has no hit points remaining", lossKind: "city" },
  { name: "two-handed, lost, Minas Tirith destroyed", seatCount: 2, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", after: true, lossReason: "Minas Tirith has no hit points remaining", lossKind: "city" },
  { name: "true solo, lost, every hero destroyed", seatCount: 1, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", after: true, lossReason: "No seats remain", lossKind: "heroes" },
  { name: "two-handed, lost, every hero destroyed", seatCount: 2, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", after: true, lossReason: "No seats remain", lossKind: "heroes" },
  { name: "true solo, lost, threat reaches 50", seatCount: 1, seed: 22, difficulty: "Normal", decks: "strong", outcome: "lost", after: true, lossReason: "No seats remain", lossKind: "threat" },
];

const game = campaignGame<FieldsDecks, FieldsPolicy>({
  campaign,
  scenario: fields,
  stats: FIELDS_STATS,
  loadout: fieldsLoadout,
  // The scenario's cards, Aragorn, Andúril, Banner of Elendil and The Witch-king's Sorcerer side (145077 adds it) the campaign card or the quest cards place, the Overcome by Fear the Grey Company earned and the pool cards the Two Towers' log carries over; the campaign card's and the campaign's game codes are added by the kit.
  codes: [...fields.cards.map((card) => card.code), "145080", "145001", "142014", "145013", "145016", "144052", "144014", "144075", "144076", "144015", "143015", "143016", "143017", "143018", "143019", "143020", "143021", "143068"],
  intent: fieldsIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
  upgraded: [],
  // The Passing of the Grey Company earns no XP and leaves an Overcome by Fear for each seat whose dial held one (145066:B:1; a true solo game reads both rows for its one seat); the Siege earns none and removes the Army of the Dead boon (145070:B:1).
  earlier: { xp: [0, 0], pool: [{ code: "145016", seat: 0 }, { code: "145016", seat: 1 }], marks: {} },
});

// A golden: the log of the earlier parts it plays after (the Fleet's resources and the Harad enemies carried), its policy over the default.
export const playGolden = (golden: FieldsGolden, ctx: ReduceContext): FieldsGame => {
  const log = golden.after ? afterGondor(golden.seatCount) : emptyLog(golden.seatCount);
  return game.play(golden.seatCount, golden.seed, golden.difficulty, ctx, { facts: logFacts(log), log, policy: golden.policy, mode: golden.mode });
};
