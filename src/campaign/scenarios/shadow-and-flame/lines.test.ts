// Rules: dwd.durins-bane, dwd.regenerate, rr.attachment-cards, rr.forced, rr.shadow-effects, rr.combat-phase, rr.travel, rr.cancel, rr.hit-points, faq.additional-attacks (data/rules/entries.json); ledger lines 04138:A:1, 04139:B:1, 04139:B:2, 04140:B:1, 04140:B:2, 04141:A:1, 04148:A:1, 04148:A:2, 04149:A:1, 04150:A:2,
// 04152:A:1, 04153:A:1, 901801:A:4, 901802:A:1, 901805:A:1, 901807:A:2, 901809:A:2, 901810:A:1.
// Shadow and Flame's records that need more than one row or a state a row cannot name: the Setup, the real combat phase with Durin's Bane (the seats it attacks, a seat raised during combat, the shadow card it is dealt), Dark Pit's Action and its
// rows of one record that cannot fail without it, Terrible Strength on an undefended hero, the Balrog reshuffle at the beginning of combat, Fiery Depths through a real Travel phase, and what Fiery Sword and Many Thonged Whip count as.
import { describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../../../catalog/boundary.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { countsAsAttachment, hasTrait } from "../../../rules/interpret/conditions.ts";
import { pickCandidates } from "../../../rules/interpret/pick.ts";
import { play } from "../../../../test/harness/card-spec-play.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { legalIntents, legalTargets, reduce, startScenario } from "../../../rules/engine/reduce.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../rules/engine/reduce.ts";
import { playCost } from "../../../rules/player/attach.ts";
import { answer, count, reveal, resolve, rowProblems, zone, type Row } from "../../../../test/harness/card-spec.ts";
import { finish, first, idOf, send, start, tableFromLayout } from "../../../../test/harness/scene-kit.ts";
import type { Layout } from "../../../../test/harness/scene-kit.ts";
import { flameStart, flameWorld } from "../../../../test/scenarios/shadow-and-flame/game.ts";

const SCENARIO = "shadow-and-flame";
const played = (layout: Layout, act: Row["act"]) => play(SCENARIO, { line: "", layout, act, expect: [] } satisfies Row, EFFECTS as readonly Effect[], false);
const recordOf = (id: string): Effect => EFFECTS.find((effect) => effect.id === id) as Effect;
// The pick a record's instruction makes (the one inside a ForEachPlayer or the verb's own).
const pickOf = (id: string) => {
  const found = (list: readonly Instruction[]): Instruction | undefined => list.map((one) => (one.verb === "ForEachPlayer" ? found(one.instructions) : "pick" in one ? one : undefined)).find((one) => one !== undefined);
  const instruction = found(recordOf(id).instructions);
  if (!instruction || !("pick" in instruction) || !instruction.pick) throw new Error(`${id} has no pick`);
  return instruction.pick;
};

describe("Shadow and Flame attachments", () => {
  const done = played({ staging: ["04150"], attached: [{ code: "attachment", to: "dh1" }] }, [reveal("04145")]);
  const mine = idOf(done.run.state, "attachment");
  const counterSpell = idOf(done.run.state, "04145");

  it("04148:A:1 offers only the attachments the player controls, not Counter-Spell lying on Durin's Bane", () => {
    expect(done.run.state.cards[counterSpell]?.controller).toBeNull();
    expect(pickCandidates(done.run.state, pickOf("04148:whenRevealed:1"), 0, [], null, done.table.ctx)).toEqual([mine]);
  });

  it("04148:A:2 discards only the attachments the player controls, not Counter-Spell lying on Durin's Bane", () => {
    expect(pickCandidates(done.run.state, pickOf("04148:shadow:1"), 0, [], null, done.table.ctx)).toEqual([mine]);
  });

  it("04152:A:1 Fiery Sword counts as a Weapon attachment, 04153:A:1 so does Many Thonged Whip", () => {
    for (const code of ["04152", "04153"]) {
      const sworn = played({ staging: ["04150"] }, [reveal(code)]);
      const id = idOf(sworn.run.state, code);
      expect(sworn.run.state.cards[id]?.host, code).toBe(idOf(sworn.run.state, "04150"));
      expect(countsAsAttachment(sworn.run.state, id, sworn.table.ctx), code).toBe(true);
      expect(hasTrait(sworn.run.state, id, "Weapon", sworn.table.ctx), code).toBe(true);
    }
  });
});

const reduceOk = (state: ScenarioState, intent: PlayerIntent, ctx: ReduceContext) => {
  const result = reduce(state, intent, ctx);
  if (!result.ok) throw new Error(result.reason);
  return result;
};

// A spec row run as a test: the cases a row cannot hold because they pass without the records (nothing happens in them).
const holds = (row: Row) => expect(rowProblems(SCENARIO, row, EFFECTS as readonly Effect[])).toEqual([]);

describe("Setup and the quest stages", () => {
  it("04138:A:1 puts Durin's Bane into the staging area and Dark Pit aside at Setup on every difficulty, the quest on Nearing the Gate and the other two stages in the quest deck", async () => {
    const { ctx } = await flameWorld("strong");
    for (const difficulty of ["Normal", "Easy", "Nightmare"] as const) {
      const state = reduceOk(startScenario(flameStart(1, 1, difficulty), ctx), { type: "Keep" }, ctx).state;
      const where = (code: string) => Object.values(state.cards).filter((card) => card.code === code).map((card) => card.zone);
      expect(where("04150"), difficulty).toEqual(["staging"]);
      expect(where("04141"), difficulty).toEqual(["setAside"]);
      expect(state.cards[state.questStage ?? ""]?.code, difficulty).toBe("04138");
      expect(state.questDeck.map((id) => state.cards[id]?.code), difficulty).toEqual(["04139", "04140"]);
      expect(state.encounterDeck.some((id) => ["04150", "04141"].includes(state.cards[id]?.code ?? "")), difficulty).toBe(false);
    }
  });

  it("04139:B:2 advances the stage at once when Durin's Bane has no hit points left (27 damage or more) and not with a hit point left", () => {
    for (const [damage, stage] of [[27, "04140"], [31, "04140"], [26, "04139"]] as const) {
      const made = tableFromLayout(SCENARIO, { stage: "04139", staging: [{ code: "04150", damage }] });
      const settled = settle({ ...made.state, round: 1, window: null, mode: "stopped" }, made.ctx, []);
      expect(settled.cards[settled.questStage ?? ""]?.code, `${damage} damage`).toBe(stage);
    }
  });

  it("04140:B:2 the players cannot win while Durin's Bane is in play: the last stage filled does not end the game", () => {
    holds({ line: "04140:B:2", layout: { stage: "04140", heroResources: 0, staging: ["04150"] }, act: { act: "quest", outcome: "success" }, expect: [{ expect: "notWon" }, zone("04140", "questStage")] });
  });
});

describe("04141:A:1 Dark Pit's Refresh Action", () => {
  const PIT: Layout = { stage: "04140", active: "04141", staging: [{ code: "04150", damage: 27 }], deckOf: ["c3", "c3", "c3"] };
  const ACTION = (intent: { type: string; effectId?: string }) => intent.type === "Trigger" && intent.effectId === "04141:action:1";
  // The table is played on from the encounter phase (nobody is attacked at threat 0) until Dark Pit's Action is offered or the round is over: the run when it is, else null.
  const untilOffered = (layout: Layout) => {
    const made = tableFromLayout(SCENARIO, { phase: "Encounter", threat: [0, 0], ...layout });
    let run = start(made.state);
    for (let guard = 0; guard < 60 && run.state.round === made.state.round && !run.state.lost; guard += 1) {
      const intents = legalIntents(run.state, made.ctx);
      if (intents.some(ACTION)) return { run, made };
      const next = intents.find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack" || intent.type === "DeclineEngage" || intent.type === "DeclineTravel");
      if (!next) break;
      run = send(run, next as PlayerIntent, made.ctx);
    }
    return null;
  };
  const offered = (layout: Layout) => {
    const found = untilOffered(layout);
    return found != null && found.run.state.phase === "End of round";
  };

  it("04141:A:1 is offered in the Refresh phase while Dark Pit is the active location, and in no other phase or without it", () => {
    expect(offered(PIT)).toBe(true);
    // Offered once the round's Refresh phase has run (its heal of Regenerate included), and in no earlier phase.
    expect(untilOffered(PIT)?.run.state.phase).toBe("End of round");
    expect(offered({ ...PIT, active: "04142" })).toBe(false);
  });

  it("04141:A:1 with X = 0 exhausts and discards nothing and cannot discard Durin's Bane", () => {
    holds({ line: "04141:A:1", layout: { ...PIT, phase: "Refresh" }, act: [resolve("04141", "action"), answer("done")], expect: [zone("04150", "staging"), count("c3", "deck", 3), { expect: "exhausted", code: "dh1", value: false }, { expect: "exhausted", code: "dh2", value: false }] });
  });

  it("04141:A:1 asks for each character one at a time and ends the choice with done", () => {
    const found = untilOffered({ ...PIT, seats: 2, deckOf: [{ code: "c3", seat: 0 }, { code: "c3", seat: 0 }, { code: "c3", seat: 1 }, { code: "c3", seat: 1 }] });
    if (!found) throw new Error("the Action was not offered");
    const intent = legalIntents(found.run.state, found.made.ctx).find(ACTION) as PlayerIntent;
    const run = send(found.run, intent, found.made.ctx);
    expect(run.state.window?.kind).toBe("choose");
    expect(run.state.window?.kind === "choose" ? run.state.window.options.at(-1) : "").toBe("done");
  });
});

describe("901809:A:2 Fiery Depths' travel cost", () => {
  const targets = (damage: number, seats: 1 | 2) => {
    const made = tableFromLayout(SCENARIO, { seats, phase: "Travel", staging: ["901809", { code: "04150", damage }] });
    return legalTargets(made.state, { type: "Travel" }, made.ctx).map((id) => made.state.cards[id]?.code);
  };

  it("901809:A:2 can be travelled to only when Durin's Bane holds a damage for each player", () => {
    expect(targets(0, 1)).not.toContain("901809");
    expect(targets(1, 1)).toContain("901809");
    expect(targets(1, 2)).not.toContain("901809");
    expect(targets(2, 2)).toContain("901809");
  });
});

describe("901810:A:1 Crumbling Stairs", () => {
  it("901810:A:1 makes an event card cost 1 more to play from the hand while it is in the staging area, and not once it has left", () => {
    const cost = (layout: Layout) => {
      const made = tableFromLayout(SCENARIO, { hand: ["c1"], phase: "Planning", ...layout });
      return playCost(made.state, first(made.state, "c1"), 0, made.ctx) ?? 0;
    };
    expect(cost({ staging: ["901810"] }) - cost({})).toBe(1);
    expect(cost({ engaged: ["901810"] })).toBe(cost({}));
  });
});

describe("04145:A:1 Counter-Spell", () => {
  // The event player plays a filler event that draws a card, with Counter-Spell on Durin's Bane and `deck` the encounter deck, its top card the one Counter-Spell discards.
  const playEvent = (deck: readonly string[], draws: boolean) => {
    const made = tableFromLayout(SCENARIO, { phase: "Planning", staging: ["04150"], attached: [{ code: "04145", to: "04150" }], deck, hand: ["filler", "f0"], deckOf: ["f0", "f0"] });
    const filler = idOf(made.state, "filler");
    const draw: Effect = { id: "filler:action:1", cardCode: "filler", lines: ["filler:A:1"], timing: "action", instructions: [{ verb: "Draw", amount: 1 }] };
    const ctx = draws ? { ...made.ctx, effects: [...made.ctx.effects.filter((effect) => effect.cardCode !== "filler"), draw] } : made.ctx;
    const state = syncConstants(made.state, ctx);
    let run = send(start(state), { type: "PlayCard", cardId: filler, payments: [] }, ctx);
    for (let guard = 0; guard < 8 && run.state.window?.kind !== "frameAction" && run.state.stack.length > 0; guard += 1) run = finish(run, ctx);
    return { run, filler, spell: idOf(state, "04145") };
  };

  it("04145:A:1 discards the top card of the encounter deck when an event is played, and a treachery cancels the event's effects, discards the event player's hand and Counter-Spell", () => {
    const { run, filler, spell } = playEvent(["treachery", "f0"], true);
    expect(run.state.cards[filler]?.zone).toBe("discard");
    expect(run.state.seats[0]?.hand).toEqual([]);
    expect(run.state.seats[0]?.deck).toHaveLength(2);
    expect(run.state.cards[spell]?.zone).toBe("encounterDiscard");
  });

  it("04145:A:1 leaves the event and Counter-Spell alone when the discarded card is not a treachery", () => {
    const { run, filler, spell } = playEvent(["f0", "f0"], false);
    expect(run.state.seats[0]?.hand).toHaveLength(1);
    expect(run.state.cards[filler]?.zone).toBe("discard");
    expect(run.state.cards[spell]?.zone).not.toBe("encounterDiscard");
  });
});
