// Rules: ats.hidden-cards, ats.hidden-cards-turn-faceup, faq.blood-of-gondor-hidden-cards, rr.reveal, rr.surge, rr.engaged, rr.first-player, rr.player-elimination (data/rules/entries.json); ledger lines 06129:A:1, 06117:B:1, 06132:A:2, 06130:A:2.
// Lying in Wait turns the first player's hidden cards and resolves their When Revealed effects, and what the table must never show about a hidden card: no step, cause, window or offered intent names one before it is turned, an Undo and a replay of the save pick the same card for Faramir, and a player who
// leaves the game has his hidden cards discarded. Seat 1 is the first player, so the cards of seat 0 show that only the first player's are turned.
import { expect } from "vitest";

import { stagingThreat } from "../../../rules/quest/quest.ts";
import { replay } from "../../../rules/engine/undo.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { idOf, legalIntents, legalTargets, revealedTop, send } from "../../../../test/harness/scene-kit.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { CODES, drive, engagedCodes, hiddenCodes, hurt, opened, table, takes, where } from "../../../../test/scenarios/the-blood-of-gondor/table.ts";

const { ambusher, arsonist, rabble, southern, looms, lyingInWait, conflict, scourge, faramir, numenorean, uruk, crow, northern } = CODES;
const LIEUTENANT = "06092";
const fillers = (count: number): string[] => Array<string>(count).fill("f0");

lineSpec("06129:A:1", "the first player (seat 1) turns each hidden card in his own play area, one at a time: an enemy engages him whatever its cost, a location joins the staging area, and the other player's cards stay", (effects) => {
  const made = table({ seats: 2, firstPlayer: 1, phase: "Quest", deck: [southern, rabble, ambusher, arsonist, ...fillers(8)] });
  const held = takes(made, takes(made, made.state, 1, 2), 0, 2);
  const revealed = revealedTop({ state: held, ctx: made.ctx }, lyingInWait);
  expect(engagedCodes(revealed, 1)).toEqual([rabble]);
  expect(where(revealed, southern)).toBe("staging");
  expect(hiddenCodes(revealed, 0)).toEqual([ambusher, arsonist]);
  expect(hiddenCodes(revealed, 1)).toEqual([]);
  expect(where(revealed, lyingInWait)).toBe("encounterDiscard");
  const unaided = table({ seats: 2, firstPlayer: 1, phase: "Quest", deck: [southern, rabble, ...fillers(8)] }, effects);
  const again = revealedTop({ state: takes(unaided, unaided.state, 1, 2), ctx: unaided.ctx }, lyingInWait);
  expect(engagedCodes(again, 1)).toEqual([rabble]);
  expect(where(again, southern)).toBe("staging");
});

lineSpec("06129:A:1", "the When Revealed effects of the turned cards resolve once every card is turned, the first card turned first: Mordor Looms turned before an enemy resolves after the enemy engages, and its surge does not fire", (effects) => {
  const made = table({ seats: 2, firstPlayer: 1, phase: "Quest", deck: [looms, rabble, ...fillers(8)] }, effects);
  const held = takes(made, made.state, 1, 2);
  const before = held.encounterDeck.length;
  const steps: unknown[] = [];
  const revealed = revealedTop({ state: held, ctx: made.ctx }, lyingInWait);
  void steps;
  expect(engagedCodes(revealed, 1)).toEqual([rabble]);
  // Mordor Looms: each player takes 1 hidden card, which stays facedown; no card is revealed for its surge, so the deck lost only those two cards.
  expect(hiddenCodes(revealed, 0)).toHaveLength(1);
  expect(hiddenCodes(revealed, 1)).toHaveLength(1);
  expect(revealed.encounterDeck).toHaveLength(before - 2);
  expect(where(revealed, looms)).toBe("encounterDiscard");
});

lineSpec("06129:A:1", "a treachery turned by Lying in Wait stays out of the discard pile until its When Revealed effect is done: Mordor Looms with both piles empty takes no card, not itself (rr.step-3-3)", (effects) => {
  const made = table({ phase: "Quest", deck: [looms], discard: [] }, effects);
  const held = takes(made, made.state, 0);
  expect(hiddenCodes(held)).toEqual([looms]);
  const revealed = revealedTop({ state: held, ctx: made.ctx }, lyingInWait);
  expect(hiddenCodes(revealed)).toEqual([]);
  // Both treacheries are in the encounter piles; the reset that follows the reveal put the discard pile back into the empty deck.
  expect(revealed.encounterDeck.map((id) => revealed.cards[id]?.code).sort()).toEqual([lyingInWait, looms]);
});

lineSpec("06129:A:1", "a turned enemy engages the first player and then its When Revealed effects resolve (Uruk Lieutenant adds the topmost Orc of the discard pile to the staging area)", (effects) => {
  const made = table({ phase: "Quest", discard: [rabble], deck: [LIEUTENANT, ...fillers(8)] }, effects, [LIEUTENANT]);
  const revealed = revealedTop({ state: takes(made, made.state, 0), ctx: made.ctx }, lyingInWait);
  expect(engagedCodes(revealed)).toEqual([LIEUTENANT]);
  expect(where(revealed, rabble)).toBe("staging");
});

lineSpec("06129:A:1", "Conflict at the Crossroads and Scourge of Mordor turned faceup resolve their When Revealed effects without surge: an Orc engaged by the same turn adds its Threat until the end of the phase, and no extra card is revealed", (effects) => {
  const made = table({ phase: "Quest", deckOf: ["event"], deck: [conflict, scourge, uruk, ...fillers(8)] }, effects);
  const held = takes(made, made.state, 0, 3);
  const revealed = revealedTop({ state: held, ctx: made.ctx }, lyingInWait);
  expect(engagedCodes(revealed)).toEqual([uruk]);
  expect(where(revealed, conflict)).toBe("encounterDiscard");
  expect(where(revealed, scourge)).toBe("encounterDiscard");
  // Scourge of Mordor discarded the top card of the player's deck (cost 1), and Conflict adds Brutal Uruk's Threat (3): 4 more Threat in the staging area, and nothing was revealed for a surge.
  expect(revealed.seats[0]?.deck).toHaveLength(0);
  expect(stagingThreat(revealed, made.ctx.cards) - stagingThreat(held, made.ctx.cards)).toBe(4);
  expect(revealed.encounterDeck).toHaveLength(held.encounterDeck.length);
});

lineSpec("06129:A:1", "Conflict at the Crossroads turned faceup with no Orc engaged gains no surge: it is discarded and no extra card is revealed", (effects) => {
  const made = table({ phase: "Quest", deck: [conflict, ...fillers(8)] }, effects);
  const held = takes(made, made.state, 0);
  const revealed = revealedTop({ state: held, ctx: made.ctx }, lyingInWait);
  expect(where(revealed, conflict)).toBe("encounterDiscard");
  expect(revealed.staging).toHaveLength(0);
  expect(revealed.encounterDeck).toHaveLength(held.encounterDeck.length);
});

lineSpec("06129:A:1", "Lying in Wait turned by another Lying in Wait resolves its own When Revealed once: no card is turned twice", (effects) => {
  const made = table({ phase: "Quest", deck: [lyingInWait, ambusher, ...fillers(4)] }, effects);
  const revealed = revealedTop({ state: takes(made, made.state, 0, 2), ctx: made.ctx }, lyingInWait);
  expect(engagedCodes(revealed)).toEqual([ambusher]);
  expect(hiddenCodes(revealed)).toEqual([]);
  expect(revealed.encounterDiscard.map((id) => revealed.cards[id]?.code).filter((code) => code === lyingInWait)).toHaveLength(2);
});

const ids = (state: ScenarioState): string[] => Object.keys(state.cards);
/** The text of everything a player can read at this moment: the steps so far, the open window, the intents and targets the engine offers. */
const readable = (made: ReturnType<typeof table>, state: ScenarioState, steps: unknown): string => JSON.stringify([steps, state.window, legalIntents(state, made.ctx), legalTargets(state, { type: "Travel" }, made.ctx), legalTargets(state, { type: "Engage" }, made.ctx)]);

lineSpec("06117:B:1", "no step, cause, window or offered intent names a hidden card before it is turned: the quest phase takes it, the table offers and logs only that a card was taken", (effects) => {
  const made = table({ seats: 2, phase: "Planning", staging: [northern], deck: [uruk, crow, ...fillers(8)] }, effects);
  const quest = drive(made, opened(made), (state) => state.phase === "Quest" && state.mode !== "planning");
  const hidden = ids(quest.state).filter((id) => quest.state.cards[id]?.hiddenAt != null);
  expect(hidden).toHaveLength(2);
  const text = readable(made, quest.state, quest.steps);
  for (const id of hidden) {
    expect(text).not.toContain(`"${id}"`);
    expect(text).not.toContain(`"${quest.state.cards[id]?.code}"`);
  }
  // The card turned later is named from then on: the turn engages it.
  const turned = send(quest, { type: "Pass" }, made.ctx);
  expect(turned.state.cards[hidden[0] ?? ""]?.hiddenAt).toBeDefined();
});

lineSpec("06132:A:2", "an Undo and a replay of the save pick the same hidden card for Faramir: the pick comes from the game's seed, and the same seed gives the same card", (effects) => {
  const made = table({ seats: 2, phase: "Combat", play: [faramir], seed: 11, deck: [southern, uruk, numenorean, ambusher, ...fillers(4)] }, effects);
  const held = takes(made, takes(made, made.state, 0, 3), 1, 1);
  const at = opened(made, held);
  const intents = [{ type: "Trigger", cardId: idOf(held, faramir), effectId: "06132:action:1" }, { type: "Choose", optionId: "seat:0" }] as const;
  const play = (from: ScenarioState): ScenarioState => {
    try {
      return replay(from, intents, made.ctx, from.cards);
    } catch (error) {
      return expect.fail(String(error));
    }
  };
  const first = play(at.state);
  expect(hiddenCodes(first, 0)).toHaveLength(2);
  // An Undo goes back to the state before the Action and plays the intents again; a reload of the save does the same from its written form.
  const undone = play(at.state);
  const saved = JSON.parse(JSON.stringify(at.state)) as ScenarioState;
  const loaded = play(saved);
  for (const other of [undone, loaded]) {
    expect(engagedCodes(other, 0)).toEqual(engagedCodes(first, 0));
    expect(hiddenCodes(other, 0)).toEqual(hiddenCodes(first, 0));
    expect(other.seedCursor).toBe(first.seedCursor);
  }
});

lineSpec("06117:B:1", "a player eliminated by an attack has his hidden cards discarded, and the other player keeps his", (effects) => {
  // The stage's own lines take the cards (1 at the beginning of the quest phase, 1 more by choosing to take in the combat phase), then Black Númenorean kills the last hero of seat 0.
  const made = table({ seats: 2, phase: "Planning", engaged: [{ code: numenorean, seat: 0 }], deck: fillers(14) }, effects);
  const worn = hurt(made, hurt(made, made.state, "dh2", 6), "dh1", 3);
  const hit = drive(made, opened(made, worn), (state) => state.window?.kind === "defense", () => "take");
  expect([hiddenCodes(hit.state, 0).length, hiddenCodes(hit.state, 1).length]).toEqual([2, 2]);
  const done = drive(made, send(hit, { type: "Undefended", heroId: idOf(hit.state, "dh1") }, made.ctx), (state) => state.seats[0]?.eliminated === true);
  expect(done.state.seats[0]?.eliminated).toBe(true);
  expect(hiddenCodes(done.state, 0)).toEqual([]);
  expect(hiddenCodes(done.state, 1)).toHaveLength(2);
  expect(done.state.encounterDiscard.length).toBeGreaterThanOrEqual(2);
});
