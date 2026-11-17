// Rules: rr.forced, rr.in-play-and-out-of-play, rr.discard-pile-and-victory-display (data/rules/entries.json).
// A Forced effect that works from the victory display (`fromVictory`, Louis in the Nightmare deck, 900504:A:2), and ShuffleIntoDeck with `each` (Rupert, 02041:A:1).
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";

import { withThreat } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { fireForced } from "../../windows/triggers.ts";
import { settle } from "../../engine/machine.ts";
import { encounterCtx, put, seat } from "./fixture.ts";

const LOUIS: Effect = {
  id: "troll:forced:1",
  cardCode: "troll",
  lines: ["900504:A:2"],
  timing: "forced",
  trigger: "attackResolved",
  subject: { type: "enemy", control: "any" },
  fromVictory: true,
  condition: { kind: "sourceIn", zone: "victory" },
  instructions: [{ verb: "RaiseThreat", amount: 1, who: "eventSeat" }],
};
const ctx = encounterCtx([LOUIS]);

function attacked(zone: "victory" | "encounterDiscard") {
  const table = seat();
  const orc = put(withThreat(table.state, 0, 20), "orc", "engaged");
  const louis = spawn(orc.state, "troll", zone === "victory" ? { zone: "victory" } : { zone });
  const fired = fireForced({ ...louis.state, window: null }, { trigger: "attackResolved", seat: 0, cardId: orc.id }, ctx, []);
  return settle(fired, ctx, []);
}

describe("900504:A:2 a Forced effect from the victory display", () => {
  it("is heard from the victory display", () => {
    expect(attacked("victory").seats[0]?.threat).toBe(21);
  });

  it("is not heard from the encounter discard pile", () => {
    expect(attacked("encounterDiscard").seats[0]?.threat).toBe(20);
  });
});

// ShuffleIntoDeck each (02041:A:1): every copy in the discard pile goes back into the deck.
describe("02041:A:1 every copy of a card goes from the encounter discard pile back into the deck", () => {
  const RUPERT: Effect = {
    id: "troll:forced:2",
    cardCode: "troll",
    lines: ["02041:A:1"],
    timing: "forced",
    trigger: "attackResolved",
    subject: "self",
    instructions: [{ verb: "ShuffleIntoDeck", code: "marsh", each: true }],
  };
  const rupertCtx = encounterCtx([RUPERT]);

  it("moves them all and leaves the other discarded cards", () => {
    const table = seat();
    const troll = put(table.state, "troll", "engaged");
    const first = put(troll.state, "marsh", "encounterDiscard");
    const second = put(first.state, "marsh", "encounterDiscard");
    const other = put(second.state, "ford", "encounterDiscard");
    const fired = settle(fireForced({ ...other.state, window: null }, { trigger: "attackResolved", seat: 0, cardId: troll.id }, rupertCtx, []), rupertCtx, []);
    expect([...fired.encounterDeck].sort()).toEqual([first.id, second.id].sort());
    expect(fired.encounterDiscard).toEqual([other.id]);
  });

  it("does nothing with no copy in the discard pile", () => {
    const troll = put(seat().state, "troll", "engaged");
    const fired = settle(fireForced({ ...troll.state, window: null }, { trigger: "attackResolved", seat: 0, cardId: troll.id }, rupertCtx, []), rupertCtx, []);
    expect(fired.encounterDeck).toEqual([]);
  });
});

// Discard of the other card an event names (Muck Adder, 02042:A:1).
describe("02042:A:1 the character an attack damaged is discarded from play", () => {
  const ADDER: Effect = {
    id: "troll:forced:3",
    cardCode: "troll",
    lines: ["02042:A:1"],
    timing: "forced",
    trigger: "attackDamagedCharacter",
    subject: "self",
    instructions: [{ verb: "Discard", target: { kind: "other" } }],
  };
  const adderCtx = encounterCtx([ADDER]);

  it("discards the damaged ally from play, and does nothing when it is already gone", () => {
    const table = seat();
    const troll = put(table.state, "troll", "engaged");
    const buddy = put(troll.state, "04102", "play");
    const event = { trigger: "attackDamagedCharacter" as const, seat: 0, cardId: troll.id, other: buddy.id };
    const fired = settle(fireForced({ ...buddy.state, window: null }, event, adderCtx, []), adderCtx, []);
    expect(fired.cards[buddy.id]?.zone).toBe("discard");
    const again = settle(fireForced({ ...fired, window: null }, event, adderCtx, []), adderCtx, []);
    expect(again.cards[buddy.id]?.zone).toBe("discard");
  });
});

// The total Threat of the staging area as an amount (A Frightened Beast, 02047:A:1).
describe("02047:A:1 the total Threat of all cards in the staging area", () => {
  const BEAST: Effect = {
    id: "troll:forced:4",
    cardCode: "troll",
    lines: ["02047:A:1"],
    timing: "forced",
    trigger: "attackResolved",
    subject: "self",
    instructions: [{ verb: "RaiseThreat", amount: { stagingThreat: true }, who: "eachSeat" }],
  };
  const beastCtx = encounterCtx([BEAST]);

  it("raises each player's threat by the Threat of the staging area's locations and enemies, engaged enemies left out", () => {
    const table = seat();
    const troll = put(withThreat(table.state, 0, 20), "troll", "engaged");
    const marsh = put(troll.state, "marsh", "staging");
    const orc = put(marsh.state, "orc", "staging");
    const fired = settle(fireForced({ ...orc.state, window: null }, { trigger: "attackResolved", seat: 0, cardId: troll.id }, beastCtx, []), beastCtx, []);
    expect(fired.seats[0]?.threat).toBe(24);
  });
});
