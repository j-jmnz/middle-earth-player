// The shapes of the choice sheets the table shows, and the words for an effect's timing. Data only: sheets.ts maps the
// engine's open window to one of these, bar-sheets.ts builds the sheets the bar opens and the intents a sheet sends.
import type { Effect } from "../catalog/boundary.ts";
import type { PlayerIntent } from "../rules/reduce.ts";

import type { IconName } from "./icon-map.ts";
import type { PlaceMark } from "./island-place.ts";
import type { PayRequest } from "./pay.ts";

export type SheetNames = {
  // A card instance by id, as the player reads it.
  card: (cardId: string) => string;
  // The printed line a ledger line id names, or null when the ledger has none.
  line: (lineId: string) => string | null;
  // A card's catalog text by code, for a card the ledger does not hold (what is not applied is read from it).
  text?: (code: string) => string | null;
  // The real name of a card lying on its Lost Island side, for the look that shows its facedown side (dcce.uncharted); `card` says Lost Island.
  facedown?: (cardId: string) => string;
};

// A number the engine computed, shown with the game's icon beside it (willpower on a commit, defense on a defender).
export type SheetStat = { icon: IconName; value: number; word: string };

// `mark`: a number drawn on the option's card while the pick is open (the damage a defender would take), in danger when
// it destroys the card.
export type OptionMark = { icon: IconName; value: number; danger: boolean };

// `place`: a location of the Island Map where the marker stands, drawn as a small 5 × 3 glyph with the location lit (island-place.ts).
export type SheetOption = { id: string; label: string; code: string | null; stats?: readonly SheetStat[]; mark?: OptionMark; place?: PlaceMark };

// `caution`: what confirming this option costs that the player may not expect (a hero destroyed and the game lost). The
// confirm then arms on its first tap and the line above it says this (docs/design-system-table.md, Two taps).
export type PickOption = SheetOption & ({ intent: PlayerIntent } | { next: Sheet }) & { caution?: string };

// An option the rules do not allow now, shown with the reducer's reason so the player sees why it is missing.
export type Unavailable = { id: string; label: string; code: string | null; reason: string };

// `caution` on an alternative that sends an intent: the armed line says it in place of "Tap again" (the game lost).
export type Alternative = { label: string; intent: PlayerIntent; caution?: string } | { label: string; next: Sheet };

export type PickSheet = {
  kind: "pick";
  // The engine's numbers for the moment, with their icons (the attack in a defense).
  stats?: readonly SheetStat[];
  key: string;
  step: string;
  title: string;
  note: string | null;
  // The action the primary button names with the chosen option ("Defend with" Sam).
  verb: string;
  // A fixed primary label when an option is a whole sentence (a branch of a Choose), in place of verb and option.
  confirm?: string;
  options: readonly PickOption[];
  // Options the rules refuse now, with the reason (Weathertop's unpayable Travel cost).
  unavailable?: readonly Unavailable[];
  // The one filled action when the sheet has no options to choose among (Keep, Done).
  primary: { label: string; intent: PlayerIntent } | null;
  alternative: Alternative | null;
  // The primary confirms a card the player already picked on the table (Play Gandalf), so it needs no second tap.
  selectionMade?: boolean;
  // Cards the moment is about that the player may want to read first (the top of the encounter deck under Look).
  about?: readonly string[];
  // A warning the confirm repeats before it sends, whatever is picked: the primary arms on its first tap.
  caution?: string;
  // The cards a Sailing test looked at, listed read-only on the dock's List (docs/design-system-table.md, The Sailing test).
  look?: readonly LookRow[];
};

// A card a Sailing test looked at, with the success symbols its ledger side prints (sea-sheets.ts).
export type LookRow = { id: string; code: string; name: string; success: number };

export type MultiBuild = { kind: "Commit" } | { kind: "CommitHide" } | { kind: "attack"; enemyId: string };

export type MultiSheet = {
  kind: "multi";
  stats?: readonly SheetStat[];
  key: string;
  step: string;
  title: string;
  note: string | null;
  verb: string;
  options: readonly SheetOption[];
  build: MultiBuild;
  allowEmpty: boolean;
  preselected: readonly string[];
  alternative: Alternative | null;
};

export type DistributePurpose =
  | { kind: "archery" }
  | { kind: "play"; cardId: string; hostId: string | null }
  | { kind: "trigger"; cardId: string; effectId: string };

export type DistributeSheet = {
  kind: "distribute";
  key: string;
  step: string;
  title: string;
  note: string;
  total: number;
  exact: boolean;
  options: readonly (SheetOption & { max: number })[];
  purpose: DistributePurpose;
  // How many different heroes' pools pay (PayDistinctHeroes): at least `min` (01036:A:1), at most `max`.
  distinct?: { min?: number; max?: number };
  // A warning the confirm repeats before it sends (an attachment whose text the app does not apply): Play arms first.
  caution?: string;
};

export type TriggerOption = SheetOption & { effectId: string; cardId: string; timing: string; text: string | null; pay: PayRequest | null };

export type HideNumbers = { x: number; threat: number; willpower: number; committed: readonly string[] };

export type TriggerSheet = {
  kind: "trigger";
  key: string;
  step: string;
  title: string;
  // The card the moment is about, so the sheet can name it and the inspect route can open it.
  sourceId: string | null;
  timing: string;
  note: string | null;
  hide: HideNumbers | null;
  options: readonly TriggerOption[];
  // The pass button's word, or null when the window cannot be passed.
  pass: string | null;
  // The ability already picked: the player tapped a card that has only this one.
  preselect?: string;
};

// `step` is the eyebrow (Resolution only when a campaign card has one); `action` labels the button that leaves the table
// for the outcome screen.
export type OutcomeSheet = { kind: "outcome"; key: string; result: "won" | "lost"; step: string; title: string; note: string; action: string };

/**
 * An ordinary action window, answered on the table: the cards that can be played or used now glow, the quest commit is built
 * by tapping characters, and Pass closes the window.
 */
export type WindowSheet = {
  kind: "window";
  key: string;
  step: string;
  title: string;
  note: string | null;
  // The quest commit in the commit window: a tap on a character puts it in or takes it out.
  commit: MultiSheet | null;
  // The player side quests in the quest areas the commit can go to instead of the current quest (families/sidequests-quest.ts).
  sideQuests?: readonly { id: string; label: string }[];
  // Cards the player can play now, from the hand or the top of the deck.
  plays: readonly string[];
  // The Actions the rules allow now.
  triggers: readonly TriggerOption[];
  // The pass button's word, what passing does, and what the armed button says before the second tap.
  pass: string;
  passNote: string;
  armed: string;
};

export type Sheet = PickSheet | MultiSheet | DistributeSheet | TriggerSheet | OutcomeSheet | WindowSheet;

export const TIMING_WORDS: Readonly<Record<Effect["timing"], string>> = {
  setup: "Setup",
  forced: "Forced",
  triggered: "Forced",
  whenRevealed: "When revealed",
  response: "Response",
  action: "Action",
  shadow: "Shadow",
  constant: "Constant",
  questResolution: "Quest resolution",
  campaignSetup: "Setup",
  resolution: "Resolution",
  travel: "Travel",
  engagement: "Engagement",
  beginningOfPhase: "Beginning of phase",
  endOfPhase: "End of phase",
  endOfRound: "End of round",
};
