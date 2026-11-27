// The haradrim family (The Sands of Harad cycle, Escape from Umbar and Desert Crossing): the heat tracker (the temperature), a stage that holds no more progress than its quest points while it cannot advance, a quest card noted for the round it came into play, a hand limit
// on the table, a card placed faceup under a location, The Long Arm of Mordor's heroes in the staging area (staged and guarded heroes: Captives held by no card or by an Orc, objective-heroes taken by the players) and Race Across Harad's Orcs' area (a second quest deck, its cards in the area zone or the staging area, the Orcs' stage and its progress) with the Tamed Mûmak objective ally, and Beneath the Sands' Search objective (track.ts: its flips, Track X and the cards that search for On Track). The conditions `stageInPlayWholeRound` and `temperature` and the amount `temperature` are in effect-schema-conditions.ts and effect-schema-amount.ts. src/rules/families/haradrim/ runs and reads them.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { cardRefSchema, positiveAmountSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";
import { pickSchema } from "../effect-schema-pick.ts";
import { verbFlags } from "../verb-flags.ts";

const VERBS = [
  // "Place it faceup under this location. While an enemy is under this location, that enemy is considered to be out of play" (16016:A:1): the last picked card leaves play and lies under the source location faceup (PlaceUnderSelf
  // places it facedown); what it had in play is lost and `placedUnder` is queued about it. A card not in play, or no source, changes nothing.
  z.strictObject({ verb: z.literal("PlaceUnderSelfFaceup"), ...when }),
  // "Place the heat tracker next to the quest deck and set the temperature to 10" (16068:A:1): the tracker starts at this value (no event).
  verbFlags(z.strictObject({ verb: z.literal("SetTemperature"), value: z.number().int().min(0), ...when }), { setupRuns: "top" }),
  // "Increase the temperature by 4" (16068:B:2), or by a read amount. Does nothing while no tracker is set; a change queues `temperatureChanged`.
  z.strictObject({ verb: z.literal("RaiseTemperature"), amount: positiveAmountSchema, ...when }),
  // "Reduce the temperature by 10" (16023:A:3): never below 0. Does nothing while no tracker is set; a change queues `temperatureChanged`.
  z.strictObject({ verb: z.literal("LowerTemperature"), amount: positiveAmountSchema, ...when }),
  // "Move each hero to the staging area" (16071:A:1, hrd.heroes-in-the-staging-area): every hero of every seat becomes a Captive held by no card (in play, controlled by nobody, keeping its tokens and attachments), remembering its owner and its place among that
  // owner's heroes. The settle sweep of this family keeps each such hero's text box blank and the hero immune to player card effects (the Setup says "for the remainder of the game").
  verbFlags(z.strictObject({ verb: z.literal("MoveHeroesToStaging"), ...when }), { setupRuns: "top" }),
  // "Each player takes control of an objective-hero and adds 2 resources to its resource pool" (16071:A:1): the actor takes one of the set-aside cards with these codes into their heroes, faceup, with `resources` resources on it. With several left the actor is asked.
  verbFlags(z.strictObject({ verb: z.literal("TakeObjectiveHero"), codes: z.array(z.string().min(1)).min(1), resources: z.number().int().min(0), ...when }), { setupRuns: "inForEachPlayer" }),
  // "Each player chooses a hero he owns in the staging area, takes control of that hero, and exhausts it" (16071:B:3, 16072:B:3): the actor takes back one of the heroes in the staging area they own (a Captive held by no card), exhausted, in its old place among their
  // heroes. With several the actor is asked; none changes nothing.
  z.strictObject({ verb: z.literal("ReleaseStagedHero"), ...when }),
  // "Attach each hero in the staging area to a different Orc enemy in the staging area. Each hero attached to an enemy is guarded by that enemy" (16073:A:1): the first player pairs each hero in the staging area with an Orc enemy in the staging area that guards no hero; the hero
  // becomes a guarded hero under that Orc (a Captive of the Orc, `guardedHero`). A hero with no Orc left stays in the staging area.
  z.strictObject({ verb: z.literal("GuardStagedHeroes"), ...when }),
  // "Uruk Chieftain engages the player engaged with the most non-unique Orc enemies" (16061:A:3): the source enemy engages the living player with the most enemies matching `pick` engaged with them; the first player chooses among players that tie (all players tie at 0). Nothing
  // changes when the source is already engaged with that player.
  z.strictObject({ verb: z.literal("EngageSeatWithMost"), pick: pickSchema, ...when }),
  // "Each player attaches 1 random set aside Capture objective to a Wild Mûmak in play" (17027:A:1): the last picked card in play is the host; one set-aside card with this trait is drawn by the game seed and lies attached to it faceup, controlled by nobody (it leaves play
  // with its host, and is no player's card). The actor's choice of host is the Pick before it. Nothing changes with no host picked or no such card set aside; `attached` is queued.
  z.strictObject({ verb: z.literal("AttachRandomSetAside"), trait: z.string().min(1), ...when }),
  // "Add [the Capture] and attached enemy to the victory display" (17011:A:1 to 17014:A:1): the source goes to the victory display and then its host enemy, the host read before the source leaves play (its own `when` is read once, with the host still attached). The host's other attachments leave with it. No host: only the source goes.
  z.strictObject({ verb: z.literal("AddWithHostToVictory"), ...when }),
  // "Create the Orcs' area with a second quest deck consisting of stage 1C, 2C, 3C, and 4C. Place Uruk Chieftain in the Orcs' area" (17047:A:1, hrd.prepare-the-orcs-area): the set-aside quest cards with these codes become the Orcs' quest deck in this order, the top one the Orcs' current stage
  // with its D side up (the C side is passed through only by an advance), `number` its stage number (1); each set-aside card with a code of `place` goes into the area. The Orcs' area has no ship behaviour: it sets no `state.sea`.
  z.strictObject({ verb: z.literal("PrepareOrcsArea"), stages: z.array(z.string().min(1)).min(1), number: z.number().int().positive(), place: z.array(z.string().min(1)).optional(), ...when }),
  // "Add ~ to the Orcs' area" (17042:A:1, 17043:A:1), "move attacking enemy to the Orcs' area" (17042:A:2), "return Uruk Chieftain to the Orcs' area" (17052:B:2), "add the set aside Uruk Warg-rider to the chosen area" (17048:A:1):
  // the source card (`self`, in an AfterAttack the attacking enemy), the last picked card or the set-aside card with `code` goes into the Orcs' area from wherever it is, an engaged enemy loses its engagement. Nothing changes with no such card or no Orcs' area.
  z.strictObject({ verb: z.literal("MoveToOrcsArea"), target: z.enum(["self", "picked"]).optional(), code: z.string().min(1).optional(), ...when }),
  // "Discard the top card of the encounter deck. Place X progress on this stage, where X is the discarded card's Threat plus the total Threat in the Orcs' area" (17051:B:2 to 17053:B:2; `engaged`: "plus the total Threat of each engaged enemy", 17054:B:2):
  // the top card is discarded, the Orcs' current stage takes X, and a full stage is defeated: its loss (`orcsStageDefeated`) is resolved and the Orcs advance to the next stage, C side first, then D side (hrd.orcs-area).
  z.strictObject({ verb: z.literal("OrcsProgress"), engaged: z.literal(true).optional(), ...when }),
  // "Place 2 progress on the Orcs' stage" (17045:A:3), "place 1 progress on the Orcs' stage" (17050:B:2): the Orcs' current stage takes `amount`, no more than it needs; a full stage is defeated as OrcsProgress says.
  z.strictObject({ verb: z.literal("AddOrcsProgress"), amount: positiveAmountSchema, ...when }),
  // "If this card leaves play, its controller is eliminated" when the card is a Tamed Mûmak (17038:A:3): the actor is eliminated at once, but while an enemy attack on that seat is in progress the elimination waits until that attack has resolved (the Orcs' progress the attack gives resolves first).
  z.strictObject({ verb: z.literal("EliminateAfterAttack"), ...when }),
  // "Each player takes control of a Tamed Mûmak" (17047:A:1): the actor takes one of the set-aside objective allies with these codes into their play area, faceup, ready; with several different cards left the actor is asked (copies of one card are one choice).
  verbFlags(z.strictObject({ verb: z.literal("TakeObjectiveAlly"), codes: z.array(z.string().min(1)).min(1), ...when }), { setupRuns: "inForEachPlayer" }),
  // "Flip the Search objective to On Track / Off Track" (17068:A:2, 17073:A:1, 17075:A:1, 17075:A:2, 17077:A:1, 17078:A:1; hrd.search-objective): the objective card in play shows its other side, keeping its place, and discards each resource when it flips to On Track. Nothing changes
  // when it already shows that side, or while the table holds `cannotFlipSearch` (Lost Underground), unless `despiteBlock` (the side quest's own flips). A flip to Off Track queues `searchFlippedOff` about the objective.
  z.strictObject({ verb: z.literal("FlipSearchObjective"), to: z.enum(["onTrack", "offTrack"]), despiteBlock: z.literal(true).optional(), ...when }),
  // "Track X" (17069:A:1 to 17072:A:1; hrd.track): discards `amount` cards from the top of the encounter deck, the discard pile shuffled back into an empty deck at once (any phase); when one of them has a code in `marked` (the cards that print "On Track" in the lower right
  // corner, read from the scans), it flips the objective to On Track. While the table holds `cannotFlipSearch` Track does not resolve at all: no card is discarded (17075:A:1, "Do not resolve the Track keyword").
  z.strictObject({ verb: z.literal("ResolveTrack"), amount: z.number().int().positive(), marked: z.array(z.string().min(1)).min(1), ...when }),
  // "Search the top 3 cards of the encounter deck for a card with 'On Track' in the lower right corner, add it to the staging area and discard the rest. If no card enters play from this effect, flip this objective" (17080:A:1): the first card of the top `count` with a code in
  // `marked` is added to the staging area, not revealed, the others are discarded, and with none found the objective flips to Off Track. A deck with fewer cards is looked at in full.
  z.strictObject({ verb: z.literal("StageMarkedFromTop"), count: z.number().int().positive(), marked: z.array(z.string().min(1)).min(1), ...when }),
  // "Return the topmost location in the encounter discard pile to the staging area" (17079:A:1): the card of this type put on the discard pile last is added to the staging area. Nothing happens with none.
  z.strictObject({ verb: z.literal("AddTopmostFromDiscard"), cardType: z.literal("location"), ...when }),
  // "Set Brood Mother aside, out of play" (17068:A:3): the card in play with this code, from play, wherever it lies, goes to the set-aside pile with no damage and no controller. Nothing happens with none in play.
  z.strictObject({ verb: z.literal("SetAsideCode"), code: z.string().min(1), ...when }),
  // "The first player randomly selects 1 set aside Harad objective, reveals it, and adds it to the staging area" (17106:A:1, 17107:A:1; hrd.guarded-x-example): one set-aside card with this trait, drawn by the game seed, is revealed by the actor as an encounter card (rr.reveal: its
  // Guarded (X) resolves and it is added to the staging area). Nothing happens with none set aside. The players see which card it is, so the others stay known.
  verbFlags(z.strictObject({ verb: z.literal("RevealRandomSetAside"), trait: z.string().min(1), ...when }), { setupRuns: "top" }),
  // The Dungeons of Cirith Gurat's captives (hrd.captives-of-cirith-gurat). "Attach it to ..." (17121:A:1, 17122:A:2, 17125:A:3, 17128:A:1, 17129:A:1, 17131:A:1, 17134:A:1, 17132:A:1): the character `card` (the last picked by default; a hero of a player, an ally in play or in a discard pile, or with `code` the set-aside
  // card with that code, Abaan) is attached to the encounter card `to` (the source by default), a captive: in play, faceup, controlled by nobody, still its owner's (a Captive, families/captives). The `attached` event is queued about it. With `discardCopies` each other copy of its title in play is discarded.
  // Nothing happens with no card or no host.
  z.strictObject({ verb: z.literal("AttachCaptive"), card: cardRefSchema.optional(), code: z.string().min(1).optional(), to: cardRefSchema.optional(), discardCopies: z.literal(true).optional(), ...when }),
  // "When an objective is free of encounters, it is rescued" (17119:A:3, 17131:A:2): each captive held by the encounter card `host` (the card the answered event is about by default, the source with `self`) returns to its owner's control exhausted (a hero among its owner's heroes, an ally in the play area); one
  // with no owner (Abaan) returns to the staging area. A captive whose owner left the game goes to its owner's discard pile. When any is rescued `charactersRescued` is queued about the main quest stage, once.
  z.strictObject({ verb: z.literal("RescueCaptured"), host: z.enum(["self", "subject"]).optional(), ...when }),
  // "Discard each token and attachment on that character" (17119:A:2): the character (the answered event's subject by default) loses its damage, resource and progress tokens and each attachment on it is discarded.
  z.strictObject({ verb: z.literal("StripCaptive"), target: cardRefSchema.optional(), ...when }),
  // "Dungeon Warg makes an immediate attack against the player who controls the most allies" (17123:A:2): the source enemy in the staging area attacks the living player with the most cards matching `pick` they control, with a shadow card, outside the combat phase and with no engagement (rr.attacks-outside-the-combat-phase); the first
  // player chooses among players that tie (all tie at 0).
  z.strictObject({ verb: z.literal("AttackSeatWithMost"), pick: pickSchema, ...when }),
  // "Discards cards from the top of his deck until an ally that is not in play is discarded" (17132:A:1; `notInPlay`) or "until he discards an ally" (17128:A:1): the actor's top cards are discarded, each announced as discarded from the deck, until an ally is; it is the last picked card. With `notInPlay` an ally whose title a unique ally in play holds is skipped
  // (rr.in-play-and-out-of-play). With no ally in the deck nothing is picked.
  z.strictObject({ verb: z.literal("DiscardUntilAlly"), notInPlay: z.literal(true).optional(), ...when }),
] as const;

const TRIGGERS = [
  // A seat holds more cards in its hand than the table's `handLimit` allows (16045:A:2): the event is about the seat, announced at each settle once nothing is resolving; the record that heard it discards down to the limit.
  "handOverLimit",
  // The temperature changed by a Raise or a Lower (a table event, no seat): the stages' "If the temperature is 60 or higher" loss answers it (16068:B:3, 16069:B:2, 16070:B:3).
  "temperatureChanged",
  // About an Orcs' stage that is full (17052:B:3, 17053:B:3, 17054:B:3): the record that heard it resolves when the Orcs defeat the stage, before they advance. The engine pushes it itself (families/haradrim/orcs-stage.ts); no event is queued.
  "orcsStageDefeated",
  // About the Search objective after it is flipped to Off Track (17074:A:2, 17078:B:2): FlipSearchObjective queues it; a flip to On Track queues none (families/haradrim/track.ts).
  "searchFlippedOff",
  // About the main quest stage, once for everything one effect rescued: at least one captive was rescued (17132:B:2, "After any number of characters are rescued"; RescueCaptured).
  "charactersRescued",
] as const;

const FLAGS = [
  // On a stage: it takes no progress beyond its quest points even while it cannot advance ("This stage cannot have more than 15 progress tokens on it", 16066:B:1, 16067:B:1). Read by putOnStage (src/rules/quest/quest.ts).
  "stageCapped",
  // On a stage: as `stageCapped`, but the cap is the quest points printed on the stage, not a value an effect gave it ("beyond its printed quest points value", 17100:A:2). Read by putOnStage (src/rules/quest/quest.ts).
  "stageCappedPrinted",
  // On the table: no player holds more cards in hand than the amount (5, 16045:A:2); a seat over it raises `handOverLimit` at the next settle. The tightest amount holds.
  "handLimit",
  // On the table, noted by the family's settle hook: the round the current main quest card was first seen in play, as the amount, with the stage as the source (condition `stageInPlayWholeRound`, 16014:A:2). A stage in play from Setup notes round 0.
  "stageEntered",
  // On the table, for the rest of the game: the temperature of the heat tracker (hrd.heat-tracker) as the amount. Absent until Setup sets it; each verb replaces it (families/haradrim/heat.ts).
  "temperature",
  // On a stage: damage from undefended attacks must be dealt to a hero in the staging area if one can take it (16071:B:1, 16072:B:1); the `combat.undefended` hook sends it to those heroes.
  "undefendedToStaged",
  // On an enemy: an ally with less Willpower than the enemy's Threat cannot defend against it (16062:A:1); the `combat.defense` hook reads it.
  "defendersBelowThreat",
  // On the table, for the rest of the game: each location explored is noted for the round ("if a location was explored this round", 17017:A:2); the Setup of The Mûmakil sets it (families/haradrim/explored.ts). Absent, no game notes anything.
  "noteExplored",
  // On the table, until the end of the round: a location was explored (the note `noteExplored` makes; condition `locationExploredThisRound`).
  "exploredThisRound",
  // On an enemy: it cannot leave the Orcs' area ("Uruk Chieftain cannot leave the Orcs' area", 17051:B:1); read by EngageSeatWithMost (families/haradrim/engage.ts).
  "cannotLeaveOrcsArea",
  // On the Tamed Mûmak: the damage of an undefended attack against its controller must be assigned to it (17038:A:2); the `combat.undefended` hook sends it there (families/haradrim/mumak.ts).
  "undefendedToMumak",
  // On the table, until the end of the phase: the total Threat in the Orcs' area is added to the total Threat in the staging area, read live (17046:A:1; families/haradrim/orcs-values.ts orcsStagingRaise).
  "orcsInStagingThreat",
  // On the table, while Lost Underground is in play (17075:A:1, a constant): the Search objective does not flip, except by the side quest's own two flips (`despiteBlock`), and Track does not resolve at all. The flag means both (families/haradrim/track.ts).
  "cannotFlipSearch",
  // On the table, while Off Track is in play: "Progress cannot be placed on the main quest." (17079:A:2): no progress is placed on the main quest card, though a side quest that is the current quest takes it (17079:A:2; mainQuestBlocked in families/haradrim/track.ts, read by quest.ts).
  "noMainQuestProgress",
  // On an enemy in the staging area: it is considered engaged with each player who controls an objective (claimed, attached to a hero), read live: it attacks each of them once in the combat phase and only they declare attackers against it (The Black Serpent on stage 2B,
  // "The Black Serpent is considered to be engaged with each player who controls a Harad objective", 17107:B:2; rr.engaged). Read by core/engaged.ts and families/south/watcher.ts.
  "engagedWithClaimers",
  // On an enemy: it loses the text "Cannot leave the staging area" (The Black Serpent with 6 progress on stage 3B, 17108:B:2): the cannotLeaveStaging it holds is not read (rules/core/zones.ts).
  "losesCannotLeaveStaging",
  // On an enemy that is only considered engaged (The Black Serpent, 17094:A:1): the table reads it to show the enemy as one that is never engaged. That no player optionally engages it is the general rule for cannotLeaveStaging (rules/quest/quest.ts, optionalEnemies).
  "neverEngaged",
  // On the table, while The Captives of Cirith Gurat is in play (17119:A:1): a capture, a rescue and Abaan's freeing push a `captive` step, so the banner and the log say them (families/haradrim/captured.ts). No other game holds it.
  "announcesCaptives",
] as const;

export const manifest = { name: "haradrim", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
