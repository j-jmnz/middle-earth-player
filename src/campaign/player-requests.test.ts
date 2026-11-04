// Rules: rr.action, rr.initiating-abilities-playing-cards (data/rules/entries.json).
// Player cards of the player's own decks that the box does not print, ledgered on request (user request, 2026-10-25).
import { beforeAll, describe, expect, it } from "vitest";

import { withThreat } from "../rules/core/state.ts";
import { fund, payFor, refusal, starterBase } from "../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../test/harness/catalog.ts";
import { begin, buildTable, idsOf, send, type Scene, type Table } from "../../test/harness/scene.ts";

const SHIREFOLK = "19121";
const SAM = "141002";
const MERRY = "141003";
const THEODRED = "01002";

let base: Awaited<ReturnType<typeof starterBase>>;

beforeAll(async () => {
  const starter = await starterBase();
  base = { ...starter, cards: new Map([...starter.cards, ...(await loadPrinted([SHIREFOLK]))]) };
});

function table(scene: Scene): Table {
  const tab = buildTable(base, { ring: "none", start: "planning", ...scene });
  return { ...tab, state: withThreat(fund(tab.state, 0, 2), 0, 30) };
}

describe("The Shirefolk (19121:A:2, played only under 19121:A:1)", () => {
  it("reduces your threat by 4 when each of your heroes is a Hobbit", () => {
    const tab = table({ heroes: [{ code: SAM, seat: 0 }, { code: MERRY, seat: 0 }], hand: [{ code: SHIREFOLK, seat: 0 }] });
    const card = idsOf(tab, SHIREFOLK);
    const run = send(begin(tab.state), { type: "PlayCard", cardId: card, payments: payFor(tab.state, tab.ctx, card) }, tab.ctx);
    expect(run.state.seats[0]?.threat).toBe(26);
    expect(run.steps.filter((step) => step.kind === "threat").map((step) => (step.kind === "threat" ? step.amount : 0))).toEqual([-4]);
    expect(run.state.cards[card]?.zone).toBe("discard");
  });

  it("cannot be played while one of your heroes is not a Hobbit", () => {
    const tab = table({ heroes: [{ code: SAM, seat: 0 }, { code: THEODRED, seat: 0 }], hand: [{ code: SHIREFOLK, seat: 0 }] });
    const card = idsOf(tab, SHIREFOLK);
    expect(refusal(tab.state, { type: "PlayCard", cardId: card, payments: [] }, tab.ctx)).toBe("That card cannot be played now");
    expect(tab.state.seats[0]?.threat).toBe(30);
  });
});
