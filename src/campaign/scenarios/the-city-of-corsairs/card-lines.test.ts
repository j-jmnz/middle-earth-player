// Rules: dcce.heading, rr.in-play-and-out-of-play, rr.travel, rr.search, rr.shadow-effects, rr.forced, rr.then, rr.immune, rr.attachment-cards, rr.engaged, rr.step-6-2 (data/rules/entries.json).
import { describe, it } from "vitest";

import { cardSpecs, flag, reveal, resourcesOn, stat, travel, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The City of Corsairs (Dream-chaser part 9): one row for each printed line a single action can show, on a table of plain-number heroes (dh1 and dh2: 2 Willpower, 2 Attack, 2 Defense, 6 hit
// points) and the stand-ins f0 and f3 (1 Attack, 1 Defense, 3 hit points). The Raiders are Umbar Raider 11064 (3 Attack, 2 Defense), Corsair Infiltrator 11065 (3 Defense) and Raid Leader 11066, all Corsair Raiders.
// `cardSpecs` runs each row again without the records of its line, where it must fail. The lines that need a seat, a heading, damage placed, the resource phase or a false case are in card-lines-scenes.test.ts.
const ROWS: readonly Row[] = [
  // 12151 Stormcaller A:2 and 12152 Slave Ship A:2: "Cannot have attachments."
  { line: "12151:A:2", name: "the Stormcaller cannot have attachments", layout: { staging: ["12151"] }, act: [], expect: flag("12151", "cannotHaveAttachments") },
  { line: "12152:A:2", name: "the Slave Ship cannot have attachments", layout: { staging: ["12152"] }, act: [], expect: flag("12152", "cannotHaveAttachments") },

  // 12153 Umbar Slaver A:1: "Umbar Slaver gets +1 Attack and +1 Threat for each resource on it." It prints 2 Attack and 2 Threat.
  { line: "12153:A:1", name: "2 resources on it give +2 Attack and +2 Threat", layout: { staging: [{ code: "12153", resources: 2 }] }, act: [], expect: [stat("12153", "attack", 4), stat("12153", "threat", 4)] },

  // 12161 City of Corsairs A:2: "Travel: Search the encounter deck and discard pile for a Corsair enemy and add it to the staging area. Shuffle the encounter deck."
  { line: "12161:A:2", name: "a Corsair enemy is found under a non-Corsair enemy in the encounter deck and added to the staging area", layout: { phase: "Travel", staging: ["12161"], deck: ["f3", "11064"] }, act: travel("12161"), expect: [zone("12161", "activeLocation"), zone("11064", "staging"), zone("f3", "encounterDeck")] },
  { line: "12161:A:2", name: "a Corsair enemy is found in the discard pile", layout: { phase: "Travel", staging: ["12161"], deck: ["f3"], discard: ["11065"] }, act: travel("12161"), expect: [zone("11065", "staging"), zone("f3", "encounterDeck")] },

  // 12162 Umbar Harbor A:1: "While Umbar Harbor is the active location, Corsair enemies get +2 Defense." Its false case (in the staging area) is in card-lines-scenes.test.ts.
  { line: "12162:A:1", name: "a Corsair enemy in the staging area and one engaged get +2 Defense, a non-Corsair enemy does not", layout: { active: "12162", staging: ["11064", "f0"], engaged: ["11065"] }, act: [], expect: [stat("11064", "defense", 4), stat("11065", "defense", 5), stat("f0", "defense", 1)] },

  // 12156 Watch Tower A:1: "While Watch Tower is in the staging area, it gains: 'Forced: When a Raider enemy enters play, add 1 resource to it.'"
  { line: "12156:A:1", name: "a Raider revealed into the staging area gets 1 resource", layout: { staging: ["12156"], deck: ["f0"] }, act: reveal("11064"), expect: resourcesOn("11064", 1) },
  { line: "12156:A:1", name: "a Raider that enters play engaged from the Corsair deck gets 1 resource", layout: { phase: "Travel", staging: ["12156", "12154"], piles: { corsairDeck: ["11065"] } }, act: travel("12154"), expect: [zone("11065", "engaged"), resourcesOn("11065", 1)] },

  // 110129 The Shattered Monument A:1: "Each Raider enemy with at least 1 resource on it is immune to player events."
  { line: "110129:A:1", name: "a Raider with a resource, in the staging area or engaged, is immune to player events; one with none is not", layout: { staging: ["110129", { code: "11064", resources: 1 }, "11065"], engaged: [{ code: "11066", seat: 0, resources: 2 }] }, act: [], expect: [flag("11064", "immuneToPlayerEvents"), flag("11066", "immuneToPlayerEvents"), flag("11065", "immuneToPlayerEvents", false)] },

  // 12158 Captain Sahír A:1: "Captain Sahír engages the first player." The seat it engages is in card-lines-scenes.test.ts.
  { line: "12158:A:1", name: "revealed, he engages the first player at once", layout: { deck: ["f0"], threat: [10, 0] }, act: reveal("12158"), expect: zone("12158", "engaged") },
];

if (ROWS.length > 0) cardSpecs("the-city-of-corsairs", ROWS);
else describe("the-city-of-corsairs card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
