import { describe, expect, it } from "vitest";

import { firstShares, type PayRequest } from "./pay.ts";

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
