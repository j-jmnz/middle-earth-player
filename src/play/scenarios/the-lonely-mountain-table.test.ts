// Rules: hob.burgle, rr.modifiers, rr.quest-advancement (data/rules/entries.json); ledger lines 132040:A:3, 132043:A:1, 132043:A:2, 132071:A:1 (docs/scenarios/the-hobbit.md, The Lonely Mountain, The table). What the table draws for The Lonely Mountain: the stack under the Mountain and
// Smaug the Golden's progress against 6 as top-bar dials, and the action window of a burgle attempt with its revealed card. The engine decides all of it; nothing here changes a card.
import { describe, expect, it } from "vitest";

import { legalIntents } from "../../rules/engine/legal.ts";
import { bilbo, drive, make, resolveAndDrive } from "../../../test/scenarios/the-lonely-mountain/moments.ts";

import type { SheetNames } from "../choice/sheet-types.ts";
import { sheetFor } from "../choice/sheets.ts";
import { scenarioDials } from "../readouts/scenario-dials.ts";

const TREASURES = ["132020", "132021", "132022", "132023", "132024"];
const names = (made: ReturnType<typeof make>) => (code: string): string => made.ctx.cards.get(code)?.name ?? code;
const stack = (count: number) => TREASURES.slice(0, count).map((code) => ({ code, to: "132043" }));

describe("the Lonely Mountain's stack (132071:A:1, 132043:A:1)", () => {
  it("is a dial that counts the treasure cards under the Mountain and says its Threat", () => {
    const made = make({ staging: ["132043"], under: stack(5) });
    const dial = scenarioDials(made.state, made.ctx, names(made)).find((one) => one.id === "stack");
    expect(dial).toMatchObject({ testID: "mountain-stack", label: "Stack", value: 5, limit: 5 });
    expect(dial?.note).toBe("5 treasure cards of the 5 lie facedown under The Lonely Mountain. Each lowers its Threat by 2: it is 2 now (12 printed). A successful burgle attempt takes the top one into the first player's hand.");
  });

  it("counts down as a treasure is taken, and says the Mountain is plain with none", () => {
    const three = make({ staging: ["132043"], under: stack(3) });
    expect(scenarioDials(three.state, three.ctx, names(three)).find((one) => one.id === "stack")).toMatchObject({ value: 3 });
    const none = make({ staging: ["132043"] });
    const dial = scenarioDials(none.state, none.ctx, names(none)).find((one) => one.id === "stack");
    expect(dial?.value).toBe(0);
    expect(dial?.note).toBe("No treasure card lies under The Lonely Mountain: its Threat is 12 (12 printed) and a player card can affect it.");
  });
});

describe("Smaug the Golden's progress (132040:A:3)", () => {
  const golden = (progress: number) => {
    const made = make({ staging: [{ code: "132040", progress }] });
    return scenarioDials(made.state, made.ctx, names(made)).find((one) => one.id === "golden");
  };
  it("is a warming dial against the 6th progress, near within 2 and critical within 1", () => {
    expect(golden(1)).toMatchObject({ testID: "mountain-golden", value: 1, limit: 6, warms: true });
    expect(golden(1)?.warn).toBeUndefined();
    expect(golden(4)?.warn).toEqual({ level: "near", words: "2 more progress advance the players to stage 4A" });
    expect(golden(5)?.warn).toEqual({ level: "critical", words: "1 more progress advances the players to stage 4A" });
    expect(golden(5)?.note).toBe("Smaug the Golden holds 5 of 6 progress. The 6th sends the players to stage 4A at once.");
  });
  it("is gone once Smaug the Golden is out of play, and no dial shows in another scenario", () => {
    const made = make({ stage: "132073", staging: ["132041"] });
    expect(scenarioDials(made.state, made.ctx, names(made)).filter((one) => one.id === "golden")).toEqual([]);
  });
});

describe("the action window of a burgle attempt (132043:A:2)", () => {
  it("names the revealed card, what step 3 asks and The Lonely Mountain's Action", () => {
    const made = make({ staging: ["132041", "132039", "132043"], deck: ["132044", "f0", "f0"], deckOf: ["01016", "01016", "01016"], hand: ["01016"], heroes: [bilbo(3)] });
    const window = resolveAndDrive(made, "132039", "response", {}, ["frameAction"]);
    const sheetNames: SheetNames = { card: (id) => made.ctx.cards.get(window.state.cards[id]?.code ?? "")?.name ?? id, line: () => null };
    const sheet = sheetFor(window.state, made.ctx, legalIntents(window.state, made.ctx), sheetNames);
    expect(sheet).toMatchObject({ kind: "trigger", step: "Burgle attempt", title: "A Bare Patch" });
    expect(sheet?.kind === "trigger" ? sheet.note : "").toBe("Burgle attempt, step 2: the first player's deck is shuffled and Snowbourn Scout (a leadership ally, cost 1) is revealed; it stays on the deck. Great Hall asks for 3 cards from his hand that match its card type. The Lonely Mountain: Action, spend 2 Baggins resources to take the revealed card into hand and reveal the next card.");
    expect(drive(window, made).state.window).toBeNull();
  });
});
