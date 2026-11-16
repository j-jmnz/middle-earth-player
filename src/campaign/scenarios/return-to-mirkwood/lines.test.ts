// Rules: sotm.guarding-gollum, rr.first-player, rr.forced, rr.then, rr.cannot, rr.destroy, rr.in-play-and-out-of-play, rr.staging, rr.active-location, rr.travel, rr.shadow-effects, ltp.quest-resolution (data/rules/entries.json); ledger lines 02127:B:2, 02129:B:1, 02129:B:2, 02131:A:2, 02132:A:1, 02133:A:1, 02133:A:2, 02134:A:1,
// 02135:A:1, 02135:A:2, 02136:A:1, 02136:A:2, 02137:A:1, 02137:A:2, 02138:A:2, 02139:A:1.
// The encounter and quest cards of Return to Mirkwood on a scene-kit table (the Normal and Easy decks). Each test starts its title with the line id it covers.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../../rules/core/intents.ts";
import { guardianSeat } from "../../../rules/families/guardian/seats.ts";
import { shadowCards } from "../../../rules/core/zones.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { restricted } from "../../../rules/interpret/restrictions.ts";
import { fightEnemy, finish, first, idOf, idsOf, legalIntents, legalTargets, resolveRecords, revealFromTop, send, start, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const GOLLUM = "02130";
const table = (layout: Layout = {}) => tableFromLayout("return-to-mirkwood", { seats: 2, play: [{ code: GOLLUM, seat: 0 }], ...layout });
const threat = (state: ScenarioState, seat: number) => state.seats[seat]?.threat ?? 0;
const zoneOf = (state: ScenarioState, code: string) => state.cards[first(state, code)]?.zone;
const answer = (id: string) => (state: ScenarioState) => (state.window?.kind === "choose" ? (state.window.options.find((option) => option === id) ?? state.window.options[0] ?? "") : "");
// The treachery is revealed by the first player and every choice it opens is answered by `pick`.
const revealed = (made: ReturnType<typeof table>, code: string, pick?: (state: ScenarioState) => string) => {
  const reveal = revealFromTop(made.state, made.ctx, code, [] as EngineStep[]);
  return finish({ state: reveal.state, steps: [] }, made.ctx, pick).state;
};
const damageOn = (state: ScenarioState, id: string) => state.cards[id]?.damage ?? 0;

describe("02129 Ambush", () => {
  it("02129:B:1 at the beginning of the combat phase every enemy in play engages the guard: the ones in the staging area and the ones engaged with another player", () => {
    const made = table({ stage: "02129", phase: "Combat", staging: ["f0", "f3"], engaged: [{ code: "f3", seat: 1 }] });
    const run = resolveRecords(made.state, made.ctx, "02129", "forced", first(made.state, "02129"));
    const engaged = run.state.seats[0]?.engaged ?? [];
    expect(engaged.map((id) => run.state.cards[id]?.code).sort()).toEqual(["f0", "f3", "f3"]);
    expect(run.state.seats[1]?.engaged).toEqual([]);
    expect(run.state.staging.filter((id) => run.state.cards[id]?.code !== "02129")).toEqual([]);
  });

  it("02129:B:1 the guard is whoever holds Gollum now, so the enemies follow a change of guard", () => {
    const made = table({ stage: "02129", phase: "Combat", staging: ["f0"] });
    const moved = resolveRecords(made.state, made.ctx, GOLLUM, "forced", first(made.state, GOLLUM), answer("seat:1"));
    expect(guardianSeat(moved.state)).toBe(1);
    const run = resolveRecords(moved.state, made.ctx, "02129", "forced", first(made.state, "02129"));
    expect(run.state.seats[1]?.engaged.map((id) => run.state.cards[id]?.code)).toEqual(["f0"]);
  });

  it("02129:B:2 the stage cannot be defeated while an enemy is in play, in the staging area or engaged, and is defeated and wins the game once none is", () => {
    const state = (layout: Layout) => {
      const made = table({ stage: "02129", progress: 2, ...layout });
      return { made, swept: settle({ ...made.state, window: null, mode: "stopped" }, made.ctx, []) };
    };
    for (const layout of [{ staging: ["f0"] }, { engaged: [{ code: "f0", seat: 1 }] }, { engaged: [{ code: "f0", seat: 0 }] }] satisfies Layout[]) {
      const held = state(layout);
      expect(restricted(held.made.state, held.made.ctx, "advance")).not.toHaveLength(0);
      expect(held.swept.stageCleared).toBeFalsy();
    }
    const free = state({});
    expect(restricted(free.made.state, free.made.ctx, "advance")).toHaveLength(0);
    expect(free.swept.stageCleared).toBe(true);
    expect(free.swept.lost).toBeFalsy();
  });
});

describe("02127:B:2 Gollum escapes", () => {
  // The second player commits his hero (the guard cannot commit at this stage), the first passes; the quest resolves against the staging area.
  const quest = (staging: readonly string[], commit: boolean) => {
    const made = table({ stage: "02127", phase: "Quest", staging });
    let run = start(made.state);
    let committed = false;
    for (let guard = 0; guard < 12 && run.state.phase === "Quest" && !run.state.lost; guard += 1) {
      const seat = run.state.activeSeat;
      const commitIntent = seat === 1 && commit && !committed ? { type: "Commit" as const, cardIds: [made.seat1Hero ?? ""] } : null;
      if (commitIntent) committed = true;
      const intent = commitIntent ?? legalIntents(run.state, made.ctx).find((candidate) => candidate.type === "Pass");
      if (!intent) break;
      run = send(run, intent, made.ctx);
    }
    return run.state;
  };

  it("02127:B:2 the players quest unsuccessfully: Gollum escapes and they have lost the game", () => {
    expect(quest(["f3"], true).lost).toBe(true);
    expect(quest(["f3"], true).lossReason).toMatch(/Gollum/);
  });

  it("02127:B:2 a quest that succeeds, or ties, does not lose the game", () => {
    expect(quest(["f0"], true).lost).toBeFalsy();
    // Willpower 2 against a staging area of Threat 2: a tie is not unsuccessful (ltp.quest-resolution).
    expect(quest(["place"], true).lost).toBeFalsy();
  });
});

describe("02131 The Spiders' Ring", () => {
  const stricken = (undefended: boolean) => fightEnemy((layout: Layout) => table(layout), "02131", "f3", { active: "place" }, { undefended, lands: { f3: GOLLUM } });

  it("02131:A:2 if the attack is undefended the active location returns to the staging area and The Spiders' Ring, the shadow card, becomes the active location", () => {
    const fight = stricken(true);
    const ring = fight.run.state.cards[first(fight.run.state, "02131")];
    expect(ring?.zone).toBe("activeLocation");
    expect(fight.run.state.activeLocation).toBe(ring?.id);
    expect(zoneOf(fight.run.state, "place")).toBe("staging");
    // The shadow card is no longer one of the enemy's: the enemy holds none, and the card no longer names it as its host.
    expect(ring?.host).toBeUndefined();
    expect(shadowCards(fight.run.state.cards[first(fight.run.state, "f3")])).not.toContain(ring?.id);
  });

  it("02131:A:2 a defended attack leaves the active location as it was", () => {
    const fight = stricken(false);
    expect(zoneOf(fight.run.state, "place")).toBe("activeLocation");
    expect(zoneOf(fight.run.state, "02131")).not.toBe("activeLocation");
  });
});

describe("02132 Dry Watercourse", () => {
  it("02132:A:1 while it is the active location a treachery's When Revealed that targets the guard targets each other player too, the guard first", () => {
    const made = table({ active: "02132", threat: [28, 30], deck: ["f0", "f0"] });
    const state = revealed(made, "02135", answer("seat:1"));
    expect(threat(state, 0)).toBe(36);
    expect(threat(state, 1)).toBe(38);
  });

  it("02132:A:1 with another active location only the guard is targeted, and a shadow effect is not changed", () => {
    const made = table({ active: "place", threat: [28, 30], deck: ["f0", "f0"] });
    const state = revealed(made, "02135", answer("seat:1"));
    expect(threat(state, 0)).toBe(36);
    expect(threat(state, 1)).toBe(30);
    const fight = fightEnemy((layout: Layout) => table(layout), "02135", "f3", { active: "02132", threat: [28, 30] }, { undefended: true, lands: { f3: GOLLUM } });
    expect(threat(fight.run.state, 0)).toBe(32);
    expect(threat(fight.run.state, 1)).toBe(30);
  });
});

describe("02133 Woodman's Glade", () => {
  it("02133:A:1 to travel the guard exhausts a hero he controls, and cannot travel there with none ready", () => {
    const made = table({ staging: ["02133"], phase: "Travel" });
    const glade = idOf(made.state, "02133");
    expect(legalTargets(made.state, { type: "Travel" }, made.ctx)).toContain(glade);
    const asked = send(start(made.state), { type: "Travel", locationId: glade }, made.ctx);
    // The guard chooses the hero to exhaust among his own.
    expect(asked.state.window?.kind === "choose" ? asked.state.window.seat : null).toBe(0);
    // The Travel effect on its own (the round goes on to the refresh phase, which readies the hero again).
    const paid = resolveRecords(made.state, made.ctx, "02133", "travel", glade, answer(made.hero));
    expect([made.hero, made.hero2].filter((id) => paid.state.cards[id]?.exhausted)).toEqual([made.hero]);
    expect(paid.state.cards[made.seat1Hero ?? ""]?.exhausted).toBeFalsy();
    const spent = [made.hero, made.hero2].reduce((state, id) => updateCard(state, id, { exhausted: true }), made.state);
    expect(legalTargets(spent, { type: "Travel" }, made.ctx)).not.toContain(glade);
    // Only the guard pays: a player who is not guarding Gollum has no ready hero and the travel is still possible.
    const other = [made.hero, made.hero2].reduce((state, id) => updateCard(state, id, { exhausted: false }), spent);
    expect(legalTargets(updateCard(other, made.seat1Hero ?? "", { exhausted: true }), { type: "Travel" }, made.ctx)).toContain(glade);
  });

  it("02133:A:2 after it is explored each player not guarding Gollum reduces his threat by 2, the guard does not", () => {
    const made = table({ active: "02133", threat: [30, 30] });
    const heard = settle({ ...made.state, window: null }, made.ctx, []);
    expect(threat(heard, 0)).toBe(30);
    const run = resolveRecords(made.state, made.ctx, "02133", "response", first(made.state, "02133"));
    expect(threat(run.state, 0)).toBe(30);
    expect(threat(run.state, 1)).toBe(28);
  });
});

describe("02134 Wood Elf Path", () => {
  it("02134:A:1 after the players travel there the guard may choose a new player to guard Gollum, and he is the one offered the Response", () => {
    const made = table({ staging: ["02134"], phase: "Travel", firstPlayer: 1 });
    const path = idOf(made.state, "02134");
    const run = send(start(made.state), { type: "Travel", locationId: path }, made.ctx);
    const trigger = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === path);
    expect(trigger).toBeDefined();
    expect(run.state.window && "seat" in run.state.window ? run.state.window.seat : run.state.activeSeat).toBe(0);
    // The only other player is the one chosen: nobody is asked which.
    const used = send(run, trigger as Parameters<typeof send>[1], made.ctx);
    expect(guardianSeat(used.state)).toBe(1);
  });

  it("02134:A:1 is not offered while a card says the guard cannot change, or to a lone guard", () => {
    const barred = table({ staging: ["02134"], phase: "Travel" });
    const locked = { ...barred, state: { ...barred.state, modifiers: [...barred.state.modifiers, { instanceId: "table", sourceId: "test", stat: "guardianLocked" as const, amount: 1, until: "endOfGame" as const }] } };
    const lockedRun = send(start(locked.state), { type: "Travel", locationId: idOf(locked.state, "02134") }, locked.ctx);
    expect(legalIntents(lockedRun.state, locked.ctx).some((intent) => intent.type === "Trigger")).toBe(false);
    const alone = tableFromLayout("return-to-mirkwood", { play: [{ code: GOLLUM, seat: 0 }], staging: ["02134"], phase: "Travel" });
    const aloneRun = send(start(alone.state), { type: "Travel", locationId: idOf(alone.state, "02134") }, alone.ctx);
    expect(legalIntents(aloneRun.state, alone.ctx).some((intent) => intent.type === "Trigger")).toBe(false);
  });
});

describe("The Tantrum cards", () => {
  it("02135:A:1 the guard raises his threat by 8, then must choose a new player, if able: with two players Gollum passes to the other", () => {
    const made = table({ threat: [28, 30], deck: ["f0", "f0"] });
    const state = revealed(made, "02135");
    expect(threat(state, 0)).toBe(36);
    expect(guardianSeat(state)).toBe(1);
    expect(state.encounterDiscard.map((id) => state.cards[id]?.code)).toContain("02135");
  });

  it("02135:A:1 a lone player raises his threat and keeps Gollum: there is no new player to choose", () => {
    const made = tableFromLayout("return-to-mirkwood", { play: [{ code: GOLLUM, seat: 0 }], deck: ["f0", "f0"] });
    const state = revealed(made as ReturnType<typeof table>, "02135");
    expect(threat(state, 0)).toBe(36);
    expect(guardianSeat(state)).toBe(0);
  });

  it("02135:A:1 a card that bars the change leaves Gollum where he is, after the threat is raised", () => {
    const made = table({ active: "02131", deck: ["f0", "f0"] });
    const state = revealed(made, "02135");
    expect(threat(state, 0)).toBe(36);
    expect(guardianSeat(state)).toBe(0);
  });

  it("02135:A:2 the shadow raises the threat of the guard by 4, whoever the attack is against", () => {
    const fight = fightEnemy((layout: Layout) => table(layout), "02135", "f3", { engaged: [{ code: "f3", seat: 0 }], threat: [28, 30] }, { undefended: true, lands: { f3: GOLLUM } });
    expect(threat(fight.run.state, 0)).toBe(32);
    expect(threat(fight.run.state, 1)).toBe(30);
  });

  it("02136:A:1 deals 4 damage to a hero controlled by the guard, then he must choose a new player", () => {
    const made = table({ deck: ["f0", "f0"] });
    const state = revealed(made, "02136", (window) => (window.window?.kind === "choose" ? (window.window.options.find((option) => option === made.hero) ?? window.window.options[0] ?? "") : ""));
    expect(damageOn(state, made.hero)).toBe(4);
    expect(damageOn(state, made.hero2)).toBe(0);
    expect(damageOn(state, first(state, GOLLUM))).toBe(0);
    expect(guardianSeat(state)).toBe(1);
  });

  it("02136:A:2 the shadow deals 2 damage to a hero the guard controls, whoever the attack is against", () => {
    const fight = fightEnemy((layout: Layout) => table(layout), "02136", "f3", { engaged: [{ code: "f3", seat: 0 }] }, { undefended: true, lands: { f3: GOLLUM } });
    const heroes = [fight.made.hero, fight.made.hero2].reduce((sum, id) => sum + damageOn(fight.run.state, id), 0);
    expect(heroes).toBe(2);
    expect(damageOn(fight.run.state, first(fight.run.state, GOLLUM))).toBe(1);
  });

  it("02137:A:1 discards the top 10 cards of the guard's deck, then he must choose a new player", () => {
    const deck = Array.from({ length: 12 }, () => "filler");
    const made = table({ deckOf: deck, deck: ["f0", "f0"] });
    const state = revealed(made, "02137");
    expect(state.seats[0]?.deck).toHaveLength(2);
    expect(state.seats[1]?.deck).toHaveLength(12);
    expect(guardianSeat(state)).toBe(1);
  });

  it("02137:A:1 a deck of fewer cards is discarded whole", () => {
    const made = table({ deckOf: ["filler", "filler", "filler"], deck: ["f0", "f0"] });
    expect(revealed(made, "02137").seats[0]?.deck).toHaveLength(0);
  });

  it("02137:A:2 the shadow discards the top 5 cards of the guard's deck", () => {
    const made = table({ deckOf: Array.from({ length: 8 }, () => "filler"), engaged: [{ code: "f3", seat: 0 }] });
    const fight = fightEnemy((layout: Layout) => table({ ...layout, deckOf: Array.from({ length: 8 }, () => "filler") }), "02137", "f3", {}, { undefended: true, lands: { f3: GOLLUM } });
    expect(fight.run.state.seats[0]?.deck).toHaveLength(3);
    expect(made.state.seats[0]?.deck).toHaveLength(8);
  });
});

describe("02138 Mirkwood Bats", () => {
  it("02138:A:2 after it engages a player, whoever, 1 damage to each character the guard controls: his heroes and Gollum, and no one else", () => {
    const made = table({ staging: ["02138"], phase: "Encounter" });
    const bats = first(made.state, "02138");
    const run = resolveRecords(made.state, made.ctx, "02138", "forced", bats);
    // The records alone: the guard's two heroes and Gollum take 1; the other seat's hero does not.
    expect(damageOn(run.state, made.hero)).toBe(1);
    expect(damageOn(run.state, made.hero2)).toBe(1);
    expect(damageOn(run.state, first(run.state, GOLLUM))).toBe(1);
    expect(damageOn(run.state, made.seat1Hero ?? "")).toBe(0);
  });

  it("02138:A:2 is heard once when the engagement check puts it on the other player: the guard's characters take 1 each, the player it engaged takes none", () => {
    const made = table({ staging: ["02138"], phase: "Encounter", threat: [10, 40] });
    let run = start(made.state);
    for (let guard = 0; guard < 4 && run.state.window?.kind === "optionalEngage"; guard += 1) run = send(run, { type: "DeclineEngage" }, made.ctx);
    const bats = run.state.cards[first(run.state, "02138")];
    expect(bats?.zone).toBe("engaged");
    expect(bats?.controller).toBe(1);
    expect(damageOn(run.state, made.hero)).toBe(1);
    expect(damageOn(run.state, made.hero2)).toBe(1);
    expect(damageOn(run.state, first(run.state, GOLLUM))).toBe(1);
    expect(damageOn(run.state, made.seat1Hero ?? "")).toBe(0);
  });
});

describe("02139 Attercop, Attercop", () => {
  it("02139:A:1 at the beginning of the encounter phase it engages the guard from the staging area, whatever his threat", () => {
    const made = table({ staging: ["02139"], threat: [20, 20], phase: "Encounter" });
    const run = resolveRecords(made.state, made.ctx, "02139", "forced", first(made.state, "02139"));
    expect(run.state.cards[first(run.state, "02139")]?.zone).toBe("engaged");
    expect(run.state.cards[first(run.state, "02139")]?.controller).toBe(0);
  });

  it("02139:A:1 it moves from another player to the guard, and stays when the guard has it already", () => {
    const made = table({ engaged: [{ code: "02139", seat: 1 }], phase: "Encounter" });
    const run = resolveRecords(made.state, made.ctx, "02139", "forced", first(made.state, "02139"));
    expect(run.state.cards[first(run.state, "02139")]?.controller).toBe(0);
    expect(idsOf(run.state, "02139")).toHaveLength(1);
  });
});
