// Rules: dcce.heading, rr.in-play-and-out-of-play, rr.shadow-effects, rr.forced, rr.then, rr.attachment-cards, rr.damage, rr.first-player, rr.step-6-4-3 (data/rules/entries.json).
// Lines: 12151:A:2, 12152:A:2, 12155:A:2, 12156:A:1, 12157:A:1, 12158:A:1, 12158:A:2, 12159:A:2, 12162:A:1, 110129:A:2, 110129:B:2, 11216:B:2, 11216:B:3. The City of Corsairs lines a single card-spec row cannot
// show (card-lines.test.ts holds the rows): a seat, the heading, damage placed on Captain Sahír, the resource phase, The Black Sword's side B and the false cases. Each runs again with the records of its line removed
// (test/harness/card-spec.ts, withoutLine), where it must not hold.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { ruleCause } from "../../../rules/core/cause.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { modifiedStat, placeDamage } from "../../../rules/core/keywords.ts";
import { flagged, type GameEvent, type ScenarioState } from "../../../rules/core/state.ts";
import { spawn } from "../../../rules/core/zones.ts";
import { settle } from "../../../rules/engine/machine.ts";
import type { ReduceContext } from "../../../rules/engine/reduce.ts";
import type { Heading } from "../../../rules/families/sea/types.ts";
import { runInstruction } from "../../../rules/interpret/interpret.ts";
import { attachBlocked } from "../../../rules/interpret/restrictions.ts";
import { startReveal } from "../../../rules/windows/frames.ts";
import { fireForced } from "../../../rules/windows/triggers.ts";
import { withoutLine } from "../../../../test/harness/card-spec.ts";
import { fightEnemy, finish, idOf, revealFromTop, tableFromLayout, type Layout, type LayoutTable } from "../../../../test/harness/scene-kit.ts";

const ID = "the-city-of-corsairs";
const SAHIR = "12158";
const SWORD = "11216";
const without = (...lines: string[]): readonly Effect[] => lines.reduce(withoutLine, EFFECTS);

// The table of a layout on these records, with the Heading card set to `heading` (dcce.heading; none: no Heading card in the game). `extra` places a card the campaign deal leaves out (the standalone Shattered Monument).
function make(layout: Layout, options: { effects?: readonly Effect[]; heading?: Heading; extra?: readonly string[] } = {}): LayoutTable {
  const made = tableFromLayout(ID, layout, { ...(options.effects ? { effects: options.effects } : {}), ...(options.extra ? { extra: options.extra } : {}) });
  if (!options.heading) return made;
  return { ...made, state: { ...made.state, sea: { ...(made.state.sea ?? { headingCard: null, routes: {} }), heading: options.heading } } };
}

// The engine announces the event to the Forced effects and settles what they start, every choice taking its first option.
function announce(state: ScenarioState, event: GameEvent, ctx: ReduceContext): ScenarioState {
  const steps: EngineStep[] = [];
  return finish({ state: settle(fireForced({ ...state, window: null }, event, ctx, steps), ctx, steps), steps }, ctx).state;
}

// The card is revealed from the top of the encounter deck and its choices take their first option.
function revealed(made: LayoutTable, code: string): ScenarioState {
  const steps: EngineStep[] = [];
  return finish({ state: revealFromTop(made.state, made.ctx, code, steps).state, steps }, made.ctx).state;
}

const resources = (state: ScenarioState, code: string): number => state.cards[idOf(state, code)]?.resources ?? 0;

describe("12151 Stormcaller and 12152 Slave Ship", () => {
  // "Cannot have attachments."
  for (const [code, line] of [["12151", "12151:A:2"], ["12152", "12152:A:2"]] as const) {
    it(`${line} an attachment cannot be attached to it`, () => {
      const made = make({ staging: [code] });
      expect(attachBlocked(made.state, made.ctx, idOf(made.state, code), "attachment")).toBe(true);
      const bare = make({ staging: [code] }, { effects: without(line) });
      expect(attachBlocked(bare.state, bare.ctx, idOf(bare.state, code), "attachment")).toBe(false);
    });
  }
});

describe("12155 Corsair Waters", () => {
  // "Shadow: Either shift your heading off-course, or treat this attack as undefended." Umbar Raider (3 Attack) attacks; dh1 (2 Defense) defends.
  const fought = (option: string, effects: readonly Effect[] = EFFECTS) =>
    fightEnemy((layout: Layout) => make(layout, { effects, heading: "Sun" }), "12155", "11064", {}, { pick: (state) => (state.window?.kind === "choose" && state.window.options.includes(option) ? option : (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "")) });
  const heroDamage = (state: ScenarioState): number => (state.cards[idOf(state, "dh1")]?.damage ?? 0) + (state.cards[idOf(state, "dh2")]?.damage ?? 0);

  it("12155:A:2 the defending player shifts the heading one step off-course, and the attack stays defended", () => {
    const run = fought("heading").run.state;
    expect(run.sea?.heading).toBe("Cloud");
    expect(heroDamage(run)).toBe(1);
    expect(fought("heading", without("12155:A:2")).run.state.sea?.heading).toBe("Sun");
  });

  it("12155:A:2 or the attack is treated as undefended: its whole 3 Attack lands on a hero, the Defense ignored", () => {
    const run = fought("undefended").run.state;
    expect(heroDamage(run)).toBe(3);
    expect(run.sea?.heading).toBe("Sun");
    expect(heroDamage(fought("undefended", without("12155:A:2")).run.state)).toBe(1);
  });
});

describe("12156 Watch Tower", () => {
  // "While Watch Tower is in the staging area, it gains: 'Forced: When a Raider enemy enters play, add 1 resource to it.'"
  it("12156:A:1 gives a revealed Raider 1 resource from the staging area only: not as the active location, and not without its record", () => {
    expect(resources(revealed(make({ staging: ["12156"], deck: ["f0"] }), "11064"), "11064")).toBe(1);
    expect(resources(revealed(make({ active: "12156", deck: ["f0"] }), "11064"), "11064")).toBe(0);
    expect(resources(revealed(make({ staging: ["12156"], deck: ["f0"] }), "f3"), "f3")).toBe(0);
    expect(resources(revealed(make({ staging: ["12156"], deck: ["f0"] }, { effects: without("12156:A:1") }), "11064"), "11064")).toBe(0);
  });
});

describe("12157 Serpent's Tail", () => {
  // "When Revealed: Deal 1 shadow card to each Ship enemy in play. Then, if you are off-course (Cloud, Rain, or Storm), each Ship enemy in play gets -10 engagement cost until the end of the round."
  // The Slave Ship 12152 (engagement cost 32) waits in the staging area and a Light Cruiser 11057 (37) is engaged; Umbar Raider 11064 is a Corsair, not a Ship.
  const layout: Layout = { staging: ["12152", "11064"], engaged: ["11057"], deck: ["f0", "f0", "f0", "f0"] };
  const shadowOf = (state: ScenarioState, code: string): string | null => state.cards[idOf(state, code)]?.shadowId ?? null;
  const cost = (made: LayoutTable, state: ScenarioState, code: string): number => modifiedStat(state, state.cards[idOf(state, code)]!, "engagementCost", made.cards);

  // The box's ruling (docs/scenarios/dream-chaser.md, the Raiders of the City of Corsairs; user ruling, 2026-11-05): only an engaged Ship enemy is dealt one, a Ship in the staging area is not (rr.step-6-2).
  it("12157:A:1 deals a shadow card to the engaged Ship enemy, and none to the Ship in the staging area or to another enemy", () => {
    const made = make(layout, { heading: "Sun" });
    const state = revealed(made, "12157");
    expect(shadowOf(state, "11057")).not.toBeNull();
    expect(shadowOf(state, "12152")).toBeNull();
    expect(shadowOf(state, "11064")).toBeNull();
    const bare = make(layout, { heading: "Sun", effects: without("12157:A:1") });
    expect(shadowOf(revealed(bare, "12157"), "11057")).toBeNull();
  });

  it("12157:A:1 then, off-course, each Ship enemy gets -10 engagement cost until the end of the round; on-course it does not", () => {
    const off = make(layout, { heading: "Rain" });
    const offState = revealed(off, "12157");
    expect(cost(off, offState, "12152")).toBe(22);
    expect(cost(off, offState, "11057")).toBe(27);
    expect(cost(off, offState, "11064")).toBe(24);
    const on = make(layout, { heading: "Sun" });
    expect(cost(on, revealed(on, "12157"), "12152")).toBe(32);
    const bare = make(layout, { heading: "Rain", effects: without("12157:A:1") });
    expect(cost(bare, revealed(bare, "12157"), "12152")).toBe(32);
  });
});

describe("12158 Captain Sahír", () => {
  // "Captain Sahír engages the first player." The second seat is the first player; the first seat reveals him.
  it("12158:A:1 engages the first player, not the player who revealed him", () => {
    const run = (effects?: readonly Effect[]) => {
      const made = make({ seats: 2, firstPlayer: 1, deck: ["f0"], threat: [50, 50] }, effects ? { effects } : {});
      const spawned = spawn({ ...made.state, window: null, mode: "stopped" }, SAHIR, { zone: "encounterDeck" }, "down");
      const top = { ...spawned.state, encounterDeck: [spawned.id, ...spawned.state.encounterDeck.filter((id) => id !== spawned.id)] };
      const steps: EngineStep[] = [];
      return finish({ state: settle(startReveal(top, 0, made.ctx, steps), made.ctx, steps), steps }, made.ctx).state.cards[spawned.id];
    };
    expect(run()).toMatchObject({ zone: "engaged", controller: 1 });
    expect(run(without("12158:A:1"))?.zone).toBe("staging");
  });

  // "For each point of damage Captain Sahír would take, discard 1 resource from him and cancel that damage."
  const hurt = (amount: number, held: number, effects?: readonly Effect[]) => {
    const made = make({ phase: "Combat", engaged: [{ code: SAHIR, seat: 0, resources: held }] }, effects ? { effects } : {});
    const id = idOf(made.state, SAHIR);
    const state = placeDamage(made.state, id, amount, made.cards, [], "framework", ruleCause("rr.damage"));
    return { damage: state.cards[id]?.damage ?? 0, resources: state.cards[id]?.resources ?? 0 };
  };

  it("12158:A:2 each point of damage discards 1 resource from him instead of landing, and the points past his resources land", () => {
    expect(hurt(2, 3)).toEqual({ damage: 0, resources: 1 });
    expect(hurt(5, 3)).toEqual({ damage: 2, resources: 0 });
    expect(hurt(2, 0)).toEqual({ damage: 2, resources: 0 });
    expect(hurt(2, 3, without("12158:A:2"))).toEqual({ damage: 2, resources: 3 });
  });
});

describe("12159, 110129 The Shattered Monument", () => {
  // "Forced: At the beginning of the resource phase, add 1 resource to each Raider enemy in play." (110129 prints it on both sides.) A Raider in the staging area, one engaged, a Raider in the discard pile.
  const begun = (monument: Layout["staging"], effects: readonly Effect[] = EFFECTS, phase: ScenarioState["phase"] = "Resource"): ScenarioState => {
    const made = make({ staging: [...(monument ?? []), "11064"], engaged: ["11065"], discard: ["11066"] }, { effects, extra: ["12159"] });
    return announce({ ...made.state, phase }, { trigger: "beginningOfPhase", seat: null, phase } as GameEvent, made.ctx);
  };
  const cases = [
    ["12159:A:2", ["12159"], "the standalone card"],
    ["110129:A:2", ["110129"], "the Campaign Mode card's side A"],
    ["110129:B:2", [{ code: "110129", upgraded: true as const }], "the Campaign Mode card's side B"],
  ] as const;
  for (const [line, monument, what] of cases) {
    it(`${line} ${what} adds 1 resource to each Raider in play, in the staging area and engaged, and none to one out of play or in another phase`, () => {
      const state = begun(monument);
      expect([resources(state, "11064"), resources(state, "11065"), resources(state, "11066")]).toEqual([1, 1, 0]);
      const planning = begun(monument, EFFECTS, "Planning");
      expect(resources(planning, "11064")).toBe(0);
      const bare = begun(monument, without(line));
      expect(resources(bare, "11064")).toBe(0);
    });
  }
});

describe("12162 Umbar Harbor", () => {
  // "While Umbar Harbor is the active location, Corsair enemies get +2 Defense." Umbar Raider prints 2 Defense.
  it("12162:A:1 gives no Defense while it waits in the staging area, and +2 once it is active", () => {
    const defense = (layout: Layout, effects?: readonly Effect[]) => {
      const made = make(layout, effects ? { effects } : {});
      return modifiedStat(made.state, made.state.cards[idOf(made.state, "11064")]!, "defense", made.cards);
    };
    expect(defense({ staging: ["12162", "11064"] })).toBe(2);
    expect(defense({ active: "12162", staging: ["11064"] })).toBe(4);
    expect(defense({ active: "12162", staging: ["11064"] }, without("12162:A:1"))).toBe(2);
  });
});

describe("11216 The Black Sword, side B", () => {
  // B:2 "The Black Sword enters play with 2 resources on it." B:3 "Captain Sahír gains indestructible." (side B prints no +2 Attack). The Sword, on side B, is attached to Sahír from the set-aside cards, as the campaign card's Forced does.
  const armed = (effects: readonly Effect[] = EFFECTS) => {
    const made = make({ engaged: [SAHIR], setAside: [SWORD] }, { effects });
    // A campaign whose log marks The Black Sword upgraded turns it up on its side B (dcce.scalable-upgradable).
    const state: ScenarioState = { ...made.state, campaignFacts: { prisoner: null, usedOnce: [], counters: {}, upgraded: [SWORD] } };
    const steps: EngineStep[] = [];
    const next = runInstruction({ ...state, window: null }, { verb: "AttachSetAsideTo", code: SWORD, to: "Captain Sahír" }, { seat: 0, sourceId: null }, made.ctx, steps);
    const done = finish({ state: settle(next, made.ctx, steps), steps }, made.ctx).state;
    const sahir = done.cards[idOf(done, SAHIR)]!;
    return { state: done, sword: done.cards[idOf(done, SWORD)], indestructible: flagged(done, sahir.id, "indestructible"), attack: modifiedStat(done, sahir, "attack", made.cards) };
  };

  it("11216:B:2 enters play attached to Sahír with 2 resources on it", () => {
    expect(armed().sword).toMatchObject({ face: "B", host: idOf(armed().state, SAHIR), resources: 2 });
    expect(armed(without("11216:B:2")).sword?.resources).toBe(0);
  });

  it("11216:B:3 gives Sahír indestructible and leaves his printed 6 Attack", () => {
    expect(armed()).toMatchObject({ indestructible: true, attack: 6 });
    expect(armed(without("11216:B:3")).indestructible).toBe(false);
  });
});
