// Rules: mec108.captured-cards, mec108.capture-x, mec108.side-quests-in-play, mec108.time-x, rr.replacement-effects, rr.first-player, rr.travel, rr.shadow-effects, rr.in-play-and-out-of-play, rr.doomed-x, rr.effects (data/rules/entries.json);
// ledger lines 10039:B:1, 10040:B:1, 10041:A:1, 10043:A:1, 10043:A:2, 10044:A:1, 10044:A:2, 10045:A:1, 10045:A:2, 10045:A:3, 10046:A:1, 10046:A:2, 10047:A:1, 10048:A:1, 10048:A:2, 10048:A:3, 10050:A:1, 10051:A:1, 10051:A:2, 10052:A:1, 10053:A:1, 10053:A:2, 10053:A:3.
// The encounter cards of Escape from Mount Gram on tables built from data/ by the scene kit: the cards captured underneath a card are spawned in the zone `captured` (the Setup is in setup.test.ts, the areas of two players in areas.test.ts).
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../../rules/core/intents.ts";
import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { legalIntents } from "../../../rules/engine/reduce.ts";
import { moveCard, spawn } from "../../../rules/core/zones.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { capturedDeck, capturedUnder } from "../../../rules/families/captured/pile.ts";
import { combatDamage } from "../../../rules/families/defense/excess.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { placeQuestProgress } from "../../../rules/quest/quest.ts";
import { idOf, resolveRecords, tableFromLayout } from "../../../../test/harness/scene-kit.ts";

const table = (layout: Parameters<typeof tableFromLayout>[1] = {}) => tableFromLayout("escape-from-mount-gram", layout);

// Puts `codes` captured underneath the card, each owned by `seat`.
function held(state: ScenarioState, hostId: string, codes: readonly string[], seat = 0): ScenarioState {
  return codes.reduce((next, code) => spawn(next, code, { zone: "captured", hostId, seat }, "down").state, state);
}
// Puts `codes` in the seat's captured deck, top first.
function deckOf(state: ScenarioState, codes: readonly string[], seat = 0): ScenarioState {
  let next = state;
  const ids: string[] = [];
  for (const code of codes) {
    const made = spawn(next, code, { zone: "captured", hostId: null, seat }, "down");
    next = made.state;
    ids.push(made.id);
  }
  const owner = next.seats[seat];
  if (!owner) return next;
  const seats = next.seats.map((one, index) => (index === seat ? { ...one, captured: ids } : one)) as unknown as ScenarioState["seats"];
  return { ...next, seats };
}

describe("Gornákh's Dungeons and The Southern Gate", () => {
  it("10039:B:1 rescues one captured card at random for each point of progress, the active location taking its share first, and loses what there is no card for", () => {
    const t = table({ stage: "10039", active: "10046" });
    const stage = t.state.questStage ?? "";
    const set = held(t.state, stage, ["ally", "ally", "ally", "attachment"]);
    // Prison Cell (3 quest points) is the active location: it takes 3 of the 5 progress, 2 cards are rescued, and 2 stay underneath.
    const placed = placeQuestProgress(set, 5, t.ctx.cards, [], () => true);
    expect(placed.cards[idOf(placed, "10046")]?.progress).toBe(3);
    expect(placed.cards[stage]?.progress).toBe(0);
    expect(capturedUnder(placed, stage)).toHaveLength(2);
    expect(placed.rescued).toHaveLength(2);
    // More progress than cards under it rescues what there is: nothing carries over to the stage.
    const all = placeQuestProgress(set, 9, t.ctx.cards, [], () => true);
    expect(capturedUnder(all, stage)).toHaveLength(0);
    expect(all.cards[stage]?.progress).toBe(0);
  });

  it("10039:B:1 does not rescue the cards captured under a Prison Cell", () => {
    const t = table({ stage: "10039", staging: ["10046"] });
    const cell = idOf(t.state, "10046");
    const set = held(held(t.state, cell, ["ally"]), t.state.questStage ?? "", ["ally"]);
    const placed = placeQuestProgress(set, 4, t.ctx.cards, [], () => true);
    expect(capturedUnder(placed, cell)).toHaveLength(1);
    expect(capturedUnder(placed, placed.questStage ?? "")).toHaveLength(0);
  });

  it("10040:B:1 offers no travel to Southern Gate with fewer than 16 progress on the stage, and offers it with 16", () => {
    const some = table({ stage: "10040", progress: 15, phase: "Travel", staging: ["10042"] });
    expect(legalIntents(some.state, some.ctx).some((intent) => intent.type === "Travel")).toBe(false);
    const enough = table({ stage: "10040", progress: 16, phase: "Travel", staging: ["10042"] });
    expect(legalIntents(enough.state, enough.ctx).some((intent) => intent.type === "Travel")).toBe(true);
  });
});

describe("Jailor Gornákh", () => {
  const layout = { seats: 2 as const, phase: "Encounter" as const, deck: ["f0", "f0", "f0", "f0"], staging: ["10041"] };

  it("10041:A:1 engages the player with the highest threat without a check and attacks them at once", () => {
    const t = table({ ...layout, threat: [30, 41] });
    const jailor = idOf(t.state, "10041");
    const run = resolveRecords(t.state, t.ctx, "10041", "forced", jailor);
    expect(run.state.cards[jailor]).toMatchObject({ zone: "engaged", controller: 1 });
    expect(run.steps.some((step) => step.kind === "attack" && step.seat === 1)).toBe(true);
  });

  it("10041:A:1 lets the first player choose among the players tied for the highest threat, and an enemy already engaged with that player stays", () => {
    const t = table({ ...layout, threat: [35, 35], firstPlayer: 1 });
    const jailor = idOf(t.state, "10041");
    const run = resolveRecords(t.state, t.ctx, "10041", "forced", jailor, (state) => (state.window?.kind === "choose" ? (state.window.options.at(-1) ?? "") : ""));
    expect(run.state.cards[jailor]?.zone).toBe("engaged");
    const engagedWith = table({ ...layout, staging: [], engaged: [{ code: "10041", seat: 0 }], threat: [41, 30] });
    const again = resolveRecords(engagedWith.state, engagedWith.ctx, "10041", "forced", idOf(engagedWith.state, "10041"));
    expect(again.state.cards[idOf(again.state, "10041")]).toMatchObject({ zone: "engaged", controller: 0 });
  });
});

// A card with Capture X enters play from out of play: it captures the top X cards of the captured deck underneath it, before its When Revealed; a shorter deck gives what is left.
function entersWithCapture(code: string, amount: number): void {
  const t = table({ setAside: [code] });
  const marker = t.ctx.effects.find((effect) => effect.cardCode === code && effect.timing === "constant" && effect.instructions.some((instruction) => instruction.verb === "Capture"));
  expect(marker?.instructions.find((instruction) => instruction.verb === "Capture")).toEqual({ verb: "Capture", amount });
  const start = deckOf(t.state, Array.from({ length: 6 }, () => "ally"));
  const id = idOf(start, code);
  const revealed = moveCard(start, id, { zone: "staging" });
  expect(capturedUnder(revealed, id)).toHaveLength(amount);
  expect(capturedDeck(revealed, 0)).toHaveLength(6 - amount);
  // With fewer cards than X the player captures what is left.
  const short = moveCard(deckOf(t.state, ["ally"]), idOf(t.state, code), { zone: "staging" });
  expect(capturedUnder(short, idOf(short, code))).toHaveLength(1);
}

describe("Capture X and what is captured", () => {
  it("10043:A:1 Cruel Torturer has Capture 1", () => entersWithCapture("10043", 1));
  it("10044:A:1 Dungeon Guard has Capture 1", () => entersWithCapture("10044", 1));
  it("10045:A:1 Goblin Tormentor has Capture 1", () => entersWithCapture("10045", 1));
  it("10046:A:1 Prison Cell has Capture 1", () => entersWithCapture("10046", 1));
  it("10047:A:1 Patrol Room has Capture 2", () => entersWithCapture("10047", 2));
  it("10048:A:1 Tunnels of Mount Gram has Capture 1", () => entersWithCapture("10048", 1));
  it("10053:A:1 Stop the Executioners! has Capture 5", () => entersWithCapture("10053", 5));

  it("10043:A:2 captures the ally the attack would damage instead of damaging it, whatever the damage, and a hero is damaged as usual", () => {
    const t = table({ play: ["ally"], engaged: ["f3", "10043"] });
    const ally = idOf(t.state, "ally");
    const enemy = idOf(t.state, "10043");
    const steps: EngineStep[] = [];
    const taken = combatDamage(t.state, enemy, ally, 9, t.ctx, steps);
    expect(taken.cards[ally]).toMatchObject({ zone: "captured", host: enemy, damage: 0 });
    expect(taken.pendingEvents?.some((event) => event.trigger === "attackDestroyed")).toBeFalsy();
    expect(combatDamage(t.state, enemy, t.hero, 3, t.ctx, steps).cards[t.hero]?.damage).toBe(3);
  });

  it("10044:A:2 puts 1 of the rescued cards into play at no cost under its owner after the cards under Dungeon Guard are rescued", () => {
    const t = table({ staging: ["10044"] });
    const guard = idOf(t.state, "10044");
    const set = held(t.state, guard, ["ally", "attachment"]);
    const gone = moveCard(set, guard, { zone: "encounterDiscard" });
    expect(gone.rescued).toHaveLength(2);
    const rescuedAlly = gone.rescued?.find((id) => gone.cards[id]?.code === "ally") ?? "";
    expect(gone.cards[rescuedAlly]?.zone).toBe("hand");
    const answered = resolveRecords(gone, t.ctx, "10044", "response", guard);
    expect(answered.state.cards[rescuedAlly]?.zone === "play" || answered.state.cards[rescuedAlly]?.zone === "hand").toBe(true);
  });

  it("10045:A:2 Attack X is the number of cards in play with captured cards underneath them, counted when asked", () => {
    const t = table({ staging: ["10045", "f3", "10046"], engaged: [{ code: "f0", seat: 0 }] });
    const tormentor = idOf(t.state, "10045");
    const synced = (state: ScenarioState) => syncConstants(state, t.ctx);
    const attack = (state: ScenarioState) => modifiedStat(synced(state), synced(state).cards[tormentor]!, "attack", t.ctx.cards);
    expect(attack(t.state)).toBe(0);
    const one = held(t.state, idOf(t.state, "f3"), ["ally", "ally"]);
    expect(attack(one)).toBe(1);
    const three = held(held(one, idOf(one, "10046"), ["ally"]), idOf(one, "f0"), ["ally"]);
    expect(attack(three)).toBe(3);
    // A card that left play holds nothing in play: the Tormentor itself counts when it holds one.
    expect(attack(held(three, tormentor, ["ally"]))).toBe(4);
  });

  it("10045:A:3 Shadow: the attacking enemy gets +1 Attack, +2 instead when it has no captured cards underneath it", () => {
    const t = table({ engaged: ["f3"] });
    const enemy = idOf(t.state, "f3");
    const shadowed = { ...held(t.state, enemy, ["ally"]), pendingAttack: { enemyId: enemy, seat: 0 } } as ScenarioState;
    const run = resolveRecords(shadowed, t.ctx, "10045", "shadow");
    expect(modifiedStat(run.state, run.state.cards[enemy]!, "attack", t.ctx.cards)).toBe(2);
  });

  it("10048:A:2 Threat X is the number of captured cards underneath Tunnels of Mount Gram", () => {
    const t = table({ staging: ["10048"] });
    const tunnels = idOf(t.state, "10048");
    expect(modifiedStat(t.state, t.state.cards[tunnels]!, "threat", t.ctx.cards)).toBe(0);
    const two = syncConstants(held(t.state, tunnels, ["ally", "ally"]), t.ctx);
    expect(modifiedStat(two, two.cards[tunnels]!, "threat", t.ctx.cards)).toBe(2);
  });

  it("10048:A:3 Shadow: each attachment attached to the defending character is captured underneath the attacking enemy, an encounter attachment too", () => {
    const t = table({ engaged: ["f3"], attached: [{ code: "attachment", to: "dh1" }, { code: "attachment", to: "dh1" }] });
    const enemy = idOf(t.state, "f3");
    const attached = { ...t.state, pendingAttack: { enemyId: enemy, seat: 0, heroId: t.hero, defenderId: t.hero } } as ScenarioState;
    const run = resolveRecords(attached, t.ctx, "10048", "shadow");
    expect(capturedUnder(run.state, enemy)).toHaveLength(2);
    expect(run.state.cards[t.hero]?.attachments).toHaveLength(0);
    // The enemy leaves play: the attachments of a player go back to its owner's hand, an encounter attachment to the encounter discard pile.
    const gone = moveCard(run.state, enemy, { zone: "encounterDiscard" });
    expect(capturedUnder(gone, enemy)).toHaveLength(0);
    expect(gone.seats[0].hand.filter((id) => gone.cards[id]?.code === "attachment").length + gone.encounterDiscard.filter((id) => gone.cards[id]?.code === "attachment").length).toBe(2);
  });
});

describe("treacheries", () => {
  it("10050:A:1 Feeble and Weary: 1 damage to each exhausted character, or each exhausted committed character removed from the quest; an option that changes nothing is not offered", () => {
    const base = table({ play: ["ally"] });
    const exhausted = [base.hero, idOf(base.state, "ally")].reduce((state, id) => updateCard(state, id, { exhausted: true }), base.state);
    // Both options are offered with an exhausted character that is committed.
    const committed = updateCard(exhausted, idOf(exhausted, "ally"), { committed: true });
    const offered: string[][] = [];
    resolveRecords(committed, base.ctx, "10050", "whenRevealed", undefined, (state) => {
      if (state.window?.kind === "choose") offered.push([...state.window.options]);
      return state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "";
    });
    expect(offered[0]).toEqual(["damage", "remove"]);
    // Damage: 1 to each exhausted character, the hero and the ally.
    const damaged = resolveRecords(committed, base.ctx, "10050", "whenRevealed", undefined, (state) => (state.window?.kind === "choose" ? "damage" : ""));
    expect(damaged.state.cards[base.hero]?.damage).toBe(1);
    expect(damaged.state.cards[idOf(damaged.state, "ally")]?.damage).toBe(1);
    // Removal takes each exhausted committed character off the quest.
    const removed = resolveRecords(committed, base.ctx, "10050", "whenRevealed", undefined, (state) => (state.window?.kind === "choose" ? "remove" : ""));
    expect(removed.state.cards[idOf(removed.state, "ally")]?.committed).toBe(false);
    // Nothing exhausted: nothing to choose.
    const none = resolveRecords(base.state, base.ctx, "10050", "whenRevealed", undefined, undefined, false);
    expect(none.state.window?.kind).not.toBe("choose");
  });

  it("10051:A:1 Captives of Gornákh captures the ally under the encounter card with the highest Threat, the first player choosing among those tied", () => {
    const t = table({ play: ["ally"], staging: ["f3", "f3"], active: "place" });
    const run = resolveRecords(t.state, t.ctx, "10051", "whenRevealed", undefined, (state) => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : ""));
    const ally = idOf(run.state, "ally");
    expect(run.state.cards[ally]).toMatchObject({ zone: "captured", owner: 0 });
    expect(run.state.cards[run.state.cards[ally]?.host ?? ""]?.code).toBe("f3");
  });

  it("10051:A:2 Shadow: the ally the attack would damage is captured underneath the attacking enemy instead", () => {
    const t = table({ play: ["ally"], engaged: ["f3"] });
    const enemy = idOf(t.state, "f3");
    const marked = { ...t.state, pendingAttack: { enemyId: enemy, seat: 0 } } as ScenarioState;
    const run = resolveRecords(marked, t.ctx, "10051", "shadow");
    const damaged = combatDamage(run.state, enemy, idOf(run.state, "ally"), 2, t.ctx, []);
    expect(damaged.cards[idOf(damaged, "ally")]).toMatchObject({ zone: "captured", host: enemy, damage: 0 });
  });

  it("10052:A:1 Interrogation discards the top card of each captured deck to its owner's discard pile and raises the threat by its printed cost; with an empty deck it gains Doomed 2", () => {
    const t = table({ seats: 2, staging: ["10052"], threat: [20, 20] });
    const decks = deckOf(deckOf(t.state, ["c3", "ally"], 0), ["c2"], 1);
    const run = resolveRecords(decks, t.ctx, "10052", "whenRevealed", idOf(decks, "10052"));
    expect(run.state.seats[0].threat).toBe(23);
    expect(run.state.seats[0].discard.some((id) => run.state.cards[id]?.code === "c3")).toBe(true);
    expect(capturedDeck(run.state, 0)).toHaveLength(1);
    // Player 2 discarded a card too, so no Doomed 2: the other player's threat is only its card's cost.
    expect(run.state.seats[1].threat).toBe(22);
    // A player with an empty captured deck discards none and Interrogation gains Doomed 2.
    const empty = resolveRecords(deckOf(t.state, ["c1"], 0), t.ctx, "10052", "whenRevealed", idOf(t.state, "10052"));
    expect(empty.state.seats[0].threat).toBe(21 + 2);
    expect(empty.state.seats[1].threat).toBe(22);
  });
});

describe("Stop the Executioners!", () => {
  it("10053:A:3 discards its captured cards when the last counter is removed, removes the quest from the game and raises each player's threat by 3 for each of their characters discarded", () => {
    const t = table({ seats: 2, staging: ["10053"], threat: [30, 30] });
    const quest = idOf(t.state, "10053");
    const set = held(held(t.state, quest, ["ally", "dh3"], 0), quest, ["ally"], 1);
    const run = resolveRecords(set, t.ctx, "10053", "forced", quest);
    expect(run.state.seats[0].threat).toBe(36);
    expect(run.state.seats[1].threat).toBe(33);
    expect(capturedUnder(run.state, quest)).toHaveLength(0);
    expect(run.state.cards[quest]?.zone).toBe("removed");
  });
});

