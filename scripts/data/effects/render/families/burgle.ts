// The burgle family's pieces (src/catalog/families/burgle.ts, The Lonely Mountain): templates for its verbs and conditions, the words of its stat flags and the samples read-fields.test.ts checks them with.
import { str, type Ctx, type Obj } from "../kit.ts";
import { renderAmount } from "../amounts.ts";
import { renderPick } from "../picks.ts";

type Made = { text: string; read: readonly string[] };
const amount = (value: unknown, ctx: Ctx): string => renderAmount(value, ctx, renderPick);
const MATCH: Readonly<Record<string, string>> = { sphere: "sphere", type: "card type", cost: "printed cost" };
const list = (values: unknown): string => (Array.isArray(values) ? values.map((value) => MATCH[str(value)] ?? str(value)).join(" and ") : "?");

export const BURGLE_TEMPLATES: Readonly<Record<string, (i: Obj, ctx: Ctx) => Made>> = {
  BurgleAttempt: () => ({
    text: "the first player makes a burgle attempt: he discards encounter cards from the top (none is revealed) until one with a burgle effect is discarded; he shuffles his deck and reveals its top card (it stays on the deck), the players take actions once; then he discards the cards that card's burgle effect asks from his hand, or the attempt fails (a failed attempt is announced as burgleFailed)",
    read: [],
  }),
  BurgleEffect: (i) => ({ text: `(burgle effect, read only when a burgle attempt stops at this card) the first player may discard exactly ${str(i.discard)} card${i.discard === 1 ? "" : "s"} from his hand that match the revealed card's ${list(i.match)} (an X cost matches nothing; both must match when two are named)`, read: ["discard", "match"] }),
  BurgleTake: () => ({ text: "while a burgle attempt is in its action window, the revealed card goes into the first player's hand and the next card of his deck is revealed (with none left the attempt fails)", read: [] }),
  StackUnder: (i) => ({ text: `the set-aside cards with codes ${Array.isArray(i.codes) ? i.codes.map((code) => str(code)).join(", ") : "?"} are shuffled and stacked facedown, out of play, under the card in play with code ${str(i.under)}`, read: ["codes", "under"] }),
  TakeStacked: (i) => ({ text: `the first player takes the top card stacked under the card in play with code ${str(i.under)} into his hand (nothing when none is stacked)`, read: ["under"] }),
  FirstTreacherySurge: () => ({ text: "(marker, read while this card's record holds) the first treachery card revealed each round gains surge as it is revealed", read: [] }),
  DiscardRandomRaiseThreat: (i) => ({ text: `each player, the first player first, discards ${str(i.amount)} cards at random from his hand; until the end of the phase each ${str(i.trait)} enemy in play (in the staging area or engaged) gets +1 Threat for each ${str(i.cardType)} so discarded, by all the players together`, read: ["amount", "cardType", "trait"] }),
  AttackHighestWillpower: () => ({ text: "the picked enemy in the staging area makes an immediate attack against the player with the highest total Willpower committed to the quest (a tie: the first player chooses), with no shadow card dealt", read: [] }),
  SpendBaggins: (i, ctx) => ({ text: `the acting player spends ${amount(i.amount, ctx)} resources from the pools of his heroes with a Baggins icon (nothing is spent when they hold fewer)`, read: ["amount"] }),
};

export const BURGLE_CONDITIONS: Readonly<Record<string, (c: Obj, ctx: Ctx) => Made>> = {
  burgleSucceeded: () => ({ text: "the last burgle attempt the running effect made succeeded (false before it has made one)", read: [] }),
  burgleFailed: () => ({ text: "the last burgle attempt the running effect made failed (false before it has made one)", read: [] }),
  burgling: () => ({ text: "a burgle attempt is in its action window (after its second step, before its third) and the actor is the first player", read: [] }),
  burgleCanDiscard: () => ({ text: "the first player's hand holds as many cards matching the revealed card as the burgle effect asks", read: [] }),
  shadowBurgle: () => ({ text: "the shadow card just dealt has a burgle effect", read: [] }),
  bagginsAtLeast: (c, ctx) => ({ text: `the acting player's heroes with a Baggins icon hold at least ${amount(c.amount, ctx)} resources in all`, read: ["amount"] }),
  encounterTop: (c) => ({ text: `the top card of the encounter deck is ${c.cardType === "enemy" ? "an" : "a"} ${str(c.cardType)} (false with an empty deck)`, read: ["cardType"] }),
};

// The plain words a stat flag of the family adds after its name.
export const BURGLE_STAT_NOTES: Readonly<Record<string, string>> = {
  threatHalved: " (its Threat is halved, rounded up, after the additive modifiers)",
  firstTreacheryNoted: " (a treachery was revealed this round: the round's first has had its chance to gain surge)",
};

// Samples that set every field a template here reads (read-fields.test.ts): removing one must change the text.
export const BURGLE_SAMPLES: Readonly<Record<string, readonly Obj[]>> = {
  BurgleAttempt: [{ verb: "BurgleAttempt" }],
  BurgleEffect: [{ verb: "BurgleEffect", discard: 2, match: ["sphere", "cost"] }, { verb: "BurgleEffect", discard: 1, match: ["type"] }],
  BurgleTake: [{ verb: "BurgleTake" }],
  StackUnder: [{ verb: "StackUnder", codes: ["1", "2"], under: "3" }],
  TakeStacked: [{ verb: "TakeStacked", under: "3" }],
  FirstTreacherySurge: [{ verb: "FirstTreacherySurge" }],
  DiscardRandomRaiseThreat: [{ verb: "DiscardRandomRaiseThreat", amount: 2, cardType: "event", trait: "Dragon" }],
  AttackHighestWillpower: [{ verb: "AttackHighestWillpower" }],
  SpendBaggins: [{ verb: "SpendBaggins", amount: 2 }],
};

export const BURGLE_CONDITION_SAMPLES: Readonly<Record<string, readonly Obj[]>> = {
  burgleSucceeded: [{ kind: "burgleSucceeded" }],
  burgleFailed: [{ kind: "burgleFailed" }],
  burgling: [{ kind: "burgling" }],
  burgleCanDiscard: [{ kind: "burgleCanDiscard" }],
  shadowBurgle: [{ kind: "shadowBurgle" }],
  bagginsAtLeast: [{ kind: "bagginsAtLeast", amount: 3 }],
  encounterTop: [{ kind: "encounterTop", cardType: "enemy" }, { kind: "encounterTop", cardType: "location" }],
};
