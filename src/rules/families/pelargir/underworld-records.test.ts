// Rules: ats.underworld, ats.underworld-example, rr.reveal, rr.quest-advancement, rr.constant-ability (data/rules/entries.json). The family's verbs together with the records of The Steward's Fear (src/effects/authored/against-the-shadow/the-stewards-fear.ts): what Underworld X takes when a location is
// revealed, found by a search or made active, where the cards under a location go when it leaves play, the card the Hand of Castamir reveals and discards, the four tokens that advance a stage, and the plots' losses. The printed lines have their own rows in src/campaign/scenarios/the-stewards-fear/.
import { describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../../../catalog/boundary.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ScenarioState } from "../../core/state.ts";
import { settle } from "../../engine/machine.ts";
import { restricted } from "../../interpret/restrictions.ts";
import { pushCardEffects } from "../../interpret/effect-frames.ts";
import { finish, idOf, resolveRecords, revealedTop, type Layout, type LayoutTable } from "../../../../test/harness/scene-kit.ts";
import { CODES, DECK_CODES, codeOf, deckCodes, run, table, underCodes } from "../../../../test/scenarios/the-stewards-fear/table.ts";

const SETUP: Instruction = { verb: "BuildUnderworldDeck", codes: DECK_CODES };

// A table with the underworld deck built from the Setup record's verb.
function withDeck(layout: Layout): LayoutTable & { state: ScenarioState } {
  const made = table({ ...layout, setAside: [...(layout.setAside ?? []), ...DECK_CODES] });
  return { ...made, state: run(made, made.state, SETUP) };
}

function inFrame(made: LayoutTable, state: ScenarioState, source: string, instructions: Instruction[]): ScenarioState {
  const steps: EngineStep[] = [];
  const effect: Effect = { id: "test:whenRevealed:1", cardCode: made.state.cards[source]?.code ?? "", lines: [], timing: "whenRevealed", instructions };
  return finish({ state: settle(pushCardEffects({ ...state, window: null, mode: "stopped" }, "whenRevealed", source, 0, false, [effect], made.ctx, steps), made.ctx, steps), steps }, made.ctx).state;
}

describe("Underworld X on entry", () => {
  it("a location revealed from the encounter deck: When Revealed first (1 card under the active location), then it enters play and takes its value (Sewers: 1 under itself)", () => {
    const t = withDeck({ active: "place" });
    const revealed = revealedTop(t, CODES.sewers);
    const sewers = idOf(revealed, CODES.sewers);
    expect(underCodes(revealed, sewers)).toHaveLength(1);
    expect(underCodes(revealed, idOf(revealed, "place"))).toHaveLength(1);
    expect(deckCodes(revealed)).toHaveLength(DECK_CODES.length - 2);
    expect(revealed.cards[sewers]?.zone).toBe("staging");
  });

  it("Houses of the Dead takes 2 cards, as the rules example says, and the cards under it are staged one at a time when it leaves play", () => {
    const t = withDeck({ staging: ["treachery"] });
    const revealed = revealedTop(t, CODES.houses);
    const houses = idOf(revealed, CODES.houses);
    expect(underCodes(revealed, houses)).toHaveLength(2);
    const gone = inFrame(t, revealed, idOf(revealed, "treachery"), [{ verb: "ShuffleStagingIntoEncounterDeck" }]);
    expect(underCodes(gone, houses)).toHaveLength(0);
    expect(gone.staging.map((id) => codeOf(gone, id)).sort()).toEqual([...(underCodes(revealed, houses) as string[]), "treachery"].sort());
    for (const id of gone.staging) expect(gone.cards[id]?.face).toBe("up");
  });

  it("a card found by a search takes its value too (a search announces no entry of its own): Lost in the City's find, The Fourth Star found by stage 1B and made active", () => {
    const t = withDeck({ seats: 2, deck: [CODES.star], stage: CODES.conspiracy });
    const done = resolveRecords(t.state, t.ctx, CODES.conspiracy, "whenRevealed", undefined);
    const star = idOf(done.state, CODES.star);
    expect(done.state.activeLocation).toBe(star);
    expect(underCodes(done.state, star)).toHaveLength(2);
  });

  it("Roots of Mindolluin made active by stage 2B takes 1; the old active location returns to the staging area and keeps what lies under it", () => {
    const t = withDeck({ active: CODES.sewers, setAside: [CODES.roots], stage: CODES.design, side: "A" });
    const sewers = idOf(t.state, CODES.sewers);
    const stacked = run(t, t.state, { verb: "TakeUnderworld", amount: 1, host: "self" }, sewers);
    const done = resolveRecords(stacked, t.ctx, CODES.design, "whenRevealed", undefined);
    const roots = idOf(done.state, CODES.roots);
    expect(done.state.activeLocation).toBe(roots);
    expect(underCodes(done.state, roots)).toHaveLength(1);
    expect(done.state.cards[sewers]?.zone).toBe("staging");
    expect(underCodes(done.state, sewers)).toHaveLength(1);
  });

  it("with no card left in the underworld deck the keyword has no effect", () => {
    const t = table({});
    const revealed = revealedTop(t, CODES.houses);
    expect(underCodes(revealed, idOf(revealed, CODES.houses))).toHaveLength(0);
  });
});

describe("The Hand of Castamir (06016:A:1)", () => {
  it("a location it reveals goes to the discard pile without entering play: no Underworld, no card in the staging area, but its When Revealed resolves", () => {
    const t = withDeck({ active: "place", staging: [CODES.castamir], deck: [CODES.sewers, "f0", "f0"] });
    const castamir = idOf(t.state, CODES.castamir);
    const done = inFrame(t, t.state, castamir, [{ verb: "RevealTopThenDiscard" }]);
    expect(done.encounterDiscard.map((id) => codeOf(done, id))).toContain(CODES.sewers);
    expect(done.staging.map((id) => codeOf(done, id))).toEqual([CODES.castamir]);
    const sewers = idOf(done, CODES.sewers);
    expect(underCodes(done, sewers)).toHaveLength(0);
    expect(underCodes(done, idOf(done, "place"))).toHaveLength(1);
  });
});

describe("The stages' tokens (06011:B:2, 06011:B:3)", () => {
  it("4 resource tokens on the current stage advance it at once, with the round under way", () => {
    const t = table({ stage: CODES.conspiracy });
    const stage = t.state.questStage ?? "";
    const loaded = { ...t.state, round: 1, window: null, cards: { ...t.state.cards, [stage]: { ...t.state.cards[stage]!, resources: 3 } } } as ScenarioState;
    const syncedBefore = settle(loaded, t.ctx, []);
    expect(codeOf(syncedBefore, syncedBefore.questStage)).toBe(CODES.conspiracy);
    const four = { ...loaded, cards: { ...loaded.cards, [stage]: { ...loaded.cards[stage]!, resources: 4 } } } as ScenarioState;
    const advanced = settle(four, t.ctx, []);
    expect(codeOf(advanced, advanced.questStage)).toBe(CODES.design);
  });
});

describe("The Confrontation (06013:B:2)", () => {
  it("the quest cannot advance while a Villain is in play, in the staging area or engaged, and can when none is", () => {
    const none = table({ stage: CODES.confrontation });
    expect(restricted(none.state, none.ctx, "advance")).toEqual([]);
    for (const layout of [{ staging: [CODES.castamir] }, { engaged: [CODES.bane] }]) {
      const villain = table({ stage: CODES.confrontation, ...layout });
      expect(restricted(villain.state, villain.ctx, "advance").length).toBeGreaterThan(0);
    }
    const other = table({ stage: CODES.confrontation, staging: [CODES.dissident] });
    expect(restricted(other.state, other.ctx, "advance")).toEqual([]);
  });
});
