// Rules: rr.modifiers, rr.lasting-effects (data/rules/entries.json).
//
// What effects do to a card right now, so the table can show it on the card: each printed number an effect raised or
// lowered (the engine's value against the printed one), each "cannot" an effect put on it, and the effects themselves in
// words for the preview. The numbers are read with the engine's modifiedStat; nothing here adds one up.
import type { ModifierStat, ModifierUntil } from "../catalog/boundary.ts";
import { heldBy, modifiedStat } from "../rules/keywords.ts";
import { printedOf, type PrintedCard } from "../rules/printed.ts";
import { questPointsOf } from "../rules/quest.ts";
import type { ReduceContext } from "../rules/reduce.ts";
import { flagged, inPlay, modifierActive, type ScenarioState } from "../rules/state.ts";

import type { IconName } from "./icon-map.ts";

export type BadgeStat = "willpower" | "attack" | "defense" | "hitPoints" | "threat" | "questPoints" | "engagementCost";

// A printed number an effect changed: its icon, the engine's value now and how far it is from the printed one.
export type StatBadge = { stat: BadgeStat; icon: IconName; word: string; value: number; delta: number };

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

/** The effects on one card in play now: changed numbers and "cannot"s. Empty for a card out of play or face down. */
export function cardEffects(game: ScenarioState, ctx: ReduceContext, cardId: string): CardEffects {
  const card = game.cards[cardId];
  if (!card || !inPlay(card.zone) || card.face === "down") return { stats: [], flags: [] };
  const printed = printedOf(ctx.cards, card.code);
  const stats: StatBadge[] = [];
  for (const stat of statsOf(printed)) {
    const base = printedValue(printed, stat);
    if (base == null) continue;
    const value = modifiedStat(game, card, stat, ctx.cards);
    if (value !== base) stats.push({ stat, icon: STAT_ICON[stat], word: STAT_WORD[stat], value, delta: value - base });
  }
  const flags = FLAGS.filter((entry) => flagged(game, cardId, entry.flag));
  return { stats, flags };
}

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

/**
 * The engine's numbers the canvas draws on one card: the effects on it, its willpower while it is committed to the quest,
 * and the quest points of a quest stage or an active location.
 */
export function slotNumbers(game: ScenarioState, ctx: ReduceContext, cardId: string): { effects: CardEffects; willpower: number | null; questPoints: number | null } {
  const card = game.cards[cardId];
  const effects = cardEffects(game, ctx, cardId);
  const questing = card != null && (card.zone === "questStage" || card.zone === "activeLocation" || card.zone === "secondActiveLocation");
  return {
    effects,
    willpower: card?.committed ? modifiedStat(game, card, "willpower", ctx.cards) : null,
    questPoints: questing ? questPointsOf(game, card, ctx.cards) : null,
  };
}
