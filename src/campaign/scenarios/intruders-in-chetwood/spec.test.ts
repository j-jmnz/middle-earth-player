// Rules: mec108.side-quests, mec108.side-quests-in-play, mec108.time-x, mec108.objective-allies, mec108.setup-intruders-in-chetwood, mec108.campaign-setup-intruders-in-chetwood, faq.enemy-attacks-outside-combat, faq.additional-attacks, rr.forced, rr.response, rr.reveal, rr.shadow-effects, rr.travel, rr.cancel, rr.first-player (data/rules/entries.json).
import { describe, it } from "vitest";

import { announce, answer, attack, attackersOf, cardSpecs, damageOn, defend, endPhase, exhausted, flag, handCount, heldBy, lost, notWon, progressOn, quest, resolve, resourcesOn, respond, reveal, stat, threat, travel, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for Intruders in Chetwood (angmar-awakened part 1): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Finish). What a row cannot express (a controller, a tally across rounds, a card held under another)
// is a test titled with its line id in lines.test.ts. The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points; every seat starts at threat 28; the main quest card is the one quest card in play until a side quest is staged.
const IARION = "09016";
const ORC_WAR_PARTY = "09017";
const FOREST = "09018";
const BORDERS = "09019";
const HOMESTEAD = "09020";
const SUDDEN = "09021";
const SPEED = "09022";
const REARGUARD = "09023";
const RESCUE = "09024";
const ANGMAR_ORC = "09043";
const MARAUDER = "09044";
const AMBUSH = "09046";
const RUGGED = "09047";
const HILLS = "09048";
const PRESSING = "09049";
const WEIGHT = "09050";
const WILDERNESS = "09051";
const STAGE = "09068";
const PENDANT = "10157";
const PROTECT = "10158";

const ROWS: readonly Row[] = [
  { line: "09016:A:1", name: "Willpower, Attack and Defense are X, the quest cards in play: 2 with a side quest staged", layout: { play: [IARION], staging: [REARGUARD] }, act: [], expect: [stat(IARION, "willpower", 2), stat(IARION, "attack", 2), stat(IARION, "defense", 2)] },
  { line: "09016:A:1", name: "and 1 with the main quest card alone", layout: { play: [IARION] }, act: [], expect: stat(IARION, "willpower", 1) },
  { line: "09016:A:1", name: "a side quest in the victory display is no quest card in play", layout: { play: [IARION], victory: [REARGUARD] }, act: [], expect: stat(IARION, "willpower", 1) },

  { line: "09017:A:2", name: "in the staging area the enemies there cannot take damage, and an engaged enemy can", layout: { staging: [ORC_WAR_PARTY, "f3"], engaged: [{ code: "mild", seat: 0 }] }, act: [], expect: [flag("f3", "cannotTakeDamage"), flag("mild", "cannotTakeDamage", false)] },
  { line: "09017:A:3", name: "the players cannot win the game while one is in play: a full stage 1 is not defeated", layout: { stage: STAGE, progress: 29, play: [IARION], staging: [ORC_WAR_PARTY] }, act: quest("success"), expect: [progressOn(STAGE, 30), notWon] },

  { line: "09018:A:1", name: "Travel: the first player engages an enemy in the staging area", layout: { phase: "Travel", staging: [FOREST, "f3"] }, act: travel(FOREST), expect: [zone("f3", "engaged"), zone(FOREST, "activeLocation")] },
  { line: "09018:A:2", name: "Shadow: the defending player exhausts a hero he controls", layout: {}, act: [attack("f3", { shadow: FOREST, undefended: true }), answer("exhaust")], expect: [exhausted("dh1"), zone("f3", "engaged")] },
  { line: "09018:A:2", name: "or the attacking enemy returns to the staging area after the attack", layout: {}, act: [attack("f3", { shadow: FOREST, undefended: true }), answer("staging")], expect: [zone("f3", "staging"), exhausted("dh1", false)] },

  { line: "09019:A:1", name: "Forced at the beginning of the quest phase: one enemy engaged with a player returns to the staging area", layout: { staging: [BORDERS], engaged: [{ code: "f3", seat: 0 }, { code: "f0", seat: 0 }] }, act: [announce("beginningOfPhase"), answer("f0")], expect: [zone("f0", "staging"), zone("f3", "engaged")] },
  { line: "09019:A:1", name: "the enemy engaged with the other player is one too", layout: { seats: 2, staging: [BORDERS], engaged: [{ code: "f3", seat: 1 }] }, act: announce("beginningOfPhase"), expect: zone("f3", "staging") },
  { line: "09019:A:2", name: "Shadow: -1 Defense for each quest card in play (2 with a side quest staged)", layout: { staging: [REARGUARD] }, act: attack(MARAUDER, { shadow: BORDERS }), expect: damageOn("dh1", 3) },

  { line: "09020:A:3", name: "Travel: the first player reveals an encounter card", layout: { phase: "Travel", staging: [HOMESTEAD], deck: ["f0"] }, act: travel(HOMESTEAD), expect: zone("f0", "staging") },

  { line: "09021:A:1", name: "When Revealed: the committed Willpower above the Threat in the staging area, each enemy there attacks the first player, and no Orc War Party is added", layout: { staging: ["f3"], committed: ["dh1", "dh2"], deck: [ORC_WAR_PARTY] }, act: [reveal(SUDDEN), endPhase], expect: [attackersOf("dh1", ["f3"]), zone("f3", "staging"), zone(ORC_WAR_PARTY, "encounterDeck")] },
  { line: "09021:A:1", name: "the Orc War Party it finds later does not attack: the attacks are over before the search", layout: { staging: ["f3"], committed: ["dh1", "dh2"], deck: [ORC_WAR_PARTY] }, act: [reveal(SUDDEN), endPhase], expect: attackersOf("dh1", ["f3"]) },
  { line: "09021:A:1", name: "with no enemy in the staging area no attack is made, and an Orc War Party is added to it", layout: { committed: ["dh1", "dh2"], deck: ["f0", ORC_WAR_PARTY] }, act: reveal(SUDDEN), expect: [zone(ORC_WAR_PARTY, "staging"), attackersOf("dh1", [])] },
  { line: "09021:A:1", name: "with too little Willpower no attack is made, and the Orc War Party is added to the staging area", layout: { staging: ["f3", "f3"], committed: ["dh1"], deck: [ORC_WAR_PARTY] }, act: reveal(SUDDEN), expect: [zone(ORC_WAR_PARTY, "staging"), attackersOf("dh1", [])] },

  { line: "09022:A:1", name: "When Revealed: each player returns an enemy engaged with them to the staging area", layout: { engaged: [{ code: "f3", seat: 0 }], deck: ["f0"] }, act: reveal(SPEED), expect: [zone("f3", "staging"), threat(28)] },
  { line: "09022:A:1", name: "and with none returned it gains surge and doomed 1", layout: { deck: ["f0"] }, act: reveal(SPEED), expect: [zone("f0", "staging"), threat(29)] },

  { line: "09023:A:1", name: "in the staging area no more than 3 progress can be placed on the current quest each round", layout: { stage: STAGE, staging: [REARGUARD] }, act: quest("success"), expect: progressOn(STAGE, 3) },
  { line: "09023:A:2", name: "while it is the current quest, the Forced effect at the end of the staging step reveals a card", layout: { staging: [REARGUARD, PRESSING], deck: ["f0"] }, act: [resolve(PRESSING, "whenRevealed"), announce("stagingStepEnds")], expect: zone("f0", "staging") },

  { line: "09024:A:1", name: "Time 4: four time counters on it when it is revealed", layout: { play: [IARION] }, act: reveal(RESCUE), expect: resourcesOn(RESCUE, 4) },
  { line: "09024:A:2", name: "When Revealed: Iârion lies facedown under it, in play", layout: { play: [IARION] }, act: reveal(RESCUE), expect: [heldBy(IARION, RESCUE), exhausted(IARION, false)] },
  { line: "09024:A:3", name: "Forced after the last time counter is removed: Iârion is discarded and the players lose the game", layout: { play: [IARION] }, act: [reveal(RESCUE), announce("lastTimeCounterRemoved", RESCUE)], expect: lost },

  { line: "09043:A:1", name: "When Revealed: the first player discards an ally from play", layout: { play: ["ally"], deck: ["f0"] }, act: [reveal(ANGMAR_ORC), answer("ally")], expect: [zone("ally", "discard"), zone("f0", "encounterDeck")] },
  { line: "09043:A:1", name: "or an additional encounter card is revealed", layout: { play: ["ally"], deck: ["f0"] }, act: [reveal(ANGMAR_ORC), answer("reveal")], expect: [zone("ally", "play"), zone("f0", "staging")] },
  { line: "09043:A:2", name: "Shadow: +1 Attack", layout: {}, act: attack("f3", { shadow: ANGMAR_ORC, undefended: true }), expect: damageOn("dh1", 2) },
  { line: "09043:A:2", name: "and if this attack destroys an ally the enemy returns to the staging area after it", layout: { play: ["ally"] }, act: [attack(ANGMAR_ORC, { shadow: ANGMAR_ORC }), defend("ally")], expect: [zone("ally", "discard"), zone(ANGMAR_ORC, "staging")] },

  { line: "09044:A:1", name: "Forced: after it attacks and destroys an ally it returns to the staging area", layout: { play: ["ally"] }, act: [attack(MARAUDER), defend("ally")], expect: [zone("ally", "discard"), zone(MARAUDER, "staging")] },
  { line: "09044:A:2", name: "Shadow: +1 Attack for each ally the defending player controls", layout: { play: ["ally"] }, act: attack("f3", { shadow: MARAUDER, undefended: true }), expect: damageOn("dh1", 2) },


  { line: "09046:A:1", name: "in the staging area each Orc enemy in play gets +1 Threat, Attack and Defense", layout: { staging: [AMBUSH, ANGMAR_ORC, "f3"] }, act: [], expect: [stat(ANGMAR_ORC, "threat", 3), stat(ANGMAR_ORC, "attack", 3), stat(ANGMAR_ORC, "defense", 4), stat("f3", "threat", 3)] },
  { line: "09046:A:2", name: "When Revealed: each player in turn puts an Orc enemy from the deck into play engaged with them", layout: { seats: 2, deck: ["f0", ANGMAR_ORC, MARAUDER] }, act: reveal(AMBUSH), expect: [zone(ANGMAR_ORC, "engaged"), zone(MARAUDER, "engaged"), zone("f0", "encounterDeck")] },
  { line: "09046:A:2", name: "an Orc enemy in the discard pile is found too", layout: { discard: [ANGMAR_ORC] }, act: reveal(AMBUSH), expect: zone(ANGMAR_ORC, "engaged") },

  { line: "09047:A:1", name: "+2 Threat while the current quest is a side quest", layout: { staging: [REARGUARD, RUGGED, PRESSING] }, act: resolve(PRESSING, "whenRevealed"), expect: stat(RUGGED, "threat", 4) },
  { line: "09047:A:2", name: "Shadow: +1 Attack for each quest card in play (2 with a side quest staged)", layout: { staging: [REARGUARD] }, act: attack("f3", { shadow: RUGGED, undefended: true }), expect: damageOn("dh1", 3) },

  { line: "09048:A:1", name: "Threat X, the number of quest cards in play", layout: { staging: [HILLS, REARGUARD] }, act: [], expect: stat(HILLS, "threat", 2) },
  { line: "09048:A:2", name: "with only 1 quest card in play it gains surge", layout: { deck: ["f0"] }, act: reveal(HILLS), expect: zone("f0", "staging") },

  { line: "09049:A:2", name: "When Revealed: the first player searches the encounter deck and discard pile for an encounter side quest and reveals it", layout: { discard: [REARGUARD], deck: ["f0"] }, act: reveal(PRESSING), expect: [zone(REARGUARD, "staging"), zone("f0", "encounterDeck")] },
  { line: "09049:A:2", name: "or chooses a different quest card in play to be the current quest until the end of the phase", layout: { staging: [REARGUARD] }, act: reveal(PRESSING), expect: flag(REARGUARD, "currentQuest") },

  { line: "09050:A:1", name: "When Revealed: reveal 1 encounter card for each quest card in play (2 with a side quest staged)", layout: { staging: [REARGUARD], deck: ["f0", "f3", "place"] }, act: reveal(WEIGHT), expect: [zone("f0", "staging"), zone("f3", "staging"), zone("place", "encounterDeck")] },
  { line: "09050:A:2", name: "Shadow: the defending player discards 1 attachment he controls for each quest card in play, all of them with fewer", layout: { staging: [REARGUARD], attached: [{ code: "attachment", to: "dh1" }] }, act: attack("f3", { shadow: WEIGHT, undefended: true }), expect: zone("attachment", "discard") },
  { line: "09050:A:2", name: "with 1 quest card in play he discards just one, of his choice", layout: { attached: [{ code: "attachment", to: "dh1" }, { code: PENDANT, to: "dh1" }] }, act: [attack("f3", { shadow: WEIGHT, undefended: true }), answer(PENDANT)], expect: [zone(PENDANT, "discard"), zone("attachment", "play")] },

  { line: "09051:A:1", name: "When Revealed: each player in turn places their hand facedown under it", layout: { seats: 2, hand: ["filler", "filler"] }, act: reveal(WILDERNESS), expect: [handCount(0, 0), handCount(0, 1)] },
  { line: "09051:A:2", name: "Forced when it is defeated: each card under it returns to its owner's hand", layout: { seats: 2, hand: ["filler", "filler"] }, act: [reveal(WILDERNESS), announce("questDefeated", WILDERNESS)], expect: [handCount(2, 0), handCount(2, 1)] },

  { line: "09068:A:1", name: "Setup: Iârion is put into play under the first player and each player adds a location with a different title from the encounter deck", layout: { seats: 2, setAside: [IARION], deck: ["f0", BORDERS, BORDERS, FOREST, HOMESTEAD] }, act: resolve(STAGE, "setup"), expect: [zone(IARION, "play"), zone(BORDERS, "staging"), zone(FOREST, "staging"), zone(HOMESTEAD, "encounterDeck"), zone("f0", "encounterDeck")] },
  { line: "09068:B:3", name: "the players cannot defeat the stage unless the first player controls Iârion", layout: { stage: STAGE, progress: 28 }, act: quest("success"), expect: [progressOn(STAGE, 32), notWon] },

  { line: "10156:A:2", name: "Setup: Iârion's Pendant is attached to Iârion and Protect the Innocent is added to the staging area", layout: { campaign: true, play: [IARION] }, act: [resolve("10156", "campaignSetup"), answer("keep")], expect: [stat(IARION, "willpower", 3), zone(PROTECT, "staging"), damageOn(PROTECT, 0)] },
  { line: "10156:A:2", name: "each player may place 4 damage on it to add 1 resource to each of their heroes", layout: { campaign: true, play: [IARION], seats: 2 }, act: [resolve("10156", "campaignSetup"), answer("trade"), answer("keep")], expect: [damageOn(PROTECT, 4), resourcesOn("dh1", 1), resourcesOn("dh2", 1), resourcesOn("dh3", 0)] },

  { line: "10157:A:1", name: "Attached character gets +1 Willpower", layout: { play: [IARION], attached: [{ code: PENDANT, to: IARION }] }, act: [], expect: stat(IARION, "willpower", 2) },
  { line: "10157:A:2", name: "Response: adding it to the victory display cancels the When Revealed effects of a card just revealed from the encounter deck", layout: { play: [IARION], attached: [{ code: PENDANT, to: IARION }], deck: [ANGMAR_ORC, "f0"], heroResources: 0 }, act: [reveal(ANGMAR_ORC), respond(PENDANT)], expect: [zone(PENDANT, "victory"), zone("f0", "encounterDeck")] },

  { line: "10158:A:1", name: "Forced after an attack damages a character: place 1 damage on it", layout: { staging: [PROTECT] }, act: attack(MARAUDER, { undefended: true }), expect: damageOn(PROTECT, 1) },
  { line: "10158:A:3", name: "the players lose the game when it holds 10 damage", layout: { staging: [{ code: PROTECT, damage: 9 }] }, act: attack(MARAUDER, { undefended: true }), expect: lost },
];

if (ROWS.length > 0) cardSpecs("intruders-in-chetwood", ROWS);
else describe("intruders-in-chetwood card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
