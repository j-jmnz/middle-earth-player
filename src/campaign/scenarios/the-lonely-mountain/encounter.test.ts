// Rules: hob.burgle, rr.forced, rr.travel, rr.cost, rr.resources, rr.first-player, rr.surge, rr.damage, rr.immune, rr.staging, faq.additional-attacks, faq.enemy-attacks-outside-combat, hob.bilbo-multiplayer-otd (data/rules/entries.json); docs/scenarios/the-hobbit.md (The Lonely Mountain).
import { describe, expect } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { type ScenarioState } from "../../../rules/core/state.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { startReveal } from "../../../rules/windows/frames.ts";

import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { bilbo, drive, make, resolveAndDrive } from "../../../../test/scenarios/the-lonely-mountain/moments.ts";
import { codesIn, idOf, legalIntents, send, start, zoneOf, type Run } from "../../../../test/harness/scene-kit.ts";
import type { LayoutTable } from "../../../../test/harness/layout.ts";

// Encounter cards of The Lonely Mountain that need more than a spec row: Pretending to Sleep revealed by the second player, Secret Entrance's Travel step by step, Dragon-Spell with the Mountain's Action, Belching Fire's attacked player, the staging area's Smaug in the combat phase and the discards of
// a burgle attempt (not revealed).

const resourcesOf = (state: ScenarioState, code: string): number => state.cards[idOf(state, code)]?.resources ?? -1;
const current = (state: ScenarioState): string | undefined => (state.questStage ? state.cards[state.questStage]?.code : undefined);

// The second player (seat 1) reveals the top card of the encounter deck: `startReveal` with that seat, the effects it pushes settled.
function revealBy(made: LayoutTable, seat: number, code: string): Run {
  const steps: EngineStep[] = [];
  const spawned = made.state.cards;
  void spawned;
  const top = Object.values(made.state.cards).find((card) => card.code === code && card.zone === "encounterDeck");
  if (!top) throw new Error(`no ${code} on the encounter deck`);
  const deckFirst = { ...made.state, window: null, mode: "stopped" as const, encounterDeck: [top.id, ...made.state.encounterDeck.filter((id) => id !== top.id)] };
  return { state: settle(startReveal(deckFirst, seat, made.ctx, steps), made.ctx, steps), steps };
}

describe("132048:A:2 Pretending to Sleep: the first player chooses and spends the X Baggins resources, whoever revealed the card", () => {
  const twoPlayers = (effects: readonly Effect[], resources: number, progress = 0) =>
    make({ seats: 2, stage: "132072", staging: [{ code: "132040", progress }], deck: ["132048", "f0", "f0"], heroes: [{ code: "132001", resources }] }, effects);

  lineSpec("132048:A:2", "revealed by the second player: the first player is asked, and his Bilbo pays X resources (X = the progress on Smaug the Golden)", (effects) => {
    const made = twoPlayers(effects, 3);
    const run = revealBy(made, 1, "132048");
    expect(run.state.window?.kind).toBe("choose");
    expect(run.state.activeSeat).toBe(0);
    const done = drive(run, made, { answers: ["spend"] });
    expect(resourcesOf(done.state, "132001")).toBe(2);
    expect(current(done.state)).toBe("132072");
    expect(Object.values(done.state.cards).find((card) => card.code === "132040")?.progress).toBe(1);
  });
  lineSpec("132048:A:2", "with fewer Baggins resources than X only advancing to stage 4A is offered", (effects) => {
    const made = twoPlayers(effects, 1, 1);
    const run = revealBy(made, 1, "132048");
    // The only option left is taken at once: the players advance and no resource is spent.
    expect(current(run.state)).toBe("132074");
    expect(resourcesOf(run.state, "132001")).toBe(1);
  });
  lineSpec("132048:A:2", "with Smaug the Golden not in play no progress is placed and nothing is asked (the surge still reveals the next card)", (effects) => {
    const made = make({ stage: "132073", staging: ["132041"], deck: ["132048", "f0", "f0"], heroes: [bilbo(3)] }, effects);
    const run = revealBy(made, 0, "132048");
    expect(run.state.window?.kind).not.toBe("choose");
    expect(resourcesOf(run.state, "132001")).toBe(3);
    expect(current(run.state)).toBe("132073");
    // With him in play (stage 2) the same card asks.
    const asks = revealBy(make({ stage: "132072", staging: ["132040"], deck: ["132048", "f0", "f0"], heroes: [bilbo(3)] }, effects), 0, "132048");
    expect(asks.state.window?.kind).toBe("choose");
  });
});

describe("132045:A:2 Secret Entrance: exhaust a hero, name a card type and look at the top card of the encounter deck", () => {
  const entrance = (effects: readonly Effect[], deck: readonly string[]): LayoutTable => make({ phase: "Travel", staging: ["132045", "132043"], deck }, effects);
  const travelTo = (made: LayoutTable): Run => send(start(made.state), { type: "Travel", locationId: idOf(made.state, "132045") }, made.ctx);

  lineSpec("132045:A:2", "the hero exhausts first, then the type is named from enemy, location, treachery and objective, and the top card is looked at, not revealed", (effects) => {
    const made = entrance(effects, ["132044", "f0"]);
    const asked = travelTo(made);
    expect(asked.state.window?.kind).toBe("choose");
    const picked = send(asked, { type: "Choose", optionId: idOf(made.state, "dh1") }, made.ctx);
    expect(picked.state.cards[idOf(made.state, "dh1")]?.exhausted).toBe(true);
    expect(picked.state.window?.kind === "choose" ? picked.state.window.options : []).toEqual(["enemy", "location", "treachery", "objective"]);
    const named = send(picked, { type: "Choose", optionId: "location" }, made.ctx);
    expect(named.state.window?.kind).toBe("look");
    expect(named.state.window?.kind === "look" ? named.state.window.cardIds.map((id) => named.state.cards[id]?.code) : []).toEqual(["132044"]);
    const looked = drive(named, made);
    expect(zoneOf(looked.state, "132045")).toBe("activeLocation");
    expect(looked.state.encounterDeck.length).toBe(2);
    expect(zoneOf(looked.state, "132044")).toBe("encounterDeck");
  });
  lineSpec("132045:A:2", "a top card of another type returns Secret Entrance to the staging area, the hero stays exhausted and the card is not revealed", (effects) => {
    const made = entrance(effects, ["treachery", "f0"]);
    const looking = drive(travelTo(made), made, { answers: ["dh1", "enemy"] }, ["look"]);
    expect(looking.state.window?.kind).toBe("look");
    expect(looking.state.cards[idOf(made.state, "dh1")]?.exhausted).toBe(true);
    const done = drive(looking, made);
    expect(zoneOf(done.state, "132045")).toBe("staging");
    expect(zoneOf(done.state, "treachery")).toBe("encounterDeck");
  });
  lineSpec("132045:A:2", "with an empty encounter deck the top card is not the named type and the location returns to the staging area", (effects) => {
    const made = entrance(effects, []);
    const done = drive(travelTo(made), made, { answers: ["dh1", "enemy"] });
    expect(zoneOf(done.state, "132045")).toBe("staging");
  });
  lineSpec("132045:A:2", "the first player may exhaust any hero he controls, Bilbo too", (effects) => {
    const made = make({ phase: "Travel", staging: ["132045"], deck: ["f0"], heroes: [bilbo(0)] }, effects);
    const asked = travelTo(made);
    expect(asked.state.window?.kind === "choose" ? asked.state.window.options.map((id) => asked.state.cards[id]?.code).sort() : []).toEqual(["132001", "dh1", "dh2"]);
  });
  lineSpec("132045:A:2", "the players cannot travel to it with no ready hero to exhaust", (effects) => {
    const made = make({ phase: "Travel", staging: ["132045"], deck: ["f0"] }, effects);
    const spent = { ...made.state, cards: Object.fromEntries(Object.entries(made.state.cards).map(([id, card]) => [id, card.zone === "heroes" ? { ...card, exhausted: true } : card])) };
    expect(legalIntents(spent, made.ctx).some((intent) => intent.type === "Travel")).toBe(false);
    expect(legalIntents(made.state, made.ctx).some((intent) => intent.type === "Travel")).toBe(true);
  });
});

describe("132051:A:1 Dragon-Spell: the hero takes damage equal to the resources it spends, for any card or ability", () => {
  lineSpec("132051:A:1", "Bilbo with a Dragon-Spell pays 2 Baggins resources for The Lonely Mountain's Action and takes 2 damage", (effects) => {
    const made = make({ staging: ["132041", "132039", "132043"], deck: ["132042", "f0", "f0"], deckOf: ["01016", "01016", "01016"], hand: ["01016"], heroes: [bilbo(3)], attached: [{ code: "132051", to: "132001" }] }, effects);
    const window = resolveAndDrive(made, "132039", "response", {}, ["frameAction"]);
    const paid = drive(window, made, { use: [{ code: "132043" }] }, ["choose"]);
    expect(resourcesOf(paid.state, "132001")).toBe(1);
    expect(paid.state.cards[idOf(made.state, "132001")]?.damage).toBe(2);
  });
  lineSpec("132051:A:1", "it attaches to the hero with the most resources, Bilbo with 3 against 2, and not to the others", (effects) => {
    const made = make({ heroes: [bilbo(3)], heroResources: 0, deck: ["132051", "f0"] }, effects);
    const run = revealBy({ ...made, state: { ...made.state, cards: Object.fromEntries(Object.entries(made.state.cards).map(([id, card]) => [id, card.code === "dh1" ? { ...card, resources: 2 } : card])) } }, 0, "132051");
    expect(run.state.cards[Object.values(run.state.cards).find((card) => card.code === "132051")?.id ?? ""]?.host).toBe(idOf(made.state, "132001"));
    expect(codesIn(run.state, "attached")).toEqual(["132051"]);
  });
});

describe("132050:A:1 Belching Fire: each Dragon in the staging area attacks the player with the highest total Willpower committed", () => {
  const fire = (effects: readonly Effect[], committed: readonly string[]) => {
    const made = make({ seats: 2, staging: ["132041"], committed }, effects);
    return { made, run: resolveAndDrive(made, "132050", "whenRevealed", {}, ["defense"]) };
  };
  lineSpec("132050:A:1", "the second player has the highest Willpower committed and is attacked; with the first player's heroes committed he is the one attacked", (effects) => {
    const second = fire(effects, ["dh3"]);
    expect(second.run.state.pendingAttack?.seat).toBe(1);
    const first = fire(effects, ["dh1", "dh2"]);
    expect(first.run.state.pendingAttack?.seat).toBe(0);
    expect(first.run.state.pendingAttack?.enemyId).toBe(idOf(first.made.state, "132041"));
  });
});

describe("132041:A:2 Smaug the Magnificent: in the staging area he attacks the first player, who is the only one to attack him", () => {
  lineSpec("132041:A:2", "in the combat phase he attacks the first player from the staging area and stays there", (effects) => {
    const made = make({ phase: "Combat", staging: ["132041"], deck: ["f0", "f0", "f0", "f0"] }, effects);
    const run = send(start(made.state), { type: "Pass" }, made.ctx);
    const driven = drive(run, made, {}, ["defense"]);
    expect(driven.state.pendingAttack?.enemyId).toBe(idOf(made.state, "132041"));
    expect(driven.state.pendingAttack?.seat).toBe(0);
    expect(zoneOf(driven.state, "132041")).toBe("staging");
  });
  lineSpec("132041:A:3", "dealt a shadow card with a burgle effect he attacks again right after the first attack, with a new shadow card; a shadow card without one gives no second attack", (effects) => {
    const attacks = (shadow: string): number => {
      const made = make({ phase: "Combat", staging: ["132041"], deck: [shadow, "f0", "f0", "f0"] }, effects);
      let run = drive(send(start(made.state), { type: "Pass" }, made.ctx), made, {}, ["defense"]);
      for (let guard = 0; guard < 4 && run.state.window?.kind === "defense"; guard += 1) run = drive(send(run, { type: "Undefended", heroId: idOf(run.state, run.state.cards[idOf(run.state, "dh1")]?.zone === "heroes" ? "dh1" : "dh2") }, made.ctx), made, {}, ["defense"]);
      return run.steps.filter((step) => step.kind === "attack" && step.side === "enemy").length;
    };
    expect(attacks("132042")).toBe(2);
    expect(attacks("f0")).toBe(1);
  });
});

describe("132042:A:2 Croaking Crows: only a location revealed puts progress on Smaug the Golden, not one a burgle attempt discards", () => {
  lineSpec("132042:A:2", "a location revealed from the encounter deck adds progress; the same location discarded by step 1 of a burgle attempt adds none", (effects) => {
    const revealed = make({ staging: ["132040", "132042"], deck: ["place", "f0"] }, effects);
    expect(Object.values(revealBy(revealed, 0, "place").state.cards).find((card) => card.code === "132040")?.progress).toBe(1);
    const burgled = make({ staging: ["132040", "132042", "132041", "132039"], deck: ["place", "132044", "f0"], deckOf: ["01016", "01016"], hand: ["01016"], heroes: [bilbo(0)] }, effects);
    const run = resolveAndDrive(burgled, "132039", "response", { answers: ["decline"] });
    expect(codesIn(run.state, "encounterDiscard")).toEqual(["132044", "place"].sort());
    expect(Object.values(run.state.cards).find((card) => card.code === "132040")?.progress).toBe(0);
  });
});
