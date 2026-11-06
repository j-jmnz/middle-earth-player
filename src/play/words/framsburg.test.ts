// Rules: emce.discover, emce.loot, rr.first-player (data/rules/entries.json); ledger lines 19094:A:3, 19096:A:3, 19106:A:1, 19101:A:2.
// The words of The Ghost of Framsburg's choices: the sentence over a pick, led by the player two-handed.
import { beforeAll, describe, expect, it } from "vitest";

import type { Instruction } from "../../catalog/boundary.ts";
import { CODES, framsburgTable, loadFramsburgWorld, type FramsburgWorld } from "../../../test/scenarios/the-ghost-of-framsburg/scene.ts";
import type { ChoiceNames } from "./choice.ts";
import { framsburgAsk } from "./framsburg.ts";

let world: FramsburgWorld;
beforeAll(async () => {
  world = await loadFramsburgWorld();
}, 120_000);

const names: ChoiceNames = { card: (id) => (id === "i-place" ? "Moonlit Passage" : id), code: (code) => world.cards.get(code)?.name ?? code };
const asking = (seats: 1 | 2, seat: number) => {
  const t = framsburgTable(world, { seats });
  return { game: { ...t.state, window: { kind: "choose" as const, seat, options: [], cardIds: [] } as never }, ctx: t.ctx };
};
const record = (code: string, timing: string): readonly Instruction[] => framsburgTable(world, {}).ctx.effects.filter((effect) => effect.cardCode === code && effect.timing === timing).flatMap((effect) => effect.instructions);

describe("the words of The Ghost of Framsburg", () => {
  it("19094:A:3 Crypt Key's pick names the location traveled to and what its Discover value does", () => {
    const [pick, choose] = record(CODES.cryptKey, "response");
    const solo = asking(1, 0);
    const words = framsburgAsk(pick!, CODES.cryptKey, { ...names, card: (id) => (id === CODES.cryptKey ? "Crypt Key" : "Moonlit Passage") }, choose, { ...solo, options: ["i-place"] });
    expect(words).toEqual({ verb: "Choose", prompt: "Crypt Key: choose the location you traveled to (Moonlit Passage), then add 1 to its Discover value or take 1 off it before the keyword resolves." });
    const pair = asking(2, 1);
    expect(framsburgAsk(pick!, CODES.cryptKey, { ...names, card: () => "Crypt Key" }, choose, { ...pair, options: [] })).toMatchObject({ owned: true, prompt: expect.stringMatching(/^Player 2: Crypt Key: choose the location you traveled to, then/) });
  });

  it("19096:A:3 Scatha's Teeth's pick names the amount the chosen player reduces their threat by", () => {
    const [pick, lower] = record(CODES.scathaSTeeth, "action");
    const pair = asking(2, 0);
    expect(framsburgAsk(pick!, CODES.scathaSTeeth, { ...names, card: () => "Scatha's Teeth" }, lower, { ...pair, options: ["seat:0", "seat:1"] })?.prompt).toBe("Player 1: Scatha's Teeth: choose a player to reduce their threat by 2.");
  });

  it("19106:A:1 and 19101:A:2 the Loot objective a Discover attaches, and the one an enemy guards, are chosen in a sentence of their own", () => {
    const solo = asking(1, 0);
    expect(framsburgAsk({ verb: "ResolveDiscover" }, CODES.abandonedRuins, names, undefined, { ...solo, options: [] })?.prompt).toContain("Choose 1 Loot objective to attach to the active location");
    expect(framsburgAsk({ verb: "AttachLootFromDiscard" }, CODES.forgottenCrypt, names, undefined, { ...solo, options: [] })?.prompt).toContain("Choose a Loot objective in the encounter discard pile");
    expect(framsburgAsk({ verb: "Draw", amount: 1 }, null, names, undefined, undefined)).toBeNull();
  });
});
