// Rules: rr.response, rr.forced, rr.immune, rr.lasting-effects, rr.in-play-and-out-of-play, rr.victory (data/rules/entries.json); docs/scenarios/standalone-scenarios/the-siege-of-annuminas.md (The Siege of Annúminas).
// The lines a card-spec row cannot express (spec.test.ts holds the rest): the Responses at the end of the round, the Response no Standard game can offer, the Epic card Enemy Camp, a table-wide effect, and the immunity of a card whose keywords are printed in a line with X.
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import { legalIntents } from "../../../rules/engine/legal.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../rules/engine/reduce.ts";
import type { Effect } from "../../../catalog/boundary.ts";
import { playerCardEffectCanChoose } from "../../../rules/core/keywords.ts";
import { whenRevealedUncancelable } from "../../../rules/families/wilderland/heath.ts";
import { first, legalTargets, opening, send, start, tableFromLayout, type Layout, type Run } from "../../../../test/harness/scene-kit.ts";

const table = (layout: Layout) => tableFromLayout("the-siege-of-annuminas", layout);
const PLACES = ["place", "place", "place", "place", "place", "place"];
const CITY = (resources: number) => ({ code: "50812", resources });
const PASSES = ["Pass", "DeclineAttack", "DeclineEngage", "DeclineTravel"];

// Passes every window from the layout's table until `stop` says so, or the next round begins (so the end of this round is reached); the run it stops at.
function passUntil(made: ReturnType<typeof table>, stop: (state: ScenarioState, ctx: ReduceContext) => boolean): Run {
  // A layout leaves the round between windows: the round begins in the Planning phase.
  let run = start({ ...made.state, ...opening("Planning") });
  const round = made.state.round;
  for (let guard = 0; guard < 80 && !stop(run.state, made.ctx) && run.state.round === round; guard += 1) {
    const pass = legalIntents(run.state, made.ctx).find((intent) => PASSES.includes(intent.type));
    if (!pass) break;
    run = send(run, pass as PlayerIntent, made.ctx);
  }
  return run;
}
const offered = (code: string) => (state: ScenarioState, ctx: ReduceContext) => legalIntents(state, ctx).some((intent) => intent.type === "Trigger" && state.cards[intent.cardId]?.code === code);

describe("the Responses at the end of the round", () => {
  it("50803:B:2 is offered with 10 progress on the stage: it removes them and raises the city strength by 10", () => {
    const made = table({ stage: "50803", progress: 10, staging: [CITY(20)], deck: PLACES, threat: [0, 0] });
    const run = passUntil(made, offered("50803"));
    const trigger = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Trigger" && run.state.cards[intent.cardId]?.code === "50803");
    expect(trigger).toBeDefined();
    const done = send(run, { ...(trigger as Extract<PlayerIntent, { type: "Trigger" }>), payments: [] }, made.ctx);
    expect(done.state.cards[first(done.state, "50803")]?.progress).toBe(0);
    expect(done.state.cards[first(done.state, "50812")]?.resources).toBe(30);
  });

  it("50803:B:2 is not offered with 9", () => {
    const made = table({ stage: "50803", progress: 9, staging: [CITY(20)], deck: PLACES, threat: [0, 0] });
    expect(offered("50803")(passUntil(made, offered("50803")).state, made.ctx)).toBe(false);
  });

  it("50804:B:3 is offered when a character is damaged: each player heals 1 damage from a character he controls", () => {
    const made = table({ stage: "50804", staging: [CITY(20)], deck: PLACES, threat: [0, 0], play: [{ code: "ally", damage: 1 }] });
    const run = passUntil(made, offered("50804"));
    const trigger = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Trigger" && run.state.cards[intent.cardId]?.code === "50804");
    expect(trigger).toBeDefined();
    const done = send(run, { ...(trigger as Extract<PlayerIntent, { type: "Trigger" }>), payments: [] }, made.ctx);
    expect(done.state.cards[first(done.state, "ally")]?.damage).toBe(0);
  });

  it("50804:B:3 is not offered when no character is damaged", () => {
    const made = table({ stage: "50804", staging: [CITY(20)], deck: PLACES, threat: [0, 0], play: ["ally"] });
    expect(offered("50804")(passUntil(made, offered("50804")).state, made.ctx)).toBe(false);
  });

  it("50805:B:2 is never offered in a Standard game (one stage, so no enemy at another stage), whatever the staging area holds", () => {
    const made = table({ stage: "50805", staging: [CITY(20), "f3", "f0"], engaged: ["f3"], deck: PLACES, threat: [0, 0] });
    expect(offered("50805")(passUntil(made, offered("50805")).state, made.ctx)).toBe(false);
  });
});

describe("50820:A:3 City Wall's Travel cost", () => {
  // Researched (rr.travel, rr.running-out-of-cards; Caleb Grace, ALeP 3.243 and 3.358, docs/scenarios/standalone-scenarios.md): "Reveal the top card of the encounter deck to travel here" is a cost; with an empty deck outside the quest phase it cannot be paid, and the deck is not reset for it.
  const travelOffered = (layout: Layout): boolean => {
    const made = table({ stage: "50805", phase: "Travel", staging: ["50820"], ...layout });
    return legalTargets(made.state, { type: "Travel" }, made.ctx).includes(first(made.state, "50820"));
  };

  it("50820:A:3 the players cannot travel there with an empty encounter deck, whatever the discard pile holds", () => {
    expect(travelOffered({ deck: [], discard: ["place", "f0"] })).toBe(false);
    expect(travelOffered({ deck: [] })).toBe(false);
  });

  it("50820:A:3 they can with a card in the deck", () => {
    expect(travelOffered({ deck: ["place"] })).toBe(true);
  });
});

describe("table-wide effects and keywords in a line with X", () => {
  // "While Hills of Evendim is in the staging area, 'when revealed' effects cannot be canceled": a cancel of the When Revealed effects (A Test of Will) or of the reveal itself (The Master Ring), asked about a card just revealed.
  it("50822:A:1 bars the cancel of 'when revealed' effects only while Hills of Evendim is in the staging area", () => {
    const cancels = (trigger: "whenRevealedPending" | "encounterRevealed"): Effect => ({ id: "x:response:1", cardCode: "x", lines: ["x:A:1"], timing: "response", trigger, instructions: [{ verb: "CancelEffect" }] });
    const barred = (layout: Layout, trigger: "whenRevealedPending" | "encounterRevealed"): boolean => {
      const effect = cancels(trigger);
      const made = table({ ...layout, staging: [...(layout.staging ?? []), "f0"] });
      return whenRevealedUncancelable(made.state, { trigger, seat: 0, subject: first(made.state, "f0") }, effect, { ...made.ctx, effects: [...made.ctx.effects, effect] });
    };
    for (const trigger of ["whenRevealedPending", "encounterRevealed"] as const) {
      expect(barred({ stage: "50805", staging: ["50822"] }, trigger)).toBe(true);
      expect(barred({ stage: "50805", engaged: ["50822"] }, trigger)).toBe(false);
      expect(barred({ stage: "50805" }, trigger)).toBe(false);
    }
  });

  it("50828:A:2 caps the progress placed on the main quest at 5 each round while Vanguard of Carn Dûm is in the staging area", () => {
    const cap = (layout: Layout) => table(layout).state.modifiers.filter((modifier) => modifier.stat === "questProgressCap").map((modifier) => modifier.amount);
    expect(cap({ stage: "50805", staging: ["50828"] })).toEqual([5]);
    expect(cap({ stage: "50805", engaged: ["50828"] })).toEqual([]);
  });

  it("50814:A:1 makes Battering Ram immune to player card effects (its keyword is on the line with X, not in the source's keywords)", () => {
    const made = table({ stage: "50805", staging: ["50814", "50824"] });
    const canChoose = (code: string) => playerCardEffectCanChoose(made.cards.get(code)!, made.state, first(made.state, code), made.cards.get("event"));
    expect(canChoose("50814")).toBe(false);
    expect(canChoose("50824")).toBe(true);
  });
});

describe("Enemy Camp (an Epic card: no Standard game brings it into play)", () => {
  it("50815:A:2 has a Forced at the end of the round that discards a held hero while it is in play and returns them while it is in the victory display", () => {
    const record = EFFECTS.find((effect) => effect.lines.includes("50815:A:2"));
    expect(record?.timing).toBe("forced");
    expect(record?.instructions.map((instruction) => ({ verb: instruction.verb, when: (instruction as { when?: unknown }).when }))).toEqual([
      { verb: "DiscardHeldHero", when: { kind: "inPlay", code: "50815", is: true } },
      { verb: "ReturnHeldHeroes", when: { kind: "inVictory", code: "50815", is: true } },
    ]);
  });
});
