// The card-group route's group of a kind and id: a Treasures section's title and subtitle, and a kind that builds only the tree it needs.
import { describe, expect, it } from "vitest";

import { campaignTree } from "./campaign-tree";
import { cardGroupOf, MOTK_GROUP_ID, type GroupSource } from "./card-group";
import { row } from "./fixtures";
import { MOTK_NOTE, motkHeroes } from "./motk";

const campaigns = [{ id: "the-hobbit", name: "The Hobbit", kind: "cycle" as const, position: 1 }];
const collection = [{ id: "the-hobbit", title: "The Hobbit", packs: ["OHaUH"] }];
const rows = [row({ code: "7", name: "Sting", typeCode: "treasure", packCode: "OHaUH" })];

function source(over: Partial<GroupSource>): GroupSource {
  const never = (name: string) => () => {
    throw new Error(`${name} tree built`);
  };
  return { scenario: never("scenario"), campaign: never("campaign"), motk: never("motk"), ...over };
}

describe("cardGroupOf", () => {
  it("keeps Treasures as the title and leads its subtitle with the box", () => {
    const tree = campaignTree(rows, campaigns, collection, [{ code: "OHaUH", name: "Over Hill and Under Hill" }], new Map());
    const group = cardGroupOf(source({ campaign: () => tree }), "campaign", "the-hobbit~treasures~OHaUH");
    expect(group).toMatchObject({ title: "Treasures", subtitle: "Over Hill and Under Hill · The Hobbit · 1 card", count: 1 });
  });

  it("builds only the tree its kind needs, and the heroes' group once", () => {
    const heroes = motkHeroes([row({ code: "9906114", name: "(MotK) Anborn", typeCode: "hero", packCode: "MotKA" })], new Map([["06114", "The Hunt for Gollum"]]));
    const only = source({ motk: () => heroes });
    const group = cardGroupOf(only, "motk", MOTK_GROUP_ID);
    expect(group?.subtitle).toBe(`1 card · ${MOTK_NOTE}`);
    expect(group?.groups[0]?.cards[0]?.note).toBe("Ally · The Hunt for Gollum");
    expect(cardGroupOf(only, "motk", MOTK_GROUP_ID)).toBe(group);
    expect(cardGroupOf(only, "motk", "other")).toBeNull();
  });
});
