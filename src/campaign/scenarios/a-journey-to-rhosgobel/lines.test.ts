// Rules: rr.first-player, rr.ownership-and-control, rr.player-elimination, rr.destroy, rr.damage, rr.forced, rr.response, rr.guarded, rr.next-player, rr.removed-from-game (data/rules/entries.json); ledger lines 02061:B:2, 02063:A:1, 02064:A:1, 02064:A:3, 02065:A:3, 900601:A:3, 900601:A:4, 900604:A:2, 900605:A:2, 900606:A:2, 900607:A:2, 900608:A:2.
// What a spec row cannot express on A Journey to Rhosgobel: a negative, a game over several steps, a choice. Each test starts its title with the line id it covers.
import { describe, expect, it } from "vitest";

import type { PlayerIntent } from "../../../rules/engine/reduce.ts";
import { fightEnemy, finish, first, idsOf, legalIntents, legalTargets, resolveRecords, revealFromTop, send, start, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { eliminateSeat } from "../../../rules/core/eliminate.ts";
import { flagged, updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { hasTrait } from "../../../rules/interpret/conditions.ts";
import { pushEffectFrame } from "../../../rules/interpret/effect-frames.ts";
import { travelBlocked } from "../../../rules/interpret/restrictions.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { attachTo, moveCard, spawn } from "../../../rules/core/zones.ts";

const WILYADOR = "02064";
const GROVE = "900604";
const table = (layout: Layout) => tableFromLayout("a-journey-to-rhosgobel", layout);

describe("02064:A:1 Wilyador joins the first player and follows the token", () => {
  it("02064:A:1 leaves the staging area for the first player's play area, faceup and ready, and passes with the token", () => {
    const made = table({ seats: 2, firstPlayer: 1, staging: [WILYADOR] });
    const settled = settle(made.state, made.ctx, []);
    const id = first(settled, WILYADOR);
    expect(settled.cards[id]).toMatchObject({ zone: "play", controller: 1 });
    expect(settled.staging).not.toContain(id);
    const passed = settle({ ...settled, firstPlayer: 0 }, made.ctx, []);
    expect(passed.cards[id]).toMatchObject({ zone: "play", controller: 0 });
    expect(passed.seats[0]?.play).toContain(id);
    expect(passed.seats[1]?.play).not.toContain(id);
  });
});

describe("02064:A:3 Wilyador leaves play", () => {
  it("02064:A:3 loses the game when the player who controls him is eliminated", () => {
    const made = table({ seats: 2, firstPlayer: 1, play: [{ code: WILYADOR, seat: 1 }] });
    expect(settle(eliminateSeat(made.state, 1, []), made.ctx, []).lost).toBe(true);
  });

  it("02064:A:3 loses the game when damage destroys him", () => {
    const made = table({ play: [{ code: WILYADOR, damage: 20 }] });
    expect(settle(made.state, made.ctx, []).lost).toBe(true);
  });

  it("02064:A:3 does not lose the game while he stays in play", () => {
    const made = table({ play: [{ code: WILYADOR, damage: 19 }] });
    expect(settle(made.state, made.ctx, []).lost).not.toBe(true);
  });
});

describe("02061:B:1 Radagast's Request is the first player's", () => {
  it("02061:B:1 is offered to the first player when the token is with the second seat, and the damage goes on the Wilyador that player controls", () => {
    const made = table({ stage: "02061", seats: 2, firstPlayer: 1, play: [{ code: WILYADOR, seat: 1 }], deck: ["f0", "f0", "f0", "f0"], phase: "Planning" });
    let run = start(made.state);
    const offer = (state: ScenarioState) => legalIntents(state, made.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === first(state, "02061"));
    for (let guard = 0; guard < 12 && !offer(run.state); guard += 1) {
      const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass");
      if (!pass) break;
      run = send(run, pass as PlayerIntent, made.ctx);
    }
    expect(offer(run.state)).toBeDefined();
    expect(run.state.activeSeat).toBe(1);
    const used = finish(send(run, offer(run.state) as PlayerIntent, made.ctx), made.ctx);
    expect(used.state.cards[first(used.state, WILYADOR)]?.damage).toBe(2);
  });
});

describe("02061:B:2 the card whose effect healed Wilyador leaves the game", () => {
  it("02061:B:2 removes the event that healed him from the game, and not the card of a heal that healed nothing", () => {
    const made = table({ stage: "02061", play: [{ code: WILYADOR, damage: 6 }], hand: ["filler"] });
    const healer = first(made.state, "filler");
    const heal = (state: typeof made.state) => settle(pushEffectFrame({ ...state, window: null, mode: "stopped" }, { frame: "whenRevealed", sourceId: healer, actor: 0, peril: false, effectId: "fixture:whenRevealed:1", instructions: [{ verb: "Pick", pick: { type: "character", control: "any", names: ["Wilyador"] } }, { verb: "Heal", amount: 2, target: "picked" }], cancel: null, blockCancel: null }, []), made.ctx, []);
    const healed = heal(made.state);
    expect(healed.cards[first(healed, WILYADOR)]?.damage).toBe(4);
    expect(healed.cards[healer]?.zone).toBe("removed");
    const clean = heal(updateCard(made.state, first(made.state, WILYADOR), { damage: 0 }));
    expect(clean.cards[healer]?.zone).not.toBe("removed");
  });
});

describe("02065:A:3 Rhosgobel cannot be traveled to until stage 1 is complete", () => {
  it("02065:A:3 is barred while stage 1 is current and open after it", () => {
    const one = table({ staging: ["02065"] });
    expect(travelBlocked(one.state, one.ctx, first(one.state, "02065"))).toBe(true);
    // The bar is on Rhosgobel itself: another location may be traveled to while stage 1 is current.
    const other = table({ staging: ["02065", "02066"] });
    expect(travelBlocked(other.state, other.ctx, first(other.state, "02066"))).toBe(false);
    const two = table({ stage: "02061", staging: ["02065"] });
    expect(travelBlocked(two.state, two.ctx, first(two.state, "02065"))).toBe(false);
  });
});

describe("02063:A:1 Athelas is Guarded when it is revealed", () => {
  it("02063:A:1 takes the next encounter card as its guard, and its Action is offered only once nothing guards it", () => {
    const made = table({ deck: ["02070"], phase: "Planning" });
    const steps: EngineStep[] = [];
    const revealed = finish({ state: revealFromTop(made.state, made.ctx, "02063", steps).state, steps }, made.ctx);
    const athelas = first(revealed.state, "02063");
    expect(revealed.state.cards[athelas]?.zone).toBe("staging");
    const guard = first(revealed.state, "02070");
    expect(revealed.state.cards[guard]).toMatchObject({ zone: "staging", host: athelas });
    const offered = (state: typeof revealed.state) => legalIntents({ ...state, window: { kind: "pass" }, mode: "planning", phase: "Planning" }, made.ctx).some((intent) => intent.type === "Trigger" && intent.cardId === athelas);
    expect(offered(revealed.state)).toBe(false);
    const freed = moveCard(updateCard(revealed.state, athelas, { attachments: [] }), guard, { zone: "discard", seat: 0 });
    expect(offered(updateCard(freed, guard, { host: null }))).toBe(true);
  });
});

describe("02066:A:1 Forest Grove's Response", () => {
  it("02066:A:1 is offered once when it is explored as the active location, adds one Athelas to the staging area and is not offered again", () => {
    // A quest with the active location explored: willpower of both heroes against its 2 quest points.
    const made = table({ phase: "Quest", active: "02066", deck: ["f0", "02063", "02063"] });
    let run = send(start(made.state), { type: "Commit", cardIds: [first(made.state, "dh1"), first(made.state, "dh2")] }, made.ctx);
    run = send(run, { type: "Pass" }, made.ctx);
    const offers = (state: ScenarioState) => legalIntents(state, made.ctx).filter((intent) => intent.type === "Trigger" && intent.cardId === first(state, "02066"));
    for (let guard = 0; guard < 16 && offers(run.state).length === 0; guard += 1) {
      const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass");
      if (!pass) break;
      run = send(run, pass as PlayerIntent, made.ctx);
    }
    expect(offers(run.state)).toHaveLength(1);
    const used = finish(send(run, offers(run.state)[0] as PlayerIntent, made.ctx), made.ctx);
    expect(used.state.staging.filter((id) => used.state.cards[id]?.code === "02063")).toHaveLength(1);
    expect(offers(used.state)).toHaveLength(0);
  });
});

describe("02070:A:2 and 02071:A:2 the shadow puts the damage on Wilyador", () => {
  // Bats attack with the Flock's shadow; a Goblin Eagle-hunter is no Eagle-only enemy, so a hero can defend it.
  it("02070:A:2 puts the damage of an undefended attack on Wilyador, though another player controls him", () => {
    const fight = fightEnemy(table, "02070", "02071", { seats: 2, firstPlayer: 1, play: [{ code: WILYADOR, seat: 1 }] }, { undefended: true });
    expect(fight.run.state.cards[first(fight.run.state, WILYADOR)]?.damage).toBe(1);
    expect(fight.run.state.cards[fight.made.hero]?.damage ?? 0).toBe(0);
  });

  it("02070:A:2 leaves the damage on the hero when Wilyador is not in play", () => {
    const fight = fightEnemy(table, "02070", "02071", {}, { undefended: true });
    expect(fight.run.state.cards[fight.made.hero]?.damage).toBe(1);
  });

  it("02070:A:2 leaves a defended attack to its defender", () => {
    const fight = fightEnemy(table, "02070", "900602", { play: [WILYADOR] });
    expect(fight.run.state.cards[first(fight.run.state, WILYADOR)]?.damage).toBe(0);
    expect(fight.run.state.cards[fight.made.hero]?.damage).toBeGreaterThan(0);
  });
});

describe("900601:A:3 and 900601:A:4 the Nightmare setup card", () => {
  // The setup card lies in the nightmare zone, and its Setup has set the table's note of the encounter discard pile.
  const nightmare = (layout: Layout) => {
    const made = table(layout);
    const setup = spawn(made.state, "900601", { zone: "nightmare" });
    const flagged = { ...setup.state, modifiers: [...setup.state.modifiers, { instanceId: "table", sourceId: setup.id, stat: "noteEncounterDiscards" as const, amount: 1, until: "endOfGame" as const }] };
    return { ...made, state: flagged };
  };
  const revealed = (made: ReturnType<typeof nightmare>, codes: readonly string[]): ScenarioState => {
    let state: ScenarioState = made.state;
    for (const code of codes) {
      const steps: EngineStep[] = [];
      state = finish({ state: revealFromTop(state, made.ctx, code, steps).state, steps }, made.ctx).state;
    }
    return state;
  };

  it("900601:A:3 gives surge to the first Creature enemy revealed in a quest phase, and to no other", () => {
    const made = nightmare({ phase: "Quest", deck: ["f0", "f0", "f0", "f0", "f0"] });
    const one = revealed(made, ["02070"]);
    // The Flock was revealed and its surge revealed one more card.
    expect(one.staging).toHaveLength(2);
    const two = revealed(made, ["02070", "02071"]);
    expect(two.staging).toHaveLength(3);
  });

  it("900601:A:3 gives no surge to an enemy that is not a Creature", () => {
    const made = nightmare({ phase: "Quest", deck: ["f0", "f0", "f0"] });
    expect(revealed(made, ["900602"]).staging).toHaveLength(1);
  });

  it("900601:A:4 offers the first player to shuffle an Athelas placed in the encounter discard pile back into the encounter deck", () => {
    const made = nightmare({ phase: "Planning", staging: ["02063"], deck: ["f0"] });
    const athelas = first(made.state, "02063");
    const discarded = settle({ ...moveCard(made.state, athelas, { zone: "encounterDiscard" }), window: null, mode: "planning", phase: "Planning" }, made.ctx, []);
    const offer = legalIntents(discarded, made.ctx).find((intent) => intent.type === "Trigger" && intent.effectId === "900601:response:1");
    expect(offer).toBeDefined();
    const used = send(start(discarded), offer as PlayerIntent, made.ctx);
    expect(used.state.encounterDeck).toContain(athelas);
    expect(used.state.encounterDiscard).not.toContain(athelas);
  });
  it("900601:A:4 asks the first player, whoever holds the token", () => {
    const made = nightmare({ seats: 2, firstPlayer: 1, phase: "Planning", staging: ["02063"], deck: ["f0"] });
    const athelas = first(made.state, "02063");
    const discarded = settle({ ...moveCard(made.state, athelas, { zone: "encounterDiscard" }), window: null, mode: "planning", phase: "Planning" }, made.ctx, []);
    expect(legalIntents(discarded, made.ctx).some((intent) => intent.type === "Trigger" && intent.effectId === "900601:response:1")).toBe(true);
    expect(discarded.activeSeat).toBe(1);
  });
});

describe("900603:A:2 Treetop Bird-eater engages the player who controls Wilyador", () => {
  it("900603:A:2 leaves the player it is engaged with for the one who controls Wilyador, and stays when it is engaged with him", () => {
    // Wilyador is the first player's, so the token is with seat 1 for him to be seat 1's.
    const made = table({ seats: 2, firstPlayer: 1, phase: "Encounter", engaged: ["900603"], play: [{ code: WILYADOR, seat: 1 }] });
    const bird = first(made.state, "900603");
    const moved = resolveRecords(made.state, made.ctx, "900603", "forced", bird);
    expect(moved.state.cards[bird]).toMatchObject({ zone: "engaged", controller: 1 });
    const stays = resolveRecords(table({ seats: 2, phase: "Encounter", engaged: ["900603"], play: [WILYADOR] }).state, made.ctx, "900603", "forced", bird);
    expect(stays.state.cards[bird]).toMatchObject({ zone: "engaged", controller: 0 });
  });
});

describe("900605:A:2 Labyrinthine Woods' shadow", () => {
  it("900605:A:2 sends the attacker to the next player, who is attacked as well", () => {
    const fight = fightEnemy(table, "900605", "900602", { seats: 2 }, { undefended: true });
    const hurt = (seat: number) => (seat === 0 ? [fight.made.hero, fight.made.hero2] : [fight.made.seat1Hero ?? ""]).reduce((sum, id) => sum + (fight.run.state.cards[id]?.damage ?? 0), 0);
    expect(hurt(0)).toBe(5);
    expect(hurt(1)).toBe(5);
  });

  it("900605:A:2 does nothing with one player: there is no next player", () => {
    const fight = fightEnemy(table, "900605", "900602", {}, { undefended: true });
    expect((fight.run.state.cards[fight.made.hero]?.damage ?? 0) + (fight.run.state.cards[fight.made.hero2]?.damage ?? 0)).toBe(5);
  });
});

describe("900602:A:3 the Goblin Eagle-hunter's shadow", () => {
  it("900602:A:3 deals nothing to Wilyador with more than 10 damage on him", () => {
    const fight = fightEnemy(table, "900602", "02071", { play: [{ code: WILYADOR, damage: 11 }] }, { undefended: true });
    expect(fight.run.state.cards[first(fight.run.state, WILYADOR)]?.damage).toBe(11);
  });
});

describe("02070:A:1 and 02071:A:1 only Eagle characters or characters with ranged defend and attack", () => {
  it("02070:A:1 lets Wilyador, an Eagle, defend Mirkwood Flock, and no hero", () => {
    const made = table({ phase: "Encounter", engaged: ["02070"], play: [WILYADOR], deck: ["f0", "f0", "f0"] });
    let run = send(start(syncConstants(made.state, made.ctx)), { type: "DeclineEngage" }, made.ctx);
    for (let guard = 0; guard < 30 && run.state.window?.kind !== "defense"; guard += 1) {
      const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineEngage");
      if (!pass) break;
      run = send(run, pass as PlayerIntent, made.ctx);
    }
    expect(legalTargets(run.state, { type: "DeclareDefender" }, made.ctx)).toEqual([first(run.state, WILYADOR)]);
  });

  it("02071:A:1 lets nobody but an Eagle or a ranged character defend Black Forest Bats: a hero's declaration is refused", () => {
    const made = table({ phase: "Encounter", engaged: ["02071"], deck: ["f0", "f0", "f0"] });
    const state = syncConstants(made.state, made.ctx);
    let run = send(start(state), { type: "DeclineEngage" }, made.ctx);
    for (let guard = 0; guard < 30 && run.state.window?.kind !== "defense"; guard += 1) {
      const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineEngage");
      if (!pass) break;
      run = send(run, pass as PlayerIntent, made.ctx);
    }
    expect(run.state.window?.kind).toBe("defense");
    expect(legalTargets(run.state, { type: "DeclareDefender" }, made.ctx)).toEqual([]);
  });
});

describe("900604:A:1 Dark-wood Grove counts every Athelas card in play", () => {
  const grove = (made: ReturnType<typeof table>, state: ScenarioState) => {
    const synced = syncConstants(state, made.ctx);
    const card = synced.cards[first(synced, GROVE)]!;
    return [modifiedStat(synced, card, "threat", made.ctx.cards), modifiedStat(synced, card, "questPoints", made.ctx.cards)];
  };
  it("900604:A:1 counts an Athelas in the staging area (unclaimed) and a claimed one, and none when there is none", () => {
    const none = table({ staging: [GROVE] });
    const [threat, points] = grove(none, none.state);
    for (const layout of [{ staging: [GROVE, "02063"] }, { staging: [GROVE], attached: [{ code: "02063", to: "dh1" }] }]) {
      const made = table(layout);
      expect(grove(made, made.state), JSON.stringify(layout)).toEqual([threat + 1, points + 1]);
    }
  });
});

describe("900604:A:2 Dark-wood Grove's shadow", () => {
  it("900604:A:2 makes the attacking enemy attack again when the defending player controls an Athelas card", () => {
    const withAthelas = fightEnemy(table, "900604", "900602", {}, { undefended: true, tweak: (state, made) => carry(state, made.hero2) });
    const without = fightEnemy(table, "900604", "900602", {}, { undefended: true });
    const damage = (fight: typeof without) => (fight.run.state.cards[fight.made.hero]?.damage ?? 0) + (fight.run.state.cards[fight.made.hero2]?.damage ?? 0);
    expect(damage(without)).toBe(5);
    expect(damage(withAthelas)).toBe(10);
  });
});

// A claimed Athelas on the hero (what ClaimObjective does).
function carry(state: ReturnType<typeof table>["state"], heroId: string) {
  const spawned = spawn(state, "02063", { zone: "staging" });
  const attached = attachTo(moveCard(spawned.state, spawned.id, { zone: "attached" }), spawned.id, heroId);
  return updateCard(attached, spawned.id, { face: "up", controller: attached.cards[heroId]?.controller ?? 0, claimed: true });
}

describe("900606:A:2 Pitch-dark Thicket's shadow", () => {
  it("900606:A:2 keeps characters with ranged from attacking the enemy until the end of the phase", () => {
    const fight = fightEnemy(table, "900606", "900602", {}, { undefended: true });
    expect(flagged(fight.run.state, first(fight.run.state, "900602"), "cannotBeAttackedByRanged")).toBe(true);
  });
});

describe("900607:A:2 Shot from the Sky", () => {
  const revealedShot = (layout: Layout) => {
    // Surge reveals the next card; the deck holds enough for it not to run out (an empty deck would shuffle the discarded card back).
    const made = table({ deck: ["f0", "f0", "f0"], ...layout });
    const steps: EngineStep[] = [];
    return { made, run: finish({ state: revealFromTop(made.state, made.ctx, "900607", steps).state, steps }, made.ctx) };
  };

  it("900607:A:2 attaches to Wilyador, the one Eagle in play, who loses the Eagle trait and takes 1 damage each time he readies", () => {
    const { made, run } = revealedShot({ play: [{ code: WILYADOR, damage: 1 }] });
    const wilyador = first(run.state, WILYADOR);
    expect(run.state.cards[first(run.state, "900607")]).toMatchObject({ zone: "attached", host: wilyador });
    expect(hasTrait(run.state, wilyador, "Eagle", made.ctx)).toBe(false);
    const exhausted = updateCard(run.state, wilyador, { exhausted: true });
    const ready = settle({ ...exhausted, phase: "Refresh", boundaryPhase: "Refresh", mode: "stopped", window: null }, made.ctx, []);
    expect(ready.cards[wilyador]?.damage).toBe(1);
  });

  it("900607:A:2 is discarded when no Eagle character is in play", () => {
    const { run } = revealedShot({});
    expect(run.state.cards[first(run.state, "900607")]?.zone).toBe("encounterDiscard");
  });
});

describe("900608:A:2 Noxious Supplies", () => {
  it("900608:A:2 attaches to Wilyador though player cards cannot, and up to 3 copies stay on him", () => {
    const made = table({ play: [WILYADOR], deck: ["f0"] });
    let state = made.state;
    for (let copy = 0; copy < 3; copy += 1) {
      const steps: EngineStep[] = [];
      state = finish({ state: revealFromTop(state, made.ctx, "900608", steps).state, steps }, made.ctx).state;
    }
    const wilyador = first(state, WILYADOR);
    expect(idsOf(state, "900608").map((id) => state.cards[id]?.host)).toEqual([wilyador, wilyador, wilyador]);
  });
});

describe("900608:A:2 Noxious Supplies and the heals", () => {
  const poisoned = (copies: number, layout: Layout) => {
    const made = table({ play: [{ code: WILYADOR, damage: 8 }], deck: ["f0", "f0", "f0", "f0", "f0"], hand: ["filler"], ...layout });
    let state = made.state;
    for (let copy = 0; copy < copies; copy += 1) {
      const steps: EngineStep[] = [];
      state = finish({ state: revealFromTop(state, made.ctx, "900608", steps).state, steps }, made.ctx).state;
    }
    return { made, state };
  };
  const heal = (made: ReturnType<typeof table>, state: typeof made.state) =>
    settle(pushEffectFrame({ ...state, window: null, mode: "stopped" }, { frame: "whenRevealed", sourceId: first(state, "filler"), actor: 0, peril: false, effectId: "fixture:whenRevealed:1", instructions: [{ verb: "Pick", pick: { type: "character", control: "any", names: ["Wilyador"] } }, { verb: "Heal", amount: 5, target: "picked" }], cancel: null, blockCancel: null }, []), made.ctx, []);

  it("900608:A:2 reduces a heal by a card effect to 1 and discards one copy, the next heal being reduced by the next", () => {
    const { made, state } = poisoned(2, {});
    const once = heal(made, state);
    expect(once.cards[first(once, WILYADOR)]?.damage).toBe(7);
    expect(idsOf(once, "900608").filter((id) => once.cards[id]?.zone === "attached")).toHaveLength(1);
  });

  // The other card-effect heals reach Wilyador too: Elrond's Response heals quietly, and The Long Defeat heals among characters one damage at a time.
  const healWith = (made: ReturnType<typeof table>, state: typeof made.state, instructions: readonly object[]) => {
    const steps: EngineStep[] = [];
    const pushed = pushEffectFrame({ ...state, window: null, mode: "stopped" }, { frame: "whenRevealed", sourceId: first(state, "filler"), actor: 0, peril: false, effectId: "fixture:whenRevealed:1", instructions: instructions as never, cancel: null, blockCancel: null }, steps);
    return finish({ state: settle(pushed, made.ctx, steps), steps }, made.ctx).state;
  };
  const attached = (state: ScenarioState) => idsOf(state, "900608").filter((id) => state.cards[id]?.zone === "attached");

  it("900608:A:2 reduces a quiet heal (Elrond's Response) to 1 and discards a copy", () => {
    const { made, state } = poisoned(2, {});
    const done = healWith(made, state, [{ verb: "Pick", pick: { type: "character", control: "any", names: ["Wilyador"] } }, { verb: "HealQuietly", amount: 3, target: "picked" }]);
    expect(done.cards[first(done, WILYADOR)]?.damage).toBe(7);
    expect(attached(done)).toHaveLength(1);
  });

  it("900608:A:2 reduces a heal among characters to 1 for the whole effect, and discards a copy", () => {
    const { made, state } = poisoned(2, {});
    const done = healWith(made, state, [{ verb: "HealAmong", amount: 5, pick: { type: "character", control: "any", names: ["Wilyador"] } }]);
    expect(done.cards[first(done, WILYADOR)]?.damage).toBe(7);
    expect(attached(done)).toHaveLength(1);
  });

  it("900608:A:2 leaves the final stage's heal whole", () => {
    const { made, state } = poisoned(1, { stage: "02062", attached: [{ code: "02063", to: "dh1" }] });
    const final = settle(pushEffectFrame({ ...state, window: null, mode: "stopped" }, { frame: "whenRevealed", sourceId: first(state, "02062"), actor: 0, peril: false, effectId: "02062:whenRevealed:1", instructions: made.ctx.effects.find((effect) => effect.id === "02062:whenRevealed:1")?.instructions ?? [], cancel: null, blockCancel: null }, []), made.ctx, []);
    expect(final.cards[first(final, WILYADOR)]?.damage).toBe(3);
    expect(idsOf(final, "900608").filter((id) => final.cards[id]?.zone === "attached")).toHaveLength(1);
  });
});

