// Rules: rr.forced, rr.active-location, rr.travel, rr.reveal, rr.shadow-effects, rr.damage, rr.blank, rr.cannot, rr.step-6-4-3, rr.explored (data/rules/entries.json).
import { describe, it } from "vitest";

import { announce, answer, attack, cardSpecs, damageOn, deckCount, flag, progressOn, resolve, resourcesOn, reveal, revealedBy, stat, threat, travel, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Hills of Emyn Muil (shadows-of-mirkwood part 4): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests). What a row cannot say (a play that is not offered, a card that is not reached,
// a game over several steps) is a test in lines.test.ts titled with the line id.
const ROWS: readonly Row[] = [
  { line: "02083:A:1", name: "Amon Hen's Threat is twice the number of players", layout: { seats: 2, staging: ["02083"] }, act: announce("enteredPlay", "02083"), expect: [stat("02083", "threat", 4)] },
  { line: "02084:A:1", name: "Amon Lhaw's Threat is twice the number of players", layout: { seats: 2, staging: ["02084"] }, act: announce("enteredPlay", "02084"), expect: [stat("02084", "threat", 4)] },
  { line: "02084:A:2", name: "while Amon Lhaw is active every attachment is blank, Traits included", layout: { active: "02084", attached: [{ code: "attachment", to: "dh1" }] }, act: resolve("02084", "constant"), expect: [flag("attachment", "blankText"), flag("attachment", "blanksTraits")] },
  { line: "02086:A:1", name: "Forced: after traveling to The North Stair the top card of the encounter discard pile moves to the staging area", layout: { phase: "Travel", staging: ["02086"], discard: ["f0"] }, act: travel("02086"), expect: [zone("f0", "staging"), zone("02086", "activeLocation")] },
  { line: "02087:A:1", name: "while Rauros Falls is active every character must commit to the quest", layout: { seats: 2, active: "02087", phase: "Quest" }, act: resolve("02087", "constant"), expect: [flag("dh1", "mustCommit"), flag("dh2", "mustCommit")] },
  { line: "02087:A:2", name: "Shadow: after the attack the attacking enemy returns to the staging area", layout: {}, act: attack("f3", { shadow: "02087", undefended: true }), expect: [zone("f3", "staging"), damageOn("dh1", 1)] },
  { line: "02088:A:2", name: "Shadow: after the attack the attacking enemy returns to the staging area", layout: {}, act: attack("f3", { shadow: "02088", undefended: true }), expect: [zone("f3", "staging")] },
  { line: "02089:A:1", name: "while The Outer Ridge is active each location in the staging area gets +1 Threat", layout: { active: "02089", staging: ["place"] }, act: announce("enteredPlay", "place"), expect: [stat("place", "threat", 3)] },
  { line: "02089:A:2", name: "Shadow: after the attack the attacking enemy returns to the staging area", layout: {}, act: attack("f3", { shadow: "02089", undefended: true }), expect: [zone("f3", "staging")] },
  { line: "02090:A:1", name: "Travel: the first player reveals the top card of the encounter deck and adds it to the staging area", layout: { phase: "Travel", staging: ["02090"], deck: ["f0", "f0"] }, act: travel("02090"), expect: [zone("f0", "staging"), zone("02090", "activeLocation")] },
  { line: "02091:A:1", name: "When Revealed: the active location returns to the staging area", layout: { active: "place", deck: ["f0"] }, act: reveal("02091"), expect: [zone("place", "staging"), zone("f0", "encounterDeck")] },
  { line: "02091:A:1", name: "When Revealed: with no active location the card gains surge", layout: { phase: "Quest", staging: ["place"], deck: ["f0"] }, act: reveal("02091"), expect: [zone("f0", "staging")] },
  { line: "02092:A:1", name: "When Revealed: 2 damage to each character committed to the quest", layout: { seats: 2, committed: ["dh1"], deck: ["f0"] }, act: reveal("02092"), expect: [damageOn("dh1", 2), damageOn("dh2", 0)] },
  { line: "02092:A:2", name: "Shadow: the defender is removed from combat and takes no damage; the attack is undefended", layout: {}, act: attack("f3", { shadow: "02092" }), expect: [damageOn("dh1", 1)] },
  { line: "02094:A:2", name: "Orc Horse Thieves get +1 Attack for each location in the staging area", layout: { engaged: ["02094"], staging: ["place", "place"] }, act: announce("enteredPlay", "02094"), expect: [stat("02094", "attack", 3)] },
  { line: "900702:A:1", name: "Forced: after the players travel Tunneling Nameless Thing engages the first player", layout: { phase: "Travel", staging: ["place", "900702"] }, act: travel("place"), expect: [zone("900702", "engaged")] },
  { line: "900703:A:1", name: "Orc Interceptor gets +1 Threat and +1 Attack for each resource token on it", layout: { staging: [{ code: "900703", resources: 2 }] }, act: announce("enteredPlay", "900703"), expect: [stat("900703", "threat", 4), stat("900703", "attack", 4)] },
  { line: "900703:A:2", name: "Forced: after a location is explored Orc Interceptor takes a resource token", layout: { active: "place", staging: ["900703"] }, act: announce("locationExplored", "place"), expect: [resourcesOn("900703", 1)] },
  { line: "900704:A:1", name: "Forced: after a character commits to the quest it takes 1 damage", layout: { phase: "Quest", staging: ["900704"] }, act: announce("committed", "dh1"), expect: [damageOn("dh1", 1), damageOn("dh2", 0)] },
  { line: "900706:A:1", name: "When Revealed: a player raises his threat by 5", layout: { phase: "Planning", deck: ["f0"] }, act: [reveal("900706"), answer("threat")], expect: [threat(33)] },
  { line: "900706:A:1", name: "When Revealed: or reveals an additional encounter card", layout: { phase: "Planning", deck: ["f0"] }, act: [reveal("900706"), answer("reveal")], expect: [revealedBy("f0", 0)] },
  { line: "900708:A:3", name: "Shadow: another shadow card is dealt for the attack even when no Hazard card was shuffled back", layout: {}, act: attack("f3", { shadow: "900708", undefended: true }), expect: [deckCount(2)] },
  { line: "900706:A:2", name: "Shadow: +X Attack, X the Threat of the active location", layout: { active: "place" }, act: attack("f3", { shadow: "900706", undefended: true }), expect: [damageOn("dh1", 3)] },

  // 900707:A:3 "Shadow: Remove all progress from each Emyn Muil location in play." The active location and one in the staging area (both Emyn Muil) lose all their progress; Enchanted Stream (a Forest) keeps its own.
  { line: "900707:A:3", name: "Shadow: each Emyn Muil location in play, active or in the staging area, loses all its progress", layout: { active: { code: "02085", progress: 1 }, staging: [{ code: "02086", progress: 2 }, { code: "01095", progress: 1 }] }, act: attack("f0", { shadow: "900707" }), expect: [progressOn("02085", 0), progressOn("02086", 0), progressOn("01095", 1)] },
];

if (ROWS.length > 0) cardSpecs("the-hills-of-emyn-muil", ROWS);
else describe("the-hills-of-emyn-muil card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
