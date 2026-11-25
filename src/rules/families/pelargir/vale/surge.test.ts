// Rules: rr.surge, rr.running-out-of-cards, faq.last-encounter-card, ats.captain-enemies (data/rules/entries.json); ledger lines 06159:A:1, 06159:A:2, 06160:A:1, 06147:A:3
// The surge chains of The Morgul Vale's own deck, revealed for real in the staging step: The Dead City Looms with no token on To the Tower changes nothing on a pass, so its chain ends at the card it is the last of; Terror Drives Them
// places a token on each pass, so its chain runs on by the rules to the letter and ends at the tenth token, when the players lose.
import { describe, expect, it } from "vitest";

import { reduce } from "../../../engine/reduce.ts";
import { expectOk } from "../../../core/test-fixture.ts";
import { CODES, opened, table, tokens } from "../../../../../test/scenarios/the-morgul-vale/table.ts";
import { inOwnSurgeChain } from "../surge-chain.ts";

const { tower, murzag, deadCity, terror, tracker } = CODES;

describe("a surge chain in The Morgul Vale", () => {
  const quest = (deck: readonly string[], discard: readonly string[] = [], progress = 0) => {
    const t = table({ phase: "Quest", staging: [{ code: tower, progress }, murzag], deck, discard });
    return { t, start: opened(t) };
  };

  it("ends at The Dead City Looms when it is the only card left and no token lies on To the Tower: the reveal does not loop", () => {
    const { t, start } = quest([deadCity]);
    const revealed = expectOk(reduce(start.state, { type: "Pass" }, t.ctx));
    expect(revealed.steps.filter((step) => step.kind === "reveal")).toHaveLength(1);
    // The reset that follows the last reveal (faq.last-encounter-card) puts it back in the deck for the next round.
    expect(revealed.state.encounterDeck.map((id) => revealed.state.cards[id]?.code)).toEqual([deadCity]);
    expect(revealed.state.lost).toBe(false);
  });

  it("goes on past a Dead City Looms with other cards behind it: the discard pile is shuffled back and the next card is revealed (rr.running-out-of-cards)", () => {
    const { t, start } = quest([deadCity], [tracker]);
    const revealed = expectOk(reduce(start.state, { type: "Pass" }, t.ctx));
    expect(revealed.steps.filter((step) => step.kind === "reveal").length).toBeGreaterThanOrEqual(2);
  });

  it("does not guard Terror Drives Them: each pass places a token, so the chain runs on to the tenth token and the players lose (06147:A:3)", () => {
    const { t, start } = quest([terror]);
    const revealed = expectOk(reduce(start.state, { type: "Pass" }, t.ctx));
    expect(tokens(revealed.state)).toBe(10);
    expect(revealed.state.lost).toBe(true);
    expect(revealed.state.lossReason).toMatch(/10 progress tokens/);
  });

  it("answers false for Terror Drives Them in the discard pile whatever else is there, and for a card the chain has not opened", () => {
    const { t, start } = quest([], [terror]);
    expect(inOwnSurgeChain(start.state, t.ctx)).toBe(false);
    const idle = quest([], [deadCity]);
    expect(inOwnSurgeChain(idle.start.state, idle.t.ctx)).toBe(false);
  });
});
