// Rules: rr.the-word-choose, rr.first-player, rr.neutral-cards (data/rules/entries.json); ledger line 132037:A:1. The shared words of the Wilderland set (src/play/words/wilderland-asks.ts), read on The Lonely Mountain's table as the choice sheet shows them.
import { describe, expect, it } from "vitest";

import { AUTHORED_EFFECTS } from "../../effects/authored/the-hobbit/set-wilderland.ts";
import { legalIntents } from "../../rules/engine/legal.ts";
import { revealFromTop } from "../../../test/harness/scene-kit.ts";
import { bilbo, make } from "../../../test/scenarios/the-lonely-mountain/moments.ts";

import type { Sheet, SheetNames } from "../choice/sheet-types.ts";
import { sheetFor } from "../choice/sheets.ts";
import { WILDERLAND_ASKS } from "./wilderland-asks.ts";

type Moment = ReturnType<typeof make>;

const sheetOf = (made: Moment, state: Moment["state"]): Sheet | null => {
  const names: SheetNames = { card: (id) => made.ctx.cards.get(state.cards[id]?.code ?? "")?.name ?? id, line: () => null };
  return sheetFor(state, made.ctx, legalIntents(state, made.ctx), names);
};

describe("132037:A:1 Fighting Among Friends (the Wilderland set's words): each row says how many committed characters leave the quest", () => {
  it("counts the committed non-Baggins characters outside the named sphere", () => {
    const made = make({ phase: "Quest", deck: ["132037", "f0", "f0"], heroes: [bilbo(0), "01001", "01004", "01007"], committed: ["132001", "01001", "01004", "01007"] });
    const sheet = sheetOf(made, revealFromTop(made.state, made.ctx, "132037", []).state);
    expect(sheet?.kind === "pick" ? sheet.note : "").toBe("Fighting Among Friends: name a sphere. Each committed non-Baggins character outside it is removed from the quest.");
    expect(sheet?.kind === "pick" ? sheet.options.map((option) => option.label) : []).toEqual([
      "Name Leadership: 2 characters leave the quest",
      "Name Lore: 3 characters leave the quest",
      "Name Spirit: 2 characters leave the quest",
      "Name Tactics: 2 characters leave the quest",
    ]);
  });

  it("binds each row's count to the pick of the record's own option", () => {
    const choose = AUTHORED_EFFECTS.find((effect) => effect.id === "132037:whenRevealed:1")?.instructions[0];
    expect(choose?.verb).toBe("Choose");
    const options = choose?.verb === "Choose" ? choose.options : [];
    expect(options).toHaveLength(4);
    for (const option of options) {
      const each = option.instructions[0];
      expect(each?.verb).toBe("Each");
      expect(WILDERLAND_ASKS[`132037:whenRevealed:1 @0 ${option.id}`]?.bind?.n).toEqual({ count: each?.verb === "Each" ? each.pick : null });
    }
  });
});
