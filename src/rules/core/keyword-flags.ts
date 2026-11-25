// Rules: rr.attachment-cards, rr.surge, rr.doomed-x, rr.immune, mec109.immune-to-player-card-effects, hob.immune-to-player-card-effects, rr.ranged, rr.sentinel, mec109.peril, mec109.indestructible, hob.indestructible, mec109.toughness (data/rules/entries.json). What a card's keywords and flags say about it: Toughness, blank text, Immune, Indestructible, Unique and the keywords a card prints or gains.
import { textBlank } from "../families/attachments/hold.ts";
import { keywordsKept } from "../families/angmar/blank.ts";
import { isPlayerType, printedOf, type PrintedCard } from "./printed.ts";
import type { ScenarioState } from "./state.ts";
import { flagged, heldAmount } from "./state.ts";
import { inPlay } from "./zones.ts";

// The damage a card takes of `amount` once Toughness has reduced it (mec109.toughness): the printed keyword, and the Toughness the card holds from a card effect ("gains Toughness 2 until the end of the round", 143043:A:2).
export function toughnessOf(state: ScenarioState, id: string, printed: PrintedCard): number {
  return printed.type === "enemy" ? (printed.keywords.toughness ?? 0) + heldAmount(state, id, "toughness") : 0;
}

export function placedAmount(state: ScenarioState, id: string, printed: PrintedCard, amount: number): number {
  return Math.max(0, amount - toughnessOf(state, id, printed));
}

// Whether a card's printed keywords count: a card whose printed text box is blank has none of them, unless a keepsKeywords modifier says they stay (09054:A:1); one gained from another source stays (rr.blank).
export function printedKeywordsBlank(state: ScenarioState, id: string, cards: ReadonlyMap<string, PrintedCard>): boolean {
  return textBlank(state, id, cards) && !keywordsKept(state, id, cards);
}

// Immune to player card effects: printed, or gained while a card says so (`immuneToPlayerCards`, families/nightmare.ts, 906201:A:2).
// `source` is the printed player card whose effect it is, when known: "Immune to non-Fellowship player card effects" (`immuneToNonFellowship`, 144075:A:1) lets a Fellowship card's effect through. Every path a player card's effect takes (a pick, an attachment host, damage, the enemy list) asks this one predicate.
export function playerCardEffectCanChoose(printed: PrintedCard, state?: ScenarioState, id?: string, source?: PrintedCard | null): boolean {
  if (state && id && (flagged(state, id, "immuneToPlayerCards") || flagged(state, id, "immuneToCardEffects"))) return false;
  if (state && id && source && isPlayerType(source) && source.sphere !== "fellowship" && flagged(state, id, "immuneToNonFellowship")) return false;
  return !printed.keywords.immuneToPlayerCardEffects;
}

/** The printed card behind an effect's source, for playerCardEffectCanChoose. */
export function sourcePrinted(state: ScenarioState, cards: ReadonlyMap<string, PrintedCard>, sourceId: string | null | undefined): PrintedCard | null {
  const card = sourceId ? state.cards[sourceId] : undefined;
  return card ? printedOf(cards, card.code) : null;
}

/** Whether an effect from `sourceId` is an encounter card effect: a card that is neither a player card nor a quest or campaign card (a quest card's effect is not an encounter card's, "Unique locations cannot be discarded from play by encounter card effects", 12193:B:1). */
export function isEncounterCardEffect(state: ScenarioState, cards: ReadonlyMap<string, PrintedCard>, sourceId: string | null): boolean {
  const source = sourceId ? state.cards[sourceId] : undefined;
  if (!source || isPlayerCardEffect(state, cards, sourceId)) return false;
  const type = printedOf(cards, source.code).type;
  return type !== "quest" && type !== "campaign";
}

/** Whether an effect from `sourceId` is a player card effect: a player card without an encounter back, or no card at all (a choice a player makes). An ally with an encounter back is an encounter card and has encounter card effects (dcce.encounter-cards). */
export function isPlayerCardEffect(state: ScenarioState, cards: ReadonlyMap<string, PrintedCard>, sourceId: string | null): boolean {
  const source = sourceId ? state.cards[sourceId] : undefined;
  if (!source) return true;
  const printed = printedOf(cards, source.code);
  return isPlayerType(printed) && printed.backType !== "encounter";
}

// An enemy with the Indestructible keyword, unless a card took its keywords away (`losesKeywords`, The Great Bridge, 142050:A:2), or only its Indestructible (`losesIndestructible`, 50931:B:1).
export function indestructible(state: ScenarioState, id: string, printed: PrintedCard): boolean {
  return printed.type === "enemy" && (printed.keywords.indestructible || flagged(state, id, "indestructible")) && !flagged(state, id, "losesKeywords") && !flagged(state, id, "losesIndestructible");
}

export function uniqueBlocked(
  state: ScenarioState,
  printed: PrintedCard,
  cards: ReadonlyMap<string, PrintedCard>,
): boolean {
  if (!printed.isUnique) return false;
  for (const instance of Object.values(state.cards)) {
    if (!inPlay(instance.zone)) continue;
    const other = cards.get(instance.code);
    if (other?.isUnique && other.name === printed.name) return true;
  }
  return false;
}

// A keyword a card prints or has gained: a flag modifier of the same name ("Attached hero gains sentinel", rr.sentinel,
// rr.ranged).
export function hasKeyword(state: ScenarioState, id: string, keyword: "sentinel" | "ranged" | "restricted" | "doomed" | "surge" | "ambush" | "gainedAmbush", cards: ReadonlyMap<string, PrintedCard>): boolean {
  const instance = state.cards[id];
  if (!instance) return false;
  // Ambush a card gave the enemy (`gainsAmbush`, dwd.ambush; Goblin Gate 04043:A:1), in addition to a printed one.
  if (keyword === "gainedAmbush") return flagged(state, id, "gainsAmbush");
  if (keyword === "ambush" && flagged(state, id, "gainsAmbush")) return true;
  const printed = printedOf(cards, instance.code);
  const blank = printedKeywordsBlank(state, id, cards);
  if (keyword === "doomed") return !blank && (printed.keywords.doomed ?? 0) > 0;
  if (keyword === "ranged" && flagged(state, id, "loseRanged")) return false;
  if (keyword === "sentinel" && flagged(state, id, "loseSentinel")) return false;
  if (!blank && printed.keywords[keyword]) return true;
  return (keyword === "sentinel" || keyword === "ranged") && flagged(state, id, keyword);
}
