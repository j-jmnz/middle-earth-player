// Rules: dwd.durins-bane, rr.combat-phase, rr.shadow-effects, rr.forced, faq.additional-attacks (data/rules/entries.json); ledger lines 04140:B:1, 04149:A:1, 04150:A:2, 04153:A:1, 901802:A:1, 901805:A:1.
// Durin's Bane in the real combat phase of the scenario's own table: which seats it attacks and in which order, a seat raised during combat, the one shadow card of each attack, the immediate attacks of Last Lord of Moria and Leaping Flame,
// Many Thonged Whip's random discard by the defending seat, Terrible Strength on an undefended hero and Morgoth's Bidding's additional attack.
import { describe, expect, it } from "vitest";

import type { PrintedCard } from "../../../rules/core/printed.ts";
import { updateCard, withThreat, type ScenarioState } from "../../../rules/core/state.ts";
import { legalIntents, legalTargets, type PlayerIntent } from "../../../rules/engine/reduce.ts";
import { finish, idOf, send, start, tableFromLayout, type Layout, type Run } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "shadow-and-flame";
const BANE = "04150";
// The stand-in heroes have the hit points of the golden's brittle ones; these have enough to be attacked a few times.
const table = (layout: Layout) => {
  const made = tableFromLayout(SCENARIO, layout);
  for (const code of ["dh1", "dh2", "dh3"]) made.cards.set(code, { ...(made.cards.get(code) as PrintedCard), health: 50 });
  return made;
};
type Made = ReturnType<typeof table>;

type Hooks = {
  // The intent for the window that is open, or null for the default one (decline, pass, undefended, the first option).
  answer?: (state: ScenarioState, made: Made) => PlayerIntent | null;
  // The state to carry on with after each intent (a threat raised during combat).
  tweak?: (state: ScenarioState, steps: number) => ScenarioState;
  stop?: (state: ScenarioState) => boolean;
};

// Plays the table from the encounter phase's optional engagement through the combat phase to its end, every window answered by the hooks or by its default.
function combat(made: Made, hooks: Hooks = {}): Run {
  let run: Run = start(made.state);
  for (let guard = 0; guard < 300 && (run.state.phase === "Encounter" || run.state.phase === "Combat") && !run.state.lost && !hooks.stop?.(run.state); guard += 1) {
    const state = run.state;
    const window = state.window;
    let intent: PlayerIntent | null = hooks.answer?.(state, made) ?? null;
    if (!intent) {
      if (window?.kind === "choose") intent = { type: "Choose", optionId: window.options[0] ?? "" };
      else if (window?.kind === "chooseEnemy") intent = { type: "ChooseEnemy", enemyId: window.options[0] ?? "" };
      else if (window?.kind === "defense") {
        const heroes = legalTargets(state, { type: "Undefended" }, made.ctx);
        intent = { type: "Undefended", heroId: heroes[0] ?? made.hero };
      } else if (window?.kind === "look") intent = { type: "Pass" };
      else {
        const pass = legalIntents(state, made.ctx).find((offered) => offered.type === "Pass" || offered.type === "DeclineAttack" || offered.type === "DeclineEngage" || offered.type === "DeclineTravel");
        if (!pass) break;
        intent = pass as PlayerIntent;
      }
    }
    run = send(run, intent, made.ctx);
    if (hooks.tweak) run = { ...run, state: hooks.tweak(run.state, run.steps.length) };
  }
  return finish(run, made.ctx);
}

// The seats Durin's Bane struck, in the order of its attacks (the controller of the card that took each).
const struck = (run: Run): number[] => run.steps.flatMap((step) => (step.kind === "strike" && step.side === "enemy" && run.state.cards[step.enemyId]?.code === BANE ? [run.state.cards[step.targetId]?.controller ?? -1] : []));

describe("04150:A:2 Durin's Bane in the combat phase", () => {
  it("04150:A:2 attacks once each seat whose threat is 1 or greater, the first player first, and not a seat below threat 1", () => {
    expect(struck(combat(table({ seats: 2, phase: "Encounter", threat: [4, 6], staging: [BANE], deck: ["f0", "f0", "f0"] })))).toEqual([0, 1]);
    expect(struck(combat(table({ seats: 2, phase: "Encounter", threat: [4, 0], staging: [BANE], deck: ["f0", "f0", "f0"] })))).toEqual([0]);
    expect(struck(combat(table({ seats: 2, phase: "Encounter", threat: [0, 0], staging: [BANE], deck: ["f0", "f0", "f0"] })))).toEqual([]);
  });

  it("04150:A:2 deals each attack its own shadow card, one at a time, discarded once the attack is done", () => {
    const made = table({ seats: 2, phase: "Encounter", threat: [4, 6], staging: [BANE], deck: ["f0", "f3", "f0", "f0"] });
    const run = combat(made);
    // The two shadow cards left the deck and lie in the encounter discard pile, none still dealt to Durin's Bane.
    expect(Object.values(run.state.cards).filter((card) => card.zone === "encounterDeck")).toHaveLength(2);
    expect(Object.values(run.state.cards).filter((card) => card.zone === "shadow")).toHaveLength(0);
    expect(Object.values(run.state.cards).filter((card) => card.zone === "encounterDiscard")).toHaveLength(2);
  });

  it("04150:A:2 attacks a seat whose threat is raised during combat when it has not attacked yet, and deals it no shadow card", () => {
    const made = table({ seats: 2, phase: "Encounter", threat: [4, 0], staging: [BANE], deck: ["f0", "f0", "f0"] });
    // The second player's threat rises while the first player's attack is being defended, before the second player's attack step.
    const run = combat(made, { tweak: (state) => (state.window?.kind === "defense" && state.window.seat === 0 && state.seats[1]?.threat === 0 ? withThreat(state, 1, 3) : state) });
    expect(struck(run)).toEqual([0, 1]);
    // One shadow card was dealt, to the attack on the first player.
    expect(Object.values(run.state.cards).filter((card) => card.zone === "encounterDeck")).toHaveLength(2);
  });
});

describe("04150:A:2 attacking Durin's Bane", () => {
  it("04150:A:2 may be attacked in the player attack step by the characters of a seat it is engaged with, and not by one whose threat is below 1", () => {
    const made = table({ seats: 2, phase: "Encounter", threat: [4, 0], staging: [BANE], deck: ["f0", "f0", "f0"] });
    const open = combat(made, { stop: (state) => state.window?.kind === "playerAttack" && state.activeSeat === 0 });
    const bane = idOf(open.state, BANE);
    expect(legalTargets(open.state, { type: "DeclareAttackers", cardId: made.hero }, made.ctx)).toContain(bane);
    expect(legalTargets(open.state, { type: "DeclareAttackers", cardId: idOf(open.state, "dh3") }, made.ctx)).not.toContain(bane);
  });
});

describe("04153:A:1 Many Thonged Whip's discard falls on the defending player", () => {
  it("04153:A:1 discards a card at random from the hand of the seat Durin's Bane attacks, not the other seat's", () => {
    const made = table({ seats: 2, phase: "Encounter", threat: [0, 5], staging: [BANE], attached: [{ code: "04153", to: BANE }], hand: [{ code: "filler", seat: 0 }, { code: "filler", seat: 1 }, { code: "filler", seat: 1 }], deck: ["f0", "f0", "f0"] });
    const run = combat(made);
    expect(struck(run)).toEqual([1]);
    expect(run.state.seats[0]?.hand).toHaveLength(1);
    expect(run.state.seats[1]?.hand).toHaveLength(1);
  });
});

describe("901802:A:1 Terrible Strength on an undefended hero", () => {
  it("901802:A:1 turns the damage beyond the remaining hit points of a destroyed undefended hero into damage on another character", () => {
    // Durin's Bane (Attack 6) attacks a hero with 2 hit points left, undefended, with Terrible Strength as its shadow card: 4 excess.
    const made = table({ phase: "Encounter", threat: [4, 0], staging: [BANE], deck: ["901802", "f0", "f0"] });
    const hurt = { ...made, state: updateCard(made.state, made.hero, { damage: 48 }) };
    const run = combat(hurt);
    expect(run.state.cards[made.hero]?.zone).toBe("discard");
    expect(run.state.cards[made.hero2]?.damage).toBe(4);
    // The exhaustion is the spec row's (the refresh phase that follows the combat phase readies the character again).
  });
});

describe("901805:A:1 Morgoth's Bidding", () => {
  it("901805:A:1 brings an additional attack by Durin's Bane against the defending player when the attack destroys a character, with a new shadow card", () => {
    const made = table({ phase: "Encounter", threat: [4, 0], staging: [BANE], play: ["ally"], deck: ["901805", "f0", "f0", "f0"] });
    const ally = idOf(made.state, "ally");
    const run = combat(made, { answer: (state) => (state.window?.kind === "defense" && legalTargets(state, { type: "DeclareDefender" }, made.ctx).includes(ally) ? { type: "DeclareDefender", defenderId: ally } : null) });
    expect(run.state.cards[ally]?.zone).toBe("discard");
    expect(struck(run)).toEqual([0, 0]);
    // The first attack's shadow card and the additional attack's new one both left the deck.
    expect(Object.values(run.state.cards).filter((card) => card.zone === "encounterDeck")).toHaveLength(2);
  });
});

describe("901801:A:4 the Balrog discard pile at the beginning of combat", () => {
  const FLAME = { nightmare: "901801", phase: "Encounter", threat: [4, 0], staging: [BANE], deck: ["f0", "f0"] } as const satisfies Layout;

  it("901801:A:4 is shuffled back into the Balrog deck at the beginning of the combat phase, before Durin's Bane is dealt its shadow card", () => {
    const run = combat(table({ ...FLAME, piles: { balrogDeck: ["901802"], balrogDiscard: ["901803", "901803"] } }));
    // Reshuffled first: three cards in the deck, one dealt for the attack and discarded again.
    expect(run.state.piles?.balrogDeck).toHaveLength(2);
    expect(run.state.piles?.balrogDiscard).toHaveLength(1);
    // The encounter deck gave no shadow card.
    expect(Object.values(run.state.cards).filter((card) => card.zone === "encounterDeck")).toHaveLength(2);
  });

  it("901801:A:3 deals Durin's Bane each attack's shadow card from the Balrog deck and discards it to the Balrog discard pile", () => {
    const run = combat(table({ ...FLAME, piles: { balrogDeck: ["901802", "901803"], balrogDiscard: [] } }));
    expect(run.state.piles?.balrogDeck).toHaveLength(1);
    expect(run.state.piles?.balrogDiscard).toHaveLength(1);
    expect(struck(run)).toEqual([0]);
  });
});
