// Rules: mec112.defense, rr.active-location, rr.lasting-effects, rr.forced, rr.reveal, rr.shadow-effects, rr.explored, rr.first-player, faq.additional-attacks (data/rules/entries.json).
import { describe, it } from "vitest";

import { announce, answer, attack, attackersOf, cardSpecs, defend, damageOn, endPhase, exhausted, handCount, lost, progressOn, quest, resolve, resourcesOn, reveal, revealedBy, stagingThreat, stat, threat, won, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for Helm's Deep (the-two-towers part 2): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/handover/agent-brief.md, Scenario procedure). A row cannot ask who revealed a card
// when the first player is not the first seat, hold a negative case (it would pass without its records), look at the archery total, a sphere or a trait: those lines are the tests of verbs.test.ts in this folder,
// whose titles start with the line id (143021:A:1, 143037:A:1, 143040:A:2, 143043:A:1 for the Traits, 143072:A:1 and 143072:B:1 to B:2, 143076:B:1, and the negative cases and the first player of 143041:A:1, 143042:A:3,
// 143073:B:1, 143073:B:2 and 143074:B:2). The fortress family's own tests are src/rules/families/fortress/index.test.ts. scripts/checks/spec-coverage.test.ts fails a line with neither a row nor a titled test.
const END_OF_PHASE = (phase: "Quest" | "Combat") => announce("endOfPhase", undefined, { seat: null, phase });
const END_OF_ROUND = announce("endOfRound", undefined, { seat: null, phase: "End of round" });
const STAGE_2 = { stage: "143073" } as const;

export const ROWS: readonly Row[] = [
  // 143021 Poisoned Counsels.
  { line: "143021:A:2", name: "after it is drawn, every other card in the hand is discarded", layout: { hand: ["filler", "filler", "143021"] }, act: announce("enteredHand", "143021"), expect: handCount(1) },

  // 143033 The Defense of Helm's Deep.
  { line: "143033:A:1", name: "each resource token adds 1 to the total Threat in the staging area", layout: { staging: [{ code: "143033", resources: 3 }, "f3"] }, act: [], expect: stagingThreat(6) },
  { line: "143033:A:2", name: "the end of the quest phase places 1 resource token", layout: { ...STAGE_2, staging: ["143033"] }, act: END_OF_PHASE("Quest"), expect: resourcesOn("143033", 1) },
  { line: "143033:A:3", name: "with 8 tokens it joins the victory display and the players advance to stage 5A", layout: { ...STAGE_2, staging: [{ code: "143033", resources: 7 }] }, act: END_OF_PHASE("Quest"), expect: [zone("143033", "victory"), zone("143076", "questStage")] },
  { line: "143033:A:3", name: "from any stage: stage 3A advances to 5A too", layout: { stage: "143074", staging: [{ code: "143033", resources: 7 }] }, act: END_OF_PHASE("Quest"), expect: zone("143076", "questStage") },

  // 143034 Wild Hillman, 143035 Warrior of Dunland, 143036 Soldier of Isengard.
  { line: "143034:A:1", name: "after it attacks, 1 progress goes on the active location", layout: { ...STAGE_2, active: "143038" }, act: attack("143034", { undefended: true }), expect: progressOn("143038", 1) },
  { line: "143034:A:2", name: "Shadow: 1 progress on the active location, and +1 Attack for each progress there", layout: { ...STAGE_2, active: "143038" }, act: attack("f3", { shadow: "143034", undefended: true }), expect: [progressOn("143038", 1), damageOn("dh1", 2)] },
  { line: "143035:A:2", name: "When Revealed: it makes an immediate attack against the revealing player", layout: { stage: "143073" }, act: [reveal("143035"), endPhase], expect: damageOn("dh1", 5) },
  { line: "143035:A:3", name: "after it attacks and destroys a character, 3 progress go on the active location (3 quest points: it is explored)", layout: { ...STAGE_2, active: "143037", play: ["ally"] }, act: [attack("143035"), defend("ally")], expect: zone("143037", "encounterDiscard") },
  { line: "143036:A:2", name: "after it destroys a character, 1 progress goes on the current quest through the active location", layout: { ...STAGE_2, active: "143037", play: ["ally"] }, act: [attack("143036"), defend("ally")], expect: progressOn("143037", 1) },
  { line: "143036:A:2", name: "with no active location the progress goes on the stage", layout: { ...STAGE_2, play: ["ally"] }, act: [attack("143036"), defend("ally")], expect: progressOn("143073", 1) },
  { line: "143036:A:3", name: "Shadow: a character the defending player controls is exhausted", layout: { ...STAGE_2 }, act: attack("f3", { shadow: "143036", undefended: true }), expect: exhausted("dh1") },

  // 143037 to 143041 the locations.
  { line: "143037:A:2", name: "explored: the first player assigns as much damage as there are enemies in play", layout: { staging: ["143037", "f0", "f3"] }, act: announce("leftPlay", "143037", { explored: true }), expect: damageOn("dh1", 2) },
  { line: "143038:A:1", name: "while it is the active location each hero gets +1 Defense", layout: { active: "143038" }, act: [], expect: stat("dh1", "defense", 3) },
  { line: "143038:A:2", name: "explored: each player raises their threat by 4", layout: { staging: ["143038"], seats: 2 }, act: announce("leftPlay", "143038", { explored: true }), expect: [threat(32, 0), threat(32, 1)] },
  { line: "143039:A:1", name: "its Threat is 1 with no ally", layout: { staging: ["143039"] }, act: [], expect: stat("143039", "threat", 1) },
  { line: "143039:A:1", name: "its Threat is 1 more than the allies the first player controls", layout: { staging: ["143039"], play: ["ally", "ally"] }, act: [], expect: stat("143039", "threat", 3) },
  { line: "143039:A:2", name: "explored: each player searches for an enemy and adds it to the staging area", layout: { staging: ["143039"], seats: 2, deck: ["f0", "place", "f3"] }, act: announce("leftPlay", "143039", { explored: true }), expect: [zone("f0", "staging"), zone("f3", "staging")] },
  { line: "143040:A:1", name: "while it is the active location each hero gets +1 Attack", layout: { active: "143040" }, act: [], expect: stat("dh1", "attack", 3) },
  { line: "143041:A:1", name: "while it is the active location the first player reveals a card at the end of the staging step when a player is unengaged", layout: { active: "143041", deck: ["f3"] }, act: announce("stagingStepEnds", undefined, { seat: null }), expect: zone("f3", "staging") },
  { line: "143041:A:1", name: "the card is revealed by the first player, whoever is the first seat", layout: { seats: 2, firstPlayer: 1, active: "143041", deck: ["f3"] }, act: announce("stagingStepEnds", undefined, { seat: null }), expect: revealedBy("f3", 1) },
  { line: "143041:A:2", name: "explored: each enemy gets +2 Attack until the end of the round", layout: { staging: ["143041", "f3"] }, act: announce("leftPlay", "143041", { explored: true }), expect: stat("f3", "attack", 3) },
  { line: "143041:A:2", name: "explored: each enemy gets -20 engagement cost, one that enters later too", layout: { staging: ["143041"] }, act: [announce("leftPlay", "143041", { explored: true }), reveal("f3")], expect: stat("f3", "engagementCost", 30) },

  // 143042 to 143045 the treacheries.
  { line: "143042:A:2", name: "When Revealed: it attaches to the active location, and each enemy gets +1 Threat", layout: { active: "143038", staging: ["f3"], deck: ["f0"] }, act: reveal("143042"), expect: [stat("f3", "threat", 4), zone("143042", "attached")] },
  { line: "143042:A:3", name: "Shadow: +1 Attack, and when the attack destroys a character 1 progress goes on the current quest", layout: { ...STAGE_2, active: "143038", play: [{ code: "ally", damage: 1 }] }, act: [attack("f3", { shadow: "143042" }), defend("ally")], expect: progressOn("143038", 1) },
  { line: "143043:A:1", name: "When Revealed: 3 progress go on the main quest, bypassing the active location", layout: { ...STAGE_2, active: "143038" }, act: reveal("143043"), expect: [progressOn("143073", 3), progressOn("143038", 0)] },
  { line: "143043:A:2", name: "Shadow: the attacking enemy gets +2 Attack until the end of the round", layout: STAGE_2, act: attack("f3", { shadow: "143043", undefended: true }), expect: [stat("f3", "attack", 3), damageOn("dh1", 3)] },
  { line: "143044:A:2", name: "When Revealed: the staged enemy with the highest Attack attacks the revealing player", layout: { staging: ["143034", "143036"] }, act: [reveal("143044"), endPhase], expect: damageOn("dh1", 4) },
  { line: "143044:A:2", name: "with no enemy staged it gains surge: the next card is revealed", layout: { deck: ["f3"] }, act: reveal("143044"), expect: zone("f3", "staging") },
  { line: "143044:A:3", name: "Shadow: the attacking enemy makes an additional attack", layout: STAGE_2, act: attack("f3", { shadow: "143044", undefended: true }), expect: attackersOf("dh1", ["f3", "f3"]) },
  { line: "143045:A:2", name: "the first option removes a token from The Defense of Helm's Deep", layout: { staging: [{ code: "143033", resources: 3 }] }, act: [reveal("143045"), answer("remove")], expect: resourcesOn("143033", 2) },
  { line: "143045:A:2", name: "the second option reveals 2 additional encounter cards", layout: { staging: [{ code: "143033", resources: 3 }], deck: ["f0", "f3", "place"] }, act: [reveal("143045"), answer("reveal")], expect: [zone("f0", "staging"), zone("f3", "staging"), resourcesOn("143033", 3)] },
  { line: "143045:A:2", name: "with no token to remove nothing is asked: 2 additional cards are revealed", layout: { deck: ["f0", "f3", "place"] }, act: reveal("143045"), expect: [zone("f0", "staging"), zone("f3", "staging")] },

  // 143072 to 143076 the quest.
  { line: "143072:A:1", name: "the second option advances to stage 2A, bypassing stage 1B", layout: { campaign: true }, act: [resolve("143072", "setup"), answer("bypass")], expect: zone("143073", "questStage") },
  { line: "143072:B:3", name: "the end of the round advances to stage 2A", act: END_OF_ROUND, expect: zone("143073", "questStage") },
  { line: "143073:A:1", name: "When Revealed: The Defense of Helm's Deep and each set aside Soldier of Isengard join the staging area, and Deeping Wall becomes the active location", layout: { ...STAGE_2, setAside: ["143033", "143038", "143036", "143036"] }, act: resolve("143073", "whenRevealed"), expect: [zone("143033", "staging"), zone("143036", "staging"), zone("143038", "activeLocation")] },
  { line: "143073:A:1", name: "each player reveals 1 encounter card", layout: { ...STAGE_2, seats: 2, setAside: ["143038"], deck: ["f0", "f3", "place"] }, act: resolve("143073", "whenRevealed"), expect: [zone("f0", "staging"), zone("f3", "staging"), zone("place", "encounterDeck")] },
  { line: "143073:B:1", name: "Defense: the Threat that beats the Willpower becomes progress through the active location, not the players' threat", layout: { ...STAGE_2, active: "143038", staging: ["f3", "f3"] }, act: quest("fail"), expect: [progressOn("143038", 2), threat(28)] },
  { line: "143073:B:1", name: "Defense: with no active location the progress goes on the stage", layout: { ...STAGE_2, staging: ["f3", "f3"] }, act: quest("fail"), expect: [progressOn("143073", 2), threat(28)] },
  { line: "143073:B:2", name: "at the end of the combat phase the first player reveals a card when fewer enemies are staged than there are players", layout: { ...STAGE_2, deck: ["f3"] }, act: END_OF_PHASE("Combat"), expect: zone("f3", "staging") },
  { line: "143073:B:2", name: "the card is revealed by the first player, whoever is the first seat", layout: { ...STAGE_2, seats: 2, firstPlayer: 1, staging: ["f0"], deck: ["f3"] }, act: announce("endOfPhase", undefined, { seat: null, phase: "Combat" }), expect: revealedBy("f3", 1) },
  { line: "143073:B:3", name: "at the end of the round each staged enemy places 1 progress on the stage, bypassing the active location", layout: { ...STAGE_2, active: "143038", staging: ["f0", "f3"] }, act: END_OF_ROUND, expect: [progressOn("143073", 2), progressOn("143038", 0)] },
  { line: "143074:A:1", name: "When Revealed: Helm's Gate is found in the encounter deck and becomes the active location, the previous one back to staging", layout: { stage: "143074", active: "143038", deck: ["143041"] }, act: resolve("143074", "whenRevealed"), expect: [zone("143041", "activeLocation"), zone("143038", "staging")] },
  { line: "143074:A:1", name: "found in the encounter discard pile", layout: { stage: "143074", discard: ["143041"] }, act: resolve("143074", "whenRevealed"), expect: zone("143041", "activeLocation") },
  { line: "143074:A:1", name: "found in the victory display", layout: { stage: "143074", victory: ["143041"] }, act: resolve("143074", "whenRevealed"), expect: zone("143041", "activeLocation") },
  { line: "143074:A:1", name: "a Helm's Gate already in the staging area becomes the active location", layout: { stage: "143074", staging: ["143041"], active: "143038" }, act: resolve("143074", "whenRevealed"), expect: [zone("143041", "activeLocation"), zone("143038", "staging")] },
  { line: "143074:B:1", name: "Defense: the Threat that beats the Willpower becomes progress through the active location", layout: { stage: "143074", active: "143038", staging: ["f3", "f3"] }, act: quest("fail"), expect: [progressOn("143038", 2), threat(28)] },
  { line: "143074:B:2", name: "after the quest resolves with no progress on the stage, the first player reveals 1 encounter card", layout: { stage: "143074", deck: ["f0", "f3"] }, act: quest("success"), expect: zone("f3", "staging") },
  { line: "143074:B:2", name: "the card is revealed by the first player", layout: { stage: "143074", seats: 2, firstPlayer: 1, deck: ["f3"] }, act: announce("defenseQuestResolved", "143074", { seat: null }), expect: revealedBy("f3", 1) },
  { line: "143075:A:1", name: "When Revealed: cards are discarded from the shuffled deck until as many enemies as there are players join the staging area", layout: { stage: "143075", deck: ["place", "f3"] }, act: resolve("143075", "whenRevealed"), expect: zone("f3", "staging") },
  { line: "143075:A:1", name: "each player's enemy: 2 players, 2 enemies", layout: { stage: "143075", seats: 2, deck: ["f0", "f3", "place"] }, act: resolve("143075", "whenRevealed"), expect: [zone("f0", "staging"), zone("f3", "staging")] },
  { line: "143075:B:1", name: "Defense: the Threat that beats the Willpower becomes progress through the active location", layout: { stage: "143075", active: "143038", staging: ["f3", "f3"] }, act: quest("fail"), expect: [progressOn("143038", 2), threat(28)] },
  { line: "143075:B:2", name: "each destroyed character places 1 progress on the stage, bypassing the active location (Wild Hillman's own 1 goes on the location)", layout: { stage: "143075", active: "143038", play: ["ally"] }, act: [attack("143034"), defend("ally")], expect: [progressOn("143075", 1), progressOn("143038", 1)] },
  { line: "143075:B:3", name: "the stage defeated loses the game", layout: { stage: "143075", progress: 7, play: ["ally"] }, act: [attack("143034"), defend("ally")], expect: lost },
  { line: "143076:A:1", name: "When Revealed: enemies are discarded from the shuffled deck, one for each player, and join the staging area", layout: { stage: "143076", deck: ["place", "f3"] }, act: resolve("143076", "whenRevealed"), expect: zone("f3", "staging") },
  { line: "143076:B:2", name: "the players win once no enemy is in play", layout: { stage: "143076" }, act: END_OF_ROUND, expect: won },
];

if (ROWS.length > 0) cardSpecs("helms-deep", ROWS);
else describe("helms-deep card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
