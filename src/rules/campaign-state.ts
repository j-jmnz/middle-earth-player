// What a campaign scenario hands to and takes from the campaign log: the Resolution's record and the facts the log gives the game.
// Types only; state.ts holds the rest of the scenario state.

// What a won scenario writes for the campaign: cards earned (and where each went), heroes that fell, captives.
export type Earned = {
  code: string;
  to: "pool" | "hand" | "hero";
  seat: number | null;
  hero: string | null;
  step: number;
  // One copy for each player ("each player earns 1 copy"): a seat that holds no copy of the code gets another entry. Any other
  // earn is one copy of a code however often it is listed, whatever seat wrote it.
  perPlayer?: boolean;
};
export type ResolutionLog = {
  earned: readonly Earned[];
  fallen: readonly string[];
  captives: readonly { seat: number; hero: string }[];
  // Cards the Resolution hands to the NEXT campaign (the CarryOver verb): the campaign log keeps them for a new save to take in.
  carryOver?: readonly Earned[];
  // Facts the Resolution records for the campaign log in place of the paper log's notes: the hero taken prisoner, and counters on
  // a campaign card by its code (a token count read at Resolution).
  prisoner?: string | null;
  counters?: Readonly<Record<string, number>>;
  // The XP the Resolution's GainXp lines added up to (dcce.gaining-xp); the campaign log records it. Absent where no line ran.
  xp?: number;
};

// The campaign log's structured facts, handed to the engine at the start of a scenario in Campaign Mode (campaign/log.ts writes
// them back from the won game). Absent in a standalone game and in a campaign whose log holds none.
export type CampaignFacts = {
  // The hero code the players named a prisoner (Journey Along the Anduin's Resolution).
  prisoner: string | null;
  // Once-per-campaign uses recorded in the log ("Record in the Campaign Log when used"), by the code of the card used.
  usedOnce: readonly string[];
  // Counters on a campaign card, by its code.
  counters: Readonly<Record<string, number>>;
  // The Dream-chaser log's marks as the game reads them (dcce.scalable-upgradable), left out while none is set: the level of each scalable card
  // by its code (the boxes marked beside it: its X) and the codes of the upgradable cards whose boxes are all marked, which are dealt on their
  // Upgraded side. Effect records read them; none does yet.
  levels?: Readonly<Record<string, number>>;
  upgraded?: readonly string[];
  // The Hard/Expert Mode card the players put next to the quest deck this game (dcce.hard-expert): the campaign log records it per scenario.
  modeCard?: "hard" | "expert";
};
