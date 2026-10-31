import { describe, expect, it } from "vitest";

import ledger from "../../data/printed/dream-chaser.json";
import { loadCards } from "../../scripts/data/load-cards.ts";

import { emptyLog, type CampaignLog } from "./log.ts";
import { campaignLogSchema, newSave, parseLog } from "./save.ts";
import { dealtFace, NO_UPGRADED_SIDE } from "../rules/families/dreamchaser-facts.ts";
import { NO_UPGRADED_REASON, XP_ROWS, gavinReturned, isUpgraded, levelOf, markRefusal, marksOf, pick, spendOnSave, spendXp, unpick, xpFacts, xpGainedOf, xpRowOf, xpSpentOf, xpUnspentOf } from "./xp.ts";
import { markedLines, markedSpeech, pickSentence, xpView } from "./xp-view.ts";

// Rules: dcce.gaining-xp, dcce.scalable-upgradable (data/rules/entries.json). The Dream-chaser Campaign Log sheet's XP: the rows (MEC111 p31),
// what is gained and unspent, the picks the Spend XP screen drafts, and what the game reads back.
const COMMAND_LEADERSHIP = "11201";
const BLACK_KEY_BOON = "11183";
const GAVIN = "11210";
const CAPTAIN_SCENARIO = "a-storm-on-cobas-haven";

const fold = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[‘’]/g, "'").toLowerCase();

function logWith(gained: Record<string, number>, marks: Record<string, number> = {}, completed: string[] = Object.keys(gained)): CampaignLog {
  return { ...emptyLog(1), xpGained: gained, marks, completed };
}

describe("the Campaign Log sheet's rows", () => {
  const catalog = new Map(loadCards().map((card) => [card.code, card]));

  it("lists each card once, scalable cards first as the sheet does: 14 scalable and 28 upgradable", () => {
    expect(new Set(XP_ROWS.map((row) => row.code)).size).toBe(XP_ROWS.length);
    expect(XP_ROWS.filter((row) => row.kind === "scalable")).toHaveLength(14);
    expect(XP_ROWS.filter((row) => row.kind === "upgradable")).toHaveLength(28);
    expect(XP_ROWS.findIndex((row) => row.kind === "upgradable")).toBe(14);
  });

  it("names a card of the catalog: the code exists and the sheet's name is the card's title", () => {
    for (const row of XP_ROWS) {
      const card = catalog.get(row.code);
      expect(card, row.code).toBeDefined();
      expect(fold(row.name).startsWith(fold(card?.name ?? "")), `${row.code} ${row.name}`).toBe(true);
    }
  });

  it("marks the four sphere copies of a card by their own codes, each sphere named by the card's own text", () => {
    for (const row of XP_ROWS) {
      const sphere = /\((Leadership|Lore|Spirit|Tactics)\)$/.exec(row.name)?.[1];
      if (!sphere) continue;
      expect(catalog.get(row.code)?.text, row.name).toContain(`(${sphere})`);
    }
  });

  it("gives an upgradable card as many boxes as the XP cost its Upgraded side prints (the ledger)", () => {
    const checked = new Set<string>();
    for (const entry of ledger.entries) {
      const cost = /Prints "(\d+) XP"/.exec("notes" in entry && typeof entry.notes === "string" ? entry.notes : "")?.[1];
      if (!cost) continue;
      const row = xpRowOf(entry.code);
      expect(row?.kind, entry.code).toBe("upgradable");
      expect(row?.boxes, `${entry.code} ${row?.name}`).toBe(Number(cost));
      checked.add(entry.code);
    }
    expect(checked.size).toBe(25);
  });

  it("holds the sheet's box counts for the cards whose cost the ledger does not print", () => {
    expect(xpRowOf(GAVIN)?.boxes).toBe(4);
    expect(xpRowOf("11039")?.boxes).toBe(2);
    expect(xpRowOf("11038")?.boxes).toBe(2);
    expect(xpRowOf(COMMAND_LEADERSHIP)?.boxes).toBe(4);
  });
});

describe("XP gained, spent and unspent", () => {
  it("is the Resolutions' XP less the boxes marked, and never stored", () => {
    const log = logWith({ "voyage-across-belegaer": 5, "the-fate-of-numenor": 3 }, { [COMMAND_LEADERSHIP]: 2, [BLACK_KEY_BOON]: 1 });
    expect(xpGainedOf(log)).toBe(8);
    expect(xpSpentOf(log)).toBe(3);
    expect(xpUnspentOf(log)).toBe(5);
    expect(xpUnspentOf(emptyLog(1))).toBe(0);
  });

  it("reads a scalable card's level as its marked boxes and an upgradable card as upgraded only when every box is marked", () => {
    const log = logWith({ a: 9 }, { [COMMAND_LEADERSHIP]: 3, [BLACK_KEY_BOON]: 3 });
    expect(levelOf(log, COMMAND_LEADERSHIP)).toBe(3);
    expect(levelOf(log, BLACK_KEY_BOON)).toBe(0);
    expect(isUpgraded(log, BLACK_KEY_BOON)).toBe(false);
    expect(isUpgraded({ marks: { [BLACK_KEY_BOON]: 4 } }, BLACK_KEY_BOON)).toBe(true);
    expect(isUpgraded({ marks: { [COMMAND_LEADERSHIP]: 4 } }, COMMAND_LEADERSHIP)).toBe(false);
  });

  it("hands the engine the levels and the upgraded cards, and nothing when there are none", () => {
    expect(xpFacts(emptyLog(1))).toEqual({});
    expect(xpFacts(logWith({ a: 9 }, { [COMMAND_LEADERSHIP]: 3, [BLACK_KEY_BOON]: 4, "11172": 1 }))).toEqual({ levels: { [COMMAND_LEADERSHIP]: 3 }, upgraded: [BLACK_KEY_BOON] });
  });
});

describe("picking and marking boxes", () => {
  const log = logWith({ "voyage-across-belegaer": 3 }, {}, ["voyage-across-belegaer"]);

  it("a pick is a draft: one box a time, up to the XP unspent, and a pick can be taken back", () => {
    let picks = pick(log, {}, COMMAND_LEADERSHIP);
    picks = pick(log, picks, COMMAND_LEADERSHIP);
    picks = pick(log, picks, BLACK_KEY_BOON);
    expect(picks).toEqual({ [COMMAND_LEADERSHIP]: 2, [BLACK_KEY_BOON]: 1 });
    // No XP is left: a fourth pick changes nothing and says why.
    expect(pick(log, picks, "11172")).toEqual(picks);
    expect(markRefusal(log, picks, "11172")).toBe("No XP is left to spend");
    expect(unpick(picks, COMMAND_LEADERSHIP)).toEqual({ [COMMAND_LEADERSHIP]: 1, [BLACK_KEY_BOON]: 1 });
    expect(unpick(unpick(picks, BLACK_KEY_BOON), BLACK_KEY_BOON)).toEqual({ [COMMAND_LEADERSHIP]: 2 });
    expect(unpick({}, COMMAND_LEADERSHIP)).toEqual({});
  });

  it("the log is unchanged until the picks are marked, then one XP is spent for each box", () => {
    const picks = { [COMMAND_LEADERSHIP]: 2, [BLACK_KEY_BOON]: 1 };
    expect(log.marks).toEqual({});
    const spent = spendXp(log, picks);
    if (!spent.ok) throw new Error(spent.reason);
    expect(spent.log.marks).toEqual({ [COMMAND_LEADERSHIP]: 2, [BLACK_KEY_BOON]: 1 });
    expect(xpUnspentOf(spent.log)).toBe(0);
    // The old log is not touched (a log is never changed after it is built).
    expect(log.marks).toEqual({});
  });

  it("adds to the boxes already marked, and stops at the card's boxes", () => {
    const rich = logWith({ a: 12 }, { [COMMAND_LEADERSHIP]: 3 });
    expect(markRefusal(rich, {}, COMMAND_LEADERSHIP)).toBeNull();
    expect(markRefusal(rich, { [COMMAND_LEADERSHIP]: 1 }, COMMAND_LEADERSHIP)).toBe("Every box beside Command (Leadership) is marked");
    const spent = spendXp(rich, { [COMMAND_LEADERSHIP]: 1 });
    expect(spent.ok && levelOf(spent.log, COMMAND_LEADERSHIP)).toBe(4);
  });

  it("refuses more XP than is unspent, more boxes than a card has, and a card that is not on the sheet", () => {
    expect(spendXp(log, { [COMMAND_LEADERSHIP]: 4 })).toEqual({ ok: false, reason: "No XP is left to spend" });
    expect(spendXp(logWith({ a: 9 }), { "11172": 3 })).toEqual({ ok: false, reason: "Every box beside Armor Plating is marked" });
    expect(spendXp(log, { "01001": 1 })).toEqual({ ok: false, reason: "That card has no boxes in the Campaign Log" });
    expect(spendXp(log, {})).toEqual({ ok: true, log });
  });

  it("Gavin's four boxes are one pick, offered after A Storm on Cobas Haven is won, and they are \"Gavin returned\"", () => {
    const before = logWith({ a: 6 }, {}, ["voyage-across-belegaer"]);
    expect(markRefusal(before, {}, GAVIN)).toBe("Gavin is marked after a storm on cobas haven is won");
    expect(markRefusal(before, {}, GAVIN, { [CAPTAIN_SCENARIO]: "A Storm on Cobas Haven" })).toBe("Gavin is marked after A Storm on Cobas Haven is won");
    const after = logWith({ a: 6 }, {}, ["voyage-across-belegaer", CAPTAIN_SCENARIO]);
    // One tap picks all four boxes, one more tap is refused, and Undo takes all four back.
    const picked = pick(after, {}, GAVIN);
    expect(picked).toEqual({ [GAVIN]: 4 });
    expect(markRefusal(after, picked, GAVIN)).toBe("Every box beside Gavin is marked");
    expect(unpick(picked, GAVIN)).toEqual({});
    const spent = spendXp(after, picked);
    if (!spent.ok) throw new Error(spent.reason);
    expect(gavinReturned(spent.log)).toBe(true);
    expect(gavinReturned(after)).toBe(false);
    expect(xpUnspentOf(spent.log)).toBe(2);
    // Fewer than four XP unspent: not offered. A part of his boxes is never marked.
    const poor = logWith({ a: 3 }, {}, [CAPTAIN_SCENARIO]);
    expect(markRefusal(poor, {}, GAVIN)).toBe("Gavin takes 4 XP at once and fewer are left");
    expect(pick(poor, {}, GAVIN)).toEqual({});
    expect(spendXp(after, { [GAVIN]: 2 })).toEqual({ ok: false, reason: "Gavin takes 4 boxes at once" });
  });

  it("XP is spent on a save only before or after a scenario, never with one open", () => {
    const save = { ...newSave("s", "dream-chaser", 1), log };
    const spent = spendOnSave(save, { [COMMAND_LEADERSHIP]: 1 });
    expect(spent.ok && spent.save.log.marks).toEqual({ [COMMAND_LEADERSHIP]: 1 });
    const open = { ...save, active: { engineVersion: 1, dataHash: 1, seed: 1, intents: [] } };
    expect(spendOnSave(open, { [COMMAND_LEADERSHIP]: 1 })).toEqual({ ok: false, reason: "XP is spent only before or after a scenario" });
  });
});

describe("what the Spend XP screen shows", () => {
  const log = logWith({ a: 4 }, { [COMMAND_LEADERSHIP]: 1, [BLACK_KEY_BOON]: 4 });

  it("counts the picks against the XP unspent and says what a row's boxes are", () => {
    const view = xpView(log, { [COMMAND_LEADERSHIP]: 1 });
    expect([view.gained, view.spent, view.unspent, view.picked, view.left]).toEqual([4, 5, 0, 1, 0]);
    const rich = xpView(logWith({ a: 9 }, { [COMMAND_LEADERSHIP]: 1, [BLACK_KEY_BOON]: 4 }), { [COMMAND_LEADERSHIP]: 2 });
    const command = rich.scalable.find((row) => row.code === COMMAND_LEADERSHIP);
    expect(command).toMatchObject({ marked: 1, picked: 2, level: 3, words: "Level 1 +2", note: null, full: false, canPick: true });
    expect(command?.label).toBe("Command (Leadership), Level 1, 2 to mark, 4 boxes");
    expect(rich.upgradable.find((row) => row.code === BLACK_KEY_BOON)).toMatchObject({ full: true, canPick: false, words: "Upgraded", reason: "Every box beside Black Key (boon) is marked" });
    expect(rich.scalable).toHaveLength(14);
    expect(rich.upgradable).toHaveLength(28);
  });

  it("says nothing is spent until the boxes are marked, and the log's lines show the boxes", () => {
    expect(pickSentence({ picked: 0, left: 0 })).toBe("No XP is left to spend.");
    expect(pickSentence({ picked: 2, left: 1 })).toBe("2 boxes picked, 1 XP left. Marked boxes can't be taken back.");
    expect(pickSentence({ picked: 1, left: 0 })).toBe("1 box picked, 0 XP left. Marked boxes can't be taken back.");
    expect(markedLines(log, "scalable")).toEqual(["Command (Leadership) ■□□□"]);
    expect(markedLines(log, "upgradable")).toEqual(["Black Key (boon) ■■■■"]);
    expect(markedSpeech(log, "scalable")).toBe("Command (Leadership), 1 of 4 boxes marked");
    expect(markedSpeech(log, "upgradable")).toBe("Black Key (boon), 4 of 4 boxes marked");
  });

  it("a card waiting on a scenario says so in the row's words, by the scenario's name, and a card with every box marked is not dimmed", () => {
    const waiting = xpView(logWith({ a: 6 }), {}, { [CAPTAIN_SCENARIO]: "A Storm on Cobas Haven" });
    expect(waiting.upgradable.find((row) => row.code === GAVIN)).toMatchObject({ note: "After A Storm on Cobas Haven", canPick: false, words: "0 of 4" });
    expect(waiting.upgradable.find((row) => row.code === "11172")?.note).toBeNull();
  });
});

describe("the cards MEC111 lists as upgradable with no Upgraded side in the sources", () => {
  const BURN = "11038";
  const DREAM_CHASER_LOCATION = "11039";
  const sides = (code: string): string[] => ledger.entries.filter((entry) => entry.code === code).map((entry) => entry.side);

  it("are exactly the listed rows whose other side the scan ledger does not hold, and keep their sheet rows and box counts", () => {
    expect([...NO_UPGRADED_SIDE].sort()).toEqual([BURN, DREAM_CHASER_LOCATION]);
    for (const code of NO_UPGRADED_SIDE) expect(sides(code), code).toEqual(["A"]);
    expect([xpRowOf(BURN)?.boxes, xpRowOf(DREAM_CHASER_LOCATION)?.boxes]).toEqual([2, 2]);
    for (const code of ["11172", "11190", "11180"]) expect(sides(code)).toContain("B");
  });

  it("show in the Spend XP list, dimmed with the reason, and take no pick or mark even with XP to spend", () => {
    const rich = logWith({ a: 9 });
    const view = xpView(rich, {});
    for (const code of [BURN, DREAM_CHASER_LOCATION]) {
      expect(view.upgradable.find((row) => row.code === code)).toMatchObject({ canPick: false, reason: NO_UPGRADED_REASON, note: NO_UPGRADED_REASON, marked: 0 });
      expect(markRefusal(rich, {}, code)).toBe("Upgraded side not in the sources");
      expect(pick(rich, {}, code)).toEqual({});
      expect(spendXp(rich, { [code]: 1 })).toEqual({ ok: false, reason: NO_UPGRADED_REASON });
    }
    expect(view.upgradable.find((row) => row.code === "11172")?.canPick).toBe(true);
  });

  it("are never upgraded, so the game never deals them on a side with no lines, even for a log that marked every box", () => {
    const marked = logWith({ a: 9 }, { [BURN]: 2, [DREAM_CHASER_LOCATION]: 2, "11172": 2 });
    expect(isUpgraded(marked, BURN)).toBe(false);
    expect(isUpgraded(marked, "11172")).toBe(true);
    expect(xpFacts(marked).upgraded).toEqual(["11172"]);
    const facts = { campaignFacts: { prisoner: null, usedOnce: [], counters: {}, upgraded: [BURN, DREAM_CHASER_LOCATION, "11172"] } };
    expect([dealtFace(facts, BURN, "up"), dealtFace(facts, DREAM_CHASER_LOCATION, "up"), dealtFace(facts, "11172", "up")]).toEqual(["up", "up", "B"]);
  });
});

describe("an old save and the stored log", () => {
  it("a log saved before the XP fields reads with their defaults", () => {
    const { xpGained: _g, marks: _m, modes: _o, modeDefault: _d, ...old } = emptyLog(1);
    expect(parseLog(old)).toEqual(emptyLog(1));
    expect(campaignLogSchema.parse(old).marks).toEqual({});
  });

  it("round trips through the stored JSON, marks and modes included", () => {
    const log: CampaignLog = { ...emptyLog(1), xpGained: { "voyage-across-belegaer": 5 }, marks: { [COMMAND_LEADERSHIP]: 2 }, modes: { "voyage-across-belegaer": "hard" }, modeDefault: "expert" };
    expect(parseLog(JSON.parse(JSON.stringify(log)))).toEqual(log);
  });

  it("refuses a negative box count or an unknown card mode", () => {
    expect(() => parseLog({ ...emptyLog(1), marks: { [COMMAND_LEADERSHIP]: -1 } })).toThrow();
    expect(() => parseLog({ ...emptyLog(1), modes: { a: "nightmare" } })).toThrow();
  });

  it("a new playthrough keeps the Hard/Expert Mode card its setup chose", () => {
    expect(newSave("s", "dream-chaser", 1, { modeDefault: "hard" }).log.modeDefault).toBe("hard");
    expect(newSave("s", "dream-chaser", 1).log.modeDefault).toBeNull();
    expect(marksOf(newSave("s", "dream-chaser", 1).log, COMMAND_LEADERSHIP)).toBe(0);
  });
});
