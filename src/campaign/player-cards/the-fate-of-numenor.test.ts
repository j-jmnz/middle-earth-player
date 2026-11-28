// Rules: rr.response, rr.step-3-4, rr.search (data/rules/entries.json).
// Haleth 22140:A:1, written from its card text (data/cards/TFoN.json; data/printed holds the pack's ledger): "Response: After Haleth quests successfully,
// search the top 5 cards of your deck for an attachment and add it to your hand. Shuffle your deck."
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, send, type Table } from "../../../test/harness/scene.ts";
import { choices, playerTable, questUntil, triggers } from "../../../test/harness/player-table.ts";

const HALETH = "22140";
// Unexpected Courage and Steward of Gondor, attachments; the filler cards are not.
const ATTACHMENT = "01057";
const OTHER = "01026";
const FILLER = "card";

let base: Awaited<ReturnType<typeof starterBase>>;

// The player deck, top card first.
const deckOf = (...codes: readonly string[]) => codes.map((code) => ({ code, seat: 0 }));
const table = (effects: readonly Effect[], deck: readonly { code: string; seat: number }[]): Table =>
  playerTable(base, effects, { start: "quest", heroes: [{ code: "01001", seat: 0 }], allies: [{ code: HALETH, seat: 0 }], playerDeck: deck }, 6);

beforeAll(async () => {
  const starter = await starterBase();
  base = { ...starter, cards: new Map([...starter.cards, ...(await loadPrinted([HALETH, "01001", ATTACHMENT, OTHER]))]) };
});

// Passes until the Response window of the quest opens or the quest is over.
const quested = (tab: Table, commit: readonly string[]) => questUntil(tab, commit.map((code) => idsOf(tab, code)), (run) => triggers(run.state, tab).includes("22140:response:1"));

describe("Haleth (22140:A:1)", () => {
  const trigger = (tab: Table, run: ReturnType<typeof quested>) => send(run, { type: "Trigger", cardId: idsOf(tab, HALETH), effectId: "22140:response:1" }, tab.ctx);

  // The quest resolves and clears the live committed marks before the Response is read; the round's record of who quested answers (rr.step-3-4).
  lineSpec("22140:A:1", "after Haleth quests successfully, an attachment of the top 5 goes to the hand and the deck is shuffled", (effects) => {
    // Two attachments within the top 5, a third card below the fifth: the choice opens between the two.
    const tab = table(effects, deckOf(FILLER, ATTACHMENT, FILLER, OTHER, FILLER, FILLER, FILLER));
    const run = quested(tab, [HALETH]);
    expect(triggers(run.state, tab)).toContain("22140:response:1");
    const cursor = run.state.seedCursor;
    let next = trigger(tab, run);
    expect(next.state.window?.kind).toBe("choose");
    expect(choices(next.state, tab).sort()).toEqual([idsOf(tab, ATTACHMENT), idsOf(tab, OTHER)].sort());
    next = send(next, { type: "Choose", optionId: idsOf(tab, ATTACHMENT) }, tab.ctx);
    expect(next.state.seats[0]?.hand).toContain(idsOf(tab, ATTACHMENT));
    expect(next.state.seats[0]?.hand).not.toContain(idsOf(tab, OTHER));
    // The deck lost the one card, kept the rest, and was shuffled.
    const deck = next.state.seats[0]?.deck ?? [];
    expect(deck).toHaveLength(6);
    expect(deck).toContain(idsOf(tab, OTHER));
    expect(next.state.seedCursor).not.toBe(cursor);
  });

  // The search reads the top 5 only: an attachment below the fifth card is not found, and the deck is still shuffled (rr.search).
  it("22140:A:1 does not find an attachment below the fifth card", () => {
    const tab = table(EFFECTS, deckOf(FILLER, FILLER, FILLER, FILLER, FILLER, ATTACHMENT, OTHER));
    const run = quested(tab, [HALETH]);
    expect(triggers(run.state, tab)).toContain("22140:response:1");
    const cursor = run.state.seedCursor;
    const next = trigger(tab, run);
    expect(next.state.window?.kind).not.toBe("choose");
    expect(next.state.seats[0]?.hand).not.toContain(idsOf(tab, ATTACHMENT));
    expect(next.state.seats[0]?.hand).not.toContain(idsOf(tab, OTHER));
    expect(next.state.seats[0]?.deck).toHaveLength(7);
    expect(next.state.seedCursor).not.toBe(cursor);
  });

  // Only a quest Haleth was committed to is his: the hero's quest alone does not answer.
  it("22140:A:1 is not offered when Haleth did not quest", () => {
    const tab = table(EFFECTS, deckOf(FILLER, ATTACHMENT));
    const run = quested(tab, ["01001"]);
    expect(triggers(run.state, tab)).not.toContain("22140:response:1");
  });

  // Removed from the quest, Haleth no longer quests: the hero's successful quest does not answer for him (rr.step-3-4).
  it("22140:A:1 is not offered when Haleth was removed from the quest", () => {
    const remove: Effect = {
      id: "22140:response:removal",
      cardCode: HALETH,
      lines: ["22140:A:1"],
      timing: "response",
      trigger: "committed",
      instructions: [{ verb: "Pick", pick: { type: "character", control: "you", committed: true } }, { verb: "RemoveFromQuest" }],
    };
    const tab = table([...EFFECTS, remove], deckOf(FILLER, ATTACHMENT));
    let run = send(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, HALETH), idsOf(tab, "01001")] }, tab.ctx);
    expect(triggers(run.state, tab)).toContain("22140:response:removal");
    run = send(run, { type: "Trigger", cardId: idsOf(tab, HALETH), effectId: "22140:response:removal" }, tab.ctx);
    expect(run.state.window?.kind).toBe("choose");
    run = send(run, { type: "Choose", optionId: idsOf(tab, HALETH) }, tab.ctx);
    expect(run.state.cards[idsOf(tab, HALETH)]?.committed).toBe(false);
    for (let guard = 0; guard < 20 && run.state.mode !== "travel" && legalIntents(run.state, tab.ctx).some((intent) => intent.type === "Pass"); guard += 1) {
      expect(triggers(run.state, tab)).not.toContain("22140:response:1");
      run = send(run, { type: "Pass" }, tab.ctx);
    }
    expect(run.state.quested?.succeeded).toEqual([0]);
    expect(triggers(run.state, tab)).not.toContain("22140:response:1");
  });
});
