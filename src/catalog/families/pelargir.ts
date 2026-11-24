// The vocabulary Peril in Pelargir (Against the Shadow part 1) adds to effect records: Alcaron's Scroll, an objective that hops from a hero to the enemy that damages him, and the cards that look for the hero that holds it; a treachery that
// attaches to the hero with the highest threat cost that has none; the discards from the top of the encounter deck that Collateral Damage counts in two steps; and the first enemy revealed each round. Into Ithilien (part 2) adds the ally objectives that are
// committed to the quest from the staging area, the stage that bypasses the next one, and the first player's taking of every Ranger objective in the staging area. Simple verbs and stat flags; effect-schema-verbs.ts,
// effect-schema.ts and effect-schema-stats.ts compose them. src/rules/families/pelargir/ runs them.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { cardRefSchema, positiveAmountSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";

const VERBS = [
  // The objective this effect names (the source by default, or the card in play with `code`) is attached to the card the reference names (`card`: the last picked card by default), an enemy in play that may have attachments, and stays a claimed objective
  // that no player controls while an enemy holds it: it returns to the staging area when it is detached, as a claimed objective that says so does (families/objectives/claimed.ts). It leaves the hero or the enemy it is on, or the staging area, and the
  // `attached` event is announced. With `orStaging`, no card to attach to (the pick found none) sends it to the staging area instead ("Attach Alcaron's Scroll to the highest engagement cost enemy in play, if able. Otherwise, add Alcaron's Scroll to the
  // staging area", 05066:B:3; "attach Alcaron's Scroll to that enemy", 05019:A:2).
  z.strictObject({ verb: z.literal("AttachObjectiveTo"), card: cardRefSchema.optional(), code: z.string().min(1).optional(), orStaging: z.literal(true).optional(), ...when }),
  // "Attach this card to the hero with the highest threat cost without a copy of Local Trouble attached" (05041:A:1): the source is attached to the hero with the highest printed threat cost among the heroes (any player's) that carry no copy of it and may have it;
  // the first player chooses among those tied. With no such hero it stays in the staging area and is discarded as a treachery is.
  z.strictObject({ verb: z.literal("AttachToHighestThreatCost"), ...when }),
  // The enemy the answered event is about, in the staging area, makes an immediate attack against the player whose hero has the objective with this code attached, from the staging area ("makes an immediate attack against the player who controls Alcaron's
  // Scroll from the staging area", 05067:B:2): a shadow card is dealt to it and the defender may be declared. With no such player (the objective is in the staging area or on an enemy) no attack is made.
  z.strictObject({ verb: z.literal("AttackScrollHolder"), code: z.string().min(1), ...when }),
  // DiscardEncounterTop, but the cards it discards join the cards the effect has discarded so far, so `discardedMatching` counts them all ("Discard 2 cards from the top of the encounter deck. Discard an additional 2 cards ... Then, raise each player's threat by 2
  // for each location discarded by this effect", 05024:A:1). A deck that runs out is reset when `reset` is set.
  z.strictObject({ verb: z.literal("DiscardEncounterTopMore"), count: positiveAmountSchema, reset: z.literal(true).optional(), ...when }),
  // Raises each player's threat by `amount` for each card of the type that the effect's discards from the top of the encounter deck (DiscardEncounterTop, DiscardEncounterTopMore) put in the discard pile, counted whatever became of it after: a location
  // discarded before the deck was reset in the middle of the effect still counts ("raise each player's threat by 2 for each location discarded by this effect", 05024:A:1).
  z.strictObject({ verb: z.literal("RaiseThreatPerDiscarded"), type: z.enum(["location"]), amount: z.number().int().positive(), ...when }),
  // "Take control of all Ranger objectives in the staging area" (05070:B:1): each objective card with this Trait in the staging area (the ally objectives Celador and the Ithilien Guardians) comes into the first player's play area, faceup and ready. It is no longer
  // committed by its own text (the flag `committedInStaging` holds only in the staging area), and the player may commit it like any ally (ats.ally-objectives). Nothing happens when none is there.
  z.strictObject({ verb: z.literal("TakeControlOfStagedObjectives"), trait: z.string().min(1), ...when }),
  // "Remove stage 4 from the quest deck, if able" (05033:A:2, 05034:A:2, 05035:A:2): the stage with this code is set aside and is no longer part of the quest; the stage that is defeated before it goes to the next stage still in the quest deck. When it is the current stage the
  // quest advances at once to the next stage still in the quest deck, and that stage is revealed. A stage already gone: nothing happens.
  z.strictObject({ verb: z.literal("RemoveStage"), code: z.string().min(1), ...when }),
  // "Resolve the 'when revealed' effect on the topmost treachery card in the encounter discard pile, if able" (05056:A:2): the When Revealed effects (not Doomed, not Surge) of the last treachery placed in the encounter discard pile resolve for the actor; the card stays in the discard pile.
  // With no treachery there nothing happens. Its effects cannot be canceled when `uncancelable` is set.
  z.strictObject({ verb: z.literal("ResolveTopmostTreachery"), uncancelable: z.literal(true).optional(), ...when }),
  // "Count the number of encounter cards in the staging area and shuffle them into the encounter deck" (05061:A:2): every card in the staging area (enemies, locations, objectives) leaves play and goes into the encounter deck, which is shuffled; the effect's X is how many there
  // were, so `RevealEncounter` with `times: { x: true }` reveals as many cards. Nothing in the staging area: X is 0.
  z.strictObject({ verb: z.literal("ShuffleStagingIntoEncounterDeck"), ...when }),
] as const;

const TRIGGERS = [] as const;

const FLAGS = [
  // On an enemy until the end of the attack: the combat damage of its attack goes to the hero that holds the card with `takesAttackDamage`, if one does, and not to the defender ("Any damage dealt by this attack is dealt to the hero with Alcaron's
  // Scroll attached, if able", 05020:A:2, 05024:A:2; src/rules/families/defense/damage.ts damageGoesTo asks families/pelargir/scroll.ts).
  "damageToScroll",
  // On the objective, while it is in play: it is the card `damageToScroll` looks for, and the hero it is attached to takes that damage (05019:A:1).
  "takesAttackDamage",
  // On an enemy until the end of the phase, set as the enemy is engaged by an optional engagement: the engagement was optional ("2 damage instead if Zealous Traitor was not optionally engaged", 05042:A:1), read by the condition `flag` with holder `self`.
  // Set only in a game with a record that reads it (src/rules/engine/machine.ts, the `Engage` intent).
  "engagedOptionally",
  // On the table while its source is in play: a card moving from the top of the encounter deck to its discard pile is announced (`discardedFromEncounterDeck`), as it is in every game with ships ("Each time a location is discarded from the top of the
  // encounter deck", 05023:A:1; src/rules/families/stormcaller/zone.ts).
  "noteDeckDiscards",
  // On an enemy until the end of the phase: the first enemy the encounter deck revealed this round, read by the condition `firstEnemy`; the table remembers it until the round ends (`firstEnemyNoted`). Set only in a game with a record that reads the condition.
  "firstEnemy",
  "firstEnemyNoted",
  // On an ally objective while it lies in the staging area (a constant with `condition: sourceIn staging`): it is committed to the current quest ("While Celador is in the staging area, he is committed to the current quest", 05025:A:1). It counts the stat the quest
  // uses (Willpower, Attack under Battle, Defense under Siege) in the quest total, is a character committed to the quest for every pick and count, and takes archery damage; an ally in play that no player controls leaves play as a guarded ally does (the record
  // sets `guardedAlly` with it). src/rules/families/pelargir/committed.ts; read by rules/quest/quest.ts committedWillpower, rules/interpret/pick.ts and rules/combat/combat.ts archeryRecipients.
  "committedInStaging",
  // On a quest stage (target `self`, with its own `condition`): once the stage is completed the quest goes on to the stage after the next one, which is bypassed ("advance to stage 3A (bypassing stage 2)", 05068:B:2, 05069:B:4). Read by rules/quest/quest.ts
  // advanceStage (families/pelargir/stage-skip.ts).
  "skipsNextStage",
  // On Morgul Spider until the end of the round, set when it is revealed: its constant gives it +1 Attack for each character not committed to a quest, counted again whenever the game changes ("Until the end of the round, Morgul Spider gets +1 Attack for each
  // character not currently committed", 05049:A:1). No engine code reads it: the constant's condition does.
  "attackForUncommitted",
  // On a Battleground location in play (staging or active), a constant holding the amount: once it has this much damage it is removed from the game ("If The Citadel has 11 or more damage, remove it from the game (do not collect its victory points)", 05033:A:1). It is not explored, goes to no
  // pile and hears no Response, and its damage and progress go with it. Checked at every settle (src/rules/families/pelargir/siege.ts).
  "removedAtDamage",
  // On a quest stage: while it is current, the damage of an undefended attack goes to the Battleground location in play with the lowest Threat, and to no hero ("Players must deal damage from undefended attacks to the lowest Threat Battleground location in play", 05072:B:2;
  // src/rules/families/pelargir/siege.ts, the family's combat hook).
  "undefendedToBattleground",
  // On a quest stage: while it is current and no Battleground location is in the staging area or active, the quest advances at once to the next stage still in the quest deck ("If there are no Battleground locations in play, immediately advance to the next stage", 05072:B:2).
  "advancesWithoutBattleground",
  // On a hero: its resources cannot be spent, for a card's cost, an ability's cost or an effect that spends resources ("While Orc Vanguard is in the staging area, resources cannot be spent from the resource pools of heroes who have a Leadership, Spirit, or Lore resource icon", 05058:A:1). Resources can still be gained and moved. Read by rules/families/costs/pay.ts payerOk and
  // rules/families/costs/verbs.ts spendablePools (src/rules/families/pelargir/spending.ts).
  "cannotSpendResources",
  // On the current quest stage: it does not have the Siege keyword ("The Last Battle gains battle and loses siege", 05076:B:3); read by rules/families/quest/conditions.ts currentQuestHas (src/rules/families/pelargir/stage-keyword.ts).
  "losesSiege",
] as const;

export const manifest = { name: "pelargir", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
