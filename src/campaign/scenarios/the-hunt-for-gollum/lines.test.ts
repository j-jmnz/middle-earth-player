// Rules: rr.guarded, rr.objective-cards, rr.attachment-cards, rr.first-player, rr.forced, rr.response, rr.cancel, rr.search, sotm.reset-the-quest-deck (data/rules/entries.json); ledger lines 02013:B:1, 02013:B:2, 02014:A:2, 02016:A:1, 02017:A:1, 02018:A:1, 02019:A:1, 02022:A:1, 900401:A:2, 900401:A:3, 900404:A:1, 900405:A:1, 900406:A:2, 900407:A:1, 900408:A:2, 900408:A:3.
// What a spec row cannot express on The Hunt for Gollum: a negative (a row must fail without its records), a host or a cost, a legal intent, a table with two copies of a card, a game over several steps. Each test starts its title with the line id it covers.
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import type { PrintedCard } from "../../../rules/core/printed.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { UNATTRIBUTED } from "../../../rules/core/cause.ts";
import { destroyCard, placeDamage } from "../../../rules/core/keywords.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { flagged, updateCard } from "../../../rules/core/state.ts";
import { attachTo, moveCard, spawn } from "../../../rules/core/zones.ts";
import type { PlayerIntent } from "../../../rules/engine/reduce.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { drawMany } from "../../../rules/interpret/interpret.ts";
import { constantWin } from "../../../rules/interpret/constants.ts";
import { playCost } from "../../../rules/player/attach.ts";

import { announce, attack, damageOn, handCount, quest, rowProblems, won, zone, type Row } from "../../../../test/harness/card-spec.ts";
import { first, idsOf, legalIntents, legalTargets, resolveRecords, revealFromTop, send, start, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const CLUE = "02014";
const HUNTERS = "02021";
const WITH_CLUE = [{ code: CLUE, to: "dh1" }] as const;

const table = (layout: Layout) => tableFromLayout("the-hunt-for-gollum", layout);
const holds = (row: Row): void => expect(rowProblems("the-hunt-for-gollum", row, EFFECTS)).toEqual([]);

// What claiming does (ClaimObjective), for a table that starts with the Clue on a hero: the card is attached in the attached zone, controlled by the hero's player.
function claimed(state: ScenarioState, signsId: string, heroId: string): ScenarioState {
  const hero = state.cards[heroId];
  const attached = attachTo(moveCard(state, signsId, { zone: "attached" }), signsId, heroId);
  return updateCard(attached, signsId, { face: "up", controller: hero?.controller ?? 0, claimed: true });
}
const withClue = (state: ScenarioState, heroId: string): { state: ScenarioState; id: string } => {
  const spawned = spawn(state, CLUE, { zone: "staging" });
  return { state: claimed(spawned.state, spawned.id, heroId), id: spawned.id };
};

describe("negatives of the spec rows", () => {
  it("02013:B:1 does not reset the quest deck while a hero holds a Clue", () => {
    holds({ line: "02013:B:1", layout: { stage: "02013", progress: 5, attached: WITH_CLUE }, act: announce("endOfPhase"), expect: [zone("02013", "questStage")] });
  });

  it("02013:B:2 defeating On the Trail wins the game", () => {
    holds({ line: "02013:B:2", layout: { stage: "02013", progress: 6, attached: WITH_CLUE }, act: quest("success"), expect: won });
  });

  it("02015:A:2 leaves an ally whose printed cost is not lower than the number of Riverland locations", () => {
    holds({ line: "02015:A:2", layout: { staging: ["02017"], play: ["ally"] }, act: attack("f3", { shadow: "02015" }), expect: zone("ally", "play") });
  });

  it("02018:A:2 leaves the enemy engaged when the defending player controls a hero with a Clue", () => {
    holds({ line: "02018:A:2", layout: { attached: WITH_CLUE }, act: attack("f3", { shadow: "02018" }), expect: zone("f3", "engaged") });
  });

  it("02019:A:2 adds nothing when the defending player controls a hero with a Clue", () => {
    holds({ line: "02019:A:2", layout: { attached: WITH_CLUE }, act: attack("f3", { shadow: "02019", undefended: true }), expect: damageOn("dh1", 1) });
  });

  it("900404:A:2 keeps the hand of a player who controls a Clue", () => {
    holds({ line: "900404:A:2", layout: { hand: ["filler", "filler"], attached: WITH_CLUE }, act: attack("f3", { shadow: "900404" }), expect: handCount(2) });
  });

  it("900408:A:3 still damages the defender of a defended attack", () => {
    holds({ line: "900408:A:3", layout: { attached: [{ code: CLUE, to: "dh2" }] }, act: attack(HUNTERS, { shadow: "900408" }), expect: [damageOn("dh1", 2), damageOn("dh2", 0)] });
  });

  it("02019:A:2 doubles only the base Attack, not the +2 for each Clue Hunters from Mordor gets", () => {
    // Hunters: printed Attack 2, +2 for the Clue in the staging area, +2 base again from the shadow: 6 damage on an undefended hero.
    holds({ line: "02019:A:2", layout: { staging: [CLUE] }, act: [attack(HUNTERS, { shadow: "02019", undefended: true })], expect: damageOn("dh1", 6) });
  });
});

describe("02013:B:1 On the Trail", () => {
  it("02013:B:1 lets only a player who controls a hero with a Clue attached commit characters", () => {
    const made = table({ stage: "02013", seats: 2, phase: "Quest" });
    const state = withClue(made.state, made.hero).state;
    const commits = (seat: number): boolean => legalTargets({ ...state, activeSeat: seat }, { type: "Commit" }, made.ctx).length > 0;
    expect(commits(0)).toBe(true);
    expect(commits(1)).toBe(false);
  });

  it("02013:B:1 resets the quest deck as soon as the last Clue leaves a hero, keeping the progress on the active location and the staging area", () => {
    const made = table({ stage: "02013", progress: 5, active: "02016", staging: ["f3"], phase: "Quest" });
    const active = first(made.state, "02016");
    const held = withClue(updateCard(made.state, active, { progress: 2 }), made.hero);
    const synced = settle({ ...held.state, window: null }, made.ctx, []);
    expect(synced.cards[synced.questStage ?? ""]?.code).toBe("02013");
    // The Clue goes back to the staging area (its hero is damaged, say): no hero holds one now.
    const steps: EngineStep[] = [];
    const hurt = placeDamage(synced, made.hero, 1, made.ctx.cards, steps, "framework", { kind: "rule", rule: "test" } as never);
    const reset = settle({ ...hurt, window: null }, made.ctx, steps);
    expect(reset.cards[reset.questStage ?? ""]).toMatchObject({ code: "02012", progress: 0 });
    expect(reset.cards[active]?.progress).toBe(2);
    expect(reset.cards[first(reset, "f3")]?.zone).toBe("staging");
  });
});

describe("02014:A:2 Signs of Gollum", () => {
  it("02014:A:2 is offered to the first player (the second seat here), who names the hero from every committed hero", () => {
    const made = table({ seats: 2, firstPlayer: 1, stage: "02012", progress: 8, staging: [CLUE], phase: "Quest" });
    let run = start(made.state);
    // Each seat commits its heroes in turn (the second seat is the first player's side here): a Commit, then a Pass for the seat, until the quest is resolved.
    for (let guard = 0; guard < 8 && run.state.mode === "questCommit"; guard += 1) {
      const seat = run.state.activeSeat;
      run = send(run, { type: "Commit", cardIds: [...(run.state.seats[seat]?.heroes ?? [])] }, made.ctx);
      run = send(run, { type: "Pass" }, made.ctx);
    }
    const signs = first(run.state, CLUE);
    const offered = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === signs);
    expect(offered).toBeDefined();
    const used = send(run, offered as PlayerIntent, made.ctx);
    expect(used.state.window).toMatchObject({ kind: "choose" });
    expect(used.state.window?.kind === "choose" ? used.state.window.options : []).toEqual(expect.arrayContaining([made.hero, made.hero2, made.seat1Hero ?? ""]));
    const chosen = send(used, { type: "Choose", optionId: made.seat1Hero ?? "" }, made.ctx);
    // The card is controlled by the player of the hero it is attached to.
    expect(chosen.state.cards[signs]).toMatchObject({ zone: "attached", host: made.seat1Hero, claimed: true, controller: 1 });
  });

  it("02014:A:2 is not offered after the quest fails", () => {
    const made = table({ stage: "02012", progress: 0, staging: [CLUE, "f3"], phase: "Quest" });
    let run = start(made.state);
    run = send(run, { type: "Commit", cardIds: [made.hero] }, made.ctx);
    run = send(run, { type: "Pass" }, made.ctx);
    expect(legalIntents(run.state, made.ctx).some((intent) => intent.type === "Trigger" && intent.cardId === first(run.state, CLUE))).toBe(false);
  });

  it("02014:A:2 returns to the top of the encounter deck when its hero is damaged, and when it is destroyed", () => {
    const made = table({ stage: "02012", deck: ["f0", "f3"], phase: "Quest" });
    const held = withClue(made.state, made.hero);
    const steps: EngineStep[] = [];
    const hurt = settle({ ...placeDamage(held.state, made.hero, 1, made.ctx.cards, steps, "framework", { kind: "rule", rule: "test" } as never), window: null }, made.ctx, steps);
    expect(hurt.encounterDeck[0]).toBe(held.id);
    expect(hurt.cards[held.id]).toMatchObject({ zone: "encounterDeck", face: "down" });
    const other = withClue(made.state, made.hero);
    const gone = destroyCard(settle({ ...other.state, window: null }, made.ctx, []), made.hero, made.ctx.cards, []);
    expect(gone.encounterDeck[0]).toBe(other.id);
  });

  it("02014:A:2 is Guarded again when it comes back into play", () => {
    const made = table({ deck: ["f3", "f0"], phase: "Quest" });
    const first1 = revealFromTop(made.state, made.ctx, CLUE, []);
    expect(first1.state.cards[first(first1.state, "f3")]).toMatchObject({ host: first1.id, guard: true });
  });
});

describe("02016:A:1 The Eaves of Mirkwood", () => {
  it("02016:A:1 holds encounterUncancelable while it is the active location, and only then", () => {
    expect(flagged(table({ active: "02016" }).state, "table", "encounterUncancelable")).toBe(true);
    expect(flagged(table({ staging: ["02016"] }).state, "table", "encounterUncancelable")).toBe(false);
  });
});

describe("02017:A:1 River Ninglor", () => {
  it("02017:A:1 takes the progress off this copy, not off another River Ninglor in the staging area", () => {
    const made = table({ progress: 3, active: "02017", staging: [{ code: "02017", progress: 2 }], phase: "Quest" });
    const [activeId, stagedId] = idsOf(made.state, "02017").sort((a, b) => (made.state.cards[a]?.zone === "activeLocation" ? -1 : made.state.cards[b]?.zone === "activeLocation" ? 1 : 0));
    const withProgress = updateCard(made.state, activeId ?? "", { progress: 2 });
    const run = resolveRecords(withProgress, made.ctx, "02017", "forced", activeId);
    expect(run.state.cards[activeId ?? ""]?.progress).toBe(1);
    expect(run.state.cards[stagedId ?? ""]?.progress).toBe(2);
  });
});

describe("02018:A:1 and 02019:A:1 the Banks", () => {
  const cost = (made: ReturnType<typeof table>, code: string): number => playCost(made.state, first(made.state, code), 0, made.ctx) ?? 0;

  it("02018:A:1 makes an ally card cost 1 more to play from the hand while it is the active location, and an event nothing", () => {
    const quiet = table({ hand: ["ally", "event"], phase: "Planning" });
    const busy = table({ hand: ["ally", "event"], active: "02018", phase: "Planning" });
    expect(cost(busy, "ally") - cost(quiet, "ally")).toBe(1);
    expect(cost(busy, "event")).toBe(cost(quiet, "event"));
  });

  it("02019:A:1 makes an attachment card and an event card cost 1 more to play from the hand while it is the active location, and an ally nothing", () => {
    const quiet = table({ hand: ["ally", "event", "attachment"], phase: "Planning" });
    const busy = table({ hand: ["ally", "event", "attachment"], active: "02019", phase: "Planning" });
    expect(cost(busy, "event") - cost(quiet, "event")).toBe(1);
    expect(cost(busy, "attachment") - cost(quiet, "attachment")).toBe(1);
    expect(cost(busy, "ally")).toBe(cost(quiet, "ally"));
  });
});

describe("02022:A:1 False Lead", () => {
  it("02022:A:1 shuffles a guarded Clue back into the deck and its guard stays in the staging area", () => {
    const made = table({ staging: [CLUE, "f3"], deck: ["f0"], phase: "Quest" });
    const signs = first(made.state, CLUE);
    const guard = first(made.state, "f3");
    const guarded = updateCard(attachTo(made.state, guard, signs), guard, { guard: true });
    const run = revealFromTop(guarded, made.ctx, "02022", []);
    expect(run.state.cards[signs]?.zone).toBe("encounterDeck");
    expect(run.state.cards[guard]).toMatchObject({ zone: "staging", host: null });
  });
});

describe("900401:A:2 The Hunt for Gollum Nightmare", () => {
  const nightmare = (layout: Layout) => {
    const made = table(layout);
    const spawned = spawn(made.state, "900401", { zone: "nightmare" });
    return { ...made, state: spawned.state, setup: spawned.id };
  };

  it("900401:A:2 makes a free Mordor enemy guard an unclaimed Clue, detaching its old guard, and an engaged enemy stays engaged", () => {
    const made = nightmare({ staging: [CLUE, "f0"], engaged: [HUNTERS], phase: "Refresh" });
    const signs = first(made.state, CLUE);
    const oldGuard = first(made.state, "f0");
    const hunters = first(made.state, HUNTERS);
    const guarded = updateCard(attachTo(made.state, oldGuard, signs), oldGuard, { guard: true });
    const run = resolveRecords(guarded, made.ctx, "900401", "forced", made.setup);
    expect(run.state.cards[hunters]).toMatchObject({ host: signs, guard: true, zone: "engaged" });
    expect(run.state.cards[oldGuard]).toMatchObject({ host: null, zone: "staging" });
  });

  it("900401:A:2 leaves a Clue a hero holds alone, and does nothing with no Mordor enemy in play", () => {
    const heldBy = nightmare({ staging: [HUNTERS], phase: "Refresh" });
    const held = withClue(heldBy.state, heldBy.hero);
    const none = resolveRecords(held.state, heldBy.ctx, "900401", "forced", heldBy.setup);
    expect(none.state.cards[held.id]).toMatchObject({ zone: "attached", host: heldBy.hero });
    expect(none.state.cards[first(none.state, HUNTERS)]?.host).toBeNull();
    const empty = nightmare({ staging: [CLUE, "f0"], phase: "Refresh" });
    const idle = resolveRecords(empty.state, empty.ctx, "900401", "forced", empty.setup);
    expect(idle.state.cards[first(idle.state, CLUE)]?.attachments).toEqual([]);
  });

  it("900401:A:3 loses the game with four Clue cards guarded by Mordor enemies, and not with three", () => {
    const made = nightmare({ staging: [CLUE, CLUE, CLUE, CLUE, HUNTERS, HUNTERS, HUNTERS, HUNTERS], phase: "Quest" });
    const signs = idsOf(made.state, CLUE);
    const hunters = idsOf(made.state, HUNTERS);
    let state = made.state;
    for (const [at, id] of signs.entries()) {
      state = updateCard(attachTo(state, hunters[at] ?? "", id), hunters[at] ?? "", { guard: true });
      expect(constantWin(state, made.ctx).lost === true, `with ${at + 1} guarded`).toBe(at === 3);
    }
  });
});

describe("900404:A:1 Watched Path and 900405:A:1 Hunter's Lookout", () => {
  it("900404:A:1 stops a card effect's draw for a player with no Clue card, and not the framework's draw or a Clue holder's", () => {
    const made = table({ staging: ["900404"], deckOf: ["filler", "filler", "filler"], phase: "Planning" });
    const handOf = (state: ScenarioState): number => state.seats[0]?.hand.length ?? 0;
    expect(handOf(drawMany(made.state, 0, 1, [], UNATTRIBUTED, made.ctx))).toBe(0);
    expect(handOf(drawMany(made.state, 0, 1, [], UNATTRIBUTED, made.ctx, false, false, true))).toBe(1);
    expect(handOf(drawMany(withClue(made.state, made.hero).state, 0, 2, [], UNATTRIBUTED, made.ctx))).toBe(2);
  });

  it("900405:A:1 gives a Mordor enemy that guards a Clue +2 Defense, and no other enemy", () => {
    const made = table({ staging: [CLUE, HUNTERS, "f3", "900405"], phase: "Quest" });
    const hunters = first(made.state, HUNTERS);
    const signs = first(made.state, CLUE);
    const defense = (state: ScenarioState, id: string) => state.modifiers.filter((modifier) => modifier.instanceId === id && modifier.stat === "defense").reduce((sum, modifier) => sum + modifier.amount, 0);
    const before = settle({ ...made.state, window: null }, made.ctx, []);
    const guarded = settle({ ...updateCard(attachTo(before, hunters, signs), hunters, { guard: true }), window: null }, made.ctx, []);
    expect(defense(before, hunters)).toBe(0);
    expect(defense(guarded, hunters)).toBe(2);
    expect(defense(guarded, first(guarded, "f3"))).toBe(0);
  });
});

describe("900406:A:2 Dark Pools", () => {
  it("900406:A:2 discards the highest-cost ally of each player, each from his own side, when it becomes the active location", () => {
    const made = table({ seats: 2, staging: ["900406"], phase: "Travel" });
    (made.ctx.cards as Map<string, PrintedCard>).set("hi", { ...made.ctx.cards.get("ally")!, code: "hi", name: "hi", cost: 3 });
    let state = made.state;
    state = spawn(state, "ally", { zone: "play", seat: 0 }).state;
    state = spawn(state, "hi", { zone: "play", seat: 0 }).state;
    const theirs = spawn(state, "ally", { zone: "play", seat: 1 });
    const run = resolveRecords(theirs.state, made.ctx, "900406", "forced", first(theirs.state, "900406"));
    expect(run.state.cards[first(run.state, "hi")]?.zone).toBe("discard");
    expect(run.state.cards[theirs.id]?.zone).toBe("discard");
    expect(Object.values(run.state.cards).filter((card) => card.code === "ally" && card.zone === "play")).toHaveLength(1);
  });
});

describe("900407:A:1 and 900408:A:2 Clue cards moved by the Nightmare treacheries", () => {
  it("900407:A:1 attaches the Clue of the discard pile to the Mordor enemy as its guard, the enemy keeping its engagement", () => {
    const made = table({ engaged: [HUNTERS], discard: [CLUE], deck: ["f3"], phase: "Quest" });
    const run = revealFromTop(made.state, made.ctx, "900407", []);
    const signs = first(run.state, CLUE);
    expect(run.state.cards[signs]?.zone).toBe("staging");
    expect(run.state.cards[first(run.state, HUNTERS)]).toMatchObject({ host: signs, guard: true, zone: "engaged" });
  });

  it("900408:A:2 takes a Clue off a hero and makes a Mordor enemy guard it, the hero losing it", () => {
    const made = table({ staging: [HUNTERS], phase: "Quest" });
    const held = withClue(made.state, made.hero);
    const run = resolveRecords(held.state, made.ctx, "900408", "whenRevealed");
    expect(run.state.cards[held.id]).toMatchObject({ zone: "staging", host: null });
    expect(run.state.cards[first(run.state, HUNTERS)]).toMatchObject({ host: held.id, guard: true });
    expect(run.state.cards[made.hero]?.attachments).toEqual([]);
  });

  it("900408:A:2 does nothing when no hero holds a Clue: the Mordor enemy does not move, even engaged", () => {
    const made = table({ engaged: [HUNTERS], staging: [CLUE], phase: "Quest" });
    const run = resolveRecords(made.state, made.ctx, "900408", "whenRevealed");
    expect(run.state.cards[first(run.state, HUNTERS)]).toMatchObject({ zone: "engaged", host: null });
    expect(run.state.cards[first(run.state, CLUE)]?.attachments).toEqual([]);
  });

  it("900408:A:3 sends an undefended attack's damage to the Clue hero, and to a hero of the player when he has none", () => {
    holds({ line: "900408:A:3", layout: { attached: [{ code: CLUE, to: "dh2" }] }, act: attack("f3", { shadow: "900408", undefended: true }), expect: [damageOn("dh2", 1), damageOn("dh1", 0)] });
    holds({ line: "900408:A:3", layout: {}, act: attack("f3", { shadow: "900408", undefended: true }), expect: damageOn("dh1", 1) });
  });
});
