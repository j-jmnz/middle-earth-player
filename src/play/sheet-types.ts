// The shapes of the choice sheets the table shows, and the words for an effect's timing. Data only: sheets.ts maps the
// engine's open window to one of these, bar-sheets.ts builds the sheets the bar opens and the intents a sheet sends.
import type { Effect } from "../catalog/boundary.ts";
import type { PlayerIntent } from "../rules/reduce.ts";

import type { IconName } from "./icon-map.ts";
import type { PayRequest } from "./pay.ts";

export type SheetNames = {
  // A card instance by id, as the player reads it.
  card: (cardId: string) => string;
  // The printed line a ledger line id names, or null when the ledger has none.
  line: (lineId: string) => string | null;
};

// A number the engine computed, shown with the game's icon beside it (willpower on a commit, defense on a defender).
export type SheetStat = { icon: IconName; value: number; word: string };

export type SheetOption = { id: string; label: string; code: string | null; stats?: readonly SheetStat[] };

export type PickOption = SheetOption & ({ intent: PlayerIntent } | { next: Sheet });

// An option the rules do not allow now, shown with the reducer's reason so the player sees why it is missing.
export type Unavailable = { id: string; label: string; code: string | null; reason: string };

export type Alternative = { label: string; intent: PlayerIntent } | { label: string; next: Sheet };

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
};

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
};

export type OutcomeSheet = { kind: "outcome"; key: string; result: "won" | "lost"; title: string; note: string };

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
  // Cards the player can play now, from the hand or the top of the deck.
  plays: readonly string[];
  // The Actions the rules allow now.
  triggers: readonly TriggerOption[];
  // The pass button's word, and what passing does.
  pass: string;
  passNote: string;
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
