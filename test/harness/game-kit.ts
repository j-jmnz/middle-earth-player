import { checklist } from "../../src/campaign/checklist.ts";
import type { LoadoutSeat } from "../../src/campaign/loadout.ts";
import { emptyLog, poolCard, type CampaignLog } from "../../src/campaign/log.ts";
import { buildStart } from "../../src/campaign/start.ts";
import { campaignScenario, type CampaignData, type Difficulty, type ScenarioData } from "../../src/catalog/scenario-data.ts";
import { EFFECTS } from "../../src/effects/index.ts";
import type { CampaignFacts, ModeCard } from "../../src/rules/core/campaign-state.ts";
import { characters, legalAttackEnemies } from "../../src/rules/combat/combat.ts";
import type { EngineStep } from "../../src/rules/core/intents.ts";
import { definePrinted, type PrintedCard } from "../../src/rules/core/printed.ts";
import { expectOk } from "../../src/rules/core/test-fixture.ts";
import { legalIntents, legalTargets, reduce, startScenario, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../src/rules/engine/reduce.ts";
import type { StartScenario } from "../../src/rules/setup/setup.ts";

import { gameCodes } from "../../scripts/data/load-scenarios.ts";
import { loadPrinted } from "./catalog.ts";
import { faceProblems } from "./face-check.ts";
import { FRODO } from "./scene.ts";

// Test helper. The parts every scenario's seeded whole game (test/scenarios/<scenario-id>/game.ts) shares: the stand-in heroes
// and the free-event deck, the loop that plays a game to its end, and the auto-player's extra answers most scenarios give
// (attack together, engage one enemy at a time). A scenario's game.ts keeps only what is its own: its start, its answers,
// its goldens.

// Stand-in heroes, three a seat, with the numbers each scenario's game gives them, and a deck of free events.
export const STRONG_HEROES = ["q1", "q2", "q3", "q4", "q5", "q6"];
export const FILLER = "filler";

export function fillerLoadout(seatCount: 1 | 2): LoadoutSeat[] {
  const deck = Array.from({ length: 30 }, () => FILLER);
  const first = { heroes: ["q1", "q2", "q3"], deck };
  return seatCount === 1 ? [first] : [first, { heroes: ["q4", "q5", "q6"], deck }];
}

/** The free event the filler decks hold: costs nothing and does nothing. */
export function fillerCard(): PrintedCard {
  return definePrinted({ code: FILLER, name: FILLER, type: "event", sphere: "neutral", cost: 0 });
}

/** The cards of `codes`, the stand-in heroes q1 to q6 of these numbers and the filler event. */
export async function standInWorld(codes: readonly string[], stats: HeroStats): Promise<Map<string, PrintedCard>> {
  const cards = new Map(await loadPrinted([...new Set(codes)]));
  for (const code of STRONG_HEROES) cards.set(code, definePrinted({ code, name: code, type: "hero", sphere: "tactics", ...stats }));
  cards.set(FILLER, fillerCard());
  return cards;
}

export type PlayedGame = { start: StartScenario; kept: ScenarioState; state: ScenarioState; intents: PlayerIntent[]; steps: EngineStep[] };

/**
 * Plays a game from its start: the first seat keeps its opening hand (a second seat's Keep is the first of `intents`), then
 * `answer` gives every intent until the scenario is lost, or won and every Resolution choice is answered, or `limit` intents.
 */
export function playToEnd(start: StartScenario, ctx: ReduceContext, answer: (state: ScenarioState, memory: Set<string>) => PlayerIntent, limit: number): PlayedGame {
  const opened = expectOk(reduce(startScenario(start, ctx), { type: "Keep" }, ctx));
  const kept = opened.state;
  const steps: EngineStep[] = [...opened.steps];
  let state = kept;
  const intents: PlayerIntent[] = [];
  const memory = new Set<string>();
  for (let turn = 0; turn < limit && !state.lost && !(state.stageCleared && state.window == null); turn += 1) {
    const intent = answer(state, memory);
    const result = expectOk(reduce(state, intent, ctx));
    state = result.state;
    steps.push(...result.steps);
    intents.push(intent);
    // A card in the staging area, engaged or active shows its face (face-check.ts).
    const facedown = faceProblems(state);
    if (facedown.length > 0) throw new Error(`After intent ${intents.length} (${JSON.stringify(intent)}): ${facedown.join("; ")}`);
  }
  return { start, kept, state, intents, steps };
}

/**
 * In a player attack window: every ready character that may attack (and `may` allows) attacks the first enemy any of them can
 * reach, together. Null when the window is another, or nobody can attack.
 */
export function attackTogether(state: ScenarioState, ctx: ReduceContext, may: (id: string) => boolean = () => true): PlayerIntent | null {
  if (state.window?.kind !== "playerAttack" || !legalIntents(state, ctx).some((intent) => intent.type === "DeclareAttackers")) return null;
  const seat = state.activeSeat;
  const ready = characters(state, seat, ctx.cards).filter((id) => may(id) && legalTargets(state, { type: "DeclareAttackers", cardId: id }, ctx).length > 0);
  const enemy = ready.map((id) => legalAttackEnemies(state, seat, id, ctx.cards)[0]).find((id) => id != null);
  const attackers = ready.filter((id) => enemy != null && legalAttackEnemies(state, seat, id, ctx.cards).includes(enemy));
  return enemy && attackers.length > 0 ? { type: "DeclareAttackers", enemyId: enemy, attackerIds: attackers } : null;
}

/**
 * In the optional engagement step: the seat engages the first enemy it may, one at a time, while it is engaged with fewer
 * enemies than `most` (by default its hero count). Null otherwise, and the auto-player declines.
 */
export function engageOneEach(state: ScenarioState, ctx: ReduceContext, most?: number): PlayerIntent | null {
  if (state.window?.kind !== "optionalEngage") return null;
  const seat = state.seats[state.activeSeat];
  const enemy = legalTargets(state, { type: "Engage" }, ctx)[0];
  return enemy && seat && seat.engaged.length < (most ?? seat.heroes.length) ? { type: "Engage", enemyId: enemy } : null;
}

// The hero numbers each scenario's goldens give the stand-in heroes. "strong": big numbers that win; "weak": too small to quest, so the
// players lose on threat; "brittle": strong questers that die to an attack; "tense": strong, with a high starting threat.
export type HeroStats = { threat: number; willpower: number; attack: number; defense: number; health: number };
export const HERO_STATS = {
  strong: { threat: 3, willpower: 20, attack: 12, defense: 6, health: 100 },
  weak: { threat: 8, willpower: 0, attack: 0, defense: 0, health: 100 },
  brittle: { threat: 3, willpower: 20, attack: 12, defense: 0, health: 7 },
  tense: { threat: 14, willpower: 20, attack: 12, defense: 6, health: 100 },
  // "steady": strong attackers with a willpower of 6, so the quest goes slowly.
  steady: { threat: 3, willpower: 6, attack: 12, defense: 6, health: 100 },
} as const satisfies Record<string, HeroStats>;

/** The Mirkwood Paths and Fellowship goldens give the stand-in heroes a starting threat of 8. */
export const HERO_STATS_8 = { strong: { ...HERO_STATS.strong, threat: 8 }, weak: HERO_STATS.weak, brittle: { ...HERO_STATS.brittle, threat: 8 } } as const satisfies Record<string, HeroStats>;

/** Frodo, the Ring-bearer (test/harness/scene.ts). */
export const RING_BEARER = FRODO;

/** A starter deck of a campaign: its heroes, and its other cards one entry a copy. */
export function starterSeat(campaign: CampaignData, id: string): LoadoutSeat {
  const deck = campaign.starterDecks.find((entry) => entry.id === id);
  if (!deck) throw new Error(`No starter deck ${id}`);
  return {
    heroes: deck.rows.filter((row) => row.type === "hero").map((row) => row.code),
    deck: deck.rows.filter((row) => row.type !== "hero").flatMap((row) => Array.from({ length: row.count }, () => row.code)),
  };
}

/**
 * The seats of a Fellowship game, the saga Frodo a fourth hero of the first seat. `starter`: the seeded starter decks (Stealth and
 * Steadfastness, then Wisdom and Wizardry). Otherwise the stand-in heroes beside Frodo and a deck of free events.
 */
export function fellowshipLoadout(campaign: CampaignData, seatCount: 1 | 2, starter: boolean): LoadoutSeat[] {
  if (!starter) {
    const deck = Array.from({ length: 30 }, () => FILLER);
    const first = { heroes: [RING_BEARER, "q1", "q2", "q3"], deck };
    return seatCount === 1 ? [first] : [first, { heroes: ["q4", "q5", "q6"], deck }];
  }
  const stealth = starterSeat(campaign, "stealth-and-steadfastness");
  const first = { heroes: [RING_BEARER, ...stealth.heroes], deck: stealth.deck };
  return seatCount === 1 ? [first] : [first, starterSeat(campaign, "wisdom-and-wizardry")];
}

/** What every campaign golden names: the seats, the seed, the difficulty, and whether it plays after the earlier parts, on the Upgraded sides, or with a Mode card. */
export type CampaignGoldenBase = { seatCount: 1 | 2; seed: number; difficulty: Difficulty; upgraded?: boolean; after?: boolean; mode?: ModeCard };

/** The campaign log the earlier parts leave: the XP each gained (in campaign order), the cards they put in the pool, and the marks on the cards. */
export type EarlierParts = { xp: readonly number[]; pool: readonly { code: string; seat?: number }[]; marks: Readonly<Record<string, number>> };

export type CampaignGameSpec<D extends string, P extends object> = {
  campaign: CampaignData;
  scenario: ScenarioData;
  /** The numbers of the stand-in heroes q1 to q6, by deck. */
  stats: Readonly<Record<D, HeroStats>>;
  /** The numbers a deck gives the scenario's ships (`shipCodes`) over their printed ones, as `stats` gives the stand-in heroes theirs. */
  shipStats?: Partial<Record<D, Partial<HeroStats>>>;
  shipCodes?: readonly string[];
  /** The codes loaded after the scenario's own, its campaign card's and the campaign's game codes. */
  codes: readonly string[];
  /** The scenario's answer (its policy applied) and the policy a golden's own is laid over. */
  intent: (state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: P) => PlayerIntent;
  policy: P;
  /** The most intents a game may take. */
  limit: number;
  /** The cards a golden marked `upgraded` deals on their Upgraded side, and the levels a golden played `after` the earlier parts reads. */
  upgraded: readonly string[];
  levels?: Readonly<Record<string, number>>;
  earlier?: EarlierParts;
};

/**
 * The seeded whole game of one scenario of a campaign (test/scenarios/<scenario-id>/game.ts): its world (the cards a campaign game
 * deals and the stand-in heroes and filler deck), the Campaign Setup Checklist's plan, the start the plan builds, the log the earlier
 * parts leave (in the campaign's order), and a golden played from its fields. The scenario passes what is its own: the codes, the
 * hero numbers, the intent policy, the goldens' facts.
 */
export function campaignGame<D extends string, P extends object>(spec: CampaignGameSpec<D, P>) {
  let loaded: ReadonlyMap<string, PrintedCard> | null = null;
  const cardsOrThrow = (): ReadonlyMap<string, PrintedCard> => {
    if (!loaded) throw new Error(`Build the world of ${spec.scenario.id} first`);
    return loaded;
  };

  async function world(decks: D): Promise<{ cards: Map<string, PrintedCard>; ctx: ReduceContext }> {
    const dealt = campaignScenario(spec.scenario);
    const cards = await standInWorld([...dealt.cards.map((card) => card.code), ...dealt.campaignPlaced, dealt.campaignCard, ...gameCodes(spec.campaign, spec.scenario), ...spec.codes], spec.stats[decks]);
    const ships = spec.shipStats?.[decks];
    if (ships) for (const code of spec.shipCodes ?? []) cards.set(code, { ...cards.get(code)!, ...ships });
    loaded = cards;
    return { cards, ctx: { effects: EFFECTS, cards } };
  }

  /** The log of a campaign whose earlier parts were won. */
  function after(seatCount: 1 | 2): CampaignLog {
    const cards = cardsOrThrow();
    const earlier = spec.earlier;
    const completed = spec.campaign.scenarios.slice(0, spec.campaign.scenarios.indexOf(spec.scenario.id));
    if (!earlier || earlier.xp.length !== completed.length) throw new Error(`${spec.scenario.id} has no XP for each of the ${completed.length} parts before it`);
    return {
      ...emptyLog(seatCount),
      completed,
      campaignPool: earlier.pool.map((row) => poolCard(cards.get(row.code)!, row.code, null, row.seat ?? null)),
      xpGained: Object.fromEntries(completed.map((id, index) => [id, earlier.xp[index] ?? 0])),
      marks: { ...earlier.marks },
    };
  }

  function plan(seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount), choices?: readonly string[]) {
    const checked = checklist({ log, scenario: campaignScenario(spec.scenario), seats: fillerLoadout(seatCount), effects: EFFECTS, cards: cardsOrThrow(), ...(choices ? { choices } : {}) });
    if (!checked.ok) throw new Error(checked.errors.join("; ") || "The campaign card asks for a choice");
    return checked;
  }

  function start(seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard, choices?: readonly string[]): StartScenario {
    const checked = plan(seatCount, log, choices);
    return buildStart({
      campaign: spec.campaign,
      scenario: spec.scenario,
      seatCount,
      seed,
      threatModifier: checked.threatModifier,
      seats: checked.seats,
      effects: EFFECTS,
      difficulty,
      poolEncounterCards: checked.poolEncounterCards,
      poolIntoPlay: checked.poolIntoPlay,
      ...(facts ? { facts } : {}),
      ...(modeCard ? { modeCard } : {}),
    });
  }

  /** Plays until the scenario is lost, or won and every Resolution choice is answered. */
  function play(seatCount: 1 | 2, seed: number, difficulty: Difficulty, ctx: ReduceContext, options: { facts?: Omit<CampaignFacts, "modeCard">; log?: CampaignLog; policy?: Partial<P>; mode?: ModeCard; choices?: readonly string[]; limit?: number } = {}): PlayedGame {
    const policy = { ...spec.policy, ...options.policy };
    return playToEnd(start(seatCount, seed, difficulty, options.facts, options.log, options.mode, options.choices), ctx, (state, memory) => spec.intent(state, ctx, memory, policy), options.limit ?? spec.limit);
  }

  /** A golden: its upgraded cards or, after the earlier parts, their levels as the campaign facts; the earlier parts' log; its policy over the default. */
  function playGolden(golden: CampaignGoldenBase & { policy?: Partial<P> }, ctx: ReduceContext, choices?: readonly string[]): PlayedGame {
    const facts = golden.upgraded ? { prisoner: null, usedOnce: [], counters: {}, upgraded: spec.upgraded } : golden.after && spec.levels ? { prisoner: null, usedOnce: [], counters: {}, levels: spec.levels } : undefined;
    return play(golden.seatCount, golden.seed, golden.difficulty, ctx, { facts, log: golden.after ? after(golden.seatCount) : undefined, policy: golden.policy, mode: golden.mode, choices });
  }

  return { world, after, plan, start, play, playGolden };
}

export type DealtGameSpec<D extends string> = {
  campaign: CampaignData;
  scenario: ScenarioData;
  /** The numbers of the stand-in heroes q1 to q6, by deck. */
  stats: Readonly<Record<D, HeroStats>>;
  /** The codes loaded after the scenario's own and its campaign card's. */
  codes: readonly string[];
  /** The seats a game deals: each seat's heroes and deck. */
  loadout: (seatCount: 1 | 2, decks: D) => LoadoutSeat[];
};

/**
 * The seeded game of a scenario dealt straight from a loadout (no Campaign Setup Checklist): its world (the cards, the stand-in
 * heroes and the filler deck) and the start of a seed. The scenario keeps its answers, its goldens and its play.
 */
export function dealtGame<D extends string>(spec: DealtGameSpec<D>) {
  async function world(decks: D): Promise<{ cards: Map<string, PrintedCard>; ctx: ReduceContext }> {
    const cards = await standInWorld([...spec.scenario.cards.map((card) => card.code), ...spec.scenario.campaignPlaced, spec.scenario.campaignCard, ...spec.codes], spec.stats[decks]);
    return { cards, ctx: { effects: EFFECTS, cards } };
  }

  function start(seatCount: 1 | 2, seed: number, difficulty: Difficulty, decks: D): StartScenario {
    return buildStart({ campaign: spec.campaign, scenario: spec.scenario, seatCount, seed, threatModifier: 0, seats: spec.loadout(seatCount, decks), effects: EFFECTS, difficulty });
  }

  return { world, start };
}
