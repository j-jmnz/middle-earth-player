// Rules: dwd.durins-bane, rr.attachment-cards, rr.forced, rr.shadow-effects (data/rules/entries.json); ledger lines 04148:A:1, 04148:A:2, 04152:A:1, 04153:A:1.
// Shadow and Flame's records that need more than one row or a state a row cannot name: the attachments Whip Lash may discard and what Fiery Sword and Many Thonged Whip count as.
import { describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../../../catalog/boundary.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { countsAsAttachment, hasTrait } from "../../../rules/interpret/conditions.ts";
import { pickCandidates } from "../../../rules/interpret/pick.ts";
import { play } from "../../../../test/harness/card-spec-play.ts";
import { reveal, type Row } from "../../../../test/harness/card-spec.ts";
import { idOf } from "../../../../test/harness/scene-kit.ts";
import type { Layout } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "shadow-and-flame";
const played = (layout: Layout, act: Row["act"]) => play(SCENARIO, { line: "", layout, act, expect: [] } satisfies Row, EFFECTS as readonly Effect[], false);
const recordOf = (id: string): Effect => EFFECTS.find((effect) => effect.id === id) as Effect;
// The pick a record's instruction makes (the one inside a ForEachPlayer or the verb's own).
const pickOf = (id: string) => {
  const found = (list: readonly Instruction[]): Instruction | undefined => list.map((one) => (one.verb === "ForEachPlayer" ? found(one.instructions) : "pick" in one ? one : undefined)).find((one) => one !== undefined);
  const instruction = found(recordOf(id).instructions);
  if (!instruction || !("pick" in instruction) || !instruction.pick) throw new Error(`${id} has no pick`);
  return instruction.pick;
};

describe("Shadow and Flame attachments", () => {
  const done = played({ staging: ["04150"], attached: [{ code: "attachment", to: "dh1" }] }, [reveal("04145")]);
  const mine = idOf(done.run.state, "attachment");
  const counterSpell = idOf(done.run.state, "04145");

  it("04148:A:1 offers only the attachments the player controls, not Counter-Spell lying on Durin's Bane", () => {
    expect(done.run.state.cards[counterSpell]?.controller).toBeNull();
    expect(pickCandidates(done.run.state, pickOf("04148:whenRevealed:1"), 0, [], null, done.table.ctx)).toEqual([mine]);
  });

  it("04148:A:2 discards only the attachments the player controls, not Counter-Spell lying on Durin's Bane", () => {
    expect(pickCandidates(done.run.state, pickOf("04148:shadow:1"), 0, [], null, done.table.ctx)).toEqual([mine]);
  });

  it("04152:A:1 Fiery Sword counts as a Weapon attachment, 04153:A:1 so does Many Thonged Whip", () => {
    for (const code of ["04152", "04153"]) {
      const sworn = played({ staging: ["04150"] }, [reveal(code)]);
      const id = idOf(sworn.run.state, code);
      expect(sworn.run.state.cards[id]?.host, code).toBe(idOf(sworn.run.state, "04150"));
      expect(countsAsAttachment(sworn.run.state, id, sworn.table.ctx), code).toBe(true);
      expect(hasTrait(sworn.run.state, id, "Weapon", sworn.table.ctx), code).toBe(true);
    }
  });
});
