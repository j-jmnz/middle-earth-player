// What a campaign scenario hands to and takes from the campaign log: the Resolution's record and the facts the log gives the game.
// Types only; state.ts holds the rest of the scenario state.
import type { AllyLine } from "../../catalog/ally-lines.ts";

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
  // A card that goes into the chosen player's deck after the starting hand, for the rest of the campaign (Recurring Nightmare, 11197:B:1; ChooseCards `to: player`): `afterHand`. `copy` numbers the
  // copies of a code the scenario earned (0 for the first), so two copies are two entries.
  afterHand?: true;
  copy?: number;
};

// The Hard/Expert Mode card (11217, dcce.hard-expert): side A is Hard, side B is Expert.
export type ModeCard = "hard" | "expert";

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
  // Ered Mithrin (emce.treasure, emce.boon-allies, emce.campaign-pool-encounter): what the Resolution's wilderland verbs record, left out while a game records none. The treasures
  // the players control and discovered (DiscoverTreasure), the log lines a boon ally was traded for (BoonAllyOrLogLine), the encounter cards of the pool with their copies as the
  // Resolution left them (AddEncounterToPool, RemoveFromPool; absent while it changed none), and the pool's cards a player removed.
  treasures?: readonly string[];
  allyLines?: readonly AllyLine[];
  encounterPool?: Readonly<Record<string, number>>;
  poolRemoved?: readonly { code: string; seat: number | null }[];
  // What each seat answered to the choice of a card to remove from the pool, in the order they answered: the option taken, or the decline (the screen reads it back for the seats that have answered).
  poolAnswers?: readonly { seat: number; option: string }[];
  // The Two Towers (docs/brief.md, The Two Towers), each left out while it holds nothing: what each seat answered to a ChooseOption (`name` is the instruction's, `option` the one taken); the
  // permanent starting threat penalty a seat took (ThreatPenaltyForPick); the heroes taken off the list of fallen heroes (ReviveFallenHero) and the ones removed from the Campaign Log
  // (TrimHeroes), by the seat whose heroes they are; the enemies underneath The Black Gate by card code and quantity (RecordUnderneath).
  picks?: readonly { name: string; seat: number; option: string }[];
  threatPenalties?: readonly { seat: number; amount: number }[];
  revived?: readonly { seat: number; hero: string }[];
  removedHeroes?: readonly { seat: number; hero: string }[];
  underneath?: Readonly<Record<string, number>>;
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
  modeCard?: ModeCard;
  // The Ered Mithrin log as the game reads it (emce.treasure, emce.boon-allies, emce.campaign-log), each left out while it holds nothing: the treasures discovered, the "Unique Allies
  // Protecting Wilderland" lines recorded, the boxes marked beside Beldis for each seat, the encounter cards of the Campaign Pool with their copies, and the cards of the pool a
  // Resolution may remove (each pool entry's code and seat).
  treasures?: readonly string[];
  allyLines?: readonly AllyLine[];
  beldisUses?: readonly number[];
  encounterPool?: Readonly<Record<string, number>>;
  pool?: readonly { code: string; seat: number | null }[];
  // The Campaign Log's hero lists by seat, the codes of the saga's Fellowship heroes among them, and the captives the log names (a quest card's Setup in Campaign Mode takes each captive from them), for the Resolution that changes the lists (ReviveFallenHero, TrimHeroes); left out in a game of another campaign.
  heroLog?: { heroes: readonly (readonly string[])[]; fallen: readonly (readonly string[])[]; fellowship: readonly string[]; captives: readonly { seat: number; hero: string }[] };
};
