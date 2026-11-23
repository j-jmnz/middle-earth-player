// Rules: rr.attachment-cards, rr.restricted, rr.ownership-and-control (data/rules/entries.json).
// The boons of Escape from Mount Gram (ledger data/printed/angmar-awakened.json): "Attach to a hero. Restricted." on Chieftain's Brooch, Mail of Eärnur and Silverthorn,
// played from the hand in the planning phase: on any player's hero, never on an ally. Each table is `tableFromLayout`; `lineSpec` runs the check again without the records of its line, where it must fail. Each test title starts with the line id it tests.
import { describe, expect } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { reduce } from "../../../rules/engine/reduce.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { idOf, tableFromLayout } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "escape-from-mount-gram";
const BOONS = ["10177", "10180", "10181"] as const;

// The first seat plays the boon from its hand in the planning phase onto the card with `host`'s id, its first hero paying the printed cost: whether the engine accepts it, and where the boon is then.
function playOnto(code: string, effects: readonly Effect[], host: (made: ReturnType<typeof tableFromLayout>) => string): { ok: boolean; hostOf: string | null | undefined; host: string } {
  const made = tableFromLayout(SCENARIO, { seats: 2, phase: "Planning", hand: [{ code, seat: 0 }], play: ["ally"], heroResources: 3 }, { effects, extra: [code] });
  const hostId = host(made);
  const cost = made.ctx.cards.get(code)?.cost ?? 0;
  const result = reduce(made.state, { type: "PlayCard", cardId: idOf(made.state, code), payments: cost > 0 ? [{ heroId: made.hero, amount: cost }] : [], hostId }, made.ctx);
  return { ok: result.ok, hostOf: result.ok ? result.state.cards[idOf(result.state, code)]?.host : undefined, host: hostId };
}

describe("Attach to a hero. Restricted. (10177:A:1, 10180:A:1, 10181:A:1)", () => {
  for (const code of BOONS) {
    lineSpec(`${code}:A:1`, "the boon may be played on another player's hero and not on an ally", (effects) => {
      const other = playOnto(code, effects, (made) => made.seat1Hero ?? "");
      expect(other.ok).toBe(true);
      expect(other.hostOf).toBe(other.host);
      expect(playOnto(code, effects, (made) => idOf(made.state, "ally")).ok).toBe(false);
      // The keyword printed on the card is in its data.
      expect(tableFromLayout(SCENARIO, {}, { effects, extra: [code] }).ctx.cards.get(code)?.keywords.restricted).toBe(true);
    });
  }
});
