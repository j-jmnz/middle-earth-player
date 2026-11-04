import { describe, expect, it } from "vitest";

import { bumpDeckRevision, deckRevision, subscribeDeckRevision } from "./revision.ts";

describe("the deck revision", () => {
  it("moves on each bump and wakes only the readers still subscribed", () => {
    let woken = 0;
    const stop = subscribeDeckRevision(() => {
      woken += 1;
    });
    const before = deckRevision();
    bumpDeckRevision();
    expect(deckRevision()).toBe(before + 1);
    expect(woken).toBe(1);
    stop();
    bumpDeckRevision();
    expect(woken).toBe(1);
  });
});
