// Rules: rr.destroy, rr.explored, rr.the-word-choose, rr.forced, mec109.indestructible (data/rules/entries.json); ledger lines 50907:A:1, 50931:B:1, 50931:B:2, 50930:A:2, 50903:B:2 (docs/scenarios/standalone-scenarios/attack-on-dol-guldur.md, Attack on Dol Guldur, readings 4, 5, 6, 8 and 18).
// The pieces Attack on Dol Guldur adds, on fixture cards: TallySiege and the amount siegeTally, SelectRandomStage with the condition optionTaken, the flag losesIndestructible, an `early` Forced effect and AdvanceToStage `again`.
import { describe, expect, it } from "vitest";

import { indestructible, modifiedStat } from "../../core/keywords.ts";
import { printedOf } from "../../core/printed.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { holds } from "../../interpret/conditions.ts";
import { resolveAmount } from "../../interpret/amounts.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { fireForced } from "../../windows/triggers.ts";
import { topFrame } from "../../windows/windows.ts";
import { cancelBarred } from "../encounter/cancel.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import { CARDS, ctxOf, record, table } from "./fixture.ts";

const inFrame = (state: ScenarioState, subject?: string): ScenarioState =>
  pushEffectFrame(state, { frame: "ResolveEffect", sourceId: null, actor: 0, peril: false, effectId: "x:forced:1", instructions: [], picked: [], ...(subject ? { subject } : {}), cancel: null, blockCancel: null }, []);
const scope = { actor: 0, sourceId: null, returned: 0 } as const;
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

describe("TakeControlOfStaged (50902:A:1)", () => {
  it("moves the staged card into the first player's play area under his control, and does nothing when it is not staged", () => {
    const hill = spawn(table(2), "siegePlace", { zone: "staging" });
    const taken = runInstruction(inFrame(hill.state), { verb: "TakeControlOfStaged", code: "siegePlace" }, focus, ctxOf([]), []);
    expect(taken.cards[hill.id]).toMatchObject({ zone: "play", controller: taken.firstPlayer, face: "up" });
    const bare = inFrame(table());
    expect(runInstruction(bare, { verb: "TakeControlOfStaged", code: "siegePlace" }, focus, ctxOf([]), [])).toEqual(bare);
  });
});

describe("DiscardCopiesOfDiscarded (50911:A:2)", () => {
  it("discards each card in play with the title of the last card the effect discarded from a deck, and no other", () => {
    const base = spawn(spawn(spawn(table(), "siegeEnemy", { zone: "staging" }).state, "siegeEnemy", { zone: "engaged", seat: 0 }).state, "orc", { zone: "staging" });
    const copies = Object.values(base.state.cards).filter((card) => card.code === "siegeEnemy").map((card) => card.id);
    const discarded = spawn(base.state, "siegeEnemy", { zone: "discard", seat: 0 });
    const frame = inFrame(discarded.state);
    const top = topFrame(frame);
    if (top?.data.kind !== "effect") throw new Error("no effect frame");
    const marked: ScenarioState = { ...frame, stack: frame.stack.map((entry) => (entry === top ? { ...entry, data: { ...top.data, discardedFromDecks: [discarded.id] } } : entry)) };
    const done = runInstruction(marked, { verb: "DiscardCopiesOfDiscarded" }, focus, ctxOf([]), []);
    for (const id of copies) expect(done.cards[id]?.zone).not.toBe("staging");
    expect(done.cards[base.id]?.zone).toBe("staging");
    const none = runInstruction(frame, { verb: "DiscardCopiesOfDiscarded" }, focus, ctxOf([]), []);
    expect(copies.map((id) => none.cards[id]?.zone)).toEqual(["staging", "engaged"]);
  });
});

describe("the pick field highestEngagementCost (50926:A:2)", () => {
  it("keeps the enemies with the highest engagement cost, every one when tied", () => {
    const low = spawn(table(), "orc", { zone: "staging" });
    const high = spawn(low.state, "siegeEnemy", { zone: "staging" });
    const pick = { type: "enemy", control: "any", stagingOnly: true, highestEngagementCost: true } as const;
    expect(pickCandidates(high.state, pick, 0, [], null, ctxOf([]))).toEqual([high.id]);
    const tied = spawn(high.state, "siegeEnemy", { zone: "staging" });
    expect(pickCandidates(tied.state, pick, 0, [], null, ctxOf([])).sort()).toEqual([high.id, tied.id].sort());
  });
});

describe("the flag shadowsUncancelable (50916:A:1)", () => {
  it("bars a cancel Response in the shadow window of an attack by the enemy that holds it, and no other attack", () => {
    const enemy = spawn(table(), "siegeEnemy", { zone: "engaged", seat: 0 });
    const cancel = record("x:response:1", "x", "response", [{ verb: "CancelEffect" }], { trigger: "shadowPending" });
    const event = { trigger: "shadowPending", seat: 0 } as const;
    const attacking = (state: ScenarioState): ScenarioState => ({ ...state, pendingAttack: { enemyId: enemy.id } as ScenarioState["pendingAttack"] });
    const flagged: ScenarioState = { ...enemy.state, modifiers: [...enemy.state.modifiers, { instanceId: enemy.id, sourceId: enemy.id, stat: "shadowsUncancelable", amount: 1, until: "whileSourceInPlay" }] };
    expect(cancelBarred(attacking(flagged), event, cancel)).toBe(true);
    expect(cancelBarred(attacking(enemy.state), event, cancel)).toBe(false);
    expect(cancelBarred(flagged, event, cancel)).toBe(false);
  });
});

describe("the flags attackAtFiveProgress and defenseAtFiveProgress (50930:A:2)", () => {
  it("add their amount to the stat only while the current quest stage holds 5 progress, recalculated as the progress changes", () => {
    const enemy = spawn(table(), "siegeEnemy", { zone: "engaged", seat: 0 });
    const stage = Object.values(enemy.state.cards).find((card) => card.zone === "questStage");
    expect(stage).toBeDefined();
    const flagged: ScenarioState = { ...enemy.state, modifiers: [...enemy.state.modifiers, { instanceId: enemy.id, sourceId: "x", stat: "attackAtFiveProgress", amount: 1, until: "endOfPhase" }, { instanceId: enemy.id, sourceId: "x", stat: "defenseAtFiveProgress", amount: 1, until: "endOfPhase" }] };
    const read = (state: ScenarioState, name: "attack" | "defense") => modifiedStat(state, state.cards[enemy.id]!, name, CARDS);
    const base = { attack: read(flagged, "attack"), defense: read(flagged, "defense") };
    const at = (progress: number) => updateCard(flagged, stage?.id ?? "", { progress });
    expect(read(at(4), "attack")).toBe(base.attack);
    expect(read(at(5), "attack")).toBe(base.attack + 1);
    expect(read(at(5), "defense")).toBe(base.defense + 1);
    expect(read(at(0), "defense")).toBe(base.defense);
  });
});
