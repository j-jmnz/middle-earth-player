// Rules: rr.cancel, rr.ownership-and-control (data/rules/entries.json); ledger lines 141001:A:1, 144001:A:1, 146001:A:1, 22055:A:3, 22085:A:3.
// "Exhaust The One Ring" names a title: the copy of The One Ring a player controls pays, whichever box printed it.
import { describe, expect, it } from "vitest";

import { AUTHORED_EFFECTS as FELLOWSHIP } from "../../effects/authored/fellowship-of-the-ring.ts";
import { RECORDS as LOS } from "../../effects/authored/pool/LoS.ts";
import { RECORDS as MOF } from "../../effects/authored/pool/MoF.ts";
import { definePrinted } from "../core/printed.ts";
import { updateCard } from "../core/state.ts";
import { legalIntents } from "../engine/reduce.ts";
import { holds } from "../interpret/conditions.ts";
import { enemy, hero, offered, table, until } from "../families/defense/table.ts";

const ring = (code: string) => definePrinted({ code, name: "The One Ring", type: "attachment" });
const frodo = (code: string) => hero(code, { sphere: "fellowship" });
const RING_CODES = ["141085", "142091", "144063", "146065"] as const;

function withRing(frodoCode: string, ringCode: string, effects: Parameters<typeof table>[0]["effects"]) {
  return table({ cards: [frodo(frodoCode), ring(ringCode), enemy("grunt")], effects, heroes: [{ code: frodoCode }], attachments: [{ code: ringCode, host: frodoCode }], enemies: [{ code: "grunt" }] });
}

describe("Frodo's cost and condition read The One Ring by title", () => {
  const action = LOS.filter((record) => record.cardCode === "144001");

  it.each(RING_CODES)("the Action of the Two Towers' Frodo is offered with The One Ring %s in play (144001:A:1)", (code) => {
    const made = withRing("144001", code, action);
    const at = until(made.state, made.ctx, (_state, legal) => offered(legal, "144001:action:1"));
    expect(offered(legalIntents(at, made.ctx), "144001:action:1")).toBe(true);
  });

  it("is not offered once that Ring is exhausted (144001:A:1)", () => {
    const made = withRing("144001", "144063", action);
    const spent = until(updateCard(made.state, made.ids["144063"] ?? "", { exhausted: true }), made.ctx, (state, legal) => state.phase === "Combat" || offered(legal, "144001:action:1"));
    expect(offered(legalIntents(spent, made.ctx), "144001:action:1")).toBe(false);
  });

  it("the Return of the King's Frodo reads the Ring by title too (146001:A:1)", () => {
    const record = MOF.find((item) => item.id === "146001:action:1");
    expect(record?.cost).toEqual({ kind: "exhaustNamed", name: "The One Ring" });
  });

  it.each(RING_CODES)("the cancel of the Fellowship's Frodo finds The One Ring %s ready (141001:A:1)", (code) => {
    const record = FELLOWSHIP.find((item) => item.id === "141001:response:1");
    const made = withRing("141001", code, record ? [record] : []);
    expect(holds(made.state, record?.condition ?? { kind: "phase", is: "Quest" }, { actor: 0, sourceId: null, returned: 0 }, made.ctx)).toBe(true);
  });
});
