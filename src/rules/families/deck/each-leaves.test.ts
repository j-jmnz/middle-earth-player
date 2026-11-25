// Rules: rr.cannot, rr.in-play-and-out-of-play, ats.captain-enemies (data/rules/entries.json); ledger line 06144:B:1.
// An Each with `upTo` whose instructions take the picked card out of play leaves out a card that cannot leave play (`leaves` of the pick filter, from `leavesPlayPicked`): with Murzag and the Tracker in the staging area only the Tracker is offered, and an Each that only damages offers both. Test-only records on To the Tower, whose When Revealed resolves through the scene kit.
import { describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../../../catalog/boundary.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { idOf, opened, resolveRecords } from "../../../../test/harness/scene-kit.ts";
import { CODES, table } from "../../../../test/scenarios/the-morgul-vale/table.ts";

const { tower, murzag, tracker } = CODES;
const ENEMIES = { type: "enemy", control: "any", staging: true } as const;
const record = (id: string, instruction: Instruction): Effect => ({ id, cardCode: tower, lines: ["06147:A:1"], timing: "whenRevealed", instructions: [instruction] });
const DISCARD = record("test:each-discard", { verb: "Each", pick: ENEMIES, upTo: "any", instructions: [{ verb: "DiscardPicked" }] });
const HURT = record("test:each-hurt", { verb: "Each", pick: ENEMIES, upTo: "any", instructions: [{ verb: "DamageCard", amount: 1, target: "picked" }] });

describe("Each upTo with a leaving verb (leaves)", () => {
  it("offers only the card that can leave play when the instructions discard the picked card, and both when they only damage it", () => {
    const made = (extra: Effect) => table({ staging: [tower, murzag, tracker] }, [...EFFECTS.filter((effect) => effect.cardCode !== tower || effect.timing !== "whenRevealed"), extra]);
    const offered = (extra: Effect): readonly string[] => {
      const t = made(extra);
      const state = opened(t).state;
      const seen: string[] = [];
      resolveRecords(state, t.ctx, tower, "whenRevealed", idOf(state, tower), (at) => {
        if (at.window?.kind === "choose") seen.push(...at.window.options.filter((option) => option !== "done"));
        return "done";
      });
      return seen;
    };
    const t = made(DISCARD);
    const state = opened(t).state;
    expect(offered(DISCARD)).toEqual([idOf(state, tracker)]);
    expect(offered(HURT)).toEqual(expect.arrayContaining([idOf(state, tracker), idOf(state, murzag)]));
  });
});
