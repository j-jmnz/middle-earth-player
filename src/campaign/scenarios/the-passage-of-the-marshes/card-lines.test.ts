// Rules: rr.attachment-cards, rr.cannot, rr.first-player, rr.ownership-and-control, rr.in-play-and-out-of-play, mec112.saga-staging-rules (data/rules/entries.json).
// The Passage of the Marshes lines a card-spec row cannot say (ledger data/printed/the-two-towers.json): Morgul Wraith's "Cannot have non-Morgul attachments." on `attachBlocked`, the gate
// every attach passes, and The One Ring's "Attached hero does not count against the hero limit. The first player gains control of attached hero." with two seats. Each table is
// `tableFromLayout`; `lineSpec` runs the check again without the records of its line, where it must fail. Each test title starts with the line id it tests.
import { describe, expect } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { attachBlocked, heroLimitExempt } from "../../../rules/interpret/restrictions.ts";
import { fireForced } from "../../../rules/windows/triggers.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { finish, idOf, tableFromLayout } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "the-passage-of-the-marshes";
const MORGUL_WRAITH = "144053";
const RING = "144063";
const PALE_BLADE = "141070"; // a Morgul treachery that attaches to an enemy (A Knife in the Dark)

describe("Morgul Wraith (144053:A:1)", () => {
  lineSpec("144053:A:1", "a non-Morgul attachment cannot attach to it in the staging area or engaged, a Morgul card can", (effects) => {
    for (const where of ["staging", "engaged"] as const) {
      const made = tableFromLayout(SCENARIO, { [where]: [MORGUL_WRAITH] }, { effects, extra: [PALE_BLADE] });
      const wraith = idOf(made.state, MORGUL_WRAITH);
      expect(attachBlocked(made.state, made.ctx, wraith, "attachment"), where).toBe(true);
      expect(attachBlocked(made.state, made.ctx, wraith, "treachery"), where).toBe(true);
      expect(attachBlocked(made.state, made.ctx, wraith, PALE_BLADE), where).toBe(false);
    }
  });
});

// Two seats, The One Ring on the first seat's first hero, and the first-player token on the second seat.
const ringTable = (effects: readonly Effect[]) => tableFromLayout(SCENARIO, { seats: 2, firstPlayer: 1, attached: [{ code: RING, to: "dh1" }] }, { effects });

describe("The One Ring (144063:A:2)", () => {
  lineSpec("144063:A:2", "when the first-player token passes, the Ring-bearer, his pool and his attachments pass to the new first player", (effects) => {
    const made = ringTable(effects);
    const ring = idOf(made.state, RING);
    const steps: EngineStep[] = [];
    const passed = finish({ state: settle(fireForced({ ...made.state, window: null }, { trigger: "firstPlayerTokenPassed", seat: 1 }, made.ctx, steps), made.ctx, steps), steps }, made.ctx).state;
    expect(passed.seats[1]?.heroes).toContain(made.hero);
    expect(passed.seats[0]?.heroes).not.toContain(made.hero);
    expect(passed.cards[made.hero]?.controller).toBe(1);
    expect(passed.cards[ring]?.host).toBe(made.hero);
    // The first seat's other hero stays with it.
    expect(passed.seats[0]?.heroes).toContain(made.hero2);
  });

  lineSpec("144063:A:2", "the Ring-bearer does not count against the hero limit, and the other heroes do", (effects) => {
    const made = ringTable(effects);
    expect(heroLimitExempt(made.state, made.ctx, made.hero)).toBe(true);
    expect(heroLimitExempt(made.state, made.ctx, made.hero2)).toBe(false);
    expect(heroLimitExempt(made.state, made.ctx, made.seat1Hero ?? "")).toBe(false);
  });
});
