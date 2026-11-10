import type { RingsDbCard } from "../../../src/catalog/boundary.ts";
import { deckLegal } from "../../../src/catalog/deck-legal.ts";
import { PRODUCTS, type ReprintDef } from "../campaign-defs.ts";
import type { HobCard } from "../sources/hallofbeorn.ts";
import { titleKey } from "./names.ts";

// Matching a RingsDB card to its Hall of Beorn record, and pairing a reprint box's cards with their twins in the adventure packs.

// Hall of Beorn's type names for the RingsDB deck-legal types.
const PLAYER_TYPE_BY_HOB: Readonly<Record<string, string>> = {
  Hero: "hero",
  Ally: "ally",
  Attachment: "attachment",
  Event: "event",
  Contract: "contract",
  Player_Side_Quest: "player-side-quest",
};

// Hall of Beorn's RingsDbCardId is not unique: the Nightmare decks, The Dark of Mirkwood and the hero and campaign
// expansions reuse the codes of the cycle they belong to (02004 is Winged Guardian and also Forest Flies), and The
// Mountain of Fire swaps three. A record is the same card only when the title matches and, for a deck-legal card, the
// type and the sides do: a player card prints a side B only when its own text says Side A (contracts, Sméagol), and a
// shadow effect only with the Encounter keyword.
export function sameCard(card: RingsDbCard, hob: HobCard): boolean {
  if (titleKey(hob.Title) !== titleKey(card.name)) return false;
  if (!deckLegal(card.type_code, card.type_name)) return true;
  const encounter = hob.Front.Keywords.some((keyword) => /^Encounter\.?$/i.test(keyword.trim()));
  return PLAYER_TYPE_BY_HOB[hob.CardType] === card.type_code && (!hob.Back || /\bSide A\b/.test(card.text ?? "")) && (!hob.Front.Shadow?.trim() || encounter);
}

function twinKey(card: HobCard): string {
  return `${card.Title}\u0000${card.CardType}`;
}

// A reprint card (a saga box's, MEC109 or MEC112) and its twin in the box's adventure packs share a title and type. Several of each (Frodo,
// Pursued by the Enemy) pair up in campaign order, then collector number. The twins are those of the one reprint: a title the two saga boxes
// both print (Aragorn, Frodo Baggins, The One Ring, Gollum) pairs within its own box.
export function pairTwins(box: readonly HobCard[], twins: readonly HobCard[], setOrder: readonly string[]): Map<HobCard, HobCard> {
  const order = (a: HobCard, b: HobCard) => setOrder.indexOf(a.CardSet) - setOrder.indexOf(b.CardSet) || a.Number - b.Number;
  const groups = new Map<string, { box: HobCard[]; twins: HobCard[] }>();
  for (const [list, side] of [[box, "box"], [twins, "twins"]] as const) {
    for (const card of list) {
      const group = groups.get(twinKey(card)) ?? { box: [], twins: [] };
      group[side].push(card);
      groups.set(twinKey(card), group);
    }
  }
  const pairs = new Map<HobCard, HobCard>();
  for (const group of groups.values()) {
    group.box.sort((a, b) => a.Number - b.Number);
    group.twins.sort(order);
    group.box.forEach((card, index) => {
      const twin = group.twins[index];
      if (twin) pairs.set(card, twin);
    });
  }
  return pairs;
}

// The Hall of Beorn sets of a reprint's twin products, in campaign order.
export function twinSetsOf(reprint: ReprintDef): string[] {
  return PRODUCTS.filter((product) => product.reprint?.set === reprint.set && product.twinPack !== null).map((product) => product.name);
}
