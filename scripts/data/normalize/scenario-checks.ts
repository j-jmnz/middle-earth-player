import type { Card } from "../../../src/catalog/card-facts.ts";
import type { Placement } from "../../../src/catalog/scenario-data.ts";
import type { ProductDef, ScenarioDef } from "../campaign-defs.ts";
import type { RawData } from "./load-raw.ts";
import { sameName, titleKey } from "./names.ts";
import { clausesOf, type ParsedSetup } from "./setup-text.ts";

// A DragnCards pre-built deck: the load list (Q0C) or a check deck (Q01, Q00).
export type Deck = { label: string; cards: { databaseId: string; quantity: number; loadGroupId: string }[] };

// The load group of a deck's player cards (the heroes and the Ring-bearer's attachments).
export const PLAYER_GROUP = "player1Play1";

// "the Journey in the Dark encounter set" and "The Ring Goes South" name the same set.
export const plain = (name: string): string => name.replace(/^the /i, "").replaceAll("’", "'").replaceAll("\u2011", "-").toLowerCase();

// The Easy Mode sheet's list of the cards to remove from each Core Set encounter set (easy-mode.core-set):
// "Dol Guldur Orcs / 1x Chieftain Ufthak / ..." and "Passage Through Mirkwood / None". Set name -> card name -> copies.
export function easyRemovals(text: string): Map<string, Map<string, number>> {
  const sets = new Map<string, Map<string, number>>();
  let heading: string[] = [];
  let current: Map<string, number> | null = null;
  for (const raw of text.split("\n")) {
    const line = raw.trim().replaceAll("’", "'");
    if (line === "" || line === "Core Set") continue;
    const card = /^(\d+)x (.+)$/.exec(line);
    if (!card && line !== "None") {
      heading.push(line);
      continue;
    }
    if (heading.length > 0) {
      current = new Map();
      sets.set(plain(heading.join(" ")), current);
      heading = [];
    }
    if (card?.[1] && card[2]) current?.set(card[2].toLowerCase(), Number(card[1]));
  }
  return sets;
}

// The Easy Mode sheet lists what Easy removes from each Core Set encounter set, which the Revised Core Set reprints: the printed
// removal settles Hall of Beorn's Easy count. (DragnCards' 2011 decks are the other cross-check, `crossCheckProblems`.) Only a
// product with `easySheet` is checked. The sheet spells a name as printed ("Chieftain Ufthak"); the card itself prints
// "Chieftan Ufthak" (a misprint on the card, ledger 01090.A), so names match loosely.
export function easySheetProblem(
  scenario: string,
  product: ProductDef,
  item: { Title: string; NormalQuantity: number; EasyQuantity: number },
  card: Card,
  removals: ReadonlyMap<string, ReadonlyMap<string, number>>,
  canon: (name: string) => string,
): string | null {
  if (!product.easySheet) return null;
  const sheet = removals.get(canon(card.encounterSet ?? ""));
  if (!sheet) return null;
  const removed = [...sheet].find(([name]) => sameName(name, card.name))?.[1] ?? 0;
  const removes = item.NormalQuantity - item.EasyQuantity;
  return removes === removed ? null : `${scenario}: ${item.Title} Easy removes ${removes}, the Easy Mode sheet removes ${removed}`;
}

// DragnCards' decks (`def.crossCheck`) are a cross-check where a deck of the same cards exists: every card's copies, Normal and
// Easy, compared by card name. It compares copy counts only, not which pile a copy is in.
export function crossCheckProblems(
  def: ScenarioDef,
  decks: Readonly<Record<string, Deck>>,
  dragn: RawData["dragn"],
  placed: readonly Placement[],
  nameOf: (code: string) => string,
): string[] {
  const problems: string[] = [];
  if (!def.crossCheck) return problems;
  for (const [difficulty, key] of [["normal", def.crossCheck.normal], ["easy", def.crossCheck.easy]] as const) {
    const deck = decks[key];
    if (!deck) {
      problems.push(`${def.id}: DragnCards has no ${key} deck to cross-check`);
      continue;
    }
    const theirs = new Map<string, number>();
    for (const line of deck.cards) {
      if (line.loadGroupId === "sharedQuestDeck" || line.loadGroupId === PLAYER_GROUP) continue;
      const name = titleKey(dragn.get(line.databaseId)?.name ?? "");
      theirs.set(name, (theirs.get(name) ?? 0) + line.quantity);
    }
    const ours = new Map<string, number>();
    for (const item of placed) {
      if (item.pile === "quest") continue;
      const name = titleKey(nameOf(item.code));
      ours.set(name, (ours.get(name) ?? 0) + (difficulty === "normal" ? item.normal : item.easy));
    }
    for (const name of new Set([...theirs.keys(), ...ours.keys()])) {
      if ((theirs.get(name) ?? 0) !== (ours.get(name) ?? 0)) problems.push(`${def.id}: ${name} ${difficulty} ${ours.get(name) ?? 0}, DragnCards ${key} ${theirs.get(name) ?? 0}`);
    }
  }
  return problems;
}

// A campaign card that removes the burdens of named burden sets (mec112.setup-*) names sets some burden card of the catalog bears.
export function burdenSetProblems(id: string, setup: ParsedSetup, cards: readonly Card[], canon: (name: string) => string): string[] {
  const known = new Set(cards.filter((card) => card.campaignKind === "burden" && card.burdenSet != null).map((card) => canon(card.burdenSet ?? "")));
  return clausesOf(setup, "step")
    .filter((clause) => clause.step === "removeBurdens")
    .flatMap((clause) => (clause.sets ?? []).filter((name) => !known.has(canon(name))).map((name) => `${id}: the Setup removes the burdens of ${name}, which no burden card bears`));
}
