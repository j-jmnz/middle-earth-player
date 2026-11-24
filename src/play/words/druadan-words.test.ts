// Rules: ats.prowl, ats.prowl-example, rr.cost, rr.travel, rr.the-word-choose (data/rules/entries.json); ledger lines 06047:A:1, 06048:A:1, 06051:A:2, 06053:A:1, 06054:A:2, 06055:A:2.
// The sheets of the choices The Drúadan Forest opens, read as the table shows them (docs/design-system-table.md, Choice tray): a Prowl's discard says what is left and that it is a discard, a payment says whose pool pays, and the steps a group verb queues are worded from the record that holds the verb.
import { describe, expect, it } from "vitest";

import { legalIntents } from "../../rules/engine/legal.ts";
import { send, revealFromTop, type LayoutTable, type Run } from "../../../test/harness/scene-kit.ts";
import { CODES, table } from "../../../test/scenarios/the-druadan-forest/table.ts";
import type { Sheet, SheetNames } from "../choice/sheet-types.ts";
import { ledgerLine } from "../cards/ledger.ts";
import { sheetFor } from "../choice/sheets.ts";
import { holdsProwl } from "./group-steps.ts";

const sheetOf = (made: LayoutTable, state: Run["state"], line: SheetNames["line"]): Sheet | null => {
  const names: SheetNames = { card: (id) => made.ctx.cards.get(state.cards[id]?.code ?? "")?.name ?? state.cards[id]?.code ?? id, line };
  return sheetFor(state, made.ctx, legalIntents(state, made.ctx), names);
};

// The note and the rows of each choice a reveal opens, answered by the picks in turn (a pick may be a function of the options).
function sheets(made: LayoutTable, code: string, answers: readonly (string | ((options: readonly string[]) => string))[], line: SheetNames["line"] = () => null): { note: string; rows: string[] }[] {
  let run: Run = { state: revealFromTop(made.state, made.ctx, code, []).state, steps: [] };
  const seen: { note: string; rows: string[] }[] = [];
  for (let guard = 0; guard < 40 && run.state.window; guard += 1) {
    const window = run.state.window;
    if (window.kind !== "choose") {
      run = send(run, { type: "Pass" }, made.ctx);
      continue;
    }
    const sheet = sheetOf(made, run.state, line);
    if (sheet?.kind === "pick") seen.push({ note: sheet.note ?? "", rows: sheet.options.map((option) => option.label ?? "") });
    const answer = answers[seen.length - 1];
    if (answer === undefined) break;
    run = send(run, { type: "Choose", optionId: typeof answer === "function" ? answer(window.options) : answer }, made.ctx);
  }
  return seen;
}

describe("06047:A:1 Prowl X, the sheets", () => {
  it("06047:A:1 the first player's Choose says the discard is of his own heroes, what is left, and that he may stop; the pick after it says the same count", () => {
    const made = table({ seats: 2, heroResources: 2, phase: "Quest", deck: ["f0", "f0"] });
    const seen = sheets(made, CODES.elite, ["discard", (options) => options[0] ?? "", "stop"]);
    expect(seen[0]?.note).toBe("Player 1: Left to discard: 2. Discard 1 resource from one of your heroes, or stop and leave the rest to the players after you.");
    expect(seen[0]?.rows).toEqual(["Discard 1 resource from one of your heroes (2 left to discard)", "Stop: the players after you discard the rest"]);
    expect(seen[1]?.note).toBe("Player 1: Left to discard: 2. Choose a hero to discard 1 resource from.");
    expect(seen[2]?.note).toContain("Left to discard: 1.");
  });

  it("06048:A:1 a Prowl 1 of the Hunter counts one resource left, and the second player is asked for the rest as a discard", () => {
    const made = table({ seats: 2, heroResources: 1, phase: "Quest", deck: ["f0", "f0"] });
    const seen = sheets(made, CODES.hunter, ["stop", (options) => options[0] ?? ""]);
    expect(seen[0]?.note).toContain("Player 1: Left to discard: 1.");
  });
});

describe("06047:A:1 Prowl X, the sheets say no printed line", () => {
  it("06049:A:1 the notes of the Choose and the Pick end with the sentence: the printed \"Surge. Prowl 1.\" and \"Archery 2. Prowl X.\" lines hold other keywords and are not said after it", () => {
    for (const [code, printed] of [[CODES.thief, /Surge\./], [CODES.elite, /Archery 2\./]] as const) {
      const made = table({ seats: 1, heroResources: 1, phase: "Quest", deck: ["f0", "f0"] });
      const seen = sheets(made, code, [(options) => options[0] ?? "", (options) => options[0] ?? ""], ledgerLine);
      expect(seen.length).toBeGreaterThan(0);
      for (const one of seen) expect(one.note).not.toMatch(printed);
    }
  });

  it("06047:A:1 each row of the Choose says the count still to discard, as the dock shows the rows and not the sentence", () => {
    const made = table({ seats: 2, heroResources: 2, phase: "Quest", deck: ["f0", "f0"] });
    const seen = sheets(made, CODES.elite, ["discard"]);
    expect(seen[0]?.rows).toEqual(["Discard 1 resource from one of your heroes (2 left to discard)", "Stop: the players after you discard the rest"]);
  });
});

describe("06047:A:1 Prowl X, the sheet with no Stop row", () => {
  it("06048:A:1 alone at the table nobody comes after the player: no Stop row is offered, and the sheet says later players cannot discard the rest", () => {
    const made = table({ seats: 1, heroResources: 1, phase: "Quest", deck: ["f0", "f0"] });
    const seen = sheets(made, CODES.hunter, [(options) => options[0] ?? ""]);
    expect(seen[0]?.note).toBe("Left to discard: 1. Choose a hero to discard 1 resource from. Later players cannot discard the rest.");
  });
});

describe("the Prowl words key on the Prowl verb, not on a pick another record shares", () => {
  it("a record with the same hero Pick but no GroupDiscardResources holds no Prowl; one with the verb does, at any depth", () => {
    const pick = { verb: "Pick", pick: { type: "hero", control: "you", hasResources: true } } as const;
    const prowl = { verb: "GroupDiscardResources", amount: 2 } as const;
    expect(holdsProwl([pick, { verb: "DiscardResources", amount: 1, target: "picked" }])).toBe(false);
    expect(holdsProwl([prowl])).toBe(true);
    expect(holdsProwl([{ verb: "ForEachPlayer", order: "firstFirst", instructions: [prowl] }])).toBe(true);
  });
});

describe("06053:A:1 Men in the Dark and 06054:A:2 Stars in Sky, the sheets", () => {
  it("06053:A:1 the sheet names the hero that pays or takes the damage, and that no damage means surge", () => {
    const made = table({ seats: 1, heroResources: 1, phase: "Quest", deck: ["f0", "f0"] });
    const seen = sheets(made, CODES.menInDark, ["pay", "pay"]);
    expect(seen[0]?.note).toBe("Men in the Dark: dh1 pays 1 resource from its pool, or takes 1 damage. If no hero takes damage, Men in the Dark gains surge.");
    expect(seen[0]?.rows).toEqual(["dh1 pays 1 resource from its pool", "dh1 takes 1 damage"]);
  });

  it("06054:A:2 the sheet names the questing hero that pays or is removed from the quest", () => {
    const made = table({ seats: 1, heroResources: 1, phase: "Quest", deck: ["f0", "f0"], committed: ["dh1"] });
    const seen = sheets(made, CODES.stars, Array.from({ length: 8 }, () => (options: readonly string[]) => (options.includes("pay") ? "pay" : (options[0] ?? ""))));
    const pay = seen.find((one) => one.note.startsWith("Stars in Sky: "));
    expect(pay?.note).toBe("Stars in Sky: dh1 pays 1 resource from its pool, or is removed from the quest.");
    expect(pay?.rows).toEqual(["dh1 pays 1 resource from its pool", "Remove dh1 from the quest"]);
  });
});

describe("06055:A:2 Leaves on Tree, the sheet", () => {
  it("06055:A:2 the sheet says how many resources the player's attachments cost, from his heroes' pools, or that all are discarded", () => {
    const attached = (count: number) => Array.from({ length: count }, () => ({ code: "attachment", to: "dh1" }));
    const two = sheets(table({ seats: 1, heroResources: 2, phase: "Quest", deck: ["f0"], attached: attached(2) }), CODES.leaves, ["discard"]);
    expect(two[0]?.note).toBe("Leaves on Tree: pay 2 resources, 1 for each attachment you control, from your heroes' pools, or discard all of them.");
    expect(two[0]?.rows).toEqual(["Pay 2 resources from your heroes' pools", "Discard each attachment you control"]);
    const one = sheets(table({ seats: 1, heroResources: 2, phase: "Quest", deck: ["f0"], attached: attached(1) }), CODES.leaves, ["discard"]);
    expect(one[0]?.note).toBe("Leaves on Tree: pay 1 resource for the attachment you control, from your heroes' pools, or discard it.");
  });
});
