// Rules: rr.quest-advancement, rr.objective-cards, emce.indestructible (data/rules/entries.json); ledger lines 12184:B:2, 19047:B:2, 19048:B:2, 19051:A:1, 19051:B:3, 19053:A:1, 19055:A:2. What the table says of Roam Across Rhovanion's pieces: the stage the seed chose
// (the banner of the advance), the trust on Urdug and what it adds, and Urdug and Tiny on their enemy sides after stage 3 flipped them. The engine decided each; nothing here changes one.
import { beforeAll, describe, expect, it } from "vitest";

import type { EngineStep } from "../../rules/core/intents.ts";
import { settle } from "../../rules/engine/machine.ts";
import { runInstruction } from "../../rules/interpret/interpret.ts";
import { updateCard } from "../../rules/core/state.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { CODES, STAGES, idOf, loadRhovanionWorld, rhovanionTable, type RhovanionWorld } from "../../../test/scenarios/roam-across-rhovanion/scene.ts";

import { dungeonDetail } from "../cards/dungeon-preview.ts";
import { ledgerLine } from "../cards/ledger.ts";
import { stageText } from "../readouts/objective.ts";
import { momentOf } from "../store/outcome.ts";

let world: RhovanionWorld;
beforeAll(async () => {
  world = await loadRhovanionWorld();
}, 120_000);

const nameOf = (table: ReturnType<typeof rhovanionTable>) => (id: string) => table.ctx.cards.get(table.state.cards[id]?.code ?? id)?.name ?? id;

describe("the quest advancing to a random stage 2 (19047:B:2)", () => {
  it("names the stage the seed chose and what it asks, whichever it is, and says nothing of chance when the quest goes on to stage 3", () => {
    const chosen = new Set<string>();
    for (let seed = 1; seed <= 8; seed += 1) {
      const table = rhovanionTable(world, { seed });
      const stage = table.state.questStage ?? "";
      const steps: EngineStep[] = [];
      const after = settle({ ...runInstruction(table.state, { verb: "AdvanceToRandomStage", codes: ["19048", "19049", "19050"], otherwise: "19051" }, { seat: 0, sourceId: stage }, table.ctx, steps), window: null }, table.ctx, steps);
      const code = after.cards[after.questStage ?? ""]?.code ?? "";
      chosen.add(code);
      const lines = momentOf(table.state, after, steps, { card: (id) => after.cards[id]?.code ?? id, stage: (id) => stageText(table.ctx, after.cards[id]?.code ?? "", ledgerLine) })?.lines.map((line) => line.text) ?? [];
      expect(lines, `seed ${seed}`).toContain(`The quest advances to ${code}`);
      expect(lines, `seed ${seed}`).toContain("The stage was chosen at random");
      expect(lines.join(" "), `seed ${seed}`).toContain(stageText(table.ctx, code, ledgerLine) ?? "missing");
    }
    expect(chosen.size).toBeGreaterThan(1);
    // Stage 3 follows the last stage 2 on its own: no chance is told.
    const last = rhovanionTable(world, { stage: "19050" });
    const steps: EngineStep[] = [];
    const after = settle({ ...runInstruction(last.state, { verb: "AdvanceToRandomStage", codes: ["19048", "19049", "19050"], otherwise: "19051" }, { seat: 0, sourceId: last.state.questStage ?? "" }, last.ctx, steps), window: null }, last.ctx, steps);
    expect(after.cards[after.questStage ?? ""]?.code).toBe("19051");
    const lines = momentOf(last.state, after, steps, { card: (id) => after.cards[id]?.code ?? id, stage: () => null })?.lines.map((line) => line.text) ?? [];
    expect(lines).not.toContain("The stage was chosen at random");
  });
});

describe("Urdug's trust (12184:B:2) and his enemy side (19051:B:3, 19055:A:2)", () => {
  const detail = (table: ReturnType<typeof rhovanionTable>, code: string) => dungeonDetail(table.state, table.ctx, idOf(table.state, code), nameOf(table));

  it("says what the resources on Urdug add, either side", () => {
    const table = rhovanionTable(world, { play: [CODES.urdug] });
    expect(detail(table, CODES.urdug)).toBeNull();
    const trusted = { ...table, state: syncConstants(updateCard(table.state, idOf(table.state, CODES.urdug), { resources: 1 }), table.ctx) };
    expect(detail(trusted, CODES.urdug)).toBe("1 resource of trust on him: +1 Willpower, Threat, Attack and Defense.");
    const more = { ...table, state: updateCard(table.state, idOf(table.state, CODES.urdug), { resources: 3 }) };
    expect(detail(more, CODES.urdug)).toBe("3 resources of trust on him: +3 Willpower, Threat, Attack and Defense.");
  });

  it("on his enemy side in the staging area it says how the game is won and that Tiny shields him while Tiny is in play", () => {
    const table = rhovanionTable(world, { stage: STAGES[4], staging: [CODES.urdugEnemy, CODES.tinyEnemy] });
    const synced = { ...table, state: syncConstants(updateCard(table.state, idOf(table.state, CODES.urdugEnemy), { resources: 2, damage: 4 }), table.ctx) };
    const health = world.cards.get(CODES.urdugEnemy)?.health ?? 0;
    expect(detail(synced, CODES.urdugEnemy)).toBe(`2 resources of trust on him: +2 Willpower, Threat, Attack and Defense. 4 of ${health} damage. He is indestructible: the players win when he has no hit points remaining. He takes no damage while Tiny is in play.`);
    // Without Tiny he takes damage again.
    const alone = rhovanionTable(world, { stage: STAGES[4], staging: [CODES.urdugEnemy] });
    expect(detail(alone, CODES.urdugEnemy)).toBe(`0 of ${health} damage. He is indestructible: the players win when he has no hit points remaining.`);
  });

  it("says nothing of Tiny alone, and with Urdug that he shields him", () => {
    const table = rhovanionTable(world, { stage: STAGES[4], staging: [CODES.tinyEnemy] });
    expect(detail(table, CODES.tinyEnemy)).toBeNull();
    const both = rhovanionTable(world, { stage: STAGES[4], staging: [CODES.urdugEnemy, CODES.tinyEnemy] });
    const synced = { ...both, state: syncConstants(both.state, both.ctx) };
    expect(detail(synced, CODES.tinyEnemy)).toBe("Urdug takes no damage while Tiny is in play.");
  });
});
