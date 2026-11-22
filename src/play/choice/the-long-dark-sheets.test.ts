// Rules: dwd.locate-test, dwd.lost-effects, rr.first-player, rr.the-word-choose (data/rules/entries.json); ledger lines 04087:B:1, 04099:A:2, 901604:A:2, 901606:A:1, 901607:A:1, 901607:A:2.
// The sheets of The Long Dark's choices (words/asks/the-long-dark.ts): the locate test says who makes it, what a hand card does, that PASS passes and lists the encounter cards discarded so far with whether each prints PASS; the Lost order is the first player's, and
// the Shadows' and Dreadful Deep's Lost choices and the hand discards are each player's own ("Player 1: ..."), while Bottomless Chasm's pick over every hand names the owner of each row.
import { describe, expect, it } from "vitest";

import { settle } from "../../rules/engine/machine.ts";
import { legalIntents } from "../../rules/engine/legal.ts";
import type { EngineStep } from "../../rules/core/intents.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import { pushCardEffects } from "../../rules/interpret/effect-frames.ts";
import { placeProgress } from "../../rules/interpret/effect-verbs.ts";
import { idOf, revealFromTop, send, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
import { sheetFor } from "./sheets.ts";

const table = (layout: Layout) => tableFromLayout("the-long-dark", layout);
type Made = ReturnType<typeof table>;

/** The pick sheet open in the state. */
function pickSheet(made: Made, state: ScenarioState) {
  const names = { card: (id: string) => made.cards.get(state.cards[id]?.code ?? id)?.name ?? id, line: () => null };
  const sheet = sheetFor(state, made.ctx, legalIntents(state, made.ctx), names);
  if (sheet?.kind !== "pick") throw new Error(`no pick sheet: ${JSON.stringify(state.window)}`);
  return sheet;
}

/** The card's records of this timing resolve for seat 0 and stop at the first window they open. */
function opened(made: Made, code: string, timing: "whenRevealed" | "forced" | "shadow") {
  const steps: EngineStep[] = [];
  const id = idOf(made.state, code);
  const effects = made.ctx.effects.filter((effect) => effect.cardCode === code && effect.timing === timing);
  const pushed = pushCardEffects(made.state, timing, id, 0, false, effects, made.ctx, steps);
  const state = settle({ ...pushed, window: null, mode: "stopped" as const }, made.ctx, steps);
  return Object.assign(pickSheet(made, state), { state });
}

describe("The Long Dark's choice words", () => {
  it("04087:B:1 the locate test says who makes it, what a card does and that PASS passes, with Stop to fail it", () => {
    const made = table({ stage: "04087", hand: ["filler", "event"], deck: ["f0", "04089"] });
    const sheet = opened(made, "04087", "whenRevealed");
    expect(sheet.note).toContain("Continuing Eastward: the first player makes a locate test.");
    expect(sheet.note).toContain("Discard 1 card from their hand to discard the top encounter card.");
    expect(sheet.note).toContain("A card that prints PASS passes the test; Stop fails it.");
    expect(sheet.note).toContain("Discarded so far: none yet.");
    expect(sheet.options.map((option) => option.label)).toContain("Stop: fail the test");
  });

  it("04087:B:1 shows each encounter card discarded so far with whether it prints PASS, on the next try", () => {
    const made = table({ stage: "04087", hand: ["filler", "event", "filler"], deck: ["04093", "04092", "04089"] });
    const first = opened(made, "04087", "whenRevealed");
    const option = first.state.window?.kind === "choose" ? (first.state.window.options[0] ?? "") : "";
    const next = pickSheet(made, send({ state: first.state, steps: [] }, { type: "Choose", optionId: option }, made.ctx).state);
    expect(next.note).toContain("Discarded so far: Fatigue (no PASS).");
  });

  it("901607:A:2 the Shadow's locate test is the defending player's own choice", () => {
    const made = table({ seats: 2, staging: ["901607"], hand: [{ code: "filler", seat: 0 }], deck: ["f0"] });
    const sheet = opened(made, "901607", "shadow");
    expect(sheet.note).toContain("Player 1: Dreadful Deep: the defending player makes a locate test.");
    expect(sheet.note).toContain("Discard 1 card from your hand");
  });

  it("04097:A:1 Cave Spider's discard of 4 reads its entry and numbers each of the expanded picks", () => {
    const made = table({ staging: ["04097"], hand: ["filler", "event", "filler", "event", "filler"], deckOf: ["filler"], deck: ["f0"] });
    const sheet = opened(made, "04097", "whenRevealed");
    expect(sheet.note).toContain("choose 4 cards from your hand to discard, one at a time.");
    expect(sheet.note).toContain("Card 1 of 4.");
    const option = sheet.state.window?.kind === "choose" ? (sheet.state.window.options[0] ?? "") : "";
    const next = pickSheet(made, send({ state: sheet.state, steps: [] }, { type: "Choose", optionId: option }, made.ctx).state);
    expect(next.note).toContain("Card 2 of 4.");
  });

  it("04099:A:2 the Lost effects of several cards are ordered by the first player, each card listed", () => {
    const made = table({ seats: 2, staging: ["04090", "04091", "04099"], hand: [{ code: "filler", seat: 0 }], deck: ["f0"] });
    const sheet = opened(made, "04099", "shadow");
    expect(sheet.note).toContain("Goblin Warlord: the Lost effects of several cards in play are triggered.");
    expect(sheet.note).toContain("The first player chooses which card's Lost effect resolves next");
    expect(sheet.note).toContain("Player 1 chooses");
    expect(sheet.options.map((option) => option.label.split(" ")[0])).toEqual(expect.arrayContaining(["Dwarven", "Silent"]));
  });

  it("901604:A:2 the defending player chooses the Lost effect to trigger, and the sheet says it is his own choice", () => {
    const made = table({ staging: ["04090", "04091", "901604"], hand: ["filler"], deck: ["f0"] });
    const sheet = opened(made, "901604", "shadow");
    expect(sheet.note).toContain("Sentinel of the Deep: choose 1 \"Lost:\" effect in play to trigger, from the card it is printed on.");
  });

  it("901607:A:1 Dreadful Deep has each player choose a Lost effect no earlier player chose", () => {
    const made = table({ seats: 2, staging: ["04090", "04091"], deck: ["f0"] });
    const sheet = pickSheet(made, revealFromTop(made.state, made.ctx, "901607", []).state);
    expect(sheet.note).toContain("Player 1: Dreadful Deep: choose 1 \"Lost:\" effect in play that no earlier player chose");
  });

  it("901606:A:1 Bottomless Chasm's pick spans every hand: the first player chooses and each row names its owner", () => {
    const made = table({ seats: 2, active: "901606", hand: [{ code: "filler", seat: 0 }, { code: "event", seat: 1 }] });
    const steps: EngineStep[] = [];
    const state = settle(placeProgress({ ...made.state, window: null }, idOf(made.state, "901606"), 1, made.ctx, steps), made.ctx, steps);
    const sheet = pickSheet(made, state);
    expect(sheet.note).toContain("Bottomless Chasm: for each progress placed on it, 1 card is discarded from a player's hand.");
    expect(sheet.note).toContain("The first player chooses a card from any player's hand.");
    expect(sheet.options.map((option) => option.label).join(" | ")).toMatch(/Player 2/);
  });
});
