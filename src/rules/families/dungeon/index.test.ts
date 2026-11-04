// Rules: rr.engaged, rr.attachment-cards, rr.drawing-cards, rr.shadow-effects, rr.step-6-4-2, rr.staging, rr.in-play-and-out-of-play
// (data/rules/entries.json); ledger lines 01107:A:1, 01125:B:1, 01105:A:1-2, 01123:B:2, 01124:B:2, 01123:A:1, 01104:A:1, 01102:A:3. The dungeon
// family's verbs on a table of Escape from Dol Guldur.
import { beforeAll, describe, expect, it } from "vitest";

import { syncConstants } from "../../interpret/constants.ts";
import type { EngineStep } from "../../core/intents.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { legalIntents, rejectionReason } from "../../engine/legal.ts";
import { settle } from "../../engine/machine.ts";
import { pushCardEffects } from "../../interpret/effect-frames.ts";
import { modifiedStat } from "../../core/keywords.ts";
import { stagingThreat } from "../../quest/quest.ts";
import { fireForced } from "../../windows/triggers.ts";
import { ORC_GUARD_CODE, printedOf } from "../../core/printed.ts";
import { updateCard, withSeat, type ScenarioState } from "../../core/state.ts";
import { dolGuldurTable, fight, loadDolGuldurWorld, type DolGuldurLayout, type DolGuldurWorld } from "../../../../test/scenarios/escape-from-dol-guldur/scene.ts";
import { first, type Run, send, start } from "../../../../test/harness/scene-kit.ts";
import { causeProblems } from "../../../../test/harness/cause-check.ts";

let world: DolGuldurWorld;

beforeAll(async () => {
  world = await loadDolGuldurWorld();
});

function make(layout: DolGuldurLayout = {}) {
  const made = dolGuldurTable(world, layout);
  return { ...made, state: syncConstants(made.state, made.ctx) };
}

const guards = (state: ScenarioState) => Object.values(state.cards).filter((card) => card.code === ORC_GUARD_CODE);

describe("PlaceOrcGuard (01107:A:1, 01125:B:1)", () => {
  it("Tower Gate: after the players travel there, each player's top deck card becomes an Orc Guard engaged with him (1 hit point, 1 Attack, 1 Defense)", () => {
    const { state, ctx } = make({ seats: 2, phase: "Travel", staging: ["01107"], deckOf: ["filler", "ally", "filler"] });
    const gate = first(state, "01107");
    let run = send(start(state), { type: "Travel", locationId: gate }, ctx);
    for (let guard = 0; guard < 8 && run.state.window?.kind === "choose"; guard += 1) run = send(run, { type: "Choose", optionId: run.state.window.options[0] ?? "" }, ctx);
    const made = guards(run.state);
    expect(made.length).toBe(2);
    expect(made.map((guard) => guard.zone)).toEqual(["engaged", "engaged"]);
    expect(made.map((guard) => guard.controller).sort()).toEqual([0, 1]);
    for (const guard of made) {
      expect([modifiedStat(run.state, guard, "attack", ctx.cards), modifiedStat(run.state, guard, "defense", ctx.cards), printedOf(ctx.cards, guard.code).health]).toEqual([1, 1, 1]);
      expect(printedOf(ctx.cards, guard.code).name).toBe("Orc Guard");
    }
    // Each top card of a deck is held facedown under its Orc Guard, out of the deck.
    for (const seat of [0, 1]) {
      const under = Object.values(run.state.cards).filter((card) => card.zone === "under" && card.owner === seat);
      expect(under.length).toBe(1);
      expect(under[0]?.face).toBe("down");
      expect(under[0]?.code).toBe("filler");
      expect(run.state.seats[seat]?.deck.length).toBe(2);
      expect(run.state.seats[seat]?.engaged.length).toBe(1);
    }
    expect(causeProblems(run.steps)).toEqual([]);
  });

  it("stage 3B: each quest phase begins with an Orc Guard for each player, from the top of each deck", () => {
    const { state, ctx } = make({ seats: 2, stage: "01125", deckOf: ["filler", "filler", "filler"] });
    const steps: EngineStep[] = [];
    const fired = fireForced({ ...state, window: null }, { trigger: "beginningOfPhase", seat: null, phase: "Quest" }, ctx, steps);
    const settled = settle(syncConstants(fired, ctx), ctx, steps);
    expect(guards(settled).length).toBe(2);
    expect(settled.seats.map((seat) => seat.deck.length)).toEqual([2, 2]);
    // Another phase begins: nothing.
    const other = settle(syncConstants(fireForced({ ...state, window: null }, { trigger: "beginningOfPhase", seat: null, phase: "Planning" }, ctx, []), ctx), ctx, []);
    expect(guards(other).length).toBe(0);
  });

  it("an Orc Guard defeated by an attack leaves the game, and the deck card under it goes to its owner's discard pile faceup", () => {
    const { state, ctx, hero } = make({ phase: "Combat", deckOf: ["filler", "filler"] });
    const placed = settle(syncConstants(runInstruction({ ...state, window: null }, { verb: "PlaceOrcGuard" }, { seat: 0, sourceId: state.questStage }, ctx, []), ctx), ctx, []);
    const guard = guards(placed)[0];
    expect(guard).toBeDefined();
    let run: Run = start({ ...placed, mode: "playerAttacks", window: { kind: "playerAttack" } });
    run = send(run, { type: "DeclareAttackers", enemyId: guard?.id ?? "", attackerIds: [hero] }, ctx);
    for (let step = 0; step < 6 && run.state.cards[guard?.id ?? ""]?.zone === "engaged"; step += 1) {
      const pass = legalIntents(run.state, ctx).find((intent) => intent.type === "Pass");
      if (!pass) break;
      run = send(run, pass, ctx);
    }
    expect(run.state.cards[guard?.id ?? ""]?.zone).toBe("removed");
    expect(run.state.encounterDiscard).not.toContain(guard?.id);
    expect(run.state.seats[0].engaged).toEqual([]);
    const held = Object.values(run.state.cards).filter((card) => card.code === "filler" && card.zone === "discard");
    expect(held.length).toBe(1);
    expect(held[0]?.face).toBe("up");
    expect(run.state.seats[0].discard).toEqual([held[0]?.id]);
  });

  it("does nothing when the deck is empty", () => {
    const { state, ctx } = make({ deckOf: [] });
    const placed = settle(syncConstants(runInstruction({ ...state, window: null }, { verb: "PlaceOrcGuard" }, { seat: 0, sourceId: state.questStage }, ctx, []), ctx), ctx, []);
    expect(guards(placed)).toEqual([]);
  });
});

describe("Iron Shackles (01105:A:1, 01105:A:2)", () => {
  it("is attached to the top of the first player's deck when revealed, in play and controlled by nobody", () => {
    const made = make({ seats: 2, deckOf: ["ally", "filler"], staging: ["01105"] });
    const id = first(made.state, "01105");
    const effects = made.ctx.effects.filter((effect) => effect.cardCode === "01105" && effect.timing === "whenRevealed");
    const steps: EngineStep[] = [];
    const pushed = pushCardEffects({ ...made.state, firstPlayer: 1 }, "whenRevealed", id, 1, false, effects, made.ctx, steps);
    const state = settle({ ...pushed, window: null }, made.ctx, steps);
    expect(state.seats[1].deckAttached).toEqual([id]);
    expect(state.seats[0].deckAttached).toBeUndefined();
    expect(state.cards[id]?.zone).toBe("attached");
    expect(state.cards[id]?.host).toBeNull();
    expect(state.cards[id]?.controller).toBeNull();
    expect(state.staging).not.toContain(id);
  });

  it("is not discarded by a draw that does not happen (an eliminated seat draws nothing)", () => {
    const made = make({ deckOf: ["ally", "filler"], staging: ["01105"] });
    const id = first(made.state, "01105");
    const effects = made.ctx.effects.filter((effect) => effect.cardCode === "01105" && effect.timing === "whenRevealed");
    const attached = settle({ ...pushCardEffects(made.state, "whenRevealed", id, 0, false, effects, made.ctx, []), window: null }, made.ctx, []);
    const out = withSeat(attached, 0, { ...attached.seats[0], eliminated: true });
    const drawn = runInstruction(out, { verb: "Draw", amount: 1 }, { seat: 0, sourceId: null }, made.ctx, []);
    expect(drawn.seats[0].deckAttached).toEqual([id]);
    expect(drawn.cards[id]?.zone).toBe("attached");
  });

  it("replaces the next draw from that deck, whatever its number of cards, by discarding it; the draw after is made", () => {
    for (const amount of [1, 2]) {
      const made = make({ deckOf: ["ally", "filler", "filler"], staging: ["01105"] });
      const id = first(made.state, "01105");
      const effects = made.ctx.effects.filter((effect) => effect.cardCode === "01105" && effect.timing === "whenRevealed");
      const attached = settle({ ...pushCardEffects(made.state, "whenRevealed", id, 0, false, effects, made.ctx, []), window: null }, made.ctx, []);
      const handBefore = attached.seats[0].hand.length;
      const draw = (state: ScenarioState) => settle(runInstruction(state, { verb: "Draw", amount }, { seat: 0, sourceId: null }, made.ctx, []), made.ctx, []);
      const replaced = draw(attached);
      expect(replaced.seats[0].hand.length, String(amount)).toBe(handBefore);
      expect(replaced.seats[0].deck.length).toBe(3);
      expect(replaced.seats[0].deckAttached).toBeUndefined();
      expect(replaced.cards[id]?.zone).toBe("encounterDiscard");
      expect(replaced.encounterDiscard).toEqual([id]);
      const drawn = draw(replaced);
      expect(drawn.seats[0].hand.length, String(amount)).toBe(handBefore + amount);
      expect(drawn.seats[0].deck.length).toBe(3 - amount);
    }
  });

  it("replaces the resource phase's draw too, and an opening-hand style draw of one card", () => {
    const made = make({ deckOf: ["ally", "filler", "filler"], staging: ["01105"] });
    const id = first(made.state, "01105");
    const effects = made.ctx.effects.filter((effect) => effect.cardCode === "01105" && effect.timing === "whenRevealed");
    const attached = settle({ ...pushCardEffects(made.state, "whenRevealed", id, 0, false, effects, made.ctx, []), window: null }, made.ctx, []);
    const resource = { ...attached, phase: "Refresh" as const, boundaryPhase: "Refresh" as const, mode: "endRound" as const, window: null };
    const next = settle(resource, made.ctx, []);
    // The next round's resource phase drew no card for the seat whose deck was shackled.
    expect(next.round).toBe(attached.round + 1);
    expect(next.seats[0].hand.length).toBe(attached.seats[0].hand.length);
    expect(next.cards[id]?.zone).toBe("encounterDiscard");
  });

  it("is attached by its Shadow effect too, resolving the When Revealed effect of the card (01105:A:2)", () => {
    const { run, hero } = fight(world, "01105", "grunt", { deckOf: ["filler", "filler", "filler"] }, { undefended: true });
    const shackles = first(run.state, "01105");
    expect(run.state.seats[0].deckAttached).toEqual([shackles]);
    expect(run.state.cards[shackles]?.zone).toBe("attached");
    expect(run.state.cards[shackles]?.host).toBeNull();
    expect(run.state.cards[hero]?.damage).toBeGreaterThan(0);
    expect(run.state.encounterDiscard).not.toContain(shackles);
  });
});

describe("the group limit of allies (01123:B:2, 01124:B:2)", () => {
  const playable = (state: ScenarioState, ctx: ReturnType<typeof make>["ctx"]) => legalIntents(state, ctx).filter((intent) => intent.type === "PlayCard");

  it("lets the players, as a group, play 1 ally a round, whichever seat plays it, and again the next round", () => {
    for (const stage of ["01123", "01124"] as const) {
      const { state, ctx } = make({ stage, seats: 2, phase: "Planning", hand: ["ally", "ally"] });
      expect(playable(state, ctx).length, stage).toBeGreaterThan(0);
      const played = send(start(state), { type: "PlayCard", cardId: state.seats[0].hand[0] ?? "", payments: [] }, ctx).state;
      // Neither the same seat nor the other seat, once it is its turn, plays another ally this round.
      expect(playable(played, ctx).filter((intent) => played.cards[intent.cardId]?.code === "ally"), `${stage} seat 0`).toEqual([]);
      const passed = send(start(played), { type: "Pass" }, ctx).state;
      expect(passed.activeSeat, stage).toBe(1);
      expect(playable(passed, ctx).filter((intent) => passed.cards[intent.cardId]?.code === "ally"), `${stage} seat 1`).toEqual([]);
      // The refusal names the card that limits and the kind of card.
      const second = played.seats[0].hand.find((id) => played.cards[id]?.code === "ally") ?? "";
      const source = stage === "01123" ? "The Necromancer's Tower" : "Through the Caverns";
      expect(rejectionReason(played, { type: "PlayCard", cardId: second, payments: [] }, ctx), stage).toBe(`${source}: the players play at most 1 ally card each round, and one was played this round.`);
      // The next round it may again.
      const later = { ...played, round: played.round + 1 };
      expect(playable(later, ctx).length, `${stage} later`).toBeGreaterThan(0);
    }
  });

  it("does not limit events or attachments, nor the allies a card puts into play, and is gone with its stage", () => {
    const { state, ctx } = make({ stage: "01125", phase: "Planning", hand: ["ally", "ally"] });
    expect(playable(state, ctx).length).toBeGreaterThan(0);
    const limited = make({ stage: "01123", phase: "Planning", hand: ["filler", "blade", "ally"] });
    const first1 = send(start(limited.state), { type: "PlayCard", cardId: first(limited.state, "ally"), payments: [] }, limited.ctx).state;
    const types = playable({ ...first1, window: { kind: "pass" } }, limited.ctx).map((intent) => first1.cards[intent.cardId]?.code);
    expect(types).toContain("blade");
    expect(types).not.toContain("ally");
  });
});

describe("TurnFaceUp (01123:A:1)", () => {
  it("turns the set-aside Nazgûl faceup, still out of play", () => {
    const { state, ctx } = make({ setAside: ["01102"] });
    const id = first(state, "01102");
    const down = updateCard(state, id, { face: "down" });
    expect(down.cards[id]?.face).toBe("down");
    const turned = runInstruction(down, { verb: "TurnFaceUp", code: "01102" }, { seat: 0, sourceId: down.questStage }, ctx, []);
    expect(turned.cards[id]?.face).toBe("up");
    expect(turned.cards[id]?.zone).toBe("setAside");
  });
});

describe("Under the Shadow (01104:A:1)", () => {
  it("raises the total Threat in the staging area by the number of players until the end of the phase", () => {
    for (const seats of [1, 2] as const) {
      const made = make({ seats, staging: ["f3", "01104"] });
      const before = stagingThreat(made.state, made.ctx.cards);
      const id = first(made.state, "01104");
      const effects = made.ctx.effects.filter((effect) => effect.cardCode === "01104" && effect.timing === "whenRevealed");
      const pushed = pushCardEffects(made.state, "whenRevealed", id, 0, false, effects, made.ctx, []);
      const after = settle(syncConstants({ ...pushed, window: null }, made.ctx), made.ctx, []);
      expect(stagingThreat(after, made.ctx.cards) - before, String(seats)).toBe(seats);
    }
  });
});

describe("a shadow effect dealt to the Nazgûl (01102:A:3)", () => {
  it("makes the engaged player choose and discard 1 character he controls once the effect has resolved, before damage", () => {
    const { run, hero, hero2 } = fight(world, "01089", "01102", {});
    const gone = [hero, hero2].filter((id) => run.state.cards[id]?.zone === "discard");
    expect(gone.length).toBe(1);
    expect(causeProblems(run.steps)).toEqual([]);
  });

  it("does nothing for a shadow card with no effect, and nothing for another enemy", () => {
    const blank = fight(world, "f0", "01102", {}, { undefended: true });
    expect([blank.hero, blank.hero2].filter((id) => blank.run.state.cards[id]?.zone === "discard")).toEqual([]);
    const other = fight(world, "01089", "grunt", {}, { undefended: true });
    expect([other.hero, other.hero2].filter((id) => other.run.state.cards[id]?.zone === "discard")).toEqual([]);
  });
});
