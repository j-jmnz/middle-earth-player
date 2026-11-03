import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { holds } from "../../interpret/conditions.ts";
import { expectOk } from "../../core/test-fixture.ts";
import { legalIntents, legalTargets, reduce } from "../../engine/reduce.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { strikeResumes } from "./flow.ts";
import { noteEngaged } from "./events.ts";
import { actionWindow, record, table } from "./fixture.ts";

// Rules: rr.attacks-outside-the-combat-phase, rr.step-6-8b, rr.ranged, rr.step-6-8-3, faq.limitations-on-attacks,
// rr.optional-engagement, rr.engaged (data/rules/entries.json).
// Attacks outside the attack step and beyond the enemies engaged with the declaring player, and the filters that name an
// attack's cards.

const HANDS: Effect = record("event:action:1", "event", "action", [
  { verb: "Pick", pick: { type: "character", control: "you", keyword: "ranged", state: "ready" } },
  { verb: "Exhaust", target: { kind: "picked" } },
  { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "picked" },
  { verb: "Pick", pick: { type: "enemy", control: "any", stagingOnly: true } },
  { verb: "DeclareAttack", exhausted: true },
  { verb: "Commit", target: "picked" },
]);

describe("an attack an effect declares", () => {
  it("attacks an enemy in the staging area now, as an extra attack, and the instructions after it act on the attacker", () => {
    const destroyed = record("archer:response:1", "archer", "response", [{ verb: "Draw", amount: 1 }], { trigger: "attackDestroyed", subject: "self" });
    const { state, ids, ctx } = table(
      [{ code: "archer", at: { zone: "heroes", seat: 0 } }, { code: "troll", at: { zone: "staging" } }, { code: "event", at: { zone: "hand", seat: 0 } }, { code: "aragorn", at: { zone: "deck", seat: 0 } }],
      [HANDS, destroyed],
    );
    const played = expectOk(reduce(actionWindow(state), { type: "PlayCard", cardId: ids.event!, payments: [] }, ctx)).state;
    // 2 + 1 Attack against 0 Defense: 3 of the troll's 4 hit points.
    expect(played.cards[ids.troll!]?.damage).toBe(3);
    expect(played.cards[ids.archer!]?.exhausted).toBe(true);
    expect(played.cards[ids.archer!]?.committed).toBe(true);
    expect(played.modifiers).toEqual([]);
    expect(played.declaredAttacks).toEqual([]);
    expect(played.pendingStrike).toBeNull();
    expect(played.window?.kind).toBe("pass");
  });

  it("goes on first when it was made during an enemy attack's action window", () => {
    const { state } = table([]);
    const waiting: ScenarioState = {
      ...state,
      stack: [{ id: "f0", frame: "ResolveEffect", cardId: null, seat: 0, peril: false, step: 1, data: { kind: "none" } }],
      pendingAttack: { enemyId: "e", seat: 0, awaiting: "damage", awaitDepth: 0 },
      pendingStrike: { seat: 0, enemyId: "x", attackerIds: ["a"], awaiting: "strike", awaitDepth: 1 },
      window: null,
    };
    expect(strikeResumes(waiting)).toBe(true);
    expect(strikeResumes({ ...waiting, pendingStrike: { ...waiting.pendingStrike!, awaitDepth: 0 }, pendingAttack: { ...waiting.pendingAttack!, awaitDepth: 1 } })).toBe(false);
  });
});

describe("attacks into the staging area", () => {
  it("lets a character a card allows declare an attack against an enemy in the staging area, alone when the card says so", () => {
    const alone = record("aragorn:constant:1", "aragorn", "constant", [{ verb: "ModifyStat", stat: "attacksStagingAlone", amount: 1, until: "whileSourceInPlay" }]);
    const { state, ids, ctx } = table([{ code: "aragorn", at: { zone: "heroes", seat: 0 } }, { code: "gimli", at: { zone: "heroes", seat: 0 } }, { code: "orc", at: { zone: "staging" } }], [alone]);
    const synced = expectOk(reduce(actionWindow(state), { type: "Pass" }, ctx)).state;
    const open = { ...synced, mode: "playerAttacks" as const, window: { kind: "playerAttack" as const }, activeSeat: 0, passed: [] };
    expect(legalTargets(open, { type: "DeclareAttackers", cardId: ids.aragorn! }, ctx)).toEqual([ids.orc]);
    expect(legalTargets(open, { type: "DeclareAttackers", cardId: ids.gimli! }, ctx)).toEqual([]);
    expect(reduce(open, { type: "DeclareAttackers", enemyId: ids.orc!, attackerIds: [ids.aragorn!, ids.gimli!] }, ctx).ok).toBe(false);
    const attacked = expectOk(reduce(open, { type: "DeclareAttackers", enemyId: ids.orc!, attackerIds: [ids.aragorn!] }, ctx)).state;
    expect(attacked.cards[ids.orc!]?.damage).toBe(1);
    expect(attacked.cards[ids.orc!]?.zone).toBe("staging");
  });

  it("opens a card's attack window: one attack against each target, extra attacks, until none is left (22007:A:2)", () => {
    const charge = record("event:action:1", "event", "action", [{ verb: "OfferAttacks", pick: { type: "enemy", control: "any", stagingOnly: true, nonUnique: true } }]);
    const { state, ids, ctx } = table(
      [{ code: "aragorn", at: { zone: "heroes", seat: 0 } }, { code: "gimli", at: { zone: "heroes", seat: 0 } }, { code: "orc", at: { zone: "staging" } }, { code: "troll", at: { zone: "staging" } }, { code: "goblin", at: { zone: "engaged", seat: 0 } }, { code: "event", at: { zone: "hand", seat: 0 } }],
      [charge],
    );
    const quest = { ...actionWindow(state), phase: "Quest" as const, boundaryPhase: "Quest" as const, mode: "resolution" as const, declaredAttacks: [`0:${ids.orc}`] };
    const opened = expectOk(reduce(quest, { type: "PlayCard", cardId: ids.event!, payments: [] }, ctx)).state;
    expect(opened.window).toEqual({ kind: "playerAttack", targets: [ids.orc, ids.troll] });
    expect(legalTargets(opened, { type: "DeclareAttackers", cardId: ids.aragorn! }, ctx)).toEqual([ids.orc, ids.troll]);
    expect(reduce(opened, { type: "DeclareAttackers", enemyId: ids.goblin!, attackerIds: [ids.aragorn!] }, ctx).ok).toBe(false);
    const first = expectOk(reduce(opened, { type: "DeclareAttackers", enemyId: ids.troll!, attackerIds: [ids.aragorn!, ids.gimli!] }, ctx)).state;
    expect(first.cards[ids.troll!]?.zone).toBe("encounterDiscard");
    expect(first.window).toEqual({ kind: "playerAttack", targets: [ids.orc] });
    expect(legalIntents(first, ctx)).toEqual([{ type: "DeclineAttack" }]);
    const done = expectOk(reduce(first, { type: "DeclineAttack" }, ctx)).state;
    expect(done.window?.kind).toBe("pass");
    expect(done.declaredAttacks).toEqual([`0:${ids.orc}`]);
  });

  it("sends an attack's excess damage on to the enemy a card chose (08004:A:3)", () => {
    const { state, ids, ctx } = table([{ code: "gimli", at: { zone: "heroes", seat: 0 } }, { code: "goblin", at: { zone: "engaged", seat: 0 } }, { code: "orc", at: { zone: "engaged", seat: 0 } }]);
    const marked: ScenarioState = { ...state, window: null, pendingStrike: { seat: 0, enemyId: ids.goblin!, attackerIds: [ids.gimli!], excessTo: ids.orc!, awaiting: "strike", awaitDepth: 0 } };
    const struck = expectOk(reduce({ ...marked, window: { kind: "pass" }, mode: "combatActions" }, { type: "Pass" }, ctx)).state;
    // 3 Attack against a 2-hit-point goblin: 1 excess damage on the orc.
    expect(struck.cards[ids.goblin!]?.zone).toBe("encounterDiscard");
    expect(struck.cards[ids.orc!]?.damage).toBe(1);
  });
});

describe("the attack family's filters and conditions", () => {
  it("names the enemies engaged with the picked player, an enemy not engaged with you, a shared Trait, printed numbers and keywords", () => {
    const { state, ids, ctx } = table(
      [{ code: "archer", at: { zone: "heroes", seat: 0 } }, { code: "aragorn", at: { zone: "heroes", seat: 1 } }, { code: "orc", at: { zone: "engaged", seat: 1 } }, { code: "goblin", at: { zone: "staging" } }, { code: "troll", at: { zone: "engaged", seat: 0 } }],
      [],
      [],
      2,
    );
    expect(pickCandidates(state, { type: "enemy", control: "any", engagedWith: "picked" }, 0, ["seat:1"], null, ctx)).toEqual([ids.orc]);
    expect(pickCandidates(state, { type: "enemy", control: "any", staging: true, engagedWith: "notYou" }, 0, [], null, ctx).sort()).toEqual([ids.orc, ids.goblin].sort());
    expect(pickCandidates(state, { type: "enemy", control: "any", staging: true, sharesTrait: "other" }, 0, [], null, ctx, undefined, undefined, false, { other: ids.orc })).toEqual([ids.goblin]);
    expect(pickCandidates(state, { type: "enemy", control: "any", staging: true, minHitPoints: 5 }, 0, [], null, ctx)).toEqual([ids.orc]);
    expect(pickCandidates(state, { type: "hero", control: "any", printedKeyword: "ranged" }, 0, [], null, ctx)).toEqual([ids.archer]);
    const flagged = { ...state, modifiers: [{ instanceId: ids.aragorn!, sourceId: ids.aragorn!, stat: "ranged" as const, amount: 1, until: "endOfRound" as const }] };
    expect(pickCandidates(flagged, { type: "hero", control: "any", printedKeyword: "ranged" }, 0, [], null, ctx)).toEqual([ids.archer]);
  });

  it("reads the top card of a discard pile and an attachment on the event's card", () => {
    const { state, ids, ctx } = table([{ code: "aragorn", at: { zone: "discard", seat: 0 } }, { code: "event", at: { zone: "discard", seat: 0 } }, { code: "gimli", at: { zone: "heroes", seat: 0 } }, { code: "gear", at: { zone: "play", seat: 0 } }]);
    expect(pickCandidates(state, { type: "card", control: "you", from: "discard", topOfDiscard: true }, 0, [], null, ctx)).toEqual([ids.event]);
    const attached = updateCard(updateCard(state, ids.gear!, { host: ids.gimli!, zone: "attached" }), ids.gimli!, { attachments: [ids.gear!] });
    expect(pickCandidates(attached, { type: "attachment", control: "any", trait: "Weapon", onSubject: true }, 0, [], null, ctx, undefined, undefined, false, { subject: ids.gimli })).toEqual([ids.gear]);
  });

  it("remembers that a player engaged an enemy this round, in a game that reads it (08056:A:2)", () => {
    const haldir = record("aragorn:action:1", "aragorn", "action", [], { condition: { kind: "engagedThisRound", is: false } });
    const { state, ids, ctx } = table([{ code: "aragorn", at: { zone: "heroes", seat: 0 } }, { code: "orc", at: { zone: "engaged", seat: 0 } }], [haldir]);
    const scope = { actor: 0, sourceId: ids.aragorn!, returned: 0 };
    expect(holds(state, { kind: "engagedThisRound", is: false }, scope, ctx)).toBe(true);
    const noted = noteEngaged(state, { trigger: "engaged", seat: 0, subject: ids.orc! }, ctx);
    expect(holds(noted, { kind: "engagedThisRound", is: true }, scope, ctx)).toBe(true);
    expect(noteEngaged(state, { trigger: "engaged", seat: 0, subject: ids.orc! }, { ...ctx, effects: [] })).toBe(state);
  });

  it("announces an optional engagement to the cards that hear it (145012:A:3)", () => {
    const roheryn = record("aragorn:response:1", "aragorn", "response", [{ verb: "DeclareAttack", attacker: "self", enemy: "subject" }], { trigger: "optionallyEngaged", eventSeat: "you" });
    const { state, ids, ctx } = table([{ code: "aragorn", at: { zone: "heroes", seat: 0 } }, { code: "orc", at: { zone: "staging" } }], [roheryn]);
    const encounter = { ...state, phase: "Encounter" as const, boundaryPhase: "Encounter" as const, mode: "optionalEngage" as const, window: { kind: "optionalEngage" as const } };
    const engaged = expectOk(reduce(encounter, { type: "Engage", enemyId: ids.orc! }, ctx)).state;
    expect(legalIntents(engaged, ctx)).toContainEqual({ type: "Trigger", cardId: ids.aragorn, effectId: "aragorn:response:1" });
    const attacked = expectOk(reduce(engaged, { type: "Trigger", cardId: ids.aragorn!, effectId: "aragorn:response:1" }, ctx)).state;
    expect(attacked.cards[ids.orc!]?.damage).toBe(1);
    expect(attacked.cards[ids.aragorn!]?.exhausted).toBe(true);
  });
});
