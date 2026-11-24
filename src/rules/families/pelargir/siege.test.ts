// Rules: ats.cair-andros-location-damage, ats.cair-andros-defense-carry-over, ats.cair-andros-remove-stage, ats.cair-andros-remove-stage-example, rr.removed-from-game, rr.quest-advancement, rr.cannot, rr.staging, faq.cancel-encounter-effect, hon.battle, hon.siege (data/rules/entries.json); ledger lines 05033:A:1, 05033:A:2, 05058:A:1, 05056:A:2, 05061:A:2, 05072:B:2, 05076:B:3.
// The engine reads The Siege of Cair Andros adds in the pelargir family: the Battleground locations removed from the game at a damage total, the redirect of undefended damage, the quest advancing when none is left, the stages removed from the quest deck, the copied
// When Revealed effect, the staging area shuffled into the encounter deck, the lock on resources and the stage that loses Siege. A card that holds none of the new flags reads as before (the last tests).
import { describe, expect, it } from "vitest";

import { undefendedTargets } from "../../combat/combat.ts";
import type { EngineStep } from "../../core/intents.ts";
import { destroyCard, placeDamage } from "../../core/keywords.ts";
import { UNATTRIBUTED } from "../../core/cause.ts";
import type { ScenarioState } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { settle } from "../../engine/machine.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { payerOk } from "../costs/pay.ts";
import { spendablePools } from "../costs/verbs.ts";
import { currentQuestHas } from "../quest/conditions.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { heroCard, idOf, tableFromLayout, type Layout, type LayoutTable } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "the-siege-of-cair-andros";
const CITADEL = "05033";
const APPROACH = "05034";
const BANKS = "05035";
const [DEFENSE, REINFORCING, AT_APPROACH, AT_CITADEL, LAST_BATTLE] = ["05072", "05073", "05074", "05075", "05076"] as const;
const THREE = [CITADEL, APPROACH, BANKS];

const table = (layout: Layout): LayoutTable => tableFromLayout(SCENARIO, { ...layout, stage: layout.stage ?? DEFENSE });
const run = (t: LayoutTable, state: ScenarioState, instruction: Parameters<typeof runInstruction>[1]): ScenarioState => runInstruction({ ...state, window: null }, instruction, { seat: 0, sourceId: null }, t.ctx, []);
const codeOf = (state: ScenarioState, id: string | null): string | undefined => (id ? state.cards[id]?.code : undefined);
const hurt = (t: LayoutTable, code: string, amount: number): ScenarioState => {
  const steps: EngineStep[] = [];
  const state = placeDamage({ ...t.state, window: null }, idOf(t.state, code), amount, t.ctx.cards, steps, "framework", UNATTRIBUTED);
  return settle(state, t.ctx, steps);
};

describe("removedAtDamage (05033:A:1, 05034:A:1, 05035:A:1)", () => {
  it("a Battleground location with its total of damage is removed from the game: not explored, no pile, damage and progress gone", () => {
    for (const [code, total] of [[CITADEL, 11], [APPROACH, 7], [BANKS, 3]] as const) {
      const t = table({ staging: THREE });
      const short = hurt(t, code, total - 1);
      expect(short.cards[idOf(t.state, code)]?.zone).toBe("staging");
      const gone = hurt(t, code, total);
      expect(gone.cards[idOf(t.state, code)]?.zone).toBe("removed");
      expect(gone.victory).toEqual([]);
      expect(gone.encounterDiscard).toEqual([]);
    }
  });

  it("the active location is removed too, and the damage beyond the total is lost", () => {
    const t = table({ active: BANKS, staging: [CITADEL, APPROACH] });
    const gone = hurt(t, BANKS, 5);
    expect(gone.cards[idOf(t.state, BANKS)]?.zone).toBe("removed");
    expect(gone.activeLocation).toBeNull();
  });

  it("damage is separate from progress: progress on the active location does not remove it", () => {
    const t = table({ active: { code: BANKS, progress: 1 }, staging: [CITADEL, APPROACH] });
    expect(t.state.cards[idOf(t.state, BANKS)]?.zone).toBe("activeLocation");
    expect(settle({ ...t.state, window: null }, t.ctx, []).cards[idOf(t.state, BANKS)]?.zone).toBe("activeLocation");
  });
});

describe("undefendedToBattleground (05072:B:2)", () => {
  it("an undefended attack's damage goes to the lowest Threat Battleground location in play, in the staging area or active", () => {
    const t = table({ staging: THREE });
    expect(undefendedTargets(t.state, 0, t.ctx.cards).map((id) => codeOf(t.state, id))).toEqual([BANKS]);
    const active = table({ active: BANKS, staging: [CITADEL, APPROACH] });
    expect(undefendedTargets(active.state, 0, active.ctx.cards).map((id) => codeOf(active.state, id))).toEqual([BANKS]);
    const without = table({ staging: [CITADEL, APPROACH] });
    expect(undefendedTargets(without.state, 0, without.ctx.cards).map((id) => codeOf(without.state, id))).toEqual([APPROACH]);
  });

  it("no Battleground location in play, or another stage: the heroes take it", () => {
    const none = table({ staging: ["05056"] });
    expect(undefendedTargets(none.state, 0, none.ctx.cards).map((id) => codeOf(none.state, id))).toEqual(["dh1", "dh2"]);
    const later = table({ staging: THREE, stage: AT_APPROACH });
    expect(undefendedTargets(later.state, 0, later.ctx.cards).map((id) => codeOf(later.state, id))).toEqual(["dh1", "dh2"]);
  });
});

describe("advancesWithoutBattleground (05072:B:2)", () => {
  it("the quest advances at once when the last Battleground location is removed by damage, to stage 2 while it is in the quest deck", () => {
    const t = table({ staging: [BANKS] });
    const settled = hurt(t, BANKS, 3);
    expect(codeOf(settled, settled.questStage)).toBe(REINFORCING);
  });

  it("not while a Battleground location is in play, and not for a stage that does not hold it", () => {
    const t = table({ staging: [BANKS, APPROACH] });
    expect(codeOf(hurt(t, BANKS, 3), hurt(t, BANKS, 3).questStage)).toBe(DEFENSE);
    const later = table({ staging: [], stage: AT_APPROACH });
    expect(codeOf(settle({ ...later.state, window: null }, later.ctx, []), later.state.questStage)).toBe(AT_APPROACH);
  });
});

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
  it("resolves the When Revealed effects of the last treachery in the encounter discard pile and leaves it there", () => {
    const t = table({ discard: ["05036", "05056"], phase: "Encounter" });
    const state = run(t, t.state, { verb: "ResolveTopmostTreachery" });
    expect(state.stack.length).toBeGreaterThan(0);
    expect(state.encounterDiscard).toEqual(t.state.encounterDiscard);
  });

  it("with no treachery in the discard pile nothing happens", () => {
    const t = table({ discard: ["05056"], phase: "Encounter" });
    expect(run(t, t.state, { verb: "ResolveTopmostTreachery" })).toEqual({ ...t.state, window: null });
  });
});

describe("cannotSpendResources (05058:A:1)", () => {
  // The stand-in hero dh1 is given another sphere; dh2 stays Tactics.
  const withSphere = (layout: Layout, sphere: "leadership" | "spirit" | "lore" | "neutral"): LayoutTable => {
    const t = table(layout);
    const cards = new Map(t.ctx.cards).set("dh1", { ...heroCard("dh1"), sphere });
    const ctx = { ...t.ctx, cards };
    return { ...t, ctx, state: syncConstants(t.state, ctx) };
  };

  it("a hero with a Leadership, Spirit or Lore icon cannot pay while Orc Vanguard is in the staging area, and a Tactics one can", () => {
    for (const sphere of ["leadership", "spirit", "lore"] as const) {
      const t = withSphere({ heroResources: 2, staging: ["05058"] }, sphere);
      const marked = idOf(t.state, "dh1");
      const tactics = idOf(t.state, "dh2");
      expect(payerOk(t.state, marked, 0, undefined, t.ctx)).toBe(false);
      expect(payerOk(t.state, tactics, 0, undefined, t.ctx)).toBe(true);
      expect(spendablePools(t.state, 0, { sphere }, t.ctx).pools).not.toContain(marked);
      expect(spendablePools(t.state, 0, { sphere: "tactics" }, t.ctx).pools).toEqual([tactics]);
    }
  });

  it("a neutral hero pays, and nothing is held back when Orc Vanguard is not in the staging area", () => {
    const neutral = withSphere({ heroResources: 2, staging: ["05058"] }, "neutral");
    expect(payerOk(neutral.state, idOf(neutral.state, "dh1"), 0, undefined, neutral.ctx)).toBe(true);
    const away = withSphere({ heroResources: 2 }, "lore");
    expect(payerOk(away.state, idOf(away.state, "dh1"), 0, undefined, away.ctx)).toBe(true);
  });
});

describe("losesSiege (05076:B:3)", () => {
  it("The Last Battle has Siege until the victory display holds 4 points, then Battle in its place", () => {
    const few = table({ stage: LAST_BATTLE, victory: [BANKS, APPROACH] });
    expect(currentQuestHas(few.state, "siege", few.ctx.cards)).toBe(true);
    expect(currentQuestHas(few.state, "battle", few.ctx.cards)).toBe(false);
    const enough = table({ stage: LAST_BATTLE, victory: [BANKS, CITADEL] });
    expect(currentQuestHas(enough.state, "siege", enough.ctx.cards)).toBe(false);
    expect(currentQuestHas(enough.state, "battle", enough.ctx.cards)).toBe(true);
  });

  it("another stage keeps the Siege it prints", () => {
    const t = table({ stage: AT_CITADEL, victory: [BANKS, CITADEL] });
    expect(currentQuestHas(t.state, "siege", t.ctx.cards)).toBe(true);
  });
});

describe("the Response of an explored Battleground location (05035:A:2)", () => {
  it("is offered when The Banks is explored as the active location, and removes stage 2", () => {
    const t = table({ active: { code: BANKS, progress: 3 }, staging: [CITADEL, APPROACH] });
    const id = idOf(t.state, BANKS);
    const explored = settle(moveCard(destroyCard({ ...t.state, window: null }, id, t.ctx.cards, [], true), id, { zone: "victory" }), t.ctx, []);
    expect(explored.window?.kind).toBe("response");
    const removed = run(t, t.state, { verb: "RemoveStage", code: REINFORCING });
    expect(removed.questDeck.map((one) => codeOf(removed, one))).not.toContain(REINFORCING);
  });

  it("is not offered when The Banks is removed by damage", () => {
    const t = table({ active: BANKS, staging: [CITADEL, APPROACH] });
    expect(hurt(t, BANKS, 3).window?.kind).not.toBe("response");
  });
});
