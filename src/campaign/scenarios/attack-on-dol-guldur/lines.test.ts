// Rules: rr.response, rr.forced, rr.travel, rr.cancel, rr.setup, rr.lasting-effects, faq.lasting-effects, rr.in-play-and-out-of-play (data/rules/entries.json); docs/brief.md (Attack on Dol Guldur).
// The lines a card-spec row cannot express (spec.test.ts holds the rest): the Setup the deal and the mode card leave, the Response at the end of the round, the lines that must not work in the other zone or stage, the bars that reach one location only and the lasting numbers.
import { describe, expect, it } from "vitest";

import { legalIntents, legalTargets, reduce, startScenario } from "../../../rules/engine/reduce.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../rules/engine/reduce.ts";
import type { GameEvent } from "../../../rules/core/state.ts";
import { heldAmount } from "../../../rules/core/state.ts";
import { spawn } from "../../../rules/core/zones.ts";
import { fireForced } from "../../../rules/windows/triggers.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { first, opening, revealFromTop, send, start, tableFromLayout, type Layout, type Run } from "../../../../test/harness/scene-kit.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { guldurStart, guldurWorld } from "../../../../test/scenarios/attack-on-dol-guldur/game.ts";

const table = (layout: Layout) => tableFromLayout("attack-on-dol-guldur", layout);
const PLACES = ["place", "place", "place", "place", "place", "place"];
const DG = (resources: number) => ({ code: "50907", resources });
const PASSES = ["Pass", "DeclineAttack", "DeclineEngage", "DeclineTravel"];

function passUntil(made: ReturnType<typeof table>, stop: (state: ScenarioState, ctx: ReduceContext) => boolean): Run {
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
const codes = (state: ScenarioState, ids: readonly string[]) => ids.map((id) => state.cards[id]?.code);

// The game after its Setup and the first player's Keep (the opening the goldens check too), with no intent played.
const opened = async (seats: 1 | 2, seed: number): Promise<ScenarioState> => {
  const { ctx } = await guldurWorld("strong");
  return expectOk(reduce(startScenario(guldurStart(seats, seed, "Normal"), ctx), { type: "Keep" }, ctx)).state;
};
const fire = (state: ScenarioState, ctx: ReduceContext, event: GameEvent): ScenarioState => settle(fireForced({ ...state, window: null }, event, ctx, []), ctx, []);

describe("the Setup of the deal", () => {
  for (const seats of [1] as const) {
    it(`50901:A:1 stages Dol Guldur, Power of Lórien and a Marauder for each player (${seats}), sets the Host of Lórien and the Lieutenants aside and shuffles the rest; 50931:A:1 puts 5 plus 5 for each player on Dol Guldur`, async () => {
      const state = await opened(seats, 1);
      expect(codes(state, state.staging).sort()).toEqual(["50907", "50908", ...Array.from({ length: seats }, () => "50918")].sort());
      expect(codes(state, state.setAside)).toEqual(expect.arrayContaining(["50909", "50910", "50911", "50912", "50913"]));
      expect(state.cards[first(state, "50907")]?.resources).toBe(5 + 5 * seats);
      expect(state.encounterDeck).toHaveLength(36 + 4 - seats);
    });
  }
  it("50901:A:1 shuffles the encounter deck with the seed", async () => {
    const order = async (seed: number) => codes(await opened(1, seed), (await opened(1, seed)).encounterDeck).join(",");
    expect(await order(1)).not.toBe(await order(2));
  });
});

describe("the Response at the end of the round", () => {
  it("50901:B:2 is offered at the end of the round: each player raises his threat by 1, draws a card and puts a resource on a hero", () => {
    const made = table({ stage: "50901", staging: [DG(10), { code: "50908", progress: 0 }], deck: PLACES, threat: [0, 0], deckOf: ["filler", "filler"] });
    const run = passUntil(made, offered("50901"));
    const trigger = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Trigger" && run.state.cards[intent.cardId]?.code === "50901");
    expect(trigger).toBeDefined();
    const done = send(run, { ...(trigger as Extract<PlayerIntent, { type: "Trigger" }>), payments: [] }, made.ctx);
    expect(done.state.seats[0]?.threat).toBe((run.state.seats[0]?.threat ?? 0) + 1);
    expect(codes(done.state, done.state.seats[0]?.hand ?? [])).toHaveLength(1);
  });
});

describe("a line that works only where its card is", () => {
  it("50908:A:1 is not offered while Power of Lórien is in the staging area: no player controls it", () => {
    const made = table({ stage: "50903", staging: [DG(10), { code: "50908", progress: 0 }], deck: ["treachery", "f0", "f0"] });
    const revealed = revealFromTop(made.state, made.ctx, "50926", []);
    expect(offered("50908")(revealed.state, made.ctx)).toBe(false);
  });

  it("50908:A:1 is offered to the player who controls it only: the other player has no Trigger for it", () => {
    const made = table({ stage: "50903", seats: 2, play: [{ code: "50908", seat: 1 }], staging: [DG(10)], deck: ["treachery", "f0", "f0"] });
    const revealed = revealFromTop(made.state, made.ctx, "50926", []);
    const seat = revealed.state.activeSeat;
    const triggers = legalIntents(revealed.state, made.ctx).filter((intent) => intent.type === "Trigger" && revealed.state.cards[intent.cardId]?.code === "50908");
    expect(seat === 1 ? triggers.length : 0).toBe(triggers.length);
  });

  it("50907:A:1 takes the tally off the city strength at stage 3 only: at stage 2 the strength stays", () => {
    const made = table({ stage: "50902", staging: [DG(10), "50914"], deck: PLACES, threat: [0, 0] });
    const destroyed = fire(made.state, made.ctx, { trigger: "enemyDestroyed", seat: 0, cardId: first(made.state, "50914") });
    const ended = fire(destroyed, made.ctx, { trigger: "endOfRound", seat: null, phase: "End of round" });
    expect(ended.cards[first(ended, "50907")]?.resources).toBe(10);
  });

  it("50925:A:1 raises no threat when the encounter deck is empty: nothing was discarded", () => {
    const made = table({ stage: "50902", staging: ["50925"], deck: [], discard: ["f3"] });
    const settled = settle(fireForced({ ...made.state, window: null }, { trigger: "locationExplored", seat: 0, cardId: first(made.state, "50925") }, made.ctx, []), made.ctx, []);
    expect(settled.seats[0]?.threat).toBe(made.state.seats[0]?.threat);
  });

  it("50922:A:2 attaches an event played in the quest phase facedown to The Shadow Road in the staging area, and only there", () => {
    for (const [zone, attached] of [["staging", true], ["engaged", false]] as const) {
      const made = table({ phase: "Quest", stage: "50902", ...(zone === "staging" ? { staging: ["50922"] } : { engaged: ["50922"] }) });
      const played = spawn(made.state, "event", { zone: "discard", seat: 0 });
      const settled = settle(fireForced({ ...played.state, window: null }, { trigger: "played", seat: 0, cardId: played.id }, made.ctx, []), made.ctx, []);
      expect(settled.cards[played.id]?.zone === "under" || settled.cards[played.id]?.host != null, zone).toBe(attached);
    }
  });
});

describe("the bars of the locations reach that location only", () => {
  const travelTo = (stage: string, code: string, extra: string[] = []) => {
    const made = table({ phase: "Travel", stage, staging: [code, "place", ...extra] });
    return { made };
  };
  const GATES = [["50920", "50903"], ["50921", "50904"], ["50922", "50905"], ["50923", "50906"]] as const;
  for (const [code, stage] of GATES) {
    it(`${code}:A:${code === "50922" ? 2 : 1} bars travel to ${code} only, and only while stage ${stage} is not in play`, () => {
      const barred = travelTo("50902", code);
      const ids = barred.made.state.staging;
      const place = ids.find((id) => barred.made.state.cards[id]?.code === "place") ?? "";
      const gate = ids.find((id) => barred.made.state.cards[id]?.code === code) ?? "";
      const targets = (state: ScenarioState, ctx: ReduceContext) => legalTargets(state, { type: "Travel" }, ctx);
      expect(targets(barred.made.state, barred.made.ctx)).toContain(place);
      expect(targets(barred.made.state, barred.made.ctx)).not.toContain(gate);
      const open = table({ phase: "Travel", stage, staging: [code, "place"] });
      const openGate = open.state.staging.find((id) => open.state.cards[id]?.code === code) ?? "";
      expect(targets(open.state, open.ctx)).toContain(openGate);
    });
  }

  it("50920:A:1 caps the threat players lower by player card effects at 1 each round while Gate of Dol Guldur is in the staging area", () => {
    expect(heldAmount(table({ stage: "50902", staging: ["50920"] }).state, "seat:0", "playerThreatReductionCap")).toBe(1);
    expect(heldAmount(table({ stage: "50902", engaged: ["50920"] }).state, "seat:0", "playerThreatReductionCap")).toBe(0);
  });

  it("50923:A:1 caps the damage healed from each character at 1 each round while Dungeon Door is in the staging area", () => {
    expect(heldAmount(table({ stage: "50902", staging: ["50923"] }).state, "table", "healCap")).toBe(1);
    expect(heldAmount(table({ stage: "50902", engaged: ["50923"] }).state, "table", "healCap")).toBe(0);
  });
});
