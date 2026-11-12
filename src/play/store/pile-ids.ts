// Rules: dcce.corsair-deck, dcce.uncharted-deck, dcce.grotto-deck, emce.caves-deck, emce.evil-creatures-deck (data/rules/entries.json). The piles the table draws, by name (docs/design-system-table.md, Piles):
// the four every table shows, the second slot's, and the victory display. Which of the second slot's piles a game has is decided here from the state, once. Pure.
import type { ScenarioState } from "../../rules/core/state.ts";

// The four piles every table shows, and the second slot's: the Corsair deck and its discard pile while the scenario has a Corsair deck (dcce.corsair-deck), the Evil Creatures deck and its
// discard pile while it deals that (emce.evil-creatures-deck), or one deck alone: the Uncharted deck (dcce.uncharted-deck), the Grotto deck (dcce.grotto-deck) or the Caves deck
// (emce.caves-deck), or the Harad deck lying under The Cross-roads (mec112.setup-journey-to-the-cross-roads). The victory display is a pile too, at staging's right end, only while a card is in it (ltp.victory-display). Only the discard piles and the victory display open a list.
export type BasePileId = "deck" | "discard" | "encounterDeck" | "encounterDiscard";
export type SecondPileId = "corsairDeck" | "corsairDiscard" | "unchartedDeck" | "grottoDeck" | "evilCreaturesDeck" | "evilCreaturesDiscard" | "cavesDeck" | "haradDeck" | "angmarOrcDeck";
export type VictoryPileId = "victory";
export type PileId = BasePileId | SecondPileId | VictoryPileId;

export const PILES: readonly BasePileId[] = ["deck", "discard", "encounterDeck", "encounterDiscard"];
export const SECOND_PILES: readonly SecondPileId[] = ["corsairDeck", "corsairDiscard"];
const EVIL_CREATURES_PILES: readonly SecondPileId[] = ["evilCreaturesDeck", "evilCreaturesDiscard"];
const UNCHARTED_PILES: readonly SecondPileId[] = ["unchartedDeck"];
const GROTTO_PILES: readonly SecondPileId[] = ["grottoDeck"];
const CAVES_PILES: readonly SecondPileId[] = ["cavesDeck"];
const HARAD_PILES: readonly SecondPileId[] = ["haradDeck"];
const ANGMAR_PILES: readonly SecondPileId[] = ["angmarOrcDeck"];
const NONE_PILES: readonly SecondPileId[] = [];

export const PILE_WORDS: Readonly<Record<PileId, string>> = {
  deck: "Deck",
  discard: "Discard pile",
  encounterDeck: "Encounter deck",
  encounterDiscard: "Encounter discard pile",
  corsairDeck: "Corsair deck",
  corsairDiscard: "Corsair discard pile",
  unchartedDeck: "Uncharted deck",
  grottoDeck: "Grotto deck",
  evilCreaturesDeck: "Evil Creatures deck",
  evilCreaturesDiscard: "Evil Creatures discard pile",
  cavesDeck: "Caves deck",
  haradDeck: "Harad deck",
  angmarOrcDeck: "Orc deck",
  victory: "Victory display",
};

/** The second slot's piles this game has, one family of them: the Corsair pair once the Corsair deck is prepared, until it ends (families/sea/corsair.ts); the Evil Creatures pair once the scenario has dealt that deck; else the Grotto deck while the scenario deals one (dcce.grotto-deck), else the Uncharted deck while it deals that, else the Harad deck once dealt (Journey to the Cross-roads), else the Caves deck once dealt. */
export function secondPilesOf(game: Pick<ScenarioState, "corsairDeck" | "uncharted" | "piles">): readonly SecondPileId[] {
  if (game.corsairDeck !== undefined) return SECOND_PILES;
  if (game.piles?.evilCreaturesDeck !== undefined) return EVIL_CREATURES_PILES;
  if (game.uncharted?.grotto === true) return GROTTO_PILES;
  if (game.uncharted !== undefined) return UNCHARTED_PILES;
  if (game.piles?.haradDeck !== undefined) return HARAD_PILES;
  if (game.piles?.angmarOrcDeck !== undefined) return ANGMAR_PILES;
  return game.piles?.cavesDeck !== undefined ? CAVES_PILES : NONE_PILES;
}

/** Whether a pile's cards are shown face up on top: a discard pile (the one on top is the last put there). A tap on one opens its list; a deck's does not (docs/design-system-table.md, Piles). */
export function isDiscardPile(pile: PileId): boolean {
  return pile === "discard" || pile === "encounterDiscard" || pile === "corsairDiscard" || pile === "evilCreaturesDiscard";
}

/** Whether a tap on a pile opens its list: a discard pile or the victory display. */
export function opensList(pile: PileId): boolean {
  return isDiscardPile(pile) || pile === "victory";
}
