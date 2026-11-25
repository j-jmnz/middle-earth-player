// Rules: hob.riddle-area, hob.riddles, rr.forced, rr.shadow-effects, rr.travel, rr.engaged, rr.damage, rr.search, rr.cannot (data/rules/entries.json); docs/scenarios/the-hobbit/dungeons-deep-and-caverns-dim.md (Dungeons Deep and Caverns Dim).
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";

import { answer, attack, cardSpecs, classFlag, damageOn, defend, endPhase, offers, progressOn, reveal, resolve, rowProblems, stat, withoutLine, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for Dungeons Deep and Caverns Dim (the-hobbit part 3): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Finish). The riddle area and the answering of a riddle need a table with
// Bilbo Baggins and the area its Setup makes, which a layout cannot place: they are the line specs of lines.test.ts (the riddles family's fixture).
const ID = "dungeons-deep-and-caverns-dim";
const WARGS = "131076";
const WOLF = "131075";
const GLADE = "131077";
const RUNNERS = "131060";
const LAKE = "131078";
const FILLERS = ["f0", "f0", "f0", "f0", "f0"];

const ROWS: readonly Row[] = [
  { line: "131076:A:1", name: "Wild Wargs is dealt a shadow card with a riddle and gets +2 Attack for the attack: 5 damage on an undefended hero", layout: { engaged: [WARGS], deck: FILLERS }, act: attack(WARGS, { shadow: GLADE, undefended: true }), expect: [damageOn("dh1", 5)] },
  { line: "131077:A:1", name: "after a character takes damage from an attack made by an engaged Creature enemy, 1 progress comes off the current quest", layout: { staging: [GLADE], engaged: [WARGS], progress: 3, deck: FILLERS }, act: attack(WARGS, { undefended: true }), expect: [progressOn("131029", 2)] },
  // The damage that destroys the defender is still damage the attack dealt: the Forced effect is heard after it (rr.damage), the character no longer in play.
  { line: "131077:A:1", name: "a defender the Creature's damage destroys is still a character that took damage from its attack: 1 progress comes off the quest", layout: { staging: [GLADE], engaged: [WARGS], play: ["ally"], progress: 3, deck: FILLERS }, act: [attack(WARGS), defend("ally")], expect: [zone("ally", "discard"), progressOn("131029", 2)] },
  { line: "131078:A:1", name: "its Threat is twice the number of players", layout: { seats: 2, staging: [LAKE] }, act: [], expect: [stat(LAKE, "threat", 4)] },
  { line: "131078:A:2", name: "the players cannot travel to it: no travel is offered with it alone in the staging area", layout: { phase: "Travel", staging: [LAKE] }, act: [], expect: [offers("Travel", undefined, false)] },
  { line: "131082:A:1", name: "When Revealed: characters get -1 Willpower and cannot attack until the end of the round", layout: { deck: FILLERS }, act: [reveal("131082"), answer("resolve")], expect: [stat("dh1", "willpower", 1), classFlag("dh1", "cannotAttack")] },
  { line: "131080:A:1", name: "When Revealed: the first player puts a Creature enemy from the encounter deck into play engaged with him", layout: { deck: ["131076", "f0", "f0"] }, act: [resolve("131080", "whenRevealed")], expect: [zone(WARGS, "engaged")] },
  { line: "131075:A:1", name: "the Creature enemies return to the staging area at the end of the combat phase when its shadow card has a riddle", layout: { engaged: [WOLF, WARGS], deck: FILLERS }, act: [attack(WOLF, { shadow: GLADE, undefended: true }), endPhase], expect: [zone(WARGS, "staging")] },
];

// 131077:A:1 names a Creature enemy: the same undefended attack takes 1 progress off stage 1 when a Creature makes it and none when a Goblin does. A row of the second kind alone would pass with no record, so one test holds both
// and fails without the line's records (the first half).
describe("The Wargs' Glade hears Creature attackers only", () => {
  const glade = (enemy: string): Row => ({ line: "131077:A:1", layout: { staging: [GLADE], engaged: [enemy], progress: 3, deck: FILLERS }, act: attack(enemy, { undefended: true }), expect: [progressOn("131029", enemy === RUNNERS ? 3 : 2)] });
  const both = (effects: typeof EFFECTS): string[] => [...rowProblems(ID, glade(WARGS), effects), ...rowProblems(ID, glade(RUNNERS), effects)];
  it("131077:A:1 takes 1 progress off the current quest after a Creature's attack and none after a Goblin's", () => {
    expect(both(EFFECTS)).toEqual([]);
    expect(both(withoutLine(EFFECTS, "131077:A:1")).length).toBeGreaterThan(0);
  });
});

if (ROWS.length > 0) cardSpecs(ID, ROWS);
else describe("dungeons-deep-and-caverns-dim card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
