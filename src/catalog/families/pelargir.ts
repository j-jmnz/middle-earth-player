// The vocabulary Peril in Pelargir (Against the Shadow part 1) adds to effect records: Alcaron's Scroll, an objective that hops from a hero to the enemy that damages him, and the cards that look for the hero that holds it; a treachery that
// attaches to the hero with the highest threat cost that has none; the discards from the top of the encounter deck that Collateral Damage counts in two steps; and the first enemy revealed each round. Into Ithilien (part 2) adds the ally objectives that are
// committed to the quest from the staging area, the stage that bypasses the next one, and the first player's taking of every Ranger objective in the staging area. Simple verbs and stat flags; effect-schema-verbs.ts,
// effect-schema.ts and effect-schema-stats.ts compose them. Encounter at Amon Dîn (part 6) adds the villager tokens (their discard and their move, the trigger that hears a discard), the character with the fewest hit points left, and the flags that end the game or hold it. Assault on Osgiliath (part 7) adds the
// control of locations (a location lies in the first player's play area; the verbs that take and lose control, the two triggers that hear an undefended attack and a loss of control, the table's bar on a player card's progress in the staging area). src/rules/families/pelargir/ runs them. The Blood of Gondor (part 8) adds the hidden cards: taking, turning and discarding them, the two objective allies under Captured! and the first player's control of them, the amount of hidden cards and the flags of its stages. The Morgul Vale (part 9) adds the progress tokens placed on a card by its title (To the Tower), the removal of every copy of a title from the game, the card revealed from the encounter deck and put into play engaged with a player, and the flags of the Captains (an enemy that cannot leave play, the damage a Morgul Bodyguard takes for it, an attack a shadow effect ended).
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
  // `card`: the enemy that attacks is this card (the last picked one for "Bellach makes an attack against the player who controls Celebrimbor's Mould", 08123:A:1) instead of the card the answered event is about.
  z.strictObject({ verb: z.literal("AttackScrollHolder"), code: z.string().min(1), card: cardRefSchema.optional(), ...when }),
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
  // `announce`: the log tells a stage that is removed from the quest deck while the quest is at another stage ("The Desert Path leaves the game").
  z.strictObject({ verb: z.literal("RemoveStage"), code: z.string().min(1), announce: z.literal(true).optional(), ...when }),
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
  // "The first player takes control of that location" (06091:B:2; 06105:A:1, ats.controlling-locations): the location the reference names (`subject`, the explored location the Forced effect hears, by default; `picked`, the location a discard stopped at) goes from the discard pile, the victory display,
  // the staging area or the active slot into the first player's play area: faceup, ready, with no progress, its text working there. The table notes who controls it (the flag `controlSeat`), so the loss of that control is seen wherever it comes from. A location already in a play area, or a card that is no location, is left as it is.
  z.strictObject({ verb: z.literal("TakeControlOfLocation"), card: cardRefSchema.optional(), who: z.literal("actor").optional(), ...when }),
  // "Return a location he controls to the staging area" (06093:A:1, 06100:A:2, 06106:A:2; ats.losing-control-of-locations): the location the reference names (`picked` by default) goes to the staging area with its progress removed and nobody controls it; the table announces `controlLost`. A card that is not controlled is left as it is.
  z.strictObject({ verb: z.literal("LoseControlOfLocation"), card: cardRefSchema.optional(), ...when }),
  // "that character's controller must ..." (06100:A:2, 06101:A:2, 06104:A:2; a Shadow effect the attack leaves for its end): the player who controlled the character the attack destroyed (a Sentinel defender may belong to another player than the one attacked) acts for the instructions that follow in the effect. Nothing changes when the attack destroyed no character.
  z.strictObject({ verb: z.literal("ActForDestroyedController"), ...when }),
  // "Add it to the staging area" read as an entry the card's own Forced effect hears (05053:A:1, ats.setup-assault-on-osgiliath, 06091:A:1): the card the reference names (`picked`: the card an earlier SearchMove with `remember` put in the staging area) is announced as added to the staging area. SearchMove announces it for an ambush enemy alone, so a record opts in with this verb; a card not in the staging area is left as it is. A quest card's Setup that names it runs at the start (the piles place the cards, so The Morgul Vale's Setup only announces To the Tower, 06144:A:1).
  verbFlags(z.strictObject({ verb: z.literal("AnnounceAddedToStaging"), card: cardRefSchema.optional(), ...when }), { setupRuns: "top" }),
  // The Blood of Gondor (ats.hidden-cards): "take 1 hidden card" (06117:B:1, 06122:A:1, 06124:A:1): the acting player (`who: firstPlayer` for a Travel cost, "The first player must take 1 hidden card to travel here", 06123:A:3) sets the top `amount` cards of the encounter deck facedown in his play area, unseen and not revealed, as one
  // instruction (the 5-card limit of Captured! is checked once it is done). An empty deck is refilled from the discard pile first; with both empty no card is taken, and a Travel cost of it cannot be paid. src/rules/families/pelargir/hidden.ts.
  z.strictObject({ verb: z.literal("TakeHiddenCard"), who: z.enum(["actor", "firstPlayer"]).optional(), amount: z.number().int().positive().optional(), ...when }),
  // "Turn each of his hidden cards faceup" (06117:B:2, 06118:A:1, 06121:A:1, 06129:A:1): each hidden card the player held when the turn began, one at a time (`eachPlayer`: every player in player order). An enemy engages him at once whatever its engagement cost, a treachery and a location are discarded, none is
  // revealed. `resolve` (Lying in Wait): the When Revealed effects of each card turned resolve too and a location is added to the staging area; `shadow` (Brutal Uruk): each enemy turned is dealt a shadow card.
  z.strictObject({ verb: z.literal("TurnHiddenCards"), who: z.enum(["actor", "firstPlayer", "eachPlayer"]), resolve: z.literal(true).optional(), shadow: z.literal(true).optional(), ...when }),
  // "Turn a hidden card faceup. If that card is an enemy, deal 3 damage to it" (06132:A:2): one hidden card of a player the actor chooses among those who hold one, picked blind with the game's seed, turned as above; an enemy takes `damageEnemy` damage before it engages and one destroyed never engages.
  // `seat` is the engine's own: the player chosen.
  z.strictObject({ verb: z.literal("TurnHiddenCard"), damageEnemy: z.number().int().positive().optional(), seat: z.number().int().min(0).optional(), ...when }),
  // "The first player discards 1 hidden card" (06128:A:3): one hidden card of the player, chosen at random, goes to the encounter discard pile unresolved: nothing engages and no When Revealed resolves.
  z.strictObject({ verb: z.literal("DiscardHiddenCard"), who: z.enum(["actor", "firstPlayer"]), ...when }),
  // "Place Faramir and Lord Alcaron under Captured!" (06118:A:1): each card in play with one of these codes lies under the source stage, still in play and controlled by nobody, committed to nothing.
  z.strictObject({ verb: z.literal("HoldUnderStage"), codes: z.array(code).min(1), ...when }),
  // "The first player gains control of Faramir" (06132:A:1, 06133:A:1): the source card passes to the first player's play area, each time the first player token passes. A card under a stage is not moved.
  z.strictObject({ verb: z.literal("GainControlOfSelf"), ...when }),
  // The engine's own, last in the frame of a treachery that Lying in Wait turned faceup: the treachery lies in the staging area while its When Revealed effect resolves and goes to the encounter discard pile after it, as a revealed treachery does (rr.step-3-3). No record names it.
  z.strictObject({ verb: z.literal("DiscardResolved"), ...when }),
  // The Morgul Vale (ats.captain-enemies, ats.setup-the-morgul-vale-to-the-tower): "place 1 progress token on To the Tower" (06149:A:2, 06150:A:2, 06152:A:1, 06155:A:2, 06157:A:1, 06158:A:2, 06159:A:2): `amount` progress tokens go on the card in play with this title (the staging area counts as play) as the engine places progress on a card, one placement, so a card that hears
  // "progress placed" hears it once. With no such card in play nothing happens. src/rules/families/pelargir/vale/tower.ts.
  z.strictObject({ verb: z.literal("PlaceProgressOnNamed"), name: z.string().min(1), amount: positiveAmountSchema, ...when }),
  // "Remove Faramir from the game" (06147:A:2, ats.setup-the-morgul-vale-to-the-tower): every card a player owns with this title, in a deck, a hand, a discard pile or play (a hero or an ally, its attachments with it), goes out of the game, and nothing is announced as leaving play.
  z.strictObject({ verb: z.literal("RemoveAllNamedFromGame"), name: z.string().min(1), ...when }),
  // "Reveal the top card of the encounter deck. If that card is an enemy, put it into play engaged with the defending player" (06151:A:1): the top card is revealed in full for the acting player (the player the attack was against): its Doomed, When Revealed effects and Surge resolve, an enemy is put into play engaged with him, never staged,
  // and dealt no shadow card, a location or an objective goes to the staging area and a treachery to the discard pile. An empty deck is reset from the discard pile only in the quest phase (rr.running-out-of-cards): in any other phase, Murzag's attack in the combat phase, nothing is revealed. src/rules/families/pelargir/vale/reveal-engaged.ts.
  z.strictObject({ verb: z.literal("RevealTopEngaging"), ...when }),
  // "he makes an additional attack after this one" for each shadow card with no shadow effect he was dealt for the attack that has ended (06152:A:2, several shadow cards): the source enemy makes one immediate attack, dealt a shadow card of its own, and leaves the rest for the end of that attack, one after another (an attack is in progress at a time). `left`: the engine's own, the attacks still to come when the verb runs again at the end of
  // an attack; no record names it. src/rules/families/pelargir/vale/additional.ts.
  z.strictObject({ verb: z.literal("AttackPerBlankShadow"), left: z.number().int().positive().optional(), ...when }),
] as const;

const TRIGGERS = [
  // About a card that held villager tokens: one of them was just discarded (the subject is the card it left; the event names no card, so every card in play hears it), once for each token ("After a villager token is discarded", 06070:A:2; "If a villager token is discarded from a location, objective, or quest stage", 06069:A:1).
  // The tokens of one discard are one occurrence. A move is not heard (src/rules/families/pelargir/villagers.ts).
  "villagerDiscarded",
  // About the player who let an enemy attack go undefended (no defender was declared, or the defender left play before the damage): announced once the attack's damage is dealt, with the enemy as the other card (06096:A:2, ats.losing-control-of-locations). Announced in a game with a record that names it
  // (src/rules/families/pelargir/undefended.ts), for any enemy attack whatever its damage, even none.
  "attackUndefended",
  // About a location a player controlled that left his play area for any reason: returned to the staging area, traveled to, made the active location, or sent to the discard pile with an eliminated player's cards ("loses control of a location", 06103:A:2). The seat is the player who controlled it, the subject the
  // location (src/rules/families/pelargir/location-control.ts, a settle sweep).
  "controlLost",
  // About a location a player took control of (TakeControlOfLocation): the seat is the player who took it, the subject the location ("After a player takes control of Makeshift Fortification", 22017:A:2, 22018:A:2). Announced in a game with a record that names it
  // (src/rules/families/pelargir/location-control.ts), so no other game's events change.
  "controlTaken",
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
  // On the table until the end of the game: the game is ending ("When the players defeat this stage, end the game", 06067:B:2). The constants of Rescued Villagers and Dead Villagers compare the tokens once it is set and Ghulat is not in play (rr.cannot).
  "gameEnding",
  // On the table until the end of the game: Lord Alcaron left play, so the players lose as soon as Ghulat is not in play ("If Lord Alcaron leaves play, the players have lost the game", 06070:A:3; a settle sweep, families/pelargir/ending.ts).
  "endingLost",
  // On the table while a stage is in play: progress placed by a player card's effect on a location in the staging area is not placed ("Player card effects cannot place progress tokens on locations in the staging area", 06091:B:1). Read where an effect places progress on a location (src/rules/families/pelargir/progress-bar.ts).
  "noProgressInStagingByPlayer",
  // On the current quest stage: it does not have the Battle keyword it prints ("The current quest card gains siege (and loses battle)", 06123:A:1); read like `losesSiege` (src/rules/families/pelargir/stage-keyword.ts).
  "losesBattle",
  // On a quest stage that is current: a player who holds 5 hidden cards turns them faceup, one at a time, as soon as an instruction has left him with 5 ("If a player has 5 hidden cards, he must turn them faceup", 06118:B:3; a settle sweep, src/rules/families/pelargir/hidden-sweep.ts).
  "turnsAtFiveHidden",
  // On a location a player controls: the seat that took control, plus 1 (no record sets it; TakeControlOfLocation writes it and a settle sweep reads it to see the control lost). Held until the control is lost.
  "controlSeat",
  // On a Captain enemy while its stage is current: it cannot leave play unless it is destroyed ("Murzag cannot leave play unless destroyed", 06144:B:1, 06145:B:1, 06146:B:2). A Pick that feeds a verb taking the card out of play any other way leaves it out, so no player is offered a target whose effect cannot happen (rr.cannot; src/rules/families/pelargir/vale/cannot-leave.ts);
  // a shuffle of the staging area leaves it where it is, and a settle sweep puts it back in the staging area when an effect with no pick moved it out of play anyway. Returning it to the staging area is not leaving play.
  "cannotLeavePlay",
  // On the same Captain: no move takes it out of play but its destruction, so it keeps its damage, attachments and shadow cards (src/rules/core/zones.ts moveCard, src/rules/families/encounter/moves.ts moveEncounter). The Guardians' "cannot leave play except by a quest effect" (08037:B:1) hold only `cannotLeavePlay`.
  "cannotLeaveUnlessDestroyed",
  // On each Captain enemy while a Morgul Bodyguard is in play: damage that would be dealt to it is dealt to one Bodyguard instead ("Any damage that would be dealt to a Captain enemy is dealt to 1 Morgul Bodyguard instead", 06148:A:1; src/rules/families/defense/damage.ts damageGoesTo asks families/pelargir/vale/bodyguard.ts).
  "shieldedByBodyguard",
  // On an enemy until the end of the attack: a shadow effect ended this attack ("Attacking enemy engages the next player and makes an immediate attack", 06148:A:2), so no damage is dealt and no shadow card that is left resolves (src/rules/combat/shadow.ts resolveAttack asks families/pelargir/vale/switch.ts).
  "attackSwitched",
] as const;

// The underworld deck lies set aside facedown, and the Villain and the Plot the Setup hides stay set aside facedown (06011:A:1): the table lists them as facedown cards without a name.
// The Blood of Gondor: every set-aside encounter card is a hidden card (the objective allies are in play from the Setup).
const ASIDE_SECRETS = [
  { verb: "TakeHiddenCard", deck: true },
  { verb: "BuildUnderworldDeck", codes: ["codes"] },
  { verb: "HideOneAside", codes: ["codes"] },
] as const;

export const manifest = { name: "pelargir", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS, asideSecrets: ASIDE_SECRETS } as const satisfies CatalogFamily;
