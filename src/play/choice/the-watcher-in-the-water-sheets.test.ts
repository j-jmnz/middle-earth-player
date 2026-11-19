// Rules: rr.first-player, rr.the-word-choose, rr.travel, dwd.doors-of-durin (data/rules/entries.json); ledger lines 040076:A:1, 04065:A:2, 04066:A:1, 04070:A:1, 04072:A:3, 04073:A:1, 04074:A:1, 901502:A:2, 901504:A:1, 901508:A:2.
// The sheets of The Watcher in the Water's choices (words/asks/the-watcher-in-the-water.ts): each sentence names the card, what the choice does and its number, and says whose choice it is (the first player's, or one player's own: "Player 1:" leads an owned one).
import { describe, expect, it } from "vitest";

import { settle } from "../../rules/engine/machine.ts";
import { legalIntents } from "../../rules/engine/legal.ts";
import type { EngineStep } from "../../rules/core/intents.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import { pushCardEffects } from "../../rules/interpret/effect-frames.ts";
import { crossBoundary } from "../../rules/windows/triggers.ts";
import { idOf, revealFromTop, send, start, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
import { sheetFor } from "./sheets.ts";

const table = (layout: Layout) => tableFromLayout("the-watcher-in-the-water", layout);
type Made = ReturnType<typeof table>;

/** The pick sheet open in the state. */
function pickSheet(made: Made, state: ScenarioState) {
  const names = { card: (id: string) => made.cards.get(state.cards[id]?.code ?? id)?.name ?? id, line: () => null };
  const sheet = sheetFor(state, made.ctx, legalIntents(state, made.ctx), names);
  if (sheet?.kind !== "pick") throw new Error(`no pick sheet: ${JSON.stringify(state.window)}`);
  return sheet;
}

/** The card's records of this timing resolve for `seat` (the seat the effect runs for) and stop at the first window they open. */
function opened(made: Made, code: string, timing: "whenRevealed" | "travel" | "forced" | "action", seat = 0) {
  const steps: EngineStep[] = [];
  const id = idOf(made.state, code);
  const effects = made.ctx.effects.filter((effect) => effect.cardCode === code && effect.timing === timing);
  const pushed = pushCardEffects(made.state, timing === "action" ? "forced" : timing, id, seat, false, effects, made.ctx, steps);
  const state = settle({ ...pushed, window: null, mode: "stopped" as const }, made.ctx, steps);
  return Object.assign(pickSheet(made, state), { state });
}

describe("The Watcher in the Water's choice words", () => {
  it("040076:A:1 Wrapped! asks the first player for a hero and says what it does to it", () => {
    const made = table({ seats: 2, phase: "Quest", deck: ["f0", "f0"] });
    const sheet = pickSheet(made, revealFromTop(made.state, made.ctx, "040076", []).state);
    expect(sheet.note).toContain("Wrapped!: choose a hero the first player controls to carry it.");
    expect(sheet.note).toContain("cannot exhaust or ready, and is discarded from play at the end of the round");
    expect(sheet.note).toContain("Player 1 chooses");
  });

  it("040076:A:1 its Combat Action is owned by the player who uses it", () => {
    const made = table({ seats: 2, phase: "Combat", staging: ["040076"] });
    const sheet = opened(made, "040076", "action", 0);
    expect(sheet.note).toContain("Player 1: Wrapped!: choose a ready hero you control with no Tentacle attachment to exhaust.");
  });

  it("04066:A:1 Stair Falls says the first player pays 2 characters and names the first and the second", () => {
    const made = table({ seats: 2, phase: "Travel", staging: ["04066"], play: [{ code: "ally" }] });
    const first = opened(made, "04066", "travel");
    expect(first.note).toContain("the first player exhausts 2 ready characters he controls. Choose the first character.");
    const chosen = send(start(first.state), { type: "Choose", optionId: first.state.window?.kind === "choose" ? (first.state.window.options[0] ?? "") : "" }, made.ctx);
    expect(pickSheet(made, chosen.state).note).toContain("choose the second ready character the first player controls to exhaust for the travel cost.");
  });

  it("04070:A:1 Ill Purpose's tie names the players and asks which one the enemies engage", () => {
    const made = table({ seats: 2, staging: ["04070", "04073"], threat: [30, 30], deck: ["f0"] });
    const sheet = opened(made, "04070", "whenRevealed");
    expect(sheet.note).toContain("players are tied for the highest threat. Choose the player every enemy in the staging area engages.");
    expect(sheet.options.map((option) => option.label)).toEqual(["Player 1", "Player 2"]);
  });

  it("04072:A:3 The Watcher asks each player in turn for 1 character to take all 3 damage, the first player first", () => {
    const made = table({ seats: 2, staging: ["04072"], phase: "Combat" });
    const steps: EngineStep[] = [];
    const first = pickSheet(made, settle(crossBoundary({ ...made.state, phase: "Refresh", boundaryPhase: "Combat", window: null }, made.ctx, steps), made.ctx, steps));
    expect(first.note).toContain("Player 1: The Watcher is in the staging area: choose 1 character you control to take all 3 damage.");
  });

  it("901502:A:2 the Nightmare Watcher words it the same way", () => {
    const made = table({ nightmare: "901501", seats: 2, staging: ["901502"], phase: "Combat" });
    const steps: EngineStep[] = [];
    const sheet = pickSheet(made, settle(crossBoundary({ ...made.state, phase: "Refresh", boundaryPhase: "Combat", window: null }, made.ctx, steps), made.ctx, steps));
    expect(sheet.note).toContain("The Watcher is in the staging area: choose 1 character you control to take all 3 damage.");
  });

  it("04065:A:2 Doors of Durin's hand discards are the player's own, one card at a time, with Done", () => {
    const made = table({ seats: 2, active: "04065", hand: ["filler", "event"], deck: ["f0", "f0"] });
    const sheet = opened(made, "04065", "action");
    expect(sheet.note).toContain("Player 1: Doors of Durin: choose any number of cards from your hand to discard, one at a time. Done stops.");
    expect(sheet.note).toContain("same first letter");
    expect(sheet.options.map((option) => option.label)).toEqual(["filler", "event", "Done"]);
  });

  it("04073:A:1 and 04074:A:1 Grasping and Thrashing Tentacle say the first player chooses among the attacking characters, and Thrashing the damage it deals", () => {
    for (const code of ["04073", "04074"]) {
      const made = table({ seats: 2, phase: "PlayerAttacks", engaged: [{ code }], deck: ["04066", "f0", "f0"] });
      const run = send(start(made.state), { type: "DeclareAttackers", enemyId: idOf(made.state, code), attackerIds: ["dh1", "dh2"].map((c) => idOf(made.state, c)) }, made.ctx);
      const sheet = pickSheet(made, run.state);
      expect(sheet.note, code).toContain("choose 1 of the attacking characters");
      expect(sheet.note, code).toContain("Player 1 chooses");
      if (code === "04074") expect(sheet.note).toContain("take the attack's 4 damage, ignoring defense");
      else expect(sheet.note).toContain("Attack and Defense become 0");
    }
  });

  it("901504:A:1 Choking Tentacle asks the first player for a character of the defending player", () => {
    const made = table({ seats: 2, engaged: [{ code: "901504", seat: 1 }], deck: ["04066", "f0", "f0"], play: [{ code: "ally", seat: 1 }] });
    const sheet = opened(made, "901504", "forced", 1);
    expect(sheet.note).toContain("choose a character the defending player controls to carry it. It takes 1 damage each time it readies.");
    expect(sheet.note).toContain("Player 1 chooses");
  });

  it("901508:A:2 Rippling From Beneath says how many Tentacle enemies the first player shuffles in: one for each player", () => {
    const made = table({ seats: 2, staging: ["901508"], discard: ["04073", "04074", "04075"], deck: ["f0"] });
    const sheet = opened(made, "901508", "whenRevealed");
    expect(sheet.note).toContain("choose a Tentacle enemy from the encounter discard pile to shuffle into the encounter deck.");
    expect(sheet.note).toContain("picks 2 in all, as many as there are players");
    expect(sheet.options.map((option) => option.label)).toEqual(["Grasping Tentacle", "Thrashing Tentacle", "Striking Tentacle"]);
  });
});
