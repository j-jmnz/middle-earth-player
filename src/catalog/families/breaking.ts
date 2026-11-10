// The vocabulary Breaking of the Fellowship (phase 16) adds to effect records: removing the Ring-bearer from the game, skipping the travel phase, the
// shared staging area stage 2B deals out to a staging area for each player, and the stage each player is on after it. Simple verbs, triggers and
// stat flags; effect-schema-verbs.ts, effect-schema.ts and effect-schema-stats.ts compose them. src/rules/families/breaking/ runs them. The state
// they work on (`ScenarioState.separate`, `Seat.staging`, `Seat.stage`) is described in src/rules/families/breaking/areas.ts.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { when } from "../effect-schema-conditions.ts";

const VERBS = [
  // Stage 2A (142062:A:1): the Ring-bearer, the hero The One Ring is attached to, and every card attached to it are removed from the game, wherever
  // their controllers keep them. The One Ring's text is blank while this resolves, so its line "If The One Ring leaves play, the players lose the
  // game" does not fire: the cards go to the removed zone without being destroyed or discarded. A seat left with no heroes is eliminated.
  z.strictObject({ verb: z.literal("RemoveRingBearer"), ...when }),
  // "Skip the travel phase this round" (142062:A:1): the table holds `skipTravel` until the end of the round; the round goes from the quest phase to
  // the encounter phase with no travel window.
  z.strictObject({ verb: z.literal("SkipTravelPhase"), ...when }),
  // "Reduce each enemy's engagement cost to 0 until the end of the encounter phase" (142062:A:1): the table holds `engagementCostZero` until the end of
  // the round, and an engagement cost is read as 0 only during the encounter phase, so it holds to that phase's end.
  z.strictObject({ verb: z.literal("ZeroEngagementCosts"), ...when }),
  // Each card set aside with one of these printed codes joins the encounter discard pile, and the whole pile is shuffled ("shuffle Seat of Seeing and
  // Frodo's Choice into the encounter discard pile", 142062:B:1). A code with no card set aside is skipped.
  z.strictObject({ verb: z.literal("ShuffleSetAsideIntoDiscard"), codes: z.array(z.string().min(1)).min(1), ...when }),
  // "Place the encounter discard pile on the bottom of the encounter deck" (142062:B:1): the pile, in the order it is in, goes under the deck.
  z.strictObject({ verb: z.literal("PlaceDiscardUnderDeck"), ...when }),
  // The acting player creates a staging area and a quest stage of their own: the quest deck's card with this printed code becomes that seat's stage
  // (`Seat.stage`), stages are separate from now on (`ScenarioState.separate`), and the seat's area is empty ("each player creates their own staging
  // area and advances to a different stage 3A", 142062:B:1; mec109.multiple-staging-areas). Nothing happens when the code is not in the quest deck.
  z.strictObject({ verb: z.literal("StartSeparateStage"), code: z.string().min(1), ...when }),
  // "In player order, each player moves 1 encounter card from this staging area to theirs" until none are left (142062:B:1): each living seat in turn
  // picks one card of the shared staging area (the first player's choice when a seat has several; the last one is taken without asking), until it holds
  // none, and the card goes to that seat's own staging area. Entering an area is not a reveal.
  z.strictObject({ verb: z.literal("DealOutStaging"), ...when }),
  // The last picked card, in the shared staging area, goes to the acting seat's own staging area (what DealOutStaging does for each pick). Nothing
  // happens when the card is in a staging area of a seat already or stages are not separate.
  z.strictObject({ verb: z.literal("MovePickedToOwnStaging"), ...when }),
  // The acting seat's stage is left and the quest deck's card with this printed code takes its place, side B up, its When Revealed effects resolving for that seat
  // ("Forced: After Frodo's Choice is revealed at this stage, advance to stage 4A", 142063:B:2 to 142066:B:2; mec109.multiple-staging-areas). The stage left is
  // set aside with its attachments discarded, as an advanced stage is. Once stages are separate this is the acting seat's own stage; nothing happens when the code is
  // not in the quest deck.
  z.strictObject({ verb: z.literal("AdvanceToStage"), code: z.string().min(1), ...when }),
  // "When there are no encounter cards left at this stage, discard it" (142062:B:1): the shared quest stage goes to the discard pile (the set-aside pile,
  // as a defeated stage does), and each living seat in player order hears `stageDiscarded` for its own stage ("After stage 2B is discarded", 142063:A:1).
  z.strictObject({ verb: z.literal("DiscardSharedStage"), ...when }),
  // Marker constant on Frodo's Choice ("If Frodo's Choice is discarded, reveal it instead", 142068:A:1): when a card effect discards cards from the top of the
  // encounter deck (the progress a stage 3B turns into discards, FLAGS progressDiscards), this card is revealed by the seat whose stage it is and is not discarded.
  z.strictObject({ verb: z.literal("RevealIfDiscarded"), ...when }),
  // Each player at the source's stage raises their threat by `amount` ("each player at this stage raises his threat by 1", 142077:A:1): the seat whose staging
  // area holds the source once stages are separate, every player before that.
  z.strictObject({ verb: z.literal("RaiseThreatAtStage"), amount: z.number().int().positive(), ...when }),
  // The source (a card in a staging area) moves to the staging area to the left, the next living seat's, if able ("River Anduin moves to the staging area to the
  // left, if able", 142077:A:1). Nothing happens with one staging area or one seat.
  z.strictObject({ verb: z.literal("MoveToLeftArea"), ...when }),
  // The source (default) or the last picked enemy, in a staging area or engaged, moves to the first player's staging area ("move 1 enemy engaged with you to
  // the first player's staging area", 142080:A:2; "move attacking enemy to the first player's staging area", 142080:A:3). With one staging area it goes to it.
  z.strictObject({ verb: z.literal("MoveToFirstStaging"), target: z.enum(["self", "picked"]).optional(), ...when }),
  // Fallen Into Evil (142083:A:1), attached to a non-Fellowship hero: the hero moves to the first player's staging area as an enemy (its Threat is its Willpower, its
  // engagement cost its threat cost) and leaves its player's control. It is the same card with the code `<code>~enemy` (src/rules/core/printed.ts); its game text is
  // blank while it is one.
  z.strictObject({ verb: z.literal("FallIntoEvil"), ...when }),
  // "If Fallen Into Evil is discarded, return attached hero to its owner's control" (142083:A:1): each fallen hero in play goes back among its owner's heroes with
  // its own code, one defeated while it was an enemy goes to its owner's discard pile.
  z.strictObject({ verb: z.literal("ReturnFallenHero"), ...when }),
  // The last picked card leaves the game, and, in Campaign Mode, the campaign pool ("remove it from the game ... remove that card from the campaign pool", 142074:A:2).
  z.strictObject({ verb: z.literal("RemoveFromGame"), ...when }),
  // "For the rest of the game, you cannot lose control of the first player token" (142068:A:2): the table holds `firstPlayerLocked` for the rest of the game (`endOfGame`), so the
  // token does not pass at the end of the refresh phase.
  z.strictObject({ verb: z.literal("LockFirstPlayer"), ...when }),
  // "Take control of ... the Ring-bearer (and each card attached to it)" (142068:A:2): the Ring-bearer, if one is in play, and what is attached to it go to the actor.
  z.strictObject({ verb: z.literal("TakeRingBearer"), ...when }),
] as const;

const TRIGGERS = [
  // The shared stage was discarded as the staging areas were separated. The event is about a seat's own stage card (its `cardId`) and names the seat,
  // so that stage's Forced effect resolves for that seat ("Forced: After stage 2B is discarded, if the total Threat of encounter cards in this staging
  // area is less than 4, reveal 1 encounter card", 142063:A:1 to 142066:A:1).
  "stageDiscarded",
] as const;

const FLAGS = [
  // On a stage: progress that would be placed on the quest discards that many cards from the top of the encounter deck instead (142063:B:1 to 142066:B:1;
  // rules/families/breaking/progress.ts).
  "progressDiscards",
  // On an enemy: Archery X, X the number of players at its stage (142070:A:1), the players in the game before stages are separate, one after. A number on an
  // enemy or a location in a staging area: archery added to the total at its stage ("gains archery 2", 142078:A:1). On a seat: archery added to the total at
  // that seat's stage until the modifier ends (142082:A:1). Read by rules/combat/combat.ts archeryTotal.
  "archeryPlayers",
  "archeryBonus",
  // On "table", while a card in the staging area holds it: archery damage must be assigned to allies, if able (143058:A:2; rules/combat/combat.ts archeryRecipients).
  "archeryToAllies",
  // On "table": the player who holds the first player token cannot lose it for the rest of the game (LockFirstPlayer, 142068:A:2); the token does not pass at the end
  // of the refresh phase (rules/engine/refresh.ts).
  "firstPlayerLocked",
  // On "table", while a card holds it: the combat phase is skipped ("While The Argonath is the active location, skip the combat phase", 142075:A:2;
  // rules/engine/machine.ts).
  "skipCombat",
  // On "table": the travel phase is skipped (SkipTravelPhase, 142062:A:1; rules/engine/machine.ts).
  "skipTravel",
  // On "table", while a card holds it: the encounter phase is skipped, with its optional engagements and engagement checks ("Skip the encounter phase",
  // 142061:B:1; rules/engine/machine.ts). The combat phase still follows.
  "skipEncounter",
] as const;

export const manifest = { name: "breaking", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
