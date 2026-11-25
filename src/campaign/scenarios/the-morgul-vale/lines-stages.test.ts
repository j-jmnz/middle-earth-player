// Rules: ats.captain-enemies, rr.cannot, rr.destroy, rr.in-play-and-out-of-play, rr.quest-advancement, rr.step-3-3, rr.winning-the-game, rr.reveal, rr.attachment-cards (data/rules/entries.json); ledger lines 06144:B:1, 06145:A:1, 06145:B:1, 06146:A:1, 06146:B:1, 06146:B:2, 06146:B:3, 06153:A:1, 06153:A:2.
// The three stages and their Captains on the table of the scenario: each Captain cannot leave play unless destroyed (a pick that feeds a discard or a shuffle leaves him out, an effect with no pick that moves him is undone), his destruction advances the quest before any Response, the stage that arrives adds
// the next Captain, and the Nazgûl's destruction wins. The Nazgûl takes at most 1 damage for each damage instance and has no attachments. Stage 1 prints no quest points, so only the Captain's destruction advances it.
import { expect } from "vitest";

import { flagged } from "../../../rules/core/state.ts";
import { legalTargets } from "../../../rules/engine/reduce.ts";
import { noTargetReason } from "../../../rules/player/potential.ts";
import { dealAdditionalShadow } from "../../../rules/interpret/interpret.ts";
import { idOf, resolveRecords } from "../../../../test/harness/scene-kit.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { CODES, engagedCodes, fight, opened, playCard, run, table, where } from "../../../../test/scenarios/the-morgul-vale/table.ts";

const { rearguard, betrayal, rider, tower, bodyguard, tracker, murzag, alcaron, nazgul, bridge, vale } = CODES;
const LIE_LOW = "10081";
const FORD = "141059";
const SNARE = "01069";
const INFIGHTING = "02058";
const DENETHOR = "01010";
const damage = (made: ReturnType<typeof table>, state: ReturnType<typeof table>["state"], code: string, amount: number) => run(made, state, { verb: "DamageCard", amount, target: "self" }, { sourceId: idOf(state, code) });

lineSpec("06144:B:1", "Murzag cannot leave play unless destroyed: a shuffle into the deck takes only the other enemy, Ford of Bruinen discards the Tracker and keeps him engaged, and the ability with no other target is not offered", (effects) => {
  const lie = table({ staging: [tower, murzag, tracker], deck: [bodyguard] }, effects, [LIE_LOW]);
  const done = resolveRecords(lie.state, lie.ctx, LIE_LOW, "response");
  expect(where(done.state, tracker)).toBe("encounterDeck");
  expect(where(done.state, murzag)).toBe("staging");
  expect(flagged(done.state, idOf(done.state, murzag), "cannotLeavePlay")).toBe(true);
  const alone = table({ staging: [tower, murzag], deck: [bodyguard] }, effects, [LIE_LOW]);
  const record = alone.ctx.effects.find((effect) => effect.id === "10081:response:1");
  expect(noTargetReason(alone.state, record?.instructions ?? [], idOf(alone.state, tower), 0, alone.ctx)).toMatch(/no legal target/);
  const ford = table({ engaged: [murzag, tracker], staging: [tower] }, effects, [FORD]);
  const swept = resolveRecords(ford.state, ford.ctx, FORD, "response");
  expect(engagedCodes(swept.state)).toEqual([murzag]);
  expect(where(swept.state, tracker)).toBe("encounterDiscard");
});

lineSpec("06144:B:1", "an effect with no pick that moves Murzag out of play is undone: he returns to the staging area face up and controlled by nobody, and what he carried is lost (his damage and his shadow cards)", (effects) => {
  const t = table({ engaged: [{ code: murzag, damage: 3 }], staging: [tower], deck: [bodyguard, bodyguard] }, effects);
  const id = idOf(t.state, murzag);
  const shadowed = dealAdditionalShadow(t.state, id, [], t.ctx);
  const moved = run(t, shadowed, { verb: "MoveEncounterCard", card: "self", to: "discard" }, { sourceId: id });
  expect(where(moved, murzag)).toBe("staging");
  expect(moved.cards[id]).toMatchObject({ face: "up", controller: null, damage: 0 });
  expect(engagedCodes(moved)).toEqual([]);
  expect(moved.cards[id]?.shadowId ?? null).toBeNull();
});

lineSpec("06144:B:1", "the quest advances to The Betrayal when Murzag is destroyed, and not by progress: a successful quest puts progress on stage 1 and leaves it current", (effects) => {
  const quested = table({ phase: "Quest", staging: [tower, murzag], committed: ["dh1", "dh2"] }, effects);
  const after = fight(quested, opened(quested), (state) => state.phase !== "Quest" && state.phase !== "Planning" && state.phase !== "Resource");
  const stage = after.state.cards[after.state.questStage ?? ""];
  expect(stage?.code).toBe(rearguard);
  expect(stage?.progress).toBeGreaterThan(0);
  const t = table({ engaged: [murzag], staging: [tower], setAside: [alcaron], deck: [bodyguard] }, effects);
  const done = damage(t, t.state, murzag, 7);
  expect(where(done, murzag)).toBe("encounterDiscard");
  expect(done.cards[done.questStage ?? ""]?.code).toBe(betrayal);
  expect(flagged(done, idOf(done, murzag), "cannotLeavePlay")).toBe(false);
});

lineSpec("06144:B:1", "Murzag is held only while his stage is current: the same effect leaves him in the staging area at The Rearguard and discards him at The Betrayal, where Lord Alcaron is the Captain held", (effects) => {
  const discard = { verb: "MoveEncounterCard", card: "self", to: "discard" } as const;
  const first = table({ staging: [tower, murzag] }, effects);
  expect(where(run(first, first.state, discard, { sourceId: idOf(first.state, murzag) }), murzag)).toBe("staging");
  const t = table({ stage: betrayal, staging: [tower, alcaron, murzag] }, effects);
  const kept = run(t, t.state, discard, { sourceId: idOf(t.state, alcaron) });
  expect(where(kept, alcaron)).toBe("staging");
  const gone = run(t, t.state, discard, { sourceId: idOf(t.state, murzag) });
  expect(where(gone, murzag)).toBe("encounterDiscard");
});

lineSpec("06145:A:1", "When Revealed: Lord Alcaron, set aside, is added to the staging area when the quest advances to The Betrayal", (effects) => {
  const t = table({ engaged: [murzag], staging: [tower], setAside: [alcaron], deck: [bodyguard] }, effects);
  expect(where(t.state, alcaron)).toBe("setAside");
  const done = damage(t, t.state, murzag, 7);
  expect(where(done, alcaron)).toBe("staging");
  expect(flagged(done, idOf(done, alcaron), "cannotLeavePlay")).toBe(true);
});

lineSpec("06145:B:1", "Lord Alcaron cannot leave play unless destroyed, and his destruction advances the quest to The Morgul Rider", (effects) => {
  const ford = table({ stage: betrayal, engaged: [alcaron, tracker], staging: [tower], deck: [bodyguard] }, effects, [FORD]);
  const swept = resolveRecords(ford.state, ford.ctx, FORD, "response");
  expect(engagedCodes(swept.state)).toEqual([alcaron]);
  const t = table({ stage: betrayal, engaged: [alcaron], staging: [tower], setAside: [nazgul, bridge], deck: [bodyguard, bodyguard] }, effects);
  const done = damage(t, t.state, alcaron, 5);
  expect(where(done, alcaron)).toBe("encounterDiscard");
  expect(done.cards[done.questStage ?? ""]?.code).toBe(rider);
});

lineSpec("06146:A:1", "When Revealed: the Nazgûl and The White Bridge, set aside, are added to the staging area when Lord Alcaron's destruction advances the quest", (effects) => {
  const t = table({ stage: betrayal, engaged: [alcaron], staging: [tower], setAside: [nazgul, bridge], deck: [bodyguard, bodyguard] }, effects);
  const done = damage(t, t.state, alcaron, 5);
  expect([nazgul, bridge].map((code) => where(done, code))).toEqual(["staging", "staging"]);
  expect(flagged(done, idOf(done, nazgul), "cannotLeavePlay")).toBe(true);
});

lineSpec("06146:B:1", "When Revealed: the first player reveals 1 card for each player, one at a time, each added to the staging area: two cards with two players, one with one", (effects) => {
  const two = table({ seats: 2, stage: betrayal, engaged: [alcaron], staging: [tower], setAside: [nazgul, bridge], deck: [bodyguard, vale, tracker, tracker] }, effects);
  const after = damage(two, two.state, alcaron, 5);
  expect([bodyguard, vale].map((code) => where(after, code))).toEqual(["staging", "staging"]);
  expect(after.encounterDeck).toHaveLength(2);
  const one = table({ stage: betrayal, engaged: [alcaron], staging: [tower], setAside: [nazgul, bridge], deck: [bodyguard, vale, tracker] }, effects);
  const single = damage(one, one.state, alcaron, 5);
  expect(single.encounterDeck).toHaveLength(2);
  expect(where(single, bodyguard)).toBe("staging");
});

lineSpec("06146:B:2", "the Nazgûl cannot leave play unless destroyed: Ford of Bruinen discards the Tracker and keeps him engaged", (effects) => {
  const ford = table({ stage: rider, engaged: [nazgul, tracker], staging: [tower] }, effects, [FORD]);
  const swept = resolveRecords(ford.state, ford.ctx, FORD, "response");
  expect(engagedCodes(swept.state)).toEqual([nazgul]);
  expect(where(swept.state, tracker)).toBe("encounterDiscard");
});

lineSpec("06146:B:3", "the players win when the Nazgûl is destroyed, after five damage instances of 1 and not before", (effects) => {
  const t = table({ stage: rider, staging: [tower], engaged: [nazgul] }, effects);
  let state = t.state;
  for (let blow = 1; blow <= 4; blow += 1) {
    state = damage(t, state, nazgul, 6);
    expect(state.cards[idOf(state, nazgul)]?.damage).toBe(blow);
    expect(state.stageCleared).toBe(false);
  }
  state = damage(t, state, nazgul, 6);
  expect(state.stageCleared).toBe(true);
});

lineSpec("06153:A:1", "the Nazgûl cannot have attachments: a Forest Snare can be played on another engaged enemy and is offered no host at the Nazgûl", (effects) => {
  const t = table({ stage: rider, engaged: [nazgul, tracker], staging: [tower], hand: [SNARE], heroResources: 3 }, effects, [SNARE]);
  const hosts = legalTargets(opened(t).state, { type: "PlayCard", cardId: idOf(t.state, SNARE) }, t.ctx);
  expect(hosts).toContain(idOf(t.state, tracker));
  expect(hosts).not.toContain(idOf(t.state, nazgul));
});

lineSpec("06153:A:2", "each damage instance dealt to the Nazgûl is reduced to 1, whatever its source, with no limit for each round: several separate damage instances each add 1, and damage moved onto him by Infighting is cut to 1 as well", (effects) => {
  const t = table({ stage: rider, staging: [tower], engaged: [nazgul] }, effects);
  let state = t.state;
  [3, 2, 6, 4].forEach((amount, index) => {
    state = damage(t, state, nazgul, amount);
    expect(state.cards[idOf(state, nazgul)]?.damage).toBe(index + 1);
  });
  expect(state.stageCleared).toBe(false);
  const moved = table({ stage: rider, engaged: [nazgul, { code: tracker, damage: 2 }], staging: [tower], hand: [INFIGHTING], heroes: [{ code: DENETHOR, resources: 3 }] }, effects, [INFIGHTING, DENETHOR]);
  const trackerId = idOf(moved.state, tracker);
  const nazgulId = idOf(moved.state, nazgul);
  const played = playCard(moved, opened(moved), INFIGHTING, (window) => (window.window?.kind === "choose" ? (window.window.options.includes(trackerId) ? trackerId : window.window.options.includes(nazgulId) ? nazgulId : (window.window.options.at(-1) ?? "")) : ""));
  expect(played.state.cards[nazgulId]?.damage).toBe(1);
  expect(played.state.cards[trackerId]?.damage).toBe(0);
});
