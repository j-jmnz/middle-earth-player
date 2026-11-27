// Rules: hrd.multiple-encounter-sets, hrd.removed-from-the-game, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 17145:A:1, 17145:A:4, 17146:A:1, 17150:A:2, 17157:A:1, 17158:A:1, 17159:A:1, 17160:A:1 (docs/scenarios/haradrim/the-crossings-of-poros.md, Table).
// What the table says of The Crossings of Poros' pieces: the set aside encounter sets with the cards each holds, the stage path, Poros Garrison with its loss line and its seat's mark, and The Black Serpent in the staging area.
// The engine decided each number; nothing here changes one. No control types damage, resources, threat, progress or life.
import { describe, expect, it } from "vitest";

import { updateCard } from "../../rules/core/state.ts";
import { idOf, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";

import { scenarioDials, seatMarks } from "../readouts/scenario-dials.ts";
import { serpentDetail } from "../readouts/haradrim/serpent.ts";

const SANDS = ["16049", "16050", "16051"];
const HARAD_SOLDIERS = ["16040", "16044"];
const at = (layout: Layout = {}) => tableFromLayout("the-crossings-of-poros", { seats: 1, stage: "17157", phase: "Quest", ...layout });
const dial = (t: ReturnType<typeof at>, id: string) => scenarioDials(t.state, t.ctx, (code) => code).find((one) => one.id === id);

describe("17157:A:1 the set aside sets", () => {
  it("lists each set with its cards left, the set with the most first, and says which set leads", () => {
    const aside = dial(at({ setAside: [...SANDS, ...HARAD_SOLDIERS] }), "aside");
    expect(aside).toMatchObject({ label: "Aside", value: 3 });
    expect(aside?.lists?.[0]?.lines[0]).toBe("Desert Sands: 3 cards left (most)");
    expect(aside?.lists?.[0]?.lines).toContain("Harad Soldiers: 2 cards left");
    expect(aside?.note).toContain("Desert Sands");
  });

  it("17150:A:2 names every tied set and says the first player chooses", () => {
    const aside = dial(at({ setAside: [SANDS[0]!, HARAD_SOLDIERS[0]!] }), "aside");
    expect(aside?.lists?.[0]?.lines).toContain("Harad Soldiers: 1 card left (most)");
    expect(aside?.note).toContain("or");
    expect(aside?.note).toContain("first player chooses");
  });

  it("17158:A:1 counts a set removed from the game as no card left", () => {
    const aside = dial(at({ setAside: HARAD_SOLDIERS }), "aside");
    expect(aside?.lists?.[0]?.lines).toContain("Desert Sands: 0 cards left");
    expect(dial(at(), "aside")?.note).toBe("No set aside encounter set has a card left.");
  });

  it("shows nothing in another scenario", () => {
    const other = tableFromLayout("the-black-serpent", { seats: 1 });
    expect(scenarioDials(other.state, other.ctx, (code) => code).filter((one) => ["aside", "path", "garrison"].includes(one.id))).toEqual([]);
  });
});

describe("17158:A:1 the path of stages", () => {
  it("says the stage in play and the stage 2 removed, with the stage 3 cards not chosen yet", () => {
    const path = dial(at({ stage: "17158", side: "A" }), "path");
    expect(path).toMatchObject({ label: "Path", value: 2, limit: 4, goal: true });
    expect(path?.lists?.find((list) => list.heading === "Stage 2")?.lines).toContain("17158: in play");
    expect(path?.note).toContain("Stage 2 of 4");
  });

  it("17160:A:1 says the stage 3 in play", () => {
    const path = dial(at({ stage: "17160" }), "path");
    expect(path?.value).toBe(3);
    expect(path?.lists?.find((list) => list.heading === "Stage 3")?.lines).toContain("17160: in play");
  });
});

describe("17145:A:1 Poros Garrison", () => {
  it("shows its damage against its hit points and warns near the loss", () => {
    const t = at({ play: ["17145"] });
    const id = idOf(t.state, "17145");
    expect(dial(t, "garrison")).toMatchObject({ label: "Garrison", value: 0, limit: 6, warms: true, limitWords: "the players lose when Poros Garrison leaves play, at 6 damage" });
    const hurt = { ...t, state: updateCard(t.state, id, { damage: 4 }) };
    expect(dial(hurt, "garrison")?.warn).toMatchObject({ level: "near", words: "2 more damage and the players lose." });
    const last = { ...t, state: updateCard(t.state, id, { damage: 5 }) };
    expect(dial(last, "garrison")?.warn?.level).toBe("critical");
  });

  it("17145:A:4 marks the seat of its controller with the loss line", () => {
    const t = at({ play: ["17145"], seats: 2, firstPlayer: 1 });
    const state = updateCard(t.state, idOf(t.state, "17145"), { controller: 1 });
    expect(seatMarks(state, t.ctx)).toEqual([expect.objectContaining({ seat: 1, label: "P2 · Garrison" })]);
    expect(seatMarks(at().state, at().ctx)).toEqual([]);
  });
});

describe("17146:A:1 The Black Serpent in the staging area", () => {
  it("says its totals and no engagement, as there is no objective to claim", () => {
    const t = at({ staging: ["17146"] });
    const line = serpentDetail(t.state, t.ctx, idOf(t.state, "17146"));
    expect(line).not.toBeNull();
    expect(line).not.toMatch(/considered engaged/i);
  });
});
