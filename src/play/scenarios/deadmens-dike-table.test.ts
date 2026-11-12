// Rules: mec108.side-quests, mec108.time-x, mec108.indestructible, rr.player-elimination, rr.first-player (data/rules/entries.json); ledger lines 09036:A:2, 09038:A:1, 09038:A:2, 09041:A:2, 09067:A:2, 09073:B:3, 09074:B:2, 10168:A:2, 10169:A:2, 10170:A:2.
// What the table says of Deadmen's Dike's pieces: Thaurdir's damage against the hit points that open stage 2B as a goal dial, each seat's deck against the elimination at 0 as a mark that warms, Fornost Square's tokens, Broken Battlements' time counters, a burden drawn
// under its host wherever it moves with its effect in the preview, The Power of Angmar's lock, Protect the Innocent's dial (Chetwood's, drawn again), Iârion's seat mark, and the owner named on each row of a pick that spans seats. The engine decided each; nothing here changes one.
import { describe, expect, it } from "vitest";

import { idOf, resolveRecords, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { settle } from "../../rules/engine/machine.ts";
import { fireForced } from "../../rules/windows/triggers.ts";

import { angmarDetail } from "../cards/angmar-preview.ts";
import { sheetFor } from "../choice/sheets.ts";
import type { PickSheet, SheetNames } from "../choice/sheet-types.ts";
import { angmarDials, angmarHands } from "../readouts/angmar.ts";
import { scenarioDials, seatMarks } from "../readouts/scenario-dials.ts";
import { zoneSelector } from "../store/selectors.ts";

const ID = "deadmens-dike";
const THAURDIR = "09033";
const SQUARE = "09038";
const BATTLEMENTS = "09036";
const built = (layout: Layout = {}) => tableFromLayout(ID, { stage: "09074", phase: "Quest", deckOf: ["filler", "filler", "filler", "filler", "filler", "filler", "filler"], deck: ["09042"], ...layout });
type Made = ReturnType<typeof built>;
const nameOf = (made: Made) => (code: string) => made.cards.get(code)?.name ?? code;
const idName = (made: Made, state: Made["state"]) => (id: string) => made.cards.get(state.cards[id]?.code ?? "")?.name ?? id;
const namesOf = (made: Made, state: Made["state"] = made.state): SheetNames => ({ card: (id) => made.cards.get(state.cards[id]?.code ?? "")?.name ?? id, line: () => null });
const dial = (made: Made, id: string, state = made.state) => angmarDials(state, made.ctx, nameOf(made)).find((one) => one.id === id);

describe("Thaurdir's dial", () => {
  it("09074:B:2 reads his damage against his 9 hit points as a goal dial, the players' way out of stage 2: it never warms or warns, and is gone while he is set aside", () => {
    const made = built({ staging: [{ code: THAURDIR, damage: 4 }] });
    expect(dial(made, "thaurdir")).toMatchObject({ testID: "angmar-thaurdir", label: "Thaurdir", value: 4, limit: 9, goal: true, limitWords: "9 opens the stage" });
    for (const damage of [7, 8, 9, 12]) {
      const near = dial(built({ staging: [{ code: THAURDIR, damage }] }), "thaurdir");
      expect(near?.warms).toBeUndefined();
      expect(near?.warn).toBeUndefined();
    }
    expect(dial(made, "thaurdir")?.note).toBe("4 of 9 damage. He cannot be destroyed, and stage 2 cannot be won while he has hit points left.");
    expect(dial(built({ setAside: [THAURDIR] }), "thaurdir")).toBeUndefined();
    expect(scenarioDials(made.state, made.ctx, nameOf(made)).map((one) => one.testID)).toContain("angmar-thaurdir");
  });

  it("09074:B:2 says his damage, his hit points and the burden he carries in his preview", () => {
    const made = built({ staging: [{ code: THAURDIR, damage: 3 }], attached: [{ code: "10169", to: THAURDIR }] });
    expect(angmarDetail(made.state, made.ctx, idOf(made.state, THAURDIR), idName(made, made.state))).toBe("3 of 9 damage on him. Indestructible: the damage stays, and stage 2 can be won once it reaches 9. He carries Thaurdir's Majesty.");
  });
});

describe("each seat's deck against the elimination at 0", () => {
  const marks = (made: Made) => angmarHands(made.state);

  it("09073:B:3 marks each living seat with its deck count, solo and two-handed, and warms it near empty: near at 5, critical at 2", () => {
    const solo = built({ stage: "09073", deckOf: Array(12).fill("filler") });
    expect(marks(solo)).toMatchObject([{ seat: 0, label: "Deck 12", note: "12 cards left in this player's deck. A player with no cards in his deck is eliminated." }]);
    expect(marks(solo)[0]?.warn).toBeUndefined();
    const near = built({ stage: "09073", seats: 2, deckOf: Array(5).fill("filler") });
    expect(marks(near).map((mark) => [mark.label, mark.warn?.level, mark.warn?.words])).toEqual([["P1 · Deck 5", "near", "5 cards left. At 0 this player is eliminated."], ["P2 · Deck 5", "near", "5 cards left. At 0 this player is eliminated."]]);
    const low = built({ stage: "09074", deckOf: Array(2).fill("filler") });
    expect(marks(low)[0]?.warn).toMatchObject({ level: "critical", words: "2 cards left. At 0 this player is eliminated." });
    expect(marks(built({ stage: "09074", deckOf: ["filler"] }))[0]?.warn?.words).toBe("One more card and this player is eliminated.");
  });

  it("09074:B:2 joins the seat's other marks: the first player's deck count and Iârion", () => {
    const made = built({ stage: "09074", play: ["09016"], deckOf: Array(9).fill("filler") });
    const merged = seatMarks(made.state, made.ctx);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.label).toBe("Deck 9 · Iârion");
  });

  it("09073:B:3 shows no deck mark in a scenario that does not eliminate a player with no cards in his deck, nor on a game that holds no such stage", () => {
    const other = tableFromLayout("the-weather-hills", { deck: ["09032"] });
    expect(angmarHands(other.state).filter((mark) => mark.label.includes("Deck"))).toEqual([]);
  });
});

describe("Fornost Square, Broken Battlements and The Power of Angmar", () => {
  it("09038:A:1 says the tokens and the Threat they add in its preview", () => {
    const made = built({ staging: [{ code: SQUARE, resources: 2 }] });
    expect(angmarDetail(made.state, made.ctx, idOf(made.state, SQUARE), idName(made, made.state))).toBe("2 resource tokens on it: +2 Threat. The first player discarding cards from the top of his deck places 1, once for each discard.");
  });

  it("09036:A:2 words Broken Battlements' last counter as 5 cards discarded and 1 counter back, warns near and never critical, and Rescue Iârion keeps its loss words", () => {
    const made = built({ staging: [{ code: BATTLEMENTS, resources: 1 }] });
    const time = dial(made, "time");
    expect(time).toMatchObject({ testID: "angmar-time", value: 1 });
    expect(time?.note).toContain("each player discards the top 5 cards of their deck and places 1 time counter here.");
    expect(time?.note).not.toContain("lose");
    expect(time?.warn).toMatchObject({ level: "near", words: "The next refresh phase takes the last time counter: each player discards 5 cards." });
    expect(dial(built({ staging: [{ code: BATTLEMENTS, resources: 2 }] }), "time")?.warn).toMatchObject({ level: "near", words: "2 time counters are left." });
    expect(dial(built({ staging: [{ code: BATTLEMENTS, resources: 3 }] }), "time")?.warn).toBeUndefined();
    expect(angmarDetail(made.state, made.ctx, idOf(made.state, BATTLEMENTS), idName(made, made.state))).toBe("1 time counter on it. With the last gone, each player discards the top 5 cards of their deck and places 1 time counter here.");
  });

  it("09067:A:2 says what the lock is in The Power of Angmar's preview while it is in the staging area, and nothing once it has left", () => {
    const made = built({ staging: ["09067"] });
    expect(angmarDetail(made.state, made.ctx, idOf(made.state, "09067"), idName(made, made.state))).toContain("no player card effect can take a card out of a discard pile. Encounter card effects can.");
    const gone = built({ victory: ["09067"] });
    expect(angmarDetail(gone.state, gone.ctx, idOf(gone.state, "09067"), idName(gone, gone.state))).toBeNull();
  });
});

describe("Thaurdir's burden on its host", () => {
  it("10168:A:2 draws the burden under Thaurdir in the staging area and in an engagement area, and under the hero it moved to in the hero's zone", () => {
    const staged = built({ staging: [THAURDIR], attached: [{ code: "10168", to: THAURDIR }] });
    const burden = idOf(staged.state, "10168");
    expect(zoneSelector("staging", 0)(staged.state).entries.find((one) => one.card.id === idOf(staged.state, THAURDIR))?.attached.map((card) => card.id)).toContain(burden);
    const engaged = built({ engaged: [{ code: THAURDIR, seat: 0 }], attached: [{ code: "10168", to: THAURDIR }] });
    expect(zoneSelector("engaged", 0)(engaged.state).entries.find((one) => one.card.id === idOf(engaged.state, THAURDIR))?.attached.map((card) => card.id)).toContain(idOf(engaged.state, "10168"));
    const moved = built({ staging: [THAURDIR], attached: [{ code: "10168", to: "dh1" }] });
    expect(zoneSelector("play", 0)(moved.state).entries.find((one) => one.card.id === idOf(moved.state, "dh1"))?.attached.map((card) => card.id)).toContain(idOf(moved.state, "10168"));
  });

  it("10168:A:2, 10169:A:2 and 10170:A:2 say the effect in the preview: on Thaurdir it does nothing yet, on a hero it takes what the card says", () => {
    const onHim = built({ staging: [THAURDIR], attached: [{ code: "10168", to: THAURDIR }] });
    expect(angmarDetail(onHim.state, onHim.ctx, idOf(onHim.state, "10168"), idName(onHim, onHim.state))).toBe("Carried by Thaurdir, with no effect on him. After a Sorcery treachery is revealed it moves to the hero with the most resources. It joins the Campaign Pool when the scenario is won.");
    const onHero = (code: string) => built({ attached: [{ code, to: "dh1" }] });
    for (const [code, effect] of [["10168", "-2 Willpower and its text box, Traits included, is blank"], ["10169", "-2 Attack and it cannot commit to the quest"], ["10170", "-2 Defense and it cannot be healed"]] as const) {
      const made = onHero(code);
      expect(angmarDetail(made.state, made.ctx, idOf(made.state, code), idName(made, made.state)), code).toContain(`On dh1: ${effect}.`);
    }
  });
});

describe("Protect the Innocent's dial and Iârion's mark", () => {
  it("10158:A:3 draws Protect the Innocent's damage against the 10 that loses, as Intruders in Chetwood does, and Iârion marks the seat that controls him", () => {
    const made = built({ staging: [{ code: "10158", damage: 8 }], play: ["09016"] });
    expect(dial(made, "protect")).toMatchObject({ testID: "angmar-protect", value: 8, limit: 10, warms: true });
    expect(angmarHands(made.state).some((mark) => mark.label.includes("Iârion"))).toBe(true);
  });
});

describe("a pick that spans seats names the owner on each row", () => {
  const sheetsOf = (made: Made, code: string, timing: "response" | "forced" | "whenRevealed", source: string | undefined, answer: (state: Made["state"]) => string = (state) => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "")): PickSheet[] => {
    const seen: PickSheet[] = [];
    resolveRecords(made.state, made.ctx, code, timing, source, (state) => {
      const sheet = sheetFor(state, made.ctx, legalIntents(state, made.ctx), namesOf(made, state));
      if (sheet?.kind === "pick") seen.push(sheet);
      return answer(state);
    });
    return seen;
  };

  it("10168:A:2 Thaurdir's Legacy: heroes of both players tie for the most resources and the first player chooses, each row naming the player whose hero it is", () => {
    const made = built({ seats: 2, staging: [THAURDIR], attached: [{ code: "10168", to: THAURDIR }] });
    const sheet = sheetsOf(made, "10168", "forced", idOf(made.state, "10168"))[0];
    expect(sheet?.note).toContain("these heroes tie for the most resources");
    expect(sheet?.options.map((option) => option.label)).toEqual(expect.arrayContaining([expect.stringContaining("Player 1"), expect.stringContaining("Player 2")]));
  });

  it("09041:A:2 Unnatural Fog's either/or is each player's own, so two-handed it leads with the player and solo it has no lead", () => {
    const two = built({ seats: 2, stage: "09073", committed: ["dh1", "dh3"] });
    const note = (made: Made) => {
      let said = "";
      resolveRecords(made.state, made.ctx, "09041", "whenRevealed", undefined, (state) => {
        const sheet = sheetFor(state, made.ctx, legalIntents(state, made.ctx), namesOf(made, state));
        if (sheet && said === "") said = (sheet as { note?: string }).note ?? "";
        return state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "";
      });
      return said;
    };
    expect(note(two)).toMatch(/^Player 1: Unnatural Fog: discard the top card of your deck/);
    const solo = built({ stage: "09073", committed: ["dh1"] });
    expect(note(solo)).toMatch(/^Unnatural Fog: discard the top card of your deck/);
  });

  it("09074:B:1 A Fell Wraith's choice is the destroyed character's controller's own, and warns on the discard when it would empty his deck", () => {
    const sheetOf = (deck: number) => {
      const made = built({ seats: 2, engaged: [{ code: THAURDIR, seat: 1 }], deckOf: Array(deck).fill("filler") });
      const steps: never[] = [];
      const base = { ...made.state, window: null, mode: "stopped" as const };
      const heard = settle(fireForced(base, { trigger: "characterDestroyedByAttack", seat: 1, subject: made.seat1Hero ?? "", other: idOf(base, THAURDIR) }, made.ctx, steps), made.ctx, steps);
      return { sheet: sheetFor(heard, made.ctx, legalIntents(heard, made.ctx), namesOf(made, heard)), heard };
    };
    const { sheet } = sheetOf(5);
    expect(JSON.stringify(sheet)).toContain("Player 2: A Fell Wraith: Thaurdir destroyed your character.");
    expect(JSON.stringify(sheet)).toContain("you have 5");
    const tight = JSON.stringify(sheetOf(3).sheet);
    expect(tight).toContain("Tap again: your deck would be empty and you would be eliminated");
    expect(JSON.stringify(sheetOf(5).sheet)).not.toContain("Tap again");
  });
});
