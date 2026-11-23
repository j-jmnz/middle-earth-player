// Rules: hob.sack-deck, hob.sack-x, hob.sack-x-example, rr.travel, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 131023:A:1, 131032:A:2, 131044:A:1, 131044:A:2, 131045:A:1, 131049:A:1, 131050:A:1, 131025:B:1, 131037:A:2, 131024:B:1.
// The sack family's verbs and conditions on the scenario's own table: the Sack deck from the Setup, Sack X with the When Sacked attach, a Sack card that leaves play going back into the deck, the removal of the Trolls and Sack cards, Troll Cave's Baggins cost.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../../../catalog/boundary.ts";
import type { EngineStep } from "../../core/intents.ts";
import { settle } from "../../engine/machine.ts";
import { reduce } from "../../engine/reduce.ts";
import { expectOk } from "../../core/test-fixture.ts";
import { pushCardEffects } from "../../interpret/effect-frames.ts";
import { holds } from "../../interpret/conditions.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { pileOf, withPile } from "../../core/piles.ts";
import type { ScenarioState } from "../../core/state.ts";
import { moveCard, spawn } from "../../core/zones.ts";
import { allyCard, heroCard } from "../../../../test/harness/scene-kit.ts";
import { definePrinted } from "../../core/printed.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { encounterWorld, type EncounterWorld } from "../../../../scripts/card-smoke/encounter-world.ts";
import { probeTable } from "../../../../scripts/card-smoke/encounter.ts";

let world: EncounterWorld;
let table: ScenarioState;
let ctx: ReduceContext;
const ctxOf = () => ctx;

beforeAll(async () => {
  world = await encounterWorld("we-must-away-ere-break-of-day");
  table = probeTable(world);
  // Stand-in allies of known printed values (the world holds the scenario's own cards only), and Bilbo Baggins, whom the loadout deals in a real game.
  const cards = new Map(world.contexts.strong.cards);
  cards.set("a1", allyCard("a1", 1, { attack: 0, defense: 3, health: 1, willpower: 0 }));
  cards.set("a4", allyCard("a4", 4, { attack: 1, defense: 2, health: 3, willpower: 2 }));
  cards.set("a6", allyCard("a6", 6, { attack: 9, defense: 1, health: 8, willpower: 5 }));
  cards.set("gandalf", allyCard("gandalf", 9, { name: "Gandalf", attack: 20, defense: 20, health: 20, willpower: 20 }));
  cards.set("bilbo", definePrinted({ code: "bilbo", name: "Bilbo Baggins", type: "hero", sphere: "neutral", threat: 9, willpower: 1, attack: 1, defense: 1, health: 3 }));
  cards.set("hero", heroCard("hero"));
  ctx = { ...world.contexts.strong, cards };
  table = spawn(table, "bilbo", { zone: "heroes", seat: 0 }).state;
});

const SACKS = ["131044", "131045", "131046", "131047", "131048", "131049", "131050"];
const run = (state: ScenarioState, instruction: Instruction, sourceId: string | null = null, steps: EngineStep[] = []) => runInstruction(state, instruction, { seat: 0, sourceId }, ctxOf(), steps);
const quiet = (state: ScenarioState): ScenarioState => settle({ ...state, window: null, mode: "stopped" }, ctxOf(), []);
// The first player's answer to a tie, the first character offered, until no choice is open.
function answered(state: ScenarioState): ScenarioState {
  let next = quiet(state);
  for (let guard = 0; guard < 6 && next.window?.kind === "choose"; guard += 1) next = quiet(expectOk(reduce(next, { type: "Choose", optionId: next.window.options[0] ?? "" }, ctxOf())).state);
  return next;
}
const ofCode = (state: ScenarioState, code: string) => Object.values(state.cards).find((card) => card.code === code);
const cond = (state: ScenarioState, condition: Parameters<typeof holds>[1]) => holds(state, condition, { actor: 0, sourceId: null, returned: 0 }, ctxOf());
// A table whose Sack deck has this card on top, with these allies in play for seat 0.
function withAllies(top: string, allies: readonly string[]): ScenarioState {
  let state = table;
  for (const code of allies) state = spawn(state, code, { zone: "play", seat: 0 }).state;
  const sack = ofCode(state, top)!;
  return withPile(state, "sackDeck", [sack.id, ...pileOf(state, "sackDeck").filter((id) => id !== sack.id)]);
}

describe("131023:A:1 the Sack deck", () => {
  it("holds the seven Sack cards facedown after the Setup, and the Trolls and Troll Cave stay set aside", () => {
    expect(pileOf(table, "sackDeck")).toHaveLength(7);
    expect(pileOf(table, "sackDeck").map((id) => table.cards[id]?.code).sort()).toEqual(SACKS);
    for (const id of pileOf(table, "sackDeck")) expect(table.cards[id]?.zone).toBe("sackDeck");
    for (const code of ["131032", "131033", "131034", "131037"]) expect(ofCode(table, code)?.zone).toBe("setAside");
  });
});

describe("131044:A:1 When Sacked", () => {
  it("attaches A Smelly Sack to the ally with the highest printed cost, never Gandalf", () => {
    const start = withAllies("131044", ["a4", "gandalf", "a1"]);
    const done = quiet(run(start, { verb: "Sack", amount: 1 }));
    const sack = ofCode(done, "131044")!;
    expect(sack.zone).toBe("attached");
    expect(done.cards[sack.host!]?.code).toBe("a4");
  });

  it("goes back into the Sack deck, shuffled in, when no ally can hold it", () => {
    const start = withAllies("131044", []);
    const done = quiet(run(start, { verb: "Sack", amount: 1 }));
    expect(ofCode(done, "131044")?.zone).toBe("sackDeck");
    expect(pileOf(done, "sackDeck")).toHaveLength(7);
  });

  it("skips a character that holds a Sack already and one that cannot have attachments", () => {
    const start = withAllies("131044", ["a4", "a6"]);
    const first = quiet(run(start, { verb: "Sack", amount: 1 }));
    const holder = first.cards[ofCode(first, "131044")!.host!]!;
    expect(holder.code).toBe("a6");
    // A Strong Sack would go to the highest printed Attack, which holds a Sack now: the next character takes it.
    const strong = ofCode(first, "131045")!;
    const second = quiet(run(withPile(first, "sackDeck", [strong.id, ...pileOf(first, "sackDeck").filter((id) => id !== strong.id)]), { verb: "Sack", amount: 1 }));
    expect(second.cards[ofCode(second, "131045")!.host!]?.id).not.toBe(holder.id);
    // The same card with the highest-Attack character barred from attachments: it goes to another one too.
    const barred = { ...withAllies("131045", ["a4", "a6"]), };
    const a6 = ofCode(barred, "a6")!;
    const flagged = { ...barred, modifiers: [...barred.modifiers, { instanceId: a6.id, sourceId: "table", stat: "cannotHaveAttachments" as const, amount: 1, until: "endOfGame" as const }] };
    const third = quiet(run(flagged, { verb: "Sack", amount: 1 }));
    expect(third.cards[ofCode(third, "131045")!.host!]?.id).not.toBe(a6.id);
  });
});

describe("131045:A:1 and 131049:A:1 the other When Sacked lines", () => {
  it("attaches A Strong Sack to the character with the highest printed attack", () => {
    const start = withAllies("131045", ["a4", "a6"]);
    const done = answered(run(start, { verb: "Sack", amount: 1 }));
    // Legolas (printed Attack 3, a hero in the probe table's seat or none): the highest printed Attack among the characters in play holds it.
    const host = done.cards[ofCode(done, "131045")!.host!]!;
    const attacks = Object.values(done.cards).filter((card) => card.zone === "play" || card.zone === "heroes").map((card) => ctxOf().cards.get(card.code)?.attack ?? 0);
    expect(ctxOf().cards.get(host.code)?.attack ?? 0).toBe(Math.max(...attacks));
  });

  it("attaches A Foul Sack to the character with the most attachments", () => {
    const start = withAllies("131049", ["a4", "a1"]);
    const faramir = ofCode(start, "a4")!;
    const stuffed = spawn(start, "131043", { zone: "attached" });
    const moved = { ...stuffed.state, cards: { ...stuffed.state.cards, [stuffed.id]: { ...stuffed.state.cards[stuffed.id]!, host: faramir.id }, [faramir.id]: { ...stuffed.state.cards[faramir.id]!, attachments: [stuffed.id] } } };
    const done = quiet(run(moved, { verb: "Sack", amount: 1 }));
    expect(done.cards[ofCode(done, "131049")!.host!]?.code).toBe("a4");
  });

  it("attaches A Worn Sack to a hero, never an ally", () => {
    const start = withAllies("131050", ["a4"]);
    const done = answered(run(start, { verb: "Sack", amount: 1 }));
    const host = done.cards[ofCode(done, "131050")!.host!]!;
    expect(done.seats[0]?.heroes).toContain(host.id);
  });
});

describe("131044:A:1 a tie", () => {
  it("is the first player's to settle: the heroes tied for the most resources are offered", () => {
    const asked = quiet(run(withAllies("131050", ["a4"]), { verb: "Sack", amount: 1 }));
    expect(asked.window?.kind).toBe("choose");
    if (asked.window?.kind !== "choose") return;
    expect(asked.window.options.length).toBeGreaterThan(1);
    for (const id of asked.window.options) expect(asked.seats[0]?.heroes).toContain(id);
  });
});

describe("131032:A:2 Sack X", () => {
  it("draws X cards one after the other, each attached before the next is drawn", () => {
    const start = withAllies("131044", ["a4", "a1", "a6"]);
    // As William's Forced effect runs it: Sack 2 inside the effect, whose queue holds the second draw behind the first.
    const william = spawn(start, "131032", { zone: "staging" });
    const effect: Effect = { id: "131032:forced:1", cardCode: "131032", lines: ["131032:A:2"], timing: "forced", trigger: "engaged", subject: "self", instructions: [{ verb: "Sack", amount: 2 }] };
    const done = answered(pushCardEffects(william.state, "whenRevealed", william.id, 0, false, [effect], ctxOf(), []));
    const attached = SACKS.map((code) => ofCode(done, code)).filter((card) => card?.zone === "attached");
    expect(attached).toHaveLength(2);
    expect(new Set(attached.map((card) => card?.host)).size).toBe(2);
  });

  it("is ignored with the Sack deck empty", () => {
    const start = withPile(table, "sackDeck", []);
    expect(quiet(run(start, { verb: "Sack", amount: 2 })).stack).toHaveLength(0);
  });
});

describe("131044:A:2 a Sack card that leaves play", () => {
  it("is shuffled into the Sack deck, whether it is discarded or its host leaves play", () => {
    const start = withAllies("131044", ["a4"]);
    const done = quiet(run(start, { verb: "Sack", amount: 1 }));
    const sack = ofCode(done, "131044")!;
    const discarded = moveCard(done, sack.id, { zone: "encounterDiscard" });
    expect(discarded.cards[sack.id]?.zone).toBe("sackDeck");
    expect(pileOf(discarded, "sackDeck")).toHaveLength(7);
    const lost = moveCard(done, sack.host!, { zone: "discard", seat: 0 });
    expect(lost.cards[sack.id]?.zone).toBe("sackDeck");
  });
});

describe("131025:B:1 remove all Troll enemies and Sack cards", () => {
  it("removes them wherever they lie, the Sack cards in play and in the deck included", () => {
    const start = withAllies("131044", ["a4"]);
    const sacked = quiet(run(start, { verb: "Sack", amount: 1 }));
    const done = run(sacked, { verb: "RemoveTraitFromGame", traits: ["Troll", "Sack"] });
    for (const code of [...SACKS, "131032", "131033", "131034"]) expect(ofCode(done, code)?.zone).toBe("removed");
    expect(ofCode(done, "131037")?.zone).toBe("setAside");
  });
});

describe("131024:B:1 an empty encounter deck", () => {
  it("holds only when the encounter deck has no card", () => {
    expect(cond(table, { kind: "encounterDeckEmpty" })).toBe(false);
    expect(cond({ ...table, encounterDeck: [] }, { kind: "encounterDeckEmpty" })).toBe(true);
  });
});

describe("131037:A:2 Troll Cave's Baggins cost", () => {
  const TRAVEL = { kind: "bagginsTravel", amount: 5, reduced: 2, key: "131043", purse: "131042" } as const;
  const bilbo = (state: ScenarioState) => ofCode(state, "bilbo")!;
  function holding(codes: readonly string[], resources: number): ScenarioState {
    let state = table;
    const host = bilbo(state);
    const attachments: string[] = [];
    for (const code of codes) {
      const made = spawn(state, code, { zone: "attached" });
      state = { ...made.state, cards: { ...made.state.cards, [made.id]: { ...made.state.cards[made.id]!, host: host.id } } };
      attachments.push(made.id);
    }
    return { ...state, cards: { ...state.cards, [host.id]: { ...state.cards[host.id]!, attachments, resources } } };
  }

  it("cannot be paid without the Troll Key, or with too few Baggins resources", () => {
    expect(cond(holding([], 9), TRAVEL)).toBe(false);
    expect(cond(holding(["131043"], 4), TRAVEL)).toBe(false);
    expect(cond(holding(["131043"], 5), TRAVEL)).toBe(true);
  });

  it("costs 2 with the Troll Purse attached too, and spends them", () => {
    const state = holding(["131043", "131042"], 3);
    expect(cond(state, TRAVEL)).toBe(true);
    const spent = run(state, { verb: "SpendBagginsToTravel", amount: 5, reduced: 2, key: "131043", purse: "131042" });
    expect(bilbo(spent).resources).toBe(1);
    const dear = run(holding(["131043"], 5), { verb: "SpendBagginsToTravel", amount: 5, reduced: 2, key: "131043", purse: "131042" });
    expect(bilbo(dear).resources).toBe(0);
  });
});
