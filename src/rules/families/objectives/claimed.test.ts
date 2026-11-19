// Rules: rr.objective-cards, rr.attachment-cards, rr.discard-pile-and-victory-display (data/rules/entries.json); ledger lines 01108:A:2, 01109:A:2, 01110:A:2, 12071:A:1, 02063:A:2, 10110:A:2, 10112:A:2, 10114:A:2.
// A claimed objective goes back to the staging area only when its printed text returns it (Dol Guldur's three, the Gate Key); Athelas and the Rhudaur Clues print no return, count as attachments and go to the encounter discard pile with their hero.
import { describe, expect, it } from "vitest";

import { destroyCard } from "../../core/keywords.ts";
import { updateCard } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";

import { HERO, idOf, tableFromLayout } from "../../../../test/harness/scene-kit.ts";

const NO_RETURN = [["a-journey-to-rhosgobel", "02063"], ["the-treachery-of-rhudaur", "10110"], ["the-treachery-of-rhudaur", "10112"], ["the-treachery-of-rhudaur", "10114"]] as const;
// The Gate Key is tested as its reprint 110078, which copies 12071:A:1 (the original is not in the table's card map).
const RETURNS = [["escape-from-dol-guldur", "01108"], ["escape-from-dol-guldur", "01109"], ["escape-from-dol-guldur", "01110"], ["temple-of-the-deceived", "110078"]] as const;

describe("a claimed objective whose hero leaves play", () => {
  for (const [scenario, code] of NO_RETURN) {
    it(`${code} prints no return and goes to the encounter discard pile`, () => {
      const t = tableFromLayout(scenario, { attached: [{ code, to: HERO }] });
      const obj = idOf(t.state, code);
      expect(t.state.cards[obj]?.claimed).toBe(true);
      expect(destroyCard(t.state, t.hero, t.ctx.cards, []).cards[obj]?.zone).toBe("encounterDiscard");
      expect(moveCard(t.state, t.hero, { zone: "hand", seat: 0 }).cards[obj]?.zone).toBe("encounterDiscard");
    });
  }
  for (const [scenario, code] of RETURNS) {
    it(`${code} prints the return and goes to the staging area`, () => {
      const t = tableFromLayout(scenario, { attached: [{ code, to: HERO }] });
      const obj = idOf(t.state, code);
      // The island scenario's table does not deal the Gate Key as a claimed card: mark it as AttachGuarded does.
      const state = updateCard(t.state, obj, { claimed: true, controller: null });
      expect(destroyCard(state, t.hero, t.ctx.cards, []).cards[obj]?.zone).toBe("staging");
      expect(moveCard(state, t.hero, { zone: "hand", seat: 0 }).cards[obj]?.zone).toBe("staging");
    });
  }
});
