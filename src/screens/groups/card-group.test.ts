// The card-group route's group of a kind and id: a Treasures section's title and subtitle, and a kind that builds only the tree it needs.
import { describe, expect, it } from "vitest";

import { campaignTree } from "./campaign-tree";
import { cardGroupOf, type GroupSource } from "./card-group";
import { row } from "./fixtures";

const campaigns = [{ id: "the-hobbit", name: "The Hobbit", kind: "cycle" as const, position: 1 }];
const collection = [{ id: "the-hobbit", title: "The Hobbit", packs: ["OHaUH"] }];
const rows = [row({ code: "7", name: "Sting", typeCode: "treasure", packCode: "OHaUH" })];

function source(over: Partial<GroupSource>): GroupSource {
  const never = (name: string) => () => {
    throw new Error(`${name} tree built`);
  };
  return { scenario: never("scenario"), campaign: never("campaign"), ...over };
}

describe("cardGroupOf", () => {
  it("keeps Treasures as the title and leads its subtitle with the box", () => {
    const tree = campaignTree(rows, campaigns, collection, [{ code: "OHaUH", name: "Over Hill and Under Hill" }], new Map());
    const group = cardGroupOf(source({ campaign: () => tree }), "campaign", "the-hobbit~treasures~OHaUH");
    expect(group).toMatchObject({ title: "Treasures", subtitle: "Over Hill and Under Hill · The Hobbit · 1 card", count: 1 });
  });

  it("builds only the tree its kind needs", () => {
    const tree = campaignTree(rows, campaigns, collection, [{ code: "OHaUH", name: "Over Hill and Under Hill" }], new Map());
    expect(cardGroupOf(source({ campaign: () => tree }), "campaign", "nowhere")).toBeNull();
  });
});
