// Rules: rr.search, rr.reveal, rr.forced, rr.travel, rr.explored, rr.shadow-effects, rr.staging-area, rr.damage, rr.surge (data/rules/entries.json); docs/brief.md (The Mines of Moria).
import { announce, cardSpecs, committed, count, damageOn, flag, handCount, resolve, resourcesOn, stagingThreat, stat, threat, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Mines of Moria (standalone-scenarios part 12): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Finish).
// The layout numbers the stages in the order of the data (51201, 51203, 51204, ...): 51203 stands for stage 2 and 51204 for stage 3.
const ROWS: readonly Row[] = [
  // The cards the Build task checked on a table; the Finish task adds the rows of the other lines.
  { line: "51219:A:2", name: "Forced: when Spider Burrow is explored the opposing team finds a Spider enemy of cost 1 or less", layout: { stage: "51203", staging: ["51219"], deck: ["51213", "51218", "f0"] }, act: announce("locationExplored", "51219"), expect: [zone("51218", "staging")] },
  { line: "51240:A:2", name: "Forced: when Stairs of Náin is explored each player raises his threat by 4", layout: { stage: "51203", staging: ["51240"], threat: [30, 30] }, act: announce("locationExplored", "51240"), expect: [threat(34)] },
  { line: "51226:A:1", name: "the active location returns to the staging area and each player assigns damage equal to its Threat", layout: { stage: "51203", active: "51216" }, act: resolve("51226", "whenRevealed"), expect: [zone("51216", "staging"), damageOn("dh1", 3)] },
  { line: "51223:A:1", name: "attached to the non-unique enemy with the highest Attack: +1 Attack and +1 Threat", layout: { stage: "51203", staging: ["51215", "51212"] }, act: resolve("51223", "whenRevealed"), expect: [stat("51212", "attack", 6), stat("51212", "threat", 4)] },
  { line: "51235:A:1", name: "each hero's resources are discarded and the staging area adds 1 Threat for each", layout: { stage: "51203", heroResources: 2 }, act: resolve("51235", "whenRevealed"), expect: [resourcesOn("dh1", 0), stagingThreat(4)] },
  { line: "51238:A:1", name: "each player discards 1 random card and the staging area adds its printed cost as Threat", layout: { stage: "51203", hand: ["c1", "c1"] }, act: resolve("51238", "whenRevealed"), expect: [handCount(1), stagingThreat(1)] },
  { line: "51222:A:3", name: "Travel: assign damage equal to its Threat, 2 and 1 for each resource on it", layout: { stage: "51203", staging: [{ code: "51222", resources: 2 }] }, act: resolve("51222", "travel"), expect: [damageOn("dh1", 4)] },
  { line: "51220:A:1", name: "a committed character is removed from the quest for each Spider enemy in play", layout: { stage: "51203", staging: ["51215", "51218"], committed: ["dh1", "dh2"] }, act: resolve("51220", "whenRevealed"), expect: [committed("dh1", false)] },
  { line: "51229:A:1", name: "the opposing team discards an ally", layout: { stage: "51203", play: ["ally"] }, act: resolve("51229", "whenRevealed"), expect: [zone("ally", "discard")] },
  { line: "51247:A:1", name: "each player assigns damage equal to the characters he controls", layout: { stage: "51203", play: ["ally"] }, act: resolve("51247", "whenRevealed"), expect: [damageOn("dh1", 3)] },
  { line: "51217:A:1", name: "the staging area adds as Threat the characters of the player with the most", layout: { stage: "51203", play: ["ally", "ally"] }, act: resolve("51217", "whenRevealed"), expect: [stagingThreat(4)] },
  { line: "51232:A:1", name: "the first player's first option deals 1 damage to each committed character", layout: { stage: "51203", committed: ["dh1"] }, act: resolve("51232", "whenRevealed"), expect: [damageOn("dh1", 1)] },
  { line: "51230:A:1", name: "the first player's first option caps the progress on the quest this phase", layout: { stage: "51203" }, act: resolve("51230", "whenRevealed"), expect: [flag("table", "questProgressCap")] },
  { line: "51236:A:2", name: "Forced: at the end of the encounter phase each player raises his threat by 2 while it is in the staging area", layout: { stage: "51203", staging: ["51236"], phase: "Encounter", threat: [30, 30] }, act: announce("endOfPhase"), expect: [threat(32)] },
  { line: "51250:A:1", name: "the opposing team finds a 0 cost enemy for each player", layout: { stage: "51203", deck: ["51215", "51251", "f0"] }, act: resolve("51250", "whenRevealed"), expect: [zone("51215", "staging")] },
  { line: "51251:A:1", name: "each copy in the discard pile returns to the staging area", layout: { stage: "51203", discard: ["51251", "51251"] }, act: resolve("51251", "whenRevealed"), expect: [count("51251", "staging", 2)] },
  { line: "51249:A:1", name: "the top card is discarded and an enemy is added to the staging area", layout: { stage: "51203", deck: ["51251", "f0"] }, act: resolve("51249", "whenRevealed"), expect: [zone("51251", "staging")] },
  { line: "51248:A:1", name: "the opposing team finds a Goblin enemy of cost 1 or less among the top 5 cards", layout: { stage: "51203", deck: ["f0", "f0", "51251"] }, act: resolve("51248", "whenRevealed"), expect: [zone("51251", "staging")] },
];

if (ROWS.length > 0) cardSpecs("the-mines-of-moria", ROWS);
