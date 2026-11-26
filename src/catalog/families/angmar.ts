// The vocabulary Angmar Awakened (mec108) adds to effect records: Time X and its time counters, a card held facedown under a side quest, the cards a side quest holds from the players' hands, the current quest chosen among the quest cards in play, and the
// Setup of the campaign card that names a card and a trade of damage. The amount `questCards` and the conditions `currentQuest` and `questLeads` are in effect-schema-amount.ts and effect-schema-conditions.ts; src/rules/families/angmar runs and reads them.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { cardRefSchema, positiveAmountSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";
import { verbFlags } from "../verb-flags.ts";

const code = z.string().min(1);

const VERBS = [
  // The Time X keyword (mec108.time-x), a constant marker on the card ("Time 4.", 09024:A:1): when the card is revealed (from the encounter deck or by an effect) X resource tokens, its time counters, are put on it, and at the end of each refresh phase one comes off it
  // (RemoveTimeCounters). The last one's removal is heard by the card (`lastTimeCounterRemoved`). With `perPlayer` the amount is multiplied by the players in the game (those still living) when the card is revealed, and the count is never made again ("X is 5 times the number of players", 08013:B:1). The verb itself does nothing when a record runs it.
  z.strictObject({ verb: z.literal("Time"), amount: z.number().int().positive(), perPlayer: z.literal(true).optional() }),
  // The end of the refresh phase (engine use, run by the rules' own frame, not by a card): one time counter comes off each card in play with the Time X keyword that holds one, and a card whose last counter goes is announced (`lastTimeCounterRemoved`).
  z.strictObject({ verb: z.literal("RemoveTimeCounters") }),
  // The card in play with this code, controlled by a player, loses its controller and lies facedown underneath the source, still in play, with its attachments and tokens ("The first player loses control of Iârion and places him facedown underneath this stage", 09024:A:2;
  // rr.in-play-and-out-of-play: it does not leave play). It is in the captive zone (families/south/captive.ts) with no flag, so nothing that names a hero reads it. When the source is defeated the card returns to play under the first player, exhausted, faceup, with its attachments
  // ("When this stage is defeated, the first player takes control of Iârion and exhausts him": families/sidequests/quest.ts defeatSideQuest). Nothing happens when no player controls such a card.
  z.strictObject({ verb: z.literal("HoldUnder"), code, ...when }),
  // The card held under the source is discarded, to the pile its type says: it leaves play from where it lay, so a card that says "if this leaves play" hears it ("discard Iârion", 09024:A:3; mec108.objective-allies).
  z.strictObject({ verb: z.literal("DiscardHeld"), ...when }),
  // The actor places every card of their hand facedown underneath the source, an encounter side quest ("Each player places all cards in his hand facedown underneath Lost in the Wilderness", 09051:A:1). The cards stay their player's and are out of play; ReturnFacedownToHands gives
  // them back. An empty hand puts nothing.
  z.strictObject({ verb: z.literal("PlaceHandUnderSelf"), ...when }),
  // The first player chooses a quest card other than the current quest to be the current quest until the end of the phase: the main quest card or a side quest in the staging area, encounter or player ("choose a different quest card in play to be the current quest", 09049:A:2;
  // mec108.side-quests-in-play). Nothing is chosen when there is only the current one.
  // `until: "endOfRound"` (132066:A:2): a side quest chosen keeps the current-quest mark to the end of the round, not the phase; the stages of The Battle of Five Armies stay current until the next round's choice (hob.current-quest-stage).
  z.strictObject({ verb: z.literal("ChooseCurrentQuest"), until: z.literal("endOfRound").optional(), ...when }),
  // Campaign Setup: a copy of the card from the supply is put into play attached to the card in play with this title ("Attach Iârion's Pendant to Iârion", 10156:A:2). It resolves after the quest card's Setup, which puts the host into play; with no such host nothing is attached.
  verbFlags(z.strictObject({ verb: z.literal("AttachNewTo"), code, to: z.string().min(1) }), { setupRole: "afterSetup" }),
  // Campaign Setup: starting with the first player, each player may place `damage` damage on the card with this code to add `resources` resource to each of their heroes' pools ("each player may place 4 damage on Protect the Innocent to add 1 resource to each of their heroes'
  // resource pools", 10156:A:2). The tokens are placed, not dealt: nothing cancels them, and a player may take the card to its limit. `seat` is engine use: the player whose turn it is.
  // A constant marker on a quest stage ("The first Weather treachery card revealed each round gains surge", 09069:B:1): the first card with this Trait revealed in a round (from the encounter deck or by an effect) gains Surge as it is revealed (rr.surge). `type` is the card type, a treachery unless it says "enemy" ("The first Undead enemy revealed each round gains surge", 09039:A:1, a marker with a record condition: while Haunted Keep is the active location); "any" is a card of any type, one tally for all of them ("The first Hazard card revealed each round gains surge", 50604:B:1). Each Trait has one tally a round, kept while no card holds the marker.
  // `doomed`: the card also gains Doomed X as it is revealed ("The first Scout enemy revealed from the encounter deck each round gains surge and doomed 2", 00008:A:1), on top of its printed Doomed (rr.keywords).
  z.strictObject({ verb: z.literal("FirstTraitSurge"), trait: z.string().min(1), type: z.enum(["treachery", "enemy", "any"]).optional(), doomed: z.number().int().positive().optional() }),
  // "Until the end of the phase, each card revealed by the encounter deck gains doomed 1. (Doomed 3 instead if the players have crossed the Anduin.)" (00014:A:2): a lasting effect of an encounter card, so it is
  // recalculated as each card is revealed (faq.lasting-effects): every card revealed from now until `until`, a surge-revealed one included, gains Doomed `amount` (rr.keywords: it adds to a printed Doomed), or
  // `instead.amount` while the current stage is `instead.stage`. The card that holds the effect was revealed before it and gains nothing.
  z.strictObject({ verb: z.literal("RevealedGainDoomed"), amount: z.number().int().positive(), instead: z.strictObject({ stage: z.number().int().positive(), amount: z.number().int().positive() }).optional(), until: z.enum(["endOfPhase", "endOfRound"]) }),
  // The phase in progress ends once the effect that ends it has finished: the steps of the phase left are skipped and the next phase begins ("End the current phase", 09070:A:1; mec108.campaign-mode). In the quest phase the characters stay exhausted but are no longer committed and
  // the quest is not resolved (as EndQuestPhase); in the combat phase the attacks left are not made.
  z.strictObject({ verb: z.literal("EndPhase"), ...when }),
  // Campaign Setup: the card in play with this code gets the damage the Campaign Log noted for it ("place damage on it equal to the amount of damage noted for it in the Campaign Log", 10159:A:2): the Protect the Innocent damage, 0 when none is noted.
  // Only Protect the Innocent (10158) and Arnor Ravaged (100158) have damage the log notes (`protectDamage`), so no other code is accepted.
  verbFlags(z.strictObject({ verb: z.literal("PlaceLoggedDamageOn"), code: z.enum(["10158", "100158"]) }), { setupRole: "afterSetup" }),
  // Starting with the first player, each player may choose 1 of the boons that are still set aside and attach it to a hero they control ("each player may choose 1 of the following boons and attach it to a hero they control", 10160:A:3): the player picks a boon or none, then the hero.
  // A boon taken is not offered again. `seat` is engine use: the player whose turn it is.
  z.strictObject({ verb: z.literal("ChooseBoon"), codes: z.array(code).min(1), seat: z.number().int().min(0).optional(), ...when }),
  // After Thaurdir enters play (campaign mode): of the burdens named that the game set aside, one is picked at random (the game's seed) and attached to the card the record names, `to` (the event's card by default), even to a card that cannot have attachments: a campaign burden
  // may ("randomly select one of the following burdens and attach it to Thaurdir", 10166:A:3). Nothing is attached with none set aside (standalone play).
  z.strictObject({ verb: z.literal("AttachRandomBurden"), codes: z.array(code).min(1), to: cardRefSchema.optional(), ...when }),
  // The source burden moves to the hero (any player's) that holds the most resources, non-objective attachments or damage ("move Thaurdir's Legacy to the hero with the most resources", 10168:A:2). The hero it is on counts, so it stays when that hero holds the most;
  // the first player chooses among heroes that tie (rr.first-player).
  z.strictObject({ verb: z.literal("MoveToHero"), most: z.enum(["resources", "nonObjectiveAttachments", "damage"]), ...when }),
  // Setup of a pool card (a later scenario): the source attaches to the card in play with this title, or with `outOfPlay` to one set aside as well; with no such card it is removed from the game ("Attach to Thaurdir (even if he is out of play). Otherwise, remove this card
  // from the game", 10168:A:1; "Attach to Amarthiúl. Otherwise, remove ... from the game", 10167:A:1).
  z.strictObject({ verb: z.literal("AttachSelfToNamed"), name: z.string().min(1), outOfPlay: z.boolean().optional(), ...when }),
  // The Time objective (Daybreak / Nightfall, one double-sided card) shows `to` faceup (`other`: its other side): the state is Day or Night as the side up says (mec108.day-and-night). The cards in play hear that it became Day (`becameDay`) or Night (`becameNight`);
  // a flip to the side already up changes nothing and announces nothing ("Flip the Time objective to Nightfall", 10015:A:1, 10026:A:1; "flip this objective", 10011:A:3). Nothing happens with no Time objective in play.
  z.strictObject({ verb: z.literal("FlipTimeObjective"), to: z.enum(["day", "night", "other"]), ...when }),
  // Marks in the Campaign Log that each player's starting threat is changed by `amount` (a reduction is negative), cumulative with the marks it holds ("each player's starting threat is reduced by 2", 10173:A:2): the game's resolution log carries the change to the campaign log
  // when the scenario is won, which adds it to the log's one starting threat modifier. A lost game writes nothing (rr.campaign-mode). A seat's starting threat is never below 0.
  z.strictObject({ verb: z.literal("RecordStartingThreat"), amount: z.number().int(), ...when }),
  verbFlags(z.strictObject({ verb: z.literal("TradeDamageForResources"), code, damage: z.number().int().positive(), resources: z.number().int().positive(), seat: z.number().int().min(0).optional() }), { setupRole: "afterSetup" }),
  // The Safe keyword (mec108.safe), a constant marker on an objective-location ("Guarded. Safe.", 10068:A:1): the engine finds the cards with it by their records (the pick filter `safe`, the condition `safeActive`). The verb does nothing when a record runs it; what a safe
  // location does while it is the active location is written with ordinary records beside it.
  z.strictObject({ verb: z.literal("Safe") }),
  // Setup (Into the Ettenmoors, 10064:A:1): of the set-aside encounter side quests one is picked at random (the game's seed) and of the set-aside objective-locations one, and both are revealed and added to the staging area (the location's own Guarded keyword takes no further
  // card) with the side quest attached to the location as its guard ("with the safe location guarded by the side quest"). Nothing happens when either kind is not set aside.
  verbFlags(z.strictObject({ verb: z.literal("StageRandomGuardedPair"), ...when }), { setupRuns: "top" }),
  // The card (the last picked card by default, `target` by ref) is revealed by the actor as an encounter card, wherever it lies: its Surge and Doomed, its When Revealed effects and the Responses to a reveal resolve, and it ends where its type puts it (a side quest in the staging area)
  // ("discard cards ... until a side quest is discarded, reveal it, and add it to the staging area", 10064:B:1, 10065:A:1, 10066:A:1). Nothing happens when no card is picked (a discard that ran the deck out).
  z.strictObject({ verb: z.literal("RevealCard"), card: cardRefSchema.optional(), ...when }),
  // The encounter cards attached to the card (the last picked card by default) as its guards stay in the staging area, no longer guarding it: the objective may then leave play without them ("Shuffle 1 location with the safe keyword (but not its attached encounter) back
  // into the encounter deck", 10075:A:2; rr.guarded). Nothing happens when nothing guards the card.
  z.strictObject({ verb: z.literal("ReleaseGuards"), target: cardRefSchema.optional(), ...when }),
  // The source (the campaign card) holds `tokens` resource tokens or more and a copy of `code` is set aside: the tokens come off the source and that copy is revealed (a full reveal, as RevealCard), ending in the encounter discard pile as its type puts it ("remove 3 resources from it to
  // reveal 1 set-aside copy of Losing Time and place it in the encounter discard pile", 10182:A:3). With fewer tokens or no copy set aside nothing happens and no token comes off.
  z.strictObject({ verb: z.literal("RevealSetAsideForTokens"), code, tokens: z.number().int().positive(), ...when }),
  // Resolution: one copy of each of the cards with these codes for every copy of it that lies in the encounter deck or the encounter discard pile joins the Campaign Pool ("Add each copy of Losing Time in the encounter deck or encounter discard pile to the Campaign Pool", 10182:B:1);
  // a copy set aside, in the staging area or attached does not count. Run by the Resolution (src/rules/setup/resolution.ts).
  z.strictObject({ verb: z.literal("EarnEncounterCopies"), codes: z.array(code).min(1), ...when }),
  // Stage 1 of The Treachery of Rhudaur ("remove each Treachery of Rhudaur side quest from the game", 10094:B:2): each card in the staging area with one of these titles, quest side up, leaves the game (not the victory display); its attachments are discarded with it. A card flipped into its Clue objective has another title and stays.
  z.strictObject({ verb: z.literal("RemoveSideQuestsFromGame"), names: z.array(z.string().min(1)).min(1), ...when }),
  // The actor removes `amount` progress from among the quest cards in play, one token at a time from the quest card they choose; with fewer than `amount` on them all of it comes off ("remove X progress from among the quests in play", 10107:A:1). `left` is engine use: the tokens still to go.
  z.strictObject({ verb: z.literal("RemoveProgressAmong"), amount: positiveAmountSchema, left: z.number().int().min(1).optional(), ...when }),
  // A constant marker on a side quest ("When this quest is defeated, flip it over", 10109:A:3): when it is defeated it is not added to the victory display but flips into the objective with this code and stays in the staging area, faceup and unclaimed (mec108.the-investigation).
  // The verb does nothing when a record runs it; families/sidequests/quest.ts defeatSideQuest reads it.
  z.strictObject({ verb: z.literal("FlipWhenDefeated"), into: code }),
  // The card in play with either of these codes (the two sides of a card whose sides are two cards, Thaurdir 10127 / 10128) shows its other side, where it lies, keeping its tokens, damage, shadow cards and attachments, and the new side hears that it was flipped
  // (`flippedOver`, as FlipInPlace): "flip him" whichever side is up ("Flip Thaurdir", 10138:A:1; "flip him", 10125:B:3). Nothing happens with neither in play.
  z.strictObject({ verb: z.literal("FlipTwoSided"), front: code, back: code, ...when }),
  // Deals each enemy in play (staging area and engaged with a player) one shadow card from the top of the encounter deck, in the order the staging area then the players hold them; with `target`, only that enemy, wherever it is ("deal 1 shadow card to each enemy in play",
  // 10127:A:4, 10134:A:2; "deal 1 shadow card to Werewolf of Angmar", 10131:A:1). The cards stay with the enemies facedown (they resolve when the enemy attacks); an empty deck deals none. Each deal is heard by the enemy (`shadowDealtTo`).
  // As a Travel line it is a cost: the players cannot travel to the location while the encounter deck holds fewer cards than there are enemies in play (rr.travel, rr.cost). With `trait`, only the enemies in play with that Trait count and are dealt one ("Deal 1 shadow card to each Undead enemy in play to travel here",
  // 101159:A:2: the Reanimated Dead and Daechanar are Undead).
  z.strictObject({ verb: z.literal("DealShadowInPlay"), target: cardRefSchema.optional(), trait: z.string().min(1).optional(), ...when }),
  // The actor searches their deck for the cards with the same title as the card the effect picked last (`of: picked`: the card DiscardRandomFromHand `remember`ed) or as the other card of the event (`of: other`: the ally the attack destroyed, only when it is an ally), and discards
  // each of them (`all`) or one of them; with `shuffle` the deck is shuffled after ("Each player then searches his deck for each other copy of the card he discarded, and discards those as well. Shuffle each searched deck", 10136:A:1; "search your deck for another copy of that ally and discard it, if able", 10137:A:2).
  // Nothing happens with no such card picked. A copy is a card with the same printed title (rr.unique-cards).
  z.strictObject({ verb: z.literal("DiscardCopiesFromDeck"), of: z.enum(["picked", "other"]), all: z.boolean().optional(), shuffle: z.boolean().optional(), ...when }),
  // The Dread Realm (mec108.reanimated-dead): the cards the source names are placed facedown in front of the player (the actor, or the first player) as if they had just engaged them, and act as Undead enemies (0 engagement cost, 2 Threat, 2 Attack, 2 Defense, 2 hit points, no text) until they leave play,
  // by any exit, for their owner's discard pile. `deckTop`: the top `count` cards of the player's own deck (1 by default, at most the deck holds; "reanimates the top card of his deck", 10150:A:1). `handRandom`: a card of their hand chosen by the game's seed ("a random card from his hand", 101158:A:1).
  // `discardTop`: the card on top of their discard pile when it is an ally that the effect just discarded from the top of a deck with DiscardFromDeck ("each ally he discarded by this effect", 101159:A:1). `card`: the card the effect names (`picked` by default, `subject`, `other`) when it lies in a discard pile ("reanimate that character", 10155:A:1). `destroyed`: the character the attack that left
  // the effect destroyed ("If this attack destroys a character, reanimate that character", 101161:A:2). `to: staging` adds the card to the staging area instead of engaging the player (101162:A:2). Each card reanimated becomes the effect's last picked card (a failed one leaves none), so a later instruction (DealShadowInPlay
  // `target: picked`, "deal it 1 shadow card") acts on it. Reanimating counts as an enemy engaging the player (rr.engaged): the player's "after an enemy engages you" Responses hear it.
  verbFlags(z.strictObject({ verb: z.literal("Reanimate"), from: z.enum(["deckTop", "handRandom", "discardTop", "card", "destroyed"]), count: positiveAmountSchema.optional(), card: cardRefSchema.optional(), who: z.enum(["actor", "firstPlayer", "controller", "defending"]).optional(), to: z.enum(["engaged", "staging"]).optional(), ...when }), { setupRuns: "inForEachPlayer" }),
  // The "when revealed" effects of the cards with this Trait that the effect names, in the order they lay (The Dread Realm): `heldShadows` the shadow cards dealt to the source, resolved by the defending player after the shadow effects ("if they have the Sorcery trait, resolve
  // their 'when revealed' effects", 101156:A:1, a Forced on `shadowsResolved`); `looked` the cards the effect discarded from the top of the encounter deck with DiscardEncounterTop, which lie in the discard pile ("Resolve the 'when revealed' effects of each Sorcery card discarded by this effect", 101158:A:2). With `name` instead of `trait`, the cards with that printed title ("Resolve the 'when revealed' effects of each copy of A Foe Beyond discarded by this effect", 901202:B:1).
  // A card that no longer lies where it was (it attached itself) is not resolved twice.
  verbFlags(z.strictObject({ verb: z.literal("ResolveWhenRevealedOf"), of: z.enum(["heldShadows", "looked"]), trait: z.string().min(1).optional(), name: z.string().min(1).optional(), ...when }).refine((verb) => (verb.trait == null) !== (verb.name == null), "ResolveWhenRevealedOf names a trait or a title, not both"), { runsInFrame: true }),
  // The source, a card that has just left play, is dealt facedown as a shadow card to the card the effect picked last, an enemy in play ("deals Sinister Dungeon to it facedown as a shadow card", 101158:A:1): it goes from the encounter discard pile to that enemy with no tokens, and resolves its Shadow effect when
  // the enemy attacks. Nothing happens when no enemy is picked.
  z.strictObject({ verb: z.literal("DealSourceAsShadow"), ...when }),
  // The source, an enemy that has left play (Wraith of Carn Dûm), attaches to the card the effect picked last and counts as an attachment: it has no enemy text while it lies there, and when its host leaves play it returns to the staging area as an enemy instead of being discarded with it ("attach it to a character in play ... If
  // the attached character leaves play, return Wraith of Carn Dûm to the staging area as an enemy", 101157:A:1). Discarded by another effect while attached it is simply discarded. Nothing happens with no card picked.
  // `to: other`: the card the answered event names as its other card ("attaches to the defending character", Writhing Tentacle 901503:A:1: the event is the attack's end and names its defender; nothing is attached when the attack was undefended or the character left play).
  // `returns: discard`: a Tentacle attachment (The Watcher in the Water, 04073:A:1, 901503:A:1, 901504:A:1): it is no enemy while it lies there and goes to the encounter discard pile with the others when its host leaves play (`asAttachment: "discard"`).
  z.strictObject({ verb: z.literal("AttachEnemyToPicked"), to: z.literal("other").optional(), returns: z.literal("discard").optional(), ...when }),
  // The ally with the highest printed cost among every player's allies in play (an X cost or no printed cost counts 0) is destroyed; the first player chooses among those that tie. It becomes the effect's last picked card and lies in its owner's discard pile; with no ally in play nothing is picked ("Destroy the highest cost ally
  // in play", 101162:A:2).
  z.strictObject({ verb: z.literal("DestroyHighestCostAlly"), ...when }),
  // The card the answered event names as its other card is discarded when it is still in play: the card an attachment that takes its host with it (the flag `discardsHost`) lay on, heard through `attachmentLeft` ("If Possession is discarded, the attached card is also discarded", 101162:A:2).
  z.strictObject({ verb: z.literal("DiscardOtherInPlay"), ...when }),
  // The card the effect picked last leaves the game, out of play for the rest of it: no leaves-play Forced of its own is announced to bring it back, and the Campaign Pool is untouched ("remove a Sorcery card from the game", 10153:A:3; rr.removed-from-game). Nothing happens with no card picked.
  z.strictObject({ verb: z.literal("RemovePickedFromGame"), ...when }),
] as const;

const TRIGGERS = [
  // About the card that held a time counter: its last one was just removed at the end of the refresh phase (the subject is the card; mec108.time-x): "After the last time counter is removed from this stage".
  "lastTimeCounterRemoved",
  // About the current quest stage: a time counter was just taken off it, one counter at a time, by the refresh phase or a card ("After a time counter is removed from the current quest", 07058:A:1). Raised only in a game whose records hear it (families/angmar/time.ts removeTimeCounterFrom).
  "timeCounterRemoved",
  // About the enemy whose attack just damaged a character (a hero or an ally; the other card is the character), once for the attack: "After an attack damages a character" (10158:A:1). Damage canceled or prevented is not damage, and an attack that damages nobody is not heard.
  "attackDamagedCharacter",
  // The Time objective was flipped to Daybreak or to Nightfall (not heard at Setup, where Daybreak is dealt faceup): every card in play hears it, the staging area and the quest card included ("Forced: When it becomes Night, reveal an encounter card", 10012:A:2).
  "becameDay",
  "becameNight",
  // About a hero: resources were spent from its pool in a payment (a card played, an ability or a Response paid for), once for each hero whose pool paid ("After 1 or more resources are spent from a hero's resource pool", 10082:A:1). Resources moved or removed by an effect are not spent.
  "heroResourcesSpent",
  // About a card that holds `progressSponge`: it left play from the staging area (explored there by progress, discarded, shuffled away or removed; travelling to it keeps it in play) ("If Forbidden Descent leaves play from the staging area", 10101:A:2).
  "leftStagingArea",
  // About a card a search put into play: an encounter card found in the encounter deck or discard pile and added to the staging area ("each Undead enemy that enters play", 10109:A:1, hears it beside `encounterEnteredPlay`, which a search does not announce). Queued only in a game whose records name it.
  "searchedIntoPlay",
  // About an enemy: a shadow card was just dealt to it, wherever it is (the subject is the enemy): "If there are 3 shadow cards dealt to Thaurdir" (10125:B:3), "after a shadow card is dealt to Werewolf of Angmar" (10131:A:2). A record reads the count with the amount `shadowCards`.
  // Queued only in a game whose records name it.
  "shadowDealtTo",
  // About an enemy that holds shadow cards: its attack's shadow cards have resolved, shadow effects first, and damage has not been dealt yet (the subject is the attacking enemy; rr.step-6-4-2): "When you resolve shadow cards dealt to Witch of Angmar" (101156:A:1). Queued only in a game whose records name it.
  "shadowsResolved",
  // About an attachment that holds `discardsHost` and left its host by any exit but removal from the game: the subject is the attachment, the other card its host ("If Possession is discarded, the attached card is also discarded", 101162:A:2). Queued only for a card that holds the flag.
  "attachmentLeft",
] as const;

const FLAGS = [
  // On a side quest: progress that would be placed on it removes that much damage from it instead (10158:A:2; families/wilderland/night-quest.ts placeOnCurrentSideQuest).
  "progressRemovesDamage",
  // On a card: it has the Surge keyword ("While there is only 1 quest card in play, Shrouded Hills gains surge", 09048:A:2): the reveal frame reads it as it reads the printed keyword (rr.surge; windows/frames.ts).
  "gainsSurge",
  // On the table, until the end of the round: a card with the Trait a FirstTraitSurge names was revealed (the round's first has gained surge).
  "traitRevealed",
  // On the characters a blankText modifier holds (target `damagedCharacters`): their keywords stay although the rest of the printed text box is treated as blank ("except for keywords and Traits", 09054:A:1; rr.blank).
  "keepsKeywords",
  // On the table, until the end of the phase: an EndPhase ran, and the phase ends once the effect that ran it has finished (families/angmar/phase.ts).
  "phaseEnds",
  // On a hero (target `host`), until the end of the phase: its controller may play an attachment from their discard pile onto this hero, paying its cost; the play uses it up ("Play an attachment from your discard pile on attached hero", 10165:A:4; families/angmar/discard-play.ts).
  "attachmentFromDiscard",
  // Held by the table while a card in play says so (the side quest The Power of Angmar while it is in the staging area): no player card effect takes a card out of a discard pile ("Cards in each player's discard pile cannot leave that player's discard pile by player
  // card effect", 09067:A:2). A Pick `from: discard`, ShuffleDiscardIntoDeck and the play of a card from the discard pile (PlayFromDiscard, Stalwart) read it for a player card's effect; an encounter card's effect is not stopped (families/angmar/lock.ts).
  "discardLocked",
  // On a hero (target `host`): its printed Traits are treated as blank as well as its text box ("treated as if its printed text box were blank", Thaurdir's Legacy, 10168:A:2; rr.blank): `hasTrait` ignores the printed Traits, while a Trait another card grants stays. Set beside `blankText`.
  "blanksTraits",
  // On an enemy (the card itself): while a player makes an engagement check against it, its engagement cost changes by this amount for each damaged character that player controls, hero or ally, not below 0 ("-1 engagement cost for each damaged character that player controls", 10020:A:2;
  // families/angmar/check-cost.ts). An optional engagement does not read it (rr.optional-engagement).
  "checkCostPerDamaged",
  // On the table, while a location with the Safe keyword is the active location (Across the Ettenmoors, mec108.safe): the "when revealed" effects of every treachery card are ignored ("ignore the 'when revealed' effects of all treachery cards"); the treachery is still revealed and keeps its keywords.
  "treacheryRevealIgnored",
  // On an enemy (the card itself): a damaged character cannot be declared as an attacker against it nor as a defender against its attack ("Damaged characters cannot be declared as attackers or defenders against Goblin Pursuer", 10076:A:1; families/angmar/combat.ts).
  "damagedCannotFace",
  // On an enemy (the card itself): the combat damage its attack deals beyond the remaining hit points of the character it damages takes that many progress tokens off each quest card in play ("remove 1 progress from each quest card in play", 10074:A:1; families/defense/excess.ts).
  "excessToEachQuest",
  // On a hero (target `host`): it collects no resources in the resource phase ("does not collect resources during the resource phase", No Rest, 10080:A:1); a resource an effect adds still lands in its pool.
  "noCollection",
  // On a side quest, until the end of the round: progress was placed on it this round ("if no progress was placed on Lie Low this round", 10081:A:1; families/angmar/progress.ts). The engine notes it for every side quest that takes progress; a record reads it with the condition `flag`.
  "progressPlacedHere",
  // On the main quest card: it cannot be chosen as the current quest during the quest phase (10094:B:3); a side quest chosen at the start of the phase is the current quest, else there is none (families/wilderland/night-quest.ts currentQuestId).
  "cannotBeCurrentQuest",
  // On the main quest card, from a constant "if" ("If there are no Treachery of Rhudaur side quests in play, immediately advance to stage 2", 10094:B:4): once nothing is resolving the quest advances (families/angmar/stage.ts advanceWhenFlagged, a settle sweep).
  "advanceNow",
  // On a card: the Doomed X it gains is the amount of this modifier, on top of its printed Doomed ("While the current quest has 0 progress on it, Wight of Rhudaur gains doomed 2", 10099:A:2; read as the card is revealed, windows/frames.ts, rr.doomed-x).
  "gainsDoomed",
  // On the table, from RevealedGainDoomed: each card revealed while it holds gains Doomed (the modifier's amount, or its `stageAmount` while that stage is current).
  "revealDoomed",
  // On a character the attack in progress damaged, until the end of the phase: its Willpower then, kept for an effect that reads the destroyed character's Willpower (engine use, families/angmar/last-known.ts).
  "lastWillpower",
  // On a location in the staging area: the first 2 progress that would be placed on a quest card each round are placed on it instead ("the first 2 progress that would be placed on a quest each round must be placed on Forbidden Descent, instead", 10101:A:1; families/angmar/sponge.ts). Each copy takes 2 a round.
  "progressSponge",
  // On the table, while a card in play says so (Ghostly Ruins, staged or active): whenever the encounter deck runs out of cards in the quest phase, the topmost Undead enemy in the encounter discard pile returns to the staging area before the deck is reset ("Any time the encounter deck runs out of cards", 10103:A:1; families/angmar/run-out.ts).
  "returnsUndeadOnRunOut",
  // On a progressSponge card: the progress it took this round (engine use, until the end of the round).
  "spongeTaken",
  // On the table, while a card in play says so (the stage 1B of The Battle of Carn Dûm): unresolved shadow cards are not discarded at the end of the combat phase, so those dealt to enemies that did not attack stay and add up; the cards of an attack that was made go as ever. Where an enemy
  // makes an attack from the staging area, the shadow cards it holds are not discarded before the new one is dealt, so they all resolve (10125:B:2; combat/shadow.ts discardShadows, families/south/watcher.ts dealForAttack).
  "keepShadowCards",
  // On the table, amount N, while a card in play says so (Mountains of Angmar as the active location): a shadow card with no shadow effect of its own gains "Shadow: Raise defending player's threat by N" as it is flipped (10133:A:1; combat/shadow.ts resolveShadowCard).
  "blankShadowGains",
  // On the table, held by each Orc Grunts in play (the amount is how much): any time progress is placed on the current quest, the amount placed is reduced by this much, after the active location and a sponge took theirs ("reduce the amount of progress placed by 1", 10130:A:2;
  // families/angmar/progress.ts reduceQuestProgress). Several holders add; the amount stops at 0.
  "questProgressReduced",
  // On an enemy that holds cannotLeaveStaging: it still leaves the staging area when damage destroys it, the one exit it has (Thaurdir on stage 2B, "cannot leave the staging area ... If Thaurdir is defeated, you win the game", 10126:B:1, 10126:B:3; core/zones.ts moveCard).
  "leavesStagingWhenDefeated",
  // On an enemy that attacks from the staging area (Thaurdir on stage 2B): the shadow cards it holds as its first attack of the combat phase begins are not discarded first, so they resolve with it together with the card dealt for it (10126:B:1; families/south/watcher.ts dealForAttack).
  "resolvesHeldShadows",
  // On an attachment (the card itself): when it leaves play with its host still in play, it takes the host with it, which is discarded too (Possession on the Reanimated Dead it made, 101162:A:2); removed from the game it takes nothing.
  "discardsHost",
  // On a quest stage (the card itself): when the quest advances, each Sorcery card attached to the stage is attached to the next stage instead of being discarded with this one ("all Sorcery cards attached to this stage are attached to stage 2B", 10150:B:2; families/angmar/reanimate/stage.ts, read by quest.ts advanceStage).
  "passesSorcery",
  // On a hero (target `host`): during the quest phase its controller may not leave it out of the quest: they cannot pass the commitment while it is able to commit (ready, not barred from questing) and has not ("attached hero must commit to the quest, if able", A Fell Dread, 101163:A:1; rules/engine/legal.ts).
  "mustCommit",
] as const;

export const manifest = { name: "angmar", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
