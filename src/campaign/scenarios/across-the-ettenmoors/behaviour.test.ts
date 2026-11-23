// Rules: mec108.safe, mec108.objective-locations, mec108.objective-allies, mec108.side-quests-in-play, rr.guarded, rr.travel, rr.reveal, rr.doomed-x, rr.damage, rr.hit-points, rr.cannot, rr.effects, rr.in-play-and-out-of-play, rr.first-player, rr.the-word-choose, faq.lasting-effects, faq.progress-without-advancing (data/rules/entries.json).
// The moments the card specs cannot express on Across the Ettenmoors' own table: the stage's side quest progress, the travel lines of the safe locations, a guarded safe location, the damaged-character lines across seats, the excess damage, the choices of the first and the defending player, and
// the Lie Low round. Each test starts its title with the line it covers.
import { describe, expect, it } from "vitest";

import type { PlayerIntent } from "../../../rules/core/intents.ts";
import { modifiedStat, placeDamage } from "../../../rules/core/keywords.ts";
import { flagged, updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { moveCard, spawn } from "../../../rules/core/zones.ts";
import { canAttack, canDefend } from "../../../rules/combat/combat.ts";
import { combatDamage } from "../../../rules/families/defense/excess.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { pickCandidates } from "../../../rules/interpret/pick.ts";
import { guardWith } from "../../../rules/families/objectives/guard.ts";
import { setCurrentQuest } from "../../../rules/families/angmar/quest.ts";
import { queueEvent } from "../../../rules/windows/queue.ts";
import { begin } from "../../../../test/harness/scene.ts";
import { fightEnemy, finish, idOf, legalIntents, legalTargets, resolveRecords, revealFromTop, send, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const ID = "across-the-ettenmoors";
const at = (layout: Layout = {}) => tableFromLayout(ID, { stage: "10064", phase: "Quest", ...layout });
const SAFE = ["10068", "10069", "10070", "10071"];
const zoneOf = (state: ScenarioState, code: string): string | undefined => state.cards[idOf(state, code)]?.zone;
const stageOf = (state: ScenarioState) => state.cards[state.questStage ?? ""];
const hurt = (state: ScenarioState, ids: readonly string[], damage = 1): ScenarioState => ids.reduce((current, id) => updateCard(current, id, { damage }), state);
const choosing = (wanted: string) => (state: ScenarioState): string => (state.window?.kind === "choose" ? (state.window.options.find((option) => option === wanted) ?? state.window.options[0] ?? "") : "");

describe("10064:B:2 places a defeated side quest's printed quest points on the main stage", () => {
  it("10064:B:2 puts the quest points of Lie Low (8), Forage for Food (6) and Scavenge for Supplies (7) on Into the Ettenmoors, not on the side quest the first player made the current quest", () => {
    for (const [code, points] of [["10081", 8], ["10082", 6], ["10083", 7]] as const) {
      const t = at({ staging: [{ code, progress: points }] });
      const current = setCurrentQuest(t.state, idOf(t.state, code), t.ctx);
      expect(flagged(current, idOf(current, code), "currentQuest"), code).toBe(true);
      const state = settle(current, t.ctx, []);
      expect(zoneOf(state, code), code).toBe("victory");
      expect(stageOf(state)?.code, code).toBe("10064");
      expect(stageOf(state)?.progress, code).toBe(points);
    }
  });

  it("10064:B:2 hears a side quest's defeat only: a side quest that leaves play any other way places nothing", () => {
    const t = at({ staging: [{ code: "10081", progress: 3 }] });
    const quest = idOf(t.state, "10081");
    for (const to of ["encounterDiscard", "encounterDeck", "removed"] as const) {
      const state = settle(moveCard(t.state, quest, { zone: to }), t.ctx, []);
      expect(stageOf(state)?.progress, to).toBe(0);
    }
  });

  it("10064:B:2 advances a stage the progress fills, and what is beyond the stage's quest points is lost (faq.progress-without-advancing)", () => {
    const t = at({ staging: [{ code: "10083", progress: 7 }], progress: 5 });
    const state = settle(t.state, t.ctx, []);
    expect(stageOf(state)?.code).toBe("10065");
    expect(stageOf(state)?.progress).toBe(0);
  });
});

describe("10068:A:1, 10068:A:3, 10069:A:3, 10070:A:3 and 10071:A:3 hear the travel to that card only", () => {
  const offered = (state: ScenarioState, ctx: ReturnType<typeof at>["ctx"], code: string) => legalIntents(state, ctx).some((intent) => intent.type === "Trigger" && intent.cardId === idOf(state, code));

  it("10068:A:1 returns the engaged enemies, and the card's Response is offered, only when the players travel to that safe location", () => {
    for (const code of SAFE) {
      const t = at({ phase: "Travel", staging: [...SAFE, "place"], engaged: ["f3"] });
      const traveled = send(begin(t.state), { type: "Travel", locationId: idOf(t.state, code) }, t.ctx);
      expect(zoneOf(traveled.state, "f3"), code).toBe("staging");
      // The Response of the card travelled to (and of no other safe location) is offered by the travel.
      const heard = SAFE.filter((other) => offered(traveled.state, t.ctx, other));
      expect(heard, code).toEqual(code === "10068" || code === "10069" || code === "10070" || code === "10071" ? [code] : []);
    }
  });

  it("10068:A:3 a safe location hears nothing when the players travel to another location", () => {
    const t = at({ phase: "Travel", staging: [...SAFE, "place"], engaged: ["f3"] });
    const traveled = send(begin(t.state), { type: "Travel", locationId: idOf(t.state, "place") }, t.ctx);
    expect(zoneOf(traveled.state, "f3")).toBe("engaged");
    expect(SAFE.filter((code) => offered(traveled.state, t.ctx, code))).toEqual([]);
  });

  it("10068:A:1 does not return the engaged enemies when the players travel to the location that guards a safe location", () => {
    const t = at({ phase: "Travel", staging: ["10068", "place"], engaged: ["f3"] });
    const guarded = guardWith(t.state, idOf(t.state, "place"), idOf(t.state, "10068"));
    const traveled = send(begin(guarded), { type: "Travel", locationId: idOf(guarded, "place") }, t.ctx);
    expect(zoneOf(traveled.state, "f3")).toBe("engaged");
    expect(offered(traveled.state, t.ctx, "10068")).toBe(false);
  });

  it("10070:A:3 offers each player the choice to return 1 card from their discard pile to their hand", () => {
    const base = at({ phase: "Travel", staging: ["10070"] });
    const t = { ...base, state: spawn(base.state, "filler", { zone: "discard", seat: 0 }).state };
    const run = resolveRecords(t.state, t.ctx, "10070", "response", idOf(t.state, "10070"), choosing("return"));
    expect(run.state.seats[0]?.hand.map((id) => run.state.cards[id]?.code)).toContain("filler");
    const skipped = resolveRecords(t.state, t.ctx, "10070", "response", idOf(t.state, "10070"), choosing("skip"));
    expect(skipped.state.seats[0]?.hand ?? []).toEqual([]);
  });
});

describe("10068:A:1 is Guarded and Safe", () => {
  it("10068:A:1 cannot be the active location while an encounter card guards it, and can be once the guard leaves play", () => {
    const t = at({ phase: "Travel", staging: ["10068", "10081", "place"] });
    const guarded = guardWith(t.state, idOf(t.state, "10081"), idOf(t.state, "10068"));
    const targets = (state: ScenarioState) => legalTargets(state, { type: "Travel" }, t.ctx).map((id) => state.cards[id]?.code);
    expect(targets(guarded)).toContain("place");
    expect(targets(guarded)).not.toContain("10068");
    const free = settle(moveCard(guarded, idOf(guarded, "10081"), { zone: "encounterDiscard" }), t.ctx, []);
    expect(zoneOf(free, "10068")).toBe("staging");
    expect(targets(free)).toContain("10068");
  });

  it("10068:A:1 a second safe location that is next in the deck is revealed after the card behind it has guarded the first, and takes the card after that as its guard (rr.guarded)", () => {
    const t = at({ deck: ["10069", "f0", "f3", "f0"] });
    const done = finish({ state: revealFromTop(t.state, t.ctx, "10068", []).state, steps: [] }, t.ctx).state;
    expect(done.cards[idOf(done, "f0")]?.guard).toBe(true);
    expect(done.cards[idOf(done, "f0")]?.host).toBe(idOf(done, "10068"));
    expect(done.cards[idOf(done, "10069")]?.zone).toBe("staging");
    expect(done.cards[idOf(done, "f3")]?.guard).toBe(true);
    expect(done.cards[idOf(done, "f3")]?.host).toBe(idOf(done, "10069"));
    expect(done.encounterDeck.map((id) => done.cards[id]?.code)).toEqual(["f0"]);
  });
});

describe("10067:A:1 is Amarthiúl", () => {
  it("10067:A:1 lets the player who controls him give him to the player an enemy engages, and his destruction loses the game", () => {
    const t = at({ seats: 2, play: ["10067"], staging: ["f3"] });
    const queued = { ...t.state, pendingEvents: [{ trigger: "engaged" as const, seat: 1, subject: idOf(t.state, "f3") }] };
    const rested = settle({ ...queued, window: null, mode: "stopped" }, t.ctx, []);
    const offer = legalIntents(rested, t.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === idOf(rested, "10067"));
    expect(offer).toBeDefined();
    const given = finish(send({ state: rested, steps: [] }, offer as PlayerIntent, t.ctx), t.ctx).state;
    expect(given.cards[idOf(given, "10067")]?.controller).toBe(1);
    // The lose line: he cannot be modified and his destruction loses the game.
    const slain = settle({ ...updateCard(t.state, idOf(t.state, "10067"), { damage: 20 }), window: null, mode: "stopped" }, t.ctx, []);
    expect(slain.lost).toBe(true);
  });
});

describe("the damaged-character lines hear the right player", () => {
  it("10072:A:1 counts the damaged characters of the engaged player, not another player's", () => {
    const t = at({ seats: 2, engaged: [{ code: "10072", seat: 1 }] });
    const enemy = idOf(t.state, "10072");
    const base = modifiedStat(t.state, t.state.cards[enemy]!, "attack", t.cards);
    const seat1 = t.state.seats[1]?.heroes[0] ?? "";
    const seat0 = syncConstants(hurt(t.state, [t.hero]), t.ctx);
    expect(modifiedStat(seat0, seat0.cards[enemy]!, "attack", t.cards)).toBe(base);
    const mine = syncConstants(hurt(t.state, [seat1]), t.ctx);
    expect(modifiedStat(mine, mine.cards[enemy]!, "attack", t.cards)).toBe(base + 1);
  });

  it("10076:A:1 bars the damaged character only against this enemy: it defends another enemy's attack as ever", () => {
    const t = at({ phase: "Combat", engaged: ["f3", "10076"] });
    const other = idOf(t.state, "f3");
    const wounded = syncConstants(hurt(t.state, [t.hero], 1), t.ctx);
    const attacked: ScenarioState = { ...wounded, mode: "enemyAttacks", pendingAttack: { enemyId: other, seat: 0, shadowOffered: true, shadowResolved: true, heroId: t.hero, undefended: false } };
    expect(canDefend(attacked, 0, t.hero, t.cards)).toBe(true);
    expect(canAttack(wounded, 0, t.hero, idOf(wounded, "10076"), t.cards)).toBe(false);
    expect(canAttack(wounded, 0, t.hero, other, t.cards)).toBe(true);
  });

  it("10076:A:1 leaves every character damaged: the attack is undefended", () => {
    const t = at({ phase: "Combat", engaged: ["10076"] });
    const wounded = syncConstants(hurt(t.state, [t.hero, t.hero2], 1), t.ctx);
    const attacked: ScenarioState = { ...wounded, mode: "enemyAttacks", pendingAttack: { enemyId: idOf(wounded, "10076"), seat: 0, shadowOffered: true, shadowResolved: true, undefended: false } };
    expect([t.hero, t.hero2].some((id) => canDefend(attacked, 0, id, t.cards))).toBe(false);
  });
});

describe("10074:A:1 removes progress for the excess combat damage only", () => {
  const quests = (state: ScenarioState) => [stageOf(state)?.progress, state.cards[idOf(state, "10081")]?.progress];
  const table = () => at({ progress: 5, staging: [{ code: "10081", progress: 3 }, "10074"] });

  it("10074:A:1 removes nothing when the damage stays within the hit points the character had left", () => {
    const fight = fightEnemy((made: Layout) => at({ ...made, progress: 5, staging: [{ code: "10081", progress: 3 }] }), "f0", "10074", { phase: "Encounter", deckOf: ["filler"] }, {});
    expect(quests(fight.run.state)).toEqual([5, 3]);
  });

  it("10074:A:1 ignores damage that is not combat damage: direct damage beyond the hit points removes no progress", () => {
    const t = table();
    const steps: never[] = [];
    const hit = placeDamage(hurt(t.state, [t.hero], 5), t.hero, 4, t.cards, steps, "framework", { rule: "rr.damage" });
    expect(quests(settle(hit, t.ctx, []))).toEqual([5, 3]);
  });
});

describe("10074:A:1 leaves the enemy's other excess damage rules in force", () => {
  it("10074:A:1 removes the progress and still raises the threat when the enemy also sends excess damage to threat", () => {
    const t = at({ progress: 5, staging: [{ code: "10081", progress: 3 }, "10074"] });
    const troll = idOf(t.state, "10074");
    const flagged = { ...t.state, modifiers: [...t.state.modifiers, { instanceId: troll, sourceId: troll, stat: "excessToThreat", amount: 1, until: "endOfPhase" as const }] } as ScenarioState;
    const after = combatDamage(hurt(flagged, [t.hero], 5), troll, t.hero, 4, t.ctx, []);
    expect([stageOf(after)?.progress, after.cards[idOf(after, "10081")]?.progress]).toEqual([2, 0]);
    expect(after.seats[0]?.threat).toBe((flagged.seats[0]?.threat ?? 0) + 3);
  });
});

describe("10075:A:2, 10077:A:1, 10078:A:1 and 10081:A:1 read the right cards and players", () => {
  it("10075:A:2 offers the safe locations in the staging area and the active location, guarded or not, and never the victory display", () => {
    const t = at({ staging: ["10069", "10081", "10075"], active: "10068", victory: ["10070"] });
    const guarded = guardWith(t.state, idOf(t.state, "10081"), idOf(t.state, "10069"));
    const found = pickCandidates(guarded, { type: "objective", control: "any", safe: true }, 0, [], idOf(guarded, "10075"), t.ctx);
    expect(found.map((id) => guarded.cards[id]?.code).sort()).toEqual(["10068", "10069"]);
  });

  it("10077:A:1 makes a Weather card that prints no Doomed raise each player's threat by 1 when revealed while it is the active location", () => {
    const threatAfter = (layout: Layout) => {
      const t = at({ deck: ["09052"], ...layout });
      const run = revealFromTop(t.state, t.ctx, "09052", []);
      return finish({ state: run.state, steps: [] }, t.ctx).state.seats[0]?.threat ?? 0;
    };
    expect(threatAfter({ active: "10077" })).toBe(threatAfter({}) + 1);
  });

  it("10078:A:1 lets the ally's controller choose, not the first player", () => {
    const t = at({ seats: 2, staging: ["10078"], play: [{ code: "ally", seat: 1 }] });
    const ally = idOf(t.state, "ally");
    const entered = queueEvent(t.state, { trigger: "enteredPlay", seat: 1, cardId: ally });
    const asked = settle({ ...entered, window: null, mode: "stopped" }, t.ctx, []);
    expect(asked.window?.kind).toBe("choose");
    expect(asked.activeSeat).toBe(1);
  });

  it("10081:A:1 clears the no-progress note each round, so the Forced effect is read afresh, and the -20 reaches an enemy that enters later in the round", () => {
    const t = at({ staging: ["10081"], deck: ["f0"] });
    const quest = idOf(t.state, "10081");
    const placed: ScenarioState = { ...t.state, modifiers: [...t.state.modifiers, { instanceId: quest, sourceId: quest, stat: "progressPlacedHere", amount: 1, until: "endOfRound" as const }] };
    expect(flagged(placed, quest, "progressPlacedHere")).toBe(true);
    // The Forced effect reads no progress this round: the -20 until the end of the round is a lasting effect that an enemy entering afterwards also has.
    const run = resolveRecords(t.state, t.ctx, "10081", "forced", quest);
    const revealed = revealFromTop(run.state, t.ctx, "f3", []);
    const entered = finish({ state: revealed.state, steps: [] }, t.ctx).state;
    const cost = modifiedStat(syncConstants(entered, t.ctx), entered.cards[revealed.id]!, "engagementCost", t.cards);
    expect(cost).toBe(Math.max(0, 50 - 20));
    // A later round: the note is gone (until: endOfRound) and so is the -20.
    const next = { ...entered, modifiers: entered.modifiers.filter((modifier) => modifier.until !== "endOfRound") };
    expect(modifiedStat(syncConstants(next, t.ctx), next.cards[revealed.id]!, "engagementCost", t.cards)).toBe(50);
  });
});
