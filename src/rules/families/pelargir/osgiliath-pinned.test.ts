// Rules: hon.archery, rr.lasting-effects, rr.surge, ats.controlling-locations (data/rules/entries.json); ledger lines 06104:A:1, 06104:A:2.
// Pinned Down: "When Revealed: The players must increase the archery total by the number of locations they control, until the end of the round. If the players control fewer than 4 locations, Pinned Down gains surge." Built on a real round: the first round's quest explores Ancient Harbor (the first player controls it), the second round reveals Pinned Down, and the combat phase asks the players to divide the archery total.
import { describe, expect, it } from "vitest";

import { send } from "../../../../test/harness/scene-kit.ts";
import { CODES, drive, opened, table, where } from "../../../../test/scenarios/assault-on-osgiliath/table.ts";

const ELITE = "06047";
// A real hero with Willpower 4: the committed heroes still explore Ancient Harbor against the threat of the enemy in the staging area.
const EOWYN = "01007";

/** Round 1: the quest explores Ancient Harbor. Round 2: Pinned Down is the card revealed (the first round's quest reveals the first card of the deck) and the game goes on to its archery window. */
function toArchery(staging: readonly string[], deck: readonly string[]) {
  const made = table({ phase: "Quest", active: { code: CODES.harbor, progress: 4 }, heroes: [{ code: EOWYN, seat: 0 }], committed: ["dh1", "dh2", EOWYN], staging: [CODES.westQuarter, ...staging], deck }, undefined, [ELITE, EOWYN]);
  const first = drive(made, send(opened(made), { type: "Pass" }, made.ctx), (state) => state.window?.kind === "archery");
  // The archery of round 1 (the enemy in the staging area) goes on a hero; the second one is the one read.
  const total = first.state.window?.kind === "archery" ? first.state.window.total : 0;
  const second = drive(made, send(first, { type: "Distribute", assignments: [{ cardId: made.hero2, amount: total }] }, made.ctx), (state) => state.window?.kind === "archery");
  return { made, run: second };
}

describe("06104:A:1 Pinned Down: the archery total grows by the number of locations the players control", () => {
  it("adds the 1 location the players control to the one total the players divide, with the archery of an enemy in the staging area", () => {
    const { run } = toArchery([ELITE], ["f0", CODES.pinned, "f0", "f0", "f0", "f0"]);
    expect(run.state.window).toMatchObject({ kind: "archery", total: 3 });
  });

  it("leaves the total as the enemies make it without Pinned Down", () => {
    const { run } = toArchery([ELITE], ["f0", "f0", "f0", "f0", "f0", "f0"]);
    expect(run.state.window).toMatchObject({ kind: "archery", total: 2 });
  });

  it("gains surge with fewer than 4 locations controlled: the card after it is revealed too", () => {
    const { run } = toArchery([ELITE], ["f0", CODES.pinned, CODES.eastQuarter, "f0", "f0", "f0"]);
    expect(where(run.state, CODES.eastQuarter)).toBe("staging");
  });
});
