// Rules: rr.step-2-2, rr.step-3-2, rr.step-3-4 (data/rules/entries.json). A player side quest on the table: played, it stands in
// its player's row (its quest area), and the commit window can send the picked characters to it instead of the current quest.
import { describe, expect, it } from "vitest";

import { RECORDS } from "../../effects/authored/families/sidequests.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { play, put, questArea, questing, seat, send, sideCtx } from "../../rules/families/sidequests/fixture.ts";

import { windowSheet } from "../choice/bar-sheets.ts";
import { slotNumbers } from "../cards/card-effects.ts";
import { zoneIds } from "../store/selectors.ts";
import { dockFor } from "../choice/table-choice.ts";

const ctx = sideCtx(RECORDS);
const names = { card: (id: string) => id, line: () => null };

describe("a player side quest on the table", () => {
  it("played from the hand, it is drawn first in its player's row with its progress over its quest points", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const card = put(table.state, "09014", "hand");
    const state = play(card.state, card.id, ctx);
    const id = card.id;
    expect(state.cards[id]?.zone).toBe("seatQuest");
    expect(zoneIds(state, "play", 0)[0]).toBe(id);
    expect(slotNumbers(state, ctx, id).questPoints).toBe(4);
  });

  it("the commit window offers a button that commits the picked characters to it, and it takes their willpower", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const quest = questArea(table.state, "09014");
    const state = questing(quest.state);
    const legal = legalIntents(state, ctx);
    const sheet = windowSheet(state, ctx, legal, names);
    expect(sheet.sideQuests).toEqual([{ id: quest.id, label: quest.id }]);
    expect(sheet.note).toContain(`Or send them to ${quest.id}`);
    const hero = table.heroes[0] ?? "";
    const dock = dockFor(sheet, { key: sheet.key, ids: [hero], shares: [] }, { game: state, ctx, legal, names }, { overlay: false, passLegal: true, surface: "table", single: false, stopPass: null });
    const side = dock.secondary.find((button) => button.testID === `table-commit-side-${quest.id}`);
    expect(side?.action).toEqual({ kind: "intent", intent: { type: "Commit", cardIds: [hero], sideQuestId: quest.id } });
    const sent = send(state, { type: "Commit", cardIds: [hero], sideQuestId: quest.id }, ctx);
    expect(sent.cards[hero]?.questTo).toBe(quest.id);
  });
});
