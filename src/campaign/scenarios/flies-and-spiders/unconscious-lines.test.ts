// Rules: hob.unconscious-characters, rr.in-play-and-out-of-play (data/rules/entries.json). An unconscious character that leaves play comes back as a fresh card: the stage line 132067:B:1 bars the unconscious state, not the card. Ledger line 132067:B:1 (the stages 3B and 4B print it again).
import { expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import { moveCard } from "../../../rules/core/zones.ts";
import { givePoison, makeUnconscious, poisonOf } from "../../../rules/families/poison/poison.ts";
import { spiderTable } from "../../../../test/scenarios/flies-and-spiders/scene.ts";

it("132067:B:1 an unconscious character that leaves play (returned to hand) and returns to play is no longer unconscious", () => {
  const t = spiderTable({ seats: 1, hand: [] }, { effects: EFFECTS });
  const down = makeUnconscious(t.state, t.hero, t.ctx);
  expect(down.cards[t.hero]?.unconscious).toBe(true);
  const away = moveCard(down, t.hero, { zone: "hand", seat: 0 });
  expect(away.cards[t.hero]?.zone).toBe("hand");
  const back = moveCard(away, t.hero, { zone: "play", seat: 0 });
  expect(back.cards[t.hero]?.unconscious, "a fresh card").toBeUndefined();
});
it("132067:B:1 a character that leaves play gives its poison back to its owner's discard pile, and its unconscious state is gone with the poison", () => {
  const t = spiderTable({ seats: 1 }, { effects: EFFECTS });
  const sick = givePoison(t.state, t.hero, 2, t.ctx, []);
  expect(poisonOf(sick, t.hero)).toBe(2);
  const away = moveCard(sick, t.hero, { zone: "hand", seat: 0 });
  expect(poisonOf(away, t.hero), "no poison stays on a card that left play").toBe(0);
  expect(away.seats[0]?.discard.length, "2 poison cards in the owner's discard pile").toBe(2);
});
