// Rules: rr.modifiers, rr.lasting-effects (data/rules/entries.json).
//
// What effects do to a card right now, so the table can show it on the card: each printed number an effect raised or
// lowered (the engine's value against the printed one), each "cannot" an effect put on it, and the effects themselves in
// words for the preview. The numbers are read with the engine's modifiedStat; nothing here adds one up.
import type { ModifierStat, ModifierUntil } from "../catalog/boundary.ts";
import { heldBy, modifiedStat } from "../rules/keywords.ts";
import { printedOf, type PrintedCard } from "../rules/printed.ts";
import { engagementCostOf, questPointsOf } from "../rules/quest.ts";
import type { ReduceContext } from "../rules/reduce.ts";
import { flagged, inPlay, modifierActive, type ScenarioState } from "../rules/state.ts";

import { engagesAt } from "./foresight.ts";
import type { IconName } from "./icon-map.ts";
import { stagePoints } from "./objective.ts";

export type BadgeStat = "willpower" | "attack" | "defense" | "hitPoints" | "threat" | "questPoints" | "engagementCost";

// A printed number an effect changed: its icon, the engine's value now and how far it is from the printed one. `lasting`
// when every effect behind it ends with the phase, the round or the attack (the forest spider's +1 until the end of the
// round), so the pill shows it will go (rr.lasting-effects).
export type StatBadge = { stat: BadgeStat; icon: IconName; word: string; value: number; delta: number; lasting: boolean };

export type FlagStat = "cannotAttack" | "cannotTakeDamage" | "cannotTakeNonCombatDamage" | "cannotBeEngaged" | "cannotBeOptionallyEngaged";

// A "cannot" an effect put on the card, with the icon of the thing it cannot do.
export type FlagBadge = { flag: FlagStat; icon: IconName; word: string };

export type CardEffects = { stats: readonly StatBadge[]; flags: readonly FlagBadge[] };

const STAT_ICON: Readonly<Record<BadgeStat, IconName>> = {
  willpower: "willpower",
  attack: "attack",
  defense: "defense",
  hitPoints: "hitPoints",
  threat: "threat",
  questPoints: "questPoints",
  engagementCost: "engagementCost",
};

const STAT_WORD: Readonly<Record<BadgeStat, string>> = {
  willpower: "Willpower",
  attack: "Attack",
  defense: "Defense",
  hitPoints: "Hit points",
  threat: "Threat",
  questPoints: "Quest points",
  engagementCost: "Engagement cost",
};

const FLAGS: readonly { flag: FlagStat; icon: IconName; word: string }[] = [
  { flag: "cannotAttack", icon: "attack", word: "Cannot attack" },
  { flag: "cannotTakeDamage", icon: "hitPoints", word: "Takes no damage" },
  { flag: "cannotTakeNonCombatDamage", icon: "hitPoints", word: "Takes only combat damage" },
  { flag: "cannotBeEngaged", icon: "engagementCost", word: "Cannot be engaged" },
  { flag: "cannotBeOptionallyEngaged", icon: "engagementCost", word: "Cannot be optionally engaged" },
];

// The numbers a card of this type prints, in the order the card shows them.
function statsOf(printed: PrintedCard): readonly BadgeStat[] {
  switch (printed.type) {
    case "enemy":
      return ["engagementCost", "threat", "attack", "defense", "hitPoints"];
    case "location":
      return ["threat", "questPoints"];
    case "quest":
      return ["questPoints"];
    default:
      return printed.willpower != null || printed.attack != null || printed.defense != null ? ["willpower", "attack", "defense", "hitPoints"] : [];
  }
}

function printedValue(printed: PrintedCard, stat: BadgeStat): number | null {
  return stat === "hitPoints" ? (printed.health ?? null) : (printed[stat] ?? null);
}

// A card's edge shows this many effect pills, then "+n" for the rest (the preview lists all of them).
export const BADGE_CAP = 2;

/** How many of `total` effect pills are drawn and how many hide behind "+n", given the rows that fit on the card's edge. */
export function badgeSplit(total: number, room: number): { shown: number; hidden: number } {
  const fit = Math.max(1, room);
  if (total <= Math.min(BADGE_CAP, fit)) return { shown: total, hidden: 0 };
  const shown = Math.min(BADGE_CAP, fit - 1);
  return { shown, hidden: total - shown };
}

// What the table reads for a card, worked out once per state object (the state is never changed in place), so a canvas that
// redraws on every game change asks the engine once for each card shown. `key` is the card, and the seat for numbers drawn against one.
const EFFECTS = new WeakMap<ScenarioState, WeakMap<ReduceContext, Map<string, CardEffects>>>();
const SLOTS = new WeakMap<ScenarioState, WeakMap<ReduceContext, Map<string, SlotNumbers>>>();

function cached<T>(memo: WeakMap<ScenarioState, WeakMap<ReduceContext, Map<string, T>>>, game: ScenarioState, ctx: ReduceContext, key: string, build: () => T): T {
  let byCtx = memo.get(game);
  if (!byCtx) memo.set(game, (byCtx = new WeakMap()));
  let known = byCtx.get(ctx);
  if (!known) byCtx.set(ctx, (known = new Map()));
  if (known.has(key)) return known.get(key) as T;
  const built = build();
  known.set(key, built);
  return built;
}

/** The effects on one card in play now: changed numbers and "cannot"s. Empty for a card out of play or face down. */
export function cardEffects(game: ScenarioState, ctx: ReduceContext, cardId: string): CardEffects {
  return cached(EFFECTS, game, ctx, cardId, () => effectsOnCard(game, ctx, cardId));
}

function effectsOnCard(game: ScenarioState, ctx: ReduceContext, cardId: string): CardEffects {
  const card = game.cards[cardId];
  if (!card || !inPlay(card.zone) || card.face === "down") return { stats: [], flags: [] };
  const printed = printedOf(ctx.cards, card.code);
  const stats: StatBadge[] = [];
  for (const stat of statsOf(printed)) {
    const base = printedValue(printed, stat);
    if (base == null) continue;
    const value = modifiedStat(game, card, stat, ctx.cards);
    if (value === base) continue;
    const behind = game.modifiers.filter((modifier) => modifier.stat === stat && heldBy(modifier, card, printed) && modifierActive(game, modifier));
    const lasting = behind.length > 0 && behind.every((modifier) => TEMPORARY.has(modifier.until));
    stats.push({ stat, icon: STAT_ICON[stat], word: STAT_WORD[stat], value, delta: value - base, lasting });
  }
  const flags = FLAGS.filter((entry) => flagged(game, cardId, entry.flag));
  return { stats, flags };
}

// The effects that end on their own with a phase, a round or an attack.
const TEMPORARY: ReadonlySet<ModifierUntil> = new Set(["endOfPhase", "endOfRound", "endOfAttack"]);

const UNTIL: Readonly<Record<ModifierUntil, string>> = {
  endOfPhase: "until the end of the phase",
  endOfRound: "until the end of the round",
  endOfAttack: "until the end of the attack",
  whileSourceInPlay: "while it is in play",
  whileSourceInVictory: "while it is in the victory display",
};

const NUMBER_WORD: Partial<Record<ModifierStat, string>> = { ...STAT_WORD };

/**
 * The effects on the card in words, each naming the card it comes from: "+1 Attack from Dagger of Westernesse, while it is in
 * play". For the preview. An effect that holds only against some enemies is named once its number shows on the card.
 */
export function effectLines(game: ScenarioState, ctx: ReduceContext, cardId: string, cardName: (id: string) => string): readonly string[] {
  const card = game.cards[cardId];
  if (!card) return [];
  const printed = printedOf(ctx.cards, card.code);
  const shown = cardEffects(game, ctx, cardId);
  const lines: string[] = [];
  for (const modifier of game.modifiers) {
    if (!heldBy(modifier, card, printed) || !modifierActive(game, modifier)) continue;
    const source = modifier.sourceId === cardId ? "its own text" : cardName(modifier.sourceId);
    const word = NUMBER_WORD[modifier.stat];
    if (word) {
      // A conditional modifier counts only when its number shows.
      if (modifier.when && !shown.stats.some((badge) => badge.stat === modifier.stat)) continue;
      const amount = modifier.set ? `${word} is ${modifier.amount}` : `${modifier.amount >= 0 ? "+" : ""}${modifier.amount} ${word}`;
      lines.push(`${amount} from ${source}, ${UNTIL[modifier.until]}`);
      continue;
    }
    const flag = FLAGS.find((entry) => entry.flag === modifier.stat);
    if (flag && modifier.amount > 0) lines.push(`${flag.word}: ${source}, ${UNTIL[modifier.until]}`);
  }
  return lines;
}

// What a delayed effect will do, in words (rr.delayed-effects).
function delayedWords(verb: string): string {
  switch (verb) {
    case "ReturnToHand":
      return "returns to its owner's hand";
    case "ShuffleSelfIntoDeck":
      return "is shuffled into its owner's deck";
    case "EngageAll":
      return "each enemy in staging engages the first player";
    default:
      return "its effect resolves";
  }
}

// A delayed effect acts on its subject, or on its own source when it names none (rr.delayed-effects).
function actsOn(entry: ScenarioState["delayed"][number], cardId: string): boolean {
  return entry.subjectId === cardId || (entry.subjectId == null && entry.sourceId === cardId);
}

/** The delayed effects that will act on a card, in words: "At the end of this phase: returns to its owner's hand (Sneak Attack)". */
export function delayedLines(game: ScenarioState, cardId: string, cardName: (id: string) => string): readonly string[] {
  return game.delayed
    .filter((entry) => actsOn(entry, cardId))
    .map((entry) => {
      const when = entry.until === "endOfPhase" ? "At the end of this phase" : "At the end of the round";
      const what = entry.instructions.map((instruction) => delayedWords(instruction.verb)).join(", then ");
      const source = entry.sourceId && entry.sourceId !== cardId ? ` (${cardName(entry.sourceId)})` : "";
      return `${when}: ${what}${source}`;
    });
}

/**
 * The engine's numbers the canvas draws on one card: the effects on it, its willpower while it is committed to the quest,
 * the quest points of a quest stage or an active location, the engagement cost of an enemy in staging against the shown
 * seat's threat (rr.engagement-check: whether the checks would engage it with that seat now), and whether a
 * delayed effect will act on it.
 */
export function slotNumbers(game: ScenarioState, ctx: ReduceContext, cardId: string, seat = 0): SlotNumbers {
  return cached(SLOTS, game, ctx, `${seat}:${cardId}`, () => numbersOnSlot(game, ctx, cardId, seat));
}

function numbersOnSlot(game: ScenarioState, ctx: ReduceContext, cardId: string, seat: number): SlotNumbers {
  const card = game.cards[cardId];
  const effects = cardEffects(game, ctx, cardId);
  const questing = card != null && (card.zone === "questStage" || card.zone === "activeLocation" || card.zone === "secondActiveLocation" || card.zone === "seatQuest");
  const enemy = card != null && card.zone === "staging" && card.face !== "down" && printedOf(ctx.cards, card.code).type === "enemy";
  const cost = enemy ? engagementCostOf(game, card, ctx.cards) : null;
  return {
    effects,
    willpower: card?.committed ? modifiedStat(game, card, "willpower", ctx.cards) : null,
    // A stage that progress never defeats has no strip (objective.ts): "25 / 0" would read as a stage that should be won.
    questPoints: questing ? (card.zone === "questStage" ? stagePoints(game, card, ctx) : questPointsOf(game, card, ctx.cards)) : null,
    engagement: cost != null ? { cost, engages: engagesAt(game, ctx).get(cardId) === seat } : null,
    delayed: game.delayed.some((entry) => actsOn(entry, cardId)),
  };
}

export type SlotNumbers = {
  effects: CardEffects;
  willpower: number | null;
  questPoints: number | null;
  engagement: { cost: number; engages: boolean } | null;
  delayed: boolean;
};
