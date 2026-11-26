// The Dread Realm's verbs (src/catalog/families/angmar.ts): Reanimated Dead, the cards that deal themselves as shadow cards and the Wraith and Possession that attach.
import { cardRef, renderAmount } from "../amounts.ts";
import { str, type Ctx, type Obj } from "../kit.ts";
import { renderPick } from "../picks.ts";

type Made = { text: string; read: readonly string[] };
const amount = (value: unknown, ctx: Ctx): string => renderAmount(value, ctx, renderPick);

export const ANGMAR_TEMPLATES: Readonly<Record<string, (i: Obj, ctx: Ctx) => Made>> = {
  RemoveTimeCounters: (i, ctx) => {
    const read = ["target", "amount", "perPlayer", "distribute", "left"];
    if (i.target == null) return { text: "one time counter comes off each card in play with Time X (the end of the refresh phase, after its Forced effects); a card whose last counter goes hears it", read };
    const count = typeof i.amount === "object" ? amount(i.amount, ctx) : str(i.amount ?? 1);
    const counters = `${count} time counter${i.amount === 1 || i.amount == null ? "" : "s"}${i.perPlayer === true ? " for each player still in the game" : ""}`;
    if (i.distribute !== undefined) return { text: `${counters} come off the locations in play (staging area and active location) that hold some, the ${i.distribute === "firstPlayer" ? "first player" : "acting player"} choosing the location one counter at a time (a single location is taken without asking), stopping when none is left; a location whose last counter goes hears it${i.left === undefined ? "" : `; ${str(i.left)} still to go`}`, read };
    if (i.target === "locations" || i.target === "active") return { text: `${counters} come off ${i.target === "active" ? "the active location, if it holds any" : "each location in play (staging area and active location) that holds some"}, one at a time, stopping when none is left; a location whose last counter goes hears it, after the effect resolves`, read };
    const who = i.target === "picked" ? "the last picked card (an enemy with Time X; a card with no Time loses none)" : "each enemy in play with Time X";
    return { text: `${counters} come off ${who}, one at a time, stopping when none is left; a card whose last counter goes hears it once`, read };
  },
  PlaceTimeCounters: (i) => ({ text: `each location in play (staging area or active) with the Time X keyword and no time counter (${str(i.target)}) gets its printed X time counters, as a revealed one does`, read: ["target"] }),
  Reanimate: (i, ctx) => {
    const seats: Readonly<Record<string, string>> = { firstPlayer: "the first player", controller: "that ally's controller", defending: "the defending player" };
    const seat = seats[str(i.who)] ?? "the acting player";
    const from: Readonly<Record<string, string>> = {
      deckTop: i.count === undefined ? "the top card of their deck" : typeof i.count === "number" ? `the top ${i.count} card(s) of their deck` : `the top X card(s) of their deck, X being ${amount(i.count, ctx)}`,
      handRandom: "a random card of their hand (chosen with the game's seed)",
      discardTop: "the card on top of their discard pile, if it is an ally that this effect just discarded from the top of a deck",
      card: `${cardRef(i.card ?? "picked")}, if it lies in a discard pile`,
      destroyed: "the character the attack in progress destroyed, if it lies in a discard pile",
    };
    return {
      text: `${seat} reanimates ${from[str(i.from)] ?? str(i.from)}: each is placed facedown ${i.to === "staging" ? "in the staging area" : "in front of them as if it had just engaged them (their engaged Responses hear it)"} and acts as an Undead enemy (0 engagement cost, 2 Threat, 2 Attack, 2 Defense, 2 hit points, no text) until it leaves play for its owner's discard pile; each is the picked card afterward`,
      read: ["from", "count", "card", "who", "to"],
    };
  },
  ResolveWhenRevealedOf: (i) => {
    const titled = typeof i.name === "string";
    return {
      text: i.of === "heldShadows" ? `the "when revealed" effects of each ${titled ? `shadow card titled ${str(i.name)}` : `${str(i.trait)} shadow card`} dealt to this enemy resolve, in the order dealt, the defending player revealing them (after the shadow effects)` : i.of === "looked" ? `the "when revealed" effects of each ${titled ? `copy of ${str(i.name)}` : `${str(i.trait)} card`} this effect discarded from the top of the encounter deck resolve, in the order discarded, the acting player revealing them` : `the "when revealed" effects of the ${titled ? str(i.name) : str(i.trait)} cards named by ${str(i.of)} resolve`,
      read: ["of", "trait", "name"],
    };
  },
  DealSourceAsShadow: () => ({ text: "this card, out of play, is dealt facedown as a shadow card to the card the effect picked last, an enemy in play (with no progress or damage on it; nothing when no enemy is picked)", read: [] }),
  AttachEnemyToPicked: (i) => ({
    text: `${i.returns === "discard" ? "this enemy" : "this enemy, out of play,"} attaches to ${i.to === "other" ? "the event's other card (the defending character, when there was one and it is still in play)" : "the picked card"} as an attachment: it has no enemy text there and ${i.returns === "discard" ? "is discarded to the encounter discard pile with it when that card leaves play (it is no enemy while it lies there)" : "returns to the staging area as an enemy when that card leaves play"}`,
    read: ["to", "returns"],
  }),
};
