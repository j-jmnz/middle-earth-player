import { describe, expect, it } from "vitest";

import { EFFECTS } from "../../effects/index.ts";
import { tableFromLayout } from "../../../test/harness/scene-kit.ts";

import { firstShares, triggerRequest, type PayRequest } from "./pay.ts";

// Rules: rr.resource-match, rr.cost (data/rules/entries.json). The pay sheet's first guess follows a card's rule on how many
// different pools pay for it (PayDistinctHeroes): "from 3 different heroes' pools", "from a single hero's resource pool".

const pools = [
  { heroId: "a", max: 3 },
  { heroId: "b", max: 2 },
  { heroId: "c", max: 1 },
];
const request = (distinct?: PayRequest["distinct"], total = 3): PayRequest => ({ seat: 0, cardId: "x", total, exact: true, pools, ...(distinct ? { distinct } : {}) });

describe("the first guess at a payment", () => {
  it("takes each pool in order when the card names no rule", () => {
    expect(firstShares(request())).toEqual([{ id: "a", amount: 3 }]);
  });

  it("spreads one resource over each of the first pools for '3 different heroes', then fills in order", () => {
    expect(firstShares(request({ min: 3 }))).toEqual([{ id: "a", amount: 1 }, { id: "b", amount: 1 }, { id: "c", amount: 1 }]);
    expect(firstShares(request({ min: 3 }, 5))).toEqual([{ id: "a", amount: 3 }, { id: "b", amount: 1 }, { id: "c", amount: 1 }]);
  });

  it("names the first single pool that holds it all for 'a single hero's resource pool'", () => {
    expect(firstShares({ ...request({ max: 1 }, 2), pools: [{ heroId: "c", max: 1 }, ...pools.slice(0, 2)] })).toEqual([{ id: "a", amount: 2 }]);
  });
});

// Bifur (03002:A:1): "Pay 1 resource from a hero's resource pool to add 1 resource to Bifur's resource pool." The first guess
// pays from another hero; Bifur's own pool is still offered, last (issue #131). The table is told his card,
// then a hero stand-in takes his code.
describe("the first guess for an effect that pays back into its own pool", () => {
  const bifurTable = (resources: number) => {
    const made = tableFromLayout("the-oath", { heroResources: resources }, { extra: ["03002"] });
    const card = made.state.cards[made.hero];
    if (!card) throw new Error("no hero");
    const state = { ...made.state, cards: { ...made.state.cards, [made.hero]: { ...card, code: "03002", resources: 1 } } };
    const effect = EFFECTS.find((record) => record.id === "03002:action:1");
    if (!effect) throw new Error("no Bifur record");
    return { request: triggerRequest(state, made.ctx, made.hero, effect), bifur: made.hero };
  };

  it("does not take the resource from Bifur while another hero can pay", () => {
    const { request, bifur } = bifurTable(1);
    if (!request) throw new Error("no request");
    expect(request.pools.at(-1)?.heroId).toBe(bifur);
    const shares = firstShares(request);
    expect(shares).toHaveLength(1);
    expect(shares[0]?.id).not.toBe(bifur);
  });

  it("names Bifur when only his pool holds a resource", () => {
    const { request, bifur } = bifurTable(0);
    if (!request) throw new Error("no request");
    expect(firstShares(request)).toEqual([{ id: bifur, amount: 1 }]);
  });
});
