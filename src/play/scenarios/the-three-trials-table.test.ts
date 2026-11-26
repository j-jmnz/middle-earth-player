// Rules: rm.current-trial, rm.time-x, rr.objective-cards, rr.attachment-cards, rr.engaged, rr.travel (data/rules/entries.json); ledger lines 08035:B:1, 08036:B:2, 08037:B:2, 08038:B:2, 08039:A:1, 08040:A:2, 08041:A:2, 08042:A:2, 08043:A:1, 08049:A:2.
// What the table says of The Three Trials' pieces: the choice of the next trial, the current trial's Key dial, each Guardian's time dial, the Key on its host, the Guardians in the victory display and Hallowed Circle's Travel cost. The engine decided each; nothing here changes one.
import { describe, expect, it } from "vitest";

import { legalIntents } from "../../rules/engine/reduce.ts";
import { idOf, resolveRecords, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
import type { PickOption } from "../choice/sheet-types.ts";
import { sheetFor } from "../choice/sheets.ts";
import { slotNumbers } from "../cards/card-effects.ts";
import { dungeonDetail } from "../cards/dungeon-preview.ts";
import { scenarioDials } from "../readouts/scenario-dials.ts";

const ID = "the-three-trials";
const built = (layout: Layout = {}) => tableFromLayout(ID, { phase: "Quest", deckOf: ["filler", "filler", "filler"], ...layout });
type Made = ReturnType<typeof built>;
const nameOf = (made: Made) => (code: string) => made.cards.get(code)?.name ?? code;
const dials = (made: Made) => scenarioDials(made.state, made.ctx, nameOf(made));
const detail = (made: Made, code: string) => dungeonDetail(made.state, made.ctx, idOf(made.state, code), (id) => made.cards.get(made.state.cards[id]?.code ?? "")?.name ?? id);
const marked = (key: string, stage: string) => ({ modified: [{ code: key, from: stage, stats: [["trialKey", 1]] as const }] });
const ON_GUARDIAN = { attached: [{ code: "08043", to: "08040", encounter: true as const }], ...marked("08043", "08036") };
const ON_HERO = { attached: [{ code: "08043", to: "dh1", encounter: true as const }], ...marked("08043", "08036") };

describe("the choice of the next trial", () => {
  // The sheet the engine's Choose shows at the first stage 2A choice, read by answering the window with the first option.
  function sheetAt(made: Made) {
    let sheet: { note: string; rows: { id: string; label: string; code: string | null }[] } | undefined;
    resolveRecords(made.state, made.ctx, "08035", "whenRevealed", idOf(made.state, "08035"), (at) => {
      const shown = sheetFor(at, made.ctx, legalIntents(at, made.ctx), { card: (id) => made.cards.get(at.cards[id]?.code ?? "")?.name ?? id, line: () => null });
      sheet = { note: shown && "note" in shown ? String(shown.note) : "", rows: shown && "options" in shown ? (shown.options as readonly PickOption[]).map((option) => ({ id: option.id, label: option.label, code: option.code })) : [] };
      return sheet.rows[0]?.id ?? "";
    });
    return sheet;
  }

  it("08035:B:1 names the trials left and gives each trial one line of the same three parts, with its stage code for a long press", () => {
    const sheet = sheetAt(built({ stage: "08035" }));
    expect(sheet?.note).toBe("Choose the next trial. 3 trials left.");
    expect(sheet?.rows.map((row) => row.id)).toEqual(["08036", "08037", "08038"]);
    // The trial, what it puts on the table, its 2B rule; the stage code lets a long press open the card.
    expect(sheet?.rows.map((row) => row.label.split(" · ").length)).toEqual([3, 3, 3]);
    expect(sheet?.rows[0]?.label).toMatch(/^Strength · Guardian and Barrow, Key on the Guardian · /);
    expect(sheet?.rows.map((row) => row.code)).toEqual(["08036", "08037", "08038"]);
  });

  it("08035:B:1 two players: the first player answers for the group and the sentence names him once", () => {
    expect(sheetAt(built({ seats: 2, stage: "08035" }))?.note).toBe("Player 1, for the group: choose the next trial. 3 trials left.");
  });
});

describe("the current trial's Key", () => {
  const keyDial = (made: Made) => dials(made).find((dial) => dial.testID === "ring-maker-trial-key");

  it("08036:B:2 a Key on its Guardian is not controlled: the dial is empty and says where the Key goes", () => {
    const made = built({ stage: "08036", staging: ["08040"], ...ON_GUARDIAN });
    expect(keyDial(made)).toMatchObject({ label: "Key", value: 0, limit: 1, goal: true });
    expect(keyDial(made)?.note).toBe("Key of the Boar lies on Boar's Guardian, controlled by no player. When Boar's Guardian leaves play the Key goes to the staging area, and the first player claims it.");
  });

  it("08036:B:2 a Key on a hero is controlled: the dial is full and the preview of the hero says it counts toward the Travel cost", () => {
    const made = built({ stage: "08036", ...ON_HERO });
    expect(keyDial(made)).toMatchObject({ value: 1 });
    expect(keyDial(made)?.note).toBe("Key of the Boar lies on dh1: you control it. The trial is done.");
    expect(detail(made, "dh1")).toBe("dh1 holds Key of the Boar. You control it, and it counts toward Hallowed Circle's Travel cost while it is ready.");
  });

  it("08036:B:2 two-handed, the dial names the player who controls the Key", () => {
    const made = built({ seats: 2, stage: "08036", ...ON_HERO });
    expect(keyDial(made)?.note).toBe("Key of the Boar lies on dh1: Player 1 controls it. The trial is done.");
  });

  it("08043:A:2 a Key in the staging area is claimed by the first player, and one in the deck is not placed", () => {
    expect(keyDial(built({ stage: "08036", staging: ["08043"], ...marked("08043", "08036") }))?.note).toMatch(/^Key of the Boar is in the staging area\. The first player must claim it and attach it to a hero/);
    expect(keyDial(built({ stage: "08036", deck: ["08043"], ...marked("08043", "08036") }))?.note).toMatch(/^Key of the Boar is somewhere in the encounter deck/);
  });

  it("08036:B:2 has no dial before a trial or in another scenario", () => {
    expect(keyDial(built({ stage: "08035" }))).toBeUndefined();
    expect(dials(tableFromLayout("into-fangorn", { stage: "07065", timeCounters: 3 })).some((dial) => dial.testID?.startsWith("ring-maker-trial"))).toBe(false);
  });
});

const ANIMAL: Readonly<Record<string, string>> = { "08040": "Boar", "08041": "Wolf", "08042": "Raven" };

describe("the Guardians' time dials", () => {
  const timeDial = (made: Made, id?: string) => dials(made).find((dial) => dial.testID?.startsWith(id ?? "ring-maker-trial-time:"));

  it("08040:A:2 to 08042:A:2 read the counters against Time 2, 3 and 4 and warm when the refresh phase takes the last", () => {
    for (const [code, limit] of [["08040", 2], ["08041", 3], ["08042", 4]] as const) {
      const made = built({ stage: "08036", engaged: [{ code, resources: limit }] });
      expect(timeDial(made)).toMatchObject({ label: ANIMAL[code], value: limit, limit, limitWords: `Time ${limit}: it starts with ${limit} time counters` });
      expect(timeDial(made)?.warn).toBeUndefined();
      expect(timeDial(built({ stage: "08036", engaged: [{ code, resources: 1 }] }))?.warn?.level).toBe("near");
    }
  });

  it("08040:A:2 names what the last counter does and to whom", () => {
    // The warning says the first sentence and the note the rest, so a screen reader hears each once.
    const boar = timeDial(built({ stage: "08036", engaged: [{ code: "08040", resources: 1 }] }));
    expect(boar?.warn?.words).toBe("The next refresh phase takes the last time counter.");
    expect(boar?.note).toBe("With the last gone, the engaged player discards an ally he controls, and 2 time counters return. It hits you.");
    expect(timeDial(built({ stage: "08036", engaged: [{ code: "08041", resources: 1 }] }))?.note).toMatch(/it makes an immediate attack on the engaged player, and 3 time counters return/);
    expect(timeDial(built({ stage: "08036", engaged: [{ code: "08042", resources: 1 }] }))?.note).toMatch(/it deals 1 damage to each character the engaged player controls, and 4 time counters return/);
  });

  it("08040:A:2 a Guardian in the staging area does not warm, and the dials stand with the fewest counters first", () => {
    const made = built({ stage: "08036", staging: [{ code: "08040", resources: 1 }], engaged: [{ code: "08042", resources: 4 }, { code: "08041", resources: 2 }] });
    expect(timeDial(made)?.warn).toBeUndefined();
    expect(dials(made).filter((dial) => dial.testID?.startsWith("ring-maker-trial-time:")).map((dial) => dial.label)).toEqual(["Boar", "Wolf", "Raven"]);
  });

  it("08040:A:2 a Guardian's card preview says its time counters", () => {
    const made = built({ stage: "08036", engaged: [{ code: "08041", resources: 2 }] });
    expect(detail(made, "08041")).toBe("2 time counters left. One comes off at the end of each refresh phase. With the last gone, it makes an immediate attack on the engaged player, and 3 time counters return. It hits you.");
  });

  it("08040:A:2 in the staging area no player is engaged, so the effect does nothing; two-handed it names the player", () => {
    expect(timeDial(built({ stage: "08036", staging: [{ code: "08040", resources: 2 }] }))?.note).toMatch(/No player is engaged with it, so the effect does nothing\.$/);
    expect(timeDial(built({ seats: 2, stage: "08036", engaged: [{ code: "08040", seat: 1, resources: 1 }] }))?.note).toMatch(/It hits Player 2\.$/);
  });
});

describe("a Key on its host", () => {
  it("08043:A:1 the pill on a Guardian or a Barrow says its animal and a hero wears none; the preview says no player controls it", () => {
    const made = built({ stage: "08037", staging: ["08046"], attached: [{ code: "08044", to: "08046", encounter: true }], ...marked("08044", "08037") });
    expect(slotNumbers(made.state, made.ctx, idOf(made.state, "08046")).under).toMatchObject({ text: "Wolf", speech: "Key of the Wolf attached" });
    expect(detail(made, "08046")).toBe("Hill Barrow holds Key of the Wolf, which no player controls. When Hill Barrow leaves play the Key goes to the staging area.");
    const hero = built({ stage: "08036", ...ON_HERO });
    expect(slotNumbers(hero.state, hero.ctx, idOf(hero.state, "dh1")).under).toBeNull();
    expect(slotNumbers(hero.state, hero.ctx, idOf(hero.state, "dh2")).under).toBeNull();
  });
});

describe("the Guardians in the victory display", () => {
  it("08039:A:1 the Victory dial lists them and says stage 3A reveals each again", () => {
    const made = built({ stage: "08039", side: "A", victory: ["08040", "08041"] });
    const dial = dials(made).find((found) => found.testID === "ring-maker-trial-victory");
    expect(dial).toMatchObject({ value: 2, pile: "victory" });
    expect(dial?.note).toBe("Boar's Guardian and Wolf's Guardian are in the victory display. At stage 3A each is revealed again, with fresh time counters, and joins the staging area.");
    expect(dials(built({ stage: "08039", side: "A" })).some((found) => found.testID === "ring-maker-trial-victory")).toBe(false);
  });
});

describe("Hallowed Circle's Travel cost", () => {
  it("08049:A:2 says the cost is 3 ready Keys and counts the ready ones the players hold", () => {
    const two = built({ stage: "08039", staging: ["08049"], attached: [{ code: "08043", to: "dh1", encounter: true }, { code: "08044", to: "dh2", encounter: true }] });
    expect(detail(two, "08049")).toMatch(/^Travel cost: the players exhaust 3 ready Key objectives, not the heroes they lie on\. They control 2 ready Keys now, so the travel is not possible yet\. After the players travel here/);
    const three = built({ stage: "08039", staging: ["08049"], attached: ["08043", "08044", "08045"].map((code, at) => ({ code, to: at === 0 ? "dh1" : "dh2", encounter: true as const })) });
    expect(detail(three, "08049")).toMatch(/They control 3 ready Keys now, so the travel is possible\./);
    const spent = built({ stage: "08039", staging: ["08049"], attached: [{ code: "08043", to: "dh1", encounter: true }], exhaustedCards: ["08043"] });
    expect(detail(spent, "08049")).toMatch(/They control 0 ready Keys now/);
  });
});
