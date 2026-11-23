// Rules: rr.forced, rr.response, rr.then, rr.travel, rr.first-player, rr.victory, rr.engaged, rr.destroy, rr.explored, rr.shadow-effects, rr.cancel, rr.in-play-and-out-of-play, faq.additional-attacks, faq.lasting-effects (data/rules/entries.json); docs/scenarios/standalone-scenarios.md (Attack on Dol Guldur).
import { announce, answer, attack, cardSpecs, count, damageOn, deckCount, defend, endRound, exhausted, flag, handCount, offers, progressOn, quest, resolve, resourcesOn, respond, reveal, stat, threat, window, won, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for Attack on Dol Guldur (standalone-scenarios part 9): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests). The lines a row cannot express (the Setup piles and the Keyword lines) are tests in lines.test.ts, each titled with its line id.
// A deck of locations: a card revealed in the staging step adds no enemy.
const PLACES = ["place", "place", "place", "place", "place", "place"];
const DG = (resources: number) => ({ code: "50907", resources });
const POWER = (progress: number) => ({ code: "50908", progress });
const HOST_L = "50909";
const BANE = "50910";
const SORCERER = "50911";
const MORLUG = "50912";
const DWELLER = "50913";
const HOST = "50914";
const OLOG = "50915";
const BEAST = "50916";
const ARCHER = "50917";
const MARAUDER = "50918";
const WARG = "50919";
const ADVANCING = { phase: "Quest", deck: ["f0"] } as const;
const END_OF_ROUND = announce("endOfRound", undefined, { seat: null, phase: "End of round" });

const ROWS: readonly Row[] = [
  // 50901 Assault on the Golden Wood.
  { line: "50901:B:1", name: "Forced: a resource is placed and all the progress moves to Power of Lórien", layout: { threat: [0, 0], stage: "50901", progress: 4, staging: [DG(10), POWER(0)], deck: PLACES }, act: END_OF_ROUND, expect: [resourcesOn("50901", 1), progressOn("50908", 4), progressOn("50901", 0)] },
  { line: "50901:B:1", name: "with 3 resources the quest advances to stage 2", layout: { threat: [0, 0], stage: "50901", staging: [DG(10), POWER(0)], phase: "Planning", deck: PLACES }, act: [endRound, endRound, endRound], expect: [zone("50903", "questStage")] },
  // 50908 Power of Lórien.
  { line: "50908:A:1", name: "Response: the player who controls it adds it to the victory display to cancel and discard the card just revealed from the encounter deck", layout: { stage: "50903", play: ["50908"], staging: [DG(10)], deck: ["treachery", "f0", "f0"] }, act: [reveal("50926"), respond("50908")], expect: [zone("50908", "victory"), zone("50926", "encounterDiscard")] },
  // 50902 Crossing the Anduin.
  { line: "50902:A:1", name: "When Revealed: 10 progress from Power of Lórien bring the Host of Lórien into play, and 20 more keep Power of Lórien", layout: { stage: "50902", side: "A", staging: [DG(10), POWER(30)], setAside: [HOST_L] }, act: [resolve("50902", "whenRevealed"), answer("host"), answer("power")], expect: [zone(HOST_L, "play"), zone("50908", "play"), progressOn("50908", 0)] },
  { line: "50902:A:1", name: "10 progress and no more: Power of Lórien is discarded", layout: { stage: "50902", side: "A", staging: [DG(10), POWER(10)], setAside: [HOST_L] }, act: [resolve("50902", "whenRevealed"), answer("host")], expect: [zone(HOST_L, "play"), count("50908", "encounterDiscard", 1)] },
  { line: "50902:A:1", name: "paying 10 and declining the 20: Power of Lórien is discarded", layout: { stage: "50902", side: "A", staging: [DG(10), POWER(30)], setAside: [HOST_L] }, act: [resolve("50902", "whenRevealed"), answer("host"), answer("discard")], expect: [zone(HOST_L, "play"), count("50908", "encounterDiscard", 1), progressOn("50908", 20)] },
  { line: "50902:A:1", name: "less than 10 progress: Power of Lórien is discarded and the Host stays aside", layout: { stage: "50902", side: "A", staging: [DG(10), POWER(9)], setAside: [HOST_L] }, act: resolve("50902", "whenRevealed"), expect: [count("50908", "encounterDiscard", 1), count(HOST_L, "setAside", 1)] },
  { line: "50902:B:1", name: "When Revealed: each player searches for a Dol Guldur location and the first player advances to a stage 3 of his choice", layout: { stage: "50902", staging: [DG(10)], deck: ["f0", "50920", "f0"] }, act: [resolve("50902", "whenRevealed"), answer("50905")], expect: [zone("50920", "staging"), zone("50905", "questStage")] },
  // 50903 the stage 3 that brings 50910.
  { line: "50903:A:1", name: "When Revealed: the other Lieutenant is set aside with its tokens gone, this one is added to the staging area and, with city strength 5 or less, attacks the player at once", layout: { stage: "50903", side: "A", staging: [DG(5), { code: "50911", damage: 2 }], setAside: ["50910"] }, act: resolve("50903", "whenRevealed"), expect: [count("50911", "setAside", 1), zone("50910", "staging"), window("defense")] },
  { line: "50903:A:1", name: "with city strength 6 it makes no immediate attack", layout: { stage: "50903", side: "A", staging: [DG(6), "50911"], setAside: ["50910"] }, act: resolve("50903", "whenRevealed"), expect: [zone("50910", "staging"), window("defense", false)] },
  { line: "50903:B:1", name: "the Lieutenant gets -1 engagement cost for each progress on the stage", layout: { stage: "50903", progress: 4, staging: ["50910"] }, act: [], expect: [stat("50910", "engagementCost", 41)] },
  // 50904 the stage 3 that brings 50911.
  { line: "50904:A:1", name: "When Revealed: the other Lieutenant is set aside with its tokens gone, this one is added to the staging area and, with city strength 5 or less, attacks the player at once", layout: { stage: "50904", side: "A", staging: [DG(5), { code: "50912", damage: 2 }], setAside: ["50911"] }, act: resolve("50904", "whenRevealed"), expect: [count("50912", "setAside", 1), zone("50911", "staging"), window("defense")] },
  { line: "50904:A:1", name: "with city strength 6 it makes no immediate attack", layout: { stage: "50904", side: "A", staging: [DG(6), "50912"], setAside: ["50911"] }, act: resolve("50904", "whenRevealed"), expect: [zone("50911", "staging"), window("defense", false)] },
  { line: "50904:B:1", name: "the Lieutenant gets -1 engagement cost for each progress on the stage", layout: { stage: "50904", progress: 4, staging: ["50911"] }, act: [], expect: [stat("50911", "engagementCost", 41)] },
  // 50905 the stage 3 that brings 50912.
  { line: "50905:A:1", name: "When Revealed: the other Lieutenant is set aside with its tokens gone, this one is added to the staging area and, with city strength 5 or less, attacks the player at once", layout: { stage: "50905", side: "A", staging: [DG(5), { code: "50913", damage: 2 }], setAside: ["50912"] }, act: resolve("50905", "whenRevealed"), expect: [count("50913", "setAside", 1), zone("50912", "staging"), window("defense")] },
  { line: "50905:A:1", name: "with city strength 6 it makes no immediate attack", layout: { stage: "50905", side: "A", staging: [DG(6), "50913"], setAside: ["50912"] }, act: resolve("50905", "whenRevealed"), expect: [zone("50912", "staging"), window("defense", false)] },
  { line: "50905:B:1", name: "the Lieutenant gets -1 engagement cost for each progress on the stage", layout: { stage: "50905", progress: 4, staging: ["50912"] }, act: [], expect: [stat("50912", "engagementCost", 41)] },
  // 50906 the stage 3 that brings 50913.
  { line: "50906:A:1", name: "When Revealed: the other Lieutenant is set aside with its tokens gone, this one is added to the staging area and, with city strength 5 or less, attacks the player at once", layout: { stage: "50906", side: "A", staging: [DG(5), { code: "50910", damage: 2 }], setAside: ["50913"] }, act: resolve("50906", "whenRevealed"), expect: [count("50910", "setAside", 1), zone("50913", "staging"), window("defense")] },
  { line: "50906:A:1", name: "with city strength 6 it makes no immediate attack", layout: { stage: "50906", side: "A", staging: [DG(6), "50910"], setAside: ["50913"] }, act: resolve("50906", "whenRevealed"), expect: [zone("50913", "staging"), window("defense", false)] },
  { line: "50906:B:1", name: "the Lieutenant gets -1 engagement cost for each progress on the stage", layout: { stage: "50906", progress: 4, staging: ["50913"] }, act: [], expect: [stat("50913", "engagementCost", 41)] },
  // The stage 3 Forced effects (the first player removes 5 progress or takes the penalty, and may remove 5 more).
  { line: "50903:B:2", name: "Forced: 5 progress come off the stage", layout: { threat: [0, 0], stage: "50903", progress: 5, staging: [DG(10)], deck: PLACES }, act: [END_OF_ROUND, answer("progress")], expect: [progressOn("50903", 0), resourcesOn("50907", 10)] },
  { line: "50903:B:2", name: "the penalty raises the city strength by 3", layout: { threat: [0, 0], stage: "50903", progress: 5, staging: [DG(10)], deck: PLACES }, act: [END_OF_ROUND, answer("penalty")], expect: [progressOn("50903", 5), resourcesOn("50907", 13)] },
  { line: "50903:B:2", name: "5 more progress lower the city strength by 3", layout: { threat: [0, 0], stage: "50903", progress: 10, staging: [DG(10)], deck: PLACES }, act: [END_OF_ROUND, answer("progress"), answer("extra")], expect: [progressOn("50903", 0), resourcesOn("50907", 7)] },
  { line: "50904:B:2", name: "the penalty: each player discards all but 1 card from his hand", layout: { threat: [0, 0], stage: "50904", staging: [DG(10)], hand: ["filler", "filler", "filler"], deck: PLACES }, act: END_OF_ROUND, expect: [handCount(1)] },
  { line: "50904:B:2", name: "the extra 5 progress: a chosen player searches his deck and adds a card to his hand", layout: { threat: [0, 0], stage: "50904", progress: 10, staging: [DG(10)], hand: [], deckOf: ["filler", "filler"], deck: PLACES }, act: [END_OF_ROUND, answer("extra")], expect: [progressOn("50904", 0), handCount(1)] },
  { line: "50905:B:2", name: "the penalty: each player discards from the encounter deck to the first enemy and it engages him", layout: { threat: [0, 0], stage: "50905", staging: [DG(10)], deck: ["place", "f3", "f0"] }, act: END_OF_ROUND, expect: [count("f3", "engaged", 1), zone("place", "encounterDiscard")] },
  { line: "50905:B:2", name: "the extra 5 progress destroy a non-unique enemy in the staging area", layout: { threat: [0, 0], stage: "50905", progress: 10, staging: [DG(10), "f3"], deck: PLACES }, act: [END_OF_ROUND, answer("progress"), answer("extra")], expect: [progressOn("50905", 0), count("f3", "staging", 0)] },
  { line: "50906:B:2", name: "the penalty: each player discards an ally he controls", layout: { threat: [0, 0], stage: "50906", staging: [DG(10)], play: ["ally"], deck: PLACES }, act: END_OF_ROUND, expect: [count("ally", "play", 0)] },
  { line: "50906:B:2", name: "the extra 5 progress: a chosen player puts an ally from the top 10 of his deck into play", layout: { threat: [0, 0], stage: "50906", progress: 10, staging: [DG(10)], deckOf: ["ally", "filler"], deck: PLACES }, act: [END_OF_ROUND, answer("extra")], expect: [progressOn("50906", 0), count("ally", "play", 1)] },
  // 50907 Dol Guldur: the Siege values of what is destroyed or explored this round come off the city strength at the end of the round, at stage 3.
  { line: "50907:A:1", name: "an enemy destroyed in the staging area adds its Siege value (4) and the tally comes off at the end of the round", layout: { threat: [0, 0], stage: "50906", staging: [DG(10), HOST], deck: PLACES }, act: [announce("enemyDestroyed", HOST, { seat: 0 }), END_OF_ROUND], expect: [resourcesOn("50907", 6)] },
  { line: "50907:A:1", name: "an engaged enemy and an explored location count too", layout: { threat: [0, 0], stage: "50906", staging: [DG(10), "50920"], engaged: [OLOG], deck: PLACES }, act: [announce("enemyDestroyed", OLOG, { seat: 0 }), announce("locationExplored", "50920", { seat: 0 }), END_OF_ROUND], expect: [resourcesOn("50907", 5)] },
  // 50909 Host of Lórien.
  { line: "50909:A:3", name: "it does not exhaust to quest", layout: { stage: "50903", play: [HOST_L] }, act: [], expect: [flag(HOST_L, "noExhaustQuest")] },
  { line: "50909:A:4", name: "when it leaves play it is removed from the game", layout: { stage: "50903", play: [HOST_L] }, act: announce("leftPlay", HOST_L), expect: [zone(HOST_L, "removed")] },
  // 50910 to 50913 the Lieutenants.
  { line: "50910:A:2", name: "Forced: when it attacks, a random card is discarded from the player's hand and its printed cost is added to the Attack", layout: { stage: "50903", engaged: [BANE], hand: ["ally"] }, act: attack(BANE, { undefended: true }), expect: [handCount(0), zone("ally", "discard")] },
  { line: "50911:A:2", name: "Forced: when it attacks, the top card of the player's deck is discarded and each copy in play is discarded too", layout: { stage: "50903", engaged: [SORCERER], play: ["ally"], deckOf: ["ally", "filler"] }, act: attack(SORCERER, { undefended: true }), expect: [count("ally", "play", 0)] },
  { line: "50912:A:2", name: "Forced: when it attacks, cards are discarded from the encounter deck to the first enemy and it engages the player", layout: { stage: "50903", engaged: [MORLUG], deck: ["f0", "place", "f3", "f0"] }, act: attack(MORLUG, { undefended: true }), expect: [count("f3", "engaged", 1), zone("place", "encounterDiscard")] },
  { line: "50912:A:2", name: "with no enemy in the deck nothing is put into play", layout: { stage: "50903", engaged: [MORLUG], deck: ["f0", "place", "place", "place"] }, act: attack(MORLUG, { undefended: true }), expect: [count("place", "encounterDiscard", 3), count("place", "engaged", 0)] },
  { line: "50913:A:2", name: "Forced: when it attacks, the player discards an ally he controls", layout: { stage: "50903", engaged: [DWELLER], play: ["ally"] }, act: attack(DWELLER, { undefended: true }), expect: [count("ally", "play", 0)] },
  // 50914 Host of Dol Guldur.
  { line: "50914:A:1", name: "Archery equal to the number of players", layout: { stage: "50903", seats: 2, staging: [HOST] }, act: [], expect: [stat(HOST, "archeryPlayers", 1)] },
  { line: "50914:A:2", name: "Archery X, X the number of players", layout: { stage: "50903", seats: 2, staging: [HOST] }, act: [], expect: [stat(HOST, "archeryPlayers", 1)] },
  { line: "50914:A:3", name: "it cannot have attachments", layout: { stage: "50903", staging: [HOST] }, act: [], expect: [flag(HOST, "cannotHaveAttachments")] },
  { line: "50914:A:4", name: "Forced: at the end of the encounter phase in the staging area, 1 progress for each player comes off the main quest", layout: { stage: "50903", progress: 5, seats: 2, staging: [HOST] }, act: announce("endOfPhase", undefined, { seat: null, phase: "Encounter" }), expect: [progressOn("50903", 3)] },
  // 50915 Mirkwood Olog-hai.
  { line: "50915:A:1", name: "Forced: after it destroys a character, 1 progress comes off the quest for each point of excess damage", layout: { stage: "50903", progress: 6, engaged: [OLOG], play: ["ally"] }, act: [attack(OLOG), defend("ally")], expect: [progressOn("50903", 3)] },
  { line: "50915:A:2", name: "Shadow: the defending player removes 2 progress from the quest", layout: { stage: "50903", progress: 5, engaged: [WARG] }, act: [attack(WARG, { shadow: OLOG }), answer("progress")], expect: [progressOn("50903", 3)] },
  { line: "50915:A:2", name: "or the enemy is returned to the staging area after the attack", layout: { stage: "50903", progress: 5, engaged: [WARG] }, act: [attack(WARG, { shadow: OLOG }), answer("staging")], expect: [zone(WARG, "staging"), progressOn("50903", 5)] },
  // 50916 Beast of Taur-nu-Fuin.
  { line: "50916:A:1", name: "it cannot have attachments and its shadow cards cannot be canceled", layout: { stage: "50903", staging: [BEAST] }, act: [], expect: [flag(BEAST, "cannotHaveAttachments"), flag(BEAST, "shadowsUncancelable")] },
  { line: "50916:A:2", name: "Forced: when it attacks, the first player removes 2 progress", layout: { stage: "50903", progress: 5, engaged: [BEAST], deck: ["f0", "f0", "f0", "f0"] }, act: [attack(BEAST, { undefended: true }), answer("progress")], expect: [progressOn("50903", 3)] },
  { line: "50916:A:2", name: "or it is dealt another shadow card", layout: { stage: "50903", progress: 5, engaged: [BEAST], deck: ["f0", "f0", "f0", "f0"] }, act: [attack(BEAST, { undefended: true }), answer("shadow")], expect: [progressOn("50903", 5), deckCount(2)] },
  // 50917 Amon Lanc Archer.
  { line: "50917:A:2", name: "Forced: after it engages the player, 2 progress come off the quest", layout: { stage: "50903", progress: 5, staging: [ARCHER] }, act: announce("engaged", ARCHER, { seat: 0 }), expect: [progressOn("50903", 3)] },
  { line: "50917:A:2", name: "or 2 damage is dealt to an ally he controls", layout: { stage: "50903", progress: 5, staging: [ARCHER], play: ["ally"] }, act: [announce("engaged", ARCHER, { seat: 0 }), answer("damage")], expect: [progressOn("50903", 5), damageOn("ally", 2)] },
  { line: "50917:A:3", name: "Shadow: a ready character is exhausted", layout: { stage: "50903", engaged: [WARG] }, act: [attack(WARG, { shadow: ARCHER, undefended: true })], expect: [exhausted("dh1")] },
  // 50918 Dol Guldur Marauder.
  { line: "50918:A:1", name: "+1 Attack and Defense for each resource on it", layout: { stage: "50903", staging: [{ code: MARAUDER, resources: 2 }] }, act: [], expect: [stat(MARAUDER, "attack", 5), stat(MARAUDER, "defense", 3)] },
  { line: "50918:A:2", name: "Forced: when it attacks, the first player removes 1 progress", layout: { stage: "50903", progress: 5, engaged: [MARAUDER] }, act: [attack(MARAUDER, { undefended: true }), answer("progress")], expect: [progressOn("50903", 4)] },
  { line: "50918:A:2", name: "or places a resource on it", layout: { stage: "50903", progress: 5, engaged: [MARAUDER] }, act: [attack(MARAUDER, { undefended: true }), answer("resource")], expect: [progressOn("50903", 5), resourcesOn(MARAUDER, 1)] },
  // 50919 Battle Warg.
  { line: "50919:A:2", name: "Forced: after it engages the player, 1 progress comes off the quest", layout: { stage: "50903", progress: 5, staging: [WARG] }, act: announce("engaged", WARG, { seat: 0 }), expect: [progressOn("50903", 4)] },
  { line: "50919:A:2", name: "or an attachment he controls is discarded", layout: { stage: "50903", progress: 5, staging: [WARG], attached: [{ code: "attachment", to: "dh1" }] }, act: [announce("engaged", WARG, { seat: 0 }), answer("attachment")], expect: [progressOn("50903", 5), zone("attachment", "discard")] },
  { line: "50919:A:3", name: "Shadow: an attachment the defending player controls is discarded", layout: { stage: "50903", engaged: [MARAUDER], attached: [{ code: "attachment", to: "dh1" }] }, act: [attack(MARAUDER, { shadow: WARG, undefended: true })], expect: [zone("attachment", "discard")] },
  // 50920 to 50923: each location gains its lines only in the staging area (the travel bar here, the stage 3 it waits for is not in play).
  { line: "50920:A:1", name: "the players cannot travel to it unless they are at stage 3B", layout: { phase: "Travel", stage: "50902", staging: ["50920"] }, act: [], expect: offers("Travel", undefined, false) },
  { line: "50921:A:1", name: "the players cannot travel to it unless they are at stage 3D", layout: { phase: "Travel", stage: "50902", staging: ["50921"] }, act: [], expect: offers("Travel", undefined, false) },
  { line: "50921:A:1", name: "Forced: after the When Revealed effects of an encounter card are canceled, 1 encounter card is revealed", layout: { stage: "50902", staging: ["50921", "f0"], deck: ["place", "f0"] }, act: announce("whenRevealedCanceled"), expect: [zone("place", "staging")] },
  { line: "50922:A:1", name: "+2 Threat for each facedown card attached to it", layout: { stage: "50902", staging: ["50922"], under: [{ code: "f0", to: "50922" }, { code: "f0", to: "50922" }] }, act: [], expect: [stat("50922", "threat", 6)] },
  { line: "50922:A:2", name: "the players cannot travel to it unless they are at stage 3F", layout: { phase: "Travel", stage: "50902", staging: ["50922"] }, act: [], expect: offers("Travel", undefined, false) },
  { line: "50923:A:1", name: "the players cannot travel to it unless they are at stage 3H", layout: { phase: "Travel", stage: "50902", staging: ["50923"] }, act: [], expect: offers("Travel", undefined, false) },
  // 50924 Forest Battleground and 50925 Blackened Woods.
  { line: "50924:A:1", name: "+1 Threat for each ally of the player with the most", layout: { stage: "50902", staging: ["50924"], play: ["ally", "ally"] }, act: [], expect: [stat("50924", "threat", 3)] },
  { line: "50924:A:2", name: "Forced: when explored, each player searches the encounter deck for an Orc enemy and adds it to the staging area", layout: { stage: "50902", staging: ["50924"], deck: ["f0", ARCHER, "f0"] }, act: announce("locationExplored", "50924", { seat: 0 }), expect: [zone(ARCHER, "staging")] },
  { line: "50925:A:1", name: "Forced: when explored, the top card of the encounter deck is discarded and each player raises his threat by its printed Threat", layout: { stage: "50902", staging: ["50925"], deck: ["f3", "f0"] }, act: announce("locationExplored", "50925", { seat: 0 }), expect: [zone("f3", "encounterDiscard"), threat(31)] },
  { line: "50925:A:2", name: "Shadow: +1 Attack, and 3 progress come off the quest if the attack destroys a character", layout: { stage: "50902", progress: 5, engaged: [WARG], play: ["ally"] }, act: [attack(WARG, { shadow: "50925" }), defend("ally")], expect: [progressOn("50902", 2)] },
  // 50926 to 50930 the treacheries.
  { line: "50926:A:2", name: "When Revealed: the enemy in the staging area with the highest engagement cost attacks the first player", layout: { stage: "50902", staging: [HOST, ARCHER], deck: ["f0", "f0"] }, act: reveal("50926"), expect: [window("defense")] },
  { line: "50926:A:3", name: "Shadow: an additional attack is made against the player with a new shadow card", layout: { stage: "50902", engaged: [WARG], deck: ["f0", "f0", "f0", "f0"] }, act: attack(WARG, { shadow: "50926", undefended: true }), expect: [deckCount(3)] },
  { line: "50927:A:2", name: "When Revealed: each player searches for a Dol Guldur location and adds it to the staging area", layout: { stage: "50902", deck: ["f0", "50920", ARCHER, "f0"] }, act: [reveal("50927"), answer("location")], expect: [zone("50920", "staging")] },
  { line: "50927:A:2", name: "or for an Orc enemy that engages him", layout: { stage: "50902", deck: ["f0", "50920", ARCHER, "f0"] }, act: [reveal("50927"), answer("enemy")], expect: [count(ARCHER, "engaged", 1)] },
  { line: "50928:A:1", name: "When Revealed: 1 damage to each exhausted character and -1 Willpower for each damaged character", layout: { stage: "50902", ...ADVANCING }, act: [quest("success"), reveal("50928")], expect: [damageOn("dh1", 1), damageOn("dh2", 1)] },
  { line: "50928:A:2", name: "Shadow: 1 damage to the defending character and -1 Defense for each damage on it", layout: { stage: "50902", engaged: [MARAUDER] }, act: [attack(MARAUDER, { shadow: "50928" }), defend("dh1")], expect: [damageOn("dh1", 4)] },
  { line: "50929:A:2", name: "When Revealed: each player exhausts a character and no character readies by a player card effect this round", layout: { stage: "50902" }, act: reveal("50929"), expect: [exhausted("dh1")] },
  { line: "50929:A:3", name: "Shadow: the defending character cannot ready this round", layout: { stage: "50902", engaged: [MARAUDER] }, act: [attack(MARAUDER, { shadow: "50929" }), defend("dh1")], expect: [flag("dh1", "cannotReady")] },
  { line: "50930:A:1", name: "When Revealed: no more than 5 progress can be placed on the quest this round", layout: { stage: "50903", staging: [DG(10)] }, act: resolve("50930", "whenRevealed"), expect: [flag("table", "questProgressCap", true)] },
  { line: "50930:A:1", name: "with city strength 5 or less it has surge", layout: { phase: "Quest", stage: "50903", staging: [DG(5)], deck: ["place"] }, act: reveal("50930"), expect: [zone("place", "staging")] },
  { line: "50930:A:2", name: "Shadow: +1 Attack and Defense", layout: { stage: "50902", progress: 4, engaged: [WARG] }, act: attack(WARG, { shadow: "50930", undefended: true }), expect: [damageOn("dh1", 4)] },
  { line: "50930:A:2", name: "+2 instead with at least 5 progress on the quest", layout: { stage: "50902", progress: 5, engaged: [WARG] }, act: attack(WARG, { shadow: "50930", undefended: true }), expect: [damageOn("dh1", 5)] },
  // 50931 Standard Game Mode.
  { line: "50931:A:1", name: "Setup: city strength is 5 plus 5 for each player", layout: { stage: "50901", seats: 2, staging: [DG(0)] }, act: resolve("50931", "setup"), expect: [resourcesOn("50907", 15)] },
  { line: "50931:B:1", name: "at city strength 0 each Lieutenant loses Indestructible", layout: { modeCard: true, stage: "50903", staging: [DG(0), BANE] }, act: [], expect: [flag(BANE, "losesIndestructible")] },
  { line: "50931:B:3", name: "Forced: at the end of the round with city strength 0 and no Lieutenant in play the players win", layout: { threat: [0, 0], modeCard: true, stage: "50906", victory: [BANE], staging: [DG(0)], deck: PLACES }, act: END_OF_ROUND, expect: [won] },
  { line: "50931:B:2", name: "Forced: at the end of the round all progress comes off the stage and the first player advances to another stage 3", layout: { threat: [0, 0], modeCard: true, stage: "50903", progress: 3, staging: [DG(10)], deck: PLACES }, act: [END_OF_ROUND, answer("50906")], expect: [progressOn("50903", 0), zone("50906", "questStage")] },
];

if (ROWS.length > 0) cardSpecs("attack-on-dol-guldur", ROWS);
