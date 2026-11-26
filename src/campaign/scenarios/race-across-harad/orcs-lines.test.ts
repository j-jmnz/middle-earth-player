// Rules: hrd.orcs-area, hrd.orcs-area-different-stage, hrd.orcs-area-same-stage, hrd.stage-number, hrd.side-quests, rr.forced, rr.cannot, rr.quest-advancement, rr.first-player, rr.lasting-effects, faq.triggering-forced-effects (data/rules/entries.json).
// Line tests for the stages of Race Across Harad, each titled with its ledger line and run again without the line's records, which must fail (test/harness/line-spec.ts): the players' stages 17048 to 17050 (side A When Revealed, side B Forced effects and the cap) and the
// Orcs' stages 17051 to 17054 (the progress, the Chieftain that cannot leave, the loss of a defeated stage). The cards and the Setup are in spec.test.ts.
import { expect } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { flagged, type ScenarioState } from "../../../rules/core/state.ts";
import { spawn } from "../../../rules/core/zones.ts";
import { fight, idOf, idsOf, opened, resolveRecords, run as runInstruction, type Layout } from "../../../../test/harness/scene-kit.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { currentSideQuest } from "../../../rules/families/wilderland/night-quest.ts";
import { questCapTally, questRoom } from "../../../rules/families/caves/progress.ts";
import { advancedTo, CHIEFTAIN, codeOf, MUMAK, ORCS_STAGES, prepared, raceTable, record, sideQuestCurrent, stageId, TREACHERY, URUK } from "../../../rules/families/haradrim/race-kit.ts";

const WARG_RIDER = "16063";
const SIDE_QUEST = "10160";

/** The main quest card is the stage with this code, the players' stage in the layout's Orcs' area as the Setup leaves it, the table settled. */
const at = (effects: readonly Effect[], stage: string, layout: Layout = {}, number = 1) => {
  const { made, state } = prepared({ stage, ...layout }, effects);
  return { made, state: opened(made, advancedTo(made, state, number)).state };
};

lineSpec("17048:A:1", "Racing North: the first player chooses the staging area for the set aside Uruk Warg-rider, added and not revealed", (effects) => {
  const { made, state } = prepared({ stage: "17048", setAside: [...ORCS_STAGES, CHIEFTAIN, WARG_RIDER] }, effects);
  const done = resolveRecords(state, made.ctx, "17048", "whenRevealed", idOf(state, "17048"), () => "staging").state;
  expect(done.cards[idOf(done, WARG_RIDER)]?.zone).toBe("staging");
});

lineSpec("17048:A:1", "Racing North: the first player chooses the Orcs' area for the Uruk Warg-rider, and the two options are the choice", (effects) => {
  const { made, state } = prepared({ stage: "17048", setAside: [...ORCS_STAGES, CHIEFTAIN, WARG_RIDER] }, effects);
  const asked = record(made, state, "17048:whenRevealed:1", idOf(state, "17048"), "whenRevealed");
  expect(asked.window?.kind === "choose" ? asked.window.options : []).toEqual(["staging", "orcsArea"]);
  const done = resolveRecords(state, made.ctx, "17048", "whenRevealed", idOf(state, "17048"), () => "orcsArea").state;
  expect(done.cards[idOf(done, WARG_RIDER)]?.zone).toBe("orcsArea");
  expect(done.orcs?.members).toContain(idOf(done, WARG_RIDER));
});

lineSpec("17048:B:1", "Uruk Chieftain cannot take damage while stage 2B is in play, wherever he stands, and can at another stage", (effects) => {
  const held = at(effects, "17048");
  expect(flagged(held.state, idOf(held.state, CHIEFTAIN), "cannotTakeDamage")).toBe(true);
  const other = at(effects, "17050");
  expect(flagged(other.state, idOf(other.state, CHIEFTAIN), "cannotTakeDamage")).toBe(false);
});

/** The cap in force after the stage's Forced effect resolved at the start of the staging step, or null when none holds; `side` makes a side quest the current quest first. */
function capAfter(effects: readonly Effect[], id: string, code: string, layout: Layout = {}, side = false): number | null {
  const made = raceTable({ stage: code, phase: "Quest", setAside: [], ...(side ? { staging: [SIDE_QUEST] } : {}), ...layout }, effects, [SIDE_QUEST]);
  let state = opened(made).state;
  if (side) {
    state = sideQuestCurrent(state, idOf(state, SIDE_QUEST));
    expect(currentSideQuest(state)).toBe(idOf(state, SIDE_QUEST));
  }
  return questCapTally(record(made, state, id, idOf(state, code)))?.limit ?? null;
}

type Check = (effects: readonly Effect[]) => void;
const sizes = (id: string, code: string): Check => (effects) => {
  expect(capAfter(effects, id, code, { play: [MUMAK] })).toBe(5);
  expect(capAfter(effects, id, code, { play: [MUMAK], committed: [MUMAK] })).toBe(10);
  expect(capAfter(effects, id, code, {})).toBe(10);
};
const placed = (id: string, code: string): Check => (effects) => {
  const made = raceTable({ stage: code, phase: "Quest", setAside: [], play: [MUMAK], exhaustedCards: [MUMAK] }, effects);
  const state = record(made, opened(made).state, id, idOf(made.state, code));
  expect(questRoom(state)).toBe(5);
  expect(state.modifiers.filter((modifier) => modifier.stat === "questProgressCap").map((modifier) => modifier.until)).toEqual(["endOfRound"]);
};
const mainOnly = (id: string, code: string): Check => (effects) => {
  expect(capAfter(effects, id, code, { play: [MUMAK] })).toBe(5);
  expect(capAfter(effects, id, code, { play: [MUMAK] }, true)).toBeNull();
};
const SIZES = "caps the progress placed this round at 5, or at 10 when each Tamed Mûmak in play is committed";
const PLACED = "the progress already placed counts against the cap, which ends with the round";
const MAIN = "the cap is on this stage card, so a side quest that is the current quest is not capped";

lineSpec("17048:B:2", `stage 17048 ${SIZES}`, sizes("17048:forced:1", "17048"));
lineSpec("17048:B:2", `stage 17048: ${PLACED}`, placed("17048:forced:1", "17048"));
lineSpec("17048:B:2", `stage 17048: ${MAIN}`, mainOnly("17048:forced:1", "17048"));
lineSpec("17049:B:3", `stage 17049 ${SIZES}`, sizes("17049:forced:2", "17049"));
lineSpec("17049:B:3", `stage 17049: ${PLACED}`, placed("17049:forced:2", "17049"));
lineSpec("17049:B:3", `stage 17049: ${MAIN}`, mainOnly("17049:forced:2", "17049"));
lineSpec("17050:B:1", `stage 17050 ${SIZES}`, sizes("17050:forced:1", "17050"));
lineSpec("17050:B:1", `stage 17050: ${PLACED}`, placed("17050:forced:1", "17050"));
lineSpec("17050:B:1", `stage 17050: ${MAIN}`, mainOnly("17050:forced:1", "17050"));

lineSpec("17049:A:1", "Hunted in Harad: the discard pile is shuffled into the deck and an Orc enemy discarded from the top goes into the Orcs' area", (effects) => {
  const { made, state } = prepared({ stage: "17049", deck: [TREACHERY], discard: [URUK] }, effects);
  const done = record(made, state, "17049:whenRevealed:1", idOf(state, "17049"), "whenRevealed");
  expect(idsOf(done, URUK).map((id) => done.cards[id]?.zone)).toEqual(["orcsArea"]);
  expect(done.orcs?.members).toContain(idOf(done, URUK));
});

lineSpec("17049:B:1", "Uruk Chieftain cannot take damage while stage 3B is in play", (effects) => {
  const held = at(effects, "17049");
  expect(flagged(held.state, idOf(held.state, CHIEFTAIN), "cannotTakeDamage")).toBe(true);
  const other = at(effects, "17047");
  expect(flagged(other.state, idOf(other.state, CHIEFTAIN), "cannotTakeDamage")).toBe(false);
});

lineSpec("17049:B:2", "Hunted in Harad reveals one more encounter card while the Orcs' stage is 2D and the Chieftain is in the Orcs' area, and none otherwise", (effects) => {
  const at2d = () => {
    const first = prepared({ stage: "17049" }, effects);
    let state = advancedTo(first.made, first.state, 2);
    for (let count = 0; count < 3; count += 1) state = spawn(state, "16065", { zone: "encounterDeck" }, "down").state;
    return { made: first.made, state: opened(first.made, state).state };
  };
  const { made, state } = at2d();
  expect(state.orcs?.number).toBe(2);
  expect(record(made, state, "17049:forced:1", idOf(state, "17049")).encounterDeck.length).toBe(state.encounterDeck.length - 1);
  const gone = { ...state, cards: { ...state.cards, [idOf(state, CHIEFTAIN)]: { ...state.cards[idOf(state, CHIEFTAIN)]!, zone: "discard" as const } } };
  expect(record(made, gone, "17049:forced:1", idOf(gone, "17049")).encounterDeck.length).toBe(gone.encounterDeck.length);
  const later = { ...state, orcs: { ...state.orcs!, number: 3 } };
  expect(record(made, later, "17049:forced:1", idOf(later, "17049")).encounterDeck.length).toBe(later.encounterDeck.length);
});

lineSpec("17050:A:1", "The Ford of Harnen: River Harnen joins the staging area and the first Orc enemy discarded goes into the Orcs' area", (effects) => {
  const { made, state } = prepared({ stage: "17050", setAside: [...ORCS_STAGES, CHIEFTAIN, "17039"], deck: ["16051", URUK], discard: [URUK] }, effects);
  const done = record(made, state, "17050:whenRevealed:1", idOf(state, "17050"), "whenRevealed");
  expect(done.cards[idOf(done, "17039")]?.zone).toBe("staging");
  expect(idsOf(done, URUK).some((id) => done.cards[id]?.zone === "orcsArea")).toBe(true);
});

lineSpec("17050:B:2", "after an enemy attack destroys a hero 1 progress goes on the Orcs' stage, whatever stage the players are at", (effects) => {
  const made = raceTable({ stage: "17050", phase: "Combat", engaged: [URUK], setAside: [...ORCS_STAGES, CHIEFTAIN] }, effects);
  const state = runInstruction(made, opened(made).state, { verb: "PrepareOrcsArea", stages: ORCS_STAGES, number: 1 });
  const hurt = { ...state, cards: { ...state.cards, [idOf(state, "dh1")]: { ...state.cards[idOf(state, "dh1")]!, damage: 5 } } };
  const arrived = fight(made, opened(made, hurt), (current) => current.window?.kind === "defense");
  const done = fight(made, arrived, (current) => current.pendingAttack == null, { defender: "dh1" });
  expect(done.state.cards[idOf(state, "dh1")]?.zone).toBe("discard");
  expect(done.state.cards[done.state.orcs?.stage ?? ""]?.progress).toBe(1);
});

lineSpec("17050:B:3", "defeating stage 4B wins the game", (effects) => {
  const made = raceTable({ stage: "17050", setAside: [] }, effects);
  const state = opened(made).state;
  const done = resolveRecords(state, made.ctx, "17050", "questResolution", idOf(state, "17050")).state;
  expect(done.stageCleared === true && done.lost !== true).toBe(true);
});

const ENGAGE = { verb: "EngageSeatWithMost", pick: { type: "enemy", control: "any", trait: "Orc", nonUnique: true } } as const;

lineSpec("17051:B:1", "while stage 1D is in play the Chieftain does not engage a player, not even at the same stage", (effects) => {
  const { made, state } = prepared({ stage: "17047" }, effects);
  const chieftain = idOf(state, CHIEFTAIN);
  expect(state.cards[chieftain]?.zone).toBe("staging");
  expect(runInstruction(made, opened(made, state).state, ENGAGE, { sourceId: chieftain }).cards[chieftain]?.zone).toBe("staging");
});

lineSpec("17051:B:2", "Forced: at the end of the quest phase the Orcs' stage takes the discarded card's Threat plus the Threat in the Orcs' area", (effects) => {
  const { made, state } = prepared({ deck: [URUK, TREACHERY] }, effects);
  const done = record(made, state, "17051:forced:1", stageId(state));
  expect(done.cards[stageId(done)]?.progress).toBe(2 + 4);
  expect(done.cards[idOf(done, URUK)]?.zone).toBe("encounterDiscard");
});

lineSpec("17052:A:1", "Racing North (2C): when the players have defeated 2B an Orc enemy discarded from the top joins the Orcs' area, and at 2B none does", (effects) => {
  const advanced = (stage: string) => {
    const { made, state } = prepared({ stage, deck: [TREACHERY, URUK] }, effects);
    const done = runInstruction(made, state, { verb: "AddOrcsProgress", amount: 10 });
    return { stage: codeOf(done, stageId(done)), members: (done.orcs?.members ?? []).map((id) => codeOf(done, id)) };
  };
  expect(advanced("17049")).toEqual({ stage: "17052", members: [CHIEFTAIN, URUK] });
  expect(advanced("17048")).toEqual({ stage: "17052", members: [CHIEFTAIN] });
});

lineSpec("17052:B:1", "the Chieftain cannot leave the Orcs' area while the Orcs are at 2D and the players at 3B, and can with the players at 2B", (effects) => {
  const held = at(effects, "17049", {}, 2);
  expect(flagged(held.state, idOf(held.state, CHIEFTAIN), "cannotLeaveOrcsArea")).toBe(true);
  const free = at(effects, "17048", {}, 2);
  expect(flagged(free.state, idOf(free.state, CHIEFTAIN), "cannotLeaveOrcsArea")).toBe(false);
});

lineSpec("17052:B:2", "Forced: an engaged Chieftain returns to the Orcs' area first, then the Orcs make progress with his Threat; with none in play it only makes progress", (effects) => {
  const first = prepared({ stage: "17048", deck: [TREACHERY, URUK] }, effects);
  const state = advancedTo(first.made, first.state, 2);
  const chieftain = idOf(state, CHIEFTAIN);
  const seized = runInstruction(first.made, state, ENGAGE, { sourceId: chieftain });
  expect(seized.cards[chieftain]?.zone).toBe("engaged");
  const back = record(first.made, seized, "17052:forced:1", stageId(seized));
  expect(back.seats[0]?.engaged ?? []).not.toContain(chieftain);
  expect(back.orcs?.members).toContain(chieftain);
  expect(back.cards[stageId(back)]?.progress).toBe(0 + 4);
  const gone = { ...state, cards: { ...state.cards, [chieftain]: { ...state.cards[chieftain]!, zone: "discard" as const } } };
  expect(record(first.made, gone, "17052:forced:1", stageId(gone)).cards[stageId(gone)]?.progress).toBe(0);
});

/** The Orcs are at `number` and `players` is the players' stage; `amount` progress fills their stage, the game is lost or not. */
function defeated(effects: readonly Effect[], players: string, number: number, amount: number): ScenarioState {
  const { made, state } = prepared({ stage: players }, effects);
  return runInstruction(made, advancedTo(made, state, number), { verb: "AddOrcsProgress", amount });
}

lineSpec("17052:B:3", "the players lose when the Orcs defeat 2D while they are at 2B, not at 3B, and defeating 1D or advancing to 2D loses nothing", (effects) => {
  expect(defeated(effects, "17048", 2, 15).lost).toBeTruthy();
  const goes = defeated(effects, "17049", 2, 15);
  expect(goes.lost).toBeFalsy();
  expect(codeOf(goes, stageId(goes))).toBe("17053");
  // 1D is defeated with the players at 2B: they are not at 1B, so it loses nothing even though 2B is the stage a 2D loss reads.
  const first = defeated(effects, "17048", 1, 10);
  expect(first.lost).toBeFalsy();
  expect(codeOf(first, stageId(first))).toBe("17052");
});

lineSpec("17053:A:1", "Hunted in Harad (3C): when the players have defeated 3B an Orc enemy discarded from the top joins the Orcs' area, at 3B none does", (effects) => {
  // The Orcs advance to 2D first (the players at 4B have passed 2B, so 2C adds the first Orc), then 3D is filled: 3C adds one more Orc only when the players are past 3B.
  const added = (stage: string): number => {
    const { made, state } = prepared({ stage, deck: [TREACHERY, URUK, TREACHERY, URUK] }, effects);
    const two = runInstruction(made, advancedTo(made, state, 2), { verb: "AddOrcsProgress", amount: 0 });
    const done = runInstruction(made, two, { verb: "AddOrcsProgress", amount: 15 });
    return (done.orcs?.members ?? []).length - (two.orcs?.members ?? []).length;
  };
  expect(added("17050")).toBe(1);
  expect(added("17049")).toBe(0);
});

lineSpec("17053:B:1", "the Chieftain cannot leave the area while the players are at 4B, and each enemy in the Orcs' area gets +1 Threat, no enemy elsewhere", (effects) => {
  const { made, state } = at(effects, "17050", { engaged: [URUK], staging: [WARG_RIDER] }, 3);
  expect(flagged(state, idOf(state, CHIEFTAIN), "cannotLeaveOrcsArea")).toBe(true);
  const plus = (id: string) => state.modifiers.filter((modifier) => modifier.stat === "threat" && modifier.instanceId === id && modifier.amount === 1).length;
  expect(plus(idOf(state, CHIEFTAIN))).toBe(1);
  expect(plus(idOf(state, URUK))).toBe(0);
  expect(plus(idOf(state, WARG_RIDER))).toBe(0);
  expect(made.cards.get(CHIEFTAIN)?.threat).toBe(4);
});

lineSpec("17053:B:2", "Forced: the Chieftain returns to the Orcs' area first, then the Orcs make progress with his Threat", (effects) => {
  const first = prepared({ stage: "17049", deck: [TREACHERY] }, effects);
  const state = advancedTo(first.made, first.state, 3);
  const chieftain = idOf(state, CHIEFTAIN);
  const seized = runInstruction(first.made, state, ENGAGE, { sourceId: chieftain });
  expect(seized.cards[chieftain]?.zone).toBe("engaged");
  const back = record(first.made, seized, "17053:forced:1", stageId(seized));
  expect(back.seats[0]?.engaged ?? []).not.toContain(chieftain);
  expect(back.cards[stageId(back)]?.progress).toBe(0 + 4);
});

lineSpec("17053:B:3", "the players lose when the Orcs defeat 3D while they are at 3B, not at 4B", (effects) => {
  expect(defeated(effects, "17049", 3, 20).lost).toBeTruthy();
  const goes = defeated(effects, "17050", 3, 20);
  expect(goes.lost).toBeFalsy();
  expect(codeOf(goes, stageId(goes))).toBe("17054");
});

lineSpec("17054:B:1", "the Chieftain takes no damage while River Harnen is in the staging area, not as the active location", (effects) => {
  const barred = (layout: Layout): boolean => {
    const { state } = at(effects, "17050", layout, 4);
    return flagged(state, idOf(state, CHIEFTAIN), "cannotTakeDamage");
  };
  expect(barred({ staging: ["17039"] })).toBe(true);
  expect(barred({ active: "17039" })).toBe(false);
  expect(barred({})).toBe(false);
});

lineSpec("17054:B:2", "Forced: at stage 4D the Orcs make progress from the Threat of each engaged enemy, not the area's", (effects) => {
  const { made, state } = prepared({ deck: ["17046"], engaged: [URUK, WARG_RIDER] }, effects);
  const done = record(made, state, "17054:forced:1", stageId(state));
  expect(done.cards[stageId(done)]?.progress).toBe(0 + 2 + 3);
});

lineSpec("17054:B:3", "the players lose when the Orcs defeat 4D, whatever stage they are at", (effects) => {
  expect(defeated(effects, "17050", 4, 20).lost).toBeTruthy();
  expect(defeated(effects, "17048", 4, 20).lost).toBeTruthy();
});
