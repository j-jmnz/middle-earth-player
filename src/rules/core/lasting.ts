// Rules: rr.in-play-and-out-of-play, rr.lasting-effects (data/rules/entries.json). That a lasting effect on a card ends when the card leaves play is a reading no span states: docs/brief.md, Core round (`recommended`).
import type { ModifierStat } from "../../catalog/boundary.ts";
import type { ScenarioState } from "./state.ts";

// Two kinds of modifier name a card. A lasting EFFECT of an ability ("cannot ready", "+2 Attack", "gains Ambush") is one the card's time in play
// held: it ends with it. A MARK is what the engine remembers about the round or the game under the card's id: it is no effect of any card, and a
// rule of the round reads it after the card has left play, so it stays until its own `until` ends it.
// The creating path decides. The verbs of an effect record (ModifyStat, SetStatUntil, ModifyStatVersus) always make effects, whatever stat the record
// names (lasting.test.ts checks that no record names a mark). Engine code makes a mark under a name of the first group below and an effect under a
// name of the second. A name the engine makes that is in neither group fails lasting.test.ts when its scan finds it, so a new flag is classified when it is added. A name the scan misses (lasting.test.ts lists the files it does not read) is in neither group and ENDS with the card: right for an effect, wrong for a mark, so a rule that reads a flag after the card left play puts it in ENGINE_MARKS.

// Marks kept when the holder leaves play. Each says which rule or card reads it, and when.
export const ENGINE_MARKS: ReadonlySet<ModifierStat> = new Set<ModifierStat>([
  // "The first treachery revealed each round" (19137:B:1, families/wilderland/rounds.ts) and the Mount Doom condition `firstTreachery` read the mark on a treachery that is already in the discard pile.
  "firstTreachery",
  "treacheryRevealed",
  "firstTreacheryNoted",
  // "An enemy that engaged you this round" (142026:A:3 pick filter) and the seat check of `engagedThisRound`: the enemy may be destroyed before the check.
  "engagedThisRound",
  "engagedThisPhase",
  "optionalEngagements",
  // Umbar Assassin (Pelargir asks) reads it on the enemy after the engagement. Kept: nothing shows that it must end.
  "engagedOptionally",
  // A card that "cannot be canceled" (Dark Bats, The Wizard's Quest): read when it is revealed, from a deck or a discard pile.
  "revealUncancelable",
  // The Pelargir condition `firstEnemy` reads it for the subject of an event after the enemy was revealed.
  "firstEnemy",
  "firstEnemyNoted",
  // "Raise your threat by the destroyed character's Willpower" (10107:A:2): the Willpower of a character as it was in play, read after it was destroyed.
  "lastWillpower",
  // Aflame: how many attackers have attacked an enemy this round (families/aflame/attack.ts); a count of the round, not an effect.
  "attackersThisRound",
  // Progress counted this round or phase (the south location cap, the sponge, Angmar `progressPlacedHere`, the quest totals): counts, not effects.
  "progressPlaced",
  "progressPlacedShared",
  "progressPlacedHere",
  "questProgressPlaced",
  "questProgressPhase",
  "trackQuestPlaced",
  "spongeTaken",
  // Nightmare "once each round" damage by a card title (families/nightmare/damage-once.ts): a count of the round.
  "damagedByTitle",
  // What the round revealed, noted once each: a location, an enemy, an Ambush enemy, a trait, the first card.
  "locationRevealed",
  "enemyRevealed",
  "ambushEnemyRevealed",
  "traitRevealed",
  "firstRevealedSeen",
  // Notes of the phase or the round on the table or a seat: the quest total, the ready question, the first progress, the early attack, the end of the phase, the hand plays.
  "questTotalAnnounced",
  "readyAsked",
  "progressFirst",
  "attackedFirst",
  "phaseEnds",
  "handPlays",
  // The seat that controls a location (families/pelargir/location-control.ts): the settle sweep reads it once the location is in no play area, to announce controlLost for the seat (06103:A:2).
  "controlSeat",
  // The quest card being attempted. Kept when unsure: the Angmar and night-quest families clear it themselves.
  "currentQuest",
]);

// Effects of an ability that engine code makes under a name of its own. Each ends when its holder leaves play; one held by the table or a seat is no
// card's, so this step never meets it.
export const ENGINE_MADE_EFFECTS: ReadonlySet<ModifierStat> = new Set<ModifierStat>([
  // Stats and bars put on a card for an effect: PreventAttacks, a Shadow card's bonus, StrikeBack, a threat lowered, an Ambush gained, a quest with Attack, a cost probe.
  "attack",
  "defense",
  "threat",
  "engagementCost",
  "cannotAttack",
  "cannotQuest",
  "questsWithAttack",
  "gainsAmbush",
  // Text, keywords and traits an effect gives or takes away.
  "blankText",
  "losesKeywords",
  "traitGained",
  "immuneToPlayerCards",
  // A bar on engagement checks or on engaging one seat (families/quest/index.ts).
  "noChecksAgainst",
  "cannotEngageSeat",
  // Ill Tidings (07023:A:1, DrawSelfIntoHand in families/ring-maker/hand.ts) holds the card in a living player's hand; nothing reads it once the card has left the hand.
  "cannotLeaveHand",
  // An ally guarded in the staging area (an effect of the guard, until the ally rejoins play): every reader (sweep, pick, moves, zones) reads it while the ally is in the staging area, before it leaves.
  "guardedAlly",
  // Effects held by the table or a seat.
  "moreStagingThreat",
  "noQuestThreat",
  "skipQuestPhase",
  "doomedReduction",
  "revealDoomed",
  "engagedThreatSeat",
  // What WatchReveals (families/encounter) makes: held by the table, so no card ends it.
  "watchThreatZero",
  "watchDamage",
  "watchDiscard",
  "watchReadyHost",
  // The round the main quest card came into play, noted by the haradrim settle hook (families/haradrim/stage.ts): held by the table, source the stage; it lapses with the stage.
  "stageEntered",
  // The temperature of the heat tracker (families/haradrim/heat.ts): held by the table for the rest of the game, replaced by each verb.
  "temperature",
]);

// A modifier a record's verb made ends; so does one whose stat is in neither list; a mark of the engine stays; so does every constant effect's modifier (`origin`, rebuilt from the effect list)
// and every one whose holder is not this card (a player, a seat, the table or a class of cards). A modifier put on a card out of play (a cost change in
// a hand) is made after the card has left, so this step never sees it.
export function endLastingOn(state: ScenarioState, id: string): ScenarioState {
  const kept = state.modifiers.filter((modifier) => modifier.instanceId !== id || modifier.origin !== undefined || ENGINE_MARKS.has(modifier.stat));
  return kept.length === state.modifiers.length ? state : { ...state, modifiers: kept };
}
