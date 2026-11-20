// The pieces The Wizard's Quest adds (the wizards-quest family and its fields): the Quick-build Setup, the search of the top of the encounter deck, the player cards held under an encounter card, the words of the search and pick fields that make "the opposing team" choose, and the samples read-fields.test.ts checks them with.
import { joinAnd, str, type Obj } from "./kit.ts";

type Made = { text: string; read: readonly string[] };

const codes = (value: unknown): string => joinAnd((Array.isArray(value) ? value : []).map(str));

/** The words a search says of its cost limit, its types and the top of the deck: " with a printed cost of N or less (M or less with two or more players)", " among the top 5 cards of the encounter deck". Empty when none of the fields is set. */
export function searchLimits(i: Obj): string {
  const cost = typeof i.maxCost === "number" ? ` with a printed cost of ${i.maxCost} or less${typeof i.maxCostMulti === "number" ? ` (${i.maxCostMulti} or less with two or more players)` : ""}` : "";
  return `${cost}${typeof i.top === "number" ? `, among the top ${i.top} cards of the encounter deck only` : ""}`;
}

/** What `byChallenge` says: nobody is asked, the engine picks the card that gives the players the greatest challenge. */
export function searchPolicy(i: Obj): string {
  return i.byChallenge === true ? "; the opposing team finds it, so nobody is asked: of enemies and locations the one with the highest printed Threat (enemies: then the highest Attack), then the one nearest the top of the deck; of any other card the one nearest the top" : "";
}

export const WIZARDS_QUEST_TEMPLATES: Readonly<Record<string, (i: Obj) => Made>> = {
  BuildQuickDeck: (i) => ({
    text: `the Quick-build: of the ${Array.isArray(i.sets) ? i.sets.length : 0} encounter sets named (${codes(i.sets)}) that the encounter deck holds, ${str(i.keep)} are picked with the game's seed and stay in the deck; the cards of the others lie set aside, out of play, all game`,
    read: ["sets", "keep"],
  }),
  ChooseQuestStage: (i) => ({ text: `the first player chooses one of the quest cards with codes ${codes(i.codes)} in the quest deck; the others lie set aside, out of play, and leave the quest's order`, read: ["codes"] }),
  SearchTopReveal: (i) => ({
    text: `the opposing team searches the top ${str(i.top)} cards of the encounter deck for the card nearest the top that costs ${i.maxCostStage === true ? "no more than the stage number of the main quest" : `${str(i.maxCost)} or less (${str(i.maxCostMulti)} or less with two or more players)`}, sets it aside, shuffles the encounter deck and reveals the card${i.cancelable === true ? "" : "; its When Revealed effects cannot be canceled"} (with no such card, only the shuffle)`,
    read: ["top", "maxCost", "maxCostMulti", "maxCostStage", "cancelable"],
  }),
  HoldPickedUnder: (i) => ({
    text:
      i.returnsExhausted === true
        ? "the last picked card (an ally in play) lies faceup under this card, its owner's still and out of play (it loses its tokens and its attachments are discarded); no copy of its title can be played while it lies there; once this card has left play, explored or not, it returns to its owner's control in play, exhausted"
        : i.barsPutting === true
        ? "the last picked card (an attachment in play, taken from its host) lies faceup under this card, its owner's still and out of play (it loses its tokens and its attachments are discarded); no copy of its title can be played or put into play while it lies there; it returns to its owner's hand when this card leaves play"
        : "the last picked card (an ally in play, or a card of a hand) lies faceup under this card, its owner's still and out of play (an ally in play loses its tokens and its attachments are discarded); no copy of its title can be played while it lies there; it returns to its owner's hand when this card leaves play",
    read: ["barsPutting", "returnsExhausted"],
  }),
  HideUnderQuest: (i) => ({
    text: `the opposing team searches the top ${str(i.top)} cards of the encounter deck for the card nearest the top that costs ${i.maxCostStage === true ? "no more than the stage number of the main quest" : "any amount"} and places it facedown under the main quest, then shuffles the encounter deck; after the next time the players quest successfully that card is revealed (with no such card, only the shuffle)`,
    read: ["top", "maxCostStage"],
  }),
  ArrangeTopByChallenge: () => ({ text: "the opposing team looks at the top 2 cards of the encounter deck and nobody is asked: the weaker goes to the bottom, the stronger stays on top (an enemy is stronger than a treachery and a treachery than a location; of two enemies or two locations the one with the higher printed Threat, an enemy then the higher Attack; level, the top card stays)", read: [] }),
  RemoveDefender: () => ({ text: "the defending character leaves the attack in progress, still exhausted, and cannot be declared as its defender again; the defending player may declare another defender, or none (the attack is then undefended)", read: [] }),
  SearchTopShadow: (i) => ({ text: `the opposing team searches the top ${str(i.top)} cards of the encounter deck and deals one to the attacking enemy as a shadow card, face down, not revealed, nobody being asked: an enemy of the highest Attack, else the card nearest the top; it resolves after the shadow card being resolved; the encounter deck is not shuffled`, read: ["top"] }),
  ReplacesRevealCancel: () => ({ text: "while this card is in play, the cancel of a 'when revealed' effect does not happen: this card is discarded instead (the ability that tried to cancel is still used)", read: [] }),
  BarHeldTitles: () => ({ text: "no card with the title of a card held under this one can be played (the bar is the engine's, HoldPickedUnder holds the cards)", read: [] }),
};

export const WIZARDS_QUEST_SAMPLES: Readonly<Record<string, readonly Obj[]>> = {
  BuildQuickDeck: [{ verb: "BuildQuickDeck", sets: ["The Wizard's Quest 15", "The Wizard's Quest 16", "The Wizard's Quest 17"], keep: 2 }],
  ChooseQuestStage: [{ verb: "ChooseQuestStage", codes: ["51003", "51004", "51005"] }],
  SearchTopReveal: [{ verb: "SearchTopReveal", top: 5, maxCost: 1, maxCostMulti: 2 }, { verb: "SearchTopReveal", top: 5, maxCostStage: true, cancelable: true }],
  HoldPickedUnder: [{ verb: "HoldPickedUnder" }, { verb: "HoldPickedUnder", barsPutting: true }, { verb: "HoldPickedUnder", returnsExhausted: true }],
  HideUnderQuest: [{ verb: "HideUnderQuest", top: 5, maxCostStage: true }],
  ArrangeTopByChallenge: [{ verb: "ArrangeTopByChallenge" }],
  BarHeldTitles: [{ verb: "BarHeldTitles" }],
  RemoveDefender: [{ verb: "RemoveDefender" }],
  SearchTopShadow: [{ verb: "SearchTopShadow", top: 5 }],
  ReplacesRevealCancel: [{ verb: "ReplacesRevealCancel" }],
};
