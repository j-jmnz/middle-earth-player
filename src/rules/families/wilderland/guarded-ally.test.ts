import { describe, expect, it } from "vitest";

import type { Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";
import { AUTHORED_EFFECTS as RIVENDELL } from "../../../effects/authored/dwarrowdelf/road-to-rivendell.ts";
import type { EngineStep } from "../../core/intents.ts";
import { settle } from "../../engine/machine.ts";
import { pushCardEffects } from "../../interpret/effect-frames.ts";
import { definePrinted } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged } from "../../core/state.ts";
import { moveEncounter } from "../encounter/moves.ts";
import { enemy, hero, table, treachery } from "../defense/table.ts";
import { makeActiveIn } from "../south/locations.ts";

// Rules: rr.guarded, rr.in-play-and-out-of-play, dwd.ally-objective-arwen-road-to-rivendell (data/rules/entries.json); ledger lines 901402:B:1, 04041:A:1, 04041:A:3.
// GuardReturnedBy `returns: "firstPlayer"`: the first player loses control of Arwen and Goblin Gate, in the staging area or active, guards her. She stays in play with her damage, can be damaged, is an ally in play for the cards that count allies, and rejoins the first
// player's play area (the ControlledBy line of her own) once the Gate has left play.

const ARWEN = definePrinted({ code: "04041", name: "Arwen Undómiel", type: "ally", sphere: "neutral", cost: 0, willpower: 2, attack: 2, defense: 2, health: 3, traits: ["Noldor", "Noble", "Ally"] });
const GATE = definePrinted({ code: "04043", name: "Goblin Gate", type: "location", threat: 5, questPoints: 8 });
const SOURCE = treachery("source");
const ARWEN_RECORDS = RIVENDELL.filter((effect) => effect.cardCode === "04041");
const GATE_PICK: PickSpec = { type: "location", control: "any", names: ["Goblin Gate"] };

const find = (state: ScenarioState, code: string) => Object.values(state.cards).find((card) => card.code === code)!;

function guarded(instructions: Instruction[], active: boolean) {
  const record: Effect = { id: "source:whenRevealed:1", cardCode: "source", lines: ["source:A:1"], timing: "whenRevealed", instructions };
  const built = table({ cards: [hero("a"), SOURCE, ARWEN, GATE, enemy("brute")], effects: [record, ...ARWEN_RECORDS], heroes: [{ code: "a" }], allies: [{ code: "04041" }], hand: [{ code: "source" }], staging: [{ code: "04043" }] });
  let state: ScenarioState = built.state;
  if (active) state = makeActiveIn(state, find(state, "04043").id);
  const steps: EngineStep[] = [];
  const source = find(state, "source");
  const pushed = pushCardEffects({ ...state, phase: "Quest", window: null }, "whenRevealed", source.id, 0, false, [record], built.ctx, steps);
  return { state: settle(pushed, built.ctx, steps), ctx: built.ctx, steps };
}

const GUARD: Instruction[] = [{ verb: "Pick", pick: GATE_PICK }, { verb: "GuardReturnedBy", code: "04041", returns: "firstPlayer", when: { kind: "canPick", pick: GATE_PICK } }];

describe("GuardReturnedBy for an ally (901402:B:1)", () => {
  for (const active of [false, true]) {
    it(`901402:B:1 Goblin Gate ${active ? "as the active location" : "in the staging area"} guards Arwen: nobody controls her, she stays in play with her damage`, () => {
      const hurt = guarded([{ verb: "Pick", pick: { type: "card", control: "any", names: ["Arwen Undómiel"] } }, { verb: "DamageCard", amount: 1, target: "picked" }, ...GUARD], active).state;
      const arwen = find(hurt, "04041");
      expect(arwen.zone).toBe("staging");
      expect(arwen.controller).toBeNull();
      expect(arwen.damage).toBe(1);
      expect(find(hurt, "04043").host).toBe(arwen.id);
      expect(find(hurt, "04043").zone).toBe(active ? "activeLocation" : "staging");
      expect(flagged(hurt, arwen.id, "guardedAlly")).toBe(true);
      // The first player's ControlledBy line does not give her back while the Gate guards her.
      expect(hurt.seats[0].play).not.toContain(arwen.id);
    });
  }

  it("901402:B:1 she is an ally in play that a player cannot control: a pick of any player's allies sees her, one of the player's own does not", () => {
    const { state } = guarded([...GUARD, { verb: "DamageEach", amount: 1, pick: { type: "ally", control: "any" } }, { verb: "DamageEach", amount: 1, pick: { type: "ally", control: "you" } }], false);
    expect(find(state, "04041").damage).toBe(1);
  });

  it("901402:B:1 with no Goblin Gate in play nothing happens and the first player keeps her", () => {
    const record: Effect = { id: "source:whenRevealed:1", cardCode: "source", lines: ["source:A:1"], timing: "whenRevealed", instructions: GUARD };
    const built = table({ cards: [hero("a"), SOURCE, ARWEN, GATE], effects: [record, ...ARWEN_RECORDS], heroes: [{ code: "a" }], allies: [{ code: "04041" }], hand: [{ code: "source" }] });
    const steps: EngineStep[] = [];
    const done = settle(pushCardEffects({ ...built.state, phase: "Quest", window: null }, "whenRevealed", find(built.state, "source").id, 0, false, [record], built.ctx, steps), built.ctx, steps);
    expect(find(done, "04041").zone).toBe("play");
    expect(find(done, "04041").controller).toBe(0);
  });

  for (const active of [false, true]) {
    it(`04041:A:1 once Goblin Gate leaves play${active ? " from the active location" : ""} she rejoins the first player's play area with her damage`, () => {
      const { state, ctx, steps } = guarded([{ verb: "Pick", pick: { type: "card", control: "any", names: ["Arwen Undómiel"] } }, { verb: "DamageCard", amount: 2, target: "picked" }, ...GUARD], active);
      const gate = find(state, "04043");
      const left = settle(moveEncounter(state, gate.id, "discard", 0, ctx, steps), ctx, steps);
      const arwen = find(left, "04041");
      expect(arwen.zone).toBe("play");
      expect(arwen.controller).toBe(0);
      expect(arwen.damage).toBe(2);
      expect(left.seats[0].play).toContain(arwen.id);
      expect(flagged(left, arwen.id, "guardedAlly")).toBe(false);
      expect(left.lost).toBeFalsy();
    });
  }

  it("04041:A:3 the game is lost when Arwen is destroyed while the Gate guards her", () => {
    const { state } = guarded([...GUARD, { verb: "Pick", pick: { type: "card", control: "any", names: ["Arwen Undómiel"] } }, { verb: "DamageCard", amount: 3, target: "picked" }], false);
    expect(state.lost).toBe(true);
  });
});
