// The vocabulary Peril in Pelargir (Against the Shadow part 1) adds to effect records: Alcaron's Scroll, an objective that hops from a hero to the enemy that damages him, and the cards that look for the hero that holds it; a treachery that
// attaches to the hero with the highest threat cost that has none; the discards from the top of the encounter deck that Collateral Damage counts in two steps; and the first enemy revealed each round. Into Ithilien (part 2) adds the ally objectives that are
// committed to the quest from the staging area, the stage that bypasses the next one, and the first player's taking of every Ranger objective in the staging area. Simple verbs and stat flags; effect-schema-verbs.ts,
// effect-schema.ts and effect-schema-stats.ts compose them. src/rules/families/pelargir/ runs them.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { cardRefSchema, positiveAmountSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";
import { pickSchema } from "../effect-schema-pick.ts";
import { verbFlags } from "../verb-flags.ts";

const code = z.string().min(1);
// The card a villager verb names: a reference (the source, the active location, the picked card) or the card in play with this code (Rescued Villagers).
const villagerHolder = z.union([cardRefSchema, z.strictObject({ code })]);

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
  // The Steward's Fear: "Create the underworld deck" (06011:A:1, ats.setup-the-stewards-fear-underworld-deck). The set-aside cards with these codes (the enemies of Streets of Gondor and Brigands, the three Clue objectives) are shuffled with the game's seed and form the underworld deck, facedown,
  // top first. The deck is the set-aside cards that hold `stackedAt`; no card of it is part of the encounter deck, a hand, the staging area or any search until the deck is shuffled into the encounter deck (ShuffleUnderworldIntoEncounterDeck).
  verbFlags(z.strictObject({ verb: z.literal("BuildUnderworldDeck"), codes: z.array(code).min(1), ...when }), { setupRuns: "top" }),
  // "Shuffle all Villain cards and randomly set one aside, out of play, without looking at it. Remove the others from the game" (06011:A:1): of the set-aside cards with these codes one is chosen with the game's seed and stays set aside facedown; the others leave the game, unseen (zone removed).
  // Rolled once for each call, so one seed always hides the same card.
  verbFlags(z.strictObject({ verb: z.literal("HideOneAside"), codes: z.array(code).min(2), ...when }), { setupRuns: "top" }),
  // "Underworld X" (ats.underworld; 06018:A:1, 06021:A:1): the top `amount` cards of the underworld deck (fewer when fewer remain, none when it is empty) are stacked facedown under the host, out of play. `host: self` is the source location that entered play; `host: activeLocation` is the active location
  // ("Place the top card of the underworld deck facedown underneath the active location, if able", 06018:A:2), and with none nothing happens. The cards are revealed one at a time and staged when the location leaves play, whatever location it is (a settle sweep of the family, no record).
  z.strictObject({ verb: z.literal("TakeUnderworld"), amount: positiveAmountSchema, host: z.enum(["self", "activeLocation"]), ...when }),
  // "Reveal the set aside Plot card and add it to the staging area" (06012:A:1), "Reveal the set aside Villain card ..." (06013:A:1): the set-aside card with this Trait (the hidden one) is revealed by the actor as an encounter card (its Doomed, When Revealed, Surge, and the Forced effects that hear a reveal) and so added to the staging area
  // (faq.reveal-and-add). Nothing happens with none set aside.
  z.strictObject({ verb: z.literal("RevealSetAside"), trait: z.string().min(1), ...when }),
  // "Reveal 1 card from the underworld deck and add it to the staging area. If it is a Clue card, discard it instead" (06023:A:2): the top card of the underworld deck is revealed by the actor in full (its When Revealed effects, Surge, Doomed and the Forced effects that hear a reveal) and added to the staging area. A card with the
  // Trait `discardTrait` is placed in the encounter discard pile instead (ats.underworld: "placed in the encounter deck discard pile"). With the deck empty nothing happens.
  z.strictObject({ verb: z.literal("RevealUnderworld"), discardTrait: z.string().min(1).optional(), ...when }),
  // "Shuffle the underworld deck into the encounter deck" (06013:B:1): every card of the underworld deck joins the encounter deck, facedown, and the encounter deck is shuffled. The cards stacked under locations stay there; the deck no longer exists, so a later Underworld takes nothing.
  z.strictObject({ verb: z.literal("ShuffleUnderworldIntoEncounterDeck"), ...when }),
  // "Reveal the top card of the encounter deck, resolve its effects, and discard it" (06016:A:1): the top card goes faceup to the encounter discard pile and never enters play or the staging area; its Doomed threat, When Revealed effects and Surge resolve as in a reveal, and the Forced effects that hear a card revealed from the encounter deck (06016:A:2) hear it. An empty encounter deck is reset from the discard pile first.
  z.strictObject({ verb: z.literal("RevealTopThenDiscard"), ...when }),
  // "Randomly select 1 ally controlled by the first player, if able" (06024:A:1): one card among those the pick finds is chosen with the game's seed and becomes the picked card for the instructions after it. With none nothing is picked.
  z.strictObject({ verb: z.literal("PickRandom"), pick: pickSchema, ...when }),
  // "Remove 1 token from the current quest" (06014:A:2), "remove all tokens from the current quest" (06025:A:2): progress tokens (`progress`), resource tokens (`resource`) or both (`any`, progress first) are taken off the current quest card, `amount` of them (`all` by default, at most the card holds).
  z.strictObject({ verb: z.literal("RemoveQuestTokens"), kind: z.enum(["progress", "resource", "any"]), amount: z.union([z.number().int().positive(), z.literal("all")]).optional(), ...when }),
  // "Each player must pay 1 resource to travel here" (06051:A:2): every living player, the first player first, spends `amount` resources from his own heroes' pools, choosing the hero for each resource when more than one can pay. The players cannot travel here while any player holds fewer
  // than `amount` in all (rr.travel; src/rules/families/pelargir/group-spend.ts, the family's travel hook). A player's pools are his own: no resource of another player pays for him.
  z.strictObject({ verb: z.literal("EachPlayerSpends"), amount: positiveAmountSchema, ...when }),
  // "Prowl X" (ats.prowl, ats.prowl-example): the players as a group discard `amount` resources from their heroes' pools, as many as they can. Each player in turn decides for his own heroes, one resource at a time, and may stop unless the players after him cannot discard the rest;
  // what is left after every player had his turn is discarded as the first player chooses. A discard, not a spend. `rest` and `turns` are the engine's own: the resources still to discard and the players still to decide (src/rules/families/pelargir/group-discard.ts).
  z.strictObject({ verb: z.literal("GroupDiscardResources"), amount: positiveAmountSchema, rest: z.number().int().optional(), turns: z.array(z.number().int()).optional(), ...when }),
  // "Deal 1 damage to that hero. If no hero takes damage, ..." (06053:A:1): the picked card takes `amount` damage as DamageCard deals it, and the effect's X becomes `value` only when the card holds more damage once the responses to it were heard (damage that was canceled or prevented is not damage taken). `before` is the engine's own field.
  z.strictObject({ verb: z.literal("DamageCardThenSetX"), amount: positiveAmountSchema, value: z.number().int().min(0), before: z.number().int().min(0).optional(), ...when }),
  // "Discard 1 villager token from the active location" (06073:A:1, ats.villagers, ats.villager-tokens-discarded): up to `amount` villager tokens (the card's resource tokens, fewer when it holds fewer) leave the card for the token bank. Each token is announced (`villagerDiscarded`, about the card it left), and the
  // effect's X is the number discarded ("If no villager token is discarded by this effect", read with the condition `x`). src/rules/families/pelargir/villagers.ts.
  z.strictObject({ verb: z.literal("DiscardVillagerTokens"), from: villagerHolder, amount: positiveAmountSchema, ...when }),
  // "Take a villager token from Rescued Villagers and place it on a location" (06080:A:1), "move all villager tokens from that location to Rescued Villagers" (06068:A:1), "move an equal number of villager tokens from this quest onto Rescued Villagers" (06066:B:2): up to `amount` tokens (`all`) move from one card
  // to another card in play. A move is no discard: nothing hears it. The number moved is added to the effect's X.
  z.strictObject({ verb: z.literal("MoveVillagerTokens"), from: villagerHolder, to: villagerHolder, amount: positiveAmountSchema.optional(), all: z.literal(true).optional(), ...when }),
  // "Discard the character with the fewest remaining hit points. That character's controller may ..." (06074:A:1): the hero or ally in play (any player's, an objective ally too) with the fewest hit points left, as modified, is the picked card, the first player choosing among those tied; the player who
  // controls it acts for the instructions after it. Nothing is picked when no character is in play. src/rules/families/pelargir/fewest.ts.
  z.strictObject({ verb: z.literal("PickFewestHitPointsLeft"), ...when }),
] as const;

const TRIGGERS = [
  // About a card that held villager tokens: one of them was just discarded (the subject is the card it left; the event names no card, so every card in play hears it), once for each token ("After a villager token is discarded", 06070:A:2; "If a villager token is discarded from a location, objective, or quest stage", 06069:A:1).
  // The tokens of one discard are one occurrence. A move is not heard (src/rules/families/pelargir/villagers.ts).
  "villagerDiscarded",
] as const;

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
  // On the current quest stage (target `table`, while the source is in play): characters use their Willpower, as it stands, instead of their Attack to determine attack strength; attack bonuses are not added ("Characters use their Willpower instead of Attack when attacking enemies", 06044:B:2).
  // The enemy's Defense is still subtracted. Read by rules/combat/combat.ts attackStrength (src/rules/families/pelargir/stage-attack.ts).
  "attackWithWillpower",
  // On the table: the damage a character's attack deals to an enemy becomes progress tokens on that enemy ("If an enemy would be damaged this way, place progress tokens on it instead of damage tokens", 06044:B:2). Damage from an effect, a shadow card or archery stays damage. Read by rules/combat/combat.ts strikeEnemy.
  "attackDamageAsProgress",
  // On the table: an enemy in play with progress equal to (or more than) its printed hit points is added to the victory display, and all its progress goes on the current quest ("When an enemy has progress equal to its hit points, add it to the victory display and place those progress tokens on the quest", 06044:B:2).
  // Checked at every settle (src/rules/families/pelargir/stage-progress.ts).
  "progressToVictory",
  // On the quest stage 1B: the progress that would be placed on it is replaced (the shared list of quest/progress-replaced.ts): none is placed and its record hears `progressReplaced` with the amount, then moves that many villager tokens from the quest card to Rescued Villagers ("When progress would
  // be placed on Savagery of the Orcs, move an equal number of villager tokens from this quest onto Rescued Villagers instead", 06066:B:2).
  "progressToVillagers",
  // On the quest stage 1B: while the card holds no villager token the quest advances at once to the next stage ("If there are no villager tokens on Savagery of the Orcs, advance to the next stage", 06066:B:3; families/pelargir/villagers.ts, a settle sweep).
  "advancesWithoutVillagers",
  // On the quest stage 2B: while it is current, an undefended attack's damage goes to Rescued Villagers and to no hero, and the damage becomes discarded villager tokens ("If an attack goes undefended, discard X villager tokens from Rescued Villagers instead of damaging a hero", 06067:B:1;
  // families/pelargir/villagers.ts, the family's combat hooks).
  "undefendedToVillagers",
  // On the table until the end of the game: the game is ending ("When the players defeat this stage, end the game", 06067:B:2). The constants of Rescued Villagers and Dead Villagers compare the tokens once it is set and Ghulat is not in play.
  "gameEnding",
  // On the table until the end of the game: Lord Alcaron left play, so the players lose as soon as Ghulat is not in play ("If Lord Alcaron leaves play, the players have lost the game", 06070:A:3; the constant of Dead Villagers ends the game).
  "endingLost",
] as const;

// The underworld deck lies set aside facedown, and the Villain and the Plot the Setup hides stay set aside facedown (06011:A:1): the table lists them as facedown cards without a name.
const ASIDE_SECRETS = [
  { verb: "BuildUnderworldDeck", codes: ["codes"] },
  { verb: "HideOneAside", codes: ["codes"] },
] as const;

export const manifest = { name: "pelargir", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS, asideSecrets: ASIDE_SECRETS } as const satisfies CatalogFamily;
