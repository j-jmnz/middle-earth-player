// Rules: ats.cair-andros-remove-stage, ats.cair-andros-remove-stage-example, rr.staging, faq.cancel-encounter-effect (data/rules/entries.json); ledger lines 05033:A:2, 05056:A:2, 05061:A:2.
// The engine facts of the verbs The Siege of Cair Andros adds in the pelargir family that no printed line shows by itself: RemoveStage on any stage, the staging area shuffled into the encounter deck, the Lieutenant of Mordor copying The Power of Mordor, no
// treachery to resolve. The lines themselves (the removal at a damage total, the redirect, the locks, the keywords) are tested in src/campaign/scenarios/the-siege-of-cair-andros/lines.test.ts and spec.test.ts.
import { describe, expect, it } from "vitest";

import { settle } from "../../engine/machine.ts";
import { moveCard } from "../../core/zones.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { idOf } from "../../../../test/harness/scene-kit.ts";
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

