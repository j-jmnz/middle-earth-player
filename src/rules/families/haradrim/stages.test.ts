// Rules: hrd.orcs-area, hrd.orcs-area-different-stage, hrd.orcs-area-same-stage, faq.reveal-and-add, rr.first-player, rr.cannot, rr.surge, rr.shadow-effects, rr.attachment-cards (data/rules/entries.json); ledger lines 17042:A:1, 17042:A:2, 17043:A:1, 17043:A:2, 17044:A:2, 17045:A:3,
// 17047:B:1, 17048:A:1, 17048:B:1, 17049:B:1, 17049:B:2, 17050:A:1, 17052:B:1, 17053:B:1. The cards and stages of Race Across Harad that put cards into the Orcs' area or hold the Chieftain, each resolved as the game resolves it.
import { describe, expect, it } from "vitest";

import { flagged } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { idOf, idsOf, opened, resolveRecords, revealFromTop, run as runInstruction } from "../../../../test/harness/scene-kit.ts";
import { advancedTo, CHIEFTAIN, codeOf, ORCS_STAGES, prepared, raceTable, record, URUK } from "./race-kit.ts";

const WARG_RIDER = "16063";

describe("17042:A:1 Harad Road is added to the Orcs' area when revealed", () => {
  it("it leaves the staging area into the Orcs' area, and at the same stage it stands in the staging area with its Threat 5", () => {
    const { made, state } = prepared({ staging: ["17042"] });
    const road = idOf(state, "17042");
    const done = record(made, state, "17042:whenRevealed:1", road, "whenRevealed");
    expect(done.cards[road]?.zone).toBe("orcsArea");
    expect(done.orcs?.members).toContain(road);
    const same = prepared({ stage: "17047", staging: ["17042"] });
    const roadSame = idOf(same.state, "17042");
    const there = record(same.made, same.state, "17042:whenRevealed:1", roadSame, "whenRevealed");
    expect(there.cards[roadSame]?.zone).toBe("staging");
    expect(there.orcs?.members).toContain(roadSame);
  });
});

describe("17043:A:1 Uruk Pursuer goes into the Orcs' area and gains surge at another stage", () => {
  it("it joins the area, and gains surge only while the players are at another stage", () => {
    // The Pursuer is revealed from the top of a deck of 3 cards: at another stage it surges and reveals one more, at the same stage it reveals nothing else.
    const revealed = (stage: string) => {
      const table = raceTable({ stage, setAside: [...ORCS_STAGES, CHIEFTAIN], deck: ["f0", "f0", "f0"] });
      const state = runInstruction(table, opened(table).state, { verb: "PrepareOrcsArea", stages: ORCS_STAGES, number: 1, place: [CHIEFTAIN] });
      const done = revealFromTop(state, table.ctx, "17043", []).state;
      return { done, deck: done.encounterDeck.length };
    };
    const apart = revealed("17048");
    expect(apart.deck).toBe(2);
    expect(apart.done.cards[idOf(apart.done, "17043")]?.zone).toBe("orcsArea");
    const same = revealed("17047");
    expect(same.deck).toBe(3);
    expect(same.done.cards[idOf(same.done, "17043")]?.zone).toBe("staging");
  });});

describe("17044:A:2 Racing Warg attaches to an Orc enemy, the Orcs' area included", () => {
  it("the first player's choice among the Orcs in play: with only the Chieftain in the Orcs' area he is the host", () => {
    const { made, state } = prepared({ staging: ["17044"] });
    const warg = idOf(state, "17044");
    const done = record(made, state, "17044:whenRevealed:1", warg, "whenRevealed");
    const chieftain = idOf(done, CHIEFTAIN);
    expect(done.cards[warg]?.host).toBe(chieftain);
    expect(done.cards[chieftain]?.attachments).toContain(warg);
    expect(done.cards[chieftain]?.zone).toBe("orcsArea");
  });

  it("17044:A:2 a second Racing Warg finds no host on the Orc that already carries one (limit 1 per enemy) and is discarded", () => {
    const { made, state } = prepared({ staging: ["17044", "17044"] });
    const [first, second] = idsOf(state, "17044");
    const one = record(made, state, "17044:whenRevealed:1", first ?? "", "whenRevealed");
    expect(one.cards[first ?? ""]?.host).toBe(idOf(one, CHIEFTAIN));
    const again = record(made, one, "17044:whenRevealed:1", second ?? "", "whenRevealed");
    expect(again.cards[second ?? ""]?.zone).toBe("encounterDiscard");
    expect(again.cards[idOf(again, CHIEFTAIN)]?.attachments).toEqual([first]);
  });

  it("with no Orc enemy in play it is discarded", () => {
    const made = raceTable({ staging: ["17044"], setAside: [] });
    const state = opened(made).state;
    const warg = idOf(state, "17044");
    const done = record(made, state, "17044:whenRevealed:1", warg, "whenRevealed");
    expect(done.cards[warg]?.zone).toBe("encounterDiscard");
  });
});

describe("17047:B:1 Setting Out: each player finds a different location and the quest advances to 2A", () => {
  it("each player in turn adds one location of a different title to the staging area, the deck is shuffled and stage 2A is the stage", () => {
    const made = raceTable({ seats: 2, stage: "17047", deck: ["17040", "17040", "17041", "17042"], setAside: [] });
    const state = opened(made).state;
    const done = resolveRecords(state, made.ctx, "17047", "whenRevealed", idOf(state, "17047")).state;
    const staged = done.staging.map((id) => codeOf(done, id)).sort();
    expect(staged).toHaveLength(2);
    expect(new Set(staged).size).toBe(2);
    expect(codeOf(done, done.questStage ?? "")).toBe("17048");
  });
});

describe("17048:A:1 Racing North: the first player chooses the staging area or the Orcs' area for the Warg-rider", () => {
  it.each([["staging", "staging"], ["orcsArea", "orcsArea"]] as const)("the option %s puts the set-aside Uruk Warg-rider in the %s, added and not revealed", (option, zone) => {
    const { made, state } = prepared({ stage: "17048", setAside: ["17051", "17052", "17053", "17054", CHIEFTAIN, WARG_RIDER] });
    const stage = idOf(state, "17048");
    const asked = record(made, state, "17048:whenRevealed:1", stage, "whenRevealed");
    expect(asked.window?.kind).toBe("choose");
    expect(asked.window?.kind === "choose" ? asked.window.options : []).toEqual(["staging", "orcsArea"]);
    const done = resolveRecords(state, made.ctx, "17048", "whenRevealed", stage, () => option).state;
    expect(done.cards[idOf(done, WARG_RIDER)]?.zone).toBe(zone);
    expect(done.cards[idOf(done, WARG_RIDER)]?.face).not.toBe("down");
  });
});

describe("17049:A:1 17050:A:1 an Orc enemy discarded from the top of the deck goes into the Orcs' area", () => {
  it("17050:A:1 River Harnen joins the staging area, the discard pile is shuffled in and the first Orc discarded joins the area", () => {
    const { made, state } = prepared({ stage: "17050", setAside: ["17051", "17052", "17053", "17054", CHIEFTAIN, "17039"], deck: ["16051", URUK], discard: [URUK] });
    const done = record(made, state, "17050:whenRevealed:1", idOf(state, "17050"), "whenRevealed");
    expect(done.cards[idOf(done, "17039")]?.zone).toBe("staging");
    expect(idsOf(done, URUK).some((id) => done.cards[id]?.zone === "orcsArea")).toBe(true);
  });
});

describe("17048:B:1 17049:B:1 the Chieftain takes no damage while stage 2B or 3B is in play", () => {
  it("the Chieftain, wherever he stands, holds cannotTakeDamage; with another stage in play he does not", () => {
    for (const stage of ["17048", "17049"]) {
      const { state } = prepared({ stage });
      const synced = opened(prepared({ stage }).made, state).state;
      expect(flagged(synced, idOf(synced, CHIEFTAIN), "cannotTakeDamage")).toBe(true);
    }
    const other = prepared({ stage: "17050" });
    expect(flagged(opened(other.made, other.state).state, idOf(other.state, CHIEFTAIN), "cannotTakeDamage")).toBe(false);
  });
});

describe("17049:B:2 Hunted in Harad reveals an additional encounter card while the Chieftain is at stage 2D", () => {
  /** The table after the Orcs advanced to 2D, with three Fear of Mordor on the encounter deck. */
  const at2d = () => {
    const first = prepared({ stage: "17049" });
    let state = advancedTo(first.made, first.state, 2);
    for (let count = 0; count < 3; count += 1) state = spawn(state, "16065", { zone: "encounterDeck" }, "down").state;
    return { made: first.made, state: opened(first.made, state).state };
  };

  it("with the Orcs at 2D and the Chieftain in the area one more card is revealed at the end of the staging step", () => {
    const { made, state } = at2d();
    expect(state.orcs?.number).toBe(2);
    const done = record(made, state, "17049:forced:1", idOf(state, "17049"));
    expect(done.encounterDeck.length).toBe(state.encounterDeck.length - 1);
  });

  it("with the Chieftain out of play, or the Orcs at another stage, none is revealed", () => {
    const { made, state } = at2d();
    const gone = { ...state, cards: { ...state.cards, [idOf(state, CHIEFTAIN)]: { ...state.cards[idOf(state, CHIEFTAIN)]!, zone: "discard" as const } } };
    expect(record(made, gone, "17049:forced:1", idOf(gone, "17049")).encounterDeck.length).toBe(gone.encounterDeck.length);
    const later = { ...state, orcs: { ...state.orcs!, number: 3 } };
    expect(record(made, later, "17049:forced:1", idOf(later, "17049")).encounterDeck.length).toBe(later.encounterDeck.length);
  });
});

describe("17052:B:1 17053:B:1 the Chieftain cannot leave the area while the players are at stage 3B or 4B", () => {
  it("2D with the players at 3B and 3D with the players at 4B hold the flag; with the players elsewhere they do not", () => {
    const at3 = prepared({ stage: "17049" });
    const two = opened(at3.made, advancedTo(at3.made, at3.state, 2)).state;
    expect(flagged(two, idOf(two, CHIEFTAIN), "cannotLeaveOrcsArea")).toBe(true);
    const at2 = prepared({ stage: "17048" });
    const twoAtTwo = opened(at2.made, advancedTo(at2.made, at2.state, 2)).state;
    expect(flagged(twoAtTwo, idOf(twoAtTwo, CHIEFTAIN), "cannotLeaveOrcsArea")).toBe(false);
    const at4 = prepared({ stage: "17050" });
    const three = opened(at4.made, advancedTo(at4.made, at4.state, 3)).state;
    expect(flagged(three, idOf(three, CHIEFTAIN), "cannotLeaveOrcsArea")).toBe(true);
  });

  it("17053:B:1 each enemy in the Orcs' area gets +1 Threat while the players are at 4B and the Orcs at 3D, no enemy elsewhere does", () => {
    const first = prepared({ stage: "17050", engaged: [URUK], staging: ["16063"] });
    const state = opened(first.made, advancedTo(first.made, first.state, 3)).state;
    const chieftain = state.cards[idOf(state, CHIEFTAIN)]!;
    expect(first.made.cards.get(CHIEFTAIN)?.threat).toBe(4);
    const mod = (id: string) => state.modifiers.filter((modifier) => modifier.stat === "threat" && modifier.instanceId === id && modifier.amount === 1).length;
    expect(mod(chieftain.id)).toBe(1);
    expect(mod(idOf(state, URUK))).toBe(0);
    expect(mod(idOf(state, "16063"))).toBe(0);
  });
});
