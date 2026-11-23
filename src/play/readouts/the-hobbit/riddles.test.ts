// Rules: hob.riddle-area, hob.riddles (data/rules/entries.json); docs/scenarios/the-hobbit/dungeons-deep-and-caverns-dim.md (Dungeons Deep and Caverns Dim); ledger lines 131030:A:1, 131030:B:2, 131030:B:3, 131031:B:1.
// The riddle area on the table: the dial of stage 2 with its progress against 9 (the players' way out, so it never warms), a tap that shows the stage and Gollum, and the mark Bilbo's seat wears while he is in the area.
import { describe, expect, it } from "vitest";

import { settle } from "../../../rules/engine/machine.ts";
import { stagingThreat } from "../../../rules/quest/quest.ts";
import { combatPairs, zoneIds } from "../../store/selectors.ts";
import { readoutFor } from "../readout.ts";
import { updateCard } from "../../../rules/core/state.ts";
import { riddleTable } from "../../../rules/families/riddles/fixture.ts";
import { idOf, revealFromTop, send } from "../../../../test/harness/scene-kit.ts";
import { dialProps } from "../dials.ts";
import { riddleDials, riddleHands, stagingThreatNow } from "./riddles.ts";

const NAMES: Readonly<Record<string, string>> = { "131030": "Riddles in the Dark" };
const nameOf = (code: string) => NAMES[code] ?? code;

describe("the riddle area dial", () => {
  it("131030:B:2 counts the progress on stage 2 against its 9 quest points, as the players' way out", () => {
    const made = riddleTable();
    const progress = updateCard(made.state, idOf(made.state, "131030"), { progress: 4 });
    const [dial] = riddleDials(progress, made.ctx, nameOf);
    expect(dial).toMatchObject({ id: "riddle-stage", testID: "riddle-stage", label: "Riddles", value: 4, limit: 9, goal: true, name: "Progress on Riddles in the Dark, in the riddle area" });
    expect(dial?.warn).toBeUndefined();
    expect(dial?.note).toBe("5 more progress completes Riddles in the Dark. Only answering a riddle adds progress to it. Gollum and Bilbo Baggins are in the riddle area with it.");
    expect(dialProps(dial!)).toMatchObject({ limit: 9, goal: true, elimination: false, hint: "Shows the stage and its cards" });
  });

  it("131030:A:1 shows the stage and Gollum when the dial is tapped", () => {
    const made = riddleTable();
    const [dial] = riddleDials(made.state, made.ctx, nameOf);
    expect(dial?.cardId).toBe(idOf(made.state, "131030"));
    expect(dial?.extra).toEqual([idOf(made.state, "131074")]);
  });

  it("131030:B:3 marks the seat that controls Bilbo Baggins while he is in the area, with the player's number two-handed", () => {
    const solo = riddleTable();
    expect(riddleHands(solo.state)[0]).toMatchObject({ seat: 0, label: "Riddle area" });
    const two = riddleTable({ seats: 2 });
    expect(riddleHands(two.state)).toEqual([expect.objectContaining({ seat: 0, label: "P1 · Riddle area" })]);
  });

  it("131031:B:1 takes the dial and the mark away once stage 3 has removed stage 2 from the area", () => {
    const made = riddleTable();
    const full = settle({ ...updateCard(updateCard(made.state, idOf(made.state, "131029"), { progress: 14 }), idOf(made.state, "131030"), { progress: 9 }), window: null, mode: "stopped" }, made.ctx, []);
    expect(riddleDials(full, made.ctx, nameOf)).toEqual([]);
    expect(riddleHands(full)).toEqual([]);
  });
});

describe("the table while a riddle card is offered and while Gollum attacks", () => {
  it("131077:A:2 leaves the revealed riddle card's threat out of the quest figure while the choice is open, and counts it once resolved", () => {
    const made = riddleTable();
    const shown = revealFromTop(made.state, made.ctx, "131077", []).state;
    expect(shown.window?.kind).toBe("choose");
    expect(stagingThreatNow(shown, made.ctx)).toBe(stagingThreat(made.state, made.ctx.cards));
    expect(stagingThreat(shown, made.ctx.cards)).toBeGreaterThan(stagingThreatNow(shown, made.ctx));
    const resolved = send({ state: shown, steps: [] as never[] }, { type: "Choose", optionId: "resolve" }, made.ctx).state;
    expect(stagingThreatNow(resolved, made.ctx)).toBe(stagingThreat(resolved, made.ctx.cards));
  });

  it("131074:A:1 draws Gollum in the engagement area while he attacks from the riddle area, and Bilbo beside him once named", () => {
    const made = riddleTable({ deckOf: ["01040", "01040"] });
    let run = { state: revealFromTop(made.state, made.ctx, "131076", []).state, steps: [] as never[] };
    for (const pick of ["answer", "ally"]) run = send(run, { type: "Choose", optionId: pick }, made.ctx) as typeof run;
    for (let guard = 0; guard < 6 && run.state.window?.kind === "frameAction"; guard += 1) run = send(run, { type: "Pass" }, made.ctx) as typeof run;
    const gollum = idOf(run.state, "131074");
    expect(zoneIds(run.state, "engaged", 0)).toEqual([gollum]);
    expect(zoneIds(run.state, "play", 0)).toContain(made.bilbo);
    const result = readoutFor(run.state, made.ctx, null, null, (id) => id)?.result;
    expect(result).toBe(`Undefended, ${made.bilbo} takes 2`);
    const hit = send(run, { type: "Undefended", heroId: made.bilbo }, made.ctx);
    const pair = combatPairs(hit.state, 0).get(gollum);
    expect(pair?.ids).toEqual([made.bilbo]);
    expect(zoneIds(hit.state, "play", 0)).not.toContain(made.bilbo);
  });
});
