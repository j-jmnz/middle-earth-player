// Rules: rr.search, rr.reveal, rr.forced, rr.guarded, rr.explored, rr.travel, rr.step-4-2, rr.doomed-x, rr.attachment-cards, rr.cancel, rr.victory, rr.quest-advancement, rr.shadow-effects, mec108.side-quests, faq.additional-attacks, faq.lasting-effects (data/rules/entries.json); docs/scenarios/standalone-scenarios.md (The Wizard's Quest).
import { announce, answer, attack, cardSpecs, committed, count, damageOn, deckCount, defend, endPhase, endRound, exhausted, flag, handCount, progressOn, quest, resolve, respond, resourcesOn, reveal, stat, threat, travel, won, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Wizard's Quest (standalone-scenarios part 10): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests).
const F0 = ["f0", "f0", "f0", "f0", "f0", "f0"];
const RHOSGOBEL = "51010";
const RIDER = "51011";
const ADVANCING = { phase: "Quest", deck: ["f0"] } as const;
const BEGINNING_OF = (phase: "Quest" | "Travel") => ({ seat: null, phase }) as const;
// The 0 cost card of the encounter deck, then a card of cost 3 and one of cost 1: the top 5 cards a stage's When Revealed searches.
const TOP = ["51012", "51014", "51034", "f0", "f0"];

const ROWS: readonly Row[] = [
  // 51001 Radagast's Request.
  { line: "51001:A:1", name: "Setup: 7 of the 8 sets stay, the first player's stages are chosen and the 0 cost enemy or location of highest Threat joins the staging area", layout: { stage: "51001", deck: ["51012", "51015", "51018", "51021", "51024", "51028", "51031", "51034"] }, act: resolve("51001", "setup"), expect: [deckCount(6)] },
  { line: "51001:B:1", name: "Forced: when Rhosgobel is explored in the staging area it flips and Rider of Mirkwood joins the staging area", layout: { stage: "51001", staging: [RHOSGOBEL] }, act: announce("locationExplored", RHOSGOBEL), expect: [count(RIDER, "staging", 1)] },
  { line: "51001:B:1", name: "as the active location it flips once", layout: { stage: "51001", active: RHOSGOBEL }, act: announce("activeExplored", RHOSGOBEL), expect: [count(RIDER, "staging", 1)] },
  { line: "51001:B:2", name: "the players cannot advance while Rhosgobel is in play", layout: { stage: "51001", progress: 10, staging: [RHOSGOBEL], ...ADVANCING }, act: quest("success"), expect: [zone("51001", "questStage")] },
  // 51003 A Fork in the Road.
  { line: "51003:A:1", name: "When Revealed: the top 5 cards are searched for a card with cost 1 or less, which is revealed", layout: { stage: "51003", deck: TOP }, act: resolve("51003", "whenRevealed"), expect: [zone("51014", "encounterDiscard")] },
  { line: "51003:A:1", name: "with two or more players a card of cost 2 or less is found", layout: { stage: "51003", seats: 2, deck: ["51012", "51021", "51034", "f0", "f0"] }, act: resolve("51003", "whenRevealed"), expect: [zone("51021", "staging")] },
  { line: "51003:B:1", name: "When Revealed: a location of cost 2 or less joins the staging area with a resource on it", layout: { stage: "51003", deck: ["51044", "51013", "f0"] }, act: resolve("51003", "whenRevealed"), expect: [zone("51013", "staging"), resourcesOn("51013", 1)] },
  { line: "51003:B:2", name: "while the stage holds fewer than 5 progress a location with a resource is immune to player card effects", layout: { stage: "51003", staging: [{ code: "51044", resources: 1 }] }, act: [], expect: [flag("51044", "immuneToPlayerCards")] },
  { line: "51003:B:2", name: "the stage cannot be defeated while a location with a resource is in play", layout: { stage: "51003", progress: 5, staging: [{ code: "51044", resources: 1 }], ...ADVANCING }, act: quest("success"), expect: [zone("51003", "questStage")] },
  // 51004 Carried Away.
  { line: "51004:A:1", name: "When Revealed: the top 5 cards are searched for a card with cost 1 or less, which is revealed", layout: { stage: "51004", deck: TOP }, act: resolve("51004", "whenRevealed"), expect: [zone("51014", "encounterDiscard")] },
  { line: "51004:B:1", name: "When Revealed: each player's ally of highest cost lies under the stage", layout: { stage: "51004", play: ["ally"] }, act: resolve("51004", "whenRevealed"), expect: [zone("ally", "under")] },
  { line: "51004:B:2", name: "Forced: when the stage is defeated each held ally returns to its owner's hand", layout: { stage: "51004", play: ["ally"] }, act: [resolve("51004", "whenRevealed"), announce("questCardDefeated", "51004")], expect: [zone("ally", "hand")] },
  // 51005 A New Terror Abroad.
  { line: "51005:A:1", name: "When Revealed: the top 5 cards are searched for a card with cost 1 or less, which is revealed", layout: { stage: "51005", deck: TOP }, act: resolve("51005", "whenRevealed"), expect: [zone("51014", "encounterDiscard")] },
  { line: "51005:B:1", name: "the stage has 5 more quest points for each player", layout: { stage: "51005", seats: 2 }, act: [], expect: [stat("51005", "questPoints", 15)] },
  { line: "51005:B:2", name: "Forced: at the beginning of the quest phase Rider of Mirkwood attacks the first player from the staging area", layout: { stage: "51005", phase: "Quest", staging: [RIDER], deck: F0 }, act: [announce("beginningOfPhase", undefined, BEGINNING_OF("Quest")), endPhase], expect: [damageOn("dh1", 6)] },
  // 51007 The Necromancer's Tower.
  { line: "51007:A:1", name: "When Revealed: the top 5 cards are searched for a card with cost 2 or less", layout: { stage: "51007", deck: ["51012", "51021", "f0", "f0", "f0"] }, act: resolve("51007", "whenRevealed"), expect: [zone("51021", "staging")] },
  { line: "51007:B:1", name: "Forced: cards are discarded until a treachery, which is revealed in full, Doomed included", layout: { stage: "51007", threat: [30, 30], deck: ["f0", "51023", "f0"] }, act: announce("stagingStepBegins"), expect: [zone("51023", "attached"), threat(31)] },
  { line: "51007:B:2", name: "the players win the game when the stage is defeated", layout: { stage: "51007" }, act: resolve("51007", "questResolution"), expect: [won] },
  // 51008 Dungeons of the Necromancer.
  { line: "51008:A:1", name: "When Revealed: the top 5 cards are searched for a card with cost 2 or less", layout: { stage: "51008", deck: ["51012", "51044", "f3", "f0", "f0"] }, act: resolve("51008", "whenRevealed"), expect: [zone("51044", "staging")] },
  { line: "51008:B:1", name: "When Revealed: each player's hero lies under the first enemy discarded", layout: { stage: "51008", deck: ["f3", "f0"] }, act: resolve("51008", "whenRevealed"), expect: [zone("dh1", "captive")] },
  { line: "51008:B:2", name: "the players win the game when the stage is defeated", layout: { stage: "51008" }, act: resolve("51008", "questResolution"), expect: [won] },
  // 51009 Return to Rhosgobel.
  { line: "51009:A:1", name: "When Revealed: the top 5 cards are searched for a card with cost 2 or less", layout: { stage: "51009", deck: ["51012", "51021", "f0", "f0", "f0"] }, act: resolve("51009", "whenRevealed"), expect: [zone("51021", "staging")] },
  { line: "51009:B:1", name: "Rider of Mirkwood has engagement cost 0", layout: { stage: "51009", staging: [RIDER] }, act: [], expect: [stat(RIDER, "engagementCost", 0)] },
  { line: "51009:B:2", name: "with no progress on the stage Rider of Mirkwood cannot take damage", layout: { stage: "51009", staging: [RIDER] }, act: [], expect: [flag(RIDER, "cannotTakeDamage")] },
  { line: "51009:B:2", name: "otherwise its damage cannot exceed the progress on the stage", layout: { stage: "51009", progress: 3, staging: [RIDER] }, act: [], expect: [stat(RIDER, "damageCeiling", 3)] },
  { line: "51009:B:3", name: "the stage cannot be defeated while Rider of Mirkwood is in play", layout: { stage: "51009", progress: 10, engaged: [RIDER], ...ADVANCING }, act: quest("success"), expect: [zone("51009", "questStage")] },
  { line: "51009:B:3", name: "the players win the game when the stage is defeated", layout: { stage: "51009" }, act: resolve("51009", "questResolution"), expect: [won] },
  // 51010 Rhosgobel and 51011 Rider of Mirkwood.
  { line: "51010:A:2", name: "Response: after the players travel to it each hero gains 1 resource and each player draws 1 card", layout: { phase: "Travel", staging: [RHOSGOBEL], deckOf: ["f0", "f0"] }, act: [travel(RHOSGOBEL), respond(RHOSGOBEL)], expect: [resourcesOn("dh1", 2), handCount(2)] },
  { line: "51011:A:2", name: "Threat X: 1 more than the stage number", layout: { stage: "51003", staging: [RIDER] }, act: [], expect: [stat(RIDER, "threat", 3)] },
  { line: "51011:A:3", name: "it cannot leave the staging area unless the players are at stage 3", layout: { stage: "51005", staging: [RIDER] }, act: [], expect: [flag(RIDER, "cannotLeaveStaging")] },
  // 51012 Nazgûl of Dol Guldur.
  { line: "51012:A:1", name: "it cannot take non-combat damage", layout: { staging: ["51012"] }, act: [], expect: [flag("51012", "cannotTakeNonCombatDamage")] },
  { line: "51012:A:2", name: "Forced: after it attacks you its controller raises threat by 3 (or it returns to the staging area)", layout: { threat: [30, 30], engaged: ["51012"], deck: F0 }, act: [attack("51012"), answer("threat")], expect: [threat(33)] },
  { line: "51012:A:2", name: "or the enemy returns to the staging area", layout: { threat: [30, 30], engaged: ["51012"], deck: F0 }, act: [attack("51012"), answer("return")], expect: [zone("51012", "staging")] },
  // 51013 Necromancer's Pass.
  { line: "51013:A:1", name: "When Revealed: the first player keeps a card of his hand and the highest cost card of the others lies under the location", layout: { staging: ["51013"], hand: ["c1", "c3", "c2"] }, act: resolve("51013", "whenRevealed"), expect: [count("c3", "under", 1)] },
  // 51014 Pursued by Shadow.
  { line: "51014:A:1", name: "When Revealed: the enemy of highest Attack in the staging area attacks the first player", layout: { staging: ["51018", "51024"], deck: F0 }, act: [reveal("51014"), endPhase], expect: [damageOn("dh1", 2)] },
  { line: "51014:A:1", name: "with no enemy in the staging area it gains surge", layout: { deck: F0 }, act: reveal("51014"), expect: [count("f0", "staging", 1)] },
  { line: "51014:A:2", name: "Shadow: after the attack a unique attacker attacks again, dealt a new shadow card", layout: { engaged: ["51015"], deck: F0 }, act: attack("51015", { shadow: "51014" }), expect: [deckCount(5)] },
  // 51015 Bane of Amon Lanc.
  { line: "51015:A:2", name: "Forced: after it destroys an ally the defending player discards 1 card for each point of excess damage", layout: { engaged: ["51015"], play: ["ally"], hand: ["c0", "c0", "c0", "c0", "c0"], deck: F0 }, act: [attack("51015"), defend("ally")], expect: [handCount(1)] },
  // 51016 Oak-wood Grove.
  { line: "51016:A:1", name: "no progress is placed on the other locations of the staging area while it is there", layout: { staging: ["51016", "place"] }, act: [], expect: [flag("place", "noProgressPlaced")] },
  { line: "51016:A:2", name: "Travel: each player exhausts a character", layout: { staging: ["51016"] }, act: resolve("51016", "travel"), expect: [exhausted("dh1")] },
  // 51017 Smoking Blood.
  { line: "51017:A:1", name: "When Revealed: it attaches to the Troll with the most hit points left and cancels the damage that would destroy it", layout: { staging: [{ code: "51015", damage: 8 }, "51034"], deck: F0 }, act: reveal("51017"), expect: [zone("51017", "attached"), flag("51034", "cancelsLethalDamage"), flag("51015", "cancelsLethalDamage", false)] },
  { line: "51017:A:1", name: "with no Troll in play it gains surge", layout: { staging: ["f3"], deck: F0 }, act: reveal("51017"), expect: [count("f0", "staging", 1)] },
  { line: "51017:A:1", name: "a Troll that carries a copy is not a host: with no other Troll it gains surge", layout: { staging: ["51034"], attached: [{ code: "51017", to: "51034" }], deck: F0 }, act: reveal("51017"), expect: [count("f0", "staging", 1)] },
  // 51018 Forest Flies.
  { line: "51018:A:1", name: "Forced: as it attacks, the defending player raises threat by 1", layout: { threat: [30, 30], engaged: ["51018"], deck: F0 }, act: attack("51018"), expect: [threat(31)] },
  { line: "51018:A:2", name: "Shadow: raise your threat by 1 for each enemy engaged with you", layout: { threat: [30, 30], engaged: ["f3", "f0"], deck: F0 }, act: attack("f3", { shadow: "51018" }), expect: [threat(32)] },
  // 51019 Twilight Hall.
  { line: "51019:A:2", name: "+1 Threat for each character the first player controls", layout: { staging: ["51019"], play: ["ally"] }, act: [], expect: [stat("51019", "threat", 3)] },
  { line: "51019:A:3", name: "Forced: when it is explored each player reveals 1 encounter card", layout: { staging: ["51019"], deck: F0 }, act: announce("locationExplored", "51019"), expect: [deckCount(5)] },
  { line: "51019:A:3", name: "explored as the active location it reveals one card for each player, once", layout: { active: "51019", deck: F0 }, act: announce("activeExplored", "51019"), expect: [deckCount(5)] },
  // 51020 Swarming Mosquitoes.
  { line: "51020:A:1", name: "When Revealed: each player deals X damage to a character, X 1 more than the stage number", layout: { stage: "51003", deck: F0 }, act: reveal("51020"), expect: [damageOn("dh1", 3)] },
  { line: "51020:A:2", name: "Shadow: +1 Attack", layout: { engaged: ["f3"], deck: F0 }, act: attack("f3", { shadow: "51020", undefended: true }), expect: [damageOn("dh1", 2)] },
  { line: "51020:A:2", name: "+2 Attack when the defender has an attachment", layout: { engaged: ["f3"], attached: [{ code: "attachment", to: "dh1" }], deck: F0 }, act: [attack("f3", { shadow: "51020" }), defend("dh1")], expect: [damageOn("dh1", 1)] },
  // 51021 Goblin Sniper.
  { line: "51021:A:1", name: "it cannot be optionally engaged", layout: { staging: ["51021"] }, act: [], expect: [flag("51021", "cannotBeOptionallyEngaged")] },
  { line: "51021:A:2", name: "Forced: at the end of the combat phase each player deals 1 damage to a hero", layout: { phase: "Refresh", staging: ["51021"] }, act: announce("endOfPhase", undefined, { seat: null, phase: "Combat" }), expect: [damageOn("dh1", 1)] },
  { line: "51021:A:3", name: "Shadow: the defending character's Defense is not counted", layout: { engaged: ["f3"], deck: F0 }, act: [attack("f3", { shadow: "51021" }), defend("dh1")], expect: [damageOn("dh1", 1)] },
  // 51022 Pine Slopes.
  { line: "51022:A:1", name: "When Revealed: each Pine Slopes gets +2 Threat until the end of the phase", layout: { staging: ["51022"], deck: F0 }, act: reveal("51022"), expect: [stat("51022", "threat", 4)] },
  { line: "51022:A:2", name: "Travel: the first player raises his threat by 1 for each Pine Slopes in the staging area", layout: { phase: "Travel", threat: [30, 30], staging: ["51022", "51022"] }, act: travel("51022"), expect: [threat(33)] },
  // 51023 Under the Shadow.
  { line: "51023:A:2", name: "When Revealed: it attaches to the main quest", layout: { stage: "51003", deck: F0 }, act: reveal("51023"), expect: [zone("51023", "attached")] },
  // 51024 Necromancer's Warg.
  { line: "51024:A:1", name: "Forced: after it engages you, 1 damage to a character you control", layout: { engaged: ["51024"] }, act: announce("engaged", "51024", { seat: 0 }), expect: [damageOn("dh1", 1)] },
  { line: "51024:A:2", name: "Shadow: with an Orc and a Warg enemy engaged with you, a character you control is discarded", layout: { engaged: ["51021", "51037"], deck: F0 }, act: [attack("51021", { shadow: "51024" }), defend("dh1")], expect: [zone("dh1", "discard")] },
  // 51025 Dol Guldur Beastmaster.
  { line: "51025:A:1", name: "Forced: after it engages you a Necromancer's Warg from the encounter deck is put into play engaged with you", layout: { engaged: ["51025"], deck: ["f0", "51024", "f0"] }, act: announce("engaged", "51025", { seat: 0 }), expect: [zone("51024", "engaged")] },
  // 51026 Watched Path.
  { line: "51026:A:1", name: "Forced: when it is explored the top card of the encounter deck is discarded, and an enemy so discarded joins the staging area", layout: { staging: ["51026"], deck: ["f3", "f0"] }, act: announce("locationExplored", "51026"), expect: [zone("f3", "staging")] },
  { line: "51026:A:1", name: "a card that is not an enemy stays in the discard pile", layout: { staging: ["51026"], deck: ["treachery", "f0"] }, act: announce("locationExplored", "51026"), expect: [zone("treachery", "encounterDiscard")] },
  { line: "51026:A:1", name: "explored as the active location it discards one card", layout: { active: "51026", deck: ["f3", "f3", "f0"] }, act: announce("activeExplored", "51026"), expect: [deckCount(2)] },
  // 51027 Evil Storm.
  { line: "51027:A:1", name: "When Revealed: each player deals 1 damage to a questing character; each damaged character gets -1 Willpower and cannot be healed", layout: { committed: ["dh1"], deck: F0 }, act: reveal("51027"), expect: [damageOn("dh1", 1), stat("dh1", "willpower", 1)] },
  { line: "51027:A:1", name: "a character damaged before it is a damaged character too", layout: { committed: ["dh1"], play: [{ code: "ally", damage: 1 }], deck: F0 }, act: reveal("51027"), expect: [stat("ally", "willpower", 0)] },
  { line: "51027:A:2", name: "Shadow: 1 damage to the defending character", layout: { engaged: ["f3"], deck: F0 }, act: [attack("f3", { shadow: "51027" }), defend("dh1")], expect: [damageOn("dh1", 1)] },
  // 51028 Spider of Dol Guldur.
  { line: "51028:A:1", name: "Forced: after it destroys an ally it returns to the staging area", layout: { engaged: ["51028"], play: ["ally"], deck: F0 }, act: [attack("51028"), defend("ally")], expect: [zone("51028", "staging")] },
  { line: "51028:A:2", name: "Shadow: the attacker attacks again, dealt a new shadow card", layout: { engaged: ["f3"], deck: F0 }, act: attack("f3", { shadow: "51028" }), expect: [deckCount(5)] },
  // 51029 Patch of Midnight.
  { line: "51029:A:1", name: "Forced: at the beginning of the staging step it is discarded and the top card of the encounter deck is revealed", layout: { staging: ["51029"], deck: ["f3", "f0"] }, act: announce("stagingStepBegins"), expect: [zone("51029", "encounterDiscard"), zone("f3", "staging")] },
  { line: "51029:A:2", name: "Shadow: if the attack destroys a character the top card of the encounter deck is revealed", layout: { engaged: ["51015"], play: ["ally"], deck: F0 }, act: [attack("51015", { shadow: "51029" }), defend("ally")], expect: [deckCount(5)] },
  // 51030 Eyes in the Dark.
  { line: "51030:A:1", name: "When Revealed: the questing character of highest Willpower is readied and removed from the quest", layout: { committed: ["dh1"], deck: F0 }, act: reveal("51030"), expect: [committed("dh1", false), exhausted("dh1", false)] },
  { line: "51030:A:2", name: "Shadow: +1 Attack", layout: { engaged: ["f3"], deck: F0 }, act: attack("f3", { shadow: "51030", undefended: true }), expect: [damageOn("dh1", 2)] },
  { line: "51030:A:2", name: "a destroyed character raises each player's threat by 1", layout: { threat: [30, 30], engaged: ["51015"], play: ["ally"], deck: F0 }, act: [attack("51015", { shadow: "51030" }), defend("ally")], expect: [threat(31)] },
  // 51031 Eastern Crows.
  { line: "51031:A:1", name: "while a copy is in the discard pile it gains surge", layout: { discard: ["51031"], deck: F0 }, act: reveal("51031"), expect: [count("f0", "staging", 1)] },
  // 51032 The Sorcerer's Tower.
  { line: "51032:A:1", name: "while it is in the staging area each treachery gains Doomed 1", layout: { staging: ["51032"], threat: [30, 30], deck: F0 }, act: reveal("treachery"), expect: [threat(31)] },
  { line: "51032:A:2", name: "Forced: when it is explored the discard pile is shuffled into the deck and the first treachery discarded is revealed", layout: { staging: ["51032"], deck: ["f0", "treachery", "f0"] }, act: announce("locationExplored", "51032"), expect: [zone("treachery", "encounterDiscard"), deckCount(1)] },
  { line: "51032:A:2", name: "explored as the active location it reveals one treachery", layout: { active: "51032", deck: ["treachery", "treachery", "f0"] }, act: announce("activeExplored", "51032"), expect: [deckCount(2)] },
  // 51033 Power Sevenfold.
  { line: "51033:A:1", name: "When Revealed: the non-unique enemy or location of lowest Threat is discarded and 1 card is revealed", layout: { staging: ["51024", "51015"], deck: F0 }, act: reveal("51033"), expect: [zone("51024", "encounterDiscard"), count("f0", "staging", 1)] },
  { line: "51033:A:1", name: "When Revealed: a unique card of lower Threat is not chosen, only a non-unique one", layout: { staging: ["51024", "51010"], deck: F0 }, act: reveal("51033"), expect: [zone("51024", "encounterDiscard"), zone("51010", "staging")] },
  { line: "51033:A:2", name: "Shadow: the defending player reveals an encounter card", layout: { engaged: ["f3"], deck: F0 }, act: [attack("f3", { shadow: "51033" }), answer("reveal")], expect: [count("f0", "staging", 1)] },
  { line: "51033:A:2", name: "or the attack is treated as undefended", layout: { engaged: ["f3"], deck: F0 }, act: [attack("f3", { shadow: "51033" }), answer("undefended")], expect: [damageOn("dh1", 1)] },
  // 51035 Troll Cave.
  { line: "51035:A:1", name: "Response: after the players travel to it each player draws 1 card", layout: { phase: "Travel", staging: ["51035"], deckOf: ["f0", "f0"] }, act: [travel("51035"), respond("51035")], expect: [handCount(2)] },
  { line: "51035:A:2", name: "Travel: a Hill Troll among the top 5 cards of the encounter deck is added to the staging area", layout: { staging: ["51035"], deck: ["f0", "51034", "f0"] }, act: resolve("51035", "travel"), expect: [zone("51034", "staging")] },
  // 51036 Befouled Equipment.
  { line: "51036:A:1", name: "When Revealed: it attaches to a character with an attachment", layout: { attached: [{ code: "attachment", to: "dh1" }], deck: F0 }, act: reveal("51036"), expect: [zone("51036", "attached")] },
  // 51037 Hunting Warg.
  { line: "51037:A:1", name: "Forced: after it engages a player it makes an immediate attack; dealt a shadow card with no effect it gets +2 Attack for it", layout: { engaged: ["51037"], deck: F0 }, act: [announce("engaged", "51037", { seat: 0 }), endPhase], expect: [damageOn("dh1", 5)] },
  // 51038 Hunter's Lookout.
  { line: "51038:A:1", name: "Forced: at the end of the round each player raises threat by 1 for each enemy in the staging area", layout: { phase: "Planning", threat: [30, 30], staging: ["51038", "f3", "f0"] }, act: announce("endOfRound"), expect: [threat(32)] },
  { line: "51038:A:2", name: "Travel: the enemy of highest Attack in the staging area attacks the first player", layout: { staging: ["51038", "f3", "51024"], deck: F0 }, act: [resolve("51038", "travel"), endPhase], expect: [damageOn("dh1", 2)] },
  // 51039 Restless Hunters.
  { line: "51039:A:1", name: "When Revealed: each engaged enemy returns to the staging area", layout: { engaged: ["f3"], deck: F0 }, act: reveal("51039"), expect: [zone("f3", "staging")] },
  { line: "51039:A:1", name: "with none engaged it gains surge", layout: { deck: F0 }, act: reveal("51039"), expect: [count("f0", "staging", 1)] },
  { line: "51039:A:2", name: "Shadow: a destroyed character sends the attacker back to the staging area", layout: { engaged: ["51015"], play: ["ally"], deck: F0 }, act: [attack("51015", { shadow: "51039" }), defend("ally")], expect: [zone("51015", "staging")] },
  // 51040 Dol Guldur Orcs.
  { line: "51040:A:1", name: "When Revealed: each player deals 1 damage to a character he controls", layout: { deck: F0 }, act: reveal("51040"), expect: [damageOn("dh1", 1)] },
  { line: "51040:A:2", name: "Shadow: the defender gets -1 Defense for each damage on it, for this attack only", layout: { engaged: ["f3"], play: [{ code: "ally", damage: 1 }], deck: F0 }, act: [attack("f3", { shadow: "51040" }), defend("ally")], expect: [zone("ally", "discard")] },
  // 51041 The Shadow Road.
  { line: "51041:A:2", name: "Travel: each player deals 1 damage to a character", layout: { staging: ["51041"] }, act: resolve("51041", "travel"), expect: [damageOn("dh1", 1)] },
  // 51042 The Necromancer's Reach.
  { line: "51042:A:1", name: "When Revealed: 1 damage to each exhausted character", layout: { staging: ["51016"], deck: F0 }, act: [resolve("51016", "travel"), reveal("51042")], expect: [damageOn("dh1", 1)] },
  { line: "51042:A:2", name: "Shadow: +1 Attack", layout: { engaged: ["f3"], deck: F0 }, act: attack("f3", { shadow: "51042", undefended: true }), expect: [damageOn("dh1", 2)] },
  { line: "51042:A:2", name: "+2 Attack when the defender is damaged", layout: { engaged: ["f3"], play: [{ code: "ally", damage: 1 }], deck: F0 }, act: [attack("f3", { shadow: "51042" }), defend("ally")], expect: [zone("ally", "discard")] },
  // 51043 Ravenous Spider.
  { line: "51043:A:1", name: "Forced: after it destroys a character the defending player exhausts a character", layout: { engaged: ["51043"], play: ["ally"], deck: F0 }, act: [attack("51043"), defend("ally")], expect: [exhausted("dh1")] },
  { line: "51043:A:2", name: "Shadow: with a destroyed character, exhaust a character you control", layout: { engaged: ["51015"], play: ["ally"], deck: F0 }, act: [attack("51015", { shadow: "51043" }), defend("ally")], expect: [exhausted("dh1")] },
  // 51044 Forest Gate.
  { line: "51044:A:1", name: "+1 Threat for each enemy in the staging area", layout: { staging: ["51044", "f3", "f0"] }, act: [], expect: [stat("51044", "threat", 3)] },
  { line: "51044:A:2", name: "Shadow: +1 Attack for each enemy engaged with you (the other engaged enemy attacks too, for 1)", layout: { engaged: ["f3", "f0"], deck: F0 }, act: attack("f3", { shadow: "51044", undefended: true }), expect: [damageOn("dh1", 4)] },
  // 51045 Nightfall.
  { line: "51045:A:2", name: "When Revealed: it attaches to the first player's threat dial", layout: { deck: F0 }, act: reveal("51045"), expect: [count("51045", "play", 1)] },
  { line: "51045:A:2", name: "Forced: during the refresh phase its player raises threat by 1 more", layout: { threat: [30, 30], play: ["51045"] }, act: endRound, expect: [threat(32)] },
  // 51046 Venomous Spider.
  { line: "51046:A:1", name: "Forced: the character it damages cannot ready until the end of the round", layout: { engaged: ["51046"], deck: F0 }, act: [attack("51046"), defend("dh1")], expect: [flag("dh1", "cannotReady")] },
  { line: "51046:A:2", name: "Shadow: the defending character cannot ready until the end of the round", layout: { engaged: ["f3"], deck: F0 }, act: [attack("f3", { shadow: "51046" }), defend("dh1")], expect: [flag("dh1", "cannotReady")] },
  // 51047 Pitch-dark Thicket.
  { line: "51047:A:1", name: "enemies in the staging area cannot take damage", layout: { staging: ["51047", "f3"] }, act: [], expect: [flag("f3", "cannotTakeDamage")] },
  // 51048 Fastness of Mirkwood.
  { line: "51048:A:1", name: "When Revealed: a different 0 cost location for each player joins the staging area", layout: { seats: 2, deck: ["51013", "51016", "51022", "f0"] }, act: reveal("51048"), expect: [zone("51013", "staging"), zone("51016", "staging")] },
  { line: "51048:A:2", name: "Shadow: a destroyed character sends the active location back to the staging area", layout: { active: "51044", engaged: ["51015"], play: ["ally"], deck: F0 }, act: [attack("51015", { shadow: "51048" }), defend("ally")], expect: [zone("51044", "staging")] },
  // 51049 Dark Bats.
  { line: "51049:A:1", name: "Forced: after it damages a character the top card of the encounter deck is revealed and it is discarded", layout: { engaged: ["51049"], deck: F0 }, act: [attack("51049"), defend("dh1")], expect: [zone("51049", "encounterDiscard"), count("f0", "staging", 1)] },
  { line: "51049:A:2", name: "Shadow: +1 Attack and an additional shadow card", layout: { engaged: ["f3"], deck: F0 }, act: attack("f3", { shadow: "51049", undefended: true }), expect: [damageOn("dh1", 2), deckCount(5)] },
  // 51050 Forest Stream.
  { line: "51050:A:1", name: "Forced: at the end of the round it removes 2 progress from the main quest", layout: { staging: ["51050"], progress: 3 }, act: endRound, expect: [progressOn("51001", 1)] },
  { line: "51050:A:2", name: "Travel: each player raises threat by 2", layout: { threat: [30, 30], staging: ["51050"] }, act: resolve("51050", "travel"), expect: [threat(32)] },
  // 51051 Treacherous Fog.
  { line: "51051:A:1", name: "When Revealed: each enemy and location in the staging area gets +2 Threat until the end of the phase", layout: { staging: ["f3", "place"], deck: F0 }, act: reveal("51051"), expect: [stat("f3", "threat", 5), stat("place", "threat", 4)] },
  { line: "51051:A:2", name: "Shadow: each enemy engaged with you gets +1 Attack and +1 Defense until the end of the phase", layout: { engaged: ["f3"], deck: F0 }, act: attack("f3", { shadow: "51051", undefended: true }), expect: [damageOn("dh1", 2)] },
  // 51052 Howling Warg.
  { line: "51052:A:1", name: "When Revealed: the top card is discarded and a Warg so discarded is revealed", layout: { deck: ["51037", "f0"] }, act: reveal("51052"), expect: [zone("51037", "staging")] },
  { line: "51052:A:2", name: "Shadow: +1 Attack, +2 for a Warg attacker", layout: { engaged: ["51037"], deck: F0 }, act: attack("51037", { shadow: "51052", undefended: true }), expect: [damageOn("dh1", 5)] },
  // 51053 The Wargs' Glade.
  { line: "51053:A:1", name: "while in the staging area the first Warg enemy revealed each round gains surge", layout: { staging: ["51053"], deck: ["f0", "f0", "f0"] }, act: reveal("51037"), expect: [count("f0", "staging", 1)] },
  { line: "51053:A:2", name: "Forced: when it is explored a non-unique Warg enemy joins the staging area", layout: { staging: ["51053"], deck: ["f0", "51024"] }, act: announce("locationExplored", "51053"), expect: [zone("51024", "staging")] },
  { line: "51053:A:2", name: "explored as the active location it adds one Warg", layout: { active: "51053", deck: ["51024", "51024", "f0"] }, act: announce("activeExplored", "51053"), expect: [count("51024", "staging", 1)] },
  // 51054 Weighed Down.
  { line: "51054:A:1", name: "When Revealed: each character with an attachment is exhausted", layout: { attached: [{ code: "attachment", to: "dh1" }], deck: F0 }, act: reveal("51054"), expect: [exhausted("dh1")] },
  { line: "51054:A:1", name: "with none exhausted it gains surge", layout: { deck: F0 }, act: reveal("51054"), expect: [count("f0", "staging", 1)] },
  { line: "51054:A:2", name: "Shadow: an attachment of the defending character is discarded", layout: { engaged: ["f3"], attached: [{ code: "attachment", to: "dh1" }], deck: F0 }, act: [attack("f3", { shadow: "51054" }), defend("dh1")], expect: [count("attachment", "discard", 1)] },
];

cardSpecs("the-wizards-quest", ROWS);
