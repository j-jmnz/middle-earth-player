// Rules: emce.guarded-x, rr.guarded, rr.travel, rr.quest-advancement, rr.reveal, rr.surge, rr.shadow-effects, rr.attacks-outside-the-combat-phase, rr.lasting-effects, rr.ready, rr.refresh-phase, rr.doomed-x, rr.then,
// rr.in-play-and-out-of-play, rr.engaged (data/rules/entries.json); ledger lines 18029:A:1, 18030:A:1 to 18030:A:3, 18031:A:1 to 18031:A:3, 18032:A:1, 18032:A:3, 18033:A:1 to 18033:A:3, 18034:A:2, 18035:A:1, 18035:A:2,
// 18036:A:1, 18037:A:1, 18038:A:1, 18038:A:2, 18039:A:1, 18039:A:2, 18040:A:2, 18040:A:3, 18041:A:1, 18071:B:2, 18072:A:1, 18072:B:2, 18073:A:1.
// Card specs for the Lost in Mirkwood encounter cards and quest stages, read from their printed lines. `cardSpecs` runs each row again with the records of its line removed, where it must fail.
// The stand-in heroes dh1 and dh2 have 2 Willpower, 2 Attack, 2 Defense and 6 hit points; f0 and f3 are enemies of Threat 0 and 3 with 1 Attack; "place" is a location of Threat 2 with no trait; every seat starts at threat 28.
// A travel to an Objective-Location is made at stage 18077, the last level, so its "advance to the next stage, if able" changes nothing there.
import { answer, attack, cardSpecs, endPhase, committed, count, damageOn, deckCount, defend, endRound, exhausted, flag, quest, resolve, resourcesOn, reveal, stat, threat, travel, zone, type Row } from "../../../../test/harness/card-spec.ts";

const ROWS: readonly Row[] = [
  // 18029 to 18032 "Guarded (location)" / "Guarded (enemy)": discard from the encounter deck until a card of that type is discarded, add it to the staging area and attach the objective to it (emce.guarded-x).
  { line: "18029:A:1", name: "the first location discarded from the deck is added to the staging area, the enemy before it discarded", layout: { deck: ["f0", "place", "f3"] }, act: reveal("18029"), expect: [zone("18029", "staging"), zone("place", "staging"), zone("f0", "encounterDiscard"), deckCount(1)] },
  { line: "18030:A:1", name: "the first location discarded from the deck is added to the staging area", layout: { deck: ["f0", "place", "f3"] }, act: reveal("18030"), expect: [zone("place", "staging"), zone("f0", "encounterDiscard"), deckCount(1)] },
  { line: "18030:A:1", name: "with no location left in the deck the discard pile is shuffled in and the search goes on", layout: { deck: ["f0"], discard: ["place"] }, act: reveal("18030"), expect: zone("place", "staging") },
  { line: "18031:A:1", name: "the first enemy discarded from the deck is added to the staging area, the location before it discarded", layout: { deck: ["place", "f3", "f0"] }, act: reveal("18031"), expect: [zone("f3", "staging"), zone("place", "encounterDiscard"), deckCount(1)] },
  { line: "18032:A:1", name: "the first enemy discarded from the deck is added to the staging area, the location before it discarded", layout: { deck: ["place", "f3", "f0"] }, act: reveal("18032"), expect: [zone("f3", "staging"), zone("place", "encounterDiscard"), deckCount(1)] },

  // 18030 Abandoned Village, Travel: "Shuffle the encounter discard pile into the encounter deck. Each player discards the top card of the encounter deck. Add each enemy discarded this way to the staging area."
  { line: "18030:A:2", name: "the discard pile is shuffled in and an enemy discarded this way is added to the staging area", layout: { stage: "18077", phase: "Travel", staging: ["18030"], discard: ["f3"] }, act: travel("18030"), expect: [zone("f3", "staging"), deckCount(0)] },
  { line: "18030:A:2", name: "two players discard a card each: the enemy goes to the staging area, the location stays discarded", layout: { stage: "18077", seats: 2, phase: "Travel", staging: ["18030"], discard: ["f3", "place"] }, act: travel("18030"), expect: [zone("f3", "staging"), zone("place", "encounterDiscard"), deckCount(0)] },
  // "Forced: After the players travel here, advance to the next stage C, if able." Stage 1 to stage 2C, Dol Guldur Orcs.
  { line: "18030:A:3", name: "traveling here from stage 1 advances to stage 2C", layout: { phase: "Travel", staging: ["18030"], deck: ["f0", "f0", "f0"] }, act: travel("18030"), expect: zone("18073", "questStage") },

  // 18031 Bare Hilltop, Travel: the same, adding each location discarded this way.
  { line: "18031:A:2", name: "two players discard a card each: the location goes to the staging area, the enemy stays discarded", layout: { stage: "18077", seats: 2, phase: "Travel", staging: ["18031"], discard: ["f3", "place"] }, act: travel("18031"), expect: [zone("place", "staging"), zone("f3", "encounterDiscard"), deckCount(0)] },
  // "Forced: After the players travel here, advance to the next stage A, if able."
  { line: "18031:A:3", name: "traveling here from stage 1 advances to stage 2A", layout: { phase: "Travel", staging: ["18031"], deck: ["f0", "f0", "f0"] }, act: travel("18031"), expect: zone("18072", "questStage") },
  { line: "18031:A:3", name: "traveling here from stage 2C advances to stage 3A", layout: { stage: "18073", phase: "Travel", staging: ["18031"], deck: ["f0", "f0", "f0"] }, act: travel("18031"), expect: zone("18074", "questStage") },
  // 18032 Forest Clearing: "Forced: After the players travel here, advance to the next stage C, if able."
  { line: "18032:A:3", name: "traveling here from stage 2A advances to stage 3C", layout: { stage: "18072", phase: "Travel", staging: ["18032"], deck: ["f0", "f0", "f0"] }, act: travel("18032"), expect: zone("18075", "questStage") },

  // 18033 Twilight Hall: "Twilight Hall gets +2 Threat for each resource on it." Printed Threat 2.
  { line: "18033:A:1", name: "2 resources give +4 Threat", layout: { staging: [{ code: "18033", resources: 2 }] }, act: [], expect: stat("18033", "threat", 6) },
  // "Forced: After a Forest location is explored, place 1 resource here." Old Forest Road (Forest, 3 quest points) is explored by the quest's progress.
  { line: "18033:A:2", name: "a Forest location explored as the active location places 1 resource here", layout: { staging: ["18033"], active: { code: "01099", progress: 2 }, deck: ["f0"] }, act: quest("success"), expect: [zone("01099", "encounterDiscard"), resourcesOn("18033", 1)] },
  // "Travel: Raise each player's threat by 1 for each resource here." With no enemy the round runs on to its refresh phase, which adds 1 more: 28 + 2 + 1.
  { line: "18033:A:3", name: "each player raises their threat by 1 for each resource here", layout: { seats: 2, phase: "Travel", staging: [{ code: "18033", resources: 2 }], deck: ["f0", "f0"] }, act: travel("18033"), expect: [zone("18033", "activeLocation"), threat(31, 0), threat(31, 1)] },

  // 18034 Mirkwood Patrol, Shadow: "The defender cannot ready this round." The refresh phase of the round does not ready it.
  { line: "18034:A:2", name: "the defender stays exhausted through the refresh phase", act: [attack("f0", { shadow: "18034" }), defend("dh1"), endRound], expect: [exhausted("dh1", true)] },

  // 18035 Ravenous Spider: "Forced: After Ravenous Spider engages you, it makes an immediate attack." Engagement cost 36 and a threat of 40: the engagement check engages it in the encounter phase, and its Attack 4 lands undefended on the first hero before the combat phase.
  { line: "18035:A:1", name: "it attacks the player it engaged at once, in the encounter phase", layout: { phase: "Encounter", staging: ["18035"], threat: [40, 0], deck: ["f0", "f0"] }, act: endPhase, expect: [zone("18035", "engaged"), damageOn("dh1", 4)] },
  // Shadow: "Attacking enemy makes an additional attack against you after this one." f0 attacks twice for 1, undefended.
  { line: "18035:A:2", name: "the attacker attacks the defending player a second time", act: attack("f0", { shadow: "18035", undefended: true }), expect: damageOn("dh1", 2) },

  // 18036 Unseen Danger: "Each player removes a character he controls from the quest and discards the top card of the encounter deck. If the discarded card's printed Threat is greater than the removed character's Willpower, discard that character."
  { line: "18036:A:1", name: "a discarded Threat 2 equal to the Willpower: the hero is removed from the quest and stays", layout: { committed: ["dh1"], deck: ["place", "f0"] }, act: reveal("18036"), expect: [committed("dh1", false), zone("dh1", "heroes"), zone("place", "encounterDiscard")] },
  { line: "18036:A:1", name: "two players: each removes a hero from the quest and discards a card", layout: { seats: 2, committed: ["dh1", "dh3"], deck: ["f0", "f0", "f0"] }, act: reveal("18036"), expect: [committed("dh1", false), committed("dh3", false), deckCount(1)] },

  // 18037 Vastness of Mirkwood: "Until the end of the phase, each non-objective location in the staging area gets +1 Threat (+2 Threat instead if it has at least 1 progress token on it). If the number of
  // non-objective locations in the staging area is less than the number of players, Vastness of Mirkwood gains surge." Old Forest Road prints Threat 1; Overgrown Path, an objective, gets nothing.
  { line: "18037:A:1", name: "+1 Threat to a location, +2 to one with progress, none to the objective-location, and no surge with 2 locations for 1 player", layout: { staging: ["place", { code: "01099", progress: 1 }, "18029"], deck: ["f3", "f0"] }, act: reveal("18037"), expect: [stat("place", "threat", 3), stat("01099", "threat", 3), stat("18029", "threat", 0), deckCount(2)] },
  { line: "18037:A:1", name: "no location in the staging area for 1 player: it gains surge", layout: { staging: ["18029"], deck: ["f3", "f0"] }, act: reveal("18037"), expect: [zone("f3", "staging"), deckCount(1)] },
  { line: "18037:A:1", name: "1 location for 2 players: it gains surge", layout: { seats: 2, staging: ["place"], deck: ["f3", "f0"] }, act: reveal("18037"), expect: [stat("place", "threat", 3), zone("f3", "staging"), deckCount(1)] },

  // 18038 Accursed Forest: "While Accursed Forest is in the staging area, 'when revealed' effects cannot be canceled."
  { line: "18038:A:1", name: "in the staging area no when revealed effect can be canceled", layout: { staging: ["18038"] }, act: [], expect: flag("table", "encounterUncancelable") },
  // "Travel: Reveal the top card of the encounter deck."
  { line: "18038:A:2", name: "traveling here reveals the top card of the encounter deck", layout: { phase: "Travel", staging: ["18038"], deck: ["f3", "f0"] }, act: travel("18038"), expect: [zone("f3", "staging"), deckCount(1)] },

  // 18039 Dark Black Woods: "While Dark Black Woods is in the staging area, no more than 1 progress can be placed on each Forest location in the staging area each round."
  { line: "18039:A:1", name: "each Forest location in the staging area takes at most 1 progress a round, itself included; a location without the trait does not", layout: { staging: ["18039", "01099", "place"] }, act: [], expect: [stat("01099", "progressCap", 1), stat("18039", "progressCap", 1), stat("place", "progressCap", 0)] },
  // "Travel: Each player discards the top card of the encounter deck. Add each enemy discarded this way to the staging area." No shuffle: the discard pile stays.
  { line: "18039:A:2", name: "two players discard a card each: the enemy goes to the staging area, the location stays discarded", layout: { seats: 2, phase: "Travel", staging: ["18039"], deck: ["f3", "place", "f0"] }, act: travel("18039"), expect: [zone("f3", "staging"), zone("place", "encounterDiscard"), deckCount(1)] },
  { line: "18039:A:2", name: "the discard pile is not shuffled in first", layout: { phase: "Travel", staging: ["18039"], deck: ["f3"], discard: ["f0"] }, act: travel("18039"), expect: [zone("f3", "staging"), zone("f0", "encounterDiscard"), deckCount(0)] },

  // 18040 Gathering Gloom (Doomed 1): "Each player must choose: either raise your threat by 1 for each ally you control, or reveal an encounter card."
  { line: "18040:A:2", name: "the threat option raises the threat by 1 for each ally the player controls, after Doomed 1", layout: { play: ["ally", "ally"], deck: ["f3"] }, act: [reveal("18040"), answer("threat")], expect: [threat(31), deckCount(1)] },
  { line: "18040:A:2", name: "the reveal option reveals an encounter card", layout: { play: ["ally", "ally"], deck: ["f3"] }, act: [reveal("18040"), answer("reveal")], expect: [threat(29), zone("f3", "staging")] },
  { line: "18040:A:2", name: "two players: each counts only the allies they control", layout: { seats: 2, play: [{ code: "ally", seat: 0 }], deck: ["f3"] }, act: [reveal("18040"), answer("threat"), answer("threat")], expect: [threat(30, 0), threat(29, 1)] },
  // Shadow: "Attacking enemy gets +1 Attack. If this attack destroys a character, discard an ally you control."
  { line: "18040:A:3", name: "the attacker gets +1 Attack", act: attack("f0", { shadow: "18040", undefended: true }), expect: damageOn("dh1", 2) },
  { line: "18040:A:3", name: "King Spider's 3 Attack +1 destroys the defending ally (1 Defense, 2 hit points) and discards another ally the player controls", layout: { play: ["ally", "ally"] }, act: [attack("01074", { shadow: "18040" }), defend("ally")], expect: count("ally", "discard", 2) },

  // 18041 Swarm of Bats: "Each player discards each resource from each of his hero's resource pools and raises his threat by 1 for each resource he discarded this way. If no resources were discarded this way, Swarm of Bats gains surge."
  { line: "18041:A:1", name: "4 resources discarded from 2 heroes raise the threat by 4, with no surge", layout: { heroResources: 2, deck: ["f3", "f0"] }, act: reveal("18041"), expect: [resourcesOn("dh1", 0), resourcesOn("dh2", 0), threat(32), deckCount(2)] },
  { line: "18041:A:1", name: "no resource discarded: it gains surge", layout: { deck: ["f3", "f0"] }, act: reveal("18041"), expect: [threat(28), zone("f3", "staging"), deckCount(1)] },
  { line: "18041:A:1", name: "two players: each raises their threat by the resources they discarded", layout: { seats: 2, heroResources: 1, deck: ["f3", "f0"] }, act: reveal("18041"), expect: [threat(30, 0), threat(29, 1), deckCount(2)] },

  // 18071 Ambushed at Night: "Forced: After an enemy engages a player, raise that player's threat by 1." The second player is engaged.
  // Forest Spider (engagement cost 25) engages the second player (threat 40) in the engagement check; the first (threat 10) engages nothing.
  { line: "18071:B:2", name: "the engaged player's threat is raised, not the first player's", layout: { seats: 2, phase: "Encounter", staging: ["01096"], threat: [10, 40], deck: ["f0", "f0"] }, act: endPhase, expect: [zone("01096", "engaged"), threat(41, 1), threat(10, 0)] },

  // 18072 Spiders of Mirkwood: "When Revealed: Shuffle the Spiders of Mirkwood encounter set into the encounter deck. Then, reveal 1 encounter card per player."
  { line: "18072:A:1", name: "two players: the set joins the deck and 2 cards are revealed", layout: { stage: "18072", side: "A", seats: 2, piles: { spidersDeck: ["f0", "f3"] } }, act: resolve("18072", "whenRevealed", undefined), expect: [zone("f0", "staging"), zone("f3", "staging"), deckCount(0), count("f0", "spidersDeck", 0)] },
  { line: "18072:A:1", name: "one player: 1 card is revealed and the rest of the set stays in the deck", layout: { stage: "18072", side: "A", deck: ["f0", "f0"], piles: { spidersDeck: ["f0", "f0"] } }, act: resolve("18072", "whenRevealed", undefined), expect: [count("f0", "staging", 1), deckCount(3)] },
  // "Forced: When a Spider enemy attacks and damages a character, that character cannot ready until the end of the round." King Spider (Spider, 3 Attack) against a 2 Defense hero.
  { line: "18072:B:2", name: "the damaged defender does not ready in the refresh phase", layout: { stage: "18072" }, act: [attack("01074", { shadow: "f0" }), defend("dh1"), endRound], expect: [damageOn("dh1", 1), exhausted("dh1", true)] },

  // 18073 Dol Guldur Orcs: "When Revealed: Shuffle the Dol Guldur Orcs encounter set into the encounter deck. Then, reveal 1 encounter card per player."
  { line: "18073:A:1", name: "two players: the set joins the deck and 2 cards are revealed", layout: { stage: "18073", side: "A", seats: 2, piles: { orcsDeck: ["f0", "f3"] } }, act: resolve("18073", "whenRevealed", undefined), expect: [zone("f0", "staging"), zone("f3", "staging"), deckCount(0), count("f0", "orcsDeck", 0)] },
];

cardSpecs("lost-in-mirkwood", ROWS);
