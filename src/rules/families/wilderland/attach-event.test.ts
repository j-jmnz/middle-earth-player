// Rules: rr.attachment-cards, rr.forced (data/rules/entries.json); ledger lines 132036:A:1, 132036:A:2.
// AttachSelf to the character an event or an attack names: Dark Bats attaches to the character it damages (Forced) and to the defending character (Shadow), and an attached Dark Bats is a Condition attachment.
import { describe, expect, it } from "vitest";

import { fightEnemy, idOf, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const table = (layout: Layout = {}) => tableFromLayout("the-battle-of-five-armies", layout);
const BATS = "132036";

describe("AttachSelf to subject and defender (132036)", () => {
  it("132036:A:1 Dark Bats that damages a defending hero attaches to it and leaves the engaged enemies", () => {
    const fought = fightEnemy(table, "f0", BATS, {}, { undefended: true });
    const bats = idOf(fought.run.state, BATS);
    expect(fought.run.state.cards[bats]?.zone).toBe("attached");
    expect(fought.run.state.cards[bats]?.host).toBe(fought.made.hero);
    expect(fought.run.state.cards[fought.made.hero]?.attachments).toContain(bats);
  });

  it("132036:A:2 as a Shadow card it attaches to the defending character", () => {
    const fought = fightEnemy(table, BATS, "f3", {});
    const bats = idOf(fought.run.state, BATS);
    expect(fought.run.state.cards[bats]?.host).toBe(fought.made.hero);
  });

  it("132036:A:2 an undefended attack has no defending character, so the Shadow card is not attached", () => {
    const fought = fightEnemy(table, BATS, "f3", {}, { undefended: true });
    expect(fought.run.state.cards[idOf(fought.run.state, BATS)]?.zone).not.toBe("attached");
  });
});
