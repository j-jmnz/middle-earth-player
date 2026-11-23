// Rules: rr.event-cards, rr.cost, rr.action, rr.combat-phase, rr.quest-phase, rr.engaged, rr.staging-area, rr.active-location, rr.damage,
// rr.lasting-effects, rr.ready, rr.play-restrictions-and-permissions (data/rules/entries.json).
// The Grey Havens events, each line tested from the words on the card: Skyward Volley 11004:A:1 and A:2, The Evening Star 11010:A:1,
// Elwing's Flight 11013:A:1. The lines are the text of data/cards/TGH.json (data/printed holds no entry for this pack), so every intent goes
// through sendUnledgered. "Resolve that effect again for each copy ... currently in your discard pile": the copy being played is not in the
// discard pile until it has resolved (rr.event-cards), so a discard pile with no copy resolves the effect once.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Table } from "../../../test/harness/scene.ts";
import { choices, combat, discarded, enter, play, playableCards, playerTableFor, printed, questing, sendUnledgered, stat } from "../../../test/harness/player-table.ts";

const VOLLEY = "11004";
const EVENING_STAR = "11010";
const ELWING = "11013";
// Core Legolas (Tactics, ranged), Gimli (Tactics, not ranged), Denethor (Lore), Éowyn (Spirit), Aragorn (Leadership).
const LEGOLAS = "01005";
const GIMLI = "01004";
const DENETHOR = "01010";
const EOWYN = "01007";
const ARAGORN = "01001";
// Horseback Archer: a ranged Tactics ally.
const ARCHER = "01030";
const WEAK = "weak";
const PLACE = "place";
const PAL = "pal";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([VOLLEY, EVENING_STAR, ELWING, LEGOLAS, GIMLI, DENETHOR, EOWYN, ARAGORN, ARCHER]))]);
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 0, health: 9 }));
  cards.set(PLACE, definePrinted({ code: PLACE, name: "Place", type: "location", threat: 1, questPoints: 9 }));
  base = { ...starter, cards };
});

// The card ids a PlayCard intent is offered for.

describe("Skyward Volley (11004:A:1, A:2)", () => {
  // Legolas (ranged) and Gimli for the first player, the Horseback Archer (ranged) for the second; an enemy engaged with each player and one in
  // the staging area; Skyward Volley in hand and `copies` more in the discard pile.
  function scene(effects: readonly Effect[], copies: number): { tab: Table; volley: string; mine: string; theirs: string; staged: string } {
    const start = table(effects, { seats: 2, heroes: [{ code: LEGOLAS, seat: 0 }, { code: GIMLI, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: ARCHER, seat: 1 }], engaged: [{ code: WEAK, seat: 0 }, { code: WEAK, seat: 1 }], staging: [WEAK], hand: [{ code: VOLLEY, seat: 0 }] });
    const { tab } = discarded(start, Array.from({ length: copies }, () => [VOLLEY, 0] as const));
    // The scene puts the staging area's cards in before the engaged ones.
    const [staged = "", mine = "", theirs = ""] = tab.ids[WEAK] ?? [];
    return { tab, volley: tab.ids[VOLLEY]?.[0] ?? "", mine, theirs, staged };
  }

  // "As an additional cost to play Skyward Volley, exhaust a ranged character you control.": with Legolas exhausted the other player's ready
  // Archer does not let it be played; with Legolas ready it is played and Legolas is exhausted. The Action's own record (11004:action:1) holds
  // the same condition and exhausts the character, so the line's constant record is not what this test needs: a plain test.
  it("11004:A:1 Skyward Volley: played only by exhausting a ranged character its player controls", () => {
    const { tab, volley, mine } = scene(EFFECTS, 0);
    const legolas = idsOf(tab, LEGOLAS);
    const run = combat(tab.state, tab);
    expect(playableCards(updateCard(run.state, legolas, { exhausted: true }), tab)).not.toContain(volley);
    let played = play(run, tab, volley);
    expect(played.state.cards[legolas]?.exhausted).toBe(true);
    expect(played.state.cards[idsOf(tab, ARCHER)]?.exhausted).toBe(false);
    played = sendUnledgered(played, { type: "Choose", optionId: mine }, tab.ctx);
    expect(played.state.cards[volley]?.zone).toBe("discard");
  });

  // "Combat Action: Deal 2 damage to an enemy engaged with a player.": in the combat phase the enemies engaged with either player are offered
  // and the one in the staging area is not; the chosen enemy takes 2 damage, once, with no copy in the discard pile.
  lineSpec("11004:A:2", "Skyward Volley: 2 damage to an enemy engaged with a player, once with no copy in the discard pile", (effects) => {
    const { tab, volley, mine, theirs, staged } = scene(effects, 0);
    let run = play(combat(tab.state, tab), tab, volley);
    expect(choices(run.state, tab).sort()).toEqual([mine, theirs].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: theirs }, tab.ctx);
    expect(run.state.cards[theirs]?.damage).toBe(2);
    expect([run.state.cards[mine]?.damage, run.state.cards[staged]?.damage]).toEqual([0, 0]);
    expect(run.state.window?.kind).not.toBe("choose");
  });

  // An enemy in the staging area is not engaged with a player.
  it("11004:A:2 Skyward Volley: an enemy in the staging area is no target", () => {
    const { tab, volley, staged } = scene(EFFECTS, 0);
    const run = play(combat(tab.state, tab), tab, volley);
    expect(choices(run.state, tab)).not.toContain(staged);
  });

  // "Resolve that effect again for each copy of Skyward Volley currently in your discard pile (you may choose different targets).": with 2
  // copies in the discard pile it resolves 3 times; the first enemy is chosen twice, the other once.
  it("11004:A:2 Skyward Volley: resolves again for each copy in the discard pile", () => {
    const { tab, volley, mine, theirs } = scene(EFFECTS, 2);
    let run = play(combat(tab.state, tab), tab, volley);
    for (const target of [mine, mine, theirs]) {
      expect(run.state.window?.kind).toBe("choose");
      run = sendUnledgered(run, { type: "Choose", optionId: target }, tab.ctx);
    }
    expect([run.state.cards[mine]?.damage, run.state.cards[theirs]?.damage]).toEqual([4, 2]);
    expect(run.state.window?.kind).not.toBe("choose");
  });

  // "Combat Action": in the planning phase it is not offered.
  it("11004:A:2 Skyward Volley: not played outside the combat phase", () => {
    const { tab, volley } = scene(EFFECTS, 0);
    expect(playableCards(tab.state, tab)).not.toContain(volley);
  });
});

describe("The Evening Star (11010:A:1)", () => {
  // Denethor (Lore) pays; one location is active and one is in the staging area; `copies` more Evening Stars are in the discard pile.
  function scene(effects: readonly Effect[], copies: number): { tab: Table; star: string; active: string; staged: string } {
    const start = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }], staging: [PLACE], active: PLACE, hand: [{ code: EVENING_STAR, seat: 0 }] });
    const { tab } = discarded(start, Array.from({ length: copies }, () => [EVENING_STAR, 0] as const));
    const [staged = "", active = ""] = tab.ids[PLACE] ?? [];
    return { tab, star: tab.ids[EVENING_STAR]?.[0] ?? "", active, staged };
  }

  // "Action: Place 2 progress on any location.": the active location and the one in the staging area are both offered; the chosen one gets 2
  // progress, once, with no copy in the discard pile.
  lineSpec("11010:A:1", "The Evening Star: 2 progress on any location, once with no copy in the discard pile", (effects) => {
    const { tab, star, active, staged } = scene(effects, 0);
    let run = play(begin(tab.state), tab, star);
    expect(choices(run.state, tab).sort()).toEqual([active, staged].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: staged }, tab.ctx);
    expect([run.state.cards[staged]?.progress, run.state.cards[active]?.progress]).toEqual([2, 0]);
    expect(run.state.window?.kind).not.toBe("choose");
  });

  // "Resolve that effect again for each copy of The Evening Star currently in your discard pile (you may choose new targets).": with 1 copy in
  // the discard pile it resolves twice, on each location once.
  it("11010:A:1 The Evening Star: resolves again for each copy in the discard pile", () => {
    const { tab, star, active, staged } = scene(EFFECTS, 1);
    let run = play(begin(tab.state), tab, star);
    for (const target of [active, staged]) {
      expect(run.state.window?.kind).toBe("choose");
      run = sendUnledgered(run, { type: "Choose", optionId: target }, tab.ctx);
    }
    expect([run.state.cards[staged]?.progress, run.state.cards[active]?.progress]).toEqual([2, 2]);
  });
});

describe("Elwing's Flight (11013:A:1)", () => {
  // Éowyn (Spirit) pays and does not quest; Aragorn and the other player's hero quest and are exhausted; `copies` more copies are in the
  // discard pile.
  function scene(effects: readonly Effect[], copies: number): { tab: Table; flight: string; aragorn: string; pal: string; eowyn: string } {
    const start = table(effects, { seats: 2, heroes: [{ code: EOWYN, seat: 0 }, { code: ARAGORN, seat: 0 }, { code: PAL, seat: 1 }], hand: [{ code: ELWING, seat: 0 }], deck: ["f0", "f0"] });
    const { tab: dealt } = discarded(start, Array.from({ length: copies }, () => [ELWING, 0] as const));
    const [aragorn, pal, eowyn] = [idsOf(dealt, ARAGORN), idsOf(dealt, PAL), idsOf(dealt, EOWYN)];
    let state = questing(dealt.state);
    for (const id of [aragorn, pal]) state = updateCard(state, id, { committed: true, exhausted: true });
    return { tab: { ...dealt, state }, flight: dealt.ids[ELWING]?.[0] ?? "", aragorn, pal, eowyn };
  }

  // "Quest Action: Ready a questing character and give that character +1 Willpower until the end of the phase.": the questing characters of
  // both players are offered and Éowyn is not; Aragorn readies with +1 Willpower, once, and the bonus ends with the quest phase.
  lineSpec("11013:A:1", "Elwing's Flight: readies a questing character with +1 Willpower until the end of the phase", (effects) => {
    const { tab, flight, aragorn, pal } = scene(effects, 0);
    let run = play(begin(tab.state), tab, flight);
    expect(choices(run.state, tab).sort()).toEqual([aragorn, pal].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: aragorn }, tab.ctx);
    expect(run.state.cards[aragorn]?.exhausted).toBe(false);
    expect(run.state.cards[pal]?.exhausted).toBe(true);
    expect(stat(run.state, tab, aragorn, "willpower")).toBe(printed(tab, ARAGORN, "willpower") + 1);
    expect(run.state.window?.kind).not.toBe("choose");
    const later = enter(run.state, tab, "travel");
    expect(stat(later.state, tab, aragorn, "willpower")).toBe(printed(tab, ARAGORN, "willpower"));
  });

  // "Resolve that effect again for each copy of Elwing's Flight currently in your discard pile (you may choose different targets).": with 1
  // copy in the discard pile, Aragorn and the other player's hero both ready.
  it("11013:A:1 Elwing's Flight: resolves again for each copy in the discard pile", () => {
    const { tab, flight, aragorn, pal } = scene(EFFECTS, 1);
    let run = play(begin(tab.state), tab, flight);
    for (const target of [aragorn, pal]) {
      expect(run.state.window?.kind).toBe("choose");
      run = sendUnledgered(run, { type: "Choose", optionId: target }, tab.ctx);
    }
    expect([run.state.cards[aragorn]?.exhausted, run.state.cards[pal]?.exhausted]).toEqual([false, false]);
    expect(stat(run.state, tab, pal, "willpower")).toBe(printed(tab, PAL, "willpower") + 1);
  });

  // "Quest Action": in the planning phase it is not offered.
  it("11013:A:1 Elwing's Flight: not played outside the quest phase", () => {
    const { tab, flight } = scene(EFFECTS, 0);
    const planning = { ...tab.state, phase: "Planning" as const, boundaryPhase: "Planning" as const, mode: "planning" as const, window: { kind: "pass" as const } };
    expect(playableCards(planning, tab)).not.toContain(flight);
  });
});
