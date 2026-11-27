// Rules: rr.attachment-cards, rr.cannot, rr.restricted, rr.ownership-and-control, rr.in-play-and-out-of-play (data/rules/entries.json).
// The Battle of Carn Dûm lines a card-spec row cannot say (ledger data/printed/angmar-awakened.json): "Cannot have attachments." on both faces of Thaurdir on `attachBlocked`, the
// gate every attach passes, and Raiment of the Second Age's "Attach to a character. Restricted." played from the hand in the planning phase: on a character of any player. Each table is
// `tableFromLayout`; `lineSpec` runs the check again without the records of its line, where it must fail. Each test title starts with the line id it tests.
import { describe, expect } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { reduce } from "../../../rules/engine/reduce.ts";
import { attachBlocked } from "../../../rules/interpret/restrictions.ts";
import { lineDefault, lineSpec } from "../../../../test/harness/line-spec.ts";
import { idOf, tableFromLayout } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "the-battle-of-carn-dum";
const RAIMENT = "10191";

describe("Thaurdir (10127:A:2, 10128:A:2)", () => {
  for (const code of ["10127", "10128"]) {
    lineSpec(`${code}:A:2`, "no card can be attached to Thaurdir, a player card or an encounter card, in the staging area or engaged", (effects) => {
      for (const where of ["staging", "engaged"] as const) {
        const made = tableFromLayout(SCENARIO, { [where]: [code] }, { effects, extra: [code] });
        const thaurdir = idOf(made.state, code);
        expect(attachBlocked(made.state, made.ctx, thaurdir, "attachment"), where).toBe(true);
        expect(attachBlocked(made.state, made.ctx, thaurdir, "treachery"), where).toBe(true);
      }
    });
  }
});

// The first seat plays Raiment of the Second Age from its hand in the planning phase onto the card with `host`'s id, its first hero paying the cost of 3: whether the engine accepts it, and where it is then.
function playOnto(effects: readonly Effect[], host: (made: ReturnType<typeof tableFromLayout>) => string): { ok: boolean; hostOf: string | null | undefined; host: string } {
  const made = tableFromLayout(SCENARIO, { seats: 2, phase: "Planning", hand: [{ code: RAIMENT, seat: 0 }], play: [{ code: "ally", seat: 1 }], heroResources: 3 }, { effects, extra: [RAIMENT] });
  const hostId = host(made);
  const result = reduce(made.state, { type: "PlayCard", cardId: idOf(made.state, RAIMENT), payments: [{ heroId: made.hero, amount: 3 }], hostId }, made.ctx);
  return { ok: result.ok, hostOf: result.ok ? result.state.cards[idOf(result.state, RAIMENT)]?.host : undefined, host: hostId };
}

describe("Raiment of the Second Age (10191:A:1)", () => {
  lineDefault("10191:A:1", "it may be played on another player's hero or ally", (effects) => {
    for (const host of [(made: ReturnType<typeof tableFromLayout>) => made.seat1Hero ?? "", (made: ReturnType<typeof tableFromLayout>) => idOf(made.state, "ally")]) {
      const played = playOnto(effects, host);
      expect(played.ok).toBe(true);
      expect(played.hostOf).toBe(played.host);
    }
    // The keyword printed on the card is in its data.
    expect(tableFromLayout(SCENARIO, {}, { effects, extra: [RAIMENT] }).ctx.cards.get(RAIMENT)?.keywords.restricted).toBe(true);
  });
});
