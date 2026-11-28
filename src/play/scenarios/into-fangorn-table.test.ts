// Rules: rm.time-x, rm.hinder, rr.guarded, rr.objective-cards, rr.attachment-cards, rr.refresh-phase (data/rules/entries.json); ledger lines 07031:A:2, 07031:A:3, 07033:A:1, 07034:A:1, 07035:A:1, 07036:A:1, 07052:A:1, 07057:A:2, 07058:A:1, 07065:B:1, 07065:B:2, 07066:B:1, 07066:B:2, 07067:B:1, 07067:B:2.
// What the table says of Into Fangorn's pieces: the time dial of its three stages with what the last counter does, Mugash held under Edge of Fangorn and then under a hero, the Hinder Huorns, Off Track and In Need of Rest on their hosts, and the cap of Heart of Fangorn. The engine decided each; nothing here changes one.
import { describe, expect, it } from "vitest";

import { updateCard, type ScenarioState } from "../../rules/core/state.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { idOf, resolveRecords, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
import type { PickOption } from "../choice/sheet-types.ts";
import { sheetFor } from "../choice/sheets.ts";
import { slotNumbers } from "../cards/card-effects.ts";
import { dungeonDetail } from "../cards/dungeon-preview.ts";
import { scenarioDials } from "../readouts/scenario-dials.ts";
import { readoutFor } from "../readouts/readout.ts";
import { enemiesToFace } from "../store/foresight.ts";

const ID = "into-fangorn";
const MUGASH = "07031";
const EDGE = "07032";
const built = (layout: Layout = {}) => tableFromLayout(ID, { phase: "Quest", deckOf: ["filler", "filler", "filler"], ...layout });
type Made = ReturnType<typeof built>;
const nameOf = (made: Made) => (code: string) => made.cards.get(code)?.name ?? code;
const detail = (made: Made, code: string) => dungeonDetail(made.state, made.ctx, idOf(made.state, code), (id) => made.cards.get(made.state.cards[id]?.code ?? "")?.name ?? id);
const ON_EDGE = { attached: [{ code: MUGASH, to: EDGE, encounter: true as const }] };
const ON_HERO = { attached: [{ code: MUGASH, to: "dh1", encounter: true as const }] };

describe("the time dial of stages 1B, 2B and 3B", () => {
  const timeDial = (stage: string, left: number) => {
    const made = built({ stage });
    const state = updateCard(made.state, idOf(made.state, stage), { resources: left });
    return scenarioDials(state, made.ctx, nameOf(made)).find((dial) => dial.testID?.startsWith("ring-maker-time:"));
  };

  it("07065:B:1, 07066:B:1 and 07067:B:1 read the counters against Time 4, 4 and 3; they warm near and are never critical", () => {
    expect(timeDial("07065", 4)).toMatchObject({ label: "Time", value: 4, limit: 4, limitWords: "Time 4: it starts with 4 time counters" });
    expect(timeDial("07066", 4)).toMatchObject({ value: 4, limit: 4 });
    expect(timeDial("07067", 3)).toMatchObject({ value: 3, limit: 3, limitWords: "Time 3: it starts with 3 time counters" });
    for (const stage of ["07065", "07066", "07067"]) {
      expect(timeDial(stage, 3)?.warn).toBeUndefined();
      expect(timeDial(stage, 2)?.warn?.level).toBe("near");
      expect(timeDial(stage, 1)?.warn?.level).toBe("near");
    }
  });

  it("07057:A:2 warns that the next refresh phase takes 2 counters only while Off Track is attached, and counts each Off Track in play", () => {
    const dial = (layout: Layout, left: number) => {
      const made = built({ stage: "07065", ...layout });
      const state = updateCard(made.state, idOf(made.state, "07065"), { resources: left });
      return scenarioDials(state, made.ctx, nameOf(made)).find((found) => found.testID?.startsWith("ring-maker-time:"));
    };
    const onEdge = { staging: ["07050", "07051"], attached: [{ code: "07057", to: "07050", encounter: true as const }] };
    expect(dial(onEdge, 2)?.warn?.words).toMatch(/^The next refresh phase takes the last 2 time counters\./);
    expect(dial(onEdge, 3)?.warn?.words).toBeUndefined();
    expect(dial(onEdge, 3)?.note).toMatch(/^3 time counters left\. 2 come off at the end of each refresh phase\./);
    expect(dial({ staging: ["07050", "07051"] }, 2)?.warn?.words).toBe("2 time counters are left.");
    const both = { staging: ["07050", "07051"], attached: [{ code: "07057", to: "07050", encounter: true as const }, { code: "07057", to: "07051", encounter: true as const }] };
    expect(dial(both, 3)?.warn?.words).toMatch(/^The next refresh phase takes the last 3 time counters\./);
  });

  it("07065:B:2 and 07066:B:2 say the last counter shuffles Mugash into the deck, even from a hero, and advances the quest to stage 3", () => {
    const words = "With the last gone, Mugash is shuffled into the encounter deck, even from a hero, and the quest advances to stage 3.";
    expect(timeDial("07065", 1)?.warn?.words).toBe(`The next refresh phase takes the last time counter. ${words}`);
    expect(timeDial("07066", 1)?.note).toBe(`1 time counter left. One comes off at the end of each refresh phase. ${words}`);
  });

  it("07067:B:2 says the last counter discards 5 cards, adds an enemy or objective for each player and returns 3 counters", () => {
    expect(timeDial("07067", 1)?.warn?.words).toBe("The next refresh phase takes the last time counter. With the last gone, 5 cards from the top of the encounter deck are discarded, each player adds an enemy or objective from the discard pile to the staging area, and 3 time counters return.");
    expect(timeDial("07067", 0)?.warn?.words).toMatch(/^No time counters are left\./);
  });

  it("07065:B:1 two-handed keeps one Time dial beside the two threat dials", () => {
    const made = built({ seats: 2, stage: "07065", timeCounters: 3 });
    expect(scenarioDials(made.state, made.ctx, nameOf(made)).filter((dial) => dial.testID?.startsWith("ring-maker-time:"))).toHaveLength(1);
  });
});

// Every sheet a record's windows open: the rows each offers with the caution on each, and the sentence over it.
type Row = { id: string; label: string; caution?: string };
function sheetsOf(made: Made, code: string, timing: "whenRevealed" | "forced" | "action", pick: (n: number, ids: readonly string[]) => string, source?: string) {
  const sheets: { prompt: string; note: string; rows: Row[] }[] = [];
  resolveRecords(made.state, made.ctx, code, timing, source, (at: ScenarioState) => {
    const sheet = sheetFor(at, made.ctx, legalIntents(at, made.ctx), { card: (id) => made.cards.get(at.cards[id]?.code ?? "")?.name ?? id, line: () => null });
    const rows: Row[] = sheet && "options" in sheet ? (sheet.options as readonly PickOption[]).map((option) => ({ id: option.id, label: option.label, ...(option.caution ? { caution: option.caution } : {}) })) : [];
    sheets.push({ prompt: sheet && "prompt" in sheet ? String(sheet.prompt) : "", note: sheet && "note" in sheet ? String((sheet as { note?: string }).note) : "", rows });
    return pick(sheets.length - 1, rows.map((row) => row.id));
  });
  return sheets;
}

describe("Turned Around's time row", () => {
  const timeRow = (stage: string, left: number) => {
    const made = built({ stage, timeCounters: left, active: "07051" });
    return sheetsOf(made, "07052", "whenRevealed", () => "time")[0]?.rows.find((row) => row.id === "time");
  };

  it("07052:A:1 counts the counters and names what the last one does on stage 1B, 2B and 3B", () => {
    expect(timeRow("07065", 3)).toMatchObject({ label: "Remove 1 time counter from the current quest (3 left, 2 after)" });
    expect(timeRow("07065", 3)?.caution).toBeUndefined();
    expect(timeRow("07065", 1)?.caution).toBe("Tap again: the last time counter comes off, Mugash is shuffled into the encounter deck, even from a hero, and the quest advances to stage 3.");
    expect(timeRow("07066", 1)?.caution).toMatch(/^Tap again: the last time counter comes off, Mugash is shuffled/);
    expect(timeRow("07067", 1)?.caution).toBe("Tap again: the last time counter comes off, 5 cards from the top of the encounter deck are discarded, each player adds an enemy or objective from the discard pile to the staging area, and 3 time counters return.");
  });

  it("07052:A:1 names both options", () => {
    const sheet = sheetsOf(built({ stage: "07065", timeCounters: 3, active: "07051" }), "07052", "whenRevealed", () => "time")[0];
    expect(sheet?.note).toBe("Turned Around: remove 1 time counter from the current quest, or return the active location to the staging area.");
    expect(sheet?.rows.map((row) => row.label)).toEqual(["Remove 1 time counter from the current quest (3 left, 2 after)", "Return the active location to the staging area"]);
  });
});

describe("Mugash on Edge of Fangorn and on a hero", () => {
  it("07031:A:2 Edge and Mugash say he cannot be claimed while Edge is in play and stays in the staging area when it leaves", () => {
    const made = built({ stage: "07065", staging: [EDGE], ...ON_EDGE });
    const words = "Mugash lies on Edge of Fangorn, so no player can claim him. When Edge of Fangorn leaves play he stays in the staging area, and a player can claim him.";
    expect(detail(made, MUGASH)).toBe(words);
    expect(detail(made, EDGE)).toBe(words);
    expect(slotNumbers(made.state, made.ctx, idOf(made.state, EDGE)).under).toMatchObject({ text: "Mugash", speech: "Mugash held underneath" });
  });

  it("07031:A:3 the hero's preview says damage returns Mugash to the top of the deck and any other exit to the staging area; the pill names him", () => {
    const made = built({ stage: "07066", ...ON_HERO });
    const words = "dh1 holds Mugash. If dh1 takes damage, Mugash returns to the top of the encounter deck. If dh1 leaves play any other way, he returns to the staging area.";
    expect(detail(made, "dh1")).toBe(words);
    expect(detail(made, MUGASH)).toBe(words);
    expect(slotNumbers(made.state, made.ctx, idOf(made.state, "dh1")).under).toMatchObject({ text: "Mugash", speech: "Mugash held underneath" });
    expect(slotNumbers(made.state, made.ctx, idOf(made.state, "dh2")).under).toBeNull();
  });

  it("07031:A:2 Mugash free in the staging area says how a player claims him, and what guards him", () => {
    expect(detail(built({ staging: [MUGASH] }), MUGASH)).toBe("Mugash is free of encounters. A player can exhaust a ready hero he controls to claim him.");
    expect(detail(built({ staging: [MUGASH], attached: [{ code: "07033", to: MUGASH, encounter: true }] }), MUGASH)).toBe("Mugash is guarded: a player can claim him only when he is free of encounters.");
  });
});

describe("the commit tray with a Hinder Huorn engaged", () => {
  const PLAIN = "07042";
  const tray = (engaged: readonly string[]) => {
    const made = tableFromLayout(ID, { phase: "Quest", stage: "07066", timeCounters: 3, engaged: [...engaged], deckOf: ["filler", "filler", "filler"] }, { extra: [PLAIN] });
    const result = readoutFor(made.state, made.ctx, null, null, (id) => made.cards.get(made.state.cards[id]?.code ?? "")?.name ?? id)?.result ?? "";
    return { made, result };
  };

  it("07033:A:1 leaves out an enemy that makes no attack in the coming combat phase: a lone Hinder Huorn is no enemy to face", () => {
    const { made, result } = tray(["07033"]);
    expect(enemiesToFace(made.state, made.ctx, 0)).toEqual([]);
    expect(result).not.toMatch(/Enemies to face/);
  });

  it("07034:A:1 counts the enemy beside it that does attack, with its attack alone", () => {
    const { made, result } = tray(["07034", PLAIN]);
    expect(enemiesToFace(made.state, made.ctx, 0).map((id) => made.state.cards[id]?.code)).toEqual([PLAIN]);
    expect(result).toMatch(/Enemies to face: 1 \(\d+ attack\)$/);
  });
});

describe("the claim of Mugash", () => {
  it("07031:A:2 is one sentence short enough for the one line of the tray, with the damage rule left to the hero's preview", () => {
    const made = built({ staging: [MUGASH] });
    const sheet = sheetsOf(made, MUGASH, "action", (_n, ids) => ids[0] ?? "", idOf(made.state, MUGASH))[0];
    expect(sheet?.prompt).toBe("");
    expect(sheet?.note).toBe("Exhaust a ready hero to claim him.");
    expect(sheet?.note.length).toBeLessThanOrEqual(36);
  });
});

describe("Hinder, Off Track and In Need of Rest", () => {
  it("07033:A:1, 07034:A:1 and 07035:A:1 say a Hinder Huorn makes no attack in combat and removes progress instead, engaged or not", () => {
    for (const code of ["07033", "07034", "07035"]) {
      expect(detail(built({ engaged: [code] }), code)).toBe("Hinder: in the combat phase this enemy makes no attack and is dealt no shadow card. At the start of that phase it removes 1 progress from the current quest, else from the active location.");
      expect(detail(built({ staging: [code] }), code)).toBe("Hinder: once engaged, this enemy makes no attack in the combat phase. It removes 1 progress from the current quest, else from the active location, at the start of that phase.");
    }
  });

  it("07057:A:2 the location that holds Off Track says what it adds", () => {
    const made = built({ staging: ["07050"], attached: [{ code: "07057", to: "07050", encounter: true }] });
    expect(detail(made, "07050")).toBe("Off Track is attached: +2 quest points. At the end of each refresh phase, 1 more time counter comes off the current quest.");
  });

  it("07058:A:1 the hero that holds In Need of Rest says it takes damage after each time counter, with Mugash's line beside it", () => {
    const rest = built({ attached: [{ code: "07058", to: "dh1", encounter: true }] });
    expect(detail(rest, "dh1")).toBe("dh1 holds In Need of Rest and takes 1 damage each time a time counter comes off the current quest.");
    const both = built({ attached: [{ code: "07058", to: "dh1", encounter: true }, { code: MUGASH, to: "dh1", encounter: true }] });
    expect(detail(both, "dh1")).toMatch(/In Need of Rest/);
    expect(detail(both, "dh1")).toMatch(/holds Mugash/);
    expect(detail(built({}), "dh1")).toBeNull();
    expect(slotNumbers(rest.state, rest.ctx, idOf(rest.state, "dh1")).under).toMatchObject({ text: "Rest", speech: "In Need of Rest attached" });
    expect(slotNumbers(rest.state, rest.ctx, idOf(rest.state, "dh2")).under).toBeNull();
  });

  it("07057:A:2 and 07058:A:1 name what the pick does", () => {
    const track = sheetsOf(built({ staging: ["07050", "07051"] }), "07057", "whenRevealed", (_n, ids) => ids[0] ?? "")[0];
    expect(track?.note).toBe("Off Track: choose a location in play to attach it to. The location gets +2 quest points, and 1 more time counter comes off the current quest at the end of each refresh phase.");
    const rest = sheetsOf(built({ committed: ["dh1", "dh2"] }), "07058", "whenRevealed", (_n, ids) => ids[0] ?? "")[0];
    expect(rest?.note).toBe("In Need of Rest: choose a hero committed to the quest. It leaves the quest and takes 1 damage each time a time counter comes off the current quest.");
  });
});

describe("the cards stage 3B brings back", () => {
  it("07067:B:2 names the choice from the discard pile, its two types and what happens to Mugash", () => {
    const made = built({ phase: "Refresh", stage: "07067", timeCounters: 0, discard: ["07033", "07034"], deck: ["f0", "f0", "f0", "f0", "f0", "f0"] });
    const sheet = sheetsOf(made, "07067", "forced", (_n, ids) => ids[0] ?? "")[0];
    expect(sheet?.note).toBe("The last time counter is gone. Choose an enemy or objective in the encounter discard pile. Reveal it and add it to the staging area. A chosen Mugash takes the next card as his guard.");
    expect(sheet?.rows.length).toBeGreaterThan(1);
  });
});

describe("Heart of Fangorn's refresh cap", () => {
  it("07036:A:1 binds the count still to choose: each pick leaves one fewer to ready and one fewer to hold", () => {
    const made = built({ phase: "Refresh", play: ["ally", "ally", "ally", "ally", "ally", "ally", "ally"] });
    let state = made.state;
    for (const card of Object.values(state.cards)) if ((card.zone === "play" || card.zone === "heroes") && card.controller === 0) state = updateCard(state, card.id, { exhausted: true });
    const sheets = sheetsOf({ ...made, state }, "07036", "forced", (_n, ids) => ids[0] ?? "");
    expect(sheets.map((sheet) => sheet.note.replace(/^.*phase\. /, ""))).toEqual(["9 exhausted characters would ready. Choose 4 of them to stay exhausted.", "8 exhausted characters would ready. Choose 3 of them to stay exhausted.", "7 exhausted characters would ready. Choose 2 of them to stay exhausted.", "6 exhausted characters would ready. Choose 1 of them to stay exhausted."]);
  });

  it("07036:A:1 names the cap, the count of exhausted characters and the player who chooses", () => {
    const made = built({ phase: "Refresh", play: ["ally", "ally", "ally", "ally"] });
    let state = made.state;
    for (const card of Object.values(state.cards)) if ((card.zone === "play" || card.zone === "heroes") && card.controller === 0) state = updateCard(state, card.id, { exhausted: true });
    const sheet = sheetsOf({ ...made, state }, "07036", "forced", (_n, ids) => ids[0] ?? "")[0];
    expect(sheet?.note).toBe("Heart of Fangorn: only 5 of your characters ready this refresh phase. 6 exhausted characters would ready. Choose 1 of them to stay exhausted.");
    const two = built({ seats: 2, phase: "Refresh", play: ["ally", "ally", "ally", "ally"] });
    let twoState = two.state;
    for (const card of Object.values(twoState.cards)) if ((card.zone === "play" || card.zone === "heroes") && card.controller === 0) twoState = updateCard(twoState, card.id, { exhausted: true });
    expect(sheetsOf({ ...two, state: twoState }, "07036", "forced", (_n, ids) => ids[0] ?? "")[0]?.note).toBe("Player 1, Heart of Fangorn: only 5 of your characters ready this refresh phase. 6 exhausted characters would ready. Choose 1 of them to stay exhausted.");
  });
});
