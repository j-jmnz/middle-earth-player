// Rules: hob.riddle-area, hob.riddles (data/rules/entries.json); docs/scenarios/the-hobbit.md (Dungeons Deep and Caverns Dim); ledger lines 131030:A:1, 131030:B:2, 131030:B:3, 131031:B:1.
// The riddle area on the table: the dial of stage 2 with its progress against 9 (the players' way out, so it never warms), a tap that shows the stage and Gollum, and the mark Bilbo's seat wears while he is in the area.
import { describe, expect, it } from "vitest";

import { settle } from "../../../rules/engine/machine.ts";
import { updateCard } from "../../../rules/core/state.ts";
import { riddleTable } from "../../../rules/families/riddles/fixture.ts";
import { idOf } from "../../../../test/harness/scene-kit.ts";
import { dialProps } from "../dials.ts";
import { riddleDials, riddleHands } from "./riddles.ts";

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
    expect(riddleHands(solo.state)[0]).toMatchObject({ seat: 0, label: "Bilbo in the riddle area" });
    const two = riddleTable({ seats: 2 });
    expect(riddleHands(two.state)).toEqual([expect.objectContaining({ seat: 0, label: "P1 · Bilbo in the riddle area" })]);
  });

  it("131031:B:1 takes the dial and the mark away once stage 3 has removed stage 2 from the area", () => {
    const made = riddleTable();
    const full = settle({ ...updateCard(updateCard(made.state, idOf(made.state, "131029"), { progress: 14 }), idOf(made.state, "131030"), { progress: 9 }), window: null, mode: "stopped" }, made.ctx, []);
    expect(riddleDials(full, made.ctx, nameOf)).toEqual([]);
    expect(riddleHands(full)).toEqual([]);
  });
});
