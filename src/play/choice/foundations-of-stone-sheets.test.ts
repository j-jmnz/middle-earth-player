// Rules: ltp.commit-characters, rr.the-word-choose (data/rules/entries.json); ledger lines 04118:B:2.
// The sheets of Foundations of Stone's moments. Out of the Depths (04118:B:2) lets a player commit no more allies than heroes: the commit window offers only sets the reducer accepts.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../rules/core/intents.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import { spawn } from "../../rules/core/zones.ts";
import { settle } from "../../rules/engine/machine.ts";
import { pushCardEffects } from "../../rules/interpret/effect-frames.ts";
import { legalIntents } from "../../rules/engine/legal.ts";
import { reduce } from "../../rules/engine/reduce.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
import { windowSheet } from "./bar-sheets.ts";
import { sheetFor } from "./sheets.ts";
import { tap, type Choice, type TapContext } from "./table-choice.ts";

const table = (layout: Layout) => tableFromLayout("foundations-of-stone", layout);

describe("Out of the Depths' commit window (04118:B:2)", () => {
  const made = table({ stage: "04118", play: ["ally", "ally", "ally"], phase: "Quest" });
  const state = syncConstants({ ...made.state }, made.ctx);
  const legal = legalIntents(state, made.ctx);
  const names = { card: (id: string) => id, line: () => null };
  const sheet = windowSheet(state, made.ctx, legal, names);
  const table4: TapContext = { game: state, ctx: made.ctx, legal, names };
  const [hero1, hero2] = state.seats[0].heroes;
  const [ally1, ally2, ally3] = state.seats[0].play;
  const tapped = (held: Choice, id: string): Choice => {
    const result = tap(sheet, held, id, table4);
    return result.kind === "choice" ? result.choice : held;
  };
  const key = { key: sheet.key, ids: [] as readonly string[], shares: [] };

  it("04118:B:2 a tap on an ally with no hero picked does nothing, and the set picked is always one the reducer accepts", () => {
    expect(tapped(key, ally1 ?? "").ids).toEqual([]);
    let choice: Choice = key;
    for (const id of [hero1, ally1, ally2, ally3, hero2, ally2].map((item) => item ?? "")) {
      choice = tapped(choice, id);
      if (choice.ids.length > 0) expect(reduce(state, { type: "Commit", cardIds: [...choice.ids] }, made.ctx).ok, `${choice.ids}`).toBe(true);
    }
  });

  it("04118:B:2 one hero allows one ally: the second ally is not picked until a second hero is", () => {
    let choice = tapped(key, hero1 ?? "");
    choice = tapped(choice, ally1 ?? "");
    choice = tapped(choice, ally2 ?? "");
    expect(choice.ids).toEqual([hero1, ally1]);
    choice = tapped(choice, hero2 ?? "");
    choice = tapped(choice, ally2 ?? "");
    expect(choice.ids).toEqual([hero1, ally1, hero2, ally2]);
  });

  it("04118:B:2 unpicking a hero drops the allies it leaves over", () => {
    let choice: Choice = { key: sheet.key, ids: [hero1 ?? "", ally1 ?? "", hero2 ?? "", ally2 ?? ""], shares: [] };
    choice = tapped(choice, hero1 ?? "");
    expect(choice.ids).toEqual([ally1, hero2]);
    expect(reduce(state, { type: "Commit", cardIds: [...choice.ids] }, made.ctx).ok).toBe(true);
  });
});

// The sheets of the scenario's choices (words/asks/foundations-of-stone.ts): each says who answers and what the card does, and a pick that spans seats names the owner of each row.
function sheetOf(made: ReturnType<typeof table>, state: ScenarioState) {
  const names = { card: (id: string) => made.cards.get(state.cards[id]?.code ?? id)?.name ?? id, line: () => null };
  return sheetFor(state, made.ctx, legalIntents(state, made.ctx), names);
}

/** The records of the card with this timing resolve and stop at the first window they open. */
function opened(made: ReturnType<typeof table>, code: string, timing: "whenRevealed" | "forced" | "setup", state: ScenarioState = made.state) {
  const steps: EngineStep[] = [];
  const id = state.cards[code] ? code : (Object.values(state.cards).find((card) => card.code === code)?.id ?? spawn(state, code, { zone: "staging" }).id);
  const base = Object.values(state.cards).some((card) => card.id === id) ? state : spawn(state, code, { zone: "staging" }).state;
  const effects = made.ctx.effects.filter((effect) => effect.cardCode === code && effect.timing === timing);
  const pushed = pushCardEffects(base, timing === "setup" ? "setup" : timing === "whenRevealed" ? "whenRevealed" : "forced", id, 0, false, effects, made.ctx, steps);
  const settledState = settle({ ...pushed, window: null, mode: "stopped" as const }, made.ctx, steps);
  return { state: settledState, sheet: sheetOf(made, settledState) };
}

describe("Foundations of Stone's choice words", () => {
  it("04111:A:1 the Torch pick says the first player chooses and names the owner of each hero row two-handed", () => {
    const made = table({ seats: 2, stage: "04111", side: "A" });
    const { sheet } = opened(made, "04111", "setup");
    expect(sheet?.kind).toBe("pick");
    if (sheet?.kind !== "pick") return;
    expect(sheet.note).toContain("the first player chooses a hero of any player to carry Cave Torch");
    expect(sheet.options.map((item) => item.label)).toEqual(["dh1 · Player 1's hero", "dh2 · Player 1's hero", "dh3 · Player 2's hero"]);
  });

  it("901703:A:1 a tie for the highest printed cost in hand asks which card goes into the deck", () => {
    const made = table({ hand: ["c2", "c2", "c1"], deckOf: ["c0"] });
    const { sheet } = opened(made, "901703", "whenRevealed");
    expect(sheet?.kind).toBe("pick");
    if (sheet?.kind !== "pick") return;
    expect(sheet.note).toContain("tied for the highest printed cost");
    expect(sheet.options).toHaveLength(2);
  });

  it("901708:A:1 Chill of the Roots offers to discard the hand or raise the threat by its size, naming the number", () => {
    const made = table({ hand: ["c1", "c1", "c1"] });
    const { sheet } = opened(made, "901708", "whenRevealed");
    expect(sheet?.kind).toBe("pick");
    if (sheet?.kind !== "pick") return;
    expect(sheet.note).toContain("(3)");
    expect(sheet.options.map((item) => item.label)).toEqual(["Discard your hand (3 cards)", "Raise your threat by 3"]);
  });

  it("04124:A:1 Lost and Alone asks for a hero the player controls", () => {
    const made = table({ deckOf: ["c1"] });
    const { sheet } = opened(made, "04124", "whenRevealed");
    expect(sheet?.kind).toBe("pick");
    if (sheet?.kind !== "pick") return;
    expect(sheet.note).toContain("choose 1 hero you control to shuffle into your deck");
    expect(sheet.options).toHaveLength(2);
  });
});
