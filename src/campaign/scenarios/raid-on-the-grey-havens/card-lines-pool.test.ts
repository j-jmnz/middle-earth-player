// Rules: dcce.scalable-upgradable, dcce.campaign-setup-raid-on-the-grey-havens, rr.victory, rr.response, rr.triggered-ability, rr.step-6-4-3, rr.step-1-2 (data/rules/entries.json). The cards Raid on the Grey
// Havens' campaign card deals or earns, written from their ledger lines: Black Key (11183:A:1, 11183:B:1, 11183:B:2), the four Galdor's Counsel (11184:A:1 to 11187:A:1), Parrying Cutlass (11189:A:2, 11189:B:2,
// 11189:B:3) and Throwing Axe (11190:A:2, 11190:B:2). A side B is the card's Upgraded side. Each test that shows a record at work runs once more without the records of its line (`withoutLine`), and that run must differ.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { legalIntents, reduce, type PlayerIntent, type ReduceContext } from "../../../rules/engine/reduce.ts";
import { attack, cardSpecs, defend, withoutLine, zone, type Row } from "../../../../test/harness/card-spec.ts";
import { fightEnemy, finish, idOf, send, start, tableFromLayout, type Layout, type LayoutTable, type Run } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "raid-on-the-grey-havens";

// 11183:A:1 "When Black Key leaves play, remove it from the game." The ally (1 Defense, 2 hit points, 1 damage) holding it defends against Umbar Raider (3 Attack): 3 - 2 is the second damage and it is destroyed.
const ROWS: readonly Row[] = [
  { line: "11183:A:1", name: "it is removed from the game when the character it is attached to is destroyed", layout: { play: [{ code: "ally", seat: 0, damage: 1 }], attached: [{ code: "11183", to: "ally" }] }, act: [attack("11064"), defend("ally")], expect: [zone("ally", "discard"), zone("11183", "removed")] },
];
cardSpecs(SCENARIO, ROWS);

const table = (layout: Layout, effects: readonly Effect[]) => tableFromLayout(SCENARIO, layout, { effects });
// A card with records on both sides keeps every record once one side has none (families/dreamchaser/faces.ts, recordsOfFace): a side's constant is shown to work against the card with neither side's.
const withoutLines = (...lines: string[]): readonly Effect[] => lines.reduce<readonly Effect[]>((effects, line) => withoutLine(effects, line), EFFECTS);
// The card turned to its Upgraded side (B), the constants read again.
const upgraded = (made: LayoutTable, code: string): ScenarioState => syncConstants(updateCard(made.state, idOf(made.state, code), { face: "B" }), made.ctx);
const statOf = (state: ScenarioState, cards: LayoutTable["cards"], code: string, which: "willpower" | "attack" | "defense") => modifiedStat(state, state.cards[idOf(state, code)]!, which, cards);

describe("11183 Black Key, Upgraded", () => {
  const worn = (effects: readonly Effect[]) => {
    const made = table({ play: [{ code: "ally", seat: 0, damage: 1 }], attached: [{ code: "11183", to: "ally" }] }, effects);
    return { made, state: upgraded(made, "11183") };
  };

  it("11183:B:2 gives the attached character +1 Willpower, +1 Attack and +1 Defense", () => {
    const { made, state } = worn(EFFECTS);
    expect(["willpower", "attack", "defense"].map((which) => statOf(state, made.cards, "ally", which as "attack"))).toEqual([2, 2, 2]);
    const bare = worn(withoutLine(EFFECTS, "11183:B:2"));
    expect(statOf(bare.state, bare.made.cards, "ally", "defense")).toBe(1);
  });

  it("11183:B:1 is removed from the game when the character it is attached to is destroyed", () => {
    // Its 2 Defense against Umbar Raider's 3 Attack: 1 more damage destroys the ally.
    const fought = (effects: readonly Effect[]) =>
      fightEnemy((layout: Layout) => table(layout, effects), "f0", "11064", { play: [{ code: "ally", seat: 0, damage: 1 }], attached: [{ code: "11183", to: "ally" }] }, { tweak: (state, made) => upgraded({ ...made, state }, "11183"), defender: (made) => idOf(made.state, "ally") }).run.state;
    const state = fought(EFFECTS);
    expect(state.cards[idOf(state, "ally")]?.zone).toBe("discard");
    expect(state.cards[idOf(state, "11183")]?.zone).toBe("removed");
    const without = fought(withoutLine(EFFECTS, "11183:B:1"));
    expect(without.cards[idOf(without, "11183")]?.zone).not.toBe("removed");
  });
});

describe("Galdor's Counsel", () => {
  // The event is played from the first player's hand at the level given, with the copies chosen at the Setup; the first hero pays its cost. `pick` answers the choices it opens.
  function counsel(code: string, level: number, chosen: number, layout: Layout, pick: (state: ScenarioState) => string, effects: readonly Effect[] = EFFECTS): { run: Run | null; made: LayoutTable; asked: string[][] } {
    const made = table({ phase: "Combat", hand: [{ code, seat: 0 }], heroResources: 1, ...layout }, effects);
    const facts = { prisoner: null, usedOnce: [], counters: {}, levels: { [code]: level } };
    const state: ScenarioState = { ...made.state, campaignFacts: facts, chosenAtSetup: Array.from({ length: chosen }, (_, seat) => ({ code, seat })) };
    const cost = Number(made.cards.get(code)?.cost ?? 0);
    const sent = reduce(state, { type: "PlayCard", cardId: idOf(state, code), payments: cost > 0 ? [{ heroId: made.hero, amount: cost }] : [] }, made.ctx);
    const asked: string[][] = [];
    const answer = (current: ScenarioState) => {
      if (current.window?.kind === "choose") asked.push([...current.window.options]);
      return pick(current);
    };
    return { run: sent.ok ? finish({ state: sent.state, steps: [...sent.steps] }, made.ctx, answer) : null, made, asked };
  }
  const first = (state: ScenarioState) => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "");
  const byCode = (code: string) => (state: ScenarioState) => (state.window?.kind === "choose" ? (state.window.options.find((id) => state.cards[id]?.code === code) ?? state.window.options[0] ?? "") : "");

  it("11184:A:1 adds X resources to any hero's pool, a hero of another player too, X half its level rounded up plus 1 for each chosen copy, and goes to the victory display", () => {
    // Level 3: half rounded up is 2; one copy chosen: X is 3.
    const { run, made } = counsel("11184", 3, 1, { seats: 2 }, byCode("dh3"));
    const state = run!.state;
    expect(state.cards[made.seat1Hero ?? ""]?.resources).toBe(1 + 3);
    expect(state.cards[idOf(state, "11184")]?.zone).toBe("victory");
    expect(counsel("11184", 3, 1, { seats: 2 }, byCode("dh3"), withoutLine(EFFECTS, "11184:A:1")).run?.state.cards[made.seat1Hero ?? ""]?.resources ?? 1).toBe(1);
  });

  it("11185:A:1 deals X damage to a non-unique enemy, never offering a unique one, X its level plus 1 for each chosen copy, and goes to the victory display", () => {
    // Na'asiyah is unique; Umbar Raider and the stand-in f3 are not. Level 2, two copies chosen: 4 damage.
    const { run, asked } = counsel("11185", 2, 2, { seats: 2, staging: ["11078", "f3"], engaged: ["11064"] }, byCode("11064"));
    const state = run!.state;
    expect(asked.flat().map((id) => state.cards[id]?.code).sort()).toEqual(["11064", "f3"]);
    expect(state.cards[idOf(state, "11064")]?.damage ?? 0).toBe(4);
    expect(state.cards[idOf(state, "11185")]?.zone).toBe("victory");
  });

  it("11186:A:1 places X progress on a non-unique location in the staging area, not the active location and not a unique one, X its level plus 1 for each chosen copy", () => {
    // The Dream-chaser is unique; the active White Ship is not in the staging area. Level 1, one copy chosen: 2 progress.
    const { run, asked } = counsel("11186", 1, 1, { staging: ["11039", "11043", "place"], active: "11045" }, byCode("11043"));
    const state = run!.state;
    expect(asked.flat().map((id) => state.cards[id]?.code).sort()).toEqual(["11043", "place"]);
    expect(state.cards[idOf(state, "11043")]?.progress ?? 0).toBe(2);
    expect(state.cards[idOf(state, "11186")]?.zone).toBe("victory");
  });

  it("11187:A:1 looks at the bottom X cards of the deck, X half its level rounded up plus 1, adds the ones chosen to the hand and puts the rest on top", () => {
    // Level 2: half is 1; one copy chosen: X is 2, the bottom two cards c2 and c3. c3 goes to the hand, c2 on top of the deck.
    let taken = false;
    const pick = (state: ScenarioState): string => {
      const options = state.window?.kind === "choose" ? state.window.options : [];
      if (options.includes("bottom") && !taken) return "bottom";
      const c3 = options.find((id) => state.cards[id]?.code === "c3");
      if (c3 && !taken) {
        taken = true;
        return c3;
      }
      if (options.includes("done")) return "done";
      if (options.includes("top")) return "top";
      return first(state);
    };
    const { run } = counsel("11187", 2, 1, { deckOf: [{ code: "c0", seat: 0 }, { code: "c1", seat: 0 }, { code: "c2", seat: 0 }, { code: "c3", seat: 0 }] }, pick);
    const state = run!.state;
    expect(state.seats[0]?.hand.map((id) => state.cards[id]?.code)).toEqual(["c3"]);
    expect(state.seats[0]?.deck.map((id) => state.cards[id]?.code)).toEqual(["c2", "c0", "c1"]);
    expect(state.cards[idOf(state, "11187")]?.zone).toBe("victory");
  });

  it("11184:A:1 to 11187:A:1 cannot be played without its records", () => {
    for (const code of ["11184", "11185", "11186", "11187"]) expect(counsel(code, 1, 1, { staging: ["f3", "place"] }, first, withoutLine(EFFECTS, `${code}:A:1`)).run, code).toBeNull();
  });
});

describe("11189 Parrying Cutlass", () => {
  const worn = (resources: number, side: "A" | "B", effects: readonly Effect[]) => {
    const made = table({ attached: [{ code: "11189", to: "dh1" }] }, effects);
    const loaded = updateCard(made.state, made.hero, { resources });
    const state = side === "B" ? upgraded({ ...made, state: loaded }, "11189") : syncConstants(loaded, made.ctx);
    return { made, state };
  };
  const defense = (resources: number, side: "A" | "B", effects: readonly Effect[] = EFFECTS) => {
    const { made, state } = worn(resources, side, effects);
    return statOf(state, made.cards, "dh1", "defense");
  };

  it("11189:A:2 gives the attached hero +1 Defense, +2 once the resources it collects make 2 in its pool", () => {
    // The hero holds 1 resource and collects 1 at the beginning of the resource phase.
    const { made, state } = worn(1, "A", EFFECTS);
    expect(statOf(state, made.cards, "dh1", "defense")).toBe(3);
    const granted = settle({ ...state, phase: "Resource", boundaryPhase: "Resource", mode: "resourceGrant", window: null }, made.ctx, []);
    // The players pass the resource phase's action window: the state that intent returns.
    const collected = send(start(granted), { type: "Pass" }, made.ctx).state;
    expect(collected.cards[made.hero]?.resources).toBe(2);
    expect(statOf(collected, made.cards, "dh1", "defense")).toBe(4);
    expect(defense(2, "A", withoutLines("11189:A:2", "11189:B:2"))).toBe(2);
  });

  it("11189:B:2 gives the attached hero +2 Defense, +3 with 2 or more resources in its pool", () => {
    expect([defense(1, "B"), defense(2, "B"), defense(5, "B")]).toEqual([4, 5, 5]);
    expect(defense(2, "B", withoutLines("11189:A:2", "11189:B:2"))).toBe(2);
  });

  // Raid Leader (5 Attack; no Forced effect after its attack, so the resources it ends with are the Response's) attacks the first player with resources on it; `defender` defends. The run stops in the window
  // after the defender is declared.
  function declared(enemyResources: number, defender: "dh1" | "dh2"): { run: Run; ctx: ReduceContext; cutlass: string } {
    const made = table({ phase: "Encounter", engaged: [{ code: "11066", seat: 0, resources: enemyResources }], attached: [{ code: "11189", to: "dh1" }], deck: ["f0", "f0"] }, EFFECTS);
    const state = upgraded(made, "11189");
    let run: Run = start(state);
    for (let guard = 0; guard < 40 && run.state.window?.kind !== "defense"; guard += 1) {
      const next = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineEngage");
      if (!next) break;
      run = send(run, next, made.ctx);
    }
    return { run: send(run, { type: "DeclareDefender", defenderId: idOf(state, defender) }, made.ctx), ctx: made.ctx, cutlass: idOf(state, "11189") };
  }
  const responseOf = (run: Run, ctx: ReduceContext, cutlass: string) => legalIntents(run.state, ctx).find((intent) => intent.type === "Trigger" && intent.cardId === cutlass);

  it("11189:B:3 exhausts when the attached hero defends to move 1 resource from the attacking enemy to the hero's pool", () => {
    const { run, ctx, cutlass } = declared(2, "dh1");
    const response = responseOf(run, ctx, cutlass);
    expect(response).toBeDefined();
    const used = finish(send(run, response as PlayerIntent, ctx), ctx).state;
    expect(used.cards[cutlass]?.exhausted).toBe(true);
    expect(used.cards[idOf(used, "11066")]?.resources).toBe(1);
    expect(used.cards[idOf(used, "dh1")]?.resources).toBe(1);
  });

  it("11189:B:3 is not offered when another hero defends, or when the attacking enemy has no resource", () => {
    const other = declared(2, "dh2");
    expect(responseOf(other.run, other.ctx, other.cutlass)).toBeUndefined();
    const empty = declared(0, "dh1");
    expect(responseOf(empty.run, empty.ctx, empty.cutlass)).toBeUndefined();
  });
});

describe("11190 Throwing Axe", () => {
  const attackOf = (damage: number, side: "A" | "B", effects: readonly Effect[] = EFFECTS) => {
    const made = table({ attached: [{ code: "11190", to: "dh1" }] }, effects);
    const hurt = updateCard(made.state, made.hero, { damage });
    const state = side === "B" ? upgraded({ ...made, state: hurt }, "11190") : syncConstants(hurt, made.ctx);
    return statOf(state, made.cards, "dh1", "attack");
  };

  it("11190:A:2 gives the attached hero +1 Attack, +2 once an attack leaves 2 damage on it", () => {
    expect(attackOf(1, "A")).toBe(3);
    // Umbar Raider's undefended attack (3 Attack) lands on the hero holding the axe.
    const fought = fightEnemy((layout: Layout) => table(layout, EFFECTS), "f0", "11064", { attached: [{ code: "11190", to: "dh1" }] }, { undefended: true });
    const state = fought.run.state;
    expect(state.cards[fought.made.hero]?.damage).toBe(3);
    expect(statOf(state, fought.made.cards, "dh1", "attack")).toBe(4);
    expect(attackOf(2, "A", withoutLines("11190:A:2", "11190:B:2"))).toBe(2);
  });

  it("11190:B:2 gives the attached hero +2 Attack, +3 with 2 or more damage on it", () => {
    expect([attackOf(0, "B"), attackOf(1, "B"), attackOf(2, "B"), attackOf(4, "B")]).toEqual([4, 4, 5, 5]);
    expect(attackOf(2, "B", withoutLines("11190:A:2", "11190:B:2"))).toBe(2);
  });
});
