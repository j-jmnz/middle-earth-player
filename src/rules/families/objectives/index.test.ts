// Rules: rr.guarded, ltp.guarded, rr.objective-cards, rr.attachment-cards, rr.restricted (data/rules/entries.json); ledger lines 01108:A:1-3,
// 01109:A:1-3, 01110:A:1-3, 01123:A:1, 01101:A:1, 01103:A:2. The objectives family's verbs on a table of Escape from Dol Guldur.
import { beforeAll, describe, expect, it } from "vitest";

import { syncConstants } from "../../interpret/constants.ts";
import type { EngineStep } from "../../core/intents.ts";
import { legalIntents, legalTargets } from "../../engine/legal.ts";
import { settle } from "../../engine/machine.ts";
import { pushCardEffects } from "../../interpret/effect-frames.ts";
import { freeOfEncounters } from "./index.ts";
import { destroyCard } from "../../core/keywords.ts";
import { reduce, startScenario } from "../../engine/reduce.ts";
import { expectOk } from "../../core/test-fixture.ts";
import type { ScenarioState } from "../../core/state.ts";
import { dolGuldurTable, loadDolGuldurWorld, OBJECTIVES, type DolGuldurLayout, type DolGuldurWorld } from "../../../../test/scenarios/escape-from-dol-guldur/scene.ts";
import { dolGuldurStart, dolGuldurWorld } from "../../../../test/scenarios/escape-from-dol-guldur/game.ts";
import { codesOf, first, send, start, type Run } from "../../../../test/scenarios/a-shadow-of-the-past/scene.ts";
import { causeProblems } from "../../../../test/harness/cause-check.ts";

let world: DolGuldurWorld;

beforeAll(async () => {
  world = await loadDolGuldurWorld();
});

function make(layout: DolGuldurLayout = {}) {
  const made = dolGuldurTable(world, layout);
  return { ...made, state: syncConstants(made.state, made.ctx) };
}

// The card's When Revealed records resolve now (the way a reveal resolves them), and the choices they open are answered with `pick`.
function resolveRevealed(layout: DolGuldurLayout, code: string, pick: (state: ScenarioState) => string = (state) => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "")): ReturnType<typeof make> & { run: Run } {
  const made = make(layout);
  const id = first(made.state, code);
  const effects = made.ctx.effects.filter((effect) => effect.cardCode === code && effect.timing === "whenRevealed");
  const steps: EngineStep[] = [];
  const pushed = pushCardEffects(made.state, "whenRevealed", id, made.state.firstPlayer, false, effects, made.ctx, steps);
  let run: Run = { state: settle({ ...pushed, window: null }, made.ctx, steps), steps };
  for (let guard = 0; guard < 20 && run.state.window?.kind === "choose"; guard += 1) run = send(run, { type: "Choose", optionId: pick(run.state) }, made.ctx);
  return { ...made, run };
}

describe("Guarded (rr.guarded, 01108:A:1, 01123:A:1)", () => {
  it("attaches the next non-objective card of the encounter deck to an objective when it is revealed, and keeps both in the staging area", () => {
    const { run, state } = resolveRevealed({ staging: ["01108"], deck: ["01109", "f3", "f0"], phase: "Quest" }, "01108");
    const map = first(run.state, "01108");
    // The objective on top of the deck is skipped: it stays on the deck, and the first enemy guards.
    const guard = first(run.state, "f3");
    expect(run.state.cards[guard]?.host).toBe(map);
    expect(run.state.cards[guard]?.zone).toBe("staging");
    expect(run.state.cards[map]?.attachments).toEqual([guard]);
    expect(run.state.staging).toContain(guard);
    expect(codesOf(run.state, run.state.encounterDeck)).toEqual(["01109", "f0"]);
    expect(state.cards[map]?.attachments).toEqual([]);
    expect(causeProblems(run.steps)).toEqual([]);
  });

  it("leaves the objective free and claimable when its guard is Iron Shackles, which goes to a deck (01105:A:1)", () => {
    const { run, ctx } = resolveRevealed({ staging: ["01108"], deck: ["01105", "f0"], phase: "Quest" }, "01108");
    const map = first(run.state, "01108");
    const shackles = first(run.state, "01105");
    expect(run.state.cards[shackles]?.zone).toBe("attached");
    expect(run.state.cards[shackles]?.host).toBeNull();
    expect(run.state.cards[map]?.attachments).toEqual([]);
    expect(freeOfEncounters(run.state, map)).toBe(true);
    expect(legalIntents(run.state, ctx).some((intent) => intent.type === "Trigger" && intent.cardId === map && intent.effectId === "01108:action:1")).toBe(true);
  });

  it("gives a treachery no attachment: it resolves as it is revealed and goes to the discard pile (ltp.guarded)", () => {
    const { run } = resolveRevealed({ staging: ["01108"], deck: ["01104", "f0"], phase: "Quest" }, "01108");
    const map = first(run.state, "01108");
    expect(run.state.cards[map]?.attachments).toEqual([]);
    expect(codesOf(run.state, run.state.encounterDiscard)).toEqual(["01104"]);
    expect(run.state.cards[first(run.state, "01104")]?.host).toBeNull();
  });

  it("does nothing with no card to attach", () => {
    const { run } = resolveRevealed({ staging: ["01108"], deck: [], phase: "Quest" }, "01108");
    expect(run.state.cards[first(run.state, "01108")]?.attachments).toEqual([]);
  });

  it("is run for each objective by the quest card's Setup after the encounter deck is shuffled, in a game dealt through the checklist (01123:A:1)", async () => {
    const { ctx } = await dolGuldurWorld();
    for (const seatCount of [1, 2] as const) {
      let kept = startScenario(dolGuldurStart(seatCount, 3, "Normal"), ctx);
      while (kept.window?.kind === "mulligan") kept = expectOk(reduce(kept, { type: "Keep" }, ctx)).state;
      // A guard that is a treachery asking for a choice (Caught in a Web) waits for it.
      for (let guard = 0; guard < 6 && kept.window?.kind === "choose"; guard += 1) kept = expectOk(reduce(kept, { type: "Choose", optionId: kept.window.options[0] ?? "" }, ctx)).state;
      const objectives = Object.values(kept.cards).filter((card) => OBJECTIVES.includes(card.code as (typeof OBJECTIVES)[number]));
      expect(objectives.map((card) => card.zone), String(seatCount)).toEqual(["staging", "staging", "staging"]);
      for (const objective of objectives) {
        // One encounter card was attached; a treachery resolved at once (Caught in a Web went on a hero), so its objective has none left.
        expect(objective.attachments.length, `${objective.code} has at most one guard`).toBeLessThanOrEqual(1);
        const guard = kept.cards[objective.attachments[0] ?? ""];
        if (!guard) continue;
        expect(guard.host).toBe(objective.id);
        expect(["enemy", "location"].includes(ctx.cards.get(guard.code)?.type ?? ""), `${guard.code} is an enemy or a location`).toBe(true);
        expect(guard.zone).toBe("staging");
      }
    }
  });
});

describe("claiming (01108:A:2, 01109:A:2, 01110:A:2)", () => {
  const claim = (code: string) => ({ type: "Trigger" as const, cardId: "", effectId: `${code}:action:1` });

  it("is offered only when the objective is free of encounters, raises the claimer's threat by 2 and attaches it to the hero the claimer picks", () => {
    const guarded = make({ guarded: [["01108", "f3"]] });
    const offered = (table: ReturnType<typeof make>) => legalIntents(table.state, table.ctx).filter((intent) => intent.type === "Trigger" && intent.effectId.endsWith(":action:1"));
    expect(offered(guarded)).toEqual([]);
    const free = make({ guarded: [["01108", ""]] });
    const objective = first(free.state, "01108");
    expect(offered(free)).toEqual([{ type: "Trigger", cardId: objective, effectId: "01108:action:1" }]);
    let run = send(start(free.state), { ...claim("01108"), cardId: objective }, free.ctx);
    expect(run.state.window?.kind).toBe("choose");
    run = send(run, { type: "Choose", optionId: free.hero2 }, free.ctx);
    const claimed = run.state.cards[objective];
    expect(claimed?.zone).toBe("attached");
    expect(claimed?.host).toBe(free.hero2);
    expect(claimed?.controller).toBe(0);
    expect(claimed?.claimed).toBe(true);
    expect(run.state.cards[free.hero2]?.attachments).toEqual([objective]);
    expect(run.state.staging).not.toContain(objective);
    expect(run.state.seats[0].threat).toBe(30);
    expect(causeProblems(run.steps)).toEqual([]);
  });

  it("is not offered once a guard is attached, and is offered again when the guard leaves play", () => {
    const { state, ctx } = make({ guarded: [["01109", "f3"]], engaged: [] });
    const objective = first(state, "01109");
    const guard = first(state, "f3");
    const defeated = settle(syncConstants(destroyCard(state, guard, ctx.cards, []), ctx), ctx, []);
    expect(defeated.cards[objective]?.attachments).toEqual([]);
    expect(legalIntents(defeated, ctx).some((intent) => intent.type === "Trigger" && intent.cardId === objective)).toBe(true);
  });

  it("returns a claimed objective to the staging area, controlled by nobody, when its hero leaves play", () => {
    const { state, ctx, hero } = make({ claimed: ["01110"] });
    const objective = first(state, "01110");
    const destroyed = settle(syncConstants(destroyCard(state, hero, ctx.cards, []), ctx), ctx, []);
    expect(destroyed.cards[objective]?.zone).toBe("staging");
    expect(destroyed.cards[objective]?.controller).toBeNull();
    expect(destroyed.cards[objective]?.host).toBeNull();
    expect(destroyed.cards[objective]?.claimed).toBeUndefined();
    expect(destroyed.staging).toContain(objective);
  });

  it("makes a third Restricted objective on one hero return to the staging area: the claimer chooses which (rr.restricted)", () => {
    const { state, ctx, hero } = make({ claimed: ["01108", "01109"], guarded: [["01110", ""]] });
    const third = first(state, "01110");
    let run = send(start(state), { type: "Trigger", cardId: third, effectId: "01110:action:1" }, ctx);
    run = send(run, { type: "Choose", optionId: hero }, ctx);
    // Three Restricted attachments on one hero: its controller discards one of them, and it is the objective that returns.
    expect(run.state.window?.kind).toBe("choose");
    const options = run.state.window?.kind === "choose" ? run.state.window.options : [];
    expect(codesOf(run.state, options).sort()).toEqual(["01108", "01109", "01110"]);
    run = send(run, { type: "Choose", optionId: first(run.state, "01108") }, ctx);
    expect(run.state.cards[first(run.state, "01108")]?.zone).toBe("staging");
    expect(run.state.cards[first(run.state, "01108")]?.controller).toBeNull();
    expect(run.state.cards[hero]?.attachments.length).toBe(2);
    expect(run.state.seats[0].threat).toBe(30);
  });
});

describe("the claimed objectives' own lines (01108:A:3, 01109:A:3, 01110:A:3)", () => {
  it("Gandalf's Map: the attached hero cannot attack or defend, the other hero can", () => {
    const { state, ctx, hero, hero2 } = make({ claimed: ["01108"], phase: "Combat", engaged: [{ code: "grunt", seat: 0 }] });
    const attacking = { ...state, mode: "playerAttacks" as const, window: { kind: "playerAttack" as const } };
    expect(legalTargets(attacking, { type: "DeclareAttackers", cardId: hero }, ctx)).toEqual([]);
    expect(legalTargets(attacking, { type: "DeclareAttackers", cardId: hero2 }, ctx)).toEqual([first(state, "grunt")]);
    const defending = { ...state, mode: "enemyAttacks" as const, window: { kind: "defense" as const, enemyId: first(state, "grunt"), seat: 0 }, pendingAttack: { enemyId: first(state, "grunt"), seat: 0, undefended: false } as unknown as ScenarioState["pendingAttack"] };
    expect(legalTargets(defending, { type: "DeclareDefender" }, ctx)).toEqual([hero2]);
  });

  it("Dungeon Torch: at the end of each round the attached hero's controller raises his threat by 2; unclaimed, it does nothing", () => {
    const claimed = make({ claimed: ["01109"], seats: 2, threat: [28, 26] });
    const forced = (made: ReturnType<typeof make>) => settleEndOfRound(made.state, made.ctx);
    expect(forced(claimed).seats.map((seat) => seat.threat)).toEqual([30, 26]);
    const loose = make({ staging: ["01109"], threat: [28, 26] });
    expect(forced(loose).seats[0].threat).toBe(28);
  });

  it("Shadow Key: at the end of each round the attached hero suffers 1 damage", () => {
    const claimed = make({ claimed: ["01110"] });
    const after = settleEndOfRound(claimed.state, claimed.ctx);
    expect(after.cards[claimed.hero]?.damage).toBe(1);
    expect(after.cards[claimed.hero2]?.damage).toBe(0);
  });
});

// The end of the round: the framework runs the Forced effects "at the end of the round" and then the round's own threat raise.
function settleEndOfRound(state: ScenarioState, ctx: ReturnType<typeof make>["ctx"]): ScenarioState {
  const steps: EngineStep[] = [];
  const ending = { ...state, phase: "End of round" as const, boundaryPhase: "Refresh" as const, mode: "endRound" as const, window: null };
  let run: Run = { state: settle(ending, ctx, steps), steps };
  for (let guard = 0; guard < 30 && run.state.round === state.round; guard += 1) {
    const window = run.state.window;
    const next = window?.kind === "choose" ? ({ type: "Choose", optionId: window.options[0] ?? "" } as const) : legalIntents(run.state, ctx).find((intent) => intent.type === "Pass");
    if (!next) break;
    run = send(run, next, ctx);
  }
  return run.state;
}

describe("Dungeon Jailor (01101:A:1)", () => {
  it("shuffles an unclaimed objective into the encounter deck after the players quest unsuccessfully, once a round for any number of players", () => {
    const { state, ctx } = make({ seats: 2, stage: "01124", staging: ["01101"], guarded: [["01108", "f0"], ["01110", ""]], phase: "Quest", threat: [28, 26] });
    const jailor = first(state, "01101");
    expect(jailor).not.toBe("");
    const failed = { ...state, mode: "questCommit" as const, window: { kind: "pass" as const } };
    // Both players commit nobody: the quest fails for both.
    let run = send(start(failed), { type: "Pass" }, ctx);
    for (let guard = 0; guard < 12 && run.state.round === state.round && run.state.phase === "Quest"; guard += 1) {
      const window = run.state.window;
      const next = window?.kind === "choose" ? ({ type: "Choose", optionId: window.options[0] ?? "" } as const) : legalIntents(run.state, ctx).find((intent) => intent.type === "Pass");
      if (!next) break;
      run = send(run, next, ctx);
    }
    const deckCodes = codesOf(run.state, run.state.encounterDeck);
    expect(deckCodes.filter((code) => OBJECTIVES.includes(code as (typeof OBJECTIVES)[number])).length).toBe(1);
    expect(causeProblems(run.steps)).toEqual([]);
  });
});
