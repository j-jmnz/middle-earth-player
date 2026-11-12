// Rules: mec108.side-quests, mec108.side-quests-in-play, mec108.time-x, mec108.objective-allies, mec108.setup-intruders-in-chetwood, rr.first-player, rr.in-play-and-out-of-play, rr.cancel, rr.forced (data/rules/entries.json); ledger lines 09016:A:2, 09016:A:3, 09017:A:3, 09018:A:1, 09019:A:1, 09021:A:1, 09023:A:1, 09024:A:3, 09045:A:1, 09051:A:2, 09068:B:1, 09068:B:2, 09068:B:3, 10157:A:1, 10157:A:2, 10158:A:1, 10158:A:2.
import { describe, expect, it } from "vitest";

import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { settle } from "../../../rules/engine/machine.ts";
import type { PlayerIntent, ReduceContext } from "../../../rules/engine/reduce.ts";
import { pickCandidates } from "../../../rules/interpret/pick.ts";
import { restricted } from "../../../rules/interpret/restrictions.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { setCurrentQuest } from "../../../rules/families/angmar/quest.ts";
import { removeTimeCounters } from "../../../rules/families/angmar/time.ts";
import { defeatSideQuest } from "../../../rules/families/sidequests/quest.ts";
import { placeQuestProgress } from "../../../rules/quest/quest.ts";
import { fireForced } from "../../../rules/windows/triggers.ts";
import { fightEnemy, finish, HERO, idOf, legalIntents, resolveRecords, revealFromTop, send, start, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const ID = "intruders-in-chetwood";
const IARION = "09016";
const RESCUE = "09024";
const REARGUARD = "09023";
const PENDANT = "10157";
const canAdvance = () => true;
const built = (layout: Layout = {}) => tableFromLayout(ID, layout);
// The settle sweep keeps the constants that say who controls a card (families/play/sweep.ts).
const swept = (state: ScenarioState, ctx: ReduceContext): ScenarioState => settle({ ...state, window: null, mode: "stopped" }, ctx, []);
const exhaust = (state: ScenarioState, code: string): ScenarioState => syncConstants(updateCard(state, idOf(state, code), { exhausted: true }), built().ctx);
// A Response of this card is offered in the open window.
const offered = (state: ScenarioState, ctx: ReduceContext, code: string): boolean => legalIntents(state, ctx).some((intent) => intent.type === "Trigger" && intent.cardId === idOf(state, code));

describe("Iârion's control (09016:A:2, 09068:B:3)", () => {
  it("09016:A:2 follows the first player token: control passes with it, every refresh phase (mec108.objective-allies settles only Amarthiúl's)", () => {
    const t = built({ seats: 2, firstPlayer: 0, play: [IARION] });
    const iarion = idOf(t.state, IARION);
    expect(t.state.cards[iarion]?.controller).toBe(0);
    const passed = swept({ ...t.state, firstPlayer: 1 }, t.ctx);
    expect(passed.cards[iarion]?.controller).toBe(1);
    expect(swept({ ...passed, firstPlayer: 0 }, t.ctx).cards[iarion]?.controller).toBe(0);
  });

  it("09068:B:3 lets the stage be defeated only while the first player controls Iârion, whoever holds the token", () => {
    for (const firstPlayer of [0, 1] as const) {
      const t = built({ seats: 2, firstPlayer, play: [IARION], staging: [] });
      const held = swept(t.state, t.ctx);
      expect(restricted(held, t.ctx, "advance"), `first player ${firstPlayer}`).toHaveLength(0);
      // Control and the token apart (the token has passed, the sweep has not run): the stage waits.
      const apart = { ...held, firstPlayer: (1 - firstPlayer) as 0 | 1 };
      expect(restricted(apart, t.ctx, "advance"), `first player ${firstPlayer}, token passed`).not.toHaveLength(0);
      expect(restricted(swept(apart, t.ctx), t.ctx, "advance"), `first player ${firstPlayer}, the sweep ran`).toHaveLength(0);
    }
    const bare = built({ staging: [] });
    expect(restricted(bare.state, bare.ctx, "advance")).not.toHaveLength(0);
  });

  it("09068:B:3 waits while Iârion lies under Rescue Iârion, and the defeat of that side quest gives him back to the first player so the stage can be defeated", () => {
    const t = built({ play: [IARION], staging: [] });
    const run = revealFromTop(t.state, t.ctx, RESCUE, []);
    expect(restricted(run.state, t.ctx, "advance")).not.toHaveLength(0);
    const rescue = idOf(run.state, RESCUE);
    const freed = defeatSideQuest(updateCard(run.state, rescue, { progress: 6 }), rescue, t.ctx, []);
    expect(restricted(syncConstants(freed, t.ctx), t.ctx, "advance")).toHaveLength(0);
  });

  it("09068:B:1 no enemy makes an engagement check: the table carries the flag while the stage is current", () => {
    const t = built({});
    expect(t.state.modifiers.some((modifier) => modifier.stat === "noEngagementChecks")).toBe(true);
  });
});

describe("Iârion's Response (09016:A:3)", () => {
  it("09016:A:3 readies him after a side quest is revealed from the encounter deck, and the deck's search counts", () => {
    const t = built({ play: [IARION] });
    const tired = exhaust(t.state, IARION);
    const revealed = revealFromTop(tired, t.ctx, REARGUARD, []);
    expect(offered(revealed.state, t.ctx, IARION)).toBe(true);
    // Found in the deck by Pressing Needs' search.
    const searched = built({ play: [IARION], deck: [REARGUARD], staging: ["09049"] });
    const run = resolveRecords(exhaust(searched.state, IARION), searched.ctx, "09049", "whenRevealed", idOf(searched.state, "09049"), (state) => (state.window?.kind === "choose" ? (state.window.options.includes("search") ? "search" : (state.window.options[0] ?? "")) : ""));
    expect(offered(run.state, searched.ctx, IARION)).toBe(true);
  });

  it("09016:A:3 is not heard for a side quest Pressing Needs finds in the encounter discard pile, which no deck revealed", () => {
    const t = built({ play: [IARION], discard: [REARGUARD], staging: ["09049"] });
    const run = resolveRecords(exhaust(t.state, IARION), t.ctx, "09049", "whenRevealed", idOf(t.state, "09049"));
    expect(Object.values(run.state.cards).find((card) => card.code === REARGUARD)?.zone).toBe("staging");
    expect(offered(run.state, t.ctx, IARION)).toBe(false);
  });

  it("09016:A:3 is not heard while Iârion lies under Rescue Iârion: nobody controls him", () => {
    const t = built({ play: [IARION], staging: [RESCUE] });
    const held = resolveRecords(t.state, t.ctx, RESCUE, "whenRevealed", idOf(t.state, RESCUE)).state;
    const tired = updateCard(held, idOf(held, IARION), { exhausted: true });
    const revealed = revealFromTop(tired, t.ctx, REARGUARD, []);
    expect(offered(revealed.state, t.ctx, IARION)).toBe(false);
  });
});

describe("the main quest and the side quests (09017:A:3, 09023:A:1)", () => {
  it("09017:A:3 binds the main quest only: an encounter side quest the players make current is defeated while an Orc War Party is in play", () => {
    const t = built({ staging: ["09017", REARGUARD] });
    const rearguard = idOf(t.state, REARGUARD);
    const current = setCurrentQuest(t.state, rearguard, t.ctx);
    const placed = placeQuestProgress(current, 3, t.cards, [], canAdvance);
    expect(placed.cards[rearguard]?.progress).toBe(3);
    const done = defeatSideQuest(placed, rearguard, t.ctx, []);
    expect(done.cards[rearguard]?.zone).toBe("victory");
    expect(done.stageCleared).toBeFalsy();
    expect(restricted(t.state, t.ctx, "advance")).not.toHaveLength(0);
  });

  it("09023:A:1 counts each round's progress separately: the cap of 3 is used up by one round and new the next", () => {
    const t = built({ staging: [REARGUARD] });
    const first = placeQuestProgress(t.state, 5, t.cards, [], canAdvance);
    expect(first.cards[first.questStage ?? ""]?.progress).toBe(3);
    expect(placeQuestProgress(first, 2, t.cards, [], canAdvance).cards[first.questStage ?? ""]?.progress).toBe(3);
    // The tally is a modifier that lasts to the end of the round.
    const tally = first.modifiers.filter((modifier) => modifier.stat === "questProgressPlaced");
    expect(tally.map((modifier) => modifier.until)).toEqual(["endOfRound"]);
    const next = settle({ ...first, modifiers: first.modifiers.filter((modifier) => modifier.stat !== "questProgressPlaced") }, t.ctx, []);
    expect(placeQuestProgress(next, 5, t.cards, [], canAdvance).cards[first.questStage ?? ""]?.progress).toBe(6);
  });
});

describe("Protect the Innocent takes progress as damage removed (10158:A:2)", () => {
  it("10158:A:2 progress placed on it as the current quest removes that much damage, no more than it holds, and places none on it or on the main quest", () => {
    const t = built({ staging: [{ code: "10158", damage: 3 }] });
    const protect = idOf(t.state, "10158");
    const current = setCurrentQuest(t.state, protect, t.ctx);
    const some = placeQuestProgress(current, 2, t.cards, [], canAdvance);
    expect(some.cards[protect]).toMatchObject({ damage: 1, progress: 0 });
    const all = placeQuestProgress(some, 5, t.cards, [], canAdvance);
    expect(all.cards[protect]).toMatchObject({ damage: 0, progress: 0 });
    expect(all.cards[all.questStage ?? ""]?.progress).toBe(0);
    expect(settle({ ...all, window: null, mode: "stopped" }, t.ctx, []).cards[protect]?.zone).toBe("staging");
  });
});

describe("Iârion's Pendant's Response (10157:A:2)", () => {
  const withPendant = (layout: Layout = {}) => built({ play: [IARION], attached: [{ code: PENDANT, to: IARION }], ...layout });

  it("10157:A:2 is offered for the When Revealed effects of an encounter card just revealed, and not for a side quest's, nor for an effect that cannot be canceled", () => {
    const t = withPendant({ hand: ["filler"], committed: [HERO], staging: ["f3", "f3"], deck: ["09017"] });
    expect(offered(revealFromTop(t.state, t.ctx, "09043", []).state, t.ctx, PENDANT)).toBe(true);
    // A side quest's When Revealed effects cannot be canceled (mec108.side-quests).
    expect(offered(revealFromTop(t.state, t.ctx, "09051", []).state, t.ctx, PENDANT)).toBe(false);
    // Sudden Assault's own text: "This effect cannot be canceled".
    expect(offered(revealFromTop(t.state, t.ctx, "09021", []).state, t.ctx, PENDANT)).toBe(false);
  });

  it("10157:A:2 is offered for the shadow effect of a card just dealt to an attack, and cancels it", () => {
    const t = withPendant({ phase: "Encounter", engaged: [{ code: "f3", seat: 0 }], deck: ["09043", "f0", "f0", "f0"] });
    let run = send(start(syncConstants(t.state, t.ctx)), { type: "DeclineEngage" }, t.ctx);
    for (let guard = 0; guard < 60 && !offered(run.state, t.ctx, PENDANT); guard += 1) {
      const window = run.state.window;
      if (window?.kind === "chooseEnemy") run = send(run, { type: "ChooseEnemy", enemyId: window.options[0] ?? "" }, t.ctx);
      else if (window?.kind === "choose") run = send(run, { type: "Choose", optionId: window.options[0] ?? "" }, t.ctx);
      else if (window?.kind === "defense") run = send(run, { type: "Undefended", heroId: t.hero }, t.ctx);
      else {
        const pass = legalIntents(run.state, t.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack");
        if (!pass) break;
        run = send(run, pass as PlayerIntent, t.ctx);
      }
    }
    expect(offered(run.state, t.ctx, PENDANT)).toBe(true);
    const trigger = legalIntents(run.state, t.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === idOf(run.state, PENDANT));
    const used = finish(send(run, trigger as PlayerIntent, t.ctx), t.ctx);
    expect(used.state.cards[idOf(used.state, PENDANT)]?.zone).toBe("victory");
  });
});

describe("the other lines a row cannot show", () => {
  it("09018:A:1 travels even with no enemy to engage, and offers each enemy in the staging area when there are several", () => {
    const none = built({ phase: "Travel", staging: ["09018"] });
    const run = resolveRecords(none.state, none.ctx, "09018", "travel", idOf(none.state, "09018"));
    expect(run.state.window?.kind).not.toBe("choose");
    const two = built({ phase: "Travel", staging: ["09018", "f0", "f3"] });
    const picked = resolveRecords(two.state, two.ctx, "09018", "travel", idOf(two.state, "09018"), (state) => (state.window?.kind === "choose" ? (state.window.options.find((id) => state.cards[id]?.code === "f3") ?? "") : ""));
    expect(picked.state.cards[idOf(picked.state, "f3")]?.zone).toBe("engaged");
    expect(picked.state.cards[idOf(picked.state, "f0")]?.zone).toBe("staging");
  });

  it("09019:A:1 offers only the enemies engaged with a player, never one already in the staging area", () => {
    const t = built({ seats: 2, staging: ["09019", "f0"], engaged: [{ code: "f3", seat: 1 }] });
    const spec = { type: "enemy", control: "any", who: "firstPlayer" } as const;
    const found = pickCandidates(t.state, spec, 0, [], idOf(t.state, "09019"), t.ctx, undefined, undefined, false, { subject: null, other: null, discards: false });
    expect(found.map((id) => t.state.cards[id]?.code)).toEqual(["f3"]);
  });

  it("09021:A:1 finds no Orc War Party in an empty deck and discard pile: nothing is added", () => {
    const t = built({ committed: [HERO], staging: ["f3", "f3"], deck: [] });
    const run = revealFromTop(t.state, t.ctx, "09021", []);
    expect(Object.values(run.state.cards).some((card) => card.code === "09017")).toBe(false);
  });

  it("09024:A:3 is announced only for the last time counter: 4 removals in turn, the 4th announces it", () => {
    const t = built({ play: [IARION], staging: [{ code: RESCUE, resources: 4 }] });
    const rescue = idOf(t.state, RESCUE);
    let state = t.state;
    for (let removal = 1; removal <= 4; removal += 1) {
      state = removeTimeCounters({ ...state, pendingEvents: [] }, t.ctx);
      const heard = (state.pendingEvents ?? []).some((event) => event.trigger === "lastTimeCounterRemoved" && event.subject === rescue);
      expect(heard, `removal ${removal}`).toBe(removal === 4);
    }
  });

  it("09020:A:2 stops the players reducing their threat while it is in the staging area: each seat carries the flag, and none does when it is not there", () => {
    const t = built({ seats: 2, staging: ["09020"] });
    expect(t.state.modifiers.filter((modifier) => modifier.stat === "noThreatReduction")).toHaveLength(2);
    expect(built({ seats: 2 }).state.modifiers.some((modifier) => modifier.stat === "noThreatReduction")).toBe(false);
  });

  it("09045:A:1 makes the additional attack against the defending player only when an ally card was discarded from the deck, not for the ally it destroyed", () => {
    // X counts the allies discarded from the top of the deck, not the characters the attack destroyed.
    const fight = (top: string) =>
      fightEnemy((layout: Layout) => tableFromLayout(ID, layout), "f0", "09045", { play: ["ally"], deckOf: [top], deck: ["f0", "f0", "f0"] }, { defender: (made) => Object.values(made.state.cards).find((card) => card.code === "ally" && card.zone === "play")?.id ?? "" });
    const ally = fight("ally");
    expect(Object.values(ally.run.state.cards).filter((card) => card.code === "ally" && card.zone === "discard")).toHaveLength(2);
    expect(ally.run.state.cards[ally.made.hero2]?.damage).toBe(5);
    const event = fight("filler");
    expect(Object.values(event.run.state.cards).some((card) => card.code === "filler" && card.zone === "discard")).toBe(true);
    expect(event.run.state.cards[event.made.hero2]?.damage).toBe(0);
    expect(event.run.state.cards[event.made.hero]?.damage).toBe(0);
  });

  it("09068:B:2 raises each player's threat by 1 for each enemy in the staging area when the refresh phase ends, a location or side quest not counting", () => {
    const t = built({ seats: 2, phase: "Refresh", staging: ["f3", "f0", "09017", "09019", REARGUARD] });
    const steps: never[] = [];
    const done = settle(fireForced({ ...t.state, window: null, mode: "stopped" }, { trigger: "endOfPhase", seat: null, phase: "Refresh" }, t.ctx, steps), t.ctx, steps);
    expect(done.seats.map((seat) => seat.threat)).toEqual([31, 31]);
  });

  it("09051:A:2 returns the hands only when Lost in the Wilderness itself is defeated, not another side quest", () => {
    const t = built({ staging: ["09051", REARGUARD], hand: ["filler", "filler"] });
    const wilderness = idOf(t.state, "09051");
    const taken = resolveRecords(t.state, t.ctx, "09051", "whenRevealed", wilderness).state;
    expect(taken.seats[0]?.hand).toHaveLength(0);
    const other = defeatSideQuest(updateCard(taken, idOf(taken, REARGUARD), { progress: 3 }), idOf(taken, REARGUARD), t.ctx, []);
    const settled = settle({ ...other, window: null, mode: "stopped" }, t.ctx, []);
    expect(settled.seats[0]?.hand).toHaveLength(0);
    const own = defeatSideQuest(updateCard(taken, wilderness, { progress: 4 }), wilderness, t.ctx, []);
    expect(settle({ ...own, window: null, mode: "stopped" }, t.ctx, []).seats[0]?.hand).toHaveLength(2);
  });

  it("10157:A:1 adds nothing while the host is held facedown under Rescue Iârion", () => {
    const free = built({ play: [IARION], staging: [RESCUE], attached: [{ code: PENDANT, to: IARION }] });
    const without = built({ play: [IARION], staging: [RESCUE] });
    const hold = (table: ReturnType<typeof built>): ScenarioState => resolveRecords(table.state, table.ctx, RESCUE, "whenRevealed", idOf(table.state, RESCUE)).state;
    const heldWith = syncConstants(hold(free), free.ctx);
    const heldWithout = syncConstants(hold(without), without.ctx);
    const willpower = (state: ScenarioState): number => state.modifiers.filter((modifier) => modifier.stat === "willpower" && modifier.instanceId === idOf(state, IARION)).reduce((sum, modifier) => sum + modifier.amount, 0);
    expect(willpower(heldWith)).toBe(willpower(heldWithout));
  });
});
