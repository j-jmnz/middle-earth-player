// Rules: rr.action, rr.travel, rr.reveal, rr.cannot, rr.surge, rr.cancel, rr.attacks-outside-the-combat-phase, ats.controlling-locations, hon.archery, hon.siege, hon.battle (data/rules/entries.json); ledger lines 06095:A:1, 06097:A:1, 06098:A:1, 06098:A:2, 06099:A:1, 06099:A:2, 06100:A:1, 06101:A:1, 06104:A:1, 06105:A:1.
// The other cards of Assault on Osgiliath, each on a real moment: the Southron Commander's immediate attack on a player who controls a location, the Travel line of The King's Library, the locations the players cannot travel to, the Actions of Ancient Harbor and The Old Bridge, the keywords West Quarter and East Quarter
// give the quest, Pinned Down's archery and Street Fighting.
import { expect } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { archeryTotal } from "../../../rules/combat/combat.ts";
import type { PlayerIntent } from "../../../rules/engine/reduce.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { finish, idOf, legalIntents, legalTargets, revealFromTop, send, type LayoutTable, type Run } from "../../../../test/harness/scene-kit.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { BOROMIR, CODES, cardOf, controlled, drive, opened, table, where } from "../../../../test/scenarios/assault-on-osgiliath/table.ts";

const COMMANDER = "06095";
const ELITE = "06047";
const EOWYN = "01007";

/** The card is revealed from the top of the encounter deck of the state and its effects are resolved, the first option of a choice taken unless `pick` names one. */
const revealed = (made: LayoutTable, state: ScenarioState, code: string, pick?: (state: ScenarioState) => string): Run => finish({ state: revealFromTop({ ...state, window: null }, made.ctx, code, []).state, steps: [] }, made.ctx, pick);

/** The quest phase explores Ancient Harbor (the first player takes control of it), and the game goes on to the travel phase. */
function controlling(effects: readonly Effect[], more: Parameters<typeof table>[0] = {}) {
  const made = table({ phase: "Quest", active: { code: CODES.harbor, progress: 4 }, committed: ["dh1", "dh2"], ...more }, effects, [BOROMIR, EOWYN, ELITE]);
  const run = drive(made, send(opened(made), { type: "Pass" }, made.ctx), (state) => state.phase === "Travel");
  expect(controlled(run.state)).toEqual([CODES.harbor]);
  return { made, state: run.state };
}

lineSpec("06095:A:1", "makes an immediate attack from the staging area against the player who controls a location, and none when he controls none", (effects) => {
  const { made, state } = controlling(effects, { staging: [CODES.westQuarter] });
  const attacked = revealed(made, state, COMMANDER);
  expect(attacked.state.pendingAttack).toMatchObject({ enemyId: idOf(attacked.state, COMMANDER), seat: 0 });
  const free = table({ phase: "Travel", staging: [CODES.westQuarter] }, effects);
  expect(revealed(free, free.state, COMMANDER).state.pendingAttack).toBeNull();
});

lineSpec("06095:A:1", "attacks only the first player, the one who controls the locations, in a game of two players", (effects) => {
  const { made, state } = controlling(effects, { seats: 2, firstPlayer: 1, staging: [CODES.westQuarter] });
  const attacked = revealed(made, state, COMMANDER);
  expect(attacked.state.pendingAttack).toMatchObject({ enemyId: idOf(attacked.state, COMMANDER), seat: 1 });
});

lineSpec("06097:A:1", "Travel: the cost is to reveal the top card of the encounter deck and add it to the staging area", (effects) => {
  const made = table({ phase: "Travel", staging: [CODES.library], deck: ["f3", "f0", "f0"] }, effects);
  const run = send(opened(made), { type: "Travel", locationId: idOf(made.state, CODES.library) } as PlayerIntent, made.ctx);
  expect(run.state.activeLocation).toBe(idOf(run.state, CODES.library));
  expect(where(run.state, "f3")).toBe("staging");
  expect(run.state.encounterDeck).toHaveLength(2);
});

lineSpec("06098:A:1", "the players cannot travel to Ancient Harbor, while they can to another location in the staging area", (effects) => {
  const made = table({ phase: "Travel", staging: [CODES.harbor, CODES.westQuarter] }, effects);
  expect(legalTargets(made.state, { type: "Travel" }, made.ctx)).toEqual([idOf(made.state, CODES.westQuarter)]);
});

lineSpec("06099:A:1", "the players cannot travel to The Old Bridge, while they can to another location in the staging area", (effects) => {
  const made = table({ phase: "Travel", staging: [CODES.bridge, CODES.westQuarter] }, effects);
  expect(legalTargets(made.state, { type: "Travel" }, made.ctx)).toEqual([idOf(made.state, CODES.westQuarter)]);
});

/** The Trigger of the effect, as the open window offers it. */
const offered = (made: LayoutTable, state: ScenarioState, effectId: string): PlayerIntent | undefined => legalIntents(state, made.ctx).find((intent) => intent.type === "Trigger" && intent.effectId === effectId) as PlayerIntent | undefined;

lineSpec("06098:A:2", "Combat Action: exhausting a hero places 1 progress on it, in the staging area; it is not offered in the planning phase", (effects) => {
  const made = table({ phase: "Combat", staging: [{ code: CODES.harbor, progress: 1 }] }, effects);
  const trigger = offered(made, made.state, "06098:action:1");
  expect(trigger).toBeDefined();
  const run = drive(made, send(opened(made), trigger as PlayerIntent, made.ctx), (state) => (cardOf(state, CODES.harbor)?.progress ?? 0) > 1);
  expect(cardOf(run.state, CODES.harbor)?.progress).toBe(2);
  const planning = table({ phase: "Planning", staging: [{ code: CODES.harbor, progress: 1 }] }, effects);
  expect(offered(planning, planning.state, "06098:action:1")).toBeUndefined();
});

lineSpec("06099:A:2", "Planning Action: spending 2 resources places 1 progress on it, and 1 resource when another Osgiliath location is in the staging area", (effects) => {
  const pay = (staging: readonly (string | { code: string; progress: number })[]) => {
    const made = table({ phase: "Planning", staging, heroResources: 2 }, effects);
    const trigger = offered(made, made.state, staging.length > 1 ? "06099:action:2" : "06099:action:1");
    expect(trigger).toBeDefined();
    // The cost is paid from the pool of the first hero (2 resources) or of both (1 for a card that costs 1 here).
    const cost = staging.length > 1 ? 1 : 2;
    const paid = { ...(trigger as Extract<PlayerIntent, { type: "Trigger" }>), payments: [{ heroId: made.hero, amount: cost }] };
    const run = drive(made, send(opened(made), paid, made.ctx), (state) => (cardOf(state, CODES.bridge)?.progress ?? 0) > 0);
    const spent = [made.hero, made.hero2].reduce((sum, hero) => sum + (2 - (run.state.cards[hero]?.resources ?? 2)), 0);
    return { progress: cardOf(run.state, CODES.bridge)?.progress, spent };
  };
  expect(pay([{ code: CODES.bridge, progress: 0 }])).toEqual({ progress: 1, spent: 2 });
  expect(pay([{ code: CODES.bridge, progress: 0 }, CODES.westQuarter])).toEqual({ progress: 1, spent: 1 });
});

/** Boromir (Willpower 1, Attack 3, Defense 2) is the only character committed: the quest total says which stat was counted. */
function counted(active: string, effects: readonly Effect[]): number {
  const made = table({ phase: "Quest", active, heroes: [{ code: BOROMIR, seat: 0 }], committed: [BOROMIR] }, effects, [BOROMIR]);
  const quest = send(opened(made), { type: "Pass" }, made.ctx).steps.find((step) => step.kind === "quest");
  return quest?.kind === "quest" ? quest.willpower : -1;
}

/** As `counted`, with a location in the staging area, and with Ruined Tower traveled to as the second active location when `tower` is set (Boromir is committed after the travel). */
function countedWith(active: string, staging: readonly string[], tower: boolean, effects: readonly Effect[]): number {
  const made = table({ phase: tower ? "Travel" : "Quest", active, staging: tower ? [...staging, CODES.tower] : staging, heroes: [{ code: BOROMIR, seat: 0 }], committed: tower ? [] : [BOROMIR] }, effects, [BOROMIR]);
  let run = opened(made);
  if (tower) {
    run = send(run, { type: "Travel", locationId: idOf(made.state, CODES.tower) } as PlayerIntent, made.ctx);
    run = drive(made, run, (state) => state.phase === "Quest" && state.mode === "questCommit");
    run = send(run, { type: "Commit", cardIds: [idOf(run.state, BOROMIR)] }, made.ctx);
  }
  const quest = send(run, { type: "Pass" }, made.ctx).steps.find((step) => step.kind === "quest");
  return quest?.kind === "quest" ? quest.willpower : -1;
}

lineSpec("06100:A:1", "while West Quarter is the active location the quest counts Defense in place of Willpower", (effects) => {
  expect(counted(CODES.westQuarter, effects)).toBe(2);
  expect(counted(CODES.harbor, effects)).toBe(1);
});

lineSpec("06100:A:1", "counts Willpower while West Quarter is only in the staging area, and Defense when Ruined Tower is the second active location beside it", (effects) => {
  expect(countedWith(CODES.harbor, [CODES.westQuarter], false, effects)).toBe(1);
  expect(countedWith(CODES.harbor, [CODES.westQuarter], true, effects)).toBe(1);
  expect(countedWith(CODES.westQuarter, [], true, effects)).toBe(2);
});

lineSpec("06101:A:1", "while East Quarter is the active location the quest counts Attack in place of Willpower", (effects) => {
  expect(counted(CODES.eastQuarter, effects)).toBe(3);
  expect(counted(CODES.harbor, effects)).toBe(1);
});

lineSpec("06101:A:1", "counts Willpower while East Quarter is only in the staging area, and Attack when Ruined Tower is the second active location beside it", (effects) => {
  expect(countedWith(CODES.harbor, [CODES.eastQuarter], false, effects)).toBe(1);
  expect(countedWith(CODES.harbor, [CODES.eastQuarter], true, effects)).toBe(1);
  expect(countedWith(CODES.eastQuarter, [], true, effects)).toBe(3);
});

/** Round 1 explores Ancient Harbor; round 2 reveals Pinned Down, and the combat phase asks the players to divide the archery total (the first round's is divided first). */
function toArchery(staging: readonly string[], deck: readonly string[], effects: readonly Effect[]) {
  const made = table({ phase: "Quest", active: { code: CODES.harbor, progress: 4 }, heroes: [{ code: EOWYN, seat: 0 }], committed: ["dh1", "dh2", EOWYN], staging: [CODES.westQuarter, ...staging], deck }, effects, [ELITE, EOWYN]);
  const first = drive(made, send(opened(made), { type: "Pass" }, made.ctx), (state) => state.window?.kind === "archery");
  const total = first.state.window?.kind === "archery" ? first.state.window.total : 0;
  return drive(made, send(first, { type: "Distribute", assignments: [{ cardId: made.hero2, amount: total }] }, made.ctx), (state) => state.window?.kind === "archery");
}

lineSpec("06104:A:1", "adds the number of locations the players control to the archery total, with the archery of an enemy in the staging area (Archery 2: a total of 3)", (effects) => {
  expect(toArchery([ELITE], ["f0", CODES.pinned, "f0", "f0", "f0", "f0"], effects).state.window).toMatchObject({ kind: "archery", total: 3 });
  expect(toArchery([ELITE], ["f0", "f0", "f0", "f0", "f0", "f0"], effects).state.window).toMatchObject({ kind: "archery", total: 2 });
});

lineSpec("06104:A:1", "counts the locations as it resolves: the number stays when a location is lost later in the round (the X is fixed)", (effects) => {
  // Éowyn (Willpower 4) quests as well: the Elite in the staging area has Threat the other heroes alone could not meet.
  const { made, state } = controlling(effects, { staging: [CODES.westQuarter, ELITE], heroes: [{ code: EOWYN, seat: 0 }], committed: ["dh1", "dh2", EOWYN] });
  const pinned = revealed(made, state, CODES.pinned);
  expect(archeryTotal(pinned.state, made.ctx.cards)).toBe(3);
  const lost = revealed(made, pinned.state, CODES.counter, (current) => (current.window?.kind === "choose" ? "return" : ""));
  expect(controlled(lost.state)).toEqual([]);
  expect(archeryTotal(lost.state, made.ctx.cards)).toBe(3);
});

lineSpec("06104:A:1", "gains surge with fewer than 4 locations controlled: the card after it is revealed too", (effects) => {
  const run = toArchery([ELITE], ["f0", CODES.pinned, CODES.eastQuarter, "f0", "f0", "f0"], effects);
  expect(where(run.state, CODES.eastQuarter)).toBe("staging");
});

/** Street Fighting is revealed with the deck given: cards are discarded until an Osgiliath location is discarded, and the first player takes control of it by exhausting a hero or it is added to the staging area. */
function streetFight(deck: readonly string[], discard: readonly string[], option: "take" | "stage", effects: readonly Effect[]) {
  const made = table({ phase: "Travel", deck, discard }, effects);
  const run = revealed(made, made.state, CODES.street, (state) => (state.window?.kind === "choose" ? (state.window.options.includes(option) ? option : (state.window.options[0] ?? "")) : ""));
  return { made, state: run.state };
}

lineSpec("06105:A:1", "discards cards until an Osgiliath location is discarded; the first player exhausts a hero to take control of it", (effects) => {
  const { state } = streetFight(["f0", "f3", CODES.eastQuarter, "f0", "f0"], [], "take", effects);
  expect(cardOf(state, CODES.eastQuarter)).toMatchObject({ zone: "play", controller: 0 });
  expect(controlled(state)).toEqual([CODES.eastQuarter]);
  // The cards before it were discarded; the cards after it stay in the deck.
  expect(where(state, "f3")).toBe("encounterDiscard");
  expect(state.encounterDeck).toHaveLength(2);
  expect(Object.values(state.cards).filter((card) => card.zone === "heroes" && card.exhausted)).toHaveLength(1);
});

lineSpec("06105:A:1", "adds the location to the staging area when the first player does not take control of it", (effects) => {
  const { state } = streetFight(["f0", CODES.eastQuarter, "f0", "f0"], [], "stage", effects);
  expect(cardOf(state, CODES.eastQuarter)?.zone).toBe("staging");
  expect(controlled(state)).toEqual([]);
  expect(Object.values(state.cards).filter((card) => card.zone === "heroes" && card.exhausted)).toHaveLength(0);
});

lineSpec("06105:A:1", "shuffles the discard pile back into the deck when the deck runs out before an Osgiliath location is found, and it cannot be canceled", (effects) => {
  const { state } = streetFight(["f0", "f0"], [CODES.westQuarter], "stage", effects);
  expect(cardOf(state, CODES.westQuarter)?.zone).toBe("staging");
  expect(state.window?.kind).not.toBe("cancel");
});
