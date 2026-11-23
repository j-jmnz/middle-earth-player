// Rules: rr.forced, rr.keywords, rr.cancel, rr.winning-the-game, rr.active-location, rr.blank (data/rules/entries.json); docs/scenarios/standalone-scenarios/the-stone-of-erech.md (The Stone of Erech); ledger lines 50303:B:3, 50304:A:1, 50322:A:2, 50323:A:3.
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import { settle } from "../../../rules/engine/machine.ts";
import type { ReduceContext, ScenarioState } from "../../../rules/engine/reduce.ts";
import { nightCard } from "../../../rules/families/erech/night.ts";
import { readyBarred } from "../../../rules/core/holder-classes.ts";
import { fireForced } from "../../../rules/windows/triggers.ts";

import { quest, resolve, rowProblems, notWon, won, progressOn, zone, type Row } from "../../../../test/harness/card-spec.ts";
import type { Effect } from "../../../catalog/boundary.ts";
import { definePrinted } from "../../../rules/core/printed.ts";
import { attachTo, spawn } from "../../../rules/core/zones.ts";
import { attackStrength } from "../../../rules/combat/combat.ts";
import { play } from "../../../../test/harness/card-spec-play.ts";
import { finish, idOf, legalIntents, revealFromTop, send, start, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

// What a spec row cannot express: a journey over several moments (Night progression, Derufin), a rule that is an absence (no progress on the stage), Spectral in an attack, and a cancel that is not offered. Each test starts its title with the line id it covers.
const ID = "the-stone-of-erech";
const noProblems = (row: Row): void => expect(rowProblems(ID, row, EFFECTS)).toEqual([]);
const table = (layout: Layout) => tableFromLayout(ID, layout);

describe("50303:B:3 stage 3B", () => {
  it("50303:B:3 defeating the stage wins the game once the players control Derufin", () => {
    noProblems({ line: "50303:B:3", layout: { stage: "50303", progress: 13, play: ["50304"] }, act: quest("success"), expect: [won] });
  });

  it("50303:B:2 with no player controlling Derufin the quest places no progress on the stage, and the game is not won", () => {
    noProblems({ line: "50303:B:2", layout: { stage: "50303", progress: 13 }, act: quest("success"), expect: [notWon, progressOn("50303", 13)] });
  });

  it("50303:B:1 at Eventide and at Dusk the stage is quested with Willpower, no Battle", () => {
    for (const night of ["50308", "50309"]) noProblems({ line: "50303:B:1", layout: { stage: "50303", night }, act: [], expect: [{ expect: "flag", code: "50303", name: "battle", value: false }] });
  });
});

describe("50304:A:1 Derufin's journey", () => {
  // The stage reveals the Stone with Derufin attached; the players then travel to it, and the Forced effect of Derufin hears the Stone.
  const opened = (staging: readonly string[] = []) => {
    const done = play(ID, { line: "50304:A:1", layout: { stage: "50302", setAside: ["50306", "50304"], staging }, act: resolve("50302", "whenRevealed"), expect: [] }, EFFECTS, false);
    return { state: done.run.state, ctx: done.table.ctx };
  };
  const traveled = (state: ScenarioState, ctx: ReduceContext, code: string): ScenarioState => settle(fireForced({ ...state, window: null }, { trigger: "traveled", seat: null, cardId: idOf(state, code) }, ctx, []), ctx, []);

  it("50304:A:1 is attached to the Stone and controlled by nobody until the players travel to it, then the first player controls him, ready", () => {
    const { state, ctx } = opened();
    const derufin = idOf(state, "50304");
    expect(state.cards[derufin]?.zone).toBe("attached");
    expect(state.cards[derufin]?.controller).toBeNull();
    const tired = { ...state, cards: { ...state.cards, [derufin]: { ...state.cards[derufin]!, exhausted: true } } };
    const there = traveled(tired, ctx, "50306");
    expect(there.cards[derufin]?.zone).toBe("play");
    expect(there.cards[derufin]?.controller).toBe(there.firstPlayer);
    expect(there.cards[derufin]?.exhausted).toBe(false);
    expect(there.cards[idOf(there, "50306")]?.attachments).not.toContain(derufin);
  });

  it("50304:A:1 hears only the Stone: another location traveled to leaves him attached", () => {
    const { state, ctx } = opened(["place"]);
    expect(traveled(state, ctx, "place").cards[idOf(state, "50304")]?.zone).toBe("attached");
  });

  it("50304:A:1 the players lose the game when Derufin leaves play", () => {
    const made = table({ stage: "50303", play: ["50304"] });
    const derufin = idOf(made.state, "50304");
    const hit = { ...made.state, cards: { ...made.state.cards, [derufin]: { ...made.state.cards[derufin]!, damage: 2 } } };
    expect(settle(hit, made.ctx, []).lost).toBe(true);
  });
});

describe("50308:A:2 the Night objectives, round by round", () => {
  const endOfRound = (state: ScenarioState, ctx: ReduceContext): ScenarioState => settle(fireForced({ ...state, window: null }, { trigger: "endOfRound", seat: 0 }, ctx, []), ctx, []);
  const night = (state: ScenarioState) => nightCard(state);

  it("50308:A:2 Eventide takes 4 rounds, Dusk gets no progress the round it comes in, and then takes 4 more; Midnight follows with no limit", () => {
    const made = table({ night: "50308", setAside: ["50309", "50310"] });
    let state = made.state;
    const seen: [string | undefined, number | undefined][] = [];
    for (let round = 1; round <= 10; round += 1) {
      state = endOfRound(state, made.ctx);
      seen.push([night(state)?.code, night(state)?.progress]);
    }
    // Eventide 1, 2, 3, then Dusk comes in at the fourth (0 progress), 1, 2, 3, then Midnight at the eighth (0), then 1 and 2.
    expect(seen).toEqual([["50308", 1], ["50308", 2], ["50308", 3], ["50309", 0], ["50309", 1], ["50309", 2], ["50309", 3], ["50310", 0], ["50310", 1], ["50310", 2]]);
    expect(Object.values(state.cards).filter((card) => card.zone === "victory").map((card) => card.code).sort()).toEqual(["50308", "50309"]);
    expect(Object.values(state.cards).find((card) => card.code === "50308")?.progress).toBe(4);
  });

  it("50310:A:1 Midnight raises each player's threat by its progress after placing 1: 1, 2, 3, 4 over four rounds", () => {
    const made = table({ night: "50310", seats: 2 });
    let state = made.state;
    for (let round = 1; round <= 4; round += 1) state = endOfRound(state, made.ctx);
    expect(night(state)?.progress).toBe(4);
    expect(state.seats[0]?.threat).toBe(28 + 1 + 2 + 3 + 4);
    expect(state.seats[1]?.threat).toBe(28 + 1 + 2 + 3 + 4);
  });

  it("50308:A:2 the passive check works as progress lands mid-round: the Gloaming at 3 progress brings Dusk in at once", () => {
    noProblems({ line: "50308:A:2", layout: { night: { code: "50308", progress: 3 }, setAside: ["50309"] }, act: resolve("50327", "whenRevealed"), expect: [zone("50308", "victory"), zone("50309", "nightObjective"), progressOn("50309", 0)] });
  });

  it("50309:A:2 progress past the limit is lost: the next Night starts with none", () => {
    noProblems({ line: "50309:A:2", layout: { night: { code: "50309", progress: 3 }, setAside: ["50310"] }, act: [resolve("50327", "whenRevealed"), resolve("50327", "whenRevealed")], expect: [zone("50309", "victory"), progressOn("50310", 1)] });
  });
});

describe("50312:A:1 Spectral", () => {
  // The first hero (Willpower 2, Attack 2) attacks the enemy engaged with him, Driven by Fear on him or not (Willpower 0), a Relic on him or not; the damage the enemy took.
  function attacked(enemy: string, hero: { fear?: boolean; relic?: boolean }): number {
    const attached = [...(hero.fear ? [{ code: "50325", to: "dh1" }] : []), ...(hero.relic ? [{ code: "50311", to: "dh1" }] : [])];
    const made = table({ phase: "PlayerAttacks", engaged: [enemy], attached });
    const target = idOf(made.state, enemy);
    const run = finish(send(start(made.state), { type: "DeclareAttackers", enemyId: target, attackerIds: [made.hero] }, made.ctx), made.ctx);
    return run.state.cards[target]?.damage ?? 0;
  }

  it("50312:A:1 an attacking character's Willpower is its attack strength against a Spectral enemy: Driven by Fear (Willpower 0) deals nothing", () => {
    expect(attacked("50312", { fear: true })).toBe(0);
  });

  it("50312:A:1 the enemy's Defense is still subtracted: Willpower 2 against Defense 1 deals 1, as the Attack of 2 would", () => {
    expect(attacked("50312", {})).toBe(1);
  });

  it("50312:A:1 an enemy without the keyword takes the Attack as usual, Willpower 0 or not", () => {
    expect(attacked("f3", { fear: true })).toBe(1);
  });

  it("50311:A:1 the Relic's hero attacking an Oathbreaker takes its Spectral away for that attack: the Attack of 2 counts", () => {
    expect(attacked("50312", { fear: true, relic: true })).toBe(1);
  });

  it("50311:A:1 the Relic lets the enemy keep nothing it did not lose: an enemy that is not an Oathbreaker is unaffected", () => {
    const made = table({ phase: "PlayerAttacks", engaged: ["f3"], attached: [{ code: "50311", to: "dh1" }, { code: "50325", to: "dh1" }] });
    const target = idOf(made.state, "f3");
    const run = finish(send(start(made.state), { type: "DeclareAttackers", enemyId: target, attackerIds: [made.hero] }, made.ctx), made.ctx);
    expect(run.state.modifiers.some((modifier) => modifier.stat === "losesSpectral")).toBe(false);
  });

  it("50311:A:1 the loss lasts until the end of the phase: a second attacker (Willpower 0) attacking that enemy deals its Attack too", () => {
    const made = table({ phase: "PlayerAttacks", engaged: ["50312"], attached: [{ code: "50311", to: "dh1" }, { code: "50325", to: "dh2" }] });
    const target = idOf(made.state, "50312");
    const first = finish(send(start(made.state), { type: "DeclareAttackers", enemyId: target, attackerIds: [made.hero] }, made.ctx), made.ctx);
    expect(first.state.modifiers.some((modifier) => modifier.stat === "losesSpectral" && modifier.instanceId === target)).toBe(true);
    expect(attackStrength(first.state, [made.hero2], target, made.cards)).toBe(2);
  });
});

describe("50307:A:1 Tarlang's Neck", () => {
  it("50307:A:1 the first player may end the encounter phase at once: nothing in the staging area is engaged", () => {
    const made = table({ active: "50307", staging: ["f3"], phase: "Encounter" });
    const heard = fireForced({ ...made.state, window: null }, { trigger: "beginningOfPhase", seat: null, phase: "Encounter" }, made.ctx, []);
    const run = finish({ state: settle(heard, made.ctx, []), steps: [] }, made.ctx, () => "endPhase");
    expect(run.state.cards[idOf(run.state, "f3")]?.zone).toBe("staging");
    expect(run.state.phase === "Encounter" && run.state.window?.kind === "optionalEngage").toBe(false);
  });
});

describe("50322:A:2 and 50323:A:3 Midnight, this effect cannot be canceled", () => {
  // A Response on a card in play that cancels the When Revealed effects of the card just revealed; the effects it is offered for.
  const cancels: Effect = { id: "blade:response:9", cardCode: "blade", lines: ["blade:A:1"], timing: "response", trigger: "whenRevealedPending", instructions: [{ verb: "CancelEffect" }] };
  function offered(revealed: string, night: string): boolean {
    const made = table({ night, deck: ["f0"] });
    const ctx = { ...made.ctx, effects: [...made.ctx.effects, cancels], cards: new Map([...made.ctx.cards, ["blade", definePrinted({ code: "blade", name: "Blade", type: "attachment" })]]) };
    const blade = spawn(made.state, "blade", { zone: "play", seat: 0 });
    const held = attachTo(blade.state, blade.id, made.hero);
    const revealing = revealFromTop(held, ctx, revealed, []);
    return legalIntents(revealing.state, ctx).some((intent) => intent.type === "Trigger" && intent.cardId === blade.id);
  }

  it("50322:A:2 Midnight Throng can be canceled at Eventide and at Dusk, not at Midnight", () => {
    expect([offered("50322", "50308"), offered("50322", "50309"), offered("50322", "50310")]).toEqual([true, true, false]);
  });

  it("50323:A:3 Murmurs of Dread can be canceled at Eventide and at Dusk, not at Midnight", () => {
    expect([offered("50323", "50308"), offered("50323", "50309"), offered("50323", "50310")]).toEqual([true, true, false]);
  });
});

describe("50306:A:2 the Stone's cannot ready", () => {
  it("50306:A:2 a character with less than 2 Willpower cannot be readied by a card effect while the Stone is active, one with 2 can", () => {
    const made = table({ active: "50306", night: "50310", play: ["50304"] });
    const state = settle(fireForced({ ...made.state, window: null }, { trigger: "beginningOfPhase", seat: null, phase: "Refresh" }, made.ctx, []), made.ctx, []);
    expect(readyBarred(state, idOf(state, "50304"), made.ctx.cards)).toBe(true);
    expect(readyBarred(state, made.hero, made.ctx.cards)).toBe(false);
  });
});

describe("50325:A:1 Driven by Fear is unlimited on a hero", () => {
  it("50325:A:1 with a copy already on the first hero, solo, the second copy joins it there", () => {
    const done = play(ID, { line: "50325:A:1", layout: { staging: ["50325"], attached: [{ code: "50325", to: "dh1" }] }, act: resolve("50325", "whenRevealed"), expect: [] }, EFFECTS, false);
    const copies = (done.run.state.cards[idOf(done.run.state, "dh1")]?.attachments ?? []).filter((id) => done.run.state.cards[id]?.code === "50325");
    expect(copies).toHaveLength(2);
  });
});
