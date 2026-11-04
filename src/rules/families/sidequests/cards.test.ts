// Rules: rr.victory, rr.discard-pile-and-victory-display, rr.in-play-and-out-of-play, rr.destroy, rr.player-elimination, rr.cancel
// (data/rules/entries.json).
// Cards whose text reads the victory display or the side quests in it, through their real records (families/sidequests.ts).
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { RECORDS } from "../../../effects/authored/families/sidequests.ts";
import { ruleCause } from "../../core/cause.ts";
import { modifiedStat, placeDamage } from "../../core/keywords.ts";
import { reduce } from "../../engine/reduce.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { attachTo, spawn } from "../../core/zones.ts";
import { crossTo, inVictory, offered, passQuestWindow, play, put, questArea, questing, run, seat, send, sideCtx, synced, toVictory, trigger, triggers } from "./fixture.ts";

// A treachery whose When Revealed does something, so a cancel has an effect to cancel.
const CURSE: Effect = { id: "curse:whenRevealed:1", cardCode: "curse", lines: ["curse:A:1"], timing: "whenRevealed", instructions: [{ verb: "RaiseThreat", amount: 3, who: "eachSeat" }] };
const ctx = sideCtx([...RECORDS, CURSE]);

// The combat phase begins: "At the beginning of the combat phase" is announced (withMode).
function beginCombat(state: ScenarioState): ScenarioState {
  return run({ ...state, window: null, mode: "stopped", phase: "Combat", boundaryPhase: "Combat", pendingEvents: [{ trigger: "beginningOfPhase", seat: null, phase: "Combat" }] }, ctx);
}

function stat(state: ScenarioState, id: string, which: "willpower" | "attack" | "defense"): number {
  return modifiedStat(state, state.cards[id]!, which, ctx.cards);
}

describe("Rossiel (10028)", () => {
  it("gets +2 Willpower if the active location shares a Trait with a location in the victory display (10028:A:1)", () => {
    const table = seat(1, ["10028", "rohan"]);
    const rossiel = table.heroes[0] ?? "";
    const road = put(table.state, "forest-road", "activeLocation");
    expect(stat(synced(road.state, ctx), rossiel, "willpower")).toBe(2);
    const glade = put(road.state, "silvan-location", "staging");
    expect(stat(synced(toVictory(glade.state, glade.id), ctx), rossiel, "willpower")).toBe(4);
    // A location with no Trait in common does not count.
    const marsh = put(road.state, "marsh-copy", "staging");
    expect(stat(synced(toVictory(marsh.state, marsh.id), ctx), rossiel, "willpower")).toBe(2);
  });

  it("gets +2 Defense if the attacking enemy shares a Trait with an enemy in the victory display (10028:A:2)", () => {
    const table = seat(1, ["10028", "rohan"]);
    const rossiel = table.heroes[0] ?? "";
    const warg = put(table.state, "warg", "engaged", 0);
    const brute = put(warg.state, "forest-orc", "staging");
    const shown = synced(toVictory(brute.state, brute.id), ctx);
    const attacked = synced({ ...shown, pendingAttack: { enemyId: warg.id, seat: 0 } }, ctx);
    expect(stat(attacked, rossiel, "defense")).toBe(4);
    // Another enemy attacks: a wolf has nothing in common with the Orc.
    const wolf = put(shown, "wolf", "engaged", 0);
    const other = synced({ ...wolf.state, pendingAttack: { enemyId: wolf.id, seat: 0 } }, ctx);
    expect(stat(other, rossiel, "defense")).toBe(2);
    expect(stat(shown, rossiel, "defense")).toBe(2);
  });
});

describe("a side quest in the victory display and an ally that reads it", () => {
  it("Vigilant Dúnadan, Rider of Rohan and Thalion work from the first side quest in the display (16006:A:1, 17060:A:1, 19065:A:1)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const vigilant = put(table.state, "16006", "play");
    const rider = put(vigilant.state, "17060", "play");
    const bare = synced(rider.state, ctx);
    const flag = (state: ScenarioState, id: string, which: string) => state.modifiers.some((modifier) => modifier.instanceId === id && modifier.stat === which && modifier.amount > 0);
    expect(flag(bare, vigilant.id, "noExhaustDefend")).toBe(false);
    expect(flag(bare, rider.id, "noExhaustQuest")).toBe(false);
    const shown = inVictory(bare, "09014", ctx).state;
    expect(flag(shown, vigilant.id, "noExhaustDefend")).toBe(true);
    expect(flag(shown, rider.id, "noExhaustQuest")).toBe(true);
  });

  it("East Road Ranger gets +2 Willpower while committed to a side quest (10008:A:1)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const ranger = put(table.state, "10008", "play");
    const quest = questArea(ranger.state, "09014");
    let state = questing(synced(quest.state, ctx));
    expect(stat(state, ranger.id, "willpower")).toBe(1);
    // Committed to the current quest, it stays at 1.
    const main = send(state, { type: "Commit", cardIds: [ranger.id] }, ctx);
    expect(stat(synced(main, ctx), ranger.id, "willpower")).toBe(1);
    state = send(state, { type: "Commit", cardIds: [ranger.id], sideQuestId: quest.id }, ctx);
    expect(stat(synced(state, ctx), ranger.id, "willpower")).toBe(3);
  });

  it("Legacy Blade gives +1 Attack for each side quest in the victory display, up to +3 (17117:A:2)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const blade = put(table.state, "17117", "play");
    const hero = table.heroes[0] ?? "";
    let state = synced(attachTo(blade.state, blade.id, hero), ctx);
    const base = stat(state, hero, "attack");
    for (const [index, code] of ["09014", "10034", "10009", "10058"].entries()) {
      state = inVictory(state, code, ctx).state;
      expect(stat(state, hero, "attack")).toBe(base + Math.min(index + 1, 3));
    }
  });

  it("Thalion becomes a hero with the icons of the side quests' spheres once 3 are in the display (19065:A:1, A:2)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const thalion = put(table.state, "19065", "play");
    let state = synced(thalion.state, ctx);
    const iconed = (which: string) => state.modifiers.some((modifier) => modifier.instanceId === thalion.id && modifier.stat === which && modifier.amount > 0);
    // Spirit (Double Back), Lore (Scout Ahead) and Neutral (Gather Information).
    for (const code of ["10034", "10009"]) state = inVictory(state, code, ctx).state;
    expect(iconed("heroType")).toBe(false);
    state = inVictory(state, "09014", ctx).state;
    expect(iconed("heroType")).toBe(true);
    expect(iconed("spiritIcon")).toBe(true);
    expect(iconed("loreIcon")).toBe(true);
    expect(iconed("tacticsIcon")).toBe(false);
    expect(iconed("leadershipIcon")).toBe(false);
    // Ready at the beginning of the combat phase, with a side quest in the display.
    const tired = updateCard(state, thalion.id, { exhausted: true });
    expect(beginCombat(tired).cards[thalion.id]?.exhausted).toBe(false);
    const none = updateCard(synced(thalion.state, ctx), thalion.id, { exhausted: true });
    expect(beginCombat(none).cards[thalion.id]?.exhausted).toBe(true);
  });
});

describe("responses that read the victory display", () => {
  // The first player's reveal: a card on top of the encounter deck, the commit window passed.
  function revealing(code: string, ownVictory: readonly string[]) {
    const table = seat(1, ["lore", "dwarf"]);
    let state = table.state;
    for (const copy of ownVictory) state = inVictory(state, copy, ctx).state;
    state = spawn(state, code, { zone: "encounterDeck" }).state;
    return { table, state: run(passQuestWindow(questing(state), ctx), ctx) };
  }

  it("The Door is Closed! cancels the effects of a revealed card with a copy in the victory display and discards it (10092:A:1)", () => {
    // Without a copy in the display nothing is offered.
    const lone = seat(1, ["lore", "dwarf"]);
    const held = put(lone.state, "10092", "hand");
    const bare = run(passQuestWindow(questing(spawn(spawn(held.state, "curse", { zone: "encounterDeck" }).state, "orc", { zone: "encounterDeck" }).state), ctx), ctx);
    expect(triggers(bare, ctx, "10092:response:1")).toEqual([]);
    const withCopy = (() => {
      const base = seat(1, ["lore", "dwarf"]);
      const hand = put(base.state, "10092", "hand");
      const copy = put(hand.state, "curse", "staging");
      let next = toVictory(copy.state, copy.id);
      next = spawn(spawn(next, "curse", { zone: "encounterDeck" }).state, "orc", { zone: "encounterDeck" }).state;
      return { base, hand, state: run(passQuestWindow(questing(next), ctx), ctx) };
    })();
    const offer = offered(withCopy.state, ctx).find((intent) => intent.type === "Trigger" && intent.effectId === "10092:response:1");
    expect(offer).toBeDefined();
    const answered = trigger(withCopy.state, withCopy.hand.id, "10092:response:1", ctx, [{ heroId: withCopy.base.heroes[0] ?? "", amount: 1 }]);
    const done = run(answered, ctx);
    const curse = Object.values(done.cards).filter((card) => card.code === "curse");
    expect(curse.map((card) => card.zone).sort()).toEqual(["encounterDiscard", "victory"]);
    // Its When Revealed did not resolve.
    expect(done.seats[0].threat).toBe(withCopy.state.seats[0].threat);
  });

  it("Halfling Bounder cancels the When Revealed effects of a revealed card only with a side quest in the victory display (16005:A:1)", () => {
    const without = revealing("curse", []);
    expect(offered(without.state, ctx).some((intent) => intent.type === "Trigger" && intent.effectId === "16005:response:1")).toBe(false);
    const table = seat(1, ["lore", "dwarf"]);
    const bounder = put(table.state, "16005", "play");
    let state = inVictory(bounder.state, "09014", ctx).state;
    state = spawn(state, "curse", { zone: "encounterDeck" }).state;
    state = run(passQuestWindow(questing(state), ctx), ctx);
    const before = state.seats[0].threat;
    state = trigger(state, bounder.id, "16005:response:1", ctx);
    state = run(state, ctx);
    expect(state.cards[bounder.id]?.zone).toBe("discard");
    expect(state.seats[0].threat).toBe(before);
  });

  it("Woodland Sentry discards a chosen enemy or location with a copy in the victory display (22030:A:1)", () => {
    const table = seat(1, ["lore", "dwarf"]);
    const wolf = put(table.state, "wolf", "staging");
    const copy = put(wolf.state, "wolf2", "staging");
    const sentry = put(copy.state, "22030", "hand");
    const shown = toVictory(sentry.state, copy.id);
    let state = play(shown, sentry.id, ctx, [{ heroId: table.heroes[0] ?? "", amount: 1 }]);
    state = trigger(run(state, ctx), sentry.id, "22030:response:1", ctx);
    // The enemy is the only choice, so it is taken; the other Wolf in the display makes it discard.
    expect(state.cards[wolf.id]?.zone).toBe("encounterDiscard");
    // With no copy in the display, the chosen enemy stays.
    const plain = put(put(seat(1, ["lore", "dwarf"]).state, "wolf", "staging").state, "22030", "hand");
    const stayed = trigger(run(play(plain.state, plain.id, ctx, [{ heroId: table.heroes[0] ?? "", amount: 1 }]), ctx), plain.id, "22030:response:1", ctx);
    expect(Object.values(stayed.cards).find((card) => card.code === "wolf")?.zone).toBe("staging");
  });
});

describe("The Fall of Gil-Galad (08007:A:2)", () => {
  it("adds itself to the victory display when the attached hero is destroyed, to reduce threat by the hero's threat cost", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const hero = table.heroes[0] ?? "";
    const song = put(table.state, "08007", "play");
    let state = updateCard(attachTo(song.state, song.id, hero), hero, {});
    state = { ...state, seats: [{ ...state.seats[0], threat: 30 }, state.seats[1]] };
    state = placeDamage(state, hero, 99, ctx.cards, [], "combat", ruleCause("rr.damage"));
    state = run(state, ctx);
    expect(state.cards[hero]?.zone).toBe("discard");
    const offer = offered(state, ctx).find((intent) => intent.type === "Trigger" && intent.effectId === "08007:response:1");
    expect(offer).toBeDefined();
    state = trigger(state, song.id, "08007:response:1", ctx);
    state = run(state, ctx);
    expect(state.victory).toContain(song.id);
    // Dain's threat cost is 9.
    expect(state.seats[0].threat).toBe(21);
  });
});

describe("Justice Shall Be Done (12119:A:2)", () => {
  it("adds itself to the victory display, draws 3 cards, gives each hero 3 resources, and eliminates its player at the end of the round", () => {
    const table = seat(2, ["dwarf", "rohan"]);
    let state = table.state;
    for (let card = 0; card < 4; card += 1) state = put(state, "helper", "deck", 0).state;
    const event = put(state, "12119", "hand");
    const played = play(event.state, event.id, ctx);
    expect(played.victory).toContain(event.id);
    expect(played.seats[0].hand).toHaveLength(3);
    expect(played.cards[table.heroes[0] ?? ""]?.resources).toBe(8);
    expect(played.cards[table.heroes[2] ?? ""]?.resources).toBe(5);
    const later = crossTo(crossTo(played, "End of round", ctx), "Beginning of round", ctx);
    expect(later.seats[0].eliminated).toBe(true);
    expect(later.seats[1].eliminated).toBe(false);
    expect(reduce(later, { type: "Pass" }, ctx).ok).toBeDefined();
  });
});
