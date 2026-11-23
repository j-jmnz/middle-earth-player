// Rules: rr.setup, rr.attachment-cards, rr.resource-match, rr.campaign-pool (data/rules/entries.json).
// The Adaptation boons of The Oath (ledger data/printed/mirkwood-paths.json): "Setup. Attach to a hero." (41045:A:1, 41046:A:1, 41047:A:1) as card-spec rows, and the resource icon the attached hero
// gains, "Attached hero gains the Tactics resource icon." (41045:A:2) and "Attached hero gains the Spirit resource icon." (41046:A:2), as line specs. The stand-in heroes dh1 and dh2 are Tactics, so the
// Tactics icon is read on Aragorn (a Leadership hero) put among the first seat's heroes. `cardSpecs` and `lineSpec` run each test again without the records of its line, where it must fail.
import { describe, expect } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { attachTo, spawn } from "../../../rules/core/zones.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { heroPays } from "../../../rules/player/payments.ts";
import { cardSpecs, resolve, zone, type Row } from "../../../../test/harness/card-spec.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { idOf, tableFromLayout } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "the-oath";
const MIGHT = "41045";
const POWER = "41046";
const SECRET = "41047";
const ARAGORN = "01001";

// "Setup. Attach to a hero.": the card's Setup puts it on a hero of the player.
const ROWS: readonly Row[] = [
  { line: "41045:A:1", name: "its Setup attaches The Might of Tactics to a hero", act: resolve(MIGHT, "setup"), expect: zone(MIGHT, "attached") },
  { line: "41046:A:1", name: "its Setup attaches The Power of Spirit to a hero", act: resolve(POWER, "setup"), expect: zone(POWER, "attached") },
  { line: "41047:A:1", name: "its Setup attaches The Secret of Leadership to a hero", act: resolve(SECRET, "setup"), expect: zone(SECRET, "attached") },
];

cardSpecs(SCENARIO, ROWS);

// Aragorn among the first seat's heroes with the boon attached to him: the table's state with its constants synced.
function onAragorn(code: string, effects: readonly Effect[]) {
  const made = tableFromLayout(SCENARIO, {}, { effects, extra: [ARAGORN, code] });
  const hero = spawn(made.state, ARAGORN, { zone: "heroes", seat: 0 });
  const boon = spawn(hero.state, code, { zone: "play", seat: 0 });
  return { ...made, aragorn: hero.id, state: syncConstants(attachTo(boon.state, boon.id, hero.id), made.ctx) };
}

describe("the Adaptations' resource icons (41045:A:2, 41046:A:2)", () => {
  lineSpec("41045:A:2", "the Leadership hero it is attached to pays for Tactics cards, and keeps his own icon", (effects) => {
    const made = onAragorn(MIGHT, effects);
    expect(heroPays(made.state, made.aragorn, "tactics", made.ctx)).toBe(true);
    expect(heroPays(made.state, made.aragorn, "leadership", made.ctx)).toBe(true);
    // The other heroes gain nothing: a Tactics stand-in does not pay for Leadership.
    expect(heroPays(made.state, made.hero, "leadership", made.ctx)).toBe(false);
  });

  lineSpec("41046:A:2", "the hero it is attached to pays for Spirit cards, and the other hero does not", (effects) => {
    const made = tableFromLayout(SCENARIO, { attached: [{ code: POWER, to: "dh1" }] }, { effects, extra: [POWER] });
    expect(heroPays(made.state, made.hero, "spirit", made.ctx)).toBe(true);
    expect(heroPays(made.state, made.hero2, "spirit", made.ctx)).toBe(false);
    expect(made.state.cards[idOf(made.state, POWER)]?.host).toBe(made.hero);
  });
});
