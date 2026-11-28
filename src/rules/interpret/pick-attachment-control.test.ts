// Rules: rr.attachment-cards (data/rules/entries.json); "an attachment you control" (shadow lines of 142071:A:3, 50919:A:3, 50727:A:2 and the like).
// A player controls the player cards he plays and no encounter card: an encounter attachment on an enemy engaged with him is not "an attachment you control".
import { describe, expect, it } from "vitest";

import type { PickSpec } from "../../catalog/boundary.ts";
import { updateCard } from "../core/state.ts";
import { pickCandidates } from "./pick.ts";
import { idOf, tableFromLayout } from "../../../test/harness/scene-kit.ts";

const YOU: PickSpec = { type: "attachment", control: "you" };
const OTHER: PickSpec = { type: "attachment", control: "other" };
const ANY: PickSpec = { type: "attachment", control: "any" };

function scene() {
  const t = tableFromLayout("the-thing-in-the-depths", {
    seats: 2,
    engaged: [{ code: "f0", seat: 0 }],
    attached: [{ code: "attachment", to: "f0", encounter: true }, { code: "attachment", to: "dh1" }],
  });
  const ids = Object.values(t.state.cards).filter((card) => card.code === "attachment").map((card) => card.id);
  const encounter = ids.find((id) => t.state.cards[id]?.controller == null) ?? "";
  const player = ids.find((id) => t.state.cards[id]?.controller != null) ?? "";
  return { t, encounter, player };
}
const pick = (t: ReturnType<typeof scene>["t"], spec: PickSpec, seat: number) => pickCandidates(t.state, spec, seat, [], null, t.ctx);

describe("an attachment you control (rr.attachment-cards)", () => {
  it("leaves out an encounter attachment on an enemy engaged with the player", () => {
    const { t, encounter, player } = scene();
    expect(encounter).not.toBe("");
    expect(pick(t, YOU, 0)).toEqual([player]);
    expect(pick(t, ANY, 0)).toContain(encounter);
  });

  it("offers a player attachment on his own hero", () => {
    const { t, player } = scene();
    expect(pick(t, YOU, 0)).toContain(player);
    expect(pick(t, OTHER, 0)).not.toContain(player);
  });

  it("gives an attachment on another player's hero to the player who played it", () => {
    const { t, encounter, player } = scene();
    const moved = updateCard(t.state, player, { host: idOf(t.state, "dh3") });
    const t2 = { ...t, state: moved };
    expect(pick(t2, YOU, 0)).toEqual([player]);
    expect(pick(t2, YOU, 1)).not.toContain(player);
    expect(pick(t2, YOU, 1)).not.toContain(encounter);
    expect(pick(t2, OTHER, 1)).toContain(player);
  });
});
