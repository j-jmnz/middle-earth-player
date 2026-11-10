// Rules: rr.forced, rr.reveal, rr.shadow-effects, rr.cancel, rr.multiple-defenders, mec112.pursuit (data/rules/entries.json); ledger lines 19155:A:1, 19155:A:2, 19159:A:2, 19164:A:1 of The Fate of Wilderland.
// The card-spec harness on real rows: each row holds, fails without its records, and the removal leaves the shared records as they were.
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../../src/effects/index.ts";

import type { Effect } from "../../src/catalog/boundary.ts";

import { announce, answer, attack, offers, attackersOf, cancel, cardSpecs, counter, damageOn, defend, defender, drew, handCount, heldBy, progressOn, quest, refused, resolve, resourcesOn, respond, reveal, rowProblems, stat, withoutLine, zone, type Row } from "./card-spec.ts";
import { printedIn } from "./scene-kit.ts";

const ID = "the-fate-of-wilderland";
const FIGHT = ["19155", "19156", "19157"];
const defense = printedIn(ID, "19157")?.defense ?? 0;

const rows: Row[] = [
  { line: "19155:A:1", name: "Urdug gets +2 Defense for each other enemy", layout: { staging: [...FIGHT, "18020"] }, act: [], expect: stat("19157", "defense", defense + 2) },
  { line: "19155:A:2", name: "Forced after an unsuccessful quest", layout: { stage: "19168", threat: [30, 30], staging: [...FIGHT, "18020", "18022", "18021"] }, act: quest("fail"), expect: progressOn("19155", 1) },
  { line: "19159:A:2", name: "Shadow: +2 Attack", act: attack("f3", { shadow: "19159", undefended: true }), expect: stat("f3", "attack", (printedIn(ID, "f3")?.attack ?? 0) + 2) },
  { line: "19164:A:1", name: "When Revealed: either progress or an additional reveal", layout: { staging: FIGHT }, act: [resolve("19164", "whenRevealed"), answer("progress")], expect: progressOn("19155", 1) },
  { line: "19164:A:1", name: "revealed from the top of the encounter deck", layout: { staging: FIGHT }, act: [reveal("19164"), answer("progress")], expect: progressOn("19155", 1) },
];
cardSpecs(ID, rows);

describe("card-spec", () => {
  it("reports an expectation that does not hold, and an action that cannot be played", () => {
    expect(rowProblems(ID, { ...rows[0]!, expect: stat("19157", "defense", 99) }, EFFECTS)).toEqual([`19157 defense is ${defense + 2}, not 99`]);
    expect(rowProblems(ID, { ...rows[3]!, act: [resolve("19164", "whenRevealed"), answer("nowhere")] }, EFFECTS)[0]).toMatch(/option nowhere is not offered/);
    expect(rowProblems(ID, { ...rows[1]!, act: quest("success") }, EFFECTS)[0]).toMatch(/meant to succeed/);
  });

  it("sees a row that still holds without its records", () => {
    const hollow: Row = { line: "19155:A:2", layout: { staging: FIGHT }, act: announce("endOfRound", undefined, { seat: null, phase: "End of round" }), expect: zone("19157", "staging") };
    expect(rowProblems(ID, hollow, EFFECTS)).toEqual([]);
    expect(rowProblems(ID, hollow, withoutLine(EFFECTS, hollow.line))).toEqual([]);
  });

  it("rejects a hollow row whose expectation holds either way, though its answer is never asked for once the records are gone", () => {
    const hollow: Row = { line: "19164:A:1", layout: { staging: FIGHT }, act: [resolve("19164", "whenRevealed"), answer("progress")], expect: zone("19157", "staging") };
    const gone = withoutLine(EFFECTS, hollow.line);
    // The row holds on its records; without them a strict run stops on the answer nobody asked for, which is no proof the records matter.
    expect(rowProblems(ID, hollow, EFFECTS)).toEqual([]);
    expect(rowProblems(ID, hollow, gone)[0]).toMatch(/no choice open|never asked/);
    // The removal run skips that answer and reads the expectation alone: it still holds, so the row is rejected.
    expect(rowProblems(ID, hollow, gone, true)).toEqual([]);
    // A row that depends on the records fails in the same run: the answer is skipped and the progress is not there.
    expect(rowProblems(ID, rows[3]!, gone, true)).toEqual(["19155 holds 0 progress, not 1"]);
  });

  it("takes the records of a line out of a new list and leaves the shared one alone", () => {
    const before = EFFECTS.length;
    const kept = withoutLine(EFFECTS, "19155:A:2");
    expect(kept.length).toBeLessThan(before);
    expect(kept.some((effect) => effect.lines.includes("19155:A:2"))).toBe(false);
    expect(EFFECTS).toHaveLength(before);
    expect(EFFECTS.some((effect) => effect.lines.includes("19155:A:2"))).toBe(true);
  });
});

// The expectations, acts and layout entries that read a seat, a defender, a cancel, a Response or a scenario value, on the cards of The Fate of Wilderland and The Uruk-hai.
const URUK = "the-uruk-hai";
const row = (layout: Row["layout"], act: Row["act"], expect: Row["expect"]): Row => ({ line: "test", ...(layout ? { layout } : {}), act, expect });

describe("card-spec damage, hand, draws and held Captives", () => {
  it("reads the damage on a card, the hand and the draws of a seat, and the host of a Captive", () => {
    const grishnakh = row({ staging: ["143022", "143024"], captive: { hero: "dh2", under: "143024" } }, announce("endOfPhase", undefined, { seat: null, phase: "Quest" }), [damageOn("dh2", 1), heldBy("dh2", "143024")]);
    expect(rowProblems(URUK, grishnakh, EFFECTS)).toEqual([]);
    expect(rowProblems(URUK, { ...grishnakh, expect: [damageOn("dh2", 4), heldBy("dh2", "143022"), heldBy("dh1", "143024")] }, EFFECTS)).toEqual(["dh2 holds 1 damage, not 4", "dh2 is held by 143024, not held by 143022", "dh1 is in heroes, not held by 143024"]);
  });

  it("reads the hand and the draws of the seat a layout entry and an expectation name, the first by default", () => {
    const hands = row({ seats: 2, hand: ["filler", { code: "ally", seat: 1 }], deckOf: ["filler", { code: "filler", seat: 1 }, "filler"] }, [], [handCount(1), handCount(2, 1), drew(0)]);
    expect(rowProblems(URUK, hands, EFFECTS)).toEqual([]);
    expect(rowProblems(URUK, { ...hands, expect: [handCount(2), handCount(1, 1)] }, EFFECTS)).toEqual(["seat 0 holds 1 cards in hand, not 2", "seat 1 holds 2 cards in hand, not 1"]);
    const draws = row({ active: "143026", seats: 2, deckOf: ["filler", "filler"] }, resolve("143026", "response"), [drew(1), drew(1, 1), handCount(1, 1)]);
    expect(rowProblems(URUK, draws, EFFECTS)).toEqual([]);
    expect(rowProblems(URUK, { ...draws, expect: drew(2, 1) }, EFFECTS)).toEqual(["seat 1 drew 1 cards, not 2"]);
  });

  it("reads a scenario value through its named reader", () => {
    const pursuit = row({ staging: ["143029"], pursuit: 10 }, announce("progressPlaced", "143029"), counter("pursuit", 11));
    expect(rowProblems(URUK, pursuit, EFFECTS)).toEqual([]);
    expect(rowProblems(URUK, { ...pursuit, expect: counter("pursuit", 10) }, EFFECTS)).toEqual(["pursuit is 11, not 10"]);
    expect(rowProblems(URUK, { ...pursuit, layout: { staging: ["143029"] }, expect: counter("pursuit", 0) }, EFFECTS)).toEqual(["pursuit is absent, not 0"]);
    expect(rowProblems(URUK, { ...pursuit, expect: counter("life", 1) }, EFFECTS)).toEqual(["life is absent, not 1"]);
  });
});

describe("card-spec defenders and attackers", () => {
  it("has the card the row names defend the attack, and reads the declared defenders", () => {
    const second = row({}, [attack("f3"), defend("dh2")], [defender("dh2"), defender("dh1", false)]);
    expect(rowProblems(ID, second, EFFECTS)).toEqual([]);
    expect(rowProblems(ID, { ...second, expect: [defender("dh1"), defender("dh2", false)] }, EFFECTS)).toEqual(["dh1 did not defend the attack", "dh2 defended the attack"]);
    // The first hero defends when no card is named.
    expect(rowProblems(ID, row({}, attack("f3"), [defender("dh1"), defender("dh2", false)]), EFFECTS)).toEqual([]);
  });

  it("reads who attacked a card, in order, and says when no attack ran or defend is out of place", () => {
    const twice = row({}, attack("f3", { shadow: "143031", undefended: true }), attackersOf("dh1", ["f3", "f3"]));
    expect(rowProblems(URUK, twice, EFFECTS)).toEqual([]);
    expect(rowProblems(URUK, { ...twice, expect: attackersOf("dh1", ["f3"]) }, EFFECTS)).toEqual(["dh1 was attacked by [f3, f3], not [f3]"]);
    expect(rowProblems(URUK, row({}, [], defender("dh1")), EFFECTS)).toEqual(["no attack was in progress: the row needs an attack action"]);
    expect(rowProblems(URUK, row({}, [resolve("143031", "whenRevealed"), defend("dh2")], []), EFFECTS)[0]).toMatch(/defend must follow the attack/);
  });
});

describe("card-spec Responses and cancels", () => {
  it("uses the Response a quest leaves offered, and says when none is", () => {
    const leader = row({ attached: [{ code: "143018", to: "dh1" }], pursuit: 10 }, [quest("success"), respond("143018")], resourcesOn("dh1", 1));
    expect(rowProblems(URUK, leader, EFFECTS)).toEqual([]);
    // Left unused, the Response gives nothing; with the records gone nothing is offered, and the expectation alone says so.
    expect(rowProblems(URUK, { ...leader, act: quest("success") }, EFFECTS)).toEqual(["dh1 holds 0 resources, not 1"]);
    expect(rowProblems(URUK, leader, withoutLine(EFFECTS, "143018:A:3"), true)).toEqual(["dh1 holds 0 resources, not 1"]);
    expect(rowProblems(URUK, { ...leader, act: respond("143018") }, EFFECTS)).toEqual(["no Response of 143018 is offered"]);
  });

  // A record of a card in the layout with a paid cancel: Urdug's Forced at the end of the round discards him unless the first player pays 1.
  const DISCARD: Effect = { id: "19155:forced:test", cardCode: "19155", lines: ["19155:A:9"], timing: "forced", trigger: "endOfRound", cancel: { cost: 1 }, instructions: [{ verb: "Discard", target: { kind: "self" } }] };
  const ended = announce("endOfRound", "19155", { seat: null, phase: "End of round" });

  it("pays a cancel from a hero's pool and reads the cancel step", () => {
    const layout = { staging: FIGHT, heroResources: 1 };
    const effects = [...EFFECTS, DISCARD];
    const canceled = row(layout, [ended, cancel], [refused("19155"), zone("19155", "staging"), resourcesOn("dh1", 0)]);
    expect(rowProblems(ID, canceled, effects)).toEqual([]);
    // Left unanswered, the offer stays open: nothing is canceled and nothing is paid.
    const open = row(layout, ended, [refused("19155", false), resourcesOn("dh1", 1), offers("Trigger", "19155")]);
    expect(rowProblems(ID, open, effects)).toEqual([]);
    expect(rowProblems(ID, { ...open, expect: refused("19155") }, effects)).toEqual(["the effect of 19155 was not canceled"]);
    // With no pool to pay from, no cancel is offered.
    expect(rowProblems(ID, { ...canceled, layout: { staging: FIGHT } }, effects)[0]).toMatch(/no cancel is offered/);
  });
});
