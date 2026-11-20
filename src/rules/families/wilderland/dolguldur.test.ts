// Rules: rr.destroy, rr.explored, rr.the-word-choose, rr.forced, mec109.indestructible (data/rules/entries.json); ledger lines 50907:A:1, 50931:B:1, 50931:B:2, 50903:B:2 (docs/brief.md, Attack on Dol Guldur, readings 4, 5, 6, 8 and 18).
// The pieces Attack on Dol Guldur adds, on fixture cards: TallySiege and the amount siegeTally, SelectRandomStage with the condition optionTaken, the flag losesIndestructible, an `early` Forced effect and AdvanceToStage `again`.
import { describe, expect, it } from "vitest";

import { indestructible } from "../../core/keywords.ts";
import { printedOf } from "../../core/printed.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { holds } from "../../interpret/conditions.ts";
import { resolveAmount } from "../../interpret/amounts.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { fireForced } from "../../windows/triggers.ts";
import { topFrame } from "../../windows/windows.ts";
import { CARDS, ctxOf, record, table } from "./fixture.ts";

const inFrame = (state: ScenarioState, subject?: string): ScenarioState =>
  pushEffectFrame(state, { frame: "ResolveEffect", sourceId: null, actor: 0, peril: false, effectId: "x:forced:1", instructions: [], picked: [], ...(subject ? { subject } : {}), cancel: null, blockCancel: null }, []);
const scope = { actor: 0, sourceId: null } as const;
const focus = { seat: 0, sourceId: null } as const;
const tally = (state: ScenarioState): number => resolveAmount(state, { siegeTally: true }, scope, ctxOf([]));

describe("TallySiege and the amount siegeTally (50907:A:1)", () => {
  it("adds the printed Siege value of each destroyed enemy and explored location, and a card with none adds 0", () => {
    const enemy = spawn(table(), "siegeEnemy", { zone: "staging" });
    const place = spawn(enemy.state, "siegePlace", { zone: "staging" });
    const plain = spawn(place.state, "orc", { zone: "staging" });
    const ctx = ctxOf([]);
    expect(printedOf(CARDS, "siegeEnemy").keywords.siegeValue).toBe(4);
    let state = runInstruction(inFrame(plain.state, enemy.id), { verb: "TallySiege" }, focus, ctx, []);
    expect(tally(state)).toBe(4);
    state = runInstruction(inFrame(state, place.id), { verb: "TallySiege" }, focus, ctx, []);
    expect(tally(state)).toBe(6);
    state = runInstruction(inFrame(state, plain.id), { verb: "TallySiege" }, focus, ctx, []);
    expect(tally(state)).toBe(6);
  });

  it("belongs to one round: the next round reads 0 and starts again", () => {
    const enemy = spawn(table(), "siegeEnemy", { zone: "staging" });
    const first = runInstruction(inFrame(enemy.state, enemy.id), { verb: "TallySiege" }, focus, ctxOf([]), []);
    const later: ScenarioState = { ...first, round: first.round + 1 };
    expect(tally(first)).toBe(4);
    expect(tally(later)).toBe(0);
    expect(tally(runInstruction(inFrame(later, enemy.id), { verb: "TallySiege" }, focus, ctxOf([]), []))).toBe(4);
  });
});

describe("SelectRandomStage and optionTaken (50931:B:2)", () => {
  const codes = ["stage", "stage3a", "stage3c"];

  it("notes one of the stages but the current one, with the seed, and the condition holds for it alone", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 12; seed += 1) {
      const state = inFrame({ ...table(), seed });
      const picked = runInstruction(state, { verb: "SelectRandomStage", codes }, focus, ctxOf([]), []);
      const hits = codes.filter((code) => holds(picked, { kind: "optionTaken", id: code }, scope, ctxOf([])));
      expect(hits).toHaveLength(1);
      expect(hits[0]).not.toBe("stage");
      expect(picked.seedCursor).not.toBe(state.seedCursor);
      seen.add(hits[0] as string);
    }
    expect([...seen].sort()).toEqual(["stage3a", "stage3c"]);
  });

  it("holds for nothing before a stage is selected", () => {
    expect(holds(inFrame(table()), { kind: "optionTaken", id: "stage3a" }, scope, ctxOf([]))).toBe(false);
  });
});

describe("the flag losesIndestructible (50931:B:1)", () => {
  it("takes away Indestructible and nothing else", () => {
    const urdug = spawn(table(), "urdug", { zone: "staging" });
    const printed = printedOf(CARDS, "urdug");
    expect(indestructible(urdug.state, urdug.id, printed)).toBe(true);
    const flagged: ScenarioState = { ...urdug.state, modifiers: [...urdug.state.modifiers, { instanceId: urdug.id, sourceId: urdug.id, stat: "losesIndestructible", amount: 1, until: "whileSourceInPlay" }] };
    expect(indestructible(flagged, urdug.id, printed)).toBe(false);
    expect(printed.keywords.indestructible).toBe(true);
  });
});

describe("`early` Forced effects (50907:A:1, reading 5)", () => {
  const forcedAtEnd = (cardCode: string, extra: Partial<Parameters<typeof record>[4]> = {}) => record(`${cardCode}:forced:1`, cardCode, "forced", [{ verb: "ShuffleEncounterDeck" }], { trigger: "endOfRound", ...extra });

  it("resolves before the older card's Forced effect, which otherwise comes first", () => {
    const older = spawn(table(), "siegePlace", { zone: "staging" });
    const newer = spawn(older.state, "siegeEnemy", { zone: "staging" });
    const bumped = updateCard(newer.state, newer.id, { enteredPlay: (newer.state.cards[older.id]?.enteredPlay ?? 0) + 5 });
    const event = { trigger: "endOfRound", seat: null, phase: "End of round" } as const;
    const plain = fireForced(bumped, event, ctxOf([forcedAtEnd("siegePlace"), forcedAtEnd("siegeEnemy")]), []);
    expect(topFrame(plain)?.data).toMatchObject({ kind: "effect", effectId: "siegePlace:forced:1" });
    const early = fireForced(bumped, event, ctxOf([forcedAtEnd("siegePlace"), forcedAtEnd("siegeEnemy", { early: true })]), []);
    expect(topFrame(early)?.data).toMatchObject({ kind: "effect", effectId: "siegeEnemy:forced:1" });
  });
});

describe("AdvanceToStage `again`", () => {
  it("comes back to a stage set aside only with the flag, and the stage has no tokens when it returns", () => {
    const base = table();
    const aside = spawn(base, "stage3a", { zone: "setAside" });
    const stained = updateCard(aside.state, aside.id, { progress: 7, resources: 2 });
    const ctx = ctxOf([]);
    const without = runInstruction(inFrame(stained), { verb: "AdvanceToStage", code: "stage3a" }, focus, ctx, []);
    expect(without.questStage).toBe(base.questStage);
    const again = runInstruction(inFrame(stained), { verb: "AdvanceToStage", code: "stage3a", again: true }, focus, ctx, []);
    expect(again.questStage).toBe(aside.id);
    expect(again.cards[aside.id]).toMatchObject({ zone: "questStage", progress: 0, resources: 0 });
  });
});
