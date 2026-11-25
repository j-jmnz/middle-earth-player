import { describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../../../catalog/boundary.ts";
import type { EngineStep } from "../../core/intents.ts";
import { settle } from "../../engine/machine.ts";
import { pushCardEffects } from "../../interpret/effect-frames.ts";
import type { ScenarioState } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { hero, table, treachery } from "../defense/table.ts";

// Rules: rr.reveal (data/rules/entries.json); ledger line 131028:B:2.
// "Reveal 3 encounter cards per player, Bilbo Baggins may spend X resources to reduce the total number of encounter cards revealed by X. (To a minimum of 1.)": RevealEncounter `times` with `lessX`.

const SOURCE = treachery("source");

function stagedAfter(x: number | null, times: number, deckSize: number): number {
  const instructions: Instruction[] = [
    ...(x == null ? [] : [{ verb: "SetX", value: x } as const]),
    { verb: "RevealEncounter", times: { players: true, times }, lessX: true },
  ];
  const record: Effect = { id: "source:whenRevealed:1", cardCode: "source", lines: ["source:A:1"], timing: "whenRevealed", instructions };
  const cards = Array.from({ length: deckSize }, (_, at) => treachery(`t${at}`));
  const built = table({ cards: [hero("a"), SOURCE, ...cards], effects: [record], seatCount: 1, heroes: [{ code: "a" }], hand: [{ code: "source" }] });
  let state: ScenarioState = built.state;
  for (let at = 0; at < deckSize; at += 1) state = spawn(state, `t${at}`, { zone: "encounterDeck" }).state;
  const source = Object.values(state.cards).find((card) => card.code === "source")!;
  const steps: EngineStep[] = [];
  const done = settle(pushCardEffects({ ...state, firstPlayer: 0, phase: "Quest", window: null }, "whenRevealed", source.id, 0, false, [record], built.ctx, steps), built.ctx, steps);
  return Object.values(done.cards).filter((card) => card.code.startsWith("t") && card.zone !== "encounterDeck").length;
}

describe("RevealEncounter lessX (131028:B:2, rr.reveal)", () => {
  it("131028:B:2 with no X chosen the stage reveals 3 cards per player", () => {
    expect(stagedAfter(null, 3, 6)).toBe(3);
  });

  it("131028:B:2 the X resources spent reduce the cards revealed by X", () => {
    expect(stagedAfter(2, 3, 6)).toBe(1);
    expect(stagedAfter(1, 3, 6)).toBe(2);
  });

  it("131028:B:2 the reduction stops at 1 card", () => {
    expect(stagedAfter(5, 3, 6)).toBe(1);
  });
});
