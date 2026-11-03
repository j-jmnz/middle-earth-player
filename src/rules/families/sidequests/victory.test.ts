// Rules: rr.discard-pile-and-victory-display, rr.victory, rr.limits, rr.resource-match (data/rules/entries.json).
// The victory display: copies a card limits, the constants of the side quests in it, and the cards that count what is in it.
import { describe, expect, it } from "vitest";

import { RECORDS } from "../../../effects/authored/families/sidequests.ts";
import { playCost } from "../../attach.ts";
import { heldStat, NO_COUNTS } from "../../constants.ts";
import { modifiedStat } from "../../keywords.ts";
import { stagingThreat } from "../../quest.ts";
import { reduce } from "../../reduce.ts";
import { updateCard } from "../../state.ts";
import { inVictory, play, put, questArea, seat, sideCtx, synced, toVictory } from "./fixture.ts";
import { defeatSideQuest } from "./quest.ts";
import { addToVictory } from "./victory.ts";

const ctx = sideCtx(RECORDS);

describe("the copies a card limits in the victory display", () => {
  it("Rally the West holds one copy: a second one defeated goes to its owner's discard pile (17087:A:1)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const first = inVictory(table.state, "17087", ctx);
    const second = questArea(first.state, "17087");
    const state = defeatSideQuest(updateCard(second.state, second.id, { progress: 6 }), second.id, ctx, []);
    expect(state.victory).toEqual([first.id]);
    expect(state.cards[second.id]?.zone).toBe("discard");
    expect(state.seats[0].discard).toContain(second.id);
  });

  it("Leave No Trace holds three (10035:A:1)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    let state = table.state;
    const ids: string[] = [];
    for (let copy = 0; copy < 4; copy += 1) {
      const made = put(state, "10035", "hand");
      state = addToVictory(made.state, made.id, ctx);
      ids.push(made.id);
    }
    expect(state.victory).toEqual(ids.slice(0, 3));
    expect(state.cards[ids[3] ?? ""]?.zone).toBe("discard");
  });
});

describe("a side quest in the victory display", () => {
  it("Rally the West gives each hero +1 Willpower, only from there (17087:A:1)", () => {
    const table = seat(2, ["dwarf", "rohan"]);
    const base = modifiedStat(table.state, table.state.cards[table.heroes[0] ?? ""]!, "willpower", ctx.cards);
    const waiting = questArea(table.state, "17087");
    const before = synced(waiting.state, ctx);
    for (const id of table.heroes) expect(modifiedStat(before, before.cards[id]!, "willpower", ctx.cards)).toBe(base);
    const shown = inVictory(table.state, "17087", ctx).state;
    for (const id of table.heroes) expect(modifiedStat(shown, shown.cards[id]!, "willpower", ctx.cards)).toBe(base + 1);
  });

  it("Prepare for Battle: the first player draws an additional card in the resource phase (17003:A:2)", () => {
    const table = seat(2, ["dwarf", "rohan"]);
    const shown = inVictory({ ...table.state, firstPlayer: 1 }, "17003", ctx).state;
    expect(heldStat(shown, 1, "extraDraw", NO_COUNTS)).toBe(1);
    expect(heldStat(shown, 0, "extraDraw", NO_COUNTS)).toBe(0);
  });

  it("Explore Secret Ways: staging locations with the active location's title do not add their Threat (17036:A:2)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const active = put(table.state, "marsh", "activeLocation");
    const same = put(active.state, "marsh", "staging");
    const other = put(same.state, "ford", "staging");
    const orc = put(other.state, "orc", "staging");
    expect(stagingThreat(synced(orc.state, ctx), ctx.cards)).toBe(2 + 1 + 2);
    const shown = inVictory(orc.state, "17036", ctx).state;
    expect(stagingThreat(shown, ctx.cards)).toBe(1 + 2);
  });

  it("Keep Watch: each non-unique enemy engaged with a player gets -1 Attack (17059:A:2)", () => {
    const table = seat(2, ["dwarf", "rohan"]);
    const wolf = put(table.state, "wolf", "engaged", 1);
    const staged = put(wolf.state, "wolf2", "staging");
    const shown = inVictory(staged.state, "17059", ctx).state;
    expect(modifiedStat(shown, shown.cards[wolf.id]!, "attack", ctx.cards)).toBe(1);
    expect(modifiedStat(shown, shown.cards[staged.id]!, "attack", ctx.cards)).toBe(2);
  });

  it("The Storm Comes: the first ally each player plays each round needs no resource match (16013:A:2)", () => {
    const table = seat(2, ["dwarf", "rohan"]);
    const eagle = put(table.state, "eagle", "hand", 0);
    const second = put(eagle.state, "eagle", "hand", 0);
    const pay = (hero: number) => [{ heroId: table.heroes[hero] ?? "", amount: 2 }];
    // Eagle Scout is Tactics: neither Leadership nor Spirit hero may pay for it.
    expect(reduce(synced(second.state, ctx), { type: "PlayCard", cardId: eagle.id, payments: pay(0) }, ctx).ok).toBe(false);
    const shown = inVictory(second.state, "16013", ctx).state;
    const played = play(shown, eagle.id, ctx, pay(0));
    expect(played.cards[eagle.id]?.zone).toBe("play");
    // Only the first ally of the round.
    expect(reduce(synced(played, ctx), { type: "PlayCard", cardId: second.id, payments: pay(1) }, ctx).ok).toBe(false);
  });
});

describe("cards that read the victory display", () => {
  it("Keen as Lances costs 1 less for each card worth no victory points in the victory display (10037:A:1)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const lances = put(table.state, "10037", "hand");
    const worthless = put(lances.state, "wolf", "staging");
    const worth = put(worthless.state, "forest-orc", "staging");
    const filled = toVictory(toVictory(worth.state, worthless.id), worth.id);
    expect(playCost(synced(filled, ctx), lances.id, 0, ctx)).toBe(4);
    expect(playCost(synced(worth.state, ctx), lances.id, 0, ctx)).toBe(5);
  });

  it("Dour Handed deals damage to an engaged enemy for each side quest in the victory display (16009:A:1)", () => {
    const table = seat(1, ["gondor", "rohan"]);
    const orc = put(table.state, "orc", "engaged", 0);
    const quests = inVictory(inVictory(orc.state, "10034", ctx).state, "09014", ctx);
    const event = put(quests.state, "16009", "hand");
    const state = play(event.state, event.id, ctx, [{ heroId: table.heroes[0] ?? "", amount: 1 }]);
    expect(state.cards[orc.id]?.damage).toBe(2);
  });
});
