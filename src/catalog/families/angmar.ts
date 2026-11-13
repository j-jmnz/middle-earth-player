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
  // (RemoveTimeCounters). The last one's removal is heard by the card (`lastTimeCounterRemoved`). The verb itself does nothing when a record runs it.
  z.strictObject({ verb: z.literal("Time"), amount: z.number().int().positive() }),
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
  // The first player chooses a quest card other than the current quest to be the current quest until the end of the phase: the main quest card or an encounter side quest in the staging area ("choose a different quest card in play to be the current quest", 09049:A:2;
  // mec108.side-quests-in-play). A player side quest in a quest area cannot be the current quest. Nothing is chosen when there is only the current one.
  z.strictObject({ verb: z.literal("ChooseCurrentQuest"), ...when }),
  // Campaign Setup: a copy of the card from the supply is put into play attached to the card in play with this title ("Attach Iârion's Pendant to Iârion", 10156:A:2). It resolves after the quest card's Setup, which puts the host into play; with no such host nothing is attached.
  verbFlags(z.strictObject({ verb: z.literal("AttachNewTo"), code, to: z.string().min(1) }), { setupRole: "afterSetup" }),
  // Campaign Setup: starting with the first player, each player may place `damage` damage on the card with this code to add `resources` resource to each of their heroes' pools ("each player may place 4 damage on Protect the Innocent to add 1 resource to each of their heroes'
  // resource pools", 10156:A:2). The tokens are placed, not dealt: nothing cancels them, and a player may take the card to its limit. `seat` is engine use: the player whose turn it is.
  // A constant marker on a quest stage ("The first Weather treachery card revealed each round gains surge", 09069:B:1): the first card with this Trait revealed in a round (from the encounter deck or by an effect) gains Surge as it is revealed (rr.surge). `type` is the card type, a treachery unless it says "enemy" ("The first Undead enemy revealed each round gains surge", 09039:A:1, a marker with a record condition: while Haunted Keep is the active location). Each Trait has one tally a round, kept while no card holds the marker.
  z.strictObject({ verb: z.literal("FirstTraitSurge"), trait: z.string().min(1), type: z.enum(["treachery", "enemy"]).optional() }),
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
] as const;

const TRIGGERS = [
  // About the card that held a time counter: its last one was just removed at the end of the refresh phase (the subject is the card; mec108.time-x): "After the last time counter is removed from this stage".
  "lastTimeCounterRemoved",
  // About the enemy whose attack just damaged a character (a hero or an ally; the other card is the character), once for the attack: "After an attack damages a character" (10158:A:1). Damage canceled or prevented is not damage, and an attack that damages nobody is not heard.
  "attackDamagedCharacter",
  // The Time objective was flipped to Daybreak or to Nightfall (not heard at Setup, where Daybreak is dealt faceup): every card in play hears it, the staging area and the quest card included ("Forced: When it becomes Night, reveal an encounter card", 10012:A:2).
  "becameDay",
  "becameNight",
  // About a hero: resources were spent from its pool in a payment (a card played, an ability or a Response paid for), once for each hero whose pool paid ("After 1 or more resources are spent from a hero's resource pool", 10082:A:1). Resources moved or removed by an effect are not spent.
  "heroResourcesSpent",
  // About a card that holds `progressSponge`: it left play from the staging area, discarded, shuffled away or removed, but neither explored nor travelled to ("If Forbidden Descent leaves play from the staging area", 10101:A:2).
  "leftStagingArea",
  // About a card a search put into play: an encounter card found in the encounter deck or discard pile and added to the staging area ("each Undead enemy that enters play", 10109:A:1, hears it beside `encounterEnteredPlay`, which a search does not announce). Queued only in a game whose records name it.
  "searchedIntoPlay",
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
  // On a location in the staging area: the first 2 progress that would be placed on a quest card each round are placed on it instead ("the first 2 progress that would be placed on a quest each round must be placed on Forbidden Descent, instead", 10101:A:1; families/angmar/sponge.ts).
  // Each copy takes 2 a round; `spongeTaken` is the progress it took this round (engine use, until the end of the round).
  // On a character the attack in progress damaged, until the end of the phase: its Willpower then, kept for an effect that reads the destroyed character's Willpower (engine use, families/angmar/last-known.ts).
  "lastWillpower",
  "progressSponge",
  // On the table, while a card in play says so (Ghostly Ruins, staged or active): whenever the encounter deck runs out of cards in the quest phase, the topmost Undead enemy in the encounter discard pile returns to the staging area before the deck is reset ("Any time the encounter deck runs out of cards", 10103:A:1; families/angmar/run-out.ts).
  "returnsUndeadOnRunOut",
  "spongeTaken",
] as const;

export const manifest = { name: "angmar", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
