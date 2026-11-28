// Rules: rr.forced, rr.shadow-effects, rr.travel, rr.reveal, rr.then, rr.explored, rr.attachment-cards, rr.engaged, rr.first-player, rr.player-elimination, rr.threat-elimination-level, rr.setup, rr.quest-advancement, rr.cost (data/rules/entries.json).
// What a spec row cannot show (two attacks, the order of two Forced effects, the Secret Cultist's life, a cap over a round, the Setup, a line no record changes the game for), on tables built from layouts (tableFromLayout). Each title starts with its line id.
// The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points; a layout's current stage is on its B side.
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { eliminateSeat, eliminationLevel } from "../../../rules/core/eliminate.ts";
import { placeDamage } from "../../../rules/core/damage.ts";
import { UNATTRIBUTED } from "../../../rules/core/cause.ts";
import { expireModifiers, flagged, updateCard } from "../../../rules/core/state.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { spawn } from "../../../rules/core/zones.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { restricted } from "../../../rules/interpret/restrictions.ts";
import { placeQuestProgress } from "../../../rules/quest/quest.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { raiseThreat } from "../../../rules/core/threat-dial.ts";
import { fireForced } from "../../../rules/windows/triggers.ts";
import { queueEvent } from "../../../rules/windows/queue.ts";
import { allyCard, drive, fightEnemy, finish, idOf, idsOf, legalIntents, opened, resolveRecords, revealedTop, revealFromTop, run, send, start, statOf, tableFromLayout, where, zoneOf, type Layout } from "../../../../test/harness/scene-kit.ts";
import { definePrinted } from "../../../rules/core/printed.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";

const ID = "danger-in-dorwinion";
const table = (layout: Layout, effects = EFFECTS) => tableFromLayout(ID, { seats: 1, stage: "21077", phase: "Quest", ...layout }, { effects });
const S1 = "21077";
const S2 = "21078";
const PRIEST = "21030";
const BLACK = "21032";
const BRIBES = "21033";
const SUBMIT = "21034";
const SAURON = "21035";
const EVIDENCE = "21036";
const MANOR = "21037";
const SECRET = "21039";
const TAVERN = "21047";
const STREET = "21049";
const UNDER_GUARD = "21051";

// The progress that explores the active location, and the Forced effects it opens (the stage and Bribes both hear it: the first player orders them).
const explore = (made: ReturnType<typeof table>, state: ScenarioState): ScenarioState => finish({ state: run(made, state, { verb: "PlaceProgressOn", amount: 99, target: "activeLocation" }), steps: [] }, made.ctx).state;
const resourcesOf = (state: ScenarioState, code: string): number => state.cards[idOf(state, code)]?.resources ?? 0;

describe("Submit or Die (21034:A:2): which characters an attack destroys", () => {
  it("21034:A:2 a character destroyed outside an attack (damage an effect places) puts no damage token here", () => {
    const made = table({ staging: [SUBMIT], play: ["ally"] });
    const ally = idOf(made.state, "ally");
    const dead = settle(placeDamage(made.state, ally, 5, made.ctx.cards, [], "framework", UNATTRIBUTED), made.ctx, []);
    expect(where(dead, "ally")).toBe("discard");
    expect(resourcesOf(dead, SUBMIT)).toBe(0);
    expect(dead.cards[idOf(dead, SUBMIT)]?.damage).toBe(0);
  });
});

// Two rounds of combat with Black Númenórean engaged: the shadow card of round 1 (Darkness in the East, +1 Attack, +2 after a raise) stays faceup on him, and in round 2 the new card (Rhûn Backstabber's shadow raises the defending player's threat) resolves first, then the held card
// "as if it had been dealt this round", after the defender is declared (here none: the hero takes the whole Attack).
describe("Black Númenórean (21032:A:2, 21032:A:3): the held shadow cards resolve again at each attack", () => {
  const DARKNESS = "21048";
  const BACKSTABBER = "21044";
  function twoRounds(effects: readonly (typeof EFFECTS)[number][]) {
    const made = table({ phase: "Encounter", engaged: [BLACK], deck: [DARKNESS, "f0", BACKSTABBER, "f0", "f0", "f0"], hand: ["filler", "filler"] }, effects);
    // The table notes a threat raise as Setup leaves it (21077:A:1).
    const noting = { ...made.state, modifiers: [...made.state.modifiers, { instanceId: "table", sourceId: idOf(made.state, S1), stat: "noteThreatRaised" as const, amount: 1, until: "endOfGame" as const }] };
    return { made, state: syncConstants(noting, made.ctx) };
  }
  function toDefense(made: { ctx: Parameters<typeof send>[2] }, from: ReturnType<typeof start>, round: number) {
    const run0 = drive(made, from, (state) => state.window?.kind === "defense" && state.round === round);
    if (run0.state.window?.kind !== "defense") throw new Error(`no defense window in round ${round}: ${JSON.stringify(run0.state.window)}`);
    return run0;
  }
  function play(effects: readonly (typeof EFFECTS)[number][]) {
    const { made, state } = twoRounds(effects);
    const enemy = idOf(state, BLACK);
    const hero = idOf(state, "dh1");
    const first = toDefense(made, start(state), 0);
    const firstHit = send(first, { type: "Undefended", heroId: hero }, made.ctx);
    const afterOne = drive(made, firstHit, (current) => current.round === 1 || current.lost === true);
    const second = toDefense(made, afterOne, 1);
    // The first attack destroys the first hero (6 hit points), so the second falls on the second hero.
    const other = idOf(state, "dh2");
    const hit = drive(made, send(second, { type: "Undefended", heroId: other }, made.ctx), (current) => current.pendingAttack == null);
    return { afterOne: afterOne.state, enemy, round2Damage: hit.state.cards[other]?.damage ?? 0, hit: hit.state };
  }

  lineSpec("21032:A:2", "the shadow card with a shadow effect dealt to him stays faceup on him past the end of the combat phase", (effects) => {
    const game = play(effects);
    const kept = game.afterOne.cards[game.enemy]?.shadowId ?? "";
    expect(game.afterOne.cards[kept]?.code).toBe(DARKNESS);
    expect(game.afterOne.cards[kept]?.zone).toBe("shadow");
  });

  lineSpec("21032:A:3", "in round 2 the new card resolves first and the held card after it, so Darkness sees the raise: 5 Attack, +2", (effects) => {
    const game = play(effects);
    expect(game.round2Damage).toBe(7);
  });
});

// Round 2 with a stand-in Response that cancels a shadow effect (Hasty Stroke): it cancels the new card's effect, and the held cards still resolve (21032:A:3 does not rest on the new card's effect).
describe("Black Númenórean (21032:A:3): the new shadow effect is canceled", () => {
  const WARD = { id: "ward:response:1", cardCode: "ward", lines: ["ward:A:1"], timing: "response" as const, trigger: "shadowPending" as const, instructions: [{ verb: "CancelEffect" as const }] };
  function round2Damage(cancel: boolean): number {
    const effects = [...EFFECTS, WARD];
    const made = table({ phase: "Encounter", engaged: [BLACK], deck: ["21048", "f0", "21044", "f0", "f0", "f0"], hand: ["filler", "filler"] }, effects);
    made.cards.set("ward", definePrinted({ code: "ward", name: "Ward", type: "attachment" }));
    const noting = { ...made.state, modifiers: [...made.state.modifiers, { instanceId: "table", sourceId: idOf(made.state, S1), stat: "noteThreatRaised" as const, amount: 1, until: "endOfGame" as const }] };
    const state = syncConstants(noting, made.ctx);
    const first = drive(made, start(state), (current) => current.window?.kind === "defense" && current.round === 0);
    const firstHit = drive(made, send(first, { type: "Undefended", heroId: idOf(state, "dh1") }, made.ctx), (current) => current.round === 1 || current.lost === true);
    const warded = spawn(firstHit.state, "ward", { zone: "play", seat: 0 }).state;
    const second = drive(made, { ...firstHit, state: syncConstants(warded, made.ctx) }, (current) => current.window?.kind === "defense" && current.round === 1);
    const other = idOf(state, "dh2");
    let current = send(second, { type: "Undefended", heroId: other }, made.ctx);
    let canceled = false;
    for (let guard = 0; guard < 60 && current.state.pendingAttack != null && !current.state.lost; guard += 1) {
      const intents = legalIntents(current.state, made.ctx);
      const offer = intents.find((intent) => intent.type === "Trigger" && intent.effectId === WARD.id);
      if (cancel && !canceled && offer) {
        canceled = true;
        current = send(current, offer as never, made.ctx);
        continue;
      }
      const pass = intents.find((intent) => intent.type === "Pass");
      if (!pass) break;
      current = send(current, pass, made.ctx);
    }
    expect(canceled).toBe(cancel);
    return current.state.cards[other]?.damage ?? 0;
  }

  it("21032:A:3 with the new card's effect canceled the held card still resolves: +1 Attack, and no +2 (nothing raised the threat)", () => {
    expect(round2Damage(false)).toBe(7);
    expect(round2Damage(true)).toBe(6);
  });
});

describe("Secret Cultist (21039:A:1): the ally with the highest Attack becomes an enemy engaged with its owner", () => {
  // A weak ally (attack 1) in play and a strong one (attack 4); the Cultist is revealed from the top of the deck.
  function cultist(layout: Layout, effects = EFFECTS, strong: { attack: number; seat?: number } = { attack: 4 }) {
    const made = table({ play: ["ally"], ...layout }, effects);
    made.cards.set("strong", allyCard("strong", 3, { attack: strong.attack, willpower: 2 }));
    const spawned = spawn(made.state, "strong", { zone: "play", seat: strong.seat ?? 0 });
    return { made: { ...made, state: spawned.state }, strong: spawned.id };
  }

  lineSpec("21039:A:1", "the strongest ally becomes an enemy with no Threat, engaged with its owner, and the Cultist is attached to it", (effects) => {
    const { made, strong } = cultist({}, effects);
    const state = revealedTop(made, SECRET);
    expect(state.cards[strong]).toMatchObject({ code: "strong~enemy", zone: "engaged", controller: 0 });
    expect(state.cards[idOf(state, SECRET)]).toMatchObject({ zone: "attached", host: strong });
    expect(state.seats[0]?.engaged).toContain(strong);
    expect(statOf(state, made.ctx.cards, "strong~enemy", "threat")).toBe(0);
    expect(statOf(state, made.ctx.cards, "strong~enemy", "attack")).toBe(4);
  });

  lineSpec("21039:A:1", "the highest Attack is the one the ally has now: a weak ally with +5 Attack is the one chosen", (effects) => {
    const { made } = cultist({}, effects);
    const weak = idOf(made.state, "ally");
    const boosted = { ...made.state, modifiers: [...made.state.modifiers, { instanceId: weak, sourceId: weak, stat: "attack" as const, amount: 5, until: "endOfPhase" as const }] };
    const state = revealedTop({ ...made, state: boosted }, SECRET);
    expect(state.cards[weak]?.code).toBe("ally~enemy");
  });

  lineSpec("21039:A:1", "allies tied on Attack: the first player (seat 1) chooses which becomes the enemy", (effects) => {
    const made = table({ seats: 2, firstPlayer: 1, play: [{ code: "ally", seat: 0 }, { code: "ally", seat: 1 }] }, effects);
    const steps: EngineStep[] = [];
    const revealed = revealFromTop(made.state, made.ctx, SECRET, steps);
    expect(revealed.state.window?.kind).toBe("choose");
    const [one, two] = idsOf(revealed.state, "ally");
    expect(revealed.state.window?.kind === "choose" ? [...revealed.state.window.options].sort() : []).toEqual([one, two].sort());
    const seat1 = idsOf(revealed.state, "ally").find((id) => revealed.state.cards[id]?.controller === 1) ?? "";
    const done = finish({ state: revealed.state, steps }, made.ctx, () => seat1).state;
    expect(done.cards[seat1]).toMatchObject({ code: "ally~enemy", zone: "engaged", controller: 1 });
    expect(done.seats[1]?.engaged).toContain(seat1);
  });

  it("21039:A:1 with no ally in play the Cultist is discarded and nothing becomes an enemy", () => {
    const made = table({ deck: ["f0", "f0"] });
    const state = revealedTop(made, SECRET);
    expect(where(state, SECRET)).toBe("encounterDiscard");
    expect(Object.values(state.cards).filter((card) => card.code.endsWith("~enemy"))).toEqual([]);
  });

  lineSpec("21039:A:1", "when the Cultist is discarded the ally is its owner's card again in the owner's discard pile", (effects) => {
    const { made, strong } = cultist({}, effects);
    const state = revealedTop(made, SECRET);
    const gone = settle(run(made, state, { verb: "Discard", target: { kind: "self" } }, { sourceId: idOf(state, SECRET) }), made.ctx, []);
    expect(gone.cards[strong]).toMatchObject({ code: "strong", zone: "discard" });
    expect(gone.seats[0]?.discard).toContain(strong);
    expect(gone.seats[0]?.engaged).not.toContain(strong);
  });

  lineSpec("21039:A:1", "when the ally's owner is eliminated the ally and the Cultist are discarded", (effects) => {
    const { made, strong } = cultist({ seats: 2 }, effects, { attack: 4, seat: 1 });
    const state = revealedTop(made, SECRET);
    expect(state.cards[strong]?.code).toBe("strong~enemy");
    const steps: EngineStep[] = [];
    const out = eliminateSeat(state, 1, steps);
    const done = settle(queueEvent(out, { trigger: "playerEliminated", seat: 1 }), made.ctx, steps);
    expect(done.cards[strong]).toMatchObject({ code: "strong", zone: "discard" });
    expect(where(done, SECRET)).toBe("encounterDiscard");
  });
});

describe("Secret Cultist (21039:A:1): an ally under another player's control", () => {
  lineSpec("21039:A:1", "the ally is engaged with its owner, not the player who controls it, and goes back to the owner's discard pile", (effects) => {
    const made = table({ seats: 2, play: ["ally"] }, effects);
    made.cards.set("strong", allyCard("strong", 3, { attack: 4, willpower: 2 }));
    const spawned = spawn(made.state, "strong", { zone: "play", seat: 0 });
    const taken = updateCard(spawned.state, spawned.id, { owner: 1 });
    const state = revealedTop({ ...made, state: taken }, SECRET);
    expect(state.cards[spawned.id]).toMatchObject({ code: "strong~enemy", zone: "engaged", controller: 1, owner: 1 });
    expect(state.seats[1]?.engaged).toContain(spawned.id);
    expect(state.seats[0]?.engaged).not.toContain(spawned.id);
    const gone = settle(run(made, state, { verb: "Discard", target: { kind: "self" } }, { sourceId: idOf(state, SECRET) }), made.ctx, []);
    expect(gone.cards[spawned.id]).toMatchObject({ code: "strong", zone: "discard" });
    expect(gone.seats[1]?.discard).toContain(spawned.id);
    expect(gone.seats[0]?.discard).not.toContain(spawned.id);
  });
});

describe("The stages' Forced effects and Bribes when the active location is explored (21077:B:1, 21078:B:1, 21033:A:2)", () => {
  const withDecks = (layout: Layout, effects = EFFECTS) => table({ staging: [BRIBES], active: MANOR, deckOf: ["event", "ally", "event", "event", "event", "event"], ...layout }, effects);

  lineSpec("21077:B:1", "when the active location leaves play explored the stage gets 1 resource (Bribes hears the same event)", (effects) => {
    const made = withDecks({}, effects);
    const explored = explore(made, opened(made).state);
    expect(where(explored, MANOR)).not.toBe("activeLocation");
    expect(resourcesOf(explored, S1)).toBe(1);
  });

  lineSpec("21033:A:2", "the top X cards of each deck are discarded (X the Threat of the active location), then 1 resource for each event discarded", (effects) => {
    const made = withDecks({}, effects);
    const state = opened(made).state;
    const threat = made.ctx.cards.get(MANOR)?.threat ?? 0;
    const explored = explore(made, state);
    const top = ["event", "ally", "event", "event", "event", "event"].slice(0, threat);
    expect(explored.seats[0]?.discard).toHaveLength(threat);
    expect(resourcesOf(explored, BRIBES)).toBe(top.filter((code) => code === "event").length);
  });

  it("21033:A:2 a deck with fewer than X cards is not discarded in full, so no resource is placed", () => {
    const made = withDecks({ deckOf: ["event"] });
    const explored = explore(made, opened(made).state);
    expect(explored.seats[0]?.discard).toHaveLength(1);
    expect(resourcesOf(explored, BRIBES)).toBe(0);
  });

  lineSpec("21078:B:1", "the top card of the encounter deck is revealed, then the stage gets 1 resource", (effects) => {
    const made = table({ stage: S2, active: MANOR, deck: ["f3", "f0"] }, effects);
    const explored = explore(made, opened(made).state);
    expect(where(explored, "f3")).toBe("staging");
    expect(resourcesOf(explored, S2)).toBe(1);
  });

  it("21078:B:1 with no encounter card to reveal (the deck and the discard pile are empty) no resource is placed", () => {
    const made = table({ stage: S2, deck: [] });
    const done = resolveRecords(made.state, made.ctx, S2, "forced", made.state.questStage ?? "").state;
    expect(done.encounterDeck).toHaveLength(0);
    expect(resourcesOf(done, S2)).toBe(0);
  });
});

describe("The stages cannot be defeated with too few resources (21077:B:2, 21078:B:2)", () => {
  // The stage is full of progress; whether it advances depends on the resources it holds.
  function advances(stage: string, resources: number, effects: readonly (typeof EFFECTS)[number][], layout: Layout = {}): boolean {
    const made = table({ stage, ...layout }, effects);
    const id = made.state.questStage ?? "";
    const points = made.ctx.cards.get(stage)?.questPoints ?? 0;
    const held = syncConstants(updateCard(made.state, id, { resources, progress: points - 1 }), made.ctx);
    const placed = placeQuestProgress(held, 1, made.ctx.cards, [], (current) => restricted(current, made.ctx, "advance").length === 0);
    return placed.cards[placed.questStage ?? ""]?.code !== stage;
  }

  lineSpec("21077:B:2", "with 1 resource the stage does not advance, and with 2 it does", (effects) => {
    expect(advances(S1, 1, effects)).toBe(false);
    expect(advances(S1, 2, effects)).toBe(true);
  });

  lineSpec("21078:B:2", "the stage needs 3 more resources than there are players: 4 with one player, 5 with two", (effects) => {
    expect(advances(S2, 3, effects)).toBe(false);
    expect(advances(S2, 4, effects)).toBe(true);
    expect(advances(S2, 4, effects, { seats: 2 })).toBe(false);
    expect(advances(S2, 5, effects, { seats: 2 })).toBe(true);
  });
});

describe("Setup (21077:A:1)", () => {
  lineSpec("21077:A:1", "the first player takes Side Street, the next player another location, and the table notes the threat raised", (effects) => {
    const made = table({ seats: 2, deck: ["21050", STREET, "21046", "f0"] }, effects);
    const state = resolveRecords(made.state, made.ctx, S1, "setup", made.state.questStage ?? "").state;
    const staged = Object.values(state.cards).filter((card) => card.zone === "staging").map((card) => card.code).sort();
    expect(staged).toHaveLength(2);
    expect(staged).toContain(STREET);
    expect(new Set(staged).size).toBe(2);
    expect(state.encounterDeck).toHaveLength(2);
    expect(flagged(state, "table", "noteThreatRaised")).toBe(true);
  });
});

describe("Sauron Worship (21035:A:1, 21035:A:2)", () => {
  lineSpec("21035:A:1", "it enters play with 1 damage token", (effects) => {
    const made = table({ setAside: [SAURON] }, effects);
    const state = run(made, opened(made).state, { verb: "AddRandomSetAsideToStaging", trait: "Plot" });
    expect(state.cards[idOf(state, SAURON)]?.damage).toBe(1);
  });

  lineSpec("21035:A:2", "each player's threat elimination level is reduced by 1 for each damage token here", (effects) => {
    const made = table({ staging: [{ code: SAURON, damage: 3 }] }, effects);
    expect(eliminationLevel(syncConstants(made.state, made.ctx), 0)).toBe(47);
  });
});

describe("Evidence of the Cult (21036:A:3)", () => {
  lineSpec("21036:A:3", "free of encounters it goes to the victory display and the main quest gets 1 resource", (effects) => {
    const made = table({ staging: [EVIDENCE], attached: [{ code: "21045", to: EVIDENCE, guard: true }] }, effects);
    const state = settle(opened(made).state, made.ctx, []);
    expect(where(state, EVIDENCE)).toBe("staging");
    const freed = settle(run(made, state, { verb: "Discard", target: { kind: "self" } }, { sourceId: idOf(state, "21045") }), made.ctx, []);
    expect(where(freed, EVIDENCE)).toBe("victory");
    expect(freed.cards[freed.questStage ?? ""]?.resources).toBe(1);
  });
});

describe("Hillside Manor (21037:A:1, 21037:A:2)", () => {
  // A player card effect lowers the first player's threat; the cap is 1 in all each round.
  const lowered = (effects: readonly (typeof EFFECTS)[number][]): number[] => {
    const made = table({ staging: [MANOR], play: ["ally"], threat: [40, 30] }, effects);
    const state = syncConstants(made.state, made.ctx);
    const ally = idOf(state, "ally");
    const step = (from: ScenarioState, amount: number): ScenarioState => run(made, from, { verb: "LowerThreat", amount, who: "actor" }, { sourceId: ally });
    const one = step(state, 3);
    const two = step(one, 2);
    return [40 - (one.seats[0]?.threat ?? 0), (one.seats[0]?.threat ?? 0) - (two.seats[0]?.threat ?? 0)];
  };

  lineSpec("21037:A:1", "while it is in the staging area a reduction of 3 by a player card becomes 1 and a second one the same round lowers nothing", (effects) => {
    expect(lowered(effects)).toEqual([1, 0]);
  });

  it("21037:A:1 engaged or in play as the active location it limits nothing", () => {
    const made = table({ active: MANOR, play: ["ally"], threat: [40, 30] });
    const state = syncConstants(made.state, made.ctx);
    const after = run(made, state, { verb: "LowerThreat", amount: 3, who: "actor" }, { sourceId: idOf(state, "ally") });
    expect(state.seats[0]!.threat - after.seats[0]!.threat).toBe(3);
  });

  it("21037:A:2 a player with an empty hand pays nothing and the players can travel to it", () => {
    const made = table({ phase: "Travel", staging: [MANOR] });
    const intents = legalIntents(made.state, made.ctx);
    expect(intents.some((intent) => intent.type === "Travel")).toBe(true);
  });

  it("21037:A:2 with a card in each hand each player discards 1, and in a game of two players both pay", () => {
    const made = table({ phase: "Travel", seats: 2, staging: [MANOR], hand: ["event", "event"] });
    const traveled = finish(send(start(made.state), { type: "Travel", locationId: idOf(made.state, MANOR) }, made.ctx), made.ctx);
    expect(traveled.state.seats[0]?.hand).toHaveLength(1);
    expect(traveled.state.seats[1]?.hand).toHaveLength(1);
  });
});

describe("Under Guard (21051:A:1)", () => {
  lineSpec("21051:A:1", "When Revealed: the Travel effect of the active location resolves without being paid, and the location stays active", (effects) => {
    const made = table({ active: MANOR, hand: ["event", "event"] }, effects);
    const state = revealedTop(made, UNDER_GUARD);
    expect(state.seats[0]?.hand).toHaveLength(1);
    expect(where(state, MANOR)).toBe("activeLocation");
  });

  lineSpec("21051:A:1", "When Revealed: with no active location cards are discarded until a location is, which is added to the staging area", (effects) => {
    const made = table({ deck: ["f0", "f3", "21046", "f0"] }, effects);
    const state = revealedTop(made, UNDER_GUARD);
    expect(where(state, "21046")).toBe("staging");
    expect(where(state, "f3")).toBe("encounterDiscard");
  });
});

describe("Seedy Tavern (21047:A:2, 21047:A:3)", () => {
  const FIVE = ["21045", "21041", "21043", "21050", "21044", "21040"];
  lineSpec("21047:A:3", "Travel: one of the top 5 cards of the encounter deck lies facedown under it and the rest are shuffled back", (effects) => {
    const made = table({ phase: "Travel", staging: [TAVERN], deck: FIVE }, effects);
    const traveled = finish(send(start(made.state), { type: "Travel", locationId: idOf(made.state, TAVERN) }, made.ctx), made.ctx);
    const under = Object.values(traveled.state.cards).filter((card) => card.zone === "under");
    expect(under).toHaveLength(1);
    expect(traveled.state.encounterDeck).toHaveLength(5);
  });

  lineSpec("21047:A:2", "Forced: when it is explored each facedown card under it is revealed", (effects) => {
    const made = table({ active: TAVERN, under: [{ code: "21045", to: TAVERN }] }, effects);
    const explored = explore(made, opened(made).state);
    expect(where(explored, "21045")).toBe("staging");
  });
});

describe("Side Street (21049:A:1)", () => {
  lineSpec("21049:A:1", "while it is in the staging area no progress is placed on the other locations there, and it takes progress itself", (effects) => {
    const made = table({ staging: [STREET, "21046"] }, effects);
    const placed = run(made, opened(made).state, { verb: "PlaceProgressOn", amount: 2, target: "eachStagingLocation" });
    expect(placed.cards[idOf(placed, "21046")]?.progress).toBe(0);
    expect(placed.cards[idOf(placed, STREET)]?.progress).toBe(2);
  });
});

describe("Overwhelmed (21042:A:2) and Darkness in the East (21048:A:2)", () => {
  const damageTo = (state: ScenarioState, code: string, amount: number, made: { ctx: Parameters<typeof placeDamage>[3] extends infer C ? { cards: C } : never }): number => placeDamage(state, idOf(state, code), amount, made.ctx.cards, [], "framework", UNATTRIBUTED).cards[idOf(state, code)]?.damage ?? 0;

  lineSpec("21042:A:2", "When Revealed: until the end of the round the enemies engaged with the first player cannot take damage; a staged enemy can, and after the round they can again", (effects) => {
    const made = table({ engaged: ["f3"], staging: ["21045"], deck: ["f0"] }, effects);
    const state = revealedTop({ ...made, state: syncConstants(made.state, made.ctx) }, "21042");
    expect(damageTo(state, "f3", 2, made)).toBe(0);
    expect(damageTo(state, "21045", 2, made)).toBe(2);
    expect(damageTo(expireModifiers(state, ["endOfRound"]), "f3", 2, made)).toBe(2);
  });

  const fightWith = (effects: readonly (typeof EFFECTS)[number][], raised: boolean) => {
    const result = fightEnemy((layout: Layout) => table(layout, effects), "21048", "f3", {}, {
      undefended: true,
      tweak: (state, made) => {
        const noting = { ...state, modifiers: [...state.modifiers, { instanceId: "table", sourceId: idOf(state, S1), stat: "noteThreatRaised" as const, amount: 1, until: "endOfGame" as const }] };
        return raised ? raiseThreat(syncConstants(noting, made.ctx), 0, 1, [], UNATTRIBUTED) : noting;
      },
    });
    return result.run.state.cards[result.made.hero]?.damage ?? 0;
  };

  lineSpec("21048:A:2", "Shadow: the attacker gets +1 Attack, and +2 instead if the defending player raised his threat this round", (effects) => {
    expect(fightWith(effects, false)).toBe(2);
    expect(fightWith(effects, true)).toBe(3);
  });
});

describe("Servant of Sauron (21041:A:3): limit once per phase, a second raise in the phase makes no second attack", () => {
  // The raises come one after the other with the attack of the first still open: two raises in the Encounter phase start one attack.
  const raisedTwice = (effects: readonly (typeof EFFECTS)[number][]) => {
    const made = table({ phase: "Encounter", engaged: ["21041"], threat: [30, 30] }, effects);
    const steps: EngineStep[] = [];
    const raise = (from: ScenarioState): ScenarioState => settle(fireForced({ ...from, window: from.window }, { trigger: "threatRaised", seat: 0, amount: 1 }, made.ctx, steps), made.ctx, steps);
    const twice = raise(raise(syncConstants({ ...made.state, window: null, mode: "stopped" }, made.ctx)));
    expect(steps.filter((step) => step.kind === "attack")).toHaveLength(1);
    expect(twice.pendingAttack).not.toBeNull();
  };
  lineSpec("21041:A:3", "a threat raise makes the immediate attack once, a second raise in the same phase makes none", raisedTwice);
});

describe("Treacherous Easterling (21045:A:1)", () => {
  it("21045:A:1 limit +3: with 5 resources it gets +3 Attack and +3 Defense, a fifth resource again adds nothing", () => {
    const four = table({ staging: [{ code: "21045", resources: 4 }] });
    const five = table({ staging: [{ code: "21045", resources: 5 }] });
    expect(statOf(four.state, four.ctx.cards, "21045", "attack")).toBe(6);
    expect(statOf(five.state, five.ctx.cards, "21045", "attack")).toBe(6);
    expect(statOf(five.state, five.ctx.cards, "21045", "defense")).toBe(4);
  });
});

describe("Shadow of Fear (21043:A:3)", () => {
  lineSpec("21043:A:3", "Response: when it is defeated each player's threat is reduced by 3", (effects) => {
    const made = table({ staging: ["21043"], threat: [30, 30] }, effects);
    const fear = idOf(made.state, "21043");
    const event = queueEvent({ ...made.state, window: null }, { trigger: "questDefeated", seat: 0, cardId: fear, subject: fear });
    const intent = legalIntents(settle(event, made.ctx, []), made.ctx).find((offered) => offered.type === "Trigger" && offered.cardId === fear);
    expect(intent).toBeDefined();
    const done = finish(send({ state: settle(event, made.ctx, []), steps: [] }, intent as never, made.ctx), made.ctx);
    expect(done.state.seats[0]?.threat).toBe(27);
  });
});

describe("Rhûn Backstabber (21044:A:1)", () => {
  lineSpec("21044:A:1", "Forced: after it engages you, discard an ally you control with printed cost 2 or higher instead of raising threat", (effects) => {
    const made = table({ engaged: ["21044"], play: ["ally"] }, effects);
    made.cards.set("costly", allyCard("costly", 3));
    const spawned = spawn(made.state, "costly", { zone: "play", seat: 0 });
    const event = queueEvent({ ...spawned.state, window: null }, { trigger: "engaged", seat: 0, cardId: idOf(spawned.state, "21044"), subject: idOf(spawned.state, "21044") });
    const done = finish({ state: settle(event, made.ctx, []), steps: [] }, made.ctx, (state) => (state.window?.kind === "choose" ? (state.window.options.find((option) => option === "discard") ?? state.window.options[0] ?? "") : ""));
    expect(zoneOf(done.state, "costly")).toBe("discard");
    expect(done.state.seats[0]?.threat).toBe(spawned.state.seats[0]?.threat);
  });
});

describe("Leader of the Cult (21079:B:1)", () => {
  lineSpec("21079:B:1", "a Cultist takes at most the printed quest points of the active location in damage a round, and none with no active location", (effects) => {
    const made = table({ stage: "21079", staging: [PRIEST], active: MANOR }, effects);
    const state = opened(made).state;
    const cultist = idOf(state, PRIEST);
    const points = made.ctx.cards.get(MANOR)?.questPoints ?? 0;
    const hit = (from: ScenarioState, amount: number): ScenarioState => placeDamage(from, cultist, amount, made.ctx.cards, [], "framework", UNATTRIBUTED);
    // Two hits in one round: the second adds nothing once the cap is reached.
    const once = hit(state, 1);
    expect(once.cards[cultist]?.damage).toBe(1);
    const twice = hit(once, 99);
    expect(twice.cards[cultist]?.damage).toBe(points);
    expect(hit(twice, 3).cards[cultist]?.damage).toBe(points);
    const bare = table({ stage: "21079", staging: [PRIEST] }, effects);
    expect(placeDamage(opened(bare).state, idOf(bare.state, PRIEST), 3, bare.ctx.cards, [], "framework", UNATTRIBUTED).cards[idOf(bare.state, PRIEST)]?.damage).toBe(0);
  });
});
