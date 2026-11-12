// Rules: mec108.orc-deck, mec108.side-quests, mec108.side-quests-in-play, rr.first-player (data/rules/entries.json); ledger lines 09029:A:1, 09052:A:1, 09069:A:1, 09071:A:1, 09072:A:2, 09072:A:3, 10158:A:3, 10160:A:3.
// What the table says of The Weather Hills' pieces: Hunting the Orcs' tokens against the number at which it flips and Savage Counter-attack's tokens against the loss at 0 as dials that warm, the Orc deck as a pile of the second slot with its count,
// Protect the Innocent's damage dial (Intruders in Chetwood's, drawn again), the previews, the boons drawn under their heroes, and the owner named on each row of a pick that spans seats. The engine decided each; nothing here changes one.
import { describe, expect, it } from "vitest";

import { idOf, resolveRecords, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { updateCard } from "../../rules/core/state.ts";

import { angmarDetail } from "../cards/angmar-preview.ts";
import { sheetFor } from "../choice/sheets.ts";
import type { PickSheet, SheetNames } from "../choice/sheet-types.ts";
import { angmarDials } from "../readouts/angmar.ts";
import { scenarioDials } from "../readouts/scenario-dials.ts";
import { pileIds, PILE_WORDS, pileSelector, secondPilesOf, zoneSelector } from "../store/selectors.ts";

const ID = "the-weather-hills";
const HUNT = "09071";
const SAVAGE = "09072";
const PROTECT = "10158";
// A game that deals an encounter side quest in its encounter deck reads the side quest rules (state.sideQuests), as The Weather Hills' deck of Find Shelter does.
const SIDE_QUEST_DECK = ["09032"];
const built = (layout: Layout = {}) => tableFromLayout(ID, { deck: SIDE_QUEST_DECK, ...layout });
type Made = ReturnType<typeof built>;
const nameOf = (made: Made) => (code: string) => made.cards.get(code)?.name ?? code;
const idName = (made: Made, state: Made["state"]) => (id: string) => made.cards.get(state.cards[id]?.code ?? "")?.name ?? id;
const namesOf = (made: Made, state: Made["state"] = made.state): SheetNames => ({ card: (id) => made.cards.get(state.cards[id]?.code ?? "")?.name ?? id, line: () => null });
// A time dial is its card's (`time:<card id>`), so a dial is found by the start of its id.
const dial = (made: Made, id: string, state = made.state) => angmarDials(state, made.ctx, nameOf(made)).find((one) => one.id === id || one.id.startsWith(`${id}:`));

describe("Hunting the Orcs' dial", () => {
  it("09071:A:1 reads its tokens against 3 more than the players (4 solo, 5 for two) as a goal dial, the players' way out: it never warms or warns, and is gone with the card", () => {
    const made = built({ staging: [{ code: HUNT, resources: 1 }] });
    expect(dial(made, "hunt")).toMatchObject({ testID: "angmar-hunt", value: 1, limit: 4, goal: true, limitWords: "4 flips it" });
    for (const tokens of [2, 3]) {
      const near = dial(built({ staging: [{ code: HUNT, resources: tokens }] }), "hunt");
      expect(near?.warms).toBeUndefined();
      expect(near?.warn).toBeUndefined();
    }
    const two = built({ seats: 2, staging: [{ code: HUNT, resources: 3 }] });
    expect(dial(two, "hunt")).toMatchObject({ limit: 5, goal: true });
    expect(dial(built({ staging: [] }), "hunt")).toBeUndefined();
  });

  it("09071:A:1 is on the top bar with the scenario's other dials, and a game with no side quest rules has none of them", () => {
    const made = built({ staging: [{ code: HUNT, resources: 1 }, { code: PROTECT, damage: 2 }] });
    expect(scenarioDials(made.state, made.ctx, nameOf(made)).map((one) => one.testID)).toEqual(expect.arrayContaining(["angmar-hunt", "angmar-protect"]));
    expect(angmarDials(tableFromLayout("the-oath", {}).state, made.ctx, nameOf(made))).toEqual([]);
  });

  it("09071:A:1 says the count and the flip in its preview", () => {
    const made = built({ staging: [{ code: HUNT, resources: 2 }] });
    expect(angmarDetail(made.state, made.ctx, idOf(made.state, HUNT), idName(made, made.state))).toBe("2 of 4 resource tokens on it. It flips to Savage Counter-attack at 4, tokens and all.");
  });
});

describe("Savage Counter-attack's dial", () => {
  it("09072:A:3 counts its tokens down to the loss at 0, warming at 2 and critical at 1, and gives no limit ring", () => {
    const made = built({ staging: [{ code: SAVAGE, resources: 4 }] });
    expect(dial(made, "savage")).toMatchObject({ testID: "angmar-savage", value: 4 });
    expect(dial(made, "savage")?.limit).toBeUndefined();
    expect(dial(made, "savage")?.warn).toBeUndefined();
    const id = idOf(made.state, SAVAGE);
    expect(dial(made, "savage", updateCard(made.state, id, { resources: 2 }))?.warn).toMatchObject({ level: "near", words: "Two more characters destroyed by an attack lose the game. Cornered Animals can also take one." });
    expect(dial(made, "savage", updateCard(made.state, id, { resources: 1 }))?.warn).toMatchObject({ level: "critical", words: "The next character an attack destroys loses the game." });
    expect(dial(made, "savage")?.note).toContain("with none left the players lose the game");
  });

  it("09072:A:2 says the tokens in its preview", () => {
    const made = built({ staging: [{ code: SAVAGE, resources: 3 }] });
    expect(angmarDetail(made.state, made.ctx, idOf(made.state, SAVAGE), idName(made, made.state))).toBe("3 resource tokens on it. Each character an attack destroys discards 1. The players lose when none is left.");
  });
});

describe("Find Shelter's time dial", () => {
  const SHELTER = "09032";
  it("09032:A:2 words the last counter as 4 damage on a hero and 4 counters back, warns near and never critical, and Rescue Iârion keeps its loss words", () => {
    const made = built({ staging: [{ code: SHELTER, resources: 1 }] });
    const time = dial(made, "time");
    expect(time).toMatchObject({ testID: expect.stringMatching(/^angmar-time:/), value: 1, label: "Time" });
    expect(time?.note).toContain("each player deals 4 damage to a hero they control, then 4 time counters return.");
    expect(time?.note).not.toContain("lose");
    expect(time?.warn).toMatchObject({ level: "near", words: "The next refresh phase takes the last time counter: each player deals 4 damage to a hero." });
    expect(dial(built({ staging: [{ code: SHELTER, resources: 2 }] }), "time")?.warn).toMatchObject({ level: "near", words: "2 time counters are left." });
    expect(dial(built({ staging: [{ code: SHELTER, resources: 4 }] }), "time")?.warn).toBeUndefined();
    const iarion = built({ staging: [{ code: "09024", resources: 1 }] });
    expect(dial(iarion, "time")?.note).toContain("the players lose");
    expect(dial(iarion, "time")?.warn).toMatchObject({ level: "critical" });
  });

  it("09032:A:2 says the counters and the last one's cost in its preview", () => {
    const made = built({ staging: [{ code: SHELTER, resources: 3 }] });
    // The encounter deck holds another copy, so pick the one in the staging area.
    const staged = Object.values(made.state.cards).find((card) => card.code === SHELTER && card.zone === "staging")?.id ?? "";
    expect(angmarDetail(made.state, made.ctx, staged, idName(made, made.state))).toBe("3 time counters on it. With the last gone, each player deals 4 damage to a hero they control, then 4 time counters return.");
  });
});

describe("the Orc deck", () => {
  it("09069:A:1 is a pile of the second slot with its card count, while the scenario deals it, and is no pile of another scenario", () => {
    const made = built({ piles: { angmarOrcDeck: ["09043", "09044", "09044"] } });
    expect(secondPilesOf(made.state)).toEqual(["angmarOrcDeck"]);
    expect(PILE_WORDS.angmarOrcDeck).toBe("Orc deck");
    expect(pileIds(made.state, "angmarOrcDeck", 0)).toHaveLength(3);
    expect(pileSelector("angmarOrcDeck", 0)(made.state).ids).toHaveLength(3);
    // Drawn down to nothing the pile is still drawn, with a count of 0.
    const empty = { ...made.state, piles: { ...made.state.piles, angmarOrcDeck: [] } };
    expect(secondPilesOf(empty)).toEqual(["angmarOrcDeck"]);
    expect(pileSelector("angmarOrcDeck", 0)(empty).ids).toHaveLength(0);
    expect(secondPilesOf(tableFromLayout("the-oath", {}).state)).toEqual([]);
  });
});

describe("the boons and the damage on the table", () => {
  it("10160:A:3 draws a boon under the hero it is attached to, in the hero's zone", () => {
    const made = built({ attached: [{ code: "10162", to: "dh1" }] });
    const entry = zoneSelector("play", 0)(made.state);
    const heroes = entry.entries.find((one) => one.card.id === idOf(made.state, "dh1"));
    expect(heroes?.attached.map((card) => card.id)).toContain(idOf(made.state, "10162"));
  });
});

describe("a pick that spans seats names the owner on each row", () => {
  const sheetsOf = (made: Made, code: string, timing: "response" | "forced", source: string): PickSheet[] => {
    const seen: PickSheet[] = [];
    resolveRecords(made.state, made.ctx, code, timing, source, (state) => {
      const sheet = sheetFor(state, made.ctx, legalIntents(state, made.ctx), namesOf(made, state));
      if (sheet?.kind === "pick") seen.push(sheet);
      return state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "";
    });
    return seen;
  };

  it("09029:A:1 Sheltered Valley's heal: each damaged character names the player whose it is when the rows hold more than one player's", () => {
    const made = built({ seats: 2, active: "09029" });
    const damaged = updateCard(updateCard(made.state, idOf(made.state, "dh1"), { damage: 2 }), idOf(made.state, "dh3"), { damage: 1 });
    const sheet = sheetsOf({ ...made, state: damaged }, "09029", "response", idOf(damaged, "09029"))[0];
    expect(sheet?.options.map((option) => option.label)).toEqual(expect.arrayContaining([expect.stringContaining("Player 1"), expect.stringContaining("Player 2")]));
    const solo = built({ active: "09029" });
    const one = updateCard(updateCard(solo.state, idOf(solo.state, "dh1"), { damage: 2 }), idOf(solo.state, "dh2"), { damage: 1 });
    const soloSheet = sheetsOf({ ...solo, state: one }, "09029", "response", idOf(one, "09029"))[0];
    expect(soloSheet?.options.map((option) => option.label)).toEqual(["dh1", "dh2"]);
  });
});

describe("Mysterious Omens' boon choice", () => {
  const BOONS = ["10161", "10162", "10163", "10164", "10165"];
  // The sheets the reward opens, answering the boon "10162" and then its first hero.
  const omens = (seats: 1 | 2): PickSheet[] => {
    const made = built({ seats, setAside: BOONS, staging: ["10160"] });
    const seen: PickSheet[] = [];
    resolveRecords(made.state, made.ctx, "10160", "forced", idOf(made.state, "10160"), (state) => {
      const sheet = sheetFor(state, made.ctx, legalIntents(state, made.ctx), namesOf(made, state));
      if (sheet?.kind === "pick") seen.push(sheet);
      return state.window?.kind === "choose" ? (state.window.options.includes("10162") ? "10162" : (state.window.options[0] ?? "")) : "";
    });
    return seen;
  };

  it("10160:A:3 names each boon by its card and pictures it by its code, never by the number", () => {
    const made = built();
    const boons = omens(1)[0];
    expect(boons?.options.map((one) => one.code)).toEqual([...BOONS, null]);
    expect(boons?.options.map((one) => one.label)).toEqual([...BOONS.map((code) => made.cards.get(code)?.name), "Take no boon"]);
    for (const one of boons?.options ?? []) expect(one.label).not.toMatch(/^\d{5}$/);
  });

  it("10160:A:3 words the hero that carries the boon on its own, not as Mount Gundabad's Condition, and leads with the player two-handed", () => {
    const name = built().cards.get("10162")?.name ?? "";
    const solo = omens(1)[1];
    expect(solo?.note).toContain(`choose a hero you control to carry ${name}. It stays with that hero through the campaign.`);
    expect(solo?.note).not.toMatch(/Condition|lose the game/);
    const two = omens(2)[1];
    expect(two?.note).toMatch(new RegExp(`^Player 1: .*carry ${name}\\.`));
    expect(two?.note).not.toContain("Player 1 chooses");
  });
});

describe("the damage-assign sheets count what is left", () => {
  it("09031:A:1 Ice Storm names X as the quest cards in play and the damage still to place, falling as each is placed", () => {
    const made = built({ staging: [PROTECT] });
    const notes: string[] = [];
    resolveRecords(made.state, made.ctx, "09031", "whenRevealed", undefined, (state) => {
      const sheet = sheetFor(state, made.ctx, legalIntents(state, made.ctx), namesOf(made, state));
      if (sheet?.kind === "pick") notes.push(sheet.note ?? "");
      return state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "";
    });
    expect(notes.length).toBeGreaterThan(1);
    expect(notes[0]).toContain("assign 2 damage among the characters you control, 1 at a time (2, the quest cards in play; 2 left).");
    expect(notes[1]).toContain("1 left)");
    expect(notes.join(" ")).not.toContain("X is");
  });
});
