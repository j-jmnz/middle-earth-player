// Rules: rr.travel, rr.forced, rr.action, rr.discard-pile-and-victory-display, rr.attachment-cards, rr.objective-cards, hob.sack-x, hob.bilbo-baggins-ohauh, hob.baggins-sphere-ohauh (data/rules/entries.json); docs/scenarios/the-hobbit/we-must-away-ere-break-of-day.md (We Must Away, Ere Break of Day, Troll Cave, Troll Key and Troll Purse).
import { expect } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { announce, answer, cardSpecs, count, deckCount, offers, quest, resourcesOn, travel, zone, type Row } from "../../../../test/harness/card-spec.ts";
import { play } from "../../../../test/harness/card-spec-play.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { finish, idOf, legalIntents, send, type Layout } from "../../../../test/harness/scene-kit.ts";
import type { PlayerIntent } from "../../../rules/core/intents.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";

// The rows and tests that put Bilbo Baggins (`sagaHero`, whom the loadout deals) with the Key, the Purse, Troll Cave and Troll Camp: the travel cost in Baggins resources, Troll Camp's Action, and a Key or Purse that a card discards from the encounter deck.
const ID = "we-must-away-ere-break-of-day";
const BILBO = "131001";
const CAVE = "131037";
const TRAVELING: Layout = { phase: "Travel", staging: [CAVE] };

// The Sack deck gives its card to Bert, who engages the first player and whose Forced effect (Sack 1) draws it.
const SACKED = announce("engaged", "131033", { seat: 0 });

const ROWS: readonly Row[] = [
  // 131037 Troll Cave: Bilbo must hold the Troll Key and the first player spends 5 Baggins resources (2 with the Troll Purse attached too).
  { line: "131037:A:2", name: "the players travel to Troll Cave when Bilbo holds the Troll Key and the first player spends 5 Baggins resources", layout: { ...TRAVELING, sagaHero: { resources: 5 }, attached: [{ code: "131043", to: BILBO }] }, act: travel(CAVE), expect: [zone(CAVE, "activeLocation"), resourcesOn(BILBO, 1)] },
  { line: "131037:A:2", name: "with the Troll Purse attached too the cost is 2", layout: { ...TRAVELING, sagaHero: { resources: 3 }, attached: [{ code: "131043", to: BILBO }, { code: "131042", to: BILBO }] }, act: travel(CAVE), expect: [zone(CAVE, "activeLocation"), resourcesOn(BILBO, 2)] },
  { line: "131037:A:2", name: "the players cannot travel there without the Troll Key", layout: { ...TRAVELING, sagaHero: { resources: 5 } }, act: [], expect: [offers("Travel", undefined, false)] },
  { line: "131037:A:2", name: "nor when the first player cannot pay (4 resources against 5)", layout: { ...TRAVELING, sagaHero: { resources: 4 }, attached: [{ code: "131043", to: BILBO }] }, act: [], expect: [offers("Travel", undefined, false)] },
  // 131042 Troll Purse and 131043 Troll Key, discarded from the encounter deck by stage 2B's progress: they go to the staging area. The Setup of 131023 notes the cards placed in the encounter discard pile (the layout does as the Setup does; 131023:A:1 holds the Setup).
  { line: "131042:A:1", name: "a copy that stage 2B discards from the encounter deck goes to the staging area", layout: { stage: "131024", side: "B", active: "131039", phase: "Quest", noteEncounterDiscards: true, deck: Array.from({ length: 6 }, () => "131042") }, act: quest("success"), expect: [count("131042", "staging", 3), count("131042", "encounterDiscard", 0), deckCount(3)] },
  { line: "131043:A:1", name: "a copy that stage 2B discards from the encounter deck goes to the staging area", layout: { stage: "131024", side: "B", active: "131039", phase: "Quest", noteEncounterDiscards: true, deck: Array.from({ length: 6 }, () => "131043") }, act: quest("success"), expect: [count("131043", "staging", 3), count("131043", "encounterDiscard", 0), deckCount(3)] },
];

cardSpecs(ID, ROWS);

// The first player's Trigger of a card's Action or Response, paid from Bilbo's pool (a resource cost is paid by the intent): the state after it resolves, with the answers of `after` taken first.
function used(effects: readonly Effect[], row: { line: string; layout: Layout; act: Parameters<typeof play>[1]["act"]; code: string; amount: number }): ScenarioState {
  const { code, amount } = row;
  const done = play(ID, { line: row.line, layout: row.layout, act: row.act, expect: [] }, effects, true);
  const intent = legalIntents(done.run.state, done.table.ctx).find((offered) => offered.type === "Trigger" && offered.cardId === idOf(done.run.state, code));
  if (!intent) return done.run.state;
  const payments = amount > 0 ? [{ heroId: idOf(done.run.state, BILBO), amount }] : [];
  return finish(send(done.run, { ...intent, payments } as PlayerIntent, done.table.ctx), done.table.ctx).state;
}

const CAMP: Layout = { staging: ["131036"], engaged: ["131033"], sagaHero: { resources: 3 } };

lineSpec("131036:A:2", "Action: a Sack card attached to a character, drawn by Bert's Sack 1, is removed and goes back into the Sack deck", (effects) => {
  const state = used(effects, { line: "131036:A:2", layout: { ...CAMP, piles: { sackDeck: ["131045"] } }, act: [SACKED, answer("dh1")], code: "131036", amount: 1 });
  expect(state.cards[idOf(state, "131045")]?.zone).toBe("sackDeck");
  expect(state.cards[idOf(state, BILBO)]?.exhausted).toBe(true);
  expect(state.cards[idOf(state, BILBO)]?.resources).toBe(2);
});
lineSpec("131036:A:2", "Bilbo may trigger it even with a Sack card attached to him", (effects) => {
  // A Worn Sack goes to the hero with the most resources: Bilbo, holding 3.
  const state = used(effects, { line: "131036:A:2", layout: { ...CAMP, piles: { sackDeck: ["131050"] } }, act: [SACKED], code: "131036", amount: 1 });
  expect(state.cards[idOf(state, "131050")]?.zone).toBe("sackDeck");
  expect(state.cards[idOf(state, BILBO)]?.exhausted).toBe(true);
});

// 131036:A:2 costs "Exhaust Bilbo Baggins": once used, Bilbo is exhausted and the Action is not offered again in the round, though Sack cards remain and he holds resources; when he is ready again it is offered.
lineSpec("131036:A:2", "a second use in the same round is not offered while Bilbo stays exhausted", (effects) => {
  const attached = [{ code: "131045", to: "dh1", encounter: true as const }, { code: "131046", to: "dh2", encounter: true as const }];
  const done = play(ID, { line: "131036:A:2", layout: { ...CAMP, attached }, act: [], expect: [] }, effects, true);
  const camp = idOf(done.run.state, "131036");
  const offered = (state: ScenarioState) => legalIntents(state, done.table.ctx).some((intent) => intent.type === "Trigger" && intent.cardId === camp);
  const first = legalIntents(done.run.state, done.table.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === camp);
  expect(first, "the first use is offered").toBeDefined();
  const bilbo = idOf(done.run.state, BILBO);
  const after = finish(send(done.run, { ...first, payments: [{ heroId: bilbo, amount: 1 }] } as PlayerIntent, done.table.ctx), done.table.ctx, (state) => idOf(state, "131045")).state;
  expect(after.cards[bilbo]?.resources).toBe(2);
  expect(after.cards[idOf(after, "131045")]?.zone, "the Sack card chosen is removed").not.toBe("attached");
  expect(after.cards[idOf(after, "131046")]?.zone, "the other Sack card stays, so a second use has a target").toBe("attached");
  expect(offered(after), "the second use").toBe(false);
  const ready = { ...after, cards: { ...after.cards, [bilbo]: { ...after.cards[bilbo]!, exhausted: false } } };
  expect(offered(ready), "after Bilbo readies").toBe(true);
});
