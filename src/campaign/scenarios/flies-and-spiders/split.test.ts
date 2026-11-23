// Rules: hob.staging-area-creating, hob.staging-area-combining, mec109.multiple-staging-areas (data/rules/entries.json); ledger lines 132025:A:3, 132028:A:2, 132030:A:2, 132069:B:3, 132070:B:3, 132035:A:1, 132035:A:2, 132037:A:1.
// Once stage 2B has split the players, each staging area resolves as if only its players were in the game: "Encounter card effects are limited to each staging area" (hob.staging-area-creating). The first player is at stage 3 in an area of his own (seat 0); the other player is at stage 4 in the original area (seat 1).
import { describe, expect, it } from "vitest";

import type { PrintedCard } from "../../../rules/core/printed.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { spawn } from "../../../rules/core/zones.ts";
import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { stagingDest, stagingOf } from "../../../rules/families/breaking/areas.ts";
import { poisonOf } from "../../../rules/families/poison/poison.ts";
import { startReveal } from "../../../rules/windows/frames.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { fireForced } from "../../../rules/windows/triggers.ts";
import type { GameEvent } from "../../../rules/core/state.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { legalIntents, legalTargets } from "../../../rules/engine/reduce.ts";
import { finish, resolveRecords } from "../../../../test/harness/scene-kit.ts";
import { codeOf, GLADE, run, spiderTable, STAGE_2 } from "../../../../test/scenarios/flies-and-spiders/scene.ts";

// The table after stage 2B revealed with two players, seat 0 alone at stage 3 and seat 1 at stage 4 (the Glade joined seat 1's area).
const split = (layout: Parameters<typeof spiderTable>[0] = {}) => {
  const t = spiderTable({ stage: STAGE_2, setAside: [GLADE], seats: 2, ...layout });
  const state = resolveRecords(t.state, t.ctx, STAGE_2, "whenRevealed", t.state.questStage ?? "").state;
  return { t, state };
};
// A card of `code` in the staging area of the area `seat` heads.
const place = (state: ScenarioState, code: string, seat: number) => {
  const made = spawn(state, code, stagingDest(state, seat));
  return { state: made.state, id: made.id };
};
// The engine announces the event to the Forced effects, as a step of the game does, and the effects it opens are settled.
const fire = (t: { ctx: Parameters<typeof settle>[1] }, state: ScenarioState, event: GameEvent): ScenarioState => {
  const steps: EngineStep[] = [];
  return finish({ state: settle(fireForced({ ...state, window: null, mode: "stopped" }, event, t.ctx, steps), t.ctx, steps), steps }, t.ctx).state;
};
// The card is revealed from the top of the encounter deck to the player `seat`, who reveals for his own area, and its effects settle.
const revealTo = (t: { ctx: Parameters<typeof settle>[1] }, state: ScenarioState, code: string, seat: number): ScenarioState => {
  const steps: EngineStep[] = [];
  const spawned = spawn({ ...state, window: null, mode: "stopped" }, code, { zone: "encounterDeck" }, "down");
  const top = { ...spawned.state, encounterDeck: [spawned.id, ...spawned.state.encounterDeck.filter((id) => id !== spawned.id)] };
  const done = finish({ state: settle(startReveal(top, seat, t.ctx, steps), t.ctx, steps), steps }, t.ctx);
  return done.state;
};
// Every character awake and ready again, the unconscious bars lifted, and `committed` as given.
const awake = (t: { ctx: Parameters<typeof settle>[1] }, state: ScenarioState, committed: boolean, exhausted = false): ScenarioState => {
  const heroes = (state.seats[0]?.heroes ?? []).concat(state.seats[1]?.heroes ?? []);
  return syncConstants(heroes.reduce((acc, hero) => updateCard(acc, hero, { committed, exhausted, unconscious: undefined as never }), state), t.ctx);
};
const codesIn = (state: ScenarioState, seat: number) => stagingOf(state, seat).map((id) => codeOf(state, id)).sort();
const idOfCode = (state: ScenarioState, code: string) => Object.values(state.cards).find((card) => card.code === code)?.id ?? "";

describe("area scope of Flies and Spiders' own cards", () => {
  it("132025:A:3 The Spider's Glade adds the Spider to the staging area it lies in, not to the area of the token holder", () => {
    const { t, state: made } = split({ deck: ["132031", "132032"] });
    expect(stagingOf(made, 1).includes(idOfCode(made, GLADE))).toBe(true);
    const out = fire(t, made, { trigger: "beginningOfPhase", seat: null, phase: "Quest" } as GameEvent);
    expect(codesIn(out, 1)).toEqual([GLADE, "132031"].sort());
    expect(codesIn(out, 0)).toEqual([]);
  });

  it("132028:A:2 Old Tomnoddy gives poison only to the players of the area it is in", () => {
    const { t, state: made } = split();
    const { state } = place(made, "132028", 1);
    const out = fire(t, state, { trigger: "endOfRound", seat: null } as GameEvent);
    const poisoned = (seat: number) => out.seats[seat]?.heroes.reduce((sum, hero) => sum + poisonOf(out, hero), 0);
    expect(poisoned(1)).toBe(1);
    expect(poisoned(0)).toBe(0);
  });

  it("132030:A:2 Lazy Lob poisons only the committed characters of the players of its own area", () => {
    const { t, state: made } = split();
    const committed = (made.seats[0]?.heroes ?? []).concat(made.seats[1]?.heroes ?? []).reduce((acc, hero) => updateCard(acc, hero, { committed: true }), made);
    const out = revealTo(t, committed, "132030", 1);
    for (const hero of out.seats[0]?.heroes ?? []) expect(poisonOf(out, hero), "area of the token holder").toBe(0);
    expect((out.seats[1]?.heroes ?? []).some((hero) => poisonOf(out, hero) > 0)).toBe(true);
  });

  it("132069:B:3 the stage Action is offered to the players at its stage, each paying from his own heroes, and never to a player of the other area", () => {
    const { t, state: made } = split({ heroResources: 2 });
    // Bilbo is not on the layout: the stand-in heroes of both seats are unconscious, and each holds resources.
    const all = [...(made.seats[0]?.heroes ?? []), ...(made.seats[1]?.heroes ?? [])];
    // The stand-in heroes hold Baggins resources (hob.bilbo-multiplayer-otd: a player without Bilbo spends the Baggins resources of his pool).
    for (const hero of all) {
      const code = made.cards[hero]?.code ?? "";
      const printed = t.ctx.cards.get(code);
      if (printed) (t.ctx.cards as Map<string, PrintedCard>).set(code, { ...printed, sphere: "baggins" });
    }
    const down = all.reduce((acc, hero) => run(t, acc, { verb: "MakeUnconscious", target: "self" }, 0, hero), made);
    const ready = all.reduce((acc, hero) => updateCard(acc, hero, { resources: 2 }), down);
    const stage3 = made.seats[0]?.stage ?? "";
    const stage4 = made.seats[1]?.stage ?? "";
    const offeredTo = (seat: number, stage: string) => legalIntents({ ...ready, window: { kind: "pass" }, activeSeat: seat }, t.ctx).some((intent) => intent.type === "Trigger" && intent.cardId === stage);
    expect(offeredTo(0, stage3)).toBe(true);
    expect(offeredTo(1, stage4)).toBe(true);
    expect(offeredTo(1, stage3), "a player of the other area uses the other area's stage").toBe(false);
    expect(offeredTo(0, stage4), "the first player is not at stage 4").toBe(false);
  });

  it("132035:A:1 Hidden Path lowers the Threat of the locations in its own staging area only", () => {
    const { t, state: made } = split();
    const a = place(made, "132035", 1);
    const own = place(a.state, "132026", 1);
    const other = place(own.state, "132026", 0);
    // Hidden Path is the active location of the player at stage 4.
    const withActive = syncConstants({ ...other.state, seats: other.state.seats.map((seat, index) => (index === 1 ? { ...seat, active: a.id } : seat)) as unknown as typeof other.state.seats, cards: { ...other.state.cards, [a.id]: { ...other.state.cards[a.id]!, zone: "activeLocation" } } }, t.ctx);
    const threatOf = (id: string) => modifiedStat(withActive, withActive.cards[id]!, "threat", t.ctx.cards);
    const base = (t.ctx.cards.get("132026")?.threat ?? 0);
    expect(threatOf(own.id), "a location of its own area").toBe(Math.max(0, base - 1));
    expect(threatOf(other.id), "a location of the other area").toBe(base);
  });

  it("132035:A:2 Hidden Path is entered with Baggins resources of the players of its own area only", () => {
    const { t, state: made } = split();
    for (const hero of [...(made.seats[0]?.heroes ?? []), ...(made.seats[1]?.heroes ?? [])]) {
      const printed = t.ctx.cards.get(made.cards[hero]?.code ?? "");
      if (printed) (t.ctx.cards as Map<string, PrintedCard>).set(printed.code, { ...printed, sphere: "baggins" });
    }
    const path = place(made, "132035", 1);
    const travelling = (resources: readonly [number, number]) => {
      const pooled = [0, 1].reduce((acc, seat) => (made.seats[seat]?.heroes ?? []).reduce((inner, hero) => updateCard(inner, hero, { resources: resources[seat] ?? 0 }), acc), path.state);
      return legalTargets({ ...pooled, phase: "Travel", mode: "travel", window: { kind: "travel" }, activeSeat: 1 }, { type: "Travel" }, t.ctx).includes(path.id);
    };
    expect(travelling([0, 2]), "the players of the area pay").toBe(true);
    expect(travelling([5, 0]), "resources of a player of the other area do not pay").toBe(false);
  });

  it("132037:A:1 Fighting Among Friends removes only the characters of the area it was revealed to from the quest", () => {
    const { t, state: made } = split();
    // Both players have awake characters on the quest.
    const out = revealTo(t, awake(t, made, true), "132037", 1);
    // The first player of the area names a sphere: the first option is Leadership, which no stand-in hero (Tactics) belongs to.
    for (const hero of out.seats[1]?.heroes ?? []) expect(out.cards[hero]?.committed, "area of the card").toBe(false);
    for (const hero of out.seats[0]?.heroes ?? []) expect(out.cards[hero]?.committed, "area of the token holder").toBe(true);
  });

  // Weighed Down's lasting effect reaches every exhausted character in play, the other area's included (the set's record is `target: characters`, owned by the branch of The Battle of Five Armies): the gap stays visible until its fix lands.
  it.fails("132038:A:1 Weighed Down gives -1 only to the exhausted characters of the area it was revealed to", () => {
    const { t, state: made } = split();
    const out = revealTo(t, awake(t, made, false, true), "132038", 1);
    const printed = (hero: string) => t.ctx.cards.get(out.cards[hero]?.code ?? "")?.willpower ?? 0;
    for (const hero of out.seats[1]?.heroes ?? []) expect(modifiedStat(out, out.cards[hero]!, "willpower", t.ctx.cards)).toBe(printed(hero) - 1);
    for (const hero of out.seats[0]?.heroes ?? []) expect(modifiedStat(out, out.cards[hero]!, "willpower", t.ctx.cards)).toBe(printed(hero));
  });
});
