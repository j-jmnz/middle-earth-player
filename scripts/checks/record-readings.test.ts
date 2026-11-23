import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { Effect } from "../../src/catalog/boundary.ts";
import { EFFECTS } from "../../src/effects/index.ts";

import { loadRenderEnv } from "../data/effects/render/scenario.ts";
import { keyOf } from "../data/printed/ledger.ts";
import { enemyZoneFindings, limitFindings, testTitles, thenFindings, type Finding, type TextOf } from "./record-readings.ts";
import { ROOT, tracked } from "./tracked.ts";

// Three readings a review keeps catching, found by their printed line (scripts/checks/record-readings.ts; docs/agents/effect-authoring.md, Readings the review catches).
// Each list below holds today's findings, read against the printed line: a record that is right stays with its reason, a fault is fixed and leaves the list. A new finding fails the
// test, and an entry that is no longer a finding is stale and goes. The third check cannot be exact (it reads titles, not what a test asserts), so it holds a count that may not grow.

// (a) A line about enemies "in play" (or naming an enemy and no zone) whose record reads only the engaged enemies.
const ENEMY_ZONE: Readonly<Record<string, string>> = {};

// (b) A "Then" after a part that can come up short, with a last instruction that holds no condition on it.
const THEN_SHORT: Readonly<Record<string, string>> = {
  "19101:forced:1": "The Loot step is one verb that does nothing with no Undead enemy found or no Loot objective in the discard pile (the step's own words).",
  "146028:forced:1": "The put into play is inside the ForEachPlayer step, which holds the condition that the picked card is an enemy.",
  "50608:forced:2": "Discarding all tokens cannot come up short: a card with none has all of them discarded, and the set aside follows (docs/scenarios/standalone-scenarios.md, reading 11).",
  "50911:forced:1": "The second step reads the title of the card the first discarded from the deck: with an empty deck no title was discarded and it matches no card.",
  "40008:forced:1": "The starting hand is drawn from a full deck, so the draw cannot come up short before the shuffle.",
  "11208:response:1": "The record's own condition holds that the card has at least 1 resource, so the move that comes before the heal always resolves.",
  "12172:forced:1": "The record's own condition holds that the card has a resource, so the removal that comes before the choice always resolves.",
  "11002:response:1": "A discard of any number may be 0, and the draw is for that many: nothing is short of 0.",
};

// (c) A "Limit" or "until the end of" line whose line id no test title names with a word for the second use or the end. A count, not a list: a title is read, not what the test asserts.
const LIMIT_TESTS_MOST = 392;

const env = loadRenderEnv();
const textOf: TextOf = (id) => {
  const [code = "", side = "", n = "0"] = id.split(":");
  return env.ledger.byKey.get(keyOf(code, side))?.lines[Number(n) - 1] ?? "";
};

const record = (over: Omit<Partial<Effect>, "instructions"> & { id: string; instructions: unknown[] }): Effect => ({ cardCode: "9", lines: [over.id.replace(/:[a-z]+:\d+$/i, ":A:1")], timing: "action", ...over }) as unknown as Effect;
const text = (line: string): TextOf => () => line;

const unlisted = (found: readonly Finding[], listed: Readonly<Record<string, string>>): string[] => found.filter((finding) => !(finding.recordId in listed)).map((finding) => `${finding.recordId}: ${finding.text}`);
const stale = (found: readonly Finding[], listed: Readonly<Record<string, string>>): string[] => Object.keys(listed).filter((id) => !found.some((finding) => finding.recordId === id));

describe("record readings: the checks find what they claim", () => {
  const pick = { type: "enemy", control: "any" };

  it("enemies in play: a pick with no zone is found, one with staging or a zone field is not, and a line that names a zone is not read", () => {
    const loose = record({ id: "9:action:1", instructions: [{ verb: "Pick", pick }] });
    expect(enemyZoneFindings([loose], text("Deal 1 damage to each enemy in play."))).toHaveLength(1);
    expect(enemyZoneFindings([loose], text("Deal 1 damage to an enemy."))).toHaveLength(1);
    expect(enemyZoneFindings([loose], text("Deal 1 damage to an enemy engaged with you."))).toHaveLength(0);
    for (const field of [{ staging: true }, { engaged: "you" }, { stagingOnly: true }, { engagedWith: "picked" }]) {
      expect(enemyZoneFindings([record({ id: "9:action:1", instructions: [{ verb: "Pick", pick: { ...pick, ...field } }] })], text("Each enemy in play gets -1 Attack."))).toHaveLength(0);
    }
    // A condition on a card the effect already holds says nothing about where it lies.
    const held = record({ id: "9:action:1", instructions: [{ verb: "Draw", when: { kind: "matches", card: "picked", pick } }] });
    expect(enemyZoneFindings([held], text("If that enemy is in play, draw 1 card."))).toHaveLength(0);
    // A count in the record's condition is read too.
    const counted = record({ id: "9:action:1", condition: { kind: "count", pick }, instructions: [] } as never);
    expect(enemyZoneFindings([counted], text("Only if an enemy is in play."))).toHaveLength(1);
  });

  it("then: a part that can come up short before a last instruction with no condition is found, one with a condition is not", () => {
    const bare = record({ id: "9:action:1", instructions: [{ verb: "Draw", amount: 1 }, { verb: "ModifyStat" }] });
    expect(thenFindings([bare], text("Draw 1 card. Then, give it +1 Willpower."))).toHaveLength(1);
    const held = record({ id: "9:action:1", instructions: [{ verb: "Draw", amount: 1 }, { verb: "ModifyStat", when: { kind: "thenResolves" } }] });
    expect(thenFindings([held], text("Draw 1 card. Then, give it +1 Willpower."))).toHaveLength(0);
    // A line with no "then", and a first part that cannot come up short, are not read.
    expect(thenFindings([bare], text("Draw 1 card and give it +1 Willpower."))).toHaveLength(0);
    const sure = record({ id: "9:action:1", instructions: [{ verb: "Ready" }, { verb: "ModifyStat" }] });
    expect(thenFindings([sure], text("Ready it. Then, give it +1 Willpower."))).toHaveLength(0);
  });

  it("limits and durations: a line is found until a title names its id with a second use or an end", () => {
    const limited = record({ id: "9:action:1", limit: "oncePerRound", instructions: [] } as never);
    const line = "9:A:1";
    expect(limitFindings([limited], text("Action: Draw 1 card. (Limit once per round.)"), [])).toHaveLength(1);
    expect(limitFindings([limited], text("Action: Draw 1 card. (Limit once per round.)"), [`${line} Limit: a second use in the round is refused`])).toHaveLength(0);
    expect(limitFindings([limited], text("Action: Draw 1 card. (Limit once per round.)"), [`${line} draws 1 card`])).toHaveLength(1);
    // A deck-building limit is not a use, and a line with neither limit nor duration is not read.
    expect(limitFindings([limited], text("Limit 3 per deck."), [])).toHaveLength(0);
    expect(limitFindings([limited], text("Draw 1 card."), [])).toHaveLength(0);
  });

  it("reads the titles of tests, the `it.each` form included", () => {
    const source = 'describe("01026:A:1 limit", () => { it("a second use is refused", () => {}); it.fails(`ends at the end of the phase`, () => {}); it.each([1])("title %s", () => {}); });';
    expect(testTitles(source)).toEqual(["01026:A:1 limit", "a second use is refused", "ends at the end of the phase", "title %s"]);
  });
});

describe("record readings: today's findings", () => {
  const found = {
    enemy: enemyZoneFindings(EFFECTS, textOf),
    then: thenFindings(EFFECTS, textOf),
  };

  it("holds no new record that reads only engaged enemies for a line about enemies in play", () => {
    expect(unlisted(found.enemy, ENEMY_ZONE), "give the pick `staging: true`, or list the record with its reason").toEqual([]);
    expect(stale(found.enemy, ENEMY_ZONE), "remove the entry").toEqual([]);
  });

  it("holds no new Then after a part that can come up short with no condition on it", () => {
    expect(unlisted(found.then, THEN_SHORT), "give the part after Then `thenResolves`, or list the record with its reason").toEqual([]);
    expect(stale(found.then, THEN_SHORT), "remove the entry").toEqual([]);
  });

  it(`holds at most ${LIMIT_TESTS_MOST} Limit and duration lines that no test title tests twice or to the end`, () => {
    const files = tracked(["src", "test"]).filter((file) => /\.(ts|tsx)$/.test(file) && (file.startsWith("test/") || /\.test\.tsx?$/.test(file)));
    const titles = files.flatMap((file) => testTitles(readFileSync(path.join(ROOT, file), "utf8")));
    const open = limitFindings(EFFECTS, textOf, titles);
    expect(open.length, "test the second use or the end of the duration, in a title that names the line id and says so (second, again, end of the phase)").toBeLessThanOrEqual(LIMIT_TESTS_MOST);
    expect(open.length, "lower the count").toBeGreaterThanOrEqual(LIMIT_TESTS_MOST - 20);
  });
});
