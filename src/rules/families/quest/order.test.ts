import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { definePrinted } from "../../core/printed.ts";
import { legalIntents } from "../../engine/reduce.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { hero, send, table, type Table } from "../defense/table.ts";

// Rules: rr.quest-cards-quest-deck, rr.quest-advancement, dcce.heading, ltp.victory-display (data/rules/entries.json); ledger lines 11016:A:1, 11016:B:3,
// 11017:B:3. A quest whose stages say LookAtStages is ordered by its quest deck: ShuffleStages puts the stage 2 cards in a random order above stage 3, the
// stage defeated on-course lets the first player choose one of the top two (the other goes to the bottom), off-course goes to the top, and a stage that
// prints Victory goes to the victory display.
const STAGES = ["q1", "qa", "qb", "qc", "qd", "q3"] as const;
const TWOS = ["qa", "qb", "qc", "qd"];

const looks = (code: string): Effect => ({ id: `${code}:constant:1`, cardCode: code, lines: [`${code}:B:1`], timing: "constant", instructions: [{ verb: "LookAtStages", count: 2 }] });
const shuffle: Effect = { id: "call:action:1", cardCode: "call", lines: ["call:A:1"], timing: "action", instructions: [{ verb: "ShuffleStages", codes: TWOS }] };
const advance: Effect = { id: "next:action:1", cardCode: "next", lines: ["next:A:1"], timing: "action", instructions: [{ verb: "AdvanceStage" }] };

function questTable(heading: "Sun" | "Rain"): Table {
  const quest = (code: string) => definePrinted({ code, name: code, type: "quest", questPoints: 2, victory: code === "q3" ? null : 3 });
  const built = table({
    cards: [hero("aragorn"), ...STAGES.map(quest), definePrinted({ code: "call", name: "call", type: "event", sphere: "tactics", cost: 0 }), definePrinted({ code: "next", name: "next", type: "event", sphere: "tactics", cost: 0 })],
    effects: [...TWOS.slice(0, 4).map(looks), looks("q1"), shuffle, advance],
    heroes: [{ code: "aragorn" }],
    hand: [{ code: "call" }, { code: "next" }, { code: "next", key: "next2" }],
  });
  let state = built.state;
  const ids = { ...built.ids };
  STAGES.forEach((code, index) => {
    const spawned = spawn(state, code, index === 0 ? { zone: "questStage" } : { zone: "questDeck" }, index === 0 ? "B" : "A");
    state = spawned.state;
    ids[code] = spawned.id;
  });
  state = {
    ...state,
    stages: STAGES.map((code) => (code === "q3" ? { code } : { code, look: 2 })),
    sea: { heading, headingCard: null, routes: {} },
    mode: "combatActions",
    phase: "Combat",
    boundaryPhase: "Combat",
    window: { kind: "pass" },
    passed: [],
  };
  return { state, ids, ctx: built.ctx };
}

const play = (state: ScenarioState, t: Table, key: string): ScenarioState => send(state, { type: "PlayCard", cardId: t.ids[key]!, payments: [] }, t.ctx);
const deck = (state: ScenarioState): string[] => state.questDeck.map((id) => state.cards[id]?.code ?? "");

describe("ShuffleStages (11016:A:1)", () => {
  it("puts the named stages in a seeded random order above the others, which keep their order", () => {
    const t = questTable("Sun");
    const orders = new Set<string>();
    for (let seed = 1; seed <= 12; seed += 1) {
      const shuffled = play({ ...t.state, seed }, t, "call");
      const order = deck(shuffled);
      expect(order.slice(0, 4).sort()).toEqual([...TWOS].sort());
      expect(order[4]).toBe("q3");
      orders.add(order.join());
    }
    expect(orders.size).toBeGreaterThan(3);
    expect(deck(play(t.state, t, "call"))).toEqual(deck(play(t.state, t, "call")));
  });
});

describe("LookAtStages (11016:B:3, 11017:B:3)", () => {
  it("off-course advances to the top stage of the quest deck, and the defeated stage goes to the victory display", () => {
    const t = questTable("Rain");
    const state = play(updateCard(t.state, t.ids.q1!, { progress: 2 }), t, "next");
    expect(state.window?.kind).not.toBe("choose");
    expect(state.cards[state.questStage ?? ""]?.code).toBe("qa");
    expect(state.cards[t.ids.q1!]?.zone).toBe("victory");
    expect(state.stageChoice).toBeUndefined();
  });

  it("on-course asks the first player to choose one of the top two, and the other goes to the bottom", () => {
    const t = questTable("Sun");
    const asked = play(updateCard(t.state, t.ids.q1!, { progress: 2 }), t, "next");
    expect(asked.window).toMatchObject({ kind: "choose", seat: 0, options: [t.ids.qa, t.ids.qb] });
    expect(asked.cards[asked.questStage ?? ""]?.code).toBe("q1");
    expect(legalIntents(asked, t.ctx).map((intent) => (intent.type === "Choose" ? intent.optionId : intent.type)).sort()).toEqual([t.ids.qa, t.ids.qb].sort());
    const chosen = send(asked, { type: "Choose", optionId: t.ids.qb! }, t.ctx);
    expect(chosen.cards[chosen.questStage ?? ""]?.code).toBe("qb");
    expect(chosen.cards[t.ids.qb!]?.face).toBe("B");
    expect(deck(chosen)).toEqual(["qc", "qd", "q3", "qa"]);
    expect(chosen.stageChoice).toBeUndefined();
    expect(chosen.cards[t.ids.q1!]?.zone).toBe("victory");
  });

  it("can bring stage 3 up before every stage 2 has been played, and wins when the deck is empty", () => {
    const t = questTable("Sun");
    // Four stages left of the deck [qd, q3]: on-course, the first player may take stage 3.
    let state: ScenarioState = { ...t.state, questDeck: [t.ids.qd!, t.ids.q3!] };
    state = play(updateCard(state, t.ids.q1!, { progress: 2 }), t, "next");
    expect(state.window).toMatchObject({ kind: "choose", options: [t.ids.qd, t.ids.q3] });
    state = send(state, { type: "Choose", optionId: t.ids.q3! }, t.ctx);
    expect(state.cards[state.questStage ?? ""]?.code).toBe("q3");
    expect(deck(state)).toEqual(["qd"]);
  });

  it("goes to the only stage left without asking, and defeating the last stage wins the game", () => {
    const t = questTable("Sun");
    let state: ScenarioState = { ...t.state, questDeck: [t.ids.q3!] };
    state = play(updateCard(state, t.ids.q1!, { progress: 2 }), t, "next");
    expect(state.window?.kind).not.toBe("choose");
    expect(state.cards[state.questStage ?? ""]?.code).toBe("q3");
    const last: ScenarioState = { ...state, questDeck: [] };
    const done = play(updateCard(last, last.questStage!, { progress: 2 }), { ...t, state: last }, "next2");
    expect(done.stageCleared).toBe(true);
  });
});
