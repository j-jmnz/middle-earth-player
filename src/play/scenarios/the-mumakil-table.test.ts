// Rules: rr.attachment-cards, rr.in-play-and-out-of-play, rr.engaged, rr.staging (data/rules/entries.json); ledger lines 17027:A:1, 17027:B:2, 17011:A:1, 17026:A:1 (docs/scenarios/haradrim/the-mumakil.md, Table).
// What the table says of The Mûmakil's pieces: each Capture objective drawn faceup on its Wild Mûmak, in the staging area and engaged, with two on one Mûmak. The engine decided each fact; nothing here changes one.
import { describe, expect, it } from "vitest";

import { UNATTRIBUTED } from "../../rules/core/cause.ts";
import { placeDamage } from "../../rules/core/damage.ts";
import type { EngineStep } from "../../rules/core/intents.ts";
import { legalIntents, type ScenarioState } from "../../rules/engine/reduce.ts";
import { settle } from "../../rules/engine/machine.ts";
import { pushCardEffects } from "../../rules/interpret/effect-frames.ts";
import { idOf, opened, resolveRecords, revealFromTop, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
import { sheetFor } from "../choice/sheets.ts";

import { CAPTURE_CODES, MUMAK, captures } from "../../../test/scenarios/the-mumakil/kit.ts";
import { logLines, type LogNames } from "../store/log.ts";
import { momentOf } from "../store/outcome.ts";
import { zoneSelector } from "../store/selectors.ts";

const at = (layout: Layout = {}) => tableFromLayout("the-mumakil", { stage: "17027", side: "B", phase: "Quest", ...layout });

// A card's printed name in a state, as the log and the sheets name it.
const nameIn = (made: ReturnType<typeof at>, state: ScenarioState) => (id: string): string => made.ctx.cards.get(state.cards[id]?.code ?? "")?.name ?? id;

describe("the Capture objectives on their Wild Mûmak", () => {
  it("17027:A:1 draws each Capture on the Mûmak it lies on, in the staging area and engaged, two on one Mûmak", () => {
    for (const zone of ["staging", "engaged"] as const) {
      const layout: Layout = zone === "staging" ? { staging: [MUMAK], attached: captures("17011", "17012") } : { engaged: [{ code: MUMAK, seat: 0 }], attached: captures("17011", "17012") };
      const t = at(layout);
      const entries = zone === "staging" ? zoneSelector("staging", 0)(t.state).entries : zoneSelector("engaged", 0)(t.state).entries;
      const mumak = entries.find((entry) => entry.card.code === MUMAK);
      expect(mumak?.attached.map((card) => card.code).sort()).toEqual(["17011", "17012"]);
      expect(mumak?.attached.every((card) => card.face === "up")).toBe(true);
      expect(t.state.cards[idOf(t.state, "17011")]?.zone).toBe("attached");
    }
  });

  it("17027:B:2 draws no Capture on a Mûmak that carries none", () => {
    const t = at({ staging: [MUMAK] });
    const mumak = zoneSelector("staging", 0)(t.state).entries.find((entry) => entry.card.code === MUMAK);
    expect(mumak?.attached).toEqual([]);
  });
});

describe("17027:A:1 the line of a Capture attached to a Wild Mûmak", () => {
  const stage = (layout: Layout) => {
    const made = at({ seats: 2, setAside: CAPTURE_CODES, ...layout });
    const run = resolveRecords(opened(made).state, made.ctx, "17027", "whenRevealed", idOf(made.state, "17027"));
    const names = { card: nameIn(made, run.state) } as LogNames;
    return logLines(run.steps, names).map((line) => line.text);
  };

  it("says which Capture lies on the Mûmak and where the Mûmak stands: in the staging area", () => {
    const lines = stage({ staging: [MUMAK] }).filter((text) => text.includes("is attached to"));
    expect(lines).toHaveLength(2);
    for (const text of lines) expect(text).toMatch(/^.+ is attached to Wild Mûmak, in the staging area\.$/);
  });

  it("tells it in the banner as well, under the staging beat", () => {
    const made = at({ seats: 2, setAside: CAPTURE_CODES, staging: [MUMAK] });
    const before = opened(made).state;
    const run = resolveRecords(before, made.ctx, "17027", "whenRevealed", idOf(made.state, "17027"));
    const card = nameIn(made, run.state);
    const text = momentOf(before, run.state, run.steps, { card } as never)?.lines.map((line) => line.text) ?? [];
    expect(text.filter((line) => line.includes("is attached to Wild Mûmak, in the staging area."))).toHaveLength(2);
  });

  it("names the player the Mûmak is engaged with", () => {
    const lines = stage({ engaged: [{ code: MUMAK, seat: 1 }] }).filter((text) => text.includes("is attached to"));
    expect(lines).toHaveLength(2);
    for (const text of lines) expect(text).toMatch(/^.+ is attached to Wild Mûmak, engaged with Player 2\.$/);
  });
});

describe("the Response of a Capture objective on the choice sheet", () => {
  // The Mûmak is dealt 1 damage the way an effect deals it, so the Capture's Response window opens.
  function offered(layout: Layout) {
    const made = at({ seats: 2, attached: captures("17011", "17013"), deckOf: ["c3"], deck: [], ...layout });
    const steps: EngineStep[] = [];
    const start = opened(made).state;
    const placed = placeDamage(start, idOf(start, MUMAK), 1, made.ctx.cards, steps, "framework", UNATTRIBUTED);
    const state = settle({ ...placed, window: null, mode: "stopped" }, made.ctx, steps);
    const names = { card: nameIn(made, state), line: () => null };
    return sheetFor(state, made.ctx, legalIntents(state, made.ctx), names);
  }

  it("17011:A:1 names the Mûmak the Capture lies on and the player it is engaged with, and the number that captures it", () => {
    const sheet = offered({ engaged: [{ code: MUMAK, seat: 1, damage: 5 }] });
    expect(sheet?.kind).toBe("trigger");
    const lasso = sheet?.kind === "trigger" ? sheet.options.find((option) => option.label.startsWith("Horse-hair Lasso")) : undefined;
    expect(lasso?.label).toBe("Horse-hair Lasso \u00b7 on Wild Mûmak engaged with Player 2");
    expect(lasso?.text).toContain("Wild Mûmak has 3 hit points left. A card that costs 3 or more captures it.");
  });
});

describe("17024:A:1 Biting Insects on the choice sheet", () => {
  it("leads the title with the damage left, and the note names the discarded card and its cost apart from the damage left", () => {
    const made = at({ hand: [{ code: "c2", seat: 0 }] });
    const state = revealFromTop(opened(made).state, made.ctx, "17024", []).state;
    const names = { card: nameIn(made, state), line: () => null };
    const sheet = sheetFor(state, made.ctx, legalIntents(state, made.ctx), names);
    expect(sheet?.kind).toBe("pick");
    expect(sheet?.title).toBe("Assign 2: Biting Insects");
    expect(sheet?.kind === "pick" ? sheet.note : "").toContain("You discarded c2 (cost 2) at random. 2 of 2 damage left.");
  });
});

describe("17024:A:1 the banner names the card Biting Insects discarded at random", () => {
  it("tells the discard in the log and the banner, and only Biting Insects pushes the step", () => {
    const made = at({ hand: [{ code: "c2", seat: 0 }], deck: ["f0"] });
    const before = opened(made).state;
    const steps: EngineStep[] = [];
    const run = { state: revealFromTop(before, made.ctx, "17024", steps).state, steps };
    expect(run.steps.filter((step) => step.kind === "discardedRandom")).toHaveLength(1);
    const card = nameIn(made, run.state);
    expect(logLines(run.steps, { card, code: (code: string) => code, effectCard: () => null, rule: () => null, line: () => null } as LogNames).map((line) => line.text)).toContain("Player 1 discards c2 at random");
    // In a game of one player the banner leaves the seat out, as its other lines do.
    const text = momentOf(before, run.state, run.steps, { card } as never)?.lines.map((line) => line.text) ?? [];
    expect(text).toContain("Discards c2 at random");
  });

  it("names the player in the banner of a two-handed game", () => {
    const made = at({ seats: 2, hand: [{ code: "c2", seat: 0 }], deck: ["f0"] });
    const before = opened(made).state;
    const steps: EngineStep[] = [];
    const after = revealFromTop(before, made.ctx, "17024", steps).state;
    const text = momentOf(before, after, steps, { card: nameIn(made, after) } as never)?.lines.map((line) => line.text) ?? [];
    expect(text).toContain("Player 1 discards c2 at random");
  });
});

describe("17015:A:3 the Wild Mûmak's end-of-round choice on the choice sheet", () => {
  it("words each row in a short line the row can show whole, and keeps the question in the sheet's note", () => {
    const made = at({ engaged: [{ code: MUMAK, seat: 0 }] });
    const steps: EngineStep[] = [];
    const id = idOf(made.state, MUMAK);
    const pushed = pushCardEffects(opened(made).state, "forced", id, 0, false, made.ctx.effects.filter((effect) => effect.id === "17015:forced:1"), made.ctx, steps);
    const state = settle({ ...pushed, window: null, mode: "stopped" }, made.ctx, steps);
    const names = { card: nameIn(made, state), line: () => null };
    const sheet = sheetFor(state, made.ctx, legalIntents(state, made.ctx), names);
    expect(sheet?.kind).toBe("pick");
    if (sheet?.kind !== "pick") return;
    expect(sheet.options.map((option) => option.label)).toEqual(["Return it to the staging area", "It attacks you now (new shadow card) and stays engaged"]);
    expect(sheet.note).toContain("Wild Mûmak is engaged with you. At the end of the round, return it to the staging area, or it makes an immediate attack against you.");
  });
});
