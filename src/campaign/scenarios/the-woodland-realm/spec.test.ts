// Rules: rr.search, rr.then, rr.reveal, rr.cancel, rr.forced, rr.travel, rr.explored, rr.victory, rr.quest-advancement, rr.shadow-effects, faq.additional-attacks (data/rules/entries.json); docs/scenarios/standalone-scenarios.md (The Woodland Realm).
import { announce, answer, attack, cardSpecs, committed, count, damageOn, deckCount, defend, exhausted, flag, handCount, lost, progressOn, quest, resolve, respond, resourcesOn, reveal, stat, threat, travel, window, won, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Woodland Realm (standalone-scenarios part 11): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests).
const F0 = ["f0", "f0", "f0", "f0", "f0", "f0"];
const DEN = "51110";
const MENDOR = "51111";
const ADVANCING = { phase: "Quest", deck: ["f0"] } as const;
// One card of each of the 14 sets, all of printed cost 0: the Setup keeps 7 of the sets and finds one of their cards.
const ONE_PER_SET = ["51113", "51116", "51118", "51121", "51124", "51128", "51131", "51134", "51137", "51140", "51143", "51147", "51150", "51152"];

const ROWS: readonly Row[] = [
  // 51101 Captured by Spiders.
  { line: "51101:A:1", name: "Setup: 7 of the 14 sets stay in the deck and a 0 cost enemy or location is found", layout: { stage: "51101", deck: ONE_PER_SET }, act: resolve("51101", "setup"), expect: [deckCount(6)] },
  { line: "51101:B:1", name: "Forced: when Spider Den is explored it flips and Mendor is in play under the first player's control", layout: { stage: "51101", staging: [DEN] }, act: announce("locationExplored", DEN), expect: [zone(MENDOR, "play"), exhausted(MENDOR, false)] },
  { line: "51101:B:2", name: "the players cannot advance while the first player controls no Mendor", layout: { stage: "51101", progress: 10, ...ADVANCING }, act: quest("success"), expect: [zone("51101", "questStage")] },
  // 51103 A Chosen Path.
  { line: "51103:A:1", name: "When Revealed: the top 5 cards are searched for a card with cost 1 or less, which is revealed", layout: { stage: "51103", deck: ["51112", "51130", "f0", "f0", "f0"] }, act: resolve("51103", "whenRevealed"), expect: [zone("51130", "staging")] },
  { line: "51103:A:1", name: "with two or more players a card of cost 2 or less is found", layout: { stage: "51103", seats: 2, deck: ["51112", "51127", "f0", "f0", "f0"] }, act: resolve("51103", "whenRevealed"), expect: [zone("51127", "staging")] },
  { line: "51103:B:1", name: "the first treachery revealed each round gains Doomed 1", layout: { stage: "51103", threat: [30, 30], deck: F0 }, act: reveal("treachery"), expect: [threat(31)] },
  { line: "51103:B:1", name: "a second treachery in the round gains none", layout: { stage: "51103", threat: [30, 30], deck: F0 }, act: [reveal("treachery"), reveal("treachery")], expect: [threat(31)] },
  { line: "51103:B:2", name: "Forced: after the commitment the progress on the quest is capped (5, or 10 with Mendor committed)", layout: { stage: "51103" }, act: announce("stagingStepBegins"), expect: [flag("table", "questProgressCap")] },
  // 51104 A Chosen Path.
  { line: "51104:A:1", name: "When Revealed: the top 5 cards are searched for a card with cost 1 or less, which is revealed", layout: { stage: "51104", deck: ["51112", "51130", "f0", "f0", "f0"] }, act: resolve("51104", "whenRevealed"), expect: [zone("51130", "staging")] },
  { line: "51104:B:1", name: "progress cannot be placed on a location in the staging area", layout: { stage: "51104", staging: ["place"] }, act: [], expect: [flag("place", "noProgressPlaced")] },
  { line: "51104:B:2", name: "the players must travel to a location during the travel phase", layout: { stage: "51104", staging: ["place"] }, act: [], expect: [flag("table", "mustTravel")] },
  { line: "51104:B:3", name: "Forced: after the commitment the progress on the quest is capped (5, or 10 with Mendor committed)", layout: { stage: "51104" }, act: announce("stagingStepBegins"), expect: [flag("table", "questProgressCap")] },
  // 51105 A Chosen Path.
  { line: "51105:A:1", name: "When Revealed: the top 5 cards are searched for a card with cost 1 or less, which is revealed", layout: { stage: "51105", deck: ["51112", "51130", "f0", "f0", "f0"] }, act: resolve("51105", "whenRevealed"), expect: [zone("51130", "staging")] },
  { line: "51105:B:1", name: "each enemy in the staging area gets -10 engagement cost, cannot be optionally engaged and cannot take damage", layout: { stage: "51105", staging: ["f3"] }, act: [], expect: [stat("f3", "engagementCost", 40), flag("f3", "cannotBeOptionallyEngaged"), flag("f3", "cannotTakeDamage")] },
  { line: "51105:B:2", name: "Forced: after the commitment the progress on the quest is capped (5, or 10 with Mendor committed)", layout: { stage: "51105" }, act: announce("stagingStepBegins"), expect: [flag("table", "questProgressCap")] },
  // 51107 On the Trail.
  { line: "51107:A:1", name: "When Revealed: the top 5 cards are searched for a card with cost 2 or less, which is revealed", layout: { stage: "51107", deck: ["51112", "51127", "f0", "f0", "f0"] }, act: resolve("51107", "whenRevealed"), expect: [zone("51127", "staging")] },
  { line: "51107:A:1", name: "with two or more players a card of cost 3 or less is found", layout: { stage: "51107", seats: 2, deck: ["51112", "51127", "f0", "f0", "f0"] }, act: resolve("51107", "whenRevealed"), expect: [zone("51112", "staging"), zone("51127", "staging")] },
  { line: "51107:B:1", name: "When Revealed: an enemy of any cost joins the staging area with a resource on it, +2 Attack, +2 Defense and immune to player card effects", layout: { stage: "51107", deck: ["f0", "51115", "f0"] }, act: resolve("51107", "whenRevealed"), expect: [zone("51115", "staging"), resourcesOn("51115", 1), stat("51115", "attack", 8), stat("51115", "defense", 5), flag("51115", "immuneToPlayerCards")] },
  { line: "51107:B:1", name: "the resource goes on an enemy in play of cost 2 or more even if the one found costs less", layout: { stage: "51107", staging: ["51127"], deck: ["f0", "51121"] }, act: resolve("51107", "whenRevealed"), expect: [zone("51121", "staging"), resourcesOn("51127", 1), resourcesOn("51121", 0)] },
  { line: "51107:B:2", name: "the stage cannot be defeated while an enemy with a resource is in play", layout: { stage: "51107", progress: 15, staging: [{ code: "51115", resources: 1 }], ...ADVANCING }, act: quest("success"), expect: [zone("51107", "questStage")] },
  { line: "51107:B:2", name: "the players win the game when the stage is defeated", layout: { stage: "51107" }, act: resolve("51107", "questResolution"), expect: [won] },
  // 51108 On the Trail.
  { line: "51108:A:1", name: "When Revealed: the top 5 cards are searched for a card with cost 2 or less, which is revealed", layout: { stage: "51108", deck: ["51112", "51127", "f0", "f0", "f0"] }, act: resolve("51108", "whenRevealed"), expect: [zone("51127", "staging")] },
  { line: "51108:A:1", name: "with two or more players a card of cost 3 or less is found", layout: { stage: "51108", seats: 2, deck: ["51112", "51127", "f0", "f0", "f0"] }, act: resolve("51108", "whenRevealed"), expect: [zone("51112", "staging"), zone("51127", "encounterDeck")] },
  { line: "51108:B:1", name: "X is the highest threat level of the players", layout: { stage: "51108", threat: [33, 25] }, act: [], expect: [stat("51108", "questPoints", 33)] },
  { line: "51108:B:2", name: "each player's threat cannot be reduced by more than 1 each round", layout: { stage: "51108", seats: 2 }, act: [], expect: [flag("table", "noteQuestProgress")] },
  { line: "51108:B:4", name: "the players win the game when the stage is defeated", layout: { stage: "51108" }, act: resolve("51108", "questResolution"), expect: [won] },
  // 51109 On the Trail.
  { line: "51109:A:1", name: "When Revealed: the top 5 cards are searched for a card with cost 2 or less, which is revealed", layout: { stage: "51109", deck: ["51112", "51127", "f0", "f0", "f0"] }, act: resolve("51109", "whenRevealed"), expect: [zone("51127", "staging")] },
  { line: "51109:A:1", name: "with two or more players a card of cost 3 or less is found", layout: { stage: "51109", seats: 2, deck: ["51112", "51127", "f0", "f0", "f0"] }, act: resolve("51109", "whenRevealed"), expect: [zone("51112", "staging"), zone("51127", "encounterDeck")] },
  { line: "51109:B:1", name: "Forced: at the beginning of the quest phase cards are discarded until a location, which joins the staging area", layout: { stage: "51109", phase: "Quest", deck: ["f3", "51113", "f0"] }, act: announce("beginningOfPhase", undefined, { seat: null, phase: "Quest" }), expect: [zone("51113", "staging"), zone("f3", "encounterDiscard")] },
  { line: "51109:B:2", name: "the players win the game when the stage is defeated", layout: { stage: "51109" }, act: resolve("51109", "questResolution"), expect: [won] },
  // 51110 Spider Den and 51111 Mendor.
  { line: "51110:A:2", name: "Travel: a 0 cost enemy joins the staging area", layout: { staging: ["51110"], deck: ["51112", "51121", "f0"] }, act: resolve("51110", "travel"), expect: [zone("51121", "staging")] },
  { line: "51110:A:2", name: "with two or more players an enemy of cost 1 or less", layout: { seats: 2, staging: ["51110"], deck: ["51112", "51130", "f0"] }, act: resolve("51110", "travel"), expect: [zone("51130", "staging")] },
  { line: "51111:A:3", name: "if Mendor leaves play the players lose the game", layout: { play: ["51111"] }, act: announce("leftPlay", "51111"), expect: [lost] },
  // 51112 Ungoliant's Spawn.
  { line: "51112:A:1", name: "it cannot take non-combat damage", layout: { staging: ["51112"] }, act: [], expect: [flag("51112", "cannotTakeNonCombatDamage")] },
  { line: "51112:A:2", name: "while it is in the staging area characters cannot be readied by player card effects", layout: { staging: ["51112"] }, act: [], expect: [flag("dh1", "cannotReadyByPlayerCard")] },
  // 51113 Forest Grove.
  { line: "51113:A:1", name: "X is 1 more than the stage number: its Threat and its quest points", layout: { stage: "51103", staging: ["51113"] }, act: [], expect: [stat("51113", "threat", 3), stat("51113", "questPoints", 3)] },
  { line: "51113:A:2", name: "Travel: each player deals X damage to a character he controls", layout: { stage: "51103", staging: ["51113"] }, act: resolve("51113", "travel"), expect: [damageOn("dh1", 3)] },
  // 51114 Despair.
  { line: "51114:A:1", name: "When Revealed: each character's text box is blank until the end of the round", layout: { deck: F0 }, act: reveal("51114"), expect: [flag("dh1", "blankText"), flag("dh2", "blankText")] },
  { line: "51114:A:2", name: "Shadow: the defending character's text box is blank until the end of the phase", layout: { engaged: ["f3"], deck: F0 }, act: [attack("f3", { shadow: "51114" }), defend("dh1")], expect: [flag("dh1", "blankText")] },
  // 51115 Chieftain Ufthak.
  { line: "51115:A:1", name: "it cannot take non-combat damage", layout: { staging: ["51115"] }, act: [], expect: [flag("51115", "cannotTakeNonCombatDamage")] },
  { line: "51115:A:2", name: "Forced: after it engages you an Orc enemy of cost 1 or less is put into play engaged with you", layout: { engaged: ["51115"], deck: ["f0", "51124", "f0"] }, act: announce("engaged", "51115", { seat: 0 }), expect: [zone("51124", "engaged")] },
  // 51116 Abandoned Camp.
  { line: "51116:A:1", name: "Forced: explored, the enemy of the encounter discard pile with the highest Threat is shuffled into the encounter deck", layout: { staging: ["51116"], discard: ["51117", "51121", "51118"], deck: ["f0"] }, act: announce("leftPlay", "51116", { explored: true }), expect: [zone("51121", "encounterDeck")] },
  // 51117 Gathering Gloom.
  { line: "51117:A:1", name: "When Revealed: each player raises his threat by 1 more than the stage number (stage 3 here)", layout: { stage: "51104", threat: [30, 30], deck: F0 }, act: reveal("51117"), expect: [threat(34)] },
  { line: "51117:A:2", name: "Shadow: +1 Attack", layout: { engaged: ["f3"], deck: F0 }, act: attack("f3", { shadow: "51117", undefended: true }), expect: [damageOn("dh1", 2)] },
  { line: "51117:A:2", name: "+2 Attack at threat 35 or higher", layout: { threat: [35, 35], engaged: ["f3"], deck: F0 }, act: attack("f3", { shadow: "51117", undefended: true }), expect: [damageOn("dh1", 3)] },
  // 51118 Black Forest Bats.
  { line: "51118:A:1", name: "When Revealed: the questing character of highest Willpower is removed from the quest", layout: { committed: ["dh1", "ally"], play: ["ally"], deck: F0 }, act: reveal("51118"), expect: [committed("dh1", false), committed("ally")] },
  { line: "51118:A:2", name: "Shadow: it is shuffled into the encounter deck", layout: { engaged: ["f3"], deck: F0 }, act: [attack("f3", { shadow: "51118" }), defend("dh1")], expect: [zone("51118", "encounterDeck")] },
  // 51119 Enchanted Stream.
  { line: "51119:A:1", name: "while it is in the staging area progress cannot be placed on the main quest", layout: { staging: ["51119"] }, act: [], expect: [flag("table", "noQuestProgress")] },
  { line: "51119:A:2", name: "Travel: each player exhausts a hero, which cannot ready while it is the active location", layout: { active: "51119" }, act: resolve("51119", "travel"), expect: [exhausted("dh1"), flag("dh1", "cannotReady")] },
  // 51120 Exhaustion.
  { line: "51120:A:1", name: "When Revealed: each player exhausts a character; player card effects cannot ready characters this round", layout: { deck: F0 }, act: reveal("51120"), expect: [exhausted("dh1")] },
  { line: "51120:A:2", name: "Shadow: the defending character cannot ready until the end of the round", layout: { engaged: ["f3"], deck: F0 }, act: [attack("f3", { shadow: "51120" }), defend("dh1")], expect: [flag("dh1", "cannotReady")] },
  // 51121 Spiders of Mirkwood.
  { line: "51121:A:1", name: "Forced: after it engages you, a character you control is exhausted", layout: { engaged: ["51121"] }, act: announce("engaged", "51121", { seat: 0 }), expect: [exhausted("dh1")] },
  { line: "51121:A:2", name: "Shadow: +1 Attack", layout: { engaged: ["f3"], deck: F0 }, act: attack("f3", { shadow: "51121", undefended: true }), expect: [damageOn("dh1", 2)] },
  { line: "51121:A:2", name: "+2 Attack for a Spider attacker", layout: { engaged: ["51130"], deck: F0 }, act: attack("51130", { shadow: "51121", undefended: true }), expect: [damageOn("dh1", 5)] },
  // 51122 The Spiders' Ring.
  { line: "51122:A:1", name: "each Spider enemy gets +1 Threat while it is in the staging area", layout: { staging: ["51122", "51121"] }, act: [], expect: [stat("51121", "threat", 3)] },
  { line: "51122:A:2", name: "Forced: explored, a non-unique Spider enemy joins the staging area", layout: { staging: ["51122"], deck: ["f0", "51121", "f0"] }, act: announce("locationExplored", "51122"), expect: [zone("51121", "staging")] },
  // 51123 Caught in a Web.
  { line: "51123:A:1", name: "When Revealed: it attaches to the hero of highest Willpower, which is exhausted and does not ready", layout: { deck: F0 }, act: reveal("51123"), expect: [zone("51123", "attached"), exhausted("dh1"), flag("dh1", "doesNotReady")] },
  // 51124 Wolf Rider.
  { line: "51124:A:1", name: "When Revealed: with another Orc enemy in the staging area it gains surge", layout: { staging: ["51133"], deck: F0 }, act: reveal("51124"), expect: [count("f0", "staging", 1)] },
  { line: "51124:A:2", name: "Shadow: with an Orc attacker it is put into play engaged with you", layout: { engaged: ["51133"], deck: F0 }, act: attack("51133", { shadow: "51124" }), expect: [zone("51124", "engaged")] },
  // 51125 The Goblins' Caves.
  { line: "51125:A:1", name: "each Orc enemy gets +1 Attack while it is in the staging area", layout: { staging: ["51125", "51124"] }, act: [], expect: [stat("51124", "attack", 3)] },
  { line: "51125:A:2", name: "Forced: explored, a non-unique Orc enemy joins the staging area", layout: { staging: ["51125"], deck: ["f0", "51124", "f0"] }, act: announce("locationExplored", "51125"), expect: [zone("51124", "staging")] },
  // 51126 Driven by Shadow.
  { line: "51126:A:1", name: "When Revealed: it attaches to the enemy of highest Threat, which returns to the staging area with +2 Threat, +2 Attack, +2 Defense", layout: { engaged: ["51115"], deck: F0 }, act: reveal("51126"), expect: [zone("51126", "attached"), zone("51115", "staging"), stat("51115", "attack", 8), stat("51115", "defense", 5), stat("51115", "threat", 5)] },
  { line: "51126:A:1", name: "with no enemy in play it gains surge", layout: { deck: F0 }, act: reveal("51126"), expect: [count("f0", "staging", 1)] },
  // 51127 Beast of Taur-nu-Fuin.
  { line: "51127:A:1", name: "+1 Attack for each damage on it", layout: { staging: [{ code: "51127", damage: 2 }] }, act: [], expect: [stat("51127", "attack", 5)] },
  { line: "51127:A:2", name: "Forced: dealt a shadow card with no shadow effect it takes 1 damage and so does the defender", layout: { engaged: ["51127"], deck: F0 }, act: [attack("51127"), defend("dh1")], expect: [damageOn("51127", 1), damageOn("dh1", 2)] },
  // 51128 Dark Black Woods.
  { line: "51128:A:1", name: "+1 Threat for each Dark Black Woods in the staging area", layout: { staging: ["51128", "51128"] }, act: [], expect: [stat("51128", "threat", 3)] },
  { line: "51128:A:2", name: "Travel: each player discards 1 card for each Dark Black Woods in the staging area", layout: { staging: ["51128", "51128"], hand: ["c1", "c1", "c1"] }, act: resolve("51128", "travel"), expect: [handCount(1)] },
  // 51129 Wind-whipped Rain.
  { line: "51129:A:1", name: "When Revealed: keep one card and discard the rest", layout: { hand: ["c1", "c2", "c3"], deck: F0 }, act: [reveal("51129"), answer("keep"), answer("c3")], expect: [handCount(1)] },
  { line: "51129:A:1", name: "or assign as much damage as there are cards in the hand", layout: { hand: ["c1", "c2", "c3"], deck: F0 }, act: [reveal("51129"), answer("damage")], expect: [damageOn("dh1", 3), handCount(3)] },
  { line: "51129:A:2", name: "Shadow: discard 1 random card from your hand", layout: { engaged: ["f3"], hand: ["c1", "c2"], deck: F0 }, act: [attack("f3", { shadow: "51129" }), defend("dh1")], expect: [handCount(1)] },
  // 51130 Giant Spider.
  { line: "51130:A:1", name: "When Revealed: each player exhausts a character", layout: { deck: F0 }, act: reveal("51130"), expect: [exhausted("dh1")] },
  { line: "51130:A:2", name: "Shadow: exhaust a character you control", layout: { engaged: ["f3"], deck: F0 }, act: attack("f3", { shadow: "51130", undefended: true }), expect: [exhausted("dh1")] },
  // 51131 Giant Web.
  { line: "51131:A:1", name: "When Revealed: it becomes the active location and the previous one returns to the staging area", layout: { active: "place", deck: F0 }, act: reveal("51131"), expect: [zone("51131", "activeLocation"), zone("place", "staging")] },
  // 51132 Eyes of the Forest.
  { line: "51132:A:2", name: "When Revealed: the card of highest cost in each hand is discarded", layout: { hand: ["c1", "c3", "c2"], deck: F0 }, act: reveal("51132"), expect: [count("c3", "discard", 1), handCount(2)] },
  { line: "51132:A:3", name: "Shadow: +X Attack, X the stage number", layout: { stage: "51103", engaged: ["f3"], deck: F0 }, act: attack("f3", { shadow: "51132", undefended: true }), expect: [damageOn("dh1", 3)] },
  // 51133 Mirkwood Patrol.
  { line: "51133:A:1", name: "while it is in the staging area enemies cannot be optionally engaged", layout: { staging: ["51133", "f3"] }, act: [], expect: [flag("table", "cannotBeOptionallyEngaged")] },
  { line: "51133:A:2", name: "Shadow: +1 Attack", layout: { engaged: ["f3"], deck: F0 }, act: attack("f3", { shadow: "51133", undefended: true }), expect: [damageOn("dh1", 2)] },
  // 51134 Mountains of Mirkwood.
  { line: "51134:A:1", name: "Forced: at the end of the round, while in the staging area, each player raises threat by 2", layout: { phase: "Planning", threat: [30, 30], staging: ["51134"] }, act: announce("endOfRound"), expect: [threat(32)] },
  { line: "51134:A:2", name: "Shadow: either raise your threat by 2", layout: { threat: [30, 30], engaged: ["f3"], deck: F0 }, act: [attack("f3", { shadow: "51134", undefended: true }), answer("threat")], expect: [threat(32)] },
  { line: "51134:A:2", name: "or the attacking enemy gets +2 Attack", layout: { engaged: ["f3"], deck: F0 }, act: [attack("f3", { shadow: "51134", undefended: true }), answer("attack")], expect: [damageOn("dh1", 3)] },
  // 51135 Hatred Rekindled.
  { line: "51135:A:1", name: "When Revealed: each engaged enemy makes an immediate attack", layout: { engaged: ["f3"], deck: F0 }, act: reveal("51135"), expect: [window("defense")] },
  { line: "51135:A:1", name: "if no attacks were made it gains surge", layout: { deck: F0 }, act: reveal("51135"), expect: [count("f0", "staging", 1)] },
  { line: "51135:A:2", name: "Shadow: +1 Attack and an additional shadow card", layout: { engaged: ["f3"], deck: F0 }, act: attack("f3", { shadow: "51135", undefended: true }), expect: [damageOn("dh1", 2), deckCount(5)] },
  // 51136 Wild Bear.
  { line: "51136:A:1", name: "Threat and Defense X: 1 more than the stage number", layout: { stage: "51103", staging: ["51136"] }, act: [], expect: [stat("51136", "threat", 3), stat("51136", "defense", 3)] },
  { line: "51136:A:2", name: "Shadow: +X Defense to the attacker until the end of the phase, X the stage number", layout: { stage: "51103", engaged: ["f3"], deck: F0 }, act: attack("f3", { shadow: "51136", undefended: true }), expect: [stat("f3", "defense", 3)] },
  // 51137 Labyrinthine Woods.
  { line: "51137:A:1", name: "When Revealed: each location in the staging area gets +1 Threat until the end of the phase", layout: { staging: ["place"], deck: F0 }, act: reveal("51137"), expect: [stat("place", "threat", 3)] },
  { line: "51137:A:2", name: "Shadow: each enemy engaged with you gets +1 Attack until the end of the phase", layout: { engaged: ["f3"], deck: F0 }, act: attack("f3", { shadow: "51137", undefended: true }), expect: [damageOn("dh1", 2)] },
  // 51138 Vastness of Mirkwood.
  { line: "51138:A:1", name: "When Revealed: the top 5 cards are searched for a card with cost up to the stage number, which is revealed", layout: { stage: "51103", deck: ["51112", "51121", "f0", "f0", "f0"] }, act: reveal("51138"), expect: [zone("51121", "staging")] },
  { line: "51138:A:2", name: "Shadow: if the attack destroys a character the top card of the encounter deck is revealed", layout: { engaged: ["51112"], play: ["ally"], deck: F0 }, act: [attack("51112", { shadow: "51138" }), defend("ally")], expect: [deckCount(5)] },
  // 51139 Mirkwood Flock.
  { line: "51139:A:2", name: "Shadow: it is added to the staging area", layout: { engaged: ["f3"], deck: F0 }, act: attack("f3", { shadow: "51139" }), expect: [zone("51139", "staging")] },
  // 51140 The Eaves of Mirkwood.
  { line: "51140:A:1", name: "while it is in the staging area at most 1 progress can be placed on each location there", layout: { staging: ["51140", "place"] }, act: [], expect: [flag("place", "progressCap")] },
  { line: "51140:A:2", name: "Travel: each player discards 1 random card from his hand", layout: { staging: ["51140"], hand: ["c1", "c1"] }, act: resolve("51140", "travel"), expect: [handCount(1)] },
  // 51141 Massing at Night.
  { line: "51141:A:1", name: "When Revealed: a 0 cost enemy joins the staging area", layout: { deck: ["51112", "51121", "f0"] }, act: reveal("51141"), expect: [zone("51121", "staging")] },
  { line: "51141:A:1", name: "two players: two different enemies", layout: { seats: 2, deck: ["51121", "51121", "51124", "f0"] }, act: reveal("51141"), expect: [zone("51121", "staging"), zone("51124", "staging")] },
  { line: "51141:A:2", name: "Shadow: after an attack that destroys a character the attacker attacks again, dealt a new shadow card", layout: { engaged: ["51112"], play: ["ally"], deck: F0 }, act: [attack("51112", { shadow: "51141" }), defend("ally")], expect: [deckCount(5)] },
  // 51142 Wild Wargs.
  { line: "51142:A:1", name: "Forced: dealt a shadow card with no shadow effect it returns to the staging area", layout: { engaged: ["51142"], deck: F0 }, act: [attack("51142"), defend("dh1")], expect: [zone("51142", "staging")] },
  { line: "51142:A:2", name: "Shadow: the attacker returns to the staging area after the attack", layout: { engaged: ["f3"], deck: F0 }, act: attack("f3", { shadow: "51142" }), expect: [zone("f3", "staging")] },
  // 51143 Dry Watercourse.
  { line: "51143:A:2", name: "Travel: raise each player's threat by 1", layout: { threat: [30, 30], staging: ["51143"] }, act: resolve("51143", "travel"), expect: [threat(31)] },
  // 51144 Turned Around.
  { line: "51144:A:1", name: "When Revealed: 5 progress come off the main quest, which gets +5 quest points", layout: { stage: "51103", progress: 7, deck: F0 }, act: reveal("51144"), expect: [progressOn("51103", 2), stat("51103", "questPoints", 25), zone("51144", "attached")] },
  // 51145 Pack of Wargs.
  { line: "51145:A:1", name: "it cannot take non-combat damage", layout: { staging: ["51145"] }, act: [], expect: [flag("51145", "cannotTakeNonCombatDamage")] },
  { line: "51145:A:2", name: "Forced: dealt a shadow card with no shadow effect it makes an additional attack, dealt no shadow card", layout: { engaged: ["51145"], deck: F0 }, act: attack("51145", { undefended: true }), expect: [damageOn("dh1", 8)] },
  // 51146 Dark-wood Grove.
  { line: "51146:A:1", name: "Forced: in the staging area, after a 'when revealed' effect is canceled each player raises threat by 3", layout: { threat: [30, 30], staging: ["51146"] }, act: announce("whenRevealedCanceled"), expect: [threat(33)] },
  { line: "51146:A:2", name: "Travel: the top card of the encounter deck is revealed", layout: { staging: ["51146"], deck: ["f3", "f0"] }, act: resolve("51146", "travel"), expect: [zone("f3", "staging")] },
  // 51147 Lost and Witless.
  { line: "51147:A:1", name: "When Revealed: each ally card in each hand is discarded", layout: { hand: ["ally", "c1"], deck: F0 }, act: reveal("51147"), expect: [count("ally", "discard", 1), handCount(1)] },
  { line: "51147:A:2", name: "Shadow: if the attack is undefended an ally you control is discarded", layout: { engaged: ["f3"], play: ["ally"], deck: F0 }, act: attack("f3", { shadow: "51147", undefended: true }), expect: [zone("ally", "discard")] },
  { line: "51147:A:2", name: "an ally discarded is Mendor: the players lose the game", layout: { seats: 2, engaged: ["f3"], play: ["51111"], deck: F0 }, act: attack("f3", { shadow: "51147", undefended: true }), expect: [lost] },
  // 51148 Wicked Spider.
  { line: "51148:A:2", name: "Shadow: the attacker cannot take damage this phase", layout: { engaged: ["f3"], deck: F0 }, act: attack("f3", { shadow: "51148" }), expect: [flag("f3", "cannotTakeDamage")] },
  // 51149 Old Forest Road.
  { line: "51149:A:1", name: "Response: after the players travel to it the top card of the first player's deck is discarded and an ally is put into play", layout: { phase: "Travel", staging: ["51149"], deckOf: ["ally", "f0"] }, act: [travel("51149"), respond("51149")], expect: [count("ally", "play", 1)] },
  { line: "51149:A:2", name: "Travel: the top card of the encounter deck is discarded and an enemy is added to the staging area", layout: { staging: ["51149"], deck: ["f3", "f0"] }, act: resolve("51149", "travel"), expect: [zone("f3", "staging")] },
  // 51150 A Frightened Beast.
  { line: "51150:A:1", name: "When Revealed: raise your threat by 1 for each questing character you control", layout: { threat: [30, 30], committed: ["dh1", "dh2"], deck: F0 }, act: [reveal("51150"), answer("threat")], expect: [threat(32)] },
  { line: "51150:A:1", name: "or discard a questing character you control", layout: { committed: ["dh1", "dh2"], deck: F0 }, act: [reveal("51150"), answer("discard")], expect: [zone("dh1", "discard")] },
  { line: "51150:A:2", name: "Shadow: +1 Attack", layout: { engaged: ["f3"], deck: F0 }, act: attack("f3", { shadow: "51150", undefended: true }), expect: [damageOn("dh1", 2)] },
  { line: "51150:A:2", name: "a destroyed character raises each player's threat by 1", layout: { threat: [30, 30], engaged: ["51115"], play: ["ally"], deck: F0 }, act: [attack("51115", { shadow: "51150" }), defend("ally")], expect: [threat(31)] },
  // 51151 Ambushing Orcs.
  { line: "51151:A:1", name: "When Revealed: it makes an immediate attack against the first player", layout: { deck: F0 }, act: reveal("51151"), expect: [window("defense")] },
  { line: "51151:A:2", name: "Shadow: the lowest engagement cost enemy in the staging area engages you", layout: { engaged: ["f3"], staging: ["51112", "51115"], deck: F0 }, act: attack("f3", { shadow: "51151", undefended: true }), expect: [zone("51115", "engaged")] },
  // 51152 Mirkwood Path.
  { line: "51152:A:1", name: "Forced: explored, the top card is discarded and a location so discarded joins the staging area", layout: { staging: ["51152"], deck: ["place", "f0"] }, act: announce("locationExplored", "51152"), expect: [zone("place", "staging")] },
  { line: "51152:A:1", name: "a card that is not a location stays in the discard pile", layout: { staging: ["51152"], deck: ["f3", "f0"] }, act: announce("locationExplored", "51152"), expect: [zone("f3", "encounterDiscard")] },
  // 51153 Wasted Provisions.
  { line: "51153:A:1", name: "When Revealed: each resource is discarded from each hero and each player raises threat for each one", layout: { threat: [30, 30], heroResources: 1, deck: F0 }, act: reveal("51153"), expect: [threat(32), resourcesOn("dh1", 0)] },
  { line: "51153:A:1", name: "with no resource discarded it gains surge", layout: { deck: F0 }, act: reveal("51153"), expect: [count("f0", "staging", 1)] },
  { line: "51153:A:2", name: "Shadow: discard an attachment you control", layout: { engaged: ["f3"], attached: [{ code: "attachment", to: "dh1" }], deck: F0 }, act: [attack("f3", { shadow: "51153" }), defend("dh1")], expect: [count("attachment", "discard", 1)] },
];

cardSpecs("the-woodland-realm", ROWS);
