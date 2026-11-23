// Rules: hob.burgle, rr.modifiers, rr.quest-advancement (data/rules/entries.json); ledger lines 132040:A:3, 132043:A:1, 132043:A:2, 132071:A:1 (docs/scenarios/the-hobbit/the-lonely-mountain.md, The Lonely Mountain, The table). What the table draws for The Lonely Mountain: the stack under the Mountain and
// Smaug the Golden's progress against 6 as top-bar dials, and the action window of a burgle attempt with its revealed card. The engine decides all of it; nothing here changes a card.
import { describe, expect, it } from "vitest";

import { legalIntents } from "../../rules/engine/legal.ts";
import { idOf } from "../../../test/harness/scene-kit.ts";
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
    expect(dial).toMatchObject({ testID: "mountain-stack", label: "Stack", value: 5, limit: 5, limitWords: "The Setup stacks 5 treasure cards", cardId: idOf(made.state, "132043") });
    expect(dial?.note).toBe("5 treasure cards of the 5 lie facedown under The Lonely Mountain. Each lowers its Threat by 2: it is 2 now (12 printed). The top one is the prize of a successful burgle attempt at The Burglar's Turn");
  });

  it("counts down as a treasure is taken, and says the Mountain is plain with none", () => {
    const three = make({ staging: ["132043"], under: stack(3) });
    expect(scenarioDials(three.state, three.ctx, names(three)).find((one) => one.id === "stack")).toMatchObject({ value: 3 });
    const none = make({ staging: ["132043"] });
    const dial = scenarioDials(none.state, none.ctx, names(none)).find((one) => one.id === "stack");
    expect(dial?.value).toBe(0);
    expect(dial?.note).toBe("No treasure card lies under The Lonely Mountain: its Threat is 12 (12 printed) and a player card can affect it");
  });
});

describe("Smaug the Golden's progress (132040:A:3)", () => {
  const golden = (progress: number) => {
    const made = make({ staging: [{ code: "132040", progress }] });
    return scenarioDials(made.state, made.ctx, names(made)).find((one) => one.id === "golden");
  };
  it("is a warming dial against the 6th progress, near within 2 and critical within 1", () => {
    const made = make({ staging: [{ code: "132040", progress: 1 }] });
    expect(golden(1)).toMatchObject({ testID: "mountain-golden", value: 1, limit: 6, warms: true, limitWords: "At 6 progress the players advance to stage 4A", cardId: idOf(made.state, "132040") });
    expect(golden(1)?.warn).toBeUndefined();
    expect(golden(4)?.warn).toEqual({ level: "near", words: "2 more progress advance the players to stage 4A" });
    expect(golden(5)?.warn).toEqual({ level: "critical", words: "1 more progress advances the players to stage 4A" });
    expect(golden(5)?.note).toBeUndefined();
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
    expect(sheet?.kind === "trigger" ? sheet.note : "").toBe("Burgle attempt, step 2: the first player's deck is shuffled and Snowbourn Scout (a leadership ally, cost 1) is revealed; it stays on the deck. Great Hall asks for 3 cards from the first player's hand that match its card type. The Lonely Mountain: Action, spend 2 Baggins resources to take the revealed card into hand and reveal the next card.");
    // Read opens the revealed card, which the discards must match.
    const burgle = window.state.stack.find((entry) => entry.data.kind === "burgle");
    expect(sheet?.kind === "trigger" ? sheet.sourceId : null).toBe((burgle?.data.kind === "burgle" ? burgle.data.revealedId : null) ?? "none");
    // Read offers the revealed card first and the card that makes the attempt (A Bare Patch) second.
    const revealedId = burgle?.data.kind === "burgle" ? burgle.data.revealedId : "none";
    expect(sheet?.kind === "trigger" ? sheet.about : null).toEqual([revealedId, burgle?.cardId]);
    expect(window.state.cards[burgle?.cardId ?? ""]?.code).toBe("132039");
    expect(drive(window, made).state.window).toBeNull();
  });

  const note = (made: ReturnType<typeof make>, window: ReturnType<typeof resolveAndDrive>): string => {
    const sheetNames: SheetNames = { card: (id) => made.ctx.cards.get(window.state.cards[id]?.code ?? "")?.name ?? id, line: () => null };
    const sheet = sheetFor(window.state, made.ctx, legalIntents(window.state, made.ctx), sheetNames);
    return sheet?.kind === "trigger" ? (sheet.note ?? "") : "";
  };
  it("says why the Action cannot be used: too few Baggins resources, or no revealed card left", () => {
    const poor = make({ staging: ["132041", "132039", "132043"], deck: ["132044", "f0", "f0"], deckOf: ["01016", "01016", "01016"], hand: ["01016"], heroes: [bilbo(1)] });
    expect(note(poor, resolveAndDrive(poor, "132039", "response", {}, ["frameAction"]))).toContain("Not available now: Bilbo Baggins has 1 Baggins resource.");
    const none = make({ staging: ["132041", "132039", "132043"], deck: ["132044", "f0", "f0"], deckOf: ["01016", "01016", "01016"], hand: ["01016"], heroes: [bilbo(0)] });
    expect(note(none, resolveAndDrive(none, "132039", "response", {}, ["frameAction"]))).toContain("Not available now: Bilbo Baggins has no Baggins resources.");
    const rich = make({ staging: ["132041", "132039", "132043"], deck: ["132044", "f0", "f0"], deckOf: ["01016", "01016", "01016"], hand: ["01016"], heroes: [bilbo(2)] });
    expect(note(rich, resolveAndDrive(rich, "132039", "response", {}, ["frameAction"]))).not.toContain("Not available");
  });
  it("names the first player when two play", () => {
    const made = make({ seats: 2, staging: ["132041", "132039"], deck: ["132044", "f0", "f0"], deckOf: ["01016", "01016", "01016"], hand: ["01016"], heroes: [bilbo(0)] });
    const text = note(made, resolveAndDrive(made, "132039", "response", {}, ["frameAction"]));
    expect(text).toContain("Player 1's deck is shuffled");
    expect(text).toContain("from Player 1's hand");
    expect(text).not.toContain("his ");
  });
});
