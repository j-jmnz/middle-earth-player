// Rules: rr.surge, rr.running-out-of-cards, faq.last-encounter-card (data/rules/entries.json); ledger lines 07055:A:2, 07063:B:2.
// The hold of a surge chain that changes nothing (repeatsChain) goes through the reducer: every answer of the player is an accepted intent, which changes the undo log, and the lap still finds the table of the lap before.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../core/intents.ts";
import { updateCard } from "../core/state.ts";
import { reduce, type ScenarioState } from "../engine/reduce.ts";
import { HERO, idOf, revealFromTop, tableFromLayout } from "../../../test/harness/scene-kit.ts";

const SCENARIO = "to-catch-an-orc";
const COVER = "07055";
const STAGE_2 = "07063";
const TEST_OF_WILL = "01050"
const EOWYN = "01007";
const PARTY = "07041";

// Take Cover! is the only encounter card; a committed character lies exhausted, so the card's choice opens each lap. Orc Hunting Party lies out of play, so the game deals the card.
function table(extra: { hand?: readonly string[]; heroes?: readonly string[] } = {}) {
  const t = tableFromLayout(SCENARIO, { stage: STAGE_2, timeCounters: 2, deck: [], piles: { outOfPlay0: [PARTY] }, committed: [HERO], heroResources: 1, hand: extra.hand, heroes: extra.heroes }, { extra: [...(extra.hand ?? []), ...(extra.heroes ?? [])] });
  const exhausted = updateCard(t.state, idOf(t.state, HERO), { exhausted: true });
  const spirit = extra.heroes?.[0];
  return { t, state: spirit ? updateCard(exhausted, idOf(exhausted, spirit), { resources: 1 }) : exhausted };
}

// The player answers whatever window opens: the first option of a choice (the time counter, as the card lists it second, is picked by name), a pass for anything else. Returns the laps counted and the state the game stopped in.
function play(state: ScenarioState, t: ReturnType<typeof table>["t"], pick: (state: ScenarioState) => string): { state: ScenarioState; windows: number; kinds: string[]; steps: EngineStep[] } {
  const steps: EngineStep[] = [];
  let current = revealFromTop(state, t.ctx, COVER, steps).state;
  let windows = 0;
  const kinds: string[] = [];
  for (let guard = 0; guard < 60 && current.window != null && current.stack.length > 0; guard += 1) {
    windows += 1; kinds.push(current.window.kind);
    const intent = current.window.kind === "choose" ? ({ type: "Choose", optionId: pick(current) } as const) : ({ type: "Pass" } as const);
    const result = reduce(current, intent, t.ctx);
    if (!result.ok) throw new Error(result.reason);
    current = result.state;
    steps.push(...result.steps);
  }
  return { state: current, windows, kinds, steps };
}

describe("a surge chain that changes nothing", () => {
  it("ends when the player picks the time counter on every lap, with a Choose window each lap (the undo log changes between laps)", () => {
    const { t, state } = table();
    const done = play(state, t, (s) => (s.window?.kind === "choose" ? (s.window.options[s.window.options.length - 1] ?? "") : ""));
    expect(done.windows).toBeGreaterThan(1);
    expect(done.windows).toBeLessThan(20);
    expect(done.state.window).toBeNull();
    expect(done.state.stack).toHaveLength(0);
    expect(done.state.lost).toBe(false);
  });

  it("ends when a Response window opens on each lap and the player passes it (A Test of Will in hand, a spirit hero to pay for it)", () => {
    const { t, state } = table({ hand: [TEST_OF_WILL], heroes: [EOWYN] });
    const done = play(state, t, (s) => (s.window?.kind === "choose" ? (s.window.options[s.window.options.length - 1] ?? "") : ""));
    expect(done.kinds).toContain("response");
    expect(done.kinds.filter((kind) => kind === "response").length).toBeGreaterThan(1);
    expect(done.windows).toBeLessThan(30);
    expect(done.state.window).toBeNull();
    expect(done.state.stack).toHaveLength(0);
    expect(done.state.lost).toBe(false);
  });
});
