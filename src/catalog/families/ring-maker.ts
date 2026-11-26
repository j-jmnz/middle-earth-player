// The vocabulary The Ring-maker cycle (The Voice of Isengard, The Dunland Trap, The Three Trials, Trouble in Tharbad, The Nîn-in-Eilph, Celebrimbor's Secret, The Antlered Crown) adds to effect records. The Time X keyword itself is the angmar family's
// (src/catalog/families/angmar.ts); src/rules/families/ring-maker runs the verbs below and answers the hooks the flag needs.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { cardRefSchema, positiveAmountSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";
import { verbFlags } from "../verb-flags.ts";

const VERBS = [
  // "Remove 1 time counter from the current quest" (07020:A:2, 07022:A:1): up to `amount` time counters come off the current quest stage, one at a time, and the stage hears that its last one is gone (`lastTimeCounterRemoved`). A quest stage with no counter loses none.
  z.strictObject({ verb: z.literal("RemoveTimeFromQuest"), amount: positiveAmountSchema, ...when }),
  // "The first player draws this card into his hand" (07023:A:1): the source, an encounter card being revealed, goes into the hand of the actor and cannot leave it (`cannotLeaveHand`). It is no draw from a deck, so no card hears a draw, and the reveal does not discard it.
  z.strictObject({ verb: z.literal("DrawSelfIntoHand"), ...when }),
  // "Put the topmost Dunland enemy discarded this way into play engaged with that player" (07047:A:1): the enemy with this Trait among the cards the running effect's DiscardEncounterTop discarded that lies highest in the discard pile (the last one discarded) enters play engaged with the actor, who is
  // the player engaged. Nothing happens when none of those cards is such an enemy.
  z.strictObject({ verb: z.literal("EngageTopDiscarded"), trait: z.string().min(1), ...when }),
  // "Each player removes the top 20 cards of his deck and places them aside, as an out-of-play deck" (07062:A:1): each seat moves the top `count` cards of its deck (all it holds) into its out-of-play deck, a facedown pile of its own (the zones `outOfPlay0` and `outOfPlay1`). No card hears a draw or a discard.
  verbFlags(z.strictObject({ verb: z.literal("CreateOutOfPlayDecks"), count: z.number().int().positive(), ...when }), { setupRuns: "top" }),
  // "The first player takes Mugash plus 1 Mugash's Guard for each other player ... and randomly shuffles one facedown into each player's out-of-play deck" (07062:A:1): the set-aside copy of `once` and as many copies of `perOtherPlayer` as there are other seats are dealt one to each seat at random and every
  // out-of-play deck is shuffled; the Guards left stay set aside.
  verbFlags(z.strictObject({ verb: z.literal("ShuffleIntoOutOfPlayDecks"), once: z.string().min(1), perOtherPlayer: z.string().min(1), ...when }), { setupRuns: "top" }),
  // "Reveal the top card of each player's out-of-play deck" (07029:A:1) and "Searches X" (07027:A:2, 07028:A:1): the actor reveals the top `amount` cards of its out-of-play deck (all it holds). Each enemy is added to the staging area, not revealed; any other card is discarded to its owner's discard pile.
  // With `chooseForHand` the actor picks one of the other cards for its hand first. The deck is not shuffled. `revealed` is the verb's own note of the cards it asked about.
  z.strictObject({ verb: z.literal("RevealOutOfPlay"), amount: positiveAmountSchema, chooseForHand: z.literal(true).optional(), revealed: z.array(z.string()).optional(), ...when }),
  // "Return Mugash to the staging area" (07025:A:2, 07064:B:2): each enemy lying attached to a card as an attachment (`asAttachment`, AttachEnemyToPicked) with this title goes back to the staging area as an enemy. Mugash anywhere else is not moved.
  z.strictObject({ verb: z.literal("ReturnAttachedEnemy"), name: z.string().min(1), ...when }),
  // "The defending player shuffles 1 random card from his hand into his out-of-play deck" (07026:A:1): the actor puts one random card of its hand, not one that cannot leave the hand, facedown into its out-of-play deck, which is shuffled. An empty hand does nothing.
  z.strictObject({ verb: z.literal("ShuffleHandCardIntoOutOfPlay"), random: z.literal(true), ...when }),
  // "While a player controls a hero with Mugash attached, Mugash's Guard engages that player" (07025:A:1), a constant marker on the Guard: in the staging area, or engaged with another seat, it engages the seat that controls a hero with the enemy of this title attached, at once and whatever its engagement cost. The settle sweep is
  // families/ring-maker/captor.ts; the run does nothing.
  z.strictObject({ verb: z.literal("EngageCaptiveHolder"), captive: z.string().min(1) }),
  // "Each player must choose an enemy or objective in the discard pile, reveal it and add it to the staging area" (07067:B:2): the actor picks a card of one of these `types` in the encounter discard pile (the player's choice, whichever card lies there; one card per player, as the card leaves
  // the pile) and reveals it in full: its When Revealed effects and its keywords resolve (an objective with Guarded takes its guard), and it joins the staging area. A pile with no such card does nothing.
  z.strictObject({ verb: z.literal("RevealChosenFromDiscard"), types: z.array(z.enum(["enemy", "objective", "location", "treachery"])).min(1), ...when }),
  // "Each player cannot refresh more than 5 characters during the refresh phase" (07036:A:1): run by the actor in a Forced effect at the beginning of the refresh phase. The exhausted characters the actor controls beyond `amount` that would ready are chosen by the actor and do not ready
  // this phase (`doesNotReady`). With `amount` or fewer to ready, nothing happens.
  z.strictObject({ verb: z.literal("CapRefresh"), amount: z.number().int().positive(), ...when }),
  // "The players advance to a stage 2A quest of their choice" (08035:B:1, 08036:B:2): of the stages with these `codes` still in the quest deck the first player chooses one and the quest advances to it (a defeated stage lies set aside, so it is not offered again); one left is taken without a question; none left, the quest advances to `otherwise`
  // ("If all stage 2 quests have been defeated, advance to stage 3A, instead"). The stage left is defeated and the new stage's When Revealed effects resolve (AdvanceToStage).
  z.strictObject({ verb: z.literal("AdvanceToChosenStage"), codes: z.array(z.string().min(1)).min(1), otherwise: z.string().min(1), ...when }),
  // "Randomly choose 1 of the remaining set aside Guardian enemies" (08036:A:1), "Find the set aside Key objective that shares a Trait with the just revealed Guardian enemy" (08036:A:1): the last picked card becomes one of the set-aside cards of this printed type with this Trait, chosen with the game's seed; with `sharesTraitWithPicked`
  // only one that shares a Trait with the card picked before it. With `trialKey` the card is marked as the current trial's Key objective for the stage that picks it (the flag `trialKey`). Nothing is picked when no card matches, so the verbs that read the picked card do nothing.
  z.strictObject({ verb: z.literal("PickSetAside"), cardType: z.enum(["enemy", "location", "objective"]), trait: z.string().min(1), sharesTraitWithPicked: z.literal(true).optional(), trialKey: z.literal(true).optional(), ...when }),
  // "Attach it to that enemy" (08036:A:1, 08037:A:1): the last picked card, a set-aside Key, lies attached to the card picked before it as a claimed objective that no player controls; when its host leaves play it goes to the staging area (its own text). `attached` is announced.
  z.strictObject({ verb: z.literal("AttachPickedToPrevious"), ...when }),
  // "Add it to the staging area" (08037:A:1): the last picked card, a set-aside Barrow, joins the staging area without being revealed (no reveal Response, no When Revealed; faq.reveal-and-add).
  z.strictObject({ verb: z.literal("AddPickedToStaging"), ...when }),
  // "Shuffle it into the bottom 10 cards of the encounter deck" (08038:A:1): the last picked card joins the last `count` cards of the encounter deck (all of them when fewer) and those are shuffled.
  z.strictObject({ verb: z.literal("ShufflePickedIntoBottom"), count: z.number().int().positive(), ...when }),
  // "Reveal each Guardian enemy in the victory display, adding them to the staging area" (08039:A:1), "reveal a random Guardian enemy from the victory display" (08054:A:1): each card in the victory display with this Trait is revealed in full (Time counters put on again) and joins the staging area;
  // with `random`, one of them, chosen with the seed.
  z.strictObject({ verb: z.literal("RevealFromVictory"), trait: z.string().min(1), random: z.literal(true).optional(), ...when }),
  // "Add all Barrow locations in play to the victory display" (08036:B:2), "add all Guardian enemies in play" (08037:B:2): each card in play (the staging area, an engagement area, the active location) of this printed `cardType` with this Trait goes to the victory display, a card that cannot leave play for a player card too (a quest effect).
  z.strictObject({ verb: z.literal("AddInPlayToVictory"), cardType: z.enum(["enemy", "location"]), trait: z.string().min(1), ...when }),
  // "After a Key objective is placed in the discard pile" (08043:A:2), run by the Setup of the stage that holds such a card: the table notes each card placed in the encounter discard pile from now on to the end of the game, so a record that hears `encounterDiscarded` is called (the Keys discarded from the encounter deck by 08038:B:1).
  verbFlags(z.strictObject({ verb: z.literal("NoteEncounterDiscards"), ...when }), { setupRuns: "top" }),
  // "Each Guardian enemy engages the first player" (08036:B:1 to 08038:B:1), "Each Guardian enemy engages the player who controls the Key objective with a Trait shared by that enemy" (08039:B:1), a constant marker on the stage: while it is the stage in play, each enemy with this Trait in the staging area or engaged
  // with another player engages that player at once, whatever its engagement cost, and follows the first player token (the settle sweep, families/ring-maker/trial-sweeps.ts; the run does nothing). A Guardian whose Key no player controls stays where it is.
  z.strictObject({ verb: z.literal("EngageSeat"), who: z.enum(["firstPlayer", "keyHolder"]), trait: z.string().min(1) }),
  // "Bellach makes an immediate attack against Nalir" (08067:B:2, 08083:A:1; rm.attacks-against-nalir): the last picked enemy, in the staging area or engaged with any player, makes an immediate attack, dealt a shadow card of its own, against the player who controls Nalir. That player declares defenders as for any
  // attack; undefended damage must be assigned to Nalir. Nothing happens when no player controls Nalir or the enemy may not attack. During an attack the enemy waits for its end (`enemy` names the card the attack end left waiting; a record never sets it).
  z.strictObject({ verb: z.literal("AttackNalir"), enemy: z.string().min(1).optional(), ...when }),
  // "reduce each player's threat elimination level by 10" (08066:B:2), the engine's check after the level moved: each seat whose threat is at or above its elimination level now is eliminated at once (rm.threat-elimination-level). The record puts the `eliminationReduction` flag first.
  z.strictObject({ verb: z.literal("EliminateAtLevel"), ...when }),
  // "Trigger each Scour effect currently in play" (08122:B:2, 08123:A:1, 08134:A:1), "trigger the topmost Scour effect in the discard pile, if able" (08133:A:1; rm.scour): each card in the scope that has a record hearing `scour` resolves it as its source, one after the other, in the order the first player
  // chooses (asked when two cards with different titles are left). `inPlay`: the cards in the staging area, engaged with a player or the active location, the set fixed as the trigger starts; `topmostDiscard`: the card nearest the top of the encounter discard pile, which stays there. `remaining` is the
  // verb's own note of the cards still to resolve.
  z.strictObject({ verb: z.literal("TriggerScour"), scope: z.enum(["inPlay", "topmostDiscard"]), remaining: z.array(z.string()).optional(), ...when }),
  // "When a location has damage equal to its printed quest points, place it facedown underneath The Orcs' Search" (08125:A:1), a constant marker on the objective: each location in play (staging area, active location) whose damage is at least its printed quest points goes facedown underneath the source at
  // each settle (rm.the-orcs-search); the damage, the progress and the attachments are discarded first. The settle sweep is families/ring-maker/orcs-search.ts; the run does nothing.
  z.strictObject({ verb: z.literal("BuryDamagedLocations") }),
  // "Each player places a random card from his hand facedown underneath The Orcs' Search" (08134:A:1): each living player in turn, the first player first, puts one card of his hand, chosen with the game's seed, facedown under the card in play with this code, out of play and still its owner's. An empty hand, or no such card in play, does nothing.
  z.strictObject({ verb: z.literal("PlaceRandomHandUnder"), code: z.string().min(1), ...when }),
  // "Place that character facedown underneath The Orcs' Search" (08134:A:2): the character the attack destroyed (`card`, the other card of the attack's end by default), lying in its owner's discard pile, goes facedown under the card in play with this code and stays its owner's.
  z.strictObject({ verb: z.literal("PlaceDestroyedUnder"), code: z.string().min(1), card: cardRefSchema.optional(), ...when }),
  // "Excess damage dealt by this attack must be placed on the active location, if able" (08131:A:3): a Shadow effect marks the attack in progress: the damage beyond the defender's remaining hit points goes on the active location; with none, it is lost.
  z.strictObject({ verb: z.literal("ExcessToActiveLocation"), ...when }),
] as const;

const TRIGGERS = [
  // About the card that has a Scour effect: `TriggerScour` runs its record (08124:A:2, rm.scour). Never announced as an event: the verb resolves the record in a frame of its own.
  "scour",
  // The players control the current trial's Key objective (a hero holds the Key `trialKey` marks), announced at a settle with nothing resolving (08036:B:2 to 08038:B:2).
  "trialKeyControlled",
  // The allies in play, all seats together, are more than the table's `alliesLimit` (08047:A:1): the event is about the first player, who chooses the allies that stay.
  "alliesOverLimit",
  // Every living player's threat is 0 (08066:B:4), announced at a settle with nothing resolving and only while a record of the current quest stage hears it; the event is about no card (the stage's record answers it).
  "allThreatZero",
  // After a removal of time counters took any off the current quest (08103:A:3, 08104:A:2, 08105:A:1): once for the whole removal, not for each counter, however it came off (the refresh phase, a card effect). An event about no card; a record hears it only in a game that deals one.
  "timeCountersRemoved",
] as const;

const FLAGS = [
  // On the current trial's Key objective, set by PickSetAside `trialKey` (the stage that picked it is the modifier's source): the stage's 2B hears `trialKeyControlled` once a hero holds the Key (08036:B:2).
  "trialKey",
  // On the table: the players, as a group, cannot have more than this many allies in play ("cannot have more than 5 allies", 08047:A:1). At each settle with nothing resolving, `alliesOverLimit` is announced for the first player when more allies are in play.
  "alliesLimit",
  // On a card in a hand: it cannot leave that hand ("Ill Tidings cannot leave that player's hand", 07023:A:1). core/zones.ts moveCard refuses the move; a pick that would discard it and a random discard leave it out (families/wilderland/pick.ts barredFromPlayerDiscard).
  "cannotLeaveHand",
  // On a Hills of Dunland in the staging area: it is the copy whose Forced effect after a draw acts ("this ability does not stack with other copies", 08020:A:1). It is held with `doesNotStack`, so only the oldest copy in the staging area holds it; the Forced effect's condition reads it.
  "huntsOnDraw",
  // On a quest stage (target `self`): the progress placed on it, by questing or a player card effect, is canceled and its record hears it as `progressReplaced` with the amount (08066:B:3; quest/progress-replaced.ts). The active location took its share first.
  "progressCanceled",
  // On a quest stage (target `self`): progress from questing is not placed on it and its record hears `progressReplaced` with the amount, to place it on another card; progress a player card effect places on the stage goes to that card too, which is immune to it, so none is placed (08067:B:3).
  "progressToCrossing",
  // On the table: no time counter can be removed from the current quest ("time counters cannot be removed from the current quest", 08075:A:2): the refresh phase, a card effect and a Shadow all leave it as it is (families/angmar/time.ts removeTimeCounterFrom).
  "timeBarred",
  // On the table: no player card effect gains resources, and none draws cards ("Player card effects cannot be used to gain resources or draw cards", 08095:B:3). The resource phase's collection and the framework's draws stand (rr.effects: no card effect).
  // Modelled on `cannotReadyByPlayerCard`: the effect's source is read (a player card, rr.player-deck).
  "cannotGainResourcesByPlayerCard",
  "cannotDrawByPlayerCard",
  // On the table: a player who commits characters to the quest first discards a card at random from his hand, and a player with none cannot commit ("In order to commit characters to the quest, a player must first discard a card at random from his hand", 08096:B:3).
  "commitDiscardsRandom",
  // On an Ancient Foundation: it is the copy whose scour effect acts ("this ability does not stack with other copies of Ancient Foundation", 08132:A:1). It is held with `doesNotStack`, so only the oldest copy in play holds it; the scour record's condition reads it.
  "scoursAlone",
] as const;

export const manifest = { name: "ring-maker", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
