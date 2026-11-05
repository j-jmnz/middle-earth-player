import { beforeAll, describe, expect, it } from "vitest";

import { legalIntents } from "../../rules/engine/legal.ts";
import { resolveRecords } from "../../../test/harness/scene-kit.ts";
import { CODES, idOf, loadUpanduinWorld, upanduinTable, type UpanduinWorld } from "../../../test/scenarios/journey-up-the-anduin/scene.ts";

import { momentOf } from "../store/outcome.ts";
import { logLines } from "../store/log.ts";
import type { SheetNames } from "./sheet-types.ts";
import { sheetFor, travelRefusals } from "./sheets.ts";

// Rules: emce.campaign-pool-encounter, rr.travel (data/rules/entries.json); ledger lines 12167:A:2, 18016:A:3, 18068:B:1.
// The travel sheet of The Old Ford says why the players cannot go yet and who attacks when they do, and A Growing Threat tells which card it set aside.
let world: UpanduinWorld;

beforeAll(async () => {
  world = await loadUpanduinWorld();
}, 120_000);

const namesOf = (state: { cards: Record<string, { code: string }> }, cards: ReadonlyMap<string, { name: string }>): SheetNames => ({ card: (id) => cards.get(state.cards[id]?.code ?? "")?.name ?? id, line: () => null });

describe("the travel sheet of The Old Ford", () => {
  it("names the stage and its progress while travel is barred", () => {
    const t = upanduinTable(world, { stage: "18068", progress: 2, phase: "Travel", staging: [CODES.theOldFord, CODES.banksOfTheAnduin] });
    const refused = travelRefusals(t.state, t.ctx, namesOf(t.state, t.ctx.cards), []).filter((row) => row.id === idOf(t.state, CODES.theOldFord));
    expect(refused.map((row) => row.reason)).toEqual(["The Passage of the Ford: the players cannot travel here until the stage has 5 progress (2 now)."]);
  });

  it("warns, once travel is open, that each enemy in the staging area attacks the first player", () => {
    const t = upanduinTable(world, { stage: "18068", progress: 5, phase: "Travel", staging: [CODES.theOldFord, CODES.wolfRider], seats: 2 });
    const sheet = sheetFor(t.state, t.ctx, legalIntents(t.state, t.ctx), namesOf(t.state, t.ctx.cards));
    if (sheet?.kind !== "pick") throw new Error("expected a pick sheet");
    const row = sheet.options.find((option) => option.id === idOf(t.state, CODES.theOldFord));
    expect(row?.caution).toBe("Tap again: each enemy in the staging area attacks Player 1");
    expect(row?.label).toContain("each enemy in the staging area attacks Player 1");
    const alone = upanduinTable(world, { stage: "18068", progress: 5, phase: "Travel", staging: [CODES.theOldFord] });
    const quiet = sheetFor(alone.state, alone.ctx, legalIntents(alone.state, alone.ctx), namesOf(alone.state, alone.ctx.cards));
    if (quiet?.kind !== "pick") throw new Error("expected a pick sheet");
    expect(quiet.options.find((option) => option.id === idOf(alone.state, CODES.theOldFord))?.caution).toBeUndefined();
  });
});

describe("A Growing Threat", () => {
  it("tells the card it set aside in the banner and the log", () => {
    const t = upanduinTable(world, { phase: "Encounter", discard: [CODES.hillTroll] });
    const run = resolveRecords(t.state, t.ctx, CODES.aGrowingThreat, "whenRevealed");
    const troll = idOf(run.state, CODES.hillTroll);
    expect(run.steps.find((step) => step.kind === "setAsideForPool")).toMatchObject({ cardId: troll });
    const card = (id: string) => t.ctx.cards.get(run.state.cards[id]?.code ?? "")?.name ?? id;
    const moment = momentOf(t.state, run.state, run.steps, { card });
    expect(moment?.lines.map((line) => line.text)).toEqual(expect.arrayContaining(["A Growing Threat sets Hill Troll aside", "A copy joins the campaign pool if you win"]));
    const log = logLines(run.steps, { card, code: (code) => code, effectCard: () => null, line: () => null, rule: () => null });
    expect(log.map((line) => line.text)).toContain("A Growing Threat sets Hill Troll aside. A copy joins the campaign pool if you win.");
  });
});
