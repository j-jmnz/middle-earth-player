// Rules: hrd.track, hrd.track-example, hrd.search-objective, hrd.setup-beneath-the-sands, rr.forced, rr.shadow-effects, rr.travel, rr.cancel, rr.then, rr.explored, rr.step-3-4 (data/rules/entries.json).
import { describe, it } from "vitest";

import { announce, answer, attack, cardSpecs, count, damageOn, deckCount, exhausted, flag, progressOn, quest, resolve, reveal, revealedBy, stat, won, zone, notWon, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for Beneath the Sands (haradrim part 6): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests). The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points; f0 is a 1 Attack enemy. What a row cannot
// say (the Setup, Lost Underground's reveal and Response, the gates of 17079:A:1, the flips) is in track-lines.test.ts and src/rules/families/haradrim/track.test.ts, titled with the line id.
const OFF = "17079";
const ON = "17080";
const BROOD_MOTHER = "17065";
const STAGE_1 = "17076";
const STAGE_3 = "17078";

const ROWS: readonly Row[] = [
  // 17065 Brood Mother.
  { line: "17065:A:1", name: "Cannot have attachments. Cannot take damage.", layout: { staging: [BROOD_MOTHER] }, act: [], expect: [flag(BROOD_MOTHER, "cannotHaveAttachments"), flag(BROOD_MOTHER, "cannotTakeDamage")] },
  { line: "17065:A:2", name: "Brood Mother engages the first player when she is added to the staging area", layout: { staging: [BROOD_MOTHER] }, act: announce("addedToStaging", BROOD_MOTHER), expect: zone(BROOD_MOTHER, "engaged") },
  { line: "17065:A:3", name: "At the end of the round a Spider Broodling is found in the deck and added to the staging area", layout: { staging: [BROOD_MOTHER], deck: ["f0", "17067"] }, act: announce("endOfRound"), expect: [zone("17067", "staging"), deckCount(1)] },
  { line: "17065:A:3", name: "At the end of the round a Spider Broodling in the discard pile is added to the staging area", layout: { staging: [BROOD_MOTHER], deck: ["f0"], discard: ["17067"] }, act: announce("endOfRound"), expect: [zone("17067", "staging"), deckCount(1)] },

  // 17066 Hive Guardian.
  { line: "17066:A:1", name: "While On Track is in play it gets +2 Attack and -5 engagement cost", layout: { staging: ["17066", ON] }, act: [], expect: [stat("17066", "attack", 5), stat("17066", "engagementCost", 35)] },
  { line: "17066:A:2", name: "Shadow: the attacker gets +1 Attack, Off Track in play", layout: { staging: [OFF] }, act: attack("f0", { shadow: "17066", undefended: true }), expect: damageOn("dh1", 2) },
  { line: "17066:A:2", name: "Shadow: the attacker gets +2 Attack instead while On Track is in play", layout: { staging: [ON] }, act: attack("f0", { shadow: "17066", undefended: true }), expect: damageOn("dh1", 3) },

  // 17067 Spider Broodling.
  { line: "17067:A:1", name: "While On Track is in play it gains surge", layout: { staging: ["17067", ON] }, act: [], expect: stat("17067", "gainsSurge", 1) },
  { line: "17067:A:2", name: "Shadow: with On Track in play it goes into play engaged with you", layout: { staging: [ON], deck: ["f0", "f0", "f0"] }, act: attack("f0", { shadow: "17067", undefended: true }), expect: zone("17067", "engaged") },

  // 17068 Spider Burrow.
  { line: "17068:A:2", name: "After it becomes the active location the objective flips to On Track and Brood Mother is added to the staging area", layout: { staging: ["17068", OFF], setAside: [BROOD_MOTHER] }, act: announce("becameActive", "17068"), expect: [count(ON, "staging", 1), count(OFF, "staging", 0), zone(BROOD_MOTHER, "engaged")] },

  // 17069 Pitch Black Tunnel.
  { line: "17069:A:2", name: "X, its Threat, is the number of characters the first player controls", layout: { staging: ["17069"], play: ["ally"] }, act: [], expect: stat("17069", "threat", 3) },

  // 17070 Nest of Vermin.
  { line: "17070:A:1", name: "Track 3: three cards are discarded and a marked card flips Off Track to On Track", layout: { staging: ["17070", OFF], deck: ["f0", "f0", "17066", "f3"] }, act: announce("traveled", "17070"), expect: [count(ON, "staging", 1), deckCount(1)] },
  { line: "17070:A:1", name: "Track 3: no marked card among the three leaves Off Track", layout: { staging: ["17070", OFF], deck: ["f0", "f0", "f3", "17066"] }, act: announce("traveled", "17070"), expect: [count(OFF, "staging", 1), deckCount(1)] },
  { line: "17070:A:2", name: "Travel: the discard pile is shuffled in and cards are discarded until a Creature enemy is discarded and added to the staging area", layout: { staging: ["17070"], deck: ["f0"], discard: ["17067"] }, act: resolve("17070", "travel"), expect: [zone("17067", "staging") ] },

  // 17071 Cobwebbed Cavern.
  { line: "17071:A:1", name: "Track 2: a marked card among the two flips Off Track to On Track", layout: { staging: ["17071", OFF], deck: ["f0", "17067", "f3"] }, act: announce("traveled", "17071"), expect: [count(ON, "staging", 1), deckCount(1)] },
  { line: "17071:A:2", name: "While On Track is in play it gets +2 Threat", layout: { staging: ["17071", ON] }, act: [], expect: stat("17071", "threat", 4) },
  { line: "17071:A:3", name: "Shadow: the defending player exhausts a ready character", layout: {}, act: attack("f0", { shadow: "17071", undefended: true }), expect: exhausted("dh1") },

  // 17072 Blocked Passage.
  { line: "17072:A:1", name: "Track 2: a marked card among the two flips Off Track to On Track", layout: { staging: ["17072", OFF], deck: ["17072", "f0", "f3"] }, act: announce("traveled", "17072"), expect: [count(ON, "staging", 1), deckCount(1)] },
  { line: "17072:A:2", name: "While On Track is in play no progress is placed on locations in the staging area", layout: { staging: ["17072", ON, "place"] }, act: [], expect: flag("place", "noProgressPlaced") },
  { line: "17072:A:3", name: "Shadow: the defending player discards an attachment he controls", layout: { play: ["attachment"], attached: [{ code: "attachment", to: "dh1" }] }, act: attack("f0", { shadow: "17072", undefended: true }), expect: zone("attachment", "discard") },

  // 17073 Forced Off Track.
  { line: "17073:A:1", name: "When Revealed: the first player flips the objective to Off Track", layout: { staging: [ON] }, act: [reveal("17073"), answer("flip")], expect: [count(OFF, "staging", 1), damageOn("dh1", 0)] },
  { line: "17073:A:1", name: "When Revealed: or each questing character takes 1 damage", layout: { staging: [ON], committed: ["dh1"] }, act: [reveal("17073"), answer("damage")], expect: [damageOn("dh1", 1), count(ON, "staging", 1)] },
  { line: "17073:A:2", name: "Shadow: with On Track in play the attacker attacks again after this attack", layout: { staging: [ON] }, act: attack("f0", { shadow: "17073", undefended: true }), expect: damageOn("dh1", 2) },

  // 17074 Grabbed by Spiders.
  { line: "17074:A:2", name: "When Revealed: it attaches to the main quest, and a second copy stays unattached", layout: { stage: STAGE_1, side: "B", staging: [OFF] }, act: [reveal("17074"), reveal("17074")], expect: count("17074", "attached", 1) },
  { line: "17074:A:2", name: "After the objective flips to Off Track each player discards an ally, then discards Grabbed by Spiders", layout: { stage: STAGE_1, side: "B", staging: [OFF], play: ["ally"], attached: [{ code: "17074", to: STAGE_1, encounter: true }] }, act: announce("searchFlippedOff", OFF), expect: [zone("ally", "discard"), zone("17074", "encounterDiscard")] },
  { line: "17074:A:2", name: "One player short of an ally keeps it attached, the other still discards his", layout: { seats: 2, stage: STAGE_1, side: "B", staging: [OFF], play: ["ally"], attached: [{ code: "17074", to: STAGE_1, encounter: true }] }, act: announce("searchFlippedOff", OFF), expect: [zone("ally", "discard"), zone("17074", "attached")] },

  // 17076 Searching the Caves (the Setup is in track-lines.test.ts).
  { line: "17076:B:1", name: "When Revealed: cards are discarded until X locations are discarded and each is added to the staging area", layout: { stage: STAGE_1, side: "B", deck: ["f0", "place", "f3"] }, act: resolve(STAGE_1, "whenRevealed"), expect: [zone("f0", "encounterDiscard"), zone("place", "staging"), deckCount(1)] },

  // 17077 Getting Closer.
  { line: "17077:A:1", name: "When Revealed: the objective flips to Off Track and the discard pile is shuffled in and an enemy discarded is added to the staging area", layout: { stage: "17077", side: "A", staging: [ON], discard: ["f3"], deck: [] }, act: resolve("17077", "whenRevealed"), expect: [count(OFF, "staging", 1), zone("f3", "staging"), deckCount(0)] },
  { line: "17077:B:1", name: "While On Track is in play encounter card effects cannot be canceled", layout: { stage: "17077", side: "B", staging: [ON] }, act: [], expect: flag("table", "encounterUncancelable") },

  // 17078 The Spiders' Hive.
  { line: "17078:A:1", name: "When Revealed: Brood Mother is added, each other player reveals a card and the objective flips to Off Track", layout: { seats: 2, stage: STAGE_3, side: "A", staging: [ON], setAside: [BROOD_MOTHER], deck: ["f0"] }, act: resolve(STAGE_3, "whenRevealed"), expect: [zone(BROOD_MOTHER, "engaged"), revealedBy("f0", 1), count(OFF, "staging", 1)] },
  { line: "17078:B:1", name: "With 5 progress on the stage Brood Mother loses 'Cannot take damage.'", layout: { stage: STAGE_3, side: "B", progress: 5, staging: [BROOD_MOTHER] }, act: [], expect: flag(BROOD_MOTHER, "losesNoDamage") },
  { line: "17078:B:2", name: "After the objective flips to Off Track all progress is removed from the stage", layout: { stage: STAGE_3, side: "B", progress: 4, staging: [OFF] }, act: announce("searchFlippedOff", OFF), expect: progressOn(STAGE_3, 0) },
  { line: "17078:B:3", name: "The stage cannot be defeated while Brood Mother is in play", layout: { stage: STAGE_3, side: "B", progress: 4, engaged: [BROOD_MOTHER], staging: [ON], deck: ["17066", "f0", "f0", "17067", "f0", "f0"] }, act: quest("success"), expect: [notWon, progressOn(STAGE_3, 5)] },
  { line: "17078:B:3", name: "Defeating the stage wins the game", layout: { stage: STAGE_3, side: "B" }, act: resolve(STAGE_3, "questResolution"), expect: won },

  // 17079 Off Track.
  { line: "17079:A:2", name: "Progress cannot be placed on the main quest while it is in play", layout: { stage: STAGE_1, side: "B", staging: [OFF] }, act: quest("success"), expect: progressOn(STAGE_1, 0) },

  // 17080 On Track.
  { line: "17080:A:2", name: "After the players quest unsuccessfully it flips to Off Track", layout: { stage: STAGE_1, side: "B", staging: [ON, "f3", "f3", "f3", "f3"], deck: ["17066", "f0", "f0", "17067", "f0", "f0"] }, act: quest("fail"), expect: [count(OFF, "staging", 1), count(ON, "staging", 0)] },
];

if (ROWS.length > 0) cardSpecs("beneath-the-sands", ROWS);
else describe("beneath-the-sands card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
