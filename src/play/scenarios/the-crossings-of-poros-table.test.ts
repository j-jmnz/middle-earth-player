// Rules: hrd.multiple-encounter-sets, hrd.removed-from-the-game, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 17145:A:1, 17145:A:4, 17146:A:1, 17150:A:2, 17157:A:1, 17158:A:1, 17159:A:1, 17160:A:1 (docs/scenarios/haradrim/the-crossings-of-poros.md, Table).
// What the table says of The Crossings of Poros' pieces: the set aside encounter sets with the cards each holds, the stage path, Poros Garrison with its loss line and its seat's mark, and The Black Serpent in the staging area.
// The engine decided each number; nothing here changes one. No control types damage, resources, threat, progress or life.
import { describe, expect, it } from "vitest";

import { updateCard } from "../../rules/core/state.ts";
import { idOf, legalIntents, opened, send, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";

import { scenarioDials } from "../readouts/scenario-dials.ts";
import { heldDials } from "../readouts/widgets.ts";
import { sheetFor } from "../choice/sheets.ts";
import { logLines, type LogNames } from "../store/log.ts";
import { randomStageDetail } from "../words/scenarios/haradrim/poros-table.ts";
import type { EngineStep } from "../../rules/core/intents.ts";
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
    // The tie is on the panel as well as in the voice: the foot names the tied sets.
    expect(aside?.foot).toContain("Tie for the most cards left: Desert Sands and Harad Soldiers");
    expect(dial(at({ setAside: [...SANDS, ...HARAD_SOLDIERS] }), "aside")?.foot).not.toContain("Tie");
  });

  it("17158:A:1 counts a set removed from the game as no card left", () => {
    const aside = dial(at({ setAside: HARAD_SOLDIERS }), "aside");
    expect(aside?.lists?.[0]?.lines).toContain("Desert Sands: 0 cards left");
    // With no card left in any set the dial has nothing to say and is not pushed.
    expect(dial(at(), "aside")).toBeUndefined();
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

describe("17158:A:1 and 17160:A:1 the stages that left", () => {
  it("reads a stage 2 that was removed as removed", () => {
    const t = at({ stage: "17161", stages: ["17157", "17159", "17161", "17163"], setAside: ["17158"] });
    const removed = updateCard(t.state, idOf(t.state, "17158"), { removedStage: true });
    const lists = scenarioDials(removed, t.ctx, (code) => code).find((one) => one.id === "path")?.lists ?? [];
    expect(lists.find((list) => list.heading === "Stage 2")?.lines).toContain("17158: removed");
  });

  it("reads a stage 3 that stage 3A set aside as set aside, and the note says the other stages 3 are set aside", () => {
    const t = at({ stage: "17161", stages: ["17157", "17159", "17161", "17163"], setAside: ["17160", "17162"] });
    const state = updateCard(updateCard(t.state, idOf(t.state, "17160"), { removedStage: true }), idOf(t.state, "17162"), { removedStage: true });
    const path = scenarioDials(state, t.ctx, (code) => code).find((one) => one.id === "path");
    expect(path?.lists?.find((list) => list.heading === "Stage 3")?.lines).toEqual(expect.arrayContaining(["17160: set aside", "17162: set aside", "17161: in play"]));
    expect(path?.note).toContain("other stages 3 are set aside");
  });
});

describe("17145:A:1 Poros Garrison", () => {
  it("is the first dial, before Aside and Path, so it stays in view where the bar scrolls", () => {
    const t = at({ play: ["17145"], setAside: HARAD_SOLDIERS });
    expect(scenarioDials(t.state, t.ctx, (code) => code).map((one) => one.id)).toEqual(["garrison", "aside", "path"]);
  });

  it("shows its damage against its hit points and warns near the loss", () => {
    const t = at({ play: ["17145"] });
    const id = idOf(t.state, "17145");
    expect(dial(t, "garrison")).toMatchObject({ label: "Garrison", value: 0, limit: 6, warms: true, limitWords: "the players lose when Poros Garrison leaves play, at 6 damage" });
    const hurt = { ...t, state: updateCard(t.state, id, { damage: 4 }) };
    expect(dial(hurt, "garrison")?.warn).toMatchObject({ level: "near", words: "2 more damage and the players lose." });
    const last = { ...t, state: updateCard(t.state, id, { damage: 5 }) };
    expect(dial(last, "garrison")?.warn?.level).toBe("critical");
  });

  it("17145:A:4 puts the held mark on the ring of its controller's seat, two-handed, and says control passes with the first player token", () => {
    const t = at({ play: ["17145"], seats: 2, firstPlayer: 1 });
    const state = updateCard(t.state, idOf(t.state, "17145"), { controller: 1 });
    expect(heldDials(state, (code) => code, () => false)).toEqual([expect.objectContaining({ seat: 1, mark: "hero", words: expect.stringContaining("first player token") })]);
    expect(dial({ ...t, state }, "garrison")?.note).toContain("Player 2 controls Poros Garrison");
    expect(dial({ ...t, state }, "garrison")?.note).toContain("first player token");
  });

  it("marks no seat for a lone player, whose threat dial has no seat to tell from another", () => {
    const solo = at({ play: ["17145"], seats: 1 });
    expect(heldDials(solo.state, (code) => code, () => false)).toEqual([]);
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

describe("17158:B:1 the damage option warns when it destroys the ally", () => {
  // The scene's ally has 2 hit points; stage 2B of Pelargir Defences asks the player who played it to exhaust it or deal it 1 damage.
  const cautionAfterPlaying = (damage: number): string | undefined => {
    const made = at({ stage: "17158", side: "B", phase: "Planning", hand: ["ally"], heroResources: 5 });
    const ally = made.state.seats[0]!.hand[0]!;
    const played = send(opened(made), { type: "PlayCard", cardId: ally, payments: [{ heroId: made.hero, amount: 1 }] } as never, made.ctx);
    const worn = updateCard(played.state, ally, { damage });
    const sheet = sheetFor(worn, made.ctx, legalIntents(worn, made.ctx), { card: (id) => worn.cards[id]?.code ?? id, line: () => null });
    const option = sheet && "options" in sheet ? (sheet.options as readonly { id?: string; label: string; caution?: string }[]).find((one) => one.label.startsWith("Deal 1 damage")) : undefined;
    return option?.caution;
  };

  it("says this destroys the ally when it has 1 hit point left, and not when it has more", () => {
    expect(cautionAfterPlaying(1)).toBe("Tap again: this destroys ally");
    expect(cautionAfterPlaying(0)).toBeUndefined();
  });
});

describe("the log and the banner tell the random stage, the stage that left and the pass of control", () => {
  const names: LogNames = { card: (id) => ({ a: "The Desert Path", b: "The Ephel Dúath", g: "Poros Garrison", s: "Desert Sands" })[id] ?? id, code: (code) => code, effectCard: () => "17158", rule: () => null, line: () => "Printed line" };
  const cause = { effect: "17157:forced:1", line: "17157:B:2" };

  it("17157:B:2 words the advance with the stages it was chosen among and a card cause", () => {
    const lines = logLines([{ kind: "advance", cardId: "b", random: { from: ["a", "b"], cause } }], names);
    expect(lines).toEqual([expect.objectContaining({ text: "The quest advances to The Ephel Dúath, chosen at random from The Desert Path and The Ephel Dúath", cause: "17158: Printed line" })]);
    expect(logLines([{ kind: "advance", cardId: "b" }], names)[0]).toMatchObject({ text: "The quest advances to The Ephel Dúath", cause: null });
  });

  it("17158:A:1 and 17160:A:1 word a stage that left, 17145:A:1 the pass of control", () => {
    const steps: EngineStep[] = [{ kind: "stageLeaves", cardId: "a", how: "removed", cause }, { kind: "stageLeaves", cardId: "b", how: "setAside", cause }, { kind: "controlPasses", cardId: "g", seat: 1, cause }];
    expect(logLines(steps, names).map((line) => line.text)).toEqual(["The Desert Path leaves the game", "The Ephel Dúath is set aside", "Poros Garrison passes to Player 2 with the first player token"]);
    expect(logLines(steps, names).every((line) => line.cause === "17158: Printed line")).toBe(true);
  });

  it("17158:A:1 tells in the banner's detail what the random stage did to the sets and stages", () => {
    const later: EngineStep[] = [{ kind: "shuffleSet", set: "Mountains of Shadow", count: 2 }, { kind: "removeSet", set: "Desert Sands", count: 3 }, { kind: "stageLeaves", cardId: "a", how: "removed", cause }];
    expect(randomStageDetail(later, names.card)).toBe("Chosen at random. Mountains of Shadow is shuffled in; Desert Sands and The Desert Path leave the game.");
    expect(randomStageDetail([{ kind: "stageLeaves", cardId: "a", how: "setAside", cause }, { kind: "stageLeaves", cardId: "b", how: "setAside", cause }], names.card)).toBe("Chosen at random. The Desert Path and The Ephel Dúath are set aside.");
    expect(randomStageDetail([], names.card)).toBe("Chosen at random.");
  });
});
