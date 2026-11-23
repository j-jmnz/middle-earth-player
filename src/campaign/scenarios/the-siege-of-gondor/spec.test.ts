// Rules: mec113.saga-staging-rules, mec113.peril, mec113.archery, mec113.army-of-the-dead, mec113.immune-to-player-card-effects, rr.search, rr.then, rr.effects, rr.cannot, rr.lasting-effects, rr.forced, rr.shadow-effects (data/rules/entries.json).
import { describe, it } from "vitest";

import { announce, answer, attack, attackersOf, cardSpecs, damageOn, defend, endPhase, exhausted, flag, progressOn, quest, resolve, resourcesOn, reveal, revealedBy, stagingThreat, stat, travel, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Siege of Gondor (the-return-of-the-king part 14): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Finish). What a row cannot hold (a bar seen only in what is refused,
// the Corsair Fleet's order across seats, the stage's hold while Great Corsair Ship is in play, the Port's heal cap) is in lines.test.ts, each test titled with its line. The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense
// and 6 hit points; every seat starts at threat 28. `ship` is a stand-in Ship location only where a record reads the active location's trait: the real Umbar War Galley (145031) and Corsair Dromon (145032) are Ships.
const GREAT_SHIP = "145030";
const FLEET = "145071";
const CAPTAIN = "145035";
const ARMY = "145068";
const STAGE = "145069";
const ROWS: readonly Row[] = [
  { line: "145030:A:1", name: "X, its Threat, is the resources on The Corsair Fleet, read live", layout: { staging: [GREAT_SHIP, { code: FLEET, resources: 3 }] }, act: [], expect: stat(GREAT_SHIP, "threat", 3) },
  { line: "145030:A:3", name: "Travel: the first player's search must take Corsair Captain while one is in the deck", layout: { phase: "Travel", threat: [10, 10], staging: [GREAT_SHIP], victory: ["145031", "145032", "145031"], deck: ["f0", "145036", CAPTAIN] }, act: travel(GREAT_SHIP), expect: [zone(CAPTAIN, "staging"), zone("145036", "encounterDeck")] },
  { line: "145030:A:3", name: "each later player's search is free once the Captain is taken", layout: { phase: "Travel", seats: 2, threat: [10, 10], staging: [GREAT_SHIP], victory: ["145031", "145032", "145031"], deck: ["f0", "145036", CAPTAIN, CAPTAIN] }, act: [travel(GREAT_SHIP), answer("145036")], expect: [zone("145036", "staging"), zone(CAPTAIN, "staging")] },
  { line: "145030:A:3", name: "a Corsair enemy of the discard pile is found too", layout: { phase: "Travel", threat: [10, 10], staging: [GREAT_SHIP], victory: ["145031", "145032", "145031"], discard: ["145036"] }, act: travel(GREAT_SHIP), expect: zone("145036", "staging") },

  { line: "145031:A:1", name: "while it is the active location each Corsair enemy in play gets -10 engagement cost, staged or engaged", layout: { active: "145031", staging: ["145036"], engaged: [{ code: "145038", seat: 0 }] }, act: [], expect: [stat("145036", "engagementCost", 19), stat("145038", "engagementCost", 24)] },
  { line: "145031:A:2", name: "Travel: the discard pile is shuffled in and cards are discarded until a Corsair enemy is, which joins the staging area", layout: { phase: "Travel", threat: [10, 10], staging: ["145031"], deck: ["f0", "f3", "145036", "f3"], discard: ["f0"] }, act: travel("145031"), expect: [zone("145036", "staging"), zone("145031", "activeLocation")] },

  { line: "145032:A:1", name: "while it is the active location each Corsair enemy in play gains Archery 1", layout: { active: "145032", staging: ["145036"] }, act: [], expect: stat("145036", "archery", 1) },
  { line: "145032:A:2", name: "Travel: the discard pile is shuffled in and cards are discarded until a Corsair enemy is, which joins the staging area", layout: { phase: "Travel", threat: [10, 10], staging: ["145032"], deck: ["f0", "145036", "f3"], discard: ["f3"] }, act: travel("145032"), expect: [zone("145036", "staging"), zone("145032", "activeLocation")] },

  { line: "145033:A:2", name: "Shadow: the defending character that takes damage cannot ready until the end of the round", layout: {}, act: attack("145037", { shadow: "145033" }), expect: flag("dh1", "cannotReady") },
  { line: "145033:A:2", name: "an undefended attack's hero cannot ready either", layout: {}, act: attack("f3", { shadow: "145033", undefended: true }), expect: flag("dh1", "cannotReady") },

  { line: "145034:A:1", name: "Forced at the end of the round: a damage token is placed on it", layout: { staging: ["145034"] }, act: announce("endOfRound", "145034"), expect: [damageOn("145034", 1), zone("145034", "staging")] },
  { line: "145034:A:1", name: "with 4 it is discarded and the first player assigns 4 damage among the characters in play", layout: { staging: [{ code: "145034", damage: 3 }] }, act: [announce("endOfRound", "145034")], expect: [zone("145034", "encounterDiscard"), damageOn("dh1", 4)] },
  { line: "145034:A:1", name: "the first player decides, and the 4 damage is assigned one at a time and may go on any player's character", layout: { seats: 2, firstPlayer: 1, staging: [{ code: "145034", damage: 3 }] }, act: [announce("endOfRound", "145034"), answer("dh3"), answer("dh1"), answer("dh1"), answer("dh1")], expect: [damageOn("dh3", 1), damageOn("dh1", 3)] },
  { line: "145034:A:1", name: "as the active location it does the same", layout: { active: "145034" }, act: announce("endOfRound", "145034"), expect: damageOn("145034", 1) },

  { line: "145035:A:2", name: "with a Ship as the active location it gets -30 engagement cost", layout: { active: "145032", staging: [CAPTAIN] }, act: [], expect: stat(CAPTAIN, "engagementCost", 19) },
  { line: "145035:A:2", name: "Forced: with a Ship active, when it engages you it makes an immediate attack", layout: { active: "145031", engaged: [{ code: CAPTAIN, seat: 0 }], deck: ["f0", "f0"] }, act: [announce("engaged", CAPTAIN), endPhase], expect: attackersOf("dh1", [CAPTAIN]) },

  { line: "145036:A:1", name: "+2 Attack and +2 Defense while a Ship is the active location", layout: { active: "145031", staging: ["145036"] }, act: [], expect: [stat("145036", "attack", 4), stat("145036", "defense", 3)] },

  { line: "145037:A:2", name: "Forced: when it engages you, you exhaust a character you control", layout: { engaged: [{ code: "145037", seat: 0 }] }, act: [announce("engaged", "145037"), answer("dh2")], expect: [exhausted("dh2"), exhausted("dh1", false)] },
  { line: "145037:A:3", name: "Shadow: with a Ship as the active location the attacking enemy returns to the staging area after this attack", layout: { active: "145031" }, act: attack("f3", { shadow: "145037", undefended: true }), expect: zone("f3", "staging") },

  { line: "145038:A:1", name: "Forced: when it engages you, 1 damage to a character you control", layout: { engaged: [{ code: "145038", seat: 0 }] }, act: [announce("engaged", "145038"), answer("dh1")], expect: damageOn("dh1", 1) },
  { line: "145038:A:1", name: "2 damage with a Ship as the active location", layout: { active: "145031", engaged: [{ code: "145038", seat: 0 }] }, act: [announce("engaged", "145038"), answer("dh1")], expect: damageOn("dh1", 2) },
  { line: "145038:A:2", name: "Shadow: the defending character gets -1 Defense for each damage on it for this attack", layout: { play: [{ code: "ally", damage: 1 }] }, act: [attack("f3", { shadow: "145038" }), defend("ally")], expect: zone("ally", "discard") },

  { line: "145039:A:2", name: "Peril: the revealing player returns each Corsair enemy engaged with them to the staging area", layout: { engaged: [{ code: "145038", seat: 0 }], deck: ["f0", "145036"] }, act: [reveal("145039"), answer("return")], expect: [zone("145038", "staging"), zone("145036", "encounterDeck"), revealedBy("145039", 0)] },
  { line: "145039:A:2", name: "or discards from the top of the encounter deck until a Corsair enemy is discarded and puts it into play engaged with them", layout: { engaged: [{ code: "145038", seat: 0 }], deck: ["f0", "f3", "145036", "f0"] }, act: [reveal("145039"), answer("discard")], expect: [zone("145036", "engaged"), zone("f3", "encounterDiscard"), zone("145038", "engaged")] },
  { line: "145039:A:2", name: "the discard is the only option with no Corsair enemy engaged with them", layout: { deck: ["f3", "145036", "f0"] }, act: reveal("145039"), expect: [zone("145036", "engaged"), zone("f3", "encounterDiscard")] },

  { line: "145040:A:2", name: "When Revealed: each Ship location in the staging area gets +1 Threat, and with no non-unique Ship there the revealing player searches for one", layout: { staging: [GREAT_SHIP], deck: ["f0", "145032"] }, act: reveal("145040"), expect: [zone("145032", "staging"), stat("145032", "threat", 3), stat(GREAT_SHIP, "threat", 1)] },
  { line: "145040:A:2", name: "with a non-unique Ship already in the staging area nothing is searched", layout: { staging: ["145031"], deck: ["f0", "145032"] }, act: reveal("145040"), expect: [zone("145032", "encounterDeck"), stat("145031", "threat", 4)] },

  { line: "145040:A:2", name: "a Ship location that arrives later in the phase gets the +1 Threat too (a lasting effect of an encounter card, rr.lasting-effects)", layout: { staging: ["145031"] }, act: [reveal("145040"), reveal("145032")], expect: [stat("145032", "threat", 3), stat("145031", "threat", 4)] },
  { line: "145041:A:1", name: "When Revealed: with no attachment to discard each player adds 3 to the staging area's Threat until the end of the phase (the discard is not offered)", layout: { seats: 2 }, act: reveal("145041"), expect: stagingThreat(6) },
  { line: "145041:A:1", name: "or to discard the highest cost attachment they control", layout: { attached: [{ code: "attachment", to: "dh1" }] }, act: [reveal("145041"), answer("discard")], expect: [zone("attachment", "discard"), stagingThreat(0)] },
  { line: "145041:A:2", name: "Shadow: +1 Attack; if the attack destroys a character the defending player discards an attachment they control", layout: { play: ["ally"], attached: [{ code: "attachment", to: "dh1" }] }, act: [attack("145037", { shadow: "145041" }), defend("ally")], expect: [zone("ally", "discard"), zone("attachment", "discard")] },

  { line: "145042:A:2", name: "Peril: the revealing player assigns X damage among the questing characters they control, X the resources on The Corsair Fleet", layout: { staging: [{ code: FLEET, resources: 2 }], committed: ["dh1"] }, act: [reveal("145042"), answer("damage")], expect: damageOn("dh1", 2) },
  { line: "145042:A:3", name: "Shadow: the defending player exhausts a ready character they control", layout: {}, act: [attack("f3", { shadow: "145042", undefended: true }), answer("dh2")], expect: exhausted("dh2") },

  { line: "145068:A:1", name: "Immune to player card effects", layout: { play: [ARMY] }, act: [], expect: flag(ARMY, "immuneToPlayerCards") },
  { line: "145068:A:3", name: "when it leaves play it is removed from the game, not discarded", layout: { discard: [ARMY] }, act: announce("leftPlay", ARMY), expect: zone(ARMY, "removed") },

  { line: "145069:A:1", name: "Setup: each player searches the encounter deck, not its discard pile, for a Ship location and adds it to the staging area", layout: { seats: 2, deck: ["f0", "145031", "145032", "145031"], discard: ["145034"] }, act: [resolve(STAGE, "setup"), answer("145032")], expect: [zone("145032", "staging"), zone("145031", "staging"), zone("145034", "encounterDiscard")] },
  { line: "145069:B:1", name: "each Ship location in the staging area is immune to player card effects; the active location is not", layout: { staging: ["145031", "145034"], active: "145032" }, act: [], expect: [flag("145031", "immuneToPlayerCards"), flag("145034", "immuneToPlayerCards", false), flag("145032", "immuneToPlayerCards", false)] },
  { line: "145069:B:2", name: "progress goes on past 20 while Great Corsair Ship is in play, and the stage is not defeated", layout: { progress: 19, staging: [GREAT_SHIP] }, act: quest("success"), expect: [progressOn(STAGE, 23), zone(STAGE, "questStage")] },

  { line: "145071:A:1", name: "Forced at the beginning of the staging step: it gets 1 resource, then a player who assigns X damage among their characters assigns that 1", layout: { staging: [FLEET] }, act: [announce("stagingStepBegins"), answer("damage"), answer("dh1")], expect: [resourcesOn(FLEET, 1), damageOn("dh1", 1)] },
  { line: "145071:A:1", name: "or reveals an encounter card instead", layout: { staging: [{ code: FLEET, resources: 4 }], deck: ["f3"] }, act: [announce("stagingStepBegins"), answer("reveal")], expect: [resourcesOn(FLEET, 5), zone("f3", "staging"), revealedBy("f3", 0), damageOn("dh1", 0)] },
  { line: "145071:A:1", name: "each player in turn chooses: the first reveals, the second assigns", layout: { seats: 2, staging: [FLEET], deck: ["f3"] }, act: [announce("stagingStepBegins"), answer("reveal"), answer("damage")], expect: [revealedBy("f3", 0), damageOn("dh3", 1)] },

  // 145036:A:2 "Shadow: Attacking enemy gets +1 Attack (+2 Attack instead if the active location is a Ship)." f0 (1 Attack) undefended: 2 with no active location or a City one (Port of Pelargir), 3 with Umbar War Galley (a Ship) active.
  { line: "145036:A:2", name: "Shadow: +1 Attack with no active location", layout: {}, act: attack("f0", { shadow: "145036", undefended: true }), expect: damageOn("dh1", 2) },
  { line: "145036:A:2", name: "Shadow: +1 Attack only while the active location is no Ship", layout: { active: "145033" }, act: attack("f0", { shadow: "145036", undefended: true }), expect: damageOn("dh1", 2) },
  { line: "145036:A:2", name: "Shadow: +2 Attack instead while the active location is a Ship", layout: { active: "145031" }, act: attack("f0", { shadow: "145036", undefended: true }), expect: damageOn("dh1", 3) },
];

if (ROWS.length > 0) cardSpecs("the-siege-of-gondor", ROWS);
else describe("the-siege-of-gondor card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
