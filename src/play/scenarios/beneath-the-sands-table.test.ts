// Rules: hrd.track (data/rules/entries.json); ledger lines 17076:A:1, 17079:A:1, 17080:A:1, 17074:A:1 (docs/scenarios/haradrim/beneath-the-sands.md, Table).
// What the table says of Beneath the Sands' pieces: the Search objective is one staging card shown by the face it holds with its resources as tokens, Grabbed by Spiders hangs under the main quest, and no dial or seat mark is added.
// The engine decided each number; nothing here changes one. No control types damage, resources, threat, progress or life.
import { describe, expect, it } from "vitest";

import { idOf, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
import { ASKS } from "../words/asks/beneath-the-sands.ts";
import { seatMarks, scenarioDials } from "../readouts/scenario-dials.ts";

const MAIN = "17076";
const at = (layout: Layout = {}) => tableFromLayout("beneath-the-sands", { seats: 1, stage: MAIN, phase: "Quest", ...layout });

describe("the Search objective", () => {
  it("17076:A:1 lies in the staging area on the face it holds, with its resources as tokens on the card", () => {
    const t = at({ staging: [{ code: "17079", resources: 2 }] });
    const card = t.state.cards[idOf(t.state, "17079")];
    expect(card).toMatchObject({ zone: "staging", resources: 2 });
  });

  it("17080:A:1 shows On Track as the card's own face, so the table needs no side marker", () => {
    const t = at({ staging: ["17080"] });
    expect(t.state.cards[idOf(t.state, "17080")]?.zone).toBe("staging");
  });
});

describe("Grabbed by Spiders", () => {
  it("17074:A:1 hangs under the main quest card like any attachment the table already draws", () => {
    const t = at({ attached: [{ code: "17074", to: MAIN, encounter: true }] });
    const attachment = t.state.cards[idOf(t.state, "17074")];
    expect(attachment).toMatchObject({ zone: "attached", host: idOf(t.state, MAIN) });
  });
});

describe("what no piece adds", () => {
  it("17076:A:1 adds no dial and no seat mark: the Track tokens and the objective are drawn by the cards", () => {
    const t = at({ staging: [{ code: "17079", resources: 1 }] });
    expect(scenarioDials(t.state, t.ctx, (code) => code)).toEqual([]);
    expect(seatMarks(t.state, t.ctx)).toEqual([]);
  });
});

describe("the choice words", () => {
  it("17079:forced:1 names both branches in words of their own", () => {
    expect(ASKS["17079:forced:1 @1 location"]?.label).toContain("topmost location");
    expect(ASKS["17079:forced:1 @1 threat"]?.label).toContain("resource");
  });
});
