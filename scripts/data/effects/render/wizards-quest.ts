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
    text: `the opposing team searches the top ${str(i.top)} cards of the encounter deck for the card nearest the top that costs ${str(i.maxCost)} or less (${str(i.maxCostMulti)} or less with two or more players), sets it aside, shuffles the encounter deck and reveals the card; its When Revealed effects cannot be canceled (with no such card, only the shuffle)`,
    read: ["top", "maxCost", "maxCostMulti"],
  }),
  HoldPickedUnder: () => ({ text: "the last picked card (an ally in play, or a card of a hand) lies faceup under this card, its owner's still and out of play (an ally in play loses its tokens and its attachments are discarded); no copy of its title can be played or put into play while it lies there; it returns to its owner's hand when this card leaves play", read: [] }),
  BarHeldTitles: () => ({ text: "no card with the title of a card held under this one can be played or put into play (the bar is the engine's, HoldPickedUnder holds the cards)", read: [] }),
};

export const WIZARDS_QUEST_SAMPLES: Readonly<Record<string, readonly Obj[]>> = {
  BuildQuickDeck: [{ verb: "BuildQuickDeck", sets: ["The Wizard's Quest 15", "The Wizard's Quest 16", "The Wizard's Quest 17"], keep: 2 }],
  ChooseQuestStage: [{ verb: "ChooseQuestStage", codes: ["51003", "51004", "51005"] }],
  SearchTopReveal: [{ verb: "SearchTopReveal", top: 5, maxCost: 1, maxCostMulti: 2 }],
  HoldPickedUnder: [{ verb: "HoldPickedUnder" }],
  BarHeldTitles: [{ verb: "BarHeldTitles" }],
};
