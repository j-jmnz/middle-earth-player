// Rules: rr.triggered-ability, rr.cost, rr.then, rr.search, rr.the-word-choose (data/rules/entries.json).
// Whether an Action of an event can change the game (src/rules/player/potential.ts, idle.ts), part 2: the kinds of instruction and the shapes of effect that potential.test.ts does
// not reach, each with one table where the event is refused and the nearest table where it is offered (`seenEvent` checks that the offer and the refusal of the PlayCard agree).
import { describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { attachTo } from "../core/zones.ts";
import { noChangeReason } from "./potential.ts";
import { cards, heroes, idOf, inDeck, seenEvent as seen, triggerTable, type Shape } from "../../../test/harness/potential-kit.ts";

const engaged = { count: { type: "enemy", control: "any", engaged: "you" } } as const;
const foeEngaged = ["foe", { zone: "engaged", seat: 0 }] as const;
const condition = { type: "attachment", control: "any", trait: "Condition" } as const;
// The attachment "att" on the first hero.
const worn: Shape = (state) => attachTo(state, idOf(state, "att"), idOf(state, "hero"));

describe("an Action of an event with nothing to change is not offered", () => {
  it("a shuffle of an empty deck", () => {
    expect(seen([{ verb: "ShuffleDeck" }])).toBe(false);
    expect(seen([{ verb: "ShuffleDeck" }], [inDeck])).toBe(true);
  });

  it("a move of resources by an amount of 0", () => {
    const steps = [{ verb: "HeroesGainResources", amount: engaged }] as const;
    expect(seen(steps)).toBe(false);
    expect(seen(steps, [foeEngaged])).toBe(true);
  });

  it("a stat change by 0 is idle, and by a negative amount is not", () => {
    const stat = (amount: unknown) => [{ verb: "Pick", pick: heroes }, { verb: "ModifyStat", stat: "willpower", amount, until: "endOfPhase", target: "picked" }];
    expect(seen(stat(engaged))).toBe(false);
    expect(seen(stat(engaged), [foeEngaged])).toBe(true);
    expect(seen(stat({ ...engaged, negative: true }))).toBe(false);
    expect(seen(stat({ ...engaged, negative: true }), [foeEngaged])).toBe(true);
  });

  it("a bar on an attack with no engaged enemy, and progress with no location", () => {
    expect(seen([{ verb: "BarAttack" }])).toBe(false);
    expect(seen([{ verb: "BarAttack" }], [foeEngaged])).toBe(true);
    expect(seen([{ verb: "PlaceProgressOnLocation", perPlayer: 1 }])).toBe(false);
    expect(seen([{ verb: "PlaceProgressOnLocation", perPlayer: 1 }], [["place", { zone: "staging" }]])).toBe(true);
  });

  it("a Pick that moves an attachment when no other hero can take it (hostForPicked)", () => {
    const steps = [{ verb: "Pick", pick: { type: "attachment", control: "any" } }, { verb: "Pick", pick: { ...heroes, hostForPicked: true } }, { verb: "AttachPicked" }] as const;
    expect(seen(steps, [["att", { zone: "play", seat: 0 }]], worn)).toBe(false);
    expect(seen(steps, [["att", { zone: "play", seat: 0 }], ["hero", { zone: "heroes", seat: 0 }]], worn)).toBe(true);
  });

  it("a step that pays for the rest, by an Exhaust or a Discard of the picked card, before a draw from an empty deck", () => {
    const exhaust = [{ verb: "Pick", pick: heroes }, { verb: "Exhaust", target: { kind: "picked" } }, { verb: "Draw", amount: 1 }] as const;
    expect(seen(exhaust)).toBe(false);
    expect(seen(exhaust, [inDeck])).toBe(true);
    const discard = [{ verb: "Pick", pick: { type: "attachment", control: "any" } }, { verb: "Discard", target: { kind: "picked" } }, { verb: "Draw", amount: 1 }] as const;
    expect(seen(discard, [["att", { zone: "play", seat: 0 }]], worn)).toBe(false);
    expect(seen(discard, [["att", { zone: "play", seat: 0 }], inDeck], worn)).toBe(true);
  });
});

describe("a Choose is read for who makes it, how many options and what each requires", () => {
  const skip = { id: "skip", instructions: [] };

  it("a choice of the actor with no instruction is idle; one for another player, or with upTo, is not settled", () => {
    expect(seen([{ verb: "Choose", who: "actor", options: [skip] }])).toBe(false);
    expect(seen([{ verb: "Choose", who: "firstPlayer", options: [skip] }])).toBe(true);
    expect(seen([{ verb: "Choose", who: "actor", upTo: 1, options: [skip] }])).toBe(true);
  });

  it("an option whose requirement reads the table is out of reach when it fails, and one that reads the running effect (Athelas) is not settled", () => {
    const onTable = [{ verb: "Choose", who: "actor", options: [{ id: "discard", requires: { kind: "canPick", pick: condition }, instructions: [{ verb: "Pick", pick: condition }, { verb: "Discard", target: { kind: "picked" } }] }, skip] }] as const;
    expect(seen(onTable)).toBe(false);
    expect(seen(onTable, [["att", { zone: "play", seat: 0 }]], worn)).toBe(true);
    const own = { ...condition, onPicked: true } as const;
    const athelas = [{ verb: "Pick", pick: { type: "character", control: "any" } }, { verb: "Heal", all: true }, { verb: "Choose", who: "actor", options: [{ id: "discard", requires: { kind: "canPick", pick: own }, instructions: [{ verb: "Pick", pick: own }, { verb: "Discard", target: { kind: "picked" } }] }, skip] }] as const;
    expect(seen(athelas, [["att", { zone: "play", seat: 0 }]], worn)).toBe(true);
  });
});

describe("a Then part is not attempted after a draw or a discard that found too few cards", () => {
  const then = { verb: "SetThreat", value: 30, when: { kind: "thenResolves" } } as const;

  it("a Repeat of a discard from the top of an empty deck, then a part that waits for it", () => {
    const steps = [{ verb: "Repeat", times: 2, instructions: [{ verb: "DiscardTopOfDeck" }] }, then] as const;
    expect(seen(steps)).toBe(false);
    expect(seen(steps, [inDeck])).toBe(true);
  });

  it("a short draw inside a Choose option or a ForEachPlayer seat is not seen by a part after them", () => {
    const draw = { verb: "Draw", amount: 1 } as const;
    expect(seen([draw, then])).toBe(false);
    expect(seen([{ verb: "Choose", who: "actor", options: [{ id: "draw", instructions: [draw] }, { id: "skip", instructions: [] }] }, then])).toBe(true);
    expect(seen([{ verb: "ForEachPlayer", order: "firstFirst", instructions: [draw] }, then])).toBe(true);
  });
});

describe("a Response to a card that left play (noChangeReason)", () => {
  // The Response damages "the other card" of the event it answers: the card the event names, which may have left play since.
  const response: Effect = { id: "gadget:response:1", cardCode: "gadget", lines: ["gadget:A:1"], timing: "response", trigger: "healed", instructions: [{ verb: "DamageCard", amount: 1, target: "other" }] };
  const read = (zone: "discard" | "engaged"): string | null => {
    const { state, id } = triggerTable([["foe", zone === "discard" ? { zone: "discard", seat: 0 } : { zone: "engaged", seat: 0 }]]);
    return noChangeReason(state, response, id, 0, { effects: [response], cards }, { trigger: "healed", seat: 0, other: idOf(state, "foe") });
  };

  it("is not offered once the card is in a discard pile, and is while it is in play", () => {
    expect(read("discard")).toBe("That effect would change nothing");
    expect(read("engaged")).toBeNull();
  });
});
