// The haradrim family (The Sands of Harad cycle, Escape from Umbar and Desert Crossing): the heat tracker (the temperature), a stage that holds no more progress than its quest points while it cannot advance, a quest card noted for the round it came into play, a hand limit
// on the table, a card placed faceup under a location, and The Long Arm of Mordor's heroes in the staging area (staged and guarded heroes: Captives held by no card or by an Orc, objective-heroes taken by the players). The conditions `stageInPlayWholeRound` and `temperature` and the amount `temperature` are in effect-schema-conditions.ts and effect-schema-amount.ts. src/rules/families/haradrim/ runs and reads them.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { positiveAmountSchema } from "../effect-schema-amount.ts";
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
  // "Each player takes control of a Tamed Mûmak" (17047:A:1): the actor takes one of the set-aside objective allies with these codes into their play area, faceup, ready; with several different cards left the actor is asked (copies of one card are one choice).
  verbFlags(z.strictObject({ verb: z.literal("TakeObjectiveAlly"), codes: z.array(z.string().min(1)).min(1), ...when }), { setupRuns: "inForEachPlayer" }),
] as const;

const TRIGGERS = [
  // A seat holds more cards in its hand than the table's `handLimit` allows (16045:A:2): the event is about the seat, announced at each settle once nothing is resolving; the record that heard it discards down to the limit.
  "handOverLimit",
  // The temperature changed by a Raise or a Lower (a table event, no seat): the stages' "If the temperature is 60 or higher" loss answers it (16068:B:3, 16069:B:2, 16070:B:3).
  "temperatureChanged",
  // About an Orcs' stage that is full (17052:B:3, 17053:B:3, 17054:B:3): the record that heard it resolves when the Orcs defeat the stage, before they advance. The engine pushes it itself (families/haradrim/orcs-stage.ts); no event is queued.
  "orcsStageDefeated",
] as const;

const FLAGS = [
  // On a stage: it takes no progress beyond its quest points even while it cannot advance ("This stage cannot have more than 15 progress tokens on it", 16066:B:1, 16067:B:1). Read by putOnStage (src/rules/quest/quest.ts).
  "stageCapped",
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
] as const;

export const manifest = { name: "haradrim", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
