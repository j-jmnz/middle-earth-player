// Rules: hob.burgle, hob.burgle-example, rr.first-player (data/rules/entries.json); ledger lines 132042:A:3, 132044:A:2. The words of the choices step 3 of a burgle attempt opens (docs/design-system-table.md, Choice tray): the Choose between discarding the matching cards and declining, and the pick of each card:
// the effect's card leads, the player leads two-handed, and the number, the revealed card and what the discards must match are said.
import { describe, expect, it } from "vitest";

import { legalIntents } from "../../rules/engine/legal.ts";
import { send } from "../../../test/harness/scene-kit.ts";
import { announceAndDrive, bilbo, drive, make, resolveAndDrive } from "../../../test/scenarios/the-lonely-mountain/moments.ts";

import type { Sheet, SheetNames } from "./sheet-types.ts";
import { sheetFor } from "./sheets.ts";

type Moment = ReturnType<typeof make>;

const sheetOf = (made: Moment, state: Moment["state"]): Sheet | null => {
  const names: SheetNames = { card: (id) => made.ctx.cards.get(state.cards[id]?.code ?? "")?.name ?? id, line: () => null };
  return sheetFor(state, made.ctx, legalIntents(state, made.ctx), names);
};

function attempt(effect: string, seats: 1 | 2) {
  const made = make({ seats, staging: ["132041", "132039"], deck: [effect, "f0", "f0"], deckOf: ["01016", "01016", "01016"], hand: ["01016", "01028", "02102", "01048"], heroes: [bilbo(0)] });
  const choose = drive(resolveAndDrive(made, "132039", "response", {}, ["frameAction"]), made, {}, ["choose"]);
  return { made, choose };
}

describe("132044:A:2 Great Hall burgle: the words of step 3", () => {
  it("the Choose names the card with the effect, the revealed card, the number to discard and what it must match, and each row says what it does", () => {
    const { made, choose } = attempt("132044", 1);
    const sheet = sheetOf(made, choose.state);
    expect(sheet?.kind === "pick" ? sheet.note : "").toBe("Great Hall: burgle attempt. The revealed card is Snowbourn Scout. As the first player, discard 3 cards from your hand that match its card type, or decline and the attempt fails.");
    expect(sheet?.kind === "pick" ? sheet.options.map((option) => option.label) : []).toEqual(["Discard 3 cards that match the revealed Snowbourn Scout in card type, then A Bare Patch attaches to Smaug the Magnificent", "Decline the attempt: the burgle fails and nothing is discarded"]);
  });

  it("the Pick says which card of how many, solo and two-handed", () => {
    const solo = attempt("132044", 1);
    const first = sheetOf(solo.made, send(solo.choose, { type: "Choose", optionId: "discard" }, solo.made.ctx).state);
    expect(first?.kind === "pick" ? first.note : "").toBe("Great Hall: burgle attempt, card 1 of 3. Choose a card from your hand to discard that matches the revealed Snowbourn Scout in its card type.");
    const two = attempt("132044", 2);
    const asked = sheetOf(two.made, send(two.choose, { type: "Choose", optionId: "discard" }, two.made.ctx).state);
    expect(asked?.kind === "pick" ? asked.note : "").toBe("Player 1, Great Hall: burgle attempt, card 1 of 3. Choose a card from your hand to discard that matches the revealed Snowbourn Scout in its card type.");
    expect(asked?.kind === "pick" ? asked.verb : "").toBe("Discard");
  });
});

describe("132042:A:3 Croaking Crows burgle: the words say the traits it names", () => {
  it("names sphere and card type", () => {
    const { made, choose } = attempt("132042", 1);
    const sheet = sheetOf(made, choose.state);
    expect(sheet?.kind === "pick" ? sheet.note : "").toBe("Croaking Crows: burgle attempt. The revealed card is Snowbourn Scout. As the first player, discard 1 card from your hand that matches its sphere and card type, or decline and the attempt fails.");
  });
});

describe("132072:B:1 and B:2 The Burglar's Turn: the rows say what follows the attempt", () => {
  it("a success takes the top treasure card, a refusal has Smaug the Golden attack the first player", () => {
    const treasures = ["132020", "132021", "132022", "132023", "132024"].map((code) => ({ code, to: "132043" }));
    const made = make({ stage: "132072", staging: [{ code: "132040" }, "132043"], setAside: ["132041", "132039"], under: treasures, deck: ["132042", "f0", "f0"], deckOf: ["01016", "01016", "01016"], hand: ["01016"], heroes: [bilbo(0)] });
    const choose = announceAndDrive(made, { trigger: "questSucceeded" }, {}, ["choose"]);
    const sheet = sheetOf(made, choose.state);
    expect(sheet?.kind === "pick" ? sheet.options.map((option) => option.label) : []).toEqual([
      "Discard 1 card that matches the revealed Snowbourn Scout in sphere and card type, then take the top treasure card from under The Lonely Mountain into your hand",
      "Decline the attempt: the burgle fails and nothing is discarded, then Smaug the Golden attacks the first player",
    ]);
  });
});
