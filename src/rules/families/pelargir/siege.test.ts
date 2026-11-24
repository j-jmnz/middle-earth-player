// Rules: ats.cair-andros-remove-stage, ats.cair-andros-remove-stage-example, rr.staging, faq.cancel-encounter-effect (data/rules/entries.json); ledger lines 05033:A:2, 05056:A:2, 05061:A:2.
// The engine facts of the verbs The Siege of Cair Andros adds in the pelargir family that no printed line shows by itself: RemoveStage on any stage, the staging area shuffled into the encounter deck, the Lieutenant of Mordor copying The Power of Mordor, no
// treachery to resolve. The lines themselves (the removal at a damage total, the redirect, the locks, the keywords) are tested in src/campaign/scenarios/the-siege-of-cair-andros/lines.test.ts and spec.test.ts.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { EFFECTS } from "../../../effects/index.ts";
import type { ScenarioState } from "../../core/state.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { settle } from "../../engine/machine.ts";
import { moveCard } from "../../core/zones.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { idOf, legalIntents, send, start } from "../../../../test/harness/scene-kit.ts";
import type { LayoutTable } from "../../../../test/harness/scene-kit.ts";
import { CODES, THREE, codeOf, run, table } from "../../../../test/scenarios/the-siege-of-cair-andros/table.ts";

const { citadel: CITADEL, approach: APPROACH, banks: BANKS, reinforcing: REINFORCING, atApproach: AT_APPROACH, atCitadel: AT_CITADEL, lastBattle: LAST_BATTLE } = CODES;

describe("RemoveStage (05033:A:2, 05034:A:2, 05035:A:2)", () => {
  it("a stage in the quest deck is set aside, and the stage defeated before it goes to the next stage still in the deck", () => {
    const t = table({ staging: THREE });
    const removed = run(t, t.state, { verb: "RemoveStage", code: AT_APPROACH });
    expect(codeOf(removed, removed.setAside.find((id) => removed.cards[id]?.code === AT_APPROACH) ?? null)).toBe(AT_APPROACH);
    expect(removed.questDeck.map((id) => codeOf(removed, id))).not.toContain(AT_APPROACH);
    const fromTwo = table({ staging: THREE, stage: REINFORCING });
    const advanced = run(fromTwo, run(fromTwo, fromTwo.state, { verb: "RemoveStage", code: AT_APPROACH }), { verb: "AdvanceStage" });
    expect(codeOf(advanced, advanced.questStage)).toBe(AT_CITADEL);
  });

  it("the stages removed one after the other leave the last stage next, and a stage already gone is no error", () => {
    const t = table({ staging: THREE });
    let state = t.state;
    for (const code of [AT_CITADEL, AT_APPROACH, REINFORCING, REINFORCING]) state = run(t, state, { verb: "RemoveStage", code });
    const advanced = run(t, state, { verb: "AdvanceStage" });
    expect(codeOf(advanced, advanced.questStage)).toBe(LAST_BATTLE);
  });

  it("the current stage is removed too: it is set aside and the quest advances to the next stage still in the deck", () => {
    const t = table({ staging: THREE, stage: AT_CITADEL });
    const removed = run(t, t.state, { verb: "RemoveStage", code: AT_CITADEL });
    expect(codeOf(removed, removed.questStage)).toBe(LAST_BATTLE);
    expect(removed.cards[idOf(t.state, AT_CITADEL)]?.zone).toBe("setAside");
  });

  it("clearing all three Battleground locations on stage 1 by exploring them reaches stage 5, whichever is explored last", () => {
    const t = table({ staging: THREE });
    for (const last of THREE) {
      let state = t.state;
      for (const code of [...THREE.filter((one) => one !== last), last]) {
        state = moveCard(state, idOf(t.state, code), { zone: "victory" });
        state = run(t, state, { verb: "RemoveStage", code: { [CITADEL]: AT_CITADEL, [APPROACH]: AT_APPROACH, [BANKS]: REINFORCING }[code] ?? "" });
      }
      expect(codeOf(settle(state, t.ctx, []), settle(state, t.ctx, []).questStage)).toBe(LAST_BATTLE);
    }
  });
});

describe("ShuffleStagingIntoEncounterDeck (05061:A:2)", () => {
  it("every card in the staging area goes into the encounter deck, and X is how many, so that many cards are revealed", () => {
    const t = table({ staging: [CITADEL, "05056", "05057"], deck: ["f0", "f0"] });
    const mordor = run(t, t.state, { verb: "ShuffleStagingIntoEncounterDeck" });
    expect(mordor.staging).toEqual([]);
    expect(mordor.encounterDeck).toHaveLength(5);
    expect(mordor.cards[idOf(t.state, CITADEL)]?.zone).toBe("encounterDeck");
  });
});

describe("ShuffleStagingIntoEncounterDeck, the revealed card (05061:A:2)", () => {
  it("does not shuffle the revealed card itself, or any treachery, into the deck", () => {
    const t = table({ staging: [CITADEL, "05061"] });
    const source = idOf(t.state, "05061");
    const mordor = runInstruction({ ...t.state, window: null }, { verb: "ShuffleStagingIntoEncounterDeck" }, { seat: 0, sourceId: source }, t.ctx, []);
    expect(mordor.staging).toEqual([source]);
    expect(mordor.cards[idOf(t.state, CITADEL)]?.zone).toBe("encounterDeck");
  });
});

describe("Lieutenant of Mordor copying The Power of Mordor (05056:A:2, 05061:A:2)", () => {
  it("does not shuffle the Lieutenant, which is being revealed, back into the deck: the reveals end", () => {
    const t = table({ phase: "Quest", staging: [CITADEL], discard: ["05061"], deck: ["05056", "f0", "f0", "f0"] });
    const revealed = run(t, t.state, { verb: "RevealEncounter", who: "firstPlayer", times: 1 });
    const done = settle(revealed, t.ctx, []);
    const lieutenant = done.cards[idOf(t.state, "05056")];
    expect(lieutenant?.zone).toBe("staging");
    expect(done.stack.length).toBeLessThan(5);
  });
});

describe("ResolveTopmostTreachery (05056:A:2)", () => {
  it("with no treachery in the discard pile nothing happens", () => {
    const t = table({ discard: ["05056"], phase: "Encounter" });
    expect(run(t, t.state, { verb: "ResolveTopmostTreachery" })).toEqual({ ...t.state, window: null });
  });
});


describe("the immediate advance waits for the window of the last Battleground location (05072:B:2, 05033:A:2, 05035:A:2)", () => {
  // The quest on stage 1: The Banks, the last Battleground location, is active with 2 of its 3 progress, and the committed Defense explores it. `removed` are the stages already set aside.
  const questing = (removed: readonly string[]) => {
    const t = table({ phase: "Quest", active: { code: BANKS, progress: 2 }, deck: ["f0", "f0", "f0", "f0"] });
    const prepared = removed.reduce((state, code) => run(t, state, { verb: "RemoveStage", code }), t.state);
    const committed = send(start({ ...prepared, window: { kind: "pass" } }), { type: "Commit", cardIds: [t.hero, t.hero2] }, t.ctx);
    return { t, run: send(committed, { type: "Pass" }, t.ctx) };
  };
  const answerBanks = (made: ReturnType<typeof questing>) => {
    const banks = idOf(made.t.state, BANKS);
    const response = legalIntents(made.run.state, made.t.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === banks);
    expect(response).toBeDefined();
    return send(made.run, response as Parameters<typeof send>[1], made.t.ctx).state;
  };

  it("the Response of The Banks is offered while stage 1 is still current, and the advance comes after it resolved", () => {
    const made = questing([]);
    expect(made.run.state.cards[idOf(made.t.state, BANKS)]?.zone).toBe("victory");
    expect(codeOf(made.run.state, made.run.state.questStage)).toBe(CODES.defense);
    const answered = answerBanks(made);
    expect(codeOf(answered, answered.questStage)).toBe(AT_APPROACH);
    expect(answered.cards[idOf(made.t.state, REINFORCING)]?.zone).toBe("setAside");
  });

  it("with stages 3 and 4 removed the Response removes stage 2 and the advance after it reveals The Last Battle, whose When Revealed resolves then", () => {
    const made = questing([AT_APPROACH, AT_CITADEL]);
    expect(codeOf(made.run.state, made.run.state.questStage)).toBe(CODES.defense);
    const answered = answerBanks(made);
    expect(codeOf(answered, answered.questStage)).toBe(LAST_BATTLE);
    expect(answered.staging.length).toBeGreaterThan(0);
  });
});

describe("an undefended attack whose shadow removes its target is aimed again and stays undefended (rr.step-6-4-3, 05072:B:2, 05032:A:2)", () => {
  const ALLY_FLAG: Effect = { id: "ally:constant:1", cardCode: "ally", lines: ["ally:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "takesUndefendedDamage", amount: 1, until: "whileSourceInPlay" }] };
  // Stage 1, The Banks (1 damage) the last Battleground location, f3 attacks with Siege Raft dealt as its shadow; the player declares the attack undefended, aimed at The Banks. `tweak` changes the table first.
  const attacked = (made = table({ phase: "Encounter", staging: [{ code: BANKS, damage: 1 }], engaged: [{ code: "f3", seat: 0 }], deck: ["05032", "f0", "f0", "f0"], hand: ["filler", "filler"] }, [...EFFECTS, ALLY_FLAG]), tweak?: (state: ScenarioState) => ScenarioState) => {
    let run = send(start(syncConstants(tweak ? tweak(made.state) : made.state, made.ctx)), { type: "DeclineEngage" }, made.ctx);
    for (let guard = 0; guard < 30 && run.state.window?.kind !== "defense"; guard += 1) {
      const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack" || intent.type === "DeclineEngage");
      if (!pass) break;
      run = send(run, pass as Parameters<typeof send>[1], made.ctx);
    }
    expect(run.state.window?.kind).toBe("defense");
    return { made, run: passUntilAsked(send(run, { type: "Undefended", heroId: idOf(run.state, BANKS) }, made.ctx), made.ctx) };
  };
  // The windows between the steps of the attack are passed; the walk stops at the defense window asked again or when the attack is over.
  const passUntilAsked = (from: ReturnType<typeof send>, ctx: LayoutTable["ctx"]) => {
    let run = from;
    for (let guard = 0; guard < 30 && run.state.pendingAttack != null && run.state.window?.kind !== "defense"; guard += 1) run = send(run, { type: "Pass" }, ctx);
    return run;
  };

  it("keeps the attack undefended: no defender is offered and the player names the hero who takes the damage once", () => {
    const { made, run } = attacked();
    expect(run.state.window?.kind).toBe("defense");
    expect(run.state.pendingAttack?.undefended).toBe(true);
    expect(legalIntents(run.state, made.ctx).some((intent) => intent.type === "DeclareDefender")).toBe(false);
    const done = passUntilAsked(send(run, { type: "Undefended", heroId: made.hero2 }, made.ctx), made.ctx).state;
    expect(done.cards[made.hero2]?.damage).toBe(1);
    expect(done.cards[made.hero]?.damage).toBe(0);
  });

  it("names the one legal target silently: a seat with one hero takes it at once", () => {
    const made = table({ phase: "Encounter", staging: [{ code: BANKS, damage: 1 }], engaged: [{ code: "f3", seat: 0 }], deck: ["05032", "f0", "f0", "f0"], hand: ["filler", "filler"] }, [...EFFECTS, ALLY_FLAG]);
    const { run } = attacked(made, (state) => moveCard(state, made.hero2, { zone: "discard", seat: 0 }));
    expect(run.state.window?.kind).not.toBe("defense");
    expect(run.state.cards[made.hero]?.damage).toBe(1);
  });

  it("asks when a character that may take undefended damage stands beside the one hero", () => {
    const made = table({ phase: "Encounter", staging: [{ code: BANKS, damage: 1 }], engaged: [{ code: "f3", seat: 0 }], play: ["ally"], deck: ["05032", "f0", "f0", "f0"], hand: ["filler", "filler"] }, [...EFFECTS, ALLY_FLAG]);
    const { run } = attacked(made, (state) => moveCard(state, made.hero2, { zone: "discard", seat: 0 }));
    expect(run.state.window?.kind).toBe("defense");
    expect(run.state.pendingAttack?.undefended).toBe(true);
    const ally = idOf(run.state, "ally");
    const done = passUntilAsked(send(run, { type: "Undefended", heroId: ally }, made.ctx), made.ctx).state;
    expect(done.cards[ally]?.damage).toBe(1);
  });
});
