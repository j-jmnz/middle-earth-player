// Rules: rm.raven-deck, rm.time-x, faq.reveal-and-add, rr.then, rr.forced, rr.attacks-outside-the-combat-phase, rr.shadow-effects (data/rules/entries.json); ledger lines 08147:A:1, 08148:A:1, 08148:B:2, 08149:B:2, 08156:A:2, 08157:A:2.
// What the engine of The Antlered Crown does with the real records: the Setup of the Raven deck, a reveal from it against a take-and-add, the shuffle that cannot fail, the Raven shadow pair, a location dealt as a shadow card and the attacks of the last stage.
import { describe, expect, it } from "vitest";

import { fightEnemy, idOf, idsOf, resolveRecords, revealedTop, send, tableFromLayout, type Layout, type Run } from "../../../../test/harness/scene-kit.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { pileOf } from "../../../rules/core/piles.ts";
import { moveCard } from "../../../rules/core/zones.ts";

const SCENARIO = "the-antlered-crown";
const table = (layout: Layout) => tableFromLayout(SCENARIO, layout);
const STAGE_1 = "08147";
const STAGE_2 = "08148";
const STAGE_3 = "08149";
const TURCH = "08150";
const RAVEN_CHIEF = "08151";
const CAMP = "08152";
const WAR_CAMP = "08155";
const VILLAGE = "08156";
const BATTLEFIELD = "08157";
const PROWLER = "07042";
const WATCHER = "07043";
const TRIBESMAN = "07046";
const codes = (state: ScenarioState, ids: readonly string[]): (string | undefined)[] => ids.map((id) => state.cards[id]?.code);
const handSize = (state: ScenarioState, seat = 0): number => state.seats[seat]?.hand.length ?? 0;

describe("the Setup of the Raven deck (08147:A:1)", () => {
  // Chief Turch, Raven Chief and his Camp, and the six Raven enemies lie in the set-aside pile (the scenario's piles), the two locations are placed.
  const layout: Layout = { seats: 2, stage: STAGE_1, side: "A", active: BATTLEFIELD, staging: [WAR_CAMP], setAside: [TURCH, RAVEN_CHIEF, CAMP, PROWLER, PROWLER, "07043", "07044", TRIBESMAN, TRIBESMAN, "07047", "07048"] };
  const set = () => {
    const t = table(layout);
    return { t, done: resolveRecords(t.state, t.ctx, STAGE_1, "setup", t.state.questStage ?? "").state };
  };

  it("08147:A:1 the first player controls Chief Turch, who enters play; Raven Chief and his Camp stay set aside", () => {
    const { done } = set();
    expect(done.cards[idOf(done, TURCH)]).toMatchObject({ zone: "play", controller: 0 });
    expect(done.cards[idOf(done, RAVEN_CHIEF)]?.zone).toBe("setAside");
    expect(done.cards[idOf(done, CAMP)]?.zone).toBe("setAside");
  });

  it("08147:A:1 Dunland Battlefield and Raven War-camp take their Time counters as revealed locations do", () => {
    const { done } = set();
    expect(done.cards[idOf(done, BATTLEFIELD)]?.resources).toBe(3);
    expect(done.cards[idOf(done, WAR_CAMP)]?.resources).toBe(3);
  });

  it("08147:A:1 each player chooses an enemy of a different title from the Raven deck and adds it to the staging area, with no reveal", () => {
    const { done } = set();
    const added = done.staging.map((id) => done.cards[id]?.code).filter((code) => code !== WAR_CAMP);
    expect(added).toHaveLength(2);
    expect(new Set(added).size).toBe(2);
    // The Tribesman's When Revealed (each player draws a card) did not run, if one was added.
    expect(handSize(done) + handSize(done, 1)).toBe(handSize(table(layout).state) + handSize(table(layout).state, 1));
  });

  it("08147:A:1 the Raven deck holds the other copies, shuffled, and its discard pile exists, empty", () => {
    const { done } = set();
    expect(pileOf(done, "ravenDeck")).toHaveLength(6);
    expect(done.piles?.ravenDiscard).toEqual([]);
    for (const id of pileOf(done, "ravenDeck")) expect(done.cards[id]).toMatchObject({ zone: "ravenDeck", face: "down", deck: "raven" });
  });

  it("08147:A:1 solo, the one player adds one enemy", () => {
    const t = table({ ...layout, seats: 1 });
    const done = resolveRecords(t.state, t.ctx, STAGE_1, "setup", t.state.questStage ?? "").state;
    expect(done.staging.filter((id) => done.cards[id]?.code !== WAR_CAMP)).toHaveLength(1);
  });
});

describe("a reveal from the Raven deck against a take-and-add (08148:A:1, 08148:B:2)", () => {
  // Dunland Tribesman prints "When Revealed: Each player draws a card".
  const raven = { seats: 2 as const, piles: { ravenDeck: [TRIBESMAN, TRIBESMAN, PROWLER, PROWLER] }, deck: ["f0", "f0", "f0", "f0", "f0", "f0"], deckOf: ["filler", "filler", "filler", "filler"] };

  it("08148:A:1 each player takes a card and adds it to the staging area: no When Revealed, so nobody draws", () => {
    const t = table({ ...raven, stage: STAGE_2, side: "A" });
    const done = resolveRecords(t.state, t.ctx, STAGE_2, "whenRevealed", t.state.questStage ?? "").state;
    expect(codes(done, done.staging).sort()).toEqual([TRIBESMAN, TRIBESMAN]);
    expect(handSize(done)).toBe(handSize(t.state));
    expect(handSize(done, 1)).toBe(handSize(t.state, 1));
    expect(pileOf(done, "ravenDeck")).toHaveLength(2);
  });

  it("08148:B:2 the revealed Tribesman resolves its When Revealed: each player draws a card, and it is added to the staging area", () => {
    const t = table({ ...raven, stage: STAGE_2, timeCounters: 0 });
    const done = resolveRecords(t.state, t.ctx, STAGE_2, "forced", t.state.questStage ?? "").state;
    expect(codes(done, done.staging)).toEqual([TRIBESMAN]);
    expect(handSize(done)).toBe(handSize(t.state) + 1);
    expect(handSize(done, 1)).toBe(handSize(t.state, 1) + 1);
    expect(done.cards[done.questStage ?? ""]?.resources).toBe(3);
  });

  it("08148:A:1 rr.then: with an empty discard pile the shuffle cannot fail, so each player still takes a card; and the discard pile is shuffled in first", () => {
    const empty = table({ ...raven, stage: STAGE_2, side: "A" });
    expect(resolveRecords(empty.state, empty.ctx, STAGE_2, "whenRevealed", empty.state.questStage ?? "").state.staging).toHaveLength(2);
    const discard = table({ ...raven, piles: { ravenDiscard: [PROWLER, WATCHER] }, stage: STAGE_2, side: "A" });
    // The deck the Setup made is there, empty.
    const emptied = { ...discard.state, piles: { ...discard.state.piles, ravenDeck: [] } };
    const done = resolveRecords(emptied, discard.ctx, STAGE_2, "whenRevealed", discard.state.questStage ?? "").state;
    expect(codes(done, done.staging).sort()).toEqual([PROWLER, WATCHER]);
    expect(pileOf(done, "ravenDiscard")).toEqual([]);
  });
});

describe("shadow cards from the Raven deck (08156:A:2)", () => {
  const fight = (piles: Layout["piles"]) => fightEnemy((layout: Layout) => table(layout), VILLAGE, PROWLER, { seats: 1 as const, piles });
  const extras = (state: ScenarioState) => (state.cards[idOf(state, PROWLER)]?.extraShadowIds ?? []);

  it("08156:A:2 the attacking enemy is dealt 2 additional shadow cards from the top of the Raven deck, and the encounter deck is not touched", () => {
    const { during } = fight({ ravenDeck: [TRIBESMAN, WATCHER, PROWLER] });
    expect(codes(during, extras(during))).toEqual([TRIBESMAN, WATCHER]);
    expect(codes(during, pileOf(during, "ravenDeck"))).toEqual([PROWLER]);
    expect(during.encounterDeck.map((id) => during.cards[id]?.code)).not.toContain(TRIBESMAN);
  });

  it("08156:A:2 an empty Raven deck is refilled from its discard pile at once, between the two cards", () => {
    const { during } = fight({ ravenDeck: [TRIBESMAN], ravenDiscard: [WATCHER] });
    expect(codes(during, extras(during))).toEqual([TRIBESMAN, WATCHER]);
    expect(pileOf(during, "ravenDiscard")).toEqual([]);
  });

  it("08156:A:2 a shadow card of the Raven deck that is discarded goes to the Raven discard pile, not the encounter discard pile", () => {
    const { during } = fight({ ravenDeck: [TRIBESMAN, WATCHER, PROWLER] });
    const gone = moveCard(during, extras(during)[0] ?? "", { zone: "encounterDiscard" });
    expect(codes(gone, pileOf(gone, "ravenDiscard"))).toEqual([TRIBESMAN]);
    expect(codes(gone, gone.encounterDiscard)).not.toContain(TRIBESMAN);
  });
});

describe("a location dealt as a shadow card (08157:A:2)", () => {
  it("08157:A:2 Dunland Battlefield's printed Shadow deals 1 damage to the defending character", () => {
    const { run, made } = fightEnemy((layout: Layout) => table(layout), BATTLEFIELD, "f0", { seats: 1 as const });
    expect(run.state.cards[made.hero]?.damage).toBeGreaterThanOrEqual(1);
  });
});

describe("each engaged enemy makes an attack (08149:B:2)", () => {
  it("08149:B:2 each engaged enemy attacks the player it is engaged with and is dealt a shadow card of its own, then the stage gets 2 counters", () => {
    const t = table({ seats: 2, stage: STAGE_3, engaged: [{ code: PROWLER, seat: 0 }, { code: WATCHER, seat: 1 }], deck: ["f0", "f0", "f0", "f0"] });
    const attacks: { enemy: string; seat: number; shadows: number }[] = [];
    let run: Run = resolveRecords(t.state, t.ctx, STAGE_3, "forced", t.state.questStage ?? "", undefined, true);
    for (let guard = 0; guard < 12 && (run.state.window?.kind === "defense" || run.state.pendingAttack != null); guard += 1) {
      const attack = run.state.pendingAttack;
      if (run.state.window?.kind !== "defense" || attack == null) break;
      attacks.push({ enemy: run.state.cards[attack.enemyId]?.code ?? "", seat: attack.seat, shadows: [run.state.cards[attack.enemyId]?.shadowId].filter(Boolean).length });
      const hero = attack.seat === 0 ? t.hero : (t.seat1Hero ?? t.hero2);
      run = send(run, { type: "Undefended", heroId: hero }, t.ctx);
    }
    expect(attacks).toEqual([{ enemy: PROWLER, seat: 0, shadows: 1 }, { enemy: WATCHER, seat: 1, shadows: 1 }]);
    expect(run.state.cards[run.state.questStage ?? ""]?.resources).toBe(2);
  });

  it("08149:A:1 Raven Chief and his Camp join the staging area without a reveal, the Camp with its Time 3 counters, then the players minus 1 cards of the Raven deck", () => {
    const t = table({ seats: 2, stage: STAGE_3, side: "A", setAside: [RAVEN_CHIEF, CAMP], piles: { ravenDeck: [TRIBESMAN, PROWLER, WATCHER] } });
    const done = resolveRecords(t.state, t.ctx, STAGE_3, "whenRevealed", t.state.questStage ?? "").state;
    expect(codes(done, done.staging).sort()).toEqual([CAMP, RAVEN_CHIEF, TRIBESMAN].sort());
    expect(done.cards[idOf(done, CAMP)]?.resources).toBe(3);
    expect(pileOf(done, "ravenDeck")).toHaveLength(2);
    const solo = table({ seats: 1, stage: STAGE_3, side: "A", setAside: [RAVEN_CHIEF, CAMP], piles: { ravenDeck: [TRIBESMAN, PROWLER] } });
    const alone = resolveRecords(solo.state, solo.ctx, STAGE_3, "whenRevealed", solo.state.questStage ?? "").state;
    expect(codes(alone, alone.staging).sort()).toEqual([CAMP, RAVEN_CHIEF].sort());
    expect(idsOf(alone, TRIBESMAN)).toHaveLength(1);
  });
});

describe("the time counters on the locations in play (08153:A:1, 08159:A:1, 08161:A:1)", () => {
  const counters = (state: ScenarioState, code: string): number | undefined => state.cards[idOf(state, code)]?.resources;

  it("08153:A:1 the engaged player's hand gives X: the first player divides the X counters among the locations, one at a time", () => {
    const t = table({ seats: 2, staging: [{ code: VILLAGE, resources: 2 }], active: { code: BATTLEFIELD, resources: 3 }, engaged: [{ code: "08153", seat: 1 }], hand: [{ code: "filler", seat: 1 }, { code: "filler", seat: 1 }, { code: "filler", seat: 1 }] });
    const done = resolveRecords(t.state, t.ctx, "08153", "forced", idOf(t.state, "08153"), undefined, true, 1);
    // Three cards in the engaged player's hand: three counters come off, whichever locations the first player chose (the first option each time).
    expect((counters(done.state, VILLAGE) ?? 0) + (counters(done.state, BATTLEFIELD) ?? 0)).toBe(2);
  });

  it("08159:A:1 a location whose last counter goes gets X again before its Forced effect resolves, and the others lose 1", () => {
    const t = table({ staging: [{ code: VILLAGE, resources: 1 }], active: { code: BATTLEFIELD, resources: 3 }, deck: ["f0", "f0"], piles: { ravenDeck: [PROWLER, WATCHER] } });
    const { state, id } = resolveRecords(t.state, t.ctx, "08159", "whenRevealed");
    expect(counters(state, BATTLEFIELD)).toBe(2);
    expect(counters(state, VILLAGE)).toBe(2);
    expect(state.cards[id]?.zone).toBe("staging");
  });

  it("08159:A:1 gains surge when no location is in the staging area, and not when one is", () => {
    // Surge reveals one more card: the encounter deck is one card shorter.
    const none = table({ active: { code: BATTLEFIELD, resources: 3 }, deck: ["f0", "f0"] });
    const some = table({ active: { code: BATTLEFIELD, resources: 3 }, staging: [{ code: VILLAGE, resources: 2 }], deck: ["f0", "f0"] });
    expect(revealedTop(none, "08159").encounterDeck).toHaveLength(1);
    expect(revealedTop(some, "08159").encounterDeck).toHaveLength(2);
  });

  it("08161:A:1 all progress comes off the locations in the staging area (not the active one) and raises the staging threat by that much", () => {
    const t = table({ staging: [{ code: VILLAGE, progress: 2 }, { code: "08158", progress: 1 }], active: { code: BATTLEFIELD, progress: 2 } });
    const { state } = resolveRecords(t.state, t.ctx, "08161", "whenRevealed");
    expect([state.cards[idOf(state, VILLAGE)]?.progress, state.cards[idOf(state, "08158")]?.progress, state.cards[idOf(state, BATTLEFIELD)]?.progress]).toEqual([0, 0, 2]);
    expect(state.modifiers.some((modifier) => modifier.stat === "moreStagingThreat" && modifier.amount === 3 && modifier.until === "endOfPhase")).toBe(true);
    // Surge when no progress was removed: one more card is revealed.
    const bare = table({ staging: [VILLAGE], deck: ["f0", "f0"] });
    expect(revealedTop(bare, "08161").encounterDeck).toHaveLength(1);
    const hit = table({ staging: [{ code: VILLAGE, progress: 1 }], deck: ["f0", "f0"] });
    expect(revealedTop(hit, "08161").encounterDeck).toHaveLength(2);
  });
});
