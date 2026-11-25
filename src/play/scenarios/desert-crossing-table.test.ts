// Rules: hrd.heat-tracker, rr.blank, rr.cannot (data/rules/entries.json); ledger lines 16068:A:1, 16068:B:3, 16069:B:2, 16070:B:3, 16053:A:1, 16048:A:1 (docs/scenarios/haradrim/desert-crossing.md, Table).
// What the table says of Desert Crossing's pieces: the temperature dial against its limit of 60 (warm near it), the "Blank" pill and preview line of a damaged character under Craft Remedy, and the preview line of a character under Find Water.
// The engine decided each number; nothing here changes one. No control types damage, resources, threat, progress or life.
import { describe, expect, it } from "vitest";

import { updateCard } from "../../rules/core/state.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { idOf, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";

import { effectById } from "../../rules/windows/listen.ts";
import { ASKS } from "../words/asks/desert-crossing.ts";
import { asksOption, type AskFacts } from "../words/asks.ts";
import { slotNumbers } from "../cards/card-effects.ts";
import { previewCards } from "../cards/table-preview.ts";
import { seatMarks, scenarioDials } from "../readouts/scenario-dials.ts";

const MAIN = "16068";
const at = (layout: Layout = {}) => tableFromLayout("desert-crossing", { seats: 1, stage: MAIN, phase: "Quest", ...layout });
const heat = (layout: Layout) => {
  const t = at(layout);
  return scenarioDials(t.state, t.ctx, (code) => code).find((dial) => dial.id === "heat");
};
const damaged = (layout: Layout = {}) => {
  const t = at({ staging: ["16053"], play: ["ally"], ...layout });
  const state = syncConstants(updateCard(t.state, idOf(t.state, "ally"), { damage: 1 }), t.ctx);
  return { t, state };
};
const lines = (t: ReturnType<typeof at>, state: typeof t.state, code: string): string => {
  const name = (id: string) => t.state.cards[id]?.code ?? id;
  return JSON.stringify(previewCards(state, t.ctx, idOf(state, code), (key) => ({ name: name(idOf(state, key)), source: null, text: "" }), name));
};

describe("the temperature dial", () => {
  it("16068:A:1 shows the temperature the tracker holds against the limit of 60, and says the tens digit the cards read", () => {
    const dial = heat({ temperature: 10 });
    expect(dial).toMatchObject({ label: "Heat", value: 10, limit: 60, warms: true, limitWords: "the players lose at 60" });
    expect(dial?.warn).toBeUndefined();
    expect(dial?.note).toContain("tens digit");
    expect(dial?.note).toContain("as 1");
    expect(heat({ temperature: 45 })?.note).toContain("as 4");
  });

  it("16068:B:3 warms near the limit at four fifths of it and turns critical from nine tenths", () => {
    expect(heat({ temperature: 45 })?.warn).toBeUndefined();
    expect(heat({ temperature: 48 })?.warn?.level).toBe("near");
    expect(heat({ temperature: 53 })?.warn?.level).toBe("near");
    expect(heat({ temperature: 55 })?.warn).toMatchObject({ level: "critical", words: "5 from the limit of 60" });
  });

  it("16068:A:1 shows no dial before Setup sets the tracker, and none in another scenario", () => {
    expect(heat({})).toBeUndefined();
    const other = tableFromLayout("escape-from-umbar", { phase: "Quest" });
    expect(scenarioDials(other.state, other.ctx, (code) => code).some((dial) => dial.id === "heat")).toBe(false);
    expect(seatMarks(at({ temperature: 10 }).state, at().ctx)).toEqual([]);
  });
});

describe("a damaged character under Craft Remedy", () => {
  it("16053:A:1 wears the pill \"Blank\" and says in its preview that its text box is blank", () => {
    const { t, state } = damaged();
    expect(slotNumbers(state, t.ctx, idOf(state, "ally")).determined?.word).toBe("Blank");
    expect(lines(t, state, "ally")).toContain("Its text box is blank (");
  });

  it("16053:A:1 wears no pill with no damage on it, and none without Craft Remedy", () => {
    const clean = at({ staging: ["16053"], play: ["ally"] });
    expect(slotNumbers(syncConstants(clean.state, clean.ctx), clean.ctx, idOf(clean.state, "ally")).determined).toBeNull();
    const none = at({ play: ["ally"] });
    const hurt = syncConstants(updateCard(none.state, idOf(none.state, "ally"), { damage: 1 }), none.ctx);
    expect(slotNumbers(hurt, none.ctx, idOf(none.state, "ally")).determined).toBeNull();
  });
});

describe("a character under Find Water", () => {
  it("16048:A:1 says in the preview that player card effects cannot ready it, and says nothing without Find Water", () => {
    const withIt = at({ staging: ["16048"], play: ["ally"] });
    const state = syncConstants(withIt.state, withIt.ctx);
    expect(lines(withIt, state, "ally")).toContain("Player card effects cannot ready it");
    const without = at({ play: ["ally"] });
    expect(lines(without, without.state, "ally")).not.toContain("cannot ready it");
  });

  it("51225:A:1 reads the modifier, not the scenario: the same line names Fouled Well in The Mines of Moria", () => {
    const moria = tableFromLayout("the-mines-of-moria", { stage: "51223", phase: "Travel", staging: ["51225"], play: ["ally"] });
    const state = syncConstants(moria.state, moria.ctx);
    const name = (id: string) => moria.state.cards[id]?.code ?? id;
    const line = JSON.stringify(previewCards(state, moria.ctx, idOf(state, "ally"), (key) => ({ name: name(idOf(state, key)), source: null, text: "" }), name));
    expect(line).toContain("Player card effects cannot ready it (");
  });
});

describe("Scorching Sun's shadow choice", () => {
  const rows = (temperature: number) => {
    const t = at({ temperature });
    const record = effectById(t.ctx, "16030:shadow:1");
    const choose = record?.instructions[0];
    const asked: AskFacts = { game: t.state, ctx: t.ctx, names: { card: (id) => id, code: (code) => code }, instruction: choose!, effectId: "16030:shadow:1", source: null, options: [] };
    return { raise: asksOption(asked, "temperature", ASKS), back: asksOption(asked, "return", ASKS) };
  };

  it("16030:A:3 the raise by 2 says where the temperature ends and asks for a second tap when that is 60", () => {
    expect(rows(56).raise).toEqual({ label: "Raise the temperature by 2" });
    expect(rows(57).raise).toEqual({ label: "Raise the temperature by 2" });
    expect(rows(58).raise).toEqual({ label: "Raise the temperature by 2, to 60", caution: "Tap again: the temperature reaches 60 and the game is lost" });
    expect(rows(59).raise?.caution).toContain("reaches 60");
    expect(rows(58).back?.label).toBe("Attacker returns to staging after attack");
    expect(rows(58).back?.caution).toBeUndefined();
  });
});
