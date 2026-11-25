// Rules: ats.setup-the-morgul-vale-to-the-tower, rr.removed-from-game, rr.in-play-and-out-of-play, rr.objective-cards, rr.reveal, rr.surge, rr.forced, rr.optional-engagement, rr.step-3-3, faq.errata.06157 (data/rules/entries.json); ledger lines 06144:A:1, 06147:A:1, 06147:A:2, 06147:A:3, 06149:A:1, 06150:A:1, 06156:A:1, 06157:A:1, 06158:A:2, 06159:A:2, 06160:A:1.
// To the Tower and every card that puts progress tokens on it, each on its real moment: the Setup that announces it added to the staging area, the engagement of a Tracker, the reveal of a treachery, the quest that explores The White Bridge. The loss at ten tokens is read after real placements, and a Morgul Sorcerer hears each placement once.
import { expect } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";
import { shadowCards } from "../../../rules/core/zones.ts";
import { stagingThreat } from "../../../rules/quest/quest.ts";
import { answer, idOf, resolveRecords, revealedTop, revealFromTop, send, statOf } from "../../../../test/harness/scene-kit.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { CODES, engagedCodes, fight, opened, run, table, tokens, where } from "../../../../test/scenarios/the-morgul-vale/table.ts";

const { rearguard, tower, sorcerer, tracker, murzag, bridge, bodyguard, fog, malice, terror, deadCity, vale, powerOfMordor } = CODES;
const TOWER_NAME = "To the Tower";
const FARAMIRS = { hero: "06081", otherHero: "144002", ally: "01014", otherAlly: "21005" } as const;
const FARAMIR_CODES = Object.values(FARAMIRS);
const place = (made: ReturnType<typeof table>, state: ScenarioState, amount: number): ScenarioState => run(made, state, { verb: "PlaceProgressOnNamed", name: TOWER_NAME, amount });
const shadowsOf = (state: ScenarioState, code: string): number => shadowCards(state.cards[idOf(state, code)]).length;

lineSpec("06144:A:1", "Setup: To the Tower is announced as added to the staging area, so its own Forced effect removes every Faramir the players own; the cards the piles placed stay where they lie", (effects) => {
  const t = table({ seats: 2, staging: [tower, murzag, vale], setAside: ["06152", "06153", bridge], heroes: [{ code: FARAMIRS.hero, seat: 0 }], play: [{ code: FARAMIRS.ally, seat: 1 }] }, effects, FARAMIR_CODES);
  const done = resolveRecords(t.state, t.ctx, rearguard, "setup", idOf(t.state, rearguard));
  expect(where(done.state, FARAMIRS.hero)).toBe("removed");
  expect(where(done.state, FARAMIRS.ally)).toBe("removed");
  expect([tower, murzag, vale].map((code) => where(done.state, code))).toEqual(["staging", "staging", "staging"]);
  expect(["06152", "06153", bridge].map((code) => where(done.state, code))).toEqual(["setAside", "setAside", "setAside"]);
});

lineSpec("06147:A:2", "Remove Faramir from the game: every Faramir, hero or ally, in play, in a hand, in a deck or in a discard pile, of either player; the cards of another title stay, and the hero's threat stays on the dial", (effects) => {
  const t = table({ seats: 2, staging: [tower], heroes: [{ code: FARAMIRS.hero, seat: 0 }], play: [{ code: FARAMIRS.ally, seat: 1 }, { code: "ally", seat: 1 }], hand: [{ code: FARAMIRS.otherAlly, seat: 0 }, { code: "ally", seat: 0 }], deckOf: [{ code: FARAMIRS.otherHero, seat: 1 }] }, effects, FARAMIR_CODES);
  const done = resolveRecords(t.state, t.ctx, rearguard, "setup", idOf(t.state, rearguard));
  for (const code of FARAMIR_CODES) expect(where(done.state, code)).toBe("removed");
  expect((done.state.pendingEvents ?? []).filter((event) => event.trigger === "leftPlay")).toEqual([]);
  expect(where(done.state, "dh1")).toBe("heroes");
  expect(done.state.seats[0]?.heroes).not.toContain(idOf(done.state, FARAMIRS.hero));
  expect(done.state.seats[0]?.threat).toBe(t.state.seats[0]?.threat);
  expect(done.state.seats[1]?.play.map((id) => done.state.cards[id]?.code)).toEqual(["ally"]);
  expect(done.state.seats[0]?.hand.map((id) => done.state.cards[id]?.code)).toEqual(["ally"]);
});

lineSpec("06147:A:1", "To the Tower cannot leave the staging area: The Power of Mordor counts it in X and shuffles it into no deck, and its tokens stay", (effects) => {
  const t = table({ staging: [{ code: tower, progress: 4 }, tracker, vale], deck: Array<string>(6).fill(bodyguard), threat: [20, 20] }, effects, [powerOfMordor]);
  const after = revealedTop(t, powerOfMordor);
  expect(where(after, tower)).toBe("staging");
  expect(tokens(after)).toBe(4);
  expect(after.encounterDeck.map((id) => after.cards[id]?.code)).not.toContain(tower);
  // X is 3 (the Tower, the Tracker, the Morgul Vale): the Tracker and the Vale go into the deck and 3 cards are revealed.
  expect(after.encounterDeck).toHaveLength(8 - 3);
});

lineSpec("06147:A:3", "the players lose when the tenth progress token lies on To the Tower, after the placement that makes it, and not at nine; a reveal of Terror Drives Them places the last one", (effects) => {
  const nine = table({ staging: [{ code: tower, progress: 7 }, murzag], deck: [bodyguard, bodyguard] }, effects);
  const afterNine = revealedTop(nine, terror);
  expect(tokens(afterNine)).toBe(8);
  expect(afterNine.lost).toBe(false);
  const ten = table({ staging: [{ code: tower, progress: 9 }, murzag], deck: [bodyguard, bodyguard] }, effects);
  const afterTen = revealedTop(ten, terror);
  expect(tokens(afterTen)).toBe(10);
  expect(afterTen.lost).toBe(true);
  expect(afterTen.lossReason).toMatch(/10 progress tokens/);
});

lineSpec("06147:A:3", "the players lose when one placement of 3 tokens takes To the Tower from 8 to 11, and when it passes ten in any other way (Impenetrable Fog)", (effects) => {
  const t = table({ seats: 2, staging: [{ code: tower, progress: 8 }, murzag], deck: [bodyguard, bodyguard] }, effects, [fog]);
  const revealed = revealFromTop(t.state, t.ctx, fog, []);
  const after = answer({ state: revealed.state, steps: [] }, t.ctx, () => "tokens").state;
  expect(tokens(after)).toBe(11);
  expect(after.lost).toBe(true);
});

lineSpec("06147:A:3", "the loss is for To the Tower lying in the staging area: with ten tokens on a card of that title anywhere else in play the players do not lose", (effects) => {
  const staged = table({ staging: [{ code: tower, progress: 9 }, murzag] }, effects);
  expect(place(staged, staged.state, 1).lost).toBe(true);
  const elsewhere = table({ play: [{ code: tower, progress: 9 }], staging: [murzag] }, effects);
  expect(where(elsewhere.state, tower)).toBe("play");
  const placed = place(elsewhere, elsewhere.state, 1);
  expect(tokens(placed)).toBe(10);
  expect(placed.lost).toBe(false);
});

lineSpec("06149:A:1", "Forced: after progress tokens are placed on To the Tower a Morgul Sorcerer in the staging area is dealt a shadow card, once for each placement, whatever the tokens in it: a Tracker's engagement, 3 tokens of Impenetrable Fog and a second placement", (effects) => {
  const t = table({ phase: "Encounter", staging: [tower, sorcerer, tracker], deck: [bodyguard, bodyguard, bodyguard, bodyguard] }, effects, [fog]);
  const engaged = send(opened(t), { type: "Engage", enemyId: idOf(t.state, tracker) }, t.ctx).state;
  expect(tokens(engaged)).toBe(1);
  expect(shadowsOf(engaged, sorcerer)).toBe(1);
  const revealed = revealFromTop(engaged, t.ctx, fog, []);
  const fogged = answer({ state: revealed.state, steps: [] }, t.ctx, () => "tokens").state;
  expect(tokens(fogged)).toBe(4);
  expect(shadowsOf(fogged, sorcerer)).toBe(2);
});

lineSpec("06150:A:1", "Forced: when a player optionally engages Morgul Tracker 1 token goes on To the Tower; an engagement of the engagement check does not place one", (effects) => {
  const t = table({ phase: "Encounter", staging: [tower, tracker], threat: [20, 20] }, effects);
  const engaged = send(opened(t), { type: "Engage", enemyId: idOf(t.state, tracker) }, t.ctx).state;
  expect(engagedCodes(engaged)).toEqual([tracker]);
  expect(tokens(engaged)).toBe(1);
  // Threat 50 is at least the Tracker's engagement cost 40: it engages in the engagement check once the player declines.
  const high = table({ phase: "Encounter", staging: [tower, tracker], threat: [50, 50] }, effects);
  const declined = fight(high, opened(high), (state) => state.phase !== "Encounter");
  expect(engagedCodes(declined.state)).toEqual([tracker]);
  expect(tokens(declined.state)).toBe(0);
});

lineSpec("06156:A:1", "The White Bridge: its Threat X and its quest points X are the progress tokens on To the Tower, in the staging area and as the active location, 0 with none; a printed Threat of none takes them", (effects) => {
  const t = table({ staging: [{ code: tower, progress: 3 }, bridge] }, effects);
  expect(statOf(t.state, t.cards, bridge, "threat")).toBe(3);
  expect(statOf(t.state, t.cards, bridge, "questPoints")).toBe(3);
  const more = place(t, t.state, 2);
  expect(statOf(more, t.cards, bridge, "threat")).toBe(5);
  expect(statOf(more, t.cards, bridge, "questPoints")).toBe(5);
  // The staging area's total counts it: the Tower prints no Threat, so the total is the 5 tokens' worth of The White Bridge.
  expect(stagingThreat(more, t.cards)).toBe(5);
  const none = table({ staging: [tower, bridge] }, effects);
  expect(stagingThreat(none.state, none.cards)).toBe(0);
  expect(statOf(none.state, none.cards, bridge, "threat")).toBe(0);
  expect(statOf(none.state, none.cards, bridge, "questPoints")).toBe(0);
});

lineSpec("06156:A:1", "The White Bridge as the active location: the quest explores it with progress equal to the tokens; with no token it has no quest points and stays active", (effects) => {
  const explored = table({ phase: "Quest", staging: [{ code: tower, progress: 2 }, murzag], active: bridge, committed: ["dh1", "dh2"] }, effects);
  const afterQuest = fight(explored, opened(explored), (state) => state.phase !== "Quest");
  expect(where(afterQuest.state, bridge)).toBe("encounterDiscard");
  const empty = table({ phase: "Quest", staging: [tower, murzag], active: bridge, committed: ["dh1", "dh2"] }, effects);
  const afterEmpty = fight(empty, opened(empty), (state) => state.phase !== "Quest");
  expect(where(afterEmpty.state, bridge)).toBe("activeLocation");
});

lineSpec("06157:A:1", "Impenetrable Fog: the first player takes 3 tokens as one placement, or reveals one card for each player added to the staging area, not both", (effects) => {
  const t = table({ seats: 2, firstPlayer: 1, staging: [tower, murzag], deck: [bodyguard, bodyguard, bodyguard] }, effects, [fog]);
  const revealed = revealFromTop(t.state, t.ctx, fog, []);
  expect(revealed.state.window).toMatchObject({ kind: "choose", seat: 1, options: ["tokens", "reveal"] });
  expect(tokens(answer({ state: revealed.state, steps: [] }, t.ctx, () => "tokens").state)).toBe(3);
  const cards = answer({ state: revealed.state, steps: [] }, t.ctx, () => "reveal").state;
  expect(tokens(cards)).toBe(0);
  expect(cards.staging.filter((id) => cards.cards[id]?.code === bodyguard)).toHaveLength(2);
});

lineSpec("06158:A:2", "Sleepless Malice: each player chooses for himself, in turn, the first player first: 3 random cards from his hand, or 1 token; a player with fewer than 3 cards may choose the discard and discards what he holds", (effects) => {
  const t = table({ seats: 2, staging: [tower, murzag], deck: [bodyguard, bodyguard, bodyguard], hand: Array.from({ length: 4 }, () => "filler") }, effects, [malice]);
  const revealed = revealFromTop(t.state, t.ctx, malice, []);
  expect(revealed.state.window).toMatchObject({ kind: "choose", seat: 0, options: ["discard", "token"] });
  const first = send({ state: revealed.state, steps: [] }, { type: "Choose", optionId: "discard" }, t.ctx).state;
  expect(first.window).toMatchObject({ kind: "choose", seat: 1 });
  expect(first.seats[0]?.hand).toHaveLength(1);
  const second = send({ state: first, steps: [] }, { type: "Choose", optionId: "token" }, t.ctx).state;
  expect(tokens(second)).toBe(1);
  expect(second.seats[1]?.hand).toHaveLength(4);
  const few = table({ seats: 2, staging: [tower, murzag], deck: [bodyguard, bodyguard, bodyguard], hand: Array.from({ length: 2 }, () => "filler") }, effects, [malice]);
  const done = answer({ state: revealFromTop(few.state, few.ctx, malice, []).state, steps: [] }, few.ctx, () => "discard").state;
  expect(done.seats.map((seat) => seat.hand.length)).toEqual([0, 0]);
});

lineSpec("06159:A:2", "Terror Drives Them: 1 token goes on To the Tower when it is revealed, and its Surge reveals the next card", (effects) => {
  const t = table({ staging: [{ code: tower, progress: 2 }, murzag], deck: [tracker, bodyguard] }, effects);
  const after = revealedTop(t, terror);
  expect(tokens(after)).toBe(3);
  expect(where(after, tracker)).toBe("staging");
});

lineSpec("06160:A:1", "The Dead City Looms: each player raises his threat by the tokens on To the Tower, and with none there it gains surge and the next card is revealed", (effects) => {
  const t = table({ seats: 2, staging: [{ code: tower, progress: 3 }, murzag], threat: [30, 35], deck: [tracker, bodyguard] }, effects);
  const after = revealedTop(t, deadCity);
  expect(after.seats.map((seat) => seat.threat)).toEqual([33, 38]);
  expect(where(after, tracker)).toBe("encounterDeck");
  const bare = table({ staging: [tower, murzag], threat: [30, 35], deck: [tracker, bodyguard] }, effects);
  const none = revealedTop(bare, deadCity);
  expect(none.seats[0]?.threat).toBe(30);
  expect(where(none, tracker)).toBe("staging");
});
