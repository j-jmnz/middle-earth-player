// Rules: rr.forced, rr.cancel, rr.damage, rr.refresh-phase, rr.search, rr.setup, rr.current-quest, rr.first-player (data/rules/entries.json).
// What a spec row cannot show (a damage cancel, a cap tallied over many characters, the highest Attack among ties, the Setup, a line no record changes the game for), on tables built from layouts (tableFromLayout). Each title starts with its line id.
// The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points; a layout's current stage is on its B side.
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { flagged, updateCard } from "../../../rules/core/state.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { fireForced } from "../../../rules/windows/triggers.ts";
import { queueEvent } from "../../../rules/windows/queue.ts";
import { rowProblems } from "../../../../test/harness/card-spec.ts";
import { finish, idOf, resolveRecords, revealFromTop, send, tableFromLayout, zoneOf, type Layout } from "../../../../test/harness/scene-kit.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";

const ID = "the-river-running";
const table = (layout: Layout, effects = EFFECTS) => tableFromLayout(ID, layout, { effects });
const S1 = "21075";
const S2 = "21076";
const OUTRIDER = "21013";
const CAPTAIN = "21017";
const RIDER = "21018";
const HORSE = "21019";
const RAIDER = "21020";
const WARRIORS = "21024";

describe("Easterling Captain (21017:A:2)", () => {
  // "When Easterling Captain would take any amount of damage, discard an Easterling attachment from him. Then, cancel the damage."
  lineSpec("21017:A:2", "the damage is canceled and an Easterling attachment is discarded from the Captain", (effects) => {
    const t = table({ stage: S1, staging: [CAPTAIN], attached: [{ code: HORSE, to: CAPTAIN, encounter: true }] }, effects);
    const captain = idOf(t.state, CAPTAIN);
    const hurt = updateCard(t.state, captain, { damage: 3 });
    const dealt = settle(queueEvent(hurt, { trigger: "damageDealt", seat: 0, cardId: captain, subject: captain, amount: 3 }), t.ctx, []);
    const done = finish({ state: dealt, steps: [] }, t.ctx).state;
    expect(done.cards[captain]?.damage).toBe(0);
    expect(zoneOf(done, HORSE)).not.toBe("attached");
  });

  it("21017:A:2 with no Easterling attachment the Captain takes the damage", () => {
    const t = table({ stage: S1, staging: [CAPTAIN] });
    const captain = idOf(t.state, CAPTAIN);
    const dealt = settle(queueEvent(updateCard(t.state, captain, { damage: 3 }), { trigger: "damageDealt", seat: 0, cardId: captain, subject: captain, amount: 3 }), t.ctx, []);
    expect(finish({ state: dealt, steps: [] }, t.ctx).state.cards[captain]?.damage).toBe(3);
  });
});

describe("An Arduous Journey (21029:A:1)", () => {
  // "Each player cannot ready more than 6 characters he controls during the refresh phase." The Forced effect holds the extra characters back as the phase begins.
  const held = (layout: Layout, effects = EFFECTS): number[] => {
    const t = table({ stage: S1, phase: "Refresh", staging: ["21029"], ...layout }, effects);
    const seats = t.state.seats.filter((seat) => seat.heroes.length > 0);
    const tired = seats.flatMap((seat) => [...seat.heroes, ...seat.play]).reduce((state, id) => updateCard(state, id, { exhausted: true }), t.state);
    const done = resolveRecords(tired, t.ctx, "21029", "forced", idOf(tired, "21029")).state;
    return seats.map((seat) => [...seat.heroes, ...seat.play].filter((id) => flagged(done, id, "doesNotReady")).length);
  };

  lineSpec("21029:A:1", "with 8 characters exhausted 2 stay exhausted, and with 6 or fewer none does", (effects) => {
    expect(held({ play: ["ally", "ally", "ally", "ally", "ally", "ally"] }, effects)).toEqual([2]);
    expect(held({ play: ["ally", "ally", "ally", "ally"] }, effects)).toEqual([0]);
  });

  it("21029:A:1 with 2 players each keeps his own 6: the cap is not shared", () => {
    const seven = Array.from({ length: 6 }, () => ({ code: "ally", seat: 1 }));
    expect(held({ seats: 2, play: seven })).toEqual([0, 1]);
  });

  // The phase begins: the engine announces it to the Forced effects, so the cap is held only while the side quest is in play.
  const begun = (layout: Layout): number => {
    const t = table({ stage: S1, phase: "Refresh", play: ["ally", "ally", "ally", "ally", "ally", "ally"], ...layout });
    const tired = [...t.state.seats[0]!.heroes, ...t.state.seats[0]!.play].reduce((state, id) => updateCard(state, id, { exhausted: true }), t.state);
    const steps: EngineStep[] = [];
    let done = settle({ ...tired, window: null, mode: "stopped", pendingEvents: [{ trigger: "beginningOfPhase", seat: null, phase: "Refresh" }] }, t.ctx, steps);
    // The player chooses each character that stays exhausted: the first option each time.
    for (let guard = 0; guard < 10 && done.window?.kind === "choose"; guard += 1) done = send({ state: done, steps }, { type: "Choose", optionId: done.window.options[0] ?? "" }, t.ctx).state;
    return [...done.seats[0]!.heroes, ...done.seats[0]!.play].filter((id) => flagged(done, id, "doesNotReady")).length;
  };

  it("21029:A:1 the cap holds when the refresh phase begins with the side quest in play, and not without it", () => {
    expect(begun({ staging: ["21029"] })).toBe(2);
    expect(begun({ staging: [] })).toBe(0);
  });
});

describe("Rider of Rhûn (21018:A:3)", () => {
  // The search takes the revealed copy as the host (attachSearched, src/rules/families/wilderland/kings.ts): the Horse goes to the Rider that was revealed, not to the first Rider in play. A stage that names its enemy
  // (The Fire Worm's Fire-drake, 18080:A:1) still takes the first one in play: its test is in the-kings-quest/stages.test.ts.
  it("21018:A:3 with two Riders of Rhûn in play the Horse is attached to the one that was revealed", () => {
    const t = table({ stage: S1, staging: [RIDER], deck: ["f0", HORSE] });
    const first = idOf(t.state, RIDER);
    const steps: EngineStep[] = [];
    const revealed = revealFromTop(t.state, t.ctx, RIDER, steps);
    const done = finish({ state: revealed.state, steps }, t.ctx).state;
    expect(revealed.id).not.toBe(first);
    expect(done.cards[idOf(done, HORSE)]).toMatchObject({ zone: "attached", host: revealed.id });
    expect(done.cards[first]?.attachments).toEqual([]);
  });
});

describe("Warriors of the East (21024:A:3) and the Setup (21075:A:1)", () => {
  it("21024:A:3 the Easterling enemy with the highest Attack in the staging area is the one that attacks the first player", () => {
    const t = table({ stage: S1, staging: [WARRIORS, RAIDER, RIDER, OUTRIDER] });
    const steps: EngineStep[] = [];
    const event = { trigger: "becameCurrentQuest", seat: 0, cardId: idOf(t.state, WARRIORS) } as const;
    const state = settle(fireForced({ ...t.state, window: null }, event, t.ctx, steps), t.ctx, steps);
    expect(state.pendingAttack ? state.cards[state.pendingAttack.enemyId]?.code : undefined).toBe(RIDER);
  });

  it("21075:A:1 Setup: each player adds a different Easterling enemy from the encounter deck to the staging area, and the deck is shuffled", () => {
    const t = table({ stage: S1, seats: 2, deck: [OUTRIDER, OUTRIDER, RAIDER, "f0"] });
    const state = resolveRecords(t.state, t.ctx, S1, "setup", t.state.questStage ?? "").state;
    const staged = Object.values(state.cards).filter((card) => card.zone === "staging").map((card) => card.code).sort();
    expect(staged).toEqual([OUTRIDER, RAIDER]);
    expect(state.encounterDeck.length).toBe(2);
  });
});

describe("The Crossing of Araw (21076:B:2, 21076:B:3)", () => {
  it("21076:B:2 with no player engaged with an enemy the progress is not capped", () => {
    const t = table({ stage: S2, staging: [OUTRIDER] });
    expect(flagged(t.state, "table", "questProgressCap")).toBe(false);
  });

  it("21076:B:3 the players win the game when this stage is defeated", () => {
    const row = { line: "21076:B:3", layout: { stage: S2, progress: 11 }, act: { act: "quest", outcome: "success" }, expect: { expect: "won" } } as const;
    expect(rowProblems(ID, row, EFFECTS)).toEqual([]);
  });
});
