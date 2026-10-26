// Rules: rr.triggered-ability (data/rules/entries.json). A card the app does not fully apply says so before it is paid for:
// an attachment with no record attaches and does nothing, so its confirm arms first (docs/plans/inactive-text.md).
import { describe, expect, it } from "vitest";

import { expectOk } from "../rules/fixture.ts";
import { legalIntents, reduce, startScenario, type ScenarioState } from "../rules/reduce.ts";
import { updateCard } from "../rules/state.ts";
import { spawn } from "../rules/zones.ts";
import { nextIntent } from "../../scripts/auto-player.ts";
import { RING_BEARER, starterStart, starterWorld } from "../../scripts/starter-game.ts";
import { loadPrinted } from "../../scripts/test-catalog.ts";

import { playSheet } from "./bar-sheets.ts";
import { checkFor, playCaution } from "./not-applied.ts";
import type { SheetNames } from "./sheet-types.ts";
import { choiceFor, dockFor } from "./table-choice.ts";

const WARNING = "02026";
// Dúnedain Warning's catalog text (it is not in the ledger): the table reads it from the catalog.
const WARNING_TEXT = "Attach to a hero.\nAttached hero gains +1 [defense]\n<b>Action:</b> Pay 1 resource from attached hero's pool to attach Dúnedain Warning to another hero.";
const names: SheetNames = { card: (id) => id, line: () => null, text: (code) => (code === WARNING ? WARNING_TEXT : null) };

describe("a card the app does not fully apply, before it is played", () => {
  it("words the cost by type", () => {
    const check = checkFor([]);
    expect(playCaution(WARNING, "attachment", WARNING_TEXT, 1, check)).toEqual({ words: "Its text is not applied: you pay 1 for no effect", armed: "Tap again: pay 1 for no effect" });
    expect(playCaution(WARNING, "attachment", WARNING_TEXT, 0, check)?.words).toBe("Its text is not applied: it has no effect");
    expect(playCaution("02053", "ally", "Sentinel.\nLandroval cannot have restricted attachments.", 5, check)).toEqual({ words: "Its ability is not applied: it plays with its printed numbers", armed: null });
    expect(playCaution("x", "attachment", null, 1, checkFor([{ id: "x:constant:1", cardCode: "x", lines: ["x:A:1"], timing: "constant", instructions: [] } as never]))).toBeNull();
    // An ally with no text, or only a keyword the engine reads, loses nothing: Veteran Axehand (01028, ledgered with no
    // lines), Silverlode Archer (01017, "Ranged."), and a card outside the ledger with no text.
    expect(playCaution("01028", "ally", null, 2, check)).toBeNull();
    expect(playCaution("01017", "ally", null, 3, check)).toBeNull();
    expect(playCaution("not-ledgered", "ally", null, 2, check)).toBeNull();
    expect(playCaution("not-ledgered", "ally", "Ranged.", 2, check)).toBeNull();
    expect(playCaution("not-ledgered", "ally", "Response: After this ally enters play, draw a card.", 2, check)?.words).toBe("Its ability is not applied: it plays with its printed numbers");
  });

  it("an attachment with no record asks twice before it is paid for", async () => {
    const { ctx: base } = await starterWorld("wisdom-and-wizardry");
    const ctx = { effects: base.effects, cards: new Map([...base.cards, ...(await loadPrinted([WARNING]))]) };
    let state: ScenarioState = expectOk(reduce(startScenario(starterStart("wisdom-and-wizardry", 1), ctx), { type: "Keep" }, ctx)).state;
    const policy = { scout: "", prefer: "141035", protect: RING_BEARER };
    for (let turn = 0; turn < 400 && state.mode !== "planning"; turn += 1) state = expectOk(reduce(state, nextIntent(state, ctx, policy), ctx)).state;
    const spawned = spawn(state, WARNING, { zone: "hand", seat: 0 });
    state = spawned.state;
    for (const id of state.seats[0].heroes) state = updateCard(state, id, { resources: 2 });
    const legal = legalIntents(state, ctx);
    const hosts = playSheet(state, ctx, legal, names, spawned.id);
    expect(hosts?.kind).toBe("pick");
    if (hosts?.kind !== "pick") return;
    expect(hosts.note).toContain("Its text is not applied: you pay 1 for no effect.");
    const first = hosts.options[0];
    expect(first && "next" in first).toBe(true);
    if (!first || !("next" in first)) return;
    const pay = first.next;
    expect(pay.kind).toBe("distribute");
    const table = { game: state, ctx, legal, names };
    const dock = dockFor(pay, choiceFor(pay, null), table, { overlay: true, passLegal: true, surface: "table" });
    expect(dock.primary?.arm).toBe(true);
    expect(dock.primary?.armed).toBe("Tap again: pay 1 for no effect");
  });
});
