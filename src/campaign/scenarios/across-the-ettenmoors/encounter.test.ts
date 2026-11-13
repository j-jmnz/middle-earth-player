// Rules: mec108.safe, mec108.objective-locations, mec108.side-quests-in-play, rr.cannot, rr.damage, rr.hit-points, rr.doomed-x, rr.search, rr.travel, rr.the-word-choose, rr.first-player, rr.effects, rr.reveal, rr.guarded, faq.additional-attacks, faq.lasting-effects (data/rules/entries.json).
// The enemies, locations, treacheries and side quests of Across the Ettenmoors on the scenario's own table. Each test starts its title with the line it covers; stages.test.ts holds the stages and the campaign card.
import { describe, expect, it } from "vitest";

import type { PlayerIntent } from "../../../rules/core/intents.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { flagged, updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { canAttack, canDefend } from "../../../rules/combat/combat.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { queueEvent } from "../../../rules/windows/queue.ts";
import { begin } from "../../../../test/harness/scene.ts";
import { codesIn, fightEnemy, legalIntents, send, finish, idOf, resolveRecords, revealFromTop, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const ID = "across-the-ettenmoors";
const at = (layout: Layout = {}) => tableFromLayout(ID, { stage: "10064", phase: "Quest", ...layout });
const damageOn = (state: ScenarioState, id: string): number => state.cards[id]?.damage ?? 0;
const zoneOf = (state: ScenarioState, code: string): string | undefined => state.cards[idOf(state, code)]?.zone;
const hurt = (state: ScenarioState, ids: readonly string[], damage = 1): ScenarioState => ids.reduce((current, id) => updateCard(current, id, { damage }), state);
const choosing = (wanted: string) => (state: ScenarioState): string => (state.window?.kind === "choose" ? (state.window.options.find((option) => option === wanted) ?? state.window.options[0] ?? "") : "");
const attackOf = (t: ReturnType<typeof at>, state: ScenarioState, code: string) => modifiedStat(state, state.cards[idOf(state, code)]!, "attack", t.cards);

describe("10072:A:1 and 10072:A:2 are the Savage Trollspawn's lines", () => {
  it("10072:A:1 gets +1 Attack for each damaged character the engaged player controls, only while engaged", () => {
    const t = at({ engaged: ["10072"], play: ["ally", "ally"] });
    const base = attackOf(t, t.state, "10072");
    const allies = Object.values(t.state.cards).filter((card) => card.code === "ally").map((card) => card.id);
    const damaged = syncConstants(hurt(t.state, [t.hero, ...allies.slice(0, 1)]), t.ctx);
    expect(attackOf(t, damaged, "10072")).toBe(base + 2);
    const staged = at({ staging: ["10072"], play: ["ally"] });
    expect(attackOf(staged, syncConstants(hurt(staged.state, [staged.hero]), staged.ctx), "10072")).toBe(attackOf(staged, staged.state, "10072"));
  });

  it("10072:A:2 gives the attacking enemy +1 Attack for each damaged character the defending player controls", () => {
    const fight = (damaged: boolean) => fightEnemy((made: Layout) => at(made), "10072", "f3", { phase: "Encounter", deckOf: ["filler"] }, { undefended: true, tweak: (state, made) => (damaged ? hurt(state, [made.hero2], 1) : state) });
    const plain = fight(false);
    const wounded = fight(true);
    // f3 has 1 Attack against an undefended hero; one damaged character adds 1.
    expect(damageOn(wounded.run.state, wounded.made.hero)).toBe(damageOn(plain.run.state, plain.made.hero) + 1);
  });
});

describe("10073:A:1 and 10073:A:2 are the Coldfell Giant's lines", () => {
  it("10073:A:1 deals 1 damage to each of 3 different characters you control, chosen by the player", () => {
    const t = at({ staging: ["10073"], play: ["ally", "ally"] });
    const run = resolveRecords(t.state, t.ctx, "10073", "forced", idOf(t.state, "10073"));
    const hit = Object.values(run.state.cards).filter((card) => (card.zone === "heroes" || card.zone === "play") && card.damage > 0);
    expect(hit).toHaveLength(3);
    expect(hit.every((card) => card.damage === 1)).toBe(true);
  });

  it("10073:A:1 hits each character there is when fewer than 3 are controlled", () => {
    const t = at({ staging: ["10073"] });
    const run = resolveRecords(t.state, t.ctx, "10073", "forced", idOf(t.state, "10073"));
    expect([damageOn(run.state, t.hero), damageOn(run.state, t.hero2)]).toEqual([1, 1]);
  });

  it("10073:A:2 makes an additional attack after this one when the defending character has damage on it, and not otherwise", () => {
    const attacksMade = (damaged: boolean) => {
      const fight = fightEnemy((made: Layout) => at(made), "10073", "f3", { phase: "Encounter", deckOf: ["filler", "filler"], deck: ["10073", "f0", "f0", "f0", "f0", "f0"] }, { tweak: (state, made) => (damaged ? hurt(state, [made.hero], 1) : state) });
      // Every attack the enemy makes appears as a strike step; the log of the run holds them all.
      return fight.run.steps.filter((step) => step.kind === "attack").length;
    };
    expect(attacksMade(true)).toBe(attacksMade(false) + 1);
  });
});

describe("10074:A:1 is the Cruel Mountain-troll's line", () => {
  it("10074:A:1 removes 1 progress from each quest card in play for each excess point of combat damage it deals", () => {
    const fight = fightEnemy((made: Layout) => at({ ...made, progress: 5, staging: [{ code: "10081", progress: 3 }] }), "f0", "10074", { phase: "Encounter", deckOf: ["filler"] }, { tweak: (state, made) => hurt(state, [made.hero], 4) });
    const state = fight.run.state;
    // Attack 6 against 2 Defense: 4 damage on a hero with 6 hit points and 4 damage: 2 points are beyond what it had left.
    expect(state.cards[state.questStage ?? ""]?.progress).toBe(3);
    expect(state.cards[idOf(state, "10081")]?.progress).toBe(1);
  });
});

describe("10075:A:1 and 10075:A:2 are the Ruthless Hill-troll's lines", () => {
  it("10075:A:1 gets +2 Attack and +2 Defense while it has 3 or more damage", () => {
    const t = at({ engaged: [{ code: "10075", damage: 2 }] });
    const defenseOf = (state: ScenarioState) => modifiedStat(state, state.cards[idOf(state, "10075")]!, "defense", t.cards);
    const before = [attackOf(t, t.state, "10075"), defenseOf(t.state)];
    const worn = syncConstants(updateCard(t.state, idOf(t.state, "10075"), { damage: 3 }), t.ctx);
    expect([attackOf(t, worn, "10075"), defenseOf(worn)]).toEqual([before[0]! + 2, before[1]! + 2]);
  });

  it("10075:A:2 shuffles a location with the safe keyword (the active one, or a staged one) into the encounter deck, and its guard stays in the staging area", () => {
    const t = at({ staging: ["10069", "10081"], deck: ["f0"] });
    const place = idOf(t.state, "10069");
    const quest = idOf(t.state, "10081");
    const guarded: ScenarioState = { ...t.state, cards: { ...t.state.cards, [quest]: { ...t.state.cards[quest]!, host: place, guard: true }, [place]: { ...t.state.cards[place]!, attachments: [quest] } } };
    const run = resolveRecords(guarded, t.ctx, "10075", "shadow");
    expect(run.state.cards[place]?.zone).toBe("encounterDeck");
    expect(run.state.cards[quest]?.zone).toBe("staging");
    expect(run.state.cards[quest]?.host ?? null).toBeNull();
    const active = at({ active: "10068", deck: ["f0"] });
    const gone = resolveRecords(active.state, active.ctx, "10075", "shadow");
    expect(zoneOf(gone.state, "10068")).toBe("encounterDeck");
    expect(gone.state.activeLocation).toBeNull();
    const none = at({ deck: ["f0"] });
    expect(resolveRecords(none.state, none.ctx, "10075", "shadow").state.encounterDeck).toHaveLength(1);
  });
});

describe("10076:A:1 is the Goblin Pursuer's line", () => {
  it("10076:A:1 bars a damaged character from being declared as an attacker against it, and as a defender against its attack", () => {
    const t = at({ phase: "Combat", engaged: ["10076"] });
    const enemy = idOf(t.state, "10076");
    const wounded = syncConstants(hurt(t.state, [t.hero], 1), t.ctx);
    expect(canAttack(wounded, 0, t.hero, enemy, t.cards)).toBe(false);
    expect(canAttack(wounded, 0, t.hero2, enemy, t.cards)).toBe(true);
    const attacked: ScenarioState = { ...wounded, mode: "enemyAttacks", pendingAttack: { enemyId: enemy, seat: 0, shadowOffered: true, shadowResolved: true, heroId: t.hero, undefended: false } };
    expect(canDefend(attacked, 0, t.hero, t.cards)).toBe(false);
    expect(canDefend(attacked, 0, t.hero2, t.cards)).toBe(true);
    // Against another enemy a damaged character attacks and defends as ever.
    const other = at({ phase: "Combat", engaged: ["f3"] });
    const woundedOther = syncConstants(hurt(other.state, [other.hero], 1), other.ctx);
    expect(canAttack(woundedOther, 0, other.hero, idOf(woundedOther, "f3"), other.cards)).toBe(true);
  });
});

describe("10077:A:1 and 10077:A:2 are Troll-fells' lines", () => {
  it("10077:A:1 gives each Weather card Doomed 1 more while it is the active location", () => {
    const threatAfter = (layout: Layout) => {
      const t = at({ deck: ["09053"], ...layout });
      const run = revealFromTop(t.state, t.ctx, "09053", []);
      return finish({ state: run.state, steps: [] }, t.ctx).state.seats[0]?.threat ?? 0;
    };
    // Freezing Blast prints Doomed 2.
    expect(threatAfter({ active: "10077" })).toBe(threatAfter({}) + 1);
  });

  it("10077:A:2 searches the encounter deck for a location with the safe keyword and attaches it to Troll-fells as its guard, then shuffles", () => {
    const t = at({ deck: ["f0", "10069"] });
    const run = revealFromTop(t.state, t.ctx, "10077", []);
    const state = finish({ state: run.state, steps: [] }, t.ctx).state;
    const place = state.cards[idOf(state, "10069")];
    expect(place?.zone).toBe("staging");
    // Troll-fells is the guard, attached to the safe location it guards.
    expect(state.cards[run.id]?.host).toBe(place?.id);
    expect(state.cards[run.id]?.guard).toBe(true);
  });

  it("10077:A:2 does nothing but shuffle when Troll-fells is revealed guarding a safe location", () => {
    const t = at({ deck: ["10077", "10069"], setAside: [] });
    const run = revealFromTop(t.state, t.ctx, "10068", []);
    const state = finish({ state: run.state, steps: [] }, t.ctx).state;
    // Secluded Cave's Guarded revealed Troll-fells as its guard: the other safe location stays in the encounter deck.
    expect(state.cards[idOf(state, "10077")]?.host).toBe(idOf(state, "10068"));
    expect(zoneOf(state, "10069")).toBe("encounterDeck");
  });
});

describe("10078:A:1 and 10078:A:2 are Barren Moorland's lines", () => {
  it("10078:A:1 makes the ally's controller exhaust it or deal it 1 damage when an ally enters play, only while it is in the staging area", () => {
    const t = at({ staging: ["10078"], play: ["ally"] });
    const ally = idOf(t.state, "ally");
    const entered = queueEvent(t.state, { trigger: "enteredPlay", seat: 0, cardId: ally });
    const exhausted = finish({ state: settle({ ...entered, window: null, mode: "stopped" }, t.ctx, []), steps: [] }, t.ctx).state;
    expect(exhausted.cards[ally]?.exhausted).toBe(true);
    const active = at({ active: "10078", play: ["ally"] });
    const quiet = settle({ ...queueEvent(active.state, { trigger: "enteredPlay", seat: 0, cardId: idOf(active.state, "ally") }), window: null, mode: "stopped" }, active.ctx, []);
    expect(quiet.cards[idOf(quiet, "ally")]?.exhausted).toBe(false);
    expect(damageOn(quiet, idOf(quiet, "ally"))).toBe(0);
  });

  it("10078:A:2 deals 1 damage to each exhausted character as a Travel cost that is always payable", () => {
    const t = at({ staging: ["10078"], play: ["ally"] });
    const tired = updateCard(updateCard(t.state, t.hero, { exhausted: true }), idOf(t.state, "ally"), { exhausted: true });
    const run = resolveRecords(tired, t.ctx, "10078", "travel", idOf(tired, "10078"));
    expect([damageOn(run.state, t.hero), damageOn(run.state, t.hero2), damageOn(run.state, idOf(run.state, "ally"))]).toEqual([1, 0, 1]);
    const none = resolveRecords(t.state, t.ctx, "10078", "travel", idOf(t.state, "10078"));
    expect(damageOn(none.state, t.hero)).toBe(0);
  });
});

describe("10079:A:1 is Arador's Bane", () => {
  it("10079:A:1 lets each player search for a Troll or Giant and add it to the staging area, shuffling the deck", () => {
    const t = at({ deck: ["f0", "10073", "10074"] });
    const run = resolveRecords(t.state, t.ctx, "10079", "whenRevealed", undefined, choosing("search"));
    expect(codesIn(run.state, "staging").filter((code) => ["10073", "10074"].includes(code))).toHaveLength(1);
  });

  it("10079:A:1 lets a player engage an enemy with an engagement cost above their threat and deals it 2 shadow cards", () => {
    const t = at({ staging: ["f3"], deck: ["f0", "f0", "f0"], threat: [20, 20] });
    const run = resolveRecords(t.state, t.ctx, "10079", "whenRevealed", undefined, choosing("engage"));
    const engaged = run.state.seats[0]?.engaged ?? [];
    expect(engaged.map((id) => run.state.cards[id]?.code)).toEqual(["f3"]);
    // Dealt 2 shadow cards at once: the encounter deck gave up 2 cards, the enemy holds the first and the second is attached to it as an additional shadow.
    expect(run.state.encounterDeck).toHaveLength(1);
    expect(run.state.cards[engaged[0] ?? ""]?.shadowId).not.toBeNull();
  });
});

describe("10080:A:1 is No Rest", () => {
  it("10080:A:1 attaches to an exhausted hero (the first player chooses), else to a ready hero, and the host cannot ready or collect resources", () => {
    const t = at({ phase: "Refresh" });
    const tired = updateCard(t.state, t.hero2, { exhausted: true });
    const run = resolveRecords(tired, t.ctx, "10080", "whenRevealed");
    expect(run.state.cards[idOf(run.state, "10080")]?.host).toBe(t.hero2);
    const synced = syncConstants(run.state, t.ctx);
    expect(flagged(synced, t.hero2, "cannotReady")).toBe(true);
    expect(flagged(synced, t.hero2, "noCollection")).toBe(true);
    const ready = resolveRecords(t.state, t.ctx, "10080", "whenRevealed");
    expect(ready.state.cards[idOf(ready.state, "10080")]?.host).not.toBeNull();
  });

  it("10080:A:1 is discarded when the players travel to a location with the safe keyword", () => {
    const t = at({ staging: ["10068"], phase: "Travel" });
    const tired = updateCard(t.state, t.hero2, { exhausted: true });
    const attached = resolveRecords(tired, t.ctx, "10080", "whenRevealed").state;
    const travelled = settle({ ...queueEvent(attached, { trigger: "traveled", seat: 0, cardId: idOf(attached, "10068") }), window: null, mode: "stopped" }, t.ctx, []);
    expect(zoneOf(travelled, "10080")).toBe("encounterDiscard");
  });
});

describe("10081:A:1 and 10081:A:2 are Lie Low", () => {
  it("10081:A:1 gives each enemy -20 engagement cost until the end of the round when no progress was placed on it this round", () => {
    const t = at({ staging: ["10081", "f3"] });
    const quest = idOf(t.state, "10081");
    const cost = (state: ScenarioState) => modifiedStat(state, state.cards[idOf(state, "f3")]!, "engagementCost", t.cards);
    const base = cost(t.state);
    const run = resolveRecords(t.state, t.ctx, "10081", "forced", quest);
    expect(cost(syncConstants(run.state, t.ctx))).toBe(Math.max(0, base - 20));
    // Progress placed on it this round (noted by the engine) stops the Forced effect.
    const placed: ScenarioState = { ...t.state, modifiers: [...t.state.modifiers, { instanceId: quest, sourceId: quest, stat: "progressPlacedHere", amount: 1, until: "endOfRound" as const }] };
    const stayed = resolveRecords(placed, t.ctx, "10081", "forced", quest);
    expect(cost(syncConstants(stayed.state, t.ctx))).toBe(base);
  });

  it("10081:A:2 shuffles an enemy of the staging area into the encounter deck after it is defeated", () => {
    const t = at({ staging: ["10081", "f3"], deck: ["f0"] });
    const run = resolveRecords(t.state, t.ctx, "10081", "response", idOf(t.state, "10081"));
    expect(zoneOf(run.state, "f3")).toBe("encounterDeck");
  });
});

describe("10082:A:1 and 10082:A:2 are Forage for Food", () => {
  it("10082:A:1 deals 1 damage to a hero when resources are spent from its pool (once for each hero that paid)", () => {
    const t = at({ staging: ["10082"], phase: "Planning", hand: ["ally"], heroResources: 3 });
    // The player plays an ally of cost 1, paid from a hero's pool: the engine announces the hero that paid, and Forage for Food hears it.
    let run = begin(t.state);
    const card = legalIntents(run.state, t.ctx).find((intent) => intent.type === "PlayCard");
    expect(card).toBeDefined();
    run = send(run, { ...(card as Extract<PlayerIntent, { type: "PlayCard" }>), payments: [{ heroId: t.hero2, amount: 1 }] }, t.ctx);
    const payer = t.hero2;
    expect(payer).toBeDefined();
    expect(damageOn(run.state, payer ?? "")).toBe(1);
    expect([t.hero, t.hero2].filter((id) => damageOn(run.state, id) > 0)).toEqual([payer]);
    // A resource added by an effect is not spent: no damage.
    expect(damageOn(settle({ ...queueEvent(t.state, { trigger: "resourcesAdded", seat: 0, cardId: t.hero }), window: null, mode: "stopped" }, t.ctx, []), t.hero)).toBe(0);
  });

  it("10082:A:2 heals 1 damage from each hero after it is defeated", () => {
    const t = at({ staging: ["10082"] });
    const wounded = hurt(t.state, [t.hero, t.hero2], 2);
    const run = resolveRecords(wounded, t.ctx, "10082", "response", idOf(wounded, "10082"));
    expect([damageOn(run.state, t.hero), damageOn(run.state, t.hero2)]).toEqual([1, 1]);
  });
});

describe("10083:A:1 and 10083:A:2 are Scavenge for Supplies", () => {
  it("10083:A:2 puts a Troll from the encounter deck into play engaged with the player with the highest threat, then each player may play a card at no cost", () => {
    const t = at({ staging: ["10083"], seats: 2, threat: [25, 31], deck: ["f0", "10074"], hand: ["ally"] });
    const run = resolveRecords(t.state, t.ctx, "10083", "forced", idOf(t.state, "10083"), choosing("skip"));
    expect(run.state.seats[1]?.engaged.map((id) => run.state.cards[id]?.code)).toContain("10074");
  });
});

describe("10183:A:2 and 10183:A:3 are Losing Time", () => {
  it("10183:A:2 makes each player raise their threat by 3 or exhaust a hero they control", () => {
    const t = at({ deck: ["f0", "f0"] });
    const threat = t.state.seats[0]?.threat ?? 0;
    const raised = resolveRecords(t.state, t.ctx, "10183", "whenRevealed", undefined, choosing("threat"));
    expect(raised.state.seats[0]?.threat).toBe(threat + 3);
    const exhausted = resolveRecords(t.state, t.ctx, "10183", "whenRevealed", undefined, choosing("exhaust"));
    expect(Object.values(exhausted.state.cards).filter((card) => card.zone === "heroes" && card.exhausted)).toHaveLength(1);
  });

  it("10183:A:3 lets the defending player give the attacking enemy +3 Attack or +3 Defense until the end of the phase", () => {
    const fight = (option: string) => fightEnemy((made: Layout) => at(made), "10183", "f3", { phase: "Encounter", deckOf: ["filler"] }, { undefended: true, pick: () => option });
    expect(damageOn(fight("attack").run.state, fight("attack").made.hero)).toBeGreaterThan(damageOn(fight("defense").run.state, fight("defense").made.hero));
  });
});
