// Rules: hob.bilbo-baggins-ohauh, hob.baggins-sphere-ohauh, hob.bilbo-multiplayer-ohauh, rr.search, rr.cost, rr.action, rr.travel, rr.delayed-effects, rr.victory (data/rules/entries.json); docs/scenarios/the-hobbit.md (Over the Misty Mountains Grim).
// The lines a card-spec row cannot say (spec.test.ts holds the rest): a shuffle and the order of a deck, a cost paid from Bilbo's pool and who may pay it, the travel the players are left, an effect that waits for the next quest phase. 131026:A:1, 131026:B:1,
// 131028:B:2, 131028:B:3, 131066:A:2, 131067:A:2, 131068:A:1, 131073:A:1.
import { chai, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import { IntentRefused } from "../../../../test/harness/scene.ts";
import { answer, endPhase, endRound, resolve, withoutLine } from "../../../../test/harness/card-spec.ts";
import { playedLayout } from "../../../../test/harness/card-spec-play.ts";
import { finish, idOf, legalIntents, legalTargets, resolveRecords, send, start, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { spentThisRound } from "../../../rules/families/costs/pay.ts";
import { updateCard } from "../../../rules/core/state.ts";
import { spawn } from "../../../rules/core/zones.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import type { Effect } from "../../../catalog/boundary.ts";
import type { PlayerIntent } from "../../../rules/engine/reduce.ts";

const ID = "over-the-misty-mountains-grim";

// A printed line as one test (as test/harness/line-spec.ts does in two): `check` passes on every record and fails, with a failed expectation or a refused intent, without the records of the line.
// The title starts with the line id, which scripts/checks/spec-coverage.test.ts reads from an `it(` call.
function holdsOnlyWith(line: string, check: (effects: readonly Effect[]) => void): void {
  check(EFFECTS);
  let thrown: unknown = null;
  try {
    check(withoutLine(EFFECTS, line));
  } catch (error) {
    thrown = error;
  }
  if (thrown == null) throw new Error(`${line}: the check passes without its records, so it tests nothing`);
  if (!(thrown instanceof chai.AssertionError) && !(thrown instanceof IntentRefused)) throw new Error(`${line}: the check threw something other than a failed expectation or a refused intent`, { cause: thrown });
}
const BILBO = "131001";
const table = (layout: Layout, effects: readonly Effect[]) => tableFromLayout(ID, { stage: "131027", ...layout }, { effects });
const DECK = ["c0", "c1", "c2", "c3", "ally", "event", "filler", "c0", "c1", "c2", "c3", "ally"] as const;

it("131026:A:1 the Setup shuffles the encounter deck", () => holdsOnlyWith("131026:A:1", (effects) => {
  const made = table({ stage: "131026", deck: [...DECK] }, effects);
  const before = [...made.state.encounterDeck];
  const run = resolveRecords(made.state, made.ctx, "131026", "setup", idOf(made.state, "131026"));
  expect(run.state.encounterDeck).toHaveLength(before.length);
  expect(run.state.encounterDeck).not.toEqual(before);
}));

it("131026:B:1 the deck is shuffled when the player searched it, not when he declined", () => holdsOnlyWith("131026:B:1", (effects) => {
  const layout = { stage: "131026", deckOf: [...DECK, "131020"] } satisfies Layout;
  const made = table(layout, effects);
  const before = [...made.state.seats[0]!.deck];
  const declined = playedLayout(ID, layout, [resolve("131026", "whenRevealed"), answer("decline")], effects, true).run.state;
  expect(declined.seats[0]!.deck).toEqual(before);
  const searched = playedLayout(ID, layout, [resolve("131026", "whenRevealed"), answer("search")], effects, true).run.state;
  const rest = before.filter((id) => state0(searched, id) === "deck");
  expect(searched.seats[0]!.deck).toHaveLength(rest.length);
  expect(searched.seats[0]!.deck).not.toEqual(rest);
}));
const state0 = (state: { cards: Record<string, { zone: string }> }, id: string): string | undefined => state.cards[id]?.zone;

// A card that reads which heroes spent resources this round (Tighten Our Belts) shows the X resources Bilbo pays are spent, not discarded (131028:B:2).
const HEARS_SPENT: Effect = { id: "test:forced:1", cardCode: "f3", lines: [], timing: "forced", trigger: "endOfRound", instructions: [{ verb: "HeroesGainResources", amount: 1, unspent: true }] };
it("131028:B:2 the resources Bilbo may spend are spent, so an effect that hears resources spent hears them", () => holdsOnlyWith("131028:B:2", (effects) => {
  const made = withBilbo(table({ stage: "131028", staging: ["f3"], setAside: ["131063", "131058", "131058", "131058", "131058", "131058"] }, [...effects, HEARS_SPENT]), 3);
  const bilbo = idOf(made.state, BILBO);
  const run = resolveRecords(made.state, made.ctx, "131028", "whenRevealed", idOf(made.state, "131028"), (state) => (state.window?.kind === "choose" ? (state.window.options.find((option) => option === "x2") ?? "") : ""));
  expect(made.state.cards[bilbo]?.resources).toBe(3);
  expect(run.state.cards[bilbo]?.resources).toBe(1);
  expect(spentThisRound(run.state, bilbo)).toBe(true);
}));

it("131028:B:3 defeating the last stage wins the game", () => {
  const made = table({ stage: "131028", progress: 18, victory: ["131063"], deck: ["f0"] }, tableEffects());
  const asked = send(start(made.state), { type: "Commit", cardIds: [made.hero, made.hero2] }, made.ctx);
  let run = send(asked, { type: "Pass" }, made.ctx);
  for (let guard = 0; guard < 12 && !run.state.stageCleared && !run.state.lost; guard += 1) {
    const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass");
    if (!pass) break;
    run = send(run, pass, made.ctx);
  }
  expect(run.state.stageCleared).toBe(true);
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

it("131068:A:1 the Action costs 1 Baggins resource, adds 1 of the top 2 cards of the deck to the hand and discards the other", () => holdsOnlyWith("131068:A:1", (effects) => {
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
}));

it("131066:A:2 the first player pays 2 Baggins resources from Bilbo's pool, and no other player may", () => holdsOnlyWith("131066:A:2", (effects) => {
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
}));

it("131067:A:2 with The Great Goblin in the victory display the players travel to Great Cavern Room and to no other location", () => holdsOnlyWith("131067:A:2", (effects) => {
  const travels = (victory: readonly string[]): string[] => {
    const made = table({ phase: "Travel", staging: ["131067", "131066"], victory }, effects);
    return legalTargets(made.state, { type: "Travel" }, made.ctx).map((id) => made.state.cards[id]?.code ?? "").sort();
  };
  expect(travels(["131063"])).toEqual(["131067"]);
  expect(travels([])).toEqual(["131066", "131067"]);
}));

it("131073:A:1 revealed outside the quest phase, the Stone-Giant engages at the end of the next quest phase, not at the end of that phase", () => holdsOnlyWith("131073:A:1", (effects) => {
  const made = playedLayout(ID, { stage: "131027", phase: "Encounter", staging: ["131064"] }, [resolve("131073", "whenRevealed"), endPhase], effects);
  expect(made.run.state.cards[idOf(made.run.state, "131064")]?.zone).toBe("staging");
  const next = playedLayout(ID, { stage: "131027", phase: "Encounter", staging: ["131064"] }, [resolve("131073", "whenRevealed"), endPhase, endRound], effects);
  expect(next.run.state.cards[idOf(next.run.state, "131064")]?.zone).toBe("engaged");
}));

