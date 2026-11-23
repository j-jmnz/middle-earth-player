// Rules: hob.bilbo-baggins-ohauh, hob.baggins-sphere-ohauh, hob.bilbo-multiplayer-ohauh, rr.search, rr.cost, rr.action, rr.travel, rr.delayed-effects, rr.victory (data/rules/entries.json); docs/scenarios/the-hobbit.md (Over the Misty Mountains Grim).
// The lines a card-spec row cannot say (spec.test.ts holds the rest): a shuffle and the order of a deck, a cost paid from Bilbo's pool and who may pay it, the travel the players are left, an effect that waits for the next quest phase. 131026:A:1, 131026:B:1,
// 131028:B:2, 131028:B:3, 131066:A:2, 131067:A:2, 131068:A:1, 131073:A:1.
import { describe, expect, it } from "vitest";

import { answer, endPhase, endRound, resolve } from "../../../../test/harness/card-spec.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { playedLayout } from "../../../../test/harness/card-spec-play.ts";
import { finish, idOf, legalIntents, legalTargets, resolveRecords, send, start, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { spentThisRound } from "../../../rules/families/costs/pay.ts";
import { updateCard } from "../../../rules/core/state.ts";
import { spawn } from "../../../rules/core/zones.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import type { Effect } from "../../../catalog/boundary.ts";
import type { PlayerIntent } from "../../../rules/engine/reduce.ts";

const ID = "over-the-misty-mountains-grim";

const BILBO = "131001";
const table = (layout: Layout, effects: readonly Effect[]) => tableFromLayout(ID, { stage: "131027", ...layout }, { effects });
const DECK = ["c0", "c1", "c2", "c3", "ally", "event", "filler", "c0", "c1", "c2", "c3", "ally"] as const;

lineSpec("131026:A:1", "the Setup shuffles the encounter deck", (effects) => {
  const made = table({ stage: "131026", deck: [...DECK] }, effects);
  const before = [...made.state.encounterDeck];
  const run = resolveRecords(made.state, made.ctx, "131026", "setup", idOf(made.state, "131026"));
  expect(run.state.encounterDeck).toHaveLength(before.length);
  expect(run.state.encounterDeck).not.toEqual(before);
});

lineSpec("131026:B:1", "the deck is shuffled when the player searched it, not when he declined", (effects) => {
  const layout = { stage: "131026", deckOf: [...DECK, "131020"] } satisfies Layout;
  const made = table(layout, effects);
  const before = [...made.state.seats[0]!.deck];
  const declined = playedLayout(ID, layout, [resolve("131026", "whenRevealed"), answer("decline")], effects, true).run.state;
  expect(declined.seats[0]!.deck).toEqual(before);
  const searched = playedLayout(ID, layout, [resolve("131026", "whenRevealed"), answer("search")], effects, true).run.state;
  const rest = before.filter((id) => state0(searched, id) === "deck");
  expect(searched.seats[0]!.deck).toHaveLength(rest.length);
  expect(searched.seats[0]!.deck).not.toEqual(rest);
});
const state0 = (state: { cards: Record<string, { zone: string }> }, id: string): string | undefined => state.cards[id]?.zone;

// A card that reads which heroes spent resources this round (Tighten Our Belts) shows the X resources Bilbo pays are spent, not discarded (131028:B:2).
const HEARS_SPENT: Effect = { id: "test:forced:1", cardCode: "f3", lines: [], timing: "forced", trigger: "endOfRound", instructions: [{ verb: "HeroesGainResources", amount: 1, unspent: true }] };
lineSpec("131028:B:2", "the resources Bilbo may spend are spent, so an effect that hears resources spent hears them", (effects) => {
  const made = withBilbo(table({ stage: "131028", staging: ["f3"], setAside: ["131063", "131058", "131058", "131058", "131058", "131058"] }, [...effects, HEARS_SPENT]), 3);
  const bilbo = idOf(made.state, BILBO);
  const run = resolveRecords(made.state, made.ctx, "131028", "whenRevealed", idOf(made.state, "131028"), (state) => (state.window?.kind === "choose" ? (state.window.options.find((option) => option === "x2") ?? "") : ""));
  expect(made.state.cards[bilbo]?.resources).toBe(3);
  expect(run.state.cards[bilbo]?.resources).toBe(1);
  expect(spentThisRound(run.state, bilbo)).toBe(true);
});

it("131028:B:3 defeating the last stage wins the game", () => {
  const made = table({ stage: "131028", progress: 18, victory: ["131063"], deck: ["f0"] }, tableEffects());
  const asked = send(start(made.state), { type: "Commit", cardIds: [made.hero, made.hero2] }, made.ctx);
  let run = send(asked, { type: "Pass" }, made.ctx);
  for (let guard = 0; guard < 12 && !run.state.stageCleared && !run.state.lost; guard += 1) {
    const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass");
    if (!pass) break;
    run = send(run, pass, made.ctx);
  }
  // The game is won: the stage is cleared, nothing was lost and no rule failed on the way.
  expect(run.state.stageCleared).toBe(true);
  expect(run.state.lost).toBe(false);
  expect(run.state.failure).toBeFalsy();
});
function tableEffects(): readonly Effect[] {
  return tableFromLayout(ID, { stage: "131027" }).ctx.effects;
}

// Bilbo is dealt by the loadout, a hero of the first seat in front of the others: the layout puts a card in play, so he is moved to the heroes zone with his pool.
function withBilbo(made: ReturnType<typeof table>, resources: number): ReturnType<typeof table> {
  const spawned = spawn(made.state, BILBO, { zone: "heroes", seat: 0 });
  return { ...made, state: syncConstants(updateCard(spawned.state, spawned.id, { resources }), made.ctx) };
}

type Trigger = Extract<PlayerIntent, { type: "Trigger" }>;
// The Action of the card the table offers the active seat, or undefined when none is offered.
function offered(made: ReturnType<typeof table>, code: string): Trigger | undefined {
  const id = idOf(made.state, code);
  return legalIntents(made.state, made.ctx).find((intent): intent is Trigger => intent.type === "Trigger" && intent.cardId === id);
}
const paying = (intent: Trigger | undefined, heroId: string, amount: number): Trigger => ({ ...(intent as Trigger), payments: [{ heroId, amount }] });

lineSpec("131068:A:1", "the Action costs 1 Baggins resource, adds 1 of the top 2 cards of the deck to the hand and discards the other", (effects) => {
  const layout = { active: "131068", deckOf: ["c1", "c2", "c3"] } satisfies Layout;
  const made = withBilbo(table(layout, effects), 1);
  const bilbo = idOf(made.state, BILBO);
  const paid = finish(send(start(made.state), paying(offered(made, "131068"), bilbo, 1), made.ctx), made.ctx);
  const zones = Object.values(paid.state.cards).filter((card) => ["c1", "c2", "c3"].includes(card.code)).map((card) => card.zone).sort();
  expect(zones).toEqual(["deck", "discard", "hand"]);
  expect(paid.state.cards[bilbo]?.resources).toBe(0);
  // Without a card in the deck there is nothing to look at: the Action is not offered, and 1 resource is not paid for nothing.
  expect(offered(withBilbo(table({ ...layout, deckOf: [] }, effects), 1), "131068")).toBeUndefined();
  // The Action of a location is any player's, but the second player holds no Baggins resource: Bilbo's pool, the first player's, does not pay for him.
  const two = withBilbo(table({ ...layout, seats: 2 }, effects), 1);
  expect(offered(two, "131068")).toBeDefined();
  expect(offered({ ...two, state: { ...two.state, activeSeat: 1 } }, "131068")).toBeUndefined();
});

const blanked = (state: { modifiers: readonly { stat: string; instanceId: string }[] }, id: string): boolean => state.modifiers.some((modifier) => modifier.stat === "blankText" && modifier.instanceId === id);

const threatOf = (done: ReturnType<typeof playedLayout>, code: string): number => modifiedStat(done.run.state, done.run.state.cards[idOf(done.run.state, code)]!, "threat", done.table.cards);

describe("131071:A:1 the +1 Threat ends at the end of the phase and a second reveal does not add it again", () => {
  lineSpec("131071:A:1", "the +1 Threat holds only after enemies returned (rr.then), lasts to the end of the phase and is not given again by a second reveal with none engaged", (effects) => {
    const layout = { stage: "131027", phase: "Quest", staging: ["131058"], engaged: ["f3"] } satisfies Layout;
    const once = playedLayout(ID, layout, resolve("131071", "whenRevealed"), effects, true);
    expect(threatOf(once, "131058")).toBe(3);
    // With no enemy engaged the part before "then" resolves nothing: no Goblin gets +1 Threat.
    const none = playedLayout(ID, { ...layout, engaged: [] }, [resolve("131071", "whenRevealed")], effects, true);
    expect(threatOf(none, "131058")).toBe(2);
    // A second reveal in the phase finds no engaged enemy left: the first +1 stays and no second one is added.
    expect(threatOf(playedLayout(ID, layout, [resolve("131071", "whenRevealed"), resolve("131071", "whenRevealed")], effects, true), "131058")).toBe(3);
    // The end of the phase ends the +1 Threat.
    expect(threatOf(playedLayout(ID, layout, [resolve("131071", "whenRevealed"), endPhase], effects, true), "131058")).toBe(2);
  });
});

describe("131066:A:2 the blank ends at the end of the round and the Action is not offered a second time before it", () => {
  lineSpec("131066:A:2", "the text is blank until the end of the round, so the Action is not offered a second time in the round and is offered again in the next round", (effects) => {
    const layout = { active: "131066", phase: "Quest" } satisfies Layout;
    const made = withBilbo(table(layout, effects), 4);
    const porch = idOf(made.state, "131066");
    const first = finish(send(start(made.state), paying(offered(made, "131066"), idOf(made.state, BILBO), 2), made.ctx), made.ctx);
    expect(blanked(first.state, porch)).toBe(true);
    // Blank, the card has no Action: with 2 Baggins resources left it is not offered again this round.
    expect(offered({ ...made, state: first.state }, "131066")).toBeUndefined();
    // The end of the round ends the blank.
    const done = playedLayout(ID, layout, [resolve("131066", "action"), ...Array.from({ length: 7 }, () => endPhase)], effects, true);
    expect(blanked(done.run.state, idOf(done.run.state, "131066"))).toBe(false);
    expect(blanked(playedLayout(ID, layout, [resolve("131066", "action")], effects, true).run.state, porch)).toBe(true);
  });
});

lineSpec("131066:A:2", "the first player pays 2 Baggins resources from Bilbo's pool, and no other player may", (effects) => {
  const layout = { active: "131066" } satisfies Layout;
  const made = withBilbo(table(layout, effects), 2);
  const bilbo = idOf(made.state, BILBO);
  const paid = send(start(made.state), paying(offered(made, "131066"), bilbo, 2), made.ctx);
  expect(paid.state.cards[bilbo]?.resources).toBe(0);
  // One resource is too little.
  expect(offered(withBilbo(table(layout, effects), 1), "131066")).toBeUndefined();
  // The second player, who is not the first player and controls no Baggins hero, is not offered it.
  const two = withBilbo(table({ ...layout, seats: 2 }, effects), 2);
  expect(offered({ ...two, state: { ...two.state, activeSeat: 1 } }, "131066")).toBeUndefined();
});

lineSpec("131067:A:2", "with The Great Goblin in the victory display the players travel to Great Cavern Room and to no other location", (effects) => {
  const travels = (victory: readonly string[]): string[] => {
    const made = table({ phase: "Travel", staging: ["131067", "131066"], victory }, effects);
    return legalTargets(made.state, { type: "Travel" }, made.ctx).map((id) => made.state.cards[id]?.code ?? "").sort();
  };
  expect(travels(["131063"])).toEqual(["131067"]);
  expect(travels([])).toEqual(["131066", "131067"]);
});

lineSpec("131073:A:1", "revealed outside the quest phase, the Stone-Giant engages at the end of the next quest phase, not at the end of that phase", (effects) => {
  const made = playedLayout(ID, { stage: "131027", phase: "Encounter", staging: ["131064"] }, [resolve("131073", "whenRevealed"), endPhase], effects);
  expect(made.run.state.cards[idOf(made.run.state, "131064")]?.zone).toBe("staging");
  const next = playedLayout(ID, { stage: "131027", phase: "Encounter", staging: ["131064"] }, [resolve("131073", "whenRevealed"), endPhase, endRound], effects);
  expect(next.run.state.cards[idOf(next.run.state, "131064")]?.zone).toBe("engaged");
});


// The delayed Pick reads the chosen Stone-Giant again at the end of the quest phase: one that left the staging area engages nobody and no tie is asked.
lineSpec("131073:A:1", "the chosen Stone-Giant engages only while it is still in the staging area", (effects) => {
  const layout = { stage: "131028", side: "A", seats: 2, threat: [30, 35], phase: "Quest", staging: ["131064"], deck: ["f0"], setAside: ["131063"] } satisfies Layout;
  const stays = playedLayout(ID, layout, [resolve("131073", "whenRevealed"), endPhase], effects).run.state;
  expect(stays.cards[idOf(stays, "131064")]?.zone).toBe("engaged");
  const tied = { ...layout, threat: [30, 30] } satisfies Layout;
  const leaves = playedLayout(ID, tied, [resolve("131073", "whenRevealed"), resolve("131028", "whenRevealed"), endPhase], effects).run.state;
  expect(leaves.cards[idOf(leaves, "131064")]?.zone).not.toBe("engaged");
  expect(leaves.window?.kind).not.toBe("choose");
});
