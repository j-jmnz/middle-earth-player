// Rules: rr.keywords, rr.blank, rr.sentinel, rr.ranged, rr.surge, mec109.indestructible, mec109.toughness, mec109.archery, mec113.phantom (data/rules/entries.json).
//
// A card's keywords as they stand now, for the table's card preview: the printed ones, the ones a card effect gives (Sentinel, Ranged, Surge,
// Toughness, Archery, Immune, Phantom), and the printed ones an effect or a blank text box takes away. Every reading goes through the engine's own
// reader where it has one (hasKeyword, hasPhantom, indestructible, playerCardEffectCanChoose, heldAmount); this file only puts the answers in a list.
import { cardArchery } from "../../rules/combat/combat.ts";
import { isLostIsland } from "../../rules/families/uncharted/pick.ts";
import { hasPhantom } from "../../rules/families/grey-company/phantom.ts";
import { hasKeyword, indestructible, playerCardEffectCanChoose, printedKeywordsBlank, toughnessOf } from "../../rules/core/keywords.ts";
import { printedOf } from "../../rules/core/printed.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";
import { flagged, heldAmount } from "../../rules/core/state.ts";

import { KEYWORD_RULES, type KeywordKey } from "./keyword-rules.ts";

/** One keyword chip: its key in KEYWORD_RULES, the word with its value now ("Archery 2"), and whether an effect has taken it away (drawn struck through). */
export type CardKeyword = { key: KeywordKey; word: string; lost: boolean };

// Keywords with a printed flag or value and no reader of their own: shown while the text counts, struck through when the card lost its keywords.
const PRINTED_FLAGS = ["peril", "permanent", "battle", "siege", "sailing", "dire"] as const;
const PRINTED_VALUES = ["hide", "secrecy", "boarding", "aflame"] as const;

/** The card's keywords now, in KEYWORD_RULES' order. Empty for a card that is not in the game. */
export function cardKeywords(game: ScenarioState, ctx: ReduceContext, cardId: string): CardKeyword[] {
  const instance = game.cards[cardId];
  if (!instance) return [];
  const printed = printedOf(ctx.cards, instance.code);
  const kw = printed.keywords;
  // A blank text box has none of its printed keywords unless a modifier keeps them (rr.blank); a card that lost its keywords has none of the printed ones.
  const usable = !printedKeywordsBlank(game, cardId, ctx.cards);
  const lostAll = flagged(game, cardId, "losesKeywords");
  const found = new Map<KeywordKey, CardKeyword>();
  const add = (key: KeywordKey, lost: boolean, value?: number) => {
    found.set(key, { key, word: value == null || value <= 0 ? KEYWORD_RULES[key].word : `${KEYWORD_RULES[key].word} ${value}`, lost });
  };
  // A printed keyword: drawn while the text counts, struck through when the card lost its keywords.
  const shown = (key: KeywordKey, has: boolean, value?: number) => {
    if (has && usable) add(key, lostAll, value);
  };

  for (const key of PRINTED_FLAGS) shown(key, kw[key] === true);
  for (const key of PRINTED_VALUES) shown(key, (kw[key] ?? 0) > 0, kw[key] ?? undefined);
  // Uncharted is on the Lost Island side only (dcce.uncharted); the charted side of a double-sided location has none.
  shown("uncharted", isLostIsland(instance, ctx));
  shown("grapple", kw.grapple != null);
  shown("doomed", (kw.doomed ?? 0) > 0, kw.doomed ?? undefined);
  shown("restricted", kw.restricted);

  if (heldAmount(game, cardId, "gainsSurge") > 0) add("surge", false);
  else shown("surge", kw.surge);

  // Sentinel and Ranged: the engine's reader says whether the card has it now; one the card prints and does not have now is struck through.
  for (const key of ["sentinel", "ranged"] as const) {
    const now = hasKeyword(game, cardId, key, ctx.cards);
    if (now && flagged(game, cardId, key)) add(key, false);
    else if (kw[key] && usable) add(key, lostAll || !now);
  }

  // A number a card effect adds to the printed one: Archery and Toughness show their sum.
  const { keyword, own } = cardArchery(game, ctx.cards, instance);
  const archery = keyword - (kw.archery ?? 0) + own;
  if (archery > 0) add("archery", false, (usable ? (kw.archery ?? 0) : 0) + archery);
  else shown("archery", (kw.archery ?? 0) > 0, kw.archery ?? undefined);
  const toughness = toughnessOf(game, cardId, printed) - (printed.type === "enemy" ? (kw.toughness ?? 0) : 0);
  if (toughness > 0) add("toughness", false, (usable ? (kw.toughness ?? 0) : 0) + toughness);
  else shown("toughness", (kw.toughness ?? 0) > 0, kw.toughness ?? undefined);

  if (indestructible(game, cardId, printed)) add("indestructible", false);
  else shown("indestructible", kw.indestructible);
  if (!playerCardEffectCanChoose(printed, game, cardId)) add("immune", false);
  else shown("immune", kw.immuneToPlayerCardEffects);
  if (hasPhantom(game, cardId, ctx)) add("phantom", false);
  else if (kw.phantom && usable) add("phantom", true);

  return (Object.keys(KEYWORD_RULES) as KeywordKey[]).flatMap((key) => found.get(key) ?? []);
}
