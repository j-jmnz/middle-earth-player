import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { Effect } from "../../src/catalog/boundary.ts";
import { EFFECTS } from "../../src/effects/index.ts";

import { loadRenderEnv } from "../data/effects/render/scenario.ts";
import { keyOf } from "../data/printed/ledger.ts";
import { enemyZoneFindings, limitFindings, testTitles, thenFindings, type Finding, type TextOf } from "./record-readings.ts";
import { LIMIT_TESTS_OPEN } from "./record-readings-limit-open.ts";
import { ROOT, tracked } from "./tracked.ts";

// Three readings a review keeps catching, found by their printed line (scripts/checks/record-readings.ts; docs/agents/effect-authoring.md, Readings the review catches).
// Each list below holds today's findings, read against the printed line: a record that is right stays with its reason, a fault is fixed and leaves the list. A new finding fails the
// test, and an entry that is no longer a finding is stale and goes. The third check cannot be exact (it reads titles, not what a test asserts), so it holds a generated list of record ids
// (record-readings-limit-open.ts) that may only shrink.

// (a) A line about enemies "in play" (or naming an enemy and no zone) whose record reads only the engaged enemies.
const ENEMY_ZONE: Readonly<Record<string, string>> = {
  "141059:response:1": "The line says \"all engaged enemies\": the discard reads the engaged ones only.",
  "110139:action:1": "The line says \"an engaged non-unique enemy\": only an engaged enemy is a target.",
  "146026:constant:1": "The line adds the Threat of \"each engaged enemy\": the staging area's enemies are not counted.",
  "50608:forced:1": "Naurlhûg is added from the set-aside pile or returned from an engagement; one already in the staging area has nothing to do (docs/scenarios/standalone-scenarios.md, The Ruins of Belegost, reading 11).",
  "51339:forced:1": "The line says \"each engaged enemy\": a shadow card is dealt only to an enemy engaged with a player.",
  "12185:whenRevealed:1": "The enemies counted are the cards this effect discarded from the encounter deck, not cards in play.",
};

// (b) A "Then" after a part that can come up short, with a last instruction that holds no condition on it.
const THEN_SHORT: Readonly<Record<string, string>> = {
  "19101:forced:1": "The Loot step is one verb that does nothing with no Undead enemy found or no Loot objective in the discard pile (the step's own words).",
  "146028:forced:1": "The put into play is inside the ForEachPlayer step, which holds the condition that the picked card is an enemy.",
  "50608:forced:2": "Discarding all tokens cannot come up short: all of none is none, so it resolves in full and the set aside follows (docs/scenarios/standalone-scenarios.md, The Ruins of Belegost, reading 11, recommended).",
  "50911:forced:1": "The second step reads the title of the card the first discarded from the deck: with an empty deck no title was discarded and it matches no card.",
  "40008:forced:1": "The starting hand is drawn from a full deck, so the draw cannot come up short before the shuffle.",
  "11208:response:1": "The record's own condition holds that the card has at least 1 resource, so the move that comes before the heal always resolves.",
  "12172:forced:1": "The record's own condition holds that the card has a resource, so the removal that comes before the choice always resolves.",
  "11002:response:1": "A discard of any number may be 0, and the draw is for that many: nothing is short of 0.",
  "10136:whenRevealed:1": "The \"then\" only orders the two sentences: a player with an empty hand discarded no card, and the search for other copies of it finds none.",
  "00015:whenRevealed:1": "The Exhaust is the \"exhausted\" of the same sentence, done to the card just taken: it cannot come up short.",
  "50931:forced:2": "The discards belong to the Forced effect of the stage 3 the first step selected, which resolves as a whole; the part after \"Then\" holds the stage's own conditions.",
  "900106:whenRevealed:1": "The exhaust reads the ready heroes: a hero already exhausted is in the state the line asks for, so the line is resolved in full.",
  "12142:action:1": "The record's own condition holds that Súlien is ready, so the exhaust before the \"Then\" always resolves.",
  "11195:action:1": "The \"then\" adds the event to the victory display after the number of characters is set; the later \"Until the end of the round\" sentences are the Heal and the bonuses.",
  "12059:response:1": "The hero has just exhausted to defend, so the ready always resolves (a defender that stays ready is not met by any card of the game).",
  "12036:action:1": "The chosen characters are questing, so they are exhausted and the ready resolves; the threat reduction is for the number chosen.",
  "04083:action:1": "The action is not offered with no damaged character (the Warden of Healing test of src/campaign/player-cards/idle-abilities.test.ts), so the heal before the \"Then\" resolves.",
  "01135:response:1": "The record's own condition holds that Mendor is exhausted, so the ready before the \"Then\" always resolves (rr.then).",
  "12058:action:1": "The record's own condition holds that Ceorl is exhausted, so the ready before the \"Then\" always resolves (rr.then).",
  "131012:action:1": "The record's own condition holds that an exhausted character other than the host exists, so the ready always resolves.",
};

// (c) A "Limit" or "until the end of" line whose line id no test title names with a word for the second use or the end. The records of the day the check was added are the generated list
// record-readings-limit-open.ts; a new record is not on it.
const LIMIT_OPEN_FILE = path.join(ROOT, "scripts/checks/record-readings-limit-open.ts");
const LIMIT_OPEN_HEADER = `// Generated by scripts/checks/record-readings.test.ts (\`LIMIT_OPEN_LIST=seed|prune pnpm vitest run scripts/checks/record-readings.test.ts\`); do not edit by hand.
// The records of 2026-11-23, the day the check was added, whose "Limit" or "until the end of" line has no test title that names the line id or the record id with a word for a second use or the end of the
// duration (second, twice, again, end of the phase, ...). These were not read one by one: a record here may be tested well under a title the check cannot see, or not at all.
// What the check cannot see: the assertions of a test (a title that says "second" counts, whatever it asserts), a test that names neither the line id nor the record id, and a record whose limit
// or duration lines carry no "Limit" or "until the end of" words. A record not on this list fails the test; a listed record that now has such a test fails as stale: remove it with \`prune\`.
// The list only shrinks: \`seed\` writes it from nothing and is not run again.
`;
const writeLimitOpen = (ids: readonly string[]): void => {
  writeFileSync(LIMIT_OPEN_FILE, `${LIMIT_OPEN_HEADER}\nexport const LIMIT_TESTS_OPEN: readonly string[] = [\n${ids.map((id) => `  "${id}",`).join("\n")}\n];\n`);
};

const env = loadRenderEnv();
const textOf: TextOf = (id) => {
  const [code = "", side = "", n = "0"] = id.split(":");
  return env.ledger.byKey.get(keyOf(code, side))?.lines[Number(n) - 1] ?? "";
};

type Json = Record<string, unknown>;
const record = (over: Omit<Partial<Effect>, "instructions"> & { id: string; instructions: unknown[] }): Effect => ({ cardCode: "9", lines: [over.id.replace(/:[a-z]+:\d+$/i, ":A:1")], timing: "action", ...over }) as unknown as Effect;
const text = (line: string): TextOf => () => line;

const unlisted = (found: readonly Finding[], listed: Readonly<Record<string, string>>): string[] => found.filter((finding) => !(finding.recordId in listed)).map((finding) => `${finding.recordId}: ${finding.text}`);
const stale = (found: readonly Finding[], listed: Readonly<Record<string, string>>): string[] => Object.keys(listed).filter((id) => !found.some((finding) => finding.recordId === id));

describe("record readings: the checks find what they claim", () => {
  const pick = { type: "enemy", control: "any" };

  it("enemies: a filter with no zone is found whatever the line says, one with staging or a zone field is not, and a line that says engaged with is not read", () => {
    const loose = record({ id: "9:action:1", instructions: [{ verb: "Pick", pick }] });
    expect(enemyZoneFindings([loose], text("Deal 1 damage to each enemy in play."))).toHaveLength(1);
    expect(enemyZoneFindings([loose], text("Deal 1 damage to an enemy."))).toHaveLength(1);
    // A line that names words the old check skipped on ("you", "attack", "encounter") is read.
    expect(enemyZoneFindings([loose], text("Action: Choose an enemy. You attack it."))).toHaveLength(1);
    // A line that names an enemy card with no word "enemy" is read through the record.
    const named = record({ id: "9:constant:1", timing: "constant", instructions: [{ verb: "ModifyStat", holders: { ...pick, names: ["Watcher in the Water"] } }] });
    expect(enemyZoneFindings([named], text("Watcher in the Water cannot take damage."))).toHaveLength(1);
    expect(enemyZoneFindings([loose], text("Deal 1 damage to an enemy engaged with you."))).toHaveLength(0);
    expect(enemyZoneFindings([loose], text("Deal 1 damage to the attacking enemy."))).toHaveLength(0);
    for (const field of [{ staging: true }, { engaged: "you" }, { stagingOnly: true }, { engagedWith: "picked" }, { facedownShadow: true }]) {
      expect(enemyZoneFindings([record({ id: "9:action:1", instructions: [{ verb: "Pick", pick: { ...pick, ...field } }] })], text("Each enemy in play gets -1 Attack."))).toHaveLength(0);
    }
    // A condition on a card the effect already holds says nothing about where it lies.
    const held = record({ id: "9:action:1", instructions: [{ verb: "Draw", when: { kind: "matches", card: "picked", pick } }] });
    expect(enemyZoneFindings([held], text("If that enemy is in play, draw 1 card."))).toHaveLength(0);
    // A count in the record's condition is read too.
    const counted = record({ id: "9:action:1", condition: { kind: "count", pick }, instructions: [] } as never);
    expect(enemyZoneFindings([counted], text("Only if an enemy is in play."))).toHaveLength(1);
  });

  it("enemies: removing `staging` from the records that read the staging area is found, on copies of the real records", () => {
    // 906402:constant:2 and 906204:constant:1 name an enemy card and no "enemy", 906405:constant:1 and 906305:constant:1 count enemies in the staging area.
    for (const id of ["906402:constant:2", "906405:constant:1", "906305:constant:1", "906204:constant:1"]) {
      const real = EFFECTS.find((effect) => effect.id === id);
      expect(real, id).toBeDefined();
      expect(enemyZoneFindings([real as Effect], textOf), `${id} as it is`).toHaveLength(0);
      const copy = JSON.parse(JSON.stringify(real), (key, value: unknown) => (key === "staging" ? undefined : value)) as Effect;
      expect(JSON.stringify(copy)).not.toBe(JSON.stringify(real));
      expect(enemyZoneFindings([copy], textOf), `${id} without staging`).toHaveLength(1);
    }
  });

  it("then: a part that can come up short before a last instruction with no condition is found, one with a condition is not", () => {
    const bare = record({ id: "9:action:1", instructions: [{ verb: "Draw", amount: 1 }, { verb: "ModifyStat" }] });
    expect(thenFindings([bare], text("Draw 1 card. Then, give it +1 Willpower."))).toHaveLength(1);
    const held = record({ id: "9:action:1", instructions: [{ verb: "Draw", amount: 1 }, { verb: "ModifyStat", when: { kind: "thenResolves" } }] });
    expect(thenFindings([held], text("Draw 1 card. Then, give it +1 Willpower."))).toHaveLength(0);
    // A line with no "then", and a first part that cannot come up short, are not read.
    expect(thenFindings([bare], text("Draw 1 card and give it +1 Willpower."))).toHaveLength(0);
    const sure = record({ id: "9:action:1", instructions: [{ verb: "ModifyStat" }, { verb: "RaiseThreat" }] });
    expect(thenFindings([sure], text("Give it +1 Willpower. Then, raise your threat by 1."))).toHaveLength(0);
  });

  it("then: a part that can come up short inside a Repeat, an Each, a Choose option or a ForEachPlayer is read, and so are Ready, Exhaust and Heal", () => {
    const line = text("Do it. Then, give it +1 Willpower.");
    const later = { verb: "ModifyStat" };
    const inside = (body: Json): Effect => record({ id: "9:action:1", instructions: [body, later] });
    expect(thenFindings([inside({ verb: "Repeat", times: 3, instructions: [{ verb: "DiscardTopOfDeck" }] })], line)).toHaveLength(1);
    expect(thenFindings([inside({ verb: "Each", pick: { type: "hero", control: "you" }, instructions: [{ verb: "Heal", amount: 1 }] })], line)).toHaveLength(1);
    expect(thenFindings([inside({ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Draw", amount: 1 }] })], line)).toHaveLength(1);
    for (const verb of ["Ready", "Heal", "Exhaust"]) expect(thenFindings([record({ id: "9:action:1", instructions: [{ verb }, later] })], line), verb).toHaveLength(1);
    // An Exhaust the line words as a cost is paid or the action is not offered.
    expect(thenFindings([record({ id: "9:action:1", instructions: [{ verb: "Exhaust" }, later] })], text("Exhaust a hero to claim it. Then, attach it."))).toHaveLength(0);
    // A list inside a Choose option is read as its own list, and an option with `requires` is not read.
    const option = (extra: Json): Effect => record({ id: "9:action:1", instructions: [{ verb: "Choose", who: "actor", options: [{ id: "a", ...extra, instructions: [{ verb: "Draw", amount: 1 }, later] }] }] });
    expect(thenFindings([option({})], line)).toHaveLength(1);
    expect(thenFindings([option({ requires: { kind: "resources", min: 1 } })], line)).toHaveLength(0);
    // The last instruction of the inner list holding a condition is enough.
    expect(thenFindings([record({ id: "9:action:1", instructions: [{ verb: "Repeat", times: 3, instructions: [{ verb: "Draw", amount: 1 }, { ...later, when: { kind: "thenResolves" } }] }] })], line)).toHaveLength(0);
  });

  it("then: removing `thenResolves` from 06141:response:1, on a copy of the real record, is found", () => {
    const real = EFFECTS.find((effect) => effect.id === "06141:response:1");
    expect(real).toBeDefined();
    expect(thenFindings([real as Effect], textOf)).toHaveLength(0);
    const copy = JSON.parse(JSON.stringify(real), (key, value: unknown) => (key === "when" && (value as Json).kind === "thenResolves" ? undefined : value)) as Effect;
    expect(JSON.stringify(copy)).not.toBe(JSON.stringify(real));
    expect(thenFindings([copy], textOf)).toHaveLength(1);
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

  it("holds no new record whose Limit or duration line no test title tests twice or to the end", () => {
    const files = tracked(["src", "test"]).filter((file) => /\.(ts|tsx)$/.test(file) && (file.startsWith("test/") || /\.test\.tsx?$/.test(file)));
    const titles = files.flatMap((file) => testTitles(readFileSync(path.join(ROOT, file), "utf8")));
    const open = [...new Set(limitFindings(EFFECTS, textOf, titles).map((finding) => finding.recordId))].sort();
    const mode = process.env.LIMIT_OPEN_LIST;
    let listed = LIMIT_TESTS_OPEN;
    if (mode === "seed" || mode === "prune") {
      listed = mode === "seed" ? open : LIMIT_TESTS_OPEN.filter((id) => open.includes(id));
      writeLimitOpen(listed);
    }
    expect(open.filter((id) => !listed.includes(id)), "test the second use or the end of the duration, in a title that names the line id and says so (second, again, end of the phase)").toEqual([]);
    expect(listed.filter((id) => !open.includes(id)), "a test now covers the record: remove it from the list with LIMIT_OPEN_LIST=prune").toEqual([]);
  });
});
